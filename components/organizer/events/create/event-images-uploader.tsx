"use client";

import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Images,
  LoaderCircle,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export const EVENT_IMAGE_MAXIMUM_FILES = 5;
export const EVENT_IMAGE_MAXIMUM_SIZE_BYTES =
  5 * 1024 * 1024;

export const EVENT_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type EventImageAllowedMimeType =
  (typeof EVENT_IMAGE_ALLOWED_MIME_TYPES)[number];

export type SelectedEventImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export type EventImagesSelection = {
  images: SelectedEventImage[];
  coverIndex: number;
};

type EventImagesUploaderProps = {
  value?: SelectedEventImage[];
  coverIndex?: number;
  disabled?: boolean;
  isUploading?: boolean;
  error?: string;
  onChange: (selection: EventImagesSelection) => void;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 Ko";
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024).toLocaleString(
      "fr-FR",
    )} Ko`;
  }

  return `${(size / (1024 * 1024)).toLocaleString(
    "fr-FR",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )} Mo`;
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is EventImageAllowedMimeType {
  return EVENT_IMAGE_ALLOWED_MIME_TYPES.includes(
    mimeType as EventImageAllowedMimeType,
  );
}

function validateFile(file: File): string | null {
  if (!file.name.trim()) {
    return "Une image sélectionnée ne possède pas de nom valide.";
  }

  if (file.size <= 0) {
    return `L’image « ${file.name} » est vide.`;
  }

  if (file.size > EVENT_IMAGE_MAXIMUM_SIZE_BYTES) {
    return `L’image « ${file.name} » dépasse la taille maximale de 5 Mo.`;
  }

  if (!isAllowedMimeType(file.type)) {
    return `Le format de l’image « ${file.name} » n’est pas accepté. Utilisez JPG, PNG ou WebP.`;
  }

  return null;
}

function createSelectedImage(
  file: File,
): SelectedEventImage {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function EventImagesUploader({
  value = [],
  coverIndex = 0,
  disabled = false,
  isUploading = false,
  error,
  onChange,
}: EventImagesUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] =
    useState<SelectedEventImage[]>(value);

  const [selectedCoverIndex, setSelectedCoverIndex] =
    useState(
      value.length === 0
        ? 0
        : Math.min(
            Math.max(coverIndex, 0),
            value.length - 1,
          ),
    );

  const [isDragging, setIsDragging] =
    useState(false);

  const [localError, setLocalError] =
    useState("");

  useEffect(() => {
    setImages(value);

    setSelectedCoverIndex(
      value.length === 0
        ? 0
        : Math.min(
            Math.max(coverIndex, 0),
            value.length - 1,
          ),
    );
  }, [value, coverIndex]);

  /*
   * Les URL créées avec URL.createObjectURL doivent être
   * libérées lorsque le composant est démonté.
   */
  useEffect(() => {
    return () => {
      images.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, [images]);

  function emitChange(
    nextImages: SelectedEventImage[],
    nextCoverIndex: number,
  ) {
    const safeCoverIndex =
      nextImages.length === 0
        ? 0
        : Math.min(
            Math.max(nextCoverIndex, 0),
            nextImages.length - 1,
          );

    setImages(nextImages);
    setSelectedCoverIndex(safeCoverIndex);

    onChange({
      images: nextImages,
      coverIndex: safeCoverIndex,
    });
  }

  function addFiles(files: File[]) {
    if (disabled || isUploading) {
      return;
    }

    setLocalError("");

    if (files.length === 0) {
      return;
    }

    const remainingPlaces =
      EVENT_IMAGE_MAXIMUM_FILES - images.length;

    if (remainingPlaces <= 0) {
      setLocalError(
        `Vous pouvez ajouter au maximum ${EVENT_IMAGE_MAXIMUM_FILES} images.`,
      );
      return;
    }

    if (files.length > remainingPlaces) {
      setLocalError(
        `Vous pouvez encore ajouter ${remainingPlaces} image${
          remainingPlaces > 1 ? "s" : ""
        }.`,
      );
      return;
    }

    const validatedFiles: File[] = [];

    for (const file of files) {
      const validationError = validateFile(file);

      if (validationError) {
        setLocalError(validationError);
        return;
      }

      /*
       * Empêche d’ajouter deux fois exactement le même fichier.
       */
      const duplicate = images.some(
        (image) =>
          image.file.name === file.name &&
          image.file.size === file.size &&
          image.file.lastModified ===
            file.lastModified,
      );

      if (duplicate) {
        setLocalError(
          `L’image « ${file.name} » a déjà été ajoutée.`,
        );
        return;
      }

      validatedFiles.push(file);
    }

    const createdImages = validatedFiles.map(
      createSelectedImage,
    );

    const nextImages = [
      ...images,
      ...createdImages,
    ];

    emitChange(
      nextImages,
      images.length === 0
        ? 0
        : selectedCoverIndex,
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    addFiles(files);
  }

  function handleDragEnter(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && !isUploading) {
      event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    }
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    if (disabled || isUploading) {
      return;
    }

    const files = Array.from(
      event.dataTransfer.files ?? [],
    );

    addFiles(files);
  }

  function removeImage(imageId: string) {
    if (disabled || isUploading) {
      return;
    }

    setLocalError("");

    const imageIndex = images.findIndex(
      (image) => image.id === imageId,
    );

    if (imageIndex === -1) {
      return;
    }

    const removedImage = images[imageIndex];

    URL.revokeObjectURL(
      removedImage.previewUrl,
    );

    const nextImages = images.filter(
      (image) => image.id !== imageId,
    );

    let nextCoverIndex = selectedCoverIndex;

    if (nextImages.length === 0) {
      nextCoverIndex = 0;
    } else if (
      imageIndex === selectedCoverIndex
    ) {
      nextCoverIndex = 0;
    } else if (
      imageIndex < selectedCoverIndex
    ) {
      nextCoverIndex =
        selectedCoverIndex - 1;
    }

    emitChange(
      nextImages,
      nextCoverIndex,
    );
  }

  function selectCover(index: number) {
    if (
      disabled ||
      isUploading ||
      index < 0 ||
      index >= images.length
    ) {
      return;
    }

    setLocalError("");
    emitChange(images, index);
  }

  function openFilePicker() {
    if (
      disabled ||
      isUploading ||
      images.length >=
        EVENT_IMAGE_MAXIMUM_FILES
    ) {
      return;
    }

    fileInputRef.current?.click();
  }

  const displayedError =
    localError || error || "";

  const remainingImages =
    EVENT_IMAGE_MAXIMUM_FILES -
    images.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050b0f]">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
            <Images className="h-[18px] w-[18px] text-lime-400" />
          </div>

          <div>
            <h3 className="text-sm font-black text-white">
              Images de l’événement
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Ajoutez jusqu’à 5 images en JPG,
              PNG ou WebP.
            </p>
          </div>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5">
          <span className="text-xs font-bold text-white">
            {images.length}
          </span>

          <span className="text-xs text-neutral-600">
            / {EVENT_IMAGE_MAXIMUM_FILES}
          </span>
        </div>
      </header>

      <div className="p-4">
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={EVENT_IMAGE_ALLOWED_MIME_TYPES.join(
            ",",
          )}
          multiple
          disabled={
            disabled ||
            isUploading ||
            images.length >=
              EVENT_IMAGE_MAXIMUM_FILES
          }
          onChange={handleInputChange}
          className="sr-only"
        />

        {images.length <
          EVENT_IMAGE_MAXIMUM_FILES && (
          <div
            role="button"
            tabIndex={
              disabled || isUploading
                ? -1
                : 0
            }
            onClick={openFilePicker}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                openFilePicker();
              }
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center outline-none transition ${
              isDragging
                ? "border-lime-400/70 bg-emerald-500/10"
                : "border-white/[0.12] bg-white/[0.018] hover:border-emerald-500/45 hover:bg-emerald-500/[0.035]"
            } ${
              disabled || isUploading
                ? "cursor-not-allowed opacity-60"
                : ""
            }`}
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
                isDragging
                  ? "border-lime-400/40 bg-lime-400/15"
                  : "border-emerald-500/25 bg-emerald-500/10 group-hover:bg-emerald-500/15"
              }`}
            >
              {isUploading ? (
                <LoaderCircle className="h-6 w-6 animate-spin text-lime-400" />
              ) : (
                <UploadCloud className="h-6 w-6 text-lime-400" />
              )}
            </div>

            <p className="mt-4 text-sm font-black text-white">
              {isUploading
                ? "Téléversement en cours..."
                : isDragging
                  ? "Déposez les images ici"
                  : "Choisir les images"}
            </p>

            <p className="mt-2 max-w-[430px] text-xs leading-5 text-neutral-500">
              Glissez-déposez vos images ou
              sélectionnez-les depuis votre
              appareil.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <RuleBadge text="JPG" />
              <RuleBadge text="PNG" />
              <RuleBadge text="WebP" />
              <RuleBadge text="5 Mo maximum" />
            </div>

            <p className="mt-4 text-[11px] text-neutral-600">
              {remainingImages} image
              {remainingImages > 1 ? "s" : ""}{" "}
              restante
              {remainingImages > 1 ? "s" : ""}
            </p>
          </div>
        )}

        {displayedError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3.5 py-3 text-xs leading-5 text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{displayedError}</span>
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-neutral-300">
                  Images sélectionnées
                </p>

                <p className="mt-1 text-[11px] text-neutral-600">
                  Choisissez l’image principale
                  affichée sur Tikemia.
                </p>
              </div>

              <div className="hidden items-center gap-1.5 text-[11px] text-neutral-600 sm:flex">
                <Star className="h-3.5 w-3.5 text-lime-400" />
                Image principale
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {images.map((image, index) => {
                const isCover =
                  index === selectedCoverIndex;

                return (
                  <article
                    key={image.id}
                    className={`group overflow-hidden rounded-2xl border transition ${
                      isCover
                        ? "border-lime-400/50 bg-emerald-500/[0.06] shadow-[0_12px_35px_rgba(132,204,22,0.08)]"
                        : "border-white/[0.08] bg-white/[0.02]"
                    }`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.previewUrl}
                        alt={`Aperçu ${index + 1}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                      />

                      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
                        <span className="rounded-lg border border-black/20 bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                          Image {index + 1}
                        </span>

                        <button
                          type="button"
                          disabled={
                            disabled ||
                            isUploading
                          }
                          onClick={() =>
                            removeImage(image.id)
                          }
                          aria-label={`Supprimer ${image.file.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/65 text-white backdrop-blur-md transition hover:border-red-500/50 hover:bg-red-500/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {isCover && (
                        <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg border border-lime-400/30 bg-[#071014]/90 px-2.5 py-1.5 text-[10px] font-black text-lime-400 backdrop-blur-md">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          Image principale
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <p
                        title={image.file.name}
                        className="truncate text-xs font-bold text-white"
                      >
                        {image.file.name}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase text-neutral-600">
                          {image.file.type.replace(
                            "image/",
                            "",
                          )}
                        </span>

                        <span className="text-[10px] text-neutral-600">
                          {formatFileSize(
                            image.file.size,
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          isCover ||
                          disabled ||
                          isUploading
                        }
                        onClick={() =>
                          selectCover(index)
                        }
                        className={`mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border text-[11px] font-bold transition ${
                          isCover
                            ? "cursor-default border-emerald-500/25 bg-emerald-500/10 text-lime-400"
                            : "border-white/[0.08] bg-white/[0.025] text-neutral-400 hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] hover:text-lime-400"
                        }`}
                      >
                        {isCover ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Image principale
                          </>
                        ) : (
                          <>
                            <Star className="h-3.5 w-3.5" />
                            Définir comme principale
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {images.length <
              EVENT_IMAGE_MAXIMUM_FILES && (
              <button
                type="button"
                disabled={
                  disabled || isUploading
                }
                onClick={openFilePicker}
                className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] hover:text-lime-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" />
                Ajouter d’autres images
              </button>
            )}
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.035] px-3.5 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

            <p className="text-[11px] leading-5 text-neutral-500">
              Les images seront téléversées lors
              de l’enregistrement de l’événement.
              La première image ou celle marquée
              comme principale sera utilisée comme
              couverture.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function RuleBadge({
  text,
}: {
  text: string;
}) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
      {text}
    </span>
  );
}