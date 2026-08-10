"use client";

import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import CheckoutCouponForm, {
  type CheckoutCouponAmounts,
  type CheckoutCouponResult,
} from "@/components/checkout/coupon/checkout-coupon-form";
import CheckoutDiscountRow from "@/components/checkout/coupon/checkout-discount-row";

import type {
  CheckoutOrderItem,
} from "./checkout-order-summary";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatMoney(value: string, currency: string): string {
  const amount = Number.parseFloat(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase() || "XOF",
      maximumFractionDigits:
        currency.toUpperCase() === "XOF" ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toLocaleString("fr-FR") : "0"} ${currency}`;
  }
}

export default function CheckoutSummary({
  orderId,
  eventId,
  checkoutToken,
  reference,
  currency,
  items,
  amounts,
  appliedCoupon,
  expired,
  submitting,
  errorMessage,
  onCouponApplied,
  onCouponRemoved,
  onPay,
  onCancel,
}: {
  orderId: string;
  eventId: string;
  checkoutToken: string;
  reference: string;
  currency: string;
  items: readonly CheckoutOrderItem[];
  amounts: CheckoutCouponAmounts;
  appliedCoupon: CheckoutCouponResult | null;
  expired: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onCouponApplied: (result: CheckoutCouponResult) => void;
  onCouponRemoved: (amounts: CheckoutCouponAmounts) => void;
  onPay: () => void;
  onCancel: () => void;
}) {
  const tokenQuery = `checkoutToken=${encodeURIComponent(checkoutToken)}`;

  return (
    <aside className="min-w-0">
      <div className="xl:sticky xl:top-28">
        <div className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Résumé</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-600">
                {reference}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {item.ticketTypeName}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.quantity} × {formatMoney(item.unitPrice, currency)}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-black text-white">
                    {formatMoney(item.subtotal, currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/[0.08] pt-5">
            <CheckoutCouponForm
              orderId={orderId}
              eventId={eventId}
              initialCoupon={appliedCoupon}
              disabled={submitting || expired}
              validateEndpoint={`/api/client/checkout/coupons/validate?${tokenQuery}`}
              applyEndpoint={`/api/client/checkout/coupons/apply?${tokenQuery}`}
              removeEndpoint={`/api/client/checkout/coupons/remove?${tokenQuery}`}
              onApplied={onCouponApplied}
              onRemoved={onCouponRemoved}
            />
          </div>

          <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-5 text-sm">
            <div className="flex items-center justify-between gap-4 text-neutral-400">
              <span>Sous-total</span>
              <span className="font-bold text-white">
                {formatMoney(amounts.subtotal, currency)}
              </span>
            </div>

            <CheckoutDiscountRow
              amount={amounts.discountAmount}
              currency={currency}
              code={appliedCoupon?.coupon.code ?? null}
            />

            <div className="flex items-center justify-between gap-4 text-neutral-400">
              <span>Frais</span>
              <span className="font-bold text-white">
                {formatMoney(amounts.discountedPlatformFee, currency)}
              </span>
            </div>

            <div className="flex items-end justify-between gap-4 border-t border-white/[0.08] pt-4">
              <span className="text-sm font-black text-white">Total</span>
              <span className="text-2xl font-black text-lime-400">
                {formatMoney(amounts.total, currency)}
              </span>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4 text-sm leading-6 text-red-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onPay}
            disabled={submitting || expired}
            className={cn(
              "mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-5 text-sm font-black text-black shadow-[0_18px_45px_rgba(132,204,22,0.16)] transition",
              !submitting &&
                !expired &&
                "hover:brightness-110 active:scale-[0.99]",
              (submitting || expired) &&
                "cursor-not-allowed opacity-55",
            )}
          >
            {submitting ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Préparation
              </>
            ) : expired ? (
              <>
                <Clock3 className="h-5 w-5" />
                Réservation expirée
              </>
            ) : (
              <>
                <LockKeyhole className="h-5 w-5" />
                Payer maintenant
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="mt-3 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] text-sm font-bold text-neutral-400 transition hover:border-white/[0.16] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Annuler
          </button>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/10 p-3 text-xs font-bold text-neutral-400">
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              Paiement vérifié
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/10 p-3 text-xs font-bold text-neutral-400">
              <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-400" />
              Données protégées
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
