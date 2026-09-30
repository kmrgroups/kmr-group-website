-- =====================================================================
--  KMR website — CMS update (run once after add-premium-site.sql; safe to re-run)
--
--  • Customers' Operations Master data is confidential: the "Import from Operations Master" link is removed.
--    Products that were imported from it are deleted (or hidden, if an order already points to them) and the
--    link columns are dropped.
--  • Sample content that can be loaded and removed from Website CMS › Overview (sample = true).
--  • A separate "About section photo" instead of a second logo.
-- =====================================================================

-- ---------- no customer data on the website ----------
drop function if exists console.publish_ops_products(uuid, text[], text);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'ops_customer_id') then
    execute 'update public.products set is_active = false where ops_customer_id is not null and id in (select product_id from public.orders where product_id is not null)';
    execute 'delete from public.products where ops_customer_id is not null and id not in (select product_id from public.orders where product_id is not null)';
    execute 'alter table public.products drop column ops_customer_id, drop column if exists ops_code';
  end if;
end $$;

-- ---------- sample content flag ----------
alter table hero_slides   add column if not exists sample boolean not null default false;
alter table site_stats    add column if not exists sample boolean not null default false;
alter table verticals     add column if not exists sample boolean not null default false;
alter table products      add column if not exists sample boolean not null default false;
alter table job_openings  add column if not exists sample boolean not null default false;
alter table leaders       add column if not exists sample boolean not null default false;
alter table gallery_items add column if not exists sample boolean not null default false;

-- ---------- About section photo (the second logo slot is gone) ----------
alter table company_info add column if not exists about_image_url text;
update company_info set about_image_url = logo_full_url where about_image_url is null and logo_full_url is not null;
