import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  Minus,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import {
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
} from "@/lib/localization/format-money";
import type {
  DashboardSummary,
  DashboardTrend,
} from "@/lib/organizer/get-organizer-dashboard";

type RevenueSummaryProps = {
  summary: DashboardSummary;
  grossRevenueTrend: DashboardTrend;
  netRevenueTrend: DashboardTrend;
  currency: SupportedCurrencyCode;
  periodDays: number;
};

function formatPercentage(value: number | null): string {
  if (value === null) {
    return "Nouveau";
  }

  return `${Math.abs(value).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })}%`;
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

function getTrendStyles(
  direction: DashboardTrend["direction"],
): string {
  if (direction === "up") {
    return "border-emerald-500/25 bg-emerald-500/10 text-lime-400";
  }

  if (direction === "down") {
    return "border-red-500/25 bg-red-500/10 text-red-400";
  }

  return "border-white/[0.08] bg-white/[0.03] text-neutral-500";
}

export default function RevenueSummary({
  summary,
  grossRevenueTrend,
  netRevenueTrend,
  currency,
  periodDays,
}: RevenueSummaryProps) {
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

  const grossRevenue = Math.max(summary.grossRevenue, 0);
  const platformFees = Math.max(summary.platformFees, 0);
  const netRevenue = Math.max(summary.netRevenue, 0);
  const availableBalance = Math.max(summary.availableBalance, 0);
  const reservedPayouts = Math.max(summary.reservedPayouts, 0);

  const feeRate =
    grossRevenue > 0
      ? Math.min(
          Math.max(
            (platformFees /
              grossRevenue) *
              100,
            0,
          ),
          100,
        )
      : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Landmark className="h-5 w-5 text-lime-400" />

            <h2 className="text-lg font-black tracking-[-0.02em] text-white">
              Résumé financier
            </h2>
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Vue claire de vos revenus, commissions et retraits dans la devise sélectionnée.
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

          <TrendBadge
            label="Brut"
            trend={grossRevenueTrend}
            periodDays={periodDays}
          />

          <TrendBadge
            label="Net"
            trend={netRevenueTrend}
            periodDays={periodDays}
          />
        </div>
      </header>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        <FinancialMetric
          title="Chiffre d’affaires brut"
          value={formatMoney({
            amount:
              grossRevenue,
            currency:
              resolvedCurrency,
          })}
          description="Total réellement payé par les acheteurs"
          icon={CircleDollarSign}
          tone="neutral"
        />

        <FinancialMetric
          title="Commission Tikemia"
          value={formatMoney({
            amount:
              platformFees,
            currency:
              resolvedCurrency,
          })}
          description={`${feeRate.toLocaleString("fr-FR", {
            maximumFractionDigits: 2,
          })}% du chiffre d’affaires brut`}
          icon={ShieldCheck}
          tone="orange"
        />

        <FinancialMetric
          title="Revenus nets"
          value={formatMoney({
            amount:
              netRevenue,
            currency:
              resolvedCurrency,
          })}
          description="Montant après déduction de la commission"
          icon={ReceiptText}
          tone="green"
        />

        <FinancialMetric
          title="Solde disponible"
          value={formatMoney({
            amount:
              availableBalance,
            currency:
              resolvedCurrency,
          })}
          description="Montant disponible pour un retrait"
          icon={WalletCards}
          tone="highlight"
        />
      </div>

      <div className="grid border-t border-white/[0.07] lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-white/[0.07] p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">
                Disponibilité des revenus
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-600">
                Répartition entre le solde disponible et les retraits
                déjà réservés.
              </p>
            </div>

            <WalletCards className="h-5 w-5 shrink-0 text-lime-400" />
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="flex h-full">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-lime-400 to-yellow-400 transition-[width] duration-700"
                style={{
                  width: `${getShare(
                    availableBalance,
                    availableBalance + reservedPayouts,
                  )}%`,
                }}
              />

              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-[width] duration-700"
                style={{
                  width: `${getShare(
                    reservedPayouts,
                    availableBalance + reservedPayouts,
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BalanceLine
              label="Disponible"
              value={formatMoney({
            amount:
              availableBalance,
            currency:
              resolvedCurrency,
          })}
              dotClassName="bg-lime-400"
              valueClassName="text-lime-400"
            />

            <BalanceLine
              label="Retraits réservés"
              value={formatMoney({
            amount:
              reservedPayouts,
            currency:
              resolvedCurrency,
          })}
              dotClassName="bg-orange-400"
              valueClassName="text-orange-400"
            />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                <ShieldCheck className="h-[18px] w-[18px] text-lime-400" />
              </div>

              <div>
                <p className="text-sm font-bold text-white">
                  Calcul sécurisé
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Le solde disponible est calculé à partir des revenus
                  nets, puis diminué des retraits en attente, en
                  traitement ou déjà payés. Les montants restent dans
                  leur devise d’origine et ne sont jamais mélangés avec
                  une autre monnaie.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-neutral-600">
                  Devise affichée
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  {resolvedCurrency}
                  {" — "}
                  {currencyDefinition?.symbol ??
                    resolvedCurrency}
                </p>

                <p className="mt-1 text-[10px] text-neutral-600">
                  {currencyDefinition?.name ??
                    resolvedCurrency}
                </p>
              </div>

              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[11px] font-bold text-lime-400">
                Données réelles
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type TrendBadgeProps = {
  label: string;
  trend: DashboardTrend;
  periodDays: number;
};

function TrendBadge({
  label,
  trend,
  periodDays,
}: TrendBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${getTrendStyles(
        trend.direction,
      )}`}
    >
      <TrendIcon direction={trend.direction} />

      <span>{label}</span>

      <span>
        {trend.direction === "up" && "+"}
        {trend.direction === "down" && "-"}
        {formatPercentage(trend.percentage)}
      </span>

      <span className="font-normal opacity-70">
        / {periodDays} j
      </span>
    </div>
  );
}

type FinancialMetricProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone: "neutral" | "orange" | "green" | "highlight";
};

