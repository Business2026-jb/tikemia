"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Ticket,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Recipient = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  country: string;
  countryCode: string;
  maskedEmail: string;
  maskedPhone: string;
  verified: boolean;
};

type TransferTicket = {
  id: string;
  code: string;
  holderName: string;
  holderEmail: string;
  purchasedAt: string;
};

type TransferCategory = {
  ticketTypeId: string;
  name: string;
  description: string | null;
  unitPrice: string;
  availableQuantity: number;
  tickets: TransferTicket[];
};

type TransferEvent = {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  venueName: string;
  city: string;
  country: string;
  startsAt: string;
  endsAt: string | null;
  currency: string;
  transferableTicketsCount: number;
  categories: TransferCategory[];
};

type RecipientApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  recipient?: Recipient;
};

type OptionsApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  events?: TransferEvent[];
  summary?: {
    eventsCount: number;
    ticketsCount: number;
  };
};

type RequestCodeApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  transfer?: {
    reference: string;
    ticketsCount: number;
    expiresAt: string;
    expiresInMinutes: number;
    recipient: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
    };
    event: {
      id: string;
      title: string;
      startsAt: string;
    };
  };
};

type ConfirmApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  remainingAttempts?: number;
  transfer?: {
    reference: string;
    completedAt: string;
    ticketsCount: number;
    event: {
      id: string;
      title: string;
      startsAt: string;
      venueName: string;
      city: string;
    };
    recipient: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      maskedEmail: string;
    };
    emails: {
      senderConfirmationSent: boolean;
      recipientNotificationSent: boolean;
    };
  };
};

type PageStep =
  | "RECIPIENT"
  | "TICKETS"
  | "CODE"
  | "SUCCESS";

type SelectionMap = Record<
  string,
  number
>;

const STEP_ORDER: PageStep[] = [
  "RECIPIENT",
  "TICKETS",
  "CODE",
  "SUCCESS",
];

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(new Date(value));
}

function formatTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      style: "currency",
      currency,
      minimumFractionDigits:
        currency === "XOF"
          ? 0
          : 2,
      maximumFractionDigits:
        currency === "XOF"
          ? 0
          : 2,
    },
  ).format(Number(amount));
}

function getStepNumber(
  step: PageStep,
): number {
  return STEP_ORDER.indexOf(step) + 1;
}

