"use client";

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Send,
} from "lucide-react";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type OrganizerPayoutInformationFormProps = {
  payoutId: string;
  requestedInformation?: readonly string[];
  disabled?: boolean;
  onSuccess?: () => void | Promise<void>;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  data?: {
    payoutId?: string;
    reference?: string | null;
    status?: string;
    message?: string;
    providedFields?: string[];
    respondedAt?: string;
  };
};

const MAX_MESSAGE_LENGTH = 4000;

export default function OrganizerPayoutInformationForm({
  payoutId,
  requestedInformation = [],
  disabled = false,
  onSuccess,
}: OrganizerPayoutInformationFormProps) {
  const [message, setMessage] =
    useState("");

  const [selectedFields, setSelectedFields] =
    useState<string[]>([]);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const normalizedPayoutId =
    payoutId.trim();

  const normalizedRequestedInformation =
    useMemo(
      () =>
        Array.from(
          new Set(
            requestedInformation
              .map((item) =>
                item
                  .replace(/\s+/g, " ")
                  .trim(),
              )
              .filter(Boolean),
          ),
        ).slice(0, 20),
      [requestedInformation],
    );

  const normalizedMessage =
    message.trim();

  const canSubmit =
    !disabled &&
    !submitting &&
    normalizedPayoutId.length > 0 &&
    normalizedMessage.length >= 10 &&
    normalizedMessage.length <=
      MAX_MESSAGE_LENGTH;

  function toggleField(
    field: string,
  ) {
    setSelectedFields(
      (current) =>
        current.includes(field)
          ? current.filter(
              (item) =>
                item !== field,
            )
          : [
              ...current,
              field,
            ],
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          `/api/organizer/payouts/${encodeURIComponent(
            normalizedPayoutId,
          )}/information`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            cache:
              "no-store",

            body:
              JSON.stringify({
                message:
                  normalizedMessage,

                providedFields:
                  selectedFields,
              }),
          },
        );

      let payload:
        ApiResponse;

      try {
        payload =
          (await response.json()) as ApiResponse;
      } catch {
        payload = {};
      }

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.error?.message ||
            payload.message ||
            "Impossible d’envoyer les informations pour le moment.",
        );
      }

      setMessage("");
      setSelectedFields([]);

      setSuccessMessage(
        payload.message ||
          "Vos informations ont été transmises à l’administration Tikemia.",
      );

      await onSuccess?.();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’envoyer les informations pour le moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-5"
    >
      {normalizedRequestedInformation.length >
      0 ? (
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-neutral-500">
            Éléments demandés
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {normalizedRequestedInformation.map(
              (field) => {
                const checked =
                  selectedFields.includes(
                    field,
                  );

                return (
                  <label
                    key={
                      field
                    }
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                      checked
                        ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                        : "border-white/[0.07] bg-black/20 hover:border-white/[0.12]",
                    ].join(
                      " ",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={
                        checked
                      }
                      disabled={
                        disabled ||
                        submitting
                      }
                      onChange={() =>
                        toggleField(
                          field,
                        )
                      }
                      className="mt-0.5 h-4 w-4 accent-emerald-500"
                    />

                    <span className="text-sm leading-5 text-neutral-300">
                      {
                        field
                      }
                    </span>
                  </label>
                );
              },
            )}
          </div>
        </div>
      ) : null}

      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-neutral-500">
          Votre réponse
        </span>

        <textarea
          value={
            message
          }
          disabled={
            disabled ||
            submitting
          }
          onChange={(
            event,
          ) => {
            setMessage(
              event.target.value,
            );

            if (
              error
            ) {
              setError(
                "",
              );
            }

            if (
              successMessage
            ) {
              setSuccessMessage(
                "",
              );
            }
          }}
          maxLength={
            MAX_MESSAGE_LENGTH
          }
          rows={
            6
          }
          placeholder="Expliquez clairement les informations demandées à l’administration Tikemia."
          className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
          <span className="text-neutral-600">
            Minimum 10 caractères.
          </span>

          <span
            className={
              message.length >
              MAX_MESSAGE_LENGTH *
                0.9
                ? "text-amber-300"
                : "text-neutral-600"
            }
          >
            {
              message.length
            }
            /
            {
              MAX_MESSAGE_LENGTH
            }
          </span>
        </div>
      </label>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-sm leading-5 text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            {
              error
            }
          </span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3 text-sm leading-5 text-emerald-300"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            {
              successMessage
            }
          </span>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            !canSubmit
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}

          {submitting
            ? "Envoi..."
            : "Envoyer les informations"}
        </button>
      </div>
    </form>
  );
}
