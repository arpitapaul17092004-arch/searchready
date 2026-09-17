import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SECURITY_HEADERS } from "./lib/security-headers";

/**
 * Middleware: security headers on every response, Supabase session
 * refresh (when configured), and protection of /dashboard.
 */

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  if (supabaseConfigured) {
    const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Re-apply security headers after recreating the response.
          for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
            response.headers.set(key, value);
          }
        },
      },
    });

    // IMPORTANT: getUser() (not getSession()) — it revalidates the JWT
    // with the auth server instead of trusting the cookie payload.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isProtected = request.nextUrl.pathname.startsWith("/dashboard");
    if (isProtected && !user) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
