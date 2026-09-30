# KMR Group of Companies — Website

A full corporate + marketplace website: hero banner, leadership, business
verticals, gallery, product catalog (Amazon/Flipkart-style), India-compliant
legal pages, and a login-protected admin panel with add/edit/delete/upload
for every section. Built with Next.js + Tailwind + Supabase, responsive on
web, iPhone and Android, and installable as a home-screen app (PWA).

## 1. Create your Supabase project (backend + database + storage)

1. Go to https://supabase.com → New project. Note your **Project URL** and
   **anon public API key** (Settings → API).
2. Open the SQL Editor → New query, paste the entire contents of
   `supabase/schema.sql`, and run it. This creates every table, sets up
   public read / admin-only write security, seeds the 5 legal pages, and
   creates the `media` storage bucket for photos/videos.
3. Create your admin login: Authentication → Users → Add user → enter your
   email and a password. This is the ONLY login the admin panel accepts —
   there is no public sign-up form, by design.

## 2. Configure the project locally

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase Project URL and anon key from
step 1.

## 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the public site, and
http://localhost:3000/admin/login to sign in with the admin account you
created in Supabase.

## 4. Add your real content

Everything is editable from the admin panel — nothing is hardcoded once you
save it once:

- **Admin → Hero Banner** — headline, subheadline, banner image, button
- **Admin → Leadership** — add/edit/delete management team profiles + photos
- **Admin → Verticals** — add/edit/delete your business verticals
- **Admin → Gallery** — upload photos and promo videos
- **Admin → Products** — add/edit/delete products with photo, price, MRP,
  stock quantity, and a visible/hidden toggle — your Amazon/Flipkart-style
  catalog
- **Admin → Legal Pages** — edit Terms & Conditions, Privacy Policy,
  Refund & Cancellation, Shipping & Delivery, and Grievance Redressal
- **Admin → Company Info** — legal name, GSTIN, CIN, registered address,
  map coordinates, email, phone, WhatsApp, all social media links, and
  your company logo (shown in the navigation bar and footer)

## 5. Deploy it live on your domain

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com → New Project → import the repo.
3. In Vercel → Settings → Environment Variables, add the same two variables
   from your `.env.local`.
4. Deploy. Then go to Vercel → Settings → Domains and add your own domain —
   point your domain's DNS to Vercel as instructed there.

The site is already responsive (mobile/tablet/desktop) and works as an
installable web app on iPhone (Safari → Share → Add to Home Screen) and
Android (Chrome → Add to Home Screen) — no app-store submission needed.
If you later want true native iOS/Android apps in the App Store/Play
Store, that is a separate build on top of this.

## 6. Before going live — legal checklist (India)

The legal pages are pre-created but contain placeholder text — replace with
real content before accepting real orders:

- **Terms & Conditions** and **Privacy Policy** — have these reviewed by a
  lawyer or use a compliant generator; they must reflect your actual data
  practices.
- **Refund & Cancellation Policy** and **Shipping & Delivery Policy** —
  required for any e-commerce/marketplace activity in India.
- **Grievance Redressal** — under the Consumer Protection (E-Commerce)
  Rules, 2020, you must name a Grievance Officer with contact details on
  the site.
- **GSTIN / CIN** — display your real registration numbers in
  Admin → Company Info; they show on the About page and can be referenced
  in your footer/invoices.
