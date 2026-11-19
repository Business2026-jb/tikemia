import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { unstable_rethrow } from "next/navigation";
﻿
import "server-only";

import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
import { readFile, lstat, realpath } from "node:fs/promises";
import { after } from "next/server";
import { processWithdrawalEmailQueue } from "@/lib/withdrawals/email";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { getPlatformPrisma } from "@/lib/payments/fulfillment";

/**
 * ==========================================================
 * TIKEMIA — ADMINISTRATION DES RETRAITS
 * ==========================================================
 *
 * FICHIER :
 * src/app/api/admin/withdrawals/[id]/route.ts
 *
 * GET :
 * Consulter les informations complètes d'un retrait.
 *
 * PATCH :
 * Confirmer définitivement un retrait après paiement
 * manuel et téléversement d'une preuve.
 *
 * Le transfert financier est effectué PAR L'ADMIN.
 * Cette API ne déclenche aucun virement.
 *
 * Modèles PostgreSQL existants :
 * - Session
 * - User / UserRole
 * - Organization
 * - Payout
 * - PayoutDestination
 * - AuditLog
 * - Notification
 *
 * Preuves :
 * Stockage privé sur disque persistant.
 *
 * Emails :
 * File indépendante WITHDRAWAL_EMAIL_QUEUED.
 *
 * Aucune modification de schema.prisma.
 * Aucun S3 / Cloudflare R2.
 * Aucun changement des emails existants.
 * ==========================================================
 */


/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE =
  "tikemia_admin_session";

const PROOF_ACTION = "WITHDRAWAL_PROOF_UPLOADED";
const COMPLETE_ACTION = "WITHDRAWAL_COMPLETED";
const EMAIL_QUEUE_ACTION = "WITHDRAWAL_EMAIL_QUEUED";

const MAX_PROOF_SIZE = 10 * 1024 * 1024;
const MAX_JSON_SIZE = 2048;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHA256_REGEX = /^[a-f0-9]{64}$/i;

const FINAL_STATUSES = [
  "COMPLETED",
  "FAILED",
  "REJECTED",
  "CANCELLED",
] as const;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
};

/**
 * Le répertoire doit être privé et PERSISTANT.
 *
 * Sur un serveur VPS :
 * /var/lib/tikemia/withdrawal-proofs
 *
 * En développement, par défaut :
 * <projet>/private/withdrawal-proofs
 *
 * Les routes /proof et [id] doivent utiliser
 * exactement la même configuration.
 *
 * Ne pas utiliser public/ pour ces fichiers.
 */
// Proofs are created at runtime on private persistent storage, never bundled.
const PROOF_ROOT = path.resolve(/* turbopackIgnore: true */ 
  process.env.TIKEMIA_WITHDRAWALS_PROOF_DIR ||
    path.join(process.cwd(), "private", "withdrawal-proofs")
);

/* ==========================================================
   TYPES
========================================================== */

type Context = {
  params: Promise<{ id: string }>;
};

type Admin = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_ORIGIN"
  | "INVALID_REQUEST"
  | "INVALID_WITHDRAWAL_ID"
  | "WITHDRAWAL_NOT_FOUND"
  | "ALREADY_COMPLETED"
  | "INVALID_TRANSITION"
  | "DESTINATION_MISMATCH"
  | "DESTINATION_UNAVAILABLE"
  | "DESTINATION_NOT_VERIFIED"
  | "PROOF_REQUIRED"
  | "INVALID_PROOF"
  | "STORAGE_ERROR"
  | "DECRYPTION_UNAVAILABLE"
  | "DATABASE_ERROR";

type AccountDetails = {
  accountRef: string;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  branchCode: string | null;
  mobileMoneyNumber: string | null;
  walletAddress: string | null;
  additionalInformation: string | null;
};

type ProofMetadata = {
  storageKey: string;
  sha256: string;
  mimeType: string;
  size: number;
  amountMinor: string;
  currency: string;
  destinationId: string;
  uploadedBy: string;
};

