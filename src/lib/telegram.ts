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
