"use client";

import {
  AlertCircle,
  CircleHelp,
  Clock3,
  Info,
} from "lucide-react";

import OrganizerPayoutInformationForm from "@/components/organizer/payouts/organizer-payout-information-form";

export type PayoutInformationRequestCardProps = {
  payoutId: string;
  message:
    | string
    | null
    | undefined;
  reference?:
    | string
    | null;
  requestedAt?:
    | string
    | Date
    | null;
  requestedInformation?: readonly string[];
  disabled?: boolean;
  onSuccess?: () => void | Promise<void>;
};

function normalizeRequestMessage(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    value
      ?.replace(
        "[INFORMATION_REQUIRED]",
        "",
      )
      .split(
        "[ORGANIZER_RESPONSE]",
      )[0]
      ?.trim() ??
    "";

  return normalized;
}

function formatDate(
  value:
    | string
    | Date
    | null
    | undefined,
): string | null {
  if (
    !value
  ) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          value,
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  ).format(
    date,
  );
}

export default function PayoutInformationRequestCard({
  payoutId,
  message,
  reference = null,
  requestedAt = null,
  requestedInformation = [],
  disabled = false,
  onSuccess,
}: PayoutInformationRequestCardProps) {
  const requestMessage =
    normalizeRequestMessage(
      message,
    );

  const formattedRequestedAt =
    formatDate(
      requestedAt,
    );

  if (
    !payoutId.trim() ||
    !requestMessage
  ) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-amber-400/20 bg-[#090d0f] shadow-xl">
      <div className="border-b border-amber-400/10 bg-amber-400/[0.045] px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-amber-300">
            <CircleHelp className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                Action requise
              </p>

              <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] font-bold text-amber-200">
                Retrait
              </span>
            </div>

            <h2 className="mt-1 text-lg font-black tracking-tight text-white">
              Informations supplémentaires demandées
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              L’administration Tikemia a besoin de précisions avant de pouvoir poursuivre le traitement de cette demande.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-neutral-500">
                Message de l’administration
              </p>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                {
                  requestMessage
                }
              </p>
            </div>
          </div>
        </div>

        {(reference ||
          formattedRequestedAt) ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-neutral-500">
            {reference ? (
              <span>
                Référence{" "}
                <strong className="font-bold text-neutral-300">
                  {
                    reference
                  }
                </strong>
              </span>
            ) : null}

            {formattedRequestedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />

                {
                  formattedRequestedAt
                }
              </span>
            ) : null}
          </div>
        ) : null}

        {disabled ? (
          <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-sm leading-5 text-neutral-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              Cette demande ne peut plus être modifiée.
            </span>
          </div>
        ) : (
          <OrganizerPayoutInformationForm
            payoutId={
              payoutId
            }
            requestedInformation={
              requestedInformation
            }
            onSuccess={
              onSuccess
            }
          />
        )}
      </div>
    </section>
  );
}
