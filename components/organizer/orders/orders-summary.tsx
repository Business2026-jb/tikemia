"use client";

import {
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ReceiptText,
  RefreshCcw,
  ShoppingBag,
  TicketCheck,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";

import {
  formatMoney,
} from "@/lib/localization/format-money";
import type {
  OrganizerOrdersCurrencyTotal,
  OrganizerOrdersSummary,
} from "@/lib/organizer/get-organizer-orders";

type OrdersSummaryProps = {
  summary: OrganizerOrdersSummary;
};

type SummaryCardProps = {
  label: string;
  value: string;
  description: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "violet"
    | "red"
    | "neutral";
};

const toneClasses: Record<
  SummaryCardProps["tone"],
  {
    iconWrapper: string;
    icon: string;
    value: string;
    border: string;
    glow: string;
  }
> = {
  green: {
    iconWrapper:
      "border-emerald-500/25 bg-emerald-500/10",
    icon:
      "text-lime-400",
    value:
      "text-lime-400",
    border:
      "hover:border-emerald-500/25",
    glow:
      "from-emerald-500/[0.08]",
  },

  orange: {
    iconWrapper:
      "border-orange-500/25 bg-orange-500/10",
    icon:
      "text-orange-400",
    value:
      "text-orange-400",
    border:
      "hover:border-orange-500/25",
    glow:
      "from-orange-500/[0.08]",
  },

  blue: {
    iconWrapper:
      "border-sky-500/25 bg-sky-500/10",
    icon:
      "text-sky-400",
    value:
      "text-sky-400",
    border:
      "hover:border-sky-500/25",
    glow:
      "from-sky-500/[0.08]",
  },

  violet: {
    iconWrapper:
      "border-violet-500/25 bg-violet-500/10",
    icon:
      "text-violet-400",
    value:
      "text-violet-400",
    border:
      "hover:border-violet-500/25",
    glow:
      "from-violet-500/[0.08]",
  },

  red: {
    iconWrapper:
      "border-red-500/25 bg-red-500/10",
    icon:
      "text-red-400",
    value:
      "text-red-400",
    border:
      "hover:border-red-500/25",
    glow:
      "from-red-500/[0.08]",
  },

  neutral: {
    iconWrapper:
      "border-white/[0.09] bg-white/[0.04]",
    icon:
      "text-neutral-400",
    value:
      "text-white",
    border:
      "hover:border-white/[0.14]",
    glow:
      "from-white/[0.035]",
  },
};

export default function OrdersSummary({
  summary,
}: OrdersSummaryProps) {
  const completionRate =
    summary.totalOrders > 0
      ? Math.round(
          (summary.paidOrders /
            summary.totalOrders) *
            100,
        )
      : 0;

  const accountDistribution =
    useMemo(
      () => ({
        guests:
          summary.guestOrders,
        registered:
          summary.registeredCustomerOrders,
      }),
      [
        summary.guestOrders,
        summary.registeredCustomerOrders,
      ],
    );

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard
          label="Commandes totales"
          value={summary.totalOrders.toLocaleString(
            "fr-FR",
          )}
          description="Toutes les commandes enregistrées"
          icon={ShoppingBag}
          tone="neutral"
        />

        <SummaryCard
          label="Commandes payées"
          value={summary.paidOrders.toLocaleString(
            "fr-FR",
          )}
          description={`${completionRate}% du total`}
          icon={BadgeCheck}
          tone="green"
        />

        <SummaryCard
          label="En attente"
          value={summary.pendingOrders.toLocaleString(
            "fr-FR",
          )}
          description="Paiement non finalisé"
          icon={Clock3}
          tone="orange"
        />

        <SummaryCard
          label="Billets générés"
          value={summary.totalTickets.toLocaleString(
            "fr-FR",
          )}
          description={`${summary.validTickets.toLocaleString(
            "fr-FR",
          )} valide${
            summary.validTickets > 1
              ? "s"
              : ""
          }`}
          icon={TicketCheck}
          tone="blue"
        />

        <SummaryCard
          label="Clients uniques"
          value={summary.uniqueCustomers.toLocaleString(
            "fr-FR",
          )}
          description="Acheteurs distincts"
          icon={UsersRound}
          tone="violet"
        />

        <SummaryCard
          label="Remboursées / échecs"
          value={(
            summary.refundedOrders +
            summary.failedOrders +
            summary.cancelledOrders
          ).toLocaleString(
            "fr-FR",
          )}
          description={`${summary.refundedOrders} remboursée${
            summary.refundedOrders > 1
              ? "s"
              : ""
          }`}
          icon={RefreshCcw}
          tone="red"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <header className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <CircleDollarSign className="h-5 w-5 text-lime-400" />

                <h2 className="text-base font-black text-white">
                  Revenus par devise
                </h2>
              </div>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Les montants restent séparés dans leur devise d’origine.
              </p>
            </div>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-lime-400">
              Données financières réelles
            </div>
          </header>

          {summary.totalsByCurrency.length > 0 ? (
            <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 2xl:grid-cols-3">
              {summary.totalsByCurrency.map(
                (item) => (
                  <CurrencySummaryCard
                    key={item.currency}
                    item={item}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <ReceiptText className="h-5 w-5 text-neutral-600" />
              </div>

              <p className="mt-3 text-sm font-black text-white">
                Aucun revenu enregistré
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-600">
                Les revenus apparaîtront ici dès qu’une commande sera payée.
              </p>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <header className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <UserRound className="h-5 w-5 text-orange-400" />

              <h2 className="text-base font-black text-white">
                Profil des acheteurs
              </h2>
            </div>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Répartition entre clients enregistrés et achats invités.
            </p>
          </header>

          <div className="space-y-4 p-4 sm:p-5">
            <BuyerMetric
              label="Clients enregistrés"
              value={
                accountDistribution.registered
              }
              total={
                summary.totalOrders
              }
              icon={BadgeCheck}
              tone="green"
            />

            <BuyerMetric
              label="Achats invités"
              value={
                accountDistribution.guests
              }
              total={
                summary.totalOrders
              }
              icon={UserRound}
              tone="orange"
            />

            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4">
              <MiniMetric
                label="Billets utilisés"
                value={
                  summary.usedTickets
                }
                icon={TicketCheck}
              />

              <MiniMetric
                label="Billets annulés"
                value={
                  summary.cancelledTickets +
                  summary.refundedTickets
                }
                icon={XCircle}
              />
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: SummaryCardProps) {
  const classes =
    toneClasses[tone];

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] p-4 transition duration-200 ${classes.border}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${classes.glow} via-transparent to-transparent opacity-0 transition group-hover:opacity-100`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${classes.iconWrapper}`}
          >
            <Icon
              className={`h-[18px] w-[18px] ${classes.icon}`}
            />
          </div>

          <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Réel
          </span>
        </div>

        <p
          className={`mt-4 text-2xl font-black tracking-[-0.03em] ${classes.value}`}
        >
          {value}
        </p>

        <p className="mt-1 text-xs font-bold text-neutral-300">
          {label}
        </p>

        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
          {description}
        </p>
      </div>
    </article>
  );
}

function CurrencySummaryCard({
  item,
}: {
  item: OrganizerOrdersCurrencyTotal;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.13em] text-neutral-600">
            Devise
          </p>

          <p className="mt-1 text-lg font-black text-white">
            {item.currency}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-2.5">
          <CreditCard className="h-4 w-4 text-lime-400" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MoneyMetric
          label="Montant payé"
          value={formatMoney({
            amount:
              item.subtotal,
            currency:
              item.currency,
          })}
        />

        <MoneyMetric
          label="Commission"
          value={formatMoney({
            amount:
              item.platformFees,
            currency:
              item.currency,
          })}
          emphasis="orange"
        />

        <MoneyMetric
          label="Net organisateur"
          value={formatMoney({
            amount:
              item.organizerNet,
            currency:
              item.currency,
          })}
          emphasis="green"
        />

        <MoneyMetric
          label="Total facturé"
          value={formatMoney({
            amount:
              item.grossTotal,
            currency:
              item.currency,
          })}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        <CountMetric
          label="Commandes"
          value={
            item.ordersCount
          }
        />

        <CountMetric
          label="Payées"
          value={
            item.paidOrdersCount
          }
        />

        <CountMetric
          label="Billets"
          value={
            item.ticketsCount
          }
        />
      </div>
    </article>
  );
}

function MoneyMetric({
  label,
  value,
  emphasis = "default",
}: {
  label: string;
  value: string;
  emphasis?:
    | "default"
    | "green"
    | "orange";
}) {
  const valueClassName =
    emphasis === "green"
      ? "text-lime-400"
      : emphasis === "orange"
        ? "text-orange-400"
        : "text-white";

  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <p className="text-[10px] text-neutral-600">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-xs font-black ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function CountMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] uppercase tracking-[0.1em] text-neutral-700">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-neutral-300">
        {value.toLocaleString(
          "fr-FR",
        )}
      </p>
    </div>
  );
}

