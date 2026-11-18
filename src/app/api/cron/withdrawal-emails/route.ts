export const maxDuration = 120;
import { unstable_rethrow } from "next/navigation";
﻿
import "server-only";

import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  processWithdrawalEmailQueue,
} from "@/lib/withdrawals/email";

/**
 * ============================================================
 * TIKEMIA â€” CRON DES EMAILS DE RETRAIT
 * ============================================================
 *
 * FICHIER :
 * src/app/api/cron/withdrawal-emails/route.ts
 *
 * ENDPOINT :
 * GET /api/cron/withdrawal-emails
 *
 * SERVICE :
 * src/lib/withdrawals/email.ts
 *
 * FONCTIONNALITÃ‰S :
 *
 * 1. Authentifier le planificateur.
 * 2. VÃ©rifier le secret CRON_SECRET.
 * 3. Lire les tÃ¢ches d'emails de retrait.
 * 4. VÃ©rifier que les retraits sont terminÃ©s.
 * 5. Envoyer les emails en attente.
 * 6. RÃ©essayer les envois ayant Ã©chouÃ©.
 * 7. Ã‰viter les exÃ©cutions concurrentes
 *    sur une mÃªme tÃ¢che.
 * 8. Retourner un bilan du traitement.
 *
 * Les opÃ©rations de lecture PostgreSQL,
 * verrouillage, envoi Resend et audit
 * sont assurÃ©es par :
 *
 * processWithdrawalEmailQueue()
 *
 * AUCUNE modification des retraits.
 * AUCUN transfert bancaire automatique.
 * AUCUNE modification de Prisma.
 * AUCUN accÃ¨s public sans authentification.
 *
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
============================================================ */

/**
 * Nombre maximal de tÃ¢ches Ã  traiter
 * lors d'une exÃ©cution du cron.
 *
 * La limite du service email est 10.
 *
 * Valeur conservatrice : 5 emails
 * par exÃ©cution.
 */

const DEFAULT_BATCH_SIZE = 5;

const MAX_BATCH_SIZE = 10;

/**
 * Longueur minimale du secret.
 *
 * Utiliser une valeur alÃ©atoire
 * d'au moins 32 caractÃ¨res.
 */

const MIN_SECRET_LENGTH = 32;

/**
 * Taille maximale de l'en-tÃªte Authorization.
 */

const MAX_AUTH_HEADER_LENGTH = 512;

/**
 * Limite de longueur de requÃªte.
 */

const MAX_QUERY_LENGTH = 256;

/**
 * EntÃªtes pour Ã©viter toute mise en cache.
 */

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

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
  | "CRON_NOT_CONFIGURED"
  | "INVALID_REQUEST"
  | "PROCESSING_FAILED";

type BatchResult = {
  checked: number;
  sent: number;
  alreadySent: number;
  failed: number;
  skipped: number;
  notReady: number;
};

type CronSuccessResponse = {
  success: true;

  service: string;

  executedAt: string;

  durationMs: number;

  batchSize: number;

  result: BatchResult;
};

/* ============================================================
   RÃ‰PONSES
============================================================ */

