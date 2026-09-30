-- =====================================================================
--  Remove the old website Operations data (customers, vendors, items,
--  warehouses, stock ledger, employees) — PERMANENT.
--  Run once, only after exporting anything you still need
--  (Supabase › Table editor › each table › Export to CSV).
--  KMR Console customers, HRM employees and the Operations Master
--  (KMR Apps) are separate and are NOT touched.
-- =====================================================================
drop view  if exists public.stock_balances;
drop table if exists public.stock_transactions;
drop table if exists public.inventory_items;
drop table if exists public.warehouses;
drop table if exists public.vendors;
drop table if exists public.customers;
drop table if exists public.employees;
delete from public.staff_permissions
 where resource in ('customers','vendors','inventory_items','warehouses','stock_transactions','employees');
