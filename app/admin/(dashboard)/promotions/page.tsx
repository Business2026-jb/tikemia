import type {
  Metadata,
} from "next";

import AdminPromotionsPage from "@/components/admin/promotions/admin-promotions-page";

export const metadata: Metadata = {
  title:
    "Promotions | Administration Tikemia",
  description:
    "Validation et contrôle des promotions d’événements Tikemia.",
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function AdminPromotionsRoute() {
  return (
    <AdminPromotionsPage />
  );
}
