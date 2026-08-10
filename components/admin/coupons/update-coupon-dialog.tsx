"use client";

import {
  LoaderCircle,
  Pencil,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminCouponListItem,
} from "@/lib/admin/coupons/get-admin-coupons";

function toLocalDateTime(
  value:
    Date | string | null,
) {
  if (!value) return "";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const offset =
    date.getTimezoneOffset();

  const local =
    new Date(
      date.getTime() -
        offset *
          60_000,
    );

  return local
    .toISOString()
    .slice(
      0,
      16,
    );
}

export default function UpdateCouponDialog({
  coupon,
  open,
  onClose,
  onSuccess,
}: {
  coupon:
    AdminCouponListItem | null;
  open:
    boolean;
  onClose:
    () => void;
  onSuccess:
    (message: string) => void;
}) {
  const [description, setDescription] =
    useState("");
  const [discountValue, setDiscountValue] =
    useState("");
  const [minimumOrderAmount, setMinimumOrderAmount] =
    useState("");
  const [maximumDiscount, setMaximumDiscount] =
    useState("");
  const [maximumUses, setMaximumUses] =
    useState("");
  const [usesPerCustomer, setUsesPerCustomer] =
    useState("");
  const [startsAt, setStartsAt] =
    useState("");
  const [expiresAt, setExpiresAt] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      open &&
      coupon
    ) {
      setDescription(
        coupon.description ??
          "",
      );
      setDiscountValue(
        coupon.discountValue,
      );
      setMinimumOrderAmount(
        coupon.minimumOrderAmount ??
          "",
      );
      setMaximumDiscount(
        coupon.maximumDiscount ??
          "",
      );
      setMaximumUses(
        coupon.maximumUses ===
          null
          ? ""
          : String(
              coupon.maximumUses,
            ),
      );
      setUsesPerCustomer(
        coupon.usesPerCustomer ===
          null
          ? ""
          : String(
              coupon.usesPerCustomer,
            ),
      );
      setStartsAt(
        toLocalDateTime(
          coupon.startsAt,
        ),
      );
      setExpiresAt(
        toLocalDateTime(
          coupon.expiresAt,
        ),
      );
      setSubmitting(false);
      setError("");
    }

    if (!open) {
      setError("");
      setSubmitting(false);
    }
  }, [open, coupon]);

  if (
    !open ||
    !coupon
  ) {
    return null;
  }

  const currentCoupon =
    coupon;

  async function submit() {
    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/coupons/${encodeURIComponent(
            currentCoupon.id,
          )}/update`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                description:
                  description.trim() ||
                  null,
                discountValue:
                  discountValue.trim(),
                minimumOrderAmount:
                  minimumOrderAmount.trim() ||
                  null,
                maximumDiscount:
                  maximumDiscount.trim() ||
                  null,
                maximumUses:
                  maximumUses.trim()
                    ? Number(
                        maximumUses,
                      )
                    : null,
                usesPerCustomer:
                  usesPerCustomer.trim()
                    ? Number(
                        usesPerCustomer,
                      )
                    : null,
                startsAt:
                  startsAt ||
                  null,
                expiresAt:
                  expiresAt ||
                  null,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          success?:
            boolean;
          message?:
            string;
          error?:
            | string
            | {
                message?:
                  string;
              };
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          typeof payload.error ===
          "string"
            ? payload.error
            : payload.error?.message ||
                "Impossible de modifier le code promo.",
        );
      }

      onSuccess(
        payload.message ||
          "Le code promo a été mis à jour.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de modifier le code promo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:border-fuchsia-400/30";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-fuchsia-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/[0.07] text-fuchsia-300">
            <Pencil className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          Modifier le code promo
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Les nouvelles règles seront appliquées aux prochaines utilisations.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-neutral-400">
              Description
            </span>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              rows={3}
              maxLength={500}
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-fuchsia-400/30"
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Valeur de réduction
            </span>

            <input
              type="number"
              min={0}
              step="0.01"
              value={discountValue}
              onChange={(event) =>
                setDiscountValue(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Montant minimum
            </span>

            <input
              type="number"
              min={0}
              step="0.01"
              value={minimumOrderAmount}
              onChange={(event) =>
                setMinimumOrderAmount(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Plafond de réduction
            </span>

            <input
              type="number"
              min={0}
              step="0.01"
              value={maximumDiscount}
              onChange={(event) =>
                setMaximumDiscount(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Limite totale
            </span>

            <input
              type="number"
              min={currentCoupon.currentUses}
              value={maximumUses}
              onChange={(event) =>
                setMaximumUses(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Limite par client
            </span>

            <input
              type="number"
              min={1}
              value={usesPerCustomer}
              onChange={(event) =>
                setUsesPerCustomer(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Début
            </span>

            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) =>
                setStartsAt(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Expiration
            </span>

            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) =>
                setExpiresAt(
                  event.target.value,
                )
              }
              className={inputClass}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={() =>
              void submit()
            }
            disabled={submitting}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-fuchsia-500 px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
