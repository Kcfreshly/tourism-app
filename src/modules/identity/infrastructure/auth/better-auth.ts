import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../../../../database/client";
import * as schema from "../../../../database/schema";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { allowedOrigins, assertDemo } from "../../../../config/environment";
const globalAuth = globalThis as unknown as {
  tourismAuth?: ReturnType<typeof createAuth>;
};
function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  assertDemo();
  mkdirSync(".local", { recursive: true });
  const path = ".local/auth-secret";
  if (!existsSync(path)) {
    try {
      writeFileSync(path, randomBytes(48).toString("base64url"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if (!existsSync(path)) throw e;
    }
  }
  return readFileSync(path, "utf8");
}
function createAuth() {
  return betterAuth({
    appName: "Ọ̀nà — local demo",
    baseURL: process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
    secret: secret(),
    trustedOrigins: allowedOrigins(),
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "CUSTOMER", input: false },
      },
    },
    advanced: { database: { generateId: () => randomUUID() } },
    rateLimit: { enabled: true, window: 60, max: 30 },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  });
}
export function auth() {
  return (globalAuth.tourismAuth ??= createAuth());
}
