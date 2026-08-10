"use client";

import {
  AlertTriangle,
  Home,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
} from "react";

export default function AdminCustomersError({
  error,
  reset,
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[ADMIN_CUSTOMERS_PAGE_ERROR]",
      {
        name:
          error.name,

        message:
          error.message,

        digest:
          error.digest,
      },
    );
  }, [
    error,
  ]);

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center bg-[#030708] p-4 text-white sm:p-6">
      <section className="w-full max-w-xl rounded-[28px] border border-red-400/15 bg-[#071014] p-6 text-center shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/[0.065] text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-red-300">
          Erreur de chargement
        </p>

        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
          Impossible de charger les clients
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
          Tikemia n’a pas pu récupérer la liste des clients pour le moment.
          Relancez le chargement de la page.
        </p>

        {process.env.NODE_ENV ===
        "development" ? (
          <div className="mt-5 rounded-2xl border border-white/[0.065] bg-black/25 p-4 text-left">
            <p className="break-words text-xs leading-5 text-neutral-500">
              {error.message}
            </p>

            {error.digest ? (
              <p className="mt-2 break-all text-[10px] text-neutral-700">
                Référence :{" "}
                {error.digest}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={
              reset
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-black text-[#04100b] transition hover:bg-emerald-300"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>

          <Link
            href="/admin/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-5 text-sm font-black text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Home className="h-4 w-4" />
            Tableau de bord
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-neutral-700">
          <Users className="h-3.5 w-3.5" />
          Administration Tikemia
        </div>
      </section>
    </main>
  );
}
