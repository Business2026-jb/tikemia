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
  type WithdrawalMethodType,
} from "@/lib/withdrawal-providers";

/* ==========================================================
   TIKEMIA — MOYENS DE RETRAIT

   Fichier :
   src/app/api/organizer/settings/
   withdrawal-methods/route.ts

   GET :
   - Liste des moyens de retrait
   - Filtrage par type
   - Filtrage par organisation
   - Pagination
   - Coordonnées masquées
   - Statut de vérification
   - Moyen par défaut

   POST :
   - Ajouter un moyen de retrait
   - Mobile Money
   - Compte bancaire
   - Bitcoin / USDT
   - Vérification du mot de passe
   - Chiffrement AES-256-GCM
   - Définition du moyen par défaut
   - Historique de sécurité

   Cette API ne réalise aucun transfert.

   Technologies :
   - Next.js App Router
   - Prisma ORM 7
   - PostgreSQL
   - TypeScript
   - bcryptjs
========================================================== */




/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE =
  "tikemia_organizer_session";

const SESSION_PATTERN =
  /^[a-f0-9]{64}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 8192;

const DEFAULT_PAGE_SIZE = 20;

const MAX_PAGE_SIZE = 50;

const MAX_DESTINATIONS_PER_ORGANIZATION = 20;

const MAX_LABEL_LENGTH = 80;

const MAX_NAME_LENGTH = 160;

const MAX_BANK_NAME_LENGTH = 160;

const MAX_PASSWORD_BYTES = 1024;

const FAILED_PASSWORD_EVENT =
  "PAYOUT_DESTINATION_PASSWORD_FAILED";

const MAX_FAILED_PASSWORD_ATTEMPTS = 5;

const PASSWORD_LOCK_MINUTES = 15;

const WITHDRAWAL_TYPES = [
  "MOBILE_MONEY",
  "BANK_ACCOUNT",
  "CRYPTO",
] as const;

const ALLOWED_BODY_FIELDS = new Set([
  "organizationId",
  "type",
  "provider",
  "countryCode",
  "currency",
  "accountName",
  "accountDetails",
  "bankName",
  "label",
  "assetCode",
  "networkCode",
  "isDefault",
  "currentPassword",
]);

const ALLOWED_ACCOUNT_FIELDS = new Set([
  "reference",
  "bic",
  "routingCode",
]);

type Language = "fr" | "en";

type MethodType = WithdrawalMethodType;

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

