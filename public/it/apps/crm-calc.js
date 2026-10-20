/* CRM & RFQ - arithmetic shared by the screens, the printed forms and the sample (demo) data.
   The database does the same sums when it saves (console.crm_cost / console.crm_totals, migration 0079), so what you see while typing is what is stored.
   Costing of one part, per piece (nothing is ever negative):
     material  = weight x rate x (1 + scrap %) + other material
     process   = sum of (minutes x rate per hour / 60)
     outsourced, tooling (tool cost / pieces the tool will make), packing, freight, other
     cost      = the sum;  overhead = cost x overhead %;  price = (cost + overhead) x (1 + margin %), or the price typed in */
(function (root) {
  "use strict";
  const num = (v) => { const s = String(v == null ? "" : v).trim(); if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const pos = (v) => Math.max(num(v) == null ? 0 : num(v), 0);
  /* round half away from zero on the decimal value (same as the database), without binary float noise */
  const rnd = (x, d) => { if (!Number.isFinite(x)) return 0; const s = Number(x.toPrecision(15)), neg = s < 0, a = Math.abs(s), t = Number(String(a).includes("e") ? a : a + "e" + d); const r = Number(Math.round(t) + "e-" + d); return neg ? -r : r; };
  const arr = (v) => (Array.isArray(v) ? v : []);

  function cost(c) {
    c = c && typeof c === "object" && !Array.isArray(c) ? c : {};
    const mat = pos(c.mat_wt) * pos(c.mat_rate) * (1 + pos(c.scrap_pct) / 100) + pos(c.mat_other);
    const prc = arr(c.ops).reduce((s, o) => s + (pos(o && o.min) * pos(o && o.rate)) / 60, 0);
    const outs = arr(c.outs).reduce((s, o) => s + pos(o && o.amt), 0);
    const tool = pos(c.tool_qty) > 0 ? pos(c.tool_cost) / pos(c.tool_qty) : 0;
    const pack = pos(c.packing), frt = pos(c.freight), oth = pos(c.other);
    const total = mat + prc + outs + tool + pack + frt + oth, oh = (total * pos(c.oh_pct)) / 100, base = total + oh;
    const calc = base * (1 + pos(c.margin_pct) / 100), ov = pos(c.price_override), price = rnd(ov > 0 ? ov : calc, 2);
    return { material: rnd(mat, 4), process: rnd(prc, 4), outsourced: rnd(outs, 4), tooling: rnd(tool, 4), packing: rnd(pack, 4), freight: rnd(frt, 4), other: rnd(oth, 4),
      cost: rnd(total, 4), overhead: rnd(oh, 4), total_cost: rnd(base, 4), price_calc: rnd(calc, 2), price };
  }
  /* profit on the selling price: amount per piece and % of the price */
  function profit(c) { const k = cost(c), p = k.price - k.total_cost; return { amount: rnd(p, 2), pct: k.price > 0 ? rnd((p / k.price) * 100, 1) : 0 }; }
  function totals(lines, taxPct) {
    const sub = arr(lines).reduce((s, l) => s + rnd(pos(l && l.qty) * pos(l && l.unit_price), 2), 0), tax = rnd((sub * Math.max(num(taxPct) || 0, 0)) / 100, 2);
    return { sub: rnd(sub, 2), tax, tot: rnd(sub + tax, 2) };
  }
  /* supplier prices for one part: lowest price among those still valid, with the warnings a buyer needs */
  function compare(quotes, qty, today) {
    const q = arr(quotes).map((s) => {
      const flags = [];
      if (s.moq != null && qty != null && Number(s.moq) > Number(qty)) flags.push("MOQ " + Number(s.moq).toLocaleString("en-IN") + " is above the order quantity");
      if (s.valid_until && today && String(s.valid_until).slice(0, 10) < today) flags.push("price validity has passed");
      return Object.assign({}, s, { flags });
    });
    const ok = q.filter((s) => !s.flags.some((f) => /validity/.test(f)));
    const low = (ok.length ? ok : q).reduce((m, s) => (m == null || Number(s.price) < Number(m.price) ? s : m), null);
    const hi = q.reduce((m, s) => Math.max(m, Number(s.price)), 0);
    return { rows: q, best: low ? low.id : null, spread: q.length > 1 && low ? rnd(hi - Number(low.price), 4) : 0 };
  }
  const inr = (n, d) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const money = (n) => "₹ " + inr(n, 2);
  const lakh = (n) => { n = Number(n || 0); const a = Math.abs(n); return a >= 1e7 ? "₹ " + (n / 1e7).toFixed(2) + " Cr" : a >= 1e5 ? "₹ " + (n / 1e5).toFixed(2) + " L" : "₹ " + inr(n, 0); };
  const words = (n) => {                                                                                // Indian numbering, rupees and paise
    const a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"], b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "")), three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
    const whole = Math.floor(Math.abs(n) + 1e-9), paise = Math.round((Math.abs(n) - whole) * 100), parts = [];
    const cr = Math.floor(whole / 1e7), lk = Math.floor((whole % 1e7) / 1e5), th = Math.floor((whole % 1e5) / 1e3), rest = whole % 1e3;
    if (cr) parts.push(three(cr) + " crore"); if (lk) parts.push(two(lk) + " lakh"); if (th) parts.push(two(th) + " thousand"); if (rest) parts.push(three(rest));
    let s = parts.length ? parts.join(" ") : "zero"; s = "Rupees " + s;
    if (paise) s += " and " + two(paise) + " paise";
    return s.charAt(0).toUpperCase() + s.slice(1) + " only";
  };
  const blankCost = (d) => ({ mat_wt: "", mat_rate: "", scrap_pct: "", mat_other: "", ops: [{ name: "", min: "", rate: "" }], outs: [], tool_cost: "", tool_qty: "", packing: "", freight: "", other: "", oh_pct: d && d.oh_pct != null ? d.oh_pct : "", margin_pct: d && d.margin_pct != null ? d.margin_pct : "", price_override: "" });
  const api = { num, pos, rnd, cost, profit, totals, compare, inr, money, lakh, words, blankCost };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CRMCalc = api;
})(typeof window !== "undefined" ? window : globalThis);
