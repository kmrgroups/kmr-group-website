/* HRM & Payroll - screens. Data calls are kmr_hrms_* (database) or hrm-demo.js (?demo=1).
   Attendance and pay are worked out by hrm-calc.js in the browser and stored by the database. */
(function () {
  "use strict";
  const { $, esc, iso, today, fmt, say, call } = QP, C = window.HRMCalc;
  const S = { load: null, att: null, month: "", payPeriod: "", devFrom: "", devTo: "", leaveYear: "", leaves: null, pay: null };
  const ed = () => QP.canEdit, money = () => !!(S.load && S.load.money), hasF = (k) => !window.KMRLock || KMRLock.has(k), isAdmin = () => QP.ctx && QP.ctx.role === "admin";
  const cfg = () => C.cfg(S.load && S.load.settings), tz = () => cfg().tz;
  const open = (h) => { $("#mb").innerHTML = h; $("#m").classList.add("on"); }, closeM = () => $("#m").classList.remove("on");
  $("#m").addEventListener("click", (e) => { if (e.target.id === "m") closeM(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeM(); });
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => (Array.isArray(x) ? `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>` : `<option${x === sel ? " selected" : ""}>${esc(x)}</option>`)).join("");
  const rs = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rs0 = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const tm = (t) => (t ? C.clock(C.local(t, tz()).min) : "");
  const dtm = (t) => (t ? fmt(C.local(t, tz()).date) + " " + tm(t) : "—");
  const ago = (t) => { if (!t) return "never"; const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " days ago"; };
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const perName = (p) => MON[+p.slice(5, 7) - 1] + " " + p.slice(0, 4);
  const ST = { P: "Present", HD: "Half day", A: "Absent", L: "Paid leave", U: "Unpaid leave", WO: "Weekly off", H: "Holiday", MP: "Missed punch" };
  const stChip = (s) => `<span class="chip s-${s}" style="background:none"><span class="s-${s}" style="padding:2px 9px;border-radius:99px;font-weight:700;font-size:11px">${esc(ST[s] || s)}</span></span>`;
  const hashGo = () => { const m = location.hash.match(/go=([a-z]+)/); return m ? m[1] : "std"; };
  const empName = (id) => { const e = ((S.load || {}).employees || []).find((x) => x.id === id); return e ? e.name : ""; };
  const shiftOf = (e) => ((S.load || {}).shifts || []).find((s) => s.id === e.shift_id);
  const yes = (v) => /^(y|yes|true|1|x)$/i.test(String(v || "").trim());
  const dl = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const csvCell = (v) => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  function parseCsv(text) {                                                                           // quoted fields, commas or tabs
    const first = String(text || "").split(/\r?\n/)[0] || "", d = first.includes("\t") ? "\t" : ",", out = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim() !== "")) out.push(row); row = []; } else cur += c; }
    row.push(cur); if (row.some((x) => x.trim() !== "")) out.push(row); return out.map((r) => r.map((x) => x.trim()));
  }
  const pickFile = (accept, cb) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(String(r.result), f.name); r.readAsText(f); }; i.click(); };
  /* HH:MM on a date in the company's time zone -> the instant */
  function atLocal(date, hhmm) {
    const m = C.hhmm(hhmm); if (m == null) return null; let t = Date.parse(date + "T00:00:00Z") + m * 6e4;
    for (let i = 0; i < 3; i++) { const l = C.local(t, tz()), diff = (C.dnum(date) - C.dnum(l.date)) * 1440 + (m - l.min); if (!diff) break; t += diff * 6e4; }
    return new Date(t).toISOString();
  }
  const words = (n) => {                                                                                // Indian numbering
    const a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"], b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "")), three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
    n = Math.round(n); if (n <= 0) return "zero"; const parts = []; const cr = Math.floor(n / 1e7), lk = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
    if (cr) parts.push(three(cr) + " crore"); if (lk) parts.push(two(lk) + " lakh"); if (th) parts.push(two(th) + " thousand"); if (rest) parts.push(three(rest)); return parts.join(" ");
  };

  async function loadAll() { S.load = await call("kmr_hrms_load"); }
  const tabsSetup = () => { const t = document.querySelector('.tab[data-t="pay"]'); if (t) t.style.display = money() ? "" : "none"; };
  const activeEmps = () => S.load.employees.filter((e) => e.status !== "left");

  /* ================= router ================= */
  const SECTIONS = ["std", "dash", "emp", "att", "dev", "leave", "pay", "setup"];
  async function route() {
    let go = hashGo();
    if (window.KMRLock && KMRLock.locked(go)) { KMRLock.dialog(go); go = "std"; history.replaceState(null, "", location.pathname + location.search + "#go=std"); }
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    SECTIONS.forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    if (go === "std") { KMRStd.draw($("#std"), "hrms"); return; }
    try {
      await loadAll(); tabsSetup();
      if (go === "pay" && !money()) { say("Payroll is for editors and administrators."); return; }
      ({ dash: drawDash, emp: drawEmp, att: drawAtt, dev: drawDev, leave: drawLeave, pay: drawPay, setup: drawSetup })[go]();
    } catch (e) { say(e.message); }
  }
  document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#go="]'); if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); history.replaceState(null, "", location.pathname + location.search + a.getAttribute("href")); route(); window.scrollTo(0, 0); });
  window.addEventListener("hashchange", route);
  const refresh = () => route();

  /* attendance worked out live from punches (for today's view, month previews and payroll) */
  async function getAtt(from, to) {
    const A = await call("kmr_hrms_att_get", { p_from: from, p_to: to }); S.att = A; return A;
  }
  function buildFrom(A, from, to) {
    const L = S.load, leaves = (A.leaves || []);
    return C.buildAttendance({ employees: L.employees, shifts: L.shifts, holidays: L.holidays, leaves, punches: A.punches, existing: A.attendance }, from, to, L.settings, L.today);
  }
  const merge = (A, built) => { const have = {}; A.attendance.forEach((r) => { have[r.employee_id + "|" + String(r.work_date).slice(0, 10)] = r; }); const out = A.attendance.slice(); built.forEach((r) => { if (!have[r.employee_id + "|" + r.work_date]) out.push(r); }); return out; };

  /* ================= dashboard ================= */
  async function drawDash() {
    const L = S.load, t = L.today, el = $("#dash"), emps = activeEmps();
    let rows = [], unknown = {}, A = null;
    if (hasF("hrms.attendance")) {
      try { A = await getAtt(C.addDays(t, -1), t); const b = buildFrom(A, C.addDays(t, -1), t); unknown = b.unknown; rows = merge(A, b.rows).filter((r) => r.work_date === t); } catch (e) { say(e.message); }
    }
    const by = {}; rows.forEach((r) => { by[r.employee_id] = r; });
    const notIn = (r) => !r || (r.status === "A" && r.source === "rule");
    const pres = emps.filter((e) => by[e.id] && ["P", "HD", "MP"].includes(by[e.id].status)), late = pres.filter((e) => by[e.id].late_min > 0), onl = emps.filter((e) => by[e.id] && ["L", "U"].includes(by[e.id].status)), off = emps.filter((e) => by[e.id] && ["WO", "H"].includes(by[e.id].status));
    const dev = L.devices, online = dev.filter((d) => d.enabled && d.last_seen && Date.now() - new Date(d.last_seen) < 15 * 6e4);
    const pend = S.leaves ? S.leaves.filter((l) => l.status === "Pending").length : null;
    const alerts = [];
    const noBio = emps.filter((e) => !e.bio_id); if (dev.length && noBio.length) alerts.push(`${noBio.length} employee(s) have no Biometric ID, so their punches cannot be matched: ${noBio.slice(0, 5).map((e) => esc(e.name)).join(", ")}${noBio.length > 5 ? "…" : ""}. <a href="#go=emp">Employees</a>`);
    const uk = Object.keys(unknown); if (uk.length) alerts.push(`Punches from ID ${uk.slice(0, 6).map(esc).join(", ")}${uk.length > 6 ? "…" : ""} do not match any employee. Set the Biometric ID on the person, or delete those punches. <a href="#go=dev">Machines</a>`);
    const noShift = emps.filter((e) => !e.shift_id); if (noShift.length) alerts.push(`${noShift.length} employee(s) have no shift; the first active shift is used for them.`);
    dev.filter((d) => d.enabled && d.protocol !== "file" && (!d.last_seen || Date.now() - new Date(d.last_seen) > 24 * 36e5)).forEach((d) => alerts.push(`Machine “${esc(d.name)}” has not been heard from ${d.last_seen ? "since " + ago(d.last_seen) : "yet"}. <a href="#go=dev">Check the connection</a>`));
    el.innerHTML = `<div class="kpis">
      <div class="kpi"><b>${emps.length}</b><span>Active employees</span></div>
      <div class="kpi" style="--c:var(--g)"><b>${hasF("hrms.attendance") ? pres.length : "—"}</b><span>In today</span></div>
      <div class="kpi" style="--c:var(--a)"><b>${hasF("hrms.attendance") ? late.length : "—"}</b><span>Late today</span></div>
      <div class="kpi" style="--c:var(--r)"><b>${hasF("hrms.attendance") ? emps.filter((e) => notIn(by[e.id]) && !off.includes(e)).length - onl.filter((e) => notIn(by[e.id])).length : "—"}</b><span>Not in yet / absent</span></div>
      <div class="kpi" style="--c:#2563eb"><b>${onl.length}</b><span>On leave</span></div>
      <div class="kpi" style="--c:#0d9488"><b>${hasF("hrms.biometric-machines") ? online.length + " / " + dev.length : "—"}</b><span>Machines online</span></div></div>
      ${alerts.length ? `<div class="guide">${alerts.map((a) => `<div>⚠ ${a}</div>`).join("")}</div>` : ""}
      ${off.length === emps.length && emps.length ? `<div class="empty">Today (${fmt(t)}) is a weekly off or holiday.</div>` : ""}
      ${emps.length ? (hasF("hrms.attendance") ? `<h3 style="margin:10px 0 6px">Today · ${fmt(t)}</h3><table><thead><tr><th>Employee</th><th>Shift</th><th>In</th><th>Out</th><th>Late (min)</th><th>Status</th></tr></thead><tbody>${emps.map((e) => { const r = by[e.id], s = shiftOf(e); return `<tr><td>${esc(e.name)}<div class="mut">${esc(e.emp_code)} · ${esc(e.department || "")}</div></td><td>${esc(s ? s.name : "—")}</td><td>${tm(r && r.in_at) || "—"}</td><td>${tm(r && r.out_at) || "—"}</td><td class="num">${r && r.late_min ? `<span class="late">${r.late_min}</span>` : ""}</td><td>${r ? (notIn(r) ? '<span class="mut">Not in yet</span>' : stChip(r.status)) : "—"}</td></tr>`; }).join("")}</tbody></table>` : `<div class="lock">Attendance is not part of your plan.</div>`)
        : `<div class="empty">No employees yet.<br>Add them in <a href="#go=emp">Employees</a>, set the shifts in <a href="#go=setup">Setup</a>, and connect the machines in <a href="#go=dev">Machines</a>.</div>`}`;
    if (hasF("hrms.leave") && pend == null) { try { S.leaves = await call("kmr_hrms_leaves", { p_year: +t.slice(0, 4) }); const n = S.leaves.filter((l) => l.status === "Pending").length; if (n) el.insertAdjacentHTML("afterbegin", `<div class="guide">⏳ ${n} leave request(s) are waiting for a decision. <a href="#go=leave">Leave</a></div>`); } catch (e) { /* ignore */ } }
  }

  /* ================= employees ================= */
  function drawEmp() {
    const L = S.load, q = (V("eq") || "").toLowerCase(), dp = V("ed") || "", st = V("es") || "active", depts = [...new Set(L.employees.map((e) => e.department).filter(Boolean))].sort();
    const rows = L.employees.filter((e) => (st === "all" || e.status === st) && (!dp || e.department === dp) && (!q || (e.name + " " + e.emp_code + " " + (e.bio_id || "") + " " + (e.designation || "")).toLowerCase().includes(q)));
    $("#emp").innerHTML = `<div class="row"><input id="eq" placeholder="Search name, code, designation, Biometric ID" style="max-width:300px" value="${esc(V("eq"))}"><select id="ed" style="max-width:180px"><option value="">All departments</option>${opts(depts, dp)}</select><select id="es" style="max-width:150px">${opts([["active", "Active"], ["left", "Left"], ["all", "All"]], st)}</select><span class="grow"></span>
      ${ed() ? `<button class="btn" id="eadd">+ Add employee</button><details class="mm"><summary class="btn o">More ▾</summary><div><button class="btn o s" id="eimp">Import from CSV</button><button class="btn o s" id="etpl">CSV template</button><button class="btn o s" id="ecsv">Export CSV</button></div></details>` : `<button class="btn o s" id="ecsv">Export CSV</button>`}</div>
      <div class="note">${rows.length} of ${L.employees.length} employees. The <b>Biometric ID</b> is the number the person is enrolled with on the fingerprint / face machine; punches are matched to the employee by it.</div>
      ${rows.length ? `<table><thead><tr><th>Code</th><th>Name</th><th>Department · Designation</th><th>Shift</th><th>Bio ID</th>${money() ? "<th class='num'>Monthly gross</th>" : ""}<th>Status</th><th></th></tr></thead><tbody>${rows.map((e) => `<tr><td>${esc(e.emp_code)}</td><td><a href="#" data-e="${e.id}">${esc(e.name)}</a>${e.sample ? ' <span class="chip x">sample</span>' : ""}</td><td>${esc(e.department || "")}<div class="mut">${esc(e.designation || "")}</div></td><td>${esc((shiftOf(e) || {}).name || "—")}</td><td>${esc(e.bio_id || "—")}</td>${money() ? `<td class="num">${e.pay_type === "daily" ? rs0(e.basic) + " /day" : rs0(+e.basic + +e.hra + +e.special + +e.other_allow)}</td>` : ""}<td>${e.status === "left" ? '<span class="chip x">Left</span>' : '<span class="chip g">Active</span>'}</td><td>${ed() ? `<button class="btn o s" data-e="${e.id}">Edit</button>` : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No employees match.</div>`}`;
    ["eq", "ed", "es"].forEach((i) => { $("#" + i).oninput = () => { const pos = $("#eq").selectionStart; drawEmp(); if (i === "eq") { $("#eq").focus(); $("#eq").setSelectionRange(pos, pos); } }; });
    document.querySelectorAll("[data-e]").forEach((b) => (b.onclick = (ev) => { ev.preventDefault(); empForm(L.employees.find((x) => x.id === b.dataset.e)); }));
    if ($("#eadd")) { $("#eadd").onclick = () => empForm(null); $("#eimp").onclick = empImport; $("#etpl").onclick = empTemplate; }
    $("#ecsv").onclick = () => dl("employees.csv", toCsv([EMP_COLS.filter((c) => money() || !MONEY_COLS.includes(c)), ...L.employees.map((e) => EMP_COLS.filter((c) => money() || !MONEY_COLS.includes(c)).map((c) => (c === "shift_name" ? (shiftOf(e) || {}).name || "" : typeof e[c] === "boolean" ? (e[c] ? "yes" : "no") : e[c])))]), "text/csv");
  }
  const EMP_COLS = ["emp_code", "name", "department", "designation", "doj", "shift_name", "bio_id", "pay_type", "basic", "hra", "special", "other_allow", "pf", "esi", "pt", "ot_eligible", "mobile", "email", "uan", "esi_no", "pan", "bank_name", "bank_account", "ifsc"];
  const MONEY_COLS = ["basic", "hra", "special", "other_allow", "pf", "esi", "pt", "uan", "esi_no", "pan", "bank_name", "bank_account", "ifsc"];
  function empTemplate() { dl("employees-template.csv", toCsv([EMP_COLS, ["", "Ravi Kumar", "Production", "CNC Operator", "2026-04-01", (S.load.shifts[0] || {}).name || "General", "101", "monthly", "10000", "4000", "2000", "0", "yes", "no", "yes", "yes", "9800000000", "", "", "", "", "Bank", "1234567890", "IFSC0000001"]]), "text/csv"); }
  function empImport() {
    pickFile(".csv,.txt,.tsv", async (text) => {
      const t = parseCsv(text); if (t.length < 2) return say("The file has no rows.");
      const head = t[0].map((h) => h.toLowerCase().replace(/[^a-z_]+/g, "_").replace(/^_|_$/g, "")), alias = { employee_code: "emp_code", code: "emp_code", employee_name: "name", shift: "shift_name", biometric_id: "bio_id", ot: "ot_eligible", other: "other_allow", account_no: "bank_account", account: "bank_account", joining_date: "doj", date_of_joining: "doj" };
      const rows = t.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { const k = alias[h] || h; if (EMP_COLS.includes(k)) o[k] = r[i]; }); ["pf", "esi", "pt", "ot_eligible"].forEach((k) => { if (k in o) o[k] = yes(o[k]); }); if (o.pay_type) o.pay_type = /day/i.test(o.pay_type) ? "daily" : "monthly"; return o; }).filter((o) => o.name);
      if (!rows.length) return say("No row has a name. Use the CSV template for the column names.");
      if (!confirm(`Add or update ${rows.length} employees from this file? Rows with an existing employee code update that employee.`)) return;
      try { const r = await call("kmr_hrms_employees_import", { p: { rows } }); say(`${r.added} employee(s) saved.` + (r.errors.length ? " " + r.errors.length + " row(s) not saved: " + r.errors.slice(0, 3).map((x) => "row " + x.row + " " + x.error).join("; ") : ""), !r.errors.length); await loadAll(); drawEmp(); } catch (e) { say(e.message); }
    });
  }
  function empForm(e) {
    const isNew = !e, L = S.load; e = e || { status: "active", pay_type: "monthly", shift_id: (L.shifts.find((s) => s.active) || {}).id, doj: today() };
    const f = (id, label, v, type, ph) => `<div><label class="lbl" for="${id}">${label}</label><input id="${id}" type="${type || "text"}" value="${esc(v == null ? "" : v)}" placeholder="${esc(ph || "")}"></div>`;
    const cb = (id, label, v) => `<label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" id="${id}" style="width:auto"${v ? " checked" : ""}> ${label}</label>`;
    const depts = [...new Set(L.employees.map((x) => x.department).filter(Boolean))].sort();
    open(`<div class="row"><b class="grow" style="font-size:16px">${isNew ? "Add employee" : "Employee · " + esc(e.name)}</b><button class="btn o s" id="xc">Close</button></div>
      <datalist id="dl_dep">${depts.map((d) => `<option>${esc(d)}</option>`).join("")}</datalist>
      <div class="frm">${f("f_code", "Employee code", e.emp_code, "", "blank = automatic")}${f("f_name", "Name *", e.name)}<div><label class="lbl">Gender</label><select id="f_gender"><option value=""></option>${opts(["Male", "Female", "Other"], e.gender)}</select></div>${f("f_dob", "Date of birth", e.dob, "date")}${f("f_doj", "Date of joining", e.doj, "date")}${f("f_dol", "Date of leaving", e.dol, "date")}
        <div><label class="lbl">Department</label><input id="f_dep" list="dl_dep" value="${esc(e.department || "")}"></div>${f("f_des", "Designation", e.designation)}${f("f_grade", "Grade", e.grade)}${f("f_mob", "Mobile", e.mobile)}${f("f_mail", "E-mail", e.email, "email")}
        <div><label class="lbl">Shift</label><select id="f_shift"><option value="">—</option>${opts(L.shifts.filter((s) => s.active || s.id === e.shift_id).map((s) => [s.id, s.name + " (" + s.start_time + "–" + s.end_time + ")"]), e.shift_id)}</select></div>
        ${f("f_bio", "Biometric ID", e.bio_id, "", "ID enrolled on the machine")}<div><label class="lbl">Status</label><select id="f_status">${opts([["active", "Active"], ["left", "Left"]], e.status)}</select></div></div>
      ${money() ? `<details class="opt" open><summary>Salary and statutory</summary><div class="frm" style="margin-top:8px"><div><label class="lbl">Paid</label><select id="f_pt">${opts([["monthly", "Monthly salary"], ["daily", "Daily wage"]], e.pay_type)}</select></div>
        ${f("f_basic", "Basic (₹ per month / per day)", e.basic, "number")}${f("f_hra", "HRA", e.hra, "number")}${f("f_spl", "Special allowance", e.special, "number")}${f("f_oth", "Other allowance", e.other_allow, "number")}</div>
        <div class="row" style="margin-top:8px">${cb("f_pf", "Provident fund", e.pf)}${cb("f_esi", "ESI", e.esi)}${cb("f_ptx", "Professional tax", e.pt)}${cb("f_ot", "Overtime eligible", e.ot_eligible)}<span class="mut" id="f_gross"></span></div>
        <div class="frm">${f("f_uan", "UAN", e.uan)}${f("f_esin", "ESI number", e.esi_no)}${f("f_pan", "PAN", e.pan)}${f("f_bank", "Bank", e.bank_name)}${f("f_acc", "Account number", e.bank_account)}${f("f_ifsc", "IFSC", e.ifsc)}</div></details>` : ""}
      <div class="row" style="margin-top:12px">${ed() ? '<button class="btn" id="fsave">Save</button>' : ""}${!isNew && isAdmin() ? '<button class="btn r o" id="fdel">Delete</button>' : ""}<span class="mut" id="fmsg"></span></div>`);
    const gross = () => { if (!$("#f_gross")) return; $("#f_gross").textContent = "Monthly gross ₹ " + rs0(+V("f_basic") + +V("f_hra") + +V("f_spl") + +V("f_oth")); };
    if (money()) ["f_basic", "f_hra", "f_spl", "f_oth"].forEach((i) => ($("#" + i).oninput = gross)); gross();
    $("#xc").onclick = closeM;
    if ($("#fsave")) $("#fsave").onclick = async () => {
      const p = { id: e.id, emp_code: V("f_code"), name: V("f_name"), gender: V("f_gender"), dob: V("f_dob"), doj: V("f_doj"), dol: V("f_dol"), department: V("f_dep"), designation: V("f_des"), grade: V("f_grade"), mobile: V("f_mob"), email: V("f_mail"), shift_id: V("f_shift"), bio_id: V("f_bio"), status: V("f_status") };
      if (money()) Object.assign(p, { pay_type: V("f_pt"), basic: V("f_basic"), hra: V("f_hra"), special: V("f_spl"), other_allow: V("f_oth"), pf: V("f_pf"), esi: V("f_esi"), pt: V("f_ptx"), ot_eligible: V("f_ot"), uan: V("f_uan"), esi_no: V("f_esin"), pan: V("f_pan"), bank_name: V("f_bank"), bank_account: V("f_acc"), ifsc: V("f_ifsc") });
      try { await call("kmr_hrms_employee_save", { p }); closeM(); say("Saved.", true); await loadAll(); drawEmp(); } catch (er) { $("#fmsg").textContent = er.message; $("#fmsg").style.color = "var(--r)"; }
    };
    if ($("#fdel")) $("#fdel").onclick = async () => { if (!confirm("Delete this employee with their attendance, punches and leave? A person who has left should be set to Left instead.")) return; try { await call("kmr_hrms_employee_delete", { p_id: e.id }); closeM(); await loadAll(); drawEmp(); } catch (er) { $("#fmsg").textContent = er.message; } };
  }

  /* ================= attendance ================= */
  const ABBR = { P: "P", HD: "½", A: "A", L: "L", U: "U", WO: "W", H: "H", MP: "?" };
  async function drawAtt() {
    const L = S.load; if (!S.month) S.month = L.today.slice(0, 7);
    const { from, to } = C.monthRange(S.month), nd = C.monthDays(S.month), el = $("#att");
    const A = await getAtt(from, to), lockedM = A.locked.includes(S.month);
    const by = {}; A.attendance.forEach((r) => { by[r.employee_id + "|" + String(r.work_date).slice(0, 10)] = r; });
    const dep = V("ad") || "", depts = [...new Set(L.employees.map((e) => e.department).filter(Boolean))].sort();
    const emps = L.employees.filter((e) => (e.status !== "left" || A.attendance.some((r) => r.employee_id === e.id)) && (!dep || e.department === dep));
    const days = Array.from({ length: nd }, (_, i) => from.slice(0, 8) + String(i + 1).padStart(2, "0"));
    const noRows = !A.attendance.length;
    el.innerHTML = `<div class="row"><input type="month" id="am" value="${S.month}" style="max-width:170px"><select id="ad" style="max-width:190px"><option value="">All departments</option>${opts(depts, dep)}</select><span class="grow"></span>
      ${ed() ? `<button class="btn" id="awork"${lockedM ? " disabled" : ""}>Work out attendance from punches</button><button class="btn o" id="apun">+ Add a punch</button>` : ""}<button class="btn o" id="acsv">Export sheet (CSV)</button></div>
      ${lockedM ? `<div class="guide">🔒 The payroll of ${perName(S.month)} is finalised. Attendance of this month cannot be changed unless the payroll is re-opened.</div>` : ""}
      ${noRows && ed() && !lockedM ? `<div class="guide">No attendance has been worked out for ${perName(S.month)} yet. Press <b>Work out attendance from punches</b>: it reads the punches of the machines (and the ones you added), applies each person's shift, holidays and approved leave, and fills in Present / Absent / Late / Overtime for every day. Days you correct by hand are never overwritten.</div>` : ""}
      <div class="note"><span class="s-P" style="padding:1px 7px;border-radius:6px">P</span> present · <span class="s-HD" style="padding:1px 7px;border-radius:6px">½</span> half day · <span class="s-A" style="padding:1px 7px;border-radius:6px">A</span> absent · <span class="s-L" style="padding:1px 7px;border-radius:6px">L</span> paid leave · <span class="s-U" style="padding:1px 7px;border-radius:6px">U</span> unpaid leave · <span class="s-WO" style="padding:1px 7px;border-radius:6px">W</span> weekly off · <span class="s-H" style="padding:1px 7px;border-radius:6px">H</span> holiday · <span class="s-MP" style="padding:1px 7px;border-radius:6px">?</span> missed punch. Click a day to see the punches or to correct it.</div>
      ${emps.length ? `<table class="sheetg"><thead><tr><th class="nm">Employee</th>${days.map((d) => `<th class="${C.dow(d) === 0 ? "wk" : ""}">${+d.slice(8)}</th>`).join("")}<th>Paid days</th><th>Absent</th><th>Late</th><th>OT h</th></tr></thead><tbody>${emps.map((e) => {
        const rows = A.attendance.filter((r) => r.employee_id === e.id), sm = C.summary(e, rows, S.month, L.leave_types);
        return `<tr><td class="nm">${esc(e.name)}<div class="mut">${esc(e.emp_code)}</div></td>${days.map((d) => { const r = by[e.id + "|" + d]; return `<td class="c ${r ? "s-" + r.status : ""} ${C.dow(d) === 0 && !r ? "wk" : ""}" data-c="${e.id}|${d}" title="${r ? esc(ST[r.status] + (r.in_at ? " · " + tm(r.in_at) + "–" + tm(r.out_at) : "") + (r.remarks ? " · " + r.remarks : "") + (r.source === "manual" ? " · entered by hand" : "")) : ""}">${r ? ABBR[r.status] + (r.source === "manual" ? "*" : "") : ""}</td>`; }).join("")}<td><b>${sm.paid_days}</b></td><td>${sm.absent + sm.missed || ""}</td><td>${sm.late_count || ""}</td><td>${sm.ot_min ? (sm.ot_min / 60).toFixed(1) : ""}</td></tr>`;
      }).join("")}</tbody></table><div class="note">* entered by hand</div>` : `<div class="empty">No employees yet.</div>`}`;
    $("#am").onchange = () => { S.month = V("am") || S.month; drawAtt(); }; $("#ad").onchange = () => drawAtt();
    if ($("#awork")) $("#awork").onclick = workOut; if ($("#apun")) $("#apun").onclick = () => punchForm();
    $("#acsv").onclick = () => dl(`attendance-${S.month}.csv`, toCsv([["Code", "Name", "Department", ...days.map((d) => +d.slice(8)), "Paid days", "Absent", "Late days", "OT hours"], ...emps.map((e) => { const rows = A.attendance.filter((r) => r.employee_id === e.id), sm = C.summary(e, rows, S.month, L.leave_types); return [e.emp_code, e.name, e.department || "", ...days.map((d) => (by[e.id + "|" + d] || {}).status || ""), sm.paid_days, sm.absent + sm.missed, sm.late_count, (sm.ot_min / 60).toFixed(1)]; })]), "text/csv");
    document.querySelectorAll("[data-c]").forEach((td) => (td.onclick = () => { const [id, d] = td.dataset.c.split("|"); dayForm(id, d); }));
  }
  const slim = (r) => ({ employee_id: r.employee_id, work_date: r.work_date, in_at: r.in_at, out_at: r.out_at, worked_min: r.worked_min, late_min: r.late_min, early_min: r.early_min, ot_min: r.ot_min, status: r.status, leave_code: r.leave_code, source: r.source, remarks: r.remarks });
  async function saveRows(rows, mode) {
    const tot = { saved: 0, locked: 0, kept_manual: 0 };
    for (let i = 0; i < rows.length; i += 3000) { const r = await call("kmr_hrms_att_save", { p: { mode, rows: rows.slice(i, i + 3000).map(slim) } }); tot.saved += r.saved; tot.locked += r.locked; tot.kept_manual += r.kept_manual; }
    return tot;
  }
  async function workOut() {
    const { from, to } = C.monthRange(S.month), last = to > S.load.today ? S.load.today : to;
    if (last < from) return say("This month has not started yet.");
    const btn = $("#awork"); btn.disabled = true; btn.textContent = "Working out…";
    try {
      const A = await getAtt(from, to), b = buildFrom(A, from, last), r = await saveRows(b.rows, "auto"), uk = Object.keys(b.unknown);
      say(`Attendance worked out: ${r.saved} day(s) saved${r.kept_manual ? `, ${r.kept_manual} day(s) you entered by hand were kept` : ""}${r.locked ? `, ${r.locked} day(s) in a finalised month were not changed` : ""}.` + (uk.length ? ` Punches from ID ${uk.slice(0, 5).join(", ")} match no employee (set the Biometric ID on the person).` : ""), true);
    } catch (e) { say(e.message); }
    drawAtt();
  }
  function dayForm(empId, date) {
    const L = S.load, e = L.employees.find((x) => x.id === empId), A = S.att, sh = shiftOf(e) || L.shifts.find((s) => s.active) || C.DEFAULT_SHIFT;
    const r = A.attendance.find((x) => x.employee_id === empId && String(x.work_date).slice(0, 10) === date);
    const lockedM = A.locked.includes(date.slice(0, 7)), can = ed() && !lockedM;
    const ps = A.punches.filter((p) => (p.employee_id === empId || (!p.employee_id && e.bio_id && p.bio_id === e.bio_id)) && C.workDateOf(p.at, sh, tz()) === date);
    open(`<div class="row"><b class="grow" style="font-size:16px">${esc(e.name)} · ${fmt(date)}</b><button class="btn o s" id="xc">Close</button></div>
      <div class="note">${r ? `Now: ${esc(ST[r.status])}${r.source === "manual" ? " (entered by hand)" : r.source === "leave" ? " (from leave)" : r.source === "rule" ? " (by rule)" : " (from punches)"}${r.late_min ? " · late " + r.late_min + " min" : ""}${r.ot_min ? " · overtime " + (r.ot_min / 60).toFixed(1) + " h" : ""}` : "Nothing worked out for this day yet."}</div>
      <h4 style="margin:8px 0 4px">Punches</h4>${ps.length ? `<table style="min-width:0"><tbody>${ps.map((p) => `<tr><td>${tm(p.at)}</td><td>${esc(p.direction || "")}</td><td>${esc(p.verify)}</td><td>${esc(p.source)}</td><td class="num">${can ? `<button class="btn r s" data-dp="${p.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table>` : '<div class="mut">No punches this day.</div>'}
      ${can ? `<hr style="border:0;border-top:1px solid var(--line);margin:12px 0"><h4 style="margin:0 0 6px">Correct this day by hand</h4><div class="frm"><div><label class="lbl">Status</label><select id="d_st">${opts(Object.keys(ST).map((k) => [k, ST[k]]), r ? r.status : "P")}</select></div>
        <div><label class="lbl">In (HH:MM)</label><input id="d_in" type="time" value="${r && r.in_at ? tm(r.in_at) : ""}"></div><div><label class="lbl">Out (HH:MM)</label><input id="d_out" type="time" value="${r && r.out_at ? tm(r.out_at) : ""}"></div>
        <div><label class="lbl">Leave type (leave only)</label><select id="d_lv"><option value="">—</option>${opts(L.leave_types.map((t) => [t.code, t.code + " - " + t.name]), r && r.leave_code)}</select></div><div style="grid-column:1/-1"><label class="lbl">Reason / remarks</label><input id="d_rm" value="${esc((r && r.source === "manual" && r.remarks) || "")}"></div></div>
        <div class="row" style="margin-top:10px"><button class="btn" id="dsave">Save</button>${r && r.source === "manual" ? '<button class="btn o" id="drst">Go back to punches</button>' : ""}<button class="btn o" id="dpun">+ Add a punch</button><span class="mut" id="dmsg"></span></div>` : lockedM ? '<div class="guide">🔒 This month’s payroll is finalised.</div>' : ""}`);
    $("#xc").onclick = closeM;
    document.querySelectorAll("[data-dp]").forEach((b) => (b.onclick = async () => { try { await call("kmr_hrms_punch_delete", { p_ids: [b.dataset.dp] }); closeM(); say("Punch deleted. Work out attendance again to update the day.", true); drawAtt(); } catch (er) { say(er.message); } }));
    if ($("#dpun")) $("#dpun").onclick = () => punchForm(empId, date);
    if ($("#drst")) $("#drst").onclick = async () => { try { await call("kmr_hrms_att_reset", { p_employee: empId, p_from: date, p_to: date }); closeM(); await workOut(); } catch (er) { say(er.message); } };
    if ($("#dsave")) $("#dsave").onclick = async () => {
      try {
        const st = V("d_st"), inI = V("d_in") ? atLocal(date, V("d_in")) : null; let outI = V("d_out") ? atLocal(date, V("d_out")) : null; if (inI && outI && outI <= inI) outI = new Date(Date.parse(outI) + 864e5).toISOString();
        const row = { employee_id: empId, work_date: date, status: st, in_at: inI, out_at: outI, worked_min: 0, late_min: 0, early_min: 0, ot_min: 0, leave_code: ["L", "U"].includes(st) ? V("d_lv") || null : null, remarks: V("d_rm") || "Entered by hand" };
        if (inI && outI && ["P", "HD", "A"].includes(st)) { const m = C.dayRow(e, sh, date, [inI, outI], { settings: L.settings, holidays: {}, leaves: [], today: "9999-12-31" }); if (m) Object.assign(row, { worked_min: m.worked_min, late_min: m.late_min, early_min: m.early_min, ot_min: m.ot_min }); }
        await call("kmr_hrms_att_save", { p: { mode: "manual", rows: [row] } }); closeM(); say("Saved.", true); drawAtt();
      } catch (er) { $("#dmsg").textContent = er.message; $("#dmsg").style.color = "var(--r)"; }
    };
  }
  function punchForm(empId, date) {
    const L = S.load, emps = activeEmps();
    open(`<div class="row"><b class="grow" style="font-size:16px">Add a punch by hand</b><button class="btn o s" id="xc">Close</button></div><div class="note">For a person who forgot to punch or when a machine was down. The punch is marked “manual” and can be deleted later.</div>
      <div class="frm"><div><label class="lbl">Employee</label><select id="p_e">${opts(emps.map((e) => [e.id, e.emp_code + " - " + e.name]), empId)}</select></div><div><label class="lbl">Date</label><input id="p_d" type="date" value="${date || L.today}"></div><div><label class="lbl">Time</label><input id="p_t" type="time" value="09:00"></div>
        <div><label class="lbl">In / out</label><select id="p_dir"><option value="">Not stated</option><option value="in">In</option><option value="out">Out</option></select></div></div>
      <div class="row" style="margin-top:10px"><button class="btn" id="psave">Add punch</button><span class="mut" id="pmsg"></span></div>`);
    $("#xc").onclick = closeM;
    $("#psave").onclick = async () => {
      try { const e = L.employees.find((x) => x.id === V("p_e")); if (!e) throw new Error("Choose the employee."); if (!V("p_t")) throw new Error("Enter the time.");
        const r = await call("kmr_hrms_punch_import", { p: { source: "manual", rows: [{ employee_id: e.id, bio_id: e.bio_id || e.emp_code, time: atLocal(V("p_d"), V("p_t")), verify: "manual", direction: V("p_dir") }] } });
        closeM(); say(r.added ? "Punch added. Work out attendance again to update the day." : "That punch already exists.", !!r.added); if (hashGo() === "att") drawAtt(); } catch (er) { $("#pmsg").textContent = er.message; $("#pmsg").style.color = "var(--r)"; }
    };
  }

  /* ================= biometric machines ================= */
  const VENDORS = ["eSSL / ZKTeco", "ZKTeco", "eSSL", "Realtime", "Matrix COSEC", "Mantra", "Suprema", "Hikvision", "Anviz", "BioMax", "Other"];
  const MODES = [["finger", "Fingerprint"], ["face", "Face"], ["card", "Card"], ["palm", "Palm"], ["password", "Password"]];
  const SITE = "www.kmr-groups.com", PUSH_URL = "https://" + SITE + "/it/console/api/hrm/punch";
  const devState = (d) => !d.enabled ? ["x", "Switched off"] : d.protocol === "file" ? ["x", "File import"] : !d.last_seen ? ["x", "Never connected"] : Date.now() - new Date(d.last_seen) < 15 * 6e4 ? ["g", "Online"] : Date.now() - new Date(d.last_seen) < 24 * 36e5 ? ["a", "Seen " + ago(d.last_seen)] : ["r", "Silent since " + ago(d.last_seen)];
  async function drawDev() {
    const L = S.load, el = $("#dev"); if (!S.devFrom) { S.devFrom = C.addDays(L.today, -2); S.devTo = L.today; }
    let A = { punches: [] }; try { A = await getAtt(S.devFrom, S.devTo); } catch (e) { say(e.message); }
    const dv = Object.fromEntries(L.devices.map((d) => [d.id, d])), fo = V("dfil") || "all";
    const mapE = (p) => L.employees.find((e) => e.id === p.employee_id) || L.employees.find((e) => e.bio_id && e.bio_id === p.bio_id);
    let ps = A.punches.slice().reverse().filter((p) => fo === "all" || (fo === "unmatched" ? !mapE(p) : p.device_id === fo)); const total = ps.length; ps = ps.slice(0, 300);
    el.innerHTML = `<div class="guide"><b>How the machines connect.</b> Every fingerprint / face / card machine works with this app. Pick the way that fits your machine on <b>+ Add machine</b>: <b>Push (eSSL / ZKTeco / Realtime “cloud server”)</b>, <b>Universal push (JSON)</b> for any other make or a small bridge program, or <b>File import</b> from a USB drive or the machine’s software. People are matched by the <b>Biometric ID</b> set on the employee.</div>
      <div class="row"><b class="grow" style="font-size:15px">Machines</b>${ed() ? '<button class="btn" id="dadd">+ Add machine</button>' : ""}</div>
      ${L.devices.length ? `<div class="mach">${L.devices.map((d) => { const s = devState(d); return `<div class="card"><h3><span class="on-dot ${s[0] === "g" ? "up" : s[0] === "a" ? "mid" : ""}"></span>${esc(d.name)} ${d.sample ? '<span class="chip x">sample</span>' : ""}</h3><div class="kv"><div><span>Status</span><b>${esc(s[1])}</b></div><div><span>Connection</span><b>${{ adms: "Push (ADMS)", json: "Universal JSON", file: "File import" }[d.protocol]}</b></div><div><span>Make · model</span><b>${esc(d.vendor || "")}${d.model ? " · " + esc(d.model) : ""}</b></div><div><span>Identifies by</span><b>${esc((d.modes || []).map((m) => (MODES.find((x) => x[0] === m) || [0, m])[1]).join(", "))}</b></div><div><span>Place</span><b>${esc(d.location || "—")}</b></div><div><span>Last punch</span><b>${d.last_punch ? dtm(d.last_punch) : "—"}</b></div><div><span>Punches received</span><b>${d.punches_total}</b></div>${d.serial ? `<div><span>Serial no.</span><b class="mono">${esc(d.serial)}</b></div>` : ""}</div>${ed() ? `<div class="row" style="margin:10px 0 0"><button class="btn o s" data-d="${d.id}">Settings and connection</button></div>` : ""}</div>`; }).join("")}</div>` : `<div class="empty">No machine added yet.<br>Add your first machine, or use <b>Import punches from a file</b> below.</div>`}
      <h3 style="margin:18px 0 6px">Import punches from a file</h3>
      <div class="note">Any machine can export its attendance log (USB drive or its own software) as .dat, .csv or .txt: columns for the ID, the date and time, and optionally in/out. The file is read here in your browser; nothing is sent until you confirm.</div>
      <div class="row">${ed() ? `<select id="ifd" style="max-width:260px"><option value="">Machine (optional)</option>${L.devices.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select><button class="btn o" id="ifile">Choose file…</button>` : '<span class="mut">Editors can import files.</span>'}<span id="iprev" class="grow"></span></div>
      <h3 style="margin:18px 0 6px">Recent punches</h3>
      <div class="row"><label class="lbl" style="margin:0">From</label><input type="date" id="dfrom" value="${S.devFrom}" style="max-width:160px"><label class="lbl" style="margin:0">to</label><input type="date" id="dto" value="${S.devTo}" style="max-width:160px"><select id="dfil" style="max-width:220px">${opts([["all", "All machines"], ["unmatched", "Not matched to an employee"], ...L.devices.map((d) => [d.id, d.name])], fo)}</select><span class="mut">${total} punches${total > 300 ? " (showing the latest 300)" : ""}</span></div>
      ${ps.length ? `<table><thead><tr><th>Time</th><th>Employee</th><th>Bio ID</th><th>In/out</th><th>Method</th><th>Machine</th><th>Source</th><th></th></tr></thead><tbody>${ps.map((p) => { const e = mapE(p); return `<tr><td>${dtm(p.at)}</td><td>${e ? esc(e.name) : '<span class="chip r">not matched</span>'}</td><td>${esc(p.bio_id)}</td><td>${esc(p.direction || "")}</td><td>${esc(p.verify)}</td><td>${esc((dv[p.device_id] || {}).name || "—")}</td><td>${esc(p.source)}</td><td>${ed() ? `<button class="btn r s" data-dp="${p.id}">Delete</button>` : ""}</td></tr>`; }).join("")}</tbody></table>` : `<div class="empty">No punches in this period.</div>`}`;
    if ($("#dadd")) $("#dadd").onclick = () => devForm(null);
    document.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => devForm(L.devices.find((x) => x.id === b.dataset.d))));
    document.querySelectorAll("[data-dp]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this punch?")) return; try { await call("kmr_hrms_punch_delete", { p_ids: [b.dataset.dp] }); drawDev(); } catch (er) { say(er.message); } }));
    ["dfrom", "dto"].forEach((i) => ($("#" + i).onchange = () => { S.devFrom = V("dfrom") || S.devFrom; S.devTo = V("dto") || S.devTo; if (S.devTo < S.devFrom) S.devTo = S.devFrom; if (C.dnum(S.devTo) - C.dnum(S.devFrom) > 92) S.devFrom = C.addDays(S.devTo, -92); drawDev(); }));
    $("#dfil").onchange = drawDev; if ($("#ifile")) $("#ifile").onclick = importFile;
  }
  function importFile() {
    pickFile(".dat,.csv,.txt,.tsv,.log", (text, name) => {
      const r = C.parsePunchFile(text), dev = V("ifd");
      if (!r.rows.length) { $("#iprev").innerHTML = `<span style="color:var(--r)">No punches could be read from ${esc(name)}. Each line needs an ID and a date and time.</span>`; return; }
      const ids = new Set(r.rows.map((x) => x.bio_id)), times = r.rows.map((x) => x.time).sort();
      $("#iprev").innerHTML = `<b>${esc(name)}</b>: ${r.rows.length} punches of ${ids.size} people, ${times[0].slice(0, 10)} to ${times[times.length - 1].slice(0, 10)} (${esc(r.format)})${r.bad ? `, ${r.bad} line(s) not understood` : ""}. <button class="btn s" id="igo">Import</button>`;
      $("#igo").onclick = async () => {
        $("#igo").disabled = true; const tot = { added: 0, duplicate: 0, invalid: 0, unknown_ids: [] };
        try { for (let i = 0; i < r.rows.length; i += 5000) { const x = await call("kmr_hrms_punch_import", { p: { source: "import", device_id: dev || null, rows: r.rows.slice(i, i + 5000) } }); tot.added += x.added; tot.duplicate += x.duplicate; tot.invalid += x.invalid; x.unknown_ids.forEach((u) => !tot.unknown_ids.includes(u) && tot.unknown_ids.push(u)); }
          say(`${tot.added} punch(es) added${tot.duplicate ? `, ${tot.duplicate} already existed` : ""}${tot.invalid ? `, ${tot.invalid} invalid` : ""}.` + (tot.unknown_ids.length ? ` IDs not matched to an employee: ${tot.unknown_ids.slice(0, 8).join(", ")}${tot.unknown_ids.length > 8 ? "…" : ""} - set them as Biometric ID on the person.` : "") + " Now work out attendance in the Attendance tab.", true); await loadAll(); drawDev(); } catch (e) { say(e.message); $("#igo").disabled = false; }
      };
    });
  }
  function devForm(d) {
    const isNew = !d, L = S.load; d = d || { protocol: "adms", vendor: "eSSL / ZKTeco", modes: ["finger"], enabled: true };
    const f = (id, label, v, ph, type) => `<div><label class="lbl" for="${id}">${label}</label><input id="${id}" type="${type || "text"}" value="${esc(v == null ? "" : v)}" placeholder="${esc(ph || "")}"></div>`;
    open(`<div class="row"><b class="grow" style="font-size:16px">${isNew ? "Add machine" : "Machine · " + esc(d.name)}</b><button class="btn o s" id="xc">Close</button></div>
      <div class="frm">${f("v_name", "Name *", d.name, "Gate 1 fingerprint")}<div><label class="lbl">Make</label><select id="v_ven">${opts(VENDORS, d.vendor)}</select></div>${f("v_mod", "Model", d.model, "e.g. MB160, K40, F18")}
        <div><label class="lbl">How the machine sends punches</label><select id="v_pro">${opts([["adms", "Push - eSSL / ZKTeco / Realtime “cloud server” (ADMS)"], ["json", "Universal push (JSON) - any make / bridge program"], ["file", "File import only (USB / machine software)"]], d.protocol)}</select></div>
        <div id="v_serbox">${f("v_ser", "Serial number *", d.serial, "printed on the machine")}</div>${f("v_loc", "Place", d.location, "Main gate")}${f("v_ip", "Machine IP (for your reference)", d.ip)}</div>
      <div class="row" style="margin-top:8px"><span class="lbl" style="margin:0">Identifies by</span>${MODES.map((m) => `<label style="display:flex;gap:5px;align-items:center"><input type="checkbox" class="v_mode" value="${m[0]}" style="width:auto"${(d.modes || []).includes(m[0]) ? " checked" : ""}> ${m[1]}</label>`).join("")}<label style="display:flex;gap:5px;align-items:center;margin-left:auto"><input type="checkbox" id="v_en" style="width:auto"${d.enabled ? " checked" : ""}> Active</label></div>
      <div style="margin-top:8px"><label class="lbl">Notes</label><input id="v_not" value="${esc(d.notes || "")}"></div><div id="v_how"></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="vsave">Save</button>${!isNew ? '<button class="btn r o" id="vdel">Delete machine</button>' : ""}<span class="mut" id="vmsg"></span></div>`);
    const how = () => {
      const pro = V("v_pro"), key = d.push_key || "(save the machine first to get its key)", ser = V("v_ser") || "(serial number)";
      $("#v_serbox").style.display = pro === "adms" ? "" : "none";
      $("#v_how").innerHTML = pro === "adms" ? `<div class="guide" style="margin-top:10px"><b>On the machine</b> (menu <b>Comm. → Cloud Server Setting</b>, also called <i>ADMS</i> or <i>Web Server</i>; eSSL, ZKTeco and Realtime use the same push protocol):<div class="cmd">Server address :  ${SITE}\nServer port    :  443   (switch on HTTPS / SSL if the machine has that option)\nProxy          :  off\nSerial number  :  ${esc(ser)}   (System info → Device)</div><div class="note" style="margin:0">Enrol each person on the machine with the same ID as the <b>Biometric ID</b> in Employees. The machine sends every punch within seconds, and again after a power or network break, so nothing is lost. <b>Note:</b> older firmware that can only talk plain HTTP on port 80 cannot reach a secure (HTTPS) address; use <i>Universal push</i> with a bridge program or <i>File import</i> for those machines.</div></div>`
        : pro === "json" ? `<div class="guide" style="margin-top:10px"><b>Send punches as JSON</b> from the machine’s software, a small bridge program or a script on your PC / server (works for any make: Matrix, Mantra, Suprema, Hikvision, Anviz, BioMax …):<div class="cmd">POST ${PUSH_URL}\nx-device-key: ${esc(key)}\nContent-Type: application/json\n\n{"punches":[{"bio_id":"101","time":"2026-10-14 09:02:11","verify":"finger","direction":"in"}]}</div><div class="note" style="margin:0"><code>time</code> is the machine’s own clock in the company time zone (or an ISO time with +05:30 / Z). <code>verify</code>: finger, face, card, palm or password. A list of up to 5,000 punches can be sent at once; punches already received are ignored, so it is safe to resend. ${isNew ? "" : '<button class="btn o s" id="vkey">Make a new key</button>'}</div></div>`
        : `<div class="guide" style="margin-top:10px">Export the attendance log from the machine (USB drive or its software) and use <b>Import punches from a file</b> on this screen. No connection is needed.</div>`;
      if ($("#vkey")) $("#vkey").onclick = async () => { if (!confirm("Make a new key? The old key stops working at once; update the bridge program with the new one.")) return; try { d.push_key = await call("kmr_hrms_device_key", { p_id: d.id }); how(); say("New key made.", true); } catch (er) { $("#vmsg").textContent = er.message; } };
    };
    $("#v_pro").onchange = how; $("#v_ser").oninput = how; how();
    $("#xc").onclick = closeM;
    $("#vsave").onclick = async () => {
      try { const p = { id: d.id, name: V("v_name"), vendor: V("v_ven"), model: V("v_mod"), protocol: V("v_pro"), serial: V("v_pro") === "adms" ? V("v_ser") : V("v_ser") || null, location: V("v_loc"), ip: V("v_ip"), notes: V("v_not"), enabled: V("v_en"), modes: [...document.querySelectorAll(".v_mode:checked")].map((x) => x.value) };
        const r = await call("kmr_hrms_device_save", { p }); say("Saved.", true); await loadAll(); if (isNew && p.protocol === "json") { d = S.load.devices.find((x) => x.id === r.id) || d; d.push_key = r.push_key; devForm(d); say("Saved. The key for the bridge program is shown in the box.", true); drawDevList(); } else { closeM(); drawDev(); } } catch (er) { $("#vmsg").textContent = er.message; $("#vmsg").style.color = "var(--r)"; }
    };
    if ($("#vdel")) $("#vdel").onclick = async () => { if (!confirm("Delete this machine? Punches already received are kept.")) return; try { await call("kmr_hrms_device_delete", { p_id: d.id }); closeM(); await loadAll(); drawDev(); } catch (er) { $("#vmsg").textContent = er.message; } };
  }
  const drawDevList = () => { if (hashGo() === "dev") drawDev(); };

  /* ================= leave ================= */
  async function drawLeave() {
    const L = S.load; if (!S.leaveYear) S.leaveYear = +L.today.slice(0, 4);
    S.leaves = await call("kmr_hrms_leaves", { p_year: S.leaveYear }); const fs = V("lst") || "open", lv = S.leaves, types = L.leave_types.filter((t) => t.active);
    const used = (eid, code) => lv.filter((l) => l.employee_id === eid && l.leave_code === code && l.status === "Approved" && l.from_date.slice(0, 4) === String(S.leaveYear)).reduce((a, l) => a + +l.days, 0);
    const rows = lv.filter((l) => (fs === "all" ? true : fs === "open" ? l.status === "Pending" : l.status === fs));
    $("#leave").innerHTML = `<div class="row"><select id="ly" style="max-width:110px">${[S.leaveYear - 1, S.leaveYear, S.leaveYear + 1].map((y) => `<option${y === S.leaveYear ? " selected" : ""}>${y}</option>`).join("")}</select><select id="lst" style="max-width:190px">${opts([["open", "Waiting for decision"], ["Approved", "Approved"], ["Rejected", "Rejected"], ["Cancelled", "Cancelled"], ["all", "All"]], fs)}</select><span class="grow"></span>${ed() ? '<button class="btn" id="ladd">+ Leave request</button>' : ""}</div>
      ${rows.length ? `<table><thead><tr><th>Employee</th><th>Leave</th><th>From</th><th>To</th><th class="num">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((l) => `<tr><td>${esc(l.emp_name)}<div class="mut">${esc(l.emp_code)}</div></td><td>${esc(l.leave_code || "")}${l.half ? " (half)" : ""}</td><td>${fmt(l.from_date)}</td><td>${fmt(l.to_date)}</td><td class="num">${+l.days}</td><td>${esc(l.reason || "")}</td><td><span class="chip ${({ Pending: "a", Approved: "g", Rejected: "r", Cancelled: "x" })[l.status]}">${l.status}</span>${l.decided_by ? `<div class="mut">${esc(l.decided_by)}</div>` : ""}</td><td>${ed() ? (l.status === "Pending" ? `<button class="btn g s" data-ls="${l.id}|Approved">Approve</button> <button class="btn r s" data-ls="${l.id}|Rejected">Reject</button> <button class="btn o s" data-le="${l.id}">Edit</button>` : l.status === "Approved" ? `<button class="btn o s" data-ls="${l.id}|Cancelled">Cancel leave</button>` : `<button class="btn o s" data-ls="${l.id}|Pending">Re-open</button> <button class="btn r o s" data-ld="${l.id}">Delete</button>`) : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No leave requests here.</div>`}
      <h3 style="margin:18px 0 6px">Leave balance · ${S.leaveYear}</h3><div class="note">Approved days taken this year against the yearly quota set for each leave type (Setup).</div>
      ${types.length ? `<table><thead><tr><th>Employee</th>${types.map((t) => `<th class="num">${esc(t.code)}${+t.annual_quota ? " / " + +t.annual_quota : ""}</th>`).join("")}</tr></thead><tbody>${activeEmps().map((e) => `<tr><td>${esc(e.name)}</td>${types.map((t) => { const u = used(e.id, t.code); return `<td class="num">${u || "–"}${+t.annual_quota && u > +t.annual_quota ? ' <span class="late">over</span>' : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>` : '<div class="empty">Add leave types in Setup.</div>'}`;
    $("#ly").onchange = () => { S.leaveYear = +V("ly"); drawLeave(); }; $("#lst").onchange = drawLeave; if ($("#ladd")) $("#ladd").onclick = () => leaveForm(null);
    document.querySelectorAll("[data-ls]").forEach((b) => (b.onclick = async () => { const [id, st] = b.dataset.ls.split("|"); try { await call("kmr_hrms_leave_decide", { p_id: id, p_status: st }); say(st === "Approved" ? "Approved. Work out attendance again so the leave shows on the sheet." : "Updated.", true); drawLeave(); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-ld]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this leave request?")) return; try { await call("kmr_hrms_leave_delete", { p_id: b.dataset.ld }); drawLeave(); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-le]").forEach((b) => (b.onclick = () => leaveForm(lv.find((x) => x.id === b.dataset.le))));
  }
  function leaveForm(l) {
    const L = S.load, types = L.leave_types.filter((t) => t.active); l = l || { from_date: L.today, to_date: L.today };
    open(`<div class="row"><b class="grow" style="font-size:16px">${l.id ? "Change leave request" : "New leave request"}</b><button class="btn o s" id="xc">Close</button></div>
      <div class="frm"><div><label class="lbl">Employee</label><select id="l_e">${opts(activeEmps().map((e) => [e.id, e.emp_code + " - " + e.name]), l.employee_id)}</select></div><div><label class="lbl">Leave type</label><select id="l_t">${opts(types.map((t) => [t.id, t.code + " - " + t.name + (t.paid ? "" : " (unpaid)")]), l.leave_type_id)}</select></div>
        <div><label class="lbl">From</label><input type="date" id="l_f" value="${l.from_date}"></div><div><label class="lbl">To</label><input type="date" id="l_to" value="${l.to_date}"></div><div><label class="lbl">Days</label><input id="l_d" type="number" step="0.5" value="${l.days || ""}" placeholder="automatic"></div>
        <div style="display:flex;align-items:end"><label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" id="l_h" style="width:auto"${l.half ? " checked" : ""}> Half day</label></div><div style="grid-column:1/-1"><label class="lbl">Reason</label><input id="l_r" value="${esc(l.reason || "")}"></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="lsave">Save</button><span class="mut" id="lmsg"></span></div>`);
    $("#xc").onclick = closeM;
    $("#lsave").onclick = async () => { try { await call("kmr_hrms_leave_save", { p: { id: l.id, employee_id: V("l_e"), leave_type_id: V("l_t"), from_date: V("l_f"), to_date: V("l_to"), half: V("l_h"), days: V("l_h") ? 0.5 : V("l_d"), reason: V("l_r") } }); closeM(); say("Saved.", true); drawLeave(); } catch (e) { $("#lmsg").textContent = e.message; $("#lmsg").style.color = "var(--r)"; } };
  }

  /* ================= payroll ================= */
  async function drawPay() {
    const L = S.load; if (!S.payPeriod) { const t = L.today; S.payPeriod = +t.slice(8) <= 10 ? C.addDays(t.slice(0, 8) + "01", -1).slice(0, 7) : t.slice(0, 7); }
    const per = S.payPeriod, runs = await call("kmr_hrms_payroll_list"), got = await call("kmr_hrms_payroll_get", { p_period: per }), run = got && got.run, slips = got ? got.slips : [];
    S.pay = got; const fin = run && run.status === "final", tot = run ? run.totals || {} : {}, el = $("#pay");
    el.innerHTML = `<div class="row"><input type="month" id="pm" value="${per}" style="max-width:170px">${run ? `<span class="chip ${fin ? "g" : "a"}">${fin ? "Finalised" : "Draft"}</span>` : '<span class="chip x">Not made yet</span>'}<span class="grow"></span>
      ${ed() && !fin ? `<button class="btn" id="pgen">${run ? "Make again from attendance" : "Make payroll for " + perName(per)}</button>` : ""}${ed() && run && !fin ? '<button class="btn g" id="pfin">Finalise</button><button class="btn r o" id="pdel">Delete draft</button>' : ""}${run && fin && isAdmin() ? '<button class="btn o" id="pre">Re-open</button>' : ""}</div>
      ${!run ? `<div class="guide">Payroll is made from the attendance of the month: paid days (present, half days, weekly offs, holidays and paid leave), loss of pay, overtime, then PF, ESI and professional tax as set in <a href="#go=setup">Setup</a>. Before you start, make sure the month’s punches are in and press <b>Work out attendance</b> in the Attendance tab (the payroll also does this for days that are not yet worked out). You can adjust any payslip before finalising.</div>` : ""}
      ${run ? `<div class="kpis"><div class="kpi"><b>${tot.employees || slips.length}</b><span>Employees</span></div><div class="kpi" style="--c:#2563eb"><b>₹ ${rs0(tot.gross)}</b><span>Gross earnings</span></div><div class="kpi" style="--c:var(--a)"><b>₹ ${rs0(tot.deduct)}</b><span>Deductions</span></div><div class="kpi" style="--c:var(--g)"><b>₹ ${rs0(tot.net)}</b><span>Net pay</span></div></div>
        ${payWarnings(slips)}
        <div class="row"><button class="btn o s" id="pprint">Print all payslips</button><details class="mm"><summary class="btn o s">Files ▾</summary><div><button class="btn o s" id="pbank">Bank transfer file (CSV)</button><button class="btn o s" id="ppf">PF - ECR file</button><button class="btn o s" id="pesi">ESI - contribution file</button><button class="btn o s" id="pcsv">Salary statement (CSV)</button></div></details>${fin ? `<span class="mut">Finalised by ${esc(run.finalised_by || "")} on ${fmt(run.finalised_at)}</span>` : ""}</div>
        <table><thead><tr><th>Employee</th><th class="num">Paid days</th><th class="num">LOP</th><th class="num">OT h</th><th class="num">Gross</th><th class="num">PF</th><th class="num">ESI</th><th class="num">PT</th><th class="num">Other</th><th class="num">Net pay</th><th></th></tr></thead><tbody>${slips.map((s) => { const d = (c) => (s.deductions.find((x) => x.code === c) || {}).amount || 0, oth = s.deduct - d("PF") - d("ESI") - d("PT"); return `<tr><td>${esc(s.emp_name)}<div class="mut">${esc(s.emp_code)} · ${esc(s.department || "")}</div></td><td class="num">${+s.paid_days}</td><td class="num">${+s.lop_days || ""}</td><td class="num">${+s.ot_hours || ""}</td><td class="num">${rs(s.gross)}</td><td class="num">${d("PF") ? rs0(d("PF")) : ""}</td><td class="num">${d("ESI") ? rs0(d("ESI")) : ""}</td><td class="num">${d("PT") ? rs0(d("PT")) : ""}</td><td class="num">${oth ? rs(oth) : ""}</td><td class="num"><b>${rs(s.net)}</b></td><td><button class="btn o s" data-sl="${s.id}">${ed() && !fin ? "Open / adjust" : "View"}</button></td></tr>`; }).join("")}</tbody></table>` : ""}
      <h3 style="margin:18px 0 6px">Payroll history</h3>${runs.length ? `<table style="min-width:0"><thead><tr><th>Month</th><th>Status</th><th class="num">Employees</th><th class="num">Gross</th><th class="num">Net pay</th><th></th></tr></thead><tbody>${runs.map((r) => `<tr><td>${perName(r.period)}</td><td>${r.status === "final" ? "Finalised" : "Draft"}</td><td class="num">${(r.totals || {}).employees || ""}</td><td class="num">${rs0((r.totals || {}).gross)}</td><td class="num">${rs0((r.totals || {}).net)}</td><td><button class="btn o s" data-pp="${r.period}">Open</button></td></tr>`).join("")}</tbody></table>` : '<div class="note">No payroll made yet.</div>'}`;
    $("#pm").onchange = () => { S.payPeriod = V("pm") || per; drawPay(); };
    document.querySelectorAll("[data-pp]").forEach((b) => (b.onclick = () => { S.payPeriod = b.dataset.pp; drawPay(); window.scrollTo(0, 0); }));
    if ($("#pgen")) $("#pgen").onclick = () => genPayroll(!!run);
    if ($("#pfin")) $("#pfin").onclick = async () => { if (!confirm(`Finalise the payroll of ${perName(per)}? Attendance and leave of this month are locked. Only the administrator can re-open it.`)) return; try { await call("kmr_hrms_payroll_final", { p_id: run.id, p_final: true }); say("Payroll finalised.", true); drawPay(); } catch (e) { say(e.message); } };
    if ($("#pre")) $("#pre").onclick = async () => { if (!confirm("Re-open this payroll? Attendance of the month can then be changed.")) return; try { await call("kmr_hrms_payroll_final", { p_id: run.id, p_final: false }); drawPay(); } catch (e) { say(e.message); } };
    if ($("#pdel")) $("#pdel").onclick = async () => { if (!confirm("Delete this draft payroll?")) return; try { await call("kmr_hrms_payroll_delete", { p_id: run.id }); drawPay(); } catch (e) { say(e.message); } };
    if ($("#pprint")) $("#pprint").onclick = () => printSlips(slips, per);
    document.querySelectorAll("[data-sl]").forEach((b) => (b.onclick = () => slipForm(slips.find((x) => x.id === b.dataset.sl), fin, per)));
    if ($("#pbank")) { $("#pbank").onclick = () => bankFile(slips, per); $("#ppf").onclick = () => pfFile(slips, per); $("#pesi").onclick = () => esiFile(slips, per); $("#pcsv").onclick = () => statement(slips, per); }
  }
  function payWarnings(slips) {
    const w = [], mp = slips.filter((s) => s.info && s.info.missed_punch), un = slips.filter((s) => s.info && s.info.unrecorded);
    if (mp.length) w.push(`${mp.length} employee(s) have a day with a missed punch (counted as absent): ${mp.slice(0, 5).map((s) => esc(s.emp_name)).join(", ")}${mp.length > 5 ? "…" : ""}. Correct it in Attendance, then make the payroll again.`);
    if (un.length) w.push(`${un.length} employee(s) have days with no attendance (${S.payPeriod >= S.load.today.slice(0, 7) ? "the month is not finished" : "attendance not worked out"}); those days are counted as loss of pay.`);
    const nu = slips.filter((s) => s.info && s.info.pf_wage != null && !((S.load.employees.find((e) => e.id === s.employee_id) || {}).uan)); if (nu.length) w.push(`${nu.length} employee(s) with PF have no UAN (needed for the PF file).`);
    return w.length ? `<div class="guide">${w.map((x) => `<div>⚠ ${x}</div>`).join("")}</div>` : "";
  }
  async function genPayroll(again) {
    if (again && !confirm("Make this draft again from attendance? Changes you made to individual payslips will be replaced.")) return;
    const L = S.load, per = S.payPeriod, { from, to } = C.monthRange(per), last = to > L.today ? L.today : to; if (last < from) return say("This month has not started yet.");
    const btn = $("#pgen"); btn.disabled = true; btn.textContent = "Working…";
    try {
      const A = await getAtt(from, to), b = buildFrom(A, from, last);
      if (hasF("hrms.attendance") && !A.locked.includes(per)) { try { await saveRows(b.rows, "auto"); } catch (e) { /* payroll still uses the worked-out days below */ } }
      const rows = merge(A, b.rows), cfgv = cfg();
      const emps = L.employees.filter((e) => (!e.doj || String(e.doj).slice(0, 10) <= to) && (e.status !== "left" || (e.dol && String(e.dol).slice(0, 10) >= from)));
      const noPay = emps.filter((e) => !(+e.basic || +e.hra || +e.special || +e.other_allow)), slips = emps.filter((e) => !noPay.includes(e)).map((e) => C.payOf(e, C.summary(e, rows, per, L.leave_types), per, L.settings));
      if (!slips.length) throw new Error("No employee has a salary set. Enter the salary in Employees first.");
      await call("kmr_hrms_payroll_save", { p: { period: per, month_days: slips[0].info.month_days || C.monthDays(per), slips } });
      say(`Payroll made for ${slips.length} employee(s).` + (noPay.length ? ` ${noPay.length} employee(s) without a salary were left out (${noPay.slice(0, 4).map((e) => e.name).join(", ")}${noPay.length > 4 ? "…" : ""}).` : ""), true);
    } catch (e) { say(e.message); }
    drawPay();
  }
  function slipForm(s, fin, per) {
    const can = ed() && !fin, line = (kind, x, i) => `<div class="ln" style="grid-template-columns:1fr 130px auto;margin-bottom:4px"><input data-k="${kind}" data-i="${i}" data-f="name" value="${esc(x.name)}"${can && !["BASIC", "HRA", "SPL", "OTH", "OT", "PF", "ESI", "PT"].includes(x.code) ? "" : " disabled"}><input data-k="${kind}" data-i="${i}" data-f="amount" type="number" step="0.01" value="${x.amount}"${can ? "" : " disabled"}>${can && !["BASIC", "HRA", "SPL", "OTH", "OT", "PF", "ESI", "PT"].includes(x.code) ? `<button class="btn r s" data-rm="${kind}|${i}">✕</button>` : "<span></span>"}</div>`;
    const sl = JSON.parse(JSON.stringify(s)), draw = () => {
      C.reslip(sl); const i = sl.info || {};
      $("#sbody").innerHTML = `<div class="kv"><div><span>Paid days</span><b>${+sl.paid_days}</b></div><div><span>Loss of pay</span><b>${+sl.lop_days}</b></div><div><span>Overtime hours</span><b>${+sl.ot_hours}</b></div><div><span>Present / half / absent</span><b>${i.present || 0} / ${i.half_days || 0} / ${i.absent || 0}</b></div><div><span>Late days</span><b>${i.late_count || 0}</b></div></div>
        <div class="frm" style="margin-top:10px"><div><h4 style="margin:0 0 6px">Earnings</h4>${sl.earnings.map((x, k) => line("earnings", x, k)).join("")}${can ? '<button class="btn o s" id="aer">+ Add earning</button>' : ""}</div><div><h4 style="margin:0 0 6px">Deductions</h4>${sl.deductions.map((x, k) => line("deductions", x, k)).join("")}${can ? '<button class="btn o s" id="add">+ Add deduction (advance, loan …)</button>' : ""}</div></div>
        <div class="kpis" style="margin-top:12px"><div class="kpi"><b>${rs(sl.gross)}</b><span>Gross</span></div><div class="kpi" style="--c:var(--a)"><b>${rs(sl.deduct)}</b><span>Deductions</span></div><div class="kpi" style="--c:var(--g)"><b>${rs(sl.net)}</b><span>Net pay</span></div></div>
        ${i.er_eps != null ? `<div class="note">Employer’s PF share: EPS ₹ ${i.er_eps}, EPF ₹ ${i.er_epf}, admin ₹ ${i.er_admin}, EDLI ₹ ${i.er_edli}${i.er_esi != null ? `; ESI ₹ ${i.er_esi}` : ""} (not deducted from the employee).</div>` : i.er_esi != null ? `<div class="note">Employer’s ESI share: ₹ ${i.er_esi}.</div>` : ""}`;
      document.querySelectorAll("#sbody [data-k]").forEach((inp) => (inp.onchange = () => { const x = sl[inp.dataset.k][+inp.dataset.i]; if (inp.dataset.f === "amount") x.amount = C.r2(inp.value); else x.name = inp.value; draw(); }));
      document.querySelectorAll("#sbody [data-rm]").forEach((b) => (b.onclick = () => { const [k, n] = b.dataset.rm.split("|"); sl[k].splice(+n, 1); draw(); }));
      if ($("#aer")) $("#aer").onclick = () => { sl.earnings.push({ code: "X", name: "Bonus / arrears", amount: 0 }); draw(); }; if ($("#add")) $("#add").onclick = () => { sl.deductions.push({ code: "X", name: "Advance recovery", amount: 0 }); draw(); };
    };
    open(`<div class="row"><b class="grow" style="font-size:16px">${esc(s.emp_name)} · ${esc(s.emp_code)} · ${perName(per)}</b><button class="btn o s" id="xc">Close</button></div><div id="sbody"></div>
      <div class="row" style="margin-top:12px">${can ? '<button class="btn" id="ssave">Save payslip</button>' : ""}<button class="btn o" id="sprint">Print</button><span class="mut" id="smsg"></span></div>`);
    draw(); $("#xc").onclick = closeM; $("#sprint").onclick = () => printSlips([sl], per);
    if ($("#ssave")) $("#ssave").onclick = async () => { try { await call("kmr_hrms_payslip_save", { p: { id: sl.id, earnings: sl.earnings, deductions: sl.deductions, gross: sl.gross, deduct: sl.deduct, net: sl.net, info: sl.info } }); closeM(); say("Payslip saved.", true); drawPay(); } catch (e) { $("#smsg").textContent = e.message; $("#smsg").style.color = "var(--r)"; } };
  }
  function printSlips(slips, per) {
    const co = QP.ctx.company, emp = (id) => S.load.employees.find((e) => e.id === id) || {};
    const doc = (s) => { const e = emp(s.employee_id), n = Math.max(s.earnings.length, s.deductions.length), i = s.info || {};
      return `<div class="doc slip"><div class="hd"><div><h2>${esc(co)}</h2><div>Payslip for ${perName(per)}</div></div><div style="text-align:right"><b>${esc(s.emp_code)}</b></div></div>
      <table class="hdr" style="width:100%;margin:8px 0"><tr><th>Name</th><td>${esc(s.emp_name)}</td><th>Department</th><td>${esc(s.department || "")}</td></tr><tr><th>Designation</th><td>${esc(s.designation || "")}</td><th>Date of joining</th><td>${e.doj ? fmt(e.doj) : ""}</td></tr>
      <tr><th>UAN</th><td>${esc(e.uan || "")}</td><th>ESI no.</th><td>${esc(e.esi_no || "")}</td></tr><tr><th>Bank account</th><td>${e.bank_account ? "XXXX" + esc(String(e.bank_account).slice(-4)) + " " + esc(e.bank_name || "") : ""}</td><th>Days: paid / loss of pay</th><td>${+s.paid_days} / ${+s.lop_days} (of ${i.month_days || ""})</td></tr></table>
      <table style="width:100%"><thead><tr><th>Earnings</th><th class="right">Amount (₹)</th><th>Deductions</th><th class="right">Amount (₹)</th></tr></thead><tbody>${Array.from({ length: n }, (_, k) => `<tr><td>${esc((s.earnings[k] || {}).name || "")}</td><td class="right">${s.earnings[k] ? rs(s.earnings[k].amount) : ""}</td><td>${esc((s.deductions[k] || {}).name || "")}</td><td class="right">${s.deductions[k] ? rs(s.deductions[k].amount) : ""}</td></tr>`).join("")}
      <tr><th>Gross earnings</th><th class="right">${rs(s.gross)}</th><th>Total deductions</th><th class="right">${rs(s.deduct)}</th></tr><tr><th colspan="3" style="font-size:13px">NET PAY</th><th class="right" style="font-size:13px">${rs(s.net)}</th></tr></tbody></table>
      <p style="margin:8px 0">Net pay in words: <b>Rupees ${esc(words(s.net))} only</b></p><div class="sg"><span>Employer</span><span>Employee</span></div><p class="mut" style="font-size:9px">This is a computer generated payslip.</p></div>`; };
    open(`<div class="row noprint"><b class="grow">Payslips · ${perName(per)}</b><button class="btn" id="pgo">Print</button><button class="btn o s" id="pcl">Close</button></div>${slips.map(doc).join("")}`);
    $("#pgo").onclick = () => window.print(); $("#pcl").onclick = closeM;
  }
  const empOf = (s) => S.load.employees.find((e) => e.id === s.employee_id) || {};
  function bankFile(slips, per) { dl(`bank-transfer-${per}.csv`, toCsv([["Employee code", "Name", "Bank", "Account number", "IFSC", "Amount", "Narration"], ...slips.filter((s) => s.net > 0).map((s) => { const e = empOf(s); return [s.emp_code, s.emp_name, e.bank_name || "", e.bank_account || "", e.ifsc || "", s.net.toFixed ? (+s.net).toFixed(2) : s.net, "Salary " + perName(per)]; })]), "text/csv"); }
  function pfFile(slips, per) {
    const rows = slips.filter((s) => s.deductions.some((d) => d.code === "PF")), miss = rows.filter((s) => !empOf(s).uan);
    if (!rows.length) return say("No employee has PF in this payroll.");
    if (miss.length && !confirm(`${miss.length} employee(s) have no UAN and will have an empty UAN in the file. Continue?`)) return;
    // EPFO ECR text format: UAN#~#name#~#gross#~#EPF wages#~#EPS wages#~#EDLI wages#~#EPF contribution#~#EPS contribution#~#difference#~#NCP days#~#refund
    dl(`pf-ecr-${per}.txt`, rows.map((s) => { const i = s.info, ee = s.deductions.find((d) => d.code === "PF").amount; return [empOf(s).uan || "", s.emp_name, Math.round(s.gross), i.pf_wage, i.pf_wage, i.pf_wage, ee, i.er_eps, i.er_epf, Math.round(s.lop_days), 0].join("#~#"); }).join("\r\n"), "text/plain");
    say("PF file made. Check it on the EPFO portal (ECR upload) before submitting; the portal validates every line.", true);
  }
  function esiFile(slips, per) {
    const rows = slips.filter((s) => s.deductions.some((d) => d.code === "ESI")); if (!rows.length) return say("No employee has ESI in this payroll.");
    dl(`esi-${per}.csv`, toCsv([["IP number", "IP name", "No. of days", "Total monthly wages", "Reason code (0 = none)", "Last working day"], ...rows.map((s) => { const e = empOf(s); return [e.esi_no || "", s.emp_name, +s.paid_days, Math.round(s.info.esi_wage || s.gross), s.paid_days <= 0 ? 1 : 0, e.dol ? String(e.dol).slice(0, 10) : ""]; })]), "text/csv");
  }
  function statement(slips, per) {
    const eh = [...new Set(slips.flatMap((s) => s.earnings.map((x) => x.name)))], dh = [...new Set(slips.flatMap((s) => s.deductions.map((x) => x.name)))];
    const sum = (arr, n) => arr.filter((x) => x.name === n).reduce((a, x) => a + +x.amount, 0);
    dl(`salary-statement-${per}.csv`, toCsv([["Code", "Name", "Department", "Paid days", "LOP days", "OT hours", ...eh, "Gross", ...dh, "Total deductions", "Net pay"], ...slips.map((s) => [s.emp_code, s.emp_name, s.department || "", +s.paid_days, +s.lop_days, +s.ot_hours, ...eh.map((h) => sum(s.earnings, h)), s.gross, ...dh.map((h) => sum(s.deductions, h)), s.deduct, s.net])]), "text/csv");
  }

  /* ================= setup ================= */
  function drawSetup() {
    const L = S.load, c = cfg(), el = $("#setup");
    const n = (id, label, v, step) => `<div><label class="lbl" for="${id}">${label}</label><input id="${id}" type="number" step="${step || "any"}" value="${v}"></div>`;
    el.innerHTML = `<div class="row"><b class="grow" style="font-size:15px">Company rules</b>${ed() ? '<button class="btn" id="ssv">Save rules</button>' : ""}</div>
      <datalist id="dl_tz">${["Asia/Kolkata", "Asia/Dubai", "Asia/Kathmandu", "Asia/Colombo", "Asia/Dhaka", "Asia/Karachi", "Asia/Singapore", "Asia/Riyadh", "Europe/London", "UTC"].map((z) => `<option>${z}</option>`).join("")}</datalist>
      <div class="frm"><div><label class="lbl">Time zone of the machines</label><input id="s_tz" list="dl_tz" value="${esc(c.tz)}"></div><div><label class="lbl">Employee code prefix</label><input id="s_pre" value="${esc(c.emp_prefix)}"></div>
        <div><label class="lbl">Days in a month for pay</label><select id="s_md">${opts([["calendar", "Actual days of the month"], ["26", "Fixed 26 days"], ["30", "Fixed 30 days"]], String(c.month_days_mode))}</select></div>${n("s_gap", "Ignore a second punch within (minutes)", c.min_gap_min)}</div>
      <h4 style="margin:14px 0 4px">Overtime</h4><div class="frm">${n("s_otm", "Pay rate (× normal hourly)", c.ot_multiplier)}${n("s_ota", "Counts only after (minutes beyond shift end)", c.ot_min_after)}${n("s_otd", "Days to divide basic by (monthly staff)", c.ot_day_divisor)}${n("s_oth", "Hours in a day", c.ot_hours_per_day)}</div>
      <h4 style="margin:14px 0 4px">Provident fund, ESI and professional tax</h4><div class="note">Statutory rates and limits change; check the current ones before you run payroll. The values below are the common ones in India.</div>
      <div class="frm">${n("s_pfr", "PF employee % of basic", c.pf_rate)}${n("s_pfc", "PF wage ceiling ₹ / month", c.pf_wage_cap)}${n("s_eps", "EPS % (employer)", c.eps_rate)}${n("s_pfa", "PF admin charge %", c.pf_admin_rate)}${n("s_edli", "EDLI %", c.edli_rate)}${n("s_esie", "ESI employee %", c.esi_emp_rate)}${n("s_esir", "ESI employer %", c.esi_er_rate)}${n("s_esil", "ESI applies up to monthly gross ₹", c.esi_limit)}</div>
      <div style="margin-top:8px"><label class="lbl">Professional tax slabs (one line per slab: <i>monthly gross from, tax amount</i>) - set your state’s slabs</label><textarea id="s_pt" rows="4" style="font-family:ui-monospace,monospace">${esc((c.pt_slabs || []).map((x) => x.from + "," + x.amount).join("\n"))}</textarea></div>
      <h3 style="margin:22px 0 6px">Shifts</h3>${ed() ? '<button class="btn o s" id="shadd">+ Add shift</button>' : ""}
      <table><thead><tr><th>Name</th><th>Timing</th><th class="num">Grace</th><th class="num">Break</th><th class="num">Half day ≥</th><th class="num">Full day ≥</th><th>Weekly off</th><th></th></tr></thead><tbody>${L.shifts.map((s) => `<tr><td>${esc(s.name)}${s.night ? " 🌙" : ""}${s.active ? "" : ' <span class="chip x">inactive</span>'}</td><td>${esc(s.start_time)} – ${esc(s.end_time)}</td><td class="num">${s.grace_min} min</td><td class="num">${s.break_min} min</td><td class="num">${(s.half_day_min / 60).toFixed(1)} h</td><td class="num">${(s.full_day_min / 60).toFixed(1)} h</td><td>${(s.weekly_off || []).map((d) => DOW[d]).join(", ") || "none"}</td><td>${ed() ? `<button class="btn o s" data-sh="${s.id}">Edit</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="8" class="mut">No shift yet. Without a shift, 09:00–18:00 with Sunday off is used.</td></tr>'}</tbody></table>
      <h3 style="margin:22px 0 6px">Holidays</h3>${ed() ? '<div class="row"><input type="date" id="h_d" style="max-width:160px"><input id="h_n" placeholder="Holiday name" style="max-width:260px"><button class="btn o s" id="hadd">+ Add holiday</button></div>' : ""}
      ${L.holidays.length ? `<table style="min-width:0"><tbody>${L.holidays.map((h) => `<tr><td>${fmt(h.hdate)}</td><td>${esc(h.name)}</td><td class="num">${ed() ? `<button class="btn r o s" data-hd="${h.id}">Remove</button>` : ""}</td></tr>`).join("")}</tbody></table>` : '<div class="note">No holidays listed.</div>'}
      <h3 style="margin:22px 0 6px">Leave types</h3>${ed() ? '<button class="btn o s" id="ltadd">+ Add leave type</button>' : ""}
      <table style="min-width:0"><thead><tr><th>Code</th><th>Name</th><th>Pay</th><th class="num">Yearly quota</th><th></th></tr></thead><tbody>${L.leave_types.map((t) => `<tr><td>${esc(t.code)}</td><td>${esc(t.name)}${t.active ? "" : ' <span class="chip x">inactive</span>'}</td><td>${t.paid ? "Paid" : "Unpaid (loss of pay)"}</td><td class="num">${+t.annual_quota || "–"}</td><td>${ed() ? `<button class="btn o s" data-lt="${t.id}">Edit</button>` : ""}</td></tr>`).join("")}</tbody></table>
      <h3 style="margin:22px 0 6px">Backup</h3><div class="row"><button class="btn o" id="bex">Export JSON</button>${ed() ? '<button class="btn o" id="bim">Import JSON</button>' : ""}</div><div class="note">The backup holds company rules, shifts, holidays, leave types and employees (not punches, attendance or payroll, which stay in the database and are backed up daily). Import adds what is missing.</div>`;
    if ($("#ssv")) $("#ssv").onclick = saveSettings;
    if ($("#shadd")) $("#shadd").onclick = () => shiftForm(null); document.querySelectorAll("[data-sh]").forEach((b) => (b.onclick = () => shiftForm(L.shifts.find((x) => x.id === b.dataset.sh))));
    if ($("#hadd")) $("#hadd").onclick = async () => { try { await call("kmr_hrms_holiday_save", { p: { hdate: V("h_d"), name: V("h_n") } }); await loadAll(); drawSetup(); } catch (e) { say(e.message); } };
    document.querySelectorAll("[data-hd]").forEach((b) => (b.onclick = async () => { try { await call("kmr_hrms_holiday_delete", { p_id: b.dataset.hd }); await loadAll(); drawSetup(); } catch (e) { say(e.message); } }));
    if ($("#ltadd")) $("#ltadd").onclick = () => ltForm(null); document.querySelectorAll("[data-lt]").forEach((b) => (b.onclick = () => ltForm(L.leave_types.find((x) => x.id === b.dataset.lt))));
    $("#bex").onclick = backup; if ($("#bim")) $("#bim").onclick = restore;
  }
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  async function saveSettings() {
    try {
      const slabs = V("s_pt").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [a, b] = l.split(/[,\s]+/); if (!Number.isFinite(+a) || !Number.isFinite(+b)) throw new Error("Professional tax slab lines must look like: 15000,200"); return { from: +a, amount: +b }; });
      if (!slabs.some((x) => x.from === 0)) slabs.unshift({ from: 0, amount: 0 });
      const p = Object.assign({}, S.load.settings, { tz: V("s_tz").trim() || "Asia/Kolkata", emp_prefix: V("s_pre").trim() || "E", month_days_mode: V("s_md") === "calendar" ? "calendar" : +V("s_md"), min_gap_min: +V("s_gap"), ot_multiplier: +V("s_otm"), ot_min_after: +V("s_ota"), ot_day_divisor: +V("s_otd"), ot_hours_per_day: +V("s_oth"),
        pf_rate: +V("s_pfr"), pf_wage_cap: +V("s_pfc"), eps_rate: +V("s_eps"), pf_admin_rate: +V("s_pfa"), edli_rate: +V("s_edli"), esi_emp_rate: +V("s_esie"), esi_er_rate: +V("s_esir"), esi_limit: +V("s_esil"), pt_slabs: slabs });
      try { new Intl.DateTimeFormat("en", { timeZone: p.tz }); } catch (e) { throw new Error("The time zone “" + p.tz + "” is not known. Example: Asia/Kolkata"); }
      await call("kmr_hrms_settings_save", { p }); await loadAll(); say("Rules saved.", true);
    } catch (e) { say(e.message); }
  }
  function shiftForm(s) {
    s = s || { name: "", start_time: "09:00", end_time: "18:00", grace_min: 10, break_min: 30, half_day_min: 240, full_day_min: 450, night: false, weekly_off: [0], active: true };
    const f = (id, label, v, type) => `<div><label class="lbl" for="${id}">${label}</label><input id="${id}" type="${type || "number"}" value="${esc(v)}"></div>`;
    open(`<div class="row"><b class="grow" style="font-size:16px">${s.id ? "Shift · " + esc(s.name) : "Add shift"}</b><button class="btn o s" id="xc">Close</button></div><div class="frm">${f("h_name", "Name *", s.name, "text")}${f("h_st", "Starts", s.start_time, "time")}${f("h_en", "Ends", s.end_time, "time")}${f("h_gr", "Grace for late arrival (min)", s.grace_min)}${f("h_br", "Break to deduct (min)", s.break_min)}${f("h_hd", "Half day if worked at least (min)", s.half_day_min)}${f("h_fd", "Full day if worked at least (min)", s.full_day_min)}</div>
      <div class="row" style="margin-top:8px"><span class="lbl" style="margin:0">Weekly off</span>${DOW.map((d, i) => `<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" class="h_wo" value="${i}" style="width:auto"${(s.weekly_off || []).includes(i) ? " checked" : ""}>${d}</label>`).join("")}<label style="display:flex;gap:5px;align-items:center;margin-left:auto"><input type="checkbox" id="h_ng" style="width:auto"${s.night ? " checked" : ""}> Night shift (ends next morning)</label><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="h_ac" style="width:auto"${s.active ? " checked" : ""}> Active</label></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="hsave">Save</button>${s.id ? '<button class="btn r o" id="hdel">Delete</button>' : ""}<span class="mut" id="hmsg"></span></div>`);
    $("#xc").onclick = closeM;
    $("#hsave").onclick = async () => { try { await call("kmr_hrms_shift_save", { p: { id: s.id, name: V("h_name"), start_time: V("h_st"), end_time: V("h_en"), grace_min: V("h_gr"), break_min: V("h_br"), half_day_min: V("h_hd"), full_day_min: V("h_fd"), weekly_off: [...document.querySelectorAll(".h_wo:checked")].map((x) => +x.value), night: V("h_ng"), active: V("h_ac") } }); closeM(); await loadAll(); drawSetup(); } catch (e) { $("#hmsg").textContent = e.message; $("#hmsg").style.color = "var(--r)"; } };
    if ($("#hdel")) $("#hdel").onclick = async () => { if (!confirm("Delete this shift?")) return; try { await call("kmr_hrms_shift_delete", { p_id: s.id }); closeM(); await loadAll(); drawSetup(); } catch (e) { $("#hmsg").textContent = e.message; } };
  }
  function ltForm(t) {
    t = t || { code: "", name: "", paid: true, annual_quota: 0, active: true };
    open(`<div class="row"><b class="grow" style="font-size:16px">${t.id ? "Leave type · " + esc(t.code) : "Add leave type"}</b><button class="btn o s" id="xc">Close</button></div><div class="frm"><div><label class="lbl">Code *</label><input id="t_c" value="${esc(t.code)}" maxlength="6"></div><div><label class="lbl">Name *</label><input id="t_n" value="${esc(t.name)}"></div><div><label class="lbl">Yearly quota (days, 0 = no limit)</label><input id="t_q" type="number" step="0.5" value="${+t.annual_quota}"></div>
      <div style="display:flex;gap:16px;align-items:end"><label style="display:flex;gap:5px;align-items:center;font-weight:600"><input type="checkbox" id="t_p" style="width:auto"${t.paid ? " checked" : ""}> Paid leave</label><label style="display:flex;gap:5px;align-items:center;font-weight:600"><input type="checkbox" id="t_a" style="width:auto"${t.active ? " checked" : ""}> Active</label></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="tsave">Save</button>${t.id ? '<button class="btn r o" id="tdel">Delete</button>' : ""}<span class="mut" id="tmsg"></span></div>`);
    $("#xc").onclick = closeM;
    $("#tsave").onclick = async () => { try { await call("kmr_hrms_leave_type_save", { p: { id: t.id, code: V("t_c"), name: V("t_n"), annual_quota: V("t_q"), paid: V("t_p"), active: V("t_a") } }); closeM(); await loadAll(); drawSetup(); } catch (e) { $("#tmsg").textContent = e.message; $("#tmsg").style.color = "var(--r)"; } };
    if ($("#tdel")) $("#tdel").onclick = async () => { if (!confirm("Delete this leave type?")) return; try { await call("kmr_hrms_leave_type_delete", { p_id: t.id }); closeM(); await loadAll(); drawSetup(); } catch (e) { $("#tmsg").textContent = e.message; } };
  }
  function backup() {
    const L = S.load; dl(`hrm-backup-${L.today}.json`, JSON.stringify({ app: "hrms", version: 1, exported_at: new Date().toISOString(), company: QP.ctx.company, settings: L.settings, shifts: L.shifts.map((s) => ({ name: s.name, start_time: s.start_time, end_time: s.end_time, grace_min: s.grace_min, break_min: s.break_min, half_day_min: s.half_day_min, full_day_min: s.full_day_min, night: s.night, weekly_off: s.weekly_off, active: s.active })),
      holidays: L.holidays.map((h) => ({ hdate: h.hdate, name: h.name })), leave_types: L.leave_types.map((t) => ({ code: t.code, name: t.name, paid: t.paid, annual_quota: t.annual_quota, active: t.active })), employees: L.employees.map((e) => Object.assign({}, e, { shift_name: (shiftOf(e) || {}).name || null })) }, null, 1), "application/json");
  }
  function restore() {
    pickFile(".json", async (text) => {
      try {
        const b = JSON.parse(text); if (b.app !== "hrms") throw new Error("This is not an HRM & Payroll backup file.");
        if (!confirm(`Add what is missing from this backup (${(b.employees || []).length} employees, ${(b.shifts || []).length} shifts)? Existing records with the same name or code are kept.`)) return;
        const L = S.load; if (b.settings && !Object.keys(L.settings || {}).length) await call("kmr_hrms_settings_save", { p: b.settings });
        for (const s of b.shifts || []) if (!L.shifts.some((x) => x.name.toLowerCase() === String(s.name).toLowerCase())) await call("kmr_hrms_shift_save", { p: s });
        if ((b.holidays || []).length) await call("kmr_hrms_holiday_save", { p: { rows: b.holidays } });
        for (const t of b.leave_types || []) if (!L.leave_types.some((x) => x.code === String(t.code).toUpperCase())) await call("kmr_hrms_leave_type_save", { p: t });
        const have = new Set(L.employees.map((e) => e.emp_code)), rows = (b.employees || []).filter((e) => !have.has(e.emp_code)).map((e) => { const o = Object.assign({}, e); delete o.id; delete o.shift_id; return o; });
        const r = rows.length ? await call("kmr_hrms_employees_import", { p: { rows } }) : { added: 0, errors: [] };
        await loadAll(); drawSetup(); say(`Backup added: ${r.added} employee(s)` + (r.errors.length ? `, ${r.errors.length} not added (${r.errors[0].error})` : "") + ".", !r.errors.length);
      } catch (e) { say(e.message); }
    });
  }

  (async () => { try { await QP.init("hrms"); if (!QP.ctx) return; await route(); } catch (e) { say(e.message); } })();
})();
