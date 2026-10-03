import { and, desc, eq, like, type SQL } from "drizzle-orm";

import { ensureTables, getDb } from "@/db";
import { supplierFilingChecks } from "@/db/schema";
import { getAdminEmails, getRole, resolveAppUser } from "@/lib/auth";
import { getGstProvider, ProviderUnavailableError } from "@/lib/gst/provider-factory";
import type { FilingStatus } from "@/lib/gst/types";
import { filingStatusInputSchema, formatZodErrors } from "@/lib/gst/validation";

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
    const rating = url.searchParams.get("rating")?.trim();

    const conditions: SQL[] = [];
    if (role !== "Admin") {
      conditions.push(eq(supplierFilingChecks.userId, user.userId));
    }
    if (rating && rating !== "ALL") conditions.push(eq(supplierFilingChecks.complianceRating, rating));
    if (search) {
      conditions.push(like(supplierFilingChecks.supplierGstin, `%${search}%`));
    }

    const rows = await getDb()
      .select()
      .from(supplierFilingChecks)
      .where(and(...conditions))
      .orderBy(desc(supplierFilingChecks.createdAt))
      .limit(100);

    const checks = rows.map((row) => ({
      ...row,
      filingStatus: parseJson<FilingStatus | null>(row.resultJson, null),
    }));

    return Response.json({ checks });
  } catch (error) {
    console.error("supplier_filing_history_failed", error);
    return Response.json({ error: "Filing status history is temporarily unavailable" }, { status: 503 });
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

  const parsed = filingStatusInputSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Review the highlighted fields", fieldErrors: formatZodErrors(parsed.error) }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const filingStatus = await getGstProvider().getSupplierFilingStatus(input);
    const id = crypto.randomUUID();

    await getDb().insert(supplierFilingChecks).values({
      id,
      userId: user.userId,
      userEmail: user.email,
      supplierGstin: input.supplierGstin,
      legalName: filingStatus.legalName,
      tradeName: filingStatus.tradeName,
      gstinStatus: filingStatus.gstinStatus,
      complianceRating: filingStatus.complianceRating,
      taxpayerType: filingStatus.taxpayerType,
      filingFrequency: filingStatus.filingFrequency,
      lastFiledPeriod: filingStatus.lastFiledPeriod,
      summary: filingStatus.summary,
      provider: filingStatus.provider,
      providerReference: filingStatus.providerReference,
      resultJson: JSON.stringify(filingStatus),
      createdAt: filingStatus.checkedAt,
    });

    return Response.json({ check: { id, ...filingStatus } }, { status: 201 });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return Response.json({ error: error.message, retryable: true }, { status: 503, headers: { "Retry-After": "20" } });
    }
    console.error("supplier_filing_check_failed", error);
    return Response.json({ error: "Could not retrieve supplier return status. Please try again." }, { status: 503 });
  }
}
