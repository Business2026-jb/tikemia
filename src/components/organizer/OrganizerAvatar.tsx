
"use client";

import Image from "next/image";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  Camera,
  CheckCircle2,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — PHOTO DE PROFIL ORGANISATEUR

   Fichier :
   src/components/organizer/OrganizerAvatar.tsx

   Fonctionnalités :
   - Affichage de la photo de profil
   - Initiales si aucune photo
   - Ajouter une photo
   - Remplacer une photo
   - Supprimer une photo
   - Validation du fichier avant upload
   - Synchronisation entre les composants
   - Rafraîchissement des URL signées
   - Messages d'erreur et de confirmation
   - Français / Anglais
   - Compatible PC, tablette et mobile

   API :
   GET /api/organizer/settings/profile/avatar

   POST /api/organizer/settings/profile/avatar

   DELETE /api/organizer/settings/profile/avatar

   Aucun fichier de style supplémentaire.
   Aucun nouveau composant externe.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const AVATAR_API =
  "/api/organizer/settings/profile/avatar";

const AVATAR_UPDATED_EVENT =
  "tikemia:organizer-avatar-updated";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const REFRESH_BEFORE_EXPIRY_MS =
  60 * 1000;

/* ==========================================================
   TYPES
========================================================== */

export type OrganizerAvatarSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl";

export type OrganizerAvatarLocale =
  | "fr"
  | "en";

export interface OrganizerAvatarProps {
  fullName?: string;
  firstName?: string;
  lastName?: string;

  size?: OrganizerAvatarSize;

  locale?: OrganizerAvatarLocale;

  editable?: boolean;

  showName?: boolean;

  showActions?: boolean;

  rounded?: boolean;

  className?: string;

  onAvatarChange?: (
    avatarUrl: string | null
  ) => void;
}

type AvatarResponse = {
  success: boolean;

  message?: string;

  avatar?: {
    hasAvatar?: boolean;
    url?: string | null;
    expiresIn?: number;
  };
};

type Notification = {
  type: "success" | "error";
  message: string;
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    avatar: "Photo de profil",

    add: "Ajouter une photo",

    change: "Modifier la photo",

    delete: "Supprimer la photo",

    uploading: "Enregistrement de la photo...",

    deleting: "Suppression de la photo...",

    loading: "Chargement de la photo...",

    updated:
      "Votre photo de profil a été enregistrée.",

    removed:
      "Votre photo de profil a été supprimée.",

    invalidFile:
      "Veuillez sélectionner une image JPEG, PNG ou WebP.",

    fileTooLarge:
      "La photo ne doit pas dépasser 5 Mo.",

    error:
      "Impossible de gérer la photo de profil pour le moment.",

    confirmDelete:
      "Voulez-vous supprimer votre photo de profil ?",

    imageHelp:
      "Formats : JPG, PNG ou WebP. Maximum 5 Mo.",

    noPhoto:
      "Aucune photo de profil enregistrée.",

    retry: "Réessayer",

    uploadHint:
      "La photo sera automatiquement adaptée au format du profil.",

    user: "Organisateur",
  },

  en: {
    avatar: "Profile picture",

    add: "Add a photo",

    change: "Change photo",

    delete: "Remove photo",

    uploading: "Saving profile picture...",

    deleting: "Removing profile picture...",

    loading: "Loading profile picture...",

    updated:
      "Your profile picture has been saved.",

    removed:
      "Your profile picture has been removed.",

    invalidFile:
      "Please select a JPEG, PNG or WebP image.",

    fileTooLarge:
      "Your picture must not exceed 5 MB.",

    error:
      "Unable to manage your profile picture right now.",

    confirmDelete:
      "Do you want to remove your profile picture?",

    imageHelp:
      "Formats: JPG, PNG or WebP. Maximum 5 MB.",

    noPhoto:
      "No profile picture saved.",

    retry: "Try again",

    uploadHint:
      "Your photo will be automatically adapted to the profile format.",

    user: "Organizer",
  },
} as const;