function json(
  data: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(
    data,
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function errorResponse(
  code: CronErrorCode,
  status: number
): NextResponse {
  return json(
    {
      success: false,
      code,
    },
    status
  );
}

/* ============================================================
   COMPARAISON SÃ‰CURISÃ‰E
============================================================ */

/**
 * Comparaison en temps constant.
 *
 * Les secrets ne sont jamais :
 *
 * - AffichÃ©s dans les logs.
 * - RetournÃ©s en JSON.
 * - Transmis au navigateur.
 */

function secureCompare(
  supplied: string,
  expected: string
): boolean {
  const suppliedBuffer =
    Buffer.from(
      supplied,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    suppliedBuffer,
    expectedBuffer
  );
}

/* ============================================================
   VÃ‰RIFICATION DU SECRET CRON
============================================================ */

/**
 * Authentification attendue :
 *
 * Authorization: Bearer CRON_SECRET
 *
 * Le secret doit Ãªtre configurÃ©
 * dans les variables d'environnement
 * du serveur TIKEMIA.
 *
 * Aucun jeton provenant d'un cookie
 * utilisateur ne permet d'appeler le cron.
 *
 * Aucun paramÃ¨tre ?secret= n'est acceptÃ©.
 */

function authenticateCron(
  request: NextRequest
):
  | "AUTHORIZED"
  | "UNAUTHORIZED"
  | "NOT_CONFIGURED" {
  const configuredSecret =
    process.env.CRON_SECRET;

  if (
    !configuredSecret ||
    configuredSecret.length <
      MIN_SECRET_LENGTH
  ) {
    return "NOT_CONFIGURED";
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    authorization.length >
      MAX_AUTH_HEADER_LENGTH
  ) {
    return "UNAUTHORIZED";
  }

  const prefix = "Bearer ";

  if (
    !authorization.startsWith(
      prefix
    )
  ) {
    return "UNAUTHORIZED";
  }

  const suppliedSecret =
    authorization.slice(
      prefix.length
    );

  if (
    !suppliedSecret ||
    !secureCompare(
      suppliedSecret,
      configuredSecret
    )
  ) {
    return "UNAUTHORIZED";
  }

  return "AUTHORIZED";
}

/* ============================================================
   PARAMÃˆTRES AUTORISÃ‰S
============================================================ */

/**
 * Exemple :
 *
 * GET /api/cron/withdrawal-emails
 *
 * ou :
 *
 * GET /api/cron/withdrawal-emails?limit=5
 *
 * La limite ne peut pas dÃ©passer 10.
 *
 * Aucun autre paramÃ¨tre acceptÃ©.
 */

function parseBatchSize(
  request: NextRequest
): number | null {
  if (
    request.nextUrl.search.length >
    MAX_QUERY_LENGTH
  ) {
    return null;
  }

  const params =
    request.nextUrl.searchParams;

  for (
    const key of params.keys()
  ) {
    if (key !== "limit") {
      return null;
    }

    if (
      params.getAll(key).length !== 1
    ) {
      return null;
    }
  }

  const value =
    params.get("limit");

  if (value === null) {
    return DEFAULT_BATCH_SIZE;
  }

  if (
    !/^[1-9][0-9]*$/.test(
      value
    )
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_BATCH_SIZE
  ) {
    return null;
  }

  return parsed;
}

/* ============================================================
   TRAITEMENT CRON
============================================================ */

/**
 * Fonction centrale partagÃ©e par GET et POST.
 *
 * Le GET permet l'exÃ©cution programmÃ©e.
 *
 * Le POST permet Ã©galement un dÃ©clenchement
 * serveur authentifiÃ© avec le mÃªme secret.
 *
 * Aucun appel anonyme.
 */

async function executeCron(
  request: NextRequest
): Promise<NextResponse> {
  /* ==========================================================
     1. AUTHENTIFICATION
  ========================================================== */

  const auth =
    authenticateCron(request);

  if (
    auth === "NOT_CONFIGURED"
  ) {
    return errorResponse(
      "CRON_NOT_CONFIGURED",
      503
    );
  }

  if (
    auth !== "AUTHORIZED"
  ) {
    return errorResponse(
      "UNAUTHORIZED",
      401
    );
  }

  /* ==========================================================
     2. VALIDATION
  ========================================================== */

  const batchSize =
    parseBatchSize(request);

  if (
    batchSize === null
  ) {
    return errorResponse(
      "INVALID_REQUEST",
      400
    );
  }

  /* ==========================================================
     3. EXÃ‰CUTION DU SERVICE EMAIL
  ========================================================== */

  const startedAt =
    Date.now();

  try {
    const result =
      await processWithdrawalEmailQueue({
        limit: batchSize,
      });

    /* ========================================================
       4. BILAN
    ======================================================== */

    const durationMs =
      Date.now() - startedAt;

    const response:
      CronSuccessResponse = {
        success: true,

        service:
          "tikemia-withdrawal-emails",

        executedAt:
          new Date().toISOString(),

        durationMs,

        batchSize,

        result: {
          checked:
            result.checked,

          sent:
            result.sent,

          alreadySent:
            result.alreadySent,

          failed:
            result.failed,

          skipped:
            result.skipped,

          notReady:
            result.notReady,
        },
      };

    return json(
      response as unknown as Record<string, unknown>,
      200
    );
  } catch (error) {
    unstable_rethrow(error);
    /*
     * Ne jamais afficher :
     *
     * - La clÃ© Resend
     * - Le secret cron
     * - Les destinataires
     * - Les coordonnÃ©es bancaires
     * - Le contenu des emails
     */

    console.error(
      "[TIKEMIA_WITHDRAWAL_EMAIL_CRON]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      "PROCESSING_FAILED",
      503
    );
  }
}

/* ============================================================
   GET
============================================================ */

/**
 * UtilisÃ© par le planificateur automatique.
 *
 * Exemple :
 *
 * GET /api/cron/withdrawal-emails
 *
 * Authorization: Bearer CRON_SECRET
 */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  return executeCron(
    request
  );
}

/* ============================================================
   POST
============================================================ */

/**
 * DÃ©clenchement serveur manuel Ã©ventuel.
 *
 * MÃªme protection que GET.
 *
 * Aucun corps JSON nÃ©cessaire.
 */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  return executeCron(
    request
  );
}

/* ============================================================
   MÃ‰THODES NON AUTORISÃ‰ES
============================================================ */

function methodNotAllowed():
  NextResponse {
  return new NextResponse(
    null,
    {
      status: 405,

      headers: {
        ...RESPONSE_HEADERS,

        Allow:
          "GET, HEAD, POST",
      },
    }
  );
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

