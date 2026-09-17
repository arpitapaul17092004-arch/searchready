"use strict";
/**
 * Supabase configuration helpers.
 *
 * The app runs in two modes:
 *  - Sync mode: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY set
 *    (auth + server-side history with RLS).
 *  - Demo mode: no Supabase env vars — auth is disabled and history is
 *    stored in the browser's localStorage only.
 *
 * Only PUBLIC values are used here (anon key + RLS enforced on every
 * table — see supabase/migrations). The service role key must NEVER
 * be referenced client-side.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseConfigured = isSupabaseConfigured;
exports.getSupabaseEnv = getSupabaseEnv;
function isSupabaseConfigured() {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
function getSupabaseEnv() {
    if (!isSupabaseConfigured())
        return null;
    return {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
}
