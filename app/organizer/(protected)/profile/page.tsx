import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  redirect,
} from "next/navigation";

import AvatarUploader from "@/components/organizer/profile/avatar-uploader";
import ProfileForm, {
  type OrganizerProfileCountryOption,
} from "@/components/organizer/profile/profile-form";
import {
  getOrganizerProfile,
  GetOrganizerProfileError,
  type OrganizerProfileData,
  type OrganizerProfileMissingField,
} from "@/lib/organizer/get-organizer-profile";

export const metadata: Metadata = {
  title: "Mon profil organisateur | Tikemia",
  description:
    "Consultez et modifiez votre profil organisateur Tikemia.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COUNTRIES: OrganizerProfileCountryOption[] = [
  {
    name: "Bénin",
    code: "BJ",
    dialCode: "+229",
  },
  {
    name: "Nigeria",
    code: "NG",
    dialCode: "+234",
  },
  {
    name: "Côte d’Ivoire",
    code: "CI",
    dialCode: "+225",
  },
  {
    name: "Cameroun",
    code: "CM",
    dialCode: "+237",
  },
  {
    name: "Gabon",
    code: "GA",
    dialCode: "+241",
  },
  {
    name: "Ghana",
    code: "GH",
    dialCode: "+233",
  },
  {
    name: "Togo",
    code: "TG",
    dialCode: "+228",
  },
  {
    name: "France",
    code: "FR",
    dialCode: "+33",
  },
  {
    name: "Belgique",
    code: "BE",
    dialCode: "+32",
  },
  {
    name: "Italie",
    code: "IT",
    dialCode: "+39",
  },
  {
    name: "Niger",
    code: "NE",
    dialCode: "+227",
  },
  {
    name: "Mali",
    code: "ML",
    dialCode: "+223",
  },
  {
    name: "Sénégal",
    code: "SN",
    dialCode: "+221",
  },
];

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date indisponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "long",
    },
  ).format(date);
}

function getCompletionTone(
  percentage: number,
): {
  text: string;
  border: string;
  background: string;
} {
  if (percentage >= 100) {
    return {
      text: "text-lime-400",
      border:
        "border-emerald-500/25",
      background:
        "bg-emerald-500/[0.06]",
    };
  }

  if (percentage >= 70) {
    return {
      text: "text-lime-400",
      border:
        "border-lime-500/25",
      background:
        "bg-lime-500/[0.05]",
    };
  }

  if (percentage >= 40) {
    return {
      text: "text-orange-400",
      border:
        "border-orange-500/25",
      background:
        "bg-orange-500/[0.06]",
    };
  }

  return {
    text: "text-red-400",
    border:
      "border-red-500/25",
    background:
      "bg-red-500/[0.06]",
  };
}

export default async function OrganizerProfilePage() {
  try {
    const data =
      await getOrganizerProfile();

    const organizer =
      data.organizer;

    const completionTone =
      getCompletionTone(
        organizer.completion
          .percentage,
      );

    return (
      <main className="mx-auto w-full max-w-[1600px] space-y-5">
        <ProfileHeader
          organizer={organizer}
        />

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <AvatarUploader
              initialAvatar={
                organizer.professional
                  .avatar
              }
              initials={
                organizer.personal
                  .initials
              }
              displayName={
                organizer.display
                  .displayName
              }
              disabled={
                !organizer.permissions
                  .canUploadAvatar
              }
            />

            <ProfileForm
              organizer={organizer}
              countries={COUNTRIES}
            />
          </div>

          <aside className="space-y-5 xl:sticky xl:top-[112px]">
            <ProfileCompletionCard
              organizer={organizer}
              tone={completionTone}
            />

            <ProfileSummaryCard
              organizer={organizer}
            />

            <ProfileSecurityCard
              organizer={organizer}
            />
          </aside>
        </section>
      </main>
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerProfileError
    ) {
      if (
        error.status === 401 ||
        error.code ===
          "UNAUTHORIZED" ||
        error.code ===
          "INVALID_SESSION" ||
        error.code ===
          "EXPIRED_SESSION"
      ) {
        redirect(
          error.redirectTo ??
            "/organizer/login",
        );
      }

      if (
        error.redirectTo
      ) {
        redirect(
          error.redirectTo,
        );
      }

      return (
        <ProfileLoadError
          message={error.message}
        />
      );
    }

    console.error(
      "[ORGANIZER_PROFILE_PAGE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message:
              error.message,
            stack:
              process.env
                .NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return (
      <ProfileLoadError message="Impossible de charger votre profil organisateur pour le moment." />
    );
  }
}

function ProfileHeader({
  organizer,
}: {
  organizer: OrganizerProfileData;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.09),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_34%)]" />

      <div className="relative flex flex-col gap-5 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/10 sm:h-16 sm:w-16">
            {organizer.professional
              .avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  organizer
                    .professional
                    .avatar
                }
                alt={
                  organizer.display
                    .displayName
                }
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-black text-white sm:text-xl">
                {
                  organizer
                    .personal
                    .initials
                }
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-lime-400">
                <CircleUserRound className="h-3.5 w-3.5" />
                Profil organisateur
              </span>

              {organizer.personal
                .emailVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.07] px-2.5 py-1 text-[10px] font-bold text-blue-300">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Vérifié
                </span>
              )}
            </div>

            <h1 className="mt-3 break-words text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
              {
                organizer.display
                  .displayName
              }
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              {
                organizer.display
                  .secondaryName
              }
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-lime-400" />

                {
                  organizer.display
                    .location
                }
              </span>

              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-orange-400" />

                Membre depuis{" "}
                {formatDate(
                  organizer.personal
                    .createdAt,
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
          <HeaderMetric
            label="Profil complété"
            value={`${organizer.completion.percentage} %`}
            icon={
              CheckCircle2
            }
            tone="green"
          />

          <HeaderMetric
            label="Statut du compte"
            value={
              organizer.display
                .accountStatusLabel
            }
            icon={
              ShieldCheck
            }
            tone="blue"
          />
        </div>
      </div>
    </section>
  );
}

