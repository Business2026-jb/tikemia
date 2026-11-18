
"use client";
import {
  currencySymbol,
  currencyDecimals,
} from "@/i18n/config";




import {
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import {
  CirclePlus,
  Plus,
  Ticket,
  Trash2,
  UsersRound,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

/* ============================================
   TIKEMIA — CATÉGORIES DE BILLETS

   Composant :
   EventTicketCategories

   Fonctionnalités :
   - Ajouter une catégorie
   - Modifier une catégorie
   - Supprimer une catégorie
   - Définir le prix
   - Définir les places disponibles
   - Calculer la capacité totale
   - Comparer les places avec la capacité
   - Français / Anglais
   - Responsive PC / Mobile

   Aucune donnée fictive.
   Aucun fichier CSS supplémentaire.
============================================ */

/* ============================================
   TYPES EXPORTÉS
============================================ */

export type EventTicketCategory = {
  id: string;
  name: string;
  price: string;
  quantity: string;
};

export type EventTicketCategoriesProps = {
  categories?: EventTicketCategory[];
  onChange?: (
    categories: EventTicketCategory[]
  ) => void;
  totalCapacity?: number | null;
  currency?: string;
  locale?: "fr" | "en";
  disabled?: boolean;
  className?: string;
};

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    title: "Catégories de billets",
    description:
      "Définissez les catégories, les prix et les places disponibles.",
    add: "Ajouter une catégorie",
    number: "#",
    name: "Nom de la catégorie",
    price: "Prix du billet",
    quantity: "Places disponibles",
    actions: "Actions",
    namePlaceholder: "Ex. VIP",
    pricePlaceholder: "Ex. 25000",
    quantityPlaceholder: "Ex. 500",
    remove: "Supprimer la catégorie",
    total: "Total des places",
    capacity: "Capacité déclarée",
    remaining: "Places restantes à répartir",
    excess: "Places en trop",
    matched: "Capacité correctement répartie",
    invalidPrice: "Prix invalide",
    invalidQuantity: "Quantité invalide",
    emptyName: "Nom obligatoire",
    duplicateName: "Nom déjà utilisé",
    required: "Champ obligatoire",
    atLeastOne:
      "Ajoutez au moins une catégorie de billets.",
  },
  en: {
    title: "Ticket categories",
    description:
      "Set ticket categories, prices and available seats.",
    add: "Add a category",
    number: "#",
    name: "Category name",
    price: "Ticket price",
    quantity: "Available seats",
    actions: "Actions",
    namePlaceholder: "e.g. VIP",
    pricePlaceholder: "e.g. 25000",
    quantityPlaceholder: "e.g. 500",
    remove: "Remove category",
    total: "Total seats",
    capacity: "Declared capacity",
    remaining: "Seats left to allocate",
    excess: "Excess seats",
    matched: "Capacity correctly allocated",
    invalidPrice: "Invalid price",
    invalidQuantity: "Invalid quantity",
    emptyName: "Name required",
    duplicateName: "Name already used",
    required: "Required field",
    atLeastOne:
      "Add at least one ticket category.",
  },
} as const;

/* ============================================
   VALEUR INITIALE

   Une catégorie vide seulement.
   Aucun prix ni aucune quantité inventés.
============================================ */

function initialCategories(): EventTicketCategory[] {
  return [
    {
      id: "initial-ticket-category",
      name: "",
      price: "",
      quantity: "",
    },
  ];
}

/* ============================================
   UTILITAIRES
============================================ */

function createCategory(): EventTicketCategory {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: "",
    quantity: "",
  };
}

function normalizeCategoryName(
  name: string
): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizePrice(
  value: string
): string {
  return value
    .replace(/\s/g, "")
    .replace(",", ".");
}

function isValidPrice(
  value: string,
  currency = "XOF"
): boolean {
  const normalized = normalizePrice(value);

  if (
    !/^\d{1,12}(?:\.\d{1,2})?$/.test(
      normalized
    )
  ) {
    return false;
  }

  const amount = Number(normalized);

  return (
    Number.isFinite(amount) &&
    amount >= 0 &&
    amount <= 999_999_999 &&
    (currencyDecimals(currency) !== 0 || Number.isInteger(amount))
  );
}

function isValidQuantity(
  value: string
): boolean {
  if (!/^\d{1,9}$/.test(value)) {
    return false;
  }

  const quantity = Number(value);

  return (
    Number.isSafeInteger(quantity) &&
    quantity > 0 && quantity <= 1_000_000
  );
}

