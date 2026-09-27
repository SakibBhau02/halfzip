/**
 * Server-side conversion events — "courier truth" architecture.
 *
 * COD rule: an order placed is NOT a purchase. The purchase is only real
 * when the courier confirms delivery. So:
 *  - Browser fires intent events at order time (InitiateCheckout / PlaceAnOrder)
 *  - Server fires money events when the courier reports back:
 *      delivered → Purchase / CompletePayment / purchase (real COD value)
 *      returned/cancelled → cancel events, NO purchase
 *
 * Attribution: click IDs captured at order time (fbp/fbc/ttclid/gaClientId)
 * are attached to server events, so courier data matches ad clicks 1:1.
 *
 * Every fire is logged to ConversionEvent (visible in admin order detail).
 * TEST mode (default): no network calls, mock-logged, so the whole flow
 * can be verified before pasting real tokens.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site";

export type ConversionConfig = {
  metaPixelId: string;
  metaToken: string;
  ga4Id: string;
  ga4Secret: string;
  tiktokPixelId: string;
  tiktokToken: string;
  testMode: boolean;
  siteUrl: string;
};

export async function getConversionConfig(): Promise<ConversionConfig> {
  const s = await getSettings();
  return {
    metaPixelId: s.meta_pixel_id ?? "",
    metaToken: s.meta_capi_token ?? "",
    ga4Id: s.ga4_id ?? "",
    ga4Secret: s.ga4_api_secret ?? "",
    tiktokPixelId: s.tiktok_pixel_id ?? "",
    tiktokToken: s.tiktok_events_token ?? "",
    testMode: (s.conversions_test_mode ?? "true") !== "false",
    siteUrl: getSiteUrl(),
  };
}

const sha256 = (v: string) =>
  createHash("sha256").update(v).digest("hex");

/** Normalize a BD phone to digits with country code for matching. */
export function normPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("880")) return d;
  if (d.startsWith("01") && d.length === 11) return "880" + d.slice(1);
  return d;
}

export type OrderAttribution = {
  orderId: string;
  orderNumber: string;
  invoiceNumber: string | null;
  total: number; // BDT minor
  currency: string;
  shipPhone: string;
  shipName: string;
  fbp: string | null;
  fbc: string | null;
  ttclid: string | null;
  gaClientId: string | null;
  clientIp: string | null;
  clientUa: string | null;
  itemCount: number;
};

async function log(
  orderId: string,
  destination: "META" | "GA4" | "TIKTOK",
  eventName: string,
  value: number,
  status: "SENT" | "FAILED" | "SKIPPED",
  testMode: boolean,
  detail?: string
) {
  try {
    await prisma.conversionEvent.create({
      data: {
        orderId,
        destination,
        eventName,
        value,
        status,
        testMode,
        detail: detail?.slice(0, 500),
      },
    });
  } catch {
    /* logging must never break the order flow */
  }
}

/* --------------------------------- Meta --------------------------------- */

async function sendMeta(
  cfg: ConversionConfig,
  eventName: string,
  eventId: string,
  a: OrderAttribution,
  valueBdt: number
) {
  if (!cfg.metaPixelId) {
    await log(a.orderId, "META", eventName, Math.round(valueBdt * 100), "SKIPPED", cfg.testMode, "meta_pixel_id missing");
    return;
  }
  if (cfg.testMode) {
    await log(a.orderId, "META", eventName, Math.round(valueBdt * 100), "SENT", true, `mock event_id=${eventId}`);
    return;
  }
  if (!cfg.metaToken) {
    await log(a.orderId, "META", eventName, Math.round(valueBdt * 100), "SKIPPED", false, "meta_capi_token missing");
    return;
  }
  try {
    const user_data: Record<string, unknown> = {
      ph: [sha256(normPhone(a.shipPhone))],
      client_ip_address: a.clientIp,
      client_user_agent: a.clientUa,
    };
    if (a.fbp) user_data.fbp = a.fbp;
    if (a.fbc) user_data.fbc = a.fbc;
    user_data.external_id = [sha256(`hz-${a.orderNumber}`)];

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.metaPixelId}/events?access_token=${cfg.metaToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              action_source: "website",
              event_source_url: `${cfg.siteUrl}/`,
              user_data,
              custom_data: {
                currency: a.currency,
                value: Number(valueBdt.toFixed(2)),
                order_id: a.orderNumber,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.events_received ?? 0) === 0) {
      throw new Error(data?.error?.message ?? `Meta HTTP ${res.status}`);
    }
    await log(a.orderId, "META", eventName, Math.round(valueBdt * 100), "SENT", false, `fbtrace=${data?.fbtrace_id ?? ""}`);
  } catch (e) {
    await log(a.orderId, "META", eventName, Math.round(valueBdt * 100), "FAILED", false, e instanceof Error ? e.message : "failed");
  }
}

