import { createHash } from "node:crypto";

import {
  CalendarCheck2,
  CalendarDays,
  Clock3,
  RefreshCcw,
  TicketCheck,
  UsersRound,
  WalletCards,
  CircleDollarSign,
  ChevronRight,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import CategoryChart from "@/components/organizer/dashboard/category-chart";
import RecentActivities from "@/components/organizer/dashboard/recent-activities";
import RecentEvents from "@/components/organizer/dashboard/recent-events";
import RevenueChart from "@/components/organizer/dashboard/revenue-chart";
import RevenueSummary from "@/components/organizer/dashboard/revenue-summary";
import SalesChart from "@/components/organizer/dashboard/sales-chart";
import OrganizerStatCard from "@/components/organizer/dashboard/stat-card";
import {
  getOrganizerDashboard,
  type DashboardCurrencyOption,
  type DashboardCurrencySummary,
  type OrganizerDashboardData,
} from "@/lib/organizer/get-organizer-dashboard";
import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
} from "@/lib/localization/format-money";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganizerDashboardPageProps = {
  searchParams: Promise<{
    period?: string | string[];
    currency?: string | string[];
  }>;
};

const AVAILABLE_PERIODS = [7, 30, 90] as const;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getFirstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePeriod(value: string | undefined): number {
  const parsedValue = Number(value);

  if (
    AVAILABLE_PERIODS.includes(
      parsedValue as (typeof AVAILABLE_PERIODS)[number],
    )
  ) {
    return parsedValue;
  }

  return 30;
}

function parseCurrency(
  value: string | undefined,
): SupportedCurrencyCode {
  const currency =
    value?.trim().toUpperCase() ?? "";

  if (
    isSupportedCurrencyCode(currency) &&
    getCurrencyDefinition(currency)?.active
  ) {
    return currency;
  }

  return DEFAULT_CURRENCY_CODE;
}

