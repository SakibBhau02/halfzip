"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { saveSettings, type SettingsMap } from "@/lib/settings";
import { sendTelegram } from "@/lib/telegram";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") throw new Error("Unauthorized");
}

export async function saveAllSettings(
  values: SettingsMap
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    await saveSettings(values);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Save failed" };
  }
}

export async function testTelegram(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const sent = await sendTelegram(
    "✅ <b>Half Zipper</b> — Telegram notification connected successfully!"
  );
  return sent
    ? { ok: true }
    : {
        ok: false,
        error:
          "টেলিগ্রাম মেসেজ পাঠানো যায়নি। Bot Token, Chat ID ও Enabled ঠিক আছে কিনা চেক করুন।",
      };
}

/**
 * Test the Steadfast merchant connection with the given (possibly unsaved)
 * values. In test mode no real API call happens — mock balance is returned.
 */
export async function testSteadfastConnection(input: {  apiKey: string;
  secretKey: string;
  baseUrl: string;
  testMode: boolean;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    const { getSteadfastBalance } = await import("@/lib/steadfast");
    const { balance, test } = await getSteadfastBalance({
      apiKey: input.apiKey.trim(),
      secretKey: input.secretKey.trim(),
      baseUrl: input.baseUrl.trim() || "https://portal.packzy.com/api/v1",
      testMode: input.testMode,
    });
    return {
      ok: true,
      message: test
        ? `🧪 TEST MODE — সংযোগ ঠিক আছে (mock balance ৳${balance.toLocaleString("en-BD")})। Real booking হবে না।`
        : `✅ Connected! Steadfast balance: ৳${balance.toLocaleString("en-BD")}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

/**
 * Test a server-conversion destination (Meta CAPI / GA4 MP / TikTok Events).
 * Test mode → mock. Live → validation calls that don't pollute reporting.
 */
export async function testConversionDestination(input: {
  dest: "META" | "GA4" | "TIKTOK";
  pixelId: string;
  token: string;
  testMode: boolean;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const { testDestination } = await import("@/lib/conversions");
  const { getSiteUrl } = await import("@/lib/site");
  const res = await testDestination(input.dest, {
    pixelId: input.pixelId.trim(),
    token: input.token.trim(),
    testMode: input.testMode,
    siteUrl: getSiteUrl(),
  });
  return res.ok
    ? { ok: true, message: res.message }
    : { ok: false, error: res.message };
}
