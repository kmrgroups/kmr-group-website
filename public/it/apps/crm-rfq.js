/* CRM & RFQ - RFQ register, the one-screen RFQ page (parts, costing sheet, supplier prices), Quotations and Setup.
   Core helpers come from crm-app.js (window.CRM). Sums are in crm-calc.js; the database repeats them when it saves. */
(function () {
  "use strict";
  const K = window.CRM, { S, C, RST, QST, esc, fmt, say, call, V, opts, fld, chip, due, hasF, today, canEdit, isAdmin, guard, openM, closeM, ask, showDoc, go, $ } = K;
  const inr = (v, d) => C.inr(v, d == null ? 2 : d), PRI = ["Normal", "High", "Urgent"], WHAT = ["Raw material", "Bought-out part", "Outsourced process", "Tooling", "Other"];
  const closed = (r) => ["Won", "Lost", "No quote"].includes(r.status);
  let R = null, Q = null; const OPEN = new Set();

  /* ================= RFQ register ================= */
  async function drawRfqs() {
    const f = S.f.rfq, p = { q: f.q }; if (f.status === "open") p.open = true; else if (f.status) p.status = f.status;
    const list = await call("kmr_crm_rfq_list", { p }), el = $("#rfq"), can = canEdit();
    el.innerHTML = `<p class="guide">An RFQ is a customer asking you for a price. Open one to enter the parts, cost them, collect supplier prices and make the quotation.</p>
      <div class="stg">${[["open", "Open"], ["", "All"]].concat(["Received", "Costing", "Quoted", "Negotiation", "Won", "Lost", "No quote"].map((s) => [s, s])).map(([k, t]) => `<button data-st="${esc(k)}" class="${f.status === k ? "on" : ""}">${esc(t)}</button>`).join("")}</div>
      <div class="row"><input class="grow" id="rq" placeholder="Search RFQ no., customer, their reference, part…" value="${esc(f.q)}">${can ? '<button class="btn" id="r_new">New RFQ</button>' : ""}<button class="btn o" id="r_pr">Print register</button></div>
      ${list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>RFQ</th><th>Customer</th><th>Their ref.</th><th>Received</th><th>Quote by</th><th>Status</th><th>Parts</th><th>Value</th><th>Latest quotation</th></tr></thead><tbody>${list.map((r) => `<tr data-open="${r.id}"><td><b>${esc(r.no)}</b>${r.priority !== "Normal" ? " " + chip(r.priority, r.priority === "Urgent" ? "r" : "a") : ""}${r.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${esc(r.party_name)}</td><td>${esc(r.customer_ref || "")}</td><td>${fmt(r.received_on)}</td><td>${r.due_on ? (r.overdue ? '<span class="late">' + fmt(r.due_on) + " · late</span>" : fmt(r.due_on)) : "—"}</td><td>${chip(r.status, RST[r.status])}</td><td>${r.items}${r.unpriced ? ` <small class="late">${r.unpriced} unpriced</small>` : ""}</td><td>${r.value ? C.lakh(r.value) : "—"}</td><td>${esc(r.latest_quote || "—")}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty">No RFQs here.<br>' + (can ? "Press New RFQ when a customer asks for a price." : "") + "</div>"}`;
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; drawRfqs(); }));
    let t; $("#rq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; drawRfqs().then(() => { const i = $("#rq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    if (can) $("#r_new").onclick = () => { if (!hasF("crm.rfq-costing")) { KMRLock.need("crm.rfq-costing"); return; } go("go=rfq&new=1"); };
    $("#r_pr").onclick = () => showDoc(CRMDocs.rfqs(list, f.status === "open" ? "Open RFQs" : f.status || "All"));
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => go("go=rfq&id=" + r.dataset.open)));
  }

  /* ================= RFQ page ================= */
  const blankItem = () => ({ id: null, part_no: "", part_name: "", drawing_no: "", revision: "", material: "", qty: "", annual_qty: "", uom: "Nos", target_price: "", remarks: "", unit_price: 0, cost: C.blankCost({ oh_pct: S.L.settings.default_oh, margin_pct: S.L.settings.default_margin }) });
  function normItem(it) {
    it.cost = it.cost && typeof it.cost === "object" && !Array.isArray(it.cost) ? it.cost : {}; if (!Array.isArray(it.cost.ops)) it.cost.ops = []; if (!Array.isArray(it.cost.outs)) it.cost.outs = [];
    ["part_no", "drawing_no", "revision", "material", "remarks", "uom"].forEach((k) => { if (it[k] == null) it[k] = ""; }); ["qty", "annual_qty", "target_price"].forEach((k) => { if (it[k] == null) it[k] = ""; }); return it;
  }
  async function drawRfq(hp) {
    if (hp.new) { R = { id: null, no: "New RFQ", status: "Received", party_id: hp.party || "", contact_id: "", customer_ref: "", received_on: today(), due_on: "", priority: "Normal", owner: S.L.me, project: "", notes: "", currency: S.L.settings.currency || "INR", items: [normItem(blankItem())], supplier_quotes: [], quotes: [], activities: [], can_edit: canEdit(), is_admin: isAdmin(), money: S.L.money, lead_id: hp.lead || null }; OPEN.clear(); OPEN.add(0); }
    else { const keep = R && R.id === hp.id; R = await call("kmr_crm_rfq_get", { p_id: hp.id }); R.items.forEach(normItem); if (!keep) { OPEN.clear(); if (R.items.length === 1) OPEN.add(0); } }
    if (!R.items.length && R.can_edit) { R.items.push(normItem(blankItem())); OPEN.add(0); }
    S.dirty = false; renderRfq();
  }
  const ed = () => !!(R && R.can_edit && (!closed(R) || R.is_admin));
  const itemTot = () => R.items.reduce((s, it) => s + C.rnd(C.pos(it.qty) * (R.money ? C.cost(it.cost).price : C.pos(it.unit_price)), 2), 0);
  const priceOf = (it) => (R.money ? C.cost(it.cost).price : C.pos(it.unit_price));
  function snapshotOpen() { document.querySelectorAll("#rfqp details.part").forEach((d) => { const i = +d.dataset.i; if (d.open) OPEN.add(i); else OPEN.delete(i); }); }

  function sumHtml(it) {
    const k = C.cost(it.cost), pf = C.profit(it.cost), tg = C.num(it.target_price), n = (v) => inr(v), over = tg != null && k.price > tg;
    return `<div><span>Material</span><b>${n(k.material)}</b></div><div><span>Machining</span><b>${n(k.process)}</b></div><div><span>Outsourced</span><b>${n(k.outsourced)}</b></div><div><span>Tooling, packing, freight</span><b>${n(k.tooling + k.packing + k.freight + k.other)}</b></div><div><span>Overhead</span><b>${n(k.overhead)}</b></div><div><span>Total cost</span><b>${n(k.total_cost)}</b></div>
      <div class="pr"><span>Price per piece</span><b>${n(k.price)}</b></div><div><span>Profit on price</span><b class="${pf.pct >= 0 ? "good" : "bad"}">${pf.pct}%</b><small>${n(pf.amount)} per piece</small></div>${tg != null ? `<div><span>Customer target</span><b class="${over ? "bad" : "good"}">${n(tg)}</b><small>${over ? "price is above target" : "within target"}</small></div>` : ""}`;
  }
  function partHead(it, i) {
    const k = R.money ? C.cost(it.cost) : null, tg = C.num(it.target_price);
    return `<span class="pn">${i + 1}</span><span id="ph-no-${i}"><b>${esc(it.part_no || "")}</b></span><span id="ph-nm-${i}">${esc(it.part_name || "New part — enter the name")}</span><span class="hm" id="ph-q-${i}">${it.qty ? "Qty " + inr(it.qty, 0) : ""}</span><span class="hm" id="ph-c-${i}">${k ? "Cost " + inr(k.total_cost) : ""}</span><span class="hm">${tg != null ? "Target " + inr(tg) : ""}</span><span class="pp" id="ph-p-${i}">${inr(priceOf(it))}<small>per piece</small></span>`;
  }
  function inp(i, k, label, ex, cls) { const it = R.items[i]; return `<div${cls ? ` class="${cls}"` : ""}><label>${label}</label><input data-i="${i}" data-k="${k}" value="${esc(it[k] == null ? "" : it[k])}" ${ex || ""}></div>`; }
  function cin(i, k, label, ex) { return `<div><label>${label}</label><input data-i="${i}" data-c="${k}" inputmode="decimal" value="${esc(R.items[i].cost[k] == null ? "" : R.items[i].cost[k])}" ${ex || ""}></div>`; }
  function partHtml(it, i) {
    const dis = ed() ? "" : " disabled", c = it.cost, m = R.money;
    let h = `<details class="part" data-i="${i}"${OPEN.has(i) ? " open" : ""}><summary>${partHead(it, i)}</summary><div class="pb"><fieldset style="border:0;padding:0;margin:0"${dis}>
      <div class="cg">${inp(i, "part_no", "Part number")}${inp(i, "part_name", "Part name")}${inp(i, "drawing_no", "Drawing number")}${inp(i, "revision", "Drawing rev.")}${inp(i, "material", "Material")}${inp(i, "qty", "Quantity per order", 'inputmode="decimal"')}${inp(i, "annual_qty", "Annual quantity", 'inputmode="decimal"')}${inp(i, "uom", "Unit")}${inp(i, "target_price", "Customer target price", 'inputmode="decimal"')}${inp(i, "remarks", "Remarks")}</div>`;
    if (m) {
      h += `<div class="cs"><h5>1 · Material</h5><div class="cg">${cin(i, "mat_wt", "Weight per piece (kg)")}${cin(i, "mat_rate", "Rate per kg (₹)")}${cin(i, "scrap_pct", "Scrap / yield loss (%)")}${cin(i, "mat_other", "Other material per piece (₹)")}</div></div>
        <div class="cs"><h5>2 · Machining and other operations</h5>${(c.ops || []).map((o, j) => `<div class="opr"><input data-i="${i}" data-op="${j}" data-f="name" placeholder="Operation (e.g. CNC turning)" value="${esc(o.name || "")}"><input data-i="${i}" data-op="${j}" data-f="min" inputmode="decimal" placeholder="Minutes" value="${esc(o.min == null ? "" : o.min)}"><input data-i="${i}" data-op="${j}" data-f="rate" inputmode="decimal" placeholder="Rate ₹/hour" value="${esc(o.rate == null ? "" : o.rate)}"><div class="v" id="opv-${i}-${j}">${inr((C.pos(o.min) * C.pos(o.rate)) / 60)}</div>${ed() ? `<button class="btn o s" data-act="delop" data-i="${i}" data-j="${j}">✕</button>` : "<span></span>"}</div>`).join("")}${ed() ? `<button class="btn o s" data-act="addop" data-i="${i}">+ Add operation</button>` : ""}</div>
        <div class="cs"><h5>3 · Outsourced work and bought-out items</h5>${(c.outs || []).map((o, j) => o.sq ? `<div class="opr"><span style="grid-column:1/3">${esc(o.name)} <small class="mut">(chosen supplier price)</small></span><span></span><div class="v">${inr(o.amt)}</div><span></span></div>` : `<div class="opr"><input data-i="${i}" data-ou="${j}" data-f="name" placeholder="What (e.g. heat treatment)" value="${esc(o.name || "")}"><input data-i="${i}" data-ou="${j}" data-f="amt" inputmode="decimal" placeholder="₹ per piece" value="${esc(o.amt == null ? "" : o.amt)}"><span></span><span></span>${ed() ? `<button class="btn o s" data-act="delout" data-i="${i}" data-j="${j}">✕</button>` : "<span></span>"}</div>`).join("")}${ed() ? `<button class="btn o s" data-act="addout" data-i="${i}">+ Add outsourced item</button>` : ""}</div>
        <div class="cs"><h5>4 · Tooling, packing, freight and margin</h5><div class="cg">${cin(i, "tool_cost", "Tooling / fixture cost (₹)")}${cin(i, "tool_qty", "Pieces the tool will make")}${cin(i, "packing", "Packing per piece (₹)")}${cin(i, "freight", "Freight per piece (₹)")}${cin(i, "other", "Other cost per piece (₹)")}${cin(i, "oh_pct", "Overhead (%)")}${cin(i, "margin_pct", "Profit margin (%)")}${cin(i, "price_override", "Price to quote — leave empty to use the calculated price")}</div></div>
        <div class="sum" id="sum-${i}">${sumHtml(it)}</div>`;
      h += supplierHtml(it, i);
    } else h += `<div class="sum"><div class="pr"><span>Price per piece</span><b>${inr(it.unit_price)}</b></div></div>`;
    h += `</fieldset>${ed() ? `<div class="row" style="margin-top:10px"><button class="btn o s" data-act="dup" data-i="${i}">Copy this part</button><button class="btn o s" data-act="delpart" data-i="${i}">Remove part</button></div>` : ""}</div></details>`;
    return h;
  }
  function supplierHtml(it, i) {
    if (!hasF("crm.supplier-comparison")) return `<div class="cs"><h5>5 · Supplier prices</h5><div class="mut">Comparing supplier prices is a separate feature. <a href="#" data-act="lock">Find out more</a></div></div>`;
    if (!it.id) return `<div class="cs"><h5>5 · Supplier prices</h5><div class="mut">Save the RFQ first, then add the prices suppliers quote for this part.</div></div>`;
    const cmp = C.compare((R.supplier_quotes || []).filter((s) => s.item_id === it.id), C.num(it.qty), today());
    return `<div class="cs"><h5>5 · Supplier prices <span class="mut" style="text-transform:none;letter-spacing:0">— the lowest valid price is marked; “Use this price” puts it into the costing above</span></h5>
      ${cmp.rows.length ? `<div class="sc"><table class="tb2 sqt"><thead><tr><th>Supplier</th><th>For</th><th>Price</th><th>MOQ</th><th>Lead</th><th>Valid until</th><th></th></tr></thead><tbody>${cmp.rows.slice().sort((a, b) => a.price - b.price).map((s) => `<tr class="${s.id === cmp.best ? "best" : ""} ${s.selected ? "sel" : ""}"><td><b>${esc(s.supplier_name)}</b>${s.id === cmp.best ? ' <span class="chip g">lowest</span>' : ""}${s.flags.map((f) => `<span class="flag">⚠ ${esc(f)}</span>`).join("")}</td><td>${esc(s.what)}${s.quote_ref ? "<br><small class='mut'>" + esc(s.quote_ref) + "</small>" : ""}</td><td><b>${inr(s.price)}</b></td><td>${s.moq != null ? inr(s.moq, 0) : "—"}</td><td>${s.lead_days != null ? s.lead_days + " d" : "—"}</td><td>${s.valid_until ? fmt(s.valid_until) : "—"}</td><td style="white-space:nowrap">${ed() ? (s.selected ? `<button class="btn s" data-act="sqsel" data-id="${s.id}" data-on="0">✔ In use — remove</button>` : `<button class="btn o s" data-act="sqsel" data-id="${s.id}" data-on="1">Use this price</button>`) + ` <button class="btn o s" data-act="sqdel" data-id="${s.id}">✕</button>` : s.selected ? "✔ in use" : ""}</td></tr>`).join("")}</tbody></table></div>${cmp.spread ? `<div class="mut" style="margin:4px 0">Difference between the highest and the lowest price: ${inr(cmp.spread)} per piece.</div>` : ""}` : '<div class="mut">No supplier prices yet.</div>'}
      ${ed() ? `<div class="cg" style="margin-top:8px"><div><label>Supplier</label><input id="sq-sup-${i}" list="dl_sup" placeholder="Pick or type a new supplier"></div><div><label>Quote is for</label><select id="sq-wh-${i}">${opts(WHAT.map((w) => [w, w]), "Raw material")}</select></div><div><label>Price per piece (₹)</label><input id="sq-pr-${i}" inputmode="decimal"></div><div><label>Minimum order qty</label><input id="sq-mq-${i}" inputmode="decimal"></div><div><label>Lead time (days)</label><input id="sq-ld-${i}" inputmode="numeric"></div><div><label>Price valid until</label><input id="sq-vu-${i}" type="date"></div><div><label>Payment terms</label><input id="sq-pt-${i}"></div><div><label>Their quote ref.</label><input id="sq-rf-${i}"></div></div><button class="btn s" style="margin-top:8px" data-act="sqadd" data-i="${i}">Add this supplier price</button>` : ""}</div>`;
  }
  function renderRfq() {
    snapshotOpen(); const el = $("#rfqp"), e = ed(), pt = R.party_id, cts = (S.L.contacts || []).filter((c) => c.party_id === pt), tot = itemTot(), can = canEdit();
    const dis = e ? "" : " disabled", lk = hasF("crm.quotations");
    el.innerHTML = `<datalist id="dl_sup">${K.partiesOf(["supplier"]).map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>
      <div class="row noprint"><a href="#go=rfq" class="btn o s">← All RFQs</a><div style="flex:1"></div>${R.id && can && !R.status.match(/Lost|No quote/) && R.status !== "Won" ? `<span class="mut">Status:</span>` : ""}${R.id ? chip(R.status, RST[R.status]) : ""}</div>
      <h2 style="margin:0 0 2px">${esc(R.no)}${R.sample ? ' <span class="pillw">sample</span>' : ""}</h2><div class="mut" style="margin-bottom:12px">${R.id ? "Request for quotation from " + esc((R.party && R.party.name) || "") : "Enter who sent the RFQ and what they want priced."}${R.lead_no ? " · from lead " + esc(R.lead_no) : ""}${R.lost_reason ? " · reason: " + esc(R.lost_reason) : ""}</div>
      ${closed(R) && !R.is_admin ? '<p class="msg noprint">This RFQ is closed. An administrator can reopen it.</p>' : ""}
      <fieldset style="border:0;padding:0;margin:0"${dis}><div class="frm"><div><label>Customer</label><select data-h="party_id" id="h_party"${R.id ? " disabled" : ""}><option value="">— choose —</option>${K.partiesOf(["customer", "prospect"]).map((p) => `<option value="${p.id}"${p.id === pt ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
        <div><label>Contact person</label><select data-h="contact_id" id="h_contact">${opts([["", "—"]].concat(cts.map((c) => [c.id, c.name + (c.designation ? " · " + c.designation : "")])), R.contact_id || "")}</select></div>
        <div><label>Customer's RFQ reference</label><input data-h="customer_ref" value="${esc(R.customer_ref || "")}"></div><div><label>Project / programme</label><input data-h="project" value="${esc(R.project || "")}"></div>
        <div><label>Received on</label><input type="date" data-h="received_on" value="${esc(String(R.received_on || "").slice(0, 10))}"></div><div><label>Quotation due by</label><input type="date" data-h="due_on" value="${esc(String(R.due_on || "").slice(0, 10))}"></div>
        <div><label>Priority</label><select data-h="priority">${opts(PRI.map((p) => [p, p]), R.priority)}</select></div><div><label>Owner</label><select data-h="owner">${K.ownerOpts(R.owner)}</select></div><div class="w"><label>Notes</label><textarea data-h="notes" rows="2">${esc(R.notes || "")}</textarea></div></div></fieldset>
      <h3 style="margin:16px 0 8px">Parts to quote</h3>${R.items.map(partHtml).join("")}${e ? '<button class="btn o" data-act="addpart">+ Add another part</button>' : ""}
      ${R.id ? `<div class="two" style="margin-top:16px"><div class="card"><h3>Quotations</h3>${(R.quotes || []).length ? R.quotes.map((z) => `<div class="act" data-q="${z.id}" style="cursor:pointer"><div style="flex:1"><b>${esc(z.no)}</b> Rev ${String(z.rev).padStart(2, "0")} ${chip(z.status, QST[z.status])}<br><small class="mut">${fmt(z.quote_date)} · ${inr(z.total)}</small></div></div>`).join("") : '<div class="mut">No quotation yet.</div>'}</div>
        <div class="card"><h3>Follow-ups</h3>${K.actList(R.activities || [])}${can ? K.actAdd() : ""}</div></div>` : ""}
      <div class="sticky noprint"><b id="tot">Order value ${inr(tot)}</b><span style="flex:1"></span>
        ${e ? '<button class="btn" data-act="save">Save RFQ</button>' : ""}${R.id && can && lk && !["Lost", "No quote"].includes(R.status) ? '<button class="btn o" data-act="quote">Make quotation</button>' : ""}${R.id && R.money ? '<button class="btn o" data-act="pcost">Costing sheet</button>' : ""}${R.id && R.money && hasF("crm.supplier-comparison") ? '<button class="btn o" data-act="pcmp">Supplier comparison</button>' : ""}
        ${R.id && can && !closed(R) ? '<button class="btn o" data-act="won">Mark won</button><button class="btn o" data-act="lost">Mark lost</button><button class="btn o" data-act="noq">No quote</button>' : ""}${R.id && closed(R) && R.is_admin ? '<button class="btn o" data-act="reopen">Reopen</button>' : ""}${R.id && can ? '<button class="btn r" data-act="del">Delete</button>' : ""}</div>`;
    el.querySelectorAll("[data-q]").forEach((x) => (x.onclick = () => go("go=quote&id=" + x.dataset.q)));
    if (R.id) K.wireActs(() => drawRfq({ id: R.id }), { rfq_id: R.id, party_id: R.party_id });
  }
  function refreshPart(i) {
    const it = R.items[i], s = $("#sum-" + i); if (s) s.innerHTML = sumHtml(it);
    const set = (id, v) => { const e = $(id); if (e) e.innerHTML = v; }; const k = R.money ? C.cost(it.cost) : null;
    set("#ph-no-" + i, "<b>" + esc(it.part_no || "") + "</b>"); set("#ph-nm-" + i, esc(it.part_name || "New part — enter the name")); set("#ph-q-" + i, it.qty ? "Qty " + inr(it.qty, 0) : ""); if (k) set("#ph-c-" + i, "Cost " + inr(k.total_cost)); set("#ph-p-" + i, inr(priceOf(it)) + "<small>per piece</small>"); set("#tot", "Order value " + inr(itemTot()));
  }
  const payload = () => ({ id: R.id, party_id: R.party_id, contact_id: R.contact_id || null, customer_ref: R.customer_ref, received_on: R.received_on, due_on: R.due_on, priority: R.priority, owner: R.owner, project: R.project, notes: R.notes, lead_id: R.lead_id || null,
    items: R.items.map((it) => ({ id: it.id, part_no: it.part_no, part_name: it.part_name, drawing_no: it.drawing_no, revision: it.revision, material: it.material, qty: it.qty, annual_qty: it.annual_qty, uom: it.uom, target_price: it.target_price, remarks: it.remarks, cost: it.cost })) });
  async function saveRfq(show) {
    if (!R.party_id) { say("Choose the customer who sent the RFQ."); $("#h_party").focus(); return false; }
    for (let i = 0; i < R.items.length; i++) { const it = R.items[i]; if (!String(it.part_name).trim()) { say("Part " + (i + 1) + " has no name."); OPEN.add(i); renderRfq(); return false; } if (!(C.pos(it.qty) > 0)) { say("Part " + (i + 1) + " needs a quantity above zero."); OPEN.add(i); renderRfq(); return false; } }
    try {
      const r = await call("kmr_crm_rfq_save", { p: payload() }); S.dirty = false; if (show) say("Saved.", true);
      if (!R.id) { go("go=rfq&id=" + r.id); return true; } await drawRfq({ id: R.id }); return true;
    } catch (e) { say(e.message); return false; }
  }
  async function setStatus(st, reason) { await call("kmr_crm_rfq_status", { p_id: R.id, p_status: st, p_reason: reason || null }); say("Status changed to " + st + ".", true); await drawRfq({ id: R.id }); }
  function wireRfq() {
    const el = $("#rfqp");
    el.addEventListener("input", (ev) => {
      const t = ev.target, d = t.dataset; if (!R || !d) return; S.dirty = true;
      if (d.h) { R[d.h] = t.value; if (d.h === "party_id") { R.contact_id = ""; const cts = (S.L.contacts || []).filter((c) => c.party_id === t.value); $("#h_contact").innerHTML = opts([["", "—"]].concat(cts.map((c) => [c.id, c.name])), ""); } return; }
      const i = d.i == null ? null : +d.i; if (i == null) return; const it = R.items[i];
      if (d.k) it[d.k] = t.value; else if (d.c) it.cost[d.c] = t.value; else if (d.op != null) { it.cost.ops[+d.op][d.f] = t.value; const o = it.cost.ops[+d.op], v = $("#opv-" + i + "-" + d.op); if (v) v.textContent = inr((C.pos(o.min) * C.pos(o.rate)) / 60); } else if (d.ou != null) it.cost.outs[+d.ou][d.f] = t.value;
      refreshPart(i);
    });
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-act]"); if (!b || !R) return; ev.preventDefault(); const a = b.dataset.act, i = +b.dataset.i, j = +b.dataset.j;
      guard(async () => {
        if (a === "addpart") { snapshotOpen(); R.items.push(normItem(blankItem())); OPEN.add(R.items.length - 1); S.dirty = true; renderRfq(); }
        else if (a === "delpart") { if (R.items.length < 2) { say("An RFQ needs at least one part."); return; } if (!confirm("Remove this part? Its supplier prices are removed too.")) return; snapshotOpen(); R.items.splice(i, 1); OPEN.clear(); S.dirty = true; renderRfq(); }
        else if (a === "dup") { snapshotOpen(); const c = JSON.parse(JSON.stringify(R.items[i])); c.id = null; c.cost.outs = (c.cost.outs || []).filter((o) => !o.sq); R.items.splice(i + 1, 0, c); OPEN.add(i + 1); S.dirty = true; renderRfq(); }
        else if (a === "addop") { snapshotOpen(); R.items[i].cost.ops.push({ name: "", min: "", rate: "" }); S.dirty = true; renderRfq(); }
        else if (a === "delop") { snapshotOpen(); R.items[i].cost.ops.splice(j, 1); S.dirty = true; renderRfq(); }
        else if (a === "addout") { snapshotOpen(); R.items[i].cost.outs.push({ name: "", amt: "" }); S.dirty = true; renderRfq(); }
        else if (a === "delout") { snapshotOpen(); R.items[i].cost.outs.splice(j, 1); S.dirty = true; renderRfq(); }
        else if (a === "lock") KMRLock.need("crm.supplier-comparison");
        else if (a === "save") await saveRfq(true);
        else if (a === "quote") { if (S.dirty && !(await saveRfq(false))) return; const z = await call("kmr_crm_quote_make", { p_rfq: R.id }); say(z.existing ? "Opened the quotation already being prepared." : "Quotation made. Check the lines and send it.", true); go("go=quote&id=" + z.id); }
        else if (a === "pcost") { if (S.dirty && !(await saveRfq(false))) return; showDoc(CRMDocs.costing(R)); }
        else if (a === "pcmp") { if (S.dirty && !(await saveRfq(false))) return; showDoc(CRMDocs.compare(R, today())); }
        else if (a === "won") { if (confirm("Mark this RFQ as won?")) await setStatus("Won"); }
        else if (a === "lost" || a === "noq") { const why = await ask(a === "lost" ? "Why was this RFQ lost?" : "Why are we not quoting?", "Price, delivery, capacity, customer cancelled…", "Save"); if (why) await setStatus(a === "lost" ? "Lost" : "No quote", why); }
        else if (a === "reopen") await setStatus("Costing");
        else if (a === "del") { if (!confirm("Delete this RFQ with its parts, supplier prices and quotations? This cannot be undone.")) return; await call("kmr_crm_rfq_delete", { p_id: R.id }); S.dirty = false; say("RFQ deleted.", true); go("go=rfq"); }
        else if (a === "sqadd") {
          if (S.dirty && !(await saveRfq(false))) return; const it = R.items[i]; const name = V("sq-sup-" + i).trim(), sup = (S.L.parties || []).find((p) => p.name.toLowerCase() === name.toLowerCase() && p.kind === "supplier");
          await call("kmr_crm_sq_save", { p: { item_id: it.id, supplier_id: sup ? sup.id : null, supplier_name: name, what: V("sq-wh-" + i), price: V("sq-pr-" + i), moq: V("sq-mq-" + i), lead_days: V("sq-ld-" + i), valid_until: V("sq-vu-" + i), payment_terms: V("sq-pt-" + i), quote_ref: V("sq-rf-" + i) } });
          if (!sup) await K.reloadL(); OPEN.add(i); say("Supplier price added.", true); await drawRfq({ id: R.id });
        } else if (a === "sqsel") { if (S.dirty && !(await saveRfq(false))) return; await call("kmr_crm_sq_select", { p_id: b.dataset.id, p_on: b.dataset.on === "1" }); say(b.dataset.on === "1" ? "Supplier price is now in the costing." : "Supplier price removed from the costing.", true); await drawRfq({ id: R.id }); }
        else if (a === "sqdel") { if (!confirm("Delete this supplier price?")) return; await call("kmr_crm_sq_delete", { p_id: b.dataset.id }); await drawRfq({ id: R.id }); }
      });
    });
  }

  /* ================= Quotations ================= */
  async function drawQuotes() {
    const f = S.f.quote, list = await call("kmr_crm_quote_list", { p: { q: f.q, status: f.status || null } }), el = $("#quote");
    el.innerHTML = `<p class="guide">Make a quotation from an RFQ (open the RFQ and press <b>Make quotation</b>). A changed price becomes a new revision with the same number.</p>
      <div class="stg">${[["", "All"], ["draft", "Draft"], ["sent", "Sent"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["superseded", "Old revisions"]].map(([k, t]) => `<button data-st="${k}" class="${f.status === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="row"><input class="grow" id="qq" placeholder="Search quotation no. or customer…" value="${esc(f.q)}"></div>
      ${list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>Quotation</th><th>Rev.</th><th>Customer</th><th>RFQ</th><th>Date</th><th>Valid until</th><th>Status</th><th>Total</th></tr></thead><tbody>${list.map((z) => `<tr data-open="${z.id}"><td><b>${esc(z.no)}</b>${z.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${String(z.rev).padStart(2, "0")}</td><td>${esc(z.party_name)}</td><td>${esc(z.rfq_no || "")}</td><td>${fmt(z.quote_date)}</td><td>${z.valid_until ? fmt(z.valid_until) : "—"}</td><td>${chip(z.status, QST[z.status])}</td><td style="text-align:right"><b>${inr(z.total)}</b></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No quotations yet.</div>'}`;
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; drawQuotes(); }));
    let t; $("#qq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; drawQuotes().then(() => { const i = $("#qq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => go("go=quote&id=" + r.dataset.open)));
  }
  const qed = () => !!(Q && Q.can_edit && Q.status === "draft");
  async function drawQuote(hp) { Q = await call("kmr_crm_quote_get", { p_id: hp.id }); Q.lines.forEach((l) => ["part_no", "drawing_no", "revision", "remarks"].forEach((k) => { if (l[k] == null) l[k] = ""; })); S.dirty = false; renderQuote(); }
  function totalsHtml() { const t = C.totals(Q.lines, Q.tax_pct); return `<div><span>Sub-total</span><b>${inr(t.sub)}</b></div><div><span>${esc(Q.tax_name || "Tax")} ${esc(Q.tax_pct)}%</span><b>${inr(t.tax)}</b></div><div class="pr"><span>Total (${esc(Q.currency)})</span><b>${inr(t.tot)}</b></div>`; }
  function renderQuote() {
    const el = $("#quotep"), e = qed(), dis = e ? "" : " disabled", cts = (S.L.contacts || []).filter((c) => c.party_id === Q.party_id), can = canEdit(), isLast = true;
    el.innerHTML = `<div class="row noprint"><a href="#go=quote" class="btn o s">← All quotations</a><div style="flex:1"></div>${chip(Q.status, QST[Q.status])}</div>
      <h2 style="margin:0 0 2px">${esc(Q.no)} <small class="mut">Rev ${String(Q.rev).padStart(2, "0")}</small></h2><div class="mut" style="margin-bottom:12px">${esc(Q.party_name)} · <a href="#go=rfq&id=${Q.rfq_id}">${esc(Q.rfq_no || "RFQ")}</a>${Q.sent_on ? " · sent " + fmt(Q.sent_on) : ""}${Q.decided_on ? " · decided " + fmt(Q.decided_on) : ""}</div>
      ${Q.status === "superseded" ? '<p class="msg noprint">This revision was replaced by a newer one. It is kept for the record.</p>' : ""}
      <fieldset style="border:0;padding:0;margin:0"${dis}><div class="frm"><div><label>Kind attention</label><select data-q="contact_id">${opts([["", "—"]].concat(cts.map((c) => [c.id, c.name + (c.designation ? " · " + c.designation : "")])), Q.contact_id || "")}</select></div>
        <div><label>Quotation date</label><input type="date" data-q="quote_date" value="${esc(String(Q.quote_date || "").slice(0, 10))}"></div><div><label>Valid until</label><input type="date" data-q="valid_until" value="${esc(String(Q.valid_until || "").slice(0, 10))}"></div>
        <div><label>Tax name</label><input data-q="tax_name" value="${esc(Q.tax_name || "")}"></div><div><label>Tax (%)</label><input data-q="tax_pct" inputmode="decimal" value="${esc(Q.tax_pct == null ? "" : Q.tax_pct)}"></div><div><label>Payment terms</label><input data-q="payment_terms" value="${esc(Q.payment_terms || "")}"></div><div><label>Delivery terms</label><input data-q="delivery_terms" value="${esc(Q.delivery_terms || "")}"></div></div>
      <h3 style="margin:14px 0 6px">Prices</h3><div class="sc"><table class="tb2" style="min-width:760px"><thead><tr><th>#</th><th>Part no.</th><th>Part name</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Lead (days)</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>${Q.lines.map((l, i) => `<tr><td>${i + 1}</td><td><input data-l="${i}" data-f="part_no" value="${esc(l.part_no)}"></td><td><input data-l="${i}" data-f="part_name" value="${esc(l.part_name)}"></td><td><input data-l="${i}" data-f="qty" inputmode="decimal" value="${esc(l.qty)}" style="width:90px"></td><td><input data-l="${i}" data-f="uom" value="${esc(l.uom || "Nos")}" style="width:64px"></td><td><input data-l="${i}" data-f="unit_price" inputmode="decimal" value="${esc(l.unit_price)}" style="width:100px"></td><td><input data-l="${i}" data-f="lead_days" inputmode="numeric" value="${esc(l.lead_days == null ? "" : l.lead_days)}" style="width:80px"></td><td style="text-align:right" id="la-${i}">${inr(C.rnd(C.pos(l.qty) * C.pos(l.unit_price), 2))}</td><td>${e && Q.lines.length > 1 ? `<button class="btn o s" data-act="delline" data-i="${i}">✕</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
      ${e ? '<button class="btn o s" data-act="addline" style="margin-top:6px">+ Add a line</button>' : ""}
      <div class="sum" id="qtot">${totalsHtml()}</div>
      <div class="frm" style="margin-top:12px"><div class="w"><label>Terms and conditions</label><textarea data-q="terms" rows="5">${esc(Q.terms || "")}</textarea></div><div class="w"><label>Remarks for the customer</label><textarea data-q="remarks" rows="2">${esc(Q.remarks || "")}</textarea></div></div></fieldset>
      ${(Q.revisions || []).length > 1 ? `<div class="card" style="margin-top:12px"><h3>Revisions</h3>${Q.revisions.map((r) => `<div class="act" data-rev="${r.id}" style="cursor:pointer"><div style="flex:1"><b>Rev ${String(r.rev).padStart(2, "0")}</b> ${chip(r.status, QST[r.status])} <small class="mut">${fmt(r.quote_date)} · ${inr(r.total)}</small></div></div>`).join("")}</div>` : ""}
      <div class="sticky noprint"><span style="flex:1"></span>${e ? '<button class="btn" data-act="qsave">Save</button><button class="btn o" data-act="send">Save and mark as sent</button>' : ""}<button class="btn o" data-act="qprint">Print / PDF</button>
        ${can && Q.status === "sent" ? '<button class="btn o" data-act="acc">Customer accepted</button><button class="btn o" data-act="rej">Customer rejected</button>' : ""}${can && ["sent", "rejected", "accepted"].includes(Q.status) ? '<button class="btn o" data-act="newrev">New revision</button>' : ""}${Q.is_admin && ["accepted", "rejected"].includes(Q.status) ? '<button class="btn o" data-act="resent">Back to sent</button>' : ""}${can && (Q.status === "draft" || Q.is_admin) && Q.status !== "accepted" ? '<button class="btn r" data-act="qdel">Delete</button>' : ""}</div>`;
    el.querySelectorAll("[data-rev]").forEach((x) => (x.onclick = () => go("go=quote&id=" + x.dataset.rev)));
  }
  async function saveQuote(show) {
    try { const z = await call("kmr_crm_quote_save", { p: { id: Q.id, contact_id: Q.contact_id || null, quote_date: Q.quote_date, valid_until: Q.valid_until, tax_name: Q.tax_name, tax_pct: Q.tax_pct, payment_terms: Q.payment_terms, delivery_terms: Q.delivery_terms, terms: Q.terms, remarks: Q.remarks, lines: Q.lines } }); S.dirty = false; if (show) say("Saved.", true); await drawQuote({ id: Q.id }); return true; } catch (e) { say(e.message); return false; }
  }
  async function qStatus(st, msg) { await call("kmr_crm_quote_status", { p_id: Q.id, p_status: st }); say(msg, true); await drawQuote({ id: Q.id }); }
  function wireQuote() {
    const el = $("#quotep");
    el.addEventListener("input", (ev) => {
      const t = ev.target, d = t.dataset; if (!Q || !d) return; S.dirty = true;
      if (d.q) { Q[d.q] = t.value; if (d.q === "tax_pct") $("#qtot").innerHTML = totalsHtml(); } else if (d.l != null) { const l = Q.lines[+d.l]; l[d.f] = t.value; const a = $("#la-" + d.l); if (a) a.textContent = inr(C.rnd(C.pos(l.qty) * C.pos(l.unit_price), 2)); $("#qtot").innerHTML = totalsHtml(); }
    });
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-act]"); if (!b || !Q) return; ev.preventDefault(); const a = b.dataset.act;
      guard(async () => {
        if (a === "addline") { Q.lines.push({ seq: Q.lines.length + 1, part_no: "", part_name: "", drawing_no: "", revision: "", qty: "", uom: "Nos", unit_price: "", lead_days: null, remarks: "" }); S.dirty = true; renderQuote(); }
        else if (a === "delline") { Q.lines.splice(+b.dataset.i, 1); S.dirty = true; renderQuote(); }
        else if (a === "qsave") await saveQuote(true);
        else if (a === "send") { if (!(await saveQuote(false))) return; await qStatus("sent", "Marked as sent. The RFQ and the lead now show Quoted."); }
        else if (a === "qprint") showDoc(CRMDocs.quote(Q));
        else if (a === "acc") { if (confirm("The customer accepted this quotation? The RFQ and the lead will be marked Won.")) await qStatus("accepted", "Accepted. The RFQ is marked Won."); }
        else if (a === "rej") { await qStatus("rejected", "Marked as rejected."); }
        else if (a === "resent") await qStatus("sent", "Moved back to sent.");
        else if (a === "newrev") { const z = await call("kmr_crm_quote_make", { p_rfq: Q.rfq_id }); say("New revision " + String(z.rev).padStart(2, "0") + " made from the current RFQ prices.", true); go("go=quote&id=" + z.id); }
        else if (a === "qdel") { if (!confirm("Delete this quotation revision?")) return; await call("kmr_crm_quote_delete", { p_id: Q.id }); S.dirty = false; say("Deleted.", true); go("go=quote"); }
      });
    });
  }

  /* ================= Setup (administrator) ================= */
  const SET = [["company_address", "Address on the quotation", "ta"], ["company_gstin", "GSTIN"], ["company_phone", "Phone"], ["company_email", "Email"], ["signatory", "Signed by (name)"], ["signatory_title", "Signed by (designation)"],
    ["lead_prefix", "Lead number prefix", "", "LD"], ["rfq_prefix", "RFQ number prefix", "", "RFQ"], ["quote_prefix", "Quotation number prefix", "", "QTN"], ["currency", "Currency", "", "INR"], ["tax_name", "Tax name", "", "GST"], ["tax_pct", "Tax (%)", "num"], ["validity_days", "Quotation valid for (days)", "num"],
    ["default_oh", "Usual overhead (%)", "num"], ["default_margin", "Usual profit margin (%)", "num"], ["payment_terms", "Usual payment terms"], ["delivery_terms", "Usual delivery terms"], ["terms", "Terms and conditions printed on the quotation", "ta"], ["bank_details", "Bank details (optional, printed on the quotation)", "ta"]];
  async function drawSetup() {
    const el = $("#setup"); if (!isAdmin()) { el.innerHTML = '<div class="empty">Only an administrator can change the setup.</div>'; return; }
    const s = S.L.settings || {};
    el.innerHTML = `<p class="guide">These details are printed on every quotation and set the numbering. Your company name and logo come from the Console.</p><div class="frm">${SET.map(([k, l, ty, ph]) => `<div${ty === "ta" ? ' class="w"' : ""}><label for="s_${k}">${esc(l)}</label>${ty === "ta" ? `<textarea id="s_${k}" rows="3">${esc(s[k] || "")}</textarea>` : `<input id="s_${k}" ${ty === "num" ? 'inputmode="decimal"' : ""} value="${esc(s[k] == null ? "" : s[k])}"${ph ? ` placeholder="${esc(ph)}"` : ""}>`}</div>`).join("")}
      <div class="w"><label class="cl"><input type="checkbox" id="s_fy"${s.fy_numbering === false ? "" : " checked"}> <span>Number by financial year (April to March), for example QTN/26-27/0001</span></label></div></div><div class="row" style="margin-top:12px"><button class="btn" id="s_save">Save setup</button></div>`;
    $("#s_save").onclick = () => guard(async () => { const o = Object.assign({}, S.L.settings); SET.forEach(([k, , ty]) => { o[k] = ty === "num" ? (V("s_" + k).trim() === "" ? null : C.num(V("s_" + k))) : V("s_" + k); if (ty === "num" && V("s_" + k).trim() !== "" && o[k] == null) throw new Error("Enter a number for " + SET.find((x) => x[0] === k)[1] + "."); }); o.fy_numbering = $("#s_fy").checked; Object.keys(o).forEach((k) => o[k] === null && delete o[k]);
      await call("kmr_crm_settings_save", { p: o }); S.L.settings = o; say("Setup saved.", true); });
  }

  S.screens.rfq = drawRfqs; S.screens.rfqp = drawRfq; S.screens.quote = drawQuotes; S.screens.quotep = drawQuote; S.screens.setup = drawSetup;
  wireRfq(); wireQuote();
})();
