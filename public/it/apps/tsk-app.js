/* ActionTrack - screens. Data calls are kmr_tsk_* (database) or tsk-demo.js (?demo=1).
   Simple on purpose: one list of tasks, tap a task to open it, tap the circle to finish it. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP;
  const S = { people: null, scope: "mine", tasks: [], f: { q: "", status: "active", priority: "", who: "" }, dash: "mine", notes: { unread: 0, items: [] }, seen: -1, openId: null };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const canAssign = () => !!(S.people && S.people.can_assign);
  const open = (h) => { $("#mb").innerHTML = h; $("#m").classList.add("on"); }, closeM = () => { $("#m").classList.remove("on"); S.openId = null; };
  $("#m").addEventListener("click", (e) => { if (e.target.id === "m") closeM(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeM(); });
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const localDay = (n) => { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const A = (o) => Object.assign({ today: localDay(0) }, o || {});
  const ST = { open: "To do", progress: "In progress", blocked: "Blocked", done: "Done", cancelled: "Cancelled" };
  const STC = { open: "x", progress: "b", blocked: "r", done: "g", cancelled: "x" };
  const PR = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
  const PRC = { urgent: "r", high: "a", normal: "b", low: "x" };
  const SRC = { mom: "Minutes of Meetings", sales: "Sales Flow", mnt: "Maintenance", calib: "Calibration Hub", apqp: "APQP Planner", ppap: "PPAP", rmp: "Material Planning", mmd: "Manufacturing", hrms: "HRM & Payroll", spc: "SPC Charts", msa: "MSA Studies", direct: "Created here" };
  const days = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);
  function dueText(t) {
    if (!t.due) return { s: "No due date", c: "" };
    const d = days(t.due, localDay(0)), fin = t.status === "done" || t.status === "cancelled";
    if (fin) return { s: "Due " + fmt(t.due), c: "" };
    if (d < 0) return { s: "Overdue by " + -d + (d === -1 ? " day" : " days"), c: "late" };
    if (d === 0) return { s: "Due today", c: "today" };
    if (d === 1) return { s: "Due tomorrow", c: "" };
    return { s: "Due " + fmt(t.due), c: "" };
  }
  const first = (n) => String(n || "").split(" ")[0];
  const hashParts = () => { const h = location.hash.replace(/^#/, ""), o = {}; h.split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (go) => history.replaceState(null, "", location.pathname + location.search + "#go=" + go);

  /* ================= router ================= */
  const SECTIONS = { std: "std", mine: "list", by_me: "list", all: "list", dash: "dash", alerts: "alerts" };
  async function route() {
    const hp = hashParts(); let go = SECTIONS[hp.go] ? hp.go : "std";
    if (window.KMRLock && KMRLock.locked(go)) { KMRLock.dialog(go); go = "std"; setGo("std"); }
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    ["std", "list", "dash", "alerts"].forEach((s) => $("#" + s).classList.toggle("hide", s !== SECTIONS[go]));
    $("#fab").classList.toggle("hide", go === "std");
    if (go === "std") { KMRStd.draw($("#std"), "tsk"); return; }
    try {
      if (!S.people) S.people = await call("kmr_tsk_people");
      if (go === "dash") await drawDash(); else if (go === "alerts") await drawAlerts(); else { S.scope = go; await drawList(); }
      if (hp.t) { const id = hp.t; history.replaceState(null, "", location.pathname + location.search + "#go=" + go); openTask(id); }
    } catch (e) { say(e.message); }
  }
  document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#go="]'); if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); history.replaceState(null, "", location.pathname + location.search + a.getAttribute("href")); route(); });
  window.addEventListener("hashchange", route);
  const refresh = () => route();

  /* ================= task list ================= */
  async function loadTasks() {
    const f = S.f, p = A({ scope: S.scope, status: f.status, q: f.q, priority: f.priority });
    if (S.scope === "all" && f.who) { p.scope = "person"; p.assignee = f.who; }
    S.tasks = await call("kmr_tsk_list", { p });
  }
  const GUIDE = {
    mine: "Tasks given to you. Tap the circle when a task is done, or tap the task to open it, add a comment or change its status.",
    by_me: "Tasks you gave to other people. Open one to see how far it has come, or to change the due date or the person.",
    all: "Every task in the company, with who is doing it. Filter by person to see one person's work."
  };
  async function drawList() {
    const f = S.f, sc = S.scope, el = $("#list"), team = sc === "all";
    await loadTasks();
    const ppl = (S.people.people || []).map((p) => [p.email, p.name]);
    el.innerHTML = `<div class="guide">${GUIDE[sc]}</div>
      ${sc === "mine" ? `<div class="quick"><input id="qa" placeholder="Type a task and press Enter, e.g. Send quotation to Apex" maxlength="200"><button class="btn" id="qab">Add</button></div>` : ""}
      <div class="row"><input class="grow" id="fq" placeholder="Search tasks" value="${esc(f.q)}">
        <select id="fs" style="width:auto"><option value="active"${f.status === "active" ? " selected" : ""}>Open tasks</option><option value="done"${f.status === "done" ? " selected" : ""}>Finished</option><option value="all"${f.status === "all" ? " selected" : ""}>All</option></select>
        <select id="fp" style="width:auto"><option value="">Any priority</option>${opts(Object.entries(PR), f.priority)}</select>
        ${team ? `<select id="fw" style="width:auto"><option value="">Everyone</option>${opts(ppl, f.who)}</select>` : ""}</div>
      <div id="tl">${S.tasks.length ? S.tasks.map((t) => card(t, sc)).join("") : empty(sc)}</div>`;
    const re = debounce(async () => { f.q = V("fq"); await loadTasks(); $("#tl").innerHTML = S.tasks.length ? S.tasks.map((t) => card(t, sc)).join("") : empty(sc); }, 250);
    $("#fq").oninput = re;
    $("#fs").onchange = () => { f.status = V("fs"); drawList(); }; $("#fp").onchange = () => { f.priority = V("fp"); drawList(); };
    if ($("#fw")) $("#fw").onchange = () => { f.who = V("fw"); drawList(); };
    if ($("#qa")) { const add = () => quickAdd(); $("#qa").onkeydown = (e) => { if (e.key === "Enter") add(); }; $("#qab").onclick = add; }
    $("#tl").onclick = onListClick;
  }
  const debounce = (fn, ms) => { let h; return () => { clearTimeout(h); h = setTimeout(fn, ms); }; };
  function empty(sc) {
    const msg = S.f.q || S.f.priority || S.f.who ? "No task matches this search." : S.f.status === "done" ? "No finished tasks yet." :
      sc === "mine" ? "You have no open tasks. Type one above to add it to your list." : sc === "by_me" ? "You have not given a task to anyone yet. Tap <b>+ New task</b> and pick a person." : "No open tasks in the company.";
    return `<div class="empty">${msg}</div>`;
  }
  function card(t, sc) {
    const d = dueText(t), fin = t.status === "done" || t.status === "cancelled", who = sc === "mine" ? (t.assigned_by && t.assigned_by !== t.assignee ? "from " + first(t.assigned_by_name) : "") : "to " + first(t.assignee_name);
    const src = t.source_app ? `<span class="pillw">${esc(SRC[t.source_app] || t.source_app)}${t.source_label ? " · " + esc(t.source_label) : ""}</span>` : "";
    const cl = (t.checklist || []).length ? `<span>☑ ${t.checklist.filter((x) => x.d).length}/${t.checklist.length}</span>` : "";
    return `<div class="t ${esc(t.priority)}${fin ? " fin" : ""}" data-id="${esc(t.id)}"><button class="ck${t.status === "done" ? " on" : ""}" data-ck="${esc(t.id)}" aria-label="${t.status === "done" ? "Mark as not done" : "Mark as done"}">${t.status === "done" ? "✓" : ""}</button>
      <div class="tb"><div class="tt">${esc(t.title)}</div>
        <div class="tm"><span class="chip ${STC[t.status]}">${ST[t.status]}</span><span class="chip ${PRC[t.priority]}">${PR[t.priority]}</span><span class="${d.c}">${d.s}</span>${who ? `<span>${esc(who)}</span>` : ""}${cl}${t.comments ? `<span>💬 ${t.comments}</span>` : ""}${src}<span class="mut">${esc(t.no)}</span></div></div></div>`;
  }
  async function onListClick(e) {
    const ck = e.target.closest("[data-ck]");
    if (ck) { e.stopPropagation(); const t = S.tasks.find((x) => x.id === ck.dataset.ck); if (!t) return; try { await setStatus(t.id, t.status === "done" ? "open" : "done"); await drawList(); } catch (er) { say(er.message); } return; }
    const row = e.target.closest("[data-id]"); if (row) openTask(row.dataset.id);
  }
  async function quickAdd() {
    const v = V("qa").trim(); if (!v) return;
    try { await call("kmr_tsk_save", { p: { title: v, assignee: S.people.me.email } }); kick(); say("Task added.", true); await drawList(); const q = $("#qa"); if (q) q.focus(); refreshBell(); } catch (e) { say(e.message); }
  }
  async function setStatus(id, st, note) { await call("kmr_tsk_status", { p_id: id, p_status: st, p_note: note || null }); kick(); }

  /* ================= one task ================= */
  async function openTask(id) {
    try {
      const t = await call("kmr_tsk_get", { p_id: id, p: A() }); S.openId = id; drawTask(t);
    } catch (e) { say(e.message); }
  }
  function drawTask(t) {
    const d = dueText(t), me = S.people.me.email, src = t.source_app ? `<div class="note mut">From <b>${esc(SRC[t.source_app] || t.source_app)}</b>${t.source_label ? " · " + esc(t.source_label) : ""}${t.source_url ? ` · <a href="${esc(safeUrl(t.source_url))}">open it</a>` : ""}</div>` : "";
    const seg = Object.entries({ open: "To do", progress: "In progress", blocked: "Blocked", done: "Done" }).map(([k, v]) => `<button data-st="${k}" class="${t.status === k ? "on" : ""}">${v}</button>`).join("");
    open(`<div class="row"><b style="font-size:18px;flex:1;word-break:break-word">${esc(t.title)}</b><button class="btn o s" id="x">Close</button></div>
      <div class="tm" style="margin-bottom:8px"><span class="mut">${esc(t.no)}</span><span class="chip ${PRC[t.priority]}">${PR[t.priority]}</span><span class="${d.c}">${d.s}</span></div>
      <div class="kvs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 14px"><div><span class="lbl">Assigned to</span><b>${esc(t.assignee_name || "—")}${t.assignee === me ? " (you)" : ""}</b></div><div><span class="lbl">Given by</span><b>${esc(t.assigned_by_name || "—")}${t.assigned_by === me ? " (you)" : ""}</b></div>${t.tags ? `<div><span class="lbl">Tag</span><b>${esc(t.tags)}</b></div>` : ""}</div>
      ${t.detail ? `<p style="white-space:pre-wrap;margin:10px 0">${esc(t.detail)}</p>` : ""}${src}
      <div class="lbl" style="margin-top:10px">Status</div><div class="seg" id="seg">${seg}</div>
      ${(t.checklist || []).length ? `<div class="th"><div class="lbl">Checklist</div>${t.checklist.map((c, i) => `<label class="cl${c.d ? " d" : ""}"><input type="checkbox" data-ci="${i}"${c.d ? " checked" : ""}><span>${esc(c.t)}</span></label>`).join("")}</div>` : ""}
      <div class="th"><div class="lbl">Updates and comments</div><div id="thr">${(t.thread || []).map((c) => c.kind === "event" ? `<div class="cm ev">${esc(c.body)} · ${when(c.at)}</div>` : `<div class="cm"><b>${esc(first(c.name))}</b> <small>${when(c.at)}</small><br>${esc(c.body).replace(/\n/g, "<br>")}</div>`).join("") || '<div class="mut">Nothing yet.</div>'}</div>
        <div class="row" style="margin-top:8px"><input class="grow" id="cmt" placeholder="Write a comment"><button class="btn s" id="cmb">Send</button></div></div>
      <div class="row" style="margin-top:12px">${t.can_edit ? `<button class="btn o s" id="ed">Edit</button>` : ""}${t.can_edit && canAssign() ? `<button class="btn o s" id="ra">Give to someone else</button>` : ""}${t.can_delete ? `<button class="btn r s" id="del">Delete task</button>` : ""}</div>`);
    $("#x").onclick = closeM;
    $("#seg").onclick = async (e) => { const b = e.target.closest("[data-st]"); if (!b) return; try { const note = b.dataset.st === "blocked" ? prompt("What is blocking this task? (optional)") : null; await setStatus(t.id, b.dataset.st, note); await openTask(t.id); refreshList(); refreshBell(); } catch (er) { say(er.message); } };
    document.querySelectorAll("[data-ci]").forEach((c) => c.onchange = async () => { const l = t.checklist.map((x, i) => (i === +c.dataset.ci ? { t: x.t, d: c.checked } : x)); try { await call("kmr_tsk_check", { p_id: t.id, p_checklist: l }); t.checklist = l; c.closest(".cl").classList.toggle("d", c.checked); refreshList(); } catch (er) { say(er.message); c.checked = !c.checked; } });
    const send = async () => { const b = V("cmt").trim(); if (!b) return; try { await call("kmr_tsk_comment", { p_id: t.id, p_body: b }); kick(); await openTask(t.id); refreshList(); } catch (er) { say(er.message); } };
    $("#cmb").onclick = send; $("#cmt").onkeydown = (e) => { if (e.key === "Enter") send(); };
    if ($("#ed")) $("#ed").onclick = () => form(t);
    if ($("#ra")) $("#ra").onclick = () => reassign(t);
    if ($("#del")) $("#del").onclick = async () => { if (!confirm("Delete this task and its comments? This cannot be undone.")) return; try { await call("kmr_tsk_delete", { p_id: t.id }); closeM(); say("Task deleted.", true); refreshList(); } catch (er) { say(er.message); } };
  }
  const safeUrl = (u) => (/^(https?:)?\/\/|^\//.test(String(u || "")) ? u : "#");
  const when = (at) => { const d = new Date(at); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
  async function refreshList() { const g = hashParts().go; if (SECTIONS[g] === "list") { try { await drawList(); } catch (e) { /* ignore */ } } else if (g === "dash") { try { await drawDash(); } catch (e) { /* ignore */ } } }

  function reassign(t) {
    const ppl = (S.people.people || []).map((p) => [p.email, p.name]);
    open(`<h3 style="margin:0 0 10px">Give “${esc(t.title)}” to</h3><select id="ra_who">${opts(ppl, t.assignee)}</select><div class="row" style="margin-top:12px"><button class="btn" id="ra_ok">Give task</button><button class="btn o" id="ra_x">Cancel</button></div>`);
    $("#ra_x").onclick = () => openTask(t.id);
    $("#ra_ok").onclick = async () => { try { await call("kmr_tsk_reassign", { p_id: t.id, p_assignee: V("ra_who") }); kick(); await openTask(t.id); refreshList(); } catch (e) { say(e.message); } };
  }

  /* ================= create / edit ================= */
  function form(t, pre) {
    t = t || pre || {}; const me = S.people.me, ppl = (S.people.people || []).map((p) => [p.email, p.name]);
    if (!ppl.some((p) => p[0] === me.email)) ppl.unshift([me.email, me.name]);
    if (t.assignee && !ppl.some((p) => p[0] === t.assignee)) ppl.push([t.assignee, t.assignee_name || t.assignee]);
    const who = t.assignee || me.email;
    open(`<h3 style="margin:0 0 10px">${t.id ? "Edit task" : "New task"}</h3><div class="frm">
      <div class="w"><label>What has to be done?</label><input id="f_title" value="${esc(t.title || "")}" maxlength="200" placeholder="e.g. Send revised quotation to Apex Auto"></div>
      <div class="w"><label>Details (optional)</label><textarea id="f_detail" rows="3" placeholder="Anything the person needs to know">${esc(t.detail || "")}</textarea></div>
      ${canAssign() ? `<div><label>Give to</label><select id="f_who">${opts(ppl, who)}</select></div>` : `<div><label>Assigned to</label><input value="${esc(me.name)} (you)" disabled><input type="hidden" id="f_who" value="${esc(me.email)}"></div>`}
      <div><label>Priority</label><select id="f_pr">${opts(Object.entries(PR), t.priority || "normal")}</select></div>
      <div><label>Due date</label><input type="date" id="f_due" value="${esc(t.due || "")}"><div class="seg"><button type="button" data-d="0">Today</button><button type="button" data-d="1">Tomorrow</button><button type="button" data-d="7">Next week</button><button type="button" data-d="">No date</button></div></div>
      <div><label>Tag (optional)</label><input id="f_tags" value="${esc(t.tags || "")}" maxlength="40" placeholder="e.g. Quality, Customer, Safety"></div>
      <div class="w"><label>Checklist (optional, one step per line)</label><textarea id="f_cl" rows="3" placeholder="Step 1&#10;Step 2">${esc((t.checklist || []).map((c) => c.t).join("\n"))}</textarea></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="f_ok">${t.id ? "Save changes" : "Save task"}</button><button class="btn o" id="f_x">Cancel</button></div>`);
    $("#f_title").focus();
    document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { $("#f_due").value = b.dataset.d === "" ? "" : localDay(+b.dataset.d); });
    $("#f_x").onclick = () => (t.id ? openTask(t.id) : closeM());
    $("#f_ok").onclick = async () => {
      const old = t.checklist || [], lines = V("f_cl").split("\n").map((x) => x.trim()).filter(Boolean);
      const cl = lines.map((l) => { const o = old.find((c) => c.t === l); return { t: l, d: o ? !!o.d : false }; });
      const p = Object.assign({}, pre || {}, { id: t.id || undefined, title: V("f_title"), detail: V("f_detail"), assignee: V("f_who"), priority: V("f_pr"), due: V("f_due") || null, tags: V("f_tags"), checklist: cl });
      try { await call("kmr_tsk_save", { p }); kick(); closeM(); say(t.id ? "Task saved." : "Task created.", true); refreshList(); refreshBell(); } catch (e) { say(e.message); }
    };
  }
  $("#fab").onclick = () => { if (S.people) form(); };

  /* ================= dashboard ================= */
  async function drawDash() {
    const el = $("#dash"), team = canAssign() && S.dash === "team";
    const D = await call("kmr_tsk_dashboard", { p: A({ scope: team ? "team" : "mine" }) });
    const k = (n, label, c, go) => `<button class="kpi" style="--c:${c}" data-go="${go}"><b>${n}</b><span>${label}</span></button>`;
    const maxP = Math.max(1, ...D.by_person.map((p) => p.open + p.done)), maxT = Math.max(1, ...D.trend.map((x) => Math.max(x.created, x.done)));
    const pr = D.by_priority, prMax = Math.max(1, pr.urgent, pr.high, pr.normal, pr.low);
    el.innerHTML = `<div class="guide">A quick picture of the work: what is late, what is due soon and who is carrying how much.</div>
      ${canAssign() ? `<div class="seg"><button data-sc="mine" class="${team ? "" : "on"}">My work</button><button data-sc="team" class="${team ? "on" : ""}">Whole team</button></div>` : ""}
      <div class="kpis">${k(D.overdue, "Overdue", "var(--r)", "mine")}${k(D.due_today, "Due today", "var(--a)", "mine")}${k(D.due_week, "Due in 7 days", "var(--b1)", "mine")}${k(D.progress, "In progress", "var(--b2)", "mine")}${k(D.blocked, "Blocked", "var(--r)", "mine")}${k(D.done_week, "Done this week", "var(--g)", "mine")}</div>
      <div class="two"><div class="card"><h3>${team ? "Workload by person" : "My open tasks"}</h3><div class="bars">${team ? (D.by_person.map((p) => `<div class="bl" data-who="${esc(p.email)}"><span>${esc(first(p.name))}</span><div style="display:flex;gap:2px"><i style="width:${Math.max(3, (p.open / maxP) * 100)}%"></i>${p.overdue ? `<i class="r" style="width:${Math.max(3, (p.overdue / maxP) * 100)}%"></i>` : ""}</div><b>${p.open}${p.overdue ? ` <span class="late">(${p.overdue} late)</span>` : ""}</b></div>`).join("") || '<div class="mut">No tasks yet.</div>') : `<div class="bl"><span>To do</span><div><i style="width:${(D.open / Math.max(1, D.open + D.progress + D.blocked)) * 100}%"></i></div><b>${D.open}</b></div><div class="bl"><span>In progress</span><div><i style="width:${(D.progress / Math.max(1, D.open + D.progress + D.blocked)) * 100}%"></i></div><b>${D.progress}</b></div><div class="bl"><span>Blocked</span><div><i class="r" style="width:${(D.blocked / Math.max(1, D.open + D.progress + D.blocked)) * 100}%"></i></div><b>${D.blocked}</b></div>`}</div></div>
        <div class="card"><h3>Open tasks by priority</h3><div class="bars">${["urgent", "high", "normal", "low"].map((x) => `<div class="bl"><span>${PR[x]}</span><div><i class="${x === "urgent" ? "r" : ""}" style="width:${Math.max(pr[x] ? 3 : 0, (pr[x] / prMax) * 100)}%"></i></div><b>${pr[x]}</b></div>`).join("")}</div></div>
        <div class="card"><h3>Where tasks come from</h3><div class="bars">${D.by_source.map((s) => `<div class="bl"><span>${esc(SRC[s.app] || s.app)}</span><div><i style="width:${(s.n / Math.max(1, ...D.by_source.map((x) => x.n))) * 100}%"></i></div><b>${s.n}</b></div>`).join("") || '<div class="mut">No open tasks.</div>'}</div></div>
        <div class="card"><h3>Last 14 days — created and finished</h3><div class="trend">${D.trend.map((x) => `<div title="${esc(x.d)}: ${x.created} created, ${x.done} done"><i style="height:${(x.created / maxT) * 70}px"></i><i class="d" style="height:${(x.done / maxT) * 70}px"></i><small>${x.d.slice(8)}</small></div>`).join("")}</div><div class="note mut"><span style="color:var(--b1)">■</span> created &nbsp; <span style="color:var(--g)">■</span> done</div></div></div>
      ${D.late.length ? `<div class="card"><h3>Overdue tasks</h3>${D.late.map((t) => card(t, team ? "all" : "mine")).join("")}</div>` : '<div class="empty">Nothing is overdue. 🎉</div>'}`;
    el.onclick = async (e) => {
      const sc = e.target.closest("[data-sc]"); if (sc) { S.dash = sc.dataset.sc; drawDash(); return; }
      const kp = e.target.closest(".kpi"); if (kp) { location.hash = "#go=" + (team ? "all" : "mine"); return; }
      const w = e.target.closest("[data-who]"); if (w) { S.f.who = w.dataset.who; location.hash = "#go=all"; return; }
      const row = e.target.closest("[data-id]"); if (row) { S.tasks = D.late; openTask(row.dataset.id); }
    };
  }

  /* ================= alerts: bell list and phone / desktop settings ================= */
  async function refreshBell() {
    try {
      const N = await call("kmr_tsk_notes", { p: { limit: 30 } }); S.notes = N; const b = $("#bn");
      b.textContent = N.unread > 99 ? "99+" : N.unread || ""; b.hidden = !N.unread;
      document.title = (N.unread ? "(" + N.unread + ") " : "") + "ActionTrack · KMR Apps";
      if (S.seen >= 0 && N.unread > S.seen && !document.hidden) { const n = N.items.find((x) => !x.read); if (n) say("🔔 " + n.title, true); }
      S.seen = N.unread; if (hashParts().go === "alerts") drawNotes();
    } catch (e) { /* the bell is only a convenience */ }
  }
  $("#bell").onclick = () => { location.hash = "#go=alerts"; };
  function drawNotes() {
    const el = $("#nlist"); if (!el) return; const N = S.notes;
    el.innerHTML = N.items.length ? N.items.map((n) => `<div class="nt${n.read ? "" : " un"}" data-n="${esc(n.id)}" data-t="${esc(n.task_id || "")}"><div style="flex:1"><b>${esc(n.title)}</b><span>${esc(n.body || "")}</span><br><small>${when(n.at)}</small></div></div>`).join("") : '<div class="empty">No alerts yet. You will see new tasks, comments, due and overdue reminders here.</div>';
    el.onclick = async (e) => { const r = e.target.closest("[data-n]"); if (!r) return; try { await call("kmr_tsk_notes_read", { p: { ids: [r.dataset.n] } }); } catch (er) { /* ignore */ } if (r.dataset.t) openTask(r.dataset.t); refreshBell(); };
  }
  const pushOk = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  async function pushState() {
    if (QP.DEMO) return { s: "demo" };
    if (!pushOk()) return { s: isIos() && !standalone() ? "ios" : "none" };
    if (Notification.permission === "denied") return { s: "denied" };
    try { const reg = await navigator.serviceWorker.getRegistration("/it/"); const sub = reg && (await reg.pushManager.getSubscription()); if (sub && Notification.permission === "granted") return { s: "on", sub }; } catch (e) { /* ignore */ }
    return { s: "off" };
  }
  async function drawAlerts() {
    const el = $("#alerts"), ps = await pushState();
    const msg = {
      demo: "Alerts on phones and computers work in your own company workspace. This sample only shows the bell.",
      ios: "On iPhone and iPad, first tap <b>Share</b> → <b>Add to Home Screen</b>, open ActionTrack from the new icon, then come back here to turn alerts on.",
      none: "This browser cannot receive alerts when the page is closed. The bell above still shows new tasks while ActionTrack is open. Try Chrome, Edge, Firefox or Safari (iPhone: add to Home Screen first).",
      denied: "Alerts are blocked for this site in your browser settings. Allow notifications for this site, then reload this page.",
      off: "Alerts are off on this device. Turn them on to get a message on this phone, tablet or computer when a task is given to you or is due — even when ActionTrack is closed.",
      on: "Alerts are <b>on</b> for this device. You get a message when a task is given to you, someone comments, and when a task is due or overdue."
    }[ps.s];
    el.innerHTML = `<div class="guide">The bell lists what changed. Phone and computer alerts reach you even when ActionTrack is closed.</div>
      <div class="card"><h3>Alerts on this device</h3><p style="margin:0 0 10px">${msg}</p>
        <div class="row">${ps.s === "off" ? `<button class="btn" id="pon">Turn on alerts</button>` : ""}${ps.s === "on" ? `<button class="btn o" id="ptest">Show a test alert</button><button class="btn o" id="poff">Turn off on this device</button>` : ""}</div>
        <div class="note">Android, Windows, Mac and Linux: works in Chrome, Edge and Firefox. iPhone / iPad: works from the Home Screen icon (iOS 16.4 or later).</div></div>
      <div class="row"><b style="flex:1;font-size:16px">Recent alerts</b><button class="btn o s" id="mall">Mark all as read</button></div><div id="nlist"></div>`;
    drawNotes();
    $("#mall").onclick = async () => { try { await call("kmr_tsk_notes_read", { p: {} }); refreshBell(); } catch (e) { say(e.message); } };
    if ($("#pon")) $("#pon").onclick = enablePush;
    if ($("#poff")) $("#poff").onclick = disablePush;
    if ($("#ptest")) $("#ptest").onclick = async () => { const reg = await navigator.serviceWorker.getRegistration("/it/"); if (reg) reg.showNotification("ActionTrack", { body: "This is how your alerts will look.", icon: "/it/tasks-icon.svg", data: { url: location.href } }); };
  }
  const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
  async function enablePush() {
    try {
      const perm = await Notification.requestPermission(); if (perm !== "granted") throw new Error("Alerts were not allowed. Allow notifications for this site and try again.");
      const kr = await fetch("/it/console/api/tsk/key"); const kj = kr.ok ? await kr.json() : {}; if (!kj.key) throw new Error("Phone alerts are not switched on for the platform yet. Please contact KMR Group of Companies.");
      const reg = await navigator.serviceWorker.register("/it/tsk-sw.js", { scope: "/it/" }); await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(kj.key) });
      const j = sub.toJSON(); await call("kmr_tsk_push_subscribe", { p: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent } });
      say("Alerts are on for this device.", true); drawAlerts();
    } catch (e) { say(e.message); }
  }
  async function disablePush() {
    try { const reg = await navigator.serviceWorker.getRegistration("/it/"); const sub = reg && (await reg.pushManager.getSubscription()); if (sub) { await call("kmr_tsk_push_unsubscribe", { p: { endpoint: sub.endpoint } }); await sub.unsubscribe(); } say("Alerts are off on this device.", true); drawAlerts(); } catch (e) { say(e.message); }
  }
  /* after a change, ask the server to send the phone alerts straight away (it also sends them on a schedule) */
  async function kick() {
    if (QP.DEMO || !QP.sb) return;
    try { const { data: { session } } = await QP.sb.auth.getSession(); if (!session) return; fetch("/it/console/api/tsk/push", { method: "POST", headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" }, body: "{}", keepalive: true }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  (async () => {
    try {
      await QP.init("tsk"); if (!QP.ctx) return;
      try { S.people = await call("kmr_tsk_people"); } catch (e) { say(e.message); return; }
      $("#fab").textContent = "+ New task";
      await route(); refreshBell(); setInterval(() => { if (!document.hidden) refreshBell(); }, 45000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshBell(); });
      if (!QP.DEMO && pushOk() && Notification.permission === "granted") navigator.serviceWorker.register("/it/tsk-sw.js", { scope: "/it/" }).catch(() => {});
    } catch (e) { say(e.message); }
  })();
  window.KMRTaskApp = { open: openTask, form };
})();
