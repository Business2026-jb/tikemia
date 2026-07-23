"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Crown,
  LoaderCircle,
  Pause,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  useMemo,
  useState,
  useTransition,
} from "react";

import PromotionEmptyState from "@/components/organizer/promotions/promotion-empty-state";
import PromotionSummary from "@/components/organizer/promotions/promotion-summary";
import PromotedEventsTable from "@/components/organizer/promotions/promoted-events-table";
import SubscriptionPlansGrid from "@/components/organizer/promotions/subscription-plans-grid";
import SubscriptionStatusCard from "@/components/organizer/promotions/subscription-status-card";
import type {
  GetOrganizerPromotionsResult,
  OrganizerPromotedEvent,
  OrganizerPromotionEligibleEvent,
} from "@/lib/organizer/promotions/get-organizer-promotions";
import type { OrganizerSubscriptionPlan } from "@/lib/organizer/promotions/get-subscription-plans";

type PromotionPageClientProps = {
  initialData: GetOrganizerPromotionsResult;
};

type FeedbackState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type PromotionAction =
  | "PAUSE"
  | "RESUME"
  | "REMOVE";

type PendingPromotionAction = {
  action: PromotionAction;
  event: OrganizerPromotedEvent;
} | null;

type ActionApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  redirectTo?: string;
};

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Non définie";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(parsed);
}

function getActionTitle(
  action: PromotionAction,
): string {
  switch (action) {
    case "PAUSE":
      return "Mettre la promotion en pause";

    case "RESUME":
      return "Réactiver la promotion";

    case "REMOVE":
      return "Retirer l’événement";

    default:
      return "Confirmer l’action";
  }
}

function getActionDescription(
  action: PromotionAction,
  eventTitle: string,
): string {
  switch (action) {
    case "PAUSE":
      return `L’événement « ${eventTitle} » ne sera plus prioritaire jusqu’à sa réactivation.`;

    case "RESUME":
      return `L’événement « ${eventTitle} » retrouvera sa priorité Premium immédiatement.`;

    case "REMOVE":
      return `L’événement « ${eventTitle} » sera retiré de votre formule Premium. Cette action ne supprime pas l’événement.`;

    default:
      return "Confirmez cette action.";
  }
}

function getActionButtonLabel(
  action: PromotionAction,
): string {
  switch (action) {
    case "PAUSE":
      return "Mettre en pause";

    case "RESUME":
      return "Réactiver";

    case "REMOVE":
      return "Retirer";

    default:
      return "Confirmer";
  }
}

function getActionEndpoint(
  eventId: string,
): string {
  return `/api/organizer/promotions/events/${encodeURIComponent(
    eventId,
  )}`;
}

function getRecommendedPlanCode(
  plans: OrganizerSubscriptionPlan[],
): string | null {
  if (plans.length === 0) {
    return null;
  }

  const sortedPlans = [
    ...plans,
  ].sort((first, second) => {
    if (
      second.priorityScore !==
      first.priorityScore
    ) {
      return (
        second.priorityScore -
        first.priorityScore
      );
    }

    if (
      second.maxBoostedEvents !==
      first.maxBoostedEvents
    ) {
      return (
        second.maxBoostedEvents -
        first.maxBoostedEvents
      );
    }

    return first.sortOrder -
      second.sortOrder;
  });

  return sortedPlans[0]?.code ?? null;
}

function getPopularPlanCode(
  plans: OrganizerSubscriptionPlan[],
  recommendedCode: string | null,
): string | null {
  const candidates =
    plans.filter(
      (plan) =>
        plan.code !==
        recommendedCode,
    );

  if (candidates.length === 0) {
    return null;
  }

  const sortedPlans = [
    ...candidates,
  ].sort((first, second) => {
    if (
      first.sortOrder !==
      second.sortOrder
    ) {
      return (
        first.sortOrder -
        second.sortOrder
      );
    }

    return first.price -
      second.price;
  });

  return (
    sortedPlans[
      Math.floor(
        sortedPlans.length / 2,
      )
    ]?.code ??
    sortedPlans[0]?.code ??
    null
  );
}

