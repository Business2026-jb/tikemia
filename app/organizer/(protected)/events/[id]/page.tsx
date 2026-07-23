import { createHash } from "node:crypto";

import type { EventStatus } from "@prisma/client";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  CircleAlert,
  CircleDollarSign,
  CircleX,
  Clock3,
  Eye,
  FileClock,
  ImageIcon,
  MapPin,
  ShieldCheck,
  Ticket,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganizerEventDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const statusConfig: Record<
  EventStatus,
  {
    label: string;
    description: string;
    className: string;
    icon: typeof FileClock;
  }
> = {
  DRAFT: {
    label: "Brouillon",
    description:
      "Cet événement n’a pas encore été envoyé pour validation.",
    className:
      "border-neutral-500/25 bg-neutral-500/10 text-neutral-300",
    icon: FileClock,
  },

  PENDING: {
    label: "En cours d’examen",
    description:
      "L’équipe Tikemia examine les informations de votre événement avant sa publication.",
    className:
      "border-orange-500/30 bg-orange-500/10 text-orange-300",
    icon: Clock3,
  },

  PUBLISHED: {
    label: "Publié",
    description:
      "Votre événement est validé et disponible sur Tikemia.",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-lime-400",
    icon: BadgeCheck,
  },

  REJECTED: {
    label: "Rejeté",
    description:
      "Cet événement a été rejeté par l’équipe Tikemia. Consultez le motif transmis, apportez les corrections demandées puis soumettez-le de nouveau.",
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-300",
    icon: CircleX,
  },

  SUSPENDED: {
    label: "Suspendu",
    description:
      "La visibilité de cet événement a été suspendue par Tikemia.",
    className:
      "border-red-500/30 bg-red-500/10 text-red-300",
    icon: CircleAlert,
  },

  CANCELLED: {
    label: "Annulé",
    description:
      "Cet événement a été marqué comme annulé.",
    className:
      "border-red-500/30 bg-red-500/10 text-red-300",
    icon: Ban,
  },

  COMPLETED: {
    label: "Terminé",
    description:
      "Cet événement est terminé et reste accessible dans votre historique.",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-300",
    icon: BadgeCheck,
  },

  ARCHIVED: {
    label: "Archivé",
    description:
      "Cet événement a été archivé par Tikemia. Il reste conservé dans votre historique mais n’est plus actif sur la plateforme.",
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-300",
    icon: Archive,
  },
};

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