/* --------------------------------- GA4 ---------------------------------- */

async function sendGa4(
  cfg: ConversionConfig,
  eventName: "purchase" | "refund",
  a: OrderAttribution,
  valueBdt: number
) {
  if (!cfg.ga4Id) {
    await log(a.orderId, "GA4", eventName, Math.round(valueBdt * 100), "SKIPPED", cfg.testMode, "ga4_id missing");
    return;
  }
  if (cfg.testMode) {
    await log(a.orderId, "GA4", eventName, Math.round(valueBdt * 100), "SENT", true, `mock transaction_id=${a.orderNumber}`);
    return;
  }
  if (!cfg.ga4Secret || !a.gaClientId) {
    await log(
      a.orderId, "GA4", eventName, Math.round(valueBdt * 100), "SKIPPED", false,
      !cfg.ga4Secret ? "ga4_api_secret missing" : "gaClientId not captured"
    );
    return;
  }
  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${cfg.ga4Id}&api_secret=${cfg.ga4Secret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: a.gaClientId,
          non_personalized_ads: false,
          events: [
            {
              name: eventName,
              params: {
                transaction_id: a.orderNumber,
                value: Number(valueBdt.toFixed(2)),
                currency: a.currency,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    // MP returns 204 on success with no body
    if (res.status !== 204 && !res.ok) throw new Error(`GA4 HTTP ${res.status}`);
    await log(a.orderId, "GA4", eventName, Math.round(valueBdt * 100), "SENT", false, `transaction_id=${a.orderNumber}`);
  } catch (e) {
    await log(a.orderId, "GA4", eventName, Math.round(valueBdt * 100), "FAILED", false, e instanceof Error ? e.message : "failed");
  }
}

/* -------------------------------- TikTok -------------------------------- */

async function sendTiktok(
  cfg: ConversionConfig,
  event: "CompletePayment" | "CancelOrder",
  a: OrderAttribution,
  valueBdt: number
) {
  if (!cfg.tiktokPixelId) {
    await log(a.orderId, "TIKTOK", event, Math.round(valueBdt * 100), "SKIPPED", cfg.testMode, "tiktok_pixel_id missing");
    return;
  }
  if (cfg.testMode) {
    await log(a.orderId, "TIKTOK", event, Math.round(valueBdt * 100), "SENT", true, `mock event_id=${a.orderNumber}`);
    return;
  }
  if (!cfg.tiktokToken) {
    await log(a.orderId, "TIKTOK", event, Math.round(valueBdt * 100), "SKIPPED", false, "tiktok_events_token missing");
    return;
  }
  try {
    const user: Record<string, unknown> = {
      external_id: sha256(`hz-${a.orderNumber}`),
      phone: sha256(normPhone(a.shipPhone)),
    };
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Access-Token": cfg.tiktokToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: cfg.tiktokPixelId,
        data: [
          {
            event,
            event_time: Math.floor(Date.now() / 1000),
            event_id: a.orderNumber,
            user,
            page: { url: `${cfg.siteUrl}/` },
            properties: {
              value: Number(valueBdt.toFixed(2)),
              currency: a.currency,
              content_type: "product",
            },
            ...(a.ttclid ? { context: { ad: { callback: a.ttclid } } } : {}),
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.code ?? -1) !== 0) {
      throw new Error(data?.message ?? `TikTok HTTP ${res.status}`);
    }
    await log(a.orderId, "TIKTOK", event, Math.round(valueBdt * 100), "SENT", false, `request_id=${data?.request_id ?? ""}`);
  } catch (e) {
    await log(a.orderId, "TIKTOK", event, Math.round(valueBdt * 100), "FAILED", false, e instanceof Error ? e.message : "failed");
  }
}

/* ------------------------------ orchestrators ---------------------------- */async function loadAttribution(orderId: string): Promise<OrderAttribution | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!o) return null;
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    invoiceNumber: o.invoiceNumber,
    total: o.total,
    currency: "BDT",
    shipPhone: o.shipPhone,
    shipName: o.shipName,
    fbp: o.fbp,
    fbc: o.fbc,
    ttclid: o.ttclid,
    gaClientId: o.gaClientId,
    clientIp: o.clientIp,
    clientUa: o.clientUa,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
  };
}

