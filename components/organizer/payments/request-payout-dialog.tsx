"use client";

import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Smartphone,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import BankDestinationForm, {
  type BankDestinationFormErrors,
  type BankDestinationFormValue,
  validateBankDestination,
} from "@/components/organizer/payments/bank-destination-form";
import MobileMoneyDestinationForm, {
  type MobileMoneyDestinationFormErrors,
  type MobileMoneyDestinationFormValue,
  validateMobileMoneyDestination,
} from "@/components/organizer/payments/mobile-money-destination-form";
import PayoutCountrySelector, {
  type PayoutCountryOption,
} from "@/components/organizer/payments/payout-country-selector";
import PayoutDestinationSelector from "@/components/organizer/payments/payout-destination-selector";
import UsdtDestinationForm, {
  type UsdtDestinationFormErrors,
  type UsdtDestinationFormValue,
  validateUsdtDestination,
} from "@/components/organizer/payments/usdt-destination-form";
import type {
  OrganizerPayoutDestinationOption,
  OrganizerPayoutDestinationType,
} from "@/lib/organizer/get-organizer-payout-destinations";
import type {
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type RequestPayoutDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;

  availableBalance: number;
  currency: OrganizerPaymentsData["currency"];

  destinations?:
    readonly OrganizerPayoutDestinationOption[];

  minimumAmount?: number;
  maximumAmount?: number;
  fixedFee?: number;
  percentageFee?: number;

  submitEndpoint?: string;
  destinationsEndpoint?: string;

  processingDelayHours?: number;

  onSuccess?: (result: {
    payoutId?: string;
    reference?: string;
    amount: number;
    fee: number;
    netAmount: number;
  }) => void;
}>;

type DialogStep =
  | "DESTINATION"
  | "AMOUNT"
  | "REVIEW";

type DestinationMode =
  | "SELECT"
  | "CREATE";

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type CreateDestinationResponse = {
  success?: boolean;
  message?: string;
  destination?:
    OrganizerPayoutDestinationOption;
  error?: {
    code?: string;
    message?: string;
  };
};

