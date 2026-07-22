import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    /*
     * Les images distantes restent limitées au projet Supabase Tikemia.
     * Aucun autre domaine externe n’est autorisé.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lyrtjzazxwflkkvfdzxk.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],

    /*
     * Désactive l’optimisation interne de Next.js.
     * Cela évite les erreurs TimeoutError sur /_next/image
     * lorsque Next.js récupère les images depuis Supabase.
     */
    unoptimized: true,
  },
};

export default nextConfig;