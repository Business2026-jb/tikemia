
"use client";
import {
  currencySymbol,
  SUPPORTED_CURRENCIES,
  currencyLabel,
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";




import Image from "next/image";

import OrganizerAvatar from "@/components/organizer/OrganizerAvatar";

import { useRouter } from "next/navigation";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  Bell,
  Bitcoin,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Globe2,
  Info,
  Landmark,
  MoreVertical,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import {
  Icon,
} from "@iconify/react";

import {
  getWithdrawalProviderLogo,
  getMobileMoneyProvider,
  normalizeWithdrawalPhone,
  getWithdrawalCountries,
  getCountryCurrency,
  type WithdrawalMethodType,
} from "@/lib/withdrawal-providers";



/* ==========================================================
   TIKEMIA — PARAMÈTRES ORGANISATEUR

   Fichier :
   src/app/organizer/dashboard/settings/page.tsx

   Sections :
   - Profil
   - Moyens de retrait
   - Sécurité
   - Notifications
   - Langue

   API :
   GET/PATCH /api/organizer/settings/profile

   GET/POST
   /api/organizer/settings/withdrawal-methods

   PATCH/DELETE
   /api/organizer/settings/withdrawal-methods/[id]

   GET
   /api/organizer/settings/withdrawal-providers

   PATCH
   /api/organizer/settings/security/password

   GET/PATCH
   /api/organizer/settings/notifications

   Compatible :
   - Next.js App Router
   - TypeScript
   - Tailwind CSS 4
   - Lucide React
   - Iconify
   - Français / Anglais
   - PC / Tablette / Mobile

   Le layout du dashboard TIKEMIA
   fournit déjà le menu principal.
========================================================== */

/* ==========================================================
   ROUTES
========================================================== */

const API = {
  profile:
    "/api/organizer/settings/profile",

  methods:
    "/api/organizer/settings/withdrawal-methods",

  providers:
    "/api/organizer/settings/withdrawal-providers",

  password:
    "/api/organizer/settings/security/password",

  notifications:
    "/api/organizer/settings/notifications",
} as const;

/* ==========================================================
   TYPES
========================================================== */

type Section =
  | "profile"
  | "withdrawals"
  | "security"
  | "notifications"
  | "language";

type JsonRecord = Record<string, unknown>;

type Notice = {
  type: "success" | "error";
  message: string;
};

type ProfileData = {
  hasPassword: boolean;
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
  countryCode: string;
  organizationId: string;
  organizationName: string;
  organizationPhoneE164: string;
  organizationCountryCode: string;
  organizationCity: string;
};

type CountryOption = {
  code: string;
  name: string;
  flag: string;
  callingCode: string;
};

type ProviderOption = {
  logoUrl: string | null;
  code: string;
  name: string;
  shortName: string;
  icon: string;
  available: boolean;
};

type NetworkOption = {
  code: string;
  name: string;
  assetCode: string;
  available: boolean;
};

type ProviderCatalog = {
  mobileMoney: ProviderOption[];
  crypto: ProviderOption[];
  cryptoNetworks: NetworkOption[];
  bankAvailable: boolean;
  anyAvailable: boolean;
};

type Destination = {
  id: string;
  organizationId: string;
  type: WithdrawalMethodType;
  provider: string;
  accountName: string;
  maskedAccountRef: string;
  countryCode: string;
  currency: string;
  label: string;
  bankName: string;
  assetCode: string;
  networkCode: string;
  isDefault: boolean;
  isVerified: boolean;
};

type MethodForm = {
  type: WithdrawalMethodType;
  countryCode: string;
  currency: string;
  provider: string;
  accountName: string;
  reference: string;
  bic: string;
  routingCode: string;
  bankName: string;
  assetCode: string;
  networkCode: string;
  label: string;
  isDefault: boolean;
  currentPassword: string;
};

const NOTIFICATION_KEYS = [
  "emailTicketSales",
  "emailDonations",
  "emailPayouts",
  "emailEvents",
  "emailCampaigns",

  "inAppTicketSales",
  "inAppDonations",
  "inAppPayouts",
  "inAppEvents",
  "inAppCampaigns",
] as const;

type NotificationKey =
  (typeof NOTIFICATION_KEYS)[number];

type NotificationPreferences =
  Record<NotificationKey, boolean>;

/* ==========================================================
   VALEURS INITIALES
========================================================== */

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  emailTicketSales: true,
  emailDonations: true,
  emailPayouts: true,
  emailEvents: true,
  emailCampaigns: true,

  inAppTicketSales: true,
  inAppDonations: true,
  inAppPayouts: true,
  inAppEvents: true,
  inAppCampaigns: true,
};

const EMPTY_PROFILE: ProfileData = {
  hasPassword: false,
  id: "",
  firstName: "",
  lastName: "",
  fullName: "",
  email: "",
  phoneE164: "",
  countryCode: "",
  organizationId: "",
  organizationName: "",
  organizationPhoneE164: "",
  organizationCountryCode: "",
  organizationCity: "",
};

const EMPTY_CATALOG: ProviderCatalog = {
  mobileMoney: [],
  crypto: [],
  cryptoNetworks: [],
  bankAvailable: false,
  anyAvailable: false,
};

