/* KMR Apps — Operations Master: one set of master data per customer, shared by every KMR tool.
   Access follows Administration › Users & access (Operations Master: admin / editor / viewer). */
(function () {
  "use strict";
  const T = (k, l, extra) => Object.assign({ k, l }, extra || {});
  const KINDS = [
    { kind: "parts", label: "Parts", icon: "⚙", code: "Part number", name: "Part name", fields: [T("customer", "Customer"), T("drawing_no", "Drawing no."), T("revision", "Revision"), T("material", "Material"), T("weight_kg", "Weight (kg)", { type: "number" }), T("annual_volume", "Annual volume", { type: "number" }), T("status", "Status", { opts: ["Development", "PPAP", "Production", "Obsolete"] })] },
    { kind: "customers", label: "Customers", icon: "🏭", code: "Customer code", name: "Customer name", fields: [T("gstin", "GSTIN / tax ID"), T("city", "City"), T("country", "Country"), T("contact", "Contact person"), T("email", "Email"), T("phone", "Phone"), T("payment_terms", "Payment terms")] },
    { kind: "suppliers", label: "Suppliers", icon: "🚚", code: "Supplier code", name: "Supplier name", fields: [T("category", "Category", { opts: ["Raw material", "Outsourced process", "Consumables", "Tooling", "Gauges & calibration", "Services"] }), T("gstin", "GSTIN / tax ID"), T("city", "City"), T("contact", "Contact person"), T("email", "Email"), T("phone", "Phone"), T("approved", "Approved supplier", { opts: ["Yes", "Conditional", "No"] }), T("rating", "Rating (%)", { type: "number" })] },
    { kind: "machines", label: "Machines", icon: "🛠", code: "Machine code", name: "Machine name", fields: [T("type", "Type", { opts: ["CNC Turning", "VMC", "HMC", "Grinding", "Gear Hobbing", "Broaching", "Press", "Welding", "Assembly", "Inspection", "Other"] }), T("make", "Make"), T("model", "Model"), T("cell", "Cell / line"), T("available_days", "Available days / month (blank = plant standard)", { type: "number" }), T("hours_per_day", "Hours per day (blank = plant standard)", { type: "number" }), T("status", "Status", { opts: ["Running", "Breakdown", "Idle", "Scrapped"] }), T("remarks", "Remarks")] },
    { kind: "gauges", label: "Gauges", icon: "📏", code: "Gauge ID", name: "Gauge name", fields: [T("type", "Type", { opts: ["Vernier", "Micrometer", "Bore gauge", "Plug gauge", "Ring gauge", "Height gauge", "CMM", "Dial", "Other"] }), T("range", "Range"), T("least_count", "Least count"), T("make", "Make"), T("cal_freq_months", "Calibration every (months)", { type: "number" }), T("last_calibrated", "Last calibrated", { type: "date" }), T("next_due", "Next due", { type: "date" }), T("location", "Location")] },
    { kind: "tools", label: "Tools", icon: "🔩", code: "Tool code", name: "Tool name", fields: [T("type", "Type", { opts: ["Insert", "Drill", "Tap", "Reamer", "End mill", "Boring bar", "Fixture", "Die", "Other"] }), T("size", "Size / grade"), T("make", "Make"), T("tool_life", "Tool life (pcs)", { type: "number" }), T("cost", "Cost", { type: "number" }), T("stock", "In stock", { type: "number" })] },
    { kind: "consumables", label: "Consumables", icon: "🧴", code: "Item code", name: "Item name", fields: [T("uom", "Unit"), T("min_stock", "Minimum stock", { type: "number" }), T("rate", "Rate", { type: "number" }), T("supplier", "Supplier")] },
    { kind: "raw_materials", label: "Raw material", icon: "🧱", code: "Material code", name: "Material name", fields: [T("grade", "Grade"), T("specification", "Specification"), T("form", "Form", { opts: ["Bar", "Forging", "Casting", "Sheet", "Tube", "Other"] }), T("size", "Size"), T("supplier", "Supplier"), T("rate_per_kg", "Rate per kg", { type: "number" })] },
    { kind: "rate_contracts", label: "Rate contracts", icon: "📄", code: "Contract no.", name: "Party", fields: [T("party_type", "Party type", { opts: ["Supplier", "Customer"] }), T("item", "Item / part"), T("rate", "Rate", { type: "number" }), T("currency", "Currency"), T("uom", "Unit"), T("valid_from", "Valid from", { type: "date" }), T("valid_to", "Valid to", { type: "date" }), T("terms", "Terms")] },
    { kind: "cycle_times", label: "Cycle times", icon: "⏱", code: "Part + operation", name: "Operation", fields: [T("part_no", "Part number"), T("machine", "Machine"), T("cycle_time_sec", "Cycle time (s)", { type: "number" }), T("alternates", "Alternate machines (comma-separated)"), T("setup_min", "Set-up (min)", { type: "number" }), T("parts_per_cycle", "Parts per cycle", { type: "number" })] },
    { kind: "cft", label: "CFT team & key contacts", icon: "👥", code: "Employee / contact ID", name: "Name", fields: [T("function", "Function", { opts: ["Quality", "Production", "Engineering", "Maintenance", "Purchase", "Stores", "Sales", "Management", "Customer contact", "Supplier contact"] }), T("cft_role", "Role", { opts: ["CFT leader", "CFT member", "Key contact", "Escalation"] }), T("email", "Email"), T("phone", "Phone"), T("organisation", "Organisation (for external contacts)")] },
    { kind: "plant_standards", label: "Plant standards", icon: "🏗", code: "Plant / unit code", name: "Plant name", single: true, fields: [T("oee", "OEE (%)", { type: "number" }), T("hoursPerDay", "Working hours per day", { type: "number" }), T("daysPerMonth", "Working days per month (when no holiday calendar)", { type: "number" }), T("weeklyOff", "Weekly off", { opts: ["Sunday", "Saturday & Sunday", "Friday", "None"] }), T("warnPct", "Warn when machine load is above (%)", { type: "number" }), T("transferLagHours", "Transfer time between operations (h)", { type: "number" }), T("lotSize", "Transfer lot size (pcs)", { type: "number" }), T("levelTargetPct", "Levelling target (%)", { type: "number" })] },
    { kind: "documents", label: "Documents & records", icon: "📚", code: "Document no.", name: "Title", fields: [T("doc_type", "Type", { opts: ["Quality manual", "Policy", "Procedure", "Work instruction", "Form / format", "Record", "Customer-specific requirement", "External standard"] }), T("iatf_clause", "IATF 16949 clause"), T("revision", "Revision"), T("effective_date", "Effective from", { type: "date" }), T("owner", "Owner"), T("review_due", "Review due", { type: "date" })], file: true },
  ];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cols = (K) => [["code", K.code], ["name", K.name], ...K.fields.map((f) => [f.k, f.l])];

  function csvParse(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((c) => c !== "")) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some((c) => c !== "")) rows.push(row);
    return rows;
  }
  const csvCell = (v) => { v = String(v ?? ""); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

  window.KMR_OPS = {
    KINDS,
    /** ctx: { sb, slug, main, dialog, $, role, customerId } */
    async overview(ctx, note) {
      const { data: counts, error } = await ctx.sb.rpc("kmr_ops_counts", { p_slug: ctx.slug });
      const nSample = (counts && counts._sample) || 0, admin = ctx.role === "admin";
      const sampleBar = error ? "" : admin
        ? `<div class="card" style="flex-direction:row;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:16px;border-style:dashed;--c:transparent">
            <div style="flex:1;min-width:240px"><b>Sample data</b><br><small style="color:var(--muted)">${nSample
              ? `${nSample} sample records are loaded, marked <span class="pill">Sample</span> in the lists. Flush removes only these. Records you have edited or imported over are yours and stay.`
              : "Try every list with one ready-made machining plant: 16 parts, 12 machines, 43 cycle times, plant standards, customers, suppliers, raw material, rate contracts, gauges, tools, consumables, CFT team and IATF 16949 documents. Nothing you already have is overwritten, and you can flush it all later."}</small></div>
            ${nSample ? `<button class="btn ghost" id="opsFlush" style="height:42px;color:#B00E28;align-self:center;margin:0">Flush sample data</button>` : `<button class="btn" id="opsLoad" style="height:42px;align-self:center;margin:0">Load sample data</button>`}
          </div>`
        : nSample ? `<p class="sub" style="margin-top:-12px">Includes ${nSample} sample records, marked <span class="pill">Sample</span>.</p>` : "";
      ctx.main.innerHTML = `<h1>Operations Master</h1><p class="sub">One set of master data for your company, used by every KMR app. ${ctx.role === "viewer" ? "You can view it." : "You can add, change and import."}</p>
        ${error ? `<p class="msg">${esc(error.message)}</p>` : ""}
        ${note ? `<div class="card" style="border-color:#1E7B4A;background:#E7F8EF;margin-bottom:12px">${note}</div>` : ""}
        ${sampleBar}
        <div class="cards">${KINDS.map((K) => `<div class="card" style="--c:#0EA5E9;cursor:pointer" data-kind="${K.kind}"><div style="font-size:26px;line-height:1">${K.icon}</div><h3>${esc(K.label)}</h3><p><b style="font-size:22px;color:var(--ink)">${(counts && counts[K.kind]) || 0}</b> records</p></div>`).join("")}</div>`;
      ctx.main.querySelectorAll("[data-kind]").forEach((el) => (el.onclick = () => this.list(ctx, el.dataset.kind)));
      const run = async (btn, rpc, done) => {
        btn.disabled = true; btn.textContent = "Working…";
        const res = await ctx.sb.rpc(rpc, { p_slug: ctx.slug });
        if (res.error) { btn.disabled = false; alert(res.error.message); return this.overview(ctx); }
        this.overview(ctx, done(res.data));
      };
      const load = ctx.main.querySelector("#opsLoad"), flush = ctx.main.querySelector("#opsFlush");
      if (load) load.onclick = () => run(load, "kmr_ops_sample_load", (d) =>
        `<b>Sample data loaded:</b> ${d.added} records added${d.skipped ? `, ${d.skipped} skipped because you already have them` : ""}. The Capacity Planner picks up the machines, routings and plant standards when it next opens.`);
      if (flush) flush.onclick = () => {
        if (!confirm(`Remove the ${nSample} sample records from every list? Your own records are not touched.`)) return;
        run(flush, "kmr_ops_sample_flush", (n) => `<b>Sample data flushed:</b> ${n} records removed. Your own records are unchanged.`);
      };
      window.scrollTo(0, 0);
    },
    async list(ctx, kind, note) {
      const K = KINDS.find((x) => x.kind === kind); const edit = ctx.role === "admin" || ctx.role === "editor";
      ctx.main.innerHTML = `<p><button class="btn ghost" id="opsBack" style="height:36px">← Operations Master</button></p><h1>${K.icon} ${esc(K.label)}</h1><p class="msg">Loading…</p>`;
      ctx.main.querySelector("#opsBack").onclick = () => this.overview(ctx);
      const { data, error } = await ctx.sb.rpc("kmr_ops_list", { p_slug: ctx.slug, p_kind: kind });
      if (error) { ctx.main.querySelector(".msg").textContent = error.message; return; }
      const rows = data || [];
      const shown = [["code", K.code], ["name", K.name], ...K.fields.slice(0, 4).map((f) => [f.k, f.l])];
      ctx.main.innerHTML = `<p><button class="btn ghost" id="opsBack" style="height:36px">← Operations Master</button></p>
        <h1>${K.icon} ${esc(K.label)}</h1><p class="sub">${rows.length} records</p>
        ${note ? `<div class="card" style="border-color:#1E7B4A;background:#E7F8EF;margin-bottom:12px">${note}</div>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <input id="opsQ" placeholder="Search…" style="height:42px;border-radius:12px;border:1px solid #D3DBE6;padding:0 14px;min-width:240px;flex:1">
          ${edit ? `<button class="btn" id="opsAdd" style="height:42px">+ Add</button><label class="btn ghost" style="height:42px;cursor:pointer">Import CSV<input type="file" id="opsImp" accept=".csv,text/csv" hidden></label>` : ""}
          <button class="btn ghost" id="opsExp" style="height:42px">Export CSV</button>
        </div>
        <div class="card" style="padding:0;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#F5F7FB;text-align:left">${shown.map((c) => `<th style="padding:10px 12px;white-space:nowrap">${esc(c[1])}</th>`).join("")}${K.file ? '<th style="padding:10px 12px">File</th>' : ""}<th></th></tr></thead>
          <tbody id="opsBody"></tbody></table></div>`;
      const body = ctx.main.querySelector("#opsBody");
      const val = (r, k) => (k === "code" ? r.code : k === "name" ? r.name : (r.data || {})[k]);
      const draw = (q) => {
        const f = rows.filter((r) => !q || JSON.stringify([r.code, r.name, r.data]).toLowerCase().includes(q.toLowerCase()));
        body.innerHTML = f.map((r) => `<tr style="border-top:1px solid var(--line)${r.active === false ? ";opacity:.5" : ""}">${shown.map((c) => `<td style="padding:9px 12px">${c[0] === "code" ? `<b>${esc(val(r, c[0]))}</b>${r.sample ? ' <span class="pill">Sample</span>' : ""}` : esc(val(r, c[0]) ?? "")}</td>`).join("")}
          ${K.file ? `<td style="padding:9px 12px">${r.data && r.data.file_path ? `<button class="btn ghost" data-file="${esc(r.data.file_path)}" style="height:32px">Open</button>` : '<small style="color:var(--muted)">—</small>'}</td>` : ""}
          <td style="padding:9px 12px;text-align:right"><button class="btn ghost" data-id="${r.id}" style="height:32px">${edit ? "Edit" : "View"}</button></td></tr>`).join("") || `<tr><td colspan="9" style="padding:18px;color:var(--muted)">${rows.length ? "No match." : "No records yet."}</td></tr>`;
        body.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => this.edit(ctx, K, rows.find((r) => r.id === b.dataset.id))));
        body.querySelectorAll("[data-file]").forEach((b) => (b.onclick = async () => { const s = await ctx.sb.storage.from("kmr-docs").createSignedUrl(b.dataset.file, 300); if (s.data) window.open(s.data.signedUrl, "_blank"); }));
      };
      draw("");
      ctx.main.querySelector("#opsQ").oninput = (e) => draw(e.target.value);
      ctx.main.querySelector("#opsBack").onclick = () => this.overview(ctx);
      ctx.main.querySelector("#opsExp").onclick = () => {
        const cs = cols(K); const lines = [cs.map((c) => csvCell(c[1])).join(",")].concat(rows.map((r) => cs.map((c) => csvCell(val(r, c[0]))).join(",")));
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv" })); a.download = `${K.kind}.csv`; a.click();
      };
      if (edit) {
        ctx.main.querySelector("#opsAdd").onclick = () => this.edit(ctx, K, null);
        ctx.main.querySelector("#opsImp").onchange = async (e) => {
          const file = e.target.files[0]; if (!file) return;
          const grid = csvParse((await file.text()).replace(/^\ufeff/, "")); if (grid.length < 2) return alert("The file has no rows.");
          const cs = cols(K), head = grid[0].map((h) => h.trim().toLowerCase());
          const idx = cs.map((c) => { let i = head.indexOf(c[1].toLowerCase()); if (i < 0) i = head.indexOf(c[0]); return i; });
          if (idx[0] < 0) return alert(`The first row must contain the column "${K.code}". Tip: use Export CSV to get the right columns.`);
          const out = grid.slice(1).map((g) => { const r = { code: (g[idx[0]] || "").trim(), name: idx[1] >= 0 ? (g[idx[1]] || "").trim() : "", data: {} };
            cs.slice(2).forEach((c, j) => { const i = idx[j + 2]; if (i >= 0 && g[i] !== undefined && g[i] !== "") r.data[c[0]] = g[i].trim(); }); return r; }).filter((r) => r.code);
          const res = await ctx.sb.rpc("kmr_ops_save", { p_slug: ctx.slug, p_kind: K.kind, p_rows: out });
          if (res.error) return alert(res.error.message);
          this.list(ctx, K.kind, `<b>Imported ${res.data} records.</b> Existing codes were updated, new ones added.`);
        };
      }
      window.scrollTo(0, 0);
    },
    edit(ctx, K, r) {
      const edit = ctx.role === "admin" || ctx.role === "editor"; const isNew = !r; r = r || { code: "", name: "", data: {}, active: true };
      const input = (f, v) => f.opts ? `<select id="of_${f.k}" ${edit ? "" : "disabled"}><option value=""></option>${f.opts.map((o) => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : `<div class="in"><input id="of_${f.k}" type="${f.type || "text"}" value="${esc(v ?? "")}" ${edit ? "" : "readonly"}></div>`;
      ctx.dialog(isNew ? `Add — ${K.label}` : `${esc(r.code)} · ${K.label}`, `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 14px;max-height:62vh;overflow:auto;padding-right:4px">
          <label class="f">${esc(K.code)}${input({ k: "code" }, r.code)}</label><label class="f">${esc(K.name)}${input({ k: "name" }, r.name)}</label>
          ${K.fields.map((f) => `<label class="f">${esc(f.l)}${input(f, (r.data || {})[f.k])}</label>`).join("")}
          ${K.file ? `<label class="f" style="grid-column:1/-1">File (PDF, Word, Excel — up to 25 MB)${r.data && r.data.file_path ? `<small style="display:block;color:var(--muted);text-transform:none;letter-spacing:0">Current: ${esc(r.data.file_name || "attached")}</small>` : ""}${edit ? '<input type="file" id="of_file" style="margin-top:6px">' : ""}</label>` : ""}
          <label style="display:flex;gap:8px;align-items:center;grid-column:1/-1;margin:4px 0 10px"><input type="checkbox" id="of_active" ${r.active !== false ? "checked" : ""} ${edit ? "" : "disabled"}> In use (untick to keep the record but hide it from new work)</label>
        </div>${r.sample && edit ? '<p style="font-size:13px;color:var(--muted);margin:0 0 8px">This is a sample record. Once you save it, it becomes your own record and <b>Flush sample data</b> leaves it alone.</p>' : ""}<span class="msg" id="ofM"></span>`,
        edit ? `<button class="btn" id="ofSave">Save</button>${isNew ? "" : '<button class="btn ghost" id="ofDel" style="color:#B00E28">Delete</button>'}` : "");
      const dlg = document.querySelector(".veil .dlg"); if (dlg) dlg.style.maxWidth = "760px";   // two-column master forms need room
      if (!edit) return;
      const $ = (s) => document.querySelector(s);
      $("#ofSave").onclick = async () => {
        const m = $("#ofM"); m.className = "msg"; m.textContent = "Saving…";
        const data = Object.assign({}, r.data || {}); K.fields.forEach((f) => { const v = $("#of_" + f.k).value.trim(); if (v) data[f.k] = v; else delete data[f.k]; });
        const code = $("#of_code").value.trim(); if (!code) { m.textContent = `${K.code} is required.`; return; }
        const file = K.file && $("#of_file") && $("#of_file").files[0];
        if (file) {
          if (file.size > 25 * 1024 * 1024) { m.textContent = "The file must be under 25 MB."; return; }
          const path = `customers/${ctx.customerId}/documents/${code.replace(/[^A-Za-z0-9._-]+/g, "_")}-${Date.now()}.${(file.name.split(".").pop() || "bin").toLowerCase()}`;
          const up = await ctx.sb.storage.from("kmr-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
          if (up.error) { m.textContent = "Upload failed: " + up.error.message; return; }
          data.file_path = path; data.file_name = file.name;
        }
        const res = await ctx.sb.rpc("kmr_ops_save", { p_slug: ctx.slug, p_kind: K.kind, p_rows: [Object.assign(isNew ? {} : { id: r.id }, { code, name: $("#of_name").value.trim(), data, active: $("#of_active").checked })] });
        if (res.error) { m.textContent = /duplicate|unique/.test(res.error.message) ? `${K.code} "${code}" already exists.` : res.error.message; return; }
        document.querySelector(".veil")?.remove(); this.list(ctx, K.kind, `<b>Saved</b> ${esc(code)}.`);
      };
      if ($("#ofDel")) $("#ofDel").onclick = async () => {
        if (!confirm(`Delete ${r.code}? Tools that used it keep their own copy of past work.`)) return;
        const res = await ctx.sb.rpc("kmr_ops_delete", { p_slug: ctx.slug, p_kind: K.kind, p_id: r.id });
        if (res.error) { $("#ofM").textContent = res.error.message; return; }
        document.querySelector(".veil")?.remove(); this.list(ctx, K.kind, `<b>Deleted</b> ${esc(r.code)}.`);
      };
    },
  };
})();
