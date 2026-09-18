import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePage } from "../lib/dom";
import {
  analyzeHtml,
  checkDirectAnswer,
  checkFaq,
  extractJsonLdTypes,
  generateSummary,
} from "../lib/analysis";

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
  entitySeo?: boolean;
  bodyWords?: number;
}): string {
  const headings = Array.from(
    { length: opts.questionHeadings ?? 0 },
    (_, i) => `<h2>Question heading ${i + 1}?</h2><p>${words(50)}</p>`,
  ).join("");
  const answer = opts.directAnswer
    ? opts.entitySeo
      ? `<p>Test page is a test resource. ${words(48, "ans")}</p>`
      : `<p>${words(55, "ans")}</p>`
    : "";
  const faq = opts.faqSchema
    ? `<script type="application/ld+json">{"@type":"FAQPage"}</script>`
    : "";
  const sd = opts.structuredData
    ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>`
    : "";
  const entity = opts.entitySeo
    ? `<meta name="author" content="Jane Doe">
  <meta property="og:site_name" content="Test page">
  <meta property="og:title" content="Test page">
  <meta property="og:type" content="article">
  <meta name="twitter:site" content="@testpage">
  <script type="application/ld+json">{"@type":"Person","name":"Jane Doe","sameAs":["https://twitter.com/janedoe"]}</script>
  <script type="application/ld+json">{"@type":"Article","author":{"@type":"Person","name":"Jane Doe"},"about":{"@type":"Thing","name":"Testing"}}</script>`
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
  ${entity}
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
        entitySeo: true,
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
    assert.ok(result.entityScore >= 0 && result.entityScore <= 100);
    assert.equal(
      result.overallScore,
      Math.round((result.seoScore + result.aiAnswerScore + result.entityScore) / 3),
    );
  });

  it("produces a complete checklist", () => {
    const result = analyzeHtml(buildPage({}), "https://example.com/x");
    assert.ok(result.checklist.length > 8);
    for (const item of result.checklist) {
      assert.equal(typeof item.id, "string");
      assert.ok(["high", "medium", "low"].includes(item.impact));
      assert.ok(
        ["seo", "ai", "entity", "entity-aeo", "entity-geo"].includes(item.category),
      );
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

describe("Entity SEO", () => {
  const entityRichHtml = `<!doctype html>
<html lang="en">
<head>
  <title>SearchReady — Unified Search Visibility Platform</title>
  <meta name="description" content="${words(18, "desc")}">
  <meta name="author" content="Arpita Paul">
  <meta property="og:site_name" content="SearchReady">
  <meta property="og:title" content="SearchReady — Unified Search Visibility Platform">
  <meta property="og:type" content="website">
  <meta name="twitter:site" content="@searchready">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SearchReady",
    "url": "https://searchready.netlify.app/",
    "sameAs": ["https://twitter.com/searchready", "https://github.com/searchready"],
    "author": { "@type": "Person", "name": "Arpita Paul" },
    "about": { "@type": "Thing", "name": "Search engine visibility" }
  }
  </script>
</head>
<body>
  <h1>SearchReady — Unified Search Visibility Platform</h1>
  <p>SearchReady is a unified search visibility platform. ${words(48, "ans")}</p>
  ${words(400)}
</body>
</html>`;

  it("extracts @type values from JSON-LD", () => {
    assert.deepEqual(
      extractJsonLdTypes('{"@type":"Organization"}'),
      ["Organization"],
    );
    assert.deepEqual(
      extractJsonLdTypes('{"@type":["Person","Article"]}').sort(),
      ["Article", "Person"],
    );
    assert.deepEqual(extractJsonLdTypes("<html></html>"), []);
  });

  it("scores an entity-rich page 100 on the entity dimension", () => {
    const result = analyzeHtml(entityRichHtml, "https://example.com/entity");
    assert.equal(result.entityScore, 100);
    assert.ok(result.stats.jsonLdTypes.includes("Organization"));
    assert.equal(result.stats.namedAuthor, true);
    assert.equal(result.stats.hasSameAs, true);
    assert.equal(result.stats.siteName, "SearchReady");
  });

  it("scores a bare page 0 on the entity dimension", () => {
    const result = analyzeHtml(
      "<html><head><title>Just a page</title></head><body><p>hello</p></body></html>",
      "https://example.com/bare",
    );
    assert.equal(result.entityScore, 0);
    assert.deepEqual(result.stats.jsonLdTypes, []);
    assert.equal(result.stats.namedAuthor, false);
  });

  it("emits entity checklist items in the entity category", () => {
    const result = analyzeHtml(entityRichHtml, "https://example.com/entity");
    const entityItems = result.checklist.filter((c) =>
      ["entity", "entity-aeo", "entity-geo"].includes(c.category),
    );
    const ids = entityItems.map((c) => c.id);
    for (const expected of [
      "entity-schema",
      "entity-author",
      "entity-sameas",
      "entity-consistency",
      "entity-about",
      "entity-answer-attribution",
      "entity-schema-author",
      "entity-definition",
      "entity-og-metadata",
    ]) {
      assert.ok(ids.includes(expected), `missing checklist item ${expected}`);
    }
    assert.ok(entityItems.every((c) => c.passed));
  });

  it("partial entity signals produce a partial score", () => {
    // Author meta only: 12/100 (the entityAuthor weight).
    const html = `<html><head><title>Page</title>
      <meta name="author" content="Jane Doe">
      </head><body><p>${words(50)}</p></body></html>`;
    const result = analyzeHtml(html, "https://example.com/partial");
    assert.equal(result.entityScore, 12);
  });

  it("Entity AEO: answer attribution passes when the answer names the entity", () => {
    // og:site_name is the only known entity; the answer block names it,
    // so attribution (10) earns points even though nothing else passes.
    const html = `<html><head><title>Welcome</title>
      <meta property="og:site_name" content="Acme">
      </head><body><h1>Welcome to our site</h1>
      <p>According to Acme research, ${words(48, "d")}.</p>
      </body></html>`;
    const result = analyzeHtml(html, "https://example.com/aeo");
    assert.equal(result.stats.hasAnswerAttribution, true);
    assert.equal(result.entityScore, 10);
  });

  it("Entity GEO: a definitional sentence earns points on its own", () => {
    const html = `<html><head><title>Welcome</title></head><body>
      <p>SearchReady is a unified search visibility platform. ${words(45, "d")}</p>
      </body></html>`;
    const result = analyzeHtml(html, "https://example.com/geo");
    assert.equal(result.stats.hasEntityDefinition, true);
    assert.equal(result.entityScore, 10);
  });

  it("Entity AEO: schema author is detected from JSON-LD", () => {
    const html = `<html><head><title>Article</title>
      <script type="application/ld+json">{"@type":"Article","author":{"@type":"Person","name":"Jane Doe"}}</script>
      </head><body><p>${words(50)}</p></body></html>`;
    const result = analyzeHtml(html, "https://example.com/schema-author");
    assert.equal(result.stats.hasSchemaAuthor, true);
    // schema 18 + schemaAuthor 10 + named author (Person JSON-LD) 12 = 40
    assert.equal(result.entityScore, 40);
  });

  it("Entity GEO: og:title + og:type metadata is detected", () => {
    const html = `<html><head><title>Welcome</title>
      <meta property="og:title" content="Welcome">
      <meta property="og:type" content="website">
      </head><body><p>${words(50)}</p></body></html>`;
    const result = analyzeHtml(html, "https://example.com/og");
    assert.equal(result.stats.hasOgEntityMetadata, true);
    assert.equal(result.entityScore, 8);
  });
});
