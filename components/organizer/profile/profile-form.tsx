"use client";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Globe2,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import type { OrganizerProfileData } from "@/lib/organizer/get-organizer-profile";

export type OrganizerProfileCountryOption = {
  name: string;
  code: string;
  dialCode: string;
};

type ProfileFormProps = {
  organizer: OrganizerProfileData;
  countries: OrganizerProfileCountryOption[];
};

type ProfileFormState = {
  firstName: string;
  lastName: string;
  phone: string;

  country: string;
  countryCode: string;
  dialCode: string;

  businessName: string;
  businessType: string;
  description: string;

  website: string;
  address: string;
  city: string;

  facebook: string;
  instagram: string;
  x: string;
  linkedin: string;
};

type UpdateProfileApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  fields?: Record<string, string[]>;

  data?: {
    organizer?: {
      id: string;

      personal: {
        firstName: string;
        lastName: string;
        fullName: string;
        email: string;
        phone: string;

        country: string;
        countryCode: string;
        dialCode: string;

        emailVerified: boolean;
        isActive: boolean;

        updatedAt: string;
      };

      professional: {
        profileId: string;

        businessName: string;
        businessType: string;
        description: string;

        avatar: string | null;
        avatarPath: string | null;

        logo: string | null;
        logoPath: string | null;

        website: string;
        address: string;
        city: string;

        facebook: string;
        instagram: string;
        x: string;
        linkedin: string;

        updatedAt: string;
      };
    };
  };
};

const BUSINESS_TYPES = [
  "Organisateur d’événements",
  "Entreprise",
  "Association",
  "Agence événementielle",
  "Producteur",
  "Promoteur culturel",
  "Salle de spectacle",
  "Établissement scolaire",
  "Institution publique",
  "Organisation religieuse",
  "Club sportif",
  "Autre",
] as const;

