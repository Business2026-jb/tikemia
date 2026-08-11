import "server-only";

import {
  MonerooConfigurationError,
} from "./moneroo-errors";

const DEFAULT_API_BASE_URL =
  "https://api.moneroo.io";

const DEFAULT_REQUEST_TIMEOUT_MS =
  15_000;

export type MonerooConfig =
  Readonly<{
    secretKey: string;
    webhookSecret: string | null;
    apiBaseUrl: string;
    requestTimeoutMs: number;
  }>;

function readOptionalEnvironmentVariable(
  name: string,
): string | null {
  const value =
    process.env[name]?.trim();

  return value || null;
}

function readRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    readOptionalEnvironmentVariable(
      name,
    );

  if (!value) {
    throw new MonerooConfigurationError(
      `La variable d'environnement ${name} est obligatoire pour utiliser Moneroo.`,
      name,
    );
  }

  return value;
}

function normalizeApiBaseUrl(
  value: string,
): string {
  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    throw new MonerooConfigurationError(
      "MONEROO_API_BASE_URL est obligatoire.",
      "MONEROO_API_BASE_URL",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl =
      new URL(
        normalizedValue,
      );
  } catch {
    throw new MonerooConfigurationError(
      "MONEROO_API_BASE_URL doit contenir une URL absolue valide.",
      "MONEROO_API_BASE_URL",
    );
  }

  if (
    parsedUrl.protocol !==
    "https:"
  ) {
    throw new MonerooConfigurationError(
      "MONEROO_API_BASE_URL doit obligatoirement utiliser HTTPS.",
      "MONEROO_API_BASE_URL",
    );
  }

  /*
   * L'API Moneroo doit pointer uniquement vers l'origine API.
   *
   * Cela évite par exemple :
   *
   * https://api.moneroo.io/
   * +
   * /v1/payments/initialize
   *
   * et garantit une URL finale propre.
   */
  return parsedUrl
    .toString()
    .replace(
      /\/+$/,
      "",
    );
}

function readRequestTimeoutMs():
  number {
  const rawValue =
    readOptionalEnvironmentVariable(
      "MONEROO_REQUEST_TIMEOUT_MS",
    );

  if (!rawValue) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsedValue =
    Number(
      rawValue,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue < 1_000 ||
    parsedValue > 120_000
  ) {
    throw new MonerooConfigurationError(
      "MONEROO_REQUEST_TIMEOUT_MS doit être un entier compris entre 1000 et 120000.",
      "MONEROO_REQUEST_TIMEOUT_MS",
    );
  }

  return parsedValue;
}

export function getMonerooConfig():
  MonerooConfig {
  const secretKey =
    readRequiredEnvironmentVariable(
      "MONEROO_SECRET_KEY",
    );

  const webhookSecret =
    readOptionalEnvironmentVariable(
      "MONEROO_WEBHOOK_SECRET",
    );

  const configuredApiBaseUrl =
    readOptionalEnvironmentVariable(
      "MONEROO_API_BASE_URL",
    );

  const apiBaseUrl =
    normalizeApiBaseUrl(
      configuredApiBaseUrl ??
        DEFAULT_API_BASE_URL,
    );

  const requestTimeoutMs =
    readRequestTimeoutMs();

  return Object.freeze({
    secretKey,
    webhookSecret,
    apiBaseUrl,
    requestTimeoutMs,
  });
}

export function getMonerooWebhookSecret():
  string {
  const secret =
    getMonerooConfig()
      .webhookSecret;

  if (!secret) {
    throw new MonerooConfigurationError(
      "La variable d'environnement MONEROO_WEBHOOK_SECRET est obligatoire pour vérifier les webhooks Moneroo.",
      "MONEROO_WEBHOOK_SECRET",
    );
  }

  return secret;
}