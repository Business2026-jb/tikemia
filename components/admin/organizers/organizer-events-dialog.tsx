"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  AdminOrganizerListItem,
} from "@/lib/admin/organizers/get-admin-organizers";

type OrganizerEvent = {
  id: string;
  title: string;
  coverImage: string | null;
  venueName: string;
  city: string;
  country: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
  currency: string;
  status: string;
  capacity: number;
  isFree: boolean;
  ticketTypes: Array<{
    id: string;
    name: string;
    price: string;
    quantity: number;
    sold: number;
    available: number;
  }>;
  statistics: {
    orders: number;
    paidOrders: number;
    tickets: number;
    paidRevenue: string;
  };
};

type EventsResponse = {
  events: OrganizerEvent[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

const statuses = [
  "all",
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "CANCELLED",
  "COMPLETED",
  "ARCHIVED",
] as const;

const statusLabels: Record<string, string> = {
  all: "Tous",
  DRAFT: "Brouillons",
  PENDING: "En attente",
  PUBLISHED: "Publiés",
  REJECTED: "Rejetés",
  SUSPENDED: "Suspendus",
  CANCELLED: "Annulés",
  COMPLETED: "Terminés",
  ARCHIVED: "Archivés",
};

function formatMoney(value: string, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${value} ${currency}`;
  }
}

export default function OrganizerEventsDialog({
  organizer,
  open,
  onClose,
}: {
  organizer: AdminOrganizerListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setData(null);
      setSearch("");
      setStatus("all");
      setPage(1);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !organizer) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "12",
          status,
        });

        if (search.trim()) params.set("search", search.trim());

        const response = await fetch(
          `/api/admin/organizers/${encodeURIComponent(
            organizer.id,
          )}/events?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          data?: EventsResponse;
          error?: string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Impossible de charger les événements.");
        }

        setData(payload.data);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les événements.",
        );
      } finally {
        setLoading(false);
      }
    }, search ? 300 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, organizer, search, status, page]);

  if (!open || !organizer) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#070b0d] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-600">
              Événements de l’organisateur
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              {organizer.profile?.businessName || organizer.fullName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-500 hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/[0.06] p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher un événement..."
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-400/30"
              />
            </label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-white/[0.08] bg-[#080d0f] px-4 text-sm font-semibold text-neutral-300 outline-none"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-h-[calc(94vh-180px)] overflow-y-auto p-4 sm:p-5">
          {loading && !data ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              {error}
            </div>
          ) : data?.events.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.events.map((event) => (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]"
                >
                  <div className="flex gap-4 p-4">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                      {event.coverImage ? (
                        <img
                          src={event.coverImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <CalendarDays className="h-5 w-5 text-neutral-700" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-black text-white">
                          {event.title}
                        </p>
                        <span className="shrink-0 rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-black text-neutral-500">
                          {statusLabels[event.status] || event.status}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-600">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.city}, {event.country}
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        {new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(event.startsAt))}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-t border-white/[0.06]">
                    <div className="p-3">
                      <p className="text-sm font-black text-white">
                        {event.statistics.tickets}
                      </p>
                      <p className="text-[10px] text-neutral-600">Billets</p>
                    </div>
                    <div className="border-x border-white/[0.06] p-3">
                      <p className="text-sm font-black text-white">
                        {event.statistics.paidOrders}
                      </p>
                      <p className="text-[10px] text-neutral-600">Ventes</p>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-black text-emerald-300">
                        {formatMoney(
                          event.statistics.paidRevenue,
                          event.currency,
                        )}
                      </p>
                      <p className="text-[10px] text-neutral-600">Revenus</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <Ticket className="h-6 w-6 text-neutral-700" />
              <p className="mt-3 text-sm font-bold text-neutral-400">
                Aucun événement trouvé
              </p>
            </div>
          )}

          {data ? (
            <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <p className="text-xs text-neutral-600">
                {data.pagination.totalItems} événement(s)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!data.pagination.hasPreviousPage || loading}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-neutral-500 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!data.pagination.hasNextPage || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-neutral-500 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
