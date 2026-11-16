import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Separate services have their own toolchains.
  test: { exclude: [...configDefaults.exclude, "services/**"] },
});
