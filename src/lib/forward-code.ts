/**
 * Pretty forwarding code for a supplier forward.
 * Derived from the order number so it stays traceable:
 *   HZ-20260926-0001  →  HZF-20260926-0001
 * Falls back to a random code when the order number has an unexpected shape.
 */
export function forwardCodeFor(orderNumber: string): string {
  const m = /^HZ-(.+)$/.exec(orderNumber.trim());
  if (m) return `HZF-${m[1]}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HZF-${rand}`;
}
