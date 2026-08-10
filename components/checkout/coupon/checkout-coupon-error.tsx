"use client";

import {
  AlertCircle,
  X,
} from "lucide-react";

export default function CheckoutCouponError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  if (!message.trim()) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-3.5 py-3 text-sm text-red-300"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />

        <p className="min-w-0 leading-5">
          {message}
        </p>
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer le message"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-300/70 transition hover:bg-red-400/10 hover:text-red-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
