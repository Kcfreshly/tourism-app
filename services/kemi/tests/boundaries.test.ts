import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const oxlint = fileURLToPath(new URL("../node_modules/oxlint/bin/oxlint", import.meta.url));
const probes: string[] = [];

// Writes a throwaway file into a source folder and runs the real lint config on it.
async function lint(folder: string, specifier: string) {
  const file = `${folder}/__probe-${probes.length}__.ts`;
  probes.push(file);
  await writeFile(`${root}${file}`, `import * as x from "${specifier}";\nexport const y = x;\n`);
  try {
    await promisify(execFile)(process.execPath, [oxlint, file], { cwd: root });
    return "";
  } catch (error) {
    return String((error as { stdout?: string }).stdout);
  }
}

afterAll(() => Promise.all(probes.map((file) => rm(`${root}${file}`, { force: true }))));

describe("routes stream, agents think", () => {
  it.each([
    ["src/routes", "@ai-sdk/anthropic"],
    ["src/routes", "@langfuse/tracing"],
    ["src/routes", "../ai/models.js"],
    ["src/routes", "../agents/kemi.js"],
    ["src/agents", "express"],
    ["src/agents", "../routes/chat.js"],
    ["src/agents", "../http.js"],
    ["src/agents", "@ai-sdk/anthropic"],
  ])("%s may not import %s", async (folder, specifier) => {
    expect(await lint(folder, specifier)).toContain("no-restricted-imports");
  });

  it.each([
    ["src/routes", "ai"],
    ["src/routes", "../agents/types.js"],
    ["src/agents", "ai"],
    ["src/agents", "../ai/models.js"],
    ["src/agents", "../ai/langfuse.js"],
  ])("%s may import %s", async (folder, specifier) => {
    expect(await lint(folder, specifier)).not.toContain("no-restricted-imports");
  });
});