function formatNumber(
  value: number,
  locale: "fr" | "en"
): string {
  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US",
    {
      maximumFractionDigits: 0,
    }
  ).format(value);
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function EventTicketCategories({
  categories,
  onChange,
  totalCapacity = null,
  currency = "XOF",
  locale = "fr",
  disabled = false,
  className = "",
}: EventTicketCategoriesProps) {
  /* ==========================================
     GESTION DE L'ÉTAT

     Compatible :
     - Composant autonome
     - Composant contrôlé par la page
  ========================================== */

  const [localCategories, setLocalCategories] =
    useState<EventTicketCategory[]>(
      initialCategories
    );

  const [attemptedValidation, setAttemptedValidation] =
    useState(false);

  const items = categories ?? localCategories;
  const t = TEXT[locale];

  /* ==========================================
     MISE À JOUR DES CATÉGORIES
  ========================================== */

  function applyChanges(
    nextCategories: EventTicketCategory[]
  ) {
    if (disabled) {
      return;
    }

    if (categories === undefined) {
      setLocalCategories(nextCategories);
    }

    onChange?.(nextCategories);
  }

  /* ==========================================
     AJOUTER UNE CATÉGORIE
  ========================================== */

  function handleAdd() {
    if (items.length >= 30) return;
    applyChanges([
      ...items,
      createCategory(),
    ]);
  }

  /* ==========================================
     MODIFIER UNE CATÉGORIE
  ========================================== */

  function handleFieldChange(
    id: string,
    field: "name" | "price" | "quantity",
    value: string
  ) {
    let updatedValue = value;

    if (field === "name") {
      updatedValue = value.slice(0, 80);
    }

    if (field === "price") {
      // Permet les nombres avec virgule
      // ou point, selon le pays.

      const cleaned = value.replace(/\s/g, "");

      if (
        cleaned &&
        !/^\d{0,12}(?:[.,]\d{0,2})?$/.test(
          cleaned
        )
      ) {
        return;
      }

      updatedValue = cleaned;
    }

    if (field === "quantity") {
      if (
        value &&
        !/^\d{0,9}$/.test(value)
      ) {
        return;
      }
    }

    const nextCategories = items.map(
      (category) =>
        category.id === id
          ? {
              ...category,
              [field]: updatedValue,
            }
          : category
    );

    applyChanges(nextCategories);
  }

  /* ==========================================
     SUPPRIMER UNE CATÉGORIE
  ========================================== */

  function handleRemove(id: string) {
    const nextCategories = items.filter(
      (category) => category.id !== id
    );

    applyChanges(nextCategories);
  }

  /* ==========================================
     ANALYSE DES CATÉGORIES
  ========================================== */

  const analysis = useMemo(() => {
    let totalSeats = 0;
    let hasInvalidFields = false;

    const names = new Map<string, number>();

    for (const category of items) {
      const name = normalizeCategoryName(
        category.name
      ).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      if (name) {
        names.set(
          name,
          (names.get(name) ?? 0) + 1
        );
      }

      if (
        !name ||
        !isValidPrice(category.price, currency) ||
        !isValidQuantity(category.quantity)
      ) {
        hasInvalidFields = true;
      }

      if (isValidQuantity(category.quantity)) {
        totalSeats += Number(
          category.quantity
        );
      }
    }

    return {
      totalSeats,
      hasInvalidFields,
      names,
      hasCategories: items.length > 0,
    };
  }, [items, currency]);

  /* ==========================================
     CAPACITÉ DE L'ÉVÉNEMENT
  ========================================== */

  const hasCapacity =
    totalCapacity !== null &&
    Number.isSafeInteger(totalCapacity) &&
    totalCapacity > 0;

  const capacity = hasCapacity
    ? totalCapacity
    : null;

  const difference =
    capacity === null
      ? null
      : capacity - analysis.totalSeats;

  const capacityMatches =
    difference === 0 &&
    !analysis.hasInvalidFields &&
    analysis.hasCategories;

  /* ==========================================
     VALIDATION DES CHAMPS
  ========================================== */

  function getFieldError(
    category: EventTicketCategory,
    field: "name" | "price" | "quantity"
  ): string | null {
    const name = normalizeCategoryName(
      category.name
    );

    if (field === "name") {
      if (!name) {
        return attemptedValidation
          ? t.emptyName
          : null;
      }

      if (
        (analysis.names.get(
          name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        ) ?? 0) > 1
      ) {
        return t.duplicateName;
      }

      return null;
    }

    const value = category[field];

    if (!value) {
      return attemptedValidation
        ? t.required
        : null;
    }

    if (field === "price") {
      return isValidPrice(value, currency)
        ? null
        : t.invalidPrice;
    }

    return isValidQuantity(value)
      ? null
      : t.invalidQuantity;
  }

  /* ==========================================
     CONTRÔLE SUR SORTIE D'UN CHAMP
  ========================================== */

  function handleBlur() {
    setAttemptedValidation(true);
  }

  /* ==========================================
     CHAMP COMMUN

     La mise en page reste adaptée à
     chaque taille d'écran.
  ========================================== */

  function renderInput(
    category: EventTicketCategory,
    index: number,
    field: "name" | "price" | "quantity"
  ) {
    const isName = field === "name";
    const isPrice = field === "price";

    const label = isName
      ? t.name
      : isPrice
        ? t.price
        : t.quantity;

    const placeholder = isName
      ? t.namePlaceholder
      : isPrice
        ? t.pricePlaceholder
        : t.quantityPlaceholder;

    const error = getFieldError(
      category,
      field
    );

    function handleChange(
      event: ChangeEvent<HTMLInputElement>
    ) {
      handleFieldChange(
        category.id,
        field,
        event.target.value
      );
    }

    return (
      <div
        key={field}
        className="min-w-0 flex-1"
      >
        {/* Libellé mobile */}

        <label
          htmlFor={`tk-ticket-${field}-${category.id}`}
          className="mb-1.5 block text-xs font-bold text-[#142138] md:sr-only"
        >
          {label}
          {isPrice && (
            <span className="ml-1 font-medium text-gray-500">
              ({currencySymbol(currency)})
            </span>
          )}
        </label>

        <input
          id={`tk-ticket-${field}-${category.id}`}
          name={`ticketCategories.${index}.${field}`}
          type="text"
          inputMode={
            isName
              ? "text"
              : isPrice
                ? "decimal"
                : "numeric"
          }
          autoComplete="off"
          required
          maxLength={
            isName ? 80 : isPrice ? 15 : 9
          }
          value={category[field]}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `tk-ticket-error-${field}-${category.id}`
              : undefined
          }
          placeholder={placeholder}
          className={[
            "h-10 w-full min-w-0",
            "rounded-lg border bg-white",
            "px-3 text-sm font-medium",
            "text-[#142138]",
            "placeholder:font-normal",
            "placeholder:text-gray-400",
            "outline-none transition-colors",
            "focus:border-green-600",
            "focus:ring-2 focus:ring-green-100",
            "disabled:cursor-not-allowed",
            "disabled:bg-gray-100",
            error
              ? "border-red-400"
              : "border-[#cbd5e1]",
          ].join(" ")}
        />

        {error && (
          <p
            id={`tk-ticket-error-${field}-${category.id}`}
            className="mt-1 text-[11px] font-medium text-red-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  /* ==========================================
     AFFICHAGE
  ========================================== */

  return (
    <section
      aria-labelledby="tk-ticket-categories-title"
      className={[
        "w-full min-w-0",
        "rounded-2xl border border-[#e4e8ed]",
        "bg-white",
        "p-3 shadow-sm",
        "sm:p-4",
        className,
      ].join(" ")}
    >
      {/* ======================================
          EN-TÊTE
      ====================================== */}

      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Ticket
            size={30}
            strokeWidth={2.3}
            className="-rotate-12 shrink-0 text-[#21ba00]"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <h2
              id="tk-ticket-categories-title"
              className="text-base leading-tight font-extrabold text-[#101828] sm:text-lg"
            >
              {t.title}{" "}
              <span className="text-red-600">
                *
              </span>
            </h2>

            <p className="mt-1 hidden text-xs leading-relaxed text-gray-500 sm:block">
              {t.description}
            </p>
          </div>
        </div>

        {/* AJOUTER UNE CATÉGORIE */}

        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || items.length >= 30}
          className={[
            "inline-flex min-h-10",
            "items-center justify-center",
            "gap-2 rounded-full",
            "border border-green-700",
            "bg-white px-3 py-2",
            "text-xs font-extrabold",
            "text-green-800",
            "transition-colors",
            "hover:bg-green-50",
            "focus-visible:outline-2",
            "focus-visible:outline-green-700",
            "disabled:cursor-not-allowed",
            "disabled:opacity-50",
            "sm:px-4 sm:text-sm",
          ].join(" ")}
        >
          <Plus
            size={17}
            strokeWidth={2.5}
            aria-hidden="true"
          />

          {t.add}
        </button>
      </div>

      {/* ======================================
          ZONE DES CATÉGORIES
      ====================================== */}

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-[#e5eaf0]">
        {/* EN-TÊTES PC */}

        <div
          className={[
            "hidden md:grid",
            "grid-cols-[34px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_46px]",
            "items-center gap-3",
            "bg-[#f2f5f8]",
            "px-3 py-3",
            "text-xs font-extrabold",
            "text-[#142138]",
          ].join(" ")}
        >
          <span className="text-center">
            {t.number}
          </span>

          <span>{t.name}</span>

          <span>
            {t.price} ({currencySymbol(currency)})
          </span>

          <span>{t.quantity}</span>

          <span className="text-center">
            {t.actions}
          </span>
        </div>

        {/* LIGNES */}

        {items.length > 0 ? (
          <div className="divide-y divide-[#e5eaf0]">
            {items.map((category, index) => (
              <div
                key={category.id}
                className={[
                  "grid w-full min-w-0",
                  "grid-cols-2 gap-3",
                  "bg-white p-3",
                  "md:grid-cols-[34px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_46px]",
                  "md:items-start md:gap-3",
                  "md:px-3 md:py-2",
                ].join(" ")}
              >
                {/* NUMÉRO */}

                <div className="col-span-2 flex items-center justify-between md:col-span-1 md:h-10 md:justify-center">
                  <span className="text-xs font-extrabold text-green-800 md:text-gray-700">
                    {index + 1}
                  </span>

                  {/* ACTION MOBILE */}

                  <button
                    type="button"
                    onClick={() =>
                      handleRemove(category.id)
                    }
                    disabled={disabled}
                    aria-label={`${t.remove} ${index + 1}`}
                    title={t.remove}
                    className="flex size-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-40 md:hidden"
                  >
                    <Trash2 size={19} />
                  </button>
                </div>

                {/* NOM */}

                <div className="col-span-2 min-w-0 md:col-span-1">
                  {renderInput(
                    category,
                    index,
                    "name"
                  )}
                </div>

                {/* PRIX */}

                <div className="min-w-0">
                  {renderInput(
                    category,
                    index,
                    "price"
                  )}
                </div>

                {/* QUANTITÉ */}

                <div className="min-w-0">
                  {renderInput(
                    category,
                    index,
                    "quantity"
                  )}
                </div>

                {/* ACTION PC */}

                <div className="hidden h-10 items-center justify-center md:flex">
                  <button
                    type="button"
                    onClick={() =>
                      handleRemove(category.id)
                    }
                    disabled={disabled}
                    aria-label={`${t.remove} ${index + 1}`}
                    title={t.remove}
                    className="flex size-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-40"
                  >
                    <Trash2
                      size={19}
                      strokeWidth={2}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <CirclePlus
              size={29}
              className="text-green-700"
            />

            <p className="text-sm text-gray-600">
              {t.atLeastOne}
            </p>

            <button
              type="button"
              onClick={handleAdd}
              disabled={disabled}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {t.add}
            </button>
          </div>
        )}
      </div>

      {/* ======================================
          TOTAL DES PLACES
      ====================================== */}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f5faf5] px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <UsersRound
            size={20}
            className="text-green-800"
            aria-hidden="true"
          />

          <span className="text-sm font-semibold text-[#142138]">
            {t.total}
          </span>
        </div>

        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-extrabold text-green-800 shadow-sm">
          {formatNumber(
            analysis.totalSeats,
            locale
          )}
        </span>
      </div>

      {/* ======================================
          CONTRÔLE DE CAPACITÉ

          Affiché uniquement lorsque
          la capacité totale est fournie
          par le formulaire principal.
      ====================================== */}

      {capacity !== null && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 sm:text-sm">
            <span>{t.capacity}</span>

            <span className="font-bold text-[#142138]">
              {formatNumber(capacity, locale)}
            </span>
          </div>

          {difference !== null &&
            !analysis.hasInvalidFields &&
            analysis.hasCategories && (
              <div
                role="status"
                className={[
                  "flex items-start gap-2",
                  "rounded-xl border",
                  "px-3 py-2.5",
                  "text-xs font-semibold",
                  "sm:text-sm",
                  capacityMatches
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                ].join(" ")}
              >
                {capacityMatches ? (
                  <CheckCircle2
                    size={19}
                    className="shrink-0"
                  />
                ) : (
                  <AlertCircle
                    size={19}
                    className="shrink-0"
                  />
                )}

                <span>
                  {capacityMatches
                    ? t.matched
                    : difference > 0
                      ? `${t.remaining} : ${formatNumber(
                          difference,
                          locale
                        )}`
                      : `${t.excess} : ${formatNumber(
                          Math.abs(difference),
                          locale
                        )}`}
                </span>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
