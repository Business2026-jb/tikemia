"use client";

import type {
  PromoCodeStatus,
} from "@prisma/client";
import {
  Archive,
  BadgePercent,
  CalendarClock,
  Check,
  Copy,
  Eye,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  SearchX,
  ShoppingCart,
  Tag,
  Trash2,
  WalletCards,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  OrganizerMarketingPromoCodeItem,
} from "@/lib/organizer/get-organizer-marketing";

export type PromoCodesTableProps = {
  promoCodes:
    readonly OrganizerMarketingPromoCodeItem[];

  currency?: string;
  locale?: string;

  isLoading?: boolean;
  className?: string;

  onView?:
    (
      promoCode:
        OrganizerMarketingPromoCodeItem,
    ) => void;

  onEdit?:
    (
      promoCode:
        OrganizerMarketingPromoCodeItem,
    ) => void;

  onDuplicate?:
    (
      promoCode:
        OrganizerMarketingPromoCodeItem,
    ) => void;

  onStatusChange?:
    (
      promoCode:
        OrganizerMarketingPromoCodeItem,
      status:
        PromoCodeStatus,
    ) => void;

  onDelete?:
    (
      promoCode:
        OrganizerMarketingPromoCodeItem,
    ) => void;
};

type StatusPresentation = {
  label: string;
  icon:
    typeof Check;
  className: string;
};

const STATUS_PRESENTATIONS:
  Record<
    PromoCodeStatus,
    StatusPresentation
  > = {
    DRAFT: {
      label:
        "Brouillon",
      icon:
        Pencil,
      className:
        "border-neutral-400/20 bg-neutral-400/10 text-neutral-300",
    },
    SCHEDULED: {
      label:
        "Programmé",
      icon:
        CalendarClock,
      className:
        "border-blue-400/20 bg-blue-400/10 text-blue-300",
    },
    ACTIVE: {
      label:
        "Actif",
      icon:
        Check,
      className:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    },
    EXPIRED: {
      label:
        "Expiré",
      icon:
        Pause,
      className:
        "border-amber-400/20 bg-amber-400/10 text-amber-300",
    },
    DISABLED: {
      label:
        "Désactivé",
      icon:
        Pause,
      className:
        "border-rose-400/20 bg-rose-400/10 text-rose-300",
    },
    ARCHIVED: {
      label:
        "Archivé",
      icon:
        Archive,
      className:
        "border-violet-400/20 bg-violet-400/10 text-violet-300",
    },
  };

function joinClassNames(
  ...values:
    Array<
      string |
      false |
      null |
      undefined
    >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function toSafeNumber(
  value: number,
): number {
  return Number.isFinite(
    value,
  )
    ? Math.max(
        value,
        0,
      )
    : 0;
}

function formatNumber(
  value: number,
  locale: string,
  maximumFractionDigits =
    0,
): string {
  return new Intl.NumberFormat(
    locale,
    {
      maximumFractionDigits,
    },
  ).format(
    toSafeNumber(
      value,
    ),
  );
}

function formatMoney(
  value: number,
  currency: string,
  locale: string,
): string {
  const amount =
    toSafeNumber(
      value,
    );

  try {
    return new Intl.NumberFormat(
      locale,
      {
        style:
          "currency",
        currency,
        minimumFractionDigits:
          currency ===
            "XOF" ||
          currency ===
            "XAF"
            ? 0
            : 2,
        maximumFractionDigits:
          currency ===
            "XOF" ||
          currency ===
            "XAF"
            ? 0
            : 2,
      },
    ).format(
      amount,
    );
  } catch {
    return `${formatNumber(
      amount,
      locale,
    )} ${currency}`;
  }
}

function formatDate(
  value:
    | string
    | null,
  locale: string,
): string {
  if (!value) {
    return "Non définie";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
    },
  ).format(
    date,
  );
}

function getDiscountLabel({
  discountType,
  discountValue,
  currency,
  locale,
}: {
  discountType:
    string;
  discountValue:
    number;
  currency:
    string;
  locale:
    string;
}): string {
  if (
    discountType ===
      "PERCENTAGE" ||
    discountType ===
      "PERCENT"
  ) {
    return `${formatNumber(
      discountValue,
      locale,
      2,
    )} %`;
  }

  if (
    discountType ===
      "FREE_SERVICE_FEE" ||
    discountType ===
      "SERVICE_FEE"
  ) {
    return "Frais offerts";
  }

  return formatMoney(
    discountValue,
    currency,
    locale,
  );
}