type CreateInput = {
  organizationId?: string;
  type: MethodType;
  provider: string;
  countryCode: string;
  currency: string;
  accountName: string;
  accountDetails: AccountDetails;
  bankName: string | null;
  label: string | null;
  assetCode: string | null;
  networkCode: string | null;
  isDefault: boolean;
  currentPassword: string;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidRequest"
  | "invalidFields"
  | "invalidOrganization"
  | "invalidType"
  | "invalidProvider"
  | "invalidCountry"
  | "invalidCurrency"
  | "invalidName"
  | "invalidBank"
  | "invalidBankReference"
  | "invalidCryptoAddress"
  | "invalidPhone"
  | "invalidAccount"
  | "invalidNetwork"
  | "passwordRequired"
  | "incorrectPassword"
  | "passwordUnsupported"
  | "tooManyAttempts"
  | "tooManyMethods"
  | "conflict"
  | "serverError";

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Cette opération n'est pas autorisée.",

    invalidRequest:
      "Les informations envoyées sont invalides ou trop volumineuses.",

    invalidFields:
      "La requête contient des champs non autorisés.",

    invalidOrganization:
      "L'organisation sélectionnée est invalide ou ne vous appartient pas.",

    invalidType:
      "Le type de moyen de retrait est invalide.",

    invalidProvider:
      "L'opérateur sélectionné est invalide pour ce pays ou ce moyen de retrait.",

    invalidCountry:
      "Veuillez sélectionner un pays valide.",

    invalidCurrency:
      "Veuillez sélectionner une devise valide.",

    invalidName:
      "Veuillez renseigner le nom du titulaire.",

    invalidBank:
      "Veuillez renseigner un nom de banque valide.",

    invalidBankReference: "Verifiez le numero de compte bancaire ou l'IBAN complet (avec sa cle de controle).",
    invalidCryptoAddress: "Verifiez l'adresse du portefeuille et le reseau selectionne.",
    invalidPhone: "Le numero Mobile Money est invalide pour le pays choisi. Verifiez le pays et saisissez le numero local complet ou avec son indicatif (+...).",
    invalidAccount:
      "Les coordonnées du compte sont invalides.",

    invalidNetwork:
      "La cryptomonnaie ou le réseau blockchain est invalide.",

    passwordRequired:
      "Votre mot de passe actuel est nécessaire pour ajouter un moyen de retrait.",

    incorrectPassword:
      "Le mot de passe actuel est incorrect.",

    passwordUnsupported:
      "La vérification du mot de passe n'est pas disponible pour ce compte. Configurez d'abord un mot de passe sécurisé.",

    tooManyAttempts:
      "Trop de tentatives incorrectes. Veuillez réessayer plus tard.",

    tooManyMethods:
      "Vous avez atteint le nombre maximum de moyens de retrait pour cette organisation.",

    conflict:
      "Une modification simultanée a été détectée. Veuillez réessayer.",

    serverError:
      "Impossible de traiter les moyens de retrait pour le moment.",

    loaded:
      "Moyens de retrait récupérés avec succès.",

    created:
      "Votre moyen de retrait a été enregistré. Il devra être vérifié avant tout retrait.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "This operation is not authorized.",

    invalidRequest:
      "Invalid or oversized request data.",

    invalidFields:
      "The request contains unauthorized fields.",

    invalidOrganization:
      "The selected organization is invalid or does not belong to you.",

    invalidType:
      "Invalid withdrawal method type.",

    invalidProvider:
      "The selected provider is not valid for this country or withdrawal method.",

    invalidCountry:
      "Please select a valid country.",

    invalidCurrency:
      "Please select a valid currency.",

    invalidName:
      "Please enter the account holder's name.",

    invalidBank:
      "Please enter a valid bank name.",

    invalidBankReference: "Check the bank account number or complete IBAN (including its check digits).",
    invalidCryptoAddress: "Check the wallet address and the selected network.",
    invalidPhone: "The Mobile Money number is invalid for the selected country. Check the country and enter the complete local number or its international dialing code (+...).",
    invalidAccount:
      "Invalid account details.",

    invalidNetwork:
      "Invalid cryptocurrency or blockchain network.",

    passwordRequired:
      "Your current password is required to add a withdrawal method.",

    incorrectPassword:
      "Your current password is incorrect.",

    passwordUnsupported:
      "Password verification is unavailable for this account. Set up a secure password first.",

    tooManyAttempts:
      "Too many incorrect attempts. Please try again later.",

    tooManyMethods:
      "You have reached the maximum number of withdrawal methods for this organization.",

    conflict:
      "A concurrent modification was detected. Please try again.",

    serverError:
      "Unable to process withdrawal methods right now.",

    loaded:
      "Withdrawal methods retrieved successfully.",

    created:
      "Your withdrawal method has been saved. Verification is required before withdrawal.",
  },
} as const;

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
   PRISMA ORM 7
========================================================== */

const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE
========================================================== */

function getLanguage(
  request: NextRequest
): Language {
  const requested =
    request.nextUrl.searchParams.get("locale");

  if (requested === "fr" || requested === "en") {
    return requested;
  }

  return (
    request.headers.get("accept-language") ?? ""
  ).toLowerCase().startsWith("en")
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

      "Pragma": "no-cache",

      "X-Content-Type-Options": "nosniff",

      Vary: "Cookie",
    },
  });
}

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    {
      success: false,
      message: TEXT[language][key],
    },
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",

        "X-Content-Type-Options": "nosniff",

        Vary: "Cookie",

        ...headers,
      },
    }
  );
}

/* ==========================================================
   PROTECTION CSRF
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

   Le userId est lu depuis la session.

   Aucun userId fourni par le navigateur
   ne peut définir le propriétaire.
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<OrganizerContext | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

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

  const organizations =
    await prisma.organization.findMany({
      where: {
        ownerId: user.id,
        isActive: true,
      },

      select: {
        id: true,
      },
    });

  if (
    organizations.length === 0
  ) {
    return null;
  }

  return {
    userId: user.id,

    passwordHash:
      user.passwordHash,

    organizationIds:
      organizations.map(
        (organization) => organization.id
      ),
  };
}

/* ==========================================================
   UTILITAIRES DE VALIDATION
========================================================== */

