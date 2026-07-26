import type { ReactNode } from "react";

type AdminAuthLayoutProps = {
  children: ReactNode;
};

export default function AdminAuthLayout({
  children,
}: AdminAuthLayoutProps) {
  return children;
}