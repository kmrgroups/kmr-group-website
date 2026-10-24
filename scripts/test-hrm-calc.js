/* node scripts/test-hrm-calc.js - checks the attendance and payroll rules of the HRM & Payroll app */
const C = require("../public/it/apps/hrm-calc.js"); let bad = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.log("FAIL", m, "\n  got ", JSON.stringify(a), "\n  want", JSON.stringify(b)); } };
const IST = (d, hm) => new Date(`${d}T${hm}:00+05:30`).toISOString();
const sh = { id: "s1", name: "General", start_time: "09:00", end_time: "18:00", grace_min: 10, break_min: 30, half_day_min: 240, full_day_min: 450, night: false, weekly_off: [0], active: true };
const nt = { id: "s2", name: "Night", start_time: "22:00", end_time: "06:00", grace_min: 10, break_min: 30, half_day_min: 240, full_day_min: 450, night: true, weekly_off: [0], active: true };
const e1 = { id: "e1", emp_code: "E001", name: "A", shift_id: "s1", bio_id: "11", ot_eligible: true, basic: 15000, hra: 6000, special: 3000, other_allow: 0, pf: true, esi: false, pt: true, pay_type: "monthly", doj: "2026-01-01" };
const base = { employees: [e1], shifts: [sh, nt], holidays: [{ hdate: "2026-09-02", name: "Festival" }], leaves: [], existing: [], punches: [] };
const P = (d, a, b) => [{ employee_id: "e1", bio_id: "11", at: IST(d, a) }, { employee_id: "e1", bio_id: "11", at: IST(d, b) }];
const run = (punches, extra, from = "2026-09-01", to = "2026-09-07") => C.buildAttendance(Object.assign({}, base, { punches }, extra), from, to, { tz: "Asia/Kolkata" }, "2026-09-30").rows;
const get = (rows, d) => rows.find((r) => r.work_date === d);

