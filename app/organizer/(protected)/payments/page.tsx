import { createHash } from "node:crypto";

import {
  AlertTriangle,
  ArrowLeft,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import PaymentsPageClient from "@/components/organizer/payments/payments-page-client";
import {
  GetOrganizerPaymentsError,
  getOrganizerPayments,
  type OrganizerPaymentsData,
  type OrganizerPaymentsSort,
} from "@/lib/organizer/get-organizer-payments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParamValue =
  | string
  | string[]
  | undefined;

type OrganizerPaymentsPageProps = {
  searchParams: Promise<{
    page?: SearchParamValue;
    pageSize?: SearchParamValue;
    search?: SearchParamValue;
    eventId?: SearchParamValue;
    currency?: SearchParamValue;
    paymentStatus?: SearchParamValue;
    paymentMethod?: SearchParamValue;
    paymentProvider?: SearchParamValue;
    payoutStatus?: SearchParamValue;
    periodDays?: SearchParamValue;
    dateFrom?: SearchParamValue;
    dateTo?: SearchParamValue;
    timeZone?: SearchParamValue;
    sort?: SearchParamValue;
    payout?: SearchParamValue;
  }>;
};

type ConnectedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizerProfile: {
    businessName: string | null;
  } | null;
};

type PaymentsPageLoadResult =
  | {
      success: true;
      organizer: ConnectedOrganizer;
      data: OrganizerPaymentsData;
      requestPayoutOpen: boolean;
    }
  | {
      success: false;
      message: string;
    };

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAXIMUM_PAGE_SIZE = 100;
const DEFAULT_PERIOD_DAYS = 30;
const MAXIMUM_PERIOD_DAYS = 3650;

const ALLOWED_SORTS: readonly OrganizerPaymentsSort[] = [
  "NEWEST",
  "OLDEST",
  "AMOUNT_HIGH",
  "AMOUNT_LOW",
];

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getFirstSearchParam(
  value: SearchParamValue,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function normalizeOptionalText(
  value: SearchParamValue,
): string | null {
  const normalized =
    getFirstSearchParam(value)
      ?.trim() ?? "";

  return normalized || null;
}

function parsePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value: SearchParamValue;
  fallback: number;
  maximum: number;
}): number {
  const parsedValue =
    Number.parseInt(
      getFirstSearchParam(value) ??
        "",
      10,
    );

  if (
    !Number.isFinite(
      parsedValue,
    ) ||
    parsedValue < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsedValue,
    maximum,
  );
}

function parseSort(
  value: SearchParamValue,
): OrganizerPaymentsSort {
  const normalized =
    getFirstSearchParam(value)
      ?.trim()
      .toUpperCase() ?? "";

  return ALLOWED_SORTS.includes(
    normalized as OrganizerPaymentsSort,
  )
    ? (
        normalized as OrganizerPaymentsSort
      )
    : "NEWEST";
}

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(value);
  } catch {
    return `${new Intl.NumberFormat(
      "fr-FR",
      {
        maximumFractionDigits:
          2,
      },
    ).format(value)} ${currency}`;
  }
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    redirect(
      "/organizer/login",
    );
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
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
    redirect(
      "/organizer/login",
    );
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[ORGANIZER_PAYMENTS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    redirect(
      "/organizer/login",
    );
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    redirect(
      "/organizer/login",
    );
  }

  return {
    id:
      organizer.id,
    firstName:
      organizer.firstName,
    lastName:
      organizer.lastName,
    email:
      organizer.email,
    organizerProfile:
      organizer.organizerProfile,
  };
}

