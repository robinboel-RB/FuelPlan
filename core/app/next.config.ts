import type { NextConfig } from "next";

const isExportBuild = process.env.NEXT_OUTPUT_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isExportBuild ? "export" : undefined
};

export default nextConfig;
