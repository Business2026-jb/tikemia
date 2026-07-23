import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarPlus2,
  CircleDollarSign,
  RefreshCcw,
  ShieldCheck,
  TicketCheck,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";

import EventsListClient from "@/components/organizer/events/events-list-client";
import EventsToolbar from "@/components/organizer/events/events-toolbar";
import {
  getOrganizerEvents,
  GetOrganizerEventsError,
  type OrganizerEventsSort,
  type OrganizerEventsStatusFilter,
} from "@/lib/events/get-organizer-events";

export const metadata: Metadata = {
  title: "Mes événements | Tikemia",
  description:
    "Consultez, recherchez et gérez tous vos événements Tikemia.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrganizerEventsPageProps = {
  searchParams: Promise<{
    search?: string | string[];
    status?: string | string[];
    sort?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
  }>;
};

const SUPPORTED_STATUSES = new Set<
  OrganizerEventsStatusFilter
>([
  "ALL",
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "SUSPENDED",
  "CANCELLED",
  "COMPLETED",
]);

const SUPPORTED_SORTS = new Set<
  OrganizerEventsSort
>([
  "created-desc",
  "created-asc",
  "updated-desc",
  "updated-asc",
  "start-desc",
  "start-asc",
  "title-asc",
  "title-desc",
]);

