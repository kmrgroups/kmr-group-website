/* HRM & Payroll - the rules that turn machine punches into attendance and attendance into pay.
   Pure functions (no screen, no database) so they can be tested on their own: node scripts/test-hrm-calc.js
   Times: a punch is a UTC instant; the company's time zone (settings.tz, default Asia/Kolkata) decides which day it belongs to. */
(function (root) {
  "use strict";
  const DAY = 864e5;
  const DEFAULTS = {
    tz: "Asia/Kolkata", emp_prefix: "E",
    month_days_mode: "calendar",              // calendar = actual days of the month; or a fixed number such as 26 or 30
    ot_multiplier: 2, ot_min_after: 30, ot_day_divisor: 26, ot_hours_per_day: 8,
    pf_rate: 12, pf_wage_cap: 15000, eps_rate: 8.33, pf_admin_rate: 0.5, edli_rate: 0.5,
    esi_emp_rate: 0.75, esi_er_rate: 3.25, esi_limit: 21000,
    pt_slabs: [{ from: 0, amount: 0 }],       // professional tax by monthly gross; set the state's slabs in Setup
    min_gap_min: 5,                           // two punches closer than this are one punch (double touch)
  };
  const cfg = (s) => Object.assign({}, DEFAULTS, s || {});
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };

  /* ---------- dates in the company time zone ---------- */
  const fmtCache = {};
  function fmt(tz) {
    return fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
  }
  function local(ts, tz) {                    // -> {date: 'YYYY-MM-DD', min: minutes after local midnight}
    const p = {}; fmt(tz).formatToParts(new Date(ts)).forEach((x) => { p[x.type] = x.value; });
    return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour) * 60 + (+p.minute) };
  }
  const dnum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;       // date -> day number
  const dstr = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const addDays = (d, n) => dstr(dnum(d) + n);
  const dow = (d) => new Date(dnum(d) * DAY).getUTCDay();                                         // 0 = Sunday
  const monthDays = (period) => { const y = +period.slice(0, 4), m = +period.slice(5, 7); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const monthRange = (period) => ({ from: period + "-01", to: period + "-" + String(monthDays(period)).padStart(2, "0") });
  const rel = (ts, workDate, tz) => { const l = local(ts, tz); return (dnum(l.date) - dnum(workDate)) * 1440 + l.min; };   // minutes from the work date's midnight
  const hhmm = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const clock = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

  /* the day a punch counts for: day shifts = the calendar day; night shifts = the day the shift started (punch minus 8 hours) */
  function workDateOf(ts, shift, tz) {
    return local(shift && shift.night ? new Date(ts).getTime() - 8 * 36e5 : ts, tz).date;
  }

  const DEFAULT_SHIFT = { name: "General", start_time: "09:00", end_time: "18:00", grace_min: 10, break_min: 30, half_day_min: 240, full_day_min: 450, night: false, weekly_off: [0] };

  /* ---------- one employee, one day ----------
     ctx: {tz, holidays:{date:name}, leaves:[{employee_id, from_date, to_date, half, leave_code, paid}], today, settings} */
  function dayRow(emp, shift, date, punches, ctx) {
    const s = cfg(ctx.settings), tz = s.tz, sh = shift || DEFAULT_SHIFT;
    const row = { employee_id: emp.id, work_date: date, in_at: null, out_at: null, worked_min: 0, late_min: 0, early_min: 0, ot_min: 0, status: "A", leave_code: null, source: "punch", remarks: null };
    if (emp.doj && date < String(emp.doj).slice(0, 10)) return null;
    if (emp.dol && date > String(emp.dol).slice(0, 10)) return null;
    const mine = punches.slice().sort((a, b) => new Date(a) - new Date(b));
    // remove double touches
    const ps = []; mine.forEach((t) => { const ms = new Date(t).getTime(); if (!ps.length || ms - ps[ps.length - 1] >= s.min_gap_min * 6e4) ps.push(ms); });
    const hol = ctx.holidays && ctx.holidays[date];
    const wo = (sh.weekly_off || []).includes(dow(date));
    const lv = (ctx.leaves || []).find((l) => l.employee_id === emp.id && l.from_date <= date && l.to_date >= date);
    const worked = () => {
      const first = ps[0], last = ps[ps.length - 1];
      row.in_at = new Date(first).toISOString();
      if (ps.length < 2) {
        if (date === ctx.today) { row.status = "P"; row.remarks = "Not punched out yet"; return; }                  // the day is still running
        row.status = "MP"; row.remarks = "One punch only - enter the missing punch"; return;
      }
      row.out_at = new Date(last).toISOString();
      const span = Math.round((last - first) / 6e4);
      row.worked_min = Math.max(0, span - (span > sh.half_day_min ? num(sh.break_min) : 0));
      const st = hhmm(sh.start_time), en0 = hhmm(sh.end_time);
      if (st != null && en0 != null) {
        const en = en0 <= st ? en0 + 1440 : en0;                                                        // night shift ends next morning
        const inM = rel(first, date, tz), outM = rel(last, date, tz);
        row.late_min = inM > st + num(sh.grace_min) ? inM - st : 0;
        row.early_min = outM < en ? en - outM : 0;
        const extra = outM - en;
        row.ot_min = emp.ot_eligible && extra >= s.ot_min_after ? extra : 0;
      }
      row.status = row.worked_min >= sh.full_day_min ? "P" : row.worked_min >= sh.half_day_min ? "HD" : "A";
      if (row.status === "A") row.remarks = "Worked less than a half day";
    };
    if (hol) {
      if (ps.length) { worked(); if (row.status !== "MP") row.status = "P"; row.remarks = "Worked on holiday: " + hol; }
      else { row.status = "H"; row.source = "rule"; row.remarks = hol; }
      return row;
    }
    if (wo) {
      if (ps.length) { worked(); if (row.status !== "MP") row.status = "P"; row.remarks = "Worked on weekly off"; }
      else { row.status = "WO"; row.source = "rule"; }
      return row;
    }
    if (lv) {
      row.leave_code = lv.leave_code || null; row.source = "leave";
      if (lv.half) { row.status = "HD"; row.remarks = "Half-day leave"; if (ps.length > 1) { worked(); row.status = "HD"; row.source = "leave"; row.remarks = "Half-day leave"; } return row; }
      row.status = lv.paid === false ? "U" : "L"; return row;
    }
    if (ps.length) { worked(); return row; }
    if (date > ctx.today) return null;                                                                 // future days have no row yet
    row.status = "A"; row.source = "rule"; row.remarks = "No punch";
    return row;
  }

  /* ---------- a period for many employees ----------
     data: {employees, shifts, punches:[{employee_id, bio_id, at}], holidays:[{hdate}], leaves, existing:[attendance rows]} */
  function buildAttendance(data, from, to, settings, today) {
    const s = cfg(settings), tz = s.tz, shifts = {}; (data.shifts || []).forEach((x) => { shifts[x.id] = x; });
    const firstShift = (data.shifts || []).find((x) => x.active !== false) || DEFAULT_SHIFT;
    const byBio = {}; (data.employees || []).forEach((e) => { if (e.bio_id) byBio[String(e.bio_id)] = e; });
    const hol = {}; (data.holidays || []).forEach((h) => { hol[String(h.hdate).slice(0, 10)] = h.name; });
    const manual = {}; (data.existing || []).forEach((r) => { if (r.source === "manual") manual[r.employee_id + "|" + String(r.work_date).slice(0, 10)] = 1; });
    const ctx = { settings: s, holidays: hol, leaves: data.leaves || [], today: today || local(Date.now(), tz).date };
    // sort punches into employee -> work date
    const bucket = {}, unknown = {};
    (data.punches || []).forEach((p) => {
      const e = (p.employee_id && (data.employees || []).find((x) => x.id === p.employee_id)) || byBio[String(p.bio_id)];
      if (!e) { unknown[p.bio_id] = (unknown[p.bio_id] || 0) + 1; return; }
      const sh = shifts[e.shift_id] || firstShift, d = workDateOf(p.at, sh, tz);
      if (d < from || d > to) return;
      const k = e.id + "|" + d; (bucket[k] || (bucket[k] = [])).push(p.at);
    });
    const rows = [];
    (data.employees || []).forEach((e) => {
      if (e.status === "left" && !e.dol) return;
      const sh = shifts[e.shift_id] || firstShift;
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (manual[e.id + "|" + d]) continue;                                                           // hand-entered days stay as they are
        const r = dayRow(e, sh, d, bucket[e.id + "|" + d] || [], ctx);
        if (r) rows.push(r);
      }
    });
    return { rows, unknown };
  }

  /* ---------- month summary of one employee from attendance rows ---------- */
  function summary(emp, rows, period, leaveTypes) {
    const days = monthDays(period), { from, to } = monthRange(period);
    const paidCode = {}; (leaveTypes || []).forEach((t) => { paidCode[t.code] = t.paid !== false; });
    const by = {}; rows.forEach((r) => { if (r.employee_id === emp.id) by[String(r.work_date).slice(0, 10)] = r; });
    const o = { days, present: 0, hd: 0, wo: 0, h: 0, paid_leave: 0, unpaid_leave: 0, absent: 0, missed: 0, unrecorded: 0, outside: 0, paid_days: 0, lop_days: 0, ot_min: 0, late_count: 0, late_min: 0 };
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const outside = (emp.doj && d < String(emp.doj).slice(0, 10)) || (emp.dol && d > String(emp.dol).slice(0, 10));
      if (outside) { o.outside++; continue; }
      const r = by[d];
      if (!r) { o.unrecorded++; continue; }
      o.ot_min += num(r.ot_min); if (num(r.late_min) > 0) { o.late_count++; o.late_min += num(r.late_min); }
      switch (r.status) {
        case "P": o.present++; o.paid_days += 1; break;
        case "HD": o.hd++; o.paid_days += 0.5; if (r.leave_code && paidCode[r.leave_code] !== false) { o.paid_leave += 0.5; o.paid_days += 0.5; } break;
        case "WO": o.wo++; o.paid_days += 1; break;
        case "H": o.h++; o.paid_days += 1; break;
        case "L": o.paid_leave++; o.paid_days += 1; break;
        case "U": o.unpaid_leave++; break;
        case "MP": o.missed++; break;
        default: o.absent++;
      }
    }
    o.lop_days = r2(days - o.outside - o.paid_days);
    o.paid_days = r2(o.paid_days);
    return o;
  }

  /* ---------- pay of one employee for one month ---------- */
  function payOf(emp, sum, period, settings) {
    const s = cfg(settings), md = s.month_days_mode === "calendar" ? monthDays(period) : Math.max(1, num(s.month_days_mode, 30));
    const daily = emp.pay_type === "daily";
    const full = { basic: num(emp.basic), hra: num(emp.hra), special: num(emp.special), other: num(emp.other_allow) };
    const grossMonthly = full.basic + full.hra + full.special + full.other;
    const f = daily ? sum.paid_days : sum.paid_days / md;
    const earn = (name, code, v) => ({ code, name, amount: r2(v * f) });
    const earnings = [earn("Basic", "BASIC", full.basic), earn("House rent allowance", "HRA", full.hra), earn("Special allowance", "SPL", full.special), earn("Other allowance", "OTH", full.other)].filter((x) => x.amount !== 0 || x.code === "BASIC");
    let otHours = 0, otPay = 0;
    if (emp.ot_eligible && sum.ot_min > 0) {
      otHours = r2(sum.ot_min / 60);
      const hourly = daily ? full.basic / s.ot_hours_per_day : full.basic / s.ot_day_divisor / s.ot_hours_per_day;
      otPay = r2(otHours * hourly * s.ot_multiplier);
      earnings.push({ code: "OT", name: "Overtime", amount: otPay });
    }
    const earnedBasic = earnings.find((x) => x.code === "BASIC").amount;
    const gross = r2(earnings.reduce((a, x) => a + x.amount, 0));
    const deductions = [], info = { month_days: md, gross_monthly: r2(grossMonthly) };
    if (emp.pf) {
      const wage = Math.min(earnedBasic, s.pf_wage_cap), ee = Math.round(wage * s.pf_rate / 100), eps = Math.round(wage * s.eps_rate / 100);
      deductions.push({ code: "PF", name: "Provident fund", amount: ee });
      Object.assign(info, { pf_wage: wage, er_eps: eps, er_epf: Math.round(wage * s.pf_rate / 100) - eps, er_admin: Math.round(wage * s.pf_admin_rate / 100), er_edli: Math.round(wage * s.edli_rate / 100) });
    }
    if (emp.esi && grossMonthly <= s.esi_limit && gross > 0) {
      const ee = Math.ceil(gross * s.esi_emp_rate / 100 - 1e-9), er = Math.ceil(gross * s.esi_er_rate / 100 - 1e-9);
      deductions.push({ code: "ESI", name: "Employee state insurance", amount: ee }); Object.assign(info, { esi_wage: gross, er_esi: er });
    }
    if (emp.pt) {
      const slabs = (s.pt_slabs || []).slice().sort((a, b) => num(a.from) - num(b.from)); let pt = 0;
      slabs.forEach((x) => { if (grossMonthly >= num(x.from)) pt = num(x.amount); });
      if (pt > 0) deductions.push({ code: "PT", name: "Professional tax", amount: pt });
    }
    const deduct = r2(deductions.reduce((a, x) => a + x.amount, 0));
    Object.assign(info, { present: sum.present, half_days: sum.hd, weekly_off: sum.wo, holidays: sum.h, paid_leave: sum.paid_leave, unpaid_leave: sum.unpaid_leave, absent: sum.absent, missed_punch: sum.missed, unrecorded: sum.unrecorded, late_count: sum.late_count });
    return { employee_id: emp.id, emp_code: emp.emp_code, emp_name: emp.name, department: emp.department || null, designation: emp.designation || null,
      paid_days: sum.paid_days, lop_days: sum.lop_days, ot_hours: otHours, earnings, deductions, gross, deduct, net: r2(gross - deduct), info };
  }

  /* totals of a payslip list */
  function totals(slips) {
    return { employees: slips.length, gross: r2(slips.reduce((a, x) => a + num(x.gross), 0)), deduct: r2(slips.reduce((a, x) => a + num(x.deduct), 0)), net: r2(slips.reduce((a, x) => a + num(x.net), 0)) };
  }
  /* after a payslip line is changed by hand */
  function reslip(sl) {
    sl.gross = r2((sl.earnings || []).reduce((a, x) => a + num(x.amount), 0)); sl.deduct = r2((sl.deductions || []).reduce((a, x) => a + num(x.amount), 0)); sl.net = r2(sl.gross - sl.deduct); return sl;
  }

  /* ---------- reading a file exported from a machine (CSV / TXT / DAT) ---------- */
  function splitLine(line, d) {
    if (d === ",") { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map((x) => x.trim()); }
    return line.split(d).map((x) => x.trim()).filter((x, i, a) => !(x === "" && i === a.length - 1));
  }
  function parseDate(str) {                                                                             // 2026-10-14 | 14/10/2026 | 14-10-2026 | 14-Oct-2026 | 10/14/2026 (never guessed: day first)
    str = String(str || "").trim(); let m;
    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(str))) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(str))) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    if ((m = /^(\d{1,2})[-/ ]([A-Za-z]{3})[a-z]*[-/ ](\d{2,4})/.exec(str))) { const mi = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ").indexOf(m[2].toLowerCase()); if (mi >= 0) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${String(mi + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; }
    return null;
  }
  function parseTime(str) {
    const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/.exec(String(str || "")); if (!m) return null;
    let h = +m[1]; if (m[4]) { const pm = /p/i.test(m[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return `${String(h).padStart(2, "0")}:${m[2]}:${m[3] || "00"}`;
  }
  /* -> {rows:[{bio_id,time,verify,direction}], bad:n, lines:n, format} */
  function parsePunchFile(text) {
    const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean); const rows = []; let bad = 0;
    if (!lines.length) return { rows, bad, lines: 0, format: "" };
    const d = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : lines[0].includes(",") ? "," : null;
    const head = splitLine(lines[0], d || /\s+/).map((x) => x.toLowerCase()); const hasHead = head.some((x) => /[a-z]{3,}/.test(x)) && !head.some((x) => parseDate(x));
    let idc = 0, dtc = -1, dc = -1, tc = -1, dirc = -1, vc = -1;
    if (hasHead) head.forEach((h, i) => { if (/^(id|pin|user ?id|userid|emp.*(id|code|no)|enroll.*|badge.*|bio.*|person.*id|card.*no)$/.test(h) || (/(id|code|no)$/.test(h) && idc === 0 && i < 3 && !/date|time/.test(h))) { if (!/name/.test(h)) idc = i; } else if (/^(date ?time|datetime|timestamp|punch ?time|punch ?date ?time|check ?time)$/.test(h)) dtc = i; else if (/^(date|punch ?date|att.*date)$/.test(h)) dc = i; else if (/^time$|punch ?time|^in ?time$/.test(h)) tc = i; else if (/dir|state|status|in.?out|punch ?type/.test(h)) dirc = i; else if (/verif|mode|method|type/.test(h)) vc = i; });
    (hasHead ? lines.slice(1) : lines).forEach((line) => {
      const f = splitLine(line, d || /\s+/); let id, date, time, dir = null, ver = "other";
      if (hasHead) {
        id = f[idc]; if (dtc >= 0) { date = parseDate(f[dtc]); time = parseTime(f[dtc]); } else { date = parseDate(f[dc]); time = parseTime(f[tc]); }
        if (dirc >= 0) dir = dirOf(f[dirc]); if (vc >= 0) ver = verOf(f[vc]);
      } else {                                                                                          // headerless (ZKTeco .dat): id, date time, status, verify ...
        id = f[0]; const joined = f.slice(1, 3).join(" "); date = parseDate(f[1]); time = parseTime(f[1]);
        let rest = f.slice(2);
        if (date && !/\d:\d/.test(String(f[1]))) { time = parseTime(f[2]); rest = f.slice(3); }
        else if (!date) { date = parseDate(joined); time = parseTime(joined); }
        dir = dirOf(rest[0]); ver = verOf(rest[1]);
      }
      if (!id || !date || !time) { bad++; return; }
      rows.push({ bio_id: String(id).trim(), time: `${date} ${time}`, verify: ver, direction: dir });
    });
    return { rows, bad, lines: lines.length - (hasHead ? 1 : 0), format: hasHead ? "with column names" : "machine log (no column names)" };
  }
  function dirOf(v) { v = String(v == null ? "" : v).trim().toLowerCase(); if (v === "0" || v === "i" || /^(in|check ?in|c\/in|entry|enter)/.test(v)) return "in"; if (v === "1" || v === "o" || /^(out|check ?out|c\/out|exit)/.test(v)) return "out"; return null; }
  function verOf(v) { v = String(v == null ? "" : v).trim().toLowerCase(); if (v === "1" || /finger|fp/.test(v)) return "finger"; if (/^(15|16|17|18)$/.test(v) || /face/.test(v)) return "face"; if (/^(2|3|4)$/.test(v) || /card|rf/.test(v)) return "card"; if (v === "0" || /pass|pw|pin/.test(v)) return "password"; if (v === "25" || /palm/.test(v)) return "palm"; return "other"; }

  const api = { DEFAULTS, cfg, r2, local, dnum, dstr, addDays, dow, monthDays, monthRange, rel, clock, hhmm, workDateOf, dayRow, buildAttendance, summary, payOf, totals, reslip, parsePunchFile, parseDate, parseTime, DEFAULT_SHIFT };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HRMCalc = api;
})(typeof window !== "undefined" ? window : globalThis);
