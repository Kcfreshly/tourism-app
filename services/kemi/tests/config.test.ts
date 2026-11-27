import { streamText } from "ai";
import { describe, expect, it } from "vitest";

import { createModels } from "../src/ai/models.js";
import { ConfigError, loadEnv } from "../src/config.js";
import { captureLogs, mockProvider, streamingModel } from "./fixtures.js";

function configError(run: () => unknown): ConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error("expected a ConfigError");
}

describe("environment", () => {
  it("starts with defaults and nothing required", () => {
    expect(loadEnv({})).toMatchObject({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: 4100,
      LOG_LEVEL: "info",
    });
  });

  it("names invalid settings without printing their values", () => {
    const error = configError(() => loadEnv({ PORT: "99999", LOG_LEVEL: "loud-secret" }));
    expect(error.problems.map((p) => p.split(" ")[0])).toEqual(["PORT", "LOG_LEVEL"]);
    expect(error.message).not.toContain("loud-secret");
  });

  it("requires the Langfuse settings together", () => {
    const error = configError(() =>
      loadEnv({ LANGFUSE_PUBLIC_KEY: "pk", LANGFUSE_SECRET_KEY: "sk-lf-secret" }),
    );
    expect(error.problems).toEqual([
      "LANGFUSE_BASE_URL and LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY must be set together",
    ]);
    expect(error.message).not.toContain("sk-lf-secret");
    expect(
      loadEnv({
        LANGFUSE_PUBLIC_KEY: "pk",
        LANGFUSE_SECRET_KEY: "sk",
        LANGFUSE_BASE_URL: "http://127.0.0.1:3001",
      }).LANGFUSE_BASE_URL,
    ).toBe("http://127.0.0.1:3001");
  });

  it("treats empty strings as unset", () => {
    expect(
      loadEnv({ ANTHROPIC_API_KEY: "", LANGFUSE_BASE_URL: "" }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });
});

describe("model profiles", () => {
  it("resolve to the provider model with the profile's settings", async () => {
    const chat = streamingModel(["hi"]);
    const models = createModels({
      providers: { anthropic: mockProvider({ "claude-sonnet-5-5": chat }) },
    });
    await streamText({ model: models.get("kemi.chat"), prompt: "hello" }).text;
    expect(chat.doStreamCalls[0]).toMatchObject({ temperature: 0.4, maxOutputTokens: 1024 });
  });

  it("can be switched to another provider with MODEL_<PROFILE>", async () => {
    const other = streamingModel(["hi"]);
    const models = createModels({
      providers: { anthropic: mockProvider({}), openai: mockProvider({ "gpt-test": other }) },
      overrides: { MODEL_KEMI_ROUTER: "openai:gpt-test" },
    });
    expect(await streamText({ model: models.get("kemi.router"), prompt: "x" }).text).toBe("hi");
  });

  it("fail loudly for an unregistered provider", () => {
    const models = createModels({
      providers: { anthropic: mockProvider({}) },
      overrides: { MODEL_KEMI_CHAT: "nope:m" },
    });
    expect(() => models.get("kemi.chat")).toThrow(/nope/);
  });
});

describe("logger", () => {
  it("never writes authorization or cookie values", () => {
    const logs = captureLogs();
    logs.logger.info({
      authorization: "Bearer a1",
      req: { headers: { authorization: "Bearer b2", cookie: "s=c3" } },
    });
    for (const secret of ["a1", "b2", "c3"]) expect(logs.raw.join("")).not.toContain(secret);
  });
});
