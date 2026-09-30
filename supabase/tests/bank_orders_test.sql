-- Tests for add-bank-orders.sql (shop orders paid by bank / UPI). Run inside a transaction that is rolled back.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', 'x@kmr.test')::text, false); end $$;
create or replace function pg_temp.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', what; end if; raise warning 'PASS: %', what; end $$;
create or replace function pg_temp.fails(q text, what text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise warning 'PASS: % (%)', what, sqlerrm; return; end; raise exception 'FAIL: % — it was allowed', what; end $$;

insert into products (id, name, price, stock_quantity, is_active) values ('00000000-0000-0000-0000-0000000000d1', 'Test Gauge Set', 1250.50, 5, true), ('00000000-0000-0000-0000-0000000000d2', 'Old Item', 99, 5, false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'stores@kmr.test'), ('00000000-0000-0000-0000-0000000000e2', 'viewer@kmr.test') on conflict do nothing;
insert into staff_profiles (id, full_name, department, is_admin) values ('00000000-0000-0000-0000-0000000000e1', 'Stores', 'stores', false), ('00000000-0000-0000-0000-0000000000e2', 'Viewer', 'sales', false);
insert into staff_permissions (staff_id, resource, can_read, can_update) values ('00000000-0000-0000-0000-0000000000e1', 'orders', true, true), ('00000000-0000-0000-0000-0000000000e2', 'orders', true, false);
create temp table t_o (k text primary key, token text, id uuid); grant all on t_o to authenticated, service_role;

set role service_role;
select pg_temp.fails($$select shop_place_order('00000000-0000-0000-0000-0000000000d2', 1, 'Ravi Kumar', '', '9876543210', 'No 5, Gandhi Street, Chennai 600001')$$, 'inactive product refused');
select pg_temp.fails($$select shop_place_order('00000000-0000-0000-0000-0000000000d1', 9, 'Ravi Kumar', '', '9876543210', 'No 5, Gandhi Street, Chennai 600001')$$, 'more than in stock refused');
select pg_temp.fails($$select shop_place_order('00000000-0000-0000-0000-0000000000d1', 1, 'R', '', '98', 'x')$$, 'incomplete details refused');
insert into t_o select 'a', r ->> 'token', null from (select shop_place_order('00000000-0000-0000-0000-0000000000d1', 2, 'Ravi Kumar', 'ravi@x.test', '9876543210', 'No 5, Gandhi Street, Chennai 600001') r) x;
insert into t_o select 'b', r ->> 'token', null from (select shop_place_order('00000000-0000-0000-0000-0000000000d1', 1, 'Anu', '', '9876500000', 'Flat 2, Lake View, Madurai 625001') r) x;
update t_o set id = o.id from orders o where o.order_token = t_o.token;
select pg_temp.ok((select amount = 2501.00 and status = 'awaiting_payment' and order_no ~ '^KMR-SO-\d{5}$' from orders where id = (select id from t_o where k = 'a')), 'order placed: 2 × 1,250.50 = 2,501.00, awaiting payment, numbered');
select pg_temp.ok((select stock_quantity = 5 from products where id = '00000000-0000-0000-0000-0000000000d1'), 'stock not reduced before payment');
select pg_temp.ok((shop_order_for_token((select token from t_o where k = 'a')) ->> 'status') = 'awaiting_payment' and shop_order_for_token('short') is null, 'order page reads by token only');
select pg_temp.ok((select shop_payee() ? 'account_no'), 'payee details come from the Console seller details');
select pg_temp.fails($$select shop_report_payment((select token from t_o where k = 'a'), 'neft', 'AB', current_date, 2501)$$, 'short UTR refused');
select pg_temp.ok(shop_report_payment((select token from t_o where k = 'a'), 'imps', 'wrong123', current_date, 2501) = 'ok', 'customer reports a payment');
reset role;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.fails($$select shop_confirm_payment((select id from t_o where k = 'a'))$$, 'staff without update permission cannot confirm');
select pg_temp.fails($$select shop_place_order('00000000-0000-0000-0000-0000000000d1', 1, 'Ravi Kumar', '', '9876543210', 'No 5, Gandhi Street, Chennai')$$, 'browser users cannot call shop_place_order directly');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select shop_reject_payment((select id from t_o where k = 'a'), 'Not received in our bank');
select pg_temp.ok((select status = 'awaiting_payment' and reject_reason = 'Not received in our bank' from orders where id = (select id from t_o where k = 'a')), 'rejected → back to awaiting payment with the reason');
reset role; set role service_role;
select shop_report_payment((select token from t_o where k = 'a'), 'upi', '627312345678', current_date, 2501);
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(shop_confirm_payment((select id from t_o where k = 'a')) = 'paid', 'confirmed');
select pg_temp.ok((select status = 'paid' and pay_reference = '627312345678' and reject_reason is null from orders where id = (select id from t_o where k = 'a')), 'order paid with the UTR');
select pg_temp.ok((select stock_quantity = 3 from products where id = '00000000-0000-0000-0000-0000000000d1'), 'stock reduced by 2 on payment');
select pg_temp.fails($$select shop_confirm_payment((select id from t_o where k = 'a'))$$, 'cannot confirm twice');
select pg_temp.fails($$select shop_confirm_payment((select id from t_o where k = 'b'))$$, 'marking paid without a report needs a reference');
select pg_temp.ok(shop_confirm_payment((select id from t_o where k = 'b'), 'cheque', 'CHQ 000123', current_date) = 'paid', 'marked paid directly (cheque)');
select pg_temp.fails($$select shop_cancel_order((select id from t_o where k = 'b'), 'x')$$, 'a paid order cannot be cancelled');
reset role; set role service_role;
select pg_temp.fails($$select shop_report_payment((select token from t_o where k = 'a'), 'neft', 'NEWREF1234', current_date, 10)$$, 'nothing can be reported on a paid order');
reset role;
select pg_temp.ok((select razorpay_order_id is null from orders where id = (select id from t_o where k = 'a')), 'no Razorpay order involved');
