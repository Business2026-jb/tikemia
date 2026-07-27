"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const CODE_LENGTH = 6;

type ResetPasswordResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

function normalizeEmail(
  value: string | null | undefined,
): string {
  return value?.trim().toLowerCase() ?? "";
}

function maskEmail(
  email: string,
): string {
  const [localPart, domain] =
    email.split("@");

  if (!localPart || !domain) {
    return email;
  }

  const visibleLength =
    localPart.length <= 2 ? 1 : 2;

  const visiblePart =
    localPart.slice(
      0,
      visibleLength,
    );

  const hiddenPart =
    "*".repeat(
      Math.max(
        localPart.length -
          visibleLength,
        3,
      ),
    );

  return `${visiblePart}${hiddenPart}@${domain}`;
}

export default function ClientResetPasswordPage() {
  const router =
    useRouter();

  const inputRefs =
    useRef<
      Array<HTMLInputElement | null>
    >([]);

  const [email, setEmail] =
    useState("");

  const [code, setCode] =
    useState<string[]>(
      Array(CODE_LENGTH).fill(""),
    );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
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

  const verificationCode =
    useMemo(
      () => code.join(""),
      [code],
    );

  const emailIsAvailable =
    email.length > 0;

  const codeIsComplete =
    /^\d{6}$/.test(
      verificationCode,
    );

  const passwordRules = {
    length:
      password.length >= 8,

    uppercase:
      /[A-Z]/.test(password),

    lowercase:
      /[a-z]/.test(password),

    number:
      /\d/.test(password),
  };

  const passwordIsValid =
    Object.values(
      passwordRules,
    ).every(Boolean);

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password ===
      confirmPassword;

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const emailFromUrl =
      normalizeEmail(
        params.get("email"),
      );

    const emailFromStorage =
      normalizeEmail(
        sessionStorage.getItem(
          "tikemia_client_password_reset_email",
        ),
      );

    const resolvedEmail =
      emailFromUrl ||
      emailFromStorage;

    setEmail(
      resolvedEmail,
    );

    if (resolvedEmail) {
      sessionStorage.setItem(
        "tikemia_client_password_reset_email",
        resolvedEmail,
      );
    }
  }, []);

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
        .replace(/\D/g, "")
        .slice(-1);

    setCode((current) => {
      const nextCode =
        [...current];

      nextCode[index] =
        digit;

      return nextCode;
    });

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

  function handleCodeKeyDown(
    index: number,
    event:
      KeyboardEvent<HTMLInputElement>,
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

  function handleCodePaste(
    event:
      ClipboardEvent<HTMLInputElement>,
  ) {
    event.preventDefault();

    const pastedCode =
      event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(
          0,
          CODE_LENGTH,
        );

    if (!pastedCode) {
      return;
    }

    const nextCode =
      Array(CODE_LENGTH).fill(
        "",
      );

    for (
      let index = 0;
      index <
      pastedCode.length;
      index += 1
    ) {
      nextCode[index] =
        pastedCode[index];
    }

    setCode(nextCode);
    clearMessages();

    const focusIndex =
      Math.min(
        pastedCode.length,
        CODE_LENGTH - 1,
      );

    inputRefs.current[
      focusIndex
    ]?.focus();
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!emailIsAvailable) {
      setErrorMessage(
        "Adresse e-mail introuvable. Recommencez la demande de réinitialisation.",
      );

      return;
    }

    if (!codeIsComplete) {
      setErrorMessage(
        "Saisissez le code complet à 6 chiffres.",
      );

      return;
    }

    if (!passwordIsValid) {
      setErrorMessage(
        "Le nouveau mot de passe ne respecte pas les critères demandés.",
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Les deux mots de passe ne correspondent pas.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/client/auth/reset-password",
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
                password,
                confirmPassword,
              }),
          },
        );

      const result =
        (await response.json()) as ResetPasswordResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Impossible de modifier votre mot de passe.",
        );
      }

      sessionStorage.removeItem(
        "tikemia_client_password_reset_email",
      );

      setSuccessMessage(
        result.message ??
          "Votre mot de passe a été modifié avec succès.",
      );

      window.setTimeout(
        () => {
          router.replace(
            result.redirectTo ??
              "/login?reset=success",
          );

          router.refresh();
        },
        900,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
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

        <div className="absolute bottom-[-220px] left-[42%] h-[520px] w-[620px] rounded-full bg-orange-500/[0.07] blur-[170px]" />
      </div>

      <section className="relative z-10 flex min-h-screen">
        <div className="mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative hidden min-h-[760px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between">
            <div className="relative z-10 px-10 pb-6 pt-12 xl:px-14 xl:pt-16">
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />

                Retour
              </Link>

              <div className="mt-14 max-w-[560px]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-400">
                  Sécurité du compte
                </p>

                <h1 className="mt-5 text-[50px] font-black leading-[1.02] tracking-[-0.045em] xl:text-[64px]">
                  Créez un nouveau
                  <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                    mot de passe.
                  </span>
                </h1>

                <p className="mt-6 max-w-[520px] text-base leading-7 text-neutral-400 xl:text-lg">
                  Saisissez le code reçu par e-mail et choisissez un nouveau mot de passe sécurisé.
                </p>

                <div className="mt-9 space-y-4">
                  {[
                    "Code de sécurité à 6 chiffres",
                    "Mot de passe renforcé",
                    "Anciennes sessions supprimées",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm font-medium text-neutral-300"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/[0.08]">
                        <Check className="h-3.5 w-3.5 text-lime-400" />
                      </span>

                      <span>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative mt-auto flex min-h-[300px] items-end justify-center px-8 pb-12">
              <div className="absolute bottom-[12%] h-[220px] w-[70%] rounded-full bg-emerald-500/[0.13] blur-[95px]" />

              <div className="relative z-10 w-full max-w-[650px] rounded-[30px] border border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.07] bg-[#081015]/80 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                      <KeyRound className="h-5 w-5" />
                    </span>

                    <p className="mt-4 text-lg font-black text-white">
                      Code unique
                    </p>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Le code reçu est valable pendant une durée limitée.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#081015]/80 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
                      <ShieldCheck className="h-5 w-5" />
                    </span>

                    <p className="mt-4 text-lg font-black text-white">
                      Compte protégé
                    </p>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Votre nouveau mot de passe sera stocké de façon sécurisée.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
            <div className="w-full max-w-[640px]">
              <Link
                href="/forgot-password"
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />

                Retour
              </Link>

              <div className="rounded-[26px] border border-white/[0.09] bg-[#081015]/95 p-5 shadow-[0_35px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8 xl:p-10">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                  <LockKeyhole className="h-7 w-7" />
                </span>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-lime-400">
                  Nouveau mot de passe
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-[38px]">
                  Sécurisez votre compte
                </h2>

                <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                  Saisissez le code envoyé à{" "}
                  <span className="font-bold text-white">
                    {emailIsAvailable
                      ? maskEmail(email)
                      : "votre adresse e-mail"}
                  </span>
                  .
                </p>

                {!emailIsAvailable && (
                  <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm leading-6 text-amber-300">
                    Adresse e-mail introuvable. Recommencez la demande de réinitialisation.
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="mt-8 space-y-5"
                  noValidate
                >
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-neutral-200">
                      Code de vérification

                      <span className="ml-1 text-orange-500">
                        *
                      </span>
                    </label>

                    <div
                      className="grid grid-cols-6 gap-2 sm:gap-3"
                      aria-label="Code de réinitialisation à 6 chiffres"
                    >
                      {code.map(
                        (
                          digit,
                          index,
                        ) => (
                          <input
                            key={index}
                            ref={(element) => {
                              inputRefs.current[
                                index
                              ] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete={
                              index === 0
                                ? "one-time-code"
                                : "off"
                            }
                            value={digit}
                            onChange={(event) =>
                              updateCodeDigit(
                                index,
                                event.target.value,
                              )
                            }
                            onKeyDown={(event) =>
                              handleCodeKeyDown(
                                index,
                                event,
                              )
                            }
                            onPaste={
                              handleCodePaste
                            }
                            maxLength={1}
                            disabled={
                              isSubmitting
                            }
                            aria-label={`Chiffre ${
                              index + 1
                            } du code`}
                            className="h-14 min-w-0 rounded-xl border border-white/10 bg-[#050b0f] text-center text-xl font-black text-white outline-none transition focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:text-2xl"
                          />
                        ),
                      )}
                    </div>
                  </div>

                  <PasswordField
                    id="client-new-password"
                    label="Nouveau mot de passe"
                    value={password}
                    showPassword={
                      showPassword
                    }
                    disabled={
                      isSubmitting
                    }
                    placeholder="Créez un nouveau mot de passe"
                    onChange={(value) => {
                      setPassword(value);
                      clearMessages();
                    }}
                    onToggle={() =>
                      setShowPassword(
                        (current) =>
                          !current,
                      )
                    }
                  />

                  {password && (
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <PasswordRule
                        valid={
                          passwordRules.length
                        }
                        text="8 caractères minimum"
                      />

                      <PasswordRule
                        valid={
                          passwordRules.uppercase
                        }
                        text="Une lettre majuscule"
                      />

                      <PasswordRule
                        valid={
                          passwordRules.lowercase
                        }
                        text="Une lettre minuscule"
                      />

                      <PasswordRule
                        valid={
                          passwordRules.number
                        }
                        text="Un chiffre"
                      />
                    </div>
                  )}

                  <PasswordField
                    id="client-confirm-password"
                    label="Confirmer le mot de passe"
                    value={
                      confirmPassword
                    }
                    showPassword={
                      showConfirmPassword
                    }
                    disabled={
                      isSubmitting
                    }
                    placeholder="Confirmez le nouveau mot de passe"
                    onChange={(value) => {
                      setConfirmPassword(
                        value,
                      );

                      clearMessages();
                    }}
                    onToggle={() =>
                      setShowConfirmPassword(
                        (current) =>
                          !current,
                      )
                    }
                  />

                  {confirmPassword && (
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold ${
                        passwordsMatch
                          ? "text-lime-400"
                          : "text-red-300"
                      }`}
                    >
                      {passwordsMatch ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}

                      {passwordsMatch
                        ? "Les mots de passe correspondent."
                        : "Les mots de passe ne correspondent pas."}
                    </div>
                  )}

                  {errorMessage && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
                    >
                      {errorMessage}
                    </div>
                  )}

                  {successMessage && (
                    <div
                      role="status"
                      className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-6 text-emerald-300"
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
                      isSubmitting ||
                      !emailIsAvailable
                    }
                    className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="h-5 w-5 animate-spin" />

                        Modification...
                      </>
                    ) : (
                      <>
                        Modifier mon mot de passe

                        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <div className="border-t border-white/[0.07] pt-5 text-center">
                    <p className="text-sm text-neutral-500">
                      Vous n’avez pas reçu le code ?{" "}
                      <Link
                        href="/forgot-password"
                        className="font-black text-lime-400 transition hover:text-lime-300"
                      >
                        Demander un nouveau code
                      </Link>
                    </p>

                    <p className="mt-3 text-sm text-neutral-600">
                      Retourner à la{" "}
                      <Link
                        href="/login"
                        className="font-black text-white transition hover:text-lime-300"
                      >
                        connexion
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  showPassword: boolean;
  disabled: boolean;
  placeholder: string;
  onChange: (
    value: string,
  ) => void;
  onToggle: () => void;
};

function PasswordField({
  id,
  label,
  value,
  showPassword,
  disabled,
  placeholder,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-neutral-200"
      >
        {label}

        <span className="ml-1 text-orange-500">
          *
        </span>
      </label>

      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />

        <input
          id={id}
          type={
            showPassword
              ? "text"
              : "password"
          }
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          autoComplete="new-password"
          placeholder={placeholder}
          disabled={disabled}
          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed"
          aria-label={
            showPassword
              ? "Masquer le mot de passe"
              : "Afficher le mot de passe"
          }
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

type PasswordRuleProps = {
  valid: boolean;
  text: string;
};

function PasswordRule({
  valid,
  text,
}: PasswordRuleProps) {
  return (
    <div
      className={`flex items-center gap-2 transition ${
        valid
          ? "text-lime-400"
          : "text-neutral-600"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          valid
            ? "border-lime-400/50 bg-lime-400/[0.08]"
            : "border-white/[0.12]"
        }`}
      >
        {valid && (
          <Check className="h-2.5 w-2.5" />
        )}
      </span>

      <span>
        {text}
      </span>
    </div>
  );
}