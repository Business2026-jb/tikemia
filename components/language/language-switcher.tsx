"use client";

import {
  useTransition,
} from "react";

import {
  Languages,
} from "lucide-react";

import {
  useLocale,
  useTranslations,
} from "next-intl";

import {
  useRouter,
} from "next/navigation";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
  type AppLocale,
} from "@/lib/i18n/config";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

function setLocaleCookie(
  locale: AppLocale,
): void {
  if (
    typeof document ===
    "undefined"
  ) {
    return;
  }

  const isProduction =
    process.env.NODE_ENV ===
    "production";

  const secureAttribute =
    isProduction
      ? "; Secure"
      : "";

  document.cookie =
    `${LOCALE_COOKIE_NAME}=${locale}; ` +
    `Path=/; ` +
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}; ` +
    `SameSite=Lax${secureAttribute}`;
}

export default function LanguageSwitcher({
  className,
  compact = false,
}: LanguageSwitcherProps) {
  const router =
    useRouter();

  const currentLocale =
    useLocale();

  const t =
    useTranslations(
      "language",
    );

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  const activeLocale:
    AppLocale =
    isSupportedLocale(
      currentLocale,
    )
      ? currentLocale
      : DEFAULT_LOCALE;

  function changeLocale(
    nextLocale:
      AppLocale,
  ): void {
    if (
      nextLocale ===
        activeLocale ||
      isPending
    ) {
      return;
    }

    setLocaleCookie(
      nextLocale,
    );

    startTransition(
      () => {
        router.refresh();
      },
    );
  }

  const rootClassName =
    [
      "tikemia-language-switcher",
      compact
        ? "tikemia-language-switcher--compact"
        : "",
      className ?? "",
    ]
      .filter(
        Boolean,
      )
      .join(
        " ",
      );

  return (
    <div
      className={
        rootClassName
      }
      role="group"
      aria-label={
        t(
          "label",
        )
      }
      data-pending={
        isPending
          ? "true"
          : "false"
      }
    >
      <span
        className="tikemia-language-switcher__icon"
        aria-hidden="true"
      >
        <Languages
          size={
            compact
              ? 16
              : 18
          }
          strokeWidth={
            2
          }
        />
      </span>

      <button
        type="button"
        className={[
          "tikemia-language-switcher__button",
          activeLocale ===
          "fr"
            ? "tikemia-language-switcher__button--active"
            : "",
        ]
          .filter(
            Boolean,
          )
          .join(
            " ",
          )}
        onClick={
          () =>
            changeLocale(
              "fr",
            )
        }
        disabled={
          isPending
        }
        aria-pressed={
          activeLocale ===
          "fr"
        }
        aria-label={
          t(
            "switchToFrench",
          )
        }
      >
        {
          t(
            "shortFrench",
          )
        }
      </button>

      <span
        className="tikemia-language-switcher__separator"
        aria-hidden="true"
      >
        /
      </span>

      <button
        type="button"
        className={[
          "tikemia-language-switcher__button",
          activeLocale ===
          "en"
            ? "tikemia-language-switcher__button--active"
            : "",
        ]
          .filter(
            Boolean,
          )
          .join(
            " ",
          )}
        onClick={
          () =>
            changeLocale(
              "en",
            )
        }
        disabled={
          isPending
        }
        aria-pressed={
          activeLocale ===
          "en"
        }
        aria-label={
          t(
            "switchToEnglish",
          )
        }
      >
        {
          t(
            "shortEnglish",
          )
        }
      </button>

      {isPending ? (
        <span
          className="sr-only"
          aria-live="polite"
        >
          {
            t(
              "changing",
            )
          }
        </span>
      ) : null}
    </div>
  );
}