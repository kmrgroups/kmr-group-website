/* Internal Audit - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_aud_*, migration 0082). Nothing here is real data. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim(), J = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));
  let uid = 0; const id = () => "a" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const td = () => day(0), ME = "you@demo.example", orNull = (v) => (T(v) === "" ? null : T(v));
  const S = { settings: { prefix: "AUD", fy_numbering: true, due_days: 30 }, aud: [], acts: [], log: [], n: {}, ncs: [], pts: [] };
  function number() {
    const s = S.settings, pre = (T(s.prefix).toUpperCase().replace(/[^A-Z0-9-]/g, "") || "AUD"), d = new Date(), y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
    if (s.fy_numbering !== false) { const fy = String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"); S.n[fy] = (S.n[fy] || 0) + 1; return pre + "/" + fy + "/" + String(S.n[fy]).padStart(4, "0"); }
    S.n.x = (S.n.x || 0) + 1; return pre + "-" + String(S.n.x).padStart(4, "0");
  }
  const lg = (r, text, at) => S.log.push({ audit_id: r.id, at: at || new Date().toISOString(), by: ME, text });
  const au = (i) => S.aud.find((r) => r.id === i) || err("Audit not found.");
  const ratingsOf = (t) => (t === "Process" ? ["10", "8", "6", "4", "0", "NA"] : ["OK", "Minor", "Major", "Observation", "NA"]), TYPES9 = ["System", "Process", "Product", "Supplier", "LPA", "Document", "Special", "EHS", "Lab"];
  const isF = (r) => ["Minor", "Major", "8", "6", "4", "0"].includes(String(r));
  function score(cl) { const r = cl.filter((x) => ["10", "8", "6", "4", "0"].includes(String(x.rating))); if (!r.length) return [null, null]; const sc = Math.round((r.reduce((s, x) => s + Number(x.rating), 0) * 1000) / (10 * r.length)) / 10; let g = sc >= 90 ? "A" : sc >= 80 ? "B" : "C"; if (g === "A" && r.some((x) => String(x.rating) === "0")) g = "B"; return [sc, g]; }
  const mk = (o) => { const r = Object.assign({ id: id(), no: number(), status: "planned", area: null, scope: null, planned_on: null, done_on: null, auditor: null, auditee: null, shifts: [], checklist: [], meta: {}, summary: null, score: null, grade: null, reported_on: null, closed_on: null }, o); S.aud.push(r); lg(r, "Audit planned."); return r; };
  const mkAct = (r, q, text, owner, dueOn, status, evidence, ver) => { const a = { id: id(), audit_id: r.id, q_id: q, text, owner, due_on: dueOn, status: status || "open", done_on: status === "done" ? day(-3) : null, evidence: evidence || null, verified: !!ver, verified_on: ver ? day(-1) : null, created_at: Date.now() + uid }; S.acts.push(a); return a; };
  const actOut = (a) => { const o = J(a); delete o.created_at; return o; };
  const rowOut = (r) => {
    const t = td(), as = S.acts.filter((a) => a.audit_id === r.id);
    return { id: r.id, no: r.no, title: r.title, type: r.type, status: r.status, meta: J(r.meta || {}), ncs: S.ncs.filter((n) => n.audit_id === r.id).length, ncs_open: S.ncs.filter((n) => n.audit_id === r.id && !["closed", "cancelled"].includes(n.status)).length, area: r.area, scope: r.scope, planned_on: r.planned_on, done_on: r.done_on, auditor: r.auditor, auditee: r.auditee, shifts: J(r.shifts), summary: r.summary, score: r.score, grade: r.grade, reported_on: r.reported_on, closed_on: r.closed_on, sample: false, updated_at: null,
      questions: r.checklist.length, rated: r.checklist.filter((x) => T(x.rating)).length, findings: r.checklist.filter((x) => isF(x.rating)).length, late: r.status === "planned" && !!r.planned_on && r.planned_on < t,
      actions_open: as.filter((a) => a.status === "open").length, actions_overdue: as.filter((a) => a.status === "open" && a.due_on && a.due_on < t).length };
  };
  const has = (k) => !(window.QP_LOCKS && window.QP_LOCKS.off && window.QP_LOCKS.off.includes(k));

  (function seed() {
    const a = mk({ title: "Document control and calibration, Final Inspection", type: "System", status: "closed", area: "Final Inspection", scope: "Clauses 7.1.5, 7.5.3, 8.7", planned_on: day(-70), done_on: day(-70), auditor: "M. Divya", auditee: "S. Priya", shifts: ["A"], reported_on: day(-69), closed_on: day(-55),
      summary: "System works. One minor finding on old copies of a procedure; fixed and checked.",
      checklist: [{ id: "s1", q: "Is the quality policy known to the people in the area?", ref: "ISO 9001 5.2", rating: "OK" }, { id: "s2", q: "Are the current versions of procedures available where the work is done?", ref: "ISO 9001 7.5.3", rating: "Minor", note: "Two old copies of the inspection procedure on the notice board." }, { id: "s3", q: "Are calibration stickers valid on all gauges in use?", ref: "ISO 9001 7.1.5", rating: "OK" }, { id: "s4", q: "Are nonconforming parts identified and kept apart?", ref: "ISO 9001 8.7", rating: "OK" }] });
    mkAct(a, "s2", "Remove old copies from the notice board and review the document list weekly", "S. Priya", day(-60), "done", "Photo of the board; weekly check added to the 5S sheet", true);
    lg(a, "Audit report issued.", new Date(Date.now() - 864e5 * 69).toISOString()); lg(a, "Audit closed: all findings fixed and checked.", new Date(Date.now() - 864e5 * 55).toISOString());
    const cl = [{ id: "p1", q: "Is the work instruction at the machine and does it match the control plan?", ref: "VDA 6.3 P6.2", rating: "10" }, { id: "p2", q: "Is the first-piece approval recorded for every setup?", ref: "VDA 6.3 P6.2", rating: "8", note: "Record missing on 2 of 10 setups checked." },
      { id: "p3", q: "Are gauges at the machine calibrated and suitable for the tolerance?", ref: "VDA 6.3 P6.2", rating: "10" }, { id: "p4", q: "Are rejected parts stopped and tagged immediately?", ref: "VDA 6.3 P6.5", rating: "4", note: "Red bin not emptied; two rejects mixed with good parts." },
      { id: "p5", q: "Is the reaction plan known to the operator?", ref: "VDA 6.3 P6.5", rating: "10" }, { id: "p6", q: "Is the tool life monitored and recorded?", ref: "VDA 6.3 P6.3", rating: "NA" }];
    const sc = score(cl), b = mk({ title: "Process audit, Boring operation T04", type: "Process", status: "reported", area: "Machining T04", scope: "Process steps of VDA 6.3 P6", planned_on: day(-20), done_on: day(-20), auditor: "R. Venkatesh", auditee: "K. Arun", shifts: ["B"], checklist: cl, summary: "Good discipline on gauges and instructions. Setup records and handling of rejects need attention.", score: sc[0], grade: sc[1], reported_on: day(-18) });
    mkAct(b, "p2", "Make the setup approval sheet a mandatory step before the first lot is released", "K. Arun", day(-6), "done", "Revised changeover sheet CS-04 rev 02"); mkAct(b, "p4", "Fix a locked red bin at the machine and train all three shifts on the rule", "K. Arun", day(-3), "open");
    mk({ title: "Process audit, Night shift grinding", type: "Process", area: "Grinding", scope: "Night shift practice", planned_on: day(-5), auditor: "M. Divya", auditee: "P. Kumar", shifts: ["C"] });
    mk({ title: "Product audit, Drive Flange DP-1101", type: "Product", area: "Final Inspection", scope: "Dimensions and appearance of 5 finished pieces", planned_on: day(12), auditor: "S. Priya", auditee: "R. Venkatesh", shifts: ["A"] });
  })();

  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_aud_enabled() { return true; },
    kmr_aud_load() { return { role: "admin", me: ME, today: td(), settings: J(S.settings), owners: [ME, "K. Arun", "M. Divya", "S. Priya", "R. Venkatesh", "P. Kumar"], has_findings: has("aud.findings-tracker"), has_scoring: has("aud.vda-6-3-scoring") }; },
    kmr_aud_settings_save(a) {
      const p = a.p || {}, t = T(p.due_days) === "" ? null : Number(p.due_days); if (t != null && (isNaN(t) || t < 0 || t > 365)) err("Days to close a finding must be between 0 and 365.");
      if ("fy_numbering" in p && typeof p.fy_numbering !== "boolean") err("Financial-year numbering must be on or off."); S.settings = J(p); return null;
    },
    kmr_aud_audit_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase(), st = T(p.status) || "all", ty = T(p.type), h = (v) => String(v || "").toLowerCase().includes(q);
      return S.aud.filter((r) => (st === "all" || r.status === st || (st === "open" && (r.status === "planned" || r.status === "reported"))) && (!ty || r.type === ty) && (!q || h(r.no) || h(r.title) || h(r.area) || h(r.auditor)))
        .sort((x, y) => String(y.planned_on || "").localeCompare(String(x.planned_on || ""))).map(rowOut);
    },
    kmr_aud_audit_get(a) {
      const r = au(a.p_id), hs = has("aud.vda-6-3-scoring");
      return Object.assign(rowOut(r), { checklist: J(r.checklist), has_scoring: hs, score: hs ? r.score : null, grade: hs ? r.grade : null, can_edit: r.status === "planned", can_act: r.status === "planned" || r.status === "reported", is_admin: true, ratings: ratingsOf(r.type),
        actions: S.acts.filter((x) => x.audit_id === r.id).sort((x, y) => x.created_at - y.created_at).map(actOut), log: J(S.log.filter((l) => l.audit_id === r.id).sort((x, y) => String(y.at).localeCompare(String(x.at)))) });
    },
    kmr_aud_audit_save(a) {
      const p = a.p || {}, ttl = orNull(p.title), ty = orNull(p.type) || "System", sh = p.shifts == null ? [] : p.shifts;
      if (!ttl) err("Give the audit a short title."); if (!TYPES9.includes(ty)) err("Choose the audit type.");
      if (!Array.isArray(sh) || sh.some((s) => !["A", "B", "C", "General"].includes(s))) err("Shift must be A, B, C or General.");
      let out = null; if (p.checklist != null) {
        if (!Array.isArray(p.checklist)) err("The checklist is not valid."); if (p.checklist.length > 200) err("A checklist can have up to 200 questions.");
        out = p.checklist.map((x, i) => { if (!x || !orNull(x.q)) err("Question " + (i + 1) + " is empty."); const rt = orNull(x.rating); if (rt && !ratingsOf(ty).includes(rt)) err("Question " + (i + 1) + ": the rating must be one of " + ratingsOf(ty).join(", ") + "."); const o = { id: orNull(x.id) || id(), q: T(x.q), ref: orNull(x.ref), rating: rt, note: orNull(x.note) }; ["cl", "std", "ev", "cat", "ans", "imp", "rule", "pt"].forEach((k) => (o[k] = orNull(x[k]))); o.w = /^[0-2]$/.test(String(x.w)) ? Number(x.w) : null; o.n = x.n == null || x.n === "" ? null : Number(x.n); o.f = x.f == null || x.f === "" ? null : Number(x.f); if (x.absent === true) o.absent = true; return o; });
      }
      const f = { title: ttl, type: ty, area: orNull(p.area), scope: orNull(p.scope), planned_on: orNull(p.planned_on), done_on: orNull(p.done_on), auditor: orNull(p.auditor), auditee: orNull(p.auditee), shifts: J(sh), summary: orNull(p.summary) }; if (p.meta && typeof p.meta === "object") f.meta = J(p.meta);
      if (!p.id) { const r = mk(Object.assign(f, { checklist: out || [] })); return { id: r.id, no: r.no }; }
      const r = au(p.id); if (r.status !== "planned") err("This audit is " + r.status + " and can no longer be edited. An administrator can reopen it.");
      if (ty !== r.type && r.checklist.some((x) => T(x.rating))) err("The audit type cannot be changed after questions have been rated.");
      Object.assign(r, f); if (out) r.checklist = out; return { id: r.id, no: r.no };
    },
    kmr_aud_issue(a) {
      const r = au(a.p_id), t = td(); if (r.status !== "planned") err("This audit is already " + r.status + ".");
      if (!r.done_on) err("Enter the date the audit was done."); if (r.done_on > t) err("The audit date is in the future."); if (!T(r.auditor)) err("Name the auditor."); if (!T(r.auditee)) err("Name the person or area audited.");
      if (T(r.auditor).toLowerCase() === T(r.auditee).toLowerCase()) err("The auditor must not audit their own work. Choose another auditor."); const reg = S.settings.auditors; if (Array.isArray(reg) && reg.length && !reg.some((x) => T(x.name).toLowerCase() === T(r.auditor).toLowerCase() && (x.status || "qualified") !== "trainee" && (!(x.types || []).length || x.types.includes(r.type)) && (!x.valid_till || x.valid_till >= t))) err(r.auditor + " is not listed as a qualified auditor for " + r.type + " audits, or the qualification has expired (see the auditor register in Setup).");
      if (!r.checklist.length) err("Add at least one question to the checklist.");
      const nr = r.checklist.filter((x) => !T(x.rating)).length; if (nr) err("Rate every question: " + nr + " are not rated yet.");
      const na = r.checklist.filter((x) => isF(x.rating) && !S.acts.some((y) => y.audit_id === r.id && y.q_id === x.id && T(y.owner) && y.due_on) && !S.ncs.some((c) => c.audit_id === r.id && c.q_id === x.id && c.status !== "cancelled" && T(c.problem) && T(c.owner) && c.resp_due && c.contain_due)).length; if (na) err(na + " finding(s) still need a problem description, an owner and due dates (open the finding and fill the containment and response dates).");
      if (r.type === "Process" && has("aud.vda-6-3-scoring")) { const s = score(r.checklist); r.score = s[0]; r.grade = s[1]; }
      r.status = "reported"; r.reported_on = t; lg(r, "Audit report issued" + (r.grade ? ": score " + r.score + "%, grade " + r.grade : "") + "."); return rowOut(r);
    },
    kmr_aud_close(a) {
      const r = au(a.p_id); if (r.status !== "reported") err("Issue the report first."); const as = S.acts.filter((x) => x.audit_id === r.id);
      let n = as.filter((x) => x.status === "open").length; if (n) err(n + " action(s) are still open."); n = as.filter((x) => !x.verified).length; if (n) err(n + " action(s) are not yet checked for effectiveness."); n = S.ncs.filter((c) => c.audit_id === r.id && !["closed", "cancelled"].includes(c.status)).length; if (n) err(n + " finding(s) are not closed yet: finish the corrective action and the effectiveness check.");
      r.status = "closed"; r.closed_on = td(); lg(r, "Audit closed: all findings fixed and checked."); return rowOut(r);
    },
    kmr_aud_reopen(a) {
      const r = au(a.p_id); if (r.status === "closed") { r.status = "reported"; r.closed_on = null; } else if (r.status === "reported" || r.status === "cancelled") { r.status = "planned"; r.reported_on = null; r.score = null; r.grade = null; } else err("This audit is not issued yet.");
      lg(r, "Audit reopened by administrator (now " + r.status + ")."); return rowOut(r);
    },
    kmr_aud_cancel(a) { const r = au(a.p_id); if (r.status !== "planned") err("Only a planned audit can be cancelled."); if (!T(a.p_reason)) err("Give the reason for cancelling the audit."); r.status = "cancelled"; lg(r, "Audit cancelled: " + T(a.p_reason)); return rowOut(r); },
    kmr_aud_audit_delete(a) { const r = au(a.p_id); S.aud = S.aud.filter((x) => x !== r); S.acts = S.acts.filter((x) => x.audit_id !== r.id); S.ncs = S.ncs.filter((x) => x.audit_id !== r.id); return null; },
    kmr_aud_act_save(a) {
      const p = a.p || {}; if (!orNull(p.text)) err("Write what the action is."); const st = orNull(p.status) || "open"; if (!["open", "done"].includes(st)) err("Choose open or done.");
      let x = p.id ? S.acts.find((y) => y.id === p.id) || err("Action not found.") : null; const r = au(x ? x.audit_id : p.audit_id);
      if (!["planned", "reported"].includes(r.status)) err("This audit is " + r.status + ". An administrator can reopen it."); const vf = p.verified === true || p.verified === "true"; if (vf && st !== "done") err("An action can be checked for effectiveness only after it is done.");
      if (!x) { x = mkAct(r, orNull(p.q_id), T(p.text), orNull(p.owner), orNull(p.due_on), "open"); }
      Object.assign(x, { text: T(p.text), owner: orNull(p.owner), due_on: orNull(p.due_on), evidence: orNull(p.evidence), status: st, done_on: st === "done" ? x.done_on || td() : null, verified: vf, verified_on: vf ? x.verified_on || td() : null }); if (p.q_id) x.q_id = p.q_id; return actOut(x);
    },
    kmr_aud_act_done(a) {
      const x = S.acts.find((y) => y.id === a.p_id) || err("Action not found."), r = au(x.audit_id); if (!["planned", "reported"].includes(r.status)) err("This audit is " + r.status + ". An administrator can reopen it.");
      const d = a.p_done !== false; x.status = d ? "done" : "open"; x.done_on = d ? x.done_on || td() : null; if (!d) { x.verified = false; x.verified_on = null; } return actOut(x);
    },
    kmr_aud_act_delete(a) { const x = S.acts.find((y) => y.id === a.p_id) || err("Action not found."), r = au(x.audit_id); if (r.status !== "planned") err("Actions of an issued audit cannot be removed. Mark the action done instead."); S.acts = S.acts.filter((y) => y !== x); return null; },
    kmr_aud_act_list(a) {
      if (!has("aud.findings-tracker")) err("Findings tracker is not part of your company's subscription. To add it, contact KMR Group of Companies - www.kmr-groups.com/contact.");
      const p = a.p || {}, st = T(p.status) || "open", ow = T(p.owner).toLowerCase(), q = T(p.q).toLowerCase(), t = td();
      return S.acts.filter((x) => { const r = au(x.audit_id); return r.status !== "cancelled" && (st === "all" || x.status === st) && (!ow || T(x.owner).toLowerCase() === ow) && (p.overdue !== "true" || (x.status === "open" && x.due_on && x.due_on < t)) && (!q || x.text.toLowerCase().includes(q) || r.no.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)); })
        .sort((x, y) => (x.status === "done") - (y.status === "done") || String(x.due_on || "9").localeCompare(String(y.due_on || "9"))).map((x) => { const r = au(x.audit_id); return Object.assign(actOut(x), { audit_no: r.no, audit_title: r.title, audit_type: r.type, overdue: x.status === "open" && !!x.due_on && x.due_on < t }); });
    },
    kmr_aud_dashboard(a) {
      const t = td(), yr = a.p_year || new Date().getFullYear(), inYr = S.aud.filter((r) => Number(String(r.planned_on || r.done_on || t).slice(0, 4)) === yr), pl = inYr.filter((r) => r.status !== "cancelled"), dn = pl.filter((r) => r.status === "reported" || r.status === "closed");
      const live = S.acts.filter((x) => au(x.audit_id).status !== "cancelled"), bt = {};
      inYr.forEach((r) => { if (r.status === "cancelled") return; const o = (bt[r.type] = bt[r.type] || { planned: 0, done: 0 }); o.planned++; if (r.status === "reported" || r.status === "closed") o.done++; });
      const ps = S.aud.filter((r) => r.type === "Process" && (r.status === "reported" || r.status === "closed") && r.score != null && r.done_on >= day(-365));
      return { year: yr, planned: pl.length, done: dn.length, completion: pl.length ? Math.round((dn.length * 100) / pl.length) : null, late_audits: S.aud.filter((r) => r.status === "planned" && r.planned_on && r.planned_on < t).length,
        open_actions: live.filter((x) => x.status === "open").length, overdue_actions: live.filter((x) => x.status === "open" && x.due_on && x.due_on < t).length, unchecked: live.filter((x) => x.status === "done" && !x.verified).length, by_type: bt,
        shifts: [...new Set(dn.flatMap((r) => r.shifts))], avg_score: ps.length ? Math.round((ps.reduce((s, r) => s + r.score, 0) * 10) / ps.length) / 10 : null,
        upcoming: S.aud.filter((r) => r.status === "planned").sort((x, y) => String(x.planned_on || "9").localeCompare(String(y.planned_on || "9"))).slice(0, 8).map((r) => ({ id: r.id, no: r.no, title: r.title, type: r.type, area: r.area, planned_on: r.planned_on, auditor: r.auditor })),
        late_actions: live.filter((x) => x.status === "open" && x.due_on && x.due_on < t).sort((x, y) => x.due_on.localeCompare(y.due_on)).slice(0, 8).map((x) => ({ id: x.id, text: x.text, owner: x.owner, due_on: x.due_on, audit_no: au(x.audit_id).no, audit_id: x.audit_id })),
        recent: S.aud.filter((r) => r.status === "reported" || r.status === "closed").sort((x, y) => String(y.done_on).localeCompare(String(x.done_on))).slice(0, 6).map((r) => ({ id: r.id, no: r.no, title: r.title, type: r.type, score: r.score, grade: r.grade, done_on: r.done_on })) };
    }
  });

  /* ---------- findings, special points, programme, dashboard of findings (same rules as migration 0085) ---------- */
  const EN = () => window.AudEngine, addD = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }, diff = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 864e5);
  const ncNo = (kind) => { const pre = (T(S.settings.prefix).toUpperCase().replace(/[^A-Z0-9-]/g, "") || "AUD"), d = new Date(), y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(), fy = String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"), k = kind + fy; S.n[k] = (S.n[k] || 0) + 1; return pre + "-" + kind + "/" + fy + "/" + String(S.n[k]).padStart(4, "0"); };
  const nstage = (n) => (["closed", "cancelled"].includes(n.status) ? n.status : !n.contain_done_on ? "contain" : EN().checkWhys(n).length ? "rca" : !n.perm_done_on ? "action" : "monitor");
  const nextDue = (n) => ({ contain: n.contain_due, rca: n.resp_due, action: n.perm_due || n.resp_due, monitor: n.mon_due }[n.status] || null);
  const ncOut = (n) => { const a = au(n.audit_id), nd = nextDue(n), t = td(); return Object.assign(J(n), { audit_no: a.no, audit_title: a.title, audit_type: a.type, audit_done_on: a.done_on, audit_auditor: a.auditor, next_due: nd, overdue: ["contain", "rca", "action", "monitor"].includes(n.status) && !!nd && nd < t, age: diff(n.closed_on || t, n.created_at) }); };
  const nget = (i) => S.ncs.find((x) => x.id === i) || err("Finding not found.");
  const ptOut = (x) => Object.assign(J(x), { overdue: x.status === "open" && !!x.due_on && x.due_on < td() });
  const pget = (i) => S.pts.find((x) => x.id === i) || err("Point not found.");
  const mkNc = (a, o) => { const n = Object.assign({ id: id(), audit_id: a.id, no: ncNo("NC"), status: "contain", loops: 0, whys: [], atype: [], created_at: day(-10), sample: false, mon_result: null }, o); n.status = nstage(n); S.ncs.push(n); return n; };
  const DATES = ["resp_due", "contain_due", "contain_done_on", "perm_due", "perm_done_on"], TXT = ["clause", "standard", "requirement", "cat", "problem", "evidence", "area", "owner", "contain_action", "contain_owner", "contain_qty", "root_cause", "escape_cause", "systemic", "perm_action", "perm_owner", "perm_evidence", "horizontal", "mon_method", "mon_criteria"];
  Object.assign(window.QP_DEMO, {
    kmr_aud_nc_save(a) {
      const p = a.p || {}, isNew = !p.id; let n, o, au_;
      if (isNew) {
        au_ = au(p.audit_id); if (!["planned", "reported"].includes(au_.status)) err("This audit is " + au_.status + ". An administrator can reopen it.");
        if (!["Major", "Minor"].includes(p.severity)) err("The finding must be Major or Minor.");
        if (p.q_id && S.ncs.some((c) => c.audit_id === au_.id && c.q_id === p.q_id && c.status !== "cancelled")) err("This question already has a finding.");
        n = { id: id(), audit_id: au_.id, q_id: orNull(p.q_id), no: ncNo("NC"), loops: 0, whys: [], atype: [], status: "contain", severity: p.severity, rule_text: orNull(p.rule_text), repeat_of: orNull(p.repeat_of), created_at: td(), sample: false, mon_result: null };
      } else {
        n = nget(p.id); o = Object.assign({}, n); if (["closed", "cancelled"].includes(n.status)) err("This finding is " + n.status + ". An administrator can reopen it."); au_ = au(n.audit_id); if (!["planned", "reported"].includes(au_.status)) err("This audit is " + au_.status + ". An administrator can reopen it.");
        if ("severity" in p && p.severity !== n.severity) { if (!["Major", "Minor"].includes(p.severity)) err("The finding must be Major or Minor."); if (!T(p.sev_reason)) err("Give the reason for changing the severity from " + n.severity + " to " + p.severity + "."); lg(au_, n.no + ": severity changed from " + n.severity + " to " + p.severity + ". Reason: " + T(p.sev_reason)); n.severity = p.severity; }
      }
      TXT.forEach((k) => { if (k in p) n[k] = orNull(p[k]); }); DATES.forEach((k) => { if (k in p) n[k] = orNull(p[k]); });
      if ("whys" in p) { if (!Array.isArray(p.whys) || p.whys.length > 7) err("Up to seven whys can be written."); n.whys = p.whys.map((x) => T(x).slice(0, 500)).filter(Boolean); }
      if ("atype" in p) { if (!Array.isArray(p.atype) || p.atype.some((t) => !["remove", "proof", "standard", "detect", "train", "remind", "warn"].includes(t))) err("The kind of action is not valid."); n.atype = p.atype.slice(); }
      if ("mon_days" in p) { n.mon_days = T(p.mon_days) === "" ? null : Number(p.mon_days); if (n.mon_days != null && (n.mon_days < 1 || n.mon_days > 365)) err("The monitoring period must be between 1 and 365 days."); }
      const t = td();
      if (!T(n.problem)) err("Describe the problem: what was found, where and when."); if (!T(n.owner)) err("Name the person who owns the response to this finding."); if (!n.resp_due) err("Set the date by which the root cause and the permanent action are due."); if (!n.contain_due) err("Set the date by which the containment must be done.");
      if (n.contain_done_on) { if (n.contain_done_on > t) err("The containment date is in the future."); if (!T(n.contain_action) || !T(n.contain_owner)) err("Describe the containment and name who did it before marking it done."); }
      if (n.perm_done_on) {
        if (!n.contain_done_on) err("Finish the containment first."); if (n.perm_done_on > t) err("The date the permanent action was done is in the future.");
        let m = EN().checkWhys(n); if (m.length) err("The root cause is not complete. " + m[0]); m = EN().checkPermanent(n); if (m.length) err(m[0]);
        if (!T(n.perm_evidence)) err("Add the evidence that the permanent action was done (record, photo, revised document number)."); if (!T(n.mon_method) || !T(n.mon_criteria)) err("Say how the effect will be checked and what result shows that it worked.");
        if (n.mon_days == null) n.mon_days = n.severity === "Major" ? 60 : 90; n.mon_due = addD(n.perm_done_on, n.mon_days);
      } else n.mon_due = null;
      n.status = nstage(n); if (isNew) { S.ncs.push(n); lg(au_, n.no + " raised: " + n.severity + (n.clause ? ", clause " + n.clause : "") + "."); } else if (o.status !== n.status) lg(au_, n.no + ": now at step " + n.status + ".");
      return ncOut(n);
    },
    kmr_aud_nc_get(a) { const n = nget(a.p_id), au_ = au(n.audit_id); return Object.assign(ncOut(n), { can_edit: !["closed", "cancelled"].includes(n.status) && ["planned", "reported"].includes(au_.status), is_admin: true, log: J(S.log.filter((l) => l.audit_id === au_.id && String(l.text).startsWith(n.no)).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 60)) }); },
    kmr_aud_nc_list(a) {
      const p = a.p || {}, st = T(p.status) || "open", q = T(p.q).toLowerCase(), t = td(), h = (v) => String(v || "").toLowerCase().includes(q), live = ["contain", "rca", "action", "monitor"];
      return S.ncs.filter((c) => { const x = au(c.audit_id); return x.status !== "cancelled" && c.status !== "cancelled" && (!p.audit_id || c.audit_id === p.audit_id) && (st === "all" || c.status === st || (st === "open" && live.includes(c.status))) && (!p.severity || c.severity === p.severity) && (!p.owner || [c.owner, c.perm_owner, c.contain_owner].some((o) => T(o).toLowerCase() === T(p.owner).toLowerCase())) && (!p.clause || c.clause === p.clause) && (p.overdue !== "true" || (live.includes(c.status) && nextDue(c) < t)) && (!q || h(c.no) || h(c.problem) || h(c.clause) || h(c.area)); })
        .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).map(ncOut);
    },
    kmr_aud_nc_history() { return S.ncs.filter((c) => c.status !== "cancelled" && diff(td(), c.created_at) <= 365).map((c) => ({ no: c.no, audit_id: c.audit_id, clause: c.clause, area: c.area, severity: c.severity, status: c.status, raised_on: c.created_at })); },
    kmr_aud_nc_close(a) {
      const n = nget(a.p_id), au_ = au(n.audit_id), t = td(); if (n.status !== "monitor") err("The effect can be checked only after the permanent action is done and recorded."); if (!["effective", "not_effective"].includes(a.p_result)) err("Choose effective or not effective.");
      if (!T(a.p_note)) err("Write what was checked and what was found (records, re-audit result, data)."); if (n.mon_due > t && !a.p_early) err("The effect can be checked on or after " + n.mon_due + ". The monitoring period is not over yet.");
      if (a.p_result === "effective") { Object.assign(n, { status: "closed", mon_result: "effective", mon_note: T(a.p_note), mon_on: t, closed_on: t, closed_by: ME }); lg(au_, n.no + ": closed. The action was effective. " + T(a.p_note)); }
      else { n.rule_text = (n.rule_text ? n.rule_text + "\n" : "") + "Raised to Major on " + t + ": the permanent action was not effective. Earlier root cause: " + (n.root_cause || "-") + ". Earlier action: " + (n.perm_action || "-") + ". Result of the check: " + T(a.p_note); Object.assign(n, { status: "rca", severity: "Major", loops: n.loops + 1, mon_result: null, mon_note: null, mon_on: null, mon_due: null, perm_done_on: null, perm_evidence: null, perm_action: null, perm_due: null, atype: [], whys: [], root_cause: null, escape_cause: null, systemic: null }); lg(au_, n.no + ": the action was NOT effective, so the finding is Major again and goes back to root cause. " + T(a.p_note)); }
      return ncOut(n);
    },
    kmr_aud_nc_reopen(a) { const n = nget(a.p_id), au_ = au(n.audit_id); if (!["closed", "cancelled"].includes(n.status)) err("This finding is still open."); if (!T(a.p_reason)) err("Give the reason for reopening."); Object.assign(n, { status: "monitor", mon_result: null, mon_on: null, closed_on: null, closed_by: null }); n.status = nstage(n); if (au_.status === "closed") { au_.status = "reported"; au_.closed_on = null; } lg(au_, n.no + ": reopened by administrator. " + T(a.p_reason)); return ncOut(n); },
    kmr_aud_nc_cancel(a) { const n = nget(a.p_id), au_ = au(n.audit_id); if (["closed", "cancelled"].includes(n.status)) err("This finding is already " + n.status + "."); if (!T(a.p_reason)) err("Give the reason: for example the finding was raised by mistake or the auditee showed the requirement is met."); n.status = "cancelled"; n.cancel_reason = T(a.p_reason); lg(au_, n.no + ": cancelled by administrator. " + T(a.p_reason)); return ncOut(n); },
    kmr_aud_point_list(a) { const p = a.p || {}, st = T(p.status) || "open", q = T(p.q).toLowerCase(), h = (v) => String(v || "").toLowerCase().includes(q); return S.pts.filter((x) => (st === "all" || x.status === st) && (!q || h(x.no) || h(x.title) || h(x.clause) || h(x.standard))).sort((x, y) => (x.status > y.status) - (x.status < y.status) || String(x.due_on || "9").localeCompare(String(y.due_on || "9"))).map(ptOut); },
    kmr_aud_point_save(a) {
      const p = a.p || {}, fq = orNull(p.frequency) || "Every audit"; if (!orNull(p.title)) err("Write the point to be checked."); if (!orNull(p.standard)) err("Name the standard or requirement this point comes from (for example IATF 16949 or the customer's name)."); if (!orNull(p.clause)) err("Give the clause or requirement number of the point.");
      if (!["Every audit", "Monthly", "Quarterly", "Half-yearly", "Yearly", "One time"].includes(fq)) err("Choose how often the point is checked.");
      let x = p.id ? pget(p.id) : null; if (x && x.status === "closed") err("This point is closed. An administrator can reopen it.");
      const f = { title: T(p.title), source: orNull(p.source), standard: T(p.standard), clause: T(p.clause), description: orNull(p.description), check_how: orNull(p.check_how), frequency: fq, applies: orNull(p.applies), owner: orNull(p.owner), due_on: orNull(p.due_on) };
      if (!x) { x = Object.assign({ id: id(), no: ncNo("SP"), status: "open", checks: [], last_checked: null, last_result: null, closed_on: null, closure_note: null, evidence: null }, f); S.pts.push(x); } else Object.assign(x, f); return ptOut(x);
    },
    kmr_aud_point_check(a) { const x = pget(a.p_id), p = a.p || {}; if (x.status === "closed") err("This point is closed."); if (!["ok", "not_ok"].includes(p.result)) err("Choose OK or not OK."); if (p.result === "not_ok" && !T(p.note)) err("Write what was found when the point is not OK."); x.checks.unshift({ on: td(), by: ME, result: p.result, note: orNull(p.note), audit: orNull(p.audit) }); x.last_checked = td(); x.last_result = p.result; return ptOut(x); },
    kmr_aud_point_close(a) { const x = pget(a.p_id), p = a.p || {}; if (x.status === "closed") err("This point is already closed."); if (x.last_result !== "ok") err("Check the point and record the result OK before closing it."); if (!T(p.closure_note)) err("Write why the point can be closed (what was done and what was seen)."); if (!T(p.evidence)) err("Add the evidence for closure: record number, document, photo or customer confirmation."); Object.assign(x, { status: "closed", closed_on: td(), closure_note: T(p.closure_note), evidence: T(p.evidence) }); return ptOut(x); },
    kmr_aud_point_reopen(a) { const x = pget(a.p_id); x.status = "open"; x.closed_on = null; return ptOut(x); },
    kmr_aud_point_delete(a) { S.pts = S.pts.filter((x) => x.id !== a.p_id); return null; },
    kmr_aud_programme_make(a) { const it = (a.p || {}).items; if (!Array.isArray(it)) err("The programme is not valid."); if (it.length > 400) err("At most 400 audits can be made at once."); it.forEach((x) => window.QP_DEMO.kmr_aud_audit_save({ p: { title: x.title, type: x.type, area: x.area, scope: x.scope, planned_on: x.planned_on, auditor: x.auditor, auditee: x.auditee, shifts: x.shifts || [], checklist: x.checklist || [], meta: x.meta || {} } })); return { made: it.length }; },
    kmr_aud_dash2() {
      const t = td(), c = S.ncs.filter((n) => n.status !== "cancelled" && au(n.audit_id).status !== "cancelled"), op = c.filter((n) => n.status !== "closed"), nd = (n) => nextDue(n), cnt = (l, f) => { const m = {}; l.forEach((n) => { const k = f(n); m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map((k) => ({ k, n: m[k] })).sort((x, y) => y.n - x.n).slice(0, 8); };
      const yr = c.filter((n) => diff(t, n.created_at) <= 365), done = c.filter((n) => n.perm_done_on), chk = c.filter((n) => n.mon_result), cl = c.filter((n) => n.status === "closed" && n.closed_on), pt = S.pts.filter((x) => x.status === "open"), months = [];
      for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
      const au12 = S.aud.filter((r) => ["reported", "closed"].includes(r.status) && r.done_on && diff(t, r.done_on) <= 365);
      return { raised: c.length, open: op.length, closed: c.length - op.length, major_open: op.filter((n) => n.severity === "Major").length, minor_open: op.filter((n) => n.severity === "Minor").length, overdue: op.filter((n) => nd(n) < t).length, repeat: c.filter((n) => n.repeat_of || n.loops > 0).length,
        by_stage: op.reduce((m, n) => ((m[n.status] = (m[n.status] || 0) + 1), m), {}), avg_days_to_close: cl.length ? Math.round(cl.reduce((s, n) => s + diff(n.closed_on, n.created_at), 0) / cl.length) : null,
        on_time_pct: done.length ? Math.round((100 * done.filter((n) => n.perm_done_on <= (n.perm_due || n.resp_due)).length) / done.length) : null, effective_pct: chk.length ? Math.round((100 * chk.filter((n) => n.mon_result === "effective").length) / chk.length) : null, effectiveness_checks: chk.length,
        ageing: { d30: op.filter((n) => diff(t, n.created_at) <= 30).length, d60: op.filter((n) => { const d = diff(t, n.created_at); return d > 30 && d <= 60; }).length, d90: op.filter((n) => { const d = diff(t, n.created_at); return d > 60 && d <= 90; }).length, over90: op.filter((n) => diff(t, n.created_at) > 90).length },
        by_standard: cnt(yr, (n) => n.standard || "Other"), top_clauses: cnt(yr, (n) => (n.standard && n.clause ? n.standard + " " + n.clause : "Other")), by_area: cnt(yr, (n) => n.area || "Not stated"), by_type: cnt(yr, (n) => au(n.audit_id).type),
        trend: months.map((m) => ({ m, raised: c.filter((n) => String(n.created_at).slice(0, 7) === m).length, closed: c.filter((n) => String(n.closed_on || "").slice(0, 7) === m).length })),
        oldest: op.slice().sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))).slice(0, 8).map((n) => ({ id: n.id, no: n.no, severity: n.severity, status: n.status, clause: n.clause, standard: n.standard, problem: n.problem, owner: n.owner, raised_on: n.created_at, next_due: nd(n) })),
        late: op.filter((n) => nd(n) < t).sort((x, y) => nd(x).localeCompare(nd(y))).slice(0, 8).map((n) => ({ id: n.id, no: n.no, severity: n.severity, status: n.status, clause: n.clause, problem: n.problem, owner: n.owner, next_due: nd(n) })),
        points_open: pt.length, points_overdue: pt.filter((x) => x.due_on && x.due_on < t).length, points_notok: pt.filter((x) => x.last_result === "not_ok").length, audited_areas: new Set(au12.map((r) => String(r.area || "").toLowerCase()).filter(Boolean)).size, audited_types: [...new Set(au12.map((r) => r.type))] };
    }
  });
  (function seedNc() {
    const b = S.aud.find((r) => r.type === "Process" && r.status === "reported"); if (!b) return;
    mkNc(b, { q_id: "p4", severity: "Major", clause: "P6.5", standard: "VDA 6.3", requirement: "Nonconforming product is identified, segregated and handled so it cannot be used.", cat: "nc", problem: "Red bin not emptied; two rejects mixed with good parts at Machining T04.", area: "Machining T04", owner: "K. Arun", created_at: day(-20), resp_due: day(-6), contain_due: day(-19), contain_action: "Sorted the full lot 100%, removed 2 rejects, emptied and locked the red bin.", contain_owner: "K. Arun", contain_qty: "480 checked, 2 scrapped", contain_done_on: day(-19), rule_text: "Answer 'Does not meet' on a critical question: Major." });
    mkNc(b, { q_id: "p2", severity: "Minor", clause: "P6.2", standard: "VDA 6.3", requirement: "First-piece approval is recorded for every setup.", cat: "rec", problem: "First-piece record missing on 2 of 10 setups checked.", area: "Machining T04", owner: "K. Arun", created_at: day(-20), resp_due: day(10), contain_due: day(-17), rule_text: "Answer 'Partly' on an important question, first time: Minor." });
    S.pts.push({ id: id(), no: ncNo("SP"), title: "Confirm the bore-diameter mistake-proofing is tested at every shift start", source: "Customer", standard: "Customer CSR", clause: "CSR 4.2", frequency: "Every audit", applies: "Machining T04", owner: "R. Venkatesh", due_on: day(30), status: "open", check_how: "Test record and master piece at the machine", description: "Raised in the customer audit.", checks: [], last_checked: null, last_result: null, closed_on: null, closure_note: null, evidence: null });
  })();
})();
