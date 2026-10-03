import { and, desc, eq, like, or, type SQL } from "drizzle-orm";

import { ensureTables, getDb } from "@/db";
import { einvoiceVerifications } from "@/db/schema";
import { getAdminEmails, getRole, resolveAppUser } from "@/lib/auth";
import { getGstProvider, ProviderUnavailableError } from "@/lib/gst/provider-factory";
import type { EinvoiceResult } from "@/lib/gst/types";
import { einvoiceVerificationInputSchema, formatZodErrors } from "@/lib/gst/validation";

function paise(value?: number) {
  return value === undefined ? null : Math.round(value * 100);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const user = await resolveAppUser(request);
  const role = getRole(user);

  await ensureTables();

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toUpperCase();
    const status = url.searchParams.get("status")?.trim();

    const conditions: SQL[] = [];
    if (role !== "Admin") {
      conditions.push(eq(einvoiceVerifications.userId, user.userId));
    }
    if (status && status !== "ALL") conditions.push(eq(einvoiceVerifications.status, status));
    if (search) {
      const predicate = or(
        like(einvoiceVerifications.irn, `%${search.toLowerCase()}%`),
        like(einvoiceVerifications.docNumber, `%${search}%`),
        like(einvoiceVerifications.supplierGstin, `%${search}%`),
      );
      if (predicate) conditions.push(predicate);
    }

    const rows = await getDb()
      .select()
      .from(einvoiceVerifications)
      .where(and(...conditions))
      .orderBy(desc(einvoiceVerifications.createdAt))
      .limit(100);

    const records = rows.map((row) => ({
      ...row,
      einvoice: parseJson<EinvoiceResult | null>(row.resultJson, null),
    }));

    return Response.json({ einvoices: records });
  } catch (error) {
    console.error("einvoice_history_failed", error);
    return Response.json({ error: "E-invoice history is temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await resolveAppUser(request);

  await ensureTables();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = einvoiceVerificationInputSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Review the highlighted fields", fieldErrors: formatZodErrors(parsed.error) }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const provider = getGstProvider();
    if (!provider.verifyEinvoice) {
      return Response.json({ error: "E-invoice verification is not supported by current provider" }, { status: 501 });
    }

    const result = await provider.verifyEinvoice(input);
    const id = crypto.randomUUID();

    await getDb().insert(einvoiceVerifications).values({
      id,
      userId: user.userId,
      userEmail: user.email,
      irn: result.irn,
      ackNo: result.ackNo,
      ackDate: result.ackDate,
      supplierGstin: result.supplierGstin,
      buyerGstin: result.buyerGstin,
      docNumber: result.docNumber,
      docType: result.docType,
      docDate: result.docDate,
      totalInvoiceValuePaise: paise(result.totalInvoiceValue),
      taxableValuePaise: paise(result.taxableValue),
      status: result.status,
      title: result.title,
      summary: result.summary,
      signedQrVerified: result.signedQrVerified ? 1 : 0,
      provider: result.provider,
      providerReference: result.providerReference,
      resultJson: JSON.stringify(result),
      createdAt: result.checkedAt,
    });

    return Response.json({ einvoice: { id, ...result } }, { status: 201 });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return Response.json({ error: error.message, retryable: true }, { status: 503, headers: { "Retry-After": "20" } });
    }
    console.error("einvoice_verification_failed", error);
    return Response.json({ error: "E-invoice verification could not be completed. Please try again." }, { status: 503 });
  }
}
