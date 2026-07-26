import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck2,
  CalendarClock,
  CircleDollarSign,
  CircleUserRound,
  Clock3,
  CreditCard,
  FileWarning,
  Headphones,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Store,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DASHBOARD_CURRENCY = "XOF";
const REVENUE_DAYS = 7;
const RECENT_ITEMS_LIMIT = 6;

type DashboardData = Awaited<
  ReturnType<typeof getAdminDashboardData>
>;

type DashboardErrorState = {
  error: true;
  message: string;
};

type DashboardSuccessState = {
  error: false;
  data: DashboardData;
};

type DashboardState =
  | DashboardErrorState
  | DashboardSuccessState;

type DailyRevenue = {
  date: Date;
  label: string;
  revenue: number;
  orders: number;
};

function startOfDay(
  value: Date,
): Date {
  const date =
    new Date(value);

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date;
}

function addDays(
  value: Date,
  amount: number,
): Date {
  const date =
    new Date(value);

  date.setDate(
    date.getDate() +
      amount,
  );

  return date;
}

function formatMoney(
  value: number,
  currency =
    DASHBOARD_CURRENCY,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          [
            "XOF",
            "XAF",
          ].includes(
            currency,
          )
            ? 0
            : 2,
      },
    ).format(
      Math.max(
        value,
        0,
      ),
    );
  } catch {
    return `${Math.max(
      value,
      0,
    ).toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
  ).format(
    Math.max(
      Math.trunc(value),
      0,
    ),
  );
}

function formatDateTime(
  value: Date | null,
): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(value);
}

function formatDate(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    },
  ).format(value);
}

function getInitials(
  value: string,
): string {
  const parts =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length ===
    0
  ) {
    return "TK";
  }

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${
    parts[
      parts.length -
        1
    ]?.[0] ?? ""
  }`.toUpperCase();
}

function getEventStatusLabel(
  status: string,
): string {
  const labels: Record<
    string,
    string
  > = {
    DRAFT:
      "Brouillon",

    PENDING:
      "En attente",

    PUBLISHED:
      "Publié",

    REJECTED:
      "Rejeté",

    SUSPENDED:
      "Suspendu",

    CANCELLED:
      "Annulé",

    COMPLETED:
      "Terminé",

    ARCHIVED:
      "Archivé",
  };

  return (
    labels[status] ??
    status
  );
}

function getEventStatusClassName(
  status: string,
): string {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";

    case "PENDING":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";

    case "REJECTED":
    case "SUSPENDED":
    case "CANCELLED":
      return "border-red-400/20 bg-red-400/[0.08] text-red-300";

    case "COMPLETED":
      return "border-blue-400/20 bg-blue-400/[0.08] text-blue-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-neutral-400";
  }
}

function getPaymentStatusLabel(
  status: string,
): string {
  const labels: Record<
    string,
    string
  > = {
    PENDING:
      "En attente",

    SUCCESS:
      "Réussi",

    FAILED:
      "Échoué",

    REFUNDED:
      "Remboursé",
  };

  return (
    labels[status] ??
    status
  );
}

function getPaymentStatusClassName(
  status: string,
): string {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";

    case "PENDING":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";

    case "FAILED":
      return "border-red-400/20 bg-red-400/[0.08] text-red-300";

    case "REFUNDED":
      return "border-violet-400/20 bg-violet-400/[0.08] text-violet-300";

    default:
      return "border-white/[0.08] bg-white/[0.03] text-neutral-400";
  }
}

