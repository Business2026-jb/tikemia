import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createEventImageStoragePath,
  EVENT_IMAGE_UPLOAD_RULES,
  getPublicEventImageUrl,
  removeEventImagesFromStorage,
  SUPABASE_EVENT_IMAGES_BUCKET,
  supabaseAdmin,
  type AllowedEventImageExtension,
  type AllowedEventImageMimeType,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type UploadedEventImage = {
  path: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
  originalName: string;
  mimeType: AllowedEventImageMimeType;
  size: number;
};

type UploadEventImagesResponse = {
  success: boolean;
  message: string;
  code?: string;
  uploadBatchId?: string;
  images?: UploadedEventImage[];
  limits?: {
    maximumFiles: number;
    maximumFileSizeBytes: number;
    allowedMimeTypes: readonly AllowedEventImageMimeType[];
  };
};

type AuthenticatedOrganizer = {
  id: string;
};

const SESSION_COOKIE_FALLBACK_NAME = "tikemia_session";

const MIME_TYPE_EXTENSIONS: Record<
  AllowedEventImageMimeType,
  AllowedEventImageExtension
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function jsonResponse(
  body: UploadEventImagesResponse,
  status: number,
): NextResponse<UploadEventImagesResponse> {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[EVENT_IMAGES_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error ? error.message : error,
        );
      });

    return null;
  }

  if (
    session.user.role !== "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function normalizeCoverIndex(
  value: FormDataEntryValue | null,
  numberOfImages: number,
): number {
  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0 ||
    parsedValue >= numberOfImages
  ) {
    return 0;
  }

  return parsedValue;
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is AllowedEventImageMimeType {
  return EVENT_IMAGE_UPLOAD_RULES.allowedMimeTypes.includes(
    mimeType as AllowedEventImageMimeType,
  );
}