function initialMethodForm(
  countryCode = ""
): MethodForm {
  return {
    type: "MOBILE_MONEY",
    countryCode,
    currency: getCountryCurrency(countryCode) ?? "XOF",
    provider: "",
    accountName: "",
    reference: "",
    bic: "",
    routingCode: "",
    bankName: "",
    assetCode: "USDT",
    networkCode: "TRC20",
    label: "",
    isDefault: false,
    currentPassword: "",
  };
}

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    title: "Paramètres",
    subtitle:
      "Gérez votre compte et vos préférences TIKEMIA.",

    profile: "Profil",
    withdrawals: "Moyens de retrait",
    security: "Sécurité",
    notifications: "Notifications",
    language: "Langue",

    profileSubtitle:
      "Mettez à jour vos informations personnelles et professionnelles.",

    firstName: "Prénom",
    lastName: "Nom",
    email: "Adresse email",
    emailLocked: "Cette adresse email ne peut pas être modifiée.",
    phone: "Téléphone",
    country: "Pays",
    city: "Ville",
    organization: "Nom de l'organisation",
    organizationPhone: "Téléphone de l'organisation",
    organizationCountry: "Pays de l'organisation",

    save: "Enregistrer les modifications",
    saving: "Enregistrement...",
    saved: "Modifications enregistrées.",
    loading: "Chargement des paramètres...",
    loadError: "Impossible de charger les informations.",
    retry: "Réessayer",
    refresh: "Actualiser",

    withdrawalTitle: "Mes moyens de retrait",
    withdrawalSubtitle:
      "Enregistrez vos coordonnées pour vos futurs retraits TIKEMIA.",

    addMethod: "Ajouter un moyen de retrait",
    cancel: "Annuler",
    edit: "Modifier",
    remove: "Supprimer",
    setDefault: "Définir par défaut",
    default: "Par défaut",
    verified: "Vérifié",
    notVerified: "En attente de vérification",
    noMethods: "Aucun moyen de retrait enregistré.",
    methodSaved: "Moyen de retrait enregistré.",
    methodChanged: "Moyen de retrait modifié.",
    methodRemoved: "Moyen de retrait retiré.",
    confirmRemove:
      "Voulez-vous retirer ce moyen de retrait ? Son historique financier sera conservé.",

    mobileMoney: "Mobile Money",
    bank: "Compte bancaire",
    crypto: "Cryptomonnaie",

    provider: "Opérateur",
    holder: "Nom du titulaire",
    bankName: "Nom de la banque",
    accountReference: "Numéro de compte ou IBAN",
    mobileNumber: "Numéro Mobile Money",
    walletAddress: "Adresse du portefeuille",
    bic: "Code BIC / SWIFT",
    routingCode: "Code bancaire local (si nécessaire)",
    currency: "Devise",
    asset: "Cryptomonnaie",
    network: "Réseau blockchain",
    label: "Nom du moyen de retrait",
    defaultChoice: "Définir comme moyen principal",
    savedAccount: "Compte enregistré",
    newAccount: "Nouvelles coordonnées",
    

    currentPassword: "Mot de passe actuel",
    passwordForMethod:
      "Mot de passe actuel (obligatoire pour ajouter ou modifier les coordonnées)",

    passwordTitle: "Modifier mon mot de passe",
    passwordSubtitle:
      "Protégez l'accès à votre compte organisateur.",

    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    changePassword: "Mettre à jour le mot de passe",

    notificationsSubtitle:
      "Choisissez les notifications facultatives que vous souhaitez recevoir.",

    byEmail: "Par email",
    inApp: "Dans TIKEMIA",

    sales: "Ventes de billets",
    donations: "Dons reçus",
    payouts: "Retraits et paiements",
    events: "Événements",
    campaigns: "Cagnottes",

    securityAlerts:
      "Les alertes importantes de sécurité restent actives.",

    languageSubtitle:
      "Choisissez la langue de votre espace organisateur.",
    french: "Français",
    english: "English",
    languageSaved: "Langue enregistrée.",

    

    selectCountry: "Sélectionner un pays",
    selectProvider: "Sélectionner un opérateur",
    selectNetwork: "Sélectionner un réseau",
    selectCurrency: "Sélectionner une devise",

    required: "Complétez les champs obligatoires.",
    chooseProvider: "Choisissez un opérateur.",
    operationFailed: "L'opération a échoué. Réessayez.",
    
    manageMethod: "Gérer ce moyen",
  },

  en: {
    title: "Settings",
    subtitle:
      "Manage your TIKEMIA account and preferences.",

    profile: "Profile",
    withdrawals: "Withdrawal methods",
    security: "Security",
    notifications: "Notifications",
    language: "Language",

    profileSubtitle:
      "Update your personal and organization information.",

    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    emailLocked: "This email address cannot be changed.",
    phone: "Phone number",
    country: "Country",
    city: "City",
    organization: "Organization name",
    organizationPhone: "Organization phone",
    organizationCountry: "Organization country",

    save: "Save changes",
    saving: "Saving...",
    saved: "Changes saved.",
    loading: "Loading settings...",
    loadError: "Unable to load information.",
    retry: "Try again",
    refresh: "Refresh",

    withdrawalTitle: "My withdrawal methods",
    withdrawalSubtitle:
      "Save your details for future TIKEMIA payouts.",

    addMethod: "Add withdrawal method",
    cancel: "Cancel",
    edit: "Edit",
    remove: "Remove",
    setDefault: "Set as default",
    default: "Default",
    verified: "Verified",
    notVerified: "Verification pending",
    noMethods: "No withdrawal methods saved.",
    methodSaved: "Withdrawal method saved.",
    methodChanged: "Withdrawal method updated.",
    methodRemoved: "Withdrawal method removed.",
    confirmRemove:
      "Remove this withdrawal method? Its financial history will be preserved.",

    mobileMoney: "Mobile Money",
    bank: "Bank account",
    crypto: "Cryptocurrency",

    provider: "Provider",
    holder: "Account holder",
    bankName: "Bank name",
    accountReference: "Account number or IBAN",
    mobileNumber: "Mobile Money number",
    walletAddress: "Wallet address",
    bic: "BIC / SWIFT",
    routingCode: "Local routing code (if required)",
    currency: "Currency",
    asset: "Cryptocurrency",
    network: "Blockchain network",
    label: "Withdrawal method label",
    defaultChoice: "Set as primary method",
    savedAccount: "Saved account",
    newAccount: "New account details",
    

    currentPassword: "Current password",
    passwordForMethod:
      "Current password (required to add or change account details)",

    passwordTitle: "Change my password",
    passwordSubtitle:
      "Protect access to your organizer account.",

    newPassword: "New password",
    confirmPassword: "Confirm new password",
    changePassword: "Update password",

    notificationsSubtitle:
      "Choose which optional notifications you want to receive.",

    byEmail: "By email",
    inApp: "In TIKEMIA",

    sales: "Ticket sales",
    donations: "Donations received",
    payouts: "Payouts and payments",
    events: "Events",
    campaigns: "Fundraisers",

    securityAlerts:
      "Important security alerts always remain enabled.",

    languageSubtitle:
      "Choose your organizer dashboard language.",
    french: "Français",
    english: "English",
    languageSaved: "Language saved.",

    

    selectCountry: "Select a country",
    selectProvider: "Select a provider",
    selectNetwork: "Select a network",
    selectCurrency: "Select a currency",

    required: "Please complete the required fields.",
    chooseProvider: "Choose a provider.",
    operationFailed: "The operation failed. Try again.",
    
    manageMethod: "Manage this method",
  },
} as const;

/* ==========================================================
   UTILITAIRES JSON
========================================================== */

function record(value: unknown): JsonRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string" ? value : fallback;
}

function boolValue(
  value: unknown,
  fallback = false
): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isMethodType(
  value: unknown
): value is WithdrawalMethodType {
  return (
    value === "MOBILE_MONEY" ||
    value === "BANK_ACCOUNT" ||
    value === "CRYPTO"
  );
}

function normalizeProfile(value: unknown): ProfileData {
  const data = record(value);

  return {
    id: stringValue(data.id),
    hasPassword: data.hasPassword === true,
    firstName: stringValue(data.firstName),
    lastName: stringValue(data.lastName),
    fullName: stringValue(data.fullName),
    email: stringValue(data.email),
    phoneE164: stringValue(data.phoneE164),
    countryCode: stringValue(data.countryCode),
    organizationId: stringValue(data.organizationId),
    organizationName: stringValue(data.organizationName),
    organizationPhoneE164: stringValue(
      data.organizationPhoneE164
    ),
    organizationCountryCode: stringValue(
      data.organizationCountryCode
    ),
    organizationCity: stringValue(
      data.organizationCity
    ),
  };
}

function normalizeDestination(value: unknown): Destination | null {
  const data = record(value);

  if (
    typeof data.id !== "string" ||
    !isMethodType(data.type)
  ) {
    return null;
  }

  return {
    id: data.id,
    organizationId: stringValue(data.organizationId),
    type: data.type,
    provider: stringValue(data.provider),
    accountName: stringValue(data.accountName),
    maskedAccountRef: stringValue(data.maskedAccountRef),
    countryCode: stringValue(data.countryCode),
    currency: stringValue(data.currency),
    label: stringValue(data.label),
    bankName: stringValue(data.bankName),
    assetCode: stringValue(data.assetCode),
    networkCode: stringValue(data.networkCode),
    isDefault: boolValue(data.isDefault),
    isVerified: boolValue(data.isVerified),
  };
}

function normalizeProvider(
  value: unknown
): ProviderOption {
  const data = record(value);

  return {
    code: stringValue(data.code),
    name: stringValue(data.name),
    shortName: stringValue(data.shortName),
    logoUrl: getWithdrawalProviderLogo(stringValue(data.code)),
    icon: stringValue(data.icon, "lucide:smartphone"),
    available: boolValue(data.available),
  };
}

function normalizeCatalog(value: unknown): ProviderCatalog {
  const data = record(value);
  const bank = record(data.bank);
  const availability = record(data.availability);

  const networks = Array.isArray(data.cryptoNetworks)
    ? data.cryptoNetworks.map((entry) => {
        const item = record(entry);
        return {
          code: stringValue(item.code),
          name: stringValue(item.name),
          assetCode: stringValue(item.assetCode),
          available: boolValue(item.available),
        };
      })
    : [];

  return {
    mobileMoney: Array.isArray(data.mobileMoney)
      ? data.mobileMoney.map(normalizeProvider)
      : [],

    crypto: Array.isArray(data.crypto)
      ? data.crypto.map(normalizeProvider)
      : [],

    cryptoNetworks: networks,

    bankAvailable: boolValue(bank.available),
    anyAvailable: boolValue(availability.anyAvailable),
  };
}

