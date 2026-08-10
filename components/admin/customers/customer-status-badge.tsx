"use client";

import {
  BadgeCheck,
  CircleOff,
  UserRound,
} from "lucide-react";

import type {
  AdminCustomerListItem,
} from "@/components/admin/customers/admin-customers-page";

export default function CustomerStatusBadge({
  customer,
}: {
  customer: AdminCustomerListItem;
}) {
  if (
    customer.accountType ===
    "GUEST"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/15 bg-amber-400/[0.055] px-2.5 py-1 text-[10px] font-black text-amber-300">
        <UserRound className="h-3 w-3" />
        Invité
      </span>
    );
  }

  if (!customer.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/15 bg-red-400/[0.055] px-2.5 py-1 text-[10px] font-black text-red-300">
        <CircleOff className="h-3 w-3" />
        Inactif
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-2.5 py-1 text-[10px] font-black text-emerald-300">
      <BadgeCheck className="h-3 w-3" />
      Actif
    </span>
  );
}
