# SearchReady

Unified Search Visibility Platform (SEO + GEO + AEO) — see how ready your
content is for both traditional search engines and AI answer engines, with
one clear score and a prioritized, actionable checklist.

## Features

- **URL Analyzer** — paste any public URL, get an overall readiness score,
  separate SEO, AI-answer, and **Entity SEO** scores, and a prioritized checklist.
- **Entity intelligence (SEO + AEO + GEO)** — a dedicated Entity score for
  knowledge-graph readiness, across three pillars: entity identity (typed
  schema.org entities, named authors, sameAs links, brand consistency,
  about/mentions), entity AEO (attribution in the answer block, author in
  structured data), and entity GEO (definitional sentences, og:title/og:type
  metadata).
- **Structure & content checks** — heading structure, direct short-answer
  blocks (40–80 words), FAQ detection, entity clarity, core on-page signals.
- **Content template generator** — topic in, ready-to-use outline with
  question-based headings and direct-answer blocks out.
- **Dashboard & history** — server-side history synced to your account when
  Supabase is configured; falls back to browser-local storage in demo mode.
- **Auth** — email/password via Supabase (optional; the app runs without it).

## Tech stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · htmlparser2 + css-select
(pure-JS DOM parsing, no native/WASM deps) · Supabase (Postgres + Auth, RLS
enforced) · Node's built-in test runner.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

The app boots in **demo mode** (no accounts, history stored in the browser).
All analyzer and template features work without any configuration.

## Enabling accounts + synced history (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/0001_initial_schema.sql`.
   This creates the `analyses` table **and enables Row Level Security with
   ownership-only policies on every table**.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon **public** key
4. Restart `npm run dev`.

> The anon key is safe to expose to the browser **only because RLS is
> enabled on every table**. The `service_role` key must never appear in
> this app — leave it in the Supabase dashboard.

## Scripts

| Command         | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `npm run dev`   | Dev server                                                |
| `npm test`      | Type-check + unit & integration tests (53 tests)          |
| `npm run build` | Production build                                          |
| `npm start`     | Serve the production build                                |

## Testing notes

- **Unit tests** cover the analysis engine, SSRF guard, template generator,
  rate limiter and security headers.
- **Integration tests** exercise the full API pipeline (validation → SSRF
  guard → fetch → analysis → error shaping → rate limiting) against the
  transport-independent handlers in `lib/api-handlers.ts`, with the network
  stubbed.
- The **authenticated** history paths (RLS, ownership) are enforced by the
  database policies in `supabase/migrations` and require a real Supabase
  project to exercise end-to-end.

## Security

Implemented per the SearchReady security guide (all five checks):

1. **Secret leak prevention** — no secrets in code; `.env` is git-ignored;
   `.env.example` documents placeholders only; CI runs Gitleaks on every push.
   Rotate any secret that was ever committed.
2. **Personal data flow** — in demo mode no personal data leaves the browser.
   With Supabase enabled, only your email (auth) and analysis history are
   stored, protected by RLS. No analytics or third-party trackers.
3. **Pre-deploy production audit** — security headers on every response
   (CSP, HSTS, nosniff, DENY, Referrer-Policy, Permissions-Policy);
   rate limiting on all API endpoints (10/min analyze + templates, 60/min
   history); generic error messages with correlation IDs — details go to
   server logs only.
4. **Deep audit of critical logic** — SSRF protection on the URL fetcher
   (scheme/port allowlists, private-IP + metadata-range blocking, per-hop
   re-validation of redirects, DNS rebinding mitigation, response size caps);
   `user_id` always derived from the verified session (never the client) —
   no IDOR; middleware uses `getUser()` (server-validated), not
   `getSession()` (cookie-trusting).
5. **Dependency audit** — `npm audit --audit-level=high` fails CI.

## Deployment (Netlify)

The repo ships with `netlify.toml` using the official Next.js runtime.

```bash
npm run build          # verify locally first
```

**Continuous deployment is live**: the repo is connected to Netlify via Git.
Every push to `main` builds and deploys automatically (`netlify.toml` defines
build command `npm run build`, publish directory `.next`, Node 20, and the
`@netlify/plugin-nextjs` plugin). Pull requests get branch-preview URLs.
Roll back any time from Netlify → Deploys → *Publish deploy*.

Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
Netlify environment variables when you connect a real Supabase project.

`.github/workflows/live-check.yml` is a manual production smoke test — push to
a `live-check` branch or run it from the Actions tab to re-verify the live
site (pages, security headers, analyzer/templates APIs, rate limiting, SSRF
guard).

### Production notes

- The in-memory rate limiter is per-instance; for multi-instance scale,
  back it with a shared store (Redis / Upstash).
- CSP currently allows `'unsafe-inline'`/`'unsafe-eval'` for scripts
  (required by Next.js hydration). Move to a nonce-based CSP if you add
  third-party scripts.
- Account deletion: users can delete their own rows via the dashboard;
  full account deletion (auth user) is available in the Supabase dashboard
  (Authentication → Users) — `analyses` rows cascade-delete with the user.

## Re-running the security prompts

After any major feature update, re-run the five security checks from the
SearchReady product/security spec — CI automates checks 1, 3 and 5 on
every push.
