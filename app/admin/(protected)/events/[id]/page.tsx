"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileText,
  ImageIcon,
  LoaderCircle,
  MapPin,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Store,
  TicketCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AdminEventStatus =
  | "DRAFT"
  | "PENDING"
  | "PUBLISHED"
  | "REJECTED"
  | "CANCELED"
  | "SUSPENDED"
  | "ARCHIVED"
  | "COMPLETED";

type AdminEventAction =
  | "APPROVE"
  | "REJECT"
  | "CANCEL"
  | "SUSPEND"
  | "RESTORE"
  | "ARCHIVE";

type EventTicketType = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  quantity: number | null;
  sold: number;
  remaining: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
};

type EventImage = {
  id: string;
  url: string;
  altText: string | null;
  position: number;
};

type EventOrganizer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  avatarUrl: string | null;
  country: string | null;
  city: string | null;
  isActive: boolean;
  emailVerified: boolean;
};

type EventCategory = {
  id: string;
  name: string;
  slug: string | null;
};

type EventFinancials = {
  ticketsSold: number;
  ticketsCapacity: number | null;
  grossRevenue: number;
  commissionAmount: number;
  organizerNetRevenue: number;
  refundedAmount: number;
  paidOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  currency: string;
};

type EventModeration = {
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  suspensionReason: string | null;
  adminNotes: string | null;
};

type AdminEventDetails = {
  id: string;
  organizerId: string;

  title: string;
  slug: string;
  description: string;
  shortDescription: string | null;

  status: AdminEventStatus;
  isFree: boolean;
  isFeatured: boolean;
  isPublished: boolean;

  coverImageUrl: string | null;
  images: EventImage[];

  country: string;
  city: string;
  address: string | null;
  venueName: string | null;
  latitude: number | null;
  longitude: number | null;

  startsAt: string;
  endsAt: string | null;
  timezone: string | null;

  currency: string;

  createdAt: string;
  updatedAt: string;

  organizer: EventOrganizer;
  category: EventCategory | null;
  ticketTypes: EventTicketType[];
  financials: EventFinancials;
  moderation: EventModeration;
};

type AdminEventApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  redirectTo?: string;
  data?: {
    event: AdminEventDetails;
  };
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

type ActionDialogState = {
  open: boolean;
  action: AdminEventAction | null;
  title: string;
  description: string;
  confirmLabel: string;
  requiresReason: boolean;
  reasonLabel: string;
  reasonPlaceholder: string;
  tone: "blue" | "emerald" | "amber" | "rose" | "violet";
};

const CLOSED_ACTION_DIALOG: ActionDialogState = {
  open: false,
  action: null,
  title: "",
  description: "",
  confirmLabel: "",
  requiresReason: false,
  reasonLabel: "Motif",
  reasonPlaceholder: "",
  tone: "blue",
};

const STATUS_LABELS: Record<
  AdminEventStatus,
  string
> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  PUBLISHED: "Publié",
  REJECTED: "Rejeté",
  CANCELED: "Annulé",
  SUSPENDED: "Suspendu",
  ARCHIVED: "Archivé",
  COMPLETED: "Terminé",
};

const STATUS_CLASSES: Record<
  AdminEventStatus,
  string
> = {
  DRAFT:
    "border-white/[0.09] bg-white/[0.04] text-neutral-300",
  PENDING:
    "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  PUBLISHED:
    "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
  REJECTED:
    "border-rose-400/20 bg-rose-400/[0.08] text-rose-200",
  CANCELED:
    "border-orange-400/20 bg-orange-400/[0.08] text-orange-200",
  SUSPENDED:
    "border-red-400/20 bg-red-400/[0.08] text-red-200",
  ARCHIVED:
    "border-violet-400/20 bg-violet-400/[0.08] text-violet-200",
  COMPLETED:
    "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200",
};

function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function normalizeCurrency(
  value: string | null | undefined,
): string {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  return /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : "XOF";
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const normalizedCurrency =
    normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          normalizedCurrency,
        maximumFractionDigits: 0,
      },
    ).format(safeValue);
  } catch {
    return `${Math.round(
      safeValue,
    ).toLocaleString("fr-FR")} ${normalizedCurrency}`;
  }
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Non définie";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "long",
      timeStyle: "short",
    },
  ).format(date);
}

function formatNumber(
  value: number,
): string {
  return Math.max(
    0,
    Number.isFinite(value)
      ? value
      : 0,
  ).toLocaleString("fr-FR");
}

function safeText(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized || fallback;
}

async function readJsonResponse<T>(
  response: Response,
): Promise<T> {
  const text =
    await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      "La réponse du serveur n’est pas valide.",
    );
  }
}

