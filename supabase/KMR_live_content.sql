-- =====================================================================
--  KMR Group website — GO-LIVE CONTENT (run once in the Supabase SQL Editor; safe to re-run)
--  Run after add-home-content.sql. Everything stays editable in KMR Console › Website CMS.
--
--  1. Removes ALL sample content (slides, numbers, products, jobs, people, gallery, sample photos)
--  2. Company profile: introduction, story, vision, mission, values, founder message, hours
--  3. Business verticals, banner slides, highlight numbers
--  4. Home page: who we serve, why KMR, product benefits (P·Q·C·D), how it works
--  5. Training programmes and software services (priced on request — set prices in the CMS if you wish)
--  6. Policies: Terms, Privacy, Refund & Cancellation, Shipping & Delivery (only where the placeholder is still there)
--  Your logo, photos, phone, email, address, GSTIN, Udyam and your own shop products are NOT changed.
--  Facts used: GST REG-06, Udyam certificate (Micro; business commenced 01-08-2026; NIC 47912 e-commerce retail,
--  62011/62012/62013 software, 62020 IT consultancy), trademark application 7932239, the founder's profile.
--  The policies are a sound starting point for an Indian online business — have them read once by your advisor.
-- =====================================================================

-- ---------- 1. remove sample content ----------
delete from hero_slides   where sample;
delete from site_stats    where sample;
delete from job_openings  where sample;
delete from leaders       where sample;
delete from gallery_items where sample;
update products set is_active = false where sample and id in (select product_id from orders where product_id is not null);
delete from products      where sample and id not in (select product_id from orders where product_id is not null);
update verticals    set image_url = null         where image_url like '%/sample/%';
update company_info set about_image_url = null   where about_image_url like '%/sample/%';
update company_info set founder_photo_url = null where founder_photo_url like '%/sample/%';

-- ---------- 2. company profile ----------
update company_info set
  short_about = 'KMR Group of Companies is a Puducherry-based enterprise serving businesses and buyers across India with an online store, software for manufacturers, IT consulting, industry training and import–export — backed by 18+ years of automotive manufacturing and quality experience.',
  about_story = $t$KMR Group of Companies was founded in 2026 by R. Rajavelu, a manufacturing and quality professional with more than 18 years in automotive OEM and Tier-1 plants — running manufacturing, quality management and production planning.

Across those years one lesson kept repeating: businesses grow faster when they get dependable supplies, simple software and practical skills from people who understand how work actually happens on the ground. KMR was set up to offer exactly that, under one roof.

# What we do
- Online store — industrial and everyday products, ordered online with GST invoices and secure payment.
- Software & IT services — KMR Apps for manufacturers (HRM, Balloon Inspector, Process Documents, Capacity Planner), custom business software and IT consulting.
- Training & development — IATF 16949, core tools and problem-solving programmes for teams and individuals.
- Trade — sourcing, import–export and wholesale supply, quoted to your requirement.

# How we work
We quote clearly, bill correctly and deliver what we promise. KMR is GST-registered, an Udyam-registered micro enterprise, and our brand is filed with the Trade Marks Registry. Every payment goes only to our registered company bank account.$t$,
  vision = 'To be the most trusted partner for growing Indian businesses — one group they can rely on for supplies, software and skills.',
  mission = $t$Give every customer dependable products, practical software and real-world training at fair, transparent prices — and stay with them after the sale.$t$,
  core_values = $t$Integrity — we do what we say, and put it in writing
Precision — the details decide the quality
Customer first — we measure ourselves by your results
Learning — we keep improving, and help our customers do the same$t$,
  founder_name = coalesce(nullif(founder_name, ''), 'R. Rajavelu'),
  founder_title = 'Founder & Proprietor',
  founder_message = $t$For more than eighteen years I worked on automotive shop floors — running manufacturing, quality and production planning for OEM and Tier-1 suppliers. I saw how much good businesses struggle with things that should be simple: getting the right supplies on time, keeping HR and quality records in order, planning capacity, and training people properly.