async function getAdminDashboardData() {
  const now =
    new Date();

  const todayStart =
    startOfDay(now);

  const tomorrowStart =
    addDays(
      todayStart,
      1,
    );

  const revenueStart =
    addDays(
      todayStart,
      -(
        REVENUE_DAYS -
        1
      ),
    );

  const [
    totalUsers,
    activeUsers,
    totalOrganizers,
    activeOrganizers,
    totalCustomers,
    totalEvents,
    publishedEvents,
    pendingEvents,
    totalTickets,
    usedTicketsToday,
    paidOrdersToday,
    pendingOrders,
    pendingPayments,
    failedPaymentsToday,
    pendingPayouts,
    activeSubscriptions,
    openSupportTickets,
    openReports,
    allTimeRevenue,
    todayRevenue,
    platformRevenue,
    pendingPayoutAmount,
    recentEvents,
    recentPayments,
    recentOrders,
    revenueOrders,
  ] =
    await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: {
          isActive:
            true,
        },
      }),

      prisma.user.count({
        where: {
          role:
            "ORGANIZER",
        },
      }),

      prisma.user.count({
        where: {
          role:
            "ORGANIZER",

          isActive:
            true,
        },
      }),

      prisma.user.count({
        where: {
          role:
            "CUSTOMER",
        },
      }),

      prisma.event.count(),

      prisma.event.count({
        where: {
          status:
            "PUBLISHED",
        },
      }),

      prisma.event.count({
        where: {
          status:
            "PENDING",
        },
      }),

      prisma.ticket.count(),

      prisma.ticket.count({
        where: {
          usedAt: {
            gte:
              todayStart,

            lt:
              tomorrowStart,
          },
        },
      }),

      prisma.order.count({
        where: {
          status:
            "PAID",

          paidAt: {
            gte:
              todayStart,

            lt:
              tomorrowStart,
          },
        },
      }),

      prisma.order.count({
        where: {
          status:
            "PENDING",
        },
      }),

      prisma.payment.count({
        where: {
          status:
            "PENDING",
        },
      }),

      prisma.payment.count({
        where: {
          status:
            "FAILED",

          createdAt: {
            gte:
              todayStart,

            lt:
              tomorrowStart,
          },
        },
      }),

      prisma.payout.count({
        where: {
          status: {
            in: [
              "PENDING",
              "PROCESSING",
            ],
          },
        },
      }),

      prisma.organizerSubscription.count({
        where: {
          status:
            "ACTIVE",
        },
      }),

      prisma.supportTicket.count({
        where: {
          status: {
            in: [
              "OPEN",
              "IN_PROGRESS",
              "WAITING_FOR_USER",
            ],
          },
        },
      }),

      prisma.platformReport.count({
        where: {
          status: {
            in: [
              "OPEN",
              "UNDER_REVIEW",
            ],
          },
        },
      }),

      prisma.order.aggregate({
        where: {
          status:
            "PAID",
        },

        _sum: {
          total:
            true,
        },
      }),

      prisma.order.aggregate({
        where: {
          status:
            "PAID",

          paidAt: {
            gte:
              todayStart,

            lt:
              tomorrowStart,
          },
        },

        _sum: {
          total:
            true,
        },
      }),

      prisma.order.aggregate({
        where: {
          status:
            "PAID",
        },

        _sum: {
          platformFee:
            true,
        },
      }),

      prisma.payout.aggregate({
        where: {
          status: {
            in: [
              "PENDING",
              "PROCESSING",
            ],
          },
        },

        _sum: {
          netAmount:
            true,
        },
      }),

      prisma.event.findMany({
        take:
          RECENT_ITEMS_LIMIT,

        orderBy: {
          createdAt:
            "desc",
        },

        select: {
          id:
            true,

          slug:
            true,

          title:
            true,

          city:
            true,

          country:
            true,

          status:
            true,

          startsAt:
            true,

          createdAt:
            true,

          coverImage:
            true,

          organizer: {
            select: {
              firstName:
                true,

              lastName:
                true,

              organizerProfile: {
                select: {
                  businessName:
                    true,
                },
              },
            },
          },

          _count: {
            select: {
              tickets:
                true,

              orders:
                true,
            },
          },
        },
      }),

      prisma.payment.findMany({
        take:
          RECENT_ITEMS_LIMIT,

        orderBy: {
          createdAt:
            "desc",
        },

        select: {
          id:
            true,

          amount:
            true,

          currency:
            true,

          provider:
            true,

          method:
            true,

          status:
            true,

          createdAt:
            true,

          paidAt:
            true,

          order: {
            select: {
              reference:
                true,

              customerName:
                true,

              event: {
                select: {
                  title:
                    true,
                },
              },
            },
          },
        },
      }),

      prisma.order.findMany({
        take:
          RECENT_ITEMS_LIMIT,

        orderBy: {
          createdAt:
            "desc",
        },

        select: {
          id:
            true,

          reference:
            true,

          customerName:
            true,

          total:
            true,

          currency:
            true,

          status:
            true,

          createdAt:
            true,

          event: {
            select: {
              title:
                true,
            },
          },

          _count: {
            select: {
              tickets:
                true,
            },
          },
        },
      }),

      prisma.order.findMany({
        where: {
          status:
            "PAID",

          paidAt: {
            gte:
              revenueStart,

            lt:
              tomorrowStart,
          },
        },

        select: {
          total:
            true,

          paidAt:
            true,
        },
      }),
    ]);

  const dailyRevenue: DailyRevenue[] =
    Array.from(
      {
        length:
          REVENUE_DAYS,
      },
      (
        _,
        index,
      ) => {
        const date =
          addDays(
            revenueStart,
            index,
          );

        const nextDate =
          addDays(
            date,
            1,
          );

        const orders =
          revenueOrders.filter(
            (
              order,
            ) =>
              order.paidAt !==
                null &&
              order.paidAt >=
                date &&
              order.paidAt <
                nextDate,
          );

        return {
          date,

          label:
            new Intl.DateTimeFormat(
              "fr-FR",
              {
                weekday:
                  "short",

                day:
                  "2-digit",
              },
            ).format(
              date,
            ),

          revenue:
            orders.reduce(
              (
                total,
                order,
              ) =>
                total +
                Number(
                  order.total,
                ),
              0,
            ),

          orders:
            orders.length,
        };
      },
    );

  return {
    generatedAt:
      now,

    kpis: {
      totalUsers,
      activeUsers,
      totalOrganizers,
      activeOrganizers,
      totalCustomers,
      totalEvents,
      publishedEvents,
      pendingEvents,
      totalTickets,
      usedTicketsToday,
      paidOrdersToday,
      pendingOrders,
      pendingPayments,
      failedPaymentsToday,
      pendingPayouts,
      activeSubscriptions,
      openSupportTickets,
      openReports,

      allTimeRevenue:
        Number(
          allTimeRevenue
            ._sum.total ??
            0,
        ),

      todayRevenue:
        Number(
          todayRevenue
            ._sum.total ??
            0,
        ),

      platformRevenue:
        Number(
          platformRevenue
            ._sum
            .platformFee ??
            0,
        ),

      pendingPayoutAmount:
        Number(
          pendingPayoutAmount
            ._sum.netAmount ??
            0,
        ),
    },

    dailyRevenue,
    recentEvents,
    recentPayments,
    recentOrders,
  };
}

