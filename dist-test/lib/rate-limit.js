"use strict";
/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * NOTE: this protects a single server instance. For multi-instance
 * hosting (serverless at scale) swap the Map for a shared store
 * (e.g. Redis / Upstash) — see README "Production notes".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
exports.getClientIp = getClientIp;
const buckets = new Map();
// Periodic cleanup so the map does not grow unbounded.
const CLEANUP_INTERVAL_MS = 60000;
let lastCleanup = Date.now();
function cleanup(now) {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS)
        return;
    for (const [key, state] of buckets) {
        if (state.resetAt <= now)
            buckets.delete(key);
    }
    lastCleanup = now;
}
function checkRateLimit(key, limit, windowMs) {
    const now = Date.now();
    cleanup(now);
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
        const state = { count: 1, resetAt: now + windowMs };
        buckets.set(key, state);
        return { allowed: true, limit, remaining: limit - 1, resetAt: state.resetAt };
    }
    existing.count += 1;
    const allowed = existing.count <= limit;
    return {
        allowed,
        limit,
        remaining: Math.max(0, limit - existing.count),
        resetAt: existing.resetAt,
    };
}
/** Extract a best-effort client IP from request headers (proxy-aware). */
function getClientIp(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first)
            return first;
    }
    return request.headers.get("x-real-ip") ?? "unknown";
}
