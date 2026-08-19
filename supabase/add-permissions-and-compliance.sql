-- ============================================================
-- KMR Group of Companies — Staff Permissions + Finance/Compliance
-- Run this once in Supabase SQL Editor. Safe alongside your existing
-- schema.sql and add-orders-table.sql / add-logo-column.sql runs.
-- ============================================================

-- 1. STAFF PROFILES — one row per login (mirrors an auth.users id).
--    is_admin = true means full access to everything, no need for
--    individual permission rows.
create table if not exists staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  department text not null default 'admin' check (
    department in ('admin','sales','stores','purchase','top_management','other')
  ),
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 2. STAFF PERMISSIONS — per staff member, per section of the admin
--    panel ("resource"), what they can do.
create table if not exists staff_permissions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  resource text not null check (resource in (
    'hero_content','leaders','verticals','gallery_items','products',
    'orders','legal_pages','company_info','compliance_records'
  )),
  can_create boolean not null default false,
  can_read boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  unique (staff_id, resource)
);

-- ============================================================
-- BOOTSTRAP: turn your existing admin login into an admin profile.
-- Replace YOUR-AUTH-USER-ID below with your real UID, found in
-- Supabase -> Authentication -> Users -> click your user -> copy
-- the "User UID" value. Run this ONE line yourself after the rest
-- of this file has run once.
--
-- insert into staff_profiles (id, full_name, email, department, is_admin)
-- values ('YOUR-AUTH-USER-ID', 'Rajavelu R', 'info@kmr-groups.com', 'admin', true)
-- on conflict (id) do update set is_admin = true;
-- ============================================================

-- 3. Helper functions (SECURITY DEFINER so they can read staff_profiles
--    even though RLS is on — this is what avoids infinite recursion).
create or replace function is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from staff_profiles where id = auth.uid() and is_active = true), false);
$$;

create or replace function has_permission(resource_name text, action text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_flag boolean;
  perm_row record;
begin
  if auth.uid() is null then
    return false;
  end if;

  select is_admin into admin_flag from staff_profiles where id = auth.uid() and is_active = true;
  if admin_flag then
    return true;
  end if;

  select * into perm_row from staff_permissions where staff_id = auth.uid() and resource = resource_name;
  if not found then
    return false;
  end if;

  return case action
    when 'create' then perm_row.can_create
    when 'read' then perm_row.can_read
    when 'update' then perm_row.can_update
    when 'delete' then perm_row.can_delete
    else false
  end;
end;
$$;

-- 4. RLS on the new tables themselves.
alter table staff_profiles enable row level security;
alter table staff_permissions enable row level security;

drop policy if exists "self or admin read profile" on staff_profiles;
create policy "self or admin read profile" on staff_profiles
  for select using (auth.uid() = id or is_current_user_admin());

drop policy if exists "admin insert profiles" on staff_profiles;
create policy "admin insert profiles" on staff_profiles
  for insert with check (is_current_user_admin());

drop policy if exists "admin update profiles" on staff_profiles;
create policy "admin update profiles" on staff_profiles
  for update using (is_current_user_admin());

drop policy if exists "admin delete profiles" on staff_profiles;
create policy "admin delete profiles" on staff_profiles
  for delete using (is_current_user_admin());

drop policy if exists "self or admin read permissions" on staff_permissions;
create policy "self or admin read permissions" on staff_permissions
  for select using (auth.uid() = staff_id or is_current_user_admin());

drop policy if exists "admin manage permissions" on staff_permissions;
create policy "admin manage permissions" on staff_permissions
  for all using (is_current_user_admin()) with check (is_current_user_admin());

-- 5. Replace the old blanket "authenticated" write policies with
--    granular per-resource, per-action ones driven by has_permission().
drop policy if exists "admin write hero_content" on hero_content;
drop policy if exists "admin write leaders" on leaders;
drop policy if exists "admin write verticals" on verticals;
drop policy if exists "admin write gallery_items" on gallery_items;
drop policy if exists "admin write products" on products;
drop policy if exists "admin write legal_pages" on legal_pages;
drop policy if exists "admin write company_info" on company_info;
drop policy if exists "admin read orders" on orders;
drop policy if exists "admin update orders" on orders;

create policy "staff insert hero_content" on hero_content for insert with check (has_permission('hero_content','create'));
create policy "staff update hero_content" on hero_content for update using (has_permission('hero_content','update'));
create policy "staff delete hero_content" on hero_content for delete using (has_permission('hero_content','delete'));

create policy "staff insert leaders" on leaders for insert with check (has_permission('leaders','create'));
create policy "staff update leaders" on leaders for update using (has_permission('leaders','update'));
create policy "staff delete leaders" on leaders for delete using (has_permission('leaders','delete'));

create policy "staff insert verticals" on verticals for insert with check (has_permission('verticals','create'));
create policy "staff update verticals" on verticals for update using (has_permission('verticals','update'));
create policy "staff delete verticals" on verticals for delete using (has_permission('verticals','delete'));

create policy "staff insert gallery_items" on gallery_items for insert with check (has_permission('gallery_items','create'));
create policy "staff update gallery_items" on gallery_items for update using (has_permission('gallery_items','update'));
create policy "staff delete gallery_items" on gallery_items for delete using (has_permission('gallery_items','delete'));

create policy "staff insert products" on products for insert with check (has_permission('products','create'));
create policy "staff update products" on products for update using (has_permission('products','update'));
create policy "staff delete products" on products for delete using (has_permission('products','delete'));

create policy "staff insert legal_pages" on legal_pages for insert with check (has_permission('legal_pages','create'));
create policy "staff update legal_pages" on legal_pages for update using (has_permission('legal_pages','update'));
create policy "staff delete legal_pages" on legal_pages for delete using (has_permission('legal_pages','delete'));

create policy "staff insert company_info" on company_info for insert with check (has_permission('company_info','create'));
create policy "staff update company_info" on company_info for update using (has_permission('company_info','update'));
create policy "staff delete company_info" on company_info for delete using (has_permission('company_info','delete'));

create policy "staff read orders" on orders for select using (has_permission('orders','read'));
create policy "staff update orders" on orders for update using (has_permission('orders','update'));

-- 6. FINANCE & COMPLIANCE — internal only, never publicly readable.
create table if not exists compliance_records (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'gst','udyam','trademark','employee_welfare','pollution_control',
    'local_body_license','invoicing','other'
  )),
  title text not null,
  reference_number text,
  issuing_authority text,
  issue_date date,
  expiry_date date,
  document_url text,
  notes text,
  reminder_days_before int not null default 30,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table compliance_records enable row level security;

drop policy if exists "staff read compliance" on compliance_records;
drop policy if exists "staff insert compliance" on compliance_records;
drop policy if exists "staff update compliance" on compliance_records;
drop policy if exists "staff delete compliance" on compliance_records;

create policy "staff read compliance" on compliance_records for select using (has_permission('compliance_records','read'));
create policy "staff insert compliance" on compliance_records for insert with check (has_permission('compliance_records','create'));
create policy "staff update compliance" on compliance_records for update using (has_permission('compliance_records','update'));
create policy "staff delete compliance" on compliance_records for delete using (has_permission('compliance_records','delete'));
