"use client";

import { usePathname } from "next/navigation";

import ClientFooter from "@/components/client/footer/client-footer";

const EXACT_PATHS_WITHOUT_FOOTER = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
] as const;

const PATH_PREFIXES_WITHOUT_FOOTER = [
  "/checkout",
  "/payment",
  "/account",
  "/reset-password",
] as const;

function isEventDetailPath(pathname: string): boolean {
  const segments = pathname
    .split("/")
    .filter(Boolean);

  return (
    segments.length === 2 &&
    segments[0] === "events"
  );
}

function shouldHideFooter(pathname: string): boolean {
  if (
    EXACT_PATHS_WITHOUT_FOOTER.includes(
      pathname as (typeof EXACT_PATHS_WITHOUT_FOOTER)[number],
    )
  ) {
    return true;
  }

  if (
    PATH_PREFIXES_WITHOUT_FOOTER.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  return isEventDetailPath(pathname);
}

export default function ClientConditionalFooter() {
  const pathname = usePathname();

  if (shouldHideFooter(pathname)) {
    return null;
  }

  return (
    <div className="pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0">
      <ClientFooter />
    </div>
  );
}