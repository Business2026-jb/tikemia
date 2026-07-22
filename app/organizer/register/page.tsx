"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Country = {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
};

const countries: Country[] = [
  { name: "Bénin", code: "BJ", dialCode: "+229", flag: "🇧🇯" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Côte d’Ivoire", code: "CI", dialCode: "+225", flag: "🇨🇮" },
  { name: "Cameroun", code: "CM", dialCode: "+237", flag: "🇨🇲" },
  { name: "Gabon", code: "GA", dialCode: "+241", flag: "🇬🇦" },
  { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
  { name: "Togo", code: "TG", dialCode: "+228", flag: "🇹🇬" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Belgique", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Italie", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Niger", code: "NE", dialCode: "+227", flag: "🇳🇪" },
  { name: "Mali", code: "ML", dialCode: "+223", flag: "🇲🇱" },
  { name: "Sénégal", code: "SN", dialCode: "+221", flag: "🇸🇳" },
];

type FormData = {
  firstName: string;
  lastName: string;
  countryCode: string;
  phone: string;
  email: string;
  password: string;
  acceptTerms: boolean;
};

const initialForm: FormData = {
  firstName: "",
  lastName: "",
  countryCode: "BJ",
  phone: "",
  email: "",
  password: "",
  acceptTerms: false,
};

export default function OrganizerRegisterPage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedCountry = useMemo(
    () =>
      countries.find((country) => country.code === form.countryCode) ??
      countries[0],
    [form.countryCode],
  );

  const passwordRules = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /\d/.test(form.password),
  };

  const passwordValid = Object.values(passwordRules).every(Boolean);

  function updateField<K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (error) {
      setError("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Renseignez votre prénom et votre nom.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Renseignez votre numéro de téléphone.");
      return;
    }

    if (!form.email.trim()) {
      setError("Renseignez votre adresse e-mail.");
      return;
    }

    if (!passwordValid) {
      setError("Votre mot de passe ne respecte pas les critères demandés.");
      return;
    }

    if (!form.acceptTerms) {
      setError("Vous devez accepter les conditions d’utilisation.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/organizer/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          country: selectedCountry.name,
          countryCode: selectedCountry.code,
          dialCode: selectedCountry.dialCode,
          phone: form.phone.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.message ?? "Impossible de créer votre compte.",
        );
      }

      sessionStorage.setItem(
        "tikemia_verification_email",
        form.email.trim().toLowerCase(),
      );

      window.location.href = `/organizer/verify-email?email=${encodeURIComponent(
        form.email.trim().toLowerCase(),
      )}`;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Une erreur est survenue. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030709] text-white">
      {/* Lumières décoratives */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-56 top-1/3 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute right-[-180px] top-[-120px] h-[600px] w-[600px] rounded-full bg-green-500/10 blur-[160px]" />
        <div className="absolute bottom-[-220px] right-[20%] h-[500px] w-[600px] rounded-full bg-orange-500/10 blur-[170px]" />

        <span className="absolute left-[9%] top-[22%] h-2 w-2 rounded-full bg-lime-400/70" />
        <span className="absolute left-[43%] top-[13%] h-2.5 w-2.5 rounded-full bg-orange-500/80" />
        <span className="absolute right-[11%] top-[27%] h-2 w-2 rounded-full bg-red-500/80" />
        <span className="absolute bottom-[19%] left-[36%] h-3 w-3 rounded-full bg-emerald-500/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="border-b border-white/[0.07] bg-[#030709]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[82px] w-full max-w-[1560px] items-center justify-between px-5 sm:px-8 lg:h-[94px] lg:px-12 xl:px-16">
            <Link
              href="/organizer"
              className="flex items-center"
              aria-label="Retour à l’accueil organisateur"
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

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="hidden items-center gap-2 text-sm text-neutral-300 md:flex">
                <ShieldCheck className="h-5 w-5 text-lime-400" />
                <span>Inscription sécurisée</span>
              </div>

              <Link
                href="/organizer/login"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500/70 px-5 text-sm font-semibold transition hover:bg-emerald-500/10 sm:px-7"
              >
                Connexion
              </Link>
            </div>
          </div>
        </header>

        {/* Contenu */}
        <section className="flex flex-1">
          <div className="mx-auto grid w-full max-w-[1560px] flex-1 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Zone visuelle PC */}
            <div className="relative hidden min-h-[760px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between">
              <div className="relative z-10 px-12 pb-5 pt-14 xl:px-16">
                <Link
                  href="/organizer"
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à l’espace organisateur
                </Link>

                <div className="mt-16 max-w-[540px]">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-lime-400">
                    Compte organisateur
                  </p>

                  <h1 className="mt-5 text-[54px] font-black leading-[1.02] tracking-[-0.045em] xl:text-[66px]">
                    Lancez vos
                    <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                      événements.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-[500px] text-base leading-7 text-neutral-300 xl:text-lg">
                    Créez votre compte, publiez vos événements et suivez vos
                    ventes depuis un espace professionnel.
                  </p>

                  <div className="mt-9 grid gap-4 sm:grid-cols-2">
                    {[
                      "Création d’événements",
                      "Billets et QR codes",
                      "Suivi des ventes",
                      "Paiements sécurisés",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 text-sm text-neutral-200"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                          <Check className="h-3.5 w-3.5 text-lime-400" />
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-auto flex min-h-[360px] items-end justify-center px-7">
                <div className="absolute bottom-[15%] h-[260px] w-[70%] rounded-full bg-emerald-500/15 blur-[100px]" />

                <Image
                  src="/imagea.png"
                  alt="Plateforme organisateur Tikemia"
                  width={850}
                  height={600}
                  priority
                  className="relative z-10 h-auto w-full max-w-[760px] object-contain drop-shadow-[0_30px_55px_rgba(0,0,0,0.65)]"
                />
              </div>
            </div>

            {/* Formulaire */}
            <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10 xl:px-16">
              <div className="w-full max-w-[680px]">
                <Link
                  href="/organizer"
                  className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Link>

                <div className="rounded-[26px] border border-white/[0.09] bg-[#081015]/90 p-5 shadow-[0_35px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8 xl:p-10">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-400">
                      Inscription
                    </p>

                    <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-[38px]">
                      Créez votre compte
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                      Renseignez vos informations pour ouvrir votre espace
                      organisateur.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    {/* Nom et prénom */}
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Prénom" required>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                          <input
                            type="text"
                            value={form.firstName}
                            onChange={(event) =>
                              updateField("firstName", event.target.value)
                            }
                            autoComplete="given-name"
                            placeholder="Votre prénom"
                            className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </div>
                      </Field>

                      <Field label="Nom" required>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                          <input
                            type="text"
                            value={form.lastName}
                            onChange={(event) =>
                              updateField("lastName", event.target.value)
                            }
                            autoComplete="family-name"
                            placeholder="Votre nom"
                            className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </div>
                      </Field>
                    </div>

                    {/* Pays */}
                    <Field label="Pays" required>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setCountryMenuOpen((current) => !current)
                          }
                          className="flex h-14 w-full items-center justify-between rounded-xl border border-white/10 bg-[#050b0f] px-4 text-left text-sm outline-none transition hover:border-white/20 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-xl">
                              {selectedCountry.flag}
                            </span>
                            <span>{selectedCountry.name}</span>
                          </span>

                          <ChevronDown
                            className={`h-5 w-5 text-neutral-500 transition ${
                              countryMenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {countryMenuOpen && (
                          <div className="absolute left-0 right-0 top-[62px] z-40 max-h-[270px] overflow-y-auto rounded-xl border border-white/10 bg-[#0a1217] p-2 shadow-2xl">
                            {countries.map((country) => {
                              const active =
                                country.code === selectedCountry.code;

                              return (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => {
                                    updateField(
                                      "countryCode",
                                      country.code,
                                    );
                                    setCountryMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
                                    active
                                      ? "bg-emerald-500/12 text-lime-300"
                                      : "text-neutral-300 hover:bg-white/5 hover:text-white"
                                  }`}
                                >
                                  <span className="flex items-center gap-3">
                                    <span className="text-lg">
                                      {country.flag}
                                    </span>
                                    {country.name}
                                  </span>

                                  <span className="text-xs text-neutral-500">
                                    {country.dialCode}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Field>

                    {/* Téléphone */}
                    <Field label="Téléphone" required>
                      <div className="flex">
                        <div className="flex h-14 shrink-0 items-center gap-2 rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-4 text-sm">
                          <span>{selectedCountry.flag}</span>
                          <span className="font-semibold text-neutral-200">
                            {selectedCountry.dialCode}
                          </span>
                        </div>

                        <div className="relative flex-1">
                          <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                          <input
                            type="tel"
                            inputMode="tel"
                            value={form.phone}
                            onChange={(event) =>
                              updateField(
                                "phone",
                                event.target.value.replace(/[^\d\s]/g, ""),
                              )
                            }
                            autoComplete="tel-national"
                            placeholder="Numéro de téléphone"
                            className="h-14 w-full rounded-r-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </div>
                      </div>
                    </Field>

                    {/* E-mail */}
                    <Field label="Adresse e-mail" required>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                        <input
                          type="email"
                          value={form.email}
                          onChange={(event) =>
                            updateField("email", event.target.value)
                          }
                          autoComplete="email"
                          placeholder="nom@exemple.com"
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                    </Field>

                    {/* Mot de passe */}
                    <Field label="Mot de passe" required>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(event) =>
                            updateField("password", event.target.value)
                          }
                          autoComplete="new-password"
                          placeholder="Créez un mot de passe sécurisé"
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((current) => !current)
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-white"
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

                      {form.password && (
                        <div className="mt-3 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
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
                    </Field>

                    {/* Conditions */}
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.acceptTerms}
                        onChange={(event) =>
                          updateField(
                            "acceptTerms",
                            event.target.checked,
                          )
                        }
                        className="peer sr-only"
                      />

                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/20 bg-[#050b0f] transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500">
                        {form.acceptTerms && (
                          <Check className="h-3.5 w-3.5 text-black" />
                        )}
                      </span>

                      <span className="text-sm leading-6 text-neutral-400">
                        J’accepte les{" "}
                        <Link
                          href="/terms"
                          className="font-medium text-white transition hover:text-lime-400"
                        >
                          conditions d’utilisation
                        </Link>{" "}
                        et la{" "}
                        <Link
                          href="/privacy-policy"
                          className="font-medium text-white transition hover:text-lime-400"
                        >
                          politique de confidentialité
                        </Link>
                        .
                      </span>
                    </label>

                    {/* Erreur */}
                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                      >
                        {error}
                      </div>
                    )}

                    {/* Bouton */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Création du compte...
                        </>
                      ) : (
                        <>
                          S’inscrire
                          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-sm text-neutral-400">
                      Vous avez déjà un compte ?{" "}
                      <Link
                        href="/organizer/login"
                        className="font-bold text-lime-400 transition hover:text-lime-300"
                      >
                        Se connecter
                      </Link>
                    </p>
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

type FieldProps = {
  label: string;
  required?: boolean;
  children: React.ReactNode;
};

function Field({ label, required = false, children }: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-neutral-200">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </label>

      {children}
    </div>
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