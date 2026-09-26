import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBDT } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/order-status";

/** Convert a number to English words (for amount-in-words on invoices). */
export function numberToWords(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function chunk(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100)
      return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + chunk(num % 100) : "");
  }

  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(chunk(crore) + " Crore");
  if (lakh) parts.push(chunk(lakh) + " Lakh");
  if (thousand) parts.push(chunk(thousand) + " Thousand");
  if (rest) parts.push(chunk(rest));
  return parts.join(" ");
}

export async function getInvoiceData(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, items: true },
  });
  if (!order) return null;
  const settings = await getSettings();
  return { order, settings, words: numberToWords(order.total / 100) };
}

export function invoiceMeta(orderNumber: string, invoiceNumber: string | null) {
  return {
    orderNumber,
    invoiceNumber: invoiceNumber ?? orderNumber,
  };
}

export { formatBDT, STATUS_LABELS };
