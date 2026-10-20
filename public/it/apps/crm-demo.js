/* CRM & RFQ - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_crm_*, migration 0079). Nothing here is real data. */
(function () {
  "use strict";
  const C = window.CRMCalc, err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim();
  const J = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));
  let uid = 0; const id = () => "c" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const td = () => day(0), nowIso = () => new Date().toISOString();
  const nm = (v) => C.num(v), orNull = (v) => (T(v) === "" ? null : T(v));
  const S = { settings: { currency: "INR", tax_name: "GST", tax_pct: 18, validity_days: 30, fy_numbering: true, payment_terms: "30 days from invoice date", delivery_terms: "Ex-works, packing included", default_oh: 10, default_margin: 12,
      company_address: "Plot 12, Industrial Estate, Hosur 635109", company_gstin: "33AAACD1234E1Z5", company_phone: "+91 98400 00000", company_email: "sales@demo-engineering.example", signatory: "R. Venkatesh", signatory_title: "Director — Sales",
      terms: "1. Prices are per piece in Indian rupees and exclusive of tax unless stated.\n2. Delivery as per the lead time shown, from receipt of a confirmed purchase order and approved drawing.\n3. Raw material price variation beyond 3% is passed on at actuals.\n4. Tooling, if any, is charged separately as agreed." },
    parties: [], contacts: [], leads: [], rfqs: [], items: [], sqs: [], quotes: [], acts: [], n: {} };
  const ME = "you@demo.example";
  function number(kind) {
    const s = S.settings, key = kind, pre = (orNull(s[{ LD: "lead_prefix", RFQ: "rfq_prefix", QTN: "quote_prefix" }[kind]]) || kind).toUpperCase().replace(/[^A-Z0-9-]/g, "") || kind;
    const d = new Date(), y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
    if (s.fy_numbering !== false) { const fy = String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"); S.n[key + fy] = (S.n[key + fy] || 0) + 1; return pre + "/" + fy + "/" + String(S.n[key + fy]).padStart(4, "0"); }
    S.n[key] = (S.n[key] || 0) + 1; return pre + "-" + String(S.n[key]).padStart(4, "0");
  }
  const nextCode = (p) => p + "-" + String((S.n[p] = (S.n[p] || 0) + 1)).padStart(4, "0");
  const party = (i) => S.parties.find((p) => p.id === i) || err("Customer not found.");
  const pName = (i) => { const p = S.parties.find((x) => x.id === i); return p ? p.name : null; };
  const priced = (it) => J(it);
  const itemOut = (it) => J(it);
  const val = (r) => S.items.filter((i) => i.rfq_id === r.id).reduce((s, i) => s + i.qty * i.unit_price, 0);
  const OPEN = ["Received", "Costing", "Quoted", "Negotiation"];

  function mkParty(o) { const p = Object.assign({ id: id(), code: nextCode(o.kind === "supplier" ? "SUP" : "CUS"), kind: "customer", industry: null, gstin: null, pan: null, address: null, city: null, state: null, country: "India", pincode: null, website: null,
    payment_terms: null, credit_days: null, owner: ME, status: "active", notes: null, sample: true, updated_at: nowIso() }, o); S.parties.push(p); return p; }
  function mkContact(pid, name, des, mob, email) { const c = { id: id(), party_id: pid, name, designation: des || null, department: null, email: email || null, phone: null, mobile: mob || null, is_primary: !S.contacts.some((x) => x.party_id === pid), notes: null, created_at: nowIso() }; S.contacts.push(c); return c; }
  function mkLead(o) { const l = Object.assign({ id: id(), no: number("LD"), party_id: null, company: "", contact_name: null, designation: null, phone: null, email: null, source: null, stage: "New", product_interest: null, value: null, expected_close: null, owner: ME, next_followup: null, lost_reason: null, notes: null, closed_at: null, sample: true, created_at: nowIso(), updated_at: nowIso() }, o); S.leads.push(l); return l; }
  function mkRfq(o) { const r = Object.assign({ id: id(), no: number("RFQ"), customer_ref: null, party_id: null, contact_id: null, lead_id: null, received_on: td(), due_on: null, status: "Received", priority: "Normal", owner: ME, project: null, currency: "INR", notes: null, lost_reason: null, decided_on: null, sample: true }, o); S.rfqs.push(r); return r; }
  function mkItem(rfq, seq, o) { const it = Object.assign({ id: id(), rfq_id: rfq.id, seq, part_no: null, part_name: "", drawing_no: null, revision: null, material: null, qty: 1, annual_qty: null, uom: "Nos", target_price: null, cost: {}, unit_cost: 0, unit_price: 0, remarks: null }, o); repriced(it); S.items.push(it); return it; }
  function repriced(it) { const k = C.cost(it.cost); it.unit_cost = k.total_cost; it.unit_price = k.price; }
  function mkAct(o) { const a = Object.assign({ id: id(), lead_id: null, party_id: null, rfq_id: null, kind: "call", subject: "", notes: null, due_date: null, done: false, done_at: null, owner: ME, sample: true, created_by: ME, created_at: nowIso() }, o); S.acts.push(a); return a; }
  function quoteLines(rfqId, lead) { return S.items.filter((i) => i.rfq_id === rfqId && i.unit_price > 0).sort((a, b) => a.seq - b.seq).map((i, n) => ({ seq: n + 1, part_no: i.part_no, part_name: i.part_name, drawing_no: i.drawing_no, revision: i.revision, qty: i.qty, uom: i.uom, unit_price: i.unit_price, lead_days: lead || null, remarks: i.remarks })); }
  function mkQuote(o) { const q = Object.assign({ id: id(), no: "", rev: 0, rfq_id: null, party_id: null, contact_id: null, quote_date: td(), valid_until: day(30), status: "draft", currency: "INR", tax_name: "GST", tax_pct: 18, payment_terms: null, delivery_terms: null, terms: null, remarks: null,
    lines: [], prepared_by: ME, sent_on: null, decided_on: null, sample: true, updated_at: nowIso() }, o); const t = C.totals(q.lines, q.tax_pct); q.subtotal = t.sub; q.tax_amt = t.tax; q.total = t.tot; S.quotes.push(q); return q; }

  /* ---- sample data (same story as console.crm_sample) ---- */
  const c1 = mkParty({ name: "Deccan Motors Ltd", industry: "Automotive", gstin: "33AABCD1234E1Z5", address: "14, Industrial Estate, Ambattur", city: "Chennai", state: "Tamil Nadu", pincode: "600058", payment_terms: "45 days from invoice", credit_days: 45 });
  const c2 = mkParty({ name: "Southern Auto Components", industry: "Automotive", gstin: "29AAECS5678F1Z2", address: "Plot 22, Peenya 2nd Stage", city: "Bengaluru", state: "Karnataka", pincode: "560058", payment_terms: "30 days from invoice", credit_days: 30 });
  const c3 = mkParty({ name: "Precision Pumps India", industry: "Pumps and valves", gstin: "27AAGCP9012H1Z8", address: "Bhosari MIDC", city: "Pune", state: "Maharashtra", pincode: "411026", payment_terms: "30 days from invoice", credit_days: 30 });
  const c4 = mkParty({ name: "Western Hydraulics", kind: "prospect", industry: "Hydraulics", city: "Coimbatore", state: "Tamil Nadu" });
  const s1 = mkParty({ name: "Shree Steels", kind: "supplier", industry: "Steel bars and forgings", gstin: "33AAACS3456K1Z1", city: "Chennai", state: "Tamil Nadu", payment_terms: "15 days" });
  const s2 = mkParty({ name: "Anand Heat Treatments", kind: "supplier", industry: "Heat treatment and plating", gstin: "33AABCA7890M1Z6", city: "Hosur", state: "Tamil Nadu", payment_terms: "30 days" });
  const k1 = mkContact(c1.id, "R. Venkatesh", "Purchase Manager", "98400 11111", "venkatesh@deccan-motors.example"), k2 = mkContact(c2.id, "S. Priya", "Senior Buyer", "98450 22222", "priya@southern-auto.example"),
    k3 = mkContact(c3.id, "M. Kulkarni", "Head - Sourcing", "98220 33333", "kulkarni@precision-pumps.example");
  mkContact(c4.id, "A. Ramesh", "Proprietor", "98430 44444"); mkContact(s1.id, "K. Mohan", "Sales", "98400 55555"); mkContact(s2.id, "P. Anand", "Works manager", "98430 66666");
  const l1 = mkLead({ party_id: c4.id, company: "Western Hydraulics", contact_name: "A. Ramesh", phone: "98430 44444", source: "Trade fair", stage: "Qualified", product_interest: "Hydraulic manifold blocks, 500 per month", value: 1800000, expected_close: day(45), next_followup: day(2), notes: "Met at the trade fair. Sent our capability profile." });
  const l2 = mkLead({ company: "Kaveri Gearworks", contact_name: "T. Selvam", phone: "98410 77777", source: "Website enquiry", stage: "New", product_interest: "Gear blanks, annual 60,000", value: 950000, expected_close: day(60), next_followup: td() });
  mkLead({ company: "Nilgiri Tractors", contact_name: "D. Joseph", phone: "98420 88888", source: "Reference", stage: "Contacted", product_interest: "Hubs and flanges", value: 2400000, expected_close: day(75), next_followup: day(-3) });
  const l4 = mkLead({ party_id: c1.id, company: "Deccan Motors Ltd", contact_name: "R. Venkatesh", phone: "98400 11111", source: "Existing customer", stage: "Quoted", product_interest: "Drive flange DP-1101", value: 3100000, expected_close: day(20) });
  const l5 = mkLead({ party_id: c2.id, company: "Southern Auto Components", contact_name: "S. Priya", phone: "98450 22222", source: "Existing customer", stage: "Won", product_interest: "Wheel hub DP-1102", value: 1750000, closed_at: nowIso() });
  mkLead({ company: "Coastal Marine Pumps", contact_name: "B. Fernandes", source: "Cold call", stage: "Lost", product_interest: "Impeller castings", value: 600000, lost_reason: "Customer wanted castings, we machine only", closed_at: nowIso() });
  const r1 = mkRfq({ customer_ref: "DM/RFQ/2641", party_id: c1.id, contact_id: k1.id, lead_id: l4.id, received_on: day(-9), due_on: day(3), status: "Quoted", priority: "High", project: "Drive train 2027 programme", notes: "Annual volume 99,600. Drawing DRG-1101-A rev C." });
  const r2 = mkRfq({ customer_ref: "SAC-Q-118", party_id: c2.id, contact_id: k2.id, received_on: day(-3), due_on: day(6), status: "Costing", project: "Wheel hub and bracket" });
  const r3 = mkRfq({ customer_ref: "PPI/SRC/0912", party_id: c3.id, contact_id: k3.id, received_on: day(-1), due_on: day(-1), status: "Received", priority: "Urgent" });
  const r4 = mkRfq({ customer_ref: "SAC-Q-097", party_id: c2.id, contact_id: k2.id, lead_id: l5.id, received_on: day(-40), due_on: day(-30), status: "Won", project: "Wheel hub DP-1102", decided_on: day(-12) });
  mkItem(r1, 1, { part_no: "DP-1101", part_name: "Drive flange", drawing_no: "DRG-1101-A", revision: "C", material: "EN8 forged", qty: 8300, annual_qty: 99600, target_price: 410,
    cost: { mat_wt: 1.85, mat_rate: 78, scrap_pct: 6, mat_other: 0, ops: [{ name: "Turning (CNC)", min: 4.5, rate: 650 }, { name: "Drilling and tapping", min: 1.8, rate: 520 }, { name: "Deburring and wash", min: 0.6, rate: 300 }], outs: [], tool_cost: 120000, tool_qty: 100000, packing: 4.5, freight: 3, other: 0, oh_pct: 10, margin_pct: 12 } });
  const pin = mkItem(r1, 2, { part_no: "DP-1105", part_name: "Locating pin", drawing_no: "DRG-1105-A", revision: "B", material: "EN24", qty: 8300, annual_qty: 99600, target_price: 105,
    cost: { mat_wt: 0.62, mat_rate: 92, scrap_pct: 5, ops: [{ name: "VMC machining", min: 3.2, rate: 720 }, { name: "Drilling", min: 0.9, rate: 480 }], outs: [], packing: 2.5, freight: 2, oh_pct: 10, margin_pct: 14 } });
  mkItem(r2, 1, { part_no: "DP-1102", part_name: "Wheel hub", drawing_no: "DRG-1102-A", revision: "B", material: "SG iron casting", qty: 5600, annual_qty: 67200,
    cost: { mat_wt: 3.4, mat_rate: 74, scrap_pct: 7, ops: [{ name: "CNC turning", min: 6, rate: 650 }, { name: "VMC milling", min: 5.5, rate: 720 }], outs: [], packing: 6, freight: 4, oh_pct: 10, margin_pct: 12 } });
  const brk = mkItem(r2, 2, { part_no: "DP-1108", part_name: "Bracket", drawing_no: "DRG-1108-A", revision: "A", material: "IS 2062 plate", qty: 3000, annual_qty: 36000 });
  mkItem(r3, 1, { part_no: "PP-7710", part_name: "Pump shaft", drawing_no: "PPI-7710", revision: "D", material: "SS 410", qty: 1200, annual_qty: 14400 });
  mkItem(r4, 1, { part_no: "DP-1102", part_name: "Wheel hub", drawing_no: "DRG-1102-A", revision: "B", material: "SG iron casting", qty: 5600, annual_qty: 67200,
    cost: { mat_wt: 3.4, mat_rate: 74, scrap_pct: 7, ops: [{ name: "CNC turning", min: 6, rate: 650 }, { name: "VMC milling", min: 5.5, rate: 720 }], packing: 6, freight: 4, oh_pct: 10, margin_pct: 12 } });
  const sqA = { id: id(), rfq_id: r1.id, item_id: pin.id, supplier_id: s2.id, what: "Outsourced process", price: 6.2, moq: 5000, lead_days: 7, valid_until: day(20), payment_terms: "30 days", quote_ref: "AHT/0412", received_on: day(-6), selected: false, notes: null, sample: true };
  S.sqs.push(sqA, { id: id(), rfq_id: r1.id, item_id: pin.id, supplier_id: s1.id, what: "Outsourced process", price: 7.1, moq: 2000, lead_days: 5, valid_until: day(15), payment_terms: "15 days", quote_ref: "SS/HT/77", received_on: day(-5), selected: false, notes: null, sample: true },
    { id: id(), rfq_id: r2.id, item_id: brk.id, supplier_id: s1.id, what: "Raw material", price: 48.5, moq: 3000, lead_days: 10, valid_until: day(12), payment_terms: "15 days", quote_ref: null, received_on: day(-2), selected: false, notes: null, sample: true },
    { id: id(), rfq_id: r2.id, item_id: brk.id, supplier_id: s2.id, what: "Raw material", price: 46.8, moq: 6000, lead_days: 14, valid_until: day(10), payment_terms: "30 days", quote_ref: null, received_on: day(-2), selected: false, notes: null, sample: true });
  chooseSq(sqA, true);
  mkQuote({ no: number("QTN"), rfq_id: r1.id, party_id: c1.id, contact_id: k1.id, quote_date: day(-2), valid_until: day(28), status: "sent", sent_on: day(-2), payment_terms: "45 days from invoice", delivery_terms: "Ex-works, packing included", terms: S.settings.terms, lines: quoteLines(r1.id, 28) });
  mkQuote({ no: number("QTN"), rfq_id: r4.id, party_id: c2.id, contact_id: k2.id, quote_date: day(-38), valid_until: day(-8), status: "accepted", sent_on: day(-38), decided_on: day(-12), payment_terms: "30 days from invoice", delivery_terms: "Ex-works", lines: quoteLines(r4.id, 21) });
  mkAct({ lead_id: l1.id, party_id: c4.id, kind: "call", subject: "Call about the manifold block drawings", notes: "Ask for the 3D model and the expected annual volume.", due_date: day(2) });
  mkAct({ lead_id: l2.id, kind: "email", subject: "Send company profile and rate card", due_date: td() });
  mkAct({ lead_id: S.leads[2].id, kind: "visit", subject: "Plant visit — Nilgiri Tractors", notes: "Overdue — reschedule with D. Joseph.", due_date: day(-3) });
  mkAct({ party_id: c1.id, rfq_id: r1.id, kind: "call", subject: "Chase the quotation response", notes: "Buyer said the commercial review is next week.", due_date: day(4) });
  mkAct({ party_id: c2.id, rfq_id: r2.id, kind: "task", subject: "Get heat-treatment price for the bracket", due_date: day(1) });
  mkAct({ lead_id: l5.id, party_id: c2.id, rfq_id: r4.id, kind: "meeting", subject: "Kick-off meeting after order", notes: "Agreed schedule and first delivery.", due_date: day(-12), done: true, done_at: nowIso() });
  syncFollow();

  function syncFollow() { S.leads.forEach((l) => { const d = S.acts.filter((a) => a.lead_id === l.id && !a.done && a.due_date).map((a) => a.due_date).sort()[0]; l.next_followup = d || null; }); }
  /* choose the supplier for a part: the price goes into the costing as an outsourced / bought-out line */
  function chooseSq(s, on) {
    const it = S.items.find((i) => i.id === s.item_id), c = it.cost && typeof it.cost === "object" ? it.cost : {};
    let outs = (Array.isArray(c.outs) ? c.outs : []).filter((o) => !o.sq);
    S.sqs.filter((x) => x.item_id === it.id).forEach((x) => (x.selected = false));
    if (on) { s.selected = true; outs = outs.concat([{ name: s.what + " — " + pName(s.supplier_id), amt: s.price, sq: s.id }]); }
    it.cost = Object.assign({}, c, { outs }); repriced(it); return it;
  }
  const sqOut = (s) => Object.assign(J(s), { supplier_name: pName(s.supplier_id), supplier_code: (S.parties.find((p) => p.id === s.supplier_id) || {}).code });
  const quoteOut = (q, full) => {
    const o = { id: q.id, no: q.no, rev: q.rev, rfq_id: q.rfq_id, rfq_no: (S.rfqs.find((r) => r.id === q.rfq_id) || {}).no, party_id: q.party_id, party_name: pName(q.party_id), quote_date: q.quote_date, valid_until: q.valid_until, status: q.status, currency: q.currency,
      tax_name: q.tax_name, tax_pct: q.tax_pct, subtotal: q.subtotal, tax_amt: q.tax_amt, total: q.total, sent_on: q.sent_on, decided_on: q.decided_on, sample: q.sample, updated_at: q.updated_at, items: q.lines.length };
    if (full) { const r = S.rfqs.find((x) => x.id === q.rfq_id) || {}; Object.assign(o, { contact_id: q.contact_id, payment_terms: q.payment_terms, delivery_terms: q.delivery_terms, terms: q.terms, remarks: q.remarks, lines: J(q.lines), prepared_by: q.prepared_by,
      party: J(S.parties.find((p) => p.id === q.party_id)), contact: J(S.contacts.find((c) => c.id === q.contact_id) || null), rfq_customer_ref: r.customer_ref || null, rfq_project: r.project || null }); }
    return J(o);
  };
  const leadOut = (l) => J(l), actOut = (a) => J(a);
  const rfqRow = (r) => { const p = party(r.party_id), its = S.items.filter((i) => i.rfq_id === r.id), lq = S.quotes.filter((z) => z.rfq_id === r.id).sort((a, b) => b.rev - a.rev)[0];
    return { id: r.id, no: r.no, customer_ref: r.customer_ref, party_id: r.party_id, party_name: p.name, party_code: p.code, received_on: r.received_on, due_on: r.due_on, status: r.status, priority: r.priority, owner: r.owner, project: r.project, sample: r.sample, currency: r.currency,
      items: its.length, value: val(r), unpriced: its.filter((i) => !i.unit_price).length, latest_quote: lq ? lq.no + " Rev " + lq.rev : null, overdue: !!(r.due_on && r.due_on < td() && ["Received", "Costing"].includes(r.status)), sort_open: OPEN.includes(r.status) }; };
  const includes = (a, q) => String(a || "").toLowerCase().includes(q);
  const stageOK = ["New", "Contacted", "Qualified", "RFQ received", "Quoted", "Negotiation", "Won", "Lost"];

  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_crm_enabled() { return true; },
    kmr_crm_load() {
      return { role: "admin", money: true, me: ME, today: td(), settings: J(S.settings), owners: [ME, "priya@demo.example", "marco@demo.example"],
        parties: S.parties.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, code: p.code, kind: p.kind, name: p.name, status: p.status })),
        contacts: S.contacts.map((c) => ({ id: c.id, party_id: c.party_id, name: c.name, designation: c.designation, email: c.email, phone: c.mobile || c.phone, is_primary: c.is_primary })) };
    },
    kmr_crm_settings_save(a) { const p = a.p || {}; const t = nm(p.tax_pct); if (t != null && (t < 0 || t > 100)) err("The tax percentage must be between 0 and 100."); S.settings = J(p); return null; },
    kmr_crm_party_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase();
      return S.parties.filter((x) => (!p.kind || x.kind === p.kind) && (!p.status || x.status === p.status) && (!q || includes(x.name, q) || includes(x.code, q) || includes(x.city, q) || includes(x.gstin, q))).sort((x, y) => x.name.localeCompare(y.name)).map((x) => {
        const cs = S.contacts.filter((c) => c.party_id === x.id).sort((u, v) => (v.is_primary ? 1 : 0) - (u.is_primary ? 1 : 0)), rs = S.rfqs.filter((r) => r.party_id === x.id);
        return { id: x.id, code: x.code, kind: x.kind, name: x.name, city: x.city, state: x.state, industry: x.industry, status: x.status, owner: x.owner, sample: x.sample, gstin: x.gstin, contacts: cs.length, rfqs: rs.length, open_rfqs: rs.filter((r) => OPEN.includes(r.status)).length,
          contact_name: cs[0] ? cs[0].name : null, contact_phone: cs[0] ? cs[0].mobile || cs[0].phone : null }; });
    },
    kmr_crm_party_get(a) {
      const x = party(a.p_id);
      return Object.assign(J(x), { can_edit: true, contacts: J(S.contacts.filter((c) => c.party_id === x.id).sort((u, v) => (v.is_primary ? 1 : 0) - (u.is_primary ? 1 : 0))),
        rfqs: S.rfqs.filter((r) => r.party_id === x.id).sort((u, v) => v.received_on.localeCompare(u.received_on)).map((r) => ({ id: r.id, no: r.no, customer_ref: r.customer_ref, status: r.status, received_on: r.received_on, due_on: r.due_on, value: val(r) })),
        leads: J(S.leads.filter((l) => l.party_id === x.id)), activities: J(S.acts.filter((y) => y.party_id === x.id).sort((u, v) => (u.done ? 1 : 0) - (v.done ? 1 : 0) || String(u.due_date || "9").localeCompare(String(v.due_date || "9")))) });
    },
    kmr_crm_party_save(a) {
      const p = a.p || {}; let x = p.id ? party(p.id) : null; const kd = T(p.kind) || "customer";
      if (!x && !T(p.name)) err("Enter the company name."); if ("name" in p && !T(p.name)) err("Enter the company name.");
      if (!["customer", "prospect", "supplier"].includes(kd)) err("Choose customer, prospect or supplier.");
      const cd = T(p.credit_days) === "" ? null : nm(p.credit_days); if (cd != null && (cd < 0 || cd > 365)) err("Credit days must be between 0 and 365.");
      if (S.parties.some((y) => y.id !== (x && x.id) && y.name.toLowerCase() === T(p.name).toLowerCase())) err(T(p.name) + " is already in the list.");
      const f = { kind: kd, name: T(p.name) || (x && x.name), industry: orNull(p.industry), gstin: orNull(p.gstin) && T(p.gstin).toUpperCase(), pan: orNull(p.pan) && T(p.pan).toUpperCase(), address: orNull(p.address), city: orNull(p.city), state: orNull(p.state), country: orNull(p.country) || "India", pincode: orNull(p.pincode),
        website: orNull(p.website), payment_terms: orNull(p.payment_terms), credit_days: cd, owner: orNull(p.owner), status: p.status || "active", notes: orNull(p.notes), updated_at: nowIso() };
      if (x) Object.assign(x, f); else { x = mkParty(Object.assign(f, { sample: false })); if (p.contact && T(p.contact.name)) mkContact(x.id, T(p.contact.name), orNull(p.contact.designation), orNull(p.contact.mobile) || orNull(p.contact.phone), orNull(p.contact.email)); }
      return J(x);
    },
    kmr_crm_party_delete(a) { const x = party(a.p_id); if (S.rfqs.some((r) => r.party_id === x.id) || S.quotes.some((q) => q.party_id === x.id) || S.sqs.some((s) => s.supplier_id === x.id)) err("This company is used in RFQs, quotations or supplier prices, so it cannot be deleted. Mark it inactive instead.");
      S.parties = S.parties.filter((p) => p !== x); S.contacts = S.contacts.filter((c) => c.party_id !== x.id); return null; },
    kmr_crm_contact_save(a) {
      const p = a.p || {}; if (!T(p.name)) err("Enter the contact's name."); let c = p.id ? S.contacts.find((x) => x.id === p.id) : null; const pid = c ? c.party_id : p.party_id; if (!pid || !S.parties.some((x) => x.id === pid)) err("Choose the company for this contact.");
      if (p.is_primary) S.contacts.filter((x) => x.party_id === pid && x !== c).forEach((x) => (x.is_primary = false));
      const f = { name: T(p.name), designation: orNull(p.designation), department: orNull(p.department), email: orNull(p.email), phone: orNull(p.phone), mobile: orNull(p.mobile), notes: orNull(p.notes) };
      if (c) Object.assign(c, f, { is_primary: !!p.is_primary }); else { c = mkContact(pid, f.name, f.designation, f.mobile, f.email); Object.assign(c, f); if (p.is_primary) c.is_primary = true; }
      return J(c);
    },
    kmr_crm_contact_delete(a) { S.contacts = S.contacts.filter((c) => c.id !== a.p_id); return null; },
    kmr_crm_lead_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase();
      return S.leads.filter((l) => (!p.stage || l.stage === p.stage) && (p.open !== true && p.open !== "true" || !["Won", "Lost"].includes(l.stage)) && (!p.owner || String(l.owner).toLowerCase() === String(p.owner).toLowerCase()) &&
        (!q || includes(l.no, q) || includes(l.company, q) || includes(l.contact_name, q) || includes(l.product_interest, q) || includes(l.phone, q))).sort((x, y) => String(x.next_followup || "9").localeCompare(String(y.next_followup || "9"))).map(leadOut);
    },
    kmr_crm_lead_get(a) { const l = S.leads.find((x) => x.id === a.p_id) || err("Lead not found."); return Object.assign(leadOut(l), { can_edit: true, rfqs: S.rfqs.filter((r) => r.lead_id === l.id).map((r) => ({ id: r.id, no: r.no, status: r.status })), activities: J(S.acts.filter((y) => y.lead_id === l.id)) }); },
    kmr_crm_lead_save(a) {
      const p = a.p || {}; let l = p.id ? S.leads.find((x) => x.id === p.id) : null; const st = T(p.stage) || "New", v = nm(p.value);
      if (!T(p.company)) err("Enter the company name."); if (!stageOK.includes(st)) err("Choose a stage from the list."); if (v != null && v < 0) err("The value cannot be negative."); if (st === "Lost" && !T(p.lost_reason)) err("Say why the lead was lost.");
      const f = { party_id: orNull(p.party_id), company: T(p.company), contact_name: orNull(p.contact_name), designation: orNull(p.designation), phone: orNull(p.phone), email: orNull(p.email), source: orNull(p.source), stage: st, product_interest: orNull(p.product_interest), value: v,
        expected_close: orNull(p.expected_close), owner: orNull(p.owner), next_followup: orNull(p.next_followup), lost_reason: st === "Lost" ? T(p.lost_reason) : null, notes: orNull(p.notes), updated_at: nowIso() };
      if (l) Object.assign(l, f, { closed_at: ["Won", "Lost"].includes(st) ? l.closed_at || nowIso() : null }); else l = mkLead(Object.assign(f, { owner: f.owner || ME, sample: false, closed_at: ["Won", "Lost"].includes(st) ? nowIso() : null }));
      return leadOut(l);
    },
    kmr_crm_lead_stage(a) { const l = S.leads.find((x) => x.id === a.p_id) || err("Lead not found."); if (!stageOK.includes(a.p_stage)) err("Choose a stage from the list."); if (a.p_stage === "Lost" && !T(a.p_reason)) err("Say why the lead was lost.");
      l.stage = a.p_stage; l.lost_reason = a.p_stage === "Lost" ? T(a.p_reason) : null; l.closed_at = ["Won", "Lost"].includes(l.stage) ? l.closed_at || nowIso() : null; return leadOut(l); },
    kmr_crm_lead_delete(a) { S.leads = S.leads.filter((l) => l.id !== a.p_id); S.acts = S.acts.filter((x) => x.lead_id !== a.p_id); return null; },
    kmr_crm_lead_to_rfq(a) {
      const l = S.leads.find((x) => x.id === a.p_id) || err("Lead not found."); let p = l.party_id ? party(l.party_id) : S.parties.find((x) => x.name.toLowerCase() === l.company.toLowerCase());
      if (!p) p = mkParty({ name: l.company, owner: l.owner, sample: false }); else if (p.kind === "prospect") p.kind = "customer";
      let c = l.contact_name ? S.contacts.find((x) => x.party_id === p.id && x.name.toLowerCase() === l.contact_name.toLowerCase()) : null; if (l.contact_name && !c) c = mkContact(p.id, l.contact_name, l.designation, l.phone, l.email);
      const r = mkRfq({ party_id: p.id, contact_id: c ? c.id : null, lead_id: l.id, owner: l.owner || ME, notes: l.product_interest, sample: false }); l.party_id = p.id; if (["New", "Contacted", "Qualified"].includes(l.stage)) l.stage = "RFQ received";
      return { rfq_id: r.id, rfq_no: r.no, party_id: p.id };
    },
    kmr_crm_act_list(a) {
      const p = a.p || {};
      return S.acts.filter((x) => (p.scope === "all" || !x.done) && (!p.lead_id || x.lead_id === p.lead_id) && (!p.party_id || x.party_id === p.party_id) && (!p.rfq_id || x.rfq_id === p.rfq_id) && (p.mine !== true && p.mine !== "true" || String(x.owner).toLowerCase() === ME))
        .sort((u, v) => (u.done ? 1 : 0) - (v.done ? 1 : 0) || String(u.due_date || "9").localeCompare(String(v.due_date || "9"))).map((x) => Object.assign(actOut(x), { party_name: pName(x.party_id), lead_company: (S.leads.find((l) => l.id === x.lead_id) || {}).company || null, rfq_no: (S.rfqs.find((r) => r.id === x.rfq_id) || {}).no || null }));
    },
    kmr_crm_act_save(a) {
      const p = a.p || {}; if (!T(p.subject)) err("Write what the call, visit or task is about."); const kd = T(p.kind) || "call"; if (!["call", "visit", "email", "meeting", "note", "task"].includes(kd)) err("Choose the kind of follow-up.");
      let x = p.id ? S.acts.find((y) => y.id === p.id) : null; const f = { kind: kd, subject: T(p.subject), notes: orNull(p.notes), due_date: orNull(p.due_date), owner: orNull(p.owner), done: !!p.done };
      if (x) Object.assign(x, f, { done_at: f.done ? x.done_at || nowIso() : null }); else x = mkAct(Object.assign(f, { lead_id: orNull(p.lead_id), party_id: orNull(p.party_id), rfq_id: orNull(p.rfq_id), owner: f.owner || ME, sample: false, done_at: f.done ? nowIso() : null }));
      syncFollow(); return actOut(x);
    },
    kmr_crm_act_done(a) { const x = S.acts.find((y) => y.id === a.p_id) || err("Follow-up not found."); x.done = a.p_done !== false; x.done_at = x.done ? nowIso() : null; syncFollow(); return actOut(x); },
    kmr_crm_act_delete(a) { S.acts = S.acts.filter((x) => x.id !== a.p_id); syncFollow(); return null; },
    kmr_crm_rfq_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase();
      return S.rfqs.map(rfqRow).filter((r) => (!p.status || r.status === p.status) && (!p.party_id || r.party_id === p.party_id) && (p.open !== true && p.open !== "true" || r.sort_open) &&
        (!q || includes(r.no, q) || includes(r.customer_ref, q) || includes(r.party_name, q) || includes(r.project, q) || S.items.some((i) => i.rfq_id === r.id && (includes(i.part_no, q) || includes(i.part_name, q)))))
        .sort((x, y) => (y.sort_open ? 1 : 0) - (x.sort_open ? 1 : 0) || String(x.due_on || "9").localeCompare(String(y.due_on || "9")));
    },
    kmr_crm_rfq_get(a) {
      const r = S.rfqs.find((x) => x.id === a.p_id) || err("RFQ not found.");
      return Object.assign(J(r), { party: J(party(r.party_id)), lead_no: (S.leads.find((l) => l.id === r.lead_id) || {}).no || null, can_edit: true, is_admin: true, money: true, items: S.items.filter((i) => i.rfq_id === r.id).sort((x, y) => x.seq - y.seq).map(itemOut),
        supplier_quotes: S.sqs.filter((s) => s.rfq_id === r.id).sort((x, y) => x.price - y.price).map(sqOut), quotes: S.quotes.filter((z) => z.rfq_id === r.id).sort((x, y) => y.rev - x.rev).map((z) => quoteOut(z, false)),
        activities: J(S.acts.filter((y) => y.rfq_id === r.id)) });
    },
    kmr_crm_rfq_save(a) {
      const p = a.p || {}; let r = p.id ? S.rfqs.find((x) => x.id === p.id) : null; const rec = orNull(p.received_on) || td(), due = orNull(p.due_on), pr = T(p.priority) || "Normal";
      if (!r && !p.party_id) err("Choose the customer who sent the RFQ."); if (!["Normal", "High", "Urgent"].includes(pr)) err("Choose the priority from the list."); if (due && due < rec) err("The due date is before the date the RFQ was received.");
      if (p.party_id) party(p.party_id); if (p.items && (!Array.isArray(p.items) || p.items.length > 300)) err("An RFQ can have up to 300 parts.");
      const f = { customer_ref: orNull(p.customer_ref), party_id: p.party_id || (r && r.party_id), contact_id: orNull(p.contact_id), received_on: rec, due_on: due, priority: pr, owner: orNull(p.owner), project: orNull(p.project), notes: orNull(p.notes) };
      if (r) Object.assign(r, f); else r = mkRfq(Object.assign(f, { lead_id: orNull(p.lead_id), owner: f.owner || ME, sample: false }));
      if (Array.isArray(p.items)) {
        const old = S.items.filter((i) => i.rfq_id === r.id), kept = [];
        p.items.forEach((x, n) => {
          if (!T(x.part_name)) err("Part " + (n + 1) + " has no name."); const q = nm(x.qty); if (q == null || q <= 0) err("Part " + (n + 1) + " needs a quantity above zero.");
          if ((nm(x.target_price) || 0) < 0 || (nm(x.annual_qty) || 0) < 0) err("Part " + (n + 1) + " has a negative target price or annual quantity.");
          let it = old.find((i) => i.id === x.id); const f2 = { seq: n + 1, part_no: orNull(x.part_no), part_name: T(x.part_name), drawing_no: orNull(x.drawing_no), revision: orNull(x.revision), material: orNull(x.material), qty: q, annual_qty: nm(x.annual_qty), uom: orNull(x.uom) || "Nos",
            target_price: nm(x.target_price), cost: x.cost && typeof x.cost === "object" ? J(x.cost) : {}, remarks: orNull(x.remarks) };
          if (it) Object.assign(it, f2); else { it = Object.assign({ id: id(), rfq_id: r.id, unit_cost: 0, unit_price: 0 }, f2); S.items.push(it); } repriced(it); kept.push(it.id);
        });
        S.items = S.items.filter((i) => i.rfq_id !== r.id || kept.includes(i.id)); S.sqs = S.sqs.filter((s) => S.items.some((i) => i.id === s.item_id));
      }
      return { id: r.id, no: r.no };
    },
    kmr_crm_rfq_status(a) {
      const r = S.rfqs.find((x) => x.id === a.p_id) || err("RFQ not found."); const st = a.p_status;
      if (!["Received", "Costing", "Quoted", "Negotiation", "Won", "Lost", "No quote"].includes(st)) err("Choose a status from the list.");
      if (["Lost", "No quote"].includes(st) && !T(a.p_reason)) err("Say why (price, delivery, capacity, customer cancelled…).");
      r.status = st; r.lost_reason = ["Lost", "No quote"].includes(st) ? T(a.p_reason) : null; r.decided_on = ["Won", "Lost", "No quote"].includes(st) ? r.decided_on || td() : null;
      const l = S.leads.find((x) => x.id === r.lead_id); if (l) { if (["Won", "Lost", "Quoted", "Negotiation"].includes(st)) l.stage = st; if (st === "Lost") l.lost_reason = T(a.p_reason); }
      return { id: r.id, status: r.status };
    },
    kmr_crm_rfq_delete(a) { const r = S.rfqs.find((x) => x.id === a.p_id) || err("RFQ not found."); S.items = S.items.filter((i) => i.rfq_id !== r.id); S.sqs = S.sqs.filter((s) => s.rfq_id !== r.id); S.quotes = S.quotes.filter((q) => q.rfq_id !== r.id); S.acts = S.acts.filter((x) => x.rfq_id !== r.id); S.rfqs = S.rfqs.filter((x) => x !== r); return null; },
    kmr_crm_sq_save(a) {
      const p = a.p || {}; let s = p.id ? S.sqs.find((x) => x.id === p.id) : null; const it = s ? S.items.find((i) => i.id === s.item_id) : S.items.find((i) => i.id === p.item_id); const wh = T(p.what) || "Bought-out part", pr = nm(p.price);
      if (!["Raw material", "Bought-out part", "Outsourced process", "Tooling", "Other"].includes(wh)) err("Choose what the supplier is quoting for."); if (pr == null || pr < 0) err("Enter the supplier's price per piece.");
      if (nm(p.moq) != null && nm(p.moq) < 0) err("MOQ cannot be negative."); if (nm(p.lead_days) != null && (nm(p.lead_days) < 0 || nm(p.lead_days) > 3650)) err("Lead time is in days, 0 to 3650."); if (!it) err("Choose the part this price is for.");
      let sid = p.supplier_id; if (!sid && T(p.supplier_name)) { const e = S.parties.find((x) => x.name.toLowerCase() === T(p.supplier_name).toLowerCase()); sid = e ? e.id : mkParty({ name: T(p.supplier_name), kind: "supplier", sample: false }).id; }
      if (!sid || !S.parties.some((x) => x.id === sid)) err("Choose the supplier or type a new supplier's name.");
      const f = { supplier_id: sid, what: wh, price: pr, moq: nm(p.moq), lead_days: nm(p.lead_days), valid_until: orNull(p.valid_until), payment_terms: orNull(p.payment_terms), quote_ref: orNull(p.quote_ref), received_on: orNull(p.received_on) || td(), notes: orNull(p.notes) };
      if (s) { Object.assign(s, f); if (s.selected) chooseSq(s, true); } else { s = Object.assign({ id: id(), rfq_id: it.rfq_id, item_id: it.id, selected: false, sample: false }, f); S.sqs.push(s); }
      return sqOut(s);
    },
    kmr_crm_sq_select(a) { const s = S.sqs.find((x) => x.id === a.p_id) || err("Supplier price not found."); return itemOut(chooseSq(s, a.p_on !== false)); },
    kmr_crm_sq_delete(a) { const s = S.sqs.find((x) => x.id === a.p_id) || err("Supplier price not found."); if (s.selected) chooseSq(s, false); S.sqs = S.sqs.filter((x) => x !== s); return null; },
    kmr_crm_quote_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase();
      return S.quotes.filter((z) => (!p.status || z.status === p.status) && (!p.rfq_id || z.rfq_id === p.rfq_id) && (!p.party_id || z.party_id === p.party_id) && (p.all === true || p.all === "true" || z.status !== "superseded") && (!q || includes(z.no, q) || includes(pName(z.party_id), q)))
        .sort((x, y) => y.quote_date.localeCompare(x.quote_date)).map((z) => Object.assign(quoteOut(z, false), { latest: z.rev === Math.max(...S.quotes.filter((o) => o.rfq_id === z.rfq_id).map((o) => o.rev)) }));
    },
    kmr_crm_quote_get(a) { const z = S.quotes.find((x) => x.id === a.p_id) || err("Quotation not found."); return Object.assign(quoteOut(z, true), { can_edit: true, is_admin: true, settings: J(S.settings), revisions: S.quotes.filter((x) => x.rfq_id === z.rfq_id && x.no === z.no).sort((u, v) => v.rev - u.rev).map((x) => ({ id: x.id, rev: x.rev, status: x.status, quote_date: x.quote_date, total: x.total })) }); },
    kmr_crm_quote_make(a) {
      const r = S.rfqs.find((x) => x.id === a.p_rfq) || err("RFQ not found."); if (["Lost", "No quote"].includes(r.status)) err("This RFQ is closed (" + r.status.toLowerCase() + "). Reopen it before quoting.");
      const dr = S.quotes.filter((z) => z.rfq_id === r.id && z.status === "draft").sort((u, v) => v.rev - u.rev)[0]; if (dr) return Object.assign(quoteOut(dr, false), { existing: true });
      const lines = quoteLines(r.id, null); if (!lines.length) err("Price at least one part in the RFQ (costing sheet) before making a quotation.");
      const last = S.quotes.filter((z) => z.rfq_id === r.id).sort((u, v) => v.rev - u.rev)[0]; let no, rev = 0; if (last) { no = last.no; rev = last.rev + 1; S.quotes.filter((z) => z.rfq_id === r.id && ["sent", "rejected"].includes(z.status)).forEach((z) => (z.status = "superseded")); } else no = number("QTN");
      const s = S.settings, z = mkQuote({ no, rev, rfq_id: r.id, party_id: r.party_id, contact_id: r.contact_id, valid_until: day(nm(s.validity_days) || 30), currency: r.currency, tax_name: s.tax_name || "GST", tax_pct: nm(s.tax_pct) || 0,
        payment_terms: orNull(s.payment_terms) || party(r.party_id).payment_terms, delivery_terms: orNull(s.delivery_terms), terms: orNull(s.terms), lines, sample: false });
      if (r.status === "Received") r.status = "Costing"; return quoteOut(z, false);
    },
    kmr_crm_quote_save(a) {
      const p = a.p || {}, z = S.quotes.find((x) => x.id === p.id) || err("Quotation not found."); if (z.status !== "draft") err("This quotation is " + z.status + " and cannot be edited. Make a new revision instead.");
      const tx = nm(p.tax_pct); if (tx == null || tx < 0 || tx > 100) err("The tax percentage must be between 0 and 100."); const lines = p.lines || z.lines; if (!Array.isArray(lines) || !lines.length) err("A quotation needs at least one line.");
      const clean = lines.map((l, n) => { if (!T(l.part_name)) err("Line " + (n + 1) + " has no part name."); if (!(C.pos(l.qty) > 0)) err("Line " + (n + 1) + " needs a quantity above zero."); if (nm(l.unit_price) == null || nm(l.unit_price) < 0) err("Line " + (n + 1) + " needs a price.");
        return { seq: n + 1, part_no: orNull(l.part_no), part_name: T(l.part_name), drawing_no: orNull(l.drawing_no), revision: orNull(l.revision), qty: C.pos(l.qty), uom: orNull(l.uom) || "Nos", unit_price: C.pos(l.unit_price), lead_days: nm(l.lead_days), remarks: orNull(l.remarks) }; });
      Object.assign(z, { contact_id: orNull(p.contact_id), quote_date: orNull(p.quote_date) || z.quote_date, valid_until: orNull(p.valid_until), tax_name: orNull(p.tax_name) || "GST", tax_pct: tx, payment_terms: orNull(p.payment_terms), delivery_terms: orNull(p.delivery_terms), terms: orNull(p.terms), remarks: orNull(p.remarks), lines: clean, updated_at: nowIso() });
      const t = C.totals(clean, tx); z.subtotal = t.sub; z.tax_amt = t.tax; z.total = t.tot; return quoteOut(z, true);
    },
    kmr_crm_quote_status(a) {
      const z = S.quotes.find((x) => x.id === a.p_id) || err("Quotation not found."); const st = a.p_status, ok = (z.status === "draft" && st === "sent") || (z.status === "sent" && ["accepted", "rejected"].includes(st)) || (["accepted", "rejected"].includes(z.status) && st === "sent");
      if (!ok) err("A " + z.status + " quotation cannot be changed to " + st + "."); if (st === "sent" && (!z.lines.length || z.total <= 0)) err("Add prices before the quotation is marked as sent.");
      z.status = st; if (st === "sent") z.sent_on = z.sent_on || td(); z.decided_on = ["accepted", "rejected"].includes(st) ? td() : null; z.updated_at = nowIso();
      const r = S.rfqs.find((x) => x.id === z.rfq_id), l = r && S.leads.find((x) => x.id === r.lead_id);
      if (st === "sent" && r && ["Received", "Costing"].includes(r.status)) r.status = "Quoted"; if (st === "sent" && l && ["New", "Contacted", "Qualified", "RFQ received"].includes(l.stage)) l.stage = "Quoted";
      if (st === "accepted" && r) { r.status = "Won"; r.decided_on = td(); r.lost_reason = null; if (l) l.stage = "Won"; } return quoteOut(z, false);
    },
    kmr_crm_quote_delete(a) { const z = S.quotes.find((x) => x.id === a.p_id) || err("Quotation not found."); if (z.status === "accepted") err("An accepted quotation cannot be deleted. Change its status first."); S.quotes = S.quotes.filter((x) => x !== z); return null; },
    kmr_crm_dashboard() {
      const t = td(), won = S.rfqs.filter((r) => r.status === "Won").length, lost = S.rfqs.filter((r) => r.status === "Lost").length, openL = S.leads.filter((l) => !["Won", "Lost"].includes(l.stage)), by = {};
      S.leads.forEach((l) => { const o = by[l.stage] || (by[l.stage] = { n: 0, value: 0 }); o.n++; o.value += l.value || 0; });
      const lr = {}; S.rfqs.filter((r) => ["Lost", "No quote"].includes(r.status)).forEach((r) => { const k = r.lost_reason || "Not stated"; lr[k] = (lr[k] || 0) + 1; });
      const open = S.acts.filter((x) => !x.done);
      return { leads_open: openL.length, pipeline_value: openL.reduce((s, l) => s + (l.value || 0), 0), by_stage: by, followups_due: open.filter((x) => x.due_date && x.due_date <= t).length, followups_overdue: open.filter((x) => x.due_date && x.due_date < t).length,
        rfq_open: S.rfqs.filter((r) => OPEN.includes(r.status)).length, rfq_to_quote: S.rfqs.filter((r) => ["Received", "Costing"].includes(r.status)).length, rfq_overdue: S.rfqs.filter((r) => r.due_on && r.due_on < t && ["Received", "Costing"].includes(r.status)).length,
        quotes_out_value: S.quotes.filter((q) => q.status === "sent").reduce((s, q) => s + q.total, 0), quotes_out: S.quotes.filter((q) => q.status === "sent").length,
        won_value_90: S.quotes.filter((q) => q.status === "accepted" && q.decided_on >= day(-90)).reduce((s, q) => s + q.total, 0), win_rate: won + lost ? Math.round((won * 100) / (won + lost)) : null, won, lost,
        due_soon: S.rfqs.filter((r) => ["Received", "Costing"].includes(r.status)).sort((x, y) => String(x.due_on || "9").localeCompare(String(y.due_on || "9"))).slice(0, 8).map((r) => ({ id: r.id, no: r.no, party_name: pName(r.party_id), due_on: r.due_on, status: r.status, priority: r.priority })),
        next_actions: open.sort((x, y) => String(x.due_date || "9").localeCompare(String(y.due_date || "9"))).slice(0, 8).map((x) => ({ id: x.id, kind: x.kind, subject: x.subject, due_date: x.due_date, owner: x.owner, party_name: pName(x.party_id), lead_company: (S.leads.find((l) => l.id === x.lead_id) || {}).company || null, lead_id: x.lead_id, party_id: x.party_id, rfq_id: x.rfq_id })), lost_reasons: lr };
    }
  });
})();
