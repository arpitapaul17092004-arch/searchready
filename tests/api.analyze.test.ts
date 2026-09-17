import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleAnalyze, type ApiRequestLike } from "../lib/api-handlers";

/**
 * Integration tests for the analyze pipeline (validation, SSRF guard,
 * fetch, analysis, error shaping, rate limiting) with the network
 * fully stubbed via the injectable fetcher/resolver.
 */

function fakeResponse(init: {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}): Response {
  const headers = new Map(Object.entries(init.headers ?? {}));
  const body = init.body ?? "";
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  } as unknown as Response;
}

const publicResolver = async () => ["93.184.216.34"];

const fetchOptions = {
  fetchImpl: (async () =>
    fakeResponse({
      status: 200,
      headers: { "content-type": "text/html" },
      body:
        "<html><head><title>Test page for the analyzer integration test</title>" +
        '<meta name="description" content="A test description long enough to pass the length checks of the engine."></head>' +
        "<body><h1>Hi</h1></body></html>",
    })) as unknown as typeof fetch,
  resolveHost: publicResolver,
};

function req(body: unknown, ip = "203.0.113.10"): ApiRequestLike {
  return {
    json: async () => {
      if (typeof body === "string") throw new Error("invalid json");
      return body;
    },
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? ip : null),
    },
  };
}

describe("POST /api/analyze (handler)", () => {
  it("returns 400 for invalid JSON bodies", async () => {
    const result = await handleAnalyze(req("not-json"));
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
    assert.ok(typeof result.body.correlationId === "string");
  });

  it("returns 400 for missing url", async () => {
    const result = await handleAnalyze(req({}));
    assert.equal(result.status, 400);
  });

  it("returns 400 for over-long urls", async () => {
    const result = await handleAnalyze(req({ url: "https://x.com/" + "a".repeat(2100) }));
    assert.equal(result.status, 400);
  });

  it("blocks SSRF attempts (cloud metadata endpoint)", async () => {
    const result = await handleAnalyze(
      req({ url: "http://169.254.169.254/latest/meta-data" }),
    );
    assert.equal(result.status, 400);
    assert.match(String(result.body.error), /not allowed|Invalid/i);
  });

  it("blocks non-http schemes", async () => {
    const result = await handleAnalyze(req({ url: "file:///etc/passwd" }));
    assert.equal(result.status, 400);
  });

  it("returns a full analysis for a valid URL", async () => {
    const result = await handleAnalyze(req({ url: "https://example.com/article" }), fetchOptions);
    assert.equal(result.status, 200);
    const data = result.body as unknown as {
      url: string;
      overallScore: number;
      seoScore: number;
      aiAnswerScore: number;
      checklist: unknown[];
      summary: string;
      stats: { title: string | null };
    };
    assert.equal(data.url, "https://example.com/article");
    assert.ok(data.overallScore >= 0 && data.overallScore <= 100);
    assert.ok(Array.isArray(data.checklist));
    assert.equal(typeof data.summary, "string");
    assert.equal(data.stats.title, "Test page for the analyzer integration test");
  });

  it("returns a generic error with correlation id when the fetcher explodes", async () => {
    const explodingFetch = (async () => {
      throw new TypeError("ECONNRESET weird internal detail");
    }) as unknown as typeof fetch;
    const result = await handleAnalyze(req({ url: "https://example.com/x" }), {
      fetchImpl: explodingFetch,
      resolveHost: publicResolver,
    });
    assert.equal(result.status, 400); // fetch failures map to a safe user message
    assert.doesNotMatch(String(result.body.error), /ECONNRESET|internal/);
  });

  it("rate-limits excessive requests from one IP", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 10; i++) {
      const result = await handleAnalyze(req({ url: "https://example.com/rate" }, ip), fetchOptions);
      assert.equal(result.status, 200);
    }
    const blocked = await handleAnalyze(req({ url: "https://example.com/rate" }, ip), fetchOptions);
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers && blocked.headers["Retry-After"]);
  });

  it("does not rate-limit a different IP", async () => {
    const other = `198.51.100.${Math.floor(Math.random() * 200) + 5}`;
    const result = await handleAnalyze(req({ url: "https://example.com/other" }, other), fetchOptions);
    assert.equal(result.status, 200);
  });
});
