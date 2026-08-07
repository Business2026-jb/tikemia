"use client";

import Image from "next/image";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  AlertCircle,
  Loader2,
  Mail,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

type ScannerLoginResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;

  error?: {
    code?: string;
    message?: string;
  };
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

export default function ScannerLoginPage() {
  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(
    () => {
      let cancelled =
        false;

      const checkExistingScannerSession =
        async () => {
          try {
            const response =
              await fetch(
                "/api/scanner/auth/session",
                {
                  method:
                    "GET",

                  credentials:
                    "include",

                  cache:
                    "no-store",

                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              );

            if (
              response.ok &&
              !cancelled
            ) {
              window.location.replace(
                "/scanner",
              );

              return;
            }
          } catch {
            // La page reste disponible.
          } finally {
            if (!cancelled) {
              setCheckingSession(
                false,
              );
            }
          }
        };

      void checkExistingScannerSession();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        submitting ||
        checkingSession
      ) {
        return;
      }

      const normalizedEmail =
        normalizeText(
          email,
        ).toLowerCase();

      if (!normalizedEmail) {
        setErrorMessage(
          "Saisissez l’adresse e-mail de votre compte organisateur Tikemia.",
        );

        return;
      }

      setSubmitting(
        true,
      );

      setErrorMessage(
        "",
      );

      try {
        const response =
          await fetch(
            "/api/scanner/auth/login",
            {
              method:
                "POST",

              credentials:
                "include",

              cache:
                "no-store",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body:
                JSON.stringify({
                  email:
                    normalizedEmail,
                }),
            },
          );

        let payload:
          ScannerLoginResponse = {};

        try {
          payload =
            (
              await response.json()
            ) as ScannerLoginResponse;
        } catch {
          payload = {};
        }

        if (!response.ok) {
          throw new Error(
            normalizeText(
              payload.error?.message,
            ) ||
              "Impossible d’accéder au scanner Tikemia.",
          );
        }

        window.location.replace(
          normalizeText(
            payload.redirectTo,
          ) ||
            "/scanner",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible d’accéder au scanner Tikemia.",
        );
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  if (checkingSession) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#03070a] px-4 text-white">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08]">
            <Loader2 className="h-8 w-8 animate-spin text-lime-300" />
          </span>

          <p className="mt-5 text-sm font-black">
            Vérification de votre accès…
          </p>

          <p className="mt-2 text-xs text-neutral-600">
            Tikemia sécurise votre session scanner.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#03070a] px-4 py-8 text-white sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#071015] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="border-b border-white/[0.07] bg-black/20 px-6 py-7 text-center">
          <Image
            src="/logo.png"
            alt="Tikemia"
            width={150}
            height={52}
            priority
            className="mx-auto h-auto w-[150px]"
          />

          <span className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
            <ScanLine className="h-8 w-8" />
          </span>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-lime-400">
            Contrôle d’accès sécurisé
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Accéder au scanner
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-500">
            Saisissez l’adresse e-mail du compte organisateur actuellement connecté à Tikemia.
          </p>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5 p-5 sm:p-6"
        >
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

              <span>
                {errorMessage}
              </span>
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
              E-mail du compte organisateur
            </span>

            <span className="relative block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />

              <input
                type="email"
                value={
                  email
                }
                onChange={(
                  event,
                ) => {
                  setEmail(
                    event.target.value,
                  );

                  setErrorMessage(
                    "",
                  );
                }}
                autoComplete="email"
                inputMode="email"
                required
                disabled={
                  submitting
                }
                placeholder="organisateur@tikemia.com"
                className="h-13 w-full rounded-2xl border border-white/[0.08] bg-[#03090d] pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/40 disabled:opacity-60"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={
              submitting
            }
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}

            {submitting
              ? "Vérification en cours…"
              : "Accéder au scanner"}
          </button>

          <p className="text-center text-[11px] leading-5 text-neutral-700">
            L’accès est accordé uniquement si cette adresse correspond à la session organisateur active sur cet appareil.
          </p>
        </form>
      </section>
    </main>
  );
}
