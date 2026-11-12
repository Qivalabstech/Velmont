ALTER TABLE "orders" ADD COLUMN "shiprocket_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shiprocket_shipment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_label_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_scheduled_for" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_error" text;