import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "10.31.109.74",
    "10.92.40.74",
  ],
  ...(process.env.NEXT_EXPORT === "true" && {
    output: "export",
    images: {
      unoptimized: true,
    },
  }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
