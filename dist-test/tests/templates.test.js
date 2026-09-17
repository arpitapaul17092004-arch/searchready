"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const templates_1 = require("../lib/templates");
const rate_limit_1 = require("../lib/rate-limit");
(0, node_test_1.describe)("generateTemplate", () => {
    (0, node_test_1.it)("produces a complete outline for a topic", () => {
        const t = (0, templates_1.generateTemplate)("email marketing");
        strict_1.default.equal(t.topic, "email marketing");
        strict_1.default.ok(t.title.length <= 65);
        strict_1.default.ok(t.metaDescription.length <= 160);
        strict_1.default.ok(t.sections.length >= 4);
        strict_1.default.ok(t.faq.length >= 3);
        strict_1.default.ok(t.tips.length > 0);
    });
    (0, node_test_1.it)("uses question-based headings", () => {
        const t = (0, templates_1.generateTemplate)("programmatic SEO");
        const questionHeadings = t.sections.filter((s) => s.heading.endsWith("?"));
        strict_1.default.ok(questionHeadings.length >= 3);
    });
    (0, node_test_1.it)("caps overly long topics", () => {
        const long = "a".repeat(300);
        const t = (0, templates_1.generateTemplate)(long);
        strict_1.default.ok(t.topic.length <= 120);
    });
    (0, node_test_1.it)("collapses and trims whitespace in topics", () => {
        const t = (0, templates_1.generateTemplate)("   spaced    out   topic  ");
        strict_1.default.equal(t.topic, "spaced out topic");
        strict_1.default.ok(t.title.startsWith("Spaced out topic"));
    });
});
(0, node_test_1.describe)("checkRateLimit", () => {
    (0, node_test_1.it)("allows requests up to the limit and blocks after", () => {
        const key = `test-${Math.random()}`;
        for (let i = 0; i < 5; i++) {
            strict_1.default.equal((0, rate_limit_1.checkRateLimit)(key, 5, 60000).allowed, true);
        }
        const sixth = (0, rate_limit_1.checkRateLimit)(key, 5, 60000);
        strict_1.default.equal(sixth.allowed, false);
        strict_1.default.equal(sixth.remaining, 0);
    });
    (0, node_test_1.it)("tracks separate keys independently", () => {
        const keyA = `a-${Math.random()}`;
        const keyB = `b-${Math.random()}`;
        for (let i = 0; i < 3; i++)
            (0, rate_limit_1.checkRateLimit)(keyA, 3, 60000);
        strict_1.default.equal((0, rate_limit_1.checkRateLimit)(keyA, 3, 60000).allowed, false);
        strict_1.default.equal((0, rate_limit_1.checkRateLimit)(keyB, 3, 60000).allowed, true);
    });
});
