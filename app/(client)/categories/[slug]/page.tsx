import { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  Tag,
  Ticket,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CategoryDetailPageParams = {
  slug: string;
};

type CategoryDetailSearchParams = {
  search?: string | string[];
  city?: string | string[];
  country?: string | string[];
  sort?: string | string[];
};

type CategoryDetailPageProps = {
  params: Promise<CategoryDetailPageParams>;
  searchParams?: Promise<CategoryDetailSearchParams>;
};

type EventSortOption =
  | "soon"
  | "latest"
  | "name";

function getSingleSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0]?.trim() ?? ""
    : value?.trim() ?? "";
}

function normalizeSort(
  value: string,
): EventSortOption {
  if (
    value === "latest" ||
    value === "name"
  ) {
    return value;
  }

  return "soon";
}

function getOrderBy(
  sort: EventSortOption,
): Prisma.EventOrderByWithRelationInput[] {
  switch (sort) {
    case "latest":
      return [
        {
          publishedAt:
            "desc",
        },
        {
          startsAt:
            "asc",
        },
      ];

    case "name":
      return [
        {
          title:
            "asc",
        },
      ];

    case "soon":
    default:
      return [
        {
          startsAt:
            "asc",
        },
      ];
  }
}

function formatEventDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday:
        "long",
      day:
        "2-digit",
      month:
        "long",
      year:
        "numeric",
    },
  ).format(value);
}

function formatEventTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(value);
}

function formatPrice(
  amount: Prisma.Decimal | number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      style:
        "currency",
      currency,
      minimumFractionDigits:
        currency ===
        "XOF"
          ? 0
          : 2,
      maximumFractionDigits:
        currency ===
        "XOF"
          ? 0
          : 2,
    },
  ).format(
    Number(amount),
  );
}

function createFilterHref({
  slug,
  search,
  city,
  country,
  sort,
}: {
  slug: string;
  search: string;
  city: string;
  country: string;
  sort: EventSortOption;
}): string {
  const params =
    new URLSearchParams();

  if (
    search
  ) {
    params.set(
      "search",
      search,
    );
  }

  if (
    city
  ) {
    params.set(
      "city",
      city,
    );
  }

  if (
    country
  ) {
    params.set(
      "country",
      country,
    );
  }

  if (
    sort !==
    "soon"
  ) {
    params.set(
      "sort",
      sort,
    );
  }

  const query =
    params.toString();

  return query
    ? `/categories/${slug}?${query}`
    : `/categories/${slug}`;
}

