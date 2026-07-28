"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  AlertCircle,
} from "lucide-react";

import ClientEventDescription from "@/components/client/events/detail/client-event-description";
import ClientEventGallery from "@/components/client/events/detail/client-event-gallery";
import ClientEventLocation from "@/components/client/events/detail/client-event-location";
import ClientEventSummary from "@/components/client/events/detail/client-event-summary";
import ClientGuestInformationForm, {
  type ClientGuestInformation,
  type ClientGuestInformationErrors,
} from "@/components/client/events/detail/client-guest-information-form";
import ClientMobileCheckoutBar from "@/components/client/events/detail/client-mobile-checkout-bar";
import ClientOrderSummary, {
  type ClientOrderSummaryItem,
} from "@/components/client/events/detail/client-order-summary";
import ClientTicketSelector, {
  type ClientTicketSelection,
} from "@/components/client/events/detail/client-ticket-selector";
import type {
  ClientEventDetail,
} from "@/lib/client/get-client-event-detail";

export type ClientEventDetailCheckoutClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
};

export type ClientEventDetailCheckoutProps = {
  event: ClientEventDetail;
  currentClient?: ClientEventDetailCheckoutClient | null;
};

type CheckoutOrderItem = {
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  platformFee: string;
  total: string;
};

type CheckoutOrderResponse = {
  success: boolean;
  code?: string;
  message?: string;

  order?: {
    id: string;
    reference: string;
    status: string;
    currency: string;
    subtotal: string;
    platformFee: string;
    total: string;
    reservationExpiresAt: string | null;
    checkoutToken: string;

    event: {
      id: string;
      slug: string;
      title: string;
    };

    items: CheckoutOrderItem[];
  };

  error?: {
    code?: string;
    message?: string;
  };
};

const EMPTY_GUEST_INFORMATION: ClientGuestInformation = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  countryCode: "",
};

function createInitialGuestInformation(
  currentClient:
    | ClientEventDetailCheckoutClient
    | null
    | undefined,
): ClientGuestInformation {
  if (!currentClient) {
    return EMPTY_GUEST_INFORMATION;
  }

  return {
    firstName:
      currentClient.firstName.trim(),

    lastName:
      currentClient.lastName.trim(),

    email:
      currentClient.email
        .trim()
        .toLowerCase(),

    phone:
      currentClient.phone.trim(),

    countryCode:
      currentClient.countryCode
        .trim()
        .toUpperCase(),
  };
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim(),
  );
}

function validateGuestInformation(
  value: ClientGuestInformation,
): ClientGuestInformationErrors {
  const errors: ClientGuestInformationErrors = {};

  if (
    normalizeText(
      value.firstName,
    ).length < 2
  ) {
    errors.firstName =
      "Veuillez saisir votre prénom.";
  }

  if (
    normalizeText(
      value.lastName,
    ).length < 2
  ) {
    errors.lastName =
      "Veuillez saisir votre nom.";
  }

  if (
    !isValidEmail(
      value.email,
    )
  ) {
    errors.email =
      "Veuillez saisir une adresse email valide.";
  }

  if (
    value.phone.replace(
      /\D/g,
      "",
    ).length < 7
  ) {
    errors.phone =
      "Veuillez saisir un numéro de téléphone valide.";
  }

  if (
    !/^[A-Za-z]{2}$/.test(
      value.countryCode.trim(),
    )
  ) {
    errors.countryCode =
      "Veuillez sélectionner votre pays.";
  }

  return errors;
}

function scrollToSection(
  id: string,
  block:
    | "start"
    | "center" =
    "start",
): void {
  document
    .getElementById(
      id,
    )
    ?.scrollIntoView({
      behavior:
        "smooth",

      block,
    });
}

function createCheckoutIdempotencyKey(
  eventId: string,
): string {
  const storageKey =
    `tikemia:checkout:idempotency:${eventId}`;

  const existingKey =
    window.sessionStorage.getItem(
      storageKey,
    );

  if (
    existingKey
  ) {
    return existingKey;
  }

  const randomValue =
    typeof crypto !==
      "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;

  const idempotencyKey =
    `checkout_${eventId}_${randomValue}`
      .replace(
        /[^A-Za-z0-9._:-]/g,
        "_",
      )
      .slice(
        0,
        190,
      );

  window.sessionStorage.setItem(
    storageKey,
    idempotencyKey,
  );

  return idempotencyKey;
}

