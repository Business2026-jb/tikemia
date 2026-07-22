"use client";

import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Globe2,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  RefreshCcw,
  Save,
  ShieldCheck,
  Smartphone,
  TicketCheck,
  TicketPlus,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ComponentType,
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";

import type {
  OrganizerSettingsCurrencyOption,
  OrganizerSettingsData,
  OrganizerSettingsOption,
} from "@/lib/organizer/get-organizer-settings";

type SettingsFormProps = {
  settings: OrganizerSettingsData;
};

type SettingsFormState = {
  preferences: {
    language: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    theme: string;
  };

  notifications: {
    emailNotifications: boolean;
    whatsappNotifications: boolean;
    dashboardNotifications: boolean;

    notifyTicketSales: boolean;
    notifyPayments: boolean;
    notifyRefunds: boolean;
    notifyEventStatus: boolean;
    notifySecurity: boolean;
  };

  ticketing: {
    maxTicketsPerOrder: string;
    showRemainingTickets: boolean;
    allowTicketTransfer: boolean;
    allowRefundRequests: boolean;
  };
};

type SettingsApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  fields?: Record<string, string[]>;

  data?: {
    settings?: {
      preferences: {
        language: string;
        currency: string;
        timezone: string;
        dateFormat: string;
        theme: string;
      };

      notifications: {
        emailNotifications: boolean;
        whatsappNotifications: boolean;
        dashboardNotifications: boolean;

        notifyTicketSales: boolean;
        notifyPayments: boolean;
        notifyRefunds: boolean;
        notifyEventStatus: boolean;
        notifySecurity: boolean;
      };

      ticketing: {
        maxTicketsPerOrder: number;
        showRemainingTickets: boolean;
        allowTicketTransfer: boolean;
        allowRefundRequests: boolean;
      };

      metadata: {
        settingsId: string;
        updatedAt: string;
      };
    };
  };
};

type IconComponent = ComponentType<{
  className?: string;
}>;

const inputClassName =
  "h-12 w-full rounded-xl border border-white/[0.1] bg-[#050b0f] px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50";

function createInitialState(
  settings: OrganizerSettingsData,
): SettingsFormState {
  return {
    preferences: {
      language:
        settings.preferences.language,

      currency:
        settings.preferences.currency,

      timezone:
        settings.preferences.timezone,

      dateFormat:
        settings.preferences.dateFormat,

      theme:
        settings.preferences.theme,
    },

    notifications: {
      emailNotifications:
        settings.notifications
          .emailNotifications,

      whatsappNotifications:
        settings.notifications
          .whatsappNotifications,

      dashboardNotifications:
        settings.notifications
          .dashboardNotifications,

      notifyTicketSales:
        settings.notifications
          .notifyTicketSales,

      notifyPayments:
        settings.notifications
          .notifyPayments,

      notifyRefunds:
        settings.notifications
          .notifyRefunds,

      notifyEventStatus:
        settings.notifications
          .notifyEventStatus,

      notifySecurity:
        settings.notifications
          .notifySecurity,
    },

    ticketing: {
      maxTicketsPerOrder: String(
        settings.ticketing
          .maxTicketsPerOrder,
      ),

      showRemainingTickets:
        settings.ticketing
          .showRemainingTickets,

      allowTicketTransfer:
        settings.ticketing
          .allowTicketTransfer,

      allowRefundRequests:
        settings.ticketing
          .allowRefundRequests,
    },
  };
}

