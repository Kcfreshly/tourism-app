import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/shared/application/app-error";
import type { RequestGuards } from "../src/modules/identity/presentation/http/request-guards";
import {
  KemiUnavailable,
  type KemiGateway,
  type KemiRequest,
} from "../src/modules/kemi/application/ports/kemi-gateway";
import { FetchKemiGateway } from "../src/modules/kemi/infrastructure/http/fetch-kemi-gateway";
import { createKemiProxyController } from "../src/modules/kemi/presentation/http/controllers/kemi-proxy-controller";

const actor = { id: "user-1", role: "CUSTOMER", kind: "ACCOUNT" as const };

function guards(options: { signedIn?: boolean; origin?: boolean } = {}) {
  return {
    currentActor: vi.fn(async () => actor),
    requireActor: vi.fn(async () => {
      if (options.signedIn === false)
        throw new AppError("UNAUTHENTICATED", "SIGN_IN_REQUIRED", "Sign in.");
      return actor;
    }),
    requireAdmin: vi.fn(),
    checkOrigin: vi.fn(async () => {
      if (options.origin === false)
        throw new AppError("FORBIDDEN", "ORIGIN_REJECTED", "Reload.");
    }),
    throttle: vi.fn(async () => {}),
  } as unknown as RequestGuards & {
    checkOrigin: ReturnType<typeof vi.fn>;
    throttle: ReturnType<typeof vi.fn>;
  };
}

function fakeKemi(answer: () => Promise<Response> = okAnswer) {
  const calls: KemiRequest[] = [];
  const kemi: KemiGateway = {
    forward: async (r) => {
      calls.push(r);
      return answer();
    },
  };
  return { kemi, calls };
}

const okAnswer = async () =>
  Response.json(
    { data: { service: "kemi" }, meta: { requestId: "from-kemi-123" } },
    {
      headers: { "x-request-id": "from-kemi-123", "set-cookie": "leak=1" },
    },
  );

const at = (...path: string[]) => ({ params: Promise.resolve({ path }) });

function browserRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1:3000/api/v1/kemi/${path}`, {
    ...init,
    headers: {
      cookie: "better-auth.session_token=secret",
      authorization: "Bearer browser-token",
      origin: "http://127.0.0.1:3000",
      ...init.headers,
    },
  });
}

describe("Kemi BFF proxy", () => {
  it("is closed while the flag is off (AC-12)", async () => {
    const { kemi, calls } = fakeKemi();
    const g = guards();
    const response = await createKemiProxyController(
      g,
      kemi,
      () => false,
    )(browserRequest("status"), at("status"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("KEMI_DISABLED");
    expect(g.requireActor).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("requires a signed-in account and a same-site origin for writes (AC-13)", async () => {
    const { kemi, calls } = fakeKemi();
    const signedOut = await createKemiProxyController(
      guards({ signedIn: false }),
      kemi,
      () => true,
    )(browserRequest("status"), at("status"));
    expect(signedOut.status).toBe(401);
    expect((await signedOut.json()).error.code).toBe("SIGN_IN_REQUIRED");

    const foreign = await createKemiProxyController(
      guards({ origin: false }),
      kemi,
      () => true,
    )(
      browserRequest("conversations", { method: "POST", body: "{}" }),
      at("conversations"),
    );
    expect(foreign.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("throttles per account", async () => {
    const g = guards();
    await createKemiProxyController(
      g,
      fakeKemi().kemi,
      () => true,
    )(browserRequest("status"), at("status"));
    expect(g.throttle).toHaveBeenCalledWith("kemi:user-1", 60);
  });

  it.each([
    [["..", "admin"]],
    [["status%2F.."]],
    [["a b"]],
    [["x".repeat(65)]],
    [Array.from({ length: 9 }, () => "a")],
  ])("refuses the path %j without calling Kemi (AC-14)", async (path) => {
    const { kemi, calls } = fakeKemi();
    const response = await createKemiProxyController(
      guards(),
      kemi,
      () => true,
    )(browserRequest("x"), at(...path));
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("refuses bodies over 256 KB (AC-14)", async () => {
    const { kemi, calls } = fakeKemi();
    const response = await createKemiProxyController(
      guards(),
      kemi,
      () => true,
    )(
      browserRequest("conversations", {
        method: "POST",
        body: "x".repeat(256 * 1024 + 1),
      }),
      at("conversations"),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("REQUEST_TOO_LARGE");
    expect(calls).toHaveLength(0);
  });

  it("forwards only what Kemi needs and returns its answer (AC-15)", async () => {
    const { kemi, calls } = fakeKemi();
    const response = await createKemiProxyController(
      guards(),
      kemi,
      () => true,
    )(
      browserRequest("conversations/abc/messages?cursor=2", {
        method: "POST",
        body: '{"text":"hi"}',
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
      }),
      at("conversations", "abc", "messages"),
    );

    expect(calls).toHaveLength(1);
    const sent = calls[0];
    expect(sent).toMatchObject({
      method: "POST",
      path: "/v1/conversations/abc/messages",
      search: "?cursor=2",
      contentType: "application/json",
      accept: "text/event-stream",
    });
    expect(new TextDecoder().decode(sent.body!)).toBe('{"text":"hi"}');
    expect(sent.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(sent)).not.toContain("secret");
    expect(JSON.stringify(sent)).not.toContain("browser-token");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("from-kemi-123");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await response.json()).data.service).toBe("kemi");
  });

  it("passes Kemi's own errors through unchanged", async () => {
    const { kemi } = fakeKemi(async () =>
      Response.json(
        { error: { code: "NOT_FOUND", message: "No such endpoint." } },
        { status: 404 },
      ),
    );
    const response = await createKemiProxyController(
      guards(),
      kemi,
      () => true,
    )(browserRequest("nope"), at("nope"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("answers 503 KEMI_UNAVAILABLE when Kemi can't be reached (AC-16)", async () => {
    const { kemi, calls } = fakeKemi(async () => {
      throw new KemiUnavailable("down");
    });
    const response = await createKemiProxyController(
      guards(),
      kemi,
      () => true,
    )(browserRequest("status"), at("status"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("KEMI_UNAVAILABLE");
    expect(body.error.message).toMatch(/trip form/);
    expect(body.meta.requestId).toBe(calls[0].requestId);
  });
});

describe("FetchKemiGateway", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  async function listen(
    handler: Parameters<typeof createServer>[1],
  ): Promise<string> {
    server = createServer(handler);
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    );
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  }

  const forwardRequest = (
    overrides: Partial<KemiRequest> = {},
  ): KemiRequest => ({
    method: "GET",
    path: "/v1/status",
    search: "?a=1",
    body: null,
    contentType: null,
    accept: "application/json",
    requestId: "req-12345678",
    signal: new AbortController().signal,
    ...overrides,
  });

  it("sends the request ID, and nothing from the browser (AC-15)", async () => {
    let seen: { url?: string; headers?: IncomingHttpHeaders } = {};
    const base = await listen((req, res) => {
      seen = { url: req.url, headers: req.headers };
      res.setHeader("content-type", "text/event-stream");
      res.write("data: one\n\n");
      setTimeout(() => res.end("data: two\n\n"), 20);
    });

    const response = await new FetchKemiGateway(base).forward(forwardRequest());
    expect(seen.url).toBe("/v1/status?a=1");
    expect(seen.headers).toMatchObject({
      "x-request-id": "req-12345678",
      accept: "application/json",
    });
    expect(seen.headers?.cookie).toBeUndefined();
    expect(seen.headers?.authorization).toBeUndefined();
    expect(await response.text()).toBe("data: one\n\ndata: two\n\n");
  });

  it("reports Kemi unavailable when nothing listens (AC-16)", async () => {
    const base = await listen(() => {});
    const port = new URL(base).port;
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;
    await expect(
      new FetchKemiGateway(`http://127.0.0.1:${port}`).forward(
        forwardRequest(),
      ),
    ).rejects.toBeInstanceOf(KemiUnavailable);
  });

  it("reports Kemi unavailable when headers don't arrive in time (AC-16)", async () => {
    const base = await listen(() => {});
    await expect(
      new FetchKemiGateway(base, 50).forward(forwardRequest()),
    ).rejects.toBeInstanceOf(KemiUnavailable);
  });

  it("keeps streaming after the header timeout once Kemi has answered", async () => {
    const base = await listen((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.write("first ");
      setTimeout(() => res.end("second"), 120);
    });
    const response = await new FetchKemiGateway(base, 50).forward(
      forwardRequest(),
    );
    expect(await response.text()).toBe("first second");
  });
});
