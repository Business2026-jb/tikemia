import "server-only";

export type ClientFooterLinkItem = {
  label: string;
  href: string;
  external?: boolean;
  ariaLabel?: string;
};

export type ClientFooterLinkSection = {
  id: string;
  title: string;
  links: ClientFooterLinkItem[];
};

export type ClientFooterSocialLink = {
  id: string;
  label: string;
  href: string;
  shortLabel: string;
};

export type ClientFooterTrustItem = {
  id: string;
  label: string;
  description: string;
  icon:
    | "secure-payments"
    | "verified-tickets"
    | "protected-data"
    | "customer-support"
    | "reliable-platform";
};

export type ClientFooterPaymentMethod = {
  id: string;
  label: string;
  shortLabel?: string;
  category:
    | "card"
    | "mobile-money"
    | "wallet"
    | "bank";
  description?: string;
};

export type ClientFooterContactData = {
  supportEmail: string;
  supportPhone: string;
  address: string;
  websiteLabel: string;
  websiteHref: string;
  supportLabel: string;
};

export type ClientFooterLegalLink = {
  id: string;
  label: string;
  href: string;
};

export type ClientFooterData = {
  brand: {
    name: string;
    logoSrc: string;
    description: string;
    secondaryDescription: string;
  };

  sections: ClientFooterLinkSection[];

  socialLinks: ClientFooterSocialLink[];

  trustItems: ClientFooterTrustItem[];

  paymentMethods: ClientFooterPaymentMethod[];

  contact: ClientFooterContactData;

  legalLinks: ClientFooterLegalLink[];

  copyright: string;
};

export type GetClientFooterDataOptions = {
  logoSrc?: string;

  supportEmail?: string;
  supportPhone?: string;
  address?: string;

  websiteLabel?: string;
  websiteHref?: string;

  currentYear?: number;
};

const DEFAULT_LOGO_SRC =
  "/logo.png";

const DEFAULT_SUPPORT_EMAIL =
  "support@tikemia.com";

const DEFAULT_SUPPORT_PHONE =
  "+229 01 69 56 77 44";

const DEFAULT_ADDRESS =
  "Cotonou, Bénin";

const DEFAULT_WEBSITE_LABEL =
  "tikemia.com";

const DEFAULT_WEBSITE_HREF =
  "/";

const CLIENT_FOOTER_LINK_SECTIONS: ClientFooterLinkSection[] = [
  {
    id:
      "discover",

    title:
      "Découvrir",

    links: [
      {
        label:
          "Accueil",
        href:
          "/",
      },
      {
        label:
          "Explorer les événements",
        href:
          "/events",
      },
      {
        label:
          "Catégories",
        href:
          "/categories",
      },
      {
        label:
          "Top événements",
        href:
          "/events?sort=popular",
      },
      {
        label:
          "Événements à venir",
        href:
          "/events?period=upcoming",
      },
      {
        label:
          "Rechercher",
        href:
          "/search",
      },
    ],
  },
  {
    id:
      "account",

    title:
      "Mon espace",

    links: [
      {
        label:
          "Mes billets",
        href:
          "/account/tickets",
      },
      {
        label:
          "Mes commandes",
        href:
          "/account/orders",
      },
      {
        label:
          "Mes favoris",
        href:
          "/favorites",
      },
      {
        label:
          "Transférer un billet",
        href:
          "/account/transfers",
      },
      {
        label:
          "Mon profil",
        href:
          "/account/profile",
      },
      {
        label:
          "Paramètres",
        href:
          "/account/settings",
      },
    ],
  },
  {
    id:
      "help",

    title:
      "Aide et informations",

    links: [
      {
        label:
          "Centre d’aide",
        href:
          "/help",
      },
      {
        label:
          "FAQ",
        href:
          "/faq",
      },
      {
        label:
          "À propos",
        href:
          "/about",
      },
      {
        label:
          "Contact",
        href:
          "/contact",
      },
      {
        label:
          "Conditions d’utilisation",
        href:
          "/terms",
      },
      {
        label:
          "Politique de confidentialité",
        href:
          "/privacy-policy",
      },
      {
        label:
          "Retours et remboursements",
        href:
          "/refund-policy",
      },
    ],
  },
];

const CLIENT_FOOTER_SOCIAL_LINKS: ClientFooterSocialLink[] = [
  {
    id:
      "facebook",

    label:
      "Facebook",

    href:
      "https://facebook.com",

    shortLabel:
      "f",
  },
  {
    id:
      "instagram",

    label:
      "Instagram",

    href:
      "https://instagram.com",

    shortLabel:
      "IG",
  },
  {
    id:
      "x",

    label:
      "X",

    href:
      "https://x.com",

    shortLabel:
      "X",
  },
  {
    id:
      "youtube",

    label:
      "YouTube",

    href:
      "https://youtube.com",

    shortLabel:
      "▶",
  },
  {
    id:
      "linkedin",

    label:
      "LinkedIn",

    href:
      "https://linkedin.com",

    shortLabel:
      "in",
  },
];

const CLIENT_FOOTER_TRUST_ITEMS: ClientFooterTrustItem[] = [
  {
    id:
      "secure-payments",

    label:
      "Paiements sécurisés",

    description:
      "Transactions protégées",

    icon:
      "secure-payments",
  },
  {
    id:
      "verified-tickets",

    label:
      "Billets vérifiés",

    description:
      "QR codes uniques",

    icon:
      "verified-tickets",
  },
  {
    id:
      "protected-data",

    label:
      "Données protégées",

    description:
      "Confidentialité renforcée",

    icon:
      "protected-data",
  },
  {
    id:
      "customer-support",

    label:
      "Support disponible",

    description:
      "Assistance client",

    icon:
      "customer-support",
  },
  {
    id:
      "reliable-platform",

    label:
      "Plateforme fiable",

    description:
      "Expérience sécurisée",

    icon:
      "reliable-platform",
  },
];

