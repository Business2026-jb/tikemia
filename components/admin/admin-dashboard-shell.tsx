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
    <div className="min-h-screen bg-slate-100">
      <AdminSidebar />

      <AdminMobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="min-h-screen lg:pl-72">
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Ouvrir le menu administrateur"
          >
            <Menu
              className="h-6 w-6"
              aria-hidden="true"
            />
          </button>

          <div className="ml-3">
            <p className="text-sm font-bold text-slate-950">
              Administration Tikemia
            </p>

            <p className="text-xs text-slate-500">
              Tableau de bord
            </p>
          </div>
        </header>

        <main className="w-full px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}