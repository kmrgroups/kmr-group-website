/* Maintenance — sample data for the demo (?demo=1). Same rules and messages as the database functions. */
(function () {
  "use strict";
  const DAY = 864e5, HR = 36e5; let uid = 0; const id = () => "x" + (++uid).toString(36) + Math.random().toString(36).slice(2, 6);
  const isoD = (ms) => new Date(ms).toISOString().slice(0, 10), now = () => Date.now(), iso = (ms) => new Date(ms).toISOString();
  const err = (m) => { throw new Error(m); }, nz = (v) => (v === "" || v == null ? null : v);
  const machines = [["CNC-T01", "CNC Turning 1", "CNC Turning", "Jyoti", "DX-200", "JY-4471", 1180, "A", "Monthly"], ["CNC-T02", "CNC Turning 2", "CNC Turning", "Jyoti", "DX-200", "JY-4472", 1090, "A", "Monthly"], ["VMC-M01", "VMC 1", "VMC", "BFW", "Vision 610", "BFW-2290", 940, "A", "Monthly"],
    ["VMC-M02", "VMC 2", "VMC", "BFW", "Vision 610", "BFW-2291", 620, "B", "Quarterly"], ["GRN-G01", "Cylindrical Grinder", "Grinding", "Micromatic", "GC-350", "MM-8821", 1500, "B", "Quarterly"], ["HOB-H01", "Gear Hobbing 1", "Gear Hobbing", "Liebherr", "LC-80", "LB-1042", 2100, "A", "Monthly"],
    ["PRS-P01", "Press 100T", "Press", "Pyramid", "PP-100", "PY-3317", 1700, "C", "Half-yearly"], ["QA-01", "Inspection bench", "Inspection", "Mitutoyo", "CMM-Crysta", "MT-5521", 800, "C", "Yearly"]]
    .map((r) => ({ code: r[0], name: r[1], type: r[2], make: r[3], model: r[4], serial_no: r[5], installed_on: isoD(now() - r[6] * DAY), criticality: r[7], pm_frequency: r[8], asset_no: "AST-" + r[0], status: "Running", cell: "Cell " + r[7] }));
  const loss_codes = [["D01", "Machine breakdown — mechanical", "Breakdown"], ["D02", "Machine breakdown — electrical / electronic", "Breakdown"], ["D03", "Hydraulic / pneumatic / coolant system failure", "Breakdown"], ["D09", "Tool breakage / unplanned tool change", "Tooling"], ["D19", "Preventive maintenance (planned)", "Planned stop"]]
    .map((x) => ({ code: x[0], name: x[1], group: x[2], category: "Availability", planned: x[2] === "Planned stop" ? "Yes" : "No" }));
  const shifts = [{ code: "A", name: "First shift" }, { code: "B", name: "Second shift" }, { code: "C", name: "Night shift" }];
  const plant = { hoursPerDay: 16, weeklyOff: "Sunday", oee: 80 };
  const bds = [], plans = [], logs = [], events = [], ctr = {};
  const yymm = (ms) => { const d = new Date(ms + 19800000); return String(d.getUTCFullYear()).slice(2) + String(d.getUTCMonth() + 1).padStart(2, "0"); };
  const bdNo = (ms) => { const k = "BD-" + yymm(ms); ctr[k] = (ctr[k] || 0) + 1; return k + "-" + String(ctr[k]).padStart(4, "0"); };
  const mname = (c) => (machines.find((m) => m.code === c) || {}).name;
  const cats = ["Mechanical", "Electrical", "Hydraulic / pneumatic", "Tooling", "Control / software", "Utilities", "Mechanical", "Electrical"];
  const probs = ["Spindle bearing noise and heat", "Servo drive fault alarm", "Hydraulic chuck pressure drop", "Turret not indexing", "Controller hang / restart", "Coolant pump failure", "Axis backlash high", "Limit switch fault"];
  const roots = ["Bearing worn — lubrication interval exceeded", "Loose connector at drive", "Leaking seal on chuck cylinder", "Index sensor misaligned", "Corrupted parameter file", "Impeller choked with swarf", "Ball screw nut wear", "Switch damaged by coolant"];
  const acts = ["Replaced spindle bearing, regreased", "Re-seated and locked connector", "Replaced cylinder seal kit", "Re-aligned sensor, tested 50 indexes", "Restored parameters from backup", "Cleaned pump, fitted strainer", "Adjusted nut preload", "Replaced switch, sealed cable gland"];
  const prev = ["Add bearing greasing to weekly PM", "Torque-mark connectors; check monthly", "Seal kit kept as critical spare", "Add sensor check to weekly PM", "Parameter backup after every change", "Fit strainer; clean weekly", "Check backlash quarterly", "Cable glands to IP67 type"];
  const dcs = ["D01", "D02", "D03", "D09", "D01", "D03", "D01", "D02"];
  machines.forEach((m, k) => {
    const i = k + 1;
    events.push({ id: id(), machine_code: m.code, event_date: m.installed_on, type: "Installation", description: "Installed and commissioned; trial run and accuracy check passed", cost: null, done_by: "Supplier engineer", status: "ok" });
    if (i % 3 === 0) events.push({ id: id(), machine_code: m.code, event_date: isoD(now() - (200 + i * 11) * DAY), type: "Modification", description: "Coolant filtration unit added", cost: 38000, done_by: "Maintenance", status: "ok" });
    if (i % 4 === 1) events.push({ id: id(), machine_code: m.code, event_date: isoD(now() - (320 + i * 5) * DAY), type: "Overhaul", description: "Annual overhaul: spindle, guideways, hydraulics", cost: 145000, done_by: "OEM service", status: "ok" });
    const cnt = i % 4 === 2 ? 9 : i % 3 === 0 ? 6 : 4;
    for (let j = 1; j <= cnt; j++) {
      const d = 6 + ((i * 17 + j * 29) % 140), hr = 6 + ((i * 5 + j * 3) % 14), dur = 25 + ((i * 37 + j * 53) % 260), st = Math.floor(now() / DAY) * DAY - d * DAY + hr * HR - 19800000 + 19800000, p = (i + j) % 8;
      bds.push({ id: id(), bd_no: bdNo(st), machine_code: m.code, machine_name: m.name, started_at: iso(st), attended_at: iso(st + (5 + (j * 7) % 20) * 60000), ended_at: iso(st + dur * 60000), shift: hr < 14 ? "A" : "B", reported_by: "Operator", attended_by: "Maintenance", problem: probs[p], category: cats[p], d_code: dcs[p], root_cause: roots[p], action_taken: acts[p], preventive_action: prev[p], spares: (i + j) % 3 === 0 ? [{ spare: "Bearing set", qty: 1 }] : [], status: "closed", closed_by: "sample" });
    }
    if (i === 2) bds.push({ id: id(), bd_no: bdNo(now()), machine_code: m.code, machine_name: m.name, started_at: iso(now() - 95 * 60000), attended_at: null, ended_at: null, shift: "A", reported_by: "Operator", problem: "Spindle will not start — drive alarm", category: "Electrical", status: "open" });
    if (i === 4) bds.push({ id: id(), bd_no: bdNo(now()), machine_code: m.code, machine_name: m.name, started_at: iso(now() - 3 * HR), attended_at: iso(now() - 3 * HR + 20 * 60000), attended_by: "Maintenance", ended_at: null, shift: "A", reported_by: "Operator", problem: "Coolant leak at the tank — pump replacement awaited", category: "Utilities", status: "attended" });
    const l7 = 3 + i % 6, l30 = 12 + i * 4;
    const p7 = { id: id(), machine_code: m.code, machine_name: m.name, task: "Weekly: lubrication, cleaning, coolant level, guard and safety check", frequency_days: 7, est_min: 45, last_done: isoD(now() - l7 * DAY), next_due: isoD(now() - l7 * DAY + 7 * DAY), active: true };
    plans.push(p7, { id: id(), machine_code: m.code, machine_name: m.name, task: "Monthly PM: filters, belts, alignment check, electrical tightness", frequency_days: 30, est_min: 180, last_done: isoD(now() - l30 * DAY), next_due: isoD(now() - l30 * DAY + 30 * DAY), active: true });
    for (let j = 0; j < 3; j++) { const dn = isoD(now() - (l7 + 7 * j) * DAY); logs.push({ id: id(), plan_id: p7.id, machine_code: m.code, task: p7.task, done_on: dn, due_on: j === 0 && i % 4 === 0 ? isoD(now() - (l7 + 7 * j + 2) * DAY) : dn, done_by: "Maintenance", duration_min: 41 + j, findings: j ? "OK — minor oil top-up" : "OK", status: "ok" }); }
  });
  const lossRows = () => { const out = []; bds.filter((b) => b.status === "closed" && b.d_code).forEach((b) => out.push({ loss_date: isoD(Date.parse(b.started_at)), machine_code: b.machine_code, d_code: b.d_code, d_name: (loss_codes.find((l) => l.code === b.d_code) || {}).name, minutes: Math.round((Date.parse(b.ended_at) - Date.parse(b.started_at)) / 60000), ref: b.bd_no })); return out; };
  const other = [["CNC-T01", "D09", 60, 9], ["VMC-M01", "D09", 35, 14], ["CNC-T02", "D09", 45, 20], ["GRN-G01", "D03", 50, 33]].map((x) => ({ loss_date: isoD(now() - x[3] * DAY), machine_code: x[0], d_code: x[1], d_name: (loss_codes.find((l) => l.code === x[1]) || {}).name, minutes: x[2] }));
  const byId = (a, k) => a.find((x) => x.id === k);

  window.QP_DEMO = {
    kmr_mnt_load() { return { machines, loss_codes, shifts, plant, has_mmd: false, today: isoD(now()), now: iso(now()) }; },
    kmr_mnt_data() { return { breakdowns: bds.filter((b) => b.status !== "void").slice().sort((a, b) => b.started_at.localeCompare(a.started_at)), plans: plans.filter((p) => p.active).slice().sort((a, b) => a.next_due.localeCompare(b.next_due)), pm_log: logs.filter((l) => l.status === "ok"), events: events.filter((e) => e.status === "ok"), losses: other, today: isoD(now()), now: iso(now()) }; },
    kmr_mnt_card(a) {
      const m = machines.find((x) => x.code === a.p_machine); if (!m) err("Machine “" + (a.p_machine || "") + "” is not in Operations Master › Machines.");
      return { machine: m, breakdowns: bds.filter((b) => b.machine_code === m.code && b.status !== "void").sort((x, y) => y.started_at.localeCompare(x.started_at)), pm_log: logs.filter((l) => l.machine_code === m.code && l.status === "ok"), events: events.filter((e) => e.machine_code === m.code && e.status === "ok"), plans: plans.filter((p) => p.machine_code === m.code && p.active), today: isoD(now()), now: iso(now()) };
    },
    kmr_mnt_bd_start(a) {
      const p = a.p, mc = String(p.machine_code || "").trim(), m = machines.find((x) => x.code === mc), st = nz(p.started_at) ? Date.parse(p.started_at) : now();
      if (!m) err("Choose the machine (Operations Master › Machines)."); if (!String(p.problem || "").trim()) err("Describe the problem."); if (st > now() + 3e5) err("The breakdown cannot start in the future.");
      if (bds.some((b) => b.machine_code === mc && ["open", "attended"].includes(b.status))) err("Machine " + mc + " already has an open breakdown. Close it first.");
      const b = { id: id(), bd_no: bdNo(st), machine_code: mc, machine_name: m.name, started_at: iso(st), attended_at: null, ended_at: null, shift: nz(p.shift), reported_by: nz(p.reported_by) || "demo@kmr.test", problem: String(p.problem).trim(), category: nz(p.category), status: "open" }; bds.push(b); return b;
    },
    kmr_mnt_bd_attend(a) { const b = byId(bds, a.p_id), at = nz(a.p.attended_at) ? Date.parse(a.p.attended_at) : now(); if (!b || b.status !== "open") err("Only a breakdown that is waiting for attention can be marked as attended."); if (at < Date.parse(b.started_at)) err("Attended time is before the breakdown started."); Object.assign(b, { attended_at: iso(at), attended_by: nz(a.p.attended_by) || "demo@kmr.test", status: "attended" }); return null; },
    kmr_mnt_bd_close(a) {
      const b = byId(bds, a.p_id), p = a.p, en = nz(p.ended_at) ? Date.parse(p.ended_at) : now(); if (!b || !["open", "attended"].includes(b.status)) err("This breakdown is already closed.");
      if (en <= Date.parse(b.started_at)) err("The machine cannot be restored before the breakdown started."); if (en > now() + 3e5) err("The restore time cannot be in the future.");
      if (!String(p.category || "").trim()) err("Choose the cause category."); if (!String(p.root_cause || "").trim()) err("Enter the root cause."); if (!String(p.action_taken || "").trim()) err("Enter the corrective action taken.");
      if (nz(p.d_code) && !loss_codes.some((l) => l.code === p.d_code)) err("Loss code " + p.d_code + " is not in Operations Master › Loss codes.");
      Object.assign(b, { ended_at: iso(en), status: "closed", closed_by: "demo@kmr.test", category: p.category, d_code: nz(p.d_code), root_cause: p.root_cause.trim(), action_taken: p.action_taken.trim(), preventive_action: nz(String(p.preventive_action || "").trim()), spares: Array.isArray(p.spares) ? p.spares : [] }); return null;
    },
    kmr_mnt_bd_void(a) { if (!String(a.p_reason || "").trim()) err("Give the reason for voiding the breakdown."); const b = byId(bds, a.p_id); if (!b || b.status === "void") err("Breakdown not found."); b.status = "void"; b.void_reason = a.p_reason; return null; },
    kmr_mnt_pm_save(a) {
      const p = a.p, m = machines.find((x) => x.code === p.machine_code), fq = +p.frequency_days; if (!m) err("Choose the machine."); if (!String(p.task || "").trim()) err("Enter the maintenance task."); if (!(fq >= 1 && fq <= 1100)) err("Enter the frequency in days (1–1100).");
      let r = p.id && byId(plans, p.id); if (!r) { plans.push(r = { id: id(), active: true, last_done: null }); r.next_due = nz(p.next_due) || isoD(now() + fq * DAY); }
      Object.assign(r, { machine_code: m.code, machine_name: m.name, task: p.task.trim(), frequency_days: fq, est_min: nz(p.est_min) ? +p.est_min : null }); if (nz(p.next_due)) r.next_due = p.next_due; return r.id;
    },
    kmr_mnt_pm_seed() { let n = 0; const F = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, "Half-yearly": 182, Yearly: 365 }; machines.forEach((m) => { if (F[m.pm_frequency] && !plans.some((p) => p.machine_code === m.code && p.active)) { plans.push({ id: id(), machine_code: m.code, machine_name: m.name, task: "Preventive maintenance as per the PM checklist (" + m.pm_frequency + ")", frequency_days: F[m.pm_frequency], last_done: null, next_due: isoD(now() + 5 * DAY), active: true }); n++; } }); return n; },
    kmr_mnt_pm_done(a) {
      const pl = byId(plans, a.p_plan), p = a.p, dn = nz(p.done_on) || isoD(now()); if (!pl) err("Plan not found."); if (dn > isoD(now())) err("The date done cannot be in the future.");
      logs.push({ id: id(), plan_id: pl.id, machine_code: pl.machine_code, task: pl.task, done_on: dn, due_on: pl.next_due, done_by: nz(p.done_by) || "demo@kmr.test", duration_min: nz(p.duration_min) ? +p.duration_min : null, findings: nz(p.findings), status: "ok" });
      pl.last_done = !pl.last_done || dn > pl.last_done ? dn : pl.last_done; pl.next_due = isoD(Date.parse(pl.last_done + "T00:00:00Z") + pl.frequency_days * DAY); return null;
    },
    kmr_mnt_pm_void(a) {
      if (!String(a.p_reason || "").trim()) err("Give the reason for voiding the record."); const l = byId(logs, a.p_log); if (!l || l.status === "void") err("Record not found."); l.status = "void"; l.void_reason = a.p_reason;
      const pl = byId(plans, l.plan_id); if (pl) { const ld = logs.filter((x) => x.plan_id === pl.id && x.status === "ok").map((x) => x.done_on).sort().pop() || null; pl.last_done = ld; pl.next_due = ld ? isoD(Date.parse(ld + "T00:00:00Z") + pl.frequency_days * DAY) : l.due_on || pl.next_due; } return null;
    },
    kmr_mnt_event_save(a) { const p = a.p; if (!machines.some((m) => m.code === p.machine_code)) err("Choose the machine."); if (!String(p.type || "").trim()) err("Choose the type of entry."); if (!String(p.description || "").trim()) err("Describe what was done."); const e = { id: id(), machine_code: p.machine_code, event_date: nz(p.event_date) || isoD(now()), type: p.type.trim(), description: p.description.trim(), cost: nz(p.cost) ? +p.cost : null, done_by: nz(p.done_by), status: "ok" }; events.push(e); return e.id; },
    kmr_mnt_event_void(a) { if (!String(a.p_reason || "").trim()) err("Give the reason for voiding the entry."); const e = byId(events, a.p_id); if (e) { e.status = "void"; e.void_reason = a.p_reason; } return null; }
  };
})();
