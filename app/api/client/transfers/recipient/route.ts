import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const recipientSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3, "Saisissez une adresse e-mail ou un numéro de téléphone.")
      .max(190, "La valeur saisie est trop longue."),
  })
  .strict();

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const globalForRecipientRateLimit = globalThis as typeof globalThis & {
  tikemiaRecipientRateLimit?: Map<string, RateLimitEntry>;
};

const recipientRateLimit =
  globalForRecipientRateLimit.tikemiaRecipientRateLimit ??
  new Map<string, RateLimitEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForRecipientRateLimit.tikemiaRecipientRateLimit =
    recipientRateLimit;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function getPhoneCandidates(value: string): string[] {
  const trimmedValue = value.trim();
  const digits = normalizePhoneDigits(trimmedValue);

  if (digits.length < 7 || digits.length > 15) {
    return [];
  }

  const candidates = new Set<string>([
    digits,
    `+${digits}`,
    trimmedValue,
    trimmedValue.replace(/[\s().-]/g, ""),
  ]);

  if (digits.startsWith("00") && digits.length > 2) {
    const withoutInternationalPrefix = digits.slice(2);
    candidates.add(withoutInternationalPrefix);
    candidates.add(`+${withoutInternationalPrefix}`);
  }

  return Array.from(candidates).filter(Boolean);
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email;
  }

  const visibleStart = localPart.slice(0, Math.min(2, localPart.length));
  const hiddenLength = Math.max(localPart.length - visibleStart.length, 2);

  return `${visibleStart}${"*".repeat(hiddenLength)}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = normalizePhoneDigits(phone);

  if (digits.length <= 4) {
    return "*".repeat(Math.max(digits.length, 4));
  }

  const visibleEnd = digits.slice(-4);
  const hiddenLength = Math.max(digits.length - 4, 4);
  const prefix = phone.trim().startsWith("+") ? "+" : "";

  return `${prefix}${"*".repeat(hiddenLength)}${visibleEnd}`;
}

function getRequestAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function consumeRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const current = recipientRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    recipientRateLimit.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      ),
    };
  }

  current.count += 1;
  recipientRateLimit.set(key, current);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function getAuthenticatedCustomer() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore
    .get(CLIENT_SESSION_COOKIE_NAME)
    ?.value?.trim();

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  const customer = session.user;

  if (
    customer.role !== "CUSTOMER" ||
    !customer.emailVerified ||
    !customer.isActive
  ) {
    return null;
  }

  return customer;
}

export async function POST(request: Request) {
  try {
    const customer = await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia pour effectuer un transfert.",
        },
        401,
      );
    }

    const rateLimit = consumeRateLimit(
      `${customer.id}:${getRequestAddress(request)}`,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "TOO_MANY_REQUESTS",
          message:
            "Trop de recherches ont été effectuées. Réessayez dans quelques instants.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_JSON",
          message: "La requête envoyée est invalide.",
        },
        400,
      );
    }

    const parsedBody = recipientSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_IDENTIFIER",
          message:
            parsedBody.error.issues[0]?.message ||
            "Saisissez une adresse e-mail ou un numéro de téléphone valide.",
        },
        400,
      );
    }

    const identifier = parsedBody.data.identifier;
    const isEmail = identifier.includes("@");

    let recipient:
      | {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          country: string;
          countryCode: string;
        }
      | null = null;

    if (isEmail) {
      const email = normalizeEmail(identifier);

      if (!z.string().email().safeParse(email).success) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_EMAIL",
            message: "Saisissez une adresse e-mail valide.",
          },
          400,
        );
      }

      recipient = await prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: Prisma.QueryMode.insensitive,
          },
          role: "CUSTOMER",
          emailVerified: true,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          countryCode: true,
        },
      });
    } else {
      const phoneCandidates = getPhoneCandidates(identifier);

      if (phoneCandidates.length === 0) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_PHONE",
            message:
              "Saisissez un numéro complet avec l’indicatif du pays.",
          },
          400,
        );
      }

      recipient = await prisma.user.findFirst({
        where: {
          phone: {
            in: phoneCandidates,
          },
          role: "CUSTOMER",
          emailVerified: true,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          countryCode: true,
        },
      });
    }

    if (!recipient) {
      return jsonResponse(
        {
          success: false,
          code: "RECIPIENT_NOT_FOUND",
          message:
            "Aucun compte client Tikemia actif et vérifié ne correspond à ces informations.",
        },
        404,
      );
    }

    if (recipient.id === customer.id) {
      return jsonResponse(
        {
          success: false,
          code: "SELF_TRANSFER_NOT_ALLOWED",
          message:
            "Vous ne pouvez pas transférer un billet vers votre propre compte.",
        },
        409,
      );
    }

    return jsonResponse({
      success: true,
      message: "Compte Tikemia vérifié.",
      recipient: {
        id: recipient.id,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        fullName: `${recipient.firstName} ${recipient.lastName}`.trim(),
        country: recipient.country,
        countryCode: recipient.countryCode,
        maskedEmail: maskEmail(recipient.email),
        maskedPhone: maskPhone(recipient.phone),
        verified: true,
      },
    });
  } catch (error) {
    console.error("[CLIENT_TRANSFER_RECIPIENT_ERROR]", error);

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de vérifier ce destinataire pour le moment. Réessayez.",
      },
      500,
    );
  }
}