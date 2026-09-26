import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Analytics, tracking pixels &amp; Telegram notifications
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
