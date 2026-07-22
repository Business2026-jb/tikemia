"use client";

import type {
  MarketingCampaignStatus,
  PromoCodeStatus,
} from "@prisma/client";
import {
  BadgePercent,
  BarChart3,
  Download,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Target,
  TicketPercent,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CampaignFormDialog, {
  type CampaignFormSubmitPayload,
} from "@/components/organizer/marketing/campaign-form-dialog";
import CampaignsListClient from "@/components/organizer/marketing/campaigns-list-client";
import MarketingEmptyState from "@/components/organizer/marketing/marketing-empty-state";
import PromoCodeDialog, {
  type PromoCodeSubmitPayload,
} from "@/components/organizer/marketing/promo-code-dialog";
import PromoCodesListClient from "@/components/organizer/marketing/promo-codes-list-client";
import type {
  OrganizerMarketingCampaignItem,
  OrganizerMarketingEventOption,
  OrganizerMarketingPromoCodeItem,
} from "@/lib/organizer/get-organizer-marketing";

type MarketingTab =
  | "overview"
  | "campaigns"
  | "promo-codes";

type UnknownRecord = Record<string, unknown>;

type MarketingPageState = {
  campaigns: OrganizerMarketingCampaignItem[];
  promoCodes: OrganizerMarketingPromoCodeItem[];
  events: OrganizerMarketingEventOption[];
};

const EMPTY_STATE: MarketingPageState = {
  campaigns: [],
  promoCodes: [],
  events: [],
};

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function readNullableString(
  value: unknown,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function readNumber(
  value: unknown,
  fallback = 0,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readBoolean(
  value: unknown,
  fallback = false,
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function readArray(
  value: unknown,
): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

function getApiErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  const error = payload.error;

  if (
    isRecord(error) &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

function normalizeCampaign(
  value: unknown,
): OrganizerMarketingCampaignItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const event =
    isRecord(value.event)
      ? value.event
      : {};

  const counts =
    isRecord(value._count)
      ? value._count
      : {};

  const visits =
    readNumber(
      value.visits,
      readNumber(counts.visits),
    );

  const orders =
    readNumber(
      value.orders,
      readNumber(counts.attributions),
    );

  const campaign = {
    id:
      readString(value.id),

    organizerId:
      readString(value.organizerId),

    eventId:
      readString(
        value.eventId,
        readString(event.id),
      ),

    eventTitle:
      readString(
        value.eventTitle,
        readString(event.title, "Événement"),
      ),

    name:
      readString(value.name, "Campagne"),

    description:
      readNullableString(value.description),

    channel:
      readString(value.channel, "OTHER"),

    status:
      readString(value.status, "DRAFT"),

    source:
      readNullableString(value.source),

    medium:
      readNullableString(value.medium),

    content:
      readNullableString(value.content),

    trackingCode:
      readString(value.trackingCode),

    trackingUrl:
      readString(value.trackingUrl, "#"),

    budget:
      value.budget === null
        ? null
        : readNumber(value.budget),

    currency:
      readString(
        value.currency,
        readString(event.currency, "XOF"),
      ),

    goalType:
      readNullableString(value.goalType),

    goalValue:
      value.goalValue === null
        ? null
        : readNumber(value.goalValue),

    startsAt:
      readNullableString(value.startsAt),

    endsAt:
      readNullableString(value.endsAt),

    isActive:
      readBoolean(value.isActive, true),

    visits,

    orders,

    tickets:
      readNumber(value.tickets),

    revenue:
      readNumber(value.revenue),

    conversionRate:
      readNumber(
        value.conversionRate,
        visits > 0
          ? (orders / visits) * 100
          : 0,
      ),

    createdAt:
      readString(
        value.createdAt,
        new Date().toISOString(),
      ),

    updatedAt:
      readString(
        value.updatedAt,
        new Date().toISOString(),
      ),
  };

  if (!campaign.id) {
    return null;
  }

  return campaign as unknown as OrganizerMarketingCampaignItem;
}

function normalizePromoCode(
  value: unknown,
): OrganizerMarketingPromoCodeItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const event =
    isRecord(value.event)
      ? value.event
      : {};

  const campaign =
    isRecord(value.campaign)
      ? value.campaign
      : null;

  const promoCode = {
    id:
      readString(value.id),

    organizerId:
      readString(value.organizerId),

    eventId:
      readString(
        value.eventId,
        readString(event.id),
      ),

    eventTitle:
      readString(
        value.eventTitle,
        readString(event.title, "Événement"),
      ),

    campaignId:
      readNullableString(value.campaignId),

    campaignName:
      readNullableString(value.campaignName) ??
      (
        campaign
          ? readNullableString(campaign.name)
          : null
      ),

    code:
      readString(value.code),

    description:
      readNullableString(value.description),

    discountType:
      readString(
        value.discountType,
        "PERCENTAGE",
      ),

    discountValue:
      readNumber(value.discountValue),

    minimumOrderAmount:
      value.minimumOrderAmount === null
        ? null
        : readNumber(value.minimumOrderAmount),

    maximumDiscount:
      value.maximumDiscount === null
        ? null
        : readNumber(value.maximumDiscount),

    maximumUses:
      value.maximumUses === null
        ? null
        : readNumber(value.maximumUses),

    usesPerCustomer:
      value.usesPerCustomer === null
        ? null
        : readNumber(value.usesPerCustomer),

    usages:
      readNumber(
        value.usages,
        readNumber(value.currentUses),
      ),

    discountsGranted:
      readNumber(value.discountsGranted),

    attributedOrders:
      readNumber(value.attributedOrders),

    attributedRevenue:
      readNumber(value.attributedRevenue),

    startsAt:
      readNullableString(value.startsAt),

    expiresAt:
      readNullableString(value.expiresAt),

    status:
      readString(value.status, "DRAFT"),

    isActive:
      readBoolean(value.isActive, true),

    createdAt:
      readString(
        value.createdAt,
        new Date().toISOString(),
      ),

    updatedAt:
      readString(
        value.updatedAt,
        new Date().toISOString(),
      ),
  };

  if (
    !promoCode.id ||
    !promoCode.code
  ) {
    return null;
  }

  return promoCode as unknown as OrganizerMarketingPromoCodeItem;
}

function normalizeEvent(
  value: unknown,
): OrganizerMarketingEventOption | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const title = readString(value.title);

  if (
    !id ||
    !title
  ) {
    return null;
  }

  return {
    id,
    title,
    slug: readString(value.slug),
    status: readString(
      value.status,
      "DRAFT",
    ) as OrganizerMarketingEventOption["status"],
    startsAt: readString(
      value.startsAt,
    ),
    endsAt: readString(
      value.endsAt,
    ),
    currency: readString(
      value.currency,
      "XOF",
    ),
  };
}

function extractDataArray(
  payload: unknown,
  key: string,
): unknown[] {
  if (!isRecord(payload)) {
    return [];
  }

  const data =
    isRecord(payload.data)
      ? payload.data
      : payload;

  return readArray(data[key]);
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(value);
  } catch {
    return `${formatNumber(value)} ${currency}`;
  }
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof TrendingUp;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#081014] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.16)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
            {label}
          </p>

          <p className="mt-2 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        {description}
      </p>
    </article>
  );
}

