"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Home,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type VerificationState =
  | "VERIFYING"
  | "SUCCESS"
  | "PENDING"
  | "FAILED";

type VerifyPaymentResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  redirectTo?: string | null;

  data?: {
    status?: string;
    paymentStatus?: string;
    orderStatus?: string;

    payment?: {
      id?: string;
      status?: string;
      provider?: string;
      providerTransactionId?: string | null;
      providerReference?: string | null;
    };

    order?: {
      id?: string;
      reference?: string;
      status?: string;
    };

    tickets?: {
      generated?: boolean;
      ready?: boolean;
      count?: number;
      downloadUrl?: string | null;
    };
  };

  payment?: {
    id?: string;
    orderId?: string;
    status?: string;
    provider?: string;
    providerTransactionId?: string | null;
  };

  error?: {
    code?: string;
    message?: string;
    redirectTo?: string | null;
  };
};

type VerifiedPaymentData = {
  paymentId: string;
  orderId: string;
  orderReference: string | null;
  ticketCount: number;
  ticketsReady: boolean;
  downloadUrl: string | null;
  message: string;
};

type StoredPaymentContext = {
  paymentId?: string;
  orderId?: string;
  checkoutToken?: string;
  createdAt?: string;
};

const PAYMENT_STORAGE_PREFIX =
  "tikemia:payment:";

const CURRENT_PAYMENT_STORAGE_KEY =
  "tikemia:payment:current";

