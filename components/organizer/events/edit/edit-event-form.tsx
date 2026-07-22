"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
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
  Star,
  TicketCheck,
  Trash2,
  UploadCloud,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { EventForEditData } from "@/lib/events/get-event-for-edit";
import type { CreateEventOptions } from "@/lib/events/get-create-event-options";
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

type EditEventFormProps = {
  event: EventForEditData;
  options: CreateEventOptions;
};

type TicketTypeForm = {
  localId: string;
  id: string | null;
  name: string;
  description: string;
  price: string;
  quantity: string;
  maxPerOrder: string;
  saleStartsAt: string;
  saleEndsAt: string;
  isActive: boolean;
  soldCount: number;
};

type ExistingImageItem = {
  kind: "existing";
  localId: string;
  id: string;
  path: string;
  publicUrl: string;
  previewUrl: string;
  originalName: string;
};

type NewImageItem = {
  kind: "new";
  localId: string;
  file: File;
  previewUrl: string;
  originalName: string;
};

type EditableImageItem = ExistingImageItem | NewImageItem;

type UploadedEventImage = {
  path: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
};

type UpdateEventApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
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

const MAXIMUM_IMAGES = 5;
const MAXIMUM_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const inputClassName =
  "h-12 w-full rounded-xl border border-white/[0.1] bg-[#050b0f] px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50";

function createTicketType(
  index: number,
  defaultMaxPerOrder: number,
): TicketTypeForm {
  return {
    localId: crypto.randomUUID(),
    id: null,
    name: `Billet ${index + 1}`,
    description: "",
    price: "",
    quantity: "",
    maxPerOrder: String(defaultMaxPerOrder),
    saleStartsAt: "",
    saleEndsAt: "",
    isActive: true,
    soldCount: 0,
  };
}

