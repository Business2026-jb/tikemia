import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import sharp from "sharp";

/* ==========================================================
   TIKEMIA — PHOTO DE PROFIL ORGANISATEUR

   Fichier :
   src/app/api/organizer/settings/profile/avatar/route.ts

   API :
   GET     Lire la photo et son URL temporaire
   POST    Ajouter ou remplacer la photo
   DELETE  Supprimer la photo

   Stockage :
   Supabase Storage — bucket privé

   Base de données :
   User.avatarStorageKey

   Sécurité :
   - Session organisateur obligatoire
   - Vérification du rôle ORGANIZER
   - Contrôle CSRF
   - Limite de taille
   - Vérification du contenu de l'image
   - Traitement avec Sharp
   - Redimensionnement
   - Suppression des métadonnées
   - Stockage dans un chemin personnel
   - URL signée temporaire
   - Protection contre les modifications concurrentes

   La route est identique pour PC et mobile.
========================================================== */




/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE = "tikemia_organizer_session";

const SESSION_PATTERN = /^[a-f0-9]{64}$/i;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MAX_REQUEST_SIZE =
  MAX_FILE_SIZE + 256 * 1024;

const MAX_IMAGE_PIXELS = 25_000_000;

const OUTPUT_SIZE = 512;

const OUTPUT_QUALITY = 84;

const SIGNED_URL_SECONDS = 3600;

const DEFAULT_BUCKET = "profile-avatars";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ACCEPTED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
]);

type Language = "fr" | "en";

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidContentType"
  | "fileRequired"
  | "fileTooLarge"
  | "invalidImage"
  | "invalidDimensions"
  | "conflict"
  | "storageError"
  | "serverError";

type Organizer = {
  id: string;
  avatarStorageKey: string | null;
};

class ApiError extends Error {
  constructor(
    public readonly key: ErrorKey,
    public readonly status: number
  ) {
    super(key);
    this.name = "ApiError";
  }
}

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Cette opération n'est pas autorisée.",

    invalidContentType:
      "Envoyez la photo au format multipart/form-data.",

    fileRequired:
      "Veuillez sélectionner une photo de profil.",

    fileTooLarge:
      "La photo ne doit pas dépasser 5 Mo.",

    invalidImage:
      "La photo doit être une image JPEG, PNG ou WebP valide.",

    invalidDimensions:
      "Les dimensions de cette image ne sont pas acceptées.",

    conflict:
      "La photo de profil a été modifiée entre-temps. Actualisez votre profil puis réessayez.",

    storageError:
      "Impossible de communiquer avec le stockage des photos pour le moment.",

    serverError:
      "Une erreur est survenue lors de la gestion de votre photo de profil.",

    loaded:
      "Photo de profil récupérée.",

    uploaded:
      "Votre photo de profil a été enregistrée avec succès.",

    deleted:
      "Votre photo de profil a été supprimée.",

    noAvatar:
      "Vous n'avez pas encore ajouté de photo de profil.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "This operation is not authorized.",

    invalidContentType:
      "Upload the photo using multipart/form-data.",

    fileRequired:
      "Please select a profile picture.",

    fileTooLarge:
      "Your profile picture must not exceed 5 MB.",

    invalidImage:
      "The picture must be a valid JPEG, PNG or WebP image.",

    invalidDimensions:
      "This image's dimensions are not supported.",

    conflict:
      "Your profile picture was changed elsewhere. Refresh your profile and try again.",

    storageError:
      "The profile picture storage service is temporarily unavailable.",

    serverError:
      "An error occurred while managing your profile picture.",

    loaded:
      "Profile picture retrieved.",

    uploaded:
      "Your profile picture has been saved successfully.",

    deleted:
      "Your profile picture has been removed.",

    noAvatar:
      "You have not uploaded a profile picture yet.",
  },
} as const;

/* ==========================================================
   CONNEXION PRISMA 7
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   SUPABASE STORAGE

   Client réservé au serveur.

   Ne jamais envoyer ce client ni sa clé
   au navigateur.
========================================================== */

let storageClient: SupabaseClient | null = null;

