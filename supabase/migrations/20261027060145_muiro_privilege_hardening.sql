-- Harden existing deployments too: CREATE TABLE IF NOT EXISTS and RLS alone do
-- not remove old grants or permissive policies from a table created earlier.
do $$
declare
  rec record;
begin
  for rec in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('muiro_state', 'muiro_rate_limits')
  loop
    execute format('drop policy if exists %I on %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  end loop;
end;
$$;

alter table public.muiro_state enable row level security;
alter table public.muiro_rate_limits enable row level security;

revoke all privileges on table public.muiro_state from public, anon, authenticated;
revoke all privileges on table public.muiro_rate_limits from public, anon, authenticated;
grant all privileges on table public.muiro_state to service_role;
grant all privileges on table public.muiro_rate_limits to service_role;

revoke all privileges on function public.muiro_allow_request(text, integer, integer) from public, anon, authenticated;
grant execute on function public.muiro_allow_request(text, integer, integer) to service_role;
