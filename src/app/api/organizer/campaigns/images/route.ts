import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";



/* ============================================
   TIKEMIA — IMAGES DES CAGNOTTES

   Fichier :
   src/app/api/organizer/campaigns/images/route.ts

   Endpoints :

   POST
   /api/organizer/campaigns/images

   GET
   /api/organizer/campaigns/images?id=UUID

   DELETE
   /api/organizer/campaigns/images?id=UUID

   Fonctionnalités :
   - Téléversement sécurisé
   - 1 à 10 images par demande
   - JPG, PNG et WebP
   - Maximum 10 Mo par image
   - Vérification du contenu
   - Session organisateur
   - Stockage privé
   - Isolation par organisateur
   - Consultation des aperçus
   - Suppression individuelle
   - Français / Anglais

   Aucun composant graphique.
   Aucun fichier CSS supplémentaire.
============================================ */




/* ============================================
   CONFIGURATION
============================================ */

const SESSION_COOKIE = "tikemia_organizer_session";

const MAX_IMAGES = 10;

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const MAX_TOTAL_SIZE =
  MAX_IMAGES * MAX_FILE_SIZE;

const MAX_REQUEST_SIZE =
  MAX_TOTAL_SIZE + 1024 * 1024;

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Language = "fr" | "en";

type ImageExtension =
  | "jpg"
  | "png"
  | "webp";

type ImageFormat = {
  extension: ImageExtension;
  contentType: string;
};

type ValidatedImage = {
  originalName: string;
  bytes: Buffer;
  format: ImageFormat;
};

type SavedImage = {
  id: string;
  url: string;
  originalName: string;
  size: number;
  contentType: string;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidRequest"
  | "invalidCount"
  | "invalidFormat"
  | "invalidImage"
  | "tooLarge"
  | "requestTooLarge"
  | "notFound"
  | "uploadFailed"
  | "deleteFailed"
  | "serverError";

/* ============================================
   TEXTES FRANÇAIS / ANGLAIS
============================================ */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Vous n'êtes pas autorisé à effectuer cette opération.",

    invalidRequest:
      "La demande envoyée est invalide.",

    invalidCount:
      "Sélectionnez entre 1 et 10 images.",

    invalidFormat:
      "Format non accepté. Utilisez JPG, PNG ou WebP.",

    invalidImage:
      "Une image est invalide ou endommagée.",

    tooLarge:
      "Une image dépasse la taille maximale de 10 Mo.",

    requestTooLarge:
      "La taille totale des fichiers dépasse la limite autorisée.",

    notFound:
      "Image introuvable.",

    uploadFailed:
      "Impossible d'enregistrer les images.",

    deleteFailed:
      "Impossible de supprimer cette image.",

    serverError:
      "Service temporairement indisponible.",

    uploadSuccess:
      "Images de la cagnotte enregistrées.",

    deleteSuccess:
      "Image supprimée.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You are not allowed to perform this operation.",

    invalidRequest:
      "Invalid upload request.",

    invalidCount:
      "Select between 1 and 10 images.",

    invalidFormat:
      "Unsupported format. Use JPG, PNG or WebP.",

    invalidImage:
      "An image is invalid or damaged.",

    tooLarge:
      "An image exceeds the 10 MB size limit.",

    requestTooLarge:
      "The total upload size exceeds the allowed limit.",

    notFound:
      "Image not found.",

    uploadFailed:
      "Unable to save the images.",

    deleteFailed:
      "Unable to delete this image.",

    serverError:
      "Service temporarily unavailable.",

    uploadSuccess:
      "Fundraiser images saved.",

    deleteSuccess:
      "Image deleted.",
  },
} as const;

/* ============================================
   PRISMA ORM 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   RÉPONSES JSON
============================================ */

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,

    headers: {
      "Cache-Control":
        "private, no-store, max-age=0",

      "X-Content-Type-Options":
        "nosniff",

      "Vary": "Cookie",
    },
  });
}

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number
) {
  return jsonResponse(
    {
      success: false,
      message: TEXT[language][key],
    },
    status
  );
}

/* ============================================
   DÉTECTION DE LA LANGUE
============================================ */

function getLanguage(
  request: NextRequest
): Language {
  const explicitLanguage =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (explicitLanguage === "en") {
    return "en";
  }

  if (explicitLanguage === "fr") {
    return "fr";
  }

  const header =
    request.headers.get(
      "accept-language"
    ) ?? "";

  return header.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================
   CONTRÔLE D'ORIGINE

   Les opérations d'écriture doivent
   provenir du même site TIKEMIA.
============================================ */

function isAllowedOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return fetchSite === "same-origin";
  }

  return origin === request.nextUrl.origin;
}

