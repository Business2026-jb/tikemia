"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CODE_LENGTH = 6;
const RESEND_DELAY_SECONDS = 60;

type VerifyEmailResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

type ResendCodeResponse = {
  success?: boolean;
  message?: string;
  expiresInMinutes?: number;
};

function normalizeEmail(
  value: string | null | undefined,
): string {
  return value?.trim().toLowerCase() ?? "";
}

function maskEmail(
  email: string,
): string {
  const [
    localPart,
    domain,
  ] = email.split("@");

  if (
    !localPart ||
    !domain
  ) {
    return email;
  }

  const visibleCharacters =
    localPart.length <= 2
      ? 1
      : 2;

  const visibleStart =
    localPart.slice(
      0,
      visibleCharacters,
    );

  const hiddenPart =
    "*".repeat(
      Math.max(
        localPart.length -
          visibleCharacters,
        3,
      ),
    );

  return `${visibleStart}${hiddenPart}@${domain}`;
}

export default function ClientVerifyEmailPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const inputRefs =
    useRef<
      Array<HTMLInputElement | null>
    >([]);

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    code,
    setCode,
  ] =
    useState<string[]>(
      Array(
        CODE_LENGTH,
      ).fill(""),
    );

  const [
    isVerifying,
    setIsVerifying,
  ] =
    useState(false);

  const [
    isResending,
    setIsResending,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    resendCountdown,
    setResendCountdown,
  ] =
    useState(
      RESEND_DELAY_SECONDS,
    );

  const verificationCode =
    useMemo(
      () =>
        code.join(""),
      [code],
    );

  const emailIsAvailable =
    email.length > 0;

  const codeIsComplete =
    verificationCode.length ===
      CODE_LENGTH &&
    /^\d{6}$/.test(
      verificationCode,
    );

  useEffect(() => {
    const emailFromUrl =
      normalizeEmail(
        searchParams.get(
          "email",
        ),
      );

    const emailFromStorage =
      typeof window !==
      "undefined"
        ? normalizeEmail(
            sessionStorage.getItem(
              "tikemia_client_verification_email",
            ),
          )
        : "";

    const resolvedEmail =
      emailFromUrl ||
      emailFromStorage;

    setEmail(
      resolvedEmail,
    );

    if (
      resolvedEmail &&
      typeof window !==
        "undefined"
    ) {
      sessionStorage.setItem(
        "tikemia_client_verification_email",
        resolvedEmail,
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (
      resendCountdown <=
      0
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setResendCountdown(
            (current) =>
              Math.max(
                current - 1,
                0,
              ),
          );
        },
        1000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [resendCountdown]);

  function clearMessages() {
    if (errorMessage) {
      setErrorMessage("");
    }

    if (successMessage) {
      setSuccessMessage("");
    }
  }

  function updateCodeDigit(
    index: number,
    value: string,
  ) {
    const digit =
      value
        .replace(
          /\D/g,
          "",
        )
        .slice(-1);

    setCode(
      (current) => {
        const nextCode =
          [...current];

        nextCode[index] =
          digit;

        return nextCode;
      },
    );

    clearMessages();

    if (
      digit &&
      index <
        CODE_LENGTH - 1
    ) {
      inputRefs.current[
        index + 1
      ]?.focus();
    }
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key ===
        "Backspace" &&
      !code[index] &&
      index > 0
    ) {
      inputRefs.current[
        index - 1
      ]?.focus();
    }

    if (
      event.key ===
        "ArrowLeft" &&
      index > 0
    ) {
      event.preventDefault();

      inputRefs.current[
        index - 1
      ]?.focus();
    }

    if (
      event.key ===
        "ArrowRight" &&
      index <
        CODE_LENGTH - 1
    ) {
      event.preventDefault();

      inputRefs.current[
        index + 1
      ]?.focus();
    }
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
  ) {
    event.preventDefault();

    const pastedCode =
      event.clipboardData
        .getData("text")
        .replace(
          /\D/g,
          "",
        )
        .slice(
          0,
          CODE_LENGTH,
        );

    if (!pastedCode) {
      return;
    }

    const nextCode =
      Array(
        CODE_LENGTH,
      ).fill("");

    for (
      let index = 0;
      index <
      pastedCode.length;
      index += 1
    ) {
      nextCode[index] =
        pastedCode[index];
    }

    setCode(
      nextCode,
    );

    clearMessages();

    const nextFocusIndex =
      Math.min(
        pastedCode.length,
        CODE_LENGTH - 1,
      );

    inputRefs.current[
      nextFocusIndex
    ]?.focus();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isVerifying
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !emailIsAvailable
    ) {
      setErrorMessage(
        "Adresse e-mail introuvable. Recommencez votre inscription.",
      );
      return;
    }

    if (
      !codeIsComplete
    ) {
      setErrorMessage(
        "Saisissez le code complet à 6 chiffres.",
      );
      return;
    }

    setIsVerifying(true);

    try {
      const response =
        await fetch(
          "/api/client/auth/verify-email",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email,
                code:
                  verificationCode,
              }),
          },
        );

      const result =
        (await response.json()) as VerifyEmailResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Le code saisi est invalide.",
        );
      }

      setSuccessMessage(
        result.message ??
          "Votre adresse e-mail a été vérifiée.",
      );

      sessionStorage.removeItem(
        "tikemia_client_verification_email",
      );

      window.setTimeout(
        () => {
          router.replace(
            result.redirectTo ??
              "/account/tickets",
          );

          router.refresh();
        },
        700,
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Impossible de vérifier votre adresse e-mail.",
      );

      setCode(
        Array(
          CODE_LENGTH,
        ).fill(""),
      );

      inputRefs.current[
        0
      ]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendCode() {
    if (
      isResending ||
      resendCountdown > 0
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !emailIsAvailable
    ) {
      setErrorMessage(
        "Adresse e-mail introuvable. Recommencez votre inscription.",
      );
      return;
    }

    setIsResending(true);

    try {
      const response =
        await fetch(
          "/api/client/auth/resend-code",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email,
              }),
          },
        );

      const result =
        (await response.json()) as ResendCodeResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Impossible de renvoyer le code.",
        );
      }

      setCode(
        Array(
          CODE_LENGTH,
        ).fill(""),
      );

      setSuccessMessage(
        result.message ??
          "Un nouveau code vous a été envoyé.",
      );

      setResendCountdown(
        RESEND_DELAY_SECONDS,
      );

      inputRefs.current[
        0
      ]?.focus();
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Impossible de renvoyer le code.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-60 top-1/4 h-[560px] w-[560px] rounded-full bg-emerald-500/[0.08] blur-[150px]" />

        <div className="absolute -right-52 top-[-120px] h-[620px] w-[620px] rounded-full bg-lime-500/[0.07] blur-[170px]" />

        <div className="absolute bottom-[-240px] left-[40%] h-[540px] w-[650px] rounded-full bg-orange-500/[0.07] blur-[180px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/[0.07] bg-[#03070a]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[76px] w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:h-[88px] lg:px-8 xl:px-12">
            <Link
              href="/"
              aria-label="Retour à l’accueil Tikemia"
              className="flex items-center"
            >
              <Image
                src="/logo.png"
                alt="Tikemia"
                width={220}
                height={68}
                priority
                className="h-auto w-[152px] object-contain sm:w-[178px]"
              />
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-sm text-neutral-400 md:flex">
                <ShieldCheck className="h-5 w-5 text-lime-400" />

                <span>
                  Vérification sécurisée
                </span>
              </div>

              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/[0.05] px-4 text-sm font-bold text-white transition hover:border-emerald-400 hover:bg-emerald-500/[0.1] sm:h-11 sm:px-6"
              >
                Connexion
              </Link>
            </div>
          </div>
        </header>

        <section className="flex flex-1 items-center">
          <div className="mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative hidden min-h-[720px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-center">
              <div className="relative z-10 px-10 py-14 xl:px-14">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />

                  Retour à l’inscription
                </Link>

                <div className="mt-14 max-w-[570px]">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-400">
                    Dernière étape
                  </p>

                  <h1 className="mt-5 text-[50px] font-black leading-[1.02] tracking-[-0.045em] xl:text-[64px]">
                    Vérifiez votre
                    <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                      adresse e-mail.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-[520px] text-base leading-7 text-neutral-400 xl:text-lg">
                    Saisissez le code envoyé par Tikemia pour activer votre compte et accéder à vos billets.
                  </p>

                  <div className="mt-10 space-y-4">
                    <VerificationBenefit text="Code sécurisé à 6 chiffres" />

                    <VerificationBenefit text="Activation immédiate du compte" />

                    <VerificationBenefit text="Accès à vos billets et commandes" />
                  </div>
                </div>

                <div className="mt-14 max-w-[570px] rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                    <MailCheck className="h-6 w-6" />
                  </span>

                  <p className="mt-5 text-xl font-black text-white">
                    Consultez votre boîte e-mail
                  </p>

                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    Le code est valable pendant une durée limitée. Vérifiez également votre dossier de courriers indésirables.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
              <div className="w-full max-w-[620px]">
                <Link
                  href="/register"
                  className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />

                  Retour à l’inscription
                </Link>

                <div className="rounded-[26px] border border-white/[0.09] bg-[#081015]/95 p-5 shadow-[0_35px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8 xl:p-10">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                    <MailCheck className="h-7 w-7" />
                  </span>

                  <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-lime-400">
                    Vérification e-mail
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-[38px]">
                    Entrez votre code
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                    Nous avons envoyé un code de vérification à{" "}
                    <span className="font-bold text-white">
                      {emailIsAvailable
                        ? maskEmail(
                            email,
                          )
                        : "votre adresse e-mail"}
                    </span>
                    .
                  </p>

                  {!emailIsAvailable && (
                    <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm leading-6 text-amber-300">
                      Votre adresse e-mail n’a pas été trouvée. Retournez à l’inscription pour recommencer.
                    </div>
                  )}

                  <form
                    onSubmit={handleSubmit}
                    className="mt-8"
                    noValidate
                  >
                    <div
                      className="grid grid-cols-6 gap-2 sm:gap-3"
                      aria-label="Code de vérification à 6 chiffres"
                    >
                      {code.map(
                        (
                          digit,
                          index,
                        ) => (
                          <input
                            key={
                              index
                            }
                            ref={(
                              element,
                            ) => {
                              inputRefs.current[
                                index
                              ] =
                                element;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete={
                              index ===
                              0
                                ? "one-time-code"
                                : "off"
                            }
                            value={
                              digit
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCodeDigit(
                                index,
                                event
                                  .target
                                  .value,
                              )
                            }
                            onKeyDown={(
                              event,
                            ) =>
                              handleKeyDown(
                                index,
                                event,
                              )
                            }
                            onPaste={
                              handlePaste
                            }
                            maxLength={
                              1
                            }
                            disabled={
                              isVerifying
                            }
                            aria-label={`Chiffre ${
                              index +
                              1
                            } du code`}
                            className="h-14 min-w-0 rounded-xl border border-white/10 bg-[#050b0f] text-center text-xl font-black text-white outline-none transition focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:text-2xl"
                          />
                        ),
                      )}
                    </div>

                    {errorMessage && (
                      <div
                        role="alert"
                        className="mt-5 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
                      >
                        {errorMessage}
                      </div>
                    )}

                    {successMessage && (
                      <div
                        role="status"
                        className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-6 text-emerald-300"
                      >
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

                        <span>
                          {successMessage}
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={
                        isVerifying ||
                        !codeIsComplete ||
                        !emailIsAvailable
                      }
                      className="group mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isVerifying ? (
                        <>
                          <LoaderCircle className="h-5 w-5 animate-spin" />

                          Vérification...
                        </>
                      ) : (
                        <>
                          Vérifier mon compte

                          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 border-t border-white/[0.07] pt-6 text-center">
                    <p className="text-sm text-neutral-500">
                      Vous n’avez pas reçu le code ?
                    </p>

                    <button
                      type="button"
                      onClick={
                        handleResendCode
                      }
                      disabled={
                        isResending ||
                        resendCountdown >
                          0 ||
                        !emailIsAvailable
                      }
                      className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-black text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.07] hover:text-lime-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isResending ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />

                          Envoi...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />

                          {resendCountdown >
                          0
                            ? `Renvoyer dans ${resendCountdown} s`
                            : "Renvoyer le code"}
                        </>
                      )}
                    </button>

                    <p className="mt-5 text-sm text-neutral-600">
                      Adresse incorrecte ?{" "}
                      <Link
                        href="/register"
                        className="font-black text-lime-400 transition hover:text-lime-300"
                      >
                        Modifier mes informations
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.07] bg-[#03070a]/90">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-5 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 xl:px-12">
            <p>
              © {new Date().getFullYear()} Tikemia. Tous droits réservés.
            </p>

            <div className="flex items-center gap-5">
              <Link
                href="/support"
                className="transition hover:text-white"
              >
                Assistance
              </Link>

              <Link
                href="/privacy-policy"
                className="transition hover:text-white"
              >
                Confidentialité
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function VerificationBenefit({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm font-medium text-neutral-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/[0.08]">
        <CheckCircle2 className="h-3.5 w-3.5 text-lime-400" />
      </span>

      <span>
        {text}
      </span>
    </div>
  );
}