export default function PromotionPageClient({
  initialData,
}: PromotionPageClientProps) {
  const router = useRouter();

  const [isRefreshing, startRefresh] =
    useTransition();

  const [selectedPlanId, setSelectedPlanId] =
    useState<string | null>(null);

  const [
    processingBoostId,
    setProcessingBoostId,
  ] = useState<string | null>(null);

  const [
    pendingPromotionAction,
    setPendingPromotionAction,
  ] =
    useState<PendingPromotionAction>(
      null,
    );

  const [
    showEventSelector,
    setShowEventSelector,
  ] = useState(false);

  const [
    eligibleEventSearch,
    setEligibleEventSearch,
  ] = useState("");

  const [feedback, setFeedback] =
    useState<FeedbackState>(null);

  const currentPlanId =
    initialData.currentSubscription
      ?.plan.id ?? null;

  const recommendedPlanCode =
    useMemo(
      () =>
        getRecommendedPlanCode(
          initialData.plans,
        ),
      [initialData.plans],
    );

  const popularPlanCode =
    useMemo(
      () =>
        getPopularPlanCode(
          initialData.plans,
          recommendedPlanCode,
        ),
      [
        initialData.plans,
        recommendedPlanCode,
      ],
    );

  const filteredEligibleEvents =
    useMemo(() => {
      const normalizedSearch =
        normalizeText(
          eligibleEventSearch,
        );

      if (!normalizedSearch) {
        return initialData.eligibleEvents;
      }

      return initialData.eligibleEvents.filter(
        (event) =>
          normalizeText(
            [
              event.title,
              event.city,
              event.country,
              event.venueName,
            ].join(" "),
          ).includes(
            normalizedSearch,
          ),
      );
    }, [
      eligibleEventSearch,
      initialData.eligibleEvents,
    ]);

  const hasUsableSubscription =
    Boolean(
      initialData.currentSubscription
        ?.isUsable,
    );

  const hasRemainingSlots =
    (
      initialData.currentSubscription
        ?.usage.remainingBoostSlots ??
      0
    ) > 0;

  function refreshPage() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function clearFeedback() {
    setFeedback(null);
  }

  function handleSelectPlan(
    plan: OrganizerSubscriptionPlan,
  ) {
    clearFeedback();
    setSelectedPlanId(plan.id);

    router.push(
      `/organizer/promotions/checkout?planId=${encodeURIComponent(
        plan.id,
      )}`,
    );
  }

  function handleRenewSubscription() {
    const planId =
      initialData.currentSubscription
        ?.plan.id;

    if (!planId) {
      setFeedback({
        type: "error",
        message:
          "Aucune formule ne peut être renouvelée pour le moment.",
      });
      return;
    }

    router.push(
      `/organizer/promotions/checkout?planId=${encodeURIComponent(
        planId,
      )}&mode=renew`,
    );
  }

  function handleCancelSubscription() {
    router.push(
      "/organizer/promotions/history?action=cancel",
    );
  }

  function handleManageAutoRenew() {
    router.push(
      "/organizer/promotions/history?action=auto-renew",
    );
  }

  function openPromotionSelector() {
    clearFeedback();

    if (!hasUsableSubscription) {
      setFeedback({
        type: "error",
        message:
          "Vous devez disposer d’un abonnement Premium actif pour promouvoir un événement.",
      });
      return;
    }

    if (!hasRemainingSlots) {
      setFeedback({
        type: "error",
        message:
          "Tous les emplacements de votre formule sont déjà utilisés.",
      });
      return;
    }

    setEligibleEventSearch("");
    setShowEventSelector(true);
  }

  function requestPromotionAction(
    action: PromotionAction,
    event: OrganizerPromotedEvent,
  ) {
    clearFeedback();
    setPendingPromotionAction({
      action,
      event,
    });
  }

  async function executePromotionAction() {
    if (!pendingPromotionAction) {
      return;
    }

    const { action, event } =
      pendingPromotionAction;

    setProcessingBoostId(
      event.boostId,
    );
    setFeedback(null);

    try {
      const response = await fetch(
        getActionEndpoint(
          event.eventId,
        ),
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
            boostId:
              event.boostId,
          }),
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | ActionApiResponse
          | null;

      if (
        !response.ok ||
        !payload?.success
      ) {
        if (
          response.status === 401 &&
          payload?.redirectTo
        ) {
          router.push(
            payload.redirectTo,
          );
          return;
        }

        throw new Error(
          payload?.message ??
            "Impossible d’effectuer cette action pour le moment.",
        );
      }

      setPendingPromotionAction(
        null,
      );

      setFeedback({
        type: "success",
        message:
          payload.message ??
          "La promotion a été mise à jour avec succès.",
      });

      refreshPage();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d’effectuer cette action pour le moment.",
      });
    } finally {
      setProcessingBoostId(
        null,
      );
    }
  }

  async function assignEligibleEvent(
    event: OrganizerPromotionEligibleEvent,
  ) {
    if (
      !event.canBePromoted ||
      !hasUsableSubscription ||
      !hasRemainingSlots
    ) {
      return;
    }

    setProcessingBoostId(event.id);
    setFeedback(null);

    try {
      const response = await fetch(
        getActionEndpoint(event.id),
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            subscriptionId:
              initialData
                .currentSubscription
                ?.id,
          }),
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | ActionApiResponse
          | null;

      if (
        !response.ok ||
        !payload?.success
      ) {
        if (
          response.status === 401 &&
          payload?.redirectTo
        ) {
          router.push(
            payload.redirectTo,
          );
          return;
        }

        throw new Error(
          payload?.message ??
            "Impossible de promouvoir cet événement pour le moment.",
        );
      }

      setShowEventSelector(false);

      setFeedback({
        type: "success",
        message:
          payload.message ??
          "L’événement a été ajouté à la Visibilité Premium.",
      });

      refreshPage();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de promouvoir cet événement pour le moment.",
      });
    } finally {
      setProcessingBoostId(
        null,
      );
    }
  }

  return (
    <>
      <div className="w-full space-y-6 pb-8">
        <PromotionPageHeader
          organizerName={
            initialData.organizer
              .displayName
          }
          hasBlueBadge={
            initialData.organizer
              .hasBlueBadge
          }
          isRefreshing={
            isRefreshing
          }
          onRefresh={
            refreshPage
          }
          onPromoteEvent={
            openPromotionSelector
          }
          canPromoteEvent={
            hasUsableSubscription &&
            hasRemainingSlots
          }
        />

        {feedback && (
          <FeedbackBanner
            feedback={feedback}
            onClose={clearFeedback}
          />
        )}

        <PromotionSummary
          summary={
            initialData.summary
          }
          currentSubscription={
            initialData.currentSubscription
          }
          currency={
            initialData.organizer
              .preferredCurrency
          }
        />

        <SubscriptionStatusCard
          subscription={
            initialData.currentSubscription
          }
          hasBlueBadge={
            initialData.organizer
              .hasBlueBadge
          }
          blueBadgeGrantedAt={
            initialData.organizer
              .blueBadgeGrantedAt
          }
          onRenew={
            handleRenewSubscription
          }
          onCancel={
            handleCancelSubscription
          }
          onManageAutoRenew={
            handleManageAutoRenew
          }
          isProcessing={
            isRefreshing
          }
        />

        {initialData.promotedEvents
          .length > 0 ? (
          <PromotedEventsTable
            events={
              initialData.promotedEvents
            }
            processingBoostId={
              processingBoostId
            }
            onPause={(event) =>
              requestPromotionAction(
                "PAUSE",
                event,
              )
            }
            onResume={(event) =>
              requestPromotionAction(
                "RESUME",
                event,
              )
            }
            onRemove={(event) =>
              requestPromotionAction(
                "REMOVE",
                event,
              )
            }
          />
        ) : (
          <PromotionEmptyState
            hasSubscription={
              hasUsableSubscription
            }
            hasEligibleEvents={
              initialData.eligibleEvents.some(
                (event) =>
                  event.canBePromoted,
              )
            }
            onPrimaryAction={
              hasUsableSubscription
                ? openPromotionSelector
                : () => {
                    document
                      .getElementById(
                        "premium-plans",
                      )
                      ?.scrollIntoView({
                        behavior:
                          "smooth",
                        block: "start",
                      });
                  }
            }
            onSecondaryAction={
              hasUsableSubscription
                ? handleManageAutoRenew
                : undefined
            }
          />
        )}

        <section
          id="premium-plans"
          className="scroll-mt-24"
        >
          <SubscriptionPlansGrid
            plans={initialData.plans}
            currentPlanId={
              currentPlanId
            }
            recommendedPlanCode={
              recommendedPlanCode
            }
            popularPlanCode={
              popularPlanCode
            }
            selectedPlanId={
              selectedPlanId
            }
            disabled={
              isRefreshing
            }
            onSelectPlan={
              handleSelectPlan
            }
          />
        </section>

        <PremiumInformationPanel
          hasBlueBadge={
            initialData.organizer
              .hasBlueBadge
          }
          blueBadgeGrantedAt={
            initialData.organizer
              .blueBadgeGrantedAt
          }
        />
      </div>

      {showEventSelector && (
        <EventSelectorDialog
          events={
            filteredEligibleEvents
          }
          search={
            eligibleEventSearch
          }
          processingEventId={
            processingBoostId
          }
          onSearchChange={
            setEligibleEventSearch
          }
          onClose={() =>
            setShowEventSelector(
              false,
            )
          }
          onSelect={
            assignEligibleEvent
          }
        />
      )}

      {pendingPromotionAction && (
        <PromotionActionDialog
          pendingAction={
            pendingPromotionAction
          }
          isProcessing={
            processingBoostId ===
            pendingPromotionAction
              .event.boostId
          }
          onClose={() =>
            setPendingPromotionAction(
              null,
            )
          }
          onConfirm={
            executePromotionAction
          }
        />
      )}
    </>
  );
}

