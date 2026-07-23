"use client";

import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  Eye,
  MousePointerClick,
  Sparkles,
  Target,
  TicketCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

import type {
  GetOrganizerPromotionsResult,
  OrganizerPromotionSubscription,
} from "@/lib/organizer/promotions/get-organizer-promotions";

type PromotionSummaryProps = {
  summary: GetOrganizerPromotionsResult["summary"];
  currentSubscription:
    | OrganizerPromotionSubscription
    | null;
  currency?: string;
};

type SummaryCardProps = {
  label: string;
  value: string;
  description: string;
  icon: typeof Sparkles;
  tone:
    | "emerald"
    | "lime"
    | "orange"
    | "sky"
    | "violet"
    | "neutral";
  badge?: string;
};

const toneStyles = {
  emerald: {
    card:
      "border-emerald-500/20 bg-emerald-500/[0.055]",
    icon:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    value: "text-emerald-300",
    glow:
      "from-emerald-500/[0.13] via-transparent to-transparent",
  },

  lime: {
    card:
      "border-lime-500/20 bg-lime-500/[0.055]",
    icon:
      "border-lime-500/25 bg-lime-500/10 text-lime-400",
    value: "text-lime-300",
    glow:
      "from-lime-500/[0.13] via-transparent to-transparent",
  },

  orange: {
    card:
      "border-orange-500/20 bg-orange-500/[0.055]",
    icon:
      "border-orange-500/25 bg-orange-500/10 text-orange-400",
    value: "text-orange-300",
    glow:
      "from-orange-500/[0.13] via-transparent to-transparent",
  },

  sky: {
    card:
      "border-sky-500/20 bg-sky-500/[0.055]",
    icon:
      "border-sky-500/25 bg-sky-500/10 text-sky-400",
    value: "text-sky-300",
    glow:
      "from-sky-500/[0.13] via-transparent to-transparent",
  },

  violet: {
    card:
      "border-violet-500/20 bg-violet-500/[0.055]",
    icon:
      "border-violet-500/25 bg-violet-500/10 text-violet-400",
    value: "text-violet-300",
    glow:
      "from-violet-500/[0.13] via-transparent to-transparent",
  },

  neutral: {
    card:
      "border-white/[0.08] bg-white/[0.025]",
    icon:
      "border-white/[0.08] bg-white/[0.04] text-neutral-400",
    value: "text-white",
    glow:
      "from-white/[0.06] via-transparent to-transparent",
  },
} as const;

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

function formatPercentage(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ? 0 : 2,
      },
    ).format(value);
  } catch {
    return `${formatInteger(
      value,
    )} ${currency}`;
  }
}

function getSubscriptionStatusLabel(
  subscription:
    | OrganizerPromotionSubscription
    | null,
): string {
  if (!subscription) {
    return "Aucun abonnement";
  }

  switch (subscription.status) {
    case "ACTIVE":
      return "Abonnement actif";

    case "PAST_DUE":
      return "Paiement en attente";

    case "PAUSED":
      return "Abonnement suspendu";

    case "CANCELLED":
      return "Abonnement résilié";

    case "EXPIRED":
      return "Abonnement expiré";

    case "PENDING":
      return "Activation en attente";

    default:
      return subscription.status;
  }
}

function getSubscriptionDescription(
  subscription:
    | OrganizerPromotionSubscription
    | null,
): string {
  if (!subscription) {
    return "Choisissez une formule pour commencer à promouvoir vos événements.";
  }

  if (subscription.isExpired) {
    return "Votre formule est arrivée à expiration.";
  }

  if (
    subscription.remainingDays !==
    null
  ) {
    return `${subscription.remainingDays} jour${
      subscription.remainingDays > 1
        ? "s"
        : ""
    } restant${
      subscription.remainingDays > 1
        ? "s"
        : ""
    }.`;
  }

  return "Formule active sans date d’expiration définie.";
}