// 2026-09-01 is a Tuesday. Full day, on time
let r = get(run([...P("2026-09-01", "08:58", "18:05")]), "2026-09-01");
eq([r.status, r.late_min, r.early_min, r.ot_min, r.worked_min], ["P", 0, 0, 0, 547 - 30], "full day");
// late beyond grace counts from shift start
r = get(run(P("2026-09-03", "09:25", "18:00")), "2026-09-03"); eq([r.status, r.late_min], ["P", 25], "late 25");
// inside grace is not late
r = get(run(P("2026-09-03", "09:10", "18:00")), "2026-09-03"); eq(r.late_min, 0, "grace");
// overtime counts only above the 30 minute threshold
r = get(run(P("2026-09-03", "09:00", "18:20")), "2026-09-03"); eq(r.ot_min, 0, "ot below threshold");
r = get(run(P("2026-09-03", "09:00", "19:30")), "2026-09-03"); eq(r.ot_min, 90, "ot 90");
// half day, short day, one punch
r = get(run(P("2026-09-03", "09:00", "14:00")), "2026-09-03"); eq(r.status, "HD", "half day");
r = get(run(P("2026-09-03", "09:00", "10:00")), "2026-09-03"); eq(r.status, "A", "short");
r = get(run([{ employee_id: "e1", bio_id: "11", at: IST("2026-09-03", "09:00") }]), "2026-09-03"); eq(r.status, "MP", "missed punch");
// double touch within 5 minutes is one punch
r = get(run([{ employee_id: "e1", bio_id: "11", at: IST("2026-09-03", "09:00") }, { employee_id: "e1", bio_id: "11", at: IST("2026-09-03", "09:02") }]), "2026-09-03"); eq(r.status, "MP", "double touch");
// no punch: absent; Sunday = WO; holiday = H; future = no row
let rows = run([]); eq(get(rows, "2026-09-03").status, "A", "absent"); eq(get(rows, "2026-09-06").status, "WO", "sunday"); eq(get(rows, "2026-09-02").status, "H", "holiday");
eq(C.buildAttendance(Object.assign({}, base), "2026-10-01", "2026-10-03", {}, "2026-10-01").rows.length, 1, "future days get no row");
// punches matched by biometric id when the punch has no employee yet
eq(get(run([{ employee_id: null, bio_id: "11", at: IST("2026-09-04", "09:00") }, { employee_id: null, bio_id: "11", at: IST("2026-09-04", "18:00") }]), "2026-09-04").status, "P", "match by bio id");
eq(Object.keys(C.buildAttendance(Object.assign({}, base, { punches: [{ employee_id: null, bio_id: "99", at: IST("2026-09-04", "09:00") }] }), "2026-09-04", "2026-09-04", {}, "2026-09-30").unknown), ["99"], "unknown id");
// leave
rows = run([], { leaves: [{ employee_id: "e1", from_date: "2026-09-03", to_date: "2026-09-04", half: false, leave_code: "CL", paid: true }, { employee_id: "e1", from_date: "2026-09-07", to_date: "2026-09-07", half: false, leave_code: "LOP", paid: false }] });
eq([get(rows, "2026-09-03").status, get(rows, "2026-09-03").leave_code, get(rows, "2026-09-07").status], ["L", "CL", "U"], "leave");
// leave on Sunday does not use leave
rows = run([], { leaves: [{ employee_id: "e1", from_date: "2026-09-05", to_date: "2026-09-07", half: false, leave_code: "CL", paid: true }] }); eq(get(rows, "2026-09-06").status, "WO", "leave over sunday");
// manual days are not overwritten
eq(get(run(P("2026-09-03", "09:00", "18:00"), { existing: [{ employee_id: "e1", work_date: "2026-09-03", source: "manual", status: "A" }] }), "2026-09-03"), undefined, "manual kept");
// before joining / after leaving
eq(get(C.buildAttendance(Object.assign({}, base, { employees: [Object.assign({}, e1, { doj: "2026-09-05" })] }), "2026-09-01", "2026-09-07", {}, "2026-09-30").rows, "2026-09-03"), undefined, "before doj");
// night shift: punch at 22:00 on the 3rd and 06:10 on the 4th belong to the 3rd
const en = Object.assign({}, e1, { shift_id: "s2" });
rows = C.buildAttendance(Object.assign({}, base, { employees: [en], punches: [{ employee_id: "e1", bio_id: "11", at: IST("2026-09-03", "21:55") }, { employee_id: "e1", bio_id: "11", at: IST("2026-09-04", "06:10") }] }), "2026-09-03", "2026-09-04", {}, "2026-09-30").rows;
r = get(rows, "2026-09-03"); eq([r.status, r.late_min, r.early_min, r.ot_min, r.worked_min], ["P", 0, 0, 10 >= 30 ? 10 : 0, 495 - 30], "night shift");
eq(get(rows, "2026-09-04").status, "A", "night shift next day has its own");

// month summary + pay: September 2026 (30 days): 4 Sundays (6,13,20,27) and 1 holiday; 20 present, 1 half, 2 absent, 1 paid leave, 1 unpaid leave
const mk = (d, st, extra) => Object.assign({ employee_id: "e1", work_date: d, status: st, ot_min: 0, late_min: 0 }, extra || {});
const att = []; let day = 1; const put = (st, n, ex) => { for (let i = 0; i < n; i++) att.push(mk("2026-09-" + String(day++).padStart(2, "0"), st, ex)); };
put("P", 10, { ot_min: 60 }); put("WO", 1); put("P", 10); put("H", 1); put("HD", 1); put("A", 2); put("L", 1, { leave_code: "CL" }); put("U", 1); put("WO", 3);
eq(att.length, 30, "month rows");
const sum = C.summary(e1, att, "2026-09", [{ code: "CL", paid: true }]);
eq([sum.paid_days, sum.lop_days, sum.absent, sum.hd, sum.unrecorded], [26.5, 3.5, 2, 1, 0], "summary");   // 20 P + 4 WO + 1 H + 1 L + half day = 26.5 paid; 2 A + 1 U + half day = 3.5 LOP

