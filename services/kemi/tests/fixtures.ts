import { customProvider, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { DestinationStream } from "pino";

import type { ChatAgent } from "../src/agents/types.js";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/logger.js";

// A pino destination that keeps every line in memory.
export function captureLogs() {
  const raw: string[] = [];
  const lines: Record<string, unknown>[] = [];
  const stream: DestinationStream = {
    write(message: string) {
      raw.push(message);
      lines.push(JSON.parse(message) as Record<string, unknown>);
    },
  };
  return { raw, lines, logger: createLogger("info", stream) };
}

export const silentAgent: ChatAgent = {
  stream: async () => new ReadableStream({ start: (controller) => controller.close() }),
};

// The real app with in-memory logs and whatever agent a test needs.
export function testApp(chat: ChatAgent = silentAgent) {
  const logs = captureLogs();
  return { app: createApp({ logger: logs.logger, chat, version: "0.1.0" }), logs };
}

// A model that streams the given text pieces and records what it was sent.
export function streamingModel(pieces: string[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          ...pieces.map((delta) => ({ type: "text-delta" as const, id: "t1", delta })),
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: pieces.length, text: pieces.length, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

export function failingModel(message: string) {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error(message);
    },
  });
}

export const mockProvider = (models: Record<string, MockLanguageModelV4>) =>
  customProvider({ languageModels: models });
