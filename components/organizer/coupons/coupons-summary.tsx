"use client";

import {
  Archive,
  BadgePercent,
  CalendarClock,
  CircleDollarSign,
  FileClock,
  PauseCircle,
  ReceiptText,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  ReactNode,
} from "react";

export type CouponsSummaryData = {
  totalCoupons: number;
  activeCoupons: number;
  draftCoupons: number;
  scheduledCoupons: number;
  expiredCoupons: number;
  disabledCoupons: number;
  archivedCoupons: number;

  totalUsages: number;
  totalDiscountsGranted: number;
  totalAttributedOrders: number;
  totalAttributedRevenue: number;
  totalTicketsGenerated: number;

  currency: string;
};

export type CouponsSummaryProps = {
  summary: CouponsSummaryData;
  isLoading?: boolean;
  className?: string;
};

type SummaryCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
  tone:
    | "emerald"
    | "cyan"
    | "amber"
    | "violet"
    | "rose"
    | "neutral";
};

const TONE_CLASSES: Record<
  SummaryCardProps["tone"],
  {
    iconWrapper: string;
    icon: string;
    accent: string;
  }
> = {
  emerald: {
    iconWrapper:
      "border-emerald-400/20 bg-emerald-400/[0.08]",
    icon:
      "text-emerald-300",
    accent:
      "bg-emerald-400",
  },
  cyan: {
    iconWrapper:
      "border-cyan-400/20 bg-cyan-400/[0.08]",
    icon:
      "text-cyan-300",
    accent:
      "bg-cyan-400",
  },
  amber: {
    iconWrapper:
      "border-amber-400/20 bg-amber-400/[0.08]",
    icon:
      "text-amber-300",
    accent:
      "bg-amber-400",
  },
  violet: {
    iconWrapper:
      "border-violet-400/20 bg-violet-400/[0.08]",
    icon:
      "text-violet-300",
    accent:
      "bg-violet-400",
  },
  rose: {
    iconWrapper:
      "border-rose-400/20 bg-rose-400/[0.08]",
    icon:
      "text-rose-300",
    accent:
      "bg-rose-400",
  },
  neutral: {
    iconWrapper:
      "border-white/[0.09] bg-white/[0.045]",
    icon:
      "text-neutral-300",
    accent:
      "bg-neutral-400",
  },
};

function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function safeNumber(
  value: number,
): number {
  return Number.isFinite(value)
    ? value
    : 0;
}

function formatInteger(
  value: number,
): string {
  return Math.max(
    0,
    Math.round(
      safeNumber(value),
    ),
  ).toLocaleString(
    "fr-FR",
  );
}

function normalizeCurrency(
  value: string,
): string {
  const normalized =
    value
      .trim()
      .toUpperCase();

  return /^[A-Z]{3}$/.test(
    normalized,
  )
    ? normalized
    : "XOF";
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const normalizedCurrency =
    normalizeCurrency(
      currency,
    );

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          normalizedCurrency,
        maximumFractionDigits: 0,
      },
    ).format(
      safeNumber(value),
    );
  } catch {
    return `${Math.round(
      safeNumber(value),
    ).toLocaleString(
      "fr-FR",
    )} ${normalizedCurrency}`;
  }
}

