import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeHtml } from "./analysis";
import { fetchPageSafely, UnsafeUrlError, type SafeFetchOptions } from "./url-guard";
import { checkRateLimit, getClientIp } from "./rate-limit";
import { generateTemplate } from "./templates";

/**
 * Transport-independent API handlers.
 *
 * Routes in app/api/* are thin Next.js adapters around these functions;
 * keeping the logic here means integration tests can exercise the full
 * request pipeline (validation, SSRF guard, rate limiting, error
 * shaping) without booting a Next server.
 */

export interface ApiRequestLike {
  json(): Promise<unknown>;
  headers: { get(name: string): string | null };
}

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

function badRequest(error: string): ApiResult {
  return { status: 400, body: { error, correlationId: crypto.randomUUID() } };
}

async function readJson(request: ApiRequestLike): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- analyze

const ANALYZE_RATE_LIMIT = 10;
const ANALYZE_WINDOW_MS = 60_000;
const MAX_URL_LENGTH = 2048;

export async function handleAnalyze(
  request: ApiRequestLike,
  fetchOptions: SafeFetchOptions = {},
): Promise<ApiResult> {
  const rate = checkRateLimit(
    `analyze:${getClientIp(request)}`,
    ANALYZE_RATE_LIMIT,
    ANALYZE_WINDOW_MS,
  );
  if (!rate.allowed) {
    return {
      status: 429,
      body: {
        error: "Too many requests. Please wait a moment and try again.",
        correlationId: crypto.randomUUID(),
      },
      headers: {
        "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
      },
    };
  }

  const body = (await readJson(request)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url || url.length > MAX_URL_LENGTH) {
    return badRequest("A valid URL is required.");
  }

  try {
    const page = await fetchPageSafely(url, fetchOptions);
    const result = analyzeHtml(page.html, url, page.finalUrl);
    return { status: 200, body: result as unknown as Record<string, unknown> };
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      // User-input problems: safe to surface the reason (no internals leaked).
      return badRequest(err.message);
    }
    const correlationId = crypto.randomUUID();
    console.error(
      `[analyze][${correlationId}]`,
      err instanceof Error ? err.message : String(err),
    );
    return {
      status: 500,
      body: {
        error: "The page could not be analyzed. Please try again later.",
        correlationId,
      },
    };
  }
}

// --------------------------------------------------------------- templates

const TEMPLATES_RATE_LIMIT = 10;
const TEMPLATES_WINDOW_MS = 60_000;
const MAX_TOPIC_LENGTH = 120;

export async function handleTemplates(request: ApiRequestLike): Promise<ApiResult> {
  const rate = checkRateLimit(
    `templates:${getClientIp(request)}`,
    TEMPLATES_RATE_LIMIT,
    TEMPLATES_WINDOW_MS,
  );
  if (!rate.allowed) {
    return {
      status: 429,
      body: {
        error: "Too many requests. Please wait a moment and try again.",
        correlationId: crypto.randomUUID(),
      },
    };
  }

  const body = (await readJson(request)) as { topic?: unknown } | null;
  const topic = typeof body?.topic === "string" ? body.topic : "";
  if (!topic.trim() || topic.length > MAX_TOPIC_LENGTH) {
    return badRequest("A topic between 1 and 120 characters is required.");
  }

  const template = generateTemplate(topic);
  return { status: 200, body: template as unknown as Record<string, unknown> };
}

// ----------------------------------------------------------------- history

const HISTORY_RATE_LIMIT = 60;
const HISTORY_WINDOW_MS = 60_000;
const MAX_HISTORY = 100;

type SupabaseClientFactory = () => Promise<SupabaseClient | null>;

interface HistoryRow {
  id: string;
  url: string;
  overall_score: number;
  seo_score: number;
  ai_answer_score: number;
  entity_score: number | null;
  analyzed_at: string;
}

async function requireUser(createClient: SupabaseClientFactory): Promise<
  { ok: true; client: SupabaseClient; userId: string } | { ok: false; result: ApiResult }
