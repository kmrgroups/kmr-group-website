-- =====================================================================
--  Remove the old website Operations tables — SAFE version.
--  A table is dropped ONLY if no other table points to it. Anything still
--  in use (e.g. `employees`, used by the HR module: attendance, payroll,
--  leave, letters …) is kept and listed in the messages. Never uses CASCADE.
--  Export anything you still need first (Table editor › Export to CSV).
-- =====================================================================
do $$
declare
  t text;
  deps text;
  ops text[] := array['stock_transactions','inventory_items','warehouses','vendors','customers','employees'];
begin
  for t in select unnest(ops) loop
    if to_regclass('public.' || t) is null then continue; end if;
    -- other tables (outside this list) with a foreign key to this table
    select string_agg(distinct c.conrelid::regclass::text, ', ') into deps
      from pg_constraint c
     where c.contype = 'f' and c.confrelid = ('public.' || t)::regclass
       and c.conrelid::regclass::text not in (select unnest(ops)) and c.conrelid <> c.confrelid;
    if deps is not null then
      raise notice 'KEPT %: still used by %', t, deps;
      continue;
    end if;
    -- views built on it (stock_balances on stock_transactions)
    if t = 'stock_transactions' then execute 'drop view if exists public.stock_balances'; end if;
    begin
      execute format('drop table public.%I', t);
      raise notice 'dropped %', t;
      delete from public.staff_permissions where resource = t;
    exception when dependent_objects_still_exist then
      raise notice 'KEPT %: other objects depend on it (%)', t, sqlerrm;
    end;
  end loop;
end $$;
