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
