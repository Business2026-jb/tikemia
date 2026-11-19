import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { unstable_rethrow } from "next/navigation";

import "server-only";

import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

import {
  ScannerError,
  verifyAndScanTicket,
  type ScannerLanguage,
  type ScannerResponse,
} from "@/lib/scanner";

/**
 * ============================================================
 * TIKEMIA — API DE VALIDATION DES BILLETS
 * ============================================================
 *
 * Fichier :
 * src/app/api/organizer/scan/verify/route.ts
 *
 * Endpoint :
 * POST /api/organizer/scan/verify
 *
 * Responsabilités :
 *
 * 1. Authentifier l'utilisateur par sa session.
 * 2. Vérifier la validité des données reçues.
 * 3. Vérifier l'origine de la requête.
 * 4. Transmettre le QR au moteur de validation.
 * 5. Retourner immédiatement le résultat.
 *
 * Sécurité :
 *
 * - Aucun userId accepté depuis le navigateur.
 * - Vérification des sessions PostgreSQL.
 * - Cookies de session existants.
 * - Protection contre les requêtes cross-site.
 * - Corps JSON de taille limitée.
 * - Aucune fuite du QR dans les erreurs.
 * - Aucun cache HTTP.
 * - Validation atomique dans scanner.ts.
 *
 * Compatible :
 *
 * - Next.js App Router
 * - Prisma 7
 * - PostgreSQL
 * - Android / iPhone / PC
 * - FR / EN
 *
 * Aucun changement du schéma Prisma.
 * Aucun ajout de bibliothèque.
 *
 * ============================================================
 */



/* ============================================================
   CONFIGURATION
============================================================ */

const SESSION_COOKIE_NAME =
  process.env.TIKEMIA_SESSION_COOKIE_NAME ||
  "tikemia_organizer_session";

const MAX_BODY_BYTES = 2048;

const MAX_QR_LENGTH = 512;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",

  Vary: "Cookie, Accept-Language",
} as const;

/* ============================================================
   TYPES
============================================================ */

type JsonRecord = Record<string, unknown>;

type ScanRequestBody = {
  eventId: string;
  qrCode: string;
  locale: ScannerLanguage;
};

type AuthenticatedUser = {
  id: string;
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_ORIGIN"
  | "INVALID_CONTENT_TYPE"
  | "INVALID_REQUEST_BODY"
  | "INVALID_EVENT_ID"
  | "INVALID_QR_CODE"
  | "REQUEST_TOO_LARGE"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_AVAILABLE"
  | "SCAN_NOT_ALLOWED"
  | "QR_CONFIGURATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

/* ============================================================
   RÉPONSES HTTP
============================================================ */

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function fail(
  code: ApiErrorCode,
  status: number,
  locale: ScannerLanguage = "fr",
): NextResponse {
  const descriptions: Record<
    ApiErrorCode,
    { fr: string; en: string }
  > = {
    UNAUTHORIZED: {
      fr: "Votre session a expiré. Reconnectez-vous.",
      en: "Your session has expired. Please sign in again.",
    },

    FORBIDDEN: {
      fr: "Vous n'avez pas accès à cette opération.",
      en: "You do not have access to this operation.",
    },

    INVALID_ORIGIN: {
      fr: "Origine de la requête non autorisée.",
      en: "Request origin is not authorized.",
    },

    INVALID_CONTENT_TYPE: {
      fr: "Le format de la requête doit être JSON.",
      en: "The request must use JSON.",
    },

    INVALID_REQUEST_BODY: {
      fr: "Les données de la requête sont invalides.",
      en: "The request data is invalid.",
    },

    INVALID_EVENT_ID: {
      fr: "L'identifiant de l'événement est invalide.",
      en: "The event identifier is invalid.",
    },

    INVALID_QR_CODE: {
      fr: "Le QR code reçu est invalide.",
      en: "The received QR code is invalid.",
    },

    REQUEST_TOO_LARGE: {
      fr: "La requête dépasse la taille autorisée.",
      en: "The request exceeds the allowed size.",
    },

    EVENT_NOT_FOUND: {
      fr: "Événement introuvable.",
      en: "Event not found.",
    },

    EVENT_NOT_AVAILABLE: {
      fr: "Cet événement n'est pas disponible pour le scan.",
      en: "This event is not available for scanning.",
    },

    SCAN_NOT_ALLOWED: {
      fr: "Vous n'êtes pas autorisé à scanner cet événement.",
      en: "You are not authorized to scan this event.",
    },

    QR_CONFIGURATION_ERROR: {
      fr: "Le service de vérification QR est indisponible.",
      en: "The QR verification service is unavailable.",
    },

    DATABASE_UNAVAILABLE: {
      fr: "Vérification momentanément indisponible. Réessayez.",
      en: "Verification is temporarily unavailable. Please retry.",
    },

    INTERNAL_ERROR: {
      fr: "Une erreur est survenue pendant la vérification.",
      en: "An error occurred during verification.",
    },
  };

  return json(
    {
      success: false,
      allowed: false,
      code,
      message: descriptions[code][locale],
      scannedAt: new Date().toISOString(),
      ticket: null,
    },
    status,
  );
}

/* ============================================================
   VALIDATIONS
============================================================ */

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isUuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

function getLocale(
  request: NextRequest,
): ScannerLanguage {
  const language =
    request.headers.get("accept-language") || "";

  return language
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================================
   PROTECTION DE L'ORIGINE
============================================================ */

/**
 * Les appels du scanner sont effectués depuis
 * le même site TIKEMIA.
 *
 * Bloque les requêtes cross-site identifiables.
 *
 * Le contrôle d'origine complète les cookies
 * SameSite et les protections de session.
 */
function hasValidOrigin(
  request: NextRequest,
): boolean {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const requestOrigin =
      getTrustedRequestOrigin(request);

    const suppliedOrigin =
      new URL(origin).origin;

    return requestOrigin === suppliedOrigin;
  } catch {
    return false;
  }
}

/* ============================================================
   LECTURE LIMITÉE DU JSON
============================================================ */

/**
 * Lecture progressive avec une limite réelle.
 *
 * Ne dépend pas uniquement de Content-Length :
 * certains clients n'envoient pas cet en-tête.
 */
async function readLimitedJson(
  request: NextRequest,
): Promise<unknown> {
  const declaredLength = Number(
    request.headers.get("content-length") || "0",
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_BODY_BYTES
  ) {
    throw new ScannerError(
      "REQUEST_TOO_LARGE",
      413,
    );
  }

  if (!request.body) {
    throw new ScannerError(
      "INVALID_REQUEST_BODY",
      400,
    );
  }

  const reader = request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});

        throw new ScannerError(
          "REQUEST_TOO_LARGE",
          413,
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new ScannerError(
      "INVALID_REQUEST_BODY",
      400,
    );
  }

  const bytes = new Uint8Array(totalBytes);

  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder(
      "utf-8",
      { fatal: true },
    ).decode(bytes);

    return JSON.parse(text) as unknown;
  } catch {
    throw new ScannerError(
      "INVALID_REQUEST_BODY",
      400,
    );
  }
}

