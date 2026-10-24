/* Internal Audit - screens: Standards alignment, Dashboard, Audit programme, one-page audit (details, clause checklist with automatic Major/Minor, findings), Findings and corrective actions (aud-nc.js), Special points, Clause library, Setup.
   Data calls are kmr_aud_* (database) or aud-demo.js (?demo=1). The rules (independence, every question answered, Major or Minor decided by rules, root cause not a person, effect checked before closing)
   are enforced by the database; the messages are shown as they come. Clause library: aud-lib.js. Rules: aud-engine.js. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP;
  const TYPES = Object.keys(AudLib.TYPES).map((k) => [k, AudLib.TYPES[k].name, AudLib.TYPES[k].desc]);
  const SHIFTS = ["A", "B", "C", "General"];
  const RLABEL = { 6: "Partly met", OK: "Meets the requirement", Minor: "Minor finding", Major: "Major finding", Observation: "Observation, no action needed", NA: "Not applicable", 10: "Fully met", 8: "Small gap", 4: "Large gap", 0: "Not met", "": "" };
  const FIND = (r) => ["Minor", "Major", "8", "6", "4", "0"].includes(String(r));
  const STAT = { planned: ["Planned", "b"], reported: ["Report issued", "a"], closed: ["Closed", "g"], cancelled: ["Cancelled", "x"] };
  const S = { L: null, a: null, dirty: false, year: null, f: { q: "", status: "open", type: "" }, af: { status: "open", owner: "", overdue: false, q: "" } };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => (Array.isArray(x) ? x : [x, x])).map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const today = () => (S.L && S.L.today) || QP.today();
  const canEdit = () => !!QP.canEdit, isAdmin = () => S.L && S.L.role === "admin";
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const chip = (t, cls) => `<span class="chip ${cls || "x"}">${esc(t)}</span>`;
  const guard = async (fn) => { try { return await fn(); } catch (e) { say(e.message); return undefined; } };
  const rid = () => Math.random().toString(16).slice(2, 10);
  const due = (d, done) => { if (!d) return '<span class="mut">no date</span>'; const t = today(), s = String(d).slice(0, 10); return !done && s < t ? `<span class="late">${fmt(s)} · late</span>` : !done && s === t ? '<span class="today">Today</span>' : `<span>${fmt(s)}</span>`; };
  const dl = () => `<datalist id="own">${(S.L.owners || []).map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`;
  const go = (h) => { if (!leave()) return; setGo(h); route(); window.scrollTo(0, 0); };
  const leave = () => !S.dirty || confirm("You have changes that are not saved. Leave without saving?");
  const ratings = (type) => AudLib.ratings(type);
  function score(list) { const r = list.filter((x) => ["10", "8", "6", "4", "0"].includes(String(x.rating))); if (!r.length) return null; const sc = Math.round((r.reduce((s, x) => s + Number(x.rating), 0) * 1000) / (10 * r.length)) / 10; let g = sc >= 90 ? "A" : sc >= 80 ? "B" : "C"; if (g === "A" && r.some((x) => String(x.rating) === "0")) g = "B"; return { score: sc, grade: g }; }
  const GC = { A: "g", B: "a", C: "r" };

  /* ---------- printed form ---------- */
  const closeM = () => { const m = $("#m"); if (m) { m.classList.remove("on"); $("#mb").innerHTML = ""; } };
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
  const SECS = ["std", "dash", "list", "rep", "prog", "nc", "ncd", "pts", "lib", "acts", "setup"], TABS = ["std", "dash", "list", "nc", "pts", "lib", "acts", "setup"];
  async function route() {
    closeM(); closeDoc(); const hp = hashParts(); const g0 = TABS.includes(hp.go) ? hp.go : "std";
    const sec = g0 === "list" && (hp.id || hp.new) ? "rep" : g0 === "list" && hp.prog ? "prog" : g0 === "nc" && hp.id ? "ncd" : g0;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === g0)); SECS.forEach((s) => $("#" + s).classList.toggle("hide", s !== sec)); say("");
    try {
      if (sec === "std") KMRStd.draw($("#std"), "aud");
      else if (sec === "dash") await drawDash();
      else if (sec === "list") await drawList();
      else if (sec === "rep") await drawAudit(hp);
      else if (sec === "acts") await drawActs();
      else if (AUD.screens[sec]) await AUD.screens[sec](hp);
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);

  /* ================= Dashboard ================= */
  async function drawDash() {
    const d = await call("kmr_aud_dashboard", { p_year: S.year || null }), el = $("#dash"), kp = (h, c, b, l, sub) => `<div class="kpi" style="--c:${c}" data-go="${h}"><b>${b}</b><span>${l}</span>${sub ? `<small class="mut" style="display:block">${sub}</small>` : ""}</div>`;
    const bt = d.by_type || {}, cov = d.shifts || [], yr = d.year;
    el.innerHTML = `<div class="guide">The year's audit programme at a glance: how many audits are done, what is late, and whether every shift has been audited.</div>
      <div class="row"><label class="lbl" style="margin:0">Year</label><select id="d_y" style="width:auto">${opts([yr - 1, yr, yr + 1].map((y) => [y, y]), yr)}</select></div>
      <div class="kpis">${kp("go=list", "var(--b1)", d.completion == null ? "—" : d.completion + "%", "programme done", d.done + " of " + d.planned + " audits")}${kp("go=list", d.late_audits ? "var(--r)" : "var(--g)", d.late_audits, "audits late", d.late_audits ? "planned date has passed" : "none late")}
      ${kp("go=acts", d.overdue_actions ? "var(--r)" : "var(--a)", d.open_actions, "open actions", d.overdue_actions ? d.overdue_actions + " late" : "none late")}${kp("go=acts", d.unchecked ? "var(--a)" : "var(--g)", d.unchecked, "to be checked", "done, effect not yet checked")}
      ${kp("go=list", d.avg_score == null ? "var(--mut)" : d.avg_score >= 90 ? "var(--g)" : d.avg_score >= 80 ? "var(--a)" : "var(--r)", d.avg_score == null ? "—" : d.avg_score + "%", "process score", "average, last 12 months")}</div>
      <div class="two"><div class="card"><h3>Audits by type</h3>${TYPES.map((t) => { const x = bt[t[0]] || { planned: 0, done: 0 }; return `<div class="bl" style="display:grid;grid-template-columns:110px 1fr 70px;gap:8px;align-items:center;margin:6px 0"><span>${t[1]}</span><span style="background:var(--bg);border-radius:6px;height:12px;display:block"><i style="display:block;height:12px;border-radius:6px;width:${x.planned ? Math.max(3, (x.done / x.planned) * 100) : 0}%;background:linear-gradient(90deg,var(--b1),var(--b2))"></i></span><b>${x.done}/${x.planned}</b></div>`; }).join("")}
        <h3 style="margin-top:14px">Shifts audited this year</h3><div class="cov">${["A", "B", "C"].map((s) => `<span class="${cov.includes(s) ? "y" : "n"}">Shift ${s}<br><small>${cov.includes(s) ? "covered" : "not yet"}</small></span>`).join("")}</div>
        <small class="mut">A finished audit marked with a shift counts for that shift. Audit the night shift too.</small></div>
      <div class="card"><h3>Coming up</h3>${(d.upcoming || []).length ? d.upcoming.map((r) => `<div class="act" data-a="${r.id}" style="cursor:pointer;padding:6px 0;border-bottom:1px solid var(--line)"><div class="as"><b>${esc(r.no)}</b> · ${esc(r.title)}</div><small class="mut">${esc(r.type)} · ${esc(r.auditor || "no auditor")} · ${due(r.planned_on)}</small></div>`).join("") : '<div class="empty">No audit planned.</div>'}</div></div>
      <div class="two"><div class="card"><h3>Late actions</h3>${(d.late_actions || []).length ? d.late_actions.map((a) => `<div class="act" data-a="${a.audit_id}" style="cursor:pointer;padding:6px 0;border-bottom:1px solid var(--line)"><div class="as">${esc(a.text)}</div><small class="mut"><b>${esc(a.audit_no)}</b> · ${esc(a.owner || "no owner")} · ${due(a.due_on)}</small></div>`).join("") : '<div class="empty">No late actions.</div>'}</div>
      <div class="card"><h3>Latest results</h3>${(d.recent || []).length ? d.recent.map((r) => `<div class="act" data-a="${r.id}" style="cursor:pointer;padding:6px 0;border-bottom:1px solid var(--line)"><div class="as"><b>${esc(r.no)}</b> · ${esc(r.title)} ${r.grade ? chip(r.grade + " · " + r.score + "%", GC[r.grade]) : ""}</div><small class="mut">${esc(r.type)} · ${fmt(r.done_on)}</small></div>`).join("") : '<div class="empty">No finished audit yet.</div>'}</div></div>`;
    $("#d_y").onchange = (e) => { S.year = +e.target.value; guard(drawDash); };
    el.querySelectorAll("[data-go]").forEach((e) => (e.onclick = () => { S.f.status = "open"; go(e.dataset.go); }));
    el.querySelectorAll("[data-a]").forEach((e) => (e.onclick = () => go("go=list&id=" + e.dataset.a)));
    if (AUD.screens.dash2) { const d2 = document.createElement("div"); d2.id = "dash2"; el.append(d2); await AUD.screens.dash2(d2, d); }
  }

  /* ================= Audit programme ================= */
  async function drawList() {
    const f = S.f, el = $("#list"), can = canEdit();
    el.innerHTML = `<div class="guide">Plan every audit of the year here, then open one to fill the checklist, record findings and follow the actions on a single page.</div>
      <div class="row"><div class="grow"><input id="l_q" placeholder="Search number, title, area, auditor…" value="${esc(f.q)}"></div><select id="l_ty" style="width:auto"><option value="">All types</option>${opts(TYPES.map((t) => [t[0], t[1]]), f.type)}</select>
      <div class="seg" style="margin:0">${[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map((x) => `<button data-st="${x[0]}" class="${f.status === x[0] ? "on" : ""}">${x[1]}</button>`).join("")}</div>
      ${can ? '<button class="btn" id="l_new">+ Plan an audit</button><button class="btn o" id="l_gen">Make the year\'s programme</button>' : ""}<button class="btn o" id="l_pr">Print programme</button></div><div id="l_body"></div>`;
    const load = async () => {
      const list = await call("kmr_aud_audit_list", { p: { q: f.q, status: f.status, type: f.type } }); S.list = list;
      $("#l_body").innerHTML = list.length ? list.map((r) => { const s = STAT[r.status] || ["", "x"]; return `<div class="t ${r.status === "closed" || r.status === "cancelled" ? "fin" : ""}" data-a="${r.id}" style="--pc:var(--${r.late ? "r" : r.status === "closed" ? "g" : "b1"})"><div class="tb"><div class="tt">${esc(r.title)}</div>
        <div class="tm"><b>${esc(r.no)}</b> ${chip(r.type, "v")} ${chip(s[0], s[1])}${r.late ? chip("Late", "r") : ""}${r.grade ? chip("Grade " + r.grade + " · " + r.score + "%", GC[r.grade]) : ""}<span>${esc(r.area || "")}</span></div>
        <div class="tm"><span>${r.status === "planned" ? "planned " + due(r.planned_on) : "done " + fmt(r.done_on)}</span><span>${esc(r.auditor || "no auditor")}${r.auditee ? " → " + esc(r.auditee) : ""}</span>${(r.shifts || []).length ? "<span>shift " + r.shifts.map(esc).join(", ") + "</span>" : ""}${r.findings ? chip(r.findings + " finding" + (r.findings > 1 ? "s" : ""), "a") : ""}${r.ncs_open ? chip(r.ncs_open + " finding" + (r.ncs_open > 1 ? "s" : "") + " open", "r") : ""}${r.actions_open ? chip(r.actions_open + " open action" + (r.actions_open > 1 ? "s" : ""), r.actions_overdue ? "r" : "b") : ""}</div></div></div>`; }).join("")
        : `<div class="empty">${f.q || f.type || f.status !== "all" ? "No audit matches." : "No audit planned yet."}${can ? "<br>Press <b>+ Plan an audit</b> to start the programme." : ""}</div>`;
      el.querySelectorAll("[data-a]").forEach((e) => (e.onclick = () => go("go=list&id=" + e.dataset.a)));
    };
    let tm; $("#l_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    $("#l_ty").onchange = (e) => { f.type = e.target.value; guard(load); };
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    if (can) { $("#l_new").onclick = () => go("go=list&new=1"); $("#l_gen").onclick = () => go("go=list&prog=1"); }
    $("#l_pr").onclick = () => showDoc(AudDocs.register(S.list || [], [f.status, f.type].filter((x) => x && x !== "all").join(", ")));
    await load();
  }

  /* ================= one audit on one page ================= */
  const LB = () => window.AudLib, EN = () => window.AudEngine;
  const FREQ = { Monthly: 30, Quarterly: 90, "Half-yearly": 182, Yearly: 365 };
  const isF = (x) => FIND(x.rating) || ["Major", "Minor"].includes(x.sev);
  const stdName = (x) => (LB().STD[x.std] || x.std || "").replace(/ requirements$/, "");
  /* open special points that apply to this audit become questions of the checklist */
  function pointQs(area) {
    const ar = String(area || "").toLowerCase(), td = today();
    return (S.points || []).filter((p) => p.status === "open" && (p.frequency === "Every audit" || (p.frequency === "One time" ? !p.last_checked : !p.last_checked || (new Date(td) - new Date(p.last_checked)) / 864e5 >= (FREQ[p.frequency] || 0)))
      && (!p.applies || !ar || ar.includes(String(p.applies).toLowerCase()) || String(p.applies).toLowerCase().includes(ar)))
      .map((p) => ({ id: rid(), q: p.title, ref: p.standard + " " + p.clause, cl: p.clause, std: "", ev: p.check_how || "", w: 1, cat: "mgt", pt: p.id, ans: "", rating: "", note: "" }));
  }
  const build = (a) => { const m = a.meta || {}; return LB().make(a.type, m.sets && m.sets.length ? m.sets : null, m.proc || "all").concat(pointQs(a.area)); };
  const blank = () => ({ id: null, no: "(new)", title: "", type: "System", status: "planned", area: "", scope: "", planned_on: "", done_on: "", auditor: "", auditee: "", shifts: [], summary: "", checklist: [], meta: { proc: "all", sets: null }, actions: [], log: [], can_edit: true, can_act: false, ratings: ratings("System"), has_scoring: S.L.has_scoring });
  function repeatOf(x, a) {
    const cl = String(x.cl || "").trim().toLowerCase(), ar = String(a.area || "").trim().toLowerCase(); if (!cl) return null;
    return (S.hist || []).find((h) => h.audit_id !== a.id && String(h.clause || "").trim().toLowerCase() === cl && String(h.area || "").trim().toLowerCase() === ar) || null;
  }
  /* the rules decide Major or Minor from the answer and the facts; the auditor does not pick the severity */
  function grade(x, a) {
    const ans = x.ans || EN().ansOf(x); x.ans = ans; const rep = repeatOf(x, a);
    const r = EN().classify(x, { ans, n: x.n, f: x.f, imp: x.imp, absent: x.absent, repeat: rep });
    x.rating = ans ? r.rating : ""; x.sev = r.sev; x.rule = r.why.join(" "); x.rep = rep ? rep.no : "";
    return x;
  }
  const setsSel = () => { const a = S.a, t = LB().TYPES[a.type]; if (!t || t.sets.length < 2) return null; const on = t.sets.filter((s) => $("#set_" + s[0]) && $("#set_" + s[0]).checked).map((s) => s[0]); return on.length ? on : null; };
  function collect() {
    const a = S.a; if (!a.can_edit) return;
    a.title = V("a_ti"); a.type = V("a_ty"); a.area = V("a_ar"); a.scope = V("a_sc"); a.planned_on = V("a_pl"); a.done_on = V("a_dn"); a.auditor = V("a_au"); a.auditee = V("a_ae"); a.summary = V("a_su");
    a.meta = Object.assign({}, a.meta, { proc: V("a_pc") || (a.meta || {}).proc || "all", sets: $("#a_pc") ? setsSel() : (a.meta || {}).sets });
    a.shifts = SHIFTS.filter((s) => $("#sh_" + s) && $("#sh_" + s).checked);
    const old = {}; (a.checklist || []).forEach((x) => (old[x.id] = x));
    a.checklist = [...$("#rep").querySelectorAll(".cr")].map((r) => {
      const o = old[r.dataset.q] || {}, g = (k) => { const e = r.querySelector('[data-f="' + k + '"]'); return e ? e.value : ""; };
      const x = Object.assign({}, o, { id: r.dataset.q, q: g("q"), ref: g("ref"), note: g("note") });
      if (r.dataset.legacy) return x; /* an older audit: keep the rating it already has */
      x.ans = r.dataset.ans || ""; if (r.querySelector('[data-f="n"]')) { x.n = g("n"); x.f = g("f"); x.imp = g("imp"); x.absent = !!r.querySelector('[data-f="absent"]').checked; } else if (!["part", "no", "8", "6", "4", "0"].includes(x.ans)) { x.n = ""; x.f = ""; x.imp = ""; x.absent = false; }
      return grade(x, a);
    });
  }
  const dirty = () => { S.dirty = true; const b = $("#sv_note"); if (b) b.textContent = "Not saved yet"; };
  /* every finding gets its own corrective-action record, created with the facts and dates the rules give */
  async function syncNcs() {
    const a = S.a; if (!a.id || !["planned", "reported"].includes(a.status)) return 0;
    const have = new Set((S.ncs || []).map((n) => n.q_id)); let made = 0;
    for (const x of a.checklist || []) {
      if (!isF(x) || have.has(x.id)) continue;
      const sev = ["Major", "Minor"].includes(x.sev) ? x.sev : ["4", "0", "Major"].includes(String(x.rating)) ? "Major" : "Minor", dd = EN().dueFor(sev, a.done_on || today(), S.L.settings);
      await call("kmr_aud_nc_save", { p: { audit_id: a.id, q_id: x.id, severity: sev, rule_text: x.rule || "", repeat_of: x.rep || "", clause: x.cl || x.ref || "", standard: stdName(x) || (x.pt ? x.ref : ""), requirement: x.q, cat: x.cat || "cap",
        problem: (String(x.note || "").trim() ? x.note : "Details to be added.") + " (Requirement: " + x.q + ")", evidence: x.note || "", area: a.area || "", owner: a.auditee || "", resp_due: dd.response, contain_due: dd.contain } });
      made++;
    }
    if (made) S.ncs = await call("kmr_aud_nc_list", { p: { audit_id: a.id, status: "all" } });
    return made;
  }
  async function saveAudit() {
    collect(); const a = S.a;
    const o = { title: a.title, type: a.type, area: a.area, scope: a.scope, planned_on: a.planned_on, done_on: a.done_on, auditor: a.auditor, auditee: a.auditee, shifts: a.shifts, summary: a.summary, checklist: a.checklist, meta: a.meta };
    if (a.id) o.id = a.id; const res = await call("kmr_aud_audit_save", { p: o }); S.dirty = false; if (!a.id) { a.id = res.id; S.ncs = []; }
    await syncNcs(); return res;
  }
  async function loadRefs() {
    try { S.hist = await call("kmr_aud_nc_history", { p: {} }); } catch (e) { S.hist = []; }
    try { S.points = await call("kmr_aud_point_list", { p: { status: "open" } }); } catch (e) { S.points = []; }
  }
  async function reload() { S.a = await call("kmr_aud_audit_get", { p_id: S.a.id }); S.a.has_scoring = S.a.has_scoring && S.L.has_scoring; S.a.meta = S.a.meta || {}; S.ncs = await call("kmr_aud_nc_list", { p: { audit_id: S.a.id, status: "all" } }); paint(); }
  const IMP = [["", "Choose…"], ["none", "No effect seen"], ["internal", "Internal only, did not leave the plant"], ["customer", "Reached, or could reach, the customer"], ["safety", "Safety, legal or regulatory"]];
  const cr = (x, i, a) => {
    const ro = !a.can_edit, legacy = !x.ans && !!x.rating, ans = x.ans || EN().ansOf(x), bad = ["part", "no", "8", "6", "4", "0"].includes(ans) && !legacy;
    const res = ["Major", "Minor"].includes(x.sev) ? x.sev : legacy && FIND(x.rating) ? (["4", "0", "Major"].includes(String(x.rating)) ? "Major" : "Minor") : "";
    const cls = !ans ? "" : res === "Major" ? "bad" : res === "Minor" ? "fnd" : "ok";
    const btns = EN().answers(a.type).map((v) => `<button type="button" data-v="${v[0]}" class="${ans === v[0] ? "on" : ""}" title="${esc(v[2])}" ${ro ? "disabled" : ""}>${esc(v[1])}</button>`).join("");
    const how = bad ? `<div class="how" style="grid-column:1/-1"><div><label class="lbl">Samples checked</label><input data-f="n" type="number" min="0" value="${esc(x.n == null ? "" : x.n)}" ${ro ? "disabled" : ""}></div><div><label class="lbl">Samples that failed</label><input data-f="f" type="number" min="0" value="${esc(x.f == null ? "" : x.f)}" ${ro ? "disabled" : ""}></div>
      <div class="w2"><label class="lbl">Effect of the failure</label><select data-f="imp" ${ro ? "disabled" : ""}>${opts(IMP, x.imp || "")}</select></div><label class="cl w2"><input type="checkbox" data-f="absent" ${x.absent ? "checked" : ""} ${ro ? "disabled" : ""}> <span>Nothing exists for this requirement (no procedure, process or record system)</span></label></div>` : "";
    const auto = res && !legacy ? `<div class="auto ${res === "Major" ? "mj" : "mn"}"><span class="chip ${res === "Major" ? "r" : "a"}">${res} · decided by the rules</span> <span class="mut">${esc(x.rule || "")}</span></div>` : ans === "obs" ? '<div class="auto"><span class="chip x">Observation</span> <span class="mut">Met, but a risk or chance to improve was seen. No corrective action is needed.</span></div>' : legacy && res ? `<div class="auto"><span class="chip ${res === "Major" ? "r" : "a"}">${res}</span> <span class="mut">Rated in an earlier version of the app.</span></div>` : "";
    return `<div class="cr ${cls}" data-q="${esc(x.id)}" data-ans="${esc(ans)}"${legacy ? ' data-legacy="1"' : ""}><div class="qn"><textarea data-f="q" rows="2" ${ro ? "disabled" : ""}>${esc(x.q)}</textarea><input data-f="ref" placeholder="Clause / reference" value="${esc(x.ref || "")}" ${ro ? "disabled" : ""}></div>
      ${x.w ? `<div style="grid-column:1/-1">${chip(x.w === 2 ? "Critical requirement" : "Important requirement", x.w === 2 ? "r" : "a")}${x.pt ? " " + chip("Special audit point", "v") : ""}${x.ev ? ` <span class="mut" style="font-size:12.5px">Look at: ${esc(x.ev)}</span>` : ""}</div>` : x.ev ? `<div class="mut" style="grid-column:1/-1;font-size:12.5px">Look at: ${esc(x.ev)}</div>` : ""}
      <div class="rt" style="grid-column:1/-1">${btns}</div>${how}
      <input data-f="note" placeholder="What was seen: evidence, record number, sample… (needed for every finding)" value="${esc(x.note || "")}" style="grid-column:1/-1" ${ro ? "disabled" : ""}>${auto ? `<div style="grid-column:1/-1">${auto}</div>` : ""}${ro ? "" : '<button class="btn o s" data-del title="Remove this question" style="grid-column:1/-1;justify-self:end">Remove question</button>'}</div>`;
  };
  const STG = ["contain", "rca", "action", "monitor", "closed"], STGN = { contain: "1 Contain", rca: "2 Root cause", action: "3 Permanent action", monitor: "4 Check effect", closed: "Closed", cancelled: "Cancelled" };
  const dotsOf = (st) => { const k = STG.indexOf(st); return `<span class="dots" title="${esc(STGN[st] || st)}">${STG.slice(0, 4).map((s, i) => `<i class="${i < k || st === "closed" ? "d" : i === k ? "c" : ""}"></i>`).join("")}</span>`; };
  const ncCard = (n) => `<div class="ncc" data-nc="${n.id}"><div class="row" style="margin:0;gap:8px"><b>${esc(n.no)}</b> ${chip(n.severity, n.severity === "Major" ? "r" : "a")} ${chip(STGN[n.status] || n.status, n.status === "closed" ? "g" : n.overdue ? "r" : "b")} ${dotsOf(n.status)}<span class="mut">${esc(n.owner || "")}</span><span>${n.status === "closed" ? "closed " + fmt(n.closed_on) : "next step due " + due(n.next_due)}</span><span style="flex:1"></span><button class="btn s" data-open="${n.id}">Open the finding</button></div></div>`;
  const actRow = (x, ro) => `<div class="ab ${x.status === "done" ? "done" : x.due_on && x.due_on < today() ? "late" : ""}" data-act="${x.id}" style="grid-template-columns:1.6fr 1fr 130px auto auto"><input data-af="text" value="${esc(x.text)}" ${ro ? "disabled" : ""}><input data-af="owner" list="own" value="${esc(x.owner || "")}" placeholder="Owner" ${ro ? "disabled" : ""}>
    <input data-af="due_on" type="date" value="${esc(x.due_on || "")}" ${ro ? "disabled" : ""}><label class="cl"><input type="checkbox" data-af="done"${x.status === "done" ? " checked" : ""} ${ro ? "disabled" : ""}> <span>Done</span></label><label class="cl"><input type="checkbox" data-af="verified"${x.verified ? " checked" : ""} ${ro || x.status !== "done" ? "disabled" : ""}> <span>Effective</span></label>
    <div class="ex"><input data-af="evidence" value="${esc(x.evidence || "")}" placeholder="Evidence the action was done: record, photo, document no." ${ro ? "disabled" : ""}>${!ro && S.a.status === "planned" ? '<button class="btn o s" data-adel title="Remove">✕</button>' : "<span></span>"}</div></div>`;
  function findingsHtml() {
    const a = S.a, fl = (a.checklist || []).filter(isF), nc = (q) => (S.ncs || []).find((n) => n.q_id === q);
    const blocks = fl.map((x) => {
      const n = nc(x.id), sev = n ? n.severity : ["Major", "Minor"].includes(x.sev) ? x.sev : ["4", "0", "Major"].includes(String(x.rating)) ? "Major" : "Minor", old = (a.actions || []).filter((y) => y.q_id === x.id);
      return `<div class="fb" style="border-left-color:var(--${sev === "Major" ? "r" : "a"})"><h5>${chip(sev, sev === "Major" ? "r" : "a")} ${x.cl ? esc(x.cl) + " · " : ""}${esc(x.q)}</h5>${x.note ? `<div class="mut" style="margin-bottom:6px">${esc(x.note)}</div>` : '<div class="wh" style="margin:0 0 6px">Write what was seen in the question above.</div>'}
        ${n ? ncCard(n) : '<div class="mut">The finding record (containment, root cause, action, effect check) is created when you save the audit.</div>'}${old.length ? `<div style="margin-top:8px"><small class="mut">Actions recorded in an earlier version:</small>${old.map((y) => actRow(y, !a.can_act)).join("")}</div>` : ""}</div>`;
    }).join("");
    const other = (a.actions || []).filter((y) => !fl.some((x) => x.id === y.q_id));
    return (a.id ? "" : '<div class="mut">Save the audit first; then each finding gets its own record here.</div>') + (blocks || (a.id ? '<div class="empty">No finding. A question answered Partly, Does not meet or rated below 10 becomes a finding.</div>' : "")) +
      (other.length ? `<div class="fb" style="border-left-color:var(--mut)"><h5>Other actions (not tied to one question)</h5>${other.map((y) => actRow(y, !a.can_act)).join("")}</div>` : "");
  }
  const scoreHtml = (a) => { const sc = a.type === "Process" && a.has_scoring ? (a.status === "planned" ? score(a.checklist) : a.score != null ? { score: a.score, grade: a.grade } : null) : null;
    return sc ? `<div class="score"><span class="big">${sc.score}%</span><div>${chip("Grade " + sc.grade, GC[sc.grade])}<div class="mut" style="font-size:13px;margin-top:3px">A: 90% and above · B: 80% to 89% · C: below 80% (VDA 6.3 grades). A question rated 0 holds the grade at B or lower. Your customer may set its own downgrade rule.</div></div></div>` : a.type === "Process" && !a.has_scoring ? '<div class="lock">🔒 VDA 6.3 scoring is not part of your plan. <button class="btn o s" id="sc_lk">Find out more</button></div>' : ""; };
  const checklistHtml = (a) => { const ro = !a.can_edit; return (a.checklist || []).map((x, i) => cr(x, i, a)).join("") || `<div class="empty">No questions yet.${ro ? "" : "<br>Choose the type and the process above, then press <b>Create the clause checklist</b>."}</div>`; };
  function paint() {
    const a = S.a, el = $("#rep"), ro = !a.can_edit, s = STAT[a.status] || ["", "x"], ty = LB().TYPES[a.type] || {}, m = a.meta || {};
    el.innerHTML = `${dl()}<div class="row"><button class="btn o s" id="r_back">← Audit programme</button><b style="font-size:17px">${esc(a.no)}</b> ${chip(s[0], s[1])} ${chip((ty.name || a.type), "v")}<span style="flex:1"></span><button class="btn o s" id="r_plan">Print audit plan</button>${a.status === "reported" || a.status === "closed" ? '<button class="btn o s" id="r_rep">Print audit report</button>' : ""}</div>
      <div class="${ro ? "ro" : ""}"><div class="sg"><div class="w"><label>Audit title</label><input id="a_ti" value="${esc(a.title)}" placeholder="For example: Process audit, Boring operation T04" ${ro ? "disabled" : ""}></div>
      <div><label>Type of audit</label><select id="a_ty" ${ro ? "disabled" : ""}>${opts(TYPES.map((t) => [t[0], t[1]]), a.type)}</select></div><div><label>Area or process</label><input id="a_ar" list="areas" value="${esc(a.area || "")}" placeholder="Machining T04, Final inspection…" ${ro ? "disabled" : ""}><datalist id="areas">${((S.L.settings || {}).areas || []).map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist></div>
      <div><label>Process or department (shows only the questions that apply)</label><select id="a_pc" ${ro ? "disabled" : ""}>${opts(LB().PROC, m.proc || "all")}</select></div>
      ${(ty.sets || []).length > 1 ? `<div class="w"><label>Requirements covered</label><div class="sh">${ty.sets.map((x) => `<label><input type="checkbox" id="set_${x[0]}"${!m.sets || m.sets.includes(x[0]) ? " checked" : ""} ${ro ? "disabled" : ""}> ${esc(x[1])}</label>`).join("")}</div></div>` : ""}
      <div class="w"><label>Scope: what is covered</label><input id="a_sc" value="${esc(a.scope || "")}" placeholder="Clauses, processes, parts or shifts covered" ${ro ? "disabled" : ""}></div>
      <div><label>Planned date</label><input id="a_pl" type="date" value="${esc(a.planned_on || "")}" ${ro ? "disabled" : ""}></div><div><label>Date audit was done</label><input id="a_dn" type="date" value="${esc(a.done_on || "")}" ${ro ? "disabled" : ""}></div>
      <div><label>Auditor</label><input id="a_au" list="own" value="${esc(a.auditor || "")}" ${ro ? "disabled" : ""}></div><div><label>Person or area audited</label><input id="a_ae" list="own" value="${esc(a.auditee || "")}" ${ro ? "disabled" : ""}></div>
      <div class="w"><label>Shifts covered</label><div class="sh">${SHIFTS.map((x) => `<label><input type="checkbox" id="sh_${x}"${(a.shifts || []).includes(x) ? " checked" : ""} ${ro ? "disabled" : ""}> ${x === "General" ? "General" : "Shift " + x}</label>`).join("")}</div></div></div></div>
      <div class="guide" style="margin-top:12px"><b>${esc(ty.name || a.type)}.</b> ${esc(ty.desc || "")} <br><b>Standards:</b> ${esc(ty.std || "")}. <b>How often:</b> ${esc(ty.freq || "")}</div>
      <h3 style="margin:16px 0 4px">Checklist <small class="mut" id="r_cnt"></small></h3><div class="guide" style="margin-bottom:8px">${a.type === "Process" ? "Rate each question 10 (fully met), 8 (largely met), 6 (partly met), 4 (inadequately met) or 0 (not met). NA if it does not apply. The score follows." : a.type === "LPA" ? "Answer OK or Not OK. If Not OK, say how many samples failed and the effect. The rules decide Major or Minor." : "Answer each question: Meets, Partly, Does not meet, Observation or NA. For Partly and Does not meet, say how many samples failed and the effect: the rules decide Minor or Major, not the auditor."}</div>
      <div id="r_cl" class="${ro ? "ro" : ""}">${checklistHtml(a)}</div>
      ${ro ? "" : '<div class="row"><button class="btn" id="r_make">Create the clause checklist</button><button class="btn o s" id="r_addq">+ Add a question</button></div>'}
      <div id="r_score">${scoreHtml(a)}</div>
      <h3 style="margin:16px 0 4px">Findings and corrective actions</h3><div class="guide" style="margin-bottom:8px">Every Minor or Major finding gets its own record with the problem, containment, root cause (why-why), permanent action and a check that it worked. The audit can be closed only when all of them are closed.</div>
      <div id="r_find">${findingsHtml()}</div>
      <div class="sg" style="margin-top:12px"><div class="w"><label>Summary and conclusion</label><textarea id="a_su" rows="3" ${ro ? "disabled" : ""}>${esc(a.summary || "")}</textarea></div></div>
      ${a.log && a.log.length ? `<details class="th"><summary style="cursor:pointer;font-weight:700">History (${a.log.length})</summary>${a.log.map((l) => `<div class="cm"><small>${fmt(String(l.at).slice(0, 10))} · ${esc(l.by || "")}</small><br>${esc(l.text)}</div>`).join("")}</details>` : ""}
      <div class="sticky noprint"><span class="mut" id="sv_note">${a.id ? "" : "Not saved yet"}</span><span style="flex:1"></span><div id="r_msg" class="wh" hidden style="flex-basis:100%"></div>${actionsBar()}</div>`;
    wire();
  }
  function actionsBar() {
    const a = S.a, can = canEdit(), b = [];
    if (a.can_edit) b.push('<button class="btn" id="b_save">Save</button>');
    if (can && a.id && a.status === "planned") b.push('<button class="btn" id="b_issue" style="background:var(--g)">Issue audit report</button>', '<button class="btn o" id="b_cancel">Cancel audit</button>');
    if (can && a.status === "reported") b.push('<button class="btn" id="b_close" style="background:var(--g)">Close audit</button>');
    if (isAdmin() && ["closed", "reported", "cancelled"].includes(a.status)) b.push('<button class="btn o" id="b_reopen">Reopen (administrator)</button>');
    if (a.id && can && (a.status === "planned" || isAdmin())) b.push('<button class="btn o" id="b_del" style="color:var(--r);border-color:var(--r)">Delete</button>');
    return b.join("");
  }
  const showErr = (m) => { const e = $("#r_msg"); if (!e) return say(m); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: "center", behavior: "smooth" }); };
  const updateCount = () => { const a = S.a, r = (a.checklist || []).filter((x) => x.rating).length, f = (a.checklist || []).filter(isF), mj = f.filter((x) => x.sev === "Major" || ["4", "0", "Major"].includes(String(x.rating))).length, e = $("#r_cnt"); if (e) e.textContent = r + " of " + (a.checklist || []).length + " answered" + (f.length ? " · " + f.length + " finding" + (f.length > 1 ? "s" : "") + " (" + mj + " Major, " + (f.length - mj) + " Minor)" : ""); };
  function wireRows(root) {
    const a = S.a; if (!a.can_edit) return;
    root.querySelectorAll(".cr").forEach((r) => {
      r.querySelectorAll(".rt button").forEach((b) => (b.onclick = () => { const on = r.dataset.ans === b.dataset.v; r.dataset.ans = on ? "" : b.dataset.v; delete r.dataset.legacy; collect(); dirty(); repaintChecklistKeep(); }));
      r.querySelectorAll("input,textarea,select").forEach((e) => { const ch = e.matches('[data-f="n"],[data-f="f"],[data-f="imp"],[data-f="absent"]'); e.addEventListener(ch ? "change" : "input", () => { if (ch) { collect(); dirty(); repaintChecklistKeep(); } else dirty(); }); });
      const d = r.querySelector("[data-del]"); if (d) d.onclick = () => { collect(); a.checklist = a.checklist.filter((x) => x.id !== r.dataset.q); dirty(); repaintChecklistKeep(); };
    });
  }
  function wire() {
    const el = $("#rep"), a = S.a;
    $("#r_back").onclick = () => go("go=list"); $("#r_plan").onclick = () => { collect(); showDoc(AudDocs.plan(S.a)); };
    const rp = $("#r_rep"); if (rp) rp.onclick = () => showDoc(AudDocs.report(S.a, S.ncs || []));
    const lk = $("#sc_lk"); if (lk) lk.onclick = () => window.KMRLock && KMRLock.need("aud.vda-6-3-scoring");
    updateCount(); wireFind();
    if (a.can_edit) {
      el.querySelectorAll("input,textarea,select").forEach((e) => { if (!e.closest("[data-act],[data-qa],.cr")) e.addEventListener("input", dirty); });
      const rebuild = () => { collect(); if ((a.checklist || []).some((x) => x.ans || x.rating)) { dirty(); return; } a.checklist = build(a); dirty(); repaintChecklistKeep(); };
      $("#a_ty").onchange = () => { collect(); a.ratings = ratings(a.type); a.meta = { proc: a.meta.proc || "all", sets: null }; if (!(a.checklist || []).some((x) => x.ans || x.rating)) a.checklist = []; dirty(); paint(); $("#sv_note").textContent = "Not saved yet"; };
      $("#a_pc").onchange = rebuild; (LB().TYPES[a.type].sets || []).forEach((s) => { const c = $("#set_" + s[0]); if (c) c.onchange = rebuild; });
      wireRows(el);
      $("#r_addq").onclick = () => { collect(); a.checklist.push({ id: rid(), q: "", ref: "", rating: "", note: "", ans: "" }); dirty(); repaintChecklistKeep(); const q = el.querySelectorAll('.cr [data-f="q"]'); if (q.length) q[q.length - 1].focus(); };
      $("#r_make").onclick = () => { collect(); if (a.checklist.some((x) => x.ans || x.rating)) { showErr("Some questions are already answered, so the checklist is not replaced. Remove questions one by one if you need to."); return; } a.checklist = build(a); dirty(); repaintChecklistKeep(); if (!a.checklist.length) showErr("No question applies to this combination. Choose \"All processes\"."); };
    }
    wireActs(el);
    const sv = $("#b_save"); if (sv) sv.onclick = () => guard(async () => { try { const r = await saveAudit(); say("Saved.", true); if (!a.id || a.no === "(new)") { setGo("go=list&id=" + r.id); route(); } else await reload(); } catch (e) { showErr(e.message); } });
    const run = (id, fn) => { const b = $(id); if (b) b.onclick = () => guard(async () => { $("#r_msg").hidden = true; try { await fn(); } catch (e) { showErr(e.message); } }); };
    run("#b_issue", async () => {
      if (a.can_edit) await saveAudit();
      const miss = (a.checklist || []).map((x, i) => [x, i + 1]).filter((p) => FIND(p[0].rating) && !String(p[0].note || "").trim());
      if (miss.length) throw new Error("Write what was seen for every finding. Missing for question " + miss.map((p) => p[1]).join(", ") + ".");
      await call("kmr_aud_issue", { p_id: a.id });
      for (const x of a.checklist || []) if (x.pt && x.ans && x.ans !== "na") { try { const ok = ["ok", "obs", "10"].includes(x.ans); await call("kmr_aud_point_check", { p_id: x.pt, p: { result: ok ? "ok" : "not_ok", note: x.note || "", audit: a.no } }); } catch (e) { /* the point may be closed */ } }
      say("The audit report is issued.", true); await reload();
    });
    run("#b_close", async () => { await call("kmr_aud_close", { p_id: a.id }); say("The audit is closed.", true); await reload(); });
    run("#b_reopen", async () => { await call("kmr_aud_reopen", { p_id: a.id }); say("Opened again.", true); await reload(); });
    run("#b_cancel", async () => {
      const m = $("#r_msg"); m.hidden = false; m.style.background = "var(--bg)"; m.style.color = "var(--ink)"; m.innerHTML = '<b>Why is this audit cancelled?</b> <input id="cx_r" placeholder="Reason" style="margin:6px 0"><button class="btn s" id="cx_go">Cancel the audit</button>';
      $("#cx_go").onclick = () => guard(async () => { try { await call("kmr_aud_cancel", { p_id: a.id, p_reason: V("cx_r") }); S.dirty = false; say("The audit is cancelled.", true); await reload(); } catch (e) { m.textContent = e.message; m.style.background = "#fee2e2"; m.style.color = "#991b1b"; } });
    });
    const dd = $("#b_del"); if (dd) dd.onclick = () => { const m = $("#r_msg"); m.hidden = false; m.style.background = "var(--bg)"; m.style.color = "var(--ink)"; m.innerHTML = '<b>Delete this audit with all its findings and actions? It cannot be undone.</b> <button class="btn s r" id="dl_go">Yes, delete</button>';
      $("#dl_go").onclick = () => guard(async () => { try { await call("kmr_aud_audit_delete", { p_id: a.id }); S.dirty = false; go("go=list"); } catch (e) { m.textContent = e.message; } }); };
  }
  function wireFind() { $("#rep").querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => guard(async () => { if (S.a.can_edit && S.dirty) { try { await saveAudit(); } catch (e) { showErr(e.message); return; } } go("go=nc&id=" + b.dataset.open); }))); }
  /* repaint only the checklist, score and findings so typed text in the other fields is kept */
  function repaintChecklistKeep() {
    const a = S.a; $("#r_cl").innerHTML = checklistHtml(a); $("#r_find").innerHTML = findingsHtml(); $("#r_score").innerHTML = scoreHtml(a);
    wireRows($("#rep")); wireActs($("#r_find")); wireFind(); const lk = $("#sc_lk"); if (lk) lk.onclick = () => window.KMRLock && KMRLock.need("aud.vda-6-3-scoring"); updateCount(); const n = $("#sv_note"); if (n) n.textContent = "Not saved yet";
  }
  function wireActs(root) {
    const a = S.a;
    const refresh = async () => { await reload(); };
    const pre = async () => { if (a.can_edit && S.dirty) await saveAudit(); };
    root.querySelectorAll("[data-qadd]").forEach((b) => (b.onclick = () => guard(async () => {
      const q = b.closest("[data-qa]"), v = (k) => q.querySelector('[data-q="' + k + '"]').value;
      try { if (!a.id) throw new Error("Save the audit first."); collect(); await pre(); await call("kmr_aud_act_save", { p: { audit_id: a.id, q_id: q.dataset.qa, text: v("text"), owner: v("owner"), due_on: v("due_on") } }); await refresh(); }
      catch (e) { showErr(e.message); }
    })));
    root.querySelectorAll("[data-act]").forEach((row) => {
      const id = row.dataset.act, get = (k) => row.querySelector('[data-af="' + k + '"]'), x = (a.actions || []).find((y) => y.id === id);
      const save = (chg) => guard(async () => {
        try { collect(); await pre(); const done = get("done").checked, ver = get("verified").checked && done;
          await call("kmr_aud_act_save", { p: { id, audit_id: a.id, q_id: x && x.q_id, text: get("text").value, owner: get("owner").value, due_on: get("due_on").value, status: done ? "done" : "open", verified: ver, evidence: get("evidence").value } }); await refresh(); }
        catch (e) { showErr(e.message); }
      });
      row.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => save()));
      const d = row.querySelector("[data-adel]"); if (d) d.onclick = () => guard(async () => { try { await call("kmr_aud_act_delete", { p_id: id }); await refresh(); } catch (e) { showErr(e.message); } });
    });
  }
  async function drawAudit(hp) {
    await loadRefs();
    if (hp.new) { if (!canEdit()) { go("go=list"); return; } S.a = blank(); S.ncs = []; S.dirty = false; paint(); return; }
    S.a = await call("kmr_aud_audit_get", { p_id: hp.id }); S.a.has_scoring = S.a.has_scoring && S.L.has_scoring; S.a.meta = S.a.meta || {}; S.ncs = await call("kmr_aud_nc_list", { p: { audit_id: hp.id, status: "all" } }); S.dirty = false;
    if (S.a.can_edit && !(S.a.checklist || []).length && S.a.meta.auto) { S.a.checklist = build(S.a); S.dirty = true; }
    paint(); if (S.dirty) { const n = $("#sv_note"); if (n) n.textContent = "Checklist created from the standard: save to keep it"; }
  }

  /* ================= Findings tracker ================= */
  async function drawActs() {
    const el = $("#acts"), f = S.af, can = canEdit();
    if (!hasF("aud.findings-tracker")) { el.innerHTML = '<div class="lock">🔒 The findings tracker is not part of your plan. <button class="btn o s" id="a_lk">Find out more</button></div>'; $("#a_lk").onclick = () => window.KMRLock && KMRLock.need("aud.findings-tracker"); return; }
    el.innerHTML = `<div class="guide">Every action of every audit in one list. Tick an action when it is done; open the audit to check its effect.</div>
      <div class="row"><div class="grow"><input id="a_q" placeholder="Search action or audit…" value="${esc(f.q)}"></div><select id="a_ow" style="width:auto"><option value="">Everyone</option>${opts((S.L.owners || []).map((o) => [o, o]), f.owner)}</select>
      <div class="seg" style="margin:0">${[["open", "Open"], ["done", "Done"], ["all", "All"]].map((x) => `<button data-st="${x[0]}" class="${f.status === x[0] ? "on" : ""}">${x[1]}</button>`).join("")}<button data-od class="${f.overdue ? "on" : ""}">Late only</button></div><button class="btn o" id="a_pr">Print list</button></div><div id="a_body"></div>`;
    const load = async () => {
      const list = await call("kmr_aud_act_list", { p: { status: f.status, owner: f.owner, overdue: f.overdue ? "true" : "", q: f.q } }); S.alist = list;
      $("#a_body").innerHTML = list.length ? `<div class="sc"><table class="tb2"><thead><tr><th></th><th>Audit</th><th>Action</th><th>Owner</th><th>Due</th><th>Effect</th></tr></thead><tbody>${list.map((a) => `<tr data-a="${a.audit_id}"><td>${can ? `<button class="ck ${a.status === "done" ? "on" : ""}" data-done="${a.id}" data-to="${a.status === "done" ? 0 : 1}" title="${a.status === "done" ? "Mark open" : "Mark done"}">${a.status === "done" ? "✓" : ""}</button>` : ""}</td>
        <td><b>${esc(a.audit_no)}</b><br><small class="mut">${esc(a.audit_title)}</small></td><td>${esc(a.text)}</td><td>${esc(a.owner || "")}</td><td>${due(a.due_on, a.status === "done")}</td><td>${a.verified ? chip("Effective", "g") : a.status === "done" ? chip("To check", "a") : ""}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No actions match.</div>';
      el.querySelectorAll("tr[data-a]").forEach((r) => (r.onclick = (e) => { if (e.target.closest("[data-done]")) return; go("go=list&id=" + r.dataset.a); }));
      el.querySelectorAll("[data-done]").forEach((b) => (b.onclick = () => guard(async () => { await call("kmr_aud_act_done", { p_id: b.dataset.done, p_done: b.dataset.to === "1" }); await load(); })));
    };
    let tm; $("#a_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    $("#a_ow").onchange = (e) => { f.owner = e.target.value; guard(load); };
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    el.querySelector("[data-od]").onclick = (e) => { f.overdue = !f.overdue; e.target.classList.toggle("on", f.overdue); guard(load); };
    $("#a_pr").onclick = () => showDoc(AudDocs.actions(S.alist || [], [f.status, f.owner, f.overdue ? "late only" : ""].filter((x) => x && x !== "all").join(", ")));
    await load();
  }

  /* ================= start ================= */
  window.AUD = { S, route, go, showDoc, chip, due, opts, guard, canEdit, isAdmin, dl, V, hasF, rid, setGo, hashParts, GC, STAT, STGN, dotsOf, today, TYPES, screens: {} };
  async function start() {
    try {
      await QP.init("aud"); if (!QP.ctx) return;
      S.L = await call("kmr_aud_load"); $("#role").textContent = S.L.role;
      const stab = document.querySelector('.tab[data-t="setup"]'); if (stab && !isAdmin()) stab.classList.add("hide");
      window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
      await route();
    } catch (e) { say(e.message); }
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
