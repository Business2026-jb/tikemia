import "server-only";

import { randomUUID } from "node:crypto";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const supabaseServerKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export const SUPABASE_EVENT_IMAGES_BUCKET =
  process.env.SUPABASE_EVENT_IMAGES_BUCKET?.trim() ||
  "event-images";

export const EVENT_IMAGE_UPLOAD_RULES = {
  maximumFiles: 5,
  maximumFileSizeBytes: 5 * 1024 * 1024,

  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const,

  allowedExtensions: [
    "jpg",
    "jpeg",
    "png",
    "webp",
  ] as const,
};

export type AllowedEventImageMimeType =
  (typeof EVENT_IMAGE_UPLOAD_RULES.allowedMimeTypes)[number];

export type AllowedEventImageExtension =
  (typeof EVENT_IMAGE_UPLOAD_RULES.allowedExtensions)[number];

function getRequiredSupabaseUrl(): string {
  if (!supabaseUrl) {
    throw new Error(
      "La variable NEXT_PUBLIC_SUPABASE_URL est absente.",
    );
  }

  try {
    const parsedUrl = new URL(supabaseUrl);

    if (
      parsedUrl.protocol !== "https:" ||
      !parsedUrl.hostname.endsWith(".supabase.co")
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "La variable NEXT_PUBLIC_SUPABASE_URL n’est pas valide.",
    );
  }

  return supabaseUrl;
}

function getRequiredSupabaseServerKey(): string {
  if (!supabaseServerKey) {
    throw new Error(
      "La variable SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY est absente.",
    );
  }

  return supabaseServerKey;
}

function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    getRequiredSupabaseUrl(),
    getRequiredSupabaseServerKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },

      global: {
        headers: {
          "X-Client-Info": "tikemia-server",
        },
      },
    },
  );
}

declare global {
  var tikemiaSupabaseAdmin:
    | SupabaseClient
    | undefined;
}

export const supabaseAdmin =
  globalThis.tikemiaSupabaseAdmin ??
  createSupabaseAdminClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.tikemiaSupabaseAdmin =
    supabaseAdmin;
}

export function isAllowedEventImageMimeType(
  mimeType: string,
): mimeType is AllowedEventImageMimeType {
  return EVENT_IMAGE_UPLOAD_RULES.allowedMimeTypes.includes(
    mimeType as AllowedEventImageMimeType,
  );
}

export function isAllowedEventImageExtension(
  extension: string,
): extension is AllowedEventImageExtension {
  return EVENT_IMAGE_UPLOAD_RULES.allowedExtensions.includes(
    extension
      .trim()
      .toLowerCase() as AllowedEventImageExtension,
  );
}

export function getEventImageExtension(
  filename: string,
): AllowedEventImageExtension | null {
  const normalizedFilename = filename.trim();

  if (!normalizedFilename) {
    return null;
  }

  const extension = normalizedFilename
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();

  if (
    !extension ||
    !isAllowedEventImageExtension(extension)
  ) {
    return null;
  }

  return extension;
}

export function getEventImageContentType(
  extension: AllowedEventImageExtension,
): AllowedEventImageMimeType {
  if (
    extension === "jpg" ||
    extension === "jpeg"
  ) {
    return "image/jpeg";
  }

  if (extension === "png") {
    return "image/png";
  }

  return "image/webp";
}

export function sanitizeStorageSegment(
  value: string,
): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "")
    .slice(0, 100);
}

export function createEventImageStoragePath({
  organizerId,
  uploadBatchId,
  position,
  extension,
}: {
  organizerId: string;
  uploadBatchId: string;
  position: number;
  extension: AllowedEventImageExtension;
}): string {
  const safeOrganizerId =
    sanitizeStorageSegment(organizerId);

  const safeUploadBatchId =
    sanitizeStorageSegment(uploadBatchId);

  if (!safeOrganizerId) {
    throw new Error(
      "L’identifiant de l’organisateur est invalide.",
    );
  }

  if (!safeUploadBatchId) {
    throw new Error(
      "L’identifiant du téléversement est invalide.",
    );
  }

  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position >=
      EVENT_IMAGE_UPLOAD_RULES.maximumFiles
  ) {
    throw new Error(
      "La position de l’image est invalide.",
    );
  }

  if (
    !isAllowedEventImageExtension(extension)
  ) {
    throw new Error(
      "L’extension de l’image n’est pas autorisée.",
    );
  }

  const uniqueFilename = randomUUID().replaceAll(
    "-",
    "",
  );

  return [
    "organizers",
    safeOrganizerId,
    "events",
    safeUploadBatchId,
    `${position + 1}-${uniqueFilename}.${extension}`,
  ].join("/");
}

export function getPublicEventImageUrl(
  path: string,
): string {
  const normalizedPath = path
    .trim()
    .replace(/^\/+/, "");

  if (!normalizedPath) {
    throw new Error(
      "Le chemin de l’image est absent.",
    );
  }

  const { data } = supabaseAdmin.storage
    .from(SUPABASE_EVENT_IMAGES_BUCKET)
    .getPublicUrl(normalizedPath);

  if (!data.publicUrl) {
    throw new Error(
      "Impossible de générer l’adresse publique de l’image.",
    );
  }

  return data.publicUrl;
}

export async function removeEventImagesFromStorage(
  paths: readonly string[],
): Promise<void> {
  const normalizedPaths = Array.from(
    new Set(
      paths
        .map((path) =>
          path.trim().replace(/^\/+/, ""),
        )
        .filter(Boolean),
    ),
  );

  if (normalizedPaths.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from(SUPABASE_EVENT_IMAGES_BUCKET)
    .remove(normalizedPaths);

  if (error) {
    console.error(
      "[SUPABASE_EVENT_IMAGES_REMOVE_ERROR]",
      error.message,
    );

    throw new Error(
      "Impossible de supprimer les images du stockage.",
    );
  }
}