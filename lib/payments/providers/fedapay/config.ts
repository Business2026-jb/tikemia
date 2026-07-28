import "server-only";

export type FedaPayEnvironment =
  | "sandbox"
  | "live";

export type FedaPayConfig = Readonly<{
  environment: FedaPayEnvironment;

  apiBaseUrl: string;

  secretKey: string;
  publicKey: string | null;
  webhookSecret: string;

  webhookSignatureHeader: string;

  webhookUrl: string;
  successUrl: string;
  cancelUrl: string;

  requestTimeoutMs: number;
  reservationMinutes: number;

  userAgent: string;
}>;

const SANDBOX_API_BASE_URL =
  "https://sandbox-api.fedapay.com/v1";

const LIVE_API_BASE_URL =
  "https://api.fedapay.com/v1";

const DEFAULT_WEBHOOK_SIGNATURE_HEADER =
  "x-fedapay-signature";

const DEFAULT_REQUEST_TIMEOUT_MS =
  15_000;

const DEFAULT_RESERVATION_MINUTES =
  15;

const MIN_REQUEST_TIMEOUT_MS =
  3_000;

const MAX_REQUEST_TIMEOUT_MS =
  60_000;

const MIN_RESERVATION_MINUTES =
  5;

const MAX_RESERVATION_MINUTES =
  60;

let cachedConfig:
  | FedaPayConfig
  | null =
  null;

export class FedaPayConfigurationError extends Error {
  readonly code:
    string;

  constructor({
    code,
    message,
  }: {
    code: string;
    message: string;
  }) {
    super(message);

    this.name =
      "FedaPayConfigurationError";

    this.code =
      code;
  }
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function readRequiredEnvironmentVariable(
  name:
    string,
): string {
  const value =
    normalizeText(
      process.env[
        name
      ],
    );

  if (!value) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_ENVIRONMENT_VARIABLE_MISSING",

      message:
        `La variable d’environnement ${name} est obligatoire pour utiliser FedaPay.`,
    });
  }

  return value;
}

function readOptionalEnvironmentVariable(
  name:
    string,
): string | null {
  const value =
    normalizeText(
      process.env[
        name
      ],
    );

  return value || null;
}

function parseEnvironment(
  value:
    string,
): FedaPayEnvironment {
  const normalizedValue =
    value
      .trim()
      .toLowerCase();

  if (
    normalizedValue ===
      "sandbox" ||
    normalizedValue ===
      "test"
  ) {
    return "sandbox";
  }

  if (
    normalizedValue ===
      "live" ||
    normalizedValue ===
      "production"
  ) {
    return "live";
  }

  throw new FedaPayConfigurationError({
    code:
      "FEDAPAY_ENVIRONMENT_INVALID",

    message:
      'FEDAPAY_ENV doit être égal à "sandbox" ou "live".',
  });
}

function parseIntegerEnvironmentVariable({
  name,
  fallback,
  minimum,
  maximum,
}: {
  name:
    string;
  fallback:
    number;
  minimum:
    number;
  maximum:
    number;
}): number {
  const rawValue =
    normalizeText(
      process.env[
        name
      ],
    );

  if (!rawValue) {
    return fallback;
  }

  const parsedValue =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue <
      minimum ||
    parsedValue >
      maximum
  ) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_NUMERIC_CONFIGURATION_INVALID",

      message:
        `${name} doit être un entier compris entre ${minimum} et ${maximum}.`,
    });
  }

  return parsedValue;
}