/**
 * Courier says DELIVERED → this is the REAL purchase.
 * Fires to all three platforms with the actual COD value. Never throws.
 */
export async function fireDeliveredConversions(
  orderId: string,
  codValueMinor?: number
): Promise<void> {
  try {
    const a = await loadAttribution(orderId);
    if (!a) return;
    // Idempotency: one truth per order — never fire twice, whatever happened before
    const existing = await prisma.conversionEvent.findFirst({
      where: { orderId, eventName: { in: ["Purchase", "purchase", "CompletePayment"] } },
    });
    if (existing) return;
    const cfg = await getConversionConfig();
    const valueBdt = (codValueMinor ?? a.total) / 100;
    await Promise.all([
      sendMeta(cfg, "Purchase", a.orderNumber, a, valueBdt),
      sendGa4(cfg, "purchase", a, valueBdt),
      sendTiktok(cfg, "CompletePayment", a, valueBdt),
    ]);
  } catch {
    /* conversions must never break order flow */
  }
}

/**
 * Courier says RETURNED/CANCELLED → take it back: NO purchase anywhere.
 * Sends cancel signals (for exclusion audiences) + GA4 refund safety.
 */
export async function fireCancelledConversions(orderId: string): Promise<void> {
  try {
    const a = await loadAttribution(orderId);
    if (!a) return;
    const existing = await prisma.conversionEvent.findFirst({
      where: { orderId, eventName: { in: ["OrderCancelled", "refund", "CancelOrder"] } },
    });
    if (existing) return;
    const cfg = await getConversionConfig();
    const valueBdt = a.total / 100;
    await Promise.all([
      sendMeta(cfg, "OrderCancelled", `${a.orderNumber}-cancel`, a, valueBdt),
      sendGa4(cfg, "refund", a, valueBdt),
      sendTiktok(cfg, "CancelOrder", a, valueBdt),
    ]);
  } catch {
    /* conversions must never break order flow */
  }
}

/* ---------------------------- connection tests --------------------------- */

/**
 * Validate a platform connection with the given (possibly unsaved) values.
 * Test mode → mock success, no network. Live → real validation calls that
 * don't pollute reporting (debug endpoints / test event codes).
 */
export async function testDestination(
  dest: "META" | "GA4" | "TIKTOK",
  input: {
    pixelId: string;
    token: string;
    testMode: boolean;
    siteUrl?: string;
  }
): Promise<{ ok: boolean; message: string }> {
  if (input.testMode) {
    return {
      ok: true,
      message: `🧪 TEST MODE — mock OK (${dest}). Live করতে Test Mode OFF করে token বসান।`,
    };
  }
  try {
    if (dest === "META") {
      if (!input.token) throw new Error("CAPI token দিন।");
      const res = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${input.token}&access_token=${input.token}`,
        { signal: AbortSignal.timeout(20000) }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.data?.is_valid !== true) {
        throw new Error(data?.data?.error?.message ?? "Token invalid");
      }
      return { ok: true, message: "✅ Meta token valid! (debug_token verified)" };
    }
    if (dest === "GA4") {
      const s = await getSettings();
      const mid = s.ga4_id ?? "";
      if (!mid || !input.token) throw new Error("GA4 ID + API secret দিন।");
      const res = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${mid}&api_secret=${input.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: "test-client",
            events: [{ name: "test_event", params: {} }],
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
      const data = await res.json().catch(() => ({}));
      const errors = (data?.validationMessages ?? []).filter(
        (m: { validationCode?: string }) => m.validationCode?.startsWith("VALUE_")
      );
      if (!res.ok || errors.length > 0) {
        throw new Error(errors[0]?.description ?? `GA4 HTTP ${res.status}`);
      }
      return { ok: true, message: "✅ GA4 secret valid! (debug endpoint verified)" };
    }
    // TIKTOK
    if (!input.pixelId || !input.token) throw new Error("Pixel ID + token দিন।");
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Access-Token": input.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: input.pixelId,
        test_event_code: "HALFZIPPER-TEST",
        data: [
          {
            event: "ViewContent",
            event_time: Math.floor(Date.now() / 1000),
            event_id: `test-${Date.now()}`,
            user: {},
            page: { url: input.siteUrl ?? getSiteUrl() + "/" },
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.code ?? -1) !== 0) {
      throw new Error(data?.message ?? `TikTok HTTP ${res.status}`);
    }
    return { ok: true, message: "✅ TikTok connected! (test event sent, reporting-এ যাবে না)" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
