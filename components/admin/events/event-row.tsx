"use client";

import { Eye, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import EventStatusBadge from "./event-status-badge";

export type AdminEventRowData = {
  id: string;
  title: string;
  slug?: string | null;
  status: string;
  city?: string | null;
  country?: string | null;
  venueName?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
  organizer?: {
    id?: string;
    fullName?: string | null;
    email?: string | null;
    businessName?: string | null;
  } | null;
  ticketsSold?: number;
  revenue?: string | number;
};

type EventRowProps = {
  event: AdminEventRowData;
  onDetails: (event: AdminEventRowData) => void;
  onModerate: (event: AdminEventRowData) => void;
  onDelete: (event: AdminEventRowData) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value?: string | number) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0 FCFA";
  }

  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount)} FCFA`;
}

export default function EventRow({
  event,
  onDetails,
  onModerate,
  onDelete,
}: EventRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const organizerName =
    event.organizer?.businessName ||
    event.organizer?.fullName ||
    "Organisateur";

  return (
    <tr className="border-t border-white/[0.06] transition hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="min-w-[220px]">
          <p className="font-bold text-white">{event.title}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {event.slug || event.id}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[170px]">
          <p className="text-sm font-semibold text-neutral-200">
            {organizerName}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {event.organizer?.email || "—"}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[150px] text-sm text-neutral-400">
          <p>{event.city || event.venueName || "—"}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {event.country || "—"}
          </p>
        </div>
      </td>

      <td className="whitespace-nowrap px-4 py-4 text-sm text-neutral-400">
        {formatDate(event.startsAt)}
      </td>

      <td className="px-4 py-4">
        <p className="text-sm font-bold text-white">
          {event.ticketsSold ?? 0}
        </p>
        <p className="mt-1 text-xs text-neutral-600">billet(s)</p>
      </td>

      <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-emerald-300">
        {formatMoney(event.revenue)}
      </td>

      <td className="px-4 py-4">
        <EventStatusBadge status={event.status} />
      </td>

      <td className="px-4 py-4 text-right">
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-neutral-400 transition hover:bg-white/[0.05] hover:text-white"
            aria-label="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />

              <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-white/[0.09] bg-[#0b1118] p-1.5 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDetails(event);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  Voir le dossier
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onModerate(event);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Modérer
                </button>

                <div className="my-1 border-t border-white/[0.06]" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(event);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-300 hover:bg-red-400/[0.08]"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
