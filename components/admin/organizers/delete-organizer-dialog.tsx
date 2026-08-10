"use client";

import {
  AlertTriangle,
  LoaderCircle,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  AdminOrganizerListItem,
} from "@/lib/admin/organizers/get-admin-organizers";

export default function DeleteOrganizerDialog({
  organizer,
  open,
  onClose,
  onSuccess,
}: {
  organizer: AdminOrganizerListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmationEmail("");
      setPermanent(false);
      setSubmitting(false);
      setError("");
    }
  }, [open]);

  if (!open || !organizer) {
    return null;
  }

  const currentOrganizer = organizer;

  const canSubmit =
    confirmationEmail.trim().toLowerCase() ===
      currentOrganizer.email.trim().toLowerCase() &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/organizers/${encodeURIComponent(
          currentOrganizer.id,
        )}/delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmationEmail: confirmationEmail.trim(),
            permanent,
          }),
        },
      );

      let payload: {
        success?: boolean;
        error?: string;
        message?: string;
      } = {};

      try {
        payload = (await response.json()) as {
          success?: boolean;
          error?: string;
          message?: string;
        };
      } catch {
        throw new Error(
          "Le serveur a renvoyé une réponse invalide.",
        );
      }

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Impossible d’effectuer cette opération.",
        );
      }

      onSuccess();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’effectuer cette opération.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-organizer-dialog-title"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <div className="relative z-10 w-full max-w-lg rounded-[24px] border border-red-400/15 bg-[#090b0c] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/[0.07] text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="delete-organizer-dialog-title"
          className="mt-5 text-xl font-black text-white"
        >
          Gérer ce compte organisateur
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Par défaut, Tikemia désactive le compte et conserve ses commandes,
          billets et données financières.
        </p>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-sm font-black text-white">
            {currentOrganizer.profile?.businessName ||
              currentOrganizer.fullName}
          </p>

          <p className="mt-1 break-all text-xs text-neutral-500">
            {currentOrganizer.email}
          </p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Confirmez avec l’adresse e-mail de l’organisateur
          </span>

          <input
            type="email"
            value={confirmationEmail}
            onChange={(event) => {
              setConfirmationEmail(event.target.value);

              if (error) {
                setError("");
              }
            }}
            placeholder={currentOrganizer.email}
            disabled={submitting}
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-red-400/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-red-400/10 bg-red-400/[0.035] p-4">
          <input
            type="checkbox"
            checked={permanent}
            onChange={(event) => {
              setPermanent(event.target.checked);

              if (error) {
                setError("");
              }
            }}
            disabled={submitting}
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-red-200">
              Demander une suppression définitive
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-600">
              Elle sera automatiquement refusée si le compte contient des
              événements, ventes, billets, retraits ou données à conserver.
            </span>
          </span>
        </label>

        {permanent ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-xs leading-5 text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              La suppression définitive est irréversible. Tikemia vérifiera
              d’abord si ce compte peut légalement et techniquement être
              supprimé.
            </span>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 flex gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

            {submitting
              ? "Traitement..."
              : permanent
                ? "Supprimer définitivement"
                : "Désactiver le compte"}
          </button>
        </div>
      </div>
    </div>
  );
}