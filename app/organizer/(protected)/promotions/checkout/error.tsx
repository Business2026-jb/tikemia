"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
} from "react";

type OrganizerPromotionCheckoutErrorProps =
  Readonly<{
    error: Error & {
      digest?: string;
    };
    reset: () => void;
  }>;

export default function OrganizerPromotionCheckoutError({
  error,
  reset,
}: OrganizerPromotionCheckoutErrorProps) {
  useEffect(() => {
    console.error(
      "[ORGANIZER_PROMOTION_CHECKOUT_ERROR_BOUNDARY]",
      {
        name:
          error.name,
        message:
          error.message,
        digest:
          error.digest ??
          null,
      },
    );
  }, [error]);

  return (
    <main className="flex min-h-[calc(100dvh-160px)] w-full min-w-0 items-center justify-center py-6 sm:py-8">
      <section className="relative w-full max-w-[980px] overflow-hidden rounded-2xl border border-orange-500/20 bg-[#071015] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/[0.08] via-transparent to-red-500/[0.05]"
        />

        <header className="relative border-b border-white/[0.07] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-400">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-lime-400">
                  <Sparkles className="h-3 w-3" />
                  Visibilité Premium
                </span>

                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                  Erreur de paiement
                </span>
              </div>

              <h1 className="mt-3 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                Impossible de charger le paiement
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                Une erreur inattendue empêche l’affichage du paiement de votre abonnement Premium.
              </p>
            </div>
          </div>
        </header>

        <div className="relative p-5 sm:p-6">
          <div
            role="alert"
            className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-4 py-3.5 text-sm leading-6 text-orange-200"
          >
            Le paiement n’a pas pu être chargé correctement. Aucune confirmation de paiement n’a été effectuée par cette page.
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

              <div>
                <p className="text-xs font-black text-neutral-300">
                  Votre paiement reste protégé
                </p>

                <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                  Le statut réel d’un abonnement est confirmé uniquement par le serveur Tikemia et le webhook sécurisé du prestataire de paiement. Une erreur d’affichage ne valide pas un paiement.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </button>

            <Link
              href="/organizer/promotions"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à Visibilité Premium
            </Link>
          </div>

          {process.env.NODE_ENV ===
          "development" ? (
            <details className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <summary className="cursor-pointer text-xs font-bold text-neutral-400">
                Informations de développement
              </summary>

              <div className="mt-3 space-y-1 text-[11px] leading-5 text-neutral-600">
                <p>
                  <span className="font-bold text-neutral-500">
                    Nom :
                  </span>{" "}
                  {error.name}
                </p>

                <p>
                  <span className="font-bold text-neutral-500">
                    Message :
                  </span>{" "}
                  {error.message}
                </p>

                {error.digest ? (
                  <p>
                    <span className="font-bold text-neutral-500">
                      Digest :
                    </span>{" "}
                    {error.digest}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        <footer className="relative flex flex-col gap-2 border-t border-white/[0.07] bg-black/15 px-5 py-3.5 text-[10px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
            Tikemia — Paiement organisateur sécurisé
          </span>

          <span>
            Visibilité Premium
          </span>
        </footer>
      </section>
    </main>
  );
}