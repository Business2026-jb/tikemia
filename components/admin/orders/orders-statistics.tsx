"use client";

import {
  CircleDollarSign,
  ReceiptText,
  ShoppingBag,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type {
  GetAdminOrdersResult,
} from "@/lib/admin/orders/get-admin-orders";

function formatMoney(
  value: string,
  currency: string | null,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${value} ${currency ?? ""}`.trim();
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      currency
        ? {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
          }
        : {
            maximumFractionDigits: 2,
          },
    ).format(amount);
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${
      currency ?? ""
    }`.trim();
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#081115] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            {title}
          </p>

          <p className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-white">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function OrdersStatistics({
  statistics,
}: {
  statistics: GetAdminOrdersResult["statistics"];
}) {
  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Commandes"
        value={statistics.totalOrders.toLocaleString("fr-FR")}
        subtitle={`${statistics.paidOrders} payées · ${statistics.pendingOrders} en attente`}
        icon={ShoppingBag}
      />

      <MetricCard
        title="Volume payé"
        value={formatMoney(
          statistics.grossPaidAmount,
          statistics.currency,
        )}
        subtitle={
          statistics.currency
            ? `Devise : ${statistics.currency}`
            : "Sélectionnez une devise pour un total financier"
        }
        icon={CircleDollarSign}
      />

      <MetricCard
        title="Commissions Tikemia"
        value={formatMoney(
          statistics.platformFees,
          statistics.currency,
        )}
        subtitle="Commissions sur les commandes payées"
        icon={ReceiptText}
      />

      <MetricCard
        title="Net organisateurs"
        value={formatMoney(
          statistics.netOrganizerAmount,
          statistics.currency,
        )}
        subtitle={`${statistics.refundedOrders} remboursée(s) · ${statistics.failedOrders} échouée(s)`}
        icon={WalletCards}
      />
    </section>
  );
}
