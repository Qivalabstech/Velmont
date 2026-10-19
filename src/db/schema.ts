// VELMONT store database. All money values are stored in paise (₹1 = 100).
import { relations, sql } from "drizzle-orm";
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, jsonb, index, uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";
import { randomBytes } from "crypto";

export const newId = () => randomBytes(12).toString("base64url");
const id = () => text("id").primaryKey().$defaultFn(newId);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

// ---------- Enums ----------
export const userKind = pgEnum("user_kind", ["CUSTOMER", "STAFF"]);
export const sessionKind = pgEnum("session_kind", ["CUSTOMER", "ADMIN"]);
export const productStatus = pgEnum("product_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);
export const couponType = pgEnum("coupon_type", ["PERCENT", "FIXED", "FREE_SHIPPING"]);
export const orderStatus = pgEnum("order_status", [
  "PENDING_PAYMENT", "PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY",
  "DELIVERED", "CANCELLED", "RETURN_REQUESTED", "RETURNED",
]);
export const paymentStatus = pgEnum("payment_status", [
  "PENDING", "PAID", "FAILED", "COD_PENDING", "COD_COLLECTED", "REFUNDED", "PARTIALLY_REFUNDED",
]);
export const paymentMethod = pgEnum("payment_method", ["RAZORPAY", "COD"]);
export const reviewStatus = pgEnum("review_status", ["PENDING", "APPROVED", "REJECTED"]);

export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];

