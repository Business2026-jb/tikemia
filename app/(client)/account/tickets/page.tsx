import { Prisma, TicketStatus } from "@prisma/client";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  History,
  MapPin,
  QrCode,
  Search,
  Send,
  Ticket,
  UserRound,
  XCircle,
} from "lucide-react";

import { requireClient } from "@/lib/client/auth/require-client";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mes billets | Tikemia",
  description:
    "Consultez, téléchargez et transférez vos billets Tikemia.",
};

export const dynamic = "force-dynamic";

type ClientTicketsPageSearchParams = {
  status?: string | string[];
  search?: string | string[];
};

type ClientTicketsPageProps = {
  searchParams?: Promise<ClientTicketsPageSearchParams>;
};

type TicketStatusFilter =
  | "ALL"
  | "VALID"
  | "USED"
  | "CANCELLED"
  | "REFUNDED"
  | "REVOKED"
  | "EXPIRED";

const STATUS_FILTERS: Array<{
  value: TicketStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "Tous" },
  { value: "VALID", label: "Valides" },
  { value: "USED", label: "Utilisés" },
  { value: "CANCELLED", label: "Annulés" },
  { value: "REFUNDED", label: "Remboursés" },
  { value: "REVOKED", label: "Révoqués" },
  { value: "EXPIRED", label: "Expirés" },
];

function getSingleSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0]?.trim() ?? ""
    : value?.trim() ?? "";
}

function normalizeTicketStatus(
  value: string,
): TicketStatusFilter {
  const normalizedValue =
    value.trim().toUpperCase();

  if (
    normalizedValue === "VALID" ||
    normalizedValue === "USED" ||
    normalizedValue === "CANCELLED" ||
    normalizedValue === "REFUNDED" ||
    normalizedValue === "REVOKED" ||
    normalizedValue === "EXPIRED"
  ) {
    return normalizedValue;
  }

  return "ALL";
}

function createFilterHref({
  status,
  search,
}: {
  status: TicketStatusFilter;
  search: string;
}): string {
  const params = new URLSearchParams();

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const query = params.toString();

  return query
    ? `/account/tickets?${query}`
    : "/account/tickets";
}

function formatDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatShortDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getTicketStatusLabel(
  status: TicketStatus,
): string {
  const labels: Record<TicketStatus, string> = {
    VALID: "Valide",
    USED: "Utilisé",
    CANCELLED: "Annulé",
    REFUNDED: "Remboursé",
    REVOKED: "Révoqué",
    EXPIRED: "Expiré",
  };

  return labels[status];
}

function getTicketStatusClassName(
  status: TicketStatus,
): string {
  switch (status) {
    case "VALID":
      return "border-emerald-400/20 bg-emerald-400/[0.09] text-emerald-300";

    case "USED":
      return "border-blue-400/20 bg-blue-400/[0.09] text-blue-300";

    case "REFUNDED":
      return "border-violet-400/20 bg-violet-400/[0.09] text-violet-300";

    case "CANCELLED":
      return "border-red-400/20 bg-red-400/[0.09] text-red-300";

    case "REVOKED":
      return "border-orange-400/20 bg-orange-400/[0.09] text-orange-300";

    case "EXPIRED":
      return "border-neutral-400/20 bg-neutral-400/[0.09] text-neutral-300";

    default:
      return "border-white/[0.10] bg-white/[0.04] text-neutral-300";
  }
}

function getTicketStatusIcon(
  status: TicketStatus,
) {
  switch (status) {
    case "VALID":
      return CheckCircle2;

    case "USED":
      return History;

    case "REFUNDED":
      return CircleAlert;

    case "CANCELLED":
      return XCircle;

    case "REVOKED":
      return CircleAlert;

    case "EXPIRED":
      return Clock3;

    default:
      return CircleAlert;
  }
}

function isUpcomingEvent(
  startsAt: Date,
): boolean {
  return startsAt.getTime() > Date.now();
}

