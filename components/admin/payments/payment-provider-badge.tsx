"use client";

import { CreditCard } from "lucide-react";

export default function PaymentProviderBadge({
  provider,
}: {
  provider: string;
}) {
  const value = provider.trim() || "Inconnu";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-neutral-300">
      <CreditCard className="h-3.5 w-3.5 text-neutral-500" />
      {value}
    </span>
  );
}
