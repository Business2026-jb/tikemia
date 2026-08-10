import {
  createHash,
} from "node:crypto";

import {
  PayoutStatus,
} from "@prisma/client";
import {
  cookies,
} from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const INFORMATION_REQUIRED_MARKER =
  "[INFORMATION_REQUIRED]";

const ORGANIZER_RESPONSE_MARKER =
  "[ORGANIZER_RESPONSE]";

type RouteContext =
  Readonly<{
    params: Promise<{
      payoutId: string;
    }>;
  }>;

type ConnectedOrganizer =
  Readonly<{
    id: string;
    email: string;
  }>;

const requestSchema =
  z.object({
    message:
      z.string()
        .trim()
        .min(
          10,
          "Votre réponse doit contenir au moins 10 caractères.",
        )
        .max(
          4_000,
          "Votre réponse est trop longue.",
        ),

    providedFields:
      z.array(
        z.string()
          .trim()
          .min(
            1,
            "Un élément fourni est invalide.",
          )
          .max(
            120,
            "Un élément fourni est trop long.",
          ),
      )
        .max(
          20,
          "Vous ne pouvez pas envoyer plus de 20 éléments à la fois.",
        )
        .optional(),
  })
    .strict();

class OrganizerPayoutInformationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor({
    code,
    message,
    status = 400,
    details,
  }: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(
      message,
    );

    this.name =
      "OrganizerPayoutInformationError";

    this.code =
      code;

    this.status =
      status;

    this.details =
      details;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizePayoutId(
  value: string,
): string {
  const normalized =
    decodeURIComponent(
      value,
    ).trim();

  if (!normalized) {
    throw new OrganizerPayoutInformationError({
      code:
        "PAYOUT_ID_REQUIRED",

      message:
        "L’identifiant de la demande de retrait est obligatoire.",

      status:
        400,
    });
  }

  return normalized;
}

function normalizeProvidedFields(
  values:
    | readonly string[]
    | undefined,
): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map(
          (
            value,
          ) =>
            value
              .replace(
                /\s+/g,
                " ",
              )
              .trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ).slice(
    0,
    20,
  );
}