> {
  const client = await createClient();
  if (!client) {
    return {
      ok: false,
      result: {
        status: 501,
        body: {
          error: "History sync is not configured on this deployment.",
          correlationId: crypto.randomUUID(),
        },
      },
    };
  }
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      result: {
        status: 401,
        body: { error: "Authentication required.", correlationId: crypto.randomUUID() },
      },
    };
  }
  return { ok: true, client, userId: user.id };
}

export async function handleHistoryGet(
  createClient: SupabaseClientFactory,
): Promise<ApiResult> {
  const auth = await requireUser(createClient);
  if (!auth.ok) return auth.result;
  const correlationId = crypto.randomUUID();

  const { data, error } = await auth.client
    .from("analyses")
    .select(
      "id, url, overall_score, seo_score, ai_answer_score, entity_score, analyzed_at",
    )
    .eq("user_id", auth.userId)
    .order("analyzed_at", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    console.error(`[history:GET][${correlationId}]`, error.message);
    return {
      status: 500,
      body: { error: "Could not load history. Please try again later.", correlationId },
    };
  }

  const entries = (data as HistoryRow[]).map((row) => ({
    id: row.id,
    url: row.url,
    overallScore: row.overall_score,
    seoScore: row.seo_score,
    aiAnswerScore: row.ai_answer_score,
    entityScore: row.entity_score ?? undefined,
    analyzedAt: row.analyzed_at,
  }));
  return { status: 200, body: { entries } };
}

export async function handleHistoryPost(
  request: ApiRequestLike,
  createClient: SupabaseClientFactory,
): Promise<ApiResult> {
  const rate = checkRateLimit(
    `history:${getClientIp(request)}`,
    HISTORY_RATE_LIMIT,
    HISTORY_WINDOW_MS,
  );
  if (!rate.allowed) {
    return {
      status: 429,
      body: {
        error: "Too many requests. Please wait a moment.",
        correlationId: crypto.randomUUID(),
      },
    };
  }

  const auth = await requireUser(createClient);
  if (!auth.ok) return auth.result;
  const correlationId = crypto.randomUUID();

  const body = (await readJson(request)) as {
    url?: unknown;
    overallScore?: unknown;
    seoScore?: unknown;
    aiAnswerScore?: unknown;
    entityScore?: unknown;
  } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const scores = [body?.overallScore, body?.seoScore, body?.aiAnswerScore];
  if (
    !url ||
    url.length > MAX_URL_LENGTH ||
    !/^https?:\/\//i.test(url) ||
    scores.some((s) => typeof s !== "number" || !Number.isInteger(s) || s < 0 || s > 100)
  ) {
    return badRequest("Invalid history entry.");
  }

  // user_id comes from the verified session — never from the client.
  const { error } = await auth.client.from("analyses").upsert(
    {
      user_id: auth.userId,
      url,
      overall_score: body?.overallScore as number,
      seo_score: body?.seoScore as number,
      ai_answer_score: body?.aiAnswerScore as number,
      entity_score: body?.entityScore as number | undefined,
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,url" },
  );

  if (error) {
    console.error(`[history:POST][${correlationId}]`, error.message);
    return {
      status: 500,
      body: { error: "Could not save history. Please try again later.", correlationId },
    };
  }
  return { status: 200, body: { saved: true } };
}

export async function handleHistoryDelete(
  request: Pick<ApiRequestLike, never> & { url: string },
  createClient: SupabaseClientFactory,
): Promise<ApiResult> {
  const auth = await requireUser(createClient);
  if (!auth.ok) return auth.result;
  const correlationId = crypto.randomUUID();

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return badRequest("Invalid entry id.");
  }

  // Ownership enforced twice: RLS policy in the DB + explicit user_id filter.
  const { error } = await auth.client
    .from("analyses")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    console.error(`[history:DELETE][${correlationId}]`, error.message);
    return {
      status: 500,
      body: { error: "Could not delete entry. Please try again later.", correlationId },
    };
  }
  return { status: 200, body: { deleted: true } };
}
