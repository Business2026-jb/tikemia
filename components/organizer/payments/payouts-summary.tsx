"use client";

import {
  Ban,
  CheckCircle2,
  Clock3,
  HandCoins,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";

import type {
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type PayoutsSummaryProps = {
  summary: OrganizerPaymentsData["summary"];
  currency: OrganizerPaymentsData["currency"];
  title?: string;
  description?: string;
};

type PayoutMetricTone =
  | "green"
  | "orange"
  | "blue"
  | "red"
  | "violet"
  | "neutral";

type PayoutMetric = {
  key: string;
  label: string;
  value: string;
  description: string;
  count?: number;
  icon: ComponentType<{
    className?: string;
  }>;
  tone: PayoutMetricTone;
  featured?: boolean;
};

const TONE_STYLES: Record<
  PayoutMetricTone,
  {
    card: string;
    iconBox: string;
    icon: string;
    value: string;
    badge: string;
    glow: string;
  }
> = {
  green: {
    card:
      "border-emerald-500/20 bg-emerald-500/[0.045]",
    iconBox:
      "border-emerald-500/25 bg-emerald-500/[0.09]",
    icon: "text-emerald-300",
    value: "text-emerald-300",
    badge:
      "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
    glow:
      "from-emerald-500/[0.1] via-transparent to-transparent",
  },

  orange: {
    card:
      "border-orange-500/20 bg-orange-500/[0.045]",
    iconBox:
      "border-orange-500/25 bg-orange-500/[0.09]",
    icon: "text-orange-300",
    value: "text-orange-300",
    badge:
      "border-orange-500/20 bg-orange-500/[0.08] text-orange-300",
    glow:
      "from-orange-500/[0.1] via-transparent to-transparent",
  },

  blue: {
    card:
      "border-sky-500/20 bg-sky-500/[0.045]",
    iconBox:
      "border-sky-500/25 bg-sky-500/[0.09]",
    icon: "text-sky-300",
    value: "text-sky-300",
    badge:
      "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
    glow:
      "from-sky-500/[0.1] via-transparent to-transparent",
  },

  red: {
    card:
      "border-red-500/20 bg-red-500/[0.045]",
    iconBox:
      "border-red-500/25 bg-red-500/[0.09]",
    icon: "text-red-300",
    value: "text-red-300",
    badge:
      "border-red-500/20 bg-red-500/[0.08] text-red-300",
    glow:
      "from-red-500/[0.1] via-transparent to-transparent",
  },

  violet: {
    card:
      "border-violet-500/20 bg-violet-500/[0.045]",
    iconBox:
      "border-violet-500/25 bg-violet-500/[0.09]",
    icon: "text-violet-300",
    value: "text-violet-300",
    badge:
      "border-violet-500/20 bg-violet-500/[0.08] text-violet-300",
    glow:
      "from-violet-500/[0.1] via-transparent to-transparent",
  },

  neutral: {
    card:
      "border-white/[0.075] bg-white/[0.018]",
    iconBox:
      "border-white/[0.09] bg-white/[0.035]",
    icon: "text-neutral-300",
    value: "text-white",
    badge:
      "border-white/[0.08] bg-white/[0.025] text-neutral-400",
    glow:
      "from-white/[0.05] via-transparent to-transparent",
  },
};

function safeNumber(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(
    safeNumber(value),
  );
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const normalized =
    safeNumber(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" ||
        currency === "XAF"
          ? 0
          : 2,
    }).format(normalized);
  } catch {
    return `${formatNumber(normalized)} ${currency}`;
  }
}

function calculatePercentage(
  value: number,
  total: number,
): number {
  const normalizedValue =
    safeNumber(value);

  const normalizedTotal =
    safeNumber(total);

  if (normalizedTotal <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(
      (normalizedValue /
        normalizedTotal) *
        100,
      0,
    ),
    100,
  );
}

