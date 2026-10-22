/* Internal Audit - screens: Standards alignment, Dashboard, Audit programme, one-page audit (details, checklist, findings, actions), Findings tracker, Setup.
   Data calls are kmr_aud_* (database) or aud-demo.js (?demo=1). The rules (independence, every question rated, every finding has an action, close only when actions are checked)
   are enforced by the database; the messages are shown as they come. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP;
  const TYPES = [["System", "System audit", "Is the quality system working? (ISO 9001, IATF 16949)"], ["Process", "Process audit", "Is one process under control? Scored like VDA 6.3."], ["Product", "Product audit", "Does the finished product meet the requirement?"], ["Supplier", "Supplier audit", "Does our supplier control what they send us?"]];
  const SHIFTS = ["A", "B", "C", "General"];
  const RLABEL = { OK: "Meets the requirement", Minor: "Minor finding", Major: "Major finding", Observation: "Observation, no action needed", NA: "Not applicable", 10: "Fully met", 8: "Small gap", 4: "Large gap", 0: "Not met", "": "" };
  const FIND = (r) => ["Minor", "Major", "8", "4", "0"].includes(String(r));
  const STAT = { planned: ["Planned", "b"], reported: ["Report issued", "a"], closed: ["Closed", "g"], cancelled: ["Cancelled", "x"] };
  /* standard questions (own words) - the auditor can change, add or remove any of them */
  const LIST = {
    System: [["Do people in this area know the quality policy and how their job helps the objectives?", "ISO 9001 5.2, 6.2"], ["Are roles and responsibilities clear, and does everyone know who to ask?", "ISO 9001 5.3"],
      ["Are the current versions of procedures and instructions at the place of work?", "ISO 9001 7.5.3"], ["Are old or uncontrolled copies removed or clearly marked?", "ISO 9001 7.5.3"], ["Are records complete, readable, stored and easy to find?", "ISO 9001 7.5.3"],
      ["Is every person trained for the job, with a record, and was the training checked for effect?", "ISO 9001 7.2, IATF 7.2.1"], ["Are gauges identified, calibrated and in date? Are out-of-tolerance cases reviewed?", "ISO 9001 7.1.5"],
      ["Is nonconforming product marked, kept apart and decided on by an authorised person?", "ISO 9001 8.7"], ["Are customer complaints and internal problems analysed for root cause, with corrective action and a check?", "ISO 9001 10.2"],
      ["Are the risks of this area known, with actions followed up?", "ISO 9001 6.1"], ["Are customer-specific requirements known to the people who need them and being met?", "IATF 16949 4.3.2"], ["Are quality objectives measured and the results reviewed by management?", "ISO 9001 9.1, 9.3"]],
    Process: [["Is the work instruction at the workstation, current, and followed?", "VDA 6.3 P6.2"], ["Does the work instruction match the Control Plan and the PFMEA?", "VDA 6.3 P3.3"], ["Is the first-piece or setup approval done and recorded every time?", "VDA 6.3 P6.2"],
      ["Are tools, fixtures and gauges at the machine in good condition and calibrated?", "VDA 6.3 P6.2"], ["Are the process parameters checked and recorded as the Control Plan requires?", "VDA 6.3 P6.3"], ["Is the sampling and inspection done at the required frequency, and are results recorded?", "VDA 6.3 P6.4"],
      ["Is bad product stopped, tagged and kept apart at once?", "VDA 6.3 P6.5"], ["Does the operator know the reaction plan and use it?", "VDA 6.3 P6.5"], ["Are material and parts identified and traceable, with no mix-up risk?", "VDA 6.3 P6.1.1"],
      ["Is the work place clean and organised so errors are seen quickly?", "VDA 6.3 P6.2"], ["Are operators trained and qualified for this job, and is it recorded?", "VDA 6.3 P6.2"], ["Are the machine's maintenance and tool-life checks up to date?", "VDA 6.3 P6.3"]],
    Product: [["Do the measured dimensions of the sample pieces meet the drawing?", "Drawing / specification"], ["Does the appearance match the approved limit sample?", "Customer requirement"], ["Does the marking, label and packing match the requirement?", "Packing standard"],
      ["Can each piece be traced to its lot and date?", "Traceability"], ["Are the material and test certificates available and valid?", "ISO 9001 8.6"], ["Was the audit done with calibrated gauges used correctly?", "ISO 9001 7.1.5"]],
    Supplier: [["Does the supplier hold a valid quality system certificate?", "ISO 9001 8.4"], ["Is incoming material inspected and recorded as agreed?", "ISO 9001 8.4.2"], ["Is the supplier's Control Plan in use and followed on the floor?", "Control Plan"], ["Is the part approval (PPAP) current for the revision supplied?", "PPAP"],
      ["Are the supplier's gauges calibrated and the measurement system checked?", "MSA"], ["Does the supplier answer complaints on time with a root cause and a corrective action?", "ISO 9001 10.2"], ["Is delivery on time and complete?", "ISO 9001 8.4"], ["Does the supplier control their own sub-suppliers?", "IATF 16949 8.4.1"]]
  };
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
  const tmpl = (type) => (LIST[type] || []).map((x) => ({ id: rid(), q: x[0], ref: x[1], rating: "", note: "" }));
  const ratings = (type) => (type === "Process" ? ["10", "8", "4", "0", "NA"] : ["OK", "Minor", "Major", "Observation", "NA"]);
  function score(list) { const r = list.filter((x) => ["10", "8", "4", "0"].includes(String(x.rating))); if (!r.length) return null; const sc = Math.round((r.reduce((s, x) => s + Number(x.rating), 0) * 1000) / (10 * r.length)) / 10; let g = sc >= 90 ? "A" : sc >= 80 ? "B" : "C"; if (g === "A" && r.some((x) => String(x.rating) === "0")) g = "B"; return { score: sc, grade: g }; }
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
  const SECS = ["std", "dash", "list", "rep", "acts", "setup"];
  async function route() {
    closeM(); closeDoc(); const hp = hashParts(); const g0 = ["std", "dash", "list", "acts", "setup"].includes(hp.go) ? hp.go : "std";
    const sec = g0 === "list" && (hp.id || hp.new) ? "rep" : g0;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === g0)); SECS.forEach((s) => $("#" + s).classList.toggle("hide", s !== sec)); say("");
    try {
      if (sec === "std") KMRStd.draw($("#std"), "aud");
      else if (sec === "dash") await drawDash();
      else if (sec === "list") await drawList();
      else if (sec === "rep") await drawAudit(hp);
      else if (sec === "acts") await drawActs();
      else if (sec === "setup") await drawSetup();
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
  }

  /* ================= Audit programme ================= */
  async function drawList() {
    const f = S.f, el = $("#list"), can = canEdit();
    el.innerHTML = `<div class="guide">Plan every audit of the year here, then open one to fill the checklist, record findings and follow the actions on a single page.</div>
      <div class="row"><div class="grow"><input id="l_q" placeholder="Search number, title, area, auditor…" value="${esc(f.q)}"></div><select id="l_ty" style="width:auto"><option value="">All types</option>${opts(TYPES.map((t) => [t[0], t[1]]), f.type)}</select>
      <div class="seg" style="margin:0">${[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map((x) => `<button data-st="${x[0]}" class="${f.status === x[0] ? "on" : ""}">${x[1]}</button>`).join("")}</div>
      ${can ? '<button class="btn" id="l_new">+ Plan an audit</button>' : ""}<button class="btn o" id="l_pr">Print programme</button></div><div id="l_body"></div>`;
    const load = async () => {
      const list = await call("kmr_aud_audit_list", { p: { q: f.q, status: f.status, type: f.type } }); S.list = list;
      $("#l_body").innerHTML = list.length ? list.map((r) => { const s = STAT[r.status] || ["", "x"]; return `<div class="t ${r.status === "closed" || r.status === "cancelled" ? "fin" : ""}" data-a="${r.id}" style="--pc:var(--${r.late ? "r" : r.status === "closed" ? "g" : "b1"})"><div class="tb"><div class="tt">${esc(r.title)}</div>
        <div class="tm"><b>${esc(r.no)}</b> ${chip(r.type, "v")} ${chip(s[0], s[1])}${r.late ? chip("Late", "r") : ""}${r.grade ? chip("Grade " + r.grade + " · " + r.score + "%", GC[r.grade]) : ""}<span>${esc(r.area || "")}</span></div>
        <div class="tm"><span>${r.status === "planned" ? "planned " + due(r.planned_on) : "done " + fmt(r.done_on)}</span><span>${esc(r.auditor || "no auditor")}${r.auditee ? " → " + esc(r.auditee) : ""}</span>${(r.shifts || []).length ? "<span>shift " + r.shifts.map(esc).join(", ") + "</span>" : ""}${r.findings ? chip(r.findings + " finding" + (r.findings > 1 ? "s" : ""), "a") : ""}${r.actions_open ? chip(r.actions_open + " open action" + (r.actions_open > 1 ? "s" : ""), r.actions_overdue ? "r" : "b") : ""}</div></div></div>`; }).join("")
        : `<div class="empty">${f.q || f.type || f.status !== "all" ? "No audit matches." : "No audit planned yet."}${can ? "<br>Press <b>+ Plan an audit</b> to start the programme." : ""}</div>`;
      el.querySelectorAll("[data-a]").forEach((e) => (e.onclick = () => go("go=list&id=" + e.dataset.a)));
    };
    let tm; $("#l_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    $("#l_ty").onchange = (e) => { f.type = e.target.value; guard(load); };
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    if (can) $("#l_new").onclick = () => go("go=list&new=1");
    $("#l_pr").onclick = () => showDoc(AudDocs.register(S.list || [], [f.status, f.type].filter((x) => x && x !== "all").join(", ")));
    await load();
  }

  /* ================= one audit on one page ================= */
  const blank = () => ({ id: null, no: "(new)", title: "", type: "System", status: "planned", area: "", scope: "", planned_on: "", done_on: "", auditor: "", auditee: "", shifts: [], summary: "", checklist: tmpl("System"), actions: [], log: [], can_edit: true, can_act: false, ratings: ratings("System"), has_scoring: S.L.has_scoring });
  function collect() {
    const a = S.a; if (!a.can_edit) return;
    a.title = V("a_ti"); a.type = V("a_ty"); a.area = V("a_ar"); a.scope = V("a_sc"); a.planned_on = V("a_pl"); a.done_on = V("a_dn"); a.auditor = V("a_au"); a.auditee = V("a_ae"); a.summary = V("a_su");
    a.shifts = SHIFTS.filter((s) => $("#sh_" + s) && $("#sh_" + s).checked);
    a.checklist = [...$("#rep").querySelectorAll(".cr")].map((r) => ({ id: r.dataset.q, q: r.querySelector('[data-f="q"]').value, ref: r.querySelector('[data-f="ref"]').value, rating: r.dataset.rating || "", note: r.querySelector('[data-f="note"]').value }));
  }
  const dirty = () => { S.dirty = true; const b = $("#sv_note"); if (b) b.textContent = "Not saved yet"; };
  async function saveAudit() {
    collect(); const a = S.a;
    const o = { title: a.title, type: a.type, area: a.area, scope: a.scope, planned_on: a.planned_on, done_on: a.done_on, auditor: a.auditor, auditee: a.auditee, shifts: a.shifts, summary: a.summary, checklist: a.checklist };
    if (a.id) o.id = a.id; const res = await call("kmr_aud_audit_save", { p: o }); S.dirty = false; return res;
  }
  async function reload() { S.a = await call("kmr_aud_audit_get", { p_id: S.a.id }); S.a.has_scoring = S.a.has_scoring && S.L.has_scoring; paint(); }
  const cr = (x, i, a) => {
    const ro = !a.can_edit, rs = ratings(a.type), cls = x.rating ? (FIND(x.rating) ? (["4", "0", "Major"].includes(String(x.rating)) ? "bad" : "fnd") : "ok") : "";
    return `<div class="cr ${cls}" data-q="${esc(x.id)}" data-rating="${esc(x.rating || "")}"><div class="qn"><textarea data-f="q" rows="2" ${ro ? "disabled" : ""}>${esc(x.q)}</textarea><input data-f="ref" placeholder="Clause / reference" value="${esc(x.ref || "")}" ${ro ? "disabled" : ""}></div>
      <div class="rt" style="grid-column:1/-1">${rs.map((r) => `<button type="button" data-v="${r}" class="${String(x.rating) === r ? "on" : ""}" title="${esc(RLABEL[r] || r)}" ${ro ? "disabled" : ""}>${r}</button>`).join("")}<span class="mut" style="align-self:center;font-size:12.5px" data-rl>${esc(RLABEL[x.rating] || "Not rated")}</span></div>
      <input data-f="note" placeholder="What was seen: evidence, record number, sample…" value="${esc(x.note || "")}" style="grid-column:1/-1" ${ro ? "disabled" : ""}>${ro ? "" : '<button class="btn o s" data-del title="Remove this question" style="grid-column:1/-1;justify-self:end">Remove question</button>'}</div>`;
  };
  const actRow = (x, ro) => `<div class="ab ${x.status === "done" ? "done" : x.due_on && x.due_on < today() ? "late" : ""}" data-act="${x.id}" style="grid-template-columns:1.6fr 1fr 130px auto auto"><input data-af="text" value="${esc(x.text)}" ${ro ? "disabled" : ""}><input data-af="owner" list="own" value="${esc(x.owner || "")}" placeholder="Owner" ${ro ? "disabled" : ""}>
    <input data-af="due_on" type="date" value="${esc(x.due_on || "")}" ${ro ? "disabled" : ""}><label class="cl"><input type="checkbox" data-af="done"${x.status === "done" ? " checked" : ""} ${ro ? "disabled" : ""}> <span>Done</span></label><label class="cl"><input type="checkbox" data-af="verified"${x.verified ? " checked" : ""} ${ro || x.status !== "done" ? "disabled" : ""}> <span>Effective</span></label>
    <div class="ex"><input data-af="evidence" value="${esc(x.evidence || "")}" placeholder="Evidence the action was done: record, photo, document no." ${ro ? "disabled" : ""}>${!ro && S.a.status === "planned" ? '<button class="btn o s" data-adel title="Remove">✕</button>' : "<span></span>"}</div></div>`;
  function findingsHtml() {
    const a = S.a, ro = !a.can_act, fl = (a.checklist || []).filter((x) => FIND(x.rating));
    const addRow = (q) => ro || !a.id ? "" : `<div class="qa" data-qa="${esc(q)}" style="grid-template-columns:1.6fr 1fr 130px auto"><div><label>New action</label><input data-q="text" placeholder="What will be done to fix it"></div><div><label>Owner</label><input data-q="owner" list="own"></div><div><label>Due</label><input data-q="due_on" type="date" value="${esc(dueDefault())}"></div><button class="btn s" data-qadd>Add</button></div>`;
    const blocks = fl.map((x) => { const as = (a.actions || []).filter((y) => y.q_id === x.id); return `<div class="fb"><h5>${chip(x.rating, ["4", "0", "Major"].includes(String(x.rating)) ? "r" : "a")} ${esc(x.q)}</h5>${x.note ? `<div class="mut" style="margin-bottom:6px">${esc(x.note)}</div>` : ""}${as.length ? as.map((y) => actRow(y, ro)).join("") : '<div class="wh" style="margin:0 0 6px">This finding needs an action with an owner and a due date.</div>'}${addRow(x.id)}</div>`; }).join("");
    const other = (a.actions || []).filter((y) => !fl.some((x) => x.id === y.q_id));
    return (a.id ? "" : '<div class="mut">Save the audit first; then findings and their actions appear here.</div>') + (blocks || (a.id ? '<div class="empty">No finding yet. Rate a question as a finding and it appears here.</div>' : "")) +
      (other.length || (!ro && a.id) ? `<div class="fb" style="border-left-color:var(--mut)"><h5>Other actions (not tied to one question)</h5>${other.map((y) => actRow(y, ro)).join("")}${addRow("")}</div>` : "");
  }
  const dueDefault = () => { const n = Number((S.L.settings || {}).due_days); const d = new Date(today() + "T00:00:00"); d.setDate(d.getDate() + (isNaN(n) || (S.L.settings || {}).due_days == null ? 30 : n)); return d.toISOString().slice(0, 10); };
  function paint() {
    const a = S.a, el = $("#rep"), ro = !a.can_edit, s = STAT[a.status] || ["", "x"], sc = a.type === "Process" && a.has_scoring ? (a.status === "planned" ? score(a.checklist) : a.score != null ? { score: a.score, grade: a.grade } : null) : null;
    const act = (a.actions || []);
    el.innerHTML = `${dl()}<div class="row"><button class="btn o s" id="r_back">← Audit programme</button><b style="font-size:17px">${esc(a.no)}</b> ${chip(s[0], s[1])} ${chip(a.type, "v")}<span style="flex:1"></span><button class="btn o s" id="r_plan">Print audit plan</button>${a.status === "reported" || a.status === "closed" ? '<button class="btn o s" id="r_rep">Print audit report</button>' : ""}</div>
      <div class="${ro ? "ro" : ""}"><div class="sg"><div class="w"><label>Audit title</label><input id="a_ti" value="${esc(a.title)}" placeholder="For example: Process audit, Boring operation T04" ${ro ? "disabled" : ""}></div>
      <div><label>Type of audit</label><select id="a_ty" ${ro ? "disabled" : ""}>${opts(TYPES.map((t) => [t[0], t[1]]), a.type)}</select></div><div><label>Area or process</label><input id="a_ar" value="${esc(a.area || "")}" placeholder="Machining T04, Final inspection…" ${ro ? "disabled" : ""}></div>
      <div class="w"><label>Scope: what is covered</label><input id="a_sc" value="${esc(a.scope || "")}" placeholder="Clauses, processes, parts or shifts covered" ${ro ? "disabled" : ""}></div>
      <div><label>Planned date</label><input id="a_pl" type="date" value="${esc(a.planned_on || "")}" ${ro ? "disabled" : ""}></div><div><label>Date audit was done</label><input id="a_dn" type="date" value="${esc(a.done_on || "")}" ${ro ? "disabled" : ""}></div>
      <div><label>Auditor</label><input id="a_au" list="own" value="${esc(a.auditor || "")}" ${ro ? "disabled" : ""}></div><div><label>Person or area audited</label><input id="a_ae" list="own" value="${esc(a.auditee || "")}" ${ro ? "disabled" : ""}></div>
      <div class="w"><label>Shifts covered</label><div class="sh">${SHIFTS.map((x) => `<label><input type="checkbox" id="sh_${x}"${(a.shifts || []).includes(x) ? " checked" : ""} ${ro ? "disabled" : ""}> ${x === "General" ? "General" : "Shift " + x}</label>`).join("")}</div></div></div></div>
      <h3 style="margin:16px 0 4px">Checklist <small class="mut" id="r_cnt"></small></h3><div class="guide" style="margin-bottom:8px">${a.type === "Process" ? "Rate each question 10 (fully met), 8 (small gap), 4 (large gap) or 0 (not met). NA if it does not apply. The score follows." : "Rate each question: OK, Minor, Major, Observation or NA (not applicable). Minor and Major findings need an action."}</div>
      <div id="r_cl" class="${ro ? "ro" : ""}">${(a.checklist || []).map((x, i) => cr(x, i, a)).join("") || '<div class="empty">No questions yet.</div>'}</div>
      ${ro ? "" : '<div class="row"><button class="btn o s" id="r_addq">+ Add a question</button><button class="btn o s" id="r_std">Replace with the standard questions</button></div>'}
      <div id="r_score">${sc ? `<div class="score"><span class="big">${sc.score}%</span><div>${chip("Grade " + sc.grade, GC[sc.grade])}<div class="mut" style="font-size:13px;margin-top:3px">A: 90% and above · B: 80% to 89% · C: below 80%. A question rated 0 holds the grade at B or lower.</div></div></div>` : a.type === "Process" && !a.has_scoring ? '<div class="lock">🔒 VDA 6.3 scoring is not part of your plan. <button class="btn o s" id="sc_lk">Find out more</button></div>' : ""}</div>
      <h3 style="margin:16px 0 4px">Findings and actions</h3><div class="guide" style="margin-bottom:8px">Every Minor, Major or low-rated question needs an action with an owner and a due date before the report can be issued. After the action is done, tick <b>Effective</b> once you have checked that it worked.</div>
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
  function updateScore() { const a = S.a; if (a.type !== "Process" || !a.has_scoring || !a.can_edit) return; const sc = score(a.checklist), e = $("#r_score"); if (!e) return; e.innerHTML = sc ? `<div class="score"><span class="big">${sc.score}%</span><div>${chip("Grade " + sc.grade, GC[sc.grade])}<div class="mut" style="font-size:13px;margin-top:3px">A: 90% and above · B: 80% to 89% · C: below 80%. A question rated 0 holds the grade at B or lower.</div></div></div>` : ""; }
  function updateCount() { const a = S.a, r = (a.checklist || []).filter((x) => x.rating).length, e = $("#r_cnt"); if (e) e.textContent = r + " of " + (a.checklist || []).length + " rated"; }
  function wire() {
    const el = $("#rep"), a = S.a;
    $("#r_back").onclick = () => go("go=list"); $("#r_plan").onclick = () => { collect(); showDoc(AudDocs.plan(S.a)); };
    const rp = $("#r_rep"); if (rp) rp.onclick = () => showDoc(AudDocs.report(S.a));
    const lk = $("#sc_lk"); if (lk) lk.onclick = () => window.KMRLock && KMRLock.need("aud.vda-6-3-scoring");
    updateCount();
    if (a.can_edit) {
      el.querySelectorAll("input,textarea,select").forEach((e) => { if (!e.closest("[data-act],[data-qa]")) e.addEventListener("input", () => { dirty(); }); });
      $("#a_ty").onchange = () => { collect(); const was = a.checklist; if (!was.some((x) => x.rating) && (a.id ? !was.length || was.every((x) => !x.note) : true)) a.checklist = tmpl(a.type); a.ratings = ratings(a.type); dirty(); paint(); $("#sv_note").textContent = "Not saved yet"; };
      el.querySelectorAll(".cr").forEach((r) => {
        r.querySelectorAll(".rt button").forEach((b) => (b.onclick = () => { const v = b.dataset.v, on = r.dataset.rating === v; r.dataset.rating = on ? "" : v; collect(); dirty(); repaintChecklistKeep(); }));
        const d = r.querySelector("[data-del]"); if (d) d.onclick = () => { collect(); a.checklist = a.checklist.filter((x) => x.id !== r.dataset.q); dirty(); repaintChecklistKeep(); };
      });
      $("#r_addq").onclick = () => { collect(); a.checklist.push({ id: rid(), q: "", ref: "", rating: "", note: "" }); dirty(); repaintChecklistKeep(); const q = el.querySelectorAll('.cr [data-f="q"]'); if (q.length) q[q.length - 1].focus(); };
      $("#r_std").onclick = () => { collect(); if (a.checklist.some((x) => x.rating)) { showErr("Some questions are already rated, so they are not replaced. Remove questions one by one if you need to."); return; } a.checklist = tmpl(a.type); dirty(); repaintChecklistKeep(); };
    }
    wireActs(el);
    const sv = $("#b_save"); if (sv) sv.onclick = () => guard(async () => { const r = await saveAudit(); say("Saved.", true); if (!a.id) { setGo("go=list&id=" + r.id); route(); } else await reload(); });
    const run = (id, fn) => { const b = $(id); if (b) b.onclick = () => guard(async () => { $("#r_msg").hidden = true; try { await fn(); } catch (e) { showErr(e.message); } }); };
    run("#b_issue", async () => { if (a.can_edit) await saveAudit(); await call("kmr_aud_issue", { p_id: a.id }); say("The audit report is issued.", true); await reload(); });
    run("#b_close", async () => { await call("kmr_aud_close", { p_id: a.id }); say("The audit is closed.", true); await reload(); });
    run("#b_reopen", async () => { await call("kmr_aud_reopen", { p_id: a.id }); say("Opened again.", true); await reload(); });
    run("#b_cancel", async () => {
      const m = $("#r_msg"); m.hidden = false; m.style.background = "var(--bg)"; m.style.color = "var(--ink)"; m.innerHTML = '<b>Why is this audit cancelled?</b> <input id="cx_r" placeholder="Reason" style="margin:6px 0"><button class="btn s" id="cx_go">Cancel the audit</button>';
      $("#cx_go").onclick = () => guard(async () => { try { await call("kmr_aud_cancel", { p_id: a.id, p_reason: V("cx_r") }); S.dirty = false; say("The audit is cancelled.", true); await reload(); } catch (e) { m.textContent = e.message; m.style.background = ""; m.style.color = ""; } });
    });
    const dd = $("#b_del"); if (dd) dd.onclick = () => { const m = $("#r_msg"); m.hidden = false; m.style.background = "var(--bg)"; m.style.color = "var(--ink)"; m.innerHTML = '<b>Delete this audit with all its actions? It cannot be undone.</b> <button class="btn s" id="dl_go" style="background:var(--r)">Yes, delete</button>';
      $("#dl_go").onclick = () => guard(async () => { try { await call("kmr_aud_audit_delete", { p_id: a.id }); S.dirty = false; go("go=list"); } catch (e) { m.textContent = e.message; } }); };
  }
  /* repaint only the checklist, score and findings so typed text in the other fields is kept */
  function repaintChecklistKeep() {
    const a = S.a; $("#r_cl").innerHTML = (a.checklist || []).map((x, i) => cr(x, i, a)).join("") || '<div class="empty">No questions yet.</div>'; $("#r_find").innerHTML = findingsHtml();
    $("#rep").querySelectorAll(".cr").forEach((r) => {
      r.querySelectorAll("input,textarea").forEach((e) => e.addEventListener("input", dirty));
      r.querySelectorAll(".rt button").forEach((b) => (b.onclick = () => { const v = b.dataset.v, on = r.dataset.rating === v; r.dataset.rating = on ? "" : v; collect(); dirty(); repaintChecklistKeep(); }));
      const d = r.querySelector("[data-del]"); if (d) d.onclick = () => { collect(); a.checklist = a.checklist.filter((x) => x.id !== r.dataset.q); dirty(); repaintChecklistKeep(); };
    });
    wireActs($("#r_find")); updateScore(); updateCount(); const n = $("#sv_note"); if (n) n.textContent = "Not saved yet";
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
    if (hp.new) { if (!canEdit()) { go("go=list"); return; } S.a = blank(); S.dirty = false; paint(); return; }
    S.a = await call("kmr_aud_audit_get", { p_id: hp.id }); S.a.has_scoring = S.a.has_scoring && S.L.has_scoring; S.dirty = false; paint();
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

  /* ================= Setup ================= */
  async function drawSetup() {
    const el = $("#setup"); if (!isAdmin()) { el.innerHTML = '<div class="empty">Only an administrator can change the setup.</div>'; return; }
    const s = S.L.settings || {};
    el.innerHTML = `<div class="guide">These settings apply to the whole company.</div><div class="sg"><div><label>Number prefix</label><input id="s_pf" value="${esc(s.prefix || "AUD")}" maxlength="10"></div><div><label>Days given to fix a finding (suggested due date)</label><input id="s_dd" inputmode="numeric" value="${esc(s.due_days == null ? 30 : s.due_days)}"></div>
      <div class="w"><label class="cl"><input type="checkbox" id="s_fy"${s.fy_numbering === false ? "" : " checked"}> <span>Number by financial year (April to March), for example AUD/26-27/0001</span></label></div></div><div class="row" style="margin-top:12px"><button class="btn" id="s_save">Save setup</button></div>`;
    $("#s_save").onclick = () => guard(async () => { const o = { prefix: V("s_pf"), fy_numbering: V("s_fy"), due_days: V("s_dd") }; await call("kmr_aud_settings_save", { p: o }); S.L = await call("kmr_aud_load"); say("Saved.", true); });
  }

  /* ================= start ================= */
  window.AUD = { S, route, go, showDoc };
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