function PromotionPageHeader({
  organizerName,
  hasBlueBadge,
  isRefreshing,
  canPromoteEvent,
  onRefresh,
  onPromoteEvent,
}: {
  organizerName: string;
  hasBlueBadge: boolean;
  isRefreshing: boolean;
  canPromoteEvent: boolean;
  onRefresh: () => void;
  onPromoteEvent: () => void;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071015] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.28)] sm:p-6 lg:p-7">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.09] via-transparent to-orange-500/[0.06]" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-lime-400">
              <Crown className="h-3.5 w-3.5" />
              Visibilité Premium
            </span>

            {hasBlueBadge && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-300">
                <BadgeCheck className="h-3.5 w-3.5" />
                Organisateur vérifié
              </span>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
            Faites passer vos événements en première position
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500 sm:text-[15px] sm:leading-7">
            {organizerName}, augmentez votre visibilité, attirez davantage de participants et suivez les performances de chaque promotion.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row xl:justify-end">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw
              className={`h-4 w-4 ${
                isRefreshing
                  ? "animate-spin"
                  : ""
              }`}
            />
            Actualiser
          </button>

          <button
            type="button"
            onClick={onPromoteEvent}
            disabled={
              !canPromoteEvent
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Zap className="h-4 w-4" />
            Promouvoir un événement
          </button>
        </div>
      </div>
    </header>
  );
}