function normalizeText(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeStatus(
  value: unknown,
): string {
  return normalizeText(
    value,
  ).toUpperCase();
}

function parseStoredPaymentContext(
  rawValue: string,
): StoredPaymentContext | null {
  try {
    const parsed =
      JSON.parse(
        rawValue,
      ) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const record =
      parsed as Record<
        string,
        unknown
      >;

    return {
      paymentId:
        normalizeText(
          record.paymentId,
        ) || undefined,

      orderId:
        normalizeText(
          record.orderId,
        ) || undefined,

      checkoutToken:
        normalizeText(
          record.checkoutToken,
        ) || undefined,

      createdAt:
        normalizeText(
          record.createdAt,
        ) || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Recherche le contexte de paiement enregistré avant la redirection
 * vers Moneroo.
 *
 * Moneroo peut retourner son propre identifiant `py_...`, alors que
 * Tikemia a enregistré le contexte avec l’identifiant interne Prisma.
 * La recherche utilise donc également orderId.
 */
function readStoredPaymentContext({
  paymentId,
  orderId,
}: {
  paymentId: string;
  orderId: string;
}): StoredPaymentContext | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const directKeys =
    new Set<string>();

  if (paymentId) {
    directKeys.add(
      `${PAYMENT_STORAGE_PREFIX}${paymentId}`,
    );
  }

  directKeys.add(
    CURRENT_PAYMENT_STORAGE_KEY,
  );

  for (
    const key of
    directKeys
  ) {
    const rawValue =
      window.sessionStorage.getItem(
        key,
      );

    if (!rawValue) {
      continue;
    }

    const parsed =
      parseStoredPaymentContext(
        rawValue,
      );

    if (!parsed) {
      window.sessionStorage.removeItem(
        key,
      );

      continue;
    }

    const matchesPayment =
      Boolean(
        paymentId &&
          parsed.paymentId ===
            paymentId,
      );

    const matchesOrder =
      Boolean(
        orderId &&
          parsed.orderId ===
            orderId,
      );

    if (
      matchesPayment ||
      matchesOrder ||
      (
        !paymentId &&
        !orderId
      )
    ) {
      return parsed;
    }
  }

  /*
   * Recherche de secours dans toutes les entrées tikemia:payment:*.
   *
   * Cette partie est nécessaire lorsque l’URL contient l’identifiant
   * Moneroo `py_...`, différent de l’identifiant interne utilisé comme
   * clé dans sessionStorage.
   */
  for (
    let index = 0;
    index <
    window.sessionStorage.length;
    index += 1
  ) {
    const key =
      window.sessionStorage.key(
        index,
      );

    if (
      !key ||
      !key.startsWith(
        PAYMENT_STORAGE_PREFIX,
      )
    ) {
      continue;
    }

    const rawValue =
      window.sessionStorage.getItem(
        key,
      );

    if (!rawValue) {
      continue;
    }

    const parsed =
      parseStoredPaymentContext(
        rawValue,
      );

    if (!parsed) {
      window.sessionStorage.removeItem(
        key,
      );

      continue;
    }

    if (
      (
        paymentId &&
        parsed.paymentId ===
          paymentId
      ) ||
      (
        orderId &&
        parsed.orderId ===
          orderId
      )
    ) {
      return parsed;
    }
  }

  return null;
}

function removeStoredPaymentContext({
  paymentId,
  orderId,
}: {
  paymentId: string;
  orderId: string;
}): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const keysToRemove:
    string[] = [];

  for (
    let index = 0;
    index <
    window.sessionStorage.length;
    index += 1
  ) {
    const key =
      window.sessionStorage.key(
        index,
      );

    if (
      !key ||
      (
        !key.startsWith(
          PAYMENT_STORAGE_PREFIX,
        ) &&
        key !==
          CURRENT_PAYMENT_STORAGE_KEY
      )
    ) {
      continue;
    }

    const rawValue =
      window.sessionStorage.getItem(
        key,
      );

    if (!rawValue) {
      continue;
    }

    const parsed =
      parseStoredPaymentContext(
        rawValue,
      );

    if (
      parsed &&
      (
        (
          paymentId &&
          parsed.paymentId ===
            paymentId
        ) ||
        (
          orderId &&
          parsed.orderId ===
            orderId
        )
      )
    ) {
      keysToRemove.push(
        key,
      );
    }
  }

  for (
    const key of
    keysToRemove
  ) {
    window.sessionStorage.removeItem(
      key,
    );
  }
}

function getResponseMessage(
  response:
    VerifyPaymentResponse,
  fallback: string,
): string {
  return (
    normalizeText(
      response.message,
    ) ||
    normalizeText(
      response.error?.message,
    ) ||
    fallback
  );
}

function resolveVerificationState(
  response:
    VerifyPaymentResponse,
): Exclude<
  VerificationState,
  "VERIFYING"
> {
  const statuses = [
    response.data?.status,
    response.data?.paymentStatus,
    response.data?.payment
      ?.status,
    response.data?.orderStatus,
    response.data?.order
      ?.status,
    response.payment?.status,
  ].map(
    normalizeStatus,
  );

  const successfulStatuses =
    new Set([
      "SUCCESS",
      "SUCCEEDED",
      "SUCCESSFUL",
      "PAID",
      "COMPLETED",
      "CONFIRMED",
      "FULFILLED",
    ]);

  const pendingStatuses =
    new Set([
      "PENDING",
      "PROCESSING",
      "INITIATED",
      "CREATED",
      "REQUIRES_ACTION",
      "AWAITING_PAYMENT",
    ]);

  const failedStatuses =
    new Set([
      "FAILED",
      "FAILURE",
      "CANCELLED",
      "CANCELED",
      "EXPIRED",
      "DECLINED",
      "REFUNDED",
      "DISPUTED",
    ]);

  if (
    statuses.some(
      (status) =>
        successfulStatuses.has(
          status,
        ),
    )
  ) {
    return "SUCCESS";
  }

  if (
    statuses.some(
      (status) =>
        pendingStatuses.has(
          status,
        ),
    )
  ) {
    return "PENDING";
  }

  if (
    statuses.some(
      (status) =>
        failedStatuses.has(
          status,
        ),
    )
  ) {
    return "FAILED";
  }

  /*
   * Une réponse HTTP valide sans statut explicite ne doit pas être
   * considérée automatiquement comme une confirmation définitive.
   */
  if (
    response.success ===
    true
  ) {
    return "PENDING";
  }

  return "FAILED";
}

async function readJsonResponse(
  response: Response,
): Promise<VerifyPaymentResponse> {
  const text =
    await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    ) as VerifyPaymentResponse;
  } catch {
    return {
      success:
        false,

      message:
        "La réponse du serveur n’est pas valide.",
    };
  }
}

