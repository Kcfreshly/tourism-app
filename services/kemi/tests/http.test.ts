import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { errorHandler, requestId } from "../src/http.js";
import { captureLogs, testApp } from "./fixtures.js";

describe("http basics", () => {
  it("GET /health answers without dependencies", async () => {
    const response = await request(testApp().app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: "ok", version: "0.1.0" });
  });

  it("reuses a valid x-request-id in the header, body and log line", async () => {
    const { app, logs } = testApp();
    const response = await request(app).get("/health").set("x-request-id", "bff-req_12345678");
    expect(response.headers["x-request-id"]).toBe("bff-req_12345678");
    expect(response.body.meta.requestId).toBe("bff-req_12345678");
    await vi.waitFor(() =>
      expect(logs.lines[0]).toMatchObject({ requestId: "bff-req_12345678", status: 200 }),
    );
  });

  it.each(["short", "has spaces in it", "<script>x</script>"])(
    "replaces the unusable id %j",
    async (id) => {
      const response = await request(testApp().app).get("/health").set("x-request-id", id);
      expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it("answers unknown routes and bad JSON with the error envelope", async () => {
    const { app } = testApp();
    const missing = await request(app).get("/v1/nothing");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: { code: "NOT_FOUND", message: "No such endpoint." },
      meta: { requestId: missing.headers["x-request-id"] },
    });
    const bad = await request(app)
      .post("/v1/chat")
      .set("content-type", "application/json")
      .send("{nope");
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("INVALID_JSON");
  });

  it("hides unexpected errors behind 500 INTERNAL_ERROR and logs them", async () => {
    const logs = captureLogs();
    const app = express();
    app.use(requestId(logs.logger));
    app.get("/boom", () => {
      throw new Error("secret internal detail");
    });
    app.use(errorHandler);

    const response = await request(app).get("/boom");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.text).not.toContain("secret internal detail");
    expect(logs.lines.some((l) => l.msg === "unhandled request error")).toBe(true);
  });
});
