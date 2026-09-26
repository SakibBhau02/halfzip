import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SupplierShell from "@/components/supplier/SupplierShell";

export const metadata = { title: "Supplier — Half Zipper" };

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const supplierId = (session?.user as { supplierId?: string } | undefined)
    ?.supplierId;
  if (!session || role !== "SUPPLIER" || !supplierId) {
    redirect("/supplier/login");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });

  return (
    <SupplierShell
      name={supplier?.name ?? "Supplier"}
      company={supplier?.company ?? supplier?.name ?? ""}
    >
      {children}
    </SupplierShell>
  );
}
