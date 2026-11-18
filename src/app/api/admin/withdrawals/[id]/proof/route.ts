import { unstable_rethrow } from "next/navigation";

import "server-only";

import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  mkdir,
  open,
  readFile,
  lstat,
  realpath,
  unlink,
} from "node:fs/promises";

import path from "node:path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — PREUVES DE RETRAIT
 * ============================================================
 *
 * FICHIER :
 * src/app/api/admin/withdrawals/[id]/proof/route.ts
 *
 * POST :
 * Téléverser une preuve de paiement.
 *
 * GET :
 * Télécharger la dernière preuve enregistrée.
 *
 * Compatible avec :
 *
 * src/app/api/admin/withdrawals/[id]/route.ts
 * src/app/admin/withdrawals/page.tsx
 *
 * FONCTIONNEMENT :
 *
 * 1. L'administrateur consulte un retrait.
 * 2. Il effectue le paiement manuellement.
 * 3. Il sélectionne une photo ou un PDF.
 * 4. TIKEMIA enregistre le document en privé.
 * 5. PostgreSQL enregistre sa référence.
 * 6. L'administrateur valide le retrait.
 *
 * STOCKAGE :
 *
 * Répertoire privé sur disque persistant.
 *
 * AUCUN Cloudflare R2.
 * AUCUNE clé S3.
 * AUCUNE modification de Prisma.
 * AUCUN transfert bancaire automatique.
 *
 * SÉCURITÉ :
 *
 * - Session ADMIN / SUPER_ADMIN
 * - Contrôle des retraits
 * - Contrôle de la destination
 * - Limite de 10 Mo
 * - PDF, JPG, PNG, WebP uniquement
 * - Signature binaire contrôlée
 * - Nom de fichier généré par le serveur
 * - Empreinte SHA-256
 * - Protection contre la traversée de chemins
 * - Historique AuditLog
 * - Téléchargement réservé à l'administration
 * - Pas de dossier public/
 *
 * IMPORTANT :
 *
 * Le répertoire doit être persistant.
 *
 * Une installation serverless avec disque
 * temporaire ne garantit PAS la conservation
 * des preuves après redémarrage.
 *
 * ============================================================
 */


/* ============================================================
   CONSTANTES
============================================================ */

const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

const PROOF_ACTION =
  "WITHDRAWAL_PROOF_UPLOADED";

const MAX_FILE_BYTES =
  10 * 1024 * 1024;

const MAX_REQUEST_BYTES =
  MAX_FILE_BYTES + 512 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/i;

const WRITABLE_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
] as const;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",

  Vary: "Cookie",
} as const;

/**
 * IMPORTANT :
 *
 * Ce chemin doit être IDENTIQUE dans :
 *
 * - /withdrawals/[id]/route.ts
 * - /withdrawals/[id]/proof/route.ts
 *
 * En local :
 *
 * <projet>/private/withdrawal-proofs
 *
 * Sur un VPS :
 *
 * TIKEMIA_WITHDRAWALS_PROOF_DIR =
 * /var/lib/tikemia/withdrawal-proofs
 *
 * Ne jamais utiliser public/.
 */

// Proofs are created at runtime on private persistent storage, never bundled.
const PROOF_ROOT = path.resolve(/* turbopackIgnore: true */ 
  process.env.TIKEMIA_WITHDRAWALS_PROOF_DIR ||
    path.join(
      process.cwd(),
      "private",
      "withdrawal-proofs"
    )
);

/* ============================================================
   TYPES
============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AdminIdentity = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_ORIGIN"
  | "INVALID_WITHDRAWAL_ID"
  | "WITHDRAWAL_NOT_FOUND"
  | "WITHDRAWAL_ALREADY_FINAL"
  | "INVALID_REQUEST"
  | "FILE_REQUIRED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_FORMAT"
  | "DESTINATION_MISMATCH"
  | "DESTINATION_NOT_VERIFIED"
  | "DESTINATION_UNAVAILABLE"
  | "STORAGE_ERROR"
  | "PROOF_NOT_FOUND"
  | "INVALID_PROOF"
  | "DATABASE_ERROR";

type AllowedMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

type FileInfo = {
  mimeType: AllowedMime;
  extension: "pdf" | "jpg" | "png" | "webp";
};

type ProofMetadata = {
  storageKey: string;
  sha256: string;
  mimeType: AllowedMime;
  size: number;
  amountMinor: string;
  currency: string;
  destinationId: string;
  uploadedBy: string;
};

type SavedProof = {
  id: string;
  actorId: string;
  createdAt: Date;
  metadata: ProofMetadata;
};

type PayoutSnapshot = {
  id: string;
  status: string;
  amount: bigint;
  currency: string;
  requestedAt: Date;
  destinationId: string;
  organizationId: string;

  destination: {
    id: string;
    organizationId: string;
    currency: string;
    isVerified: boolean;
    isActive: boolean;
    deletedAt: Date | null;
  };
};

/* ============================================================
   ERREURS
============================================================ */