function jsonResponse(
  body:
    Record<
      string,
      unknown
    >,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",

        "X-Frame-Options":
          "SAMEORIGIN",

        "Referrer-Policy":
          "no-referrer",
      },
    },
  );
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const rawSessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!rawSessionToken) {
    throw new OrganizerPayoutInformationError({
      code:
        "UNAUTHENTICATED",

      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",

      status:
        401,
    });
  }

  const tokenHash =
    hashSessionToken(
      rawSessionToken,
    );

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },

      select: {
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (!session) {
    throw new OrganizerPayoutInformationError({
      code:
        "SESSION_NOT_FOUND",

      message:
        "Votre session n’est plus valide. Veuillez vous reconnecter.",

      status:
        401,
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[ORGANIZER_PAYOUT_INFORMATION_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new OrganizerPayoutInformationError({
      code:
        "SESSION_EXPIRED",

      message:
        "Votre session a expiré. Veuillez vous reconnecter.",

      status:
        401,
    });
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    throw new OrganizerPayoutInformationError({
      code:
        "FORBIDDEN",

      message:
        "Ce compte ne peut pas répondre à une demande d’informations de retrait.",

      status:
        403,
    });
  }

  return {
    id:
      organizer.id,

    email:
      organizer.email,
  };
}

async function readRequestBody(
  request: NextRequest,
) {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    throw new OrganizerPayoutInformationError({
      code:
        "INVALID_CONTENT_TYPE",

      message:
        "Le format de la requête est invalide.",

      status:
        415,
    });
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  } catch {
    throw new OrganizerPayoutInformationError({
      code:
        "INVALID_JSON",

      message:
        "Le contenu JSON de la requête est invalide.",

      status:
        400,
    });
  }

  const parsed =
    requestSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    throw new OrganizerPayoutInformationError({
      code:
        "INVALID_INFORMATION_RESPONSE",

      message:
        parsed.error.issues[0]
          ?.message ??
        "Les informations envoyées sont invalides.",

      status:
        422,

      details: {
        fields:
          parsed.error
            .flatten()
            .fieldErrors,
      },
    });
  }

  return {
    message:
      parsed.data.message,

    providedFields:
      normalizeProvidedFields(
        parsed.data.providedFields,
      ),
  };
}

function buildUpdatedAdminNote({
  currentAdminNote,
  organizerEmail,
  message,
  providedFields,
  respondedAt,
}: {
  currentAdminNote:
    string;
  organizerEmail:
    string;
  message:
    string;
  providedFields:
    readonly string[];
  respondedAt:
    Date;
}): string {
  const fieldsText =
    providedFields.length > 0
      ? ` Éléments fournis: ${providedFields.join(", ")}.`
      : "";

  const responseBlock =
    `${ORGANIZER_RESPONSE_MARKER} ` +
    `[ORGANIZER:${organizerEmail}] ` +
    `[DATE:${respondedAt.toISOString()}] ` +
    `${message}${fieldsText}`;

  const withoutPreviousResponse =
    currentAdminNote
      .split(
        ORGANIZER_RESPONSE_MARKER,
      )[0]
      ?.trim() ??
    currentAdminNote.trim();

  return [
    withoutPreviousResponse,
    responseBlock,
  ]
    .filter(
      Boolean,
    )
    .join(
      "\n\n",
    );
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const organizer =
      await getConnectedOrganizer();

    const {
      payoutId,
    } =
      await context.params;

    const normalizedPayoutId =
      normalizePayoutId(
        payoutId,
      );

    const input =
      await readRequestBody(
        request,
      );

    const payout =
      await prisma.payout.findFirst({
        where: {
          id:
            normalizedPayoutId,

          organizerId:
            organizer.id,
        },

        select: {
          id:
            true,

          reference:
            true,

          status:
            true,

          adminNote:
            true,

          updatedAt:
            true,
        },
      });

    if (!payout) {
      throw new OrganizerPayoutInformationError({
        code:
          "PAYOUT_NOT_FOUND",

        message:
          "Cette demande de retrait est introuvable.",

        status:
          404,
      });
    }

    if (
      payout.status !==
      PayoutStatus.PENDING
    ) {
      throw new OrganizerPayoutInformationError({
        code:
          "PAYOUT_NOT_PENDING",

        message:
          "Cette demande de retrait ne peut plus recevoir d’informations supplémentaires.",

        status:
          409,

        details: {
          currentStatus:
            payout.status,
        },
      });
    }

    const currentAdminNote =
      normalizeText(
        payout.adminNote,
      );

    if (
      !currentAdminNote.startsWith(
        INFORMATION_REQUIRED_MARKER,
      )
    ) {
      throw new OrganizerPayoutInformationError({
        code:
          "INFORMATION_NOT_REQUESTED",

        message:
          "Aucune information supplémentaire n’a été demandée pour ce retrait.",

        status:
          409,
      });
    }

    const respondedAt =
      new Date();

    const updatedAdminNote =
      buildUpdatedAdminNote({
        currentAdminNote,

        organizerEmail:
          organizer.email,

        message:
          input.message,

        providedFields:
          input.providedFields,

        respondedAt,
      });

    const updated =
      await prisma.payout.updateMany({
        where: {
          id:
            payout.id,

          organizerId:
            organizer.id,

          status:
            PayoutStatus.PENDING,

          updatedAt:
            payout.updatedAt,
        },

        data: {
          adminNote:
            updatedAdminNote,
        },
      });

    if (
      updated.count !==
      1
    ) {
      throw new OrganizerPayoutInformationError({
        code:
          "PAYOUT_CHANGED",

        message:
          "Cette demande de retrait vient d’être modifiée. Actualisez la page puis réessayez.",

        status:
          409,
      });
    }

    return jsonResponse(
      {
        success:
          true,

        message:
          "Vos informations ont été transmises à l’administration Tikemia.",

        data: {
          payoutId:
            payout.id,

          reference:
            payout.reference,

          status:
            payout.status,

          message:
            input.message,

          providedFields:
            input.providedFields,

          respondedAt:
            respondedAt.toISOString(),
        },
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
      OrganizerPayoutInformationError
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              error.code,

            message:
              error.message,

            details:
              error.details ??
              null,
          },
        },
        error.status,
      );
    }

    console.error(
      "[ORGANIZER_PAYOUT_INFORMATION_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return jsonResponse(
      {
        success:
          false,

        error: {
          code:
            "INTERNAL_ERROR",

          message:
            "Impossible d’envoyer les informations du retrait pour le moment.",

          details:
            null,
        },
      },
      500,
    );
  }
}
