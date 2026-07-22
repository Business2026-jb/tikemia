"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  MoreHorizontal,
  Phone,
  ReceiptText,
  RefreshCcw,
  SearchX,
  ShieldCheck,
  TicketCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  OrganizerPaymentListItem,
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type PaymentsTableProps = {
  payments: OrganizerPaymentsData["payments"];
  currency: OrganizerPaymentsData["currency"];
  pagination?: OrganizerPaymentsData["pagination"];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

type PaymentStatusTone = {
  label: string;
  className: string;
  dotClassName: string;
  icon: ReactNode;
};

function safeNumber(value: number): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const normalized = safeNumber(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" ||
        currency === "XAF"
          ? 0
          : 2,
    }).format(normalized);
  } catch {
    return `${formatNumber(normalized)} ${currency}`;
  }
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Non renseigné";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizeLabel(value: string): string {
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
          "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300",
        dotClassName:
          "bg-emerald-400",
        icon: (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ),
      };

    case "PENDING":
      return {
        label: "En attente",
        className:
          "border-orange-500/20 bg-orange-500/[0.07] text-orange-300",
        dotClassName:
          "bg-orange-400",
        icon: (
          <Clock3 className="h-3.5 w-3.5" />
        ),
      };

    case "FAILED":
      return {
        label: "Échoué",
        className:
          "border-red-500/20 bg-red-500/[0.07] text-red-300",
        dotClassName:
          "bg-red-400",
        icon: (
          <XCircle className="h-3.5 w-3.5" />
        ),
      };

    case "REFUNDED":
      return {
        label: "Remboursé",
        className:
          "border-violet-500/20 bg-violet-500/[0.07] text-violet-300",
        dotClassName:
          "bg-violet-400",
        icon: (
          <RefreshCcw className="h-3.5 w-3.5" />
        ),
      };

    default:
      return {
        label: normalizeLabel(status),
        className:
          "border-white/[0.08] bg-white/[0.03] text-neutral-300",
        dotClassName:
          "bg-neutral-500",
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

  const copyValue =
    useCallback(async () => {
      try {
        await navigator.clipboard.writeText(
          value,
        );

        setCopied(true);

        window.setTimeout(
          () =>
            setCopied(false),
          1500,
        );
      } catch {
        setCopied(false);
      }
    }, [value]);

  return (
    <button
      type="button"
      onClick={copyValue}
      title={`Copier ${label}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-neutral-500 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center px-5 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <SearchX className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        {title}
      </h3>

      <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
        {description}
      </p>
    </div>
  );
}

function MobilePaymentCard({
  payment,
}: {
  payment: OrganizerPaymentListItem;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.075] bg-[#050c10] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {payment.order.customerName ||
              "Client non renseigné"}
          </p>

          <p className="mt-1 truncate text-[10px] text-neutral-500">
            {payment.order.customerEmail}
          </p>
        </div>

        <PaymentStatusBadge
          status={payment.status}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
            Montant
          </p>

          <p className="mt-1 text-sm font-black text-white">
            {formatMoney(
              payment.amount,
              payment.currency,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
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

      <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Événement
          </span>

          <Link
            href={`/organizer/events/${payment.event.id}`}
            className="inline-flex min-w-0 items-center gap-1 text-right font-bold text-sky-300 hover:text-sky-200"
          >
            <span className="truncate">
              {payment.event.title}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Commande
          </span>

          <Link
            href={`/organizer/orders/${payment.order.id}`}
            className="inline-flex items-center gap-1 font-bold text-neutral-300 hover:text-white"
          >
            {payment.order.reference}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Méthode
          </span>

          <span className="font-semibold text-neutral-300">
            {normalizeLabel(payment.method)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Prestataire
          </span>

          <span className="font-semibold text-neutral-300">
            {normalizeLabel(payment.provider)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Date
          </span>

          <span className="text-right font-semibold text-neutral-300">
            {formatDateTime(
              payment.paidAt ??
                payment.createdAt,
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <div className="flex items-center gap-2">
          {payment.providerReference && (
            <CopyButton
              value={
                payment.providerReference
              }
              label="la référence du paiement"
            />
          )}

          <CopyButton
            value={
              payment.order.reference
            }
            label="la référence de la commande"
          />
        </div>

        <Link
          href={`/organizer/orders/${payment.order.id}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[11px] font-bold text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
        >
          Voir le détail
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

export default function PaymentsTable({
  payments,
  currency,
  pagination,
  title = "Transactions",
  description =
    "Consultez les paiements, commandes, clients, méthodes et montants nets en temps réel.",
  emptyTitle =
    "Aucune transaction trouvée",
  emptyDescription =
    "Les paiements correspondant à vos critères apparaîtront ici.",
}: PaymentsTableProps) {
  const totals =
    useMemo(
      () =>
        payments.reduce(
          (
            result,
            payment,
          ) => ({
            amount:
              result.amount +
              safeNumber(
                payment.amount,
              ),
            net:
              result.net +
              safeNumber(
                payment.financials.organizerNet,
              ),
            fees:
              result.fees +
              safeNumber(
                payment.financials.platformFee,
              ),
            successful:
              result.successful +
              (payment.status ===
              "SUCCESS"
                ? 1
                : 0),
          }),
          {
            amount: 0,
            net: 0,
            fees: 0,
            successful: 0,
          },
        ),
      [payments],
    );

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.04),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.03),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.08]">
            <ReceiptText className="h-4 w-4 text-sky-300" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-bold text-neutral-400">
            <WalletCards className="h-3.5 w-3.5 text-sky-300" />
            {pagination?.totalItems ??
              payments.length} transaction
            {(pagination?.totalItems ??
              payments.length) > 1
              ? "s"
              : ""}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Données sécurisées
          </span>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="relative">
          <EmptyState
            title={emptyTitle}
            description={
              emptyDescription
            }
          />
        </div>
      ) : (
        <>
          <div className="relative grid w-full min-w-0 gap-3 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
            <div className="rounded-xl border border-lime-500/20 bg-lime-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-lime-400/70">
                Montant affiché
              </p>

              <p className="mt-2 text-lg font-black text-lime-300">
                {formatMoney(
                  totals.amount,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400/70">
                Net organisateur
              </p>

              <p className="mt-2 text-lg font-black text-emerald-300">
                {formatMoney(
                  totals.net,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-orange-400/70">
                Commissions
              </p>

              <p className="mt-2 text-lg font-black text-orange-300">
                {formatMoney(
                  totals.fees,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-400/70">
                Réussis
              </p>

              <p className="mt-2 text-lg font-black text-sky-300">
                {formatNumber(
                  totals.successful,
                )}
              </p>
            </div>
          </div>

          <div className="relative hidden w-full min-w-0 overflow-x-auto lg:block">
            <table className="w-full min-w-[1320px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.018]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Événement
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Commande
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Méthode
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Référence
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Brut
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Net
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map(
                  (
                    payment,
                    index,
                  ) => (
                    <tr
                      key={payment.id}
                      className={`border-b border-white/[0.055] transition hover:bg-white/[0.022] ${
                        index % 2 === 0
                          ? "bg-transparent"
                          : "bg-white/[0.008]"
                      }`}
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="min-w-[190px]">
                          <p className="truncate text-sm font-black text-white">
                            {payment.order.customerName ||
                              "Client non renseigné"}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-500">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {payment.order.customerEmail}
                            </span>
                          </div>

                          {payment.order.customerPhone && (
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-600">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {payment.order.customerPhone}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <Link
                          href={`/organizer/events/${payment.event.id}`}
                          className="group block min-w-[180px]"
                        >
                          <p className="truncate text-sm font-bold text-neutral-200 transition group-hover:text-sky-300">
                            {payment.event.title}
                          </p>

                          <p className="mt-1 truncate text-[10px] text-neutral-600">
                            {payment.event.city},{" "}
                            {payment.event.country}
                          </p>
                        </Link>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <div className="flex min-w-[150px] items-center gap-2">
                          <Link
                            href={`/organizer/orders/${payment.order.id}`}
                            className="truncate text-xs font-black text-sky-300 hover:text-sky-200"
                          >
                            {payment.order.reference}
                          </Link>

                          <CopyButton
                            value={payment.order.reference}
                            label="la référence de la commande"
                          />
                        </div>

                        <p className="mt-1 text-[10px] text-neutral-600">
                          {normalizeLabel(
                            payment.order.status,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <div className="min-w-[150px]">
                          <p className="text-xs font-black text-neutral-200">
                            {normalizeLabel(
                              payment.method,
                            )}
                          </p>

                          <p className="mt-1 text-[10px] text-neutral-600">
                            {normalizeLabel(
                              payment.provider,
                            )}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <div className="flex min-w-[145px] items-center gap-2">
                          <span className="truncate font-mono text-[10px] text-neutral-400">
                            {payment.providerReference ??
                              "Non disponible"}
                          </span>

                          {payment.providerReference && (
                            <CopyButton
                              value={payment.providerReference}
                              label="la référence du paiement"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-black text-white">
                          {formatMoney(
                            payment.amount,
                            payment.currency,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-black text-orange-300">
                          {formatMoney(
                            payment.financials.platformFee,
                            payment.currency,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-black text-emerald-300">
                          {formatMoney(
                            payment.financials.organizerNet,
                            payment.currency,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <PaymentStatusBadge
                          status={payment.status}
                        />

                        {payment.failureReason && (
                          <p className="mt-2 max-w-[180px] truncate text-[10px] text-red-300/70">
                            {payment.failureReason}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <p className="min-w-[130px] text-[11px] font-semibold text-neutral-300">
                          {formatDateTime(
                            payment.paidAt ??
                              payment.createdAt,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/organizer/orders/${payment.order.id}`}
                            title="Voir la commande"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>

                          <button
                            type="button"
                            title="Plus d’actions"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          <div className="relative grid gap-3 p-4 sm:p-5 lg:hidden">
            {payments.map(
              (payment) => (
                <MobilePaymentCard
                  key={payment.id}
                  payment={payment}
                />
              ),
            )}
          </div>

          {pagination && (
            <div className="relative flex w-full flex-col gap-3 border-t border-white/[0.07] px-4 py-4 text-[10px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:px-6">
              <span>
                Page {pagination.page} sur{" "}
                {pagination.totalPages}
              </span>

              <div className="flex items-center gap-2">
                <span>
                  {pagination.totalItems} résultat
                  {pagination.totalItems > 1
                    ? "s"
                    : ""}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-neutral-500">
                  {pagination.hasPreviousPage ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <TicketCheck className="h-3 w-3" />
                  )}
                  {pagination.hasNextPage ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : null}
                  {pagination.pageSize} par page
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}