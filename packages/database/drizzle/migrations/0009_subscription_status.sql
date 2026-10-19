CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
ALTER TABLE "financial_subscriptions" ADD COLUMN "status" "subscription_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_subscriptions" ADD COLUMN "paused_until" date;--> statement-breakpoint
ALTER TABLE "financial_subscriptions" ADD COLUMN "end_date" date;--> statement-breakpoint
-- The old flag had no UI, but carry it over: inactive means it ended when last edited.
UPDATE "financial_subscriptions" SET "status" = 'cancelled', "end_date" = "updated_at"::date WHERE "active" = false;
