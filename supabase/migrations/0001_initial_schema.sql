-- SearchReady initial schema
-- Run in the Supabase SQL editor (or via `supabase db push`).
--
-- Security: Row Level Security is REQUIRED on every table. The anon key
-- is safe to ship to the browser only because these policies constrain
-- every row to its owner.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  overall_score int not null check (overall_score between 0 and 100),
  seo_score int not null check (seo_score between 0 and 100),
  ai_answer_score int not null check (ai_answer_score between 0 and 100),
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

alter table public.analyses enable row level security;

-- Ownership-only access. No policy grants access to service_role-only
-- or public reads.
create policy "Users can read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert own analyses"
  on public.analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own analyses"
  on public.analyses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own analyses"
  on public.analyses for delete
  using (auth.uid() = user_id);

create index if not exists analyses_user_history_idx
  on public.analyses (user_id, analyzed_at desc);
