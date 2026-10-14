CREATE TABLE "transfer_dismissals" (
	"out_id" uuid NOT NULL,
	"in_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_dismissals_out_id_in_id_pk" PRIMARY KEY("out_id","in_id")
);
--> statement-breakpoint
ALTER TABLE "transfer_dismissals" ADD CONSTRAINT "transfer_dismissals_out_id_transactions_id_fk" FOREIGN KEY ("out_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_dismissals" ADD CONSTRAINT "transfer_dismissals_in_id_transactions_id_fk" FOREIGN KEY ("in_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;