import type {
  NextConfig,
} from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    /*
     * Les images distantes restent limitées
     * au projet Supabase Tikemia.
     */
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

    /*
     * Désactive l’optimisation interne Next.js
     * pour les images distantes Supabase.
     */
    unoptimized:
      true,
  },
};

export default nextConfig;