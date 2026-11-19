import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";


/* ============================================
   TIKEMIA — IMAGES DES ÉVÉNEMENTS

   Route :
   /api/organizer/events/images

   POST   : Ajouter des images
   GET    : Consulter une image
   DELETE : Supprimer une image

   Sécurité :
   - Session organisateur obligatoire
   - Adresse email vérifiée
   - 1 à 10 images par demande
   - 10 Mo maximum par image
   - Contrôle des signatures des fichiers
   - Identifiants aléatoires
   - Isolation des images par organisateur
   - Stockage hors du dossier public
   - Français / Anglais
============================================ */


/* ============================================
   CONFIGURATION
============================================ */

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MAX_REQUEST_BYTES =
  MAX_IMAGES * MAX_IMAGE_BYTES +
  1024 * 1024;

const SESSION_COOKIE = "tikemia_organizer_session";

type Language = "fr" | "en";

type ImageFormat = {
  extension: "jpg" | "png" | "webp";
  contentType: string;
};

type UploadedImage = {
  id: string;
  url: string;
  size: number;
  contentType: string;
  originalName: string;
};

/* ============================================
   MESSAGES
============================================ */

const TEXT = {
  fr: {
    unauthorized: "Connexion requise.",
    forbidden: "Accès non autorisé.",
    invalidRequest: "Requête invalide.",
    invalidCount: "Sélectionnez entre 1 et 10 images.",
    tooLarge: "Une image dépasse 10 Mo.",
    requestTooLarge: "Envoi trop volumineux.",
    invalidFormat:
      "Format invalide. Utilisez JPG, PNG ou WebP.",
    uploadFailed:
      "Impossible d'enregistrer les images.",
    uploadSuccess: "Images enregistrées.",
    invalidId: "Image invalide.",
    notFound: "Image introuvable.",
    deleted: "Image supprimée.",
    unavailable: "Service temporairement indisponible.",
  },
  en: {
    unauthorized: "Authentication required.",
    forbidden: "Access denied.",
    invalidRequest: "Invalid request.",
    invalidCount: "Select between 1 and 10 images.",
    tooLarge: "An image exceeds 10 MB.",
    requestTooLarge: "Upload is too large.",
    invalidFormat:
      "Invalid format. Use JPG, PNG or WebP.",
    uploadFailed: "Unable to save images.",
    uploadSuccess: "Images saved.",
    invalidId: "Invalid image.",
    notFound: "Image not found.",
    deleted: "Image deleted.",
    unavailable: "Service temporarily unavailable.",
  },
} as const;

type MessageKey = keyof typeof TEXT.fr;

/* ============================================
   PRISMA 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   RÉPONSES
============================================ */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorResponse(
  language: Language,
  key: MessageKey,
  status: number
) {
  return respond(
    {
      success: false,
      message: TEXT[language][key],
    },
    status
  );
}

/* ============================================
   LANGUE
============================================ */

function getLanguage(
  request: NextRequest
): Language {
  const value =
    request.headers.get("accept-language") ?? "";

  return value.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================
   PROTECTION DES REQUÊTES

   Les modifications doivent provenir
   du même site.
============================================ */

function isAllowedOrigin(
  request: NextRequest
): boolean {
  const fetchSite = request.headers.get(
    "sec-fetch-site"
  );

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === getTrustedRequestOrigin(request);
}

/* ============================================
   AUTHENTIFICATION

   Le cookie contient le jeton brut.

   PostgreSQL conserve seulement
   l'empreinte SHA-256 du jeton.
============================================ */

async function getOrganizerId(
  request: NextRequest
): Promise<string | null> {
  const token = request.cookies.get(
    SESSION_COOKIE
  )?.value;

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const prisma = getPrisma();

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      userId: true,
    },
  });

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      isActive: true,
      isBlocked: true,
      emailVerifiedAt: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt
  ) {
    return null;
  }

  const role = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      role: "ORGANIZER",
    },
    select: {
      id: true,
    },
  });

  if (!role) {
    return null;
  }

  return user.id;
}

/* ============================================
   DOSSIER DE STOCKAGE

   Les images ne sont pas placées
   dans public/.

   Le dossier est créé automatiquement
   lors du premier envoi.
============================================ */


const STORAGE_BUCKET = process.env.SUPABASE_EVENT_BUCKET || "event-images";
// Les images autorisees (10 Mo) peuvent necessiter plusieurs dizaines de secondes.
const STORAGE_TIMEOUT_MS = 180_000;
let storageClient: ReturnType<typeof createClient> | undefined;
function getBucket() {
  if (!storageClient) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
    storageClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(STORAGE_TIMEOUT_MS)]) : AbortSignal.timeout(STORAGE_TIMEOUT_MS) }) },
    });
  }
  return storageClient.storage.from(STORAGE_BUCKET);
}
async function findStorageObject(userId: string, id: string, maxBytes: number) {
  const prefix = createHash("sha256").update(userId, "utf8").digest("hex");
  for (const [extension, contentType] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]] as const) {
    const storageKey = `${prefix}/${id.toLowerCase()}.${extension}`;
    const { data, error } = await getBucket().info(storageKey);
    if (error) {
      const status = Number(error.statusCode ?? error.status ?? 0);
      const code = "code" in error ? String(error.code) : "";
      if (status === 404 || code === "NoSuchKey" || code === "not_found") continue;
      throw error;
    }
    const size = data.size ?? data.metadata?.size ?? 0;
    const mime = data.contentType ?? data.metadata?.mimetype;
    if (size > 0 && size <= maxBytes && mime === contentType) return { storageKey, contentType };
  }
  return null;
}




