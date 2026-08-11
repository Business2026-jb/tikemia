"use client";

import {
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

export default function AdminRefundCustomerCard({
  refund,
}: {
  refund:
    AdminRefundDetail;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
        Client
      </p>

      <div className="mt-4 space-y-3">
        <Row
          icon={
            UserRound
          }
          label="Nom"
          value={
            refund.customer
              .name
          }
        />
        <Row
          icon={
            Mail
          }
          label="E-mail"
          value={
            refund.customer
              .email
          }
        />
        <Row
          icon={
            Phone
          }
          label="Téléphone"
          value={
            refund.customer
              .phone ||
            "Non renseigné"
          }
        />
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-neutral-400">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>
        <p className="mt-1 break-all text-sm font-bold text-neutral-200">
          {value}
        </p>
      </div>
    </div>
  );
}
