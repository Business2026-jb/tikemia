import { createHash } from "node:crypto";

import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AttendancePerformance from "@/components/organizer/statistics/attendance-performance";
import CategoryPerformanceChart from "@/components/organizer/statistics/category-performance-chart";
import CountryPerformanceChart from "@/components/organizer/statistics/country-performance-chart";
import EventsPerformanceCards from "@/components/organizer/statistics/events-performance-cards";
import EventsPerformanceTable from "@/components/organizer/statistics/events-performance-table";
import PaymentMethodsChart from "@/components/organizer/statistics/payment-methods-chart";
import RevenueBreakdown from "@/components/organizer/statistics/revenue-breakdown";
import RevenuePerformanceChart from "@/components/organizer/statistics/revenue-performance-chart";
import StatisticsEmptyState from "@/components/organizer/statistics/statistics-empty-state";
import StatisticsSummary from "@/components/organizer/statistics/statistics-summary";
import StatisticsToolbar from "@/components/organizer/statistics/statistics-toolbar";
import TopPerformers from "@/components/organizer/statistics/top-performers";
import {
  GetOrganizerStatisticsError,
  getOrganizerStatistics,
  type OrganizerStatisticsData,
} from "@/lib/organizer/get-organizer-statistics";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatisticsPageSearchParams = {
  periodDays?: string | string[];
  currency?: string | string[];
  eventId?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  timeZone?: string | string[];
};

type OrganizerStatisticsPageProps = {
  searchParams: Promise<StatisticsPageSearchParams>;
};

type ConnectedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

