import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import OrdersListClient from "@/components/organizer/orders/orders-list-client";
import OrdersSummary from "@/components/organizer/orders/orders-summary";
import {
  getOrganizerOrders,
  GetOrganizerOrdersError,
  type OrganizerOrdersSort,
} from "@/lib/organizer/get-organizer-orders";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrganizerOrdersPageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    eventId?: string;
    status?: string;
    currency?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  }>;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const ALLOWED_SORTS: readonly OrganizerOrdersSort[] = [
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

function parsePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value: string | undefined;
  fallback: number;
  maximum: number;
}): number {
  const parsedValue =
    Number.parseInt(
      value ?? "",
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
  value: string | undefined,
): OrganizerOrdersSort {
  const normalizedValue =
    value?.trim().toUpperCase() ?? "";

  return ALLOWED_SORTS.includes(
    normalizedValue as OrganizerOrdersSort,
  )
    ? (normalizedValue as OrganizerOrdersSort)
    : "NEWEST";
}

async function getConnectedOrganizer() {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    redirect("/organizer/login");
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
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            firstName:
              true,

            lastName:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,

            _count: {
              select: {
                organizerEvents:
                  true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    redirect("/organizer/login");
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
            "[ORGANIZER_ORDERS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    redirect("/organizer/login");
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    redirect("/organizer/login");
  }

  return organizer;
}

export default async function OrganizerOrdersPage({
  searchParams,
}: OrganizerOrdersPageProps) {
  const organizer =
    await getConnectedOrganizer();

  const params =
    await searchParams;

  const page =
    parsePositiveInteger({
      value:
        params.page,

      fallback:
        1,

      maximum:
        1_000_000,
    });

  const pageSize =
    parsePositiveInteger({
      value:
        params.pageSize,

      fallback:
        12,

      maximum:
        100,
    });

  try {
    const data =
      await getOrganizerOrders({
        organizerId:
          organizer.id,

        page,
        pageSize,

        search:
          params.search ?? null,

        eventId:
          params.eventId ?? null,

        status:
          params.status ?? null,

        currency:
          params.currency ?? null,

        paymentStatus:
          params.paymentStatus ?? null,

        paymentMethod:
          params.paymentMethod ?? null,

        dateFrom:
          params.dateFrom ?? null,

        dateTo:
          params.dateTo ?? null,

        sort:
          parseSort(
            params.sort,
          ),
      });

    const organizerName =
      `${organizer.firstName} ${organizer.lastName}`
        .replace(/\s+/g, " ")
        .trim();

    const hasEvents =
      organizer._count.organizerEvents >
      0;

    return (
      <div className="space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#081015] px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:px-5 sm:py-6 lg:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.08),transparent_30%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-lime-400">
                  <ShoppingBag className="h-3.5 w-3.5" />

                  Commandes organisateur
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-black text-neutral-500">
                  <ShieldCheck className="h-3.5 w-3.5" />

                  Données sécurisées
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl lg:text-4xl">
                Commandes et ventes
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">
                Suivez toutes les commandes, les acheteurs,
                les événements, les billets, les paiements
                et les revenus de votre activité Tikemia
                dans une seule interface claire.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
                <span>
                  Organisateur :{" "}
                  <strong className="font-black text-neutral-300">
                    {organizerName ||
                      "Organisateur Tikemia"}
                  </strong>
                </span>

                <span>
                  Dernière actualisation :{" "}
                  <strong className="font-black text-neutral-300">
                    {new Intl.DateTimeFormat(
                      "fr-FR",
                      {
                        day:
                          "2-digit",
                        month:
                          "short",
                        year:
                          "numeric",
                        hour:
                          "2-digit",
                        minute:
                          "2-digit",
                      },
                    ).format(
                      new Date(
                        data.generatedAt,
                      ),
                    )}
                  </strong>
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[390px]">
              <QuickAction
                href="/organizer/events"
                icon={ArrowLeft}
                title="Voir les événements"
                description="Retour à vos événements"
              />

              <QuickAction
                href="/api/organizer/orders/export?format=pdf"
                icon={Download}
                title="Rapport PDF"
                description="Exporter toutes les commandes"
                external
              />
            </div>
          </div>
        </header>

        <OrdersSummary
          summary={
            data.summary
          }
        />

        <section className="rounded-2xl border border-orange-500/18 bg-orange-500/[0.04] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/10">
              <ReceiptText className="h-[18px] w-[18px] text-orange-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                Lecture financière multi-devises
              </h2>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Chaque commande conserve la devise de son
                événement. Les montants XOF, XAF, EUR, NGN,
                GHS et autres monnaies restent séparés et
                ne sont jamais additionnés entre eux sans
                conversion explicite.
              </p>
            </div>
          </div>
        </section>

        <OrdersListClient
          data={data}
          hasEvents={hasEvents}
        />

        <footer className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#071014] px-4 py-4 text-[11px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              {data.pagination.totalItems.toLocaleString(
                "fr-FR",
              )}{" "}
              commande
              {data.pagination.totalItems >
              1
                ? "s"
                : ""}
            </span>

            <span>
              {data.summary.totalTickets.toLocaleString(
                "fr-FR",
              )}{" "}
              billet
              {data.summary.totalTickets >
              1
                ? "s"
                : ""}
            </span>

            <span>
              {data.summary.uniqueCustomers.toLocaleString(
                "fr-FR",
              )}{" "}
              client
              {data.summary.uniqueCustomers >
              1
                ? "s"
                : ""}{" "}
              unique
              {data.summary.uniqueCustomers >
              1
                ? "s"
                : ""}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FooterExportLink
              href="/api/organizer/orders/export?format=csv"
              icon={FileText}
              label="CSV"
            />

            <FooterExportLink
              href="/api/organizer/orders/export?format=xlsx"
              icon={FileSpreadsheet}
              label="Excel"
            />

            <FooterExportLink
              href="/api/organizer/orders/export?format=pdf"
              icon={FileText}
              label="PDF"
            />
          </div>
        </footer>
      </div>
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerOrdersError
    ) {
      if (
        error.status ===
          401 ||
        error.status ===
          403
      ) {
        redirect("/organizer/login");
      }

      return (
        <OrdersPageError
          title="Impossible de charger les commandes"
          message={
            error.message
          }
        />
      );
    }

    console.error(
      "[ORGANIZER_ORDERS_PAGE_ERROR]",
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

    return (
      <OrdersPageError
        title="Une erreur inattendue est survenue"
        message="Les commandes ne peuvent pas être affichées pour le moment."
      />
    );
  }
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  external = false,
}: {
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
  external?: boolean;
}) {
  const className =
    "group flex min-h-[82px] items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.045]";

  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-4 w-4 text-neutral-400 transition group-hover:text-lime-400" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black text-white">
          {title}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-neutral-600">
          {description}
        </p>
      </div>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {content}
    </Link>
  );
}

function FooterExportLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 text-[10px] font-black text-neutral-500 transition hover:border-orange-500/25 hover:text-orange-300"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function OrdersPageError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] px-4 py-12 text-center sm:px-6 sm:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>

      <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-white">
        {title}
      </h1>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-500">
        {message}
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/organizer/dashboard"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-xs font-black text-neutral-300 transition hover:border-white/[0.15] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </Link>

        <Link
          href="/organizer/orders"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white transition hover:scale-[1.01]"
        >
          <RefreshCcw className="h-4 w-4" />
          Réessayer
        </Link>
      </div>
    </section>
  );
}