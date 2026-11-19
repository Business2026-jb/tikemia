import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { isSupportedCurrency } from "@/i18n/config";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createCipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

import {
  compare,
} from "bcryptjs";

import {
  getCryptoNetwork,
  isMobileMoneyProviderInCountry,
  normalizeWithdrawalPhone,
  isValidCountryCode,
} from "@/lib/withdrawal-providers";

/* ==========================================================
   TIKEMIA — MODIFIER / RETIRER UN MOYEN DE RETRAIT

   Fichier :
   src/app/api/organizer/settings/
   withdrawal-methods/[id]/route.ts

   PATCH :
   - Modifier le libellé
   - Modifier le nom du titulaire
   - Modifier la banque
   - Modifier les coordonnées de retrait
   - Définir le moyen par défaut
   - Réinitialiser la vérification si nécessaire

   DELETE :
   - Désactivation logique du moyen
   - Conservation de l'historique financier
   - Protection des retraits en cours
   - Suppression du statut par défaut

   Sécurité :
   - Session organisateur obligatoire
   - Vérification du propriétaire
   - Vérification de l'origine
   - Contrôle des entrées
   - Mot de passe pour les changements sensibles
   - Chiffrement AES-256-GCM
   - Transactions PostgreSQL
   - Journalisation des modifications

   Aucun paiement ni retrait n'est exécuté ici.
========================================================== */


/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE = "tikemia_organizer_session";

const SESSION_PATTERN = /^[a-f0-9]{64}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 8192;

const MAX_LABEL_LENGTH = 80;
const MAX_NAME_LENGTH = 160;
const MAX_BANK_NAME_LENGTH = 160;

const ACTIVE_PAYOUT_STATUSES = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
] as const;

const ALLOWED_FIELDS = new Set([
  "label",
  "isDefault",
  "accountName",
  "bankName",
  "accountDetails",
  "provider",
  "countryCode",
  "currency",
  "assetCode",
  "networkCode",
  "currentPassword",
]);

type Language = "fr" | "en";

type MethodType =
  | "MOBILE_MONEY"
  | "BANK_ACCOUNT"
  | "CRYPTO";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type OrganizerContext = {
  userId: string;
  organizationIds: string[];
  passwordHash: string | null;
};

type AccountDetails = {
  reference: string;
  bic?: string;
  routingCode?: string;
};