const DEFAULT_PERIOD_DAYS = 30;
const DEFAULT_CURRENCY = "XOF";
const DEFAULT_TIME_ZONE = "Africa/Porto-Novo";
const SESSION_COOKIE_FALLBACK_NAME = "tikemia_session";

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getFirstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function normalizeText(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function parsePeriodDays(
  value: string | undefined,
): number {
  const parsed = Number(value);

  if (
    Number.isInteger(parsed) &&
    parsed >= 1 &&
    parsed <= 3650
  ) {
    return parsed;
  }

  return DEFAULT_PERIOD_DAYS;
}

function parseCurrency(
  value: string | undefined,
): string {
  const normalized =
    normalizeText(value)?.toUpperCase();

  if (
    normalized &&
    /^[A-Z]{3}$/.test(normalized)
  ) {
    return normalized;
  }

  return DEFAULT_CURRENCY;
}

function parseDateInput(
  value: string | undefined,
): string | undefined {
  const normalized = normalizeText(value);

  if (!normalized) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? undefined
    : normalized;
}

function parseTimeZone(
  value: string | undefined,
): string {
  const normalized =
    normalizeText(value) ??
    DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: normalized,
    }).format(new Date());

    return normalized;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function formatDate(
  value: string,
  timeZone: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

function formatGeneratedAt(
  value: string,
  timeZone: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function hasStatisticsData(
  statistics: OrganizerStatisticsData,
): boolean {
  const summary = statistics.summary;

  return Boolean(
    summary.grossRevenue > 0 ||
      summary.netRevenue > 0 ||
      summary.paidOrders > 0 ||
      summary.ticketsSold > 0 ||
      summary.participants > 0 ||
      summary.validTickets > 0 ||
      summary.usedTickets > 0 ||
      statistics.salesChart.some(
        (point) =>
          point.grossRevenue > 0 ||
          point.ticketsSold > 0 ||
          point.paidOrders > 0 ||
          point.participants > 0,
      ) ||
      statistics.eventPerformance.some(
        (event) =>
          event.grossRevenue > 0 ||
          event.ticketsSold > 0 ||
          event.paidOrders > 0 ||
          event.participants > 0,
      ),
  );
}

function hasActiveFilters(
  statistics: OrganizerStatisticsData,
): boolean {
  return Boolean(
    statistics.filters.eventId ||
      statistics.period.custom ||
      statistics.period.days !== DEFAULT_PERIOD_DAYS ||
      statistics.filters.currency !== DEFAULT_CURRENCY,
  );
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
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
          firstName: true,
          lastName: true,
          email: true,
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
          "[STATISTICS_PAGE_EXPIRED_SESSION_DELETE_ERROR]",
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

  return {
    id: session.user.id,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    email: session.user.email,
  };
}

function StatisticsPageError({
  message,
}: {
  message: string;
}) {
  return (
    <main className="w-full min-w-0 px-3 py-4 sm:px-4 lg:px-5 xl:px-6">
      <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-red-500/20 bg-[#071014] p-5 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.08),transparent_36%)]" />

        <div className="relative flex min-h-[320px] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.08]">
            <Database className="h-7 w-7 text-red-300" />
          </div>

          <h1 className="mt-5 text-xl font-black text-white sm:text-2xl">
            Statistiques indisponibles
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">
            {message}
          </p>

          <a
            href="/organizer/statistics"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-200 transition hover:border-white/[0.16] hover:bg-white/[0.06]"
          >
            <Activity className="h-4 w-4" />
            Réessayer
          </a>
        </div>
      </section>
    </main>
  );
}

export default async function OrganizerStatisticsPage({
  searchParams,
}: OrganizerStatisticsPageProps) {
  const resolvedSearchParams = await searchParams;

  const organizer = await getConnectedOrganizer();

  const periodDays = parsePeriodDays(
    getFirstSearchParam(
      resolvedSearchParams.periodDays,
    ),
  );

  const currency = parseCurrency(
    getFirstSearchParam(
      resolvedSearchParams.currency,
    ),
  );

  const eventId = normalizeText(
    getFirstSearchParam(
      resolvedSearchParams.eventId,
    ),
  );

  const dateFrom = parseDateInput(
    getFirstSearchParam(
      resolvedSearchParams.dateFrom,
    ),
  );

  const dateTo = parseDateInput(
    getFirstSearchParam(
      resolvedSearchParams.dateTo,
    ),
  );

  const timeZone = parseTimeZone(
    getFirstSearchParam(
      resolvedSearchParams.timeZone,
    ),
  );

  let statistics: OrganizerStatisticsData;

  try {
    statistics = await getOrganizerStatistics({
      organizerId: organizer.id,
      periodDays,
      currency,
      eventId,
      dateFrom,
      dateTo,
      timeZone,
    });
  } catch (error) {
    if (error instanceof GetOrganizerStatisticsError) {
      if (
        error.status === 401 ||
        error.status === 403
      ) {
        redirect("/organizer/login");
      }

      return (
        <StatisticsPageError
          message={error.message}
        />
      );
    }

    console.error(
      "[ORGANIZER_STATISTICS_PAGE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return (
      <StatisticsPageError
        message="Impossible de charger les données statistiques pour le moment. Veuillez réessayer dans quelques instants."
      />
    );
  }

  const hasData = hasStatisticsData(statistics);
  const filtersAreActive =
    hasActiveFilters(statistics);

  const organizerName =
    [organizer.firstName, organizer.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    organizer.email;

  const periodLabel =
    `${formatDate(
      statistics.period.start,
      statistics.period.timeZone,
    )} — ${formatDate(
      statistics.period.end,
      statistics.period.timeZone,
    )}`;

  return (
    <main className="w-full min-w-0 overflow-x-hidden">
      <div className="w-full min-w-0 space-y-4 px-3 py-4 sm:px-4 sm:py-5 lg:px-5 xl:px-6 2xl:px-7">
        <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.075),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.045),transparent_30%)]" />

          <div className="relative flex w-full min-w-0 flex-col gap-5 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6 xl:py-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1 text-[10px] font-bold text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Espace sécurisé
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/[0.07] px-3 py-1 text-[10px] font-bold text-sky-300">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Données réelles
                </span>

                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-semibold text-neutral-500">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {organizerName}
                  </span>
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl xl:text-4xl">
                Statistiques
              </h1>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-500">
                Analysez vos ventes, revenus, événements, participants,
                paiements et performances depuis une seule interface
                professionnelle.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-sky-400" />
                  {periodLabel}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {statistics.events.length} événement
                  {statistics.events.length > 1 ? "s" : ""}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-orange-400" />
                  Actualisé le{" "}
                  {formatGeneratedAt(
                    statistics.generatedAt,
                    statistics.period.timeZone,
                  )}
                </span>
              </div>
            </div>

            <div className="w-full min-w-0 lg:w-auto lg:max-w-[920px]">
              <StatisticsToolbar
                period={statistics.period}
                filters={statistics.filters}
                events={statistics.events}
                currencyOptions={
                  statistics.currencyOptions
                }
                exportBaseUrl="/api/organizer/statistics/export"
              />
            </div>
          </div>
        </section>

        {!hasData ? (
          <StatisticsEmptyState
            eventCount={statistics.events.length}
            hasActiveFilters={filtersAreActive}
            createEventHref="/organizer/events/create"
            eventsHref="/organizer/events"
            resetHref="/organizer/statistics"
          />
        ) : (
          <>
            <StatisticsSummary
              summary={statistics.summary}
              trends={statistics.trends}
              currency={statistics.currency}
            />

            <section className="grid w-full min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
              <RevenuePerformanceChart
                data={statistics.salesChart}
                currency={statistics.currency}
                period={statistics.period}
              />

              <RevenueBreakdown
                data={statistics.revenueBreakdown}
                currency={statistics.currency}
              />
            </section>

            <AttendancePerformance
              summary={statistics.summary}
              trend={statistics.trends.attendanceRate}
            />

            <TopPerformers
              data={statistics.topPerformers}
              currency={statistics.currency}
            />

            <EventsPerformanceTable
              events={statistics.eventPerformance}
              displayCurrency={statistics.currency}
            />

            <EventsPerformanceCards
              events={statistics.eventPerformance}
              displayCurrency={statistics.currency}
            />

            <section className="grid w-full min-w-0 gap-4 2xl:grid-cols-2">
              <CategoryPerformanceChart
                data={statistics.revenueByCategory}
                currency={statistics.currency}
              />

              <CountryPerformanceChart
                data={statistics.revenueByCountry}
                currency={statistics.currency}
              />
            </section>

            <PaymentMethodsChart
              data={statistics.paymentMethods}
              currency={statistics.currency}
            />
          </>
        )}
      </div>
    </main>
  );
}