function FinancialMetric({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: FinancialMetricProps) {
  const styles = {
    neutral: {
      iconWrapper: "border-white/[0.08] bg-white/[0.03]",
      icon: "text-neutral-400",
      value: "text-white",
      background: "",
    },

    orange: {
      iconWrapper:
        "border-orange-500/25 bg-orange-500/10",
      icon: "text-orange-400",
      value: "text-orange-400",
      background: "bg-orange-500/[0.025]",
    },

    green: {
      iconWrapper:
        "border-emerald-500/25 bg-emerald-500/10",
      icon: "text-lime-400",
      value: "text-lime-400",
      background: "bg-emerald-500/[0.025]",
    },

    highlight: {
      iconWrapper:
        "border-lime-400/30 bg-lime-400/10",
      icon: "text-lime-400",
      value: "text-lime-400",
      background:
        "bg-gradient-to-br from-emerald-500/[0.06] to-orange-500/[0.025]",
    },
  }[tone];

  return (
    <article
      className={`border-b border-white/[0.07] p-4 last:border-b-0 sm:border-r sm:nth-[2n]:border-r-0 xl:border-b-0 xl:border-r xl:last:border-r-0 ${styles.background}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${styles.iconWrapper}`}
      >
        <Icon className={`h-[18px] w-[18px] ${styles.icon}`} />
      </div>

      <p className="mt-4 text-xs font-semibold text-neutral-500">
        {title}
      </p>

      <p
        className={`mt-2 break-words text-xl font-black tracking-[-0.03em] sm:text-2xl ${styles.value}`}
      >
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-4 text-neutral-600">
        {description}
      </p>
    </article>
  );
}

type BalanceLineProps = {
  label: string;
  value: string;
  dotClassName: string;
  valueClassName: string;
};

function BalanceLine({
  label,
  value,
  dotClassName,
  valueClassName,
}: BalanceLineProps) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${dotClassName}`}
        />

        <p className="text-xs text-neutral-500">
          {label}
        </p>
      </div>

      <p
        className={`mt-2 break-words text-sm font-black ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function getShare(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.min(Math.max((value / total) * 100, 0), 100);
}