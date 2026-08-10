"use client";

import {
  BadgePercent,
} from "lucide-react";

function formatAmount(
  value: string | number,
  currency: string,
): string {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return `${value} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    })} ${currency}`;
  }
}

export default function CheckoutDiscountRow({
  amount,
  currency,
  code,
  label = "Réduction",
}: {
  amount: string | number;
  currency: string;
  code?: string | null;
  label?: string;
}) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-emerald-300">
          <BadgePercent className="h-4 w-4 shrink-0" />
          <span className="font-bold">
            {label}
          </span>
        </div>

        {code ? (
          <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide text-neutral-600">
            Code {code}
          </p>
        ) : null}
      </div>

      <span className="shrink-0 font-black text-emerald-300">
        -{formatAmount(numericAmount, currency)}
      </span>
    </div>
  );
}