function normalizeNotifications(
  value: unknown
): NotificationPreferences {
  const data = record(value);
  const result = { ...DEFAULT_NOTIFICATIONS };

  for (const key of NOTIFICATION_KEYS) {
    if (typeof data[key] === "boolean") {
      result[key] = data[key];
    }
  }

  return result;
}

async function requestJson(
  url: string,
  options: RequestInit = {}
): Promise<JsonRecord> {
  const headers = new Headers(options.headers);
  let requestLocale = defaultLocale;
  try { requestLocale = normalizeLocale(window.localStorage.getItem(i18nConfig.storageKey) ?? defaultLocale); } catch { /* Use default locale. */ }
  headers.set("Accept-Language", requestLocale);
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers,
  });

  let result: JsonRecord = {};

  try {
    result = record(await response.json());
  } catch {
    result = {};
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      stringValue(result.message) ||
        `HTTP ${response.status}`
    );
  }

  return result;
}

/* ==========================================================
   COMPOSANTS LOCAUX

   Aucun nouveau fichier nécessaire.
========================================================== */

const INPUT_CLASS =
  "h-11 w-full min-w-0 rounded-xl border border-[#d9e3e9] bg-white px-3 text-sm text-[#17243b] outline-none transition-colors focus:border-[#078a2c] focus:ring-2 focus:ring-[#d4f6d4] disabled:bg-[#f3f5f7] disabled:text-[#778397]";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-bold text-[#45546b] sm:text-sm";

const PANEL_CLASS =
  "min-w-0 rounded-2xl border border-[#e0e7ed] bg-white p-3 shadow-sm sm:p-4 lg:p-5";

const PRIMARY_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#09862d] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#066e25] disabled:cursor-not-allowed disabled:opacity-60";

const SECONDARY_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8e2ea] bg-white px-4 py-2.5 text-sm font-bold text-[#294058] transition-colors hover:bg-[#f4f8f6] disabled:opacity-60";

function PaymentLogo({ code, name, icon = "lucide:smartphone" }: { code: string; name: string; icon?: string }) {
  const logo = getWithdrawalProviderLogo(code);
  return <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[#087d2d] sm:size-12">
    {logo ? <Image src={logo} alt={name} width={48} height={48} unoptimized className="size-full object-contain p-0.5" /> : <Icon icon={icon} width={29} height={29} />}
  </span>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}

function SectionHeading({
  icon: IconComponent,
  title,
  subtitle,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-start gap-3 border-b border-[#edf1f4] pb-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f9e7] text-[#087f2d]">
        <IconComponent size={23} strokeWidth={2.1} />
      </div>

      <div className="min-w-0">
        <h2 className="text-lg font-extrabold text-[#11213c] sm:text-xl">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[#67758a] sm:text-sm">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${INPUT_CLASS} pr-11`}
      />

      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#718098] hover:text-[#087b29]"
      >
        {visible ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-[#078b30]" : "bg-[#cbd5df]"
      }`}
    >
      <span
        className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerSettingsPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutLock = useRef(false);
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [section, setSection] = useState<Section>("profile");

  const [initialLoading, setInitialLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [methodSaving, setMethodSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [methodBusyId, setMethodBusyId] = useState<string | null>(null);

  const [notice, setNotice] = useState<Notice | null>(null);

  const [profile, setProfile] =
    useState<ProfileData>(EMPTY_PROFILE);

  const [destinations, setDestinations] =
    useState<Destination[]>([]);

  const [catalog, setCatalog] =
    useState<ProviderCatalog>(EMPTY_CATALOG);

  const [catalogLoading, setCatalogLoading] = useState(false);

  const [notifications, setNotifications] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);

  const [methodFormOpen, setMethodFormOpen] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);

  const [methodForm, setMethodForm] =
    useState<MethodForm>(initialMethodForm());

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const countries = useMemo<CountryOption[]>(() => {
    return getWithdrawalCountries(locale);
  }, [locale]);

  const countryOptions = useMemo(() => {
    return countries.map((country) => ({
      code: country.code,
      name: `${country.flag} ${country.name}`,
      callingCode: country.callingCode,
    }));
  }, [countries]);

  const currentText = TEXT[locale];
  const t = currentText;

  const mounted = useRef(true);

  /* ========================================================
     CHARGEMENT DE LA LANGUE
  ======================================================== */

  useEffect(() => {
    function syncLocale() {
      try {
        const saved = window.localStorage.getItem(
          i18nConfig.storageKey
        );

        if (saved) {
          setLocale(normalizeLocale(saved));
        }
      } catch {
        // Conserver la langue par défaut.
      }
    }

    syncLocale();

    window.addEventListener("storage", syncLocale);
    window.addEventListener("focus", syncLocale);

    return () => {
      window.removeEventListener("storage", syncLocale);
      window.removeEventListener("focus", syncLocale);
    };
  }, []);

  /* ========================================================
     CHARGEMENT DU PROFIL
  ======================================================== */

  const loadProfile = useCallback(async () => {
    const result = await requestJson(API.profile);

    const loaded = normalizeProfile(result.profile);

    if (!loaded.id || !loaded.organizationId) {
      throw new Error(TEXT.fr.loadError);
    }

    if (mounted.current) {
      setProfile(loaded);
    }

    return loaded;
  }, []);

  /* ========================================================
     CHARGEMENT DES MOYENS ENREGISTRÉS

     La route autorise plusieurs organisations.
     Nous sélectionnons celle du profil.
  ======================================================== */

  const loadDestinations = useCallback(
    async (organizationId: string) => {
      const params = new URLSearchParams({
        organizationId,
        page: "1",
        pageSize: "50",
      });

      const result = await requestJson(
        `${API.methods}?${params.toString()}`
      );

      const rawItems = Array.isArray(result.destinations)
        ? result.destinations
        : [];

      const items = rawItems
        .map(normalizeDestination)
        .filter((item): item is Destination => item !== null);

      if (mounted.current) {
        setDestinations(items);
      }

      return items;
    },
    []
  );

  /* ========================================================
     CHARGEMENT DES NOTIFICATIONS
  ======================================================== */

  const loadNotifications = useCallback(async () => {
    const result = await requestJson(API.notifications);

    if (mounted.current) {
      setNotifications(
        normalizeNotifications(result.preferences)
      );
    }
  }, []);

  /* ========================================================
     CHARGEMENT INITIAL

     Les trois sections utilisent leurs API
     pour récupérer les vraies informations.
  ======================================================== */

  const loadAllRequest = useCallback(async () => {


    
      return loadProfile().then(async (loadedProfile) => {

      const results = await Promise.allSettled([
        loadDestinations(loadedProfile.organizationId),
        loadNotifications(),
      ]);

      if (results.some((item) => item.status === "rejected")) {
        setNotice({
          type: "error",
          message: TEXT.fr.loadError,
        });
      }

      setMethodForm(
        initialMethodForm(
          loadedProfile.organizationCountryCode ||
            loadedProfile.countryCode
        )
      );
    
}).catch((error) => {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : TEXT.fr.loadError,
      });
    }).finally(() => {
      if (mounted.current) {
        setInitialLoading(false);
      }
    });
  }, [loadProfile, loadDestinations, loadNotifications]);
  const loadAll = useCallback(() => { setInitialLoading(true); setNotice(null); return loadAllRequest(); }, [loadAllRequest]);


  useEffect(() => {
    mounted.current = true;

    void loadAllRequest();

    return () => {
      mounted.current = false;
    };
  }, [loadAllRequest]);

  /* ========================================================
     CATALOGUE DES OPÉRATEURS PAR PAYS
  ======================================================== */

  useEffect(() => {
    if (
      !methodFormOpen ||
      !methodForm.countryCode
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalog(EMPTY_CATALOG);

      try {
        const params = new URLSearchParams({
          country: methodForm.countryCode,
          currency: methodForm.currency,
          locale,
        });

        const result = await requestJson(
          `${API.providers}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!controller.signal.aborted) {
          setCatalog(normalizeCatalog(result));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setNotice({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : TEXT[locale].operationFailed,
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => controller.abort();
  }, [
    methodFormOpen,
    methodForm.countryCode,
    methodForm.currency,
    locale,
  ]);

  /* ========================================================
     AFFICHER UNE CONFIRMATION
  ======================================================== */

  function showSuccess(message: string) {
    setNotice({
      type: "success",
      message,
    });
  }

  function showError(error: unknown) {
    setNotice({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : TEXT[locale].operationFailed,
    });
  }

  /* ========================================================
     MISE À JOUR PROFIL
  ======================================================== */

  function updateProfile<K extends keyof ProfileData>(
    key: K,
    value: ProfileData[K]
  ) {
    setProfile((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setNotice(null);

    try {
      const result = await requestJson(API.profile, {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          organizationId: profile.organizationId,

          firstName: profile.firstName,
          lastName: profile.lastName,

          phoneE164: profile.phoneE164 || null,
          countryCode: profile.countryCode || null,

          organizationName: profile.organizationName,

          organizationPhoneE164:
            profile.organizationPhoneE164 || null,

          organizationCountryCode:
            profile.organizationCountryCode || null,

          organizationCity:
            profile.organizationCity || null,
        }),
      });

      setProfile(normalizeProfile(result.profile));
      window.dispatchEvent(new Event("tikemia:organizer-profile-updated"));
      showSuccess(stringValue(result.message, t.saved));
    } catch (error) {
      showError(error);
    } finally {
      setProfileSaving(false);
    }
  }

  /* ========================================================
     AJOUTER UN MOYEN
  ======================================================== */

  function openCreateMethod() {
    setEditingMethodId(null);

    setMethodForm(
      initialMethodForm(
        profile.organizationCountryCode ||
          profile.countryCode
      )
    );

    setMethodFormOpen(true);
    setNotice(null);
  }

  /* ========================================================
     MODIFIER UN MOYEN EXISTANT

     Les coordonnées sensibles ne sont
     jamais préremplies depuis l'API.
  ======================================================== */

  function openEditMethod(method: Destination) {
    setEditingMethodId(method.id);

    setMethodForm({
      type: method.type,
      countryCode: method.countryCode,
      currency: method.currency,
      provider: method.provider,
      accountName: method.accountName,
      reference: "",
      bic: "",
      routingCode: "",
      bankName: method.bankName,
      assetCode: method.assetCode || "USDT",
      networkCode: method.networkCode || "TRC20",
      label: method.label,
      isDefault: method.isDefault,
      currentPassword: "",
    });

    setMethodFormOpen(true);
    setNotice(null);
  }

  function updateMethod<K extends keyof MethodForm>(
    key: K,
    value: MethodForm[K]
  ) {
    setMethodForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function changeMethodType(type: WithdrawalMethodType) {
    setMethodForm((previous) => ({
      ...previous,
      type,
      provider:
        type === "BANK_ACCOUNT"
          ? "BANK_TRANSFER"
          : type === "CRYPTO"
            ? "USDT"
            : "",
      assetCode: "USDT",
      networkCode: "TRC20",
      currency:
        type === "CRYPTO"
          ? "USD"
          : getCountryCurrency(previous.countryCode) ??
            previous.currency,
      reference: "",
      bankName: "",
      bic: "",
      routingCode: "",
    }));
  }

  /* ========================================================
     ENREGISTRER LE MOYEN

     POST pour ajout.
     PATCH pour modification.
  ======================================================== */

  async function submitMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (methodSaving) return;

    setNotice(null);
    setMethodSaving(true);

    try {
      const editing = Boolean(editingMethodId);

      if (!profile.organizationId) {
        throw new Error(t.required);
      }

      const selectedProvider =
        methodForm.type === "BANK_ACCOUNT"
          ? "BANK_TRANSFER"
          : methodForm.type === "CRYPTO"
            ? methodForm.assetCode
            : methodForm.provider;

      if (!selectedProvider) {
        throw new Error(t.chooseProvider);
      }

      if (!methodForm.accountName.trim()) {
        throw new Error(t.required);
      }

      if (!editing && !methodForm.reference.trim()) {
        throw new Error(t.required);
      }

      if (!editing && !methodForm.currentPassword) {
        throw new Error(t.passwordForMethod);
      }

      const enteredReference = methodForm.reference.trim();
      const normalizedReference = methodForm.type === "MOBILE_MONEY" && enteredReference
        ? normalizeWithdrawalPhone(enteredReference, methodForm.countryCode)
        : enteredReference;
      if (enteredReference && !normalizedReference) throw new Error(locale === "fr"
        ? "Verifiez le pays et le numero Mobile Money : numero local complet ou avec indicatif (+...)."
        : "Check the country and Mobile Money number: complete local number or international dialing code (+...).");

      const accountDetails = enteredReference
        ? {
            reference: normalizedReference!,

            ...(methodForm.type === "BANK_ACCOUNT" &&
            methodForm.bic.trim()
              ? { bic: methodForm.bic.trim() }
              : {}),

            ...(methodForm.type === "BANK_ACCOUNT" &&
            methodForm.routingCode.trim()
              ? { routingCode: methodForm.routingCode.trim() }
              : {}),
          }
        : null;

      let payload: JsonRecord;

      if (editing) {
        payload = {
          label: methodForm.label || null,
          isDefault: methodForm.isDefault,
        };

        const existing = destinations.find(
          (item) => item.id === editingMethodId
        );

        if (!existing) {
          throw new Error(t.operationFailed);
        }

        const sensitive =
          methodForm.accountName !== existing.accountName ||
          methodForm.bankName !== existing.bankName ||
          methodForm.countryCode !== existing.countryCode ||
          methodForm.currency !== existing.currency ||
          selectedProvider !== existing.provider ||
          (methodForm.type === "CRYPTO" &&
            methodForm.networkCode !== existing.networkCode) ||
          Boolean(accountDetails);

        if (sensitive) {
          if (!accountDetails) {
            throw new Error(t.newAccount);
          }

          if (!methodForm.currentPassword) {
            throw new Error(t.passwordForMethod);
          }

          Object.assign(payload, {
            accountName: methodForm.accountName.trim(),
            countryCode: methodForm.countryCode,
            currency: methodForm.currency,
            provider: selectedProvider,
            accountDetails,
            currentPassword: methodForm.currentPassword,

            ...(methodForm.type === "BANK_ACCOUNT"
              ? { bankName: methodForm.bankName.trim() }
              : {}),

            ...(methodForm.type === "CRYPTO"
              ? {
                  assetCode: methodForm.assetCode,
                  networkCode: methodForm.networkCode,
                }
              : {}),
          });
        }
      } else {
        payload = {
          organizationId: profile.organizationId,
          type: methodForm.type,
          provider: selectedProvider,

          countryCode: methodForm.countryCode,
          currency: methodForm.currency,
          accountName: methodForm.accountName.trim(),

          accountDetails,

          label: methodForm.label || null,
          isDefault: methodForm.isDefault,

          currentPassword: methodForm.currentPassword,

          ...(methodForm.type === "BANK_ACCOUNT"
            ? { bankName: methodForm.bankName.trim() }
            : {}),

          ...(methodForm.type === "CRYPTO"
            ? {
                assetCode: methodForm.assetCode,
                networkCode: methodForm.networkCode,
              }
            : {}),
        };
      }

      const url = editing
        ? `${API.methods}/${encodeURIComponent(editingMethodId!)}`
        : API.methods;

      const result = await requestJson(url, {
        method: editing ? "PATCH" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      await loadDestinations(profile.organizationId);

      setMethodFormOpen(false);
      setEditingMethodId(null);
      setMethodForm(initialMethodForm(methodForm.countryCode));

      showSuccess(
        stringValue(
          result.message,
          editing ? t.methodChanged : t.methodSaved
        )
      );
    } catch (error) {
      showError(error);
    } finally {
      setMethodSaving(false);
    }
  }

  /* ========================================================
     DÉFINIR COMME MOYEN PRINCIPAL
  ======================================================== */

  async function setDefaultMethod(destination: Destination) {
    if (methodBusyId) return;

    setMethodBusyId(destination.id);
    setNotice(null);

    try {
      const result = await requestJson(
        `${API.methods}/${encodeURIComponent(destination.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isDefault: true,
          }),
        }
      );

      await loadDestinations(profile.organizationId);

      showSuccess(stringValue(result.message, t.saved));
    } catch (error) {
      showError(error);
    } finally {
      setMethodBusyId(null);
    }
  }

  /* ========================================================
     RETIRER LE MOYEN

     Confirmation préalable.
     Le serveur conserve l'historique.
  ======================================================== */

  async function deleteMethod(destination: Destination) {
    if (methodBusyId) return;

    if (!window.confirm(t.confirmRemove)) {
      return;
    }

    setMethodBusyId(destination.id);
    setNotice(null);

    try {
      const result = await requestJson(
        `${API.methods}/${encodeURIComponent(destination.id)}`,
        {
          method: "DELETE",
        }
      );

      await loadDestinations(profile.organizationId);

      showSuccess(
        stringValue(result.message, t.methodRemoved)
      );
    } catch (error) {
      showError(error);
    } finally {
      setMethodBusyId(null);
    }
  }

  /* ========================================================
     CHANGER LE MOT DE PASSE
  ======================================================== */

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNotice(null);

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      setNotice({
        type: "error",
        message:
          locale === "fr"
            ? "Les mots de passe ne correspondent pas."
            : "Passwords do not match.",
      });
      return;
    }

    setPasswordSaving(true);

    try {
      const result = await requestJson(API.password, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setProfile(previous => ({ ...previous, hasPassword: true }));
      showSuccess(stringValue(result.message, t.saved));
    } catch (error) {
      showError(error);
    } finally {
      setPasswordSaving(false);
    }
  }

  /* ========================================================
     NOTIFICATIONS
  ======================================================== */

  async function saveNotifications() {
    if (notificationSaving) return;

    setNotificationSaving(true);
    setNotice(null);

    try {
      const result = await requestJson(API.notifications, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notifications),
      });

      setNotifications(
        normalizeNotifications(result.preferences)
      );

      showSuccess(stringValue(result.message, t.saved));
    } catch (error) {
      showError(error);
    } finally {
      setNotificationSaving(false);
    }
  }

  function updateNotification(
    key: NotificationKey,
    checked: boolean
  ) {
    setNotifications((previous) => ({
      ...previous,
      [key]: checked,
    }));
  }

  /* ========================================================
     LANGUE
  ======================================================== */

  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setLoggingOut(true);
    try {
      await requestJson("/api/organizer/verify-email", { method: "DELETE" });
      router.replace("/organizer");
      router.refresh();
    } catch (error) { showError(error); }
    finally { logoutLock.current = false; setLoggingOut(false); }
  }

  function changeLocale(nextLocale: Locale) {
    try {
      window.localStorage.setItem(
        i18nConfig.storageKey,
        nextLocale
      );

      window.dispatchEvent(
        new CustomEvent("tikemia:locale-changed", {
          detail: {
            locale: nextLocale,
          },
        })
      );
    } catch {
      // La page reste fonctionnelle.
    }

    window.dispatchEvent(new Event("storage"));
    setLocale(nextLocale);
    showSuccess(TEXT[nextLocale].languageSaved);
  }

  /* ========================================================
     NAVIGATION INTERNE
  ======================================================== */

  const sections: {
    id: Section;
    icon: typeof UserRound;
    label: string;
  }[] = [
    {
      id: "profile",
      icon: UserRound,
      label: t.profile,
    },
    {
      id: "withdrawals",
      icon: Wallet,
      label: t.withdrawals,
    },
    {
      id: "security",
      icon: ShieldCheck,
      label: t.security,
    },
    {
      id: "notifications",
      icon: Bell,
      label: t.notifications,
    },
    {
      id: "language",
      icon: Globe2,
      label: t.language,
    },
  ];

const availableNetworks = catalog.cryptoNetworks.filter(
    (network) => network.assetCode === methodForm.assetCode
  );

  const withdrawalTypes = [
    {
      id: "MOBILE_MONEY" as const,
      label: t.mobileMoney,
      icon: Smartphone,
    },
    {
      id: "BANK_ACCOUNT" as const,
      label: t.bank,
      icon: Landmark,
    },
    {
      id: "CRYPTO" as const,
      label: t.crypto,
      icon: Bitcoin,
    },
  ];

  const currencyOptions = SUPPORTED_CURRENCIES;

  /* ========================================================
     CHARGEMENT INITIAL
  ======================================================== */

  if (initialLoading && !profile.id) {
    return (
      <main className="flex min-h-[70vh] w-full items-center justify-center bg-[#f5f8fb] px-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-center"
        >
          <LoaderCircle
            className="animate-spin text-[#07852b]"
            size={36}
          />

          <p className="text-sm font-semibold text-[#65748b]">
            {t.loading}
          </p>
        </div>
      </main>
    );
  }

  /* ========================================================
     RENDU PRINCIPAL
  ======================================================== */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f5f8fb] pb-4 text-[#13243d]">
      {/* ====================================================
          EN-TÊTE DE PAGE

          Aucun menu global supplémentaire.
      ==================================================== */}

      <header className="relative w-full overflow-hidden border-b border-[#e1e8ee] bg-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-r from-[#e1ffd5] via-[#f2ffe8] to-[#fff2d5] opacity-75" />

        <div className="relative flex w-full flex-col gap-3 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e0f9e2] text-[#07832d] sm:size-14">
              <Settings2 size={28} strokeWidth={2.2} />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-[#10223e] sm:text-2xl lg:text-3xl">
                {t.title}
              </h1>

              <p className="mt-1 text-xs text-[#65748b] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={initialLoading}
            className={SECONDARY_CLASS}
          >
            <RefreshCw
              size={18}
              className={initialLoading ? "animate-spin" : ""}
            />
            {t.refresh}
          </button>
        </div>

        <div className="relative h-1 w-full bg-linear-to-r from-[#07852b] via-[#71d914] to-[#ffc52a]" />
      </header>

      {/* ====================================================
          PLEINE LARGEUR

          PC : navigation interne à gauche.
          Mobile : onglets horizontaux.
      ==================================================== */}

      <div className="grid w-full min-w-0 flex-1 grid-cols-1 items-start gap-4 p-3 sm:p-5 xl:grid-cols-[230px_minmax(0,1fr)] lg:gap-4 lg:p-5 2xl:grid-cols-[250px_minmax(0,1fr)]">
        {/* NAVIGATION PARAMÈTRES */}

        <nav
          aria-label={t.title}
          className="min-w-0 rounded-2xl border border-[#e1e8ef] bg-white p-2 shadow-sm xl:sticky xl:top-4 lg:p-3"
        >
          <div className="flex w-full min-w-0 flex-col gap-2">
            {sections.map((item) => {
              const ActiveIcon = item.icon;
              const active = item.id === section;

              if (item.id === "language") return (
                <div key={item.id} className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-[#58687c]">
                  <button type="button" onClick={() => setSection("language")} className="flex min-w-0 flex-1 items-center gap-2.5 text-left"><ActiveIcon size={20} className="shrink-0" />{item.label}</button>
                  <select aria-label={t.language} value={locale} onChange={event => changeLocale(event.target.value as Locale)} className="rounded-full border border-[#d8e2ea] bg-white px-2 py-1 text-xs font-bold text-[#172a43]"><option value="fr">FR</option><option value="en">EN</option></select>
                </div>
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setNotice(null);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 w-full min-w-0 shrink-0 items-center justify-between gap-3 rounded-xl px-3 text-xs font-extrabold transition-colors sm:text-sm lg:w-full ${
                    active
                      ? "bg-[#e3f7e4] text-[#087d2a]"
                      : "text-[#58687c] hover:bg-[#f5f8f7]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ActiveIcon size={20} />
                    {item.label}
                  </span>

                  <ChevronRight
                    size={17}
                    className="shrink-0"
                  />
                </button>
              );
            })}
            <button type="button" onClick={() => void logout()} disabled={loggingOut} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-sm font-extrabold text-[#58687c] hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><span className="flex items-center gap-2.5">{loggingOut ? <LoaderCircle size={20} className="animate-spin" /> : <LogOut size={20} />}{locale === "fr" ? "Déconnexion" : "Log out"}</span><ChevronRight size={17} /></button>
          </div>
        </nav>

        {/* CONTENU DES PARAMÈTRES */}

        <div className="flex w-full min-w-0 flex-col gap-4">
          {/* MESSAGE GLOBAL */}

          {notice && (
            <div
              role={notice.type === "error" ? "alert" : "status"}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                notice.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {notice.type === "success" ? (
                <CheckCircle2 size={20} className="shrink-0" />
              ) : (
                <CircleAlert size={20} className="shrink-0" />
              )}

              <span className="min-w-0 flex-1 wrap-break-word">
                {notice.message}
              </span>

              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* ================================================
              SECTION PROFIL
          ================================================ */}

          {section === "profile" && (
            <section className={PANEL_CLASS}>
              <SectionHeading
                icon={UserRound}
                title={t.profile}
                subtitle={t.profileSubtitle}
              />

              <OrganizerAvatar fullName={profile.fullName} firstName={profile.firstName} lastName={profile.lastName} locale={locale} size="lg" editable className="mb-4" />

              <form
                onSubmit={(event) => void submitProfile(event)}
                className="flex flex-col gap-5"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t.firstName}>
                    <input
                      className={INPUT_CLASS}
                      value={profile.firstName}
                      onChange={(event) =>
                        updateProfile("firstName", event.target.value)
                      }
                      maxLength={80}
                      required
                      autoComplete="given-name"
                    />
                  </Field>

                  <Field label={t.lastName}>
                    <input
                      className={INPUT_CLASS}
                      value={profile.lastName}
                      onChange={(event) =>
                        updateProfile("lastName", event.target.value)
                      }
                      maxLength={80}
                      required
                      autoComplete="family-name"
                    />
                  </Field>

                  <Field label={t.email}>
                    <div className="relative">
                      <input
                        className={`${INPUT_CLASS} pr-11`}
                        value={profile.email}
                        readOnly
                        type="email"
                        autoComplete="email"
                      />

                      <LockKeyhole
                        size={18}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-[#7a8799]"
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-[#7b8797]">
                      {t.emailLocked}
                    </p>
                  </Field>

                  <Field label={t.phone}>
                    <input
                      type="tel"
                      className={INPUT_CLASS}
                      value={profile.phoneE164}
                      onChange={(event) =>
                        updateProfile("phoneE164", event.target.value)
                      }
                      placeholder="+229..."
                      autoComplete="tel"
                    />
                  </Field>

                  <Field label={t.country}>
                    <select
                      className={INPUT_CLASS}
                      value={profile.countryCode}
                      onChange={(event) =>
                        updateProfile("countryCode", event.target.value)
                      }
                    >
                      <option value="">{t.selectCountry}</option>

                      {countryOptions.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="border-t border-[#e8edf1] pt-5">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-extrabold text-[#11233d]">
                    <Building2 size={20} className="text-green-700" />
                    {t.organization}
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label={t.organization}>
                        <input
                          className={INPUT_CLASS}
                          value={profile.organizationName}
                          onChange={(event) =>
                            updateProfile(
                              "organizationName",
                              event.target.value
                            )
                          }
                          maxLength={180}
                          required
                        />
                      </Field>
                    </div>

                    <Field label={t.organizationPhone}>
                      <input
                        type="tel"
                        className={INPUT_CLASS}
                        value={profile.organizationPhoneE164}
                        onChange={(event) =>
                          updateProfile(
                            "organizationPhoneE164",
                            event.target.value
                          )
                        }
                        placeholder="+229..."
                      />
                    </Field>

                    <Field label={t.organizationCountry}>
                      <select
                        className={INPUT_CLASS}
                        value={profile.organizationCountryCode}
                        onChange={(event) =>
                          updateProfile(
                            "organizationCountryCode",
                            event.target.value
                          )
                        }
                      >
                        <option value="">{t.selectCountry}</option>

                        {countryOptions.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="sm:col-span-2">
                      <Field label={t.city}>
                        <input
                          className={INPUT_CLASS}
                          value={profile.organizationCity}
                          onChange={(event) =>
                            updateProfile(
                              "organizationCity",
                              event.target.value
                            )
                          }
                          maxLength={120}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#edf1f4] pt-5">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className={`${PRIMARY_CLASS} w-full sm:w-auto`}
                  >
                    {profileSaving ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}

                    {profileSaving ? t.saving : t.save}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ================================================
              SECTION MOYENS DE RETRAIT
          ================================================ */}

          {section === "withdrawals" && (
            <>
              <section className={PANEL_CLASS}>
                <SectionHeading
                  icon={Wallet}
                  title={t.withdrawalTitle}
                  subtitle={t.withdrawalSubtitle}
                />

                <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
                  {withdrawalTypes.map((type) => {
                    const TypeIcon = type.icon;

                    return (
                      <div
                        key={type.id}
                        className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#e0e9e3] bg-[#f7fbf7] p-2 text-center sm:p-4"
                      >
                        <TypeIcon
                          size={25}
                          className="text-[#09832c]"
                        />

                        <span className="text-[11px] font-extrabold text-[#283a4f] sm:text-sm">
                          {type.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-extrabold text-[#14243d] sm:text-base">
                    {t.withdrawalTitle}
                  </h3>

                  {!methodFormOpen && (
                    <button
                      type="button"
                      onClick={openCreateMethod}
                      className={`${PRIMARY_CLASS} w-full sm:w-auto`}
                    >
                      <Plus size={18} />
                      {t.addMethod}
                    </button>
                  )}
                </div>

                {/* MOYENS ENREGISTRÉS */}

                <div className="mt-4 flex flex-col gap-3">
                  {destinations.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#d4e0d8] bg-[#fafdfa] px-4 py-9 text-center">
                      <Wallet
                        size={34}
                        className="text-[#90a99a]"
                      />

                      <p className="text-sm font-semibold text-[#64758a]">
                        {t.noMethods}
                      </p>
                    </div>
                  )}

                  {destinations.map((destination) => {
                    const isBusy = methodBusyId === destination.id;

                    const methodTitle =
                      destination.type === "MOBILE_MONEY"
                        ? getMobileMoneyProvider(destination.provider)?.name || destination.provider.replace(/_/g, " ")
                        : destination.type === "BANK_ACCOUNT"
                          ? destination.bankName || t.bank
                          : `${destination.assetCode} · ${destination.networkCode}`;

                    const iconName =
                      destination.type === "CRYPTO"
                        ? destination.assetCode === "BTC"
                          ? "logos:bitcoin"
                          : "logos:tether"
                        : destination.type === "BANK_ACCOUNT"
                          ? "lucide:landmark"
                          : "lucide:smartphone";

                    return (
                      <div
                        key={destination.id}
                        className="relative flex min-w-0 items-center gap-2 rounded-xl border border-[#e1e8ed] bg-[#fafcfd] p-3 sm:gap-4 sm:p-4"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <PaymentLogo code={destination.provider} name={methodTitle} icon={iconName} />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-extrabold wrap-break-word text-[#16243a]">
                                {destination.label || methodTitle}
                              </h4>

                              {destination.isDefault && (
                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-extrabold text-green-800">
                                  {t.default}
                                </span>
                              )}
                            </div>

                            {destination.label && <p className="mt-1 text-xs font-semibold text-[#5f7084]">{methodTitle}</p>}

                            <p className="mt-1 text-xs text-[#65758b]">
                              {destination.accountName}
                            </p>

                            <p className="mt-1 wrap-anywhere font-mono text-xs text-[#31455f]">
                              {destination.maskedAccountRef || "••••"}
                            </p>

                            <p className="mt-2 text-[11px] text-[#67788d]">
                              {destination.countryCode} · {currencySymbol(destination.currency)}
                            </p>

                            <p
                              className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
                                destination.isVerified
                                  ? "text-green-700"
                                  : "text-amber-700"
                              }`}
                            >
                              {destination.isVerified ? (
                                <CheckCircle2 size={15} />
                              ) : (
                                <Info size={15} />
                              )}

                              {destination.isVerified
                                ? t.verified
                                : t.notVerified}
                            </p>
                          </div>
                        </div>

                        <div className="hidden max-w-[55%] shrink-0 flex-wrap justify-end gap-2 lg:flex">
                          {!destination.isDefault && (
                            <button
                              type="button"
                              disabled={Boolean(methodBusyId)}
                              onClick={() =>
                                void setDefaultMethod(destination)
                              }
                              className={SECONDARY_CLASS}
                            >
                              {isBusy ? (
                                <LoaderCircle
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <Check size={16} />
                              )}
                              {t.setDefault}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditMethod(destination)}
                            disabled={Boolean(methodBusyId)}
                            className={SECONDARY_CLASS}
                          >
                            <Pencil size={16} />
                            {t.edit}
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(methodBusyId)}
                            onClick={() =>
                              void deleteMethod(destination)
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                            {t.remove}
                          </button>
                        </div>
                        <details className="group relative shrink-0 lg:hidden">
                          <summary aria-label={locale === "fr" ? "Actions du moyen de retrait" : "Withdrawal method actions"} className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg text-[#294058] hover:bg-green-50 [&::-webkit-details-marker]:hidden"><MoreVertical size={22} /></summary>
                          <div onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }} className="absolute top-12 right-0 z-20 flex w-56 max-w-[calc(100vw-3rem)] flex-col gap-2 rounded-xl border border-[#d8e2ea] bg-white p-2 shadow-lg">
                          {!destination.isDefault && (
                            <button
                              type="button"
                              disabled={Boolean(methodBusyId)}
                              onClick={() =>
                                void setDefaultMethod(destination)
                              }
                              className={SECONDARY_CLASS}
                            >
                              {isBusy ? (
                                <LoaderCircle
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <Check size={16} />
                              )}
                              {t.setDefault}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditMethod(destination)}
                            disabled={Boolean(methodBusyId)}
                            className={SECONDARY_CLASS}
                          >
                            <Pencil size={16} />
                            {t.edit}
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(methodBusyId)}
                            onClick={() =>
                              void deleteMethod(destination)
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                            {t.remove}
                          </button>

                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* FORMULAIRE D'AJOUT OU MODIFICATION */}

              {methodFormOpen && (
                <section className={PANEL_CLASS}>
                  <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#e8edf1] pb-4">
                    <h3 className="text-lg font-extrabold text-[#14243e]">
                      {editingMethodId ? t.edit : t.addMethod}
                    </h3>

                    <button
                      type="button"
                      onClick={() => {
                        setMethodFormOpen(false);
                        setEditingMethodId(null);
                      }}
                      aria-label={t.cancel}
                      className="flex size-9 items-center justify-center rounded-lg bg-[#f1f4f7] text-[#506078]"
                    >
                      <X size={19} />
                    </button>
                  </div>

                  <form
                    onSubmit={(event) => void submitMethod(event)}
                    className="flex flex-col gap-4"
                  >
                    {/* CHOIX DU TYPE */}

                    <div className="grid grid-cols-3 gap-2">
                      {withdrawalTypes.map((type) => {
                        const TypeIcon = type.icon;
                        const active = methodForm.type === type.id;

                        return (
                          <button
                            key={type.id}
                            type="button"
                            disabled={Boolean(editingMethodId)}
                            onClick={() => changeMethodType(type.id)}
                            className={`flex min-h-22 flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center text-xs font-extrabold transition-colors sm:text-sm ${
                              active
                                ? "border-[#07852b] bg-[#ecfaeb] text-[#087e2c]"
                                : "border-[#dce5ec] bg-white text-[#64748b]"
                            } disabled:cursor-not-allowed`}
                          >
                            <TypeIcon size={23} />
                            {type.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t.country}>
                        <select
                          className={INPUT_CLASS}
                          value={methodForm.countryCode}
                          onChange={(event) => {
                            const code = event.target.value;

                            setMethodForm((previous) => ({
                              ...previous,
                              countryCode: code,
                              provider:
                                previous.type === "BANK_ACCOUNT"
                                  ? "BANK_TRANSFER"
                                  : previous.type === "CRYPTO"
                                    ? previous.assetCode
                                    : "",
                              currency:
                                previous.type === "CRYPTO"
                                  ? "USD"
                                  : getCountryCurrency(code) ??
                                    previous.currency,
                              reference: "",
                            }));
                          }}
                          required
                        >
                          <option value="">{t.selectCountry}</option>

                          {countryOptions.map((country) => (
                            <option
                              key={country.code}
                              value={country.code}
                            >
                              {country.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label={t.currency}>
                        <select
                          className={INPUT_CLASS}
                          value={methodForm.currency}
                          onChange={(event) =>
                            updateMethod("currency", event.target.value)
                          }
                          required
                        >
                          {currencyOptions.map((currency) => (
                            <option key={currency} value={currency}>
                              {currencyLabel(currency, locale)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    {/* MOBILE MONEY */}

                    {methodForm.type === "MOBILE_MONEY" && (
                      <>
                        <Field label={t.provider}>
                          <div className="flex min-w-0 items-center gap-2">
                          {methodForm.provider && <PaymentLogo code={methodForm.provider} name={catalog.mobileMoney.find(p => p.code === methodForm.provider)?.name || methodForm.provider} />}
                          <select
                            className={INPUT_CLASS}
                            value={methodForm.provider}
                            onChange={(event) =>
                              updateMethod("provider", event.target.value)
                            }
                            required
                          >
                            <option value="">
                              {catalogLoading
                                ? t.loading
                                : t.selectProvider}
                            </option>

                            {catalog.mobileMoney.map((provider) => (
                              <option
                                key={provider.code}
                                value={provider.code}
                              >
                                {provider.name}
                                {!provider.available ? " · —" : ""}
                              </option>
                            ))}
                          </select>
                          </div>
                        </Field>

                        <Field label={t.mobileNumber}>
                          <input
                            type="tel"
                            className={INPUT_CLASS}
                            value={methodForm.reference}
                            onChange={(event) =>
                              updateMethod("reference", event.target.value)
                            }
                            placeholder={countries.find(country => country.code === methodForm.countryCode)?.callingCode || "+..."}
                            autoComplete="tel"
                            required={!editingMethodId}
                          />
                        </Field>
                      </>
                    )}

                    {/* BANQUE */}

                    {methodForm.type === "BANK_ACCOUNT" && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label={t.bankName}>
                          <div className="mb-2"><PaymentLogo code="BANK_TRANSFER" name={t.bank} /></div>
                          <input
                            className={INPUT_CLASS}
                            value={methodForm.bankName}
                            onChange={(event) =>
                              updateMethod("bankName", event.target.value)
                            }
                            required
                          />
                        </Field>

                        <Field label={t.accountReference}>
                          <input
                            className={INPUT_CLASS}
                            value={methodForm.reference}
                            onChange={(event) =>
                              updateMethod("reference", event.target.value)
                            }
                            autoCapitalize="characters"
                            required={!editingMethodId}
                          />
                        </Field>

                        <Field label={t.bic}>
                          <input
                            className={INPUT_CLASS}
                            value={methodForm.bic}
                            onChange={(event) =>
                              updateMethod("bic", event.target.value)
                            }
                            maxLength={11}
                          />
                        </Field>

                        <Field label={t.routingCode}>
                          <input
                            className={INPUT_CLASS}
                            value={methodForm.routingCode}
                            onChange={(event) =>
                              updateMethod("routingCode", event.target.value)
                            }
                            maxLength={35}
                          />
                        </Field>
                      </div>
                    )}

                    {/* CRYPTO */}

                    {methodForm.type === "CRYPTO" && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label={t.asset}>
                          <div className="flex min-w-0 items-center gap-2"><PaymentLogo code={methodForm.assetCode} name={methodForm.assetCode} />
                          <select
                            className={INPUT_CLASS}
                            value={methodForm.assetCode}
                            onChange={(event) => {
                              const assetCode = event.target.value;

                              setMethodForm((previous) => ({
                                ...previous,
                                assetCode,
                                provider: assetCode,
                                networkCode:
                                  assetCode === "BTC"
                                    ? "BITCOIN"
                                    : "TRC20",
                                reference: "",
                                currency: "USD",
                              }));
                            }}
                          >
                            <option value="BTC">Bitcoin (BTC)</option>
                            <option value="USDT">Tether (USDT)</option>
                          </select>
                          </div>
                        </Field>

                        <Field label={t.network}>
                          <select
                            className={INPUT_CLASS}
                            value={methodForm.networkCode}
                            onChange={(event) =>
                              updateMethod("networkCode", event.target.value)
                            }
                            required
                          >
                            {availableNetworks.length === 0 ? (
                              <option value={methodForm.networkCode}>
                                {methodForm.networkCode}
                              </option>
                            ) : (
                              availableNetworks.map((network) => (
                                <option
                                  key={`${network.assetCode}-${network.code}`}
                                  value={network.code}
                                >
                                  {network.name}
                                </option>
                              ))
                            )}
                          </select>
                        </Field>

                        <div className="sm:col-span-2">
                          <Field label={t.walletAddress}>
                            <input
                              className={INPUT_CLASS}
                              value={methodForm.reference}
                              onChange={(event) =>
                                updateMethod("reference", event.target.value)
                              }
                              autoComplete="off"
                              spellCheck={false}
                              required={!editingMethodId}
                              placeholder="Wallet address"
                            />
                          </Field>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t.holder}>
                        <input
                          className={INPUT_CLASS}
                          value={methodForm.accountName}
                          onChange={(event) =>
                            updateMethod("accountName", event.target.value)
                          }
                          required
                        />
                      </Field>

                      <Field label={t.label}>
                        <input
                          className={INPUT_CLASS}
                          value={methodForm.label}
                          onChange={(event) =>
                            updateMethod("label", event.target.value)
                          }
                          maxLength={80}
                        />
                      </Field>
                    </div>

                    

                    <label className="flex items-center gap-3 rounded-xl border border-[#e0e8e2] bg-[#f8fbf8] p-3 text-sm font-semibold text-[#29435b]">
                      <input
                        type="checkbox"
                        checked={methodForm.isDefault}
                        onChange={(event) =>
                          updateMethod("isDefault", event.target.checked)
                        }
                        className="size-4 accent-[#087d2b]"
                      />
                      {t.defaultChoice}
                    </label>

                    <Field label={t.passwordForMethod}>
                      <PasswordField
                        value={methodForm.currentPassword}
                        onChange={(value) =>
                          updateMethod("currentPassword", value)
                        }
                        autoComplete="current-password"
                      />
                    </Field>

                    

                    <div className="flex flex-col-reverse gap-2 border-t border-[#e9eef2] pt-4 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        className={SECONDARY_CLASS}
                        onClick={() => {
                          setMethodFormOpen(false);
                          setEditingMethodId(null);
                        }}
                      >
                        {t.cancel}
                      </button>

                      <button
                        type="submit"
                        disabled={methodSaving || catalogLoading}
                        className={PRIMARY_CLASS}
                      >
                        {methodSaving ? (
                          <LoaderCircle
                            size={18}
                            className="animate-spin"
                          />
                        ) : (
                          <Save size={18} />
                        )}

                        {methodSaving ? t.saving : t.save}
                      </button>
                    </div>
                  </form>
                </section>
              )}

            </>
          )}

          {/* ================================================
              SECTION SÉCURITÉ
          ================================================ */}

          {section === "security" && (
            <section className={PANEL_CLASS}>
              <SectionHeading
                icon={ShieldCheck}
                title={profile.hasPassword ? t.passwordTitle : locale === "fr" ? "Créer mon mot de passe" : "Set my password"}
                subtitle={t.passwordSubtitle}
              />

              <form
                onSubmit={(event) => void submitPassword(event)}
                className="flex w-full min-w-0 flex-col gap-4"
              >
                {profile.hasPassword && <Field label={t.currentPassword}>
                  <PasswordField
                    value={passwordForm.currentPassword}
                    onChange={(value) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        currentPassword: value,
                      }))
                    }
                    autoComplete="current-password"
                  />
                </Field>}

                <Field label={t.newPassword}>
                  <PasswordField
                    value={passwordForm.newPassword}
                    onChange={(value) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        newPassword: value,
                      }))
                    }
                    autoComplete="new-password"
                  />
                </Field>

                <Field label={t.confirmPassword}>
                  <PasswordField
                    value={passwordForm.confirmPassword}
                    onChange={(value) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        confirmPassword: value,
                      }))
                    }
                    autoComplete="new-password"
                  />
                </Field>


                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className={`${PRIMARY_CLASS} w-full sm:w-auto`}
                  >
                    {passwordSaving ? (
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <LockKeyhole size={18} />
                    )}

                    {passwordSaving
                      ? t.saving
                      : profile.hasPassword ? t.changePassword : locale === "fr" ? "Créer mon mot de passe" : "Set my password"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ================================================
              SECTION NOTIFICATIONS
          ================================================ */}

          {section === "notifications" && (
            <section className={PANEL_CLASS}>
              <SectionHeading
                icon={Bell}
                title={t.notifications}
                subtitle={t.notificationsSubtitle}
              />

              {([
                {
                  label: t.sales,
                  email: "emailTicketSales",
                  app: "inAppTicketSales",
                },
                {
                  label: t.donations,
                  email: "emailDonations",
                  app: "inAppDonations",
                },
                {
                  label: t.payouts,
                  email: "emailPayouts",
                  app: "inAppPayouts",
                },
                {
                  label: t.events,
                  email: "emailEvents",
                  app: "inAppEvents",
                },
                {
                  label: t.campaigns,
                  email: "emailCampaigns",
                  app: "inAppCampaigns",
                },
              ] as const).map((item) => (
                <div
                  key={item.email}
                  className="flex flex-col gap-3 border-b border-[#edf1f4] py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm font-bold text-[#26374e]">
                    {item.label}
                  </p>

                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#65748b]">
                        {t.byEmail}
                      </span>
                      <Switch
                        label={`${item.label} — ${t.byEmail}`}
                        checked={notifications[item.email]}
                        onChange={(value) =>
                          updateNotification(item.email, value)
                        }
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#65748b]">
                        {t.inApp}
                      </span>
                      <Switch
                        label={`${item.label} — ${t.inApp}`}
                        checked={notifications[item.app]}
                        onChange={(value) =>
                          updateNotification(item.app, value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#edf8ee] p-3 text-xs font-semibold text-[#32643d]">
                <ShieldCheck size={19} className="shrink-0" />
                {t.securityAlerts}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveNotifications()}
                  disabled={notificationSaving}
                  className={`${PRIMARY_CLASS} w-full sm:w-auto`}
                >
                  {notificationSaving ? (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={18} />
                  )}
                  {notificationSaving ? t.saving : t.save}
                </button>
              </div>
            </section>
          )}

          {/* ================================================
              SECTION LANGUE
          ================================================ */}

          {section === "language" && (
            <section className={PANEL_CLASS}>
              <SectionHeading
                icon={Globe2}
                title={t.language}
                subtitle={t.languageSubtitle}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    id: "fr" as Locale,
                    label: t.french,
                    flag: "🇫🇷",
                  },
                  {
                    id: "en" as Locale,
                    label: t.english,
                    flag: "🇬🇧",
                  },
                ].map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => changeLocale(option.id)}
                    className={`flex min-h-18 items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                      locale === option.id
                        ? "border-[#078a2c] bg-[#eaf9ea]"
                        : "border-[#dee6ec] bg-white hover:bg-[#f6faf7]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-2xl">{option.flag}</span>
                      <span className="text-sm font-extrabold text-[#172a43]">
                        {option.label}
                      </span>
                    </span>

                    {locale === option.id && (
                      <CheckCircle2
                        size={21}
                        className="text-[#087e2a]"
                      />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
