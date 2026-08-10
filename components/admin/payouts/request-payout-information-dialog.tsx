"use client";

import {
  FileQuestion,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminPayoutListItem,
} from "@/lib/admin/payouts/get-admin-payouts";

const FIELD_OPTIONS = [
  {
    value:
      "IDENTITY_DOCUMENT",
    label:
      "Document d’identité",
  },
  {
    value:
      "BANK_PROOF",
    label:
      "Preuve bancaire",
  },
  {
    value:
      "MOBILE_MONEY_PROOF",
    label:
      "Justificatif Mobile Money",
  },
  {
    value:
      "ACCOUNT_CORRECTION",
    label:
      "Correction des coordonnées",
  },
  {
    value:
      "OTHER_DOCUMENT",
    label:
      "Autre document",
  },
] as const;

export default function RequestPayoutInformationDialog({
  payout,
  open,
  onClose,
  onSuccess,
}: {
  payout:
    | AdminPayoutListItem
    | null;
  open:
    boolean;
  onClose:
    () => void;
  onSuccess:
    (
      message: string,
    ) => void;
}) {
  const [
    message,
    setMessage,
  ] = useState("");

  const [
    selectedFields,
    setSelectedFields,
  ] = useState<string[]>(
    [],
  );

  const [
    responseUrl,
    setResponseUrl,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      setMessage("");
      setSelectedFields([]);
      setResponseUrl("");
      setSubmitting(false);
      setError("");
    }
  }, [
    open,
  ]);

  if (
    !open ||
    !payout
  ) {
    return null;
  }

  const currentPayout =
    payout;

  const canSubmit =
    message.trim().length >=
      10 &&
    !submitting;

  function toggleField(
    value: string,
  ) {
    setSelectedFields(
      (
        current,
      ) =>
        current.includes(
          value,
        )
          ? current.filter(
              (
                item,
              ) =>
                item !==
                value,
            )
          : [
              ...current,
              value,
            ],
    );
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/payouts/${encodeURIComponent(
            currentPayout.id,
          )}/request-information`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  message.trim(),

                requestedFields:
                  selectedFields,

                responseUrl:
                  responseUrl.trim() ||
                  null,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          success?: boolean;
          message?: string;
          error?:
            | {
                message?: string;
              }
            | string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          typeof payload.error ===
            "string"
            ? payload.error
            : payload.error?.message ||
                "Impossible d’envoyer la demande d’informations.",
        );
      }

      onSuccess(
        payload.message ||
          "La demande d’informations a été envoyée.",
      );

      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’envoyer la demande d’informations.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fermer"
        onClick={
          onClose
        }
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[24px] border border-amber-400/15 bg-[#070b0e] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] text-amber-300">
            <FileQuestion className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              submitting
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/[0.04] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-5 text-xl font-black text-white">
          Demander des informations
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          L’organisateur recevra automatiquement un e-mail avec les éléments à
          fournir.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Message *
          </span>

          <textarea
            value={
              message
            }
            onChange={(
              event,
            ) =>
              setMessage(
                event.target.value,
              )
            }
            rows={
              5
            }
            maxLength={
              2000
            }
            placeholder="Expliquez clairement ce qui manque dans le dossier."
            className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-amber-400/30"
          />
        </label>

        <div className="mt-5">
          <p className="text-xs font-bold text-neutral-400">
            Éléments demandés
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FIELD_OPTIONS.map(
              (
                option,
              ) => (
                <label
                  key={
                    option.value
                  }
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(
                      option.value,
                    )}
                    onChange={() =>
                      toggleField(
                        option.value,
                      )
                    }
                  />

                  <span className="text-sm font-semibold text-neutral-300">
                    {option.label}
                  </span>
                </label>
              ),
            )}
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold text-neutral-400">
            Lien de réponse personnalisé
          </span>

          <input
            type="url"
            value={
              responseUrl
            }
            onChange={(
              event,
            ) =>
              setResponseUrl(
                event.target.value,
              )
            }
            placeholder="https://tikemia.com/organizer/payouts"
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-amber-400/30"
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              submitting
            }
            className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={
              handleSubmit
            }
            disabled={
              !canSubmit
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileQuestion className="h-4 w-4" />
            )}

            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}