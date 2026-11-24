import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NextConfig } from "next";

// Crew worktrees (.claude/worktrees/*) link node_modules to the main
// checkout's copy instead of installing their own. Turbopack only resolves
// files inside its root, so when node_modules is such a link the root becomes
// the main checkout, which contains both the worktree and the packages.
// In the main checkout itself this does nothing.
const modules = resolve("node_modules");
let linkedModules: string | null = null;
try {
  const target = realpathSync(modules);
  if (target.toLowerCase() !== modules.toLowerCase()) linkedModules = target;
} catch {}

const config: NextConfig = {
  // A self-contained server in .next/standalone, for the Docker image.
  output: "standalone",
  devIndicators: false,
  experimental: { agentUpgrade: "security" },
  ...(linkedModules ? { turbopack: { root: dirname(linkedModules) } } : {}),
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};
export default config;
