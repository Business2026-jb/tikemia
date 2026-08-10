"use client";

import type {
  PromoDiscountType,
} from "@prisma/client";
import {
  BadgePercent,
  Coins,
} from "lucide-react";

export default function CouponTypeBadge({
  type,
}: {
  type: PromoDiscountType;
}) {
  const percentage =
    type === "PERCENTAGE";

  const Icon = percentage
    ? BadgePercent
    : Coins;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
        percentage
          ? "border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300"
          : "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {percentage
        ? "Pourcentage"
        : "Montant fixe"}
    </span>
  );
}
