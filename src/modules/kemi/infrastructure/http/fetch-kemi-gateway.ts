import {
  KemiUnavailable,
  type KemiGateway,
  type KemiRequest,
} from "../../application/ports/kemi-gateway";

// Forwards over HTTP. The timeout covers waiting for response headers only;
// once Kemi starts answering, the body streams for as long as it needs (chat
// turns stream). The caller aborting cancels the upstream request.
export class FetchKemiGateway implements KemiGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly headerTimeoutMs = 10_000,
  ) {}

  async forward(request: KemiRequest) {
    const headers = new Headers({
      "x-request-id": request.requestId,
    });
    if (request.contentType) headers.set("content-type", request.contentType);
    if (request.accept) headers.set("accept", request.accept);

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.headerTimeoutMs);
    try {
      return await fetch(new URL(request.path + request.search, this.baseUrl), {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
        signal: AbortSignal.any([request.signal, timeout.signal]),
      });
    } catch (e) {
      if (request.signal.aborted) throw e;
      throw new KemiUnavailable("Kemi did not answer.", { cause: e });
    } finally {
      clearTimeout(timer);
    }
  }
}
