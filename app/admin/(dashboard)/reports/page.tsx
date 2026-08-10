import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rapports | Administration Tikemia",
};

export default function AdminReportsPage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Rapports
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Consultez et gérez les rapports de la plateforme Tikemia.
        </p>
      </div>
    </main>
  );
}