/* ============================================
   AUTHENTIFICATION ORGANISATEUR

   Compatible avec une session stockant
   le SHA-256 du jeton dans PostgreSQL.

   Le cookie contient le jeton brut.
============================================ */

async function getOrganizerId(
  request: NextRequest
): Promise<string | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const prisma = getPrisma();

  const session =
    await prisma.session.findFirst({
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

  const user =
    await prisma.user.findUnique({
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

  const organizerRole =
    await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: "ORGANIZER",
      },

      select: {
        id: true,
      },
    });

  if (!organizerRole) {
    return null;
  }

  return user.id;
}

/* ============================================
   STOCKAGE PRIVÉ DES CAGNOTTES

   Le dossier est séparé de celui
   des images d'événements.

   Aucun fichier dans public/.
============================================ */


const STORAGE_BUCKET = process.env.SUPABASE_CAMPAIGN_BUCKET || "campaign-images";
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
   DOSSIER PRIVÉ DE L'ORGANISATEUR

   L'identifiant utilisateur n'apparaît
   pas directement dans le chemin.
============================================ */



/* ============================================
   IDENTIFIANTS VALIDES
============================================ */

function isValidImageId(
  value: string
): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

/* ============================================
   CONTRÔLE DE SIGNATURE DES IMAGES

   Ne pas faire confiance uniquement
   à l'extension du nom de fichier.
============================================ */

