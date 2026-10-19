import type { OrderStatus, PaymentStatus } from "@/db/schema";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  COD_PENDING: "COD · to collect",
  COD_COLLECTED: "COD · collected",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
};

/** The happy path a customer sees on the tracking page. */
export const TRACK_STEPS: OrderStatus[] = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

/** Statuses staff can move an order to from each status. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PLACED: ["CONFIRMED", "PACKED", "SHIPPED", "CANCELLED"],
  CONFIRMED: ["PACKED", "SHIPPED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED", "RETURNED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  RETURNED: [],
};

export type Tone = "neutral" | "info" | "good" | "warn" | "bad";
export const STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: "warn", PLACED: "info", CONFIRMED: "info", PACKED: "info", SHIPPED: "info",
  OUT_FOR_DELIVERY: "info", DELIVERED: "good", CANCELLED: "bad", RETURN_REQUESTED: "warn", RETURNED: "neutral",
};
export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  PENDING: "warn", PAID: "good", FAILED: "bad", COD_PENDING: "warn", COD_COLLECTED: "good",
  REFUNDED: "neutral", PARTIALLY_REFUNDED: "neutral",
};

export const COURIERS: { name: string; url: string }[] = [
  { name: "Delhivery", url: "https://www.delhivery.com/track-v2/package/{awb}" },
  { name: "Blue Dart", url: "https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo={awb}" },
  { name: "DTDC", url: "https://www.dtdc.in/trace.asp?strCnno={awb}" },
  { name: "Ekart", url: "https://ekartlogistics.com/shipmenttrack/{awb}" },
  { name: "Xpressbees", url: "https://www.xpressbees.com/shipment/tracking?awbNo={awb}" },
  { name: "Shiprocket", url: "https://shiprocket.co/tracking/{awb}" },
  { name: "India Post", url: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx" },
  { name: "Other", url: "" },
];
