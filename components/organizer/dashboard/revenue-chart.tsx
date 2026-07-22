"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Minus,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useId, useMemo } from "react";

import {
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
  getCurrencyDecimals,
} from "@/lib/localization/format-money";
import type {
  DashboardSummary,
  DashboardTrend,
} from "@/lib/organizer/get-organizer-dashboard";

type RevenueChartProps = {
  summary: DashboardSummary;
  netRevenueTrend: DashboardTrend;
  currency: SupportedCurrencyCode;
  periodDays: number;
};

type RevenuePart = {
  key: "netRevenue" | "platformFees";
  label: string;
  value: number;
  percentage: number;
};

function formatCompactMoney(
  value: number,
  currency: SupportedCurrencyCode,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const definition =
    getCurrencyDefinition(
      currency,
    );

  const fractionDigits =
    Math.min(
      getCurrencyDecimals(
        currency,
      ),
      1,
    );

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        currencyDisplay:
          "narrowSymbol",
        notation:
          "compact",
        minimumFractionDigits:
          0,
        maximumFractionDigits:
          fractionDigits,
      },
    ).format(
      safeValue,
    );
  } catch {
    const compactValue =
      new Intl.NumberFormat(
        "fr-FR",
        {
          notation:
            "compact",
          maximumFractionDigits:
            fractionDigits,
        },
      ).format(
        safeValue,
      );

    return `${compactValue} ${
      definition?.symbol ??
      currency
    }`;
  }
}

