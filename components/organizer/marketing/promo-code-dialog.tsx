"use client";

import type { PromoCodeStatus } from "@prisma/client";
import {
  BadgePercent,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Loader2,
  Save,
  ShieldCheck,
  Tag,
  TicketPercent,
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
  OrganizerMarketingPromoCodeItem,
} from "@/lib/organizer/get-organizer-marketing";

export type PromoCodeDialogMode =
  | "create"
  | "edit";

export type PromoCodeDiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "FREE_SERVICE_FEE";

export type PromoCodeFormValues = {
  eventId: string;
  campaignId: string;
  code: string;
  description: string;
  discountType: PromoCodeDiscountType;
  discountValue: string;
  minimumOrderAmount: string;
  maximumDiscount: string;
  maximumUses: string;
  usesPerCustomer: string;
  startsAt: string;
  expiresAt: string;
  status: PromoCodeStatus;
  isActive: boolean;
};

export type PromoCodeSubmitPayload = {
  eventId: string;
  campaignId: string | null;
  code: string;
  description: string | null;
  discountType: PromoCodeDiscountType;
  discountValue: number;
  minimumOrderAmount: number | null;
  maximumDiscount: number | null;
  maximumUses: number | null;
  usesPerCustomer: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: PromoCodeStatus;
  isActive: boolean;
};

export type PromoCodeDialogProps = {
  open: boolean;
  mode?: PromoCodeDialogMode;
  promoCode?: OrganizerMarketingPromoCodeItem | null;

  events:
    readonly OrganizerMarketingEventOption[];

  campaigns?:
    readonly OrganizerMarketingCampaignItem[];

  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;

  currency?: string;

  onClose:
    () => void;

  onSubmit:
    (
      payload: PromoCodeSubmitPayload,
    ) => Promise<void> | void;
};

type SelectOption = {
  value: string;
  label: string;
};

type FieldErrors = Partial<
  Record<
    keyof PromoCodeFormValues,
    string
  >
>;

const DISCOUNT_TYPE_OPTIONS:
  readonly SelectOption[] = [
    {
      value: "PERCENTAGE",
      label: "Pourcentage",
    },
    {
      value: "FIXED_AMOUNT",
      label: "Montant fixe",
    },
    {
      value: "FREE_SERVICE_FEE",
      label: "Frais de service offerts",
    },
  ];

const STATUS_OPTIONS:
  readonly SelectOption[] = [
    {
      value: "DRAFT",
      label: "Brouillon",
    },
    {
      value: "SCHEDULED",
      label: "Programmé",
    },
    {
      value: "ACTIVE",
      label: "Actif",
    },
    {
      value: "EXPIRED",
      label: "Expiré",
    },
    {
      value: "DISABLED",
      label: "Désactivé",
    },
    {
      value: "ARCHIVED",
      label: "Archivé",
    },
  ];

