import {
  CalendarDays,
  CircleHelp,
  Heart,
  Home,
  Info,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  Ticket,
  UserRound,
} from "lucide-react";

export type ClientNavigationIcon =
  | typeof Home
  | typeof Search
  | typeof CalendarDays
  | typeof Ticket
  | typeof ShoppingBag
  | typeof Heart
  | typeof UserRound
  | typeof CircleHelp
  | typeof Info
  | typeof Settings
  | typeof RotateCcw;

export type ClientNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: ClientNavigationIcon;
  description?: string;
  requiresAuthentication?: boolean;
  desktop?: boolean;
  mobile?: boolean;
  bottomNavigation?: boolean;
};

export type ClientNavigationGroup = {
  id: string;
  title: string;
  items: ClientNavigationItem[];
};

export type ClientNavigationContext = {
  pathname: string;
  isAuthenticated: boolean;
  loginHref?: string;
};

export const CLIENT_DESKTOP_NAVIGATION: ClientNavigationItem[] = [
  {
    id: "home",
    label: "Accueil",
    href: "/",
    icon: Home,
    desktop: true,
    mobile: true,
    bottomNavigation: true,
  },
  {
    id: "explore",
    label: "Explorer",
    href: "/events",
    icon: Search,
    description: "Découvrir tous les événements",
    desktop: true,
    mobile: true,
    bottomNavigation: true,
  },
  {
    id: "categories",
    label: "Catégories",
    href: "/categories",
    icon: CalendarDays,
    description: "Concerts, festivals et plus",
    desktop: true,
    mobile: true,
  },
  {
    id: "popular-events",
    label: "Top événements",
    href: "/events?sort=popular",
    icon: Ticket,
    description: "Les événements les plus populaires",
    desktop: true,
    mobile: true,
  },
  {
    id: "about",
    label: "À propos",
    href: "/about",
    icon: Info,
    desktop: true,
    mobile: true,
  },
  {
    id: "contact",
    label: "Contact",
    href: "/contact",
    icon: CircleHelp,
    desktop: true,
    mobile: true,
  },
];

export const CLIENT_ACCOUNT_NAVIGATION: ClientNavigationItem[] = [
  {
    id: "tickets",
    label: "Mes billets",
    href: "/account/tickets",
    icon: Ticket,
    description: "Consulter mes billets",
    requiresAuthentication: true,
    mobile: true,
    bottomNavigation: true,
  },
  {
    id: "orders",
    label: "Mes commandes",
    href: "/account/orders",
    icon: ShoppingBag,
    description: "Historique de mes achats",
    requiresAuthentication: true,
    mobile: true,
  },
  {
    id: "refunds",
    label: "Remboursements",
    href: "/account/refunds",
    icon: RotateCcw,
    description: "Demander et suivre mes remboursements",
    requiresAuthentication: true,
    mobile: true,
  },
  {
    id: "favorites",
    label: "Mes favoris",
    href: "/favorites",
    icon: Heart,
    description: "Événements enregistrés",
    mobile: true,
    bottomNavigation: true,
  },
  {
    id: "profile",
    label: "Mon profil",
    href: "/account/profile",
    icon: UserRound,
    description: "Informations personnelles",
    requiresAuthentication: true,
    mobile: true,
    bottomNavigation: true,
  },
  {
    id: "settings",
    label: "Paramètres",
    href: "/account/settings",
    icon: Settings,
    description: "Préférences du compte",
    requiresAuthentication: true,
    mobile: true,
  },
];

export const CLIENT_INFORMATION_NAVIGATION: ClientNavigationItem[] = [
  {
    id: "help",
    label: "Aide et support",
    href: "/help",
    icon: CircleHelp,
    description: "Obtenir de l’aide",
    mobile: true,
  },
  {
    id: "about-mobile",
    label: "À propos",
    href: "/about",
    icon: Info,
    description: "Découvrir Tikemia",
    mobile: true,
  },
];

