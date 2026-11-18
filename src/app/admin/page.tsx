
"use client";
import { formatMinorMoney } from "@/i18n/config";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Clock3,
  CreditCard,
  HeartHandshake,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/*
  TIKEMIA — DASHBOARD ADMINISTRATEUR

  - Français uniquement
  - PC + mobile
  - Menu fourni par AdminNavigation
  - Statistiques PostgreSQL via API
  - Actualisation automatique
  - Commissions par devise
  - Graphiques réels
  - Transactions réelles
  - Aucun chiffre inventé
*/

const API_URL = "/api/admin/dashboard";

const REFRESH_INTERVAL = 15_000;
const REQUEST_TIMEOUT = 12_000;

type Period = "7d" | "30d" | "90d" | "12m";

type StatKey =
  | "organizers"
  | "clients"
  | "events"
  | "campaigns"
  | "orders"
  | "payments"
  | "withdrawals"
  | "tickets";

type Amount = {
  currency: string;
  amountMinor: string;
};

type TrendPoint = {
  date: string;
  salesMinor: string;
  donationsMinor: string;
  currency: string;
};

type Transaction = {
  id: string;
  reference: string;
  type: "ticket" | "donation" | "withdrawal" | "other";
  status: string;
  amountMinor: string;
  currency: string;
  createdAt: string;
  customer: string | null;
};

type DashboardData = {
  statistics: Partial<Record<StatKey, number | null>>;
  revenue: {
    sales: Amount[];
    donations: Amount[];
    commissions: Amount[];
    refunds: Amount[];
    serviceFees: Amount[];
  };
  chart: TrendPoint[];
  transactions: Transaction[];
  generatedAt: string;
};

type ApiResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: unknown;
};

type CardDefinition = {
  key: StatKey;
  title: string;
  icon: LucideIcon;
  href: string;
  accent: string;
  iconBackground: string;
};

const STAT_CARDS: CardDefinition[] = [
  {
    key: "organizers",
    title: "Organisateurs",
    icon: UsersRound,
    href: "/admin/organizers",
    accent: "text-[#087e34]",
    iconBackground: "bg-[#e4f6e9]",
  },
  {
    key: "clients",
    title: "Clients",
    icon: Users,
    href: "/admin/clients",
    accent: "text-[#1b63ba]",
    iconBackground: "bg-[#eaf2ff]",
  },
  {
    key: "events",
    title: "Événements",
    icon: CalendarDays,
    href: "/admin/events",
    accent: "text-[#a96912]",
    iconBackground: "bg-[#fff3df]",
  },
  {
    key: "campaigns",
    title: "Cagnottes",
    icon: HeartHandshake,
    href: "/admin/campaigns",
    accent: "text-[#c34768]",
    iconBackground: "bg-[#fff0f4]",
  },
  {
    key: "orders",
    title: "Commandes",
    icon: ShoppingBag,
    href: "/admin/tickets",
    accent: "text-[#8154be]",
    iconBackground: "bg-[#f4edff]",
  },
  {
    key: "payments",
    title: "Paiements",
    icon: CreditCard,
    href: "/admin/transactions",
    accent: "text-[#087e87]",
    iconBackground: "bg-[#e4f8f8]",
  },
  {
    key: "tickets",
    title: "Billets émis",
    icon: Ticket,
    href: "/admin/tickets",
    accent: "text-[#287a55]",
    iconBackground: "bg-[#e7f7ed]",
  },
  {
    key: "withdrawals",
    title: "Retraits",
    icon: Landmark,
    href: "/admin/withdrawals",
    accent: "text-[#8b6032]",
    iconBackground: "bg-[#f9efe4]",
  },
];

const PERIODS: {
  value: Period;
  label: string;
}[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "12m", label: "12 mois" },
];

/* ======================================================
   FORMATAGE
====================================================== */

function validCurrency(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z]{3}$/.test(value)
  );
}

function validIntegerString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^-?\d+$/.test(value)
  );
}

