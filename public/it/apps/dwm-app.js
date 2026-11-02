/* Daily Work Management (DWM) — the three Excel sheets as screens, with the same rules:
   Plant Head DWM · Review standards · Executive Director reporting.
   Saved per company in the database (kmr_dwm_get / kmr_dwm_save); on this device only until the database update (migration 0091) is applied. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const D = window.DWM, SEED = window.DWM_SEED, DEMO = QP.DEMO, OFF = D.OFF;
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const monthName = (m) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const dmy = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("-") : "");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const say = (m, ok) => { const el = $("#msg"); el.innerHTML = m ? `<div class="msg${ok === "w" ? " w" : ok ? " ok" : ""}">${esc(m)}</div>` : ""; if (m && ok === true) setTimeout(() => { if (el.textContent === m) el.innerHTML = ""; }, 3500); };

  let M = today().slice(0, 7), doc = null, edr = null, canEdit = false, ctx = null, local = DEMO, view = "std", sel = null, editActs = false, saveT = null, dirty = { sheet: false, edr: false };
  const KEY = () => "plan:" + M;

  /* ================= storage ================= */
  const lk = (k) => "kmr_dwm_" + (DEMO ? "demo_" : (QP.slug || "") + "_") + k;
  async function getDoc(key) {
    if (!local) { try { const r = await QP.call("kmr_dwm_get", { p_key: key }); return r || null; } catch (e) { if (/does not exist|could not find|schema cache|function/i.test(e.message)) local = true; else throw e; } }
    try { return JSON.parse(localStorage.getItem(lk(key)) || "null"); } catch (e) { return null; }
  }
  async function putDoc(key, value) {
    if (!local) { try { await QP.call("kmr_dwm_save", { p_key: key, p_doc: value }); return; } catch (e) { if (/does not exist|could not find|schema cache|function/i.test(e.message)) local = true; else throw e; } }
    try { localStorage.setItem(lk(key), JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function saved(state) {
    const b = $("#svst"); if (!b) return;
    b.textContent = state === "saving" ? "Saving…" : state === "err" ? "Not saved" : local && !DEMO ? "Saved on this device only (database update pending)" : DEMO ? "Sample — saved in this browser" : "Saved ✓";
    b.style.color = state === "err" ? "var(--r)" : "var(--mut)";
  }
  function queue(which) {
    dirty[which] = true; saved("saving"); clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try { if (dirty.sheet) { dirty.sheet = false; await putDoc(KEY(), doc); } if (dirty.edr) { dirty.edr = false; await putDoc("edr", edr); } saved("ok"); } catch (e) { saved("err"); say(e.message); }
    }, 500);
  }
  window.addEventListener("beforeunload", () => { if (dirty.sheet || dirty.edr) { try { if (dirty.sheet) localStorage.setItem(lk(KEY()), JSON.stringify(doc)); if (dirty.edr) localStorage.setItem(lk("edr"), JSON.stringify(edr)); } catch (e) { /* ignore */ } } });

  async function loadMonth() {
    doc = await getDoc(KEY());
    if (!doc && M === "2026-11") { doc = clone(SEED.sheet); doc.log = {}; if (canEdit) queue("sheet"); }
  }

  /* ================= the monthly sheet (Plant Head DWM) ================= */
  const W = { a: 40, b: 400, c: 205, d: 155, e: 120, day: 32, ad: 63 };
  function sheetHtml() {
    const n = D.dim(M), c = D.calc(doc, M, today()), T = c.total, tgt = +doc.target || 98, td = today(), dayNo = td.slice(0, 7) === M ? +td.slice(8) : 0;
    const cg = (w, k) => `<col style="width:${w}px">`.repeat(k);
    const col = "<colgroup>" + cg(W.a, 1) + cg(W.b, 1) + cg(W.c, 1) + cg(W.d, 1) + cg(W.e, 1) + cg(W.day, 31) + cg(W.ad, 3) + "</colgroup>";
    const pc = (v) => (v == null ? "" : (v * 100).toFixed(1) + "%");
    const ro = !canEdit ? " disabled" : "";
    let h = `<div class="row noprint"><button class="btn o s" id="pv">‹</button><input type="month" id="mon" class="sel" value="${M}"><button class="btn o s" id="nx">›</button>
      <span id="svst" class="mut" style="font-size:12px"></span><span style="flex:1"></span>
      ${canEdit ? `<button class="btn o s" id="eda">${editActs ? "✓ Done editing activities" : "✎ Edit activities"}</button><button class="btn o s" id="rpl" title="Re-plan every activity from its frequency (resets all statuses of this month)">↻ Plan from frequency</button>` : ""}
      <button class="btn s" id="prt">⎙ Print / PDF</button></div>
      <div class="cards noprint"><div class="kpi" style="--c:${T.pct != null && T.pct * 100 >= tgt ? "var(--g)" : "var(--b1)"}"><b>${pc(T.pct) || "0.0%"}</b><span>Full-month adherence (target ≥ ${tgt}%)</span></div>
        <div class="kpi" style="--c:var(--g)"><b>${T.done} / ${T.plan}</b><span>Completed / planned reviews</span></div>
        <div class="kpi" style="--c:${T.pctTo != null && T.pctTo * 100 >= tgt ? "var(--g)" : "var(--a)"}"><b>${T.planTo ? pc(T.pctTo) : "—"}</b><span>Adherence to date (${T.doneTo} of ${T.planTo} due)</span></div>
        <div class="kpi" style="--c:${T.overdue ? "var(--r)" : "var(--g)"}"><b>${T.overdue}</b><span>Past days still showing O (update to C or X)</span></div>
        <div class="kpi" style="--c:${T.missed ? "var(--r)" : "var(--g)"}"><b>${T.missed}</b><span>Missed (X)</span></div>
        <div class="kpi" style="--c:var(--a)"><b>${T.conc}</b><span>Concessions (E)</span></div></div>
      <div class="xl no-sno" data-nofilter><div class="xs" id="xs"><table>${col}<tbody>`;
    const vw = "style=\"position:sticky;left:0;width:var(--vw,900px)\"";
    h += `<tr class="t1"><td colspan="39"><div style="position:sticky;left:0;width:var(--vw,900px);height:76px;line-height:76px;text-align:center"><span id="xlogo" style="position:absolute;left:0;top:0;line-height:0"></span>${esc(doc.title)}</div></td></tr>`;
    h += `<tr class="t2"><td colspan="2" class="fa" style="left:0">Name: <input class="cell" id="f_name" style="width:70%;display:inline-block" value="${esc(doc.name)}" placeholder="[enter plant head name]"${ro}></td><td colspan="3">Department: <input class="cell" id="f_dept" style="width:60%;display:inline-block" value="${esc(doc.dept)}"${ro}></td><td colspan="8">Period: ${monthName(M)}</td><td colspan="9">O = Plan &nbsp; C = Completed</td><td colspan="10">X = Missed &nbsp; E = Concession</td><td colspan="7">– = Off / not scheduled</td></tr>`;
    h += `<tr class="t3"><th class="fa" rowspan="2">Sl #</th><th class="fb" rowspan="2">Activity</th><th rowspan="2">Responsibility</th><th rowspan="2">Frequency</th><th rowspan="2">Duration</th>` + Array.from({ length: 31 }, (_, i) => `<th class="c${i + 1 === dayNo ? " cur" : ""}">${i + 1}</th>`).join("") + `<th colspan="3">Adherence</th></tr>`;
    h += `<tr class="t4">` + Array.from({ length: 31 }, (_, i) => `<th>${i + 1 <= n ? D.WD[D.dow(M, i + 1)] : OFF}</th>`).join("") + `<th>Plan</th><th>Actual</th><th>%</th></tr>`;
    h += `<tr class="band"><td colspan="39"><div ${vw}>${esc(doc.section)}</div></td></tr>`;
    c.rows.forEach((r, i) => {
      const a = r.a;
      h += `<tr class="ar"><td class="fa c">${esc(a.sl)}</td><td class="fb wrap">${esc(a.activity)}</td><td>${esc(a.resp)}</td><td>${esc(a.freq)}</td><td>${esc(a.dur)}</td>`;
      for (let d = 1; d <= 31; d++) {
        const v = d > n ? OFF : D.cell(a, d), k = v === OFF ? "N" : v, od = v === "O" && d < c.dayNo && dayNo ? " od" : "";
        h += `<td class="d ${k}${d === dayNo ? " cur" : ""}${od}${!canEdit || d > n ? " ro" : ""}" data-i="${i}" data-d="${d}"${od ? ' title="Date has passed — update to C (done), X (missed) or E (concession)"' : ""}>${v}</td>`;
      }
      h += `<td class="c">${r.plan}</td><td class="c">${r.done}</td><td class="c">${r.plan ? (r.pct * 100).toFixed(1) + "%" : ""}</td></tr>`;
    });
    const dayRow = (cls, label, f, last) => `<tr class="tot"><td class="l" colspan="5" style="text-align:left">${label}</td>` + Array.from({ length: 31 }, (_, i) => `<td>${f(c.perDay[i], i)}</td>`).join("") + last + `</tr>`;
    h += `<tr class="tot"><td colspan="39" style="height:16px;background:#fff"></td></tr>`;
    h += dayRow("", "No. of activities planned / day", (x) => x.plan, `<td>${T.plan}</td><td>${T.done}</td><td>${T.plan ? (T.pct * 100).toFixed(1) + "%" : ""}</td>`);
    h += dayRow("", "No. of activities completed / day", (x) => x.done, `<td colspan="3">Full-month adherence</td>`);
    h += dayRow("", "Adherence %", (x) => (x.plan ? (x.pct * 100).toFixed(1) + "%" : ""), `<td colspan="3">Target ≥${tgt}%</td>`);
    h += `<tr class="sgn"><td colspan="39"><div ${vw}><span style="display:inline-block;width:24%"><b style="font-weight:400">Prepared by:</b> <input class="cell" id="f_pre" style="width:55%;display:inline-block" value="${esc(doc.prepared)}"${ro}></span><span style="display:inline-block;width:24%">Reviewed by: <input class="cell" id="f_rev" style="width:55%;display:inline-block" value="${esc(doc.reviewed)}"${ro}></span><span style="display:inline-block;width:24%">Approved by: <input class="cell" id="f_apr" style="width:55%;display:inline-block" value="${esc(doc.approved)}"${ro}></span><span style="display:inline-block;width:24%">Date: <input class="cell" id="f_date" style="width:60%;display:inline-block" value="${esc(doc.date || "")}" placeholder="__________________"${ro}></span></div></td></tr>`;
    h += `</tbody></table></div></div>`;
    h += logHtml(c) + (editActs ? actsEditor() : "");
    return h;
  }
  /* missed / concession log — the sheet note: "For E, record reason, approver, revised due date and action reference" */
  function logHtml(c) {
    const items = []; doc.acts.forEach((a, i) => { for (let d = 1; d <= c.n; d++) { const v = D.cell(a, d); if (v === "X" || v === "E") items.push({ a, i, d, v }); } });
    if (!items.length) return `<div class="log noprint no-sno" data-nofilter id="logbox"><p class="note">Missed (X) and concession (E) reviews are listed here with their reason, approver, revised due date and action reference. Nothing to record yet.</p></div>`;
    doc.log = doc.log || {};
    return `<div class="log noprint no-sno" data-nofilter id="logbox"><h3 style="margin:14px 0 4px;font-size:14px">Missed and concession record</h3><p class="note">Record the reason for every X, and for every E the approver, revised due date and the action reference in the plant action log. Do not erase a planned entry to hide a miss.</p>
      <table><thead><tr><th>Date</th><th>Activity</th><th>Status</th><th>Reason</th><th>Approver (for E)</th><th>Revised due date</th><th>Action reference</th></tr></thead><tbody>${items.map(({ a, d, v }) => { const k = a.sl + ":" + d, L = doc.log[k] || {}, dis = canEdit ? "" : " disabled";
        return `<tr><td>${pad(d)}-${M.slice(5)}-${M.slice(0, 4)}</td><td>${esc(a.activity)}</td><td><span class="chip ${v === "X" ? "r" : "a"}">${v === "X" ? "Missed" : "Concession"}</span></td>
          <td><input data-lg="${esc(k)}" data-f="reason" value="${esc(L.reason || "")}"${dis}></td><td><input data-lg="${esc(k)}" data-f="approver" value="${esc(L.approver || "")}"${v === "E" ? "" : " disabled"}${dis}></td>
          <td><input type="date" data-lg="${esc(k)}" data-f="due" value="${esc(L.due || "")}"${dis}></td><td><input data-lg="${esc(k)}" data-f="ref" value="${esc(L.ref || "")}"${dis}></td></tr>`; }).join("")}</tbody></table></div>`;
  }
  function actsEditor() {
    return `<div class="log noprint no-sno" data-nofilter style="margin-top:14px"><h3 style="margin:0 0 4px;font-size:14px">Edit activities of this sheet</h3><p class="note">Change the activity, responsibility, frequency or duration, add or remove a row, or move it. After changing a frequency use <b>Plan from frequency</b> (or set the days by clicking the cells).</p>
      <table><thead><tr><th style="width:50px">Sl #</th><th>Activity</th><th>Responsibility</th><th>Frequency</th><th>Duration</th><th style="width:150px"></th></tr></thead><tbody>${doc.acts.map((a, i) => `<tr><td>${esc(a.sl)}</td><td><input data-ea="${i}" data-f="activity" value="${esc(a.activity)}"></td><td><input data-ea="${i}" data-f="resp" value="${esc(a.resp)}"></td><td><input data-ea="${i}" data-f="freq" value="${esc(a.freq)}"></td><td><input data-ea="${i}" data-f="dur" value="${esc(a.dur)}"></td>
        <td><button class="btn o s" data-mv="${i}:-1">↑</button> <button class="btn o s" data-mv="${i}:1">↓</button> <button class="btn o s" data-rm="${i}">✕</button></td></tr>`).join("")}</tbody></table>
      <p><button class="btn o s" id="addact">＋ Add activity</button></p></div>`;
  }
  function drawSheet() {
    const keep = $("#xs"), sx = keep ? keep.scrollLeft : 0, sy = keep ? keep.scrollTop : 0, wy = window.scrollY;
    if (!doc) { $("#sheet").innerHTML = createPanel(); fitVw(); return; }
    $("#sheet").innerHTML = sheetHtml(); const x = $("#xs"); if (x) { x.scrollLeft = sx; x.scrollTop = sy; } window.scrollTo(0, wy); saved(dirty.sheet ? "saving" : "ok"); paintLogo(); fitVw(); if (sel) { const t = cellEl(sel.i, sel.d); if (t) t.classList.add("sel"); }
  }
  function createPanel() {
    const prev = new Date(Date.UTC(+M.slice(0, 4), +M.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
    return `<div class="row noprint"><button class="btn o s" id="pv">‹</button><input type="month" id="mon" class="sel" value="${M}"><button class="btn o s" id="nx">›</button></div>
      <div class="msg w">There is no Plant Head DWM sheet for ${monthName(M)} yet.</div>
      ${canEdit ? `<p>Create it with the same activities, with every status reset and the days planned from each activity’s frequency (Sundays off):</p><p><button class="btn" id="mk_prev">Create from ${monthName(prev)}</button> <button class="btn o" id="mk_std">Create from the standard Plant Head sheet</button></p><p class="note">After creating, check the plan: other plant holidays are not assumed. Change a day by clicking its cell.</p>` : `<p class="mut">Ask an editor to create it.</p>`}`;
  }
  const cellEl = (i, d) => $(`.xl td.d[data-i="${i}"][data-d="${d}"]`);
  function fitVw() { const x = $("#xs"); if (x) x.style.setProperty("--vw", Math.max(600, x.clientWidth - 24) + "px"); $$(".xs").forEach((e) => e.style.setProperty("--vw", Math.max(600, e.clientWidth - 24) + "px")); }
  window.addEventListener("resize", fitVw);
  function paintLogo() {
    const el = $("#xlogo"), src = (window.KMRReport && KMRReport.logoSrc && KMRReport.logoSrc()) || ((document.querySelector("#clogo img") || {}).src || "");
    if (el && src) el.innerHTML = `<img src="${esc(src)}" alt="" style="max-height:68px;max-width:190px;object-fit:contain;padding:4px">`;
  }
  setTimeout(() => { paintLogo(); }, 1500);

  /* ---------- editing a cell: click for the list, or type O C X E - ---------- */
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
    queue("sheet"); sel = { i, d }; drawSheet();
    if (v === "E" || v === "X") { say(v === "E" ? "Concession: record the reason, approver, revised due date and action reference below the sheet." : "Missed: record the reason below the sheet.", "w"); const lb = $("#logbox"); if (lb) lb.scrollIntoView({ block: "nearest" }); } else say("");
  }
  document.addEventListener("click", (e) => {
    const t = e.target;
    const dc = t.closest && t.closest(".xl td.d");
    if (dc && view === "sheet") { const i = +dc.dataset.i, d = +dc.dataset.d; $$(".xl td.d.sel").forEach((x) => x.classList.remove("sel")); dc.classList.add("sel"); sel = { i, d }; if (canEdit && d <= D.dim(M)) openMenu(dc); return; }
    const s = t.closest && t.closest("[data-set]"); if (s && sel) { closeMenu(); setCell(sel.i, sel.d, s.dataset.set); return; }
    if (!(t.closest && t.closest("#pop"))) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (view !== "sheet" || !sel || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "") || e.target.isContentEditable) return;
    const k = e.key, n = D.dim(M);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) { e.preventDefault(); closeMenu(); let { i, d } = sel; if (k === "ArrowLeft") d = Math.max(1, d - 1); if (k === "ArrowRight") d = Math.min(31, d + 1); if (k === "ArrowUp") i = Math.max(0, i - 1); if (k === "ArrowDown") i = Math.min(doc.acts.length - 1, i + 1); $$(".xl td.d.sel").forEach((x) => x.classList.remove("sel")); sel = { i, d }; const t = cellEl(i, d); if (t) { t.classList.add("sel"); t.scrollIntoView({ block: "nearest", inline: "nearest" }); } return; }
    const m = { o: "O", c: "C", x: "X", e: "E", "-": OFF, "–": OFF }[k.length === 1 ? k.toLowerCase() : ""]; if (m && canEdit && sel.d <= n) { e.preventDefault(); setCell(sel.i, sel.d, m); }
    if (k === "Escape") closeMenu();
  });

  /* ---------- the sheet's own events ---------- */
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "f_name") { doc.name = t.value; queue("sheet"); } else if (t.id === "f_dept") { doc.dept = t.value; queue("sheet"); } else if (t.id === "f_pre") { doc.prepared = t.value; queue("sheet"); } else if (t.id === "f_rev") { doc.reviewed = t.value; queue("sheet"); } else if (t.id === "f_apr") { doc.approved = t.value; queue("sheet"); } else if (t.id === "f_date") { doc.date = t.value; queue("sheet"); }
    else if (t.dataset.lg) { doc.log = doc.log || {}; (doc.log[t.dataset.lg] ||= {})[t.dataset.f] = t.value; queue("sheet"); }
    else if (t.dataset.ea !== undefined) { doc.acts[+t.dataset.ea][t.dataset.f] = t.value; queue("sheet"); }
  });
  document.addEventListener("change", (e) => { const t = e.target; if (t.id === "mon" && t.value) { M = t.value; sel = null; go("sheet"); } else if (t.dataset.ea !== undefined && t.dataset.f === "freq") drawSheetKeepFocus(); });
  function drawSheetKeepFocus() { /* the frequency is only stored; planning is applied by "Plan from frequency" */ }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("button"); if (!b) return;
    try {
      if (b.id === "pv" || b.id === "nx") { const d = new Date(Date.UTC(+M.slice(0, 4), +M.slice(5, 7) - 1 + (b.id === "nx" ? 1 : -1), 1)); M = d.toISOString().slice(0, 7); sel = null; await go("sheet"); }
      else if (b.id === "prt") { printView(); }
      else if (b.id === "eda") { editActs = !editActs; drawSheet(); }
      else if (b.id === "rpl") { if (!confirm("Plan every activity again from its frequency?\n\nThis resets ALL statuses of " + monthName(M) + " (completed, missed and concession entries are lost).")) return; doc = D.blank(M, doc); queue("sheet"); drawSheet(); say("Planned from the frequencies.", true); }
      else if (b.id === "mk_prev" || b.id === "mk_std") {
        let base = null; if (b.id === "mk_prev") { const prev = new Date(Date.UTC(+M.slice(0, 4), +M.slice(5, 7) - 2, 1)).toISOString().slice(0, 7); base = await getDoc("plan:" + prev); if (!base && prev === "2026-11") base = clone(SEED.sheet); if (!base) { say("The previous month has no sheet — created from the standard sheet instead.", "w"); } }
        doc = D.blank(M, base || SEED.sheet); doc.date = ""; queue("sheet"); drawSheet(); say("Created and planned from the frequencies. Check the plan before use.", true);
      }
      else if (b.id === "addact") { const n = doc.acts.length ? Math.max(...doc.acts.map((a) => +a.sl || 0)) + 1 : 1; doc.acts.push({ sl: n, activity: "New activity", resp: "Plant Head", freq: "Daily", dur: "30 min", cells: D.plan("Daily", M) }); queue("sheet"); drawSheet(); }
      else if (b.dataset.rm !== undefined) { if (!confirm("Remove this activity from the sheet?")) return; doc.acts.splice(+b.dataset.rm, 1); doc.acts.forEach((a, i) => (a.sl = i + 1)); queue("sheet"); drawSheet(); }
      else if (b.dataset.mv) { const [i, s] = b.dataset.mv.split(":").map(Number), j = i + s; if (j < 0 || j >= doc.acts.length) return; [doc.acts[i], doc.acts[j]] = [doc.acts[j], doc.acts[i]]; doc.acts.forEach((a, k) => (a.sl = k + 1)); queue("sheet"); drawSheet(); }
    } catch (err) { say(err.message); }
  });
  function printView() {
    const key = view === "sheet" ? "sheet" : view === "rs" ? "rs" : "edr";
    if (window.KMRReport) KMRReport.set({ key, title: { sheet: "Daily Work Management — Plant Head · " + monthName(M), rs: "Plant head review standards", edr: "Plant Head reporting to Executive Director" }[key], doc: key === "edr" ? "" : monthName(M), land: true });
    window.print(); setTimeout(() => { if (window.KMRReport) KMRReport.set({}); }, 800);
  }

  /* ================= Review standards ================= */
  const RS_COLS = [["sl", "Sl #", 6], ["activity", "Activity", 55], ["support", "Supporting owner", 30], ["evidence", "Required evidence / review output", 56], ["trigger", "Decision / escalation trigger", 54], ["acct", "Accountability", 28]];
  function ce(f, i, v, tag) { return `<td${f === "sl" ? ' class="c"' : ""}><span class="rd" ${canEdit ? 'contenteditable="true"' : ""} data-ce="${tag}" data-i="${i}" data-f="${f}">${esc(v)}</span></td>`; }
  function drawRS() {
    if (!doc) { $("#rs").innerHTML = `<p class="mut">There is no sheet for ${monthName(M)} yet. Open the <b>Plant Head DWM</b> tab to create it.</p>`; return; }
    const S = doc.stds || (doc.stds = clone(SEED.sheet.stds)), notes = doc.notes || SEED.sheet.notes;
    $("#rs").innerHTML = `<div class="row noprint"><span id="svst" class="mut" style="font-size:12px"></span><span style="flex:1"></span><button class="btn s" id="prt">⎙ Print / PDF</button></div>
      <div class="xl2 no-sno" data-nofilter><h2>${esc(doc.std_title || "Plant head review standards")}</h2>${notes.map((t) => `<div class="nt">${esc(t)}</div>`).join("")}<div style="height:10px"></div>
      <table><colgroup>${RS_COLS.map((c) => `<col style="width:${c[2]}ch">`).join("")}</colgroup><thead><tr>${RS_COLS.map((c) => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${S.map((r, i) => `<tr>${RS_COLS.map((c) => ce(c[0], i, r[c[0]], "rs")).join("")}</tr>`).join("")}</tbody></table></div>
      ${canEdit ? `<p class="noprint"><button class="btn o s" id="rs_add">＋ Add row</button> <button class="btn o s" id="rs_del">Remove last row</button> <span class="note">Click any cell to edit it. Changes are saved automatically.</span></p>` : ""}`;
    saved("ok");
  }
  /* ================= Executive Director reporting ================= */
  const CAD_COLS = ["Report / forum", "Timing / trigger", "Plant Head submits", "Required business analysis", "Decisions requested", "Completion evidence", "DWM activity", "Recipient"];
  const REG_COLS = ["Review / direction date", "Executive Director direction / decision", "Expected outcome / measure", "Accountable owner", "Due date", "Status", "Closure evidence / reference", "Executive Director acceptance / date"];
  const REG_STATUS = ["", "Open", "In progress", "At risk", "Submitted for closure", "Closed"];
  function drawEDR() {
    const R = edr, ro = !canEdit;
    const cell = (tag, i, j, v) => `<td><span class="rd" ${ro ? "" : 'contenteditable="true"'} data-ce="${tag}" data-i="${i}" data-j="${j}">${esc(v)}</span></td>`;
    $("#edr").innerHTML = `<div class="row noprint"><span id="svst" class="mut" style="font-size:12px"></span><span style="flex:1"></span><button class="btn s" id="prt">⎙ Print / PDF</button></div>
      <div class="xl2 no-sno" data-nofilter><h2>${esc(R.title)}</h2><div class="nt">${esc(R.intro)}</div>
      <table><thead><tr>${CAD_COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${R.cadence.map((r, i) => `<tr>${r.map((v, j) => cell("cad", i, j, v ?? "")).join("")}</tr>`).join("")}</tbody></table>
      <div class="nt" style="margin-top:8px">${esc(R.notes[0])}</div><div class="nt">${esc(R.notes[1])}</div><div style="height:8px"></div>
      <h2 style="text-align:left;font-size:14px">${esc(R.reg_title)}</h2>
      <table><thead><tr>${REG_COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${R.register.map((r, i) => `<tr>${[0, 1, 2, 3, 4].map((j) => cell("reg", i, j, r[j] ?? "")).join("")}<td><select data-reg="${i}" ${ro ? "disabled" : ""}>${REG_STATUS.map((s) => `<option ${s === (r[5] || "") ? "selected" : ""}>${s}</option>`).join("")}</select></td>${[6, 7].map((j) => cell("reg", i, j, r[j] ?? "")).join("")}</tr>`).join("")}</tbody></table>
      <div class="nt">${esc(R.reg_close)}</div></div>
      ${ro ? "" : `<p class="noprint"><button class="btn o s" id="reg_add">＋ Add direction</button> <span class="note">Click any cell to edit it. Dates: type as dd-mm-yyyy. Changes are saved automatically.</span></p>`}`;
    saved("ok");
  }
  document.addEventListener("focusout", (e) => {
    const t = e.target; if (!t.dataset || !t.dataset.ce) return; const v = t.innerText.replace(/ /g, " ").replace(/\n+$/, "");
    if (t.dataset.ce === "rs") { const S = doc.stds, r = S[+t.dataset.i]; if (r && r[t.dataset.f] !== v) { r[t.dataset.f] = v; queue("sheet"); } }
    else if (t.dataset.ce === "cad") { const r = edr.cadence[+t.dataset.i], j = +t.dataset.j; if (String(r[j] ?? "") !== v) { r[j] = j === 6 && /^\d+$/.test(v) ? +v : v; queue("edr"); } }
    else if (t.dataset.ce === "reg") { const r = edr.register[+t.dataset.i]; if ((r[+t.dataset.j] ?? "") !== v) { r[+t.dataset.j] = v; queue("edr"); } }
  });
  document.addEventListener("paste", (e) => { const t = e.target; if (t.isContentEditable) { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain")); } });
  document.addEventListener("change", (e) => { const t = e.target; if (t.dataset && t.dataset.reg !== undefined) { edr.register[+t.dataset.reg][5] = t.value; queue("edr"); } });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button"); if (!b) return;
    if (b.id === "prt" && view !== "sheet") printView();
    else if (b.id === "rs_add") { const n = doc.stds.length ? +doc.stds[doc.stds.length - 1].sl + 1 : 1; doc.stds.push({ sl: n, activity: "", support: "", evidence: "", trigger: "", acct: "Plant head accountability" }); queue("sheet"); drawRS(); }
    else if (b.id === "rs_del") { if (doc.stds.length && confirm("Remove the last row?")) { doc.stds.pop(); queue("sheet"); drawRS(); } }
    else if (b.id === "reg_add") { edr.register.push(["", "", "", "", "", "", "", ""]); queue("edr"); drawEDR(); }
  });

  /* ================= navigation ================= */
  async function go(v) {
    say(""); view = v; $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === v)); ["std", "sheet", "rs", "edr"].forEach((s) => $("#" + s).classList.toggle("hide", s !== v));
    try {
      if (v === "std") { if (window.KMRStd) KMRStd.draw($("#std"), "dwm", { evidence: stdEvidence() }); return; }
      if (v === "edr") { if (!edr) edr = await getDoc("edr"); if (!edr) { edr = clone(SEED.edr); edr.register = Array.from({ length: 11 }, () => ["", "", "", "", "", "", "", ""]); } drawEDR(); return; }
      await loadMonth(); if (v === "sheet") drawSheet(); else drawRS();
    } catch (e) { say(e.message); }
  }
  function stdEvidence() { return {}; }
  document.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest(".tab[data-t]"); if (t) { e.preventDefault(); try { history.replaceState(null, "", location.pathname + location.search + "#go=" + t.dataset.t); } catch (x) { /* ignore */ } go(t.dataset.t); } });

  (async () => {
    try {
      if (DEMO) { ctx = { role: "admin", company: "Demo Engineering (sample data)" }; $("#co").textContent = ctx.company; $("#role").textContent = "admin"; }
      else { await QP.init("dwm"); if (!QP.ctx) return; ctx = QP.ctx; }
      canEdit = ["admin", "editor"].includes(ctx.role);
      const h = (window.KMRNav && KMRNav.pending() || { go: location.hash.slice(1) }).go; await go(["std", "sheet", "rs", "edr"].includes(h) ? h : "std");
    } catch (e) { say(e.message); }
  })();
})();
