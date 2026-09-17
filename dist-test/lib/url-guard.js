"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsafeUrlError = void 0;
exports.isPrivateIp = isPrivateIp;
exports.validateUrlShape = validateUrlShape;
exports.assertPublicHost = assertPublicHost;
exports.fetchPageSafely = fetchPageSafely;
const promises_1 = __importDefault(require("node:dns/promises"));
const node_net_1 = __importDefault(require("node:net"));
/**
 * SSRF protection for user-supplied URLs.
 *
 * The analyzer fetches arbitrary user-supplied URLs server-side. Without
 * these checks an attacker could point the service at internal
 * infrastructure (cloud metadata endpoints, databases, admin panels).
 *
 * Rules:
 *  - Only http/https schemes
 *  - Only standard ports (80/443 or default)
 *  - Hostname must not be an internal name (localhost, *.local, *.internal)
 *  - Every resolved IP (A/AAAA) must be public
 *  - Redirects are followed manually and each hop is re-validated
 */
const BLOCKED_HOSTNAME_SUFFIXES = [
    "localhost",
    ".local",
    ".internal",
    ".lan",
    ".localdomain",
];
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3 MB
const FETCH_TIMEOUT_MS = 15000;
class UnsafeUrlError extends Error {
    constructor(message = "URL is not allowed") {
        super(message);
        this.name = "UnsafeUrlError";
    }
}
exports.UnsafeUrlError = UnsafeUrlError;
function isPrivateIPv4(ip) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
        return true; // treat malformed as unsafe
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127)
        return true; // this-network, private, loopback
    if (a === 169 && b === 254)
        return true; // link-local incl. cloud metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31)
        return true; // private
    if (a === 192 && b === 168)
        return true; // private
    if (a === 100 && b >= 64 && b <= 127)
        return true; // CGNAT
    if (a >= 224)
        return true; // multicast + reserved
    return false;
}
function isPrivateIPv6(ip) {
    const normalized = ip.toLowerCase();
    if (normalized === "::" || normalized === "::1")
        return true; // unspecified, loopback
    if (normalized.startsWith("fe80"))
        return true; // link-local
    if (/^f[cd][0-9a-f]{2}:/.test(normalized))
        return true; // unique local
    if (normalized.startsWith("::ffff:")) {
        // IPv4-mapped — inspect the embedded IPv4
        const v4 = normalized.slice(7);
        if (node_net_1.default.isIPv4(v4))
            return isPrivateIPv4(v4);
        return true;
    }
    return false;
}
function isPrivateIp(ip) {
    if (node_net_1.default.isIPv4(ip))
        return isPrivateIPv4(ip);
    if (node_net_1.default.isIPv6(ip))
        return isPrivateIPv6(ip);
    return true; // unknown family -> unsafe
}
/** Basic URL-shape validation before any DNS resolution. */
function validateUrlShape(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl.trim());
    }
    catch {
        throw new UnsafeUrlError("Invalid URL format");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new UnsafeUrlError("Only http and https URLs are supported");
    }
    if (url.port && url.port !== "80" && url.port !== "443") {
        throw new UnsafeUrlError("Non-standard ports are not allowed");
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
    if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))) {
        throw new UnsafeUrlError("Internal hostnames are not allowed");
    }
    // Literal IPs embedded in the hostname (no DNS hop needed)
    if (node_net_1.default.isIP(host)) {
        if (isPrivateIp(host)) {
            throw new UnsafeUrlError("Private IP addresses are not allowed");
        }
    }
    if (url.username || url.password) {
        throw new UnsafeUrlError("Credentials in URLs are not allowed");
    }
    return url;
}
/** Resolve hostname and confirm every address is public. */
async function assertPublicHost(hostname, resolveHost = defaultResolveHost) {
    let addresses;
    try {
        addresses = await resolveHost(hostname);
    }
    catch {
        throw new UnsafeUrlError("Hostname could not be resolved");
    }
    if (addresses.length === 0) {
        throw new UnsafeUrlError("Hostname could not be resolved");
    }
    for (const address of addresses) {
        if (isPrivateIp(address)) {
            throw new UnsafeUrlError("Private or reserved IP addresses are not allowed");
        }
    }
}
async function defaultResolveHost(hostname) {
    const records = await promises_1.default.lookup(hostname, { all: true });
    return records.map((r) => r.address);
}
/**
 * Fetch remote page content safely: SSRF checks on every hop,
 * timeouts, response size cap, no credential leakage in errors.
 * fetchImpl/resolveHost are injectable for testing.
 */
async function fetchPageSafely(rawUrl, options = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const resolveHost = options.resolveHost ?? defaultResolveHost;
    let url = validateUrlShape(rawUrl);
    let response = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertPublicHost(url.hostname, resolveHost);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            response = await fetchImpl(url.toString(), {
                signal: controller.signal,
                redirect: "manual",
                headers: {
                    "User-Agent": "SearchReadyBot/1.0 (+https://searchready.app)",
                    Accept: "text/html,application/xhtml+xml",
                },
            });
        }
        catch {
            throw new UnsafeUrlError("The page could not be fetched (timeout or unreachable)");
        }
        finally {
            clearTimeout(timer);
        }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) {
                throw new UnsafeUrlError("Redirect without a target location");
            }
            const next = new URL(location, url); // handle relative redirects
            if (next.protocol !== "http:" && next.protocol !== "https:") {
                throw new UnsafeUrlError("Redirected to a non-HTTP protocol");
            }
            url = next;
            continue;
        }
        break;
    }
    if (!response) {
        throw new UnsafeUrlError("The page could not be fetched");
    }
    if (!response.ok) {
        throw new UnsafeUrlError(`The page responded with HTTP ${response.status} — check the URL or the page's availability`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
        throw new UnsafeUrlError("The URL did not return an HTML page");
    }
    const contentLength = parseInt(response.headers.get("content-length") ?? "", 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new UnsafeUrlError("The page is too large to analyze (limit: 3 MB)");
    }
    let html = "";
    try {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_RESPONSE_BYTES) {
            throw new UnsafeUrlError("The page is too large to analyze (limit: 3 MB)");
        }
        html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    }
    catch (err) {
        if (err instanceof UnsafeUrlError)
            throw err;
        throw new UnsafeUrlError("The page content could not be read");
    }
    return { finalUrl: url.toString(), html, statusCode: response.status };
}
