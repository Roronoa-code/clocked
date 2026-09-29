-- Clocked lives in the shared Supabase project, isolated from other apps.
-- One versioned row makes timer, agreement, archive, and history changes atomic.
-- ponytail: split records into tables with transactions if shared history approaches the 2 MB API limit.
create table if not exists public.clocked_state (
  id integer primary key default 1 check (id = 1),
  version bigint not null default 0 check (version >= 0),
  data jsonb not null default '{"agreement":null,"sessions":[],"archives":[],"activeSession":null,"settings":{"reducedMotion":"system","showExcessDetails":true}}'::jsonb,
  updated_by text check (updated_by in ('abdul', 'halimah')),
  updated_at timestamptz not null default now()
);

alter table public.clocked_state enable row level security;
revoke all on public.clocked_state from public, anon, authenticated;
grant select, update on public.clocked_state to service_role;
insert into public.clocked_state (id) values (1) on conflict (id) do nothing;

-- Only a salted hash of the visitor address is retained for PIN throttling.
create table if not exists public.clocked_sign_in_failures (
  party text not null check (party in ('abdul', 'halimah')),
  address_hash text not null,
  failures integer not null default 0 check (failures >= 0),
  first_failed_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (party, address_hash)
);

alter table public.clocked_sign_in_failures enable row level security;
revoke all on public.clocked_sign_in_failures from public, anon, authenticated;
grant select, insert, update, delete on public.clocked_sign_in_failures to service_role;

create or replace function public.clocked_register_login(
  p_party text,
  p_address_hash text,
  p_valid boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.clocked_sign_in_failures%rowtype;
  checked_at timestamptz := now();
begin
  if p_party not in ('abdul', 'halimah') or length(p_address_hash) <> 64 then
    return false;
  end if;

  insert into public.clocked_sign_in_failures (party, address_hash)
  values (p_party, p_address_hash)
  on conflict do nothing;

  select * into attempt
  from public.clocked_sign_in_failures
  where party = p_party and address_hash = p_address_hash
  for update;

  if attempt.locked_until > checked_at then
    return false;
  end if;

  if p_valid then
    delete from public.clocked_sign_in_failures
    where party = p_party and address_hash = p_address_hash;
    return true;
  end if;

  if attempt.first_failed_at < checked_at - interval '15 minutes' then
    update public.clocked_sign_in_failures
    set failures = 1, first_failed_at = checked_at, locked_until = null
    where party = p_party and address_hash = p_address_hash;
  else
    update public.clocked_sign_in_failures
    set failures = failures + 1,
        locked_until = case when failures + 1 >= 5 then checked_at + interval '1 hour' else null end
    where party = p_party and address_hash = p_address_hash;
  end if;
  return false;
end;
$$;

revoke all on function public.clocked_register_login(text, text, boolean) from public, anon, authenticated;
grant execute on function public.clocked_register_login(text, text, boolean) to service_role;