type ProofRecord = {
  id: string;
  actorId: string;
  createdAt: Date;
  metadata: ProofMetadata;
};

type PayoutForProof = {
  id: string;
  amount: bigint;
  currency: string;
  destinationId: string;
  requestedAt: Date;
};

type ConfirmationPayload = {
  action: "confirm";
};

/* ==========================================================
   ERREURS ET RÉPONSES
========================================================== */

class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public httpStatus: number
  ) {
    super(code);
    this.name = "ApiError";
  }
}

function response(
  body: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: HEADERS,
  });
}

function errorResponse(
  code: ApiErrorCode,
  status: number
): NextResponse {
  return response(
    {
      success: false,
      code,
    },
    status
  );
}

function handleError(
  error: unknown,
  operation: string
): NextResponse {
  unstable_rethrow(error);
  if (error instanceof ApiError) {
    return errorResponse(error.code, error.httpStatus);
  }

  console.error(
    `[TIKEMIA_WITHDRAWALS_${operation}]`,
    error instanceof Error ? error.name : "UNKNOWN_ERROR"
  );

  return errorResponse("DATABASE_ERROR", 503);
}

/* ==========================================================
   VALIDATION DES DONNÉES
========================================================== */

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown,
  max = 500
): string | null {
  if (typeof value !== "string") return null;

  const result = value.trim();

  return result.length > 0 && result.length <= max
    ? result
    : null;
}

function isFinalStatus(status: string): boolean {
  return FINAL_STATUSES.some((item) => item === status);
}

function parsePayload(value: unknown): ConfirmationPayload | null {
  if (!isRecord(value)) return null;

  const keys = Object.keys(value);

  if (keys.length !== 1 || value.action !== "confirm") {
    return null;
  }

  return { action: "confirm" };
}

/* ==========================================================
   SESSION ADMINISTRATEUR
========================================================== */

/**
 * Contrat de session déjà utilisé dans les
 * API admin fournies précédemment.
 *
 * Cookie : tikemia_admin_session
 * Stockage : SHA-256 du token dans Session.tokenHash
 *
 * IMPORTANT :
 * Si la connexion actuelle de TIKEMIA utilise
 * une autre fonction d'authentification, il faut
 * réutiliser celle-ci à la place.
 */

async function authenticateAdmin(
  request: NextRequest
): Promise<Admin | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(Buffer.from(token, "hex"))
    .digest("hex");

  const prisma = getPlatformPrisma();

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      revokedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          isActive: true,
          isBlocked: true,
          roles: {
            where: {
              role: {
                in: ["ADMIN", "SUPER_ADMIN"],
              },
            },
            select: { role: true },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  const user = session.user;

  if (!user || !user.isActive || user.isBlocked) {
    return null;
  }

  if (user.roles.some((role) => role.role === "SUPER_ADMIN")) {
    return {
      id: user.id,
      role: "SUPER_ADMIN",
    };
  }

  if (user.roles.some((role) => role.role === "ADMIN")) {
    return {
      id: user.id,
      role: "ADMIN",
    };
  }

  return null;
}

/* ==========================================================
   SÉCURITÉ PATCH
========================================================== */

function validOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) return false;

  try {
    return new URL(origin).origin === getTrustedRequestOrigin(request);
  } catch {
    return false;
  }
}

/* ==========================================================
   DÉCHIFFREMENT DES COORDONNÉES
========================================================== */

/**
 * Contrat conservé du fichier transmis :
 *
 * AES-256-GCM
 * v1:iv:tag:ciphertext
 *
 * Clé :
 * TIKEMIA_WITHDRAWAL_DESTINATION_KEY
 *
 * ATTENTION :
 * Ce contrat doit être identique au chiffrement
 * déjà utilisé quand l'organisateur enregistre
 * son moyen de retrait.
 *
 * Ne jamais envoyer la clé au navigateur.
 */

function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ApiError("DECRYPTION_UNAVAILABLE", 503);
  }

  return Buffer.from(value, "base64url");
}

