-- ============================================================
-- KMR Group of Companies — Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- 1. COMPANY INFO (single row: legal + contact + social details)
create table if not exists company_info (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null default 'KMR Group of Companies',
  brand_name text not null default 'KMR Group',
  founded_year int,
  gstin text,
  cin text,
  registered_address text,
  email text,
  phone text,
  map_lat double precision,
  map_lng double precision,
  facebook_url text,
  instagram_url text,
  linkedin_url text,
  youtube_url text,
  twitter_url text,
  whatsapp_number text,
  updated_at timestamptz default now()
);

-- 2. HERO BANNER (single row, editable from admin)
create table if not exists hero_content (
  id uuid primary key default gen_random_uuid(),
  headline text not null default 'Engineering Growth Across Industries',
  subheadline text not null default '',
  banner_image_url text,
  cta_label text default 'Explore Our Verticals',
  cta_link text default '/verticals',
  updated_at timestamptz default now()
);

-- 3. LEADERSHIP TEAM
create table if not exists leaders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text not null,
  bio text,
  photo_url text,
  linkedin_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 4. BUSINESS VERTICALS
create table if not exists verticals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text,
  description text,
  icon_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 5. GALLERY (photos + promo videos)
create table if not exists gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text,
  media_type text check (media_type in ('photo','video')) not null default 'photo',
  media_url text not null,
  thumbnail_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 6. PRODUCTS (marketplace-style catalog)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text,
  description text,
  price numeric(12,2) not null default 0,
  mrp numeric(12,2),
  stock_quantity int not null default 0,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 7. LEGAL PAGES (India e-commerce / consumer-protection compliance)
create table if not exists legal_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('terms','privacy','refund','shipping','grievance')),
  title text not null,
  content text not null default '',
  updated_at timestamptz default now()
);

-- Seed the 5 required legal page rows so the admin panel always has
-- something to edit, and the public pages never 404.
insert into legal_pages (slug, title, content) values
  ('terms', 'Terms & Conditions', 'Add your Terms & Conditions here from the admin panel.'),
  ('privacy', 'Privacy Policy', 'Add your Privacy Policy here from the admin panel.'),
  ('refund', 'Refund & Cancellation Policy', 'Add your Refund & Cancellation Policy here from the admin panel.'),
  ('shipping', 'Shipping & Delivery Policy', 'Add your Shipping & Delivery Policy here from the admin panel.'),
  ('grievance', 'Grievance Redressal', 'Add your Grievance Officer name, designation, email, phone and address here (required under the Consumer Protection (E-Commerce) Rules, 2020).')
on conflict (slug) do nothing;

insert into hero_content (headline, subheadline)
select 'Engineering Growth Across Industries', 'KMR Group of Companies — manufacturing, trading and technology ventures built on precision and trust.'
where not exists (select 1 from hero_content);

insert into company_info (legal_name, brand_name)
select 'KMR Group of Companies', 'KMR Group'
where not exists (select 1 from company_info);

-- 8. ORDERS (created when a customer checks out via Razorpay)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text unique not null,
  razorpay_payment_id text,
  product_id uuid references products(id),
  product_name text not null,
  quantity int not null default 1,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  shipping_address text not null,
  status text not null default 'created' check (status in ('created','paid','failed')),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public (anonymous) visitors can only READ.
-- Only authenticated admin users (created in Supabase Auth) can
-- insert / update / delete.
-- ============================================================
alter table company_info enable row level security;
alter table hero_content enable row level security;
alter table leaders enable row level security;
alter table verticals enable row level security;
alter table gallery_items enable row level security;
alter table products enable row level security;
alter table legal_pages enable row level security;
alter table orders enable row level security;

-- Public read policies
create policy "public read company_info" on company_info for select using (true);
create policy "public read hero_content" on hero_content for select using (true);
create policy "public read leaders" on leaders for select using (true);
create policy "public read verticals" on verticals for select using (true);
create policy "public read gallery_items" on gallery_items for select using (true);
create policy "public read products" on products for select using (true);
create policy "public read legal_pages" on legal_pages for select using (true);

-- Authenticated write policies (admin login uses Supabase Auth)
create policy "admin write company_info" on company_info for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write hero_content" on hero_content for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write leaders" on leaders for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write verticals" on verticals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write gallery_items" on gallery_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write products" on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write legal_pages" on legal_pages for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Orders: only admin can read/manage from the dashboard. Inserts/updates
-- happen from the server-side API routes using the service_role key,
-- which bypasses RLS entirely (that's expected and safe — it never
-- touches the browser).
create policy "admin read orders" on orders for select using (auth.role() = 'authenticated');
create policy "admin update orders" on orders for update using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKET for images/videos (banner, leadership, gallery, products)
-- Create manually if this insert fails on your plan:
-- Dashboard -> Storage -> New bucket -> name "media" -> Public bucket = ON
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public read media" on storage.objects for select using (bucket_id = 'media');
create policy "admin upload media" on storage.objects for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "admin update media" on storage.objects for update using (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "admin delete media" on storage.objects for delete using (bucket_id = 'media' and auth.role() = 'authenticated');