/* ============================================================
   ANALYSE DES DONNÉES
============================================================ */

/**
 * Format attendu :
 *
 * {
 *   "eventId": "UUID",
 *   "qrCode": "tkm1.UUID.signature",
 *   "locale": "fr"
 * }
 *
 * scannedById est interdit dans le JSON :
 * l'identité vient uniquement de la session.
 */
function parseScanBody(
  value: unknown,
  fallbackLocale: ScannerLanguage,
): ScanRequestBody {
  if (!isRecord(value)) {
    throw new ScannerError(
      "INVALID_REQUEST_BODY",
      400,
    );
  }

  const {
    eventId,
    qrCode,
    locale,
  } = value;

  if (!isUuid(eventId)) {
    throw new ScannerError(
      "INVALID_EVENT_ID",
      400,
    );
  }

  if (
    typeof qrCode !== "string" ||
    qrCode.length === 0 ||
    qrCode.length > MAX_QR_LENGTH
  ) {
    throw new ScannerError(
      "INVALID_QR_CODE",
      400,
    );
  }

  const selectedLocale: ScannerLanguage =
    locale === "fr" || locale === "en"
      ? locale
      : fallbackLocale;

  return {
    eventId,
    qrCode,
    locale: selectedLocale,
  };
}

/* ============================================================
   AUTHENTIFICATION
============================================================ */

/**
 * La session TIKEMIA contient un token brut
 * dans le cookie HTTP.
 *
 * PostgreSQL conserve uniquement :
 *
 * Session.tokenHash = SHA256(token)
 *
 * La session doit :
 * - Exister
 * - Ne pas être révoquée
 * - Ne pas être expirée
 * - Appartenir à un utilisateur actif
 * - Appartenir à un utilisateur non bloqué
 *
 * L'accès à l'événement sera ensuite vérifié
 * par verifyAndScanTicket().
 */
