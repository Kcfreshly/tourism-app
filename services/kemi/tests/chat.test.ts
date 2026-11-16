import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";

import type { UIMessageChunk } from "ai";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createKemiAgent } from "../src/agents/kemi.js";
import type { ChatAgent, ChatInput } from "../src/agents/types.js";
import { createModels } from "../src/ai/models.js";
import { captureLogs, failingModel, mockProvider, streamingModel, testApp } from "./fixtures.js";

const userMessage = (text: string) => ({ id: "m1", role: "user", parts: [{ type: "text", text }] });
const chatBody = { id: "conv-1", messages: [userMessage("I'm visiting Lagos in March")] };

// Parses an SSE body into UI message chunks.
const chunksOf = (body: string) =>
  body
    .split("\n\n")
    .map((event) => event.replace(/^data: /, "").trim())
    .filter((data) => data && data !== "[DONE]")
    .map((data) => JSON.parse(data) as UIMessageChunk);

function kemiWith(model: ReturnType<typeof streamingModel>) {
  const logs = captureLogs();
  const models = createModels({
    providers: { anthropic: mockProvider({ "claude-sonnet-5-5": model }) },
  });
  return { chat: createKemiAgent({ models, logger: logs.logger }), logs };
}

describe("POST /v1/chat with the Kemi agent", () => {
  it("streams the answer as an AI SDK UI message stream", async () => {
    const { app } = testApp(kemiWith(streamingModel(["Ẹ kú àbọ̀! ", "When in March?"])).chat);
    const response = await request(app)
      .post("/v1/chat")
      .set("x-request-id", "req-chat-0001")
      .send(chatBody);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.headers["x-vercel-ai-ui-message-stream"]).toBe("v1");
    expect(response.headers["x-request-id"]).toBe("req-chat-0001");
    const chunks = chunksOf(response.text);
    const text = chunks.flatMap((c) => (c.type === "text-delta" ? [c.delta] : [])).join("");
    expect(text).toBe("Ẹ kú àbọ̀! When in March?");
    expect(chunks.at(-1)?.type).toBe("finish");
  });

  it("sends Kemi's instructions and the conversation to the kemi.chat model", async () => {
    const model = streamingModel(["ok"]);
    await request(testApp(kemiWith(model).chat).app)
      .post("/v1/chat")
      .send(chatBody);
    const prompt = model.doStreamCalls[0]?.prompt ?? [];
    expect(JSON.stringify(prompt[0])).toContain("You are Kemi");
    expect(JSON.stringify(prompt.at(-1))).toContain("I'm visiting Lagos in March");
  });

  it("reports a model failure in the stream without leaking it", async () => {
    const { chat, logs } = kemiWith(failingModel("key sk-ant-secret rejected"));
    const response = await request(testApp(chat).app).post("/v1/chat").send(chatBody);
    expect(chunksOf(response.text).find((c) => c.type === "error")).toEqual({
      type: "error",
      errorText: "Kemi couldn't answer just now. Please try again.",
    });
    expect(response.text).not.toContain("sk-ant-secret");
    expect(logs.lines.some((l) => l.msg === "agent stream failed")).toBe(true);
  });
});

describe("POST /v1/chat route", () => {
  function recordingAgent(chunks: UIMessageChunk[]) {
    const inputs: ChatInput[] = [];
    const agent: ChatAgent = {
      stream: async (input) => {
        inputs.push(input);
        return new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        });
      },
    };
    return { agent, inputs };
  }

  it("hands the conversation to the agent and pipes its stream unchanged", async () => {
    const chunks: UIMessageChunk[] = [
      { type: "start" },
      { type: "data-summary", data: { city: "Lagos" } },
      { type: "finish" },
    ];
    const { agent, inputs } = recordingAgent(chunks);
    const response = await request(testApp(agent).app)
      .post("/v1/chat")
      .set("x-request-id", "req-route-0001")
      .send(chatBody);
    expect(inputs[0]).toMatchObject({ conversationId: "conv-1", requestId: "req-route-0001" });
    expect(chunksOf(response.text)).toEqual(chunks);
  });

  it.each([
    [{ messages: [userMessage("hi")] }, "INVALID_CHAT_REQUEST"],
    [{ id: "c", messages: [] }, "INVALID_CHAT_REQUEST"],
    [{ id: "c", messages: [{ role: "user", text: "no parts" }] }, "INVALID_MESSAGES"],
  ])("refuses %j with 422 %s before calling the agent", async (body, code) => {
    const { agent, inputs } = recordingAgent([]);
    const response = await request(testApp(agent).app).post("/v1/chat").send(body);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(code);
    expect(inputs).toHaveLength(0);
  });

  it("aborts the agent run when the client disconnects", async () => {
    let signal: AbortSignal | undefined;
    const agent: ChatAgent = {
      stream: async (input) => {
        signal = input.signal;
        return new ReadableStream({ start: (c) => c.enqueue({ type: "start" }) }); // never finishes
      },
    };
    const server = testApp(agent).app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const client = httpRequest({
      host: "127.0.0.1",
      port: (server.address() as AddressInfo).port,
      method: "POST",
      path: "/v1/chat",
      headers: { "content-type": "application/json" },
    });
    client.on("error", () => {});
    client.end(JSON.stringify(chatBody));
    await new Promise<void>((resolve) =>
      client.once("response", (res) => res.once("data", () => resolve())),
    );
    expect(signal?.aborted).toBe(false);

    client.destroy();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    server.close();
  });
});