KMR Group of Companies is my answer to those problems. We sell what we would buy ourselves, build software we would want to use on our own shop floor, and teach what we have practised — IATF 16949, the core tools and structured problem solving.

Our promise to you is simple: clear prices, honest timelines, correct GST invoices, and a real person who answers. Every payment goes only to our registered company account.

Thank you for considering KMR. I look forward to working with you.$t$,
  business_hours = 'Mon – Sat, 10:00 am – 6:00 pm (IST)',
  careers_email = coalesce(nullif(careers_email, ''), email, 'info@kmr-groups.com'),
  updated_at = now();

-- ---------- 3a. business verticals ----------
update verticals set title = 'E-Commerce & Distribution', code = 'ONLINE STORE', link = '/shop', sort_order = 1, is_active = true,
  description = 'Industrial supplies, tools and everyday products ordered online — GST invoice with every order and secure payment to our company account.' where slug = 'shop';
update verticals set title = 'Software & AI Solutions', code = 'SOFTWARE', link = '/software', sort_order = 2, is_active = true,
  description = 'KMR Apps for manufacturers — HRM, Balloon Inspector, Process Documents and Capacity Planner — plus custom business software and IT consulting.' where slug = 'software';
update verticals set title = 'Training & Education', code = 'TRAINING', link = '/training', sort_order = 3, is_active = true,
  description = 'IATF 16949, core tools (APQP, PPAP, FMEA, SPC, MSA) and problem-solving programmes — at your plant or online.' where slug = 'training';
update verticals set title = 'Import & Export', code = 'EXIM', link = '/trade#import_export', sort_order = 4, is_active = true,
  description = 'Sourcing and export of industrial and consumer goods with documentation handled end to end — quoted to your terms.' where slug = 'import_export';
update verticals set title = 'Trading & Retail', code = 'TRADING', link = '/trade#trading', sort_order = 5, is_active = true,
  description = 'Wholesale and retail supply of materials and finished goods with clear pricing and dependable delivery.' where slug = 'trading';
update verticals set title = 'Investment & Partnerships', code = 'PARTNERSHIPS', link = '/contact', sort_order = 6, is_active = true,
  description = 'Strategic partnerships and investment in growing businesses. Partners and investors — let us talk.' where slug = 'investment';

-- ---------- 3b. banner slides (your photos are kept; only the words change) ----------
update hero_slides set sort_order = 1, eyebrow = 'KMR Group of Companies · Puducherry, India',
  title = 'Supplies, software and skills for growing businesses',
  subtitle = 'Shop industrial and everyday products online, run your plant on KMR Apps, train your team, or source and export goods — with clear prices, GST invoices and secure payment.',
  cta_label = 'Explore products', cta_link = '/shop', cta2_label = 'Get a quote', cta2_link = '/contact'
 where title in ('Everything your business needs, from one trusted partner', 'One Vision. Multiple Solutions. Global Impact.');
update hero_slides set sort_order = 2, eyebrow = 'For manufacturers', title = 'Run your plant on KMR Apps',
  subtitle = 'HRM, Balloon Inspector, Process Documents and Capacity Planner — built by a manufacturing professional with 18+ years on automotive shop floors. Start with a free pilot.',
  cta_label = 'See plans & pricing', cta_link = '/software', cta2_label = 'Book a free demo', cta2_link = '/software#demo'
 where title in ('Run your plant with KMR Apps', 'Run your plant on KMR Apps');
update hero_slides set sort_order = 3, eyebrow = 'Training & development', title = 'Train your team on real shop-floor problems',
  subtitle = 'IATF 16949, core tools and problem solving — taught by an IATF 16949 internal auditor, at your plant or online.',
  cta_label = 'View programmes', cta_link = '/training', cta2_label = 'Plan a programme', cta2_link = '/training#plan'
 where title in ('Train your team on real shop-floor problems', 'Skills that move the shop floor');

