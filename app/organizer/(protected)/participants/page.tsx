import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import ParticipantsListClient from "@/components/organizer/participants/participants-list-client";
import ParticipantsSummary from "@/components/organizer/participants/participants-summary";
import {
  getOrganizerParticipants,
  GetOrganizerParticipantsError,
  ORGANIZER_PARTICIPANTS_SORTS,
  type OrganizerParticipantsSort,
} from "@/lib/organizer/get-organizer-participants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Participants | Tikemia Organisateur",
  description:
    "Consultez, recherchez et gérez les participants de vos événements Tikemia.",
};

const SESSION_COOKIE_FALLBACK_NAME = "tikemia_session";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

type ParticipantsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    search?: string | string[];
    eventId?: string | string[];
    ticketTypeId?: string | string[];
    status?: string | string[];
    attendance?: string | string[];
    country?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    sort?: string | string[];
  }>;
};

type ConnectedOrganizer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  businessName: string | null;
};

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getFirstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function normalizeSort(
  value: string | undefined,
): OrganizerParticipantsSort {
  const normalized = value?.trim().toUpperCase();

  if (
    normalized &&
    ORGANIZER_PARTICIPANTS_SORTS.includes(
      normalized as OrganizerParticipantsSort,
    )
  ) {
    return normalized as OrganizerParticipantsSort;
  }

  return "NEWEST";
}

function formatGeneratedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "À l’instant";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function createExportUrl({
  format,
  params,
}: {
  format: "csv" | "xlsx" | "pdf";
  params: {
    search?: string;
    eventId?: string;
    ticketTypeId?: string;
    status?: string;
    attendance?: string;
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  };
}): string {
  const exportParams = new URLSearchParams();

  exportParams.set("format", format);

  for (const [key, value] of Object.entries(params)) {
    if (value?.trim()) {
      exportParams.set(key, value.trim());
    }
  }

  return `/api/organizer/participants/export?${exportParams.toString()}`;
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    redirect("/organizer/login");
  }

  const hashedToken = hashSessionToken(sessionToken);

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashedToken,
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          isActive: true,
          organizerProfile: {
            select: {
              businessName: true,
            },
          },
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
          "[PARTICIPANTS_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error ? error.message : error,
        );
      });

    redirect("/organizer/login");
  }

  const organizer = session.user;

  if (
    organizer.role !== "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    redirect("/organizer/login");
  }

  return {
    id: organizer.id,
    email: organizer.email,
    firstName: organizer.firstName,
    lastName: organizer.lastName,
    businessName: organizer.organizerProfile?.businessName ?? null,
  };
}

