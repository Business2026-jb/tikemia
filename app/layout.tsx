import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tikemia Organisateur",
  description:
    "Créez vos événements, vendez vos billets et suivez vos ventes avec Tikemia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}