function ProfileCompletionCard({
  organizer,
  tone,
}: {
  organizer: OrganizerProfileData;

  tone: {
    text: string;
    border: string;
    background: string;
  };
}) {
  const missingFields =
    organizer.completion
      .missingFields.slice(
        0,
        6,
      );

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-lime-400" />

          <h2 className="text-base font-black text-white">
            Progression du profil
          </h2>
        </div>
      </header>

      <div className="p-4">
        <div
          className={`rounded-2xl border p-4 ${tone.border} ${tone.background}`}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-neutral-500">
                Profil complété
              </p>

              <p
                className={`mt-1 text-3xl font-black tracking-[-0.04em] ${tone.text}`}
              >
                {
                  organizer
                    .completion
                    .percentage
                }
                %
              </p>
            </div>

            <p className="text-right text-[11px] leading-5 text-neutral-500">
              {
                organizer
                  .completion
                  .completedFields
              }{" "}
              sur{" "}
              {
                organizer
                  .completion
                  .totalFields
              }{" "}
              informations
            </p>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 transition-[width] duration-500"
              style={{
                width: `${organizer.completion.percentage}%`,
              }}
            />
          </div>
        </div>

        {organizer.completion
          .isComplete ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

            <div>
              <p className="text-xs font-bold text-white">
                Profil complet
              </p>

              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Toutes les informations
                principales ont été
                renseignées.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xs font-bold text-white">
              Informations à compléter
            </p>

            <div className="mt-3 space-y-2">
              {missingFields.map(
                (field) => (
                  <MissingFieldItem
                    key={field.key}
                    field={field}
                  />
                ),
              )}
            </div>

            {organizer
              .completion
              .missingFields
              .length >
              missingFields.length && (
              <p className="mt-3 text-[10px] text-neutral-600">
                +
                {organizer
                  .completion
                  .missingFields
                  .length -
                  missingFields.length}{" "}
                autre
                {organizer
                  .completion
                  .missingFields
                  .length -
                  missingFields.length >
                1
                  ? "s"
                  : ""}{" "}
                information
                {organizer
                  .completion
                  .missingFields
                  .length -
                  missingFields.length >
                1
                  ? "s"
                  : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MissingFieldItem({
  field,
}: {
  field: OrganizerProfileMissingField;
}) {
  const sectionLabel =
    field.section ===
    "PERSONAL"
      ? "Personnel"
      : field.section ===
          "PROFESSIONAL"
        ? "Professionnel"
        : "En ligne";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <span className="text-xs font-semibold text-neutral-400">
        {field.label}
      </span>

      <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] font-bold text-neutral-600">
        {sectionLabel}
      </span>
    </div>
  );
}

function ProfileSummaryCard({
  organizer,
}: {
  organizer: OrganizerProfileData;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <UserRound className="h-5 w-5 text-lime-400" />

          <h2 className="text-base font-black text-white">
            Résumé du profil
          </h2>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <SummaryValue
          icon={Mail}
          label="Adresse e-mail"
          value={
            organizer.personal
              .email
          }
        />

        <SummaryValue
          icon={Phone}
          label="Téléphone"
          value={`${organizer.personal.dialCode} ${organizer.personal.phone}`}
        />

        <SummaryValue
          icon={MapPin}
          label="Localisation"
          value={
            organizer.display
              .location
          }
        />

        <SummaryValue
          icon={Building2}
          label="Organisation"
          value={
            organizer.professional
              .businessName ||
            "Non renseignée"
          }
        />

        <SummaryValue
          icon={Globe2}
          label="Site internet"
          value={
            organizer.professional
              .website ||
            "Non renseigné"
          }
        />
      </div>
    </section>
  );
}

function ProfileSecurityCard({
  organizer,
}: {
  organizer: OrganizerProfileData;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-lime-400" />

          <h2 className="text-base font-black text-white">
            Sécurité du compte
          </h2>
        </div>
      </header>

      <div className="space-y-3 p-4">
        <SecurityStatus
          icon={Mail}
          label="Adresse e-mail"
          value={
            organizer.personal
              .emailVerified
              ? "Vérifiée"
              : "Non vérifiée"
          }
          valid={
            organizer.personal
              .emailVerified
          }
        />

        <SecurityStatus
          icon={ShieldCheck}
          label="Compte"
          value={
            organizer.personal
              .isActive
              ? "Actif"
              : "Désactivé"
          }
          valid={
            organizer.personal
              .isActive
          }
        />

        <Link
          href="/organizer/settings"
          className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.05]"
        >
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 text-orange-400" />

            <div>
              <p className="text-xs font-bold text-white">
                Mot de passe
              </p>

              <p className="mt-0.5 text-[10px] text-neutral-600">
                Gérer la sécurité
              </p>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-neutral-600" />
        </Link>
      </div>
    </section>
  );
}

type IconComponent =
  typeof UserRound;

function HeaderMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: IconComponent;
  tone: "green" | "blue";
}) {
  const styles =
    tone === "green"
      ? {
          border:
            "border-emerald-500/20",
          background:
            "bg-emerald-500/[0.06]",
          icon:
            "text-lime-400",
        }
      : {
          border:
            "border-blue-500/20",
          background:
            "bg-blue-500/[0.06]",
          icon:
            "text-blue-400",
        };

  return (
    <article
      className={`rounded-xl border p-3.5 ${styles.border} ${styles.background}`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${styles.icon}`}
        />

        <p className="text-[10px] text-neutral-500">
          {label}
        </p>
      </div>

      <p className="mt-2 break-words text-sm font-black text-white">
        {value}
      </p>
    </article>
  );
}

function SummaryValue({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
        <Icon className="h-4 w-4 text-lime-400" />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 break-words text-xs font-bold leading-5 text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function SecurityStatus({
  icon: Icon,
  label,
  value,
  valid,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  valid: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-3">
        <Icon
          className={`h-4 w-4 ${
            valid
              ? "text-lime-400"
              : "text-orange-400"
          }`}
        />

        <span className="text-xs font-semibold text-neutral-400">
          {label}
        </span>
      </div>

      <span
        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
          valid
            ? "border-emerald-500/20 bg-emerald-500/[0.07] text-lime-400"
            : "border-orange-500/20 bg-orange-500/[0.07] text-orange-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ProfileLoadError({
  message,
}: {
  message: string;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-180px)] w-full max-w-[920px] items-center justify-center py-8">
      <section className="w-full overflow-hidden rounded-2xl border border-red-500/20 bg-[#081015] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <header className="flex items-start gap-3.5 border-b border-white/[0.07] bg-gradient-to-r from-red-500/[0.07] via-orange-500/[0.03] to-transparent px-5 py-5 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>

          <div>
            <h1 className="text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
              Profil indisponible
            </h1>

            <p className="mt-1.5 text-sm leading-6 text-neutral-500">
              Votre profil organisateur
              n’a pas pu être chargé.
            </p>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3.5 text-sm leading-6 text-red-200"
          >
            {message}
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/organizer/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Retour au dashboard
            </Link>

            <Link
              href="/organizer/profile"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white transition hover:scale-[1.01]"
            >
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}