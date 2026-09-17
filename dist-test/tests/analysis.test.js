"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const dom_1 = require("../lib/dom");
const analysis_1 = require("../lib/analysis");
const words = (n, seed = "word") => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");
function buildPage(opts) {
    const headings = Array.from({ length: opts.questionHeadings ?? 0 }, (_, i) => `<h2>Question heading ${i + 1}?</h2><p>${words(50)}</p>`).join("");
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
(0, node_test_1.describe)("checkDirectAnswer", () => {
    (0, node_test_1.it)("detects a 40–80 word paragraph near the top", () => {
        const page = (0, dom_1.parsePage)(`<body><p>${words(60)}</p></body>`);
        strict_1.default.equal((0, analysis_1.checkDirectAnswer)(page), true);
    });
    (0, node_test_1.it)("rejects a too-short paragraph", () => {
        const page = (0, dom_1.parsePage)(`<body><p>${words(20)}</p></body>`);
        strict_1.default.equal((0, analysis_1.checkDirectAnswer)(page), false);
    });
    (0, node_test_1.it)("rejects a too-long paragraph", () => {
        const page = (0, dom_1.parsePage)(`<body><p>${words(150)}</p></body>`);
        strict_1.default.equal((0, analysis_1.checkDirectAnswer)(page), false);
    });
});
(0, node_test_1.describe)("checkFaq", () => {
    (0, node_test_1.it)("detects FAQPage JSON-LD", () => {
        const page = (0, dom_1.parsePage)(`<body><p>${words(30)}</p></body>`);
        strict_1.default.equal((0, analysis_1.checkFaq)(page, '<script>{"@type":"FAQPage"}</script>'), true);
    });
    (0, node_test_1.it)("detects two question-form headings", () => {
        const page = (0, dom_1.parsePage)(`<body><h2>What is it?</h2><h2>How much?</h2></body>`);
        strict_1.default.equal((0, analysis_1.checkFaq)(page, ""), true);
    });
    (0, node_test_1.it)("rejects pages with no FAQ signals", () => {
        const page = (0, dom_1.parsePage)(`<body><h2>Overview</h2><p>${words(30)}</p></body>`);
        strict_1.default.equal((0, analysis_1.checkFaq)(page, ""), false);
    });
});
(0, node_test_1.describe)("analyzeHtml", () => {
    (0, node_test_1.it)("scores a well-optimized page high", () => {
        const result = (0, analysis_1.analyzeHtml)(buildPage({
            title: "A perfectly sized title tag for the test page",
            metaDescription: words(18, "desc"),
            questionHeadings: 4,
            directAnswer: true,
            faqSchema: true,
            structuredData: true,
            bodyWords: 800,
        }), "https://example.com/page");
        strict_1.default.ok(result.overallScore >= 80);
        strict_1.default.ok(result.seoScore >= 85);
        strict_1.default.ok(result.aiAnswerScore >= 80);
        strict_1.default.ok(result.summary.includes("Excellent"));
    });
    (0, node_test_1.it)("scores an empty page low", () => {
        const result = (0, analysis_1.analyzeHtml)("<html><body></body></html>", "https://example.com/empty");
        strict_1.default.ok(result.overallScore <= 20);
        strict_1.default.ok(result.summary.includes("Poor"));
    });
    (0, node_test_1.it)("returns scores within 0–100 and overall = mean of parts", () => {
        const result = (0, analysis_1.analyzeHtml)(buildPage({ title: "Short" }), "https://example.com/x");
        strict_1.default.ok(result.seoScore >= 0 && result.seoScore <= 100);
        strict_1.default.ok(result.aiAnswerScore >= 0 && result.aiAnswerScore <= 100);
        strict_1.default.equal(result.overallScore, Math.round((result.seoScore + result.aiAnswerScore) / 2));
    });
    (0, node_test_1.it)("produces a complete checklist", () => {
        const result = (0, analysis_1.analyzeHtml)(buildPage({}), "https://example.com/x");
        strict_1.default.ok(result.checklist.length > 8);
        for (const item of result.checklist) {
            strict_1.default.equal(typeof item.id, "string");
            strict_1.default.ok(["high", "medium", "low"].includes(item.impact));
            strict_1.default.ok(["seo", "ai"].includes(item.category));
            strict_1.default.ok(typeof item.fix === "string" && item.fix.length > 0);
        }
    });
    (0, node_test_1.it)("flags missing H1 and duplicate H1s", () => {
        const noH1 = (0, analysis_1.analyzeHtml)(buildPage({ h1: false }), "https://example.com/x");
        strict_1.default.equal(noH1.checklist.find((c) => c.id === "h1")?.passed, false);
        const twoH1 = (0, analysis_1.analyzeHtml)(buildPage({}).replace("<h1>Test page heading</h1>", "<h1>One</h1><h1>Two</h1>"), "https://example.com/x");
        strict_1.default.equal(twoH1.checklist.find((c) => c.id === "h1")?.passed, false);
    });
    (0, node_test_1.it)("detects meta description and title correctly", () => {
        const result = (0, analysis_1.analyzeHtml)(buildPage({ title: "A perfectly sized title tag for the test page", metaDescription: words(15, "d") }), "https://example.com/x");
        strict_1.default.equal(result.stats.title, "A perfectly sized title tag for the test page");
        strict_1.default.ok(result.stats.metaDescription.startsWith("d0"));
    });
});
(0, node_test_1.describe)("generateSummary", () => {
    (0, node_test_1.it)("returns the right band for each score", () => {
        strict_1.default.ok((0, analysis_1.generateSummary)(90).includes("Excellent"));
        strict_1.default.ok((0, analysis_1.generateSummary)(70).includes("Good foundation"));
        strict_1.default.ok((0, analysis_1.generateSummary)(50).includes("Needs work"));
        strict_1.default.ok((0, analysis_1.generateSummary)(10).includes("Poor readiness"));
    });
});
