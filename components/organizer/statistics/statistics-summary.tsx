"use client";

import {
  Activity,
  Banknote,
  CalendarCheck2,
  CircleDollarSign,
  CircleOff,
  Clock3,
  CreditCard,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  ShoppingCart,
  TicketCheck,
  TicketX,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type {
  ComponentType,
} from "react";

import type {
  OrganizerStatisticsData,
  StatisticsTrend,
} from "@/lib/organizer/get-organizer-statistics";

type StatisticsSummaryProps = {
  summary: OrganizerStatisticsData["summary"];
  trends: OrganizerStatisticsData["trends"];
  currency: OrganizerStatisticsData["currency"];
};

type SummaryTone =
  | "green"
  | "orange"
  | "blue"
  | "violet"
  | "red"
  | "amber"
  | "neutral";

type SummaryCardDefinition = {
  key: string;
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{
    className?: string;
  }>;
  tone: SummaryTone;
  trend?: StatisticsTrend;
  trendSuffix?: string;
  emphasized?: boolean;
};

const TONE_STYLES: Record<
  SummaryTone,
  {
    card: string;
    glow: string;
    iconBox: string;
    icon: string;
    value: string;
    accent: string;
  }
> = {
  green: {
    card:
      "border-emerald-500/20 bg-[linear-gradient(145deg,rgba(6,24,18,0.98),rgba(7,16,20,0.98))]",
    glow:
      "from-emerald-500/[0.13] via-emerald-500/[0.025] to-transparent",
    iconBox:
      "border-emerald-500/25 bg-emerald-500/10",
    icon:
      "text-emerald-300",
    value:
      "text-emerald-300",
    accent:
      "bg-emerald-400",
  },

  orange: {
    card:
      "border-orange-500/20 bg-[linear-gradient(145deg,rgba(28,15,7,0.96),rgba(7,16,20,0.98))]",
    glow:
      "from-orange-500/[0.13] via-orange-500/[0.025] to-transparent",
    iconBox:
      "border-orange-500/25 bg-orange-500/10",
    icon:
      "text-orange-300",
    value:
      "text-orange-300",
    accent:
      "bg-orange-400",
  },

  blue: {
    card:
      "border-sky-500/20 bg-[linear-gradient(145deg,rgba(5,20,29,0.97),rgba(7,16,20,0.98))]",
    glow:
      "from-sky-500/[0.13] via-sky-500/[0.025] to-transparent",
    iconBox:
      "border-sky-500/25 bg-sky-500/10",
    icon:
      "text-sky-300",
    value:
      "text-sky-300",
    accent:
      "bg-sky-400",
  },

  violet: {
    card:
      "border-violet-500/20 bg-[linear-gradient(145deg,rgba(22,13,30,0.97),rgba(7,16,20,0.98))]",
    glow:
      "from-violet-500/[0.13] via-violet-500/[0.025] to-transparent",
    iconBox:
      "border-violet-500/25 bg-violet-500/10",
    icon:
      "text-violet-300",
    value:
      "text-violet-300",
    accent:
      "bg-violet-400",
  },

  red: {
    card:
      "border-red-500/20 bg-[linear-gradient(145deg,rgba(30,10,12,0.96),rgba(7,16,20,0.98))]",
    glow:
      "from-red-500/[0.13] via-red-500/[0.025] to-transparent",
    iconBox:
      "border-red-500/25 bg-red-500/10",
    icon:
      "text-red-300",
    value:
      "text-red-300",
    accent:
      "bg-red-400",
  },

  amber: {
    card:
      "border-amber-500/20 bg-[linear-gradient(145deg,rgba(28,21,7,0.96),rgba(7,16,20,0.98))]",
    glow:
      "from-amber-500/[0.13] via-amber-500/[0.025] to-transparent",
    iconBox:
      "border-amber-500/25 bg-amber-500/10",
    icon:
      "text-amber-300",
    value:
      "text-amber-300",
    accent:
      "bg-amber-400",
  },

  neutral: {
    card:
      "border-white/[0.075] bg-[linear-gradient(145deg,rgba(10,20,25,0.98),rgba(7,16,20,0.98))]",
    glow:
      "from-white/[0.055] via-white/[0.012] to-transparent",
    iconBox:
      "border-white/[0.09] bg-white/[0.035]",
    icon:
      "text-neutral-300",
    value:
      "text-white",
    accent:
      "bg-neutral-400",
  },
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" ||
        currency === "XAF"
          ? 0
          : 2,
    }).format(value);
  } catch {
    return `${formatNumber(value)} ${currency}`;
  }
}