function BuyerMetric({
  label,
  value,
  total,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "orange";
}) {
  const percentage =
    total > 0
      ? Math.min(
          Math.round(
            (value / total) *
              100,
          ),
          100,
        )
      : 0;

  const toneStyles =
    tone === "green"
      ? {
          iconWrapper:
            "border-emerald-500/25 bg-emerald-500/10",
          icon:
            "text-lime-400",
          bar:
            "bg-lime-400",
          value:
            "text-lime-400",
        }
      : {
          iconWrapper:
            "border-orange-500/25 bg-orange-500/10",
          icon:
            "text-orange-400",
          bar:
            "bg-orange-400",
          value:
            "text-orange-400",
        };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneStyles.iconWrapper}`}
        >
          <Icon
            className={`h-4 w-4 ${toneStyles.icon}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs font-bold text-neutral-300">
              {label}
            </p>

            <span
              className={`text-xs font-black ${toneStyles.value}`}
            >
              {value.toLocaleString(
                "fr-FR",
              )}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${toneStyles.bar}`}
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>

          <p className="mt-1.5 text-[10px] text-neutral-600">
            {percentage}% des commandes
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <Icon className="h-4 w-4 text-neutral-600" />

      <p className="mt-2 text-lg font-black text-white">
        {value.toLocaleString(
          "fr-FR",
        )}
      </p>

      <p className="mt-1 text-[10px] leading-4 text-neutral-600">
        {label}
      </p>
    </div>
  );
}