- **Payments** — real Razorpay checkout is now wired in (see "Set up Razorpay
  payments" below). A WhatsApp "Ask on WhatsApp" button remains alongside it
  for customers who prefer to enquire first.

## 7. Set up Razorpay payments

1. In your Razorpay Dashboard, go to Settings → API Keys and generate a
   **Key ID** and **Key Secret**. Use **Test Mode** keys first to try a
   full checkout without moving real money, then switch to **Live Mode**
   keys when you're ready to accept real payments.
2. In Supabase → Settings → API, copy your **service_role** key (different
   from the anon key — keep this one secret).
3. Add all of these to `.env.local` (and later to Vercel's Environment
   Variables):
   ```
   SUPABASE_SERVICE_ROLE_KEY=...
   RAZORPAY_KEY_ID=...
   RAZORPAY_KEY_SECRET=...
   ```
4. Re-run `supabase/schema.sql` in the SQL Editor — it now also creates an
   `orders` table (safe to re-run; existing tables are left untouched).
5. Restart `npm run dev`. On any product page, "Buy Now" opens a Razorpay
   checkout modal. After payment, the signature is verified server-side,
   the order is marked "paid," and stock is automatically decremented.
6. Check **Admin → Orders** to see every order and its status (created /
   paid / failed), customer details, and shipping address.

**Never** put `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` in a
`NEXT_PUBLIC_` variable — both must stay server-side only, which is how
this code is already written.

## 9. Set up department staff logins & permissions

1. Re-run `supabase/add-permissions-and-compliance.sql` in the SQL Editor
   (safe alongside everything you've already run).
2. **Bootstrap your own admin account**: in Supabase → Authentication →
   Users, click your existing login and copy the **User UID**. Then run
   this one-time SQL (also included as a comment at the top of that
   file):
   ```sql
   insert into staff_profiles (id, full_name, email, department, is_admin)
   values ('YOUR-AUTH-USER-ID', 'Rajavelu R', 'info@kmr-groups.com', 'admin', true)
   on conflict (id) do update set is_admin = true;
   ```
3. Log in to `/admin/login` as usual, then go to **Admin → Staff &
   Permissions** (only visible to admins).
4. Click **Add a Department Login** — enter a name, email, password, and
   department (Sales, Stores, Purchase, Top Management, Other), then check
   exactly which sections that person can Create / Read / Update / Delete
   in the permission grid. They'll only see the sections you grant them —
   everything else is hidden from their sidebar and blocked at the
   database level even if they try to access it directly.
5. To revoke someone's access later, click **Deactivate** next to their
   name — their login stops working immediately.

## 10. Finance & Compliance dashboard

Go to **Admin → Finance & Compliance** to track GST, Udyam registration,
trademark filings, employee welfare compliance, pollution control
consents, local body licenses, invoicing, and anything else — each record
supports a reference number, issuing authority, issue/expiry dates, an
uploaded document (certificate/license scan), and notes.

The dashboard automatically flags anything **expiring soon** (based on
the "remind me X days before" setting per record) or **already expired**
in red/amber, with a summary count at the top. This is a tracking and
alerting tool — it doesn't file anything with government portals for you,
but gives you one place to see what needs renewal and when.

## 12. Phase 1: Operations (Customers, Vendors, Items, Warehouses, Stock, Employees)

This is the first phase of turning the site into an internal operations
system alongside the public website — the foundation everything else
(Sales Orders, Purchase Orders, Work Orders, full HRM) will build on next.

1. Run `supabase/add-phase1-operations.sql` in the SQL Editor (after
   `add-permissions-and-compliance.sql`).
2. Go to **Admin → Staff & Permissions** and grant the relevant new
   sections (Customers, Vendors, Items Master, Warehouses, Stock Ledger,
   Employees) to whichever staff logins need them — e.g. give your
   Purchase department read/write on Vendors and Items Master, your
   Stores department read/write on Stock Ledger and Warehouses.
3. Start by adding at least one **Warehouse** and a few **Items** — the
   Stock Ledger needs both of those to exist before you can record any
   stock movement.
4. **Stock Ledger** works as a running log: every opening balance,
   purchase receipt, sales dispatch, production consumption/output, or
   manual adjustment is one row. Current stock on hand is calculated
   automatically by summing all movements for each item/warehouse pair —
   you never edit a "current stock" number directly, you always add a
   new movement.

**What's next (not built yet):** Purchase Order → Goods Receipt →
Vendor Billing (Phase 2), Sales Order → Dispatch → GST Invoice (Phase 3),
full HRM with attendance/PF (Phase 4), Work Orders/BOM for manufacturing
(Phase 5), and Import/Export + full production planning (Phase 6). Each
is its own build on top of this foundation.

## 13. Project structure

```
app/              Public pages + admin panel + API routes (Next.js App Router)
app/admin/operations/  Customers, Vendors, Items Master, Warehouses, Stock Ledger, Employees
app/api/           create-order, verify-payment (Razorpay) + admin/create-staff, admin/delete-staff
components/       Navbar, Footer, SpecPlate, ImageUploader, BuyNowButton, PermissionGate
lib/              supabaseClient (browser), supabaseAdmin (server-only), AdminAccessContext, types, resources
supabase/         schema.sql + add-orders-table.sql + add-logo-column.sql +
                  add-permissions-and-compliance.sql + add-phase1-operations.sql +
                  add-legal-identity.sql
public/           manifest.json (PWA)
```


## Legal identity & brand (Company Info)

Run `supabase/add-legal-identity.sql` once in the SQL Editor. Admin → Company Info then also holds the trade name,
legal name, constitution, proprietor, Udyam number and MSME category, trademark status, full address (city, state,
PIN), website, tagline, slogan, footer text, vision, mission, the logo with business verticals and the letterhead.
They appear on About, Contact, the footer and the map. Company Info is public — never enter Aadhaar, PAN or bank
account numbers there (invoices take those from the KMR Console).
