/* CRM & RFQ - printed forms: Quotation, RFQ costing sheet (internal), Supplier price comparison, RFQ register, Lead register.
   Each form is built inside the standard report frame (AIAGForm.wrap): customer logo top-left, unique report ref. no., format no. / revision / date at the foot of every page. */
(function () {
  "use strict";
  const A = window.AIAGForm, C = window.CRMCalc, esc = A.esc;
  const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : s ? esc(s) : "—"; };
  const nl = (s) => esc(s).replace(/\n/g, "<br>");
  const n2 = (v) => C.inr(v, 2), n0 = (v) => C.inr(v, 0), q = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 }));
  const co = () => (window.QP && QP.ctx && QP.ctx.company) || "";
  const set = (key, doc) => { if (window.KMRReport) KMRReport.set({ key, doc: doc || "", inForm: true }); };
  const cell = (v, c) => `<td class="${c || ""}">${v == null || v === "" ? "—" : v}</td>`;
  const addr = (p) => [p.address, [p.city, p.pincode].filter(Boolean).join(" "), p.state].filter(Boolean).join(", ");

  /* ---------- Quotation (goes to the customer: no costs, no supplier names) ---------- */
  function quote(z) {
    set("quote", z.no + " Rev " + z.rev);
    const s = z.settings || {}, p = z.party || {}, c = z.contact || {}, cur = z.currency || "INR", tn = z.tax_name || "GST";
    const t = C.totals(z.lines, z.tax_pct), showLead = z.lines.some((l) => l.lead_days != null), cs = (showLead ? 8 : 7);
    const rows = z.lines.map((l, i) => `<tr>${cell(i + 1, "c")}${cell(esc(l.part_no))}${cell("<b>" + esc(l.part_name) + "</b>" + (l.drawing_no ? "<br>Drg " + esc(l.drawing_no) + (l.revision ? " rev " + esc(l.revision) : "") : "") + (l.remarks ? "<br>" + esc(l.remarks) : ""))}${cell(q(l.qty), "n")}${cell(esc(l.uom), "c")}${cell(n2(l.unit_price), "n")}${showLead ? cell(l.lead_days != null ? l.lead_days + " days" : "—", "c") : ""}${cell(n2(C.rnd(C.pos(l.qty) * C.pos(l.unit_price), 2)), "n")}</tr>`).join("");
    const col = showLead ? [5, 13, 31, 9, 6, 11, 9, 16] : [5, 14, 36, 10, 7, 12, 16];
    const inner = A.title("QUOTATION", esc(s.company_address || co())) +
      A.head([[["Quotation no.", "<b>" + esc(z.no) + "</b>"], ["Revision", esc(String(z.rev).padStart(2, "0"))], ["Date", dmy(z.quote_date)]],
        [["Your RFQ ref.", esc(z.rfq_customer_ref)], ["Our RFQ no.", esc(z.rfq_no)], ["Valid until", dmy(z.valid_until)]]]) +
      A.sec("From") + `<table><tbody><tr><td style="width:50%"><b>${esc(co())}</b><br>${nl(s.company_address)}${s.company_gstin ? "<br>GSTIN " + esc(s.company_gstin) : ""}${s.company_phone ? "<br>Tel " + esc(s.company_phone) : ""}${s.company_email ? "<br>" + esc(s.company_email) : ""}</td>
        <td><b>To: ${esc(p.name)}</b><br>${esc(addr(p))}${p.gstin ? "<br>GSTIN " + esc(p.gstin) : ""}${c.name ? "<br>Kind attention: <b>" + esc(c.name) + "</b>" + (c.designation ? ", " + esc(c.designation) : "") : ""}</td></tr></tbody></table>` +
      (z.rfq_project ? `<div class="note">Reference: ${esc(z.rfq_project)}</div>` : "") +
      A.sec("Prices") + `<table><colgroup>${col.map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th class="c">#</th><th>Part no.</th><th>Description</th><th class="c">Qty</th><th class="c">Unit</th><th class="c">Rate (${esc(cur)})</th>${showLead ? '<th class="c">Lead time</th>' : ""}<th class="c">Amount (${esc(cur)})</th></tr></thead><tbody>${rows}
        <tr><td colspan="${cs - 1}" class="n"><b>Sub-total</b></td>${cell(n2(t.sub), "n")}</tr><tr><td colspan="${cs - 1}" class="n">${esc(tn)} @ ${q(z.tax_pct)}%</td>${cell(n2(t.tax), "n")}</tr><tr><td colspan="${cs - 1}" class="n"><b>Total (${esc(cur)})</b></td><td class="n"><b>${n2(t.tot)}</b></td></tr></tbody></table>` +
      `<div class="note"><b>Amount in words:</b> ${cur === "INR" ? esc(C.words(t.tot)) : "—"}</div>` +
      A.sec("Commercial terms") + A.head([[["Payment", esc(z.payment_terms)], ["Delivery", esc(z.delivery_terms)]]]) +
      (z.terms ? `<div class="sub">Terms and conditions</div><div class="note" style="font-size:10.5px;color:#000">${nl(z.terms)}</div>` : "") + (z.remarks ? `<div class="sub">Remarks</div><div class="note" style="color:#000">${nl(z.remarks)}</div>` : "") +
      (s.bank_details ? `<div class="sub">Bank details</div><div class="note" style="color:#000">${nl(s.bank_details)}</div>` : "") +
      `<table class="avoid" style="margin-top:14px"><tbody><tr><td style="width:55%;height:60px;vertical-align:top">Customer acceptance (sign, stamp and date)</td><td style="vertical-align:bottom;text-align:center">For <b>${esc(co())}</b><br><br><br><b>${esc(s.signatory)}</b>${s.signatory_title ? "<br>" + esc(s.signatory_title) : ""}</td></tr></tbody></table>`;
    return A.wrap("port", inner);
  }

  /* ---------- Costing sheet: internal, one block per part ---------- */
  function costing(r) {
    set("costing", r.no);
    const cur = r.currency || "INR", rowsOf = (it) => {
      const k = C.cost(it.cost), tg = it.target_price, pf = C.profit(it.cost), o = (it.cost && it.cost.ops) || [];
      const L = (n, v, b) => `<tr><td${b ? ' style="font-weight:700"' : ""}>${n}</td><td class="n"${b ? ' style="font-weight:700"' : ""}>${n2(v)}</td></tr>`;
      return `<div class="blk avoid"><div class="sub">${esc(it.seq)}. ${esc(it.part_no || "")} ${esc(it.part_name)} — qty ${q(it.qty)} ${esc(it.uom)}${it.annual_qty ? " (annual " + q(it.annual_qty) + ")" : ""}${it.material ? " · " + esc(it.material) : ""}${it.drawing_no ? " · Drg " + esc(it.drawing_no) + (it.revision ? " rev " + esc(it.revision) : "") : ""}</div>
        <div class="two"><table><thead><tr><th>Cost per piece</th><th class="c">${esc(cur)}</th></tr></thead><tbody>${L("Material (" + q(it.cost.mat_wt) + " kg × " + q(it.cost.mat_rate) + ", scrap " + q(it.cost.scrap_pct || 0) + "%)", k.material)}${L("Machining / process" + (o.length ? " (" + o.map((x) => esc(x.name)).join(", ") + ")" : ""), k.process)}${L("Outsourced / bought-out", k.outsourced)}${L("Tooling (" + q(it.cost.tool_cost || 0) + " over " + q(it.cost.tool_qty || 0) + " pcs)", k.tooling)}${L("Packing", k.packing)}${L("Freight", k.freight)}${L("Other", k.other)}${L("Cost", k.cost, 1)}${L("Overhead @ " + q(it.cost.oh_pct || 0) + "%", k.overhead)}${L("Total cost", k.total_cost, 1)}</tbody></table>
        <table><thead><tr><th>Price</th><th class="c">${esc(cur)}</th></tr></thead><tbody>${L("Margin @ " + q(it.cost.margin_pct || 0) + "%", k.price_calc - k.total_cost)}${L("Calculated price", k.price_calc)}${it.cost.price_override > 0 ? L("Price typed in", k.price) : ""}${L("Quoted price per piece", k.price, 1)}${L("Order value", C.rnd(k.price * C.pos(it.qty), 2))}<tr><td>Profit on price</td><td class="n">${n2(pf.amount)} (${pf.pct}%)</td></tr><tr><td>Customer target price</td><td class="n${tg != null && k.price > tg ? " fl" : ""}">${tg != null ? n2(tg) + (k.price > tg ? " — above target" : " — within target") : "—"}</td></tr></tbody></table></div></div>`;
    };
    const items = r.items || [], tot = items.reduce((s, i) => s + C.rnd(C.pos(i.qty) * i.unit_price, 2), 0);
    const inner = A.title("RFQ COSTING SHEET", "INTERNAL — NOT FOR THE CUSTOMER") +
      A.head([[["RFQ no.", "<b>" + esc(r.no) + "</b>"], ["Customer", esc(r.party && r.party.name)], ["Customer RFQ ref.", esc(r.customer_ref)]], [["Received", dmy(r.received_on)], ["Quote due", dmy(r.due_on)], ["Project", esc(r.project)]]]) +
      A.sec("Parts") + (items.length ? items.map(rowsOf).join("") : '<div class="note">No parts yet.</div>') +
      `<div class="box avoid"><b>Total order value at quoted prices (before tax): ${esc(cur)} ${n2(tot)}</b></div>` + A.signoff();
    return A.wrap("port", inner);
  }

  /* ---------- Supplier price comparison: one table per part, best price marked ---------- */
  function compare(r, today) {
    set("compare", r.no);
    const blocks = (r.items || []).map((it) => {
      const cmp = C.compare((r.supplier_quotes || []).filter((s) => s.item_id === it.id), it.qty, today);
      if (!cmp.rows.length) return `<div class="blk avoid"><div class="sub">${esc(it.seq)}. ${esc(it.part_no || "")} ${esc(it.part_name)} — qty ${q(it.qty)}</div><div class="note">No supplier prices entered.</div></div>`;
      const rows = cmp.rows.slice().sort((a, b) => a.price - b.price).map((s) => `<tr><td>${esc(s.supplier_name)}${s.id === cmp.best ? " <b>(lowest valid)</b>" : ""}${s.selected ? " <b>✔ chosen</b>" : ""}</td>${cell(esc(s.what))}${cell(n2(s.price), "n" + (s.id === cmp.best ? " sg" : ""))}${cell(s.moq != null ? q(s.moq) : "—", "n")}${cell(s.lead_days != null ? s.lead_days + " d" : "—", "c")}${cell(dmy(s.valid_until), "c")}${cell(esc(s.payment_terms))}${cell(s.flags.length ? esc(s.flags.join("; ")) : "—")}</tr>`).join("");
      return `<div class="blk avoid"><div class="sub">${esc(it.seq)}. ${esc(it.part_no || "")} ${esc(it.part_name)} — qty ${q(it.qty)}${cmp.spread ? " · price spread " + n2(cmp.spread) + " per piece" : ""}</div><table><thead><tr><th>Supplier</th><th>For</th><th class="c">Price</th><th class="c">MOQ</th><th class="c">Lead</th><th class="c">Valid until</th><th>Payment</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");
    return A.wrap("port", A.title("SUPPLIER PRICE COMPARISON", "Raw material, bought-out parts and outsourced processes") +
      A.head([[["RFQ no.", "<b>" + esc(r.no) + "</b>"], ["Customer", esc(r.party && r.party.name)], ["Project", esc(r.project)]]]) + A.sec("Quotes received") + (blocks || '<div class="note">No parts yet.</div>') + A.signoff());
  }

  /* ---------- registers ---------- */
  function rfqs(list, filt) {
    set("rfqs", "");
    const rows = list.map((r) => `<tr>${cell("<b>" + esc(r.no) + "</b>")}${cell(esc(r.customer_ref))}${cell(esc(r.party_name))}${cell(dmy(r.received_on), "c")}${cell(dmy(r.due_on), "c")}${cell(esc(r.status), "c" + (r.overdue ? " fl" : ""))}${cell(esc(r.priority), "c")}${cell(String(r.items), "n")}${cell(r.value ? n0(r.value) : "—", "n")}${cell(esc(r.latest_quote))}</tr>`).join("");
    return A.wrap("port", A.title("RFQ REGISTER", "Requests for quotation received from customers") + A.head([[["Filter", esc(filt || "All")], ["RFQs", String(list.length)], ["Value", C.lakh(list.reduce((s, r) => s + (r.value || 0), 0))]]]) + A.sec("RFQs") +
      `<table><colgroup>${[12, 11, 18, 8, 8, 9, 7, 5, 10, 12].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>RFQ no.</th><th>Their ref.</th><th>Customer</th><th class="c">Received</th><th class="c">Due</th><th class="c">Status</th><th class="c">Priority</th><th class="c">Parts</th><th class="c">Value</th><th>Latest quote</th></tr></thead><tbody>${rows || '<tr><td colspan="10">None.</td></tr>'}</tbody></table>`);
  }
  function leads(list, filt) {
    set("leads", "");
    const rows = list.map((l) => `<tr>${cell("<b>" + esc(l.no) + "</b>")}${cell(esc(l.company))}${cell(esc(l.contact_name) + (l.phone ? "<br>" + esc(l.phone) : ""))}${cell(esc(l.product_interest))}${cell(esc(l.stage), "c")}${cell(l.value ? n0(l.value) : "—", "n")}${cell(dmy(l.next_followup), "c")}${cell(esc(l.owner))}</tr>`).join("");
    return A.wrap("port", A.title("LEAD REGISTER", "Sales leads and their stage") + A.head([[["Filter", esc(filt || "All")], ["Leads", String(list.length)], ["Value", C.lakh(list.reduce((s, l) => s + (l.value || 0), 0))]]]) + A.sec("Leads") +
      `<table><colgroup>${[11, 17, 16, 20, 9, 9, 9, 9].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>Lead</th><th>Company</th><th>Contact</th><th>Interest</th><th class="c">Stage</th><th class="c">Value</th><th class="c">Follow-up</th><th>Owner</th></tr></thead><tbody>${rows || '<tr><td colspan="8">None.</td></tr>'}</tbody></table>`);
  }
  window.CRMDocs = { quote, costing, compare, rfqs, leads };
})();
