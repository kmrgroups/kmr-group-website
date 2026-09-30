-- ============================================================
-- KMR website — legal identity & brand fields in Company Info (all editable in Admin → Company Info).
-- Safe to run more than once. Run in Supabase → SQL Editor.
-- ============================================================
alter table company_info
  add column if not exists trade_name       text,   -- name the business trades under (GST "Trade Name")
  add column if not exists constitution     text,   -- Proprietorship, Partnership, LLP, Pvt Ltd …
  add column if not exists proprietor_name  text,   -- proprietor / managing partner / director shown as signatory
  add column if not exists proprietor_title text,   -- Proprietor, Managing Director …
  add column if not exists udyam_number     text,   -- UDYAM-XX-00-0000000
  add column if not exists msme_category    text,   -- Micro / Small / Medium
  add column if not exists trademark_status text,   -- e.g. "TM application 1234567 (Class 35) — pending"
  add column if not exists website_url      text,
  add column if not exists city             text,
  add column if not exists state            text,
  add column if not exists postal_code      text,
  add column if not exists tagline          text,   -- INNOVATE • INTEGRATE • ELEVATE
  add column if not exists slogan           text,   -- ONE VISION. MULTIPLE SOLUTIONS. GLOBAL IMPACT.
  add column if not exists short_about      text,   -- the paragraph in the footer
  add column if not exists vision           text,
  add column if not exists mission          text,
  add column if not exists logo_full_url    text,   -- logo with the business verticals
  add column if not exists letterhead_url   text;   -- blank letterhead image / PDF for staff to download

-- Nothing here is secret: company_info is public on the website. Keep ID numbers (Aadhaar, PAN of the
-- proprietor, bank account) out of it — invoices take bank and PAN details from the KMR Console instead.
