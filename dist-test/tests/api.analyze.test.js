"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const api_handlers_1 = require("../lib/api-handlers");
/**
 * Integration tests for the analyze pipeline (validation, SSRF guard,
 * fetch, analysis, error shaping, rate limiting) with the network
 * fully stubbed via the injectable fetcher/resolver.
 */
function fakeResponse(init) {
    const headers = new Map(Object.entries(init.headers ?? {}));
    const body = init.body ?? "";
    return {
        ok: init.status >= 200 && init.status < 300,
        status: init.status,
        headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    };
}
const publicResolver = async () => ["93.184.216.34"];
const fetchOptions = {
    fetchImpl: (async () => fakeResponse({
        status: 200,
        headers: { "content-type": "text/html" },
        body: "<html><head><title>Test page for the analyzer integration test</title>" +
            '<meta name="description" content="A test description long enough to pass the length checks of the engine."></head>' +
            "<body><h1>Hi</h1></body></html>",
    })),
    resolveHost: publicResolver,
};
function req(body, ip = "203.0.113.10") {
    return {
        json: async () => {
            if (typeof body === "string")
                throw new Error("invalid json");
            return body;
        },
        headers: {
            get: (name) => (name.toLowerCase() === "x-forwarded-for" ? ip : null),
        },
    };
}
(0, node_test_1.describe)("POST /api/analyze (handler)", () => {
    (0, node_test_1.it)("returns 400 for invalid JSON bodies", async () => {
        const result = await (0, api_handlers_1.handleAnalyze)(req("not-json"));
        strict_1.default.equal(result.status, 400);
        strict_1.default.ok(typeof result.body.error === "string");
        strict_1.default.ok(typeof result.body.correlationId === "string");
    });
    (0, node_test_1.it)("returns 400 for missing url", async () => {
        const result = await (0, api_handlers_1.handleAnalyze)(req({}));
        strict_1.default.equal(result.status, 400);
    });
    (0, node_test_1.it)("returns 400 for over-long urls", async () => {
        const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "https://x.com/" + "a".repeat(2100) }));
        strict_1.default.equal(result.status, 400);
    });
    (0, node_test_1.it)("blocks SSRF attempts (cloud metadata endpoint)", async () => {
        const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "http://169.254.169.254/latest/meta-data" }));
        strict_1.default.equal(result.status, 400);
        strict_1.default.match(String(result.body.error), /not allowed|Invalid/i);
    });
    (0, node_test_1.it)("blocks non-http schemes", async () => {
        const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "file:///etc/passwd" }));
        strict_1.default.equal(result.status, 400);
    });
    (0, node_test_1.it)("returns a full analysis for a valid URL", async () => {
        const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "https://example.com/article" }), fetchOptions);
        strict_1.default.equal(result.status, 200);
        const data = result.body;
        strict_1.default.equal(data.url, "https://example.com/article");
        strict_1.default.ok(data.overallScore >= 0 && data.overallScore <= 100);
        strict_1.default.ok(Array.isArray(data.checklist));
        strict_1.default.equal(typeof data.summary, "string");
        strict_1.default.equal(data.stats.title, "Test page for the analyzer integration test");
    });
    (0, node_test_1.it)("returns a generic error with correlation id when the fetcher explodes", async () => {
        const explodingFetch = (async () => {
            throw new TypeError("ECONNRESET weird internal detail");
        });
        const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "https://example.com/x" }), {
            fetchImpl: explodingFetch,
            resolveHost: publicResolver,
        });
        strict_1.default.equal(result.status, 400); // fetch failures map to a safe user message
        strict_1.default.doesNotMatch(String(result.body.error), /ECONNRESET|internal/);
    });
    (0, node_test_1.it)("rate-limits excessive requests from one IP", async () => {
        const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
        for (let i = 0; i < 10; i++) {
            const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "https://example.com/rate" }, ip), fetchOptions);
            strict_1.default.equal(result.status, 200);
        }
        const blocked = await (0, api_handlers_1.handleAnalyze)(req({ url: "https://example.com/rate" }, ip), fetchOptions);
        strict_1.default.equal(blocked.status, 429);
        strict_1.default.ok(blocked.headers && blocked.headers["Retry-After"]);
    });
    (0, node_test_1.it)("does not rate-limit a different IP", async () => {
        const other = `198.51.100.${Math.floor(Math.random() * 200) + 5}`;
        const result = await (0, api_handlers_1.handleAnalyze)(req({ url: "https://example.com/other" }, other), fetchOptions);
        strict_1.default.equal(result.status, 200);
    });
});
