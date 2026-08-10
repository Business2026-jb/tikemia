"use client";

import {
  CalendarPlus,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminCouponListItem,
} from "@/lib/admin/coupons/get-admin-coupons";

export default function ExtendCouponDialog({
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
  const [additionalDays, setAdditionalDays] =
    useState("30");
  const [reactivateIfExpired, setReactivateIfExpired] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open) {
      setAdditionalDays("30");
      setReactivateIfExpired(true);
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  if (
    !open ||
    !coupon
  ) {
    return null;
  }

  const currentCoupon =
    coupon;

  const days =
    Number(
      additionalDays,
    );

  const canSubmit =
    Number.isInteger(
      days,
    ) &&
    days >= 1 &&
    days <= 3650 &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/coupons/${encodeURIComponent(
            currentCoupon.id,
          )}/extend`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                additionalDays:
                  days,
                reactivateIfExpired,
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
                "Impossible de prolonger le code promo.",
        );
      }

      onSuccess(
        payload.message ||
          "Le code promo a été prolongé.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de prolonger le code promo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-amber-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] text-amber-300">
            <CalendarPlus className="h-5 w-5" />
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
          Prolonger le code promo
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          La nouvelle expiration ne pourra pas dépasser la fin de l’événement.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Nombre de jours supplémentaires
          </span>

          <input
            type="number"
            min={1}
            max={3650}
            value={additionalDays}
            onChange={(event) =>
              setAdditionalDays(
                event.target.value,
              )
            }
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none focus:border-amber-400/30"
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <input
            type="checkbox"
            checked={reactivateIfExpired}
            onChange={(event) =>
              setReactivateIfExpired(
                event.target.checked,
              )
            }
            className="mt-1"
          />

          <span className="text-sm leading-6 text-neutral-400">
            Réactiver automatiquement si le coupon est expiré ou suspendu.
          </span>
        </label>

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
            disabled={!canSubmit}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-black disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Prolonger
          </button>
        </div>
      </div>
    </div>
  );
}
