import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Megaphone,
  ReceiptText,
  RotateCcw,
  TicketCheck,
  WalletCards,
} from "lucide-react";

import {
  getCurrencyDefinition,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
  groupMoneyByCurrency,
} from "@/lib/localization/format-money";
import type { DashboardActivity } from "@/lib/organizer/get-organizer-dashboard";

type RecentActivitiesProps = {
  activities: DashboardActivity[];
};

type ActivityStyle = {
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  iconWrapper: string;
  iconColor: string;
  badge: string;
};

const activityStyles: Record<
  DashboardActivity["type"],
  ActivityStyle
> = {
  EVENT_CREATED: {
    label: "Événement créé",
    icon: CalendarPlus,
    iconWrapper:
      "border-sky-500/25 bg-sky-500/10",
    iconColor: "text-sky-400",
    badge:
      "border-sky-500/20 bg-sky-500/[0.07] text-sky-400",
  },

  EVENT_PUBLISHED: {
    label: "Événement publié",
    icon: Megaphone,
    iconWrapper:
      "border-emerald-500/25 bg-emerald-500/10",
    iconColor: "text-lime-400",
    badge:
      "border-emerald-500/20 bg-emerald-500/[0.07] text-lime-400",
  },

  ORDER_PAID: {
    label: "Commande payée",
    icon: ReceiptText,
    iconWrapper:
      "border-violet-500/25 bg-violet-500/10",
    iconColor: "text-violet-400",
    badge:
      "border-violet-500/20 bg-violet-500/[0.07] text-violet-400",
  },

  TICKET_SOLD: {
    label: "Billet vendu",
    icon: TicketCheck,
    iconWrapper:
      "border-orange-500/25 bg-orange-500/10",
    iconColor: "text-orange-400",
    badge:
      "border-orange-500/20 bg-orange-500/[0.07] text-orange-400",
  },

  PAYMENT_RECEIVED: {
    label: "Paiement reçu",
    icon: CreditCard,
    iconWrapper:
      "border-emerald-500/25 bg-emerald-500/10",
    iconColor: "text-lime-400",
    badge:
      "border-emerald-500/20 bg-emerald-500/[0.07] text-lime-400",
  },

  PAYOUT_REQUESTED: {
    label: "Retrait demandé",
    icon: WalletCards,
    iconWrapper:
      "border-amber-500/25 bg-amber-500/10",
    iconColor: "text-amber-400",
    badge:
      "border-amber-500/20 bg-amber-500/[0.07] text-amber-400",
  },

  PAYOUT_PAID: {
    label: "Retrait payé",
    icon: Banknote,
    iconWrapper:
      "border-emerald-500/25 bg-emerald-500/10",
    iconColor: "text-lime-400",
    badge:
      "border-emerald-500/20 bg-emerald-500/[0.07] text-lime-400",
  },

  REFUND_COMPLETED: {
    label: "Remboursement effectué",
    icon: RotateCcw,
    iconWrapper:
      "border-red-500/25 bg-red-500/10",
    iconColor: "text-red-400",
    badge:
      "border-red-500/20 bg-red-500/[0.07] text-red-400",
  },
};