function getStorage(): SupabaseClient {
  if (storageClient) {
    return storageClient;
  }

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  storageClient = createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  return storageClient;
}

function getBucketName(): string {
  const name =
    process.env.SUPABASE_AVATAR_BUCKET ||
    DEFAULT_BUCKET;

  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(name)) {
    throw new Error("INVALID_AVATAR_BUCKET");
  }

  return name;
}

/* ==========================================================
   LANGUE
========================================================== */

function getLanguage(
  request: NextRequest
): Language {
  const locale =
    request.nextUrl.searchParams.get("locale");

  if (locale === "fr" || locale === "en") {
    return locale;
  }

  const header =
    request.headers.get("accept-language") || "";

  return header.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

/* ==========================================================
   RÉPONSES
========================================================== */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Accept-Language",
    },
  });
}

function errorResponse(
  language: Language,
  key: ErrorKey,
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

/* ==========================================================
   CONTRÔLE CSRF

   Les requêtes POST et DELETE doivent
   provenir de l'application TIKEMIA.

   Le système de connexion doit également
   utiliser un cookie HttpOnly et SameSite.
========================================================== */

function isSameOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    fetchSite &&
    fetchSite !== "same-origin"
  ) {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin ===
      request.nextUrl.origin
    );
  } catch {
    return false;
  }
}

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR

   Convention de session utilisée par
   les autres routes TIKEMIA :

   Cookie : tikemia_organizer_session
   Session.tokenHash : SHA-256

   Le rôle ORGANIZER est obligatoire.

   L'identifiant n'est jamais accepté
   depuis le formulaire.
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<Organizer | null> {
  const token =
    request.cookies.get(SESSION_COOKIE)?.value;

  if (
    !token ||
    !SESSION_PATTERN.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

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
        avatarStorageKey: true,
        isActive: true,
        isBlocked: true,
        emailVerifiedAt: true,
        roles: {
          where: {
            role: "ORGANIZER",
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt ||
    user.roles.length === 0
  ) {
    return null;
  }

  return {
    id: user.id,
    avatarStorageKey: user.avatarStorageKey,
  };
}

/* ==========================================================
   VÉRIFICATION DES CHEMINS

   Chaque utilisateur possède uniquement
   son propre dossier :

   userId/UUID.webp

   Cela évite de manipuler un chemin
   appartenant à un autre utilisateur.
========================================================== */

function isOwnedAvatarPath(
  userId: string,
  path: string
): boolean {
  if (!path.startsWith(`${userId}/`)) {
    return false;
  }

  const fileName = path.slice(userId.length + 1);

  return /^[0-9a-f-]{36}\.webp$/i.test(fileName);
}

function generateAvatarPath(
  userId: string
): string {
  return `${userId}/${randomUUID()}.webp`;
}

/* ==========================================================
   URL TEMPORAIRE

   Les photos sont dans un bucket privé.

   L'URL est valable pendant une heure.
   Elle doit être renouvelée si nécessaire.
========================================================== */

async function createAvatarSignedUrl(
  path: string
): Promise<string> {
  const supabase = getStorage();
  const bucket = getBucketName();

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(
        path,
        SIGNED_URL_SECONDS
      );

  if (error || !data?.signedUrl) {
    throw new ApiError("storageError", 503);
  }

  return data.signedUrl;
}

/* ==========================================================
   SUPPRESSION D'UN FICHIER

   Utilisé uniquement avec une clé
   interne et validée du même utilisateur.

   Retourne un booléen afin de pouvoir
   contrôler les erreurs sans supprimer
   les informations de la base.
========================================================== */

async function removeStoredAvatar(
  path: string,
  userId: string
): Promise<boolean> {
  if (!isOwnedAvatarPath(userId, path)) {
    return false;
  }

  const supabase = getStorage();
  const bucket = getBucketName();

  const { error } =
    await supabase.storage
      .from(bucket)
      .remove([path]);

  if (error) {
    console.error(
      "[TIKEMIA AVATAR] Storage cleanup failed",
      error.name
    );

    return false;
  }

  return true;
}

/* ==========================================================
   NORMALISATION ET TRAITEMENT DE LA PHOTO

   Sharp :
   - Vérifie le décodage de l'image
   - Refuse les formats non autorisés
   - Limite les dimensions
   - Corrige l'orientation EXIF
   - Redimensionne à 512 × 512
   - Recadre au centre
   - Convertit en WebP
   - Supprime les métadonnées par défaut

   Les dimensions de sortie sont adaptées
   aux avatars du dashboard PC et mobile.
========================================================== */

async function processAvatar(
  file: File
): Promise<Buffer> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new ApiError("invalidImage", 415);
  }

  if (
    file.size <= 0 ||
    file.size > MAX_FILE_SIZE
  ) {
    throw new ApiError("fileTooLarge", 413);
  }

  const input = Buffer.from(
    await file.arrayBuffer()
  );

  try {
    const metadata = await sharp(input, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "error",
      animated: false,
    }).metadata();

    if (
      !metadata.format ||
      !ACCEPTED_FORMATS.has(metadata.format)
    ) {
      throw new ApiError("invalidImage", 415);
    }

    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 64 ||
      metadata.height < 64 ||
      metadata.width * metadata.height >
        MAX_IMAGE_PIXELS
    ) {
      throw new ApiError("invalidDimensions", 400);
    }

    const expectedMime: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    if (
      expectedMime[metadata.format] !==
      file.type
    ) {
      throw new ApiError("invalidImage", 415);
    }

    return await sharp(input, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "error",
      animated: false,
    })
      .rotate()
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: false,
      })
      .webp({
        quality: OUTPUT_QUALITY,
        effort: 5,
      })
      .toBuffer();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("invalidImage", 415);
  }
}

