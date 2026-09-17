import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleTemplates, type ApiRequestLike } from "../lib/api-handlers";

function req(body: unknown, ip = "203.0.113.20"): ApiRequestLike {
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

describe("POST /api/templates (handler)", () => {
  it("returns 400 for invalid JSON bodies", async () => {
    const result = await handleTemplates(req("not-json"));
    assert.equal(result.status, 400);
    assert.ok(result.body.correlationId);
  });

  it("returns 400 for an empty topic", async () => {
    const result = await handleTemplates(req({ topic: "   " }));
    assert.equal(result.status, 400);
  });

  it("returns 400 for an over-long topic", async () => {
    const result = await handleTemplates(req({ topic: "x".repeat(121) }));
    assert.equal(result.status, 400);
  });

  it("returns a complete template for a valid topic", async () => {
    const result = await handleTemplates(req({ topic: "cold email outreach" }));
    assert.equal(result.status, 200);
    const data = result.body as unknown as {
      topic: string;
      title: string;
      sections: { heading: string }[];
      faq: { question: string }[];
    };
    assert.equal(data.topic, "cold email outreach");
    assert.ok(data.sections.length >= 4);
    assert.ok(data.faq.length >= 3);
  });

  it("rate-limits excessive requests from one IP", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 10; i++) {
      const result = await handleTemplates(req({ topic: "email marketing" }, ip));
      assert.equal(result.status, 200);
    }
    const blocked = await handleTemplates(req({ topic: "email marketing" }, ip));
    assert.equal(blocked.status, 429);
  });
});
