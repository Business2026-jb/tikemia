
"use client";
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
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  Coins,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Send,
  X,
} from "lucide-react";

import {
  getCountries,
  type CountryCode,
} from "libphonenumber-js";



/* ============================================
   TIKEMIA — CRÉER / MODIFIER UNE CAGNOTTE

   Fichier :
   src/app/organizer/dashboard/
   publish-campaign/page.tsx

   Création :
   /organizer/dashboard/publish-campaign

   Modification :
   /organizer/dashboard/publish-campaign?edit=ID

   Fonctionnalités :
   - Formulaire unique création / modification
   - Six champs de la maquette
   - Images existantes conservées
   - Suppression d'images de la sélection
   - Ajout de nouvelles images
   - Téléversement sécurisé via API
   - Pays détecté automatiquement en création
   - Français / Anglais
   - Validation côté navigateur
   - POST pour création
   - GET pour préremplissage
   - PATCH pour modification
   - Responsive PC et mobile

   Le layout organisateur fournit déjà
   l'en-tête, la sidebar et le menu mobile.
============================================ */

const ROUTES = {
  dashboard: "/organizer/dashboard",

  campaigns: "/organizer/dashboard/campaigns",

  campaignsApi: "/api/organizer/campaigns",

  imagesApi:
    "/api/organizer/campaigns/images",

  geo: "/api/geo",
} as const;

/* ============================================
   LIMITES
============================================ */

const MAX_IMAGES = 10;

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;

const MIN_TITLE = 3;
const MAX_TITLE = 180;

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;

const MAX_CITY = 120;

const MAX_GOAL =
  BigInt("999999999999");

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type StoredImage = {
  id: string;
  url: string | null;
  position: number;
};

type ApiRecord =
  Record<string, unknown>;

type CampaignDetails = {
  id: string;
  title: string;
  description: string;
  countryCode: string;
  city: string;
  goalAmount: string;
  currency: Currency;
  images: StoredImage[];
  status: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  campaign?: unknown;
  images?: unknown;
};

type PageMode =
  | "checking"
  | "creating"
  | "editing";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================
   TRADUCTIONS FR / EN
============================================ */

const TEXT = {
  fr: {
    createTitle: "Lancer une cagnotte",
    editTitle: "Modifier une cagnotte",

    createSubtitle:
      "Créez et publiez votre cagnotte en quelques étapes.",

    editSubtitle:
      "Modifiez les informations de votre cagnotte.",

    title: "Nom de la cagnotte",

    titlePlaceholder:
      "Ex. Soutien au Festival des Cultures Africaines",

    images: "Images",

    

    upload: "Ajouter des images",

    drag:
      "Glissez vos images ici ou cliquez pour les sélectionner.",

    formats:
      "JPG, PNG, WebP • 10 Mo maximum par image",

    existingImages:
      "Images déjà enregistrées",

    newImages:
      "Nouvelles images",

    removeImage:
      "Retirer l'image",

    description: "Description",

    descriptionPlaceholder:
      "Expliquez l'objectif de votre cagnotte et la manière dont les fonds seront utilisés.",

    country: "Pays",

    selectCountry:
      "Sélectionner un pays",

    city: "Ville",

    cityPlaceholder:
      "Ex. Cotonou",

    goal:
      "Objectif de la cagnotte",

    goalPlaceholder:
      "Ex. 5 000 000",

    currency: "Devise",

    publish:
      "Publier la cagnotte",

    save:
      "Enregistrer les modifications",

    back:
      "Retour à mes dons",

    loading:
      "Chargement de la cagnotte...",

    uploading:
      "Envoi des images...",

    publishing:
      "Publication en cours...",

    saving:
      "Enregistrement des modifications...",

    successCreate:
      "Cagnotte publiee.",

    successEdit:
      "Les modifications ont été enregistrées.",

    invalidId:
      "Identifiant de cagnotte invalide.",

    loadError:
      "Impossible de charger cette cagnotte.",

    titleError:
      "Le nom doit contenir entre 3 et 180 caractères.",

    descriptionError:
      "La description doit contenir entre 10 et 2000 caractères.",

    imagesError:
      "La cagnotte doit contenir entre 1 et 10 images.",

    imageFormatError:
      "Seules les images JPG, PNG et WebP sont acceptées.",

    imageSizeError:
      "Chaque image doit peser 10 Mo maximum.",

    imageCountError:
      "Vous pouvez conserver ou ajouter 10 images maximum.",

    imageDuplicateError:
      "Cette image est déjà sélectionnée.",

    countryError:
      "Sélectionnez un pays valide.",

    cityError:
      "Renseignez une ville valide.",

    goalError:
      "Saisissez un objectif supérieur à zéro.",

    networkError:
      "Erreur de connexion. Veuillez réessayer.",

    saveError:
      "Impossible d'enregistrer la cagnotte.",

    retry: "Réessayer",
  },

  en: {
    createTitle: "Launch a fundraiser",
    editTitle: "Edit a fundraiser",

    createSubtitle:
      "Create and publish your fundraiser in a few steps.",

    editSubtitle:
      "Update your fundraiser information.",

    title: "Fundraiser name",

    titlePlaceholder:
      "e.g. Support for the African Cultural Festival",

    images: "Images",

    

    upload: "Add images",

    drag:
      "Drag images here or click to select them.",

    formats:
      "JPG, PNG, WebP • Maximum 10 MB per image",

    existingImages:
      "Previously uploaded images",

    newImages:
      "New images",

    removeImage:
      "Remove image",

    description: "Description",

    descriptionPlaceholder:
      "Explain your fundraiser goal and how the funds will be used.",

    country: "Country",

    selectCountry:
      "Select a country",

    city: "City",

    cityPlaceholder:
      "e.g. Cotonou",

    goal:
      "Fundraiser goal",

    goalPlaceholder:
      "e.g. 5,000,000",

    currency: "Currency",

    publish:
      "Publish fundraiser",

    save:
      "Save changes",

    back:
      "Back to my fundraisers",

    loading:
      "Loading fundraiser...",

    uploading:
      "Uploading images...",

    publishing:
      "Publishing...",

    saving:
      "Saving changes...",

    successCreate:
      "Your fundraiser is published.",

    successEdit:
      "Changes saved successfully.",

    invalidId:
      "Invalid fundraiser ID.",

    loadError:
      "Unable to load this fundraiser.",

    titleError:
      "The name must contain between 3 and 180 characters.",

    descriptionError:
      "The description must contain between 10 and 2000 characters.",

    imagesError:
      "The fundraiser must contain between 1 and 10 images.",

    imageFormatError:
      "Only JPG, PNG and WebP images are accepted.",

    imageSizeError:
      "Each image must be 10 MB or less.",

    imageCountError:
      "You can keep or add up to 10 images.",

    imageDuplicateError:
      "This image is already selected.",

    countryError:
      "Select a valid country.",

    cityError:
      "Enter a valid city.",

    goalError:
      "Enter a goal amount greater than zero.",

    networkError:
      "Connection error. Please try again.",

    saveError:
      "Unable to save the fundraiser.",

    retry: "Try again",
  },
} as const;