class RouteError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly statusCode: number
  ) {
    super(code);
    this.name = "RouteError";
  }
}

/* ============================================================
   RÉPONSES HTTP
============================================================ */

function json(
  body: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function fail(
  code: ApiErrorCode,
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

function handleError(
  error: unknown,
  operation: string
): NextResponse {
  unstable_rethrow(error);
  if (error instanceof RouteError) {
    return fail(
      error.code,
      error.statusCode
    );
  }

  console.error(
    `[TIKEMIA_WITHDRAWAL_PROOF_${operation}]`,
    error instanceof Error
      ? error.name
      : "UNKNOWN_ERROR"
  );

  return fail(
    "DATABASE_ERROR",
    503
  );
}

/* ============================================================
   UTILITAIRES
============================================================ */

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isAllowedMime(
  value: unknown
): value is AllowedMime {
  return (
    value === "application/pdf" ||
    value === "image/jpeg" ||
    value === "image/png" ||
    value === "image/webp"
  );
}

function isWritableStatus(
  status: string
): boolean {
  return WRITABLE_STATUSES.some(
    (item) => item === status
  );
}

/* ============================================================
   AUTHENTIFICATION ADMINISTRATEUR
============================================================ */

/**
 * Contrat de session conservé :
 *
 * Cookie :
 * tikemia_session
 *
 * Session.tokenHash :
 * SHA-256(token brut)
 *
 * Accès :
 * ADMIN ou SUPER_ADMIN
 *
 * Cette fonction doit correspondre à
 * l'authentification réelle de TIKEMIA.
 */

async function authenticateAdmin(
  request: NextRequest
): Promise<AdminIdentity | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(Buffer.from(token, "hex"))
      .digest("hex");

  const prisma =
    getPlatformPrisma();

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

            roles: {
              where: {
                role: {
                  in: [
                    "ADMIN",
                    "SUPER_ADMIN",
                  ],
                },
              },

              select: {
                role: true,
              },
            },
          },
        },
      },
    });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  const user =
    session.user;

  if (
    !user ||
    !user.isActive ||
    user.isBlocked
  ) {
    return null;
  }

  if (
    user.roles.some(
      (role) =>
        role.role === "SUPER_ADMIN"
    )
  ) {
    return {
      id: user.id,
      role: "SUPER_ADMIN",
    };
  }

  if (
    user.roles.some(
      (role) =>
        role.role === "ADMIN"
    )
  ) {
    return {
      id: user.id,
      role: "ADMIN",
    };
  }

  return null;
}

/* ============================================================
   PROTECTION DES REQUÊTES POST
============================================================ */

function validOrigin(
  request: NextRequest
): boolean {
  const origin =
    request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin ===
      new URL(request.url).origin
    );
  } catch {
    return false;
  }
}

/* ============================================================
   CHEMINS DU STOCKAGE PRIVÉ
============================================================ */

/**
 * Format unique :
 *
 * withdrawals/<payoutUUID>/<fileUUID>.pdf
 *
 * ou :
 *
 * withdrawals/<payoutUUID>/<fileUUID>.jpg
 * withdrawals/<payoutUUID>/<fileUUID>.png
 * withdrawals/<payoutUUID>/<fileUUID>.webp
 *
 * Aucun nom fourni par le client
 * n'est utilisé comme nom de stockage.
 */

