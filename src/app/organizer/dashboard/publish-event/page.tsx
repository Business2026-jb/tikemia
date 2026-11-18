
"use client";
import { EVENT_CATEGORY_DEFINITIONS, EVENT_CATEGORY_NAMES } from "@/i18n/config";
import {
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  currencyDecimals,
  currencyLabel,
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";




import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Church,
  Clock3,
  Drama,
  Ellipsis,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  LoaderCircle,
  MapPin,
  Martini,
  Music2,
  Palmtree,
  Save,
  Send,
  Tent,
  Trophy,
  UsersRound,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  getCountries,
  type CountryCode,
} from "libphonenumber-js";

import EventImageUploader from "@/components/organizer/EventImageUploader";

import EventTicketCategories, {
  type EventTicketCategory,
} from "@/components/organizer/EventTicketCategories";



/* ============================================
   TIKEMIA — PUBLIER / MODIFIER ÉVÉNEMENT

   Route :
   /organizer/dashboard/publish-event

   Mode publication :
   /organizer/dashboard/publish-event

   Mode modification :
   /organizer/dashboard/publish-event?edit=ID

   Fonctionnalités :
   - Publication POST
   - Préremplissage GET
   - Modification PATCH
   - 12 catégories
   - Images existantes et nouvelles
   - Description
   - Pays, ville, adresse
   - Capacité
   - Date unique
   - Période début / fin
   - Événement en continu
   - Catégories de billets
   - Français / Anglais
   - Responsive PC / Mobile

   Les menus sont gérés par le layout
   organisateur déjà existant.
============================================ */

/* ============================================
   CONFIGURATION
============================================ */

const ROUTES = {
  dashboard: "/organizer/dashboard",

  events: "/organizer/dashboard/events",

  geo: "/api/geo",

  eventsApi: "/api/organizer/events",

  imagesApi: "/api/organizer/events/images",
} as const;

const MAX_DESCRIPTION = 2000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CAPACITY = 1_000_000;
const MAX_TICKET_PRICE = 999_999_999;

type ScheduleType =
  | "SINGLE_DATE"
  | "DATE_RANGE"
  | "CONTINUOUS";

type CategoryKey =
  | "concerts"
  | "culture"
  | "formation"
  | "soirees"
  | "tourisme"
  | "sport"
  | "festival"
  | "science"
  | "religieux"
  | "gastronomie"
  | "business"
  | "autres";

type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type EventCategory = {
  key: CategoryKey;
  icon: LucideIcon;
  color: string;
};

type StoredImage = {
  id: string;
  url: string | null;
  position?: number;
};

type EditableEvent = {
  id: string;
  title: string;
  description: string;
  category: string;

  countryCode: string;
  city: string;
  address: string;

  timezone: string;
  currency: Currency;
  capacity: number;

  scheduleType: ScheduleType;
  startDate: string;
  startTime: string;
  endDate: string | null;
  endTime: string | null;

  images: StoredImage[];

  ticketCategories: {
    id: string;
    name: string;
    price: string | number;
    inputPrice?: string;
    quantity: string | number;
  }[];
};

type EventDetailsResponse = {
  success?: boolean;
  message?: string;
  event?: EditableEvent;
};

type UploadResponse = {
  success?: boolean;
  message?: string;
  images?: {
    id: string;
  }[];
};

type SaveResponse = {
  success?: boolean;
  message?: string;
  event?: {
    id: string;
    status: string;
  };
};

type GeoResponse = {
  success?: boolean;
  countryCode?: string | null;
};

const IMAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================
   CATÉGORIES
============================================ */

const EVENT_CATEGORIES: EventCategory[] = EVENT_CATEGORY_DEFINITIONS.map(item => ({ ...item, icon: ({ Music2, Drama, GraduationCap, Martini, Palmtree, Trophy, Tent, FlaskConical, Church, UtensilsCrossed, BriefcaseBusiness, Ellipsis })[item.icon] }));

const CATEGORY_NAMES: Record<
  Locale,
  Record<CategoryKey, string>