function clearCheckoutIdempotencyKey(
  eventId: string,
): void {
  window.sessionStorage.removeItem(
    `tikemia:checkout:idempotency:${eventId}`,
  );
}

export default function ClientEventDetailCheckout({
  event,
  currentClient = null,
}: ClientEventDetailCheckoutProps) {
  const router =
    useRouter();

  const [
    ticketSelection,
    setTicketSelection,
  ] =
    useState<ClientTicketSelection>(
      {},
    );

  const [
    guestInformation,
    setGuestInformation,
  ] =
    useState<ClientGuestInformation>(
      () =>
        createInitialGuestInformation(
          currentClient,
        ),
    );

  const [
    guestErrors,
    setGuestErrors,
  ] =
    useState<ClientGuestInformationErrors>(
      {},
    );

  const [
    checkoutError,
    setCheckoutError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isPreparingCheckout,
    setIsPreparingCheckout,
  ] =
    useState(
      false,
    );

  useEffect(() => {
    if (!currentClient) {
      return;
    }

    setGuestInformation(
      createInitialGuestInformation(
        currentClient,
      ),
    );

    setGuestErrors(
      {},
    );
  }, [currentClient]);

  const selectedItems =
    useMemo<ClientOrderSummaryItem[]>(
      () =>
        event.ticketTypes
          .map(
            (
              ticketType,
            ) => ({
              id:
                ticketType.id,

              name:
                ticketType.name,

              quantity:
                ticketSelection[
                  ticketType.id
                ] ??
                0,

              unitPrice:
                ticketType.price,
            }),
          )
          .filter(
            (
              item,
            ) =>
              item.quantity >
              0,
          ),
      [
        event.ticketTypes,
        ticketSelection,
      ],
    );

  const selectedTicketsCount =
    useMemo(
      () =>
        selectedItems.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.quantity,
          0,
        ),
      [
        selectedItems,
      ],
    );

  const subtotal =
    useMemo(
      () =>
        selectedItems.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.unitPrice *
              item.quantity,
          0,
        ),
      [
        selectedItems,
      ],
    );

  const normalizedPlatformFeeRate =
    Number.isFinite(
      event.platformFeeRate,
    )
      ? Math.max(
          event.platformFeeRate,
          0,
        )
      : 0;

  const serviceFee =
    subtotal *
    (
      normalizedPlatformFeeRate /
      100
    );

  const totalAmount =
    subtotal +
    serviceFee;

  const checkoutDisabled =
    !event.sales.isOpen ||
    event.availability.soldOut;

  async function handleCheckout(): Promise<void> {
    if (
      isPreparingCheckout ||
      checkoutDisabled
    ) {
      return;
    }

    setCheckoutError(
      null,
    );

    if (
      selectedTicketsCount <=
      0
    ) {
      scrollToSection(
        "client-event-ticket-selector",
      );

      return;
    }

    const errors =
      validateGuestInformation(
        guestInformation,
      );

    setGuestErrors(
      errors,
    );

    if (
      Object.keys(
        errors,
      ).length >
      0
    ) {
      scrollToSection(
        "client-event-guest-information",
        "center",
      );

      return;
    }

    setIsPreparingCheckout(
      true,
    );

    try {
      const idempotencyKey =
        createCheckoutIdempotencyKey(
          event.id,
        );

      const response =
        await fetch(
          "/api/client/checkout/orders",
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",

              "Idempotency-Key":
                idempotencyKey,
            },

            body:
              JSON.stringify({
                eventId:
                  event.id,

                items:
                  selectedItems.map(
                    (
                      item,
                    ) => ({
                      ticketTypeId:
                        item.id,

                      quantity:
                        item.quantity,
                    }),
                  ),

                customer: {
                  firstName:
                    normalizeText(
                      guestInformation.firstName,
                    ),

                  lastName:
                    normalizeText(
                      guestInformation.lastName,
                    ),

                  email:
                    guestInformation.email
                      .trim()
                      .toLowerCase(),

                  phone:
                    guestInformation.phone
                      .trim(),

                  countryCode:
                    guestInformation.countryCode
                      .trim()
                      .toUpperCase(),
                },

                idempotencyKey,
              }),
          },
        );

      const payload =
        await response
          .json() as CheckoutOrderResponse;

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.error
            ?.message ||
          payload.message ||
          "Impossible de préparer la commande.",
        );
      }

      if (
        !payload.order?.id ||
        !payload.order.checkoutToken
      ) {
        throw new Error(
          "La commande sécurisée est incomplète.",
        );
      }

      const checkoutOrder = {
        ...payload.order,

        event: {
          ...payload.order.event,

          coverImage:
            event.coverImage ??
            event.images[0]
              ?.publicUrl ??
            null,

          venueName:
            event.venueName,

          city:
            event.city,

          country:
            event.country,

          startsAt:
            event.startsAt,
        },
      };

      window.sessionStorage.setItem(
        `tikemia:checkout:${payload.order.id}`,
        JSON.stringify({
          order:
            checkoutOrder,
        }),
      );

      window.sessionStorage.setItem(
        "tikemia:checkout:current",
        JSON.stringify({
          order:
            checkoutOrder,
        }),
      );

      clearCheckoutIdempotencyKey(
        event.id,
      );

      router.push(
        `/checkout/${encodeURIComponent(
          payload.order.id,
        )}`,
      );
    } catch (
      error
    ) {
      setCheckoutError(
        error instanceof
          Error
          ? error.message
          : "Impossible de préparer la commande.",
      );

      setIsPreparingCheckout(
        false,
      );
    }
  }

  return (
    <div
      data-client-event-detail-page="true"
      className="min-h-screen w-full max-w-none self-stretch bg-[#03070a] text-white"
    >
      <main className="w-full max-w-none px-4 pb-56 pt-4 sm:px-5 sm:pt-6 lg:px-8 lg:pb-16 lg:pt-8 xl:px-10 2xl:px-12">
        <div className="grid w-full min-w-0 max-w-none gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.75fr)] xl:items-start xl:gap-7 2xl:gap-8">
          <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
            <ClientEventGallery
              event={
                event
              }
              priority
            />

            <ClientEventSummary
              event={
                event
              }
              organizerProfileHref={
                null
              }
            />
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-28 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <div
              id="client-event-ticket-selector"
              className="scroll-mt-28"
            >
              <ClientTicketSelector
                ticketTypes={
                  event.ticketTypes
                }
                value={
                  ticketSelection
                }
                disabled={
                  checkoutDisabled ||
                  isPreparingCheckout
                }
                onChange={(
                  nextSelection,
                ) => {
                  setTicketSelection(
                    nextSelection,
                  );

                  setCheckoutError(
                    null,
                  );

                  clearCheckoutIdempotencyKey(
                    event.id,
                  );
                }}
              />
            </div>

            <ClientOrderSummary
              items={
                selectedItems
              }
              currency={
                event.currency
              }
              platformFeeRate={
                normalizedPlatformFeeRate
              }
              loading={
                isPreparingCheckout
              }
              disabled={
                checkoutDisabled
              }
              showCheckoutButton={
                true
              }
              onCheckout={
                handleCheckout
              }
            />

            {checkoutError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4 text-sm leading-6 text-red-300"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />

                <span>
                  {checkoutError}
                </span>
              </div>
            )}

            <div
              id="client-event-guest-information"
              data-authenticated-client={
                currentClient
                  ? "true"
                  : "false"
              }
              className="scroll-mt-28"
            >
              <ClientGuestInformationForm
                value={
                  guestInformation
                }
                errors={
                  guestErrors
                }
                disabled={
                  isPreparingCheckout
                }
                onChange={(
                  nextValue,
                ) => {
                  setGuestInformation(
                    nextValue,
                  );

                  setCheckoutError(
                    null,
                  );

                  clearCheckoutIdempotencyKey(
                    event.id,
                  );

                  if (
                    Object.keys(
                      guestErrors,
                    ).length >
                    0
                  ) {
                    setGuestErrors(
                      {},
                    );
                  }
                }}
              />
            </div>
          </aside>

          <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-2">
            <div
              id="client-event-description"
              className="scroll-mt-28"
            >
              <ClientEventDescription
                event={
                  event
                }
              />
            </div>

            <ClientEventLocation
              event={
                event
              }
            />
          </div>
        </div>
      </main>

      <ClientMobileCheckoutBar
        totalAmount={
          totalAmount
        }
        currency={
          event.currency
        }
        selectedTicketsCount={
          selectedTicketsCount
        }
        loading={
          isPreparingCheckout
        }
        disabled={
          checkoutDisabled
        }
        onCheckout={
          handleCheckout
        }
        className="!bottom-[calc(72px+env(safe-area-inset-bottom))] !pb-3"
      />
    </div>
  );
}