function truncateTicketCode(
  value: string,
): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default async function ClientTicketsPage({
  searchParams,
}: ClientTicketsPageProps) {
  const { customer } =
    await requireClient(
      "/account/tickets",
    );

  const resolvedSearchParams =
    (await searchParams) ?? {};

  const search =
    getSingleSearchParam(
      resolvedSearchParams.search,
    );

  const activeStatus =
    normalizeTicketStatus(
      getSingleSearchParam(
        resolvedSearchParams.status,
      ),
    );

  const ticketWhere: Prisma.TicketWhereInput = {
    AND: [
      {
        OR: [
          {
            ownerId:
              customer.id,
          },
          {
            AND: [
              {
                ownerId:
                  null,
              },
              {
                holderEmail: {
                  equals:
                    customer.email,
                  mode:
                    Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        ],
      },

      ...(activeStatus !== "ALL"
        ? [
            {
              status:
                activeStatus as TicketStatus,
            },
          ]
        : []),

      ...(search
        ? [
            {
              OR: [
                {
                  code: {
                    contains:
                      search,
                    mode:
                      Prisma.QueryMode.insensitive,
                  },
                },
                {
                  holderName: {
                    contains:
                      search,
                    mode:
                      Prisma.QueryMode.insensitive,
                  },
                },
                {
                  event: {
                    title: {
                      contains:
                        search,
                      mode:
                        Prisma.QueryMode.insensitive,
                    },
                  },
                },
                {
                  ticketType: {
                    name: {
                      contains:
                        search,
                      mode:
                        Prisma.QueryMode.insensitive,
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };

  const tickets =
    await prisma.ticket.findMany({
      where:
        ticketWhere,

      orderBy: [
        {
          event: {
            startsAt:
              "asc",
          },
        },
        {
          createdAt:
            "desc",
        },
      ],

      select: {
        id: true,
        code: true,
        qrCodeValue: true,
        holderName: true,
        holderEmail: true,
        holderPhone: true,
        status: true,
        usedAt: true,
        createdAt: true,

        ticketType: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
          },
        },

        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverImage: true,
            venueName: true,
            address: true,
            city: true,
            country: true,
            startsAt: true,
            endsAt: true,
            timezone: true,
            status: true,
          },
        },

        order: {
          select: {
            id: true,
            reference: true,
            currency: true,
            total: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    });

  const totalTickets =
    tickets.length;

  const validTickets =
    tickets.filter(
      (ticket) =>
        ticket.status === "VALID",
    ).length;

  const upcomingTickets =
    tickets.filter(
      (ticket) =>
        ticket.status === "VALID" &&
        isUpcomingEvent(
          ticket.event.startsAt,
        ),
    ).length;

  return (
    <div className="w-full min-w-0 max-w-none self-stretch pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-10">
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:p-6 lg:p-7">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/[0.09] blur-[100px]"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-lime-400">
              {customer.firstName}, vos billets
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              Mes billets
            </h1>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-500">
              <span>
                {totalTickets} billet
                {totalTickets > 1 ? "s" : ""}
              </span>

              <span>
                {validTickets} valide
                {validTickets > 1 ? "s" : ""}
              </span>

              <span>
                {upcomingTickets} à venir
              </span>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:flex">
            <Link
              href="/account/transfers"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/[0.08] px-5 text-sm font-black text-lime-300 transition hover:bg-lime-400/[0.14] lg:w-auto"
            >
              <Send className="h-4.5 w-4.5" />
              Transférer mes billets
            </Link>

            <Link
              href="/events"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] lg:w-auto"
            >
              Voir les événements
              <ArrowRight className="h-4.5 w-4.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[22px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
        <form
          action="/account/tickets"
          method="GET"
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />

            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Rechercher dans mes billets"
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
            />
          </div>

          {activeStatus !== "ALL" && (
            <input
              type="hidden"
              name="status"
              value={activeStatus}
            />
          )}

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 text-sm font-black text-lime-300 transition hover:bg-emerald-400/[0.12] sm:w-auto"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>
        </form>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map(
            (filter) => {
              const active =
                activeStatus ===
                filter.value;

              return (
                <Link
                  key={filter.value}
                  href={createFilterHref({
                    status:
                      filter.value,
                    search,
                  })}
                  className={
                    active
                      ? "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-500 px-4 text-xs font-black text-[#071000]"
                      : "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-neutral-500 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:text-white"
                  }
                >
                  {filter.label}
                </Link>
              );
            },
          )}
        </div>
      </section>

      {tickets.length > 0 ? (
        <section className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
          {tickets.map(
            (ticket) => (
              <ClientTicketCard
                key={ticket.id}
                ticket={ticket}
              />
            ),
          )}
        </section>
      ) : (
        <EmptyTicketsState
          hasFilters={Boolean(
            search ||
              activeStatus !== "ALL",
          )}
        />
      )}
    </div>
  );
}

type ClientTicketCardProps = {
  ticket: {
    id: string;
    code: string;
    qrCodeValue: string;
    holderName: string;
    holderEmail: string;
    holderPhone: string | null;
    status: TicketStatus;
    usedAt: Date | null;
    createdAt: Date;

    ticketType: {
      id: string;
      name: string;
      description: string | null;
      price: Prisma.Decimal;
    };

    event: {
      id: string;
      slug: string;
      title: string;
      coverImage: string | null;
      venueName: string;
      address: string;
      city: string;
      country: string;
      startsAt: Date;
      endsAt: Date | null;
      timezone: string;
      status: string;
    };

    order: {
      id: string;
      reference: string;
      currency: string;
      total: Prisma.Decimal;
      status: string;
      paidAt: Date | null;
      createdAt: Date;
    };
  };
};

function ClientTicketCard({
  ticket,
}: ClientTicketCardProps) {
  const StatusIcon =
    getTicketStatusIcon(
      ticket.status,
    );

  const upcoming =
    isUpcomingEvent(
      ticket.event.startsAt,
    );

  const transferAllowed =
    ticket.status === "VALID" &&
    upcoming;

  return (
    <article className="group min-w-0 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#071015] shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition hover:border-white/[0.13]">
      <div className="relative aspect-[16/8] overflow-hidden bg-[#03090d] sm:aspect-[16/7]">
        {ticket.event.coverImage ? (
          <Image
            src={ticket.event.coverImage}
            alt={ticket.event.title}
            fill
            sizes="(max-width: 1280px) 100vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_42%),#03090d]">
            <Ticket className="h-14 w-14 text-white/[0.12]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#071015] via-transparent to-black/20" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-4 sm:top-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black backdrop-blur-xl ${getTicketStatusClassName(
              ticket.status,
            )}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {getTicketStatusLabel(
              ticket.status,
            )}
          </span>

          {upcoming &&
            ticket.status === "VALID" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/20 bg-lime-400/[0.09] px-3 py-1.5 text-[10px] font-black text-lime-300 backdrop-blur-xl">
                <CalendarDays className="h-3.5 w-3.5" />
                À venir
              </span>
            )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-lime-400">
          {ticket.ticketType.name}
        </p>

        <h2 className="mt-2 line-clamp-2 text-xl font-black tracking-[-0.03em] text-white">
          {ticket.event.title}
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TicketInfo
            icon={CalendarDays}
            label="Date"
            value={formatDate(
              ticket.event.startsAt,
            )}
          />

          <TicketInfo
            icon={Clock3}
            label="Heure"
            value={formatTime(
              ticket.event.startsAt,
            )}
          />

          <TicketInfo
            icon={MapPin}
            label="Lieu"
            value={`${ticket.event.venueName}, ${ticket.event.city}`}
          />

          <TicketInfo
            icon={UserRound}
            label="Détenteur"
            value={ticket.holderName}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#03090d] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-700">
                Code billet
              </p>

              <p
                title={ticket.code}
                className="mt-1 truncate font-mono text-xs font-bold text-neutral-300"
              >
                {truncateTicketCode(
                  ticket.code,
                )}
              </p>
            </div>

            <div className="min-w-0 sm:text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-700">
                Commande
              </p>

              <p className="mt-1 truncate text-xs font-bold text-neutral-300">
                {ticket.order.reference}
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-neutral-600">
            Acheté le{" "}
            {formatShortDate(
              ticket.order.paidAt ??
                ticket.order.createdAt,
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Link
            href={`/account/tickets/${ticket.id}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.08] px-4 text-xs font-black text-lime-300 transition hover:bg-lime-400/[0.13]"
          >
            <QrCode className="h-4 w-4" />
            Afficher
          </Link>

          <Link
            href={`/api/client/tickets/${ticket.id}/download`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-neutral-400 transition hover:border-white/[0.13] hover:text-white"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </Link>

          {transferAllowed ? (
            <Link
              href={`/account/transfers?ticket=${encodeURIComponent(
                ticket.id,
              )}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/[0.07] px-4 text-xs font-black text-orange-300 transition hover:bg-orange-400/[0.12]"
            >
              <Send className="h-4 w-4" />
              Transférer
            </Link>
          ) : (
            <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 text-xs font-black text-neutral-700">
              <Send className="h-4 w-4" />
              Indisponible
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function TicketInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-lime-400">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-700">
          {label}
        </p>

        <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyTicketsState({
  hasFilters,
}: {
  hasFilters: boolean;
}) {
  return (
    <section className="mt-4 rounded-[22px] border border-dashed border-white/[0.1] bg-[#071015] px-5 py-14 text-center sm:px-8 sm:py-20">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
        <Ticket className="h-8 w-8" />
      </span>

      <h2 className="mt-6 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
        {hasFilters
          ? "Aucun billet trouvé"
          : "Vous n’avez encore aucun billet"}
      </h2>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500">
        {hasFilters
          ? "Modifiez votre recherche ou réinitialisez les filtres."
          : "Vos billets apparaîtront ici après la confirmation de vos achats."}
      </p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {hasFilters && (
          <Link
            href="/account/tickets"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white sm:w-auto"
          >
            Réinitialiser les filtres
          </Link>
        )}

        <Link
          href="/events"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white sm:w-auto"
        >
          Voir les événements
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}