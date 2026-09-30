-- =====================================================================
--  KMR Group website — premium corporate site (run once; safe to re-run)
--  Run after add-multi-business.sql and the KMR Console platform setup.
--
--  • Company profile: founder photo / message / signature, story, values, hours, map
--  • Home page: hero slides and highlight numbers
--  • Software solutions as products (business 'software'), policies you can add / hide / reorder
--  • Careers: job openings and applications (résumés in a private bucket)
--  • Hide / show on every section, site settings (online payment on / off)
--  • Online payment (Razorpay) confirmed only by the server after checking with Razorpay;
--    bank transfer / UPI stays, paid into the account in KMR Console › Seller details
--  Everything is edited in KMR Console › Website CMS.
-- =====================================================================

-- ---------- company profile ----------
alter table company_info
  add column if not exists founder_name          text,
  add column if not exists founder_title         text,
  add column if not exists founder_photo_url     text,
  add column if not exists founder_message       text,
  add column if not exists founder_signature_url text,
  add column if not exists about_story           text,
  add column if not exists core_values           text,      -- one value per line: "Integrity — we do what we say"
  add column if not exists business_hours        text,
  add column if not exists map_embed_url         text,
  add column if not exists careers_email         text,
  add column if not exists alt_phone             text;

-- ---------- hide / show and ordering everywhere ----------
alter table leaders       add column if not exists is_active boolean not null default true;
alter table gallery_items add column if not exists is_active boolean not null default true;
alter table legal_pages
  add column if not exists is_active      boolean not null default true,
  add column if not exists sort_order     int     not null default 0,
  add column if not exists show_in_footer boolean not null default true,
  add column if not exists summary        text;
alter table verticals add column if not exists image_url text;
-- any number of policies (the original five slugs were fixed)
alter table legal_pages drop constraint if exists legal_pages_slug_check;
alter table legal_pages add constraint legal_pages_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------- products: software solutions too ----------
alter table products drop constraint if exists products_business_check;
alter table products add constraint products_business_check
  check (business in ('shop','software','training','import_export','trading','distribution'));

