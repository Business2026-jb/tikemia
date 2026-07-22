"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import OrganizerFooter from "@/components/organizer/organizer-footer";
import OrganizerMobileHeader from "@/components/organizer/organizer-mobile-header";
import OrganizerMobileMenu from "@/components/organizer/organizer-mobile-menu";
import OrganizerSidebar from "@/components/organizer/organizer-sidebar";
import OrganizerTopbar from "@/components/organizer/organizer-topbar";

type OrganizerShellProps = Readonly<{
  children: ReactNode;

  /**
   * Nom principal affiché dans l’espace organisateur.
   * Il peut correspondre au nom de l’organisation
   * ou, à défaut, au nom complet de l’organisateur.
   */
  organizerName?: string;

  /**
   * Nom complet personnel de l’organisateur.
   */
  organizerFullName?: string;

  organizerEmail?: string;

  /**
   * Initiales utilisées lorsqu’aucune photo
   * de profil n’est disponible.
   */
  organizerInitials?: string;

  /**
   * Photo personnelle de l’organisateur.
   */
  organizerAvatarUrl?: string | null;

  /**
   * Logo professionnel de l’organisation.
   * Il reste distinct de la photo personnelle.
   */
  organizerLogoUrl?: string | null;

  organizerBusinessName?: string | null;

  notificationCount?: number;
}>;

const DEFAULT_ORGANIZER_NAME =
  "Organisateur Tikemia";

const DEFAULT_ORGANIZER_EMAIL =
  "contact@tikemia.com";

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalUrl(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim() ?? "";

  return normalizedValue || null;
}

function buildFallbackInitials(
  value: string,
): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "OR";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0].charAt(0)}${words[
    words.length - 1
  ].charAt(0)}`.toUpperCase();
}

export default function OrganizerShell({
  children,

  organizerName = DEFAULT_ORGANIZER_NAME,
  organizerFullName = DEFAULT_ORGANIZER_NAME,
  organizerEmail = DEFAULT_ORGANIZER_EMAIL,
  organizerInitials,
  organizerAvatarUrl = null,
  organizerLogoUrl = null,
  organizerBusinessName = null,

  notificationCount = 0,
}: OrganizerShellProps) {
  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const normalizedOrganizer =
    useMemo(() => {
      const fullName =
        normalizeText(
          organizerFullName,
        ) ||
        normalizeText(
          organizerName,
        ) ||
        DEFAULT_ORGANIZER_NAME;

      const businessName =
        normalizeText(
          organizerBusinessName,
        ) || null;

      const displayName =
        normalizeText(
          organizerName,
        ) ||
        businessName ||
        fullName;

      const email =
        normalizeText(
          organizerEmail,
        ) ||
        DEFAULT_ORGANIZER_EMAIL;

      const initials =
        normalizeText(
          organizerInitials,
        )
          .replace(/\s+/g, "")
          .slice(0, 2)
          .toUpperCase() ||
        buildFallbackInitials(
          fullName,
        );

      return {
        displayName,
        fullName,
        businessName,
        email,
        initials,

        avatarUrl:
          normalizeOptionalUrl(
            organizerAvatarUrl,
          ),

        logoUrl:
          normalizeOptionalUrl(
            organizerLogoUrl,
          ),
      };
    }, [
      organizerAvatarUrl,
      organizerBusinessName,
      organizerEmail,
      organizerFullName,
      organizerInitials,
      organizerLogoUrl,
      organizerName,
    ]);

  const safeNotificationCount =
    Number.isFinite(
      notificationCount,
    )
      ? Math.max(
          0,
          Math.trunc(
            notificationCount,
          ),
        )
      : 0;

  const closeMobileMenu =
    useCallback(() => {
      setMobileMenuOpen(false);
    }, []);

  const toggleMobileMenu =
    useCallback(() => {
      setMobileMenuOpen(
        (current) => !current,
      );
    }, []);

  const handleLogout =
    useCallback(async () => {
      if (isLoggingOut) {
        return;
      }

      setIsLoggingOut(true);
      setMobileMenuOpen(false);

      try {
        const response =
          await fetch(
            "/api/organizer/auth/logout",
            {
              method: "POST",

              headers: {
                Accept:
                  "application/json",
              },

              cache: "no-store",
            },
          );

        if (!response.ok) {
          let message =
            "Impossible de vous déconnecter.";

          try {
            const result =
              (await response.json()) as {
                message?: string;
              };

            if (
              result.message?.trim()
            ) {
              message =
                result.message;
            }
          } catch {
            // La réponse ne contient pas de JSON lisible.
          }

          throw new Error(
            message,
          );
        }

        window.location.replace(
          "/organizer/login",
        );
      } catch (error) {
        console.error(
          "[ORGANIZER_LOGOUT_ERROR]",
          error instanceof Error
            ? {
                name:
                  error.name,
                message:
                  error.message,
              }
            : error,
        );

        setIsLoggingOut(false);
      }
    }, [isLoggingOut]);

  return (
    <div className="min-h-screen w-full bg-[#05090c] text-white">
      {/* Navigation latérale — ordinateur */}
      <OrganizerSidebar
        organizerName={
          normalizedOrganizer.displayName
        }
        organizerEmail={
          normalizedOrganizer.email
        }
        organizerAvatarUrl={
          normalizedOrganizer.avatarUrl
        }
      />

      {/* En-tête — mobile et tablette */}
      <OrganizerMobileHeader
        organizerName={
          normalizedOrganizer.displayName
        }
        organizerEmail={
          normalizedOrganizer.email
        }
        organizerAvatarUrl={
          normalizedOrganizer.avatarUrl
        }
        notificationCount={
          safeNotificationCount
        }
        menuOpen={
          mobileMenuOpen
        }
        onOpenMenu={
          toggleMobileMenu
        }
      />

      {/* Menu latéral mobile */}
      <OrganizerMobileMenu
        open={
          mobileMenuOpen
        }
        onClose={
          closeMobileMenu
        }
        organizerName={
          normalizedOrganizer.displayName
        }
        organizerEmail={
          normalizedOrganizer.email
        }
        organizerAvatarUrl={
          normalizedOrganizer.avatarUrl
        }
        onLogout={
          handleLogout
        }
      />

      {/* Zone principale */}
      <div className="flex min-h-screen w-full min-w-0 flex-col lg:pl-[248px]">
        {/* Barre supérieure — ordinateur */}
        <OrganizerTopbar
          organizerName={
            normalizedOrganizer.displayName
          }
          organizerEmail={
            normalizedOrganizer.email
          }
          organizerAvatarUrl={
            normalizedOrganizer.avatarUrl
          }
          notificationCount={
            safeNotificationCount
          }
        />

        {/* Contenu des pages protégées */}
        <main className="flex w-full min-w-0 flex-1 overflow-x-hidden">
          <div className="w-full min-w-0 max-w-none">
            {children}
          </div>
        </main>

        <OrganizerFooter />
      </div>

      {/* Écran sécurisé pendant la déconnexion */}
      {isLoggingOut && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm"
        >
          <div className="w-full max-w-[340px] rounded-2xl border border-white/[0.09] bg-[#081015] p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.6)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-lime-400" />

            <p className="mt-4 text-sm font-bold text-white">
              Déconnexion en cours
            </p>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Votre session organisateur se ferme
              en toute sécurité.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}