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
      className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:mt-10"
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
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition duration-200 hover:border-lime-500/30 hover:bg-lime-500/[0.08] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
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
                    : "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-sm font-black text-neutral-400 outline-none transition duration-200 hover:border-lime-500/30 hover:bg-lime-500/[0.08] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
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
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition duration-200 hover:border-lime-500/30 hover:bg-lime-500/[0.08] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
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

  const hasFeaturedEvents =
    homeData.featuredEvents.length >
    0;

  const highlightedEvents =
    hasFeaturedEvents
      ? homeData.featuredEvents
      : homeData.events.slice(
          0,
          FEATURED_EVENTS_LIMIT,
        );

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

  const shouldShowIntro =
    page === 1 &&
    !search &&
    !category &&
    !city &&
    !countryCode &&
    !dateFrom &&
    !dateTo &&
    sort === "soonest";

  return (
    <ClientLayout>
      <div className="relative min-h-screen overflow-hidden bg-[#020608] text-white">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes tikemia-home-intro-overlay {
                0%, 78% {
                  opacity: 1;
                  visibility: visible;
                }

                100% {
                  opacity: 0;
                  visibility: hidden;
                  pointer-events: none;
                }
              }

              @keyframes tikemia-home-intro-logo {
                0% {
                  transform: rotate(0deg) scale(0.78);
                  opacity: 0;
                }

                12% {
                  opacity: 1;
                }

                72% {
                  transform: rotate(720deg) scale(1);
                  opacity: 1;
                }

                100% {
                  transform: rotate(760deg) scale(0.94);
                  opacity: 0;
                }
              }

              @keyframes tikemia-home-intro-glow {
                0%, 100% {
                  transform: scale(0.78);
                  opacity: 0.18;
                }

                50% {
                  transform: scale(1.08);
                  opacity: 0.45;
                }
              }

              @keyframes tikemia-home-intro-text {
                0%, 20% {
                  transform: translateY(8px);
                  opacity: 0;
                }

                38%, 76% {
                  transform: translateY(0);
                  opacity: 1;
                }

                100% {
                  transform: translateY(-5px);
                  opacity: 0;
                }
              }

              .tikemia-home-intro {
                animation: tikemia-home-intro-overlay 2.5s ease-out forwards;
              }

              .tikemia-home-intro-logo {
                animation: tikemia-home-intro-logo 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                transform-origin: center;
                will-change: transform, opacity;
              }

              .tikemia-home-intro-glow {
                animation: tikemia-home-intro-glow 1.2s ease-in-out infinite;
                will-change: transform, opacity;
              }

              .tikemia-home-intro-text {
                animation: tikemia-home-intro-text 2.5s ease-out forwards;
              }

              @media (prefers-reduced-motion: reduce) {
                .tikemia-home-intro {
                  animation-duration: 0.35s;
                }

                .tikemia-home-intro-logo,
                .tikemia-home-intro-glow,
                .tikemia-home-intro-text {
                  animation: none !important;
                }
              }
            `,
          }}
        />

        {shouldShowIntro ? (
          <div
            aria-hidden="true"
            className="tikemia-home-intro fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#020608]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(132,204,22,0.10),transparent_34%),radial-gradient(circle_at_58%_45%,rgba(249,115,22,0.08),transparent_28%)]" />

            <div className="relative flex flex-col items-center justify-center px-6 text-center">
              <div className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40 lg:h-44 lg:w-44">
                <div className="tikemia-home-intro-glow absolute inset-4 rounded-full bg-lime-400/20 blur-3xl" />

                <img
                  src="/icons/icon-512x512.png"
                  alt=""
                  className="tikemia-home-intro-logo relative z-10 h-full w-full object-contain drop-shadow-[0_20px_45px_rgba(132,204,22,0.22)]"
                />
              </div>

              <div className="tikemia-home-intro-text mt-5">
                <p className="text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                  Tikemia
                </p>

                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-lime-400 sm:text-xs">
                  Vivez l’événement
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[520px] h-[700px] bg-[radial-gradient(circle_at_20%_10%,rgba(132,204,22,0.09),transparent_32%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,0.07),transparent_30%)]"
        />

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

        <div className="relative z-10 mx-auto w-full max-w-[1680px] px-3 pb-28 sm:px-5 lg:px-8 xl:px-10 lg:pb-20">
          <div
            id="client-home-filters"
            className="-mt-2 scroll-mt-28 sm:-mt-4 lg:-mt-8"
          >
            <div className="rounded-[24px] border border-white/[0.07] bg-[#061014]/95 p-1 shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[28px]">
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
                className="shadow-none"
              />
            </div>
          </div>

          <section
            aria-label="Tikemia en chiffres"
            className="mt-5 grid grid-cols-3 overflow-hidden rounded-[22px] border border-white/[0.06] bg-white/[0.018] shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:mt-6 sm:rounded-[26px]"
          >
            <div className="relative px-3 py-4 text-center sm:px-6 sm:py-6">
              <p className="text-lg font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                {homeData.totals
                  .publishedEvents
                  .toLocaleString(
                    "fr-FR",
                  )}
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600 sm:text-xs">
                Événements
              </p>
            </div>

            <div className="relative border-x border-white/[0.06] px-3 py-4 text-center sm:px-6 sm:py-6">
              <p className="text-lg font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                {homeData.totals
                  .cities
                  .toLocaleString(
                    "fr-FR",
                  )}
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600 sm:text-xs">
                Villes
              </p>
            </div>

            <div className="relative px-3 py-4 text-center sm:px-6 sm:py-6">
              <p className="text-lg font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                {homeData.totals
                  .categories
                  .toLocaleString(
                    "fr-FR",
                  )}
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600 sm:text-xs">
                Catégories
              </p>
            </div>
          </section>

          {highlightedEvents.length > 0 && (
            <section className="relative mt-10 sm:mt-14 lg:mt-18">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-10 -top-20 h-80 bg-[radial-gradient(circle_at_center,rgba(132,204,22,0.055),transparent_65%)]"
              />

              <div className="relative">
                <ClientFeaturedEvents
                  events={
                    highlightedEvents
                  }
                  viewAllHref={
                    hasFeaturedEvents
                      ? "/events?featured=true"
                      : "/events"
                  }
                  description={
                    hasFeaturedEvents
                      ? "Découvrez les événements sélectionnés et mis en avant sur Tikemia."
                      : "Découvrez les événements disponibles prochainement sur Tikemia."
                  }
                  priorityCount={
                    2
                  }
                />
              </div>
            </section>
          )}

          <div className="my-10 h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent sm:my-14 lg:my-16" />

          <section className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-40 top-0 h-[420px] w-[420px] rounded-full bg-lime-400/[0.025] blur-3xl"
            />

            <div className="relative rounded-[24px] border border-white/[0.055] bg-[#050b0e]/70 p-3 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:rounded-[30px] sm:p-5 lg:p-7">
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
          </section>

          <section className="mt-10 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(132,204,22,0.07),rgba(255,255,255,0.018)_45%,rgba(14,165,233,0.04))] p-5 sm:mt-14 sm:rounded-[30px] sm:p-7 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-9">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-400 sm:text-xs">
                L’expérience Tikemia
              </p>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl">
                Votre prochain événement commence ici.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base sm:leading-7">
                Explorez les événements disponibles, trouvez l’expérience qui vous correspond et réservez vos billets simplement sur Tikemia.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-none">
              <Link
                href="/events"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-lime-500 px-6 text-sm font-black text-[#061000] transition hover:bg-lime-400"
              >
                Explorer les événements
              </Link>

              <Link
                href="/categories"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] px-6 text-sm font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06]"
              >
                Voir les catégories
              </Link>
            </div>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}