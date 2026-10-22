/* Internal Audit - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_aud_*, migration 0082). Nothing here is real data. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim(), J = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));
  let uid = 0; const id = () => "a" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const td = () => day(0), ME = "you@demo.example", orNull = (v) => (T(v) === "" ? null : T(v));
  const S = { settings: { prefix: "AUD", fy_numbering: true, due_days: 30 }, aud: [], acts: [], log: [], n: {} };
  function number() {
    const s = S.settings, pre = (T(s.prefix).toUpperCase().replace(/[^A-Z0-9-]/g, "") || "AUD"), d = new Date(), y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
    if (s.fy_numbering !== false) { const fy = String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"); S.n[fy] = (S.n[fy] || 0) + 1; return pre + "/" + fy + "/" + String(S.n[fy]).padStart(4, "0"); }
    S.n.x = (S.n.x || 0) + 1; return pre + "-" + String(S.n.x).padStart(4, "0");
  }
  const lg = (r, text, at) => S.log.push({ audit_id: r.id, at: at || new Date().toISOString(), by: ME, text });
  const au = (i) => S.aud.find((r) => r.id === i) || err("Audit not found.");
  const ratingsOf = (t) => (t === "Process" ? ["10", "8", "4", "0", "NA"] : ["OK", "Minor", "Major", "Observation", "NA"]);
  const isF = (r) => ["Minor", "Major", "8", "4", "0"].includes(String(r));
  function score(cl) { const r = cl.filter((x) => ["10", "8", "4", "0"].includes(String(x.rating))); if (!r.length) return [null, null]; const sc = Math.round((r.reduce((s, x) => s + Number(x.rating), 0) * 1000) / (10 * r.length)) / 10; let g = sc >= 90 ? "A" : sc >= 80 ? "B" : "C"; if (g === "A" && r.some((x) => String(x.rating) === "0")) g = "B"; return [sc, g]; }
  const mk = (o) => { const r = Object.assign({ id: id(), no: number(), status: "planned", area: null, scope: null, planned_on: null, done_on: null, auditor: null, auditee: null, shifts: [], checklist: [], summary: null, score: null, grade: null, reported_on: null, closed_on: null }, o); S.aud.push(r); lg(r, "Audit planned."); return r; };
  const mkAct = (r, q, text, owner, dueOn, status, evidence, ver) => { const a = { id: id(), audit_id: r.id, q_id: q, text, owner, due_on: dueOn, status: status || "open", done_on: status === "done" ? day(-3) : null, evidence: evidence || null, verified: !!ver, verified_on: ver ? day(-1) : null, created_at: Date.now() + uid }; S.acts.push(a); return a; };
  const actOut = (a) => { const o = J(a); delete o.created_at; return o; };
  const rowOut = (r) => {
    const t = td(), as = S.acts.filter((a) => a.audit_id === r.id);
    return { id: r.id, no: r.no, title: r.title, type: r.type, status: r.status, area: r.area, scope: r.scope, planned_on: r.planned_on, done_on: r.done_on, auditor: r.auditor, auditee: r.auditee, shifts: J(r.shifts), summary: r.summary, score: r.score, grade: r.grade, reported_on: r.reported_on, closed_on: r.closed_on, sample: false, updated_at: null,
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
      if (!ttl) err("Give the audit a short title."); if (!["System", "Process", "Product", "Supplier"].includes(ty)) err("Choose the audit type: system, process, product or supplier.");
      if (!Array.isArray(sh) || sh.some((s) => !["A", "B", "C", "General"].includes(s))) err("Shift must be A, B, C or General.");
      let out = null; if (p.checklist != null) {
        if (!Array.isArray(p.checklist)) err("The checklist is not valid."); if (p.checklist.length > 200) err("A checklist can have up to 200 questions.");
        out = p.checklist.map((x, i) => { if (!x || !orNull(x.q)) err("Question " + (i + 1) + " is empty."); const rt = orNull(x.rating); if (rt && !ratingsOf(ty).includes(rt)) err("Question " + (i + 1) + ": the rating must be one of " + ratingsOf(ty).join(", ") + "."); return { id: orNull(x.id) || id(), q: T(x.q), ref: orNull(x.ref), rating: rt, note: orNull(x.note) }; });
      }
      const f = { title: ttl, type: ty, area: orNull(p.area), scope: orNull(p.scope), planned_on: orNull(p.planned_on), done_on: orNull(p.done_on), auditor: orNull(p.auditor), auditee: orNull(p.auditee), shifts: J(sh), summary: orNull(p.summary) };
      if (!p.id) { const r = mk(Object.assign(f, { checklist: out || [] })); return { id: r.id, no: r.no }; }
      const r = au(p.id); if (r.status !== "planned") err("This audit is " + r.status + " and can no longer be edited. An administrator can reopen it.");
      if (ty !== r.type && r.checklist.some((x) => T(x.rating))) err("The audit type cannot be changed after questions have been rated.");
      Object.assign(r, f); if (out) r.checklist = out; return { id: r.id, no: r.no };
    },
    kmr_aud_issue(a) {
      const r = au(a.p_id), t = td(); if (r.status !== "planned") err("This audit is already " + r.status + ".");
      if (!r.done_on) err("Enter the date the audit was done."); if (r.done_on > t) err("The audit date is in the future."); if (!T(r.auditor)) err("Name the auditor."); if (!T(r.auditee)) err("Name the person or area audited.");
      if (T(r.auditor).toLowerCase() === T(r.auditee).toLowerCase()) err("The auditor must not audit their own work. Choose another auditor."); if (!r.checklist.length) err("Add at least one question to the checklist.");
      const nr = r.checklist.filter((x) => !T(x.rating)).length; if (nr) err("Rate every question: " + nr + " are not rated yet.");
      const na = r.checklist.filter((x) => isF(x.rating) && !S.acts.some((y) => y.audit_id === r.id && y.q_id === x.id && T(y.owner) && y.due_on)).length; if (na) err(na + " finding(s) still need an action with an owner and a due date.");
      if (r.type === "Process" && has("aud.vda-6-3-scoring")) { const s = score(r.checklist); r.score = s[0]; r.grade = s[1]; }
      r.status = "reported"; r.reported_on = t; lg(r, "Audit report issued" + (r.grade ? ": score " + r.score + "%, grade " + r.grade : "") + "."); return rowOut(r);
    },
    kmr_aud_close(a) {
      const r = au(a.p_id); if (r.status !== "reported") err("Issue the report first."); const as = S.acts.filter((x) => x.audit_id === r.id);
      let n = as.filter((x) => x.status === "open").length; if (n) err(n + " action(s) are still open."); n = as.filter((x) => !x.verified).length; if (n) err(n + " action(s) are not yet checked for effectiveness.");
      r.status = "closed"; r.closed_on = td(); lg(r, "Audit closed: all findings fixed and checked."); return rowOut(r);
    },
    kmr_aud_reopen(a) {
      const r = au(a.p_id); if (r.status === "closed") { r.status = "reported"; r.closed_on = null; } else if (r.status === "reported" || r.status === "cancelled") { r.status = "planned"; r.reported_on = null; r.score = null; r.grade = null; } else err("This audit is not issued yet.");
      lg(r, "Audit reopened by administrator (now " + r.status + ")."); return rowOut(r);
    },
    kmr_aud_cancel(a) { const r = au(a.p_id); if (r.status !== "planned") err("Only a planned audit can be cancelled."); if (!T(a.p_reason)) err("Give the reason for cancelling the audit."); r.status = "cancelled"; lg(r, "Audit cancelled: " + T(a.p_reason)); return rowOut(r); },
    kmr_aud_audit_delete(a) { const r = au(a.p_id); S.aud = S.aud.filter((x) => x !== r); S.acts = S.acts.filter((x) => x.audit_id !== r.id); return null; },
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
})();
