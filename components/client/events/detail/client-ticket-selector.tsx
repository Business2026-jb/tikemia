"use client";

import {
  Minus,
  Plus,
  Ticket,
} from "lucide-react";

import type {
  ClientEventDetailTicketType,
} from "@/lib/client/get-client-event-detail";

export type ClientTicketSelection = Record<
  string,
  number
>;

export type ClientTicketSelectorProps = {
  ticketTypes: readonly ClientEventDetailTicketType[];

  value: ClientTicketSelection;

  title?: string;
  description?: string;

  disabled?: boolean;

  className?: string;

  onChange: (
    value: ClientTicketSelection,
  ) => void;
};

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeQuantity(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    Math.trunc(value),
    0,
  );
}

function formatMoney({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          [
            "XOF",
            "XAF",
          ].includes(
            currency,
          )
            ? 0
            : 2,
      },
    ).format(
      Math.max(
        amount,
        0,
      ),
    );
  } catch {
    return `${Math.max(
      amount,
      0,
    ).toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function getSaleStatusLabel(
  ticketType: ClientEventDetailTicketType,
): string {
  switch (
    ticketType.saleStatus
  ) {
    case "NOT_STARTED":
      return "Vente à venir";

    case "ENDED":
      return "Vente terminée";

    case "SOLD_OUT":
      return "Épuisé";

    case "INACTIVE":
      return "Indisponible";

    default:
      return ticketType.availableTickets <= 10
        ? `${ticketType.availableTickets} place${
            ticketType.availableTickets > 1
              ? "s"
              : ""
          } restante${
            ticketType.availableTickets > 1
              ? "s"
              : ""
          }`
        : `${ticketType.availableTickets.toLocaleString(
            "fr-FR",
          )} disponible${
            ticketType.availableTickets > 1
              ? "s"
              : ""
          }`;
  }
}

function getSaleStatusClassName(
  ticketType: ClientEventDetailTicketType,
): string {
  switch (
    ticketType.saleStatus
  ) {
    case "NOT_STARTED":
      return "border-sky-500/20 bg-sky-500/[0.07] text-sky-300";

    case "ENDED":
    case "INACTIVE":
      return "border-white/[0.08] bg-white/[0.025] text-neutral-500";

    case "SOLD_OUT":
      return "border-red-500/20 bg-red-500/[0.07] text-red-400";

    default:
      return ticketType.availableTickets <= 10
        ? "border-orange-500/20 bg-orange-500/[0.07] text-orange-300"
        : "border-lime-500/20 bg-lime-500/[0.07] text-lime-300";
  }
}

export default function ClientTicketSelector({
  ticketTypes,

  value,

  title =
    "Choisissez vos billets",

  description =
    "Sélectionnez la catégorie et la quantité souhaitées.",

  disabled = false,

  className,

  onChange,
}: ClientTicketSelectorProps) {
  function updateQuantity({
    ticketType,
    nextQuantity,
  }: {
    ticketType: ClientEventDetailTicketType;
    nextQuantity: number;
  }): void {
    if (
      disabled ||
      !ticketType.canPurchase
    ) {
      return;
    }

    const currentQuantity =
      normalizeQuantity(
        value[
          ticketType.id
        ],
      );

    const maximumAllowed =
      Math.max(
        Math.min(
          ticketType.maxPerOrder,
          ticketType.availableTickets,
        ),
        0,
      );

    const normalizedNextQuantity =
      Math.min(
        Math.max(
          Math.trunc(
            nextQuantity,
          ),
          0,
        ),
        maximumAllowed,
      );

    if (
      normalizedNextQuantity ===
      currentQuantity
    ) {
      return;
    }

    const nextValue = {
      ...value,
    };

    if (
      normalizedNextQuantity >
      0
    ) {
      nextValue[
        ticketType.id
      ] =
        normalizedNextQuantity;
    } else {
      delete nextValue[
        ticketType.id
      ];
    }

    onChange(
      nextValue,
    );
  }

  return (
    <section
      aria-labelledby="client-ticket-selector-title"
      className={cn(
        "w-full rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
          <Ticket
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <div className="min-w-0">
          <h2
            id="client-ticket-selector-title"
            className="text-base font-black text-white sm:text-lg"
          >
            {
              title
            }
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {
              description
            }
          </p>
        </div>
      </div>

      {ticketTypes.length >
      0 ? (
        <div className="mt-5 space-y-3">
          {ticketTypes.map(
            (
              ticketType,
            ) => {
              const quantity =
                normalizeQuantity(
                  value[
                    ticketType.id
                  ],
                );

              const maximumAllowed =
                Math.max(
                  Math.min(
                    ticketType.maxPerOrder,
                    ticketType.availableTickets,
                  ),
                  0,
                );

              const canDecrease =
                !disabled &&
                quantity >
                  0;

              const canIncrease =
                !disabled &&
                ticketType.canPurchase &&
                quantity <
                  maximumAllowed;

              return (
                <article
                  key={
                    ticketType.id
                  }
                  className={cn(
                    "rounded-2xl border px-4 py-4 transition sm:px-5",
                    quantity >
                      0
                      ? "border-lime-500/25 bg-lime-500/[0.05]"
                      : "border-white/[0.08] bg-white/[0.02]",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-white sm:text-base">
                          {
                            ticketType.name
                          }
                        </h3>

                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black",
                            getSaleStatusClassName(
                              ticketType,
                            ),
                          )}
                        >
                          {
                            getSaleStatusLabel(
                              ticketType,
                            )
                          }
                        </span>
                      </div>

                      {ticketType.description && (
                        <p className="mt-2 text-xs leading-5 text-neutral-500 sm:text-sm">
                          {
                            ticketType.description
                          }
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <p className="text-base font-black text-lime-400 sm:text-lg">
                          {
                            ticketType.price ===
                            0
                              ? "Gratuit"
                              : formatMoney({
                                  amount:
                                    ticketType.price,

                                  currency:
                                    ticketType.currency,
                                })
                          }
                        </p>

                        <p className="text-[11px] text-neutral-600">
                          Maximum{" "}
                          <strong className="font-black text-neutral-400">
                            {
                              ticketType.maxPerOrder
                            }
                          </strong>{" "}
                          par commande
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity({
                            ticketType,

                            nextQuantity:
                              quantity -
                              1,
                          })
                        }
                        disabled={
                          !canDecrease
                        }
                        aria-label={`Retirer un billet ${ticketType.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] text-white outline-none transition hover:bg-white/[0.06] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-lime-400/70"
                      >
                        <Minus
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </button>

                      <div
                        aria-live="polite"
                        className="flex h-11 min-w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#03090d] px-3 text-base font-black text-white"
                      >
                        {
                          quantity
                        }
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity({
                            ticketType,

                            nextQuantity:
                              quantity +
                              1,
                          })
                        }
                        disabled={
                          !canIncrease
                        }
                        aria-label={`Ajouter un billet ${ticketType.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-500/25 bg-lime-500/[0.08] text-lime-300 outline-none transition hover:bg-lime-500/[0.13] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-lime-400/70"
                      >
                        <Plus
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 py-8 text-center">
          <Ticket
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-neutral-700"
          />

          <p className="mt-3 text-sm font-black text-neutral-400">
            Aucun billet disponible
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-700">
            Les billets pour cet événement ne sont pas encore disponibles.
          </p>
        </div>
      )}
    </section>
  );
}