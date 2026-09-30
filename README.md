# KMR Group of Companies — Website

The public website of KMR Group (www.kmr-groups.com), built for several businesses under one brand:

| Section | Page | How customers act |
|---|---|---|
| Online shop | `/shop` | Buy now → pay by bank transfer / UPI |
| Software (KMR Apps) | `/software` | Plans & prices from the Console catalogue, free-trial request |
| Training & Education | `/training` | Enrol → pay by bank transfer / UPI, or enquire for a team |
| Import & Export, Trading, Distribution | `/trade` | Request a quote |

Plus the group pages (home, about, leadership, our businesses, gallery, contact) and the India-compliant legal
pages. Built with Next.js + Tailwind + Supabase; responsive and installable as a home-screen app (PWA).

**There is no admin panel on the website.** Every piece of content — products, courses, banner, businesses,
leadership, gallery, legal pages, company info, compliance records — and every shop order and enquiry is managed in
the **KMR Console → Website** (and **Operations** for customers, vendors, items, warehouses, stock and employees).

## 1. Supabase

Run once in the SQL Editor, in this order (each is safe to re-run):

1. `supabase/schema.sql` — tables, public-read security, legal pages, the `media` bucket
2. `add-orders-table.sql`, `add-logo-column.sql`, `add-permissions-and-compliance.sql`, `add-phase1-operations.sql`
3. `add-legal-identity.sql`
4. `add-bank-orders.sql` (after the Console's `0019_bank_payments.sql`)
5. `add-multi-business.sql` — businesses on products (shop / training / import-export / trading / distribution),
   enquiry-only items, links for the business cards, and lets Console staff manage the shop. Run it together with the
   Console's `0021_website.sql` (either order).

## 2. Configure and run

```bash
cp .env.local.example .env.local   # Supabase URL, anon key, SUPABASE_SERVICE_ROLE_KEY (server only)
npm install
npm run dev
```

## 3. Content and products (all in KMR Console)

- **Website → Products** — shop items, courses and trade items: business, name, photo, price, MRP, stock, unit,
  HSN/SAC, *enquiry only*, *featured*, *show on the website*.
- **Website → Publish from Operations Master** — pick parts from a company's Operations Master and they arrive in
  Website → Products (hidden, priced from the customer rate contract). Add a photo, check price and stock, then tick
  *Show on the website*. Publishing again refreshes the name and description only.
- **Website → Banner, Businesses, Leadership, Gallery, Legal pages, Company info, Compliance.**
- **Website → Shop orders** — confirm or reject reported bank / UPI payments; stock is reduced when an order is paid.
- **Enquiries** — every form on the website (software trial, training, quotes, bulk orders, contact) lands here,
  tagged with its business.

## 4. Shop payments (bank transfer / UPI — no payment gateway)

The bank account and UPI ID are the ones in **KMR Console → Prices & invoices → Seller details**. **Buy now** /
**Enrol** places the order (`KMR-SO-00001`, *awaiting payment*) and opens the order's own page: bank details, a UPI
QR with the amount and order number, and **I've paid** for the UTR. Staff confirm it in the Console.

## 5. Deploy

Push to GitHub, import into Vercel, add the environment variables from `.env.local`, then add the domain under
Vercel → Settings → Domains.

## 6. Before going live — legal checklist (India)

- Terms, Privacy, Refund & Cancellation, Shipping & Delivery and Grievance Redressal (a named Grievance Officer under
  the Consumer Protection (E-Commerce) Rules, 2020) — edit them in Console → Website → Legal pages.
- Company info is public — never enter Aadhaar, PAN or bank account numbers there (invoices take those from the
  Console).

## 7. Project structure

```
app/              Public pages (home, shop, software, training, trade, products/[id], order/[token], legal, …)
app/api/          create-order, report-payment (shop), enquiry (→ Console Enquiries)
components/       Navbar, Footer, ProductCard, BuyNowButton, EnquiryForm, SpecPlate, …
lib/              supabaseClient (browser), supabaseAdmin (server only), types
supabase/         SQL migrations listed in step 1
public/it/        KMR Apps (HRM, Balloon Inspector, Process Documents, Capacity Planner)
```
