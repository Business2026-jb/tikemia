"use client";

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Crown,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

type PromotionEmptyStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  secondaryActionLabel?: string;
  hasSubscription?: boolean;
  hasEligibleEvents?: boolean;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

type BenefitProps = {
  icon: typeof Sparkles;
  title: string;
  description: string;
};

export default function PromotionEmptyState({
  title,
  description,
  actionLabel,
  secondaryActionLabel,
  hasSubscription = false,
  hasEligibleEvents = true,
  onPrimaryAction,
  onSecondaryAction,
}: PromotionEmptyStateProps) {
  const resolvedTitle =
    title ??
    (hasSubscription
      ? hasEligibleEvents
        ? "Aucun événement promu"
        : "Aucun événement éligible"
      : "Développez votre visibilité");

  const resolvedDescription =
    description ??
    (hasSubscription
      ? hasEligibleEvents
        ? "Choisissez un événement publié pour le faire apparaître parmi les premières positions sur Tikemia."
        : "Publiez d’abord un événement à venir avant de pouvoir l’ajouter à votre formule Premium."
      : "Souscrivez à une formule Premium pour mettre vos événements en priorité et suivre leurs performances.");

  const resolvedActionLabel =
    actionLabel ??
    (hasSubscription
      ? hasEligibleEvents
        ? "Promouvoir un événement"
        : "Voir mes événements"
      : "Découvrir les formules");

  const resolvedSecondaryActionLabel =
    secondaryActionLabel ??
    (hasSubscription
      ? "Gérer mon abonnement"
      : "En savoir plus");

  return (
    <section
      aria-labelledby="promotion-empty-state-title"
      className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071015] shadow-[0_22px_70px_rgba(0,0,0,0.3)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-orange-500/[0.055]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/[0.055] blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-orange-500/[0.045] blur-3xl"
      />

      <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center lg:p-9">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-lime-400">
            <Crown className="h-3.5 w-3.5" />
            Visibilité Premium
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-lime-400 shadow-[0_14px_35px_rgba(34,197,94,0.12)]">
              {hasSubscription ? (
                <Zap className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>

            <div className="min-w-0">
              <h2
                id="promotion-empty-state-title"
                className="text-xl font-black tracking-[-0.035em] text-white sm:text-2xl lg:text-3xl"
              >
                {resolvedTitle}
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500 sm:text-[15px] sm:leading-7">
                {resolvedDescription}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4" />
                {resolvedActionLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {onSecondaryAction && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.99]"
              >
                <ShieldCheck className="h-4 w-4" />
                {resolvedSecondaryActionLabel}
              </button>
            )}
          </div>

          {!hasSubscription && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.055] p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-400">
                <BadgeCheck className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs font-black text-blue-200">
                  Badge bleu permanent
                </p>

                <p className="mt-1 text-[11px] leading-5 text-blue-200/60">
                  Il est attribué après votre premier abonnement payé et reste visible même après l’expiration de la formule.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Benefit
            icon={TrendingUp}
            title="Priorité d’affichage"
            description="Vos événements remontent dans les premières positions de la page d’accueil."
          />

          <Benefit
            icon={BarChart3}
            title="Suivi des performances"
            description="Analysez les impressions, les clics, les ventes et les revenus attribués."
          />

          <Benefit
            icon={BadgeCheck}
            title="Crédibilité renforcée"
            description="Le badge bleu valorise durablement votre profil organisateur."
          />

          <Benefit
            icon={CalendarDays}
            title="Gestion flexible"
            description="Choisissez, remplacez, mettez en pause ou réactivez vos événements promus."
          />
        </div>
      </div>

      <footer className="relative flex flex-col gap-2 border-t border-white/[0.07] bg-black/15 px-5 py-3.5 text-[10px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-9">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
          Tikemia protège vos paiements et vos données Premium.
        </span>

        <span>
          Seuls les événements publiés et non terminés sont éligibles.
        </span>
      </footer>
    </section>
  );
}

function Benefit({
  icon: Icon,
  title,
  description,
}: BenefitProps) {
  return (
    <article className="group rounded-2xl border border-white/[0.075] bg-white/[0.025] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400 transition group-hover:scale-105">
        <Icon className="h-4.5 w-4.5" />
      </div>

      <h3 className="mt-3 text-sm font-black text-white">
        {title}
      </h3>

      <p className="mt-1.5 text-[11px] leading-5 text-neutral-500">
        {description}
      </p>
    </article>
  );
}