export default function OrganizerMarketingPage() {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<MarketingTab>(
      "overview",
    );

  const [
    data,
    setData,
  ] =
    useState<MarketingPageState>(
      EMPTY_STATE,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    pageError,
    setPageError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    campaignDialogOpen,
    setCampaignDialogOpen,
  ] =
    useState(false);

  const [
    promoCodeDialogOpen,
    setPromoCodeDialogOpen,
  ] =
    useState(false);

  const [
    editingCampaign,
    setEditingCampaign,
  ] =
    useState<OrganizerMarketingCampaignItem | null>(
      null,
    );

  const [
    editingPromoCode,
    setEditingPromoCode,
  ] =
    useState<OrganizerMarketingPromoCodeItem | null>(
      null,
    );

  const [
    submittingCampaign,
    setSubmittingCampaign,
  ] =
    useState(false);

  const [
    submittingPromoCode,
    setSubmittingPromoCode,
  ] =
    useState(false);

  const [
    dialogError,
    setDialogError,
  ] =
    useState<string | null>(
      null,
    );

  const loadMarketingData =
    useCallback(
      async (
        silent = false,
      ) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setPageError(null);

        try {
          const [
            campaignsResponse,
            promoCodesResponse,
            eventsResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/organizer/marketing/campaigns?page=1&pageSize=100&includeArchived=true",
                {
                  cache: "no-store",
                },
              ),

              fetch(
                "/api/organizer/marketing/promo-codes?page=1&pageSize=100&includeArchived=true&includeExpired=true",
                {
                  cache: "no-store",
                },
              ),

              fetch(
                "/api/organizer/events?page=1&pageSize=100",
                {
                  cache: "no-store",
                },
              ),
            ]);

          const [
            campaignsPayload,
            promoCodesPayload,
            eventsPayload,
          ] =
            await Promise.all([
              campaignsResponse.json(),
              promoCodesResponse.json(),
              eventsResponse
                .json()
                .catch(() => null),
            ]);

          if (!campaignsResponse.ok) {
            throw new Error(
              getApiErrorMessage(
                campaignsPayload,
                "Impossible de charger les campagnes marketing.",
              ),
            );
          }

          if (!promoCodesResponse.ok) {
            throw new Error(
              getApiErrorMessage(
                promoCodesPayload,
                "Impossible de charger les codes promo.",
              ),
            );
          }

          const campaigns =
            extractDataArray(
              campaignsPayload,
              "campaigns",
            )
              .map(normalizeCampaign)
              .filter(
                (
                  item,
                ): item is OrganizerMarketingCampaignItem =>
                  item !== null,
              );

          const promoCodes =
            extractDataArray(
              promoCodesPayload,
              "promoCodes",
            )
              .map(normalizePromoCode)
              .filter(
                (
                  item,
                ): item is OrganizerMarketingPromoCodeItem =>
                  item !== null,
              );

          const eventsFromApi =
            extractDataArray(
              eventsPayload,
              "events",
            )
              .map(normalizeEvent)
              .filter(
                (
                  item,
                ): item is OrganizerMarketingEventOption =>
                  item !== null,
              );

          /*
           * Les options d’événement doivent toujours provenir de l’API
           * des événements, car OrganizerMarketingEventOption exige
           * également slug, status, startsAt, endsAt et currency.
           *
           * Les campagnes ne contiennent que eventId et eventTitle :
           * elles ne doivent donc pas être converties en options
           * d’événement incomplètes.
           */
          const eventMap =
            new Map<
              string,
              OrganizerMarketingEventOption
            >();

          for (
            const event of eventsFromApi
          ) {
            eventMap.set(
              event.id,
              event,
            );
          }

          setData({
            campaigns,
            promoCodes,
            events:
              Array.from(
                eventMap.values(),
              ),
          });
        } catch (
          error
        ) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les données marketing.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      const timeoutId =
        window.setTimeout(() => {
          void loadMarketingData();
        }, 0);

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      loadMarketingData,
    ],
  );

  const filteredCampaigns =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return data.campaigns;
        }

        return data.campaigns.filter(
          (
            campaign,
          ) =>
            [
              campaign.name,
              campaign.eventTitle,
              campaign.trackingCode,
              campaign.source ?? "",
              campaign.medium ?? "",
            ].some(
              (
                value,
              ) =>
                value
                  .toLowerCase()
                  .includes(query),
            ),
        );
      },
      [
        data.campaigns,
        search,
      ],
    );

  const filteredPromoCodes =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return data.promoCodes;
        }

        return data.promoCodes.filter(
          (
            promoCode,
          ) =>
            [
              promoCode.code,
              promoCode.eventTitle,
              promoCode.campaignName ?? "",
              promoCode.description ?? "",
            ].some(
              (
                value,
              ) =>
                value
                  .toLowerCase()
                  .includes(query),
            ),
        );
      },
      [
        data.promoCodes,
        search,
      ],
    );

  const metrics =
    useMemo(
      () => {
        const visits =
          data.campaigns.reduce(
            (
              total,
              campaign,
            ) =>
              total +
              campaign.visits,
            0,
          );

        const orders =
          data.campaigns.reduce(
            (
              total,
              campaign,
            ) =>
              total +
              campaign.orders,
            0,
          );

        const revenue =
          data.campaigns.reduce(
            (
              total,
              campaign,
            ) =>
              total +
              campaign.revenue,
            0,
          );

        const conversionRate =
          visits > 0
            ? (
                orders /
                visits
              ) *
              100
            : 0;

        const activeCampaigns =
          data.campaigns.filter(
            (
              campaign,
            ) =>
              campaign.status ===
              "ACTIVE",
          ).length;

        const activePromoCodes =
          data.promoCodes.filter(
            (
              promoCode,
            ) =>
              promoCode.status ===
              "ACTIVE",
          ).length;

        return {
          visits,
          orders,
          revenue,
          conversionRate,
          activeCampaigns,
          activePromoCodes,
        };
      },
      [
        data.campaigns,
        data.promoCodes,
      ],
    );

  const currency =
    data.campaigns[0]?.currency ??
    "XOF";

  async function submitCampaign(
    payload:
      CampaignFormSubmitPayload,
  ) {
    setSubmittingCampaign(true);
    setDialogError(null);

    try {
      const response =
        await fetch(
          editingCampaign
            ? `/api/organizer/marketing/campaigns/${editingCampaign.id}`
            : "/api/organizer/marketing/campaigns",
          {
            method:
              editingCampaign
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(payload),
          },
        );

      const responsePayload:
        unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            responsePayload,
            "Impossible d’enregistrer la campagne.",
          ),
        );
      }

      setCampaignDialogOpen(false);
      setEditingCampaign(null);

      await loadMarketingData(true);
    } catch (
      error
    ) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la campagne.",
      );
    } finally {
      setSubmittingCampaign(false);
    }
  }

  async function submitPromoCode(
    payload:
      PromoCodeSubmitPayload,
  ) {
    setSubmittingPromoCode(true);
    setDialogError(null);

    try {
      const response =
        await fetch(
          editingPromoCode
            ? `/api/organizer/marketing/promo-codes/${editingPromoCode.id}`
            : "/api/organizer/marketing/promo-codes",
          {
            method:
              editingPromoCode
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(payload),
          },
        );

      const responsePayload:
        unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            responsePayload,
            "Impossible d’enregistrer le code promo.",
          ),
        );
      }

      setPromoCodeDialogOpen(false);
      setEditingPromoCode(null);

      await loadMarketingData(true);
    } catch (
      error
    ) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le code promo.",
      );
    } finally {
      setSubmittingPromoCode(false);
    }
  }

  async function changeCampaignStatus(
    campaign:
      OrganizerMarketingCampaignItem,
    status:
      MarketingCampaignStatus,
  ) {
    await fetch(
      `/api/organizer/marketing/campaigns/${campaign.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            status,
            isActive:
              status === "ACTIVE",
          }),
      },
    );

    await loadMarketingData(true);
  }

  async function changePromoCodeStatus(
    promoCode:
      OrganizerMarketingPromoCodeItem,
    status:
      PromoCodeStatus,
  ) {
    await fetch(
      `/api/organizer/marketing/promo-codes/${promoCode.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            status,
            isActive:
              status === "ACTIVE",
          }),
      },
    );

    await loadMarketingData(true);
  }

  async function deleteCampaign(
    campaign:
      OrganizerMarketingCampaignItem,
  ) {
    const confirmed =
      window.confirm(
        `Supprimer ou archiver la campagne « ${campaign.name} » ?`,
      );

    if (!confirmed) {
      return;
    }

    await fetch(
      `/api/organizer/marketing/campaigns/${campaign.id}`,
      {
        method: "DELETE",
      },
    );

    await loadMarketingData(true);
  }

  async function deletePromoCode(
    promoCode:
      OrganizerMarketingPromoCodeItem,
  ) {
    const confirmed =
      window.confirm(
        `Supprimer ou archiver le code promo « ${promoCode.code} » ?`,
      );

    if (!confirmed) {
      return;
    }

    await fetch(
      `/api/organizer/marketing/promo-codes/${promoCode.id}`,
      {
        method: "DELETE",
      },
    );

    await loadMarketingData(true);
  }

  function openCampaignCreation() {
    setEditingCampaign(null);
    setDialogError(null);
    setCampaignDialogOpen(true);
  }

  function openPromoCodeCreation() {
    setEditingPromoCode(null);
    setDialogError(null);
    setPromoCodeDialogOpen(true);
  }

  return (
    <main className="min-h-screen w-full bg-[#04090c] px-3 py-4 text-white sm:px-5 sm:py-5 lg:px-7 lg:py-6">
      <div className="w-full min-w-0">
        <header className="rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_24px_75px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5">
                <Megaphone className="h-3.5 w-3.5 text-emerald-300" />

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  Acquisition et promotions
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                Marketing
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
                Créez des campagnes traçables, mesurez les performances et gérez les codes promo de vos événements depuis un espace unique.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/api/organizer/marketing/export?type=all&format=csv";
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-black text-neutral-300 transition hover:border-white/[0.13] hover:bg-white/[0.06] hover:text-white"
              >
                <Download className="h-4 w-4" />
                Exporter
              </button>

              <button
                type="button"
                onClick={openPromoCodeCreation}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-4 text-sm font-black text-amber-200 transition hover:bg-amber-400/[0.13]"
              >
                <BadgePercent className="h-4 w-4" />
                Nouveau code promo
              </button>

              <button
                type="button"
                onClick={openCampaignCreation}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400 px-4 text-sm font-black text-[#03120c] transition hover:bg-emerald-300"
              >
                <Plus className="h-4 w-4" />
                Nouvelle campagne
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Campagnes actives"
            value={formatNumber(
              metrics.activeCampaigns,
            )}
            description={`${formatNumber(data.campaigns.length)} campagne(s) enregistrée(s).`}
            icon={Megaphone}
          />

          <StatCard
            label="Visites attribuées"
            value={formatNumber(
              metrics.visits,
            )}
            description="Visites générées depuis les liens marketing."
            icon={TrendingUp}
          />

          <StatCard
            label="Taux de conversion"
            value={`${metrics.conversionRate.toFixed(2)} %`}
            description={`${formatNumber(metrics.orders)} commande(s) attribuée(s).`}
            icon={Target}
          />

          <StatCard
            label="Revenus attribués"
            value={formatMoney(
              metrics.revenue,
              currency,
            )}
            description={`${formatNumber(metrics.activePromoCodes)} code(s) promo actif(s).`}
            icon={WalletCards}
          />
        </section>

        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#071014] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/20 p-1">
              {(
                [
                  {
                    id: "overview",
                    label: "Vue d’ensemble",
                    icon: BarChart3,
                  },
                  {
                    id: "campaigns",
                    label: "Campagnes",
                    icon: Megaphone,
                  },
                  {
                    id: "promo-codes",
                    label: "Codes promo",
                    icon: TicketPercent,
                  },
                ] as const
              ).map(
                (
                  tab,
                ) => {
                  const Icon = tab.icon;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                      }}
                      className={
                        activeTab === tab.id
                          ? "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-black"
                          : "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-black text-neutral-500 transition hover:bg-white/[0.05] hover:text-white"
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                },
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                <input
                  type="search"
                  value={search}
                  onChange={(
                    event,
                  ) => {
                    setSearch(
                      event.target.value,
                    );
                  }}
                  placeholder="Rechercher une campagne ou un code…"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-3 text-sm font-semibold text-white outline-none placeholder:text-neutral-600 focus:border-emerald-400/35 focus:ring-2 focus:ring-emerald-400/10"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  void loadMarketingData(true);
                }}
                disabled={refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-black text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                Actualiser
              </button>
            </div>
          </div>
        </section>

        {pageError ? (
          <div className="mt-5">
            <MarketingEmptyState
              variant="error"
              description={pageError}
              primaryAction={{
                label: "Réessayer",
                icon: RefreshCw,
                onClick: () => {
                  void loadMarketingData();
                },
              }}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {activeTab === "overview" && (
              <>
                <CampaignsListClient
                  campaigns={filteredCampaigns.slice(0, 8)}
                  currency={currency}
                  isLoading={loading}
                  onEditCampaign={(
                    campaign,
                  ) => {
                    setEditingCampaign(campaign);
                    setDialogError(null);
                    setCampaignDialogOpen(true);
                  }}
                  onStatusChange={(
                    campaign,
                    status,
                  ) => {
                    void changeCampaignStatus(
                      campaign,
                      status,
                    );
                  }}
                  onDeleteCampaign={(
                    campaign,
                  ) => {
                    void deleteCampaign(campaign);
                  }}
                />

                <PromoCodesListClient
                  promoCodes={filteredPromoCodes.slice(0, 8)}
                  currency={currency}
                  isLoading={loading}
                  onEditPromoCode={(
                    promoCode,
                  ) => {
                    setEditingPromoCode(promoCode);
                    setDialogError(null);
                    setPromoCodeDialogOpen(true);
                  }}
                  onStatusChange={(
                    promoCode,
                    status,
                  ) => {
                    void changePromoCodeStatus(
                      promoCode,
                      status,
                    );
                  }}
                  onDeletePromoCode={(
                    promoCode,
                  ) => {
                    void deletePromoCode(promoCode);
                  }}
                />
              </>
            )}

            {activeTab === "campaigns" && (
              <CampaignsListClient
                campaigns={filteredCampaigns}
                currency={currency}
                isLoading={loading}
                onEditCampaign={(
                  campaign,
                ) => {
                  setEditingCampaign(campaign);
                  setDialogError(null);
                  setCampaignDialogOpen(true);
                }}
                onStatusChange={(
                  campaign,
                  status,
                ) => {
                  void changeCampaignStatus(
                    campaign,
                    status,
                  );
                }}
                onDeleteCampaign={(
                  campaign,
                ) => {
                  void deleteCampaign(campaign);
                }}
              />
            )}

            {activeTab === "promo-codes" && (
              <PromoCodesListClient
                promoCodes={filteredPromoCodes}
                currency={currency}
                isLoading={loading}
                onEditPromoCode={(
                  promoCode,
                ) => {
                  setEditingPromoCode(promoCode);
                  setDialogError(null);
                  setPromoCodeDialogOpen(true);
                }}
                onStatusChange={(
                  promoCode,
                  status,
                ) => {
                  void changePromoCodeStatus(
                    promoCode,
                    status,
                  );
                }}
                onDeletePromoCode={(
                  promoCode,
                ) => {
                  void deletePromoCode(promoCode);
                }}
              />
            )}
          </div>
        )}
      </div>

      <CampaignFormDialog
        open={campaignDialogOpen}
        mode={
          editingCampaign
            ? "edit"
            : "create"
        }
        campaign={editingCampaign}
        events={data.events}
        isSubmitting={submittingCampaign}
        errorMessage={dialogError}
        defaultCurrency={currency}
        onClose={() => {
          if (!submittingCampaign) {
            setCampaignDialogOpen(false);
            setEditingCampaign(null);
            setDialogError(null);
          }
        }}
        onSubmit={submitCampaign}
      />

      <PromoCodeDialog
        open={promoCodeDialogOpen}
        mode={
          editingPromoCode
            ? "edit"
            : "create"
        }
        promoCode={editingPromoCode}
        events={data.events}
        campaigns={data.campaigns}
        isSubmitting={submittingPromoCode}
        errorMessage={dialogError}
        currency={currency}
        onClose={() => {
          if (!submittingPromoCode) {
            setPromoCodeDialogOpen(false);
            setEditingPromoCode(null);
            setDialogError(null);
          }
        }}
        onSubmit={submitPromoCode}
      />
    </main>
  );
}