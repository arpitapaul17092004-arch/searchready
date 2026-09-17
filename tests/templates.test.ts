import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTemplate } from "../lib/templates";
import { checkRateLimit } from "../lib/rate-limit";

describe("generateTemplate", () => {
  it("produces a complete outline for a topic", () => {
    const t = generateTemplate("email marketing");
    assert.equal(t.topic, "email marketing");
    assert.ok(t.title.length <= 65);
    assert.ok(t.metaDescription.length <= 160);
    assert.ok(t.sections.length >= 4);
    assert.ok(t.faq.length >= 3);
    assert.ok(t.tips.length > 0);
  });

  it("uses question-based headings", () => {
    const t = generateTemplate("programmatic SEO");
    const questionHeadings = t.sections.filter((s) => s.heading.endsWith("?"));
    assert.ok(questionHeadings.length >= 3);
  });

  it("caps overly long topics", () => {
    const long = "a".repeat(300);
    const t = generateTemplate(long);
    assert.ok(t.topic.length <= 120);
  });

  it("collapses and trims whitespace in topics", () => {
    const t = generateTemplate("   spaced    out   topic  ");
    assert.equal(t.topic, "spaced out topic");
    assert.ok(t.title.startsWith("Spaced out topic"));
  });
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit and blocks after", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      assert.equal(checkRateLimit(key, 5, 60_000).allowed, true);
    }
    const sixth = checkRateLimit(key, 5, 60_000);
    assert.equal(sixth.allowed, false);
    assert.equal(sixth.remaining, 0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3, 60_000);
    assert.equal(checkRateLimit(keyA, 3, 60_000).allowed, false);
    assert.equal(checkRateLimit(keyB, 3, 60_000).allowed, true);
  });
});
