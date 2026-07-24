import {
  CreditCard,
  Info,
  Landmark,
  Smartphone,
  WalletCards,
} from "lucide-react";

export type ClientPaymentMethod = {
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

export type ClientPaymentMethodsProps = {
  methods?: ClientPaymentMethod[];
  className?: string;
  title?: string;
  description?: string;
};

export const DEFAULT_CLIENT_PAYMENT_METHODS: ClientPaymentMethod[] = [
  {
    id: "visa",
    label: "Visa",
    shortLabel: "VISA",
    category: "card",
    description: "Carte bancaire internationale",
  },
  {
    id: "mastercard",
    label: "Mastercard",
    shortLabel: "MC",
    category: "card",
    description: "Carte bancaire internationale",
  },
  {
    id: "mtn-momo",
    label: "MTN MoMo",
    shortLabel: "MTN",
    category: "mobile-money",
    description: "Paiement Mobile Money",
  },
  {
    id: "moov-money",
    label: "Moov Money",
    shortLabel: "MOOV",
    category: "mobile-money",
    description: "Paiement Mobile Money",
  },
  {
    id: "orange-money",
    label: "Orange Money",
    shortLabel: "OM",
    category: "mobile-money",
    description: "Paiement Mobile Money",
  },
  {
    id: "wave",
    label: "Wave",
    shortLabel: "WAVE",
    category: "wallet",
    description: "Portefeuille mobile",
  },
];

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes.filter(Boolean).join(" ");
}

function getPaymentMethodIcon(
  category: ClientPaymentMethod["category"],
) {
  if (category === "card") {
    return CreditCard;
  }

  if (category === "mobile-money") {
    return Smartphone;
  }

  if (category === "bank") {
    return Landmark;
  }

  return WalletCards;
}

export default function ClientPaymentMethods({
  methods = DEFAULT_CLIENT_PAYMENT_METHODS,
  className,
  title = "Moyens de paiement acceptés",
  description =
    "Les options disponibles peuvent varier selon le pays et l’événement.",
}: ClientPaymentMethodsProps) {
  if (methods.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="client-payment-methods-title"
      className={cn(
        "rounded-3xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300">
              <CreditCard className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <h2
                id="client-payment-methods-title"
                className="text-sm font-black text-white"
              >
                {title}
              </h2>

              <p className="mt-1 text-[11px] leading-5 text-neutral-600">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
          {methods.map((method) => {
            const Icon = getPaymentMethodIcon(
              method.category,
            );

            return (
              <article
                key={method.id}
                title={method.description}
                className="group flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.045]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-black/10 text-neutral-500 transition group-hover:text-emerald-300">
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-neutral-300 group-hover:text-white">
                    {method.shortLabel ??
                      method.label}
                  </p>

                  <p className="mt-0.5 truncate text-[9px] text-neutral-700">
                    {method.label}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-500/15 bg-sky-500/[0.04] px-3 py-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

        <p className="text-[10px] leading-5 text-neutral-600">
          Le moyen de paiement final est confirmé au moment de la
          commande selon le pays, la devise et l’événement sélectionné.
        </p>
      </div>
    </section>
  );
}