import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import ClientAllEvents from "@/components/client/home/client-all-events";
import ClientFeaturedEvents from "@/components/client/home/client-featured-events";
import ClientHomeFilters from "@/components/client/home/client-home-filters";
import ClientHomeHero from "@/components/client/home/client-home-hero";
import {
  getClientHomeEvents,
  type ClientHomeEventSort,
  type ClientHomePagination,
} from "@/lib/client/get-client-home-events";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://tikemia.com";

const EVENTS_PAGE_SIZE = 12;
const FEATURED_EVENTS_LIMIT = 5;

const ALLOWED_SORT_VALUES =
  new Set<ClientHomeEventSort>([
    "soonest",
    "latest",
    "popular",
    "price-low",
    "price-high",
  ]);

export const dynamic =
  "force-dynamic";

export const metadata: Metadata = {
  metadataBase:
    new URL(APP_URL),

  title:
    "Tous les événements",

  description:
    "Découvrez tous les concerts, festivals, conférences, spectacles, événements sportifs et expériences disponibles sur Tikemia.",

  alternates: {
    canonical:
      "/events",
  },

  openGraph: {
    type:
      "website",

    locale:
      "fr_FR",

    url:
      "/events",

    siteName:
      "Tikemia",

    title:
      "Tous les événements — Tikemia",

    description:
      "Explorez et réservez vos billets pour les meilleurs événements disponibles sur Tikemia.",

    images: [
      {
        url:
          "/imageclient.png",

        width:
          1536,

        height:
          1024,

        alt:
          "Tous les événements disponibles sur Tikemia",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Tous les événements — Tikemia",

    description:
      "Découvrez et réservez vos billets pour les meilleurs événements sur Tikemia.",

    images: [
      {
        url:
          "/imageclient.png",

        alt:
          "Tous les événements disponibles sur Tikemia",
      },
    ],
  },

  robots: {
    index:
      true,

    follow:
      true,

    googleBot: {
      index:
        true,

      follow:
        true,

      "max-image-preview":
        "large",

      "max-snippet":
        -1,

      "max-video-preview":
        -1,
    },
  },
};

type ClientEventsPageSearchParams = {
  page?: string | string[];
  search?: string | string[];
  category?: string | string[];
  city?: string | string[];
  countryCode?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  sort?: string | string[];
  featured?: string | string[];
};

type ClientEventsPageProps = {
  searchParams?: Promise<ClientEventsPageSearchParams>;
};

function getSingleSearchParam(
  value:
    | string
    | string[]
    | undefined,
): string {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0]?.trim() ??
      ""
    );
  }

  return (
    value?.trim() ??
    ""
  );
}

function getPageNumber(
  value:
    | string
    | string[]
    | undefined,
): number {
  const parsedValue =
    Number.parseInt(
      getSingleSearchParam(
        value,
      ),
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue < 1
  ) {
    return 1;
  }

  return parsedValue;
}

function getSortValue(
  value:
    | string
    | string[]
    | undefined,
): ClientHomeEventSort {
  const normalizedValue =
    getSingleSearchParam(
      value,
    ) as ClientHomeEventSort;

  return ALLOWED_SORT_VALUES.has(
    normalizedValue,
  )
    ? normalizedValue
    : "soonest";
}

function createPageHref({
  currentSearchParams,
  page,
}: {
  currentSearchParams:
    ClientEventsPageSearchParams;
  page: number;
}): string {
  const params =
    new URLSearchParams();

  for (
    const [
      key,
      rawValue,
    ] of Object.entries(
      currentSearchParams,
    )
  ) {
    if (
      key === "page" ||
      rawValue === undefined
    ) {
      continue;
    }

    const value =
      getSingleSearchParam(
        rawValue,
      );

    if (value) {
      params.set(
        key,
        value,
      );
    }
  }

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  const query =
    params.toString();

  return query
    ? `/events?${query}`
    : "/events";
}

