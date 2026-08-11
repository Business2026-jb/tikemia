import type {
  Metadata,
} from "next";

import AdminRefundsPage from "@/components/admin/refunds/admin-refunds-page";

export const metadata: Metadata = {
  title:
    "Remboursements | Administration Tikemia",
  description:
    "Consultez, analysez et traitez les demandes de remboursement depuis l’administration Tikemia.",
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function AdminDashboardRefundsPage() {
  return (
    <main className="w-full">
      <AdminRefundsPage />
    </main>
  );
}