import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  experimental: { agentUpgrade: "security" },
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};
export default config;
