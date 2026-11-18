
"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  ImagePlus,
  Plus,
  X,
} from "lucide-react";

/* ============================================
   TIKEMIA — IMAGES DES ÉVÉNEMENTS

   Composant : EventImageUploader

   Fonctionnalités :
   - Ajout de 1 à 10 images
   - JPG / JPEG / PNG / WebP
   - Sélection de plusieurs fichiers
   - Glisser-déposer sur PC
   - Aperçus automatiques
   - Suppression individuelle
   - Contrôle des doublons
   - Contrôle de la taille
   - Libération des URL temporaires
   - Français / Anglais
   - Mobile / Tablette / PC

   Les fichiers sont conservés dans
   l'état du formulaire parent.

   Aucun envoi réseau automatique.
============================================ */

/* ============================================
   CONFIGURATION
============================================ */

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const INPUT_ACCEPT =
  "image/jpeg,image/png,image/webp";

/* ============================================
   TYPES
============================================ */

export type EventImageUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  locale?: "fr" | "en";
  disabled?: boolean;
  className?: string;
};

function EventImagePreview({ file, alt }: { file: File; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Les aperçus utilisent une URL locale temporaire, sans requête réseau.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imageRef} alt={alt} className="h-full w-full object-cover" draggable={false} />;
}

/* ============================================
   TEXTES FRANÇAIS / ANGLAIS
============================================ */

const TEXT = {
  fr: {
    title: "Images de l'événement",
    required: "Obligatoire",
    upload: "Ajouter des images",
    drop: "Glissez-déposez vos images ici",
    or: "ou cliquez pour sélectionner",
    count: "images",
    limit: "1 à 10 images (maximum 10 Mo chacune)",
    addMore: "Ajouter",
    remove: "Supprimer l'image",
    preview: "Aperçu de l'image",
    full: "10 images maximum",
    invalidType:
      "Format non accepté. Utilisez JPG, PNG ou WebP.",
    tooLarge:
      "Une image dépasse la taille maximale de 10 Mo.",
    tooMany:
      "Vous pouvez ajouter 10 images maximum.",
    duplicate:
      "Cette image est déjà sélectionnée.",
    empty:
      "Ajoutez au moins une image de l'événement.",
    selected: "Images sélectionnées",
  },
  en: {
    title: "Event images",
    required: "Required",
    upload: "Add images",
    drop: "Drag and drop your images here",
    or: "or click to select",
    count: "images",
    limit: "1 to 10 images (maximum 10 MB each)",
    addMore: "Add more",
    remove: "Remove image",
    preview: "Image preview",
    full: "Maximum 10 images",
    invalidType:
      "Unsupported format. Use JPG, PNG or WebP.",
    tooLarge:
      "An image exceeds the 10 MB size limit.",
    tooMany:
      "You can add a maximum of 10 images.",
    duplicate:
      "This image has already been selected.",
    empty:
      "Add at least one event image.",
    selected: "Selected images",
  },
} as const;

/* ============================================
   UTILITAIRES
============================================ */

function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type);
}

function isDuplicate(
  first: File,
  second: File
): boolean {
  return (
    first.name === second.name &&
    first.size === second.size &&
    first.lastModified === second.lastModified
  );
}

