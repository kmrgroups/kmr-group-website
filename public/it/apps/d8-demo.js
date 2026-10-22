/* 8D Problem Solving - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_d8_*, migration 0080). Nothing here is real data. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim(), J = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));
  let uid = 0; const id = () => "d" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const td = () => day(0), ME = "you@demo.example", orNull = (v) => (T(v) === "" ? null : T(v));
  const num = (v) => (T(v) === "" || isNaN(Number(v)) ? null : Number(v));
  const KEYS = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"];
  const S = { settings: { prefix: "8D", fy_numbering: true, due_days: 15 }, reps: [], acts: [], log: [], n: {} };
  function number() {
    const s = S.settings, pre = (T(s.prefix).toUpperCase().replace(/[^A-Z0-9-]/g, "") || "8D"), d = new Date(), y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
    if (s.fy_numbering !== false) { const fy = String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"); S.n[fy] = (S.n[fy] || 0) + 1; return pre + "/" + fy + "/" + String(S.n[fy]).padStart(4, "0"); }
    S.n.x = (S.n.x || 0) + 1; return pre + "-" + String(S.n.x).padStart(4, "0");
  }
  const lg = (r, text, at) => S.log.push({ report_id: r.id, at: at || new Date().toISOString(), by: ME, text });
  const rep = (i) => S.reps.find((r) => r.id === i) || err("8D report not found.");
  const arr = (v) => (Array.isArray(v) ? v : []);
  const current = (r) => KEYS.find((k) => !r.steps[k]) || null;
  function check(r, s) {
    const sec = r.sections || {}, g = (p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), sec), A = (kind) => S.acts.filter((a) => a.report_id === r.id && a.kind === kind);
    if (s === "D0" && !T(g("d0.symptom"))) return "D0: describe the symptom, what the customer or the line saw.";
    if (s === "D1") { if (!T(g("d1.leader"))) return "D1: name the team leader."; if (arr(g("d1.members")).filter((x) => T(x && x.name)).length < 2) return "D1: a team needs at least two named members."; }
    if (s === "D2") { if (!T(g("d2.deviation"))) return "D2: say what is wrong compared with the requirement."; if (!T(g("d2.where"))) return "D2: say where the problem was found."; }
    if (s === "D3") {
      if (g("d3.not_required") === true || g("d3.not_required") === "true") { if (!T(g("d3.reason"))) return "D3: give the reason why containment is not needed."; }
      else { const l = A("ICA"); if (!l.length) return 'D3: add at least one containment action (or tick "not needed" and give the reason).'; const o = l.filter((a) => a.status === "open").length; if (o) return "D3: " + o + " containment action(s) are still open."; if (l.some((a) => !T(a.owner))) return "D3: every containment action needs an owner."; }
    }
    if (s === "D4") {
      if (!T(g("d4.occurrence.cause"))) return "D4: write the root cause of how the problem occurred."; if (!T(g("d4.escape.cause"))) return "D4: write the root cause of why it was not detected (escape point).";
      if (String(g("d4.occurrence.verified")) !== "true" || String(g("d4.escape.verified")) !== "true") return "D4: confirm that both root causes were verified, and say how.";
    }
    if (s === "D5") { const l = A("PCA"); if (!l.length) return "D5: add at least one permanent corrective action."; if (l.some((a) => !T(a.owner) || !a.due_on)) return "D5: every corrective action needs an owner and a due date."; }
    if (s === "D6") { const o = A("PCA").filter((a) => a.status === "open").length; if (o) return "D6: " + o + " corrective action(s) are still open."; if (!T(g("d6.validation.result"))) return "D6: write the validation result, the proof that the problem is gone."; }
    if (s === "D7" && !(A("PREVENT").length || arr(g("d7.docs")).some((x) => x && String(x.done) === "true") || T(g("d7.horizontal")) || T(g("d7.lessons")))) return "D7: record how the problem is prevented from coming back (documents updated, similar parts checked, or lessons learned).";
    return null;
  }
  function revalidate(r) {
    for (const s of KEYS) { if (!r.steps[s]) break; if (check(r, s)) { KEYS.forEach((k) => { if (k >= s) delete r.steps[k]; }); r.status = "open"; r.closed_on = null; r.closed_by = null; lg(r, s + " ticked off again because its content changed and no longer meets the step."); return; } }
  }
  const rowOut = (r) => { const t = td(), as = S.acts.filter((a) => a.report_id === r.id);
    return Object.assign(J({ id: r.id, no: r.no, title: r.title, status: r.status, source: r.source, complainant: r.complainant, complaint_ref: r.complaint_ref, part_no: r.part_no, part_name: r.part_name, lot_no: r.lot_no, qty_affected: r.qty_affected, severity: r.severity, opened_on: r.opened_on, due_on: r.due_on, owner: r.owner, closed_on: r.closed_on, closed_by: r.closed_by, notes: r.notes, steps: r.steps, sample: true }),
      { current: current(r), age_days: Math.round((new Date(r.closed_on || t) - new Date(r.opened_on)) / 864e5), overdue: r.status === "open" && !!r.due_on && r.due_on < t, actions_open: as.filter((a) => a.status === "open").length, actions_overdue: as.filter((a) => a.status === "open" && a.due_on && a.due_on < t).length }); };
  const actOut = (a) => J({ id: a.id, report_id: a.report_id, kind: a.kind, seq: a.seq, text: a.text, owner: a.owner, due_on: a.due_on, status: a.status, done_on: a.done_on, evidence: a.evidence, verified: a.verified, verified_on: a.verified_on, sample: true });
  function mkRep(o, steps) { const r = Object.assign({ id: id(), no: number(), status: "open", complainant: null, complaint_ref: null, part_no: null, part_name: null, lot_no: null, qty_affected: null, severity: "Major", owner: ME, closed_on: null, closed_by: null, notes: null, sections: {}, analysis: {}, steps: {} }, o); KEYS.forEach((k, i) => { if (steps != null && i < steps) r.steps[k] = day(o.opened_on ? Math.round((new Date(o.opened_on) - new Date(td())) / 864e5) + i * 2 : -i); }); S.reps.push(r); lg(r, "8D opened.", new Date(Date.now() - 864e5 * 5).toISOString()); return r; }
  function mkAct(r, kind, text, owner, due, status, ev, ver) { const seq = S.acts.filter((a) => a.report_id === r.id && a.kind === kind).length + 1; S.acts.push({ id: id(), report_id: r.id, kind, seq, text, owner, due_on: due, status, done_on: status === "done" ? due : null, evidence: ev || null, verified: !!ver, verified_on: ver ? td() : null }); }
  (function seed() {
    const team = { leader: "R. Venkatesh", champion: "Managing director", members: [{ name: "R. Venkatesh", role: "Leader", function: "Quality" }, { name: "K. Arun", role: "Member", function: "Production" }, { name: "M. Divya", role: "Member", function: "Engineering" }] };
    const a = mkRep({ title: "Bore diameter oversize on Drive Flange", source: "Customer complaint", complainant: "Southern Auto Components", complaint_ref: "SAC-CMP-052", part_no: "DP-1101", part_name: "Drive flange", lot_no: "L-2610-04", qty_affected: 120, severity: "Major", opened_on: day(-6), due_on: day(9),
      sections: { d0: { symptom: "Bore measured 0.04 mm over the upper limit on 120 flanges at the customer's incoming inspection.", era_needed: true, era: "Replacement lot sorted 100% on the bore gauge." }, d1: team, d2: { requirement: "Bore 25.000 +0.021 mm", deviation: "Bore up to 25.060 mm", where: "Customer incoming inspection", when: "Lot L-2610-04", who: "Incoming inspector", how_detected: "Plug gauge no-go entered", how_many: "120 of 600", repeat: false }, d3: { not_required: false, stock: [{ where: "Customer plant", checked: 600, ng: 120, action: "Sorted, rejects returned" }, { where: "Our finished stock", checked: 900, ng: 0, action: "100% bore gauging" }], result: "No more bad pieces in stock." }, d4: { occurrence: { category: "Machine", cause: "", verified: false, method: "" }, escape: { category: "Measurement", cause: "", verified: false, method: "" } } },
      analysis: { is_not: [{ dim: "What", is: "Bore oversize", is_not: "Length, face runout", diff: "Only the finish-bored feature" }, { dim: "Where", is: "Machine VMC-03", is_not: "VMC-01, VMC-02", diff: "VMC-03 had an insert change" }, { dim: "When", is: "After the insert change on shift B", is_not: "Earlier lots", diff: "Offset not updated" }, { dim: "How much", is: "120 of 600", is_not: "Whole lot", diff: "" }], whys: { occurrence: [], escape: [] }, fishbone: {} } }, 4);
    mkAct(a, "ICA", "Sort all stock at the customer and in our plant", "K. Arun", day(-5), "done", "Sorting record SR-118"); mkAct(a, "ICA", "Replacement lot with 100% bore gauging", "K. Arun", day(-4), "done", "Dispatch note 4471"); mkAct(a, "ICA", "Quarantine VMC-03 output until offset is checked", "S. Priya", day(-5), "done", "Tag log");
    lg(a, "D0 done.", new Date(Date.now() - 864e5 * 4).toISOString());
    const b = mkRep({ title: "Burr on locating pin found at final inspection", source: "Internal rejection", part_no: "DP-1105", part_name: "Locating pin", lot_no: "L-2610-09", qty_affected: 85, severity: "Minor", opened_on: day(-18), due_on: day(-2),
      sections: { d0: { symptom: "Burr on the chamfer edge of 85 locating pins at final inspection." }, d1: team, d2: { deviation: "Burr taller than 0.1 mm", where: "Final inspection" }, d3: { not_required: false }, d4: { occurrence: { category: "Method", cause: "Deburr step skipped when the routing was changed.", verified: true, method: "Routing history checked" }, escape: { category: "Measurement", cause: "Visual check at final inspection has no limit sample.", verified: true, method: "Inspection sheet reviewed" } }, d6: { validation: { method: "", result: "" } } } }, 6);
    mkAct(b, "ICA", "Rework 85 pins on the deburr bench", "K. Arun", day(-16), "done"); mkAct(b, "PCA", "Put the deburr step back in the routing and lock it", "M. Divya", day(-8), "done", "Routing rev 4", true); mkAct(b, "PCA", "Raise the burr check in the control plan to every hour, sample of 5", "S. Priya", day(-3), "open");
    const c = mkRep({ title: "Thread damage on gear housing caused a line stoppage", source: "Customer complaint", complainant: "Southern Auto Components", complaint_ref: "SAC-CMP-044", part_no: "DP-1103", part_name: "Gear housing", lot_no: "L-2608-02", qty_affected: 60, severity: "Critical", opened_on: day(-60), due_on: day(-40), status: "closed", closed_on: day(-35), closed_by: ME,
      sections: { d0: { symptom: "Damaged M10 threads on 60 gear housings stopped the customer assembly line for two hours.", era_needed: true, era: "Replacement lot air-freighted after 100% thread gauging." }, d1: team, d2: { requirement: "M10x1.5-6H thread", deviation: "Threads torn at the start of the thread", where: "Customer assembly line", how_many: "60 of 800" }, d3: { not_required: false, result: "No further bad pieces found." }, d4: { occurrence: { category: "Machine", cause: "A worn tap was used past its life because tap life is not counted.", verified: true, method: "Tap examined under a microscope" }, escape: { category: "Measurement", cause: "The thread gauge check was done on the first piece only.", verified: true, method: "Check sheets reviewed" }, systemic: { cause: "Tool life is not part of the standard for taps." } }, d6: { validation: { method: "Three lots checked at the customer", result: "No thread defect in 2400 pieces.", ok: true } }, d7: { docs: [{ name: "PFMEA", done: true, ref: "Rev C" }, { name: "Control Plan", done: true, ref: "Rev F" }], horizontal: "Same tap-life rule applied to other tapped parts.", lessons: "Count tool life on every threading tool." }, d8: { recognition: "Team thanked at the monthly quality meeting.", customer_accepted: true, customer_ref: "SAC-CMP-044 closed" } } }, 9);
    mkAct(c, "ICA", "100% thread gauging of stock and replacement lot", "K. Arun", day(-58), "done", "Gauging record"); mkAct(c, "PCA", "Change taps at a fixed count; add a tap-life counter", "M. Divya", day(-44), "done", "Program rev 3", true); mkAct(c, "PREVENT", "Apply the tap-life rule to all tapped parts", "R. Venkatesh", day(-38), "done", "Tool life list");
    lg(c, "D8 done: the 8D is closed.", new Date(Date.now() - 864e5 * 35).toISOString());
  })();

  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_d8_enabled() { return true; },
    kmr_d8_load() { return { role: "admin", me: ME, today: td(), settings: J(S.settings), owners: [ME, "K. Arun", "M. Divya", "S. Priya", "R. Venkatesh"], has_analysis: true, has_tracker: true }; },
    kmr_d8_settings_save(a) {
      const p = a.p || {}, t = num(p.due_days); if (t != null && (t < 0 || t > 365)) err("Days to complete an 8D must be between 0 and 365.");
      if ("fy_numbering" in p && typeof p.fy_numbering !== "boolean") err("Financial-year numbering must be on or off."); S.settings = J(p); return null;
    },
    kmr_d8_report_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase(), st = T(p.status) || "all", so = T(p.source), has = (v) => String(v || "").toLowerCase().includes(q);
      return S.reps.filter((r) => (st === "all" || r.status === st) && (!so || r.source === so) && (!q || has(r.no) || has(r.title) || has(r.part_no) || has(r.part_name) || has(r.complainant) || has(r.complaint_ref)))
        .sort((x, y) => (y.status === "open") - (x.status === "open") || String(x.due_on || "9").localeCompare(String(y.due_on || "9")) || String(y.opened_on).localeCompare(String(x.opened_on))).map(rowOut);
    },
    kmr_d8_report_get(a) {
      const r = rep(a.p_id);
      return Object.assign(rowOut(r), { sections: J(r.sections), analysis: J(r.analysis), has_analysis: true, can_edit: r.status === "open", is_admin: true,
        actions: J(S.acts.filter((x) => x.report_id === r.id).sort((x, y) => x.kind.localeCompare(y.kind) || x.seq - y.seq).map(actOut)), log: J(S.log.filter((l) => l.report_id === r.id).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 60)) });
    },
    kmr_d8_report_save(a) {
      const p = a.p || {}, ttl = orNull(p.title), so = orNull(p.source) || "Customer complaint", sv = orNull(p.severity) || "Major", op = orNull(p.opened_on) || td(), du = orNull(p.due_on), qa = num(p.qty_affected), sec = p.sections || {};
      if (!ttl) err("Give the problem a short title."); if (!["Customer complaint", "Internal rejection", "Supplier problem", "Audit finding", "Field failure", "Other"].includes(so)) err("Choose where the problem came from.");
      if (!["Minor", "Major", "Critical"].includes(sv)) err("Choose the severity: minor, major or critical."); if (qa != null && qa < 0) err("The quantity affected cannot be negative."); if (du && du < op) err("The due date is before the date the 8D was opened.");
      if (typeof sec !== "object" || Array.isArray(sec)) err("The 8D sections are not valid."); const neu = {};
      ["d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"].forEach((k) => { if (k in sec) { if (typeof sec[k] !== "object" || Array.isArray(sec[k]) || sec[k] === null) err("Section " + k.toUpperCase() + " is not valid."); neu[k] = J(sec[k]); } });
      const f = { title: ttl, source: so, complainant: orNull(p.complainant), complaint_ref: orNull(p.complaint_ref), part_no: orNull(p.part_no), part_name: orNull(p.part_name), lot_no: orNull(p.lot_no), qty_affected: qa, severity: sv, opened_on: op, owner: orNull(p.owner), notes: orNull(p.notes) };
      if (!p.id) {
        const dd = num(S.settings.due_days) == null ? 15 : num(S.settings.due_days), d0 = new Date(op); d0.setDate(d0.getDate() + dd);
        const r = mkRep(Object.assign(f, { due_on: du || (("due_on" in p) && T(p.due_on) === "" && false ? null : d0.toISOString().slice(0, 10)), owner: f.owner || ME, sections: neu }), null); S.log = S.log.filter((l) => l.report_id !== r.id); lg(r, "8D opened."); return { id: r.id, no: r.no };
      }
      const r = rep(p.id); if (r.status === "closed") err("This 8D is closed. An administrator can reopen it.");
      Object.assign(r, f, { due_on: du, sections: Object.assign(r.sections, neu) }); revalidate(r); return { id: r.id, no: r.no };
    },
    kmr_d8_step(a) {
      const r = rep(a.p_id), k = a.p_step, i = KEYS.indexOf(k); if (i < 0) err("Choose a step from D0 to D8.");
      if (a.p_done !== false) {
        if (r.steps[k]) return rowOut(r); if (i > 0 && !r.steps[KEYS[i - 1]]) err("Finish " + KEYS[i - 1] + " first."); const m = check(r, k); if (m) err(m);
        r.steps[k] = td(); if (k === "D8") { r.status = "closed"; r.closed_on = td(); r.closed_by = ME; } lg(r, k === "D8" ? "D8 done: the 8D is closed." : k + " done.");
      } else {
        if (!r.steps[k]) return rowOut(r); KEYS.forEach((x, j) => { if (j >= i) delete r.steps[x]; }); r.status = "open"; r.closed_on = null; r.closed_by = null; lg(r, k + " opened again" + (k === "D8" ? " (reopened by administrator)." : "."));
      }
      return rowOut(r);
    },
    kmr_d8_report_delete(a) { const r = rep(a.p_id); S.reps = S.reps.filter((x) => x !== r); S.acts = S.acts.filter((x) => x.report_id !== r.id); S.log = S.log.filter((x) => x.report_id !== r.id); return null; },
    kmr_d8_analysis_save(a) {
      const r = rep(a.p_id), p = a.p || {}; if (r.status === "closed") err("This 8D is closed. An administrator can reopen it.");
      if (typeof p !== "object" || Array.isArray(p)) err("The analysis is not valid."); if ("is_not" in p && (!Array.isArray(p.is_not) || p.is_not.length > 20)) err("The Is / Is-not table can have up to 20 rows.");
      if ("whys" in p && (typeof p.whys !== "object" || Array.isArray(p.whys))) err("The 5-Why chains are not valid."); if ("fishbone" in p && (typeof p.fishbone !== "object" || Array.isArray(p.fishbone))) err("The fishbone sheet is not valid.");
      r.analysis = J({ is_not: p.is_not || [], whys: p.whys || {}, fishbone: p.fishbone || {} }); return null;
    },
    kmr_d8_act_save(a) {
      const p = a.p || {}, kd = orNull(p.kind) || "ICA", st = orNull(p.status) || "open"; if (!orNull(p.text)) err("Write what the action is."); if (!["ICA", "PCA", "PREVENT"].includes(kd)) err("Choose the kind of action."); if (!["open", "done"].includes(st)) err("Choose open or done.");
      let x = p.id ? S.acts.find((y) => y.id === p.id) || err("Action not found.") : null; const r = rep(x ? x.report_id : p.report_id); if (r.status === "closed") err("This 8D is closed. An administrator can reopen it.");
      const vf = p.verified === true || p.verified === "true";
      if (!x) { x = { id: id(), report_id: r.id, seq: S.acts.filter((y) => y.report_id === r.id && y.kind === kd).length + 1, verified_on: null, done_on: null }; S.acts.push(x); }
      Object.assign(x, { kind: kd, text: T(p.text), owner: orNull(p.owner), due_on: orNull(p.due_on), status: st, evidence: orNull(p.evidence), verified: vf }); x.done_on = st === "done" ? x.done_on || orNull(p.done_on) || td() : null; x.verified_on = vf ? x.verified_on || td() : null;
      revalidate(r); return actOut(x);
    },
    kmr_d8_act_done(a) {
      const x = S.acts.find((y) => y.id === a.p_id) || err("Action not found."), r = rep(x.report_id); if (r.status === "closed") err("This 8D is closed. An administrator can reopen it.");
      const d = a.p_done !== false; x.status = d ? "done" : "open"; x.done_on = d ? x.done_on || td() : null; if (!d) { x.verified = false; x.verified_on = null; } revalidate(r); return actOut(x);
    },
    kmr_d8_act_delete(a) { const x = S.acts.find((y) => y.id === a.p_id) || err("Action not found."), r = rep(x.report_id); if (r.status === "closed") err("This 8D is closed. An administrator can reopen it."); S.acts = S.acts.filter((y) => y !== x); revalidate(r); return null; },
    kmr_d8_act_list(a) {
      const p = a.p || {}, t = td(), st = orNull(p.status) || "open", ow = orNull(p.owner), q = T(p.q).toLowerCase(), has = (v) => String(v || "").toLowerCase().includes(q);
      return S.acts.map((x) => ({ x, r: rep(x.report_id) })).filter(({ x, r }) => (st === "all" || x.status === st) && (!ow || T(x.owner).toLowerCase() === ow.toLowerCase()) && (p.overdue !== "true" || (x.status === "open" && x.due_on && x.due_on < t)) && (!q || has(x.text) || has(r.no) || has(r.title)))
        .sort((u, v) => (u.x.status === "done") - (v.x.status === "done") || String(u.x.due_on || "9").localeCompare(String(v.x.due_on || "9"))).map(({ x, r }) => Object.assign(actOut(x), { report_no: r.no, report_title: r.title, part_no: r.part_no, overdue: x.status === "open" && !!x.due_on && x.due_on < t }));
    },
    kmr_d8_dashboard() {
      const t = td(), open = S.reps.filter((r) => r.status === "open"), by = (f) => S.reps.filter((r) => r.opened_on >= day(-365)).reduce((o, r) => { const k = f(r); if (k) o[k] = (o[k] || 0) + 1; return o; }, {}), cl = S.reps.filter((r) => r.status === "closed" && r.closed_on >= day(-180));
      const bs = {}; open.forEach((r) => { const c = current(r); if (c) bs[c] = (bs[c] || 0) + 1; }); const oa = S.acts.filter((a) => a.status === "open" && rep(a.report_id).status === "open");
      return { open: open.length, overdue: open.filter((r) => r.due_on && r.due_on < t).length, critical_open: open.filter((r) => r.severity === "Critical").length, no_containment: open.filter((r) => !r.steps.D3 && (new Date(t) - new Date(r.opened_on)) / 864e5 >= 1).length,
        closed_90: S.reps.filter((r) => r.status === "closed" && r.closed_on >= day(-90)).length, avg_days_to_close: cl.length ? Math.round(cl.reduce((s, r) => s + (new Date(r.closed_on) - new Date(r.opened_on)) / 864e5, 0) / cl.length) : null,
        actions_open: oa.length, actions_overdue: oa.filter((a) => a.due_on && a.due_on < t).length, by_step: bs, by_source: by((r) => r.source), by_cause: S.reps.filter((r) => r.opened_on >= day(-365) && r.steps.D4).reduce((o, r) => { const k = T(g(r, "d4.occurrence.category")) || "Not stated"; o[k] = (o[k] || 0) + 1; return o; }, {}),
        due_soon: open.slice().sort((x, y) => String(x.due_on || "9").localeCompare(String(y.due_on || "9"))).slice(0, 8).map((r) => ({ id: r.id, no: r.no, title: r.title, due_on: r.due_on, severity: r.severity, part_no: r.part_no, current: current(r) })),
        late_actions: oa.filter((a) => a.due_on && a.due_on < t).sort((x, y) => x.due_on.localeCompare(y.due_on)).slice(0, 8).map((a) => ({ id: a.id, text: a.text, owner: a.owner, due_on: a.due_on, kind: a.kind, report_no: rep(a.report_id).no, report_id: a.report_id })) };
      function g(r, p) { return p.split(".").reduce((a2, k) => (a2 == null ? a2 : a2[k]), r.sections); }
    }
  });
})();
