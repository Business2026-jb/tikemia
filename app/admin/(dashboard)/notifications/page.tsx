import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications | Administration Tikemia",
};

export default function AdminNotificationsPage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Notifications
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Consultez et gérez les notifications de l’administration Tikemia.
        </p>
      </div>
    </main>
  );
}