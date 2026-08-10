"use client";

import { CalendarX2, LoaderCircle } from "lucide-react";

import EventRow, { type AdminEventRowData } from "./event-row";

type EventsTableProps = {
  events: AdminEventRowData[];
  loading?: boolean;
  onDetails: (event: AdminEventRowData) => void;
  onModerate: (event: AdminEventRowData) => void;
  onDelete: (event: AdminEventRowData) => void;
};

export default function EventsTable({
  events,
  loading = false,
  onDetails,
  onModerate,
  onDelete,
}: EventsTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07111d]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-white/[0.018]">
              {[
                "Événement",
                "Organisateur",
                "Lieu",
                "Date",
                "Billetterie",
                "Revenus",
                "Statut",
                "Actions",
              ].map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap px-4 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500 last:text-right"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          {!loading && events.length > 0 ? (
            <tbody>
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onDetails={onDetails}
                  onModerate={onModerate}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          ) : null}
        </table>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-sky-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-500">
              Chargement des événements...
            </p>
          </div>
        </div>
      ) : null}

      {!loading && events.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] text-sky-300">
              <CalendarX2 className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-black text-white">
              Aucun événement trouvé
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Aucun événement ne correspond aux critères sélectionnés.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
