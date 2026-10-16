CREATE TYPE "public"."budget_bucket_type" AS ENUM('essentials', 'lifestyle', 'savings', 'investing', 'debt');--> statement-breakpoint
CREATE TABLE "budget_bucket_categories" (
	"category_id" uuid PRIMARY KEY NOT NULL,
	"bucket_type" "budget_bucket_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_buckets" (
	"type" "budget_bucket_type" PRIMARY KEY NOT NULL,
	"label" text,
	"share_bps" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_bucket_categories" ADD CONSTRAINT "budget_bucket_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_bucket_categories" ADD CONSTRAINT "budget_bucket_categories_bucket_type_budget_buckets_type_fk" FOREIGN KEY ("bucket_type") REFERENCES "public"."budget_buckets"("type") ON DELETE cascade ON UPDATE no action;