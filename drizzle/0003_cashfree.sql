ALTER TYPE "public"."payment_method" ADD VALUE 'CASHFREE';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashfree_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashfree_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashfree_order_id_unique" UNIQUE("cashfree_order_id");