function resolveProofPath(
  payoutId: string,
  storageKey: string
): string {
  const publicDirectory = path.resolve(process.cwd(), "public");
  const relativeRoot = path.relative(publicDirectory, PROOF_ROOT);
  if (!relativeRoot || (!relativeRoot.startsWith("..") && !path.isAbsolute(relativeRoot))) throw new RouteError("STORAGE_ERROR", 503);
  if (!isUuid(payoutId)) {
    throw new RouteError(
      "INVALID_PROOF",
      409
    );
  }

  const normalized =
    storageKey.replace(/\\/g, "/");

  const match = normalized.match(
    /^withdrawals\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(pdf|jpg|jpeg|png|webp)$/i
  );

  if (
    !match ||
    !isUuid(match[1]) ||
    !isUuid(match[2]) ||
    match[1].toLowerCase() !==
      payoutId.toLowerCase()
  ) {
    throw new RouteError(
      "INVALID_PROOF",
      409
    );
  }

  const filePath =
    path.resolve(
      PROOF_ROOT,
      ...normalized.split("/")
    );

  if (
    !filePath.startsWith(
      PROOF_ROOT + path.sep
    )
  ) {
    throw new RouteError(
      "INVALID_PROOF",
      409
    );
  }

  return filePath;
}

/**
 * Vérifie que le répertoire physique
 * utilisé est réellement sous PROOF_ROOT.
 *
 * Cette vérification limite notamment
 * les erreurs de configuration et les
 * répertoires symboliques inattendus.
 */

async function ensurePrivateDirectory(
  payoutId: string
): Promise<void> {
  const target =
    path.join(
      PROOF_ROOT,
      "withdrawals",
      payoutId
    );

  try {
    await mkdir(
      /* turbopackIgnore: true */ PROOF_ROOT,
      {
        recursive: true,
        mode: 0o700,
      }
    );

    await mkdir(
      /* turbopackIgnore: true */ target,
      {
        recursive: true,
        mode: 0o700,
      }
    );

    const realRoot =
      await realpath(/* turbopackIgnore: true */ PROOF_ROOT);

    const realTarget =
      await realpath(/* turbopackIgnore: true */ target);

    if (
      !realTarget.startsWith(
        realRoot + path.sep
      )
    ) {
      throw new RouteError(
        "STORAGE_ERROR",
        503
      );
    }
  } catch {
    throw new RouteError(
      "STORAGE_ERROR",
      503
    );
  }
}

/* ============================================================
   LECTURE LIMITÉE DU FICHIER
============================================================ */

/**
 * Le téléchargement est limité dès
 * la lecture du corps HTTP.
 *
 * Cela évite de faire confiance
 * exclusivement au Content-Length.
 */

