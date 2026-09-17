"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const url_guard_1 = require("../lib/url-guard");
/** Minimal Response-shaped object (avoids depending on undici/WASM in tests). */
function fakeResponse(init) {
    const headers = new Map(Object.entries(init.headers ?? {}));
    const body = init.body ?? "";
    return {
        ok: init.status >= 200 && init.status < 300,
        status: init.status,
        headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    };
}
(0, node_test_1.describe)("validateUrlShape", () => {
    (0, node_test_1.it)("accepts normal http(s) URLs", () => {
        strict_1.default.equal((0, url_guard_1.validateUrlShape)("https://example.com/page?q=1").hostname, "example.com");
        strict_1.default.equal((0, url_guard_1.validateUrlShape)("http://example.com").protocol, "http:");
    });
    (0, node_test_1.it)("rejects non-HTTP schemes", () => {
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("file:///etc/passwd"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("ftp://example.com"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("javascript:alert(1)"), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("rejects invalid URLs", () => {
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("not a url"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)(""), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("rejects internal hostnames", () => {
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://localhost/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://db.internal/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://printer.local/x"), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("rejects private literal IPs", () => {
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://127.0.0.1/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://10.0.0.5/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://192.168.1.1/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://172.16.0.1/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://169.254.169.254/latest/meta-data"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://[::1]/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://[fe80::1]/x"), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("rejects non-standard ports and embedded credentials", () => {
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://example.com:8443/x"), url_guard_1.UnsafeUrlError);
        strict_1.default.throws(() => (0, url_guard_1.validateUrlShape)("https://user:pass@example.com/x"), url_guard_1.UnsafeUrlError);
    });
});
(0, node_test_1.describe)("isPrivateIp", () => {
    (0, node_test_1.it)("classifies public and private IPv4 correctly", () => {
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("8.8.8.8"), false);
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("93.184.216.34"), false);
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("192.168.0.1"), true);
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("100.64.0.1"), true); // CGNAT
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("224.0.0.1"), true); // multicast
    });
    (0, node_test_1.it)("classifies IPv6 correctly", () => {
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("2606:4700::1111"), false);
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("::1"), true);
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("fc00::1"), true);
        strict_1.default.equal((0, url_guard_1.isPrivateIp)("::ffff:169.254.169.254"), true); // mapped metadata IP
    });
});
(0, node_test_1.describe)("assertPublicHost", () => {
    (0, node_test_1.it)("rejects hostnames that do not resolve", async () => {
        const resolve = async () => {
            throw new Error("ENOTFOUND");
        };
        await strict_1.default.rejects((0, url_guard_1.assertPublicHost)("nope.invalid", resolve), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("rejects hostnames that resolve to private IPs (DNS rebinding)", async () => {
        const resolve = async () => ["192.168.0.10"];
        await strict_1.default.rejects((0, url_guard_1.assertPublicHost)("rebind.example", resolve), url_guard_1.UnsafeUrlError);
    });
});
// Fake resolver: pretend every hostname is public (no network in tests).
const publicResolver = async () => ["93.184.216.34"];
(0, node_test_1.describe)("fetchPageSafely", () => {
    (0, node_test_1.it)("blocks redirects to private ranges (SSRF via redirect)", async () => {
        const fakeFetch = (async (url) => {
            if (url === "https://evil.example/") {
                return fakeResponse({
                    status: 302,
                    headers: { location: "http://169.254.169.254/latest/meta-data" },
                });
            }
            throw new Error("should not fetch the redirect target");
        });
        await strict_1.default.rejects((0, url_guard_1.fetchPageSafely)("https://evil.example/", { fetchImpl: fakeFetch, resolveHost: publicResolver }), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("blocks non-HTML responses", async () => {
        const fakeFetch = (async () => fakeResponse({ status: 200, headers: { "content-type": "text/plain" }, body: "x" }));
        await strict_1.default.rejects((0, url_guard_1.fetchPageSafely)("https://example.com/", { fetchImpl: fakeFetch, resolveHost: publicResolver }), url_guard_1.UnsafeUrlError);
    });
    (0, node_test_1.it)("returns parsed HTML for a valid page", async () => {
        const fakeFetch = (async () => fakeResponse({
            status: 200,
            headers: { "content-type": "text/html" },
            body: "<html><body><h1>Hi</h1></body></html>",
        }));
        const page = await (0, url_guard_1.fetchPageSafely)("https://example.com/", {
            fetchImpl: fakeFetch,
            resolveHost: publicResolver,
        });
        strict_1.default.equal(page.statusCode, 200);
        strict_1.default.ok(page.html.includes("<h1>Hi</h1>"));
    });
    (0, node_test_1.it)("blocks hosts whose DNS resolves to a private IP (DNS rebinding)", async () => {
        const privateResolver = async () => ["10.1.2.3"];
        const fakeFetch = (async () => {
            throw new Error("should not be reached");
        });
        await strict_1.default.rejects((0, url_guard_1.fetchPageSafely)("https://internal-looking.example/", {
            fetchImpl: fakeFetch,
            resolveHost: privateResolver,
        }), url_guard_1.UnsafeUrlError);
    });
});
