"use client";

import {
  Globe2,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import {
  useId,
} from "react";

export type ClientGuestInformation = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
};

export type ClientGuestInformationErrors = Partial<
  Record<
    keyof ClientGuestInformation,
    string
  >
>;

export type ClientGuestCountryOption = {
  code: string;
  name: string;
  dialCode?: string;
};

export type ClientGuestInformationFormProps = {
  value: ClientGuestInformation;

  countries?: readonly ClientGuestCountryOption[];

  errors?: ClientGuestInformationErrors;

  title?: string;
  description?: string;

  disabled?: boolean;
  required?: boolean;

  className?: string;

  onChange: (
    value: ClientGuestInformation,
  ) => void;
};

const DEFAULT_COUNTRIES: readonly ClientGuestCountryOption[] = [
  {
    code: "BJ",
    name: "Bénin",
    dialCode: "+229",
  },
  {
    code: "TG",
    name: "Togo",
    dialCode: "+228",
  },
  {
    code: "CI",
    name: "Côte d’Ivoire",
    dialCode: "+225",
  },
  {
    code: "SN",
    name: "Sénégal",
    dialCode: "+221",
  },
  {
    code: "CM",
    name: "Cameroun",
    dialCode: "+237",
  },
  {
    code: "GA",
    name: "Gabon",
    dialCode: "+241",
  },
  {
    code: "GH",
    name: "Ghana",
    dialCode: "+233",
  },
  {
    code: "NG",
    name: "Nigeria",
    dialCode: "+234",
  },
  {
    code: "ML",
    name: "Mali",
    dialCode: "+223",
  },
  {
    code: "NE",
    name: "Niger",
    dialCode: "+227",
  },
  {
    code: "FR",
    name: "France",
    dialCode: "+33",
  },
  {
    code: "BE",
    name: "Belgique",
    dialCode: "+32",
  },
  {
    code: "IT",
    name: "Italie",
    dialCode: "+39",
  },
];

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeText(
  value: string,
  maxLength: number,
): string {
  return value
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeEmail(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

function normalizePhone(
  value: string,
): string {
  return value
    .replace(/[^\d+\s()-]/g, "")
    .slice(0, 30);
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (
    !message
  ) {
    return null;
  }

  return (
    <p
      id={
        id
      }
      role="alert"
      className="mt-1.5 text-xs font-semibold text-red-400"
    >
      {
        message
      }
    </p>
  );
}

export default function ClientGuestInformationForm({
  value,

  countries =
    DEFAULT_COUNTRIES,

  errors = {},

  title =
    "Vos informations",

  description =
    "Ces informations seront utilisées pour confirmer votre commande et envoyer vos billets.",

  disabled = false,
  required = true,

  className,

  onChange,
}: ClientGuestInformationFormProps) {
  const id =
    useId();

  const selectedCountry =
    countries.find(
      (
        country,
      ) =>
        country.code ===
        value.countryCode,
    ) ??
    null;

  function updateField<
    Key extends keyof ClientGuestInformation,
  >(
    key: Key,
    fieldValue: ClientGuestInformation[Key],
  ): void {
    onChange({
      ...value,

      [key]:
        fieldValue,
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "w-full rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="border-b border-white/[0.07] pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
            <UserRound
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id={`${id}-title`}
                className="text-base font-black text-white sm:text-lg"
              >
                {
                  title
                }
              </h2>

              <span className="inline-flex rounded-full border border-lime-500/20 bg-lime-500/[0.08] px-2.5 py-1 text-[10px] font-black text-lime-300">
                Invité
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-neutral-600">
              {
                description
              }
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-bold text-neutral-400">
            Prénom
          </span>

          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <input
              type="text"
              name="firstName"
              value={
                value.firstName
              }
              disabled={
                disabled
              }
              required={
                required
              }
              maxLength={
                80
              }
              autoComplete="given-name"
              aria-invalid={
                Boolean(
                  errors.firstName,
                )
              }
              aria-describedby={
                errors.firstName
                  ? `${id}-first-name-error`
                  : undefined
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "firstName",
                  normalizeText(
                    event.target.value,
                    80,
                  ),
                )
              }
              className="h-12 w-full rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Votre prénom"
            />
          </div>

          <FieldError
            id={`${id}-first-name-error`}
            message={
              errors.firstName
            }
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-bold text-neutral-400">
            Nom
          </span>

          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <input
              type="text"
              name="lastName"
              value={
                value.lastName
              }
              disabled={
                disabled
              }
              required={
                required
              }
              maxLength={
                80
              }
              autoComplete="family-name"
              aria-invalid={
                Boolean(
                  errors.lastName,
                )
              }
              aria-describedby={
                errors.lastName
                  ? `${id}-last-name-error`
                  : undefined
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "lastName",
                  normalizeText(
                    event.target.value,
                    80,
                  ),
                )
              }
              className="h-12 w-full rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Votre nom"
            />
          </div>

          <FieldError
            id={`${id}-last-name-error`}
            message={
              errors.lastName
            }
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-bold text-neutral-400">
            Email
          </span>

          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <input
              type="email"
              name="email"
              value={
                value.email
              }
              disabled={
                disabled
              }
              required={
                required
              }
              maxLength={
                254
              }
              autoComplete="email"
              inputMode="email"
              aria-invalid={
                Boolean(
                  errors.email,
                )
              }
              aria-describedby={
                errors.email
                  ? `${id}-email-error`
                  : undefined
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "email",
                  normalizeEmail(
                    event.target.value,
                  ),
                )
              }
              className="h-12 w-full rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="vous@exemple.com"
            />
          </div>

          <FieldError
            id={`${id}-email-error`}
            message={
              errors.email
            }
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-bold text-neutral-400">
            Téléphone
          </span>

          <div className="relative">
            <Phone
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <input
              type="tel"
              name="phone"
              value={
                value.phone
              }
              disabled={
                disabled
              }
              required={
                required
              }
              maxLength={
                30
              }
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={
                Boolean(
                  errors.phone,
                )
              }
              aria-describedby={
                errors.phone
                  ? `${id}-phone-error`
                  : undefined
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "phone",
                  normalizePhone(
                    event.target.value,
                  ),
                )
              }
              className="h-12 w-full rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={
                selectedCountry?.dialCode
                  ? `${selectedCountry.dialCode} ...`
                  : "Votre numéro"
              }
            />
          </div>

          <FieldError
            id={`${id}-phone-error`}
            message={
              errors.phone
            }
          />
        </label>

        <label className="block min-w-0 sm:col-span-2">
          <span className="mb-2 block text-xs font-bold text-neutral-400">
            Pays
          </span>

          <div className="relative">
            <Globe2
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <select
              name="countryCode"
              value={
                value.countryCode
              }
              disabled={
                disabled
              }
              required={
                required
              }
              aria-invalid={
                Boolean(
                  errors.countryCode,
                )
              }
              aria-describedby={
                errors.countryCode
                  ? `${id}-country-error`
                  : undefined
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "countryCode",
                  event.target.value,
                )
              }
              className="h-12 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-10 text-sm font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                Sélectionnez votre pays
              </option>

              {countries.map(
                (
                  country,
                ) => (
                  <option
                    key={
                      country.code
                    }
                    value={
                      country.code
                    }
                  >
                    {
                      country.name
                    }
                    {country.dialCode
                      ? ` (${country.dialCode})`
                      : ""}
                  </option>
                ),
              )}
            </select>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-600"
            >
              ▾
            </span>
          </div>

          <FieldError
            id={`${id}-country-error`}
            message={
              errors.countryCode
            }
          />
        </label>
      </div>
    </section>
  );
}