type PatchInput = {
  label?: string | null;
  isDefault?: boolean;
  accountName?: string;
  bankName?: string | null;
  accountDetails?: AccountDetails;
  provider?: string;
  countryCode?: string;
  currency?: string;
  assetCode?: string | null;
  networkCode?: string | null;
  currentPassword?: string;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidId"
  | "notFound"
  | "invalidBody"
  | "invalidFields"
  | "emptyUpdate"
  | "invalidValue"
  | "invalidBankReference"
  | "invalidCryptoAddress"
  | "invalidPhone"
  | "invalidAccount"
  | "invalidProvider"
  | "invalidNetwork"
  | "passwordRequired"
  | "incorrectPassword"
  | "passwordUnsupported"
  | "activePayout"
  | "alreadyRemoved"
  | "conflict"
  | "serverError";

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
      "Vous n'êtes pas autorisé à effectuer cette opération.",

    invalidId:
      "Identifiant du moyen de retrait invalide.",

    notFound:
      "Moyen de retrait introuvable.",

    invalidBody:
      "Les données envoyées sont invalides ou trop volumineuses.",

    invalidFields:
      "La requête contient des champs non autorisés.",

    emptyUpdate:
      "Aucune modification à enregistrer.",

    invalidValue:
      "Certaines informations sont invalides.",

    invalidBankReference: "Verifiez le numero de compte bancaire ou l'IBAN complet (avec sa cle de controle).",
    invalidCryptoAddress: "Verifiez l'adresse du portefeuille et le reseau selectionne.",
    invalidPhone: "Le numero Mobile Money est invalide pour le pays choisi. Verifiez le pays et saisissez le numero local complet ou avec son indicatif (+...).",
    invalidAccount:
      "Les coordonnées du moyen de retrait sont invalides.",

    invalidProvider:
      "L'opérateur ou la banque sélectionné ne correspond pas au pays ou au moyen de retrait.",

    invalidNetwork:
      "La cryptomonnaie ou le réseau sélectionné est invalide.",

    passwordRequired:
      "Votre mot de passe actuel est nécessaire pour modifier ces informations sensibles.",

    incorrectPassword:
      "Le mot de passe actuel est incorrect.",

    passwordUnsupported:
      "La vérification du mot de passe n'est pas disponible pour ce compte.",

    activePayout:
      "Ce moyen de retrait est utilisé par une opération en cours. Il ne peut pas être modifié ou retiré maintenant.",

    alreadyRemoved:
      "Ce moyen de retrait a déjà été retiré.",

    conflict:
      "Les informations ont été modifiées entre-temps. Veuillez réessayer.",

    serverError:
      "Impossible de traiter cette demande pour le moment.",

    updated:
      "Votre moyen de retrait a été mis à jour.",

    defaultUpdated:
      "Votre moyen de retrait par défaut a été mis à jour.",

    removed:
      "Le moyen de retrait a été retiré. Son historique financier a été conservé.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You are not authorized to perform this operation.",

    invalidId:
      "Invalid withdrawal method identifier.",

    notFound:
      "Withdrawal method not found.",

    invalidBody:
      "Invalid or oversized request data.",

    invalidFields:
      "The request contains unauthorized fields.",

    emptyUpdate:
      "No changes to save.",

    invalidValue:
      "Some information is invalid.",

    invalidBankReference: "Check the bank account number or complete IBAN (including its check digits).",
    invalidCryptoAddress: "Check the wallet address and the selected network.",
    invalidPhone: "The Mobile Money number is invalid for the selected country. Check the country and enter the complete local number or its international dialing code (+...).",
    invalidAccount:
      "Invalid withdrawal account details.",

    invalidProvider:
      "The selected provider or bank is not compatible with the selected country or method.",

    invalidNetwork:
      "Invalid cryptocurrency or network.",

    passwordRequired:
      "Your current password is required to change sensitive information.",

    incorrectPassword:
      "Your current password is incorrect.",

    passwordUnsupported:
      "Password verification is not available for this account.",

    activePayout:
      "This withdrawal method is being used by an active payout and cannot be changed or removed.",

    alreadyRemoved:
      "This withdrawal method has already been removed.",

    conflict:
      "The information changed during this operation. Please try again.",

    serverError:
      "Unable to process this request right now.",

    updated:
      "Your withdrawal method has been updated.",

    defaultUpdated:
      "Your default withdrawal method has been updated.",

    removed:
      "Withdrawal method removed. Its financial history has been preserved.",
  },
} as const;

/* ==========================================================
   PRISMA 7
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE ET RÉPONSES
========================================================== */

