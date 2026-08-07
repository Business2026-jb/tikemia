import type {
  Metadata,
  Viewport,
} from "next";
import type {
  ReactNode,
} from "react";

export const metadata:
  Metadata = {
  title: {
    default:
      "Scanner Tikemia",
    template:
      "%s | Scanner Tikemia",
  },

  description:
    "Espace sécurisé de contrôle d’accès et de validation des billets Tikemia.",

  robots: {
    index:
      false,
    follow:
      false,
    noarchive:
      true,
    nosnippet:
      true,
  },
};

export const viewport:
  Viewport = {
  width:
    "device-width",
  initialScale:
    1,
  maximumScale:
    1,
  viewportFit:
    "cover",
  themeColor:
    "#03070a",
};

export default function ScannerLayout({
  children,
}: Readonly<{
  children:
    ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-[#03070a] text-white">
      {children}
    </div>
  );
}
