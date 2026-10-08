import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = { title: "Admin — Manza BD" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") redirect("/admin/login");

  return (
    <AdminShell email={session.user?.email ?? "admin"}>
      {children}
    </AdminShell>
  );
}