function ParticipantsPageError({
  message,
}: {
  message: string;
}) {
  return (
    <main className="min-h-full bg-[#03090d] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[520px] max-w-7xl items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-red-500/20 bg-[#071014] p-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
            <UsersRound className="h-7 w-7 text-red-300" />
          </div>

          <h1 className="mt-5 text-xl font-black text-white">
            Impossible de charger les participants
          </h1>

          <p className="mt-3 text-sm leading-6 text-neutral-500">
            {message}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/organizer/participants"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </Link>

            <Link
              href="/organizer/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function ParticipantsPage({
  searchParams,
}: ParticipantsPageProps) {
  const organizer = await getConnectedOrganizer();
  const params = await searchParams;

  const page = parsePositiveInteger(
    getFirstSearchParam(params.page),
    DEFAULT_PAGE,
    1_000_000,
  );

  const pageSize = parsePositiveInteger(
    getFirstSearchParam(params.pageSize),
    DEFAULT_PAGE_SIZE,
    100,
  );

  const search = getFirstSearchParam(params.search);
  const eventId = getFirstSearchParam(params.eventId);
  const ticketTypeId = getFirstSearchParam(params.ticketTypeId);
  const status = getFirstSearchParam(params.status);
  const attendance = getFirstSearchParam(params.attendance);
  const country = getFirstSearchParam(params.country);
  const dateFrom = getFirstSearchParam(params.dateFrom);
  const dateTo = getFirstSearchParam(params.dateTo);
  const sort = normalizeSort(getFirstSearchParam(params.sort));

  try {
    const data = await getOrganizerParticipants({
      organizerId: organizer.id,
      page,
      pageSize,
      search,
      eventId,
      ticketTypeId,
      status,
      attendance,
      country,
      dateFrom,
      dateTo,
      sort,
    });

    const exportFilters = {
      search,
      eventId,
      ticketTypeId,
      status,
      attendance,
      country,
      dateFrom,
      dateTo,
      sort,
    };

    const organizerDisplayName =
      organizer.businessName ||
      `${organizer.firstName} ${organizer.lastName}`.trim() ||
      organizer.email;

    return (
      <main className="min-h-full w-full min-w-0 overflow-x-hidden bg-[#03090d] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 xl:px-8">
        <div className="w-full min-w-0 space-y-6">
          <section className="relative w-full min-w-0 overflow-hidden rounded-3xl border border-white/[0.075] bg-[#071014] px-5 py-6 sm:px-7 sm:py-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.06),transparent_30%)]" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[11px] font-bold text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Espace sécurisé
                  </span>

                  <span className="inline-flex h-7 items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 text-[11px] font-semibold text-neutral-500">
                    {organizerDisplayName}
                  </span>
                </div>

                <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Participants
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500 sm:text-[15px]">
                  Consultez l’ensemble des détenteurs de billets,
                  contrôlez leur présence et retrouvez les commandes,
                  paiements, événements et informations utiles depuis
                  une seule page.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-emerald-400" />
                    {data.pagination.totalItems.toLocaleString("fr-FR")} billet
                    {data.pagination.totalItems > 1 ? "s" : ""}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-sky-400" />
                    {data.options.events.length.toLocaleString("fr-FR")} événement
                    {data.options.events.length > 1 ? "s" : ""}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <TicketCheck className="h-4 w-4 text-orange-400" />
                    {data.options.ticketTypes.length.toLocaleString("fr-FR")} type
                    {data.options.ticketTypes.length > 1 ? "s" : ""} de billet
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <Link
                  href={createExportUrl({
                    format: "csv",
                    params: exportFilters,
                  })}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white"
                >
                  <FileText className="h-4 w-4" />
                  CSV
                </Link>

                <Link
                  href={createExportUrl({
                    format: "xlsx",
                    params: exportFilters,
                  })}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Link>

                <Link
                  href={createExportUrl({
                    format: "pdf",
                    params: exportFilters,
                  })}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.08] px-4 text-sm font-bold text-orange-300 transition hover:bg-orange-500/15"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Link>
              </div>
            </div>
          </section>

          <ParticipantsSummary summary={data.summary} />

          <section className="grid w-full min-w-0 gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-white/[0.07] bg-[#071014] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                  <UserRoundCheck className="h-4 w-4 text-emerald-300" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500">
                    Présence
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {data.summary.attendanceRate.toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })}
                    % validé
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-white/[0.07] bg-[#071014] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
                  <ScanLine className="h-4 w-4 text-sky-300" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500">
                    Entrées validées
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {data.summary.checkedInParticipants.toLocaleString("fr-FR")} participant
                    {data.summary.checkedInParticipants > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-white/[0.07] bg-[#071014] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
                  <UsersRound className="h-4 w-4 text-violet-300" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500">
                    Dernière actualisation
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {formatGeneratedDate(data.generatedAt)}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <ParticipantsListClient data={data} />
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof GetOrganizerParticipantsError) {
      return <ParticipantsPageError message={error.message} />;
    }

    console.error(
      "[ORGANIZER_PARTICIPANTS_PAGE_ERROR]",
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
      <ParticipantsPageError message="Une erreur inattendue empêche temporairement l’affichage des participants." />
    );
  }
}