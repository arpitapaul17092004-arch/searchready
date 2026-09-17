"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const api_handlers_1 = require("../lib/api-handlers");
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
function req(body) {
    return {
        json: async () => body,
        headers: { get: () => null },
    };
}
(0, node_test_1.describe)("/api/history handlers (demo mode)", () => {
    (0, node_test_1.it)("GET returns 501 when Supabase is not configured", async () => {
        const result = await (0, api_handlers_1.handleHistoryGet)(nullClient);
        strict_1.default.equal(result.status, 501);
        strict_1.default.ok(typeof result.body.error === "string");
        strict_1.default.ok(result.body.correlationId);
    });
    (0, node_test_1.it)("POST returns 501 even for valid payloads", async () => {
        const result = await (0, api_handlers_1.handleHistoryPost)(req({
            url: "https://example.com/x",
            overallScore: 80,
            seoScore: 90,
            aiAnswerScore: 70,
        }), nullClient);
        strict_1.default.equal(result.status, 501);
    });
    (0, node_test_1.it)("DELETE returns 501 when not configured", async () => {
        const result = await (0, api_handlers_1.handleHistoryDelete)({ url: "http://localhost:3000/api/history?id=00000000-0000-0000-0000-000000000000" }, nullClient);
        strict_1.default.equal(result.status, 501);
    });
});
