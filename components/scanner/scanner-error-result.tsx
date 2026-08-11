"use client";

import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  MapPin,
  ShieldAlert,
  Ticket,
  UserRound,
  XCircle,
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
    return "Non disponible";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Non disponible";
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

export default function ScannerErrorResult({
  result,
  onScanNext,
  onClose,
}: {
  result: ScannerScanResult;
  onScanNext: () => void;
  onClose?: () => void;
}) {
  /*
   * L'interface opérationnelle Tikemia ne présente que deux refus :
   *
   * ALREADY_USED -> DÉJÀ UTILISÉ
   * tout le reste -> FAUX BILLET
   *
   * Avec VALIDE dans ScannerSuccessResult, l'agent ne voit donc
   * jamais plus de trois décisions pendant le contrôle.
   */
  const isAlreadyUsed =
    result.result ===
    "ALREADY_USED";

  const ticket =
    result.ticket;

  const firstUseAt =
    result.firstUse?.usedAt ||
    result.firstUse?.scannedAt ||
    ticket?.usedAt ||
    ticket?.scannedAt;

  const location =
    ticket
      ? [
          ticket.event.venueName,
          ticket.event.city,
        ]
          .map(
            (
              value,
            ) =>
              value?.trim() ?? "",
          )
          .filter(Boolean)
          .join(", ")
      : "";

  const tone =
    isAlreadyUsed
      ? {
          border:
            "border-amber-400/30",
          background:
            "bg-[#171006]",
          header:
            "bg-amber-400/[0.10]",
          icon:
            "border-amber-300/35 bg-amber-400/15 text-amber-200",
          text:
            "text-amber-300",
          soft:
            "border-amber-400/15 bg-amber-400/[0.06]",
          shadow:
            "shadow-[0_24px_80px_rgba(245,158,11,0.16)]",
        }
      : {
          border:
            "border-red-400/30",
          background:
            "bg-[#17080b]",
          header:
            "bg-red-400/[0.10]",
          icon:
            "border-red-300/35 bg-red-400/15 text-red-200",
          text:
            "text-red-300",
          soft:
            "border-red-400/15 bg-red-400/[0.06]",
          shadow:
            "shadow-[0_24px_80px_rgba(239,68,68,0.18)]",
        };

  return (
    <section
      aria-live="assertive"
      aria-atomic="true"
      className={`overflow-hidden rounded-[26px] border ${tone.border} ${tone.background} ${tone.shadow}`}
    >
      {/*
       * DÉCISION IMMÉDIATE
       *
       * Orange = billet authentique mais déjà consommé.
       * Rouge  = faux / invalide pour ce contrôle.
       */}
      <div
        className={`relative overflow-hidden border-b ${tone.border} ${tone.header} px-5 py-6 text-center sm:px-6 sm:py-7`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${
            isAlreadyUsed
              ? "bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.10),transparent_65%)]"
              : "bg-[radial-gradient(circle_at_center,rgba(248,113,113,0.10),transparent_65%)]"
          }`}
        />

        <div className="relative">
          <span
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${tone.icon}`}
          >
            {isAlreadyUsed ? (
              <Clock3 className="h-11 w-11" />
            ) : (
              <XCircle className="h-12 w-12" />
            )}
          </span>

          <p
            className={`mt-4 text-[10px] font-black uppercase tracking-[0.22em] ${tone.text}`}
          >
            Entrée refusée
          </p>

          <h2 className="mt-1 text-3xl font-black uppercase tracking-[-0.05em] text-white sm:text-4xl">
            {isAlreadyUsed
              ? "Déjà utilisé"
              : "Faux billet"}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-5 text-neutral-300">
            {isAlreadyUsed
              ? "Ce billet a déjà servi pour une entrée."
              : "Ce billet n’est pas accepté pour ce contrôle."}
          </p>

          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${tone.soft} ${tone.text}`}
          >
            {isAlreadyUsed ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}

            {isAlreadyUsed
              ? "Ne pas autoriser une seconde entrée"
              : "Ne pas autoriser l’entrée"}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {/*
         * Pour un billet déjà utilisé, les informations du billet
         * sont très utiles : l'agent peut voir le détenteur,
         * la catégorie et surtout l'heure du premier passage.
         *
         * Pour un faux billet inconnu, ticket peut être null :
         * aucune identité n'est alors inventée ou affichée.
         */}
        {ticket ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ErrorInformation
                icon={
                  UserRound
                }
                label="Détenteur"
                value={
                  normalizeValue(
                    ticket.holderName,
                    "Non renseigné",
                  )
                }
                className={
                  tone.soft
                }
              />

              <ErrorInformation
                icon={
                  Ticket
                }
                label="Catégorie"
                value={
                  normalizeValue(
                    ticket.ticketType.name,
                    "Billet Tikemia",
                  )
                }
                className={
                  tone.soft
                }
              />
            </div>

            <ErrorInformation
              icon={
                CalendarDays
              }
              label="Événement"
              value={
                normalizeValue(
                  ticket.event.title,
                  "Événement Tikemia",
                )
              }
              className={
                tone.soft
              }
            />

            {location ? (
              <ErrorInformation
                icon={
                  MapPin
                }
                label="Lieu"
                value={
                  location
                }
                className={
                  tone.soft
                }
              />
            ) : null}
          </>
        ) : null}

        {isAlreadyUsed &&
        firstUseAt ? (
          <div className={`rounded-2xl border p-4 ${tone.soft}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-black/20 text-amber-300">
                <Clock3 className="h-5 w-5" />
              </span>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-amber-300">
                  Premier passage
                </p>

                <p className="mt-1 text-base font-black leading-5 text-white">
                  {formatDateTime(
                    firstUseAt,
                  )}
                </p>

                <p className="mt-1 text-[11px] leading-4 text-neutral-500">
                  Le billet avait déjà été consommé à cette heure.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!isAlreadyUsed ? (
          <div className={`rounded-2xl border p-4 ${tone.soft}`}>
            <div className="flex items-start gap-3">
              <ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} />

              <div className="min-w-0">
                <p className="text-sm font-black text-white">
                  Vérification Tikemia
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  {result.authenticity?.verified
                    ? "Le QR a été reconnu, mais ce billet n’est pas valide pour ce contrôle."
                    : "L’authenticité de ce billet n’a pas pu être confirmée."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={
            onScanNext
          }
          className={`inline-flex h-12 w-full items-center justify-center rounded-2xl border px-5 text-sm font-black transition active:scale-[0.99] ${
            isAlreadyUsed
              ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-200 hover:bg-amber-400/[0.12]"
              : "border-red-400/20 bg-red-400/[0.08] text-red-200 hover:bg-red-400/[0.12]"
          }`}
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

function ErrorInformation({
  icon:
    Icon,
  label,
  value,
  className,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl border p-4 ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 text-neutral-300">
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