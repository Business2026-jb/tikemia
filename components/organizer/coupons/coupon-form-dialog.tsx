"use client";

import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Hash,
  LoaderCircle,
  Percent,
  ShieldCheck,
  Tag,
  TicketPercent,
  Users,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";

export type CouponDiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "SERVICE_FEE";

export type CouponStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED"
  | "ARCHIVED";

export type CouponEventOption = {
  id: string;
  title: string;
  currency: string;
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type CouponCampaignOption = {
  id: string;
  eventId: string;
  name: string;
  status?: string;
};

export type EditableCoupon = {
  id: string;
  eventId: string;
  campaignId: string | null;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number | null;
  maximumDiscount: number | null;
  maximumUses: number | null;
  usesPerCustomer: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: CouponStatus;
  isActive: boolean;
};

export type CouponFormSubmitPayload = {
  eventId: string;
  campaignId: string | null;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number | null;
  maximumDiscount: number | null;
  maximumUses: number | null;
  usesPerCustomer: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: CouponStatus;
  isActive: boolean;
};

export type CouponFormDialogProps = {
  open: boolean;
  mode?: "create" | "edit";
  coupon?: EditableCoupon | null;

  events: readonly CouponEventOption[];
  campaigns?: readonly CouponCampaignOption[];

  defaultCurrency?: string;

  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  fieldErrors?: Record<string, string[] | string | undefined>;

  onClose: () => void;
  onSubmit: (
    payload: CouponFormSubmitPayload,
  ) => Promise<void> | void;
};

type FormValues = {
  eventId: string;
  campaignId: string;
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minimumOrderAmount: string;
  maximumDiscount: string;
  maximumUses: string;
  usesPerCustomer: string;
  startsAt: string;
  expiresAt: string;
  status: CouponStatus;
  isActive: boolean;
};

type LocalFieldErrors = Partial<
  Record<keyof FormValues, string>
>;

const DISCOUNT_TYPES: Array<{
  value: CouponDiscountType;
  label: string;
  description: string;
}> = [
  {
    value: "PERCENTAGE",
    label: "Pourcentage",
    description:
      "Réduit le montant de la commande selon un taux.",
  },
  {
    value: "FIXED_AMOUNT",
    label: "Montant fixe",
    description:
      "Déduit un montant précis du total de la commande.",
  },
  {
    value: "SERVICE_FEE",
    label: "Frais de service",
    description:
      "Réduit ou prend en charge les frais de service.",
  },
];

const STATUSES: Array<{
  value: CouponStatus;
  label: string;
}> = [
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
    value: "DISABLED",
    label: "Désactivé",
  },
  {
    value: "ARCHIVED",
    label: "Archivé",
  },
];

