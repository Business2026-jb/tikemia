"use client";

import {
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  HandCoins,
  LoaderCircle,
  MoreHorizontal,
  SearchX,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  OrganizerPayoutListItem,
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type PayoutsTableProps = {
  payouts: OrganizerPaymentsData["payouts"];
  currency: OrganizerPaymentsData["currency"];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

type PayoutStatusTone = {
  label: string;
  className: string;
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

function getPayoutStatusTone(
  status: OrganizerPayoutListItem["status"],
): PayoutStatusTone {
  switch (status) {
    case "PENDING":
      return {
        label: "En attente",
        className:
          "border-orange-500/20 bg-orange-500/[0.08] text-orange-300",
        icon: (
          <Clock3 className="h-3.5 w-3.5" />
        ),
      };

    case "PROCESSING":
      return {
        label: "En cours",
        className:
          "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
        icon: (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ),
      };

    case "PAID":
      return {
        label: "Traité",
        className:
          "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
        icon: (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ),
      };

    case "REJECTED":
      return {
        label: "Annulé / rejeté",
        className:
          "border-red-500/20 bg-red-500/[0.08] text-red-300",
        icon: (
          <Ban className="h-3.5 w-3.5" />
        ),
      };

    default:
      return {
        label: normalizeLabel(status),
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
  const tone = getPayoutStatusTone(status);

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
  const [copied, setCopied] =
    useState(false);

  const handleCopy =
    useCallback(async () => {
      try {
        await navigator.clipboard.writeText(
          value,
        );

        setCopied(true);

        window.setTimeout(
          () => setCopied(false),
          1400,
        );
      } catch {
        setCopied(false);
      }
    }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
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

function PayoutMobileCard({
  payout,
}: {
  payout: OrganizerPayoutListItem;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.075] bg-[#050c10] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {payout.reference ??
              `Retrait ${payout.id.slice(0, 8)}`}
          </p>

          <p className="mt-1 text-[10px] text-neutral-500">
            Demandé le{" "}
            {formatDateTime(
              payout.requestedAt,
            )}
          </p>
        </div>

        <PayoutStatusBadge
          status={payout.status}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
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

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
            Net reçu
          </p>

          <p className="mt-1 text-sm font-black text-emerald-300">
            {formatMoney(
              payout.netAmount,
              payout.currency,
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Frais
          </span>

          <span className="font-semibold text-orange-300">
            {formatMoney(
              payout.fee,
              payout.currency,
            )}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-600">
            Date de traitement
          </span>

          <span className="text-right font-semibold text-neutral-300">
            {formatDateTime(
              payout.processedAt,
            )}
          </span>
        </div>

        {payout.note && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600">
              Note
            </p>

            <p className="mt-1 text-[10px] leading-5 text-neutral-400">
              {payout.note}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <div className="flex items-center gap-2">
          {payout.reference && (
            <CopyButton
              value={payout.reference}
              label="la référence du retrait"
            />
          )}

          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.045] px-2.5 text-[9px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sécurisé
          </span>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[11px] font-bold text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
        >
          Voir le détail
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

export default function PayoutsTable({
  payouts,
  currency,
  title = "Liste des retraits",
  description =
    "Consultez les demandes, montants, frais, statuts et dates de traitement.",
  emptyTitle =
    "Aucun retrait trouvé",
  emptyDescription =
    "Les demandes de retrait correspondant à vos critères apparaîtront ici.",
}: PayoutsTableProps) {
  const totals =
    useMemo(
      () =>
        payouts.reduce(
          (
            result,
            payout,
          ) => ({
            requested:
              result.requested +
              safeNumber(
                payout.amount,
              ),
            fees:
              result.fees +
              safeNumber(
                payout.fee,
              ),
            net:
              result.net +
              safeNumber(
                payout.netAmount,
              ),
            paid:
              result.paid +
              (payout.status === "PAID"
                ? 1
                : 0),
          }),
          {
            requested: 0,
            fees: 0,
            net: 0,
            paid: 0,
          },
        ),
      [payouts],
    );

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.04),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.03),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <HandCoins className="h-4 w-4 text-emerald-300" />
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
            {payouts.length} retrait
            {payouts.length > 1
              ? "s"
              : ""}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Données sécurisées
          </span>
        </div>
      </div>

      {payouts.length === 0 ? (
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
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-400/70">
                Montant demandé
              </p>

              <p className="mt-2 text-lg font-black text-sky-300">
                {formatMoney(
                  totals.requested,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-orange-400/70">
                Frais
              </p>

              <p className="mt-2 text-lg font-black text-orange-300">
                {formatMoney(
                  totals.fees,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400/70">
                Net à recevoir
              </p>

              <p className="mt-2 text-lg font-black text-emerald-300">
                {formatMoney(
                  totals.net,
                  currency,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-violet-400/70">
                Retraits traités
              </p>

              <p className="mt-2 text-lg font-black text-violet-300">
                {formatNumber(
                  totals.paid,
                )}
              </p>
            </div>
          </div>

          <div className="relative hidden w-full min-w-0 overflow-x-auto lg:block">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.018]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Référence
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Montant
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Frais
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Net
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Demandé le
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Traité le
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Note
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {payouts.map(
                  (
                    payout,
                    index,
                  ) => (
                    <tr
                      key={payout.id}
                      className={`border-b border-white/[0.055] transition hover:bg-white/[0.022] ${
                        index % 2 === 0
                          ? "bg-transparent"
                          : "bg-white/[0.008]"
                      }`}
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="flex min-w-[170px] items-center gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-black text-white">
                              {payout.reference ??
                                payout.id}
                            </p>

                            <p className="mt-1 text-[10px] text-neutral-600">
                              ID :{" "}
                              {payout.id.slice(
                                0,
                                10,
                              )}
                            </p>
                          </div>

                          {payout.reference && (
                            <CopyButton
                              value={
                                payout.reference
                              }
                              label="la référence du retrait"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-black text-white">
                          {formatMoney(
                            payout.amount,
                            payout.currency,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-black text-orange-300">
                          {formatMoney(
                            payout.fee,
                            payout.currency,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-black text-emerald-300">
                          {formatMoney(
                            payout.netAmount,
                            payout.currency,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <PayoutStatusBadge
                          status={
                            payout.status
                          }
                        />
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <p className="min-w-[130px] text-[11px] font-semibold text-neutral-300">
                          {formatDateTime(
                            payout.requestedAt,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <p className="min-w-[130px] text-[11px] font-semibold text-neutral-300">
                          {formatDateTime(
                            payout.processedAt,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <p className="max-w-[220px] truncate text-[11px] text-neutral-500">
                          {payout.note ||
                            "Aucune note"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title="Voir le détail"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>

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
            {payouts.map(
              (payout) => (
                <PayoutMobileCard
                  key={payout.id}
                  payout={payout}
                />
              ),
            )}
          </div>

          <div className="relative flex w-full flex-col gap-3 border-t border-white/[0.07] px-4 py-4 text-[10px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:px-6">
            <span>
              {payouts.length} retrait
              {payouts.length > 1
                ? "s"
                : ""}{" "}
              affiché
              {payouts.length > 1
                ? "s"
                : ""}
            </span>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-neutral-500">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Historique sécurisé
            </span>
          </div>
        </>
      )}
    </section>
  );
}