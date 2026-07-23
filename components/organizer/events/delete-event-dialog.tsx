"use client";

import type { EventStatus } from "@prisma/client";
import {
  AlertTriangle,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type DeleteEventDialogProps = {
  open: boolean;
  eventId: string;
  eventTitle: string;
  eventStatus: EventStatus;
  onClose: () => void;
  onDeleted: (message?: string) => void;
};

type DeleteEventApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  warning?: string;
  redirectTo?: string;
  data?: {
    eventId: string;
    title: string;
  };
};

const deletableStatuses =
  new Set<EventStatus>([
    "DRAFT",
    "PENDING",
    "PUBLISHED",
    "REJECTED",
    "SUSPENDED",
  ]);

function getStatusLabel(
  status: DeleteEventDialogProps["eventStatus"],
): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";

    case "PENDING":
      return "En cours d’examen";

    case "PUBLISHED":
      return "Publié";

    case "SUSPENDED":
      return "Suspendu";

    case "CANCELLED":
      return "Annulé";

    case "COMPLETED":
      return "Terminé";

    case "REJECTED":
      return "Rejeté";

    case "ARCHIVED":
      return "Archivé";

    default:
      return status;
  }
}

function getBlockingMessage(
  status: DeleteEventDialogProps["eventStatus"],
): string | null {
  if (status === "CANCELLED") {
    return "Un événement annulé reste conservé dans l’historique et ne peut pas être supprimé.";
  }

  if (status === "COMPLETED") {
    return "Un événement terminé fait partie de l’historique de votre activité et ne peut pas être supprimé.";
  }

  if (status === "ARCHIVED") {
    return "Un événement archivé appartient à l’historique de votre activité et ne peut pas être supprimé depuis l’espace organisateur.";
  }

  return null;
}

export default function DeleteEventDialog(
  props: DeleteEventDialogProps,
) {
  if (!props.open) {
    return null;
  }

  return (
    <DeleteEventDialogContent
      key={`${props.eventId}-${props.eventStatus}`}
      eventId={props.eventId}
      eventTitle={props.eventTitle}
      eventStatus={props.eventStatus}
      onClose={props.onClose}
      onDeleted={props.onDeleted}
    />
  );
}

function DeleteEventDialogContent({
  eventId,
  eventTitle,
  eventStatus,
  onClose,
  onDeleted,
}: Omit<DeleteEventDialogProps, "open">) {
  const titleId = useId();
  const descriptionId = useId();

  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const canDelete =
    deletableStatuses.has(eventStatus);

  const blockingMessage =
    getBlockingMessage(eventStatus);

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusTimeout =
      window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !isDeleting
      ) {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.clearTimeout(focusTimeout);

      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isDeleting,
    onClose,
  ]);

  async function handleDelete() {
    if (
      isDeleting ||
      !canDelete ||
      !eventId.trim()
    ) {
      return;
    }

    setError("");
    setWarning("");
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/organizer/events/${encodeURIComponent(
          eventId,
        )}/delete`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      let result: DeleteEventApiResponse = {};

      try {
        result =
          (await response.json()) as DeleteEventApiResponse;
      } catch {
        result = {};
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            "Impossible de supprimer l’événement.",
        );
      }

      if (result.warning) {
        setWarning(result.warning);
      }

      onDeleted(
        result.message ??
          "L’événement a été supprimé avec succès.",
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer l’événement.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleBackdropClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (
      event.target === event.currentTarget &&
      !isDeleting
    ) {
      onClose();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full overflow-hidden rounded-t-3xl border border-white/[0.1] bg-[#071014] shadow-[0_28px_90px_rgba(0,0,0,0.65)] sm:max-w-[560px] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] bg-gradient-to-r from-red-500/[0.075] via-orange-500/[0.035] to-transparent px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>

            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
              >
                Supprimer l’événement
              </h2>

              <p
                id={descriptionId}
                className="mt-1.5 text-sm leading-6 text-neutral-500"
              >
                Cette action est définitive et ne
                pourra pas être annulée.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Fermer la fenêtre"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#050b0f] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
              Événement concerné
            </p>

            <p className="mt-2 break-words text-base font-black leading-6 text-white">
              {eventTitle}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                {getStatusLabel(eventStatus)}
              </span>

              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-neutral-600">
                {eventId}
              </span>
            </div>
          </div>

          {canDelete ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.065] p-4">
              <p className="text-sm font-bold text-red-200">
                Confirmez-vous la suppression ?
              </p>

              <p className="mt-2 text-xs leading-5 text-red-300/80">
                L’événement, ses images, ses types
                de billets et ses données associées
                seront supprimés définitivement si
                aucune commande ni aucun billet n’existe.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] p-4">
              <p className="text-sm font-bold text-orange-200">
                Suppression indisponible
              </p>

              <p className="mt-2 text-xs leading-5 text-orange-300/80">
                {blockingMessage ??
                  "Cet événement ne peut pas être supprimé dans son état actuel."}
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3.5 py-3 text-xs leading-5 text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {warning && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-orange-500/25 bg-orange-500/[0.08] px-3.5 py-3 text-xs leading-5 text-orange-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] leading-5 text-neutral-600">
              Un événement ayant déjà des
              commandes ou des billets ne sera
              jamais supprimé. L’API bloquera
              automatiquement l’opération afin de
              protéger les données des clients.
            </p>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2.5 border-t border-white/[0.07] bg-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={() => {
              void handleDelete();
            }}
            disabled={
              isDeleting || !canDelete
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/15 px-5 text-sm font-black text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Supprimer définitivement
              </>
            )}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}