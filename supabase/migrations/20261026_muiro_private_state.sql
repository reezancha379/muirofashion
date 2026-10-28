-- MUIRO's full CMS/auth state is stored as one private JSON document.
-- The state contains a hashed admin PIN and signing/authenticator secrets.
-- Never expose this table through the public or authenticated client roles.
create table if not exists public.muiro_state (
  state_key text primary key check (state_key = 'primary'),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.muiro_state enable row level security;

revoke all on table public.muiro_state from anon, authenticated;
grant all on table public.muiro_state to service_role;

comment on table public.muiro_state is
  'Private MUIRO CMS and authentication state. Access only from the server using the Supabase service role.';
