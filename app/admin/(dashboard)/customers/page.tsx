import type {
  Metadata,
} from "next";

import AdminCustomersPage from "@/components/admin/customers/admin-customers-page";

export const metadata: Metadata = {
  title:
    "Clients | Administration Tikemia",
  description:
    "Consultez les clients ayant acheté sur Tikemia, leurs coordonnées, commandes et billets.",
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function AdminCustomersRoute() {
  return (
    <AdminCustomersPage />
  );
}
