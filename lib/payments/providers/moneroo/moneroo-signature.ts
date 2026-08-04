import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getMonerooWebhookSecret } from "./config";
import { MonerooWebhookSignatureError } from "./moneroo-errors";

export const MONEROO_SIGNATURE_HEADER = "x-moneroo-signature" as const;

function normalizeSignature(signature: string): string {
  const normalizedSignature = signature.trim();

  if (!normalizedSignature) {
    throw new MonerooWebhookSignatureError(
      "La signature du webhook Moneroo est absente.",
    );
  }

  const withoutPrefix = normalizedSignature.replace(/^sha256=/i, "").trim();

  if (!/^[a-fA-F0-9]{64}$/.test(withoutPrefix)) {
    throw new MonerooWebhookSignatureError(
      "Le format de la signature du webhook Moneroo est invalide.",
    );
  }

  return withoutPrefix.toLowerCase();
}

function normalizePayload(payload: string | Buffer): Buffer {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  return Buffer.from(payload, "utf8");
}

export function createMonerooWebhookSignature(
  payload: string | Buffer,
  secret = getMonerooWebhookSecret(),
): string {
  const normalizedSecret = secret.trim();

  if (!normalizedSecret) {
    throw new MonerooWebhookSignatureError(
      "Le secret de signature du webhook Moneroo est vide.",
    );
  }

  return createHmac("sha256", normalizedSecret)
    .update(normalizePayload(payload))
    .digest("hex");
}

export function verifyMonerooWebhookSignature(
  payload: string | Buffer,
  receivedSignature: string | null | undefined,
  secret = getMonerooWebhookSecret(),
): boolean {
  if (!receivedSignature?.trim()) {
    return false;
  }

  let normalizedReceivedSignature: string;

  try {
    normalizedReceivedSignature = normalizeSignature(receivedSignature);
  } catch {
    return false;
  }

  const expectedSignature = createMonerooWebhookSignature(payload, secret);

  const receivedBuffer = Buffer.from(normalizedReceivedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function assertValidMonerooWebhookSignature(
  payload: string | Buffer,
  receivedSignature: string | null | undefined,
  secret = getMonerooWebhookSecret(),
): void {
  if (!verifyMonerooWebhookSignature(payload, receivedSignature, secret)) {
    throw new MonerooWebhookSignatureError();
  }
}

export function readMonerooSignatureHeader(headers: Headers): string | null {
  return headers.get(MONEROO_SIGNATURE_HEADER);
}
