import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journal d’audit | Administration Tikemia",
};

export default function AdminAuditLogsPage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Journal d’audit
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Consultez l’historique des activités administratives de la plateforme.
        </p>
      </div>
    </main>
  );
}