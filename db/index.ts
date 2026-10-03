import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS verifications (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    user_email text NOT NULL,
    our_gstin text NOT NULL,
    supplier_gstin text NOT NULL,
    invoice_number text NOT NULL,
    invoice_date text,
    invoice_value_paise integer,
    taxable_value_paise integer,
    status text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    provider text DEFAULT 'mock-gst' NOT NULL,
    provider_reference text NOT NULL,
    reported_json text DEFAULT '{}' NOT NULL,
    mismatch_json text DEFAULT '[]' NOT NULL,
    source text DEFAULT 'manual' NOT NULL,
    document_id text,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_verifications_user_created ON verifications (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_verifications_status_created ON verifications (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_verifications_invoice ON verifications (invoice_number)`,
  `CREATE INDEX IF NOT EXISTS idx_verifications_supplier ON verifications (supplier_gstin)`,

  `CREATE TABLE IF NOT EXISTS uploaded_documents (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    file_name text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    object_key text NOT NULL,
    extraction_json text DEFAULT '{}' NOT NULL,
    ocr_provider text DEFAULT 'mock-ocr' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_user_created ON uploaded_documents (user_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS supplier_filing_checks (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    user_email text NOT NULL,
    supplier_gstin text NOT NULL,
    legal_name text NOT NULL,
    trade_name text NOT NULL,
    gstin_status text NOT NULL,
    compliance_rating text NOT NULL,
    taxpayer_type text NOT NULL,
    filing_frequency text NOT NULL,
    last_filed_period text NOT NULL,
    summary text NOT NULL,
    provider text DEFAULT 'mock-gst-returns' NOT NULL,
    provider_reference text NOT NULL,
    result_json text DEFAULT '{}' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_checks_user_created ON supplier_filing_checks (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_checks_gstin ON supplier_filing_checks (supplier_gstin)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_checks_rating ON supplier_filing_checks (compliance_rating)`,

  `CREATE TABLE IF NOT EXISTS einvoice_verifications (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    user_email text NOT NULL,
    irn text NOT NULL,
    ack_no text,
    ack_date text,
    supplier_gstin text NOT NULL,
    buyer_gstin text NOT NULL,
    doc_number text NOT NULL,
    doc_type text DEFAULT 'INV' NOT NULL,
    doc_date text,
    total_invoice_value_paise integer,
    taxable_value_paise integer,
    status text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    signed_qr_verified integer DEFAULT 1 NOT NULL,
    provider text DEFAULT 'mock-einvoice-irp' NOT NULL,
    provider_reference text NOT NULL,
    result_json text DEFAULT '{}' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_einvoice_user_created ON einvoice_verifications (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_einvoice_irn ON einvoice_verifications (irn)`,
  `CREATE INDEX IF NOT EXISTS idx_einvoice_supplier ON einvoice_verifications (supplier_gstin)`,
  `CREATE INDEX IF NOT EXISTS idx_einvoice_status ON einvoice_verifications (status)`,
];

export async function ensureTables() {
  if (!env.DB) return;
  for (const statement of DDL_STATEMENTS) {
    try {
      await env.DB.prepare(statement).run();
    } catch (err) {
      console.error("DDL execution failed for statement:", statement.slice(0, 40), err);
    }
  }
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