-- ---------- home page ----------
create table if not exists hero_slides (
  id          uuid primary key default gen_random_uuid(),
  eyebrow     text,
  title       text not null,
  subtitle    text,
  image_url   text,
  cta_label   text,
  cta_link    text,
  cta2_label  text,
  cta2_link   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists site_stats (
  id          uuid primary key default gen_random_uuid(),
  value       text not null,          -- "18+", "500+", "6"
  label       text not null,          -- "Years of industry experience"
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- careers ----------
create table if not exists job_openings (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  department      text,
  location        text,
  employment_type text default 'Full-time',
  experience      text,
  salary_range    text,
  summary         text,
  description     text,
  requirements    text,
  posted_on       date not null default current_date,
  closes_on       date,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create table if not exists job_applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references job_openings(id) on delete set null,
  job_title       text not null,
  name            text not null,
  email           text not null,
  phone           text,
  location        text,
  experience      text,
  current_company text,
  linkedin_url    text,
  resume_path     text,                  -- in the private kmr-careers bucket
  cover_note      text,
  status          text not null default 'new' check (status in ('new','shortlisted','interview','offered','hired','rejected')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists job_applications_created on job_applications (created_at desc);

-- ---------- site settings (one row) ----------
create table if not exists site_settings (
  id                    boolean primary key default true check (id),
  online_payment        boolean not null default false,     -- Razorpay checkout on the order page
  bank_transfer         boolean not null default true,      -- bank / UPI details on the order page
  announcement          text,                                -- thin bar above the header; empty = hidden
  announcement_link     text,
  header_cta_label      text default 'Get a quote',
  header_cta_link       text default '/contact',
  updated_at            timestamptz not null default now()
);
insert into site_settings (id) values (true) on conflict do nothing;

-- ---------- security: the public sees only what is shown ----------
alter table hero_slides      enable row level security;
alter table site_stats       enable row level security;
alter table job_openings     enable row level security;
alter table job_applications enable row level security;   -- no public policy: server (service role) only
alter table site_settings    enable row level security;

drop policy if exists "public reads shown slides" on hero_slides;
create policy "public reads shown slides" on hero_slides for select using (is_active);
drop policy if exists "public reads shown stats" on site_stats;
create policy "public reads shown stats" on site_stats for select using (is_active);
drop policy if exists "public reads open jobs" on job_openings;
create policy "public reads open jobs" on job_openings for select using (is_active and (closes_on is null or closes_on >= current_date));
drop policy if exists "public reads settings" on site_settings;
create policy "public reads settings" on site_settings for select using (true);

-- hidden rows of the older tables are hidden from the public too
drop policy if exists "public read leaders" on leaders;
create policy "public read leaders" on leaders for select using (is_active or has_permission('leaders', 'read'));
drop policy if exists "public read gallery_items" on gallery_items;
create policy "public read gallery_items" on gallery_items for select using (is_active or has_permission('gallery_items', 'read'));
drop policy if exists "public read legal_pages" on legal_pages;
create policy "public read legal_pages" on legal_pages for select using (is_active or has_permission('legal_pages', 'read'));
drop policy if exists "public read verticals" on verticals;
create policy "public read verticals" on verticals for select using (coalesce(is_active, true) or has_permission('verticals', 'read'));
drop policy if exists "public read products" on products;
create policy "public read products" on products for select using (is_active or has_permission('products', 'read'));

grant select on hero_slides, site_stats, job_openings, site_settings to anon, authenticated;

-- private bucket for résumés
insert into storage.buckets (id, name, public, file_size_limit)
values ('kmr-careers', 'kmr-careers', false, 5242880) on conflict (id) do nothing;

-- ---------- online payment (Razorpay) ----------
alter table orders drop constraint if exists orders_pay_method_check;
alter table orders add constraint orders_pay_method_check
  check (pay_method is null or pay_method in ('neft','rtgs','imps','upi','cheque','other','razorpay'));

-- The server stores the Razorpay order it created for this shop order (server only)
create or replace function public.shop_gateway_attach(p_token text, p_gateway_order text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where order_token = p_token and length(p_token) >= 20 for update;
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('awaiting_payment','payment_reported') then raise exception 'This order is %, so it cannot be paid.', replace(o.status, '_', ' '); end if;
  update orders set razorpay_order_id = p_gateway_order, updated_at = now() where id = o.id;
  return jsonb_build_object('order_no', o.order_no, 'amount', o.amount, 'name', o.customer_name, 'email', o.customer_email, 'phone', o.customer_phone);
end $$;

-- Called only by the server after it has checked the payment with Razorpay (signature + API): marks the order paid.
-- Idempotent — the browser callback and the webhook may both arrive.
create or replace function public.shop_gateway_paid(p_gateway_order text, p_payment text, p_amount_paise bigint) returns text
language plpgsql security definer set search_path = public as $$
declare o orders; pr products;
begin
  select * into o from orders where razorpay_order_id = p_gateway_order for update;
  if o.id is null then raise exception 'Order not found for %.', p_gateway_order; end if;
  if o.status = 'paid' then return 'already paid'; end if;
  if o.status not in ('awaiting_payment','payment_reported','created') then raise exception 'This order is %.', replace(o.status, '_', ' '); end if;
  if p_amount_paise <> round(o.amount * 100) then raise exception 'Paid amount % does not match the order amount %.', p_amount_paise / 100.0, o.amount; end if;
  update orders set status = 'paid', pay_method = 'razorpay', pay_reference = p_payment, razorpay_payment_id = p_payment,
         paid_on = current_date, paid_amount = o.amount, confirmed_at = now(), confirmed_by = 'razorpay', reject_reason = null, updated_at = now()
   where id = o.id;
  select * into pr from products where id = o.product_id for update;
  if pr.id is not null and pr.kind = 'goods' then update products set stock_quantity = greatest(0, stock_quantity - o.quantity) where id = pr.id; end if;
  return 'paid';
end $$;

revoke all on function public.shop_gateway_attach(text, text), public.shop_gateway_paid(text, text, bigint) from public, anon, authenticated;
grant execute on function public.shop_gateway_attach(text, text), public.shop_gateway_paid(text, text, bigint) to service_role;

-- the order page also shows how it was paid
create or replace function public.shop_order_for_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('order_no', order_no, 'product_name', product_name, 'quantity', quantity, 'amount', amount, 'currency', currency,
           'customer_name', customer_name, 'customer_email', customer_email, 'customer_phone', customer_phone,
           'shipping_address', shipping_address, 'status', status, 'pay_method', pay_method, 'pay_reference', pay_reference,
           'paid_on', paid_on, 'paid_amount', paid_amount, 'reject_reason', reject_reason, 'created_at', created_at, 'confirmed_at', confirmed_at)
    from orders where order_token = p_token and length(p_token) >= 20
$$;
revoke all on function public.shop_order_for_token(text) from public, anon, authenticated;
grant execute on function public.shop_order_for_token(text) to service_role;

-- ---------- starter content (only when empty) ----------
insert into hero_slides (eyebrow, title, subtitle, cta_label, cta_link, cta2_label, cta2_link, sort_order)
select * from (values
  ('KMR Group of Companies', 'One Vision. Multiple Solutions. Global Impact.',
   'Manufacturing know-how, software, training and trade — one trusted group behind every business.', 'Explore our businesses', '/businesses', 'Contact us', '/contact', 1),
  ('Software & AI Solutions', 'Run your plant on KMR Apps',
   'HRM, Balloon Inspector, Process Documents and Capacity Planner — built by manufacturing people.', 'See the solutions', '/software', 'Request a demo', '/software#demo', 2),
  ('Training & Development', 'Skills that move the shop floor',
   'Quality, core tools and digital manufacturing programmes for teams and individuals.', 'View programmes', '/training', null, null, 3)
) v(eyebrow, title, subtitle, cta_label, cta_link, cta2_label, cta2_link, sort_order)
where not exists (select 1 from hero_slides);

insert into site_stats (value, label, sort_order)
select * from (values ('18+', 'Years of manufacturing & quality leadership', 1), ('6', 'Business verticals', 2),
                      ('4', 'Cloud apps for manufacturers', 3), ('Pan-India', 'Supply, service and support', 4)) v(value, label, sort_order)
where not exists (select 1 from site_stats);

update legal_pages set sort_order = case slug when 'terms' then 1 when 'privacy' then 2 when 'refund' then 3 when 'shipping' then 4 when 'grievance' then 5 else sort_order end
 where sort_order = 0;
