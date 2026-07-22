"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Smartphone,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  useMemo,
  type ComponentType,
} from "react";

import type {
  OrganizerPaymentMethodPerformance,
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type PaymentMethodsBreakdownProps = {
  data: OrganizerPaymentsData["paymentMethods"];
  currency: OrganizerPaymentsData["currency"];
  title?: string;
  description?: string;
};

type PaymentMethodTone = {
  dot: string;
  border: string;
  background: string;
  text: string;
  chartColor: string;
};

type PaymentMethodCardProps = {
  item: OrganizerPaymentMethodPerformance;
  currency: string;
  tone: PaymentMethodTone;
  rank: number;
};

type TooltipPayloadItem = {
  value?: number | string;
  name?: string;
  payload?: {
    method?: string;
    provider?: string;
    successfulAmount?: number;
    successfulPayments?: number;
    share?: number;
    chartColor?: string;
  };
};

type PaymentMethodTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currency: string;
};

const METHOD_TONES: PaymentMethodTone[] = [
  {
    dot: "bg-emerald-400",
    border: "border-emerald-500/20",
    background: "bg-emerald-500/[0.05]",
    text: "text-emerald-300",
    chartColor: "#34d399",
  },
  {
    dot: "bg-orange-400",
    border: "border-orange-500/20",
    background: "bg-orange-500/[0.05]",
    text: "text-orange-300",
    chartColor: "#fb923c",
  },
  {
    dot: "bg-sky-400",
    border: "border-sky-500/20",
    background: "bg-sky-500/[0.05]",
    text: "text-sky-300",
    chartColor: "#38bdf8",
  },
  {
    dot: "bg-violet-400",
    border: "border-violet-500/20",
    background: "bg-violet-500/[0.05]",
    text: "text-violet-300",
    chartColor: "#a78bfa",
  },
  {
    dot: "bg-amber-400",
    border: "border-amber-500/20",
    background: "bg-amber-500/[0.05]",
    text: "text-amber-300",
    chartColor: "#fbbf24",
  },
  {
    dot: "bg-rose-400",
    border: "border-rose-500/20",
    background: "bg-rose-500/[0.05]",
    text: "text-rose-300",
    chartColor: "#fb7185",
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
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safeNumber(value))} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const normalized = safeNumber(value);

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

function normalizeMethodLabel(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "Méthode non renseignée";
  }

  return normalized.replace(
    /(^|\s)\S/g,
    (character) =>
      character.toUpperCase(),
  );
}

function getMethodIcon(
  method: string,
): ComponentType<{
  className?: string;
}> {
  const normalized =
    method.toLowerCase();

  if (
    normalized.includes("mobile") ||
    normalized.includes("momo") ||
    normalized.includes("wave") ||
    normalized.includes("mtn") ||
    normalized.includes("moov") ||
    normalized.includes("orange")
  ) {
    return Smartphone;
  }

  if (
    normalized.includes("card") ||
    normalized.includes("visa") ||
    normalized.includes("master")
  ) {
    return CreditCard;
  }

  if (
    normalized.includes("bank") ||
    normalized.includes("transfer") ||
    normalized.includes("virement")
  ) {
    return Landmark;
  }

  if (
    normalized.includes("cash") ||
    normalized.includes("espèce")
  ) {
    return Banknote;
  }

  return WalletCards;
}