export const CLIENT_MOBILE_NAVIGATION_GROUPS: ClientNavigationGroup[] = [
  {
    id: "discover",
    title: "Découvrir",
    items: CLIENT_DESKTOP_NAVIGATION.filter(
      (item) =>
        item.id !== "about" &&
        item.id !== "contact",
    ),
  },
  {
    id: "account",
    title: "Mon espace",
    items: CLIENT_ACCOUNT_NAVIGATION,
  },
  {
    id: "information",
    title: "Informations",
    items: CLIENT_INFORMATION_NAVIGATION,
  },
];

export const CLIENT_BOTTOM_NAVIGATION: ClientNavigationItem[] = [
  CLIENT_DESKTOP_NAVIGATION.find(
    (item) => item.id === "home",
  ),
  CLIENT_DESKTOP_NAVIGATION.find(
    (item) => item.id === "explore",
  ),
  CLIENT_ACCOUNT_NAVIGATION.find(
    (item) => item.id === "favorites",
  ),
  CLIENT_ACCOUNT_NAVIGATION.find(
    (item) => item.id === "tickets",
  ),
  CLIENT_ACCOUNT_NAVIGATION.find(
    (item) => item.id === "profile",
  ),
].filter(
  (item): item is ClientNavigationItem =>
    Boolean(item),
);

export const CLIENT_BOTTOM_NAVIGATION_HIDDEN_PREFIXES = [
  "/checkout",
  "/payment",
  "/organizer",
  "/admin",
] as const;

function normalizePathname(
  pathname: string,
): string {
  const normalized = pathname
    .trim()
    .split("?")[0]
    .split("#")[0];

  if (!normalized) {
    return "/";
  }

  return normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
}

function normalizeHref(
  href: string,
): string {
  const normalized = href.trim();

  return normalized || "/";
}

export function getClientNavigationPath(
  href: string,
): string {
  return normalizePathname(
    normalizeHref(href),
  );
}

export function isClientNavigationItemActive({
  pathname,
  href,
}: {
  pathname: string;
  href: string;
}): boolean {
  const currentPath =
    normalizePathname(pathname);

  const targetPath =
    getClientNavigationPath(href);

  if (targetPath === "/") {
    return currentPath === "/";
  }

  return (
    currentPath === targetPath ||
    currentPath.startsWith(
      `${targetPath}/`,
    )
  );
}

export function createClientNavigationHref({
  item,
  isAuthenticated,
  loginHref = "/login",
}: {
  item: ClientNavigationItem;
  isAuthenticated: boolean;
  loginHref?: string;
}): string {
  if (
    item.requiresAuthentication &&
    !isAuthenticated
  ) {
    return `${loginHref}?redirect=${encodeURIComponent(
      item.href,
    )}`;
  }

  return item.href;
}

export function shouldHideClientBottomNavigation({
  pathname,
  hiddenPathPrefixes = CLIENT_BOTTOM_NAVIGATION_HIDDEN_PREFIXES,
}: {
  pathname: string;
  hiddenPathPrefixes?: readonly string[];
}): boolean {
  const currentPath =
    normalizePathname(pathname);

  return hiddenPathPrefixes.some(
    (prefix) => {
      const normalizedPrefix =
        normalizePathname(prefix);

      return (
        currentPath === normalizedPrefix ||
        currentPath.startsWith(
          `${normalizedPrefix}/`,
        )
      );
    },
  );
}

export function getClientDesktopNavigation(): ClientNavigationItem[] {
  return CLIENT_DESKTOP_NAVIGATION.filter(
    (item) =>
      item.desktop !== false,
  );
}

export function getClientMobileNavigationGroups(): ClientNavigationGroup[] {
  return CLIENT_MOBILE_NAVIGATION_GROUPS.map(
    (group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.mobile !== false,
      ),
    }),
  );
}

export function getClientBottomNavigation(): ClientNavigationItem[] {
  return CLIENT_BOTTOM_NAVIGATION.filter(
    (item) =>
      item.bottomNavigation !== false,
  );
}