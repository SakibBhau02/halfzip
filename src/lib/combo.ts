export type ComboTier = 1 | 2 | 3;

export type ComboProductConfig = {
  basePrice: number;
  combo2Price: number;
  combo3Price: number;
  freeDeliveryAt: number;
  insideFee: number;
  outsideFee: number;
};

export type ComboLineInput = {
  quantity: number; // 1, 2 or 3
};

/**
 * Compute the goods subtotal for a combo tier.
 * - 1 pc → basePrice × 1
 * - 2 pc → combo2Price
 * - 3 pc → combo3Price
 * Falls back to basePrice × qty for qty > 3.
 */
export function comboSubtotal(config: ComboProductConfig, qty: number): number {
  if (qty <= 1) return config.basePrice;
  if (qty === 2) return config.combo2Price;
  if (qty === 3) return config.combo3Price;
  return config.basePrice * qty;
}

/** Delivery fee — free when quantity reaches freeDeliveryAt. */
export function comboDelivery(
  config: ComboProductConfig,
  qty: number,
  zone: "inside" | "outside"
): number {
  if (qty >= config.freeDeliveryAt) return 0;
  return zone === "inside" ? config.insideFee : config.outsideFee;
}

/** Total savings vs. buying each piece separately. */
export function comboSavings(config: ComboProductConfig, qty: number): number {
  const full = config.basePrice * qty;
  return Math.max(0, full - comboSubtotal(config, qty));
}

export function comboLabel(qty: number): string {
  if (qty === 1) return "Single";
  if (qty === 2) return "Duo Combo";
  if (qty === 3) return "Trio Combo";
  return `${qty}pcs`;
}
