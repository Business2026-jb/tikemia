import Link from "next/link";

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

export type ClientFooterLinksProps = {
  sections?: ClientFooterLinkSection[];
  className?: string;
};

export const DEFAULT_CLIENT_FOOTER_SECTIONS: ClientFooterLinkSection[] = [
  {
    id: "discover",
    title: "Découvrir",
    links: [
      {
        label: "Accueil",
        href: "/",
      },
      {
        label: "Explorer les événements",
        href: "/events",
      },
      {
        label: "Catégories",
        href: "/categories",
      },
      {
        label: "Top événements",
        href: "/events?sort=popular",
      },
      {
        label: "Événements à venir",
        href: "/events?period=upcoming",
      },
      {
        label: "Rechercher",
        href: "/search",
      },
    ],
  },
  {
    id: "account",
    title: "Mon espace",
    links: [
      {
        label: "Mes billets",
        href: "/account/tickets",
      },
      {
        label: "Mes commandes",
        href: "/account/orders",
      },
      {
        label: "Mes favoris",
        href: "/favorites",
      },
      {
        label: "Transférer un billet",
        href: "/account/transfers",
      },
      {
        label: "Mon profil",
        href: "/account/profile",
      },
      {
        label: "Paramètres",
        href: "/account/settings",
      },
    ],
  },
  {
    id: "help",
    title: "Aide et informations",
    links: [
      {
        label: "Centre d’aide",
        href: "/help",
      },
      {
        label: "FAQ",
        href: "/faq",
      },
      {
        label: "À propos",
        href: "/about",
      },
      {
        label: "Contact",
        href: "/contact",
      },
      {
        label: "Conditions d’utilisation",
        href: "/terms",
      },
      {
        label: "Politique de confidentialité",
        href: "/privacy-policy",
      },
      {
        label: "Retours et remboursements",
        href: "/refund-policy",
      },
    ],
  },
];

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function isExternalHref(href: string): boolean {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

export default function ClientFooterLinks({
  sections = DEFAULT_CLIENT_FOOTER_SECTIONS,
  className,
}: ClientFooterLinksProps) {
  return (
    <nav
      aria-label="Liens du pied de page"
      className={cn(
        "grid min-w-0 gap-8 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`client-footer-section-${section.id}`}
          className="min-w-0"
        >
          <h2
            id={`client-footer-section-${section.id}`}
            className="text-sm font-black text-white"
          >
            {section.title}
          </h2>

          <ul className="mt-4 space-y-3">
            {section.links.map((item) => {
              const external =
                item.external ?? isExternalHref(item.href);

              return (
                <li key={`${section.id}-${item.href}-${item.label}`}>
                  {external ? (
                    <a
                      href={item.href}
                      target={
                        item.href.startsWith("http")
                          ? "_blank"
                          : undefined
                      }
                      rel={
                        item.href.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                      aria-label={item.ariaLabel}
                      className="group inline-flex max-w-full items-center gap-2 text-sm text-neutral-500 transition hover:text-white focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      <span className="truncate">
                        {item.label}
                      </span>

                      <span
                        aria-hidden="true"
                        className="translate-x-0 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-emerald-400"
                      >
                        →
                      </span>
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      aria-label={item.ariaLabel}
                      className="group inline-flex max-w-full items-center gap-2 text-sm text-neutral-500 transition hover:text-white focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      <span className="truncate">
                        {item.label}
                      </span>

                      <span
                        aria-hidden="true"
                        className="translate-x-0 text-neutral-700 transition group-hover:translate-x-0.5 group-hover:text-emerald-400"
                      >
                        →
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}