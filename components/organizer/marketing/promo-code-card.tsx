"use client";

import type { PromoCodeStatus } from "@prisma/client";
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
  ShoppingCart,
  Tag,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import type { OrganizerMarketingPromoCodeItem } from "@/lib/organizer/get-organizer-marketing";

export type PromoCodeCardProps = {
  promoCode: OrganizerMarketingPromoCodeItem;
  currency?: string;
  locale?: string;
  className?: string;
  onView?: (promoCode: OrganizerMarketingPromoCodeItem) => void;
  onEdit?: (promoCode: OrganizerMarketingPromoCodeItem) => void;
  onDuplicate?: (promoCode: OrganizerMarketingPromoCodeItem) => void;
  onStatusChange?: (
    promoCode: OrganizerMarketingPromoCodeItem,
    status: PromoCodeStatus,
  ) => void;
  onDelete?: (promoCode: OrganizerMarketingPromoCodeItem) => void;
};

type StatusPresentation = {
  label: string;
  icon: typeof Check;
  className: string;
};

const STATUS_PRESENTATIONS: Record<PromoCodeStatus, StatusPresentation> = {
  DRAFT: {
    label: "Brouillon",
    icon: Pencil,
    className: "border-neutral-400/20 bg-neutral-400/10 text-neutral-300",
  },
  SCHEDULED: {
    label: "Programmé",
    icon: CalendarClock,
    className: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  },
  ACTIVE: {
    label: "Actif",
    icon: Check,
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  EXPIRED: {
    label: "Expiré",
    icon: Pause,
    className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  DISABLED: {
    label: "Désactivé",
    icon: Pause,
    className: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  },
  ARCHIVED: {
    label: "Archivé",
    icon: Archive,
    className: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
};

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatNumber(
  value: number,
  locale: string,
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(safeNumber(value));
}

function formatMoney(value: number, currency: string, locale: string): string {
  const amount = safeNumber(value);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits:
        currency === "XOF" || currency === "XAF" ? 0 : 2,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${formatNumber(amount, locale)} ${currency}`;
  }
}

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "Non définie";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDiscountLabel({
  discountType,
  discountValue,
  currency,
  locale,
}: {
  discountType: string;
  discountValue: number;
  currency: string;
  locale: string;
}): string {
  if (discountType === "PERCENTAGE" || discountType === "PERCENT") {
    return `${formatNumber(discountValue, locale, 2)} %`;
  }

  if (
    discountType === "FREE_SERVICE_FEE" ||
    discountType === "SERVICE_FEE"
  ) {
    return "Frais offerts";
  }

  return formatMoney(discountValue, currency, locale);
}

function StatusBadge({ status }: { status: PromoCodeStatus }) {
  const presentation = STATUS_PRESENTATIONS[status];
  const Icon = presentation.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
        presentation.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {presentation.label}
    </span>
  );
}

export default function PromoCodeCard({
  promoCode,
  currency = "XOF",
  locale = "fr-FR",
  className,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: PromoCodeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalizedCurrency = currency.trim().toUpperCase() || "XOF";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(promoCode.code);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article
      className={cn(
        "relative rounded-2xl border border-white/[0.08] bg-[#081014] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-white/[0.13] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusBadge status={promoCode.status} />

          <button
            type="button"
            onClick={() => onView?.(promoCode)}
            className="mt-3 flex max-w-full items-center gap-2 text-left"
          >
            <Tag className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="truncate text-base font-black tracking-[0.06em] text-white transition hover:text-emerald-300">
              {promoCode.code}
            </span>
          </button>

          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
            {promoCode.eventTitle}
          </p>

          <p className="mt-1 truncate text-[11px] font-semibold text-neutral-600">
            {promoCode.campaignName ?? "Sans campagne associée"}
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions pour le code ${promoCode.code}`}
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMenuOpen(false)}
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
                    setMenuOpen(false);
                    onView?.(promoCode);
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
                    setMenuOpen(false);
                    onEdit?.(promoCode);
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
                    setMenuOpen(false);
                    onDuplicate?.(promoCode);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  Dupliquer
                </button>

                <div className="my-1 h-px bg-white/[0.07]" />

                {promoCode.status === "ACTIVE" ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onStatusChange?.(promoCode, "DISABLED");
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
                      setMenuOpen(false);
                      onStatusChange?.(promoCode, "ACTIVE");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-300 hover:bg-emerald-400/[0.08]"
                  >
                    <Play className="h-4 w-4" />
                    Activer
                  </button>
                )}

                {promoCode.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onStatusChange?.(promoCode, "ARCHIVED");
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
                    setMenuOpen(false);
                    onDelete?.(promoCode);
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
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Réduction
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-black text-white">
            <BadgePercent className="h-3.5 w-3.5 text-amber-400" />
            {getDiscountLabel({
              discountType: promoCode.discountType,
              discountValue: promoCode.discountValue,
              currency: normalizedCurrency,
              locale,
            })}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Utilisations
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-black text-white">
            <ShoppingCart className="h-3.5 w-3.5 text-cyan-400" />
            {formatNumber(promoCode.usages, locale)}
            {promoCode.maximumUses !== null && (
              <span className="font-semibold text-neutral-600">
                / {formatNumber(promoCode.maximumUses, locale)}
              </span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Remises
          </p>
          <p className="mt-1 truncate text-sm font-black text-white">
            {formatMoney(
              promoCode.discountsGranted,
              normalizedCurrency,
              locale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Revenus
          </p>
          <p className="mt-1 truncate text-sm font-black text-white">
            {formatMoney(
              promoCode.attributedRevenue,
              normalizedCurrency,
              locale,
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Période
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-neutral-400">
            {formatDate(promoCode.startsAt, locale)} →{" "}
            {formatDate(promoCode.expiresAt, locale)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
            Commandes attribuées
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-black text-neutral-300">
            <WalletCards className="h-3.5 w-3.5 text-emerald-400" />
            {formatNumber(promoCode.attributedOrders, locale)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          void copyCode();
        }}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-bold text-neutral-300 transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.07] hover:text-emerald-300"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Code copié
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copier le code promo
          </>
        )}
      </button>
    </article>
  );
}