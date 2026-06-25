import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is used in server code; keep it external so Next doesn't try to bundle it.
  serverExternalPackages: ["sharp", "@prisma/client"],
  images: {
    // We serve our own optimized variants from /uploads, so disable the
    // built-in optimizer to keep local/offline dev simple.
    unoptimized: true,
  },
  eslint: {
    // Lint is available via `npm run lint`; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