function formatPercentage(
  value: number,
): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(
    Number.isFinite(value)
      ? value
      : 0,
  )} %`;
}

function PayoutMetricCard({
  metric,
}: {
  metric: PayoutMetric;
}) {
  const styles =
    TONE_STYLES[metric.tone];

  const Icon =
    metric.icon;

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] sm:p-5 ${styles.card} ${
        metric.featured
          ? "shadow-[0_24px_70px_rgba(16,185,129,0.08)]"
          : "shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow}`}
      />

      <div className="relative flex min-w-0 items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
        >
          <Icon
            className={`h-5 w-5 ${styles.icon}`}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
              {metric.label}
            </p>

            {typeof metric.count ===
              "number" && (
              <span
                className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border px-2 text-[10px] font-black ${styles.badge}`}
              >
                {formatNumber(
                  metric.count,
                )}
              </span>
            )}
          </div>

          <p
            className={`mt-2 break-words text-xl font-black leading-tight sm:text-2xl ${styles.value}`}
          >
            {metric.value}
          </p>

          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-neutral-600">
            {metric.description}
          </p>
        </div>
      </div>
    </article>
  );
}

function DistributionItem({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "red";
}) {
  const percentage =
    calculatePercentage(
      value,
      total,
    );

  const styles = {
    green: {
      text:
        "text-emerald-300",
      bar:
        "bg-gradient-to-r from-emerald-500 to-lime-400",
    },
    orange: {
      text:
        "text-orange-300",
      bar:
        "bg-gradient-to-r from-orange-500 to-amber-400",
    },
    blue: {
      text:
        "text-sky-300",
      bar:
        "bg-gradient-to-r from-sky-500 to-cyan-400",
    },
    red: {
      text:
        "text-red-300",
      bar:
        "bg-gradient-to-r from-red-500 to-rose-400",
    },
  }[tone];

  return (
    <div className="min-w-0 rounded-xl border border-white/[0.065] bg-white/[0.015] px-3 py-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-[11px] font-semibold text-neutral-400">
          {label}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <strong
            className={`text-xs font-black ${styles.text}`}
          >
            {formatNumber(value)}
          </strong>

          <span className="text-[10px] text-neutral-600">
            {formatPercentage(
              percentage,
            )}
          </span>
        </div>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full ${styles.bar}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function PayoutsSummary({
  summary,
  currency,
  title = "Résumé des retraits",
  description =
    "Suivez les demandes, les montants en traitement, les retraits payés et les retraits rejetés.",
}: PayoutsSummaryProps) {
  const totalPayouts =
    safeNumber(
      summary.totalPayouts,
    );

  const pendingPayouts =
    safeNumber(
      summary.pendingPayouts,
    );

  const processingPayouts =
    safeNumber(
      summary.processingPayouts,
    );

  const paidPayouts =
    safeNumber(
      summary.paidPayouts,
    );

  const rejectedPayouts =
    safeNumber(
      summary.rejectedPayouts,
    );

  const reservedBalance =
    safeNumber(
      summary.reservedBalance,
    );

  const totalPaidOut =
    safeNumber(
      summary.totalPaidOut,
    );

  const rejectedPayoutAmount =
    safeNumber(
      summary.rejectedPayoutAmount,
    );

  const availableBalance =
    safeNumber(
      summary.availableBalance,
    );

  const metrics: PayoutMetric[] = [
    {
      key:
        "available",
      label:
        "Solde disponible",
      value:
        formatMoney(
          availableBalance,
          currency,
        ),
      description:
        "Montant actuellement disponible pour une nouvelle demande de retrait.",
      icon:
        WalletCards,
      tone:
        "green",
      featured:
        true,
    },

    {
      key:
        "reserved",
      label:
        "En traitement",
      value:
        formatMoney(
          reservedBalance,
          currency,
        ),
      description:
        "Montant réservé par les retraits en attente ou en cours.",
      count:
        pendingPayouts +
        processingPayouts,
      icon:
        LoaderCircle,
      tone:
        "orange",
    },

    {
      key:
        "paid",
      label:
        "Retraits traités",
      value:
        formatMoney(
          totalPaidOut,
          currency,
        ),
      description:
        "Montant total déjà versé avec succès à l’organisateur.",
      count:
        paidPayouts,
      icon:
        HandCoins,
      tone:
        "blue",
    },

    {
      key:
        "rejected",
      label:
        "Retraits annulés / rejetés",
      value:
        formatMoney(
          rejectedPayoutAmount,
          currency,
        ),
      description:
        "Montant total des demandes non validées ou annulées.",
      count:
        rejectedPayouts,
      icon:
        Ban,
      tone:
        "red",
    },
  ];

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.055),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <HandCoins className="h-4 w-4 text-emerald-300" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-bold text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          {formatNumber(
            totalPayouts,
          )} retrait
          {totalPayouts > 1
            ? "s"
            : ""}
        </span>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        {metrics.map(
          (metric) => (
            <PayoutMetricCard
              key={metric.key}
              metric={metric}
            />
          ),
        )}
      </div>

      <div className="relative grid w-full min-w-0 gap-4 border-t border-white/[0.07] px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:px-6">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <DistributionItem
            label="En attente"
            value={pendingPayouts}
            total={Math.max(
              totalPayouts,
              1,
            )}
            tone="orange"
          />

          <DistributionItem
            label="En cours"
            value={processingPayouts}
            total={Math.max(
              totalPayouts,
              1,
            )}
            tone="blue"
          />

          <DistributionItem
            label="Traités"
            value={paidPayouts}
            total={Math.max(
              totalPayouts,
              1,
            )}
            tone="green"
          />

          <DistributionItem
            label="Annulés / rejetés"
            value={rejectedPayouts}
            total={Math.max(
              totalPayouts,
              1,
            )}
            tone="red"
          />
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#050c10] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]">
              <Clock3 className="h-4 w-4 text-orange-300" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                Situation actuelle
              </p>

              <p className="mt-1 text-sm font-black text-white">
                {pendingPayouts +
                  processingPayouts >
                0
                  ? "Des retraits sont en cours"
                  : "Aucun retrait en cours"}
              </p>

              <p className="mt-2 text-[10px] leading-5 text-neutral-600">
                {pendingPayouts +
                  processingPayouts >
                0
                  ? `${formatNumber(
                      pendingPayouts +
                        processingPayouts,
                    )} demande(s) mobilisent actuellement ${formatMoney(
                      reservedBalance,
                      currency,
                    )}.`
                  : "Le solde disponible n’est actuellement bloqué par aucune demande de retrait."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />

                <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
                  Traités
                </span>
              </div>

              <p className="mt-2 text-sm font-black text-emerald-300">
                {formatNumber(
                  paidPayouts,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] px-3 py-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-300" />

                <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-red-400/70">
                  Rejetés
                </span>
              </div>

              <p className="mt-2 text-sm font-black text-red-300">
                {formatNumber(
                  rejectedPayouts,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}