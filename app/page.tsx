import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import ClientLayout from "@/app/(client)/layout";
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

const HOME_PAGE_SIZE = 12;
const FEATURED_EVENTS_LIMIT = 5;

const ALLOWED_SORT_VALUES =
  new Set<ClientHomeEventSort>([
    "soonest",
    "latest",
    "popular",
    "price-low",
    "price-high",
  ]);

export const metadata: Metadata = {
  metadataBase:
    new URL(APP_URL),

  title:
    "Réservez vos billets pour les meilleurs événements",

  description:
    "Découvrez et réservez facilement vos billets pour les meilleurs concerts, festivals, conférences, spectacles, événements sportifs et expériences en Afrique.",

  applicationName:
    "Tikemia",

  creator:
    "Tikemia",

  publisher:
    "Tikemia",

  category:
    "Billetterie et événements",

  keywords: [
    "Tikemia",
    "billetterie en ligne",
    "billets événements",
    "tickets événements",
    "concerts en Afrique",
    "festivals en Afrique",
    "conférences",
    "spectacles",
    "événements sportifs",
    "réservation de billets",
    "billets électroniques",
  ],

  alternates: {
    canonical:
      "/",
  },

  openGraph: {
    type:
      "website",

    locale:
      "fr_FR",

    url:
      "/",

    siteName:
      "Tikemia",

    title:
      "Tikemia — Vivez l’expérience des meilleurs événements",

    description:
      "Réservez facilement vos billets pour les meilleurs concerts, festivals, conférences, spectacles et événements en Afrique.",

    images: [
      {
        url:
          "/imageclient.png",

        width:
          1536,

        height:
          1024,

        alt:
          "Tikemia — Réservez vos billets pour les meilleurs événements",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Tikemia — Vivez l’expérience des meilleurs événements",

    description:
      "Découvrez et réservez vos billets pour les meilleurs événements sur Tikemia.",

    images: [
      {
        url:
          "/imageclient.png",

        alt:
          "Tikemia — Réservez vos billets pour les meilleurs événements",
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

export const dynamic =
  "force-dynamic";

type ClientHomePageSearchParams = {
  page?: string | string[];
  search?: string | string[];
  category?: string | string[];
  city?: string | string[];
  countryCode?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  sort?: string | string[];
};

type ClientHomePageProps = {
  searchParams?: Promise<ClientHomePageSearchParams>;
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
    ClientHomePageSearchParams;
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
    ? `/?${query}`
    : "/";
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

function ClientHomePagination({
  pagination,
  currentSearchParams,
}: {
  pagination:
    ClientHomePagination;
  currentSearchParams:
    ClientHomePageSearchParams;
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

export default async function HomePage({
  searchParams,
}: ClientHomePageProps) {
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

  const homeData =
    await getClientHomeEvents({
      page,

      pageSize:
        HOME_PAGE_SIZE,

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

  const hasActiveFilters =
    Boolean(
      search ||
        category ||
        city ||
        countryCode ||
        dateFrom ||
        dateTo ||
        sort !==
          "soonest",
    );

  const resultsCount =
    Math.max(
      homeData.pagination.totalItems,
      0,
    );

  const plural =
    resultsCount > 1
      ? "s"
      : "";

  return (
    <ClientLayout>
      <div className="min-h-screen bg-[#03070a] text-white">
        <ClientHomeHero
          backgroundImage="/images/client/home/events-hero.png"
          backgroundImageAlt="Grande scène de concert avec un public enthousiaste"
          totalEvents={
            homeData.totals
              .publishedEvents
          }
          totalCities={
            homeData.totals
              .cities
          }
          totalCategories={
            homeData.totals
              .categories
          }
          primaryActionHref="#client-home-filters"
          secondaryActionHref="/events"
        />

        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-28 sm:px-5 lg:px-8 lg:pb-16">
          <div
            id="client-home-filters"
            className="-mt-1 scroll-mt-28 sm:-mt-3 lg:-mt-7"
          >
            <ClientHomeFilters
              filters={
                homeData.filters
              }
              categories={
                homeData.categories
              }
              cities={
                homeData.cities
              }
              basePath="/"
              className="shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
            />
          </div>

          <div className="mt-9 sm:mt-11 lg:mt-14">
            <ClientFeaturedEvents
              events={
                homeData.featuredEvents
              }
              viewAllHref="/events?featured=true"
              description="Les événements sélectionnés et mis en avant sur Tikemia."
              priorityCount={
                2
              }
            />
          </div>

          <div className="mt-10 sm:mt-12 lg:mt-16">
            <ClientAllEvents
              events={
                homeData.events
              }
              pagination={
                homeData.pagination
              }
              title={
                hasActiveFilters
                  ? "Résultats de votre recherche"
                  : "Tous les événements"
              }
              description={
                hasActiveFilters
                  ? `${resultsCount.toLocaleString(
                      "fr-FR",
                    )} événement${plural} correspondant à vos critères.`
                  : `${resultsCount.toLocaleString(
                      "fr-FR",
                    )} événement${plural} disponible${plural} sur Tikemia.`
              }
              initialView="grid"
              emptyActionHref="/"
              emptyActionLabel="Réinitialiser les filtres"
            />

            <ClientHomePagination
              pagination={
                homeData.pagination
              }
              currentSearchParams={
                resolvedSearchParams
              }
            />
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}