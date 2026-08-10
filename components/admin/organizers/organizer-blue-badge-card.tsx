"use client";

import {
  BadgeCheck,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

type OrganizerBlueBadgeCardProps = Readonly<{
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  hasBlueBadge: boolean;
  blueBadgeGrantedAt:
    | string
    | null;
  onUpdated?: (
    data: {
      hasBlueBadge: boolean;
      blueBadgeGrantedAt:
        | string
        | null;
    },
  ) => void;
}>;

type ApiResponse =
  | {
      success: true;
      message?: string;
      data?: {
        organizerId: string;
        organizerName: string;
        organizerEmail: string;
        hasBlueBadge: boolean;
        blueBadgeGrantedAt:
          | string
          | null;
        action:
          | "GRANT"
          | "REVOKE";
        changed: boolean;
      };
    }
  | {
      success: false;
      error?:
        | {
            code?: string;
            message?: string;
          }
        | string;
    };

function formatDate(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "Non attribué";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",
      month:
        "long",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(parsed);
}

function normalizeText(
  value: string,
): string | null {
  const normalized =
    value
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return normalized || null;
}

export default function OrganizerBlueBadgeCard({
  organizerId,
  organizerName,
  organizerEmail,
  hasBlueBadge,
  blueBadgeGrantedAt,
  onUpdated,
}: OrganizerBlueBadgeCardProps) {
  const [
    currentHasBadge,
    setCurrentHasBadge,
  ] =
    useState(
      hasBlueBadge,
    );

  const [
    currentGrantedAt,
    setCurrentGrantedAt,
  ] =
    useState<
      string | null
    >(
      blueBadgeGrantedAt,
    );

  const [
    dialogOpen,
    setDialogOpen,
  ] =
    useState(false);

  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    feedback,
    setFeedback,
  ] =
    useState<
      | {
          type:
            | "success"
            | "error";
          message: string;
        }
      | null
    >(null);

  useEffect(() => {
    setCurrentHasBadge(
      hasBlueBadge,
    );

    setCurrentGrantedAt(
      blueBadgeGrantedAt,
    );
  }, [
    hasBlueBadge,
    blueBadgeGrantedAt,
  ]);

  const action:
    | "GRANT"
    | "REVOKE" =
    currentHasBadge
      ? "REVOKE"
      : "GRANT";

  function openDialog() {
    setReason("");
    setFeedback(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (submitting) {
      return;
    }

    setDialogOpen(false);
    setReason("");
  }

  async function submitAction() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/admin/organizers/${encodeURIComponent(
            organizerId,
          )}/blue-badge`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                reason:
                  normalizeText(
                    reason,
                  ),
              }),
          },
        );

      const payload =
        (await response
          .json()
          .catch(
            () =>
              null,
          )) as
          | ApiResponse
          | null;

      if (
        !response.ok ||
        !payload ||
        !payload.success
      ) {
        const errorMessage =
          payload &&
          !payload.success
            ? typeof payload.error ===
              "string"
              ? payload.error
              : payload.error
                  ?.message
            : null;

        throw new Error(
          errorMessage ||
            "Impossible de modifier le badge bleu pour le moment.",
        );
      }

      if (
        !payload.data
      ) {
        throw new Error(
          "La réponse du serveur est incomplète.",
        );
      }

      const nextHasBadge =
        payload.data
          .hasBlueBadge;

      const nextGrantedAt =
        payload.data
          .blueBadgeGrantedAt;

      setCurrentHasBadge(
        nextHasBadge,
      );

      setCurrentGrantedAt(
        nextGrantedAt,
      );

      setFeedback({
        type:
          "success",

        message:
          payload.message ||
          (nextHasBadge
            ? "Le badge bleu Tikemia a été attribué."
            : "Le badge bleu Tikemia a été retiré."),
      });

      setDialogOpen(
        false,
      );

      setReason("");

      onUpdated?.({
        hasBlueBadge:
          nextHasBadge,

        blueBadgeGrantedAt:
          nextGrantedAt,
      });
    } catch (error) {
      setFeedback({
        type:
          "error",

        message:
          error instanceof Error
            ? error.message
            : "Impossible de modifier le badge bleu pour le moment.",
      });
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071015] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                  currentHasBadge
                    ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.08] bg-white/[0.035] text-neutral-500"
                }`}
              >
                <BadgeCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-white">
                    Badge bleu Tikemia
                  </h2>

                  {currentHasBadge ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-300">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Vérifié
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-neutral-500">
                      Non attribué
                    </span>
                  )}
                </div>

                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-neutral-500">
                  Le badge bleu indique qu’un organisateur a été vérifié manuellement par Tikemia. Il est indépendant des abonnements Premium.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={
                openDialog
              }
              disabled={
                submitting
              }
              className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                currentHasBadge
                  ? "border border-red-500/20 bg-red-500/[0.07] text-red-300 hover:bg-red-500/[0.12]"
                  : "bg-blue-500 text-white hover:bg-blue-400"
              }`}
            >
              {currentHasBadge ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}

              {currentHasBadge
                ? "Retirer le badge"
                : "Attribuer le badge"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
                Organisateur
              </p>

              <p className="mt-2 truncate text-sm font-black text-white">
                {organizerName}
              </p>

              <p className="mt-1 truncate text-xs text-neutral-500">
                {organizerEmail}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
                Date d’attribution
              </p>

              <p className="mt-2 text-sm font-bold text-neutral-300">
                {formatDate(
                  currentGrantedAt,
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

            <p className="text-[11px] leading-5 text-neutral-500">
              L’attribution ou le retrait du badge ne modifie ni les événements, ni les ventes, ni les paiements, ni les abonnements Premium de l’organisateur.
            </p>
          </div>

          {feedback ? (
            <div
              role={
                feedback.type ===
                "success"
                  ? "status"
                  : "alert"
              }
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${
                feedback.type ===
                "success"
                  ? "border-emerald-500/20 bg-emerald-500/[0.06] text-lime-300"
                  : "border-red-500/20 bg-red-500/[0.06] text-red-300"
              }`}
            >
              {feedback.type ===
              "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}

              <p className="flex-1 leading-5">
                {feedback.message}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fermer"
            onClick={
              closeDialog
            }
            className="absolute inset-0"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="blue-badge-dialog-title"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.09] bg-[#071015] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                    action ===
                    "GRANT"
                      ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
                      : "border-red-500/25 bg-red-500/10 text-red-300"
                  }`}
                >
                  {action ===
                  "GRANT" ? (
                    <BadgeCheck className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h2
                    id="blue-badge-dialog-title"
                    className="text-lg font-black tracking-[-0.025em] text-white"
                  >
                    {action ===
                    "GRANT"
                      ? "Attribuer le badge bleu"
                      : "Retirer le badge bleu"}
                  </h2>

                  <p className="mt-1.5 text-sm leading-6 text-neutral-500">
                    {action ===
                    "GRANT"
                      ? `Confirmez la vérification de ${organizerName}.`
                      : `Confirmez le retrait du badge de ${organizerName}.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeDialog
                }
                disabled={
                  submitting
                }
                aria-label="Fermer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5 sm:p-6">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-sm font-black text-white">
                  {organizerName}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  {organizerEmail}
                </p>
              </div>

              <label className="mt-5 block">
                <span className="text-xs font-bold text-neutral-400">
                  Motif administratif
                </span>

                <textarea
                  value={
                    reason
                  }
                  onChange={(
                    event,
                  ) =>
                    setReason(
                      event.target.value,
                    )
                  }
                  rows={
                    4
                  }
                  maxLength={
                    2000
                  }
                  placeholder={
                    action ===
                    "GRANT"
                      ? "Exemple : identité et activité de l’organisateur vérifiées."
                      : "Expliquez la raison du retrait si nécessaire."
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-blue-500/35"
                />
              </label>

              <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeDialog
                  }
                  disabled={
                    submitting
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={
                    submitAction
                  }
                  disabled={
                    submitting
                  }
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    action ===
                    "GRANT"
                      ? "bg-blue-500 text-white hover:bg-blue-400"
                      : "bg-red-500 text-white hover:bg-red-400"
                  }`}
                >
                  {submitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : action ===
                    "GRANT" ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}

                  {action ===
                  "GRANT"
                    ? "Confirmer l’attribution"
                    : "Confirmer le retrait"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}