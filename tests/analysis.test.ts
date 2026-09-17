import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "../lib/dom";
import { analyzeHtml, checkDirectAnswer, checkFaq, generateSummary } from "../lib/analysis";

const words = (n: number, seed = "word") =>
  Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");

function buildPage(opts: {
  title?: string;
  metaDescription?: string;
  h1?: boolean;
  questionHeadings?: number;
  directAnswer?: boolean;
  faqSchema?: boolean;
  structuredData?: boolean;
  bodyWords?: number;
}): string {
  const headings = Array.from(
    { length: opts.questionHeadings ?? 0 },
    (_, i) => `<h2>Question heading ${i + 1}?</h2><p>${words(50)}</p>`,
  ).join("");
  const answer = opts.directAnswer ? `<p>${words(55, "ans")}</p>` : "";
  const faq = opts.faqSchema
    ? `<script type="application/ld+json">{"@type":"FAQPage"}</script>`
    : "";
  const sd = opts.structuredData
    ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${opts.title ? `<title>${opts.title}</title>` : ""}
  ${opts.metaDescription ? `<meta name="description" content="${opts.metaDescription}">` : ""}
  <link rel="canonical" href="https://example.com/page">
  ${sd}
</head>
<body>
  ${opts.h1 === false ? "" : "<h1>Test page heading</h1>"}
  ${answer}
  ${headings}
  <p>${words(Math.max(0, (opts.bodyWords ?? 400) - 55))}</p>
  ${faq}
</body>
</html>`;
}

describe("checkDirectAnswer", () => {
  it("detects a 40–80 word paragraph near the top", () => {
    const page = parsePage(`<body><p>${words(60)}</p></body>`);
    assert.equal(checkDirectAnswer(page), true);
  });

  it("rejects a too-short paragraph", () => {
    const page = parsePage(`<body><p>${words(20)}</p></body>`);
    assert.equal(checkDirectAnswer(page), false);
  });

  it("rejects a too-long paragraph", () => {
    const page = parsePage(`<body><p>${words(150)}</p></body>`);
    assert.equal(checkDirectAnswer(page), false);
  });
});

describe("checkFaq", () => {
  it("detects FAQPage JSON-LD", () => {
    const page = parsePage(`<body><p>${words(30)}</p></body>`);
    assert.equal(checkFaq(page, '<script>{"@type":"FAQPage"}</script>'), true);
  });

  it("detects two question-form headings", () => {
    const page = parsePage(`<body><h2>What is it?</h2><h2>How much?</h2></body>`);
    assert.equal(checkFaq(page, ""), true);
  });

  it("rejects pages with no FAQ signals", () => {
    const page = parsePage(`<body><h2>Overview</h2><p>${words(30)}</p></body>`);
    assert.equal(checkFaq(page, ""), false);
  });
});

describe("analyzeHtml", () => {
  it("scores a well-optimized page high", () => {
    const result = analyzeHtml(
      buildPage({
        title: "A perfectly sized title tag for the test page",
        metaDescription: words(18, "desc"),
        questionHeadings: 4,
        directAnswer: true,
        faqSchema: true,
        structuredData: true,
        bodyWords: 800,
      }),
      "https://example.com/page",
    );
    assert.ok(result.overallScore >= 80);
    assert.ok(result.seoScore >= 85);
    assert.ok(result.aiAnswerScore >= 80);
    assert.ok(result.summary.includes("Excellent"));
  });

  it("scores an empty page low", () => {
    const result = analyzeHtml("<html><body></body></html>", "https://example.com/empty");
    assert.ok(result.overallScore <= 20);
    assert.ok(result.summary.includes("Poor"));
  });

  it("returns scores within 0–100 and overall = mean of parts", () => {
    const result = analyzeHtml(buildPage({ title: "Short" }), "https://example.com/x");
    assert.ok(result.seoScore >= 0 && result.seoScore <= 100);
    assert.ok(result.aiAnswerScore >= 0 && result.aiAnswerScore <= 100);
    assert.equal(result.overallScore, Math.round((result.seoScore + result.aiAnswerScore) / 2));
  });

  it("produces a complete checklist", () => {
    const result = analyzeHtml(buildPage({}), "https://example.com/x");
    assert.ok(result.checklist.length > 8);
    for (const item of result.checklist) {
      assert.equal(typeof item.id, "string");
      assert.ok(["high", "medium", "low"].includes(item.impact));
      assert.ok(["seo", "ai"].includes(item.category));
      assert.ok(typeof item.fix === "string" && item.fix.length > 0);
    }
  });

  it("flags missing H1 and duplicate H1s", () => {
    const noH1 = analyzeHtml(buildPage({ h1: false }), "https://example.com/x");
    assert.equal(noH1.checklist.find((c) => c.id === "h1")?.passed, false);

    const twoH1 = analyzeHtml(
      buildPage({}).replace("<h1>Test page heading</h1>", "<h1>One</h1><h1>Two</h1>"),
      "https://example.com/x",
    );
    assert.equal(twoH1.checklist.find((c) => c.id === "h1")?.passed, false);
  });

  it("detects meta description and title correctly", () => {
    const result = analyzeHtml(
      buildPage({ title: "A perfectly sized title tag for the test page", metaDescription: words(15, "d") }),
      "https://example.com/x",
    );
    assert.equal(result.stats.title, "A perfectly sized title tag for the test page");
    assert.ok(result.stats.metaDescription!.startsWith("d0"));
  });
});

describe("generateSummary", () => {
  it("returns the right band for each score", () => {
    assert.ok(generateSummary(90).includes("Excellent"));
    assert.ok(generateSummary(70).includes("Good foundation"));
    assert.ok(generateSummary(50).includes("Needs work"));
    assert.ok(generateSummary(10).includes("Poor readiness"));
  });
});
