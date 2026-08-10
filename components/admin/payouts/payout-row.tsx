"use client";

import {
  CheckCircle2,
  Eye,
  FileQuestion,
  XCircle,
} from "lucide-react";

import type {
  AdminPayoutListItem,
} from "@/lib/admin/payouts/get-admin-payouts";

import PayoutMethodBadge from "./payout-method-badge";
import PayoutStatusBadge from "./payout-status-badge";

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(
  value:
    | Date
    | string,
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}

export default function PayoutRow({
  payout,
  onOpen,
  onApprove,
  onReject,
  onRequestInformation,
}: {
  payout:
    AdminPayoutListItem;
  onOpen:
    (
      payoutId: string,
    ) => void;
  onApprove:
    (
      payout:
        AdminPayoutListItem,
    ) => void;
  onReject:
    (
      payout:
        AdminPayoutListItem,
    ) => void;
  onRequestInformation:
    (
      payout:
        AdminPayoutListItem,
    ) => void;
}) {
  const actionable =
    payout.status ===
    "PENDING";

  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="min-w-[170px]">
          <p className="font-extrabold text-white">
            {payout.reference ??
              payout.id}
          </p>

          <p className="mt-1 max-w-[210px] truncate text-[11px] text-neutral-600">
            {payout.id}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {formatDate(
              payout.requestedAt,
            )}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[180px]">
          <p className="font-bold text-neutral-200">
            {payout.organizer
              .businessName ??
              payout.organizer
                .fullName}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {payout.organizer
              .email}
          </p>

          <p className="mt-0.5 text-xs text-neutral-600">
            {payout.organizer
              .phone}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="space-y-2">
          <PayoutMethodBadge
            type={
              payout.destinationType
            }
          />

          <p className="text-xs text-neutral-600">
            {payout.destination
              ?.accountName ??
              "Destination non disponible"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 text-right">
        <p className="whitespace-nowrap font-black text-white">
          {formatMoney(
            payout.amount,
            payout.currency,
          )}
        </p>

        <p className="mt-1 whitespace-nowrap text-[11px] text-neutral-600">
          Net :{" "}
          {formatMoney(
            payout.netAmount,
            payout.currency,
          )}
        </p>
      </td>

      <td className="px-4 py-4">
        <PayoutStatusBadge
          status={
            payout.status
          }
        />
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[250px] flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onOpen(
                payout.id,
              )
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-extrabold text-neutral-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />

            Voir
          </button>

          {actionable ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onRequestInformation(
                    payout,
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-extrabold text-amber-300 transition hover:bg-amber-400/[0.12]"
              >
                <FileQuestion className="h-3.5 w-3.5" />

                Infos
              </button>

              <button
                type="button"
                onClick={() =>
                  onApprove(
                    payout,
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 text-xs font-extrabold text-emerald-300 transition hover:bg-emerald-400/[0.12]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />

                Approuver
              </button>

              <button
                type="button"
                onClick={() =>
                  onReject(
                    payout,
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 text-xs font-extrabold text-red-300 transition hover:bg-red-400/[0.12]"
              >
                <XCircle className="h-3.5 w-3.5" />

                Refuser
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