function normalizeNumberInput(value: string): number {
  const parsed = Number(
    value.trim().replace(/\s/g, "").replace(",", "."),
  );

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

function toIsoDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatFileSize(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.ceil(value / 1024).toLocaleString("fr-FR")} Ko`;
  }

  return `${(value / (1024 * 1024)).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} Mo`;
}

function getStatusLabel(status: EventForEditData["status"]): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "PENDING":
      return "En cours d’examen";
    case "PUBLISHED":
      return "Publié";
    case "SUSPENDED":
      return "Suspendu";
    case "CANCELLED":
      return "Annulé";
    case "COMPLETED":
      return "Terminé";
    default:
      return status;
  }
}

export default function EditEventForm({
  event,
  options,
}: EditEventFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    categoryId: event.categoryId ?? "",
    title: event.title,
    description: event.description,
    venueName: event.venueName,
    address: event.address,
    city: event.city,
    countryCode: event.countryCode,
    country: event.country,
    timezone: event.timezone,
    startsAt: event.startsAtInput,
    endsAt: event.endsAtInput,
    salesStartAt: event.salesStartAtInput,
    salesEndAt: event.salesEndAtInput,
    currency: event.currency,
  });

  const [images, setImages] = useState<EditableImageItem[]>(() =>
    event.images.map((image) => ({
      kind: "existing" as const,
      localId: image.id,
      id: image.id,
      path: image.path,
      publicUrl: image.publicUrl,
      previewUrl: image.publicUrl,
      originalName: `Image ${image.position + 1}`,
    })),
  );

  const [coverIndex, setCoverIndex] = useState(() => {
    const index = event.images.findIndex((image) => image.isCover);
    return index >= 0 ? index : 0;
  });

  const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>(() =>
    event.ticketTypes.map((ticketType) => ({
      localId: ticketType.id,
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      price: String(ticketType.price),
      quantity: String(ticketType.quantity),
      maxPerOrder: String(ticketType.maxPerOrder),
      saleStartsAt: ticketType.saleStartsAtInput,
      saleEndsAt: ticketType.saleEndsAtInput,
      isActive: ticketType.isActive,
      soldCount: ticketType.soldCount,
    })),
  );

  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"SAVE" | "SUBMIT" | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.kind === "new") {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, [images]);

  const selectedCategory = options.categories.find(
    (category) => category.id === form.categoryId,
  );

  const selectedCountry = options.countries.find(
    (country) => country.code === form.countryCode,
  );

  const selectedCurrency = options.currencies.find(
    (currency) => currency.code === form.currency,
  );

  const currencyLocked =
    event.totals.ticketsSold > 0;

  const projection = useMemo(() => {
    try {
      return calculateEventRevenueProjection(
        ticketTypes.map((ticketType) => ({
          id: ticketType.localId,
          name: ticketType.name.trim() || "Billet sans nom",
          unitPrice: normalizeNumberInput(ticketType.price),
          quantity: Math.max(
            Math.trunc(normalizeNumberInput(ticketType.quantity)),
            0,
          ),
        })),
        {
          currency: form.currency,
          platformFeePercent: options.rules.platformFeePercent,
        },
      );
    } catch (projectionError) {
      if (projectionError instanceof PricingValidationError) {
        return null;
      }

      return null;
    }
  }, [form.currency, options.rules.platformFeePercent, ticketTypes]);

  const formProgress = useMemo(() => {
    const checks = [
      Boolean(form.title.trim()),
      Boolean(form.categoryId),
      form.description.trim().length >= options.rules.minimumDescriptionLength,
      Boolean(form.venueName.trim()),
      Boolean(form.address.trim()),
      Boolean(form.city.trim()),
      Boolean(form.startsAt),
      images.length > 0,
      ticketTypes.length > 0 &&
        ticketTypes.every(
          (ticketType) =>
            ticketType.name.trim() &&
            normalizeNumberInput(ticketType.quantity) > 0 &&
            normalizeNumberInput(ticketType.price) >= 0,
        ),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, images.length, options.rules.minimumDescriptionLength, ticketTypes]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
    setFieldErrors({});
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    clearMessages();
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleCountryChange(countryCode: string) {
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
      timezone: country.timezone,
      currency: currencyLocked
        ? current.currency
        : country.currency,
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
          ? { ...ticketType, [field]: value }
          : ticketType,
      ),
    );
  }

  function addTicketType() {
    if (ticketTypes.length >= options.rules.maxTicketTypes) {
      setError(
        `Vous ne pouvez pas ajouter plus de ${options.rules.maxTicketTypes} types de billets.`,
      );
      return;
    }

    clearMessages();
    setTicketTypes((current) => [
      ...current,
      createTicketType(current.length, options.rules.defaultMaxPerOrder),
    ]);
  }

  function removeTicketType(localId: string) {
    const ticketType = ticketTypes.find((item) => item.localId === localId);
    if (!ticketType) return;

    if (ticketTypes.length === 1) {
      setError("L’événement doit contenir au moins un type de billet.");
      return;
    }

    if (ticketType.soldCount > 0) {
      setError(
        `Le billet « ${ticketType.name} » a déjà été vendu et ne peut pas être supprimé.`,
      );
      return;
    }

    clearMessages();
    setTicketTypes((current) =>
      current.filter((item) => item.localId !== localId),
    );
  }

  function validateImageFile(file: File): string | null {
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      )
    ) {
      return `Le format de l’image « ${file.name} » n’est pas accepté. Utilisez JPG, PNG ou WebP.`;
    }

    if (file.size <= 0) {
      return `L’image « ${file.name} » est vide.`;
    }

    if (file.size > MAXIMUM_IMAGE_SIZE_BYTES) {
      return `L’image « ${file.name} » dépasse 5 Mo.`;
    }

    return null;
  }

  function addImageFiles(files: File[]) {
    if (isSubmitting || isUploadingImages) return;

    clearMessages();
    const remaining = MAXIMUM_IMAGES - images.length;

    if (remaining <= 0) {
      setError("Vous pouvez conserver au maximum 5 images.");
      return;
    }

    if (files.length > remaining) {
      setError(
        `Vous pouvez encore ajouter ${remaining} image${remaining > 1 ? "s" : ""}.`,
      );
      return;
    }

    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const newImages = files.map(
      (file): NewImageItem => ({
        kind: "new",
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        originalName: file.name,
      }),
    );

    setImages((current) => [...current, ...newImages]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleImageInput(eventObject: ChangeEvent<HTMLInputElement>) {
    addImageFiles(Array.from(eventObject.target.files ?? []));
  }

  function removeImage(localId: string) {
    if (images.length === 1) {
      setError("L’événement doit conserver au moins une image.");
      return;
    }

    const index = images.findIndex((image) => image.localId === localId);
    if (index < 0) return;

    const removed = images[index];
    if (removed.kind === "new") {
      URL.revokeObjectURL(removed.previewUrl);
    }

    const nextImages = images.filter((image) => image.localId !== localId);
    let nextCover = coverIndex;

    if (index === coverIndex) nextCover = 0;
    else if (index < coverIndex) nextCover -= 1;

    clearMessages();
    setImages(nextImages);
    setCoverIndex(
      Math.max(0, Math.min(nextCover, nextImages.length - 1)),
    );
  }

  function validateClientForm(): string | null {
    if (!form.title.trim()) return "Renseignez le titre de l’événement.";
    if (!form.categoryId) return "Sélectionnez une catégorie.";

    if (
      form.description.trim().length < options.rules.minimumDescriptionLength
    ) {
      return `La description doit contenir au moins ${options.rules.minimumDescriptionLength} caractères.`;
    }

    if (!form.venueName.trim() || !form.address.trim() || !form.city.trim()) {
      return "Complétez toutes les informations du lieu.";
    }

    if (!form.startsAt) {
      return "Renseignez la date et l’heure de début.";
    }

    if (
      form.endsAt &&
      new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()
    ) {
      return "La date de fin doit être postérieure à la date de début.";
    }

    if (images.length === 0) {
      return "Conservez ou ajoutez au moins une image.";
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

    if (
      currencyLocked &&
      form.currency !== event.currency
    ) {
      return "La devise ne peut plus être modifiée après la première vente.";
    }

    for (const ticketType of ticketTypes) {
      if (!ticketType.name.trim()) {
        return "Chaque type de billet doit avoir un nom.";
      }

      const quantity = Math.trunc(normalizeNumberInput(ticketType.quantity));
      if (quantity <= 0) {
        return `La quantité du billet « ${ticketType.name} » doit être supérieure à zéro.`;
      }

      if (quantity < ticketType.soldCount) {
        return `La quantité du billet « ${ticketType.name} » ne peut pas être inférieure aux ${ticketType.soldCount} billets déjà vendus.`;
      }

      if (normalizeNumberInput(ticketType.price) < 0) {
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

  async function uploadNewImages(): Promise<Map<string, UploadedEventImage>> {
    const newImages = images.filter(
      (image): image is NewImageItem => image.kind === "new",
    );

    if (newImages.length === 0) return new Map();

    const formData = new FormData();
    newImages.forEach((image) => formData.append("images", image.file));
    formData.append("coverIndex", "0");

    setIsUploadingImages(true);

    try {
      const response = await fetch("/api/organizer/events/images", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        images?: UploadedEventImage[];
      };

      if (!response.ok || !result.images) {
        throw new Error(
          result.message ?? "Les nouvelles images n’ont pas pu être téléversées.",
        );
      }

      const uploadedMap = new Map<string, UploadedEventImage>();
      newImages.forEach((image, index) => {
        const uploaded = result.images?.[index];
        if (!uploaded) {
          throw new Error(
            "Une image téléversée est absente de la réponse du serveur.",
          );
        }

        uploadedMap.set(image.localId, uploaded);
      });

      return uploadedMap;
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function submitEvent(publicationMode: "SAVE" | "SUBMIT") {
    clearMessages();

    const validationError = validateClientForm();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    setSubmitMode(publicationMode);

    try {
      const uploadedMap = await uploadNewImages();

      const finalImages = images.map((image, index) => {
        const isCover = index === coverIndex;

        if (image.kind === "existing") {
          return {
            id: image.id,
            path: image.path,
            publicUrl: image.publicUrl,
            position: index,
            isCover,
          };
        }

        const uploaded = uploadedMap.get(image.localId);
        if (!uploaded) {
          throw new Error(
            `L’image « ${image.originalName} » n’a pas été téléversée correctement.`,
          );
        }

        return {
          id: null,
          path: uploaded.path,
          publicUrl: uploaded.publicUrl,
          position: index,
          isCover,
        };
      });

      const response = await fetch(
        `/api/organizer/events/${encodeURIComponent(event.id)}/update`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            categoryId: form.categoryId,
            title: form.title.trim(),
            description: form.description.trim(),
            venueName: form.venueName.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            country: form.country,
            countryCode: form.countryCode,
            timezone: form.timezone,
            startsAt: toIsoDate(form.startsAt),
            endsAt: toIsoDate(form.endsAt),
            salesStartAt: toIsoDate(form.salesStartAt),
            salesEndAt: toIsoDate(form.salesEndAt),
            currency: form.currency,
            publicationMode,
            images: finalImages,
            ticketTypes: ticketTypes.map((ticketType) => ({
              id: ticketType.id,
              name: ticketType.name.trim(),
              description: ticketType.description.trim() || null,
              price: normalizeNumberInput(ticketType.price),
              quantity: Math.trunc(normalizeNumberInput(ticketType.quantity)),
              maxPerOrder: Math.trunc(
                normalizeNumberInput(ticketType.maxPerOrder),
              ),
              saleStartsAt: toIsoDate(ticketType.saleStartsAt),
              saleEndsAt: toIsoDate(ticketType.saleEndsAt),
              isActive: ticketType.isActive,
            })),
          }),
        },
      );

      const result = (await response.json()) as UpdateEventApiResponse;

      if (!response.ok) {
        setFieldErrors(result.fields ?? {});
        throw new Error(result.message ?? "Impossible de modifier l’événement.");
      }

      setSuccessMessage(
        result.message ?? "Les modifications ont été enregistrées.",
      );

      window.setTimeout(() => {
        router.push(result.redirectTo ?? `/organizer/events/${event.id}`);
        router.refresh();
      }, 800);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de modifier l’événement.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
      setSubmitMode(null);
    }
  }

  function handleSubmit(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    void submitEvent("SAVE");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#081015] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href={`/organizer/events/${event.id}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                Modifier l’événement
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black text-orange-300">
                <BadgeCheck className="h-3.5 w-3.5" />
                {getStatusLabel(event.status)}
              </span>
            </div>

            <p className="mt-1 line-clamp-1 text-sm text-neutral-500">
              {event.title}
            </p>
          </div>
        </div>

        <div className="min-w-[180px]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Progression</span>
            <span className="font-bold text-lime-400">{formProgress} %</span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500"
              style={{ width: `${formProgress}%` }}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <FormSection
            icon={FileText}
            title="Informations générales"
            description="Modifiez la présentation et la catégorie de l’événement."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Titre de l’événement"
                required
                error={fieldErrors.title?.[0]}
                className="md:col-span-2"
              >
                <input
                  value={form.title}
                  onChange={(inputEvent) =>
                    updateForm("title", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Catégorie"
                required
                error={fieldErrors.categoryId?.[0]}
              >
                <div className="relative">
                  <select
                    value={form.categoryId}
                    onChange={(selectEvent) =>
                      updateForm("categoryId", selectEvent.target.value)
                    }
                    className={`${inputClassName} appearance-none pr-11`}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {options.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </Field>

              <div className="md:col-span-2">
                <ImagesEditor
                  images={images}
                  coverIndex={coverIndex}
                  disabled={isSubmitting || isUploadingImages}
                  isDragging={isDragging}
                  inputRef={inputRef}
                  onInputChange={handleImageInput}
                  onRemove={removeImage}
                  onSelectCover={setCoverIndex}
                  onDragEnter={(dragEvent) => {
                    dragEvent.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(dragEvent) => {
                    dragEvent.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(dragEvent) => {
                    dragEvent.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(dragEvent) => {
                    dragEvent.preventDefault();
                    setIsDragging(false);
                    addImageFiles(Array.from(dragEvent.dataTransfer.files));
                  }}
                />
              </div>

              <Field
                label="Description"
                required
                error={fieldErrors.description?.[0]}
                className="md:col-span-2"
              >
                <textarea
                  value={form.description}
                  onChange={(inputEvent) =>
                    updateForm("description", inputEvent.target.value)
                  }
                  rows={7}
                  className={`${inputClassName} h-auto resize-y py-3.5 leading-6`}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={MapPin}
            title="Lieu de l’événement"
            description="Mettez à jour le pays, la ville et l’adresse."
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
                    onChange={(selectEvent) =>
                      handleCountryChange(selectEvent.target.value)
                    }
                    className={`${inputClassName} appearance-none pr-11`}
                  >
                    {options.countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </Field>

              <Field label="Ville" required error={fieldErrors.city?.[0]}>
                <input
                  value={form.city}
                  onChange={(inputEvent) =>
                    updateForm("city", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Nom du lieu"
                required
                error={fieldErrors.venueName?.[0]}
              >
                <input
                  value={form.venueName}
                  onChange={(inputEvent) =>
                    updateForm("venueName", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Adresse complète"
                required
                error={fieldErrors.address?.[0]}
              >
                <input
                  value={form.address}
                  onChange={(inputEvent) =>
                    updateForm("address", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={CalendarDays}
            title="Dates et horaires"
            description="Modifiez les dates de l’événement et des ventes."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Début de l’événement"
                required
                error={fieldErrors.startsAt?.[0]}
              >
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(inputEvent) =>
                    updateForm("startsAt", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Fin de l’événement" error={fieldErrors.endsAt?.[0]}>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(inputEvent) =>
                    updateForm("endsAt", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Ouverture générale des ventes">
                <input
                  type="datetime-local"
                  value={form.salesStartAt}
                  onChange={(inputEvent) =>
                    updateForm("salesStartAt", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Fermeture générale des ventes">
                <input
                  type="datetime-local"
                  value={form.salesEndAt}
                  onChange={(inputEvent) =>
                    updateForm("salesEndAt", inputEvent.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
                <InfoValue
                  icon={Clock3}
                  label="Fuseau horaire"
                  value={form.timezone}
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
                      disabled={currencyLocked}
                      onChange={(selectEvent) =>
                        updateForm(
                          "currency",
                          selectEvent.target.value,
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

                  <p
                    className={`mt-2 text-[11px] leading-5 ${
                      currencyLocked
                        ? "text-orange-300"
                        : "text-neutral-600"
                    }`}
                  >
                    {currencyLocked
                      ? `Devise verrouillée après ${event.totals.ticketsSold.toLocaleString(
                          "fr-FR",
                        )} billet(s) vendu(s).`
                      : `Devise recommandée pour ${
                          selectedCountry?.name ??
                          form.country
                        } : ${
                          selectedCountry?.currency ??
                          options.rules.defaultCurrency
                        }.`}
                  </p>
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={TicketCheck}
            title="Billets et tarifs"
            description="Modifiez les offres sans réduire une quantité sous les ventes existantes."
            action={
              <button
                type="button"
                onClick={addTicketType}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 text-xs font-bold text-lime-400"
              >
                <Plus className="h-4 w-4" />
                Ajouter un billet
              </button>
            }
          >
            <div className="space-y-4">
              {ticketTypes.map((ticketType, index) => (
                <TicketTypeEditor
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
                  platformFeePercent={options.rules.platformFeePercent}
                  canDelete={
                    ticketTypes.length > 1 && ticketType.soldCount === 0
                  }
                  onUpdate={updateTicketType}
                  onRemove={removeTicketType}
                />
              ))}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-[112px]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
            <header className="border-b border-white/[0.07] px-4 py-4">
              <div className="flex items-center gap-2.5">
                <WalletCards className="h-5 w-5 text-lime-400" />
                <h2 className="text-base font-black text-white">
                  Estimation financière
                </h2>
              </div>
            </header>

            <div className="space-y-3 p-4">
              <SummaryLine
                label="Capacité totale"
                value={`${(projection?.totalCapacity ?? 0).toLocaleString("fr-FR")} billets`}
                icon={UsersRound}
              />
              <SummaryLine
                label="Billets déjà vendus"
                value={event.totals.ticketsSold.toLocaleString("fr-FR")}
                icon={TicketCheck}
              />
              <SummaryLine
                label="Chiffre d’affaires potentiel"
                value={formatMoney({
                  amount:
                    projection?.grossRevenue ??
                    0,
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
                    projection?.platformFee ??
                    0,
                  currency: form.currency,
                  locale:
                    selectedCountry?.locale ??
                    "fr-FR",
                })}
                icon={ShieldCheck}
                tone="orange"
              />
              <SummaryLine
                label="Revenu net potentiel"
                value={formatMoney({
                  amount:
                    projection?.organizerNet ??
                    0,
                  currency: form.currency,
                  locale:
                    selectedCountry?.locale ??
                    "fr-FR",
                })}
                icon={WalletCards}
                tone="green"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#081015] p-4">
            <h2 className="text-sm font-black text-white">Aperçu</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#050b0f]">
              <div className="flex h-36 items-center justify-center overflow-hidden bg-black">
                {images[coverIndex]?.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[coverIndex].previewUrl}
                    alt="Aperçu de la couverture"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-neutral-700" />
                )}
              </div>

              <div className="p-4">
                <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-bold text-lime-400">
                  {selectedCategory?.name ?? "Catégorie"}
                </span>
                <h3 className="mt-3 line-clamp-2 text-sm font-black text-white">
                  {form.title.trim() || "Titre de l’événement"}
                </h3>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/[0.09] bg-[#050b0f]/95 p-3 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="hidden max-w-md text-xs leading-5 text-neutral-500 lg:block">
          Enregistrez les modifications ou renvoyez l’événement pour validation.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={isSubmitting || isUploadingImages}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-300 disabled:opacity-50"
          >
            {isSubmitting && submitMode === "SAVE" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer les modifications
          </button>

          <button
            type="button"
            onClick={() => void submitEvent("SUBMIT")}
            disabled={isSubmitting || isUploadingImages}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white disabled:opacity-50"
          >
            {isSubmitting && submitMode === "SUBMIT" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Envoyer pour validation
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </form>
  );
}

type IconComponent = typeof FileText;

function FormSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
            <Icon className="h-[18px] w-[18px] text-lime-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          </div>
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required = false,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-neutral-300">
        {label}
        {required && <span className="ml-1 text-orange-400">*</span>}
      </span>
      {children}
      {error && <span className="mt-2 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function InfoValue({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-lime-400" />
      <div className="min-w-0">
        <p className="text-[11px] text-neutral-600">{label}</p>
        <p className="mt-1 truncate text-xs font-bold text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function ImagesEditor({
  images,
  coverIndex,
  disabled,
  isDragging,
  inputRef,
  onInputChange,
  onRemove,
  onSelectCover,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  images: EditableImageItem[];
  coverIndex: number;
  disabled: boolean;
  isDragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (localId: string) => void;
  onSelectCover: (index: number) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050b0f]">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.07] p-4">
        <div>
          <h3 className="text-sm font-black text-white">Images de l’événement</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Conservez, supprimez ou ajoutez jusqu’à 5 images.
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-white">
          {images.length} / {MAXIMUM_IMAGES}
        </span>
      </header>

      <div className="p-4">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          disabled={disabled || images.length >= MAXIMUM_IMAGES}
          onChange={onInputChange}
          className="sr-only"
        />

        {images.length < MAXIMUM_IMAGES && (
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && inputRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-6 text-center transition ${
              isDragging
                ? "border-lime-400/60 bg-emerald-500/10"
                : "border-white/[0.12] bg-white/[0.018] hover:border-emerald-500/40"
            }`}
          >
            <UploadCloud className="h-6 w-6 text-lime-400" />
            <p className="mt-3 text-sm font-black text-white">Ajouter des images</p>
            <p className="mt-1 text-xs text-neutral-500">
              JPG, PNG ou WebP — 5 Mo maximum
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => {
            const isCover = index === coverIndex;

            return (
              <article
                key={image.localId}
                className={`overflow-hidden rounded-2xl border ${
                  isCover
                    ? "border-lime-400/45 bg-emerald-500/[0.05]"
                    : "border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt={`Image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove(image.localId)}
                    className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white hover:bg-red-500/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {isCover && (
                    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg bg-black/75 px-2.5 py-1.5 text-[10px] font-black text-lime-400">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Principale
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <p className="truncate text-xs font-bold text-white">
                    {image.originalName}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-600">
                    <span>
                      {image.kind === "existing"
                        ? "Déjà enregistrée"
                        : image.file.type.replace("image/", "")}
                    </span>
                    {image.kind === "new" && (
                      <span>{formatFileSize(image.file.size)}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={disabled || isCover}
                    onClick={() => onSelectCover(index)}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] text-[11px] font-bold text-neutral-400 disabled:text-lime-400"
                  >
                    <Star className="h-3.5 w-3.5" />
                    {isCover ? "Image principale" : "Définir comme principale"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TicketTypeEditor({
  index,
  ticketType,
  currency,
  currencySymbol,
  currencyDecimals,
  platformFeePercent,
  canDelete,
  onUpdate,
  onRemove,
}: {
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
}) {
  const price = normalizeNumberInput(ticketType.price);
  const quantity = Math.max(
    Math.trunc(normalizeNumberInput(ticketType.quantity)),
    0,
  );
  const gross = price * quantity;
  const fee = gross * (platformFeePercent / 100);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#050b0f] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-sm font-black text-lime-400">
            {index + 1}
          </span>
          <div>
            <h3 className="text-sm font-black text-white">{ticketType.name}</h3>
            <p className="mt-0.5 text-[11px] text-neutral-600">
              {ticketType.soldCount.toLocaleString("fr-FR")} billet(s) déjà vendu(s)
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!canDelete}
          onClick={() => onRemove(ticketType.localId)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-600 disabled:opacity-25"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Nom du billet" required>
          <input
            value={ticketType.name}
            onChange={(inputEvent) =>
              onUpdate(ticketType.localId, "name", inputEvent.target.value)
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Description">
          <input
            value={ticketType.description}
            onChange={(inputEvent) =>
              onUpdate(
                ticketType.localId,
                "description",
                inputEvent.target.value,
              )
            }
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
            onChange={(inputEvent) =>
              onUpdate(
                ticketType.localId,
                "price",
                inputEvent.target.value.replace(
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

        <Field label="Quantité totale" required>
          <input
            type="number"
            min={Math.max(ticketType.soldCount, 1)}
            value={ticketType.quantity}
            onChange={(inputEvent) =>
              onUpdate(ticketType.localId, "quantity", inputEvent.target.value)
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Maximum par commande">
          <input
            type="number"
            min={1}
            max={100}
            value={ticketType.maxPerOrder}
            onChange={(inputEvent) =>
              onUpdate(
                ticketType.localId,
                "maxPerOrder",
                inputEvent.target.value,
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
              onChange={(inputEvent) =>
                onUpdate(
                  ticketType.localId,
                  "isActive",
                  inputEvent.target.checked,
                )
              }
              className="peer sr-only"
            />
            <span className="relative h-6 w-11 rounded-full bg-neutral-700 transition peer-checked:bg-emerald-500">
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
            </span>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <SmallMetric
          label="Revenu brut potentiel"
          value={formatMoney({
            amount: gross,
            currency,
          })}
        />
        <SmallMetric
          label="Commission Tikemia"
          value={formatMoney({
            amount: fee,
            currency,
          })}
          tone="orange"
        />
        <SmallMetric
          label="Revenu net potentiel"
          value={formatMoney({
            amount: gross - fee,
            currency,
          })}
          tone="green"
        />
      </div>
    </article>
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
  icon: IconComponent;
  tone?: "neutral" | "orange" | "green";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <Icon
        className={`h-4 w-4 shrink-0 ${
          tone === "green"
            ? "text-lime-400"
            : tone === "orange"
              ? "text-orange-400"
              : "text-neutral-500"
        }`}
      />
      <div className="min-w-0">
        <p className="text-[10px] text-neutral-600">{label}</p>
        <p className="mt-1 break-words text-xs font-black text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "orange" | "green";
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="text-[10px] text-neutral-600">{label}</p>
      <p
        className={`mt-1 break-words text-xs font-black ${
          tone === "green"
            ? "text-lime-400"
            : tone === "orange"
              ? "text-orange-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}