function StatusBadge({
  status,
}: {
  status:
    PromoCodeStatus;
}) {
  const presentation =
    STATUS_PRESENTATIONS[
      status
    ];

  const Icon =
    presentation.icon;

  return (
    <span
      className={joinClassNames(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
        presentation.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {
        presentation.label
      }
    </span>
  );
}

function TableLoadingState() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-separate border-spacing-0">
        <thead>
          <tr>
            {Array.from(
              {
                length:
                  11,
              },
              (
                _,
                index,
              ) => (
                <th
                  key={
                    index
                  }
                  className="border-b border-white/[0.07] px-3 pb-3"
                >
                  <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {Array.from(
            {
              length:
                5,
            },
            (
              _,
              rowIndex,
            ) => (
              <tr
                key={
                  rowIndex
                }
              >
                {Array.from(
                  {
                    length:
                      11,
                  },
                  (
                    __,
                    cellIndex,
                  ) => (
                    <td
                      key={
                        cellIndex
                      }
                      className="border-b border-white/[0.055] px-3 py-4"
                    >
                      <div className="h-4 animate-pulse rounded bg-white/[0.05]" />
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.018] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
        <SearchX className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-black text-white">
        Aucun code promo disponible
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Créez un code promo ou modifiez vos filtres pour afficher des résultats.
      </p>
    </div>
  );
}

function ActionsMenu({
  promoCode,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: {
  promoCode:
    OrganizerMarketingPromoCodeItem;

  isOpen:
    boolean;

  onToggle:
    () => void;

  onClose:
    () => void;

  onView?:
    PromoCodesTableProps["onView"];

  onEdit?:
    PromoCodesTableProps["onEdit"];

  onDuplicate?:
    PromoCodesTableProps["onDuplicate"];

  onStatusChange?:
    PromoCodesTableProps["onStatusChange"];

  onDelete?:
    PromoCodesTableProps["onDelete"];
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={
          onToggle
        }
        aria-haspopup="menu"
        aria-expanded={
          isOpen
        }
        aria-label={`Actions pour le code ${promoCode.code}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={
              onClose
            }
            className="fixed inset-0 z-20 cursor-default"
          />

          <div
            role="menu"
            className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1519] p-1.5 shadow-2xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onView?.(
                  promoCode,
                );
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
            >
              <Eye className="h-4 w-4" />
              Voir les détails
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onEdit?.(
                  promoCode,
                );
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onDuplicate?.(
                  promoCode,
                );
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
            >
              <Copy className="h-4 w-4" />
              Dupliquer
            </button>

            <div className="my-1 h-px bg-white/[0.07]" />

            {promoCode.status ===
            "ACTIVE" ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onStatusChange?.(
                    promoCode,
                    "DISABLED",
                  );
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-amber-300 hover:bg-amber-400/[0.08]"
              >
                <Pause className="h-4 w-4" />
                Désactiver
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onStatusChange?.(
                    promoCode,
                    "ACTIVE",
                  );
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-300 hover:bg-emerald-400/[0.08]"
              >
                <Play className="h-4 w-4" />
                Activer
              </button>
            )}

            {promoCode.status !==
              "ARCHIVED" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onStatusChange?.(
                    promoCode,
                    "ARCHIVED",
                  );
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
              >
                <Archive className="h-4 w-4" />
                Archiver
              </button>
            )}

            <div className="my-1 h-px bg-white/[0.07]" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onDelete?.(
                  promoCode,
                );
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-300 hover:bg-rose-400/[0.08]"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function PromoCodesTable({
  promoCodes,
  currency = "XOF",
  locale = "fr-FR",
  isLoading = false,
  className,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: PromoCodesTableProps) {
  const [
    openMenuId,
    setOpenMenuId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    copiedPromoCodeId,
    setCopiedPromoCodeId,
  ] =
    useState<string | null>(
      null,
    );

  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase() ||
    "XOF";

  const sortedPromoCodes =
    useMemo(
      () =>
        [...promoCodes].sort(
          (
            left,
            right,
          ) =>
            new Date(
              right.createdAt,
            ).getTime() -
            new Date(
              left.createdAt,
            ).getTime(),
        ),
      [
        promoCodes,
      ],
    );

  async function copyPromoCode(
    promoCode:
      OrganizerMarketingPromoCodeItem,
  ) {
    try {
      await navigator.clipboard.writeText(
        promoCode.code,
      );

      setCopiedPromoCodeId(
        promoCode.id,
      );

      window.setTimeout(
        () => {
          setCopiedPromoCodeId(
            (
              current,
            ) =>
              current ===
              promoCode.id
                ? null
                : current,
          );
        },
        2_000,
      );
    } catch {
      setCopiedPromoCodeId(
        null,
      );
    }
  }

  return (
    <section
      aria-labelledby="promo-codes-table-title"
      className={joinClassNames(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] shadow-[0_20px_65px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-white/[0.07] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
            Tableau détaillé
          </p>

          <h2
            id="promo-codes-table-title"
            className="mt-1 text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
          >
            Codes promo
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
            Consultez les remises, utilisations, revenus attribués et actions disponibles.
          </p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-bold text-neutral-400">
          {formatNumber(
            sortedPromoCodes.length,
            locale,
          )}{" "}
          code
          {sortedPromoCodes.length >
          1
            ? "s"
            : ""}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <TableLoadingState />
        ) : sortedPromoCodes.length ===
          0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  {[
                    "Code",
                    "Événement",
                    "Campagne",
                    "Statut",
                    "Réduction",
                    "Utilisations",
                    "Remises",
                    "Commandes",
                    "Revenus",
                    "Validité",
                    "",
                  ].map(
                    (
                      label,
                    ) => (
                      <th
                        key={
                          label ||
                          "actions"
                        }
                        scope="col"
                        className="border-b border-white/[0.07] px-3 pb-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600"
                      >
                        {
                          label
                        }
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {sortedPromoCodes.map(
                  (
                    promoCode,
                  ) => (
                    <tr
                      key={
                        promoCode.id
                      }
                      className="group"
                    >
                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <div className="min-w-[150px]">
                          <button
                            type="button"
                            onClick={() => {
                              onView?.(
                                promoCode,
                              );
                            }}
                            className="flex max-w-full items-center gap-2 text-left text-sm font-black tracking-[0.06em] text-white transition hover:text-emerald-300"
                          >
                            <Tag className="h-3.5 w-3.5 shrink-0 text-emerald-400" />

                            <span className="truncate">
                              {
                                promoCode.code
                              }
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              void copyPromoCode(
                                promoCode,
                              );
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[10px] font-bold text-neutral-500 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-emerald-300"
                          >
                            {copiedPromoCodeId ===
                            promoCode.id ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}

                            {copiedPromoCodeId ===
                            promoCode.id
                              ? "Copié"
                              : "Copier"}
                          </button>
                        </div>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <div className="min-w-[170px] max-w-[240px]">
                          <p className="truncate text-sm font-bold text-white">
                            {
                              promoCode.eventTitle
                            }
                          </p>
                        </div>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <span className="inline-flex max-w-[180px] truncate rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                          {
                            promoCode.campaignName ??
                            "Sans campagne"
                          }
                        </span>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <StatusBadge
                          status={
                            promoCode.status
                          }
                        />
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
                          <BadgePercent className="h-3.5 w-3.5 text-amber-400" />

                          {getDiscountLabel({
                            discountType:
                              promoCode.discountType,

                            discountValue:
                              promoCode.discountValue,

                            currency:
                              normalizedCurrency,

                            locale,
                          })}
                        </span>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
                          <ShoppingCart className="h-3.5 w-3.5 text-cyan-400" />

                          {formatNumber(
                            promoCode.usages,
                            locale,
                          )}

                          {promoCode.maximumUses !==
                            null && (
                            <span className="font-semibold text-neutral-600">
                              /{" "}
                              {formatNumber(
                                promoCode.maximumUses,
                                locale,
                              )}
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm font-black text-white">
                          <WalletCards className="h-3.5 w-3.5 text-rose-400" />

                          {formatMoney(
                            promoCode.discountsGranted,
                            normalizedCurrency,
                            locale,
                          )}
                        </span>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4 text-sm font-black text-white">
                        {formatNumber(
                          promoCode.attributedOrders,
                          locale,
                        )}
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4 text-sm font-black text-white">
                        {formatMoney(
                          promoCode.attributedRevenue,
                          normalizedCurrency,
                          locale,
                        )}
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4">
                        <div className="min-w-[130px] text-[11px] leading-5 text-neutral-500">
                          <p>
                            Début :{" "}
                            <span className="font-semibold text-neutral-400">
                              {formatDate(
                                promoCode.startsAt,
                                locale,
                              )}
                            </span>
                          </p>

                          <p>
                            Fin :{" "}
                            <span className="font-semibold text-neutral-400">
                              {formatDate(
                                promoCode.expiresAt,
                                locale,
                              )}
                            </span>
                          </p>
                        </div>
                      </td>

                      <td className="border-b border-white/[0.055] px-3 py-4 text-right">
                        <ActionsMenu
                          promoCode={
                            promoCode
                          }
                          isOpen={
                            openMenuId ===
                            promoCode.id
                          }
                          onToggle={() => {
                            setOpenMenuId(
                              (
                                current,
                              ) =>
                                current ===
                                promoCode.id
                                  ? null
                                  : promoCode.id,
                            );
                          }}
                          onClose={() => {
                            setOpenMenuId(
                              null,
                            );
                          }}
                          onView={
                            onView
                          }
                          onEdit={
                            onEdit
                          }
                          onDuplicate={
                            onDuplicate
                          }
                          onStatusChange={
                            onStatusChange
                          }
                          onDelete={
                            onDelete
                          }
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}