-- ---------- 3c. highlight numbers (only facts we can stand behind) ----------
delete from site_stats;
insert into site_stats (value, label, sort_order) values
  ('18+', 'Years of automotive manufacturing & quality experience', 1),
  ('4', 'Cloud apps built for manufacturers', 2),
  ('IATF 16949', 'Auditor-led quality know-how', 3),
  ('1 day', 'Reply to every enquiry', 4);

-- ---------- 4a. who we serve / why KMR / how it works ----------
delete from home_points;
insert into home_points (section, title, text, icon, link, link_label, sort_order) values
  ('audience', 'Manufacturers & MSMEs', 'HR, inspection, APQP / PPAP and capacity planning software — plus training for your quality and production teams.', 'code', '/software', 'Software for your plant', 1),
  ('audience', 'Businesses going digital', 'Custom business software, websites and IT consulting for small and growing companies.', 'briefcase', '/software#demo', 'Talk to us', 2),
  ('audience', 'Online shoppers', 'Industrial and everyday products, ordered online and paid securely by UPI, card, net banking or bank transfer.', 'bag', '/shop', 'Visit the store', 3),
  ('audience', 'Traders, importers & exporters', 'Sourcing, wholesale supply and export with documentation handled — quoted to your quantity and terms.', 'globe', '/trade', 'Request a quote', 4),
  ('audience', 'Engineers & students', 'Practical programmes in IATF 16949, core tools and problem solving that build job-ready skills.', 'cap', '/training', 'View programmes', 5),

  ('why', 'Built by a shop-floor professional', 'Founded by an engineer with 18+ years running manufacturing, quality and planning in automotive OEM and Tier-1 plants.', 'briefcase', '/about', 'About us', 1),
  ('why', 'Clear prices, correct invoices', 'Prices shown up front and a proper GST invoice with every order — no hidden charges.', 'chart', null, null, 2),
  ('why', 'Payments only to our company', 'Pay online or by bank transfer — always into KMR Group of Companies’ registered bank account, never to a person.', 'lock', null, null, 3),
  ('why', 'Registered and accountable', 'GST-registered, Udyam-registered MSME, brand filed with the Trade Marks Registry, with published policies.', 'shield', '/policies', 'Our policies', 4),
  ('why', 'Honest timelines', 'We confirm lead times before you order and keep you informed until delivery.', 'truck', null, null, 5),
  ('why', 'A person who answers', 'A reply within one working day — phone, WhatsApp or email, Monday to Saturday.', 'users', '/contact', 'Contact us', 6),

  ('process', 'Tell us what you need', 'Order from the store, choose a software plan, or send an enquiry with your requirement.', 'file', null, null, 1),
  ('process', 'Get a clear quote', 'Price, lead time and terms in writing — usually within one working day.', 'check', null, null, 2),
  ('process', 'Pay securely', 'Online or by bank transfer, only to our company account. You receive a GST invoice.', 'lock', null, null, 3),
  ('process', 'Delivery & support', 'We deliver, set up or train — and stay with you after the sale.', 'truck', null, null, 4);

