import {
  createHash,
  randomUUID,
} from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  sanitizeStorageSegment,
  supabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const ORGANIZER_AVATARS_BUCKET =
  process.env
    .SUPABASE_ORGANIZER_AVATARS_BUCKET
    ?.trim() ||
  "organizer-avatars";

const MAXIMUM_AVATAR_SIZE_BYTES =
  5 * 1024 * 1024;

const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AllowedAvatarMimeType =
  (typeof ALLOWED_AVATAR_MIME_TYPES)[number];

type AllowedAvatarExtension =
  | "jpg"
  | "png"
  | "webp";

type AuthenticatedOrganizer = {
  id: string;
};

type AvatarApiResponse = {
  success: boolean;
  message: string;
  code?: string;
  warning?: string;

  data?: {
    avatar: string | null;
    avatarPath: string | null;
  };
};

function jsonResponse(
  body: AvatarApiResponse,
  status: number,
): NextResponse<AvatarApiResponse> {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "no-store, max-age=0, must-revalidate",

      Pragma: "no-cache",
      Expires: "0",

      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer | null> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
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

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(
        (error: unknown) => {
          console.error(
            "[AVATAR_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    return null;
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

function isFile(
  value: FormDataEntryValue | null,
): value is File {
  return (
    typeof File !== "undefined" &&
    value instanceof File
  );
}

function isAllowedAvatarMimeType(
  value: string,
): value is AllowedAvatarMimeType {
  return ALLOWED_AVATAR_MIME_TYPES.includes(
    value as AllowedAvatarMimeType,
  );
}

function getAvatarExtension(
  mimeType: AllowedAvatarMimeType,
): AllowedAvatarExtension {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  return "webp";
}

function hasJpegSignature(
  bytes: Uint8Array,
): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function hasPngSignature(
  bytes: Uint8Array,
): boolean {
  const signature = [
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ];

  return (
    bytes.length >=
      signature.length &&
    signature.every(
      (value, index) =>
        bytes[index] === value,
    )
  );
}

function hasWebpSignature(
  bytes: Uint8Array,
): boolean {
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
  mimeType: AllowedAvatarMimeType,
): boolean {
  if (mimeType === "image/jpeg") {
    return hasJpegSignature(bytes);
  }

  if (mimeType === "image/png") {
    return hasPngSignature(bytes);
  }

  return hasWebpSignature(bytes);
}

function validateAvatarMetadata(
  file: File,
): string | null {
  if (!file.name.trim()) {
    return "Le fichier sélectionné ne possède pas de nom valide.";
  }

  if (file.size <= 0) {
    return "L’image sélectionnée est vide.";
  }

  if (
    file.size >
    MAXIMUM_AVATAR_SIZE_BYTES
  ) {
    return "La photo de profil dépasse la taille maximale de 5 Mo.";
  }

  if (
    !isAllowedAvatarMimeType(
      file.type,
    )
  ) {
    return "Le format de la photo n’est pas accepté. Utilisez JPG, PNG ou WebP.";
  }

  return null;
}

function createAvatarStoragePath({
  organizerId,
  extension,
}: {
  organizerId: string;
  extension: AllowedAvatarExtension;
}): string {
  const safeOrganizerId =
    sanitizeStorageSegment(
      organizerId,
    );

  if (!safeOrganizerId) {
    throw new Error(
      "L’identifiant de l’organisateur est invalide.",
    );
  }

  const filename =
    randomUUID().replaceAll(
      "-",
      "",
    );

  return [
    "organizers",
    safeOrganizerId,
    "avatar",
    `${filename}.${extension}`,
  ].join("/");
}

function getPublicAvatarUrl(
  path: string,
): string {
  const normalizedPath =
    path.trim().replace(/^\/+/, "");

  if (!normalizedPath) {
    throw new Error(
      "Le chemin de la photo de profil est invalide.",
    );
  }

  const { data } =
    supabaseAdmin.storage
      .from(
        ORGANIZER_AVATARS_BUCKET,
      )
      .getPublicUrl(
        normalizedPath,
      );

  if (!data.publicUrl) {
    throw new Error(
      "Impossible de générer l’adresse publique de la photo.",
    );
  }

  return data.publicUrl;
}

async function removeAvatarFromStorage(
  path: string | null | undefined,
): Promise<void> {
  const normalizedPath =
    path?.trim().replace(/^\/+/, "");

  if (!normalizedPath) {
    return;
  }

  const { error } =
    await supabaseAdmin.storage
      .from(
        ORGANIZER_AVATARS_BUCKET,
      )
      .remove([
        normalizedPath,
      ]);

  if (error) {
    throw new Error(
      error.message ||
        "Impossible de supprimer l’ancienne photo.",
    );
  }
}

/**
 * POST /api/organizer/profile/avatar
 *
 * Téléverse ou remplace la photo de profil.
 *
 * FormData attendu :
 * avatar: File
 */
export async function POST(
  request: Request,
): Promise<
  NextResponse<AvatarApiResponse>
> {
  let newAvatarPath:
    | string
    | null = null;

  try {
    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (
      !contentType.includes(
        "multipart/form-data",
      )
    ) {
      return jsonResponse(
        {
          success: false,

          code:
            "UNSUPPORTED_CONTENT_TYPE",

          message:
            "La photo doit être envoyée avec un formulaire multipart.",
        },
        415,
      );
    }

    const organizer =
      await getAuthenticatedOrganizer();

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
      formData =
        await request.formData();
    } catch {
      return jsonResponse(
        {
          success: false,

          code:
            "INVALID_FORM_DATA",

          message:
            "La photo envoyée n’a pas pu être lue.",
        },
        400,
      );
    }

    const avatarEntry =
      formData.get("avatar");

    if (!isFile(avatarEntry)) {
      return jsonResponse(
        {
          success: false,

          code:
            "AVATAR_REQUIRED",

          message:
            "Sélectionnez une photo de profil.",
        },
        400,
      );
    }

    const metadataError =
      validateAvatarMetadata(
        avatarEntry,
      );

    if (metadataError) {
      return jsonResponse(
        {
          success: false,

          code:
            "INVALID_AVATAR",

          message:
            metadataError,
        },
        422,
      );
    }

    if (
      !isAllowedAvatarMimeType(
        avatarEntry.type,
      )
    ) {
      return jsonResponse(
        {
          success: false,

          code:
            "INVALID_AVATAR_TYPE",

          message:
            "Le format de la photo n’est pas accepté.",
        },
        422,
      );
    }

    const arrayBuffer =
      await avatarEntry.arrayBuffer();

    const bytes =
      new Uint8Array(
        arrayBuffer,
      );

    if (
      !fileSignatureMatchesMimeType(
        bytes,
        avatarEntry.type,
      )
    ) {
      return jsonResponse(
        {
          success: false,

          code:
            "INVALID_AVATAR_CONTENT",

          message:
            "Le contenu du fichier ne correspond pas à une image valide.",
        },
        422,
      );
    }

    const extension =
      getAvatarExtension(
        avatarEntry.type,
      );

    newAvatarPath =
      createAvatarStoragePath({
        organizerId:
          organizer.id,
        extension,
      });

    const existingProfile =
      await prisma.organizerProfile.findUnique({
        where: {
          userId:
            organizer.id,
        },

        select: {
          avatarPath: true,
        },
      });

    const previousAvatarPath =
      existingProfile?.avatarPath?.trim() ||
      null;

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from(
          ORGANIZER_AVATARS_BUCKET,
        )
        .upload(
          newAvatarPath,
          arrayBuffer,
          {
            contentType:
              avatarEntry.type,

            cacheControl:
              "31536000",

            upsert: false,
          },
        );

    if (uploadError) {
      console.error(
        "[ORGANIZER_AVATAR_UPLOAD_ERROR]",
        {
          organizerId:
            organizer.id,

          filename:
            avatarEntry.name,

          message:
            uploadError.message,
        },
      );

      return jsonResponse(
        {
          success: false,

          code:
            "AVATAR_UPLOAD_FAILED",

          message:
            "La photo de profil n’a pas pu être téléversée.",
        },
        500,
      );
    }

    const publicUrl =
      getPublicAvatarUrl(
        newAvatarPath,
      );

    try {
      await prisma.organizerProfile.upsert({
        where: {
          userId:
            organizer.id,
        },

        create: {
          userId:
            organizer.id,

          avatar:
            publicUrl,

          avatarPath:
            newAvatarPath,
        },

        update: {
          avatar:
            publicUrl,

          avatarPath:
            newAvatarPath,
        },
      });
    } catch (databaseError) {
      await removeAvatarFromStorage(
        newAvatarPath,
      ).catch(
        (cleanupError: unknown) => {
          console.error(
            "[NEW_AVATAR_ROLLBACK_ERROR]",
            cleanupError instanceof Error
              ? cleanupError.message
              : cleanupError,
          );
        },
      );

      throw databaseError;
    }

    let warning:
      | string
      | undefined;

    if (
      previousAvatarPath &&
      previousAvatarPath !==
        newAvatarPath
    ) {
      try {
        await removeAvatarFromStorage(
          previousAvatarPath,
        );
      } catch (cleanupError) {
        warning =
          "La nouvelle photo est enregistrée, mais l’ancienne n’a pas pu être supprimée automatiquement.";

        console.error(
          "[OLD_AVATAR_CLEANUP_ERROR]",
          {
            organizerId:
              organizer.id,

            oldPath:
              previousAvatarPath,

            message:
              cleanupError instanceof Error
                ? cleanupError.message
                : cleanupError,
          },
        );
      }
    }

    return jsonResponse(
      {
        success: true,

        code:
          "ORGANIZER_AVATAR_UPDATED",

        message:
          "Votre photo de profil a été mise à jour avec succès.",

        warning,

        data: {
          avatar:
            publicUrl,

          avatarPath:
            newAvatarPath,
        },
      },
      200,
    );
  } catch (error) {
    /*
     * Si une erreur inattendue arrive après l’upload
     * mais avant l’enregistrement en base, on tente
     * de supprimer le nouveau fichier.
     */
    if (newAvatarPath) {
      await removeAvatarFromStorage(
        newAvatarPath,
      ).catch(() => undefined);
    }

    console.error(
      "[ORGANIZER_AVATAR_ROUTE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,

        code:
          "ORGANIZER_AVATAR_FAILED",

        message:
          "Impossible de mettre à jour votre photo de profil pour le moment.",
      },
      500,
    );
  }
}

/**
 * DELETE /api/organizer/profile/avatar
 *
 * Supprime la photo de profil actuelle.
 */
export async function DELETE(): Promise<
  NextResponse<AvatarApiResponse>
> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

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

    const profile =
      await prisma.organizerProfile.findUnique({
        where: {
          userId:
            organizer.id,
        },

        select: {
          id: true,
          avatar: true,
          avatarPath: true,
        },
      });

    if (
      !profile ||
      (!profile.avatar &&
        !profile.avatarPath)
    ) {
      return jsonResponse(
        {
          success: true,

          code:
            "NO_AVATAR_TO_DELETE",

          message:
            "Aucune photo de profil n’est enregistrée.",

          data: {
            avatar: null,
            avatarPath: null,
          },
        },
        200,
      );
    }

    const previousAvatarPath =
      profile.avatarPath?.trim() ||
      null;

    /*
     * On retire d’abord la référence dans PostgreSQL.
     * Le profil ne pointera donc jamais vers un fichier
     * supprimé ou indisponible.
     */
    await prisma.organizerProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        avatar: null,
        avatarPath: null,
      },
    });

    let warning:
      | string
      | undefined;

    if (previousAvatarPath) {
      try {
        await removeAvatarFromStorage(
          previousAvatarPath,
        );
      } catch (storageError) {
        warning =
          "La photo a été retirée du profil, mais le fichier n’a pas pu être supprimé automatiquement du stockage.";

        console.error(
          "[DELETE_AVATAR_STORAGE_ERROR]",
          {
            organizerId:
              organizer.id,

            path:
              previousAvatarPath,

            message:
              storageError instanceof Error
                ? storageError.message
                : storageError,
          },
        );
      }
    }

    return jsonResponse(
      {
        success: true,

        code:
          "ORGANIZER_AVATAR_DELETED",

        message:
          "Votre photo de profil a été supprimée.",

        warning,

        data: {
          avatar: null,
          avatarPath: null,
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "[DELETE_ORGANIZER_AVATAR_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success: false,

        code:
          "DELETE_ORGANIZER_AVATAR_FAILED",

        message:
          "Impossible de supprimer votre photo de profil pour le moment.",
      },
      500,
    );
  }
}