import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    userEmail: text("user_email").notNull(),
    ourGstin: text("our_gstin").notNull(),
    supplierGstin: text("supplier_gstin").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: text("invoice_date"),
    invoiceValuePaise: integer("invoice_value_paise"),
    taxableValuePaise: integer("taxable_value_paise"),
    status: text("status").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    provider: text("provider").notNull().default("mock-gst"),
    providerReference: text("provider_reference").notNull(),
    reportedJson: text("reported_json").notNull().default("{}"),
    mismatchJson: text("mismatch_json").notNull().default("[]"),
    source: text("source").notNull().default("manual"),
    documentId: text("document_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_verifications_user_created").on(table.userId, table.createdAt),
    index("idx_verifications_status_created").on(table.status, table.createdAt),
    index("idx_verifications_invoice").on(table.invoiceNumber),
    index("idx_verifications_supplier").on(table.supplierGstin),
  ],
);

export const uploadedDocuments = sqliteTable(
  "uploaded_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectKey: text("object_key").notNull(),
    extractionJson: text("extraction_json").notNull().default("{}"),
    ocrProvider: text("ocr_provider").notNull().default("mock-ocr"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_documents_user_created").on(table.userId, table.createdAt)],
);

export const supplierFilingChecks = sqliteTable(
  "supplier_filing_checks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    userEmail: text("user_email").notNull(),
    supplierGstin: text("supplier_gstin").notNull(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name").notNull(),
    gstinStatus: text("gstin_status").notNull(),
    complianceRating: text("compliance_rating").notNull(),
    taxpayerType: text("taxpayer_type").notNull(),
    filingFrequency: text("filing_frequency").notNull(),
    lastFiledPeriod: text("last_filed_period").notNull(),
    summary: text("summary").notNull(),
    provider: text("provider").notNull().default("mock-gst-returns"),
    providerReference: text("provider_reference").notNull(),
    resultJson: text("result_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_supplier_checks_user_created").on(table.userId, table.createdAt),
    index("idx_supplier_checks_gstin").on(table.supplierGstin),
    index("idx_supplier_checks_rating").on(table.complianceRating),
  ],
);

export const einvoiceVerifications = sqliteTable(
  "einvoice_verifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    userEmail: text("user_email").notNull(),
    irn: text("irn").notNull(),
    ackNo: text("ack_no"),
    ackDate: text("ack_date"),
    supplierGstin: text("supplier_gstin").notNull(),
    buyerGstin: text("buyer_gstin").notNull(),
    docNumber: text("doc_number").notNull(),
    docType: text("doc_type").notNull().default("INV"),
    docDate: text("doc_date"),
    totalInvoiceValuePaise: integer("total_invoice_value_paise"),
    taxableValuePaise: integer("taxable_value_paise"),
    status: text("status").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    signedQrVerified: integer("signed_qr_verified").notNull().default(1),
    provider: text("provider").notNull().default("mock-einvoice-irp"),
    providerReference: text("provider_reference").notNull(),
    resultJson: text("result_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_einvoice_user_created").on(table.userId, table.createdAt),
    index("idx_einvoice_irn").on(table.irn),
    index("idx_einvoice_supplier").on(table.supplierGstin),
    index("idx_einvoice_status").on(table.status),
  ],
);