-- ---------- 4b. product-wise benefits ----------
delete from product_benefits;
insert into product_benefits (product, tagline, link, productivity, quality, cost, delivery, sort_order) values
  ('KMR HRM', 'Onboarding, attendance, leave and HR records', '/software',
   'Self-onboarding, ID cards and biometric attendance replace paper registers; leave and attendance summaries are ready at month end.',
   'Complete, consistent HR records that support IATF 16949 and ISO 9001 audits.',
   'Pay per employee per month — no servers to buy, no software to install.',
   'Start with a free pilot; your employee list can be imported for you.', 1),
  ('Balloon Inspector', 'Ballooned drawings and inspection reports', '/software',
   'Balloon PDF, DXF or STEP drawings and create the inspection report in one place instead of by hand.',
   'Every characteristic numbered and carried to the report — fewer missed dimensions.',
   'Less engineering time per drawing and per PPAP submission.',
   'Faster first-article inspection and PPAP turnaround to your customer.', 2),
  ('Process Documents', 'APQP / PPAP documents from the ballooned drawing', '/software',
   'Process flow, PFMEA and control plan built from the same characteristics — nothing typed twice.',
   'Linked documents that stay consistent when the drawing changes.',
   'Fewer hours of documentation for every new part.',
   'New-part documents ready sooner for customer approval.', 3),
  ('Capacity Planner', 'Monthly plan and machine loading', '/software',
   'See machine loading and bottlenecks before the month starts.',
   'Plans built on your real cycle times, shifts and holidays.',
   'Avoid last-minute overtime and outsourcing by planning ahead.',
   'Commit delivery dates you can keep.', 4),
  ('Online store', 'Industrial and everyday products', '/shop',
   'Order in minutes, any time — no calls or follow-ups.',
   'Products from dependable sources, with a GST invoice for every order.',
   'Clear prices, with offers shown up front.',
   'Dispatched as soon as your payment is confirmed; tracking shared with you.', 5),
  ('Training programmes', 'IATF 16949, core tools and problem solving', '/training',
   'Teams apply APQP, PPAP, FMEA, SPC and MSA to their own parts.',
   'Better practice means fewer audit findings and customer complaints.',
   'In-house programmes at your plant — no travel for the team.',
   'Scheduled on dates that suit your production.', 6);

-- ---------- 5. training programmes and software services (price on request) ----------
insert into products (name, category, business, kind, price, stock_quantity, enquiry_only, unit, featured, sort_order, is_active, details, description)
select v.name, v.category, 'training', 'course', 0, 0, true, 'seat', v.featured, v.sort_order, true, v.details::jsonb, v.description from (values
  ('IATF 16949:2016 Awareness & Internal Auditor', 'Quality systems', true, 1, '{"duration":"2 days","mode":"At your plant or online"}',
   $t$Understand IATF 16949:2016 clause by clause and learn to plan, conduct and report process audits.

- Automotive QMS requirements and customer-specific requirements
- Process approach, turtle diagrams and audit checklists
- Writing clear nonconformities and verifying corrective actions
- Practical audit exercise on your own processes$t$),
  ('Core Tools: APQP, PPAP, FMEA, SPC & MSA', 'Quality systems', true, 2, '{"duration":"2 days","mode":"At your plant or online"}',
   $t$The five automotive core tools, taught with examples from real parts.

- APQP phases and PPAP submission levels
- Process flow, PFMEA (AIAG-VDA) and control plan
- SPC: control charts, Cp / Cpk
- MSA: gauge R&R, bias and linearity$t$),
  ('Problem Solving with 8D & Root Cause Analysis', 'Problem solving', false, 3, '{"duration":"1 day","mode":"At your plant or online"}',
   $t$A structured way to solve customer complaints and internal problems — and stop them coming back.

- 8D method from containment to prevention
- Why-why, fishbone and is / is-not analysis
- Writing an 8D report customers accept$t$),
  ('Manufacturing Excellence for Supervisors', 'Shop floor', false, 4, '{"duration":"1 day","mode":"At your plant"}',
   $t$Practical tools for supervisors and line leaders.

- 5S, standard work and visual management
- Daily production and quality review
- Handling abnormalities and escalation$t$)
) v(name, category, featured, sort_order, details, description)
where not exists (select 1 from products p where p.name = v.name);

