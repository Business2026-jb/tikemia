"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Medal,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ComponentType,
} from "react";

import type {
  OrganizerStatisticsData,
  StatisticsPaymentMethodItem,
} from "@/lib/organizer/get-organizer-statistics";

type PaymentMethodsChartProps = {
  data: OrganizerStatisticsData["paymentMethods"];
  currency: OrganizerStatisticsData["currency"];
  title?: string;
  description?: string;
  maxItems?: number;
};

type PaymentMetric =
  | "amount"
  | "payments"
  | "successfulPayments"
  | "failedPayments"
  | "refundedPayments";

type MetricDefinition = {
  key: PaymentMetric;
  label: string;
  shortLabel: string;
  icon: ComponentType<{
    className?: string;
  }>;
  kind: "money" | "number";
};

const METRIC_OPTIONS: MetricDefinition[] = [
  {
    key: "amount",
    label: "Montant traité",
    shortLabel: "Montant",
    icon: CircleDollarSign,
    kind: "money",
  },
  {
    key: "payments",
    label: "Nombre de paiements",
    shortLabel: "Paiements",
    icon: CreditCard,
    kind: "number",
  },
  {
    key: "successfulPayments",
    label: "Paiements réussis",
    shortLabel: "Réussis",
    icon: BadgeCheck,
    kind: "number",
  },
  {
    key: "failedPayments",
    label: "Paiements échoués",
    shortLabel: "Échoués",
    icon: XCircle,
    kind: "number",
  },
  {
    key: "refundedPayments",
    label: "Paiements remboursés",
    shortLabel: "Remboursés",
    icon: RefreshCcw,
    kind: "number",
  },
];

function safeNumber(value: number): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatPercentage(value: number): string {
  const safeValue = Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safeValue)} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue = safeNumber(value);

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
    return `${formatNumber(safeValue)} ${currency}`;
  }
}

function normalizeLabel(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase();

  if (!normalized) {
    return "Non renseigné";
  }

  return normalized.replace(
    /(^|\s)\S/g,
    (character) => character.toUpperCase(),
  );
}

function getMetricDefinition(
  metric: PaymentMetric,
): MetricDefinition {
  return (
    METRIC_OPTIONS.find(
      (option) => option.key === metric,
    ) ?? METRIC_OPTIONS[0]
  );
}

function getMetricValue(
  item: StatisticsPaymentMethodItem,
  metric: PaymentMetric,
): number {
  return safeNumber(item[metric]);
}

function formatMetricValue({
  value,
  metric,
  currency,
}: {
  value: number;
  metric: PaymentMetric;
  currency: string;
}): string {
  return getMetricDefinition(metric).kind === "money"
    ? formatMoney(value, currency)
    : formatNumber(value);
}

function getPaymentMethodIcon(
  method: string,
): ComponentType<{
  className?: string;
}> {
  const normalized = method.toLowerCase();

  if (
    normalized.includes("mobile") ||
    normalized.includes("momo") ||
    normalized.includes("orange") ||
    normalized.includes("mtn") ||
    normalized.includes("moov") ||
    normalized.includes("wave")
  ) {
    return Smartphone;
  }

  if (
    normalized.includes("bank") ||
    normalized.includes("transfer") ||
    normalized.includes("virement")
  ) {
    return Landmark;
  }

  if (
    normalized.includes("wallet") ||
    normalized.includes("paypal")
  ) {
    return WalletCards;
  }

  return CreditCard;
}

function getRankStyles(rank: number): {
  wrapper: string;
  text: string;
} {
  if (rank === 1) {
    return {
      wrapper:
        "border-amber-500/25 bg-amber-500/10",
      text: "text-amber-300",
    };
  }

  if (rank === 2) {
    return {
      wrapper:
        "border-neutral-400/20 bg-neutral-400/[0.08]",
      text: "text-neutral-300",
    };
  }

  if (rank === 3) {
    return {
      wrapper:
        "border-orange-700/25 bg-orange-700/[0.08]",
      text: "text-orange-300",
    };
  }

  return {
    wrapper:
      "border-white/[0.07] bg-white/[0.025]",
    text: "text-neutral-500",
  };
}

function calculateSuccessRate(
  item: StatisticsPaymentMethodItem,
): number {
  const total = safeNumber(item.payments);

  if (total <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(
      (safeNumber(item.successfulPayments) / total) *
        100,
      0,
    ),
    100,
  );
}

