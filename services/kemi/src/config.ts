import { z } from "zod";

// ── Model profiles ───────────────────────────────────────────────────────────
// The only place model IDs appear. Agents ask for a profile by name, never a
// provider or model, so switching provider is a change here or an env
// override (MODEL_<PROFILE>, dots as underscores), not in agent code.

export type ModelProfile = {
  model: `${string}:${string}`; // "<provider>:<model id>", provider registered in ai/models.ts
  settings?: { temperature?: number; maxOutputTokens?: number };
};

export const modelProfiles = {
  "kemi.chat": {
    model: "anthropic:claude-sonnet-5-5",
    settings: { temperature: 0.4, maxOutputTokens: 1_024 },
  },
  "kemi.router": {
    model: "anthropic:claude-haiku-5-5",
    settings: { temperature: 0, maxOutputTokens: 256 },
  },
  "planner.reason": {
    model: "anthropic:claude-opus-5-5",
    settings: { maxOutputTokens: 4_096 },
  },
} as const satisfies Record<string, ModelProfile>;

export type ProfileName = keyof typeof modelProfiles;

// ── Environment ──────────────────────────────────────────────────────────────

// Empty strings (`KEY=` in .env) count as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    SERVICE_VERSION: z.string().min(1).default("unknown"),
    ANTHROPIC_API_KEY: optional(z.string().min(1)),
    // Self-hosted Langfuse: all three or none (none = untraced).
    LANGFUSE_PUBLIC_KEY: optional(z.string().min(1)),
    LANGFUSE_SECRET_KEY: optional(z.string().min(1)),
    LANGFUSE_BASE_URL: optional(z.url({ protocol: /^https?$/ })),
  })
  .superRefine((env, ctx) => {
    const langfuse = [env.LANGFUSE_PUBLIC_KEY, env.LANGFUSE_SECRET_KEY, env.LANGFUSE_BASE_URL];
    if (langfuse.some(Boolean) && !langfuse.every(Boolean))
      ctx.addIssue({
        code: "custom",
        path: ["LANGFUSE_BASE_URL"],
        message: "and LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY must be set together",
      });
  });

export type Env = z.infer<typeof envSchema>;

// Names every invalid setting. Values are never included; they may be secrets.
export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

export function loadEnv(input: NodeJS.ProcessEnv): Env {
  const raw: Record<string, unknown> = {
    ...input,
    SERVICE_VERSION: input.SERVICE_VERSION || input.npm_package_version || undefined,
  };
  const result = envSchema.safeParse(raw);
  if (!result.success)
    throw new ConfigError(
      result.error.issues.map((issue) => {
        const key = issue.path.join(".");
        return issue.code !== "custom" && (raw[key] === undefined || raw[key] === "")
          ? `${key} is required`
          : `${key} ${issue.message}`;
      }),
    );
  return result.data;
}
