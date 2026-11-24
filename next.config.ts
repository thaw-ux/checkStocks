import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "yahoo-finance2"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
