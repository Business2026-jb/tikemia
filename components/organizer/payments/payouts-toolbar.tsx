"use client";

import {
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  Filter,
  HandCoins,
  LoaderCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  X,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import type { OrganizerPaymentsData } from "@/lib/organizer/get-organizer-payments";

type PayoutsToolbarProps = {
  payouts: OrganizerPaymentsData["payouts"];
  summary: OrganizerPaymentsData["summary"];
  currency: OrganizerPaymentsData["currency"];
  appliedFilters: OrganizerPaymentsData["appliedFilters"];
  payoutStatuses: OrganizerPaymentsData["filters"]["payoutStatuses"];
  generatedAt?: string;
  exportBaseUrl?: string;
  onRequestPayout?: () => void;
};

type PayoutTab =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "REJECTED";

type ExportFormat = "csv" | "xlsx" | "pdf";

type TabDefinition = {
  key: PayoutTab;
  label: string;
  icon: ComponentType<{
    className?: string;
  }>;
};

const TAB_DEFINITIONS: TabDefinition[] = [
  { key: "ALL", label: "Tous", icon: WalletCards },
  { key: "PENDING", label: "En attente", icon: Clock3 },
  { key: "PROCESSING", label: "En cours", icon: LoaderCircle },
  { key: "PAID", label: "Traités", icon: CheckCircle2 },
  { key: "REJECTED", label: "Annulés / rejetés", icon: Ban },
];

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatMoney(value: number, currency: string): string {
  const normalized = safeNumber(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF" ? 0 : 2,
    }).format(normalized);
  } catch {
    return `${formatNumber(normalized)} ${currency}`;
  }
}

function formatGeneratedAt(value: string | undefined): string {
  if (!value) {
    return "Actualisé récemment";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Actualisé récemment";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getTabCount({
  tab,
  summary,
}: {
  tab: PayoutTab;
  summary: OrganizerPaymentsData["summary"];
}): number {
  switch (tab) {
    case "PENDING":
      return safeNumber(summary.pendingPayouts);
    case "PROCESSING":
      return safeNumber(summary.processingPayouts);
    case "PAID":
      return safeNumber(summary.paidPayouts);
    case "REJECTED":
      return safeNumber(summary.rejectedPayouts);
    default:
      return safeNumber(summary.totalPayouts);
  }
}

