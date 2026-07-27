"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  countryCode: string;
  dialCode: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProfileApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  profile?: ProfileData;
};

type CountryOption = {
  name: string;
  code: string;
  dialCode: string;
};

const COUNTRIES: CountryOption[] = [
  { name: "Bénin", code: "BJ", dialCode: "+229" },
  { name: "Togo", code: "TG", dialCode: "+228" },
  { name: "Côte d’Ivoire", code: "CI", dialCode: "+225" },
  { name: "Sénégal", code: "SN", dialCode: "+221" },
  { name: "Mali", code: "ML", dialCode: "+223" },
  { name: "Niger", code: "NE", dialCode: "+227" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226" },
  { name: "Ghana", code: "GH", dialCode: "+233" },
  { name: "Nigeria", code: "NG", dialCode: "+234" },
  { name: "Cameroun", code: "CM", dialCode: "+237" },
  { name: "Gabon", code: "GA", dialCode: "+241" },
  { name: "Congo", code: "CG", dialCode: "+242" },
  { name: "RDC", code: "CD", dialCode: "+243" },
  { name: "Guinée", code: "GN", dialCode: "+224" },
  { name: "Maroc", code: "MA", dialCode: "+212" },
  { name: "Algérie", code: "DZ", dialCode: "+213" },
  { name: "Tunisie", code: "TN", dialCode: "+216" },
  { name: "Afrique du Sud", code: "ZA", dialCode: "+27" },
  { name: "France", code: "FR", dialCode: "+33" },
  { name: "Belgique", code: "BE", dialCode: "+32" },
  { name: "Allemagne", code: "DE", dialCode: "+49" },
  { name: "Italie", code: "IT", dialCode: "+39" },
  { name: "Espagne", code: "ES", dialCode: "+34" },
  { name: "Portugal", code: "PT", dialCode: "+351" },
  { name: "Pays-Bas", code: "NL", dialCode: "+31" },
  { name: "Luxembourg", code: "LU", dialCode: "+352" },
  { name: "Suisse", code: "CH", dialCode: "+41" },
  { name: "Royaume-Uni", code: "GB", dialCode: "+44" },
  { name: "Irlande", code: "IE", dialCode: "+353" },
  { name: "États-Unis", code: "US", dialCode: "+1" },
  { name: "Canada", code: "CA", dialCode: "+1" },
];

function onlyPhoneCharacters(value: string): string {
  return value
    .replace(/[^\d\s().-]/g, "")
    .slice(0, 24);
}

export default function ClientProfileEditPage() {
  const [profile, setProfile] =
    useState<ProfileData | null>(null);

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [countryCode, setCountryCode] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const selectedCountry =
    useMemo(
      () =>
        COUNTRIES.find(
          (country) =>
            country.code === countryCode,
        ) ?? null,
      [countryCode],
    );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response =
          await fetch(
            "/api/client/profile",
            {
              method: "GET",
              cache: "no-store",
              headers: {
                Accept: "application/json",
              },
            },
          );

        const data =
          (await response.json()) as ProfileApiResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.profile
        ) {
          throw new Error(
            data.message ||
              "Impossible de charger votre profil.",
          );
        }

        if (!active) {
          return;
        }

        setProfile(data.profile);
        setFirstName(data.profile.firstName);
        setLastName(data.profile.lastName);
        setPhone(data.profile.phone);
        setCountryCode(data.profile.countryCode);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Impossible de charger votre profil.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCountry) {
      setError("Sélectionnez un pays valide.");
      return;
    }

    if (
      firstName.trim().length < 2 ||
      lastName.trim().length < 2
    ) {
      setError(
        "Le prénom et le nom doivent contenir au moins 2 caractères.",
      );
      return;
    }

    const phoneDigits =
      phone.replace(/\D/g, "");

    if (
      phoneDigits.length < 6 ||
      phoneDigits.length > 15
    ) {
      setError(
        "Saisissez un numéro de téléphone valide.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/client/profile",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone.trim(),
              country: selectedCountry.name,
              countryCode: selectedCountry.code,
              dialCode: selectedCountry.dialCode,
            }),
          },
        );

      const data =
        (await response.json()) as ProfileApiResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.profile
      ) {
        throw new Error(
          data.message ||
            "Impossible d’enregistrer vos modifications.",
        );
      }

      setProfile(data.profile);
      setFirstName(data.profile.firstName);
      setLastName(data.profile.lastName);
      setPhone(data.profile.phone);
      setCountryCode(data.profile.countryCode);
      setMessage(
        data.message ||
          "Vos informations ont été mises à jour.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible d’enregistrer vos modifications.",
      );
    } finally {
      setSaving(false);
    }
  }

  function restoreValues() {
    if (!profile) {
      return;
    }

    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPhone(profile.phone);
    setCountryCode(profile.countryCode);
    setError("");
    setMessage("");
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 767px) {
              body footer {
                display: none !important;
              }
            }
          `,
        }}
      />

      <main className="min-h-screen w-full bg-[#03070a] text-white">
        <div className="w-full px-4 py-5 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:py-9 lg:pb-12 xl:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                Compte client
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                Modifier mon profil
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
                Mettez à jour vos informations personnelles.
              </p>
            </div>

            <Link
              href="/account/profile"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au profil
            </Link>
          </div>

          {loading ? (
            <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/[0.08] bg-[#071015]">
              <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]"
            >
              <section className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6 lg:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
                    <UserRound className="h-5 w-5" />
                  </span>

                  <div>
                    <h2 className="text-lg font-black text-white sm:text-xl">
                      Informations personnelles
                    </h2>

                    <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                      Les champs marqués sont nécessaires au fonctionnement de votre compte.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="leading-6">{error}</p>
                  </div>
                )}

                {message && (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 text-sm text-emerald-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="leading-6">{message}</p>
                  </div>
                )}

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field
                    id="firstName"
                    label="Prénom"
                    icon={UserRound}
                  >
                    <input
                      id="firstName"
                      value={firstName}
                      onChange={(event) =>
                        setFirstName(
                          event.target.value.slice(0, 80),
                        )
                      }
                      autoComplete="given-name"
                      required
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/40 focus:ring-4 focus:ring-lime-400/[0.07]"
                    />
                  </Field>

                  <Field
                    id="lastName"
                    label="Nom"
                    icon={UserRound}
                  >
                    <input
                      id="lastName"
                      value={lastName}
                      onChange={(event) =>
                        setLastName(
                          event.target.value.slice(0, 80),
                        )
                      }
                      autoComplete="family-name"
                      required
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/40 focus:ring-4 focus:ring-lime-400/[0.07]"
                    />
                  </Field>

                  <Field
                    id="email"
                    label="Adresse e-mail"
                    icon={Mail}
                    className="sm:col-span-2"
                  >
                    <input
                      id="email"
                      value={profile?.email ?? ""}
                      readOnly
                      className="h-12 w-full cursor-not-allowed rounded-xl border border-white/[0.07] bg-white/[0.02] pl-12 pr-4 text-sm text-neutral-500 outline-none"
                    />
                  </Field>

                  <Field
                    id="countryCode"
                    label="Pays"
                    icon={Globe2}
                  >
                    <select
                      id="countryCode"
                      value={countryCode}
                      onChange={(event) =>
                        setCountryCode(event.target.value)
                      }
                      required
                      className="h-12 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#03090d] pl-12 pr-11 text-sm text-white outline-none transition focus:border-lime-400/40 focus:ring-4 focus:ring-lime-400/[0.07]"
                    >
                      <option value="">
                        Sélectionner
                      </option>

                      {COUNTRIES.map((country) => (
                        <option
                          key={country.code}
                          value={country.code}
                        >
                          {country.name}
                        </option>
                      ))}
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                  </Field>

                  <Field
                    id="phone"
                    label="Numéro de téléphone"
                    icon={Phone}
                  >
                    <div className="flex h-12 overflow-hidden rounded-xl border border-white/[0.09] bg-[#03090d] transition focus-within:border-lime-400/40 focus-within:ring-4 focus-within:ring-lime-400/[0.07]">
                      <span className="flex shrink-0 items-center border-r border-white/[0.08] px-3 text-xs font-black text-lime-300">
                        {selectedCountry?.dialCode ?? "—"}
                      </span>

                      <input
                        id="phone"
                        value={phone}
                        onChange={(event) =>
                          setPhone(
                            onlyPhoneCharacters(
                              event.target.value,
                            ),
                          )
                        }
                        autoComplete="tel-national"
                        inputMode="tel"
                        required
                        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                      />
                    </div>
                  </Field>
                </div>
              </section>

              <aside className="space-y-4">
                <section className="rounded-[22px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300">
                      <ShieldCheck className="h-5 w-5" />
                    </span>

                    <div>
                      <h2 className="text-lg font-black text-white">
                        Compte sécurisé
                      </h2>

                      <p className="mt-1 text-xs text-neutral-500">
                        Votre e-mail reste inchangé.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <InfoRow
                      label="Adresse e-mail"
                      value={profile?.email ?? "—"}
                    />

                    <InfoRow
                      label="Statut"
                      value={
                        profile?.emailVerified
                          ? "E-mail vérifié"
                          : "Vérification requise"
                      }
                    />

                    <InfoRow
                      label="Compte"
                      value={
                        profile?.isActive
                          ? "Actif"
                          : "Désactivé"
                      }
                    />
                  </div>
                </section>

                <section className="rounded-[22px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}

                    Enregistrer
                  </button>

                  <button
                    type="button"
                    onClick={restoreValues}
                    disabled={saving}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                  >
                    Annuler les modifications
                  </button>
                </section>
              </aside>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  className = "",
  children,
}: {
  id: string;
  label: string;
  icon: typeof UserRound;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-black text-neutral-400"
      >
        {label}
      </label>

      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 z-10 h-4.5 w-4.5 -translate-y-1/2 text-neutral-600" />
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#03090d] p-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.11em] text-neutral-700">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-black leading-5 text-neutral-300">
        {value}
      </p>
    </div>
  );
}