function asRecord(
  value: unknown
): JsonRecord | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function cleanText(
  value: unknown,
  maximum: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text =
    value.trim().replace(/[ \t]+/g, " ");

  if (
    text.length === 0 ||
    text.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    return null;
  }

  return text;
}

function normalizeCode(
  value: string
): string {
  return value.trim().toUpperCase();
}

function optionalText(
  value: unknown,
  maximum: number
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const result = cleanText(value, maximum);

  if (!result) {
    throw new ApiError("invalidRequest", 400);
  }

  return result;
}

function validCurrency(
  value: string
): boolean { return isSupportedCurrency(value); }

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number {
  if (!value) {
    return fallback;
  }

  if (!/^\d{1,7}$/.test(value)) {
    throw new ApiError("invalidRequest", 400);
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    throw new ApiError("invalidRequest", 400);
  }

  return Math.min(parsed, maximum);
}

/* ==========================================================
   LECTURE JSON LIMITÉE
========================================================== */

async function readLimitedJson(
  request: NextRequest
): Promise<JsonRecord | null> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("application/json")
  ) {
    return null;
  }

  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    const length = Number(contentLength);

    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      return null;
    }
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

    const raw =
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes);

    const parsed: unknown =
      JSON.parse(raw);

    return asRecord(parsed);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DU COMPTE BANCAIRE

   IBAN :
   - Format
   - Vérification MOD 97

   Autres pays :
   - Numéro de compte local
   - Code bancaire adapté

   La validation complète du compte
   sera effectuée par le prestataire.
========================================================== */

function validIban(
  value: string
): boolean {
  const iban =
    value.replace(/\s+/g, "").toUpperCase();

  if (
    iban.length < 15 ||
    iban.length > 34 ||
    !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)
  ) {
    return false;
  }

  const rearranged =
    iban.slice(4) + iban.slice(0, 4);

  let remainder = 0;

  for (const character of rearranged) {
    const charCode =
      character.charCodeAt(0);

    const digits =
      charCode >= 65 && charCode <= 90
        ? String(charCode - 55)
        : character;

    for (const digit of digits) {
      remainder =
        (remainder * 10 + Number(digit)) %
        97;
    }
  }

  return remainder === 1;
}

/* ==========================================================
   VALIDATION DU FORMULAIRE

   Contrat :

   {
     organizationId?: string,
     type: "MOBILE_MONEY" | "BANK_ACCOUNT" | "CRYPTO",
     provider: string,
     countryCode: string,
     currency: string,
     accountName: string,
     accountDetails: {
       reference: string,
       bic?: string,
       routingCode?: string
     },
     bankName?: string,
     label?: string,
     assetCode?: "BTC" | "USDT",
     networkCode?: string,
     isDefault?: boolean,
     currentPassword: string
   }
========================================================== */