function getActionDialog(
  action: AdminEventAction,
): ActionDialogState {
  const dialogs: Record<
    AdminEventAction,
    ActionDialogState
  > = {
    APPROVE: {
      open: true,
      action,
      title: "Valider et publier l’événement",
      description:
        "L’événement deviendra visible sur Tikemia dès la confirmation.",
      confirmLabel: "Valider l’événement",
      requiresReason: false,
      reasonLabel: "Note interne facultative",
      reasonPlaceholder:
        "Ajoutez une note interne pour l’équipe Tikemia.",
      tone: "emerald",
    },
    REJECT: {
      open: true,
      action,
      title: "Rejeter l’événement",
      description:
        "L’organisateur devra corriger les problèmes avant de soumettre à nouveau.",
      confirmLabel: "Confirmer le rejet",
      requiresReason: true,
      reasonLabel: "Raison du rejet",
      reasonPlaceholder:
        "Expliquez clairement ce que l’organisateur doit corriger.",
      tone: "rose",
    },
    CANCEL: {
      open: true,
      action,
      title: "Annuler l’événement",
      description:
        "L’événement sera marqué comme annulé et ne sera plus vendu.",
      confirmLabel: "Annuler l’événement",
      requiresReason: true,
      reasonLabel: "Motif de l’annulation",
      reasonPlaceholder:
        "Indiquez la raison précise de l’annulation.",
      tone: "amber",
    },
    SUSPEND: {
      open: true,
      action,
      title: "Suspendre l’événement",
      description:
        "La vente et l’affichage public seront interrompus jusqu’à réactivation.",
      confirmLabel: "Suspendre l’événement",
      requiresReason: true,
      reasonLabel: "Motif de la suspension",
      reasonPlaceholder:
        "Décrivez le problème ayant motivé la suspension.",
      tone: "rose",
    },
    RESTORE: {
      open: true,
      action,
      title: "Réactiver l’événement",
      description:
        "L’événement retrouvera son statut publié et redeviendra visible.",
      confirmLabel: "Réactiver l’événement",
      requiresReason: false,
      reasonLabel: "Note interne facultative",
      reasonPlaceholder:
        "Ajoutez une note interne concernant la réactivation.",
      tone: "blue",
    },
    ARCHIVE: {
      open: true,
      action,
      title: "Archiver l’événement",
      description:
        "L’événement restera dans l’historique mais ne sera plus actif.",
      confirmLabel: "Archiver l’événement",
      requiresReason: false,
      reasonLabel: "Note interne facultative",
      reasonPlaceholder:
        "Ajoutez une note interne concernant l’archivage.",
      tone: "violet",
    },
  };

  return dialogs[action];
}

