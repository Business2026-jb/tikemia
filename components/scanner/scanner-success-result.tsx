"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";

import type {
  ScannerScanResult,
} from "@/components/scanner/scanner-result";

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "À l’instant";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "À l’instant";
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
      second:
        "2-digit",
    },
  ).format(date);
}

export default function ScannerSuccessResult({
  result,
  onScanNext,
  onClose,
}: {
  result: ScannerScanResult;
  onScanNext: () => void;
  onClose?: () => void;
}) {
  const ticket =
    result.ticket;

  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-400/25 bg-[#06130f] shadow-[0_24px_80px_rgba(16,185,129,0.18)]">
      <div className="border-b border-emerald-400/15 bg-emerald-400/[0.08] p-6 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-emerald-300">
          <CheckCircle2 className="h-11 w-11" />
        </span>

        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
          Accès autorisé
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
          Billet accepté
        </h2>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/20 px-4 py-2 text-xs font-black text-emerald-200">
          <ShieldCheck className="h-4 w-4" />
          {result.authenticity?.label ||
            "Signature Tikemia vérifiée"}
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        <ResultInformation
          icon={UserRound}
          label="Détenteur"
          value={
            ticket?.holderName ||
            "Détenteur non renseigné"
          }
        />

        <ResultInformation
          icon={Ticket}
          label="Catégorie"
          value={
            ticket?.ticketType.name ||
            "Billet Tikemia"
          }
        />

        <ResultInformation
          icon={CalendarDays}
          label="Événement"
          value={
            ticket?.event.title ||
            "Événement Tikemia"
          }
        />

        {(ticket?.event.venueName ||
          ticket?.event.city) && (
          <ResultInformation
            icon={MapPin}
            label="Lieu"
            value={[
              ticket.event.venueName,
              ticket.event.city,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        )}

        <ResultInformation
          icon={Clock3}
          label="Scanné le"
          value={formatDateTime(
            result.scannedAt,
          )}
        />

        <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-600">
            Code billet
          </p>

          <p className="mt-2 break-all font-mono text-sm font-bold text-white">
            {ticket?.code || "—"}
          </p>
        </div>

        <button
          type="button"
          onClick={onScanNext}
          className="mt-2 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] active:scale-[0.99]"
        >
          Scanner le suivant
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 text-sm font-black text-neutral-400 transition hover:text-white"
          >
            Fermer
          </button>
        )}
      </div>
    </section>
  );
}

function ResultInformation({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
        <Icon className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 text-sm font-black leading-6 text-white">
          {value}
        </p>
      </div>
    </div>
  );
}
