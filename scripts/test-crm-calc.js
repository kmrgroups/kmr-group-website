/* Checks of the CRM & RFQ arithmetic against hand calculations. The database repeats the same sums (console.crm_cost / crm_totals, migration 0079).
   Run: node scripts/test-crm-calc.js */
const C = require("../public/it/apps/crm-calc.js");
let fails = 0; const eq = (a, b, name) => { if (a !== b) { fails++; console.log("FAIL", name, "got", a, "expected", b); } };
const ok = (c, name) => { if (!c) { fails++; console.log("FAIL", name); } };
// worked example, per piece: material 0.5 kg x 70 x 1.10 = 38.50; machining 2.4 min @ 500/h = 20 and 1.5 min @ 400/h = 10; tooling 20000/10000 = 2; packing 1.5; freight 1
// cost 73.00; overhead 10% = 7.30; total cost 80.30; margin 15% -> 92.345 -> 92.35 (half rounds up)
const c = { mat_wt: 0.5, mat_rate: 70, scrap_pct: 10, ops: [{ min: 2.4, rate: 500 }, { min: 1.5, rate: 400 }], tool_cost: 20000, tool_qty: 10000, packing: 1.5, freight: 1, oh_pct: 10, margin_pct: 15 };
let k = C.cost(c);
eq(k.material, 38.5, "material"); eq(k.process, 30, "process"); eq(k.tooling, 2, "tooling"); eq(k.cost, 73, "cost"); eq(k.overhead, 7.3, "overhead"); eq(k.total_cost, 80.3, "total cost"); eq(k.price, 92.35, "price rounds half up");
eq(C.profit(c).amount, 12.05, "profit amount"); eq(C.profit(c).pct, 13.0, "profit % of price");
// a chosen supplier price of 5.50 (outsourced) -> cost 78.50, overhead 7.85, 86.35 x 1.15 = 99.3025 -> 99.30
k = C.cost(Object.assign({}, c, { outs: [{ name: "x", amt: 5.5 }] })); eq(k.total_cost, 86.35, "total with supplier"); eq(k.price, 99.3, "price with supplier");
// price typed in wins; blanks and negatives count as zero
eq(C.cost(Object.assign({}, c, { price_override: 100 })).price, 100, "override");
eq(C.cost({ mat_wt: -5, mat_rate: 10 }).cost, 0, "negative is zero"); eq(C.cost({}).price, 0, "empty costing"); eq(C.cost(null).price, 0, "null costing"); eq(C.cost({ tool_cost: 100, tool_qty: 0 }).tooling, 0, "no tool quantity");
eq(C.cost({ mat_wt: "1,5", mat_rate: 10 }).material, 0, "text with comma is not a number");
// quotation totals: each line rounded to paise, then tax
let t = C.totals([{ qty: 1000, unit_price: 106.89 }], 18); eq(t.sub, 106890, "sub"); eq(t.tax, 19240.2, "tax"); eq(t.tot, 126130.2, "total");
t = C.totals([{ qty: 3, unit_price: 0.335 }, { qty: 3, unit_price: 0.335 }], 0); eq(t.sub, 2.02, "lines rounded one by one (1.005 + 1.005 -> 1.01 + 1.01)");
eq(C.totals([], 18).tot, 0, "no lines");
// amount in words (Indian numbering)
eq(C.words(126130.2), "Rupees one lakh twenty six thousand one hundred thirty and twenty paise only", "words");
eq(C.words(0), "Rupees zero only", "words zero"); eq(C.words(10000000), "Rupees one crore only", "words crore"); eq(C.words(1.05), "Rupees one and five paise only", "words paise");
eq(C.inr(1234567.5), "12,34,567.50", "indian grouping"); eq(C.lakh(250000), "₹ 2.50 L", "lakh"); eq(C.lakh(25000000), "₹ 2.50 Cr", "crore");
// supplier comparison: lowest valid price, MOQ and validity warnings
const q = [{ id: "a", price: 6.2, moq: 5000, valid_until: "2026-12-01" }, { id: "b", price: 7.1, moq: 2000, valid_until: "2026-12-01" }, { id: "c", price: 5.0, moq: 100, valid_until: "2026-01-01" }];
let m = C.compare(q, 3000, "2026-10-20"); eq(m.best, "a", "expired price 5.00 is not 'best'; the cheapest price still valid is (its MOQ is only flagged)"); ok(m.rows[0].flags.some((f) => /MOQ/.test(f)), "MOQ flag"); ok(m.rows[2].flags.some((f) => /validity/.test(f)), "validity flag"); eq(m.spread, 0.9, "spread");
eq(C.compare([], 10, "2026-10-20").best, null, "no quotes");
console.log(fails ? fails + " FAILED" : "all CRM calculation checks passed"); process.exit(fails ? 1 : 0);
