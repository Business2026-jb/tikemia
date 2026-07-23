"use client";

import {
  BadgeCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Crown,
  Gem,
  ShieldCheck,
  Sparkles,
  Star,
  TicketCheck,
  Zap,
} from "lucide-react";

import type { OrganizerSubscriptionPlan } from "@/lib/organizer/promotions/get-subscription-plans";

type SubscriptionPlanCardProps = {
  plan: OrganizerSubscriptionPlan;
  isCurrentPlan?: boolean;
  isRecommended?: boolean;
  isPopular?: boolean;
  isProcessing?: boolean;
  disabled?: boolean;
  onSelect?: (
    plan: OrganizerSubscriptionPlan,
  ) => void;
};

type PlanTone =
  | "emerald"
  | "orange"
  | "violet"
  | "sky"
  | "neutral";

type PlanToneStyle = {
  card: string;
  glow: string;
  icon: string;
  price: string;
  badge: string;
  button: string;
  check: string;
};

const toneStyles: Record<
  PlanTone,
  PlanToneStyle
> = {
  emerald: {
    card:
      "border-emerald-500/25 bg-emerald-500/[0.045]",
    glow:
      "from-emerald-500/[0.16] via-transparent to-transparent",
    icon:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
    price: "text-lime-400",
    badge:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
    button:
      "bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-white shadow-[0_12px_35px_rgba(34,197,94,0.18)] hover:scale-[1.01]",
    check:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
  },

  orange: {
    card:
      "border-orange-500/25 bg-orange-500/[0.045]",
    glow:
      "from-orange-500/[0.16] via-transparent to-transparent",
    icon:
      "border-orange-500/25 bg-orange-500/10 text-orange-400",
    price: "text-orange-300",
    badge:
      "border-orange-500/25 bg-orange-500/10 text-orange-300",
    button:
      "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-black shadow-[0_12px_35px_rgba(249,115,22,0.18)] hover:scale-[1.01]",
    check:
      "border-orange-500/25 bg-orange-500/10 text-orange-400",
  },

  violet: {
    card:
      "border-violet-500/25 bg-violet-500/[0.045]",
    glow:
      "from-violet-500/[0.16] via-transparent to-transparent",
    icon:
      "border-violet-500/25 bg-violet-500/10 text-violet-400",
    price: "text-violet-300",
    badge:
      "border-violet-500/25 bg-violet-500/10 text-violet-300",
    button:
      "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_12px_35px_rgba(139,92,246,0.18)] hover:scale-[1.01]",
    check:
      "border-violet-500/25 bg-violet-500/10 text-violet-400",
  },

  sky: {
    card:
      "border-sky-500/25 bg-sky-500/[0.045]",
    glow:
      "from-sky-500/[0.16] via-transparent to-transparent",
    icon:
      "border-sky-500/25 bg-sky-500/10 text-sky-400",
    price: "text-sky-300",
    badge:
      "border-sky-500/25 bg-sky-500/10 text-sky-300",
    button:
      "bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 text-white shadow-[0_12px_35px_rgba(14,165,233,0.18)] hover:scale-[1.01]",
    check:
      "border-sky-500/25 bg-sky-500/10 text-sky-400",
  },

  neutral: {
    card:
      "border-white/[0.08] bg-white/[0.025]",
    glow:
      "from-white/[0.06] via-transparent to-transparent",
    icon:
      "border-white/[0.08] bg-white/[0.04] text-neutral-400",
    price: "text-white",
    badge:
      "border-white/[0.08] bg-white/[0.04] text-neutral-400",
    button:
      "border border-white/[0.1] bg-white/[0.045] text-white hover:bg-white/[0.07]",
    check:
      "border-white/[0.08] bg-white/[0.04] text-neutral-400",
  },
};

function getPlanTone(
  plan: OrganizerSubscriptionPlan,
  isRecommended: boolean,
  isPopular: boolean,
): PlanTone {
  if (isRecommended) {
    return "emerald";
  }

  if (isPopular) {
    return "orange";
  }

  const normalizedCode =
    plan.code.trim().toUpperCase();

  if (
    normalizedCode.includes("PREMIUM") ||
    normalizedCode.includes("PRO")
  ) {
    return "violet";
  }

  if (
    normalizedCode.includes("START") ||
    normalizedCode.includes("ESSENT")
  ) {
    return "sky";
  }

  return "neutral";
}

function getBillingSuffix(
  plan: OrganizerSubscriptionPlan,
): string {
  switch (plan.billingPeriod) {
    case "ONE_TIME":
      return "paiement unique";

    case "MONTHLY":
      return "par mois";

    case "QUARTERLY":
      return "par trimestre";

    case "YEARLY":
      return "par an";

    default:
      return plan.billingPeriodLabel;
  }
}