function normalizeAbsoluteHttpsUrl({
  value,
  name,
  allowHttpOnLocalhost = false,
}: {
  value:
    string;
  name:
    string;
  allowHttpOnLocalhost?:
    boolean;
}): string {
  let parsedUrl:
    URL;

  try {
    parsedUrl =
      new URL(
        value,
      );
  } catch {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_URL_INVALID",

      message:
        `${name} doit contenir une URL absolue valide.`,
    });
  }

  const isLocalhost =
    parsedUrl.hostname ===
      "localhost" ||
    parsedUrl.hostname ===
      "127.0.0.1" ||
    parsedUrl.hostname ===
      "::1";

  const protocolIsAllowed =
    parsedUrl.protocol ===
      "https:" ||
    (
      allowHttpOnLocalhost &&
      isLocalhost &&
      parsedUrl.protocol ===
        "http:"
    );

  if (!protocolIsAllowed) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_URL_PROTOCOL_INVALID",

      message:
        `${name} doit utiliser HTTPS${
          allowHttpOnLocalhost
            ? ", sauf en développement local"
            : ""
        }.`,
    });
  }

  parsedUrl.hash =
    "";

  return parsedUrl
    .toString()
    .replace(
      /\/$/,
      "",
    );
}

function getApplicationBaseUrl(): string {
  const appUrl =
    normalizeText(
      process.env
        .NEXT_PUBLIC_APP_URL,
    ) ||
    normalizeText(
      process.env
        .APP_URL,
    );

  if (!appUrl) {
    throw new FedaPayConfigurationError({
      code:
        "APP_URL_MISSING",

      message:
        "NEXT_PUBLIC_APP_URL ou APP_URL est obligatoire pour construire les URL de retour FedaPay.",
    });
  }

  return normalizeAbsoluteHttpsUrl({
    value:
      appUrl,

    name:
      "NEXT_PUBLIC_APP_URL/APP_URL",

    allowHttpOnLocalhost:
      process.env.NODE_ENV !==
      "production",
  });
}

function buildApplicationUrl(
  pathname:
    string,
): string {
  const baseUrl =
    getApplicationBaseUrl();

  return new URL(
    pathname,
    `${baseUrl}/`,
  ).toString();
}

function validateSecretKey({
  secretKey,
  environment,
}: {
  secretKey:
    string;
  environment:
    FedaPayEnvironment;
}): void {
  const expectedPrefix =
    environment ===
      "sandbox"
      ? "sk_sandbox"
      : "sk_live";

  if (
    !secretKey.startsWith(
      expectedPrefix,
    )
  ) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_SECRET_KEY_ENVIRONMENT_MISMATCH",

      message:
        `La clé FEDAPAY_SECRET_KEY ne correspond pas à l’environnement ${environment}. Le préfixe attendu est ${expectedPrefix}.`,
    });
  }
}

function validatePublicKey({
  publicKey,
  environment,
}: {
  publicKey:
    string | null;
  environment:
    FedaPayEnvironment;
}): void {
  if (!publicKey) {
    return;
  }

  const expectedPrefix =
    environment ===
      "sandbox"
      ? "pk_sandbox"
      : "pk_live";

  if (
    !publicKey.startsWith(
      expectedPrefix,
    )
  ) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_PUBLIC_KEY_ENVIRONMENT_MISMATCH",

      message:
        `La clé FEDAPAY_PUBLIC_KEY ne correspond pas à l’environnement ${environment}. Le préfixe attendu est ${expectedPrefix}.`,
    });
  }
}

function validateWebhookSecret({
  webhookSecret,
  environment,
}: {
  webhookSecret:
    string;
  environment:
    FedaPayEnvironment;
}): void {
  const expectedPrefix =
    environment ===
      "sandbox"
      ? "wh_sandbox"
      : "wh_live";

  if (
    !webhookSecret.startsWith(
      expectedPrefix,
    )
  ) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_WEBHOOK_SECRET_ENVIRONMENT_MISMATCH",

      message:
        `FEDAPAY_WEBHOOK_SECRET ne correspond pas à l’environnement ${environment}. Le préfixe attendu est ${expectedPrefix}.`,
    });
  }
}

function resolveConfiguredUrl({
  environmentVariableName,
  fallbackPath,
}: {
  environmentVariableName:
    string;
  fallbackPath:
    string;
}): string {
  const configuredUrl =
    readOptionalEnvironmentVariable(
      environmentVariableName,
    );

  const value =
    configuredUrl ||
    buildApplicationUrl(
      fallbackPath,
    );

  return normalizeAbsoluteHttpsUrl({
    value,

    name:
      environmentVariableName,

    allowHttpOnLocalhost:
      process.env.NODE_ENV !==
      "production",
  });
}

