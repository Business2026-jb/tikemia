"use client";

import {
  ChevronRight,
  Mail,
  Phone,
  Ticket,
} from "lucide-react";

import CustomerStatusBadge from "@/components/admin/customers/customer-status-badge";
import type {
  AdminCustomerListItem,
} from "@/components/admin/customers/admin-customers-page";

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  const value =
    Number(amount);

  if (!Number.isFinite(value)) {
    return `${amount} ${currency}`.trim();
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          currency || "XOF",
        maximumFractionDigits:
          currency === "XOF"
            ? 0
            : 2,
      },
    ).format(value);
  } catch {
    return `${value.toLocaleString(
      "fr-FR",
    )} ${currency}`.trim();
  }
}

function initials(
  value: string,
): string {
  const words =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 0) {
    return "CL";
  }

  return words
    .slice(0, 2)
    .map((word) =>
      word.charAt(0),
    )
    .join("")
    .toUpperCase();
}

export default function CustomerRow({
  customer,
  onView,
}: {
  customer: AdminCustomerListItem;
  onView: () => void;
}) {
  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.045] text-xs font-black text-emerald-300">
            {initials(
              customer.fullName,
            )}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              {customer.fullName}
            </p>
            <p className="mt-1 truncate text-[11px] text-neutral-600">
              {customer.country ||
                "Pays non renseigné"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[220px]">
          <p className="flex items-center gap-2 truncate text-xs font-semibold text-neutral-300">
            <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
            {customer.email}
          </p>

          <p className="mt-2 flex items-center gap-2 truncate text-xs text-neutral-500">
            <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-700" />
            {customer.phone ||
              "Téléphone non renseigné"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <CustomerStatusBadge
          customer={customer}
        />
      </td>

      <td className="px-4 py-4 text-center">
        <p className="text-sm font-black text-white">
          {customer.ordersCount.toLocaleString(
            "fr-FR",
          )}
        </p>
        <p className="mt-1 text-[10px] text-neutral-600">
          commandes
        </p>
      </td>

      <td className="px-4 py-4 text-center">
        <p className="inline-flex items-center gap-1.5 text-sm font-black text-white">
          <Ticket className="h-3.5 w-3.5 text-emerald-400" />
          {customer.ticketsCount.toLocaleString(
            "fr-FR",
          )}
        </p>
        <p className="mt-1 text-[10px] text-neutral-600">
          billets
        </p>
      </td>

      <td className="px-4 py-4">
        <p className="whitespace-nowrap text-sm font-black text-emerald-300">
          {formatMoney(
            customer.totalSpent,
            customer.currency,
          )}
        </p>
      </td>

      <td className="px-4 py-4">
        <p className="whitespace-nowrap text-xs font-bold text-neutral-300">
          {formatDate(
            customer.lastPurchaseAt,
          )}
        </p>
      </td>

      <td className="px-4 py-4 text-right">
        <button
          type="button"
          onClick={onView}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-black text-neutral-300 transition hover:border-emerald-400/15 hover:bg-emerald-400/[0.045] hover:text-emerald-300"
        >
          Voir
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
