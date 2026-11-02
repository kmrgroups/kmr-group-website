/* KMR Sales Flow — the numbers behind the all-plants dashboard, the sales-loss screen, the conclusion screen and the presentation.
   One model, so every screen and the presentation always show the same figures.

   SalesAll.build({ lines, despatch, plants, actions, month:'YYYY-MM', basis:'month'|'today', today:'YYYY-MM-DD', cfg })
     lines     = Sales Flow lines; each carries plant_code (and plant_slug) — one entry in `plants` per plant
     plants    = [{ code, slug, name }]
     actions   = Sales Flow action plans; each carries plant_code
   returns { total, plants:[…], reasons, matrix, customers, cumulative, actions, concl, … }   (values are in ₹; USD / EUR are converted at cfg.FX)
   SalesAll.presentData(model) → the data the shared Presentation engine draws (KPIs, charts, extra slides).
   Loss = sales not yet despatched: basis 'month' = the whole month's pending quantity, 'today' = only what is behind schedule till today. */
(function () {
  "use strict";
  var CFG = {
    WORK_DAYS: [1, 2, 3, 4, 5, 6], AMBER_BELOW: 0.9, RED_BELOW: 0.7, FX: { INR: 1, USD: 84, EUR: 92 },
    CUSTOMER_DRIVEN: ["Customer No Pull"],
    LOSS_TARGET: 5, LOSS_AMBER: 10,           // sales loss as % of plan value: on target up to 5%, watch up to 10%, above that a gap
    NONE: "(Reason not entered)"
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var dim = function (m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); };
  var days = function (m) { var o = []; for (var i = 1; i <= dim(m); i++) o.push(m + "-" + pad(i)); return o; };
  var dow = function (ds) { var d = new Date(ds + "T00:00:00Z").getUTCDay(); return d === 0 ? 7 : d; };
  var addDays = function (ds, n) { return new Date(new Date(ds + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10); };
  var dayDiff = function (a, b) { return Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 864e5); };
  var nextWorkDay = function (ds) { var d = ds; do { d = addDays(d, 1); } while (dow(d) === 7); return d; };
  var todayIn = function () { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); };

  /* planned quantity of a line on each day (same rule as the Sales Flow screens) */
  function plannedByDay(l, cfg) {
    var ds = days(String(l.month).slice(0, 7)), out = {}, q = +l.demand_qty;
    if (l.sched_type === "date") { if (l.sched_date) out[l.sched_date] = q; return out; }
    var pick = ds.filter(function (d) { return l.sched_type === "daily" ? cfg.WORK_DAYS.indexOf(dow(d)) >= 0 : dow(d) === +l.sched_weekday; }), n = pick.length;
    if (!n || !q) return out;
    if (q % 1 === 0) { var base = Math.floor(q / n), r = q - base * n; pick.forEach(function (d, i) { out[d] = base + (Math.floor((i + 1) * r / n) - Math.floor(i * r / n)); }); }
    else pick.forEach(function (d) { out[d] = Math.round(q / n * 100) / 100; });
    return out;
  }

  /* what the department that normally owns each loss reason is, the standards behind it, and the first steps that usually work */
  var REASON = {
    "Raw Material Issue": { fn: "Purchase & Stores head", std: [["ISO", "8.4"], ["IATF", "8.4.2.4"], ["VDA", "P5"]],
      steps: ["Make a list of the parts waiting for material; get an emergency supply or a transfer from another plant, and a firm delivery date from the supplier.", "Check the schedule given to the supplier against the customer demand, the safety stock, and the supplier's delivery and rejection record.", "Fix a minimum–maximum stock for the material, share the monthly plan with the supplier, and approve a second source for the Class A parts."] },
    "Inspection Delay": { fn: "Quality head", std: [["ISO", "8.6"], ["IATF", "8.5.1.1"], ["VDA", "P6"]],
      steps: ["Clear the waiting lots in the order of customer due date; add an inspector for the peak hours.", "Find where lots wait: no inspector, no gauge, first-piece approval, or waiting for lab results.", "Move inspection next to the process (in-process checks), and set a time limit for lot release that is checked every day."] },
    "Customer No Pull": { fn: "Sales & customer service head", std: [["ISO", "8.2.1"], ["IATF", "9.1.2.1"], ["VDA", "P7"]],
      steps: ["Get the customer's revised schedule in writing; re-plan the stock and the capacity released by the change.", "Compare the customer's forecast with what they actually pulled over the last 3 months.", "Agree a weekly schedule review with the customer, and a rule for finished-goods stock that follows their pull."] },
    "Production Delay": { fn: "Production head", std: [["ISO", "8.5.1"], ["IATF", "8.5.1.1"], ["VDA", "P6"]],
      steps: ["Give the late parts the first slot on the machine; run an extra shift if it is needed to protect the customer.", "Compare the actual cycle time, set-up time and rejection with the routing.", "Correct the routing and the daily plan, and review the hour-by-hour output at the line every shift."] },
    "Capacity Issue": { fn: "Planning (PPC) head", std: [["ISO", "8.1"], ["IATF", "8.2.3.1.3"], ["IATF", "7.1.3.1"]],
      steps: ["Move the load to the machines that are free, or outsource the operation that is the bottleneck.", "Run the Capacity Planner for the month: find the bottleneck machine and the real load against the available hours.", "Check feasibility before a plan is accepted (IATF 8.2.3.1.3); add capacity or fix the bottleneck's cycle time."] },
    "Unplanned": { fn: "Sales & planning head", std: [["ISO", "8.2.3"], ["ISO", "8.1"], ["IATF", "8.2.3.1.3"]],
      steps: ["List what was sold or built without being in the plan; confirm the demand with the customer.", "Find why the plan did not include it: late order, wrong forecast or missing part.", "Freeze the plan on a fixed date each month and review every change with the planning team."] },
    "Machine Break Down": { fn: "Maintenance head", std: [["ISO", "7.1.3"], ["IATF", "8.5.1.5"], ["VDA", "P6"]],
      steps: ["Move the jobs to another machine and restore the machine; record the breakdown hours.", "Find the cause of the repeat breakdowns (bearing, lubrication, operator care) with a 5-Why.", "Set up preventive maintenance and spare parts for the critical machines (IATF 8.5.1.5), and check it every week."] },
    "Lack of Tool": { fn: "Tool room head", std: [["ISO", "7.1.3"], ["IATF", "8.5.1.5"], ["VDA", "P6"]],
      steps: ["Buy or recondition the tool the parts are waiting for; use the nearest approved alternative if the customer allows it.", "Check tool life and the re-sharpening plan against the actual use.", "Keep a minimum stock of the critical tools and a tool-life record for every machine."] },
    "Jig-Fixtures": { fn: "Tool room head", std: [["ISO", "7.1.3"], ["IATF", "8.5.1.5"], ["VDA", "P6"]],
      steps: ["Repair or make the jig or fixture the parts are waiting for.", "Find why it was not ready: late design, wear or a repair queue.", "Put every jig and fixture on a maintenance and verification schedule; plan new ones before the part is launched."] },
    "Manpower Absenteeism": { fn: "HR & Production head", std: [["ISO", "7.1.2"], ["ISO", "7.2"], ["IATF", "7.2.1"]],
      steps: ["Cover the absent operators from a multi-skilled pool; give overtime only for the loss parts.", "Study absenteeism by shift and by reason; find the days of the week or month when it peaks.", "Build a skill matrix so each operation has at least two trained persons, and review it every month."] },
    "No Manpower": { fn: "HR & Production head", std: [["ISO", "7.1.2"], ["ISO", "7.2"], ["IATF", "7.2.1"]],
      steps: ["Arrange temporary operators for the loss parts and train them for the operation.", "Compare the manpower in the plan with what the plan really needs.", "Fix the manpower plan with the sales plan, and start recruitment early enough for the training time."] },
    "Improper Scheduling": { fn: "Planning (PPC) head", std: [["ISO", "8.1"], ["IATF", "8.2.3.1.3"], ["VDA", "P6"]],
      steps: ["Reset the daily plan in the order of the customer due date; tell the shop floor what to run first.", "Compare the schedule with the real material, tool and machine availability.", "Release a schedule only when material, tool and capacity are confirmed, and publish it every day."] },
    "Lack of Packing Materials": { fn: "Stores & Dispatch head", std: [["ISO", "8.5.4"], ["IATF", "8.5.4.1"], ["ISO", "8.4"]],
      steps: ["Arrange the packing material urgently; use the customer-approved alternative if there is one.", "Check the order lead time and the stock level of packing material.", "Set minimum stock for the packing material, and link the packing order to the monthly sales plan."] },
    "Rejections under hold": { fn: "Quality head", std: [["ISO", "8.7"], ["IATF", "8.7.1"], ["IATF", "10.2.3"]],
      steps: ["Sort or rework the held lots first in the order of customer due date; record the decision for each lot.", "Do the root-cause analysis (8D) for the rejection that put the lots on hold.", "Correct the process and update the PFMEA and the Control Plan; check the rejection rate for the next 3 lots."] },
    "Lack of Bins & Trays": { fn: "Stores & Dispatch head", std: [["ISO", "8.5.4"], ["ISO", "7.1.3"], ["IATF", "8.5.4.1"]],
      steps: ["Arrange the bins and trays urgently; call back from the customer if they are there.", "Check how many bins are needed against how many are available and their return time.", "Set a bin and tray stock per part, and a return schedule with the customer."] },
    "Others": { fn: "Plant head", std: [["ISO", "10.2"], ["IATF", "10.2.3"]],
      steps: ["Read the reasons typed for these lines and group the ones that repeat.", "Add a proper reason to the list for any cause that comes more than once.", "Treat the biggest group like any other reason: owner, root cause, action, date."] }
  };
  REASON[CFG.NONE] = { fn: "Sales Flow editor of the plant", std: [["ISO", "9.1.3"], ["ISO", "7.5.3"]],
    steps: ["Open the Sales loss screen of the plant and select a reason for every line that has loss.", "Make it a daily routine: the reason is entered on the day the loss is first seen.", "Review the lines without a reason in the weekly meeting."] };

  var SEQ = [
    ["Contain", "Protect the customer first: ship from stock, expedite, and tell the customer the new date.", "1 day", 1],
    ["Define", "Put a number on the loss part by part, name one owner, and open an action plan in Sales Flow.", "2 days", 2],
    ["Find the root cause", "Use 5-Why or 8D with data from the shop floor, not opinion. Stop at the cause that can be fixed.", "3–5 days", 5],
    ["Correct and prevent", "Fix the cause, then apply the same fix to similar parts and to the other plants. Error-proof where possible.", "14–21 days", 21],
    ["Verify", "Check the loss % of this reason in the weekly review and at the month end. Close the action only when the numbers confirm it.", "30 days", 30],
    ["Standardise", "Update the PFMEA, Control Plan, work instruction or planning rule. Share the lesson with every plant.", "30 days", 30]];
  var SEQ_STD = [["ISO", "10.2"], ["IATF", "10.2.3"], ["IATF", "10.2.4"], ["ISO", "10.3"], ["VDA", "P7"]];

  function build(o) {
    var cfg = Object.assign({}, CFG, o.cfg || {}), month = o.month, today = o.today || todayIn(), basis = o.basis === "month" ? "month" : "today";
    var fx = function (c) { return (cfg.FX || {})[c || "INR"] != null ? cfg.FX[c || "INR"] : 1; };
    var dsp = {}; (o.despatch || []).forEach(function (d) { (dsp[d.line_id] = dsp[d.line_id] || {})[d.day] = +d.qty; });
    var upto = today < month + "-01" ? "0000" : today, ds = days(month), n = ds.length;
    var PL = (o.plants || []).map(function (p) { return { code: p.code, slug: p.slug || "", name: p.name || p.code }; });
    var byCode = {}; PL.forEach(function (p) {
      byCode[p.code] = Object.assign(p, { parts: 0, planV: 0, actV: 0, lossV: 0, pendV: 0, behindV: 0, expV: 0, unplV: 0, demand: 0, done: 0, pending: 0, noReasonV: 0, lossLines: [], byReason: {}, cumPlan: new Array(n).fill(0), cumAct: new Array(n).fill(0), cust: {} });
    });
    var mixedCur = false;
    (o.lines || []).forEach(function (l) {
      var p = byCode[l.plant_code]; if (!p) { p = byCode[l.plant_code] = { code: l.plant_code, slug: l.plant_slug || "", name: l.plant_code, parts: 0, planV: 0, actV: 0, lossV: 0, pendV: 0, behindV: 0, expV: 0, unplV: 0, demand: 0, done: 0, pending: 0, noReasonV: 0, lossLines: [], byReason: {}, cumPlan: new Array(n).fill(0), cumAct: new Array(n).fill(0), cust: {} }; PL.push(p); }
      var price = +l.price || 0, f = fx(l.currency), v = price * f, demand = +l.demand_qty || 0, mine = dsp[l.id] || {}, plan = plannedByDay(l, cfg);
      if (l.currency && l.currency !== "INR") mixedCur = true;
      var done = Object.keys(mine).reduce(function (a, k) { return a + mine[k]; }, 0);
      if (demand <= 0) { p.unplV += done * v; return; }
      var expected = Object.keys(plan).filter(function (d) { return d <= upto; }).reduce(function (a, d) { return a + plan[d]; }, 0), pending = Math.max(demand - done, 0), behind = Math.max(expected - done, 0);
      var lq = basis === "month" ? pending : Math.min(behind, pending);
      p.parts++; p.demand += demand; p.done += Math.min(done, demand); p.pending += pending;
      p.planV += demand * v; p.actV += Math.min(done, demand) * v; p.expV += expected * v; p.pendV += pending * v; p.behindV += Math.min(behind, pending) * v; p.lossV += lq * v; p.unplV += Math.max(done - demand, 0) * v;
      ds.forEach(function (d, i) { p.cumPlan[i] += (plan[d] || 0) * v; p.cumAct[i] += (mine[d] || 0) * v; });
      if (lq > 0) {
        var rs = (l.loss_reason === "Others" && l.loss_other ? "Others" : l.loss_reason) || cfg.NONE, lv = lq * v;
        p.lossLines.push({ l: l, reason: rs, v: lv, qty: lq, demand: demand, done: done, plant: p.code });
        p.byReason[rs] = (p.byReason[rs] || 0) + lv; if (rs === cfg.NONE) p.noReasonV += lv;
        var cn = l.buyer_name || "—"; p.cust[cn] = (p.cust[cn] || 0) + lv;
      }
    });
    /* cumulative series (running totals; actual only up to today) */
    function cum(arr, isAct) { var s = 0; return arr.map(function (x, i) { s += x; return isAct && ds[i] > upto ? null : s; }); }
    PL.forEach(function (p) { p.cumPlan = cum(p.cumPlan, false); p.cumAct = cum(p.cumAct, true); });
    var total = { code: "All plants", name: "All plants", parts: 0, planV: 0, actV: 0, lossV: 0, pendV: 0, behindV: 0, expV: 0, unplV: 0, demand: 0, done: 0, pending: 0, noReasonV: 0, lossLines: [], byReason: {}, cumPlan: new Array(n).fill(0), cumAct: new Array(n).fill(0), cust: {} };
    PL.forEach(function (p) {
      ["parts", "planV", "actV", "lossV", "pendV", "behindV", "expV", "unplV", "demand", "done", "pending", "noReasonV"].forEach(function (k) { total[k] += p[k]; });
      total.lossLines = total.lossLines.concat(p.lossLines);
      Object.keys(p.byReason).forEach(function (k) { total.byReason[k] = (total.byReason[k] || 0) + p.byReason[k]; });
      Object.keys(p.cust).forEach(function (k) { total.cust[k] = (total.cust[k] || 0) + p.cust[k]; });
      p.cumPlan.forEach(function (x, i) { total.cumPlan[i] += x; }); p.cumAct.forEach(function (x, i) { if (x != null) total.cumAct[i] = (total.cumAct[i] || 0) + x; else total.cumAct[i] = null; });
    });
    var pc = function (a, b) { return b ? a / b * 100 : 0; };
    PL.concat([total]).forEach(function (p) {
      p.lossPct = pc(p.lossV, p.planV); p.ach = pc(p.actV, p.planV); p.vsExp = p.expV ? p.actV / p.expV * 100 : 100; p.behindPct = pc(p.behindV, p.planV);
      p.light = p.lossPct <= cfg.LOSS_TARGET ? "g" : p.lossPct <= cfg.LOSS_AMBER ? "a" : "r";
    });
    /* loss by reason, with the plant split */
    var rs = Object.keys(total.byReason).map(function (k) {
      var row = { reason: k, v: total.byReason[k], n: total.lossLines.filter(function (x) { return x.reason === k; }).length, byPlant: {}, customerDriven: cfg.CUSTOMER_DRIVEN.indexOf(k) >= 0, none: k === cfg.NONE };
      PL.forEach(function (p) { row.byPlant[p.code] = p.byReason[k] || 0; }); return row;
    }).sort(function (a, b) { return b.v - a.v; });
    var cumPct = 0; rs.forEach(function (r) { r.share = pc(r.v, total.lossV); var before = cumPct; cumPct += r.share; r.cum = cumPct; r.main = before < 80 && !r.none; });
    var cd = rs.filter(function (r) { return r.customerDriven; }).reduce(function (a, r) { return a + r.v; }, 0), unk = total.noReasonV;
    var customers = Object.keys(total.cust).map(function (k) { return { name: k, v: total.cust[k], share: pc(total.cust[k], total.lossV) }; }).sort(function (a, b) { return b.v - a.v; });
    /* action plans */
    var acts = (o.actions || []).map(function (a) { return Object.assign({}, a, { overdue: a.status !== "Closed" && a.target_date && a.target_date < today }); });
    var A = { total: acts.length, open: acts.filter(function (a) { return a.status === "Opened"; }).length, prog: acts.filter(function (a) { return a.status === "Under progress"; }).length, closed: acts.filter(function (a) { return a.status === "Closed"; }).length, overdue: acts.filter(function (a) { return a.overdue; }).length, list: acts };
    var model = { month: month, today: today, basis: basis, cfg: cfg, plants: PL, total: total, reasons: rs, customers: customers, internalV: total.lossV - cd - unk, customerV: cd, unknownV: unk, actions: A, days: ds, mixedCur: mixedCur, REASON: REASON, SEQ: SEQ };
    model.concl = conclusions(model);
    return model;
  }

  /* what to do, where, who, when, why and how */
  function conclusions(M) {
    var out = [], t = M.today, id = 0, cfg = M.cfg, inr = function (v) { return "₹" + Math.round(v).toLocaleString("en-IN"); };
    var openFor = function (reason, plant) { return M.actions.list.filter(function (a) { return a.status !== "Closed" && (a.issue === reason || (reason === "Others" && a.issue === "Others")) && (!plant || a.plant_code === plant); }); };
    var push = function (x) { x.id = ++id; out.push(x); };
    var multi = M.plants.length > 1;
    /* per plant, per reason: the reasons that make 80% of that plant's loss (at most 4) */
    M.plants.forEach(function (p) {
      if (!(p.lossV > 0)) return;
      var rows = Object.keys(p.byReason).map(function (k) { return [k, p.byReason[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), cumv = 0, k = 0;
      rows.forEach(function (r) {
        if (cumv / p.lossV >= 0.8 || k >= 4) return; cumv += r[1]; k++;
        var reason = r[0], info = REASON[reason] || REASON.Others, lines = p.lossLines.filter(function (x) { return x.reason === reason; }).sort(function (a, b) { return b.v - a.v; });
        var acts = openFor(reason, p.code), a0 = acts.slice().sort(function (a, b) { return String(a.target_date || "9").localeCompare(String(b.target_date || "9")); })[0];
        var share = r[1] / p.lossV * 100, top = k <= 2 || share >= 25, who = a0 ? a0.responsible : info.fn, assigned = !!a0;
        var where = lines.slice(0, 3).map(function (x) { return (x.l.buyer_name ? x.l.buyer_name + " · " : "") + (x.l.part_code || ""); }).join("; ") + (lines.length > 3 ? " and " + (lines.length - 3) + " more" : "");
        var dContain = nextWorkDay(t), dRoot = addDays(t, top ? 3 : 5), dFix = a0 && a0.target_date && a0.target_date >= t ? a0.target_date : addDays(t, a0 ? 7 : top ? 14 : 21), dVerify = addDays(dFix, 14);
        push({ level: "plant", plant: p.code, reason: reason, prio: top ? "High" : "Medium", value: r[1], share: share, who: who, assigned: assigned, action: a0 || null,
          what: (reason === cfg.NONE ? "Enter the reason for the sales loss of " : "Recover the sales loss of ") + inr(r[1]) + (reason === cfg.NONE ? "" : " caused by “" + reason + "”") + (multi ? " in " + p.code : ""),
          where: where, when: { contain: dContain, root: dRoot, fix: dFix, verify: dVerify }, due: dFix,
          why: inr(r[1]) + " is " + Math.round(share) + "% of the " + (multi ? p.code + " " : "") + "sales loss (" + p.lossPct.toFixed(1) + "% of its plan value) on " + lines.length + " part(s)." + (reason === cfg.NONE ? " Without a reason the loss cannot be analysed or prevented." : "") + (a0 ? " An action plan is open with " + a0.responsible + (a0.overdue ? " and it is overdue." : ".") : (reason === cfg.NONE ? "" : " No open action plan exists yet.")),
          how: info.steps, std: info.std });
      });
    });
    /* management items */
    var tot = M.total;
    if (multi && tot.lossV > 0) {
      var worstP = M.plants.slice().sort(function (a, b) { return b.lossV - a.lossV; })[0], worstPct = M.plants.slice().sort(function (a, b) { return b.lossPct - a.lossPct; })[0];
      push({ level: "mgmt", plant: "All plants", prio: "High", value: worstP.lossV, share: worstP.lossV / tot.lossV * 100, who: "Plant head of " + worstP.code, assigned: false, what: "Review " + worstP.code + " first — it carries the largest sales loss", where: worstP.code + " (" + inr(worstP.lossV) + ", " + Math.round(worstP.lossV / tot.lossV * 100) + "% of the company's loss)" + (worstPct.code !== worstP.code ? "; " + worstPct.code + " has the highest loss % (" + worstPct.lossPct.toFixed(1) + "%)" : ""),
        when: { contain: nextWorkDay(t), root: addDays(t, 3), fix: addDays(t, 14), verify: addDays(t, 30) }, due: addDays(t, 14), why: "The company's sales loss is " + inr(tot.lossV) + " = " + tot.lossPct.toFixed(1) + "% of the plan value of " + inr(tot.planV) + ". Fixing the largest plant moves the company number the most.",
        how: ["Hold a loss review with the plant head, planning, production and quality heads of this plant this week.", "Agree the plant's recovery plan for the loss parts in the order of customer due date.", "Review the same page every week until the loss % is below " + cfg.LOSS_TARGET + "%."], std: [["ISO", "9.3.2"], ["ISO", "9.3.3"], ["IATF", "9.1.1.1"]] });
    }
    if (tot.noReasonV > 0 && M.plants.every(function (p) { return !p.noReasonV || out.every(function (x) { return !(x.plant === p.code && x.reason === cfg.NONE); }); })) {
      var np = M.plants.filter(function (p) { return p.noReasonV > 0; }).map(function (p) { return p.code; }).join(", ");
      push({ level: "mgmt", plant: np, prio: "Medium", reason: cfg.NONE, value: tot.noReasonV, share: tot.noReasonV / tot.lossV * 100, who: REASON[cfg.NONE].fn, assigned: false, what: "Give a reason to every loss line (" + inr(tot.noReasonV) + " has no reason)", where: np, when: { contain: nextWorkDay(t), root: addDays(t, 2), fix: addDays(t, 3), verify: addDays(t, 10) }, due: addDays(t, 3), why: "A loss without a reason cannot be analysed, so nobody can be asked to prevent it.", how: REASON[cfg.NONE].steps, std: REASON[cfg.NONE].std });
    }
    if (M.actions.overdue > 0) {
      var od = M.actions.list.filter(function (a) { return a.overdue; }), who = {}; od.forEach(function (a) { who[a.responsible] = (who[a.responsible] || 0) + 1; });
      push({ level: "mgmt", plant: "All plants", prio: "High", value: 0, who: "Management (follow-up) — " + Object.keys(who).map(function (k) { return k + " " + who[k]; }).join(", "), assigned: true, what: "Close the " + M.actions.overdue + " overdue action plan(s)", where: od.slice(0, 4).map(function (a) { return (a.plant_code ? a.plant_code + " · " : "") + a.issue; }).join("; "), when: { contain: nextWorkDay(t), root: addDays(t, 2), fix: addDays(t, 7), verify: addDays(t, 14) }, due: addDays(t, 7),
        why: "Actions that pass their date without a reason mean the loss will repeat next month.", how: ["Ask each owner for a new date with the reason for the delay, or help remove the obstacle.", "Record the new date in the action plan; do not leave a plan open without a date.", "Review overdue actions at the start of every weekly meeting."], std: [["ISO", "10.2"], ["ISO", "9.3.3"], ["IATF", "10.2.3"]] });
    }
    var noAct = M.reasons.filter(function (r) { return !r.none && !openFor(r.reason).length; }).slice(0, 5);
    if (noAct.length) push({ level: "mgmt", plant: "All plants", prio: "Medium", value: noAct.reduce(function (a, r) { return a + r.v; }, 0), who: "Plant heads", assigned: false, what: "Open an action plan for each loss reason that has none", where: noAct.map(function (r) { return r.reason; }).join(", "), when: { contain: nextWorkDay(t), root: addDays(t, 3), fix: addDays(t, 5), verify: addDays(t, 14) }, due: addDays(t, 5), why: "These reasons carry " + inr(noAct.reduce(function (a, r) { return a + r.v; }, 0)) + " of loss and nobody owns them.", how: ["Name one owner for each reason, with a target date.", "Raise the action plan from the Sales loss screen (＋ Action) so it is linked to the part.", "Review it in the weekly meeting."], std: [["ISO", "10.2"], ["IATF", "10.2.3"]] });
    var tc = M.customers[0];
    if (tc && tot.lossV > 0 && tc.share >= 40) push({ level: "mgmt", plant: "All plants", prio: "Medium", value: tc.v, who: "Sales head", assigned: false, what: "Protect the relationship with " + tc.name, where: tc.name + " (" + Math.round(tc.share) + "% of the loss)", when: { contain: nextWorkDay(t), root: addDays(t, 3), fix: addDays(t, 10), verify: addDays(t, 30) }, due: addDays(t, 10), why: "One customer holds " + Math.round(tc.share) + "% of the loss; a delay here shows up in their delivery rating.", how: ["Share the recovery plan and the new dates with the customer before they ask.", "Give their parts the first slot in material, machine and inspection.", "Track their delivery rating each week."], std: [["ISO", "9.1.2"], ["IATF", "9.1.2.1"], ["VDA", "P7"]] });
    var rank = { High: 0, Medium: 1, Low: 2 };
    var pi = function (c) { return M.plants.map(function (p) { return p.code; }).indexOf(c); };
    out.sort(function (a, b) { return (a.level === b.level ? 0 : a.level === "mgmt" ? -1 : 1) || (a.level === "plant" ? pi(a.plant) - pi(b.plant) : 0) || rank[a.prio] - rank[b.prio] || b.value - a.value; });
    out.forEach(function (x, i) { x.no = i + 1; });
    return out;
  }

  /* the data the shared Presentation engine draws */
  function presentData(M, opt) {
    opt = opt || {}; var T = M.total, cfg = M.cfg, multi = M.plants.length > 1, inr = function (v) { return "₹" + Math.round(v).toLocaleString("en-IN"); };
    var lakh = function (v) { return "₹" + (v / 100000).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + " L"; };
    var S = function (a) { return a.map(function (x) { return x.split(" "); }).map(function (x) { return [x[0], x.slice(1).join(" ")]; }); };
    var noAct = M.reasons.filter(function (r) { return !r.none && !M.actions.list.some(function (a) { return a.status !== "Closed" && a.issue === r.reason; }); }).length;
    var K = [
      { id: "plan", name: "Sales plan value", value: T.planV, unit: "₹", std: S(["ISO 8.1", "ISO 9.1.3", "IATF 8.2.3.1.3"]), why: "Customer demand × price for every planned part" + (M.mixedCur ? " (USD and EUR parts converted at the rates set in Sales Flow)." : ".") },
      { id: "act", name: "Actual despatch value", value: T.actV, unit: "₹", std: S(["ISO 9.1.2", "IATF 9.1.2.1", "VDA P7"]), why: "Pieces despatched against the plan × price. Unplanned despatch of " + lakh(T.unplV) + " is kept outside." },
      { id: "loss", name: "Sales loss value", value: T.lossV, unit: "₹", target: 0, amber: T.planV * cfg.LOSS_AMBER / 100, dir: "low", std: S(["ISO 9.1.3", "ISO 10.2", "IATF 10.2.3"]), why: "Plan value not despatched" + (M.basis === "today" ? " although it was due by today (behind schedule)." : " — the whole month's pending quantity.") },
      { id: "lp", name: "Sales loss % of plan value", value: T.lossPct, unit: "%", target: cfg.LOSS_TARGET, amber: cfg.LOSS_AMBER, dir: "low", std: S(["ISO 9.1.3", "IATF 9.1.1.1", "VDA P7"]), why: "Target up to " + cfg.LOSS_TARGET + "%, watch up to " + cfg.LOSS_AMBER + "%. These limits are set in Sales Flow." },
      { id: "ach", name: "Despatch vs due by today", value: T.vsExp, unit: "%", target: 100, tol: 10, dir: "high", std: S(["IATF 9.1.2.1", "ISO 9.1.2", "VDA P7"]), why: "Value despatched ÷ value scheduled up to today. Below 90% is slipping." },
      { id: "int", name: "Loss that is internal", value: T.lossV ? M.internalV / T.lossV * 100 : 0, unit: "%", std: S(["ISO 10.2", "IATF 10.2.3"]), why: "Share of the loss the plant can fix itself (not customer-driven, reason entered)." },
      { id: "nor", name: "Loss without a reason (₹)", value: T.noReasonV, unit: "₹", target: 0, amber: T.lossV * 0.1, dir: "low", std: S(["ISO 9.1.3", "ISO 7.5.3"]), why: "Loss lines where no reason has been entered." },
      { id: "ov", name: "Overdue action plans", value: M.actions.overdue, target: 0, amber: 2, dir: "low", std: S(["ISO 10.2", "IATF 10.2.3", "ISO 9.3.3"]), why: "Action plans past their target date and not closed." },
      { id: "na", name: "Loss reasons with no open action", value: noAct, target: 0, amber: 1, dir: "low", std: S(["ISO 10.2", "IATF 10.2.3"]), why: "Each reason that causes loss needs an owner and a date." }];
    if (multi) M.plants.forEach(function (p) { K.push({ id: "p_" + p.code, name: p.code + " — loss % of plan", value: p.lossPct, unit: "%", target: cfg.LOSS_TARGET, amber: cfg.LOSS_AMBER, dir: "low", std: S(["ISO 9.1.3", "IATF 9.1.2.1", "VDA P7"]), why: p.code + ": loss " + inr(p.lossV) + " against a plan of " + inr(p.planV) + "." }); });
    var top = M.reasons.slice(0, 8), ds = M.days.map(function (d) { return d.slice(8); }), upto = M.days.filter(function (d) { return d <= M.today; }).length;
    var CH = [];
    if (multi) CH.push({ title: "Plan, actual and loss by plant (₹ lakh)", kind: "bar", kpi: "lp", labels: M.plants.map(function (p) { return p.code; }), series: [{ name: "Plan", values: M.plants.map(function (p) { return +(p.planV / 1e5).toFixed(1); }) }, { name: "Actual", values: M.plants.map(function (p) { return +(p.actV / 1e5).toFixed(1); }) }, { name: "Loss", values: M.plants.map(function (p) { return +(p.lossV / 1e5).toFixed(1); }) }], note: "Each plant side by side. Loss = plan not yet despatched." });
    CH.push({ title: "Cumulative sales value — plan vs actual (₹ lakh)", kind: "line", kpi: "ach", labels: ds, series: [{ name: "Plan", values: T.cumPlan.map(function (v) { return +(v / 1e5).toFixed(2); }) }, { name: "Actual", values: T.cumAct.map(function (v) { return v == null ? null : +(v / 1e5).toFixed(2); }) }], note: "Running total from day 1. Actual is shown up to day " + upto + "." });
    CH.push({ title: "Sales loss by reason (₹ lakh)", kind: "bar", kpi: "loss", labels: top.map(function (r) { return r.reason; }), series: [{ name: "Loss", values: top.map(function (r) { return +(r.v / 1e5).toFixed(2); }), color: "#d64545" }], note: top.length ? "The first " + (top.filter(function (r) { return r.main; }).length || 1) + " reason(s) make about 80% of the loss — start there." : "" });
    if (multi) CH.push({ title: "Sales loss % of plan value by plant", kind: "bar", kpi: "lp", labels: M.plants.map(function (p) { return p.code; }), series: [{ name: "Loss %", values: M.plants.map(function (p) { return +p.lossPct.toFixed(1); }), color: "#e8a317" }], note: "Target is " + cfg.LOSS_TARGET + "% or less." });
    var tdd = function (x, c) { return "<td" + (c ? ' class="' + c + '"' : "") + ">" + x + "</td>"; };
    var dot = function (l) { return '<i class="dot l-' + l + '"></i>'; };
    var EX = [];
    if (multi) EX.push({ title: "Plant-wise sales plan, actual and loss", std: S(["ISO 9.1.3", "ISO 9.3.2", "IATF 9.1.2.1", "VDA P7"]), html: "<table><thead><tr><th>Plant</th><th>Plan value</th><th>Actual value</th><th>Loss value</th><th>Loss %</th><th>Achieved %</th><th>vs due by today</th><th></th></tr></thead><tbody>" + M.plants.concat([T]).map(function (p) { return "<tr" + (p === T ? ' style="font-weight:700"' : "") + ">" + tdd(esc(p.code)) + tdd(inr(p.planV)) + tdd(inr(p.actV)) + tdd(inr(p.lossV)) + tdd(p.lossPct.toFixed(1) + "%") + tdd(p.ach.toFixed(0) + "%") + tdd(p.vsExp.toFixed(0) + "%") + tdd(dot(p.light)) + "</tr>"; }).join("") + '</tbody></table><div class="note">' + dot("g") + " loss up to " + cfg.LOSS_TARGET + "% &nbsp; " + dot("a") + " up to " + cfg.LOSS_AMBER + "% &nbsp; " + dot("r") + " above. Values in ₹; plan and actual are for planned parts only.</div>" });
    EX.push({ title: "Why the sales loss happened" + (multi ? " — reason by plant" : ""), std: S(["ISO 9.1.3", "ISO 10.2", "IATF 10.2.3", "VDA P7"]), html: M.reasons.length ? "<table><thead><tr><th>Reason</th>" + (multi ? M.plants.map(function (p) { return "<th>" + esc(p.code) + "</th>"; }).join("") : "") + "<th>Total loss</th><th>% of loss</th><th>Cumulative</th></tr></thead><tbody>" + M.reasons.map(function (r) { return "<tr><td>" + esc(r.reason) + (r.main ? ' <small style="color:#d64545">main cause</small>' : "") + (r.customerDriven ? " <small>(customer-driven)</small>" : "") + "</td>" + (multi ? M.plants.map(function (p) { return tdd(r.byPlant[p.code] ? inr(r.byPlant[p.code]) : "—"); }).join("") : "") + tdd(inr(r.v)) + tdd(r.share.toFixed(0) + "%") + tdd(r.cum.toFixed(0) + "%") + "</tr>"; }).join("") + "</tbody></table>" + '<div class="note">Internal ' + (T.lossV ? Math.round(M.internalV / T.lossV * 100) : 0) + "% · customer-driven " + (T.lossV ? Math.round(M.customerV / T.lossV * 100) : 0) + "% · reason not entered " + (T.lossV ? Math.round(M.unknownV / T.lossV * 100) : 0) + "%.</div>" : '<div class="note">There is no sales loss in the selected month.</div>' });
    var rows = M.concl.slice(0, 10);
    EX.push({ title: "Conclusion — what to do, where, who and when", std: S(["ISO 9.3.3", "ISO 10.2", "IATF 10.2.3", "VDA P7"]), html: rows.length ? "<table><thead><tr><th>#</th><th>What to do</th><th>Where to focus</th><th>Who</th><th>By when</th><th>Why</th></tr></thead><tbody>" + rows.map(function (x) { return "<tr>" + tdd(x.no) + tdd("<b>" + esc(x.what) + "</b><br><small>" + esc(x.prio) + " priority</small>") + tdd(esc(x.where || "—")) + tdd(esc(x.who) + (x.assigned ? "" : "<br><small>(owner to be named)</small>")) + tdd(fd(x.due)) + tdd(esc(x.why)) + "</tr>"; }).join("") + "</tbody></table>" : '<div class="note">Nothing to conclude: there is no sales loss.</div>' });
    EX.push({ title: "How to handle it — one systemic sequence", std: S(SEQ_STD.map(function (x) { return x[0] + " " + x[1]; })), html: "<table><thead><tr><th>Step</th><th>What is done</th><th>Within</th><th>Standard</th></tr></thead><tbody>" + SEQ.map(function (s, i) { var st = [["ISO 10.2.1", "IATF 10.2.3", "VDA P7"], ["ISO 10.2.2", "ISO 9.1.3"], ["IATF 10.2.3", "ISO 10.2.1"], ["ISO 10.2.1", "IATF 10.2.4"], ["ISO 9.1.3", "ISO 10.2.1"], ["ISO 10.3", "IATF 10.2.5"]][i]; return "<tr>" + tdd("<b>" + (i + 1) + ". " + s[0] + "</b>") + tdd(esc(s[1])) + tdd(s[2]) + tdd(st.join("<br>")) + "</tr>"; }).join("") + '</tbody></table><div class="note">The same six steps are used for every reason, every plant and every person, so the loss is handled the same way everywhere. Each step is recorded in the action plan.</div>' });
    return { period: monthName(M.month) + " · " + (multi ? "all plants (" + M.plants.length + ")" : "plant") + " · day " + upto + " of " + M.days.length, kpis: K, charts: CH, extra: EX };
  }
  function fd(d) { return d ? String(d).slice(0, 10).split("-").reverse().join("-") : "—"; }
  function monthName(m) { return new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }); }

  window.SalesAll = { build: build, presentData: presentData, CFG: CFG, REASON: REASON, SEQ: SEQ, fd: fd, monthName: monthName, addDays: addDays };
})();
