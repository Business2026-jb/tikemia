import type { NextConfig } from "next";

// Keep native thread pools within shared hosting process limits.
process.env.TOKIO_WORKER_THREADS = "2";
process.env.RAYON_NUM_THREADS = "2";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    cpus: 2,
    workerThreads: false,
  },
};

export default nextConfig;