const S = { pt_slabs: [{ from: 0, amount: 0 }, { from: 15000, amount: 200 }] };
let pay = C.payOf(e1, sum, "2026-09", S);
eq(pay.earnings.map((x) => [x.code, x.amount]), [["BASIC", 13250], ["HRA", 5300], ["SPL", 2650], ["OT", 1442.31]], "earnings");
eq([pay.gross, pay.deduct, pay.net, pay.ot_hours], [22642.31, 1790, 20852.31, 10], "pay totals");
eq(pay.deductions.map((x) => [x.code, x.amount]), [["PF", 1590], ["PT", 200]], "deductions");
eq([pay.info.pf_wage, pay.info.er_eps, pay.info.er_epf, pay.info.er_admin], [13250, 1104, 486, 66], "employer pf");
// PF wage is capped at 15,000
pay = C.payOf(Object.assign({}, e1, { basic: 30000 }), Object.assign({}, sum, { paid_days: 30, ot_min: 0 }), "2026-09", S); eq(pay.deductions[0].amount, 1800, "pf cap");
// ESI: on if monthly gross <= 21000; 0.75% rounded up
const e2 = { id: "e2", emp_code: "E002", name: "B", basic: 12000, hra: 4000, special: 2000, other_allow: 0, pf: false, esi: true, pt: false, pay_type: "monthly" };
pay = C.payOf(e2, { paid_days: 30, lop_days: 0, ot_min: 0 }, "2026-09", S); eq([pay.gross, pay.deductions[0].amount, pay.info.er_esi], [18000, 135, 585], "esi");
pay = C.payOf(Object.assign({}, e2, { basic: 20000 }), { paid_days: 30, lop_days: 0, ot_min: 0 }, "2026-09", S); eq(pay.deductions.length, 0, "esi above limit");
// daily wage: rate x paid days
pay = C.payOf({ id: "e3", emp_code: "E003", name: "C", pay_type: "daily", basic: 600, hra: 0, special: 0, other_allow: 0 }, { paid_days: 24.5, lop_days: 0, ot_min: 0 }, "2026-09", S); eq(pay.gross, 14700, "daily wage");
// joined mid-month: days before joining are not paid and not LOP
const e4 = Object.assign({}, e1, { doj: "2026-09-16", ot_eligible: false });
const att4 = []; for (let d = 16; d <= 30; d++) att4.push({ employee_id: "e1", work_date: "2026-09-" + d, status: "P", ot_min: 0, late_min: 0 });
const s4 = C.summary(e4, att4, "2026-09", []); eq([s4.outside, s4.paid_days, s4.lop_days], [15, 15, 0], "joined mid month");
pay = C.payOf(e4, s4, "2026-09", S); eq(pay.earnings[0].amount, 7500, "prorated basic");
// month length setting
eq(C.payOf(e4, s4, "2026-09", Object.assign({ month_days_mode: 26 }, S)).earnings[0].amount, 8653.85, "fixed 26-day month");
// files from machines
let f = C.parsePunchFile("11\t2026-09-03 09:01:10\t0\t1\t0\t0\n12\t2026-09-03 18:02:00\t1\t15\t0\t0\nxx\n");
eq([f.rows.length, f.bad, f.rows[0].direction, f.rows[1].verify], [2, 1, "in", "face"], "zk dat");
f = C.parsePunchFile("User ID,Name,Date,Time,Status\n11,Ravi,03/09/2026,09:01 AM,In\n11,Ravi,03/09/2026,06:05 PM,Out");
eq(f.rows.map((x) => x.time), ["2026-09-03 09:01:00", "2026-09-03 18:05:00"], "csv with am/pm, day first");
f = C.parsePunchFile("PIN;DateTime\n7;2026-09-03 08:55:00"); eq(f.rows[0], { bio_id: "7", time: "2026-09-03 08:55:00", verify: "other", direction: null }, "semicolon");
// today with one punch is a running day, not a missed punch
eq(C.buildAttendance(Object.assign({}, base, { punches: [{ employee_id: "e1", bio_id: "11", at: IST("2026-09-30", "09:00") }] }), "2026-09-30", "2026-09-30", {}, "2026-09-30").rows[0].status, "P", "running day");
// Elixir Tec sheet rules (August 2026, 31 days): no PF, hourly = daily / hours per day, OT at 1x, bonus 500 when at most 1 day short, whole rupees
const ES = { month_days_mode: "calendar", pf_enabled: false, esi_enabled: false, pt_enabled: false, ot_multiplier: 1, ot_basis: "gross", ot_day_divisor: "calendar", bonus_amount: 500, bonus_max_short: 1, round_net: true };
const emk = (o) => Object.assign({ id: "x", emp_code: "E1", name: "n", pay_type: "monthly", basic: 0, hra: 0, special: 0, other_allow: 0, pf: true, esi: true, pt: true, ot_eligible: true, hours_per_day: 8.5, bonus_eligible: true }, o);
const esm = (paid, otMin) => ({ days: 31, outside: 0, paid_days: paid, present: paid, hd: 0, wo: 0, h: 0, paid_leave: 0, unpaid_leave: 0, absent: 0, missed: 0, unrecorded: 0, ot_min: otMin, late_count: 0, late_min: 0, lop_days: 31 - paid });
let eep = C.payOf(emk({ basic: 18500 }), esm(30, 0), "2026-08", ES);
eq([eep.gross, eep.net, eep.deductions.length], [18403.23, 18403, 0], "full month with bonus, no PF even though employee PF is on");
eep = C.payOf(emk({ basic: 9000, bonus_eligible: false }), esm(29, 0), "2026-08", ES); eq(eep.earnings.some((x) => x.code === "BONUS"), false, "bonus only when eligible");
eep = C.payOf(emk({ basic: 9000 }), esm(29, 0), "2026-08", ES); eq(eep.earnings.some((x) => x.code === "BONUS"), false, "2 days short: no bonus");
eep = C.payOf(emk({ basic: 2500, pay_type: "fixed", ot_eligible: false, bonus_eligible: false }), esm(10, 0), "2026-08", ES); eq(eep.net, 2500, "fixed pay is not prorated");
eep = C.payOf(emk({ basic: 15500, hours_per_day: 12, bonus_eligible: false }), esm(31, 120), "2026-08", ES); eq(eep.earnings.find((x) => x.code === "OT").amount, r2e(15500 / 31 / 12 * 2), "OT hours at daily/hours");
function r2e(n) { return Math.round(n * 100) / 100; }
eep = C.payOf(emk({ basic: 20000 }), esm(31, 0), "2026-08", Object.assign({}, ES, { pf_enabled: true })); eq(eep.deductions.map((x) => x.code), ["PF", "ESI", "PT"].filter((x) => x === "PF"), "PF switch on: PF taken");
// shift roster + "judged by the shift" rule (rotating shifts, late = half day, night shift morning punches)
{
  const shs = [{ id: "ms", name: "MS", start_time: "06:30", end_time: "14:30", grace_min: 0, break_min: 0, half_day_min: 240, full_day_min: 450, night: false, weekly_off: [0], active: true },
    { id: "ns", name: "NS", start_time: "22:00", end_time: "06:00", grace_min: 30, break_min: 0, half_day_min: 240, full_day_min: 450, night: true, weekly_off: [0], active: true }];
  const rs = { employees: [{ id: "r1", bio_id: "R1", status: "active", shift_id: "ms" }], shifts: shs, holidays: [], leaves: [],
    roster: [{ e: "r1", d: "2026-09-07", s: "ms" }, { e: "r1", d: "2026-09-08", s: "ns" }, { e: "r1", d: "2026-09-10", s: "ms" }, { e: "r1", d: "2026-09-11", s: "ns" }],
    punches: [["2026-09-07", "06:20"], ["2026-09-07", "14:35"], ["2026-09-08", "18:00"], ["2026-09-09", "06:05"], ["2026-09-10", "06:40"], ["2026-09-10", "14:31"], ["2026-09-11", "18:05"], ["2026-09-12", "05:50"]].map(([d, t]) => ({ bio_id: "R1", at: IST(d, t) })) };
  const rr = C.buildAttendance(rs, "2026-09-07", "2026-09-12", { status_rule: "shift" }, "2026-10-24").rows, st = (d) => (rr.find((x) => x.work_date === d) || {}).status;
  eq([st("2026-09-07"), st("2026-09-08"), st("2026-09-09"), st("2026-09-10"), st("2026-09-11")], ["P", "P", "A", "HD", "HD"], "shift rule: on time, night shift (out next morning), late arrival, early leaving");
  eq(C.buildAttendance(Object.assign({}, rs, { roster: [] }), "2026-09-07", "2026-09-07", {}, "2026-10-24").rows[0].status, "P", "no roster, hours rule: unchanged behaviour");
}
console.log(bad ? bad + " FAILED" : "all passed"); process.exit(bad ? 1 : 0);
