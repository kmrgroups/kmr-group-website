-- ============================================================
-- KMR website shop — orders paid by bank transfer / UPI to KMR's account (replaces Razorpay).
-- Run once in Supabase → SQL Editor, after add-permissions-and-compliance.sql and the KMR Console's
-- 0019_bank_payments.sql (the shop shows the bank account and UPI ID from Console → Prices & invoices →
-- Seller details, so there is one place to change them). Safe to run more than once.
--
-- Flow: Buy Now → order "awaiting_payment" with its own order page (bank details + UPI QR) →
--       customer reports the UTR → "payment_reported" → staff Confirm (→ "paid", stock reduced) or Reject.
-- ============================================================
create extension if not exists pgcrypto;
create sequence if not exists shop_order_no;

alter table orders alter column razorpay_order_id drop not null;   -- kept only for old Razorpay orders
alter table orders
  add column if not exists order_no        text unique,
  add column if not exists order_token     text unique,
  add column if not exists pay_method      text check (pay_method is null or pay_method in ('neft','rtgs','imps','upi','cheque','other')),
  add column if not exists pay_reference   text,
  add column if not exists paid_on         date,
  add column if not exists paid_amount     numeric(12,2),
  add column if not exists payer_name      text,
  add column if not exists reported_at     timestamptz,
  add column if not exists confirmed_at    timestamptz,
  add column if not exists confirmed_by    text,
  add column if not exists reject_reason   text,
  add column if not exists admin_note      text,
  add column if not exists updated_at      timestamptz default now();
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('created','awaiting_payment','payment_reported','paid','cancelled','failed'));

-- Where customers pay: the seller's bank account / UPI from the KMR Console (server only)
create or replace function public.shop_payee() returns jsonb
language sql stable security definer set search_path = public, console as $$
  select jsonb_build_object('name', coalesce(s.trade_name, s.legal_name), 'account_name', s.bank_account_name, 'account_no', s.bank_account_no,
           'ifsc', s.bank_ifsc, 'bank', s.bank_name, 'branch', s.bank_branch, 'account_type', s.bank_account_type, 'upi_id', s.upi_id,
           'notes', s.bank_details)
    from console.billing_settings s where s.id
$$;

-- New order (server only): price and stock always from the database
create or replace function public.shop_place_order(p_product uuid, p_qty int, p_name text, p_email text, p_phone text, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr products; q int := greatest(1, coalesce(p_qty, 1)); tok text := replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 4); no text;
begin
  select * into pr from products where id = p_product;
  if pr.id is null or not pr.is_active then raise exception 'This product is not currently available.'; end if;
  if q > 1000 then raise exception 'For large quantities, please contact us.'; end if;
  if pr.stock_quantity < q then raise exception 'Only % in stock.', pr.stock_quantity; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_phone, ''))) < 8 or length(trim(coalesce(p_address, ''))) < 10 then
    raise exception 'Please fill in your name, phone number and full shipping address.';
  end if;
  no := 'KMR-SO-' || lpad(nextval('shop_order_no')::text, 5, '0');
  insert into orders (order_no, order_token, product_id, product_name, quantity, amount, currency, customer_name, customer_email, customer_phone, shipping_address, status)
  values (no, tok, pr.id, pr.name, q, round(pr.price * q, 2), 'INR', left(trim(p_name), 120), nullif(left(trim(coalesce(p_email, '')), 160), ''),
          left(trim(p_phone), 20), left(trim(p_address), 600), 'awaiting_payment');
  return jsonb_build_object('order_no', no, 'token', tok);
end $$;

-- The customer reports their payment on the order page (server only)
create or replace function public.shop_report_payment(p_token text, p_method text, p_reference text, p_paid_on date, p_amount numeric, p_payer text default null) returns text
language plpgsql security definer set search_path = public as $$
declare o orders; ref text := upper(regexp_replace(trim(coalesce(p_reference, '')), '\s+', ' ', 'g'));
begin
  select * into o from orders where order_token = p_token and length(p_token) >= 20;
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('awaiting_payment','payment_reported') then raise exception 'This order is %, so no payment can be reported.', replace(o.status, '_', ' '); end if;
  if coalesce(p_method, '') not in ('neft','rtgs','imps','upi','cheque','other') then raise exception 'Choose how you paid.'; end if;
  if length(ref) not between 4 and 60 then raise exception 'Enter the UTR / transaction reference from your bank (4 to 60 characters).'; end if;
  if p_paid_on is null or p_paid_on > current_date + 1 or p_paid_on < current_date - 90 then raise exception 'Enter the date you paid.'; end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > o.amount * 2 then raise exception 'Enter the amount you paid.'; end if;
  update orders set status = 'payment_reported', pay_method = p_method, pay_reference = ref, paid_on = p_paid_on, paid_amount = round(p_amount, 2),
         payer_name = nullif(left(trim(coalesce(p_payer, '')), 120), ''), reported_at = now(), reject_reason = null, updated_at = now()
   where id = o.id;
  return 'ok';
