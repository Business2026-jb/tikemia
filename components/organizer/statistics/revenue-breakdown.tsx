"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Info,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type {
  ComponentType,
  CSSProperties,
} from "react";

import type {
  OrganizerStatisticsData,
} from "@/lib/organizer/get-organizer-statistics";

type RevenueBreakdownProps = {
  data: OrganizerStatisticsData["revenueBreakdown"];
  currency: OrganizerStatisticsData["currency"];
};

type RevenueItemTone =
  | "green"
  | "orange"
  | "violet"
  | "red";

type RevenueItem = {
  key: string;
  label: string;
  description: string;
  value: number;
  percentage: number;
  icon: ComponentType<{
    className?: string;
  }>;
  tone: RevenueItemTone;
};

const TONE_STYLES: Record<
  RevenueItemTone,
  {
    dot: string;
    iconBox: string;
    icon: string;
    value: string;
    progress: string;
    panel: string;
  }
> = {
  green: {
    dot: "bg-emerald-400",
    iconBox:
      "border-emerald-500/25 bg-emerald-500/10",
    icon: "text-emerald-300",
    value: "text-emerald-300",
    progress:
      "bg-gradient-to-r from-emerald-500 to-lime-400",
    panel:
      "border-emerald-500/15 bg-emerald-500/[0.035]",
  },

  orange: {
    dot: "bg-orange-400",
    iconBox:
      "border-orange-500/25 bg-orange-500/10",
    icon: "text-orange-300",
    value: "text-orange-300",
    progress:
      "bg-gradient-to-r from-orange-500 to-amber-400",
    panel:
      "border-orange-500/15 bg-orange-500/[0.035]",
  },

  violet: {
    dot: "bg-violet-400",
    iconBox:
      "border-violet-500/25 bg-violet-500/10",
    icon: "text-violet-300",
    value: "text-violet-300",
    progress:
      "bg-gradient-to-r from-violet-500 to-fuchsia-400",
    panel:
      "border-violet-500/15 bg-violet-500/[0.035]",
  },

  red: {
    dot: "bg-red-400",
    iconBox:
      "border-red-500/25 bg-red-500/10",
    icon: "text-red-300",
    value: "text-red-300",
    progress:
      "bg-gradient-to-r from-red-500 to-rose-400",
    panel:
      "border-red-500/15 bg-red-500/[0.035]",
  },
};

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" ||
        currency === "XAF"
          ? 0
          : 2,
    }).format(safeValue);
  } catch {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 2,
    }).format(safeValue)} ${currency}`;
  }
}

function formatPercentage(
  value: number,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safeValue)} %`;
}

function clampPercentage(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    Math.max(value, 0),
    100,
  );
}

function calculatePercentage(
  value: number,
  total: number,
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return 0;
  }

  return clampPercentage(
    (value / total) * 100,
  );
}

function RevenueLine({
  item,
  currency,
}: {
  item: RevenueItem;
  currency: string;
}) {
  const styles =
    TONE_STYLES[item.tone];

  const Icon =
    item.icon;

  const safePercentage =
    clampPercentage(
      item.percentage,
    );

  return (
    <article
      className={`min-w-0 rounded-2xl border p-4 transition hover:border-white/[0.12] sm:p-5 ${styles.panel}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
        >
          <Icon
            className={`h-4 w-4 ${styles.icon}`}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">
                {item.label}
              </p>

              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-neutral-500">
                {item.description}
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p
                className={`text-sm font-black ${styles.value}`}
              >
                {formatMoney(
                  item.value,
                  currency,
                )}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-neutral-600">
                {formatPercentage(
                  safePercentage,
                )} du brut
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${styles.progress}`}
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

function FinancialMetric({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  description: string;
  tone:
    | "green"
    | "orange"
    | "violet"
    | "red";
}) {
  const styles =
    TONE_STYLES[tone];

  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox}`}
      >
        <Icon
          className={`h-4 w-4 ${styles.icon}`}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-base font-black ${styles.value}`}
        >
          {value}
        </p>

        <p className="mt-1 truncate text-[10px] text-neutral-600">
          {description}
        </p>
      </div>
    </article>
  );
}

