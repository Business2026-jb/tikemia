"use client";

import {
  CheckCircle2,
  LoaderCircle,
  Tag,
  X,
} from "lucide-react";

export type CheckoutAppliedCoupon = Readonly<{
  id: string;
  code: string;
  description?: string | null;
  discountType: string;
  discountValue: string;
  discountLabel: string;
}>;

export default function CheckoutCouponApplied({
  coupon,
  removing = false,
  onRemove,
}: {
  coupon: CheckoutAppliedCoupon;
  removing?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Tag className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black text-emerald-200">
                {coupon.code}
              </p>

              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Appliqué
              </span>
            </div>

            <p className="mt-1 text-sm font-bold text-white">
              {coupon.discountLabel}
            </p>

            {coupon.description ? (
              <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                {coupon.description}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-xs font-extrabold text-neutral-400 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {removing ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}

          Retirer
        </button>
      </div>
    </div>
  );
}
