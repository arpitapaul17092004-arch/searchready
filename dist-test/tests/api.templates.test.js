"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const api_handlers_1 = require("../lib/api-handlers");
function req(body, ip = "203.0.113.20") {
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
(0, node_test_1.describe)("POST /api/templates (handler)", () => {
    (0, node_test_1.it)("returns 400 for invalid JSON bodies", async () => {
        const result = await (0, api_handlers_1.handleTemplates)(req("not-json"));
        strict_1.default.equal(result.status, 400);
        strict_1.default.ok(result.body.correlationId);
    });
    (0, node_test_1.it)("returns 400 for an empty topic", async () => {
        const result = await (0, api_handlers_1.handleTemplates)(req({ topic: "   " }));
        strict_1.default.equal(result.status, 400);
    });
    (0, node_test_1.it)("returns 400 for an over-long topic", async () => {
        const result = await (0, api_handlers_1.handleTemplates)(req({ topic: "x".repeat(121) }));
        strict_1.default.equal(result.status, 400);
    });
    (0, node_test_1.it)("returns a complete template for a valid topic", async () => {
        const result = await (0, api_handlers_1.handleTemplates)(req({ topic: "cold email outreach" }));
        strict_1.default.equal(result.status, 200);
        const data = result.body;
        strict_1.default.equal(data.topic, "cold email outreach");
        strict_1.default.ok(data.sections.length >= 4);
        strict_1.default.ok(data.faq.length >= 3);
    });
    (0, node_test_1.it)("rate-limits excessive requests from one IP", async () => {
        const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
        for (let i = 0; i < 10; i++) {
            const result = await (0, api_handlers_1.handleTemplates)(req({ topic: "email marketing" }, ip));
            strict_1.default.equal(result.status, 200);
        }
        const blocked = await (0, api_handlers_1.handleTemplates)(req({ topic: "email marketing" }, ip));
        strict_1.default.equal(blocked.status, 429);
    });
});