function cn(
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

function parseOptionalNumber(
  value: string,
): number | null {
  const normalized =
    value
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseOptionalInteger(
  value: string,
): number | null {
  const parsed =
    parseOptionalNumber(value);

  if (parsed === null) {
    return null;
  }

  return Number.isInteger(parsed)
    ? parsed
    : null;
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
    .slice(0, 16);
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

function createEmptyValues({
  events,
}: {
  events:
    readonly OrganizerMarketingEventOption[];
}): PromoCodeFormValues {
  return {
    eventId:
      events[0]?.id ??
      "",
    campaignId:
      "",
    code:
      "",
    description:
      "",
    discountType:
      "PERCENTAGE",
    discountValue:
      "",
    minimumOrderAmount:
      "",
    maximumDiscount:
      "",
    maximumUses:
      "",
    usesPerCustomer:
      "1",
    startsAt:
      "",
    expiresAt:
      "",
    status:
      "DRAFT",
    isActive:
      true,
  };
}

function normalizeDiscountType(
  value: string,
): PromoCodeDiscountType {
  if (
    value === "FIXED_AMOUNT" ||
    value === "FREE_SERVICE_FEE"
  ) {
    return value;
  }

  return "PERCENTAGE";
}

function createValuesFromPromoCode(
  promoCode:
    OrganizerMarketingPromoCodeItem,
): PromoCodeFormValues {
  return {
    eventId:
      promoCode.eventId,
    campaignId:
      promoCode.campaignId ??
      "",
    code:
      promoCode.code,
    description:
      promoCode.description ??
      "",
    discountType:
      normalizeDiscountType(
        promoCode.discountType,
      ),
    discountValue:
      String(
        promoCode.discountValue,
      ),
    minimumOrderAmount:
      promoCode.minimumOrderAmount ===
      null
        ? ""
        : String(
            promoCode.minimumOrderAmount,
          ),
    maximumDiscount:
      promoCode.maximumDiscount ===
      null
        ? ""
        : String(
            promoCode.maximumDiscount,
          ),
    maximumUses:
      promoCode.maximumUses ===
      null
        ? ""
        : String(
            promoCode.maximumUses,
          ),
    usesPerCustomer:
      promoCode.usesPerCustomer ===
      null
        ? ""
        : String(
            promoCode.usesPerCustomer,
          ),
    startsAt:
      toLocalDateTimeInput(
        promoCode.startsAt,
      ),
    expiresAt:
      toLocalDateTimeInput(
        promoCode.expiresAt,
      ),
    status:
      promoCode.status,
    isActive:
      promoCode.isActive,
  };
}

function fieldClassName(
  hasError = false,
): string {
  return cn(
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
  error?: string;
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
          className={cn(
            fieldClassName(
              Boolean(error),
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
                  option.value ||
                  "empty"
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

function PromoCodeDialogContent({
  mode = "create",
  promoCode = null,
  events,
  campaigns = [],
  isSubmitting = false,
  errorMessage = null,
  successMessage = null,
  currency = "XOF",
  onClose,
  onSubmit,
}: PromoCodeDialogProps) {
  const isEditMode =
    mode === "edit";

  const [
    values,
    setValues,
  ] =
    useState<PromoCodeFormValues>(
      () =>
        isEditMode &&
        promoCode
          ? createValuesFromPromoCode(
              promoCode,
            )
          : createEmptyValues({
              events,
            }),
    );

  const [
    fieldErrors,
    setFieldErrors,
  ] =
    useState<FieldErrors>({});

  useEffect(
    () => {
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

  const campaignOptions =
    useMemo<
      SelectOption[]
    >(
      () => [
        {
          value:
            "",
          label:
            "Sans campagne associée",
        },
        ...campaigns
          .filter(
            (
              campaignItem,
            ) =>
              !values.eventId ||
              campaignItem.eventId ===
                values.eventId,
          )
          .map(
            (
              campaignItem,
            ) => ({
              value:
                campaignItem.id,
              label:
                campaignItem.name,
            }),
          ),
      ],
      [
        campaigns,
        values.eventId,
      ],
    );

  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase() ||
    "XOF";

  const title =
    isEditMode
      ? "Modifier le code promo"
      : "Créer un code promo";

  const description =
    isEditMode
      ? "Mettez à jour les règles, limites et dates de validité de cette promotion."
      : "Configurez une promotion claire, limitée et mesurable pour stimuler les ventes.";

  function updateValue<
    Key extends keyof PromoCodeFormValues,
  >(
    key: Key,
    value:
      PromoCodeFormValues[Key],
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
      FieldErrors = {};

    const normalizedCode =
      values.code
        .trim()
        .toUpperCase();

    if (
      !values.eventId
    ) {
      errors.eventId =
        "Sélectionnez un événement.";
    }

    if (
      normalizedCode.length <
      3
    ) {
      errors.code =
        "Le code doit contenir au moins 3 caractères.";
    } else if (
      normalizedCode.length >
      40
    ) {
      errors.code =
        "Le code ne peut pas dépasser 40 caractères.";
    } else if (
      !/^[A-Z0-9_-]+$/.test(
        normalizedCode,
      )
    ) {
      errors.code =
        "Utilisez uniquement des lettres, chiffres, tirets ou underscores.";
    }

    if (
      values.description.length >
      1_000
    ) {
      errors.description =
        "La description ne peut pas dépasser 1 000 caractères.";
    }

    const discountValue =
      parseOptionalNumber(
        values.discountValue,
      );

    if (
      values.discountType ===
        "FREE_SERVICE_FEE"
    ) {
      // La valeur est ignorée pour ce type.
    } else if (
      discountValue ===
        null ||
      discountValue <=
        0
    ) {
      errors.discountValue =
        "Saisissez une valeur de réduction supérieure à zéro.";
    }

    if (
      values.discountType ===
        "PERCENTAGE" &&
      discountValue !==
        null &&
      discountValue >
        100
    ) {
      errors.discountValue =
        "Le pourcentage ne peut pas dépasser 100 %.";
    }

    const minimumOrderAmount =
      parseOptionalNumber(
        values.minimumOrderAmount,
      );

    if (
      values.minimumOrderAmount.trim() &&
      (
        minimumOrderAmount ===
          null ||
        minimumOrderAmount <
          0
      )
    ) {
      errors.minimumOrderAmount =
        "Le montant minimum doit être valide et positif.";
    }

    const maximumDiscount =
      parseOptionalNumber(
        values.maximumDiscount,
      );

    if (
      values.maximumDiscount.trim() &&
      (
        maximumDiscount ===
          null ||
        maximumDiscount <=
          0
      )
    ) {
      errors.maximumDiscount =
        "Le plafond de remise doit être supérieur à zéro.";
    }

    const maximumUses =
      parseOptionalInteger(
        values.maximumUses,
      );

    if (
      values.maximumUses.trim() &&
      (
        maximumUses ===
          null ||
        maximumUses <=
          0
      )
    ) {
      errors.maximumUses =
        "La limite globale doit être un entier supérieur à zéro.";
    }

    const usesPerCustomer =
      parseOptionalInteger(
        values.usesPerCustomer,
      );

    if (
      values.usesPerCustomer.trim() &&
      (
        usesPerCustomer ===
          null ||
        usesPerCustomer <=
          0
      )
    ) {
      errors.usesPerCustomer =
        "La limite par client doit être un entier supérieur à zéro.";
    }

    if (
      maximumUses !==
        null &&
      usesPerCustomer !==
        null &&
      usesPerCustomer >
        maximumUses
    ) {
      errors.usesPerCustomer =
        "La limite par client ne peut pas dépasser la limite globale.";
    }

    if (
      values.status ===
        "SCHEDULED" &&
      !values.startsAt
    ) {
      errors.startsAt =
        "Un code programmé doit avoir une date de début.";
    }

    if (
      values.startsAt &&
      values.expiresAt
    ) {
      const startsAt =
        new Date(
          values.startsAt,
        );

      const expiresAt =
        new Date(
          values.expiresAt,
        );

      if (
        expiresAt.getTime() <=
        startsAt.getTime()
      ) {
        errors.expiresAt =
          "La date d’expiration doit être postérieure à la date de début.";
      }
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
      PromoCodeSubmitPayload = {
      eventId:
        values.eventId,
      campaignId:
        values.campaignId ||
        null,
      code:
        values.code
          .trim()
          .toUpperCase(),
      description:
        normalizeText(
          values.description,
        ) ||
        null,
      discountType:
        values.discountType,
      discountValue:
        values.discountType ===
        "FREE_SERVICE_FEE"
          ? 0
          : parseOptionalNumber(
              values.discountValue,
            ) ??
            0,
      minimumOrderAmount:
        parseOptionalNumber(
          values.minimumOrderAmount,
        ),
      maximumDiscount:
        values.discountType ===
        "PERCENTAGE"
          ? parseOptionalNumber(
              values.maximumDiscount,
            )
          : null,
      maximumUses:
        parseOptionalInteger(
          values.maximumUses,
        ),
      usesPerCustomer:
        parseOptionalInteger(
          values.usesPerCustomer,
        ),
      startsAt:
        fromLocalDateTimeInput(
          values.startsAt,
        ),
      expiresAt:
        fromLocalDateTimeInput(
          values.expiresAt,
        ),
      status:
        values.status,
      isActive:
        values.isActive,
    };

    await onSubmit(
      payload,
    );
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
        aria-labelledby="promo-code-dialog-title"
        className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/[0.09] bg-[#061014] shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:max-h-[92vh] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              <TicketPercent className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Marketing
              </p>

              <h2
                id="promo-code-dialog-title"
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
                    <Tag className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Informations générales
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Associez le code à un événement et, si nécessaire, à une campagne.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormSelect
                    id="promo-code-event"
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
                      setValues(
                        (
                          current,
                        ) => ({
                          ...current,
                          eventId:
                            value,
                          campaignId:
                            "",
                        }),
                      );
                    }}
                  />

                  <FormSelect
                    id="promo-code-campaign"
                    label="Campagne associée"
                    value={
                      values.campaignId
                    }
                    options={
                      campaignOptions
                    }
                    disabled={
                      isSubmitting
                    }
                    onChange={(
                      value,
                    ) => {
                      updateValue(
                        "campaignId",
                        value,
                      );
                    }}
                  />

                  <label
                    htmlFor="promo-code-value"
                    className="min-w-0"
                  >
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Code promo
                    </span>

                    <input
                      id="promo-code-value"
                      type="text"
                      value={
                        values.code
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "code",
                          event.target.value.toUpperCase(),
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      maxLength={
                        40
                      }
                      autoComplete="off"
                      placeholder="EX. TIKEMIA20"
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.code,
                          ),
                        )
                      }
                    />

                    {fieldErrors.code && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.code
                        }
                      </p>
                    )}
                  </label>

                  <FormSelect
                    id="promo-code-status"
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
                        value as PromoCodeStatus,
                      );
                    }}
                  />
                </div>

                <label
                  htmlFor="promo-code-description"
                  className="mt-4 block"
                >
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Description interne
                  </span>

                  <textarea
                    id="promo-code-description"
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
                      1_000
                    }
                    rows={
                      4
                    }
                    placeholder="Ajoutez une note interne pour identifier cette promotion."
                    className={cn(
                      fieldClassName(
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
                      / 1 000
                    </span>
                  </div>
                </label>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/[0.07] text-amber-300">
                    <BadgePercent className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Règle de réduction
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Définissez le type de remise et les conditions financières.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FormSelect
                    id="promo-code-discount-type"
                    label="Type de réduction"
                    value={
                      values.discountType
                    }
                    options={
                      DISCOUNT_TYPE_OPTIONS
                    }
                    disabled={
                      isSubmitting
                    }
                    onChange={(
                      value,
                    ) => {
                      updateValue(
                        "discountType",
                        value as PromoCodeDiscountType,
                      );
                    }}
                  />

                  <label htmlFor="promo-code-discount-value">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Valeur
                    </span>

                    <input
                      id="promo-code-discount-value"
                      type="text"
                      inputMode="decimal"
                      value={
                        values.discountValue
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "discountValue",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting ||
                        values.discountType ===
                          "FREE_SERVICE_FEE"
                      }
                      placeholder={
                        values.discountType ===
                        "PERCENTAGE"
                          ? "Ex. 20"
                          : "Ex. 5000"
                      }
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.discountValue,
                          ),
                        )
                      }
                    />

                    {fieldErrors.discountValue && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.discountValue
                        }
                      </p>
                    )}
                  </label>

                  <label htmlFor="promo-code-minimum-order">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Commande minimum
                    </span>

                    <input
                      id="promo-code-minimum-order"
                      type="text"
                      inputMode="decimal"
                      value={
                        values.minimumOrderAmount
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "minimumOrderAmount",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      placeholder={`Montant en ${normalizedCurrency}`}
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.minimumOrderAmount,
                          ),
                        )
                      }
                    />

                    {fieldErrors.minimumOrderAmount && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.minimumOrderAmount
                        }
                      </p>
                    )}
                  </label>

                  <label htmlFor="promo-code-maximum-discount">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Plafond de remise
                    </span>

                    <input
                      id="promo-code-maximum-discount"
                      type="text"
                      inputMode="decimal"
                      value={
                        values.maximumDiscount
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "maximumDiscount",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting ||
                        values.discountType !==
                          "PERCENTAGE"
                      }
                      placeholder={`Montant en ${normalizedCurrency}`}
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.maximumDiscount,
                          ),
                        )
                      }
                    />

                    {fieldErrors.maximumDiscount && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.maximumDiscount
                        }
                      </p>
                    )}
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300">
                    <ShieldCheck className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white">
                      Limites d’utilisation
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Contrôlez le nombre total d’utilisations et la limite par client.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="promo-code-maximum-uses">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Limite globale
                    </span>

                    <input
                      id="promo-code-maximum-uses"
                      type="number"
                      min={
                        1
                      }
                      step={
                        1
                      }
                      value={
                        values.maximumUses
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "maximumUses",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      placeholder="Illimitée"
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.maximumUses,
                          ),
                        )
                      }
                    />

                    {fieldErrors.maximumUses && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.maximumUses
                        }
                      </p>
                    )}
                  </label>

                  <label htmlFor="promo-code-uses-per-customer">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Limite par client
                    </span>

                    <input
                      id="promo-code-uses-per-customer"
                      type="number"
                      min={
                        1
                      }
                      step={
                        1
                      }
                      value={
                        values.usesPerCustomer
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "usesPerCustomer",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      placeholder="1"
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.usesPerCustomer,
                          ),
                        )
                      }
                    />

                    {fieldErrors.usesPerCustomer && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.usesPerCustomer
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
                      Période de validité
                    </h3>

                    <p className="text-xs text-neutral-500">
                      Programmez le début et l’expiration du code promo.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="promo-code-starts-at">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Date de début
                    </span>

                    <input
                      id="promo-code-starts-at"
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
                        fieldClassName(
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

                  <label htmlFor="promo-code-expires-at">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Date d’expiration
                    </span>

                    <input
                      id="promo-code-expires-at"
                      type="datetime-local"
                      value={
                        values.expiresAt
                      }
                      min={
                        values.startsAt ||
                        undefined
                      }
                      onChange={(
                        event,
                      ) => {
                        updateValue(
                          "expiresAt",
                          event.target.value,
                        );
                      }}
                      disabled={
                        isSubmitting
                      }
                      className={
                        fieldClassName(
                          Boolean(
                            fieldErrors.expiresAt,
                          ),
                        )
                      }
                    />

                    {fieldErrors.expiresAt && (
                      <p className="mt-1.5 text-xs font-medium text-rose-300">
                        {
                          fieldErrors.expiresAt
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
                      Code promo actif
                    </span>

                    <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                      Le statut et la période restent également pris en compte lors de la validation.
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
                  <Check className="h-4 w-4 shrink-0" />
                  {successMessage}
                </div>
              )}

              {events.length ===
                0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm font-semibold text-amber-200">
                  Vous devez créer au moins un événement avant de pouvoir créer un code promo.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#071014] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="inline-flex items-center gap-2 text-xs text-neutral-500">
              <CircleDollarSign className="h-4 w-4 text-emerald-400" />
              Les montants sont exprimés en{" "}
              {normalizedCurrency}.
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
                      : "Créer le code promo"}
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

export default function PromoCodeDialog(
  props:
    PromoCodeDialogProps,
) {
  if (!props.open) {
    return null;
  }

  const mode =
    props.mode ??
    "create";

  const promoCodeKey =
    props.promoCode?.id ??
    "new";

  const eventsKey =
    props.events
      .map(
        (
          event,
        ) =>
          event.id,
      )
      .join("|");

  const campaignsKey =
    (
      props.campaigns ??
      []
    )
      .map(
        (
          campaign,
        ) =>
          campaign.id,
      )
      .join("|");

  const formKey = [
    mode,
    promoCodeKey,
    eventsKey,
    campaignsKey,
  ].join(":");

  return (
    <PromoCodeDialogContent
      key={
        formKey
      }
      {...props}
    />
  );
}