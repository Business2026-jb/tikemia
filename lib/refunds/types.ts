export const REFUND_REQUEST_WINDOW_DAYS = 7 as const;

export type RefundWorkflowStage =
  | "REQUESTED"
  | "ORGANIZER_REVIEW"
  | "FORWARDED_TO_ADMIN"
  | "ADMIN_REVIEW"
  | "REFUND_PROCESSING"
  | "REFUNDED"
  | "ORGANIZER_REJECTED"
  | "ADMIN_REJECTED"
  | "REFUND_FAILED";

export type RefundActorType =
  | "CLIENT"
  | "ORGANIZER"
  | "ADMIN"
  | "SYSTEM";

export type RefundMoney = Readonly<{
  amount: string;
  currency: string;
}>;

export type RefundTicketSnapshot = Readonly<{
  ticketId: string;
  ticketCode: string | null;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  requestedAmount: string;
}>;

export type RefundEmailCustomer = Readonly<{
  name: string;
  email: string;
}>;

export type RefundEmailOrganizer = Readonly<{
  name: string;
  email: string;
}>;

export type RefundEmailEvent = Readonly<{
  title: string;
  startsAt?: Date | string | null;
}>;

export type RefundEmailRequest = Readonly<{
  id: string;
  reference: string;
  amount: string | number;
  currency: string;
  reason?: string | null;
  requestedAt?: Date | string | null;
}>;

export type ProviderRefundExecutionInput = Readonly<{
  refundId: string;
  refundReference: string;
  provider: string;
  providerTransactionId: string | null;
  providerReference: string | null;
  amount: string | number;
  currency: string;
  idempotencyKey?: string | null;
}>;

export type ProviderRefundExecutionResult = Readonly<{
  provider: string;
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
  providerRefundId: string | null;
  providerReference: string | null;
  rawStatus: string | null;
  processedAt: string | null;
  raw: unknown;
}>;
