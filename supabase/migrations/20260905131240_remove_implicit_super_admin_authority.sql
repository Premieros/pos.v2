create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), ''),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.handle_new_auth_user() from public, anon, authenticated;

drop function if exists app_private.current_user_is_super_admin();
drop function if exists app_private.is_super_admin(uuid);

alter table public.profiles drop column if exists is_super_admin;
