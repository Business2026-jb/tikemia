"use client";

import {
  Banknote,
  Bitcoin,
  Landmark,
  Smartphone,
} from "lucide-react";

import type {
  PayoutDestinationType,
} from "@prisma/client";

function getConfig(
  type:
    | PayoutDestinationType
    | null,
) {
  switch (type) {
    case "BANK_ACCOUNT":
      return {
        label: "Compte bancaire",
        icon: Landmark,
      };

    case "MOBILE_MONEY":
      return {
        label: "Mobile Money",
        icon: Smartphone,
      };

    case "CRYPTO_USDT_TRC20":
      return {
        label: "USDT TRC20",
        icon: Bitcoin,
      };

    default:
      return {
        label: "Non précisé",
        icon: Banknote,
      };
  }
}

export default function PayoutMethodBadge({
  type,
}: {
  type:
    | PayoutDestinationType
    | null;
}) {
  const config =
    getConfig(type);

  const Icon =
    config.icon;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-extrabold text-neutral-300">
      <Icon
        className="h-3.5 w-3.5"
        aria-hidden="true"
      />

      {config.label}
    </span>
  );
}