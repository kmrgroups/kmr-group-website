/* Material Movement — printable formats: QR tag (RM / OK / rejection / rework), the process data table, delivery challan (DC), goods receipt note (GRN).
   Every document carries its own number as a QR code; scanning it opens the next screen. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const D = (v) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const Tm = (v) => (v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
  const N = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 }));
  const qr = (text, cell) => {
    try { const q = window.qrcode(0, "M"); q.addData(String(text)); q.make(); return q.createSvgTag({ cellSize: cell || 3, margin: 0, scalable: true }); }
    catch (e) { return `<div class="qrx">${esc(text)}</div>`; }
  };
  const KIND = { RM: ["RAW MATERIAL TAG", "#1d4ed8"], OK: ["OK PARTS TAG", "#15803d"], REJ: ["REJECTION TAG", "#b91c1c"], REW: ["REWORK TAG", "#b45309"] };
  const row = (k, v, w) => `<div class="f${w ? " w" : ""}"><span>${k}</span><b>${v}</b></div>`;

  /* tj = { tag, rs, progress, op, parent, entry } as answered by kmr_mmd_tag / the entry calls */
  function tag(tj, co) {
    const t = tj.tag, rs = tj.rs, e = tj.entry, k = KIND[t.kind] || KIND.OK, ops = rs.ops || [];
    const done = t.op_done ? (ops[t.op_done - 1] || {}).name : "", nxt = t.seq ? (ops[t.seq - 1] || {}).name : "", at = e ? e.entry_at : t.created_at;
    let body = "";
    if (t.kind === "RM") {
      body = row("RM code", esc(rs.rm_material)) + row("Size", esc(rs.rm_size || "—")) + row("Specification", esc(rs.rm_spec || "—"), 1) + row("Heat code", esc(rs.heat_code)) + row("Qty", N(t.qty) + " pcs" + (rs.rm_kg ? " · " + N(rs.rm_kg) + " kg" : ""))
        + row("Released to part", esc(rs.part_code)) + row("Part name", esc(rs.part_name || "")) + row("Customer", esc(rs.customer_name || "—"), 1) + row("Qty to be produced", N(rs.qty)) + row("Route sheet", esc(rs.rs_no))
        + row("Mill cert", esc(rs.mill_cert || "—")) + row("Issued", D(t.created_at) + " " + Tm(t.created_at)) + row("Next", esc(nxt || "—"), 1);
    } else if (t.kind === "OK") {
      body = row("Part code", esc(rs.part_code)) + row("Part name", esc(rs.part_name || "")) + row("Customer", esc(rs.customer_name || "—"), 1) + row("Route sheet", esc(rs.rs_no)) + row("Heat code", esc(rs.heat_code)) + row("OK qty", `<big>${N(t.qty)}</big> pcs`)
        + row("Completed", esc(done || "—"), 1) + row("Goes to", t.loc === "fg" ? "<u>FINISHED GOODS</u>" : esc(nxt || "—"), 1) + row("Date", D(at)) + row("Time", Tm(at)) + row("Shift", esc((e && e.shift) || "—")) + row("Operator", esc((e && e.operator) || "—")) + row("MMD engineer", esc((e && e.engineer) || "—"), 1);
    } else {
      body = row("Reason", esc(t.reason || "—"), 1) + row("Specification", `<big>${esc(t.spec || "—")}</big>`) + row("Actual", `<big>${esc(t.actual || "—")}</big>`) + row("Qty", `<big>${N(t.qty)}</big> pcs`) + row("Route sheet", esc(rs.rs_no))
        + row("Part code", esc(rs.part_code)) + row("Part name", esc(rs.part_name || "")) + row("Customer", esc(rs.customer_name || "—"), 1) + row("Found at", esc(done || "—"), 1) + row("Machine", esc((e && e.machine) || "—")) + row("Operator", esc((e && e.operator) || "—"))
        + row("Date", D(at)) + row("Time", Tm(at)) + row("Shift", esc((e && e.shift) || "—")) + row("MMD engineer", esc((e && e.engineer) || "—")) + row("Heat code", esc(rs.heat_code))
        + (t.kind === "REJ" ? row("Disposition", esc(t.dispo || "Awaiting decision"), 1) : row("Rework", "Scan this tag to enter the result", 1));
    }
    return `<div class="tag" style="--c:${k[1]}"><div class="th"><b>${k[0]}</b><span>${esc(co || "")}</span></div><div class="tb"><div class="qr">${qr(t.tag_no)}<small>${esc(t.tag_no)}</small></div><div class="fs">${body}</div></div>
      <div class="tf"><span>${tj.parent ? "From tag " + esc(tj.parent) : "First tag of the route sheet"}</span><span>Heat ${esc(rs.heat_code)}</span></div></div>`;
  }

  /* the process data table: every operation of the route, with route-sheet quantity, cumulative, balance */
  function table(tj, co) {
    const rs = tj.rs, e = tj.entry, pr = tj.progress || [];
    const head = `<div class="hd"><div><h3>PROCESS DATA TABLE</h3><div class="mut">${esc(co || "")}</div></div><div class="qr s">${qr(rs.rs_no)}<small>${esc(rs.rs_no)}</small></div></div>
      <div class="meta">${row("Part number", esc(rs.part_code))}${row("Part name", esc(rs.part_name || ""))}${row("Customer", esc(rs.customer_name || "—"))}${row("Route sheet no.", esc(rs.rs_no))}${row("Route sheet qty", N(rs.qty))}${row("Heat code", esc(rs.heat_code))}
        ${e ? row("Date", D(e.entry_at)) + row("Time", Tm(e.entry_at)) + row("Shift", esc(e.shift || "—")) + row("Operator", esc(e.operator || "—")) + row("MMD engineer", esc(e.engineer || "—")) + row("This entry (OK / Rej / Rew)", `${N(e.ok_qty)} / ${N(e.rej_qty)} / ${N(e.rew_qty)}`) : ""}</div>`;
    const rows = pr.map((o) => { const bal = Math.max(0, o.rs_qty - o.ok - o.rej), cur = e && e.seq === o.seq;
      return `<tr${cur ? ' class="cur"' : ""}><td>${o.seq}</td><td>${esc(o.name)}${o.type === "supplier" ? " <i>(supplier)</i>" : ""}</td><td>${esc(o.machine || "")}</td><td class="n">${N(o.rs_qty)}</td><td class="n">${N(o.ok)}</td><td class="n">${N(o.rej)}</td><td class="n">${N(o.rew)}</td><td class="n"><b>${N(bal)}</b></td></tr>`; }).join("");
    return `<div class="dt">${head}<table><thead><tr><th>#</th><th>Operation</th><th>Machine</th><th class="n">Route sheet qty</th><th class="n">Cumulative OK</th><th class="n">Rejected</th><th class="n">Rework</th><th class="n">Balance</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sg"><span>Operator</span><span>MMD engineer</span><span>Quality</span></div><div class="mut" style="font-size:10px">Balance = route sheet qty − cumulative OK − rejected, per operation. Printed ${D(new Date())} ${Tm(new Date())}</div></div>`;
  }

  /* delivery challan for a supplier (job-work) process; the QR carries the DC number, the previous tag is printed on it */
  function dc(d, co, rs, prevTag, sup) {
    return `<div class="doc"><div class="hd"><div><h2>DELIVERY CHALLAN</h2><div><b>${esc(co || "")}</b></div><div class="mut">Goods sent for job work — not a sale</div></div><div class="qr">${qr(d.dc_no)}<small>${esc(d.dc_no)}</small></div></div>
      <div class="meta">${row("DC no.", esc(d.dc_no))}${row("Date", D(d.dispatch_at))}${row("Time", Tm(d.dispatch_at))}${row("Vehicle", esc(d.vehicle || "—"))}${row("Expected back", D(d.expected_date))}${row("Route sheet", esc(rs.rs_no))}</div>
      <div class="meta">${row("To (supplier)", esc((d.supplier_name || d.supplier_code || "") + ((sup && sup.address) ? ", " + sup.address : "")), 1)}${row("Process to be done", esc(d.op_name), 1)}</div>
      <table><thead><tr><th>#</th><th>Part number</th><th>Description</th><th>Material / heat code</th><th>Previous tag</th><th class="n">Qty (pcs)</th></tr></thead><tbody><tr><td>1</td><td>${esc(rs.part_code)}</td><td>${esc(rs.part_name || "")}</td><td>${esc(rs.rm_material || "")} / ${esc(rs.heat_code)}</td><td>${esc(prevTag || "")}</td><td class="n"><b>${N(d.qty)}</b></td></tr></tbody></table>
      ${d.note ? `<p>Remarks: ${esc(d.note)}</p>` : ""}<p class="mut" style="font-size:11px">Return the material with the same DC number on your delivery note. On receipt the DC QR is scanned and a goods receipt note is made.</p>
      <div class="sg"><span>Prepared by</span><span>Authorised signatory</span><span>Received by supplier</span></div></div>`;
  }

  function grn(g, d, co, rs, rejLines) {
    const rl = (rejLines || []).filter((l) => +l.qty > 0);
    return `<div class="doc"><div class="hd"><div><h2>GOODS RECEIPT NOTE</h2><div><b>${esc(co || "")}</b></div><div class="mut">Job-work material received</div></div><div class="qr">${qr(g.grn_no)}<small>${esc(g.grn_no)}</small></div></div>
      <div class="meta">${row("GRN no.", esc(g.grn_no))}${row("Date", D(g.received_at))}${row("Time", Tm(g.received_at))}${row("Against DC", esc(d.dc_no))}${row("Supplier", esc(d.supplier_name || d.supplier_code || ""))}${row("Supplier invoice / DC", esc(g.inv_no || "—"))}</div>
      <table><thead><tr><th>Part number</th><th>Description</th><th>Process done</th><th>Route sheet</th><th class="n">Sent on DC</th><th class="n">Received OK</th><th class="n">Rejected</th><th class="n">Still pending</th></tr></thead>
      <tbody><tr><td>${esc(rs.part_code)}</td><td>${esc(rs.part_name || "")}</td><td>${esc(d.op_name)}</td><td>${esc(rs.rs_no)}</td><td class="n">${N(d.qty)}</td><td class="n"><b>${N(g.ok_qty)}</b></td><td class="n">${N(g.rej_qty)}</td><td class="n">${N(Math.max(0, d.qty - d.received_qty))}</td></tr></tbody></table>
      ${rl.length ? `<p><b>Rejected at receipt</b></p><table><thead><tr><th>Reason</th><th>Specification</th><th>Actual</th><th class="n">Qty</th></tr></thead><tbody>${rl.map((l) => `<tr><td>${esc(l.reason || l.code || "")}</td><td>${esc(l.spec || "")}</td><td>${esc(l.actual || "")}</td><td class="n">${N(l.qty)}</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="sg"><span>Received by</span><span>Quality check</span><span>Stores</span></div></div>`;
  }

  window.MMDPrint = { tag, table, dc, grn, qr, D, Tm, N };
})();
