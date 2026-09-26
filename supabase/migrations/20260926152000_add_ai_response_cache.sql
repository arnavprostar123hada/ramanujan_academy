create table if not exists public.ai_response_cache (
  cache_key text primary key,
  mode text not null,
  response_text text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_ai_response_cache_expires_at
  on public.ai_response_cache(expires_at);

alter table public.ai_response_cache enable row level security;

revoke all on public.ai_response_cache from anon, authenticated;
grant all on public.ai_response_cache to service_role;