"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  ImageIcon,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Send,
  ShieldCheck,
  TicketCheck,
  Trash2,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import type {
  CreateEventOptions,
} from "@/lib/events/get-create-event-options";
import {
  calculateEventRevenueProjection,
  PricingValidationError,
} from "@/lib/events/pricing";
import {
  getCurrencyDefinition,
  isSupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
  getCurrencyDecimals,
} from "@/lib/localization/format-money";

import EventImagesUploader, {
  type SelectedEventImage,
} from "@/components/organizer/events/create/event-images-uploader";

type CreateEventFormProps = {
  options: CreateEventOptions;
};

type TicketTypeForm = {
  localId: string;
  name: string;
  description: string;
  price: string;
  quantity: string;
  maxPerOrder: string;
  saleStartsAt: string;
  saleEndsAt: string;
  isActive: boolean;
};

type FormState = {
  categoryId: string;
  title: string;
  description: string;
  venueName: string;
  address: string;
  city: string;
  countryCode: string;
  country: string;
  timezone: string;

  startsAt: string;
  endsAt: string;
  salesStartAt: string;
  salesEndAt: string;

  currency: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
  data?: {
    event?: {
      id: string;
    };
  };
};

type UploadedEventImage = {
  path: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
};

const createTicketType = (
  index: number,
  defaultMaxPerOrder: number,
): TicketTypeForm => ({
  localId: crypto.randomUUID(),
  name: index === 0 ? "Standard" : `Billet ${index + 1}`,
  description: "",
  price: "",
  quantity: "",
  maxPerOrder: String(defaultMaxPerOrder),
  saleStartsAt: "",
  saleEndsAt: "",
  isActive: true,
});

function toIsoDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeNumberInput(value: string): number {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValidCurrencyPrecision(
  value: string,
  currency: string,
): boolean {
  const normalizedValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!normalizedValue) {
    return false;
  }

  const decimalPart =
    normalizedValue.split(".")[1] ?? "";

  return (
    decimalPart.length <=
    getCurrencyDecimals(currency)
  );
}

