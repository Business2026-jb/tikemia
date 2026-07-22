"use client";

import {
  ArrowRight,
  SearchX,
  TicketPercent,
  X,
} from "lucide-react";

export type CouponsEmptyStateProps = {
  /**
   * Indique si la liste est vide à cause d’une recherche
   * ou de filtres actuellement appliqués.
   */
  hasActiveFilters?: boolean;

  /**
   * Ouvre le formulaire de création d’un code promo.
   */
  onCreateCoupon?: () => void;

  /**
   * Réinitialise la recherche et tous les filtres.
   */
  onClearFilters?: () => void;

  /**
   * Désactive les actions pendant une opération en cours.
   */
  disabled?: boolean;

  /**
   * Permet de personnaliser les textes sans modifier le composant.
   */
  title?: string;
  description?: string;

  className?: string;
};

function joinClassNames(
  ...classNames: Array<
    string | false | null | undefined
  >
): string {
  return classNames
    .filter(Boolean)
    .join(" ");
}

export default function CouponsEmptyState({
  hasActiveFilters = false,
  onCreateCoupon,
  onClearFilters,
  disabled = false,
  title,
  description,
  className,
}: CouponsEmptyStateProps) {
  const resolvedTitle =
    title ??
    (hasActiveFilters
      ? "Aucun code promo trouvé"
      : "Créez votre premier code promo");

  const resolvedDescription =
    description ??
    (hasActiveFilters
      ? "Aucun code promo ne correspond à votre recherche ou aux filtres sélectionnés. Modifiez vos critères pour afficher d’autres résultats."
      : "Proposez une réduction ciblée pour stimuler les ventes, fidéliser vos participants et mesurer les performances de vos campagnes.");

  return (
    <section
      aria-labelledby="coupons-empty-state-title"
      className={joinClassNames(
        "relative flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071015] px-5 py-12 sm:px-8 lg:min-h-[500px] lg:px-12",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.07] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-lime-400/[0.04] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <div className="relative mb-7">
          <div className="absolute inset-0 scale-125 rounded-3xl bg-emerald-400/10 blur-2xl" />

          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.08] shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:h-24 sm:w-24">
            {hasActiveFilters ? (
              <SearchX
                aria-hidden="true"
                className="h-9 w-9 text-emerald-300 sm:h-11 sm:w-11"
                strokeWidth={1.8}
              />
            ) : (
              <TicketPercent
                aria-hidden="true"
                className="h-9 w-9 text-emerald-300 sm:h-11 sm:w-11"
                strokeWidth={1.8}
              />
            )}
          </div>

          <span className="absolute -right-2 -top-2 flex h-8 min-w-8 items-center justify-center rounded-full border border-[#071015] bg-lime-300 px-2 text-xs font-black text-[#071015] shadow-lg">
            {hasActiveFilters ? "0" : "%"}
          </span>
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 sm:text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
          Codes promo
        </div>

        <h2
          id="coupons-empty-state-title"
          className="max-w-xl text-balance text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl lg:text-[34px]"
        >
          {resolvedTitle}
        </h2>

        <p className="mt-4 max-w-xl text-pretty text-sm font-medium leading-6 text-slate-400 sm:text-[15px] sm:leading-7">
          {resolvedDescription}
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          {hasActiveFilters && onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              disabled={disabled}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-extrabold text-white transition hover:border-white/[0.18] hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071015] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.2}
              />
              Effacer les filtres
            </button>
          ) : null}

          {onCreateCoupon ? (
            <button
              type="button"
              onClick={onCreateCoupon}
              disabled={disabled}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-[#03110b] shadow-[0_14px_35px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071015] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TicketPercent
                aria-hidden="true"
                className="h-[18px] w-[18px]"
                strokeWidth={2.2}
              />
              Créer un code promo
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.2}
              />
            </button>
          ) : null}
        </div>

        {!hasActiveFilters ? (
          <div className="mt-10 grid w-full max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              {
                label: "Réduction ciblée",
                value: "Pourcentage ou montant fixe",
              },
              {
                label: "Utilisation maîtrisée",
                value: "Limites globales et par client",
              },
              {
                label: "Performance mesurée",
                value: "Ventes, revenus et conversions",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-4"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
                  {item.label}
                </p>
                <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}