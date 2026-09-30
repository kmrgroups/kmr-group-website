-- Fix: "function gen_random_bytes(integer) does not exist" when a customer clicks Continue to payment.
-- The order link is now made with gen_random_uuid(), which is built into every Postgres (no extension needed). Safe to re-run.
create or replace function public.shop_place_order(p_product uuid, p_qty int, p_name text, p_email text, p_phone text, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr products; q int := greatest(1, coalesce(p_qty, 1)); tok text := replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 4); no text;
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
revoke all on function public.shop_place_order(uuid, int, text, text, text, text) from public, anon, authenticated;
grant execute on function public.shop_place_order(uuid, int, text, text, text, text) to service_role;
