"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

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

export type ClientEventDetailCheckoutProps = {
  event: ClientEventDetail;
};

type CheckoutDraft = {
  version: 1;
  eventId: string;
  eventSlug: string;
  currency: string;
  ticketSelection: ClientTicketSelection;

  guestInformation: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    countryCode: string;
  };

  createdAt: string;
};

const EMPTY_GUEST_INFORMATION: ClientGuestInformation = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  countryCode: "",
};

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
    !value.countryCode
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

export default function ClientEventDetailCheckout({
  event,
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
      EMPTY_GUEST_INFORMATION,
    );

  const [
    guestErrors,
    setGuestErrors,
  ] =
    useState<ClientGuestInformationErrors>(
      {},
    );

  const [
    isPreparingCheckout,
    setIsPreparingCheckout,
  ] =
    useState(
      false,
    );

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
      isPreparingCheckout
    ) {
      return;
    }

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
      const checkoutDraft: CheckoutDraft = {
        version:
          1,

        eventId:
          event.id,

        eventSlug:
          event.slug,

        currency:
          event.currency,

        ticketSelection,

        guestInformation: {
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
            guestInformation.countryCode,
        },

        createdAt:
          new Date().toISOString(),
      };

      window.sessionStorage.setItem(
        `tikemia-checkout:${event.id}`,
        JSON.stringify(
          checkoutDraft,
        ),
      );

      router.push(
        `/checkout/${encodeURIComponent(
          event.slug,
        )}`,
      );
    } catch {
      setIsPreparingCheckout(
        false,
      );
    }
  }

  return (
    <div
      data-client-event-detail-page="true"
      className="min-h-screen bg-[#03070a] text-white"
    >
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-56 pt-4 sm:px-5 sm:pt-6 lg:px-8 lg:pb-16 lg:pt-8">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.72fr)] xl:items-start xl:gap-7">
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
                onChange={
                  setTicketSelection
                }
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

            <div
              id="client-event-guest-information"
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