export default function PayoutsToolbar({
  payouts,
  summary,
  currency,
  appliedFilters,
  payoutStatuses,
  generatedAt,
  exportBaseUrl = "/api/organizer/payments/export",
  onRequestPayout,
}: PayoutsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeTab = useMemo<PayoutTab>(() => {
    const status = appliedFilters.payoutStatus;

    if (
      status === "PENDING" ||
      status === "PROCESSING" ||
      status === "PAID" ||
      status === "REJECTED"
    ) {
      return status;
    }

    return "ALL";
  }, [appliedFilters.payoutStatus]);

  const hasActiveFilters = Boolean(
    appliedFilters.payoutStatus || searchValue.trim(),
  );

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      params.delete("page");

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const handleTabChange = useCallback(
    (tab: PayoutTab) => {
      updateSearchParams({
        payoutStatus: tab === "ALL" ? null : tab,
      });

      setMobileFiltersOpen(false);
    },
    [updateSearchParams],
  );

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      updateSearchParams({
        payoutSearch: searchValue.trim() || null,
      });
    },
    [searchValue, updateSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchValue("");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("payoutStatus");
    params.delete("payoutSearch");
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setMobileFiltersOpen(false);
  }, [pathname, router, searchParams]);

  const refreshPage = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();

    window.setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  }, [router]);

  const buildExportUrl = useCallback(
    (format: ExportFormat): string => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("format", format);
      params.set("scope", "payouts");
      return `${exportBaseUrl}?${params.toString()}`;
    },
    [exportBaseUrl, searchParams],
  );

  const requestPayout = useCallback(() => {
    setExportOpen(false);

    if (onRequestPayout) {
      onRequestPayout();
      return;
    }

    router.push("/organizer/payments?payout=request");
  }, [onRequestPayout, router]);

  const currentResultCount = payouts.length;

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.055),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1 text-[10px] font-bold text-emerald-300">
              <HandCoins className="h-3.5 w-3.5" />
              Gestion des retraits
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-semibold text-neutral-500">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
              Opérations sécurisées
            </span>
          </div>

          <h2 className="mt-3 text-lg font-black text-white sm:text-xl">
            Historique des retraits
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Consultez les demandes en attente, en cours, traitées ou rejetées.
          </p>

          <p className="mt-2 text-[10px] text-neutral-600">
            {formatGeneratedAt(generatedAt)} • {formatNumber(currentResultCount)} résultat
            {currentResultCount > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <button
            type="button"
            onClick={refreshPage}
            disabled={isRefreshing}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-bold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isRefreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Actualiser
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((current) => !current)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-4 text-sm font-bold text-sky-300 transition hover:bg-sky-500/[0.12] sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Exporter
              <ChevronDown className="h-4 w-4" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-52 overflow-hidden rounded-xl border border-white/[0.09] bg-[#081015] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                {(
                  [
                    ["csv", "Exporter les retraits en CSV"],
                    ["xlsx", "Exporter les retraits en Excel"],
                    ["pdf", "Exporter les retraits en PDF"],
                  ] as const
                ).map(([format, label]) => (
                  <a
                    key={format}
                    href={buildExportUrl(format)}
                    onClick={() => setExportOpen(false)}
                    className="flex h-10 items-center rounded-lg px-3 text-xs font-semibold text-neutral-300 transition hover:bg-white/[0.055] hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={requestPayout}
            disabled={summary.availableBalance <= 0}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.1] px-5 text-sm font-black text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/[0.16] disabled:cursor-not-allowed disabled:border-white/[0.07] disabled:bg-white/[0.02] disabled:text-neutral-600 sm:w-auto"
          >
            <CircleDollarSign className="h-4 w-4" />
            Demander un retrait
          </button>
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        <SummaryCard label="Solde disponible" value={formatMoney(summary.availableBalance, currency)} tone="green" />
        <SummaryCard label="En traitement" value={formatMoney(summary.reservedBalance, currency)} tone="orange" />
        <SummaryCard label="Déjà versé" value={formatMoney(summary.totalPaidOut, currency)} tone="blue" />
        <SummaryCard label="Annulé / rejeté" value={formatMoney(summary.rejectedPayoutAmount, currency)} tone="red" />
      </div>

      <div className="relative hidden w-full min-w-0 gap-2 border-b border-white/[0.07] px-4 py-4 sm:flex sm:flex-wrap sm:px-5 xl:px-6">
        {TAB_DEFINITIONS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition ${
                active
                  ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab.key === "PROCESSING" ? "animate-spin" : ""}`} />
              {tab.label}
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white/[0.08] bg-[#050c10] px-1.5 text-[9px] font-black text-neutral-400">
                {formatNumber(getTabCount({ tab: tab.key, summary }))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative px-4 py-4 sm:px-5 xl:px-6">
        <form onSubmit={handleSearchSubmit} className="flex w-full min-w-0 flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              type="search"
              placeholder="Rechercher une référence, une note ou un montant…"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#050c10] pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-500/35"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/[0.12]"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((current) => !current)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-bold text-neutral-300 sm:hidden"
          >
            <Filter className="h-4 w-4" />
            Statuts
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.055] px-4 text-sm font-bold text-red-300 transition hover:bg-red-500/[0.1]"
            >
              <X className="h-4 w-4" />
              Réinitialiser
            </button>
          )}
        </form>
      </div>

      {mobileFiltersOpen && (
        <div className="relative grid w-full min-w-0 gap-2 border-t border-white/[0.07] px-4 py-4 sm:hidden">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-neutral-400">
            <SlidersHorizontal className="h-4 w-4 text-orange-300" />
            Filtrer les retraits
          </div>

          {TAB_DEFINITIONS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`flex h-11 w-full items-center justify-between rounded-xl border px-3.5 text-xs font-bold transition ${
                  active
                    ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
                    : "border-white/[0.08] bg-white/[0.02] text-neutral-500"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${tab.key === "PROCESSING" ? "animate-spin" : ""}`} />
                  {tab.label}
                </span>

                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/[0.08] bg-[#050c10] px-2 text-[10px] font-black text-neutral-400">
                  {formatNumber(getTabCount({ tab: tab.key, summary }))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {payoutStatuses.length === 0 && (
        <div className="relative border-t border-white/[0.07] px-4 py-3 text-[10px] text-neutral-600 sm:px-5 xl:px-6">
          Aucun statut de retrait n’est disponible.
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "orange" | "blue" | "red";
}) {
  const styles = {
    green: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
    orange: "border-orange-500/20 bg-orange-500/[0.05] text-orange-300",
    blue: "border-sky-500/20 bg-sky-500/[0.05] text-sky-300",
    red: "border-red-500/20 bg-red-500/[0.05] text-red-300",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}