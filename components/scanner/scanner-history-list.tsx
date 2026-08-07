"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Ticket,
  XCircle,
} from "lucide-react";

export type ScannerHistoryItem =
  Readonly<{
    id: string;
    result: string;
    scannedAt: string;
    gateName:
      | string
      | null;
    deviceName:
      | string
      | null;
    ticket: Readonly<{
      id: string;
      code: string;
      holderName: string;
      holderEmail: string;
      ticketTypeName: string;
      eventId: string;
      eventTitle: string;
    }>;
  }>;

function formatDateTime(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",
      month:
        "short",
      hour:
        "2-digit",
      minute:
        "2-digit",
      second:
        "2-digit",
    },
  ).format(date);
}

function getHistoryTone(
  result: string,
) {
  if (result === "ACCEPTED") {
    return {
      icon:
        CheckCircle2,
      label:
        "Accepté",
      className:
        "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
    };
  }

  if (
    result ===
    "ALREADY_USED"
  ) {
    return {
      icon:
        Clock3,
      label:
        "Déjà utilisé",
      className:
        "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
    };
  }

  return {
    icon:
      result === "INVALID"
        ? AlertTriangle
        : XCircle,
    label:
      "Refusé",
    className:
      "border-red-400/20 bg-red-400/[0.07] text-red-300",
  };
}

export default function ScannerHistoryList({
  items,
  loading,
  emptyMessage =
    "Aucun scan n’a encore été enregistré.",
}: {
  items: readonly ScannerHistoryItem[];
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({
          length:
            4,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            />
          ),
        )}
      </div>
    );
  }

  if (
    items.length ===
    0
  ) {
    return (
      <div className="rounded-3xl border border-dashed border-white/[0.09] bg-[#071015] p-8 text-center">
        <History className="mx-auto h-10 w-10 text-white/[0.12]" />

        <p className="mt-4 text-sm font-black text-white">
          Historique vide
        </p>

        <p className="mt-2 text-xs leading-5 text-neutral-600">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(
        (
          item,
        ) => {
          const tone =
            getHistoryTone(
              item.result,
            );

          const Icon =
            tone.icon;

          return (
            <article
              key={item.id}
              className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#071015] p-4"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone.className}`}
              >
                <Icon className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {item.ticket.holderName}
                    </p>

                    <p className="mt-1 truncate text-xs text-neutral-600">
                      {item.ticket.ticketTypeName}
                      {" · "}
                      {item.ticket.eventTitle}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.10em] ${tone.className}`}
                  >
                    {tone.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-neutral-600">
                  <span className="flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5" />
                    {item.ticket.code}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDateTime(
                      item.scannedAt,
                    )}
                  </span>

                  {item.gateName && (
                    <span>
                      {item.gateName}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}
