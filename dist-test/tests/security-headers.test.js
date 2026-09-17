"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const security_headers_1 = require("../lib/security-headers");
(0, node_test_1.describe)("security headers", () => {
    (0, node_test_1.it)("includes the full production header set", () => {
        strict_1.default.equal(security_headers_1.SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
        strict_1.default.equal(security_headers_1.SECURITY_HEADERS["X-Frame-Options"], "DENY");
        strict_1.default.ok(security_headers_1.SECURITY_HEADERS["Strict-Transport-Security"]?.includes("max-age=31536000"));
        strict_1.default.ok(security_headers_1.SECURITY_HEADERS["Referrer-Policy"]);
        strict_1.default.ok(security_headers_1.SECURITY_HEADERS["Permissions-Policy"]);
    });
    (0, node_test_1.it)("CSP locks down framing, base-uri and form-action", () => {
        const csp = security_headers_1.SECURITY_HEADERS["Content-Security-Policy"] ?? "";
        strict_1.default.ok(csp.includes("default-src 'self'"));
        strict_1.default.ok(csp.includes("frame-ancestors 'none'"));
        strict_1.default.ok(csp.includes("base-uri 'self'"));
        strict_1.default.ok(csp.includes("form-action 'self'"));
        strict_1.default.ok(csp.includes("object-src") === false); // covered by default-src 'self'
    });
    (0, node_test_1.it)("does not allow wildcard origins anywhere", () => {
        for (const value of Object.values(security_headers_1.SECURITY_HEADERS)) {
            strict_1.default.ok(!value.includes("*")); // no Access-Control-Allow-Origin: * anywhere
        }
    });
});