function getExtensionFromMimeType(
  mimeType: AllowedEventImageMimeType,
): AllowedEventImageExtension {
  return MIME_TYPE_EXTENSIONS[mimeType];
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function hasPngSignature(bytes: Uint8Array): boolean {
  const signature = [
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ];

  return (
    bytes.length >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {
    return false;
  }

  const riff =
    String.fromCharCode(
      bytes[0],
      bytes[1],
      bytes[2],
      bytes[3],
    ) === "RIFF";

  const webp =
    String.fromCharCode(
      bytes[8],
      bytes[9],
      bytes[10],
      bytes[11],
    ) === "WEBP";

  return riff && webp;
}

function fileSignatureMatchesMimeType(
  bytes: Uint8Array,
  mimeType: AllowedEventImageMimeType,
): boolean {
  if (mimeType === "image/jpeg") {
    return hasJpegSignature(bytes);
  }

  if (mimeType === "image/png") {
    return hasPngSignature(bytes);
  }

  return hasWebpSignature(bytes);
}

function validateFileMetadata(
  file: File,
  position: number,
): string | null {
  if (!file.name.trim()) {
    return `L’image ${position + 1} ne possède pas de nom valide.`;
  }

  if (file.size <= 0) {
    return `L’image « ${file.name} » est vide.`;
  }

  if (
    file.size >
    EVENT_IMAGE_UPLOAD_RULES.maximumFileSizeBytes
  ) {
    return `L’image « ${file.name} » dépasse la taille maximale de 5 Mo.`;
  }

  if (!isAllowedMimeType(file.type)) {
    return `Le format de l’image « ${file.name} » n’est pas accepté. Utilisez JPG, PNG ou WebP.`;
  }

  return null;
}

async function validateFileContent(
  file: File,
): Promise<{
  arrayBuffer: ArrayBuffer;
  mimeType: AllowedEventImageMimeType;
  extension: AllowedEventImageExtension;
}> {
  if (!isAllowedMimeType(file.type)) {
    throw new Error(
      `Le type du fichier « ${file.name} » n’est pas autorisé.`,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!fileSignatureMatchesMimeType(bytes, file.type)) {
    throw new Error(
      `Le contenu du fichier « ${file.name} » ne correspond pas à une image ${file.type.replace(
        "image/",
        "",
      )} valide.`,
    );
  }

  return {
    arrayBuffer,
    mimeType: file.type,
    extension: getExtensionFromMimeType(file.type),
  };
}

export async function POST(
  request: Request,
): Promise<NextResponse<UploadEventImagesResponse>> {
  const uploadedPaths: string[] = [];

  try {
    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return jsonResponse(
        {
          success: false,
          code: "UNSUPPORTED_CONTENT_TYPE",
          message:
            "Les images doivent être envoyées avec un formulaire multipart.",
        },
        415,
      );
    }

    const organizer = await getAuthenticatedOrganizer();

    if (!organizer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Votre session est absente, invalide ou expirée.",
        },
        401,
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_FORM_DATA",
          message:
            "Les fichiers envoyés n’ont pas pu être lus.",
        },
        400,
      );
    }

    const imageEntries = formData.getAll("images");
    const files = imageEntries.filter(isFile);

    if (files.length === 0) {
      return jsonResponse(
        {
          success: false,
          code: "NO_IMAGES",
          message:
            "Sélectionnez au moins une image pour l’événement.",
        },
        400,
      );
    }

    if (files.length !== imageEntries.length) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_IMAGE_ENTRY",
          message:
            "Un ou plusieurs éléments envoyés ne sont pas des fichiers.",
        },
        400,
      );
    }

    if (
      files.length >
      EVENT_IMAGE_UPLOAD_RULES.maximumFiles
    ) {
      return jsonResponse(
        {
          success: false,
          code: "TOO_MANY_IMAGES",
          message: `Vous pouvez téléverser au maximum ${EVENT_IMAGE_UPLOAD_RULES.maximumFiles} images.`,
        },
        400,
      );
    }

    for (const [position, file] of files.entries()) {
      const validationError = validateFileMetadata(
        file,
        position,
      );

      if (validationError) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_IMAGE",
            message: validationError,
          },
          400,
        );
      }
    }

    const uploadBatchId = crypto.randomUUID();
    const coverIndex = normalizeCoverIndex(
      formData.get("coverIndex"),
      files.length,
    );

    const uploadedImages: UploadedEventImage[] = [];

    /*
     * Les images sont envoyées successivement afin de permettre
     * un nettoyage précis si l’une d’elles échoue.
     */
    for (const [position, file] of files.entries()) {
      const {
        arrayBuffer,
        mimeType,
        extension,
      } = await validateFileContent(file);

      const path = createEventImageStoragePath({
        organizerId: organizer.id,
        uploadBatchId,
        position,
        extension,
      });

      const { error: uploadError } =
        await supabaseAdmin.storage
          .from(SUPABASE_EVENT_IMAGES_BUCKET)
          .upload(path, arrayBuffer, {
            contentType: mimeType,
            cacheControl: "31536000",
            upsert: false,
          });

      if (uploadError) {
        console.error(
          "[EVENT_IMAGE_UPLOAD_STORAGE_ERROR]",
          {
            filename: file.name,
            position,
            message: uploadError.message,
          },
        );

        throw new Error(
          `L’image « ${file.name} » n’a pas pu être téléversée.`,
        );
      }

      uploadedPaths.push(path);

      const publicUrl = getPublicEventImageUrl(path);

      uploadedImages.push({
        path,
        publicUrl,
        position,
        isCover: position === coverIndex,
        originalName: file.name,
        mimeType,
        size: file.size,
      });
    }

    return jsonResponse(
      {
        success: true,
        message:
          uploadedImages.length > 1
            ? `${uploadedImages.length} images ont été téléversées avec succès.`
            : "L’image a été téléversée avec succès.",
        uploadBatchId,
        images: uploadedImages,
        limits: {
          maximumFiles:
            EVENT_IMAGE_UPLOAD_RULES.maximumFiles,
          maximumFileSizeBytes:
            EVENT_IMAGE_UPLOAD_RULES.maximumFileSizeBytes,
          allowedMimeTypes:
            EVENT_IMAGE_UPLOAD_RULES.allowedMimeTypes,
        },
      },
      201,
    );
  } catch (error) {
    /*
     * En cas d’échec après un ou plusieurs uploads,
     * toutes les images de cette tentative sont supprimées.
     */
    if (uploadedPaths.length > 0) {
      await removeEventImagesFromStorage(uploadedPaths).catch(
        (cleanupError: unknown) => {
          console.error(
            "[EVENT_IMAGES_UPLOAD_ROLLBACK_ERROR]",
            cleanupError instanceof Error
              ? cleanupError.message
              : cleanupError,
          );
        },
      );
    }

    console.error(
      "[ORGANIZER_EVENT_IMAGES_ROUTE_ERROR]",
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        success: false,
        code: "IMAGE_UPLOAD_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de téléverser les images pour le moment.",
      },
      500,
    );
  }
}