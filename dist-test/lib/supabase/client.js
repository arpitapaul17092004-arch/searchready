"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseBrowserClient = getSupabaseBrowserClient;
const ssr_1 = require("@supabase/ssr");
const config_1 = require("./config");
/** Browser-side Supabase client (anon key only; RLS enforced). Returns null in demo mode. */
function getSupabaseBrowserClient() {
    const env = (0, config_1.getSupabaseEnv)();
    if (!env)
        return null;
    return (0, ssr_1.createBrowserClient)(env.url, env.anonKey);
}