function joinClassNames(
  ...classNames: Array<
    string | false | null | undefined
  >
): string {
  return classNames
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

function toLocalDateTimeInput(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000,
  );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function fromLocalDateTimeInput(
  value: string,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function optionalNumber(
  value: string,
): number | null {
  const normalized = value
    .trim()
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function createInitialValues({
  coupon,
  events,
}: {
  coupon?: EditableCoupon | null;
  events: readonly CouponEventOption[];
}): FormValues {
  if (coupon) {
    return {
      eventId: coupon.eventId,
      campaignId:
        coupon.campaignId ?? "",
      code: coupon.code,
      description:
        coupon.description ?? "",
      discountType:
        coupon.discountType,
      discountValue:
        String(coupon.discountValue),
      minimumOrderAmount:
        coupon.minimumOrderAmount === null
          ? ""
          : String(
              coupon.minimumOrderAmount,
            ),
      maximumDiscount:
        coupon.maximumDiscount === null
          ? ""
          : String(
              coupon.maximumDiscount,
            ),
      maximumUses:
        coupon.maximumUses === null
          ? ""
          : String(coupon.maximumUses),
      usesPerCustomer:
        coupon.usesPerCustomer === null
          ? ""
          : String(
              coupon.usesPerCustomer,
            ),
      startsAt:
        toLocalDateTimeInput(
          coupon.startsAt,
        ),
      expiresAt:
        toLocalDateTimeInput(
          coupon.expiresAt,
        ),
      status: coupon.status,
      isActive: coupon.isActive,
    };
  }

  return {
    eventId:
      events.length === 1
        ? events[0]?.id ?? ""
        : "",
    campaignId: "",
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    minimumOrderAmount: "",
    maximumDiscount: "",
    maximumUses: "",
    usesPerCustomer: "1",
    startsAt: "",
    expiresAt: "",
    status: "DRAFT",
    isActive: false,
  };
}

function firstExternalError(
  errors:
    | Record<
        string,
        string[] | string | undefined
      >
    | undefined,
  field: string,
): string | null {
  const value = errors?.[field];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function FieldError({
  message,
}: {
  message?: string | null;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-rose-300">
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
      />
      {message}
    </p>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.075] bg-white/[0.018] p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-black tracking-[-0.015em] text-white">
            {title}
          </h3>

          <p className="mt-0.5 text-[11px] font-medium leading-4 text-neutral-500 sm:text-xs">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function CouponFormContent({
  mode,
  coupon,
  events,
  campaigns = [],
  defaultCurrency,
  isSubmitting,
  errorMessage,
  successMessage,
  fieldErrors,
  onClose,
  onSubmit,
}: Omit<
  CouponFormDialogProps,
  "open"
>) {
  const [values, setValues] =
    useState<FormValues>(() =>
      createInitialValues({
        coupon,
        events,
      }),
    );

  const [
    localFieldErrors,
    setLocalFieldErrors,
  ] = useState<LocalFieldErrors>({});

  const selectedEvent =
    useMemo(
      () =>
        events.find(
          (event) =>
            event.id === values.eventId,
        ) ?? null,
      [
        events,
        values.eventId,
      ],
    );

  const currency =
    normalizeCurrency(
      selectedEvent?.currency ??
        defaultCurrency,
    );

  const availableCampaigns =
    useMemo(
      () =>
        campaigns.filter(
          (campaign) =>
            campaign.eventId ===
            values.eventId,
        ),
      [
        campaigns,
        values.eventId,
      ],
    );

  const discountType =
    DISCOUNT_TYPES.find(
      (item) =>
        item.value ===
        values.discountType,
    );

  const title =
    mode === "edit"
      ? "Modifier le code promo"
      : "Créer un code promo";

  const description =
    mode === "edit"
      ? "Mettez à jour la réduction, les limites et la période de validité."
      : "Configurez une promotion claire, limitée et mesurable pour stimuler les ventes.";

  function updateValue<K extends keyof FormValues>(
    key: K,
    value: FormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    setLocalFieldErrors(
      (current) => {
        if (!current[key]) {
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

  function fieldError(
    field: keyof FormValues,
  ): string | null {
    return (
      localFieldErrors[field] ??
      firstExternalError(
        fieldErrors,
        field,
      )
    );
  }

  function validateForm(): boolean {
    const errors: LocalFieldErrors = {};

    if (!values.eventId) {
      errors.eventId =
        "Sélectionnez un événement.";
    }

    const normalizedCode =
      values.code.trim();

    if (normalizedCode.length < 3) {
      errors.code =
        "Le code promo doit contenir au moins 3 caractères.";
    } else if (
      !/^[A-Za-z0-9_-]+$/.test(
        normalizedCode,
      )
    ) {
      errors.code =
        "Utilisez uniquement des lettres, chiffres, tirets et underscores.";
    }

    const discountValue =
      optionalNumber(
        values.discountValue,
      );

    if (
      discountValue === null ||
      discountValue <= 0
    ) {
      errors.discountValue =
        "Renseignez une réduction supérieure à zéro.";
    } else if (
      values.discountType ===
        "PERCENTAGE" &&
      discountValue > 100
    ) {
      errors.discountValue =
        "Le pourcentage ne peut pas dépasser 100 %.";
    }

    const minimumOrderAmount =
      optionalNumber(
        values.minimumOrderAmount,
      );

    if (
      values.minimumOrderAmount &&
      (
        minimumOrderAmount === null ||
        minimumOrderAmount < 0
      )
    ) {
      errors.minimumOrderAmount =
        "Le montant minimum n’est pas valide.";
    }

    const maximumDiscount =
      optionalNumber(
        values.maximumDiscount,
      );

    if (
      values.maximumDiscount &&
      (
        maximumDiscount === null ||
        maximumDiscount < 0
      )
    ) {
      errors.maximumDiscount =
        "Le plafond de remise n’est pas valide.";
    }

    const maximumUses =
      optionalNumber(
        values.maximumUses,
      );

    if (
      values.maximumUses &&
      (
        maximumUses === null ||
        !Number.isInteger(maximumUses) ||
        maximumUses <= 0
      )
    ) {
      errors.maximumUses =
        "La limite totale doit être un entier supérieur à zéro.";
    }

    const usesPerCustomer =
      optionalNumber(
        values.usesPerCustomer,
      );

    if (
      values.usesPerCustomer &&
      (
        usesPerCustomer === null ||
        !Number.isInteger(
          usesPerCustomer,
        ) ||
        usesPerCustomer <= 0
      )
    ) {
      errors.usesPerCustomer =
        "La limite par client doit être un entier supérieur à zéro.";
    }

    if (
      maximumUses !== null &&
      usesPerCustomer !== null &&
      usesPerCustomer > maximumUses
    ) {
      errors.usesPerCustomer =
        "La limite par client ne peut pas dépasser la limite totale.";
    }

    if (
      values.startsAt &&
      values.expiresAt &&
      new Date(
        values.startsAt,
      ).getTime() >=
        new Date(
          values.expiresAt,
        ).getTime()
    ) {
      errors.expiresAt =
        "La date d’expiration doit être postérieure à la date de début.";
    }

    setLocalFieldErrors(errors);

    return (
      Object.keys(errors).length === 0
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      !validateForm()
    ) {
      return;
    }

    const discountValue =
      optionalNumber(
        values.discountValue,
      );

    if (discountValue === null) {
      return;
    }

    await onSubmit({
      eventId:
        values.eventId,
      campaignId:
        values.campaignId || null,
      code:
        values.code
          .trim()
          .toUpperCase(),
      description:
        values.description.trim() ||
        null,
      discountType:
        values.discountType,
      discountValue,
      minimumOrderAmount:
        optionalNumber(
          values.minimumOrderAmount,
        ),
      maximumDiscount:
        optionalNumber(
          values.maximumDiscount,
        ),
      maximumUses:
        optionalNumber(
          values.maximumUses,
        ),
      usesPerCustomer:
        optionalNumber(
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
        values.status === "ACTIVE"
          ? values.isActive
          : false,
    });
  }

  const inputClassName =
    "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm font-semibold text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50";

  const selectClassName =
    joinClassNames(
      inputClassName,
      "appearance-none pr-10",
    );

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
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
        aria-labelledby="coupon-form-dialog-title"
        className="flex max-h-[97vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/[0.09] bg-[#061014] shadow-[0_30px_100px_rgba(0,0,0,0.62)] sm:max-h-[92vh] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              <TicketPercent
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Codes promo
              </p>

              <h2
                id="coupon-form-dialog-title"
                className="mt-1 text-xl font-black tracking-[-0.03em] text-white"
              >
                {title}
              </h2>

              <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-neutral-500 sm:text-sm">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer la fenêtre"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-4 p-4 sm:p-6">
              <Section
                icon={
                  <Tag className="h-4 w-4" />
                }
                title="Informations générales"
                description="Associez le code à un événement et, si nécessaire, à une campagne."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="coupon-event-id">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Événement
                    </span>

                    <div className="relative">
                      <select
                        id="coupon-event-id"
                        value={values.eventId}
                        onChange={(event) => {
                          updateValue(
                            "eventId",
                            event.target.value,
                          );
                          updateValue(
                            "campaignId",
                            "",
                          );
                        }}
                        disabled={
                          isSubmitting ||
                          events.length === 0 ||
                          Boolean(
                            mode === "edit" &&
                              coupon,
                          )
                        }
                        className={selectClassName}
                      >
                        <option value="">
                          Sélectionner un événement
                        </option>

                        {events.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.title}
                          </option>
                        ))}
                      </select>

                      <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "eventId",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-campaign-id">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Campagne associée
                    </span>

                    <div className="relative">
                      <select
                        id="coupon-campaign-id"
                        value={values.campaignId}
                        onChange={(event) => {
                          updateValue(
                            "campaignId",
                            event.target.value,
                          );
                        }}
                        disabled={
                          isSubmitting ||
                          !values.eventId
                        }
                        className={selectClassName}
                      >
                        <option value="">
                          Sans campagne associée
                        </option>

                        {availableCampaigns.map(
                          (campaign) => (
                            <option
                              key={campaign.id}
                              value={campaign.id}
                            >
                              {campaign.name}
                            </option>
                          ),
                        )}
                      </select>

                      <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "campaignId",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-code">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Code promo
                    </span>

                    <div className="relative">
                      <Hash
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />

                      <input
                        id="coupon-code"
                        type="text"
                        value={values.code}
                        onChange={(event) => {
                          updateValue(
                            "code",
                            event.target.value
                              .toUpperCase()
                              .replace(
                                /\s+/g,
                                "",
                              ),
                          );
                        }}
                        maxLength={40}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="EX. TIKEMIA20"
                        disabled={isSubmitting}
                        className={joinClassNames(
                          inputClassName,
                          "pl-10 uppercase",
                        )}
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "code",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-status">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Statut
                    </span>

                    <div className="relative">
                      <select
                        id="coupon-status"
                        value={values.status}
                        onChange={(event) => {
                          const nextStatus =
                            event.target
                              .value as CouponStatus;

                          updateValue(
                            "status",
                            nextStatus,
                          );

                          updateValue(
                            "isActive",
                            nextStatus ===
                              "ACTIVE",
                          );
                        }}
                        disabled={isSubmitting}
                        className={selectClassName}
                      >
                        {STATUSES.map((status) => (
                          <option
                            key={status.value}
                            value={status.value}
                          >
                            {status.label}
                          </option>
                        ))}
                      </select>

                      <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "status",
                      )}
                    />
                  </label>
                </div>

                <label
                  htmlFor="coupon-description"
                  className="mt-4 block"
                >
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Description interne
                  </span>

                  <textarea
                    id="coupon-description"
                    value={values.description}
                    onChange={(event) => {
                      updateValue(
                        "description",
                        event.target.value,
                      );
                    }}
                    maxLength={1_000}
                    rows={4}
                    placeholder="Ajoutez une note interne pour identifier cette promotion."
                    disabled={isSubmitting}
                    className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm font-medium leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <div className="mt-1 flex justify-between gap-3">
                    <FieldError
                      message={fieldError(
                        "description",
                      )}
                    />

                    <span className="ml-auto text-[10px] font-bold text-neutral-600">
                      {values.description.length}
                      {" / "}
                      1 000
                    </span>
                  </div>
                </label>
              </Section>

              <Section
                icon={
                  <Percent className="h-4 w-4" />
                }
                title="Règle de réduction"
                description="Définissez le type de remise et les conditions financières."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label htmlFor="coupon-discount-type">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Type de réduction
                    </span>

                    <div className="relative">
                      <select
                        id="coupon-discount-type"
                        value={
                          values.discountType
                        }
                        onChange={(event) => {
                          updateValue(
                            "discountType",
                            event.target
                              .value as CouponDiscountType,
                          );
                        }}
                        disabled={isSubmitting}
                        className={selectClassName}
                      >
                        {DISCOUNT_TYPES.map(
                          (item) => (
                            <option
                              key={item.value}
                              value={item.value}
                            >
                              {item.label}
                            </option>
                          ),
                        )}
                      </select>

                      <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "discountType",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-discount-value">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Valeur
                    </span>

                    <div className="relative">
                      <input
                        id="coupon-discount-value"
                        type="number"
                        min="0"
                        max={
                          values.discountType ===
                          "PERCENTAGE"
                            ? "100"
                            : undefined
                        }
                        step="0.01"
                        value={
                          values.discountValue
                        }
                        onChange={(event) => {
                          updateValue(
                            "discountValue",
                            event.target.value,
                          );
                        }}
                        placeholder={
                          values.discountType ===
                          "PERCENTAGE"
                            ? "Ex. 20"
                            : `Montant en ${currency}`
                        }
                        disabled={isSubmitting}
                        className={joinClassNames(
                          inputClassName,
                          "pr-14",
                        )}
                      />

                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-500">
                        {values.discountType ===
                        "PERCENTAGE"
                          ? "%"
                          : currency}
                      </span>
                    </div>

                    <FieldError
                      message={fieldError(
                        "discountValue",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-minimum-order">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Commande minimum
                    </span>

                    <input
                      id="coupon-minimum-order"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        values.minimumOrderAmount
                      }
                      onChange={(event) => {
                        updateValue(
                          "minimumOrderAmount",
                          event.target.value,
                        );
                      }}
                      placeholder={`Montant en ${currency}`}
                      disabled={isSubmitting}
                      className={inputClassName}
                    />

                    <FieldError
                      message={fieldError(
                        "minimumOrderAmount",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-maximum-discount">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Plafond de remise
                    </span>

                    <input
                      id="coupon-maximum-discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        values.maximumDiscount
                      }
                      onChange={(event) => {
                        updateValue(
                          "maximumDiscount",
                          event.target.value,
                        );
                      }}
                      placeholder={`Montant en ${currency}`}
                      disabled={isSubmitting}
                      className={inputClassName}
                    />

                    <FieldError
                      message={fieldError(
                        "maximumDiscount",
                      )}
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.045] px-3.5 py-3 text-xs font-medium leading-5 text-cyan-100/70">
                  <CircleDollarSign
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"
                  />

                  <span>
                    {discountType?.description}
                    {" "}
                    Les montants sont exprimés en{" "}
                    <strong className="text-cyan-200">
                      {currency}
                    </strong>
                    .
                  </span>
                </div>
              </Section>

              <Section
                icon={
                  <Users className="h-4 w-4" />
                }
                title="Limites d’utilisation"
                description="Contrôlez le nombre total d’utilisations et la fréquence par client."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="coupon-maximum-uses">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Nombre maximal d’utilisations
                    </span>

                    <input
                      id="coupon-maximum-uses"
                      type="number"
                      min="1"
                      step="1"
                      value={values.maximumUses}
                      onChange={(event) => {
                        updateValue(
                          "maximumUses",
                          event.target.value,
                        );
                      }}
                      placeholder="Illimité"
                      disabled={isSubmitting}
                      className={inputClassName}
                    />

                    <FieldError
                      message={fieldError(
                        "maximumUses",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-uses-per-customer">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Utilisations par client
                    </span>

                    <input
                      id="coupon-uses-per-customer"
                      type="number"
                      min="1"
                      step="1"
                      value={
                        values.usesPerCustomer
                      }
                      onChange={(event) => {
                        updateValue(
                          "usesPerCustomer",
                          event.target.value,
                        );
                      }}
                      placeholder="Ex. 1"
                      disabled={isSubmitting}
                      className={inputClassName}
                    />

                    <FieldError
                      message={fieldError(
                        "usesPerCustomer",
                      )}
                    />
                  </label>
                </div>
              </Section>

              <Section
                icon={
                  <CalendarDays className="h-4 w-4" />
                }
                title="Période de validité"
                description="Programmez le début et la fin de la promotion."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="coupon-starts-at">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Date de début
                    </span>

                    <div className="relative">
                      <Clock3
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />

                      <input
                        id="coupon-starts-at"
                        type="datetime-local"
                        value={values.startsAt}
                        onChange={(event) => {
                          updateValue(
                            "startsAt",
                            event.target.value,
                          );
                        }}
                        disabled={isSubmitting}
                        className={joinClassNames(
                          inputClassName,
                          "pl-10",
                        )}
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "startsAt",
                      )}
                    />
                  </label>

                  <label htmlFor="coupon-expires-at">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Date d’expiration
                    </span>

                    <div className="relative">
                      <Clock3
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                      />

                      <input
                        id="coupon-expires-at"
                        type="datetime-local"
                        value={values.expiresAt}
                        min={
                          values.startsAt ||
                          undefined
                        }
                        onChange={(event) => {
                          updateValue(
                            "expiresAt",
                            event.target.value,
                          );
                        }}
                        disabled={isSubmitting}
                        className={joinClassNames(
                          inputClassName,
                          "pl-10",
                        )}
                      />
                    </div>

                    <FieldError
                      message={fieldError(
                        "expiresAt",
                      )}
                    />
                  </label>
                </div>

                {values.status === "ACTIVE" ? (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] p-3.5">
                    <input
                      type="checkbox"
                      checked={values.isActive}
                      onChange={(event) => {
                        updateValue(
                          "isActive",
                          event.target.checked,
                        );
                      }}
                      disabled={isSubmitting}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-400"
                    />

                    <span>
                      <span className="block text-sm font-bold text-white">
                        Autoriser immédiatement ce code
                      </span>

                      <span className="mt-0.5 block text-xs font-medium leading-5 text-neutral-500">
                        Le code sera utilisable si sa période de validité et ses limites le permettent.
                      </span>
                    </span>
                  </label>
                ) : null}
              </Section>

              {errorMessage ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm font-semibold text-rose-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm font-semibold text-emerald-200"
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  {successMessage}
                </div>
              ) : null}

              {events.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm font-semibold text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Vous devez créer au moins un événement avant de pouvoir créer un code promo.
                </div>
              ) : null}
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#061014]/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Les limites et l’appartenance de l’événement sont vérifiées par l’API.
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-bold text-white transition hover:border-white/[0.16] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  events.length === 0
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-[#03110b] shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <Check
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                )}

                {isSubmitting
                  ? "Enregistrement..."
                  : mode === "edit"
                    ? "Enregistrer les modifications"
                    : "Créer le code promo"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default function CouponFormDialog({
  open,
  mode = "create",
  coupon = null,
  events,
  campaigns = [],
  defaultCurrency = "XOF",
  isSubmitting = false,
  errorMessage = null,
  successMessage = null,
  fieldErrors,
  onClose,
  onSubmit,
}: CouponFormDialogProps) {
  if (!open) {
    return null;
  }

  /*
   * La clé recrée proprement le formulaire à chaque changement
   * de mode ou de code promo, sans setState synchrone dans useEffect.
   */
  const formKey = [
    mode,
    coupon?.id ?? "new",
    events
      .map((event) => event.id)
      .join(","),
  ].join(":");

  return (
    <CouponFormContent
      key={formKey}
      mode={mode}
      coupon={coupon}
      events={events}
      campaigns={campaigns}
      defaultCurrency={defaultCurrency}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      successMessage={successMessage}
      fieldErrors={fieldErrors}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}