async function loadDashboardState(): Promise<DashboardState> {
  try {
    const data =
      await getAdminDashboardData();

    return {
      error:
        false,

      data,
    };
  } catch (error) {
    console.error(
      "[ADMIN_DASHBOARD_LOAD_ERROR]",
      error,
    );

    return {
      error:
        true,

      message:
        "Impossible de charger les données du tableau de bord. Vérifiez la connexion à la base de données puis réessayez.",
    };
  }
}

function DashboardSectionHeader({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-black tracking-[-0.02em] text-white sm:text-lg">
          {
            title
          }
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {
              description
            }
          </p>
        )}
      </div>

      {href &&
        actionLabel && (
        <Link
          href={
            href
          }
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-black text-blue-300 transition hover:text-blue-200"
        >
          {
            actionLabel
          }

          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  href,
  tone =
    "blue",
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Users;
  href: string;
  tone?:
    | "blue"
    | "emerald"
    | "amber"
    | "violet"
    | "red"
    | "cyan";
}) {
  const tones = {
    blue:
      "border-blue-400/15 bg-blue-400/[0.055] text-blue-300",

    emerald:
      "border-emerald-400/15 bg-emerald-400/[0.055] text-emerald-300",

    amber:
      "border-amber-400/15 bg-amber-400/[0.055] text-amber-300",

    violet:
      "border-violet-400/15 bg-violet-400/[0.055] text-violet-300",

    red:
      "border-red-400/15 bg-red-400/[0.055] text-red-300",

    cyan:
      "border-cyan-400/15 bg-cyan-400/[0.055] text-cyan-300",
  };

  return (
    <Link
      href={
        href
      }
      className="group min-w-0 rounded-2xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-white/[0.13] hover:shadow-[0_20px_55px_rgba(0,0,0,0.25)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>

        <ArrowRight className="h-4 w-4 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-neutral-400" />
      </div>

      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
        {
          label
        }
      </p>

      <p className="mt-2 truncate text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
        {
          value
        }
      </p>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">
        {
          helper
        }
      </p>
    </Link>
  );
}

