/**
 * Steadfast Courier integration (docs: portal.packzy.com/api/v1).
 *
 * Two modes:
 * - LIVE: real API calls with the merchant Api-Key / Secret-Key
 *         saved in Admin → Settings.
 * - TEST (mock): no network calls. Returns fake consignment numbers
 *         and a simulated delivery progression so the whole flow
 *         (book → print label → sync → delivered) can be tried safely.
 */
import { getSetting } from "@/lib/settings";

export type SteadfastCreds = {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  testMode: boolean;
};

export async function getSteadfastConfig(
  override?: Partial<SteadfastCreds>
): Promise<SteadfastCreds> {
  const [apiKey, secretKey, baseUrl, testMode] = await Promise.all([
    getSetting("steadfast_api_key"),
    getSetting("steadfast_secret_key"),
    getSetting("steadfast_base_url"),
    getSetting("steadfast_test_mode"),
  ]);
  return {
    apiKey: override?.apiKey ?? apiKey,
    secretKey: override?.secretKey ?? secretKey,
    baseUrl:
      override?.baseUrl || baseUrl || "https://portal.packzy.com/api/v1",
    testMode: override?.testMode ?? testMode !== "false",
  };
}

function headers(c: SteadfastCreds): Record<string, string> {
  return {
    "Api-Key": c.apiKey,
    "Secret-Key": c.secretKey,
    "Content-Type": "application/json",
  };
}

export type SteadfastOrderInput = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number; // BDT
  note?: string;
};

export type SteadfastBooking = {
  consignment_id: number;
  tracking_code: string;
  invoice: string;
  test: boolean;
};

