import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MailCheck,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  TicketCheck,
} from "lucide-react";
import { redirect } from "next/navigation";

import SettingsForm from "@/components/organizer/settings/settings-form";
import {
  getOrganizerSettings,
  GetOrganizerSettingsError,
  type OrganizerSettingsCurrencyOption,
  type OrganizerSettingsData,
} from "@/lib/organizer/get-organizer-settings";

export const metadata: Metadata = {
  title: "Paramètres organisateur | Tikemia",
  description:
    "Gérez vos préférences, notifications, paramètres de billetterie et options de sécurité Tikemia.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(
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
      timeStyle: "short",
    },
  ).format(date);
}

function getOptionLabel({
  value,
  options,
}: {
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
}): string {
  return (
    options.find(
      (option) =>
        option.value === value,
    )?.label ?? value
  );
}

function getCurrencyOption({
  value,
  options,
}: {
  value: string;
  options: OrganizerSettingsCurrencyOption[];
}): OrganizerSettingsCurrencyOption | null {
  return (
    options.find(
      (option) =>
        option.value === value,
    ) ?? null
  );
}

export default async function OrganizerSettingsPage() {
  try {
    const data =
      await getOrganizerSettings();

    const settings =
      data.settings;

    const notificationChannelsCount =
      countEnabledNotificationChannels(
        settings,
      );

    const notificationTypesCount =
      countEnabledNotificationTypes(
        settings,
      );

    const selectedCurrency =
      getCurrencyOption({
        value:
          settings.preferences.currency,

        options:
          settings.options.currencies,
      });

    return (
      <main className="mx-auto w-full max-w-[1600px] space-y-5">
        <SettingsHeader
          settings={settings}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Globe2}
            label="Langue"
            value={getOptionLabel({
              value:
                settings.preferences
                  .language,

              options:
                settings.options
                  .languages,
            })}
            detail="Langue de l’espace organisateur"
            tone="green"
          />

          <SummaryCard
            icon={CircleDollarSign}
            label="Devise préférée"
            value={
              selectedCurrency
                ? `${selectedCurrency.code} — ${selectedCurrency.symbol}`
                : settings.preferences.currency
            }
            detail={
              selectedCurrency?.name ??
              settings.preferences.currency
            }
            tone="orange"
          />

          <SummaryCard
            icon={Bell}
            label="Notifications"
            value={`${notificationChannelsCount} canal${
              notificationChannelsCount > 1
                ? "aux"
                : ""
            } actif${
              notificationChannelsCount > 1
                ? "s"
                : ""
            }`}
            detail={`${notificationTypesCount} type${
              notificationTypesCount > 1
                ? "s"
                : ""
            } sélectionné${
              notificationTypesCount > 1
                ? "s"
                : ""
            }`}
            tone="blue"
          />

          <SummaryCard
            icon={TicketCheck}
            label="Billets par commande"
            value={settings.ticketing.maxTicketsPerOrder.toLocaleString(
              "fr-FR",
            )}
            detail="Limite générale configurée"
            tone="green"
          />
        </section>

        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.045] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />

            <div>
              <h2 className="text-sm font-black text-white">
                Gestion multi-devises Tikemia
              </h2>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                La devise choisie ici est la préférence générale de votre compte. Chaque événement conserve sa propre devise de vente. Les montants XOF, XAF, EUR, NGN, GHS ou autres ne sont jamais additionnés sans séparation ou conversion financière explicite.
              </p>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SettingsForm
            settings={settings}
          />

          <aside className="space-y-5 xl:sticky xl:top-[112px]">
            <AccountSecurityCard
              settings={settings}
            />

            <CurrentPreferencesCard
              settings={settings}
              selectedCurrency={
                selectedCurrency
              }
            />

            <QuickLinksCard />
          </aside>
        </section>
      </main>
    );
  } catch (error) {
    if (
      error instanceof
      GetOrganizerSettingsError
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
        <SettingsLoadError
          message={error.message}
        />
      );
    }

    console.error(
      "[ORGANIZER_SETTINGS_PAGE_ERROR]",
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
      <SettingsLoadError message="Impossible de charger vos paramètres organisateur pour le moment." />
    );
  }
}

