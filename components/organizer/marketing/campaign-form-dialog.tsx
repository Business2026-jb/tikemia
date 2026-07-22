"use client";

import type {
  MarketingCampaignStatus,
  MarketingChannel,
  MarketingGoalType,
} from "@prisma/client";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Goal,
  Link2,
  Loader2,
  Megaphone,
  Save,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import type {
  OrganizerMarketingCampaignItem,
  OrganizerMarketingEventOption,
} from "@/lib/organizer/get-organizer-marketing";

export type CampaignFormMode =
  | "create"
  | "edit";

export type CampaignFormValues = {
  eventId: string;
  name: string;
  description: string;
  channel: MarketingChannel;
  status: MarketingCampaignStatus;
  source: string;
  medium: string;
  content: string;
  budget: string;
  currency: string;
  goalType: MarketingGoalType | "";
  goalValue: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export type CampaignFormSubmitPayload = {
  eventId: string;
  name: string;
  description: string | null;
  channel: MarketingChannel;
  status: MarketingCampaignStatus;
  source: string | null;
  medium: string | null;
  content: string | null;
  budget: number | null;
  currency: string;
  goalType: MarketingGoalType | null;
  goalValue: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export type CampaignFormDialogProps = {
  open: boolean;
  mode?: CampaignFormMode;
  campaign?: OrganizerMarketingCampaignItem | null;
  events: readonly OrganizerMarketingEventOption[];

  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;

  defaultCurrency?: string;

  onClose:
    () => void;

  onSubmit:
    (
      payload: CampaignFormSubmitPayload,
    ) => Promise<void> | void;
};

type SelectOption = {
  value: string;
  label: string;
};

const CHANNEL_OPTIONS: readonly SelectOption[] = [
  {
    value: "DIRECT",
    label: "Accès direct",
  },
  {
    value: "FACEBOOK",
    label: "Facebook",
  },
  {
    value: "INSTAGRAM",
    label: "Instagram",
  },
  {
    value: "TIKTOK",
    label: "TikTok",
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp",
  },
  {
    value: "EMAIL",
    label: "E-mail",
  },
  {
    value: "GOOGLE",
    label: "Google",
  },
  {
    value: "TELEGRAM",
    label: "Telegram",
  },
  {
    value: "LINKEDIN",
    label: "LinkedIn",
  },
  {
    value: "INFLUENCER",
    label: "Influenceur",
  },
  {
    value: "PARTNER",
    label: "Partenaire",
  },
  {
    value: "AFFILIATE",
    label: "Affiliation",
  },
  {
    value: "QR_CODE",
    label: "QR code",
  },
  {
    value: "OTHER",
    label: "Autre",
  },
];

const STATUS_OPTIONS: readonly SelectOption[] = [
  {
    value: "DRAFT",
    label: "Brouillon",
  },
  {
    value: "SCHEDULED",
    label: "Programmée",
  },
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "PAUSED",
    label: "Suspendue",
  },
  {
    value: "COMPLETED",
    label: "Terminée",
  },
  {
    value: "ARCHIVED",
    label: "Archivée",
  },
];

const GOAL_OPTIONS: readonly SelectOption[] = [
  {
    value: "",
    label: "Aucun objectif",
  },
  {
    value: "VISITS",
    label: "Nombre de visites",
  },
  {
    value: "ORDERS",
    label: "Nombre de commandes",
  },
  {
    value: "TICKETS",
    label: "Nombre de billets",
  },
  {
    value: "REVENUE",
    label: "Chiffre d’affaires",
  },
  {
    value: "CONVERSION",
    label: "Taux de conversion",
  },
];

function joinClassNames(
  ...values:
    Array<
      string |
      false |
      null |
      undefined
    >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function toLocalDateTimeInput(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const timezoneOffset =
    date.getTimezoneOffset() *
    60_000;

  return new Date(
    date.getTime() -
      timezoneOffset,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}

function fromLocalDateTimeInput(
  value: string,
): string | null {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function parseOptionalNumber(
  value: string,
): number | null {
  const normalized =
    value
      .trim()
      .replace(
        /\s/g,
        "",
      )
      .replace(
        ",",
        ".",
      );

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(normalized);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function createEmptyValues(
  defaultCurrency:
    string,
  events:
    readonly OrganizerMarketingEventOption[],
): CampaignFormValues {
  return {
    eventId:
      events[0]?.id ??
      "",
    name:
      "",
    description:
      "",
    channel:
      "WHATSAPP",
    status:
      "DRAFT",
    source:
      "",
    medium:
      "",
    content:
      "",
    budget:
      "",
    currency:
      defaultCurrency,
    goalType:
      "",
    goalValue:
      "",
    startsAt:
      "",
    endsAt:
      "",
    isActive:
      true,
  };
}

function createValuesFromCampaign({
  campaign,
  defaultCurrency,
}: {
  campaign:
    OrganizerMarketingCampaignItem;
  defaultCurrency:
    string;
}): CampaignFormValues {
  return {
    eventId:
      campaign.eventId,
    name:
      campaign.name,
    description:
      campaign.description ??
      "",
    channel:
      campaign.channel,
    status:
      campaign.status,
    source:
      campaign.source ??
      "",
    medium:
      campaign.medium ??
      "",
    content:
      campaign.content ??
      "",
    budget:
      campaign.budget ===
      null
        ? ""
        : String(
            campaign.budget,
          ),
    currency:
      campaign.currency ||
      defaultCurrency,
    goalType:
      (
        campaign.goalType as
          | MarketingGoalType
          | null
      ) ??
      "",
    goalValue:
      campaign.goalValue ===
      null
        ? ""
        : String(
            campaign.goalValue,
          ),
    startsAt:
      toLocalDateTimeInput(
        campaign.startsAt,
      ),
    endsAt:
      toLocalDateTimeInput(
        campaign.endsAt,
      ),
    isActive:
      campaign.isActive,
  };
}

function getFieldClassName(
  hasError =
    false,
): string {
  return joinClassNames(
    "h-11 w-full rounded-xl border bg-[#0a1216] px-3 text-sm font-semibold text-neutral-200 outline-none transition placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-60",
    hasError
      ? "border-rose-400/40 focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/10"
      : "border-white/[0.08] focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10",
  );
}

function FormSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  options:
    readonly SelectOption[];
  onChange:
    (
      value: string,
    ) => void;
  disabled:
    boolean;
  error?:
    string;
}) {
  return (
    <label
      htmlFor={id}
      className="min-w-0"
    >
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </span>

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(
            event,
          ) => {
            onChange(
              event.target.value,
            );
          }}
          disabled={disabled}
          className={joinClassNames(
            getFieldClassName(
              Boolean(
                error,
              ),
            ),
            "appearance-none pr-9",
          )}
        >
          {options.map(
            (
              option,
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-medium text-rose-300">
          {error}
        </p>
      )}
    </label>
  );
}

export default function CampaignFormDialog({
  open,
  mode = "create",
  campaign = null,
  events,
  isSubmitting = false,
  errorMessage = null,
  successMessage = null,
  defaultCurrency = "XOF",
  onClose,
  onSubmit,
}: CampaignFormDialogProps) {
  const normalizedCurrency =
    normalizeText(
      defaultCurrency,
    )
      .toUpperCase() ||
    "XOF";

  const [
    values,
    setValues,
  ] =
    useState<CampaignFormValues>(
      createEmptyValues(
        normalizedCurrency,
        events,
      ),
    );

  const [
    fieldErrors,
    setFieldErrors,
  ] =
    useState<
      Partial<
        Record<
          keyof CampaignFormValues,
          string
        >
      >
    >({});

  useEffect(
    () => {
      if (!open) {
        return;
      }

      const timeoutId =
        window.setTimeout(() => {
          const nextValues =
            mode === "edit" &&
            campaign
              ? createValuesFromCampaign({
                  campaign,
                  defaultCurrency:
                    normalizedCurrency,
                })
              : createEmptyValues(
                  normalizedCurrency,
                  events,
                );

          setValues(nextValues);
          setFieldErrors({});
        }, 0);

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      campaign,
      events,
      mode,
      normalizedCurrency,
      open,
    ],
  );

  useEffect(
    () => {
      if (!open) {
        return;
      }

      const previousOverflow =
        document.body.style.overflow;

      document.body.style.overflow =
        "hidden";

      function handleKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key ===
            "Escape" &&
          !isSubmitting
        ) {
          onClose();
        }
      }

      window.addEventListener(
        "keydown",
        handleKeyDown,
      );

      return () => {
        document.body.style.overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          handleKeyDown,
        );
      };
    },
    [
      isSubmitting,
      onClose,
      open,
    ],
  );

  const eventOptions =
    useMemo<
      SelectOption[]
    >(
      () =>
        events.map(
          (
            event,
          ) => ({
            value:
              event.id,
            label:
              event.title,
          }),
        ),
      [
        events,
      ],
    );

  const isEditMode =
    mode ===
    "edit";

  const title =
    isEditMode
      ? "Modifier la campagne"
      : "Créer une campagne";

  const description =
    isEditMode
      ? "Mettez à jour les informations, objectifs et dates de cette campagne."
      : "Configurez une campagne suivie pour mesurer les visites, ventes et revenus générés.";

  function updateValue<
    Key extends keyof CampaignFormValues,
  >(
    key:
      Key,
    value:
      CampaignFormValues[Key],
  ) {
    setValues(
      (
        current,
      ) => ({
        ...current,
        [key]:
          value,
      }),
    );

    setFieldErrors(
      (
        current,
      ) => {
        if (
          !current[key]
        ) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[key];

        return next;
      },
    );
  }

  function validateForm(): boolean {
    const errors:
      Partial<
        Record<
          keyof CampaignFormValues,
          string
        >
      > = {};

    const name =
      values.name.trim();

    if (
      !values.eventId
    ) {
      errors.eventId =
        "Sélectionnez un événement.";
    }

    if (
      name.length <
      2
    ) {
      errors.name =
        "Le nom doit contenir au moins 2 caractères.";
    }

    if (
      name.length >
      120
    ) {
      errors.name =
        "Le nom ne peut pas dépasser 120 caractères.";
    }

    if (
      values.description.length >
      1_500
    ) {
      errors.description =
        "La description ne peut pas dépasser 1 500 caractères.";
    }

    const budget =
      parseOptionalNumber(
        values.budget,
      );

    if (
      values.budget.trim() &&
      (
        budget ===
          null ||
        budget <
          0
      )
    ) {
      errors.budget =
        "Le budget doit être un montant valide et positif.";
    }

    const goalValue =
      parseOptionalNumber(
        values.goalValue,
      );

    if (
      values.goalType &&
      goalValue ===
        null
    ) {
      errors.goalValue =
        "La valeur de l’objectif est obligatoire.";
    }

    if (
      !values.goalType &&
      values.goalValue.trim()
    ) {
      errors.goalType =
        "Sélectionnez un type d’objectif.";
    }

    if (
      values.goalType ===
        "CONVERSION" &&
      goalValue !==
        null &&
      goalValue >
        100
    ) {
      errors.goalValue =
        "Le taux de conversion ne peut pas dépasser 100 %.";
    }

    if (
      values.status ===
        "SCHEDULED" &&
      !values.startsAt
    ) {
      errors.startsAt =
        "Une campagne programmée doit avoir une date de début.";
    }

    if (
      values.startsAt &&
      values.endsAt
    ) {
      const startsAt =
        new Date(
          values.startsAt,
        );

      const endsAt =
        new Date(
          values.endsAt,
        );

      if (
        endsAt.getTime() <=
        startsAt.getTime()
      ) {
        errors.endsAt =
          "La date de fin doit être postérieure à la date de début.";
      }
    }

    if (
      !/^[A-Z]{3}$/.test(
        values.currency
          .trim()
          .toUpperCase(),
      )
    ) {
      errors.currency =
        "La devise doit contenir exactement 3 lettres.";
    }

    setFieldErrors(
      errors,
    );

    return (
      Object.keys(
        errors,
      ).length ===
      0
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      !validateForm()
    ) {
      return;
    }

    const payload:
      CampaignFormSubmitPayload = {
      eventId:
        values.eventId,
      name:
        values.name.trim(),
      description:
        normalizeText(
          values.description,
        ) ||
        null,
      channel:
        values.channel,
      status:
        values.status,
      source:
        normalizeText(
          values.source,
        ) ||
        null,
      medium:
        normalizeText(
          values.medium,
        ) ||
        null,
      content:
        normalizeText(
          values.content,
        ) ||
        null,
      budget:
        parseOptionalNumber(
          values.budget,
        ),
      currency:
        values.currency
          .trim()
          .toUpperCase(),
      goalType:
        values.goalType ||
        null,
      goalValue:
        parseOptionalNumber(
          values.goalValue,
        ),
      startsAt:
        fromLocalDateTimeInput(
          values.startsAt,
        ),
      endsAt:
        fromLocalDateTimeInput(
          values.endsAt,
        ),
      isActive:
        values.isActive,
    };

    await onSubmit(
      payload,
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-form-dialog-title"
        className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/[0.09] bg-[#061014] shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:max-h-[92vh] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              <Megaphone className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Marketing
              </p>

              <h2
                id="campaign-form-dialog-title"
                className="mt-1 text-xl font-black tracking-[-0.03em] text-white"
              >
                {title}
              </h2>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500 sm:text-sm">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              isSubmitting
            }
            aria-label="Fermer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="grid gap-5">
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300">
                    <Megaphone className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Informations générales
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Définissez l’événement, le nom et le canal de promotion.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormSelect
                    id="campaign-event"
                    label="Événement"
                    value={
                      values.eventId
                    }
                    options={
                      eventOptions
                    }
                    disabled={
                      isSubmitting ||
                      events.length ===
                        0
                    }
                    error={
                      fieldErrors.eventId
                    }
                    onChange={(
                      value,
                    ) => {
                      updateValue(
                        "eventId",
                        value,
                      );
                    }}
                  />

                  <label
                    htmlFor="campaign-name"
                    className="min-w-0"
                  >
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Nom de la campagne
                    </span>

                    <input
                      id="campaign-name"
                      type="text"
                      value={
                        values.name
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "name",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      maxLength={
                        120
                      }
                      placeholder="Ex. Lancement Facebook juillet"
                      className={
                        getFieldClassName(
                          Boolean(
                            fieldErrors.name,
                          ),
                        )
                      }
                    />

                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.name
                        }
                      </p>
                    )}
                  </label>

                  <FormSelect
                    id="campaign-channel"
                    label="Canal marketing"
                    value={
                      values.channel
                    }
                    options={
                      CHANNEL_OPTIONS
                    }
                    disabled={
                      isSubmitting
                    }
                    onChange={(
                      value,
                    ) => {
                      updateValue(
                        "channel",
                        value as MarketingChannel,
                      );
                    }}
                  />

                  <FormSelect
                    id="campaign-status"
                    label="Statut"
                    value={
                      values.status
                    }
                    options={
                      STATUS_OPTIONS
                    }
                    disabled={
                      isSubmitting
                    }
                    onChange={(
                      value,
                    ) => {
                      updateValue(
                        "status",
                        value as MarketingCampaignStatus,
                      );
                    }}
                  />
                </div>

                <label
                  htmlFor="campaign-description"
                  className="mt-4 block"
                >
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Description interne
                  </span>

                  <textarea
                    id="campaign-description"
                    value={
                      values.description
                    }
                    onChange={(
                      event,
                    ) => {
                      updateValue(
                        "description",
                        event.target.value,
                      );
                    }}
                    disabled={
                      isSubmitting
                    }
                    maxLength={
                      1_500
                    }
                    rows={
                      4
                    }
                    placeholder="Ajoutez une note interne pour identifier facilement cette campagne."
                    className={joinClassNames(
                      getFieldClassName(
                        Boolean(
                          fieldErrors.description,
                        ),
                      ),
                      "h-auto min-h-28 resize-y py-3",
                    )}
                  />

                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    {fieldErrors.description ? (
                      <p className="text-xs font-medium text-rose-300">
                        {
                          fieldErrors.description
                        }
                      </p>
                    ) : (
                      <span />
                    )}

                    <span className="text-[10px] font-semibold text-neutral-600">
                      {
                        values.description.length
                      }{" "}
                      / 1 500
                    </span>
                  </div>
                </label>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300">
                    <Link2 className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Paramètres de suivi
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Ces informations seront utilisées pour identifier la provenance du trafic.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label htmlFor="campaign-source">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Source
                    </span>

                    <input
                      id="campaign-source"
                      type="text"
                      value={
                        values.source
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "source",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      maxLength={
                        80
                      }
                      placeholder="facebook"
                      className={
                        getFieldClassName()
                      }
                    />
                  </label>

                  <label htmlFor="campaign-medium">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Medium
                    </span>

                    <input
                      id="campaign-medium"
                      type="text"
                      value={
                        values.medium
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "medium",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      maxLength={
                        80
                      }
                      placeholder="social"
                      className={
                        getFieldClassName()
                      }
                    />
                  </label>

                  <label htmlFor="campaign-content">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Contenu
                    </span>

                    <input
                      id="campaign-content"
                      type="text"
                      value={
                        values.content
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "content",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      maxLength={
                        180
                      }
                      placeholder="video-lancement"
                      className={
                        getFieldClassName()
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/[0.07] text-amber-300">
                    <CircleDollarSign className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Budget et objectif
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Facultatif, mais utile pour mesurer la rentabilité de la campagne.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label htmlFor="campaign-budget">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Budget
                    </span>

                    <input
                      id="campaign-budget"
                      type="text"
                      inputMode="decimal"
                      value={
                        values.budget
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "budget",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      placeholder="0"
                      className={
                        getFieldClassName(
                          Boolean(
                            fieldErrors.budget,
                          ),
                        )
                      }
                    />

                    {fieldErrors.budget && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.budget
                        }
                      </p>
                    )}
                  </label>

                  <label htmlFor="campaign-currency">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Devise
                    </span>

                    <input
                      id="campaign-currency"
                      type="text"
                      value={
                        values.currency
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "currency",
                          event.target.value.toUpperCase(),
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      maxLength={
                        3
                      }
                      placeholder="XOF"
                      className={
                        getFieldClassName(
                          Boolean(
                            fieldErrors.currency,
                          ),
                        )
                      }
                    />

                    {fieldErrors.currency && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.currency
                        }
                      </p>
                    )}
                  </label>

                  <FormSelect
                    id="campaign-goal-type"
                    label="Type d’objectif"
                    value={
                      values.goalType
                    }
                    options={
                      GOAL_OPTIONS
                    }
                    disabled={
                      isSubmitting
                    }
                    error={
                      fieldErrors.goalType
                    }
                    onChange={(
                      value,
                    ) => {
                      updateValue(
                        "goalType",
                        value as
                          | MarketingGoalType
                          | "",
                      );
                    }}
                  />

                  <label htmlFor="campaign-goal-value">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Valeur de l’objectif
                    </span>

                    <input
                      id="campaign-goal-value"
                      type="text"
                      inputMode="decimal"
                      value={
                        values.goalValue
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "goalValue",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting ||
                        !values.goalType
                      }
                      placeholder={
                        values.goalType ===
                        "CONVERSION"
                          ? "Ex. 12,5"
                          : "Ex. 500"
                      }
                      className={
                        getFieldClassName(
                          Boolean(
                            fieldErrors.goalValue,
                          ),
                        )
                      }
                    />

                    {fieldErrors.goalValue && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.goalValue
                        }
                      </p>
                    )}
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/[0.07] text-violet-300">
                    <CalendarDays className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Planification
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Programmez la période d’activité de la campagne.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="campaign-starts-at">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Date de début
                    </span>

                    <input
                      id="campaign-starts-at"
                      type="datetime-local"
                      value={
                        values.startsAt
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "startsAt",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      className={
                        getFieldClassName(
                          Boolean(
                            fieldErrors.startsAt,
                          ),
                        )
                      }
                    />

                    {fieldErrors.startsAt && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.startsAt
                        }
                      </p>
                    )}
                  </label>

                  <label htmlFor="campaign-ends-at">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Date de fin
                    </span>

                    <input
                      id="campaign-ends-at"
                      type="datetime-local"
                      value={
                        values.endsAt
                      }
                      min={
                        values.startsAt ||
                        undefined
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "endsAt",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      className={
                        getFieldClassName(
                          Boolean(
                            fieldErrors.endsAt,
                          ),
                        )
                      }
                    />

                    {fieldErrors.endsAt && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.endsAt
                        }
                      </p>
                    )}
                  </label>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3.5">
                  <input
                    type="checkbox"
                    checked={
                      values.isActive
                    }
                    onChange={(
                      event,
                    ) => {
                      updateValue(
                        "isActive",
                        event.target.checked,
                      );
                    }}
                    disabled={
                      isSubmitting
                    }
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-400"
                  />

                  <span>
                    <span className="block text-sm font-bold text-white">
                      Campagne active
                    </span>

                    <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                      Une campagne inactive reste enregistrée, mais son suivi peut être désactivé dans les interfaces.
                    </span>
                  </span>
                </label>
              </section>

              {errorMessage && (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm font-semibold text-rose-200">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm font-semibold text-emerald-200">
                  <BadgeCheck className="h-4 w-4 shrink-0" />
                  {successMessage}
                </div>
              )}

              {events.length ===
                0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm font-semibold text-amber-200">
                  Vous devez créer au moins un événement avant de pouvoir créer une campagne marketing.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#071014] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="inline-flex items-center gap-2 text-xs text-neutral-500">
              <Goal className="h-4 w-4 text-emerald-400" />
              Les liens de suivi seront générés par l’API lors de l’enregistrement.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={
                  onClose
                }
                disabled={
                  isSubmitting
                }
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  events.length ===
                    0
                }
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400 px-5 text-sm font-black text-[#03120c] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    {isEditMode ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}

                    {isEditMode
                      ? "Enregistrer"
                      : "Créer la campagne"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}