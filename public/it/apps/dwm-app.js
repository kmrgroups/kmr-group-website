/* Daily Work Management (DWM) — one empty, editable sheet per employee, and a Dashboards screen that adds them all up.
   • choose the frequency of a review and the days are planned automatically: Daily (all days except the weekly-off days), Weekly (the chosen weekdays), Specific dates
   • click a day to mark it Plan O · Completed C · Missed X · Concession E · Off –
   • adherence = completed ÷ planned (a concession stays in the plan and does not count as completed); target 98% unless changed
   Saved per company in the database (kmr_dwm_*); on this device only until the database update 0091 + 0092 is applied. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const D = window.DWM, DEMO = QP.DEMO, OFF = D.OFF;
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const monthName = (m) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const prevMonth = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const say = (m, ok) => { const el = $("#msg"); el.innerHTML = m ? `<div class="msg${ok === "w" ? " w" : ok ? " ok" : ""}">${esc(m)}</div>` : ""; if (m && ok === true) setTimeout(() => { if (el.textContent === m) el.innerHTML = ""; }, 3500); };
  /* ActionTrack: "make this a task" — shown only when the company has ActionTrack and the person can use it (same as MoM, MSA, SPC) */
  let taskPool = [];
  const canTask = () => !!(window.KMRTask && KMRTask.on) && canEdit;
  const dmy = (d) => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const addD = (n) => new Date(Date.now() + 330 * 60000 + n * 864e5).toISOString().slice(0, 10);
  const taskBtn = (o) => (canTask() ? `<button class="btn o s noprint" data-task="${taskPool.push(Object.assign({ source_app: "dwm", source_label: "DWM adherence", source_url: `/it/dwm.html?kmr=1&co=${encodeURIComponent(QP.slug || "")}#go=dash` }, o)) - 1}">→ Task</button>` : "");
  const fix1 = (v) => (v == null ? "—" : v.toFixed(1) + "%");

  let M = today().slice(0, 7), emps = [], empId = "", doc = null, canEdit = false, ctx = null, local = DEMO, view = "std", sel = null, adding = false, staffLoaded = false, deptF = "";
  const pend = {}; let saveT = null;
  const sheetKey = (id = empId, m = M) => "dwm:" + m + ":" + id;
  const curEmp = () => emps.find((e) => e.id === empId) || null;

  /* ================= storage ================= */
  const lk = (k) => "kmr_dwm_" + (DEMO ? "demo_" : (QP.slug || "") + "_") + k;
  const missing = (e) => /does not exist|could not find|schema cache|function|violates check|doc_key/i.test(e.message);
  async function getDoc(key) {
    if (!local) { try { return (await QP.call("kmr_dwm_get", { p_key: key })) || null; } catch (e) { if (missing(e)) local = true; else throw e; } }
    try { return JSON.parse(localStorage.getItem(lk(key)) || "null"); } catch (e) { return null; }
  }
  async function putDoc(key, value) {
    if (!local) { try { await QP.call("kmr_dwm_save", { p_key: key, p_doc: value }); return; } catch (e) { if (missing(e)) local = true; else throw e; } }
    try { localStorage.setItem(lk(key), JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  async function getMonthDocs(m) {
    const out = {};
    if (!local) { try { (await QP.call("kmr_dwm_month", { p_month: m }) || []).forEach((r) => { out[r.key.split(":")[2]] = r.doc; }); return out; } catch (e) { if (missing(e)) local = true; else throw e; } }
    const pre = lk("dwm:" + m + ":"); for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre)) { try { out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* ignore */ } } }
    return out;
  }
  async function delEmpDocs(id) {
    if (!local) { try { await QP.call("kmr_dwm_delete", { p_emp: id }); return; } catch (e) { if (missing(e)) local = true; else throw e; } }
    const suf = ":" + id, pre = lk("dwm:"); for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(pre) && k.endsWith(suf)) localStorage.removeItem(k); }
  }
  function saved(state) {
    const b = $("#svst"); if (!b) return;
    b.textContent = state === "saving" ? "Saving…" : state === "err" ? "Not saved" : local && !DEMO ? "Saved on this device only (database update pending)" : DEMO ? "Sample — saved in this browser" : "Saved ✓";
    b.style.color = state === "err" ? "var(--r)" : "var(--mut)";
  }
  function queue(key, value) {
    pend[key] = value; saved("saving"); clearTimeout(saveT); saveT = setTimeout(flush, 500);
  }
  async function flush() {
    clearTimeout(saveT); const keys = Object.keys(pend);
    try { for (const k of keys) { const v = pend[k]; delete pend[k]; await putDoc(k, v); } saved("ok"); } catch (e) { saved("err"); say(e.message); }
  }
  const qSheet = () => queue(sheetKey(), doc), qStaff = () => queue("staff", { emps });
  window.addEventListener("beforeunload", () => { try { Object.keys(pend).forEach((k) => localStorage.setItem(lk(k), JSON.stringify(pend[k]))); } catch (e) { /* ignore */ } });

  async function loadStaff() {
    if (staffLoaded) return; const s = await getDoc("staff"); emps = (s && s.emps) || []; staffLoaded = true;
    if (!empId) { try { empId = localStorage.getItem(lk("last")) || ""; } catch (e) { empId = ""; } }
    if (!emps.some((e) => e.id === empId)) empId = emps[0] ? emps[0].id : "";
  }
  function normalise(d) {
    d = Object.assign(D.emptyDoc(), d || {}); d.acts = d.acts || []; d.log = d.log || {}; d.off = d.off || [0]; d.acts.forEach((a) => { a.id = a.id || D.newId(); a.wd = a.wd || []; a.dates = a.dates || []; a.cells = a.cells || OFF.repeat(31); });
    return d;
  }
  async function loadSheet() { doc = empId ? normalise(await getDoc(sheetKey())) : null; }

  /* ================= the employee's sheet ================= */
  const W = { a: 40, b: 330, c: 150, d: 230, e: 90, day: 32, ad: 63, x: 30 };
  function fqHtml(a, i, ro) {
    const n = D.dim(M), un = !a.mode;
    let h = `<select class="fq${un ? " un" : ""}" data-fq="${i}"${ro}><option value="" ${un ? "selected" : ""} disabled hidden>Select frequency…</option>` + [["daily", "Daily"], ["weekly", "Weekly"], ["dates", "Specific dates"]].map(([k, t]) => `<option value="${k}" ${a.mode === k ? "selected" : ""}>${t}</option>`).join("") + "</select>";
    if (a.mode === "weekly") h += `<div class="wds">` + D.WD_ORDER.map((w) => `<button type="button" data-wd="${i}:${w}" class="${a.wd.includes(w) ? "on" : ""}" title="${D.WD[w]}"${ro}>${D.WD[w].slice(0, 2)}</button>`).join("") + `</div>` + (a.wd.length ? "" : `<div style="color:#9c0006;font-size:9px">Choose the day(s)</div>`);
    if (a.mode === "dates") h += `<input class="dts" data-dt="${i}" placeholder="Dates, e.g. 5, 12, 19 (1–${n})" value="${esc(a.dates.join(", "))}"${ro}>` + (a.dates.length ? "" : `<div style="color:#9c0006;font-size:9px">Type the dates or click the day cells</div>`);
    return h;
  }
  function sheetHtml() {
    const e = curEmp(), n = D.dim(M), c = D.calc(doc, M, today()), T = c.total, tgt = +doc.target || 98, td = today(), dayNo = td.slice(0, 7) === M ? +td.slice(8) : 0;
    const ro = canEdit ? "" : " disabled", cg = (w, k) => `<col style="width:${w}px">`.repeat(k);
    const col = "<colgroup>" + cg(W.a, 1) + cg(W.b, 1) + cg(W.c, 1) + cg(W.d, 1) + cg(W.e, 1) + cg(W.day, 31) + cg(W.ad, 3) + cg(W.x, 1) + "</colgroup>";
    const vw = 'style="position:sticky;left:0;width:var(--vw,900px)"';
    const title = "DAILY WORK MANAGEMENT" + (e.desig ? " – " + e.desig.toUpperCase() : "") + " (ACHIEVE " + tgt + "%)";
    let h = `<div class="emp noprint"><label>Employee <select id="emp" class="sel">${emps.map((x) => `<option value="${x.id}" ${x.id === empId ? "selected" : ""}>${esc(x.name || "(no name)")}${x.desig ? " · " + esc(x.desig) : ""}</option>`).join("")}</select></label>
      ${canEdit ? `<button class="btn o s" id="emp_add">＋ Add employee</button><button class="btn o s" id="emp_del">Remove employee</button>` : ""}
      <span style="width:12px"></span><button class="btn o s" id="pv">‹</button><input type="month" id="mon" class="sel" value="${M}"><button class="btn o s" id="nx">›</button>
      <span class="wdoff">Weekly off:</span>${D.WD_ORDER.map((w) => `<label class="wdoff"><input type="checkbox" data-off="${w}" ${doc.off.includes(w) ? "checked" : ""}${ro}> ${D.WD[w]}</label>`).join("")}
      <label class="wdoff">Target <input type="number" id="tgt" min="1" max="100" value="${tgt}" style="width:58px"${ro}> %</label>
      <span id="svst" class="mut" style="font-size:12px"></span><span style="flex:1"></span><button class="btn s" id="prt">⎙ Print / PDF</button></div>
      <p class="note noprint" style="margin:0 0 8px"><b>How it works:</b> add a review, choose its frequency and the days are planned automatically — <b>Daily</b> = every day except the weekly-off days, <b>Weekly</b> = the days you tick, <b>Specific dates</b> = the dates you type. Click a day to mark it <b>C</b> completed, <b>X</b> missed or <b>E</b> concession (or type the letter). Everything saves as you type.</p>
      <div class="xl no-sno" data-nofilter><div class="xs" id="xs"><table>${col}<tbody>`;
    h += `<tr class="t1"><td colspan="40"><div style="position:sticky;left:0;width:var(--vw,900px);height:76px;line-height:76px;text-align:center"><span id="xlogo" style="position:absolute;left:0;top:0;line-height:0"></span><span id="xtitle">${esc(title)}</span></div></td></tr>`;
    h += `<tr class="t2"><td colspan="2" class="fa" style="left:0">Name: <input class="cell" id="f_name" style="width:70%;display:inline-block" value="${esc(e.name)}" placeholder="[enter name]"${ro}></td><td colspan="3">Department: <input class="cell" id="f_dept" style="width:38%;display:inline-block" value="${esc(e.dept)}" placeholder="[department]"${ro}> Designation: <input class="cell" id="f_des" style="width:30%;display:inline-block" value="${esc(e.desig)}" placeholder="[designation]"${ro}></td><td colspan="8">Period: ${monthName(M)}</td><td colspan="9">O = Plan &nbsp; C = Completed</td><td colspan="10">X = Missed &nbsp; E = Concession</td><td colspan="8">– = Off / not scheduled</td></tr>`;
    h += `<tr class="t3"><th class="fa" rowspan="2">Sl #</th><th class="fb" rowspan="2">Activity</th><th rowspan="2">Responsibility</th><th rowspan="2">Frequency</th><th rowspan="2">Duration</th>` + Array.from({ length: 31 }, (_, i) => `<th class="c${i + 1 === dayNo ? " cur" : ""}">${i + 1}</th>`).join("") + `<th colspan="3">Adherence</th><th rowspan="2" class="noprint"></th></tr>`;
    h += `<tr class="t4">` + Array.from({ length: 31 }, (_, i) => `<th>${i + 1 <= n ? D.WD[D.dow(M, i + 1)] : OFF}</th>`).join("") + `<th>Plan</th><th>Actual</th><th>%</th></tr>`;
    h += `<tr class="band"><td colspan="40"><div ${vw}><input class="cell w" id="f_sec" style="width:70%" value="${esc(doc.section)}" placeholder="Type the heading of these reviews (e.g. Business leadership and management commitments)"${ro}></div></td></tr>`;
    c.rows.forEach((r, i) => {
      const a = r.a;
      h += `<tr class="ar"><td class="fa c">${i + 1}</td><td class="fb wrap"><input class="cell" data-ac="${i}" data-f="activity" value="${esc(a.activity)}" placeholder="Type the review / activity"${ro}></td><td><input class="cell" data-ac="${i}" data-f="resp" value="${esc(a.resp)}" placeholder="${esc(e.desig || "Responsibility")}"${ro}></td><td>${fqHtml(a, i, ro)}</td><td><input class="cell" data-ac="${i}" data-f="dur" value="${esc(a.dur)}" placeholder="e.g. 30 min"${ro}></td>`;
      for (let d = 1; d <= 31; d++) {
        const v = d > n ? OFF : D.cell(a, d), k = v === OFF ? "N" : v, od = v === "O" && d < c.dayNo && dayNo ? " od" : "";
        h += `<td class="d ${k}${d === dayNo ? " cur" : ""}${od}${!canEdit || d > n ? " ro" : ""}" data-i="${i}" data-d="${d}"${od ? ' title="Date has passed — update to C (done), X (missed) or E (concession)"' : ""}>${v}</td>`;
      }
      h += `<td class="c">${r.plan}</td><td class="c">${r.done}</td><td class="c">${r.plan ? (r.pct * 100).toFixed(1) + "%" : ""}</td><td class="dl noprint">${canEdit ? `<button data-rm="${i}" title="Delete this activity">✕</button>` : ""}</td></tr>`;
    });
    if (canEdit) h += `<tr class="noprint"><td colspan="40" class="add"><div ${vw}><button id="addact">＋ Add activity</button> <span class="mut" style="font-size:11px">${c.rows.length ? "" : "No activities yet. "}${!c.rows.length && prevHas ? '<button id="cp_prev" style="font-weight:400;text-decoration:underline">Copy the activities of ' + monthName(prevMonth(M)) + "</button>" : ""}</span></div></td></tr>`;
    const dayRow = (label, f, last) => `<tr class="tot"><td class="l" colspan="5" style="text-align:left">${label}</td>` + Array.from({ length: 31 }, (_, i) => `<td>${f(c.perDay[i], i)}</td>`).join("") + last + `<td class="noprint"></td></tr>`;
    h += `<tr class="tot"><td colspan="40" style="height:16px;background:#fff"></td></tr>`;
    h += dayRow("No. of activities planned / day", (x) => x.plan, `<td>${T.plan}</td><td>${T.done}</td><td>${T.plan ? (T.pct * 100).toFixed(1) + "%" : ""}</td>`);
    h += dayRow("No. of activities completed / day", (x) => x.done, `<td colspan="3">Full-month adherence</td>`);
    h += dayRow("Adherence %", (x) => (x.plan ? (x.pct * 100).toFixed(1) + "%" : ""), `<td colspan="3">Target ≥${tgt}%</td>`);
    h += `<tr class="sgn"><td colspan="40"><div ${vw}><span style="display:inline-block;width:24%">Prepared by: <b style="font-weight:400">${esc(e.name)}</b></span><span style="display:inline-block;width:24%">Reviewed by: <input class="cell" id="f_rev" style="width:55%;display:inline-block" value="${esc(doc.reviewed)}" placeholder="[name]"${ro}></span><span style="display:inline-block;width:24%">Approved by: <input class="cell" id="f_apr" style="width:55%;display:inline-block" value="${esc(doc.approved)}" placeholder="[name]"${ro}></span><span style="display:inline-block;width:24%">Date: <input class="cell" id="f_date" style="width:60%;display:inline-block" value="${esc(doc.date || "")}" placeholder="__________________"${ro}></span></div></td></tr>`;
    h += `</tbody></table></div></div>` + logHtml(c);
    return h;
  }
  let prevHas = false;
  function logHtml(c) {
    taskPool = []; const items = []; doc.acts.forEach((a) => { for (let d = 1; d <= c.n; d++) { const v = D.cell(a, d); if (v === "X" || v === "E") items.push({ a, d, v }); } });
    if (!items.length) return `<div class="log noprint no-sno" data-nofilter id="logbox"><p class="note">Missed (X) and concession (E) reviews are listed here with their reason, approver, revised due date and action reference.</p></div>`;
    return `<div class="log noprint no-sno" data-nofilter id="logbox"><h3 style="margin:14px 0 4px;font-size:14px">Missed and concession record</h3><p class="note">Record the reason for every X, and for every E the approver, revised due date and the action reference in the plant action log. Do not erase a planned entry to hide a miss.</p>
      <table><thead><tr><th>Date</th><th>Activity</th><th>Status</th><th>Reason</th><th>Approver (for E)</th><th>Revised due date</th><th>Action reference</th><th></th></tr></thead><tbody>${items.map(({ a, d, v }) => { const k = a.id + ":" + d, L = doc.log[k] || {}, dis = canEdit ? "" : " disabled", em = curEmp() || {};
        return `<tr><td>${pad(d)}-${M.slice(5)}-${M.slice(0, 4)}</td><td>${esc(a.activity || "(no name)")}</td><td><span class="chip ${v === "X" ? "r" : "a"}">${v === "X" ? "Missed" : "Concession"}</span></td>
          <td><input data-lg="${esc(k)}" data-f="reason" value="${esc(L.reason || "")}"${dis}></td><td><input data-lg="${esc(k)}" data-f="approver" value="${esc(L.approver || "")}"${v === "E" ? "" : " disabled"}${dis}></td>
          <td><input type="date" data-lg="${esc(k)}" data-f="due" value="${esc(L.due || "")}"${dis}></td><td><input data-lg="${esc(k)}" data-f="ref" value="${esc(L.ref || "")}"${dis}></td><td>${taskBtn({ title: (v === "X" ? "Missed review: " : "Concession review: ") + (a.activity || "(no name)") + " on " + pad(d) + "-" + M.slice(5) + "-" + M.slice(0, 4), detail: "DWM of " + (em.name || "") + ". Reason: " + (L.reason || "not recorded"), who: em.name || "", due: L.due || addD(3), priority: v === "X" ? "high" : "normal", source_ref: empId + ":" + a.id + ":" + M + "-" + pad(d) })}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  const addForm = () => `<div class="emp noprint" id="addbox" style="background:#f1f7fb;border:1px solid var(--line);border-radius:10px;padding:10px"><b>New employee</b><input id="ne_name" placeholder="Name *"><input id="ne_des" placeholder="Designation (e.g. Plant Head)"><input id="ne_dep" placeholder="Department"><button class="btn s" id="ne_ok">Add</button>${emps.length ? '<button class="btn o s" id="ne_no">Cancel</button>' : ""}</div>`;
  async function drawSheet() {
    if (!canEdit && !emps.length) { $("#sheet").innerHTML = `<p class="mut">No employee has a DWM yet. An editor adds the employees here.</p>`; return; }
    if (!emps.length) { $("#sheet").innerHTML = `<h3 style="margin:4px 0">Daily Work Management</h3><p class="mut">Add the first employee — each employee gets an empty monthly DWM sheet of their own.</p>` + addForm(); return; }
    const keep = $("#xs"), sx = keep ? keep.scrollLeft : 0, sy = keep ? keep.scrollTop : 0, wy = window.scrollY;
    prevHas = false; if (canEdit && !doc.acts.length) { try { const p = await getDoc(sheetKey(empId, prevMonth(M))); prevHas = !!(p && p.acts && p.acts.length); } catch (e) { prevHas = false; } }
    $("#sheet").innerHTML = (adding ? addForm() : "") + sheetHtml(); const x = $("#xs"); if (x) { x.scrollLeft = sx; x.scrollTop = sy; } window.scrollTo(0, wy); saved(Object.keys(pend).length ? "saving" : "ok"); paintLogo(); fitVw();
    if (sel) { const t = cellEl(sel.i, sel.d); if (t) t.classList.add("sel"); }
  }
  const cellEl = (i, d) => $(`.xl td.d[data-i="${i}"][data-d="${d}"]`);
  function fitVw() { $$(".xs").forEach((e) => e.style.setProperty("--vw", Math.max(600, e.clientWidth - 24) + "px")); }
  window.addEventListener("resize", fitVw);
  function paintLogo() {
    const el = $("#xlogo"), src = (window.KMRReport && KMRReport.logoSrc && KMRReport.logoSrc()) || ((document.querySelector("#clogo img") || {}).src || "");
    if (el && src) el.innerHTML = `<img src="${esc(src)}" alt="" style="max-height:68px;max-width:190px;object-fit:contain;padding:4px">`;
  }
  setTimeout(paintLogo, 1500);

  /* ---------- marking a day ---------- */
  const pop = $("#pop");
  const LIST = [["O", "Plan"], ["C", "Completed"], ["X", "Missed"], ["E", "Concession"], [OFF, "Off / not scheduled"]];
  function openMenu(t) { const r = t.getBoundingClientRect(); pop.innerHTML = LIST.map(([k, n]) => `<div data-set="${k}"><b>${k}</b>${n}</div>`).join(""); pop.style.left = Math.min(r.left, innerWidth - 190) + "px"; pop.style.top = Math.min(r.bottom + 2, innerHeight - 160) + "px"; pop.classList.add("on"); }
  const closeMenu = () => pop.classList.remove("on");
  function setCell(i, d, v) {
    if (!canEdit) return; const a = doc.acts[i], n = D.dim(M); if (d > n) return;
    const cur = D.cell(a, d); if (cur === v) return;
    if (v === OFF && D.isPlan(cur) && !confirm("Do not erase a planned entry to hide a miss — use X for a missed review.\n\nRemove this planned review from the calendar anyway?")) return;
    if (v === "C" && M + "-" + pad(d) > today() && !confirm("This date is in the future. Mark the review as completed anyway?")) return;
    const arr = Array.from(a.cells || OFF.repeat(31)); while (arr.length < 31) arr.push(OFF); arr[d - 1] = v; a.cells = arr.join("");
    if (a.mode === "dates") a.dates = arr.map((c, k) => (k < n && D.isPlan(c) ? k + 1 : 0)).filter(Boolean);
    qSheet(); sel = { i, d }; drawSheet();
    if (v === "E" || v === "X") { say(v === "E" ? "Concession: record the reason, approver, revised due date and action reference below the sheet." : "Missed: record the reason below the sheet.", "w"); const lb = $("#logbox"); if (lb) lb.scrollIntoView({ block: "nearest" }); } else say("");
  }
  document.addEventListener("click", (e) => {
    const t = e.target, dc = t.closest && t.closest(".xl td.d");
    if (dc && view === "sheet") { const i = +dc.dataset.i, d = +dc.dataset.d; $$(".xl td.d.sel").forEach((x) => x.classList.remove("sel")); dc.classList.add("sel"); sel = { i, d }; if (canEdit && d <= D.dim(M)) openMenu(dc); return; }
    const s = t.closest && t.closest("[data-set]"); if (s && sel) { closeMenu(); setCell(sel.i, sel.d, s.dataset.set); return; }
    if (!(t.closest && t.closest("#pop"))) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (view !== "sheet" || !sel || !doc || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "")) return;
    const k = e.key, n = D.dim(M);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) { e.preventDefault(); closeMenu(); let { i, d } = sel; if (k === "ArrowLeft") d = Math.max(1, d - 1); if (k === "ArrowRight") d = Math.min(31, d + 1); if (k === "ArrowUp") i = Math.max(0, i - 1); if (k === "ArrowDown") i = Math.min(doc.acts.length - 1, i + 1); $$(".xl td.d.sel").forEach((x) => x.classList.remove("sel")); sel = { i, d }; const t = cellEl(i, d); if (t) { t.classList.add("sel"); t.scrollIntoView({ block: "nearest", inline: "nearest" }); } return; }
    const m = { o: "O", c: "C", x: "X", e: "E", "-": OFF, "–": OFF }[k.length === 1 ? k.toLowerCase() : ""]; if (m && canEdit && sel.d <= n) { e.preventDefault(); setCell(sel.i, sel.d, m); }
    if (k === "Escape") closeMenu();
  });

  /* ---------- typing in the sheet ---------- */
  const replan = (a) => { D.applyPlan(a, M, doc.off); };
  document.addEventListener("input", (e) => {
    const t = e.target; if (!doc && !t.id) return;
    if (t.id === "f_name") { const x = curEmp(); x.name = t.value; qStaff(); const o = $("#emp option:checked"); if (o) o.textContent = (t.value || "(no name)") + (x.desig ? " · " + x.desig : ""); }
    else if (t.id === "f_dept") { curEmp().dept = t.value; qStaff(); }
    else if (t.id === "f_des") { const x = curEmp(); x.desig = t.value; qStaff(); const tt = $("#xtitle"); if (tt) tt.textContent = "DAILY WORK MANAGEMENT" + (t.value ? " – " + t.value.toUpperCase() : "") + " (ACHIEVE " + (+doc.target || 98) + "%)"; }
    else if (t.id === "f_sec") { doc.section = t.value; qSheet(); } else if (t.id === "f_rev") { doc.reviewed = t.value; qSheet(); } else if (t.id === "f_apr") { doc.approved = t.value; qSheet(); } else if (t.id === "f_date") { doc.date = t.value; qSheet(); }
    else if (t.dataset && t.dataset.ac !== undefined) { doc.acts[+t.dataset.ac][t.dataset.f] = t.value; qSheet(); }
    else if (t.dataset && t.dataset.lg) { (doc.log[t.dataset.lg] ||= {})[t.dataset.f] = t.value; qSheet(); }
  });
  document.addEventListener("change", async (e) => {
    const t = e.target;
    try {
      if (t.id === "mon" && t.value) { M = t.value; sel = null; await go(view); }
      else if (t.id === "emp") { await flush(); empId = t.value; try { localStorage.setItem(lk("last"), empId); } catch (x) { /* ignore */ } sel = null; await go("sheet"); }
      else if (t.id === "dept_f") { deptF = t.value; await drawDash(); }
      else if (t.id === "tgt") { doc.target = Math.max(1, Math.min(100, +t.value || 98)); qSheet(); drawSheet(); }
      else if (t.dataset && t.dataset.off !== undefined) { const w = +t.dataset.off; doc.off = t.checked ? [...new Set([...doc.off, w])] : doc.off.filter((x) => x !== w); doc.acts.forEach(replan); qSheet(); drawSheet(); }
      else if (t.dataset && t.dataset.fq !== undefined) { const a = doc.acts[+t.dataset.fq]; a.mode = t.value; if (a.mode === "weekly" && !a.wd.length) a.wd = []; replan(a); qSheet(); drawSheet(); }
      else if (t.dataset && t.dataset.dt !== undefined) { const a = doc.acts[+t.dataset.dt], n = D.dim(M); a.dates = [...new Set(t.value.split(/[^0-9]+/).map(Number).filter((x) => x >= 1 && x <= n))].sort((x, y) => x - y); replan(a); qSheet(); drawSheet(); }
    } catch (err) { say(err.message); }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("button"); if (!b) return;
    try {
      if (b.dataset.wd) { const [i, w] = b.dataset.wd.split(":").map(Number), a = doc.acts[i]; a.wd = a.wd.includes(w) ? a.wd.filter((x) => x !== w) : [...a.wd, w]; replan(a); qSheet(); drawSheet(); }
      else if (b.id === "pv" || b.id === "nx") { M = new Date(Date.UTC(+M.slice(0, 4), +M.slice(5, 7) - 1 + (b.id === "nx" ? 1 : -1), 1)).toISOString().slice(0, 7); sel = null; await go(view); }
      else if (b.id === "prt") printView();
      else if (b.id === "addact") { const a = D.newAct(); a.id = D.newId(); a.resp = (curEmp() || {}).desig || ""; doc.acts.push(a); qSheet(); await drawSheet(); const inp = $(`input[data-ac="${doc.acts.length - 1}"][data-f="activity"]`); if (inp) { inp.focus(); inp.scrollIntoView({ block: "nearest" }); } }
      else if (b.id === "cp_prev") { const p = normalise(await getDoc(sheetKey(empId, prevMonth(M)))); doc.acts = p.acts.map((a) => { const x = clone(a); x.id = D.newId(); x.cells = OFF.repeat(31); if (x.mode === "dates") x.dates = x.dates.filter((d) => d <= D.dim(M)); replan(x); return x; }); doc.off = p.off; doc.target = p.target; doc.section = p.section; doc.reviewed = p.reviewed; doc.approved = p.approved; qSheet(); await drawSheet(); say("Copied and planned for " + monthName(M) + ".", true); }
      else if (b.dataset.rm !== undefined) { const a = doc.acts[+b.dataset.rm], used = Array.from(a.cells).some((c) => c === "C" || c === "X" || c === "E"); if (used && !confirm("This activity has completed / missed / concession entries. Delete it with all its entries?")) return; doc.acts.splice(+b.dataset.rm, 1); sel = null; qSheet(); await drawSheet(); }
      else if (b.id === "emp_add") { adding = true; await drawSheet(); const i = $("#ne_name"); if (i) i.focus(); }
      else if (b.id === "ne_no") { adding = false; await drawSheet(); }
      else if (b.id === "ne_ok") {
        const name = $("#ne_name").value.trim(); if (!name) { say("Type the employee’s name."); return; }
        const x = { id: D.newId(), name, desig: $("#ne_des").value.trim(), dept: $("#ne_dep").value.trim() }; emps.push(x); empId = x.id; adding = false; await putDoc("staff", { emps }); say("Employee added.", true); await go("sheet");
      }
      else if (b.id === "emp_del") { const x = curEmp(); if (!x || !confirm("Remove " + x.name + " and ALL their DWM sheets (every month)? This cannot be undone.")) return; await flush(); await delEmpDocs(x.id); emps = emps.filter((y) => y.id !== x.id); empId = emps[0] ? emps[0].id : ""; await putDoc("staff", { emps }); say("Employee removed.", true); await go("sheet"); }
      else if (b.dataset.task !== undefined) { if (window.KMRTask && taskPool[+b.dataset.task]) KMRTask.assign([taskPool[+b.dataset.task]]); }
      else if (b.dataset.open) { empId = b.dataset.open; try { localStorage.setItem(lk("last"), empId); } catch (x) { /* ignore */ } sel = null; await go("sheet"); }
    } catch (err) { say(err.message); }
  });
  /* ---------- printing: a proper A4 landscape document built from the data (not a picture of the screen); the logo, report reference and revision footer come from the KMR report frame ---------- */
  function printDoc(html) {
    let box = $("#prdoc"); if (!box) { box = document.createElement("div"); box.id = "prdoc"; box.className = "no-sno"; box.setAttribute("data-nofilter", ""); document.body.append(box); }
    box.innerHTML = html; document.body.classList.add("printing");
    const done = () => { document.body.classList.remove("printing"); box.innerHTML = ""; window.removeEventListener("afterprint", done); if (window.KMRReport) KMRReport.set({}); };
    window.addEventListener("afterprint", done); setTimeout(() => window.print(), 120);
  }
  const freqText = (a) => (a.mode === "daily" ? "Daily" : a.mode === "weekly" ? "Weekly / " + (a.wd.length ? D.WD_ORDER.filter((w) => a.wd.includes(w)).map((w) => D.WD[w]).join(", ") : "—") : a.mode === "dates" ? "Dates: " + (a.dates.join(", ") || "—") : "—");
  function sheetPrintHtml() {
    const e = curEmp() || {}, n = D.dim(M), c = D.calc(doc, M, today()), T = c.total, tgt = +doc.target || 98, pcs = (v) => (v == null ? "" : (v * 100).toFixed(1) + "%");
    const cw = (w, k) => `<col style="width:${w}mm">`.repeat(k), col = "<colgroup>" + cw(6, 1) + cw(54, 1) + cw(22, 1) + cw(23, 1) + cw(13, 1) + cw(4.1, 31) + cw(8, 3) + "</colgroup>";
    let h = `<h2>DAILY WORK MANAGEMENT${e.desig ? " – " + esc(e.desig.toUpperCase()) : ""} (ACHIEVE ${tgt}%)</h2><div class="meta"><span><b>Name:</b> ${esc(e.name)}</span><span><b>Department:</b> ${esc(e.dept)}</span><span><b>Designation:</b> ${esc(e.desig)}</span><span><b>Period:</b> ${monthName(M)}</span><span>O = Plan &nbsp; C = Completed &nbsp; X = Missed &nbsp; E = Concession &nbsp; – = Off / not scheduled</span></div>`;
    h += `<table>${col}<thead><tr><th rowspan="2">Sl #</th><th rowspan="2">Activity</th><th rowspan="2">Responsibility</th><th rowspan="2">Frequency</th><th rowspan="2">Duration</th>` + Array.from({ length: 31 }, (_, i) => `<th>${i + 1}</th>`).join("") + `<th colspan="3">Adherence</th></tr><tr>` + Array.from({ length: 31 }, (_, i) => `<th>${i + 1 <= n ? D.WD[D.dow(M, i + 1)].slice(0, 2) : OFF}</th>`).join("") + `<th>Plan</th><th>Actual</th><th>%</th></tr></thead><tbody>`;
    if (doc.section) h += `<tr class="band"><td colspan="39">${esc(doc.section)}</td></tr>`;
    c.rows.forEach((r, i) => {
      const a = r.a; h += `<tr><td class="c">${i + 1}</td><td class="l">${esc(a.activity)}</td><td class="l">${esc(a.resp)}</td><td class="l">${esc(freqText(a))}</td><td class="l">${esc(a.dur)}</td>`;
      for (let d = 1; d <= 31; d++) { const v = d > n ? OFF : D.cell(a, d); h += `<td class="c ${v === OFF ? "N" : v}">${v}</td>`; }
      h += `<td class="c">${r.plan}</td><td class="c">${r.done}</td><td class="c">${pcs(r.pct)}</td></tr>`;
    });
    if (!c.rows.length) h += `<tr><td colspan="39" class="c">No activities.</td></tr>`;
    const dr = (label, f, last) => `<tr class="tot"><td class="l" colspan="5">${label}</td>` + Array.from({ length: 31 }, (_, i) => `<td>${f(c.perDay[i])}</td>`).join("") + last + `</tr>`;
    h += dr("No. of activities planned / day", (x) => x.plan, `<td>${T.plan}</td><td>${T.done}</td><td>${pcs(T.pct)}</td>`) + dr("No. of activities completed / day", (x) => x.done, `<td colspan="3">Full-month adherence</td>`) + dr("Adherence %", (x) => (x.plan ? (x.pct * 100).toFixed(0) + "%" : ""), `<td colspan="3">Target ≥${tgt}%</td>`) + `</tbody></table>`;
    h += `<div class="sg"><span>Prepared by: ${esc(e.name)}</span><span>Reviewed by: ${esc(doc.reviewed) || "________________"}</span><span>Approved by: ${esc(doc.approved) || "________________"}</span><span>Date: ${esc(doc.date) || "________________"}</span></div>`;
    const items = []; doc.acts.forEach((a) => { for (let d = 1; d <= n; d++) { const v = D.cell(a, d); if (v === "X" || v === "E") items.push({ a, d, v }); } });
    if (items.length) h += `<table style="table-layout:auto"><thead><tr><th>Date</th><th>Activity</th><th>Status</th><th>Reason</th><th>Approver</th><th>Revised due date</th><th>Action reference</th></tr></thead><tbody>${items.map(({ a, d, v }) => { const L = doc.log[a.id + ":" + d] || {}; return `<tr><td class="l">${pad(d)}-${M.slice(5)}-${M.slice(0, 4)}</td><td class="l">${esc(a.activity)}</td><td class="l">${v === "X" ? "Missed" : "Concession"}</td><td class="l">${esc(L.reason || "")}</td><td class="l">${esc(L.approver || "")}</td><td class="l">${esc(L.due || "")}</td><td class="l">${esc(L.ref || "")}</td></tr>`; }).join("")}</tbody></table>`;
    return h;
  }
  function printView() {
    const key = view === "sheet" ? "sheet" : "dash", e = curEmp();
    if (window.KMRReport) KMRReport.set({ key, title: key === "sheet" ? "Daily Work Management — " + (e ? e.name : "") + " · " + monthName(M) : "Daily Work Management — dashboard · " + monthName(M), doc: "", land: true });
    if (key === "sheet") { if (doc) printDoc(sheetPrintHtml()); return; }
    const src = $("#dash .dsh"); if (!src) return; const cl = src.cloneNode(true); cl.querySelectorAll(".noprint").forEach((x) => x.remove()); printDoc(cl.outerHTML);
  }

  window.DWMApp = { printView };
  /* ================= Dashboards: every employee's DWM added up ================= */
  const LCOL = { g: "var(--g)", a: "var(--a)", r: "var(--r)", n: "#94a3b8" };
  function lineSvg(vals, tgt) {
    const W2 = 560, H = 190, n = vals.length, X = (i) => 40 + i * (W2 - 56) / Math.max(n - 1, 1), Y = (v) => H - 26 - v * (H - 46) / 100;
    let d = "", st = false; vals.forEach((v, i) => { if (v == null) return; d += (st ? "L" : "M") + X(i).toFixed(1) + " " + Y(Math.min(v, 100)).toFixed(1); st = true; });
    return `<svg viewBox="0 0 ${W2} ${H}" width="100%" role="img" aria-label="Adherence by day">${[0, 25, 50, 75, 100].map((g) => `<line x1="40" x2="${W2 - 12}" y1="${Y(g)}" y2="${Y(g)}" stroke="#e5e9f2"/><text x="36" y="${Y(g) + 4}" text-anchor="end" font-size="10" fill="#64748b">${g}%</text>`).join("")}
      <line x1="40" x2="${W2 - 12}" y1="${Y(tgt)}" y2="${Y(tgt)}" stroke="#16a34a" stroke-dasharray="5 4"/>${[1, 8, 15, 22, n].map((x) => `<text x="${X(x - 1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#64748b">${x}</text>`).join("")}
      <path d="${d}" fill="none" stroke="#174b80" stroke-width="2.5"/>${vals.map((v, i) => (v == null ? "" : `<circle cx="${X(i)}" cy="${Y(Math.min(v, 100))}" r="3" fill="#174b80"/>`)).join("")}</svg><div class="note">Completed ÷ planned for each day (all employees). Dashed line = target.</div>`;
  }
  async function drawDash() {
    await flush(); await loadStaff();
    const el = $("#dash"); if (!emps.length) { el.innerHTML = `<p class="mut">There are no employees yet. Add them in the <b>DWM</b> tab — each employee gets a sheet and their adherence appears here.</p>`; return; }
    taskPool = []; const docs = await getMonthDocs(M), depts = [...new Set(emps.map((e) => e.dept).filter(Boolean))].sort(), list = emps.filter((e) => !deptF || e.dept === deptF);
    const S = D.summary(list, docs, M, today(), 98), tg = S.target, T = S.total, withPlan = S.rows.filter((r) => r.T.plan > 0), below = withPlan.filter((r) => r.light === "r" || r.light === "a").length, noSheet = S.rows.filter((r) => !r.T.plan);
    const k = (v, s, c) => `<div class="kpi" style="--c:${c}"><b>${v}</b><span>${s}</span></div>`, lt = (v) => (v == null ? "var(--b1)" : v >= tg ? "var(--g)" : v >= tg - 8 ? "var(--a)" : "var(--r)");
    const sorted = withPlan.slice().sort((a, b) => (a.pctTo ?? a.pct ?? 0) - (b.pctTo ?? b.pct ?? 0));
    const emRows = sorted.map((r) => `<tr><td><b>${esc(r.emp.name)}</b></td><td>${esc(r.emp.desig || "")}</td><td>${esc(r.emp.dept || "")}</td><td class="n">${r.acts}</td><td class="n">${r.T.plan}</td><td class="n">${r.T.done}</td><td class="n">${r.T.missed}</td><td class="n">${r.T.conc}</td><td class="n">${r.T.overdue ? `<b style="color:var(--r)">${r.T.overdue}</b>` : 0}</td><td class="n">${fix1(r.pct)}</td><td class="n"><b style="color:${LCOL[r.light]}">${r.pctTo == null ? "—" : fix1(r.pctTo)}</b></td><td style="width:14%"><div class="bar2"><i style="width:${Math.min(r.pctTo ?? r.pct ?? 0, 100)}%;background:${LCOL[r.light]}"></i></div></td><td><span class="chip ${r.light === "n" ? "x" : r.light}">${{ g: "On target", a: "Watch", r: "Below target", n: "—" }[r.light]}</span></td><td class="noprint"><button class="btn o s" data-open="${r.emp.id}">Open DWM</button></td></tr>`).join("");
    /* frequency-wise */
    const fq = { daily: [0, 0, 0], weekly: [0, 0, 0], dates: [0, 0, 0], "": [0, 0, 0] };
    S.rows.forEach((r) => r.c.rows.forEach((x) => { const g = fq[x.a.mode || ""]; g[0]++; g[1] += x.planTo; g[2] += x.doneTo; }));
    /* activities below target + missed/concession */
    const act = []; S.rows.forEach((r) => r.c.rows.forEach((x) => { if (x.planTo > 0 && x.doneTo / x.planTo * 100 < tg) act.push({ r, x }); })); act.sort((a, b) => a.x.doneTo / a.x.planTo - b.x.doneTo / b.x.planTo);
    const logs = []; S.rows.forEach((r) => ((r.doc && r.doc.acts) || []).forEach((a) => { for (let d = 1; d <= S.n; d++) { const v = D.cell(a, d); if (v === "X" || v === "E") logs.push({ r, a, d, v, L: (r.doc.log || {})[a.id + ":" + d] || {} }); } }));
    el.innerHTML = `<div class="dsh"><div class="row noprint"><button class="btn o s" id="pv">‹</button><input type="month" id="mon" class="sel" value="${M}"><button class="btn o s" id="nx">›</button>
      <label class="mut">Department <select id="dept_f" class="sel"><option value="">All departments</option>${depts.map((d) => `<option ${deptF === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label><span style="flex:1"></span><button class="btn s" id="prt">⎙ Print / PDF</button></div>
      <h2 style="margin:6px 0;font-size:18px">DWM dashboard · ${monthName(M)}</h2><p class="note" style="margin-top:0">Adds up the DWM sheet of every employee. Adherence = completed ÷ planned; a concession stays in the plan. <b>To date</b> counts the reviews due up to today; <b>full month</b> keeps the future reviews in the denominator. Target ${tg}%.</p>
      <div class="cards">${k(withPlan.length + " / " + S.rows.length, "Employees with a plan this month", "var(--b1)")}${k(fix1(T.pctTo), "Adherence to date (" + T.doneTo + " of " + T.planTo + " due)", lt(T.pctTo))}${k(fix1(T.pct), "Full-month adherence", lt(T.pct))}${k(T.done + " / " + T.plan, "Completed / planned reviews", "var(--g)")}${k(T.overdue, "Past days still showing O", T.overdue ? "var(--r)" : "var(--g)")}${k(T.missed, "Missed (X)", T.missed ? "var(--r)" : "var(--g)")}${k(T.conc, "Concessions (E)", "var(--a)")}${k(below, "Employees below target", below ? "var(--r)" : "var(--g)")}</div>
      <h3>Employee-wise adherence <span class="mut" style="font-weight:400;font-size:12px">(lowest first)</span></h3>
      ${withPlan.length ? `<div style="overflow:auto"><table class="no-sno" data-nofilter><thead><tr><th>Employee</th><th>Designation</th><th>Department</th><th class="n">Activities</th><th class="n">Planned</th><th class="n">Completed</th><th class="n">Missed</th><th class="n">Concession</th><th class="n">Past-due O</th><th class="n">Full month</th><th class="n">To date</th><th></th><th>Status</th><th class="noprint"></th></tr></thead><tbody>${emRows}</tbody></table></div>` : '<p class="mut">No employee has planned reviews this month yet.</p>'}
      ${noSheet.length ? `<p class="note"><b>No planned reviews this month:</b> ${noSheet.map((r) => esc(r.emp.name)).join(", ")}.</p>` : ""}
      <div class="grid2"><div class="box"><h3 style="margin-top:0">Adherence by day — all employees</h3>${lineSvg(S.perDay.slice(0, S.n).map((x, i) => (i + 1 <= S.dayNo ? x.pct : null)), tg)}</div>
        <div class="box"><h3 style="margin-top:0">By frequency (to date)</h3><table class="no-sno" data-nofilter><thead><tr><th>Frequency</th><th class="n">Activities</th><th class="n">Planned</th><th class="n">Completed</th><th class="n">Adherence</th></tr></thead><tbody>${[["daily", "Daily"], ["weekly", "Weekly"], ["dates", "Specific dates"], ["", "Frequency not set"]].map(([key, t]) => { const g = fq[key]; return `<tr><td>${t}</td><td class="n">${g[0]}</td><td class="n">${g[1]}</td><td class="n">${g[2]}</td><td class="n">${g[1] ? fix1(g[2] / g[1] * 100) : "—"}</td></tr>`; }).join("")}</tbody></table></div></div>
      <h3>Activities below target — where to act</h3>
      ${act.length ? `<table class="no-sno" data-nofilter><thead><tr><th>Employee</th><th>Activity</th><th>Frequency</th><th class="n">Planned to date</th><th class="n">Completed</th><th class="n">Adherence</th><th class="noprint"></th></tr></thead><tbody>${act.slice(0, 15).map(({ r, x }) => `<tr><td>${esc(r.emp.name)}</td><td>${esc(x.a.activity || "(no name)")}</td><td>${D.freqLabel(x.a)}</td><td class="n">${x.planTo}</td><td class="n">${x.doneTo}</td><td class="n"><b style="color:var(--r)">${(x.doneTo / x.planTo * 100).toFixed(0)}%</b></td><td>${taskBtn({ title: "Improve DWM adherence: " + (x.a.activity || "(no name)") + " — " + (x.doneTo / x.planTo * 100).toFixed(0) + "% against the " + tg + "% target", detail: r.emp.name + ": " + x.doneTo + " of " + x.planTo + " reviews due so far were completed in " + monthName(M) + ".", who: r.emp.name, due: addD(7), priority: "normal", source_ref: r.emp.id + ":" + x.a.id + ":" + M })}</td></tr>`).join("")}</tbody></table>` : '<p class="mut">Every activity due so far is at or above the target.</p>'}
      <h3>Missed and concession record</h3>
      ${logs.length ? `<table class="no-sno" data-nofilter><thead><tr><th>Date</th><th>Employee</th><th>Activity</th><th>Status</th><th>Reason</th><th>Approver</th><th>Revised due</th><th>Action ref.</th><th class="noprint"></th></tr></thead><tbody>${logs.slice(0, 40).map((x) => `<tr><td>${pad(x.d)}-${M.slice(5)}-${M.slice(0, 4)}</td><td>${esc(x.r.emp.name)}</td><td>${esc(x.a.activity || "(no name)")}</td><td>${x.v === "X" ? "Missed" : "Concession"}</td><td>${esc(x.L.reason || "—")}</td><td>${esc(x.L.approver || "—")}</td><td>${esc(x.L.due || "—")}</td><td>${esc(x.L.ref || "—")}</td><td>${taskBtn({ title: (x.v === "X" ? "Missed review: " : "Concession review: ") + (x.a.activity || "(no name)") + " on " + pad(x.d) + "-" + M.slice(5) + "-" + M.slice(0, 4), detail: "DWM of " + x.r.emp.name + ". Reason: " + (x.L.reason || "not recorded"), who: x.r.emp.name, due: x.L.due || addD(3), priority: x.v === "X" ? "high" : "normal", source_ref: x.r.emp.id + ":" + x.a.id + ":" + M + "-" + pad(x.d) })}</td></tr>`).join("")}</tbody></table>` : '<p class="mut">No missed reviews or concessions this month.</p>'}
      </div>`;
  }

  /* ================= navigation ================= */
  async function go(v) {
    say(""); view = v; $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === v)); ["std", "sheet", "dash"].forEach((s) => $("#" + s).classList.toggle("hide", s !== v));
    try {
      await loadStaff();
      if (v === "std") { if (window.KMRStd) KMRStd.draw($("#std"), "dwm", { evidence: {} }); return; }
      if (v === "dash") { await drawDash(); return; }
      await loadSheet(); await drawSheet();
    } catch (e) { say(e.message); }
  }
  document.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest(".tab[data-t]"); if (t) { e.preventDefault(); try { history.replaceState(null, "", location.pathname + location.search + "#go=" + t.dataset.t); } catch (x) { /* ignore */ } go(t.dataset.t); } });

  (async () => {
    try {
      if (DEMO) { ctx = { role: "admin", company: "Demo Engineering (sample data)" }; $("#co").textContent = ctx.company; $("#role").textContent = "admin"; }
      else { await QP.init("dwm", "kmr_dwm_context"); if (!QP.ctx) return; ctx = QP.ctx; }
      canEdit = ["admin", "editor"].includes(ctx.role);
      if (window.KMRTask && !DEMO) await KMRTask.init({ call: QP.call, slug: QP.slug, token: async () => { const r = QP.sb && (await QP.sb.auth.getSession()); return r && r.data.session ? r.data.session.access_token : null; } });
      const h = (window.KMRNav && KMRNav.pending() || { go: location.hash.slice(1) }).go; await go(["std", "sheet", "dash"].includes(h) ? h : "std");
    } catch (e) { say(e.message); }
  })();
})();
