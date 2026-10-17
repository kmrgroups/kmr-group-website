/* HRM & Payroll - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_hrms_*).
   Fake machines: "Main gate - face" and "Shop floor - fingerprint". Nothing here is real data. */
(function () {
  "use strict";
  const C = window.HRMCalc, DAY = 864e5, TZMIN = 330;                       // sample company is on Indian time
  let uid = 0; const id = () => "h" + (++uid).toString(36).padStart(4, "0") + Math.random().toString(36).slice(2, 6);
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim(), nz = (v) => (T(v) === "" ? null : v), N = (v, d) => { const n = Number(v); return Number.isFinite(n) && T(v) !== "" ? n : (d == null ? 0 : d); };
  const J = (o) => JSON.parse(JSON.stringify(o));
  const todayStr = () => C.local(Date.now(), "Asia/Kolkata").date;
  let seed = 20261017; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const ist = (date, min) => new Date(Date.parse(date + "T00:00:00Z") + (min - TZMIN) * 6e4).toISOString();   // local clock -> UTC instant

  const S = { settings: { pt_slabs: [{ from: 0, amount: 0 }, { from: 15000, amount: 200 }], emp_prefix: "E" }, shifts: [], holidays: [], types: [], devices: [], emps: [], punches: [], att: [], leaves: [], runs: [], slips: [], ctr: 0 };
  const sh = (name, a, b, extra) => { const o = Object.assign({ id: id(), name, start_time: a, end_time: b, grace_min: 10, break_min: 30, half_day_min: 240, full_day_min: 450, night: false, weekly_off: [0], active: true, sample: true }, extra); S.shifts.push(o); return o; };
  const gen = sh("General", "09:00", "18:00"), sec = sh("Second", "14:00", "22:00", { weekly_off: [0] });
  const lt = (code, name, paid, q) => S.types.push({ id: id(), code, name, paid, annual_quota: q, active: true, sample: true });
  lt("CL", "Casual leave", true, 8); lt("SL", "Sick leave", true, 8); lt("EL", "Earned leave", true, 12); lt("LOP", "Leave without pay", false, 0);
  const t0 = todayStr(), y = t0.slice(0, 4);
  [[y + "-01-26", "Republic Day"], [y + "-08-15", "Independence Day"], [y + "-10-02", "Gandhi Jayanti"], [y + "-10-20", "Deepavali"], [y + "-12-25", "Christmas"]].forEach(([d, n]) => S.holidays.push({ id: id(), hdate: d, name: n, sample: true }));
  const dev = (name, serial, modes, loc, model, protocol) => { const d = { id: id(), name, vendor: "eSSL / ZKTeco", model, modes, serial, protocol, location: loc, ip: null, push_key: id() + id(), enabled: true, last_seen: null, last_punch: null, punches_total: 0, notes: null, sample: true }; S.devices.push(d); return d; };
  const dGate = dev("Main gate - face", "SAMPLE-ESSL-0001", ["face", "card"], "Main gate", "eSSL MB160 / ZKTeco face terminal", "adms");
  const dShop = dev("Shop floor - fingerprint", "SAMPLE-RT-0002", ["finger"], "Shop floor entry", "T-series (JSON bridge)", "json"); dShop.vendor = "Realtime";

  const people = [["Ravi Kumar", "Quality", "Head - Quality", 52000], ["Suresh Patil", "Production", "Production Manager", 58000], ["Anil Sharma", "Maintenance", "Maintenance Engineer", 34000], ["Meena Iyer", "Purchase", "Purchase Manager", 46000],
    ["Karthik Rao", "Engineering", "Design Engineer", 38000], ["Divya Nair", "Quality", "Quality Engineer", 30000], ["Prakash Reddy", "Production", "CNC Operator", 19500], ["Imran Khan", "Production", "CNC Operator", 18500], ["Lakshmi Devi", "Production", "VMC Operator", 20500],
    ["Gopal Singh", "Production", "Setter", 24000], ["Selvam M", "Production", "Machine Operator", 16500], ["Joseph D", "Production", "Machine Operator", 16000], ["Ramesh B", "Stores", "Storekeeper", 17500], ["Farida Begum", "Quality", "Inspector", 18500],
    ["Mohan Raj", "Maintenance", "Electrician", 21000], ["Vinod Kumar", "Dispatch", "Dispatch Clerk", 15500], ["Sunita Rao", "Accounts", "Accountant", 28000], ["Naresh Babu", "Production", "Helper", 13500], ["Ganesh P", "Production", "Helper", 13000],
    ["Bhaskar S", "Production", "Machine Operator", 16800], ["Rekha T", "HR", "HR Executive", 27000], ["Tarun Joshi", "Security", "Security Guard", 12500], ["Usha K", "Production", "Machine Operator", 16200], ["Yusuf Ali", "Production", "CNC Operator", 19000]];
  people.forEach((p, i) => {
    const sal = p[3], basic = Math.round(sal * 0.5 / 100) * 100, hra = Math.round(basic * 0.4 / 100) * 100, spl = sal - basic - hra;
    const e = { id: id(), emp_code: "E" + String(i + 1).padStart(3, "0"), name: p[0], gender: null, dob: null, doj: i < 20 ? (y - 1 - (i % 4)) + "-0" + (1 + (i % 9)) + "-10" : y + "-04-" + String(10 + i - 20).padStart(2, "0"), dol: null, department: p[1], designation: p[2], grade: null, mobile: "98" + String(40000000 + i * 91357).slice(0, 8), email: null, address: null,
      status: "active", shift_id: i >= 6 && i % 3 === 0 ? sec.id : gen.id, bio_id: String(101 + i), pay_type: "monthly", basic, hra, special: spl, other_allow: 0, pf: sal <= 40000, esi: sal <= 21000, pt: true, ot_eligible: sal <= 25000 && p[1] === "Production",
      uan: sal <= 40000 ? "1012" + String(30000000 + i * 7919).slice(0, 8) : null, esi_no: sal <= 21000 ? "31" + String(10000000 + i * 4231).slice(0, 8) : null, pan: null, bank_name: "Sample Bank", bank_account: "5010" + String(10000000 + i * 3571).slice(0, 8), ifsc: "SAMP0000123", notes: null, sample: true, created_at: new Date().toISOString() };
    S.emps.push(e);
  });
  S.ctr = people.length;
  // about six weeks of punches: arrival 08:45-09:25 (first shift), leave a few unmarked, some missing the out-punch
  (function seedPunches() {
    for (let n = 44; n >= 0; n--) {
      const d = C.addDays(t0, -n), dw = C.dow(d), hol = S.holidays.some((h) => h.hdate === d);
      if (dw === 0 || hol) continue;
      S.emps.forEach((e, i) => {
        if (rnd() < 0.05) return;                                              // absent
        if (d === t0 && rnd() < 0.2) return;
        const second = e.shift_id === sec.id, base = second ? 14 * 60 : 9 * 60, arrive = base - 14 + Math.round(rnd() * 38), stay = (second ? 22 * 60 : 18 * 60) - 8 + Math.round(rnd() * (e.ot_eligible ? 110 : 25));
        const dv = e.department === "Production" ? dShop : dGate, mode = dv === dGate ? (rnd() < 0.7 ? "face" : "card") : "finger";
        S.punches.push({ id: id(), employee_id: e.id, bio_id: e.bio_id, at: ist(d, arrive), verify: mode, direction: "in", device_id: dv.id, source: dv.protocol === "adms" ? "device" : "json", sample: true });
        if (!(d === t0 && stay > 0 && new Date(ist(d, stay)) > Date.now()) && rnd() > 0.02) S.punches.push({ id: id(), employee_id: e.id, bio_id: e.bio_id, at: ist(d, stay), verify: mode, direction: "out", device_id: dv.id, source: dv.protocol === "adms" ? "device" : "json", sample: true });
      });
    }
    S.punches.push({ id: id(), employee_id: null, bio_id: "999", at: ist(C.addDays(t0, -1), 9 * 60 + 5), verify: "finger", direction: null, device_id: dShop.id, source: "json", sample: true });
    S.punches = S.punches.filter((p) => new Date(p.at) <= Date.now());
    [[dGate, "device"], [dShop, "json"]].forEach(([d]) => { const mine = S.punches.filter((p) => p.device_id === d.id); d.punches_total = mine.length; d.last_punch = mine.length ? mine[mine.length - 1].at : null; d.last_seen = d === dGate ? new Date(Date.now() - 4 * 6e4).toISOString() : new Date(Date.now() - 40 * 6e4).toISOString(); });
  })();
  const lv = (ei, code, from, to, st, reason, half) => { const e = S.emps[ei], t = S.types.find((x) => x.code === code); S.leaves.push({ id: id(), employee_id: e.id, leave_type_id: t.id, leave_code: code, from_date: from, to_date: to, half: !!half, days: half ? 0.5 : C.dnum(to) - C.dnum(from) + 1, reason, status: st, decided_by: st === "Pending" ? null : "demo@example.com", decided_at: st === "Pending" ? null : new Date().toISOString(), sample: true, created_at: new Date().toISOString() }); };
  lv(6, "CL", C.addDays(t0, -12), C.addDays(t0, -12), "Approved", "Family function"); lv(9, "SL", C.addDays(t0, -20), C.addDays(t0, -19), "Approved", "Fever"); lv(11, "CL", C.addDays(t0, 3), C.addDays(t0, 4), "Pending", "Travel"); lv(14, "LOP", C.addDays(t0, -6), C.addDays(t0, -5), "Approved", "Personal");

  const locked = () => S.runs.filter((r) => r.status === "final").map((r) => r.period);
  const isLocked = (d) => locked().includes(String(d).slice(0, 7));
  const dedupe = (p) => S.punches.some((x) => x.bio_id === p.bio_id && x.at === p.at);
  const view = (e) => Object.assign({}, e);
  const nextCode = () => (S.settings.emp_prefix || "E") + String(++S.ctr).padStart(3, "0");
  function empUpsert(p, existingId) {
    if (!T(p.name)) err("Enter the employee's name.");
    const bio = nz(p.bio_id) == null ? null : T(p.bio_id);
    if (bio && S.emps.some((e) => e.bio_id === bio && e.id !== existingId)) err("Biometric ID " + bio + " is already used by another employee.");
    const cur = existingId ? S.emps.find((e) => e.id === existingId) || err("Employee not found.") : null;
    let code = T(p.emp_code); if (!code) code = cur ? cur.emp_code : nextCode();
    if (S.emps.some((e) => e.emp_code === code && e.id !== existingId)) err("Employee code " + code + " already exists.");
    const o = Object.assign(cur || { id: id(), sample: false, created_at: new Date().toISOString() }, {
      emp_code: code, name: T(p.name), gender: nz(p.gender), dob: nz(p.dob), doj: nz(p.doj), dol: nz(p.dol), department: nz(p.department), designation: nz(p.designation), grade: nz(p.grade), mobile: nz(p.mobile), email: nz(p.email), address: nz(p.address),
      status: p.status === "left" ? "left" : "active", shift_id: nz(p.shift_id), bio_id: bio, pay_type: p.pay_type === "daily" ? "daily" : "monthly", basic: N(p.basic), hra: N(p.hra), special: N(p.special), other_allow: N(p.other_allow),
      pf: !!p.pf, esi: !!p.esi, pt: !!p.pt, ot_eligible: !!p.ot_eligible, uan: nz(p.uan), esi_no: nz(p.esi_no), pan: nz(p.pan), bank_name: nz(p.bank_name), bank_account: nz(p.bank_account), ifsc: nz(p.ifsc), notes: nz(p.notes) });
    if (!cur) S.emps.push(o);
    // punches that arrived before this person was listed now belong to them
    if (bio) S.punches.forEach((x) => { if (x.bio_id === bio && !x.employee_id) x.employee_id = o.id; });
    return o.id;
  }
  function punchAdd(rows, src, devId) {
    let added = 0, dup = 0, bad = 0; const unk = [];
    (rows || []).forEach((r) => {
      const b = T(r.bio_id || r.pin || r.user_id || r.userid), ts = T(r.time || r.timestamp || r.datetime);
      if (!b || !ts) { bad++; return; }
      let at; if (/(Z|[+-]\d{2}:?\d{2})$/.test(ts)) at = new Date(ts); else { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(ts); at = m ? new Date(ist(m[1], +m[2] * 60 + +m[3]).replace(":00.000Z", ":" + (m[4] || "00") + ".000Z")) : new Date("x"); }
      if (isNaN(at)) { bad++; return; }
      const emp = r.employee_id ? S.emps.find((e) => e.id === r.employee_id) : S.emps.find((e) => e.bio_id === b);
      if (!emp && !unk.includes(b)) unk.push(b);
      const p = { id: id(), employee_id: emp ? emp.id : null, bio_id: b, at: at.toISOString(), verify: ["finger", "face", "card", "password", "palm", "manual"].includes(r.verify) ? r.verify : "other", direction: r.direction === "in" || r.direction === "out" ? r.direction : null, device_id: devId || null, source: src, sample: false };
      if (dedupe(p)) { dup++; return; }
      S.punches.push(p); added++;
    });
    if (devId) { const d = S.devices.find((x) => x.id === devId); if (d) { d.last_seen = new Date().toISOString(); d.punches_total += added; } }
    return { added, duplicate: dup, invalid: bad, unknown_ids: unk };
  }
  const money = () => true;
  const needDev = () => { };

  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_hrms_load() { return J({ role: "admin", money: money(), settings: S.settings, shifts: S.shifts.slice().sort((a, b) => a.name.localeCompare(b.name)), holidays: S.holidays.slice().sort((a, b) => a.hdate.localeCompare(b.hdate)), leave_types: S.types, devices: S.devices, employees: S.emps.slice().sort((a, b) => a.emp_code.localeCompare(b.emp_code)).map(view), today: todayStr() }); },
    kmr_hrms_att_get(a) {
      if (!a.p_from || !a.p_to || a.p_to < a.p_from) err("Choose the dates."); if (C.dnum(a.p_to) - C.dnum(a.p_from) > 92) err("Choose at most three months at a time.");
      const lo = Date.parse(C.addDays(a.p_from, -1) + "T00:00:00Z") - TZMIN * 6e4, hi = Date.parse(C.addDays(a.p_to, 2) + "T00:00:00Z") - TZMIN * 6e4;
      return J({ attendance: S.att.filter((r) => r.work_date >= a.p_from && r.work_date <= a.p_to).sort((x, y) => x.work_date.localeCompare(y.work_date)),
        punches: S.punches.filter((p) => { const t = Date.parse(p.at); return t >= lo && t < hi; }).sort((x, y) => x.at.localeCompare(y.at)).map((p) => ({ id: p.id, employee_id: p.employee_id, bio_id: p.bio_id, at: p.at, verify: p.verify, direction: p.direction, device_id: p.device_id, source: p.source })),
        leaves: S.leaves.filter((l) => l.status === "Approved" && l.from_date <= a.p_to && l.to_date >= a.p_from).map((l) => ({ employee_id: l.employee_id, from_date: l.from_date, to_date: l.to_date, half: l.half, leave_code: l.leave_code, paid: (S.types.find((t) => t.id === l.leave_type_id) || { paid: true }).paid })), locked: locked() });
    },
    kmr_hrms_leaves(a) { const yr = String(a.p_year || t0.slice(0, 4)); return J(S.leaves.filter((l) => l.from_date.slice(0, 4) === yr || l.to_date.slice(0, 4) === yr).map((l) => { const e = S.emps.find((x) => x.id === l.employee_id) || {}; return Object.assign({}, l, { emp_name: e.name, emp_code: e.emp_code }); }).sort((x, y) => y.from_date.localeCompare(x.from_date))); },
    kmr_hrms_settings_save(a) { if (!a.p || typeof a.p !== "object") err("Settings must be an object."); S.settings = J(a.p); return null; },
    kmr_hrms_shift_save(a) {
      const p = a.p; if (!T(p.name)) err("Enter the shift name."); const stt = T(p.start_time) || "09:00", ent = T(p.end_time) || "18:00"; if (!/^\d{2}:\d{2}$/.test(stt) || !/^\d{2}:\d{2}$/.test(ent)) err("Enter the shift times as HH:MM.");
      const wo = (Array.isArray(p.weekly_off) ? p.weekly_off : []).map(Number); if (wo.some((d) => d < 0 || d > 6)) err("Weekly off days are 0 (Sunday) to 6 (Saturday).");
      if (S.shifts.some((s) => s.name.toLowerCase() === T(p.name).toLowerCase() && s.id !== p.id)) err("A shift named " + T(p.name) + " already exists.");
      let s = p.id && S.shifts.find((x) => x.id === p.id); if (!s) { s = { id: id(), sample: false }; S.shifts.push(s); }
      Object.assign(s, { name: T(p.name), start_time: stt, end_time: ent, grace_min: N(p.grace_min, 10), break_min: N(p.break_min, 30), half_day_min: N(p.half_day_min, 240), full_day_min: N(p.full_day_min, 450), night: !!p.night, weekly_off: wo, active: p.active !== false }); return { id: s.id };
    },
    kmr_hrms_shift_delete(a) { if (S.emps.some((e) => e.shift_id === a.p_id)) err("Employees are on this shift. Move them to another shift first (or untick Active)."); S.shifts = S.shifts.filter((s) => s.id !== a.p_id); return null; },
    kmr_hrms_holiday_save(a) {
      const rows = Array.isArray(a.p.rows) ? a.p.rows : [a.p];
      rows.forEach((r) => { if (!T(r.hdate) || !T(r.name)) err("Enter the holiday date and name."); const ex = S.holidays.find((h) => h.hdate === r.hdate && h.id !== r.id); if (r.id) { const h = S.holidays.find((x) => x.id === r.id); if (ex) err("There is already a holiday on that date."); if (h) Object.assign(h, { hdate: r.hdate, name: T(r.name) }); } else if (ex) ex.name = T(r.name); else S.holidays.push({ id: id(), hdate: r.hdate, name: T(r.name), sample: false }); }); return null;
    },
    kmr_hrms_holiday_delete(a) { S.holidays = S.holidays.filter((h) => h.id !== a.p_id); return null; },
    kmr_hrms_leave_type_save(a) {
      const p = a.p; if (!T(p.code) || !T(p.name)) err("Enter the leave code and name."); const code = T(p.code).toUpperCase();
      if (S.types.some((t) => t.code === code && t.id !== p.id)) err("Leave code " + code + " already exists.");
      let t = p.id && S.types.find((x) => x.id === p.id); if (!t) { t = { id: id(), sample: false }; S.types.push(t); } Object.assign(t, { code, name: T(p.name), paid: p.paid !== false, annual_quota: N(p.annual_quota), active: p.active !== false }); return null;
    },
    kmr_hrms_leave_type_delete(a) { if (S.leaves.some((l) => l.leave_type_id === a.p_id)) err("This leave type is used in leave requests. Untick Active instead."); S.types = S.types.filter((t) => t.id !== a.p_id); return null; },
    kmr_hrms_device_save(a) {
      const p = a.p, proto = p.protocol || "adms"; if (!T(p.name)) err("Enter a name for the machine (for example Gate 1 fingerprint)."); if (!["adms", "json", "file"].includes(proto)) err("Choose how the machine sends its punches.");
      if (proto === "adms" && !T(p.serial)) err("Enter the machine's serial number (printed on the machine and shown in its menu under System info).");
      if (T(p.serial) && S.devices.some((d) => (d.serial || "").toLowerCase() === T(p.serial).toLowerCase() && d.id !== p.id)) err("Another machine already has the serial number " + T(p.serial) + ".");
      let d = p.id && S.devices.find((x) => x.id === p.id); if (!d) { d = { id: id(), push_key: id() + id(), last_seen: null, last_punch: null, punches_total: 0, sample: false }; S.devices.push(d); }
      Object.assign(d, { name: T(p.name), vendor: T(p.vendor) || "Other", model: nz(p.model), modes: (p.modes || ["finger"]).filter((m) => ["finger", "face", "card", "palm", "password"].includes(m)), serial: nz(p.serial), protocol: proto, location: nz(p.location), ip: nz(p.ip), enabled: p.enabled !== false, notes: nz(p.notes) });
      return { id: d.id, push_key: d.push_key };
    },
    kmr_hrms_device_key(a) { const d = S.devices.find((x) => x.id === a.p_id) || err("Machine not found."); d.push_key = id() + id(); return d.push_key; },
    kmr_hrms_device_delete(a) { S.devices = S.devices.filter((d) => d.id !== a.p_id); S.punches.forEach((p) => { if (p.device_id === a.p_id) p.device_id = null; }); return null; },
    kmr_hrms_punch_import(a) {
      const p = a.p, src = p.source || "import"; if (!["import", "manual"].includes(src)) err("Unknown source."); if (!Array.isArray(p.rows)) err("No punches to add.");
      if (p.rows.length > 20000) err("Send at most 20,000 punches at a time."); if (p.device_id && !S.devices.some((d) => d.id === p.device_id)) err("Machine not found.");
      return J(punchAdd(p.rows, src, p.device_id || null));
    },
    kmr_hrms_punch_delete(a) { const n = S.punches.length; const ids = new Set(a.p_ids); S.punches = S.punches.filter((p) => !ids.has(p.id)); return n - S.punches.length; },
    kmr_hrms_employee_save(a) { return { id: empUpsert(a.p, a.p.id || null) }; },
    kmr_hrms_employees_import(a) {
      if (!Array.isArray(a.p.rows)) err("No employees to add."); let n = 0; const errs = [];
      a.p.rows.forEach((r, i) => { try { r = Object.assign({}, r); delete r.id; if (r.shift_name && !r.shift_id) { const s = S.shifts.find((x) => x.name.toLowerCase() === T(r.shift_name).toLowerCase()); r.shift_id = s ? s.id : null; } const ex = T(r.emp_code) && S.emps.find((e) => e.emp_code === T(r.emp_code)); empUpsert(r, ex ? ex.id : null); n++; } catch (e) { errs.push({ row: i + 1, error: e.message }); } });
      return { added: n, errors: errs };
    },
    kmr_hrms_employee_delete(a) { if (S.slips.some((s) => s.employee_id === a.p_id)) err("This employee has payslips. Set the status to Left instead of deleting."); S.emps = S.emps.filter((e) => e.id !== a.p_id); S.att = S.att.filter((r) => r.employee_id !== a.p_id); S.punches = S.punches.filter((p) => p.employee_id !== a.p_id); S.leaves = S.leaves.filter((l) => l.employee_id !== a.p_id); return null; },
    kmr_hrms_att_save(a) {
      const mode = a.p.mode || "auto"; if (!["auto", "manual"].includes(mode)) err("Unknown mode."); if (!Array.isArray(a.p.rows)) err("Nothing to save."); let saved = 0, lockedN = 0, kept = 0;
      a.p.rows.forEach((r) => {
        if (!["P", "HD", "A", "L", "U", "WO", "H", "MP"].includes(r.status)) err("Unknown attendance status " + r.status + "."); const e = S.emps.find((x) => x.id === r.employee_id); if (!e) return;
        if (isLocked(r.work_date)) { lockedN++; return; } const ex = S.att.find((x) => x.employee_id === e.id && x.work_date === r.work_date);
        if (mode === "auto" && ex && ex.source === "manual") { kept++; return; }
        const row = Object.assign(ex || { id: id(), employee_id: e.id, work_date: r.work_date, sample: e.sample }, { in_at: nz(r.in_at), out_at: nz(r.out_at), worked_min: N(r.worked_min), late_min: N(r.late_min), early_min: N(r.early_min), ot_min: N(r.ot_min), status: r.status, leave_code: nz(r.leave_code), source: mode === "manual" ? "manual" : (r.source || "punch"), remarks: nz(r.remarks), updated_at: new Date().toISOString() });
        if (!ex) S.att.push(row); saved++;
      }); return { saved, locked: lockedN, kept_manual: kept };
    },
    kmr_hrms_att_reset(a) { const n = S.att.length; S.att = S.att.filter((r) => !(r.employee_id === a.p_employee && r.work_date >= a.p_from && r.work_date <= a.p_to && r.source === "manual" && !isLocked(r.work_date))); return n - S.att.length; },
    kmr_hrms_leave_save(a) {
      const p = a.p, e = S.emps.find((x) => x.id === p.employee_id) || err("Choose the employee."), t = S.types.find((x) => x.id === p.leave_type_id) || err("Choose the leave type.");
      if (!p.from_date || !p.to_date || p.to_date < p.from_date) err("Choose the leave dates (to-date cannot be before from-date)."); let days = N(p.days); if (days <= 0) days = C.dnum(p.to_date) - C.dnum(p.from_date) + 1;
      if (p.id) { const l = S.leaves.find((x) => x.id === p.id && x.status === "Pending") || err("Only a pending request can be changed."); Object.assign(l, { leave_type_id: t.id, leave_code: t.code, from_date: p.from_date, to_date: p.to_date, half: !!p.half, days, reason: nz(p.reason) }); return { id: l.id }; }
      const l = { id: id(), employee_id: e.id, leave_type_id: t.id, leave_code: t.code, from_date: p.from_date, to_date: p.to_date, half: !!p.half, days, reason: nz(p.reason), status: "Pending", decided_by: null, decided_at: null, sample: e.sample, created_at: new Date().toISOString() }; S.leaves.push(l); return { id: l.id };
    },
    kmr_hrms_leave_decide(a) {
      if (!["Approved", "Rejected", "Cancelled", "Pending"].includes(a.p_status)) err("Unknown status."); const l = S.leaves.find((x) => x.id === a.p_id) || err("Leave request not found.");
      if (a.p_status === "Approved" && (isLocked(l.from_date) || isLocked(l.to_date))) err("The payroll of that month is finalised. Re-open the payroll first.");
      l.status = a.p_status; l.decided_by = "demo@example.com"; l.decided_at = new Date().toISOString();
      S.att = S.att.filter((r) => !(r.employee_id === l.employee_id && r.work_date >= l.from_date && r.work_date <= l.to_date && ["leave", "rule"].includes(r.source) && !isLocked(r.work_date))); return null;
    },
    kmr_hrms_leave_delete(a) { const l = S.leaves.find((x) => x.id === a.p_id && ["Pending", "Rejected", "Cancelled"].includes(x.status)) || err("Only a pending, rejected or cancelled request can be deleted. Cancel an approved one first."); S.leaves = S.leaves.filter((x) => x !== l); return null; },
    kmr_hrms_payroll_list() { return J(S.runs.slice().sort((a, b) => b.period.localeCompare(a.period))); },
    kmr_hrms_payroll_get(a) { const r = S.runs.find((x) => x.period === a.p_period); return r ? J({ run: r, slips: S.slips.filter((s) => s.run_id === r.id).sort((x, y) => x.emp_code.localeCompare(y.emp_code)) }) : null; },
    kmr_hrms_payroll_save(a) {
      const p = a.p; if (!/^\d{4}-\d{2}$/.test(p.period || "")) err("Choose the payroll month."); if (!Array.isArray(p.slips) || !p.slips.length) err("There are no employees to pay for this month.");
      let r = S.runs.find((x) => x.period === p.period); if (r && r.status === "final") err("The payroll of " + p.period + " is finalised. Re-open it first to change it.");
      if (!r) { r = { id: id(), period: p.period, status: "draft", month_days: N(p.month_days, 30), totals: {}, note: nz(p.note), finalised_by: null, finalised_at: null, created_by: "demo@example.com", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; S.runs.push(r); }
      else { S.slips = S.slips.filter((s) => s.run_id !== r.id); r.month_days = N(p.month_days, 30); r.note = nz(p.note); }
      p.slips.forEach((s) => S.slips.push(Object.assign({ id: id() }, J(s), { run_id: r.id }))); r.totals = C.totals(S.slips.filter((s) => s.run_id === r.id)); r.sample = true; return { id: r.id, slips: p.slips.length };
    },
    kmr_hrms_payslip_save(a) {
      const s = S.slips.find((x) => x.id === a.p.id) || err("Payslip not found."), r = S.runs.find((x) => x.id === s.run_id); if (r.status === "final") err("The payroll is finalised. Re-open it to change a payslip.");
      ["earnings", "deductions", "info"].forEach((k) => { if (a.p[k]) s[k] = J(a.p[k]); }); ["gross", "deduct", "net"].forEach((k) => { if (a.p[k] != null) s[k] = N(a.p[k]); }); r.totals = C.totals(S.slips.filter((x) => x.run_id === r.id)); return null;
    },
    kmr_hrms_payroll_final(a) {
      const r = S.runs.find((x) => x.id === a.p_id) || err("Payroll run not found.");
      if (a.p_final) { if (r.status === "final") err("Already finalised."); r.status = "final"; r.finalised_by = "demo@example.com"; r.finalised_at = new Date().toISOString(); } else { r.status = "draft"; r.finalised_by = null; r.finalised_at = null; } return null;
    },
    kmr_hrms_payroll_delete(a) { const r = S.runs.find((x) => x.id === a.p_id && x.status === "draft") || err("Only a draft payroll can be deleted. Re-open a finalised one first."); S.slips = S.slips.filter((s) => s.run_id !== r.id); S.runs = S.runs.filter((x) => x !== r); return null; },
  });
})();
