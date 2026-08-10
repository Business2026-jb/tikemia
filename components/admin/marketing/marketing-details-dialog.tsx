"use client";

import {
  AlertTriangle,
  CalendarDays,
  Eye,
  LoaderCircle,
  Mail,
  MapPin,
  MousePointerClick,
  ShoppingCart,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import MarketingChannelBadge from "./marketing-channel-badge";
import MarketingPriorityBadge from "./marketing-priority-badge";
import MarketingStatusBadge from "./marketing-status-badge";

type MarketingDetail = Awaited<
  ReturnType<
    typeof import(
      "@/lib/admin/marketing/get-admin-marketing-campaign"
    ).getAdminMarketingCampaign
  >
>;

function formatDate(
  value: Date | string | null | undefined,
) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Info({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-semibold text-neutral-300">
        {value || "-"}
      </div>
    </div>
  );
}

export default function MarketingDetailsDialog({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [campaign, setCampaign] = useState<MarketingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !campaignId) {
      setCampaign(null);
      setLoading(false);
      setError("");
      return;
    }

    const id = campaignId;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setCampaign(null);

      try {
        const response = await fetch(
          `/api/admin/marketing/${encodeURIComponent(id)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          data?: MarketingDetail;
          error?: string | { message?: string };
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : payload.error?.message ||
                  "Impossible de charger la campagne.",
          );
        }

        setCampaign(payload.data);
      } catch (caught) {
        if (controller.signal.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger la campagne.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [open, campaignId]);

  if (!open || !campaignId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[24px] border border-white/[0.09] bg-[#070b0e] shadow-2xl">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b0e]/95 p-5 backdrop-blur sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
              Campagne marketing
            </p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Détails complets
            </h2>
            <p className="mt-1 text-xs text-neutral-600">{campaignId}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-fuchsia-300" />
            </div>
          ) : null}

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {campaign ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">Statut</p>
                  <div className="mt-3">
                    <MarketingStatusBadge status={campaign.status} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">Canal</p>
                  <div className="mt-3">
                    <MarketingChannelBadge channel={campaign.channel} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">
                    Priorité
                  </p>
                  <div className="mt-3">
                    <MarketingPriorityBadge priority={campaign.priority} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-xs font-bold text-neutral-500">Budget</p>
                  <p className="mt-2 text-lg font-black text-white">
                    {campaign.budget
                      ? `${campaign.budget} ${campaign.currency}`
                      : "Non défini"}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="font-black text-white">Campagne</h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info label="Nom" value={campaign.name} />
                    <Info label="Code de suivi" value={campaign.trackingCode} />
                    <Info label="Source" value={campaign.source} />
                    <Info label="Medium" value={campaign.medium} />
                    <Info label="Contenu" value={campaign.content} />
                    <Info label="Objectif" value={campaign.goalType} />
                    <Info label="Valeur cible" value={campaign.goalValue} />
                    <Info
                      label="Période"
                      value={`${formatDate(campaign.startsAt)} — ${formatDate(
                        campaign.endsAt,
                      )}`}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <UserRound className="h-4 w-4 text-sky-300" />
                    Organisateur
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Nom"
                      value={campaign.organizer.fullName}
                    />
                    <Info
                      label="Entreprise"
                      value={campaign.organizer.profile?.businessName}
                    />
                    <Info
                      label="E-mail"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />
                          {campaign.organizer.email}
                        </span>
                      }
                    />
                    <Info
                      label="Téléphone"
                      value={campaign.organizer.phone}
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 font-black text-white">
                    <CalendarDays className="h-4 w-4 text-amber-300" />
                    Événement
                  </h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info label="Titre" value={campaign.event.title} />
                    <Info label="Statut" value={campaign.event.status} />
                    <Info
                      label="Lieu"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-neutral-600" />
                          {campaign.event.venueName}, {campaign.event.city}
                        </span>
                      }
                    />
                    <Info
                      label="Début"
                      value={formatDate(campaign.event.startsAt)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="font-black text-white">Performances</h3>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      label="Visites"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-neutral-600" />
                          {campaign.metrics.visits}
                        </span>
                      }
                    />
                    <Info
                      label="Commandes"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <ShoppingCart className="h-3.5 w-3.5 text-neutral-600" />
                          {campaign.metrics.orders}
                        </span>
                      }
                    />
                    <Info
                      label="Billets"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Ticket className="h-3.5 w-3.5 text-neutral-600" />
                          {campaign.metrics.tickets}
                        </span>
                      }
                    />
                    <Info
                      label="Conversion"
                      value={`${campaign.metrics.conversionRate} %`}
                    />
                    <Info
                      label="Revenus"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <MousePointerClick className="h-3.5 w-3.5 text-neutral-600" />
                          {campaign.metrics.revenue} {campaign.currency}
                        </span>
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="font-black text-white">
                  Historique administratif
                </h3>

                <div className="mt-4 space-y-3">
                  {campaign.auditLogs.length > 0 ? (
                    campaign.auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-white">
                            {log.action}
                          </p>
                          <p className="text-xs text-neutral-600">
                            {formatDate(log.createdAt)}
                          </p>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-neutral-500">
                          {log.reason || "Aucun motif renseigné."}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-600">
                      Aucun historique disponible.
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