function createFedaPayConfig(): FedaPayConfig {
  const environment =
    parseEnvironment(
      readRequiredEnvironmentVariable(
        "FEDAPAY_ENV",
      ),
    );

  const secretKey =
    readRequiredEnvironmentVariable(
      "FEDAPAY_SECRET_KEY",
    );

  const publicKey =
    readOptionalEnvironmentVariable(
      "FEDAPAY_PUBLIC_KEY",
    );

  const webhookSecret =
    readRequiredEnvironmentVariable(
      "FEDAPAY_WEBHOOK_SECRET",
    );

  validateSecretKey({
    secretKey,
    environment,
  });

  validatePublicKey({
    publicKey,
    environment,
  });

  validateWebhookSecret({
    webhookSecret,
    environment,
  });

  const requestTimeoutMs =
    parseIntegerEnvironmentVariable({
      name:
        "FEDAPAY_REQUEST_TIMEOUT_MS",

      fallback:
        DEFAULT_REQUEST_TIMEOUT_MS,

      minimum:
        MIN_REQUEST_TIMEOUT_MS,

      maximum:
        MAX_REQUEST_TIMEOUT_MS,
    });

  const reservationMinutes =
    parseIntegerEnvironmentVariable({
      name:
        "PAYMENT_RESERVATION_MINUTES",

      fallback:
        DEFAULT_RESERVATION_MINUTES,

      minimum:
        MIN_RESERVATION_MINUTES,

      maximum:
        MAX_RESERVATION_MINUTES,
    });

  const webhookUrl =
    resolveConfiguredUrl({
      environmentVariableName:
        "FEDAPAY_WEBHOOK_URL",

      fallbackPath:
        "/api/payments/fedapay/webhook",
    });

  const successUrl =
    resolveConfiguredUrl({
      environmentVariableName:
        "FEDAPAY_SUCCESS_URL",

      fallbackPath:
        "/payment/success",
    });

  const cancelUrl =
    resolveConfiguredUrl({
      environmentVariableName:
        "FEDAPAY_CANCEL_URL",

      fallbackPath:
        "/payment/cancelled",
    });

  return Object.freeze({
    environment,

    apiBaseUrl:
      environment ===
        "sandbox"
        ? SANDBOX_API_BASE_URL
        : LIVE_API_BASE_URL,

    secretKey,

    publicKey,

    webhookSecret,

    webhookSignatureHeader:
      DEFAULT_WEBHOOK_SIGNATURE_HEADER,

    webhookUrl,

    successUrl,

    cancelUrl,

    requestTimeoutMs,

    reservationMinutes,

    userAgent:
      `Tikemia/1.0 FedaPayIntegration (${environment})`,
  });
}

/**
 * Retourne la configuration FedaPay validée.
 *
 * La configuration est chargée uniquement côté serveur et mise en cache
 * pour la durée de vie du processus Node.js.
 *
 * Cette fonction lève une FedaPayConfigurationError lorsque :
 * - une variable obligatoire est absente ;
 * - une URL est invalide ;
 * - une clé sandbox est utilisée en production ;
 * - une clé live est utilisée en sandbox ;
 * - une durée configurée sort des limites autorisées.
 */
export function getFedaPayConfig(): FedaPayConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig =
    createFedaPayConfig();

  return cachedConfig;
}

/**
 * Réinitialise le cache uniquement pour les tests automatisés.
 * Cette fonction ne doit pas être utilisée dans le code métier.
 */
export function resetFedaPayConfigCacheForTests(): void {
  if (
    process.env.NODE_ENV !==
    "test"
  ) {
    throw new FedaPayConfigurationError({
      code:
        "FEDAPAY_CONFIG_CACHE_RESET_FORBIDDEN",

      message:
        "La réinitialisation du cache FedaPay est réservée aux tests.",
    });
  }

  cachedConfig =
    null;
}