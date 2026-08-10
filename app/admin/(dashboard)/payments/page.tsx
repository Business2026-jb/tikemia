import type { Metadata } from "next";

import AdminPaymentsPage from "@/components/admin/payments/admin-payments-page";

export const metadata: Metadata = {
  title: "Paiements | Administration Tikemia",
  description:
    "Gestion, suivi et export des paiements effectués sur Tikemia.",
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function AdminPaymentsRoute() {
  return (
    <AdminPaymentsPage />
  );
}