const rand = (n: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

/** Create a Steadfast consignment. Returns consignment + tracking code. */
export async function createSteadfastOrder(
  creds: SteadfastCreds,
  input: SteadfastOrderInput
): Promise<SteadfastBooking> {
  if (creds.testMode) {
    // Mock booking — looks real, costs nothing
    await new Promise((r) => setTimeout(r, 400));
    return {
      consignment_id: 900000 + Math.floor(Math.random() * 99999),
      tracking_code: `TST${rand(6)}`,
      invoice: input.invoice,
      test: true,
    };
  }
  if (!creds.apiKey || !creds.secretKey) {
    throw new Error(
      "Steadfast Api-Key / Secret-Key বসানো নেই। Admin → Settings থেকে বসান।"
    );
  }
  const res = await fetch(
    `${creds.baseUrl.replace(/\/$/, "")}/create_order`,
    {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify({
        invoice: input.invoice,
        recipient_name: input.recipient_name.slice(0, 100),
        recipient_phone: input.recipient_phone,
        recipient_address: input.recipient_address.slice(0, 250),
        cod_amount: Math.max(0, Math.round(input.cod_amount)),
        delivery_type: 0,
        note: input.note?.slice(0, 200),
      }),
      signal: AbortSignal.timeout(30000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 400 || data?.status === "error") {
    const msg =
      data?.message ||
      (typeof data?.errors === "object"
        ? Object.values(data.errors).flat().join(", ")
        : "") ||
      `Steadfast API error (HTTP ${res.status})`;
    throw new Error(String(msg));
  }
  const c = data?.consignment ?? data;
  if (!c?.consignment_id || !c?.tracking_code) {
    throw new Error("Steadfast থেকে consignment পাওয়া যায়নি।");
  }
  return {
    consignment_id: Number(c.consignment_id),
    tracking_code: String(c.tracking_code),
    invoice: input.invoice,
    test: false,
  };
}

export type SteadfastStatus = {
  delivery_status: string;
  consignment_id?: number;
  tracking_code?: string;
  invoice?: string;
  /** COD actually collected by courier (BDT), if reported */
  collected?: number | null;
  /** pcs actually delivered (partial), if reported */
  deliveredQty?: number | null;
  test: boolean;
};

/** Pull the first usable number from candidate keys (official field names vary). */
export function pickNumber(data: unknown, keys: string[]): number | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  // also look one level inside `consignment` / `data` wrappers
  const scopes: Record<string, unknown>[] = [obj];
  for (const w of ["consignment", "data", "order"]) {
    if (obj[w] && typeof obj[w] === "object") scopes.push(obj[w] as Record<string, unknown>);
  }
  for (const s of scopes) {
    for (const k of keys) {
      const v = s[k];
      const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Check live delivery status. Pass whichever identifier we have.
 * In TEST mode the status progresses with time since booking so the
 * full lifecycle can be demoed: pending → in_transit →
 * out_for_delivery → delivered. Mock collected = expected total.
 */
export async function getSteadfastStatus(
  creds: SteadfastCreds,
  id: { consignmentId?: string | null; invoice?: string; trackingCode?: string | null },
  bookedAt?: Date | null,
  expectedTotalMinor?: number
): Promise<SteadfastStatus> {
  if (creds.testMode) {
    const mins = bookedAt
      ? (Date.now() - bookedAt.getTime()) / 60000
      : 999;
    const delivery_status =
      mins < 1
        ? "pending"
        : mins < 3
          ? "in_transit"
          : mins < 6
            ? "out_for_delivery"
            : "delivered";
    return {
      delivery_status,
      tracking_code: id.trackingCode ?? undefined,
      invoice: id.invoice,
      collected: expectedTotalMinor ?? null,
      test: true,
    };
  }
  if (!creds.apiKey || !creds.secretKey) {
    throw new Error("Steadfast credential বসানো নেই।");
  }
  const base = creds.baseUrl.replace(/\/$/, "");
  const path = id.consignmentId
    ? `/status_by_cid/${id.consignmentId}`
    : id.trackingCode
      ? `/status_by_trackingcode/${id.trackingCode}`
      : id.invoice
        ? `/status_by_invoice/${id.invoice}`
        : null;
  if (!path) throw new Error("Consignment / tracking তথ্য নেই।");
  const res = await fetch(`${base}${path}`, {
    headers: headers(creds),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.message ?? `Steadfast status error (HTTP ${res.status})`
    );
  }
  const d = data?.delivery_status ?? data;
  const status = String(
    typeof d === "string" ? d : (d?.delivery_status ?? "unknown")
  ).toLowerCase();
  // COD collected + delivered qty (field names vary across API versions)
  const collectedRaw = pickNumber(data, [
    "cod_amount",
    "collected_amount",
    "cod_collected",
    "collected",
    "amount",
    "cod",
  ]);
  return {
    delivery_status: status,
    consignment_id: data?.consignment_id,
    tracking_code: data?.tracking_code,
    invoice: data?.invoice,
    // API reports Taka; convert to poisha
    collected: collectedRaw != null ? Math.round(collectedRaw * 100) : null,
    deliveredQty: pickNumber(data, [
      "delivered_quantity",
      "quantity",
      "delivered_qty",
      "item_quantity",
    ]),
    test: false,
  };
}

/** Balance check — used by the Settings "Test Connection" button. */
export async function getSteadfastBalance(
  creds: SteadfastCreds
): Promise<{ balance: number; test: boolean }> {
  if (creds.testMode) {
    return { balance: 12500, test: true };
  }
  if (!creds.apiKey || !creds.secretKey) {
    throw new Error("Api-Key / Secret-Key দিন।");
  }
  const res = await fetch(
    `${creds.baseUrl.replace(/\/$/, "")}/get_balance`,
    {
      headers: headers(creds),
      signal: AbortSignal.timeout(30000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message ?? `HTTP ${res.status}`);
  }
  return {
    balance: Number(data?.current_balance ?? data?.balance ?? 0),
    test: false,
  };
}

/* ------------------------- status mapping ------------------------- */

export type CourierSyncOutcome = "delivered" | "returned" | "in_transit" | "unknown";

/** Map a Steadfast delivery_status to what we should do with the order. */
export function mapSteadfastStatus(raw: string): CourierSyncOutcome {
  const s = raw.toLowerCase();
  if (s.includes("delivered") && !s.includes("partial")) return "delivered";
  if (
    s.includes("cancel") ||
    s.includes("return") ||
    s.includes("partial")
  )
    return "returned";
  if (
    ["pending", "in_transit", "out_for_delivery", "hold", "in_review"].some(
      (k) => s.includes(k)
    )
  )
    return "in_transit";
  return "unknown";
}

export const STEADFAST_STATUS_BN: Record<string, string> = {
  pending: "পেন্ডিং (পিকআপের অপেক্ষায়)",
  in_transit: "ট্রানজিটে আছে",
  out_for_delivery: "ডেলিভারির জন্য বেরিয়েছে",
  delivered: "ডেলিভারড ✓",
  delivered_approval_pending: "ডেলিভারড (অনুমোদন বাকি)",
  partial_delivered: "আংশিক ডেলিভারড",
  cancelled: "বাতিল",
  hold: "হোল্ডে আছে",
  in_review: "রিভিউতে আছে",
  unknown: "অজানা",
};

export function steadfastStatusBn(raw?: string | null): string {
  if (!raw) return "—";
  return STEADFAST_STATUS_BN[raw.toLowerCase()] ?? raw;
}
