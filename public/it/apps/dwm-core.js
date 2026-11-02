/* Daily Work Management — shared rules (the Excel formulas), used by the DWM screen and by the Presentation.
   A sheet's cells: one character per day 1–31 — O plan · C completed · X missed · E concession · – off / not scheduled.
   Plan = O + C + X + E · Actual = C only · Adherence = Actual ÷ Plan  (concessions stay in the plan and do not count as completed).
   Full-month adherence keeps future planned reviews (still O) in the denominator until month close. */
(function () {
  "use strict";
  var OFF = "–", STATES = ["O", "C", "X", "E", OFF], WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var dim = function (m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); };
  var dow = function (m, d) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, d)).getUTCDay(); };
  var cell = function (a, d) { return (Array.from(a.cells || "")[d - 1]) || OFF; };
  var isPlan = function (c) { return c === "O" || c === "C" || c === "X" || c === "E"; };
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
    var T = rows.reduce(function (t, r) { t.plan += r.plan; t.done += r.done; t.missed += r.missed; t.conc += r.conc; t.open += r.open; t.overdue += r.overdue; t.planTo += r.planTo; t.doneTo += r.doneTo; return t; }, { plan: 0, done: 0, missed: 0, conc: 0, open: 0, overdue: 0, planTo: 0, doneTo: 0 });
    T.pct = T.plan ? T.done / T.plan : null; T.pctTo = T.planTo ? T.doneTo / T.planTo : null;
    return { n: n, dayNo: dayNo, rows: rows, perDay: perDay, total: T };
  }
  /* plan a month from the frequency text: Daily (Mon–Sat), Weekly / Mon, Monthly / 15th workday, Monthly / last workday */
  function plan(freq, m) {
    var n = dim(m), f = String(freq || "").toLowerCase(), out = [], last = n; while (dow(m, last) === 0) last--;
    var wd = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }, pick = function () { return false; }, x;
    if (/^\s*daily/.test(f)) pick = function (d) { return dow(m, d) !== 0; };
    else if ((x = /^\s*weekly\s*\/\s*(sun|mon|tue|wed|thu|fri|sat)/.exec(f))) pick = function (d) { return dow(m, d) === wd[x[1]]; };
    else if (/^\s*monthly/.test(f)) {
      var N = /last\s*workday/.test(f) ? last : ((x = /(\d+)/.exec(f)) ? Math.min(+x[1], last) : 0);
      while (N && N < n && dow(m, N) === 0) N++;                  // a Sunday moves to the next working day
      pick = function (d) { return d === N; };
    }
    for (var d = 1; d <= 31; d++) out.push(d <= n && pick(d) ? "O" : OFF);
    return out.join("");
  }
  function blank(m, doc) {
    var copy = JSON.parse(JSON.stringify(doc)); copy.log = {};
    copy.acts.forEach(function (a) { a.cells = plan(a.freq, m); }); return copy;
  }
  function stats(rows) { return rows; }
  window.DWM = { STATES: STATES, WD: WD, OFF: OFF, dim: dim, dow: dow, cell: cell, calc: calc, plan: plan, blank: blank, isPlan: isPlan, stats: stats };
})();