export default function CreateEventForm({
  options,
}: CreateEventFormProps) {
  const router = useRouter();

  const defaultCountry =
    options.countries.find(
      (country) => country.code === "BJ",
    ) ?? options.countries[0];

  const [form, setForm] = useState<FormState>({
    categoryId: "",
    title: "",
    description: "",
    venueName: "",
    address: "",
    city: "",
    countryCode: defaultCountry?.code ?? "BJ",
    country: defaultCountry?.name ?? "Bénin",
    timezone:
      defaultCountry?.timezone ??
      "Africa/Porto-Novo",

    startsAt: "",
    endsAt: "",
    salesStartAt: "",
    salesEndAt: "",

    currency:
      defaultCountry?.currency ??
      options.rules.defaultCurrency,
  });

  const [ticketTypes, setTicketTypes] = useState<
    TicketTypeForm[]
  >([
    createTicketType(
      0,
      options.rules.defaultMaxPerOrder,
    ),
  ]);

  const [selectedImages, setSelectedImages] = useState<
    SelectedEventImage[]
  >([]);

  const [coverImageIndex, setCoverImageIndex] =
    useState(0);

  const [isUploadingImages, setIsUploadingImages] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitMode, setSubmitMode] = useState<
    "DRAFT" | "SUBMIT" | null
  >(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]>
  >({});

  const selectedCategory = options.categories.find(
    (category) => category.id === form.categoryId,
  );

  const selectedCountry = options.countries.find(
    (country) => country.code === form.countryCode,
  );

  const selectedCurrency = options.currencies.find(
    (currency) => currency.code === form.currency,
  );

  const projection = useMemo(() => {
    try {
      return calculateEventRevenueProjection(
        ticketTypes.map((ticketType) => ({
          id: ticketType.localId,
          name:
            ticketType.name.trim() ||
            "Billet sans nom",
          unitPrice:
            normalizeNumberInput(ticketType.price),
          quantity: Math.max(
            Math.trunc(
              normalizeNumberInput(
                ticketType.quantity,
              ),
            ),
            0,
          ),
        })),
        {
          currency: form.currency,
          platformFeePercent:
            options.rules.platformFeePercent,
        },
      );
    } catch (projectionError) {
      if (
        projectionError instanceof
        PricingValidationError
      ) {
        return null;
      }

      return null;
    }
  }, [
    form.currency,
    options.rules.platformFeePercent,
    ticketTypes,
  ]);

  const formProgress = useMemo(() => {
    const checks = [
      Boolean(form.title.trim()),
      Boolean(form.categoryId),
      form.description.trim().length >=
        options.rules.minimumDescriptionLength,
      Boolean(form.venueName.trim()),
      Boolean(form.address.trim()),
      Boolean(form.city.trim()),
      Boolean(form.startsAt),
      selectedImages.length > 0,
      ticketTypes.every(
        (ticket) =>
          ticket.name.trim() &&
          normalizeNumberInput(ticket.quantity) > 0 &&
          normalizeNumberInput(ticket.price) >= 0,
      ),
    ];

    const completed = checks.filter(Boolean).length;

    return Math.round(
      (completed / checks.length) * 100,
    );
  }, [
    form,
    options.rules.minimumDescriptionLength,
    selectedImages.length,
    ticketTypes,
  ]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
    setFieldErrors({});
  }

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K],
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
    const country = options.countries.find(
      (item) => item.code === countryCode,
    );

    if (!country) {
      return;
    }

    clearMessages();

    setForm((current) => ({
      ...current,
      countryCode: country.code,
      country: country.name,
      currency: country.currency,
      timezone: country.timezone,
    }));
  }

  function updateTicketType(
    localId: string,
    field: keyof TicketTypeForm,
    value: string | boolean,
  ) {
    clearMessages();

    setTicketTypes((current) =>
      current.map((ticketType) =>
        ticketType.localId === localId
          ? {
              ...ticketType,
              [field]: value,
            }
          : ticketType,
      ),
    );
  }

  function addTicketType() {
    if (
      ticketTypes.length >=
      options.rules.maxTicketTypes
    ) {
      setError(
        `Vous ne pouvez pas ajouter plus de ${options.rules.maxTicketTypes} types de billets.`,
      );
      return;
    }

    clearMessages();

    setTicketTypes((current) => [
      ...current,
      createTicketType(
        current.length,
        options.rules.defaultMaxPerOrder,
      ),
    ]);
  }

  function removeTicketType(localId: string) {
    if (ticketTypes.length === 1) {
      setError(
        "L’événement doit contenir au moins un type de billet.",
      );
      return;
    }

    clearMessages();

    setTicketTypes((current) =>
      current.filter(
        (ticketType) =>
          ticketType.localId !== localId,
      ),
    );
  }

  function validateClientForm(): string | null {
    if (!form.title.trim()) {
      return "Renseignez le titre de l’événement.";
    }

    if (!form.categoryId) {
      return "Sélectionnez une catégorie.";
    }

    if (
      form.description.trim().length <
      options.rules.minimumDescriptionLength
    ) {
      return `La description doit contenir au moins ${options.rules.minimumDescriptionLength} caractères.`;
    }

    if (
      !form.venueName.trim() ||
      !form.address.trim() ||
      !form.city.trim()
    ) {
      return "Complétez toutes les informations du lieu.";
    }

    if (!form.startsAt) {
      return "Renseignez la date et l’heure de début.";
    }

    if (selectedImages.length === 0) {
      return "Ajoutez au moins une image pour l’événement.";
    }

    if (
      form.endsAt &&
      new Date(form.endsAt).getTime() <=
        new Date(form.startsAt).getTime()
    ) {
      return "La date de fin doit être postérieure à la date de début.";
    }

    if (
      !isSupportedCurrencyCode(
        form.currency,
      ) ||
      !getCurrencyDefinition(
        form.currency,
      )?.active
    ) {
      return "Sélectionnez une devise prise en charge par Tikemia.";
    }

    for (const ticketType of ticketTypes) {
      if (!ticketType.name.trim()) {
        return "Chaque type de billet doit avoir un nom.";
      }

      if (
        normalizeNumberInput(
          ticketType.quantity,
        ) <= 0
      ) {
        return `La quantité du billet « ${ticketType.name} » doit être supérieure à zéro.`;
      }

      if (
        normalizeNumberInput(ticketType.price) < 0
      ) {
        return `Le prix du billet « ${ticketType.name} » n’est pas valide.`;
      }

      if (
        !hasValidCurrencyPrecision(
          ticketType.price,
          form.currency,
        )
      ) {
        const decimals =
          getCurrencyDecimals(
            form.currency,
          );

        return decimals === 0
          ? `Le prix du billet « ${ticketType.name} » ne doit pas contenir de décimales en ${form.currency}.`
          : `Le prix du billet « ${ticketType.name} » accepte au maximum ${decimals} décimales en ${form.currency}.`;
      }
    }

    return null;
  }

  async function uploadEventImages(): Promise<
    UploadedEventImage[]
  > {
    const imageFormData = new FormData();

    selectedImages.forEach((image) => {
      imageFormData.append("images", image.file);
    });

    imageFormData.append(
      "coverIndex",
      String(coverImageIndex),
    );

    setIsUploadingImages(true);

    try {
      const response = await fetch(
        "/api/organizer/events/images",
        {
          method: "POST",
          body: imageFormData,
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        images?: UploadedEventImage[];
      };

      if (!response.ok || !result.images) {
        throw new Error(
          result.message ??
            "Les images n’ont pas pu être téléversées.",
        );
      }

      return result.images;
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function submitEvent(
    publicationMode: "DRAFT" | "SUBMIT",
  ) {
    clearMessages();

    const validationError =
      validateClientForm();

    if (validationError) {
      setError(validationError);
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMode(publicationMode);

    try {
      const uploadedImages =
        await uploadEventImages();

      const coverImage =
        uploadedImages.find(
          (image) => image.isCover,
        ) ?? uploadedImages[0];

      if (!coverImage) {
        throw new Error(
          "Aucune image téléversée n’a été retournée.",
        );
      }

      const response = await fetch(
        "/api/organizer/events",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            categoryId: form.categoryId,
            title: form.title.trim(),
            description:
              form.description.trim(),
            images: uploadedImages,
            coverImage:
              coverImage.publicUrl,

            venueName: form.venueName.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            country: form.country,
            countryCode: form.countryCode,
            timezone: form.timezone,

            startsAt: toIsoDate(form.startsAt),
            endsAt: toIsoDate(form.endsAt),
            salesStartAt: toIsoDate(
              form.salesStartAt,
            ),
            salesEndAt: toIsoDate(
              form.salesEndAt,
            ),

            currency: form.currency,
            publicationMode,

            ticketTypes: ticketTypes.map(
              (ticketType) => ({
                name: ticketType.name.trim(),
                description:
                  ticketType.description.trim() ||
                  null,
                price: ticketType.price
                  .trim()
                  .replace(",", "."),
                quantity: Math.trunc(
                  normalizeNumberInput(
                    ticketType.quantity,
                  ),
                ),
                maxPerOrder: Math.trunc(
                  normalizeNumberInput(
                    ticketType.maxPerOrder,
                  ),
                ),
                saleStartsAt: toIsoDate(
                  ticketType.saleStartsAt,
                ),
                saleEndsAt: toIsoDate(
                  ticketType.saleEndsAt,
                ),
                isActive: ticketType.isActive,
              }),
            ),
          }),
        },
      );

      const result =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setFieldErrors(result.fields ?? {});

        throw new Error(
          result.message ??
            "Impossible de créer l’événement.",
        );
      }

      setSuccessMessage(
        result.message ??
          (publicationMode === "DRAFT"
            ? "L’événement a été enregistré comme brouillon."
            : "L’événement a été publié avec succès."),
      );

      window.setTimeout(() => {
        router.push(
          result.redirectTo ??
            "/organizer/events",
        );
        router.refresh();
      }, 900);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de créer l’événement.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(false);
      setSubmitMode(null);
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void submitEvent("SUBMIT");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/* Barre supérieure */}
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#081015] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/organizer/events"
            aria-label="Retour aux événements"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
              Créer un événement
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Complétez les informations avant
              la publication de votre événement.
            </p>
          </div>
        </div>

        <div className="min-w-[180px]">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-neutral-500">
              Progression
            </span>

            <span className="font-bold text-lime-400">
              {formProgress} %
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 transition-[width] duration-500"
              style={{
                width: `${formProgress}%`,
              }}
            />
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Formulaire principal */}
        <div className="space-y-5">
          {/* Informations générales */}
          <FormSection
            icon={FileText}
            title="Informations générales"
            description="Présentez clairement votre événement."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Titre de l’événement"
                required
                error={fieldErrors.title?.[0]}
                className="md:col-span-2"
              >
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value,
                    )
                  }
                  maxLength={
                    options.rules.maximumTitleLength
                  }
                  placeholder="Ex. Festival Tikemia 2026"
                  className={inputClassName}
                />

                <FieldCounter
                  current={form.title.length}
                  maximum={
                    options.rules.maximumTitleLength
                  }
                />
              </Field>

              <Field
                label="Catégorie"
                required
                error={
                  fieldErrors.categoryId?.[0]
                }
              >
                <div className="relative">
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      updateForm(
                        "categoryId",
                        event.target.value,
                      )
                    }
                    className={`${inputClassName} appearance-none pr-11`}
                  >
                    <option value="">
                      Sélectionner une catégorie
                    </option>

                    {options.categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </Field>

              <div className="md:col-span-2">
                <EventImagesUploader
                  value={selectedImages}
                  coverIndex={coverImageIndex}
                  disabled={isSubmitting || isUploadingImages}
                  isUploading={isUploadingImages}
                  error={fieldErrors.images?.[0]}
                  onChange={({ images, coverIndex }) => {
                    setSelectedImages(images);
                    setCoverImageIndex(coverIndex);
                    clearMessages();
                  }}
                />
              </div>

              <Field
                label="Description"
                required
                error={
                  fieldErrors.description?.[0]
                }
                className="md:col-span-2"
              >
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value,
                    )
                  }
                  maxLength={
                    options.rules
                      .maximumDescriptionLength
                  }
                  rows={7}
                  placeholder="Présentez le programme, les artistes, les activités et les informations utiles."
                  className={`${inputClassName} h-auto resize-y py-3.5 leading-6`}
                />

                <FieldCounter
                  current={form.description.length}
                  minimum={
                    options.rules
                      .minimumDescriptionLength
                  }
                  maximum={
                    options.rules
                      .maximumDescriptionLength
                  }
                />
              </Field>
            </div>
          </FormSection>

          {/* Lieu */}
          <FormSection
            icon={MapPin}
            title="Lieu de l’événement"
            description="Indiquez précisément où se déroulera l’événement."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Pays"
                required
                error={
                  fieldErrors.countryCode?.[0] ??
                  fieldErrors.country?.[0]
                }
              >
                <div className="relative">
                  <select
                    value={form.countryCode}
                    onChange={(event) =>
                      handleCountryChange(
                        event.target.value,
                      )
                    }
                    className={`${inputClassName} appearance-none pr-11`}
                  >
                    {options.countries.map(
                      (country) => (
                        <option
                          key={country.code}
                          value={country.code}
                        >
                          {country.name}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </Field>

              <Field
                label="Ville"
                required
                error={fieldErrors.city?.[0]}
              >
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) =>
                    updateForm(
                      "city",
                      event.target.value,
                    )
                  }
                  placeholder="Ex. Cotonou"
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Nom du lieu"
                required
                error={
                  fieldErrors.venueName?.[0]
                }
              >
                <input
                  type="text"
                  value={form.venueName}
                  onChange={(event) =>
                    updateForm(
                      "venueName",
                      event.target.value,
                    )
                  }
                  placeholder="Ex. Palais des Congrès"
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Adresse complète"
                required
                error={
                  fieldErrors.address?.[0]
                }
              >
                <input
                  type="text"
                  value={form.address}
                  onChange={(event) =>
                    updateForm(
                      "address",
                      event.target.value,
                    )
                  }
                  placeholder="Rue, quartier, repère"
                  className={inputClassName}
                />
              </Field>
            </div>
          </FormSection>

          {/* Dates */}
          <FormSection
            icon={CalendarDays}
            title="Dates et horaires"
            description="Planifiez l’événement et la période de vente."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Début de l’événement"
                required
                error={
                  fieldErrors.startsAt?.[0]
                }
              >
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    updateForm(
                      "startsAt",
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Fin de l’événement"
                error={fieldErrors.endsAt?.[0]}
              >
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) =>
                    updateForm(
                      "endsAt",
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Ouverture générale des ventes">
                <input
                  type="datetime-local"
                  value={form.salesStartAt}
                  onChange={(event) =>
                    updateForm(
                      "salesStartAt",
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Fermeture générale des ventes">
                <input
                  type="datetime-local"
                  value={form.salesEndAt}
                  onChange={(event) =>
                    updateForm(
                      "salesEndAt",
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                />
              </Field>

              <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
                <InfoValue
                  label="Fuseau horaire"
                  value={form.timezone}
                  icon={Clock3}
                />

                <Field
                  label="Devise de vente"
                  required
                  error={
                    fieldErrors.currency?.[0]
                  }
                >
                  <div className="relative">
                    <select
                      value={form.currency}
                      onChange={(event) =>
                        updateForm(
                          "currency",
                          event.target.value,
                        )
                      }
                      className={`${inputClassName} appearance-none pr-11`}
                    >
                      {options.currencies.map(
                        (currency) => (
                          <option
                            key={currency.code}
                            value={currency.code}
                          >
                            {currency.label}
                            {" — "}
                            {currency.symbol}
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-neutral-600">
                    Devise recommandée pour{" "}
                    {selectedCountry?.name ??
                      form.country}
                    {" : "}
                    <span className="font-bold text-neutral-400">
                      {selectedCountry?.currency ??
                        options.rules.defaultCurrency}
                    </span>
                    . Vous pouvez choisir une autre
                    devise prise en charge avant les
                    premières ventes.
                  </p>
                </Field>
              </div>
            </div>
          </FormSection>

          {/* Billets */}
          <FormSection
            icon={TicketCheck}
            title="Billets et tarifs"
            description="Créez les différentes offres disponibles."
            action={
              <button
                type="button"
                onClick={addTicketType}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 text-xs font-bold text-lime-400 transition hover:bg-emerald-500/10"
              >
                <Plus className="h-4 w-4" />
                Ajouter un billet
              </button>
            }
          >
            <div className="space-y-4">
              {ticketTypes.map(
                (ticketType, index) => (
                  <TicketTypeCard
                    key={ticketType.localId}
                    index={index}
                    ticketType={ticketType}
                    currency={form.currency}
                    currencySymbol={
                      selectedCurrency?.symbol ??
                      form.currency
                    }
                    currencyDecimals={
                      selectedCurrency?.fractionDigits ??
                      getCurrencyDecimals(
                        form.currency,
                      )
                    }
                    platformFeePercent={
                      options.rules.platformFeePercent
                    }
                    canDelete={
                      ticketTypes.length > 1
                    }
                    onUpdate={updateTicketType}
                    onRemove={removeTicketType}
                  />
                ),
              )}
            </div>
          </FormSection>
        </div>

        {/* Colonne résumé */}
        <aside className="space-y-5 xl:sticky xl:top-[112px]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
            <header className="border-b border-white/[0.07] px-4 py-4">
              <div className="flex items-center gap-2.5">
                <WalletCards className="h-5 w-5 text-lime-400" />

                <h2 className="text-base font-black text-white">
                  Estimation financière
                </h2>
              </div>

              <p className="mt-1 text-xs text-neutral-500">
                Calcul automatique selon vos tarifs.
              </p>
            </header>

            <div className="space-y-3 p-4">
              <SummaryLine
                label="Capacité totale"
                value={`${(
                  projection?.totalCapacity ?? 0
                ).toLocaleString("fr-FR")} billets`}
                icon={UsersRound}
              />

              <SummaryLine
                label="Prix moyen"
                value={formatMoney({
                  amount:
                    projection?.averageTicketPrice ??
                    0,
                  currency: form.currency,
                  locale:
                    selectedCountry?.locale ??
                    "fr-FR",
                })}
                icon={TicketCheck}
              />

              <SummaryLine
                label="Chiffre d’affaires potentiel"
                value={formatMoney({
                  amount:
                    projection?.grossRevenue ?? 0,
                  currency: form.currency,
                  locale:
                    selectedCountry?.locale ??
                    "fr-FR",
                })}
                icon={CircleDollarSign}
              />

              <SummaryLine
                label={`Commission Tikemia (${options.rules.platformFeePercent} %)`}
                value={formatMoney({
                  amount:
                    projection?.platformFee ?? 0,
                  currency: form.currency,
                  locale:
                    selectedCountry?.locale ??
                    "fr-FR",
                })}
                icon={ShieldCheck}
                tone="orange"
              />

              <SummaryLine
                label="Revenu net organisateur"
                value={formatMoney({
                  amount:
                    projection?.organizerNet ?? 0,
                  currency: form.currency,
                  locale:
                    selectedCountry?.locale ??
                    "fr-FR",
                })}
                icon={WalletCards}
                tone="green"
              />
            </div>

            <div className="border-t border-white/[0.07] bg-emerald-500/[0.035] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

                <p className="text-[11px] leading-5 text-neutral-500">
                  La commission de{" "}
                  {options.rules.platformFeePercent} %
                  est calculée automatiquement sur
                  chaque vente confirmée.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#081015] p-4">
            <h2 className="text-sm font-black text-white">
              Aperçu
            </h2>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#050b0f]">
              <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500/10 via-lime-500/[0.04] to-orange-500/10">
                {selectedImages[coverImageIndex]?.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      selectedImages[coverImageIndex]
                        .previewUrl
                    }
                    alt="Aperçu de l’image principale"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-neutral-600" />
                )}
              </div>

              <div className="p-4">
                <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-bold text-lime-400">
                  {selectedCategory?.name ??
                    "Catégorie"}
                </span>

                <h3 className="mt-3 line-clamp-2 text-sm font-black text-white">
                  {form.title.trim() ||
                    "Titre de l’événement"}
                </h3>

                <div className="mt-3 space-y-2 text-[11px] text-neutral-500">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {form.startsAt
                      ? new Intl.DateTimeFormat(
                          selectedCountry?.locale ??
                            "fr-FR",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        ).format(
                          new Date(form.startsAt),
                        )
                      : "Date à renseigner"}
                  </p>

                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    {form.city || "Ville"},{" "}
                    {form.country}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Actions */}
      <section className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/[0.09] bg-[#050b0f]/95 p-3 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="hidden max-w-md text-xs leading-5 text-neutral-500 lg:block">
          Enregistrez un brouillon pour continuer
          plus tard ou publiez immédiatement
          votre événement sur Tikemia.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting || isUploadingImages}
            onClick={() =>
              void submitEvent("DRAFT")
            }
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting &&
            submitMode === "DRAFT" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            Enregistrer comme brouillon
          </button>

          <button
            type="submit"
            disabled={isSubmitting || isUploadingImages}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_15px_40px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSubmitting &&
            submitMode === "SUBMIT" ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Publication en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Publier l’événement
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </section>
    </form>
  );
}

const inputClassName =
  "h-12 w-full rounded-xl border border-white/[0.1] bg-[#050b0f] px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50";

type FormSectionProps = {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

function FormSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: FormSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
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
        </div>

        {action}
      </header>

      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

function Field({
  label,
  required = false,
  error,
  className = "",
  children,
}: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-neutral-300">
        {label}

        {required && (
          <span className="ml-1 text-orange-400">
            *
          </span>
        )}
      </span>

      {children}

      {error && (
        <span className="mt-2 block text-xs text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

function FieldCounter({
  current,
  minimum,
  maximum,
}: {
  current: number;
  minimum?: number;
  maximum: number;
}) {
  const invalid =
    minimum !== undefined && current < minimum;

  return (
    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
      <span
        className={
          invalid
            ? "text-orange-400"
            : "text-neutral-600"
        }
      >
        {minimum !== undefined
          ? `Minimum ${minimum} caractères`
          : ""}
      </span>

      <span className="text-neutral-600">
        {current.toLocaleString("fr-FR")} /{" "}
        {maximum.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

function InfoValue({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-lime-400" />

      <div className="min-w-0">
        <p className="text-[11px] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 truncate text-xs font-bold text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

type TicketTypeCardProps = {
  index: number;
  ticketType: TicketTypeForm;
  currency: string;
  currencySymbol: string;
  currencyDecimals: number;
  platformFeePercent: number;
  canDelete: boolean;
  onUpdate: (
    localId: string,
    field: keyof TicketTypeForm,
    value: string | boolean,
  ) => void;
  onRemove: (localId: string) => void;
};

function TicketTypeCard({
  index,
  ticketType,
  currency,
  currencySymbol,
  currencyDecimals,
  platformFeePercent,
  canDelete,
  onUpdate,
  onRemove,
}: TicketTypeCardProps) {
  const unitPrice = normalizeNumberInput(
    ticketType.price,
  );

  const quantity = Math.max(
    Math.trunc(
      normalizeNumberInput(ticketType.quantity),
    ),
    0,
  );

  const estimatedGross = unitPrice * quantity;
  const estimatedFee =
    estimatedGross * (platformFeePercent / 100);
  const estimatedNet =
    estimatedGross - estimatedFee;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#050b0f] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-sm font-black text-lime-400">
            {index + 1}
          </span>

          <div>
            <h3 className="text-sm font-black text-white">
              {ticketType.name.trim() ||
                `Billet ${index + 1}`}
            </h3>

            <p className="mt-0.5 text-[11px] text-neutral-600">
              Offre de billetterie
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!canDelete}
          onClick={() =>
            onRemove(ticketType.localId)
          }
          aria-label="Supprimer ce type de billet"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-600 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Nom du billet" required>
          <input
            type="text"
            value={ticketType.name}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "name",
                event.target.value,
              )
            }
            placeholder="Standard, VIP, VVIP..."
            className={inputClassName}
          />
        </Field>

        <Field label="Description">
          <input
            type="text"
            value={ticketType.description}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "description",
                event.target.value,
              )
            }
            placeholder="Avantages et accès inclus"
            className={inputClassName}
          />
        </Field>

        <Field
          label={`Prix (${currency} — ${currencySymbol})`}
          required
        >
          <input
            type="text"
            inputMode={
              currencyDecimals === 0
                ? "numeric"
                : "decimal"
            }
            value={ticketType.price}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "price",
                event.target.value.replace(
                  /[^0-9.,]/g,
                  "",
                ),
              )
            }
            placeholder={
              currencyDecimals === 0
                ? "5000"
                : "5000.00"
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Quantité disponible" required>
          <input
            type="number"
            min={1}
            value={ticketType.quantity}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "quantity",
                event.target.value,
              )
            }
            placeholder="500"
            className={inputClassName}
          />
        </Field>

        <Field label="Maximum par commande">
          <input
            type="number"
            min={1}
            max={100}
            value={ticketType.maxPerOrder}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "maxPerOrder",
                event.target.value,
              )
            }
            className={inputClassName}
          />
        </Field>

        <div className="flex items-end">
          <label className="flex h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-4">
            <span className="text-sm font-semibold text-neutral-300">
              Billet actif
            </span>

            <input
              type="checkbox"
              checked={ticketType.isActive}
              onChange={(event) =>
                onUpdate(
                  ticketType.localId,
                  "isActive",
                  event.target.checked,
                )
              }
              className="peer sr-only"
            />

            <span className="relative h-6 w-11 rounded-full bg-neutral-700 transition peer-checked:bg-emerald-500">
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
            </span>
          </label>
        </div>

        <Field label="Début de vente spécifique">
          <input
            type="datetime-local"
            value={ticketType.saleStartsAt}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "saleStartsAt",
                event.target.value,
              )
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Fin de vente spécifique">
          <input
            type="datetime-local"
            value={ticketType.saleEndsAt}
            onChange={(event) =>
              onUpdate(
                ticketType.localId,
                "saleEndsAt",
                event.target.value,
              )
            }
            className={inputClassName}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <SmallTicketMetric
          label="Revenu brut potentiel"
          value={formatMoney({
            amount: estimatedGross,
            currency,
          })}
        />

        <SmallTicketMetric
          label="Commission Tikemia"
          value={formatMoney({
            amount: estimatedFee,
            currency,
          })}
          tone="orange"
        />

        <SmallTicketMetric
          label="Revenu net potentiel"
          value={formatMoney({
            amount: estimatedNet,
            currency,
          })}
          tone="green"
        />
      </div>
    </article>
  );
}

function SmallTicketMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "orange" | "green";
}) {
  const valueClass =
    tone === "green"
      ? "text-lime-400"
      : tone === "orange"
        ? "text-orange-400"
        : "text-white";

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="text-[10px] leading-4 text-neutral-600">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-xs font-black ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone?: "neutral" | "orange" | "green";
}) {
  const styles =
    tone === "green"
      ? {
          icon: "text-lime-400",
          value: "text-lime-400",
          wrapper:
            "border-emerald-500/18 bg-emerald-500/[0.045]",
        }
      : tone === "orange"
        ? {
            icon: "text-orange-400",
            value: "text-orange-400",
            wrapper:
              "border-orange-500/18 bg-orange-500/[0.045]",
          }
        : {
            icon: "text-neutral-500",
            value: "text-white",
            wrapper:
              "border-white/[0.07] bg-white/[0.02]",
          };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${styles.wrapper}`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${styles.icon}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-[10px] leading-4 text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 break-words text-xs font-black ${styles.value}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}