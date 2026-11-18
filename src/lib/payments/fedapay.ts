import type { PaymentCheckoutConnector } from "@/lib/payments/types";
import { currencyDecimals } from "@/i18n/config";

import "server-only";

import type {
  PaymentEnvironment,
  PaymentMoney,
  PaymentNextAction,
  PaymentProviderAdapter,
  ProviderPaymentRequest,
  ProviderPaymentResult,
  ProviderPaymentStatus,
  ProviderPaymentVerification,
} from "@/lib/payments/types";

/* =========================================================
   TIKEMIA — FEDAPAY SERVER CONNECTOR
========================================================= */

const FEDAPAY_URLS = {
  sandbox: "https://sandbox-api.fedapay.com/v1",
  live: "https://api.fedapay.com/v1",
} as const;

const REQUEST_TIMEOUT_MS = 15_000;
const RESPONSE_LIMIT_BYTES = 256_000;
const MAX_AMOUNT_MINOR = 9_223_372_036_854_775_807n;

export const FEDAPAY_DIRECT_METHODS = [
  "mtn_open",
  "moov",
  "sbin",
  "mtn_ci",
  "moov_tg",
  "togocel",
  "free_sn",
  "airtel_ne",
  "mtn_open_gn",
] as const;

export type FedaPayDirectMethod =
  (typeof FEDAPAY_DIRECT_METHODS)[number];

export type FedaPayEnvironment =
  PaymentEnvironment;

export type FedaPayErrorCode =
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_API_RESPONSE"
  | "TRANSACTION_NOT_FOUND"
  | "PAYMENT_NOT_CONFIRMED";

export class FedaPayError extends Error {
  constructor(
    public readonly code: FedaPayErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly httpStatus: number | null = null,
    public readonly submissionUncertain: boolean = false
  ) {
    super(message);
    this.name = "FedaPayError";
  }
}

/* =========================================================
   TYPES INTERNES
========================================================= */

type JsonRecord = Record<string, unknown>;

type FedaPayConfig = {
  environment: FedaPayEnvironment;
  secretKey: string;
  apiBaseUrl: string;
};

type FedaPayRequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: JsonRecord;
};

export interface FedaPayTransaction {
  id: string;
  reference: string | null;
  status: ProviderPaymentStatus;
  rawStatus: string;
  amount: PaymentMoney;
  createdAt: string | null;
}

export interface FedaPayToken {
  transactionId: string;
  token: string;
  url: string | null;
}

export interface FedaPayDirectPaymentRequest {
  transactionId: string;
  token: string;
  method: FedaPayDirectMethod;
}

export interface FedaPayDirectPaymentResult {
  transactionId: string;
  method: FedaPayDirectMethod;
  acceptedForProcessing: boolean;
  status: ProviderPaymentStatus;
  responseAt: string;
}

export type FedaPayCreateTransactionInput = {
  orderId: string;
  description: string;
  amount: PaymentMoney;
  customer: {
    email: string;
    phone: string;
    countryCode: string;
    firstName?: string;
    lastName?: string;
  };
  callbackUrl?: string;
};

/* =========================================================
   VALIDATION
========================================================= */

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asRecord(
  value: unknown,
  label: string
): JsonRecord {
  if (!isRecord(value)) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      `${label} : réponse FedaPay invalide.`
    );
  }

  return value;
}

function nonEmptyString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result.length > 0 ? result : null;
}

function getString(
  value: unknown
): string | null {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  return nonEmptyString(value);
}

function requireIdentifier(
  value: unknown,
  label: string
): string {
  const result = getString(value);

  if (
    !result ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(result)
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      `${label} invalide.`
    );
  }

  return result;
}

function requireText(
  value: unknown,
  label: string,
  maxLength = 255
): string {
  const result = nonEmptyString(value);

  if (
    !result ||
    result.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(result)
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      `${label} invalide.`
    );
  }

  return result;
}

function requireEmail(
  value: unknown
): string {
  const email = requireText(
    value,
    "Adresse email",
    254
  ).toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Adresse email invalide."
    );
  }

  return email;
}