> = EVENT_CATEGORY_NAMES;

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    publishTitle: "Publier un événement",
    editTitle: "Modifier un événement",

    publishSubtitle:
      "Créez et publiez votre événement.",
    editSubtitle:
      "Modifiez les informations de votre événement.",

    name: "Nom de l'événement",
    namePlaceholder:
      "Ex. Grand Concert International",

    category: "Catégorie",
    selectCategory: "Sélectionner une catégorie",

    description: "Description de l'événement",
    descriptionPlaceholder:
      "Décrivez votre événement (programme, artistes, informations utiles, etc.)",

    existingImages: "Images enregistrées",
    existingImagesEmpty: "Aucune image conservée",
    removeImage: "Retirer cette image",

    location: "Lieu de l'événement",

    country: "Pays",
    selectCountry: "Sélectionner un pays",

    city: "Ville",
    cityPlaceholder: "Ex. Cotonou",

    address: "Adresse",
    addressPlaceholder:
      "Ex. Palais des Congrès, Boulevard de la Marina",

    capacity: "Nombre total de places disponibles",
    capacityPlaceholder: "Ex. 5000",

    startTime: "Heure de début",
    endTime: "Heure de fin (optionnel)",

    period: "Période de l'événement",

    single: "Événement sur une seule date",

    range:
      "Événement avec une date de début et une date de fin",

    continuous:
      "Événement récurrent (en cours tous les jours)",

    eventDate: "Date de l'événement",
    startDate: "Date de début",
    endDate: "Date de fin",
    optionalEndDate: "Date de fin (optionnel)",

    

    timezone: "Fuseau horaire",
    currency: "Devise",

    publish: "Publier son événement",
    save: "Enregistrer les modifications",

    loading: "Chargement de l'événement...",
    uploading: "Envoi des images...",
    publishing: "Publication en cours...",
    saving: "Enregistrement en cours...",

    published:
      "Evenement publie.",
    saved:
      "Les modifications ont été enregistrées.",

    back: "Retour à mes événements",

    loadError:
      "Impossible de charger cet événement.",
    invalidId: "Identifiant d'événement invalide.",
    nameError: "Saisissez un nom d'événement valide.",
    categoryError: "Sélectionnez une catégorie.",
    descriptionError:
      "La description doit contenir entre 10 et 2000 caractères.",
    imagesError:
      "Conservez ou ajoutez entre 1 et 10 images.",
    imageSizeError:
      "Une image dépasse la limite de 10 Mo.",
    countryError: "Sélectionnez un pays.",
    cityError: "Saisissez une ville valide.",
    addressError: "Saisissez une adresse valide.",
    timezoneError:
      "Indiquez un fuseau horaire valide.",
    capacityError:
      "Indiquez un nombre de places valide.",
    dateError: "Sélectionnez une date valide.",
    timeError: "Indiquez une heure de début valide.",
    endDateError:
      "La fin doit être postérieure au début.",
    ticketError:
      "Vérifiez les catégories, prix et quantités des billets.",
    ticketCapacityError:
      "Le total des places des billets doit correspondre à la capacité.",
    networkError:
      "Connexion impossible. Veuillez réessayer.",
    serverError:
      "Impossible d'enregistrer l'événement.",
  },

  en: {
    publishTitle: "Publish an event",
    editTitle: "Edit an event",

    publishSubtitle:
      "Create and publish your event.",
    editSubtitle:
      "Update your event information.",

    name: "Event name",
    namePlaceholder:
      "e.g. International Concert",

    category: "Category",
    selectCategory: "Select a category",

    description: "Event description",
    descriptionPlaceholder:
      "Describe your event (program, artists, useful information, etc.)",

    existingImages: "Saved images",
    existingImagesEmpty: "No saved images retained",
    removeImage: "Remove this image",

    location: "Event location",

    country: "Country",
    selectCountry: "Select a country",

    city: "City",
    cityPlaceholder: "e.g. Cotonou",

    address: "Address",
    addressPlaceholder:
      "e.g. Congress Center, Marina Boulevard",

    capacity: "Total available seats",
    capacityPlaceholder: "e.g. 5000",

    startTime: "Start time",
    endTime: "End time (optional)",

    period: "Event period",

    single: "Event on a single date",

    range: "Event with start and end dates",

    continuous: "Recurring event (every day)",

    eventDate: "Event date",
    startDate: "Start date",
    endDate: "End date",
    optionalEndDate: "End date (optional)",

    

    timezone: "Time zone",
    currency: "Currency",

    publish: "Publish event",
    save: "Save changes",

    loading: "Loading event...",
    uploading: "Uploading images...",
    publishing: "Publishing...",
    saving: "Saving changes...",

    published:
      "Your event is published.",
    saved: "Changes saved successfully.",

    back: "Back to my events",

    loadError: "Unable to load this event.",
    invalidId: "Invalid event ID.",
    nameError: "Enter a valid event name.",
    categoryError: "Select a category.",
    descriptionError:
      "Description must contain 10 to 2000 characters.",
    imagesError:
      "Keep or add between 1 and 10 images.",
    imageSizeError:
      "An image exceeds the 10 MB limit.",
    countryError: "Select a country.",
    cityError: "Enter a valid city.",
    addressError: "Enter a valid address.",
    timezoneError: "Enter a valid time zone.",
    capacityError: "Enter a valid number of seats.",
    dateError: "Select a valid date.",
    timeError: "Enter a valid start time.",
    endDateError:
      "The end must be later than the start.",
    ticketError:
      "Check ticket categories, prices and quantities.",
    ticketCapacityError:
      "Ticket quantities must equal the capacity.",
    networkError:
      "Connection failed. Please try again.",
    serverError: "Unable to save the event.",
  },
} as const;

/* ============================================
   STYLES
============================================ */

const FIELD_CLASS = [
  "h-11 w-full min-w-0",
  "rounded-lg border border-[#cbd5e1]",
  "bg-white px-3 text-sm text-[#10213b]",
  "outline-none transition-colors",
  "placeholder:text-gray-400",
  "focus:border-green-600",
  "focus:ring-2 focus:ring-green-100",
  "disabled:cursor-not-allowed",
  "disabled:opacity-60",
].join(" ");

const LABEL_CLASS = [
  "mb-1.5 block text-xs",
  "font-extrabold text-[#101828]",
  "sm:text-sm",
].join(" ");

const SECTION_CLASS = [
  "w-full min-w-0",
  "rounded-2xl border border-[#e5e9ee]",
  "bg-white p-3 shadow-sm sm:p-4",
].join(" ");

/* ============================================
   UTILITAIRES
============================================ */

function makeTicketCategory(): EventTicketCategory {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: "",
    quantity: "",
  };
}

function getFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🌍";
  }

  return String.fromCodePoint(
    ...Array.from(code).map(
      (letter) => 127397 + letter.charCodeAt(0)
    )
  );
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hour, minute] = value
    .split(":")
    .map(Number);

  return (
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", {
      timeZone: value,
    });

    return true;
  } catch {
    return false;
  }
}