function getTrendLabel({
  trend,
  suffix,
}: {
  trend: StatisticsTrend;
  suffix?: string;
}): string {
  if (trend.percentage === null) {
    if (trend.current > 0 && trend.previous === 0) {
      return "Nouvelle activité";
    }

    return "Aucune comparaison";
  }

  const absolutePercentage = Math.abs(
    trend.percentage,
  );

  const formattedPercentage =
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(absolutePercentage);

  if (trend.direction === "stable") {
    return `Stable${suffix ? ` ${suffix}` : ""}`;
  }

  return `${formattedPercentage} %${suffix ? ` ${suffix}` : ""}`;
}

function TrendBadge({
  trend,
  suffix,
}: {
  trend: StatisticsTrend;
  suffix?: string;
}) {
  const isPositive =
    trend.direction === "up";

  const isNegative =
    trend.direction === "down";

  const TrendIcon = isPositive
    ? TrendingUp
    : isNegative
      ? TrendingDown
      : Activity;

  return (
    <div
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        isPositive
          ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
          : isNegative
            ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
            : "border-white/[0.08] bg-white/[0.025] text-neutral-400"
      }`}
      title={`Période précédente : ${trend.previous}`}
    >
      <TrendIcon className="h-3 w-3 shrink-0" />

      <span className="truncate">
        {getTrendLabel({
          trend,
          suffix,
        })}
      </span>
    </div>
  );
}

function SummaryCard({
  card,
}: {
  card: SummaryCardDefinition;
}) {
  const styles =
    TONE_STYLES[card.tone];

  const Icon = card.icon;

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] sm:p-5 ${styles.card} ${
        card.emphasized
          ? "shadow-[0_22px_70px_rgba(16,185,129,0.075)]"
          : "shadow-[0_18px_55px_rgba(0,0,0,0.16)]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow}`}
      />

      <div
        className={`absolute inset-x-0 top-0 h-[2px] opacity-70 ${styles.accent}`}
      />

      <div className="relative flex h-full min-h-[150px] flex-col">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
              {card.title}
            </p>

            <p
              className={`mt-3 break-words text-2xl font-black leading-none tracking-tight sm:text-[28px] ${styles.value}`}
            >
              {card.value}
            </p>
          </div>

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
          >
            <Icon
              className={`h-5 w-5 ${styles.icon}`}
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-neutral-500">
          {card.description}
        </p>

        <div className="mt-auto pt-4">
          {card.trend ? (
            <TrendBadge
              trend={card.trend}
              suffix={card.trendSuffix}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-600">
              <Activity className="h-3 w-3" />
              Valeur actuelle
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function AttendanceCard({
  summary,
}: {
  summary: OrganizerStatisticsData["summary"];
}) {
  const safeRate = Math.min(
    Math.max(summary.attendanceRate, 0),
    100,
  );

  const eligibleParticipants =
    summary.checkedInParticipants +
    summary.expectedParticipants;

  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[linear-gradient(145deg,rgba(5,25,17,0.98),rgba(7,16,20,0.98))] p-4 shadow-[0_22px_70px_rgba(16,185,129,0.06)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_44%)]" />

      <div className="relative flex h-full min-h-[150px] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
              Taux de présence
            </p>

            <p className="mt-3 text-3xl font-black tracking-tight text-emerald-300">
              {formatPercentage(safeRate)}
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
            <ScanLine className="h-5 w-5 text-emerald-300" />
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-neutral-500">
          {formatNumber(summary.checkedInParticipants)} entrée
          {summary.checkedInParticipants > 1 ? "s" : ""} validée
          {summary.checkedInParticipants > 1 ? "s" : ""} sur{" "}
          {formatNumber(eligibleParticipants)} participant
          {eligibleParticipants > 1 ? "s" : ""} attendu
          {eligibleParticipants > 1 ? "s" : ""}.
        </p>

        <div className="mt-auto pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-400 transition-all duration-500"
              style={{
                width: `${safeRate}%`,
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
            <span className="text-emerald-300">
              {formatNumber(summary.checkedInParticipants)} présent
              {summary.checkedInParticipants > 1 ? "s" : ""}
            </span>

            <span className="text-orange-300">
              {formatNumber(summary.expectedParticipants)} attendu
              {summary.expectedParticipants > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function OrdersStatusBar({
  summary,
}: {
  summary: OrganizerStatisticsData["summary"];
}) {
  const statuses = [
    {
      key: "paid",
      label: "Payées",
      value: summary.paidOrders,
      className: "bg-emerald-400",
      textClassName: "text-emerald-300",
    },
    {
      key: "pending",
      label: "En attente",
      value: summary.pendingOrders,
      className: "bg-amber-400",
      textClassName: "text-amber-300",
    },
    {
      key: "failed",
      label: "Échouées",
      value: summary.failedOrders,
      className: "bg-red-400",
      textClassName: "text-red-300",
    },
    {
      key: "cancelled",
      label: "Annulées",
      value: summary.cancelledOrders,
      className: "bg-neutral-500",
      textClassName: "text-neutral-400",
    },
    {
      key: "refunded",
      label: "Remboursées",
      value: summary.refundedOrders,
      className: "bg-violet-400",
      textClassName: "text-violet-300",
    },
  ];

  const total = statuses.reduce(
    (sum, status) => sum + status.value,
    0,
  );

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035]">
              <ShoppingCart className="h-4 w-4 text-neutral-300" />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">
                Santé des commandes
              </h3>

              <p className="mt-1 text-xs text-neutral-500">
                Répartition des commandes enregistrées sur la période.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {statuses.map((status) => (
            <div
              key={status.key}
              className="flex items-center gap-2"
            >
              <span
                className={`h-2 w-2 rounded-full ${status.className}`}
              />

              <span className="text-[10px] font-semibold text-neutral-500">
                {status.label}
              </span>

              <strong
                className={`text-xs font-black ${status.textClassName}`}
              >
                {formatNumber(status.value)}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.045]">
        {total > 0 ? (
          statuses.map((status) => (
            <div
              key={status.key}
              className={`h-full ${status.className}`}
              style={{
                width: `${(status.value / total) * 100}%`,
              }}
              title={`${status.label}: ${status.value}`}
            />
          ))
        ) : (
          <div className="h-full w-full bg-white/[0.035]" />
        )}
      </div>
    </section>
  );
}

export default function StatisticsSummary({
  summary,
  trends,
  currency,
}: StatisticsSummaryProps) {
  const cards: SummaryCardDefinition[] = [
    {
      key: "grossRevenue",
      title: "Chiffre d’affaires brut",
      value: formatMoney(
        summary.grossRevenue,
        currency,
      ),
      description:
        "Montant brut généré par les commandes payées sur la période.",
      icon: CircleDollarSign,
      tone: "green",
      trend: trends.grossRevenue,
      trendSuffix: "vs période précédente",
      emphasized: true,
    },

    {
      key: "platformFees",
      title: "Commissions Tikemia",
      value: formatMoney(
        summary.platformFees,
        currency,
      ),
      description:
        "Total des frais de plateforme prélevés sur les ventes confirmées.",
      icon: ReceiptText,
      tone: "orange",
    },

    {
      key: "netRevenue",
      title: "Revenu net",
      value: formatMoney(
        summary.netRevenue,
        currency,
      ),
      description:
        "Revenu organisateur après commissions et remboursements.",
      icon: Banknote,
      tone: "green",
      trend: trends.netRevenue,
      trendSuffix: "vs période précédente",
      emphasized: true,
    },

    {
      key: "refundedRevenue",
      title: "Montant remboursé",
      value: formatMoney(
        summary.refundedRevenue,
        currency,
      ),
      description:
        "Montant total retourné aux acheteurs durant la période sélectionnée.",
      icon: RefreshCcw,
      tone: "violet",
    },

    {
      key: "ticketsSold",
      title: "Billets vendus",
      value: formatNumber(summary.ticketsSold),
      description:
        "Billets valides ou déjà utilisés issus de commandes payées.",
      icon: TicketCheck,
      tone: "orange",
      trend: trends.ticketsSold,
      trendSuffix: "vs période précédente",
    },

    {
      key: "remainingPlaces",
      title: "Places restantes",
      value: formatNumber(summary.remainingPlaces),
      description:
        "Capacité disponible restante sur l’ensemble des événements concernés.",
      icon: TicketX,
      tone: "blue",
    },

    {
      key: "paidOrders",
      title: "Commandes payées",
      value: formatNumber(summary.paidOrders),
      description:
        "Commandes confirmées dont le paiement a été finalisé.",
      icon: CreditCard,
      tone: "green",
      trend: trends.paidOrders,
      trendSuffix: "vs période précédente",
    },

    {
      key: "averageOrderValue",
      title: "Panier moyen",
      value: formatMoney(
        summary.averageOrderValue,
        currency,
      ),
      description:
        "Valeur moyenne des commandes payées sur la période.",
      icon: WalletCards,
      tone: "blue",
    },

    {
      key: "averageTicketPrice",
      title: "Prix moyen du billet",
      value: formatMoney(
        summary.averageTicketPrice,
        currency,
      ),
      description:
        "Revenu brut moyen généré par billet vendu.",
      icon: CircleDollarSign,
      tone: "amber",
    },

    {
      key: "participants",
      title: "Participants uniques",
      value: formatNumber(summary.participants),
      description:
        "Nombre d’adresses e-mail distinctes parmi les détenteurs de billets.",
      icon: UsersRound,
      tone: "violet",
      trend: trends.participants,
      trendSuffix: "vs période précédente",
    },

    {
      key: "activeEvents",
      title: "Événements actifs",
      value: formatNumber(summary.activeEvents),
      description: `${formatNumber(
        summary.totalEvents,
      )} événement${
        summary.totalEvents > 1 ? "s" : ""
      } au total dans le périmètre sélectionné.`,
      icon: CalendarCheck2,
      tone: "green",
    },

    {
      key: "pendingOrders",
      title: "Commandes en attente",
      value: formatNumber(summary.pendingOrders),
      description:
        "Commandes créées dont le paiement n’est pas encore confirmé.",
      icon: Clock3,
      tone: "amber",
    },

    {
      key: "failedOrders",
      title: "Commandes échouées",
      value: formatNumber(summary.failedOrders),
      description:
        "Commandes dont le paiement ou la validation n’a pas abouti.",
      icon: CircleOff,
      tone: "red",
    },

    {
      key: "cancelledTickets",
      title: "Billets annulés",
      value: formatNumber(summary.cancelledTickets),
      description:
        "Billets désactivés et non utilisables au contrôle d’accès.",
      icon: TicketX,
      tone: "red",
    },

    {
      key: "refundedTickets",
      title: "Billets remboursés",
      value: formatNumber(summary.refundedTickets),
      description:
        "Billets associés à une opération de remboursement.",
      icon: RefreshCcw,
      tone: "violet",
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      <section
        aria-label="Résumé principal des statistiques"
        className="grid w-full min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
      >
        {cards.map((card) => (
          <SummaryCard
            key={card.key}
            card={card}
          />
        ))}

        <AttendanceCard summary={summary} />
      </section>

      <OrdersStatusBar summary={summary} />

      <section className="grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric
          icon={UserRoundCheck}
          label="Entrées validées"
          value={formatNumber(
            summary.checkedInParticipants,
          )}
          detail="Participants déjà contrôlés"
          tone="green"
        />

        <MiniMetric
          icon={Clock3}
          label="Participants attendus"
          value={formatNumber(
            summary.expectedParticipants,
          )}
          detail="Billets valides non encore utilisés"
          tone="orange"
        />

        <MiniMetric
          icon={TicketCheck}
          label="Billets valides"
          value={formatNumber(summary.validTickets)}
          detail="Billets encore utilisables"
          tone="blue"
        />

        <MiniMetric
          icon={ScanLine}
          label="Billets utilisés"
          value={formatNumber(summary.usedTickets)}
          detail="Billets déjà scannés"
          tone="violet"
        />
      </section>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  detail: string;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "violet";
}) {
  const styles = {
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
    violet:
      "border-violet-500/20 bg-violet-500/[0.055] text-violet-300",
  }[tone];

  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#071014] p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 text-lg font-black text-white">
          {value}
        </p>

        <p className="mt-1 truncate text-[10px] text-neutral-600">
          {detail}
        </p>
      </div>
    </article>
  );
}