insert into products (name, category, business, kind, price, stock_quantity, enquiry_only, featured, sort_order, is_active, description)
select v.name, v.category, 'software', 'service', 0, 0, true, false, v.sort_order, true, v.description from (values
  ('Custom business software', 'Software development', 1,
   $t$Web and mobile applications built around how your business works — order tracking, inventory, quality, HR or reporting.

- Requirement study and a fixed-scope quote
- Cloud hosting, your data in India
- Training and support after go-live$t$),
  ('IT consulting for MSMEs', 'IT consulting', 2,
   $t$Choose, set up and use the right software for your company.

- Review of your current processes and tools
- ERP, HR and quality system selection and set-up
- Data migration and staff training$t$),
  ('Business website & online store set-up', 'Web & e-commerce', 3,
   $t$A professional website or online store for your business, with enquiry forms, payments and GST invoicing.

- Design, content and domain set-up
- Payment gateway and order management
- Hand-over training so you can update it yourself$t$)
) v(name, category, sort_order, description)
where not exists (select 1 from products p where p.name = v.name);

-- ---------- 6. header ----------
update site_settings set header_cta_label = 'Get a quote', header_cta_link = '/contact', updated_at = now();

-- ---------- 7. policies (only pages that still carry the placeholder text) ----------
update legal_pages set title = 'Terms & Conditions', summary = 'The terms for using this website and buying from KMR Group of Companies.', show_in_footer = true, sort_order = 1, updated_at = now(),
content = $t$These terms apply to www.kmr-groups.com and to every order, subscription and service bought from KMR Group of Companies ("KMR", "we", "us"), a proprietorship of R. Rajavelu, No. 2, Ellaiamman Kovil Main Road, Korkadu, Puducherry 605110, India (GSTIN 34ATYPR2021H1ZH). By using this website or placing an order you agree to them.

# Products, prices and taxes
- Prices are in Indian Rupees and include GST unless stated otherwise. A GST invoice is issued for every order.
- We describe products as accurately as we can. Photos are for illustration; minor differences in colour or packaging may occur.
- Items marked "price on request" are quoted in writing. A quote is valid for the period stated on it.
- We may correct obvious pricing errors; if that changes your order value we will contact you before processing it.

# Orders and payment
- An order is confirmed when full payment reaches our registered company bank account, either online through our payment partner or by bank transfer / UPI.
- Pay only to the account shown on your order page or our invoice. KMR will never ask you to pay into a personal account.
- We may decline or cancel an order if the product is unavailable or the details cannot be verified; any amount paid is refunded in full.

# Software subscriptions (KMR Apps)
- Subscriptions are billed per user or machine for the chosen period and renew only when you pay the next invoice.
- You own your data. You can export it at any time and we delete it on request after the subscription ends.
- We aim for high availability and announce planned maintenance in advance, but do not guarantee uninterrupted service.

# Training programmes
- Seats are confirmed on payment. Course material is for the participant's own use.
- Certificates of participation are issued to participants who attend the full programme.

# Liability
Our liability for any order is limited to the amount paid for it. We are not liable for indirect or consequential loss. Nothing in these terms limits your rights under the Consumer Protection Act, 2019.

# Governing law
These terms are governed by the laws of India. Courts at Puducherry have jurisdiction. Questions: info@kmr-groups.com.$t$
where slug = 'terms' and (content like 'Add your%' or length(content) < 120);

update legal_pages set title = 'Privacy Policy', summary = 'What personal data we collect, why, and how we protect it.', show_in_footer = true, sort_order = 2, updated_at = now(),
content = $t$KMR Group of Companies respects your privacy. This policy explains how we handle personal data under the Digital Personal Data Protection Act, 2023 and other Indian law.

# What we collect
- Details you give us: name, phone, email, company, delivery address, and the content of enquiries and job applications (including résumés).
- Order and payment details: what you bought and the payment reference. Card and UPI details are handled by our payment partner — we never see or store them.
- Basic technical data such as the pages you visit, to keep the website secure and working.

# Why we use it
- To process orders, deliver products, provide software and training, and issue GST invoices.
- To reply to enquiries and consider job applications.
- To meet legal, tax and accounting obligations.
We do not sell your data and do not use it for unrelated marketing without your consent.

