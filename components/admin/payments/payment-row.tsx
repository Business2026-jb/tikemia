"use client";

import { Eye } from "lucide-react";

import type { AdminPaymentListItem } from "@/lib/admin/payments/get-admin-payments";

import PaymentProviderBadge from "./payment-provider-badge";
import PaymentStatusBadge from "./payment-status-badge";

function formatMoney(amount: string, currency: string) {
  const numeric = Number(amount);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function PaymentRow({
  payment,
  onOpen,
}: {
  payment: AdminPaymentListItem;
  onOpen: (paymentId: string) => void;
}) {
  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="min-w-[170px]">
          <p className="font-extrabold text-white">
            {payment.order.reference}
          </p>
          <p className="mt-1 max-w-[210px] truncate text-[11px] text-neutral-600">
            {payment.id}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatDate(payment.createdAt)}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[180px]">
          <p className="font-bold text-neutral-200">
            {payment.order.customerName || "Client"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {payment.order.customerEmail}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {payment.order.customerPhone || "-"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[190px]">
          <p className="font-bold text-neutral-200">{payment.event.title}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {payment.event.city}, {payment.event.country}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[150px]">
          <p className="font-bold text-neutral-300">
            {payment.organizer.businessName || payment.organizer.fullName}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {payment.organizer.email}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="space-y-2">
          <PaymentProviderBadge provider={payment.provider} />
          <p className="text-xs text-neutral-500">{payment.method}</p>
        </div>
      </td>

      <td className="px-4 py-4 text-right">
        <p className="whitespace-nowrap font-black text-white">
          {formatMoney(payment.amount, payment.currency)}
        </p>
        {Number(payment.refundedAmount) > 0 ? (
          <p className="mt-1 whitespace-nowrap text-[11px] text-violet-300">
            Remboursé :{" "}
            {formatMoney(payment.refundedAmount, payment.currency)}
          </p>
        ) : null}
      </td>

      <td className="px-4 py-4">
        <PaymentStatusBadge status={payment.status} />
      </td>

      <td className="px-4 py-4 text-right">
        <button
          type="button"
          onClick={() => onOpen(payment.id)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-extrabold text-neutral-400 transition hover:bg-white/[0.05] hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
          Voir
        </button>
      </td>
    </tr>
  );
}
