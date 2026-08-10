import type { Metadata } from "next";

import AdminCouponsPage from "@/components/admin/coupons/admin-coupons-page";

export const metadata: Metadata = {
  title: "Codes promo | Administration Tikemia",
  description:
    "Contrôle, suivi et gestion des codes promo créés par les organisateurs Tikemia.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCouponsRoute() {
  return <AdminCouponsPage />;
}