function getSingleSearchParameter(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function parsePositiveInteger(
  value: string,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return parsedValue;
}

function parseStatus(
  value: string,
): OrganizerEventsStatusFilter {
  const normalizedStatus =
    value.trim().toUpperCase() as OrganizerEventsStatusFilter;

  return SUPPORTED_STATUSES.has(normalizedStatus)
    ? normalizedStatus
    : "ALL";
}

function parseSort(
  value: string,
): OrganizerEventsSort {
  const normalizedSort =
    value.trim() as OrganizerEventsSort;

  return SUPPORTED_SORTS.has(normalizedSort)
    ? normalizedSort
    : "created-desc";
}

function formatMoney(
  value: number,
  currency = "XOF",
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits:
      currency === "XOF" ||
      currency === "XAF"
        ? 0
        : 2,
    maximumFractionDigits:
      currency === "XOF" ||
      currency === "XAF"
        ? 0
        : 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

type OrganizerEventsPageData = Awaited<
  ReturnType<typeof getOrganizerEvents>
>;

type OrganizerEventsLoadResult =
  | {
      success: true;
      data: OrganizerEventsPageData;
    }
  | {
      success: false;
      message: string;
    };

type OrganizerEventsQuery = {
  search: string;
  status: OrganizerEventsStatusFilter;
  sort: OrganizerEventsSort;
  page: number;
  pageSize: number;
};

function createOrganizerEventsQuery(
  resolvedSearchParams: Awaited<
    OrganizerEventsPageProps["searchParams"]
  >,
): OrganizerEventsQuery {
  const search = getSingleSearchParameter(
    resolvedSearchParams.search,
  ).slice(0, 120);

  const status = parseStatus(
    getSingleSearchParameter(
      resolvedSearchParams.status,
    ),
  );

  const sort = parseSort(
    getSingleSearchParameter(
      resolvedSearchParams.sort,
    ),
  );

  const page = parsePositiveInteger(
    getSingleSearchParameter(
      resolvedSearchParams.page,
    ),
    1,
  );

  const pageSize = Math.min(
    parsePositiveInteger(
      getSingleSearchParameter(
        resolvedSearchParams.pageSize,
      ),
      12,
    ),
    50,
  );

  return {
    search,
    status,
    sort,
    page,
    pageSize,
  };
}

async function loadOrganizerEventsPageData(
  query: OrganizerEventsQuery,
): Promise<OrganizerEventsLoadResult> {
  try {
    const data = await getOrganizerEvents(query);

    return {
      success: true,
      data,
    };
  } catch (error) {
    if (
      error instanceof GetOrganizerEventsError
    ) {
      if (
        error.status === 401 ||
        error.code === "UNAUTHORIZED" ||
        error.code === "INVALID_SESSION" ||
        error.code === "EXPIRED_SESSION"
      ) {
        redirect("/organizer/login");
      }

      return {
        success: false,
        message: error.message,
      };
    }

    console.error(
      "[ORGANIZER_EVENTS_PAGE_ERROR]",
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

    return {
      success: false,
      message:
        "Impossible de charger vos événements pour le moment.",
    };
  }
}

export default async function OrganizerEventsPage({
  searchParams,
}: OrganizerEventsPageProps) {
  const resolvedSearchParams =
    await searchParams;

  const query =
    createOrganizerEventsQuery(
      resolvedSearchParams,
    );

  const result =
    await loadOrganizerEventsPageData(
      query,
    );

  if (!result.success) {
    return (
      <OrganizerEventsLoadError
        message={result.message}
      />
    );
  }

  const { data } = result;

  const primaryCurrency =
    data.events[0]?.currency ?? "XOF";

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* En-tête principal */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.07),transparent_32%)]" />

        <div className="relative flex flex-col gap-5 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-lime-400">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              Gestion des événements
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
              Mes événements
            </h1>

            <p className="mt-2 max-w-[720px] text-sm leading-6 text-neutral-500">
              Consultez vos événements, suivez
              les ventes, les revenus et gérez
              chaque publication depuis votre
              espace organisateur.
            </p>

            <p className="mt-3 text-xs text-neutral-600">
              Compte :{" "}
              <span className="font-bold text-neutral-300">
                {data.organizer.displayName}
              </span>
            </p>
          </div>

          <Link
            href="/organizer/events/create"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(34,197,94,0.18)] transition hover:scale-[1.01]"
          >
            <CalendarPlus2 className="h-4 w-4" />
            Créer un événement
          </Link>
        </div>
      </section>

      {/* Statistiques globales */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarCheck2}
          label="Total événements"
          value={formatNumber(
            data.summary.totalEvents,
          )}
          detail={`${formatNumber(
            data.summary.activeEvents,
          )} actif${
            data.summary.activeEvents > 1
              ? "s"
              : ""
          }`}
          tone="green"
        />

        <SummaryCard
          icon={TicketCheck}
          label="Billets vendus"
          value={formatNumber(
            data.summary.totalTicketsSold,
          )}
          detail={`${formatNumber(
            data.summary.totalPlacesRemaining,
          )} place${
            data.summary
              .totalPlacesRemaining > 1
              ? "s"
              : ""
          } restante${
            data.summary
              .totalPlacesRemaining > 1
              ? "s"
              : ""
          }`}
          tone="blue"
        />

        <SummaryCard
          icon={CircleDollarSign}
          label="Chiffre d’affaires"
          value={formatMoney(
            data.summary.grossRevenue,
            primaryCurrency,
          )}
          detail={`${formatNumber(
            data.summary.totalPaidOrders,
          )} commande${
            data.summary.totalPaidOrders > 1
              ? "s"
              : ""
          } payée${
            data.summary.totalPaidOrders > 1
              ? "s"
              : ""
          }`}
          tone="orange"
        />

        <SummaryCard
          icon={WalletCards}
          label="Revenu net"
          value={formatMoney(
            data.summary.organizerNetRevenue,
            primaryCurrency,
          )}
          detail={`${formatMoney(
            data.summary.platformFee,
            primaryCurrency,
          )} de commission`}
          tone="green"
        />
      </section>

      {/* Barre de recherche et filtres */}
      <EventsToolbar
        search={data.filters.search}
        status={data.filters.status}
        sort={data.filters.sort}
        statusCounts={data.statusCounts}
      />

      {/* Résumé de la liste */}
      <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#081015] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-black text-white">
            Liste des événements
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {data.pagination.totalItems === 0
              ? "Aucun événement ne correspond à cette sélection."
              : `${formatNumber(
                  data.pagination.totalItems,
                )} événement${
                  data.pagination.totalItems > 1
                    ? "s"
                    : ""
                } trouvé${
                  data.pagination.totalItems > 1
                    ? "s"
                    : ""
                }.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusCount
            label="Brouillons"
            value={data.statusCounts.draft}
            className="border-neutral-500/20 bg-neutral-500/[0.06] text-neutral-400"
          />

          <StatusCount
            label="En examen"
            value={data.statusCounts.pending}
            className="border-orange-500/20 bg-orange-500/[0.06] text-orange-400"
          />

          <StatusCount
            label="Publiés"
            value={data.statusCounts.published}
            className="border-emerald-500/20 bg-emerald-500/[0.06] text-lime-400"
          />
        </div>
      </section>

      {/* Liste cliente interactive */}
      <EventsListClient
        events={data.events}
        pagination={data.pagination}
        filters={data.filters}
      />

      {/* Sécurité */}
      <section className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#081015] px-4 py-4 sm:px-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />

        <div>
          <p className="text-sm font-bold text-white">
            Gestion sécurisée
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Chaque événement affiché appartient
            uniquement à votre compte. La
            suppression est bloquée lorsqu’un
            événement possède déjà des commandes
            ou des billets.
          </p>
        </div>
      </section>
    </main>
  );
}

type IconComponent = typeof CalendarCheck2;

function SummaryCard({
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
  tone: "green" | "blue" | "orange";
}) {
  const toneStyles = {
    green: {
      wrapper:
        "border-emerald-500/20 bg-emerald-500/[0.04]",
      icon:
        "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
      value: "text-lime-400",
    },

    blue: {
      wrapper:
        "border-blue-500/20 bg-blue-500/[0.04]",
      icon:
        "border-blue-500/25 bg-blue-500/10 text-blue-400",
      value: "text-blue-300",
    },

    orange: {
      wrapper:
        "border-orange-500/20 bg-orange-500/[0.04]",
      icon:
        "border-orange-500/25 bg-orange-500/10 text-orange-400",
      value: "text-orange-300",
    },
  };

  const styles = toneStyles[tone];

  return (
    <article
      className={`rounded-2xl border bg-[#081015] p-4 ${styles.wrapper}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${styles.icon}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-xl font-black tracking-[-0.03em] ${styles.value}`}
      >
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-neutral-600">
        {detail}
      </p>
    </article>
  );
}

function StatusCount({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${className}`}
    >
      {label}

      <span className="rounded-full bg-black/20 px-1.5 py-0.5 font-black">
        {formatNumber(value)}
      </span>
    </span>
  );
}

function OrganizerEventsLoadError({
  message,
}: {
  message: string;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-180px)] w-full max-w-[900px] items-center justify-center py-8">
      <section className="w-full overflow-hidden rounded-2xl border border-red-500/20 bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <header className="flex items-start gap-3.5 border-b border-white/[0.07] bg-gradient-to-r from-red-500/[0.07] via-orange-500/[0.03] to-transparent px-5 py-5 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>

          <div>
            <h1 className="text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
              Événements indisponibles
            </h1>

            <p className="mt-1.5 text-sm leading-6 text-neutral-500">
              La liste de vos événements n’a pas
              pu être chargée.
            </p>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3.5 text-sm leading-6 text-red-200"
          >
            {message}
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/organizer/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Retour au dashboard
            </Link>

            <Link
              href="/organizer/events"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01]"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}