async function readLimitedBody(
  request: NextRequest
): Promise<Buffer> {
  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength !== null) {
    const declared =
      Number(contentLength);

    if (
      !Number.isSafeInteger(declared) ||
      declared < 0
    ) {
      throw new RouteError(
        "INVALID_REQUEST",
        400
      );
    }

    if (
      declared > MAX_REQUEST_BYTES
    ) {
      throw new RouteError(
        "FILE_TOO_LARGE",
        413
      );
    }
  }

  if (!request.body) {
    throw new RouteError(
      "FILE_REQUIRED",
      400
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let total = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      if (request.signal.aborted) {
        throw new RouteError(
          "INVALID_REQUEST",
          400
        );
      }

      total += value.byteLength;

      if (
        total > MAX_REQUEST_BYTES
      ) {
        throw new RouteError(
          "FILE_TOO_LARGE",
          413
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    throw new RouteError(
      "FILE_REQUIRED",
      400
    );
  }

  return Buffer.concat(
    chunks.map(
      (chunk) => Buffer.from(chunk)
    ),
    total
  );
}

/* ============================================================
   EXTRACTION DU FICHIER MULTIPART
============================================================ */

/**
 * Requête envoyée par la page admin :
 *
 * const formData = new FormData();
 * formData.append("file", selectedFile);
 *
 * POST /api/admin/withdrawals/[id]/proof
 *
 * Aucun autre champ requis.
 */

async function extractFile(
  request: NextRequest
): Promise<Buffer> {
  const contentType =
    request.headers.get(
      "content-type"
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    throw new RouteError(
      "INVALID_REQUEST",
      415
    );
  }

  const body =
    await readLimitedBody(request);

  let formData: FormData;

  try {
    const multipartResponse =
      new Response(
        new Uint8Array(body),
        {
          headers: {
            "Content-Type":
              contentType,
          },
        }
      );

    formData =
      await multipartResponse.formData();
  } catch {
    throw new RouteError(
      "INVALID_REQUEST",
      400
    );
  }

  const entries =
    Array.from(
      formData.entries()
    );

  if (
    entries.length !== 1 ||
    entries[0][0] !== "file"
  ) {
    throw new RouteError(
      "INVALID_REQUEST",
      400
    );
  }

  const file =
    entries[0][1];

  if (
    typeof file === "string" ||
    typeof file.arrayBuffer !==
      "function"
  ) {
    throw new RouteError(
      "FILE_REQUIRED",
      400
    );
  }

  if (file.size <= 0) {
    throw new RouteError(
      "FILE_REQUIRED",
      400
    );
  }

  if (
    file.size > MAX_FILE_BYTES
  ) {
    throw new RouteError(
      "FILE_TOO_LARGE",
      413
    );
  }

  const bytes =
    Buffer.from(
      await file.arrayBuffer()
    );

  if (
    bytes.length !== file.size
  ) {
    throw new RouteError(
      "INVALID_REQUEST",
      400
    );
  }

  return bytes;
}

/* ============================================================
   DÉTECTER LE FORMAT RÉEL
============================================================ */

/**
 * Formats acceptés :
 *
 * PDF
 * JPG / JPEG
 * PNG
 * WEBP
 *
 * On lit la signature du fichier,
 * pas seulement son extension.
 *
 * Ce contrôle n'est pas un antivirus.
 */

function detectFileFormat(
  bytes: Buffer
): FileInfo {
  // PDF

  if (
    bytes.length >= 5 &&
    bytes
      .subarray(0, 5)
      .toString("ascii") === "%PDF-"
  ) {
    return {
      mimeType: "application/pdf",
      extension: "pdf",
    };
  }

  // JPEG

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  }

  // PNG

  const pngSignature =
    Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);

  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(pngSignature)
  ) {
    return {
      mimeType: "image/png",
      extension: "png",
    };
  }

  // WEBP

  if (
    bytes.length >= 12 &&
    bytes
      .subarray(0, 4)
      .toString("ascii") === "RIFF" &&
    bytes
      .subarray(8, 12)
      .toString("ascii") === "WEBP"
  ) {
    return {
      mimeType: "image/webp",
      extension: "webp",
    };
  }

  throw new RouteError(
    "INVALID_FILE_FORMAT",
    415
  );
}

/* ============================================================
   LECTURE DU RETRAIT DEPUIS POSTGRESQL
============================================================ */

async function getPayout(
  id: string
): Promise<PayoutSnapshot> {
  const prisma =
    getPlatformPrisma();

  const payout =
    await prisma.payout.findUnique({
      where: { id },

      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        requestedAt: true,
        destinationId: true,
        organizationId: true,

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
      },
    });

  if (!payout) {
    throw new RouteError(
      "WITHDRAWAL_NOT_FOUND",
      404
    );
  }

  return payout;
}

/* ============================================================
   VÉRIFICATIONS DU RETRAIT
============================================================ */

function assertPayoutWritable(
  payout: PayoutSnapshot
): void {
  if (
    !isWritableStatus(payout.status)
  ) {
    throw new RouteError(
      "WITHDRAWAL_ALREADY_FINAL",
      409
    );
  }

  if (payout.amount <= 0n) {
    throw new RouteError(
      "INVALID_REQUEST",
      409
    );
  }

  if (
    payout.destination.id !==
      payout.destinationId ||
    payout.destination.organizationId !==
      payout.organizationId ||
    payout.destination.currency !==
      payout.currency
  ) {
    throw new RouteError(
      "DESTINATION_MISMATCH",
      409
    );
  }

  if (
    !payout.destination.isVerified
  ) {
    throw new RouteError(
      "DESTINATION_NOT_VERIFIED",
      409
    );
  }

  if (
    !payout.destination.isActive ||
    payout.destination.deletedAt !== null
  ) {
    throw new RouteError(
      "DESTINATION_UNAVAILABLE",
      409
    );
  }
}

/* ============================================================
   MÉTADONNÉES AUDITLOG
============================================================ */

/**
 * Cette structure correspond exactement
 * à celle attendue par la route de
 * confirmation simplifiée.
 */

