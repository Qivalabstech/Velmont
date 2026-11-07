ALTER TYPE "public"."payment_method" ADD VALUE 'UPI';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'VERIFYING';--> statement-breakpoint
CREATE TABLE "gateway_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event" text NOT NULL,
	"order_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "youpi_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "youpi_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "upi_utr" text;