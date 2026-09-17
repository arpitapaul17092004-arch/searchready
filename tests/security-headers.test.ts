import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SECURITY_HEADERS } from "../lib/security-headers";

describe("security headers", () => {
  it("includes the full production header set", () => {
    assert.equal(SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
    assert.equal(SECURITY_HEADERS["X-Frame-Options"], "DENY");
    assert.ok(
      SECURITY_HEADERS["Strict-Transport-Security"]?.includes("max-age=31536000"),
    );
    assert.ok(SECURITY_HEADERS["Referrer-Policy"]);
    assert.ok(SECURITY_HEADERS["Permissions-Policy"]);
  });

  it("CSP locks down framing, base-uri and form-action", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"] ?? "";
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
    assert.ok(csp.includes("form-action 'self'"));
    assert.ok(csp.includes("object-src") === false); // covered by default-src 'self'
  });

  it("does not allow wildcard origins anywhere", () => {
    for (const value of Object.values(SECURITY_HEADERS)) {
      assert.ok(!value.includes("*")); // no Access-Control-Allow-Origin: * anywhere
    }
  });
});
