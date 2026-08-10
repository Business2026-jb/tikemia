"use client";

import {
  CalendarDays,
  Eye,
  Mail,
  MapPin,
  MoreHorizontal,
  Ticket,
  Trash2,
} from "lucide-react";

import type {
  AdminOrganizerListItem,
} from "@/lib/admin/organizers/get-admin-organizers";

import OrganizerStatusBadge from "./organizer-status-badge";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function OrganizerRow({
  organizer,
  onDetails,
  onEvents,
  onDelete,
}: {
  organizer: AdminOrganizerListItem;
  onDetails: (organizer: AdminOrganizerListItem) => void;
  onEvents: (organizer: AdminOrganizerListItem) => void;
  onDelete: (organizer: AdminOrganizerListItem) => void;
}) {
  const displayName =
    organizer.profile?.businessName?.trim() ||
    organizer.fullName;

  return (
    <tr className="border-b border-white/[0.055] last:border-b-0 hover:bg-white/[0.018]">
      <td className="px-4 py-4">
        <div className="flex min-w-[230px] items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-black text-white">
            {organizer.profile?.logo || organizer.profile?.avatar ? (
              <img
                src={organizer.profile.logo || organizer.profile.avatar || ""}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials(displayName)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-extrabold text-white">
                {displayName}
              </p>
              {organizer.profile?.hasBlueBadge ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-sky-400"
                  title="Badge Tikemia"
                />
              ) : null}
            </div>
            {displayName !== organizer.fullName ? (
              <p className="truncate text-xs text-neutral-600">
                {organizer.fullName}
              </p>
            ) : null}
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[210px] space-y-1">
          <p className="flex items-center gap-2 text-xs text-neutral-300">
            <Mail className="h-3.5 w-3.5 text-neutral-600" />
            <span className="truncate">{organizer.email}</span>
          </p>
          <p className="text-xs text-neutral-600">
            {organizer.dialCode} {organizer.phone}
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[130px]">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
            <MapPin className="h-3.5 w-3.5 text-neutral-600" />
            {organizer.country}
          </p>
          {organizer.profile?.city ? (
            <p className="mt-1 text-xs text-neutral-600">
              {organizer.profile.city}
            </p>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-4">
        <button
          type="button"
          onClick={() => onEvents(organizer)}
          className="min-w-[120px] text-left"
        >
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <CalendarDays className="h-4 w-4 text-emerald-400" />
            {organizer.counts.events}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            {organizer.counts.publishedEvents} publié(s)
          </p>
        </button>
      </td>

      <td className="px-4 py-4">
        <div className="min-w-[110px]">
          <p className="flex items-center gap-2 text-sm font-bold text-neutral-300">
            <Ticket className="h-4 w-4 text-neutral-600" />
            {organizer.counts.tickets}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            {organizer.counts.orders} commande(s)
          </p>
        </div>
      </td>

      <td className="px-4 py-4">
        <OrganizerStatusBadge
          isActive={organizer.isActive}
          emailVerified={organizer.emailVerified}
        />
      </td>

      <td className="px-4 py-4">
        <p className="min-w-[105px] text-xs font-semibold text-neutral-400">
          {new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "medium",
          }).format(new Date(organizer.createdAt))}
        </p>
      </td>

      <td className="px-4 py-4 text-right">
        <div className="flex min-w-[118px] items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onDetails(organizer)}
            title="Voir les détails"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.05] hover:text-white"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onEvents(organizer)}
            title="Voir les événements"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.05] hover:text-emerald-300"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(organizer)}
            title="Désactiver ou supprimer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-red-400/10 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
