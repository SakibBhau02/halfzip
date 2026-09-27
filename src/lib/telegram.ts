import { getSettings } from "@/lib/settings";

/**
 * Send a message to the configured Telegram chat.
 * Silently no-ops if Telegram is not configured/enabled.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  try {
    const s = await getSettings();
    if (s.telegram_enabled !== "true") return false;
    if (!s.telegram_bot_token || !s.telegram_chat_id) return false;

    const res = await fetch(
      `https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: s.telegram_chat_id,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type OrderNotification = {
  orderNumber: string;
  name: string;
  phone: string;
  address: string;
  district?: string | null;
  color: string;
  size: string;
  quantity: number;
  total: string;
  delivery: string;
  source: "website" | "manual";
};

export function formatOrderTelegram(n: OrderNotification): string {
  const badge = n.source === "manual" ? "🖐️ <b>Manual</b>" : "🌐 <b>Website</b>";
  return [
    `🛍️ <b>New Order — ${n.orderNumber}</b>  ${badge}`,
    "",
    `👤 <b>${n.name}</b>`,
    `📞 ${n.phone}`,
    `📍 ${n.address}${n.district ? ", " + n.district : ""}`,
    "",
    `👕 ${n.color} / ${n.size}  ×${n.quantity}`,
    `💰 <b>${n.total}</b>  (delivery ${n.delivery})`,
    `💵 Cash on Delivery`,
  ].join("\n");
}

/* ------------------------- supplier notifications ------------------------ */

/**
 * Send a Telegram message to a SPECIFIC chat (e.g. a supplier).
 * Uses the bot token from Settings. Returns false (never throws) when
 * Telegram isn't configured or the chat ID is missing.
 */
export async function sendTelegramTo(
  chatId: string | null | undefined,
  text: string
): Promise<boolean> {
  try {
    if (!chatId?.trim()) return false;
    const s = await getSettings();
    if (s.telegram_enabled !== "true") return false;
    if (!s.telegram_bot_token) return false;

    const res = await fetch(
      `https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type ForwardNotification = {
  forwardCode: string;
  orderNumber: string;
  items: string;
  pcs: number;
  customerTotal: string;
  supplierCost: string;
  shipName: string;
  shipPhone: string;
  shipAddress: string;
};

/** "New forward" notification for the supplier. */
export function formatForwardTelegram(n: ForwardNotification): string {
  return [
    `📦 <b>New Order Forwarded — ${n.forwardCode}</b>`,
    "",
    `🧾 Order: <b>${n.orderNumber}</b>`,
    `👕 ${n.items} (${n.pcs} pcs)`,
    `💰 Customer pays: <b>${n.customerTotal}</b> (COD)`,
    `🏷️ Your cost: ${n.supplierCost}`,
    "",
    `👤 <b>${n.shipName}</b>`,
    `📞 ${n.shipPhone}`,
    `📍 ${n.shipAddress}`,
    "",
    `Supplier panel থেকে Accept করে courier করুন।`,
  ].join("\n");
}

export type WithdrawalRequestNotification = {
  amount: string;
  method: string;
  note?: string | null;
};

/** "Reseller wants money" notification for the supplier. */
export function formatWithdrawalRequestTelegram(
  n: WithdrawalRequestNotification
): string {
  return [
    `💸 <b>Payment Request</b>`,
    "",
    `Reseller আপনার কাছে <b>${n.amount}</b> চাচ্ছে (${n.method})।`,
    n.note ? `📝 ${n.note}` : "",
    ``,
    `Transfer করে Supplier panel → Earnings থেকে confirm করুন।`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
