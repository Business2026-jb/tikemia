
import "server-only";

import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  runEmailWorker,
  type EmailWorkerResult,
} from "@/lib/email/worker";

/**
 * ============================================================
 * TIKEMIA — CRON EMAILS
 * ============================================================
 *
 * Fichier :
 * src/app/api/cron/emails/route.ts
 *
 * Endpoint :
 * GET /api/cron/emails
 *
 * Fonction :
 *
 * - Authentifier le déclenchement du cron.
 * - Exécuter le worker d'envoi des emails.
 * - Traiter les tâches en attente.
 * - Reprendre les erreurs temporaires.
 * - Retourner un bilan technique.
 *
 * Sécurité :
 *
 * - Exécution exclusivement côté serveur.
 * - Secret obligatoire.
 * - Aucun accès public.
 * - Aucun token transmis en URL.
 * - Aucun email ou QR exposé.
 * - Aucun paiement créé.
 * - Aucun paiement confirmé.
 * - Aucun billet créé dans cette route.
 *
 * Le worker vérifie les paiements en base
 * avant de produire les PDF et les emails.
 *
 * Compatible :
 *
 * - Next.js App Router
 * - PostgreSQL / Prisma
 * - Resend
 * - Vercel Cron ou ordonnanceur externe
 * - Français et anglais
 *
 * Aucun composant mobile ou PC n'est modifié.
 * ============================================================
 */

/* ============================================================
   CONFIGURATION NEXT.JS
============================================================ */




/**
 * Durée maximale demandée pour l'exécution.
 *
 * La limite réellement disponible dépend
 * de l'hébergeur et de son abonnement.
 */

export const maxDuration = 120;

/* ============================================================
   CONSTANTES
============================================================ */

const MIN_SECRET_LENGTH = 32;

const MAX_AUTH_HEADER_LENGTH = 4096;

const DEFAULT_BATCH_SIZE = 3;

const MAX_BATCH_SIZE = 10;

const MIN_BATCH_SIZE = 1;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",
} as const;

/* ============================================================
   TYPES
============================================================ */

type CronErrorCode =
  | "UNAUTHORIZED"
  | "CONFIGURATION_ERROR"
  | "WORKER_UNAVAILABLE";

type CronSuccessResponse = {
  success: true;

  service: "tikemia-email-cron";

  processed: number;

  sent: number;

  failed: number;

  retried: number;

  skipped: number;

  exhausted: number;

  completedAt: string;
};

type CronErrorResponse = {
  success: false;

  code: CronErrorCode;
};

/* ============================================================
   RÉPONSES JSON
============================================================ */