function requireCountryCode(
  value: unknown
): string {
  const country = requireText(
    value,
    "Pays",
    2
  ).toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Code pays invalide."
    );
  }

  return country;
}

function requirePhone(
  value: unknown
): string {
  const phone = requireText(
    value,
    "Téléphone",
    32
  ).replace(/[\s().-]/g, "");

  if (!/^\+?[0-9]{6,15}$/.test(phone)) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Numéro de téléphone invalide."
    );
  }

  return phone;
}

function requireCurrency(
  value: unknown
): string {
  const currency = requireText(
    value,
    "Devise",
    3
  ).toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Code devise invalide."
    );
  }

  return currency;
}

function requireMinorAmount(
  value: unknown
): bigint {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(value)
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Montant invalide."
    );
  }

  const amount = BigInt(value);

  if (
    amount <= 0n ||
    amount > MAX_AMOUNT_MINOR
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Montant hors limites."
    );
  }

  return amount;
}

function validateMoney(
  money: PaymentMoney
): {
  currency: string;
  amountMinor: bigint;
  exponent: number;
  amountMajor: number;
} {
  if (!isRecord(money)) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Données monétaires invalides."
    );
  }

  const currency = requireCurrency(
    money.currency
  );

  const amountMinor = requireMinorAmount(
    money.amountMinor
  );

  if (
    !Number.isInteger(money.exponent) ||
    money.exponent < 0 ||
    money.exponent > 18
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Exposant monétaire invalide."
    );
  }

  const divisor =
    10n ** BigInt(money.exponent);

  /*
   * FedaPay attend un montant entier.
   * Nous refusons toute conversion
   * impliquant une perte de décimales.
   */
  if (amountMinor % divisor !== 0n) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Ce montant comporte des décimales non prises en charge par cette intégration FedaPay."
    );
  }

  const major = amountMinor / divisor;

  if (
    major <= 0n ||
    major > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Montant incompatible avec l'API FedaPay."
    );
  }

  return {
    currency,
    amountMinor,
    exponent: money.exponent,
    amountMajor: Number(major),
  };
}

function resolveEnvironment():
  FedaPayEnvironment {
  const value =
    process.env.FEDAPAY_ENVIRONMENT;

  if (
    value !== "sandbox" &&
    value !== "live"
  ) {
    throw new FedaPayError(
      "CONFIGURATION_ERROR",
      "FEDAPAY_ENVIRONMENT doit être sandbox ou live."
    );
  }

  return value;
}

function getConfig(): FedaPayConfig {
  const environment =
    resolveEnvironment();

  const key =
    environment === "live"
      ? process.env.FEDAPAY_LIVE_SECRET_KEY
      : process.env.FEDAPAY_SANDBOX_SECRET_KEY;

  if (
    !key ||
    !key.trim() ||
    /[\r\n]/.test(key)
  ) {
    throw new FedaPayError(
      "CONFIGURATION_ERROR",
      "Clé secrète FedaPay absente ou invalide."
    );
  }

  if (
    environment === "live" &&
    process.env.FEDAPAY_LIVE_ENABLED !== "true"
  ) {
    throw new FedaPayError(
      "CONFIGURATION_ERROR",
      "Les paiements FedaPay LIVE ne sont pas autorisés sur ce serveur."
    );
  }

  return {
    environment,
    secretKey: key.trim(),
    apiBaseUrl: FEDAPAY_URLS[environment],
  };
}

export function getFedaPayEnvironment():
  FedaPayEnvironment {
  return getConfig().environment;
}

/* =========================================================
   HTTP CLIENT
========================================================= */

async function readResponseBody(
  response: Response
): Promise<unknown> {
  if (!response.body) {
    return null;
  }

  const reader = response.body.getReader();

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) {
        break;
      }

      size += part.value.byteLength;

      if (size > RESPONSE_LIMIT_BYTES) {
        throw new FedaPayError(
          "INVALID_API_RESPONSE",
          "La réponse FedaPay dépasse la limite autorisée."
        );
      }

      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk))
  ).toString("utf8");

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "FedaPay a retourné une réponse non JSON."
    );
  }
}

