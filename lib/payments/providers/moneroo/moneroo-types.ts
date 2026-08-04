export type MonerooPrimitive = string | number | boolean | null;

export type MonerooMetadata = Record<string, MonerooPrimitive>;

export type MonerooPaymentStatus =
  | "initiated"
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "cancelled"
  | "canceled"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | string;

export type MonerooCustomerInput = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  city?: string;
  country_code?: string;
};

export type MonerooInitializePaymentInput = {
  amount: number;
  currency: string;
  description: string;
  return_url: string;
  customer: MonerooCustomerInput;
  metadata?: MonerooMetadata;
};

export type MonerooPaymentCustomer = {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country_code?: string | null;
  [key: string]: unknown;
};

export type MonerooPaymentContext = {
  gateway?: string | null;
  payment_method?: string | null;
  payment_method_type?: string | null;
  country_code?: string | null;
  [key: string]: unknown;
};

export type MonerooPaymentData = {
  id: string;
  status: MonerooPaymentStatus;
  amount: number;
  currency: string;
  description?: string | null;
  link?: string | null;
  reference?: string | null;
  is_processed?: boolean;
  processed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  customer?: MonerooPaymentCustomer | null;
  context?: MonerooPaymentContext | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type MonerooApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data: T;
};

export type MonerooInitializePaymentResponse =
  MonerooApiResponse<MonerooPaymentData>;

export type MonerooRetrievePaymentResponse =
  MonerooApiResponse<MonerooPaymentData>;

export type MonerooVerifyPaymentResponse =
  MonerooApiResponse<MonerooPaymentData>;

export type MonerooApiErrorPayload = {
  success?: boolean;
  message?: string | null;
  error?: string | null;
  code?: string | null;
  errors?: Record<string, unknown> | unknown[];
  data?: unknown;
  [key: string]: unknown;
};

export type MonerooRequestOptions = {
  signal?: AbortSignal;
  idempotencyKey?: string;
};

export type MonerooWebhookPayload = {
  id?: string;
  event?: string;
  type?: string;
  data?: {
    id?: string;
    payment_id?: string;
    status?: MonerooPaymentStatus;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMonerooApiResponse<T>(
  value: unknown,
  isData: (data: unknown) => data is T,
): value is MonerooApiResponse<T> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.success === "boolean" && "data" in value && isData(value.data)
  );
}

export function isMonerooPaymentData(
  value: unknown,
): value is MonerooPaymentData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.status === "string" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    typeof value.currency === "string" &&
    value.currency.trim().length > 0
  );
}
