"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImageIcon,
  LoaderCircle,
  RefreshCcw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type AvatarUploaderProps = {
  initialAvatar: string | null;
  initials: string;
  displayName: string;
  disabled?: boolean;

  onAvatarChange?: (
    avatar: string | null,
    avatarPath: string | null,
  ) => void;
};

type AvatarApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  warning?: string;

  data?: {
    avatar: string | null;
    avatarPath: string | null;
  };
};

const MAXIMUM_AVATAR_SIZE_BYTES =
  5 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AllowedAvatarType =
  (typeof ALLOWED_AVATAR_TYPES)[number];

function isAllowedAvatarType(
  value: string,
): value is AllowedAvatarType {
  return ALLOWED_AVATAR_TYPES.includes(
    value as AllowedAvatarType,
  );
}

function formatFileSize(
  value: number,
): string {
  if (value < 1024 * 1024) {
    return `${Math.ceil(
      value / 1024,
    ).toLocaleString("fr-FR")} Ko`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} Mo`;
}

function validateAvatarFile(
  file: File,
): string | null {
  if (!file.name.trim()) {
    return "Le fichier sélectionné ne possède pas de nom valide.";
  }

  if (file.size <= 0) {
    return "La photo sélectionnée est vide.";
  }

  if (
    file.size >
    MAXIMUM_AVATAR_SIZE_BYTES
  ) {
    return "La photo de profil dépasse la taille maximale de 5 Mo.";
  }

  if (
    !isAllowedAvatarType(
      file.type,
    )
  ) {
    return "Le format de la photo n’est pas accepté. Utilisez JPG, PNG ou WebP.";
  }

  return null;
}

function getSafeInitials(
  value: string,
): string {
  const normalizedValue =
    value
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 2)
      .toUpperCase();

  return normalizedValue || "OR";
}

export default function AvatarUploader({
  initialAvatar,
  initials,
  displayName,
  disabled = false,
  onAvatarChange,
}: AvatarUploaderProps) {
  const inputId = useId();

  const inputRef =
    useRef<HTMLInputElement>(null);

  const previewObjectUrlRef =
    useRef<string | null>(null);

  const [avatar, setAvatar] =
    useState<string | null>(
      initialAvatar,
    );

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(
      initialAvatar,
    );

  const [isDragging, setIsDragging] =
    useState(false);

  const [isUploading, setIsUploading] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [warningMessage, setWarningMessage] =
    useState("");

  const isBusy =
    isUploading || isDeleting;

  useEffect(() => {
    setAvatar(initialAvatar);

    if (!selectedFile) {
      setPreviewUrl(initialAvatar);
    }
  }, [
    initialAvatar,
    selectedFile,
  ]);

  useEffect(() => {
    return () => {
      if (
        previewObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          previewObjectUrlRef.current,
        );
      }
    };
  }, []);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
    setWarningMessage("");
  }

  function revokeCurrentPreview() {
    if (
      previewObjectUrlRef.current
    ) {
      URL.revokeObjectURL(
        previewObjectUrlRef.current,
      );

      previewObjectUrlRef.current =
        null;
    }
  }

  function resetSelectedFile() {
    revokeCurrentPreview();

    setSelectedFile(null);
    setPreviewUrl(avatar);

    if (inputRef.current) {
      inputRef.current.value =
        "";
    }
  }

  function selectFile(
    file: File,
  ) {
    if (
      disabled ||
      isBusy
    ) {
      return;
    }

    clearMessages();

    const validationError =
      validateAvatarFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    revokeCurrentPreview();

    const objectUrl =
      URL.createObjectURL(file);

    previewObjectUrlRef.current =
      objectUrl;

    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    selectFile(file);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setIsDragging(false);

    if (
      disabled ||
      isBusy
    ) {
      return;
    }

    const file =
      event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    selectFile(file);
  }

  async function uploadAvatar() {
    if (
      !selectedFile ||
      disabled ||
      isBusy
    ) {
      return;
    }

    clearMessages();
    setIsUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "avatar",
        selectedFile,
        selectedFile.name,
      );

      const response =
        await fetch(
          "/api/organizer/profile/avatar",
          {
            method: "POST",
            body: formData,
            headers: {
              Accept:
                "application/json",
            },
          },
        );

      let result: AvatarApiResponse =
        {};

      try {
        result =
          (await response.json()) as AvatarApiResponse;
      } catch {
        result = {};
      }

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "La photo de profil n’a pas pu être enregistrée.",
        );
      }

      revokeCurrentPreview();

      setAvatar(
        result.data.avatar,
      );

      setPreviewUrl(
        result.data.avatar,
      );

      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value =
          "";
      }

      setSuccessMessage(
        result.message ??
          "Votre photo de profil a été mise à jour.",
      );

      if (result.warning) {
        setWarningMessage(
          result.warning,
        );
      }

      onAvatarChange?.(
        result.data.avatar,
        result.data.avatarPath,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "La photo de profil n’a pas pu être enregistrée.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteAvatar() {
    if (
      disabled ||
      isBusy ||
      (!avatar &&
        !selectedFile)
    ) {
      return;
    }

    clearMessages();

    if (selectedFile) {
      resetSelectedFile();

      if (!avatar) {
        setSuccessMessage(
          "La photo sélectionnée a été retirée.",
        );
      }

      return;
    }

    setIsDeleting(true);

    try {
      const response =
        await fetch(
          "/api/organizer/profile/avatar",
          {
            method: "DELETE",
            headers: {
              Accept:
                "application/json",
            },
          },
        );

      let result: AvatarApiResponse =
        {};

      try {
        result =
          (await response.json()) as AvatarApiResponse;
      } catch {
        result = {};
      }

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "La photo de profil n’a pas pu être supprimée.",
        );
      }

      revokeCurrentPreview();

      setAvatar(null);
      setPreviewUrl(null);
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value =
          "";
      }

      setSuccessMessage(
        result.message ??
          "Votre photo de profil a été supprimée.",
      );

      if (result.warning) {
        setWarningMessage(
          result.warning,
        );
      }

      onAvatarChange?.(
        null,
        null,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "La photo de profil n’a pas pu être supprimée.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function openFileDialog() {
    if (
      disabled ||
      isBusy
    ) {
      return;
    }

    inputRef.current?.click();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <header className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
            <Camera className="h-[18px] w-[18px] text-lime-400" />
          </div>

          <div>
            <h2 className="text-base font-black text-white">
              Photo de profil
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Ajoutez une photo claire pour
              personnaliser votre espace
              organisateur.
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ALLOWED_AVATAR_TYPES.join(
            ",",
          )}
          disabled={
            disabled ||
            isBusy
          }
          onChange={
            handleInputChange
          }
          className="sr-only"
        />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="relative mx-auto shrink-0 lg:mx-0">
            <div className="relative h-36 w-36 overflow-hidden rounded-3xl border border-white/[0.1] bg-[#050b0f] shadow-[0_18px_45px_rgba(0,0,0,0.35)] sm:h-40 sm:w-40">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`Photo de profil de ${displayName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 via-lime-500/10 to-orange-500/20">
                  <span className="text-4xl font-black tracking-[-0.05em] text-white">
                    {getSafeInitials(
                      initials,
                    )}
                  </span>
                </div>
              )}

              {isBusy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                  <LoaderCircle className="h-7 w-7 animate-spin text-lime-400" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={
                openFileDialog
              }
              disabled={
                disabled ||
                isBusy
              }
              aria-label="Choisir une photo de profil"
              className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500 text-white shadow-[0_12px_30px_rgba(34,197,94,0.3)] transition hover:scale-105 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div
              role="button"
              tabIndex={
                disabled ||
                isBusy
                  ? -1
                  : 0
              }
              onClick={
                openFileDialog
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" ||
                  event.key ===
                    " "
                ) {
                  event.preventDefault();
                  openFileDialog();
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();

                if (
                  !disabled &&
                  !isBusy
                ) {
                  setIsDragging(
                    true,
                  );
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();

                if (
                  !disabled &&
                  !isBusy
                ) {
                  event.dataTransfer.dropEffect =
                    "copy";

                  setIsDragging(
                    true,
                  );
                }
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-6 text-center transition ${
                isDragging
                  ? "border-lime-400/60 bg-emerald-500/10"
                  : "border-white/[0.12] bg-white/[0.018] hover:border-emerald-500/40 hover:bg-emerald-500/[0.025]"
              } ${
                disabled ||
                isBusy
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              {previewUrl ? (
                <RefreshCcw className="h-6 w-6 text-lime-400" />
              ) : (
                <UploadCloud className="h-6 w-6 text-lime-400" />
              )}

              <p className="mt-3 text-sm font-black text-white">
                {previewUrl
                  ? "Remplacer la photo"
                  : "Ajouter une photo"}
              </p>

              <p className="mt-1 max-w-[430px] text-xs leading-5 text-neutral-500">
                Cliquez ici ou déposez une
                image. Formats acceptés :
                JPG, PNG et WebP.
              </p>

              <p className="mt-2 text-[11px] font-semibold text-neutral-600">
                Taille maximale : 5 Mo
              </p>
            </div>

            {selectedFile && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <ImageIcon className="h-4 w-4 text-lime-400" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">
                      {selectedFile.name}
                    </p>

                    <p className="mt-1 text-[10px] text-neutral-500">
                      {formatFileSize(
                        selectedFile.size,
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    resetSelectedFile
                  }
                  disabled={isBusy}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-bold text-neutral-400 transition hover:text-white disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-xs leading-5 text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-xs leading-5 text-emerald-200"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
            <span>
              {successMessage}
            </span>
          </div>
        )}

        {warningMessage && (
          <div
            role="status"
            className="mt-4 flex items-start gap-3 rounded-xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3 text-xs leading-5 text-orange-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {warningMessage}
            </span>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-end">
          {(avatar ||
            selectedFile) && (
            <button
              type="button"
              onClick={() => {
                void deleteAvatar();
              }}
              disabled={
                disabled ||
                isBusy
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 text-sm font-bold text-red-300 transition hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              {selectedFile
                ? "Retirer la sélection"
                : "Supprimer la photo"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void uploadAvatar();
            }}
            disabled={
              disabled ||
              isBusy ||
              !selectedFile
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}

            {isUploading
              ? "Téléversement..."
              : "Enregistrer la photo"}
          </button>
        </div>
      </div>
    </section>
  );
}