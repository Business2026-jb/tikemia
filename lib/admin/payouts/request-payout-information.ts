import "server-only";

import {
  PayoutStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  prisma,
} from "@/lib/prisma";

export type RequestPayoutInformationInput =
  Readonly<{
    payoutId: string;
    adminId: string;
    message: string;
    requestedFields?: readonly string[];
  }>;

function normalizeRequired(
  value: string,
  label: string,
): string {
  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (!normalized) {
    throw new AdminPayoutError({
      code:
        label === "Le message"
          ? "ADMIN_PAYOUT_INFORMATION_REQUIRED"
          : "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",
      message:
        `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

function normalizeRequestedFields(
  values:
    readonly string[] |
    undefined,
): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) =>
          value
            .replace(/\s+/g, "_")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ).slice(
    0,
    20,
  );
}

export async function requestPayoutInformation(
  input: RequestPayoutInformationInput,
) {
  const payoutId =
    normalizeRequired(
      input.payoutId,
      "L’identifiant du retrait",
    );

  const adminId =
    normalizeRequired(
      input.adminId,
      "L’identifiant administrateur",
    );

  const message =
    normalizeRequired(
      input.message,
      "Le message",
    );

  const requestedFields =
    normalizeRequestedFields(
      input.requestedFields,
    );

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const payout =
          await transaction.payout.findUnique({
            where: {
              id: payoutId,
            },

            select: {
              id: true,
              status: true,
              organizerId: true,
              amount: true,
              currency: true,
              reference: true,
              destinationType: true,

              organizer: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

        if (!payout) {
          throw new AdminPayoutError({
            code:
              "ADMIN_PAYOUT_NOT_FOUND",
            message:
              "Cette demande de retrait est introuvable.",
            status: 404,
          });
        }

        if (
          payout.status !==
          PayoutStatus.PENDING
        ) {
          throw new AdminPayoutError({
            code:
              "ADMIN_PAYOUT_ALREADY_PROCESSED",
            message:
              "Des informations ne peuvent être demandées que pour un retrait en attente.",
            status: 409,
            details: {
              currentStatus:
                payout.status,
            },
          });
        }

        const requestedAt =
          new Date();

        const fieldsText =
          requestedFields.length >
          0
            ? ` Champs demandés: ${requestedFields.join(", ")}.`
            : "";

        const adminNote =
          `[INFORMATION_REQUIRED] [ADMIN:${adminId}] [DATE:${requestedAt.toISOString()}] ${message}${fieldsText}`;

        const updated =
          await transaction.payout.updateMany({
            where: {
              id:
                payout.id,
              status:
                PayoutStatus.PENDING,
            },

            data: {
              adminNote,
              rejectionReason:
                null,
            },
          });

        if (
          updated.count !==
          1
        ) {
          throw new AdminPayoutError({
            code:
              "ADMIN_PAYOUT_ALREADY_PROCESSED",
            message:
              "Cette demande vient d’être traitée par un autre administrateur.",
            status: 409,
          });
        }

        return {
          payoutId:
            payout.id,
          organizerId:
            payout.organizerId,
          organizerEmail:
            payout.organizer.email,
          organizerName:
            `${payout.organizer.firstName} ${payout.organizer.lastName}`
              .replace(/\s+/g, " ")
              .trim(),
          reference:
            payout.reference,
          amount:
            payout.amount.toFixed(
              2,
            ),
          currency:
            payout.currency,
          destinationType:
            payout.destinationType,
          status:
            payout.status,
          message,
          requestedFields,
          requestedAt,
          adminId,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
        maxWait:
          5_000,
        timeout:
          15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof
      AdminPayoutError
    ) {
      throw error;
    }

    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",
      message:
        "Impossible d’enregistrer la demande d’informations.",
      status: 500,
      cause: error,
    });
  }
}