function formatPercentage(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function getTrendLabel(trend: DashboardTrend): string {
  if (trend.percentage === null) {
    return trend.current > 0 ? "Nouvelle activité" : "Aucune évolution";
  }

  const percentage = Math.abs(trend.percentage).toLocaleString(
    "fr-FR",
    {
      maximumFractionDigits: 1,
    },
  );

  if (trend.direction === "up") {
    return `+${percentage}%`;
  }

  if (trend.direction === "down") {
    return `-${percentage}%`;
  }

  return "0%";
}

function TrendIcon({
  direction,
}: {
  direction: DashboardTrend["direction"];
}) {
  if (direction === "up") {
    return <ArrowUpRight className="h-4 w-4" />;
  }

  if (direction === "down") {
    return <ArrowDownRight className="h-4 w-4" />;
  }

  return <Minus className="h-4 w-4" />;
}

export default function RevenueChart({
  summary,
  netRevenueTrend,
  currency,
  periodDays,
}: RevenueChartProps) {
  const gradientId =
    useId().replaceAll(
      ":",
      "",
    );

  const resolvedCurrency =
    isSupportedCurrencyCode(
      currency,
    )
      ? currency
      : "XOF";

  const currencyDefinition =
    getCurrencyDefinition(
      resolvedCurrency,
    );

  const values = useMemo(() => {
    const grossRevenue = safeNumber(summary.grossRevenue);
    const platformFees = Math.min(
      safeNumber(summary.platformFees),
      grossRevenue,
    );

    const calculatedNetRevenue = Math.max(
      grossRevenue - platformFees,
      0,
    );

    /*
     * On privilégie la valeur calculée à partir du brut et des frais
     * afin que le graphique reste toujours mathématiquement cohérent.
     */
    const netRevenue = calculatedNetRevenue;

    const netPercentage =
      grossRevenue > 0
        ? (netRevenue / grossRevenue) * 100
        : 0;

    const feesPercentage =
      grossRevenue > 0
        ? (platformFees / grossRevenue) * 100
        : 0;

    const parts: RevenuePart[] = [
      {
        key: "netRevenue",
        label: "Revenus nets",
        value: netRevenue,
        percentage: netPercentage,
      },
      {
        key: "platformFees",
        label: "Commission Tikemia",
        value: platformFees,
        percentage: feesPercentage,
      },
    ];

    return {
      grossRevenue,
      netRevenue,
      platformFees,
      netPercentage,
      feesPercentage,
      parts,
    };
  }, [summary.grossRevenue, summary.platformFees]);

  const radius = 76;
  const circumference = 2 * Math.PI * radius;

  const netDashLength =
    (values.netPercentage / 100) * circumference;

  const feesDashLength =
    (values.feesPercentage / 100) * circumference;

  const hasRevenue = values.grossRevenue > 0;

  const trendStyle =
    netRevenueTrend.direction === "up"
      ? "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
      : netRevenueTrend.direction === "down"
        ? "border-red-500/25 bg-red-500/10 text-red-400"
        : "border-white/[0.08] bg-white/[0.03] text-neutral-500";

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2.5">
            <WalletCards className="h-5 w-5 text-lime-400" />

            <h2 className="text-lg font-black tracking-[-0.02em] text-white">
              Répartition des revenus
            </h2>
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Revenus cumulés provenant des commandes réellement payées dans la devise sélectionnée.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-3 py-1.5 text-xs font-black text-orange-300">
            <CircleDollarSign className="h-3.5 w-3.5" />

            <span>
              {resolvedCurrency}
            </span>

            <span className="font-normal opacity-70">
              {currencyDefinition?.symbol ??
                resolvedCurrency}
            </span>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${trendStyle}`}
          >
            <TrendIcon
              direction={
                netRevenueTrend.direction
              }
            />

            <span>
              {getTrendLabel(
                netRevenueTrend,
              )}
            </span>

            <span className="font-normal opacity-70">
              sur {periodDays} jours
            </span>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
        {/* Graphique circulaire */}
        <div className="relative flex min-h-[310px] items-center justify-center border-b border-white/[0.07] px-4 py-7 lg:border-b-0 lg:border-r lg:px-6">
          <div
            aria-hidden="true"
            className="absolute h-48 w-48 rounded-full bg-emerald-500/[0.07] blur-[70px]"
          />

          <div className="relative">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label="Répartition des revenus nets et de la commission Tikemia"
              className="h-[220px] w-[220px] sm:h-[250px] sm:w-[250px]"
            >
              <defs>
                <linearGradient
                  id={`net-${gradientId}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="55%" stopColor="#a3e635" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>

                <linearGradient
                  id={`fees-${gradientId}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>

              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="22"
              />

              {hasRevenue && (
                <>
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke={`url(#net-${gradientId})`}
                    strokeWidth="22"
                    strokeLinecap="round"
                    strokeDasharray={`${netDashLength} ${
                      circumference - netDashLength
                    }`}
                    transform="rotate(-90 100 100)"
                  />

                  {feesDashLength > 0 && (
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={`url(#fees-${gradientId})`}
                      strokeWidth="22"
                      strokeLinecap="round"
                      strokeDasharray={`${feesDashLength} ${
                        circumference - feesDashLength
                      }`}
                      strokeDashoffset={-netDashLength}
                      transform="rotate(-90 100 100)"
                    />
                  )}
                </>
              )}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                Chiffre d’affaires
              </p>

              <p className="mt-2 max-w-[160px] break-words text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                {formatCompactMoney(
                  values.grossRevenue,
                  resolvedCurrency,
                )}
              </p>

              <p className="mt-2 text-xs text-neutral-600">
                Total brut cumulé
              </p>
            </div>
          </div>

          {!hasRevenue && (
            <div className="absolute bottom-5 left-1/2 w-[calc(100%-32px)] max-w-[320px] -translate-x-1/2 rounded-xl border border-white/[0.07] bg-[#071014]/95 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-neutral-300">
                Aucun revenu enregistré
              </p>

              <p className="mt-1 text-[11px] leading-4 text-neutral-600">
                Les montants apparaîtront après le premier paiement
                confirmé.
              </p>
            </div>
          )}
        </div>

        {/* Détails des revenus */}
        <div className="p-4 sm:p-5">
          <div className="space-y-3">
            <RevenueLine
              title="Revenus nets organisateur"
              description="Montant après déduction de la commission Tikemia"
              value={values.netRevenue}
              percentage={values.netPercentage}
              currency={resolvedCurrency}
              icon={WalletCards}
              tone="green"
            />

            <RevenueLine
              title="Commission Tikemia"
              description="Frais de service enregistrés sur les commandes"
              value={values.platformFees}
              percentage={values.feesPercentage}
              currency={resolvedCurrency}
              icon={ShieldCheck}
              tone="orange"
            />

            <RevenueLine
              title="Chiffre d’affaires brut"
              description="Total payé par les acheteurs avant commission"
              value={values.grossRevenue}
              percentage={hasRevenue ? 100 : 0}
              currency={resolvedCurrency}
              icon={ReceiptText}
              tone="neutral"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SmallMetric
              label="Solde disponible"
              value={formatMoney({
                amount:
                  summary.availableBalance,
                currency:
                  resolvedCurrency,
              })}
              description="Disponible pour un retrait"
              icon={WalletCards}
              emphasis
            />

            <SmallMetric
              label="Retraits réservés"
              value={formatMoney({
                amount:
                  summary.reservedPayouts,
                currency:
                  resolvedCurrency,
              })}
              description="Demandés, traités ou payés"
              icon={CircleDollarSign}
            />
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

              <p className="text-xs leading-5 text-neutral-500">
                Le solde disponible correspond aux revenus nets cumulés,
                diminués des retraits déjà demandés, en traitement ou
                payés. Les valeurs affichées restent dans leur devise
                d’origine et ne sont pas converties automatiquement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type RevenueLineProps = {
  title: string;
  description: string;
  value: number;
  percentage: number;
  currency: SupportedCurrencyCode;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone: "green" | "orange" | "neutral";
};

