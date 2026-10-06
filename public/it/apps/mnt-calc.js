/* Maintenance — MTBF, MTTR, availability and downtime analysis. Pure functions (also run in node for testing).
   MTBF = operating hours ÷ breakdowns, where operating hours = scheduled hours (plant hours per day × working days) − breakdown downtime.
   MTTR = breakdown downtime ÷ breakdowns (from the moment the machine stopped to the moment it was restored).
   Availability = MTBF ÷ (MTBF + MTTR). */
(function () {
  "use strict";
  const HR = 36e5;
  const plant = (m) => { const p = (m && m.plant) || {}; return { H: +p.hoursPerDay > 0 ? +p.hoursPerDay : 16, off: p.weeklyOff || "Sunday", set: !!(m && m.plant) }; };
  function workDays(fromMs, toMs, off) {
    let n = 0; for (let t = fromMs; t < toMs; t += 864e5) { const d = new Date(t).getUTCDay(); const o = off === "Sunday" ? d === 0 : off === "Saturday & Sunday" ? d === 0 || d === 6 : off === "Friday" ? d === 5 : false; if (!o) n++; }
    return n;
  }
  const downH = (b, now) => Math.max(0, ((b.ended_at ? new Date(b.ended_at).getTime() : now) - new Date(b.started_at).getTime()) / HR);
  const respH = (b) => (b.attended_at ? Math.max(0, (new Date(b.attended_at) - new Date(b.started_at)) / HR) : null);

  /* the numbers for one machine (or the whole plant when machine is null) over the last `days` days */
  function stats(data, m, days, machine, now) {
    now = now || new Date(data.now || Date.now()).getTime();
    const P = plant(m), from = now - days * 864e5, wd = workDays(from, now, P.off);
    const bds = data.breakdowns.filter((b) => b.status !== "void" && new Date(b.started_at).getTime() >= from && (!machine || b.machine_code === machine));
    const machines = machine ? 1 : new Set([...(m.machines || []).map((x) => x.code)]).size || 1;
    const down = bds.reduce((a, b) => a + downH(b, now), 0), n = bds.length, sched = P.H * wd * machines, op = Math.max(0, sched - down);
    const rs = bds.map(respH).filter((v) => v != null), mtbf = n ? op / n : null, mttr = n ? down / n : null;
    return { n, down, sched, op, mtbf, mttr, avail: mtbf != null ? mtbf / (mtbf + mttr) : sched ? op / sched : null, resp: rs.length ? rs.reduce((a, v) => a + v, 0) / rs.length : null, wd, H: P.H, set: P.set };
  }
  const group = (arr, kf, vf) => { const o = {}; arr.forEach((a) => { const k = kf(a) || "—"; o[k] = (o[k] || 0) + vf(a); }); return Object.keys(o).map((k) => ({ l: k, v: o[k] })); };

  function analysis(data, m, days, now) {
    now = now || new Date(data.now || Date.now()).getTime();
    const from = now - days * 864e5, inW = (b) => b.status !== "void" && new Date(b.started_at).getTime() >= from;
    const bds = data.breakdowns.filter(inW), codes = [...new Set(bds.map((b) => b.machine_code).concat((data.losses || []).map((l) => l.machine_code)))].sort();
    const rows = codes.map((c) => Object.assign({ code: c, name: ((m.machines || []).find((x) => x.code === c) || {}).name || (bds.find((b) => b.machine_code === c) || {}).machine_name || "" }, stats(data, m, days, c, now)));
    const plantS = stats(data, m, days, null, now);
    const byMachine = group(bds, (b) => b.machine_code, (b) => downH(b, now)), byCat = group(bds, (b) => b.category, (b) => downH(b, now));
    const other = group((data.losses || []).filter((l) => new Date(l.loss_date + "T00:00:00Z").getTime() >= from), (l) => (l.d_code ? l.d_code + " — " + (l.d_name || "") : "—"), (l) => +l.minutes / 60);
    // repeat failures: the same machine and cause three or more times
    const rep = {}; bds.forEach((b) => { const k = b.machine_code + "|" + (b.category || "—"); (rep[k] = rep[k] || []).push(b); });
    const repeats = Object.keys(rep).filter((k) => rep[k].length >= 3).map((k) => ({ machine: k.split("|")[0], category: k.split("|")[1], n: rep[k].length, down: rep[k].reduce((a, b) => a + downH(b, now), 0), last: rep[k].map((b) => b.started_at).sort().pop() })).sort((a, b) => b.n - a.n);
    // by month
    const mon = {}; bds.forEach((b) => { const k = String(b.started_at).slice(0, 7), r = (mon[k] = mon[k] || { n: 0, down: 0 }); r.n++; r.down += downH(b, now); });
    return { rows: rows.sort((a, b) => b.down - a.down), plant: plantS, byMachine, byCat, other, repeats, months: Object.keys(mon).sort().map((k) => Object.assign({ m: k }, mon[k])) };
  }

  /* preventive maintenance: status of each plan and the share of PM done on or before the due date */
  function pm(data, today) {
    const t = new Date(today + "T00:00:00Z").getTime(), dd = (s) => Math.round((new Date(s + "T00:00:00Z").getTime() - t) / 864e5);
    const plans = data.plans.map((p) => Object.assign({}, p, { days: dd(p.next_due), st: dd(p.next_due) < 0 ? "over" : dd(p.next_due) <= 7 ? "soon" : "ok" }));
    const lg = data.pm_log.filter((l) => l.due_on), ontime = lg.filter((l) => l.done_on <= l.due_on).length;
    return { plans, over: plans.filter((p) => p.st === "over").length, soon: plans.filter((p) => p.st === "soon").length, compliance: lg.length ? ontime / lg.length : null, done: lg.length };
  }
  const api = { stats, analysis, pm, downH, respH, workDays, plant };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.MNTCalc = api;
})();
