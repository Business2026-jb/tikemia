"use client";

import {
  Ban,
  CalendarPlus,
  Eye,
  Gauge,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react";

import type {
  AdminPromotionListItem,
} from "@/lib/admin/promotions/get-admin-promotions";

import PromotionPaymentStatusBadge from "./promotion-payment-status-badge";
import PromotionPriorityBadge from "./promotion-priority-badge";
import PromotionStatusBadge from "./promotion-status-badge";

function date(
  value:
    Date | string | null,
) {
  if (!value) return "-";

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "short",
      timeStyle:
        "short",
    },
  ).format(parsed);
}

export default function PromotionRow({
  promotion,
  onOpen,
  onApprove,
  onReject,
  onSuspend,
  onCancel,
  onExtend,
  onPriority,
}: {
  promotion:
    AdminPromotionListItem;
  onOpen:
    (id: string) => void;
  onApprove:
    (
      promotion:
        AdminPromotionListItem,
    ) => void;
  onReject:
    (
      promotion:
        AdminPromotionListItem,
    ) => void;
  onSuspend:
    (
      promotion:
        AdminPromotionListItem,
    ) => void;
  onCancel:
    (
      promotion:
        AdminPromotionListItem,
    ) => void;
  onExtend:
    (
      promotion:
        AdminPromotionListItem,
    ) => void;
  onPriority:
    (
      promotion:
        AdminPromotionListItem,
    ) => void;
}) {
  const payment =
    promotion.subscription
      ?.successfulPayment ??
    null;

  return (
    <tr className="border-t border-white/[0.055] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="flex min-w-[260px] items-center gap-3">
          <div className="h-12 w-16 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
            {promotion.event.coverImage ? (
              <img
                src={promotion.event.coverImage}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div>
            <p className="font-black text-white">
              {promotion.event.title}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {promotion.event.city},{" "}
              {promotion.event.country}
            </p>

            <p className="mt-0.5 text-[11px] text-neutral-700">
              {promotion.event.status}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[190px]">
          <p className="font-bold text-neutral-200">
            {promotion.organizer.businessName ||
              promotion.organizer.fullName}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {promotion.organizer.email}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <PromotionPaymentStatusBadge
          paid={Boolean(payment)}
          amount={payment?.amount}
          currency={payment?.currency}
        />
      </td>

      <td className="px-4 py-4">
        <PromotionPriorityBadge
          score={promotion.priorityScore}
        />
      </td>

      <td className="px-4 py-4">
        <PromotionStatusBadge
          status={promotion.status}
        />
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[175px] text-xs text-neutral-500">
          <p>
            Début : {date(promotion.startsAt)}
          </p>
          <p className="mt-1">
            Fin : {date(promotion.endsAt)}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-[390px] flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onOpen(
                promotion.id,
              )
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-extrabold text-neutral-400 hover:bg-white/[0.05] hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Voir
          </button>

          {promotion.status !==
            "ACTIVE" &&
          promotion.status !==
            "CANCELLED" &&
          promotion.status !==
            "EXPIRED" ? (
            <button
              type="button"
              onClick={() =>
                onApprove(
                  promotion,
                )
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 text-xs font-extrabold text-emerald-300 hover:bg-emerald-400/[0.12]"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Valider
            </button>
          ) : null}

          {promotion.status ===
            "SCHEDULED" ? (
            <button
              type="button"
              onClick={() =>
                onReject(
                  promotion,
                )
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 text-xs font-extrabold text-red-300 hover:bg-red-400/[0.12]"
            >
              <XCircle className="h-3.5 w-3.5" />
              Refuser
            </button>
          ) : null}

          {promotion.status ===
            "ACTIVE" ||
          promotion.status ===
            "SCHEDULED" ? (
            <button
              type="button"
              onClick={() =>
                onSuspend(
                  promotion,
                )
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/[0.07] px-3 text-xs font-extrabold text-sky-300 hover:bg-sky-400/[0.12]"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Suspendre
            </button>
          ) : null}

          {promotion.status !==
            "CANCELLED" &&
          promotion.status !==
            "EXPIRED" ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onExtend(
                    promotion,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 text-xs font-extrabold text-amber-300 hover:bg-amber-400/[0.12]"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Prolonger
              </button>

              <button
                type="button"
                onClick={() =>
                  onPriority(
                    promotion,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.07] px-3 text-xs font-extrabold text-fuchsia-300 hover:bg-fuchsia-400/[0.12]"
              >
                <Gauge className="h-3.5 w-3.5" />
                Priorité
              </button>

              <button
                type="button"
                onClick={() =>
                  onCancel(
                    promotion,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 text-xs font-extrabold text-red-300 hover:bg-red-400/[0.12]"
              >
                <Ban className="h-3.5 w-3.5" />
                Annuler
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