function FeedbackBanner({
  feedback,
  onClose,
}: {
  feedback: Exclude<
    FeedbackState,
    null
  >;
  onClose: () => void;
}) {
  const isSuccess =
    feedback.type === "success";

  return (
    <div
      role={
        isSuccess
          ? "status"
          : "alert"
      }
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${
        isSuccess
          ? "border-emerald-500/25 bg-emerald-500/[0.07] text-lime-300"
          : "border-red-500/25 bg-red-500/[0.07] text-red-200"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <p className="min-w-0 flex-1 text-sm leading-6">
        {feedback.message}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le message"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/[0.06]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function PremiumInformationPanel({
  hasBlueBadge,
  blueBadgeGrantedAt,
}: {
  hasBlueBadge: boolean;
  blueBadgeGrantedAt: string | null;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <InformationCard
        icon="ranking"
        title="Classement prioritaire"
        description="Les événements Premium actifs sont servis avant les événements ordinaires selon leur score de priorité."
      />

      <InformationCard
        icon="badge"
        title="Badge bleu permanent"
        description={
          hasBlueBadge
            ? `Badge acquis définitivement${
                blueBadgeGrantedAt
                  ? ` depuis le ${formatDate(
                      blueBadgeGrantedAt,
                    )}`
                  : ""
              }.`
            : "Le badge est attribué après votre premier abonnement payé et reste acquis."
        }
      />

      <InformationCard
        icon="security"
        title="Contrôle Tikemia"
        description="Tikemia peut suspendre une promotion non conforme sans supprimer votre événement."
      />
    </section>
  );
}

function InformationCard({
  icon,
  title,
  description,
}: {
  icon:
    | "ranking"
    | "badge"
    | "security";
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.022] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
        {icon === "ranking" ? (
          <Sparkles className="h-4.5 w-4.5" />
        ) : icon === "badge" ? (
          <BadgeCheck className="h-4.5 w-4.5 text-blue-400" />
        ) : (
          <ShieldCheck className="h-4.5 w-4.5" />
        )}
      </div>

      <h2 className="mt-3 text-sm font-black text-white">
        {title}
      </h2>

      <p className="mt-1.5 text-[11px] leading-5 text-neutral-500">
        {description}
      </p>
    </article>
  );
}

