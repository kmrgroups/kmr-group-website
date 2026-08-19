-- ============================================================
-- KMR Group of Companies — Phase 1: Master Data + Inventory
-- (Customers, Vendors, Items, Warehouses, Stock ledger, Employees)
-- Run this once in Supabase SQL Editor, after
-- add-permissions-and-compliance.sql. Safe to re-run.
-- ============================================================

-- 1. CUSTOMERS
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  gstin text,
  billing_address text,
  shipping_address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 2. VENDORS / SUPPLIERS
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  gstin text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 3. ITEMS MASTER (internal ERP items — raw materials, finished goods,
--    trading goods, services. Separate from the public "products" table,
--    which is only your website storefront catalog.)
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_code text unique not null,
  name text not null,
  item_type text not null default 'trading' check (
    item_type in ('raw_material','finished_good','trading','service')
  ),
  category text,
  unit_of_measure text not null default 'nos',
  hsn_code text,
  standard_cost numeric(12,2) default 0,
  selling_price numeric(12,2) default 0,
  reorder_level numeric(12,2) default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 4. WAREHOUSES / STORAGE LOCATIONS
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 5. STOCK LEDGER — every stock movement is one row here. Current stock
--    for an item/warehouse is the sum of quantity for that pair.
--    Future phases (Purchase Order receipts, Sales Order dispatches,
--    Work Order consumption/output) will all insert rows here, so this
--    table is the single source of truth for inventory going forward.
create table if not exists stock_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id),
  warehouse_id uuid not null references warehouses(id),
  transaction_type text not null check (
    transaction_type in ('opening','purchase_receipt','sales_dispatch','production_consumption','production_output','adjustment')
  ),
  quantity numeric(12,2) not null, -- positive = stock in, negative = stock out
  unit_cost numeric(12,2),
  reference_note text,
  transaction_date date not null default current_date,
  created_at timestamptz default now()
);

-- Convenience view: current on-hand stock per item per warehouse.
create or replace view stock_balances as
select
  item_id,
  warehouse_id,
  sum(quantity) as quantity_on_hand
from stock_transactions
group by item_id, warehouse_id;

-- 6. EMPLOYEES (foundation for the HRM phase)
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique not null,
  full_name text not null,
  department text,
  designation text,
  email text,
  phone text,
  date_of_joining date,
  pf_number text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- ============================================================
-- Extend staff_permissions to allow these as resources.
-- ============================================================
alter table staff_permissions drop constraint if exists staff_permissions_resource_check;
alter table staff_permissions add constraint staff_permissions_resource_check check (resource in (
  'hero_content','leaders','verticals','gallery_items','products',
  'orders','legal_pages','company_info','compliance_records',
  'customers','vendors','inventory_items','warehouses','stock_transactions','employees'
));

-- ============================================================
-- ROW LEVEL SECURITY — all internal, no public access at all.
-- ============================================================
alter table customers enable row level security;
alter table vendors enable row level security;
alter table inventory_items enable row level security;
alter table warehouses enable row level security;
alter table stock_transactions enable row level security;
alter table employees enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['customers','vendors','inventory_items','warehouses','stock_transactions','employees']
  loop
    execute format('drop policy if exists "staff read %1$s" on %1$s', t);
    execute format('drop policy if exists "staff insert %1$s" on %1$s', t);
    execute format('drop policy if exists "staff update %1$s" on %1$s', t);
    execute format('drop policy if exists "staff delete %1$s" on %1$s', t);

    execute format('create policy "staff read %1$s" on %1$s for select using (has_permission(''%1$s'', ''read''))', t);
    execute format('create policy "staff insert %1$s" on %1$s for insert with check (has_permission(''%1$s'', ''create''))', t);
    execute format('create policy "staff update %1$s" on %1$s for update using (has_permission(''%1$s'', ''update''))', t);
    execute format('create policy "staff delete %1$s" on %1$s for delete using (has_permission(''%1$s'', ''delete''))', t);
  end loop;
end $$;