/* ============================================
   STYLES COMMUNS
============================================ */

const INPUT_CLASS = [
  "h-12 w-full min-w-0",
  "rounded-xl",
  "border border-[#cbd5e1]",
  "bg-white px-3.5",
  "text-sm font-medium",
  "text-[#10223b]",
  "outline-none",
  "transition-colors",
  "placeholder:font-normal",
  "placeholder:text-[#8190a3]",
  "focus:border-[#169c35]",
  "focus:ring-2",
  "focus:ring-green-100",
  "disabled:cursor-not-allowed",
  "disabled:opacity-60",
].join(" ");

const LABEL_CLASS = [
  "mb-2 block",
  "text-sm font-extrabold",
  "text-[#13213c]",
].join(" ");

/* ============================================
   UTILITAIRES JSON
============================================ */

function asRecord(
  value: unknown
): ApiRecord {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

function textValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function moneyValue(
  value: unknown
): string {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return String(value);
  }

  if (
    typeof value === "string" &&
    /^\d+$/.test(value)
  ) {
    return value;
  }

  return "";
}

function normalizeCurrency(
  value: unknown
): Currency { return isSupportedCurrency(value) ? value : "XOF"; }

function validImageUrl(
  value: string
): boolean {
  if (
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return true;
  }

  try {
    return (
      new URL(value).protocol === "https:"
    );
  } catch {
    return false;
  }
}

/* ============================================
   ADAPTATION DES DONNÉES DE LA CAGNOTTE

   Contrat attendu :
   {
     success: true,
     campaign: {
       id, title, description,
       countryCode, city,
       goalAmount, currency,
       status,
       images: [{ id, url, position }]
     }
   }
============================================ */

function normalizeCampaign(
  value: unknown
): CampaignDetails {
  const source = asRecord(value);

  const images = Array.isArray(
    source.images
  )
    ? source.images
        .map((entry, index) => {
          const image = asRecord(entry);

          const id =
            textValue(image.id);

          const url =
            textValue(image.url);

          return {
            id,
            url:
              url && validImageUrl(url)
                ? url
                : null,
            position:
              typeof image.position ===
                "number" &&
              Number.isInteger(
                image.position
              )
                ? image.position
                : index,
          };
        })
        .filter(
          (image) =>
            image.id.length > 0
        )
        .sort(
          (a, b) =>
            a.position - b.position
        )
    : [];

  const countryCode =
    textValue(
      source.countryCode ??
        source.country
    ).toUpperCase();

  return {
    id:
      textValue(source.id),

    title:
      textValue(
        source.title ?? source.name
      ),

    description:
      textValue(source.description),

    countryCode,

    city:
      textValue(source.city),

    goalAmount:
      moneyValue(
        source.goalAmount ??
          source.targetAmount
      ),

    currency:
      normalizeCurrency(
        source.currency
      ),

    images,

    status:
      textValue(source.status),
  };
}

/* ============================================
   MONTANTS
============================================ */

function parseGoal(value: string, currency: Currency = "XOF"): bigint | null {
 if (typeof value !== "string" && typeof value !== "number") return null;
 const raw = value.replace(/[\s,\u00a0\u202f]/g, "");
 if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(raw)) return null;
 const [whole, fraction = ""] = raw.split(".");
 if (currencyDecimals(currency) === 0 && /[1-9]/.test(fraction)) return null;
 const factor = currencyDecimals(currency) === 0 ? 1n : 100n;
 const result = BigInt(whole) * factor + (currencyDecimals(currency) === 0 ? 0n : BigInt(fraction.padEnd(2, "0")));
 return result > 0n && result <= MAX_GOAL * factor ? result : null;
}

