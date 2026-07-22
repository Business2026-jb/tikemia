"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

const CODE_LENGTH = 6;
const RESEND_DELAY_SECONDS = 60;

type ApiResponse = {
  success?: boolean;
  message?: string;
};

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  const visibleName =
    name.length <= 2
      ? `${name.charAt(0)}*`
      : `${name.slice(0, 2)}${"*".repeat(Math.min(name.length - 2, 5))}`;

  return `${visibleName}@${domain}`;
}

export default function OrganizerVerifyEmailPage() {
  const router = useRouter();

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(
    Array(CODE_LENGTH).fill(""),
  );

  const [secondsRemaining, setSecondsRemaining] = useState(
    RESEND_DELAY_SECONDS,
  );

  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const code = digits.join("");
  const isCodeComplete = code.length === CODE_LENGTH;
  const canResend = secondsRemaining === 0 && !isResending;

  useEffect(() => {
    const storedEmail = sessionStorage.getItem(
      "tikemia_verification_email",
    );

    const emailFromUrl = new URLSearchParams(
      window.location.search,
    ).get("email");

    const resolvedEmail = storedEmail || emailFromUrl || "";

    if (!resolvedEmail) {
      router.replace("/organizer/register");
      return;
    }

    setEmail(resolvedEmail.trim().toLowerCase());
  }, [router]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [secondsRemaining]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  function focusInput(index: number) {
    inputRefs.current[index]?.focus();
  }

  function handleDigitChange(index: number, value: string) {
    clearMessages();

    const sanitizedValue = value.replace(/\D/g, "").slice(-1);

    setDigits((current) => {
      const next = [...current];
      next[index] = sanitizedValue;
      return next;
    });

    if (sanitizedValue && index < CODE_LENGTH - 1) {
      focusInput(index + 1);
    }
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        setDigits((current) => {
          const next = [...current];
          next[index] = "";
          return next;
        });

        return;
      }

      if (index > 0) {
        focusInput(index - 1);

        setDigits((current) => {
          const next = [...current];
          next[index - 1] = "";
          return next;
        });
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    }

    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    clearMessages();

    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);

    if (!pastedCode) {
      return;
    }

    const nextDigits = Array(CODE_LENGTH).fill("");

    pastedCode.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setDigits(nextDigits);

    const nextFocusIndex = Math.min(
      pastedCode.length,
      CODE_LENGTH - 1,
    );

    focusInput(nextFocusIndex);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!email) {
      setError("Votre adresse e-mail est introuvable.");
      return;
    }

    if (!isCodeComplete) {
      setError("Saisissez les 6 chiffres du code reçu.");
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch(
        "/api/organizer/auth/verify-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            code,
          }),
        },
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Le code saisi est incorrect ou a expiré.",
        );
      }

      setSuccessMessage(
        result.message ?? "Votre compte a été confirmé.",
      );

      sessionStorage.removeItem("tikemia_verification_email");

      window.setTimeout(() => {
        router.replace("/organizer/dashboard");
        router.refresh();
      }, 900);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Impossible de confirmer votre compte.",
      );

      setDigits(Array(CODE_LENGTH).fill(""));
      focusInput(0);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendCode() {
    if (!canResend || !email) {
      return;
    }

    clearMessages();
    setIsResending(true);

    try {
      const response = await fetch(
        "/api/organizer/auth/resend-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        },
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Le code n’a pas pu être renvoyé.",
        );
      }

      setDigits(Array(CODE_LENGTH).fill(""));
      setSecondsRemaining(RESEND_DELAY_SECONDS);

      setSuccessMessage(
        result.message ??
          "Un nouveau code vous a été envoyé.",
      );

      focusInput(0);
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Le code n’a pas pu être renvoyé.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030709] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-[25%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[150px]" />

        <div className="absolute -right-44 top-[-100px] h-[600px] w-[600px] rounded-full bg-green-500/10 blur-[170px]" />

        <div className="absolute bottom-[-230px] left-[35%] h-[500px] w-[600px] rounded-full bg-orange-500/10 blur-[170px]" />

        <span className="absolute left-[12%] top-[24%] h-2.5 w-2.5 rounded-full bg-lime-400/70" />
        <span className="absolute right-[17%] top-[20%] h-2 w-2 rounded-full bg-orange-500/80" />
        <span className="absolute bottom-[18%] right-[8%] h-3 w-3 rounded-full bg-red-500/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/[0.07] bg-[#030709]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[82px] w-full max-w-[1540px] items-center justify-between px-5 sm:px-8 lg:h-[94px] lg:px-12">
            <Link
              href="/organizer"
              aria-label="Accueil Tikemia organisateur"
            >
              <Image
                src="/logo.png"
                alt="Tikemia"
                width={240}
                height={74}
                priority
                className="h-auto w-[175px] object-contain sm:w-[210px]"
              />
            </Link>

            <div className="flex items-center gap-3 text-sm text-neutral-300">
              <ShieldCheck className="h-5 w-5 text-lime-400" />

              <span className="hidden sm:inline">
                Confirmation sécurisée
              </span>
            </div>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[520px]">
            <Link
              href="/organizer/register"
              className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Modifier mes informations
            </Link>

            <div className="rounded-[28px] border border-white/[0.09] bg-[#081015]/95 p-6 shadow-[0_35px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-9">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <MailCheck className="h-8 w-8 text-lime-400" />
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
                  Vérification
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-[38px]">
                  Confirmez votre e-mail
                </h1>

                <p className="mx-auto mt-4 max-w-[400px] text-sm leading-6 text-neutral-400">
                  Saisissez le code à 6 chiffres envoyé à{" "}
                  <span className="font-semibold text-neutral-200">
                    {email ? maskEmail(email) : "votre adresse e-mail"}
                  </span>
                  .
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8">
                <div className="flex justify-center gap-2 sm:gap-3">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      disabled={isVerifying}
                      autoComplete={
                        index === 0 ? "one-time-code" : "off"
                      }
                      aria-label={`Chiffre ${index + 1} du code`}
                      onChange={(event) =>
                        handleDigitChange(index, event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleKeyDown(index, event)
                      }
                      onPaste={handlePaste}
                      className="h-14 w-12 rounded-xl border border-white/10 bg-[#040a0e] text-center text-xl font-black text-white outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:w-14 sm:text-2xl"
                    />
                  ))}
                </div>

                <div className="mt-6 flex min-h-7 items-center justify-center">
                  {secondsRemaining > 0 ? (
                    <p className="text-sm text-neutral-500">
                      Nouveau code disponible dans{" "}
                      <span className="font-semibold text-neutral-300">
                        {secondsRemaining}s
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={!canResend}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-lime-400 transition hover:text-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}

                      {isResending
                        ? "Envoi en cours..."
                        : "Renvoyer le code"}
                    </button>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                  >
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div
                    role="status"
                    className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isCodeComplete || isVerifying}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isVerifying ? (
                    <>
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      <LockKeyhole className="h-5 w-5" />
                      Confirmer mon compte
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7 border-t border-white/[0.07] pt-6 text-center">
                <p className="text-sm text-neutral-500">
                  Adresse incorrecte ?{" "}
                  <Link
                    href="/organizer/register"
                    className="font-semibold text-white transition hover:text-lime-400"
                  >
                    Recommencer l’inscription
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.07] bg-[#030709]/90">
          <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-3 px-5 py-5 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <p>
              © {new Date().getFullYear()} Tikemia. Tous droits
              réservés.
            </p>

            <Link
              href="/support"
              className="transition hover:text-white"
            >
              Assistance
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}