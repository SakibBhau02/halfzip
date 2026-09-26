import { getPublicProduct } from "@/lib/product";
import { getSettings } from "@/lib/settings";
import LandingClient from "@/components/LandingClient";
import Analytics from "@/components/Analytics";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [product, settings] = await Promise.all([
    getPublicProduct(),
    getSettings(),
  ]);
  return (
    <>
      <Analytics settings={settings} />
      <LandingClient
        product={product}
        whatsappNumber={settings.whatsapp_number}
      />
    </>
  );
}
