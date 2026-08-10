"use client";

import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useEffect } from "react";

export default function AdminOrganizersError({
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
      "[ADMIN_ORGANIZERS_PAGE_ERROR]",
      {
        name:
          error.name,
        message:
          error.message,
        digest:
          error.digest,
      },
    );
  }, [error]);

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center bg-[#050708] p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-[24px] border border-red-400/15 bg-[#090b0c] p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/[0.07] text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-red-300">
          Erreur
        </p>

        <h1 className="mt-2 text-xl font-black text-white sm:text-2xl">
          Impossible de charger les organisateurs
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
          Tikemia n’a pas pu récupérer les informations des organisateurs.
          Vous pouvez relancer le chargement de cette page.
        </p>

        {process.env.NODE_ENV ===
        "development" ? (
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/30 p-3 text-left">
            <p className="break-words text-xs leading-5 text-neutral-500">
              {error.message}
            </p>

            {error.digest ? (
              <p className="mt-2 break-all text-[11px] text-neutral-700">
                Digest :{" "}
                {error.digest}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-black text-black transition hover:bg-emerald-300"
        >
          <RefreshCw className="h-4 w-4" />

          Réessayer
        </button>
      </div>
    </main>
  );
}