"use client";

import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useEffect } from "react";

type AdminMarketingErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function AdminMarketingError({
  error,
  reset,
}: AdminMarketingErrorProps) {
  useEffect(() => {
    console.error("[ADMIN_MARKETING_PAGE_ERROR]", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center bg-[#030708] p-4 text-white">
      <div className="w-full max-w-xl rounded-[24px] border border-red-400/15 bg-[#071019] p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.08] text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="mt-5 text-2xl font-black">
          Impossible d’afficher les campagnes marketing
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Une erreur est survenue pendant le chargement de cette page.
          Réessayez sans quitter l’espace d’administration.
        </p>

        {error.digest ? (
          <p className="mt-3 text-xs text-neutral-700">
            Référence : {error.digest}
          </p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-5 text-sm font-black text-white transition hover:bg-fuchsia-400"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    </main>
  );
}
