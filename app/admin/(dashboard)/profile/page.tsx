import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil | Administration Tikemia",
};

export default function AdminProfilePage() {
  return (
    <main className="min-h-full w-full">
      <div className="w-full">
        <h1 className="text-2xl font-black text-white">
          Profil
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Consultez et gérez votre profil administrateur Tikemia.
        </p>
      </div>
    </main>
  );
}