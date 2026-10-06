/* Raw Material Planning — sample data for the demo (?demo=1): the same calls the database functions answer. */
(function () {
  "use strict";
  const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), mth = iso(0).slice(0, 7), id = () => "d" + Math.random().toString(36).slice(2, 10);
  const parts = [
    { code: "DP-1101", name: "Drive Flange", material: "RM-EN8-65", weight_kg: 1.8 }, { code: "DP-1102", name: "Wheel Hub", material: "RM-EN8-65", weight_kg: 2.4 },
    { code: "DP-1103", name: "Gear Housing", material: "RM-EN353-F", weight_kg: 3.1 }, { code: "DP-1104", name: "Pinion Shaft", material: "RM-EN19-45", weight_kg: 0.9 }, { code: "DP-1105", name: "Sleeve", material: "RM-EN19-45", weight_kg: 0.35 }];
  const materials = [{ code: "RM-EN8-65", name: "EN8 bar Ø65", form: "Bar", size: "Ø65 × 3 m", supplier: "SUP-001", rate_per_kg: 74 }, { code: "RM-EN353-F", name: "EN353 forging blank", form: "Forging", size: "Ø110 × 38", supplier: "SUP-002", rate_per_kg: 92 }, { code: "RM-EN19-45", name: "EN19 bar Ø45", form: "Bar", size: "Ø45 × 3 m", supplier: "SUP-001", rate_per_kg: 88 }];
  const suppliers = [{ code: "SUP-001", name: "Coimbatore Steels" }, { code: "SUP-002", name: "Rajkot Forgings" }];
  const stock = [{ material_code: "RM-EN8-65", on_hand_kg: 2400, safety_kg: 800, lead_days: 10, moq_kg: 1000, pack_kg: 250 }, { material_code: "RM-EN353-F", on_hand_kg: 900, safety_kg: 400, lead_days: 21, moq_kg: 2000, pack_kg: 500 }, { material_code: "RM-EN19-45", on_hand_kg: 600, safety_kg: 300, lead_days: 10, moq_kg: 1000, pack_kg: 250 }];
  const bom = [{ id: id(), part_code: "DP-1104", material_code: "RM-EN19-45", rm_kg: null, loss_pct: 4, notes: "Bar end and parting loss" }];
  const demand = {}; demand[mth] = [["DP-1101", 4800, 6], ["DP-1102", 3200, 9], ["DP-1103", 1500, 12], ["DP-1104", 5200, 5], ["DP-1105", 6000, 14]].map((r) => ({ month: mth, part_code: r[0], start_qty: r[1], sales_qty: r[1], need_by: iso(r[2]), source: "capacity", published_at: new Date().toISOString() }));
  const orders = [{ id: id(), material_code: "RM-EN8-65", supplier_code: "SUP-001", month: mth, po_no: "PO-0101", qty_kg: 3000, rate: 74, order_date: iso(-8), due_date: iso(3), status: "ordered", received_kg: null }];
  const drawings = [{ part_code: "DP-1101", rev: "C", od: 42.5, len: 118, items: 24 }, { part_code: "DP-1102", rev: "B", od: 62, len: 74, items: 20 }, { part_code: "DP-1104", rev: "A", od: 24, len: 96, items: 15 }, { part_code: "DP-1105", rev: "A", od: 38, len: 22, items: 10 }];
  let settings = {}; const bomMaster = [];
  window.QP_DEMO = {
    kmr_rmp_settings_save(a) { settings = a.p; return null; },
    kmr_rmp_approve(a) { a.p_rows.forEach((r) => { const code = r.part_code + "/" + r.material_code, i = bomMaster.findIndex((b) => b.code === code), rev = i >= 0 ? (+bomMaster[i].data.revision || 0) + 1 : 1, o = { code, name: "", data: { part_no: r.part_code, material: r.material_code, blank_kg: +r.kg, drawing_rev: r.drawing_rev, basis: r.basis, revision: String(rev), approved_by: "demo@sample", approved_on: iso(0), status: "Approved" } }; if (i >= 0) bomMaster[i] = o; else bomMaster.push(o); }); return a.p_rows.length; },
    kmr_rmp_unapprove(a) { const i = bomMaster.findIndex((b) => b.code === a.p_part + "/" + a.p_material); if (i >= 0) bomMaster.splice(i, 1); return null; },
    kmr_rmp_load(a) { return { bom_master: bomMaster, drawings, settings, parts, materials, suppliers, bom, stock, demand: demand[a.p_month] || [], months: Object.keys(demand), orders, capacity: true, today: iso(0) }; },
    kmr_rmp_bom_save(a) { const p = a.p, r = { id: id(), part_code: p.part_code, material_code: p.material_code, rm_kg: p.rm_kg === "" ? null : +p.rm_kg, loss_pct: +p.loss_pct || 0, notes: p.notes }; const i = bom.findIndex((b) => b.part_code === r.part_code && b.material_code === r.material_code); if (i >= 0) bom[i] = r; else bom.push(r); return r.id; },
    kmr_rmp_bom_delete(a) { const i = bom.findIndex((b) => b.id === a.p_id); if (i >= 0) bom.splice(i, 1); return null; },
    kmr_rmp_stock_save(a) { const p = a.p; let s = stock.find((x) => x.material_code === p.material_code); if (!s) stock.push(s = { material_code: p.material_code, on_hand_kg: 0, safety_kg: 0 }); Object.keys(p).forEach((k) => { if (k !== "material_code") s[k] = p[k] === "" ? null : +p[k]; }); return null; },
    kmr_rmp_demand_save(a) { const L = demand[a.p_month] || (demand[a.p_month] = []); a.p_rows.forEach((r) => { let d = L.find((x) => x.part_code === r.part_code); if (!d) L.push(d = { month: a.p_month, part_code: r.part_code }); Object.assign(d, { start_qty: +r.start_qty || 0, need_by: r.need_by || null, source: "manual", published_at: new Date().toISOString() }); }); return a.p_rows.length; },
    kmr_rmp_demand_clear(a) { demand[a.p_month] = (demand[a.p_month] || []).filter((x) => x.part_code !== a.p_part); return null; },
    kmr_rmp_order_save(a) { const p = a.p; if (!(+p.qty_kg > 0)) throw new Error("Enter the quantity in kg."); let o = p.id && orders.find((x) => x.id === p.id); if (!o) orders.unshift(o = { id: id(), status: "planned", received_kg: null }); Object.assign(o, { material_code: p.material_code, supplier_code: p.supplier_code || null, month: p.month, po_no: p.po_no || null, qty_kg: +p.qty_kg, rate: p.rate === "" ? null : +p.rate, due_date: p.due_date || null }); return o.id; },
    kmr_rmp_order_status(a) { const o = orders.find((x) => x.id === a.p_id); if (!o || ["received", "cancelled"].includes(o.status)) throw new Error("This order is already " + (o && o.status) + "."); o.status = a.p_status; if (a.p_status === "received") { o.received_kg = a.p_received_kg || o.qty_kg; const s = stock.find((x) => x.material_code === o.material_code); s.on_hand_kg += o.received_kg; } return a.p_status; },
    kmr_rmp_order_delete(a) { const i = orders.findIndex((x) => x.id === a.p_id && x.status === "planned"); if (i >= 0) orders.splice(i, 1); return null; }
  };
})();