export default function ClientTransfersPage() {
  const [
    step,
    setStep,
  ] =
    useState<PageStep>(
      "RECIPIENT",
    );

  const [
    identifier,
    setIdentifier,
  ] =
    useState("");

  const [
    recipient,
    setRecipient,
  ] =
    useState<Recipient | null>(
      null,
    );

  const [
    events,
    setEvents,
  ] =
    useState<TransferEvent[]>(
      [],
    );

  const [
    selectedEventId,
    setSelectedEventId,
  ] =
    useState("");

  const [
    selections,
    setSelections,
  ] =
    useState<SelectionMap>(
      {},
    );

  const [
    transferReference,
    setTransferReference,
  ] =
    useState("");

  const [
    code,
    setCode,
  ] =
    useState("");

  const [
    expiresAt,
    setExpiresAt,
  ] =
    useState("");

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] =
    useState(0);

  const [
    loadingRecipient,
    setLoadingRecipient,
  ] =
    useState(false);

  const [
    loadingOptions,
    setLoadingOptions,
  ] =
    useState(false);

  const [
    requestingCode,
    setRequestingCode,
  ] =
    useState(false);

  const [
    confirming,
    setConfirming,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    completedTransfer,
    setCompletedTransfer,
  ] =
    useState<
      ConfirmApiResponse["transfer"] | null
    >(null);

  const selectedEvent =
    useMemo(
      () =>
        events.find(
          (
            event,
          ) =>
            event.id ===
            selectedEventId,
        ) ??
        null,
      [
        events,
        selectedEventId,
      ],
    );

  const selectedTickets =
    useMemo(() => {
      if (!selectedEvent) {
        return [];
      }

      const tickets: TransferTicket[] =
        [];

      for (
        const category of
        selectedEvent.categories
      ) {
        const quantity =
          selections[
            category.ticketTypeId
          ] ??
          0;

        tickets.push(
          ...category.tickets.slice(
            0,
            quantity,
          ),
        );
      }

      return tickets;
    }, [
      selectedEvent,
      selections,
    ]);

  const totalSelected =
    selectedTickets.length;

  const currentStepNumber =
    getStepNumber(
      step,
    );

  const loadTransferOptions =
    useCallback(
      async () => {
        setLoadingOptions(
          true,
        );

        setError("");

        try {
          const response =
            await fetch(
              "/api/client/transfers/options",
              {
                method: "GET",
                cache: "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const data =
            (await response.json()) as OptionsApiResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Impossible de charger vos billets transférables.",
            );
          }

          const availableEvents =
            data.events ??
            [];

          setEvents(
            availableEvents,
          );

          if (
            availableEvents.length ===
            1
          ) {
            setSelectedEventId(
              availableEvents[0]
                .id,
            );
          }
        } catch (caughtError) {
          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Impossible de charger vos billets transférables.",
          );
        } finally {
          setLoadingOptions(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadTransferOptions();
  }, [loadTransferOptions]);

  useEffect(() => {
    if (
      step !== "CODE" ||
      !expiresAt
    ) {
      return;
    }

    const updateTimer = () => {
      const difference =
        Math.max(
          0,
          Math.ceil(
            (new Date(
              expiresAt,
            ).getTime() -
              Date.now()) /
              1000,
          ),
        );

      setRemainingSeconds(
        difference,
      );
    };

    updateTimer();

    const interval =
      window.setInterval(
        updateTimer,
        1000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [
    step,
    expiresAt,
  ]);

  async function handleRecipientSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedIdentifier =
      identifier.trim();

    if (
      normalizedIdentifier.length <
      3
    ) {
      setError(
        "Saisissez une adresse e-mail ou un numéro de téléphone.",
      );

      return;
    }

    setLoadingRecipient(
      true,
    );

    setError("");
    setSuccessMessage("");
    setRecipient(null);

    try {
      const response =
        await fetch(
          "/api/client/transfers/recipient",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body:
              JSON.stringify({
                identifier:
                  normalizedIdentifier,
              }),
          },
        );

      const data =
        (await response.json()) as RecipientApiResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.recipient
      ) {
        throw new Error(
          data.message ||
            "Destinataire introuvable.",
        );
      }

      setRecipient(
        data.recipient,
      );

      setSuccessMessage(
        "Compte Tikemia vérifié.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Impossible de vérifier ce destinataire.",
      );
    } finally {
      setLoadingRecipient(
        false,
      );
    }
  }

  function continueToTickets() {
    if (!recipient) {
      setError(
        "Vérifiez d’abord le destinataire.",
      );

      return;
    }

    setError("");
    setSuccessMessage("");
    setStep("TICKETS");
  }

  function selectEvent(
    eventId: string,
  ) {
    setSelectedEventId(
      eventId,
    );

    setSelections({});
    setError("");
  }

  function changeQuantity(
    ticketTypeId: string,
    nextQuantity: number,
    maxQuantity: number,
  ) {
    const safeQuantity =
      Math.max(
        0,
        Math.min(
          nextQuantity,
          maxQuantity,
        ),
      );

    setSelections(
      (
        current,
      ) => ({
        ...current,
        [ticketTypeId]:
          safeQuantity,
      }),
    );
  }

  async function requestCode() {
    if (
      !recipient ||
      !selectedEvent ||
      totalSelected < 1
    ) {
      setError(
        "Sélectionnez au moins un billet.",
      );

      return;
    }

    setRequestingCode(
      true,
    );

    setError("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          "/api/client/transfers/request-code",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body:
              JSON.stringify({
                recipientId:
                  recipient.id,
                ticketIds:
                  selectedTickets.map(
                    (
                      ticket,
                    ) =>
                      ticket.id,
                  ),
              }),
          },
        );

      const data =
        (await response.json()) as RequestCodeApiResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.transfer
      ) {
        throw new Error(
          data.message ||
            "Impossible d’envoyer le code.",
        );
      }

      setTransferReference(
        data.transfer.reference,
      );

      setExpiresAt(
        data.transfer.expiresAt,
      );

      setCode("");

      setStep("CODE");

      setSuccessMessage(
        data.message ||
          "Code envoyé par e-mail.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Impossible d’envoyer le code.",
      );
    } finally {
      setRequestingCode(
        false,
      );
    }
  }

  async function confirmTransfer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !/^\d{6}$/.test(
        code,
      )
    ) {
      setError(
        "Le code doit contenir 6 chiffres.",
      );

      return;
    }

    if (
      !transferReference
    ) {
      setError(
        "La référence du transfert est manquante.",
      );

      return;
    }

    setConfirming(
      true,
    );

    setError("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          "/api/client/transfers/confirm",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body:
              JSON.stringify({
                reference:
                  transferReference,
                code,
              }),
          },
        );

      const data =
        (await response.json()) as ConfirmApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Impossible de confirmer le transfert.",
        );
      }

      setCompletedTransfer(
        data.transfer ??
          null,
      );

      setStep("SUCCESS");

      setSuccessMessage(
        data.message ||
          "Transfert effectué avec succès.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Impossible de confirmer le transfert.",
      );
    } finally {
      setConfirming(
        false,
      );
    }
  }

  function resetFlow() {
    setStep("RECIPIENT");
    setIdentifier("");
    setRecipient(null);
    setSelectedEventId("");
    setSelections({});
    setTransferReference("");
    setCode("");
    setExpiresAt("");
    setRemainingSeconds(0);
    setError("");
    setSuccessMessage("");
    setCompletedTransfer(null);

    void loadTransferOptions();
  }

  const minutes =
    Math.floor(
      remainingSeconds /
        60,
    );

  const seconds =
    remainingSeconds % 60;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body footer {
              display: none !important;
            }
          `,
        }}
      />

      <main className="min-h-screen w-full bg-[#03070a] text-white">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:py-9 lg:pb-12 xl:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                Espace client
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                Transférer mes billets
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
                Envoyez vos billets à un autre compte Tikemia.
              </p>
            </div>

            <Link
              href="/account/tickets"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Mes billets
            </Link>
          </div>

          <section className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#071015]">
            <div className="grid grid-cols-4 border-b border-white/[0.07]">
              {[
                "Destinataire",
                "Billets",
                "Code",
                "Terminé",
              ].map(
                (
                  label,
                  index,
                ) => {
                  const number =
                    index + 1;

                  const active =
                    number ===
                    currentStepNumber;

                  const completed =
                    number <
                    currentStepNumber;

                  return (
                    <div
                      key={
                        label
                      }
                      className="relative min-w-0 px-2 py-3 text-center sm:px-4 sm:py-4"
                    >
                      <span
                        className={
                          active
                            ? "mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-lime-400 text-xs font-black text-[#071000]"
                            : completed
                              ? "mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/[0.09] text-emerald-300"
                              : "mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-xs font-black text-neutral-700"
                        }
                      >
                        {completed ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          number
                        )}
                      </span>

                      <span
                        className={
                          active
                            ? "mt-2 block truncate text-[10px] font-black text-white sm:text-xs"
                            : completed
                              ? "mt-2 block truncate text-[10px] font-black text-emerald-300 sm:text-xs"
                              : "mt-2 block truncate text-[10px] font-black text-neutral-700 sm:text-xs"
                        }
                      >
                        {label}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            <div className="p-4 sm:p-6 lg:p-7">
              {(error ||
                successMessage) && (
                <div
                  className={
                    error
                      ? "mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200"
                      : "mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 text-sm text-emerald-200"
                  }
                >
                  {error ? (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  )}

                  <p className="leading-6">
                    {error ||
                      successMessage}
                  </p>
                </div>
              )}

              {step ===
                "RECIPIENT" && (
                <div className="mx-auto max-w-3xl">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
                      <UserRound className="h-5 w-5" />
                    </span>

                    <div>
                      <h2 className="text-lg font-black text-white sm:text-xl">
                        Destinataire
                      </h2>

                      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                        Saisissez son e-mail ou son numéro Tikemia.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={
                      handleRecipientSearch
                    }
                    className="mt-6"
                  >
                    <label
                      htmlFor="recipient-identifier"
                      className="mb-2 block text-xs font-black text-neutral-400"
                    >
                      E-mail ou numéro
                    </label>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative min-w-0 flex-1">
                        {identifier.includes(
                          "@",
                        ) ? (
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                        ) : (
                          <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                        )}

                        <input
                          id="recipient-identifier"
                          value={
                            identifier
                          }
                          onChange={(
                            event,
                          ) => {
                            setIdentifier(
                              event.target.value,
                            );

                            setRecipient(
                              null,
                            );

                            setSuccessMessage(
                              "",
                            );

                            setError(
                              "",
                            );
                          }}
                          autoComplete="off"
                          inputMode={
                            identifier.includes(
                              "@",
                            )
                              ? "email"
                              : "text"
                          }
                          placeholder="exemple@email.com ou +229..."
                          className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/[0.08]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={
                          loadingRecipient
                        }
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-5 text-sm font-black text-lime-300 transition hover:bg-emerald-400/[0.13] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingRecipient ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}

                        Vérifier
                      </button>
                    </div>
                  </form>

                  {recipient && (
                    <div className="mt-6 rounded-[20px] border border-emerald-400/20 bg-emerald-400/[0.055] p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.09] text-lg font-black text-emerald-300">
                          {recipient.firstName
                            .slice(
                              0,
                              1,
                            )
                            .toUpperCase()}
                          {recipient.lastName
                            .slice(
                              0,
                              1,
                            )
                            .toUpperCase()}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-black text-white">
                              {
                                recipient.fullName
                              }
                            </h3>

                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-black text-emerald-300">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Vérifié
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4 text-neutral-600" />
                              {
                                recipient.maskedEmail
                              }
                            </span>

                            <span className="inline-flex items-center gap-2">
                              <Phone className="h-4 w-4 text-neutral-600" />
                              {
                                recipient.maskedPhone
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={
                          continueToTickets
                        }
                        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white"
                      >
                        Choisir les billets
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {step ===
                "TICKETS" && (
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white sm:text-xl">
                        Billets à transférer
                      </h2>

                      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                        Sélectionnez un événement puis la quantité.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStep(
                          "RECIPIENT",
                        );

                        setError(
                          "",
                        );

                        setSuccessMessage(
                          "",
                        );
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-neutral-400 transition hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Destinataire
                    </button>
                  </div>

                  {loadingOptions ? (
                    <div className="flex min-h-[260px] items-center justify-center">
                      <Loader2 className="h-7 w-7 animate-spin text-lime-400" />
                    </div>
                  ) : events.length ===
                    0 ? (
                    <div className="mt-6 rounded-[20px] border border-dashed border-white/[0.1] bg-[#03090d] px-5 py-12 text-center">
                      <Ticket className="mx-auto h-10 w-10 text-white/[0.12]" />

                      <h3 className="mt-4 text-lg font-black text-white">
                        Aucun billet transférable
                      </h3>

                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                        Vos billets valides et autorisés au transfert apparaîtront ici.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-6 grid gap-3 lg:grid-cols-2">
                        {events.map(
                          (
                            eventItem,
                          ) => {
                            const active =
                              eventItem.id ===
                              selectedEventId;

                            return (
                              <button
                                key={
                                  eventItem.id
                                }
                                type="button"
                                onClick={() =>
                                  selectEvent(
                                    eventItem.id,
                                  )
                                }
                                className={
                                  active
                                    ? "overflow-hidden rounded-[20px] border border-lime-400/30 bg-lime-400/[0.06] text-left"
                                    : "overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#03090d] text-left transition hover:border-white/[0.14]"
                                }
                              >
                                <div className="grid grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[145px_minmax(0,1fr)]">
                                  <div className="relative min-h-[125px] bg-[#071015]">
                                    {eventItem.coverImage ? (
                                      <Image
                                        src={
                                          eventItem.coverImage
                                        }
                                        alt={
                                          eventItem.title
                                        }
                                        fill
                                        sizes="145px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center">
                                        <Ticket className="h-10 w-10 text-white/[0.12]" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <h3 className="line-clamp-2 text-sm font-black text-white sm:text-base">
                                        {
                                          eventItem.title
                                        }
                                      </h3>

                                      <span
                                        className={
                                          active
                                            ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-400 text-[#071000]"
                                            : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-transparent"
                                        }
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    </div>

                                    <div className="mt-3 space-y-1.5 text-[11px] text-neutral-500">
                                      <p className="flex items-center gap-2">
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-lime-400" />
                                        {formatDate(
                                          eventItem.startsAt,
                                        )}
                                      </p>

                                      <p className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                                        {
                                          eventItem.city
                                        }
                                      </p>
                                    </div>

                                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.11em] text-neutral-600">
                                      {
                                        eventItem.transferableTicketsCount
                                      }{" "}
                                      billet
                                      {eventItem.transferableTicketsCount >
                                      1
                                        ? "s"
                                        : ""}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>

                      {selectedEvent && (
                        <div className="mt-6">
                          <h3 className="text-sm font-black text-white">
                            Catégories disponibles
                          </h3>

                          <div className="mt-3 space-y-3">
                            {selectedEvent.categories.map(
                              (
                                category,
                              ) => {
                                const quantity =
                                  selections[
                                    category.ticketTypeId
                                  ] ??
                                  0;

                                return (
                                  <div
                                    key={
                                      category.ticketTypeId
                                    }
                                    className="flex flex-col gap-4 rounded-[18px] border border-white/[0.08] bg-[#03090d] p-4 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-black text-white">
                                          {
                                            category.name
                                          }
                                        </h4>

                                        <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-black text-neutral-500">
                                          {
                                            category.availableQuantity
                                          }{" "}
                                          disponible
                                          {category.availableQuantity >
                                          1
                                            ? "s"
                                            : ""}
                                        </span>
                                      </div>

                                      {category.description && (
                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
                                          {
                                            category.description
                                          }
                                        </p>
                                      )}

                                      <p className="mt-2 text-xs font-black text-lime-400">
                                        {formatMoney(
                                          category.unitPrice,
                                          selectedEvent.currency,
                                        )}
                                      </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          changeQuantity(
                                            category.ticketTypeId,
                                            quantity -
                                              1,
                                            category.availableQuantity,
                                          )
                                        }
                                        disabled={
                                          quantity <=
                                          0
                                        }
                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>

                                      <span className="w-10 text-center text-lg font-black text-white">
                                        {
                                          quantity
                                        }
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          changeQuantity(
                                            category.ticketTypeId,
                                            quantity +
                                              1,
                                            category.availableQuantity,
                                          )
                                        }
                                        disabled={
                                          quantity >=
                                          category.availableQuantity
                                        }
                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/[0.07] text-lime-300 transition hover:bg-lime-400/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>

                          <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs text-neutral-500">
                                Sélection
                              </p>

                              <p className="mt-1 text-lg font-black text-white">
                                {
                                  totalSelected
                                }{" "}
                                billet
                                {totalSelected >
                                1
                                  ? "s"
                                  : ""}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void requestCode()
                              }
                              disabled={
                                requestingCode ||
                                totalSelected <
                                  1
                              }
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {requestingCode ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Mail className="h-4 w-4" />
                              )}

                              Recevoir le code
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {step ===
                "CODE" && (
                <div className="mx-auto max-w-xl">
                  <div className="text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.07] text-lime-300">
                      <ShieldCheck className="h-7 w-7" />
                    </span>

                    <h2 className="mt-5 text-xl font-black text-white sm:text-2xl">
                      Confirmer le transfert
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Entrez le code reçu par e-mail.
                    </p>
                  </div>

                  <form
                    onSubmit={
                      confirmTransfer
                    }
                    className="mt-7"
                  >
                    <label
                      htmlFor="transfer-code"
                      className="mb-2 block text-center text-xs font-black text-neutral-400"
                    >
                      Code à 6 chiffres
                    </label>

                    <input
                      id="transfer-code"
                      value={
                        code
                      }
                      onChange={(
                        event,
                      ) =>
                        setCode(
                          event.target.value
                            .replace(
                              /\D/g,
                              "",
                            )
                            .slice(
                              0,
                              6,
                            ),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={
                        6
                      }
                      autoFocus
                      placeholder="000000"
                      className="h-16 w-full rounded-2xl border border-white/[0.1] bg-[#03090d] px-4 text-center text-3xl font-black tracking-[0.35em] text-white outline-none transition placeholder:text-neutral-800 focus:border-lime-400/40 focus:ring-4 focus:ring-lime-400/[0.08]"
                    />

                    <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-[#03090d] p-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-mono">
                        {
                          transferReference
                        }
                      </span>

                      <span
                        className={
                          remainingSeconds >
                          0
                            ? "font-black text-amber-300"
                            : "font-black text-red-300"
                        }
                      >
                        {remainingSeconds >
                        0
                          ? `${minutes}:${seconds
                              .toString()
                              .padStart(
                                2,
                                "0",
                              )}`
                          : "Code expiré"}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        confirming ||
                        code.length !==
                          6 ||
                        remainingSeconds <=
                          0
                      }
                      className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {confirming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}

                      Confirmer et transférer
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep(
                          "TICKETS",
                        );

                        setCode(
                          "",
                        );

                        setError(
                          "",
                        );

                        setSuccessMessage(
                          "",
                        );
                      }}
                      className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-neutral-400 transition hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Modifier la sélection
                    </button>
                  </form>
                </div>
              )}

              {step ===
                "SUCCESS" && (
                <div className="mx-auto max-w-2xl text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/[0.09] text-emerald-300">
                    <CheckCircle2 className="h-8 w-8" />
                  </span>

                  <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-white">
                    Transfert terminé
                  </h2>

                  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500">
                    Les billets sont maintenant disponibles dans le compte du destinataire.
                  </p>

                  {completedTransfer && (
                    <div className="mt-7 rounded-[20px] border border-white/[0.08] bg-[#03090d] p-5 text-left">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                            Destinataire
                          </p>

                          <p className="mt-1 font-black text-white">
                            {
                              completedTransfer.recipient.fullName
                            }
                          </p>

                          <p className="mt-1 text-xs text-neutral-600">
                            {
                              completedTransfer.recipient.maskedEmail
                            }
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                            Billets
                          </p>

                          <p className="mt-1 font-black text-white">
                            {
                              completedTransfer.ticketsCount
                            }{" "}
                            transféré
                            {completedTransfer.ticketsCount >
                            1
                              ? "s"
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-white/[0.07] pt-4">
                        <p className="text-sm font-black text-white">
                          {
                            completedTransfer.event.title
                          }
                        </p>

                        <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                          <CalendarDays className="h-4 w-4 text-lime-400" />
                          {formatDate(
                            completedTransfer.event.startsAt,
                          )}
                        </p>

                        <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                          <Clock3 className="h-4 w-4 text-lime-400" />
                          {formatTime(
                            completedTransfer.event.startsAt,
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/account/tickets"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.07] px-5 text-sm font-black text-lime-300 transition hover:bg-lime-400/[0.12]"
                    >
                      <Ticket className="h-4 w-4" />
                      Mes billets
                    </Link>

                    <button
                      type="button"
                      onClick={
                        resetFlow
                      }
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Nouveau transfert
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}