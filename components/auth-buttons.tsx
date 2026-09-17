"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Login/Logout controls; hidden in demo mode. */
export default function AuthButtons() {
  const [configured, setConfigured] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    setConfigured(true);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth
      .getUser()
      .then(({ data }) => setLoggedIn(Boolean(data.user)))
      .finally(() => setReady(true));
  }, []);

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setLoggedIn(false);
    window.location.href = "/";
  }

  if (!ready || !configured) return null;

  return loggedIn ? (
    <button
      onClick={logout}
      className="text-sm font-medium text-slate-600 hover:text-brand-600"
    >
      Log out
    </button>
  ) : (
    <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600">
      Log in
    </Link>
  );
}
