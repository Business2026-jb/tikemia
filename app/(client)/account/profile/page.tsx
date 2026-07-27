import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { requireClient } from "@/lib/client/auth/require-client";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon profil | Tikemia",
  description: "Consultez et gérez les informations de votre compte Tikemia.",
};

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.trim().slice(0, 1)}${lastName.trim().slice(0, 1)}`.toUpperCase();
}

function getFullPhone(dialCode: string, phone: string): string {
  const cleanDialCode = dialCode.trim();
  const cleanPhone = phone.trim();

  if (!cleanDialCode || cleanPhone.startsWith(cleanDialCode)) {
    return cleanPhone;
  }

  return `${cleanDialCode} ${cleanPhone}`.trim();
}

export default async function ClientProfilePage() {
  const { customer } = await requireClient("/account/profile");

  const profile = await prisma.user.findUnique({
    where: {
      id: customer.id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      country: true,
      countryCode: true,
      dialCode: true,
      role: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!profile) {
    throw new Error("Profil client introuvable.");
  }

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const fullPhone = getFullPhone(profile.dialCode, profile.phone);

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
          <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-6 lg:p-8">
            <div aria-hidden="true" className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/[0.09] blur-[110px]" />
            <div aria-hidden="true" className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-orange-500/[0.05] blur-[120px]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] border border-lime-400/20 bg-lime-400/[0.08] text-2xl font-black text-lime-300 shadow-[0_16px_40px_rgba(132,204,22,0.08)] sm:h-24 sm:w-24 sm:text-3xl">
                  {getInitials(profile.firstName, profile.lastName)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">
                      Compte client
                    </p>

                    {profile.emailVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-black text-emerald-300">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Vérifié
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2.5 py-1 text-[10px] font-black text-amber-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        Vérification requise
                      </span>
                    )}
                  </div>

                  <h1 className="mt-3 truncate text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
                    {fullName}
                  </h1>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-500">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-neutral-600" />
                      {profile.email}
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-neutral-600" />
                      {profile.country}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:flex">
                <Link
                  href="/account/profile/edit"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01] lg:w-auto"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier mes informations
                </Link>

                <Link
                  href="/account/profile/password"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-black text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white lg:w-auto"
                >
                  <KeyRound className="h-4 w-4" />
                  Mot de passe
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
            <div className="rounded-[22px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
                  <UserRound className="h-5 w-5" />
                </span>

                <div>
                  <h2 className="text-lg font-black text-white sm:text-xl">Informations personnelles</h2>
                  <p className="mt-1 text-xs text-neutral-500 sm:text-sm">Informations enregistrées sur votre compte.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <ProfileInformationCard icon={UserRound} label="Prénom" value={profile.firstName} />
                <ProfileInformationCard icon={UserRound} label="Nom" value={profile.lastName} />
                <ProfileInformationCard
                  icon={Mail}
                  label="Adresse e-mail"
                  value={profile.email}
                  badge={profile.emailVerified ? "Vérifiée" : "Non vérifiée"}
                  badgeTone={profile.emailVerified ? "success" : "warning"}
                />
                <ProfileInformationCard icon={Phone} label="Numéro de téléphone" value={fullPhone} />
                <ProfileInformationCard icon={Globe2} label="Pays" value={profile.country} />
                <ProfileInformationCard icon={Globe2} label="Code pays" value={profile.countryCode} />
                <ProfileInformationCard icon={Phone} label="Indicatif" value={profile.dialCode} />
                <ProfileInformationCard icon={ShieldCheck} label="Type de compte" value="Client Tikemia" />
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-[22px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300">
                    <ShieldCheck className="h-5 w-5" />
                  </span>

                  <div>
                    <h2 className="text-lg font-black text-white">État du compte</h2>
                    <p className="mt-1 text-xs text-neutral-500">Sécurité et disponibilité.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <StatusRow
                    icon={profile.isActive ? CheckCircle2 : XCircle}
                    label="Compte"
                    value={profile.isActive ? "Actif" : "Désactivé"}
                    active={profile.isActive}
                  />
                  <StatusRow
                    icon={profile.emailVerified ? CheckCircle2 : Clock3}
                    label="Adresse e-mail"
                    value={profile.emailVerified ? "Vérifiée" : "En attente"}
                    active={profile.emailVerified}
                  />
                  <StatusRow icon={BadgeCheck} label="Accès client" value="Autorisé" active />
                </div>
              </section>

              <section className="rounded-[22px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/[0.06] text-blue-300">
                    <CalendarDays className="h-5 w-5" />
                  </span>

                  <div>
                    <h2 className="text-lg font-black text-white">Historique du compte</h2>
                    <p className="mt-1 text-xs text-neutral-500">Dates principales.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <TimelineRow label="Compte créé" value={formatDate(profile.createdAt)} />
                  <TimelineRow label="Dernière mise à jour" value={formatDateTime(profile.updatedAt)} />
                </div>
              </section>
            </div>
          </section>

          <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.06] text-lime-300">
                  <Pencil className="h-5 w-5" />
                </span>

                <div>
                  <h2 className="text-lg font-black text-white">Mettre à jour mes informations</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
                    Modifiez votre nom, votre numéro et votre pays depuis un formulaire sécurisé.
                  </p>
                </div>
              </div>

              <Link
                href="/account/profile/edit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.07] px-5 text-sm font-black text-lime-300 transition hover:bg-lime-400/[0.12] sm:w-auto"
              >
                Modifier mon profil
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

type ProfileInformationCardProps = {
  icon: typeof UserRound;
  label: string;
  value: string;
  badge?: string;
  badgeTone?: "success" | "warning";
};

function ProfileInformationCard({
  icon: Icon,
  label,
  value,
  badge,
  badgeTone = "success",
}: ProfileInformationCardProps) {
  return (
    <div className="min-w-0 rounded-[18px] border border-white/[0.07] bg-[#03090d] p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-lime-400">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">{label}</p>
            {badge && (
              <span
                className={
                  badgeTone === "success"
                    ? "rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-0.5 text-[9px] font-black text-emerald-300"
                    : "rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2 py-0.5 text-[9px] font-black text-amber-300"
                }
              >
                {badge}
              </span>
            )}
          </div>

          <p className="mt-2 break-words text-sm font-black leading-6 text-neutral-200">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#03090d] p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={
            active
              ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/15 bg-amber-400/[0.07] text-amber-300"
          }
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="truncate text-xs font-black text-neutral-400">{label}</span>
      </div>

      <span className={active ? "shrink-0 text-xs font-black text-emerald-300" : "shrink-0 text-xs font-black text-amber-300"}>
        {value}
      </span>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#03090d] p-3.5">
      <span className="text-xs font-black text-neutral-500">{label}</span>
      <span className="text-right text-xs font-black text-neutral-200">{value}</span>
    </div>
  );
}