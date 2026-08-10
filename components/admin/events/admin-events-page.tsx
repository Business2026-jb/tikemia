"use client";

import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import DeleteEventDialog from "./delete-event-dialog";
import EventDetailsDialog from "./event-details-dialog";
import type { AdminEventRowData } from "./event-row";
import EventsFilters, {
  type AdminEventsFiltersValue,
} from "./events-filters";
import EventsHeader from "./events-header";
import EventsTable from "./events-table";
import ModerateEventDialog from "./moderate-event-dialog";

type UnknownRecord = Record<string, unknown>;

type AdminEventsApiResponse = {
  success?: boolean;
  data?: unknown;
  error?: string | { message?: string };
};

const INITIAL_FILTERS: AdminEventsFiltersValue = {
  search: "",
  status: "all",
  country: "",
  sort: "recent",
};

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeOrganizer(
  value: unknown,
): AdminEventRowData["organizer"] {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const profile = asRecord(record.profile);

  const firstName = stringValue(record.firstName);
  const lastName = stringValue(record.lastName);
  const explicitFullName = stringValue(record.fullName);

  const generatedFullName = [firstName, lastName]
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .trim();

  const fullName =
    explicitFullName ||
    generatedFullName ||
    null;

  const organizerId =
    stringValue(record.id) ??
    stringValue(record.userId) ??
    undefined;

  const email =
    stringValue(record.email) ??
    undefined;

  const businessName =
    stringValue(record.businessName) ??
    (profile
      ? stringValue(profile.businessName)
      : null) ??
    null;

  return {
    id: organizerId,
    fullName,
    email,
    businessName,
  };
}

function normalizeEvent(
  value: unknown,
): AdminEventRowData | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const id =
    stringValue(record.id) ||
    stringValue(record.eventId) ||
    stringValue(record.publicId);

  const title = stringValue(record.title);

  if (!id || !title) {
    return null;
  }

  const organizer =
    normalizeOrganizer(record.organizer) ||
    normalizeOrganizer(record.user) ||
    normalizeOrganizer(record.owner);

  return {
    id,
    title,

    slug:
      stringValue(record.slug),

    status:
      stringValue(record.status) ||
      stringValue(record.moderationStatus) ||
      "UNKNOWN",

    city:
      stringValue(record.city),

    country:
      stringValue(record.country),

    venueName:
      stringValue(record.venueName) ||
      stringValue(record.venue),

    startsAt:
      stringValue(record.startsAt) ||
      stringValue(record.startDate) ||
      stringValue(record.date),

    endsAt:
      stringValue(record.endsAt) ||
      stringValue(record.endDate),

    createdAt:
      stringValue(record.createdAt),

    organizer,

    ticketsSold:
      numberValue(record.ticketsSold) ??
      numberValue(record.soldTickets) ??
      numberValue(record.sold) ??
      0,

    revenue:
      numberValue(record.revenue) ??
      numberValue(record.totalRevenue) ??
      numberValue(record.grossRevenue) ??
      0,
  };
}

function extractEvents(
  data: unknown,
): AdminEventRowData[] {
  if (Array.isArray(data)) {
    return data
      .map(normalizeEvent)
      .filter(
        (
          event,
        ): event is AdminEventRowData =>
          event !== null,
      );
  }

  const record = asRecord(data);

  if (!record) {
    return [];
  }

  const candidates = [
    record.events,
    record.items,
    record.results,
    record.rows,
    record.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map(normalizeEvent)
        .filter(
          (
            event,
          ): event is AdminEventRowData =>
            event !== null,
        );
    }

    const nested = asRecord(candidate);

    if (nested) {
      const nestedEvents =
        nested.events ||
        nested.items ||
        nested.results ||
        nested.rows;

      if (Array.isArray(nestedEvents)) {
        return nestedEvents
          .map(normalizeEvent)
          .filter(
            (
              event,
            ): event is AdminEventRowData =>
              event !== null,
          );
      }
    }
  }

  return [];
}