function decryptAccount(encrypted: string, destinationType: string): AccountDetails {
  const keys: Buffer[] = [];
  const configured = process.env.TIKEMIA_PAYOUT_ENCRYPTION_KEY;
  if (configured) { const key = Buffer.from(configured, "base64"); if (key.length === 32) keys.push(key); }
  const legacy = process.env.TIKEMIA_WITHDRAWAL_DESTINATION_KEY;
  if (legacy && /^[a-f0-9]{64}$/i.test(legacy)) keys.push(Buffer.from(legacy, "hex"));
  const parts = encrypted.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new ApiError("DECRYPTION_UNAVAILABLE", 503);
  const iv = decodeBase64Url(parts[1]), tag = decodeBase64Url(parts[2]), ciphertext = decodeBase64Url(parts[3]);
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0 || ciphertext.length > 16384) throw new ApiError("DECRYPTION_UNAVAILABLE", 503);
  for (const key of keys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const decoded: unknown = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
      if (!isRecord(decoded)) continue;
      const accountRef = cleanString(decoded.reference ?? decoded.accountRef, 300);
      if (!accountRef) continue;
      return {
        accountRef,
        iban: cleanString(decoded.iban) ?? (destinationType === "BANK_ACCOUNT" && /^[A-Z]{2}[0-9]{2}/.test(accountRef) ? accountRef : null),
        bic: cleanString(decoded.bic), swift: cleanString(decoded.swift),
        accountNumber: cleanString(decoded.accountNumber),
        bankCode: cleanString(decoded.routingCode ?? decoded.bankCode),
        branchCode: cleanString(decoded.branchCode),
        mobileMoneyNumber: cleanString(decoded.mobileMoneyNumber) ?? (destinationType === "MOBILE_MONEY" ? accountRef : null),
        walletAddress: cleanString(decoded.walletAddress) ?? (destinationType === "CRYPTO" ? accountRef : null),
        additionalInformation: cleanString(decoded.additionalInformation, 1000),
      };
    } catch { /* A legacy key may still be required for older destinations. */ }
  }
  throw new ApiError("DECRYPTION_UNAVAILABLE", 503);
}

/* ==========================================================
   RECHERCHER UNE PREUVE
========================================================== */

/**
 * La route /proof enregistre :
 *
 * AuditLog.action = WITHDRAWAL_PROOF_UPLOADED
 * AuditLog.entity = Payout
 * AuditLog.entityId = identifiant du retrait
 *
 * AuditLog.metadata :
 * {
 *   storageKey,
 *   sha256,
 *   mimeType,
 *   size,
 *   amountMinor,
 *   currency,
 *   destinationId,
 *   uploadedBy
 * }
 */

function parseProofMetadata(
  value: unknown
): ProofMetadata | null {
  if (!isRecord(value)) return null;

  const storageKey = cleanString(value.storageKey, 1000);
  const sha256 = cleanString(value.sha256, 64);
  const mimeType = cleanString(value.mimeType, 100);
  const amountMinor = cleanString(value.amountMinor, 100);
  const currency = cleanString(value.currency, 3);
  const destinationId = cleanString(value.destinationId, 36);
  const uploadedBy = cleanString(value.uploadedBy, 36);

  const size = value.size;

  if (
    !storageKey ||
    !sha256 ||
    !SHA256_REGEX.test(sha256) ||
    !mimeType ||
    !ALLOWED_MIME_TYPES.some((allowed) => allowed === mimeType) ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_PROOF_SIZE ||
    !amountMinor ||
    !/^[0-9]+$/.test(amountMinor) ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency) ||
    !isUuid(destinationId) ||
    !isUuid(uploadedBy)
  ) {
    return null;
  }

  return {
    storageKey,
    sha256,
    mimeType,
    size,
    amountMinor,
    currency,
    destinationId,
    uploadedBy,
  };
}

