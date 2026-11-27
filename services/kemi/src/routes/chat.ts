import { pipeUIMessageStreamToResponse, safeValidateUIMessages } from "ai";
import { Router } from "express";
import { z } from "zod";

import type { ChatAgent } from "../agents/types.js";
import { sendError } from "../http.js";

// The body the AI SDK's useChat() sends by default.
const chatRequest = z.object({
  id: z.string().min(1).max(128),
  messages: z.array(z.unknown()).min(1).max(200),
});

// POST /v1/chat: validates the conversation, hands it to the agent and pipes
// the agent's UI message stream (SSE) back. A client disconnect aborts the run.
export function chatRoutes(agent: ChatAgent): Router {
  const router = Router();

  router.post("/chat", async (request, response) => {
    const body = chatRequest.safeParse(request.body);
    if (!body.success)
      return sendError(
        response,
        422,
        "INVALID_CHAT_REQUEST",
        "Send a conversation id and messages.",
      );
    const messages = await safeValidateUIMessages({ messages: body.data.messages });
    if (!messages.success)
      return sendError(response, 422, "INVALID_MESSAGES", "One or more messages are malformed.");

    const disconnected = new AbortController();
    response.once("close", () => {
      if (!response.writableFinished) disconnected.abort();
    });

    const stream = await agent.stream({
      conversationId: body.data.id,
      messages: messages.data,
      requestId: response.locals.requestId,
      signal: disconnected.signal,
    });
    pipeUIMessageStreamToResponse({
      response,
      stream,
      headers: { "Cache-Control": "private, no-store" },
    });
  });

  return router;
}