export default function PromotionSummary({
  summary,
  currentSubscription,
  currency = "XOF",
}: PromotionSummaryProps) {
  const normalizedCurrency =
    currency.trim().toUpperCase() ||
    "XOF";

  const subscriptionBadge =
    currentSubscription
      ? currentSubscription.plan.name
      : undefined;

  return (
    <section
      aria-labelledby="promotion-summary-title"
      className="w-full"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <TrendingUp className="h-4.5 w-4.5 text-lime-400" />
            </div>

            <div>
              <h2
                id="promotion-summary-title"
                className="text-base font-black tracking-[-0.02em] text-white sm:text-lg"
              >
                Vue d’ensemble Premium
              </h2>

              <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                Suivez votre abonnement, vos promotions et leurs performances.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black ${
            summary.hasActiveSubscription
              ? "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
              : "border-white/[0.08] bg-white/[0.035] text-neutral-400"
          }`}
        >
          {summary.hasActiveSubscription ? (
            <BadgeCheck className="h-3.5 w-3.5" />
          ) : (
            <CalendarClock className="h-3.5 w-3.5" />
          )}

          {getSubscriptionStatusLabel(
            currentSubscription,
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Formule actuelle"
          value={
            currentSubscription
              ? currentSubscription.plan
                  .name
              : "Aucune"
          }
          description={getSubscriptionDescription(
            currentSubscription,
          )}
          icon={Sparkles}
          tone={
            summary.hasActiveSubscription
              ? "emerald"
              : "neutral"
          }
          badge={subscriptionBadge}
        />

        <SummaryCard
          label="Événements promus"
          value={formatInteger(
            summary.promotedEvents,
          )}
          description={`${formatInteger(
            summary.activeBoosts,
          )} actif${
            summary.activeBoosts > 1
              ? "s"
              : ""
          }, ${formatInteger(
            summary.scheduledBoosts,
          )} programmé${
            summary.scheduledBoosts > 1
              ? "s"
              : ""
          }.`}
          icon={Zap}
          tone="lime"
        />

        <SummaryCard
          label="Places disponibles"
          value={formatInteger(
            summary.remainingBoostSlots,
          )}
          description={
            currentSubscription
              ? `Sur ${formatInteger(
                  currentSubscription.plan
                    .maxBoostedEvents,
                )} emplacement${
                  currentSubscription.plan
                    .maxBoostedEvents > 1
                    ? "s"
                    : ""
                } inclus.`
              : "Souscrivez à une formule pour obtenir des emplacements."
          }
          icon={Target}
          tone="orange"
        />

        <SummaryCard
          label="Revenus attribués"
          value={formatMoney(
            summary.totalRevenue,
            normalizedCurrency,
          )}
          description={`${formatInteger(
            summary.totalOrders,
          )} commande${
            summary.totalOrders > 1
              ? "s"
              : ""
          } issue${
            summary.totalOrders > 1
              ? "s"
              : ""
          } des promotions.`}
          icon={CircleDollarSign}
          tone="sky"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniMetric
          label="Impressions"
          value={formatInteger(
            summary.totalImpressions,
          )}
          icon={Eye}
        />

        <MiniMetric
          label="Clics"
          value={formatInteger(
            summary.totalClicks,
          )}
          icon={MousePointerClick}
        />

        <MiniMetric
          label="Billets"
          value={formatInteger(
            summary.totalTickets,
          )}
          icon={TicketCheck}
        />

        <MiniMetric
          label="Conversion"
          value={`${formatPercentage(
            summary.conversionRate,
          )} %`}
          icon={TrendingUp}
          emphasis
        />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  badge,
}: SummaryCardProps) {
  const styles =
    toneStyles[tone];

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.13] sm:p-5 ${styles.card}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 ${styles.glow}`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>

          {badge && (
            <span className="max-w-[120px] truncate rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-400">
              {badge}
            </span>
          )}
        </div>

        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.11em] text-neutral-500">
          {label}
        </p>

        <p
          className={`mt-1.5 truncate text-xl font-black tracking-[-0.035em] sm:text-2xl ${styles.value}`}
          title={value}
        >
          {value}
        </p>

        <p className="mt-2 min-h-10 text-[11px] leading-5 text-neutral-500">
          {description}
        </p>
      </div>
    </article>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  icon: typeof Eye;
  emphasis?: boolean;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.022] p-3.5 transition hover:border-white/[0.11] hover:bg-white/[0.035]">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          emphasis
            ? "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
            : "border-white/[0.07] bg-white/[0.035] text-neutral-500"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-sm font-black ${
            emphasis
              ? "text-lime-400"
              : "text-white"
          }`}
          title={value}
        >
          {value}
        </p>
      </div>
    </article>
  );
}