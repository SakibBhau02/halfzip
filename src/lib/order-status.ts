import type { OrderStatus } from "@prisma/client";

/**
 * Allowed status transitions for a COD order.
 * Every mutation MUST go through `assertTransition` and write an OrderStatusLog.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export const STATUS_STYLES: Record<OrderStatus, string> = {
  NEW: "bg-blue-100 text-blue-700 ring-blue-200",
  CONFIRMED: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  PROCESSING: "bg-amber-100 text-amber-800 ring-amber-200",
  SHIPPED: "bg-purple-100 text-purple-700 ring-purple-200",
  DELIVERED: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  RETURNED: "bg-orange-100 text-orange-700 ring-orange-200",
  CANCELLED: "bg-rose-100 text-rose-700 ring-rose-200",
};

export const ALL_STATUSES: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];
