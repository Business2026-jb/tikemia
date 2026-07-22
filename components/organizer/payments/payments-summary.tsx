import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Clock3,
  CreditCard,
  HandCoins,
  Minus,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { ComponentType } from "react";

import type {
  OrganizerPaymentsData,
  OrganizerPaymentsTrend,
} from "@/lib/organizer/get-organizer-payments";

type PaymentsSummaryProps = {
  summary: OrganizerPaymentsData["summary"];
  trends: OrganizerPaymentsData["trends"];
  currency: OrganizerPaymentsData["currency"];
  title?: string;
  description?: string;
};

type MetricTone =
  | "green"
  | "lime"
  | "orange"
  | "blue"
  | "violet"
  | "red"
  | "amber"
  | "neutral";

type MetricCardProps = {
  label: string;
  value: string;
  description: string;
  icon: ComponentType<{
    className?: string;
  }>;
  tone: MetricTone;
  trend?: OrganizerPaymentsTrend;
  emphasis?: boolean;
};

const TONE_STYLES: Record<
  MetricTone,
  {
    card: string;
    iconBox: string;
    icon: string;
    value: string;
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
    glow:
      "from-emerald-500/[0.09] via-transparent to-transparent",
  },

  lime: {
    card:
      "border-lime-500/20 bg-lime-500/[0.045]",
    iconBox:
      "border-lime-500/25 bg-lime-500/[0.09]",
    icon: "text-lime-300",
    value: "text-lime-300",
    glow:
      "from-lime-500/[0.09] via-transparent to-transparent",
  },

  orange: {
    card:
      "border-orange-500/20 bg-orange-500/[0.045]",
    iconBox:
      "border-orange-500/25 bg-orange-500/[0.09]",
    icon: "text-orange-300",
    value: "text-orange-300",
    glow:
      "from-orange-500/[0.09] via-transparent to-transparent",
  },

  blue: {
    card:
      "border-sky-500/20 bg-sky-500/[0.045]",
    iconBox:
      "border-sky-500/25 bg-sky-500/[0.09]",
    icon: "text-sky-300",
    value: "text-sky-300",
    glow:
      "from-sky-500/[0.09] via-transparent to-transparent",
  },

  violet: {
    card:
      "border-violet-500/20 bg-violet-500/[0.045]",
    iconBox:
      "border-violet-500/25 bg-violet-500/[0.09]",
    icon: "text-violet-300",
    value: "text-violet-300",
    glow:
      "from-violet-500/[0.09] via-transparent to-transparent",
  },

  red: {
    card:
      "border-red-500/20 bg-red-500/[0.045]",
    iconBox:
      "border-red-500/25 bg-red-500/[0.09]",
    icon: "text-red-300",
    value: "text-red-300",
    glow:
      "from-red-500/[0.09] via-transparent to-transparent",
  },

  amber: {
    card:
      "border-amber-500/20 bg-amber-500/[0.045]",
    iconBox:
      "border-amber-500/25 bg-amber-500/[0.09]",
    icon: "text-amber-300",
    value: "text-amber-300",
    glow:
      "from-amber-500/[0.09] via-transparent to-transparent",
  },

  neutral: {
    card:
      "border-white/[0.075] bg-white/[0.018]",
    iconBox:
      "border-white/[0.09] bg-white/[0.035]",
    icon: "text-neutral-300",
    value: "text-white",
    glow:
      "from-white/[0.045] via-transparent to-transparent",
  },
};

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
  const normalized = Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(normalized)} %`;
}

function formatSignedPercentage(value: number): string {
  const normalized = Number.isFinite(value)
    ? value
    : 0;

  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.abs(normalized));

  return `${normalized > 0 ? "+" : normalized < 0 ? "-" : ""}${formatted} %`;
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

function TrendIndicator({
  trend,
}: {
  trend?: OrganizerPaymentsTrend;
}) {
  if (!trend) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-600">
        <Minus className="h-3 w-3" />
        Aucune comparaison
      </span>
    );
  }

  if (
    trend.percentage === null
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-sky-300">
        <TrendingUp className="h-3 w-3" />
        Nouvelle activité
      </span>
    );
  }

  if (trend.direction === "up") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300">
        <ArrowUpRight className="h-3 w-3" />
        {formatSignedPercentage(
          trend.percentage,
        )}
      </span>
    );
  }

  if (trend.direction === "down") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-300">
        <ArrowDownRight className="h-3 w-3" />
        {formatSignedPercentage(
          trend.percentage,
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500">
      <Minus className="h-3 w-3" />
      Stable
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  trend,
  emphasis = false,
}: MetricCardProps) {
  const styles =
    TONE_STYLES[tone];

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] sm:p-5 ${styles.card} ${
        emphasis
          ? "shadow-[0_24px_70px_rgba(16,185,129,0.07)]"
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
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
              {label}
            </p>

            <TrendIndicator trend={trend} />
          </div>

          <p
            className={`mt-2 break-words text-xl font-black leading-tight tracking-tight sm:text-2xl ${styles.value}`}
          >
            {value}
          </p>

          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-neutral-600">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatusMetric({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone:
    | "green"
    | "orange"
    | "red"
    | "violet";
}) {
  const styles = {
    green:
      "border-emerald-500/20 bg-emerald-500/[0.045] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.045] text-orange-300",
    red:
      "border-red-500/20 bg-red-500/[0.045] text-red-300",
    violet:
      "border-violet-500/20 bg-violet-500/[0.045] text-violet-300",
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-3 ${styles}`}
    >
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>

      <p className="mt-1 text-lg font-black">
        {formatNumber(value)}
      </p>

      <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-neutral-600">
        {description}
      </p>
    </div>
  );
}

