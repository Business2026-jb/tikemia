import {
  BadgeCheck,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

export type ClientTrustBarItem = {
  id: string;
  label: string;
  description: string;
  icon:
    | typeof LockKeyhole
    | typeof TicketCheck
    | typeof ShieldCheck
    | typeof Headphones
    | typeof BadgeCheck;
};

export type ClientTrustBarProps = {
  items?: ClientTrustBarItem[];
  className?: string;
};

export const DEFAULT_CLIENT_TRUST_ITEMS: ClientTrustBarItem[] = [
  {
    id: "secure-payments",
    label: "Paiements sécurisés",
    description: "Transactions protégées",
    icon: LockKeyhole,
  },
  {
    id: "verified-tickets",
    label: "Billets vérifiés",
    description: "QR codes uniques",
    icon: TicketCheck,
  },
  {
    id: "protected-data",
    label: "Données protégées",
    description: "Confidentialité renforcée",
    icon: ShieldCheck,
  },
  {
    id: "customer-support",
    label: "Support disponible",
    description: "Assistance client",
    icon: Headphones,
  },
  {
    id: "reliable-platform",
    label: "Plateforme fiable",
    description: "Expérience sécurisée",
    icon: BadgeCheck,
  },
];

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export default function ClientTrustBar({
  items = DEFAULT_CLIENT_TRUST_ITEMS,
  className,
}: ClientTrustBarProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Garanties Tikemia"
      className={cn(
        "relative border-b border-white/[0.07] bg-white/[0.012]",
        className,
      )}
    >
      <div className="mx-auto grid w-full max-w-[1600px] gap-3 px-4 py-5 sm:grid-cols-2 sm:px-5 lg:grid-cols-5 xl:px-8">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.id}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.035]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300 transition group-hover:border-emerald-500/30 group-hover:bg-emerald-500/[0.11]">
                <Icon
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                />
              </span>

              <div className="min-w-0">
                <h2 className="truncate text-xs font-black text-white">
                  {item.label}
                </h2>

                <p className="mt-0.5 truncate text-[10px] text-neutral-600">
                  {item.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}