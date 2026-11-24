import type { NextConfig } from "next";
const config: NextConfig = {
  // A self-contained server in .next/standalone, for the Docker image.
  output: "standalone",
  devIndicators: false,
  experimental: { agentUpgrade: "security" },
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};
export default config;