export default function AdminEventDetailsPage() {
  const params = useParams<{
    id: string;
  }>();

  const eventId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [
    event,
    setEvent,
  ] = useState<AdminEventDetails | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    isSubmittingAction,
    setIsSubmittingAction,
  ] = useState(false);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState<FeedbackState>(null);

  const [
    actionDialog,
    setActionDialog,
  ] = useState<ActionDialogState>(
    CLOSED_ACTION_DIALOG,
  );

  const [
    actionReason,
    setActionReason,
  ] = useState("");

  const [
    deleteDialogOpen,
    setDeleteDialogOpen,
  ] = useState(false);

  const loadEvent =
    useCallback(
      async ({
        silent = false,
      }: {
        silent?: boolean;
      } = {}) => {
        if (!eventId) {
          setFeedback({
            type: "error",
            message:
              "L’identifiant de l’événement est invalide.",
          });
          setIsLoading(false);
          return;
        }

        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setFeedback(null);

        try {
          const response =
            await fetch(
              `/api/admin/events/${encodeURIComponent(
                eventId,
              )}`,
              {
                method: "GET",
                cache: "no-store",
                credentials:
                  "same-origin",
              },
            );

          const payload =
            await readJsonResponse<AdminEventApiResponse>(
              response,
            );

          if (!response.ok) {
            if (
              response.status ===
                401 &&
              payload.redirectTo
            ) {
              window.location.href =
                payload.redirectTo;
              return;
            }

            throw new Error(
              payload.message ||
                "Impossible de charger cet événement.",
            );
          }

          if (!payload.data?.event) {
            throw new Error(
              "Les données de l’événement sont incomplètes.",
            );
          }

          setEvent(
            payload.data.event,
          );
        } catch (error) {
          setEvent(null);

          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Impossible de charger cet événement.",
          });
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [eventId],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadEvent();
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadEvent]);

  const availableActions =
    useMemo(() => {
      if (!event) {
        return [] as AdminEventAction[];
      }

      const actionMap: Record<
        AdminEventStatus,
        AdminEventAction[]
      > = {
        DRAFT: ["ARCHIVE"],
        PENDING: [
          "APPROVE",
          "REJECT",
          "ARCHIVE",
        ],
        PUBLISHED: [
          "SUSPEND",
          "CANCEL",
          "ARCHIVE",
        ],
        REJECTED: [
          "APPROVE",
          "ARCHIVE",
        ],
        CANCELED: ["ARCHIVE"],
        SUSPENDED: [
          "RESTORE",
          "CANCEL",
          "ARCHIVE",
        ],
        ARCHIVED: [],
        COMPLETED: ["ARCHIVE"],
      };

      return actionMap[event.status];
    }, [event]);

  const canDelete =
    useMemo(() => {
      if (!event) {
        return false;
      }

      const financials =
        event.financials;

      return (
        financials.ticketsSold === 0 &&
        financials.grossRevenue === 0 &&
        financials.paidOrders === 0 &&
        financials.refundedAmount === 0
      );
    }, [event]);

  function openActionDialog(
    action: AdminEventAction,
  ) {
    setActionReason("");
    setActionDialog(
      getActionDialog(action),
    );
  }

  function closeActionDialog() {
    if (isSubmittingAction) {
      return;
    }

    setActionDialog(
      CLOSED_ACTION_DIALOG,
    );
    setActionReason("");
  }

  async function submitAction(
    submitEvent: FormEvent<HTMLFormElement>,
  ) {
    submitEvent.preventDefault();

    if (
      !actionDialog.action ||
      !event
    ) {
      return;
    }

    const normalizedReason =
      actionReason.trim();

    if (
      actionDialog.requiresReason &&
      normalizedReason.length < 10
    ) {
      setFeedback({
        type: "error",
        message:
          "Le motif doit contenir au moins 10 caractères.",
      });
      return;
    }

    setIsSubmittingAction(true);
    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/admin/events/${encodeURIComponent(
            event.id,
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            cache: "no-store",
            credentials:
              "same-origin",
            body: JSON.stringify({
              action:
                actionDialog.action,
              reason:
                normalizedReason ||
                null,
            }),
          },
        );

      const payload =
        await readJsonResponse<AdminEventApiResponse>(
          response,
        );

      if (!response.ok) {
        if (
          response.status ===
            401 &&
          payload.redirectTo
        ) {
          window.location.href =
            payload.redirectTo;
          return;
        }

        throw new Error(
          payload.message ||
            "Impossible d’appliquer cette action.",
        );
      }

      if (payload.data?.event) {
        setEvent(
          payload.data.event,
        );
      } else {
        await loadEvent({
          silent: true,
        });
      }

      setFeedback({
        type: "success",
        message:
          payload.message ||
          "L’action a été appliquée avec succès.",
      });

      setActionDialog(
        CLOSED_ACTION_DIALOG,
      );
      setActionReason("");
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d’appliquer cette action.",
      });
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function deleteEvent() {
    if (!event || !canDelete) {
      return;
    }

    setIsDeleting(true);
    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/admin/events/${encodeURIComponent(
            event.id,
          )}`,
          {
            method: "DELETE",
            cache: "no-store",
            credentials:
              "same-origin",
          },
        );

      const payload =
        await readJsonResponse<AdminEventApiResponse>(
          response,
        );

      if (!response.ok) {
        if (
          response.status ===
            401 &&
          payload.redirectTo
        ) {
          window.location.href =
            payload.redirectTo;
          return;
        }

        throw new Error(
          payload.message ||
            "Impossible de supprimer cet événement.",
        );
      }

      window.location.href =
        "/admin/events";
    } catch (error) {
      setDeleteDialogOpen(false);

      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer cet événement.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="w-full min-w-0 px-4 py-5 sm:px-5 lg:px-6 xl:px-8">
        <div className="space-y-5">
          <div className="h-40 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />

          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
            <div className="h-[620px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
            <div className="h-[620px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
          </div>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="w-full min-w-0 px-4 py-5 sm:px-5 lg:px-6 xl:px-8">
        <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-white/[0.075] bg-[#07101a] px-5 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] text-rose-300">
            <AlertCircle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-2xl font-black text-white">
            Événement introuvable
          </h1>

          <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-neutral-500">
            {feedback?.message ||
              "Cet événement n’existe pas ou vous n’avez pas l’autorisation de le consulter."}
          </p>

          <Link
            href="/admin/events"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-black text-white transition hover:bg-blue-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux événements
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-w-0 px-4 py-5 sm:px-5 lg:px-6 xl:px-8">
      <div className="flex flex-col gap-5">
        <header className="rounded-2xl border border-white/[0.075] bg-[#07101a] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link
                href="/admin/events"
                className="inline-flex items-center gap-2 text-xs font-black text-neutral-500 transition hover:text-blue-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la liste
              </Link>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={joinClassNames(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black",
                    STATUS_CLASSES[
                      event.status
                    ],
                  )}
                >
                  {
                    STATUS_LABELS[
                      event.status
                    ]
                  }
                </span>

                <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-black text-neutral-300">
                  {event.isFree
                    ? "Gratuit"
                    : "Payant"}
                </span>

                {event.isFeatured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-[11px] font-black text-violet-200">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Visibilité Premium
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 max-w-5xl text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                {event.title}
              </h1>

              <p className="mt-2 text-sm font-medium text-neutral-500">
                Identifiant :{" "}
                <span className="font-bold text-neutral-300">
                  {event.id}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row xl:flex-wrap xl:justify-end">
              <button
                type="button"
                onClick={() => {
                  void loadEvent({
                    silent: true,
                  });
                }}
                disabled={isRefreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={joinClassNames(
                    "h-4 w-4",
                    isRefreshing &&
                      "animate-spin",
                  )}
                />
                Actualiser
              </button>

              {event.isPublished ? (
                <Link
                  href={`/events/${event.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/[0.06] px-4 text-xs font-black text-blue-200 transition hover:border-blue-400/35 hover:bg-blue-400/[0.1]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Voir la page publique
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {feedback ? (
          <div
            role={
              feedback.type ===
              "error"
                ? "alert"
                : "status"
            }
            className={
              feedback.type ===
              "error"
                ? "flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm font-semibold text-rose-200"
                : "flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm font-semibold text-emerald-200"
            }
          >
            {feedback.type ===
            "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}

            <span className="flex-1">
              {feedback.message}
            </span>

            <button
              type="button"
              onClick={() => {
                setFeedback(null);
              }}
              className="text-xs font-black underline underline-offset-4"
            >
              Fermer
            </button>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={
              <TicketCheck className="h-5 w-5" />
            }
            label="Billets vendus"
            value={formatNumber(
              event.financials
                .ticketsSold,
            )}
            description={
              event.financials
                .ticketsCapacity ===
              null
                ? "Capacité illimitée"
                : `sur ${formatNumber(
                    event.financials
                      .ticketsCapacity,
                  )}`
            }
            tone="emerald"
          />

          <MetricCard
            icon={
              <CircleDollarSign className="h-5 w-5" />
            }
            label="Revenus bruts"
            value={formatMoney(
              event.financials
                .grossRevenue,
              event.financials
                .currency,
            )}
            description={`${formatNumber(
              event.financials
                .paidOrders,
            )} commande(s) payée(s)`}
            tone="blue"
          />

          <MetricCard
            icon={
              <Store className="h-5 w-5" />
            }
            label="Net organisateur"
            value={formatMoney(
              event.financials
                .organizerNetRevenue,
              event.financials
                .currency,
            )}
            description={`Commission Tikemia : ${formatMoney(
              event.financials
                .commissionAmount,
              event.financials
                .currency,
            )}`}
            tone="violet"
          />

          <MetricCard
            icon={
              <UsersRound className="h-5 w-5" />
            }
            label="Types de billets"
            value={formatNumber(
              event.ticketTypes.length,
            )}
            description={`${event.ticketTypes.filter(
              (ticketType) =>
                ticketType.isActive,
            ).length.toLocaleString(
              "fr-FR",
            )} actif(s)`}
            tone="amber"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
          <div className="space-y-5">
            <SectionCard
              title="Présentation de l’événement"
              description="Informations publiques fournies par l’organisateur."
              icon={
                <FileText className="h-5 w-5" />
              }
            >
              <div className="relative aspect-[16/8] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                {event.coverImageUrl ? (
                  <Image
                    src={event.coverImageUrl}
                    alt={event.title}
                    fill
                    sizes="(max-width: 1280px) 100vw, 900px"
                    priority
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-neutral-600">
                    <ImageIcon className="h-10 w-10" />
                    <span className="mt-3 text-xs font-bold">
                      Aucune image de couverture
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoBlock
                  label="Catégorie"
                  value={
                    event.category?.name ??
                    "Sans catégorie"
                  }
                />

                <InfoBlock
                  label="Slug public"
                  value={event.slug}
                />

                <InfoBlock
                  label="Début"
                  value={formatDateTime(
                    event.startsAt,
                  )}
                />

                <InfoBlock
                  label="Fin"
                  value={formatDateTime(
                    event.endsAt,
                  )}
                />

                <InfoBlock
                  label="Fuseau horaire"
                  value={
                    event.timezone ??
                    "Non renseigné"
                  }
                />

                <InfoBlock
                  label="Dernière modification"
                  value={formatDateTime(
                    event.updatedAt,
                  )}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.065] bg-black/15 p-4 sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-500">
                  Description courte
                </p>

                <p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-neutral-300">
                  {safeText(
                    event.shortDescription,
                    "Aucune description courte.",
                  )}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.065] bg-black/15 p-4 sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-500">
                  Description complète
                </p>

                <p className="mt-2 whitespace-pre-line text-sm font-medium leading-7 text-neutral-300">
                  {safeText(
                    event.description,
                    "Aucune description complète.",
                  )}
                </p>
              </div>
            </SectionCard>

            <SectionCard
              title="Lieu et organisation"
              description="Adresse, salle et informations géographiques."
              icon={
                <MapPin className="h-5 w-5" />
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBlock
                  label="Pays"
                  value={event.country}
                />

                <InfoBlock
                  label="Ville"
                  value={event.city}
                />

                <InfoBlock
                  label="Lieu"
                  value={
                    event.venueName ??
                    "Non renseigné"
                  }
                />

                <InfoBlock
                  label="Adresse"
                  value={
                    event.address ??
                    "Non renseignée"
                  }
                />

                <InfoBlock
                  label="Latitude"
                  value={
                    event.latitude ===
                    null
                      ? "Non renseignée"
                      : String(
                          event.latitude,
                        )
                  }
                />

                <InfoBlock
                  label="Longitude"
                  value={
                    event.longitude ===
                    null
                      ? "Non renseignée"
                      : String(
                          event.longitude,
                        )
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Billetterie"
              description="Types de billets, tarifs et progression des ventes."
              icon={
                <TicketCheck className="h-5 w-5" />
              }
            >
              {event.ticketTypes.length >
              0 ? (
                <div className="space-y-3">
                  {event.ticketTypes.map(
                    (ticketType) => (
                      <TicketTypeCard
                        key={
                          ticketType.id
                        }
                        ticketType={
                          ticketType
                        }
                      />
                    ),
                  )}
                </div>
              ) : (
                <EmptySection
                  icon={
                    <TicketCheck className="h-6 w-6" />
                  }
                  title="Aucun billet"
                  description="Aucun type de billet n’est encore associé à cet événement."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Galerie"
              description="Images supplémentaires associées à l’événement."
              icon={
                <ImageIcon className="h-5 w-5" />
              }
            >
              {event.images.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...event.images]
                    .sort(
                      (
                        first,
                        second,
                      ) =>
                        first.position -
                        second.position,
                    )
                    .map(
                      (image) => (
                        <div
                          key={
                            image.id
                          }
                          className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]"
                        >
                          <Image
                            src={image.url}
                            alt={
                              image.altText ??
                              event.title
                            }
                            fill
                            sizes="(max-width: 640px) 100vw, 320px"
                            className="object-cover"
                          />
                        </div>
                      ),
                    )}
                </div>
              ) : (
                <EmptySection
                  icon={
                    <ImageIcon className="h-6 w-6" />
                  }
                  title="Aucune galerie"
                  description="Aucune image supplémentaire n’a été ajoutée."
                />
              )}
            </SectionCard>
          </div>

          <aside className="space-y-5">
            <SectionCard
              title="Décision administrative"
              description="Validez, rejetez ou modifiez le cycle de vie de l’événement."
              icon={
                <ShieldAlert className="h-5 w-5" />
              }
            >
              <div className="space-y-2.5">
                {availableActions.includes(
                  "APPROVE",
                ) ? (
                  <ActionButton
                    icon={
                      <BadgeCheck className="h-4 w-4" />
                    }
                    label="Valider et publier"
                    description="Autoriser la publication sur Tikemia."
                    tone="emerald"
                    onClick={() => {
                      openActionDialog(
                        "APPROVE",
                      );
                    }}
                  />
                ) : null}

                {availableActions.includes(
                  "REJECT",
                ) ? (
                  <ActionButton
                    icon={
                      <XCircle className="h-4 w-4" />
                    }
                    label="Rejeter"
                    description="Demander des corrections à l’organisateur."
                    tone="rose"
                    onClick={() => {
                      openActionDialog(
                        "REJECT",
                      );
                    }}
                  />
                ) : null}

                {availableActions.includes(
                  "SUSPEND",
                ) ? (
                  <ActionButton
                    icon={
                      <PauseCircle className="h-4 w-4" />
                    }
                    label="Suspendre"
                    description="Interrompre temporairement la visibilité et les ventes."
                    tone="rose"
                    onClick={() => {
                      openActionDialog(
                        "SUSPEND",
                      );
                    }}
                  />
                ) : null}

                {availableActions.includes(
                  "RESTORE",
                ) ? (
                  <ActionButton
                    icon={
                      <RotateCcw className="h-4 w-4" />
                    }
                    label="Réactiver"
                    description="Rendre l’événement de nouveau public."
                    tone="blue"
                    onClick={() => {
                      openActionDialog(
                        "RESTORE",
                      );
                    }}
                  />
                ) : null}

                {availableActions.includes(
                  "CANCEL",
                ) ? (
                  <ActionButton
                    icon={
                      <Ban className="h-4 w-4" />
                    }
                    label="Annuler"
                    description="Marquer définitivement l’événement comme annulé."
                    tone="amber"
                    onClick={() => {
                      openActionDialog(
                        "CANCEL",
                      );
                    }}
                  />
                ) : null}

                {availableActions.includes(
                  "ARCHIVE",
                ) ? (
                  <ActionButton
                    icon={
                      <Archive className="h-4 w-4" />
                    }
                    label="Archiver"
                    description="Conserver l’événement uniquement dans l’historique."
                    tone="violet"
                    onClick={() => {
                      openActionDialog(
                        "ARCHIVE",
                      );
                    }}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setDeleteDialogOpen(
                      true,
                    );
                  }}
                  disabled={!canDelete}
                  title={
                    canDelete
                      ? "Supprimer définitivement cet événement"
                      : "La suppression est bloquée car l’événement possède déjà des ventes ou des données financières."
                  }
                  className="flex w-full items-start gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-4 text-left transition hover:border-red-400/25 hover:bg-red-400/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/[0.08] text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">
                      Supprimer
                    </p>

                    <p className="mt-1 text-xs font-medium leading-5 text-neutral-500">
                      {canDelete
                        ? "Suppression définitive autorisée car aucune vente n’est enregistrée."
                        : "Suppression bloquée : utilisez Annuler, Suspendre ou Archiver."}
                    </p>
                  </div>
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="Organisateur"
              description="Compte responsable de cet événement."
              icon={
                <Store className="h-5 w-5" />
              }
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/20 bg-blue-400/[0.08]">
                  {event.organizer
                    .avatarUrl ? (
                    <Image
                      src={
                        event.organizer
                          .avatarUrl
                      }
                      alt={
                        event.organizer
                          .name
                      }
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <UserRound className="h-6 w-6 text-blue-300" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {safeText(
                      event.organizer
                        .businessName,
                      event.organizer
                        .name,
                    )}
                  </p>

                  <p className="mt-1 truncate text-xs font-medium text-neutral-500">
                    {
                      event.organizer
                        .email
                    }
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <InfoBlock
                  label="Nom du responsable"
                  value={
                    event.organizer.name
                  }
                />

                <InfoBlock
                  label="Téléphone"
                  value={
                    event.organizer.phone ??
                    "Non renseigné"
                  }
                />

                <InfoBlock
                  label="Localisation"
                  value={[
                    event.organizer.city,
                    event.organizer
                      .country,
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                    "Non renseignée"}
                />

                <InfoBlock
                  label="Compte"
                  value={
                    event.organizer
                      .isActive
                      ? "Actif"
                      : "Désactivé"
                  }
                />

                <InfoBlock
                  label="E-mail"
                  value={
                    event.organizer
                      .emailVerified
                      ? "Vérifié"
                      : "Non vérifié"
                  }
                />
              </div>

              <Link
                href={`/admin/organizers/${event.organizer.id}`}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/[0.06] px-4 text-xs font-black text-blue-200 transition hover:border-blue-400/35 hover:bg-blue-400/[0.1]"
              >
                Voir l’organisateur
                <ExternalLink className="h-4 w-4" />
              </Link>
            </SectionCard>

            <SectionCard
              title="Modération"
              description="Historique de la dernière décision administrative."
              icon={
                <ShieldAlert className="h-5 w-5" />
              }
            >
              <div className="grid gap-3">
                <InfoBlock
                  label="Soumis le"
                  value={formatDateTime(
                    event.moderation
                      .submittedAt,
                  )}
                />

                <InfoBlock
                  label="Examiné le"
                  value={formatDateTime(
                    event.moderation
                      .reviewedAt,
                  )}
                />

                <InfoBlock
                  label="Examiné par"
                  value={
                    event.moderation
                      .reviewedBy
                      ? `${event.moderation.reviewedBy.name} · ${event.moderation.reviewedBy.email}`
                      : "Aucun administrateur"
                  }
                />
              </div>

              {event.moderation
                .rejectionReason ? (
                <ModerationReason
                  title="Raison du rejet"
                  value={
                    event.moderation
                      .rejectionReason
                  }
                  tone="rose"
                />
              ) : null}

              {event.moderation
                .suspensionReason ? (
                <ModerationReason
                  title="Raison de la suspension"
                  value={
                    event.moderation
                      .suspensionReason
                  }
                  tone="rose"
                />
              ) : null}

              {event.moderation
                .cancellationReason ? (
                <ModerationReason
                  title="Raison de l’annulation"
                  value={
                    event.moderation
                      .cancellationReason
                  }
                  tone="amber"
                />
              ) : null}

              {event.moderation
                .adminNotes ? (
                <ModerationReason
                  title="Notes internes"
                  value={
                    event.moderation
                      .adminNotes
                  }
                  tone="blue"
                />
              ) : null}
            </SectionCard>
          </aside>
        </div>
      </div>

      {actionDialog.open ? (
        <ActionDialog
          state={actionDialog}
          reason={actionReason}
          isSubmitting={
            isSubmittingAction
          }
          onReasonChange={
            setActionReason
          }
          onClose={
            closeActionDialog
          }
          onSubmit={
            submitAction
          }
        />
      ) : null}

      {deleteDialogOpen ? (
        <DeleteDialog
          eventTitle={event.title}
          canDelete={canDelete}
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) {
              setDeleteDialogOpen(
                false,
              );
            }
          }}
          onConfirm={() => {
            void deleteEvent();
          }}
        />
      ) : null}
    </main>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.075] bg-[#07101a] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/[0.08] text-blue-300">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-black tracking-[-0.02em] text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs font-medium leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
  tone:
    | "blue"
    | "emerald"
    | "violet"
    | "amber";
}) {
  const toneClasses = {
    blue:
      "border-blue-400/20 bg-blue-400/[0.08] text-blue-300",
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    violet:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    amber:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
  }[tone];

  return (
    <article className="rounded-2xl border border-white/[0.075] bg-[#07101a] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-500">
            {label}
          </p>

          <p className="mt-2 truncate text-xl font-black text-white">
            {value}
          </p>

          <p className="mt-1 text-xs font-medium leading-5 text-neutral-500">
            {description}
          </p>
        </div>

        <div
          className={joinClassNames(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            toneClasses,
          )}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.065] bg-black/15 p-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-bold leading-5 text-white">
        {value}
      </p>
    </div>
  );
}

