/* HRM & Payroll - employee mobile page (hrm-me.html). Sign in with employee ID + date of birth; own data only.
   Calls kmr_hrms_me_* (database) or hrm-demo.js (?demo=1). Attendance and pay are worked out here with the same rules as the HR screens (hrm-calc.js). */
(function () {
  "use strict";
  const C = window.HRMCalc, qs = new URLSearchParams(location.search), DEMO = qs.has("demo"), slug = (qs.get("co") || "").toLowerCase();
  const $ = (s) => document.querySelector(s), esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ST = { P: "Present", HD: "Half day", A: "Absent", L: "Paid leave", U: "Unpaid leave", WO: "Weekly off", H: "Holiday", MP: "Missed punch" };
  const rs = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (d) => (d ? new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const perName = (p) => MON[+p.slice(5, 7) - 1] + " " + p.slice(0, 4);
  const KEY = "hrme:" + (DEMO ? "demo" : slug);
  const M = { tok: null, sb: null, d: null, period: "", view: "home", name: "", company: "", payPeriod: "", apply: "leave" };

  const say = (m, ok) => { $("#msg").innerHTML = m ? `<div class="${ok ? "ok" : "err"}" role="alert">${esc(m)}</div>` : ""; if (m && ok) setTimeout(() => { if ($("#msg")) $("#msg").innerHTML = ""; }, 3500); if (m) window.scrollTo(0, 0); };
  const getTok = () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } };
  const setTok = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (e) { /* private window: stays signed in until the page closes */ } };

  async function key() {
    const cc = (window.COMPANY_CONFIG || {}).supabaseAnonKey, ok = (k) => /^sb_publishable_|^eyJ/.test(String(k || ""));
    if (cc && ok(cc)) return cc;
    try { const c = sessionStorage.getItem("kmr_pub_key"); if (c) return c; } catch (e) { /* ignore */ }
    const r = await fetch("/it/console/api/public-config"); if (r.ok) { const j = await r.json(); if (j.key && ok(j.key)) { try { sessionStorage.setItem("kmr_pub_key", j.key); } catch (e) { /* ignore */ } return j.key; } }
    throw new Error("This page is not set up yet. Please tell your HR.");
  }
  async function rpc(fn, args) {
    if (DEMO) { const f = (window.QP_DEMO || {})[fn]; if (!f) throw new Error("Not available in the demo."); return f(args || {}); }
    if (!M.sb) { const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"); M.sb = createClient((window.COMPANY_CONFIG || {}).supabaseUrl || "https://dehlcusptkzfhqvpfyjh.supabase.co", await key(), { auth: { persistSession: false, autoRefreshToken: false } }); }
    const { data, error } = await M.sb.rpc(fn, args || {}); if (error) throw new Error(error.message); return data;
  }
  const authFail = (e) => /sign in again/i.test(e.message);

  /* ---------- sign in ---------- */
  function showLogin(msg) {
    M.tok = null; setTok(null); $("#nav").classList.add("hide"); ["home", "att", "pay", "apply"].forEach((v) => $("#v-" + v).classList.add("hide")); $("#login").classList.remove("hide"); $("#who").textContent = ""; say(msg || "");
    if (!slug && !DEMO) say("Please open the link your HR gave you (it has your company in it).");
  }
  $("#lf").onsubmit = async (ev) => {
    ev.preventDefault(); if (!slug && !DEMO) return say("Please open the link your HR gave you (it has your company in it).");
    const b = $("#lgo"); b.disabled = true; b.textContent = "Signing in…"; say("");
    try {
      const r = await rpc("kmr_hrms_me_login", { p_slug: slug, p_code: $("#lc").value, p_dob: $("#ld").value });
      if (!r || !r.ok) throw new Error((r && r.error) || "Could not sign in.");
      M.tok = r.token; setTok(r.token); M.name = r.name; M.company = r.company; $("#lc").value = ""; $("#ld").value = ""; await enter();
    } catch (e) { say(e.message); } finally { b.disabled = false; b.textContent = "Sign in"; }
  };
  async function enter() {
    $("#login").classList.add("hide"); $("#nav").classList.remove("hide");
    M.period = ""; await load(""); go(M.view || "home");
  }
  function signOut() { rpc("kmr_hrms_me_logout", { p_token: M.tok }).catch(() => {}); M.d = null; showLogin(); }

  /* ---------- data and live attendance / pay ---------- */
  async function load(period) {
    try { M.d = await rpc("kmr_hrms_me_data", { p_token: M.tok, p_period: period || null }); } catch (e) { if (authFail(e)) return showLogin("Please sign in again."); throw e; }
    M.period = M.d.period; M.name = M.d.employee.name; M.company = M.d.company; $("#co").textContent = M.company || "My attendance and payslip"; $("#who").textContent = M.name + " · " + M.d.employee.emp_code;
    derive();
  }
  function derive() {
    const d = M.d, emp = d.employee, lt = d.leave_types || [], tz = (d.settings || {}).tz || "Asia/Kolkata";
    const paidOf = (code) => { const t = lt.find((x) => x.code === code); return t ? t.paid !== false : true; };
    const ap = (d.leaves || []).filter((l) => l.status === "Approved");
    const leaves = ap.filter((l) => l.kind !== "permission").map((l) => ({ employee_id: emp.id, from_date: String(l.from_date).slice(0, 10), to_date: String(l.to_date).slice(0, 10), half: l.half, leave_code: l.leave_code, paid: paidOf(l.leave_code) }));
    const permissions = ap.filter((l) => l.kind === "permission").map((l) => ({ employee_id: emp.id, date: String(l.from_date).slice(0, 10), from_time: l.from_time, to_time: l.to_time, minutes: l.minutes }));
    const punches = (d.punches || []).map((p) => ({ employee_id: emp.id, bio_id: emp.bio_id, at: p.at, verify: p.verify, direction: p.direction }));
    const { from, to } = C.monthRange(M.period), last = to > d.today ? d.today : to, byDate = {};
    (d.attendance || []).forEach((r) => { byDate[String(r.work_date).slice(0, 10)] = r; });
    if (last >= from) C.buildAttendance({ employees: [emp], shifts: d.shift ? [d.shift] : [], holidays: d.holidays || [], leaves, permissions, punches, existing: d.attendance || [] }, from, last, d.settings, d.today).rows.forEach((r) => { byDate[r.work_date] = r; });
    M.rows = Object.keys(byDate).sort().map((k) => byDate[k]); M.byDate = byDate; M.tz = tz; M.punches = punches;
    M.sum = C.summary(emp, M.rows, M.period, lt);
    M.est = (+emp.basic || +emp.hra || +emp.special || +emp.other_allow) ? C.payOf(emp, M.sum, M.period, d.settings) : null;
    M.final = ((d.payslips || []).find((x) => x.period === M.period && x.status === "final") || {}).slip || null;
  }
  const tm = (t) => (t ? C.clock(C.local(t, M.tz).min) : "—");

  /* ---------- navigation ---------- */
  function go(v) {
    M.view = v; document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
    ["home", "att", "pay", "apply"].forEach((x) => $("#v-" + x).classList.toggle("hide", x !== v));
    ({ home: drawHome, att: drawAtt, pay: drawPay, apply: drawApply })[v](); window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button").forEach((b) => (b.onclick = async () => { say(""); if (b.dataset.v !== "att" && b.dataset.v !== "pay" && M.period !== M.d.today.slice(0, 7)) { try { await load(""); } catch (e) { say(e.message); } } go(b.dataset.v); }));
  const chip = (s) => `<span class="chip s-${s}">${esc(ST[s] || s)}</span>`;
  const reqChip = (st) => `<span class="chip ${({ Pending: "a", Approved: "g", Rejected: "rr", Cancelled: "x" })[st] || "x"}">${esc(st)}</span>`;

  /* ---------- home ---------- */
  function drawHome() {
    const d = M.d, t = d.today, r = M.byDate[t], s = M.sum, up = (d.holidays || []).filter((h) => String(h.hdate).slice(0, 10) >= t).slice(0, 3);
    const pend = (d.leaves || []).filter((l) => l.status === "Pending");
    $("#v-home").innerHTML = `<div class="card"><h2>Hello, ${esc(d.employee.name.split(" ")[0])}</h2><div class="mut">${esc(d.employee.designation || "")}${d.employee.department ? " · " + esc(d.employee.department) : ""}</div>
      <h3>Today · ${fmt(t)}</h3>${r ? `<div>${chip(r.status)} ${r.in_at ? `<span class="mut">In ${tm(r.in_at)}${r.out_at ? " · Out " + tm(r.out_at) : " · not punched out yet"}</span>` : ""}</div>${+r.late_min > 0 ? `<div class="mut">Late by ${r.late_min} min</div>` : ""}` : `<div class="mut">No punch yet today.</div>`}</div>
      <div class="card"><h2>${perName(M.period)} so far</h2><div class="kv"><div><span>Days present</span><b>${s.present + s.hd * 0.5}</b></div><div><span>Absent</span><b>${s.absent + s.missed}</b></div><div><span>Late days</span><b>${s.late_count}</b></div><div><span>Overtime hours</span><b>${(s.ot_min / 60).toFixed(1)}</b></div></div>
        ${M.est ? `<h3>Salary so far (estimate)</h3><div class="big">₹ ${rs(M.est.net)}</div><div class="mut">Worked out live from your punches; it changes as you punch. The final salary is what HR confirms in your payslip.</div>` : ""}</div>
      ${pend.length ? `<div class="card"><h2>Waiting for approval</h2>${pend.map((l) => `<div class="day"><div class="i"><b>${l.kind === "permission" ? "Permission" : esc(l.leave_code || "Leave")}</b> · ${fmt(l.from_date)}${l.kind === "permission" ? " " + esc(l.from_time) + "–" + esc(l.to_time) : +l.days > 1 || String(l.from_date).slice(0, 10) !== String(l.to_date).slice(0, 10) ? " to " + fmt(l.to_date) : ""}</div>${reqChip(l.status)}</div>`).join("")}</div>` : ""}
      ${up.length ? `<div class="card"><h2>Next holidays</h2>${up.map((h) => `<div class="day"><div class="d"><b>${+String(h.hdate).slice(8, 10)}</b><span>${MON[+String(h.hdate).slice(5, 7) - 1].slice(0, 3)}</span></div><div class="i">${esc(h.name)}<div class="mut">${WD[C.dow(String(h.hdate).slice(0, 10))]}</div></div></div>`).join("")}</div>` : ""}
      <div style="text-align:center"><button class="btn o s" id="so">Sign out</button></div>`;
    $("#so").onclick = signOut;
  }

  /* ---------- attendance ---------- */
  function drawAtt() {
    const d = M.d, s = M.sum, pm = {}; (M.punches || []).forEach((p) => { const k = C.local(p.at, M.tz).date; (pm[k] = pm[k] || []).push(p.at); });
    const days = M.rows.filter((r) => r.work_date <= d.today).slice().reverse();
    $("#v-att").innerHTML = `<div class="card"><label for="am" style="margin-top:0">Month</label><input type="month" id="am" value="${M.period}" max="${d.today.slice(0, 7)}">
      <div class="kv" style="margin-top:10px"><div><span>Paid days</span><b>${s.paid_days}</b></div><div><span>Present</span><b>${s.present}</b></div><div><span>Half days</span><b>${s.hd}</b></div><div><span>Absent</span><b>${s.absent + s.missed}</b></div><div><span>Leave</span><b>${s.paid_leave + s.unpaid_leave}</b></div><div><span>Overtime h</span><b>${(s.ot_min / 60).toFixed(1)}</b></div></div></div>
      <div class="card">${days.length ? days.map((r) => `<div class="day"><div class="d"><b>${+r.work_date.slice(8)}</b><span>${WD[C.dow(r.work_date)]}</span></div><div class="i">${chip(r.status)}${r.in_at ? ` <span class="mut">${tm(r.in_at)} – ${r.out_at ? tm(r.out_at) : "…"}</span>` : ""}${+r.late_min > 0 ? `<div class="mut">Late ${r.late_min} min</div>` : ""}${+r.ot_min > 0 ? `<div class="mut">Overtime ${(r.ot_min / 60).toFixed(1)} h</div>` : ""}${r.remarks ? `<div class="mut">${esc(r.remarks)}</div>` : ""}${(pm[r.work_date] || []).length > 2 ? `<div class="mut">Punches: ${pm[r.work_date].map(tm).join(", ")}</div>` : ""}</div></div>`).join("") : `<div class="mut">No attendance for this month yet.</div>`}</div>`;
    $("#am").onchange = async () => { const v = $("#am").value; if (!v) return; try { await load(v); drawAtt(); } catch (e) { say(e.message); } };
  }

  /* ---------- payslips ---------- */
  function lastMonths() { const t = M.d.today.slice(0, 7), out = [t]; for (let i = 1; i < 6; i++) { const y = +t.slice(0, 4), m = +t.slice(5, 7) - i, dt = new Date(Date.UTC(y, m - 1, 1)); out.push(dt.toISOString().slice(0, 7)); } return out; }
  async function drawPay() {
    const d = M.d, cur = d.today.slice(0, 7); if (!M.payPeriod) M.payPeriod = cur;
    if (M.period !== M.payPeriod) { try { await load(M.payPeriod); } catch (e) { return say(e.message); } }
    const emp = d.employee = M.d.employee, slip = M.final || M.est, isFinal = !!M.final, e = M.d.employee, i = (slip && slip.info) || {}, s = M.sum;
    const emps = lastMonths();
    $("#v-pay").innerHTML = `<div class="card noprint"><label for="pp" style="margin-top:0">Month</label><select id="pp">${emps.map((m) => `<option value="${m}"${m === M.payPeriod ? " selected" : ""}>${perName(m)}${m === cur ? " (this month, live)" : ""}</option>`).join("")}</select></div>
      ${slip ? `<div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">Payslip · ${perName(M.payPeriod)}</h2><span class="chip ${isFinal ? "g" : "a"}">${isFinal ? "Final" : "Estimate"}</span></div>
        ${isFinal ? "" : `<div class="mut" style="margin-top:4px">${M.payPeriod === cur ? "Worked out live from your punches so far. It changes as you punch." : "HR has not finalised this month yet. This is worked out from your attendance and may change."}</div>`}
        <div class="kv" style="margin-top:10px"><div><span>Name</span><b>${esc(e.name)}</b></div><div><span>Employee ID</span><b>${esc(e.emp_code)}</b></div><div><span>Designation</span><b>${esc(e.designation || "—")}</b></div><div><span>Department</span><b>${esc(e.department || "—")}</b></div><div><span>Date of joining</span><b>${fmt(e.doj)}</b></div><div><span>Bank account</span><b>${e.bank_last4 ? "•••• " + esc(e.bank_last4) : "—"}</b></div></div>
        <h3>Days</h3><div class="kv"><div><span>Days in month</span><b>${i.month_days || C.monthDays(M.payPeriod)}</b></div><div><span>Days paid</span><b>${+slip.paid_days}</b></div><div><span>Days present</span><b>${i.present != null ? i.present : i.days_worked != null ? i.days_worked : s.present}</b></div><div><span>${isFinal || M.payPeriod < cur ? "Absent / loss of pay" : "Absent so far"}</span><b>${isFinal || M.payPeriod < cur ? +slip.lop_days : s.absent + s.missed + s.unpaid_leave}</b></div>${i.holidays != null ? `<div><span>Holidays</span><b>${i.holidays}</b></div><div><span>Weekly offs</span><b>${i.weekly_off || 0}</b></div>` : ""}<div><span>Overtime hours</span><b>${+slip.ot_hours || 0}</b></div></div>
        <h3>Earnings</h3><table>${(slip.earnings || []).map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${rs(x.amount)}</td></tr>`).join("")}<tr><td><b>Gross</b></td><td class="n"><b>${rs(slip.gross)}</b></td></tr></table>
        <h3>Deductions</h3>${(slip.deductions || []).length ? `<table>${slip.deductions.map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${rs(x.amount)}</td></tr>`).join("")}<tr><td><b>Total deductions</b></td><td class="n"><b>${rs(slip.deduct)}</b></td></tr></table>` : `<div class="mut">None</div>`}
        ${i.round_off ? `<div class="mut" style="margin-top:6px">Rounded off: ${rs(i.round_off)}</div>` : ""}
        <div style="margin-top:12px;background:var(--bg);border-radius:12px;padding:12px;display:flex;justify-content:space-between;align-items:center"><b>Net pay</b><span class="big">₹ ${rs(slip.net)}</span></div>
        <div class="noprint" style="margin-top:12px"><button class="btn o w" id="pr">Print / save as PDF</button></div></div>`
      : `<div class="card"><div class="mut">No salary is set for you yet. Please ask your HR.</div></div>`}`;
    $("#pp").onchange = async () => { M.payPeriod = $("#pp").value; try { await load(M.payPeriod); drawPay(); } catch (e) { say(e.message); } };
    if ($("#pr")) $("#pr").onclick = () => window.print();
  }

  /* ---------- apply leave / permission ---------- */
  function drawApply() {
    const d = M.d, t = d.today, types = d.leave_types || [], yr = t.slice(0, 4), lv = d.leaves || [], used = (code) => lv.filter((l) => l.leave_code === code && l.status === "Approved" && String(l.from_date).slice(0, 4) === yr && l.kind !== "permission").reduce((a, l) => a + +l.days, 0);
    $("#v-apply").innerHTML = `<div class="card"><div class="seg"><button class="btn ${M.apply === "leave" ? "" : "o"}" id="sl">Leave</button><button class="btn ${M.apply === "perm" ? "" : "o"}" id="sp">Permission</button></div>
      ${M.apply === "leave" ? `<form id="lf2"><label for="at">Leave type</label><select id="at" required>${types.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}${x.paid ? "" : " (unpaid)"}</option>`).join("")}</select>
        <label for="af">From</label><input type="date" id="af" value="${t}" required><label for="ato">To</label><input type="date" id="ato" value="${t}" required>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ah" style="width:auto"> Half day</label><label for="ar">Reason</label><input id="ar" maxlength="200" placeholder="optional">
        <div style="margin-top:14px"><button class="btn w" id="ago" type="submit">Send leave request</button></div></form>`
      : `<form id="pf2"><div class="mut">A few hours off inside a working day (for example bank, doctor, school).</div><label for="pd">Date</label><input type="date" id="pd" value="${t}" required><label for="pfr">From time</label><input type="time" id="pfr" value="10:00" required><label for="pto">To time</label><input type="time" id="pto" value="11:00" required>
        <label for="pre">Reason</label><input id="pre" maxlength="200" placeholder="optional"><div style="margin-top:14px"><button class="btn w" id="pgo" type="submit">Send permission request</button></div></form>`}</div>
      ${types.some((x) => +x.annual_quota) ? `<div class="card"><h2>Leave balance · ${yr}</h2><table>${types.filter((x) => +x.annual_quota).map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${used(x.code)} used of ${+x.annual_quota}</td></tr>`).join("")}</table></div>` : ""}
      <div class="card"><h2>My requests</h2>${lv.length ? lv.map((l) => `<div class="day"><div class="i"><b>${l.kind === "permission" ? "Permission" : esc(l.leave_code || "Leave")}</b>${l.half ? " (half day)" : ""}<div class="mut">${fmt(l.from_date)}${l.kind === "permission" ? " · " + esc(l.from_time) + "–" + esc(l.to_time) : String(l.from_date).slice(0, 10) !== String(l.to_date).slice(0, 10) ? " to " + fmt(l.to_date) : ""}${l.reason ? " · " + esc(l.reason) : ""}</div></div><div style="text-align:right">${reqChip(l.status)}${l.status === "Pending" ? `<div><button class="btn o s" data-c="${esc(l.id)}" style="margin-top:4px">Cancel</button></div>` : ""}</div></div>`).join("") : `<div class="mut">No requests yet.</div>`}</div>`;
    $("#sl").onclick = () => { M.apply = "leave"; drawApply(); }; $("#sp").onclick = () => { M.apply = "perm"; drawApply(); };
    const done = async (fn, args, ok) => { try { await rpc(fn, args); await load(""); say(ok, true); drawApply(); } catch (e) { if (authFail(e)) return showLogin("Please sign in again."); say(e.message); } };
    if ($("#lf2")) $("#lf2").onsubmit = (ev) => { ev.preventDefault(); done("kmr_hrms_me_leave_apply", { p_token: M.tok, p: { leave_type_id: $("#at").value, from_date: $("#af").value, to_date: $("#ato").value, half: $("#ah").checked, reason: $("#ar").value } }, "Leave request sent. You will see the decision here."); };
    if ($("#pf2")) $("#pf2").onsubmit = (ev) => { ev.preventDefault(); done("kmr_hrms_me_perm_apply", { p_token: M.tok, p: { pdate: $("#pd").value, from_time: $("#pfr").value, to_time: $("#pto").value, reason: $("#pre").value } }, "Permission request sent. You will see the decision here."); };
    document.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { if (confirm("Cancel this request?")) done("kmr_hrms_me_cancel", { p_token: M.tok, p_id: b.dataset.c }, "Request cancelled."); }));
  }

  (async () => {
    M.tok = getTok();
    if (M.tok) { try { await enter(); return; } catch (e) { /* fall through to sign in */ } }
    showLogin();
  })();
})();
