do $$
declare
  rec record;
begin
  for rec in
    with wrappers as (
      select p.oid, p.proname as wrapper, p.prosrc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and not p.prosecdef
        and p.prosrc like '%app_private.%'
    ), refs as (
      select distinct (regexp_matches(w.prosrc, 'app_private\.([a-zA-Z0-9_]+)', 'g'))[1] as target
      from wrappers w
    )
    select p.oid,
           n.nspname as schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join refs rf on rf.target = p.proname
    where n.nspname = 'app_private'
      and p.prokind = 'f'
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      rec.schema_name,
      rec.proname,
      rec.args
    );
  end loop;
end
$$;

comment on schema app_private is
'Private implementation schema. Not exposed as the public API surface. Authenticated EXECUTE is granted only where required for SECURITY INVOKER public wrappers; each private function remains responsible for permission and branch assertions.';