function detectImageFormat(
  bytes: Buffer
): ImageFormat | null {
  if (bytes.length < 24) {
    return null;
  }

  /* ----------------------------------------
     JPEG

     Début FF D8 FF
     Fin FF D9
  ---------------------------------------- */

  const isJpeg =
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;

  if (isJpeg) {
    return {
      extension: "jpg",
      contentType: "image/jpeg",
    };
  }

  /* ----------------------------------------
     PNG
  ---------------------------------------- */

  const pngSignature = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);

  const isPng =
    bytes.subarray(0, 8).equals(
      pngSignature
    );

  if (isPng) {
    const ihdr =
      bytes.toString(
        "ascii",
        12,
        16
      );

    const width =
      bytes.readUInt32BE(16);

    const height =
      bytes.readUInt32BE(20);

    if (
      bytes.length < 45 ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", bytes.length - 8, bytes.length - 4) !== "IEND" ||
      width * height > 100_000_000 ||
      ihdr !== "IHDR" ||
      width === 0 ||
      height === 0
    ) {
      return null;
    }

    return {
      extension: "png",
      contentType: "image/png",
    };
  }

  /* ----------------------------------------
     WEBP

     RIFF + WEBP + VP8
  ---------------------------------------- */

  const riff =
    bytes.toString(
      "ascii",
      0,
      4
    );

  const webp =
    bytes.toString(
      "ascii",
      8,
      12
    );

  if (
    riff === "RIFF" &&
    webp === "WEBP"
  ) {
    const declaredSize =
      bytes.readUInt32LE(4);

    if (
      declaredSize + 8 !== bytes.length
    ) {
      return null;
    }

    const chunk =
      bytes.toString(
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

   Ne retourne que les fichiers situés
   dans l'espace de l'organisateur.
============================================ */

async function findOrganizerImage(organizerId: string, imageId: string) {
  if (!isValidImageId(imageId)) return null;
  return findStorageObject(organizerId, imageId, MAX_FILE_SIZE);
}

/* ============================================
   POST — ENVOYER LES IMAGES

   Reçoit :

   FormData
   images: File
   images: File
   ...

   Réponse :

   {
     success: true,
     images: [
       {
         id,
         url,
         size,
         contentType,
         originalName
       }
     ]
   }
============================================ */

export async function POST(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    /* ----------------------------------------
       1. ORIGINE
    ---------------------------------------- */

    if (!isAllowedOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    /* ----------------------------------------
       2. SESSION
    ---------------------------------------- */

    const organizerId =
      await getOrganizerId(request);

    if (!organizerId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       3. TYPE DE REQUÊTE
    ---------------------------------------- */

    const requestType =
      request.headers.get(
        "content-type"
      ) ?? "";

    if (
      !requestType
        .toLowerCase()
        .startsWith(
          "multipart/form-data"
        )
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        415
      );
    }

    /* ----------------------------------------
       4. TAILLE DE LA REQUÊTE
    ---------------------------------------- */

    const contentLength =
      request.headers.get(
        "content-length"
      );

    if (contentLength !== null) {
      const size = Number(
        contentLength
      );

      if (
        !Number.isFinite(size) ||
        size < 0 ||
        size > MAX_REQUEST_SIZE
      ) {
        return errorResponse(
          language,
          "requestTooLarge",
          413
        );
      }
    }

    /* ----------------------------------------
       5. LECTURE DES FICHIERS
    ---------------------------------------- */

    let formData: FormData;

    try {
      let received = 0;
      const body = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received > MAX_REQUEST_SIZE) throw new Error("REQUEST_TOO_LARGE");
          controller.enqueue(chunk);
        },
      }));
      formData = await new Response(body, { headers: { "Content-Type": requestType } }).formData();
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return errorResponse(language, "requestTooLarge", 413);
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    const entries =
      formData.getAll("images");

    if (
      entries.length < 1 ||
      entries.length > MAX_IMAGES
    ) {
      return errorResponse(
        language,
        "invalidCount",
        400
      );
    }

    /* ----------------------------------------
       6. VALIDATION DES IMAGES

       Aucun fichier n'est enregistré
       avant la fin des contrôles.
    ---------------------------------------- */

    const validatedImages:
      ValidatedImage[] = [];

    let totalSize = 0;

    const fingerprints =
      new Set<string>();

    for (const entry of entries) {
      if (!(entry instanceof File)) {
        return errorResponse(
          language,
          "invalidFormat",
          400
        );
      }

      if (
        entry.size <= 0 ||
        entry.size > MAX_FILE_SIZE
      ) {
        return errorResponse(
          language,
          "tooLarge",
          413
        );
      }

      if (
        !ACCEPTED_TYPES.has(
          entry.type
        )
      ) {
        return errorResponse(
          language,
          "invalidFormat",
          400
        );
      }

      totalSize += entry.size;

      if (
        totalSize > MAX_TOTAL_SIZE
      ) {
        return errorResponse(
          language,
          "requestTooLarge",
          413
        );
      }

      const bytes = Buffer.from(
        await entry.arrayBuffer()
      );

      if (
        bytes.length !== entry.size
      ) {
        return errorResponse(
          language,
          "invalidImage",
          400
        );
      }

      const format =
        detectImageFormat(bytes);

      if (
        !format ||
        entry.type !==
          format.contentType
      ) {
        return errorResponse(
          language,
          "invalidFormat",
          400
        );
      }

      /* --------------------------------------
         ÉVITER LES DOUBLONS DANS LA DEMANDE
      -------------------------------------- */

      const fingerprint =
        createHash("sha256")
          .update(bytes)
          .digest("hex");

      if (
        fingerprints.has(
          fingerprint
        )
      ) {
        continue;
      }

      fingerprints.add(
        fingerprint
      );

      const originalName =
        entry.name
          .replace(
            /[\u0000-\u001f\u007f]/g,
            ""
          )
          .slice(0, 180);

      validatedImages.push({
        originalName,
        bytes,
        format,
      });
    }

    if (
      validatedImages.length === 0
    ) {
      return errorResponse(
        language,
        "invalidCount",
        400
      );
    }

    /* ----------------------------------------
       7. DOSSIER DE STOCKAGE
    ---------------------------------------- */

    const directory = createHash("sha256").update(organizerId).digest("hex");

    /* ----------------------------------------
       8. ENREGISTREMENT DES IMAGES
    ---------------------------------------- */

    const savedPaths:
      string[] = [];

    const savedImages:
      SavedImage[] = [];

    try {
      for (
        const image of validatedImages
      ) {
        const id = randomUUID();

        const filename =
          `${id}.${image.format.extension}`;

        const filepath = `${directory}/${filename}`;
        savedPaths.push(filepath);
        const { error } = await getBucket().upload(filepath, image.bytes, { contentType: image.format.contentType, upsert: false, cacheControl: "0" });
        if (error) throw error;

        savedImages.push({
          id,

          url:
            `/api/organizer/campaigns/images?id=${id}`,

          originalName:
            image.originalName,

          size: image.bytes.length,

          contentType:
            image.format.contentType,
        });
      }
    } catch (error) {
      const failure = error as { name?: string; status?: number; statusCode?: string; originalError?: { name?: string } };
      console.error("[TIKEMIA CAMPAIGNS IMAGE UPLOAD]", {
        bucket: STORAGE_BUCKET,
        name: failure.name ?? "StorageError",
        status: failure.statusCode ?? failure.status,
        cause: failure.originalError?.name,
      });
      if (savedPaths.length) {
        try {
          const { error: cleanupError } = await getBucket().remove(savedPaths);
          if (cleanupError) console.error("[TIKEMIA CAMPAIGNS IMAGE CLEANUP]", cleanupError.name);
        } catch {
          console.error("[TIKEMIA CAMPAIGNS IMAGE CLEANUP] Unavailable");
        }
      }

      return errorResponse(
        language,
        "uploadFailed",
        500
      );
    }

    /* ----------------------------------------
       9. RÉPONSE
    ---------------------------------------- */

    return jsonResponse(
      {
        success: true,

        message:
          TEXT[language].uploadSuccess,

        count:
          savedImages.length,

        images:
          savedImages,
      },
      201
    );
  } catch (error) {
    console.error(
      "[TIKEMIA CAMPAIGN IMAGES POST]",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}

/* ============================================
   GET — CONSULTATION PRIVÉE

   Exemple :

   /api/organizer/campaigns/images?id=UUID

   L'organisateur ne peut consulter
   que les images de son propre compte.
============================================ */

export async function GET(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    /* ----------------------------------------
       1. AUTHENTIFICATION
    ---------------------------------------- */

    const organizerId =
      await getOrganizerId(request);

    if (!organizerId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       2. IDENTIFIANT
    ---------------------------------------- */

    const imageId =
      request.nextUrl.searchParams.get(
        "id"
      );

    if (
      !imageId ||
      !isValidImageId(imageId)
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    /* ----------------------------------------
       3. RECHERCHER L'IMAGE
    ---------------------------------------- */

    const image =
      await findOrganizerImage(
        organizerId,
        imageId
      );

    if (!image) {
      return errorResponse(
        language,
        "notFound",
        404
      );
    }

    /* ----------------------------------------
       4. LIRE LE FICHIER
    ---------------------------------------- */

    const { data, error } = await getBucket().download(image.storageKey);
    if (error) throw error;
    const bytes = new Uint8Array(await data.arrayBuffer());

    /* ----------------------------------------
       5. RÉPONSE IMAGE
    ---------------------------------------- */

    return new NextResponse(
      new Uint8Array(bytes),
      {
        status: 200,

        headers: {
          "Content-Type":
            image.contentType,

          "Content-Length":
            String(bytes.length),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",

          "Content-Security-Policy":
            "default-src 'none'; sandbox",

          "Content-Disposition":
            "inline",

          "Vary":
            "Cookie",
        },
      }
    );
  } catch (error) {
    console.error(
      "[TIKEMIA CAMPAIGN IMAGES GET]",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}

/* ============================================
   DELETE — SUPPRIMER UNE IMAGE

   Exemple :

   DELETE
   /api/organizer/campaigns/images?id=UUID

   La suppression est limitée
   au dossier privé de l'organisateur.
============================================ */

export async function DELETE(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    /* ----------------------------------------
       1. CONTRÔLE D'ORIGINE
    ---------------------------------------- */

    if (!isAllowedOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    /* ----------------------------------------
       2. AUTHENTIFICATION
    ---------------------------------------- */

    const organizerId =
      await getOrganizerId(request);

    if (!organizerId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       3. IDENTIFIANT
    ---------------------------------------- */

    const imageId =
      request.nextUrl.searchParams.get(
        "id"
      );

    if (
      !imageId ||
      !isValidImageId(imageId)
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    /* ----------------------------------------
       4. RECHERCHER L'IMAGE
    ---------------------------------------- */

    const image =
      await findOrganizerImage(
        organizerId,
        imageId
      );

    if (!image) {
      return errorResponse(
        language,
        "notFound",
        404
      );
    }

    /* ----------------------------------------
       5. SUPPRESSION
    ---------------------------------------- */

    try {
      const attached = await getPrisma().campaignImage.findFirst({ where: { storageKey: image.storageKey }, select: { id: true } });
      if (attached) return errorResponse(language, "forbidden", 409);
      const { error } = await getBucket().remove([image.storageKey]);
      if (error) throw error;
    } catch {
      return errorResponse(
        language,
        "deleteFailed",
        500
      );
    }

    /* ----------------------------------------
       6. CONFIRMATION
    ---------------------------------------- */

    return jsonResponse({
      success: true,

      message:
        TEXT[language].deleteSuccess,

      id: imageId,
    });
  } catch (error) {
    console.error(
      "[TIKEMIA CAMPAIGN IMAGES DELETE]",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}
