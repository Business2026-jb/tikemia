"use client";

import {
  CheckCircle2,
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

export default function ActivateCouponDialog({
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
  const [startsAt, setStartsAt] =
    useState("");
  const [expiresAt, setExpiresAt] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open) {
      setStartsAt("");
      setExpiresAt("");
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

  async function submit() {
    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/coupons/${encodeURIComponent(
            currentCoupon.id,
          )}/activate`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
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
                "Impossible d’activer le code promo.",
        );
      }

      onSuccess(
        payload.message ||
          "Le code promo a été activé.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’activer le code promo.",
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

      <div className="relative z-10 w-full max-w-xl rounded-[24px] border border-emerald-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
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
          Activer le code promo
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          L’organisateur recevra automatiquement un e-mail après l’activation.
        </p>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="font-black tracking-wide text-white">
            {currentCoupon.code}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {currentCoupon.event.title}
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-bold text-neutral-400">
              Début facultatif
            </span>

            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) =>
                setStartsAt(
                  event.target.value,
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:border-emerald-400/30"
            />
          </label>

          <label>
            <span className="text-xs font-bold text-neutral-400">
              Expiration facultative
            </span>

            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) =>
                setExpiresAt(
                  event.target.value,
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:border-emerald-400/30"
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
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-black disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmer l’activation
          </button>
        </div>
      </div>
    </div>
  );
}
