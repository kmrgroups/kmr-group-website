-- =====================================================================
--  KMR website — customer-first home page content (run once after add-cms-update.sql; safe to re-run)
--  Everything here is edited in KMR Console › Website CMS › Home page:
--   • Who we serve      (home_points, section 'audience')
--   • Why choose KMR    (home_points, section 'why')
--   • How it works      (home_points, section 'process')
--   • Product benefits  (product_benefits: productivity, quality, cost, delivery per product)
--  Starter content is added only when a list is empty. It avoids numbers we cannot prove — edit freely.
-- =====================================================================

create table if not exists home_points (
  id          uuid primary key default gen_random_uuid(),
  section     text not null check (section in ('audience','why','process')),
  title       text not null,
  text        text,
  icon        text,                    -- bag, code, cap, globe, truck, shield, lock, users, clock, chart, briefcase, file, check
  link        text,
  link_label  text,
  sort_order  int not null default 10,
  is_active   boolean not null default true,
  sample      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists home_points_section on home_points (section, sort_order);

create table if not exists product_benefits (
  id           uuid primary key default gen_random_uuid(),
  product      text not null,          -- "KMR HRM", "Online shop" …
  tagline      text,
  link         text,
  productivity text,
  quality      text,
  cost         text,
  delivery     text,
  sort_order   int not null default 10,
  is_active    boolean not null default true,
  sample       boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table home_points enable row level security;
alter table product_benefits enable row level security;
drop policy if exists "public reads shown points" on home_points;
create policy "public reads shown points" on home_points for select using (is_active);
drop policy if exists "public reads shown benefits" on product_benefits;
create policy "public reads shown benefits" on product_benefits for select using (is_active);
grant select on home_points, product_benefits to anon, authenticated;

-- ---------- starter content ----------
insert into home_points (section, title, text, icon, link, link_label, sort_order)
select * from (values
  ('audience', 'Manufacturers & MSMEs', 'Software for HR, inspection, APQP / PPAP and capacity planning, plus tools, consumables and team training.', 'code', '/software', 'Software for your plant', 1),
  ('audience', 'Traders & retailers', 'Dependable supply of materials and finished goods, priced clearly and billed with GST.', 'truck', '/trade#trading', 'Request a quote', 2),
  ('audience', 'Importers & exporters', 'Sourcing and export with documentation handled end to end — tell us the product, quantity and terms.', 'globe', '/trade#import_export', 'Start an enquiry', 3),
  ('audience', 'Engineers & students', 'Practical training in quality systems and core tools, taught by people who have run shop floors.', 'cap', '/training', 'View programmes', 4),
  ('audience', 'Everyday buyers', 'Order online and pay securely by UPI, card, net banking or bank transfer — straight to our company account.', 'bag', '/shop', 'Visit the shop', 5),

  ('why', 'Shop-floor experience', 'Our products are built and chosen by people with years in automotive manufacturing, quality and planning.', 'briefcase', null, null, 1),
  ('why', 'Clear, fair pricing', 'Prices shown up front, GST invoices with every order, no hidden charges.', 'chart', null, null, 2),
  ('why', 'Secure payments', 'You pay only into our registered company bank account — online (UPI, cards, net banking) or by bank transfer.', 'lock', null, null, 3),
  ('why', 'On-time delivery', 'We confirm lead times before you order and keep you updated until it reaches you.', 'truck', null, null, 4),
  ('why', 'Registered & compliant', 'GST-registered, Udyam-registered MSME, with published policies for returns, shipping and grievances.', 'shield', '/policies', 'Our policies', 5),
  ('why', 'People who answer', 'A real reply within one working day — by phone, WhatsApp or email.', 'users', '/contact', 'Talk to us', 6),

  ('process', 'Tell us what you need', 'Browse the shop, pick a software plan or send an enquiry with your requirement.', 'file', null, null, 1),
  ('process', 'Get a clear quote', 'Price, lead time and terms in writing — usually within one working day.', 'check', null, null, 2),
  ('process', 'Order & pay securely', 'Pay online or by bank transfer to our company account. You get a GST invoice.', 'lock', null, null, 3),
  ('process', 'Delivery & support', 'We deliver, set up or train — and stay with you after the sale.', 'truck', null, null, 4)
) v(section, title, text, icon, link, link_label, sort_order)
where not exists (select 1 from home_points);

insert into product_benefits (product, tagline, link, productivity, quality, cost, delivery, sort_order)
select * from (values
  ('KMR HRM', 'Attendance, leave and payroll-ready registers', '/software',
   'Attendance, leave and registers compiled automatically — no manual spreadsheets at month end.',
   'Complete, audit-ready HR records for IATF 16949 / ISO 9001.',
   'Pay per employee per month; no servers to buy or maintain.',
   'Go live quickly with your employee list imported for you.', 1),
  ('Balloon Inspector', 'Ballooned drawings and inspection reports', '/software',
   'Balloon a drawing and produce the inspection report in one place instead of by hand.',
   'Every characteristic numbered and traced to the report — fewer missed dimensions.',
   'Less engineering time per drawing and per PPAP submission.',
   'Faster first-article and PPAP turnaround to your customer.', 2),
  ('Process Documents', 'APQP / PPAP documents from the ballooned drawing', '/software',
   'Process flow, PFMEA and control plan built from the same data — no re-typing.',
   'Consistent, linked documents that stay in step when the drawing changes.',
   'Fewer hours of document preparation per new part.',
   'New-part documentation ready sooner for customer approval.', 3),
  ('Capacity Planner', 'Monthly plan and machine loading', '/software',
   'See machine loading and bottlenecks before the month starts.',
   'Plans based on real cycle times, shifts and holidays.',
   'Avoid last-minute overtime and outsourcing by planning ahead.',
   'Commit delivery dates you can keep.', 4),
  ('Online shop', 'Tools, safety and industrial supplies', '/shop',
   'Order in minutes, any time — no calls or follow-ups needed.',
   'Genuine products with a GST invoice for every order.',
   'Clear prices with offers shown up front.',
   'Dispatched as soon as your payment is confirmed.', 5),
  ('Training & development', 'Quality systems and core tools', '/training',
   'Teams apply APQP, PPAP, FMEA, SPC and MSA on their own parts.',
   'Fewer audit findings and customer complaints through better practice.',
   'In-house training at your plant — no travel for the team.',
   'Programmes scheduled on dates that suit your production.', 6)
) v(product, tagline, link, productivity, quality, cost, delivery, sort_order)
where not exists (select 1 from product_benefits);

-- the starter hero slides now speak to the customer (only if they still have the original starter text)
update hero_slides set eyebrow = 'Products · Software · Training · Trade',
       title = 'Everything your business needs, from one trusted partner',
       subtitle = 'Industrial supplies, software for manufacturers, practical training and import–export — with clear prices, GST invoices and secure payment.',
       cta_label = 'Explore products', cta_link = '/shop', cta2_label = 'Get a quote', cta2_link = '/contact'
 where title = 'One Vision. Multiple Solutions. Global Impact.' and not sample;
update hero_slides set eyebrow = 'For manufacturers', title = 'Run your plant with KMR Apps',
       subtitle = 'HRM, Balloon Inspector, Process Documents and Capacity Planner — one login, built by manufacturing people. Start with a free pilot.',
       cta_label = 'See the software', cta2_label = 'Book a free demo', cta2_link = '/software#demo'
 where title = 'Run your plant on KMR Apps' and not sample;
update hero_slides set eyebrow = 'Training & development', title = 'Train your team on real shop-floor problems',
       subtitle = 'Quality systems and core tools — at your plant or online, on dates that suit your production.',
       cta_label = 'View programmes', cta_link = '/training', cta2_label = 'Plan a programme', cta2_link = '/training'
 where title = 'Skills that move the shop floor' and not sample;
