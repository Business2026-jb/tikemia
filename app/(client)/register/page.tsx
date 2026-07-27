"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  Search,
  ShieldCheck,
  TicketCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  CLIENT_COUNTRIES,
  DEFAULT_CLIENT_COUNTRY_CODE,
  findClientCountryByCode,
  getDefaultClientCountry,
} from "@/lib/client/auth/countries";

type RegisterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  password: string;
};

type RegisterResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

const initialForm: RegisterFormData = {
  firstName: "",
  lastName: "",
  email: "",
  countryCode: DEFAULT_CLIENT_COUNTRY_CODE,
  phone: "",
  password: "",
};

function normalizeNationalPhone(value: string): string {
  return value
    .replace(/[^\d\s()-]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 24);
}

export default function ClientRegisterPage() {
  const [form, setForm] = useState<RegisterFormData>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [isDetectingCountry, setIsDetectingCountry] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCountry = useMemo(
    () =>
      findClientCountryByCode(form.countryCode) ?? getDefaultClientCountry(),
    [form.countryCode],
  );

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase("fr-FR");

    if (!query) {
      return CLIENT_COUNTRIES;
    }

    return CLIENT_COUNTRIES.filter(
      (country) =>
        country.name.toLocaleLowerCase("fr-FR").includes(query) ||
        country.code.toLocaleLowerCase("fr-FR").includes(query) ||
        country.dialCode.includes(query),
    );
  }, [countrySearch]);

  const passwordRules = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /\d/.test(form.password),
  };

  const passwordIsValid = Object.values(passwordRules).every(Boolean);

  useEffect(() => {
    let active = true;

    async function detectCountry() {
      try {
        const response = await fetch("/api/client/location/country", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as {
          countryCode?: string;
        };

        const detectedCountry = findClientCountryByCode(result.countryCode);

        if (active && detectedCountry) {
          setForm((current) => ({
            ...current,
            countryCode: detectedCountry.code,
          }));
        }
      } catch {
        // La détection automatique est facultative.
      } finally {
        if (active) {
          setIsDetectingCountry(false);
        }
      }
    }

    void detectCountry();

    return () => {
      active = false;
    };
  }, []);

  function updateField<Key extends keyof RegisterFormData>(
    field: Key,
    value: RegisterFormData[Key],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function selectCountry(countryCode: string) {
    updateField("countryCode", countryCode);
    setCountrySearch("");
    setCountryMenuOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!firstName) {
      setErrorMessage("Renseignez votre prénom.");
      return;
    }

    if (!lastName) {
      setErrorMessage("Renseignez votre nom.");
      return;
    }

    if (!email) {
      setErrorMessage("Renseignez votre adresse e-mail.");
      return;
    }

    if (!phone) {
      setErrorMessage("Renseignez votre numéro de téléphone.");
      return;
    }

    if (!passwordIsValid) {
      setErrorMessage(
        "Votre mot de passe ne respecte pas les critères demandés.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/client/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          country: selectedCountry.name,
          countryCode: selectedCountry.code,
          dialCode: selectedCountry.dialCode,
          phone,
          password: form.password,
        }),
      });

      const result = (await response.json()) as RegisterResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? "Impossible de créer votre compte.",
        );
      }

      sessionStorage.setItem(
        "tikemia_client_verification_email",
        email,
      );

      window.location.href =
        result.redirectTo ??
        `/verify-email?email=${encodeURIComponent(email)}`;
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

      <div className="relative z-10 flex min-h-screen flex-col">
        <section className="flex flex-1">
          <div className="mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative hidden min-h-[760px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between">
              <div className="relative z-10 px-10 pb-6 pt-12 xl:px-14 xl:pt-16">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux événements
                </Link>

                <div className="mt-14 max-w-[560px]">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-400">
                    Compte client Tikemia
                  </p>

                  <h1 className="mt-5 text-[50px] font-black leading-[1.02] tracking-[-0.045em] xl:text-[64px]">
                    Tous vos billets,
                    <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                      au même endroit.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-[520px] text-base leading-7 text-neutral-400 xl:text-lg">
                    Créez votre compte pour retrouver vos billets, suivre vos
                    commandes et accéder facilement à vos événements.
                  </p>

                  <div className="mt-9 grid gap-4 sm:grid-cols-2">
                    {[
                      "Billets centralisés",
                      "Commandes enregistrées",
                      "Accès rapide aux événements",
                      "Compte client sécurisé",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 text-sm font-medium text-neutral-300"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/[0.08]">
                          <Check className="h-3.5 w-3.5 text-lime-400" />
                        </span>
                        <span>{item}</span>
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
                        <TicketCheck className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-lg font-black text-white">
                        Mes billets
                      </p>
                      <p className="mt-2 text-sm leading-6 text-neutral-500">
                        Retrouvez vos billets achetés sur Tikemia.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/[0.07] bg-[#081015]/80 p-5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-lg font-black text-white">
                        Accès sécurisé
                      </p>
                      <p className="mt-2 text-sm leading-6 text-neutral-500">
                        Votre adresse e-mail sera vérifiée avant l’activation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
              <div className="w-full max-w-[680px]">
                <Link
                  href="/"
                  className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux événements
                </Link>

                <div className="rounded-[26px] border border-white/[0.09] bg-[#081015]/95 p-5 shadow-[0_35px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8 xl:p-10">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-400">
                      Inscription client
                    </p>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-[38px]">
                      Créez votre compte
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                      Renseignez vos informations pour accéder à vos billets et
                      à vos commandes.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-5"
                    noValidate
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Prénom" htmlFor="client-first-name">
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                          <input
                            id="client-first-name"
                            type="text"
                            value={form.firstName}
                            onChange={(event) =>
                              updateField("firstName", event.target.value)
                            }
                            autoComplete="given-name"
                            placeholder="Votre prénom"
                            disabled={isSubmitting}
                            className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </Field>

                      <Field label="Nom" htmlFor="client-last-name">
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                          <input
                            id="client-last-name"
                            type="text"
                            value={form.lastName}
                            onChange={(event) =>
                              updateField("lastName", event.target.value)
                            }
                            autoComplete="family-name"
                            placeholder="Votre nom"
                            disabled={isSubmitting}
                            className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </Field>
                    </div>

                    <Field label="Adresse e-mail" htmlFor="client-email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                        <input
                          id="client-email"
                          type="email"
                          value={form.email}
                          onChange={(event) =>
                            updateField("email", event.target.value)
                          }
                          autoComplete="email"
                          placeholder="nom@exemple.com"
                          disabled={isSubmitting}
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </Field>

                    <Field label="Pays">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setCountryMenuOpen((current) => !current)
                          }
                          disabled={isSubmitting}
                          className="flex h-14 w-full items-center justify-between rounded-xl border border-white/10 bg-[#050b0f] px-4 text-left text-sm outline-none transition hover:border-white/20 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="shrink-0 text-xl">
                              {selectedCountry.flag}
                            </span>
                            <span className="truncate font-semibold text-white">
                              {selectedCountry.name}
                            </span>
                            {isDetectingCountry && (
                              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-neutral-600" />
                            )}
                          </span>
                          <ChevronDown
                            className={`h-5 w-5 shrink-0 text-neutral-600 transition ${
                              countryMenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {countryMenuOpen && (
                          <div className="absolute left-0 right-0 top-[62px] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1217] shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
                            <div className="border-b border-white/[0.07] p-3">
                              <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                                <input
                                  type="search"
                                  value={countrySearch}
                                  onChange={(event) =>
                                    setCountrySearch(event.target.value)
                                  }
                                  autoFocus
                                  placeholder="Rechercher un pays"
                                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#050b0f] pl-10 pr-10 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-500/60"
                                />
                                {countrySearch && (
                                  <button
                                    type="button"
                                    onClick={() => setCountrySearch("")}
                                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white/[0.05] hover:text-white"
                                    aria-label="Effacer la recherche"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="max-h-[290px] overflow-y-auto p-2">
                              {filteredCountries.length > 0 ? (
                                filteredCountries.map((country) => {
                                  const active =
                                    country.code === selectedCountry.code;

                                  return (
                                    <button
                                      key={country.code}
                                      type="button"
                                      onClick={() => selectCountry(country.code)}
                                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${
                                        active
                                          ? "bg-emerald-500/[0.1] text-lime-300"
                                          : "text-neutral-300 hover:bg-white/[0.05] hover:text-white"
                                      }`}
                                    >
                                      <span className="flex min-w-0 items-center gap-3">
                                        <span className="shrink-0 text-lg">
                                          {country.flag}
                                        </span>
                                        <span className="truncate">
                                          {country.name}
                                        </span>
                                      </span>
                                      <span className="ml-3 shrink-0 text-xs font-semibold text-neutral-600">
                                        {country.dialCode}
                                      </span>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-4 py-8 text-center text-sm text-neutral-500">
                                  Aucun pays trouvé.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Field>

                    <Field label="Numéro de téléphone" htmlFor="client-phone">
                      <div className="flex">
                        <div className="flex h-14 shrink-0 items-center gap-2 rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm sm:px-4">
                          <span>{selectedCountry.flag}</span>
                          <span className="font-bold text-neutral-200">
                            {selectedCountry.dialCode}
                          </span>
                        </div>

                        <div className="relative min-w-0 flex-1">
                          <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                          <input
                            id="client-phone"
                            type="tel"
                            inputMode="tel"
                            value={form.phone}
                            onChange={(event) =>
                              updateField(
                                "phone",
                                normalizeNationalPhone(event.target.value),
                              )
                            }
                            autoComplete="tel-national"
                            placeholder="Votre numéro"
                            disabled={isSubmitting}
                            className="h-14 w-full rounded-r-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </Field>

                    <Field label="Mot de passe" htmlFor="client-password">
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
                        <input
                          id="client-password"
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(event) =>
                            updateField("password", event.target.value)
                          }
                          autoComplete="new-password"
                          placeholder="Créez un mot de passe sécurisé"
                          disabled={isSubmitting}
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((current) => !current)
                          }
                          disabled={isSubmitting}
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

                      {form.password && (
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
                    </Field>

                    {errorMessage && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
                      >
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Création du compte...
                        </>
                      ) : (
                        <>
                          Créer mon compte
                          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-sm text-neutral-500">
                      Vous avez déjà un compte ?{" "}
                      <Link
                        href="/login"
                        className="font-black text-lime-400 transition hover:text-lime-300"
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

      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
};

function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-semibold text-neutral-200"
      >
        {label}
        <span className="ml-1 text-orange-500">*</span>
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
        valid ? "text-lime-400" : "text-neutral-600"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          valid
            ? "border-lime-400/50 bg-lime-400/[0.08]"
            : "border-white/[0.12]"
        }`}
      >
        {valid && <Check className="h-2.5 w-2.5" />}
      </span>
      <span>{text}</span>
    </div>
  );
}