"use client";

import {
  CalendarDays,
  LoaderCircle,
  Mail,
  MapPin,
  Ticket,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { AdminEventRowData } from "./event-row";
import EventStatusBadge from "./event-status-badge";

type EventDetailsDialogProps = {
  event: AdminEventRowData | null;
  open: boolean;
  onClose: () => void;
};

type EventDetails = Record<string, unknown>;

function readString(object: EventDetails | null, key: string): string | null {
  if (!object) return null;
  const value = object[key];
  return typeof value === "string" ? value : null;
}

function readNumber(object: EventDetails | null, key: string): number | null {
  if (!object) return null;
  const value = object[key];

  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export default function EventDetailsDialog({
  event,
  open,
  onClose,
}: EventDetailsDialogProps) {
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !event) {
      setDetails(null);
      setError("");
      setLoading(false);
      return;
    }

    const eventId = event.id;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/admin/events/${encodeURIComponent(eventId)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          data?: EventDetails;
          error?: string | { message?: string };
        };

        if (!response.ok || !payload.success) {
          const message =
            typeof payload.error === "string"
              ? payload.error
              : payload.error?.message;

          throw new Error(message || "Impossible de charger l’événement.");
        }

        setDetails(payload.data ?? {});
      } catch (caught) {
        if (
          caught instanceof DOMException &&
          caught.name === "AbortError"
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger l’événement.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [open, event]);

  if (!open || !event) return null;

  const title = readString(details, "title") || event.title;
  const description = readString(details, "description");
  const city = readString(details, "city") || event.city;
  const country = readString(details, "country") || event.country;
  const venueName = readString(details, "venueName") || event.venueName;
  const startsAt = readString(details, "startsAt") || event.startsAt;
  const ticketsSold =
    readNumber(details, "ticketsSold") ?? event.ticketsSold ?? 0;
  const revenue =
    readNumber(details, "revenue") ?? Number(event.revenue ?? 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#090d12] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#090d12]/95 p-5 backdrop-blur sm:p-6">
          <div>
            <div className="mb-3">
              <EventStatusBadge status={event.status} />
            </div>
            <h2 className="text-xl font-black text-white sm:text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-xs text-neutral-600">{event.id}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-sky-300" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              {error}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard
                  icon={<User className="h-4 w-4" />}
                  label="Organisateur"
                  value={
                    event.organizer?.businessName ||
                    event.organizer?.fullName ||
                    "—"
                  }
                />

                <InfoCard
                  icon={<Mail className="h-4 w-4" />}
                  label="E-mail"
                  value={event.organizer?.email || "—"}
                />

                <InfoCard
                  icon={<MapPin className="h-4 w-4" />}
                  label="Lieu"
                  value={
                    [venueName, city, country].filter(Boolean).join(", ") || "—"
                  }
                />

                <InfoCard
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Date"
                  value={formatDate(startsAt)}
                />

                <InfoCard
                  icon={<Ticket className="h-4 w-4" />}
                  label="Billets vendus"
                  value={String(ticketsSold)}
                />

                <InfoCard
                  icon={<Ticket className="h-4 w-4" />}
                  label="Revenus"
                  value={`${Number.isFinite(revenue) ? revenue.toLocaleString("fr-FR") : "0"} FCFA`}
                />
              </div>

              {description ? (
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    Description
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-300">
                    {description}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>
      <p className="mt-3 break-words text-sm font-bold text-white">{value}</p>
    </div>
  );
}
