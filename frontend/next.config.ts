import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Lean self-hosted image: `server.js` + minimal deps (see Dockerfile).
  output: "standalone",
  // Django requires trailing slashes (/api/customers/); don't let Next.js
  // strip them with 308 redirects. API proxying is handled by
  // app/api/[...slug]/route.ts instead of rewrites (which drop the slash).
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
