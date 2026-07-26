"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("ADMIN_LOGOUT_BUTTON_ERROR", error);
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoggingOut ? (
        <LoaderCircle
          className="h-5 w-5 animate-spin"
          aria-hidden="true"
        />
      ) : (
        <LogOut
          className="h-5 w-5"
          aria-hidden="true"
        />
      )}

      {isLoggingOut
        ? "Déconnexion..."
        : "Se déconnecter"}
    </button>
  );
}