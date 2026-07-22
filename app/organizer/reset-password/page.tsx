"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  useRef,
  useState,
} from "react";

const CODE_LENGTH = 6;

type ResetPasswordResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  const visiblePart =
    name.length <= 2
      ? `${name.charAt(0)}*`
      : `${name.slice(0, 2)}${"*".repeat(Math.min(name.length - 2, 5))}`;

  return `${visiblePart}@${domain}`;
}

export default function OrganizerResetPasswordPage() {
  const router = useRouter();
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(
    Array(CODE_LENGTH).fill(""),
  );

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const code = digits.join("");

  const passwordRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };

  const passwordIsValid = Object.values(passwordRules).every(Boolean);
  const passwordsMatch =
    password.length > 0 && password === passwordConfirmation;

  const formIsValid =
    code.length === CODE_LENGTH &&
    passwordIsValid &&
    passwordsMatch &&
    Boolean(email);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem(
      "tikemia_password_reset_email",
    );

    const emailFromUrl = new URLSearchParams(
      window.location.search,
    ).get("email");

    const resolvedEmail = storedEmail || emailFromUrl || "";

    if (!resolvedEmail) {
      router.replace("/organizer/forgot-password");
      return;
    }

    setEmail(resolvedEmail.trim().toLowerCase());

    window.setTimeout(() => {
      codeInputRefs.current[0]?.focus();
    }, 100);
  }, [router]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  function focusCodeInput(index: number) {
    codeInputRefs.current[index]?.focus();
  }

  function handleCodeChange(index: number, value: string) {
    clearMessages();

    const sanitizedValue = value.replace(/\D/g, "").slice(-1);

    setDigits((currentDigits) => {
      const nextDigits = [...currentDigits];
      nextDigits[index] = sanitizedValue;
      return nextDigits;
    });

    if (sanitizedValue && index < CODE_LENGTH - 1) {
      focusCodeInput(index + 1);
    }
  }

  function handleCodeKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        setDigits((currentDigits) => {
          const nextDigits = [...currentDigits];
          nextDigits[index] = "";
          return nextDigits;
        });

        return;
      }

      if (index > 0) {
        focusCodeInput(index - 1);

        setDigits((currentDigits) => {
          const nextDigits = [...currentDigits];
          nextDigits[index - 1] = "";
          return nextDigits;
        });
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusCodeInput(index - 1);
    }

    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusCodeInput(index + 1);
    }
  }

  function handleCodePaste(event: ClipboardEvent<HTMLInputElement>) {
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

    focusCodeInput(Math.min(pastedCode.length, CODE_LENGTH - 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!email) {
      setError("Votre adresse e-mail est introuvable.");
      return;
    }

    if (code.length !== CODE_LENGTH) {
      setError("Saisissez les 6 chiffres du code reçu.");
      return;
    }

    if (!passwordIsValid) {
      setError("Votre nouveau mot de passe ne respecte pas les critères.");
      return;
    }

    if (!passwordsMatch) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/organizer/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            code,
            password,
            passwordConfirmation,
          }),
        },
      );

      const result = (await response.json()) as ResetPasswordResponse;

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Impossible de modifier votre mot de passe.",
        );
      }

      sessionStorage.removeItem("tikemia_password_reset_email");

      setSuccessMessage(
        result.message ??
          "Votre mot de passe a été modifié avec succès.",
      );

      window.setTimeout(() => {
        router.replace(result.redirectTo ?? "/organizer/login");
        router.refresh();
      }, 1800);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de modifier votre mot de passe.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030709] text-white">
      {/* Décoration de fond */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-52 top-[22%] h-[560px] w-[560px] rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute -right-52 top-[-130px] h-[660px] w-[660px] rounded-full bg-green-500/10 blur-[180px]" />
        <div className="absolute bottom-[-280px] right-[18%] h-[560px] w-[680px] rounded-full bg-orange-500/10 blur-[180px]" />

        <span className="absolute left-[11%] top-[24%] h-2.5 w-2.5 rounded-full bg-lime-400/70" />
        <span className="absolute left-[45%] top-[14%] h-2 w-2 rounded-full bg-orange-500/80" />
        <span className="absolute right-[12%] top-[27%] h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="absolute bottom-[16%] left-[37%] h-3 w-3 rounded-full bg-emerald-500/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="border-b border-white/[0.07] bg-[#030709]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[82px] w-full max-w-[1560px] items-center justify-between px-5 sm:px-8 lg:h-[94px] lg:px-12 xl:px-16">
            <Link
              href="/organizer"
              aria-label="Accueil Tikemia organisateur"
              className="flex items-center"
            >
              <Image
                src="/logo.png"
                alt="Tikemia"
                width={250}
                height={76}
                priority
                className="h-auto w-[175px] object-contain sm:w-[210px]"
              />
            </Link>

            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <ShieldCheck className="h-5 w-5 text-lime-400" />
              <span className="hidden sm:inline">
                Réinitialisation sécurisée
              </span>
            </div>
          </div>
        </header>

        {/* Contenu */}
        <section className="flex flex-1">
          <div className="mx-auto grid w-full max-w-[1560px] flex-1 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Partie visuelle PC */}
            <div className="relative hidden min-h-[760px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between">
              <div className="relative z-10 px-12 pt-14 xl:px-16">
                <Link
                  href="/organizer/login"
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>

                <div className="mt-16 max-w-[550px]">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-lime-400">
                    Sécurité du compte
                  </p>

                  <h1 className="mt-5 text-[54px] font-black leading-[1.02] tracking-[-0.05em] xl:text-[66px]">
                    Protégez votre
                    <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                      espace organisateur.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-[500px] text-base leading-7 text-neutral-300 xl:text-lg">
                    Utilisez le code reçu par e-mail et choisissez un nouveau
                    mot de passe sécurisé.
                  </p>

                  <div className="mt-9 space-y-4">
                    {[
                      "Code personnel à 6 chiffres",
                      "Nouveau mot de passe sécurisé",
                      "Déconnexion des anciennes sessions",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 text-sm text-neutral-200"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                          <Check className="h-4 w-4 text-lime-400" />
                        </span>

                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-auto flex min-h-[350px] items-end justify-center px-8">
                <div className="absolute bottom-[15%] h-[250px] w-[70%] rounded-full bg-emerald-500/15 blur-[100px]" />

                <Image
                  src="/imagea.png"
                  alt="Plateforme organisateur Tikemia"
                  width={850}
                  height={600}
                  priority
                  className="relative z-10 h-auto w-full max-w-[750px] object-contain drop-shadow-[0_30px_55px_rgba(0,0,0,0.65)]"
                />
              </div>
            </div>

            {/* Formulaire */}
            <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10 xl:px-16">
              <div className="w-full max-w-[620px]">
                <Link
                  href="/organizer/login"
                  className="mb-7 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>

                <div className="rounded-[28px] border border-white/[0.09] bg-[#081015]/95 p-6 shadow-[0_35px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-9 xl:p-10">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                    <KeyRound className="h-8 w-8 text-lime-400" />
                  </div>

                  <div className="mt-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
                      Nouveau mot de passe
                    </p>

                    <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-[38px]">
                      Sécurisez votre compte
                    </h2>

                    <p className="mx-auto mt-4 max-w-[440px] text-sm leading-6 text-neutral-400">
                      Entrez le code envoyé à{" "}
                      <span className="font-semibold text-neutral-200">
                        {email ? maskEmail(email) : "votre adresse e-mail"}
                      </span>
                      , puis choisissez votre nouveau mot de passe.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {/* Code */}
                    <div>
                      <label className="mb-3 block text-sm font-semibold text-neutral-200">
                        Code de réinitialisation
                        <span className="ml-1 text-orange-500">*</span>
                      </label>

                      <div className="flex justify-between gap-2 sm:gap-3">
                        {digits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              codeInputRefs.current[index] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            disabled={isSubmitting || Boolean(successMessage)}
                            autoComplete={
                              index === 0 ? "one-time-code" : "off"
                            }
                            aria-label={`Chiffre ${index + 1} du code`}
                            onChange={(event) =>
                              handleCodeChange(index, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleCodeKeyDown(index, event)
                            }
                            onPaste={handleCodePaste}
                            className="h-14 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#050b0f] text-center text-xl font-black text-white outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:text-2xl"
                          />
                        ))}
                      </div>
                    </div>

                    {/* Nouveau mot de passe */}
                    <div>
                      <label
                        htmlFor="new-password"
                        className="mb-2 block text-sm font-semibold text-neutral-200"
                      >
                        Nouveau mot de passe
                        <span className="ml-1 text-orange-500">*</span>
                      </label>

                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                        <input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            clearMessages();
                          }}
                          autoComplete="new-password"
                          placeholder="Créez votre nouveau mot de passe"
                          disabled={isSubmitting || Boolean(successMessage)}
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((current) => !current)
                          }
                          disabled={isSubmitting || Boolean(successMessage)}
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      {password && (
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                          <PasswordRule
                            valid={passwordRules.length}
                            text="8 caractères minimum"
                          />

                          <PasswordRule
                            valid={passwordRules.uppercase}
                            text="Une lettre majuscule"
                          />

                          <PasswordRule
                            valid={passwordRules.lowercase}
                            text="Une lettre minuscule"
                          />

                          <PasswordRule
                            valid={passwordRules.number}
                            text="Un chiffre"
                          />
                        </div>
                      )}
                    </div>

                    {/* Confirmation */}
                    <div>
                      <label
                        htmlFor="password-confirmation"
                        className="mb-2 block text-sm font-semibold text-neutral-200"
                      >
                        Confirmer le mot de passe
                        <span className="ml-1 text-orange-500">*</span>
                      </label>

                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                        <input
                          id="password-confirmation"
                          type={
                            showPasswordConfirmation ? "text" : "password"
                          }
                          value={passwordConfirmation}
                          onChange={(event) => {
                            setPasswordConfirmation(event.target.value);
                            clearMessages();
                          }}
                          autoComplete="new-password"
                          placeholder="Confirmez votre nouveau mot de passe"
                          disabled={isSubmitting || Boolean(successMessage)}
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswordConfirmation(
                              (current) => !current,
                            )
                          }
                          disabled={isSubmitting || Boolean(successMessage)}
                          aria-label={
                            showPasswordConfirmation
                              ? "Masquer la confirmation"
                              : "Afficher la confirmation"
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {showPasswordConfirmation ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      {passwordConfirmation && (
                        <div
                          className={`mt-3 flex items-center gap-2 text-xs ${
                            passwordsMatch
                              ? "text-lime-400"
                              : "text-red-400"
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                              passwordsMatch
                                ? "border-lime-400/50 bg-lime-400/10"
                                : "border-red-400/50 bg-red-400/10"
                            }`}
                          >
                            {passwordsMatch && (
                              <Check className="h-2.5 w-2.5" />
                            )}
                          </span>

                          {passwordsMatch
                            ? "Les mots de passe correspondent"
                            : "Les mots de passe ne correspondent pas"}
                        </div>
                      )}
                    </div>

                    {/* Erreur */}
                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                      >
                        {error}
                      </div>
                    )}

                    {/* Succès */}
                    {successMessage && (
                      <div
                        role="status"
                        className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200"
                      >
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
                        <span>{successMessage}</span>
                      </div>
                    )}

                    {/* Bouton */}
                    <button
                      type="submit"
                      disabled={
                        !formIsValid ||
                        isSubmitting ||
                        Boolean(successMessage)
                      }
                      className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Modification...
                        </>
                      ) : successMessage ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Mot de passe modifié
                        </>
                      ) : (
                        <>
                          Modifier mon mot de passe
                          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                        </>
                      )}
                    </button>

                    <div className="border-t border-white/[0.07] pt-6 text-center">
                      <Link
                        href="/organizer/login"
                        className="text-sm font-bold text-lime-400 transition hover:text-lime-300"
                      >
                        Retour à la connexion
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.07] bg-[#030709]/90">
          <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-5 py-5 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
            <p>
              © {new Date().getFullYear()} Tikemia. Tous droits réservés.
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

type PasswordRuleProps = {
  valid: boolean;
  text: string;
};

function PasswordRule({ valid, text }: PasswordRuleProps) {
  return (
    <div
      className={`flex items-center gap-2 transition ${
        valid ? "text-lime-400" : "text-neutral-500"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          valid
            ? "border-lime-400/50 bg-lime-400/10"
            : "border-white/15"
        }`}
      >
        {valid && <Check className="h-2.5 w-2.5" />}
      </span>

      {text}
    </div>
  );
}