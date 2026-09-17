import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleHistoryGet,
  handleHistoryPost,
  handleHistoryDelete,
  type ApiRequestLike,
} from "../lib/api-handlers";

/**
 * Integration tests for the history handlers in demo mode
 * (Supabase not configured — the client factory returns null,
 * exactly what happens when env vars are placeholders).
 *
 * Authenticated paths (RLS, ownership) are enforced by the database
 * policies in supabase/migrations and require a real project —
 * see README "Testing notes".
 */

const nullClient = async () => null;

function req(body: unknown): ApiRequestLike {
  return {
    json: async () => body,
    headers: { get: () => null },
  };
}

describe("/api/history handlers (demo mode)", () => {
  it("GET returns 501 when Supabase is not configured", async () => {
    const result = await handleHistoryGet(nullClient);
    assert.equal(result.status, 501);
    assert.ok(typeof result.body.error === "string");
    assert.ok(result.body.correlationId);
  });

  it("POST returns 501 even for valid payloads", async () => {
    const result = await handleHistoryPost(
      req({
        url: "https://example.com/x",
        overallScore: 80,
        seoScore: 90,
        aiAnswerScore: 70,
      }),
      nullClient,
    );
    assert.equal(result.status, 501);
  });

  it("DELETE returns 501 when not configured", async () => {
    const result = await handleHistoryDelete(
      { url: "http://localhost:3000/api/history?id=00000000-0000-0000-0000-000000000000" },
      nullClient,
    );
    assert.equal(result.status, 501);
  });
});
