import { Prisma } from "@prisma/client";

/** Format BDT minor units (poisha) as "৳880" or "৳880.50" */
export function formatBDT(minor: number): string {
  const value = minor / 100;
  return (
    "৳" +
    value.toLocaleString("en-BD", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Format a Date as e.g. "26 Sep, 3:45 PM" */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Generate a human-friendly order number: HZ-20260926-0001 */
export function nextOrderNumber(seq: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `HZ-${ymd}-${String(seq).padStart(4, "0")}`;
}

export { Prisma };