/* ============================================
   IDENTIFIANTS DES IMAGES
============================================ */

function validImageId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/* ============================================
   DÉTECTION DU FORMAT RÉEL

   Nous n'utilisons pas uniquement
   le type MIME transmis par le navigateur.
============================================ */

function detectImageFormat(
  bytes: Uint8Array
): ImageFormat | null {
  if (bytes.length < 24) {
    return null;
  }

  // JPEG
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  ) {
    return {
      extension: "jpg",
      contentType: "image/jpeg",
    };
  }

  // PNG
  const pngSignature = [
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ];

  const isPNG = pngSignature.every(
    (value, index) => bytes[index] === value
  );

  if (isPNG) {
    const header = Buffer.from(bytes);

    if (
      header.toString("ascii", 12, 16) !==
      "IHDR"
    ) {
      return null;
    }

    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);

    if (bytes.length < 45 || header.readUInt32BE(8) !== 13 ||
        header.toString("ascii", bytes.length - 8, bytes.length - 4) !== "IEND" ||
        width === 0 || height === 0 || width * height > 100_000_000) {
      return null;
    }

    return {
      extension: "png",
      contentType: "image/png",
    };
  }

  // WebP
  const header = Buffer.from(bytes);

  const riff = header.toString("ascii", 0, 4);
  const webp = header.toString("ascii", 8, 12);

  if (riff === "RIFF" && webp === "WEBP") {
    const declaredSize = header.readUInt32LE(4);

    if (declaredSize + 8 !== bytes.length) {
      return null;
    }

    const chunk = header.toString(
      "ascii",
      12,
      16
    );

    if (
      chunk !== "VP8 " &&
      chunk !== "VP8L" &&
      chunk !== "VP8X"
    ) {
      return null;
    }

    return {
      extension: "webp",
      contentType: "image/webp",
    };
  }

  return null;
}

/* ============================================
   RECHERCHE D'UNE IMAGE PRIVÉE
============================================ */

async function findImage(userId: string, id: string) {
  if (!validImageId(id)) return null;
  return findStorageObject(userId, id, MAX_IMAGE_BYTES);
}

/* ============================================
   POST — AJOUTER DES IMAGES
============================================ */

