import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sécurité | Administration Tikemia",
};

export default function AdminSecurityPage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Sécurité
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Gérez la sécurité et la protection de la plateforme Tikemia.
        </p>
      </div>
    </main>
  );
}