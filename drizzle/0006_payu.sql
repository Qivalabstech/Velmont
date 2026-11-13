ALTER TYPE "public"."payment_method" ADD VALUE 'PAYU';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payu_txn_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payu_payment_id" text;