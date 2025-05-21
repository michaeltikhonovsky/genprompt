import type { NextConfig } from "next";

// Determine if we're building for Tauri
const isTauriBuild = process.env.TAURI_BUILD === "true";

const nextConfig: NextConfig = {
  // output: "export",
  images: {
    unoptimized: isTauriBuild,
  },
  trailingSlash: isTauriBuild,
  skipTrailingSlashRedirect: isTauriBuild,
};

export default nextConfig;
