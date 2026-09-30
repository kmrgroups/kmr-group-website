# KMR Group of Companies — Website

The public corporate website of KMR Group (www.kmr-groups.com): corporate promotion, online shop, software
solutions, training & development, import / export / trading, careers, about us (founder's message, leadership,
registrations), contact, policies and gallery. Navy & gold design, responsive, installable as a home-screen app.

**There is no admin panel on the website.** Everything — logo, GSTIN, social links, founder photo and message, hero
slides, business verticals, products, programmes, solutions, job openings, applications, policies, gallery, orders
and payment settings — is managed in **KMR Console › Website CMS** (add, edit, hide / show, delete).

## 1. Supabase

Run once in the SQL Editor, in this order (each is safe to re-run):

1. `supabase/schema.sql`, then `add-orders-table.sql`, `add-logo-column.sql`, `add-permissions-and-compliance.sql`
2. `add-legal-identity.sql`
3. `add-bank-orders.sql` (after the Console's `0019_bank_payments.sql`)
4. `add-multi-business.sql` (with the Console's `0021_website.sql`)
5. `add-premium-site.sql` — founder, hero slides, highlight numbers, careers, any number of policies, hide / show
   everywhere, site settings and online payment (Razorpay)
6. Optional, **permanent**: `drop-operations.sql` removes the old website Operations tables (customers, vendors,
   items, warehouses, stock) — only those nothing else uses. `employees` is kept while the HR module (attendance,
   payroll, leave …) uses it. Export anything you still need first. Never re-run it with CASCADE.

## 2. Environment (`.env.local` and Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…          # server only
# Online payment (optional — without these, customers pay by bank transfer / UPI)
RAZORPAY_KEY_ID=rzp_live_…
RAZORPAY_KEY_SECRET=…
RAZORPAY_WEBHOOK_SECRET=…
```

```bash
npm install
npm run dev
```

## 3. Payments — money goes only to KMR's account

Every order page offers the ways to pay switched on in **Website CMS › Payment settings**:

- **Online (Razorpay)** — UPI, cards, net banking, wallets. The server creates the Razorpay order for the exact amount
  in the database, then checks the signature **and** fetches the payment from Razorpay (order, amount, status) before
  marking the order paid. The webhook `https://www.kmr-groups.com/api/pay/razorpay/webhook` (events
  *payment.captured*, *order.paid*) catches payments when the customer closes the page early. In the Razorpay
  dashboard, the **settlement bank account must be KMR's Federal Bank account** — the same one as in Seller details.
- **Bank transfer / UPI** — account details and a UPI QR (amount and order number filled in) from **KMR Console ›
  Prices & invoices › Seller details**. The customer reports the UTR; staff confirm it in Website CMS › Orders & payments.

Stock goes down only when an order is paid.

## 4. Deploy

Push to GitHub, import into Vercel, add the environment variables, then add the domain under Vercel › Domains.

## 5. Project structure

```
app/                 Home, about, businesses, shop, products/[id], order/[token], software, training, trade,
                     careers (+ [id]), contact, policies (+ [slug]), gallery, leadership
app/api/             create-order, report-payment, pay/razorpay (+ verify, webhook), pay/status,
                     enquiry (→ Console Enquiries), careers/apply (→ Website CMS › Applications)
components/          Header, NavBar, Footer, HeroSlider, Blocks, ProductCard, BuyNowButton, OrderPayment,
                     EnquiryForm, ApplyForm, SocialLinks, Icons
lib/                 site (company, settings, businesses), razorpay (server), supabaseClient, supabaseAdmin, types
supabase/            SQL files listed in step 1
public/it/           KMR Apps (HRM, Balloon Inspector, Process Documents, Capacity Planner)
```
