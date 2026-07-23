"use client";

import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  CreditCard,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Zap,
} from "lucide-react";

import type { OrganizerPromotionSubscription } from "@/lib/organizer/promotions/get-organizer-promotions";

type SubscriptionStatusCardProps = {
  subscription:
    | OrganizerPromotionSubscription
    | null;
  hasBlueBadge?: boolean;
  blueBadgeGrantedAt?: string | null;
  onRenew?: () => void;
  onCancel?: () => void;
  onManageAutoRenew?: () => void;
  isProcessing?: boolean;
};

type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

type StatusConfig = {
  label: string;
  description: string;
  tone: StatusTone;
  icon: typeof BadgeCheck;
};

const statusStyles: Record<
  StatusTone,
  {
    badge: string;
    icon: string;
    panel: string;
    text: string;
  }
> = {
  success: {
    badge:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
    icon:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
    panel:
      "border-emerald-500/20 bg-emerald-500/[0.055]",
    text: "text-lime-400",
  },

  warning: {
    badge:
      "border-orange-500/25 bg-orange-500/10 text-orange-300",
    icon:
      "border-orange-500/25 bg-orange-500/10 text-orange-400",
    panel:
      "border-orange-500/20 bg-orange-500/[0.055]",
    text: "text-orange-300",
  },

  danger: {
    badge:
      "border-red-500/25 bg-red-500/10 text-red-300",
    icon:
      "border-red-500/25 bg-red-500/10 text-red-400",
    panel:
      "border-red-500/20 bg-red-500/[0.055]",
    text: "text-red-300",
  },

  info: {
    badge:
      "border-sky-500/25 bg-sky-500/10 text-sky-300",
    icon:
      "border-sky-500/25 bg-sky-500/10 text-sky-400",
    panel:
      "border-sky-500/20 bg-sky-500/[0.055]",
    text: "text-sky-300",
  },

  neutral: {
    badge:
      "border-white/[0.08] bg-white/[0.035] text-neutral-400",
    icon:
      "border-white/[0.08] bg-white/[0.035] text-neutral-400",
    panel:
      "border-white/[0.08] bg-white/[0.025]",
    text: "text-white",
  },
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Non définie";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(parsed);
}

function formatMoney(
  amount: number,
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
    ).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function getStatusConfig(
  subscription:
    | OrganizerPromotionSubscription
    | null,
): StatusConfig {
  if (!subscription) {
    return {
      label: "Aucun abonnement",
      description:
        "Souscrivez à une formule pour activer la Visibilité Premium.",
      tone: "neutral",
      icon: Sparkles,
    };
  }

  switch (subscription.status) {
    case "ACTIVE":
      return {
        label: "Actif",
        description:
          "Votre formule Premium est active et utilisable.",
        tone: "success",
        icon: BadgeCheck,
      };

    case "PENDING":
      return {
        label: "En attente",
        description:
          "L’activation sera effectuée après confirmation du paiement.",
        tone: "info",
        icon: Clock3,
      };

    case "PAST_DUE":
      return {
        label: "Paiement requis",
        description:
          "Un paiement est en attente pour maintenir votre formule.",
        tone: "warning",
        icon: CreditCard,
      };

    case "PAUSED":
      return {
        label: "Suspendu",
        description:
          "Votre abonnement est temporairement suspendu.",
        tone: "warning",
        icon: CircleAlert,
      };

    case "CANCELLED":
      return {
        label: "Résilié",
        description:
          "Votre abonnement a été résilié.",
        tone: "danger",
        icon: TimerReset,
      };

    case "EXPIRED":
      return {
        label: "Expiré",
        description:
          "Votre formule est arrivée à expiration.",
        tone: "danger",
        icon: CalendarClock,
      };

    default:
      return {
        label: subscription.status,
        description:
          "Statut de l’abonnement Premium.",
        tone: "neutral",
        icon: ShieldCheck,
      };
  }
}

function getProgressWidth(
  subscription: OrganizerPromotionSubscription,
): number {
  const maximum =
    subscription.plan.maxBoostedEvents;

  if (maximum <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(
      subscription.usage
        .usagePercentage,
      0,
    ),
    100,
  );
}

