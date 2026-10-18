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

  /* ================= SVG ================= */
  function svgLine(title, vals, lim, labels, flagged, o) {
    o = o || {}; const W = 780, H = 230, L = 54, R = 84, T = 12, B = 26, n = vals.length, d = o.d == null ? 3 : o.d, ys = [];
    vals.forEach((v) => Number.isFinite(v) && ys.push(v)); lim.forEach((l) => [l.ucl, l.lcl, l.cl].forEach((v) => Number.isFinite(v) && ys.push(v)));
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
    const X = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B), path = (k) => lim.map((l, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(l[k]).toFixed(1)).join("");
    const last = lim[n - 1], tick = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4), step = Math.max(1, Math.ceil(n / 12));
    return `<div class="cc"><h4>${esc(title)}</h4><svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e9f2"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(d)}</text>`).join("")}
      <path d="${path("ucl")}" fill="none" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="6 4"/><path d="${path("lcl")}" fill="none" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="6 4"/><path d="${path("cl")}" fill="none" stroke="#16a34a" stroke-width="1.4"/>
      <text x="${W - R + 4}" y="${Y(last.ucl) + 4}" fill="#dc2626">UCL ${last.ucl.toFixed(d)}</text><text x="${W - R + 4}" y="${Y(last.cl) + 4}" fill="#16a34a">CL ${last.cl.toFixed(d)}</text><text x="${W - R + 4}" y="${Y(last.lcl) + 4}" fill="#dc2626">LCL ${last.lcl.toFixed(d)}</text>
      <polyline fill="none" stroke="#0f766e" stroke-width="1.6" points="${vals.map((v, i) => (Number.isFinite(v) ? X(i).toFixed(1) + "," + Y(v).toFixed(1) : "")).filter(Boolean).join(" ")}"/>
      ${vals.map((v, i) => (Number.isFinite(v) ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${flagged[i] ? 5.5 : 3.4}" fill="${flagged[i] ? "#dc2626" : "#0f766e"}" stroke="#fff"><title>${esc(labels[i])}: ${v.toFixed(d)}</title></circle>` : "")).join("")}
      ${labels.map((lb, i) => (i % step === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(String(lb).slice(0, 8))}</text>` : "")).join("")}</svg></div>`;
  }
  function svgHist(X, tol, cap, d, big) {
    const H = C.histogram(X), W = 780, Ht = 190, L = 20, R = 20, T = 16, B = 30; if (!H.counts.length) return "";
    const lo = Math.min(H.edges[0], tol.lsl != null ? tol.lsl : Infinity), hi = Math.max(H.edges[H.edges.length - 1], tol.usl != null ? tol.usl : -Infinity), span = hi - lo || 1, x = (v) => L + ((v - lo) / span) * (W - L - R), pdf = (v, m, sg) => (sg > 0 ? Math.exp(-0.5 * ((v - m) / sg) ** 2) / (sg * Math.sqrt(2 * Math.PI)) : 0), cv = (sg) => (big && cap && sg > 0 ? H.width * X.filter(Number.isFinite).length * pdf(cap.mean, cap.mean, sg) : 0), mx = Math.max(...H.counts, cv(cap && cap.sdWithin), cv(cap && cap.sdOverall)), y = (c) => T + (1 - c / mx) * (Ht - T - B);
    const curve = (sg, col, dash) => { if (!big || !cap || !(sg > 0)) return ""; const N = X.filter(Number.isFinite).length, pts = Array.from({ length: 61 }, (_, k) => { const v = lo + (span * k) / 60; return x(v).toFixed(1) + "," + y(H.width * N * pdf(v, cap.mean, sg)).toFixed(1); }); return `<polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="2"${dash ? ' stroke-dasharray="6 3"' : ""}/>`; };
    const vl = (v, col, lb) => (v == null ? "" : `<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${Ht - B}" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 3"/><text x="${x(v)}" y="${T - 3}" text-anchor="middle" fill="${col}">${lb} ${Number(v).toFixed(d)}</text>`);
    return `<div class="cc"><h4>Histogram of all readings against the specification</h4><svg class="svgw" viewBox="0 0 ${W} ${Ht}">${H.counts.map((c, i) => `<rect x="${x(H.edges[i]) + 1}" y="${y(c)}" width="${Math.max(1, x(H.edges[i + 1]) - x(H.edges[i]) - 2)}" height="${Ht - B - y(c)}" fill="#14b8a6" opacity=".8"/>`).join("")}
      ${curve(cap && cap.sdWithin, "#16a34a")}${curve(cap && cap.sdOverall, "#2563eb", 1)}${vl(tol.lsl, "#dc2626", "LSL")}${vl(tol.usl, "#dc2626", "USL")}${vl(tol.target, "#2563eb", "Target")}${cap ? vl(cap.mean, "#16a34a", "Mean") : ""}<line x1="${L}" x2="${W - R}" y1="${Ht - B}" y2="${Ht - B}" stroke="#94a3b8"/>${[lo, lo + span / 2, hi].map((v) => `<text x="${x(v)}" y="${Ht - 10}" text-anchor="middle">${v.toFixed(d)}</text>`).join("")}</svg></div>`;
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

  function headOf(ch, A) {
    const t = ch.chart_type, vr = A.vr, meta = (ch.rules || {}).meta || {}, tol = A.tol, co = (QP.ctx && QP.ctx.company) || "";
    return `<table class="tb2 rh"><tbody><tr><th>Company</th><td>${esc(co)}</td><th>Study no.</th><td>${esc(ch.no)}</td></tr>
      <tr><th>Part number / name</th><td>${esc([ch.part_no, ch.part_name].filter(Boolean).join(" · ") || "—")}</td><th>Characteristic</th><td>${esc(ch.characteristic || "—")}</td></tr>
      <tr><th>Process / machine</th><td>${esc(ch.process || "—")}</td><th>Specification</th><td>${vr && tol.ok ? esc(tol.symbol) + (ch.unit ? " " + esc(ch.unit) : "") : "—"}</td></tr>
      <tr><th>Chart type</th><td>${esc(TYPES[t][0])} — ${esc(TYPES[t][1])}</td><th>Group size / frequency</th><td>${vr && t !== "imr" ? esc(ch.subgroup_size) + " readings" : t === "np" ? esc(ch.subgroup_size) + " inspected" : "—"}${meta.freq ? " · " + esc(meta.freq) : ""}</td></tr>
      <tr><th>Gauge used</th><td>${esc(meta.gauge || "—")}</td><th>Unit of measure</th><td>${esc(ch.unit || "—")}</td></tr>
      <tr><th>Period covered</th><td>${ch.rows.length ? fmt(ch.rows[0].taken_at) + " to " + fmt(ch.rows[ch.rows.length - 1].taken_at) : "—"}</td><th>Prepared by</th><td>${esc(meta.by || "—")}</td></tr></tbody></table>`;
  }
  /* ----- 3b: capability study report (Cp, Cpk, Pp, Ppk) ----- */
  function capReportHtml(ch, A, ed) {
    const t = ch.chart_type, d = dpOf(ch), tol = A.tol, cap = A.cap, res = A.res, meta = (ch.rules || {}).meta || {}, head = headOf(ch, A);
    const note = (m) => head + `<div class="empty" style="margin-top:12px">${m}</div>`;
    if (!A.vr) return note("A capability study (Cp, Cpk) needs measured values. Counted data (rejects, defects) is judged by the p, np, c or u chart and its centre line — the average fraction or number of defects.");
    if (!tol.ok) return note("Enter the specification in step 1 (choose how the tolerance is written and type the values). Cp, Cpk, Pp and Ppk are worked out from it.");
    if (!hasF("spc.capability-analysis")) return note('🔒 Capability analysis is not part of your plan. <a href="#" id="capLock">Find out how to add it</a>');
    if (!res || !cap) return note("Enter at least two " + (t === "imr" ? "readings" : "groups") + " in step 2 and the capability report appears here.");
    const sigN = new Set(A.sig.map((s) => s.i)).size, nG = A.rows.length, few = (t === "imr" ? nG < 100 : nG < 25), skewed = Math.abs(cap.skew) > 1, hasG = !!meta.gauge;
    const chk = (ok, title, txt) => `<tr><td style="width:34px;text-align:center;font-size:17px">${ok ? "✔" : "⚠"}</td><td><b>${title}</b><br><span class="mut">${txt}</span></td></tr>`;
    const st = (v) => (v == null ? "" : `<span class="chip ${v >= 1.33 ? "g" : v >= 1 ? "a" : "r"}">${C.verdict(v)}</span>`);
    const x = (v, dd) => (v == null ? "—" : f(v, dd));
    const ppmf = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
    const row = (nm, mean, v, ex) => `<tr><td><b>${nm}</b></td><td>${mean}</td><td>${ex}</td><td><b>${x(v, 2)}</b></td><td>${st(v)}</td></tr>`;
    const lo = tol.lsl, hi = tol.usl, cs = [];
    cs.push(sigN ? `<b>The process was not stable</b> (${sigN} signal${sigN > 1 ? "s" : ""} on the control chart). Cp and Cpk describe a stable process; treat the figures as a rough guide until the causes are removed.` : "The control chart shows no signals: the process was stable during this study, so the indices are meaningful.");
    cs.push(`<b>Within-group capability:</b> Cp ${x(cap.cp, 2)}${cap.cpk != null ? ", Cpk " + x(cap.cpk, 2) + " — " + C.verdict(cap.cpk).toLowerCase() : ""}.${cap.cp != null && cap.cpk != null && cap.cp - cap.cpk > 0.15 ? " Cp is clearly higher than Cpk: the process spread would fit but the average is off-centre — re-centre first." : ""}`);
    cs.push(`<b>Long-term performance:</b> Pp ${x(cap.pp, 2)}${cap.ppk != null ? ", Ppk " + x(cap.ppk, 2) + " — " + C.verdict(cap.ppk).toLowerCase() : ""}. Expected ${ppmf(cap.ppmOverall)} ppm outside the specification (overall spread).`);
    if (cap.ppk != null) cs.push(cap.ppk >= 1.67 ? "Meets the usual PPAP initial-study requirement (Ppk ≥ 1.67)." : cap.ppk >= 1.33 ? "Below the usual PPAP initial-study requirement (Ppk ≥ 1.67) but meets 1.33 for ongoing production. Follow your customer's requirement." : "Does not meet the usual requirements (Ppk ≥ 1.67 initial study, Cpk ≥ 1.33 in production). Reduce variation, re-centre the process, or agree a containment and reaction plan with the customer.");
    if (few) cs.push(`Only ${nG} ${t === "imr" ? "readings" : "groups"}. The manual asks for ${t === "imr" ? "100 readings" : "at least 25 groups (100 or more readings)"} before the indices are relied on.`);
    if (skewed) cs.push("The readings are clearly skewed. The indices assume a roughly normal distribution — check the histogram, and use a method for non-normal data if needed.");
    return `${head}<h4 class="rt">Before quoting the numbers — checks</h4>
      <table class="tb2" data-nofilter><tbody>${chk(!sigN, "Process stable?", sigN ? sigN + " signal(s) on the control chart — see the control chart report." : "No signals on the control chart.")}${chk(hasG, "Measurement system known?", hasG ? esc(meta.gauge) + " — confirm its Gage R&R is acceptable (under 10%, or up to 30% with agreement)." : "Name the gauge used in step 1 and keep its MSA on file.")}${chk(!few, "Enough data?", nG + " " + (t === "imr" ? "readings" : "groups") + " (" + cap.n + " readings in all); the manual asks for 25 groups / 100 readings.")}${chk(!skewed, "Roughly normal?", "Skewness " + f(cap.skew, 2) + ", kurtosis " + f(cap.kurt, 2) + (skewed ? " — clearly skewed." : " — acceptable."))}</tbody></table>
      ${svgHist(res.all, tol, cap, d, true)}
      <p class="mut" style="font-size:12.5px;margin:2px 0 8px"><span style="color:#16a34a;font-weight:700">━</span> normal curve from the within-group spread &nbsp; <span style="color:#2563eb;font-weight:700">╌</span> normal curve from the overall spread &nbsp; · &nbsp; ${cap.outOfSpec} of ${cap.n} readings are outside the specification</p>
      <h4 class="rt">Capability and performance indices</h4>
      <div class="sc"><table class="tb2" data-nofilter><thead><tr><th>Index</th><th>Spread used (σ)</th><th>Formula</th><th>Value</th><th>Verdict</th></tr></thead><tbody>
        ${row("Cp", "within · " + f(cap.sdWithin, d + 3), cap.cp, "(USL − LSL) / 6σ")}${row("CPU", "within", cap.cpu, "(USL − X̄) / 3σ")}${row("CPL", "within", cap.cpl, "(X̄ − LSL) / 3σ")}${row("Cpk", "within", cap.cpk, "smaller of CPU and CPL")}
        ${row("Pp", "overall · " + f(cap.sdOverall, d + 3), cap.pp, "(USL − LSL) / 6s")}${row("PPU", "overall", cap.ppu, "(USL − X̄) / 3s")}${row("PPL", "overall", cap.ppl, "(X̄ − LSL) / 3s")}${row("Ppk", "overall", cap.ppk, "smaller of PPU and PPL")}${cap.cpm != null ? row("Cpm", "overall, about target", cap.cpm, "(USL − LSL) / 6√(s² + (X̄ − T)²)") : ""}</tbody></table></div>
      <p class="mut" style="font-size:12.5px;margin:4px 0 0">σ within = ${A.n > 1 ? (t === "xs" ? "S̄ / c₄" : "R̄ / d₂") : "MR̄ / 1.128"}; s overall = standard deviation of all ${cap.n} readings. Mean ${f(cap.mean, d + 2)} · lowest ${f(cap.min, d + 2)} · highest ${f(cap.max, d + 2)} · LSL ${lo != null ? f(lo, d + 2) : "—"} · USL ${hi != null ? f(hi, d + 2) : "—"}${tol.target != null ? " · target " + f(tol.target, d + 2) : ""}${tol.tolerance != null ? " · tolerance " + f(tol.tolerance, d + 2) : ""}.</p>
      <div class="sc"><table class="tb2" data-nofilter style="margin-top:8px"><thead><tr><th>Expected outside the specification</th><th>Total</th></tr></thead><tbody><tr><td>Within-group spread</td><td><b>${ppmf(cap.ppmWithin)} ppm</b></td></tr><tr><td>Overall spread</td><td><b>${ppmf(cap.ppmOverall)} ppm</b></td></tr></tbody></table></div>
      <h4 class="rt">How to read the verdict</h4>
      <table class="tb2" data-nofilter><thead><tr><th>Index value</th><th>Verdict</th><th>Meaning</th></tr></thead><tbody><tr><td>1.67 or more</td><td><span class="chip g">Capable</span></td><td>Meets the usual initial-study requirement (PPAP, Ppk).</td></tr><tr><td>1.33 to 1.67</td><td><span class="chip g">Acceptable</span></td><td>Usual requirement for ongoing production (Cpk).</td></tr><tr><td>1.00 to 1.33</td><td><span class="chip a">Marginal</span></td><td>Process needs close control; improvement action expected.</td></tr><tr><td>Below 1.00</td><td><span class="chip r">Not capable</span></td><td>Process cannot reliably meet the specification — act on the process, 100% inspect meanwhile.</td></tr></tbody></table>
      <h4 class="rt">Conclusion</h4><ul style="margin:0 0 10px;padding-left:20px">${cs.map((z) => `<li>${z}</li>`).join("")}</ul>
      <table class="tb2 sign"><tbody><tr><th>Prepared by</th><td>${esc(meta.by || "")}</td><th>Date</th><td></td><th>Reviewed / approved by</th><td></td><th>Date</th><td></td></tr></tbody></table>
      <p class="mut" style="font-size:11.5px;margin:6px 0 0">Prepared as a process capability study according to the AIAG Statistical Process Control manual (Cp, Cpk from the within-group spread; Pp, Ppk from the overall spread) and the PPAP initial process study guidance.</p>`;
  }
  const repOf = (ch, A, ed) => (S.view === "cap" ? capReportHtml(ch, A, ed) : reportHtml(ch, A, ed));
  const viewBar = (ch) => (VAR.includes(ch.chart_type) ? `<div class="seg noprint" id="s_view" style="margin:0 0 10px"><button type="button" data-view="chart" class="${S.view === "cap" ? "" : "on"}">Control chart report</button><button type="button" data-view="cap" class="${S.view === "cap" ? "on" : ""}">Capability report (Cp, Cpk)</button></div>` : "");
  /* ----- 3: report (as in the AIAG SPC manual) ----- */
  function reportHtml(ch, A, ed) {
    const t = ch.chart_type, vr = A.vr, d = dpOf(ch), meta = (ch.rules || {}).meta || {}, tol = A.tol, co = (QP.ctx && QP.ctx.company) || "";
    const head = headOf(ch, A);
    if (!A.res) return head + `<div class="empty" style="margin-top:12px">${ch.rows.length ? "Enter at least two " + (vr ? "groups" : "readings") + " to draw the charts." : "No readings yet. Enter them in step 2 and the charts, limits and conclusion appear here."}</div>`;
    const lbl = A.rows.map((r) => lblOf(ch, r)), sigN = new Set(A.sig.map((s) => s.i)).size, cap = A.cap, res = A.res;
    // limits table with the constants used
    let lim = "";
    if (vr) {
      const k = C.K(Math.max(2, A.n || 2)), xr = t === "xr", xs = t === "xs", im = t === "imr", l0 = res.lim[0], lastL = res.lim[res.lim.length - 1];
      lim = `<div class="sc"><table class="tb2"><thead><tr><th>Chart</th><th>Lower control limit</th><th>Centre line</th><th>Upper control limit</th><th>Formula and constants</th></tr></thead><tbody>
        <tr><td>${im ? "Individuals (X)" : "Averages (X̄)"}</td><td>${f(lastL.x.lcl, d + 1)}</td><td>${f(res.grand, d + 1)}</td><td>${f(lastL.x.ucl, d + 1)}</td><td>${im ? "X̄ ± 2.660 × MR̄" : xr ? `X̿ ± A₂ × R̄ · A₂ = ${f(k.A2, 3)} (n = ${A.n})` : `X̿ ± A₃ × S̄ · A₃ = ${f(k.A3, 3)} (n = ${A.n})`}</td></tr>
        <tr><td>${im ? "Moving range (MR)" : xr ? "Range (R)" : "Std. deviation (S)"}</td><td>${f(lastL.d.lcl, d + 1)}</td><td>${f(res.dbar, d + 1)}</td><td>${f(lastL.d.ucl, d + 1)}</td><td>${im ? "UCL = D₄ × MR̄ · D₄ = 3.267, D₃ = 0" : xr ? `D₃ × R̄ , D₄ × R̄ · D₃ = ${f(k.D3, 3)}, D₄ = ${f(k.D4, 3)}` : `B₃ × S̄ , B₄ × S̄ · B₃ = ${f(k.B3, 3)}, B₄ = ${f(k.B4, 3)}`}</td></tr></tbody></table></div>
        <p class="mut" style="font-size:12.5px;margin:4px 0 0">${res.k} ${im ? "readings" : "groups"} · ${im ? "σ̂ = MR̄ / 1.128" : xr ? `σ̂ (within) = R̄ / d₂ , d₂ = ${f(k.d2, 3)}` : `σ̂ (within) = S̄ / c₄ , c₄ = ${f(k.c4, 4)}`} = <b>${f(res.sigma, d + 2)}</b>${ch.limits_from ? " · limits worked out from the first " + ch.limits_from + (im ? " readings" : " groups") : ""}</p>`;
    } else {
      const l = res.lim, lastL = l[l.length - 1], ns = A.rows.map((r) => (t === "c" ? 1 : Number(r.vals[1])));
      lim = `<div class="sc"><table class="tb2"><thead><tr><th>Chart</th><th>Lower limit</th><th>Centre line</th><th>Upper limit</th><th>Note</th></tr></thead><tbody><tr><td>${TYPES[t][0]}</td><td>${f(lastL.lcl, 4)}</td><td>${f(res.cl, 4)}</td><td>${f(lastL.ucl, 4)}</td><td>${t === "c" ? "c̄ ± 3√c̄" : t === "u" ? "ū ± 3√(ū / n)" : t === "p" ? "p̄ ± 3√(p̄(1−p̄) / n)" : "np̄ ± 3√(np̄(1−p̄))"}${new Set(ns).size > 1 ? " · the limits move with the sample size (shown for the last point)" : ""}</td></tr></tbody></table></div>
        <p class="mut" style="font-size:12.5px;margin:4px 0 0">${res.k} points · ${res.defects} found in ${res.units} ${t === "c" ? "" : "inspected"}</p>`;
    }
    const charts = vr ? svgLine(t === "imr" ? "Individual readings (I) chart" : "Averages (X̄) chart", A.vals, A.lim, lbl, A.flagged, { d: d + 1 }) + svgLine(t === "xr" ? "Range (R) chart" : t === "xs" ? "Standard deviation (S) chart" : "Moving range (MR) chart", A.dvals.map((v) => (v == null ? NaN : v)), A.dlim, lbl, A.dflagged, { d: d + 1 })
      : svgLine(TYPES[t][0], A.vals, A.lim, lbl, A.flagged, { d: t === "p" || t === "u" ? 4 : 2 });
    const canTask = !!(window.KMRTask && KMRTask.on) && ed;
    const sigs = A.sig.length ? `<div class="sc"><table class="tb2"><thead><tr><th>Reading</th><th>Chart</th><th>Signal</th><th>Cause found</th><th>Action taken</th><th class="noprint"></th></tr></thead><tbody>${A.sig.map((s, k) => `<tr><td><b>${esc(lblOf(ch, s.row))}</b></td><td>${esc(s.on)}</td><td>${esc(s.text)}</td>
      <td>${ed ? `<textarea rows="2" data-cause="${s.row.id}" placeholder="What made this happen?">${esc(s.row.cause || "")}</textarea>` : esc(s.row.cause || "—")}</td><td>${ed ? `<textarea rows="2" data-action="${s.row.id}" placeholder="What was done about it?">${esc(s.row.action || "")}</textarea>` : esc(s.row.action || "—")}</td>
      <td class="noprint">${canTask ? `<button class="btn s o" data-task="${k}">→ Task</button>` : ""}</td></tr>`).join("")}</tbody></table></div>${ed ? '<p class="mut noprint" style="font-size:12.5px;margin:4px 0 0">Cause and action are saved as soon as you leave the box.</p>' : ""}` : '<p style="margin:0">✔ No signals on any chart.</p>';
    let capH = "";
    if (vr) {
      if (!tol.ok) capH = `<p class="mut">Enter the specification in step 1 to see Cp, Cpk, Pp and Ppk.</p>`;
      else if (!hasF("spc.capability-analysis")) capH = `<p class="mut noprint">🔒 Capability analysis is not part of your plan. <a href="#" id="capLock">Find out how to add it</a></p>`;
      else if (cap) {
        const st = (v) => (v == null ? "" : `<span class="chip ${v >= 1.33 ? "g" : v >= 1 ? "a" : "r"}">${C.verdict(v)}</span>`), row = (a, b, v) => `<tr><td><b>${a}</b></td><td>${b}</td><td><b>${f(v, 2)}</b></td><td>${st(v)}</td></tr>`;
        capH = `<div class="two"><div><div class="sc"><table class="tb2"><thead><tr><th>Index</th><th>Meaning</th><th>Value</th><th>Verdict</th></tr></thead><tbody>${row("Cp", "spread within groups against the tolerance (potential capability)", cap.cp)}${row("Cpk", "Cp with centring (capability within groups)", cap.cpk)}${row("Pp", "overall spread against the tolerance (performance)", cap.pp)}${row("Ppk", "Pp with centring (performance)", cap.ppk)}${cap.cpm != null ? row("Cpm", "closeness to target", cap.cpm) : ""}</tbody></table></div>
          <p class="mut" style="font-size:12.5px;margin:6px 0 0">${cap.n} readings · mean ${f(cap.mean, d + 1)} · σ within ${f(cap.sdWithin, d + 2)} · σ overall ${f(cap.sdOverall, d + 2)} · skewness ${f(cap.skew, 2)} · kurtosis ${f(cap.kurt, 2)} · ${cap.outOfSpec} reading(s) outside the specification${cap.ppmWithin != null ? " · expected " + Math.round(cap.ppmWithin).toLocaleString("en-IN") + " ppm (within), " + Math.round(cap.ppmOverall).toLocaleString("en-IN") + " ppm (overall)" : ""}.</p></div><div>${svgHist(res.all, tol, cap, d)}</div></div>`;
      }
    }
    const few = (A.rows.length < 25 && vr && t !== "imr") || (A.rows.length < 100 && t === "imr");
    const concl = [sigN ? `<b>The process is not in statistical control:</b> ${sigN} point${sigN > 1 ? "s show" : " shows"} a signal. Find and remove the causes, then start a new study; capability figures are only a rough guide until then.` : "<b>The process is in statistical control</b> on the readings entered.",
      few ? `Only ${A.rows.length} ${t === "imr" ? "readings" : "groups"} so far. The manual asks for at least ${t === "imr" ? "100 readings" : "25 groups (100 or more readings)"} before the limits and indices are relied on.` : "",
      vr && cap && Math.abs(cap.skew) > 1 ? "The readings are clearly skewed. The indices assume a roughly normal distribution — check the histogram before quoting them." : "",
      vr && cap && cap.cpk != null ? `Capability: Cpk ${f(cap.cpk, 2)} and Ppk ${f(cap.ppk, 2)} — ${C.verdict(Math.min(cap.cpk, cap.ppk == null ? cap.cpk : cap.ppk)).toLowerCase()}. Usual customer limits: Ppk ≥ 1.67 for an initial study, Cpk ≥ 1.33 in production (follow your customer's requirement).` : ""].filter(Boolean);
    return `${head}<div class="kpis" style="margin-top:12px"><div class="kpi" style="cursor:default"><b>${ch.rows.length}</b><span>readings entered</span></div><div class="kpi" style="--c:${sigN ? "var(--r)" : "var(--g)"};cursor:default"><b>${sigN ? sigN : "None"}</b><span>points with a signal</span></div>${cap ? `<div class="kpi" style="cursor:default"><b>${f(cap.cpk, 2)}</b><span>Cpk</span></div><div class="kpi" style="cursor:default"><b>${f(cap.ppk, 2)}</b><span>Ppk</span></div>` : ""}</div>
      <h4 class="rt">Control charts</h4>${charts}<h4 class="rt">Centre lines and control limits</h4>${lim}<h4 class="rt">Signals, causes and actions</h4>${sigs}${vr ? `<h4 class="rt">Process capability and performance</h4>${capH}` : ""}
      <h4 class="rt">Conclusion</h4><ul style="margin:0 0 10px;padding-left:20px">${concl.map((x) => `<li>${x}</li>`).join("")}</ul>${ch.notes ? `<p><b>Notes:</b> ${esc(ch.notes)}</p>` : ""}
      <table class="tb2 sign"><tbody><tr><th>Prepared by</th><td>${esc(meta.by || "")}</td><th>Date</th><td></td><th>Reviewed / approved by</th><td></td><th>Date</th><td></td></tr></tbody></table>
      <p class="mut" style="font-size:11.5px;margin:6px 0 0">Prepared as an SPC study according to the AIAG Statistical Process Control manual (2nd edition): control charts with limits from the data, run-rule signals with cause and action, and process capability and performance indices.</p>`;
  }

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
