"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import AdminMobileMenu from "@/components/admin/admin-mobile-menu";
import AdminSidebar from "@/components/admin/admin-sidebar";

type AdminDashboardShellProps = {
  children: React.ReactNode;
};

export default function AdminDashboardShell({
  children,
}: AdminDashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  return (
    <div className="min-h-screen bg-[#02070b] text-white">
      <AdminSidebar />

      <AdminMobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="min-h-screen min-w-0 bg-[#02070b] lg:pl-72">
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-white/[0.07] bg-[#03090e]/95 px-4 shadow-[0_10px_35px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white transition hover:border-white/[0.14] hover:bg-white/[0.08]"
            aria-label="Ouvrir le menu administrateur"
            aria-expanded={mobileMenuOpen}
          >
            <Menu
              className="h-6 w-6"
              aria-hidden="true"
            />
          </button>

          <div className="ml-3 min-w-0">
            <p className="truncate text-sm font-black tracking-[-0.01em] text-white">
              Administration Tikemia
            </p>

            <p className="truncate text-xs font-medium text-neutral-500">
              Centre de contrôle
            </p>
          </div>
        </header>

        <main className="min-h-screen w-full min-w-0 bg-[#02070b] pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}