# Who we share it with
Only with those who help us serve you — courier partners, our payment partner, and hosting providers — and with authorities when the law requires it.

# How long we keep it
Order and invoice records are kept as long as tax law requires (generally eight years). Enquiries and job applications are kept for up to two years unless you ask us to delete them sooner.

# Your rights
You may ask to see, correct or delete your personal data, or withdraw consent, by writing to info@kmr-groups.com. We respond within 30 days.

# Security
Data is stored with reputable cloud providers, access is limited to authorised staff, and connections to this website are encrypted.

# Contact
Grievance Officer: R. Rajavelu, KMR Group of Companies, No. 2, Ellaiamman Kovil Main Road, Korkadu, Puducherry 605110 · info@kmr-groups.com · +91 63790 44506.$t$
where slug = 'privacy' and (content like 'Add your%' or length(content) < 120);

update legal_pages set title = 'Refund & Cancellation Policy', summary = 'How to cancel an order and when you get your money back.', show_in_footer = true, sort_order = 3, updated_at = now(),
content = $t$# Cancelling an order
- Products: you may cancel free of charge any time before dispatch. Write to info@kmr-groups.com or WhatsApp +91 63790 44506 with your order number.
- Training: cancel up to 7 days before the programme for a full refund, or move your seat to a later batch at no cost. Cancellations within 7 days are refunded at 50%.
- Software subscriptions: you may stop at the end of any paid period. The current period is not refunded, except as below.

# Returns and replacements
- If a product arrives damaged, defective or different from what you ordered, tell us within 7 days of delivery with photos. We will replace it or refund you in full, including any delivery charge.
- Unused products in original packaging may be returned within 7 days for reasons other than a fault; the return delivery cost is borne by you. Consumables, items made or cut to order, and items marked non-returnable cannot be returned for change of mind.

# Software
If KMR Apps do not work as described and we cannot fix the problem within 7 days of your report, we refund the unused part of your subscription.

# How refunds are paid
Refunds go back to the original payment method (online payments) or to your bank account (bank transfers) within 7 working days of approval. You will receive a credit note against the GST invoice.

# Questions
info@kmr-groups.com · +91 63790 44506 (Mon – Sat, 10:00 am – 6:00 pm).$t$
where slug = 'refund' and (content like 'Add your%' or length(content) < 120);

update legal_pages set title = 'Shipping & Delivery Policy', summary = 'Where we deliver, how long it takes and what it costs.', show_in_footer = true, sort_order = 4, updated_at = now(),
content = $t$# Where we deliver
We deliver across India through reliable courier and transport partners. For export orders, delivery terms (for example FOB or CIF) are agreed in the quotation.

# When your order ships
- Orders are packed and dispatched within 2 working days after your payment is confirmed, unless the product page or quote states a different lead time.
- You receive the courier name and tracking details by SMS, WhatsApp or email.

# Delivery time
Usually 3 to 7 working days after dispatch, depending on your location. Remote areas may take longer. Bulk and made-to-order items are delivered on the date agreed in the quote.

# Delivery charges
Delivery charges, if any, are shown before you pay. Where no charge is shown, delivery is included in the price.

# Software and training
KMR Apps are delivered online: login details are sent to your email once payment is confirmed, usually the same working day. Training programmes run at your premises or online on the agreed dates.

# If something goes wrong
If a parcel arrives damaged or incomplete, please note it on the delivery receipt where possible and tell us within 7 days — see our Refund & Cancellation Policy. For any delay, contact info@kmr-groups.com or +91 63790 44506.$t$
where slug = 'shipping' and (content like 'Add your%' or length(content) < 120);

update legal_pages set summary = coalesce(summary, 'Who to contact if something goes wrong, and how we resolve it.'), show_in_footer = true, sort_order = 5 where slug = 'grievance';