/* ==========================================================
   TAILLES RESPONSIVE

   xs : petits avatars dans les menus
   sm : en-tête du dashboard
   md : cartes et paramètres
   lg : formulaire de profil
   xl : grande photo principale

   Les classes sont statiques afin
   d'être reconnues par Tailwind.
========================================================== */

const SIZE_CLASSES: Record<
  OrganizerAvatarSize,
  {
    avatar: string;
    text: string;
    camera: string;
    cameraIcon: number;
  }
> = {
  xs: {
    avatar:
      "h-9 w-9 sm:h-10 sm:w-10",

    text:
      "text-xs sm:text-sm",

    camera:
      "h-5 w-5 -bottom-1 -right-1",

    cameraIcon: 11,
  },

  sm: {
    avatar:
      "h-10 w-10 sm:h-11 sm:w-11",

    text:
      "text-sm sm:text-base",

    camera:
      "h-6 w-6 -bottom-1 -right-1",

    cameraIcon: 12,
  },

  md: {
    avatar:
      "h-16 w-16 sm:h-18 sm:w-18",

    text:
      "text-xl sm:text-2xl",

    camera:
      "h-7 w-7 -bottom-1 -right-1",

    cameraIcon: 14,
  },

  lg: {
    avatar:
      "h-22 w-22 sm:h-26 sm:w-26",

    text:
      "text-2xl sm:text-3xl",

    camera:
      "h-8 w-8 -bottom-1 -right-1",

    cameraIcon: 16,
  },

  xl: {
    avatar:
      "h-28 w-28 sm:h-36 sm:w-36 lg:h-40 lg:w-40",

    text:
      "text-3xl sm:text-4xl",

    camera:
      "h-9 w-9 -bottom-1 -right-1",

    cameraIcon: 18,
  },
};

/* ==========================================================
   UTILITAIRES
========================================================== */

function getInitials(
  fullName: string,
  firstName: string,
  lastName: string
): string {
  const first =
    firstName.trim().charAt(0);

  const last =
    lastName.trim().charAt(0);

  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }

  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "T";
}

function getDisplayName(
  fullName: string,
  firstName: string,
  lastName: string,
  fallback: string
): string {
  const combined =
    `${firstName} ${lastName}`.trim();

  return combined || fullName.trim() || fallback;
}

function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError"
  );
}

async function parseApiResponse(
  response: Response
): Promise<AvatarResponse> {
  let result: AvatarResponse = {
    success: false,
  };

  try {
    result =
      (await response.json()) as AvatarResponse;
  } catch {
    result = {
      success: false,
    };
  }

  if (
    !response.ok ||
    result.success !== true
  ) {
    throw new Error(
      result.message ||
        `Erreur HTTP ${response.status}`
    );
  }

  return result;
}

/* ==========================================================
   COMPOSANT PRINCIPAL
========================================================== */

