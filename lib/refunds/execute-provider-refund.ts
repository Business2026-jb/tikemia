import "server-only";

import { RefundError } from "@/lib/refunds/errors";
import type {
  ProviderRefundExecutionInput,
  ProviderRefundExecutionResult,
} from "@/lib/refunds/types";

function normalizeProvider(value: string): string {
  return value.trim().toUpperCase();
}

function assertInput(input: ProviderRefundExecutionInput): void {
  if (
    !input.refundId.trim() ||
    !input.refundReference.trim() ||
    !input.provider.trim() ||
    !input.currency.trim()
  ) {
    throw new RefundError({
      code: "REFUND_INVALID_INPUT",
      message: "Les informations nécessaires au remboursement sont incomplètes.",
      status: 400,
    });
  }

  const amount =
    typeof input.amount === "number"
      ? input.amount
      : Number(input.amount.trim().replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RefundError({
      code: "REFUND_AMOUNT_INVALID",
      message: "Le montant du remboursement est invalide.",
      status: 400,
    });
  }
}

/**
 * Point d'entrée unique des remboursements prestataire.
 *
 * IMPORTANT :
 * Le client Moneroo actuellement présent dans Tikemia expose uniquement
 * l'initialisation, la récupération et la vérification d'un paiement.
 * Il n'expose aucune opération de remboursement.
 *
 * Cette fonction refuse donc volontairement d'inventer un endpoint Moneroo.
 * Elle ne doit JAMAIS retourner SUCCEEDED tant qu'une vraie opération de
 * remboursement, validée par l'API Moneroo utilisée par Tikemia, n'a pas été
 * ajoutée au client/provider Moneroo.
 */
export async function executeProviderRefund(
  input: ProviderRefundExecutionInput,
): Promise<ProviderRefundExecutionResult> {
  assertInput(input);

  const provider = normalizeProvider(input.provider);

  if (provider === "MONEROO") {
    if (!input.providerTransactionId?.trim()) {
      throw new RefundError({
        code: "REFUND_INVALID_INPUT",
        message:
          "L’identifiant de transaction Moneroo est obligatoire pour rembourser ce paiement.",
        status: 409,
      });
    }

    throw new RefundError({
      code: "REFUND_PROVIDER_NOT_IMPLEMENTED",
      message:
        "Le remboursement Moneroo n’est pas encore exposé par le client Moneroo actuel de Tikemia. Aucun billet ni paiement ne doit être marqué remboursé.",
      status: 501,
      retryable: false,
    });
  }

  throw new RefundError({
    code: "REFUND_PROVIDER_UNSUPPORTED",
    message: `Le prestataire de paiement « ${provider || "INCONNU"} » ne possède pas de moteur de remboursement Tikemia.`,
    status: 422,
    retryable: false,
  });
}
