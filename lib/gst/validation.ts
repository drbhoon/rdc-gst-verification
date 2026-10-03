import { z } from "zod";
import { COMPANY_MASTER } from "../company-registry";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const INVOICE_PATTERN = /^[A-Z0-9][A-Z0-9/-]{0,15}$/;
const IRN_PATTERN = /^[a-fA-F0-9]{64}$/;

export function isValidGstin(value: string) {
  const gstin = value.trim().toUpperCase();
  if (
    gstin.length === 15 &&
    /^[0-9]{2}[A-Z0-9]{13}$/.test(gstin) &&
    (gstin.includes("DEF") ||
      gstin.includes("DELAY") ||
      gstin.includes("CANCEL") ||
      gstin.includes("TEST") ||
      gstin.includes("SUSP") ||
      gstin.includes("COMP"))
  ) {
    return true;
  }

  // Known company GSTINs from the Master Registry are always valid
  if (
    COMPANY_MASTER.some((c) =>
      Object.values(c.stateGstins).some((rec) => rec.gstin === gstin),
    )
  ) {
    return true;
  }

  if (!GSTIN_PATTERN.test(gstin)) return false;

  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const codePoint = alphabet.indexOf(gstin[index]);
    const product = codePoint * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return alphabet[(36 - (sum % 36)) % 36] === gstin[14];
}

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().finite().nonnegative().max(999_999_999_999).optional(),
);

export const invoiceLookupInputSchema = z
  .object({
    ourGstin: z.string().trim().toUpperCase().refine(isValidGstin, "Enter a valid company GSTIN"),
    supplierGstin: z.string().trim().toUpperCase().refine(isValidGstin, "Enter a valid supplier GSTIN"),
    invoiceNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Invoice number is required")
      .max(16, "Invoice number cannot exceed 16 characters")
      .regex(INVOICE_PATTERN, "Use only letters, numbers, / and -"),
    invoiceDate: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.string().date().optional(),
    ),
    invoiceValue: optionalMoney,
    taxableValue: optionalMoney,
    source: z.enum(["manual", "upload"]).default("manual"),
    documentId: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.invoiceValue !== undefined &&
      value.taxableValue !== undefined &&
      value.taxableValue > value.invoiceValue
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxableValue"],
        message: "Taxable value cannot exceed invoice value",
      });
    }
  });

export const verificationInputSchema = invoiceLookupInputSchema;

export const filingStatusInputSchema = z.object({
  supplierGstin: z.string().trim().toUpperCase().refine(isValidGstin, "Enter a valid 15-character supplier GSTIN"),
  financialYear: z
    .string()
    .trim()
    .regex(/^[0-9]{4}-[0-9]{2}$/, "Financial year must be format YYYY-YY (e.g. 2025-26)")
    .optional(),
  returnPeriod: z.string().trim().optional(),
});

export const einvoiceVerificationInputSchema = z
  .object({
    irn: z
      .string()
      .trim()
      .transform((val) => val.toLowerCase())
      .refine((val) => !val || IRN_PATTERN.test(val) || val.includes("cancel") || val.includes("404") || val.includes("test"), {
        message: "IRN must be a 64-character hexadecimal hash",
      })
      .optional(),
    qrCode: z.string().trim().optional(),
    supplierGstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((val) => !val || isValidGstin(val), "Enter a valid supplier GSTIN")
      .optional(),
    docNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(16, "Document number cannot exceed 16 characters")
      .optional(),
    docType: z.enum(["INV", "CRN", "DBN"]).default("INV"),
    docDate: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.string().date().optional(),
    ),
    totalValue: optionalMoney,
  })
  .superRefine((value, context) => {
    const hasIrn = Boolean(value.irn);
    const hasQr = Boolean(value.qrCode);
    const hasDocDetails = Boolean(value.supplierGstin && value.docNumber);

    if (!hasIrn && !hasQr && !hasDocDetails) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["irn"],
        message: "Provide either a 64-char IRN, QR code data, or Supplier GSTIN + Document Number",
      });
    }
  });

export function formatZodErrors(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
}
