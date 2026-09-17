import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateUrlShape,
  isPrivateIp,
  assertPublicHost,
  fetchPageSafely,
  UnsafeUrlError,
} from "../lib/url-guard";

/** Minimal Response-shaped object (avoids depending on undici/WASM in tests). */
function fakeResponse(init: {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}): Response {
  const headers = new Map(Object.entries(init.headers ?? {}));
  const body = init.body ?? "";
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  } as unknown as Response;
}

describe("validateUrlShape", () => {
  it("accepts normal http(s) URLs", () => {
    assert.equal(validateUrlShape("https://example.com/page?q=1").hostname, "example.com");
    assert.equal(validateUrlShape("http://example.com").protocol, "http:");
  });

  it("rejects non-HTTP schemes", () => {
    assert.throws(() => validateUrlShape("file:///etc/passwd"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("ftp://example.com"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("javascript:alert(1)"), UnsafeUrlError);
  });

  it("rejects invalid URLs", () => {
    assert.throws(() => validateUrlShape("not a url"), UnsafeUrlError);
    assert.throws(() => validateUrlShape(""), UnsafeUrlError);
  });

  it("rejects internal hostnames", () => {
    assert.throws(() => validateUrlShape("https://localhost/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://db.internal/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://printer.local/x"), UnsafeUrlError);
  });

  it("rejects private literal IPs", () => {
    assert.throws(() => validateUrlShape("https://127.0.0.1/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://10.0.0.5/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://192.168.1.1/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://172.16.0.1/x"), UnsafeUrlError);
    assert.throws(
      () => validateUrlShape("https://169.254.169.254/latest/meta-data"),
      UnsafeUrlError,
    );
    assert.throws(() => validateUrlShape("https://[::1]/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://[fe80::1]/x"), UnsafeUrlError);
  });

  it("rejects non-standard ports and embedded credentials", () => {
    assert.throws(() => validateUrlShape("https://example.com:8443/x"), UnsafeUrlError);
    assert.throws(() => validateUrlShape("https://user:pass@example.com/x"), UnsafeUrlError);
  });
});

describe("isPrivateIp", () => {
  it("classifies public and private IPv4 correctly", () => {
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(isPrivateIp("93.184.216.34"), false);
    assert.equal(isPrivateIp("192.168.0.1"), true);
    assert.equal(isPrivateIp("100.64.0.1"), true); // CGNAT
    assert.equal(isPrivateIp("224.0.0.1"), true); // multicast
  });

  it("classifies IPv6 correctly", () => {
    assert.equal(isPrivateIp("2606:4700::1111"), false);
    assert.equal(isPrivateIp("::1"), true);
    assert.equal(isPrivateIp("fc00::1"), true);
    assert.equal(isPrivateIp("::ffff:169.254.169.254"), true); // mapped metadata IP
  });
});

describe("assertPublicHost", () => {
  it("rejects hostnames that do not resolve", async () => {
    const resolve = async () => {
      throw new Error("ENOTFOUND");
    };
    await assert.rejects(assertPublicHost("nope.invalid", resolve), UnsafeUrlError);
  });

  it("rejects hostnames that resolve to private IPs (DNS rebinding)", async () => {
    const resolve = async () => ["192.168.0.10"];
    await assert.rejects(assertPublicHost("rebind.example", resolve), UnsafeUrlError);
  });
});

// Fake resolver: pretend every hostname is public (no network in tests).
const publicResolver = async () => ["93.184.216.34"];

describe("fetchPageSafely", () => {
  it("blocks redirects to private ranges (SSRF via redirect)", async () => {
    const fakeFetch = (async (url: string) => {
      if (url === "https://evil.example/") {
        return fakeResponse({
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        });
      }
      throw new Error("should not fetch the redirect target");
    }) as unknown as typeof fetch;

    await assert.rejects(
      fetchPageSafely("https://evil.example/", { fetchImpl: fakeFetch, resolveHost: publicResolver }),
      UnsafeUrlError,
    );
  });

  it("blocks non-HTML responses", async () => {
    const fakeFetch = (async () =>
      fakeResponse({ status: 200, headers: { "content-type": "text/plain" }, body: "x" })) as unknown as typeof fetch;

    await assert.rejects(
      fetchPageSafely("https://example.com/", { fetchImpl: fakeFetch, resolveHost: publicResolver }),
      UnsafeUrlError,
    );
  });

  it("returns parsed HTML for a valid page", async () => {
    const fakeFetch = (async () =>
      fakeResponse({
        status: 200,
        headers: { "content-type": "text/html" },
        body: "<html><body><h1>Hi</h1></body></html>",
      })) as unknown as typeof fetch;

    const page = await fetchPageSafely("https://example.com/", {
      fetchImpl: fakeFetch,
      resolveHost: publicResolver,
    });
    assert.equal(page.statusCode, 200);
    assert.ok(page.html.includes("<h1>Hi</h1>"));
  });

  it("blocks hosts whose DNS resolves to a private IP (DNS rebinding)", async () => {
    const privateResolver = async () => ["10.1.2.3"];
    const fakeFetch = (async () => {
      throw new Error("should not be reached");
    }) as unknown as typeof fetch;

    await assert.rejects(
      fetchPageSafely("https://internal-looking.example/", {
        fetchImpl: fakeFetch,
        resolveHost: privateResolver,
      }),
      UnsafeUrlError,
    );
  });
});
