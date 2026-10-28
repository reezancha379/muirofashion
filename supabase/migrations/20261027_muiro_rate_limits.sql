-- Durable per-client request limits for the public Edge Function routes.
create table if not exists public.muiro_rate_limits (
  rate_key text primary key check (length(rate_key) between 1 and 128),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists muiro_rate_limits_updated_at_idx
  on public.muiro_rate_limits (updated_at);

alter table public.muiro_rate_limits enable row level security;
revoke all on table public.muiro_rate_limits from anon, authenticated;
grant all on table public.muiro_rate_limits to service_role;

create or replace function public.muiro_allow_request(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 128
     or p_limit is null or p_limit < 1 or p_limit > 10000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.muiro_rate_limits as current_limit
    (rate_key, window_started_at, request_count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (rate_key) do update
    set window_started_at = case
          when current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then now()
          else current_limit.window_started_at
        end,
        request_count = case
          when current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then 1
          else current_limit.request_count + 1
        end,
        updated_at = now()
  returning request_count into current_count;

  -- Opportunistically prune keys not seen for a day; no scheduler is required.
  if hashtextextended(p_key, 0) % 64 = 0 then
    delete from public.muiro_rate_limits
      where updated_at < now() - interval '1 day';
  end if;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.muiro_allow_request(text, integer, integer) from public, anon, authenticated;
grant execute on function public.muiro_allow_request(text, integer, integer) to service_role;