function formatActivityDate(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date indisponible";
  }

  const now = new Date();
  const difference = now.getTime() - parsedDate.getTime();

  const seconds = Math.floor(difference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds >= 0 && seconds < 60) {
    return "À l’instant";
  }

  if (minutes >= 1 && minutes < 60) {
    return `Il y a ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }

  if (hours >= 1 && hours < 24) {
    return `Il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  }

  if (days === 1) {
    return "Hier";
  }

  if (days > 1 && days < 7) {
    return `Il y a ${days} jours`;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

export default function RecentActivities({
  activities,
}: RecentActivitiesProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-lime-400" />

            <h2 className="text-lg font-black tracking-[-0.02em] text-white">
              Activités récentes
            </h2>
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Dernières actions enregistrées dans votre espace organisateur.
          </p>
        </div>

        <Link
          href="/organizer/activities"
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.05] hover:text-white"
        >
          Voir toute l’activité
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {activities.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {activities.map((activity) => {
            const style = activityStyles[activity.type];
            const Icon = style.icon;

            return (
              <article
                key={activity.id}
                className="group flex gap-3 px-4 py-4 transition hover:bg-white/[0.018] sm:gap-4 sm:px-5"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${style.iconWrapper}`}
                >
                  <Icon
                    className={`h-[19px] w-[19px] ${style.iconColor}`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${style.badge}`}
                        >
                          {style.label}
                        </span>

                        <span className="text-[11px] text-neutral-600">
                          {formatActivityDate(activity.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-black leading-5 text-white">
                        {activity.title}
                      </h3>

                      {activity.description && (
                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                          {activity.description}
                        </p>
                      )}

                      {activity.event && (
                        <Link
                          href={`/organizer/events/${activity.event.id}`}
                          className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-neutral-400 transition hover:text-lime-400"
                        >
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0" />

                          <span className="truncate">
                            {activity.event.title}
                          </span>
                        </Link>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      {activity.amount !== null &&
                      activity.currency ? (
                        <div className="sm:text-right">
                          <p className="text-[11px] text-neutral-600">
                            Montant
                          </p>

                          <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                            <p
                              className={`text-sm font-black ${
                                activity.type === "REFUND_COMPLETED"
                                  ? "text-red-400"
                                  : activity.type ===
                                      "PAYOUT_REQUESTED"
                                    ? "text-amber-400"
                                    : "text-lime-400"
                              }`}
                            >
                              {activity.type === "REFUND_COMPLETED"
                                ? "-"
                                : ""}
                              {formatMoney({
                                amount:
                                  activity.amount,

                                currency:
                                  activity.currency,
                              })}
                            </p>

                            <CurrencyBadge
                              currency={
                                activity.currency
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-700">
                          Aucune valeur
                        </span>
                      )}

                      {activity.event && (
                        <Link
                          href={`/organizer/events/${activity.event.id}`}
                          aria-label={`Ouvrir ${activity.event.title}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-600 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-lime-400"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-10 sm:px-5">
          <div className="mx-auto max-w-[430px] rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.015] px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-lime-400" />
            </div>

            <h3 className="mt-4 text-base font-black text-white">
              Aucune activité enregistrée
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Les créations d’événements, ventes, paiements, remboursements et retraits apparaîtront automatiquement ici.
            </p>

            <Link
              href="/organizer/events/create"
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01]"
            >
              Créer un événement
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {activities.length > 0 && (
        <>
          <FinancialActivityTotals
            activities={activities}
          />

          <footer className="grid border-t border-white/[0.07] sm:grid-cols-3">
            <ActivityMetric
              label="Activités affichées"
              value={activities.length.toLocaleString(
                "fr-FR",
              )}
              icon={CheckCircle2}
            />

            <ActivityMetric
              label="Ventes et paiements"
              value={activities
                .filter((activity) =>
                  [
                    "ORDER_PAID",
                    "TICKET_SOLD",
                    "PAYMENT_RECEIVED",
                  ].includes(
                    activity.type,
                  ),
                )
                .length.toLocaleString(
                  "fr-FR",
                )}
              icon={CircleDollarSign}
              emphasis
            />

            <ActivityMetric
              label="Événements concernés"
              value={new Set(
                activities
                  .map(
                    (activity) =>
                      activity.event?.id,
                  )
                  .filter(Boolean),
              ).size.toLocaleString(
                "fr-FR",
              )}
              icon={CalendarPlus}
            />
          </footer>
        </>
      )}
    </section>
  );
}

function CurrencyBadge({
  currency,
}: {
  currency: SupportedCurrencyCode;
}) {
  const definition =
    getCurrencyDefinition(
      currency,
    );

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-2 py-0.5 text-[10px] font-black text-orange-300">
      <span>
        {currency}
      </span>

      <span className="font-normal opacity-70">
        {definition?.symbol ??
          currency}
      </span>
    </span>
  );
}

function FinancialActivityTotals({
  activities,
}: {
  activities: DashboardActivity[];
}) {
  const financialActivities =
    activities.filter(
      (
        activity,
      ): activity is DashboardActivity & {
        amount: number;
        currency: SupportedCurrencyCode;
      } =>
        activity.amount !== null &&
        activity.currency !== null,
    );

  const incomingTotals =
    groupMoneyByCurrency(
      financialActivities
        .filter((activity) =>
          [
            "ORDER_PAID",
            "TICKET_SOLD",
            "PAYMENT_RECEIVED",
          ].includes(
            activity.type,
          ),
        )
        .map((activity) => ({
          amount:
            activity.amount,

          currency:
            activity.currency,
        })),
    );

  const outgoingTotals =
    groupMoneyByCurrency(
      financialActivities
        .filter((activity) =>
          [
            "PAYOUT_REQUESTED",
            "PAYOUT_PAID",
            "REFUND_COMPLETED",
          ].includes(
            activity.type,
          ),
        )
        .map((activity) => ({
          amount:
            activity.amount,

          currency:
            activity.currency,
        })),
    );

  if (
    incomingTotals.length === 0 &&
    outgoingTotals.length === 0
  ) {
    return null;
  }

  return (
    <section className="border-t border-white/[0.07] bg-white/[0.012] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-white">
            Montants des activités
          </p>

          <p className="mt-1 text-[11px] leading-5 text-neutral-600">
            Les entrées et sorties restent séparées par devise. Aucun montant de monnaies différentes n’est additionné.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
          <ActivityTotalsGroup
            title="Entrées"
            totals={incomingTotals}
            tone="green"
          />

          <ActivityTotalsGroup
            title="Sorties"
            totals={outgoingTotals}
            tone="orange"
          />
        </div>
      </div>
    </section>
  );
}

function ActivityTotalsGroup({
  title,
  totals,
  tone,
}: {
  title: string;
  totals: ReturnType<
    typeof groupMoneyByCurrency
  >;
  tone: "green" | "orange";
}) {
  const toneClasses =
    tone === "green"
      ? {
          wrapper:
            "border-emerald-500/15 bg-emerald-500/[0.035]",
          label:
            "text-lime-400",
        }
      : {
          wrapper:
            "border-orange-500/15 bg-orange-500/[0.035]",
          label:
            "text-orange-400",
        };

  return (
    <div
      className={`rounded-xl border p-3.5 ${toneClasses.wrapper}`}
    >
      <p
        className={`text-[11px] font-black uppercase tracking-[0.12em] ${toneClasses.label}`}
      >
        {title}
      </p>

      {totals.length > 0 ? (
        <div className="mt-3 space-y-2">
          {totals.map(
            (total) => (
              <div
                key={
                  total.currency
                }
                className="flex items-center justify-between gap-3"
              >
                <CurrencyBadge
                  currency={
                    total.currency
                  }
                />

                <span className="min-w-0 truncate text-xs font-black text-white">
                  {
                    total.formatted
                  }
                </span>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-600">
          Aucun montant
        </p>
      )}
    </div>
  );
}

type ActivityMetricProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  emphasis?: boolean;
};

function ActivityMetric({
  label,
  value,
  icon: Icon,
  emphasis = false,
}: ActivityMetricProps) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          emphasis
            ? "border-emerald-500/25 bg-emerald-500/10"
            : "border-white/[0.08] bg-white/[0.03]"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            emphasis ? "text-lime-400" : "text-neutral-500"
          }`}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-sm font-black ${
            emphasis ? "text-lime-400" : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}