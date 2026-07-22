"use client";

import {
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  HandCoins,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  useCallback,
  useState,
  type ReactNode,
} from "react";

import type {
  OrganizerPayoutListItem,
} from "@/lib/organizer/get-organizer-payments";

type PayoutCardProps = {
  payout: OrganizerPayoutListItem;
  compact?: boolean;
  showNote?: boolean;
  onViewDetails?: (
    payout: OrganizerPayoutListItem,
  ) => void;
};

type PayoutStatusTone = {
  label: string;
  className: string;
  icon: ReactNode;
};

function safeNumber(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(
    safeNumber(value),
  );
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const normalized =
    safeNumber(value);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(normalized);
  } catch {
    return `${formatNumber(
      normalized,
    )} ${currency}`;
  }
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Non renseigné";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(date);
}

function getPayoutStatusTone(
  status: OrganizerPayoutListItem["status"],
): PayoutStatusTone {
  switch (status) {
    case "PENDING":
      return {
        label:
          "En attente",
        className:
          "border-orange-500/20 bg-orange-500/[0.08] text-orange-300",
        icon: (
          <Clock3 className="h-3.5 w-3.5" />
        ),
      };

    case "PROCESSING":
      return {
        label:
          "En cours",
        className:
          "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
        icon: (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ),
      };

    case "PAID":
      return {
        label:
          "Traité",
        className:
          "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
        icon: (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ),
      };

    case "REJECTED":
      return {
        label:
          "Annulé / rejeté",
        className:
          "border-red-500/20 bg-red-500/[0.08] text-red-300",
        icon: (
          <Ban className="h-3.5 w-3.5" />
        ),
      };

    default:
      return {
        label:
          String(status),
        className:
          "border-white/[0.08] bg-white/[0.03] text-neutral-300",
        icon: (
          <WalletCards className="h-3.5 w-3.5" />
        ),
      };
  }
}

function PayoutStatusBadge({
  status,
}: {
  status: OrganizerPayoutListItem["status"];
}) {
  const tone =
    getPayoutStatusTone(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.className}`}
    >
      {tone.icon}
      {tone.label}
    </span>
  );
}

function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [
    copied,
    setCopied,
  ] = useState(false);

  const handleCopy =
    useCallback(async () => {
      try {
        await navigator.clipboard.writeText(
          value,
        );

        setCopied(true);

        window.setTimeout(
          () =>
            setCopied(false),
          1400,
        );
      } catch {
        setCopied(false);
      }
    }, [value]);

  return (
    <button
      type="button"
      onClick={
        handleCopy
      }
      title={`Copier ${label}`}
      aria-label={`Copier ${label}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <span className="shrink-0 text-[10px] text-neutral-600">
        {label}
      </span>

      <div className="min-w-0 text-right text-[11px] font-semibold text-neutral-300">
        {children}
      </div>
    </div>
  );
}

export default function PayoutCard({
  payout,
  compact = false,
  showNote = true,
  onViewDetails,
}: PayoutCardProps) {
  const reference =
    payout.reference ??
    `Retrait ${payout.id.slice(
      0,
      8,
    )}`;

  const handleViewDetails =
    useCallback(() => {
      onViewDetails?.(
        payout,
      );
    }, [
      onViewDetails,
      payout,
    ]);

  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] transition duration-300 hover:border-white/[0.13] ${
        compact
          ? "p-3"
          : "p-4 sm:p-5"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.045),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.03),transparent_28%)]" />

      <div className="relative">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
              <HandCoins className="h-4 w-4 text-emerald-300" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {reference}
              </p>

              <p className="mt-1 truncate text-[10px] text-neutral-500">
                ID :{" "}
                {payout.id.slice(
                  0,
                  12,
                )}
              </p>
            </div>
          </div>

          <PayoutStatusBadge
            status={
              payout.status
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.07] bg-[#050c10] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
              Montant demandé
            </p>

            <p className="mt-1 text-sm font-black text-white">
              {formatMoney(
                payout.amount,
                payout.currency,
              )}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
              Net à recevoir
            </p>

            <p className="mt-1 text-sm font-black text-emerald-300">
              {formatMoney(
                payout.netAmount,
                payout.currency,
              )}
            </p>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 rounded-xl border border-orange-500/15 bg-orange-500/[0.04] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-orange-400/70">
              Frais du retrait
            </p>

            <p className="mt-1 text-xs font-black text-orange-300">
              {formatMoney(
                payout.fee,
                payout.currency,
              )}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
          <DetailRow label="Demandé le">
            <span>
              {formatDateTime(
                payout.requestedAt,
              )}
            </span>
          </DetailRow>

          <DetailRow label="Traité le">
            <span>
              {formatDateTime(
                payout.processedAt,
              )}
            </span>
          </DetailRow>

          <DetailRow label="Devise">
            <span className="font-black text-sky-300">
              {payout.currency}
            </span>
          </DetailRow>

          <DetailRow label="Statut">
            <span>
              {
                getPayoutStatusTone(
                  payout.status,
                ).label
              }
            </span>
          </DetailRow>
        </div>

        {showNote &&
          payout.note && (
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#050c10] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
              Note
            </p>

            <p className="mt-2 text-[10px] leading-5 text-neutral-400">
              {payout.note}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {payout.reference && (
              <CopyButton
                value={
                  payout.reference
                }
                label="la référence du retrait"
              />
            )}

            <CopyButton
              value={
                payout.id
              }
              label="l’identifiant du retrait"
            />

            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.045] px-2.5 text-[9px] font-bold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sécurisé
            </span>
          </div>

          <button
            type="button"
            onClick={
              handleViewDetails
            }
            disabled={
              !onViewDetails
            }
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[11px] font-bold text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white disabled:cursor-default disabled:opacity-70 sm:w-auto"
          >
            Voir le détail
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}