type CreatePayoutResponse = {
  success?: boolean;
  message?: string;
  payout?: {
    id?: string;
    reference?: string;
    amount?: number;
    fee?: number;
    netAmount?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

const DEFAULT_SUBMIT_ENDPOINT =
  "/api/organizer/payments/payouts/request";

const DEFAULT_DESTINATIONS_ENDPOINT =
  "/api/organizer/payments/destinations";

const EMPTY_MOBILE_MONEY_VALUE:
  MobileMoneyDestinationFormValue = {
    provider: null,
    accountName: "",
    phoneNumber: "",
    confirmationAccepted: false,
  };

const EMPTY_BANK_VALUE:
  BankDestinationFormValue = {
    accountName: "",
    bankName: "",
    bankAccountNumber: "",
    iban: "",
    swiftBic: "",
    bankCode: "",
    branchCode: "",
    bankAddress: "",
    confirmationAccepted: false,
  };

const EMPTY_USDT_VALUE:
  UsdtDestinationFormValue = {
    accountName: "",
    cryptoAddress: "",
    cryptoNetwork: "TRC20",
    confirmationAddress: "",
    confirmationAccepted: false,
  };

const DESTINATION_TYPES: readonly {
  value: OrganizerPayoutDestinationType;
  label: string;
  description: string;
  icon: typeof Smartphone;
}[] = [
  {
    value: "MOBILE_MONEY",
    label: "Mobile Money",
    description:
      "MTN, Moov, Orange Money ou Wave selon le pays.",
    icon: Smartphone,
  },
  {
    value: "BANK_ACCOUNT",
    label: "Virement bancaire",
    description:
      "Compte bancaire, IBAN et SWIFT/BIC.",
    icon: Landmark,
  },
  {
    value: "CRYPTO_USDT_TRC20",
    label: "USDT TRC20",
    description:
      "Portefeuille USDT sur le réseau TRON.",
    icon: Wallet,
  },
];

function safeNumber(
  value:
    | number
    | undefined,
): number {
  return typeof value ===
      "number" &&
    Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(
    safeNumber(value),
  );
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const normalized =
    safeNumber(value);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(normalized);
  } catch {
    return `${formatNumber(
      normalized,
    )} ${currency}`;
  }
}

function parseAmount(
  value: string,
): number {
  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parsed =
    Number(normalized);

  return Number.isFinite(parsed)
    ? Math.max(parsed, 0)
    : 0;
}

function calculateFee({
  amount,
  fixedFee,
  percentageFee,
}: {
  amount: number;
  fixedFee: number;
  percentageFee: number;
}): number {
  return Math.max(
    fixedFee +
      amount *
        (percentageFee / 100),
    0,
  );
}

function getDestinationTitle(
  destination:
    OrganizerPayoutDestinationOption | null,
): string {
  if (!destination) {
    return "Aucune destination";
  }

  if (
    destination.label?.trim()
  ) {
    return destination.label;
  }

  if (
    destination.type ===
    "MOBILE_MONEY"
  ) {
    return "Mobile Money";
  }

  if (
    destination.type ===
    "BANK_ACCOUNT"
  ) {
    return (
      destination.bankName?.trim() ||
      "Compte bancaire"
    );
  }

  return "USDT TRC20";
}

function getDestinationReference(
  destination:
    OrganizerPayoutDestinationOption | null,
): string {
  if (!destination) {
    return "—";
  }

  return (
    destination.destinationReference?.trim() ||
    destination.maskedPhoneNumber?.trim() ||
    destination.maskedIban?.trim() ||
    destination.maskedBankAccountNumber?.trim() ||
    destination.maskedCryptoAddress?.trim() ||
    "Coordonnées masquées"
  );
}

function getDestinationTypeIcon(
  type:
    OrganizerPayoutDestinationType,
) {
  if (
    type === "MOBILE_MONEY"
  ) {
    return Smartphone;
  }

  if (
    type === "BANK_ACCOUNT"
  ) {
    return Landmark;
  }

  return Wallet;
}

function buildStepClasses({
  active,
  completed,
}: {
  active: boolean;
  completed: boolean;
}): string {
  if (active) {
    return "border-emerald-500/30 bg-emerald-500/[0.09] text-emerald-300";
  }

  if (completed) {
    return "border-sky-500/20 bg-sky-500/[0.06] text-sky-300";
  }

  return "border-white/[0.07] bg-white/[0.018] text-neutral-600";
}

export default function RequestPayoutDialog({
  open,
  onClose,
  availableBalance,
  currency,
  destinations,
  minimumAmount = 0,
  maximumAmount,
  fixedFee = 0,
  percentageFee = 0,
  submitEndpoint =
    DEFAULT_SUBMIT_ENDPOINT,
  destinationsEndpoint =
    DEFAULT_DESTINATIONS_ENDPOINT,
  processingDelayHours = 24,
  onSuccess,
}: RequestPayoutDialogProps) {
  const dialogRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const closeTimeoutRef =
    useRef<number | null>(
      null,
    );

  const [
    step,
    setStep,
  ] = useState<DialogStep>(
    "DESTINATION",
  );

  const [
    destinationMode,
    setDestinationMode,
  ] = useState<DestinationMode>(
    "SELECT",
  );

  const [
    selectedDestinationId,
    setSelectedDestinationId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedDestination,
    setSelectedDestination,
  ] = useState<
    OrganizerPayoutDestinationOption | null
  >(null);

  const [
    country,
    setCountry,
  ] = useState<
    PayoutCountryOption | null
  >(null);

  const [
    destinationType,
    setDestinationType,
  ] = useState<
    OrganizerPayoutDestinationType
  >("MOBILE_MONEY");

  const [
    mobileMoneyValue,
    setMobileMoneyValue,
  ] = useState<
    MobileMoneyDestinationFormValue
  >(
    EMPTY_MOBILE_MONEY_VALUE,
  );

  const [
    bankValue,
    setBankValue,
  ] = useState<
    BankDestinationFormValue
  >(
    EMPTY_BANK_VALUE,
  );

  const [
    usdtValue,
    setUsdtValue,
  ] = useState<
    UsdtDestinationFormValue
  >(
    EMPTY_USDT_VALUE,
  );

  const [
    mobileMoneyErrors,
    setMobileMoneyErrors,
  ] = useState<
    MobileMoneyDestinationFormErrors
  >({});

  const [
    bankErrors,
    setBankErrors,
  ] = useState<
    BankDestinationFormErrors
  >({});

  const [
    usdtErrors,
    setUsdtErrors,
  ] = useState<
    UsdtDestinationFormErrors
  >({});

  const [
    countryError,
    setCountryError,
  ] = useState<
    string | null
  >(null);

  const [
    isSavingDestination,
    setIsSavingDestination,
  ] = useState(false);

  const [
    destinationSelectorKey,
    setDestinationSelectorKey,
  ] = useState(0);

  const [
    amountInput,
    setAmountInput,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    confirmationChecked,
    setConfirmationChecked,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const normalizedAvailableBalance =
    safeNumber(
      availableBalance,
    );

  const normalizedMinimumAmount =
    safeNumber(
      minimumAmount,
    );

  const normalizedMaximumAmount =
    maximumAmount === undefined
      ? normalizedAvailableBalance
      : Math.min(
          safeNumber(
            maximumAmount,
          ),
          normalizedAvailableBalance,
        );

  const normalizedFixedFee =
    safeNumber(
      fixedFee,
    );

  const normalizedPercentageFee =
    safeNumber(
      percentageFee,
    );

  const amount =
    parseAmount(
      amountInput,
    );

  const fee =
    calculateFee({
      amount,
      fixedFee:
        normalizedFixedFee,
      percentageFee:
        normalizedPercentageFee,
    });

  const netAmount =
    Math.max(
      amount - fee,
      0,
    );

  const amountError =
    useMemo(() => {
      if (!amountInput.trim()) {
        return "";
      }

      if (amount <= 0) {
        return "Saisissez un montant valide.";
      }

      if (
        normalizedMinimumAmount > 0 &&
        amount <
          normalizedMinimumAmount
      ) {
        return `Le montant minimum est de ${formatMoney(
          normalizedMinimumAmount,
          currency,
        )}.`;
      }

      if (
        normalizedMaximumAmount > 0 &&
        amount >
          normalizedMaximumAmount
      ) {
        return `Le montant ne peut pas dépasser ${formatMoney(
          normalizedMaximumAmount,
          currency,
        )}.`;
      }

      if (
        amount >
        normalizedAvailableBalance
      ) {
        return "Le montant demandé dépasse le solde disponible.";
      }

      if (
        amount > 0 &&
        netAmount <= 0
      ) {
        return "Le montant net doit être supérieur à zéro après déduction des frais.";
      }

      return "";
    }, [
      amount,
      amountInput,
      currency,
      netAmount,
      normalizedAvailableBalance,
      normalizedMaximumAmount,
      normalizedMinimumAmount,
    ]);

  const resetDialog =
    useCallback(() => {
      setStep(
        "DESTINATION",
      );

      setDestinationMode(
        "SELECT",
      );

      setSelectedDestinationId(
        null,
      );

      setSelectedDestination(
        null,
      );

      setCountry(
        null,
      );

      setDestinationType(
        "MOBILE_MONEY",
      );

      setMobileMoneyValue(
        EMPTY_MOBILE_MONEY_VALUE,
      );

      setBankValue(
        EMPTY_BANK_VALUE,
      );

      setUsdtValue(
        EMPTY_USDT_VALUE,
      );

      setMobileMoneyErrors({});
      setBankErrors({});
      setUsdtErrors({});
      setCountryError(null);

      setAmountInput("");
      setNote("");
      setConfirmationChecked(
        false,
      );

      setErrorMessage("");
      setSuccessMessage("");

      setIsSavingDestination(
        false,
      );

      setIsSubmitting(
        false,
      );
    }, []);

  const handleClose =
    useCallback(() => {
      if (
        isSubmitting ||
        isSavingDestination
      ) {
        return;
      }

      if (
        closeTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          closeTimeoutRef.current,
        );

        closeTimeoutRef.current =
          null;
      }

      resetDialog();
      onClose();
    }, [
      isSavingDestination,
      isSubmitting,
      onClose,
      resetDialog,
    ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        !isSubmitting &&
        !isSavingDestination
      ) {
        handleClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const focusTimeout =
      window.setTimeout(
        () => {
          dialogRef.current?.focus();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        focusTimeout,
      );

      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    handleClose,
    isSavingDestination,
    isSubmitting,
    open,
  ]);

  const handleDestinationChange =
    useCallback(
      (
        destination:
          OrganizerPayoutDestinationOption,
      ) => {
        setSelectedDestinationId(
          destination.id,
        );

        setSelectedDestination(
          destination,
        );

        setErrorMessage("");
      },
      [],
    );

  const startCreateDestination =
    useCallback(() => {
      setDestinationMode(
        "CREATE",
      );

      setSelectedDestinationId(
        null,
      );

      setSelectedDestination(
        null,
      );

      setErrorMessage("");
    }, []);

  const returnToDestinationSelection =
    useCallback(() => {
      setDestinationMode(
        "SELECT",
      );

      setCountryError(null);
      setMobileMoneyErrors({});
      setBankErrors({});
      setUsdtErrors({});
      setErrorMessage("");
    }, []);

  const selectCountry =
    useCallback(
      (
        selectedCountry:
          PayoutCountryOption,
      ) => {
        setCountry(
          selectedCountry,
        );

        setCountryError(
          null,
        );

        if (
          destinationType ===
            "MOBILE_MONEY" &&
          !selectedCountry.mobileMoneyAvailable
        ) {
          setDestinationType(
            "BANK_ACCOUNT",
          );
        }

        if (
          destinationType ===
            "BANK_ACCOUNT" &&
          !selectedCountry.bankTransferAvailable
        ) {
          setDestinationType(
            selectedCountry.usdtTrc20Available
              ? "CRYPTO_USDT_TRC20"
              : "MOBILE_MONEY",
          );
        }

        if (
          destinationType ===
            "CRYPTO_USDT_TRC20" &&
          !selectedCountry.usdtTrc20Available
        ) {
          setDestinationType(
            selectedCountry.bankTransferAvailable
              ? "BANK_ACCOUNT"
              : "MOBILE_MONEY",
          );
        }
      },
      [
        destinationType,
      ],
    );

  const destinationTypeAvailable =
    useCallback(
      (
        type:
          OrganizerPayoutDestinationType,
      ): boolean => {
        if (!country) {
          return true;
        }

        if (
          type === "MOBILE_MONEY"
        ) {
          return country.mobileMoneyAvailable;
        }

        if (
          type === "BANK_ACCOUNT"
        ) {
          return country.bankTransferAvailable;
        }

        return country.usdtTrc20Available;
      },
      [
        country,
      ],
    );

  const buildDestinationPayload =
    useCallback(():
      | Record<
          string,
          unknown
        >
      | null => {
      if (!country) {
        setCountryError(
          "Sélectionnez le pays du bénéficiaire.",
        );

        return null;
      }

      if (
        destinationType ===
        "MOBILE_MONEY"
      ) {
        const errors =
          validateMobileMoneyDestination(
            mobileMoneyValue,
          );

        setMobileMoneyErrors(
          errors,
        );

        if (
          Object.keys(
            errors,
          ).length > 0
        ) {
          return null;
        }

        return {
          type:
            "MOBILE_MONEY",
          country:
            country.name,
          countryCode:
            country.code,
          currency:
            country.currency,
          accountName:
            mobileMoneyValue.accountName.trim(),
          mobileProvider:
            mobileMoneyValue.provider,
          phoneCountryCode:
            country.dialCode,
          phoneNumber:
            mobileMoneyValue.phoneNumber,
          isDefault:
            true,
        };
      }

      if (
        destinationType ===
        "BANK_ACCOUNT"
      ) {
        const errors =
          validateBankDestination(
            bankValue,
          );

        setBankErrors(
          errors,
        );

        if (
          Object.keys(
            errors,
          ).length > 0
        ) {
          return null;
        }

        return {
          type:
            "BANK_ACCOUNT",
          country:
            country.name,
          countryCode:
            country.code,
          currency:
            country.currency,
          accountName:
            bankValue.accountName.trim(),
          bankName:
            bankValue.bankName.trim(),
          bankAccountNumber:
            bankValue.bankAccountNumber.trim() ||
            null,
          iban:
            bankValue.iban.trim() ||
            null,
          swiftBic:
            bankValue.swiftBic.trim() ||
            null,
          bankCode:
            bankValue.bankCode.trim() ||
            null,
          branchCode:
            bankValue.branchCode.trim() ||
            null,
          bankAddress:
            bankValue.bankAddress.trim() ||
            null,
          isDefault:
            true,
        };
      }

      const errors =
        validateUsdtDestination(
          usdtValue,
        );

      setUsdtErrors(
        errors,
      );

      if (
        Object.keys(
          errors,
        ).length > 0
      ) {
        return null;
      }

      return {
        type:
          "CRYPTO_USDT_TRC20",
        country:
          country.name,
        countryCode:
          country.code,
        currency:
          country.currency,
        accountName:
          usdtValue.accountName.trim(),
        cryptoNetwork:
          "TRC20",
        cryptoAddress:
          usdtValue.cryptoAddress.trim(),
        isDefault:
          true,
      };
    },
    [
      bankValue,
      country,
      destinationType,
      mobileMoneyValue,
      usdtValue,
    ]);

  const saveDestination =
    useCallback(async () => {
      const payload =
        buildDestinationPayload();

      if (!payload) {
        setErrorMessage(
          "Vérifiez les informations du moyen de retrait.",
        );

        return;
      }

      setIsSavingDestination(
        true,
      );

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const response =
          await fetch(
            destinationsEndpoint,
            {
              method: "POST",
              headers: {
                Accept:
                  "application/json",
                "Content-Type":
                  "application/json",
              },
              cache:
                "no-store",
              body:
                JSON.stringify(
                  payload,
                ),
            },
          );

        let result:
          | CreateDestinationResponse
          | null = null;

        try {
          result =
            (await response.json()) as
              CreateDestinationResponse;
        } catch {
          result = null;
        }

        if (!response.ok) {
          throw new Error(
            result?.error?.message ??
              result?.message ??
              "Impossible d’enregistrer le moyen de retrait.",
          );
        }

        if (
          !result?.destination
        ) {
          throw new Error(
            "Le moyen de retrait a été enregistré, mais sa réponse est incomplète.",
          );
        }

        setSelectedDestinationId(
          result.destination.id,
        );

        setSelectedDestination(
          result.destination,
        );

        setDestinationMode(
          "SELECT",
        );

        setDestinationSelectorKey(
          (
            current,
          ) =>
            current + 1,
        );

        setSuccessMessage(
          result.message ??
            "Le moyen de retrait a été enregistré.",
        );

        setStep(
          "AMOUNT",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible d’enregistrer le moyen de retrait.",
        );
      } finally {
        setIsSavingDestination(
          false,
        );
      }
    }, [
      buildDestinationPayload,
      destinationsEndpoint,
    ]);

  const continueFromDestination =
    useCallback(() => {
      if (
        destinationMode ===
        "CREATE"
      ) {
        void saveDestination();
        return;
      }

      if (
        !selectedDestinationId ||
        !selectedDestination
      ) {
        setErrorMessage(
          "Sélectionnez ou ajoutez un moyen de retrait.",
        );

        return;
      }

      setErrorMessage("");
      setStep(
        "AMOUNT",
      );
    }, [
      destinationMode,
      saveDestination,
      selectedDestination,
      selectedDestinationId,
    ]);

  const continueFromAmount =
    useCallback(() => {
      if (
        !amountInput.trim()
      ) {
        setErrorMessage(
          "Saisissez le montant du retrait.",
        );

        return;
      }

      if (
        amountError
      ) {
        setErrorMessage(
          amountError,
        );

        return;
      }

      setErrorMessage("");
      setStep(
        "REVIEW",
      );
    }, [
      amountError,
      amountInput,
    ]);

  const setMaximumAvailable =
    useCallback(() => {
      const maximum =
        normalizedMaximumAmount > 0
          ? normalizedMaximumAmount
          : normalizedAvailableBalance;

      setAmountInput(
        String(maximum),
      );

      setErrorMessage("");
    }, [
      normalizedAvailableBalance,
      normalizedMaximumAmount,
    ]);

  const submitPayout =
    useCallback(
      async (
        event:
          FormEvent<HTMLFormElement>,
      ) => {
        event.preventDefault();

        if (
          step !==
          "REVIEW"
        ) {
          return;
        }

        setErrorMessage("");
        setSuccessMessage("");

        if (
          !selectedDestinationId ||
          !selectedDestination
        ) {
          setErrorMessage(
            "Aucun moyen de retrait valide n’a été sélectionné.",
          );

          setStep(
            "DESTINATION",
          );

          return;
        }

        if (
          amount <= 0 ||
          amountError
        ) {
          setErrorMessage(
            amountError ||
              "Le montant du retrait est invalide.",
          );

          setStep(
            "AMOUNT",
          );

          return;
        }

        if (
          !confirmationChecked
        ) {
          setErrorMessage(
            "Confirmez les informations avant d’envoyer la demande.",
          );

          return;
        }

        setIsSubmitting(
          true,
        );

        try {
          const response =
            await fetch(
              submitEndpoint,
              {
                method: "POST",
                headers: {
                  Accept:
                    "application/json",
                  "Content-Type":
                    "application/json",
                },
                cache:
                  "no-store",
                body:
                  JSON.stringify({
                    amount,
                    currency,
                    note:
                      note.trim() ||
                      null,
                    destinationId:
                      selectedDestinationId,
                    destinationType:
                      selectedDestination.type,
                  }),
              },
            );

          let result:
            | CreatePayoutResponse
            | ApiErrorResponse
            | null = null;

          try {
            result =
              (await response.json()) as
                | CreatePayoutResponse
                | ApiErrorResponse;
          } catch {
            result = null;
          }

          if (!response.ok) {
            throw new Error(
              result?.error?.message ??
                result?.message ??
                "Impossible d’enregistrer la demande de retrait.",
            );
          }

          const successResult =
            result as
              | CreatePayoutResponse
              | null;

          const returnedPayout =
            successResult?.payout;

          const finalAmount =
            returnedPayout?.amount !==
            undefined
              ? safeNumber(
                  returnedPayout.amount,
                )
              : amount;

          const finalFee =
            returnedPayout?.fee !==
            undefined
              ? safeNumber(
                  returnedPayout.fee,
                )
              : fee;

          const finalNetAmount =
            returnedPayout?.netAmount !==
            undefined
              ? safeNumber(
                  returnedPayout.netAmount,
                )
              : netAmount;

          setSuccessMessage(
            successResult?.message ??
              "Votre demande de retrait a été enregistrée avec succès.",
          );

          onSuccess?.({
            payoutId:
              returnedPayout?.id,
            reference:
              returnedPayout?.reference,
            amount:
              finalAmount,
            fee:
              finalFee,
            netAmount:
              finalNetAmount,
          });

          closeTimeoutRef.current =
            window.setTimeout(
              () => {
                resetDialog();
                onClose();

                closeTimeoutRef.current =
                  null;
              },
              1600,
            );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible d’enregistrer la demande de retrait.",
          );

          setIsSubmitting(
            false,
          );
        }
      },
      [
        amount,
        amountError,
        confirmationChecked,
        currency,
        fee,
        netAmount,
        note,
        onClose,
        onSuccess,
        resetDialog,
        selectedDestination,
        selectedDestinationId,
        step,
        submitEndpoint,
      ],
    );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-payout-title"
        tabIndex={-1}
        className="relative flex max-h-[97vh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl border border-white/[0.09] bg-[#071014] shadow-[0_32px_110px_rgba(0,0,0,0.75)] outline-none sm:max-w-5xl sm:rounded-3xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.05),transparent_30%)]" />

        <header className="relative border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
                <Banknote className="h-5 w-5 text-emerald-300" />
              </div>

              <div className="min-w-0">
                <h2
                  id="request-payout-title"
                  className="text-lg font-black text-white sm:text-xl"
                >
                  Demander un retrait
                </h2>

                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Choisissez la destination, saisissez le montant puis confirmez la demande.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={
                isSubmitting ||
                isSavingDestination
              }
              aria-label="Fermer"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(
              [
                {
                  value:
                    "DESTINATION",
                  label:
                    "1. Destination",
                },
                {
                  value:
                    "AMOUNT",
                  label:
                    "2. Montant",
                },
                {
                  value:
                    "REVIEW",
                  label:
                    "3. Vérification",
                },
              ] as const
            ).map(
              (
                item,
                index,
              ) => {
                const stepIndex =
                  step ===
                  "DESTINATION"
                    ? 0
                    : step ===
                        "AMOUNT"
                      ? 1
                      : 2;

                return (
                  <div
                    key={
                      item.value
                    }
                    className={`rounded-xl border px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.08em] ${buildStepClasses(
                      {
                        active:
                          step ===
                          item.value,
                        completed:
                          stepIndex >
                          index,
                      },
                    )}`}
                  >
                    {item.label}
                  </div>
                );
              },
            )}
          </div>
        </header>

        <form
          onSubmit={
            submitPayout
          }
          className="relative flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {step ===
              "DESTINATION" && (
              <div className="space-y-5">
                {destinationMode ===
                "SELECT" ? (
                  <>
                    <PayoutDestinationSelector
                      key={
                        destinationSelectorKey
                      }
                      value={
                        selectedDestinationId
                      }
                      onChange={
                        handleDestinationChange
                      }
                      destinations={
                        destinations
                      }
                      endpoint={
                        destinationsEndpoint
                      }
                      currency={
                        currency
                      }
                      onAddDestination={
                        startCreateDestination
                      }
                      error={
                        errorMessage &&
                        !selectedDestination
                          ? errorMessage
                          : null
                      }
                    />

                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

                        <div>
                          <p className="text-xs font-black text-white">
                            Une destination vérifiée protège vos retraits
                          </p>

                          <p className="mt-1 text-[10px] leading-5 text-neutral-600">
                            Les coordonnées sensibles sont chiffrées et masquées dans votre espace organisateur.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={
                          returnToDestinationSelection
                        }
                        disabled={
                          isSavingDestination
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Moyens enregistrés
                      </button>

                      <span className="text-[10px] font-bold text-neutral-600">
                        Nouveau moyen de retrait
                      </span>
                    </div>

                    <PayoutCountrySelector
                      value={
                        country?.code ??
                        null
                      }
                      onChange={
                        selectCountry
                      }
                      error={
                        countryError
                      }
                    />

                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400">
                        Type de moyen
                      </p>

                      <div className="grid gap-3 md:grid-cols-3">
                        {DESTINATION_TYPES.map(
                          (
                            item,
                          ) => {
                            const Icon =
                              item.icon;

                            const selected =
                              destinationType ===
                              item.value;

                            const available =
                              destinationTypeAvailable(
                                item.value,
                              );

                            return (
                              <button
                                key={
                                  item.value
                                }
                                type="button"
                                disabled={
                                  !available ||
                                  isSavingDestination
                                }
                                onClick={() => {
                                  setDestinationType(
                                    item.value,
                                  );

                                  setErrorMessage(
                                    "",
                                  );
                                }}
                                className={`flex min-h-[92px] items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                                  selected
                                    ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                                    : available
                                      ? "border-white/[0.08] bg-white/[0.018] hover:border-white/[0.14] hover:bg-white/[0.03]"
                                      : "cursor-not-allowed border-white/[0.05] bg-white/[0.01] opacity-40"
                                }`}
                              >
                                <span
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                    selected
                                      ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
                                      : "border-white/[0.07] bg-white/[0.02] text-neutral-500"
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>

                                <span className="min-w-0">
                                  <span className="block text-xs font-black text-white">
                                    {item.label}
                                  </span>

                                  <span className="mt-1 block text-[10px] leading-4 text-neutral-600">
                                    {item.description}
                                  </span>
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {destinationType ===
                      "MOBILE_MONEY" && (
                      <MobileMoneyDestinationForm
                        country={
                          country
                        }
                        value={
                          mobileMoneyValue
                        }
                        onChange={
                          setMobileMoneyValue
                        }
                        errors={
                          mobileMoneyErrors
                        }
                        disabled={
                          isSavingDestination
                        }
                      />
                    )}

                    {destinationType ===
                      "BANK_ACCOUNT" && (
                      <BankDestinationForm
                        country={
                          country
                        }
                        value={
                          bankValue
                        }
                        onChange={
                          setBankValue
                        }
                        errors={
                          bankErrors
                        }
                        disabled={
                          isSavingDestination
                        }
                      />
                    )}

                    {destinationType ===
                      "CRYPTO_USDT_TRC20" && (
                      <UsdtDestinationForm
                        country={
                          country
                        }
                        value={
                          usdtValue
                        }
                        onChange={
                          setUsdtValue
                        }
                        errors={
                          usdtErrors
                        }
                        disabled={
                          isSavingDestination
                        }
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {step ===
              "AMOUNT" && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400/70">
                          Solde disponible
                        </p>

                        <p className="mt-2 text-2xl font-black text-emerald-300">
                          {formatMoney(
                            normalizedAvailableBalance,
                            currency,
                          )}
                        </p>
                      </div>

                      <WalletCards className="h-6 w-6 text-emerald-300" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <label
                        htmlFor="payout-amount"
                        className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500"
                      >
                        Montant du retrait
                      </label>

                      <button
                        type="button"
                        onClick={
                          setMaximumAvailable
                        }
                        disabled={
                          normalizedAvailableBalance <=
                          0
                        }
                        className="text-[10px] font-bold text-emerald-300 transition hover:text-emerald-200 disabled:text-neutral-700"
                      >
                        Utiliser le maximum
                      </button>
                    </div>

                    <div className="relative mt-2">
                      <CircleDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                      <input
                        id="payout-amount"
                        value={
                          amountInput
                        }
                        onChange={(
                          event,
                        ) => {
                          setAmountInput(
                            event.target.value,
                          );

                          setErrorMessage(
                            "",
                          );
                        }}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        className={`h-14 w-full rounded-xl border bg-[#050c10] pl-10 pr-20 text-lg font-black text-white outline-none transition placeholder:text-neutral-700 ${
                          amountError
                            ? "border-red-500/40 focus:border-red-500/60"
                            : "border-white/[0.09] focus:border-emerald-500/40"
                        }`}
                      />

                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-500">
                        {currency}
                      </span>
                    </div>

                    {amountError ? (
                      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-5 text-red-300">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {amountError}
                      </p>
                    ) : normalizedMinimumAmount >
                      0 ? (
                      <p className="mt-2 text-[10px] text-neutral-600">
                        Montant minimum :{" "}
                        {formatMoney(
                          normalizedMinimumAmount,
                          currency,
                        )}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="payout-note"
                      className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500"
                    >
                      Note facultative
                    </label>

                    <textarea
                      id="payout-note"
                      value={
                        note
                      }
                      onChange={(
                        event,
                      ) =>
                        setNote(
                          event.target.value.slice(
                            0,
                            500,
                          ),
                        )
                      }
                      rows={4}
                      placeholder="Ajoutez une information utile concernant ce retrait…"
                      className="mt-2 w-full resize-none rounded-xl border border-white/[0.09] bg-[#050c10] px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/40"
                    />

                    <p className="mt-1 text-right text-[9px] text-neutral-700">
                      {note.length} / 500
                    </p>
                  </div>
                </div>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#050c10] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                      Destination
                    </p>

                    <p className="mt-2 text-sm font-black text-white">
                      {getDestinationTitle(
                        selectedDestination,
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-neutral-500">
                      {getDestinationReference(
                        selectedDestination,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#050c10] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                      Estimation
                    </p>

                    <div className="mt-3 space-y-3 text-[11px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-600">
                          Frais
                        </span>

                        <strong className="text-orange-300">
                          {formatMoney(
                            fee,
                            currency,
                          )}
                        </strong>
                      </div>

                      <div className="flex justify-between gap-3 border-t border-white/[0.07] pt-3">
                        <span className="font-bold text-neutral-400">
                          Net estimé
                        </span>

                        <strong className="text-emerald-300">
                          {formatMoney(
                            netAmount,
                            currency,
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {step ===
              "REVIEW" && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#050c10] p-5">
                    <div className="flex items-center gap-3">
                      {selectedDestination &&
                        (() => {
                          const Icon =
                            getDestinationTypeIcon(
                              selectedDestination.type,
                            );

                          return (
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300">
                              <Icon className="h-4 w-4" />
                            </span>
                          );
                        })()}

                      <div>
                        <p className="text-xs font-black text-white">
                          {getDestinationTitle(
                            selectedDestination,
                          )}
                        </p>

                        <p className="mt-1 text-[10px] text-neutral-500">
                          {getDestinationReference(
                            selectedDestination,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#050c10] p-5">
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">
                          Montant demandé
                        </span>

                        <strong className="text-white">
                          {formatMoney(
                            amount,
                            currency,
                          )}
                        </strong>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">
                          Frais
                        </span>

                        <strong className="text-orange-300">
                          {formatMoney(
                            fee,
                            currency,
                          )}
                        </strong>
                      </div>

                      <div className="flex justify-between gap-4 border-t border-white/[0.07] pt-4">
                        <span className="font-black text-neutral-300">
                          Net à recevoir
                        </span>

                        <strong className="text-lg font-black text-emerald-300">
                          {formatMoney(
                            netAmount,
                            currency,
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {note.trim() && (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                        Note
                      </p>

                      <p className="mt-2 text-xs leading-5 text-neutral-400">
                        {note.trim()}
                      </p>
                    </div>
                  )}
                </div>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-sky-500/15 bg-sky-500/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

                      <div>
                        <p className="text-xs font-black text-white">
                          Traitement sous {processingDelayHours} h
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-neutral-500">
                          Un e-mail de confirmation sera envoyé après l’enregistrement de la demande.
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4">
                    <input
                      type="checkbox"
                      checked={
                        confirmationChecked
                      }
                      onChange={(
                        event,
                      ) => {
                        setConfirmationChecked(
                          event.target.checked,
                        );

                        setErrorMessage(
                          "",
                        );
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#050c10] accent-emerald-500"
                    />

                    <span className="text-[10px] leading-5 text-neutral-500">
                      Je confirme que le montant, la devise et les coordonnées de destination sont exacts.
                    </span>
                  </label>
                </aside>
              </div>
            )}

            {errorMessage && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.055] p-3.5 text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                <p className="text-[11px] leading-5">
                  {errorMessage}
                </p>
              </div>
            )}

            {successMessage && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.055] p-3.5 text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

                <p className="text-[11px] leading-5">
                  {successMessage}
                </p>
              </div>
            )}
          </div>

          <footer className="relative flex flex-col-reverse gap-3 border-t border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="inline-flex items-center gap-2 text-[9px] text-neutral-600">
              <LockKeyhole className="h-3.5 w-3.5 text-emerald-400" />
              Demande protégée par votre session organisateur.
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              {step !==
                "DESTINATION" && (
                <button
                  type="button"
                  onClick={() =>
                    setStep(
                      step ===
                        "REVIEW"
                        ? "AMOUNT"
                        : "DESTINATION",
                    )
                  }
                  disabled={
                    isSubmitting ||
                    isSavingDestination
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50 sm:flex-none"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
              )}

              {step ===
                "DESTINATION" && (
                <button
                  type="button"
                  onClick={
                    continueFromDestination
                  }
                  disabled={
                    isSavingDestination
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.11] px-5 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/[0.17] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  {isSavingDestination ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : destinationMode ===
                    "CREATE" ? (
                    <>
                      <Plus className="h-4 w-4" />
                      Enregistrer et continuer
                    </>
                  ) : (
                    <>
                      Continuer
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}

              {step ===
                "AMOUNT" && (
                <button
                  type="button"
                  onClick={
                    continueFromAmount
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.11] px-5 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/[0.17] sm:flex-none"
                >
                  Vérifier
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {step ===
                "REVIEW" && (
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !confirmationChecked
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.11] px-5 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/[0.17] disabled:cursor-not-allowed disabled:border-white/[0.07] disabled:bg-white/[0.02] disabled:text-neutral-600 sm:flex-none"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    <>
                      Confirmer le retrait
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}