function PaymentMethodRow({
  item,
  index,
  metric,
  maximumValue,
  currency,
}: {
  item: StatisticsPaymentMethodItem;
  index: number;
  metric: PaymentMetric;
  maximumValue: number;
  currency: string;
}) {
  const value = getMetricValue(item, metric);

  const width =
    maximumValue > 0
      ? Math.min(
          Math.max(
            (value / maximumValue) * 100,
            0,
          ),
          100,
        )
      : 0;

  const rank = index + 1;
  const rankStyles = getRankStyles(rank);
  const MethodIcon = getPaymentMethodIcon(
    item.method,
  );
  const successRate = calculateSuccessRate(item);

  return (
    <article className="group min-w-0 rounded-2xl border border-white/[0.065] bg-white/[0.015] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.025] sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${rankStyles.wrapper}`}
        >
          {rank <= 3 ? (
            <Medal
              className={`h-4 w-4 ${rankStyles.text}`}
            />
          ) : (
            <span
              className={`text-xs font-black ${rankStyles.text}`}
            >
              {rank}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/[0.07]">
                  <MethodIcon className="h-3.5 w-3.5 text-sky-300" />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-white">
                    {normalizeLabel(item.method)}
                  </h3>

                  <p className="mt-0.5 truncate text-[10px] font-semibold text-neutral-600">
                    Prestataire :{" "}
                    {normalizeLabel(item.provider)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-600">
                <span>
                  {formatNumber(item.payments)} paiement
                  {item.payments > 1 ? "s" : ""}
                </span>

                <span className="text-emerald-400">
                  {formatNumber(
                    item.successfulPayments,
                  )}{" "}
                  réussi
                  {item.successfulPayments > 1
                    ? "s"
                    : ""}
                </span>

                <span className="text-red-400">
                  {formatNumber(item.failedPayments)}{" "}
                  échoué
                  {item.failedPayments > 1 ? "s" : ""}
                </span>

                <span className="text-violet-400">
                  {formatNumber(
                    item.refundedPayments,
                  )}{" "}
                  remboursé
                  {item.refundedPayments > 1
                    ? "s"
                    : ""}
                </span>
              </div>
            </div>

            <div className="shrink-0 sm:text-right">
              <p className="text-sm font-black text-emerald-300">
                {formatMetricValue({
                  value,
                  metric,
                  currency,
                })}
              </p>

              <p className="mt-1 text-[10px] text-neutral-600">
                {getMetricDefinition(metric).shortLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-400 to-lime-400 transition-all duration-500"
              style={{
                width: `${width}%`,
              }}
            />
          </div>

          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.065] bg-[#071014] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold text-neutral-600">
                  Part du volume
                </span>

                <strong className="text-[11px] font-black text-sky-300">
                  {formatPercentage(item.percentage)}
                </strong>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.065] bg-[#071014] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold text-neutral-600">
                  Taux de réussite
                </span>

                <strong
                  className={`text-[11px] font-black ${
                    successRate >= 90
                      ? "text-emerald-300"
                      : successRate >= 70
                        ? "text-amber-300"
                        : "text-red-300"
                  }`}
                >
                  {formatPercentage(successRate)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[340px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <CreditCard className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucun paiement disponible
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les performances des moyens de paiement apparaîtront ici dès qu’une
        transaction sera enregistrée sur vos commandes.
      </p>
    </div>
  );
}

export default function PaymentMethodsChart({
  data,
  currency,
  title = "Moyens de paiement",
  description =
    "Comparez les prestataires, les volumes, les montants traités et les taux de réussite.",
  maxItems = 10,
}: PaymentMethodsChartProps) {
  const [selectedMetric, setSelectedMetric] =
    useState<PaymentMetric>("amount");

  const safeMaxItems = Number.isInteger(maxItems)
    ? Math.max(maxItems, 1)
    : 10;

  const sortedData = useMemo(
    () =>
      [...data]
        .sort(
          (first, second) =>
            getMetricValue(
              second,
              selectedMetric,
            ) -
            getMetricValue(
              first,
              selectedMetric,
            ),
        )
        .slice(0, safeMaxItems),
    [data, safeMaxItems, selectedMetric],
  );

  const maximumValue = useMemo(
    () =>
      sortedData.reduce(
        (maximum, item) =>
          Math.max(
            maximum,
            getMetricValue(
              item,
              selectedMetric,
            ),
          ),
        0,
      ),
    [selectedMetric, sortedData],
  );

  const totals = useMemo(
    () =>
      data.reduce(
        (result, item) => ({
          amount:
            result.amount +
            safeNumber(item.amount),
          payments:
            result.payments +
            safeNumber(item.payments),
          successfulPayments:
            result.successfulPayments +
            safeNumber(
              item.successfulPayments,
            ),
          failedPayments:
            result.failedPayments +
            safeNumber(item.failedPayments),
          refundedPayments:
            result.refundedPayments +
            safeNumber(
              item.refundedPayments,
            ),
        }),
        {
          amount: 0,
          payments: 0,
          successfulPayments: 0,
          failedPayments: 0,
          refundedPayments: 0,
        },
      ),
    [data],
  );

  const globalSuccessRate =
    totals.payments > 0
      ? Math.min(
          Math.max(
            (totals.successfulPayments /
              totals.payments) *
              100,
            0,
          ),
          100,
        )
      : 0;

  const leadingMethod =
    sortedData[0] ?? null;

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.045),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.08]">
            <CreditCard className="h-4 w-4 text-sky-300" />
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

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:grid-cols-5">
          {METRIC_OPTIONS.map((metric) => {
            const Icon = metric.icon;
            const active =
              selectedMetric === metric.key;

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() =>
                  setSelectedMetric(metric.key)
                }
                aria-pressed={active}
                className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
                  active
                    ? "border-sky-500/30 bg-sky-500/[0.09] text-sky-300"
                    : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:border-white/[0.13] hover:bg-white/[0.04] hover:text-neutral-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">
                  {metric.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-5 xl:px-6">
        <SummaryMetric
          icon={WalletCards}
          label="Moyens actifs"
          value={formatNumber(data.length)}
          description="Méthodes utilisées"
          tone="blue"
        />

        <SummaryMetric
          icon={CircleDollarSign}
          label="Montant traité"
          value={formatMoney(
            totals.amount,
            currency,
          )}
          description="Volume total"
          tone="lime"
        />

        <SummaryMetric
          icon={BadgeCheck}
          label="Paiements réussis"
          value={formatNumber(
            totals.successfulPayments,
          )}
          description={formatPercentage(
            globalSuccessRate,
          )}
          tone="green"
        />

        <SummaryMetric
          icon={XCircle}
          label="Paiements échoués"
          value={formatNumber(
            totals.failedPayments,
          )}
          description="Transactions non abouties"
          tone="red"
        />

        <SummaryMetric
          icon={RefreshCcw}
          label="Remboursements"
          value={formatNumber(
            totals.refundedPayments,
          )}
          description="Paiements remboursés"
          tone="violet"
        />
      </div>

      <div className="relative w-full min-w-0 p-4 sm:p-5 xl:p-6">
        {sortedData.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid w-full min-w-0 gap-3 xl:grid-cols-2">
            {sortedData.map((item, index) => (
              <PaymentMethodRow
                key={item.key}
                item={item}
                index={index}
                metric={selectedMetric}
                maximumValue={maximumValue}
                currency={currency}
              />
            ))}
          </div>
        )}
      </div>

      {leadingMethod && (
        <div className="relative flex w-full min-w-0 flex-col gap-3 border-t border-white/[0.07] bg-[#050c10] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.08]">
              <Medal className="h-4 w-4 text-amber-300" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                Moyen de paiement dominant
              </p>

              <p className="mt-1 truncate text-sm font-black text-white">
                {normalizeLabel(
                  leadingMethod.method,
                )}
              </p>

              <p className="mt-1 truncate text-[10px] text-neutral-600">
                {normalizeLabel(
                  leadingMethod.provider,
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-sm font-black text-emerald-300">
              {formatMetricValue({
                value: getMetricValue(
                  leadingMethod,
                  selectedMetric,
                ),
                metric: selectedMetric,
                currency,
              })}
            </p>

            <p className="mt-1 text-[10px] text-neutral-600">
              {getMetricDefinition(selectedMetric).label}
            </p>
          </div>
        </div>
      )}

      <div className="relative flex w-full min-w-0 items-start gap-3 border-t border-white/[0.07] bg-amber-500/[0.025] px-4 py-4 sm:px-5 xl:px-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/[0.08]">
          <ShieldCheck className="h-4 w-4 text-amber-300" />
        </div>

        <p className="text-[11px] leading-5 text-neutral-500">
          Les montants et taux sont calculés uniquement à partir des paiements
          associés aux commandes de l’organisateur et à la période
          sélectionnée. Les paiements échoués et remboursés restent visibles
          afin de faciliter le suivi opérationnel.
        </p>
      </div>
    </section>
  );
}

function SummaryMetric({
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
    | "blue"
    | "lime"
    | "green"
    | "red"
    | "violet";
}) {
  const styles = {
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
    lime:
      "border-lime-500/20 bg-lime-500/[0.055] text-lime-300",
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    red:
      "border-red-500/20 bg-red-500/[0.055] text-red-300",
    violet:
      "border-violet-500/20 bg-violet-500/[0.055] text-violet-300",
  }[tone];

  return (
    <article
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 ${styles}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#071014]">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
          {label}
        </p>

        <p className="mt-1 truncate text-sm font-black">
          {value}
        </p>

        <p className="mt-1 truncate text-[9px] text-neutral-600">
          {description}
        </p>
      </div>
    </article>
  );
}