function PaymentSuccessContent() {
  const searchParams =
    useSearchParams();

  const paymentId =
    useMemo(
      () =>
        normalizeText(
          searchParams.get(
            "paymentId",
          ) ||
            searchParams.get(
              "payment_id",
            ) ||
            searchParams.get(
              "payment",
            ),
        ),
      [
        searchParams,
      ],
    );

  const orderId =
    useMemo(
      () =>
        normalizeText(
          searchParams.get(
            "orderId",
          ) ||
            searchParams.get(
              "order_id",
            ) ||
            searchParams.get(
              "order",
            ),
        ),
      [
        searchParams,
      ],
    );

  const returnToken =
    useMemo(
      () =>
        normalizeText(
          searchParams.get(
            "returnToken",
          ) ||
            searchParams.get(
              "return_token",
            ),
        ),
      [
        searchParams,
      ],
    );

  const [
    verificationState,
    setVerificationState,
  ] =
    useState<VerificationState>(
      "VERIFYING",
    );

  const [
    verifiedData,
    setVerifiedData,
  ] =
    useState<VerifiedPaymentData | null>(
      null,
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    isRetrying,
    setIsRetrying,
  ] = useState(false);

  const hasStarted =
    useRef(false);

  const requestInProgress =
    useRef(false);

  const verifyPayment =
    useCallback(
      async ({
        manualRetry = false,
      }: {
        manualRetry?: boolean;
      } = {}) => {
        if (
          requestInProgress.current
        ) {
          return;
        }

        if (
          !paymentId ||
          !orderId
        ) {
          setVerificationState(
            "FAILED",
          );

          setErrorMessage(
            "Les informations permettant de vérifier le paiement sont absentes.",
          );

          return;
        }

        requestInProgress.current =
          true;

        if (manualRetry) {
          setIsRetrying(
            true,
          );
        } else {
          setVerificationState(
            "VERIFYING",
          );
        }

        setErrorMessage("");

        try {
          const storedContext =
            readStoredPaymentContext({
              paymentId,
              orderId,
            });

          const checkoutToken =
            normalizeText(
              storedContext
                ?.checkoutToken,
            );

          const response =
            await fetch(
              "/api/client/payments/verify",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Accept:
                    "application/json",
                },

                credentials:
                  "include",

                cache:
                  "no-store",

                body:
                  JSON.stringify({
                    paymentId,
                    orderId,

                    ...(checkoutToken
                      ? {
                          checkoutToken,
                        }
                      : {}),

                    ...(returnToken
                      ? {
                          returnToken,
                        }
                      : {}),
                  }),
              },
            );

          const result =
            await readJsonResponse(
              response,
            );

          const redirectTo =
            normalizeText(
              result.error
                ?.redirectTo,
            ) ||
            normalizeText(
              result.redirectTo,
            );

          if (
            response.status ===
              401 &&
            redirectTo
          ) {
            window.location.assign(
              redirectTo,
            );

            return;
          }

          const nextState =
            resolveVerificationState(
              result,
            );

          if (!response.ok) {
            if (
              nextState ===
              "PENDING"
            ) {
              setVerificationState(
                "PENDING",
              );

              setErrorMessage(
                getResponseMessage(
                  result,
                  "Le paiement est encore en cours de confirmation.",
                ),
              );

              return;
            }

            throw new Error(
              getResponseMessage(
                result,
                response.status ===
                    401 &&
                  !checkoutToken &&
                  !returnToken
                  ? "Le contexte sécurisé de la commande est introuvable. Ne recommencez pas le paiement : contactez le support Tikemia avec votre référence."
                  : "Le paiement n’a pas pu être vérifié.",
              ),
            );
          }

          if (
            nextState ===
            "FAILED"
          ) {
            throw new Error(
              getResponseMessage(
                result,
                "Le paiement n’a pas été confirmé.",
              ),
            );
          }

          const responseOrderId =
            normalizeText(
              result.data?.order
                ?.id,
            ) ||
            normalizeText(
              result.payment
                ?.orderId,
            ) ||
            orderId;

          const responsePaymentId =
            normalizeText(
              result.data?.payment
                ?.id,
            ) ||
            normalizeText(
              result.payment?.id,
            ) ||
            paymentId;

          const ticketCount =
            typeof result.data
              ?.tickets?.count ===
              "number" &&
            Number.isFinite(
              result.data
                .tickets.count,
            )
              ? Math.max(
                  0,
                  Math.trunc(
                    result.data
                      .tickets.count,
                  ),
                )
              : 0;

          const ticketsReady =
            result.data?.tickets
              ?.ready === true ||
            result.data?.tickets
              ?.generated === true;

          setVerifiedData({
            paymentId:
              responsePaymentId,

            orderId:
              responseOrderId,

            orderReference:
              normalizeText(
                result.data?.order
                  ?.reference,
              ) || null,

            ticketCount,

            ticketsReady,

            downloadUrl:
              normalizeText(
                result.data
                  ?.tickets
                  ?.downloadUrl,
              ) || null,

            message:
              getResponseMessage(
                result,
                nextState ===
                  "SUCCESS"
                  ? "Votre paiement a été confirmé avec succès."
                  : "Votre paiement est en cours de confirmation.",
              ),
          });

          setVerificationState(
            nextState,
          );

          if (
            nextState ===
            "SUCCESS"
          ) {
            removeStoredPaymentContext({
              paymentId:
                storedContext
                  ?.paymentId ||
                paymentId,

              orderId:
                responseOrderId,
            });

            /*
             * Le returnToken a rempli son rôle après vérification.
             * On le retire de la barre d'adresse pour éviter qu'il
             * reste inutilement visible dans l'historique du navigateur.
             */
            if (
              returnToken &&
              typeof window !==
                "undefined"
            ) {
              const cleanUrl =
                new URL(
                  window.location.href,
                );

              cleanUrl.searchParams.delete(
                "returnToken",
              );

              cleanUrl.searchParams.delete(
                "return_token",
              );

              window.history.replaceState(
                window.history.state,
                "",
                `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
              );
            }
          }
        } catch (
          error
        ) {
          setVerificationState(
            "FAILED",
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Une erreur est survenue pendant la vérification du paiement.",
          );
        } finally {
          requestInProgress.current =
            false;

          setIsRetrying(
            false,
          );
        }
      },
      [
        orderId,
        paymentId,
        returnToken,
      ],
    );

  useEffect(() => {
    if (
      hasStarted.current
    ) {
      return;
    }

    hasStarted.current =
      true;

    void verifyPayment();
  }, [verifyPayment]);

  if (
    verificationState ===
    "VERIFYING"
  ) {
    return (
      <PaymentResultLayout>
        <ResultCard
          icon={
            <LoaderCircle className="h-8 w-8 animate-spin text-lime-400" />
          }
          iconWrapperClassName="border-lime-500/25 bg-lime-500/10"
          title="Vérification du paiement"
          description="Tikemia vérifie la transaction directement auprès de Moneroo. Ne fermez pas cette page."
        >
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />

            <p className="text-sm leading-6 text-neutral-400">
              La commande sera confirmée uniquement après validation sécurisée du paiement.
            </p>
          </div>
        </ResultCard>
      </PaymentResultLayout>
    );
  }

  if (
    verificationState ===
    "SUCCESS"
  ) {
    return (
      <PaymentResultLayout>
        <ResultCard
          icon={
            <CheckCircle2 className="h-8 w-8 text-lime-400" />
          }
          iconWrapperClassName="border-emerald-500/30 bg-emerald-500/10"
          title="Paiement confirmé"
          description={
            verifiedData
              ?.message ||
            "Votre paiement a été confirmé avec succès."
          }
        >
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InformationCard
              label="Commande"
              value={
                verifiedData
                  ?.orderReference ||
                verifiedData
                  ?.orderId ||
                orderId
              }
            />

            <InformationCard
              label="Identifiant du paiement"
              value={
                verifiedData
                  ?.paymentId ||
                paymentId
              }
            />
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <TicketCheck className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />

            <div>
              <p className="text-sm font-bold text-white">
                Billets sécurisés
              </p>

              <p className="mt-1 text-sm leading-6 text-neutral-400">
                {verifiedData
                  ?.ticketCount
                  ? `${verifiedData.ticketCount} billet${verifiedData.ticketCount > 1 ? "s ont" : " a"} été généré${verifiedData.ticketCount > 1 ? "s" : ""}.`
                  : verifiedData
                        ?.ticketsReady
                    ? "Vos billets ont été générés et sont disponibles."
                    : "Votre paiement est confirmé. Les billets sont en cours de préparation."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/account/tickets"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.18)] transition hover:scale-[1.01]"
            >
              <TicketCheck className="h-4 w-4" />
              Voir mes billets
              <ArrowRight className="h-4 w-4" />
            </Link>

            {verifiedData
              ?.downloadUrl ? (
              <a
                href={
                  verifiedData.downloadUrl
                }
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.07] hover:text-white"
              >
                <Download className="h-4 w-4" />
                Télécharger les billets
              </a>
            ) : (
              <Link
                href={`/api/client/orders/${encodeURIComponent(
                  verifiedData
                    ?.orderId ||
                    orderId,
                )}/tickets/download`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.07] hover:text-white"
              >
                <Download className="h-4 w-4" />
                Télécharger les billets
              </Link>
            )}
          </div>
        </ResultCard>
      </PaymentResultLayout>
    );
  }

  if (
    verificationState ===
    "PENDING"
  ) {
    return (
      <PaymentResultLayout>
        <ResultCard
          icon={
            <Clock3 className="h-8 w-8 text-orange-400" />
          }
          iconWrapperClassName="border-orange-500/30 bg-orange-500/10"
          title="Paiement en confirmation"
          description={
            errorMessage ||
            verifiedData
              ?.message ||
            "Moneroo traite encore votre paiement."
          }
        >
          <div className="mt-6 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-4 py-4">
            <p className="text-sm leading-6 text-neutral-300">
              Votre argent peut déjà avoir été débité. Ne recommencez pas immédiatement un autre paiement. Vérifiez de nouveau le statut.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={
                isRetrying
              }
              onClick={() =>
                void verifyPayment({
                  manualRetry:
                    true,
                })
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRetrying ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}

              Vérifier de nouveau
            </button>

            <Link
              href="/account/orders"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.07]"
            >
              Voir mes commandes
            </Link>
          </div>
        </ResultCard>
      </PaymentResultLayout>
    );
  }

  return (
    <PaymentResultLayout>
      <ResultCard
        icon={
          <AlertCircle className="h-8 w-8 text-red-400" />
        }
        iconWrapperClassName="border-red-500/30 bg-red-500/10"
        title="Vérification impossible"
        description={
          errorMessage ||
          "Tikemia n’a pas pu confirmer le paiement."
        }
      >
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-4">
          <p className="text-sm leading-6 text-neutral-300">
            Si votre compte a été débité, ne payez pas une deuxième fois. Réessayez la vérification ou contactez le support Tikemia avec votre référence de commande.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={
              isRetrying
            }
            onClick={() =>
              void verifyPayment({
                manualRetry:
                  true,
              })
            }
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetrying ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}

            Réessayer
          </button>

          <Link
            href="/account/orders"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.07]"
          >
            Voir mes commandes
          </Link>
        </div>
      </ResultCard>
    </PaymentResultLayout>
  );
}

function PaymentSuccessFallback() {
  return (
    <PaymentResultLayout>
      <ResultCard
        icon={
          <LoaderCircle className="h-8 w-8 animate-spin text-lime-400" />
        }
        iconWrapperClassName="border-lime-500/25 bg-lime-500/10"
        title="Chargement sécurisé"
        description="Préparation de la vérification de votre paiement."
      />
    </PaymentResultLayout>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <PaymentSuccessFallback />
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}

function PaymentResultLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#02070a] px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-120px] top-[-100px] h-[360px] w-[360px] rounded-full bg-emerald-500/[0.08] blur-[110px]" />

        <div className="absolute bottom-[-160px] right-[-100px] h-[420px] w-[420px] rounded-full bg-orange-500/[0.07] blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-400 transition hover:text-white"
          >
            <Home className="h-4 w-4" />
            Tikemia
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[11px] font-bold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Paiement sécurisé
          </div>
        </header>

        {children}

        <footer className="mt-5 text-center text-[11px] leading-5 text-neutral-600">
          Tikemia vérifie toujours les paiements directement auprès du processeur avant de confirmer une commande.
        </footer>
      </div>
    </main>
  );
}

function ResultCard({
  icon,
  iconWrapperClassName,
  title,
  description,
  children,
}: {
  icon:
    ReactNode;
  iconWrapperClassName:
    string;
  title:
    string;
  description:
    string;
  children?:
    ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.09] bg-[#081015] shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
      <div className="border-b border-white/[0.07] bg-gradient-to-br from-white/[0.035] to-transparent px-5 py-8 text-center sm:px-8 sm:py-10">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${iconWrapperClassName}`}
        >
          {icon}
        </div>

        <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
          {title}
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-400">
          {description}
        </p>
      </div>

      {children ? (
        <div className="p-5 sm:p-8">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function InformationCard({
  label,
  value,
}: {
  label:
    string;
  value:
    string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-600">
        {label}
      </p>

      <p className="mt-2 break-all text-sm font-bold text-neutral-200">
        {value}
      </p>
    </div>
  );
}