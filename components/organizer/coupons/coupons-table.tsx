"use client";

import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Edit3,
  Eye,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  TicketPercent,
  Trash2,
  Users,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type CouponTableStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED"
  | "ARCHIVED";

export type CouponTableDiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "SERVICE_FEE";

export type CouponTableItem = {
  id: string;
  code: string;
  description?: string | null;

  discountType:
    CouponTableDiscountType;
  discountValue: number;

  minimumOrderAmount?: number | null;
  maximumDiscount?: number | null;

  maximumUses?: number | null;
  usesPerCustomer?: number | null;
  currentUses: number;
  remainingUses?: number | null;
  usageRate?: number;

  startsAt?: string | null;
  expiresAt?: string | null;

  status: CouponTableStatus;
  isActive: boolean;

  currency: string;

  event: {
    id: string;
    title: string;
    slug?: string;
    status?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    currency?: string;
  };

  campaign?: {
    id: string;
    name: string;
    status?: string;
  } | null;

  performance?: {
    usages?: number;
    uniqueCustomers?: number;
    discountsGranted?: number;
    attributedOrders?: number;
    attributedRevenue?: number;
    ticketsGenerated?: number;
    averageOrderValue?: number;
    conversionRate?: number;
  };
};

export type CouponsTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type CouponsTableProps = {
  coupons: readonly CouponTableItem[];
  pagination?: CouponsTablePagination;

  isLoading?: boolean;
  disabled?: boolean;

  onView?: (
    coupon: CouponTableItem,
  ) => void;
  onEdit?: (
    coupon: CouponTableItem,
  ) => void;
  onDuplicate?: (
    coupon: CouponTableItem,
  ) => void;
  onActivate?: (
    coupon: CouponTableItem,
  ) => void;
  onDisable?: (
    coupon: CouponTableItem,
  ) => void;
  onArchive?: (
    coupon: CouponTableItem,
  ) => void;
  onDelete?: (
    coupon: CouponTableItem,
  ) => void;

  onPageChange?: (
    page: number,
  ) => void;

  className?: string;
};

const STATUS_LABELS: Record<
  CouponTableStatus,
  string
> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmé",
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  DISABLED: "Désactivé",
  ARCHIVED: "Archivé",
};

const STATUS_CLASSES: Record<
  CouponTableStatus,
  string
> = {
  DRAFT:
    "border-white/[0.09] bg-white/[0.04] text-neutral-300",
  SCHEDULED:
    "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200",
  ACTIVE:
    "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
  EXPIRED:
    "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  DISABLED:
    "border-rose-400/20 bg-rose-400/[0.08] text-rose-200",
  ARCHIVED:
    "border-violet-400/20 bg-violet-400/[0.08] text-violet-200",
};

function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function formatMoney(
  value: number | null | undefined,
  currency: string,
): string {
  const safeValue =
    Number.isFinite(value)
      ? Number(value)
      : 0;

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          currency?.trim().toUpperCase() ||
          "XOF",
        maximumFractionDigits: 0,
      },
    ).format(safeValue);
  } catch {
    return `${Math.round(
      safeValue,
    ).toLocaleString("fr-FR")} ${
      currency || "XOF"
    }`;
  }
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Non définie";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatDiscount(
  coupon: CouponTableItem,
): string {
  if (
    coupon.discountType ===
    "PERCENTAGE"
  ) {
    return `${coupon.discountValue.toLocaleString(
      "fr-FR",
    )} %`;
  }

  if (
    coupon.discountType ===
    "SERVICE_FEE"
  ) {
    return `Frais : ${formatMoney(
      coupon.discountValue,
      coupon.currency,
    )}`;
  }

  return formatMoney(
    coupon.discountValue,
    coupon.currency,
  );
}

function getUsageText(
  coupon: CouponTableItem,
): string {
  if (
    coupon.maximumUses === null ||
    coupon.maximumUses === undefined
  ) {
    return `${coupon.currentUses.toLocaleString(
      "fr-FR",
    )} / Illimité`;
  }

  return `${coupon.currentUses.toLocaleString(
    "fr-FR",
  )} / ${coupon.maximumUses.toLocaleString(
    "fr-FR",
  )}`;
}