const CLIENT_FOOTER_PAYMENT_METHODS: ClientFooterPaymentMethod[] = [
  {
    id:
      "visa",

    label:
      "Visa",

    shortLabel:
      "VISA",

    category:
      "card",

    description:
      "Carte bancaire internationale",
  },
  {
    id:
      "mastercard",

    label:
      "Mastercard",

    shortLabel:
      "MC",

    category:
      "card",

    description:
      "Carte bancaire internationale",
  },
  {
    id:
      "mtn-momo",

    label:
      "MTN MoMo",

    shortLabel:
      "MTN",

    category:
      "mobile-money",

    description:
      "Paiement Mobile Money",
  },
  {
    id:
      "moov-money",

    label:
      "Moov Money",

    shortLabel:
      "MOOV",

    category:
      "mobile-money",

    description:
      "Paiement Mobile Money",
  },
  {
    id:
      "orange-money",

    label:
      "Orange Money",

    shortLabel:
      "OM",

    category:
      "mobile-money",

    description:
      "Paiement Mobile Money",
  },
  {
    id:
      "wave",

    label:
      "Wave",

    shortLabel:
      "WAVE",

    category:
      "wallet",

    description:
      "Portefeuille mobile",
  },
];

const CLIENT_FOOTER_LEGAL_LINKS: ClientFooterLegalLink[] = [
  {
    id:
      "terms",

    label:
      "Conditions",

    href:
      "/terms",
  },
  {
    id:
      "privacy",

    label:
      "Confidentialité",

    href:
      "/privacy-policy",
  },
  {
    id:
      "refunds",

    label:
      "Remboursements",

    href:
      "/refund-policy",
  },
];

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeInternalOrExternalHref({
  value,
  fallback,
}: {
  value: string | undefined;
  fallback: string;
}): string {
  const normalizedValue =
    normalizeText(
      value,
    );

  if (!normalizedValue) {
    return fallback;
  }

  if (
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("http://")
  ) {
    return normalizedValue;
  }

  return fallback;
}

function normalizeYear(
  value: number | undefined,
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isInteger(
      value,
    ) ||
    value < 2026 ||
    value > 9999
  ) {
    return new Date().getFullYear();
  }

  return value;
}

function cloneFooterSections(): ClientFooterLinkSection[] {
  return CLIENT_FOOTER_LINK_SECTIONS.map(
    (
      section,
    ) => ({
      ...section,

      links:
        section.links.map(
          (
            link,
          ) => ({
            ...link,
          }),
        ),
    }),
  );
}

function cloneSocialLinks(): ClientFooterSocialLink[] {
  return CLIENT_FOOTER_SOCIAL_LINKS.map(
    (
      item,
    ) => ({
      ...item,
    }),
  );
}

function cloneTrustItems(): ClientFooterTrustItem[] {
  return CLIENT_FOOTER_TRUST_ITEMS.map(
    (
      item,
    ) => ({
      ...item,
    }),
  );
}

function clonePaymentMethods(): ClientFooterPaymentMethod[] {
  return CLIENT_FOOTER_PAYMENT_METHODS.map(
    (
      item,
    ) => ({
      ...item,
    }),
  );
}

function cloneLegalLinks(): ClientFooterLegalLink[] {
  return CLIENT_FOOTER_LEGAL_LINKS.map(
    (
      item,
    ) => ({
      ...item,
    }),
  );
}

/**
 * Retourne toutes les données statiques et configurables du footer client.
 *
 * Cette fonction ne fait aucune requête Prisma et peut être appelée
 * directement depuis le layout client ou un composant serveur.
 */
export function getClientFooterData(
  options: GetClientFooterDataOptions = {},
): ClientFooterData {
  const currentYear =
    normalizeYear(
      options.currentYear,
    );

  const logoSrc =
    normalizeInternalOrExternalHref({
      value:
        options.logoSrc,

      fallback:
        DEFAULT_LOGO_SRC,
    });

  const supportEmail =
    normalizeText(
      options.supportEmail,
    ) ||
    DEFAULT_SUPPORT_EMAIL;

  const supportPhone =
    normalizeText(
      options.supportPhone,
    ) ||
    DEFAULT_SUPPORT_PHONE;

  const address =
    normalizeText(
      options.address,
    ) ||
    DEFAULT_ADDRESS;

  const websiteLabel =
    normalizeText(
      options.websiteLabel,
    ) ||
    DEFAULT_WEBSITE_LABEL;

  const websiteHref =
    normalizeInternalOrExternalHref({
      value:
        options.websiteHref,

      fallback:
        DEFAULT_WEBSITE_HREF,
    });

  return {
    brand: {
      name:
        "Tikemia",

      logoSrc,

      description:
        "Tikemia vous permet de découvrir, réserver et recevoir vos billets pour les meilleurs événements, avec ou sans compte.",

      secondaryDescription:
        "Concerts, festivals, conférences, spectacles, sport et expériences uniques, réunis dans une seule plateforme simple et sécurisée.",
    },

    sections:
      cloneFooterSections(),

    socialLinks:
      cloneSocialLinks(),

    trustItems:
      cloneTrustItems(),

    paymentMethods:
      clonePaymentMethods(),

    contact: {
      supportEmail,
      supportPhone,
      address,
      websiteLabel,
      websiteHref,

      supportLabel:
        "Support client disponible",
    },

    legalLinks:
      cloneLegalLinks(),

    copyright:
      `© ${currentYear} Tikemia. Tous droits réservés.`,
  };
}