// ---------- People ----------
export const roles = pgTable("roles", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
  system: boolean("system").notNull().default(false),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  kind: userKind("kind").notNull().default("CUSTOMER"),
  isOwner: boolean("is_owner").notNull().default(false),
  roleId: text("role_id").references(() => roles.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  createdAt: createdAt(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (t) => [index("users_kind_idx").on(t.kind)]);

export const sessions = pgTable("sessions", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: sessionKind("kind").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  ip: text("ip"),
  userAgent: text("user_agent"),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const passwordResets = pgTable("password_resets", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const addresses = pgTable("addresses", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2").notNull().default(""),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});

// ---------- Catalogue ----------
export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable("products", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  mrp: integer("mrp").notNull(),
  status: productStatus("status").notNull().default("DRAFT"),
  featured: boolean("featured").notNull().default(false),
  badge: text("badge"),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  leather: text("leather").notNull().default(""),
  buckle: text("buckle").notNull().default(""),
  width: text("width").notNull().default("1.5 in (38 mm)"),
  care: text("care").notNull().default(""),
  colors: text("colors").array().notNull().default(sql`'{}'::text[]`),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  hsn: text("hsn").notNull().default("4203"),
  gstRate: integer("gst_rate"),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("products_status_idx").on(t.status)]);

export const productImages = pgTable("product_images", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const variants = pgTable("variants", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  size: text("size").notNull(),
  sku: text("sku").notNull().unique(),
  stock: integer("stock").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (t) => [uniqueIndex("variants_product_size").on(t.productId, t.size)]);

// ---------- Cart ----------
export const carts = pgTable("carts", {
  id: id(),
  token: text("token").notNull().unique(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email"),
  couponCode: text("coupon_code"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItems = pgTable("cart_items", {
  id: id(),
  cartId: text("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  qty: integer("qty").notNull().default(1),
}, (t) => [uniqueIndex("cart_items_cart_variant").on(t.cartId, t.variantId)]);

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  type: couponType("type").notNull(),
  value: integer("value").notNull().default(0),
  minSubtotal: integer("min_subtotal").notNull().default(0),
  maxDiscount: integer("max_discount"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  usageLimit: integer("usage_limit"),
  perCustomerLimit: integer("per_customer_limit"),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// ---------- Orders ----------
export type ShippingAddress = {
  name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string;
};

export const orders = pgTable("orders", {
  id: id(),
  number: text("number").notNull().unique(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  status: orderStatus("status").notNull().default("PENDING_PAYMENT"),
  paymentStatus: paymentStatus("payment_status").notNull().default("PENDING"),
  paymentMethod: paymentMethod("payment_method").notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  shipping: integer("shipping").notNull().default(0),
  codFee: integer("cod_fee").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull(),
  refunded: integer("refunded").notNull().default(0),
  couponCode: text("coupon_code"),
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>().notNull(),
  customerNote: text("customer_note").notNull().default(""),
  internalNote: text("internal_note").notNull().default(""),
  razorpayOrderId: text("razorpay_order_id").unique(),
  razorpayPaymentId: text("razorpay_payment_id"),
  courier: text("courier"),
  awb: text("awb"),
  trackingUrl: text("tracking_url"),
  stockReleased: boolean("stock_released").notNull().default(false),
  createdAt: createdAt(),
  placedAt: timestamp("placed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  updatedAt: updatedAt(),
}, (t) => [
  index("orders_status_idx").on(t.status),
  index("orders_created_idx").on(t.createdAt),
  index("orders_email_idx").on(t.email),
]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id"),
  variantId: text("variant_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().default(""),
  size: text("size").notNull(),
  sku: text("sku").notNull(),
  image: text("image").notNull().default(""),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
  total: integer("total").notNull(),
  hsn: text("hsn").notNull().default("4203"),
  gstRate: integer("gst_rate").notNull().default(18),
});

export const orderEvents = pgTable("order_events", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: orderStatus("status"),
  message: text("message").notNull(),
  visibleToCustomer: boolean("visible_to_customer").notNull().default(true),
  actorName: text("actor_name").notNull().default("System"),
  createdAt: createdAt(),
}, (t) => [index("order_events_order_idx").on(t.orderId)]);

export const refunds = pgTable("refunds", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull().default(""),
  razorpayRefundId: text("razorpay_refund_id"),
  status: text("status").notNull().default("processed"),
  actorName: text("actor_name").notNull(),
  createdAt: createdAt(),
});

// ---------- Engagement ----------
export const reviews = pgTable("reviews", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull(),
  status: reviewStatus("status").notNull().default("PENDING"),
  verified: boolean("verified").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("reviews_product_status_idx").on(t.productId, t.status)]);

export const wishlistItems = pgTable("wishlist_items", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

export const subscribers = pgTable("subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

export const contactMessages = pgTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  orderRef: text("order_ref").notNull().default(""),
  message: text("message").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: createdAt(),
});

// ---------- Content & SEO ----------
export const pages = pgTable("pages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  published: boolean("published").notNull().default(true),
  updatedAt: updatedAt(),
});

export const faqs = pgTable("faqs", {
  id: id(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
});

export const redirects = pgTable("redirects", {
  id: id(),
  from: text("from_path").notNull().unique(),
  to: text("to_path").notNull(),
  permanent: boolean("permanent").notNull().default(true),
  hits: integer("hits").notNull().default(0),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ---------- Operations ----------
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorId: text("actor_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  ip: text("ip"),
  createdAt: createdAt(),
}, (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entity)]);

export const emailLogs = pgTable("email_logs", {
  id: id(),
  to: text("to_addr").notNull(),
  subject: text("subject").notNull(),
  template: text("template").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: createdAt(),
}, (t) => [index("email_created_idx").on(t.createdAt)]);

export const visits = pgTable("visits", {
  id: id(),
  path: text("path").notNull(),
  referrer: text("referrer").notNull().default(""),
  visitor: text("visitor").notNull(),
  device: text("device").notNull().default("desktop"),
  createdAt: createdAt(),
}, (t) => [index("visits_created_idx").on(t.createdAt)]);

export const uptimeChecks = pgTable("uptime_checks", {
  id: id(),
  ok: boolean("ok").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  dbMs: integer("db_ms").notNull(),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("uptime_created_idx").on(t.createdAt)]);

export const errorLogs = pgTable("error_logs", {
  id: id(),
  source: text("source").notNull(),
  message: text("message").notNull(),
  path: text("path").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("error_created_idx").on(t.createdAt)]);

export const healthRuns = pgTable("health_runs", {
  id: id(),
  kind: text("kind").notNull(),
  trigger: text("trigger").notNull().default("manual"),
  score: integer("score").notNull(),
  result: jsonb("result").notNull(),
  durationMs: integer("duration_ms").notNull(),
  createdAt: createdAt(),
}, (t) => [index("health_kind_created_idx").on(t.kind, t.createdAt)]);

// ---------- Relations ----------
export const rolesRelations = relations(roles, ({ many }) => ({ users: many(users) }));
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  addresses: many(addresses),
  orders: many(orders),
  sessions: many(sessions),
  wishlist: many(wishlistItems),
  reviews: many(reviews),
}));
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(variants),
  reviews: many(reviews),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
}));
export const cartsRelations = relations(carts, ({ many, one }) => ({
  items: many(cartItems),
  user: one(users, { fields: [carts.userId], references: [users.id] }),
}));
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(variants, { fields: [cartItems.variantId], references: [variants.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  events: many(orderEvents),
  refunds: many(refunds),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));
export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
}));
export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));
export const wishlistRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, { fields: [wishlistItems.userId], references: [users.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));