function getLanguage(request: NextRequest): Language {
  const queryLocale =
    request.nextUrl.searchParams.get("locale");

  if (queryLocale === "fr" || queryLocale === "en") {
    return queryLocale;
  }

  return (
    request.headers.get("accept-language") ?? ""
  ).toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
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

function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === getTrustedRequestOrigin(request);
  } catch {
    return false;
  }
}

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<OrganizerContext | null> {
  const token =
    request.cookies.get(SESSION_COOKIE)?.value;

  if (!token || !SESSION_PATTERN.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

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
      passwordHash: true,
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

  const organizations = await prisma.organization.findMany({
    where: {
      ownerId: user.id,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (organizations.length === 0) {
    return null;
  }

  return {
    userId: user.id,
    passwordHash: user.passwordHash,
    organizationIds: organizations.map((item) => item.id),
  };
}

/* ==========================================================
   LECTURE JSON LIMITÉE
========================================================== */

async function readJson(
  request: NextRequest
): Promise<JsonRecord | null> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return null;
  }

  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  try {
    while (true) {
      const result = await reader.read();

      if (result.done) {
        break;
      }

      size += result.value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(result.value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes)
    );

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as JsonRecord;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DES VALEURS
========================================================== */

function hasOwn(
  object: JsonRecord,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function cleanText(
  value: unknown,
  maximum: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().replace(/[ \t]+/g, " ");

  if (
    text.length === 0 ||
    text.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    return null;
  }

  return text;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function validCurrency(value: string): boolean { return isSupportedCurrency(value); }

function parsePatch(body: JsonRecord): PatchInput {
  const keys = Object.keys(body);

  if (keys.length === 0) {
    throw new ApiError("emptyUpdate", 400);
  }

  for (const key of keys) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new ApiError("invalidFields", 400);
    }
  }

  const input: PatchInput = {};

  if (hasOwn(body, "label")) {
    if (body.label === null || body.label === "") {
      input.label = null;
    } else {
      const value = cleanText(
        body.label,
        MAX_LABEL_LENGTH
      );

      if (!value) {
        throw new ApiError("invalidValue", 400);
      }

      input.label = value;
    }
  }

  if (hasOwn(body, "isDefault")) {
    if (typeof body.isDefault !== "boolean") {
      throw new ApiError("invalidValue", 400);
    }

    input.isDefault = body.isDefault;
  }

  if (hasOwn(body, "accountName")) {
    const value = cleanText(
      body.accountName,
      MAX_NAME_LENGTH
    );

    if (!value) {
      throw new ApiError("invalidValue", 400);
    }

    input.accountName = value;
  }

  if (hasOwn(body, "bankName")) {
    if (body.bankName === null) {
      input.bankName = null;
    } else {
      const value = cleanText(
        body.bankName,
        MAX_BANK_NAME_LENGTH
      );

      if (!value) {
        throw new ApiError("invalidValue", 400);
      }

      input.bankName = value;
    }
  }

  if (hasOwn(body, "provider")) {
    if (typeof body.provider !== "string") {
      throw new ApiError("invalidValue", 400);
    }

    const value = normalizeCode(body.provider);

    if (!/^[A-Z0-9_]{2,64}$/.test(value)) {
      throw new ApiError("invalidProvider", 400);
    }

    input.provider = value;
  }

  if (hasOwn(body, "countryCode")) {
    if (typeof body.countryCode !== "string") {
      throw new ApiError("invalidValue", 400);
    }

    const value = normalizeCode(body.countryCode);

    if (!isValidCountryCode(value)) {
      throw new ApiError("invalidValue", 400);
    }

    input.countryCode = value;
  }

  if (hasOwn(body, "currency")) {
    if (typeof body.currency !== "string") {
      throw new ApiError("invalidValue", 400);
    }

    const value = normalizeCode(body.currency);

    if (!validCurrency(value)) {
      throw new ApiError("invalidValue", 400);
    }

    input.currency = value;
  }

  for (const key of ["assetCode", "networkCode"] as const) {
    if (hasOwn(body, key)) {
      const value = body[key];

      if (value === null) {
        input[key] = null;
      } else if (typeof value === "string") {
        const normalized = normalizeCode(value);

        if (!/^[A-Z0-9_]{2,30}$/.test(normalized)) {
          throw new ApiError("invalidValue", 400);
        }

        input[key] = normalized;
      } else {
        throw new ApiError("invalidValue", 400);
      }
    }
  }

  if (hasOwn(body, "accountDetails")) {
    const details = body.accountDetails;

    if (
      !details ||
      typeof details !== "object" ||
      Array.isArray(details)
    ) {
      throw new ApiError("invalidAccount", 400);
    }

    const record = details as JsonRecord;

    const allowedDetails = new Set([
      "reference",
      "bic",
      "routingCode",
    ]);

    for (const key of Object.keys(record)) {
      if (!allowedDetails.has(key)) {
        throw new ApiError("invalidAccount", 400);
      }
    }

    const reference = cleanText(record.reference, 250);

    if (!reference) {
      throw new ApiError("invalidAccount", 400);
    }

    const accountDetails: AccountDetails = {
      reference,
    };

    if (hasOwn(record, "bic")) {
      const bic = cleanText(record.bic, 11);

      if (!bic || !/^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/.test(bic)) {
        throw new ApiError("invalidAccount", 400);
      }

      accountDetails.bic = normalizeCode(bic);
    }

    if (hasOwn(record, "routingCode")) {
      const routingCode = cleanText(record.routingCode, 35);

      if (!routingCode) {
        throw new ApiError("invalidAccount", 400);
      }

      accountDetails.routingCode = routingCode;
    }

    input.accountDetails = accountDetails;
  }

  if (hasOwn(body, "currentPassword")) {
    if (
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length === 0 ||
      Buffer.byteLength(body.currentPassword, "utf8") > 1024
    ) {
      throw new ApiError("invalidValue", 400);
    }

    input.currentPassword = body.currentPassword;
  }

  if (
    Object.keys(input).every(
      (key) => key === "currentPassword"
    )
  ) {
    throw new ApiError("emptyUpdate", 400);
  }

  return input;
}

/* ==========================================================
   VALIDATION DES COORDONNÉES
========================================================== */

function validIban(value: string): boolean {
  const iban = value.replace(/\s+/g, "").toUpperCase();

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);

  let remainder = 0;

  for (const character of rearranged) {
    const code = character.charCodeAt(0);

    const digits =
      code >= 65 && code <= 90
        ? String(code - 55)
        : character;

    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
}

function validateAccount(
  type: MethodType,
  provider: string,
  countryCode: string,
  assetCode: string | null,
  networkCode: string | null,
  details: AccountDetails
): string {
  const reference = details.reference.trim();

  if (type === "MOBILE_MONEY") {
    if (!isMobileMoneyProviderInCountry(provider, countryCode)) {
      throw new ApiError("invalidProvider", 400);
    }

    const phone = normalizeWithdrawalPhone(reference, countryCode);
    if (!phone) throw new ApiError("invalidPhone", 400);
    return phone;
  }

  if (type === "BANK_ACCOUNT") {
    if (provider !== "BANK_TRANSFER") {
      throw new ApiError("invalidProvider", 400);
    }

    const compact = reference.replace(/\s+/g, "");

    if (/^[A-Za-z]{2}\d{2}/.test(compact)) {
      if (!validIban(compact)) {
        throw new ApiError("invalidBankReference", 400);
      }

      return compact.toUpperCase();
    }

    if (!/^[A-Za-z0-9/.\-]{4,50}$/.test(compact)) {
      throw new ApiError("invalidBankReference", 400);
    }

    return compact;
  }

  if (type === "CRYPTO") {
    if (!assetCode || !networkCode || provider !== assetCode) {
      throw new ApiError("invalidNetwork", 400);
    }

    if (
      !getCryptoNetwork(assetCode, networkCode)
    ) {
      throw new ApiError("invalidNetwork", 400);
    }

    if (assetCode === "BTC") {
      if (
        networkCode !== "BITCOIN" ||
        !/^(?:bc1[a-z0-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
          reference
        )
      ) {
        throw new ApiError("invalidCryptoAddress", 400);
      }

      return reference;
    }

    if (assetCode === "USDT") {
      const valid =
        networkCode === "TRC20"
          ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(reference)
          : networkCode === "SOLANA"
            ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(reference)
            : networkCode === "ERC20" ||
                networkCode === "POLYGON" ||
                networkCode === "ARBITRUM"
              ? /^0x[a-fA-F0-9]{40}$/.test(reference)
              : false;

      if (!valid) {
        throw new ApiError("invalidCryptoAddress", 400);
      }

      return reference;
    }
  }

  throw new ApiError("invalidCryptoAddress", 400);
}

/* ==========================================================
   CHIFFREMENT DES COORDONNÉES

   Variable serveur :
   TIKEMIA_PAYOUT_ENCRYPTION_KEY

   Clé :
   32 octets encodés en Base64.

   Format :
   v1:IV:TAG:CIPHERTEXT

   Cette convention doit également être
   utilisée par le POST et la future API
   de retrait pour déchiffrer les données.
========================================================== */

function getEncryptionKey(): Buffer {
  const encoded =
    process.env.TIKEMIA_PAYOUT_ENCRYPTION_KEY;

  if (!encoded) {
    throw new Error("PAYOUT_ENCRYPTION_KEY_MISSING");
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error("PAYOUT_ENCRYPTION_KEY_INVALID");
  }

  return key;
}

function encryptAccountDetails(
  details: AccountDetails
): string {
  const key = getEncryptionKey();

  const iv = randomBytes(12);

  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const plaintext = JSON.stringify(details);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function maskAccount(
  type: MethodType,
  reference: string
): string {
  const clean = reference.replace(/\s/g, "");

  const visible = clean.slice(-4);

  if (type === "CRYPTO") {
    return `${clean.slice(0, 6)}…${visible}`;
  }

  return `•••• ${visible}`;
}

/* ==========================================================
   VÉRIFICATION RENFORCÉE

   Les changements financiers sensibles
   nécessitent le mot de passe actuel.

   Cette version reconnaît bcrypt.
========================================================== */

async function verifyPassword(
  organizer: OrganizerContext,
  password?: string
) {
  if (!password) {
    throw new ApiError("passwordRequired", 403);
  }

  if (
    !organizer.passwordHash ||
    !/^\$2[ab]\$\d{2}\$/.test(organizer.passwordHash)
  ) {
    throw new ApiError("passwordUnsupported", 409);
  }

  const valid = await compare(
    password,
    organizer.passwordHash
  );

  if (!valid) {
    throw new ApiError("incorrectPassword", 403);
  }
}

/* ==========================================================
   LECTURE D'UN MOYEN APPARTENANT
   À L'ORGANISATEUR
========================================================== */

async function findOwnedDestination(
  prisma: PrismaClient,
  id: string,
  organizer: OrganizerContext
) {
  return prisma.payoutDestination.findFirst({
    where: {
      id,
      organizationId: {
        in: organizer.organizationIds,
      },
    },
  });
}

function serializeDestination(
  destination: {
    id: string;
    organizationId: string;
    provider: string;
    type: string;
    accountName: string;
    countryCode: string;
    currency: string;
    label: string | null;
    maskedAccountRef: string | null;
    bankName: string | null;
    assetCode: string | null;
    networkCode: string | null;
    isDefault: boolean;
    isVerified: boolean;
    isActive: boolean;
    verifiedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return {
    id: destination.id,
    organizationId: destination.organizationId,
    provider: destination.provider,
    type: destination.type,
    accountName: destination.accountName,
    countryCode: destination.countryCode,
    currency: destination.currency,
    label: destination.label,
    maskedAccountRef: destination.maskedAccountRef,
    bankName: destination.bankName,
    assetCode: destination.assetCode,
    networkCode: destination.networkCode,
    isDefault: destination.isDefault,
    isVerified: destination.isVerified,
    isActive: destination.isActive,
    verifiedAt: destination.verifiedAt?.toISOString() ?? null,
    deletedAt: destination.deletedAt?.toISOString() ?? null,
    createdAt: destination.createdAt.toISOString(),
    updatedAt: destination.updatedAt.toISOString(),
  };
}

/* ==========================================================
   GESTION CENTRALISÉE DES ERREURS
========================================================== */

function handleError(
  error: unknown,
  language: Language
) {
  if (error instanceof ApiError) {
    return errorResponse(language, error.key, error.status);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return errorResponse(language, "conflict", 409);
  }

  console.error(
    "[TIKEMIA WITHDRAWAL METHOD]",
    error instanceof Error ? error.name : "UnknownError"
  );

  return errorResponse(language, "serverError", 503);
}

/* ==========================================================
   PATCH — MODIFIER LE MOYEN DE RETRAIT
========================================================== */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const language = getLanguage(request);

  try {
    if (!isSameOrigin(request)) {
      throw new ApiError("forbidden", 403);
    }

    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      throw new ApiError("invalidId", 400);
    }

    const prisma = getPrisma();

    const organizer = await authenticateOrganizer(
      request,
      prisma
    );

    if (!organizer) {
      throw new ApiError("unauthorized", 401);
    }

    const body = await readJson(request);

    if (!body) {
      throw new ApiError("invalidBody", 400);
    }

    const input = parsePatch(body);

    const destination = await findOwnedDestination(
      prisma,
      id,
      organizer
    );

    if (!destination) {
      throw new ApiError("notFound", 404);
    }

    if (!destination.isActive || destination.deletedAt) {
      throw new ApiError("alreadyRemoved", 409);
    }

    const type = destination.type as MethodType;

    if (
      !["MOBILE_MONEY", "BANK_ACCOUNT", "CRYPTO"].includes(type)
    ) {
      throw new ApiError("invalidValue", 409);
    }

    /* ------------------------------------------------------
       Le type du moyen reste immuable.

       Pour passer de Mobile Money à Banque,
       l'organisateur doit ajouter un nouveau
       moyen, ce qui préserve l'historique.
    ------------------------------------------------------ */

    const provider =
      input.provider ?? destination.provider;

    const countryCode =
      input.countryCode ?? destination.countryCode;

    const currency =
      input.currency ?? destination.currency;

    const assetCode =
      input.assetCode !== undefined
        ? input.assetCode
        : destination.assetCode;

    const networkCode =
      input.networkCode !== undefined
        ? input.networkCode
        : destination.networkCode;

    const sensitiveChange =
      input.accountName !== undefined ||
      input.bankName !== undefined ||
      input.accountDetails !== undefined ||
      input.provider !== undefined ||
      input.countryCode !== undefined ||
      input.currency !== undefined ||
      input.assetCode !== undefined ||
      input.networkCode !== undefined;

    if (sensitiveChange) {
      await verifyPassword(
        organizer,
        input.currentPassword
      );
    }

    /* ------------------------------------------------------
       Si l'opérateur, le pays ou le réseau
       change, exiger les nouvelles coordonnées
       complètes afin d'éviter un compte incohérent.
    ------------------------------------------------------ */

    const destinationChanged =
      provider !== destination.provider ||
      countryCode !== destination.countryCode ||
      currency !== destination.currency ||
      assetCode !== destination.assetCode ||
      networkCode !== destination.networkCode;

    if (
      destinationChanged &&
      !input.accountDetails
    ) {
      throw new ApiError("invalidAccount", 400);
    }

    if (
      type === "BANK_ACCOUNT" &&
      input.bankName === null
    ) {
      throw new ApiError("invalidValue", 400);
    }

    if (
      type === "BANK_ACCOUNT" &&
      !(input.bankName ?? destination.bankName)
    ) {
      throw new ApiError("invalidValue", 400);
    }

    if (
      type === "MOBILE_MONEY" &&
      !isMobileMoneyProviderInCountry(
        provider,
        countryCode
      )
    ) {
      throw new ApiError("invalidProvider", 400);
    }

    if (type === "BANK_ACCOUNT" && provider !== "BANK_TRANSFER") {
      throw new ApiError("invalidProvider", 400);
    }

    if (type === "CRYPTO") {
      if (
        !assetCode ||
        !networkCode ||
        provider !== assetCode ||
        !getCryptoNetwork(assetCode, networkCode)
      ) {
        throw new ApiError("invalidNetwork", 400);
      }
    }

    let encryptedAccount: string | undefined;
    let maskedAccount: string | undefined;

    if (input.accountDetails) {
      const normalizedReference = validateAccount(
        type,
        provider,
        countryCode,
        assetCode,
        networkCode,
        input.accountDetails
      );

      encryptedAccount = encryptAccountDetails({
        ...input.accountDetails,
        reference: normalizedReference,
      });

      maskedAccount = maskAccount(
        type,
        normalizedReference
      );
    }

    /* ------------------------------------------------------
       Éviter de modifier des coordonnées
       utilisées par un retrait en cours.
    ------------------------------------------------------ */

    const saved = await prisma.$transaction(
      async (tx) => {
        /* --------------------------------------------------
           Sérialiser les modifications de moyens
           au niveau de l'organisation.
        -------------------------------------------------- */

        await tx.$executeRaw`
          SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${destination.organizationId}))) AS organization_lock
        `;

        const current = await tx.payoutDestination.findFirst({
          where: {
            id,
            organizationId: destination.organizationId,
            isActive: true,
            deletedAt: null,
          },
        });

        if (!current) {
          throw new ApiError("notFound", 404);
        }

        if (sensitiveChange) {
          const activePayout = await tx.payout.findFirst({
            where: {
              destinationId: id,
              status: {
                in: [...ACTIVE_PAYOUT_STATUSES],
              },
            },
            select: {
              id: true,
            },
          });

          if (activePayout) {
            throw new ApiError("activePayout", 409);
          }
        }

        const nextDefault =
          input.isDefault ?? current.isDefault;

        /* --------------------------------------------------
           Un seul moyen par défaut
           pour l'organisation.
        -------------------------------------------------- */

        if (nextDefault) {
          await tx.payoutDestination.updateMany({
            where: {
              organizationId: current.organizationId,
              id: {
                not: id,
              },
              isDefault: true,
            },
            data: {
              isDefault: false,
            },
          });
        }

        const updated = await tx.payoutDestination.update({
          where: {
            id,
          },
          data: {
            ...(input.label !== undefined
              ? { label: input.label }
              : {}),

            ...(input.accountName !== undefined
              ? { accountName: input.accountName }
              : {}),

            ...(input.bankName !== undefined
              ? { bankName: input.bankName }
              : {}),

            ...(input.provider !== undefined
              ? { provider }
              : {}),

            ...(input.countryCode !== undefined
              ? { countryCode }
              : {}),

            ...(input.currency !== undefined
              ? { currency }
              : {}),

            ...(input.assetCode !== undefined
              ? { assetCode }
              : {}),

            ...(input.networkCode !== undefined
              ? { networkCode }
              : {}),

            ...(encryptedAccount !== undefined
              ? {
                  accountRefEncrypted: encryptedAccount,
                  maskedAccountRef: maskedAccount,
                }
              : {}),

            isDefault: nextDefault,

            ...(sensitiveChange
              ? {
                  isVerified: false,
                  verifiedAt: null,
                }
              : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: organizer.userId,
            action: "PAYOUT_DESTINATION_UPDATED",
            entity: "PayoutDestination",
            entityId: id,
            metadata: {
              organizationId: current.organizationId,
              changedFields: Object.keys(input).filter(
                (key) => key !== "currentPassword"
              ),
              sensitiveChange,
              isDefault: nextDefault,
            },
          },
        });

        if (sensitiveChange) {
          await tx.securityEvent.create({
            data: {
              userId: organizer.userId,
              type: "PAYOUT_DESTINATION_CHANGED",
              metadata: {
                destinationId: id,
              },
            },
          });
        }

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      }
    );

    return respond({
      success: true,

      message:
        input.isDefault === true && !sensitiveChange
          ? TEXT[language].defaultUpdated
          : TEXT[language].updated,

      destination: serializeDestination(saved),

      verificationRequired: sensitiveChange,
    });
  } catch (error) {
    return handleError(error, language);
  }
}

/* ==========================================================
   DELETE — DÉSACTIVER UN MOYEN DE RETRAIT

   Suppression logique uniquement.

   Historique Payout :
   conservé.

   Compte bancaire chiffré :
   conservé pour les obligations financières.

   Moyen par défaut :
   retiré.

   Aucun retrait actif :
   obligatoire avant désactivation.
========================================================== */

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const language = getLanguage(request);

  try {
    if (!isSameOrigin(request)) {
      throw new ApiError("forbidden", 403);
    }

    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      throw new ApiError("invalidId", 400);
    }

    const prisma = getPrisma();

    const organizer = await authenticateOrganizer(
      request,
      prisma
    );

    if (!organizer) {
      throw new ApiError("unauthorized", 401);
    }

    const destination = await findOwnedDestination(
      prisma,
      id,
      organizer
    );

    if (!destination) {
      throw new ApiError("notFound", 404);
    }

    if (!destination.isActive || destination.deletedAt) {
      throw new ApiError("alreadyRemoved", 409);
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${destination.organizationId}))) AS organization_lock
        `;

        const current = await tx.payoutDestination.findFirst({
          where: {
            id,
            organizationId: destination.organizationId,
            isActive: true,
            deletedAt: null,
          },
        });

        if (!current) {
          throw new ApiError("alreadyRemoved", 409);
        }

        /* --------------------------------------------------
           Ne jamais retirer un compte
           pendant qu'un paiement sortant
           est en cours de traitement.
        -------------------------------------------------- */

        const activePayout = await tx.payout.findFirst({
          where: {
            destinationId: id,
            status: {
              in: [...ACTIVE_PAYOUT_STATUSES],
            },
          },
          select: {
            id: true,
          },
        });

        if (activePayout) {
          throw new ApiError("activePayout", 409);
        }

        const removedAt = new Date();

        const result = await tx.payoutDestination.update({
          where: {
            id,
          },
          data: {
            isActive: false,
            isDefault: false,
            deletedAt: removedAt,
          },
        });

        /* --------------------------------------------------
           Ne pas définir automatiquement
           un autre compte comme moyen
           par défaut.

           L'organisateur choisira lui-même
           le nouveau moyen principal.
        -------------------------------------------------- */

        await tx.auditLog.create({
          data: {
            actorId: organizer.userId,
            action: "PAYOUT_DESTINATION_REMOVED",
            entity: "PayoutDestination",
            entityId: id,
            metadata: {
              organizationId: current.organizationId,
              previousDefault: current.isDefault,
              softDelete: true,
            },
          },
        });

        await tx.securityEvent.create({
          data: {
            userId: organizer.userId,
            type: "PAYOUT_DESTINATION_REMOVED",
            metadata: {
              destinationId: id,
            },
          },
        });

        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      }
    );

    return respond({
      success: true,
      message: TEXT[language].removed,
      destination: {
        id: updated.id,
        isActive: updated.isActive,
        isDefault: updated.isDefault,
        deletedAt: updated.deletedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleError(error, language);
  }
}