export async function POST(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    if (!isAllowedOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    const userId = await getOrganizerId(request);

    if (!userId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("multipart/form-data")
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        415
      );
    }

    const contentLength = request.headers.get(
      "content-length"
    );

    if (contentLength) {
      const requestSize = Number(contentLength);

      if (
        !Number.isFinite(requestSize) ||
        requestSize < 0 ||
        requestSize > MAX_REQUEST_BYTES
      ) {
        return errorResponse(
          language,
          "requestTooLarge",
          413
        );
      }
    }

    /* ----------------------------------------
       LECTURE DU FORMULAIRE
    ---------------------------------------- */

    let formData: FormData;

    try {
      let received = 0;
      const body = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received > MAX_REQUEST_BYTES) throw new Error("REQUEST_TOO_LARGE");
          controller.enqueue(chunk);
        },
      }));
      formData = await new Response(body, { headers: { "Content-Type": contentType } }).formData();
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
        return errorResponse(language, "requestTooLarge", 413);
      }
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    const submittedFiles =
      formData.getAll("images");

    if (
      submittedFiles.length < 1 ||
      submittedFiles.length > MAX_IMAGES
    ) {
      return errorResponse(
        language,
        "invalidCount",
        400
      );
    }

    /* ----------------------------------------
       VÉRIFIER LES FICHIERS
       AVANT TOUT ENREGISTREMENT
    ---------------------------------------- */

    const validatedFiles: {
      originalName: string;
      bytes: Uint8Array;
      format: ImageFormat;
    }[] = [];

    let totalBytes = 0;

    for (const entry of submittedFiles) {
      if (!(entry instanceof File)) {
        return errorResponse(
          language,
          "invalidFormat",
          400
        );
      }

      if (
        entry.size === 0 ||
        entry.size > MAX_IMAGE_BYTES
      ) {
        return errorResponse(
          language,
          "tooLarge",
          413
        );
      }

      totalBytes += entry.size;

      if (
        totalBytes >
        MAX_IMAGES * MAX_IMAGE_BYTES
      ) {
        return errorResponse(
          language,
          "requestTooLarge",
          413
        );
      }

      const bytes = new Uint8Array(
        await entry.arrayBuffer()
      );

      const format = detectImageFormat(bytes);

      if (!format) {
        return errorResponse(
          language,
          "invalidFormat",
          400
        );
      }

      if (
        entry.type &&
        entry.type !== format.contentType
      ) {
        return errorResponse(
          language,
          "invalidFormat",
          400
        );
      }

      validatedFiles.push({
        originalName: entry.name.slice(0, 200),
        bytes,
        format,
      });
    }

    /* ----------------------------------------
       CRÉER LE DOSSIER DE L'ORGANISATEUR
    ---------------------------------------- */

    const directory = createHash("sha256").update(userId).digest("hex");

    /* ----------------------------------------
       ENREGISTREMENT

       En cas d'échec, supprimer les
       fichiers écrits pendant la demande.
    ---------------------------------------- */

    const savedPaths: string[] = [];
    const uploadedImages: UploadedImage[] = [];

    try {
      for (const file of validatedFiles) {
        const id = randomUUID();

        const filename =
          `${id}.${file.format.extension}`;

        const filepath = `${directory}/${filename}`;
        savedPaths.push(filepath);
        const { error } = await getBucket().upload(filepath, file.bytes, { contentType: file.format.contentType, upsert: false, cacheControl: "0" });
        if (error) throw error;

        uploadedImages.push({
          id,
          url:
            `/api/organizer/events/images?id=${id}`,
          size: file.bytes.length,
          contentType: file.format.contentType,
          originalName: file.originalName,
        });
      }
    } catch (error) {
      const failure = error as { name?: string; status?: number; statusCode?: string; originalError?: { name?: string } };
      console.error("[TIKEMIA EVENTS IMAGE UPLOAD]", {
        bucket: STORAGE_BUCKET,
        name: failure.name ?? "StorageError",
        status: failure.statusCode ?? failure.status,
        cause: failure.originalError?.name,
      });
      if (savedPaths.length) {
        try {
          const { error: cleanupError } = await getBucket().remove(savedPaths);
          if (cleanupError) console.error("[TIKEMIA EVENTS IMAGE CLEANUP]", cleanupError.name);
        } catch {
          console.error("[TIKEMIA EVENTS IMAGE CLEANUP] Unavailable");
        }
      }

      return errorResponse(
        language,
        "uploadFailed",
        500
      );
    }

    return respond(
      {
        success: true,
        message: TEXT[language].uploadSuccess,
        count: uploadedImages.length,
        images: uploadedImages,
      },
      201
    );
  } catch {
    console.error(
      "[TIKEMIA] Échec du traitement des images."
    );

    return errorResponse(
      language,
      "unavailable",
      503
    );
  }
}

/* ============================================
   GET — APERÇU PRIVÉ D'UNE IMAGE

   Exemple :
   /api/organizer/events/images?id=UUID
============================================ */

export async function GET(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    const userId = await getOrganizerId(request);

    if (!userId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    const id = request.nextUrl.searchParams.get(
      "id"
    );

    if (!id || !validImageId(id)) {
      return errorResponse(
        language,
        "invalidId",
        400
      );
    }

    const image = await findImage(
      userId,
      id
    );

    if (!image) {
      return errorResponse(
        language,
        "notFound",
        404
      );
    }

    const { data, error } = await getBucket().download(image.storageKey);
    if (error) throw error;
    const bytes = new Uint8Array(await data.arrayBuffer());

    return new NextResponse(
      new Uint8Array(bytes),
      {
        status: 200,
        headers: {
          "Content-Type": image.contentType,
          "Content-Length": String(
            bytes.length
          ),
          "Cache-Control":
            "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy":
            "default-src 'none'; sandbox",
        },
      }
    );
  } catch (error) {
    console.error("[TIKEMIA EVENTS IMAGE READ]", error instanceof Error ? error.message : "StorageError");
    return errorResponse(
      language,
      "unavailable",
      503
    );
  }
}

/* ============================================
   DELETE — SUPPRIMER UNE IMAGE

   Exemple :
   DELETE /api/organizer/events/images?id=UUID
============================================ */

export async function DELETE(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    if (!isAllowedOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    const userId = await getOrganizerId(request);

    if (!userId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    const id = request.nextUrl.searchParams.get(
      "id"
    );

    if (!id || !validImageId(id)) {
      return errorResponse(
        language,
        "invalidId",
        400
      );
    }

    const image = await findImage(
      userId,
      id
    );

    if (!image) {
      return errorResponse(
        language,
        "notFound",
        404
      );
    }

    const storageKey = image.storageKey;
    const attached = await getPrisma().eventImage.findFirst({ where: { storageKey }, select: { id: true } });
    if (attached) return errorResponse(language, "forbidden", 409);
    const { error } = await getBucket().remove([image.storageKey]);
    if (error) throw error;

    return respond({
      success: true,
      message: TEXT[language].deleted,
      id,
    });
  } catch {
    console.error(
      "[TIKEMIA] Échec de suppression d'image."
    );

    return errorResponse(
      language,
      "unavailable",
      503
    );
  }
}
