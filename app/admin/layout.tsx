import type { ReactNode } from "react";

type AdminRootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AdminRootLayout({
  children,
}: AdminRootLayoutProps) {
  return children;
}