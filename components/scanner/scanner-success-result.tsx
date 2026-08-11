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
  value:
    | string
    | null
    | undefined,
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
      hour:
        "2-digit",
      minute:
        "2-digit",
      second:
        "2-digit",
    },
  ).format(date);
}

function normalizeValue(
  value:
    | string
    | null
    | undefined,
  fallback: string,
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized || fallback;
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

  const holderName =
    normalizeValue(
      ticket?.holderName,
      "Détenteur non renseigné",
    );

  const ticketType =
    normalizeValue(
      ticket?.ticketType.name,
      "Billet Tikemia",
    );

  const eventTitle =
    normalizeValue(
      ticket?.event.title,
      "Événement Tikemia",
    );

  const location =
    [
      ticket?.event.venueName,
      ticket?.event.city,
    ]
      .map(
        (
          value,
        ) =>
          value?.trim() ?? "",
      )
      .filter(Boolean)
      .join(", ");

  return (
    <section
      aria-live="assertive"
      aria-atomic="true"
      className="overflow-hidden rounded-[26px] border border-emerald-400/30 bg-[#06130f] shadow-[0_24px_80px_rgba(16,185,129,0.20)]"
    >
      {/*
       * DÉCISION IMMÉDIATE
       *
       * L'agent doit comprendre le résultat en une fraction de seconde.
       * Le mot VALIDE est volontairement très grand et très contrasté.
       */}
      <div className="relative overflow-hidden border-b border-emerald-400/15 bg-emerald-400/[0.10] px-5 py-6 text-center sm:px-6 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.12),transparent_65%)]" />

        <div className="relative">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-400/15 text-emerald-200 shadow-[0_0_42px_rgba(52,211,153,0.18)]">
            <CheckCircle2 className="h-12 w-12" />
          </span>

          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
            Entrée autorisée
          </p>

          <h2 className="mt-1 text-4xl font-black uppercase tracking-[-0.05em] text-white sm:text-5xl">
            Valide
          </h2>

          <p className="mt-2 text-sm font-bold text-emerald-100/85">
            Billet Tikemia authentique et non encore utilisé
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/25 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
            <ShieldCheck className="h-4 w-4" />

            {result.authenticity?.label ||
              "Authenticité vérifiée"}
          </div>
        </div>
      </div>

      {/*
       * INFORMATIONS ESSENTIELLES
       *
       * On évite une fiche trop longue : seulement les informations
       * utiles au contrôle terrain.
       */}
      <div className="space-y-3 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultInformation
            icon={
              UserRound
            }
            label="Détenteur"
            value={
              holderName
            }
          />

          <ResultInformation
            icon={
              Ticket
            }
            label="Catégorie"
            value={
              ticketType
            }
          />
        </div>

        <ResultInformation
          icon={
            CalendarDays
          }
          label="Événement"
          value={
            eventTitle
          }
        />

        {location ? (
          <ResultInformation
            icon={
              MapPin
            }
            label="Lieu"
            value={
              location
            }
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <ResultInformation
            icon={
              Clock3
            }
            label="Validé à"
            value={
              formatDateTime(
                result.scannedAt,
              )
            }
          />

          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-600">
              Code billet
            </p>

            <p className="mt-2 truncate font-mono text-sm font-black text-white">
              {ticket?.code ||
                "—"}
            </p>
          </div>
        </div>

        {/*
         * Le scan suivant est normalement automatique :
         * scanner-page-client efface déjà le résultat après un court délai.
         *
         * Ce bouton reste uniquement comme raccourci manuel de secours.
         */}
        <button
          type="button"
          onClick={
            onScanNext
          }
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] px-5 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/[0.12] active:scale-[0.99]"
        >
          Passer immédiatement au suivant
        </button>

        {onClose ? (
          <button
            type="button"
            onClick={
              onClose
            }
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 text-xs font-black text-neutral-500 transition hover:text-white"
          >
            Fermer le résultat
          </button>
        ) : null}

        <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-600">
          Le scanner continue automatiquement
        </p>
      </div>
    </section>
  );
}

function ResultInformation({
  icon:
    Icon,
  label,
  value,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-black leading-5 text-white">
          {value}
        </p>
      </div>
    </div>
  );
}