function RevenueChart({
  values,
}: {
  values: DailyRevenue[];
}) {
  const maximumRevenue =
    Math.max(
      ...values.map(
        (
          value,
        ) =>
          value.revenue,
      ),
      1,
    );

  const totalRevenue =
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value.revenue,
      0,
    );

  const totalOrders =
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value.orders,
      0,
    );

  return (
    <section className="min-w-0 rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
      <DashboardSectionHeader
        title="Revenus des 7 derniers jours"
        description="Commandes payées uniquement."
        href="/admin/analytics"
        actionLabel="Voir les rapports"
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
            Revenus
          </p>

          <p className="mt-2 text-xl font-black text-white sm:text-2xl">
            {
              formatMoney(
                totalRevenue,
              )
            }
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
            Commandes payées
          </p>

          <p className="mt-2 text-xl font-black text-white sm:text-2xl">
            {
              formatNumber(
                totalOrders,
              )
            }
          </p>
        </div>
      </div>

      <div className="mt-6 flex h-[220px] items-end gap-2 sm:gap-3">
        {values.map(
          (
            value,
          ) => {
            const height =
              value.revenue >
              0
                ? Math.max(
                    (
                      value.revenue /
                      maximumRevenue
                    ) *
                      100,
                    8,
                  )
                : 3;

            return (
              <div
                key={
                  value.date.toISOString()
                }
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="flex h-[170px] w-full items-end">
                  <div
                    title={`${formatMoney(
                      value.revenue,
                    )} · ${formatNumber(
                      value.orders,
                    )} commande${
                      value.orders >
                      1
                        ? "s"
                        : ""
                    }`}
                    className="w-full rounded-t-xl border border-blue-400/20 bg-gradient-to-t from-blue-500/35 via-violet-500/24 to-cyan-400/20 transition hover:brightness-125"
                    style={{
                      height:
                        `${height}%`,
                    }}
                  />
                </div>

                <span className="truncate text-[9px] font-bold capitalize text-neutral-500 sm:text-[10px]">
                  {
                    value.label
                  }
                </span>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}

function OperationalAlerts({
  data,
}: {
  data: DashboardData;
}) {
  const alerts = [
    {
      id:
        "pending-events",

      label:
        "Événements à modérer",

      value:
        data.kpis
          .pendingEvents,

      href:
        "/admin/events?status=PENDING",

      icon:
        CalendarClock,

      className:
        "border-amber-400/15 bg-amber-400/[0.045] text-amber-300",
    },
    {
      id:
        "pending-payments",

      label:
        "Paiements en attente",

      value:
        data.kpis
          .pendingPayments,

      href:
        "/admin/payments?status=PENDING",

      icon:
        CreditCard,

      className:
        "border-blue-400/15 bg-blue-400/[0.045] text-blue-300",
    },
    {
      id:
        "failed-payments",

      label:
        "Paiements échoués aujourd’hui",

      value:
        data.kpis
          .failedPaymentsToday,

      href:
        "/admin/payments?status=FAILED",

      icon:
        ShieldAlert,

      className:
        "border-red-400/15 bg-red-400/[0.045] text-red-300",
    },
    {
      id:
        "support",

      label:
        "Demandes de support ouvertes",

      value:
        data.kpis
          .openSupportTickets,

      href:
        "/admin/support",

      icon:
        Headphones,

      className:
        "border-violet-400/15 bg-violet-400/[0.045] text-violet-300",
    },
    {
      id:
        "reports",

      label:
        "Signalements à traiter",

      value:
        data.kpis
          .openReports,

      href:
        "/admin/reports",

      icon:
        FileWarning,

      className:
        "border-orange-400/15 bg-orange-400/[0.045] text-orange-300",
    },
    {
      id:
        "payouts",

      label:
        "Retraits en attente",

      value:
        data.kpis
          .pendingPayouts,

      href:
        "/admin/payouts",

      icon:
        WalletCards,

      className:
        "border-cyan-400/15 bg-cyan-400/[0.045] text-cyan-300",
    },
  ];

  return (
    <section className="rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
      <DashboardSectionHeader
        title="Contrôle opérationnel"
        description="Éléments qui nécessitent une vérification."
      />

      <div className="mt-5 space-y-2.5">
        {alerts.map(
          (
            alert,
          ) => {
            const Icon =
              alert.icon;

            return (
              <Link
                key={
                  alert.id
                }
                href={
                  alert.href
                }
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-white/[0.025] p-3 transition hover:border-white/[0.11] hover:bg-white/[0.035]"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${alert.className}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-neutral-300">
                    {
                      alert.label
                    }
                  </span>
                </span>

                <strong className="text-base font-black text-white">
                  {
                    formatNumber(
                      alert.value,
                    )
                  }
                </strong>

                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-neutral-400" />
              </Link>
            );
          },
        )}
      </div>
    </section>
  );
}

function RecentEvents({
  events,
}: {
  events: DashboardData["recentEvents"];
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
      <DashboardSectionHeader
        title="Derniers événements"
        description="Créations les plus récentes."
        href="/admin/events"
        actionLabel="Tout afficher"
      />

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.065]">
        {events.length >
        0 ? (
          <div className="divide-y divide-white/[0.06]">
            {events.map(
              (
                event,
              ) => {
                const organizerName =
                  event.organizer
                    .organizerProfile
                    ?.businessName
                    ?.trim() ||
                  `${event.organizer.firstName} ${event.organizer.lastName}`.trim();

                return (
                  <Link
                    key={
                      event.id
                    }
                    href={`/admin/events/${event.id}`}
                    className="group flex min-w-0 items-center gap-3 bg-white/[0.02] p-3.5 transition hover:bg-white/[0.03] sm:p-4"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/[0.055] text-xs font-black text-blue-300">
                      {
                        getInitials(
                          event.title,
                        )
                      }
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-white">
                        {
                          event.title
                        }
                      </span>

                      <span className="mt-1 block truncate text-[11px] text-neutral-500">
                        {
                          organizerName
                        }{" "}
                        ·{" "}
                        {
                          event.city
                        }
                      </span>
                    </span>

                    <span className="hidden text-right sm:block">
                      <span className="block text-xs font-bold text-neutral-300">
                        {
                          formatDate(
                            event.startsAt,
                          )
                        }
                      </span>

                      <span className="mt-1 block text-[10px] text-neutral-500">
                        {
                          formatNumber(
                            event._count
                              .tickets,
                          )
                        }{" "}
                        billet
                        {event._count
                          .tickets >
                        1
                          ? "s"
                          : ""}
                      </span>
                    </span>

                    <span
                      className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black sm:inline-flex ${getEventStatusClassName(
                        event.status,
                      )}`}
                    >
                      {
                        getEventStatusLabel(
                          event.status,
                        )
                      }
                    </span>

                    <ArrowRight className="h-4 w-4 shrink-0 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-neutral-400" />
                  </Link>
                );
              },
            )}
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <CalendarCheck2 className="mx-auto h-7 w-7 text-neutral-700" />

            <p className="mt-3 text-sm font-black text-neutral-400">
              Aucun événement
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function RecentPayments({
  payments,
}: {
  payments: DashboardData["recentPayments"];
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
      <DashboardSectionHeader
        title="Derniers paiements"
        description="Transactions enregistrées récemment."
        href="/admin/payments"
        actionLabel="Tout afficher"
      />

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.065]">
        {payments.length >
        0 ? (
          <div className="divide-y divide-white/[0.06]">
            {payments.map(
              (
                payment,
              ) => (
                <Link
                  key={
                    payment.id
                  }
                  href={`/admin/payments/${payment.id}`}
                  className="group flex min-w-0 items-center gap-3 bg-white/[0.02] p-3.5 transition hover:bg-white/[0.03] sm:p-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.055] text-emerald-300">
                    <CreditCard className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">
                      {
                        payment.order
                          .customerName
                      }
                    </span>

                    <span className="mt-1 block truncate text-[11px] text-neutral-500">
                      {
                        payment.order
                          .reference
                      }{" "}
                      ·{" "}
                      {
                        payment.method
                      }
                    </span>
                  </span>

                  <span className="hidden min-w-0 text-right md:block">
                    <span className="block max-w-[180px] truncate text-xs font-bold text-neutral-300">
                      {
                        payment.order
                          .event.title
                      }
                    </span>

                    <span className="mt-1 block text-[10px] text-neutral-500">
                      {
                        formatDateTime(
                          payment.paidAt ??
                            payment.createdAt,
                        )
                      }
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-black text-white">
                      {
                        formatMoney(
                          Number(
                            payment.amount,
                          ),
                          payment.currency,
                        )
                      }
                    </span>

                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black ${getPaymentStatusClassName(
                        payment.status,
                      )}`}
                    >
                      {
                        getPaymentStatusLabel(
                          payment.status,
                        )
                      }
                    </span>
                  </span>
                </Link>
              ),
            )}
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <CreditCard className="mx-auto h-7 w-7 text-neutral-700" />

            <p className="mt-3 text-sm font-black text-neutral-400">
              Aucun paiement
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function RecentOrders({
  orders,
}: {
  orders: DashboardData["recentOrders"];
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
      <DashboardSectionHeader
        title="Commandes récentes"
        description="Dernières commandes de la plateforme."
        href="/admin/orders"
        actionLabel="Tout afficher"
      />

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {orders.length >
        0 ? (
          orders.map(
            (
              order,
            ) => (
              <Link
                key={
                  order.id
                }
                href={`/admin/orders/${order.id}`}
                className="group rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4 transition hover:border-blue-400/15 hover:bg-blue-400/[0.035]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/[0.055] text-blue-300">
                    <ShoppingBag className="h-[18px] w-[18px]" />
                  </span>

                  <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[9px] font-black text-neutral-400">
                    {
                      order.status
                    }
                  </span>
                </div>

                <p className="mt-4 truncate text-sm font-black text-white">
                  {
                    order.customerName
                  }
                </p>

                <p className="mt-1 truncate text-[11px] text-neutral-500">
                  {
                    order.reference
                  }{" "}
                  ·{" "}
                  {
                    order.event.title
                  }
                </p>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-700">
                      Montant
                    </p>

                    <p className="mt-1 text-sm font-black text-white">
                      {
                        formatMoney(
                          Number(
                            order.total,
                          ),
                          order.currency,
                        )
                      }
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-700">
                      Billets
                    </p>

                    <p className="mt-1 text-sm font-black text-neutral-300">
                      {
                        formatNumber(
                          order._count
                            .tickets,
                        )
                      }
                    </p>
                  </div>
                </div>
              </Link>
            ),
          )
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
            <ReceiptText className="mx-auto h-7 w-7 text-neutral-700" />

            <p className="mt-3 text-sm font-black text-neutral-400">
              Aucune commande
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function QuickActions() {
  const actions = [
    {
      label:
        "Modérer les événements",

      href:
        "/admin/events?status=PENDING",

      icon:
        BadgeCheck,
    },
    {
      label:
        "Gérer les organisateurs",

      href:
        "/admin/organizers",

      icon:
        Store,
    },
    {
      label:
        "Contrôler les paiements",

      href:
        "/admin/payments",

      icon:
        CreditCard,
    },
    {
      label:
        "Traiter les retraits",

      href:
        "/admin/payouts",

      icon:
        WalletCards,
    },
    {
      label:
        "Ouvrir le support",

      href:
        "/admin/support",

      icon:
        Headphones,
    },
    {
      label:
        "Voir les rapports",

      href:
        "/admin/analytics",

      icon:
        TrendingUp,
    },
  ];

  return (
    <section className="rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
      <DashboardSectionHeader
        title="Actions rapides"
        description="Accès direct aux opérations principales."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map(
          (
            action,
          ) => {
            const Icon =
              action.icon;

            return (
              <Link
                key={
                  action.href
                }
                href={
                  action.href
                }
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-white/[0.025] p-3.5 transition hover:border-blue-400/18 hover:bg-blue-400/[0.045]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/[0.055] text-blue-300">
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                <span className="min-w-0 flex-1 truncate text-xs font-black text-neutral-300 group-hover:text-white">
                  {
                    action.label
                  }
                </span>

                <ArrowRight className="h-4 w-4 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-blue-300" />
              </Link>
            );
          },
        )}
      </div>
    </section>
  );
}

export default async function AdminDashboardPage() {
  const state =
    await loadDashboardState();

  if (state.error) {
    return (
      <section className="flex min-h-[520px] items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-red-400/15 bg-red-400/[0.045] p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.3)] sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.08] text-red-300">
            <AlertTriangle className="h-6 w-6" />
          </span>

          <h1 className="mt-5 text-xl font-black text-white">
            Tableau de bord indisponible
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
            {
              state.message
            }
          </p>

          <Link
            href="/admin/dashboard"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-black text-white transition hover:bg-white/[0.06]"
          >
            <RefreshCw className="h-4 w-4" />

            Réessayer
          </Link>
        </div>
      </section>
    );
  }

  const {
    data,
  } = state;

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#02070b] px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.075] bg-[#071116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-6 lg:p-7">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/[0.1] blur-[100px]"
        />

        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-[110px]"
        />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/18 bg-blue-400/[0.065] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-300">
              <Activity className="h-3.5 w-3.5" />

              Supervision en temps réel
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl lg:text-4xl">
              Centre de contrôle Tikemia
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500 sm:text-base">
              Suivez les utilisateurs, les événements, les ventes, les paiements et les opérations importantes de toute la plateforme.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.055] px-3 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              Base de données connectée
            </span>

            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.075] bg-white/[0.025] px-3 text-xs font-semibold text-neutral-500">
              <Clock3 className="h-4 w-4" />

              Mis à jour{" "}
              {
                formatDateTime(
                  data.generatedAt,
                )
              }
            </span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <KpiCard
          label="Utilisateurs"
          value={
            formatNumber(
              data.kpis
                .totalUsers,
            )
          }
          helper={`${formatNumber(
            data.kpis
              .activeUsers,
          )} comptes actifs`}
          icon={
            Users
          }
          href="/admin/customers"
          tone="blue"
        />

        <KpiCard
          label="Organisateurs"
          value={
            formatNumber(
              data.kpis
                .totalOrganizers,
            )
          }
          helper={`${formatNumber(
            data.kpis
              .activeOrganizers,
          )} organisateurs actifs`}
          icon={
            Store
          }
          href="/admin/organizers"
          tone="violet"
        />

        <KpiCard
          label="Événements publiés"
          value={
            formatNumber(
              data.kpis
                .publishedEvents,
            )
          }
          helper={`${formatNumber(
            data.kpis
              .pendingEvents,
          )} en attente de validation`}
          icon={
            CalendarCheck2
          }
          href="/admin/events"
          tone="cyan"
        />

        <KpiCard
          label="Billets générés"
          value={
            formatNumber(
              data.kpis
                .totalTickets,
            )
          }
          helper={`${formatNumber(
            data.kpis
              .usedTicketsToday,
          )} utilisés aujourd’hui`}
          icon={
            Ticket
          }
          href="/admin/orders"
          tone="emerald"
        />

        <KpiCard
          label="Revenus aujourd’hui"
          value={
            formatMoney(
              data.kpis
                .todayRevenue,
            )
          }
          helper={`${formatNumber(
            data.kpis
              .paidOrdersToday,
          )} commandes payées`}
          icon={
            Banknote
          }
          href="/admin/payments"
          tone="amber"
        />

        <KpiCard
          label="Commission Tikemia"
          value={
            formatMoney(
              data.kpis
                .platformRevenue,
            )
          }
          helper="Cumul des frais de plateforme"
          icon={
            CircleDollarSign
          }
          href="/admin/analytics"
          tone="emerald"
        />
      </section>

      <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)]">
        <RevenueChart
          values={
            data.dailyRevenue
          }
        />

        <OperationalAlerts
          data={
            data
          }
        />
      </section>

      <section className="mt-5 grid min-w-0 gap-5 2xl:grid-cols-2">
        <RecentEvents
          events={
            data.recentEvents
          }
        />

        <RecentPayments
          payments={
            data.recentPayments
          }
        />
      </section>

      <section className="mt-5">
        <RecentOrders
          orders={
            data.recentOrders
          }
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <QuickActions />

        <section className="rounded-3xl border border-white/[0.075] bg-[#071116] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6">
          <DashboardSectionHeader
            title="Situation financière"
            description="Vue globale de la plateforme."
            href="/admin/analytics"
            actionLabel="Analyser"
          />

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.055] text-emerald-300">
                  <TrendingUp className="h-[18px] w-[18px]" />
                </span>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Chiffre d’affaires total
                  </p>

                  <p className="mt-1 text-lg font-black text-white">
                    {
                      formatMoney(
                        data.kpis
                          .allTimeRevenue,
                      )
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.055] text-cyan-300">
                  <WalletCards className="h-[18px] w-[18px]" />
                </span>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Retraits à traiter
                  </p>

                  <p className="mt-1 text-lg font-black text-white">
                    {
                      formatMoney(
                        data.kpis
                          .pendingPayoutAmount,
                      )
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-400/12 bg-violet-400/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/[0.055] text-violet-300">
                  <ReceiptText className="h-[18px] w-[18px]" />
                </span>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Abonnements actifs
                  </p>

                  <p className="mt-1 text-lg font-black text-white">
                    {
                      formatNumber(
                        data.kpis
                          .activeSubscriptions,
                      )
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}