function validateCreateBody(
  body: JsonRecord
): CreateInput {
  for (const field of Object.keys(body)) {
    if (!ALLOWED_BODY_FIELDS.has(field)) {
      throw new ApiError("invalidFields", 400);
    }
  }

  let organizationId: string | undefined;

  if (
    body.organizationId !== undefined &&
    body.organizationId !== null
  ) {
    if (
      typeof body.organizationId !== "string" ||
      !UUID_PATTERN.test(body.organizationId)
    ) {
      throw new ApiError("invalidOrganization", 400);
    }

    organizationId =
      body.organizationId.toLowerCase();
  }

  if (
    typeof body.type !== "string" ||
    !WITHDRAWAL_TYPES.includes(
      body.type as MethodType
    )
  ) {
    throw new ApiError("invalidType", 400);
  }

  const type =
    body.type as MethodType;

  if (typeof body.provider !== "string") {
    throw new ApiError("invalidProvider", 400);
  }

  const provider =
    normalizeCode(body.provider);

  if (!/^[A-Z0-9_]{2,64}$/.test(provider)) {
    throw new ApiError("invalidProvider", 400);
  }

  if (typeof body.countryCode !== "string") {
    throw new ApiError("invalidCountry", 400);
  }

  const countryCode =
    normalizeCode(body.countryCode);

  if (!isValidCountryCode(countryCode)) {
    throw new ApiError("invalidCountry", 400);
  }

  if (typeof body.currency !== "string") {
    throw new ApiError("invalidCurrency", 400);
  }

  const currency =
    normalizeCode(body.currency);

  if (!validCurrency(currency)) {
    throw new ApiError("invalidCurrency", 400);
  }

  const accountName =
    cleanText(body.accountName, MAX_NAME_LENGTH);

  if (!accountName) {
    throw new ApiError("invalidName", 400);
  }

  const bankName =
    optionalText(body.bankName, MAX_BANK_NAME_LENGTH);

  const label =
    optionalText(body.label, MAX_LABEL_LENGTH);

  if (
    body.isDefault !== undefined &&
    typeof body.isDefault !== "boolean"
  ) {
    throw new ApiError("invalidRequest", 400);
  }

  const isDefault =
    body.isDefault === true;

  if (
    typeof body.currentPassword !== "string" ||
    body.currentPassword.length === 0
  ) {
    throw new ApiError("passwordRequired", 403);
  }

  if (
    Buffer.byteLength(
      body.currentPassword,
      "utf8"
    ) > MAX_PASSWORD_BYTES
  ) {
    throw new ApiError("invalidRequest", 400);
  }

  const detailsRecord =
    asRecord(body.accountDetails);

  if (!detailsRecord) {
    throw new ApiError("invalidAccount", 400);
  }

  for (
    const field of Object.keys(detailsRecord)
  ) {
    if (!ALLOWED_ACCOUNT_FIELDS.has(field)) {
      throw new ApiError("invalidAccount", 400);
    }
  }

  const reference =
    cleanText(detailsRecord.reference, 250);

  if (!reference) {
    throw new ApiError("invalidAccount", 400);
  }

  const bic =
    optionalText(detailsRecord.bic, 11);

  const routingCode =
    optionalText(detailsRecord.routingCode, 35);

  if (
    bic &&
    !/^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/.test(
      bic
    )
  ) {
    throw new ApiError("invalidAccount", 400);
  }

  const accountDetails: AccountDetails = {
    reference,

    ...(bic
      ? {
          bic: bic.toUpperCase(),
        }
      : {}),

    ...(routingCode
      ? {
          routingCode,
        }
      : {}),
  };

  let assetCode: string | null = null;

  let networkCode: string | null = null;

  if (type === "MOBILE_MONEY") {
    if (
      !isMobileMoneyProviderInCountry(
        provider,
        countryCode
      )
    ) {
      throw new ApiError("invalidProvider", 400);
    }

    if (
      body.assetCode != null ||
      body.networkCode != null
    ) {
      throw new ApiError("invalidRequest", 400);
    }

    if (bankName) {
      throw new ApiError("invalidRequest", 400);
    }
  }

  if (type === "BANK_ACCOUNT") {
    if (provider !== "BANK_TRANSFER") {
      throw new ApiError("invalidProvider", 400);
    }

    if (!bankName) {
      throw new ApiError("invalidBank", 400);
    }

    if (
      body.assetCode != null ||
      body.networkCode != null
    ) {
      throw new ApiError("invalidRequest", 400);
    }
  }

  if (type === "CRYPTO") {
    if (
      typeof body.assetCode !== "string" ||
      typeof body.networkCode !== "string"
    ) {
      throw new ApiError("invalidNetwork", 400);
    }

    assetCode =
      normalizeCode(body.assetCode);

    networkCode =
      normalizeCode(body.networkCode);

    if (
      provider !== assetCode ||
      !getCryptoNetwork(
        assetCode,
        networkCode
      )
    ) {
      throw new ApiError("invalidNetwork", 400);
    }

    if (bankName || bic || routingCode) {
      throw new ApiError("invalidRequest", 400);
    }
  }

  return {
    organizationId,
    type,
    provider,
    countryCode,
    currency,
    accountName,
    accountDetails,
    bankName,
    label,
    assetCode,
    networkCode,
    isDefault,
    currentPassword:
      body.currentPassword,
  };
}

/* ==========================================================
   NORMALISATION DES COORDONNÉES

   Le contrôle est adapté à chaque type.

   Les formats crypto sont contrôlés
   syntaxiquement seulement.

   Une vérification spécialisée du réseau
   reste obligatoire avant l'exécution
   effective d'un retrait.
========================================================== */

