import type {
  NextConfig,
} from "next";

import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol:
          "https",

        hostname:
          "lyrtjzazxwflkkvfdzxk.supabase.co",

        port:
          "",

        pathname:
          "/storage/v1/object/public/**",
      },
    ],

    unoptimized:
      true,
  },
};

const withNextIntl =
  createNextIntlPlugin(
    "./lib/i18n/request.ts",
  );

export default withNextIntl(
  nextConfig,
);