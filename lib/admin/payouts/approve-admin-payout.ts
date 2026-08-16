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

export type ApproveAdminPayoutInput =
  Readonly<{
    payoutId: string;
    adminId: string;
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
        "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",
      message:
        `${label} est obligatoire.`,
      status:
        400,
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

export async function approveAdminPayout(
  input: ApproveAdminPayoutInput,
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
              id:
                payoutId,
            },

            select: {
              id:
                true,

              status:
                true,

              destinationId:
                true,

              destinationType:
                true,

              organizerId:
                true,

              amount:
                true,

              fee:
                true,

              netAmount:
                true,

              currency:
                true,

              reference:
                true,

              destination: {
                select: {
                  id:
                    true,

                  isActive:
                    true,

                  status:
                    true,
                },
              },

              organizer: {
                select: {
                  id:
                    true,

                  firstName:
                    true,

                  lastName:
                    true,

                  email:
                    true,
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

            status:
              404,
          });
        }

        /*
         * L'approbation est une action finale.
         *
         * L'administrateur ne clique sur "Approuver"
         * qu'après avoir réellement effectué le paiement
         * vers l'organisateur.
         *
         * Le retrait passe donc directement :
         *
         * PENDING -> PAID
         *
         * Il ne passe plus par PROCESSING.
         */
        if (
          payout.status !==
          PayoutStatus.PENDING
        ) {
          throw new AdminPayoutError({
            code:
              "ADMIN_PAYOUT_ALREADY_PROCESSED",

            message:
              payout.status ===
              PayoutStatus.PAID
                ? "Ce retrait a déjà été payé et confirmé."
                : "Cette demande de retrait a déjà été traitée.",

            status:
              409,

            details: {
              currentStatus:
                payout.status,
            },
          });
        }

        if (
          !payout.destinationId ||
          !payout.destination ||
          !payout.destination.isActive
        ) {
          throw new AdminPayoutError({
            code:
              "ADMIN_PAYOUT_ACTION_NOT_ALLOWED",

            message:
              "La destination de retrait est absente ou désactivée.",

            status:
              422,
          });
        }

        /*
         * processedAt représente maintenant la date
         * à laquelle Tikemia confirme que le paiement
         * manuel a réellement été effectué.
         */
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
              /*
               * IMPORTANT :
               * validation admin = paiement déjà effectué.
               */
              status:
                PayoutStatus.PAID,

              processedAt,

              rejectionReason:
                null,

              adminNote:
                adminNote
                  ? `[PAID_BY:${adminId}] ${adminNote}`
                  : `[PAID_BY:${adminId}]`,
            },
          });

        /*
         * Protection contre une double validation.
         *
         * Si deux administrateurs essaient de confirmer
         * la même demande au même moment, un seul peut
         * modifier PENDING -> PAID.
         */
        if (
          updated.count !==
          1
        ) {
          throw new AdminPayoutError({
            code:
              "ADMIN_PAYOUT_ALREADY_PROCESSED",

            message:
              "Cette demande vient d’être traitée par un autre administrateur.",

            status:
              409,
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
              .replace(
                /\s+/g,
                " ",
              )
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

          /*
           * Retourne directement PAID.
           */
          status:
            PayoutStatus.PAID,

          processedAt,

          adminId,

          adminNote,
        };
      },
      {
        isolationLevel:
          Prisma
            .TransactionIsolationLevel
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
        "Impossible de confirmer le paiement de cette demande de retrait.",

      status:
        500,

      cause:
        error,
    });
  }
}