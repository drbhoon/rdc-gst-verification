import { and, desc, eq, like, or, type SQL } from "drizzle-orm";

import { ensureTables, getDb } from "@/db";
import { uploadedDocuments, verifications } from "@/db/schema";
import { getAdminEmails, getRole, resolveAppUser } from "@/lib/auth";
import { getGstProvider, ProviderUnavailableError } from "@/lib/gst/provider-factory";
import type { InvoiceLookupInput } from "@/lib/gst/types";
import { formatZodErrors, invoiceLookupInputSchema } from "@/lib/gst/validation";

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

function serialize(row: typeof verifications.$inferSelect) {
  return {
    ...row,
    invoiceValue: row.invoiceValuePaise === null ? undefined : row.invoiceValuePaise / 100,
    taxableValue: row.taxableValuePaise === null ? undefined : row.taxableValuePaise / 100,
    reported: parseJson(row.reportedJson, {}),
    mismatches: parseJson(row.mismatchJson, []),
  };
}

export async function GET(request: Request) {
  const user = await resolveAppUser(request);
  const role = getRole(user);

  await ensureTables();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim();
    const search = url.searchParams.get("search")?.trim().toUpperCase();
    const conditions: SQL[] = [];
    if (role !== "Admin") {
      conditions.push(eq(verifications.userId, user.userId));
    }
    if (status && status !== "ALL") conditions.push(eq(verifications.status, status));
    if (search) {
      const predicate = or(
        like(verifications.invoiceNumber, `%${search}%`),
        like(verifications.supplierGstin, `%${search}%`),
        like(verifications.ourGstin, `%${search}%`),
      );
      if (predicate) conditions.push(predicate);
    }

    const rows = await getDb()
      .select()
      .from(verifications)
      .where(and(...conditions))
      .orderBy(desc(verifications.createdAt))
      .limit(100);
    return Response.json({ verifications: rows.map(serialize) });
  } catch (error) {
    console.error("history_load_failed", error);
    return Response.json({ error: "Verification history is temporarily unavailable" }, { status: 503 });
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

  const parsed = invoiceLookupInputSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Review the highlighted fields", fieldErrors: formatZodErrors(parsed.error) }, { status: 400 });
  }

  try {
    const input: InvoiceLookupInput = { ...parsed.data };

    // Cross-reference against scanned document extraction if uploaded
    if (input.documentId) {
      try {
        const docRows = await getDb()
          .select()
          .from(uploadedDocuments)
          .where(eq(uploadedDocuments.id, input.documentId))
          .limit(1);
        if (docRows.length && docRows[0].extractionJson) {
          const raw = JSON.parse(docRows[0].extractionJson) as Record<string, { value?: string | number }>;
          input.docExtraction = {
            invoiceNumber: raw.invoiceNumber?.value !== undefined ? String(raw.invoiceNumber.value) : undefined,
            invoiceDate: raw.invoiceDate?.value !== undefined ? String(raw.invoiceDate.value) : undefined,
            taxableValue: raw.taxableValue?.value !== undefined ? Number(raw.taxableValue.value) : undefined,
            invoiceValue: raw.invoiceValue?.value !== undefined ? Number(raw.invoiceValue.value) : undefined,
            supplierGstin: raw.supplierGstin?.value !== undefined ? String(raw.supplierGstin.value) : undefined,
            ourGstin: raw.ourGstin?.value !== undefined ? String(raw.ourGstin.value) : undefined,
          };
        }
      } catch (docErr) {
        console.warn("Could not retrieve document extraction:", docErr);
      }
    }

    const result = await getGstProvider().verifyInvoice(input);
    const id = crypto.randomUUID();
    await getDb().insert(verifications).values({
      id,
      userId: user.userId,
      userEmail: user.email,
      ourGstin: input.ourGstin,
      supplierGstin: input.supplierGstin,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate ?? null,
      invoiceValuePaise: paise(input.invoiceValue),
      taxableValuePaise: paise(input.taxableValue),
      status: result.status,
      title: result.title,
      summary: result.summary,
      provider: result.provider,
      providerReference: result.providerReference,
      reportedJson: JSON.stringify(result.reported),
      mismatchJson: JSON.stringify(result.mismatches),
      source: input.source,
      documentId: input.documentId ?? null,
      createdAt: result.checkedAt,
    });
    return Response.json({ verification: { id, ...input, ...result } }, { status: 201 });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return Response.json({ error: error.message, retryable: true }, { status: 503, headers: { "Retry-After": "20" } });
    }
    console.error("verification_failed", error);
    return Response.json({ error: "We could not complete this check. Your invoice has not been marked invalid.", retryable: true }, { status: 503 });
  }
}