function RowActions({
  coupon,
  disabled,
  onView,
  onEdit,
  onDuplicate,
  onActivate,
  onDisable,
  onArchive,
  onDelete,
}: {
  coupon: CouponTableItem;
  disabled: boolean;
  onView?: (
    coupon: CouponTableItem,
  ) => void;
  onEdit?: (
    coupon: CouponTableItem,
  ) => void;
  onDuplicate?: (
    coupon: CouponTableItem,
  ) => void;
  onActivate?: (
    coupon: CouponTableItem,
  ) => void;
  onDisable?: (
    coupon: CouponTableItem,
  ) => void;
  onArchive?: (
    coupon: CouponTableItem,
  ) => void;
  onDelete?: (
    coupon: CouponTableItem,
  ) => void;
}) {
  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const hasActions =
    onView ||
    onEdit ||
    onDuplicate ||
    onActivate ||
    onDisable ||
    onArchive ||
    onDelete;

  if (!hasActions) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Actions pour le code ${coupon.code}`}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(
            (current) => !current,
          );
        }}
        disabled={disabled}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreHorizontal
          className="h-4 w-4"
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Fermer le menu d’actions"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => {
              setIsOpen(false);
            }}
          />

          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#091318] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {onView ? (
              <ActionButton
                icon={
                  <Eye className="h-4 w-4" />
                }
                label="Voir les détails"
                onClick={() => {
                  setIsOpen(false);
                  onView(coupon);
                }}
              />
            ) : null}

            {onEdit ? (
              <ActionButton
                icon={
                  <Edit3 className="h-4 w-4" />
                }
                label="Modifier"
                onClick={() => {
                  setIsOpen(false);
                  onEdit(coupon);
                }}
              />
            ) : null}

            {onDuplicate ? (
              <ActionButton
                icon={
                  <Copy className="h-4 w-4" />
                }
                label="Dupliquer"
                onClick={() => {
                  setIsOpen(false);
                  onDuplicate(coupon);
                }}
              />
            ) : null}

            {coupon.status !==
              "ACTIVE" &&
            onActivate ? (
              <ActionButton
                icon={
                  <PlayCircle className="h-4 w-4" />
                }
                label="Activer"
                onClick={() => {
                  setIsOpen(false);
                  onActivate(coupon);
                }}
              />
            ) : null}

            {coupon.status ===
              "ACTIVE" &&
            onDisable ? (
              <ActionButton
                icon={
                  <PauseCircle className="h-4 w-4" />
                }
                label="Désactiver"
                onClick={() => {
                  setIsOpen(false);
                  onDisable(coupon);
                }}
              />
            ) : null}

            {coupon.status !==
              "ARCHIVED" &&
            onArchive ? (
              <ActionButton
                icon={
                  <Archive className="h-4 w-4" />
                }
                label="Archiver"
                onClick={() => {
                  setIsOpen(false);
                  onArchive(coupon);
                }}
              />
            ) : null}

            {onDelete ? (
              <>
                <div className="my-1 h-px bg-white/[0.07]" />

                <ActionButton
                  destructive
                  icon={
                    <Trash2 className="h-4 w-4" />
                  }
                  label="Supprimer"
                  onClick={() => {
                    setIsOpen(false);
                    onDelete(coupon);
                  }}
                />
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClassNames(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition",
        destructive
          ? "text-rose-300 hover:bg-rose-400/[0.08]"
          : "text-neutral-300 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DesktopRow({
  coupon,
  disabled,
  ...actions
}: {
  coupon: CouponTableItem;
  disabled: boolean;
} & Pick<
  CouponsTableProps,
  | "onView"
  | "onEdit"
  | "onDuplicate"
  | "onActivate"
  | "onDisable"
  | "onArchive"
  | "onDelete"
>) {
  const usageRate = Math.max(
    0,
    Math.min(
      100,
      coupon.usageRate ??
        (
          coupon.maximumUses
            ? (
                coupon.currentUses /
                coupon.maximumUses
              ) * 100
            : 0
        ),
    ),
  );

  return (
    <tr className="border-t border-white/[0.06] transition hover:bg-white/[0.018]">
      <td className="px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex max-w-[190px] truncate rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 font-mono text-xs font-black uppercase tracking-[0.08em] text-emerald-200">
              {coupon.code}
            </span>

            {coupon.isActive ? (
              <CheckCircle2
                aria-label="Code autorisé"
                className="h-4 w-4 shrink-0 text-emerald-400"
              />
            ) : null}
          </div>

          {coupon.description ? (
            <p className="mt-1.5 max-w-[250px] truncate text-xs font-medium text-neutral-500">
              {coupon.description}
            </p>
          ) : null}
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="max-w-[230px]">
          <p className="truncate text-sm font-extrabold text-white">
            {coupon.event.title}
          </p>

          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
            {coupon.campaign?.name ??
              "Sans campagne associée"}
          </p>
        </div>
      </td>

      <td className="px-5 py-4">
        <p className="text-sm font-black text-white">
          {formatDiscount(coupon)}
        </p>

        {coupon.minimumOrderAmount ? (
          <p className="mt-1 text-xs font-medium text-neutral-500">
            Minimum{" "}
            {formatMoney(
              coupon.minimumOrderAmount,
              coupon.currency,
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs font-medium text-neutral-600">
            Sans minimum
          </p>
        )}
      </td>

      <td className="px-5 py-4">
        <div className="min-w-[150px]">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-black text-white">
              {getUsageText(coupon)}
            </span>

            <span className="font-bold text-neutral-500">
              {Math.round(
                usageRate,
              )}
              %
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{
                width: `${usageRate}%`,
              }}
            />
          </div>

          <p className="mt-1.5 text-[11px] font-medium text-neutral-600">
            {coupon.usesPerCustomer
              ? `${coupon.usesPerCustomer} par client`
              : "Aucune limite par client"}
          </p>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="min-w-[165px] text-xs">
          <p className="font-bold text-neutral-300">
            {formatDate(
              coupon.startsAt,
            )}
          </p>

          <p className="mt-1 font-medium text-neutral-500">
            au{" "}
            {formatDate(
              coupon.expiresAt,
            )}
          </p>
        </div>
      </td>

      <td className="px-5 py-4">
        <span
          className={joinClassNames(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black",
            STATUS_CLASSES[
              coupon.status
            ],
          )}
        >
          {
            STATUS_LABELS[
              coupon.status
            ]
          }
        </span>
      </td>

      <td className="px-5 py-4">
        <div className="min-w-[155px]">
          <p className="text-sm font-black text-white">
            {formatMoney(
              coupon.performance
                ?.attributedRevenue ??
                0,
              coupon.currency,
            )}
          </p>

          <p className="mt-1 text-xs font-medium text-neutral-500">
            {(
              coupon.performance
                ?.attributedOrders ??
              0
            ).toLocaleString(
              "fr-FR",
            )}{" "}
            commande(s)
          </p>
        </div>
      </td>

      <td className="px-5 py-4 text-right">
        <RowActions
          coupon={coupon}
          disabled={disabled}
          {...actions}
        />
      </td>
    </tr>
  );
}

function MobileCard({
  coupon,
  disabled,
  ...actions
}: {
  coupon: CouponTableItem;
  disabled: boolean;
} & Pick<
  CouponsTableProps,
  | "onView"
  | "onEdit"
  | "onDuplicate"
  | "onActivate"
  | "onDisable"
  | "onArchive"
  | "onDelete"
>) {
  const usageRate = Math.max(
    0,
    Math.min(
      100,
      coupon.usageRate ??
        (
          coupon.maximumUses
            ? (
                coupon.currentUses /
                coupon.maximumUses
              ) * 100
            : 0
        ),
    ),
  );

  return (
    <article className="rounded-2xl border border-white/[0.075] bg-white/[0.018] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full truncate rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 font-mono text-xs font-black uppercase tracking-[0.08em] text-emerald-200">
              {coupon.code}
            </span>

            <span
              className={joinClassNames(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black",
                STATUS_CLASSES[
                  coupon.status
                ],
              )}
            >
              {
                STATUS_LABELS[
                  coupon.status
                ]
              }
            </span>
          </div>

          <h3 className="mt-3 truncate text-sm font-black text-white">
            {coupon.event.title}
          </h3>

          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
            {coupon.campaign?.name ??
              "Sans campagne associée"}
          </p>
        </div>

        <RowActions
          coupon={coupon}
          disabled={disabled}
          {...actions}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          icon={
            <TicketPercent className="h-4 w-4" />
          }
          label="Réduction"
          value={formatDiscount(
            coupon,
          )}
        />

        <Metric
          icon={
            <Users className="h-4 w-4" />
          }
          label="Utilisations"
          value={getUsageText(
            coupon,
          )}
        />

        <Metric
          icon={
            <CalendarClock className="h-4 w-4" />
          }
          label="Expiration"
          value={formatDate(
            coupon.expiresAt,
          )}
        />

        <Metric
          icon={
            <CircleDollarSign className="h-4 w-4" />
          }
          label="Revenus"
          value={formatMoney(
            coupon.performance
              ?.attributedRevenue ??
              0,
            coupon.currency,
          )}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-neutral-500">
            Taux d’utilisation
          </span>

          <span className="font-black text-white">
            {Math.round(
              usageRate,
            )}
            %
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{
              width: `${usageRate}%`,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}

        <span className="text-[10px] font-black uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>

      <p className="mt-2 truncate text-xs font-black text-white">
        {value}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <tr
          key={index}
          className="border-t border-white/[0.06]"
        >
          {Array.from({
            length: 8,
          }).map(
            (
              __,
              cellIndex,
            ) => (
              <td
                key={cellIndex}
                className="px-5 py-4"
              >
                <div className="h-9 animate-pulse rounded-xl bg-white/[0.045]" />
              </td>
            ),
          )}
        </tr>
      ))}
    </>
  );
}

export default function CouponsTable({
  coupons,
  pagination,
  isLoading = false,
  disabled = false,
  onView,
  onEdit,
  onDuplicate,
  onActivate,
  onDisable,
  onArchive,
  onDelete,
  onPageChange,
  className,
}: CouponsTableProps) {
  const sortedCoupons =
    useMemo(
      () => [...coupons],
      [coupons],
    );

  const isDisabled =
    disabled || isLoading;

  return (
    <section
      className={joinClassNames(
        "overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071015]",
        className,
      )}
    >
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1280px] border-collapse">
          <thead>
            <tr className="bg-white/[0.018]">
              {[
                "Code",
                "Événement",
                "Réduction",
                "Utilisations",
                "Période",
                "Statut",
                "Performance",
                "Actions",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 last:text-right"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <LoadingRows />
            ) : (
              sortedCoupons.map(
                (coupon) => (
                  <DesktopRow
                    key={coupon.id}
                    coupon={coupon}
                    disabled={
                      isDisabled
                    }
                    onView={onView}
                    onEdit={onEdit}
                    onDuplicate={
                      onDuplicate
                    }
                    onActivate={
                      onActivate
                    }
                    onDisable={
                      onDisable
                    }
                    onArchive={
                      onArchive
                    }
                    onDelete={
                      onDelete
                    }
                  />
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {isLoading
          ? Array.from({
              length: 3,
            }).map((_, index) => (
              <div
                key={index}
                className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]"
              />
            ))
          : sortedCoupons.map(
              (coupon) => (
                <MobileCard
                  key={coupon.id}
                  coupon={coupon}
                  disabled={
                    isDisabled
                  }
                  onView={onView}
                  onEdit={onEdit}
                  onDuplicate={
                    onDuplicate
                  }
                  onActivate={
                    onActivate
                  }
                  onDisable={
                    onDisable
                  }
                  onArchive={
                    onArchive
                  }
                  onDelete={
                    onDelete
                  }
                />
              ),
            )}
      </div>

      {pagination &&
      pagination.totalPages > 1 ? (
        <footer className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs font-medium text-neutral-500">
            Page{" "}
            <strong className="text-neutral-300">
              {pagination.page}
            </strong>{" "}
            sur{" "}
            <strong className="text-neutral-300">
              {pagination.totalPages}
            </strong>{" "}
            ·{" "}
            {pagination.total.toLocaleString(
              "fr-FR",
            )}{" "}
            code(s)
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Page précédente"
              onClick={() => {
                onPageChange?.(
                  pagination.page -
                    1,
                );
              }}
              disabled={
                isDisabled ||
                !pagination.hasPreviousPage
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </button>

            <button
              type="button"
              aria-label="Page suivante"
              onClick={() => {
                onPageChange?.(
                  pagination.page +
                    1,
                );
              }}
              disabled={
                isDisabled ||
                !pagination.hasNextPage
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}