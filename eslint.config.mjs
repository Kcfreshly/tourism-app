import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

// Layer boundaries; see src/modules/README.md.
const frameworks = [
  { group: ["next", "next/*"], message: "Next.js belongs in presentation." },
  {
    group: ["drizzle-orm", "drizzle-orm/*", "@electric-sql/*", "postgres"],
    message: "Database access belongs in infrastructure.",
  },
  {
    group: ["better-auth", "better-auth/*", "@better-auth/*"],
    message: "Auth providers belong in infrastructure.",
  },
];
const outerLayers = [
  {
    group: ["**/infrastructure/**", "**/presentation/**", "@/database/*"],
    message: "Inner layers may not depend on infrastructure or presentation.",
  },
  {
    group: ["@/bootstrap/*"],
    message: "Only routes and pages use the composition root.",
  },
];

export default defineConfig([
  ...next,
  ...ts,
  { rules: { "@next/next/no-img-element": "off" } },
  {
    files: ["src/modules/*/domain/**", "src/modules/*/application/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...frameworks, ...outerLayers] },
      ],
    },
  },
  {
    files: ["src/components/**", "src/hooks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/*/application/**",
                "@/modules/*/infrastructure/**",
                "@/modules/*/presentation/**",
                "@/database/*",
                "@/bootstrap/*",
              ],
              message:
                "Browser code may import module domain rules only; data comes from the API.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", ".local/**", "tourism-v1-handoff/**", "asset/**"]),
]);
