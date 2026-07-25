"use client";

import {
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Ticket,
} from "lucide-react";

export type ClientOrderSummaryItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ClientOrderSummaryProps = {
  items: readonly ClientOrderSummaryItem[];

  currency?: string;

  platformFeeRate?: number;
  fixedFeeAmount?: number;

  title?: string;

  checkoutLabel?: string;
  emptySelectionLabel?: string;

  disabled?: boolean;
  loading?: boolean;

  showCheckoutButton?: boolean;

  className?: string;

  onCheckout?: () => void | Promise<void>;
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

function normalizeQuantity(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(
        Math.trunc(value),
        0,
      )
    : 0;
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
      normalizeAmount(
        amount,
      ),
    );
  } catch {
    return `${normalizeAmount(
      amount,
    ).toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

export default function ClientOrderSummary({
  items,

  currency =
    "XOF",

  platformFeeRate = 0,
  fixedFeeAmount = 0,

  title =
    "Résumé de la commande",

  checkoutLabel =
    "Passer à la caisse",

  emptySelectionLabel =
    "Sélectionnez au moins un billet",

  disabled = false,
  loading = false,

  showCheckoutButton = true,

  className,

  onCheckout,
}: ClientOrderSummaryProps) {
  const normalizedItems =
    items
      .map(
        (
          item,
        ) => ({
          ...item,

          quantity:
            normalizeQuantity(
              item.quantity,
            ),

          unitPrice:
            normalizeAmount(
              item.unitPrice,
            ),
        }),
      )
      .filter(
        (
          item,
        ) =>
          item.quantity >
          0,
      );

  const selectedTicketsCount =
    normalizedItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const subtotal =
    normalizedItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.unitPrice *
          item.quantity,
      0,
    );

  const normalizedFeeRate =
    Number.isFinite(
      platformFeeRate,
    )
      ? Math.max(
          platformFeeRate,
          0,
        )
      : 0;

  const percentageFee =
    subtotal *
    (
      normalizedFeeRate /
      100
    );

  const fixedFee =
    normalizeAmount(
      fixedFeeAmount,
    );

  const serviceFee =
    percentageFee +
    fixedFee;

  const total =
    subtotal +
    serviceFee;

  const hasSelection =
    selectedTicketsCount >
    0;

  const isCheckoutDisabled =
    disabled ||
    loading ||
    !hasSelection ||
    !onCheckout;

  async function handleCheckout(): Promise<void> {
    if (
      isCheckoutDisabled ||
      !onCheckout
    ) {
      return;
    }

    await onCheckout();
  }

  return (
    <section
      aria-labelledby="client-order-summary-title"
      className={cn(
        "w-full rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
          <ReceiptText
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <div className="min-w-0">
          <h2
            id="client-order-summary-title"
            className="text-base font-black text-white sm:text-lg"
          >
            {
              title
            }
          </h2>

          <p className="mt-1 text-xs text-neutral-600">
            Vérifiez vos billets avant de continuer.
          </p>
        </div>
      </div>

      {hasSelection ? (
        <div className="mt-5 space-y-3">
          {normalizedItems.map(
            (
              item,
            ) => (
              <article
                key={
                  item.id
                }
                className="flex items-start justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400">
                    <Ticket
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </span>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-white">
                      {
                        item.name
                      }
                    </h3>

                    <p className="mt-1 text-xs text-neutral-600">
                      {
                        item.quantity
                      }{" "}
                      ×{" "}
                      {
                        formatMoney({
                          amount:
                            item.unitPrice,

                          currency,
                        })
                      }
                    </p>
                  </div>
                </div>

                <p className="shrink-0 text-sm font-black text-white">
                  {
                    formatMoney({
                      amount:
                        item.unitPrice *
                        item.quantity,

                      currency,
                    })
                  }
                </p>
              </article>
            ),
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 py-8 text-center">
          <Ticket
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-neutral-700"
          />

          <p className="mt-3 text-sm font-black text-neutral-400">
            Aucun billet sélectionné
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-700">
            Choisissez une quantité pour afficher le total.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-500">
            Sous-total
          </span>

          <strong className="font-black text-white">
            {
              formatMoney({
                amount:
                  subtotal,

                currency,
              })
            }
          </strong>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-500">
            Frais de service
          </span>

          <strong className="font-black text-white">
            {
              formatMoney({
                amount:
                  serviceFee,

                currency,
              })
            }
          </strong>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-600">
              Total
            </p>

            <p className="mt-1 text-[11px] text-neutral-700">
              {
                selectedTicketsCount
              }{" "}
              billet
              {selectedTicketsCount >
              1
                ? "s"
                : ""}
            </p>
          </div>

          <p
            aria-live="polite"
            className="text-xl font-black text-lime-400 sm:text-2xl"
          >
            {
              formatMoney({
                amount:
                  total,

                currency,
              })
            }
          </p>
        </div>
      </div>

      {showCheckoutButton && (
        <button
          type="button"
          onClick={() => {
            void handleCheckout();
          }}
          disabled={
            isCheckoutDisabled
          }
          aria-busy={
            loading
          }
          className={cn(
            "mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-lime-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071014]",
            isCheckoutDisabled
              ? "cursor-not-allowed border border-white/[0.07] bg-white/[0.035] text-neutral-600"
              : "bg-gradient-to-r from-lime-500 via-orange-500 to-red-500 text-white shadow-[0_16px_40px_rgba(249,115,22,0.22)] hover:brightness-110 active:scale-[0.99]",
          )}
        >
          {loading ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
          ) : (
            <LockKeyhole
              aria-hidden="true"
              className="h-4 w-4"
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
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-lime-500/15 bg-lime-500/[0.05] px-3 py-3">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-lime-400"
        />

        <p className="text-[11px] leading-5 text-neutral-500">
          Paiement sécurisé. Le montant final est affiché avant la validation.
        </p>
      </div>
    </section>
  );
}