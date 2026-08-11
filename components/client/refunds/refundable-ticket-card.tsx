"use client";

import Image from "next/image";
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Ticket,
} from "lucide-react";

import type {
  RefundableTicketData,
} from "@/components/client/refunds/client-refunds-page";

function formatDateTime(
  value: string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date indisponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(date);
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency:
          currency.toUpperCase(),
        maximumFractionDigits:
          currency.toUpperCase() ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

function getRemainingLabel(
  deadline: string,
): string {
  const deadlineDate =
    new Date(
      deadline,
    );

  if (
    Number.isNaN(
      deadlineDate.getTime(),
    )
  ) {
    return "Éligibilité active";
  }

  const remaining =
    deadlineDate.getTime() -
    Date.now();

  if (
    remaining <=
    0
  ) {
    return "Éligibilité expirée";
  }

  const hours =
    Math.ceil(
      remaining /
      (60 * 60 * 1000),
    );

  if (
    hours < 24
  ) {
    return `${hours} h restantes`;
  }

  const days =
    Math.ceil(
      hours / 24,
    );

  return `${days} j restants`;
}

export default function RefundableTicketCard({
  ticket,
  selected,
  onToggle,
}: {
  ticket:
    RefundableTicketData;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onToggle
      }
      aria-pressed={
        selected
      }
      className={`group w-full overflow-hidden rounded-2xl border text-left transition ${
        selected
          ? "border-lime-400/45 bg-lime-400/[0.07] shadow-[0_16px_45px_rgba(132,204,22,0.08)]"
          : "border-white/[0.07] bg-black/20 hover:border-white/[0.14] hover:bg-white/[0.025]"
      }`}
    >
      <div className="flex min-w-0 gap-4 p-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b151a]">
          {ticket.event
            .coverImage ? (
            <Image
              src={
                ticket.event
                  .coverImage
              }
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-600">
              <Ticket className="h-7 w-7" />
            </div>
          )}

          <span
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur ${
              selected
                ? "border-lime-300/50 bg-lime-400 text-black"
                : "border-white/20 bg-black/60 text-transparent"
            }`}
          >
            <Check className="h-4 w-4" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-white">
                {
                  ticket.event
                    .title
                }
              </p>

              <p className="mt-1 truncate text-xs font-bold text-lime-300">
                {
                  ticket
                    .ticketType
                    .name
                }
              </p>
            </div>

            <p className="shrink-0 text-sm font-black text-white">
              {formatMoney(
                ticket.amount
                  .requestedAmount,
                ticket.amount
                  .currency,
              )}
            </p>
          </div>

          <div className="mt-3 grid gap-1.5 text-xs text-neutral-500 sm:grid-cols-2">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">
                {formatDateTime(
                  ticket.event
                    .startsAt,
                )}
              </span>
            </span>

            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">
                {[
                  ticket.event
                    .venueName,
                  ticket.event
                    .city,
                ]
                  .filter(
                    Boolean,
                  )
                  .join(
                    ", ",
                  )}
              </span>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-300">
              Billet valide
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-1 text-[10px] font-black text-amber-200">
              <Clock3 className="h-3 w-3" />

              {getRemainingLabel(
                ticket
                  .eligibility
                  .deadline,
              )}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