function formatPeriodDate(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function formatGeneratedTime(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function createDashboardUrl(
  period: number,
  currency: SupportedCurrencyCode,
): string {
  const params = new URLSearchParams({
    period: String(period),
    currency,
  });

  return `/organizer/dashboard?${params.toString()}`;
}

function getCurrencyOption(
  dashboard: OrganizerDashboardData,
  currency: SupportedCurrencyCode,
): DashboardCurrencyOption {
  return (
    dashboard.currencyOptions.find(
      (option) =>
        option.code === currency,
    ) ?? {
      code: currency,
      name:
        getCurrencyDefinition(currency)?.name ??
        currency,
      symbol:
        getCurrencyDefinition(currency)?.symbol ??
        currency,
      fractionDigits:
        getCurrencyDefinition(currency)?.decimals ??
        2,
    }
  );
}

async function getConnectedOrganizer() {
  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    "tikemia_session";

  const cookieStore = await cookies();
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
      .catch(() => undefined);

    redirect("/organizer/login");
  }

  if (
    session.user.role !== "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    redirect("/organizer/login");
  }

  return session.user;
}

function CurrencyRevenueCard({
  item,
  option,
  active,
  periodDays,
}: {
  item: DashboardCurrencySummary;
  option: DashboardCurrencyOption;
  active: boolean;
  periodDays: number;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        active
          ? "border-orange-500/30 bg-orange-500/[0.055]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.13em] text-neutral-600">
            {option.name}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <p className="text-lg font-black text-white">
              {option.code}
            </p>

            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-black text-neutral-400">
              {option.symbol}
            </span>
          </div>
        </div>

        {active ? (
          <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black text-orange-300">
            Active
          </span>
        ) : (
          <Link
            href={createDashboardUrl(
              periodDays,
              item.currency,
            )}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 text-[10px] font-black text-neutral-500 transition hover:text-white"
          >
            Voir
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <CurrencyMetric
          label="Revenu brut"
          value={formatMoney({
            amount:
              item.grossRevenue,
            currency:
              item.currency,
          })}
        />

        <CurrencyMetric
          label="Revenu net"
          value={formatMoney({
            amount:
              item.netRevenue,
            currency:
              item.currency,
          })}
        />

        <CurrencyMetric
          label="Solde disponible"
          value={formatMoney({
            amount:
              item.availableBalance,
            currency:
              item.currency,
          })}
        />

        <CurrencyMetric
          label="Reversements réservés"
          value={formatMoney({
            amount:
              item.reservedPayouts,
            currency:
              item.currency,
          })}
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-neutral-600">
        <span>
          {item.ticketsSold.toLocaleString(
            "fr-FR",
          )}{" "}
          billet
          {item.ticketsSold > 1
            ? "s"
            : ""}
        </span>

        <span>
          {item.paidOrders.toLocaleString(
            "fr-FR",
          )}{" "}
          commande
          {item.paidOrders > 1
            ? "s"
            : ""}
        </span>
      </div>
    </article>
  );
}

function CurrencyMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <p className="text-[10px] text-neutral-600">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-neutral-200">
        {value}
      </p>
    </div>
  );
}

function getMiniChartValues(
  dashboard: OrganizerDashboardData,
  metric:
    | "grossRevenue"
    | "netRevenue"
    | "ticketsSold"
    | "paidOrders",
): number[] {
  const values = dashboard.salesChart
    .slice(-12)
    .map((point) => point[metric]);

  if (values.length >= 2) {
    return values;
  }

  return [0, 0];
}

export default async function OrganizerDashboardPage({
  searchParams,
}: OrganizerDashboardPageProps) {
  const resolvedSearchParams = await searchParams;

  const periodDays = parsePeriod(
    getFirstSearchParam(resolvedSearchParams.period),
  );

  const currency = parseCurrency(
    getFirstSearchParam(resolvedSearchParams.currency),
  );

  const organizer = await getConnectedOrganizer();

  const dashboard = await getOrganizerDashboard({
    organizerId: organizer.id,
    currency,
    periodDays,
    timeZone: "Africa/Porto-Novo",
  });

  const selectedCurrencyOption =
    getCurrencyOption(
      dashboard,
      dashboard.currency,
    );

  const organizerName =
    `${organizer.firstName} ${organizer.lastName}`.trim();

  const firstName =
    organizer.firstName.trim() ||
    organizerName ||
    "Organisateur";

  const periodStart = formatPeriodDate(
    dashboard.period.start,
  );

  const periodEnd = formatPeriodDate(
    dashboard.period.end,
  );

  const generatedTime = formatGeneratedTime(
    dashboard.generatedAt,
  );

  const hasBusinessData =
    dashboard.summary.totalEvents > 0 ||
    dashboard.revenueByCurrency.some(
      (item) =>
        item.ticketsSold > 0 ||
        item.grossRevenue > 0 ||
        item.paidOrders > 0,
    );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* En-tête principal */}
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-400">
            Bonjour,{" "}
            <span className="font-bold text-white">
              {firstName}
            </span>{" "}
            👋
          </p>

          <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
            Tableau de bord
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-500">
            Suivez vos événements, vos ventes et vos revenus.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex h-11 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#081015] px-3.5 text-xs text-neutral-300">
            <CalendarDays className="h-4 w-4 shrink-0 text-neutral-500" />

            <span className="whitespace-nowrap">
              {periodStart} – {periodEnd}
            </span>
          </div>

          <div className="flex h-11 items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 text-xs font-semibold text-lime-400">
            <RefreshCcw className="h-4 w-4" />

            <span>
              Actualisé à {generatedTime}
            </span>
          </div>
        </div>
      </section>

      {/* Sélection de période */}
      <nav
        aria-label="Période du tableau de bord"
        className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#081015] p-1"
      >
        {AVAILABLE_PERIODS.map((period) => {
          const active = dashboard.period.days === period;

          return (
            <Link
              key={period}
              href={createDashboardUrl(
                period,
                dashboard.currency,
              )}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center justify-center rounded-lg px-3.5 text-xs font-bold transition ${
                active
                  ? "bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-white shadow-[0_8px_24px_rgba(34,197,94,0.14)]"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {period} jours
            </Link>
          );
        })}
      </nav>

      {/* Sélection de devise */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#081015] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/10">
              <CircleDollarSign className="h-5 w-5 text-orange-400" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-black text-white">
                Devise du tableau de bord
              </h2>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Les revenus sont toujours affichés séparément par devise. Aucun montant XOF, EUR, NGN ou autre n’est additionné avec une autre monnaie.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {dashboard.currencyOptions.map(
              (option) => {
                const active =
                  option.code ===
                  dashboard.currency;

                return (
                  <Link
                    key={option.code}
                    href={createDashboardUrl(
                      dashboard.period.days,
                      option.code,
                    )}
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-black transition ${
                      active
                        ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                        : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:border-white/[0.15] hover:text-white"
                    }`}
                  >
                    <span>
                      {option.code}
                    </span>

                    <span className="text-[10px] opacity-70">
                      {option.symbol}
                    </span>
                  </Link>
                );
              },
            )}
          </div>
        </div>
      </section>

      {/* Indicateurs principaux */}
      <section
        aria-label="Indicateurs principaux"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <OrganizerStatCard
          title="Solde disponible"
          value={formatMoney({
            amount:
              dashboard.summary.availableBalance,
            currency:
              dashboard.currency,
          })}
          icon={WalletCards}
          tone="green"
          trend={{
            direction:
              dashboard.trends.netRevenue.direction,
            percentage:
              dashboard.trends.netRevenue.percentage,
            label: "sur la période précédente",
          }}
          miniChart={getMiniChartValues(
            dashboard,
            "netRevenue",
          )}
        />

        <OrganizerStatCard
          title="Billets vendus"
          value={dashboard.summary.ticketsSold.toLocaleString(
            "fr-FR",
          )}
          icon={TicketCheck}
          tone="orange"
          trend={{
            direction:
              dashboard.trends.ticketsSold.direction,
            percentage:
              dashboard.trends.ticketsSold.percentage,
            label: "sur la période précédente",
          }}
          miniChart={getMiniChartValues(
            dashboard,
            "ticketsSold",
          )}
        />

        <OrganizerStatCard
          title="Places restantes"
          value={dashboard.summary.remainingPlaces.toLocaleString(
            "fr-FR",
          )}
          description="Capacité encore disponible"
          icon={CalendarCheck2}
          tone="blue"
        />

        <OrganizerStatCard
          title="Événements actifs"
          value={dashboard.summary.activeEvents.toLocaleString(
            "fr-FR",
          )}
          description={`${dashboard.summary.totalEvents.toLocaleString(
            "fr-FR",
          )} événement${
            dashboard.summary.totalEvents > 1 ? "s" : ""
          } au total`}
          icon={CalendarDays}
          tone="purple"
          miniChart={getMiniChartValues(
            dashboard,
            "paidOrders",
          )}
        />

        <OrganizerStatCard
          title="Participants"
          value={dashboard.summary.participants.toLocaleString(
            "fr-FR",
          )}
          description="Acheteurs uniques enregistrés"
          icon={UsersRound}
          tone="yellow"
        />
      </section>

      {/* Vue financière multi-devises */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
        <header className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-black text-white">
              Revenus par devise
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Soldes, revenus nets, commissions et reversements conservés dans leur devise d’origine.
            </p>
          </div>

          <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2 text-xs font-black text-orange-300">
            {selectedCurrencyOption.name}
            {" — "}
            {selectedCurrencyOption.code}
          </div>
        </header>

        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
          {dashboard.revenueByCurrency.map(
            (item) => (
              <CurrencyRevenueCard
                key={item.currency}
                item={item}
                option={
                  getCurrencyOption(
                    dashboard,
                    item.currency,
                  )
                }
                active={
                  item.currency ===
                  dashboard.currency
                }
                periodDays={
                  dashboard.period.days
                }
              />
            ),
          )}
        </div>
      </section>

      {/* État de démarrage réel */}
      {!hasBusinessData && (
        <section className="flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.07] via-lime-500/[0.035] to-orange-500/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <CalendarDays className="h-5 w-5 text-lime-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                Commencez avec votre premier événement
              </h2>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Les statistiques apparaîtront automatiquement
                après vos premières ventes confirmées.
              </p>
            </div>
          </div>

          <Link
            href="/organizer/events/create"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white transition hover:scale-[1.01]"
          >
            Créer un événement
          </Link>
        </section>
      )}

      {/* Graphique principal des ventes */}
      <SalesChart
        data={dashboard.salesChart}
        currency={dashboard.currency}
        periodDays={dashboard.period.days}
      />

      {/* Analyse des revenus */}
      <section className="grid gap-5 xl:grid-cols-2">
        <RevenueChart
          summary={dashboard.summary}
          netRevenueTrend={
            dashboard.trends.netRevenue
          }
          currency={dashboard.currency}
          periodDays={dashboard.period.days}
        />

        <CategoryChart
          data={dashboard.revenueByCategory}
          currency={dashboard.currency}
        />
      </section>

      {/* Résumé financier */}
      <RevenueSummary
        summary={dashboard.summary}
        grossRevenueTrend={
          dashboard.trends.grossRevenue
        }
        netRevenueTrend={
          dashboard.trends.netRevenue
        }
        currency={dashboard.currency}
        periodDays={dashboard.period.days}
      />

      {/* Événements et activités */}
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.8fr)]">
        <RecentEvents
          events={dashboard.recentEvents}
        />

        <RecentActivities
          activities={dashboard.recentActivities}
        />
      </section>

      {/* Informations de synchronisation */}
      <section className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-[11px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5" />

          <span>
            Données générées à partir des commandes et paiements
            enregistrés.
          </span>
        </div>

        <span>
          Devise active :{" "}
          {selectedCurrencyOption.code}
          {" — "}
          {selectedCurrencyOption.symbol}
        </span>
      </section>
    </div>
  );
}