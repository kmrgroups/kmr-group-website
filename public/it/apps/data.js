/* KMR Apps — Data Master (company administrators): each app's data — JSON download, JSON upload (restore) and
   Flush all data (a JSON backup is downloaded automatically first). Logins, users and access are never removed. */
(function () {
  "use strict";
  const APPS = {
    hrm: { name: "HRM Suite", color: "#0EA5E9", what: "Employees, attendance, leave, payroll, loans, ID cards, onboarding and documents." },
    balloon: { name: "Balloon Inspector", color: "#A855F7", what: "Ballooned drawings and inspection reports (drawing files are kept so a restore brings them back)." },
    pd: { name: "Process Documents", color: "#F59E0B", what: "Projects (PFD, PFMEA, control plan, SOP …) and the workspace’s own lists." },
    capacity: { name: "Capacity Planner", color: "#10B981", what: "Monthly plans (quantities, due dates, machine days) and saved versions." },
    sales: { name: "Sales Flow", color: "#E11D48", what: "Monthly plan lines, daily despatch, loss reasons and action plans." },
    apqp: { name: "APQP Planner", color: "#0891B2", what: "APQP programmes and their phase deliverables, owners, due dates and gate sign-offs." },
    ppap: { name: "PPAP Submissions", color: "#B45309", what: "PPAP submissions: level, the 18 elements and the Part Submission Warrant." },
    calib: { name: "Calibration Hub", color: "#6366F1", what: "Instruments, calibration records, gauge history, out-of-tolerance cases and MSA studies." },
    ops: { name: "Operations Master", color: "#0EA5E9", what: "Parts, customers, suppliers, machines, gauges, tools, consumables, cycle times, CFT, standards and documents." },
  };
  const LABEL = {
    employees: "employees", attendance_days: "attendance days", leave_requests: "leave requests", payroll_runs: "payroll months", loans: "loans",
    id_cards: "ID cards", onboarding_invites: "onboarding", bi_reports: "reports", pd_projects: "projects", pd_masters: "own lists",
    cp_plans: "plan", cp_history: "saved versions", ops_records: "records",
    sf_lines: "plan lines", sf_despatch: "despatch days", sf_actions: "action plans",
    apqp_projects: "programmes", apqp_items: "deliverables", ppap_submissions: "submissions", cal_instruments: "instruments", cal_records: "calibrations", cal_events: "history events", cal_oot: "OOT cases", cal_msa: "MSA studies",
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };
  function save(json, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: "application/json" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  window.KMR_DATA = {
    /** ctx: { sb, slug, main, dialog } */
    async overview(ctx, note) {
      ctx.main.innerHTML = `<h1>Data Master</h1><p class="sub">Every app’s data in one place: download a JSON copy, restore one, or flush an app clean. Logins, users and access are never removed.</p><p class="msg">Loading…</p>`;
      const { data, error } = await ctx.sb.rpc("kmr_data_overview", { p_slug: ctx.slug });
      if (error) { ctx.main.querySelector(".msg").textContent = error.message; return; }
      const list = (data || []).filter((a) => APPS[a.app]);
      ctx.main.innerHTML = `<h1>Data Master</h1><p class="sub">Every app’s data in one place: download a JSON copy, restore one, or flush an app clean. Logins, users and access are never removed.</p>
        ${note ? `<div class="card" style="border-color:#1E7B4A;background:#E7F8EF;margin-bottom:14px">${note}</div>` : ""}
        <div class="cards">${list.map((a) => {
          const M = APPS[a.app], det = Object.entries(a.detail || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${LABEL[k] || k.replace(/_/g, " ")}`).join(" · ");
          return `<div class="card" style="--c:${M.color}">
            <h3>${esc(M.name)}</h3><p>${esc(M.what)}</p>
            <div class="kpis"><div><b>${a.records}</b><small>records</small></div></div>
            <p style="font-size:12.5px;color:var(--muted);min-height:18px">${esc(det || "No data")}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">
              <button class="btn ghost" data-dl="${a.app}" style="height:38px">Download JSON</button>
              <label class="btn ghost" style="height:38px;cursor:pointer">Upload JSON<input type="file" accept=".json,application/json" data-up="${a.app}" hidden></label>
              <button class="btn ghost" data-flush="${a.app}" style="height:38px;color:#B00E28" ${a.records ? "" : "disabled"}>Flush all data</button>
            </div></div>`;
        }).join("")}</div>
        <p class="sub" style="margin-top:18px">Flush always downloads a JSON backup first, then removes the data. Upload that file here to bring everything back.</p>`;
      ctx.main.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => this.download(ctx, b.dataset.dl, b)));
      ctx.main.querySelectorAll("[data-up]").forEach((i) => (i.onchange = (e) => this.upload(ctx, i.dataset.up, e.target.files[0], i)));
      ctx.main.querySelectorAll("[data-flush]").forEach((b) => (b.onclick = () => this.confirmFlush(ctx, b.dataset.flush, list.find((x) => x.app === b.dataset.flush))));
      window.scrollTo(0, 0);
    },
    async backup(ctx, app) {
      const { data, error } = await ctx.sb.rpc("kmr_data_export", { p_slug: ctx.slug, p_app: app });
      if (error) throw error;
      const name = `${ctx.slug}-${app}-backup-${stamp()}.json`;
      save(data, name);
      return name;
    },
    async download(ctx, app, btn) {
      const t = btn.textContent; btn.disabled = true; btn.textContent = "Preparing…";
      try { await this.backup(ctx, app); } catch (e) { alert(e.message || e); }
      btn.disabled = false; btn.textContent = t;
    },
    confirmFlush(ctx, app, info) {
      const M = APPS[app];
      ctx.dialog(`Flush all data — ${M.name}`, `
        <p><b>${info ? info.records : ""} records</b> will be removed: ${esc(M.what)}</p>
        ${app === "hrm" ? `<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0"><input type="checkbox" id="dmSetup"> <span>Also reset the company setup — plants, departments, designations, shifts, leave types, holidays and payroll rules go back to the defaults.</span></label>` : ""}
        <p>First a JSON backup is <b>downloaded to this computer</b>; then the data is removed. Keep the file — uploading it here restores everything.</p>
        <label class="f">Type FLUSH to confirm<div class="in"><input id="dmConfirm" autocomplete="off" placeholder="FLUSH"></div></label><span class="msg" id="dmMsg"></span>`,
        `<button class="btn" id="dmGo" style="background:#B00E28">Download backup &amp; flush</button>`);
      const go = document.getElementById("dmGo");
      go.onclick = async () => {
        const m = document.getElementById("dmMsg");
        if ((document.getElementById("dmConfirm").value || "").trim().toUpperCase() !== "FLUSH") { m.textContent = "Type FLUSH to confirm."; return; }
        go.disabled = true; go.textContent = "Downloading backup…";
        let file;
        try { file = await this.backup(ctx, app); } catch (e) { go.disabled = false; go.textContent = "Download backup & flush"; m.textContent = `Backup failed, nothing was removed: ${e.message || e}`; return; }
        go.textContent = "Flushing…";
        const setup = !!(document.getElementById("dmSetup") || {}).checked;
        const { data, error } = await ctx.sb.rpc("kmr_data_flush", { p_slug: ctx.slug, p_app: app, p_hrm_setup: setup });
        if (error) { go.disabled = false; go.textContent = "Download backup & flush"; m.textContent = `Backup saved (${file}), but the flush failed: ${error.message}`; return; }
        document.querySelectorAll(".veil").forEach((v) => v.remove());
        const n = data && (data.removed ?? data.employees);
        this.overview(ctx, `<b>${esc(M.name)} flushed.</b> ${n != null ? `${n} ${app === "hrm" ? "employees and everything linked to them" : "records"} removed${setup ? "; company setup reset to defaults" : ""}.` : ""} Backup downloaded: <b>${esc(file)}</b>. Upload it here to restore.`);
      };
    },
    async upload(ctx, app, file, input) {
      if (!file) return;
      const M = APPS[app];
      try {
        let json; try { json = JSON.parse(await file.text()); } catch { throw new Error("That file is not valid JSON."); }
        if (json.format !== "kmr-app-data") throw new Error("This is not a Data Master backup file.");
        if (json.app !== app) throw new Error(`This file is a backup of ${APPS[json.app] ? APPS[json.app].name : json.app}, not ${M.name}.`);
        if (!confirm(`Replace ALL current ${M.name} data with the backup from ${String(json.exported_at || "").slice(0, 16).replace("T", " ")}?\n\nTip: download a JSON copy first if you may need what is there now.`)) { input.value = ""; return; }
        const { data, error } = await ctx.sb.rpc("kmr_data_import", { p_slug: ctx.slug, p_app: app, p_data: json });
        if (error) throw error;
        const r = data && data.restored;
        const n = typeof r === "number" ? r : r && typeof r === "object" ? Object.values(r).reduce((s, v) => s + Number(v || 0), 0) : "";
        this.overview(ctx, `<b>${esc(M.name)} restored</b> from ${esc(file.name)}${n !== "" ? ` — ${n} records` : ""}.`);
      } catch (e) { alert(e.message || e); }
      if (input) input.value = "";
    },
  };
})();