function normalizeAccountReference(
  input: CreateInput
): string {
  const reference =
    input.accountDetails.reference.trim();

  if (input.type === "MOBILE_MONEY") {
    const phone = normalizeWithdrawalPhone(reference, input.countryCode);
    if (!phone) throw new ApiError("invalidPhone", 400);
    return phone;
  }

  if (input.type === "BANK_ACCOUNT") {
    const compact =
      reference.replace(/\s+/g, "");

    if (/^[A-Za-z]{2}\d{2}/.test(compact)) {
      if (!validIban(compact)) {
        throw new ApiError("invalidBankReference", 400);
      }

      return compact.toUpperCase();
    }

    if (
      !/^[A-Za-z0-9/.\-]{4,50}$/.test(compact)
    ) {
      throw new ApiError("invalidBankReference", 400);
    }

    return compact;
  }

  if (input.type === "CRYPTO") {
    if (
      input.assetCode === "BTC" &&
      input.networkCode === "BITCOIN"
    ) {
      const isBitcoinAddress =
        /^(?:bc1[a-z0-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
          reference
        );

      if (!isBitcoinAddress) {
        throw new ApiError("invalidCryptoAddress", 400);
      }

      return reference;
    }

    if (input.assetCode === "USDT") {
      let valid = false;

      switch (input.networkCode) {
        case "TRC20":
          valid =
            /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(
              reference
            );
          break;

        case "SOLANA":
          valid =
            /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
              reference
            );
          break;

        case "ERC20":
        case "POLYGON":
        case "ARBITRUM":
          valid =
            /^0x[a-fA-F0-9]{40}$/.test(
              reference
            );
          break;

        default:
          valid = false;
      }

      if (!valid) {
        throw new ApiError("invalidCryptoAddress", 400);
      }

      return reference;
    }

    throw new ApiError("invalidNetwork", 400);
  }

  throw new ApiError("invalidType", 400);
}

/* ==========================================================
   CHIFFREMENT AES-256-GCM

   Même format que l'API [id] :

   v1:IV:TAG:CIPHERTEXT

   Variable serveur :
   TIKEMIA_PAYOUT_ENCRYPTION_KEY

   La clé doit contenir 32 octets
   encodés en Base64.

   Ne jamais la rendre publique.
========================================================== */

function getEncryptionKey(): Buffer {
  const encoded =
    process.env.TIKEMIA_PAYOUT_ENCRYPTION_KEY;

  if (!encoded) {
    throw new Error(
      "PAYOUT_ENCRYPTION_KEY_MISSING"
    );
  }

  const key =
    Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error(
      "PAYOUT_ENCRYPTION_KEY_INVALID"
    );
  }

  return key;
}