function jsonResponse(
  data:
    | CronSuccessResponse
    | CronErrorResponse,
  status: number
): NextResponse {
  return NextResponse.json(
    data,
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

/* ============================================================
   RÉPONSE D'ERREUR
============================================================ */

function errorResponse(
  code: CronErrorCode,
  status: number
): NextResponse {
  return jsonResponse(
    {
      success: false,
      code,
    },
    status
  );
}

/* ============================================================
   CONFIGURATION DU SECRET
============================================================ */

/**
 * Variable obligatoire :
 *
 * CRON_SECRET=
 *
 * Le secret doit être :
 *
 * - Aléatoire.
 * - Long d'au moins 32 caractères.
 * - Stocké uniquement côté serveur.
 * - Identique dans l'hébergeur et le cron.
 *
 * Ne jamais utiliser NEXT_PUBLIC_CRON_SECRET.
 */

function getCronSecret(): string | null {
  const secret =
    process.env.CRON_SECRET;

  if (
    typeof secret !== "string" ||
    secret.length < MIN_SECRET_LENGTH ||
    secret.length > 2048
  ) {
    return null;
  }

  return secret;
}

/* ============================================================
   COMPARAISON SÉCURISÉE
============================================================ */

/**
 * Les secrets sont comparés par hash.
 *
 * timingSafeEqual évite une comparaison
 * caractère par caractère susceptible
 * de révéler des informations de timing.
 */

function secureCompare(
  received: string,
  expected: string
): boolean {
  if (
    !received ||
    !expected ||
    received.length >
      MAX_AUTH_HEADER_LENGTH
  ) {
    return false;
  }

  const receivedHash =
    createHash("sha256")
      .update(received, "utf8")
      .digest();

  const expectedHash =
    createHash("sha256")
      .update(expected, "utf8")
      .digest();

  return timingSafeEqual(
    receivedHash,
    expectedHash
  );
}

/* ============================================================
   AUTHENTIFICATION DU CRON
============================================================ */

/**
 * En-tête attendu :
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Le secret n'est jamais accepté :
 *
 * - Dans les paramètres GET.
 * - Dans le corps JSON.
 * - Dans un cookie.
 *
 * Une requête sans secret correct est rejetée
 * avant toute connexion au worker.
 */

function isAuthorized(
  request: NextRequest,
  secret: string
): boolean {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    authorization.length >
      MAX_AUTH_HEADER_LENGTH
  ) {
    return false;
  }

  const match =
    /^Bearer ([^\s]+)$/i.exec(
      authorization
    );

  if (!match) {
    return false;
  }

  const suppliedSecret =
    match[1];

  return secureCompare(
    suppliedSecret,
    secret
  );
}

/* ============================================================
   CONFIGURATION DU LOT
============================================================ */

/**
 * Nombre d'emails traités par exécution.
 *
 * Variable facultative :
 *
 * TIKEMIA_EMAIL_CRON_BATCH_SIZE=3
 *
 * Le nombre est limité pour éviter de
 * générer trop de PDF simultanément.
 *
 * La valeur provient exclusivement
 * de l'environnement serveur.
 */

function getBatchSize(): number {
  const raw =
    process.env
      .TIKEMIA_EMAIL_CRON_BATCH_SIZE;

  if (!raw) {
    return DEFAULT_BATCH_SIZE;
  }

  if (!/^[0-9]+$/.test(raw)) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number(raw);

  if (
    !Number.isSafeInteger(parsed)
  ) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.max(
    MIN_BATCH_SIZE,
    Math.min(
      MAX_BATCH_SIZE,
      parsed
    )
  );
}

/* ============================================================
   EXÉCUTION DU WORKER
============================================================ */

/**
 * runEmailWorker :
 *
 * - Récupère les tâches en base.
 * - Contrôle les paiements confirmés.
 * - Génère les PDF si nécessaire.
 * - Appelle Resend.
 * - Enregistre les résultats.
 * - Gère les tentatives de reprise.
 *
 * Le cron ne réalise jamais lui-même
 * une confirmation financière.
 */

async function executeEmailWorker():
  Promise<EmailWorkerResult> {
  const batchSize =
    getBatchSize();

  return runEmailWorker({
    batchSize,
  });
}

/* ============================================================
   VALIDATION DU BILAN
============================================================ */

/**
 * Vérifie que le worker retourne un
 * bilan numérique cohérent.
 *
 * Aucun résultat partiel n'est transformé
 * en confirmation de livraison.
 */

function validWorkerResult(
  result: EmailWorkerResult
): boolean {
  const values = [
    result.processed,
    result.sent,
    result.failed,
    result.retried,
    result.skipped,
    result.exhausted,
  ];

  if (
    !values.every(
      (value) =>
        Number.isSafeInteger(value) &&
        value >= 0
    )
  ) {
    return false;
  }

  const total =
    result.sent +
    result.failed +
    result.retried +
    result.skipped +
    result.exhausted;

  return total === result.processed;
}

/* ============================================================
   GET /api/cron/emails
============================================================ */

/**
 * Compatible avec un cron HTTP.
 *
 * Le fournisseur doit envoyer :
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Une erreur technique entraîne un statut 503.
 *
 * Le bilan sent indique une acceptation par
 * Resend, pas nécessairement une livraison.
 */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  /* ========================================================
     VÉRIFICATION CONFIGURATION
  ======================================================== */

  const secret =
    getCronSecret();

  if (!secret) {
    console.error(
      "[TIKEMIA_EMAIL_CRON] CONFIGURATION_ERROR"
    );

    return errorResponse(
      "CONFIGURATION_ERROR",
      503
    );
  }

  /* ========================================================
     AUTHENTIFICATION
  ======================================================== */

  if (
    !isAuthorized(
      request,
      secret
    )
  ) {
    return errorResponse(
      "UNAUTHORIZED",
      401
    );
  }

  /* ========================================================
     EXÉCUTION
  ======================================================== */

  try {
    const result =
      await executeEmailWorker();

    if (
      !validWorkerResult(result)
    ) {
      throw new Error(
        "INVALID_WORKER_RESULT"
      );
    }

    /* ======================================================
       JOURNAL SERVEUR
    ====================================================== */

    console.info(
      "[TIKEMIA_EMAIL_CRON]",
      {
        processed:
          result.processed,

        sent:
          result.sent,

        failed:
          result.failed,

        retried:
          result.retried,

        skipped:
          result.skipped,

        exhausted:
          result.exhausted,
      }
    );

    /* ======================================================
       RÉPONSE
    ====================================================== */

    return jsonResponse(
      {
        success: true,

        service:
          "tikemia-email-cron",

        processed:
          result.processed,

        sent:
          result.sent,

        failed:
          result.failed,

        retried:
          result.retried,

        skipped:
          result.skipped,

        exhausted:
          result.exhausted,

        completedAt:
          new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    /**
     * Ne jamais journaliser :
     *
     * - La clé CRON_SECRET.
     * - La clé API Resend.
     * - Les adresses email.
     * - Les numéros de téléphone.
     * - Les QR codes.
     * - Les PDF.
     */

    console.error(
      "[TIKEMIA_EMAIL_CRON] WORKER_ERROR",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      "WORKER_UNAVAILABLE",
      503
    );
  }
}

/* ============================================================
   MÉTHODES HTTP NON AUTORISÉES
============================================================ */

/**
 * Seul GET est utilisé par l'ordonnanceur.
 *
 * Les autres méthodes ne peuvent pas
 * déclencher d'envoi d'email.
 */

function methodNotAllowed():
  NextResponse {
  return new NextResponse(
    null,
    {
      status: 405,

      headers: {
        ...RESPONSE_HEADERS,

        Allow: "GET, HEAD",
      },
    }
  );
}

export async function POST():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PATCH():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE():
  Promise<NextResponse> {
  return methodNotAllowed();
}
