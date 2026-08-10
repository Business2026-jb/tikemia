import type { Metadata } from "next";

import AdminPayoutsPage from "@/components/admin/payouts/admin-payouts-page";

export const metadata: Metadata = {
  title: "Retraits | Administration Tikemia",
  description:
    "Gestion, validation et suivi des demandes de retrait des organisateurs Tikemia.",
};

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default function AdminPayoutsRoute() {
  return <AdminPayoutsPage />;
}
