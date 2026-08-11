import "server-only";

import {
  PaymentStatus,
  TicketStatus,
} from "@prisma/client";

export const REFUND_REQUEST_WINDOW_DAYS = 7;
export const REFUND_REQUEST_WINDOW_MS =
  REFUND_REQUEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type RefundEligibilityCode =
  | "ELIGIBLE"
  | "PAYMENT_NOT_CONFIRMED"
  | "PURCHASE_DATE_UNAVAILABLE"
  | "REFUND_WINDOW_EXPIRED"
  | "TICKET_ALREADY_USED"
  | "TICKET_ALREADY_REFUNDED"
  | "TICKET_CANCELLED"
  | "TICKET_REVOKED"
  | "TICKET_EXPIRED"
  | "TICKET_NOT_VALID"
  | "EVENT_ALREADY_ENDED"
  | "REFUND_REQUEST_ALREADY_ACTIVE";

export type RefundEligibilityInput = Readonly<{
  now?: Date;
  paidAt: Date | null;
  paymentStatus: PaymentStatus | null;
  ticketStatus: TicketStatus;
  ticketUsedAt: Date | null;
  eventEndsAt?: Date | null;
  eventStartsAt?: Date | null;
  hasActiveRefundRequest?: boolean;
}>;

export type RefundEligibilityResult = Readonly<{
  eligible: boolean;
  code: RefundEligibilityCode;
  message: string;
  paidAt: Date | null;
  deadline: Date | null;
  remainingMs: number;
}>;

export function getRefundDeadline(
  paidAt: Date | null | undefined,
): Date | null {
  if (!paidAt) return null;

  const timestamp = paidAt.getTime();
  if (!Number.isFinite(timestamp)) return null;

  return new Date(timestamp + REFUND_REQUEST_WINDOW_MS);
}

function makeResult(
  value: RefundEligibilityResult,
): RefundEligibilityResult {
  return Object.freeze({
    ...value,
    remainingMs: Math.max(0, value.remainingMs),
  });
}

export function evaluateRefundEligibility(
  input: RefundEligibilityInput,
): RefundEligibilityResult {
  const now = input.now ?? new Date();
  const deadline = getRefundDeadline(input.paidAt);

  if (input.hasActiveRefundRequest) {
    return makeResult({
      eligible: false,
      code: "REFUND_REQUEST_ALREADY_ACTIVE",
      message:
        "Une demande de remboursement est déjà en cours pour ce billet.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline
        ? deadline.getTime() - now.getTime()
        : 0,
    });
  }

  if (
    input.paymentStatus !== PaymentStatus.SUCCESS &&
    input.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
  ) {
    return makeResult({
      eligible: false,
      code: "PAYMENT_NOT_CONFIRMED",
      message:
        "Le paiement de ce billet n’est pas confirmé.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: 0,
    });
  }

  if (!input.paidAt || !deadline) {
    return makeResult({
      eligible: false,
      code: "PURCHASE_DATE_UNAVAILABLE",
      message:
        "La date de confirmation du paiement est indisponible.",
      paidAt: null,
      deadline: null,
      remainingMs: 0,
    });
  }

  if (now.getTime() > deadline.getTime()) {
    return makeResult({
      eligible: false,
      code: "REFUND_WINDOW_EXPIRED",
      message:
        "Le délai de 7 jours pour demander un remboursement est dépassé.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: 0,
    });
  }

  if (
    input.ticketUsedAt ||
    input.ticketStatus === TicketStatus.USED
  ) {
    return makeResult({
      eligible: false,
      code: "TICKET_ALREADY_USED",
      message:
        "Un billet déjà utilisé ne peut pas faire l’objet d’une demande de remboursement.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  if (input.ticketStatus === TicketStatus.REFUNDED) {
    return makeResult({
      eligible: false,
      code: "TICKET_ALREADY_REFUNDED",
      message: "Ce billet a déjà été remboursé.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  if (input.ticketStatus === TicketStatus.CANCELLED) {
    return makeResult({
      eligible: false,
      code: "TICKET_CANCELLED",
      message: "Ce billet est annulé.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  if (input.ticketStatus === TicketStatus.REVOKED) {
    return makeResult({
      eligible: false,
      code: "TICKET_REVOKED",
      message: "Ce billet a été révoqué.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  if (input.ticketStatus === TicketStatus.EXPIRED) {
    return makeResult({
      eligible: false,
      code: "TICKET_EXPIRED",
      message: "Ce billet a expiré.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  if (input.ticketStatus !== TicketStatus.VALID) {
    return makeResult({
      eligible: false,
      code: "TICKET_NOT_VALID",
      message:
        "Ce billet n’est pas éligible au remboursement.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  const eventBoundary =
    input.eventEndsAt ?? input.eventStartsAt ?? null;

  if (
    eventBoundary &&
    eventBoundary.getTime() <= now.getTime()
  ) {
    return makeResult({
      eligible: false,
      code: "EVENT_ALREADY_ENDED",
      message:
        "L’événement est déjà terminé. Ce billet n’est plus éligible à une nouvelle demande.",
      paidAt: input.paidAt,
      deadline,
      remainingMs: deadline.getTime() - now.getTime(),
    });
  }

  return makeResult({
    eligible: true,
    code: "ELIGIBLE",
    message:
      "Ce billet est éligible à une demande de remboursement.",
    paidAt: input.paidAt,
    deadline,
    remainingMs: deadline.getTime() - now.getTime(),
  });
}
