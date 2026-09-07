CREATE TYPE "public"."calculation_base" AS ENUM('purchasePrice', 'propertyValue', 'loanAmount', 'deposit', 'dutiableValue');--> statement-breakpoint
CREATE TYPE "public"."cost_calculation_type" AS ENUM('fixed', 'percentage', 'formula', 'bracketed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."cost_scope" AS ENUM('upfront', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('principalAndInterest', 'interestOnly');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('existing', 'planned', 'sold');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('house', 'apartment', 'townhouse', 'land', 'commercial', 'other');--> statement-breakpoint
CREATE TYPE "public"."property_use" AS ENUM('ownerOccupied', 'investment', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'fortnightly', 'monthly', 'quarterly', 'halfYearly', 'annual', 'custom');--> statement-breakpoint
CREATE TABLE "cost_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "cost_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"scope" "cost_scope" DEFAULT 'upfront' NOT NULL,
	"calculation_type" "cost_calculation_type" DEFAULT 'fixed' NOT NULL,
	"default_value" bigint,
	"percentage" double precision,
	"calculation_base" "calculation_base",
	"formula" text,
	"rate_schedule_group" text,
	"default_frequency" "recurrence_frequency",
	"currency" text,
	"notes" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"region" text,
	"currency" text NOT NULL,
	"transfer_tax_label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jurisdictions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"jurisdiction_key" text,
	"country" text NOT NULL,
	"region" text,
	"currency" text NOT NULL,
	"type" "property_type" DEFAULT 'house' NOT NULL,
	"intended_use" "property_use" DEFAULT 'ownerOccupied' NOT NULL,
	"status" "property_status" DEFAULT 'planned' NOT NULL,
	"purchase_price" bigint DEFAULT 0 NOT NULL,
	"estimated_market_value" bigint,
	"current_value" bigint,
	"original_purchase_price" bigint,
	"ownership_share" double precision DEFAULT 1 NOT NULL,
	"purchase_date" date,
	"sale_date" date,
	"sale_price" bigint,
	"notes" text,
	"completed_at" timestamp with time zone,
	"rate_schedule_snapshot" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_available_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"label" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"account_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"cost_type_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"manual_value" bigint,
	"override_value" bigint,
	"actual_value" bigint,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text,
	"loan_amount" bigint DEFAULT 0 NOT NULL,
	"annual_rate" double precision DEFAULT 0 NOT NULL,
	"term_years" integer DEFAULT 30 NOT NULL,
	"loan_type" "loan_type" DEFAULT 'principalAndInterest' NOT NULL,
	"offset_balance" bigint DEFAULT 0 NOT NULL,
	"other_financing_costs" bigint DEFAULT 0 NOT NULL,
	"account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_recurring_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"cost_type_id" uuid,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"frequency" "recurrence_frequency" DEFAULT 'monthly' NOT NULL,
	"custom_per_year" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"rent" bigint DEFAULT 0 NOT NULL,
	"rent_frequency" "recurrence_frequency" DEFAULT 'weekly' NOT NULL,
	"rent_custom_per_year" integer,
	"vacancy_rate" double precision DEFAULT 0 NOT NULL,
	"management_rate" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"jurisdiction_key" text NOT NULL,
	"group_key" text NOT NULL,
	"currency" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"version" integer DEFAULT 1 NOT NULL,
	"brackets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_schedules_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_jurisdiction_key_jurisdictions_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."jurisdictions"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_available_funds" ADD CONSTRAINT "property_available_funds_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_available_funds" ADD CONSTRAINT "property_available_funds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_costs" ADD CONSTRAINT "property_costs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_costs" ADD CONSTRAINT "property_costs_cost_type_id_cost_types_id_fk" FOREIGN KEY ("cost_type_id") REFERENCES "public"."cost_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_loans" ADD CONSTRAINT "property_loans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_loans" ADD CONSTRAINT "property_loans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_recurring_costs" ADD CONSTRAINT "property_recurring_costs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_recurring_costs" ADD CONSTRAINT "property_recurring_costs_cost_type_id_cost_types_id_fk" FOREIGN KEY ("cost_type_id") REFERENCES "public"."cost_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rentals" ADD CONSTRAINT "property_rentals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_scenarios" ADD CONSTRAINT "property_scenarios_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_schedules" ADD CONSTRAINT "rate_schedules_jurisdiction_key_jurisdictions_key_fk" FOREIGN KEY ("jurisdiction_key") REFERENCES "public"."jurisdictions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_types_scope_idx" ON "cost_types" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "cost_types_category_idx" ON "cost_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "jurisdictions_country_idx" ON "jurisdictions" USING btree ("country");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_jurisdiction_idx" ON "properties" USING btree ("jurisdiction_key");--> statement-breakpoint
CREATE INDEX "property_available_funds_property_idx" ON "property_available_funds" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_available_funds_account_idx" ON "property_available_funds" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_costs_property_type_idx" ON "property_costs" USING btree ("property_id","cost_type_id");--> statement-breakpoint
CREATE INDEX "property_costs_property_idx" ON "property_costs" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_loans_property_idx" ON "property_loans" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_recurring_costs_property_idx" ON "property_recurring_costs" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_rentals_property_idx" ON "property_rentals" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_scenarios_property_idx" ON "property_scenarios" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "rate_schedules_jurisdiction_idx" ON "rate_schedules" USING btree ("jurisdiction_key");--> statement-breakpoint
CREATE INDEX "rate_schedules_lookup_idx" ON "rate_schedules" USING btree ("jurisdiction_key","group_key","effective_from");