function errorFromHttp(
  status: number,
  method: "GET" | "POST"
): FedaPayError {
  const uncertain = method === "POST";

  if (status === 401 || status === 403) {
    return new FedaPayError(
      "AUTHENTICATION_ERROR",
      "Authentification FedaPay refusée.",
      false,
      status,
      uncertain
    );
  }

  if (status === 404) {
    return new FedaPayError(
      "TRANSACTION_NOT_FOUND",
      "Ressource FedaPay introuvable.",
      false,
      status,
      uncertain
    );
  }

  if (status === 429 || status >= 500) {
    return new FedaPayError(
      "PROVIDER_UNAVAILABLE",
      "Le service FedaPay est indisponible.",
      true,
      status,
      uncertain
    );
  }

  return new FedaPayError(
    "PROVIDER_REJECTED",
    "La requête a été refusée par FedaPay.",
    false,
    status,
    uncertain
  );
}

async function fedapayRequest(
  options: FedaPayRequestOptions
): Promise<unknown> {
  const config = getConfig();

  if (
    !/^\/[A-Za-z0-9_/-]+$/.test(options.path) ||
    options.path.includes("//") ||
    options.path.includes("..")
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Chemin API FedaPay invalide."
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  let response: Response;

  try {
    response = await fetch(
      `${config.apiBaseUrl}${options.path}`,
      {
        method: options.method,
        headers: {
          Authorization:
            `Bearer ${config.secretKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body:
          options.method === "POST"
            ? JSON.stringify(options.body ?? {})
            : undefined,
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      }
    );
  } catch {
    const timeoutOccurred =
      controller.signal.aborted;

    throw new FedaPayError(
      timeoutOccurred
        ? "PROVIDER_TIMEOUT"
        : "PROVIDER_UNAVAILABLE",
      timeoutOccurred
        ? "Délai de réponse FedaPay dépassé."
        : "Connexion à FedaPay impossible.",
      true,
      null,
      options.method === "POST"
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw errorFromHttp(
      response.status,
      options.method
    );
  }

  /*
   * Ne jamais journaliser le corps brut :
   * il pourrait contenir des informations
   * sensibles provenant du prestataire.
   */
  return readResponseBody(response);
}

/* =========================================================
   NORMALISATION DES RÉPONSES
========================================================= */

function unwrapTransaction(
  payload: unknown
): JsonRecord {
  const root = asRecord(
    payload,
    "Transaction"
  );

  const candidate =
    root["v1/transaction"] ??
    root["transaction"] ??
    root["data"] ??
    root;

  const transaction = asRecord(
    candidate,
    "Transaction"
  );

  /*
   * Certaines réponses enveloppent
   * une seconde fois l'objet transaction.
   */
  if (
    isRecord(transaction["transaction"])
  ) {
    return transaction["transaction"];
  }

  return transaction;
}

function normalizeStatus(
  raw: string
): ProviderPaymentStatus {
  switch (raw.toLowerCase()) {
    case "approved":
    case "transferred":
      return "successful";

    case "pending":
      return "pending";

    case "declined":
    case "failed":
      return "failed";

    case "canceled":
    case "cancelled":
      return "cancelled";

    default:
      return "unknown";
  }
}

function parseAmount(
  value: unknown
): bigint {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return BigInt(value);
  }

  if (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/.test(value)
  ) {
    return BigInt(value);
  }

  throw new FedaPayError(
    "INVALID_API_RESPONSE",
    "Montant de transaction FedaPay invalide."
  );
}

function readCurrencyIso(
  value: unknown
): string {
  let currency: unknown = value;

  if (isRecord(value)) {
    currency = value["iso"];
  }

  const iso = nonEmptyString(currency);

  if (!iso || !/^[A-Z]{3}$/i.test(iso)) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "Devise FedaPay absente ou invalide."
    );
  }

  return iso.toUpperCase();
}

function isoDateOrNull(
  value: unknown
): string | null {
  const text = nonEmptyString(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

async function normalizeTransaction(
  payload: unknown,
  expectedId?: string,
  expectedMoney?: PaymentMoney
): Promise<FedaPayTransaction> {
  const item = unwrapTransaction(payload);

  const id = getString(item["id"]);

  const rawStatus =
    nonEmptyString(item["status"]);

  if (!id || !rawStatus) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "Identifiant ou statut de transaction FedaPay manquant."
    );
  }

  if (
    expectedId &&
    id !== expectedId
  ) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "Identifiant de transaction inattendu."
    );
  }

  if (!item["currency"] && Number.isSafeInteger(Number(item["currency_id"])) && Number(item["currency_id"]) > 0) {
    const result = await fedapayRequest({ method: "GET", path: `/currencies/${Number(item["currency_id"])}` });
    const record = result as Record<string, unknown>;
    item["currency"] = record["v1/currency"] ?? record["currency"];
  }
  const currency = readCurrencyIso(
    item["currency"]
  );

  /*
   * L'API FedaPay utilise un montant
   * entier dans l'unité de la devise.
   *
   * Pour la comparaison, nous convertissons
   * vers les unités mineures attendues.
   */
  const majorAmount =
    parseAmount(item["amount"]);

  const exponent =
    expectedMoney?.exponent ??
    currencyDecimals(currency);

  if (
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > 18
  ) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "Précision monétaire invalide."
    );
  }

  const amountMinor =
    majorAmount *
    (10n ** BigInt(exponent));

  if (
    amountMinor > MAX_AMOUNT_MINOR
  ) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "Montant de transaction hors limites."
    );
  }

  const money: PaymentMoney = {
    currency,
    amountMinor:
      amountMinor.toString(),
    exponent,
  };

  if (expectedMoney) {
    if (
      expectedMoney.currency !== currency ||
      expectedMoney.amountMinor !==
        money.amountMinor
    ) {
      throw new FedaPayError(
        "INVALID_API_RESPONSE",
        "La transaction FedaPay ne correspond pas au montant ou à la devise attendus."
      );
    }
  }

  return {
    id,
    reference:
      getString(item["reference"]),

    rawStatus,
    status:
      normalizeStatus(rawStatus),

    amount: money,

    createdAt:
      isoDateOrNull(
        item["created_at"] ??
        item["createdAt"]
      ),
  };
}

function normalizeToken(
  payload: unknown,
  transactionId: string
): FedaPayToken {
  const root = asRecord(
    payload,
    "Token"
  );

  const item = isRecord(root["data"])
    ? root["data"]
    : root;

  const token = nonEmptyString(
    item["token"]
  );

  if (!token) {
    throw new FedaPayError(
      "INVALID_API_RESPONSE",
      "Token de paiement FedaPay manquant."
    );
  }

  const url = nonEmptyString(
    item["url"]
  );

  let safeUrl: string | null = null;

  if (url) {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new FedaPayError(
        "INVALID_API_RESPONSE",
        "URL du paiement FedaPay invalide."
      );
    }

    const host =
      parsed.hostname.toLowerCase();

    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !(
        host === "fedapay.com" ||
        host.endsWith(".fedapay.com")
      )
    ) {
      throw new FedaPayError(
        "INVALID_API_RESPONSE",
        "Destination du paiement FedaPay non autorisée."
      );
    }

    safeUrl = parsed.toString();
  }

  return {
    transactionId,
    token,
    url: safeUrl,
  };
}

/* =========================================================
   CRÉATION D'UNE TRANSACTION
========================================================= */

export async function createFedaPayTransaction(
  input: FedaPayCreateTransactionInput,
  persistReference?: (reference: string) => Promise<void>
): Promise<FedaPayTransaction> {
  requireIdentifier(
    input.orderId,
    "Commande"
  );

  const description = requireText(
    input.description,
    "Description",
    255
  );

  const money = validateMoney(
    input.amount
  );

  const customer = {
    email: requireEmail(
      input.customer.email
    ),

    phone: requirePhone(
      input.customer.phone
    ),

    countryCode: requireCountryCode(
      input.customer.countryCode
    ),
  };

  const customerPayload: JsonRecord = {
    email: customer.email,

    phone_number: {
      number: customer.phone,
      country: customer.countryCode,
    },
  };

  /*
   * Les noms ne sont ajoutés
   * que lorsqu'ils existent réellement.
   */
  if (
    input.customer.firstName &&
    input.customer.lastName
  ) {
    customerPayload["firstname"] =
      requireText(
        input.customer.firstName,
        "Prénom",
        100
      );

    customerPayload["lastname"] =
      requireText(
        input.customer.lastName,
        "Nom",
        100
      );
  }

  const body: JsonRecord = {
    description,
    amount: money.amountMajor,
    currency: {
      iso: money.currency,
    },
    customer: customerPayload,
    custom_metadata: { tikemia_reference: input.orderId },
  };

  if (input.callbackUrl) {
    let url: URL;

    try {
      url = new URL(
        input.callbackUrl
      );
    } catch {
      throw new FedaPayError(
        "VALIDATION_ERROR",
        "URL de retour invalide."
      );
    }

    if (
      url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV ===
          "development" &&
        url.protocol === "http:" &&
        url.hostname === "localhost"
      )
    ) {
      throw new FedaPayError(
        "VALIDATION_ERROR",
        "L'URL de retour doit utiliser HTTPS."
      );
    }

    /*
     * L'appelant doit construire
     * cette URL depuis la configuration
     * serveur et non depuis l'utilisateur.
     */
    body["callback_url"] =
      url.toString();
  }

  const response =
    await fedapayRequest({
      method: "POST",
      path: "/transactions",
      body,
    });

  const createdId = getString(unwrapTransaction(response)["id"]);
  if (!createdId || !Number.isSafeInteger(Number(createdId)) || Number(createdId) <= 0) throw new FedaPayError("INVALID_API_RESPONSE", "Invalid transaction identifier.");
  if (persistReference) await persistReference(createdId);
  return normalizeTransaction(
    response,
    undefined,
    input.amount
  );
}

/* =========================================================
   GÉNÉRATION DU TOKEN DE PAIEMENT
========================================================= */

export async function generateFedaPayToken(
  transactionId: string
): Promise<FedaPayToken> {
  const id = requireIdentifier(
    transactionId,
    "Transaction"
  );

  const response =
    await fedapayRequest({
      method: "POST",
      path:
        `/transactions/${encodeURIComponent(id)}/token`,
    });

  return normalizeToken(
    response,
    id
  );
}

/* =========================================================
   PAIEMENT MOBILE MONEY SANS REDIRECTION
========================================================= */

export function isFedaPayDirectMethod(
  value: string
): value is FedaPayDirectMethod {
  return (
    FEDAPAY_DIRECT_METHODS as readonly string[]
  ).includes(value);
}

export async function initiateFedaPayDirectPayment(
  input: FedaPayDirectPaymentRequest
): Promise<FedaPayDirectPaymentResult> {
  const transactionId =
    requireIdentifier(
      input.transactionId,
      "Transaction"
    );

  const token = requireText(
    input.token,
    "Token",
    4096
  );

  if (
    !isFedaPayDirectMethod(
      input.method
    )
  ) {
    throw new FedaPayError(
      "VALIDATION_ERROR",
      "Cette méthode n'est pas prise en charge en paiement direct FedaPay."
    );
  }

  /*
   * Appel unique.
   *
   * Ne pas relancer automatiquement
   * cette requête en cas de timeout.
   *
   * L'état doit être consulté avec
   * le transactionId enregistré.
   */
  await fedapayRequest({
    method: "POST",
    path: `/${input.method}`,
    body: {
      token,
    },
  });

  return {
    transactionId,
    method: input.method,
    acceptedForProcessing: true,
    status: "pending",
    responseAt:
      new Date().toISOString(),
  };
}

/* =========================================================
   CONSULTATION DU STATUT
========================================================= */

export async function getFedaPayTransaction(
  transactionId: string,
  expectedMoney?: PaymentMoney
): Promise<FedaPayTransaction> {
  const id = requireIdentifier(
    transactionId,
    "Transaction"
  );

  const response =
    await fedapayRequest({
      method: "GET",
      path:
        `/transactions/${encodeURIComponent(id)}`,
    });

  return normalizeTransaction(
    response,
    id,
    expectedMoney
  );
}

/* =========================================================
   CONFIRMATION FINANCIÈRE
========================================================= */

export async function verifyFedaPayTransaction(
  transactionId: string,
  expectedMoney: PaymentMoney
): Promise<ProviderPaymentVerification> {
  validateMoney(expectedMoney);

  const transaction =
    await getFedaPayTransaction(
      transactionId,
      expectedMoney
    );

  return {
    providerTransactionId:
      transaction.id,

    providerReference:
      transaction.reference,

    status:
      transaction.status,

    amount:
      transaction.amount,

    verifiedAt:
      new Date().toISOString(),

    source:
      "authenticated_api",
  };
}

/* =========================================================
   ADAPTATEUR COMMUN TIKEMIA
========================================================= */

export class FedaPayAdapter
  implements PaymentProviderAdapter {
  readonly code = "fedapay" as const;

  readonly environment:
    PaymentEnvironment;

  constructor() {
    this.environment =
      getFedaPayEnvironment();
  }

  async createPayment(
    request: ProviderPaymentRequest
  ): Promise<ProviderPaymentResult> {
    const transaction =
      await createFedaPayTransaction({
        orderId: request.orderId,

        description:
          request.description,

        amount:
          request.amount,

        customer: {
          email:
            request.customer.email,

          phone:
            request.customer.phone,

          countryCode:
            request.customer.countryCode,
        },
      });

    /*
     * Cette méthode crée uniquement
     * la transaction FedaPay.
     *
     * La couche d'orchestration doit :
     *
     * 1. Enregistrer l'ID en base.
     * 2. Générer le token.
     * 3. Déclencher le mode choisi.
     * 4. Contrôler le résultat.
     */
    const nextAction:
      PaymentNextAction = {
        type: "none",
      };

    return {
      providerTransactionId:
        transaction.id,

      providerReference:
        transaction.reference,

      status:
        transaction.status,

      nextAction,

      createdAt:
        transaction.createdAt ??
        new Date().toISOString(),
    };
  }

  async getPayment(
    providerTransactionId: string
  ): Promise<ProviderPaymentVerification> {
    const transaction =
      await getFedaPayTransaction(
        providerTransactionId
      );

    return {
      providerTransactionId:
        transaction.id,

      providerReference:
        transaction.reference,

      status:
        transaction.status,

      amount:
        transaction.amount,

      verifiedAt:
        new Date().toISOString(),

      source:
        "authenticated_api",
    };
  }
}

/* =========================================================
   INSTANCIATION
========================================================= */

export function createFedaPayAdapter():
  PaymentProviderAdapter {
  return new FedaPayAdapter();
}

/* =========================================================
   AIDE AU SUIVI DES TRANSACTIONS
========================================================= */

export function isFedaPayPaymentSuccessful(
  status: ProviderPaymentStatus
): boolean {
  return status === "successful";
}

export function isFedaPayPaymentTerminal(
  status: ProviderPaymentStatus
): boolean {
  return (
    status === "successful" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function assertFedaPayPaymentConfirmed(
  verification: ProviderPaymentVerification,
  expected: {
    transactionId: string;
    amount: PaymentMoney;
  }
): void {
  if (
    verification.source !== "authenticated_api" ||
    verification.providerTransactionId !==
      expected.transactionId ||
    verification.status !== "successful" ||
    verification.amount.currency !==
      expected.amount.currency ||
    verification.amount.amountMinor !==
      expected.amount.amountMinor ||
    verification.amount.exponent !==
      expected.amount.exponent
  ) {
    throw new FedaPayError(
      "PAYMENT_NOT_CONFIRMED",
      "Le paiement n'a pas été confirmé avec les informations attendues."
    );
  }
}

export async function withFedaPayConnection<T>(_connectionId: string | undefined, action: () => Promise<T>): Promise<T> { return action(); }
export async function withFedaPayPayment<T>(_paymentId: string, action: () => Promise<T>): Promise<T> { return action(); }

// The connector catalogue describes the provider's documented payment rails.
// Account-level authorization is performed by the API and embedded checkout;
// it is not an administrator-maintained VERIFIED_METHODS allow-list.
function brandLogo(label: string, color: string): string {
  const graphic = label === "Mastercard"
    ? '<circle cx="20" cy="24" r="15" fill="#eb001b"/><circle cx="36" cy="24" r="15" fill="#f79e1b" fill-opacity=".9"/>'
    : '<rect width="64" height="48" rx="24" fill="' + color + '"/><text x="32" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="' + (label === "VISA" ? '17' : '12') + '" font-weight="bold" fill="white">' + label + '</text>';
  return "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">' + graphic + '</svg>').toString("base64");
}

let directHealth: { key: string; until: number } | undefined;
let directHealthRequest: { key: string; promise: Promise<void> } | undefined;
async function verifyDirectConfiguration(): Promise<void> {
  const config = getConfig();
  const key = config.environment + ":" + config.secretKey;
  if (directHealth?.key === key && directHealth.until > Date.now()) return;
  if (directHealthRequest?.key === key) return directHealthRequest.promise;
  const promise = (async () => {
    const response = await fetch(config.apiBaseUrl + "/transactions/search?per_page=1", {
      method: "GET", headers: { Authorization: "Bearer " + config.secretKey },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (!response.ok) throw new FedaPayError("AUTHENTICATION_ERROR", "Payment connection could not be verified.", false, response.status);
    directHealth = { key, until: Date.now() + 60_000 };
  })();
  directHealthRequest = { key, promise };
  try { await promise; } finally { if (directHealthRequest?.promise === promise) directHealthRequest = undefined; }
}

export const fedapayCheckout: PaymentCheckoutConnector = {
  async listMethods(query) {
    let environment: PaymentEnvironment;
    try { environment = getConfig().environment; } catch { return []; }
    if (!["XOF", "GNF"].includes(query.currencyCode) || BigInt(query.amountMinor ?? "1") > BigInt(Number.MAX_SAFE_INTEGER)) return [];
    await verifyDirectConfiguration();
    const catalogue = await fedapayRequest({ method: "GET", path: "/currencies" }) as Record<string, unknown>;
    const currencies = catalogue["v1/currencies"] ?? catalogue["currencies"];
    const currency = Array.isArray(currencies) ? currencies.find((item: unknown) => isRecord(item) && item["iso"] === query.currencyCode) : undefined;
    if (!isRecord(currency) || !Array.isArray(currency["modes"])) return [];
    const modes = currency["modes"].filter((mode: unknown): mode is string => typeof mode === "string");
    const publicKey = environment === "live" ? process.env.FEDAPAY_LIVE_PUBLIC_KEY : process.env.FEDAPAY_SANDBOX_PUBLIC_KEY;
    const widget = !!publicKey && new RegExp("^pk_" + environment + "_[A-Za-z0-9_-]+$").test(publicKey);
    if (!widget) return [];
    const mobile = query.currencyCode === "XOF" ? [
      { id: "mtn_mobile_money", name: "MTN Mobile Money", code: "mtn_open", logo: "/payment-logos/mtn-momo.svg", category: "mobile_money" as const },
      { id: "moov_money", name: "Moov Money", code: "moov", logo: "/payment-logos/moov-money.svg", category: "mobile_money" as const },
      { id: "celtiis_cash", name: "Celtiis Cash", code: "sbin", logo: brandLogo("celtiis", "#203b77"), category: "mobile_money" as const },
    ] : [{ id: "mtn_mobile_money", name: "MTN Mobile Money", code: "mtn_open_gn", logo: "/payment-logos/mtn-momo.svg", category: "mobile_money" as const }];
    const embedded = widget ? [
      ...(query.currencyCode === "XOF" ? [
        { id: "orange_money", name: "Orange Money", code: "checkout_mobile", logo: "/payment-logos/orange-money.svg", category: "mobile_money" as const },
        { id: "airtel_money", name: "Airtel Money", code: "checkout_mobile", logo: "/payment-logos/airtel-money.svg", category: "mobile_money" as const },
        { id: "t_money", name: "T-Money", code: "checkout_mobile", logo: "/payment-logos/t-money.svg", category: "mobile_money" as const },
        { id: "free_money", name: "Free Money", code: "checkout_mobile", logo: brandLogo("Free", "#d90000"), category: "mobile_money" as const },
        { id: "wave", name: "Wave", code: "checkout_wave", logo: "/payment-logos/wave.svg", category: "wallet" as const },
      ] : []),
      { id: "visa", name: "Visa", code: "checkout_card", logo: brandLogo("VISA", "#1a1f71"), category: "card" as const },
      { id: "mastercard", name: "Mastercard", code: "checkout_card", logo: brandLogo("Mastercard", "#000000"), category: "card" as const },
    ] : [];
    return [...mobile, ...embedded].filter(item => {
      const prefixes: Record<string, string[]> = { mtn_mobile_money: ["mtn"], moov_money: ["moov"], celtiis_cash: ["sbin"], orange_money: ["orange"], airtel_money: ["airtel"], t_money: ["togocel"], free_money: ["free"], wave: ["wave"], visa: ["cybersource", "stripe", "gim_uemoa_card"], mastercard: ["cybersource", "stripe", "gim_uemoa_card"] };
      return (prefixes[item.id] ?? []).some(prefix => modes.some(mode => mode === prefix || mode.startsWith(prefix + "_")));
    }).map((item, index) => ({
      method: { id: item.id, code: item.category === "card" ? "checkout_card" : item.id === "wave" ? "checkout_wave" : "checkout_mobile", name: item.name, category: item.category, logoUrl: item.logo,
        provider: "fedapay", countries: [], currencies: [query.currencyCode], enabled: true, verified: false,
        supportedInCheckout: true, mayRequireExternalAuthentication: true, displayOrder: index },
      route: { provider: "fedapay", methodId: item.id, countryCode: "", currencyCode: query.currencyCode, environment, priority: 1, enabled: true },
      checkedAt: new Date().toISOString(),
    }));
  },
  supportsMethod(code) { return isFedaPayDirectMethod(code) || ["checkout_mobile", "checkout_wave", "checkout_card"].includes(code); },
  async initiate(connectionId, request, persistReference) {
    return withFedaPayConnection(connectionId, async () => {
      if (!this.supportsMethod(request.paymentMethodCode) || !["XOF", "GNF"].includes(request.amount.currency)) throw new FedaPayError("VALIDATION_ERROR", "Unsupported payment channel.");
      const environment = getConfig().environment;
      const publicKey = environment === "live" ? process.env.FEDAPAY_LIVE_PUBLIC_KEY : process.env.FEDAPAY_SANDBOX_PUBLIC_KEY;
      if (!publicKey || !new RegExp("^pk_" + environment + "_[A-Za-z0-9_-]+$").test(publicKey)) throw new FedaPayError("CONFIGURATION_ERROR", "Public checkout key is missing.");
      const transaction = await createFedaPayTransaction({ orderId: request.idempotencyKey, description: request.description, amount: request.amount, customer: request.customer }, persistReference);
      // Creating the transaction does not submit a Mobile Money debit. The
      // customer authorizes it inside the embedded provider checkout.
      const transactionId = Number(transaction.id);
      if (!Number.isSafeInteger(transactionId) || transactionId <= 0) throw new FedaPayError("INVALID_API_RESPONSE", "Invalid checkout transaction.");
      return { type: "embedded_checkout", publicKey, environment, transactionId };

    });
  },
  verify(paymentId, reference, expected) { return withFedaPayPayment(paymentId, () => verifyFedaPayTransaction(reference, expected)); },
  resume(paymentId, reference) {
    return withFedaPayPayment(paymentId, async () => {
      const environment = getConfig().environment;
      const publicKey = environment === "live" ? process.env.FEDAPAY_LIVE_PUBLIC_KEY : process.env.FEDAPAY_SANDBOX_PUBLIC_KEY;
      const transactionId = Number(reference);
      if (!publicKey || !new RegExp("^pk_" + environment + "_[A-Za-z0-9_-]+$").test(publicKey) || !Number.isSafeInteger(transactionId) || transactionId <= 0) return { type: "none" };
      return { type: "embedded_checkout", publicKey, environment, transactionId };
    });
  },
};
