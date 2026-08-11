import type {
  Metadata,
} from "next";

import ClientRefundsPage from "@/components/client/refunds/client-refunds-page";

export const metadata: Metadata = {
  title:
    "Remboursements | Tikemia",
  description:
    "Sélectionnez vos billets éligibles, envoyez une demande de remboursement et suivez son traitement depuis votre espace Tikemia.",
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function ClientAccountRefundsPage() {
  return (
    <main className="w-full">
      <ClientRefundsPage />
    </main>
  );
}