function normalizeSettingsState(
  state: SettingsFormState,
): string {
  return JSON.stringify({
    preferences:
      state.preferences,

    notifications:
      state.notifications,

    ticketing: {
      ...state.ticketing,

      maxTicketsPerOrder:
        Number(
          state.ticketing
            .maxTicketsPerOrder,
        ),
    },
  });
}

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
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default function SettingsForm({
  settings,
}: SettingsFormProps) {
  const router = useRouter();

  const initialState = useMemo(
    () =>
      createInitialState(
        settings,
      ),
    [settings],
  );

  const [form, setForm] =
    useState<SettingsFormState>(
      initialState,
    );

  const [
    savedState,
    setSavedState,
  ] = useState<SettingsFormState>(
    initialState,
  );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<
    Record<string, string[]>
  >({});

  const hasChanges = useMemo(
    () =>
      normalizeSettingsState(
        form,
      ) !==
      normalizeSettingsState(
        savedState,
      ),
    [form, savedState],
  );

  const selectedCurrency =
    useMemo(
      () =>
        settings.options.currencies.find(
          (currency) =>
            currency.value ===
            form.preferences.currency,
        ) ?? null,
      [
        form.preferences.currency,
        settings.options.currencies,
      ],
    );

  const enabledNotificationChannels =
    useMemo(() => {
      return [
        form.notifications
          .emailNotifications,

        form.notifications
          .whatsappNotifications,

        form.notifications
          .dashboardNotifications,
      ].filter(Boolean).length;
    }, [form.notifications]);

  const enabledNotificationTypes =
    useMemo(() => {
      return [
        form.notifications
          .notifyTicketSales,

        form.notifications
          .notifyPayments,

        form.notifications
          .notifyRefunds,

        form.notifications
          .notifyEventStatus,

        form.notifications
          .notifySecurity,
      ].filter(Boolean).length;
    }, [form.notifications]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
    setFieldErrors({});
  }

  function updatePreference(
    key: keyof SettingsFormState["preferences"],
    value: string,
  ) {
    clearMessages();

    setForm((current) => ({
      ...current,

      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }

  function updateNotification(
    key: keyof SettingsFormState["notifications"],
    value: boolean,
  ) {
    clearMessages();

    setForm((current) => ({
      ...current,

      notifications: {
        ...current.notifications,
        [key]: value,
      },
    }));
  }

  function updateTicketing<
    K extends keyof SettingsFormState["ticketing"],
  >(
    key: K,
    value: SettingsFormState["ticketing"][K],
  ) {
    clearMessages();

    setForm((current) => ({
      ...current,

      ticketing: {
        ...current.ticketing,
        [key]: value,
      },
    }));
  }

  function resetForm() {
    clearMessages();
    setForm(savedState);
  }

  function validateForm():
    | string
    | null {
    const maxTicketsPerOrder =
      Number(
        form.ticketing
          .maxTicketsPerOrder,
      );

    const currencyExists =
      settings.options.currencies.some(
        (currency) =>
          currency.value ===
          form.preferences.currency,
      );

    if (!currencyExists) {
      return "Sélectionnez une devise disponible sur Tikemia.";
    }

    const timezoneExists =
      settings.options.timezones.some(
        (timezone) =>
          timezone.value ===
          form.preferences.timezone,
      );

    if (!timezoneExists) {
      return "Sélectionnez un fuseau horaire disponible sur Tikemia.";
    }

    if (
      !Number.isInteger(
        maxTicketsPerOrder,
      ) ||
      maxTicketsPerOrder < 1 ||
      maxTicketsPerOrder > 100
    ) {
      return "La limite de billets par commande doit être comprise entre 1 et 100.";
    }

    if (
      enabledNotificationTypes > 0 &&
      enabledNotificationChannels === 0
    ) {
      return "Activez au moins un canal de notification ou désactivez tous les types de notifications.";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      !hasChanges
    ) {
      return;
    }

    clearMessages();

    const validationError =
      validateForm();

    if (validationError) {
      setError(
        validationError,
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/organizer/settings/update",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              preferences: {
                language:
                  form.preferences
                    .language,

                currency:
                  form.preferences
                    .currency,

                timezone:
                  form.preferences
                    .timezone,

                dateFormat:
                  form.preferences
                    .dateFormat,

                theme:
                  form.preferences
                    .theme,
              },

              notifications: {
                emailNotifications:
                  form.notifications
                    .emailNotifications,

                whatsappNotifications:
                  form.notifications
                    .whatsappNotifications,

                dashboardNotifications:
                  form.notifications
                    .dashboardNotifications,

                notifyTicketSales:
                  form.notifications
                    .notifyTicketSales,

                notifyPayments:
                  form.notifications
                    .notifyPayments,

                notifyRefunds:
                  form.notifications
                    .notifyRefunds,

                notifyEventStatus:
                  form.notifications
                    .notifyEventStatus,

                notifySecurity:
                  form.notifications
                    .notifySecurity,
              },

              ticketing: {
                maxTicketsPerOrder:
                  Number(
                    form.ticketing
                      .maxTicketsPerOrder,
                  ),

                showRemainingTickets:
                  form.ticketing
                    .showRemainingTickets,

                allowTicketTransfer:
                  form.ticketing
                    .allowTicketTransfer,

                allowRefundRequests:
                  form.ticketing
                    .allowRefundRequests,
              },
            }),
          },
        );

      let result: SettingsApiResponse =
        {};

      try {
        result =
          (await response.json()) as SettingsApiResponse;
      } catch {
        result = {};
      }

      if (
        !response.ok ||
        !result.success
      ) {
        setFieldErrors(
          result.fields ?? {},
        );

        throw new Error(
          result.message ??
            "Impossible d’enregistrer vos paramètres.",
        );
      }

      const updatedSettings =
        result.data?.settings;

      if (updatedSettings) {
        const nextState: SettingsFormState = {
          preferences: {
            language:
              updatedSettings.preferences.language,

            currency:
              updatedSettings.preferences.currency,

            timezone:
              updatedSettings.preferences.timezone,

            dateFormat:
              updatedSettings.preferences.dateFormat,

            theme:
              updatedSettings.preferences.theme,
          },

          notifications: {
            emailNotifications:
              updatedSettings.notifications.emailNotifications,

            whatsappNotifications:
              updatedSettings.notifications.whatsappNotifications,

            dashboardNotifications:
              updatedSettings.notifications.dashboardNotifications,

            notifyTicketSales:
              updatedSettings.notifications.notifyTicketSales,

            notifyPayments:
              updatedSettings.notifications.notifyPayments,

            notifyRefunds:
              updatedSettings.notifications.notifyRefunds,

            notifyEventStatus:
              updatedSettings.notifications.notifyEventStatus,

            notifySecurity:
              updatedSettings.notifications.notifySecurity,
          },

          ticketing: {
            maxTicketsPerOrder:
              String(
                updatedSettings.ticketing.maxTicketsPerOrder,
              ),

            showRemainingTickets:
              updatedSettings.ticketing.showRemainingTickets,

            allowTicketTransfer:
              updatedSettings.ticketing.allowTicketTransfer,

            allowRefundRequests:
              updatedSettings.ticketing.allowRefundRequests,
          },
        };

        setForm(nextState);
        setSavedState(nextState);
      } else {
        setSavedState(form);
      }

      setSuccessMessage(
        result.message ??
          "Vos paramètres ont été enregistrés avec succès.",
      );

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d’enregistrer vos paramètres.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-6 text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />

          <span>
            {successMessage}
          </span>
        </div>
      )}

      <SettingsSection
        icon={Globe2}
        title="Préférences générales"
        description="Personnalisez l’affichage de votre espace organisateur."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Langue"
            icon={Languages}
            value={
              form.preferences
                .language
            }
            options={
              settings.options
                .languages
            }
            error={
              fieldErrors[
                "preferences.language"
              ]?.[0]
            }
            onChange={(value) =>
              updatePreference(
                "language",
                value,
              )
            }
          />

          <CurrencySelectField
            value={
              form.preferences
                .currency
            }
            options={
              settings.options
                .currencies
            }
            selectedCurrency={
              selectedCurrency
            }
            error={
              fieldErrors[
                "preferences.currency"
              ]?.[0]
            }
            onChange={(value) =>
              updatePreference(
                "currency",
                value,
              )
            }
          />

          <SelectField
            label="Fuseau horaire"
            icon={Globe2}
            value={
              form.preferences
                .timezone
            }
            options={
              settings.options
                .timezones
            }
            error={
              fieldErrors[
                "preferences.timezone"
              ]?.[0]
            }
            onChange={(value) =>
              updatePreference(
                "timezone",
                value,
              )
            }
          />

          <SelectField
            label="Format des dates"
            icon={CalendarDays}
            value={
              form.preferences
                .dateFormat
            }
            options={
              settings.options
                .dateFormats
            }
            error={
              fieldErrors[
                "preferences.dateFormat"
              ]?.[0]
            }
            onChange={(value) =>
              updatePreference(
                "dateFormat",
                value,
              )
            }
          />

          <SelectField
            label="Thème"
            icon={LayoutDashboard}
            value={
              form.preferences
                .theme
            }
            options={
              settings.options
                .themes
            }
            error={
              fieldErrors[
                "preferences.theme"
              ]?.[0]
            }
            onChange={(value) =>
              updatePreference(
                "theme",
                value,
              )
            }
            className="md:col-span-2"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/[0.045] p-4">
          <div className="flex items-start gap-3">
            <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />

            <div>
              <p className="text-sm font-black text-white">
                Devise préférée du compte
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Cette devise sert de valeur proposée par défaut dans votre espace organisateur. Elle ne convertit pas les événements existants et ne modifie jamais la devise d’un événement ayant déjà des ventes.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Bell}
        title="Canaux de notification"
        description="Choisissez où Tikemia doit vous envoyer les informations importantes."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <ToggleCard
            icon={Mail}
            title="E-mail"
            description="Recevoir les alertes par courrier électronique."
            checked={
              form.notifications
                .emailNotifications
            }
            onChange={(checked) =>
              updateNotification(
                "emailNotifications",
                checked,
              )
            }
          />

          <ToggleCard
            icon={Smartphone}
            title="WhatsApp"
            description="Recevoir les notifications importantes sur WhatsApp."
            checked={
              form.notifications
                .whatsappNotifications
            }
            onChange={(checked) =>
              updateNotification(
                "whatsappNotifications",
                checked,
              )
            }
          />

          <ToggleCard
            icon={LayoutDashboard}
            title="Dashboard"
            description="Afficher les notifications dans l’espace organisateur."
            checked={
              form.notifications
                .dashboardNotifications
            }
            onChange={(checked) =>
              updateNotification(
                "dashboardNotifications",
                checked,
              )
            }
          />
        </div>

        <p className="mt-4 text-xs text-neutral-600">
          {enabledNotificationChannels} canal
          {enabledNotificationChannels > 1
            ? "aux"
            : ""}{" "}
          actif
          {enabledNotificationChannels > 1
            ? "s"
            : ""}
        </p>
      </SettingsSection>

      <SettingsSection
        icon={Bell}
        title="Types de notification"
        description="Sélectionnez les événements pour lesquels vous souhaitez être averti."
      >
        <div className="space-y-3">
          <ToggleRow
            icon={TicketCheck}
            title="Ventes de billets"
            description="Recevoir une alerte lorsqu’un billet est vendu."
            checked={
              form.notifications
                .notifyTicketSales
            }
            onChange={(checked) =>
              updateNotification(
                "notifyTicketSales",
                checked,
              )
            }
          />

          <ToggleRow
            icon={WalletCards}
            title="Paiements reçus"
            description="Être informé après la confirmation d’un paiement."
            checked={
              form.notifications
                .notifyPayments
            }
            onChange={(checked) =>
              updateNotification(
                "notifyPayments",
                checked,
              )
            }
          />

          <ToggleRow
            icon={RefreshCcw}
            title="Demandes de remboursement"
            description="Recevoir une alerte lorsqu’un client demande un remboursement."
            checked={
              form.notifications
                .notifyRefunds
            }
            onChange={(checked) =>
              updateNotification(
                "notifyRefunds",
                checked,
              )
            }
          />

          <ToggleRow
            icon={UserRoundCheck}
            title="Statut des événements"
            description="Être averti lorsqu’un événement est validé, refusé ou suspendu."
            checked={
              form.notifications
                .notifyEventStatus
            }
            onChange={(checked) =>
              updateNotification(
                "notifyEventStatus",
                checked,
              )
            }
          />

          <ToggleRow
            icon={ShieldCheck}
            title="Alertes de sécurité"
            description="Recevoir les informations importantes concernant votre compte."
            checked={
              form.notifications
                .notifySecurity
            }
            onChange={(checked) =>
              updateNotification(
                "notifySecurity",
                checked,
              )
            }
          />
        </div>

        <p className="mt-4 text-xs text-neutral-600">
          {enabledNotificationTypes} type
          {enabledNotificationTypes > 1
            ? "s"
            : ""}{" "}
          de notification actif
          {enabledNotificationTypes > 1
            ? "s"
            : ""}
        </p>
      </SettingsSection>

      <SettingsSection
        icon={TicketPlus}
        title="Paramètres de billetterie"
        description="Définissez les règles générales appliquées à vos ventes de billets."
      >
        <div className="space-y-4">
          <Field
            label="Nombre maximal de billets par commande"
            helper="Entre 1 et 100 billets."
            error={
              fieldErrors[
                "ticketing.maxTicketsPerOrder"
              ]?.[0]
            }
          >
            <input
              type="number"
              min={1}
              max={100}
              value={
                form.ticketing
                  .maxTicketsPerOrder
              }
              onChange={(event) =>
                updateTicketing(
                  "maxTicketsPerOrder",
                  event.target.value,
                )
              }
              inputMode="numeric"
              className={inputClassName}
            />
          </Field>

          <div className="space-y-3">
            <ToggleRow
              icon={TicketCheck}
              title="Afficher les places restantes"
              description="Montrer aux acheteurs le nombre de billets encore disponibles."
              checked={
                form.ticketing
                  .showRemainingTickets
              }
              onChange={(checked) =>
                updateTicketing(
                  "showRemainingTickets",
                  checked,
                )
              }
            />

            <ToggleRow
              icon={TicketPlus}
              title="Autoriser le transfert de billets"
              description="Permettre aux clients de transférer leurs billets à une autre personne."
              checked={
                form.ticketing
                  .allowTicketTransfer
              }
              onChange={(checked) =>
                updateTicketing(
                  "allowTicketTransfer",
                  checked,
                )
              }
            />

            <ToggleRow
              icon={RefreshCcw}
              title="Autoriser les demandes de remboursement"
              description="Permettre aux clients d’envoyer une demande de remboursement."
              checked={
                form.ticketing
                  .allowRefundRequests
              }
              onChange={(checked) =>
                updateTicketing(
                  "allowRefundRequests",
                  checked,
                )
              }
            />
          </div>
        </div>
      </SettingsSection>

      <section className="rounded-2xl border border-white/[0.08] bg-[#081015] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Dernière mise à jour
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {formatDateTime(
                settings.metadata
                  .updatedAt,
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-lime-400" />

            <span className="text-xs font-semibold text-neutral-400">
              Paramètres sécurisés
            </span>
          </div>
        </div>
      </section>

      <section className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/[0.09] bg-[#050b0f]/95 p-3 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="hidden lg:block">
          <p className="text-xs font-bold text-white">
            Paramètres organisateur
          </p>

          <p className="mt-1 text-[11px] text-neutral-600">
            {hasChanges
              ? "Des modifications attendent d’être enregistrées."
              : "Tous vos paramètres sont à jour."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={resetForm}
            disabled={
              isSubmitting ||
              !hasChanges
            }
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-bold text-neutral-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Annuler les modifications
          </button>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasChanges
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_14px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {isSubmitting
              ? "Enregistrement..."
              : "Enregistrer les paramètres"}
          </button>
        </div>
      </section>
    </form>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <header className="flex items-start gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
          <Icon className="h-[18px] w-[18px] text-lime-400" />
        </div>

        <div>
          <h2 className="text-base font-black text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-300">
          {label}
        </span>

        {helper && (
          <span className="text-[10px] text-neutral-600">
            {helper}
          </span>
        )}
      </span>

      {children}

      {error && (
        <span className="mt-2 block text-xs leading-5 text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

function SelectField({
  label,
  icon: Icon,
  value,
  options,
  error,
  className = "",
  onChange,
}: {
  label: string;
  icon: IconComponent;
  value: string;
  options: OrganizerSettingsOption[];
  error?: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label={label}
      error={error}
    >
      <div className={`relative ${className}`}>
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={`${inputClassName} appearance-none pl-11 pr-11`}
        >
          {options.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>

        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
      </div>
    </Field>
  );
}

function CurrencySelectField({
  value,
  options,
  selectedCurrency,
  error,
  onChange,
}: {
  value: string;
  options: OrganizerSettingsCurrencyOption[];
  selectedCurrency: OrganizerSettingsCurrencyOption | null;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label="Devise d’affichage"
      error={error}
    >
      <div className="relative">
        <CircleDollarSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={`${inputClassName} appearance-none pl-11 pr-11`}
        >
          {options.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>

        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
      </div>

      {selectedCurrency && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <CurrencyDetail
            label="Code ISO"
            value={
              selectedCurrency.code
            }
          />

          <CurrencyDetail
            label="Symbole"
            value={
              selectedCurrency.symbol
            }
          />

          <CurrencyDetail
            label="Décimales"
            value={String(
              selectedCurrency.fractionDigits,
            )}
          />
        </div>
      )}
    </Field>
  );
}

function CurrencyDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] text-neutral-600">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-black text-neutral-300">
        {value}
      </p>
    </div>
  );
}

function ToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-2xl border p-4 transition ${
        checked
          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        className="peer sr-only"
      />

      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
            checked
              ? "border-emerald-500/25 bg-emerald-500/10"
              : "border-white/[0.08] bg-white/[0.03]"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              checked
                ? "text-lime-400"
                : "text-neutral-500"
            }`}
          />
        </div>

        <ToggleSwitch
          checked={checked}
        />
      </div>

      <p className="mt-4 text-sm font-black text-white">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        {description}
      </p>
    </label>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        className="peer sr-only"
      />

      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            checked
              ? "border-emerald-500/25 bg-emerald-500/10"
              : "border-white/[0.08] bg-white/[0.03]"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              checked
                ? "text-lime-400"
                : "text-neutral-500"
            }`}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-white">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </div>

      <ToggleSwitch
        checked={checked}
      />
    </label>
  );
}

function ToggleSwitch({
  checked,
}: {
  checked: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked
          ? "bg-emerald-500"
          : "bg-neutral-700"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
          checked
            ? "translate-x-6"
            : "translate-x-1"
        }`}
      />
    </span>
  );
}