function SettingsHeader({
  settings,
}: {
  settings: OrganizerSettingsData;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.09),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_35%)]" />

      <div className="relative flex flex-col gap-5 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-lime-400">
            <Settings2 className="h-3.5 w-3.5" />
            Configuration du compte
          </span>

          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
            Paramètres
          </h1>

          <p className="mt-2 max-w-[760px] text-sm leading-6 text-neutral-500">
            Gérez la devise préférée de votre compte,
            le fuseau horaire, les notifications, les
            règles de billetterie et la sécurité de
            votre espace organisateur Tikemia.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
            <p>
              Compte :{" "}
              <span className="font-bold text-neutral-300">
                {settings.organizer.fullName ||
                  "Organisateur Tikemia"}
              </span>
            </p>

            <p>
              Pays :{" "}
              <span className="font-bold text-neutral-300">
                {settings.organizer.countryCode}
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[390px]">
          <HeaderMetric
            icon={ShieldCheck}
            label="État du compte"
            value={
              settings.security
                .accountActive
                ? "Compte actif"
                : "Compte inactif"
            }
            valid={
              settings.security
                .accountActive
            }
          />

          <HeaderMetric
            icon={MailCheck}
            label="Adresse e-mail"
            value={
              settings.security
                .emailVerified
                ? "Vérifiée"
                : "Non vérifiée"
            }
            valid={
              settings.security
                .emailVerified
            }
          />
        </div>
      </div>
    </section>
  );
}

function countEnabledNotificationChannels(
  settings: OrganizerSettingsData,
): number {
  return [
    settings.notifications
      .emailNotifications,

    settings.notifications
      .whatsappNotifications,

    settings.notifications
      .dashboardNotifications,
  ].filter(Boolean).length;
}

function countEnabledNotificationTypes(
  settings: OrganizerSettingsData,
): number {
  return [
    settings.notifications
      .notifyTicketSales,

    settings.notifications
      .notifyPayments,

    settings.notifications
      .notifyRefunds,

    settings.notifications
      .notifyEventStatus,

    settings.notifications
      .notifySecurity,
  ].filter(Boolean).length;
}

type IconComponent =
  typeof Settings2;

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  tone:
    | "green"
    | "orange"
    | "blue";
}) {
  const styles = {
    green: {
      wrapper:
        "border-emerald-500/20 bg-emerald-500/[0.04]",

      icon:
        "border-emerald-500/25 bg-emerald-500/10 text-lime-400",

      value:
        "text-lime-400",
    },

    orange: {
      wrapper:
        "border-orange-500/20 bg-orange-500/[0.04]",

      icon:
        "border-orange-500/25 bg-orange-500/10 text-orange-400",

      value:
        "text-orange-300",
    },

    blue: {
      wrapper:
        "border-blue-500/20 bg-blue-500/[0.04]",

      icon:
        "border-blue-500/25 bg-blue-500/10 text-blue-400",

      value:
        "text-blue-300",
    },
  };

  const selected =
    styles[tone];

  return (
    <article
      className={`rounded-2xl border bg-[#081015] p-4 ${selected.wrapper}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${selected.icon}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-xl font-black tracking-[-0.03em] ${selected.value}`}
      >
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-neutral-600">
        {detail}
      </p>
    </article>
  );
}

function HeaderMetric({
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
    <article
      className={`rounded-xl border p-3.5 ${
        valid
          ? "border-emerald-500/20 bg-emerald-500/[0.06]"
          : "border-orange-500/20 bg-orange-500/[0.06]"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${
            valid
              ? "text-lime-400"
              : "text-orange-400"
          }`}
        />

        <p className="text-[10px] text-neutral-500">
          {label}
        </p>
      </div>

      <p className="mt-2 text-sm font-black text-white">
        {value}
      </p>
    </article>
  );
}

function AccountSecurityCard({
  settings,
}: {
  settings: OrganizerSettingsData;
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
        <SecurityRow
          icon={MailCheck}
          label="Adresse e-mail"
          value={
            settings.security
              .emailVerified
              ? "Vérifiée"
              : "Non vérifiée"
          }
          valid={
            settings.security
              .emailVerified
          }
        />

        <SecurityRow
          icon={ShieldCheck}
          label="Compte"
          value={
            settings.security
              .accountActive
              ? "Actif"
              : "Inactif"
          }
          valid={
            settings.security
              .accountActive
          }
        />

        <SecurityRow
          icon={Smartphone}
          label="Sessions actives"
          value={settings.security.sessionsCount.toLocaleString(
            "fr-FR",
          )}
          valid={
            settings.security
              .sessionsCount > 0
          }
        />

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />

            <div>
              <p className="text-xs font-bold text-white">
                Expiration de la session
              </p>

              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                {formatDateTime(
                  settings.security
                    .currentSessionExpiresAt,
                )}
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/organizer/settings/security"
          className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.05]"
        >
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 text-orange-400" />

            <div>
              <p className="text-xs font-bold text-white">
                Mot de passe et sessions
              </p>

              <p className="mt-0.5 text-[10px] text-neutral-600">
                Gérer la sécurité avancée
              </p>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-neutral-600" />
        </Link>
      </div>
    </section>
  );
}

