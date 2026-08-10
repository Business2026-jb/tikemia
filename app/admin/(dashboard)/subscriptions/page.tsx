import type {
  Metadata,
} from "next";

import AdminSubscriptionsPage from "@/components/admin/subscriptions/admin-subscriptions-page";

export const metadata:
  Metadata = {
    title:
      "Abonnements | Administration Tikemia",

    description:
      "Gestion et contrôle des abonnements organisateurs Tikemia.",
  };

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function AdminSubscriptionsRoute() {
  return (
    <AdminSubscriptionsPage />
  );
}
