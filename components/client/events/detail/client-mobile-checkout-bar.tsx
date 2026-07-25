"use client";

import {
  LockKeyhole,
  ShoppingBag,
} from "lucide-react";

export type ClientMobileCheckoutBarProps = {
  totalAmount: number;
  currency?: string;

  selectedTicketsCount?: number;

  checkoutLabel?: string;
  emptySelectionLabel?: string;

  disabled?: boolean;
  loading?: boolean;

  hidden?: boolean;
  className?: string;

  onCheckout: () => void | Promise<void>;
};

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeAmount(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function normalizeTicketsCount(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    Math.trunc(value),
    0,
  );
}

function formatMoney({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          [
            "XOF",
            "XAF",
          ].includes(
            currency,
          )
            ? 0
            : 2,
      },
    ).format(
      amount,
    );
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

export default function ClientMobileCheckoutBar({
  totalAmount,
  currency =
    "XOF",

  selectedTicketsCount = 0,

  checkoutLabel =
    "Passer à la caisse",

  emptySelectionLabel =
    "Sélectionnez au moins un billet",

  disabled = false,
  loading = false,

  hidden = false,
  className,

  onCheckout,
}: ClientMobileCheckoutBarProps) {
  const normalizedTotal =
    normalizeAmount(
      totalAmount,
    );

  const normalizedCount =
    normalizeTicketsCount(
      selectedTicketsCount,
    );

  const hasSelection =
    normalizedCount > 0;

  const isDisabled =
    disabled ||
    loading ||
    !hasSelection;

  if (
    hidden
  ) {
    return null;
  }

  async function handleCheckout(): Promise<void> {
    if (
      isDisabled
    ) {
      return;
    }

    await onCheckout();
  }

  return (
    <aside
      aria-label="Résumé mobile de commande"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[80] border-t border-white/[0.09] bg-[#03070a]/96 px-4 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.5)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#03070a]/86 lg:hidden",
        "pb-[max(12px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <div className="min-w-0 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
            Total
          </p>

          <p
            aria-live="polite"
            className="mt-0.5 truncate text-xl font-black leading-none text-lime-400"
          >
            {formatMoney({
              amount:
                normalizedTotal,

              currency,
            })}
          </p>

          <p className="mt-1 text-[10px] text-neutral-600">
            {hasSelection
              ? `${normalizedCount} billet${
                  normalizedCount > 1
                    ? "s"
                    : ""
                } sélectionné${
                  normalizedCount > 1
                    ? "s"
                    : ""
                }`
              : "Aucun billet sélectionné"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleCheckout();
          }}
          disabled={
            isDisabled
          }
          aria-busy={
            loading
          }
          className={cn(
            "group ml-auto inline-flex min-h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-white outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-lime-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070a]",
            isDisabled
              ? "cursor-not-allowed border border-white/[0.07] bg-white/[0.035] text-neutral-600"
              : "bg-gradient-to-r from-lime-500 via-orange-500 to-red-500 shadow-[0_16px_40px_rgba(249,115,22,0.22)] hover:brightness-110 active:scale-[0.99]",
          )}
        >
          {loading ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
          ) : hasSelection ? (
            <LockKeyhole
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
          ) : (
            <ShoppingBag
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
          )}

          <span className="truncate">
            {loading
              ? "Préparation…"
              : hasSelection
                ? checkoutLabel
                : emptySelectionLabel}
          </span>
        </button>
      </div>

      <p className="mt-2 text-center text-[9px] font-medium text-neutral-700">
        Paiement sécurisé et données protégées
      </p>
    </aside>
  );
}