function encryptAccountDetails(
  details: AccountDetails
): string {
  const key =
    getEncryptionKey();

  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  const plaintext =
    JSON.stringify(details);

  const encrypted =
    Buffer.concat([
      cipher.update(
        plaintext,
        "utf8"
      ),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/* ==========================================================
   MASQUER LES COORDONNÉES

   Les données complètes ne doivent
   jamais être retournées par le GET.
========================================================== */

function maskAccount(
  type: MethodType,
  reference: string
): string {
  const clean =
    reference.replace(/\s/g, "");

  if (type === "CRYPTO") {
    return (
      `${clean.slice(0, 6)}…${clean.slice(-4)}`
    );
  }

  return `•••• ${clean.slice(-4)}`;
}

/* ==========================================================
   SÉRIALISATION PUBLIQUE

   accountRefEncrypted est volontairement
   exclu de toutes les réponses.
========================================================== */

type DestinationView = {
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
  isActive: boolean;
  isVerified: boolean;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeDestination(
  destination: DestinationView
) {
  return {
    id: destination.id,

    organizationId:
      destination.organizationId,

    provider:
      destination.provider,

    type:
      destination.type,

    accountName:
      destination.accountName,

    countryCode:
      destination.countryCode,

    currency:
      destination.currency,

    label:
      destination.label,

    maskedAccountRef:
      destination.maskedAccountRef,

    bankName:
      destination.bankName,

    assetCode:
      destination.assetCode,

    networkCode:
      destination.networkCode,

    isDefault:
      destination.isDefault,

    isActive:
      destination.isActive,

    isVerified:
      destination.isVerified,

    verificationRequired:
      !destination.isVerified,

    verifiedAt:
      destination.verifiedAt?.toISOString() ??
      null,

    lastUsedAt:
      destination.lastUsedAt?.toISOString() ??
      null,

    createdAt:
      destination.createdAt.toISOString(),

    updatedAt:
      destination.updatedAt.toISOString(),
  };
}

/* ==========================================================
   VÉRIFICATION DU MOT DE PASSE

   Le hash doit être bcrypt.

   Les comptes sans mot de passe
   utilisent une procédure de création
   de mot de passe séparée.
========================================================== */

async function verifyOrganizerPassword(
  organizer: OrganizerContext,
  password: string
): Promise<boolean> {
  if (
    !organizer.passwordHash ||
    !/^\$2[ab]\$\d{2}\$/.test(
      organizer.passwordHash
    )
  ) {
    throw new ApiError("passwordUnsupported", 409);
  }

  return compare(
    password,
    organizer.passwordHash
  );
}

/* ==========================================================
   LIMITATION DES TENTATIVES

   Le journal SecurityEvent conserve
   les tentatives incorrectes.

   Ce contrôle ne remplace pas
   une limitation distribuée en production.
========================================================== */

function lockWindowStart(): Date {
  return new Date(
    Date.now() -
      PASSWORD_LOCK_MINUTES * 60_000
  );
}

async function countFailedAttempts(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  return prisma.securityEvent.count({
    where: {
      userId,

      type:
        FAILED_PASSWORD_EVENT,

      createdAt: {
        gte: lockWindowStart(),
      },
    },
  });
}

async function recordFailedAttempt(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      userId,

      type:
        FAILED_PASSWORD_EVENT,

      metadata: {
        source:
          "organizer_settings",

        operation:
          "create_withdrawal_method",
      },
    },
  });
}

/* ==========================================================
   ERREURS
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
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (
      error.code === "P2034" ||
      error.code === "P2002"
    )
  ) {
    return errorResponse(
      language,
      "conflict",
      409
    );
  }

  console.error(
    "[TIKEMIA WITHDRAWAL METHODS]",
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
   GET — MES MOYENS DE RETRAIT

   Exemple :
   /api/organizer/settings/withdrawal-methods

   Paramètres facultatifs :
   - organizationId
   - type
   - page
   - pageSize

   Le résultat est limité aux
   organisations possédées par
   l'utilisateur connecté.
========================================================== */

export async function GET(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    const prisma =
      getPrisma();

    const organizer =
      await authenticateOrganizer(
        request,
        prisma
      );

    if (!organizer) {
      throw new ApiError("unauthorized", 401);
    }

    const params =
      request.nextUrl.searchParams;

    const requestedOrganization =
      params.get("organizationId");

    const requestedType =
      params.get("type");

    const page =
      parsePositiveInteger(
        params.get("page"),
        1,
        1_000_000
      );

    const pageSize =
      parsePositiveInteger(
        params.get("pageSize"),
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

    if (
      requestedOrganization &&
      (
        !UUID_PATTERN.test(requestedOrganization) ||
        !organizer.organizationIds.includes(
          requestedOrganization
        )
      )
    ) {
      throw new ApiError("invalidOrganization", 403);
    }

    if (
      requestedType &&
      !WITHDRAWAL_TYPES.includes(
        requestedType as MethodType
      )
    ) {
      throw new ApiError("invalidType", 400);
    }

    const organizationIds =
      requestedOrganization
        ? [requestedOrganization]
        : organizer.organizationIds;

    const where: Prisma.PayoutDestinationWhereInput = {
      organizationId: {
        in: organizationIds,
      },

      isActive: true,

      deletedAt: null,

      ...(requestedType
        ? {
            type:
              requestedType,
          }
        : {}),
    };

    const [
      total,
      destinations,
    ] = await prisma.$transaction(
      [
        prisma.payoutDestination.count({
          where,
        }),

        prisma.payoutDestination.findMany({
          where,

          orderBy: [
            {
              isDefault: "desc",
            },
            {
              createdAt: "desc",
            },
            {
              id: "desc",
            },
          ],

          skip:
            (page - 1) * pageSize,

          take:
            pageSize,

          select: {
            id: true,

            organizationId: true,

            provider: true,

            type: true,

            accountName: true,

            countryCode: true,

            currency: true,

            label: true,

            maskedAccountRef: true,

            bankName: true,

            assetCode: true,

            networkCode: true,

            isDefault: true,

            isActive: true,

            isVerified: true,

            verifiedAt: true,

            lastUsedAt: true,

            createdAt: true,

            updatedAt: true,
          },
        }),
      ],
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .RepeatableRead,
      }
    );

    const totalPages =
      Math.max(
        1,
        Math.ceil(total / pageSize)
      );

    const items =
      destinations.map(
        serializeDestination
      );

    return respond({
      success: true,

      message:
        TEXT[language].loaded,

      destinations: items,

      // Alias simple pour l'interface Paramètres.
      methods: items,

      pagination: {
        page,

        pageSize,

        total,

        totalPages,

        hasPrevious:
          page > 1,

        hasNext:
          page < totalPages,
      },
    });
  } catch (error) {
    return handleError(error, language);
  }
}

