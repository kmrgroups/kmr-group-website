/* SPC Charts - screens. Data calls are kmr_spc_* (database) or spc-demo.js (?demo=1). Calculations are in spc-calc.js (checked against published values).
   Readings are typed or pasted in by hand; nothing is read from machines. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, C = window.SPCCalc;
  const S = { list: [], f: { q: "", status: "active", type: "" }, ch: null, an: null, dash: null, all: false };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const canEdit = () => !!QP.canEdit;
  const open = (h) => { $("#mb").innerHTML = h; $("#m").classList.add("on"); }, closeM = () => $("#m").classList.remove("on");
  $("#m").addEventListener("click", (e) => { if (e.target.id === "m") closeM(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeM(); });
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const TYPES = { xr: ["X̄-R chart", "Averages and ranges. Readings in small groups (2 to 10)."], xs: ["X̄-S chart", "Averages and standard deviations. Larger groups."], imr: ["I-MR chart", "Individual readings, one at a time."],
    p: ["p chart", "Fraction defective. The sample size may change."], np: ["np chart", "Number defective. The sample size stays the same."], c: ["c chart", "Number of defects. The area or quantity checked stays the same."], u: ["u chart", "Defects per unit. The quantity checked may change."] };
  const VAR = ["xr", "xs", "imr"], ATT = ["p", "np", "c", "u"];
  const num = (v) => { const n = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) ? n : null; };
  const nums = (s) => String(s || "").split(/[\s,;]+/).map(num).filter((x) => x != null);
  const dp = (ch) => { const xs = [ch.lsl, ch.usl, ch.target].map((v) => (v == null ? 0 : (String(v).split(".")[1] || "").length)); return Math.min(5, Math.max(2, ...xs) + 1); };
  const f = (v, d) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(d == null ? 3 : d));
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);

  /* ================= router ================= */
  async function route() {
    const hp = hashParts(); let go = ["std", "list", "chart", "dash"].includes(hp.go) ? hp.go : "std";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === (go === "chart" ? "list" : go)));
    ["std", "list", "chart", "dash"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    $("#fab").classList.toggle("hide", go !== "list" || !canEdit());
    say("");
    try {
      if (go === "std") KMRStd.draw($("#std"), "spc");
      else if (go === "list") await drawList();
      else if (go === "dash") await drawDash();
      else if (go === "chart") { if (!hp.id) return route2("list"); await openChart(hp.id); }
    } catch (e) { say(e.message); }
  }
  const route2 = (go) => { setGo("go=" + go); return route(); };
  window.addEventListener("hashchange", route);

  /* ================= register ================= */
  async function drawList() {
    S.list = await call("kmr_spc_list", { p: { status: S.f.status, chart_type: S.f.type, q: S.f.q } });
    const el = $("#list");
    el.innerHTML = `<p class="guide">One chart for one characteristic. Type or paste the readings, and the chart, the signals and the capability follow. Charts are kept here until you close them.</p>
      <div class="row"><input class="grow" id="fq" placeholder="Search number, title, part, characteristic…" value="${esc(S.f.q)}"><select id="fs" style="width:auto">${opts([["", "All"], ["active", "Active"], ["closed", "Closed"]], S.f.status)}</select>
      <select id="ft" style="width:auto">${opts([["", "All types"]].concat(Object.entries(TYPES).map(([k, v]) => [k, v[0]])), S.f.type)}</select>
      ${canEdit() ? '<button class="btn" id="nw">＋ New chart</button><label class="btn o" style="cursor:pointer">Import<input type="file" id="imp" accept=".json,application/json" hidden></label>' : ""}</div>
      ${S.list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>No.</th><th>Chart</th><th>Part · characteristic</th><th>Type</th><th>Points</th><th>Result</th><th></th></tr></thead><tbody>${S.list.map((c) => {
        const sm = c.summary || {}, sig = Number(sm.signals) || 0, cpk = sm.cpk != null && sm.cpk !== "" ? Number(sm.cpk) : null;
        return `<tr data-open="${c.id}" style="cursor:pointer"><td><b>${esc(c.no)}</b></td><td>${esc(c.title)}${c.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${esc([c.part_no, c.characteristic].filter(Boolean).join(" · ") || "—")}</td><td>${esc(TYPES[c.chart_type][0])}</td><td>${c.points}</td>
          <td>${c.points < 2 ? '<span class="mut">not enough readings</span>' : (sig ? `<span class="chip r">${sig} signal${sig > 1 ? "s" : ""}</span>` : '<span class="chip g">in control</span>') + (cpk != null ? ` <span class="chip ${cpk >= 1.33 ? "g" : cpk >= 1 ? "a" : "r"}">Cpk ${cpk.toFixed(2)}</span>` : "")}</td>
          <td>${c.status === "closed" ? '<span class="chip x">closed</span>' : ""}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="empty">No charts yet.<br>${canEdit() ? "Press <b>＋ New chart</b>, choose the type and enter the first readings." : "Ask an editor to create the first chart."}</div>`}`;
    let t; $("#fq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.f.q = e.target.value; drawList().then(() => { const i = $("#fq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    $("#fs").onchange = (e) => { S.f.status = e.target.value; drawList(); }; $("#ft").onchange = (e) => { S.f.type = e.target.value; drawList(); };
    if ($("#nw")) $("#nw").onclick = () => form(null); if ($("#imp")) $("#imp").onchange = importJson;
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => { setGo("go=chart&id=" + r.dataset.open); route(); }));
  }
  $("#fab").onclick = () => form(null);

  /* ================= chart form ================= */
  function form(ch) {
    const c = ch || { chart_type: "xr", subgroup_size: 5, rules: { rules: [1, 2, 3], run: 7, trend: 7 } }, ru = c.rules || { rules: [1, 2, 3], run: 7, trend: 7 };
    const types = Object.entries(TYPES).filter(([k]) => hasF(ATT.includes(k) ? "spc.attribute-charts" : "spc.variable-charts") || (ch && ch.chart_type === k));
    open(`<h3 style="margin:0 0 10px">${ch ? "Chart " + esc(ch.no) : "New chart"}</h3>
      <div class="frm"><div class="w"><label>Title *</label><input id="f_title" value="${esc(c.title || "")}" placeholder="e.g. Shaft diameter — turning"></div>
      <div><label>Part number</label><input id="f_part_no" value="${esc(c.part_no || "")}"></div><div><label>Part name</label><input id="f_part_name" value="${esc(c.part_name || "")}"></div>
      <div><label>Characteristic</label><input id="f_characteristic" value="${esc(c.characteristic || "")}" placeholder="e.g. Diameter 20.00 ±0.10"></div><div><label>Process / machine</label><input id="f_process" value="${esc(c.process || "")}"></div>
      <div><label>Unit of measure</label><input id="f_unit" value="${esc(c.unit || "")}" placeholder="mm"></div>
      <div><label>Chart type *</label><select id="f_type"${ch && ch.points ? " disabled" : ""}>${opts(types.map(([k, v]) => [k, v[0]]), c.chart_type)}</select></div>
      <div id="f_subw"><label id="f_sublbl">Readings in each group</label><input id="f_sub" type="number" min="1" max="25" value="${esc(c.subgroup_size || 5)}"></div>
      <div class="w mut" id="f_hint" style="font-size:12.5px"></div>
      <div class="w" id="f_specw"><div class="frm"><div><label>Lower spec limit (LSL)</label><input id="f_lsl" inputmode="decimal" value="${esc(c.lsl ?? "")}"></div><div><label>Upper spec limit (USL)</label><input id="f_usl" inputmode="decimal" value="${esc(c.usl ?? "")}"></div><div><label>Target</label><input id="f_target" inputmode="decimal" value="${esc(c.target ?? "")}"></div></div></div>
      <div class="w"><label>Signals to look for</label><div class="seg" id="f_rules">${[[1, "1 · Point outside the limits"], [2, "2 · Run on one side of the centre"], [3, "3 · Steady rise or fall"], [4, "4 · 2 of 3 beyond 2σ"], [5, "5 · 4 of 5 beyond 1σ"]].map(([k, l]) => `<button type="button" data-r="${k}" class="${(ru.rules || []).includes(k) ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div><label>Run length (rule 2)</label><input id="f_run" type="number" min="5" max="12" value="${esc(ru.run || 7)}"></div><div><label>Rise / fall length (rule 3)</label><input id="f_trend" type="number" min="5" max="12" value="${esc(ru.trend || 7)}"></div>
      <div><label>Work out the limits from the first … points <span class="mut">(blank = all)</span></label><input id="f_lf" type="number" min="3" value="${esc(c.limits_from || "")}"></div>
      <div class="w"><label>Notes</label><textarea id="f_notes" rows="2">${esc(c.notes || "")}</textarea></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="f_save">Save</button><button class="btn o" id="f_x">Cancel</button></div>`);
    const upd = () => {
      const t = V("f_type"), vr = VAR.includes(t);
      $("#f_subw").classList.toggle("hide", t === "imr" || t === "c" || t === "p" || t === "u"); $("#f_sublbl").textContent = t === "np" ? "Sample size (same every time)" : "Readings in each group";
      $("#f_specw").classList.toggle("hide", !vr); $("#f_hint").textContent = TYPES[t][1];
    };
    $("#f_type").onchange = upd; upd();
    $("#f_rules").querySelectorAll("button").forEach((b) => (b.onclick = () => b.classList.toggle("on")));
    $("#f_x").onclick = closeM;
    $("#f_save").onclick = async () => {
      const t = ch && ch.points ? ch.chart_type : V("f_type"), p = { id: ch && ch.id, title: V("f_title"), part_no: V("f_part_no"), part_name: V("f_part_name"), characteristic: V("f_characteristic"), process: V("f_process"), unit: V("f_unit"), chart_type: t,
        subgroup_size: t === "imr" ? 1 : V("f_sub"), lsl: V("f_lsl"), usl: V("f_usl"), target: V("f_target"), notes: V("f_notes"), limits_from: V("f_lf") === "" ? null : V("f_lf"),
        rules: { rules: [...$("#f_rules").querySelectorAll("button.on")].map((b) => Number(b.dataset.r)), run: Number(V("f_run")) || 7, trend: Number(V("f_trend")) || 7 } };
      if (!p.rules.rules.length) { alert("Choose at least one signal to look for."); return; }
      try { const r = await call("kmr_spc_save", { p }); closeM(); say("Saved.", true); setGo("go=chart&id=" + r.id); route(); } catch (e) { alert(e.message); }
    };
  }

  /* ================= analysis ================= */
  function analyse(ch, rows) {
    const t = ch.chart_type, vr = VAR.includes(t), A = { vr, rows: [], vals: [], lim: [], dvals: [], dlim: [], res: null, sig: [], flagged: {}, dflagged: {}, cap: null };
    if (vr) {
      const use = rows.map((r) => ({ r, v: (r.vals || []).map(Number).filter(Number.isFinite) })).filter((x) => (t === "imr" ? x.v.length >= 1 : x.v.length >= 2));
      A.rows = use.map((x) => x.r); if (use.length < 2) return A;
      const lf = Number(ch.limits_from) || 0;
      const res = t === "imr" ? C.imrChart(use.map((x) => x.v[0]), { limitsFrom: lf }) : C.xbarChart(use.map((x) => x.v), t, { limitsFrom: lf });
      if (!res) return A; A.res = res; A.vals = res.means; A.lim = res.lim.map((l) => l.x); A.dvals = res.disp; A.dlim = res.lim.map((l) => l.d);
      if ((ch.lsl != null || ch.usl != null) && hasF("spc.capability-analysis")) A.cap = C.capability(res.all, res.sigma, ch.lsl, ch.usl, ch.target);
    } else {
      const use = rows.map((r) => ({ r, d: num((r.vals || [])[0]), n: t === "c" ? 1 : num((r.vals || [])[1]) })).filter((x) => x.d != null && x.d >= 0 && (t === "c" || (x.n != null && x.n > 0)));
      A.rows = use.map((x) => x.r); if (!use.length) return A;
      const res = C.attrChart(use.map((x) => ({ d: x.d, n: x.n })), t); if (!res) return A; A.res = res; A.vals = res.val; A.lim = res.lim;
    }
    const ru = ch.rules || { rules: [1, 2, 3], run: 7, trend: 7 };
    C.rules(A.vals, A.lim, ru).forEach((s) => { A.sig.push({ i: s.i, row: A.rows[s.i], rule: s.rule, text: s.text, on: vr ? (ch.chart_type === "imr" ? "Individuals" : "Averages") : TYPES[t][0] }); A.flagged[s.i] = 1; });
    if (vr) C.rules(A.dvals.map((v) => (v == null ? NaN : v)), A.dlim, { rules: [1] }).forEach((s) => { A.sig.push({ i: s.i, row: A.rows[s.i], rule: 1, text: RULE1D[t], on: t === "xr" ? "Range" : t === "xs" ? "Std. deviation" : "Moving range" }); A.dflagged[s.i] = 1; });
    A.sig.sort((a, b) => a.i - b.i);
    return A;
  }
  const RULE1D = { xr: "A range is outside its limit — the spread changed", xs: "A standard deviation is outside its limit — the spread changed", imr: "A moving range is outside its limit — the readings jumped" };
  const RULEN = { 1: "Point outside the limits", 2: "Run on one side of the centre line", 3: "Steady rise or fall", 4: "2 of 3 beyond 2 sigma", 5: "4 of 5 beyond 1 sigma" };

  /* ================= SVG ================= */
  function svgLine(title, vals, lim, labels, flagged, o) {
    o = o || {}; const W = 780, H = 230, L = 54, R = 74, T = 12, B = 26, n = vals.length, d = o.d == null ? 3 : o.d;
    const ys = []; vals.forEach((v) => Number.isFinite(v) && ys.push(v)); lim.forEach((l) => [l.ucl, l.lcl, l.cl].forEach((v) => Number.isFinite(v) && ys.push(v)));
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
    const X = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
    const path = (k) => lim.map((l, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(l[k]).toFixed(1)).join("");
    const last = lim[n - 1], tick = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4), step = Math.max(1, Math.ceil(n / 12));
    return `<div class="cc"><h4>${esc(title)}</h4><svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e9f2" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(d)}</text>`).join("")}
      <path d="${path("ucl")}" fill="none" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="6 4"/><path d="${path("lcl")}" fill="none" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="6 4"/><path d="${path("cl")}" fill="none" stroke="#16a34a" stroke-width="1.4"/>
      <text x="${W - R + 4}" y="${Y(last.ucl) + 4}" fill="#dc2626">UCL ${last.ucl.toFixed(d)}</text><text x="${W - R + 4}" y="${Y(last.cl) + 4}" fill="#16a34a">CL ${last.cl.toFixed(d)}</text><text x="${W - R + 4}" y="${Y(last.lcl) + 4}" fill="#dc2626">LCL ${last.lcl.toFixed(d)}</text>
      <polyline fill="none" stroke="#0f766e" stroke-width="1.6" points="${vals.map((v, i) => (Number.isFinite(v) ? X(i).toFixed(1) + "," + Y(v).toFixed(1) : "")).filter(Boolean).join(" ")}"/>
      ${vals.map((v, i) => (Number.isFinite(v) ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${flagged[i] ? 5.5 : 3.4}" fill="${flagged[i] ? "#dc2626" : "#0f766e"}" stroke="#fff" stroke-width="1"${o.pick ? ` data-pick="${i}" style="cursor:pointer"` : ""}><title>${esc(labels[i])}: ${v.toFixed(d)}</title></circle>` : "")).join("")}
      ${labels.map((lb, i) => (i % step === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(String(lb).slice(0, 8))}</text>` : "")).join("")}</svg></div>`;
  }
  function svgHist(X, ch, cap) {
    const H = C.histogram(X), W = 780, Ht = 190, L = 20, R = 20, T = 14, B = 30; if (!H.counts.length) return "";
    const lo = Math.min(H.edges[0], ch.lsl != null ? Number(ch.lsl) : Infinity), hi = Math.max(H.edges[H.edges.length - 1], ch.usl != null ? Number(ch.usl) : -Infinity), span = hi - lo || 1;
    const x = (v) => L + ((v - lo) / span) * (W - L - R), mx = Math.max(...H.counts), y = (c) => T + (1 - c / mx) * (Ht - T - B), d = dp(ch);
    const vline = (v, col, lbl) => (v == null ? "" : `<line x1="${x(Number(v))}" x2="${x(Number(v))}" y1="${T}" y2="${Ht - B}" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 3"/><text x="${x(Number(v))}" y="${T - 2}" text-anchor="middle" fill="${col}">${lbl} ${Number(v).toFixed(d)}</text>`);
    return `<div class="cc"><h4>Histogram of all readings</h4><svg class="svgw" viewBox="0 0 ${W} ${Ht}">${H.counts.map((c, i) => `<rect x="${x(H.edges[i]) + 1}" y="${y(c)}" width="${Math.max(1, x(H.edges[i + 1]) - x(H.edges[i]) - 2)}" height="${Ht - B - y(c)}" fill="#14b8a6" opacity=".8"/>`).join("")}
      ${vline(ch.lsl, "#dc2626", "LSL")}${vline(ch.usl, "#dc2626", "USL")}${vline(ch.target, "#2563eb", "Target")}${cap ? vline(cap.mean, "#16a34a", "Mean") : ""}
      <line x1="${L}" x2="${W - R}" y1="${Ht - B}" y2="${Ht - B}" stroke="#94a3b8"/>${[lo, lo + span / 2, hi].map((v) => `<text x="${x(v)}" y="${Ht - 10}" text-anchor="middle">${v.toFixed(d)}</text>`).join("")}</svg></div>`;
  }

  /* ================= chart screen ================= */
  async function openChart(id) {
    S.ch = await call("kmr_spc_get", { p_id: id }); render();
  }
  function rowText(ch, r) {
    const v = r.vals || [];
    if (VAR.includes(ch.chart_type)) return v.map((x) => Number(x)).filter(Number.isFinite).map((x) => Math.round(x * 1e6) / 1e6).join("  ");
    return ch.chart_type === "c" ? `${v[0]} defects` : ch.chart_type === "u" ? `${v[0]} defects in ${v[1]}` : `${v[0]} of ${v[1]}`;
  }
  function render() {
    const ch = S.ch, rows = ch.rows, el = $("#chart"), ed = canEdit() && ch.status === "active", A = (S.an = analyse(ch, rows)), vr = A.vr, d = dp(ch);
    const lbl = A.rows.map((r) => r.label || "#" + r.seq);
    const sigN = new Set(A.sig.map((s) => s.i)).size, cap = A.cap;
    const kp = (a, b, c) => `<div class="kpi" style="--c:${c || "var(--b1)"};cursor:default"><b>${a}</b><span>${b}</span></div>`;
    const capc = (v) => (v == null ? "var(--mut)" : v >= 1.33 ? "var(--g)" : v >= 1 ? "var(--a)" : "var(--r)");
    el.innerHTML = `<div class="row noprint"><a href="#go=list" class="btn o s">← Charts</a><div style="flex:1"></div>
        ${ed ? '<button class="btn o s" id="b_edit">Edit chart</button>' : ""}<button class="btn o s" id="b_print">Print</button><button class="btn o s" id="b_exp">Export</button>
        ${canEdit() ? `<button class="btn o s" id="b_close">${ch.status === "active" ? "Close chart" : "Reopen chart"}</button><button class="btn r s" id="b_del">Delete</button>` : ""}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin-bottom:6px"><h2 style="margin:0">${esc(ch.title)}</h2><span class="chip b">${esc(TYPES[ch.chart_type][0])}</span>${ch.status === "closed" ? '<span class="chip x">closed</span>' : ""}${ch.sample ? '<span class="pillw">sample</span>' : ""}</div>
      <div class="mut" style="margin-bottom:12px">${esc(ch.no)}${ch.part_no ? " · " + esc(ch.part_no) + (ch.part_name ? " " + esc(ch.part_name) : "") : ""}${ch.characteristic ? " · " + esc(ch.characteristic) : ""}${ch.process ? " · " + esc(ch.process) : ""}${ch.unit ? " · unit " + esc(ch.unit) : ""}${ch.lsl != null || ch.usl != null ? " · spec " + f(ch.lsl, d) + " to " + f(ch.usl, d) : ""}</div>
      <div class="kpis">${kp(rows.length, "readings entered")}${kp(A.res ? (sigN ? sigN + " point" + (sigN > 1 ? "s" : "") : "None") : "—", "points with a signal", !A.res ? "" : sigN ? "var(--r)" : "var(--g)")}
        ${vr && A.res ? kp(f(A.res.grand, d), "average") + kp(f(A.res.sigma, d + 1), "σ within (from the chart)") : ""}${cap ? kp(f(cap.cp, 2), "Cp", capc(cap.cp)) + kp(f(cap.cpk, 2), "Cpk — " + C.verdict(cap.cpk), capc(cap.cpk)) + kp(f(cap.pp, 2), "Pp", capc(cap.pp)) + kp(f(cap.ppk, 2), "Ppk — " + C.verdict(cap.ppk), capc(cap.ppk)) : ""}</div>
      ${A.res ? "" : `<div class="empty">${rows.length ? "Enter at least " + (vr ? "two groups" : "two readings") + " to draw the chart." : "No readings yet. Add them below — type a group at a time, or paste many."}</div>`}
      <div id="charts">${A.res ? (vr ? svgLine(ch.chart_type === "imr" ? "Individual readings (I)" : "Averages (X̄)", A.vals, A.lim, lbl, A.flagged, { d: d + 1, pick: 1 }) + svgLine(ch.chart_type === "xr" ? "Ranges (R)" : ch.chart_type === "xs" ? "Standard deviations (S)" : "Moving ranges (MR)", A.dvals.map((v) => (v == null ? NaN : v)), A.dlim, lbl, A.dflagged, { d: d + 1 })
        : svgLine(TYPES[ch.chart_type][0], A.vals, A.lim, lbl, A.flagged, { d: ch.chart_type === "p" || ch.chart_type === "u" ? 4 : 2, pick: 1 })) : ""}</div>
      ${A.res ? signalsHtml(ch, A, ed) : ""}
      ${vr && A.res ? capHtml(ch, A) : ""}
      <h3 style="margin:16px 0 6px" class="noprint">Readings</h3>${ed ? entryHtml(ch) : ""}${tableHtml(ch, A, ed)}
      ${ch.notes ? `<p class="mut"><b>Notes:</b> ${esc(ch.notes)}</p>` : ""}`;
    wire(ch, A);
    // keep the register and dashboard in step with what the screen shows
    if (canEdit() && A.res) {
      const sm = { signals: sigN, headline: sigN ? sigN + " point" + (sigN > 1 ? "s" : "") + " with a signal" : "In control" };
      if (cap) { sm.cap = true; sm.cpk = cap.cpk != null ? Math.round(cap.cpk * 100) / 100 : null; sm.ppk = cap.ppk != null ? Math.round(cap.ppk * 100) / 100 : null; }
      if (JSON.stringify(sm) !== JSON.stringify(ch.summary || null)) { ch.summary = sm; call("kmr_spc_summary", { p_chart: ch.id, p_summary: sm }).catch(() => {}); }
    }
  }
  function signalsHtml(ch, A, ed) {
    if (!A.sig.length) return `<div class="card"><h3>Signals</h3><p style="margin:0" class="mut">✔ No signals. The process looks stable on these readings${A.rows.length < 20 ? " — with fewer than 20 groups the limits are only a first look" : ""}.</p></div>`;
    const canTask = !!(window.KMRTask && KMRTask.on) && ed;
    return `<div class="card"><h3>Signals — what to do</h3><p class="mut" style="margin:0 0 8px;font-size:13px">Each signal needs a cause and an action. Write them down; the record stays with the reading.</p><div class="sc"><table class="tb2"><thead><tr><th>Reading</th><th>Chart</th><th>Signal</th><th>Cause</th><th>Action</th><th class="noprint"></th></tr></thead><tbody>${A.sig.map((s, k) => `<tr><td><b>${esc(s.row.label || "#" + s.row.seq)}</b></td><td>${esc(s.on)}</td><td>${esc(s.text)}</td><td>${esc(s.row.cause || "") || '<span class="mut">—</span>'}</td><td>${esc(s.row.action || "") || '<span class="mut">—</span>'}</td>
      <td class="noprint" style="white-space:nowrap">${ed ? `<button class="btn s o" data-note="${s.row.id}">Cause &amp; action</button>` : ""}${canTask ? ` <button class="btn s o" data-task="${k}">→ Task</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function capHtml(ch, A) {
    if (ch.lsl == null && ch.usl == null) return `<div class="card"><h3>Capability</h3><p class="mut" style="margin:0">Enter the specification limits (Edit chart) to see Cp, Cpk, Pp and Ppk.</p></div>`;
    if (!hasF("spc.capability-analysis")) return `<div class="card"><h3>Capability</h3><p class="mut" style="margin:0">🔒 Capability analysis is not part of your plan. <a href="#" id="capLock">Find out how to add it</a></p></div>`;
    const c = A.cap; if (!c) return "";
    const d = dp(ch), row = (a, b, v, p) => `<tr><td>${a}</td><td>${b}</td><td><b>${f(v, 2)}</b></td><td>${p || ""}</td></tr>`, st = (v) => (v == null ? "" : `<span class="chip ${v >= 1.33 ? "g" : v >= 1 ? "a" : "r"}">${C.verdict(v)}</span>`);
    const stable = A.sig.length === 0;
    return `<div class="card"><h3>Process capability</h3>${stable ? "" : '<p class="msg" style="background:#fef3c7;color:#92400e">The chart has signals, so the process is not stable. Capability figures are only a rough guide until the causes are removed.</p>'}
      <div class="two"><div class="sc"><table class="tb2"><thead><tr><th>Index</th><th>Based on</th><th>Value</th><th></th></tr></thead><tbody>
        ${row("Cp", "spread within groups", c.cp, st(c.cp))}${row("Cpk", "spread within groups, centring", c.cpk, st(c.cpk))}${row("Pp", "overall spread", c.pp, st(c.pp))}${row("Ppk", "overall spread, centring", c.ppk, st(c.ppk))}${c.cpm != null ? row("Cpm", "distance from target", c.cpm) : ""}</tbody></table>
        <p class="mut" style="font-size:12.5px;margin:8px 0 0">${c.n} readings · average ${f(c.mean, d + 1)} · σ within ${f(c.sdWithin, d + 2)} · σ overall ${f(c.sdOverall, d + 2)} · ${c.outOfSpec} reading(s) outside spec${c.ppmWithin != null ? " · expected " + Math.round(c.ppmWithin).toLocaleString("en-IN") + " ppm (within), " + Math.round(c.ppmOverall).toLocaleString("en-IN") + " ppm (overall)" : ""}</p>
        <p class="mut" style="font-size:12.5px;margin:6px 0 0">Guide: 1.67 or more capable · 1.33 to 1.67 acceptable · 1.00 to 1.33 marginal · below 1.00 not capable. Use your customer's own requirement when it is stricter.</p></div>
      <div>${svgHist(A.res.all, ch, c)}</div></div></div>`;
  }
  function entryHtml(ch) {
    const t = ch.chart_type, n = VAR.includes(t) ? (t === "imr" ? 1 : ch.subgroup_size) : t === "c" ? 1 : 2;
    const ph = VAR.includes(t) ? Array.from({ length: n }, (_, i) => "x" + (i + 1)) : t === "c" ? ["defects"] : t === "np" ? ["defectives", "sample"] : t === "p" ? ["defectives", "sample"] : ["defects", "units"];
    const next = (ch.rows.length ? Math.max(...ch.rows.map((r) => r.seq)) : 0) + 1;
    return `<div class="card noprint"><h3>Add a reading</h3><div class="gr"><input id="e_label" placeholder="Label (#${next})" style="width:130px">${ph.map((p, i) => `<input class="e_v" data-i="${i}" inputmode="decimal" placeholder="${esc(p)}"${t === "np" && i === 1 ? ` value="${esc(ch.subgroup_size)}"` : ""}>`).join("")}<input id="e_note" placeholder="Note (optional)" style="width:180px"><button class="btn" id="e_add">Add</button></div>
      <details style="margin-top:8px"><summary style="cursor:pointer;color:var(--b1);font-weight:600">Paste many ${VAR.includes(t) ? "groups" : "rows"} from Excel</summary>
      <p class="mut" style="font-size:12.5px;margin:6px 0">${VAR.includes(t) ? (t === "imr" ? "One reading per line." : "One group per line, readings separated by a tab, comma or space.") : "One row per line: " + (t === "c" ? "number of defects." : "number found, then the sample size, separated by a tab, comma or space.")} A first column with text is used as the label.</p>
      <textarea id="e_paste" rows="5" placeholder="${VAR.includes(t) ? "20.01\t19.98\t20.02\t20.00\t19.99" : "3\t100"}"></textarea><div class="row" style="margin:8px 0 0"><button class="btn o" id="e_padd">Add pasted rows</button><span class="mut" id="e_pc"></span></div></details></div>`;
  }
  function parsePaste(ch, txt) {
    const out = [];
    String(txt || "").split(/\r?\n/).forEach((ln) => {
      ln = ln.trim(); if (!ln) return; const parts = ln.split(/[\t,;]+|\s{2,}|\s+/).filter((x) => x !== ""); let label = null;
      if (parts.length && num(parts[0]) == null) label = parts.shift();
      let v = parts.map(num).filter((x) => x != null);
      if (VAR.includes(ch.chart_type)) { if (ch.chart_type === "imr") v = v.slice(0, 1); else v = v.slice(0, 25); if (!v.length) return; }
      else if (ch.chart_type === "c") { v = v.slice(0, 1); if (!v.length) return; }
      else { if (v.length === 1 && ch.chart_type === "np") v.push(ch.subgroup_size); if (v.length < 2) return; v = v.slice(0, 2); }
      out.push({ label, vals: v });
    });
    return out;
  }
  function tableHtml(ch, A, ed) {
    const rows = ch.rows, show = S.all ? rows : rows.slice(-40), vr = VAR.includes(ch.chart_type);
    const pos = new Map(A.rows.map((r, i) => [r.id, i]));
    if (!rows.length) return "";
    return `<div class="sc"><table class="tb2"><thead><tr><th>Label</th><th>${vr ? "Readings" : "Counts"}</th><th>${vr ? (ch.chart_type === "imr" ? "" : "Average") : "Plotted"}</th><th>Note</th><th class="noprint"></th></tr></thead><tbody>${show.map((r) => {
      const i = pos.get(r.id), flagged = i != null && (A.flagged[i] || A.dflagged[i]);
      return `<tr${flagged ? ' style="background:#fee2e2"' : ""}><td>${esc(r.label || "#" + r.seq)}</td><td>${esc(rowText(ch, r))}</td><td>${i != null && Number.isFinite(A.vals[i]) ? A.vals[i].toFixed(vr ? dp(ch) + 1 : 4) : "—"}</td><td>${esc([r.note, r.cause ? "Cause: " + r.cause : "", r.action ? "Action: " + r.action : ""].filter(Boolean).join(" · "))}</td>
        <td class="noprint" style="white-space:nowrap">${ed ? `<button class="btn s o" data-ed="${r.id}">Edit</button> <button class="btn s r" data-rm="${r.id}">✕</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>${rows.length > 40 ? `<p class="noprint"><a href="#" id="showAll">${S.all ? "Show only the last 40" : "Show all " + rows.length + " readings"}</a></p>` : ""}`;
  }

  /* ================= wiring ================= */
  function wire(ch, A) {
    const b = (id, fn) => { const e = $("#" + id); if (e) e.onclick = fn; };
    b("b_edit", () => form(ch)); b("b_print", () => window.print()); b("b_exp", () => exportJson(ch));
    b("b_close", async () => { try { await call("kmr_spc_save", { p: Object.assign({}, ch, { status: ch.status === "active" ? "closed" : "active" }) }); await openChart(ch.id); } catch (e) { say(e.message); } });
    b("b_del", async () => { if (!confirm("Delete this chart and all its readings? This cannot be undone.")) return; try { await call("kmr_spc_delete", { p_id: ch.id }); say("Chart deleted.", true); route2("list"); } catch (e) { say(e.message); } });
    b("showAll", (e) => { e.preventDefault(); S.all = !S.all; render(); }); b("capLock", (e) => { e.preventDefault(); if (window.KMRLock) KMRLock.need("spc.capability-analysis"); });
    const add = async (rows) => { try { await call("kmr_spc_points_add", { p_chart: ch.id, p_rows: rows }); await openChart(ch.id); say(rows.length + (rows.length > 1 ? " readings added." : " reading added."), true); } catch (e) { say(e.message); } };
    b("e_add", () => {
      const vals = [...document.querySelectorAll(".e_v")].map((i) => num(i.value)), t = ch.chart_type;
      let v = vals.filter((x) => x != null);
      if (VAR.includes(t)) { if (v.length < (t === "imr" ? 1 : 2)) { say("Enter " + (t === "imr" ? "the reading." : "at least two readings in the group.")); return; } }
      else if (t === "c") { if (v.length < 1) { say("Enter the number of defects."); return; } }
      else if (vals[0] == null || vals[1] == null || vals[1] <= 0) { say("Enter the number found and the sample size."); return; } else v = [vals[0], vals[1]];
      add([{ label: V("e_label").trim() || null, vals: v, note: V("e_note").trim() || null, taken_at: new Date().toISOString() }]);
    });
    const pa = $("#e_paste"); if (pa) pa.oninput = () => { $("#e_pc").textContent = parsePaste(ch, pa.value).length + " row(s) found"; };
    b("e_padd", () => { const r = parsePaste(ch, V("e_paste")); if (!r.length) { say("Nothing to add — check that the lines hold numbers."); return; } add(r.slice(0, 500).map((x) => ({ label: x.label, vals: x.vals }))); });
    document.querySelectorAll(".e_v").forEach((i, k, all) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (k < all.length - 1) all[k + 1].focus(); else $("#e_add").click(); } }));
    document.querySelectorAll("[data-ed]").forEach((x) => (x.onclick = () => editRow(ch, ch.rows.find((r) => r.id === x.dataset.ed))));
    document.querySelectorAll("[data-note]").forEach((x) => (x.onclick = () => editRow(ch, ch.rows.find((r) => r.id === x.dataset.note), true)));
    document.querySelectorAll("[data-rm]").forEach((x) => (x.onclick = async () => { if (!confirm("Delete this reading?")) return; try { await call("kmr_spc_point_delete", { p_id: x.dataset.rm }); await openChart(ch.id); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-pick]").forEach((x) => (x.onclick = () => { const r = A.rows[Number(x.dataset.pick)]; if (r && canEdit() && ch.status === "active") editRow(ch, r, true); }));
    document.querySelectorAll("[data-task]").forEach((x) => (x.onclick = () => {
      const s = A.sig[Number(x.dataset.task)], lb = s.row.label || "#" + s.row.seq;
      KMRTask.assign([{ title: `SPC signal on ${ch.title} (${lb})`, detail: [s.text, s.row.cause ? "Cause: " + s.row.cause : "", s.row.action ? "Action: " + s.row.action : "", `${ch.no} · ${TYPES[ch.chart_type][0]}`].filter(Boolean).join("\n"), who: "", priority: s.rule === 1 ? "high" : "normal",
        source_app: "spc", source_ref: s.row.id, source_label: ch.no + " " + lb, tags: "SPC", source_url: `/it/spc.html?${QP.DEMO ? "demo=1" : "kmr=1&co=" + encodeURIComponent(QP.slug)}#go=chart&id=${ch.id}` }]);
    }));
  }
  function editRow(ch, r, focusNote) {
    if (!r) return; const vr = VAR.includes(ch.chart_type);
    open(`<h3 style="margin:0 0 10px">Reading ${r.seq}</h3><div class="frm"><div><label>Label</label><input id="r_label" value="${esc(r.label || "")}"></div>
      <div class="w"><label>${vr ? "Readings" : ch.chart_type === "c" ? "Defects" : "Number found, then sample size"} (separate with spaces)</label><input id="r_vals" value="${esc((r.vals || []).join(" "))}"></div>
      <div class="w"><label>Note</label><input id="r_note" value="${esc(r.note || "")}"></div>
      <div class="w"><label>Cause of the signal</label><textarea id="r_cause" rows="2" placeholder="What made this happen?">${esc(r.cause || "")}</textarea></div>
      <div class="w"><label>Action taken</label><textarea id="r_action" rows="2" placeholder="What was done about it?">${esc(r.action || "")}</textarea></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="r_save">Save</button><button class="btn o" id="r_x">Cancel</button></div>`);
    if (focusNote) $("#r_cause").focus(); $("#r_x").onclick = closeM;
    $("#r_save").onclick = async () => {
      const v = nums(V("r_vals")); if (vr ? v.length < (ch.chart_type === "imr" ? 1 : 2) : ch.chart_type === "c" ? v.length < 1 : v.length < 2) { alert("Check the readings."); return; }
      try { await call("kmr_spc_point_save", { p: { id: r.id, label: V("r_label"), vals: v, note: V("r_note"), cause: V("r_cause"), action: V("r_action") } }); closeM(); await openChart(ch.id); say("Saved.", true); } catch (e) { alert(e.message); }
    };
  }

  /* ================= export / import ================= */
  function exportJson(ch) {
    const o = { kmr: "spc-chart", version: 1, chart: { title: ch.title, part_no: ch.part_no, part_name: ch.part_name, characteristic: ch.characteristic, process: ch.process, unit: ch.unit, chart_type: ch.chart_type, subgroup_size: ch.subgroup_size, lsl: ch.lsl, usl: ch.usl, target: ch.target, rules: ch.rules, limits_from: ch.limits_from, notes: ch.notes },
      rows: ch.rows.map((r) => ({ label: r.label, taken_at: r.taken_at, vals: r.vals, note: r.note, cause: r.cause, action: r.action })) };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = (ch.no + "-" + ch.title).replace(/[^\w.-]+/g, "_") + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importJson(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      const o = JSON.parse(await file.text()); if (o.kmr !== "spc-chart" || !o.chart) throw new Error("This is not an SPC Charts export.");
      const r = await call("kmr_spc_save", { p: Object.assign({}, o.chart, { id: null }) });
      const rows = (o.rows || []).map((x) => ({ label: x.label, taken_at: x.taken_at, vals: x.vals, note: x.note }));
      for (let i = 0; i < rows.length; i += 400) await call("kmr_spc_points_add", { p_chart: r.id, p_rows: rows.slice(i, i + 400) });
      say("Imported " + rows.length + " readings.", true); setGo("go=chart&id=" + r.id); route();
    } catch (er) { say(er.message); } e.target.value = "";
  }

  /* ================= dashboard ================= */
  async function drawDash() {
    const d = (S.dash = await call("kmr_spc_dashboard")), el = $("#dash");
    const list = (a) => (a && a.length ? a.map((c) => `<div class="t" data-open="${c.id}"><div class="tb"><div class="tt">${esc(c.no)} · ${esc(c.title)}</div><div class="tm"><span>${esc(TYPES[c.chart_type][0])}</span><span>${c.points} readings</span>${c.summary && c.summary.signals ? `<span class="late">${c.summary.signals} signal(s)</span>` : ""}${c.summary && c.summary.cpk != null ? `<span>Cpk ${Number(c.summary.cpk).toFixed(2)}</span>` : ""}</div></div></div>`).join("") : '<div class="empty">Nothing here.</div>');
    el.innerHTML = `<div class="kpis"><div class="kpi"><b>${d.charts}</b><span>charts</span></div><div class="kpi"><b>${d.active}</b><span>active</span></div><div class="kpi" style="--c:var(--r)"><b>${d.signals}</b><span>with signals</span></div><div class="kpi" style="--c:var(--a)"><b>${d.low_cpk}</b><span>Cpk below 1.33</span></div></div>
      <div class="two"><div class="card"><h3>Needs attention</h3>${list(d.attention)}</div><div class="card"><h3>Recently updated</h3>${list(d.recent)}</div></div>`;
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => { setGo("go=chart&id=" + r.dataset.open); route(); }));
  }

  (async () => {
    try {
      await QP.init("spc"); if (!QP.ctx) return;
      if (window.KMRTask) await KMRTask.init({ call: QP.call, slug: QP.slug, token: async () => { const r = QP.sb && (await QP.sb.auth.getSession()); return r && r.data.session ? r.data.session.access_token : null; } });
      await route();
    } catch (e) { say(e.message); }
  })();
})();