function RevenueLine({
  title,
  description,
  value,
  percentage,
  currency,
  icon: Icon,
  tone,
}: RevenueLineProps) {
  const styles = {
    green: {
      wrapper: "border-emerald-500/15 bg-emerald-500/[0.04]",
      iconWrapper:
        "border-emerald-500/25 bg-emerald-500/10",
      icon: "text-lime-400",
      value: "text-lime-400",
      progress:
        "bg-gradient-to-r from-emerald-500 via-lime-400 to-yellow-400",
    },

    orange: {
      wrapper: "border-orange-500/15 bg-orange-500/[0.04]",
      iconWrapper:
        "border-orange-500/25 bg-orange-500/10",
      icon: "text-orange-400",
      value: "text-orange-400",
      progress:
        "bg-gradient-to-r from-yellow-400 to-orange-500",
    },

    neutral: {
      wrapper: "border-white/[0.07] bg-white/[0.025]",
      iconWrapper: "border-white/[0.08] bg-white/[0.035]",
      icon: "text-neutral-400",
      value: "text-white",
      progress:
        "bg-gradient-to-r from-neutral-500 to-neutral-300",
    },
  }[tone];

  const safePercentage = Math.min(
    Math.max(percentage, 0),
    100,
  );

  return (
    <article
      className={`rounded-xl border p-3.5 sm:p-4 ${styles.wrapper}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.iconWrapper}`}
        >
          <Icon className={`h-[18px] w-[18px] ${styles.icon}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {title}
              </p>

              <p className="mt-1 text-[11px] leading-4 text-neutral-600">
                {description}
              </p>
            </div>

            <div className="shrink-0 sm:text-right">
              <p
                className={`break-words text-sm font-black ${styles.value}`}
              >
                {formatMoney({
                  amount:
                    value,
                  currency,
                })}
              </p>

              <p className="mt-1 text-[11px] font-semibold text-neutral-500">
                {formatPercentage(safePercentage)}
              </p>
            </div>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${styles.progress}`}
              style={{
                width: `${safePercentage}%`,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

type SmallMetricProps = {
  label: string;
  value: string;
  description: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  emphasis?: boolean;
};

function SmallMetric({
  label,
  value,
  description,
  icon: Icon,
  emphasis = false,
}: SmallMetricProps) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        emphasis
          ? "border-emerald-500/20 bg-emerald-500/[0.045]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={`h-4 w-4 ${
            emphasis ? "text-lime-400" : "text-neutral-500"
          }`}
        />

        <p className="text-xs font-semibold text-neutral-400">
          {label}
        </p>
      </div>

      <p
        className={`mt-3 break-words text-lg font-black tracking-[-0.025em] ${
          emphasis ? "text-lime-400" : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[11px] leading-4 text-neutral-600">
        {description}
      </p>
    </article>
  );
}