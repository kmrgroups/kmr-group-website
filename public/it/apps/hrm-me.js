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
  const M = { logo: "", brandName: "", tok: null, sb: null, d: null, period: "", view: "home", name: "", company: "", payPeriod: "", apply: "leave" };

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
  /* company logo and name for the header (same public brand the portal uses) */
  const initials = (n) => String(n || "K").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const coName = (c) => { const p = String(c || "").split(/\s+[–-]\s+/); return p.length === 2 && p[0].trim().toLowerCase() === p[1].trim().toLowerCase() ? p[1].trim() : String(c || "").trim(); };   // "X – X" shown once
  function drawLogo() {
    const el = $("#clogo"), nm = coName(M.company) || M.brandName; if (!el) return;
    el.innerHTML = M.logo ? `<img src="${esc(M.logo)}" alt="${esc(nm)}">` : esc(initials(nm));
    const im = el.querySelector("img"); if (im) im.onerror = () => { M.logo = ""; el.textContent = initials(nm); };
    el.hidden = false;
  }
  async function brand() {
    if (!slug) return drawLogo();
    try { const b = await rpc("kmr_portal_brand", { p_slug: slug }), r = Array.isArray(b) ? b[0] : b; if (r) { M.logo = r.logo_url || ""; M.brandName = r.name || ""; } } catch (e) { /* no brand: the company initials are shown */ }
    if (!$("#co").dataset.set) $("#co").textContent = M.brandName || "My attendance and payslip";
    drawLogo();
  }
  const authFail = (e) => /sign in again/i.test(e.message);

  /* ---------- sign in ---------- */
  function showLogin(msg) {
    M.tok = null; setTok(null); $("#nav").classList.add("hide"); ["home", "att", "pay", "apply", "me"].forEach((v) => $("#v-" + v).classList.add("hide")); $("#login").classList.remove("hide"); $("#who").textContent = ""; $("#v-me").classList.add("hide"); say(msg || "");
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
    M.period = M.d.period; M.name = M.d.employee.name; M.company = M.d.company; $("#co").textContent = coName(M.company) || M.brandName || "My attendance and payslip"; $("#co").dataset.set = "1"; $("#who").innerHTML = `<b>${esc(M.name)}</b><span>ID: ${esc(M.d.employee.emp_code)}</span>`; drawLogo();
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
    const isLocked = (Array.isArray(d.locked) ? d.locked : []).includes(M.period);
    (d.attendance || []).forEach((r) => { byDate[String(r.work_date).slice(0, 10)] = Object.assign({}, r); });
    /* same as the HR screens: days worked out from punches replace the saved ones, except days HR entered by hand and finalised months */
    if (!isLocked && last >= from) C.buildAttendance({ employees: [emp], shifts: d.shift ? [d.shift] : [], holidays: d.holidays || [], leaves, permissions, punches, existing: d.attendance || [], roster: d.roster || [] }, from, last, d.settings, d.today).rows.forEach((r) => { const o = byDate[r.work_date]; if (!o || o.source !== "manual") byDate[r.work_date] = r; });
    /* holidays and weekly offs: hours worked on them are all overtime, and a day wrongly absent on one is a holiday / weekly off (the HR Hours sheet does the same) */
    const fixed = C.holFix({ attendance: Object.keys(byDate).map((k) => byDate[k]) }, { employees: [emp], shifts: d.shift ? [d.shift] : [], holidays: d.holidays || [], roster: d.roster || [], today: d.today, shiftOf: () => d.shift || null }, from, last);
    Object.keys(byDate).forEach((k) => delete byDate[k]); fixed.attendance.forEach((r) => { byDate[String(r.work_date).slice(0, 10)] = r; });
    M.rows = Object.keys(byDate).sort().map((k) => byDate[k]); M.byDate = byDate; M.tz = tz; M.punches = punches;
    M.sum = C.summary(emp, M.rows, M.period, lt);
    /* hours the same way as the HR Hours sheet: working hours + overtime hours, days worked = days with hours */
    const h = { wd: 0, reg: 0, ot: 0 }; M.rows.forEach((r) => { const w = +r.worked_min || 0, o = Math.min(+r.ot_min || 0, w); if (w > 0) { h.reg += w - o; h.ot += o; h.wd++; } }); M.hrs = h;
    const nt = M.byDate[d.today]; M.notYet = !!(nt && nt.status === "A" && !nt.in_at && nt.source !== "manual" && M.period === d.today.slice(0, 7));   // today, nobody punched yet: not absent
    if (M.notYet) M.sum.absent = Math.max(0, M.sum.absent - 1);
    M.est = (+emp.basic || +emp.hra || +emp.special || +emp.other_allow) ? C.payOf(emp, M.sum, M.period, d.settings) : null;
    M.final = ((d.payslips || []).find((x) => x.period === M.period && x.status === "final") || {}).slip || null;
  }
  const hh = (m) => (m / 60).toFixed(1).replace(/\.0$/, "");
  const tile = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  const dayChip = (r) => (r.work_date === M.d.today && M.notYet && r.status === "A" ? `<span class="chip s-WO">Not in yet</span>` : chip(r.status));
  const tm = (t) => (t ? C.clock(C.local(t, M.tz).min) : "—");

  /* ---------- navigation ---------- */
  function go(v) {
    M.view = v; document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
    ["home", "att", "pay", "apply", "me"].forEach((x) => $("#v-" + x).classList.toggle("hide", x !== v));
    ({ home: drawHome, att: drawAtt, pay: drawPay, apply: drawApply, me: drawMe })[v](); window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button").forEach((b) => (b.onclick = async () => { say(""); if (b.dataset.v !== "att" && b.dataset.v !== "pay" && M.period !== M.d.today.slice(0, 7)) { try { await load(""); } catch (e) { say(e.message); } } go(b.dataset.v); }));
  const chip = (s) => `<span class="chip s-${s}">${esc(ST[s] || s)}</span>`;
  const reqChip = (st) => `<span class="chip ${({ Pending: "a", Approved: "g", Rejected: "rr", Cancelled: "x" })[st] || "x"}">${esc(st)}</span>`;

  /* ---------- home ---------- */
  function drawHome() {
    const d = M.d, t = d.today, r = M.byDate[t], s = M.sum, up = (d.holidays || []).filter((h) => String(h.hdate).slice(0, 10) >= t).slice(0, 3);
    const pend = (d.leaves || []).filter((l) => l.status === "Pending");
    $("#v-home").innerHTML = `<div class="card"><h2>Hello, ${esc(d.employee.name.split(" ")[0])}</h2><div class="mut">${esc(d.employee.designation || "")}${d.employee.department ? " · " + esc(d.employee.department) : ""}</div>
      <div class="mut">Employee ID: <b>${esc(d.employee.emp_code)}</b></div>
      <h3>Today · ${fmt(t)}</h3>${r ? `<div>${dayChip(r)} ${r.in_at ? `<span class="mut">In ${tm(r.in_at)}${r.out_at ? " · Out " + tm(r.out_at) : " · not punched out yet"}</span>` : ""}</div>${+r.late_min > 0 ? `<div class="mut">Late by ${r.late_min} min</div>` : ""}` : `<div class="mut">No punch yet today.</div>`}</div>
      <div class="card"><h2>${perName(M.period)} so far</h2><div class="kv">${tile("Days worked", M.hrs.wd)}${tile("Absent", s.absent)}${tile("Missed punch", s.missed)}${tile("Late days", s.late_count)}${tile("Working hours", hh(M.hrs.reg))}${tile("Overtime (OT) hours", hh(M.hrs.ot))}</div>
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
      <div class="kv" style="margin-top:10px">${tile("Days worked", M.hrs.wd)}${tile("Paid days", s.paid_days)}${tile("Present", s.present)}${tile("Half days", s.hd)}${tile("Absent", s.absent)}${tile("Missed punch", s.missed)}${tile("Leave", s.paid_leave + s.unpaid_leave)}${tile("Late days", s.late_count)}${tile("Working hours", hh(M.hrs.reg))}${tile("Overtime (OT) hours", hh(M.hrs.ot))}</div></div>
      <div class="card">${days.length ? days.map((r) => `<div class="day"><div class="d"><b>${+r.work_date.slice(8)}</b><span>${WD[C.dow(r.work_date)]}</span></div><div class="i">${dayChip(r)}${r.in_at ? ` <span class="mut">${tm(r.in_at)} – ${r.out_at ? tm(r.out_at) : "…"}</span>` : ""}${+r.late_min > 0 ? `<div class="mut">Late ${r.late_min} min</div>` : ""}${+r.worked_min > 0 ? `<div class="mut">Working ${hh(+r.worked_min - Math.min(+r.ot_min || 0, +r.worked_min))} h${+r.ot_min > 0 ? " · Overtime (OT) " + hh(Math.min(+r.ot_min, +r.worked_min)) + " h" : ""}</div>` : ""}${r.remarks ? `<div class="mut">${esc(String(r.remarks).replace(/enter the missing punch/i, "ask HR to add the missing punch"))}</div>` : ""}${(pm[r.work_date] || []).length > 2 ? `<div class="mut">Punches: ${pm[r.work_date].map(tm).join(", ")}</div>` : ""}</div></div>`).join("") : `<div class="mut">No attendance for this month yet.</div>`}</div>`;
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
    if ($("#pr")) $("#pr").onclick = () => {   // the printed payslip gets the company logo top left, reference number and format / revision footer (kmr-report.js)
      let set = false; try { if (!localStorage.getItem("kmr-portal") && (M.logo || M.brandName)) { localStorage.setItem("kmr-portal", JSON.stringify({ slug, name: coName(M.company) || M.brandName, logo: M.logo || null })); set = true; } } catch (e) { /* ignore */ }
      if (set) window.addEventListener("afterprint", () => { try { localStorage.removeItem("kmr-portal"); } catch (e) { /* ignore */ } }, { once: true });
      window.print();
    };
  }

  /* ---------- my record (read only) ---------- */
  function drawMe() {
    const d = M.d, e = d.employee, sh = d.shift, yn = (v) => (v ? "Yes" : "No"), DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const row = (k, v) => `<div class="rec"><span>${k}</span><b>${v == null || v === "" ? "—" : esc(v)}</b></div>`;
    const hm = (t) => String(t || "").slice(0, 5), money = (v) => (+v ? "₹ " + rs(v) : "—");
    const acct = e.bank_account ? "•••• " + String(e.bank_account).slice(-4) : e.bank_last4 ? "•••• " + e.bank_last4 : "";
    const gross = (+e.basic || 0) + (+e.hra || 0) + (+e.special || 0) + (+e.other_allow || 0), hasPay = gross > 0;
    $("#v-me").innerHTML = `<div class="card" style="text-align:center"><div class="clogo big" id="mlogo"></div><h2 style="margin:8px 0 2px">${esc(e.name)}</h2><div><span class="chip s-P">Employee ID: ${esc(e.emp_code)}</span></div>
        <div class="mut" style="margin-top:6px">${esc(e.designation || "")}${e.designation && e.department ? " · " : ""}${esc(e.department || "")}</div></div>
      <div class="card"><h2>Personal</h2>${row("Name", e.name)}${row("Employee ID", e.emp_code)}${row("Gender", e.gender)}${row("Date of birth", e.dob ? fmt(e.dob) : "")}${row("Mobile", e.mobile)}${row("E-mail", e.email)}</div>
      <div class="card"><h2>Job</h2>${row("Company", coName(M.company))}${row("Department", e.department)}${row("Designation", e.designation)}${row("Grade", e.grade)}${row("Date of joining", e.doj ? fmt(e.doj) : "")}${e.dol ? row("Date of leaving", fmt(e.dol)) : ""}${row("Status", e.status === "left" ? "Left" : "Active")}
        ${row("Shift", sh ? sh.name + " (" + hm(sh.start_time) + " – " + hm(sh.end_time) + ")" : "")}${sh && Array.isArray(sh.weekly_off) ? row("Weekly off", sh.weekly_off.map((x) => DN[x]).join(", ")) : ""}${row("Biometric (machine) ID", e.bio_id)}${row("Overtime (OT) eligible", yn(e.ot_eligible))}${row("Attendance bonus eligible", yn(e.bonus_eligible))}</div>
      <div class="card"><h2>Statutory</h2>${row("UAN (Universal Account Number)", e.uan)}${row("ESI (Employees' State Insurance) number", e.esi_no)}${row("PAN (Permanent Account Number)", e.pan)}${row("Provident fund (PF)", yn(e.pf))}${row("Employees' State Insurance (ESI)", yn(e.esi))}${row("Professional tax (PT)", yn(e.pt))}</div>
      <div class="card"><h2>Bank</h2>${row("Bank", e.bank_name)}${row("Account number", acct)}${row("IFSC (Indian Financial System Code)", e.ifsc)}</div>
      ${hasPay ? `<div class="card"><h2>Salary structure (per ${e.pay_type === "daily" ? "day" : "month"})</h2>${row("Basic", money(e.basic))}${row("HRA (House Rent Allowance)", money(e.hra))}${row("Special allowance", money(e.special))}${row("Other allowance", money(e.other_allow))}<div class="rec"><span><b>Gross</b></span><b>${money(gross)}</b></div></div>` : ""}
      <div class="card mut">This is your record as your HR holds it. You can only view it here. If anything is wrong, please ask your HR to correct it.</div>`;
    const ml = $("#mlogo"), nm = coName(M.company) || M.brandName; ml.innerHTML = M.logo ? `<img src="${esc(M.logo)}" alt="${esc(nm)}">` : esc(initials(nm)); const im = ml.querySelector("img"); if (im) im.onerror = () => { ml.textContent = initials(nm); };
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
    brand();
    M.tok = getTok();
    if (M.tok) { try { await enter(); return; } catch (e) { /* fall through to sign in */ } }
    showLogin();
  })();
})();
