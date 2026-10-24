/* Internal Audit - rules engine. Plain, fixed rules so that two auditors reach the same result for the same facts.
   1. classify(): Major / Minor / Observation from what the auditor saw, not from the auditor's mood.
   2. checkWhys(), checkPermanent(): the root-cause and action rules, so an analysis that stops at "operator mistake" is not accepted.
   3. dueFor(): response dates by severity.   4. programme(): the year's audits, built from risk, with every shift rotated and auditors who are qualified and independent. */
(function () {
  "use strict";
  const L = () => window.AudLib;
  const T = (v) => String(v == null ? "" : v).trim();
  const day = (d, n) => { const x = new Date(String(d).slice(0, 10) + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  /* ---------------- 1. classification ----------------
     Input: item { w: 0|1|2, cl, ref }, a: { ans: 'ok'|'part'|'no'|'obs'|'na' or VDA rating '10'..'0', n, f, imp: 'none'|'internal'|'customer'|'safety', absent, repeat: {no} }
     Rules (shown to the user in words):
       Major when the requirement is not met and any of these is true:
         - nothing exists at all (no procedure, no process, no record system)           - the failure reached, or could reach, the customer
         - a safety, legal or special-characteristic requirement is involved             - more than a third of the samples checked failed (systematic)
         - the same clause in the same area had a finding in the last 12 months (repeat)
       Minor when the requirement is partly met, or not met in a single isolated case with no customer or safety effect.
       Observation: requirement met but a risk or a chance to improve was seen.   OK: requirement met.                                                       */
  function classify(item, a) {
    a = a || {}; const w = Number(item && item.w) || 0, why = [], ans = String(a.ans || ""), vda = ["10", "8", "6", "4", "0"].includes(ans);
    if (!ans) return { sev: "", rating: "", why: [] };
    if (ans === "na") return { sev: "NA", rating: "NA", why: [] };
    if (ans === "ok" || ans === "10") return { sev: "OK", rating: vda ? "10" : "OK", why: ["The requirement is met."] };
    if (ans === "obs") return { sev: "Observation", rating: "Observation", why: ["The requirement is met but a risk or a chance to improve was seen. No corrective action is needed; follow it as an improvement."] };
    let lvl = 0; /* 0 observation-level, 1 minor, 2 major */
    if (vda) {
      if (ans === "8") { lvl = 1; why.push("Rated 8: the requirement is largely met with a small gap."); }
      else if (ans === "6") { lvl = 1; why.push("Rated 6: the requirement is only partly met."); }
      else if (ans === "4") { lvl = w >= 1 ? 2 : 1; why.push("Rated 4: the requirement is inadequately met" + (w >= 1 ? ", on a question that matters for the product." : ".")); }
      else if (ans === "0") { lvl = 2; why.push("Rated 0: the requirement is not met at all."); }
    } else if (ans === "part") { lvl = 1; why.push("The requirement is partly met."); }
    else { lvl = 1; why.push("The requirement is not met."); }
    const notMet = ans === "no" || ans === "0" || ans === "4";
    const n = Number(a.n) || 0, f = Number(a.f) || 0;
    if (a.absent) { lvl = 2; why.push("Nothing is in place: no procedure, process or system exists for this requirement."); }
    if (n > 0 && f > 0 && f / n > 1 / 3) { lvl = 2; why.push(f + " of " + n + " samples failed (more than one third): the failure is systematic, not a single case."); }
    else if (n > 0 && f > 0) why.push(f + " of " + n + " samples failed: looks isolated.");
    if (a.imp === "customer") { lvl = Math.max(lvl, notMet || a.absent ? 2 : lvl); if (notMet) why.push("The failure reached, or could reach, the customer."); else why.push("Customer is exposed, so check the containment."); }
    if (a.imp === "safety") { lvl = 2; why.push("Safety, legal or regulatory requirement involved."); }
    if (w === 2 && (notMet || a.absent)) { if (lvl < 2) why.push("This is a critical requirement (safety, legal, special characteristic or shipment risk), so a clear failure is Major."); lvl = 2; }
    if (a.repeat && a.repeat.no) { lvl = 2; why.push("Repeat: the same clause in the same area already had a finding (" + a.repeat.no + ") in the last 12 months. A repeat is Major because the earlier action did not stop it."); }
    if (lvl === 0) lvl = 1;
    const sev = lvl === 2 ? "Major" : "Minor";
    if (sev === "Minor") why.push("Classified Minor: no systematic failure, no customer or safety effect and no repeat was recorded.");
    return { sev, rating: vda ? ans : sev, why };
  }
  /* what the auditor chooses, per scale */
  function answers(type) {
    const sc = L().scaleOf(type);
    if (sc === "vda") return [["10", "10", "Fully met"], ["8", "8", "Largely met, small gap"], ["6", "6", "Partly met"], ["4", "4", "Inadequately met"], ["0", "0", "Not met"], ["na", "NA", "Not applicable"]];
    if (sc === "yn") return [["ok", "OK", "Meets the requirement"], ["no", "Not OK", "Does not meet the requirement"], ["na", "NA", "Not applicable"]];
    return [["ok", "Meets", "Meets the requirement"], ["part", "Partly", "Partly meets the requirement"], ["no", "Does not meet", "Does not meet the requirement"], ["obs", "Observation", "Meets, but a risk or improvement was seen"], ["na", "NA", "Not applicable"]];
  }
  /* answer of an older audit (rating only) */
  function ansOf(x) { if (x.ans) return x.ans; const r = String(x.rating || ""); if (["10", "8", "6", "4", "0"].includes(r)) return r; return { OK: "ok", Minor: "part", Major: "no", Observation: "obs", NA: "na" }[r] || ""; }

  /* ---------------- 2. root cause and action rules ---------------- */
  const BLAME = /\b(careless|careless?ness|negligen\w*|forgot|forget\w*|mistake|lazy|laz[ie]ness|not serious|human error|operator error|did not follow|didn'?t follow|not aware|lack of attention|inattent\w*|carelessly|operator\s+(?:was|is)\s+not|by mistake|not careful|ignored)\b/i;
  const norm = (s) => T(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ");
  function checkWhys(nc) {
    const out = [], w = (nc.whys || []).map(T).filter(Boolean);
    if (w.length < 3) out.push("Ask why at least three times. Now there " + (w.length === 1 ? "is 1 answer" : "are " + w.length + " answers") + ".");
    for (let i = 1; i < w.length; i++) if (norm(w[i]) === norm(w[i - 1])) { out.push("Why " + (i + 1) + " repeats Why " + i + ". Each answer must go one level deeper."); break; }
    const rc = T(nc.root_cause), last = w[w.length - 1] || "";
    if (!rc) out.push("Write the root cause in one sentence: the system gap that allowed the problem.");
    if (BLAME.test(rc) || BLAME.test(last)) out.push("The cause points to a person (\"" + (BLAME.exec(rc + " " + last) || [""])[0] + "\"). A person is not a root cause. Ask one more why: why did the system allow it?");
    if (!T(nc.escape_cause)) out.push("Say why it was not detected earlier: which check should have caught it and why it did not.");
    if (!T(nc.systemic)) out.push("Say which system, document or process must change so it cannot happen again (for example the control plan, FMEA, work instruction or training system).");
    return out;
  }
  const WEAK = ["train", "remind", "warn"];
  function checkPermanent(nc) {
    const out = [], ty = nc.atype || [];
    if (!T(nc.perm_action)) out.push("Describe the permanent action.");
    if (T(nc.perm_action) && T(nc.contain_action) && norm(nc.perm_action) === norm(nc.contain_action)) out.push("The permanent action is the same as the containment. Containment stops today's problem; the permanent action must change the system.");
    if (!T(nc.perm_owner)) out.push("Name the owner of the action.");
    if (!nc.perm_due) out.push("Set the target date.");
    if (!ty.length) out.push("Choose what kind of action it is (remove the cause, mistake-proof, standardise, detect, train).");
    else if (nc.severity === "Major" && ty.every((t) => WEAK.includes(t))) out.push("For a Major finding, training or reminders alone are not accepted. Add a change of the system: remove the cause, mistake-proof, or standardise in the control plan or work instruction.");
    return out;
  }
  const ACT_TYPES = [["remove", "Remove the cause", "Strongest: the problem can no longer happen."], ["proof", "Mistake-proof", "A device or a check stops the wrong condition."], ["standard", "Standardise", "Control plan, FMEA, instruction or procedure changed."], ["detect", "Better detection", "A check that finds the problem earlier."], ["train", "Training or reminder", "Weakest: people can forget. Use with another type."]];
  const MON = [["reaudit", "Re-audit the same requirement"], ["records", "Review records for the period"], ["spc", "Process data or capability"], ["customer", "Customer feedback or complaints"], ["lpa", "Layered process audits"]];

  /* ---------------- 3. dates by severity (a company can change these in Setup) ---------------- */
  function dueFor(sev, from, s) {
    s = s || {}; const major = sev === "Major", num = (k, d) => (isNaN(Number(s[k])) || s[k] === "" || s[k] == null ? d : Number(s[k]));
    return { contain: day(from, major ? num("d_contain_major", 1) : num("d_contain_minor", 3)), response: day(from, major ? num("d_response_major", 14) : num("d_response_minor", 30)), monitorDays: major ? num("d_monitor_major", 60) : num("d_monitor_minor", 90) };
  }
  /* the stage a finding is at, from what has been filled in (the database uses the same rule) */
  function stageOf(nc) {
    if (nc.status === "closed" || nc.status === "cancelled") return nc.status;
    if (!(nc.contain_done_on)) return "contain";
    if (checkWhys(nc).length) return "rca";
    if (!nc.perm_done_on) return "action";
    return "monitor";
  }
  const STAGES = [["contain", "1 Contain", "Stop it reaching the customer"], ["rca", "2 Root cause", "Why-why, down to the system"], ["action", "3 Permanent action", "Change the system"], ["monitor", "4 Check effect", "Did it work?"], ["closed", "5 Closed", "Verified"]];

  /* ---------------- 4. recommended text for a finding ---------------- */
  function recommend(cat, sev) { const r = L().recFor(cat); return Object.assign({}, r, { sev }); }

  /* ---------------- 5. the year's programme ---------------- */
  /* items: [{ type, area, auditee, risk: 'H'|'M'|'L', last: 'YYYY-MM-DD', shifts: true }]; pool: auditors { name, types: [], status } */
  const PER = { System: { H: 2, M: 1, L: 1 / 3 }, Process: { H: 2, M: 1, L: 1 / 3 }, Product: { H: 12, M: 4, L: 2 }, LPA: { H: 52, M: 26, L: 12 }, Document: { H: 2, M: 1, L: 1 }, Supplier: { H: 1, M: 1 / 2, L: 1 / 3 }, Special: { H: 1, M: 1, L: 1 }, EHS: { H: 1, M: 1, L: 1 }, Lab: { H: 1, M: 1, L: 1 } };
  const pickAuditor = (pool, type, auditee, load) => {
    const ok = (pool || []).filter((p) => T(p.name) && p.status !== "trainee" && (!(p.types || []).length || p.types.includes(type)) && norm(p.name) !== norm(auditee));
    if (!ok.length) return "";
    ok.sort((x, y) => (load[x.name] || 0) - (load[y.name] || 0)); load[ok[0].name] = (load[ok[0].name] || 0) + 1; return ok[0].name;
  };
  function programme(year, items, pool, today) {
    const out = [], load = {}, lib = L(), SH = ["A", "B", "C"];
    let seq = 0;
    items.forEach((it) => {
      const r = (PER[it.type] || PER.System)[it.risk] || 1, start = new Date(year + "-04-01T00:00:00"), from = Math.max(+start, +new Date(String(today) + "T00:00:00")), end = +new Date((year + 1) + "-03-31T00:00:00");
      let n = Math.floor(r); if (r < 1) { const gap = Math.round(1 / r) * 365, lastMs = it.last ? +new Date(it.last + "T00:00:00") : 0; n = !lastMs || (end - lastMs) / 864e5 >= gap - 30 ? 1 : 0; } if (n < 1) return;
      const span = end - from; if (span <= 0) return;
      for (let i = 0; i < n; i++) {
        let d = new Date(from + (span * (i + 0.5)) / n); if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        const iso = d.toISOString().slice(0, 10), t = (lib.TYPES[it.type] || {}).name || it.type, sh = it.shifts === false || !["Process", "LPA", "Product"].includes(it.type) ? [] : [SH[(seq + i) % 3]];
        const au = pickAuditor(pool, it.type, it.auditee, load);
        out.push({ title: t + (it.area ? ", " + it.area : "") + (n > 1 ? " (" + (i + 1) + "/" + n + ")" : ""), type: it.type, area: it.area || "", auditee: it.auditee || "", auditor: au, planned_on: iso, shifts: sh, scope: (it.scope || (lib.TYPES[it.type] || {}).std || ""), risk: it.risk });
      }
      seq++;
    });
    return out.sort((a, b) => a.planned_on.localeCompare(b.planned_on));
  }
  /* coverage: which processes and shifts a set of audits touches (shown on the dashboard) */
  const SEVS = ["Major", "Minor"];
  window.AudEngine = { classify, answers, ansOf, checkWhys, checkPermanent, dueFor, stageOf, STAGES, ACT_TYPES, MON, recommend, programme, pickAuditor, BLAME, SEVS, day, norm };
})();
