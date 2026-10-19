-- Steps 2.16 and 2.18: every sign up gets a profile, and the role is mirrored into the
-- sign in token so route guards can read it without a database call.
--
-- The role is read from raw_app_meta_data. A person signing up cannot set that field.
-- Only the service role can. Everyone who signs up on their own becomes a customer.
-- A role change takes effect the next time the token refreshes (up to 1 hour) or on next sign in.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  v_role := case
    when new.raw_app_meta_data ->> 'role' in ('customer', 'provider', 'admin')
      then (new.raw_app_meta_data ->> 'role')::public.user_role
    else 'customer'
  end;
  insert into public.profiles (id, role) values (new.id, v_role) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.sync_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return null;
end;
$$;
create trigger profiles_sync_role after insert or update of role on public.profiles
  for each row execute function public.sync_role_to_auth();

-- Backfill anyone who signed up before this migration.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;
