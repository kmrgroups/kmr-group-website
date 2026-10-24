/* KMR Presentation - the KPIs of every app, taken live from that app's own records.
   KMRPA[key] = { name, code (licence code), std (standards key), controls(), load(call, values) -> {period, kpis, charts} }
   Targets are the defaults used for the tower lights (green = on target, amber = within tolerance, red = off target). */
(function () {
  "use strict";
  var KMRPA = (window.KMRPA = window.KMRPA || {});
  var today = function () { return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
  var N = function (v) { return v == null || v === "" || isNaN(+v) ? null : +v; };
  var pct = function (a, b) { return b ? a / b * 100 : null; };
  var ent = function (o) { return Object.keys(o || {}).map(function (k) { return [k, +o[k] || 0]; }).sort(function (a, b) { return b[1] - a[1]; }); };
  var barOf = function (title, o, name, kpi, limit) { var e = ent(o).slice(0, limit || 10); return { title: title, kind: "bar", kpi: kpi, labels: e.map(function (x) { return x[0]; }), series: [{ name: name, values: e.map(function (x) { return x[1]; }) }] }; };
  var std = function () { return [].slice.call(arguments).map(function (s) { var i = s.indexOf(" "); return [s.slice(0, i), s.slice(i + 1)]; }); };

  /* ---------- 8D ---------- */
  KMRPA.d8 = { name: "8D Problem Solving", code: "d8", std: "d8", load: async function (call) {
    var d = await call("kmr_d8_dashboard"), S = std;
    return { period: "Live position · " + today(), kpis: [
      { id: "open", name: "Open 8Ds", value: d.open, std: S("ISO 10.2.1", "IATF 10.2.3"), why: "8D reports not yet closed." },
      { id: "over", name: "8Ds past due date", value: d.overdue, target: 0, amber: 2, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.3", "ISO 9.1.2"), why: "Open 8Ds whose target date has passed." },
      { id: "crit", name: "Critical 8Ds open", value: d.critical_open, target: 0, amber: 1, dir: "low", std: S("IATF 10.2.3", "VDA P7"), why: "Open 8Ds with severity Critical." },
      { id: "cont", name: "No containment after 1 day", value: d.no_containment, target: 0, amber: 1, dir: "low", std: S("IATF 8.7.1", "IATF 10.2.3", "ISO 8.7"), why: "Open 8Ds older than a day with no D3 interim containment." },
      { id: "days", name: "Average days to close", value: N(d.avg_days_to_close), unit: "days", target: 30, tol: 20, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.3", "ISO 9.1.2"), why: "Average days from opening to closure of 8Ds closed in the last 6 months." },
      { id: "cl90", name: "Closed in 90 days", value: d.closed_90, std: S("ISO 10.2.2", "IATF 10.2.6"), why: "8Ds closed in the last 90 days." },
      { id: "aopen", name: "Open actions", value: d.actions_open, std: S("ISO 10.2.1", "IATF 10.2.3"), why: "Corrective and preventive actions still open on open 8Ds." },
      { id: "aover", name: "Overdue actions", value: d.actions_overdue, target: 0, amber: 3, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.3", "VDA P7.4"), why: "Open actions whose due date has passed." }],
      charts: [barOf("Where the open 8Ds are stuck", d.by_step, "Open 8Ds", "open"), barOf("Where problems come from (12 months)", d.by_source, "8Ds", "open"), barOf("Root-cause category (12 months)", d.by_cause, "8Ds", "open")] };
  } };

  /* ---------- CRM & RFQ ---------- */
  KMRPA.crm = { name: "CRM & RFQ", code: "crm", std: "crm", load: async function (call) {
    var d = await call("kmr_crm_dashboard"), S = std, st = d.by_stage || {}, stn = Object.keys(st);
    return { period: "Live position · " + today(), kpis: [
      { id: "leads", name: "Open leads", value: d.leads_open, std: S("ISO 8.2.1", "ISO 9.1.2"), why: "Leads not yet won or lost." },
      { id: "pipe", name: "Pipeline value", value: N(d.pipeline_value), unit: "₹", std: S("ISO 8.2.1", "ISO 9.1.2"), why: "Value of the open leads." },
      { id: "fo", name: "Follow-ups overdue", value: d.followups_overdue, target: 0, amber: 3, dir: "low", std: S("ISO 8.2.1", "ISO 8.2.2"), why: "Customer follow-ups past their date and not done." },
      { id: "rfq", name: "Open RFQs", value: d.rfq_open, std: S("ISO 8.2.2", "ISO 8.2.3", "IATF 8.2.3.1"), why: "Requests for quotation received, in costing, quoted or in negotiation." },
      { id: "rfqo", name: "RFQs past due date", value: d.rfq_overdue, target: 0, amber: 2, dir: "low", std: S("ISO 8.2.3", "IATF 8.2.3.1", "ISO 9.1.2"), why: "RFQs still to be quoted whose due date has passed." },
      { id: "qo", name: "Quotations out (value)", value: N(d.quotes_out_value), unit: "₹", std: S("ISO 8.2.3"), why: "Value of quotations sent and not yet decided." },
      { id: "win", name: "Win rate", value: N(d.win_rate), unit: "%", target: 30, tol: 25, dir: "high", std: S("ISO 9.1.2", "ISO 8.2.3"), why: "Won ÷ (won + lost) RFQs and leads." },
      { id: "won", name: "Orders won, last 90 days", value: N(d.won_value_90), unit: "₹", std: S("ISO 9.1.2"), why: "Value of accepted quotations in the last 90 days." }],
      charts: [{ title: "Pipeline by stage (₹)", kind: "bar", kpi: "pipe", labels: stn, series: [{ name: "Value", values: stn.map(function (k) { return N((st[k] || {}).value) || 0; }) }] },
        { title: "Leads by stage (count)", kind: "bar", kpi: "leads", labels: stn, series: [{ name: "Leads", values: stn.map(function (k) { return N((st[k] || {}).n) || 0; }) }] },
        barOf("Why RFQs were lost", d.lost_reasons, "RFQs", "win")] };
  } };

  /* ---------- MSA ---------- */
  KMRPA.msa = { name: "MSA Studies", code: "msa", std: "msa", load: async function (call) {
    var d = await call("kmr_msa_dashboard"), S = std, bd = d.by_decision || {}, ok = 0, bad = 0, cond = 0, tot = d.total || 0;
    Object.keys(bd).forEach(function (k) { if (/not calculated/i.test(k)) return; if (/^acceptable$/i.test(k)) ok += bd[k]; else if (/^conditional/i.test(k)) cond += bd[k]; else bad += bd[k]; });
    var done = ok + bad + cond;
    return { period: "Live position · " + today(), kpis: [
      { id: "tot", name: "Studies on record", value: tot, std: S("IATF 7.1.5.1.1", "ISO 7.1.5.1"), why: "All gauge R&R, attribute, bias, linearity and stability studies." },
      { id: "acc", name: "Measurement systems acceptable", value: done ? pct(ok, done) : null, unit: "%", target: 90, tol: 10, dir: "high", std: S("IATF 7.1.5.1.1", "ISO 7.1.5.1", "VDA P6"), why: "Acceptable studies ÷ studies with a decision (AIAG MSA 4th ed. criteria: GRR under 10% acceptable, 10-30% conditional, over 30% not acceptable)." },
      { id: "bad", name: "Studies not acceptable", value: bad, target: 0, amber: 2, dir: "low", std: S("IATF 7.1.5.1.1", "IATF 7.1.5.2"), why: "Studies whose decision is Not acceptable; the gauge or method needs action." },
      { id: "cond", name: "Studies conditionally acceptable", value: cond, target: 0, amber: 3, dir: "low", std: S("IATF 7.1.5.1.1"), why: "Studies acceptable only with the customer's approval or a change." },
      { id: "draft", name: "Studies not finished (draft)", value: d.draft, target: 0, amber: 3, dir: "low", std: S("ISO 7.5.3"), why: "Studies started but not calculated or closed." }],
      charts: [barOf("Studies by decision", bd, "Studies", "acc"), barOf("Studies by type", d.by_type, "Studies", "tot")] };
  } };

  /* ---------- SPC ---------- */
  KMRPA.spc = { name: "SPC Charts", code: "spc", std: "spc", load: async function (call) {
    var d = await call("kmr_spc_dashboard"), S = std;
    return { period: "Live position · " + today(), kpis: [
      { id: "act", name: "Active control charts", value: d.active, std: S("IATF 9.1.1.1", "IATF 9.1.1.2", "ISO 9.1.1"), why: "Control charts in use on the shop floor." },
      { id: "sig", name: "Charts with signals", value: d.signals, target: 0, amber: 2, dir: "low", std: S("IATF 9.1.1.3", "IATF 10.2.3", "ISO 8.5.1"), why: "Active charts with an out-of-control signal in the latest summary." },
      { id: "lcpk", name: "Charts with Cpk below 1.33", value: d.low_cpk, target: 0, amber: 2, dir: "low", std: S("IATF 9.1.1.2", "IATF 8.5.1.1", "ISO 9.1.3"), why: "Active charts whose process capability is under the usual 1.33 requirement." },
      { id: "cap", name: "Charts capable (Cpk 1.33 or more)", value: d.active ? pct(d.active - d.low_cpk, d.active) : null, unit: "%", target: 90, tol: 10, dir: "high", std: S("IATF 9.1.1.2", "ISO 9.1.3"), why: "Active charts that do not have a low Cpk." },
      { id: "chs", name: "Charts on record", value: d.charts, std: S("IATF 9.1.1.1"), why: "All charts, active or not." }],
      charts: [{ title: "Active charts: stable and capable or not", kind: "bar", kpi: "cap", labels: ["Active", "With signals", "Cpk < 1.33"], series: [{ name: "Charts", values: [d.active, d.signals, d.low_cpk] }] }] };
  } };

  /* ---------- ActionTrack ---------- */
  KMRPA.tsk = { name: "ActionTrack", code: "tsk", std: "tsk", load: async function (call) {
    var d = await call("kmr_tsk_dashboard", { p: { scope: "team" } }), S = std, open = (d.open || 0) + (d.progress || 0) + (d.blocked || 0), bp = d.by_priority || {};
    return { period: "Live position · " + today() + (d.team ? " · whole team" : " · my tasks"), kpis: [
      { id: "open", name: "Open tasks", value: open, std: S("ISO 6.2", "ISO 9.3.3", "IATF 10.2.3"), why: "Tasks not done: open, in progress or blocked." },
      { id: "over", name: "Overdue tasks", value: d.overdue, target: 0, amber: 3, dir: "low", std: S("ISO 9.3.3", "ISO 10.2", "IATF 9.3.1.1"), why: "Tasks past their due date." },
      { id: "overp", name: "Overdue % of open tasks", value: open ? pct(d.overdue, open) : null, unit: "%", target: 5, tol: 100, dir: "low", std: S("ISO 9.3.3", "ISO 10.2"), why: "Overdue tasks ÷ open tasks." },
      { id: "blk", name: "Blocked tasks", value: d.blocked, target: 0, amber: 2, dir: "low", std: S("ISO 6.2", "ISO 7.4"), why: "Tasks that cannot move without help." },
      { id: "nod", name: "Tasks without a due date", value: d.no_date, target: 0, amber: 3, dir: "low", std: S("ISO 6.2", "ISO 5.3"), why: "Open tasks with no target date." },
      { id: "dw", name: "Done in the last 7 days", value: d.done_week, std: S("ISO 9.3.3"), why: "Tasks completed in the last week." },
      { id: "comp", name: "Completion rate", value: d.total ? pct(d.done_total, d.total) : null, unit: "%", target: 80, tol: 15, dir: "high", std: S("ISO 9.3.3", "ISO 10.2"), why: "Done ÷ all tasks." }],
      charts: [{ title: "Tasks created and done (last 14 days)", kind: "line", kpi: "dw", labels: (d.trend || []).map(function (x) { return String(x.d).slice(5); }), series: [{ name: "Created", values: (d.trend || []).map(function (x) { return x.created; }) }, { name: "Done", values: (d.trend || []).map(function (x) { return x.done; }) }] },
        { title: "Open tasks by priority", kind: "bar", kpi: "open", labels: ["urgent", "high", "normal", "low"], series: [{ name: "Tasks", values: [bp.urgent, bp.high, bp.normal, bp.low] }] },
        { title: "Open and overdue by person", kind: "bar", kpi: "over", labels: (d.by_person || []).slice(0, 10).map(function (x) { return x.name; }), series: [{ name: "Open", values: (d.by_person || []).slice(0, 10).map(function (x) { return x.open; }) }, { name: "Overdue", values: (d.by_person || []).slice(0, 10).map(function (x) { return x.overdue; }) }] }] };
  } };

  /* ---------- Internal audit ---------- */
  KMRPA.aud = { name: "Internal Audit", code: "aud", std: "aud", controls: function () { var y = new Date().getFullYear(); return [{ id: "year", label: "Audit year", type: "select", value: y, options: [y - 2, y - 1, y, y + 1].map(function (v) { return [v, v]; }) }]; }, load: async function (call, v) {
    var yr = +v.year || new Date().getFullYear(), d = await call("kmr_aud_dashboard", { p_year: yr }), n = null, S = std;
    try { n = await call("kmr_aud_dash2", { p_year: yr }); } catch (e) { n = null; }
    var k = [
      { id: "comp", name: "Audit programme completion", value: N(d.completion), unit: "%", target: 100, tol: 10, dir: "high", std: S("ISO 9.2.1", "ISO 9.2.2", "IATF 9.2.2.4"), why: "Audits done (reported or closed) ÷ audits planned for the year." },
      { id: "late", name: "Audits past planned date", value: d.late_audits, target: 0, amber: 1, dir: "low", std: S("ISO 9.2.2", "IATF 9.2.2.4"), why: "Planned audits whose date has passed without being done." },
      { id: "score", name: "Average process audit score", value: N(d.avg_score), unit: "%", target: 85, tol: 12, dir: "high", std: S("VDA P1-P7 (6.3)", "IATF 9.2.2.3"), why: "Average VDA 6.3 score of the process audits of the last 12 months (A 90 or more, B 80-90)." },
      { id: "oa", name: "Open audit actions", value: d.open_actions, std: S("ISO 10.2.1", "IATF 10.2.3"), why: "Audit actions not yet done." },
      { id: "ova", name: "Overdue audit actions", value: d.overdue_actions, target: 0, amber: 3, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.3", "IATF 10.2.4"), why: "Open audit actions past their due date." },
      { id: "unv", name: "Actions done but not verified", value: d.unchecked, target: 0, amber: 3, dir: "low", std: S("ISO 10.2.1 (e)", "IATF 10.2.3"), why: "Completed actions waiting for the auditor to confirm effectiveness." }], ch = [];
    if (n) {
      k.push({ id: "nc", name: "Open nonconformities", value: n.open, std: S("ISO 10.2.1", "IATF 10.2.3"), why: "Audit findings still open." },
        { id: "maj", name: "Major nonconformities open", value: n.major_open, target: 0, amber: 1, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.3"), why: "Open findings graded Major." },
        { id: "ncod", name: "Nonconformities past due", value: n.overdue, target: 0, amber: 2, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.3"), why: "Open findings whose next step is overdue." },
        { id: "rep", name: "Repeat nonconformities", value: n.repeat, target: 0, amber: 1, dir: "low", std: S("ISO 10.2.1 (e)", "IATF 10.2.3"), why: "Findings that came back after closure." },
        { id: "dtc", name: "Average days to close a finding", value: N(n.avg_days_to_close), unit: "days", target: 60, tol: 25, dir: "low", std: S("ISO 10.2.1", "IATF 10.2.4"), why: "Average days from raising to closing." },
        { id: "ont", name: "Corrective actions on time", value: N(n.on_time_pct), unit: "%", target: 90, tol: 10, dir: "high", std: S("ISO 10.2.1", "IATF 10.2.3"), why: "Permanent actions completed by their due date." },
        { id: "eff", name: "Actions found effective", value: N(n.effective_pct), unit: "%", target: 90, tol: 10, dir: "high", std: S("ISO 10.2.1 (e)", "IATF 10.2.3"), why: "Effectiveness checks with an effective result." });
      var a = n.ageing || {}; ch.push({ title: "Ageing of open findings (days)", kind: "bar", kpi: "nc", labels: ["0-30", "31-60", "61-90", "over 90"], series: [{ name: "Findings", values: [a.d30, a.d60, a.d90, a.over90] }] });
      ch.push({ title: "Findings raised and closed (12 months)", kind: "line", kpi: "dtc", labels: (n.trend || []).map(function (x) { return x.m; }), series: [{ name: "Raised", values: (n.trend || []).map(function (x) { return x.raised; }) }, { name: "Closed", values: (n.trend || []).map(function (x) { return x.closed; }) }] });
      ch.push({ title: "Findings by standard (12 months)", kind: "bar", kpi: "nc", labels: (n.by_standard || []).map(function (x) { return x.k; }), series: [{ name: "Findings", values: (n.by_standard || []).map(function (x) { return x.n; }) }] });
    }
    var bt = d.by_type || {}, tn = Object.keys(bt);
    ch.unshift({ title: "Audits planned and done by type - " + yr, kind: "bar", kpi: "comp", labels: tn, series: [{ name: "Planned", values: tn.map(function (t) { return bt[t].planned; }) }, { name: "Done", values: tn.map(function (t) { return bt[t].done; }) }] });
    return { period: "Audit year " + yr, kpis: k, charts: ch };
  } };
})();
