-- ============================================================
-- KMR website — one site for several businesses. Run once in Supabase → SQL Editor after add-bank-orders.sql,
-- together with the KMR Console's 0021_website.sql (either order). Safe to run more than once.
--  • Products belong to a business: shop (goods, bought online), training (courses), import_export / trading /
--    distribution (enquiry / request for quote). Software (KMR Apps) comes from the KMR Console's products and prices.
--  • Everything is managed in KMR Console → Website; the website's own /admin is retired.
-- ============================================================
alter table products
  add column if not exists business        text not null default 'shop',
  add column if not exists kind            text not null default 'goods',
  add column if not exists featured        boolean not null default false,
  add column if not exists sort_order      int not null default 100,
  add column if not exists unit            text,
  add column if not exists hsn_code        text,
  add column if not exists enquiry_only    boolean not null default false,
  add column if not exists details         jsonb not null default '{}',
  add column if not exists updated_at      timestamptz default now();
alter table products drop constraint if exists products_business_check;
alter table products add constraint products_business_check check (business in ('shop','training','import_export','trading','distribution'));
alter table products drop constraint if exists products_kind_check;
alter table products add constraint products_kind_check check (kind in ('goods','course','service'));
create index if not exists products_business on products (business, is_active, sort_order);

alter table verticals
  add column if not exists slug      text,
  add column if not exists link      text,      -- where the card goes: /shop, /software, /training, /trade#import_export …
  add column if not exists is_active boolean not null default true;

-- The six businesses of KMR Group (only when no verticals exist yet)
insert into verticals (title, code, slug, link, description, sort_order)
select * from (values
  ('E-Commerce & Distribution', 'SHOP',     'shop',          '/shop',                  'Quality products delivered across India — order online and pay by bank transfer or UPI.', 1),
  ('Software & AI Solutions',   'SOFTWARE', 'software',      '/software',              'KMR Apps for manufacturers: HRM, Balloon Inspector, Process Documents and Capacity Planner.', 2),
  ('Training & Education',      'TRAINING', 'training',      '/training',              'Practical courses on quality, core tools and digital manufacturing.', 3),
  ('Import & Export',           'EXIM',     'import_export', '/trade#import_export',   'Sourcing and export of industrial and consumer goods — request a quote.', 4),
  ('Trading & Retail',          'TRADING',  'trading',       '/trade#trading',         'Wholesale and retail trading with reliable supply — request a quote.', 5),
  ('Investment & Trading',      'INVEST',   'investment',    '/contact',               'Group investments and strategic partnerships.', 6)
) v(title, code, slug, link, description, sort_order)
where not exists (select 1 from verticals);

-- Who may manage shop orders: website staff (old admin) or KMR Console owners / administrators / sales
create or replace function public.shop_can_manage() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if to_regprocedure('console.staff_role()') is not null then
    if (select console.staff_role()) in ('owner','admin','sales') then return true; end if;
  end if;
  return coalesce(has_permission('orders', 'update'), false);
end $$;

-- Orders: courses have no stock; enquiry-only products cannot be bought online
create or replace function public.shop_place_order(p_product uuid, p_qty int, p_name text, p_email text, p_phone text, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr products; q int := greatest(1, coalesce(p_qty, 1)); tok text := encode(gen_random_bytes(18), 'hex'); no text;
begin
  select * into pr from products where id = p_product;
  if pr.id is null or not pr.is_active then raise exception 'This product is not currently available.'; end if;
  if pr.enquiry_only or pr.business not in ('shop','training') or pr.price <= 0 then raise exception 'Please send an enquiry for this item — it cannot be ordered online.'; end if;
  if q > 1000 then raise exception 'For large quantities, please send an enquiry.'; end if;
  if pr.kind = 'goods' and pr.stock_quantity < q then raise exception 'Only % in stock.', pr.stock_quantity; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_phone, ''))) < 8 or length(trim(coalesce(p_address, ''))) < 10 then
    raise exception 'Please fill in your name, phone number and full address.';
  end if;
  no := 'KMR-SO-' || lpad(nextval('shop_order_no')::text, 5, '0');
  insert into orders (order_no, order_token, product_id, product_name, quantity, amount, currency, customer_name, customer_email, customer_phone, shipping_address, status)
  values (no, tok, pr.id, pr.name, q, round(pr.price * q, 2), 'INR', left(trim(p_name), 120), nullif(left(trim(coalesce(p_email, '')), 160), ''),
          left(trim(p_phone), 20), left(trim(p_address), 600), 'awaiting_payment');
  return jsonb_build_object('order_no', no, 'token', tok);
end $$;

create or replace function public.shop_confirm_payment(p_order uuid, p_method text default null, p_reference text default null, p_paid_on date default null) returns text
language plpgsql security definer set search_path = public as $$
declare o orders; pr products; me text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not shop_can_manage() then raise exception 'You do not have permission to update orders.'; end if;
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('awaiting_payment','payment_reported') then raise exception 'This order is already %.', replace(o.status, '_', ' '); end if;
  if o.status = 'awaiting_payment' and length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'Enter the payment reference (UTR, cheque no. …).'; end if;
  update orders set status = 'paid', confirmed_at = now(), confirmed_by = me, updated_at = now(),
         pay_method = coalesce(nullif(p_method, ''), pay_method, 'neft'), pay_reference = coalesce(nullif(upper(trim(p_reference)), ''), pay_reference),
         paid_on = coalesce(p_paid_on, paid_on, current_date), paid_amount = coalesce(paid_amount, amount)
   where id = o.id;
  select * into pr from products where id = o.product_id for update;
  if pr.id is not null and pr.kind = 'goods' then update products set stock_quantity = greatest(0, stock_quantity - o.quantity) where id = pr.id; end if;
  return case when pr.id is not null and pr.kind = 'goods' and pr.stock_quantity < o.quantity then 'paid — note: stock was lower than the order quantity' else 'paid' end;
end $$;

create or replace function public.shop_reject_payment(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not shop_can_manage() then raise exception 'You do not have permission to update orders.'; end if;
  if (select status from orders where id = p_order) is distinct from 'payment_reported' then raise exception 'Only a reported payment can be rejected.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason — the customer sees it on their order page.'; end if;
  update orders set status = 'awaiting_payment', reject_reason = trim(p_reason), updated_at = now() where id = p_order;
end $$;

create or replace function public.shop_cancel_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not shop_can_manage() then raise exception 'You do not have permission to update orders.'; end if;
  if (select status from orders where id = p_order) not in ('created','awaiting_payment','payment_reported') then raise exception 'Only an unpaid order can be cancelled.'; end if;
  update orders set status = 'cancelled', admin_note = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = p_order;
end $$;

revoke all on function public.shop_can_manage() from public, anon;
grant execute on function public.shop_can_manage() to authenticated;
revoke all on function public.shop_place_order(uuid, int, text, text, text, text) from public, anon, authenticated;
grant execute on function public.shop_place_order(uuid, int, text, text, text, text) to service_role;
