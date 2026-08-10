"use client";

import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  useEffect,
} from "react";

type AdminPromotionsErrorProps =
  Readonly<{
    error:
      Error & {
        digest?:
          string;
      };

    reset:
      () => void;
  }>;

export default function AdminPromotionsError({
  error,
  reset,
}: AdminPromotionsErrorProps) {
  useEffect(() => {
    console.error(
      "[ADMIN_PROMOTIONS_PAGE_ERROR]",
      error,
    );
  }, [
    error,
  ]);

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center bg-[#030708] p-4 text-white sm:p-6">
      <div className="w-full max-w-lg rounded-[24px] border border-red-400/15 bg-[#071019] p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.07] text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-red-300">
          Administration Tikemia
        </p>

        <h1 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
          Impossible de charger les promotions
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
          Une erreur est survenue pendant le chargement de la gestion des
          promotions. Vous pouvez relancer la page sans quitter
          l’administration.
        </p>

        {error.digest ? (
          <p className="mt-4 text-xs text-neutral-700">
            Référence : {error.digest}
          </p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-neutral-200"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    </div>
  );
}