async function findLatestProof(
  payoutId: string
): Promise<ProofRecord | null> {
  const prisma = getPlatformPrisma();

  const row = await prisma.auditLog.findFirst({
    where: {
      entity: "Payout",
      entityId: payoutId,
      action: PROOF_ACTION,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      actorId: true,
      createdAt: true,
      metadata: true,
    },
  });

  if (!row || !row.actorId) return null;

  const metadata = parseProofMetadata(row.metadata);

  if (!metadata || metadata.uploadedBy !== row.actorId) {
    return null;
  }

  return {
    id: row.id,
    actorId: row.actorId,
    createdAt: row.createdAt,
    metadata,
  };
}

function proofMatchesPayout(
  proof: ProofRecord,
  payout: PayoutForProof
): boolean {
  return (
    proof.metadata.amountMinor === payout.amount.toString() &&
    proof.metadata.currency === payout.currency &&
    proof.metadata.destinationId === payout.destinationId &&
    proof.createdAt.getTime() >= payout.requestedAt.getTime()
  );
}

/* ==========================================================
   STOCKAGE PRIVÉ — CHEMIN SÉCURISÉ
========================================================== */

/**
 * Exemple de storageKey :
 *
 * withdrawals/UUID_RETRAIT/UUID_FICHIER.pdf
 *
 * Chemin physique :
 *
 * PROOF_ROOT/withdrawals/UUID_RETRAIT/UUID_FICHIER.pdf
 *
 * L'utilisateur ne peut pas fournir librement
 * un chemin du serveur.
 */

function resolveProofPath(
  payoutId: string,
  storageKey: string
): string {
  if (!isUuid(payoutId)) {
    throw new ApiError("INVALID_PROOF", 409);
  }

  const normalized = storageKey.replace(/\\/g, "/");

  const match = normalized.match(
    /^withdrawals\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(pdf|jpg|jpeg|png|webp)$/i
  );

  if (
    !match ||
    !isUuid(match[1]) ||
    !isUuid(match[2]) ||
    match[1].toLowerCase() !== payoutId.toLowerCase()
  ) {
    throw new ApiError("INVALID_PROOF", 409);
  }

  const absolutePath = path.resolve(
    PROOF_ROOT,
    ...normalized.split("/")
  );

  if (!absolutePath.startsWith(PROOF_ROOT + path.sep)) {
    throw new ApiError("INVALID_PROOF", 409);
  }

  return absolutePath;
}

/* ==========================================================
   VÉRIFIER LE FICHIER RÉEL
========================================================== */

/**
 * Le dépôt d'une trace dans AuditLog ne suffit pas.
 * On vérifie que la photo/PDF est réellement
 * enregistré et que son empreinte correspond.
 *
 * Cette vérification ne remplace pas le contrôle
 * manuel du virement par l'administrateur.
 */

async function verifyStoredProof(
  payoutId: string,
  proof: ProofRecord
): Promise<boolean> {
  const filePath = resolveProofPath(
    payoutId,
    proof.metadata.storageKey
  );

  let fileStats;

  try {
    const publicDirectory = path.resolve(process.cwd(), "public");
    const realFile = await realpath(/* turbopackIgnore: true */ filePath);
    const realRoot = await realpath(/* turbopackIgnore: true */ PROOF_ROOT);
    if (realRoot === publicDirectory || realRoot.startsWith(publicDirectory + path.sep) || !realFile.startsWith(realRoot + path.sep)) return false;
    fileStats = await lstat(/* turbopackIgnore: true */ filePath);
  } catch {
    return false;
  }

  if (
    !fileStats.isFile() ||
    fileStats.size !== proof.metadata.size ||
    fileStats.size <= 0 ||
    fileStats.size > MAX_PROOF_SIZE
  ) {
    return false;
  }

  let contents: Buffer;

  try {
    contents = await readFile(/* turbopackIgnore: true */ filePath);
  } catch {
    return false;
  }

  if (contents.length !== proof.metadata.size) {
    return false;
  }

  const actualHash = createHash("sha256")
    .update(contents)
    .digest();

  const expectedHash = Buffer.from(
    proof.metadata.sha256,
    "hex"
  );

  if (
    expectedHash.length !== actualHash.length ||
    !timingSafeEqual(actualHash, expectedHash)
  ) {
    return false;
  }

  return true;
}

