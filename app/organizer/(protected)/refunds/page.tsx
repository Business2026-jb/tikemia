import type {
  Metadata,
} from "next";

import OrganizerRefundsPage from "@/components/organizer/refunds/organizer-refunds-page";

export const metadata: Metadata = {
  title:
    "Remboursements organisateur | Tikemia",
  description:
    "Consultez, analysez, transmettez ou refusez les demandes de remboursement liées à vos événements Tikemia.",
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default function OrganizerDashboardRefundsPage() {
  return (
    <main className="w-full">
      <OrganizerRefundsPage />
    </main>
  );
}