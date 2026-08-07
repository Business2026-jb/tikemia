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

import {
  getScannerResultIcon,
  type ScannerScanResult,
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
        "long",
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

function getTitle(
  result: ScannerScanResult,
): string {
  if (
    result.result ===
    "ALREADY_USED"
  ) {
    return "Billet déjà utilisé";
  }

  if (
    result.result ===
    "WRONG_EVENT"
  ) {
    return "Mauvais événement";
  }

  if (
    result.result ===
    "INVALID"
  ) {
    return "QR code invalide";
  }

  return "Accès refusé";
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
  const isWarning =
    result.result ===
    "ALREADY_USED";

  const Icon =
    getScannerResultIcon(
      result,
    );

  const toneClasses =
    isWarning
      ? {
          border:
            "border-amber-400/25",
          background:
            "bg-[#171006]",
          header:
            "bg-amber-400/[0.08]",
          icon:
            "border-amber-300/30 bg-amber-400/15 text-amber-300",
          text:
            "text-amber-300",
          soft:
            "border-amber-400/15 bg-amber-400/[0.06]",
        }
      : {
          border:
            "border-red-400/25",
          background:
            "bg-[#17080b]",
          header:
            "bg-red-400/[0.08]",
          icon:
            "border-red-300/30 bg-red-400/15 text-red-300",
          text:
            "text-red-300",
          soft:
            "border-red-400/15 bg-red-400/[0.06]",
        };

  const ticket =
    result.ticket;

  const firstUseAt =
    result.firstUse?.usedAt ||
    result.firstUse?.scannedAt ||
    ticket?.usedAt ||
    ticket?.scannedAt;

  return (
    <section
      className={`overflow-hidden rounded-[28px] border ${toneClasses.border} ${toneClasses.background}`}
    >
      <div
        className={`border-b ${toneClasses.border} ${toneClasses.header} p-6 text-center`}
      >
        <span
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${toneClasses.icon}`}
        >
          <Icon className="h-11 w-11" />
        </span>

        <p
          className={`mt-4 text-[11px] font-black uppercase tracking-[0.18em] ${toneClasses.text}`}
        >
          {isWarning
            ? "Attention"
            : "Accès refusé"}
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
          {getTitle(result)}
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-400">
          {result.message}
        </p>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {ticket && (
          <>
            <ErrorInformation
              icon={UserRound}
              label="Détenteur"
              value={ticket.holderName}
              className={toneClasses.soft}
            />

            <ErrorInformation
              icon={Ticket}
              label="Catégorie"
              value={ticket.ticketType.name}
              className={toneClasses.soft}
            />

            <ErrorInformation
              icon={CalendarDays}
              label="Événement"
              value={ticket.event.title}
              className={toneClasses.soft}
            />

            {(ticket.event.venueName ||
              ticket.event.city) && (
              <ErrorInformation
                icon={MapPin}
                label="Lieu"
                value={[
                  ticket.event.venueName,
                  ticket.event.city,
                ]
                  .filter(Boolean)
                  .join(", ")}
                className={toneClasses.soft}
              />
            )}
          </>
        )}

        {firstUseAt && (
          <ErrorInformation
            icon={Clock3}
            label="Premier passage"
            value={formatDateTime(
              firstUseAt,
            )}
            className={toneClasses.soft}
          />
        )}

        <div
          className={`rounded-2xl border p-4 ${toneClasses.soft}`}
        >
          <div className="flex items-start gap-3">
            {isWarning ? (
              <AlertTriangle
                className={`mt-0.5 h-5 w-5 shrink-0 ${toneClasses.text}`}
              />
            ) : (
              <ShieldAlert
                className={`mt-0.5 h-5 w-5 shrink-0 ${toneClasses.text}`}
              />
            )}

            <div>
              <p className="text-sm font-black text-white">
                Vérification Tikemia
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                {result.authenticity?.verified
                  ? result.authenticity.label
                  : "L’authenticité du billet n’a pas pu être confirmée."}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onScanNext}
          className="mt-2 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-black transition hover:bg-neutral-200 active:scale-[0.99]"
        >
          Scanner un autre billet
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

function ErrorInformation({
  icon: Icon,
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
      className={`flex items-start gap-3 rounded-2xl border p-4 ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 text-neutral-300">
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
