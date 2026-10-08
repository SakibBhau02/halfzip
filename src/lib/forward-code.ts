/**
 * Pretty forwarding code for a supplier forward.
 * Derived from the order number so it stays traceable:
 *   MZ-20260926-0001  →  MZF-20260926-0001
 * (Old HZ- orders keep working and map to HZF-.)
 * Falls back to a random code when the order number has an unexpected shape.
 */
export function forwardCodeFor(orderNumber: string): string {
  const m = /^(MZ|HZ)-(.+)$/.exec(orderNumber.trim());
  if (m) return `${m[1]}F-${m[2]}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MZF-${rand}`;
}