export default function SubscriptionStatusCard({
  subscription,
  hasBlueBadge = false,
  blueBadgeGrantedAt = null,
  onRenew,
  onCancel,
  onManageAutoRenew,
  isProcessing = false,
}: SubscriptionStatusCardProps) {
  const status =
    getStatusConfig(subscription);

  const StatusIcon =
    status.icon;

  const styles =
    statusStyles[status.tone];

  if (!subscription) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.28)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-orange-500/[0.04]" />

        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-neutral-400">
              <Sparkles className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black tracking-[-0.025em] text-white">
                  Aucun abonnement actif
                </h2>

                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-neutral-500">
                  Visibilité Premium
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                Choisissez une formule pour faire apparaître vos événements parmi les premiers résultats Tikemia.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <EmptyBenefit
              icon={Zap}
              title="Priorité d’affichage"
              description="Vos événements remontent dans les premières positions."
            />

            <EmptyBenefit
              icon={BadgeCheck}
              title="Badge bleu permanent"
              description="Le badge reste acquis après votre premier abonnement payé."
            />

            <EmptyBenefit
              icon={CircleDollarSign}
              title="Performance mesurable"
              description="Suivez les clics, ventes et revenus attribués."
            />
          </div>
        </div>
      </section>
    );
  }

  const progressWidth =
    getProgressWidth(subscription);

  const canRenew =
    subscription.status ===
      "EXPIRED" ||
    subscription.status ===
      "CANCELLED" ||
    subscription.status ===
      "PAST_DUE" ||
    subscription.isExpiringSoon;

  const canCancel =
    subscription.status ===
      "ACTIVE" ||
    subscription.status ===
      "PAST_DUE" ||
    subscription.status ===
      "PAUSED";

  return (
    <section
      aria-labelledby="subscription-status-title"
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-[0_20px_55px_rgba(0,0,0,0.28)] sm:p-6 ${styles.panel}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.035] via-transparent to-transparent" />

      <div className="relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${styles.icon}`}
              >
                <StatusIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="subscription-status-title"
                    className="truncate text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
                  >
                    {subscription.plan.name}
                  </h2>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${styles.badge}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                  {status.description}
                </p>

                {subscription.plan.description && (
                  <p className="mt-1.5 max-w-2xl text-xs leading-5 text-neutral-600">
                    {subscription.plan.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 lg:items-end">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
              Prix de la formule
            </p>

            <p
              className={`text-2xl font-black tracking-[-0.035em] ${styles.text}`}
            >
              {formatMoney(
                subscription.plan.price,
                subscription.plan.currency,
              )}
            </p>

            <p className="text-xs text-neutral-500">
              {subscription.plan.billingPeriodLabel}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoBlock
            icon={CalendarDays}
            label="Début"
            value={formatDate(
              subscription.startsAt,
            )}
          />

          <InfoBlock
            icon={CalendarClock}
            label="Expiration"
            value={formatDate(
              subscription.endsAt,
            )}
            emphasis={
              subscription.isExpiringSoon ||
              subscription.isExpired
            }
          />

          <InfoBlock
            icon={Zap}
            label="Événements inclus"
            value={`${subscription.usage.activeBoosts} / ${subscription.plan.maxBoostedEvents}`}
          />

          <InfoBlock
            icon={RefreshCcw}
            label="Renouvellement"
            value={
              subscription.autoRenew
                ? "Automatique"
                : "Manuel"
            }
            emphasis={
              subscription.autoRenew
            }
          />
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-white">
                Utilisation des emplacements
              </p>

              <p className="mt-1 text-[11px] text-neutral-500">
                {subscription.usage.remainingBoostSlots} emplacement
                {subscription.usage.remainingBoostSlots > 1
                  ? "s"
                  : ""}{" "}
                restant
                {subscription.usage.remainingBoostSlots > 1
                  ? "s"
                  : ""}
                .
              </p>
            </div>

            <span className="text-xs font-black text-lime-400">
              {subscription.usage.usagePercentage} %
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 transition-[width] duration-500"
              style={{
                width: `${progressWidth}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.055] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-400">
                <BadgeCheck className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs font-black text-blue-200">
                  Badge bleu organisateur
                </p>

                <p className="mt-1 text-[11px] leading-5 text-blue-200/60">
                  {hasBlueBadge
                    ? `Badge permanent attribué${
                        blueBadgeGrantedAt
                          ? ` le ${formatDate(
                              blueBadgeGrantedAt,
                            )}`
                          : ""
                      }.`
                    : "Le badge sera attribué définitivement après le premier paiement confirmé."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            {onManageAutoRenew && (
              <button
                type="button"
                onClick={onManageAutoRenew}
                disabled={isProcessing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Gérer le renouvellement
              </button>
            )}

            {canRenew && onRenew && (
              <button
                type="button"
                onClick={onRenew}
                disabled={isProcessing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                Renouveler
              </button>
            )}

            {canCancel && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isProcessing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <TimerReset className="h-4 w-4" />
                Résilier
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3.5">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          emphasis
            ? "border-orange-500/25 bg-orange-500/10 text-orange-400"
            : "border-white/[0.07] bg-white/[0.035] text-neutral-500"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-sm font-black ${
            emphasis
              ? "text-orange-300"
              : "text-white"
          }`}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyBenefit({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Zap;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-3 text-xs font-black text-white">
        {title}
      </p>

      <p className="mt-1.5 text-[11px] leading-5 text-neutral-500">
        {description}
      </p>
    </div>
  );
}