function formatGoalInput(raw: string, locale: Locale): string {
 const cleaned = (locale === "fr" ? raw.replace(",", ".") : raw).replace(/[\s,\u00a0\u202f]/g, "");
 const [whole = "", ...fractions] = cleaned.split(".");
 const digits = whole.replace(/\D/g, "").slice(0, 12);
 const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "fr" ? " " : ",");
 return grouped + (fractions.length ? "." + fractions.join("").replace(/\D/g, "").slice(0, 2) : "");
}

/* ============================================
   IMAGES
============================================ */

function filesMatch(
  a: File,
  b: File
): boolean {
  return (
    a.name === b.name &&
    a.size === b.size &&
    a.lastModified ===
      b.lastModified
  );
}

function getFlag(
  code: string
): string {
  if (
    !/^[A-Z]{2}$/.test(code)
  ) {
    return "🌍";
  }

  return String.fromCodePoint(
    ...Array.from(code).map(
      (character) =>
        127397 +
        character.charCodeAt(0)
    )
  );
}

/* ============================================
   PAGE
============================================ */


function subscribeBrowserSettings(callback: () => void) {
 window.addEventListener("popstate", callback);
 return () => window.removeEventListener("popstate", callback);
}

function CampaignImagePreview({ file, alt, className }: { file: File; alt: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Local blob previews cannot use the server image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} className={className} />;
}

export default function PublishCampaignPage() {
  const uploadCache = useRef<{ files: File[]; ids: string[] } | null>(null);
  const publicationAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  /* ==========================================
     MODE DE LA PAGE
  ========================================== */

  const editQuery = useSyncExternalStore(subscribeBrowserSettings, () => new URLSearchParams(window.location.search).get("edit")?.trim() ?? "", () => null);
  const editId = editQuery || null;
  const mode: PageMode = editQuery === null ? "checking" : editId ? "editing" : "creating";

  const isEditMode =
    mode === "editing";

  /* ==========================================
     LANGUE
  ========================================== */

  const [locale, setLocale] =
    useState<Locale>(
      defaultLocale
    );

  const t = TEXT[locale];

  /* ==========================================
     CHAMPS
  ========================================== */

  const [title, setTitle] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    countryCode,
    setCountryCode,
  ] = useState("");

  const [city, setCity] =
    useState("");

  const [goalAmount, setGoalAmount] =
    useState("");

  const [currency, setCurrency] =
    useState<Currency>("XOF");

  /* ==========================================
     IMAGES
  ========================================== */

  const [
    storedImages,
    setStoredImages,
  ] = useState<StoredImage[]>([]);

  const [
    newImages,
    setNewImages,
  ] = useState<File[]>([]);



  const [dragging, setDragging] =
    useState(false);

  /* ==========================================
     CHARGEMENT / ENREGISTREMENT
  ========================================== */

  const [
    loadingCampaign,
    setLoadingCampaign,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [loadError, setLoadError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ==========================================
     RÉFÉRENCES
  ========================================== */

  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const submissionLock =
    useRef(false);

  const manuallySelectedCountry =
    useRef(false);

  const disabled =
    submitting ||
    loadingCampaign;

  const totalImages =
    storedImages.length +
    newImages.length;

  /* ==========================================
     LISTE DES PAYS
  ========================================== */

  const countries = useMemo(() => {
    const names =
      new Intl.DisplayNames(
        [locale],
        {
          type: "region",
        }
      );

    return getCountries()
      .map((code) => ({
        code,

        flag:
          getFlag(code),

        name:
          names.of(code) ??
          code,
      }))
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          locale,
          {
            sensitivity: "base",
          }
        )
      );
  }, [locale]);

  /* ==========================================
     LANGUE DU PROJET
  ========================================== */

  useEffect(() => {
    function loadLocale() {
      try {
        const saved =
          window.localStorage.getItem(
            i18nConfig.storageKey
          );

        if (saved) {
          setLocale(
            normalizeLocale(saved)
          );
        }
      } catch {
        // Conserver le français.
      }
    }

    loadLocale();

    window.addEventListener(
      "storage",
      loadLocale
    );

    window.addEventListener(
      "focus",
      loadLocale
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadLocale
      );

      window.removeEventListener(
        "focus",
        loadLocale
      );
    };
  }, []);

  /* ==========================================
     IDENTIFIER CRÉATION OU MODIFICATION
  ========================================== */



  /* ==========================================
     PAYS AUTOMATIQUE

     Uniquement en création.
     En modification, conserver le pays
     enregistré par l'organisateur.
  ========================================== */

  useEffect(() => {
    if (
      mode !== "creating"
    ) {
      return;
    }

    const controller =
      new AbortController();

    async function detectCountry() {
      try {
        const response =
          await fetch(
            ROUTES.geo,
            {
              method: "GET",
              cache: "no-store",
              signal:
                controller.signal,
            }
          );

        if (!response.ok) {
          return;
        }

        const result =
          asRecord(
            await response.json()
          );

        const detected =
          textValue(
            result.countryCode ??
              result.country
          ).toUpperCase();

        if (
          controller.signal.aborted ||
          manuallySelectedCountry.current
        ) {
          return;
        }

        if (
          getCountries().includes(
            detected as CountryCode
          )
        ) {
          setCountryCode(
            detected
          );
        }
      } catch {
        // La sélection reste manuelle.
      }
    }

    void detectCountry();

    return () => {
      controller.abort();
    };
  }, [mode]);

  /* ==========================================
     CHARGER LA CAGNOTTE À MODIFIER

     GET /api/organizer/campaigns/[id]

     Le serveur doit vérifier que
     cette cagnotte appartient
     à l'organisateur connecté.
  ========================================== */

  const loadCampaignRequest =
    useCallback(
      async (
        campaignId: string,
        signal?: AbortSignal
      ) => {


        
          return fetch(
              `${ROUTES.campaignsApi}/${encodeURIComponent(
                campaignId
              )}`,
              {
                method: "GET",
                credentials:
                  "same-origin",
                cache: "no-store",
                signal,
              }
            ).then(async (response) => {

          const result: ApiResponse =
            await response
              .json()
              .catch(
                () => ({})
              );

          if (
            !response.ok ||
            result.success !== true ||
            !result.campaign
          ) {
            throw new Error(
              result.message ??
                TEXT.fr.loadError
            );
          }

          const campaign =
            normalizeCampaign(
              result.campaign
            );

          if (
            campaign.id !==
            campaignId
          ) {
            throw new Error(
              TEXT.fr.loadError
            );
          }

          if (
            signal?.aborted
          ) {
            return;
          }

          setTitle(
            campaign.title
          );

          setDescription(
            campaign.description
          );

          setCountryCode(
            campaign.countryCode
          );

          setCity(
            campaign.city
          );

          setGoalAmount(
            formatGoalInput(
              currencyDecimals(campaign.currency) === 0 ? campaign.goalAmount : `${BigInt(campaign.goalAmount) / 100n}.${String(BigInt(campaign.goalAmount) % 100n).padStart(2, "0")}`,
              defaultLocale
            )
          );

          setCurrency(
            campaign.currency
          );

          setStoredImages(
            campaign.images
          );

          setNewImages([]);

          setError("");
          setSuccess("");

          manuallySelectedCountry.current =
            true;
        
}).catch((caughtError) => {
          if (
            signal?.aborted
          ) {
            return;
          }

          setLoadError(
            caughtError instanceof
              Error
              ? caughtError.message
              : TEXT.fr.loadError
          );
        }).finally(() => {
          if (
            !signal?.aborted
          ) {
            setLoadingCampaign(
              false
            );
          }
        });
      },
      []
    );