function getVisiblePages(
  pagination:
    ClientHomePagination,
): number[] {
  const totalPages =
    Math.max(
      pagination.totalPages,
      0,
    );

  if (
    totalPages <= 1
  ) {
    return [];
  }

  const currentPage =
    Math.min(
      Math.max(
        pagination.page,
        1,
      ),
      totalPages,
    );

  return Array.from(
    new Set<number>([
      1,
      totalPages,
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ]),
  )
    .filter(
      (
        page,
      ) =>
        page >= 1 &&
        page <= totalPages,
    )
    .sort(
      (
        first,
        second,
      ) =>
        first -
        second,
    );
}

function ClientEventsPagination({
  pagination,
  currentSearchParams,
}: {
  pagination:
    ClientHomePagination;
  currentSearchParams:
    ClientEventsPageSearchParams;
}) {
  if (
    pagination.totalPages <=
    1
  ) {
    return null;
  }

  const visiblePages =
    getVisiblePages(
      pagination,
    );

  return (
    <nav
      aria-label="Pagination des événements"
      className="mt-7 flex flex-wrap items-center justify-center gap-2"
    >
      {pagination.hasPreviousPage ? (
        <Link
          href={createPageHref({
            currentSearchParams,

            page:
              pagination.page -
              1,
          })}
          aria-label="Page précédente"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition hover:border-lime-500/20 hover:bg-lime-500/[0.07] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
        >
          <ChevronLeft
            aria-hidden="true"
            className="h-4 w-4"
          />

          <span className="hidden sm:inline">
            Précédent
          </span>
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 text-xs font-black text-neutral-800"
        >
          <ChevronLeft className="h-4 w-4" />

          <span className="hidden sm:inline">
            Précédent
          </span>
        </span>
      )}

      {visiblePages.map(
        (
          page,
          index,
        ) => {
          const previousPage =
            visiblePages[
              index - 1
            ];

          const shouldShowEllipsis =
            previousPage !==
              undefined &&
            page -
              previousPage >
              1;

          const active =
            page ===
            pagination.page;

          return (
            <span
              key={
                page
              }
              className="contents"
            >
              {shouldShowEllipsis && (
                <span className="inline-flex h-11 min-w-8 items-center justify-center text-sm font-black text-neutral-700">
                  …
                </span>
              )}

              <Link
                href={createPageHref({
                  currentSearchParams,
                  page,
                })}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={
                  active
                    ? "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-500 text-sm font-black text-[#071000] shadow-[0_12px_30px_rgba(132,204,22,0.16)]"
                    : "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-black text-neutral-400 outline-none transition hover:border-lime-500/20 hover:bg-lime-500/[0.07] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
                }
              >
                {
                  page
                }
              </Link>
            </span>
          );
        },
      )}

      {pagination.hasNextPage ? (
        <Link
          href={createPageHref({
            currentSearchParams,

            page:
              pagination.page +
              1,
          })}
          aria-label="Page suivante"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition hover:border-lime-500/20 hover:bg-lime-500/[0.07] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
        >
          <span className="hidden sm:inline">
            Suivant
          </span>

          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 text-xs font-black text-neutral-800"
        >
          <span className="hidden sm:inline">
            Suivant
          </span>

          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

export default async function ClientEventsPage({
  searchParams,
}: ClientEventsPageProps) {
  const resolvedSearchParams =
    (await searchParams) ??
    {};

  const page =
    getPageNumber(
      resolvedSearchParams.page,
    );

  const search =
    getSingleSearchParam(
      resolvedSearchParams.search,
    );

  const category =
    getSingleSearchParam(
      resolvedSearchParams.category,
    );

  const city =
    getSingleSearchParam(
      resolvedSearchParams.city,
    );

  const countryCode =
    getSingleSearchParam(
      resolvedSearchParams.countryCode,
    );

  const dateFrom =
    getSingleSearchParam(
      resolvedSearchParams.dateFrom,
    );

  const dateTo =
    getSingleSearchParam(
      resolvedSearchParams.dateTo,
    );

  const sort =
    getSortValue(
      resolvedSearchParams.sort,
    );

  const featuredOnly =
    getSingleSearchParam(
      resolvedSearchParams.featured,
    ) === "true";

  const eventsData =
    await getClientHomeEvents({
      page,

      pageSize:
        EVENTS_PAGE_SIZE,

      featuredLimit:
        FEATURED_EVENTS_LIMIT,

      search:
        search ||
        null,

      category:
        category ||
        null,

      city:
        city ||
        null,

      countryCode:
        countryCode ||
        null,

      dateFrom:
        dateFrom ||
        null,

      dateTo:
        dateTo ||
        null,

      sort,
    });

  const displayedEvents =
    featuredOnly
      ? eventsData.events.filter(
          (
            event,
          ) =>
            event.isFeatured,
        )
      : eventsData.events;

  const hasActiveFilters =
    Boolean(
      search ||
        category ||
        city ||
        countryCode ||
        dateFrom ||
        dateTo ||
        featuredOnly ||
        sort !==
          "soonest",
    );

  const resultsCount =
    featuredOnly
      ? displayedEvents.length
      : Math.max(
          eventsData.pagination.totalItems,
          0,
        );

  const plural =
    resultsCount > 1
      ? "s"
      : "";

  return (
    <div className="min-h-screen bg-[#03070a] text-white">
      <ClientHomeHero
        title="Tous les événements"
        description="Découvrez les meilleurs concerts, festivals, conférences, spectacles et expériences près de chez vous."
        backgroundImage="/images/client/home/events-hero.png"
        backgroundImageAlt="Grande scène de concert avec un public enthousiaste"
        totalEvents={
          eventsData.totals
            .publishedEvents
        }
        totalCities={
          eventsData.totals
            .cities
        }
        totalCategories={
          eventsData.totals
            .categories
        }
        primaryActionHref="#client-events-filters"
        secondaryActionHref="/"
        secondaryActionLabel="Retour à l’accueil"
        searchAnchorHref="#client-events-filters"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-28 sm:px-5 lg:px-8 lg:pb-16">
        <div
          id="client-events-filters"
          className="-mt-1 scroll-mt-28 sm:-mt-3 lg:-mt-7"
        >
          <ClientHomeFilters
            filters={
              eventsData.filters
            }
            categories={
              eventsData.categories
            }
            cities={
              eventsData.cities
            }
            basePath="/events"
            className="shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
          />
        </div>

        {!featuredOnly && (
          <div className="mt-9 sm:mt-11 lg:mt-14">
            <ClientFeaturedEvents
              events={
                eventsData.featuredEvents
              }
              viewAllHref="/events?featured=true"
              description="Les événements sélectionnés et mis en avant sur Tikemia."
              priorityCount={
                2
              }
            />
          </div>
        )}

        <div className="mt-10 sm:mt-12 lg:mt-16">
          <ClientAllEvents
            events={
              displayedEvents
            }
            pagination={
              eventsData.pagination
            }
            title={
              featuredOnly
                ? "Événements à la une"
                : hasActiveFilters
                  ? "Résultats de votre recherche"
                  : "Tous les événements"
            }
            description={
              featuredOnly
                ? `${resultsCount.toLocaleString(
                    "fr-FR",
                  )} événement${plural} mis en avant sur Tikemia.`
                : hasActiveFilters
                  ? `${resultsCount.toLocaleString(
                      "fr-FR",
                    )} événement${plural} correspondant à vos critères.`
                  : `${resultsCount.toLocaleString(
                      "fr-FR",
                    )} événement${plural} disponible${plural} sur Tikemia.`
            }
            initialView="grid"
            emptyActionHref="/events"
            emptyActionLabel="Réinitialiser les filtres"
          />

          {!featuredOnly && (
            <ClientEventsPagination
              pagination={
                eventsData.pagination
              }
              currentSearchParams={
                resolvedSearchParams
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}