function integerAmount(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function money(amountMinor: string, currency: string) { return formatMinorMoney(amountMinor, currency, "fr"); }

function compactNumber(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/* ======================================================
   VALIDATION DES RÉPONSES API

   Une valeur manquante n'est jamais
   remplacée par une statistique inventée.
====================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function parseAmounts(value: unknown): Amount[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item) =>
        isRecord(item) &&
        validCurrency(item.currency) &&
        validIntegerString(item.amountMinor)
    )
    .map((item) => ({
      currency: item.currency as string,
      amountMinor: item.amountMinor as string,
    }));
}

function parseChart(value: unknown): TrendPoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item) =>
        isRecord(item) &&
        typeof item.date === "string" &&
        validCurrency(item.currency) &&
        validIntegerString(item.salesMinor) &&
        validIntegerString(item.donationsMinor)
    )
    .map((item) => ({
      date: item.date as string,
      currency: item.currency as string,
      salesMinor: item.salesMinor as string,
      donationsMinor: item.donationsMinor as string,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.reference === "string" &&
        typeof item.status === "string" &&
        typeof item.createdAt === "string" &&
        validCurrency(item.currency) &&
        validIntegerString(item.amountMinor)
    )
    .map((item) => {
      const type =
        item.type === "ticket" ||
        item.type === "donation" ||
        item.type === "withdrawal"
          ? item.type
          : "other";

      return {
        id: item.id as string,
        reference: item.reference as string,
        type,
        status: item.status as string,
        createdAt: item.createdAt as string,
        currency: item.currency as string,
        amountMinor: item.amountMinor as string,
        customer:
          typeof item.customer === "string"
            ? item.customer
            : null,
      };
    });
}

function parseDashboard(value: unknown): DashboardData | null {
  if (!isRecord(value)) return null;

  const rawStatistics = isRecord(value.statistics)
    ? value.statistics
    : {};

  const statistics: DashboardData["statistics"] = {};

  for (const card of STAT_CARDS) {
    const raw = rawStatistics[card.key];

    statistics[card.key] =
      typeof raw === "number" &&
      Number.isSafeInteger(raw) &&
      raw >= 0
        ? raw
        : null;
  }

  const revenue = isRecord(value.revenue)
    ? value.revenue
    : {};

  return {
    statistics,
    revenue: {
      sales: parseAmounts(revenue.sales),
      donations: parseAmounts(revenue.donations),
      commissions: parseAmounts(revenue.commissions),
      refunds: parseAmounts(revenue.refunds),
      serviceFees: parseAmounts(revenue.serviceFees),
    },
    chart: parseChart(value.chart),
    transactions: parseTransactions(value.transactions),
    generatedAt:
      typeof value.generatedAt === "string"
        ? value.generatedAt
        : "",
  };
}

/* ======================================================
   COMPOSANTS DE PRÉSENTATION
====================================================== */

function SectionTitle({
  title,
  icon: Icon,
  href,
  action,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon
          size={21}
          className="shrink-0 text-[#087c35]"
        />

        <h2 className="min-w-0 text-[16px] font-black text-[#142237] sm:text-[19px]">
          {title}
        </h2>
      </div>

      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-extrabold text-[#087c35] hover:underline"
        >
          {action ?? "Voir tout"}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

function StatCard({
  definition,
  value,
}: {
  definition: CardDefinition;
  value: number | null | undefined;
}) {
  const Icon = definition.icon;

  return (
    <Link
      href={definition.href}
      className="group min-w-0 rounded-[17px] border border-[#e4ebe7] bg-white p-3.5 shadow-[0_3px_14px_rgba(15,40,29,0.035)] transition-colors hover:border-[#9ccba9] sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex size-10.5 shrink-0 items-center justify-center rounded-[13px] ${definition.iconBackground} ${definition.accent}`}
        >
          <Icon size={22} strokeWidth={2.1} />
        </div>

        <ArrowUpRight
          size={17}
          className="text-[#a3b3ab] transition-colors group-hover:text-[#087c35]"
        />
      </div>

      <p className="mt-3 text-[12px] font-semibold text-[#607083] sm:text-[13px]">
        {definition.title}
      </p>

      <p className="mt-1 text-[25px] font-black tracking-tight text-[#132238] sm:text-[29px]">
        {compactNumber(value)}
      </p>
    </Link>
  );
}

function RevenueCard({
  title,
  values,
  icon: Icon,
  subtitle,
}: {
  title: string;
  values: Amount[];
  icon: LucideIcon;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0 rounded-[18px] border border-[#e3ebe6] bg-white p-4 shadow-[0_3px_14px_rgba(15,40,29,0.035)] sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#eaf7ed] text-[#087a33]">
          <Icon size={21} />
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-extrabold text-[#17283b]">
            {title}
          </p>

          {subtitle && (
            <p className="mt-0.5 text-[11px] text-[#728092]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {values.length > 0 ? (
          values.map((item) => (
            <div
              key={item.currency}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#edf1ee] pb-2 last:border-0 last:pb-0"
            >
              <span className="text-xs font-semibold text-[#657587]">
                {item.currency}
              </span>

              <strong className="wrap-break-word text-right text-[16px] font-black text-[#087c35] sm:text-[19px]">
                {money(
                  item.amountMinor,
                  item.currency
                )}
              </strong>
            </div>
          ))
        ) : (
          <p className="py-1 text-[21px] font-black text-[#a0acb3]">
            —
          </p>
        )}
      </div>
    </div>
  );
}

/* ======================================================
   GRAPHIQUE SANS BIBLIOTHÈQUE SUPPLÉMENTAIRE

   Les barres sont construites
   uniquement à partir des données API.

   Aucune conversion entre devises.
====================================================== */

function RevenueChart({
  points,
}: {
  points: TrendPoint[];
}) {
  const currencies = useMemo(
    () => Array.from(new Set(points.map((item) => item.currency))),
    [points]
  );

  const [requestedCurrency, setCurrency] = useState("");
  const currency = currencies.includes(requestedCurrency) ? requestedCurrency : currencies[0] ?? "";

  const selected = useMemo(
    () =>
      points
        .filter((item) => item.currency === currency)
,
    [points, currency]
  );

  const maxAmount = useMemo(() => {
    const values = selected.flatMap((item) => [
      integerAmount(item.salesMinor),
      integerAmount(item.donationsMinor),
    ]);

    return values.reduce(
      (highest, current) =>
        current > highest ? current : highest,
      0n
    );
  }, [selected]);

  function height(value: string) {
    const amount = integerAmount(value);

    if (amount <= 0n || maxAmount <= 0n) {
      return 0;
    }

    return Number((amount * 100n) / maxAmount);
  }

  return (
    <section className="min-w-0 rounded-[21px] border border-[#e3ebe6] bg-white p-4 shadow-[0_3px_15px_rgba(15,40,29,0.035)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          title="Ventes et dons"
          icon={BarChart3}
        />

        {currencies.length > 0 && (
          <div className="relative">
            <select
              aria-label="Devise du graphique"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value)
              }
              className="h-9 appearance-none rounded-xl border border-[#dce5df] bg-white px-3 pr-9 text-xs font-extrabold text-[#27384b] outline-none focus:border-[#087c35]"
            >
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#516276]"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-semibold text-[#627386]">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-[#0c953c]" />
          Ventes
        </span>

        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-[#a419ff]" />
          Dons
        </span>
      </div>

      {selected.length === 0 ? (
        <div className="flex h-57.5 items-center justify-center text-sm text-[#798997]">
          Aucune donnée disponible
        </div>
      ) : (
        <div className="mt-3 min-w-0">
          <svg viewBox="0 0 640 240" className="h-60 w-full" role="img" aria-label={`Ventes et dons en ${currency}`}>
            <defs>
              <linearGradient id="admin-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12a337" stopOpacity="0.35"/><stop offset="100%" stopColor="#12a337" stopOpacity="0.03"/></linearGradient>
              <linearGradient id="admin-donations-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a419ff" stopOpacity="0.3"/><stop offset="100%" stopColor="#a419ff" stopOpacity="0.03"/></linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map(tick => <g key={tick}><line x1="12" x2="628" y1={214-tick*1.9} y2={214-tick*1.9} stroke="#e6ece8"/><text x="14" y={210-tick*1.9} fontSize="9" fill="#718176">{money((maxAmount*BigInt(tick)/100n).toString(),currency)}</text></g>)}
            {(["salesMinor", "donationsMinor"] as const).map((field, series) => {
              const coordinates = selected.map((point,index) => [12 + index * 616 / Math.max(selected.length - 1, 1),214-height(point[field])*1.9]);
              const line = coordinates.map(([x,y],index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
              return <g key={field}><path d={line+" L"+coordinates.at(-1)![0]+",214 L12,214 Z"} fill={`url(#admin-${series ? "donations" : "sales"}-fill)`}/><path d={line} fill="none" stroke={series ? "#a419ff" : "#0b982b"} strokeWidth="3" strokeLinejoin="round"/>{coordinates.map(([x,y],index)=><circle key={index} cx={x} cy={y} r="3" fill={series ? "#a419ff" : "#0b982b"}><title>{selected[index].date+": "+money(selected[index][field],currency)}</title></circle>)}</g>;
            })}
            {selected.filter((_,index)=>index===0 || index===selected.length-1 || index % Math.max(1,Math.ceil(selected.length/6))===0).map(point=><text key={point.date} x={12+selected.indexOf(point)*616/Math.max(selected.length-1,1)} y="234" textAnchor={selected.indexOf(point)===0 ? "start" : selected.indexOf(point)===selected.length-1 ? "end" : "middle"} fontSize="10" fill="#627386">{point.date.slice(5)}</text>)}
          </svg>
        </div>
      )}
    </section>
  );
}

/* ======================================================
   TRANSACTIONS
====================================================== */


function RevenueDistribution({ sales, donations }: { sales: Amount[]; donations: Amount[] }) {
 const currencies = Array.from(new Set([...sales, ...donations].map(item=>item.currency)));
 const [requested, setRequested] = useState("");
 const currency = currencies.includes(requested) ? requested : currencies[0] ?? "XOF";
 const tickets = integerAmount(sales.find(item=>item.currency===currency)?.amountMinor ?? "0");
 const gifts = integerAmount(donations.find(item=>item.currency===currency)?.amountMinor ?? "0");
 const total = tickets + gifts;
 const ratio = total > 0n ? Number(tickets * 10000n / total) / 100 : 0;
 return <section className="min-w-0 rounded-[21px] border border-[#e3ebe6] bg-white p-4 shadow-sm sm:p-5">
 <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-extrabold text-[#102036]">Répartition des revenus</h2>{currencies.length>1 && <select aria-label="Devise de la répartition" value={currency} onChange={event=>setRequested(event.target.value)} className="rounded-lg border border-[#dce5df] p-2 text-xs">{currencies.map(code=><option key={code}>{code}</option>)}</select>}</div>
 <div className="mx-auto my-4 flex size-44 items-center justify-center rounded-full" role="img" aria-label={total>0n ? `Billetterie ${ratio} %, dons ${100-ratio} %` : "Aucun revenu"} style={{background:total>0n ? `conic-gradient(#0b982b 0% ${ratio}%, #a419ff ${ratio}% 100%)` : "#e6ece8"}}><div className="flex size-32 items-center justify-center rounded-full bg-white px-2 text-center text-sm font-extrabold">{money(total.toString(),currency)}</div></div>
 <div className="space-y-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="size-3 rounded bg-[#0b982b]"/>Billetterie</span><strong>{money(tickets.toString(),currency)}</strong></div><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="size-3 rounded bg-[#a419ff]"/>Cagnottes / Dons</span><strong>{money(gifts.toString(),currency)}</strong></div></div>
 </section>;
}

function transactionLabel(type: Transaction["type"]) {
  switch (type) {
    case "ticket":
      return "Billetterie";
    case "donation":
      return "Don";
    case "withdrawal":
      return "Retrait";
    default:
      return "Paiement";
  }
}

function statusLabel(value: string) {
  const normalized = value.toUpperCase();

  const labels: Record<string, string> = {
    PAID: "Payé",
    SUCCEEDED: "Confirmé",
    CONFIRMED: "Confirmé",
    PENDING: "En attente",
    INITIATED: "Initié",
    PROCESSING: "En cours",
    FAILED: "Échoué",
    CANCELLED: "Annulé",
    REFUNDED: "Remboursé",
    PARTIALLY_REFUNDED: "Partiellement remboursé",
  };

  return labels[normalized] ?? value;
}

function statusClass(value: string) {
  const normalized = value.toUpperCase();

  if (
    ["PAID", "SUCCEEDED", "CONFIRMED"].includes(
      normalized
    )
  ) {
    return "bg-[#e2f7e7] text-[#0b7936]";
  }

  if (
    ["FAILED", "CANCELLED", "REFUNDED"].includes(
      normalized
    )
  ) {
    return "bg-[#fff0ef] text-[#c14848]";
  }

  return "bg-[#fff5dd] text-[#996914]";
}

function RecentTransactions({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const visible = transactions.slice(0, 8);

  return (
    <section className="min-w-0 overflow-hidden rounded-[21px] border border-[#e3ebe6] bg-white shadow-[0_3px_15px_rgba(15,40,29,0.035)]">
      <div className="border-b border-[#edf1ee] px-4 py-4 sm:px-5">
        <SectionTitle
          title="Dernières transactions"
          icon={Activity}
          href="/admin/transactions"
        />
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-[#798997]">
          Aucune transaction disponible
        </div>
      ) : (
        <>
          {/* PC : tableau */}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-160 text-left">
              <thead className="bg-[#f8faf9]">
                <tr className="text-[11px] font-bold uppercase tracking-wide text-[#778696]">
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">
                    Montant
                  </th>
                </tr>
              </thead>

              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#eff2ef] text-[12px]"
                  >
                    <td className="px-5 py-3 font-extrabold text-[#21344a]">
                      {item.reference}
                    </td>

                    <td className="px-4 py-3 text-[#526277]">
                      {transactionLabel(item.type)}
                    </td>

                    <td className="px-4 py-3 text-[#526277]">
                      {formatDate(item.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-right font-extrabold text-[#14283a]">
                      {money(
                        item.amountMinor,
                        item.currency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : cartes */}

          <div className="divide-y divide-[#edf1ed] md:hidden">
            {visible.map((item) => {
              const Icon =
                item.type === "donation"
                  ? HeartHandshake
                  : item.type === "withdrawal"
                    ? ArrowUpRight
                    : ArrowDownLeft;

              return (
                <div
                  key={item.id}
                  className="flex min-w-0 items-start gap-3 px-4 py-3.5"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf7ee] text-[#0a8537]">
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-[#1a2a3d]">
                      {item.reference}
                    </p>

                    <p className="mt-1 text-[11px] text-[#708092]">
                      {transactionLabel(item.type)}
                      {" • "}
                      {formatDate(item.createdAt)}
                    </p>

                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold ${statusClass(
                        item.status
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <p className="shrink-0 text-right text-[12px] font-black text-[#0e7935]">
                    {money(
                      item.amountMinor,
                      item.currency
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/* ======================================================
   DASHBOARD
====================================================== */

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>("30d");

  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(
    null
  );

  const activeController =
    useRef<AbortController | null>(null);

  const loadingRef = useRef(false);

  /* ====================================================
     ACTUALISATION DES DONNÉES

     Le serveur doit filtrer les données
     selon la période demandée.

     Toutes les réponses doivent être
     authentifiées côté serveur.
  ==================================================== */

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      const controller = new AbortController();
      activeController.current = controller;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const timeout = window.setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT);

      try {
        const params = new URLSearchParams({
          period,
        });

        const response = await fetch(
          `${API_URL}?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          window.location.replace("/admin/login");
          return;
        }

        const payload =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          payload.success !== true
        ) {
          throw new Error(
            payload.message ||
              "Impossible de charger les données."
          );
        }

        const parsed = parseDashboard(payload.data);

        if (!parsed) {
          throw new Error(
            "Réponse du serveur invalide."
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        setData(parsed);
        setLastUpdate(
          parsed.generatedAt ||
            new Date().toISOString()
        );
        setError(null);
      } catch {
        if (!controller.signal.aborted) {
          setError(
            "Impossible d'actualiser les statistiques."
          );
        }
      } finally {
        window.clearTimeout(timeout);
        loadingRef.current = false;

        setLoading(false);
        setRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(false), 0);

    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible"
      ) {
        void loadDashboard(true);
      }
    }, REFRESH_INTERVAL);

    const onFocus = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void loadDashboard(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener(
      "visibilitychange",
      onFocus
    );

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener(
        "visibilitychange",
        onFocus
      );

      activeController.current?.abort();
    };
  }, [loadDashboard]);

  /* ====================================================
     RENDU
  ==================================================== */

  return (
    <div
      id="tikemia-admin-dashboard"
      lang="fr"
      className="w-full min-w-0 space-y-3 pb-1 text-[#162539] sm:space-y-4"
    >
      {/* TITRE ET ACTIONS */}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck
              size={25}
              className="shrink-0 text-[#087e35]"
            />

            <h1 className="text-[23px] font-black tracking-tight text-[#142238] sm:text-[30px]">
              Tableau de bord
            </h1>
          </div>

          <p className="mt-1 pl-[35px] text-[12px] text-[#718092]">
            Administration générale TIKEMIA
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              aria-label="Période des statistiques"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as Period)
              }
              className="h-10 appearance-none rounded-xl border border-[#dce6df] bg-white px-3 pr-9 text-[12px] font-extrabold text-[#21364a] outline-none focus:border-[#087e35]"
            >
              {PERIODS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#627183]"
            />
          </div>

          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => void loadDashboard(true)}
            aria-label="Actualiser les statistiques"
            className="flex size-10 items-center justify-center rounded-xl border border-[#dce6df] bg-white text-[#087e35] disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={
                refreshing ? "animate-spin" : ""
              }
            />
          </button>
        </div>
      </div>

      {/* DATE DE SYNCHRONISATION */}

      {lastUpdate && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#778798]">
          <Clock3 size={13} />
          Actualisé à {formatTime(lastUpdate)}
          {refreshing && (
            <LoaderCircle
              size={13}
              className="ml-1 animate-spin"
            />
          )}
        </p>
      )}

      {/* ERREUR */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#f1d2ca] bg-[#fff4f1] px-4 py-3 text-[12px] font-semibold text-[#af4939]"
        >
          <CircleAlert
            size={17}
            className="shrink-0"
          />
          {error}
        </div>
      )}

      {/* CHARGEMENT INITIAL */}

      {loading && !data ? (
        <div className="flex min-h-87.5 items-center justify-center">
          <LoaderCircle
            size={32}
            className="animate-spin text-[#087c35]"
          />
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-[#e3e9e5] bg-white px-5 py-12 text-center">
          <p className="text-sm font-semibold text-[#627383]">
            Données indisponibles
          </p>

          <button
            type="button"
            onClick={() => void loadDashboard(false)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#087c35] px-5 py-2.5 text-xs font-extrabold text-white"
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {/* STATISTIQUES GÉNÉRALES */}

          <section className="space-y-3">
            <SectionTitle
              title="Vue d'ensemble"
              icon={Activity}
            />

            <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-4 xl:gap-4">
              {STAT_CARDS.map((card) => (
                <StatCard
                  key={card.key}
                  definition={card}
                  value={data.statistics[card.key]}
                />
              ))}
            </div>
          </section>

          {/* REVENUS ET COMMISSIONS */}

          <section className="space-y-3">
            <SectionTitle
              title="Finances et commissions"
              icon={Wallet}
            />

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RevenueCard
                title="Ventes de billets"
                values={data.revenue.sales}
                icon={Ticket}
              />

              <RevenueCard
                title="Dons confirmés"
                values={data.revenue.donations}
                icon={HeartHandshake}
              />

              <RevenueCard
                title="Commissions TIKEMIA"
                values={data.revenue.commissions}
                icon={TrendingUp}
                subtitle="Commission organisateur (5 %)"
              />

              <RevenueCard
                title="Frais de services"
                values={data.revenue.serviceFees}
                icon={ArrowDownLeft}
              />
            </div>
          </section>

          {/* GRAPHIQUE ET ACTIONS */}

          <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)] xl:col-span-2"><RevenueChart points={data.chart} /><RevenueDistribution sales={data.revenue.sales} donations={data.revenue.donations}/></div>
            <RecentTransactions transactions={data.transactions} />

            <section className="min-w-0 rounded-[21px] border border-[#e3ebe6] bg-white p-4 shadow-[0_3px_15px_rgba(15,40,29,0.035)] sm:p-5">
              <SectionTitle
                title="Accès rapide"
                icon={ShieldCheck}
              />

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {[
                  {
                    label: "Gérer les organisateurs",
                    href: "/admin/organizers",
                    icon: UsersRound,
                  },
                  {
                    label: "Contrôler les événements",
                    href: "/admin/events",
                    icon: CalendarDays,
                  },
                  {
                    label: "Voir les transactions",
                    href: "/admin/transactions",
                    icon: CreditCard,
                  },
                  
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e5ece7] bg-[#fbfcfb] px-3 text-[12px] font-extrabold text-[#27384b] transition-colors hover:border-[#9acdaa] hover:bg-[#f1faf3]"
                    >
                      <Icon
                        size={19}
                        className="shrink-0 text-[#087c35]"
                      />

                      <span className="min-w-0 flex-1">
                        {item.label}
                      </span>

                      <ArrowRight
                        size={16}
                        className="shrink-0 text-[#84948b]"
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          {/* DERNIÈRES TRANSACTIONS */}
        </>
      )}
    </div>
  );
}
