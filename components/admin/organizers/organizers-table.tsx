"use client";

import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
} from "lucide-react";

import type {
  AdminOrganizerListItem,
  GetAdminOrganizersResult,
} from "@/lib/admin/organizers/get-admin-organizers";

import OrganizerRow from "./organizer-row";

export default function OrganizersTable({
  data,
  loading,
  onPageChange,
  onDetails,
  onEvents,
  onDelete,
}: {
  data: GetAdminOrganizersResult;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onDetails: (organizer: AdminOrganizerListItem) => void;
  onEvents: (organizer: AdminOrganizerListItem) => void;
  onDelete: (organizer: AdminOrganizerListItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d0f]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
        <div>
          <p className="text-sm font-extrabold text-white">
            Liste des organisateurs
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {data.pagination.totalItems.toLocaleString("fr-FR")} résultat(s)
          </p>
        </div>
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
        ) : null}
      </div>

      {data.organizers.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
            <Inbox className="h-5 w-5 text-neutral-600" />
          </div>
          <p className="mt-4 text-sm font-bold text-neutral-300">
            Aucun organisateur trouvé
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Modifiez la recherche ou les filtres.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.015] text-left">
                {[
                  "Organisateur",
                  "Contact",
                  "Localisation",
                  "Événements",
                  "Billets",
                  "Statut",
                  "Inscription",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600 last:text-right"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.organizers.map((organizer) => (
                <OrganizerRow
                  key={organizer.id}
                  organizer={organizer}
                  onDetails={onDetails}
                  onEvents={onEvents}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-600">
          Page {data.pagination.page}
          {data.pagination.totalPages > 0
            ? ` sur ${data.pagination.totalPages}`
            : ""}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!data.pagination.hasPreviousPage || loading}
            onClick={() =>
              onPageChange(Math.max(data.pagination.page - 1, 1))
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-bold text-neutral-400 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>
          <button
            type="button"
            disabled={!data.pagination.hasNextPage || loading}
            onClick={() => onPageChange(data.pagination.page + 1)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-bold text-neutral-400 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