/* ==========================================================
   GET — CONSULTER UN RETRAIT
========================================================== */

export async function GET(
  request: NextRequest,
  context: Context
): Promise<NextResponse> {
  try {
    const admin = await authenticateAdmin(request);

    if (!admin) {
      return errorResponse("UNAUTHORIZED", 401);
    }

    const { id } = await context.params;

    if (!isUuid(id)) {
      return errorResponse("INVALID_WITHDRAWAL_ID", 400);
    }

    const prisma = getPlatformPrisma();

    const payout = await prisma.payout.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        purpose: true,
        status: true,
        amount: true,
        currency: true,
        providerRef: true,
        organizationId: true,
        destinationId: true,
        requestedAt: true,
        completedAt: true,
        updatedAt: true,

        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneE164: true,
            countryCode: true,
            city: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },

        destination: {
          select: {
            id: true,
            organizationId: true,
            provider: true,
            type: true,
            accountName: true,
            accountRefEncrypted: true,
            maskedAccountRef: true,
            bankName: true,
            countryCode: true,
            currency: true,
            label: true,
            assetCode: true,
            networkCode: true,
            isVerified: true,
            isActive: true,
            deletedAt: true,
          },
        },

        event: {
          select: {
            id: true,
            title: true,
          },
        },

        campaign: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!payout) {
      return errorResponse("WITHDRAWAL_NOT_FOUND", 404);
    }

    const destination = payout.destination;

    if (
      destination.organizationId !== payout.organizationId ||
      destination.id !== payout.destinationId
    ) {
      return errorResponse("DESTINATION_MISMATCH", 409);
    }

    // Déchiffrement uniquement pour l'admin authentifié.
    const accountDetails = decryptAccount(
      destination.accountRefEncrypted, destination.type
    );

    const [proof, history] = await Promise.all([
      findLatestProof(id),

      prisma.auditLog.findMany({
        where: {
          entity: "Payout",
          entityId: id,
          action: {
            startsWith: "WITHDRAWAL_",
          },
        },
        select: {
          id: true,
          action: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      }),
    ]);

    const proofMatches =
      proof !== null && proofMatchesPayout(proof, payout);

    const destinationValid =
      destination.organizationId === payout.organizationId &&
      destination.currency === payout.currency &&
      destination.isActive &&
      destination.isVerified &&
      destination.deletedAt === null;

    const canConfirm =
      !isFinalStatus(payout.status) &&
      destinationValid &&
      proofMatches;

    const source = payout.event
      ? {
          type: "EVENT",
          id: payout.event.id,
          title: payout.event.title,
        }
      : payout.campaign
        ? {
            type: "CAMPAIGN",
            id: payout.campaign.id,
            title: payout.campaign.title,
          }
        : {
            type: "UNSPECIFIED",
            id: null,
            title: null,
          };

    const owner = payout.organization.owner;

    return response({
      success: true,

      data: {
        id: payout.id,
        reference: payout.reference,
        purpose: payout.purpose,
        status: payout.status,

        amountMinor: payout.amount.toString(),
        currency: payout.currency,

        providerRef: payout.providerRef,
        requestedAt: payout.requestedAt.toISOString(),
        completedAt: payout.completedAt?.toISOString() ?? null,
        updatedAt: payout.updatedAt.toISOString(),

        organizer: {
          id: payout.organization.id,
          name: payout.organization.name,
          email: payout.organization.email ?? owner.email,
          phoneE164:
            payout.organization.phoneE164 ??
            owner.phoneE164,
          countryCode: payout.organization.countryCode,
          city: payout.organization.city,

          owner: {
            id: owner.id,
            fullName: owner.fullName,
            email: owner.email,
            phoneE164: owner.phoneE164,
          },
        },

        destination: {
          id: destination.id,
          provider: destination.provider,
          type: destination.type,
          accountName: destination.accountName,
          countryCode: destination.countryCode,
          currency: destination.currency,
          bankName: destination.bankName,
          label: destination.label,
          assetCode: destination.assetCode,
          networkCode: destination.networkCode,
          maskedAccountRef: destination.maskedAccountRef,
          isVerified: destination.isVerified,
          isActive: destination.isActive,

          // Données complètes visibles uniquement par l'admin.
          accountDetails,
        },

        source,

        proof: {
          uploaded: proof !== null,
          id: proof?.id ?? null,
          mimeType: proof?.metadata.mimeType ?? null,
          uploadedAt: proof?.createdAt.toISOString() ?? null,
          matchesWithdrawal: proofMatches,

          downloadUrl: proofMatches
            ? `/api/admin/withdrawals/${id}/proof`
            : null,
        },

        canConfirm,

        history: history.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt.toISOString(),
        })),

        refreshedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return handleError(error, "GET");
  }
}

