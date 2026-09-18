import type {
  NextConfig,
} from "next";

import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lyrtjzazxwflkkvfdzxk.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],

    /*
     * Important pour Tikemia :
     * les images Supabase sont servies directement.
     *
     * Quand l'optimisation Next.js était activée,
     * /_next/image provoquait des timeouts et des erreurs 500.
     */
    unoptimized: true,
  },
};

const withNextIntl =
  createNextIntlPlugin(
    "./lib/i18n/request.ts",
  );

export default withNextIntl(
  nextConfig,
);