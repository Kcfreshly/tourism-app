// The Kemi service as the web app sees it: a place to forward a traveller's
// request to. Implementations must not send the caller's cookies or
// authorization headers; only what is in this request crosses over.
export type KemiRequest = {
  method: "GET" | "POST";
  path: string;
  search: string;
  body: ArrayBuffer | null;
  contentType: string | null;
  accept: string | null;
  requestId: string;
  signal: AbortSignal;
};

export interface KemiGateway {
  forward(request: KemiRequest): Promise<Response>;
}

// Kemi could not be reached, or sent no response headers in time.
export class KemiUnavailable extends Error {}