/* ==========================================================
   HISTORIQUE D'AUDIT

   Une modification du profil est tracée
   sans exposer le contenu de la photo.

   Les opérations d'audit sont exécutées
   dans la même transaction que la mise
   à jour de User.avatarStorageKey.
========================================================== */

async function updateAvatarInDatabase(
  prisma: PrismaClient,
  user: Organizer,
  nextPath: string | null,
  action: string
): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: user.id,
          avatarStorageKey: user.avatarStorageKey,
          isActive: true,
          isBlocked: false,
        },
        data: {
          avatarStorageKey: nextPath,
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action,
          entity: "User",
          entityId: user.id,
          metadata: {
            field: "avatarStorageKey",
            source: "organizer_profile",
          },
        },
      });

      return true;
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15000,
    }
  );
}

/* ==========================================================
   GESTION D'ERREURS
========================================================== */

function handleError(
  error: unknown,
  language: Language
) {
  if (error instanceof ApiError) {
    return errorResponse(
      language,
      error.key,
      error.status
    );
  }

  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return errorResponse(
      language,
      "conflict",
      409
    );
  }

  console.error(
    "[TIKEMIA ORGANIZER AVATAR]",
    error instanceof Error
      ? error.name
      : "UnknownError"
  );

  return errorResponse(
    language,
    "serverError",
    503
  );
}

/* ==========================================================
   GET — LIRE LA PHOTO DE PROFIL

   URL :
   GET /api/organizer/settings/profile/avatar

   Réponse :
   {
     success: true,
     avatar: {
       hasAvatar: true,
       url: "URL_SIGNEE",
       expiresIn: 3600
     }
   }

   Si aucune photo :
   hasAvatar = false
   url = null

   Aucun chemin Storage privé n'est
   nécessaire dans le navigateur.
========================================================== */

export async function GET(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    const prisma = getPrisma();

    const user = await authenticateOrganizer(
      request,
      prisma
    );

    if (!user) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    const path = user.avatarStorageKey;

    if (!path) {
      return respond({
        success: true,
        message: TEXT[language].noAvatar,
        avatar: {
          hasAvatar: false,
          url: null,
          expiresIn: 0,
        },
      });
    }

    if (!isOwnedAvatarPath(user.id, path)) {
      return errorResponse(
        language,
        "storageError",
        503
      );
    }

    const signedUrl =
      await createAvatarSignedUrl(path);

    return respond({
      success: true,
      message: TEXT[language].loaded,
      avatar: {
        hasAvatar: true,
        url: signedUrl,
        expiresIn: SIGNED_URL_SECONDS,
      },
    });
  } catch (error) {
    return handleError(error, language);
  }
}

