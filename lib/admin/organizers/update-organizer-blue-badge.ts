import "server-only";

import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

export type OrganizerBlueBadgeAction =
  | "GRANT"
  | "REVOKE";

export type UpdateOrganizerBlueBadgeInput = Readonly<{
  organizerId: string;
  adminId: string;
  action: OrganizerBlueBadgeAction;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

export type UpdateOrganizerBlueBadgeResult = Readonly<{
  organizerId: string;
  organizerName: string;
  organizerEmail: string;

  hasBlueBadge: boolean;
  blueBadgeGrantedAt: string | null;

  action: OrganizerBlueBadgeAction;

  changed: boolean;
}>;

export class UpdateOrganizerBlueBadgeError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
  }: {
    code: string;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
  }) {
    super(message);

    this.name =
      "UpdateOrganizerBlueBadgeError";

    this.code =
      code;

    this.status =
      status;

    this.details =
      details;
  }
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    value
      ?.replace(
        /\s+/g,
        " ",
      )
      .trim() ?? "";

  return normalized || null;
}

function buildOrganizerName({
  firstName,
  lastName,
  businessName,
}: {
  firstName: string;
  lastName: string;
  businessName:
    | string
    | null
    | undefined;
}): string {
  const normalizedBusinessName =
    normalizeText(
      businessName,
    );

  if (normalizedBusinessName) {
    return normalizedBusinessName;
  }

  const fullName =
    `${firstName} ${lastName}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return (
    fullName ||
    "Organisateur Tikemia"
  );
}

function normalizeAction(
  action: OrganizerBlueBadgeAction,
): OrganizerBlueBadgeAction {
  if (
    action !== "GRANT" &&
    action !== "REVOKE"
  ) {
    throw new UpdateOrganizerBlueBadgeError({
      code:
        "ORGANIZER_BLUE_BADGE_ACTION_INVALID",

      status:
        400,

      message:
        "L’action demandée pour le badge bleu est invalide.",
    });
  }

  return action;
}

function normalizeRequiredId({
  value,
  code,
  message,
}: {
  value: string;
  code: string;
  message: string;
}): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new UpdateOrganizerBlueBadgeError({
      code,
      status:
        400,
      message,
    });
  }

  return normalized;
}

export async function updateOrganizerBlueBadge({
  organizerId,
  adminId,
  action,
  reason,
  ipAddress,
  userAgent,
}: UpdateOrganizerBlueBadgeInput): Promise<UpdateOrganizerBlueBadgeResult> {
  const normalizedOrganizerId =
    normalizeRequiredId({
      value:
        organizerId,

      code:
        "ORGANIZER_ID_REQUIRED",

      message:
        "L’identifiant de l’organisateur est obligatoire.",
    });

  const normalizedAdminId =
    normalizeRequiredId({
      value:
        adminId,

      code:
        "ADMIN_ID_REQUIRED",

      message:
        "L’identifiant de l’administrateur est obligatoire.",
    });

  const normalizedAction =
    normalizeAction(
      action,
    );

  const normalizedReason =
    normalizeText(
      reason,
    );

  const normalizedIpAddress =
    normalizeText(
      ipAddress,
    );

  const normalizedUserAgent =
    normalizeText(
      userAgent,
    );

  try {
    return await prisma.$transaction(
      async (tx) => {
        const organizer =
          await tx.user.findFirst({
            where: {
              id:
                normalizedOrganizerId,

              role:
                "ORGANIZER",
            },

            select: {
              id:
                true,

              firstName:
                true,

              lastName:
                true,

              email:
                true,

              isActive:
                true,

              organizerProfile: {
                select: {
                  businessName:
                    true,

                  hasBlueBadge:
                    true,

                  blueBadgeGrantedAt:
                    true,
                },
              },
            },
          });

        if (!organizer) {
          throw new UpdateOrganizerBlueBadgeError({
            code:
              "ORGANIZER_NOT_FOUND",

            status:
              404,

            message:
              "L’organisateur demandé est introuvable.",
          });
        }

        if (!organizer.organizerProfile) {
          throw new UpdateOrganizerBlueBadgeError({
            code:
              "ORGANIZER_PROFILE_NOT_FOUND",

            status:
              404,

            message:
              "Le profil organisateur est introuvable.",
          });
        }

        const previousHasBlueBadge =
          organizer
            .organizerProfile
            .hasBlueBadge;

        const previousGrantedAt =
          organizer
            .organizerProfile
            .blueBadgeGrantedAt;

        const shouldGrant =
          normalizedAction ===
          "GRANT";

        /*
         * Rend l'opération idempotente.
         *
         * GRANT sur un organisateur déjà vérifié ne recrée pas
         * inutilement une nouvelle date.
         *
         * REVOKE sur un organisateur sans badge reste également
         * une opération sûre.
         */
        const changed =
          shouldGrant
            ? !previousHasBlueBadge
            : previousHasBlueBadge;

        const now =
          new Date();

        const updatedProfile =
          await tx.organizerProfile.update({
            where: {
              userId:
                organizer.id,
            },

            data:
              shouldGrant
                ? {
                    hasBlueBadge:
                      true,

                    /*
                     * Si le badge existait déjà, on conserve
                     * sa date d'attribution originale.
                     */
                    blueBadgeGrantedAt:
                      previousGrantedAt ??
                      now,
                  }
                : {
                    hasBlueBadge:
                      false,

                    blueBadgeGrantedAt:
                      null,
                  },

            select: {
              hasBlueBadge:
                true,

              blueBadgeGrantedAt:
                true,
            },
          });

        const organizerName =
          buildOrganizerName({
            firstName:
              organizer.firstName,

            lastName:
              organizer.lastName,

            businessName:
              organizer
                .organizerProfile
                .businessName,
          });

        await tx.adminAuditLog.create({
          data: {
            adminId:
              normalizedAdminId,

            action:
              shouldGrant
                ? "ORGANIZER_BLUE_BADGE_GRANTED"
                : "ORGANIZER_BLUE_BADGE_REVOKED",

            targetType:
              "ORGANIZER",

            targetId:
              organizer.id,

            metadata: {
              organizerId:
                organizer.id,

              organizerEmail:
                organizer.email,

              organizerName,

              previousHasBlueBadge,

              newHasBlueBadge:
                updatedProfile.hasBlueBadge,

              previousBlueBadgeGrantedAt:
                previousGrantedAt
                  ? previousGrantedAt.toISOString()
                  : null,

              newBlueBadgeGrantedAt:
                updatedProfile.blueBadgeGrantedAt
                  ? updatedProfile.blueBadgeGrantedAt.toISOString()
                  : null,

              reason:
                normalizedReason,

              changed,
            } as Prisma.InputJsonValue,

            ipAddress:
              normalizedIpAddress,

            userAgent:
              normalizedUserAgent,
          },
        });

        return {
          organizerId:
            organizer.id,

          organizerName,

          organizerEmail:
            organizer.email,

          hasBlueBadge:
            updatedProfile.hasBlueBadge,

          blueBadgeGrantedAt:
            updatedProfile.blueBadgeGrantedAt
              ? updatedProfile.blueBadgeGrantedAt.toISOString()
              : null,

          action:
            normalizedAction,

          changed,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,

        maxWait:
          5_000,

        timeout:
          15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof
      UpdateOrganizerBlueBadgeError
    ) {
      throw error;
    }

    console.error(
      "[UPDATE_ORGANIZER_BLUE_BADGE_ERROR]",
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

    throw new UpdateOrganizerBlueBadgeError({
      code:
        "ORGANIZER_BLUE_BADGE_UPDATE_FAILED",

      status:
        500,

      message:
        "Impossible de modifier le badge bleu de cet organisateur pour le moment.",
    });
  }
}