/* CRM & RFQ - core screens: Dashboard, Leads, Customers (shared helpers + router). RFQ, Quotations and Setup are in crm-rfq.js.
   Data calls are kmr_crm_* (database) or crm-demo.js (?demo=1). Arithmetic is in crm-calc.js (same sums as the database). */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, C = window.CRMCalc;
  const STAGES = ["New", "Contacted", "Qualified", "RFQ received", "Quoted", "Negotiation", "Won", "Lost"];
  const STG = { New: "x", Contacted: "b", Qualified: "v", "RFQ received": "a", Quoted: "b", Negotiation: "a", Won: "g", Lost: "r" };
  const RST = { Received: "x", Costing: "a", Quoted: "b", Negotiation: "v", Won: "g", Lost: "r", "No quote": "x" };
  const QST = { draft: "a", sent: "b", accepted: "g", rejected: "r", superseded: "x" };
  const KINDS = { customer: "Customer", prospect: "Prospect", supplier: "Supplier" };
  const ACTK = { call: "📞 Call", visit: "🚗 Visit", email: "✉️ Email", meeting: "👥 Meeting", note: "📝 Note", task: "✅ Task" };
  const S = { L: null, f: { lead: { q: "", stage: "open", view: "list" }, party: { q: "", kind: "" }, rfq: { q: "", status: "open" }, quote: { q: "", status: "" } }, screens: {}, dirty: false };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const today = () => (S.L && S.L.today) || QP.today();
  const canEdit = () => !!QP.canEdit, isAdmin = () => S.L && S.L.role === "admin", money = () => !!(S.L && S.L.money);
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const go = (h) => { setGo(h); route(); window.scrollTo(0, 0); };
  const chip = (t, cls) => `<span class="chip ${cls || "x"}">${esc(t)}</span>`;
  const due = (d) => { if (!d) return '<span class="mut">no date</span>'; const t = today(), s = String(d).slice(0, 10); return s < t ? `<span class="late">${fmt(s)} · late</span>` : s === t ? `<span class="today">Today</span>` : `<span>${fmt(s)}</span>`; };
  const fld = (label, id, val, extra, cls) => `<div${cls ? ` class="${cls}"` : ""}><label for="${id}">${label}</label><input id="${id}" value="${esc(val == null ? "" : val)}" ${extra || ""}></div>`;
  const partiesOf = (kinds) => (S.L.parties || []).filter((p) => kinds.includes(p.kind) && p.status !== "inactive");
  const ownerOpts = (sel) => opts([["", "—"]].concat((S.L.owners || []).map((o) => [o, o])).concat(sel && !(S.L.owners || []).includes(sel) ? [[sel, sel]] : []), sel);
  const guard = async (fn) => { try { return await fn(); } catch (e) { say(e.message); return undefined; } };

  /* ---------- modal ---------- */
  const openM = (html) => { $("#mb").innerHTML = html; $("#m").classList.add("on"); };
  const closeM = () => { $("#m").classList.remove("on"); $("#mb").innerHTML = ""; };
  $("#m").addEventListener("mousedown", (e) => { if (e.target.id === "m") closeM(); });
  const ask = (title, ph, btn) => new Promise((res) => {
    openM(`<h3>${esc(title)}</h3><textarea id="ask_t" rows="3" placeholder="${esc(ph || "")}"></textarea><div class="row" style="margin-top:10px"><button class="btn" id="ask_ok">${esc(btn || "OK")}</button><button class="btn o" id="ask_no">Cancel</button></div>`);
    $("#ask_t").focus(); $("#ask_ok").onclick = () => { const v = V("ask_t").trim(); if (!v) { $("#ask_t").focus(); return; } closeM(); res(v); }; $("#ask_no").onclick = () => { closeM(); res(null); };
  });

  /* ---------- a printed form fills the screen; Print sends only the form to the printer ---------- */
  const st = document.createElement("style");
  st.textContent = "#doc{position:fixed;inset:0;z-index:9500;background:var(--bg);overflow:auto;padding:10px}#doc .bar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}@media print{body.pv>*:not(#doc){display:none!important}#doc{position:static;padding:0;overflow:visible;background:#fff}#doc .bar{display:none!important}}";
  document.head.append(st);
  function showDoc(html) {
    closeDoc(); const d = document.createElement("div"); d.id = "doc";
    d.innerHTML = `<div class="bar noprint"><button class="btn" id="doc_p">Print / save as PDF</button><button class="btn o" id="doc_x">Close</button></div>${html}`; document.body.append(d); document.body.classList.add("pv");
    $("#doc_p").onclick = () => window.print(); $("#doc_x").onclick = closeDoc;
  }
  function closeDoc() { const d = $("#doc"); if (d) d.remove(); document.body.classList.remove("pv"); }

  /* ================= router ================= */
  const SECS = ["std", "dash", "leads", "cust", "rfq", "rfqp", "quote", "quotep", "setup"];
  async function route() {
    closeM(); closeDoc(); const hp = hashParts(); let g = ["std", "dash", "leads", "cust", "rfq", "quote", "setup"].includes(hp.go) ? hp.go : "dash";
    const sec = g === "rfq" && (hp.id || hp.new) ? "rfqp" : g === "quote" && hp.id ? "quotep" : g;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === g)); SECS.forEach((s) => $("#" + s).classList.toggle("hide", s !== sec)); say("");
    try {
      if (sec === "std") KMRStd.draw($("#std"), "crm");
      else if (sec === "dash") await drawDash();
      else if (sec === "leads") await drawLeads();
      else if (sec === "cust") await drawCust();
      else if (S.screens[sec]) await S.screens[sec](hp);
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);

  /* ================= Dashboard ================= */
  async function drawDash() {
    const d = await call("kmr_crm_dashboard"), el = $("#dash"), by = d.by_stage || {}, mx = Math.max(1, ...STAGES.map((s) => (by[s] || {}).n || 0)), lr = Object.entries(d.lost_reasons || {}).sort((a, b) => b[1] - a[1]);
    const kp = (h, c, b, l, sub) => `<div class="kpi" style="--c:${c}" data-go="${h}"><b>${b}</b><span>${l}</span>${sub ? `<small class="mut" style="display:block">${sub}</small>` : ""}</div>`;
    el.innerHTML = `<div class="kpis">${kp("go=leads", "var(--b1)", d.leads_open, "open leads", C.lakh(d.pipeline_value) + " in the pipeline")}${kp("go=leads", d.followups_overdue ? "var(--r)" : "var(--a)", d.followups_due, "follow-ups due", d.followups_overdue ? d.followups_overdue + " late" : "none late")}
      ${kp("go=rfq", d.rfq_overdue ? "var(--r)" : "var(--a)", d.rfq_to_quote, "RFQs to quote", d.rfq_overdue ? d.rfq_overdue + " past due date" : d.rfq_open + " open in all")}${kp("go=quote", "var(--b2)", C.lakh(d.quotes_out_value), "quotations out", d.quotes_out + " waiting for a reply")}
      ${kp("go=quote", "var(--g)", C.lakh(d.won_value_90), "won in 90 days", d.win_rate == null ? "no decisions yet" : "win rate " + d.win_rate + "% (" + d.won + " won, " + d.lost + " lost)")}</div>
      <div class="two"><div class="card"><h3>Sales pipeline</h3><div class="bars">${STAGES.map((s) => { const o = by[s] || { n: 0, value: 0 }; return `<div class="bl" data-stage="${esc(s)}"><span>${esc(s)}</span><i class="${s === "Lost" ? "r" : ""}" style="width:${Math.max(2, (o.n / mx) * 100)}%"></i><b>${o.n}${o.value ? ' <small class="mut">' + C.lakh(o.value) + "</small>" : ""}</b></div>`; }).join("")}</div></div>
      <div class="card"><h3>Next follow-ups</h3>${(d.next_actions || []).length ? d.next_actions.map((a) => `<div class="act" data-aid="${a.id}"><button class="ck" data-done="${a.id}" title="Mark done"></button><div style="flex:1"><div class="as">${esc(ACTK[a.kind] || a.kind)} · ${esc(a.subject)}</div><small class="mut">${esc(a.party_name || a.lead_company || "")} · ${due(a.due_date)}${a.owner ? " · " + esc(a.owner) : ""}</small></div></div>`).join("") : '<div class="empty">Nothing waiting. Add a follow-up from a lead or an RFQ.</div>'}</div></div>
      <div class="two"><div class="card"><h3>RFQs waiting for a quotation</h3>${(d.due_soon || []).length ? d.due_soon.map((r) => `<div class="act" data-rfq="${r.id}" style="cursor:pointer"><div style="flex:1"><div class="as"><b>${esc(r.no)}</b> · ${esc(r.party_name)} ${r.priority !== "Normal" ? chip(r.priority, r.priority === "Urgent" ? "r" : "a") : ""}</div><small class="mut">${chip(r.status, RST[r.status])} due ${due(r.due_on)}</small></div></div>`).join("") : '<div class="empty">No RFQ is waiting.</div>'}</div>
      <div class="card"><h3>Why we lose RFQs</h3>${lr.length ? lr.map(([k, n]) => `<div class="cm">${esc(k)} <b style="float:right">${n}</b></div>`).join("") : '<div class="empty">No lost RFQs yet.</div>'}</div></div>`;
    el.querySelectorAll("[data-go]").forEach((e) => (e.onclick = () => go(e.dataset.go)));
    el.querySelectorAll("[data-stage]").forEach((e) => (e.onclick = () => { S.f.lead.stage = e.dataset.stage; go("go=leads"); }));
    el.querySelectorAll("[data-rfq]").forEach((e) => (e.onclick = () => go("go=rfq&id=" + e.dataset.rfq)));
    el.querySelectorAll("[data-done]").forEach((b) => (b.onclick = () => guard(async () => { await call("kmr_crm_act_done", { p_id: b.dataset.done, p_done: true }); say("Done.", true); drawDash(); })));
  }

  /* ================= Leads ================= */
  async function drawLeads() {
    const f = S.f.lead, p = { q: f.q }; if (f.stage === "open") p.open = true; else if (f.stage) p.stage = f.stage;
    const list = (S.leads = await call("kmr_crm_lead_list", { p })), el = $("#leads"), can = canEdit();
    el.innerHTML = `<p class="guide">A lead is a possible customer. When they send drawings and ask for a price, press <b>Make RFQ</b> on the lead.</p>
      ${can ? `<div class="qadd"><div><label>Company</label><input id="qa_co" list="dl_parties" placeholder="Company name"></div><div><label>Contact person</label><input id="qa_ct"></div><div><label>Phone</label><input id="qa_ph" inputmode="tel"></div><div><label>Interested in</label><input id="qa_pi" placeholder="e.g. shafts, 500/month"></div><button class="btn" id="qa_add">Add lead</button></div><datalist id="dl_parties">${(S.L.parties || []).filter((x) => x.kind !== "supplier").map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist>` : ""}
      <div class="stg">${[["open", "Open"], ["", "All"]].concat(STAGES.map((s) => [s, s])).map(([k, t]) => `<button data-st="${esc(k)}" class="${f.stage === k ? "on" : ""}">${esc(t)}</button>`).join("")}</div>
      <div class="row"><input class="grow" id="lq" placeholder="Search lead no., company, contact, product…" value="${esc(f.q)}"><button class="btn o" id="lv">${f.view === "board" ? "Show list" : "Show board"}</button><button class="btn o" id="lp">Print register</button></div>
      ${list.length ? (f.view === "board" ? board(list) : `<div class="sc"><table class="tb2"><thead><tr><th>Lead</th><th>Company</th><th>Contact</th><th>Interested in</th><th>Stage</th><th>Value</th><th>Next follow-up</th></tr></thead><tbody>${list.map((l) => `<tr data-open="${l.id}"><td><b>${esc(l.no)}</b></td><td>${esc(l.company)}${l.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${esc(l.contact_name || "")}${l.phone ? "<br><small class='mut'>" + esc(l.phone) + "</small>" : ""}</td><td>${esc(l.product_interest || "")}</td><td>${chip(l.stage, STG[l.stage])}</td><td>${l.value ? C.lakh(l.value) : "—"}</td><td>${l.next_followup ? due(l.next_followup) : '<span class="mut">—</span>'}</td></tr>`).join("")}</tbody></table></div>`)
      : `<div class="empty">No leads here.<br>${can ? "Type a company above and press Add lead." : "Ask an editor to add leads."}</div>`}`;
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.stage = b.dataset.st; drawLeads(); }));
    let t; $("#lq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; drawLeads().then(() => { const i = $("#lq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    $("#lv").onclick = () => { f.view = f.view === "board" ? "list" : "board"; drawLeads(); }; $("#lp").onclick = () => showDoc(CRMDocs.leads(list, STAGES.includes(f.stage) ? f.stage : f.stage === "open" ? "Open leads" : "All leads"));
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => openLead(r.dataset.open)));
    el.querySelectorAll("[data-next]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const i = STAGES.indexOf(b.dataset.cs); guard(async () => { await call("kmr_crm_lead_stage", { p_id: b.dataset.next, p_stage: STAGES[Math.min(i + 1, 6)] }); drawLeads(); }); }));
    if (can) $("#qa_add").onclick = () => guard(async () => {
      const co = V("qa_co").trim(); if (!co) { say("Enter the company name."); $("#qa_co").focus(); return; }
      const ex = (S.L.parties || []).find((x) => x.name.toLowerCase() === co.toLowerCase());
      await call("kmr_crm_lead_save", { p: { company: co, party_id: ex ? ex.id : null, contact_name: V("qa_ct"), phone: V("qa_ph"), product_interest: V("qa_pi"), stage: "New", source: "" } }); say("Lead added.", true); drawLeads();
    });
  }
  function board(list) {
    const cols = STAGES.filter((s) => (S.f.lead.stage === "open" ? s !== "Won" && s !== "Lost" : !STAGES.includes(S.f.lead.stage) || s === S.f.lead.stage));
    return `<div class="board">${cols.map((s) => { const L = list.filter((l) => l.stage === s); return `<div class="col" style="--c:var(--${STG[s] === "g" ? "g" : STG[s] === "r" ? "r" : STG[s] === "a" ? "a" : "b1"})"><h4>${esc(s)} <span class="mut">${L.length}</span></h4>${L.map((l) => `<div class="lc" data-open="${l.id}"><b>${esc(l.company)}</b>${esc(l.product_interest || "")}<div class="m">${l.value ? C.lakh(l.value) + " · " : ""}${l.next_followup ? due(l.next_followup) : esc(l.no)}</div>${canEdit() && s !== "Won" && s !== "Lost" && s !== "Negotiation" ? `<button class="btn o s" style="margin-top:6px" data-next="${l.id}" data-cs="${esc(s)}">Move on →</button>` : ""}</div>`).join("") || '<div class="mut" style="padding:6px">—</div>'}</div>`; }).join("")}</div>`;
  }
  async function openLead(id) {
    await guard(async () => {
      const l = id ? await call("kmr_crm_lead_get", { p_id: id }) : { id: null, stage: "New", owner: S.L.me }, can = canEdit(), ro = can ? "" : " disabled";
      const acts = l.activities || [];
      openM(`<div class="row"><h3 style="margin:0;flex:1">${l.id ? esc(l.no) + " · " + esc(l.company) : "New lead"}</h3><button class="btn o s" id="x">✕</button></div>
        <fieldset style="border:0;padding:0;margin:0"${ro}><div class="frm">${fld("Company", "l_co", l.company, 'list="dl_p2"', "w")}<datalist id="dl_p2">${(S.L.parties || []).filter((x) => x.kind !== "supplier").map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist>
        ${fld("Contact person", "l_ct", l.contact_name)}${fld("Designation", "l_ds", l.designation)}${fld("Phone", "l_ph", l.phone, 'inputmode="tel"')}${fld("Email", "l_em", l.email, 'type="email"')}${fld("Where did this lead come from?", "l_so", l.source, 'placeholder="Website, reference, trade fair…"')}${fld("Interested in", "l_pi", l.product_interest, "", "w")}
        ${fld("Expected value (₹)", "l_va", l.value, 'inputmode="decimal"')}${fld("Expected order date", "l_ec", l.expected_close ? String(l.expected_close).slice(0, 10) : "", 'type="date"')}<div><label>Owner</label><select id="l_ow">${ownerOpts(l.owner)}</select></div>
        <div class="w"><label>Stage</label><div class="seg" id="l_st">${STAGES.map((s) => `<button type="button" data-s="${esc(s)}" class="${l.stage === s ? "on" : ""}">${esc(s)}</button>`).join("")}</div></div>
        <div class="w${l.stage === "Lost" ? "" : " hide"}" id="l_lw"><label>Why was it lost?</label><input id="l_lr" value="${esc(l.lost_reason || "")}" placeholder="Price, delivery, capacity, customer cancelled…"></div>
        <div class="w"><label>Notes</label><textarea id="l_no" rows="2">${esc(l.notes || "")}</textarea></div></div></fieldset>
        <div class="row" style="margin-top:12px">${can ? '<button class="btn" id="l_save">Save</button>' : ""}${can && l.id && !["Lost", "Won"].includes(l.stage) ? '<button class="btn o" id="l_rfq">Make RFQ</button>' : ""}${l.id && (l.rfqs || []).length ? (l.rfqs || []).map((r) => `<a class="btn o" href="#go=rfq&id=${r.id}">${esc(r.no)}</a>`).join("") : ""}${can && l.id ? '<button class="btn r" id="l_del" style="margin-left:auto">Delete</button>' : ""}</div>
        ${l.id ? `<div class="th"><h4 style="margin:0 0 6px">Follow-ups</h4>${actList(acts)}${can ? actAdd("lead") : ""}</div>` : ""}`);
      let stg = l.stage; $("#x").onclick = closeM;
      document.querySelectorAll("#l_st [data-s]").forEach((b) => (b.onclick = () => { if (!can) return; stg = b.dataset.s; document.querySelectorAll("#l_st [data-s]").forEach((x) => x.classList.toggle("on", x === b)); $("#l_lw").classList.toggle("hide", stg !== "Lost"); }));
      const collect = () => ({ id: l.id, party_id: ((S.L.parties || []).find((x) => x.name.toLowerCase() === V("l_co").trim().toLowerCase()) || {}).id || l.party_id || null, company: V("l_co"), contact_name: V("l_ct"), designation: V("l_ds"), phone: V("l_ph"), email: V("l_em"), source: V("l_so"), product_interest: V("l_pi"), value: V("l_va"), expected_close: V("l_ec"), owner: V("l_ow"), stage: stg, lost_reason: V("l_lr"), notes: V("l_no") });
      if (can) {
        $("#l_save").onclick = () => guard(async () => { await call("kmr_crm_lead_save", { p: collect() }); say("Saved.", true); closeM(); route(); });
        if ($("#l_rfq")) $("#l_rfq").onclick = () => guard(async () => { await call("kmr_crm_lead_save", { p: collect() }); const r = await call("kmr_crm_lead_to_rfq", { p_id: l.id }); await reloadL(); say("RFQ " + r.rfq_no + " created from the lead. Add the parts below.", true); closeM(); go("go=rfq&id=" + r.rfq_id); });
        if ($("#l_del")) $("#l_del").onclick = () => guard(async () => { if (!confirm("Delete this lead and its follow-ups?")) return; await call("kmr_crm_lead_delete", { p_id: l.id }); say("Lead deleted.", true); closeM(); route(); });
        wireActs(() => openLead(l.id), { lead_id: l.id, party_id: l.party_id });
      } else wireActs(null);
    });
  }

  /* ---------- follow-ups (shared by leads, customers and RFQs) ---------- */
  function actList(acts) { return acts.length ? acts.map((a) => `<div class="act${a.done ? " done" : ""}">${canEdit() ? `<button class="ck${a.done ? " on" : ""}" data-adone="${a.id}" data-v="${a.done ? 0 : 1}">${a.done ? "✓" : ""}</button>` : ""}<div style="flex:1"><div class="as">${esc(ACTK[a.kind] || a.kind)} · ${esc(a.subject)}</div><small class="mut">${a.done ? "done" : due(a.due_date)}${a.owner ? " · " + esc(a.owner) : ""}${a.notes ? " · " + esc(a.notes) : ""}</small></div>${canEdit() ? `<button class="btn o s" data-adel="${a.id}" title="Delete">✕</button>` : ""}</div>`).join("") : '<div class="mut" style="padding:4px 0 8px">No follow-ups yet.</div>'; }
  const actAdd = () => `<div class="qadd" style="margin-top:8px;grid-template-columns:1fr 2fr 1fr auto"><div><label>Kind</label><select id="a_k">${opts(Object.entries(ACTK), "call")}</select></div><div><label>What to do</label><input id="a_s" placeholder="e.g. Call about the drawings"></div><div><label>When</label><input id="a_d" type="date" value="${today()}"></div><button class="btn" id="a_add">Add</button></div>`;
  function wireActs(after, ctx) {
    document.querySelectorAll("[data-adone]").forEach((b) => (b.onclick = () => guard(async () => { await call("kmr_crm_act_done", { p_id: b.dataset.adone, p_done: b.dataset.v === "1" }); after && after(); })));
    document.querySelectorAll("[data-adel]").forEach((b) => (b.onclick = () => guard(async () => { await call("kmr_crm_act_delete", { p_id: b.dataset.adel }); after && after(); })));
    const a = $("#a_add"); if (a && ctx) a.onclick = () => guard(async () => { if (!V("a_s").trim()) { say("Write what the call, visit or task is about."); return; } await call("kmr_crm_act_save", { p: Object.assign({ kind: V("a_k"), subject: V("a_s"), due_date: V("a_d"), owner: S.L.me }, ctx) }); after && after(); });
  }
  async function reloadL() { const keep = S.L && S.L.role; S.L = await call("kmr_crm_load"); return keep; }

  /* ================= Customers, prospects, suppliers ================= */
  async function drawCust() {
    const f = S.f.party, list = await call("kmr_crm_party_list", { p: { q: f.q, kind: f.kind || null } }), el = $("#cust"), can = canEdit();
    el.innerHTML = `<p class="guide">Everyone you deal with: customers who send RFQs, prospects, and suppliers who quote you prices.</p>
      <div class="stg">${[["", "All"], ["customer", "Customers"], ["prospect", "Prospects"], ["supplier", "Suppliers"]].map(([k, t]) => `<button data-k="${k}" class="${f.kind === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="row"><input class="grow" id="pq" placeholder="Search name, code, city, GSTIN…" value="${esc(f.q)}">${can ? '<button class="btn" id="p_new">Add a company</button>' : ""}</div>
      ${list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>Code</th><th>Company</th><th>Type</th><th>City</th><th>Contact</th><th>RFQs</th></tr></thead><tbody>${list.map((p) => `<tr data-open="${p.id}"><td><b>${esc(p.code)}</b></td><td>${esc(p.name)}${p.sample ? ' <span class="pillw">sample</span>' : ""}${p.status === "inactive" ? " " + chip("inactive") : ""}</td><td>${esc(KINDS[p.kind] || p.kind)}</td><td>${esc(p.city || "")}</td><td>${esc(p.contact_name || "")}${p.contact_phone ? "<br><small class='mut'>" + esc(p.contact_phone) + "</small>" : ""}</td><td>${p.rfqs ? p.rfqs + (p.open_rfqs ? ` <small class="mut">(${p.open_rfqs} open)</small>` : "") : "—"}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No companies here yet.</div>'}`;
    el.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { f.kind = b.dataset.k; drawCust(); }));
    let t; $("#pq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; drawCust().then(() => { const i = $("#pq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    if (can) $("#p_new").onclick = () => openParty(null, f.kind === "supplier" ? "supplier" : "customer");
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => openParty(r.dataset.open)));
  }
  async function openParty(id, kind0) {
    await guard(async () => {
      const p = id ? await call("kmr_crm_party_get", { p_id: id }) : { id: null, kind: kind0 || "customer", country: "India", status: "active", contacts: [], rfqs: [], activities: [] }, can = canEdit();
      openM(`<div class="row"><h3 style="margin:0;flex:1">${p.id ? esc(p.code) + " · " + esc(p.name) : "Add a company"}</h3><button class="btn o s" id="x">✕</button></div>
        <fieldset style="border:0;padding:0;margin:0"${can ? "" : " disabled"}><div class="frm">${fld("Company name", "p_na", p.name, "", "w")}<div><label>Type</label><select id="p_ki">${opts(Object.entries(KINDS), p.kind)}</select></div>${fld("Industry / what they make", "p_in", p.industry)}
        ${fld("GSTIN", "p_gs", p.gstin, 'style="text-transform:uppercase"')}${fld("PAN", "p_pa", p.pan)}${fld("Address", "p_ad", p.address, "", "w")}${fld("City", "p_ci", p.city)}${fld("State", "p_sa", p.state)}${fld("PIN code", "p_pi", p.pincode)}${fld("Payment terms", "p_pt", p.payment_terms, 'placeholder="30 days from invoice"')}${fld("Credit days", "p_cd", p.credit_days, 'inputmode="numeric"')}
        <div><label>Owner</label><select id="p_ow">${ownerOpts(p.owner)}</select></div><div><label>Status</label><select id="p_st">${opts([["active", "Active"], ["inactive", "Inactive"]], p.status)}</select></div>
        ${p.id ? "" : `<div class="w"><b>First contact person</b></div>${fld("Name", "c_na", "")}${fld("Designation", "c_de", "")}${fld("Mobile", "c_mo", "", 'inputmode="tel"')}${fld("Email", "c_em", "", 'type="email"')}`}
        <div class="w"><label>Notes</label><textarea id="p_no" rows="2">${esc(p.notes || "")}</textarea></div></div></fieldset>
        <div class="row" style="margin-top:12px">${can ? '<button class="btn" id="p_save">Save</button>' : ""}${can && p.id ? '<button class="btn r" id="p_del" style="margin-left:auto">Delete</button>' : ""}</div>
        ${p.id ? `<div class="th"><h4 style="margin:0 0 6px">Contact people</h4>${(p.contacts || []).map((c) => `<div class="act"><div style="flex:1"><div class="as"><b>${esc(c.name)}</b>${c.is_primary ? " " + chip("main", "b") : ""} ${c.designation ? "· " + esc(c.designation) : ""}</div><small class="mut">${[c.mobile || c.phone, c.email].filter(Boolean).map(esc).join(" · ")}</small></div>${can ? `<button class="btn o s" data-cedit="${c.id}">Edit</button><button class="btn o s" data-cdel="${c.id}">✕</button>` : ""}</div>`).join("") || '<div class="mut">No contact people yet.</div>'}
          ${can ? `<div class="qadd" style="margin-top:8px;grid-template-columns:1.2fr 1fr 1fr 1.2fr auto"><div><label>Name</label><input id="k_na"></div><div><label>Designation</label><input id="k_de"></div><div><label>Mobile</label><input id="k_mo" inputmode="tel"></div><div><label>Email</label><input id="k_em" type="email"></div><button class="btn" id="k_add">Add</button></div><label class="cl"><input type="checkbox" id="k_pr"> <span>Main contact</span></label>` : ""}</div>
          ${p.kind !== "supplier" ? `<div class="th"><h4 style="margin:0 0 6px">RFQs</h4>${(p.rfqs || []).map((r) => `<div class="act" data-rfq="${r.id}" style="cursor:pointer"><div style="flex:1"><b>${esc(r.no)}</b> ${r.customer_ref ? "· " + esc(r.customer_ref) : ""} ${chip(r.status, RST[r.status])}<br><small class="mut">received ${fmt(r.received_on)}${r.value ? " · " + C.lakh(r.value) : ""}</small></div></div>`).join("") || '<div class="mut">No RFQs yet.</div>'}${can && hasF("crm.rfq-costing") && p.kind !== "supplier" ? `<div style="margin-top:8px"><a class="btn o" href="#go=rfq&new=1&party=${p.id}">New RFQ for this customer</a></div>` : ""}</div>` : ""}
          <div class="th"><h4 style="margin:0 0 6px">Follow-ups</h4>${actList(p.activities || [])}${can ? actAdd() : ""}</div>` : ""}`);
      $("#x").onclick = closeM; document.querySelectorAll("[data-rfq]").forEach((e) => (e.onclick = () => go("go=rfq&id=" + e.dataset.rfq)));
      if (can) {
        $("#p_save").onclick = () => guard(async () => {
          const o = { id: p.id, name: V("p_na"), kind: V("p_ki"), industry: V("p_in"), gstin: V("p_gs"), pan: V("p_pa"), address: V("p_ad"), city: V("p_ci"), state: V("p_sa"), pincode: V("p_pi"), payment_terms: V("p_pt"), credit_days: V("p_cd"), owner: V("p_ow"), status: V("p_st"), notes: V("p_no"), country: p.country };
          if (!p.id) o.contact = { name: V("c_na"), designation: V("c_de"), mobile: V("c_mo"), email: V("c_em") };
          await call("kmr_crm_party_save", { p: o }); await reloadL(); say("Saved.", true); closeM(); route();
        });
        if ($("#p_del")) $("#p_del").onclick = () => guard(async () => { if (!confirm("Delete this company and its contact people?")) return; await call("kmr_crm_party_delete", { p_id: p.id }); await reloadL(); say("Deleted.", true); closeM(); route(); });
        const kk = (c) => ({ id: c ? c.id : null, party_id: p.id, name: V("k_na"), designation: V("k_de"), mobile: V("k_mo"), email: V("k_em"), is_primary: V("k_pr") });
        if ($("#k_add")) $("#k_add").onclick = () => guard(async () => { await call("kmr_crm_contact_save", { p: kk(null) }); await reloadL(); openParty(p.id); });
        document.querySelectorAll("[data-cdel]").forEach((b) => (b.onclick = () => guard(async () => { await call("kmr_crm_contact_delete", { p_id: b.dataset.cdel }); await reloadL(); openParty(p.id); })));
        document.querySelectorAll("[data-cedit]").forEach((b) => (b.onclick = () => { const c = p.contacts.find((x) => x.id === b.dataset.cedit); $("#k_na").value = c.name; $("#k_de").value = c.designation || ""; $("#k_mo").value = c.mobile || c.phone || ""; $("#k_em").value = c.email || ""; $("#k_pr").checked = !!c.is_primary;
          const a = $("#k_add"); a.textContent = "Update"; a.onclick = () => guard(async () => { await call("kmr_crm_contact_save", { p: kk(c) }); await reloadL(); openParty(p.id); }); }));
        wireActs(() => openParty(p.id), { party_id: p.id });
      } else wireActs(null);
    });
  }

  /* ================= start ================= */
  window.CRM = { S, C, STAGES, STG, RST, QST, KINDS, ACTK, esc, fmt, say, call, V, opts, fld, chip, due, hasF, today, canEdit, isAdmin, money, hashParts, setGo, go, route, openM, closeM, ask, showDoc, closeDoc, guard, reloadL, actList, actAdd, wireActs, ownerOpts, partiesOf, $ };
  async function start() {
    try {
      await QP.init("crm"); if (!QP.ctx) return;
      S.L = await call("kmr_crm_load"); $("#role").textContent = S.L.role;
      const stab = document.querySelector('.tab[data-t="setup"]'); if (stab && !isAdmin()) stab.classList.add("hide");
      window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
      if (!location.hash) setGo("go=dash"); await route();
    } catch (e) { say(e.message); }
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