function PaymentMethodTooltip({
  active,
  payload,
  currency,
}: PaymentMethodTooltipProps) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  const item =
    payload[0]?.payload;

  if (!item) {
    return null;
  }

  return (
    <div className="min-w-[220px] rounded-2xl border border-white/[0.1] bg-[#050c10]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor:
              item.chartColor ??
              "#34d399",
          }}
        />

        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white">
            {normalizeMethodLabel(
              item.method ?? "",
            )}
          </p>

          <p className="mt-0.5 truncate text-[10px] text-neutral-500">
            {item.provider ||
              "Prestataire non renseigné"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] text-neutral-500">
            Montant
          </span>

          <strong className="text-xs font-black text-white">
            {formatMoney(
              item.successfulAmount ??
                0,
              currency,
            )}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] text-neutral-500">
            Paiements réussis
          </span>

          <strong className="text-xs font-black text-emerald-300">
            {formatNumber(
              item.successfulPayments ??
                0,
            )}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] text-neutral-500">
            Part du revenu
          </span>

          <strong className="text-xs font-black text-sky-300">
            {formatPercentage(
              item.share ?? 0,
            )}
          </strong>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodCard({
  item,
  currency,
  tone,
  rank,
}: PaymentMethodCardProps) {
  const Icon =
    getMethodIcon(item.method);

  const totalTransactions =
    safeNumber(item.payments);

  const failedTransactions =
    safeNumber(item.failedPayments);

  const successRate =
    safeNumber(item.successRate);

  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 ${tone.border} ${tone.background}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#050c10]">
          <Icon
            className={`h-5 w-5 ${tone.text}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {normalizeMethodLabel(
                  item.method,
                )}
              </p>

              <p className="mt-1 truncate text-[10px] text-neutral-500">
                {item.provider ||
                  "Prestataire non renseigné"}
              </p>
            </div>

            <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2 text-[10px] font-black text-neutral-400">
              #{rank}
            </span>
          </div>

          <p className={`mt-3 text-lg font-black ${tone.text}`}>
            {formatMoney(
              item.successfulAmount,
              currency,
            )}
          </p>

          <p className="mt-1 text-[10px] text-neutral-600">
            {formatPercentage(
              item.share,
            )} du revenu encaissé
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.055]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(
              safeNumber(item.share),
              100,
            )}%`,
            backgroundColor:
              tone.chartColor,
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/[0.07] bg-[#050c10] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
            Paiements
          </p>

          <p className="mt-1 text-sm font-black text-white">
            {formatNumber(
              totalTransactions,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
            Réussite
          </p>

          <p className="mt-1 text-sm font-black text-emerald-300">
            {formatPercentage(
              successRate,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-red-400/70">
            Échecs
          </p>

          <p className="mt-1 text-sm font-black text-red-300">
            {formatNumber(
              failedTransactions,
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <WalletCards className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucun moyen de paiement utilisé
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        La répartition des méthodes de paiement apparaîtra ici dès qu’un paiement sera enregistré.
      </p>
    </div>
  );
}

export default function PaymentMethodsBreakdown({
  data,
  currency,
  title = "Méthodes de paiement",
  description =
    "Analysez la contribution, le volume et le taux de réussite de chaque moyen de paiement.",
}: PaymentMethodsBreakdownProps) {
  const chartData =
    useMemo(
      () =>
        data
          .filter(
            (item) =>
              safeNumber(
                item.successfulAmount,
              ) > 0 ||
              safeNumber(
                item.payments,
              ) > 0,
          )
          .map(
            (
              item,
              index,
            ) => ({
              ...item,
              chartColor:
                METHOD_TONES[
                  index %
                    METHOD_TONES.length
                ].chartColor,
            }),
          ),
      [data],
    );

  const totals =
    useMemo(
      () =>
        data.reduce(
          (
            result,
            item,
          ) => ({
            amount:
              result.amount +
              safeNumber(
                item.successfulAmount,
              ),
            payments:
              result.payments +
              safeNumber(
                item.payments,
              ),
            successfulPayments:
              result.successfulPayments +
              safeNumber(
                item.successfulPayments,
              ),
            failedPayments:
              result.failedPayments +
              safeNumber(
                item.failedPayments,
              ),
          }),
          {
            amount: 0,
            payments: 0,
            successfulPayments: 0,
            failedPayments: 0,
          },
        ),
      [data],
    );

  const globalSuccessRate =
    totals.payments > 0
      ? Math.min(
          Math.max(
            (
              totals.successfulPayments /
              totals.payments
            ) *
              100,
            0,
          ),
          100,
        )
      : 0;

  const hasData =
    data.some(
      (item) =>
        safeNumber(
          item.payments,
        ) > 0 ||
        safeNumber(
          item.successfulAmount,
        ) > 0,
    );

  const leadingMethod =
    chartData[0] ?? null;

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.05),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.035),transparent_28%)]" />

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

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-bold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {formatPercentage(
              globalSuccessRate,
            )} de réussite
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-bold text-neutral-400">
            <CircleDollarSign className="h-3.5 w-3.5 text-lime-300" />
            {formatMoney(
              totals.amount,
              currency,
            )}
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="relative p-4 sm:p-5 xl:p-6">
          <EmptyState />
        </div>
      ) : (
        <>
          <div className="relative grid w-full min-w-0 gap-4 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
            <div className="rounded-xl border border-lime-500/20 bg-lime-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-lime-400/70">
                Montant encaissé
              </p>

              <p className="mt-2 text-lg font-black text-lime-300">
                {formatMoney(
                  totals.amount,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-400/70">
                Paiements
              </p>

              <p className="mt-2 text-lg font-black text-sky-300">
                {formatNumber(
                  totals.payments,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400/70">
                Réussis
              </p>

              <p className="mt-2 text-lg font-black text-emerald-300">
                {formatNumber(
                  totals.successfulPayments,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-red-400/70">
                Échoués
              </p>

              <p className="mt-2 text-lg font-black text-red-300">
                {formatNumber(
                  totals.failedPayments,
                )}
              </p>
            </div>
          </div>

          <div className="relative grid w-full min-w-0 gap-5 px-4 py-5 sm:px-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:px-6 xl:py-6">
            <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#050c10] p-4">
              <div className="h-[320px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={
                        chartData
                      }
                      dataKey="successfulAmount"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      innerRadius={78}
                      outerRadius={118}
                      paddingAngle={3}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth={1}
                      isAnimationActive={false}
                    >
                      {chartData.map(
                        (
                          item,
                          index,
                        ) => (
                          <Cell
                            key={
                              item.key
                            }
                            fill={
                              item.chartColor ??
                              METHOD_TONES[
                                index %
                                  METHOD_TONES.length
                              ].chartColor
                            }
                          />
                        ),
                      )}
                    </Pie>

                    <Tooltip
                      content={
                        <PaymentMethodTooltip
                          currency={
                            currency
                          }
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="-mt-[185px] flex h-[110px] flex-col items-center justify-center text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                  Total encaissé
                </p>

                <p className="mt-2 max-w-[180px] truncate text-lg font-black text-white">
                  {formatMoney(
                    totals.amount,
                    currency,
                  )}
                </p>

                <p className="mt-1 text-[9px] text-neutral-600">
                  {chartData.length} méthode
                  {chartData.length > 1
                    ? "s"
                    : ""}
                </p>
              </div>

              <div className="mt-[75px] rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                  Méthode dominante
                </p>

                <p className="mt-2 truncate text-sm font-black text-white">
                  {leadingMethod
                    ? normalizeMethodLabel(
                        leadingMethod.method,
                      )
                    : "Aucune"}
                </p>

                <p className="mt-1 text-[10px] text-emerald-300">
                  {formatPercentage(
                    leadingMethod?.share ??
                      0,
                  )} du revenu
                </p>
              </div>
            </div>

            <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {data.map(
                (
                  item,
                  index,
                ) => (
                  <PaymentMethodCard
                    key={
                      item.key
                    }
                    item={
                      item
                    }
                    currency={
                      currency
                    }
                    tone={
                      METHOD_TONES[
                        index %
                          METHOD_TONES.length
                      ]
                    }
                    rank={
                      index + 1
                    }
                  />
                ),
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}