const inputClassName =
  "h-12 w-full rounded-xl border border-white/[0.1] bg-[#050b0f] px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "min-h-36 w-full resize-y rounded-xl border border-white/[0.1] bg-[#050b0f] px-4 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50";

function createInitialState(
  organizer: OrganizerProfileData,
): ProfileFormState {
  return {
    firstName:
      organizer.personal.firstName,

    lastName:
      organizer.personal.lastName,

    phone:
      organizer.personal.phone,

    country:
      organizer.personal.country,

    countryCode:
      organizer.personal.countryCode,

    dialCode:
      organizer.personal.dialCode,

    businessName:
      organizer.professional.businessName,

    businessType:
      organizer.professional.businessType,

    description:
      organizer.professional.description,

    website:
      organizer.professional.website,

    address:
      organizer.professional.address,

    city:
      organizer.professional.city,

    facebook:
      organizer.professional.facebook,

    instagram:
      organizer.professional.instagram,

    x:
      organizer.professional.x,

    linkedin:
      organizer.professional.linkedin,
  };
}

function normalizeComparableValue(
  value: string,
): string {
  return value.trim();
}

export default function ProfileForm({
  organizer,
  countries,
}: ProfileFormProps) {
  const router = useRouter();

  const initialState = useMemo(
    () =>
      createInitialState(
        organizer,
      ),
    [organizer],
  );

  const [form, setForm] =
    useState<ProfileFormState>(
      initialState,
    );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<
    Record<string, string[]>
  >({});

  const hasChanges = useMemo(() => {
    const keys =
      Object.keys(
        form,
      ) as Array<
        keyof ProfileFormState
      >;

    return keys.some(
      (key) =>
        normalizeComparableValue(
          form[key],
        ) !==
        normalizeComparableValue(
          initialState[key],
        ),
    );
  }, [form, initialState]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
    setFieldErrors({});
  }

  function updateField<
    K extends keyof ProfileFormState,
  >(
    key: K,
    value: ProfileFormState[K],
  ) {
    clearMessages();

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCountryChange(
    countryCode: string,
  ) {
    const country =
      countries.find(
        (item) =>
          item.code ===
          countryCode,
      );

    if (!country) {
      return;
    }

    clearMessages();

    setForm((current) => ({
      ...current,

      country:
        country.name,

      countryCode:
        country.code,

      dialCode:
        country.dialCode,
    }));
  }

  function resetForm() {
    clearMessages();
    setForm(initialState);
  }

  function validateForm():
    | string
    | null {
    if (
      form.firstName.trim().length <
      2
    ) {
      return "Le prénom doit contenir au moins 2 caractères.";
    }

    if (
      form.lastName.trim().length <
      2
    ) {
      return "Le nom doit contenir au moins 2 caractères.";
    }

    const phoneDigits =
      form.phone.replace(
        /\D/g,
        "",
      );

    if (
      phoneDigits.length < 6 ||
      phoneDigits.length > 20
    ) {
      return "Renseignez un numéro de téléphone valide.";
    }

    if (
      !form.country.trim() ||
      !form.countryCode.trim() ||
      !form.dialCode.trim()
    ) {
      return "Sélectionnez un pays valide.";
    }

    if (
      form.description
        .trim()
        .length > 0 &&
      form.description
        .trim()
        .length < 20
    ) {
      return "La description professionnelle doit contenir au moins 20 caractères lorsqu’elle est renseignée.";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      !hasChanges
    ) {
      return;
    }

    clearMessages();

    const validationError =
      validateForm();

    if (validationError) {
      setError(
        validationError,
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/organizer/profile/update",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              firstName:
                form.firstName.trim(),

              lastName:
                form.lastName.trim(),

              phone:
                form.phone.trim(),

              country:
                form.country.trim(),

              countryCode:
                form.countryCode.trim(),

              dialCode:
                form.dialCode.trim(),

              businessName:
                form.businessName.trim() ||
                null,

              businessType:
                form.businessType.trim() ||
                null,

              description:
                form.description.trim() ||
                null,

              website:
                form.website.trim() ||
                null,

              address:
                form.address.trim() ||
                null,

              city:
                form.city.trim() ||
                null,

              facebook:
                form.facebook.trim() ||
                null,

              instagram:
                form.instagram.trim() ||
                null,

              x:
                form.x.trim() ||
                null,

              linkedin:
                form.linkedin.trim() ||
                null,
            }),
          },
        );

      let result: UpdateProfileApiResponse =
        {};

      try {
        result =
          (await response.json()) as UpdateProfileApiResponse;
      } catch {
        result = {};
      }

      if (
        !response.ok ||
        !result.success
      ) {
        setFieldErrors(
          result.fields ?? {},
        );

        throw new Error(
          result.message ??
            "Impossible de mettre à jour votre profil.",
        );
      }

      setSuccessMessage(
        result.message ??
          "Votre profil a été mis à jour avec succès.",
      );

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de mettre à jour votre profil.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-5"
    >
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-6 text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />

          <span>
            {successMessage}
          </span>
        </div>
      )}

      <ProfileSection
        icon={UserRound}
        title="Informations personnelles"
        description="Ces informations identifient le propriétaire du compte organisateur."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Prénom"
            required
            error={
              fieldErrors
                .firstName?.[0]
            }
          >
            <input
              type="text"
              value={
                form.firstName
              }
              onChange={(event) =>
                updateField(
                  "firstName",
                  event.target.value,
                )
              }
              maxLength={80}
              autoComplete="given-name"
              disabled={
                !organizer
                  .permissions
                  .canEditPersonalInformation
              }
              className={
                inputClassName
              }
            />
          </Field>

          <Field
            label="Nom"
            required
            error={
              fieldErrors
                .lastName?.[0]
            }
          >
            <input
              type="text"
              value={
                form.lastName
              }
              onChange={(event) =>
                updateField(
                  "lastName",
                  event.target.value,
                )
              }
              maxLength={80}
              autoComplete="family-name"
              disabled={
                !organizer
                  .permissions
                  .canEditPersonalInformation
              }
              className={
                inputClassName
              }
            />
          </Field>

          <Field
            label="Adresse e-mail"
            helper="Le changement d’e-mail nécessitera une nouvelle vérification."
          >
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

              <input
                type="email"
                value={
                  organizer
                    .personal.email
                }
                readOnly
                className={`${inputClassName} cursor-not-allowed pl-11 text-neutral-500`}
              />
            </div>
          </Field>

          <Field
            label="Téléphone"
            required
            error={
              fieldErrors
                .phone?.[0]
            }
          >
            <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
              <input
                type="text"
                value={
                  form.dialCode
                }
                readOnly
                className={`${inputClassName} cursor-not-allowed text-center text-neutral-500`}
              />

              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                <input
                  type="tel"
                  value={
                    form.phone
                  }
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value,
                    )
                  }
                  maxLength={30}
                  autoComplete="tel"
                  disabled={
                    !organizer
                      .permissions
                      .canChangePhone
                  }
                  className={`${inputClassName} pl-11`}
                />
              </div>
            </div>
          </Field>

          <Field
            label="Pays"
            required
            error={
              fieldErrors
                .country?.[0]
            }
            className="md:col-span-2"
          >
            <div className="relative">
              <select
                value={
                  form.countryCode
                }
                onChange={(event) =>
                  handleCountryChange(
                    event.target.value,
                  )
                }
                disabled={
                  !organizer
                    .permissions
                    .canEditPersonalInformation
                }
                className={`${inputClassName} appearance-none pr-11`}
              >
                {countries.map(
                  (country) => (
                    <option
                      key={
                        country.code
                      }
                      value={
                        country.code
                      }
                    >
                      {country.name} (
                      {
                        country.dialCode
                      }
                      )
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            </div>
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        icon={Building2}
        title="Informations professionnelles"
        description="Présentez votre organisation et votre activité sur Tikemia."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Nom de l’organisation"
            error={
              fieldErrors
                .businessName?.[0]
            }
          >
            <input
              type="text"
              value={
                form.businessName
              }
              onChange={(event) =>
                updateField(
                  "businessName",
                  event.target.value,
                )
              }
              maxLength={160}
              placeholder="Ex. Tikemia Events"
              disabled={
                !organizer
                  .permissions
                  .canEditProfessionalInformation
              }
              className={
                inputClassName
              }
            />
          </Field>

          <Field
            label="Type d’activité"
            error={
              fieldErrors
                .businessType?.[0]
            }
          >
            <div className="relative">
              <select
                value={
                  form.businessType
                }
                onChange={(event) =>
                  updateField(
                    "businessType",
                    event.target.value,
                  )
                }
                disabled={
                  !organizer
                    .permissions
                    .canEditProfessionalInformation
                }
                className={`${inputClassName} appearance-none pr-11`}
              >
                <option value="">
                  Sélectionner un type
                </option>

                {BUSINESS_TYPES.map(
                  (businessType) => (
                    <option
                      key={
                        businessType
                      }
                      value={
                        businessType
                      }
                    >
                      {businessType}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            </div>
          </Field>

          <Field
            label="Description professionnelle"
            helper={`${form.description.length.toLocaleString(
              "fr-FR",
            )} / 2 000 caractères`}
            error={
              fieldErrors
                .description?.[0]
            }
            className="md:col-span-2"
          >
            <textarea
              value={
                form.description
              }
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value,
                )
              }
              maxLength={2000}
              placeholder="Présentez votre organisation, vos activités et votre expérience."
              disabled={
                !organizer
                  .permissions
                  .canEditProfessionalInformation
              }
              className={
                textareaClassName
              }
            />
          </Field>

          <Field
            label="Adresse professionnelle"
            error={
              fieldErrors
                .address?.[0]
            }
          >
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

              <input
                type="text"
                value={
                  form.address
                }
                onChange={(event) =>
                  updateField(
                    "address",
                    event.target.value,
                  )
                }
                maxLength={300}
                placeholder="Rue, quartier, bâtiment..."
                disabled={
                  !organizer
                    .permissions
                    .canEditProfessionalInformation
                }
                className={`${inputClassName} pl-11`}
              />
            </div>
          </Field>

          <Field
            label="Ville"
            error={
              fieldErrors
                .city?.[0]
            }
          >
            <input
              type="text"
              value={form.city}
              onChange={(event) =>
                updateField(
                  "city",
                  event.target.value,
                )
              }
              maxLength={100}
              placeholder="Ex. Cotonou"
              disabled={
                !organizer
                  .permissions
                  .canEditProfessionalInformation
              }
              className={
                inputClassName
              }
            />
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        icon={Globe2}
        title="Présence en ligne"
        description="Ajoutez votre site internet et vos réseaux sociaux officiels."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Site internet"
            error={
              fieldErrors
                .website?.[0]
            }
            className="md:col-span-2"
          >
            <input
              type="text"
              inputMode="url"
              value={
                form.website
              }
              onChange={(event) =>
                updateField(
                  "website",
                  event.target.value,
                )
              }
              maxLength={500}
              placeholder="https://votre-site.com"
              disabled={
                !organizer
                  .permissions
                  .canEditProfessionalInformation
              }
              className={
                inputClassName
              }
            />
          </Field>

          <SocialField
            label="Facebook"
            value={
              form.facebook
            }
            placeholder="https://facebook.com/..."
            error={
              fieldErrors
                .facebook?.[0]
            }
            disabled={
              !organizer
                .permissions
                .canEditProfessionalInformation
            }
            onChange={(value) =>
              updateField(
                "facebook",
                value,
              )
            }
          />

          <SocialField
            label="Instagram"
            value={
              form.instagram
            }
            placeholder="https://instagram.com/..."
            error={
              fieldErrors
                .instagram?.[0]
            }
            disabled={
              !organizer
                .permissions
                .canEditProfessionalInformation
            }
            onChange={(value) =>
              updateField(
                "instagram",
                value,
              )
            }
          />

          <SocialField
            label="X"
            value={form.x}
            placeholder="https://x.com/..."
            error={
              fieldErrors.x?.[0]
            }
            disabled={
              !organizer
                .permissions
                .canEditProfessionalInformation
            }
            onChange={(value) =>
              updateField(
                "x",
                value,
              )
            }
          />

          <SocialField
            label="LinkedIn"
            value={
              form.linkedin
            }
            placeholder="https://linkedin.com/..."
            error={
              fieldErrors
                .linkedin?.[0]
            }
            disabled={
              !organizer
                .permissions
                .canEditProfessionalInformation
            }
            onChange={(value) =>
              updateField(
                "linkedin",
                value,
              )
            }
          />
        </div>
      </ProfileSection>

      <section className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/[0.09] bg-[#050b0f]/95 p-3 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="hidden lg:block">
          <p className="text-xs font-bold text-white">
            Modifications du profil
          </p>

          <p className="mt-1 text-[11px] text-neutral-600">
            {hasChanges
              ? "Des modifications n’ont pas encore été enregistrées."
              : "Toutes vos informations sont à jour."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={resetForm}
            disabled={
              isSubmitting ||
              !hasChanges
            }
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-bold text-neutral-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Annuler les modifications
          </button>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasChanges
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_14px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {isSubmitting
              ? "Enregistrement..."
              : "Enregistrer le profil"}
          </button>
        </div>
      </section>
    </form>
  );
}

type IconComponent =
  typeof UserRound;

function ProfileSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <header className="flex items-start gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
          <Icon className="h-[18px] w-[18px] text-lime-400" />
        </div>

        <div>
          <h2 className="text-base font-black text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  required = false,
  helper,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block ${className}`}
    >
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-300">
          {label}

          {required && (
            <span className="ml-1 text-orange-400">
              *
            </span>
          )}
        </span>

        {helper && (
          <span className="text-[10px] text-neutral-600">
            {helper}
          </span>
        )}
      </span>

      {children}

      {error && (
        <span className="mt-2 block text-xs leading-5 text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

function SocialField({
  label,
  value,
  placeholder,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  disabled: boolean;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <Field
      label={label}
      error={error}
    >
      <input
        type="text"
        inputMode="url"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        maxLength={500}
        placeholder={placeholder}
        disabled={disabled}
        className={
          inputClassName
        }
      />
    </Field>
  );
}