export default function PaymentsSummary({
  summary,
  trends,
  currency,
  title = "Résumé financier",
  description =
    "Suivez les revenus, commissions, remboursements, paiements et retraits depuis une seule vue.",
}: PaymentsSummaryProps) {
  const availableBalance =
    safeNumber(
      summary.availableBalance,
    );

  const reservedBalance =
    safeNumber(
      summary.reservedBalance,
    );

  const totalPaidOut =
    safeNumber(
      summary.totalPaidOut,
    );

  const totalPaymentActivity =
    safeNumber(
      summary.totalPayments,
    );

  const paymentSuccessRate =
    safeNumber(
      summary.paymentSuccessRate,
    );

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.055),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <WalletCards className="h-4 w-4 text-emerald-300" />
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

        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-bold text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Données financières sécurisées
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        <MetricCard
          label="Solde disponible"
          value={formatMoney(
            availableBalance,
            currency,
          )}
          description="Montant actuellement disponible pour une demande de retrait."
          icon={WalletCards}
          tone="green"
          emphasis
        />

        <MetricCard
          label="Revenus bruts"
          value={formatMoney(
            summary.grossRevenue,
            currency,
          )}
          description="Total généré par les paiements réussis sur la période."
          icon={CircleDollarSign}
          tone="lime"
          trend={trends.grossRevenue}
        />

        <MetricCard
          label="Commissions Tikemia"
          value={formatMoney(
            summary.platformFees,
            currency,
          )}
          description="Frais prélevés par la plateforme sur les ventes réalisées."
          icon={ReceiptText}
          tone="orange"
          trend={trends.platformFees}
        />

        <MetricCard
          label="Revenu net"
          value={formatMoney(
            summary.organizerNet,
            currency,
          )}
          description="Montant restant après déduction des commissions Tikemia."
          icon={Banknote}
          tone="blue"
          trend={trends.organizerNet}
        />

        <MetricCard
          label="Montant remboursé"
          value={formatMoney(
            summary.refundedAmount,
            currency,
          )}
          description="Somme totale retournée aux acheteurs sur la période."
          icon={RefreshCcw}
          tone="violet"
          trend={trends.refundedAmount}
        />

        <MetricCard
          label="Retraits en traitement"
          value={formatMoney(
            reservedBalance,
            currency,
          )}
          description={`${formatNumber(
            summary.pendingPayouts +
              summary.processingPayouts,
          )} retrait(s) réservé(s) ou en cours de traitement.`}
          icon={Clock3}
          tone="amber"
        />

        <MetricCard
          label="Total déjà retiré"
          value={formatMoney(
            totalPaidOut,
            currency,
          )}
          description={`${formatNumber(
            summary.paidPayouts,
          )} retrait(s) déjà traité(s) avec succès.`}
          icon={HandCoins}
          tone="green"
        />

        <MetricCard
          label="Paiement moyen"
          value={formatMoney(
            summary.averagePaymentAmount,
            currency,
          )}
          description="Montant moyen des paiements réussis sur la période."
          icon={CreditCard}
          tone="neutral"
        />
      </div>

      <div className="relative grid w-full min-w-0 gap-4 border-t border-white/[0.07] px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:px-6">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusMetric
            label="Paiements réussis"
            value={summary.successfulPayments}
            description="Transactions confirmées"
            tone="green"
          />

          <StatusMetric
            label="En attente"
            value={summary.pendingPayments}
            description="Transactions non finalisées"
            tone="orange"
          />

          <StatusMetric
            label="Échoués"
            value={summary.failedPayments}
            description="Transactions non abouties"
            tone="red"
          />

          <StatusMetric
            label="Remboursés"
            value={summary.refundedPayments}
            description="Paiements retournés"
            tone="violet"
          />
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#050c10] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                Taux de réussite
              </p>

              <p className="mt-1 text-2xl font-black text-emerald-300">
                {formatPercentage(
                  paymentSuccessRate,
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
              {paymentSuccessRate >= 80 ? (
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              ) : (
                <TrendingDown className="h-4 w-4 text-orange-300" />
              )}
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-400 transition-all duration-500"
              style={{
                width: `${Math.min(
                  paymentSuccessRate,
                  100,
                )}%`,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-neutral-600">
            <span>
              {formatNumber(
                summary.successfulPayments,
              )} réussis
            </span>

            <span>
              {formatNumber(
                totalPaymentActivity,
              )} au total
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}