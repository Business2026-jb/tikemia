import type { ReactNode } from "react";

import AdminDashboardShell from "@/components/admin/admin-dashboard-shell";
import { requireAdmin } from "@/lib/admin/require-admin";

type AdminDashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AdminDashboardLayout({
  children,
}: AdminDashboardLayoutProps) {
  await requireAdmin();

  return (
    <AdminDashboardShell>
      {children}
    </AdminDashboardShell>
  );
}