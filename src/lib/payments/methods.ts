import "server-only";
import { isSupportedCurrency } from "@/i18n/config";
import { fedapayCheckout } from "@/lib/payments/fedapay";
import type { PaymentCheckoutConnector } from "@/lib/payments/types";
const connectors: Record<string, { checkout: PaymentCheckoutConnector }> = { fedapay: { checkout: fedapayCheckout } };
export function getProviderConnector(code: string) { return connectors[code] ?? null; }
export function listInstalledConnectors() { return Object.keys(connectors).map(code => ({ code })); }
import type { PaymentMethodsQuery, PaymentMethodsResponse, PaymentSelection } from "@/lib/payments/types";

export type PaymentMethodFilters = PaymentMethodsQuery & { amountMinor?: string };

// Direct integrations own their catalogue and credentials. The retired Pay routing
// tables and the phone country must never prevent a configured connector running.
async function selections(filters: PaymentMethodFilters): Promise<PaymentSelection[]> {
  const currencyCode = filters.currencyCode.trim().toUpperCase();
  const amountMinor = filters.amountMinor ?? "1";
  if (!isSupportedCurrency(currencyCode) || !/^[1-9][0-9]{0,18}$/.test(amountMinor) || BigInt(amountMinor) > 9223372036854775807n) throw new Error("INVALID_PAYMENT_CONTEXT");
  const results = await Promise.all(listInstalledConnectors().map(async ({ code }) => {
    const checkout = getProviderConnector(code)?.checkout;
    if (!checkout?.listMethods) return [];
    return (await checkout.listMethods({ ...filters, currencyCode, amountMinor }))
      .filter(selection => checkout.supportsMethod(selection.method.code));
  }));
  return results.flat().sort((a,b) => a.route.priority - b.route.priority || a.method.displayOrder - b.method.displayOrder);
}

export async function getPublicPaymentMethods(filters: PaymentMethodFilters): Promise<PaymentMethodsResponse> {
  const unique = new Map<string, PaymentSelection["method"]>();
  for (const selection of await selections(filters)) if (!unique.has(selection.method.id)) unique.set(selection.method.id, selection.method);
  return { success: true, countryCode: "", currencyCode: filters.currencyCode.trim().toUpperCase(),
    methods: [...unique.values()].map(({ id, name, category, logoUrl, displayOrder, mayRequireExternalAuthentication }) => ({ id, name, category, logoUrl, displayOrder, mayRequireExternalAuthentication })),
    checkedAt: new Date().toISOString() };
}

export const listPublicPaymentMethods = getPublicPaymentMethods;

export async function resolvePaymentSelection(methodId: string, filters: PaymentMethodFilters): Promise<PaymentSelection | null> {
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(methodId)) return null;
  return (await selections(filters)).find(selection => selection.method.id === methodId) ?? null;
}
