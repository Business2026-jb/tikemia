"use client";

import Image from "next/image";
import {
  CalendarDays,
  MapPin,
  Ticket,
} from "lucide-react";

export type CheckoutOrderItem = Readonly<{
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  platformFee: string;
  total: string;
}>;

export type CheckoutOrderEvent = Readonly<{
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  venueName?: string | null;
  city?: string | null;
  country?: string | null;
  startsAt?: string | null;
}>;

export type CheckoutOrderSummaryData = Readonly<{
  reference: string;
  currency: string;
  event: CheckoutOrderEvent;
  items: readonly CheckoutOrderItem[];
}>;

function formatMoney(value: string, currency: string): string {
  const amount = Number.parseFloat(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase() || "XOF",
      maximumFractionDigits:
        currency.toUpperCase() === "XOF" ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toLocaleString("fr-FR") : "0"} ${currency}`;
  }
}

function formatEventDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CheckoutOrderSummary({
  order,
}: {
  order: CheckoutOrderSummaryData;
}) {
  const eventDate = formatEventDate(order.event.startsAt);
  const totalTickets = order.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#071015] shadow-[0_26px_80px_rgba(0,0,0,0.26)]">
        <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative min-h-48 overflow-hidden bg-white/[0.03] md:min-h-full">
            {order.event.coverImage ? (
              <Image
                src={order.event.coverImage}
                alt={order.event.title}
                fill
                sizes="(max-width: 768px) 100vw, 220px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center text-lime-400">
                <Ticket className="h-14 w-14" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>

          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-lime-400/20 bg-lime-400/[0.08] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">
                Commande {order.reference}
              </span>

              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-bold text-neutral-400">
                {totalTickets} billet{totalTickets > 1 ? "s" : ""}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {order.event.title}
            </h1>

            <div className="mt-5 grid gap-3 text-sm text-neutral-400 sm:grid-cols-2">
              {eventDate ? (
                <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-3.5">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                  <span>{eventDate}</span>
                </div>
              ) : null}

              {order.event.venueName || order.event.city ? (
                <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-3.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                  <span>
                    {[
                      order.event.venueName,
                      order.event.city,
                      order.event.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-400">
            <Ticket className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white">Billets réservés</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Vérifiez vos catégories et quantités.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-black/10 p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {item.ticketTypeName}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  {item.quantity} × {formatMoney(item.unitPrice, order.currency)}
                </p>
              </div>

              <p className="shrink-0 text-sm font-black text-white">
                {formatMoney(item.subtotal, order.currency)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