function parseProofMetadata(
  value: unknown
): ProofMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.storageKey !==
      "string" ||
    typeof value.sha256 !==
      "string" ||
    !SHA256_PATTERN.test(
      value.sha256
    ) ||
    !isAllowedMime(
      value.mimeType
    ) ||
    typeof value.size !==
      "number" ||
    !Number.isSafeInteger(
      value.size
    ) ||
    value.size <= 0 ||
    value.size > MAX_FILE_BYTES ||
    typeof value.amountMinor !==
      "string" ||
    !/^[0-9]+$/.test(
      value.amountMinor
    ) ||
    typeof value.currency !==
      "string" ||
    !/^[A-Z]{3}$/.test(
      value.currency
    ) ||
    !isUuid(
      value.destinationId
    ) ||
    !isUuid(
      value.uploadedBy
    )
  ) {
    return null;
  }

  return {
    storageKey:
      value.storageKey,

    sha256:
      value.sha256,

    mimeType:
      value.mimeType,

    size:
      value.size,

    amountMinor:
      value.amountMinor,

    currency:
      value.currency,

    destinationId:
      value.destinationId,

    uploadedBy:
      value.uploadedBy,
  };
}

/* ============================================================
   LIRE LA DERNIÈRE PREUVE
============================================================ */

async function findLatestProof(
  payoutId: string
): Promise<SavedProof | null> {
  const prisma =
    getPlatformPrisma();

  const audit =
    await prisma.auditLog.findFirst({
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

  if (
    !audit ||
    !audit.actorId
  ) {
    return null;
  }

  const metadata =
    parseProofMetadata(
      audit.metadata
    );

  if (
    !metadata ||
    metadata.uploadedBy !==
      audit.actorId
  ) {
    return null;
  }

  return {
    id: audit.id,
    actorId: audit.actorId,
    createdAt: audit.createdAt,
    metadata,
  };
}

/* ============================================================
   CORRESPONDANCE PREUVE / RETRAIT
============================================================ */

function proofMatchesPayout(
  payout: PayoutSnapshot,
  proof: SavedProof
): boolean {
  return (
    proof.metadata.amountMinor ===
      payout.amount.toString() &&

    proof.metadata.currency ===
      payout.currency &&

    proof.metadata.destinationId ===
      payout.destinationId &&

    proof.createdAt.getTime() >=
      payout.requestedAt.getTime() &&

    proof.metadata.storageKey.startsWith(
      `withdrawals/${payout.id}/`
    )
  );
}

/* ============================================================
   VÉRIFICATION DU FICHIER STOCKÉ
============================================================ */

async function readVerifiedProof(
  payoutId: string,
  proof: SavedProof
): Promise<Buffer> {
  const filePath =
    resolveProofPath(
      payoutId,
      proof.metadata.storageKey
    );

  let contents: Buffer;

  try {
    const realFile = await realpath(/* turbopackIgnore: true */ filePath);
    const realRoot = await realpath(/* turbopackIgnore: true */ PROOF_ROOT);
    if (!realFile.startsWith(realRoot + path.sep)) throw new RouteError("INVALID_PROOF", 409);
    const fileStats = await lstat(/* turbopackIgnore: true */ filePath);

    if (
      !fileStats.isFile() ||
      fileStats.size !==
        proof.metadata.size ||
      fileStats.size <= 0 ||
      fileStats.size >
        MAX_FILE_BYTES
    ) {
      throw new RouteError(
        "INVALID_PROOF",
        409
      );
    }

    contents =
      await readFile(/* turbopackIgnore: true */ filePath);
  } catch (error) {
    if (error instanceof RouteError) {
      throw error;
    }

    throw new RouteError(
      "STORAGE_ERROR",
      503
    );
  }

  if (
    contents.length !==
      proof.metadata.size
  ) {
    throw new RouteError(
      "INVALID_PROOF",
      409
    );
  }

  const actualHash =
    createHash("sha256")
      .update(contents)
      .digest();

  const expectedHash =
    Buffer.from(
      proof.metadata.sha256,
      "hex"
    );

  if (
    actualHash.length !==
      expectedHash.length ||
    !timingSafeEqual(
      actualHash,
      expectedHash
    )
  ) {
    throw new RouteError(
      "INVALID_PROOF",
      409
    );
  }

  const fileInfo =
    detectFileFormat(
      contents
    );

  if (
    fileInfo.mimeType !==
      proof.metadata.mimeType
  ) {
    throw new RouteError(
      "INVALID_PROOF",
      409
    );
  }

  return contents;
}

/* ============================================================
   SUPPRESSION EN CAS D'ÉCHEC
============================================================ */

/**
 * Si PostgreSQL refuse l'enregistrement,
 * on supprime uniquement le fichier
 * nouvellement créé.
 *
 * Les anciennes preuves ne sont pas
 * supprimées, afin de conserver l'historique.
 */

async function cleanupFile(
  filePath: string
): Promise<void> {
  try {
    await unlink(/* turbopackIgnore: true */ filePath);
  } catch (error) {
    console.error(
      "[TIKEMIA_WITHDRAWAL_PROOF_CLEANUP]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );
  }
}

/* ============================================================
   POST — ENREGISTRER UNE PREUVE
============================================================ */

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  let createdFilePath:
    string | null = null;

  let committed = false;

  try {
    /* --------------------------------------------------------
       1. AUTHENTIFICATION
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(
        request
      );

    if (!admin) {
      return fail(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       2. SÉCURITÉ D'ORIGINE
    -------------------------------------------------------- */

    if (
      !validOrigin(request)
    ) {
      return fail(
        "INVALID_ORIGIN",
        403
      );
    }

    /* --------------------------------------------------------
       3. IDENTIFIANT DU RETRAIT
    -------------------------------------------------------- */

    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return fail(
        "INVALID_WITHDRAWAL_ID",
        400
      );
    }

    /* --------------------------------------------------------
       4. VÉRIFIER LA DEMANDE
    -------------------------------------------------------- */

    const payout =
      await getPayout(id);

    assertPayoutWritable(
      payout
    );

    /* --------------------------------------------------------
       5. EXTRAIRE LE DOCUMENT
    -------------------------------------------------------- */

    const bytes =
      await extractFile(request);

    const fileInfo =
      detectFileFormat(
        bytes
      );

    /* --------------------------------------------------------
       6. EMPREINTE DU DOCUMENT
    -------------------------------------------------------- */

    const sha256 =
      createHash("sha256")
        .update(bytes)
        .digest("hex");

    /* --------------------------------------------------------
       7. GÉNÉRER LE NOM PRIVÉ
    -------------------------------------------------------- */

    const storageKey =
      `withdrawals/${id}/` +
      `${randomUUID()}.${fileInfo.extension}`;

    const filePath =
      resolveProofPath(
        id,
        storageKey
      );

    /* --------------------------------------------------------
       8. CRÉER LE DOSSIER
    -------------------------------------------------------- */

    await ensurePrivateDirectory(
      id
    );

    /* --------------------------------------------------------
       9. ÉCRIRE LE FICHIER
    -------------------------------------------------------- */

    /**
     * wx :
     * Création exclusive.
     *
     * Un fichier existant ne peut
     * pas être écrasé.
     *
     * mode 0600 :
     * Lecture/écriture pour le compte
     * du serveur uniquement sur les
     * systèmes qui appliquent ces droits.
     */

    let fileHandle:
      Awaited<ReturnType<typeof open>> | null =
      null;

    try {
      fileHandle =
        await open(
          /* turbopackIgnore: true */ filePath,
          "wx",
          0o600
        );

      createdFilePath =
        filePath;

      await fileHandle.writeFile(
        bytes
      );

      await fileHandle.sync();
    } catch {
      throw new RouteError(
        "STORAGE_ERROR",
        503
      );
    } finally {
      if (fileHandle) {
        await fileHandle.close();
      }
    }

    /* --------------------------------------------------------
       10. ENREGISTRER DANS POSTGRESQL
    -------------------------------------------------------- */

    const prisma =
      getPlatformPrisma();

    const saved =
      await prisma.$transaction(
        async (tx) => {
          /**
           * Verrouiller la demande.
           *
           * Empêche l'ajout d'une preuve
           * après une confirmation
           * concurrente du même retrait.
           */

          const locked =
            await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "Payout"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;

          if (
            locked.length !== 1
          ) {
            throw new RouteError(
              "WITHDRAWAL_NOT_FOUND",
              404
            );
          }

          /* ----------------------------------------------
             RELIRE LE RETRAIT
          ---------------------------------------------- */

          const current =
            await tx.payout.findUnique({
              where: {
                id,
              },

              select: {
                id: true,
                status: true,
                amount: true,
                currency: true,
                requestedAt: true,
                destinationId: true,
                organizationId: true,

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
              },
            });

          if (!current) {
            throw new RouteError(
              "WITHDRAWAL_NOT_FOUND",
              404
            );
          }

          assertPayoutWritable(
            current
          );

          /* ----------------------------------------------
             VÉRIFIER LES INFORMATIONS FINANCIÈRES
          ---------------------------------------------- */

          if (
            current.amount !==
              payout.amount ||
            current.currency !==
              payout.currency ||
            current.destinationId !==
              payout.destinationId
          ) {
            throw new RouteError(
              "DESTINATION_MISMATCH",
              409
            );
          }

          /* ----------------------------------------------
             MÉTADONNÉES
          ---------------------------------------------- */

          const metadata:
            ProofMetadata = {
              storageKey,

              sha256,

              mimeType:
                fileInfo.mimeType,

              size:
                bytes.length,

              amountMinor:
                current.amount.toString(),

              currency:
                current.currency,

              destinationId:
                current.destinationId,

              uploadedBy:
                admin.id,
            };

          /* ----------------------------------------------
             HISTORIQUE DE LA PREUVE
          ---------------------------------------------- */

          const audit =
            await tx.auditLog.create({
              data: {
                actorId:
                  admin.id,

                action:
                  PROOF_ACTION,

                entity:
                  "Payout",

                entityId:
                  id,

                metadata: {
                  ...metadata,
                },
              },

              select: {
                id: true,
                createdAt: true,
              },
            });

          return audit;
        },
        {
          timeout: 15000,
        }
      );

    committed = true;

    /* --------------------------------------------------------
       11. RÉPONSE
    -------------------------------------------------------- */

    return json(
      {
        success: true,

        message:
          "Preuve de paiement enregistrée avec succès.",

        data: {
          payoutId:
            id,

          proofId:
            saved.id,

          uploaded:
            true,

          mimeType:
            fileInfo.mimeType,

          size:
            bytes.length,

          sha256,

          uploadedAt:
            saved.createdAt.toISOString(),

          downloadUrl:
            `/api/admin/withdrawals/${id}/proof`,
        },
      },
      201
    );
  } catch (error) {
    unstable_rethrow(error);
    if (
      createdFilePath &&
      !committed
    ) {
      await cleanupFile(
        createdFilePath
      );
    }

    return handleError(
      error,
      "UPLOAD"
    );
  }
}

/* ============================================================
   GET — TÉLÉCHARGER LA PREUVE
============================================================ */

/**
 * La preuve reste privée.
 *
 * Aucun lien public.
 *
 * Le téléchargement est autorisé
 * uniquement pour un administrateur
 * ayant une session valide.
 */

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    /* --------------------------------------------------------
       1. AUTHENTIFICATION
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(
        request
      );

    if (!admin) {
      return fail(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       2. IDENTIFIANT
    -------------------------------------------------------- */

    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return fail(
        "INVALID_WITHDRAWAL_ID",
        400
      );
    }

    /* --------------------------------------------------------
       3. RETRAIT POSTGRESQL
    -------------------------------------------------------- */

    const payout =
      await getPayout(id);

    /* --------------------------------------------------------
       4. DERNIÈRE PREUVE
    -------------------------------------------------------- */

    const proof =
      await findLatestProof(
        id
      );

    if (!proof) {
      return fail(
        "PROOF_NOT_FOUND",
        404
      );
    }

    if (
      !proofMatchesPayout(
        payout,
        proof
      )
    ) {
      return fail(
        "INVALID_PROOF",
        409
      );
    }

    /* --------------------------------------------------------
       5. LIRE ET VÉRIFIER LE DOCUMENT
    -------------------------------------------------------- */

    const bytes =
      await readVerifiedProof(
        id,
        proof
      );

    const fileInfo =
      detectFileFormat(
        bytes
      );

    /* --------------------------------------------------------
       6. NOM POUR LE TÉLÉCHARGEMENT
    -------------------------------------------------------- */

    const filename =
      `tikemia-preuve-retrait-${id}.` +
      fileInfo.extension;

    /* --------------------------------------------------------
       7. ENVOYER LE FICHIER
    -------------------------------------------------------- */

    return new NextResponse(
      new Uint8Array(bytes),
      {
        status: 200,

        headers: {
          ...RESPONSE_HEADERS,

          "Content-Type":
            fileInfo.mimeType,

          "Content-Length":
            String(bytes.length),

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Content-Security-Policy":
            "sandbox",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    return handleError(
      error,
      "DOWNLOAD"
    );
  }
}

/* ============================================================
   MÉTHODES NON AUTORISÉES
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