async function authenticateScanner(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(
    SESSION_COOKIE_NAME,
  )?.value;

  if (
    !token ||
    token.length < 32 ||
    token.length > 1024
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const prisma = getPlatformPrisma();

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },

      select: {
        expiresAt: true,
        revokedAt: true,

        user: {
          select: {
            id: true,
            isActive: true,
            isBlocked: true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  const now = new Date();

  if (
    session.revokedAt !== null ||
    session.expiresAt <= now
  ) {
    return null;
  }

  if (
    !session.user.isActive ||
    session.user.isBlocked
  ) {
    return null;
  }

  return {
    id: session.user.id,
  };
}

/* ============================================================
   GESTION DES ERREURS
============================================================ */

/**
 * Traduire les erreurs du moteur scanner
 * vers des réponses HTTP explicites.
 *
 * Un échec technique ne doit jamais produire
 * "Billet valide".
 */
function handleScannerError(
  error: unknown,
  locale: ScannerLanguage,
): NextResponse {
  if (error instanceof ScannerError) {
    switch (error.code) {
      case "INVALID_SCAN_REQUEST":
      case "INVALID_REQUEST_BODY":
        return fail(
          "INVALID_REQUEST_BODY",
          400,
          locale,
        );

      case "INVALID_QR_INPUT":
        return fail(
          "INVALID_QR_CODE",
          400,
          locale,
        );

      case "INVALID_EVENT_ID":
        return fail(
          "INVALID_EVENT_ID",
          400,
          locale,
        );

      case "REQUEST_TOO_LARGE":
        return fail(
          "REQUEST_TOO_LARGE",
          413,
          locale,
        );

      case "SCANNER_ACCESS_DENIED":
        return fail(
          "SCAN_NOT_ALLOWED",
          403,
          locale,
        );

      case "EVENT_NOT_FOUND":
        return fail(
          "EVENT_NOT_FOUND",
          404,
          locale,
        );

      case "EVENT_NOT_AVAILABLE_FOR_SCAN":
        return fail(
          "EVENT_NOT_AVAILABLE",
          409,
          locale,
        );

      case "QR_SECRET_NOT_CONFIGURED":
        return fail(
          "QR_CONFIGURATION_ERROR",
          503,
          locale,
        );

      default:
        break;
    }
  }

  /**
   * Les transactions concurrentes peuvent
   * produire un conflit temporaire.
   *
   * P2034 : conflit transactionnel / deadlock.
   * P2028 : transaction invalidée ou expirée.
   *
   * Ne jamais accepter un billet dans ce cas.
   */
  if (
    isRecord(error) &&
    (
      error.code === "P2034" ||
      error.code === "P2028"
    )
  ) {
    return fail(
      "DATABASE_UNAVAILABLE",
      503,
      locale,
    );
  }

  /**
   * Aucun QR, token de session ni détail
   * interne ne doit être journalisé.
   */
  console.error(
    "[TIKEMIA_SCAN_VERIFY]",
    error instanceof Error
      ? error.name
      : "UNKNOWN_ERROR",
  );

  return fail(
    "INTERNAL_ERROR",
    500,
    locale,
  );
}

/* ============================================================
   POST /api/organizer/scan/verify
============================================================ */

/**
 * Chaque appel correspond à une lecture QR.
 *
 * La caméra reste active côté navigateur.
 * L'API retourne le résultat après confirmation
 * de la transaction PostgreSQL.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const fallbackLocale = getLocale(request);

  try {
    /* ======================================================
       1. VÉRIFICATION DE L'ORIGINE
    ====================================================== */

    if (!hasValidOrigin(request)) {
      return fail(
        "INVALID_ORIGIN",
        403,
        fallbackLocale,
      );
    }

    /* ======================================================
       2. VÉRIFICATION DU CONTENT-TYPE
    ====================================================== */

    const contentType = (
      request.headers.get("content-type") || ""
    ).toLowerCase();

    if (
      !contentType.startsWith(
        "application/json",
      )
    ) {
      return fail(
        "INVALID_CONTENT_TYPE",
        415,
        fallbackLocale,
      );
    }

    /* ======================================================
       3. AUTHENTIFICATION DE L'AGENT
    ====================================================== */

    const authenticatedUser =
      await authenticateScanner(request);

    if (!authenticatedUser) {
      return fail(
        "UNAUTHORIZED",
        401,
        fallbackLocale,
      );
    }

    /* ======================================================
       4. LECTURE DU JSON
    ====================================================== */

    const rawBody =
      await readLimitedJson(request);

    const body = parseScanBody(
      rawBody,
      fallbackLocale,
    );

    /* ======================================================
       5. VALIDATION DU BILLET
    ====================================================== */

    /**
     * Le moteur scanner effectue :
     *
     * - Vérification des autorisations
     * - Vérification de l'événement
     * - Authentification du QR
     * - Recherche PostgreSQL
     * - Vérification du paiement
     * - Vérification du statut du billet
     * - Consommation atomique du billet
     * - Enregistrement dans TicketScan
     *
     * L'identité de l'agent est toujours
     * celle de la session authentifiée.
     */
    const result: ScannerResponse =
      await verifyAndScanTicket({
        eventId: body.eventId,

        scannedById:
          authenticatedUser.id,

        qrCode: body.qrCode,

        locale: body.locale,
      });

    /* ======================================================
       6. RÉPONSE IMMÉDIATE
    ====================================================== */

    /**
     * HTTP 200 pour les résultats métiers :
     *
     * VALID
     * ALREADY_USED
     * INVALID
     * WRONG_EVENT
     * CANCELLED
     * EXPIRED
     * BLOCKED
     * TRANSFERRED
     * TRANSFER_PENDING
     * UNPAID
     *
     * Cela permet à l'interface scanner
     * de traiter chaque réponse simplement,
     * même lorsque le billet est rejeté.
     */
    return json(
      {
        ...result,
        eventId: body.eventId,
      },
      200,
    );
  } catch (error) {
    unstable_rethrow(error);
    return handleScannerError(
      error,
      fallbackLocale,
    );
  }
}
