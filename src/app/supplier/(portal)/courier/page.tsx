import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CourierSetup from "@/components/supplier/CourierSetup";

export const dynamic = "force-dynamic";

export default async function CourierPage() {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const creds = await prisma.courierCredential.findMany({
    where: { supplierId },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Courier Setup</h1>
        <p className="text-sm text-slate-500 mt-1">
          আপনার courier API credential যোগ করুন — order book করার সময় ব্যবহৃত হবে।
        </p>
      </div>
      <CourierSetup
        initial={creds.map((c) => ({
          provider: c.provider,
          apiKey: c.apiKey,
          apiSecret: c.apiSecret ?? "",
          baseUrl: c.baseUrl ?? "",
        }))}
      />
    </div>
  );
}
