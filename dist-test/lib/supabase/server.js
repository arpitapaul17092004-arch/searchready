"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupabaseServerClient = createSupabaseServerClient;
const ssr_1 = require("@supabase/ssr");
const headers_1 = require("next/headers");
const config_1 = require("./config");
/**
 * Server-side Supabase client bound to the request's cookies.
 * Returns null in demo mode (no env configured).
 */
async function createSupabaseServerClient() {
    const env = (0, config_1.getSupabaseEnv)();
    if (!env)
        return null;
    // Next.js 15+: cookies() is async.
    const cookieStore = await (0, headers_1.cookies)();
    return (0, ssr_1.createServerClient)(env.url, env.anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                }
                catch {
                    // Called from a Server Component — safe to ignore when the
                    // middleware is refreshing sessions.
                }
            },
        },
    });
}