export default function OrganizerAvatar({
  fullName = "",
  firstName = "",
  lastName = "",

  size = "md",

  locale = "fr",

  editable = false,

  showName = false,

  showActions = true,

  rounded = true,

  className = "",

  onAvatarChange,
}: OrganizerAvatarProps) {
  /* ========================================================
     ÉTATS
  ======================================================== */

  const [avatarUrl, setAvatarUrl] =
    useState<string | null>(null);

  const [hasAvatar, setHasAvatar] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [notification, setNotification] =
    useState<Notification | null>(null);

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const requestController =
    useRef<AbortController | null>(null);

  const requestSequence =
    useRef(0);

  const refreshTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const mounted =
    useRef(false);

  const loadAvatarRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  const avatarUrlRef =
    useRef<string | null>(null);

  const onAvatarChangeRef =
    useRef(onAvatarChange);

  /* ========================================================
     DONNÉES D'AFFICHAGE
  ======================================================== */

  const t = TEXT[locale];

  const dimensions =
    SIZE_CLASSES[size];

  const initials =
    getInitials(
      fullName,
      firstName,
      lastName
    );

  const displayName =
    getDisplayName(
      fullName,
      firstName,
      lastName,
      t.user
    );

  const busy =
    uploading || deleting;

  const canEdit =
    editable && !busy;

  /* ========================================================
     SYNCHRONISER LES RÉFÉRENCES
  ======================================================== */

  useEffect(() => {
    onAvatarChangeRef.current =
      onAvatarChange;
  }, [onAvatarChange]);

  useEffect(() => {
    avatarUrlRef.current =
      avatarUrl;
  }, [avatarUrl]);

  /* ========================================================
     ANNULER LE TIMER DE RENOUVELLEMENT
  ======================================================== */

  const clearRefreshTimer =
    useCallback(() => {
      if (refreshTimer.current) {
        clearTimeout(
          refreshTimer.current
        );

        refreshTimer.current =
          null;
      }
    }, []);

  /* ========================================================
     APPLIQUER UNE PHOTO

     Le callback permet au parent
     d'utiliser lui aussi l'URL.
  ======================================================== */

  const applyAvatar =
    useCallback(
      (
        url: string | null,
        exists: boolean
      ) => {
        if (!mounted.current) {
          return;
        }

        setAvatarUrl(url);

        setHasAvatar(exists);

        if (
          avatarUrlRef.current !==
          url
        ) {
          onAvatarChangeRef.current?.(
            url
          );
        }

        avatarUrlRef.current =
          url;
      },
      []
    );

  /* ========================================================
     CHARGER LA PHOTO DEPUIS L'API

     GET :
     /api/organizer/settings/profile/avatar

     Pas de cache partagé.

     Les requêtes précédentes sont annulées.
  ======================================================== */

  const loadAvatarRequest =
    useCallback(
      async (
        showLoader = false
      ) => {
        requestController.current?.abort();

        const controller =
          new AbortController();

        requestController.current =
          controller;

        const sequence =
          ++requestSequence.current;

        clearRefreshTimer();

        void showLoader;

        return fetch(
              AVATAR_API,
              {
                method: "GET",

                credentials:
                  "same-origin",

                cache:
                  "no-store",

                signal:
                  controller.signal,
              }
            ).then(async (response) => {

          const result =
            await parseApiResponse(
              response
            );

          if (
            !mounted.current ||
            controller.signal.aborted ||
            sequence !==
              requestSequence.current
          ) {
            return;
          }

          const exists =
            result.avatar?.hasAvatar ===
            true;

          const url =
            typeof result.avatar?.url ===
            "string"
              ? result.avatar.url
              : null;

          applyAvatar(
            url,
            exists
          );

          if (exists && url) {
            const expiresIn =
              typeof result.avatar
                ?.expiresIn ===
              "number"
                ? result.avatar.expiresIn
                : 3600;

            const refreshDelay =
              Math.max(
                30_000,
                expiresIn * 1000 -
                  REFRESH_BEFORE_EXPIRY_MS
              );

            refreshTimer.current =
              setTimeout(() => {
                if (mounted.current) {
                  void loadAvatarRef.current?.(false);
                }
              }, refreshDelay);
          }
        
}).catch((error) => {
          if (
            isAbortError(error) ||
            controller.signal.aborted ||
            !mounted.current ||
            sequence !==
              requestSequence.current
          ) {
            return;
          }

          /* ------------------------------------
             En cas d'erreur réseau,
             conserver l'état existant.

             Ne pas afficher de fausse
             confirmation de chargement.
          ------------------------------------ */

          if (editable) {
            setNotification({
              type: "error",

              message:
                error instanceof Error
                  ? error.message
                  : TEXT[locale].error,
            });
          }
        }).finally(() => {
          if (
            mounted.current &&
            !controller.signal.aborted &&
            sequence ===
              requestSequence.current
          ) {
            setLoading(false);
          }
        });
      },
      [
        applyAvatar,
        clearRefreshTimer,
        editable,
        locale,
      ]
    );

  /* ========================================================
     CHARGEMENT INITIAL

     Synchronisation des autres instances
     grâce à un événement navigateur.
  ======================================================== */

  const loadAvatar = useCallback((showLoader = false) => { if (showLoader) setLoading(true); return loadAvatarRequest(showLoader); }, [loadAvatarRequest]);

  useEffect(() => { loadAvatarRef.current = loadAvatar; }, [loadAvatar]);

  useEffect(() => {
    mounted.current = true;

    void loadAvatarRequest(false);

    const refreshOnAvatarChange =
      () => {
        void loadAvatar(false);
      };

    const refreshOnFocus =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadAvatar(false);
        }
      };

    const refreshOnVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadAvatar(false);
        }
      };

    window.addEventListener(
      AVATAR_UPDATED_EVENT,
      refreshOnAvatarChange
    );

    window.addEventListener(
      "focus",
      refreshOnFocus
    );

    document.addEventListener(
      "visibilitychange",
      refreshOnVisibility
    );

    return () => {
      mounted.current = false;

      requestController.current?.abort();

      clearRefreshTimer();

      window.removeEventListener(
        AVATAR_UPDATED_EVENT,
        refreshOnAvatarChange
      );

      window.removeEventListener(
        "focus",
        refreshOnFocus
      );

      document.removeEventListener(
        "visibilitychange",
        refreshOnVisibility
      );
    };
  }, [
    loadAvatar,
    loadAvatarRequest,
    clearRefreshTimer,
  ]);

  /* ========================================================
     OUVRIR LE SÉLECTEUR DE FICHIER
  ======================================================== */

  function openFilePicker() {
    if (!canEdit) {
      return;
    }

    inputRef.current?.click();
  }

  /* ========================================================
     INFORMER LES AUTRES INSTANCES

     Exemple :
     - Photo modifiée dans Profil
     - Photo actualisée dans Header
     - Photo actualisée dans Paramètres

     La synchronisation concerne les
     composants présents dans le même
     document du navigateur.
  ======================================================== */

  function notifyAvatarUpdated() {
    window.dispatchEvent(
      new CustomEvent(
        AVATAR_UPDATED_EVENT
      )
    );
  }

  /* ========================================================
     AJOUTER OU REMPLACER UNE PHOTO

     POST multipart/form-data

     Champ :
     avatar

     Content-Type n'est pas renseigné
     manuellement : fetch ajoute
     automatiquement le boundary.
  ======================================================== */

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file || busy) {
      return;
    }

    setNotification(null);

    /* ----------------------------------------
       CONTRÔLE DU FORMAT
    ---------------------------------------- */

    if (
      !ALLOWED_FILE_TYPES.includes(
        file.type
      )
    ) {
      setNotification({
        type: "error",
        message: t.invalidFile,
      });

      return;
    }

    /* ----------------------------------------
       CONTRÔLE DE LA TAILLE
    ---------------------------------------- */

    if (
      file.size === 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      setNotification({
        type: "error",
        message: t.fileTooLarge,
      });

      return;
    }

    /* ----------------------------------------
       CRÉER LE FORM DATA
    ---------------------------------------- */

    const formData =
      new FormData();

    formData.append(
      "avatar",
      file
    );

    setUploading(true);

    /* ----------------------------------------
       ÉVITER QU'UN ANCIEN GET ÉCRASE
       UNE NOUVELLE PHOTO
    ---------------------------------------- */

    requestController.current?.abort();

    clearRefreshTimer();

    try {
      const response =
        await fetch(
          AVATAR_API,
          {
            method: "POST",

            credentials:
              "same-origin",

            body:
              formData,

            cache:
              "no-store",
          }
        );

      const result =
        await parseApiResponse(
          response
        );

      if (!mounted.current) {
        return;
      }

      const url =
        typeof result.avatar?.url ===
        "string"
          ? result.avatar.url
          : null;

      applyAvatar(
        url,
        true
      );

      setNotification({
        type: "success",

        message:
          result.message ||
          t.updated,
      });

      /* ------------------------------------
         Actualiser toutes les instances.
         Renouveler aussi l'URL si l'API
         a enregistré la photo sans pouvoir
         signer l'URL immédiatement.
      ------------------------------------ */

      notifyAvatarUpdated();
    } catch (error) {
      if (!mounted.current) {
        return;
      }

      setNotification({
        type: "error",

        message:
          error instanceof Error
            ? error.message
            : t.error,
      });

      void loadAvatar(false);
    } finally {
      if (mounted.current) {
        setUploading(false);
      }
    }
  }

  /* ========================================================
     SUPPRIMER LA PHOTO

     DELETE :
     /api/organizer/settings/profile/avatar

     Le serveur retire la référence
     User.avatarStorageKey.

     L'interface revient aux initiales.
  ======================================================== */

  async function handleDelete() {
    if (
      !editable ||
      busy ||
      !hasAvatar
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        t.confirmDelete
      );

    if (!confirmed) {
      return;
    }

    setNotification(null);

    setDeleting(true);

    requestController.current?.abort();

    clearRefreshTimer();

    try {
      const response =
        await fetch(
          AVATAR_API,
          {
            method: "DELETE",

            credentials:
              "same-origin",

            cache:
              "no-store",
          }
        );

      const result =
        await parseApiResponse(
          response
        );

      if (!mounted.current) {
        return;
      }

      applyAvatar(
        null,
        false
      );

      setNotification({
        type: "success",

        message:
          result.message ||
          t.removed,
      });

      notifyAvatarUpdated();
    } catch (error) {
      if (!mounted.current) {
        return;
      }

      setNotification({
        type: "error",

        message:
          error instanceof Error
            ? error.message
            : t.error,
      });

      void loadAvatar(false);
    } finally {
      if (mounted.current) {
        setDeleting(false);
      }
    }
  }

  /* ========================================================
     ÉCHEC DU CHARGEMENT D'IMAGE

     Exemple :
     - URL signée expirée
     - problème réseau
     - image indisponible

     Recharger une nouvelle URL signée.
  ======================================================== */

  function handleImageError() {
    if (!mounted.current) {
      return;
    }

    applyAvatar(
      null,
      hasAvatar
    );

    void loadAvatar(false);
  }

  /* ========================================================
     INTERFACE
  ======================================================== */

  return (
    <div
      className={[
        "flex min-w-0 flex-col items-center",
        "gap-3 text-center",
        className,
      ].join(" ")}
    >
      {/* ====================================================
          INPUT IMAGE PRIVÉ

          N'apparaît jamais visuellement.

          Il est déclenché par le bouton
          de modification.
      ==================================================== */}

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            void handleFileChange(event);
          }}
          className="sr-only"
          tabIndex={-1}
          aria-label={t.add}
          disabled={busy}
        />
      )}

      {/* ====================================================
          AVATAR
      ==================================================== */}

      <div className="relative inline-flex shrink-0">
        <div
          className={[
            "relative flex shrink-0",
            "items-center justify-center",
            "overflow-hidden",
            "border-[3px] border-white",
            "bg-[#e5f7e8]",
            "font-extrabold text-[#087e2c]",
            "shadow-[0_3px_12px_rgba(12,47,25,0.12)]",
            "select-none",
            dimensions.avatar,
            dimensions.text,
            rounded
              ? "rounded-full"
              : "rounded-2xl",
          ].join(" ")}
          role="img"
          aria-label={`${t.avatar} : ${displayName}`}
        >
          {avatarUrl ? (
            <Image width={512} height={512} unoptimized
              src={avatarUrl}
              alt=""
              draggable={false}
              referrerPolicy="no-referrer"
              onError={handleImageError}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <span aria-hidden="true">
              {initials}
            </span>
          )}

          {/* CHARGEMENT */}

          {(loading || busy) && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d2631]/45 text-white">
              <LoaderCircle
                size={size === "xs" || size === "sm" ? 17 : 25}
                className="animate-spin"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        {/* BOUTON CAMÉRA */}

        {editable && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={!canEdit}
            title={
              hasAvatar
                ? t.change
                : t.add
            }
            aria-label={
              hasAvatar
                ? t.change
                : t.add
            }
            className={[
              "absolute z-10",
              "flex items-center",
              "justify-center",
              "rounded-full",
              "border-2 border-white",
              "bg-[#07872c]",
              "text-white shadow-md",
              "transition-colors",
              "hover:bg-[#066c24]",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-[#087e2c]",
              "focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed",
              "disabled:opacity-60",
              dimensions.camera,
            ].join(" ")}
          >
            <Camera
              size={dimensions.cameraIcon}
              strokeWidth={2.3}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* ====================================================
          NOM FACULTATIF
      ==================================================== */}

      {showName && (
        <div className="min-w-0 max-w-full">
          <p className="wrap-break-word text-sm font-extrabold text-[#172a40] sm:text-base">
            {displayName}
          </p>

          <p className="mt-0.5 text-xs text-[#708097]">
            {t.user}
          </p>
        </div>
      )}

      {/* ====================================================
          ACTIONS D'ÉDITION

          Responsive :
          - Mobile : boutons empilés
          - PC : boutons côte à côte
      ==================================================== */}

      {editable && showActions && (
        <div className="flex w-full max-w-100 flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={!canEdit}
            className={[
              "inline-flex min-h-11",
              "items-center justify-center",
              "gap-2 rounded-xl",
              "bg-[#087f2b]",
              "px-4 py-2.5",
              "text-xs font-bold text-white",
              "transition-colors",
              "hover:bg-[#056d25]",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-green-500",
              "focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed",
              "disabled:opacity-60",
            ].join(" ")}
          >
            {uploading ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : hasAvatar ? (
              <Camera
                size={17}
                aria-hidden="true"
              />
            ) : (
              <ImagePlus
                size={17}
                aria-hidden="true"
              />
            )}

            {uploading
              ? t.uploading
              : hasAvatar
                ? t.change
                : t.add}
          </button>

          {hasAvatar && (
            <button
              type="button"
              onClick={() => {
                void handleDelete();
              }}
              disabled={busy}
              className={[
                "inline-flex min-h-11",
                "items-center justify-center",
                "gap-2 rounded-xl",
                "border border-[#f2c8c8]",
                "bg-[#fff5f5]",
                "px-4 py-2.5",
                "text-xs font-bold",
                "text-[#b42323]",
                "transition-colors",
                "hover:bg-[#ffe7e7]",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-red-400",
                "focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed",
                "disabled:opacity-60",
              ].join(" ")}
            >
              {deleting ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2
                  size={17}
                  aria-hidden="true"
                />
              )}

              {deleting
                ? t.deleting
                : t.delete}
            </button>
          )}
        </div>
      )}

      {/* ====================================================
          INDICATION DE FORMAT

          Affichée uniquement lors
          de l'édition du profil.
      ==================================================== */}

      {editable && showActions && (
        <p className="max-w-sm text-center text-[11px] leading-relaxed text-[#748398] sm:text-xs">
          {t.imageHelp}
        </p>
      )}

      {/* ====================================================
          MESSAGES

          Les erreurs sont visibles
          sans casser la disposition.
      ==================================================== */}

      {notification && editable && (
        <div
          role={
            notification.type === "error"
              ? "alert"
              : "status"
          }
          className={[
            "flex w-full max-w-md",
            "items-start gap-2",
            "rounded-xl border",
            "px-3 py-2.5",
            "text-left text-xs",
            "font-semibold leading-relaxed",
            notification.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notification.type === "success" ? (
            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CircleAlert
              size={17}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
          )}

          <span className="min-w-0 flex-1 wrap-break-word">
            {notification.message}
          </span>

          {notification.type === "error" && (
            <button
              type="button"
              onClick={() => {
                void loadAvatar(true);
              }}
              aria-label={t.retry}
              title={t.retry}
              className="shrink-0"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   EXPORT NOMMÉ

   Compatible avec :

   import OrganizerAvatar from "...";

   ET :

   import { OrganizerAvatar } from "...";
========================================================== */

export {
  OrganizerAvatar,
};