/* ==========================================================
   POST — AJOUTER OU REMPLACER LA PHOTO

   URL :
   POST /api/organizer/settings/profile/avatar

   Content-Type :
   multipart/form-data

   Champ obligatoire :
   avatar

   Étapes :
   1. Vérifier la session
   2. Vérifier l'origine
   3. Lire le fichier
   4. Contrôler la taille
   5. Traiter l'image avec Sharp
   6. Télécharger sur Supabase Storage
   7. Mettre à jour User.avatarStorageKey
   8. Supprimer l'ancienne photo
   9. Retourner une nouvelle URL signée
========================================================== */

export async function POST(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    /* ------------------------------------------------------
       1. PROTECTION CSRF
    ------------------------------------------------------ */

    if (!isSameOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    /* ------------------------------------------------------
       2. CONTENT-TYPE
    ------------------------------------------------------ */

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("multipart/form-data;")
    ) {
      return errorResponse(
        language,
        "invalidContentType",
        415
      );
    }

    /* ------------------------------------------------------
       3. VÉRIFIER LA TAILLE DE LA REQUÊTE

       Cette limite doit également être
       configurée au niveau du proxy/hébergeur
       pour bloquer les uploads trop grands
       avant leur lecture en mémoire.
    ------------------------------------------------------ */

    const lengthHeader =
      request.headers.get("content-length");

    if (lengthHeader) {
      const length = Number(lengthHeader);

      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > MAX_REQUEST_SIZE
      ) {
        return errorResponse(
          language,
          "fileTooLarge",
          413
        );
      }
    }

    /* ------------------------------------------------------
       4. AUTHENTIFICATION
    ------------------------------------------------------ */

    const prisma = getPrisma();

    const user = await authenticateOrganizer(
      request,
      prisma
    );

    if (!user) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ------------------------------------------------------
       5. LIRE LA PHOTO
    ------------------------------------------------------ */

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      throw new ApiError("invalidImage", 400);
    }

    const files = formData.getAll("avatar");

    if (
      files.length !== 1 ||
      !(files[0] instanceof File)
    ) {
      throw new ApiError("fileRequired", 400);
    }

    const file = files[0];

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError("fileTooLarge", 413);
    }

    /* ------------------------------------------------------
       6. TRAITER L'IMAGE

       On n'enregistre pas le fichier
       original : uniquement la version
       WebP normalisée.
    ------------------------------------------------------ */

    const optimizedImage =
      await processAvatar(file);

    /* ------------------------------------------------------
       7. PRÉPARER LE STOCKAGE

       Le chemin est généré par le serveur,
       jamais à partir du nom de fichier fourni.
    ------------------------------------------------------ */

    const newPath =
      generateAvatarPath(user.id);

    const supabase = getStorage();

    const bucket = getBucketName();

    /* ------------------------------------------------------
       8. TÉLÉCHARGER LE FICHIER
    ------------------------------------------------------ */

    const { error: uploadError } =
      await supabase.storage
        .from(bucket)
        .upload(newPath, optimizedImage, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "[TIKEMIA AVATAR] Upload failed",
        uploadError.name
      );

      throw new ApiError("storageError", 503);
    }

    /* ------------------------------------------------------
       9. METTRE À JOUR POSTGRESQL

       Si la mise à jour échoue, supprimer
       le nouveau fichier pour éviter
       un stockage orphelin.
    ------------------------------------------------------ */

    let saved = false;

    try {
      saved = await updateAvatarInDatabase(
        prisma,
        user,
        newPath,
        "ORGANIZER_AVATAR_UPDATED"
      );
    } catch (error) {
      await removeStoredAvatar(
        newPath,
        user.id
      );

      throw error;
    }

    if (!saved) {
      await removeStoredAvatar(
        newPath,
        user.id
      );

      throw new ApiError("conflict", 409);
    }

    /* ------------------------------------------------------
       10. SUPPRIMER L'ANCIENNE PHOTO

       La référence de la nouvelle photo
       a déjà été enregistrée.

       Un échec de nettoyage de l'ancien
       fichier ne détruit pas la nouvelle photo.
    ------------------------------------------------------ */

    if (
      user.avatarStorageKey &&
      user.avatarStorageKey !== newPath
    ) {
      try {
        await removeStoredAvatar(
          user.avatarStorageKey,
          user.id
        );
      } catch {
        console.error(
          "[TIKEMIA AVATAR] Old image cleanup failed"
        );
      }
    }

    /* ------------------------------------------------------
       11. URL SIGNÉE

       Si Supabase ne peut pas générer
       l'URL immédiatement, la photo reste
       enregistrée. Le frontend pourra
       réessayer avec GET.
    ------------------------------------------------------ */

    let avatarUrl: string | null = null;

    try {
      avatarUrl = await createAvatarSignedUrl(
        newPath
      );
    } catch {
      console.error(
        "[TIKEMIA AVATAR] Signed URL unavailable after upload"
      );
    }

    /* ------------------------------------------------------
       12. CONFIRMATION
    ------------------------------------------------------ */

    return respond({
      success: true,
      message: TEXT[language].uploaded,

      avatar: {
        hasAvatar: true,
        url: avatarUrl,
        expiresIn:
          avatarUrl ? SIGNED_URL_SECONDS : 0,
      },
    });
  } catch (error) {
    return handleError(error, language);
  }
}