export async function generateMetadata({
  params,
}: CategoryDetailPageProps): Promise<Metadata> {
  const {
    slug,
  } =
    await params;

  const category =
    await prisma.eventCategory.findFirst({
      where: {
        slug,
        isActive:
          true,
      },

      select: {
        name:
          true,
        description:
          true,
      },
    });

  if (
    !category
  ) {
    return {
      title:
        "Catégorie introuvable | Tikemia",
    };
  }

  return {
    title:
      `${category.name} | Tikemia`,

    description:
      category.description ??
      `Découvrez les événements de la catégorie ${category.name} sur Tikemia.`,
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const {
    slug,
  } =
    await params;

  const resolvedSearchParams =
    (await searchParams) ?? {};

  const search =
    getSingleSearchParam(
      resolvedSearchParams.search,
    );

  const city =
    getSingleSearchParam(
      resolvedSearchParams.city,
    );

  const country =
    getSingleSearchParam(
      resolvedSearchParams.country,
    );

  const sort =
    normalizeSort(
      getSingleSearchParam(
        resolvedSearchParams.sort,
      ),
    );

  const category =
    await prisma.eventCategory.findFirst({
      where: {
        slug,
        isActive:
          true,
      },

      select: {
        id:
          true,
        name:
          true,
        slug:
          true,
        description:
          true,
        icon:
          true,
      },
    });

  if (
    !category
  ) {
    notFound();
  }

  const now =
    new Date();

  const eventWhere: Prisma.EventWhereInput = {
    categoryId:
      category.id,

    status:
      "PUBLISHED",

    startsAt: {
      gte:
        now,
    },

    ...(search
      ? {
          OR: [
            {
              title: {
                contains:
                  search,
                mode:
                  Prisma.QueryMode.insensitive,
              },
            },
            {
              shortDescription: {
                contains:
                  search,
                mode:
                  Prisma.QueryMode.insensitive,
              },
            },
            {
              venueName: {
                contains:
                  search,
                mode:
                  Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),

    ...(city
      ? {
          city: {
            equals:
              city,
            mode:
              Prisma.QueryMode.insensitive,
          },
        }
      : {}),

    ...(country
      ? {
          country: {
            equals:
              country,
            mode:
              Prisma.QueryMode.insensitive,
          },
        }
      : {}),
  };

  const [
    events,
    locationOptions,
  ] =
    await Promise.all([
      prisma.event.findMany({
        where:
          eventWhere,

        orderBy:
          getOrderBy(
            sort,
          ),

        select: {
          id:
            true,
          slug:
            true,
          title:
            true,
          shortDescription:
            true,
          coverImage:
            true,
          venueName:
            true,
          city:
            true,
          country:
            true,
          startsAt:
            true,
          endsAt:
            true,
          currency:
            true,
          isFree:
            true,

          ticketTypes: {
            where: {
              isActive:
                true,
            },

            orderBy: {
              price:
                "asc",
            },

            take:
              1,

            select: {
              price:
                true,
            },
          },
        },
      }),

      prisma.event.findMany({
        where: {
          categoryId:
            category.id,
          status:
            "PUBLISHED",
          startsAt: {
            gte:
              now,
          },
        },

        distinct: [
          "city",
          "country",
        ],

        select: {
          city:
            true,
          country:
            true,
        },

        orderBy: [
          {
            country:
              "asc",
          },
          {
            city:
              "asc",
          },
        ],
      }),
    ]);

  const cities =
    Array.from(
      new Set(
        locationOptions
          .map(
            (
              item,
            ) =>
              item.city,
          )
          .filter(
            Boolean,
          ),
      ),
    );

  const countries =
    Array.from(
      new Set(
        locationOptions
          .map(
            (
              item,
            ) =>
              item.country,
          )
          .filter(
            Boolean,
          ),
      ),
    );

  const hasFilters =
    Boolean(
      search ||
      city ||
      country ||
      sort !==
        "soon",
    );

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 767px) {
              body footer {
                display: none !important;
              }
            }
          `,
        }}
      />

      <main className="min-h-screen w-full bg-[#03070a] text-white">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8 lg:py-10 lg:pb-12 xl:px-10">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux catégories
          </Link>

          <section className="relative mt-5 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#071015] px-5 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:px-7 sm:py-9 lg:px-9 lg:py-11">
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/[0.09] blur-[110px]"
            />

            <div
              aria-hidden="true"
              className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-orange-500/[0.06] blur-[120px]"
            />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-lime-300">
                <Tag className="h-3.5 w-3.5" />
                Catégorie
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl lg:text-5xl">
                {category.name}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">
                {category.description?.trim() ||
                  `Découvrez les événements disponibles dans la catégorie ${category.name}.`}
              </p>

              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-sm font-bold text-neutral-400">
                <Ticket className="h-4 w-4 text-lime-400" />

                {events.length} événement
                {events.length > 1
                  ? "s"
                  : ""} disponible
                {events.length > 1
                  ? "s"
                  : ""}
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-[#071015] p-4 sm:p-5">
            <form
              action={`/categories/${category.slug}`}
              method="GET"
              className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_180px_auto]"
            >
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />

                <input
                  type="search"
                  name="search"
                  defaultValue={
                    search
                  }
                  placeholder="Rechercher un événement"
                  className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
                />
              </div>

              <select
                name="city"
                defaultValue={
                  city
                }
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-4 text-sm text-neutral-300 outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
              >
                <option value="">
                  Toutes les villes
                </option>

                {cities.map(
                  (
                    cityName,
                  ) => (
                    <option
                      key={
                        cityName
                      }
                      value={
                        cityName
                      }
                    >
                      {cityName}
                    </option>
                  ),
                )}
              </select>

              <select
                name="country"
                defaultValue={
                  country
                }
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-4 text-sm text-neutral-300 outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
              >
                <option value="">
                  Tous les pays
                </option>

                {countries.map(
                  (
                    countryName,
                  ) => (
                    <option
                      key={
                        countryName
                      }
                      value={
                        countryName
                      }
                    >
                      {countryName}
                    </option>
                  ),
                )}
              </select>

              <select
                name="sort"
                defaultValue={
                  sort
                }
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-4 text-sm text-neutral-300 outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
              >
                <option value="soon">
                  Plus proches
                </option>

                <option value="latest">
                  Plus récents
                </option>

                <option value="name">
                  Nom A–Z
                </option>
              </select>

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 text-sm font-black text-lime-300 transition hover:bg-emerald-400/[0.12]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtrer
              </button>
            </form>
          </section>

          {events.length > 0 ? (
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.map(
                (
                  event,
                ) => (
                  <CategoryEventCard
                    key={
                      event.id
                    }
                    event={
                      event
                    }
                  />
                ),
              )}
            </section>
          ) : (
            <section className="mt-5 rounded-[24px] border border-dashed border-white/[0.1] bg-[#071015] px-5 py-14 text-center sm:px-8 sm:py-20">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
                <CalendarDays className="h-8 w-8" />
              </span>

              <h2 className="mt-6 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                {hasFilters
                  ? "Aucun événement trouvé"
                  : "Aucun événement disponible"}
              </h2>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500">
                {hasFilters
                  ? "Modifiez vos critères pour afficher d’autres événements."
                  : "Les événements publiés dans cette catégorie apparaîtront ici."}
              </p>

              {hasFilters && (
                <Link
                  href={createFilterHref({
                    slug:
                      category.slug,
                    search:
                      "",
                    city:
                      "",
                    country:
                      "",
                    sort:
                      "soon",
                  })}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Réinitialiser les filtres
                </Link>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}

type CategoryEventCardProps = {
  event: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    coverImage: string | null;
    venueName: string;
    city: string;
    country: string;
    startsAt: Date;
    endsAt: Date | null;
    currency: string;
    isFree: boolean;

    ticketTypes: Array<{
      price: Prisma.Decimal;
    }>;
  };
};

function CategoryEventCard({
  event,
}: CategoryEventCardProps) {
  const startingPrice =
    event.ticketTypes[0]?.price ??
    null;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-400/20">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#03090d]">
        {event.coverImage ? (
          <Image
            src={
              event.coverImage
            }
            alt={
              event.title
            }
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_44%),#03090d]">
            <CalendarDays className="h-16 w-16 text-white/[0.14]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#071015] via-black/10 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <span className="rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur-xl">
            {event.isFree
              ? "Gratuit"
              : startingPrice
                ? `À partir de ${formatPrice(
                    startingPrice,
                    event.currency,
                  )}`
                : "Billetterie disponible"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="line-clamp-2 text-xl font-black tracking-[-0.03em] text-white">
          {event.title}
        </h2>

        {event.shortDescription && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-500">
            {event.shortDescription}
          </p>
        )}

        <div className="mt-5 space-y-3">
          <EventInfo
            icon={
              CalendarDays
            }
            value={
              formatEventDate(
                event.startsAt,
              )
            }
          />

          <EventInfo
            icon={
              Clock3
            }
            value={
              formatEventTime(
                event.startsAt,
              )
            }
          />

          <EventInfo
            icon={
              MapPin
            }
            value={`${event.venueName}, ${event.city}, ${event.country}`}
          />
        </div>

        <Link
          href={`/events/${event.slug}`}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-4 text-xs font-black text-white transition hover:scale-[1.01]"
        >
          Voir l’événement
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function EventInfo({
  icon: Icon,
  value,
}: {
  icon: typeof CalendarDays;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 text-sm text-neutral-400">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-lime-400">
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 leading-6">
        {value}
      </span>
    </div>
  );
}