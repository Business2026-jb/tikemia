import type { Metadata } from "next";

import AdminEventsPage from "@/components/admin/events/admin-events-page";

export const metadata: Metadata = {
  title: "Événements | Administration Tikemia",
  description:
    "Gestion et modération des événements publiés par les organisateurs Tikemia.",
};

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default function AdminEventsRoute() {
  return <AdminEventsPage />;
}