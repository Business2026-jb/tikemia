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

export type RejectAdminPayoutInput =
  Readonly<{
    payoutId: string;
    adminId: string;
    reason: string;
    adminNote?: string | null;
  }>;

function normalizeRequired(
  value: string,
  label: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new AdminPayoutError({
      code:
        label === "Le motif"
          ? "ADMIN_PAYOUT_REASON_REQUIRED"
          : "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",
      message:
        `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized ||
    null;
}

export async function rejectAdminPayout(
  input: RejectAdminPayoutInput,
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

  const reason =
    normalizeRequired(
      input.reason,
      "Le motif",
    );

  const adminNote =
    normalizeOptional(
      input.adminNote,
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
              fee: true,
              netAmount: true,
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
              "Cette demande de retrait a déjà été traitée.",
            status: 409,
            details: {
              currentStatus:
                payout.status,
            },
          });
        }

        const processedAt =
          new Date();

        const updated =
          await transaction.payout.updateMany({
            where: {
              id:
                payout.id,
              status:
                PayoutStatus.PENDING,
            },

            data: {
              status:
                PayoutStatus.REJECTED,
              processedAt,
              rejectionReason:
                reason,
              adminNote:
                adminNote
                  ? `[REJECTED_BY:${adminId}] ${adminNote}`
                  : `[REJECTED_BY:${adminId}]`,
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
          fee:
            payout.fee.toFixed(
              2,
            ),
          netAmount:
            payout.netAmount.toFixed(
              2,
            ),
          currency:
            payout.currency,
          destinationType:
            payout.destinationType,
          previousStatus:
            payout.status,
          status:
            PayoutStatus.REJECTED,
          rejectionReason:
            reason,
          processedAt,
          adminId,
          adminNote,
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
        "Impossible de rejeter cette demande de retrait.",
      status: 500,
      cause: error,
    });
  }
}
