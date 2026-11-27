import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claimDatabase } from "../src/database/client";

const dir = mkdtempSync(join(tmpdir(), "db-lock-"));
const path = join(dir, "demo-db");
const lock = `${path}.lock`;
afterEach(() => rmSync(lock, { force: true }));

describe("local database lock", () => {
  it("lets one process open the database, more than once", () => {
    claimDatabase(path);
    claimDatabase(path);
    expect(readFileSync(lock, "utf8")).toBe(String(process.pid));
  });

  it("refuses while another running process holds it", () => {
    writeFileSync(lock, String(process.ppid));
    expect(() => claimDatabase(path)).toThrow(/open in another process/);
    expect(readFileSync(lock, "utf8")).toBe(String(process.ppid));
  });

  it("takes over a lock left by a process that has exited", () => {
    writeFileSync(lock, "999999");
    claimDatabase(path);
    expect(readFileSync(lock, "utf8")).toBe(String(process.pid));
  });
});
