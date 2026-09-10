ALTER TABLE "property_available_funds" DROP CONSTRAINT "property_available_funds_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "property_loans" DROP CONSTRAINT "property_loans_account_id_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "property_available_funds_account_idx";--> statement-breakpoint
ALTER TABLE "property_available_funds" DROP COLUMN "account_id";--> statement-breakpoint
ALTER TABLE "property_loans" DROP COLUMN "account_id";