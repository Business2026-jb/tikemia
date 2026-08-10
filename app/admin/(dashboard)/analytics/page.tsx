import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | Administration Tikemia",
};

export default function AdminAnalyticsPage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Analytics
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Consultez les statistiques et les performances de la plateforme Tikemia.
        </p>
      </div>
    </main>
  );
}