/* ==========================================================
   PATCH — CONFIRMER DÉFINITIVEMENT UN RETRAIT
========================================================== */

/**
 * Corps JSON attendu :
 *
 * {
 *   "action": "confirm"
 * }
 *
 * Conditions :
 *
 * - Administrateur connecté
 * - Retrait non clôturé
 * - Destination vérifiée
 * - Preuve PDF/image enregistrée
 * - Fichier réellement accessible
 * - Empreinte SHA-256 correcte
 *
 * Après validation :
 *
 * Payout.status = COMPLETED
 * Payout.completedAt = maintenant
 *
 * Notification organisateur créée.
 * Tâche d'email créée.
 *
 * Aucune transaction bancaire automatique.
 */

export async function PATCH(
  request: NextRequest,
  context: Context
): Promise<NextResponse> {
  try {
    const admin = await authenticateAdmin(request);

    if (!admin) {
      return errorResponse("UNAUTHORIZED", 401);
    }

    if (!validOrigin(request)) {
      return errorResponse("INVALID_ORIGIN", 403);
    }

    const { id } = await context.params;

    if (!isUuid(id)) {
      return errorResponse("INVALID_WITHDRAWAL_ID", 400);
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().startsWith("application/json")) {
      return errorResponse("INVALID_REQUEST", 415);
    }

    const contentLength = request.headers.get("content-length");

    if (
      contentLength &&
      (
        !/^\d+$/.test(contentLength) ||
        Number(contentLength) > MAX_JSON_SIZE
      )
    ) {
      return errorResponse("INVALID_REQUEST", 413);
    }

    const raw = await readBoundedJson(request);
    if (raw === null) { return errorResponse("INVALID_REQUEST", 413); }

    if (Buffer.byteLength(raw, "utf8") > MAX_JSON_SIZE) {
      return errorResponse("INVALID_REQUEST", 413);
    }

    let input: unknown;

    try {
      input = JSON.parse(raw);
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const payload = parsePayload(input);

    if (!payload) {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const prisma = getPlatformPrisma();

    /* -------------------------------------------------------
       1. VÉRIFIER LE RETRAIT
    ------------------------------------------------------- */

    const initialPayout = await prisma.payout.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        destinationId: true,
        requestedAt: true,
      },
    });

    if (!initialPayout) {
      return errorResponse("WITHDRAWAL_NOT_FOUND", 404);
    }

    if (initialPayout.status === "COMPLETED") {
      return errorResponse("ALREADY_COMPLETED", 409);
    }

    if (isFinalStatus(initialPayout.status)) {
      return errorResponse("INVALID_TRANSITION", 409);
    }

    /* -------------------------------------------------------
       2. RETROUVER LA PREUVE
    ------------------------------------------------------- */

    const proof = await findLatestProof(id);

    if (!proof) {
      return errorResponse("PROOF_REQUIRED", 409);
    }

    if (!proofMatchesPayout(proof, initialPayout)) {
      return errorResponse("INVALID_PROOF", 409);
    }

    /* -------------------------------------------------------
       3. VÉRIFIER LE FICHIER RÉEL
    ------------------------------------------------------- */

    const proofValid = await verifyStoredProof(id, proof);

    if (!proofValid) {
      return errorResponse("INVALID_PROOF", 409);
    }

    /* -------------------------------------------------------
       4. CONFIRMATION EN TRANSACTION POSTGRESQL
    ------------------------------------------------------- */

    const result = await prisma.$transaction(
      async (tx) => {
        /**
         * Verrouille le retrait pour éviter que
         * deux administrateurs le valident
         * simultanément.
         */

        const locked = await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "Payout"
          WHERE "id" = ${id}::uuid
          FOR UPDATE
        `;

        if (locked.length !== 1) {
          throw new ApiError("WITHDRAWAL_NOT_FOUND", 404);
        }

        const payout = await tx.payout.findUnique({
          where: { id },
          select: {
            id: true,
            reference: true,
            status: true,
            amount: true,
            currency: true,
            requestedAt: true,
            organizationId: true,
            destinationId: true,

            destination: {
              select: {
                id: true,
                organizationId: true,
                currency: true,
                isVerified: true,
                isActive: true,
                deletedAt: true,
              },
            },

            organization: {
              select: {
                id: true,
                name: true,

                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    preferredLocale: true,
                  },
                },
              },
            },
          },
        });

        if (!payout) {
          throw new ApiError("WITHDRAWAL_NOT_FOUND", 404);
        }

        if (payout.status === "COMPLETED") {
          throw new ApiError("ALREADY_COMPLETED", 409);
        }

        if (isFinalStatus(payout.status)) {
          throw new ApiError("INVALID_TRANSITION", 409);
        }

        if (
          payout.destination.id !== payout.destinationId ||
          payout.destination.organizationId !== payout.organizationId ||
          payout.destination.currency !== payout.currency
        ) {
          throw new ApiError("DESTINATION_MISMATCH", 409);
        }

        if (
          !payout.destination.isActive ||
          payout.destination.deletedAt !== null
        ) {
          throw new ApiError("DESTINATION_UNAVAILABLE", 409);
        }

        if (!payout.destination.isVerified) {
          throw new ApiError("DESTINATION_NOT_VERIFIED", 409);
        }

        if (payout.amount <= 0n) {
          throw new ApiError("INVALID_REQUEST", 409);
        }

        /* ---------------------------------------------------
           5. REVÉRIFIER LA DERNIÈRE PREUVE
        --------------------------------------------------- */

        const latest = await tx.auditLog.findFirst({
          where: {
            entity: "Payout",
            entityId: id,
            action: PROOF_ACTION,
          },
          orderBy: [
            { createdAt: "desc" },
            { id: "desc" },
          ],
          select: {
            id: true,
            actorId: true,
            createdAt: true,
            metadata: true,
          },
        });

        if (
          !latest ||
          latest.id !== proof.id ||
          !latest.actorId
        ) {
          throw new ApiError("INVALID_PROOF", 409);
        }

        const metadata = parseProofMetadata(latest.metadata);

        if (
          !metadata ||
          metadata.uploadedBy !== latest.actorId
        ) {
          throw new ApiError("INVALID_PROOF", 409);
        }

        const lockedProof: ProofRecord = {
          id: latest.id,
          actorId: latest.actorId,
          createdAt: latest.createdAt,
          metadata,
        };

        if (!proofMatchesPayout(lockedProof, payout)) {
          throw new ApiError("INVALID_PROOF", 409);
        }

        /* ---------------------------------------------------
           6. METTRE LE RETRAIT À COMPLETED
        --------------------------------------------------- */

        const completedAt = new Date();

        const updated = await tx.payout.update({
          where: { id },
          data: {
            status: "COMPLETED",
            completedAt,
          },
          select: {
            id: true,
            reference: true,
            status: true,
            amount: true,
            currency: true,
            completedAt: true,
            updatedAt: true,
          },
        });

        /* ---------------------------------------------------
           7. HISTORIQUE ADMINISTRATEUR
        --------------------------------------------------- */

        await tx.auditLog.create({
          data: {
            actorId: admin.id,

            action: COMPLETE_ACTION,
            entity: "Payout",
            entityId: id,

            metadata: {
              previousStatus: payout.status,
              newStatus: "COMPLETED",

              reference: payout.reference,
              organizationId: payout.organizationId,
              destinationId: payout.destinationId,

              amountMinor: payout.amount.toString(),
              currency: payout.currency,

              proofAuditId: proof.id,
              actorRole: admin.role,

              completedAt: completedAt.toISOString(),
            },
          },
        });

        /* ---------------------------------------------------
           8. NOTIFICATION DE L'ORGANISATEUR
        --------------------------------------------------- */

        const owner = payout.organization.owner;
        const isEnglish = owner.preferredLocale === "en";

        await tx.notification.create({
          data: {
            userId: owner.id,
            type: "PAYOUT",

            title: isEnglish
              ? "Withdrawal completed"
              : "Retrait effectué",

            message: isEnglish
              ? `Your withdrawal ${payout.reference} has been completed by TIKEMIA.`
              : `Votre retrait ${payout.reference} a été effectué par TIKEMIA.`,

            data: {
              payoutId: payout.id,
              reference: payout.reference,
              status: "COMPLETED",

              amountMinor: payout.amount.toString(),
              currency: payout.currency,
            },
          },
        });

        /* ---------------------------------------------------
           9. EMAIL DE RETRAIT INDÉPENDANT
        --------------------------------------------------- */

        /**
         * Le service dédié :
         *
         * src/lib/withdrawals/email.ts
         *
         * lira cet AuditLog.
         *
         * Le cron :
         *
         * /api/cron/withdrawal-emails
         *
         * se chargera de l'envoi.
         *
         * Aucun email n'est envoyé à l'intérieur
         * de cette transaction financière.
         */

        await tx.auditLog.create({
          data: {
            actorId: admin.id,

            action: EMAIL_QUEUE_ACTION,
            entity: "Payout",
            entityId: id,

            metadata: {
              template: "WITHDRAWAL_COMPLETED_V1",
              payoutId: id,

              recipient: owner.email,
              locale: isEnglish ? "en" : "fr",

              organizationName: payout.organization.name,
              ownerName: owner.fullName,

              reference: payout.reference,
              amountMinor: payout.amount.toString(),
              currency: payout.currency,

              status: "QUEUED",
            },
          },
        });

        return {
          id: updated.id,
          reference: updated.reference,
          status: updated.status,

          amountMinor: updated.amount.toString(),
          currency: updated.currency,

          completedAt:
            updated.completedAt?.toISOString() ?? null,

          updatedAt: updated.updatedAt.toISOString(),

          proofAuditId: proof.id,
        };
      },
      {
        timeout: 15000,
      }
    );

    after(async () => {
      try { await processWithdrawalEmailQueue({ limit: 3 }); }
      catch { console.warn("[TIKEMIA_WITHDRAWAL_EMAIL] Deferred processing failed"); }
    });

    return response({
      success: true,

      message: "Retrait confirmé avec succès.",

      data: result,
    });
  } catch (error) {
    unstable_rethrow(error);
    return handleError(error, "PATCH");
  }
}

/* ==========================================================
   AUTRES MÉTHODES
========================================================== */

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,
    headers: {
      ...HEADERS,
      Allow: "GET, HEAD, PATCH",
    },
  });
}

export async function POST(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT(): Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<NextResponse> {
  return methodNotAllowed();
}

async function readBoundedJson(request: NextRequest): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_JSON_SIZE) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch { return null; } finally { reader.releaseLock(); }
}