function TicketTypeCard({
  ticketType,
}: {
  ticketType: EventTicketType;
}) {
  const percentage =
    ticketType.quantity &&
    ticketType.quantity > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (ticketType.sold /
              ticketType.quantity) *
              100,
          ),
        )
      : 0;

  return (
    <article className="rounded-2xl border border-white/[0.065] bg-black/15 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-white">
              {ticketType.name}
            </h3>

            <span
              className={
                ticketType.isActive
                  ? "rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-1 text-[10px] font-black text-emerald-200"
                  : "rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] font-black text-neutral-400"
              }
            >
              {ticketType.isActive
                ? "Actif"
                : "Inactif"}
            </span>
          </div>

          <p className="mt-1 text-xs font-medium leading-5 text-neutral-500">
            {ticketType.description ??
              "Aucune description."}
          </p>
        </div>

        <p className="text-base font-black text-white">
          {formatMoney(
            ticketType.price,
            ticketType.currency,
          )}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoBlock
          label="Vendus"
          value={formatNumber(
            ticketType.sold,
          )}
        />

        <InfoBlock
          label="Quantité"
          value={
            ticketType.quantity ===
            null
              ? "Illimitée"
              : formatNumber(
                  ticketType.quantity,
                )
          }
        />

        <InfoBlock
          label="Restants"
          value={
            ticketType.remaining ===
            null
              ? "Illimités"
              : formatNumber(
                  ticketType.remaining,
                )
          }
        />
      </div>

      {ticketType.quantity !==
      null ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold text-neutral-500">
            <span>
              Progression des ventes
            </span>

            <span className="text-neutral-300">
              {Math.round(
                percentage,
              )}
              %
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
              style={{
                width: `${percentage}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBlock
          label="Début des ventes"
          value={formatDateTime(
            ticketType.saleStartsAt,
          )}
        />

        <InfoBlock
          label="Fin des ventes"
          value={formatDateTime(
            ticketType.saleEndsAt,
          )}
        />
      </div>
    </article>
  );
}

function EmptySection({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-5 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-neutral-500">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-black text-white">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-xs font-medium leading-5 text-neutral-500">
        {description}
      </p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  description,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  tone:
    | "blue"
    | "emerald"
    | "amber"
    | "rose"
    | "violet";
  onClick: () => void;
}) {
  const toneClasses = {
    blue:
      "border-blue-400/15 bg-blue-400/[0.035] hover:border-blue-400/25 hover:bg-blue-400/[0.07]",
    emerald:
      "border-emerald-400/15 bg-emerald-400/[0.035] hover:border-emerald-400/25 hover:bg-emerald-400/[0.07]",
    amber:
      "border-amber-400/15 bg-amber-400/[0.035] hover:border-amber-400/25 hover:bg-amber-400/[0.07]",
    rose:
      "border-rose-400/15 bg-rose-400/[0.035] hover:border-rose-400/25 hover:bg-rose-400/[0.07]",
    violet:
      "border-violet-400/15 bg-violet-400/[0.035] hover:border-violet-400/25 hover:bg-violet-400/[0.07]",
  }[tone];

  const iconClasses = {
    blue:
      "border-blue-400/20 bg-blue-400/[0.08] text-blue-300",
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    amber:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    rose:
      "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
    violet:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClassNames(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
        toneClasses,
      )}
    >
      <div
        className={joinClassNames(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          iconClasses,
        )}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-black text-white">
          {label}
        </p>

        <p className="mt-1 text-xs font-medium leading-5 text-neutral-500">
          {description}
        </p>
      </div>
    </button>
  );
}

function ModerationReason({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone:
    | "blue"
    | "amber"
    | "rose";
}) {
  const classes = {
    blue:
      "border-blue-400/15 bg-blue-400/[0.045] text-blue-100",
    amber:
      "border-amber-400/15 bg-amber-400/[0.045] text-amber-100",
    rose:
      "border-rose-400/15 bg-rose-400/[0.045] text-rose-100",
  }[tone];

  return (
    <div
      className={joinClassNames(
        "mt-4 rounded-2xl border p-4",
        classes,
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
        {title}
      </p>

      <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5">
        {value}
      </p>
    </div>
  );
}

function ActionDialog({
  state,
  reason,
  isSubmitting,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  state: ActionDialogState;
  reason: string;
  isSubmitting: boolean;
  onReasonChange: (
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  const buttonClasses = {
    blue:
      "bg-blue-500 hover:bg-blue-400 text-white",
    emerald:
      "bg-emerald-500 hover:bg-emerald-400 text-[#03110b]",
    amber:
      "bg-amber-400 hover:bg-amber-300 text-[#171006]",
    rose:
      "bg-rose-500 hover:bg-rose-400 text-white",
    violet:
      "bg-violet-500 hover:bg-violet-400 text-white",
  }[state.tone];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-xl rounded-2xl border border-white/[0.09] bg-[#07101a] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">
              Décision administrative
            </p>

            <h2 className="mt-1 text-xl font-black text-white">
              {state.title}
            </h2>

            <p className="mt-2 text-sm font-medium leading-6 text-neutral-500">
              {state.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
              {state.reasonLabel}
              {state.requiresReason
                ? " *"
                : ""}
            </span>

            <textarea
              value={reason}
              onChange={(event) => {
                onReasonChange(
                  event.target.value,
                );
              }}
              placeholder={
                state.reasonPlaceholder
              }
              rows={6}
              maxLength={2000}
              disabled={isSubmitting}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 p-3.5 text-sm font-medium leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-blue-400/45 focus:ring-2 focus:ring-blue-400/10 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-medium text-neutral-600">
            <span>
              {state.requiresReason
                ? "Minimum 10 caractères."
                : "Champ facultatif."}
            </span>

            <span>
              {reason.length} / 2 000
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-sm font-black text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Fermer
          </button>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              (state.requiresReason &&
                reason.trim().length <
                  10)
            }
            className={joinClassNames(
              "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50",
              buttonClasses,
            )}
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}

            {isSubmitting
              ? "Traitement..."
              : state.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteDialog({
  eventTitle,
  canDelete,
  isDeleting,
  onClose,
  onConfirm,
}: {
  eventTitle: string;
  canDelete: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-red-400/15 bg-[#07101a] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.08] text-red-300">
          <Trash2 className="h-5 w-5" />
        </div>

        <h2 className="mt-4 text-xl font-black text-white">
          Supprimer définitivement
        </h2>

        <p className="mt-2 text-sm font-medium leading-6 text-neutral-500">
          Vous êtes sur le point de supprimer définitivement{" "}
          <strong className="text-white">
            « {eventTitle} »
          </strong>
          . Cette action ne peut pas être annulée.
        </p>

        {!canDelete ? (
          <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3.5 text-xs font-semibold leading-5 text-amber-200">
            La suppression est bloquée parce que l’événement possède déjà des ventes ou des données financières.
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-sm font-black text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={
              isDeleting ||
              !canDelete
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

            {isDeleting
              ? "Suppression..."
              : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}