const loadCampaign = useCallback((campaignId: string, signal?: AbortSignal) => {
setLoadingCampaign(true); setLoadError("");
return loadCampaignRequest(campaignId, signal);
}, [loadCampaignRequest]);


  useEffect(() => {
    if (
      !isEditMode ||
      !editId
    ) {
      return;
    }

    const controller =
      new AbortController();

    void loadCampaignRequest(
      editId,
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [
    isEditMode,
    editId,
    loadCampaignRequest,
  ]);

  /* ==========================================
     APERÇUS DES NOUVELLES IMAGES
  ========================================== */



  /* ==========================================
     AJOUTER DES IMAGES
  ========================================== */

  function addImages(
    files: File[]
  ) {
    if (
      disabled ||
      files.length === 0
    ) {
      return;
    }

    setError("");

    const nextImages =
      [...newImages];

    let errorMessage = "";

    for (
      const file of files
    ) {
      if (
        !IMAGE_TYPES.has(
          file.type
        )
      ) {
        errorMessage =
          t.imageFormatError;

        continue;
      }

      if (
        file.size <= 0 ||
        file.size >
          MAX_IMAGE_SIZE
      ) {
        errorMessage =
          t.imageSizeError;

        continue;
      }

      if (
        nextImages.some(
          (existing) =>
            filesMatch(
              existing,
              file
            )
        )
      ) {
        errorMessage =
          t.imageDuplicateError;

        continue;
      }

      if (
        storedImages.length +
          nextImages.length >=
        MAX_IMAGES
      ) {
        errorMessage =
          t.imageCountError;

        break;
      }

      nextImages.push(
        file
      );
    }

    setNewImages(
      nextImages
    );

    if (
      errorMessage
    ) {
      setError(
        errorMessage
      );
    }
  }

  /* ==========================================
     SÉLECTION PAR INPUT
  ========================================== */

  function onFilesSelected(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.currentTarget.files ??
          []
      );

    addImages(
      files
    );

    event.currentTarget.value =
      "";
  }

  /* ==========================================
     SUPPRIMER UNE IMAGE EXISTANTE

     Retrait local seulement.
     La modification est appliquée
     côté serveur après le PATCH.
  ========================================== */

  function removeStoredImage(
    id: string
  ) {
    if (disabled) {
      return;
    }

    setStoredImages(
      (previous) =>
        previous.filter(
          (image) =>
            image.id !== id
        )
    );

    setError("");
  }

  /* ==========================================
     SUPPRIMER UNE NOUVELLE IMAGE
  ========================================== */

  function removeNewImage(
    index: number
  ) {
    if (disabled) {
      return;
    }

    setNewImages(
      (previous) =>
        previous.filter(
          (_, currentIndex) =>
            currentIndex !== index
        )
    );

    setError("");
  }

  /* ==========================================
     OUVRIR LE SÉLECTEUR
  ========================================== */

  function openPicker() {
    if (
      disabled ||
      totalImages >= MAX_IMAGES
    ) {
      return;
    }

    fileInputRef.current?.click();
  }

  /* ==========================================
     GLISSER-DÉPOSER
  ========================================== */

  function onDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      disabled ||
      totalImages >= MAX_IMAGES
    ) {
      event.dataTransfer.dropEffect =
        "none";

      return;
    }

    event.dataTransfer.dropEffect =
      "copy";

    setDragging(true);
  }

  function onDragLeave(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      !event.currentTarget.contains(
        event.relatedTarget as Node | null
      )
    ) {
      setDragging(false);
    }
  }

  function onDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setDragging(false);

    if (disabled) {
      return;
    }

    addImages(
      Array.from(
        event.dataTransfer.files
      )
    );
  }

  /* ==========================================
     VALIDATION DES SIX CHAMPS
  ========================================== */

  function validateForm():
    string | null {
    const cleanTitle =
      title.trim();

    if (
      cleanTitle.length <
        MIN_TITLE ||
      cleanTitle.length >
        MAX_TITLE
    ) {
      return t.titleError;
    }

    if (
      totalImages < 1 ||
      totalImages >
        MAX_IMAGES
    ) {
      return t.imagesError;
    }

    const cleanDescription =
      description.trim();

    if (
      cleanDescription.length <
        MIN_DESCRIPTION ||
      cleanDescription.length >
        MAX_DESCRIPTION
    ) {
      return t.descriptionError;
    }

    if (
      !getCountries().includes(
        countryCode as CountryCode
      )
    ) {
      return t.countryError;
    }

    if (
      city.trim().length <
        1 ||
      city.trim().length >
        MAX_CITY
    ) {
      return t.cityError;
    }

    if (
      parseGoal(goalAmount, currency) === null
    ) {
      return t.goalError;
    }

    return null;
  }

  /* ==========================================
     ENVOI DES NOUVELLES IMAGES

     Les anciennes images ne sont
     jamais téléversées à nouveau.
  ========================================== */

  async function uploadNewImages():
    Promise<string[]> {
    const cached = uploadCache.current;
    if (cached && cached.files.length === newImages.length && cached.files.every((file, index) => file === newImages[index])) return cached.ids;

    if (
      newImages.length === 0
    ) {
      return [];
    }

    const formData =
      new FormData();

    for (
      const file of newImages
    ) {
      formData.append(
        "images",
        file
      );
    }

    const response =
      await fetch(
        ROUTES.imagesApi,
        {
          method: "POST",
          credentials:
            "same-origin",
          cache: "no-store",
          body: formData,
        }
      );

    const result: ApiResponse =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      !response.ok ||
      result.success !== true ||
      !Array.isArray(
        result.images
      )
    ) {
      throw new Error(
        result.message ??
          t.imagesError
      );
    }

    const ids =
      result.images.map(
        (item) => {
          const image =
            asRecord(item);

          return textValue(
            image.id
          );
        }
      );

    if (
      ids.length !==
        newImages.length ||
      ids.some(
        (id) =>
          !UUID_PATTERN.test(
            id
          )
      ) ||
      new Set(ids).size !==
        ids.length
    ) {
      throw new Error(
        t.imagesError
      );
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
      disabled ||
      submissionLock.current ||
      mode === "checking"
    ) {
      return;
    }

    setError("");

    const validationError =
      validateForm();

    if (
      validationError
    ) {
      setError(
        validationError
      );

      return;
    }

    const parsedGoal =
      parseGoal(goalAmount, currency);

    if (
      parsedGoal === null
    ) {
      setError(
        t.goalError
      );

      return;
    }

    submissionLock.current =
      true;

    setSubmitting(true);

    try {
      /* --------------------------------------
         1. ENVOYER LES NOUVELLES IMAGES
      -------------------------------------- */

      setUploading(
        newImages.length > 0
      );

      const uploadedIds =
        await uploadNewImages();

      setUploading(false);

      /* --------------------------------------
         2. PRÉPARER LES DONNÉES
      -------------------------------------- */

      const payload = {
        title:
          title.trim(),

        description:
          description.trim(),

        countryCode,

        city:
          city.trim(),

        goalAmount:
          currencyDecimals(currency) === 0 ? parsedGoal.toString() : `${parsedGoal / 100n}.${String(parsedGoal % 100n).padStart(2, "0")}`,

        currency,

        /* ----------------------------------
           Images nouvellement envoyées
        ---------------------------------- */

        images:
          uploadedIds.map(
            (id) => ({
              id,
            })
          ),

        /* ----------------------------------
           Images existantes conservées
        ---------------------------------- */

        keepImageIds:
          storedImages.map(
            (image) =>
              image.id
          ),

        locale,
      };

      /* --------------------------------------
         3. CHOISIR POST OU PATCH
      -------------------------------------- */

      if (
        isEditMode &&
        !editId
      ) {
        throw new Error(
          t.invalidId
        );
      }

      const fingerprint = JSON.stringify(payload);
      if (!publicationAttempt.current || publicationAttempt.current.fingerprint !== fingerprint) {
        publicationAttempt.current = { fingerprint, id: crypto.randomUUID() };
      }
      const requestPayload = { ...payload, requestId: publicationAttempt.current.id };
      const url =
        isEditMode &&
        editId
          ? `${ROUTES.campaignsApi}/${encodeURIComponent(
              editId
            )}`
          : ROUTES.campaignsApi;

      const method =
        isEditMode
          ? "PATCH"
          : "POST";

      /* --------------------------------------
         4. ENREGISTRER DANS POSTGRESQL
      -------------------------------------- */

      const response =
        await fetch(
          url,
          {
            method,

            credentials:
              "same-origin",

            cache: "no-store",

            headers: {
              "Content-Type":
                "application/json",
              "Accept-Language": locale,
            },

            body:
              JSON.stringify(requestPayload),
          }
        );

      const result: ApiResponse =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.message ??
            t.saveError
        );
      }

      /* --------------------------------------
         5. CONFIRMATION
      -------------------------------------- */

      if (!isEditMode) {
        setTitle(""); setDescription(""); setGoalAmount(""); setCity(""); setNewImages([]); setStoredImages([]);
        uploadCache.current = null; publicationAttempt.current = null;
      }
      setSuccess(
        result.message ??
          (isEditMode
            ? t.successEdit
            : t.successCreate)
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : t.networkError
      );
    } finally {
      setUploading(
        false
      );

      setSubmitting(
        false
      );

      submissionLock.current =
        false;
    }
  }

  /* ==========================================
     ÉCRAN INITIAL
  ========================================== */

  if (
    mode === "checking" ||
    loadingCampaign
  ) {
    return (
      <main className="flex min-h-full w-full items-center justify-center bg-[#f6f9fb] px-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-center"
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

  if (
    loadError
  ) {
    return (
      <main className="flex min-h-full w-full flex-col items-center justify-center gap-4 bg-[#f6f9fb] p-4 text-center">
        <p
          role="alert"
          className="text-sm font-semibold text-red-700"
        >
          {loadError}
        </p>

        {editId && (
          <button
            type="button"
            onClick={() =>
              void loadCampaign(
                editId
              )
            }
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-extrabold text-white"
          >
            {t.retry}
          </button>
        )}

        <Link
          href={
            ROUTES.campaigns
          }
          className="text-sm font-bold text-green-800 underline"
        >
          {t.back}
        </Link>
      </main>
    );
  }

  /* ============================================
     FORMULAIRE PC / MOBILE
  ============================================ */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f6f9fb] text-[#101828]">
      {/* ======================================
          EN-TÊTE

          Pleine largeur.
          Aucun menu supplémentaire.
      ====================================== */}

      <header className="relative w-full overflow-hidden border-b border-[#e2e9ef] bg-white">
        <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-r from-[#e2ffd4] via-[#f5ffe4] to-[#fff4d3] opacity-75" />

        <div className="relative flex w-full min-w-0 items-center gap-3 px-3 py-5 sm:gap-4 sm:px-5 lg:px-6 lg:py-6">
          <Link
            href={
              ROUTES.campaigns
            }
            aria-label={
              t.back
            }
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-800 transition-colors hover:bg-green-100"
          >
            <ArrowLeft
              size={22}
              aria-hidden="true"
            />
          </Link>

          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e1ffd7] text-[#078d27] sm:size-15">
            <Coins
              size={30}
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-extrabold tracking-tight text-[#10213a] sm:text-2xl lg:text-[30px]">
              {isEditMode
                ? t.editTitle
                : t.createTitle}
            </h1>

            <p className="mt-1 text-xs leading-relaxed text-[#516078] sm:text-sm">
              {isEditMode
                ? t.editSubtitle
                : t.createSubtitle}
            </p>
          </div>
        </div>

        <div className="relative h-1 w-full bg-linear-to-r from-[#007d29] via-[#62d80b] to-[#ffc51a]" />
      </header>

      {/* ======================================
          FORMULAIRE

          AUCUN max-w :
          totalité de la largeur disponible.
      ====================================== */}

      <form
        onSubmit={
          handleSubmit
        }
        noValidate
        className="flex w-full min-w-0 flex-1 flex-col p-3 sm:p-5 lg:p-6"
      >
        <section className="flex w-full min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-[#e1e8ef] bg-white p-3 shadow-sm sm:gap-4 sm:p-5 lg:p-6">
          {/* ====================================
              1. NOM DE LA CAGNOTTE
          ==================================== */}

          <div className="w-full min-w-0">
            <label
              htmlFor="campaign-title"
              className={
                LABEL_CLASS
              }
            >
              {t.title}{" "}
              <span className="text-red-600">
                *
              </span>
            </label>

            <input
              id="campaign-title"
              name="title"
              type="text"
              required
              minLength={MIN_TITLE}
              maxLength={MAX_TITLE}
              autoComplete="off"
              value={title}
              onChange={(
                event
              ) => {
                setTitle(
                  event.target.value
                );

                setError("");
              }}
              disabled={disabled}
              placeholder={
                t.titlePlaceholder
              }
              className={
                INPUT_CLASS
              }
            />
          </div>

          {/* ====================================
              2. IMAGES
          ==================================== */}

          <div className="w-full min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label
                htmlFor="campaign-images"
                className="text-sm font-extrabold text-[#13213c]"
              >
                {t.images}{" "}
                <span className="text-red-600">
                  *
                </span>
              </label>

              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
                {totalImages} / {MAX_IMAGES}
              </span>
            </div>

            <input
              ref={
                fileInputRef
              }
              id="campaign-images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={
                disabled ||
                totalImages >= MAX_IMAGES
              }
              onChange={
                onFilesSelected
              }
              className="sr-only"
              tabIndex={-1}
            />

            {/* IMAGES EXISTANTES */}

            {storedImages.length > 0 && (
              <div className="mb-4 w-full">
                <h2 className="mb-2 text-xs font-extrabold text-[#536079]">
                  {t.existingImages}
                </h2>

                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {storedImages.map(
                    (image, index) => (
                      <div
                        key={image.id}
                        className="relative h-28 w-25 shrink-0 overflow-hidden rounded-xl border border-[#dbe3eb] bg-gray-100 shadow-sm sm:h-36 sm:w-32"
                      >
                        {image.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              image.url
                            }
                            alt={`${t.existingImages} ${index + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                            <ImagePlus
                              size={28}
                              aria-hidden="true"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            removeStoredImage(
                              image.id
                            )
                          }
                          disabled={
                            disabled
                          }
                          aria-label={`${t.removeImage} ${index + 1}`}
                          title={
                            t.removeImage
                          }
                          className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-white text-red-600 shadow-md hover:bg-red-50 disabled:opacity-50"
                        >
                          <X
                            size={17}
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ZONE D'AJOUT */}

            <div
              onDragOver={
                onDragOver
              }
              onDragLeave={
                onDragLeave
              }
              onDrop={
                onDrop
              }
              className={[
                "flex w-full flex-wrap items-start",
                "gap-2 rounded-xl",
                "sm:gap-3",
                dragging
                  ? "bg-green-50"
                  : "bg-white",
              ].join(" ")}
            >
              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={
                    openPicker
                  }
                  disabled={
                    disabled
                  }
                  className={[
                    "flex h-30 w-34 shrink-0",
                    "flex-col items-center",
                    "justify-center gap-1",
                    "rounded-xl",
                    "border-2 border-dashed",
                    "border-green-500",
                    "bg-[#f2fff0]",
                    "px-2 text-center",
                    "transition-colors",
                    "hover:bg-green-50",
                    "disabled:opacity-50",
                    "sm:h-36 sm:w-50",
                    "lg:h-38 lg:w-62",
                  ].join(" ")}
                >
                  <CloudUpload
                    size={32}
                    className="text-green-700"
                    aria-hidden="true"
                  />

                  <span className="text-xs font-extrabold text-[#19412b] sm:text-sm">
                    {t.upload}
                  </span>

                  <span className="hidden text-xs text-gray-600 lg:block">
                    {t.drag}
                  </span>

                  <span className="mt-1 text-[10px] font-medium text-green-900 sm:text-xs">
                    {t.formats}
                  </span>
                </button>
              )}

              {/* NOUVELLES IMAGES */}

              {newImages.map(
                (file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="relative h-30 w-25 shrink-0 overflow-hidden rounded-xl border border-[#dbe3eb] bg-gray-100 shadow-sm sm:h-36 sm:w-32 lg:h-38"
                  >
                    <CampaignImagePreview
                      file={file}
                      alt={`${t.newImages} ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeNewImage(
                          index
                        )
                      }
                      disabled={
                        disabled
                      }
                      aria-label={`${t.removeImage} ${index + 1}`}
                      className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-white text-red-600 shadow-md hover:bg-red-50 disabled:opacity-50"
                    >
                      <X
                        size={17}
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                )
              )}

              {totalImages > 0 &&
                totalImages < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={
                      openPicker
                    }
                    disabled={
                      disabled
                    }
                    aria-label={
                      t.upload
                    }
                    className="flex h-30 w-19 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[#b5c4d5] bg-white text-[#16314a] hover:border-green-600 hover:bg-green-50 disabled:opacity-50 sm:h-36 sm:w-22 lg:h-38"
                  >
                    <Plus
                      size={30}
                      aria-hidden="true"
                    />
                  </button>
                )}
            </div>

            
          </div>

          {/* ====================================
              3. DESCRIPTION
          ==================================== */}

          <div className="w-full min-w-0">
            <label
              htmlFor="campaign-description"
              className={
                LABEL_CLASS
              }
            >
              {t.description}{" "}
              <span className="text-red-600">
                *
              </span>
            </label>

            <textarea
              id="campaign-description"
              name="description"
              required
              minLength={MIN_DESCRIPTION}
              maxLength={MAX_DESCRIPTION}
              rows={5}
              value={
                description
              }
              onChange={(
                event
              ) => {
                setDescription(
                  event.target.value
                );

                setError("");
              }}
              disabled={
                disabled
              }
              placeholder={
                t.descriptionPlaceholder
              }
              className="min-h-30 w-full min-w-0 resize-y rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-3 text-sm leading-relaxed text-[#10223b] outline-none placeholder:text-[#8190a3] focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
            />

            <p className="mt-1 text-right text-xs text-[#66758a]">
              {description.length} / {MAX_DESCRIPTION}
            </p>
          </div>

          {/* ====================================
              4. PAYS / 5. VILLE

              PC : 2 colonnes
              MOBILE : 1 colonne
          ==================================== */}

          <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            {/* PAYS */}

            <div className="min-w-0">
              <label
                htmlFor="campaign-country"
                className={
                  LABEL_CLASS
                }
              >
                {t.country}{" "}
                <span className="text-red-600">
                  *
                </span>
              </label>

              <div className="relative">
                <MapPin
                  size={19}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-green-700"
                  aria-hidden="true"
                />

                <select
                  id="campaign-country"
                  name="countryCode"
                  value={
                    countryCode
                  }
                  required
                  onChange={(
                    event
                  ) => {
                    manuallySelectedCountry.current =
                      true;

                    setCountryCode(
                      event.target.value
                    );

                    setError("");
                  }}
                  disabled={
                    disabled
                  }
                  className={`${INPUT_CLASS} appearance-none pr-10 pl-11`}
                >
                  <option value="">
                    {t.selectCountry}
                  </option>

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
                        {country.flag}{" "}
                        {country.name}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#21354e]"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* VILLE */}

            <div className="min-w-0">
              <label
                htmlFor="campaign-city"
                className={
                  LABEL_CLASS
                }
              >
                {t.city}{" "}
                <span className="text-red-600">
                  *
                </span>
              </label>

              <input
                id="campaign-city"
                name="city"
                type="text"
                required
                maxLength={MAX_CITY}
                value={
                  city
                }
                onChange={(
                  event
                ) => {
                  setCity(
                    event.target.value
                  );

                  setError("");
                }}
                disabled={
                  disabled
                }
                placeholder={
                  t.cityPlaceholder
                }
                className={
                  INPUT_CLASS
                }
              />
            </div>
          </div>

          {/* ====================================
              6. OBJECTIF DE LA CAGNOTTE
          ==================================== */}

          <div className="w-full min-w-0">
            <label
              htmlFor="campaign-goal"
              className={
                LABEL_CLASS
              }
            >
              {t.goal}{" "}
              <span className="text-red-600">
                *
              </span>
            </label>

            <div className="flex w-full min-w-0 overflow-hidden rounded-xl border border-[#cbd5e1] bg-white transition-colors focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
              <input
                id="campaign-goal"
                name="goalAmount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                value={
                  goalAmount
                }
                onChange={(
                  event
                ) => {
                  setGoalAmount(
                    formatGoalInput(
                      event.target.value,
                      locale
                    )
                  );

                  setError("");
                }}
                disabled={
                  disabled
                }
                placeholder={
                  t.goalPlaceholder
                }
                className="h-12 min-w-0 flex-1 bg-transparent px-3.5 text-sm font-medium text-[#10223b] outline-none placeholder:text-[#8190a3] disabled:opacity-60"
              />

              <div className="flex shrink-0 items-center border-l border-[#dbe3eb] bg-[#f1f4f7]">
                <label
                  htmlFor="campaign-currency"
                  className="sr-only"
                >
                  {t.currency}
                </label>

                <select
                  id="campaign-currency"
                  name="currency"
                  value={
                    currency
                  }
                  onChange={(
                    event
                  ) => {
                    setCurrency(
                      event.target.value as Currency
                    );

                    setError("");
                  }}
                  disabled={
                    disabled
                  }
                  className="h-full min-w-21 cursor-pointer bg-transparent px-2 text-center text-xs font-extrabold text-[#13213c] outline-none disabled:opacity-60 sm:text-sm"
                >
                  {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyLabel(code, locale)}</option>)}

                  

                  
                </select>
              </div>
            </div>
          </div>

          {/* ====================================
              ERREURS
          ==================================== */}

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* ====================================
              CONFIRMATION
          ==================================== */}

          {success && (
            <div
              role="status"
              aria-live="polite"
              className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900"
            >
              <CheckCircle2
                size={21}
                className="shrink-0"
                aria-hidden="true"
              />

              <span className="flex-1">
                {success}
              </span>

              <Link
                href={
                  ROUTES.campaigns
                }
                className="text-xs font-extrabold text-green-800 underline"
              >
                {t.back}
              </Link>
            </div>
          )}

          {/* ====================================
              BOUTON PRINCIPAL

              Création : POST
              Modification : PATCH

              Pleine largeur sur PC/mobile.
          ==================================== */}

          <button
            type="submit"
            disabled={
              disabled
            }
            className="flex min-h-14 shrink-0 w-full items-center justify-center gap-3 rounded-xl bg-linear-to-b from-[#28d400] via-[#0ca918] to-[#006d19] px-4 py-3 text-center text-base font-extrabold text-white shadow-md transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
          >
            {submitting ? (
              <>
                <LoaderCircle
                  size={23}
                  className="shrink-0 animate-spin"
                  aria-hidden="true"
                />

                <span>
                  {uploading
                    ? t.uploading
                    : isEditMode
                      ? t.saving
                      : t.publishing}
                </span>
              </>
            ) : isEditMode ? (
              <>
                <Save
                  size={23}
                  aria-hidden="true"
                />

                <span>
                  {t.save}
                </span>
              </>
            ) : (
              <>
                <Send
                  size={23}
                  aria-hidden="true"
                />

                <span>
                  {t.publish}
                </span>
              </>
            )}
          </button>
        </section>

        {/* ====================================
            ACCENT VISUEL TIKEMIA
        ==================================== */}

        <div
          aria-hidden="true"
          className="mt-4 h-2 w-full rounded-full bg-linear-to-r from-[#00792b] via-[#83dc05] to-[#ffc41d]"
        />
      </form>
    </main>
  );
}