export default function RevenueBreakdown({
  data,
  currency,
}: RevenueBreakdownProps) {
  const grossRevenue =
    Number.isFinite(
      data.grossRevenue,
    )
      ? Math.max(
          data.grossRevenue,
          0,
        )
      : 0;

  const platformFees =
    Number.isFinite(
      data.platformFees,
    )
      ? Math.max(
          data.platformFees,
          0,
        )
      : 0;

  const refundedRevenue =
    Number.isFinite(
      data.refundedRevenue,
    )
      ? Math.max(
          data.refundedRevenue,
          0,
        )
      : 0;

  const netRevenue =
    Number.isFinite(
      data.netRevenue,
    )
      ? Math.max(
          data.netRevenue,
          0,
        )
      : 0;

  const platformFeePercentage =
    calculatePercentage(
      platformFees,
      grossRevenue,
    );

  const refundedPercentage =
    calculatePercentage(
      refundedRevenue,
      grossRevenue,
    );

  const netPercentage =
    calculatePercentage(
      netRevenue,
      grossRevenue,
    );

  const feeRate =
    clampPercentage(
      data.feeRate,
    );

  const retainedAmount =
    platformFees +
    refundedRevenue;

  const financialEfficiency =
    grossRevenue > 0
      ? clampPercentage(
          (netRevenue /
            grossRevenue) *
            100,
        )
      : 0;

  const chartStyle = {
    "--net-angle": `${netPercentage * 3.6}deg`,
    "--fees-angle": `${
      (netPercentage +
        platformFeePercentage) *
      3.6
    }deg`,
  } as CSSProperties;

  const revenueItems: RevenueItem[] = [
    {
      key: "net",
      label:
        "Revenu net organisateur",
      description:
        "Montant conservé après déduction des commissions et remboursements.",
      value:
        netRevenue,
      percentage:
        netPercentage,
      icon:
        Banknote,
      tone:
        "green",
    },

    {
      key: "fees",
      label:
        "Commissions Tikemia",
      description:
        "Frais de plateforme prélevés sur les ventes confirmées.",
      value:
        platformFees,
      percentage:
        platformFeePercentage,
      icon:
        ReceiptText,
      tone:
        "orange",
    },

    {
      key: "refunds",
      label:
        "Montants remboursés",
      description:
        "Sommes retournées aux acheteurs pendant la période analysée.",
      value:
        refundedRevenue,
      percentage:
        refundedPercentage,
      icon:
        RefreshCcw,
      tone:
        "violet",
    },
  ];

  const hasRevenue =
    grossRevenue > 0;

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(132,204,22,0.055),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.04),transparent_30%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <WalletCards
              className="h-4 w-4 text-emerald-300"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              Répartition des revenus
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Analyse complète du chiffre d’affaires brut, des commissions, des remboursements et du revenu net.
            </p>
          </div>
        </div>

        <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-neutral-400 sm:w-auto">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />

          <span>
            Taux de commission :
          </span>

          <strong className="font-black text-orange-300">
            {formatPercentage(
              feeRate,
            )}
          </strong>
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-5 px-4 py-5 sm:px-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)] xl:px-6 xl:py-6">
        <div className="flex min-w-0 flex-col rounded-2xl border border-white/[0.07] bg-[#050c10] p-4 sm:p-5">
          <div className="flex flex-col items-center justify-center py-2">
            <div
              className="relative flex h-52 w-52 shrink-0 items-center justify-center rounded-full sm:h-60 sm:w-60"
              style={{
                ...chartStyle,
                background:
                  hasRevenue
                    ? "conic-gradient(#22c55e 0deg var(--net-angle), #f97316 var(--net-angle) var(--fees-angle), #a855f7 var(--fees-angle) 360deg)"
                    : "conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)",
              }}
            >
              <div className="absolute inset-[22px] rounded-full border border-white/[0.07] bg-[#071014] sm:inset-[26px]" />

              <div className="relative z-10 max-w-[150px] text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-600">
                  Revenu brut
                </p>

                <p className="mt-2 break-words text-xl font-black leading-tight text-white sm:text-2xl">
                  {formatMoney(
                    grossRevenue,
                    currency,
                  )}
                </p>

                <p className="mt-2 text-[10px] font-semibold text-neutral-500">
                  100 % des ventes payées
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <LegendItem
              label="Net"
              value={netPercentage}
              className="bg-emerald-400"
            />

            <LegendItem
              label="Commissions"
              value={platformFeePercentage}
              className="bg-orange-400"
            />

            <LegendItem
              label="Remboursements"
              value={refundedPercentage}
              className="bg-violet-400"
            />
          </div>

          {!hasRevenue && (
            <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] p-3 text-center">
              <p className="text-xs font-semibold text-neutral-500">
                Aucune vente payée sur la période sélectionnée.
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {revenueItems.map(
            (item) => (
              <RevenueLine
                key={
                  item.key
                }
                item={
                  item
                }
                currency={
                  currency
                }
              />
            ),
          )}

          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
            <FinancialMetric
              icon={
                ArrowUpRight
              }
              label="Efficacité nette"
              value={formatPercentage(
                financialEfficiency,
              )}
              description="Part du brut réellement conservée"
              tone="green"
            />

            <FinancialMetric
              icon={
                ArrowDownRight
              }
              label="Montant déduit"
              value={formatMoney(
                retainedAmount,
                currency,
              )}
              description="Commissions et remboursements cumulés"
              tone="red"
            />
          </div>
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 border-t border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        <FinancialMetric
          icon={
            CircleDollarSign
          }
          label="Chiffre d’affaires brut"
          value={formatMoney(
            grossRevenue,
            currency,
          )}
          description="Base totale des commandes payées"
          tone="green"
        />

        <FinancialMetric
          icon={
            ReceiptText
          }
          label="Frais de plateforme"
          value={formatMoney(
            platformFees,
            currency,
          )}
          description={`${formatPercentage(
            platformFeePercentage,
          )} du chiffre d’affaires`}
          tone="orange"
        />

        <FinancialMetric
          icon={
            RefreshCcw
          }
          label="Remboursements"
          value={formatMoney(
            refundedRevenue,
            currency,
          )}
          description={`${formatPercentage(
            refundedPercentage,
          )} du chiffre d’affaires`}
          tone="violet"
        />

        <FinancialMetric
          icon={
            Banknote
          }
          label="Revenu net final"
          value={formatMoney(
            netRevenue,
            currency,
          )}
          description={`${formatPercentage(
            netPercentage,
          )} du chiffre d’affaires`}
          tone="green"
        />
      </div>

      <div className="relative flex w-full min-w-0 items-start gap-3 border-t border-white/[0.07] bg-orange-500/[0.025] px-4 py-4 sm:px-5 xl:px-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/[0.08]">
          <Info className="h-4 w-4 text-orange-300" />
        </div>

        <p className="text-[11px] leading-5 text-neutral-500">
          Les montants présentés utilisent uniquement les commandes payées dans la devise sélectionnée. Le revenu net correspond au chiffre d’affaires brut diminué des commissions Tikemia et des remboursements enregistrés.
        </p>
      </div>
    </section>
  );
}

function LegendItem({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.065] bg-white/[0.018] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
        />

        <span className="truncate text-[10px] font-semibold text-neutral-500">
          {label}
        </span>
      </div>

      <strong className="shrink-0 text-[11px] font-black text-white">
        {formatPercentage(
          value,
        )}
      </strong>
    </div>
  );
}