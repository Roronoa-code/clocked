-- Avoid the SQL CURRENT_TIME keyword when comparing timestamptz values.
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