function isValidPositiveInteger(
  value: string,
  maximum: number
): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  const parsed = Number(value);

  return (
    Number.isSafeInteger(parsed) &&
    parsed > 0 &&
    parsed <= maximum
  );
}

function isValidPrice(value: string, currency: Currency): boolean {
 const normalized = value.replace(",", ".");
 if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalized)) return false;
 const amount = Number(normalized);
 return Number.isFinite(amount) && amount >= 0 && amount <= MAX_TICKET_PRICE && (currencyDecimals(currency) !== 0 || Number.isInteger(amount));
}

function isValidImageUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/* ============================================
   PAGE PRINCIPALE
============================================ */


function subscribeBrowserSettings(callback: () => void) {
 window.addEventListener("popstate", callback);
 return () => window.removeEventListener("popstate", callback);
}

export default function PublishEventPage() {
  const uploadCache = useRef<{ files: File[]; ids: string[] } | null>(null);
  const publicationAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  /* ==========================================
     MODE PUBLICATION / MODIFICATION
  ========================================== */

  const [editId, setEditId] = useState<
    string | null
  >(null);

  const [checkingMode, setCheckingMode] =
    useState(true);

  const [loadingEvent, setLoadingEvent] =
    useState(false);

  const [loadError, setLoadError] = useState("");

  const isEditMode = editId !== null;

  /* ==========================================
     LANGUE
  ========================================== */

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const t = TEXT[locale];

  /* ==========================================
     FORMULAIRE
  ========================================== */

  const [title, setTitle] = useState("");

  const [category, setCategory] =
    useState<CategoryKey | "">("");

  const [description, setDescription] =
    useState("");

  const [newImages, setNewImages] =
    useState<File[]>([]);

  const [storedImages, setStoredImages] =
    useState<StoredImage[]>([]);

  const [countryCode, setCountryCode] =
    useState<CountryCode | "">("");

  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const detectedTimezone = useSyncExternalStore(subscribeBrowserSettings, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => "UTC");
  const [selectedTimezone, setTimezone] = useState<string | null>(null);
  const timezone = selectedTimezone ?? detectedTimezone;

  const [currency, setCurrency] =
    useState<Currency>("XOF");

  const [capacity, setCapacity] = useState("");

  const [scheduleType, setScheduleType] =
    useState<ScheduleType>("SINGLE_DATE");

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");

  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  const [ticketCategories, setTicketCategories] =
    useState<EventTicketCategory[]>([]);

  /* ==========================================
     ÉTATS D'ENVOI
  ========================================== */

  const [submitting, setSubmitting] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submitLock = useRef(false);

  const countryManuallySelected =
    useRef(false);

  const locked =
    submitting ||
    loadingEvent;

  /* ==========================================
     IDENTIFIER LE MODE DEPUIS L'URL

     Aucun useSearchParams nécessaire,
     donc pas de Suspense supplémentaire.
  ========================================== */

  useEffect(() => {
    function readMode() {
      const params = new URLSearchParams(
        window.location.search
      );

      const id = params.get("edit")?.trim() || null;

      setEditId(id);
      setCheckingMode(false);

      if (!id) {
        setTicketCategories((previous) =>
          previous.length > 0
            ? previous
            : [makeTicketCategory()]
        );
      }
    }

    readMode();

    window.addEventListener(
      "popstate",
      readMode
    );

    return () => {
      window.removeEventListener(
        "popstate",
        readMode
      );
    };
  }, []);

  /* ==========================================
     LANGUE DU PROJET
  ========================================== */

  useEffect(() => {
    function readLocale() {
      try {
        const saved = window.localStorage.getItem(
          i18nConfig.storageKey
        );

        if (saved) {
          setLocale(normalizeLocale(saved));
        }
      } catch {
        // Conserver la langue par défaut.
      }
    }

    readLocale();

    window.addEventListener("storage", readLocale);
    window.addEventListener("focus", readLocale);

    return () => {
      window.removeEventListener(
        "storage",
        readLocale
      );

      window.removeEventListener(
        "focus",
        readLocale
      );
    };
  }, []);

  /* ==========================================
     LISTE INTERNATIONALE DES PAYS
  ========================================== */

  const countries = useMemo(() => {
    const displayNames = new Intl.DisplayNames(
      [locale],
      { type: "region" }
    );

    return getCountries()
      .map((code) => ({
        code,
        flag: getFlag(code),
        name: displayNames.of(code) ?? code,
      }))
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          locale,
          { sensitivity: "base" }
        )
      );
  }, [locale]);

  /* ==========================================
     FUSEAU INITIAL
  ========================================== */



  /* ==========================================
     DÉTECTION DU PAYS

     Seulement en création.
     Ne remplace jamais le pays enregistré
     en mode modification.
  ========================================== */

  useEffect(() => {
    if (checkingMode || isEditMode) {
      return;
    }

    const controller = new AbortController();

    async function detectCountry() {
      try {
        const response = await fetch(
          ROUTES.geo,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          return;
        }

        const result: GeoResponse =
          await response.json();

        if (
          controller.signal.aborted ||
          countryManuallySelected.current
        ) {
          return;
        }

        const detected =
          result.countryCode?.toUpperCase();

        if (
          detected &&
          getCountries().includes(
            detected as CountryCode
          )
        ) {
          setCountryCode(
            detected as CountryCode
          );
        }
      } catch {
        // La sélection manuelle reste disponible.
      }
    }

    void detectCountry();

    return () => controller.abort();
  }, [checkingMode, isEditMode]);

  /* ==========================================
     CHARGER UN ÉVÉNEMENT EXISTANT

     GET /api/organizer/events/[id]

     L'API doit vérifier le propriétaire
     avant de retourner les informations.
  ========================================== */

  const fillForm = useCallback(
    (event: EditableEvent) => {
      setTitle(event.title ?? "");

      const selectedCategory =
        EVENT_CATEGORIES.find(
          (item) => item.key === event.category
        );

      setCategory(
        selectedCategory?.key ?? ""
      );

      setDescription(event.description ?? "");

      setStoredImages(
        Array.isArray(event.images)
          ? [...event.images].sort(
              (a, b) =>
                (a.position ?? 0) -
                (b.position ?? 0)
            )
          : []
      );

      setNewImages([]);

      const country =
        event.countryCode?.toUpperCase() ?? "";

      setCountryCode(
        getCountries().includes(
          country as CountryCode
        )
          ? (country as CountryCode)
          : ""
      );

      countryManuallySelected.current = true;

      setCity(event.city ?? "");
      setAddress(event.address ?? "");

      setTimezone(
        event.timezone &&
          isValidTimezone(event.timezone)
          ? event.timezone
          : "UTC"
      );

      setCurrency(
        isSupportedCurrency(event.currency) ? event.currency : "XOF"
      );

      setCapacity(String(event.capacity ?? ""));

      setScheduleType(
        event.scheduleType === "DATE_RANGE" ||
          event.scheduleType === "CONTINUOUS"
          ? event.scheduleType
          : "SINGLE_DATE"
      );

      setStartDate(event.startDate ?? "");
      setStartTime(event.startTime ?? "");

      setEndDate(event.endDate ?? "");
      setEndTime(event.endTime ?? "");

      const incomingTickets =
        Array.isArray(event.ticketCategories)
          ? event.ticketCategories
          : [];

      setTicketCategories(
        incomingTickets.map((ticket) => ({
          id: ticket.id,
          name: ticket.name,
          price: ticket.inputPrice ?? String(ticket.price),
          quantity: String(ticket.quantity),
        }))
      );
    },
    []
  );

  useEffect(() => {
    if (checkingMode || !editId) {
      return;
    }

    const controller = new AbortController();

    const editingEventId = editId;
    async function loadEvent() {
      setLoadingEvent(true);
      setLoadError("");
      setSuccess("");
      setError("");

      try {
        if (
          !/^[A-Za-z0-9_-]{1,128}$/.test(editingEventId)
        ) {
          throw new Error(
            TEXT[defaultLocale].invalidId
          );
        }

        const response = await fetch(
          `${ROUTES.eventsApi}/${encodeURIComponent(
            editingEventId
          )}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result: EventDetailsResponse =
          await response.json();

        if (
          !response.ok ||
          result.success !== true ||
          !result.event ||
          result.event.id !== editId
        ) {
          throw new Error(
            result.message ||
              TEXT[defaultLocale].loadError
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        fillForm(result.event);
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(
          caughtError instanceof Error
            ? caughtError.message
            : TEXT[defaultLocale].loadError
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingEvent(false);
        }
      }
    }

    void loadEvent();

    return () => controller.abort();
  }, [checkingMode, editId, fillForm]);

  /* ==========================================
     CAPACITÉ ET IMAGES
  ========================================== */

  const totalImageCount =
    storedImages.length + newImages.length;

  const remainingImageSlots =
    Math.max(0, MAX_IMAGES - storedImages.length);

  const totalCapacity = isValidPositiveInteger(
    capacity,
    MAX_CAPACITY
  )
    ? Number(capacity)
    : null;

  const allocatedSeats = ticketCategories.reduce(
    (total, ticket) => {
      return (
        total +
        (/^\d+$/.test(ticket.quantity)
          ? Number(ticket.quantity)
          : 0)
      );
    },
    0
  );

  /* ==========================================
     RETIRER UNE IMAGE EXISTANTE

     Supprime uniquement de la sélection.
     La suppression serveur sera traitée
     lors du PATCH autorisé.
  ========================================== */

  function removeStoredImage(id: string) {
    if (locked) {
      return;
    }

    setStoredImages((previous) =>
      previous.filter((image) => image.id !== id)
    );

    setError("");
  }

  /* ==========================================
     AJOUTER DE NOUVELLES IMAGES
  ========================================== */

  function updateNewImages(files: File[]) {
    if (locked) {
      return;
    }

    setNewImages(
      files.slice(0, remainingImageSlots)
    );

    setError("");
  }

  /* ==========================================
     VALIDATION DU FORMULAIRE
  ========================================== */

  function validateForm(): string | null {
    const cleanTitle = title.trim();

    if (
      cleanTitle.length < 3 ||
      cleanTitle.length > 180
    ) {
      return t.nameError;
    }

    if (!category) {
      return t.categoryError;
    }

    const cleanDescription =
      description.trim();

    if (
      cleanDescription.length < 10 ||
      cleanDescription.length > MAX_DESCRIPTION
    ) {
      return t.descriptionError;
    }

    if (
      totalImageCount < 1 ||
      totalImageCount > MAX_IMAGES
    ) {
      return t.imagesError;
    }

    if (
      newImages.some(
        (file) =>
          file.size <= 0 ||
          file.size > MAX_IMAGE_BYTES
      )
    ) {
      return t.imageSizeError;
    }

    if (!countryCode) {
      return t.countryError;
    }

    if (
      city.trim().length < 1 ||
      city.trim().length > 120
    ) {
      return t.cityError;
    }

    if (
      address.trim().length < 1 ||
      address.trim().length > 250
    ) {
      return t.addressError;
    }

    if (!isValidTimezone(timezone)) {
      return t.timezoneError;
    }

    if (totalCapacity === null) {
      return t.capacityError;
    }

    if (!isValidTime(startTime)) {
      return t.timeError;
    }

    if (!isValidDate(startDate)) {
      return t.dateError;
    }

    if (
      scheduleType === "DATE_RANGE" &&
      !isValidDate(endDate)
    ) {
      return t.endDateError;
    }

    if (
      scheduleType === "CONTINUOUS" &&
      endDate &&
      !isValidDate(endDate)
    ) {
      return t.endDateError;
    }

    if (
      scheduleType !== "SINGLE_DATE" &&
      endDate
    ) {
      const finish =
        `${endDate}T${endTime || "23:59"}`;

      const begin =
        `${startDate}T${startTime}`;

      if (finish <= begin) {
        return t.endDateError;
      }
    }

    if (
      endTime &&
      !isValidTime(endTime)
    ) {
      return t.endDateError;
    }

    if (ticketCategories.length < 1) {
      return t.ticketError;
    }

    const usedNames = new Set<string>();

    for (const ticket of ticketCategories) {
      const name = ticket.name.trim();

      const normalizedName = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (
        !name ||
        name.length > 80 ||
        usedNames.has(normalizedName) ||
        !isValidPrice(
          ticket.price.replace(/\s/g, ""), currency
        ) ||
        !isValidPositiveInteger(
          ticket.quantity,
          MAX_CAPACITY
        )
      ) {
        return t.ticketError;
      }

      usedNames.add(normalizedName);
    }

    if (allocatedSeats !== totalCapacity) {
      return t.ticketCapacityError;
    }

    return null;
  }

  /* ==========================================
     TÉLÉVERSER LES NOUVELLES IMAGES

     Les images déjà enregistrées ne sont
     pas envoyées une seconde fois.
  ========================================== */

  async function uploadNewImages(): Promise<string[]> {
    const cached = uploadCache.current;
    if (cached && cached.files.length === newImages.length && cached.files.every((file, index) => file === newImages[index])) return cached.ids;
    if (newImages.length === 0) {
      return [];
    }

    const formData = new FormData();

    for (const image of newImages) {
      formData.append("images", image);
    }

    const response = await fetch(
      ROUTES.imagesApi,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: formData,
      }
    );

    const result: UploadResponse =
      await response.json().catch(() => ({}));

    if (
      !response.ok ||
      result.success !== true ||
      !Array.isArray(result.images) ||
      result.images.length !== newImages.length
    ) {
      throw new Error(
        result.message || t.imagesError
      );
    }

    const ids = result.images.map(
      (image) => image.id
    );

    if (
      ids.some(
        (id) =>
          !IMAGE_ID_PATTERN.test(id)
      )
    ) {
      throw new Error(t.imagesError);
    }

    uploadCache.current = { files: [...newImages], ids };
    return ids;
  }

  /* ==========================================
     PUBLICATION OU MODIFICATION
  ========================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitLock.current ||
      locked ||
      loadError
    ) {
      return;
    }

    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);

    try {
      setUploading(newImages.length > 0);

      const uploadedIds =
        await uploadNewImages();

      setUploading(false);

      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),

        countryCode,
        city: city.trim(),
        address: address.trim(),
        venueName: address.trim(),

        timezone,
        currency,

        capacity: Number(capacity),

        scheduleType,
        startDate,
        startTime,

        endDate:
          scheduleType === "SINGLE_DATE"
            ? null
            : endDate || null,

        endTime:
          scheduleType === "SINGLE_DATE"
            ? null
            : endTime || null,

        ticketCategories:
          ticketCategories.map((ticket) => ({
            id: ticket.id,
            name: ticket.name.trim(),
            price: ticket.price.replace(/\s/g, ""),
            quantity: ticket.quantity,
          })),

        // Les images nouvellement téléversées.
        images: uploadedIds.map((id) => ({
          id,
        })),

        // Les images existantes conservées.
        keepImageIds: storedImages.map(
          (image) => image.id
        ),

        locale,
      };

      const fingerprint = JSON.stringify(payload);
      if (!publicationAttempt.current || publicationAttempt.current.fingerprint !== fingerprint) {
        publicationAttempt.current = { fingerprint, id: crypto.randomUUID() };
      }
      const requestPayload = { ...payload, requestId: publicationAttempt.current.id };
      const url = isEditMode
        ? `${ROUTES.eventsApi}/${encodeURIComponent(
            editId
          )}`
        : ROUTES.eventsApi;

      const method = isEditMode
        ? "PATCH"
        : "POST";

      const response = await fetch(
        url,
        {
          method,
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
            "Accept-Language": locale,
          },

          body: JSON.stringify(requestPayload),
        }
      );

      const result: SaveResponse =
        await response.json().catch(() => ({}));

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.message ||
            t.serverError
        );
      }

      if (!isEditMode) {
        setTitle(""); setCategory(""); setDescription(""); setNewImages([]); setStoredImages([]);
        setCity(""); setAddress(""); setCapacity(""); setScheduleType("SINGLE_DATE");
        setStartDate(""); setStartTime(""); setEndDate(""); setEndTime("");
        setTicketCategories([{ id: crypto.randomUUID(), name: "", price: "", quantity: "" }]);
        uploadCache.current = null; publicationAttempt.current = null;
      }
      setSuccess(
        result.message ||
          (isEditMode ? t.saved : t.published)
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t.networkError
      );
    } finally {
      setUploading(false);
      setSubmitting(false);
      submitLock.current = false;
    }
  }

  /* ==========================================
     ÉCRAN DE CHARGEMENT
  ========================================== */

  if (checkingMode || loadingEvent) {
    return (
      <main className="flex min-h-full w-full items-center justify-center bg-[#f6f8fb] px-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3"
        >
          <LoaderCircle
            size={36}
            className="animate-spin text-green-700"
            aria-hidden="true"
          />

          <p className="text-sm font-medium text-gray-600">
            {t.loading}
          </p>
        </div>
      </main>
    );
  }

  /* ==========================================
     ERREUR DE CHARGEMENT
  ========================================== */

  if (loadError) {
    return (
      <main className="flex min-h-full w-full flex-col items-center justify-center gap-5 bg-[#f6f8fb] px-4 text-center">
        <p
          role="alert"
          className="text-sm font-semibold text-red-700"
        >
          {loadError}
        </p>

        <Link
          href={ROUTES.events}
          className="rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800"
        >
          {t.back}
        </Link>
      </main>
    );
  }

  /* ==========================================
     FORMULAIRE RESPONSIVE
  ========================================== */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-clip bg-[#f6f8fb] text-[#101828]">
      {/* ======================================
          EN-TÊTE DE LA PAGE
      ====================================== */}

      <header className="w-full bg-[#051d3a] px-3 py-4 text-white sm:px-5 lg:bg-transparent lg:px-6 lg:py-5 lg:text-[#101828]">
        <div className="flex w-full min-w-0 items-center gap-3">
          <Link
            href={ROUTES.events}
            aria-label={t.back}
            title={t.back}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/10 lg:bg-green-50 lg:text-green-800 lg:hover:bg-green-100"
          >
            <ArrowLeft
              size={23}
              aria-hidden="true"
            />
          </Link>

          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#b2ff1a] text-[#07651d] lg:bg-green-50">
            <CalendarDays
              size={28}
              strokeWidth={2.3}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-extrabold sm:text-2xl lg:text-[30px]">
              {isEditMode
                ? t.editTitle
                : t.publishTitle}
            </h1>

            <p className="mt-1 text-xs text-white/85 sm:text-sm lg:text-gray-600">
              {isEditMode
                ? t.editSubtitle
                : t.publishSubtitle}
            </p>
          </div>
        </div>
      </header>

      {/* ======================================
          FORMULAIRE PRINCIPAL
      ====================================== */}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex w-full min-w-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-5 lg:gap-4 lg:px-6 lg:pb-6"
      >
        {/* ====================================
            NOM ET CATÉGORIE
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="event-name"
                className={LABEL_CLASS}
              >
                {t.name}{" "}
                <span className="text-red-600">*</span>
              </label>

              <input
                id="event-name"
                type="text"
                required
                maxLength={180}
                autoComplete="off"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                disabled={locked}
                placeholder={t.namePlaceholder}
                className={FIELD_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="event-category"
                className={LABEL_CLASS}
              >
                {t.category}{" "}
                <span className="text-red-600">*</span>
              </label>

              <div className="relative">
                <LayoutGrid
                  size={19}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-green-700"
                />

                <select
                  id="event-category"
                  required
                  value={category}
                  onChange={(event) => {
                    setCategory(
                      event.target.value as
                        | CategoryKey
                        | ""
                    );
                    setError("");
                  }}
                  disabled={locked}
                  className={`${FIELD_CLASS} appearance-none pr-9 pl-10`}
                >
                  <option value="">
                    {t.selectCategory}
                  </option>

                  {EVENT_CATEGORIES.map((item) => (
                    <option
                      key={item.key}
                      value={item.key}
                    >
                      {CATEGORY_NAMES[locale][item.key]}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-700"
                />
              </div>
            </div>
          </div>

          {/* CATÉGORIES ILLUSTRÉES */}

          <div className="mt-3 flex w-full gap-2 overflow-x-auto pb-2 scrollbar-thin lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0">
            {EVENT_CATEGORIES.map((item) => {
              const Icon = item.icon;
              const selected = category === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setCategory(item.key);
                    setError("");
                  }}
                  disabled={locked}
                  aria-pressed={selected}
                  className={[
                    "flex min-h-17 w-24 shrink-0",
                    "flex-col items-center justify-center",
                    "gap-1 rounded-xl border px-2 py-2",
                    "text-center text-xs font-bold",
                    "transition-colors",
                    "focus-visible:outline-2",
                    "focus-visible:outline-green-700",
                    "disabled:opacity-60",
                    "lg:w-full",
                    selected
                      ? "border-green-600 bg-green-50 text-green-950 ring-1 ring-green-500"
                      : "border-gray-200 bg-white text-[#142138] hover:bg-gray-50",
                  ].join(" ")}
                >
                  <Icon
                    size={23}
                    strokeWidth={2.3}
                    color={item.color}
                    aria-hidden="true"
                  />

                  <span>
                    {CATEGORY_NAMES[locale][item.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* DESCRIPTION ET IMAGES */}

          <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="event-description"
                className={LABEL_CLASS}
              >
                {t.description}{" "}
                <span className="text-red-600">*</span>
              </label>

              <textarea
                id="event-description"
                required
                maxLength={MAX_DESCRIPTION}
                rows={5}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setError("");
                }}
                disabled={locked}
                placeholder={t.descriptionPlaceholder}
                className="min-h-36 w-full resize-y rounded-xl border border-[#cbd5e1] bg-white px-3 py-3 text-sm text-[#10213b] outline-none placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
              />

              <p className="mt-1 text-right text-xs text-gray-500">
                {description.length} / {MAX_DESCRIPTION}
              </p>
            </div>

            <div className="min-w-0">
              {/* IMAGES EXISTANTES */}

              {isEditMode &&
                storedImages.length > 0 && (
                  <div className="mb-3 rounded-xl border border-[#e2e9ee] bg-[#f8faf9] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-extrabold text-[#142138]">
                        {t.existingImages}
                      </h2>

                      <span className="text-xs font-bold text-green-800">
                        {totalImageCount} / {MAX_IMAGES}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                      {storedImages.map(
                        (image, index) => (
                          <div
                            key={image.id}
                            className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                          >
                            {image.url &&
                            isValidImageUrl(image.url) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={image.url}
                                alt={`${t.existingImages} ${index + 1}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                {index + 1}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                removeStoredImage(
                                  image.id
                                )
                              }
                              disabled={locked}
                              aria-label={t.removeImage}
                              title={t.removeImage}
                              className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                            >
                              <X
                                size={17}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* NOUVELLES IMAGES */}

              {remainingImageSlots > 0 ? (
                <EventImageUploader
                  files={newImages}
                  onChange={updateNewImages}
                  locale={locale}
                  disabled={locked}
                  className="w-full shadow-none"
                />
              ) : null}

              {isEditMode &&
                remainingImageSlots === 0 && (
                  <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
                    {totalImageCount} / {MAX_IMAGES}
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* ====================================
            PAYS, VILLE ET ADRESSE
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="mb-3 flex items-center gap-2">
            <MapPin
              size={23}
              aria-hidden="true"
              className="text-green-700"
            />

            <h2 className="text-base font-extrabold sm:text-lg">
              {t.location}
            </h2>
          </div>

          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {/* PAYS */}

            <div className="min-w-0">
              <label
                htmlFor="event-country"
                className={LABEL_CLASS}
              >
                {t.country}{" "}
                <span className="text-red-600">*</span>
              </label>

              <div className="relative">
                <select
                  id="event-country"
                  required
                  value={countryCode}
                  onChange={(event) => {
                    countryManuallySelected.current =
                      true;

                    setCountryCode(
                      event.target.value as
                        | CountryCode
                        | ""
                    );

                    setError("");
                  }}
                  disabled={locked}
                  className={`${FIELD_CLASS} appearance-none pr-9`}
                >
                  <option value="">
                    {t.selectCountry}
                  </option>

                  {countries.map((country) => (
                    <option
                      key={country.code}
                      value={country.code}
                    >
                      {country.flag} {country.name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-700"
                />
              </div>
            </div>

            {/* VILLE */}

            <div className="min-w-0">
              <label
                htmlFor="event-city"
                className={LABEL_CLASS}
              >
                {t.city}{" "}
                <span className="text-red-600">*</span>
              </label>

              <input
                id="event-city"
                type="text"
                required
                maxLength={120}
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setError("");
                }}
                disabled={locked}
                placeholder={t.cityPlaceholder}
                className={FIELD_CLASS}
              />
            </div>

            {/* ADRESSE */}

            <div className="min-w-0 sm:col-span-2 xl:col-span-1">
              <label
                htmlFor="event-address"
                className={LABEL_CLASS}
              >
                {t.address}{" "}
                <span className="text-red-600">*</span>
              </label>

              <input
                id="event-address"
                type="text"
                required
                maxLength={250}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setError("");
                }}
                disabled={locked}
                placeholder={t.addressPlaceholder}
                className={FIELD_CLASS}
              />
            </div>
          </div>
        </section>

        {/* ====================================
            CAPACITÉ ET HEURE DE DÉBUT
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="event-capacity"
                className={LABEL_CLASS}
              >
                {t.capacity}{" "}
                <span className="text-red-600">*</span>
              </label>

              <div className="relative">
                <UsersRound
                  size={19}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600"
                />

                <input
                  id="event-capacity"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={7}
                  value={capacity}
                  onChange={(event) => {
                    if (
                      /^\d*$/.test(
                        event.target.value
                      )
                    ) {
                      setCapacity(
                        event.target.value
                      );
                      setError("");
                    }
                  }}
                  disabled={locked}
                  placeholder={t.capacityPlaceholder}
                  className={`${FIELD_CLASS} pl-10`}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="event-start-time"
                className={LABEL_CLASS}
              >
                {t.startTime}{" "}
                <span className="text-red-600">*</span>
              </label>

              <div className="relative">
                <Clock3
                  size={19}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-600"
                />

                <input
                  id="event-start-time"
                  type="time"
                  required
                  value={startTime}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    setError("");
                  }}
                  disabled={locked}
                  className={`${FIELD_CLASS} pl-10`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ====================================
            PÉRIODE DE L'ÉVÉNEMENT
        ==================================== */}

        <section className={SECTION_CLASS}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold sm:text-lg">
            <CalendarDays
              size={23}
              aria-hidden="true"
              className="text-green-700"
            />

            {t.period}{" "}
            <span className="text-red-600">*</span>
          </h2>

          <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              role="radiogroup"
              aria-label={t.period}
              className="flex flex-col gap-2"
            >
              {(
                [
                  {
                    value: "SINGLE_DATE",
                    label: t.single,
                  },
                  {
                    value: "DATE_RANGE",
                    label: t.range,
                  },
                  {
                    value: "CONTINUOUS",
                    label: t.continuous,
                  },
                ] as const
              ).map((option) => {
                const selected =
                  scheduleType === option.value;

                return (
                  <label
                    key={option.value}
                    className={[
                      "flex min-h-12 cursor-pointer",
                      "items-center gap-3 rounded-xl",
                      "border px-3 py-3",
                      "text-sm font-bold",
                      selected
                        ? "border-[#b8ef9b] bg-[#edffe5] text-green-950"
                        : "border-[#e1e6ed] bg-white text-[#142138]",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="event-schedule-type"
                      value={option.value}
                      checked={selected}
                      onChange={() => {
                        setScheduleType(
                          option.value
                        );
                        setError("");
                      }}
                      disabled={locked}
                      className="size-4 shrink-0 accent-green-700"
                    />

                    <CalendarDays
                      size={20}
                      aria-hidden="true"
                      className={
                        selected
                          ? "shrink-0 text-green-700"
                          : "shrink-0 text-gray-600"
                      }
                    />

                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>

            {/* DATES */}

            <div className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="event-start-date"
                  className={LABEL_CLASS}
                >
                  {scheduleType === "SINGLE_DATE"
                    ? t.eventDate
                    : t.startDate}{" "}
                  <span className="text-red-600">*</span>
                </label>

                <input
                  id="event-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setError("");
                  }}
                  disabled={locked}
                  className={FIELD_CLASS}
                />
              </div>

              {scheduleType !== "SINGLE_DATE" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label
                      htmlFor="event-end-date"
                      className={LABEL_CLASS}
                    >
                      {scheduleType === "DATE_RANGE"
                        ? t.endDate
                        : t.optionalEndDate}

                      {scheduleType === "DATE_RANGE" && (
                        <span className="text-red-600">
                          {" "}*
                        </span>
                      )}
                    </label>

                    <input
                      id="event-end-date"
                      type="date"
                      required={
                        scheduleType === "DATE_RANGE"
                      }
                      min={startDate || undefined}
                      value={endDate}
                      onChange={(event) => {
                        setEndDate(event.target.value);
                        setError("");
                      }}
                      disabled={locked}
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="event-end-time"
                      className={LABEL_CLASS}
                    >
                      {t.endTime}
                    </label>

                    <input
                      id="event-end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => {
                        setEndTime(event.target.value);
                        setError("");
                      }}
                      disabled={locked}
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              )}

              

              <div className="min-w-0">
                <label
                  htmlFor="event-timezone"
                  className={LABEL_CLASS}
                >
                  {t.timezone}{" "}
                  <span className="text-red-600">*</span>
                </label>

                <input
                  id="event-timezone"
                  type="text"
                  required
                  maxLength={100}
                  value={timezone}
                  onChange={(event) => {
                    setTimezone(
                      event.target.value
                    );
                    setError("");
                  }}
                  disabled={locked}
                  placeholder="Africa/Porto-Novo"
                  className={FIELD_CLASS}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ====================================
            CATÉGORIES DES BILLETS
        ==================================== */}

        <div className="w-full min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
            <span className="text-xs font-extrabold text-[#142138] sm:text-sm">
              {t.currency}
            </span>

            <div className="relative">
              <select
                aria-label={t.currency}
                value={currency}
                onChange={(event) => {
                  setCurrency(
                    event.target.value as Currency
                  );
                  setError("");
                }}
                disabled={locked}
                className="h-10 min-w-30 appearance-none rounded-lg border border-gray-300 bg-white py-2 pr-9 pl-3 text-sm font-bold text-[#142138] outline-none focus:border-green-700"
              >
                {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyLabel(code, locale)}</option>)}
                
                
              </select>

              <ChevronDown
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-700"
              />
            </div>
          </div>

          <EventTicketCategories
            categories={ticketCategories}
            onChange={(next) => {
              setTicketCategories(next);
              setError("");
            }}
            totalCapacity={totalCapacity}
            currency={currency}
            locale={locale}
            disabled={locked}
            className="w-full shadow-none"
          />
        </div>

        {/* ====================================
            ERREURS ET CONFIRMATIONS
        ==================================== */}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-900"
          >
            <CheckCircle2
              size={22}
              className="shrink-0"
              aria-hidden="true"
            />

            <span>{success}</span>

            <Link
              href={ROUTES.events}
              className="ml-auto text-xs font-extrabold text-green-800 underline"
            >
              {t.back}
            </Link>
          </div>
        )}

        {/* ====================================
            BOUTON PRINCIPAL
        ==================================== */}

        <button
          type="submit"
          disabled={locked}
          className="flex min-h-14 shrink-0 w-full items-center justify-center gap-3 rounded-xl bg-linear-to-b from-[#25c900] to-[#006b12] px-5 py-3 text-base font-extrabold text-white shadow-md transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
        >
          {submitting ? (
            <>
              <LoaderCircle
                size={22}
                className="animate-spin"
                aria-hidden="true"
              />

              {uploading
                ? t.uploading
                : isEditMode
                  ? t.saving
                  : t.publishing}
            </>
          ) : isEditMode ? (
            <>
              <Save
                size={23}
                aria-hidden="true"
              />

              {t.save}
            </>
          ) : (
            <>
              <Send
                size={23}
                aria-hidden="true"
              />

              {t.publish}
            </>
          )}
        </button>
      </form>
    </main>
  );
}
