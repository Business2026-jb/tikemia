import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paramètres | Administration Tikemia",
};

export default function AdminSettingsPage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Paramètres
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Gérez les paramètres généraux de l’administration Tikemia.
        </p>
      </div>
    </main>
  );
}