function readError(
  payload: AdminEventsApiResponse,
): string {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (
    payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "Impossible de charger les événements.";
}

function normalizeStatus(
  status: string,
): string {
  return status.trim().toUpperCase();
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<
    AdminEventRowData[]
  >([]);

  const [filters, setFilters] =
    useState<AdminEventsFiltersValue>(
      INITIAL_FILTERS,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [detailsEvent, setDetailsEvent] =
    useState<AdminEventRowData | null>(
      null,
    );

  const [moderateEvent, setModerateEvent] =
    useState<AdminEventRowData | null>(
      null,
    );

  const [deleteEvent, setDeleteEvent] =
    useState<AdminEventRowData | null>(
      null,
    );

  const loadEvents =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams({
            page: "1",
            pageSize: "100",
            sort: filters.sort,
          });

        if (filters.search.trim()) {
          params.set(
            "search",
            filters.search.trim(),
          );
        }

        if (
          filters.status &&
          filters.status !== "all"
        ) {
          params.set(
            "status",
            filters.status,
          );
        }

        if (filters.country.trim()) {
          params.set(
            "country",
            filters.country.trim(),
          );
        }

        const response = await fetch(
          `/api/admin/events?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as AdminEventsApiResponse;

        if (
          !response.ok ||
          payload.success === false
        ) {
          throw new Error(
            readError(payload),
          );
        }

        setEvents(
          extractEvents(payload.data),
        );
      } catch (caught) {
        setEvents([]);

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les événements.",
        );
      } finally {
        setLoading(false);
      }
    }, [filters]);

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          void loadEvents();
        },
        filters.search ? 300 : 0,
      );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    loadEvents,
    filters.search,
  ]);

  const stats = useMemo(() => {
    const total =
      events.length;

    const pending =
      events.filter((event) => {
        const status =
          normalizeStatus(
            event.status,
          );

        return (
          status === "PENDING" ||
          status === "PENDING_REVIEW"
        );
      }).length;

    const published =
      events.filter((event) => {
        const status =
          normalizeStatus(
            event.status,
          );

        return (
          status === "PUBLISHED" ||
          status === "APPROVED"
        );
      }).length;

    const revenue =
      events.reduce(
        (sum, event) => {
          const value =
            Number(
              event.revenue ?? 0,
            );

          return (
            sum +
            (Number.isFinite(value)
              ? value
              : 0)
          );
        },
        0,
      );

    const ticketsSold =
      events.reduce(
        (sum, event) => {
          const value =
            Number(
              event.ticketsSold ?? 0,
            );

          return (
            sum +
            (Number.isFinite(value)
              ? value
              : 0)
          );
        },
        0,
      );

    return {
      total,
      pending,
      published,
      revenue,
      ticketsSold,
    };
  }, [events]);

  async function refreshAfterAction() {
    await loadEvents();
  }

  return (
    <div className="min-h-full w-full bg-[#03080d] p-4 text-white sm:p-5 lg:p-6">
      <div className="w-full space-y-4">
        <EventsHeader
          loading={loading}
          onRefresh={loadEvents}
        />

        {error ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="shrink-0 text-xs font-black underline underline-offset-4"
            >
              Fermer
            </button>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={
              <CalendarDays className="h-5 w-5" />
            }
            label="Total événements"
            value={String(
              stats.total,
            )}
            description="Événements chargés dans l’administration."
          />

          <StatCard
            icon={
              <CalendarClock className="h-5 w-5" />
            }
            label="En attente"
            value={String(
              stats.pending,
            )}
            description="Dossiers nécessitant une décision."
          />

          <StatCard
            icon={
              <CircleCheck className="h-5 w-5" />
            }
            label="Publiés"
            value={String(
              stats.published,
            )}
            description="Événements approuvés ou publiés."
          />

          <StatCard
            icon={
              <CircleDollarSign className="h-5 w-5" />
            }
            label="Revenus générés"
            value={`${stats.revenue.toLocaleString(
              "fr-FR",
            )} FCFA`}
            description={`${stats.ticketsSold.toLocaleString(
              "fr-FR",
            )} billet(s) vendu(s).`}
          />
        </section>

        <EventsFilters
          value={filters}
          onChange={setFilters}
        />

        <EventsTable
          events={events}
          loading={loading}
          onDetails={
            setDetailsEvent
          }
          onModerate={
            setModerateEvent
          }
          onDelete={
            setDeleteEvent
          }
        />
      </div>

      <EventDetailsDialog
        event={detailsEvent}
        open={
          detailsEvent !== null
        }
        onClose={() =>
          setDetailsEvent(null)
        }
      />

      <ModerateEventDialog
        event={moderateEvent}
        open={
          moderateEvent !== null
        }
        onClose={() =>
          setModerateEvent(null)
        }
        onSuccess={() => {
          setModerateEvent(null);
          void refreshAfterAction();
        }}
      />

      <DeleteEventDialog
        event={deleteEvent}
        open={
          deleteEvent !== null
        }
        onClose={() =>
          setDeleteEvent(null)
        }
        onSuccess={() => {
          setDeleteEvent(null);
          void refreshAfterAction();
        }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#07111d] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            {label}
          </p>

          <p className="mt-3 text-xl font-black text-white">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/[0.06] text-sky-300">
          {icon}
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-neutral-600">
        {description}
      </p>
    </div>
  );
}