function EventSelectorDialog({
  events,
  search,
  processingEventId,
  onSearchChange,
  onClose,
  onSelect,
}: {
  events: OrganizerPromotionEligibleEvent[];
  search: string;
  processingEventId: string | null;
  onSearchChange: (
    value: string,
  ) => void;
  onClose: () => void;
  onSelect: (
    event: OrganizerPromotionEligibleEvent,
  ) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-selector-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/[0.09] bg-[#071015] shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-lime-400">
              <Zap className="h-5 w-5" />
            </div>

            <div>
              <h2
                id="event-selector-title"
                className="text-lg font-black tracking-[-0.025em] text-white"
              >
                Promouvoir un événement
              </h2>

              <p className="mt-1 text-sm leading-6 text-neutral-500">
                Choisissez un événement publié et à venir.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-white/[0.07] p-4 sm:px-6">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                onSearchChange(
                  event.target.value,
                )
              }
              placeholder="Rechercher un événement, une ville ou un lieu..."
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/40 focus:bg-white/[0.045]"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {events.length > 0 ? (
            <div className="grid gap-3">
              {events.map((event) => (
                <EligibleEventRow
                  key={event.id}
                  event={event}
                  isProcessing={
                    processingEventId ===
                    event.id
                  }
                  onSelect={
                    onSelect
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-neutral-500">
                <Search className="h-5 w-5" />
              </div>

              <h3 className="mt-4 text-base font-black text-white">
                Aucun événement trouvé
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Vérifiez la recherche ou publiez un nouvel événement à venir.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EligibleEventRow({
  event,
  isProcessing,
  onSelect,
}: {
  event: OrganizerPromotionEligibleEvent;
  isProcessing: boolean;
  onSelect: (
    event: OrganizerPromotionEligibleEvent,
  ) => void;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.075] bg-white/[0.025] p-3.5 sm:flex-row sm:items-center">
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-[#0a1419] sm:h-20 sm:w-32">
        {event.coverImage ? (
          <Image
            src={event.coverImage}
            alt={event.title}
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="h-6 w-6 text-neutral-700" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-black text-white">
          {event.title}
        </h3>

        <p className="mt-1.5 text-[11px] text-neutral-500">
          {formatDate(
            event.startsAt,
          )}{" "}
          · {event.city},{" "}
          {event.country}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[9px] font-bold text-neutral-500">
            <TicketCheck className="h-3 w-3" />
            {event.counts.ticketTypes} type
            {event.counts.ticketTypes > 1
              ? "s"
              : ""}{" "}
            de billet
          </span>

          {event.hasActiveBoost && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/[0.07] px-2 py-1 text-[9px] font-bold text-orange-300">
              <Clock3 className="h-3 w-3" />
              Déjà promu
            </span>
          )}
        </div>

        {!event.canBePromoted &&
          event.ineligibilityReason && (
            <p className="mt-2 text-[10px] leading-4 text-orange-300/80">
              {
                event.ineligibilityReason
              }
            </p>
          )}
      </div>

      <button
        type="button"
        onClick={() =>
          onSelect(event)
        }
        disabled={
          !event.canBePromoted ||
          isProcessing
        }
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-4 text-xs font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isProcessing ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}

        Promouvoir
      </button>
    </article>
  );
}

function PromotionActionDialog({
  pendingAction,
  isProcessing,
  onClose,
  onConfirm,
}: {
  pendingAction: Exclude<
    PendingPromotionAction,
    null
  >;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDestructive =
    pendingAction.action ===
    "REMOVE";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={
          isProcessing
            ? undefined
            : onClose
        }
        className="absolute inset-0"
      />

      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="promotion-action-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.09] bg-[#071015] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
      >
        <header className="flex items-start gap-4 border-b border-white/[0.07] p-5 sm:p-6">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              isDestructive
                ? "border-red-500/25 bg-red-500/10 text-red-400"
                : pendingAction.action ===
                    "PAUSE"
                  ? "border-orange-500/25 bg-orange-500/10 text-orange-400"
                  : "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
            }`}
          >
            {isDestructive ? (
              <Trash2 className="h-5 w-5" />
            ) : pendingAction.action ===
                "PAUSE" ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="promotion-action-title"
              className="text-lg font-black tracking-[-0.025em] text-white"
            >
              {getActionTitle(
                pendingAction.action,
              )}
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {getActionDescription(
                pendingAction.action,
                pendingAction.event
                  .event.title,
              )}
            </p>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />

            <p className="text-[11px] leading-5 text-neutral-500">
              Cette action concerne uniquement la promotion Premium. Votre événement, ses billets et ses ventes restent intacts.
            </p>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isDestructive
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : pendingAction.action ===
                      "PAUSE"
                    ? "bg-orange-500 text-black hover:bg-orange-400"
                    : "bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 text-white hover:scale-[1.01]"
              }`}
            >
              {isProcessing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : isDestructive ? (
                <Trash2 className="h-4 w-4" />
              ) : pendingAction.action ===
                  "PAUSE" ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              {getActionButtonLabel(
                pendingAction.action,
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}