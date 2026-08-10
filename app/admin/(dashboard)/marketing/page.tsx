import type { Metadata } from "next";

import AdminMarketingPage from "@/components/admin/marketing/admin-marketing-page";

export const metadata: Metadata = {
  title: "Marketing | Administration Tikemia",
  description:
    "Contrôle, validation et suivi des campagnes marketing des organisateurs Tikemia.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminMarketingRoute() {
  return <AdminMarketingPage />;
}
