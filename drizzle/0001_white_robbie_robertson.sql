CREATE TABLE `einvoice_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`irn` text NOT NULL,
	`ack_no` text,
	`ack_date` text,
	`supplier_gstin` text NOT NULL,
	`buyer_gstin` text NOT NULL,
	`doc_number` text NOT NULL,
	`doc_type` text DEFAULT 'INV' NOT NULL,
	`doc_date` text,
	`total_invoice_value_paise` integer,
	`taxable_value_paise` integer,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`signed_qr_verified` integer DEFAULT 1 NOT NULL,
	`provider` text DEFAULT 'mock-einvoice-irp' NOT NULL,
	`provider_reference` text NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_einvoice_user_created` ON `einvoice_verifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_einvoice_irn` ON `einvoice_verifications` (`irn`);--> statement-breakpoint
CREATE INDEX `idx_einvoice_supplier` ON `einvoice_verifications` (`supplier_gstin`);--> statement-breakpoint
CREATE INDEX `idx_einvoice_status` ON `einvoice_verifications` (`status`);--> statement-breakpoint
CREATE TABLE `supplier_filing_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`supplier_gstin` text NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text NOT NULL,
	`gstin_status` text NOT NULL,
	`compliance_rating` text NOT NULL,
	`taxpayer_type` text NOT NULL,
	`filing_frequency` text NOT NULL,
	`last_filed_period` text NOT NULL,
	`summary` text NOT NULL,
	`provider` text DEFAULT 'mock-gst-returns' NOT NULL,
	`provider_reference` text NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_supplier_checks_user_created` ON `supplier_filing_checks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_supplier_checks_gstin` ON `supplier_filing_checks` (`supplier_gstin`);--> statement-breakpoint
CREATE INDEX `idx_supplier_checks_rating` ON `supplier_filing_checks` (`compliance_rating`);