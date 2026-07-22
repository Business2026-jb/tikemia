"use client";

import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  TicketCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useState,
  type ReactNode,
} from "react";

import type {
  OrganizerPaymentListItem,
} from "@/lib/organizer/get-organizer-payments";

type PaymentCardProps = {
  payment: OrganizerPaymentListItem;
  showFinancialDetails?: boolean;
  showCustomerDetails?: boolean;
  compact?: boolean;
};

type PaymentStatusTone = {
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

function normalizeLabel(
  value: string,
): string {
  const normalized = value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "Non renseigné";
  }

  return normalized.replace(
    /(^|\s)\S/g,
    (character) =>
      character.toUpperCase(),
  );
}

function getPaymentStatusTone(
  status: OrganizerPaymentListItem["status"],
): PaymentStatusTone {
  switch (status) {
    case "SUCCESS":
      return {
        label: "Réussi",
        className:
          "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
        icon: (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ),
      };

    case "PENDING":
      return {
        label: "En attente",
        className:
          "border-orange-500/20 bg-orange-500/[0.08] text-orange-300",
        icon: (
          <Clock3 className="h-3.5 w-3.5" />
        ),
      };

    case "FAILED":
      return {
        label: "Échoué",
        className:
          "border-red-500/20 bg-red-500/[0.08] text-red-300",
        icon: (
          <XCircle className="h-3.5 w-3.5" />
        ),
      };

    case "REFUNDED":
      return {
        label: "Remboursé",
        className:
          "border-violet-500/20 bg-violet-500/[0.08] text-violet-300",
        icon: (
          <RefreshCcw className="h-3.5 w-3.5" />
        ),
      };

    default:
      return {
        label:
          normalizeLabel(status),
        className:
          "border-white/[0.08] bg-white/[0.03] text-neutral-300",
        icon: (
          <WalletCards className="h-3.5 w-3.5" />
        ),
      };
  }
}

function PaymentStatusBadge({
  status,
}: {
  status: OrganizerPaymentListItem["status"];
}) {
  const tone =
    getPaymentStatusTone(status);

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

export default function PaymentCard({
  payment,
  showFinancialDetails = true,
  showCustomerDetails = true,
  compact = false,
}: PaymentCardProps) {
  const paymentDate =
    payment.paidAt ??
    payment.createdAt;

  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014] transition duration-300 hover:border-white/[0.13] ${
        compact
          ? "p-3"
          : "p-4 sm:p-5"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.045),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.03),transparent_28%)]" />

      <div className="relative">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.08]">
                <ReceiptText className="h-4 w-4 text-sky-300" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {payment.order.customerName ||
                    "Client non renseigné"}
                </p>

                <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                  {payment.order.reference}
                </p>
              </div>
            </div>
          </div>

          <PaymentStatusBadge
            status={
              payment.status
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.07] bg-[#050c10] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
              Montant payé
            </p>

            <p className="mt-1 text-sm font-black text-white">
              {formatMoney(
                payment.amount,
                payment.currency,
              )}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
              Net organisateur
            </p>

            <p className="mt-1 text-sm font-black text-emerald-300">
              {formatMoney(
                payment.financials.organizerNet,
                payment.currency,
              )}
            </p>
          </div>
        </div>

        {showFinancialDetails && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.04] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-orange-400/70">
                Commission
              </p>

              <p className="mt-1 text-xs font-black text-orange-300">
                {formatMoney(
                  payment.financials.platformFee,
                  payment.currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
                Sous-total
              </p>

              <p className="mt-1 text-xs font-black text-neutral-200">
                {formatMoney(
                  payment.financials.subtotal,
                  payment.currency,
                )}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
          <DetailRow label="Événement">
            <Link
              href={`/organizer/events/${payment.event.id}`}
              className="inline-flex max-w-[220px] items-center gap-1 text-sky-300 transition hover:text-sky-200"
            >
              <span className="truncate">
                {payment.event.title}
              </span>

              <ExternalLink className="h-3 w-3 shrink-0" />
            </Link>
          </DetailRow>

          <DetailRow label="Lieu">
            <span className="inline-flex max-w-[220px] items-center justify-end gap-1.5">
              <MapPin className="h-3 w-3 shrink-0 text-neutral-600" />

              <span className="truncate">
                {payment.event.city},{" "}
                {payment.event.country}
              </span>
            </span>
          </DetailRow>

          <DetailRow label="Méthode">
            <span>
              {normalizeLabel(
                payment.method,
              )}
            </span>
          </DetailRow>

          <DetailRow label="Prestataire">
            <span>
              {normalizeLabel(
                payment.provider,
              )}
            </span>
          </DetailRow>

          <DetailRow label="Date">
            <span>
              {formatDateTime(
                paymentDate,
              )}
            </span>
          </DetailRow>
        </div>

        {showCustomerDetails && (
          <div className="mt-4 space-y-2 rounded-xl border border-white/[0.07] bg-[#050c10] p-3">
            <div className="flex min-w-0 items-center gap-2 text-[10px] text-neutral-500">
              <Mail className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">
                {payment.order.customerEmail}
              </span>
            </div>

            {payment.order.customerPhone && (
              <div className="flex min-w-0 items-center gap-2 text-[10px] text-neutral-500">
                <Phone className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">
                  {payment.order.customerPhone}
                </span>
              </div>
            )}
          </div>
        )}

        {payment.failureReason && (
          <div className="mt-4 rounded-xl border border-red-500/15 bg-red-500/[0.045] p-3">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

              <div className="min-w-0">
                <p className="text-[10px] font-bold text-red-300">
                  Motif de l’échec
                </p>

                <p className="mt-1 text-[10px] leading-5 text-red-200/70">
                  {payment.failureReason}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CopyButton
              value={
                payment.order.reference
              }
              label="la référence de la commande"
            />

            {payment.providerReference && (
              <CopyButton
                value={
                  payment.providerReference
                }
                label="la référence du paiement"
              />
            )}

            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.045] px-2.5 text-[9px] font-bold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sécurisé
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/organizer/orders/${payment.order.id}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[11px] font-bold text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white sm:flex-none"
            >
              <TicketCheck className="h-3.5 w-3.5" />
              Voir la commande
            </Link>

            <Link
              href={`/organizer/events/${payment.event.id}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 text-[11px] font-bold text-sky-300 transition hover:bg-sky-500/[0.11] sm:flex-none"
            >
              Voir l’événement
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}