/* ==========================================================
   POST — AJOUTER UN MOYEN DE RETRAIT

   1. Vérifier la requête
   2. Authentifier l'organisateur
   3. Valider le formulaire
   4. Vérifier le mot de passe
   5. Valider les coordonnées
   6. Chiffrer les coordonnées
   7. Enregistrer avec Prisma
   8. Journaliser l'opération

   Le moyen est enregistré avec :
   isVerified = false

   Aucun retrait n'est possible simplement
   parce qu'un compte est enregistré.
========================================================== */

export async function POST(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    /* ------------------------------------------------------
       1. ORIGINE
    ------------------------------------------------------ */

    if (!isSameOrigin(request)) {
      throw new ApiError("forbidden", 403);
    }

    /* ------------------------------------------------------
       2. AUTHENTIFICATION
    ------------------------------------------------------ */

    const prisma =
      getPrisma();

    const organizer =
      await authenticateOrganizer(
        request,
        prisma
      );

    if (!organizer) {
      throw new ApiError("unauthorized", 401);
    }

    /* ------------------------------------------------------
       3. LECTURE DU FORMULAIRE
    ------------------------------------------------------ */

    const body =
      await readLimitedJson(request);

    if (!body) {
      throw new ApiError("invalidRequest", 400);
    }

    const input =
      validateCreateBody(body);

    /* ------------------------------------------------------
       4. ORGANISATION PROPRIÉTAIRE
    ------------------------------------------------------ */

    if (
      input.organizationId &&
      !organizer.organizationIds.includes(
        input.organizationId
      )
    ) {
      throw new ApiError("invalidOrganization", 403);
    }

    /* ------------------------------------------------------
       5. CONTRÔLER LES TENTATIVES
    ------------------------------------------------------ */

    const failedAttempts =
      await countFailedAttempts(
        prisma,
        organizer.userId
      );

    if (
      failedAttempts >=
      MAX_FAILED_PASSWORD_ATTEMPTS
    ) {
      throw new ApiError("tooManyAttempts", 429);
    }

    /* ------------------------------------------------------
       6. VÉRIFIER LE MOT DE PASSE ACTUEL
    ------------------------------------------------------ */

    const passwordValid =
      await verifyOrganizerPassword(
        organizer,
        input.currentPassword
      );

    if (!passwordValid) {
      await recordFailedAttempt(
        prisma,
        organizer.userId
      );

      throw new ApiError("incorrectPassword", 403);
    }

    /* ------------------------------------------------------
       7. VALIDER ET NORMALISER LE COMPTE
    ------------------------------------------------------ */

    const reference =
      normalizeAccountReference(input);

    const accountDetails: AccountDetails = {
      ...input.accountDetails,

      reference,
    };

    /* ------------------------------------------------------
       8. CHIFFRER LES COORDONNÉES

       Le chiffrement se fait côté serveur.

       La clé est lue depuis les variables
       d'environnement privées.
    ------------------------------------------------------ */

    const encryptedAccount =
      encryptAccountDetails(
        accountDetails
      );

    const maskedAccount =
      maskAccount(
        input.type,
        reference
      );

    /* ------------------------------------------------------
       9. TRANSACTION POSTGRESQL
    ------------------------------------------------------ */

    const created =
      await prisma.$transaction(
        async (tx) => {
          /* -----------------------------------------------
             Sélectionner une organisation autorisée.

             Pour plusieurs organisations, il est possible
             de fournir organizationId dans le POST.
          ----------------------------------------------- */

          const organization =
            await tx.organization.findFirst({
              where: {
                id: {
                  in:
                    input.organizationId
                      ? [input.organizationId]
                      : organizer.organizationIds,
                },

                ownerId:
                  organizer.userId,

                isActive: true,
              },

              orderBy: {
                createdAt: "asc",
              },

              select: {
                id: true,
              },
            });

          if (!organization) {
            throw new ApiError(
              "invalidOrganization",
              403
            );
          }

          /* -----------------------------------------------
             Même verrou par organisation que dans
             l'API PATCH / DELETE.

             Cette requête utilise queryRaw,
             car pg_advisory_xact_lock retourne
             une ligne PostgreSQL.
          ----------------------------------------------- */

          await tx.$queryRaw`
            SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${organization.id}))) AS organization_lock
          `;

          /* -----------------------------------------------
             Limiter les moyens enregistrés.

             Les moyens désactivés ne comptent pas
             parmi les comptes actifs.
          ----------------------------------------------- */

          const existingCount =
            await tx.payoutDestination.count({
              where: {
                organizationId:
                  organization.id,

                isActive: true,

                deletedAt: null,
              },
            });

          if (
            existingCount >=
            MAX_DESTINATIONS_PER_ORGANIZATION
          ) {
            throw new ApiError(
              "tooManyMethods",
              409
            );
          }

          /* -----------------------------------------------
             Premier moyen :
             automatiquement sélectionné par défaut.

             Sinon :
             uniquement si l'organisateur le demande.
          ----------------------------------------------- */

          const makeDefault =
            existingCount === 0 ||
            input.isDefault;

          if (makeDefault) {
            await tx.payoutDestination.updateMany({
              where: {
                organizationId:
                  organization.id,

                isActive: true,

                deletedAt: null,

                isDefault: true,
              },

              data: {
                isDefault: false,
              },
            });
          }

          /* -----------------------------------------------
             Création du moyen de retrait.

             Le compte reste non vérifié.
          ----------------------------------------------- */

          const destination =
            await tx.payoutDestination.create({
              data: {
                organizationId:
                  organization.id,

                type:
                  input.type,

                provider:
                  input.provider,

                accountName:
                  input.accountName,

                accountRefEncrypted:
                  encryptedAccount,

                maskedAccountRef:
                  maskedAccount,

                countryCode:
                  input.countryCode,

                currency:
                  input.currency,

                label:
                  input.label,

                bankName:
                  input.bankName,

                assetCode:
                  input.assetCode,

                networkCode:
                  input.networkCode,

                isDefault:
                  makeDefault,

                isActive: true,

                isVerified: false,

                verifiedAt: null,

                deletedAt: null,
              },

              select: {
                id: true,

                organizationId: true,

                provider: true,

                type: true,

                accountName: true,

                countryCode: true,

                currency: true,

                label: true,

                maskedAccountRef: true,

                bankName: true,

                assetCode: true,

                networkCode: true,

                isDefault: true,

                isActive: true,

                isVerified: true,

                verifiedAt: true,

                lastUsedAt: true,

                createdAt: true,

                updatedAt: true,
              },
            });

          /* -----------------------------------------------
             Journal d'audit.

             Aucun numéro de compte, IBAN,
             portefeuille ni mot de passe
             n'est enregistré dans les logs.
          ----------------------------------------------- */

          await tx.auditLog.create({
            data: {
              actorId:
                organizer.userId,

              action:
                "PAYOUT_DESTINATION_CREATED",

              entity:
                "PayoutDestination",

              entityId:
                destination.id,

              metadata: {
                organizationId:
                  organization.id,

                type:
                  input.type,

                provider:
                  input.provider,

                isDefault:
                  makeDefault,
              },
            },
          });

          /* -----------------------------------------------
             Événement de sécurité.
          ----------------------------------------------- */

          await tx.securityEvent.create({
            data: {
              userId:
                organizer.userId,

              type:
                "PAYOUT_DESTINATION_CREATED",

              metadata: {
                destinationId:
                  destination.id,

                organizationId:
                  organization.id,
              },
            },
          });

          return destination;
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,

          timeout: 15000,
        }
      );

    /* ------------------------------------------------------
       10. CONFIRMATION
    ------------------------------------------------------ */

    return respond(
      {
        success: true,

        message:
          TEXT[language].created,

        destination:
          serializeDestination(
            created
          ),

        verificationRequired: true,
      },
      201
    );
  } catch (error) {
    return handleError(error, language);
  }
}