function CurrentPreferencesCard({
  settings,
  selectedCurrency,
}: {
  settings: OrganizerSettingsData;
  selectedCurrency: OrganizerSettingsCurrencyOption | null;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <LayoutDashboard className="h-5 w-5 text-lime-400" />

          <h2 className="text-base font-black text-white">
            Configuration actuelle
          </h2>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <PreferenceValue
          icon={CircleDollarSign}
          label="Devise préférée"
          value={
            selectedCurrency
              ? `${selectedCurrency.name} — ${selectedCurrency.code} — ${selectedCurrency.symbol}`
              : settings.preferences.currency
          }
        />

        <PreferenceValue
          icon={Globe2}
          label="Fuseau horaire"
          value={getOptionLabel({
            value:
              settings.preferences
                .timezone,

            options:
              settings.options
                .timezones,
          })}
        />

        <PreferenceValue
          icon={CalendarClock}
          label="Format des dates"
          value={getOptionLabel({
            value:
              settings.preferences
                .dateFormat,

            options:
              settings.options
                .dateFormats,
          })}
        />

        <PreferenceValue
          icon={LayoutDashboard}
          label="Thème"
          value={getOptionLabel({
            value:
              settings.preferences
                .theme,

            options:
              settings.options
                .themes,
          })}
        />

        <PreferenceValue
          icon={TicketCheck}
          label="Transfert de billets"
          value={
            settings.ticketing
              .allowTicketTransfer
              ? "Autorisé"
              : "Désactivé"
          }
        />

        <PreferenceValue
          icon={RefreshCcw}
          label="Demandes de remboursement"
          value={
            settings.ticketing
              .allowRefundRequests
              ? "Autorisées"
              : "Désactivées"
          }
        />

        {selectedCurrency && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-orange-500/18 bg-orange-500/[0.04] p-3">
            <MiniValue
              label="Code"
              value={
                selectedCurrency.code
              }
            />

            <MiniValue
              label="Symbole"
              value={
                selectedCurrency.symbol
              }
            />

            <MiniValue
              label="Décimales"
              value={String(
                selectedCurrency.fractionDigits,
              )}
            />
          </div>
        )}

        <div className="border-t border-white/[0.07] pt-4">
          <p className="text-[10px] text-neutral-600">
            Dernière mise à jour
          </p>

          <p className="mt-1 text-xs font-bold leading-5 text-neutral-300">
            {formatDateTime(
              settings.metadata
                .updatedAt,
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function MiniValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-black text-orange-300">
        {value}
      </p>
    </div>
  );
}

function QuickLinksCard() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015]">
      <header className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Settings2 className="h-5 w-5 text-lime-400" />

          <h2 className="text-base font-black text-white">
            Accès rapides
          </h2>
        </div>
      </header>

      <div className="space-y-2 p-4">
        <QuickLink
          href="/organizer/profile"
          icon={ShieldCheck}
          title="Profil organisateur"
          description="Modifier vos informations"
        />

        <QuickLink
          href="/organizer/events"
          icon={TicketCheck}
          title="Mes événements"
          description="Gérer vos événements"
        />

        <QuickLink
          href="/organizer/support"
          icon={MailCheck}
          title="Support Tikemia"
          description="Obtenir de l’aide"
        />

        <QuickLink
          href="/privacy-policy"
          icon={LockKeyhole}
          title="Confidentialité"
          description="Consulter la politique"
        />
      </div>
    </section>
  );
}

function SecurityRow({
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

function PreferenceValue({
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

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: IconComponent;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.05]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-lime-400" />

        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">
            {title}
          </p>

          <p className="mt-0.5 truncate text-[10px] text-neutral-600">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
    </Link>
  );
}

function SettingsLoadError({
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
              Paramètres indisponibles
            </h1>

            <p className="mt-1.5 text-sm leading-6 text-neutral-500">
              Vos paramètres organisateur n’ont pas
              pu être chargés.
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
              href="/organizer/settings"
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