"use client";

import {
  CalendarDays,
  Mail,
  Store,
} from "lucide-react";

import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Non disponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",
      month:
        "long",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}

export default function AdminRefundOrganizerCard({
  refund,
}: {
  refund:
    AdminRefundDetail;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
        Organisateur & événement
      </p>

      <div className="mt-4 space-y-3">
        <Info
          icon={
            Store
          }
          label="Organisateur"
          value={
            refund.organizer
              .name
          }
        />
        <Info
          icon={
            Mail
          }
          label="E-mail"
          value={
            refund.organizer
              .email
          }
        />
        <Info
          icon={
            CalendarDays
          }
          label="Événement"
          value={`${refund.event.title} · ${formatDate(refund.event.startsAt)}`}
        />
      </div>
    </section>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof Store;
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
        <p className="mt-1 break-words text-sm font-bold text-neutral-200">
          {value}
        </p>
      </div>
    </div>
  );
}
