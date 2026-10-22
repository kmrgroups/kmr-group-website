/* 8D Problem Solving - screens: Standards alignment, Dashboard, 8D register, one-screen 8D page (D0 to D8), Action tracker, Setup.
   Data calls are kmr_d8_* (database) or d8-demo.js (?demo=1). The step rules are enforced by the database; the messages are shown as they come. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP;
  const STEPS = [["D0", "Symptom and emergency response", "What was seen, and what was done at once to protect the customer."],
    ["D1", "Team", "Who solves this. A leader and at least two named people."],
    ["D2", "Describe the problem", "What is wrong compared with the requirement, where, when, who found it, how many."],
    ["D3", "Containment", "Stop bad parts reaching the customer until the real fix is in. Check every stock location."],
    ["D4", "Root causes", "Why it happened, and why it was not caught. Both must be proven, not guessed."],
    ["D5", "Permanent corrective actions", "The fix that removes the cause. Each action has an owner and a due date."],
    ["D6", "Check it works", "Do the actions, then prove with real results that the problem is gone."],
    ["D7", "Prevent it coming back", "Update FMEA, Control Plan and instructions; check similar parts; record lessons."],
    ["D8", "Close and thank the team", "Customer accepts, the team is recognised, the 8D is closed and locked."]];
  const KEYS = STEPS.map((s) => s[0]);
  const SOURCES = ["Customer complaint", "Internal rejection", "Supplier problem", "Audit finding", "Field failure", "Other"];
  const CATS = ["Machine", "Method", "Material", "Man", "Measurement", "Environment"];
  const KIND = { ICA: "Containment", PCA: "Corrective", PREVENT: "Prevention" };
  const SEV = { Minor: "x", Major: "a", Critical: "r" };
  const S = { L: null, rep: null, dirty: false, openSteps: {}, f: { q: "", status: "open", source: "" }, af: { status: "open", owner: "", overdue: false, q: "" } };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => (Array.isArray(x) ? x : [x, x])).map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const today = () => (S.L && S.L.today) || QP.today();
  const canEdit = () => !!QP.canEdit, isAdmin = () => S.L && S.L.role === "admin";
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const chip = (t, cls) => `<span class="chip ${cls || "x"}">${esc(t)}</span>`;
  const g = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const guard = async (fn) => { try { return await fn(); } catch (e) { say(e.message); return undefined; } };
  const due = (d, done) => { if (!d) return '<span class="mut">no date</span>'; const t = today(), s = String(d).slice(0, 10); return !done && s < t ? `<span class="late">${fmt(s)} · late</span>` : !done && s === t ? '<span class="today">Today</span>' : `<span>${fmt(s)}</span>`; };
  const ownerOpts = (sel) => opts([["", "—"]].concat((S.L.owners || []).map((o) => [o, o])).concat(sel && !(S.L.owners || []).includes(sel) ? [[sel, sel]] : []), sel);
  const dots = (steps, cur) => `<span class="dots" title="${Object.keys(steps || {}).length} of 9 steps done">${KEYS.map((k) => `<i class="${steps && steps[k] ? "d" : k === cur ? "c" : ""}"></i>`).join("")}</span>`;
  const go = (h) => { if (!leave()) return; setGo(h); route(); window.scrollTo(0, 0); };
  const leave = () => !S.dirty || confirm("You have changes that are not saved. Leave without saving?");
  const dl = () => `<datalist id="own">${(S.L.owners || []).map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`;

  /* ---------- modal + printed form ---------- */
  const closeM = () => { $("#m").classList.remove("on"); $("#mb").innerHTML = ""; };
  $("#m").addEventListener("mousedown", (e) => { if (e.target.id === "m") closeM(); });
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
      if (sec === "std") KMRStd.draw($("#std"), "d8");
      else if (sec === "dash") await drawDash();
      else if (sec === "list") await drawList();
      else if (sec === "rep") await drawRep(hp);
      else if (sec === "acts") await drawActs();
      else if (sec === "setup") await drawSetup();
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);

  /* ================= Dashboard ================= */
  async function drawDash() {
    const d = await call("kmr_d8_dashboard"), el = $("#dash"), bs = d.by_step || {}, mx = Math.max(1, ...KEYS.map((k) => bs[k] || 0));
    const kp = (h, c, b, l, sub) => `<div class="kpi" style="--c:${c}" data-go="${h}"><b>${b}</b><span>${l}</span>${sub ? `<small class="mut" style="display:block">${sub}</small>` : ""}</div>`;
    const bars = (o, key) => { const e = Object.entries(o || {}).sort((a, b) => b[1] - a[1]), m = Math.max(1, ...e.map((x) => x[1])); return e.length ? e.map(([k, n]) => `<div class="bl"${key ? ` data-${key}="${esc(k)}"` : ""}><span>${esc(k)}</span><i style="width:${Math.max(2, (n / m) * 100)}%"></i><b>${n}</b></div>`).join("") : '<div class="empty">Nothing yet.</div>'; };
    el.innerHTML = `<div class="guide">Every complaint or rejection becomes one 8D. A step is ticked only when its proof is written, so a ticked 8D can be trusted.</div>
      <div class="kpis">${kp("go=list", "var(--b1)", d.open, "open 8Ds", d.overdue ? d.overdue + " past due date" : "none late")}${kp("go=list", d.critical_open ? "var(--r)" : "var(--g)", d.critical_open, "critical open", "")}
      ${kp("go=list", d.no_containment ? "var(--r)" : "var(--g)", d.no_containment, "no containment yet", "open for over a day")}${kp("go=acts", d.actions_overdue ? "var(--r)" : "var(--a)", d.actions_open, "open actions", d.actions_overdue ? d.actions_overdue + " late" : "none late")}
      ${kp("go=list&st=closed", "var(--g)", d.closed_90, "closed in 90 days", d.avg_days_to_close == null ? "" : "average " + d.avg_days_to_close + " days")}</div>
      <div class="two"><div class="card"><h3>Where the open 8Ds are stuck</h3><div class="bars">${KEYS.map((k, i) => `<div class="bl" data-step="${k}"><span>${k} ${esc(STEPS[i][1].split(" ").slice(0, 2).join(" "))}</span><i style="width:${Math.max(bs[k] ? 3 : 0, ((bs[k] || 0) / mx) * 100)}%"></i><b>${bs[k] || 0}</b></div>`).join("")}</div></div>
      <div class="card"><h3>Where problems come from (12 months)</h3><div class="bars">${bars(d.by_source)}</div><h3 style="margin-top:12px">Root-cause category (12 months)</h3><div class="bars">${bars(d.by_cause)}</div></div></div>
      <div class="two"><div class="card"><h3>Next to finish</h3>${(d.due_soon || []).length ? d.due_soon.map((r) => `<div class="act" data-rep="${r.id}" style="cursor:pointer"><div style="flex:1"><div class="as"><b>${esc(r.no)}</b> · ${esc(r.title)} ${chip(r.severity, SEV[r.severity])}</div><small class="mut">at ${esc(r.current || "")} · ${due(r.due_on)}${r.part_no ? " · " + esc(r.part_no) : ""}</small></div></div>`).join("") : '<div class="empty">No open 8Ds.</div>'}</div>
      <div class="card"><h3>Late actions</h3>${(d.late_actions || []).length ? d.late_actions.map((a) => `<div class="act" data-rep="${a.report_id}" style="cursor:pointer"><div style="flex:1"><div class="as">${esc(a.text)}</div><small class="mut"><b>${esc(a.report_no)}</b> · ${esc(a.owner || "no owner")} · ${due(a.due_on)}</small></div></div>`).join("") : '<div class="empty">No late actions.</div>'}</div></div>`;
    el.querySelectorAll("[data-go]").forEach((e) => (e.onclick = () => { const h = e.dataset.go; S.f.status = /st=closed/.test(h) ? "closed" : "open"; go(h.replace(/&st=\w+/, "")); }));
    el.querySelectorAll("[data-rep]").forEach((e) => (e.onclick = () => go("go=list&id=" + e.dataset.rep)));
    el.querySelectorAll("[data-step]").forEach((e) => (e.onclick = () => { S.f.status = "open"; go("go=list"); }));
    el.querySelectorAll("[data-source]").forEach((e) => (e.onclick = () => { S.f.source = e.dataset.source; S.f.status = "all"; go("go=list"); }));
  }

  /* ================= 8D register ================= */
  async function drawList() {
    const f = S.f, el = $("#list"), can = canEdit();
    el.innerHTML = `<div class="guide">Start an 8D the moment a complaint or a rejection comes in. Open one to work through D0 to D8 on a single page.</div>
      <div class="row"><div class="grow"><input id="l_q" placeholder="Search number, problem, part, customer…" value="${esc(f.q)}"></div><select id="l_so" style="width:auto"><option value="">All sources</option>${opts(SOURCES, f.source)}</select>
      <div class="seg" style="margin:0">${[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map((x) => `<button data-st="${x[0]}" class="${f.status === x[0] ? "on" : ""}">${x[1]}</button>`).join("")}</div>
      ${can ? '<button class="btn" id="l_new">+ New 8D</button>' : ""}<button class="btn o" id="l_pr">Print list</button></div><div id="l_body"></div>`;
    const load = async () => {
      const list = await call("kmr_d8_report_list", { p: { q: f.q, status: f.status, source: f.source } });
      S.list = list;
      $("#l_body").innerHTML = list.length ? list.map((r) => `<div class="t ${r.status === "closed" ? "fin" : ""}" data-rep="${r.id}" style="--pc:var(--${r.severity === "Critical" ? "r" : r.severity === "Major" ? "a" : "mut"})"><div class="tb"><div class="tt">${esc(r.title)}</div>
        <div class="tm"><b>${esc(r.no)}</b> ${chip(r.severity, SEV[r.severity])} <span>${esc(r.source)}</span>${r.complainant ? "<span>· " + esc(r.complainant) + "</span>" : ""}${r.part_no ? "<span>· " + esc(r.part_no) + "</span>" : ""}</div>
        <div class="tm">${dots(r.steps, r.current)} ${r.status === "closed" ? chip("Closed " + fmt(r.closed_on), "g") : chip(r.current || "", "b")} <span>due ${due(r.due_on, r.status === "closed")}</span>${r.actions_overdue ? chip(r.actions_overdue + " late action" + (r.actions_overdue > 1 ? "s" : ""), "r") : ""}<span>${esc(r.owner || "")}</span></div></div></div>`).join("")
        : `<div class="empty">${f.q || f.source || f.status !== "all" ? "No 8D matches." : "No 8D reports yet."}${can ? "<br>Press <b>+ New 8D</b> to start the first one." : ""}</div>`;
      el.querySelectorAll("[data-rep]").forEach((e) => (e.onclick = () => go("go=list&id=" + e.dataset.rep)));
    };
    let tm; $("#l_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    $("#l_so").onchange = (e) => { f.source = e.target.value; guard(load); };
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    if (can) $("#l_new").onclick = () => go("go=list&new=1");
    $("#l_pr").onclick = () => showDoc(D8Docs.register(S.list || [], [f.status, f.source].filter((x) => x && x !== "all").join(", ")));
    await load();
  }

  /* ================= one 8D on one page ================= */
  const LISTS = {
    "d1.members": { cols: [["name", "Name", "t"], ["role", "Role", "t"], ["function", "Function", "t"]], w: "1.4fr 1fr 1fr", add: "+ Add a member", min: 3 },
    "d3.stock": { cols: [["where", "Where the stock is", "t"], ["checked", "Checked", "n"], ["ng", "Bad found", "n"], ["action", "What was done", "t"]], w: "1.3fr 80px 80px 1.6fr", add: "+ Add a place", min: 2 },
    "d5.options": { cols: [["text", "Option considered", "t"], ["chosen", "Chosen", "c"], ["verification", "How it was checked", "t"]], w: "2fr 90px 1.5fr", add: "+ Add an option", min: 1 },
    "d7.docs": { cols: [["name", "Document", "t"], ["done", "Updated", "c"], ["ref", "Revision / reference", "t"]], w: "1.4fr 90px 1.2fr", add: "+ Add a document", min: 0 }
  };
  const DOCS = ["PFMEA", "Control Plan", "Work instruction", "Drawing or specification", "Training record"];
  const lrow = (key, o, ro) => { const L = LISTS[key]; return `<div class="lr" data-row style="--cols:${L.w}">${L.cols.map((c) => c[2] === "c" ? `<label class="ck2"><input type="checkbox" data-f="${c[0]}"${o[c[0]] === true || o[c[0]] === "true" ? " checked" : ""}> <span>${c[1]}</span></label>` : `<input data-f="${c[0]}" data-t="${c[2]}" placeholder="${c[1]}" value="${esc(o[c[0]] == null ? "" : o[c[0]])}"${c[2] === "n" ? ' inputmode="decimal"' : ""}>`).join("")}${ro ? "" : '<button class="btn o s" data-rm title="Remove">✕</button>'}</div>`; };
  const listBlock = (key, arr, ro) => { const L = LISTS[key]; let a = (arr || []).slice(); while (a.length < L.min) a.push({}); return `<div data-list="${key}">${a.map((o) => lrow(key, o, ro)).join("")}</div>${ro ? "" : `<button class="btn o s" data-addrow="${key}">${L.add}</button>`}`; };
  const T = (id, label, val, extra, cls) => `<div class="${cls || ""}"><label>${label}</label><input data-k="${id}" value="${esc(val == null ? "" : val)}" ${extra || ""}></div>`;
  const TA = (id, label, val, rows, cls) => `<div class="${cls || "w"}"><label>${label}</label><textarea data-k="${id}" rows="${rows || 3}">${esc(val == null ? "" : val)}</textarea></div>`;
  const CK = (id, label, val) => `<label class="cl w"><input type="checkbox" data-k="${id}"${val === true || val === "true" ? " checked" : ""}> <span>${label}</span></label>`;
  const causeBlock = (k, title, c) => `<div class="cause"><h5>${title}</h5><div class="sg"><div><label>Category</label><select data-k="d4.${k}.category"><option value="">—</option>${opts(CATS, c.category)}</select></div>${TA("d4." + k + ".cause", "Root cause", c.cause, 2)}
    ${CK("d4." + k + ".verified", "This cause was verified (not just a guess)", c.verified)}${TA("d4." + k + ".method", "How it was verified", c.method, 2)}</div></div>`;

  function actBlock(kind) {
    const r = S.rep, ro = !r.can_edit, list = (r.actions || []).filter((a) => a.kind === kind), t = today();
    const rows = list.map((a) => `<div class="ab ${a.status === "done" ? "done" : a.status === "open" && a.due_on && a.due_on < t ? "late" : ""}" data-a="${a.id}"><input data-af="text" value="${esc(a.text)}" ${ro ? "disabled" : ""}><input data-af="owner" list="own" value="${esc(a.owner || "")}" placeholder="Owner" ${ro ? "disabled" : ""}>
      <input data-af="due_on" type="date" value="${esc(a.due_on || "")}" ${ro ? "disabled" : ""}><label class="cl"><input type="checkbox" data-af="done"${a.status === "done" ? " checked" : ""} ${ro ? "disabled" : ""}> <span>Done</span></label>
      ${kind === "PCA" ? `<label class="cl"><input type="checkbox" data-af="verified"${a.verified ? " checked" : ""} ${ro ? "disabled" : ""}> <span>Effective</span></label>` : "<span></span>"}${ro ? "<span></span>" : '<button class="btn o s" data-adel title="Remove">✕</button>'}
      <div class="ex"><input data-af="evidence" value="${esc(a.evidence || "")}" placeholder="Evidence: record, report, photo reference…" ${ro ? "disabled" : ""}></div></div>`).join("");
    const add = ro ? "" : r.id ? `<div class="qa" data-qa="${kind}"><div><label>New ${KIND[kind].toLowerCase()} action</label><input data-q="text" placeholder="${kind === "ICA" ? "Sort all stock at the customer and in our plant" : kind === "PCA" ? "Add the offset step to the changeover sheet" : "Apply the same rule to similar parts"}"></div><div><label>Owner</label><input data-q="owner" list="own"></div><div><label>Due</label><input data-q="due_on" type="date"></div><button class="btn s" data-qadd>Add</button></div>` : "";
    return `<div class="sub" style="margin:12px 0 4px"><b>${KIND[kind]} actions</b></div>${rows || '<div class="mut" style="margin-bottom:4px">No actions yet.</div>'}${add}`;
  }

  function collectSections() {
    const o = {}; const put = (p, v) => { const ks = p.split("."); let c = o; ks.slice(0, -1).forEach((k) => (c = c[k] = c[k] || {})); c[ks[ks.length - 1]] = v; };
    $("#rep").querySelectorAll("[data-k]").forEach((e) => { if (/^d\d\./.test(e.dataset.k)) put(e.dataset.k, e.type === "checkbox" ? e.checked : e.value); });
    $("#rep").querySelectorAll("[data-list]").forEach((c) => { put(c.dataset.list, [...c.querySelectorAll("[data-row]")].map((row) => { const x = {}; row.querySelectorAll("[data-f]").forEach((f) => (x[f.dataset.f] = f.type === "checkbox" ? f.checked : f.value)); return x; }).filter((x) => Object.values(x).some((v) => v === true || (v !== false && String(v).trim() !== "")))); });
    return o;
  }
  function collectAnalysis() {
    const a = { is_not: [], whys: { occurrence: [], escape: [] }, fishbone: {} };
    $("#rep").querySelectorAll("[data-isn]").forEach((r) => a.is_not.push({ dim: r.dataset.isn, is: r.querySelector('[data-c="is"]').value, is_not: r.querySelector('[data-c="is_not"]').value, diff: r.querySelector('[data-c="diff"]').value }));
    $("#rep").querySelectorAll("[data-why]").forEach((e) => { const [k, i] = e.dataset.why.split(":"); a.whys[k][+i] = e.value; });
    $("#rep").querySelectorAll("[data-fb]").forEach((e) => (a.fishbone[e.dataset.fb] = e.value.split("\n").map((x) => x.trim()).filter(Boolean)));
    return a;
  }
  function header() {
    const o = { title: V("h_ti"), source: V("h_so"), severity: S.sev, complainant: V("h_cu"), complaint_ref: V("h_cr"), part_no: V("h_pn"), part_name: V("h_pa"), lot_no: V("h_lo"), qty_affected: V("h_qt"), opened_on: V("h_op"), due_on: V("h_du"), owner: V("h_ow"), notes: V("h_no") };
    if (S.rep && S.rep.id) o.id = S.rep.id; return o;
  }
  const dirty = () => { S.dirty = true; const b = $("#sv_note"); if (b) b.textContent = "Not saved yet"; };

  async function saveRep() {
    const r = S.rep, o = header(); o.sections = collectSections();
    const res = await call("kmr_d8_report_save", { p: o });
    if (r.id && S.L && r.has_analysis && $("[data-isn]")) await call("kmr_d8_analysis_save", { p_id: r.id, p: collectAnalysis() });
    S.dirty = false; return res;
  }
  async function reload(keepForm) {
    const id = S.rep.id, keep = keepForm ? { sec: collectSections(), an: S.rep.has_analysis && $("[data-isn]") ? collectAnalysis() : null, h: header() } : null;
    const fresh = await call("kmr_d8_report_get", { p_id: id });
    S.rep = fresh; if (!keep) return;
    paintTop(); paintActs(); paintStatus();
  }
  function paintTop() {
    const r = S.rep; $("#rp_steps").innerHTML = STEPS.map((s) => `<div class="sp ${r.steps[s[0]] ? "done" : r.current === s[0] ? "cur" : ""}" data-sp="${s[0]}"><b>${s[0]}${r.steps[s[0]] ? " ✓" : ""}</b><small>${esc(s[1].split(" ").slice(0, 2).join(" "))}</small></div>`).join("");
    $("#rp_steps").querySelectorAll("[data-sp]").forEach((e) => (e.onclick = () => { const d = $('details[data-s="' + e.dataset.sp + '"]'); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
    const cs = $("#rp_chip"); if (cs) cs.innerHTML = r.status === "closed" ? chip("Closed " + fmt(r.closed_on), "g") : chip("Open · " + (r.current || ""), "b");
  }
  function paintActs() {
    $("#rep").querySelectorAll("[data-actsfor]").forEach((c) => { c.innerHTML = actBlock(c.dataset.actsfor); wireActs(c); });
    const n6 = (S.rep.actions || []).filter((a) => a.kind === "PCA"); const e = $("#d6_sum"); if (e) e.textContent = n6.length ? n6.filter((a) => a.status === "done").length + " of " + n6.length + " corrective actions done." : "No corrective actions yet; add them in D5.";
  }
  function paintStatus() {
    const r = S.rep; STEPS.forEach((s, i) => {
      const d = $('details[data-s="' + s[0] + '"]'); if (!d) return; const done = r.steps[s[0]]; d.classList.toggle("done", !!done); d.classList.toggle("cur", !done && r.current === s[0]);
      d.querySelector(".sn").textContent = done ? "✓" : s[0]; d.querySelector(".sd").innerHTML = done ? "Done " + fmt(done) : r.current === s[0] ? "Working on this step" : "";
      const b = d.querySelector(".stdone"); if (b) b.innerHTML = stepBar(s[0]);
    }); wireSteps();
  }
  function stepBar(k) {
    const r = S.rep, done = r.steps[k], can = canEdit(); if (!can && !done) return '<span class="mut">You can view this 8D but not change it.</span>';
    if (done) return `${chip("Done " + fmt(done), "g")} ${k === "D8" ? (isAdmin() ? `<button class="btn o s" data-reopen="${k}">Reopen this 8D</button>` : '<span class="mut">Only an administrator can reopen a closed 8D.</span>') : r.can_edit ? `<button class="btn o s" data-reopen="${k}">Open this step again</button>` : ""}`;
    const i = KEYS.indexOf(k), prev = i > 0 && !r.steps[KEYS[i - 1]];
    return prev ? `<span class="mut">Finish ${KEYS[i - 1]} first.</span>` : `<button class="btn g" data-markdone="${k}">${k === "D8" ? "Close this 8D" : "Mark " + k + " done"}</button><span class="mut">The step is ticked only if its proof is written.</span>`;
  }
  function wireSteps() {
    $("#rep").querySelectorAll("[data-markdone]").forEach((b) => (b.onclick = () => guard(async () => {
      const k = b.dataset.markdone, wh = b.closest(".stp").querySelector(".wh"); wh.hidden = true; b.disabled = true;
      try { if (S.rep.can_edit) await saveRep(); await call("kmr_d8_step", { p_id: S.rep.id, p_step: k, p_done: true }); await reload(true); say(k === "D8" ? "The 8D is closed." : k + " is done.", true); if (k === "D8") route(); else { const nx = $('details[data-s="' + KEYS[KEYS.indexOf(k) + 1] + '"]'); if (nx) { nx.open = true; nx.scrollIntoView({ behavior: "smooth", block: "start" }); } } }
      catch (e) { wh.textContent = e.message; wh.hidden = false; b.disabled = false; }
    })));
    $("#rep").querySelectorAll("[data-reopen]").forEach((b) => (b.onclick = () => guard(async () => {
      const k = b.dataset.reopen; if (k === "D8" && !confirm("Reopen this closed 8D?")) return;
      await call("kmr_d8_step", { p_id: S.rep.id, p_step: k, p_done: false }); say("Opened again.", true); if (k === "D8") route(); else { await reload(true); }
    })));
  }
  function wireActs(root) {
    const scope = root || $("#rep"); const refresh = async () => { await reload(true); };
    scope.querySelectorAll("[data-qadd]").forEach((b) => (b.onclick = () => guard(async () => {
      const q = b.closest("[data-qa]"), v = (k) => q.querySelector('[data-q="' + k + '"]').value;
      await call("kmr_d8_act_save", { p: { report_id: S.rep.id, kind: q.dataset.qa, text: v("text"), owner: v("owner"), due_on: v("due_on") } }); await refresh();
    })));
    scope.querySelectorAll("[data-a]").forEach((row) => {
      const val = (k) => row.querySelector('[data-af="' + k + '"]'); const a = S.rep.actions.find((x) => x.id === row.dataset.a);
      const save = () => guard(async () => { await call("kmr_d8_act_save", { p: { id: a.id, kind: a.kind, text: val("text").value, owner: val("owner").value, due_on: val("due_on").value, status: val("done").checked ? "done" : "open", evidence: val("evidence").value, verified: val("verified") ? val("verified").checked : false } }); await refresh(); });
      row.querySelectorAll("[data-af]").forEach((e) => (e.onchange = save));
      const del = row.querySelector("[data-adel]"); if (del) del.onclick = () => guard(async () => { await call("kmr_d8_act_delete", { p_id: a.id }); await refresh(); });
    });
  }
  function wireList(root) {
    root.querySelectorAll("[data-addrow]").forEach((b) => (b.onclick = () => { const c = $('[data-list="' + b.dataset.addrow + '"]'); c.insertAdjacentHTML("beforeend", lrow(b.dataset.addrow, {})); wireList(c); dirty(); }));
    root.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { b.closest("[data-row]").remove(); dirty(); }));
  }

  function tools(r) {
    const an = r.analysis || {}, lockHtml = (n) => `<div class="lock">🔒 ${n} is not part of your plan. <button class="btn o s" data-lock="d8.analysis">Find out more</button></div>`;
    const isn = (an.is_not && an.is_not.length ? an.is_not : ["What", "Where", "When", "How much"].map((d) => ({ dim: d }))), ro = !r.can_edit;
    const whys = an.whys || {}, fb = an.fishbone || {};
    return {
      isnot: !hasF("d8.analysis") || !r.has_analysis ? lockHtml("The Is / Is-not table") : `<div class="tool"><h4>Is / Is-not: sharpen the problem</h4><div class="mut" style="font-size:12.5px;margin-bottom:6px">Write what the problem is, and what it could be but is not. The difference points to the cause.</div>
        <div class="sc"><table class="tb2" style="min-width:520px"><thead><tr><th></th><th>Is</th><th>Is not</th><th>What is different</th></tr></thead><tbody>${isn.map((x) => `<tr data-isn="${esc(x.dim)}"><td><b>${esc(x.dim)}</b></td>${["is", "is_not", "diff"].map((c) => `<td><input data-c="${c}" value="${esc(x[c] || "")}" ${ro ? "disabled" : ""}></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`,
      whys: !hasF("d8.analysis") || !r.has_analysis ? lockHtml("The 5-Why and fishbone tools") : `<div class="tool"><h4>5-Why: ask why until you reach the cause</h4><div class="two">${["occurrence", "escape"].map((k) => `<div><div class="lbl">${k === "occurrence" ? "Why did it happen?" : "Why was it not detected?"}</div><div class="whys">${[0, 1, 2, 3, 4].map((i) => `<div class="wr"><b>Why ${i + 1}</b><input data-why="${k}:${i}" value="${esc((whys[k] || [])[i] || "")}" ${ro ? "disabled" : ""}></div>`).join("")}</div></div>`).join("")}</div></div>
        <div class="tool"><h4>Cause and effect (fishbone)</h4><div class="mut" style="font-size:12.5px;margin-bottom:6px">One idea per line under each heading.</div><div class="fish">${CATS.map((c) => `<div><label>${c}</label><textarea data-fb="${c}" ${ro ? "disabled" : ""}>${esc((fb[c] || []).join("\n"))}</textarea></div>`).join("")}</div></div>`
    };
  }

  async function drawRep(hp) {
    const el = $("#rep"), can = canEdit();
    if (hp.new) {
      if (!can) { el.innerHTML = '<div class="empty">You can view this app but not change it.</div>'; return; }
      S.rep = { id: null, can_edit: true, actions: [], steps: {}, sections: {}, analysis: {}, severity: "Major" }; S.sev = "Major";
      el.innerHTML = `${dl()}<div class="row"><button class="btn o s" id="r_back">← 8D register</button><h3 style="margin:0">New 8D</h3></div><div class="guide">Fill in what you know now. You can add the rest after the 8D is created.</div>
        <div class="sg"><div class="w"><label>Problem in a few words</label><input id="h_ti" placeholder="Bore diameter oversize on Drive Flange"></div><div><label>Where it came from</label><select id="h_so">${opts(SOURCES, "Customer complaint")}</select></div>
        <div><label>Severity</label><div class="seg" id="h_sev">${["Minor", "Major", "Critical"].map((x) => `<button data-sev="${x}" class="${x === "Major" ? "on" : ""}">${x}</button>`).join("")}</div></div>
        <div><label>Customer or who raised it</label><input id="h_cu"></div><div><label>Their reference</label><input id="h_cr"></div><div><label>Part no.</label><input id="h_pn"></div><div><label>Part name</label><input id="h_pa"></div><div><label>Lot / batch no.</label><input id="h_lo"></div><div><label>Quantity affected</label><input id="h_qt" inputmode="decimal"></div>
        <div><label>Opened on</label><input id="h_op" type="date" value="${today()}"></div><div><label>Due date</label><input id="h_du" type="date"></div><div><label>Owner</label><select id="h_ow">${ownerOpts(S.L.me)}</select></div>
        <div class="w"><label>What was seen (symptom)</label><textarea data-k="d0.symptom" rows="3" placeholder="What the customer or the line saw"></textarea></div></div>
        <div class="row" style="margin-top:12px"><button class="btn" id="r_create">Create 8D</button><span class="mut">The due date is filled in for you if you leave it empty.</span></div>`;
      $("#r_back").onclick = () => go("go=list"); document.querySelectorAll("#h_sev [data-sev]").forEach((b) => (b.onclick = () => { S.sev = b.dataset.sev; document.querySelectorAll("#h_sev button").forEach((x) => x.classList.toggle("on", x === b)); }));
      $("#r_create").onclick = () => guard(async () => { const o = header(); o.sections = collectSections(); if (!o.due_on) delete o.due_on; const res = await call("kmr_d8_report_save", { p: o }); S.dirty = false; say("Created " + res.no + ".", true); setGo("go=list&id=" + res.id); route(); });
      return;
    }
    S.rep = await call("kmr_d8_report_get", { p_id: hp.id }); const r = S.rep; S.sev = r.severity; S.dirty = false; const ro = !r.can_edit, T0 = tools(r);
    const sec = (k) => r.sections[k.toLowerCase()] || {}, d0 = sec("D0"), d1 = sec("D1"), d2 = sec("D2"), d3 = sec("D3"), d4 = sec("D4"), d5 = sec("D5"), d6 = sec("D6"), d7 = sec("D7"), d8 = sec("D8");
    if (!(d7.docs || []).length) d7.docs = DOCS.map((n) => ({ name: n, done: false }));
    const stp = (k, body) => { const i = KEYS.indexOf(k), done = r.steps[k], cur = !done && r.current === k, open = S.openSteps[k] != null ? S.openSteps[k] : cur;
      return `<details class="stp ${done ? "done" : cur ? "cur" : ""}" data-s="${k}"${open ? " open" : ""}><summary><span class="sn">${done ? "✓" : k}</span><span class="st">${k} · ${STEPS[i][1]}<small>${STEPS[i][2]}</small></span><span class="sd mut">${done ? "Done " + fmt(done) : cur ? "Working on this step" : ""}</span></summary><div class="sb"><fieldset class="${ro ? "ro" : ""}" style="border:0;padding:0;margin:0"${ro ? " disabled" : ""}>${body}</fieldset><div class="wh" hidden></div><div class="stdone">${stepBar(k)}</div></div></details>`; };
    el.innerHTML = `${dl()}<div class="row"><button class="btn o s" id="r_back">← 8D register</button><h3 style="margin:0;flex:1;min-width:150px">${esc(r.no)} <span id="rp_chip"></span></h3><button class="btn o s" id="r_print">Print 8D report</button>${r.status === "closed" || !can ? "" : '<button class="btn o s" id="r_del" style="color:var(--r);border-color:var(--r)">Delete</button>'}${r.status === "closed" && isAdmin() ? '<button class="btn o s" id="r_del2" style="color:var(--r);border-color:var(--r)">Delete</button>' : ""}</div>
      ${r.status === "closed" ? '<div class="msg ok">This 8D is closed and locked. Only an administrator can reopen it.</div>' : ""}
      <fieldset class="${ro ? "ro" : ""}" style="border:0;padding:0;margin:0"${ro ? " disabled" : ""}><div class="sg"><div class="w"><label>Problem in a few words</label><input id="h_ti" value="${esc(r.title)}"></div><div><label>Where it came from</label><select id="h_so">${opts(SOURCES, r.source)}</select></div>
      <div><label>Severity</label><div class="seg" id="h_sev">${["Minor", "Major", "Critical"].map((x) => `<button data-sev="${x}" class="${x === r.severity ? "on" : ""}">${x}</button>`).join("")}</div></div>
      <div><label>Customer or who raised it</label><input id="h_cu" value="${esc(r.complainant || "")}"></div><div><label>Their reference</label><input id="h_cr" value="${esc(r.complaint_ref || "")}"></div><div><label>Part no.</label><input id="h_pn" value="${esc(r.part_no || "")}"></div><div><label>Part name</label><input id="h_pa" value="${esc(r.part_name || "")}"></div>
      <div><label>Lot / batch no.</label><input id="h_lo" value="${esc(r.lot_no || "")}"></div><div><label>Quantity affected</label><input id="h_qt" inputmode="decimal" value="${r.qty_affected == null ? "" : esc(r.qty_affected)}"></div><div><label>Opened on</label><input id="h_op" type="date" value="${esc(r.opened_on || "")}"></div><div><label>Due date</label><input id="h_du" type="date" value="${esc(r.due_on || "")}"></div>
      <div><label>Owner</label><select id="h_ow">${ownerOpts(r.owner)}</select></div><div class="w"><label>Notes</label><textarea id="h_no" rows="1">${esc(r.notes || "")}</textarea></div></div></fieldset>
      <div class="stepper" id="rp_steps" style="margin-top:12px"></div>
      ${stp("D0", `<div class="sg">${TA("d0.symptom", "Symptom: what was seen", d0.symptom, 3)}${CK("d0.era_needed", "An emergency response was needed (protect the customer today)", d0.era_needed)}${TA("d0.era", "Emergency response taken", d0.era, 2)}</div>`)}
      ${stp("D1", `<div class="sg">${T("d1.leader", "Team leader", d1.leader)}${T("d1.champion", "Sponsor / champion", d1.champion)}</div><div class="lbl" style="margin-top:10px">Team members (at least two)</div>${listBlock("d1.members", d1.members, ro)}`)}
      ${stp("D2", `<div class="sg">${TA("d2.requirement", "What the requirement is", d2.requirement, 2)}${TA("d2.deviation", "What is wrong compared with it", d2.deviation, 2)}${T("d2.where", "Where it was found", d2.where)}${T("d2.when", "When", d2.when)}${T("d2.who", "Who found it", d2.who)}${T("d2.how_detected", "How it was detected", d2.how_detected)}${T("d2.how_many", "How many (for example 60 of 800)", d2.how_many)}${CK("d2.repeat", "This has happened before", d2.repeat)}</div>${T0.isnot}`)}
      ${stp("D3", `${CK("d3.not_required", "Containment is not needed", d3.not_required)}${T("d3.reason", "Reason it is not needed", d3.reason, "", "w")}<div class="lbl" style="margin-top:10px">Where is the suspect stock? Check customer, in transit, our stock</div>${listBlock("d3.stock", d3.stock, ro)}<div data-actsfor="ICA"></div>${TA("d3.result", "Result of containment", d3.result, 2)}`)}
      ${stp("D4", `${causeBlock("occurrence", "Why did it happen? (occurrence)", g(d4, "occurrence") || {})}${causeBlock("escape", "Why was it not detected? (escape point)", g(d4, "escape") || {})}<div class="sg">${TA("d4.systemic.cause", "System cause: which rule, standard or procedure allowed it", g(d4, "systemic.cause"), 2)}</div>${T0.whys}`)}
      ${stp("D5", `<div class="lbl">Options considered</div>${listBlock("d5.options", d5.options, ro)}<div class="sg" style="margin-top:8px">${TA("d5.verification_summary", "Check before roll-out: how you know the chosen fix works", d5.verification_summary, 2)}</div><div data-actsfor="PCA"></div>`)}
      ${stp("D6", `<div class="mut" id="d6_sum" style="margin-bottom:6px"></div><div data-actsfor="PCA"></div><div class="sg" style="margin-top:10px">${T("d6.validation.method", "How it was checked", g(d6, "validation.method"))}${T("d6.validation.date", "Date", g(d6, "validation.date"), 'type="date"')}${TA("d6.validation.result", "Result: the proof that the problem is gone", g(d6, "validation.result"), 2)}${CK("d6.validation.ok", "The problem is gone", g(d6, "validation.ok"))}${CK("d6.ica_removed.done", "Containment has been removed", g(d6, "ica_removed.done"))}${T("d6.ica_removed.date", "Containment removed on", g(d6, "ica_removed.date"), 'type="date"')}${T("d6.monitoring.days", "Keep watching for (days)", g(d6, "monitoring.days"), 'inputmode="numeric"')}</div>`)}
      ${stp("D7", `<div class="lbl">Documents updated after this problem</div>${listBlock("d7.docs", d7.docs, ro)}<div data-actsfor="PREVENT"></div><div class="sg" style="margin-top:8px">${TA("d7.horizontal", "Similar parts, machines or lines checked", d7.horizontal, 2)}${TA("d7.lessons", "Lessons learned", d7.lessons, 2)}</div>`)}
      ${stp("D8", `<div class="sg">${CK("d8.customer_accepted", "The customer accepted the 8D", d8.customer_accepted)}${T("d8.customer_ref", "Customer reference or closure letter", d8.customer_ref)}${TA("d8.recognition", "Thanks to the team", d8.recognition, 2)}${TA("d8.note", "Closing note", d8.note, 2)}</div>`)}
      <div class="th"><h4 style="margin:0 0 6px">History</h4>${(r.log || []).map((l) => `<div class="cm ev"><b>${esc(l.text)}</b> <small>${esc(l.by || "")} · ${fmt(String(l.at).slice(0, 10))}</small></div>`).join("") || '<div class="mut">Nothing yet.</div>'}</div>
      ${ro ? "" : '<div class="sticky"><button class="btn" id="r_save">Save</button><span class="mut" id="sv_note"></span></div>'}`;
    paintTop(); paintActs(); wireList(el); wireSteps();
    el.querySelectorAll("details.stp").forEach((d) => d.addEventListener("toggle", () => (S.openSteps[d.dataset.s] = d.open)));
    el.querySelectorAll("[data-lock]").forEach((b) => (b.onclick = () => window.KMRLock && KMRLock.need(b.dataset.lock)));
    el.querySelectorAll("input[data-k],textarea[data-k],select[data-k],#h_ti,#h_so,#h_cu,#h_cr,#h_pn,#h_pa,#h_lo,#h_qt,#h_op,#h_du,#h_ow,#h_no,[data-c],[data-why],[data-fb],[data-list] input").forEach((e) => { e.addEventListener("input", dirty); e.addEventListener("change", dirty); });
    el.querySelectorAll("#h_sev [data-sev]").forEach((b) => (b.onclick = () => { if (ro) return; S.sev = b.dataset.sev; el.querySelectorAll("#h_sev button").forEach((x) => x.classList.toggle("on", x === b)); dirty(); }));
    $("#r_back").onclick = () => go("go=list");
    $("#r_print").onclick = () => guard(async () => { if (S.dirty && r.can_edit) { await saveRep(); await reload(false); } const fresh = await call("kmr_d8_report_get", { p_id: r.id }); showDoc(D8Docs.report(fresh, { me: S.L.me })); });
    const del = $("#r_del") || $("#r_del2"); if (del) del.onclick = () => guard(async () => { if (!confirm("Delete this 8D with its actions and history? This cannot be undone.")) return; await call("kmr_d8_report_delete", { p_id: r.id }); S.dirty = false; say("Deleted.", true); go("go=list"); });
    if (!ro) $("#r_save").onclick = () => guard(async () => { await saveRep(); S.rep = await call("kmr_d8_report_get", { p_id: r.id }); paintTop(); paintActs(); paintStatus(); const n = $("#sv_note"); if (n) n.textContent = "Saved"; say("Saved.", true); });
    if (location.hash.indexOf("step=") >= 0) { const k = hashParts().step, d = $('details[data-s="' + k + '"]'); if (d) d.open = true; }
  }

  /* ================= Action tracker ================= */
  async function drawActs() {
    const el = $("#acts"), f = S.af, can = canEdit();
    if (!hasF("d8.action-tracker")) { el.innerHTML = '<div class="lock">🔒 The action tracker is not part of your plan. <button class="btn o s" id="a_lk">Find out more</button></div>'; $("#a_lk").onclick = () => window.KMRLock && KMRLock.need("d8.action-tracker"); return; }
    el.innerHTML = `<div class="guide">Every action of every 8D in one list. Tick an action when it is done; the 8D page shows the same list.</div>
      <div class="row"><div class="grow"><input id="a_q" placeholder="Search action or 8D…" value="${esc(f.q)}"></div><select id="a_ow" style="width:auto"><option value="">Everyone</option>${opts((S.L.owners || []).map((o) => [o, o]), f.owner)}</select>
      <div class="seg" style="margin:0">${[["open", "Open"], ["done", "Done"], ["all", "All"]].map((x) => `<button data-st="${x[0]}" class="${f.status === x[0] ? "on" : ""}">${x[1]}</button>`).join("")}<button data-od class="${f.overdue ? "on" : ""}">Late only</button></div><button class="btn o" id="a_pr">Print list</button></div><div id="a_body"></div>`;
    const load = async () => {
      const list = await call("kmr_d8_act_list", { p: { status: f.status, owner: f.owner, overdue: f.overdue ? "true" : "", q: f.q } }); S.alist = list;
      $("#a_body").innerHTML = list.length ? `<div class="sc"><table class="tb2"><thead><tr><th></th><th>8D</th><th>Kind</th><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody>${list.map((a) => `<tr data-rep="${a.report_id}"><td>${can ? `<button class="ck ${a.status === "done" ? "on" : ""}" data-done="${a.id}" data-to="${a.status === "done" ? 0 : 1}" title="${a.status === "done" ? "Mark open" : "Mark done"}">${a.status === "done" ? "✓" : ""}</button>` : ""}</td>
        <td><b>${esc(a.report_no)}</b><br><small class="mut">${esc(a.report_title)}</small></td><td>${chip(KIND[a.kind] || a.kind, a.kind === "PCA" ? "b" : a.kind === "ICA" ? "a" : "v")}</td><td>${esc(a.text)}</td><td>${esc(a.owner || "")}</td><td>${due(a.due_on, a.status === "done")}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No actions match.</div>';
      el.querySelectorAll("tr[data-rep]").forEach((r) => (r.onclick = (e) => { if (e.target.closest("[data-done]")) return; go("go=list&id=" + r.dataset.rep); }));
      el.querySelectorAll("[data-done]").forEach((b) => (b.onclick = () => guard(async () => { await call("kmr_d8_act_done", { p_id: b.dataset.done, p_done: b.dataset.to === "1" }); await load(); })));
    };
    let tm; $("#a_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    $("#a_ow").onchange = (e) => { f.owner = e.target.value; guard(load); };
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    el.querySelector("[data-od]").onclick = (e) => { f.overdue = !f.overdue; e.target.classList.toggle("on", f.overdue); guard(load); };
    $("#a_pr").onclick = () => showDoc(D8Docs.actions(S.alist || [], [f.status, f.owner, f.overdue ? "late only" : ""].filter((x) => x && x !== "all").join(", ")));
    await load();
  }

  /* ================= Setup ================= */
  async function drawSetup() {
    const el = $("#setup"); if (!isAdmin()) { el.innerHTML = '<div class="empty">Only an administrator can change the setup.</div>'; return; }
    const s = S.L.settings || {};
    el.innerHTML = `<div class="guide">These settings apply to the whole company.</div><div class="sg"><div><label>Number prefix</label><input id="s_pf" value="${esc(s.prefix || "8D")}" maxlength="10"></div><div><label>Days to complete an 8D</label><input id="s_dd" inputmode="numeric" value="${esc(s.due_days == null ? 15 : s.due_days)}"></div>
      <div class="w"><label class="cl"><input type="checkbox" id="s_fy"${s.fy_numbering === false ? "" : " checked"}> <span>Number by financial year (April to March), for example 8D/26-27/0001</span></label></div></div><div class="row" style="margin-top:12px"><button class="btn" id="s_save">Save setup</button></div>`;
    $("#s_save").onclick = () => guard(async () => { const o = { prefix: V("s_pf"), fy_numbering: V("s_fy"), due_days: V("s_dd") }; await call("kmr_d8_settings_save", { p: o }); S.L = await call("kmr_d8_load"); say("Saved.", true); });
  }

  /* ================= start ================= */
  window.D8 = { S, route, go, showDoc };
  async function start() {
    try {
      await QP.init("d8"); if (!QP.ctx) return;
      S.L = await call("kmr_d8_load"); $("#role").textContent = S.L.role;
      const stab = document.querySelector('.tab[data-t="setup"]'); if (stab && !isAdmin()) stab.classList.add("hide");
      window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
      await route();
    } catch (e) { say(e.message); }
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