function formatInteger(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function getActionLabel({
  isCurrentPlan,
  isProcessing,
}: {
  isCurrentPlan: boolean;
  isProcessing: boolean;
}): string {
  if (isProcessing) {
    return "Traitement...";
  }

  if (isCurrentPlan) {
    return "Formule actuelle";
  }

  return "Choisir cette formule";
}

export default function SubscriptionPlanCard({
  plan,
  isCurrentPlan = false,
  isRecommended = false,
  isPopular = false,
  isProcessing = false,
  disabled = false,
  onSelect,
}: SubscriptionPlanCardProps) {
  const tone =
    getPlanTone(
      plan,
      isRecommended,
      isPopular,
    );

  const styles =
    toneStyles[tone];

  const isDisabled =
    disabled ||
    isProcessing ||
    isCurrentPlan ||
    !plan.isActive ||
    !plan.isPublic;

  const visibleFeatures =
    plan.features.filter(
      (feature) =>
        feature.included,
    );

  function handleSelect() {
    if (
      isDisabled ||
      !onSelect
    ) {
      return;
    }

    onSelect(plan);
  }

  return (
    <article
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-[0_20px_55px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] sm:p-6 ${styles.card}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 ${styles.glow}`}
      />

      {(isRecommended ||
        isPopular ||
        isCurrentPlan) && (
        <div className="absolute right-4 top-4 z-10 flex flex-wrap justify-end gap-2">
          {isCurrentPlan && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-300">
              <BadgeCheck className="h-3 w-3" />
              Actuelle
            </span>
          )}

          {isRecommended && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-lime-400">
              <Crown className="h-3 w-3" />
              Recommandée
            </span>
          )}

          {!isRecommended &&
            isPopular && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-orange-300">
                <Star className="h-3 w-3" />
                Populaire
              </span>
            )}
        </div>
      )}

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 pr-20">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${styles.icon}`}
          >
            {isRecommended ? (
              <Crown className="h-5 w-5" />
            ) : isPopular ? (
              <Star className="h-5 w-5" />
            ) : plan.priorityScore >= 500 ? (
              <Gem className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.11em] text-neutral-600">
            Formule Premium
          </p>

          <h3 className="mt-1.5 text-xl font-black tracking-[-0.035em] text-white sm:text-2xl">
            {plan.name}
          </h3>

          <p className="mt-2 min-h-12 text-sm leading-6 text-neutral-500">
            {plan.description ??
              "Une formule conçue pour augmenter la visibilité de vos événements sur Tikemia."}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span
              className={`text-3xl font-black tracking-[-0.045em] sm:text-4xl ${styles.price}`}
            >
              {plan.formattedPrice}
            </span>

            <span className="pb-1 text-xs font-bold text-neutral-500">
              {getBillingSuffix(
                plan,
              )}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] ${styles.badge}`}
            >
              <CalendarDays className="h-3 w-3" />
              {formatInteger(
                plan.durationDays,
              )}{" "}
              jours
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] text-neutral-400">
              <Zap className="h-3 w-3" />
              Priorité{" "}
              {formatInteger(
                plan.priorityScore,
              )}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetricBlock
            icon={TicketCheck}
            label="Événements promus"
            value={formatInteger(
              plan.maxBoostedEvents,
            )}
          />

          <MetricBlock
            icon={Clock3}
            label="Durée"
            value={`${formatInteger(
              plan.durationDays,
            )} jours`}
          />
        </div>

        <div className="mt-5 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black text-white">
              Avantages inclus
            </p>

            <span className="text-[10px] font-bold text-neutral-600">
              {formatInteger(
                visibleFeatures.length,
              )} avantage
              {visibleFeatures.length > 1
                ? "s"
                : ""}
            </span>
          </div>

          {visibleFeatures.length >
          0 ? (
            <ul className="mt-3 space-y-3">
              {visibleFeatures.map(
                (feature) => (
                  <li
                    key={feature.key}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${styles.check}`}
                    >
                      <Check className="h-3 w-3" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-5 text-neutral-300">
                        {feature.label}
                      </p>

                      {feature.description && (
                        <p className="mt-0.5 text-[11px] leading-5 text-neutral-600">
                          {
                            feature.description
                          }
                        </p>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

                <p className="text-[11px] leading-5 text-neutral-500">
                  Cette formule inclut la priorité d’affichage, le suivi des performances et la protection Tikemia.
                </p>
              </div>
            </div>
          )}
        </div>

        {!plan.isActive ||
        !plan.isPublic ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.055] p-3.5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />

            <p className="text-[11px] leading-5 text-orange-200/70">
              Cette formule est momentanément indisponible.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSelect}
          disabled={isDisabled}
          aria-label={`${getActionLabel(
            {
              isCurrentPlan,
              isProcessing,
            },
          )} : ${plan.name}`}
          className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${styles.button}`}
        >
          {isProcessing ? (
            <Clock3 className="h-4 w-4 animate-spin" />
          ) : isCurrentPlan ? (
            <BadgeCheck className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}

          {getActionLabel({
            isCurrentPlan,
            isProcessing,
          })}
        </button>

        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-neutral-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            Paiement sécurisé par Tikemia
          </span>
        </div>
      </div>
    </article>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TicketCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-neutral-500">
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.08em] text-neutral-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}