end $$;

-- Staff with "orders: update" permission: confirm (money is in the bank), reject, mark paid directly, cancel
create or replace function public.shop_confirm_payment(p_order uuid, p_method text default null, p_reference text default null, p_paid_on date default null) returns text
language plpgsql security definer set search_path = public as $$
declare o orders; pr products; me text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not has_permission('orders', 'update') then raise exception 'You do not have permission to update orders.'; end if;
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('awaiting_payment','payment_reported') then raise exception 'This order is already %.', replace(o.status, '_', ' '); end if;
  if o.status = 'awaiting_payment' and length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'Enter the payment reference (UTR, cheque no. …).'; end if;
  update orders set status = 'paid', confirmed_at = now(), confirmed_by = me, updated_at = now(),
         pay_method = coalesce(nullif(p_method, ''), pay_method, 'neft'), pay_reference = coalesce(nullif(upper(trim(p_reference)), ''), pay_reference),
         paid_on = coalesce(p_paid_on, paid_on, current_date), paid_amount = coalesce(paid_amount, amount)
   where id = o.id;
  select * into pr from products where id = o.product_id for update;
  if pr.id is not null then update products set stock_quantity = greatest(0, stock_quantity - o.quantity) where id = pr.id; end if;
  return case when pr.id is not null and pr.stock_quantity < o.quantity then 'paid — note: stock was lower than the order quantity' else 'paid' end;
end $$;

create or replace function public.shop_reject_payment(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('orders', 'update') then raise exception 'You do not have permission to update orders.'; end if;
  if (select status from orders where id = p_order) is distinct from 'payment_reported' then raise exception 'Only a reported payment can be rejected.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason — the customer sees it on their order page.'; end if;
  update orders set status = 'awaiting_payment', reject_reason = trim(p_reason), updated_at = now() where id = p_order;
end $$;

create or replace function public.shop_cancel_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('orders', 'update') then raise exception 'You do not have permission to update orders.'; end if;
  if (select status from orders where id = p_order) not in ('created','awaiting_payment','payment_reported') then raise exception 'Only an unpaid order can be cancelled.'; end if;
  update orders set status = 'cancelled', admin_note = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now() where id = p_order;
end $$;

-- Customer order page (server only): the order and nothing else
create or replace function public.shop_order_for_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('order_no', order_no, 'product_name', product_name, 'quantity', quantity, 'amount', amount, 'currency', currency,
           'customer_name', customer_name, 'shipping_address', shipping_address, 'status', status, 'pay_method', pay_method, 'pay_reference', pay_reference,
           'paid_on', paid_on, 'paid_amount', paid_amount, 'reject_reason', reject_reason, 'created_at', created_at, 'confirmed_at', confirmed_at)
    from orders where order_token = p_token and length(p_token) >= 20
$$;

revoke all on function public.shop_payee(), public.shop_place_order(uuid, int, text, text, text, text),
  public.shop_report_payment(text, text, text, date, numeric, text), public.shop_order_for_token(text) from public, anon, authenticated;
grant execute on function public.shop_payee(), public.shop_place_order(uuid, int, text, text, text, text),
  public.shop_report_payment(text, text, text, date, numeric, text), public.shop_order_for_token(text) to service_role;
revoke all on function public.shop_confirm_payment(uuid, text, text, date), public.shop_reject_payment(uuid, text), public.shop_cancel_order(uuid, text) from public, anon;
grant execute on function public.shop_confirm_payment(uuid, text, text, date), public.shop_reject_payment(uuid, text), public.shop_cancel_order(uuid, text) to authenticated;
