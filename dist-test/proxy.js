"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.proxy = proxy;
const server_1 = require("next/server");
const ssr_1 = require("@supabase/ssr");
const security_headers_1 = require("./lib/security-headers");
/**
 * Middleware: security headers on every response, Supabase session
 * refresh (when configured), and protection of /dashboard.
 */
async function proxy(request) {
    let response = server_1.NextResponse.next({ request });
    for (const [key, value] of Object.entries(security_headers_1.SECURITY_HEADERS)) {
        response.headers.set(key, value);
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
    if (supabaseConfigured) {
        const supabase = (0, ssr_1.createServerClient)(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = server_1.NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    // Re-apply security headers after recreating the response.
                    for (const [key, value] of Object.entries(security_headers_1.SECURITY_HEADERS)) {
                        response.headers.set(key, value);
                    }
                },
            },
        });
        // IMPORTANT: getUser() (not getSession()) — it revalidates the JWT
        // with the auth server instead of trusting the cookie payload.
        const { data: { user }, } = await supabase.auth.getUser();
        const isProtected = request.nextUrl.pathname.startsWith("/dashboard");
        if (isProtected && !user) {
            const redirect = request.nextUrl.clone();
            redirect.pathname = "/login";
            redirect.searchParams.set("next", request.nextUrl.pathname);
            return server_1.NextResponse.redirect(redirect);
        }
    }
    return response;
}
exports.config = {
    matcher: [
        // Everything except static assets and Next internals.
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
