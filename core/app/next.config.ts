import type { NextConfig } from "next";
import path from "node:path";

const isExportBuild = process.env.NEXT_OUTPUT_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isExportBuild ? "export" : undefined,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/api/fueling/calculate": [
      "../engine/fueling_core.py",
      "../engine/fueling_core_cli.py"
    ]
  }
};

export default nextConfig;