function formatFileSize(size: number): string {
  const mb = size / (1024 * 1024);

  if (mb >= 1) {
    return `${mb.toFixed(1)} Mo`;
  }

  return `${Math.max(
    1,
    Math.round(size / 1024)
  )} Ko`;
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function EventImageUploader({
  files,
  onChange,
  locale = "fr",
  disabled = false,
  className = "",
}: EventImageUploaderProps) {
  /* ==========================================
     RÉFÉRENCES
  ========================================== */

  const inputRef = useRef<HTMLInputElement>(null);

  const inputId = useId();
  const titleId = useId();
  const descriptionId = useId();

  /* ==========================================
     ÉTATS
  ========================================== */


  const [dragActive, setDragActive] =
    useState(false);

  const [error, setError] = useState("");

  const [showSuccess, setShowSuccess] =
    useState(false);

  const t = TEXT[locale];

  const count = files.length;
  const canAddMore = count < MAX_IMAGES;
  const isFull = count >= MAX_IMAGES;

  /* ==========================================
     CRÉATION DES APERÇUS

     Une URL temporaire est créée pour
     chaque image.

     Toutes les URL sont libérées lors
     d'une modification ou du démontage.
  ========================================== */


  /* ==========================================
     MASQUER LE MESSAGE DE SUCCÈS
     LORS D'UNE NOUVELLE SÉLECTION
  ========================================== */

  function clearMessages() {
    setError("");
    setShowSuccess(false);
  }

  /* ==========================================
     OUVRIR LE SÉLECTEUR
  ========================================== */

  function openFilePicker() {
    if (disabled || isFull) {
      return;
    }

    inputRef.current?.click();
  }

  /* ==========================================
     AJOUTER DES IMAGES

     - Contrôle du nombre
     - Contrôle des formats
     - Contrôle des tailles
     - Contrôle des doublons

     Les fichiers déjà valides restent
     présents lorsqu'un ajout est refusé.
  ========================================== */

  function addFiles(selectedFiles: File[]) {
    if (disabled || selectedFiles.length === 0) {
      return;
    }

    clearMessages();

    const nextFiles = [...files];

    let invalidType = false;
    let tooLarge = false;
    let tooMany = false;
    let duplicate = false;

    for (const file of selectedFiles) {
      if (!isAcceptedImage(file)) {
        invalidType = true;
        continue;
      }

      if (
        file.size === 0 ||
        file.size > MAX_FILE_SIZE
      ) {
        tooLarge = true;
        continue;
      }

      const alreadyAdded = nextFiles.some(
        (existing) => isDuplicate(existing, file)
      );

      if (alreadyAdded) {
        duplicate = true;
        continue;
      }

      if (nextFiles.length >= MAX_IMAGES) {
        tooMany = true;
        continue;
      }

      nextFiles.push(file);
    }

    if (nextFiles.length !== files.length) {
      onChange(nextFiles);
      setShowSuccess(true);
    }

    if (invalidType) {
      setError(t.invalidType);
    } else if (tooLarge) {
      setError(t.tooLarge);
    } else if (tooMany) {
      setError(t.tooMany);
    } else if (duplicate) {
      setError(t.duplicate);
    }
  }

  /* ==========================================
     SÉLECTION DEPUIS L'ORDINATEUR
     OU LE TÉLÉPHONE
  ========================================== */

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected = Array.from(
      event.currentTarget.files ?? []
    );

    addFiles(selected);

    // Permet de sélectionner à nouveau
    // le même fichier après sa suppression.
    event.currentTarget.value = "";
  }

  /* ==========================================
     SUPPRIMER UNE IMAGE
  ========================================== */

  function removeImage(index: number) {
    if (disabled) {
      return;
    }

    const nextFiles = files.filter(
      (_, fileIndex) => fileIndex !== index
    );

    onChange(nextFiles);

    clearMessages();
  }

  /* ==========================================
     GLISSER-DÉPOSER
  ========================================== */

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (!disabled && canAddMore) {
      event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    } else {
      event.dataTransfer.dropEffect = "none";
    }
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      event.currentTarget.contains(
        event.relatedTarget as Node | null
      )
    ) {
      return;
    }

    setDragActive(false);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDragActive(false);

    if (disabled || !canAddMore) {
      return;
    }

    const selected = Array.from(
      event.dataTransfer.files
    );

    addFiles(selected);
  }

  /* ==========================================
     CLAVIER
  ========================================== */

  function handlePickerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>
  ) {
    // Les boutons HTML prennent déjà
    // en charge Entrée et Espace.
    // Cette fonction permet simplement
    // de conserver un comportement clair.
    if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  }

  /* ==========================================
     INTERFACE
  ========================================== */

  return (
    <section
      aria-labelledby={titleId}
      className={[
        "w-full min-w-0",
        "rounded-2xl border border-gray-200",
        "bg-white p-3 shadow-sm",
        "sm:p-4 lg:p-5",
        className,
      ].join(" ")}
    >
      {/* ======================================
          TITRE ET COMPTEUR
      ====================================== */}

      <div className="mb-3 flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ImagePlus
            size={22}
            strokeWidth={2}
            className="shrink-0 text-[#101828]"
            aria-hidden="true"
          />

          <h2
            id={titleId}
            className="text-sm font-extrabold text-[#101828] sm:text-base"
          >
            {t.title} (1 à 10){" "}
            <span className="text-red-600">*</span>
          </h2>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-3 py-1",
            "text-xs font-extrabold",
            isFull
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-[#142138]",
          ].join(" ")}
        >
          {count} / {MAX_IMAGES}
        </span>
      </div>

      {/* ======================================
          INPUT FICHIER

          Caché visuellement, mais activé
          par les boutons d'ajout.
      ====================================== */}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={INPUT_ACCEPT}
        multiple
        onChange={handleFileChange}
        disabled={disabled || isFull}
        className="sr-only"
        aria-label={t.upload}
        tabIndex={-1}
      />

      {/* ======================================
          GRILLE DES IMAGES

          MOBILE :
          3 éléments par ligne

          TABLETTE :
          4 éléments par ligne

          PC :
          5 éléments par ligne

          Toujours en pleine largeur.
      ====================================== */}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "grid w-full min-w-0",
          "grid-cols-3 gap-2",
          "sm:grid-cols-4 sm:gap-3",
          "xl:grid-cols-5",
        ].join(" ")}
      >
        {/* ====================================
            ZONE PRINCIPALE D'AJOUT
        ==================================== */}

        {canAddMore && (
          <button
            type="button"
            onClick={openFilePicker}
            onKeyDown={handlePickerKeyDown}
            disabled={disabled}
            aria-describedby={descriptionId}
            className={[
              "group relative flex",
              "aspect-square min-w-0",
              "flex-col items-center",
              "justify-center gap-1.5",
              "overflow-hidden rounded-xl",
              "border-2 border-dashed",
              "p-2 text-center",
              "transition-all",
              "focus-visible:outline-2",
              "focus-visible:outline-offset-2",
              "focus-visible:outline-green-700",
              "disabled:cursor-not-allowed",
              "disabled:opacity-50",
              dragActive
                ? [
                    "border-green-700",
                    "bg-green-100",
                    "ring-2 ring-green-200",
                  ].join(" ")
                : [
                    "border-[#17b52a]",
                    "bg-[#f3fff2]",
                    "hover:border-green-700",
                    "hover:bg-green-50",
                  ].join(" "),
            ].join(" ")}
          >
            <CloudUpload
              size={30}
              strokeWidth={2}
              className="shrink-0 text-[#10a71f] sm:size-9"
              aria-hidden="true"
            />

            <span className="text-[10px] leading-tight font-extrabold text-[#063e1f] sm:text-xs">
              {t.upload}
            </span>

            <Plus
              size={17}
              strokeWidth={2.5}
              className="text-green-700"
              aria-hidden="true"
            />
          </button>
        )}

        {/* ====================================
            APERÇUS DES IMAGES
        ==================================== */}

        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${file.lastModified}`}
            className={[
              "group relative aspect-square",
              "min-w-0 overflow-hidden",
              "rounded-xl border",
              "border-gray-200 bg-gray-100",
              "shadow-sm",
            ].join(" ")}
          >
            {/* Image */}

            <EventImagePreview file={file} alt={`${t.preview} ${index + 1} : ${file.name}`} />

            {/* Dégradé inférieur */}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/60 to-transparent" />

            {/* Numéro de l'image */}

            <span className="absolute bottom-1.5 left-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {index + 1}
            </span>

            {/* Supprimer */}

            <button
              type="button"
              onClick={() => removeImage(index)}
              disabled={disabled}
              aria-label={`${t.remove} ${index + 1}`}
              title={t.remove}
              className={[
                "absolute top-1.5 right-1.5",
                "flex size-7 items-center",
                "justify-center rounded-full",
                "bg-white text-red-600",
                "shadow-md transition-colors",
                "hover:bg-red-50",
                "focus-visible:outline-2",
                "focus-visible:outline-red-600",
                "disabled:cursor-not-allowed",
                "disabled:opacity-50",
              ].join(" ")}
            >
              <X
                size={17}
                strokeWidth={2.8}
                aria-hidden="true"
              />
            </button>
          </div>
        ))}

        {/* ====================================
            BOUTON + SUPPLÉMENTAIRE

            Affiché après les aperçus,
            dès qu'une image existe.
        ==================================== */}

        {count > 0 && canAddMore && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled}
            aria-label={t.addMore}
            title={t.addMore}
            className={[
              "flex aspect-square min-w-0",
              "items-center justify-center",
              "rounded-xl",
              "border-2 border-dashed",
              "border-[#b7c5d5]",
              "bg-white text-[#142138]",
              "transition-colors",
              "hover:border-green-600",
              "hover:bg-green-50",
              "focus-visible:outline-2",
              "focus-visible:outline-green-700",
              "disabled:opacity-50",
            ].join(" ")}
          >
            <Plus
              size={30}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* ======================================
          INFORMATIONS COURTES
      ====================================== */}

      <div
        id={descriptionId}
        className="mt-3 flex flex-wrap items-center justify-between gap-2"
      >
        <span className="text-[11px] font-medium text-gray-500 sm:text-xs">
          {t.limit}
        </span>

        {count > 0 && (
          <span className="text-[11px] font-bold text-green-800 sm:text-xs">
            {count} / {MAX_IMAGES} {t.count}
          </span>
        )}
      </div>

      {/* ======================================
          MESSAGE D'ERREUR
      ====================================== */}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 sm:text-sm"
        >
          <AlertCircle
            size={18}
            className="shrink-0"
            aria-hidden="true"
          />

          <span>{error}</span>
        </div>
      )}

      {/* ======================================
          CONFIRMATION VISUELLE
      ====================================== */}

      {showSuccess && !error && count > 0 && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 text-xs font-semibold text-green-700"
        >
          <CheckCircle2
            size={17}
            aria-hidden="true"
          />

          <span>
            {t.selected} : {count}
          </span>
        </div>
      )}

      {/* ======================================
          INFORMATIONS DES FICHIERS

          Accessibles sans surcharger
          le visuel principal.
      ====================================== */}

      {count > 0 && (
        <div className="sr-only">
          <ul>
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
              >
                {file.name} —{" "}
                {formatFileSize(file.size)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
