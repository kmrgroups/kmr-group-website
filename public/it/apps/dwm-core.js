/* Daily Work Management — shared rules, used by the DWM screen, the Dashboards screen and the Presentation.
   A sheet has activities; each activity has one character per day 1–31 (cells): O plan · C completed · X missed · E concession · – off / not scheduled.
   Plan = O + C + X + E · Actual = C only · Adherence = Actual ÷ Plan  (a concession stays in the plan and does not count as completed).
   Full-month adherence keeps future planned reviews (still O) in the denominator until month close.
   Frequency: Daily = every day except the weekly-off days · Weekly = the chosen weekdays · Specific dates = the chosen days of the month. */
(function () {
  "use strict";
  var OFF = "–", STATES = ["O", "C", "X", "E", OFF], WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
  var dim = function (m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); };
  var dow = function (m, d) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, d)).getUTCDay(); };
  var cell = function (a, d) { return (Array.from(a.cells || "")[d - 1]) || OFF; };
  var isPlan = function (c) { return c === "O" || c === "C" || c === "X" || c === "E"; };

  /* the plan of one activity from its frequency (before any C / X / E entries) */
  function planAct(a, m, off) {
    var n = dim(m), out = [], offs = off || [0], wd = a.wd || [], dates = a.dates || [];
    for (var d = 1; d <= 31; d++) {
      var on = false;
      if (d <= n) {
        if (a.mode === "daily") on = offs.indexOf(dow(m, d)) < 0;
        else if (a.mode === "weekly") on = wd.indexOf(dow(m, d)) >= 0;
        else if (a.mode === "dates") on = dates.indexOf(d) >= 0;
      }
      out.push(on ? "O" : OFF);
    }
    return out;
  }
  /* apply the frequency without erasing a completed, missed or concession entry */
  function applyPlan(a, m, off) {
    var cur = Array.from(a.cells || OFF.repeat(31)), np = planAct(a, m, off), n = dim(m);
    a.cells = np.map(function (v, i) { var c = cur[i] || OFF; return i < n && (c === "C" || c === "X" || c === "E") ? c : v; }).join("");
    return a;
  }
  function newAct() { return { activity: "", resp: "", mode: "", wd: [], dates: [], dur: "", cells: OFF.repeat(31) }; }
  function emptyDoc() { return { target: 98, off: [0], section: "", reviewed: "", approved: "", date: "", acts: [], log: {} }; }

  function calc(doc, m, today) {
    var n = dim(m), acts = doc.acts || [], td = today || "", dayNo = td.slice(0, 7) === m ? +td.slice(8) : td < m + "-01" ? 0 : n;
    var perDay = []; for (var d = 1; d <= 31; d++) perDay.push({ plan: 0, done: 0, pct: null });
    var rows = acts.map(function (a) {
      var plan = 0, done = 0, missed = 0, conc = 0, open = 0, overdue = 0, planTo = 0, doneTo = 0;
      for (var d = 1; d <= 31; d++) {
        var c = d > n ? OFF : cell(a, d); if (!isPlan(c)) continue;
        plan++; perDay[d - 1].plan++; if (c === "C") { done++; perDay[d - 1].done++; } if (c === "X") missed++; if (c === "E") conc++; if (c === "O") { open++; if (d < dayNo) overdue++; }
        if (d <= dayNo) { planTo++; if (c === "C") doneTo++; }
      }
      return { a: a, plan: plan, done: done, pct: plan ? done / plan : null, missed: missed, conc: conc, open: open, overdue: overdue, planTo: planTo, doneTo: doneTo };
    });
    perDay.forEach(function (x) { x.pct = x.plan ? x.done / x.plan : null; });
    var T = rows.reduce(function (t, r) { ["plan", "done", "missed", "conc", "open", "overdue", "planTo", "doneTo"].forEach(function (k) { t[k] += r[k]; }); return t; }, { plan: 0, done: 0, missed: 0, conc: 0, open: 0, overdue: 0, planTo: 0, doneTo: 0 });
    T.pct = T.plan ? T.done / T.plan : null; T.pctTo = T.planTo ? T.doneTo / T.planTo : null;
    return { n: n, dayNo: dayNo, rows: rows, perDay: perDay, total: T };
  }

  /* all employees of a month: one row per employee, and the company total */
  function summary(emps, docs, m, today, target) {
    var tgt = target || 98, n = dim(m), rows = (emps || []).map(function (e) {
      var doc = docs[e.id] || null, c = doc ? calc(doc, m, today) : calc(emptyDoc(), m, today), t = (doc && +doc.target) || tgt, T = c.total;
      var pc = T.pct == null ? null : T.pct * 100, pt = T.pctTo == null ? null : T.pctTo * 100;
      var light = T.plan === 0 ? "n" : (pt != null ? pt : pc) >= t ? "g" : (pt != null ? pt : pc) >= Math.max(0, t - 8) ? "a" : "r";
      return { emp: e, doc: doc, c: c, T: T, target: t, pct: pc, pctTo: pt, light: light, acts: (doc && doc.acts || []).length };
    });
    var tot = { plan: 0, done: 0, missed: 0, conc: 0, open: 0, overdue: 0, planTo: 0, doneTo: 0 }, perDay = []; for (var d = 0; d < 31; d++) perDay.push({ plan: 0, done: 0 });
    rows.forEach(function (r) { Object.keys(tot).forEach(function (k) { tot[k] += r.T[k]; }); r.c.perDay.forEach(function (x, i) { perDay[i].plan += x.plan; perDay[i].done += x.done; }); });
    tot.pct = tot.plan ? tot.done / tot.plan * 100 : null; tot.pctTo = tot.planTo ? tot.doneTo / tot.planTo * 100 : null;
    perDay.forEach(function (x) { x.pct = x.plan ? x.done / x.plan * 100 : null; });
    var dayNo = rows[0] ? rows[0].c.dayNo : (today && today.slice(0, 7) === m ? +today.slice(8) : today < m + "-01" ? 0 : n);
    return { n: n, dayNo: dayNo, rows: rows, total: tot, perDay: perDay, target: tgt };
  }
  var newId = function () { return "e" + Math.random().toString(36).slice(2, 8); };
  var freqLabel = function (a) { return a.mode === "daily" ? "Daily" : a.mode === "weekly" ? "Weekly" : a.mode === "dates" ? "Specific dates" : "Not set"; };
  window.DWM = { STATES: STATES, WD: WD, WD_ORDER: WD_ORDER, OFF: OFF, dim: dim, dow: dow, cell: cell, calc: calc, planAct: planAct, applyPlan: applyPlan, newAct: newAct, emptyDoc: emptyDoc, summary: summary, isPlan: isPlan, newId: newId, freqLabel: freqLabel };
})();
