import type { Metadata } from "next";

import AdminOrganizersPage from "@/components/admin/organizers/admin-organizers-page";

export const metadata: Metadata = {
  title: "Organisateurs | Administration Tikemia",
  description:
    "Gestion et contrôle des comptes organisateurs Tikemia.",
};

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default function AdminOrganizersRoute() {
  return <AdminOrganizersPage />;
}