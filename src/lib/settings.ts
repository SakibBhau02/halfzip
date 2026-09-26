import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = [
  "ga4_id",
  "gtm_id",
  "meta_pixel_id",
  "tiktok_pixel_id",
  "google_ads_id",
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_enabled",
  "whatsapp_number",
  // invoice / store
  "store_name",
  "store_address",
  "store_phone",
  "store_email",
  "store_bin",
  "store_vat_registered",
  "invoice_footer",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export type SettingsMap = Record<string, string>;

const DEFAULTS: SettingsMap = {
  ga4_id: "",
  gtm_id: "",
  meta_pixel_id: "",
  tiktok_pixel_id: "",
  google_ads_id: "",
  telegram_bot_token: "",
  telegram_chat_id: "",
  telegram_enabled: "false",
  whatsapp_number: "",
  store_name: "Half Zipper",
  store_address: "Dhaka, Bangladesh",
  store_phone: "",
  store_email: "",
  store_bin: "",
  store_vat_registered: "false",
  invoice_footer:
    "ধন্যবাদ আমাদের সাথে কেনাকাটার জন্য। পণ্য পছন্দ না হলে ৭ দিনের মধ্যে এক্সচেঞ্জ করা যাবে।",
};

export async function getSettings(): Promise<SettingsMap> {
  try {
    const rows = await prisma.setting.findMany();
    const map: SettingsMap = { ...DEFAULTS };
    for (const r of rows) map[r.key] = r.value;
    return map;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function getSetting(key: string): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? DEFAULTS[key] ?? "";
  } catch {
    return DEFAULTS[key] ?? "";
  }
}

export async function saveSettings(values: SettingsMap) {
  const entries = Object.entries(values).filter(([k]) =>
    (SETTING_KEYS as readonly string[]).includes(k)
  );
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: value ?? "" },
        create: { key, value: value ?? "" },
      })
    )
  );
}

export { DEFAULTS as SETTINGS_DEFAULTS };