async function getAuthenticatedOrganizerId(): Promise<string> {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    redirect("/organizer/login");
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },

    select: {
      id: true,
      expiresAt: true,

      user: {
        select: {
          id: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    redirect("/organizer/login");
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[ORGANIZER_EVENT_DETAILS_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    redirect("/organizer/login");
  }

  if (
    session.user.role !== "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    redirect("/organizer/login");
  }

  return session.user.id;
}

function formatDateTime(
  value: Date | null,
  timezone: string,
): string {
  if (!value) {
    return "Non renseignée";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone,
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(value);
  }
}

function formatMoney(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits:
      currency === "XOF" || currency === "XAF"
        ? 0
        : 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

export default async function OrganizerEventDetailsPage({
  params,
}: OrganizerEventDetailsPageProps) {
  const { id } = await params;

  if (!id?.trim()) {
    notFound();
  }

  const organizerId =
    await getAuthenticatedOrganizerId();

  const event = await prisma.event.findFirst({
    where: {
      id,
      organizerId,
    },

    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      coverImage: true,

      venueName: true,
      address: true,
      city: true,
      country: true,
      countryCode: true,
      timezone: true,

      startsAt: true,
      endsAt: true,
      salesStartAt: true,
      salesEndAt: true,

      currency: true,
      platformFeeRate: true,
      capacity: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,

      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
        },
      },

      images: {
        orderBy: {
          position: "asc",
        },

        select: {
          id: true,
          path: true,
          publicUrl: true,
          position: true,
          isCover: true,
          createdAt: true,
        },
      },

      ticketTypes: {
        orderBy: {
          createdAt: "asc",
        },

        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          quantity: true,
          maxPerOrder: true,
          saleStartsAt: true,
          saleEndsAt: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const [
    soldTicketsByType,
    paidOrders,
  ] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["ticketTypeId"],

      where: {
        eventId: event.id,
        status: {
          in: ["VALID", "USED"],
        },
      },

      _count: {
        _all: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        eventId: event.id,
        status: "PAID",
      },

      _count: {
        _all: true,
      },

      _sum: {
        subtotal: true,
        platformFee: true,
        total: true,
      },
    }),
  ]);

  const soldCountByTicketType = new Map(
    soldTicketsByType.map((item) => [
      item.ticketTypeId,
      item._count._all,
    ]),
  );

  const totalTicketsSold =
    soldTicketsByType.reduce(
      (total, item) =>
        total + item._count._all,
      0,
    );

  const placesRemaining = Math.max(
    event.capacity - totalTicketsSold,
    0,
  );

  const projectedGrossRevenue =
    event.ticketTypes.reduce(
      (total, ticketType) =>
        total +
        Number(ticketType.price) *
          ticketType.quantity,
      0,
    );

  const platformFeePercent = Number(
    event.platformFeeRate,
  );

  const projectedPlatformFee =
    projectedGrossRevenue *
    (platformFeePercent / 100);

  const projectedOrganizerNet =
    projectedGrossRevenue -
    projectedPlatformFee;

  const actualGrossRevenue = Number(
    paidOrders._sum.subtotal ?? 0,
  );

  const actualPlatformFee = Number(
    paidOrders._sum.platformFee ?? 0,
  );

  const actualOrganizerNet =
    actualGrossRevenue - actualPlatformFee;

  const status =
    statusConfig[event.status];

  const StatusIcon = status.icon;

  const coverImage =
    event.images.find((image) => image.isCover) ??
    event.images[0] ??
    null;

  const minimumTicketPrice =
    event.ticketTypes.length > 0
      ? Math.min(
          ...event.ticketTypes.map((ticketType) =>
            Number(ticketType.price),
          ),
        )
      : 0;

  const maximumTicketPrice =
    event.ticketTypes.length > 0
      ? Math.max(
          ...event.ticketTypes.map((ticketType) =>
            Number(ticketType.price),
          ),
        )
      : 0;

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* En-tête */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/organizer/events"
              aria-label="Retour aux événements"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-neutral-400 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${status.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </span>

                {event.category && (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                    {event.category.name}
                  </span>
                )}
              </div>

              <h1 className="mt-3 break-words text-xl font-black tracking-[-0.03em] text-white sm:text-2xl lg:text-3xl">
                {event.title}
              </h1>

              <p className="mt-1.5 text-xs text-neutral-500 sm:text-sm">
                Créé le{" "}
                {formatDateTime(
                  event.createdAt,
                  event.timezone,
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/organizer/events"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.07] hover:text-white"
            >
              Tous les événements
            </Link>

            {event.status === "PUBLISHED" ? (
              <Link
                href={`/events/${event.slug}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white"
              >
                <Eye className="h-4 w-4" />
                Voir la page publique
              </Link>
            ) : (
              <div className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 text-sm font-bold text-neutral-600">
                <Eye className="h-4 w-4" />
                Page publique indisponible
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <StatusIcon
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              event.status === "PUBLISHED"
                ? "text-lime-400"
                : event.status === "PENDING"
                  ? "text-orange-400"
                  : event.status === "REJECTED" ||
                      event.status === "SUSPENDED" ||
                      event.status === "CANCELLED"
                    ? "text-rose-400"
                    : event.status === "ARCHIVED"
                      ? "text-violet-400"
                      : event.status === "COMPLETED"
                        ? "text-blue-400"
                        : "text-neutral-500"
            }`}
          />

          <div>
            <p className="text-sm font-bold text-white">
              {status.label}
            </p>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {status.description}
            </p>
          </div>
        </div>
      </section>

      {/* Indicateurs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Ticket}
          label="Billets vendus"
          value={formatNumber(totalTicketsSold)}
          detail={`${formatNumber(
            event.capacity,
          )} billets disponibles`}
          tone="green"
        />

        <MetricCard
          icon={UsersRound}
          label="Places restantes"
          value={formatNumber(placesRemaining)}
          detail={`${Math.round(
            event.capacity > 0
              ? (totalTicketsSold /
                  event.capacity) *
                  100
              : 0,
          )} % vendu`}
          tone="blue"
        />

        <MetricCard
          icon={WalletCards}
          label="Revenus encaissés"
          value={formatMoney(
            actualOrganizerNet,
            event.currency,
          )}
          detail={`${paidOrders._count._all} commande${
            paidOrders._count._all > 1 ? "s" : ""
          } payée${
            paidOrders._count._all > 1 ? "s" : ""
          }`}
          tone="green"
        />

        <MetricCard
          icon={CircleDollarSign}
          label="Revenus potentiels"
          value={formatMoney(
            projectedOrganizerNet,
            event.currency,
          )}
          detail={`Après ${platformFeePercent} % de commission`}
          tone="orange"
        />

        <MetricCard
          icon={CalendarClock}
          label="Début"
          value={formatDateTime(
            event.startsAt,
            event.timezone,
          )}
          detail={event.timezone}
          tone="purple"
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* Colonne principale */}
        <div className="space-y-5">
          {/* Images */}
          <DetailSection
            icon={ImageIcon}
            title="Images de l’événement"
            description={`${event.images.length} image${
              event.images.length > 1 ? "s" : ""
            } enregistrée${
              event.images.length > 1 ? "s" : ""
            }`}
          >
            {event.images.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {event.images.map((image) => (
                  <article
                    key={image.id}
                    className={`overflow-hidden rounded-2xl border ${
                      image.isCover
                        ? "border-lime-400/40"
                        : "border-white/[0.08]"
                    } bg-[#050b0f]`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.publicUrl}
                        alt={`${event.title} — image ${
                          image.position + 1
                        }`}
                        className="h-full w-full object-cover"
                      />

                      {image.isCover && (
                        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg border border-lime-400/30 bg-black/80 px-2.5 py-1.5 text-[10px] font-black text-lime-400 backdrop-blur-md">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Image principale
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-xs font-semibold text-neutral-400">
                        Image {image.position + 1}
                      </span>

                      <span className="text-[10px] text-neutral-600">
                        {image.isCover
                          ? "Couverture"
                          : "Galerie"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="Aucune image n’est enregistrée pour cet événement." />
            )}
          </DetailSection>

          {/* Description */}
          <DetailSection
            icon={CircleAlert}
            title="Description"
            description="Présentation complète de l’événement"
          >
            <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-300">
              {event.description}
            </p>
          </DetailSection>

          {/* Billets */}
          <DetailSection
            icon={Ticket}
            title="Billets et tarifs"
            description={`${event.ticketTypes.length} type${
              event.ticketTypes.length > 1 ? "s" : ""
            } de billet${
              event.ticketTypes.length > 1 ? "s" : ""
            }`}
          >
            {event.ticketTypes.length > 0 ? (
              <div className="space-y-3">
                {event.ticketTypes.map(
                  (ticketType) => {
                    const sold =
                      soldCountByTicketType.get(
                        ticketType.id,
                      ) ?? 0;

                    const remaining = Math.max(
                      ticketType.quantity - sold,
                      0,
                    );

                    const gross =
                      Number(ticketType.price) *
                      ticketType.quantity;

                    const fee =
                      gross *
                      (platformFeePercent / 100);

                    return (
                      <article
                        key={ticketType.id}
                        className="rounded-2xl border border-white/[0.08] bg-[#050b0f] p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-black text-white">
                                {ticketType.name}
                              </h3>

                              <span
                                className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                                  ticketType.isActive
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
                                    : "border-neutral-500/25 bg-neutral-500/10 text-neutral-400"
                                }`}
                              >
                                {ticketType.isActive
                                  ? "Actif"
                                  : "Inactif"}
                              </span>
                            </div>

                            {ticketType.description && (
                              <p className="mt-2 text-xs leading-5 text-neutral-500">
                                {ticketType.description}
                              </p>
                            )}
                          </div>

                          <p className="shrink-0 text-base font-black text-lime-400">
                            {formatMoney(
                              Number(ticketType.price),
                              event.currency,
                            )}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                          <SmallMetric
                            label="Quantité"
                            value={formatNumber(
                              ticketType.quantity,
                            )}
                          />

                          <SmallMetric
                            label="Vendus"
                            value={formatNumber(sold)}
                            tone="green"
                          />

                          <SmallMetric
                            label="Restants"
                            value={formatNumber(
                              remaining,
                            )}
                          />

                          <SmallMetric
                            label="Maximum/commande"
                            value={formatNumber(
                              ticketType.maxPerOrder,
                            )}
                          />

                          <SmallMetric
                            label="Revenu net potentiel"
                            value={formatMoney(
                              gross - fee,
                              event.currency,
                            )}
                            tone="green"
                          />
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            ) : (
              <EmptyState message="Aucun type de billet n’est enregistré." />
            )}
          </DetailSection>
        </div>

        {/* Colonne latérale */}
        <aside className="space-y-5 xl:sticky xl:top-[112px]">
          {/* Résumé */}
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
            <header className="border-b border-white/[0.07] px-4 py-4">
              <h2 className="text-base font-black text-white">
                Résumé de l’événement
              </h2>
            </header>

            {coverImage ? (
              <div className="border-b border-white/[0.07]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage.publicUrl}
                  alt={event.title}
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-4 p-4">
              <SummaryValue
                icon={Building2}
                label="Catégorie"
                value={
                  event.category?.name ??
                  "Sans catégorie"
                }
              />

              <SummaryValue
                icon={MapPin}
                label="Lieu"
                value={`${event.venueName}, ${event.city}, ${event.country}`}
              />

              <SummaryValue
                icon={CalendarClock}
                label="Début"
                value={formatDateTime(
                  event.startsAt,
                  event.timezone,
                )}
              />

              <SummaryValue
                icon={CalendarClock}
                label="Fin"
                value={formatDateTime(
                  event.endsAt,
                  event.timezone,
                )}
              />

              <SummaryValue
                icon={Ticket}
                label="Prix des billets"
                value={
                  minimumTicketPrice ===
                  maximumTicketPrice
                    ? formatMoney(
                        minimumTicketPrice,
                        event.currency,
                      )
                    : `${formatMoney(
                        minimumTicketPrice,
                        event.currency,
                      )} – ${formatMoney(
                        maximumTicketPrice,
                        event.currency,
                      )}`
                }
              />
            </div>
          </section>

          {/* Revenus */}
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
            <header className="border-b border-white/[0.07] px-4 py-4">
              <h2 className="text-base font-black text-white">
                Détail des revenus
              </h2>
            </header>

            <div className="space-y-3 p-4">
              <RevenueLine
                label="Chiffre d’affaires potentiel"
                value={formatMoney(
                  projectedGrossRevenue,
                  event.currency,
                )}
              />

              <RevenueLine
                label={`Commission Tikemia (${platformFeePercent} %)`}
                value={formatMoney(
                  projectedPlatformFee,
                  event.currency,
                )}
                tone="orange"
              />

              <RevenueLine
                label="Revenu net potentiel"
                value={formatMoney(
                  projectedOrganizerNet,
                  event.currency,
                )}
                tone="green"
              />

              <div className="my-2 border-t border-white/[0.07]" />

              <RevenueLine
                label="Chiffre d’affaires encaissé"
                value={formatMoney(
                  actualGrossRevenue,
                  event.currency,
                )}
              />

              <RevenueLine
                label="Commission prélevée"
                value={formatMoney(
                  actualPlatformFee,
                  event.currency,
                )}
                tone="orange"
              />

              <RevenueLine
                label="Solde organisateur"
                value={formatMoney(
                  actualOrganizerNet,
                  event.currency,
                )}
                tone="green"
              />
            </div>

            <div className="border-t border-white/[0.07] bg-orange-500/[0.035] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />

                <p className="text-[11px] leading-5 text-neutral-500">
                  Tikemia prélève automatiquement{" "}
                  {platformFeePercent} % sur chaque
                  billet vendu et payé.
                </p>
              </div>
            </div>
          </section>

          {/* Vente */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#081015] p-4">
            <h2 className="text-sm font-black text-white">
              Période de vente
            </h2>

            <div className="mt-4 space-y-4">
              <SummaryValue
                icon={Clock3}
                label="Ouverture"
                value={formatDateTime(
                  event.salesStartAt,
                  event.timezone,
                )}
              />

              <SummaryValue
                icon={Clock3}
                label="Fermeture"
                value={formatDateTime(
                  event.salesEndAt,
                  event.timezone,
                )}
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

type IconComponent = typeof Ticket;

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  tone:
    | "green"
    | "blue"
    | "orange"
    | "purple";
}) {
  const toneStyles = {
    green:
      "border-emerald-500/20 bg-emerald-500/[0.045] text-lime-400",
    blue:
      "border-blue-500/20 bg-blue-500/[0.045] text-blue-400",
    orange:
      "border-orange-500/20 bg-orange-500/[0.045] text-orange-400",
    purple:
      "border-purple-500/20 bg-purple-500/[0.045] text-purple-400",
  };

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#081015] p-4">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneStyles[tone]}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        {label}
      </p>

      <p className="mt-1 break-words text-lg font-black tracking-[-0.02em] text-white">
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-neutral-600">
        {detail}
      </p>
    </article>
  );
}

function DetailSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="flex items-start gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
          <Icon className="h-[18px] w-[18px] text-lime-400" />
        </div>

        <div>
          <h2 className="text-base font-black text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function SummaryValue({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

      <div className="min-w-0">
        <p className="text-[10px] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 break-words text-xs font-bold leading-5 text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function RevenueLine({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "orange" | "green";
}) {
  const valueClass =
    tone === "green"
      ? "text-lime-400"
      : tone === "orange"
        ? "text-orange-400"
        : "text-white";

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs leading-5 text-neutral-500">
        {label}
      </span>

      <span
        className={`text-right text-xs font-black leading-5 ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green";
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="text-[10px] leading-4 text-neutral-600">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-xs font-black ${
          tone === "green"
            ? "text-lime-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.015] px-5 py-8 text-center">
      <ImageIcon className="h-7 w-7 text-neutral-700" />

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        {message}
      </p>
    </div>
  );
}