function calculateRate(
  value: number,
  total: number,
): number {
  const safeTotal =
    safeNumber(total);

  if (safeTotal <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      (
        safeNumber(value) /
        safeTotal
      ) *
        100,
    ),
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
  tone,
}: SummaryCardProps) {
  const toneClasses =
    TONE_CLASSES[tone];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071015] p-4 sm:p-5">
      <div
        aria-hidden="true"
        className={joinClassNames(
          "absolute left-0 top-0 h-full w-1",
          toneClasses.accent,
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-500">
            {label}
          </p>

          <p className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-white sm:text-[28px]">
            {value}
          </p>

          <p className="mt-2 text-xs font-medium leading-5 text-neutral-500">
            {description}
          </p>
        </div>

        <div
          className={joinClassNames(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            toneClasses.iconWrapper,
            toneClasses.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function StatusItem({
  icon,
  label,
  value,
  rate,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  rate: number;
  tone:
    | "emerald"
    | "cyan"
    | "amber"
    | "violet"
    | "rose"
    | "neutral";
}) {
  const toneClasses =
    TONE_CLASSES[tone];

  return (
    <div className="rounded-xl border border-white/[0.065] bg-black/15 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={joinClassNames(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
              toneClasses.iconWrapper,
              toneClasses.icon,
            )}
          >
            {icon}
          </div>

          <span className="truncate text-xs font-bold text-neutral-300">
            {label}
          </span>
        </div>

        <span className="text-sm font-black text-white">
          {formatInteger(
            value,
          )}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
        <div
          className={joinClassNames(
            "h-full rounded-full transition-[width] duration-500",
            toneClasses.accent,
          )}
          style={{
            width: `${Math.round(
              rate,
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="h-[158px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
  );
}

export default function CouponsSummary({
  summary,
  isLoading = false,
  className,
}: CouponsSummaryProps) {
  const currency =
    normalizeCurrency(
      summary.currency,
    );

  const totalCoupons =
    safeNumber(
      summary.totalCoupons,
    );

  const primaryCards:
    SummaryCardProps[] = [
      {
        icon: (
          <BadgePercent
            aria-hidden="true"
            className="h-5 w-5"
          />
        ),
        label:
          "Codes promo",
        value:
          formatInteger(
            summary.totalCoupons,
          ),
        description:
          "Nombre total de promotions enregistrées.",
        tone:
          "emerald",
      },
      {
        icon: (
          <Users
            aria-hidden="true"
            className="h-5 w-5"
          />
        ),
        label:
          "Utilisations",
        value:
          formatInteger(
            summary.totalUsages,
          ),
        description:
          "Nombre total d’applications des codes promo.",
        tone:
          "cyan",
      },
      {
        icon: (
          <ReceiptText
            aria-hidden="true"
            className="h-5 w-5"
          />
        ),
        label:
          "Remises accordées",
        value:
          formatMoney(
            summary.totalDiscountsGranted,
            currency,
          ),
        description:
          "Montant cumulé des réductions accordées.",
        tone:
          "amber",
      },
      {
        icon: (
          <TrendingUp
            aria-hidden="true"
            className="h-5 w-5"
          />
        ),
        label:
          "Revenus attribués",
        value:
          formatMoney(
            summary.totalAttributedRevenue,
            currency,
          ),
        description:
          "Chiffre d’affaires associé aux codes promo.",
        tone:
          "violet",
      },
    ];

  const secondaryCards:
    SummaryCardProps[] = [
      {
        icon: (
          <CircleDollarSign
            aria-hidden="true"
            className="h-5 w-5"
          />
        ),
        label:
          "Commandes attribuées",
        value:
          formatInteger(
            summary.totalAttributedOrders,
          ),
        description:
          "Commandes générées avec une attribution marketing.",
        tone:
          "cyan",
      },
      {
        icon: (
          <TicketCheck
            aria-hidden="true"
            className="h-5 w-5"
          />
        ),
        label:
          "Billets générés",
        value:
          formatInteger(
            summary.totalTicketsGenerated,
          ),
        description:
          "Billets issus des commandes attribuées aux promotions.",
        tone:
          "emerald",
      },
    ];

  return (
    <section
      aria-labelledby="coupons-summary-title"
      className={joinClassNames(
        "w-full",
        className,
      )}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
            Vue d’ensemble
          </p>

          <h2
            id="coupons-summary-title"
            className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl"
          >
            Performance des codes promo
          </h2>

          <p className="mt-1 text-xs font-medium leading-5 text-neutral-500 sm:text-sm">
            Suivez l’utilisation, les remises et les revenus générés par vos promotions.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.075] bg-white/[0.025] px-3 py-1.5 text-[11px] font-bold text-neutral-400">
          <CircleDollarSign
            aria-hidden="true"
            className="h-3.5 w-3.5 text-emerald-400"
          />
          Devise active :
          <span className="font-black text-white">
            {currency}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({
              length: 4,
            }).map((_, index) => (
              <LoadingCard
                key={index}
              />
            ))
          : primaryCards.map(
              (card) => (
                <SummaryCard
                  key={card.label}
                  {...card}
                />
              ),
            )}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-white/[0.075] bg-[#071015] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-500">
                Répartition
              </p>

              <h3 className="mt-1 text-base font-black tracking-[-0.02em] text-white">
                État des codes promo
              </h3>
            </div>

            <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1 text-[11px] font-black text-neutral-300">
              {formatInteger(
                summary.totalCoupons,
              )}{" "}
              au total
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-[82px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.035]"
                />
              ))
            ) : (
              <>
                <StatusItem
                  icon={
                    <BadgePercent className="h-4 w-4" />
                  }
                  label="Actifs"
                  value={
                    summary.activeCoupons
                  }
                  rate={calculateRate(
                    summary.activeCoupons,
                    totalCoupons,
                  )}
                  tone="emerald"
                />

                <StatusItem
                  icon={
                    <FileClock className="h-4 w-4" />
                  }
                  label="Brouillons"
                  value={
                    summary.draftCoupons
                  }
                  rate={calculateRate(
                    summary.draftCoupons,
                    totalCoupons,
                  )}
                  tone="neutral"
                />

                <StatusItem
                  icon={
                    <CalendarClock className="h-4 w-4" />
                  }
                  label="Programmés"
                  value={
                    summary.scheduledCoupons
                  }
                  rate={calculateRate(
                    summary.scheduledCoupons,
                    totalCoupons,
                  )}
                  tone="cyan"
                />

                <StatusItem
                  icon={
                    <PauseCircle className="h-4 w-4" />
                  }
                  label="Désactivés"
                  value={
                    summary.disabledCoupons
                  }
                  rate={calculateRate(
                    summary.disabledCoupons,
                    totalCoupons,
                  )}
                  tone="rose"
                />

                <StatusItem
                  icon={
                    <CalendarClock className="h-4 w-4" />
                  }
                  label="Expirés"
                  value={
                    summary.expiredCoupons
                  }
                  rate={calculateRate(
                    summary.expiredCoupons,
                    totalCoupons,
                  )}
                  tone="amber"
                />

                <StatusItem
                  icon={
                    <Archive className="h-4 w-4" />
                  }
                  label="Archivés"
                  value={
                    summary.archivedCoupons
                  }
                  rate={calculateRate(
                    summary.archivedCoupons,
                    totalCoupons,
                  )}
                  tone="violet"
                />
              </>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {isLoading
            ? Array.from({
                length: 2,
              }).map((_, index) => (
                <LoadingCard
                  key={index}
                />
              ))
            : secondaryCards.map(
                (card) => (
                  <SummaryCard
                    key={card.label}
                    {...card}
                  />
                ),
              )}
        </div>
      </div>
    </section>
  );
}