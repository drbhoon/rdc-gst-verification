CREATE TABLE `uploaded_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`extraction_json` text DEFAULT '{}' NOT NULL,
	`ocr_provider` text DEFAULT 'mock-ocr' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_user_created` ON `uploaded_documents` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`our_gstin` text NOT NULL,
	`supplier_gstin` text NOT NULL,
	`invoice_number` text NOT NULL,
	`invoice_date` text,
	`invoice_value_paise` integer,
	`taxable_value_paise` integer,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`provider` text DEFAULT 'mock-gst' NOT NULL,
	`provider_reference` text NOT NULL,
	`reported_json` text DEFAULT '{}' NOT NULL,
	`mismatch_json` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`document_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verifications_user_created` ON `verifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_verifications_status_created` ON `verifications` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_verifications_invoice` ON `verifications` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_verifications_supplier` ON `verifications` (`supplier_gstin`);