function buildOrganizerDisplayName({
  businessName,
  firstName,
  lastName,
  email,
}: {
  businessName:
    | string
    | null
    | undefined;
  firstName: string;
  lastName: string;
  email: string;
}): string {
  const fullName =
    `${firstName} ${lastName}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return (
    businessName?.trim() ||
    fullName ||
    email ||
    "Organisateur Tikemia"
  );
}

async function loadPaymentsPageData(
  params: Awaited<
    OrganizerPaymentsPageProps["searchParams"]
  >,
): Promise<PaymentsPageLoadResult> {
  try {
    const organizer =
      await getConnectedOrganizer();

    const page =
      parsePositiveInteger({
        value:
          params.page,
        fallback:
          DEFAULT_PAGE,
        maximum:
          1_000_000,
      });

    const pageSize =
      parsePositiveInteger({
        value:
          params.pageSize,
        fallback:
          DEFAULT_PAGE_SIZE,
        maximum:
          MAXIMUM_PAGE_SIZE,
      });

    const periodDays =
      parsePositiveInteger({
        value:
          params.periodDays,
        fallback:
          DEFAULT_PERIOD_DAYS,
        maximum:
          MAXIMUM_PERIOD_DAYS,
      });

    const data =
      await getOrganizerPayments({
        organizerId:
          organizer.id,

        page,
        pageSize,

        search:
          normalizeOptionalText(
            params.search,
          ),

        eventId:
          normalizeOptionalText(
            params.eventId,
          ),

        currency:
          normalizeOptionalText(
            params.currency,
          ),

        paymentStatus:
          normalizeOptionalText(
            params.paymentStatus,
          ),

        paymentMethod:
          normalizeOptionalText(
            params.paymentMethod,
          ),

        paymentProvider:
          normalizeOptionalText(
            params.paymentProvider,
          ),

        payoutStatus:
          normalizeOptionalText(
            params.payoutStatus,
          ),

        periodDays,

        dateFrom:
          normalizeOptionalText(
            params.dateFrom,
          ),

        dateTo:
          normalizeOptionalText(
            params.dateTo,
          ),

        timeZone:
          normalizeOptionalText(
            params.timeZone,
          ),

        sort:
          parseSort(
            params.sort,
          ),
      });

    return {
      success: true,
      organizer,
      data,
      requestPayoutOpen:
        normalizeOptionalText(
          params.payout,
        ) === "request",
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerPaymentsError
    ) {
      return {
        success: false,
        message:
          error.message,
      };
    }

    console.error(
      "[ORGANIZER_PAYMENTS_PAGE_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return {
      success: false,
      message:
        "Une erreur inattendue empêche momentanément l’affichage de vos informations financières.",
    };
  }
}

function PaymentsErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <main className="w-full min-w-0 bg-[#03090d] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <section className="relative w-full min-w-0 overflow-hidden rounded-3xl border border-red-500/20 bg-[#071014] px-5 py-10 text-center sm:px-7 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.04),transparent_30%)]" />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.07]">
            <AlertTriangle className="h-7 w-7 text-red-300" />
          </div>

          <h1 className="mt-5 text-2xl font-black text-white sm:text-3xl">
            Impossible de charger les paiements
          </h1>

          <p className="mt-3 text-sm leading-6 text-neutral-500">
            {message}
          </p>

          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/organizer/payments"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-5 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/[0.14]"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </Link>

            <Link
              href="/organizer/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Tableau de bord
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function OrganizerPaymentsPage({
  searchParams,
}: OrganizerPaymentsPageProps) {
  const params =
    await searchParams;

  const result =
    await loadPaymentsPageData(
      params,
    );

  if (!result.success) {
    return (
      <PaymentsErrorState
        message={
          result.message
        }
      />
    );
  }

  const {
    organizer,
    data,
    requestPayoutOpen,
  } = result;

  const organizerDisplayName =
    buildOrganizerDisplayName({
      businessName:
        organizer
          .organizerProfile
          ?.businessName,
      firstName:
        organizer.firstName,
      lastName:
        organizer.lastName,
      email:
        organizer.email,
    });

  return (
    <main className="w-full min-w-0 bg-[#03090d] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="w-full min-w-0 space-y-6">
        <section className="relative w-full min-w-0 overflow-hidden rounded-3xl border border-white/[0.075] bg-[#071014] px-5 py-6 shadow-[0_22px_70px_rgba(0,0,0,0.22)] sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.06),transparent_30%)]" />

          <div className="relative flex min-w-0 flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Espace financier sécurisé
                </span>

                <span className="inline-flex h-7 items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-bold text-neutral-500">
                  {organizerDisplayName}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                Paiements et retraits
              </h1>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-500">
                Suivez les encaissements, commissions, revenus nets, remboursements et demandes de retrait depuis une seule interface professionnelle.
              </p>
            </div>

            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[560px]">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400/70">
                  Solde disponible
                </p>

                <p className="mt-2 text-xl font-black text-emerald-300">
                  {formatMoney(
                    data.summary
                      .availableBalance,
                    data.currency,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.05] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-orange-400/70">
                  Solde réservé
                </p>

                <p className="mt-2 text-xl font-black text-orange-300">
                  {formatMoney(
                    data.summary
                      .reservedBalance,
                    data.currency,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-400/70">
                  Paiements réussis
                </p>

                <p className="mt-2 text-xl font-black text-sky-300">
                  {new Intl.NumberFormat(
                    "fr-FR",
                  ).format(
                    data.summary
                      .successfulPayments,
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        <PaymentsPageClient
          data={data}
          initialRequestPayoutOpen={
            requestPayoutOpen
          }
        />
      </div>
    </main>
  );
}