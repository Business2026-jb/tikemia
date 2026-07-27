import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireClient } from "@/lib/client/auth/require-client";

export const metadata: Metadata = {
  title: "Mon compte | Tikemia",
  description:
    "Consultez vos billets, vos commandes et vos informations personnelles Tikemia.",
};

export const dynamic = "force-dynamic";

type ClientAccountLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ClientAccountLayout({
  children,
}: ClientAccountLayoutProps) {
  await requireClient(
    "/account/tickets",
  );

  return (
    <main className="min-h-screen w-full bg-[#03070a] text-white">
      <div className="w-full px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-10 xl:px-10">
        {children}
      </div>
    </main>
  );
}