/* ==========================================================
   DELETE — SUPPRIMER LA PHOTO

   URL :
   DELETE /api/organizer/settings/profile/avatar

   La suppression :
   - Vide User.avatarStorageKey
   - Conserve les autres données utilisateur
   - Supprime le fichier Storage si possible
   - Retourne hasAvatar = false

   Le composant React affichera les initiales
   lorsque l'utilisateur n'a plus de photo.
========================================================== */

export async function DELETE(
  request: NextRequest
) {
  const language = getLanguage(request);

  try {
    /* ------------------------------------------------------
       1. ORIGINE
    ------------------------------------------------------ */

    if (!isSameOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    /* ------------------------------------------------------
       2. AUTHENTIFICATION
    ------------------------------------------------------ */

    const prisma = getPrisma();

    const user = await authenticateOrganizer(
      request,
      prisma
    );

    if (!user) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ------------------------------------------------------
       3. AUCUNE PHOTO EXISTANTE

       La suppression reste idempotente.
    ------------------------------------------------------ */

    if (!user.avatarStorageKey) {
      return respond({
        success: true,
        message: TEXT[language].noAvatar,

        avatar: {
          hasAvatar: false,
          url: null,
          expiresIn: 0,
        },
      });
    }

    /* ------------------------------------------------------
       4. SUPPRIMER LA RÉFÉRENCE EN BASE

       La mise à jour conditionnelle évite
       de supprimer une photo remplacée
       par une autre requête.
    ------------------------------------------------------ */

    const saved = await updateAvatarInDatabase(
      prisma,
      user,
      null,
      "ORGANIZER_AVATAR_DELETED"
    );

    if (!saved) {
      throw new ApiError("conflict", 409);
    }

    /* ------------------------------------------------------
       5. SUPPRIMER LE FICHIER DE STORAGE

       La photo n'est plus associée au profil.
       La suppression physique est tentée
       immédiatement.

       Un échec de nettoyage pourra être
       traité ultérieurement côté serveur.
    ------------------------------------------------------ */

    try {
      await removeStoredAvatar(
        user.avatarStorageKey,
        user.id
      );
    } catch {
      console.error(
        "[TIKEMIA AVATAR] Storage deletion failed"
      );
    }

    /* ------------------------------------------------------
       6. RÉPONSE
    ------------------------------------------------------ */

    return respond({
      success: true,
      message: TEXT[language].deleted,

      avatar: {
        hasAvatar: false,
        url: null,
        expiresIn: 0,
      },
    });
  } catch (error) {
    return handleError(error, language);
  }
}
