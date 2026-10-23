import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};
export default config;
