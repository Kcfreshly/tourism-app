import type { UIMessage, UIMessageChunk } from "ai";

// The contract between routes and agents. A route validates the request and
// pipes the returned stream to the client; it knows nothing about models,
// prompts or tools. An agent (or an orchestrator that hands off between
// agents) produces the stream; it knows nothing about HTTP.

export type ChatInput = {
  conversationId: string;
  messages: UIMessage[];
  requestId: string;
  userId?: string | undefined;
  /** Aborted when the client disconnects. */
  signal: AbortSignal;
};

export interface ChatAgent {
  stream(input: ChatInput): Promise<ReadableStream<UIMessageChunk>>;
}
