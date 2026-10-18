/* SPC Charts - one screen per study: 1 About the study, 2 Enter readings, 3 Study report (laid out as in the AIAG SPC manual).
   Data calls are kmr_spc_* (database) or spc-demo.js (?demo=1). Calculations are in spc-calc.js (checked against published values). Readings are typed or pasted in by hand. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, C = window.SPCCalc, Tol = window.KMRTol;
  const S = { list: [], f: { q: "", status: "active", type: "" }, ch: null, an: null, all: false, edit: null };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const canEdit = () => !!QP.canEdit;
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const TYPES = { xr: ["X̄-R chart", "Averages and ranges", "Sizes, weights, torque… measured on 2 to 10 parts at a time (for example 5 parts every hour)."],
    xs: ["X̄-S chart", "Averages and standard deviations", "Same as X̄-R, better when each group has 10 or more readings."],
    imr: ["I-MR chart", "Individual readings", "Only one measurement is possible each time (a batch, a day, a slow process)."],
    p: ["p chart", "Fraction rejected", "Count the rejected parts out of the number inspected. The number inspected may change."],
    np: ["np chart", "Number rejected", "Count the rejected parts when the same number is inspected every time."],
    c: ["c chart", "Number of defects", "Count defects (scratches, blow-holes…) in the same size of sample every time."],
    u: ["u chart", "Defects per unit", "Count defects when the quantity or area checked changes. Plotted per unit."] };
  const VAR = ["xr", "xs", "imr"], ATT = ["p", "np", "c", "u"];
  const num = (v) => { const n = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) ? n : null; };
  const nums = (s) => String(s || "").split(/[\s,;]+/).map(num).filter((x) => x != null);
  const f = (v, d) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(d == null ? 3 : d));
  const dpOf = (ch) => { const x = [ch.lsl, ch.usl, ch.target].map((v) => (v == null ? 0 : (String(v).split(".")[1] || "").length)); return Math.min(5, Math.max(2, ...x) + 1); };
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const tolOf = (ch) => Tol.calc((ch.rules && ch.rules.tol) || { type: "limits", lsl: ch.lsl, usl: ch.usl });

  /* ================= router ================= */
  async function route() {
    const hp = hashParts(), go = ["std", "list", "chart", "dash"].includes(hp.go) ? hp.go : "std";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === (go === "chart" ? "list" : go)));
    ["std", "list", "chart", "dash"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    say("");
    try {
      if (go === "std") KMRStd.draw($("#std"), "spc");
      else if (go === "list") await drawList();
      else if (go === "dash") await drawDash();
      else if (hp.id) { S.view = hp.view === "cap" ? "cap" : "chart"; S.ch = await call("kmr_spc_get", { p_id: hp.id }); S.edit = null; render(); }
      else if (TYPES[hp.new]) { S.view = "chart"; S.ch = { id: null, chart_type: hp.new, subgroup_size: hp.new === "imr" ? 1 : 5, rows: [], status: "active", rules: { rules: [1, 2, 3], run: 7, trend: 7 } }; S.edit = null; render(); }
      else { setGo("go=list"); route(); }
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);
  const goChart = (id) => { setGo("go=chart&id=" + id); route(); };

  /* ================= register + "which chart?" ================= */
  async function drawList() {
    S.list = await call("kmr_spc_list", { p: { status: S.f.status, chart_type: S.f.type, q: S.f.q } });
    const el = $("#list"), can = canEdit(), card = (k) => { const locked = !hasF(ATT.includes(k) ? "spc.attribute-charts" : "spc.variable-charts"); return `<button class="tcard${locked ? " lk" : ""}" data-new="${k}"><b>${locked ? "🔒 " : ""}${TYPES[k][0]}</b><span>${esc(TYPES[k][1])}</span><small>${esc(TYPES[k][2])}</small></button>`; };
    el.innerHTML = `${can ? `<div class="card"><h3>Start a new study — what are you checking?</h3><p class="mut" style="margin:0 0 8px;font-size:13px">Choose the chart that matches your data. Each card says when to use it.</p>
      <div class="lbl" style="margin-top:6px">Measured values (size, weight, torque, hardness…)</div><div class="tcards">${["xr", "xs", "imr"].map(card).join("")}</div>
      <div class="lbl" style="margin-top:10px">Counted values (rejected parts, defects…)</div><div class="tcards">${ATT.map(card).join("")}</div></div>` : ""}
      <h3 style="margin:14px 0 8px">Studies</h3>
      <div class="row"><input class="grow" id="fq" placeholder="Search number, title, part, characteristic…" value="${esc(S.f.q)}"><select id="fs" style="width:auto">${opts([["", "All"], ["active", "Active"], ["closed", "Closed"]], S.f.status)}</select>
      <select id="ft" style="width:auto">${opts([["", "All types"]].concat(Object.entries(TYPES).map(([k, v]) => [k, v[0]])), S.f.type)}</select>${can ? '<label class="btn o s" style="cursor:pointer">Import a study<input type="file" id="imp" accept=".json,application/json" hidden></label>' : ""}</div>
      ${S.list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>No.</th><th>Study</th><th>Part · characteristic</th><th>Type</th><th>Readings</th><th>Result</th><th></th></tr></thead><tbody>${S.list.map((c) => {
        const sm = c.summary || {}, sig = Number(sm.signals) || 0, cpk = sm.cpk != null && sm.cpk !== "" ? Number(sm.cpk) : null;
        return `<tr data-open="${c.id}" style="cursor:pointer"><td><b>${esc(c.no)}</b></td><td>${esc(c.title)}${c.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${esc([c.part_no, c.characteristic].filter(Boolean).join(" · ") || "—")}</td><td>${esc(TYPES[c.chart_type][0])}</td><td>${c.points}</td>
          <td>${c.points < 2 ? '<span class="mut">not enough readings</span>' : (sig ? `<span class="chip r">${sig} signal${sig > 1 ? "s" : ""}</span>` : '<span class="chip g">in control</span>') + (cpk != null ? ` <span class="chip ${cpk >= 1.33 ? "g" : cpk >= 1 ? "a" : "r"}">Cpk ${cpk.toFixed(2)}</span>` : "")}</td><td>${c.status === "closed" ? '<span class="chip x">closed</span>' : ""}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="empty">No studies yet.<br>${can ? "Choose a chart above to start the first one." : "Ask an editor to start the first study."}</div>`}`;
    let t; $("#fq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.f.q = e.target.value; drawList().then(() => { const i = $("#fq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    $("#fs").onchange = (e) => { S.f.status = e.target.value; drawList(); }; $("#ft").onchange = (e) => { S.f.type = e.target.value; drawList(); };
    if ($("#imp")) $("#imp").onchange = importJson;
    el.querySelectorAll("[data-new]").forEach((b) => (b.onclick = () => { const k = b.dataset.new; if (!hasF(ATT.includes(k) ? "spc.attribute-charts" : "spc.variable-charts")) { KMRLock.need(ATT.includes(k) ? "spc.attribute-charts" : "spc.variable-charts"); return; } setGo("go=chart&new=" + k); route(); }));
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => goChart(r.dataset.open)));
  }

  /* ================= analysis ================= */
  const RULE1D = { xr: "A range is outside its limit — the spread changed", xs: "A standard deviation is outside its limit — the spread changed", imr: "A moving range is outside its limit — the readings jumped" };
  function analyse(ch, rows) {
    const t = ch.chart_type, vr = VAR.includes(t), A = { vr, rows: [], vals: [], lim: [], dvals: [], dlim: [], res: null, sig: [], flagged: {}, dflagged: {}, cap: null, tol: tolOf(ch) };
    if (vr) {
      const use = rows.map((r) => ({ r, v: (r.vals || []).map(Number).filter(Number.isFinite) })).filter((x) => (t === "imr" ? x.v.length >= 1 : x.v.length >= 2));
      A.rows = use.map((x) => x.r); if (use.length < 2) return A;
      const lf = Number(ch.limits_from) || 0, res = t === "imr" ? C.imrChart(use.map((x) => x.v[0]), { limitsFrom: lf }) : C.xbarChart(use.map((x) => x.v), t, { limitsFrom: lf });
      if (!res) return A; A.res = res; A.vals = res.means; A.lim = res.lim.map((l) => l.x); A.dvals = res.disp; A.dlim = res.lim.map((l) => l.d); A.n = Math.round(res.n.reduce((a, b) => a + b, 0) / res.n.length);
      if ((A.tol.lsl != null || A.tol.usl != null) && hasF("spc.capability-analysis")) A.cap = C.capability(res.all, res.sigma, A.tol.lsl, A.tol.usl, A.tol.target);
    } else {
      const use = rows.map((r) => ({ r, d: num((r.vals || [])[0]), n: t === "c" ? 1 : num((r.vals || [])[1]) })).filter((x) => x.d != null && x.d >= 0 && (t === "c" || (x.n != null && x.n > 0)));
      A.rows = use.map((x) => x.r); if (!use.length) return A;
      const res = C.attrChart(use.map((x) => ({ d: x.d, n: x.n })), t); if (!res) return A; A.res = res; A.vals = res.val; A.lim = res.lim;
    }
    const ru = ch.rules || { rules: [1, 2, 3], run: 7, trend: 7 };
    C.rules(A.vals, A.lim, ru).forEach((s) => { A.sig.push({ i: s.i, row: A.rows[s.i], rule: s.rule, text: s.text, on: vr ? (t === "imr" ? "Individuals" : "Averages") : TYPES[t][0] }); A.flagged[s.i] = 1; });
    if (vr) C.rules(A.dvals.map((v) => (v == null ? NaN : v)), A.dlim, { rules: [1] }).forEach((s) => { A.sig.push({ i: s.i, row: A.rows[s.i], rule: 1, text: RULE1D[t], on: t === "xr" ? "Range" : t === "xs" ? "Std. deviation" : "Moving range" }); A.dflagged[s.i] = 1; });
    A.sig.sort((a, b) => a.i - b.i); return A;
  }

  /* ================= the study page ================= */
  const lblOf = (ch, r) => r.label || "#" + r.seq;
  function rowText(ch, r) {
    const v = r.vals || []; if (VAR.includes(ch.chart_type)) return v.map(Number).filter(Number.isFinite).map((x) => Math.round(x * 1e6) / 1e6).join("  ");
    return ch.chart_type === "c" ? `${v[0]} defects` : ch.chart_type === "u" ? `${v[0]} defects in ${v[1]}` : `${v[0]} of ${v[1]}`;
  }
  function render() {
    const ch = S.ch, el = $("#chart"), saved = !!ch.id, ed = canEdit() && ch.status === "active", A = (S.an = analyse(ch, ch.rows)), t = ch.chart_type;
    el.innerHTML = `<div class="row noprint"><a href="#go=list" class="btn o s">← All studies</a><div style="flex:1"></div>${saved ? `<button class="btn o s" id="b_print">Print report</button><button class="btn o s" id="b_exp">Export</button>${canEdit() ? `<button class="btn o s" id="b_close">${ch.status === "active" ? "Close study" : "Reopen study"}</button><button class="btn r s" id="b_del">Delete</button>` : ""}` : ""}</div>
      <h2 style="margin:0 0 2px">${saved ? esc(ch.title) : "New study — " + esc(TYPES[t][0])}</h2><div class="mut" style="margin-bottom:12px">${esc(TYPES[t][1])}${saved ? " · " + esc(ch.no) : ""}${ch.status === "closed" ? " · closed" : ""}${ch.sample ? " · sample data" : ""}</div>
      <div class="step noprint"><div class="sh"><span class="sn">1</span> About the study</div>${setupHtml(ch, saved, ed)}</div>
      <div class="step noprint"><div class="sh"><span class="sn">2</span> Enter the readings</div>${(ed ? entryHtml(ch) : '<p class="mut">This study is closed or you can only view it.</p>') + tableHtml(ch, A, ed)}${saved ? "" : '<p class="mut noprint" style="font-size:12.5px;margin:8px 0 0">Nothing is stored until you press <b>Save the study</b> in step 1 — the report below builds as you type.</p>'}</div>
      <div class="step" data-nofilter><div class="sh"><span class="sn">3</span> Study report${saved ? "" : ' <span class="mut" style="font-weight:400;font-size:13px">(live preview)</span>'}</div>${viewBar(ch)}<div id="rep">${repOf(ch, A, saved && ed)}</div></div>`;
    wire(ch, A);
  }

  function syncSetup(ch) { const p = readSetup(ch); delete p.id; Object.assign(ch, p); }
  function liveReport(ch) { if (ch.id || !$("#rep")) return; syncSetup(ch); S.an = analyse(ch, ch.rows); $("#rep").innerHTML = repOf(ch, S.an, false); }
  /* ----- 1: setup (always on the page, no pop-up) ----- */
  function setupHtml(ch, saved, ed) {
    const t = ch.chart_type, vr = VAR.includes(t), ru = ch.rules || {}, rl = ru.rules || [1, 2, 3], meta = ru.meta || {}, dis = saved && !ed ? " disabled" : "";
    const tolv = ru.tol || (saved && (ch.lsl != null || ch.usl != null) ? { type: "limits", lsl: ch.lsl, usl: ch.usl } : { type: "sym" });
    return `<fieldset style="border:0;padding:0;margin:0"${dis}><div class="frm"><div class="w"><label>Name of this study *</label><input id="s_title" value="${esc(ch.title || "")}" placeholder="e.g. Shaft diameter — turning, shift A"></div>
      <div><label>Part number</label><input id="s_part_no" value="${esc(ch.part_no || "")}"></div><div><label>Part name</label><input id="s_part_name" value="${esc(ch.part_name || "")}"></div>
      <div><label>Characteristic being checked</label><input id="s_char" value="${esc(ch.characteristic || "")}" placeholder="e.g. Outer diameter"></div><div><label>Process / machine</label><input id="s_process" value="${esc(ch.process || "")}" placeholder="e.g. CNC lathe 3"></div>
      <div><label>Unit of measure</label><input id="s_unit" value="${esc(ch.unit || "")}" placeholder="mm"></div><div><label>Gauge used</label><input id="s_gauge" value="${esc(meta.gauge || "")}" placeholder="gauge number (should have passed an MSA)"></div>
      ${vr && t !== "imr" ? `<div><label>Readings in each group <span class="mut">(2 to ${t === "xr" ? 10 : 25})</span></label><input id="s_sub" type="number" min="2" max="25" value="${esc(ch.subgroup_size || 5)}"${saved && ch.points ? " disabled" : ""}></div>` : ""}
      ${t === "np" ? `<div><label>Number inspected each time</label><input id="s_sub" type="number" min="1" value="${esc(ch.subgroup_size || 50)}"></div>` : ""}
      <div><label>How often is a group taken?</label><input id="s_freq" value="${esc(meta.freq || "")}" placeholder="e.g. 5 parts every hour"></div><div><label>Prepared by</label><input id="s_by" value="${esc(meta.by || "")}"></div></div>
      ${vr ? `<div class="lbl" style="margin:12px 0 4px">Specification — gives the limits for Cp / Cpk / Pp / Ppk</div>${Tol.html("tl", tolv)}` : ""}
      <details style="margin-top:10px"${saved ? "" : ""}><summary style="cursor:pointer;color:var(--b1);font-weight:700">Advanced: signals to look for and how the limits are worked out <span class="mut" style="font-weight:400">(the usual settings are already chosen)</span></summary>
        <div class="seg" id="s_rules" style="margin-top:8px">${[[1, "1 · Point outside the limits"], [2, "2 · Run on one side of the centre"], [3, "3 · Steady rise or fall"], [4, "4 · 2 of 3 beyond 2σ"], [5, "5 · 4 of 5 beyond 1σ"]].map(([k, l]) => `<button type="button" data-r="${k}" class="${rl.includes(k) ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="frm"><div><label>Run length for signal 2</label><input id="s_run" type="number" min="5" max="12" value="${esc(ru.run || 7)}"></div><div><label>Rise / fall length for signal 3</label><input id="s_trend" type="number" min="5" max="12" value="${esc(ru.trend || 7)}"></div>
        <div><label>Work out the limits from the first … groups <span class="mut">(blank = all)</span></label><input id="s_lf" type="number" min="3" value="${esc(ch.limits_from || "")}"></div></div></details>
      <div class="w" style="margin-top:10px"><label>Notes</label><textarea id="s_notes" rows="2">${esc(ch.notes || "")}</textarea></div>
      ${!saved || ed ? `<div class="row" style="margin-top:10px"><button class="btn" id="b_setup">${saved ? "Save changes" : "Save the study"}</button></div>` : ""}</fieldset>`;
  }
  function readSetup(ch) {
    const t = ch.chart_type, vr = VAR.includes(t), o = vr ? Tol.read("tl") : null, old = ch.rules || {};
    const p = { id: ch.id, title: V("s_title"), part_no: V("s_part_no"), part_name: V("s_part_name"), characteristic: V("s_char"), process: V("s_process"), unit: V("s_unit"), chart_type: t, notes: V("s_notes"), limits_from: V("s_lf") === "" ? null : V("s_lf"),
      subgroup_size: t === "imr" ? 1 : $("#s_sub") ? V("s_sub") : 1, lsl: o ? o.lsl : null, usl: o ? o.usl : null, target: o ? o.target : null,
      rules: { rules: [...document.querySelectorAll("#s_rules button.on")].map((b) => Number(b.dataset.r)), run: Number(V("s_run")) || 7, trend: Number(V("s_trend")) || 7, meta: { gauge: V("s_gauge"), freq: V("s_freq"), by: V("s_by") } } };
    if (o) p.rules.tol = { type: o.type, n: o.n, a: o.a, b: o.b, lsl: o.type === "limits" ? o.lsl : undefined, usl: o.type === "limits" ? o.usl : undefined };
    return p;
  }

  /* ----- 2: entry ----- */
  function entryHtml(ch) {
    const t = ch.chart_type, n = VAR.includes(t) ? (t === "imr" ? 1 : ch.subgroup_size) : t === "c" ? 1 : 2;
    const ph = VAR.includes(t) ? Array.from({ length: n }, (_, i) => "reading " + (i + 1)) : t === "c" ? ["defects found"] : t === "u" ? ["defects found", "units checked"] : ["rejected", "inspected"];
    const next = (ch.rows.length ? Math.max(...ch.rows.map((r) => r.seq)) : 0) + 1;
    return `<div class="two"><div><div class="lbl">Type one ${VAR.includes(t) ? (t === "imr" ? "reading" : "group") : "count"} and press Add (Enter moves to the next box)</div>
      <div class="gr"><input id="e_label" placeholder="Label (#${next})" style="width:120px">${ph.map((p, i) => `<input class="e_v" data-i="${i}" inputmode="decimal" placeholder="${esc(p)}"${t === "np" && i === 1 ? ` value="${esc(ch.subgroup_size)}"` : ""}>`).join("")}<input id="e_note" placeholder="Note (optional)" style="width:170px"><button class="btn" id="e_add">Add</button></div></div>
      <div><div class="lbl">Or paste many from Excel — ${VAR.includes(t) ? (t === "imr" ? "one reading per line" : "one group per line") : "one row per line: " + (t === "c" ? "defects" : t === "u" ? "defects, units checked" : "rejected, inspected")}</div>
      <textarea id="e_paste" rows="4" placeholder="${VAR.includes(t) ? "20.01\t19.98\t20.02\t20.00\t19.99" : "3\t100"}"></textarea><div class="row" style="margin:6px 0 0"><button class="btn o s" id="e_padd">Add pasted rows</button><span class="mut" id="e_pc" style="font-size:12.5px"></span></div></div></div>`;
  }
  function parsePaste(ch, txt) {
    const out = [];
    String(txt || "").split(/\r?\n/).forEach((ln) => {
      ln = ln.trim(); if (!ln) return; const parts = ln.split(/[\t,;]+|\s+/).filter((x) => x !== ""); let label = null; if (parts.length && num(parts[0]) == null) label = parts.shift();
      let v = parts.map(num).filter((x) => x != null);
      if (VAR.includes(ch.chart_type)) { v = ch.chart_type === "imr" ? v.slice(0, 1) : v.slice(0, 25); if (!v.length) return; }
      else if (ch.chart_type === "c") { v = v.slice(0, 1); if (!v.length) return; }
      else { if (v.length === 1 && ch.chart_type === "np") v.push(ch.subgroup_size); if (v.length < 2) return; v = v.slice(0, 2); }
      out.push({ label, vals: v });
    });
    return out;
  }
  function tableHtml(ch, A, ed) {
    const rows = ch.rows; if (!rows.length) return "";
    const show = S.all ? rows : rows.slice(-30), vr = VAR.includes(ch.chart_type), pos = new Map(A.rows.map((r, i) => [r.id, i]));
    return `<div class="lbl" style="margin-top:12px">Readings entered (${rows.length}) — change a reading right in the table</div><div class="sc"><table class="tb2"><thead><tr><th>Label</th><th>${vr ? "Readings" : "Counts"}</th><th>${vr ? (ch.chart_type === "imr" ? "" : "Average") : "Plotted"}</th><th>Note</th><th></th></tr></thead><tbody>${show.map((r) => {
      const i = pos.get(r.id), fl = i != null && (A.flagged[i] || A.dflagged[i]);
      if (S.edit === r.id) return `<tr style="background:#ecfeff"><td><input id="x_label" value="${esc(r.label || "")}" style="min-width:70px"></td><td colspan="2"><input id="x_vals" value="${esc((r.vals || []).join(" "))}" style="min-width:160px"></td><td><input id="x_note" value="${esc(r.note || "")}"></td><td style="white-space:nowrap"><button class="btn s" data-xs="${r.id}">Save</button> <button class="btn s o" id="x_c">Cancel</button></td></tr>`;
      return `<tr${fl ? ' style="background:#fee2e2"' : ""}><td>${esc(lblOf(ch, r))}</td><td>${esc(rowText(ch, r))}</td><td>${i != null && Number.isFinite(A.vals[i]) ? A.vals[i].toFixed(vr ? dpOf(ch) + 1 : 4) : "—"}</td><td>${esc(r.note || "")}</td><td style="white-space:nowrap">${ed ? `<button class="btn s o" data-ed="${r.id}">Change</button> <button class="btn s r" data-rm="${r.id}" title="Delete this reading">✕</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>${rows.length > 30 ? `<p><a href="#" id="showAll">${S.all ? "Show only the last 30" : "Show all " + rows.length}</a></p>` : ""}`;
  }

  /* ----- 3: the study report: AIAG-style forms (aiag-forms.js / aiag-spc.js) ----- */
  function xctx(ch, A, ed) {
    if (window.KMRReport) KMRReport.set({ key: S.view === "cap" && A.vr ? "cap" : "chart", doc: ch.no || "", inForm: true, land: !(S.view === "cap" && A.vr) });
    return { d: dpOf(ch), co: (QP.ctx && QP.ctx.company) || "", ri: window.KMRReport ? KMRReport.info() : null, ed, canTask: !!(window.KMRTask && KMRTask.on) && ed, VAR, TYPES, C, hasF };
  }
  const reportHtml = (ch, A, ed) => AIAGForm.spcControl(ch, A, xctx(ch, A, ed));
  const capReportHtml = (ch, A, ed) => AIAGForm.spcCapability(ch, A, xctx(ch, A, ed));
  const repOf = (ch, A, ed) => (S.view === "cap" ? capReportHtml(ch, A, ed) : reportHtml(ch, A, ed));
  const viewBar = (ch) => (VAR.includes(ch.chart_type) ? `<div class="seg noprint" id="s_view" style="margin:0 0 10px"><button type="button" data-view="chart" class="${S.view === "cap" ? "" : "on"}">Control chart report</button><button type="button" data-view="cap" class="${S.view === "cap" ? "on" : ""}">Capability report (Cp, Cpk)</button></div>` : "");

  /* ================= wiring ================= */
  function wire(ch, A) {
    const b = (id, fn) => { const e = $("#" + id); if (e) e.onclick = fn; };
    if (VAR.includes(ch.chart_type)) Tol.wire("tl");
    document.querySelectorAll("#s_view button").forEach((x) => (x.onclick = () => { if (!ch.id) syncSetup(ch); S.view = x.dataset.view; render(); }));
    document.querySelectorAll("#s_rules button").forEach((x) => (x.onclick = () => { x.classList.toggle("on"); liveReport(ch); }));
    if (!ch.id) { const fs = document.querySelector("#chart fieldset"); if (fs) { let tm; fs.addEventListener("input", (e) => { if (e.target.id === "s_sub") return; clearTimeout(tm); tm = setTimeout(() => liveReport(ch), 250); }); const sb = $("#s_sub"); if (sb) sb.onchange = () => { syncSetup(ch); render(); }; } }
    b("b_setup", async () => {
      const p = readSetup(ch); if (!p.title.trim()) { say("Give the study a name."); $("#s_title").focus(); return; } if (!p.rules.rules.length) { say("Choose at least one signal to look for."); return; }
      if (VAR.includes(ch.chart_type) && $("#tl_type") && !Tol.read("tl").ok && (V("tl_n") || V("tl_a"))) { say("Check the specification values: the upper limit must be above the lower limit."); return; }
      try { const r = await call("kmr_spc_save", { p }); if (!ch.id && ch.rows.length) { const rows = ch.rows.map((x) => ({ label: x.label, taken_at: x.taken_at, vals: x.vals, note: x.note })); for (let i = 0; i < rows.length; i += 400) await call("kmr_spc_points_add", { p_chart: r.id, p_rows: rows.slice(i, i + 400) }); } say("Saved.", true); if (!ch.id) goChart(r.id); else { S.ch = await call("kmr_spc_get", { p_id: ch.id }); render(); } } catch (e) { say(e.message); }
    });
    b("b_print", () => window.print()); b("b_exp", () => exportJson(ch));
    b("b_close", async () => { try { await call("kmr_spc_save", { p: Object.assign({}, ch, { status: ch.status === "active" ? "closed" : "active" }) }); goChart(ch.id); } catch (e) { say(e.message); } });
    b("b_del", async () => { if (!confirm("Delete this study and all its readings? This cannot be undone.")) return; try { await call("kmr_spc_delete", { p_id: ch.id }); say("Study deleted.", true); setGo("go=list"); route(); } catch (e) { say(e.message); } });
    b("showAll", (e) => { e.preventDefault(); S.all = !S.all; render(); }); b("capLock", (e) => { e.preventDefault(); if (window.KMRLock) KMRLock.need("spc.capability-analysis"); });
    const reload = async (msg) => { S.ch = await call("kmr_spc_get", { p_id: ch.id }); S.edit = null; render(); if (msg) say(msg, true); };
    const add = async (rows) => { if (!ch.id) { syncSetup(ch); let sq = ch.rows.length ? Math.max(...ch.rows.map((r) => r.seq)) : 0; rows.forEach((r) => { sq++; ch.rows.push({ id: "d" + sq, seq: sq, label: r.label, vals: r.vals, note: r.note, taken_at: r.taken_at || new Date().toISOString() }); }); render(); setTimeout(() => { const i = document.querySelector(".e_v"); if (i) i.focus(); }, 50); return; } try { await call("kmr_spc_points_add", { p_chart: ch.id, p_rows: rows }); await reload(rows.length + (rows.length > 1 ? " readings added." : " reading added.")); setTimeout(() => { const i = document.querySelector(".e_v"); if (i) i.focus(); }, 50); } catch (e) { say(e.message); } };
    b("e_add", () => {
      const vals = [...document.querySelectorAll(".e_v")].map((i) => num(i.value)), t = ch.chart_type; let v = vals.filter((x) => x != null);
      if (VAR.includes(t)) { if (v.length < (t === "imr" ? 1 : 2)) { say("Enter " + (t === "imr" ? "the reading." : "at least two readings in the group.")); return; } }
      else if (t === "c") { if (v.length < 1) { say("Enter the number of defects."); return; } }
      else if (vals[0] == null || vals[1] == null || vals[1] <= 0) { say("Enter the number found and the number inspected."); return; } else v = [vals[0], vals[1]];
      add([{ label: V("e_label").trim() || null, vals: v, note: V("e_note").trim() || null, taken_at: new Date().toISOString() }]);
    });
    const pa = $("#e_paste"); if (pa) pa.oninput = () => { $("#e_pc").textContent = parsePaste(ch, pa.value).length + " row(s) found"; };
    b("e_padd", () => { const r = parsePaste(ch, V("e_paste")); if (!r.length) { say("Nothing to add — check that the lines hold numbers."); return; } add(r.slice(0, 500).map((x) => ({ label: x.label, vals: x.vals }))); });
    document.querySelectorAll(".e_v").forEach((i, k, all) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (k < all.length - 1) all[k + 1].focus(); else $("#e_add").click(); } }));
    document.querySelectorAll("[data-ed]").forEach((x) => (x.onclick = () => { if (!ch.id) syncSetup(ch); S.edit = x.dataset.ed; render(); }));
    b("x_c", () => { S.edit = null; if (!ch.id) syncSetup(ch); render(); });
    document.querySelectorAll("[data-xs]").forEach((x) => (x.onclick = async () => { const v = nums(V("x_vals")); if (!v.length) { say("Check the readings."); return; } if (!ch.id) { const r = ch.rows.find((y) => y.id === x.dataset.xs); if (r) { r.label = V("x_label"); r.vals = v; r.note = V("x_note"); } S.edit = null; syncSetup(ch); render(); return; } try { await call("kmr_spc_point_save", { p: { id: x.dataset.xs, label: V("x_label"), vals: v, note: V("x_note") } }); await reload("Saved."); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-rm]").forEach((x) => (x.onclick = async () => { if (!confirm("Delete this reading?")) return; if (!ch.id) { syncSetup(ch); ch.rows = ch.rows.filter((r) => r.id !== x.dataset.rm); render(); return; } try { await call("kmr_spc_point_delete", { p_id: x.dataset.rm }); await reload(); } catch (e) { say(e.message); } }));
    ["cause", "action"].forEach((k) => document.querySelectorAll(`[data-${k}]`).forEach((x) => (x.onchange = async () => { try { await call("kmr_spc_point_save", { p: { id: x.dataset[k], [k]: x.value } }); const r = ch.rows.find((y) => y.id === x.dataset[k]); if (r) r[k] = x.value.trim() || null; say("Saved.", true); } catch (e) { say(e.message); } })));
    document.querySelectorAll("[data-task]").forEach((x) => (x.onclick = () => {
      const s = A.sig[Number(x.dataset.task)], lb = lblOf(ch, s.row);
      KMRTask.assign([{ title: `SPC signal on ${ch.title} (${lb})`, detail: [s.text, s.row.cause ? "Cause: " + s.row.cause : "", s.row.action ? "Action: " + s.row.action : "", `${ch.no} · ${TYPES[ch.chart_type][0]}`].filter(Boolean).join("\n"), who: "", priority: s.rule === 1 ? "high" : "normal",
        source_app: "spc", source_ref: s.row.id, source_label: ch.no + " " + lb, tags: "SPC", source_url: `/it/spc.html?${QP.DEMO ? "demo=1" : "kmr=1&co=" + encodeURIComponent(QP.slug)}#go=chart&id=${ch.id}` }]);
    }));
    // keep the register and dashboard in step with what the screen shows
    if (canEdit() && ch.id && A.res) {
      const sigN = new Set(A.sig.map((s) => s.i)).size, sm = { signals: sigN, headline: sigN ? sigN + " point" + (sigN > 1 ? "s" : "") + " with a signal" : "In control" };
      if (A.cap) { sm.cap = true; sm.cpk = A.cap.cpk != null ? Math.round(A.cap.cpk * 100) / 100 : null; sm.ppk = A.cap.ppk != null ? Math.round(A.cap.ppk * 100) / 100 : null; }
      if (JSON.stringify(sm) !== JSON.stringify(ch.summary || null)) { ch.summary = sm; call("kmr_spc_summary", { p_chart: ch.id, p_summary: sm }).catch(() => {}); }
    }
  }

  /* ================= export / import ================= */
  function exportJson(ch) {
    const o = { kmr: "spc-chart", version: 2, chart: { title: ch.title, part_no: ch.part_no, part_name: ch.part_name, characteristic: ch.characteristic, process: ch.process, unit: ch.unit, chart_type: ch.chart_type, subgroup_size: ch.subgroup_size, lsl: ch.lsl, usl: ch.usl, target: ch.target, rules: ch.rules, limits_from: ch.limits_from, notes: ch.notes },
      rows: ch.rows.map((r) => ({ label: r.label, taken_at: r.taken_at, vals: r.vals, note: r.note, cause: r.cause, action: r.action })) };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = (ch.no + "-" + ch.title).replace(/[^\w.-]+/g, "_") + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importJson(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      const o = JSON.parse(await file.text()); if (o.kmr !== "spc-chart" || !o.chart) throw new Error("This is not an SPC Charts export.");
      const r = await call("kmr_spc_save", { p: Object.assign({}, o.chart, { id: null }) }), rows = (o.rows || []).map((x) => ({ label: x.label, taken_at: x.taken_at, vals: x.vals, note: x.note }));
      for (let i = 0; i < rows.length; i += 400) await call("kmr_spc_points_add", { p_chart: r.id, p_rows: rows.slice(i, i + 400) });
      say("Imported " + rows.length + " readings.", true); goChart(r.id);
    } catch (er) { say(er.message); } e.target.value = "";
  }

  /* ================= dashboard ================= */
  async function drawDash() {
    const d = await call("kmr_spc_dashboard"), el = $("#dash");
    const list = (a) => (a && a.length ? a.map((c) => `<div class="t" data-open="${c.id}"><div class="tb"><div class="tt">${esc(c.no)} · ${esc(c.title)}</div><div class="tm"><span>${esc(TYPES[c.chart_type][0])}</span><span>${c.points} readings</span>${c.summary && c.summary.signals ? `<span class="late">${c.summary.signals} signal(s)</span>` : ""}${c.summary && c.summary.cpk != null ? `<span>Cpk ${Number(c.summary.cpk).toFixed(2)}</span>` : ""}</div></div></div>`).join("") : '<div class="empty">Nothing here.</div>');
    el.innerHTML = `<div class="kpis"><div class="kpi"><b>${d.charts}</b><span>studies</span></div><div class="kpi"><b>${d.active}</b><span>active</span></div><div class="kpi" style="--c:var(--r)"><b>${d.signals}</b><span>with signals</span></div><div class="kpi" style="--c:var(--a)"><b>${d.low_cpk}</b><span>Cpk below 1.33</span></div></div>
      <div class="two"><div class="card"><h3>Needs attention</h3>${list(d.attention)}</div><div class="card"><h3>Recently updated</h3>${list(d.recent)}</div></div>`;
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => goChart(r.dataset.open)));
  }

  (async () => {
    try {
      await QP.init("spc"); if (!QP.ctx) return;
      if (window.KMRTask) await KMRTask.init({ call: QP.call, slug: QP.slug, token: async () => { const r = QP.sb && (await QP.sb.auth.getSession()); return r && r.data.session ? r.data.session.access_token : null; } });
      await route();
    } catch (e) { say(e.message); }
  })();
})();
