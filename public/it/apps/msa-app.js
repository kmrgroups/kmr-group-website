/* MSA Studies - screens. Data calls are kmr_msa_* (database) or msa-demo.js (?demo=1). Calculations are in msa-calc.js / spc-calc.js (checked against the AIAG MSA 4th ed. Gage R&R example).
   Readings are typed or pasted in by hand. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, M = window.MSACalc, C = window.SPCCalc;
  const S = { list: [], f: { q: "", type: "", decision: "", status: "" }, st: null, view: 0, ap: 0, method: "anova", dash: null };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const open = (h) => { $("#mb").innerHTML = h; $("#m").classList.add("on"); }, closeM = () => $("#m").classList.remove("on");
  $("#m").addEventListener("click", (e) => { if (e.target.id === "m") closeM(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeM(); });
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const TYPES = { grr: ["Gage R&R", "Repeatability and reproducibility of a gauge: several appraisers measure the same parts more than once.", "msa.gage-r-r"],
    bias: ["Bias", "One master part with a known value, measured many times.", "msa.bias-linearity-stability"],
    linearity: ["Linearity", "Masters across the working range, each measured several times: does the bias change with size?", "msa.bias-linearity-stability"],
    stability: ["Stability", "A master measured on a regular schedule and plotted on a control chart.", "msa.bias-linearity-stability"],
    attribute: ["Attribute agreement", "Go / no-go checks by several appraisers on parts whose true status is known.", "msa.attribute-agreement"] };
  const DEC = { Acceptable: "g", Conditional: "a", "Not acceptable": "r" };
  const num = (v) => { const n = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) ? n : null; };
  const nums = (s) => String(s || "").split(/[\s,;]+/).map(num).filter((x) => x != null);
  const f = (v, d) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(d == null ? 4 : d));
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const canEdit = () => !!QP.canEdit;
  const isFinal = () => S.st && S.st.status === "final";
  const editable = () => canEdit() && S.st && !isFinal();
  const chip = (d) => (d ? `<span class="chip ${DEC[d] || "x"}">${esc(d)}</span>` : '<span class="chip x">not calculated</span>');
  const dpx = (st) => Math.min(5, Math.max(3, ...[st.lsl, st.usl].map((v) => (v == null ? 0 : (String(v).split(".")[1] || "").length)) ) + 1);

  /* ================= router ================= */
  async function route() {
    const hp = hashParts(), go = ["std", "list", "study", "dash"].includes(hp.go) ? hp.go : "std";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === (go === "study" ? "list" : go)));
    ["std", "list", "study", "dash"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    $("#fab").classList.toggle("hide", go !== "list" || !canEdit()); say("");
    try {
      if (go === "std") KMRStd.draw($("#std"), "msa");
      else if (go === "list") await drawList();
      else if (go === "dash") await drawDash();
      else if (go === "study") { if (!hp.id) { setGo("go=list"); return route(); } await openStudy(hp.id); }
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);
  const goStudy = (id) => { setGo("go=study&id=" + id); route(); };

  /* ================= register ================= */
  async function drawList() {
    S.list = await call("kmr_msa_list", { p: S.f });
    const el = $("#list");
    el.innerHTML = `<p class="guide">One study for one gauge and one characteristic. Type or paste the readings; the result and the decision follow. A finished study is finalised and locked, and stays here as the record.</p>
      <div class="row"><input class="grow" id="fq" placeholder="Search number, gauge, characteristic, part…" value="${esc(S.f.q)}">
      <select id="ft" style="width:auto">${opts([["", "All types"]].concat(Object.entries(TYPES).map(([k, v]) => [k, v[0]])), S.f.type)}</select>
      <select id="fd" style="width:auto">${opts([["", "Any decision"], ["Acceptable", "Acceptable"], ["Conditional", "Conditional"], ["Not acceptable", "Not acceptable"]], S.f.decision)}</select>
      <select id="fs" style="width:auto">${opts([["", "Draft and final"], ["draft", "Draft"], ["final", "Final"]], S.f.status)}</select>
      ${canEdit() ? '<button class="btn" id="nw">＋ New study</button><label class="btn o" style="cursor:pointer">Import<input type="file" id="imp" accept=".json,application/json" hidden></label>' : ""}</div>
      ${S.list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>No.</th><th>Study</th><th>Type</th><th>Gauge</th><th>Date</th><th>Result</th><th>Decision</th><th></th></tr></thead><tbody>${S.list.map((s) => `<tr data-open="${s.id}" style="cursor:pointer"><td><b>${esc(s.no)}</b></td><td>${esc(s.title || s.characteristic || "—")}${s.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${esc(TYPES[s.type][0])}</td><td>${esc([s.gauge_id, s.gauge_name].filter(Boolean).join(" · ") || "—")}</td><td>${fmt(s.study_date)}</td><td>${esc((s.results && s.results.headline) || "—")}</td><td>${chip(s.decision)}</td><td>${s.status === "final" ? '<span class="chip x">final</span>' : '<span class="chip b">draft</span>'}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty">No studies yet.<br>${canEdit() ? "Press <b>＋ New study</b>, choose the type and enter the readings." : "Ask an editor to start the first study."}</div>`}`;
    let t; $("#fq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.f.q = e.target.value; drawList().then(() => { const i = $("#fq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    $("#ft").onchange = (e) => { S.f.type = e.target.value; drawList(); }; $("#fd").onchange = (e) => { S.f.decision = e.target.value; drawList(); }; $("#fs").onchange = (e) => { S.f.status = e.target.value; drawList(); };
    if ($("#nw")) $("#nw").onclick = () => form(null); if ($("#imp")) $("#imp").onchange = importJson;
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => goStudy(r.dataset.open)));
  }
  $("#fab").onclick = () => form(null);

  /* ================= study details form ================= */
  const today = () => new Date().toISOString().slice(0, 10);
  function form(st) {
    const c = st || { type: "grr", study_date: today(), config: {} }, cfg = c.config || {}, types = Object.entries(TYPES).filter(([, v]) => hasF(v[2]) || (st && st.type));
    const ty = c.type;
    open(`<h3 style="margin:0 0 10px">${st ? "Study " + esc(st.no) : "New study"}</h3><div class="frm">
      <div><label>Type of study *</label><select id="f_type"${st ? " disabled" : ""}>${opts(types.map(([k, v]) => [k, v[0]]), ty)}</select></div>
      <div class="w mut" id="f_hint" style="font-size:12.5px"></div>
      <div class="w"><label>Title</label><input id="f_title" value="${esc(c.title || "")}" placeholder="e.g. Bore gauge BG-12 — Gage R&R"></div>
      <div><label>Gauge number</label><input id="f_gauge_id" value="${esc(c.gauge_id || "")}"></div><div><label>Gauge name</label><input id="f_gauge_name" value="${esc(c.gauge_name || "")}"></div>
      <div><label>Characteristic</label><input id="f_characteristic" value="${esc(c.characteristic || "")}" placeholder="e.g. Bore diameter"></div><div><label>Unit</label><input id="f_unit" value="${esc(c.unit || "")}" placeholder="mm"></div>
      <div><label>Part number</label><input id="f_part_no" value="${esc(c.part_no || "")}"></div><div><label>Part name</label><input id="f_part_name" value="${esc(c.part_name || "")}"></div>
      <div id="f_specw" class="w"><div class="frm"><div><label>Lower spec limit</label><input id="f_lsl" inputmode="decimal" value="${esc(c.lsl ?? "")}"></div><div><label>Upper spec limit</label><input id="f_usl" inputmode="decimal" value="${esc(c.usl ?? "")}"></div></div></div>
      <div><label>Study date</label><input id="f_date" type="date" value="${esc(String(c.study_date || today()).slice(0, 10))}"></div><div><label>Conducted by</label><input id="f_by" value="${esc(c.conducted_by || "")}"></div>
      <div id="f_gw" class="w"><div class="frm"><div class="w"><label>Appraisers (names, separated by commas)</label><input id="f_ap" value="${esc((cfg.appraisers || ["A", "B", "C"]).join(", "))}"></div>
        <div><label>Parts</label><input id="f_parts" type="number" min="2" max="15" value="${esc(cfg.parts || 10)}"></div><div><label>Trials</label><input id="f_trials" type="number" min="1" max="5" value="${esc(cfg.trials || 3)}"></div></div></div>
      <div id="f_rw"><label>Master / reference value</label><input id="f_ref" inputmode="decimal" value="${esc(cfg.reference ?? "")}"></div>
      <div class="w"><label>Notes</label><textarea id="f_notes" rows="2">${esc(c.notes || "")}</textarea></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="f_save">Save</button><button class="btn o" id="f_x">Cancel</button></div>`);
    const upd = () => {
      const t = V("f_type"), g = t === "grr" || t === "attribute";
      $("#f_hint").textContent = TYPES[t][1]; $("#f_gw").classList.toggle("hide", !g); $("#f_rw").classList.toggle("hide", !(t === "bias" || t === "stability")); $("#f_specw").classList.toggle("hide", t === "attribute");
    };
    $("#f_type").onchange = upd; upd(); $("#f_x").onclick = closeM;
    $("#f_save").onclick = async () => {
      const t = st ? st.type : V("f_type"), p = { id: st && st.id, type: t, title: V("f_title"), gauge_id: V("f_gauge_id"), gauge_name: V("f_gauge_name"), characteristic: V("f_characteristic"), unit: V("f_unit"), part_no: V("f_part_no"), part_name: V("f_part_name"),
        lsl: V("f_lsl"), usl: V("f_usl"), study_date: V("f_date"), conducted_by: V("f_by"), notes: V("f_notes") };
      const cf = Object.assign({}, cfg);
      if (t === "grr" || t === "attribute") {
        const ap = V("f_ap").split(",").map((x) => x.trim()).filter(Boolean), P = Math.round(Number(V("f_parts"))), T = Math.round(Number(V("f_trials")));
        if (ap.length < 2 || ap.length > 5) { alert("Enter 2 to 5 appraisers."); return; } if (!(P >= 2 && P <= 15)) { alert("Parts: 2 to 15."); return; } if (!(T >= (t === "grr" ? 2 : 1) && T <= 5)) { alert("Trials: " + (t === "grr" ? "2" : "1") + " to 5."); return; }
        Object.assign(cf, { appraisers: ap, parts: P, trials: T });
        p.data = st ? resize(st.data, t, ap.length, P, T) : blank(t, ap.length, P, T);
      }
      if (t === "bias" || t === "stability") cf.reference = num(V("f_ref"));
      if (t === "grr" && !cf.k) cf.k = 6; if (t === "attribute" && !cf.labels) cf.labels = ["Reject", "Accept"];
      p.config = cf; if (!st) p.data = p.data || (t === "linearity" ? { rows: [2, 4, 6, 8, 10].map(() => ({ ref: null, readings: [] })) } : { readings: [] });
      if (st) { p.data = p.data || S.st.data; p.results = S.st.results; p.decision = S.st.decision; }
      try { const r = await call("kmr_msa_save", { p }); closeM(); say("Saved.", true); goStudy(r.id); } catch (e) { alert(e.message); }
    };
  }
  const blank = (t, A, P, T) => (t === "grr" ? { d: Array.from({ length: A }, () => Array.from({ length: P }, () => Array(T).fill(null))) } : { ref: Array(P).fill(null), d: Array.from({ length: A }, () => Array.from({ length: P }, () => Array(T).fill(null))) });
  function resize(data, t, A, P, T) {
    const old = (data && data.d) || [], d = Array.from({ length: A }, (_, a) => Array.from({ length: P }, (_, p) => Array.from({ length: T }, (_, k) => ((old[a] || [])[p] || [])[k] ?? null)));
    return t === "grr" ? { d } : { ref: Array.from({ length: P }, (_, p) => ((data && data.ref) || [])[p] ?? null), d };
  }

  /* ================= study screen ================= */
  async function openStudy(id) { S.st = await call("kmr_msa_get", { p_id: id }); S.st.can_edit = canEdit() && S.st.can_edit !== false; S.view = 0; S.ap = 0; S.method = (S.st.config && S.st.config.method) || "anova"; render(); }

  /* ----- calculation (live as the readings are typed) ----- */
  function analyse(st) {
    const t = st.type, cfg = st.config || {}, dt = st.data || {}, tol = st.lsl != null && st.usl != null ? Number(st.usl) - Number(st.lsl) : null, A = { type: t, ready: false, msg: "", res: null, decision: null, headline: "", tol };
    if (t === "grr" || t === "attribute") {
      const d = dt.d || [], miss = d.flat(2).filter((v) => v == null || !Number.isFinite(Number(v))).length, total = d.flat(2).length;
      if (t === "attribute") { const rf = (dt.ref || []).filter((v) => v === 0 || v === 1).length; if (miss || rf < (dt.ref || []).length) { A.msg = `Fill in every check${(dt.ref || []).length ? " and the true status of every part" : ""} (${miss + ((dt.ref || []).length - rf)} of ${total + (dt.ref || []).length} still empty).`; return A; } }
      else if (miss) { A.msg = `Enter every reading: ${miss} of ${total} still empty.`; return A; }
      if (t === "grr") {
        const dd = d.map((a) => a.map((p) => p.map(Number))); A.range = M.grrRange(dd, { tol, k: cfg.k || 6 }); A.anova = (cfg.trials || 0) >= 2 ? M.grrAnova(dd, { tol, k: cfg.k || 6 }) : null;
        const r = S.method === "range" || !A.anova || A.anova.error ? A.range : A.anova; A.res = r; if (!r || r.error) { A.msg = (r && r.error) || "Check the readings."; return A; }
        A.decision = r.decision; A.ready = true; A.headline = `%GRR ${r.pctGRR.toFixed(1)}%${r.pctTol != null ? " · %tolerance " + r.pctTol.toFixed(1) + "%" : ""} · ${r.ndc} distinct categories`;
      } else {
        const r = M.attribute(d.map((a) => a.map((p) => p.map(Number))), dt.ref); A.res = r; if (r.error) { A.msg = r.error; return A; } A.ready = true; A.decision = r.decision;
        A.headline = r.hasRef ? `Effectiveness ${r.effectiveness.toFixed(0)}% · miss ${r.miss == null ? "—" : r.miss.toFixed(0) + "%"} · false alarm ${r.falseAlarm == null ? "—" : r.falseAlarm.toFixed(0) + "%"}` : "Agreement between appraisers (kappa)";
      }
    } else if (t === "bias") {
      const r = M.bias(dt.readings || [], cfg.reference, { tol }); if (!r) { A.msg = "Enter the master value and at least 2 readings."; return A; } A.res = r; A.ready = true; A.decision = r.zeroInside ? "Acceptable" : "Not acceptable";
      A.headline = `Bias ${r.bias.toFixed(4)}${st.unit ? " " + st.unit : ""} · ${r.zeroInside ? "zero inside" : "zero outside"} the 95% interval`;
    } else if (t === "linearity") {
      const r = M.linearity((dt.rows || []).filter((x) => num(x.ref) != null), { tol, processVariation: num(cfg.processVariation) || undefined }); if (!r || r.error) { A.msg = (r && r.error) || "Enter at least 3 reference parts and 6 readings."; return A; }
      A.res = r; A.ready = true; A.decision = r.ok ? "Acceptable" : "Not acceptable"; A.headline = `Slope ${r.slope.toFixed(4)} · R² ${r.r2.toFixed(2)} · ${r.ok ? "no significant linearity or bias" : "bias changes across the range"}`;
    } else if (t === "stability") {
      const X = (dt.readings || []).map(num).filter((x) => x != null); if (X.length < 5) { A.msg = "Enter at least 5 readings in time order."; return A; }
      const ch = C.imrChart(X, {}), sg = C.rules(ch.means, ch.lim.map((l) => l.x), { rules: [1, 2, 3], run: 7, trend: 7 }); A.res = { ch, sig: sg, X, ref: num(cfg.reference) }; A.ready = true; A.decision = sg.length ? "Not acceptable" : "Acceptable";
      A.headline = sg.length ? `${new Set(sg.map((s) => s.i)).size} point(s) with a signal over ${X.length} checks` : `In control — no signals over ${X.length} checks`;
    }
    return A;
  }

  /* ----- SVG helpers ----- */
  function svgMulti(title, series, labels, o) {
    o = o || {}; const W = 780, H = 220, L = 54, R = o.hline != null ? 78 : 16, T = 12, B = 26, n = labels.length, d = o.d == null ? 3 : o.d;
    const ys = []; series.forEach((s) => s.vals.forEach((v) => Number.isFinite(v) && ys.push(v))); (o.hlines || []).forEach((h) => ys.push(h.v)); if (!ys.length) return "";
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
    const X = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B), step = Math.max(1, Math.ceil(n / 14)), tick = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    return `<div class="cc"><h4>${esc(title)}</h4><svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e9f2"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(d)}</text>`).join("")}
      ${(o.hlines || []).map((h) => `<line x1="${L}" x2="${W - R}" y1="${Y(h.v)}" y2="${Y(h.v)}" stroke="${h.c}" stroke-width="1.4"${h.dash ? ' stroke-dasharray="6 4"' : ""}/><text x="${W - R + 4}" y="${Y(h.v) + 4}" fill="${h.c}">${esc(h.t)}</text>`).join("")}
      ${series.map((s) => `<polyline fill="none" stroke="${s.c}" stroke-width="1.5" points="${s.vals.map((v, i) => (Number.isFinite(v) ? X(i).toFixed(1) + "," + Y(v).toFixed(1) : "")).filter(Boolean).join(" ")}"/>${s.vals.map((v, i) => (Number.isFinite(v) ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${s.flag && s.flag[i] ? 5 : 3}" fill="${s.flag && s.flag[i] ? "#dc2626" : s.c}"><title>${esc(s.name)} ${esc(labels[i])}: ${v.toFixed(d)}</title></circle>` : "")).join("")}`).join("")}
      ${labels.map((lb, i) => (i % step === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(String(lb).slice(0, 8))}</text>` : "")).join("")}</svg>
      ${series.length > 1 ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin:2px 8px 4px;font-size:12px">${series.map((s) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.c};margin-right:4px"></i>${esc(s.name)}</span>`).join("")}</div>` : ""}</div>`;
  }
  const COL = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777"];
  function svgBars(title, rows) {
    const W = 780, rh = 30, H = rows.length * rh + 16, L = 190;
    return `<div class="cc"><h4>${esc(title)}</h4><svg class="svgw" viewBox="0 0 ${W} ${H}">${rows.map((r, i) => { const y = 8 + i * rh, w = Math.max(1, (Math.min(100, r.v) / 100) * (W - L - 60)); return `<text x="0" y="${y + 15}" style="fill:var(--ink)">${esc(r.t)}</text><rect x="${L}" y="${y + 3}" width="${W - L - 60}" height="16" rx="8" fill="#e8eef6"/><rect x="${L}" y="${y + 3}" width="${w}" height="16" rx="8" fill="${r.c}"/><text x="${L + w + 6}" y="${y + 16}" style="fill:var(--ink)">${r.v.toFixed(1)}%</text>`; }).join("")}</svg></div>`;
  }
  function svgScatter(st, res) {
    const W = 780, H = 240, L = 58, R = 16, T = 12, B = 30, pts = [], rows = (st.data.rows || []).filter((r) => num(r.ref) != null);
    rows.forEach((r) => (r.readings || []).map(num).filter((x) => x != null).forEach((v) => pts.push({ x: Number(r.ref), y: v - Number(r.ref) })));
    if (pts.length < 2) return ""; const xs = pts.map((p) => p.x), ysv = pts.map((p) => p.y).concat(res.parts.map((p) => p.bias));
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ysv, 0), y1 = Math.max(...ysv, 0); const py = (y1 - y0) * 0.15 || 1; y0 -= py; y1 += py; const dx = (x1 - x0) * 0.05 || 1; x0 -= dx; x1 += dx;
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B), tick = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
    return `<div class="cc"><h4>Bias against the reference value</h4><svg class="svgw" viewBox="0 0 ${W} ${H}">${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e9f2"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(3)}</text>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#16a34a" stroke-width="1.4"/><line x1="${X(x0)}" y1="${Y(res.intercept + res.slope * x0)}" x2="${X(x1)}" y2="${Y(res.intercept + res.slope * x1)}" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="6 4"/>
      ${pts.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="#94a3b8"/>`).join("")}${res.parts.map((p) => `<circle cx="${X(p.ref).toFixed(1)}" cy="${Y(p.bias).toFixed(1)}" r="5" fill="#0f766e"><title>Reference ${p.ref}: average bias ${p.bias.toFixed(4)}</title></circle>`).join("")}
      ${res.parts.map((p) => `<text x="${X(p.ref)}" y="${H - 10}" text-anchor="middle">${p.ref}</text>`).join("")}</svg><div class="mut" style="font-size:12px;margin:2px 8px 4px">Grey dots: each reading's bias · green dots: average bias per master · red line: fitted line · green line: zero bias</div></div>`;
  }

  /* ----- results ----- */
  function resultsHtml(st, A) {
    if (!A.ready) return `<div class="empty">${esc(A.msg || "Enter the readings to see the result.")}</div>`;
    const t = st.type, d = dpx(st), unit = st.unit ? " " + esc(st.unit) : "", dec = `<div class="row" style="margin:4px 0 10px"><b style="font-size:16px">Decision:</b> ${chip(A.decision)}<span class="mut">${esc(A.headline)}</span></div>`;
    if (t === "grr") {
      const r = A.res, k = r.k, tol = A.tol, isA = r.method === "anova";
      const rows = isA ? [["Repeatability (equipment variation)", r.sd.repeat], ["Reproducibility (appraiser variation)", r.sd.reprod], ["Gage R&R", r.sd.grr], ["Part-to-part", r.sd.part], ["Total variation", r.sd.total]]
        : [["Repeatability (equipment variation)", r.EV], ["Reproducibility (appraiser variation)", r.AV], ["Gage R&R", r.GRR], ["Part-to-part", r.PV], ["Total variation", r.TV]];
      const tv = rows[4][1];
      const bars = [["Repeatability", rows[0][1], COL[1]], ["Reproducibility", rows[1][1], COL[2]], ["Gage R&R", rows[2][1], r.decision === "Acceptable" ? "#16a34a" : r.decision === "Conditional" ? "#d97706" : "#dc2626"], ["Part-to-part", rows[3][1], "#0f766e"]].map((x) => ({ t: x[0], v: tv > 0 ? (x[1] / tv) * 100 : 0, c: x[2] }));
      const dd = (st.data.d || []).map((a) => a.map((p) => p.map(Number))), lab = Array.from({ length: r.P }, (_, i) => String(i + 1)), ap = st.config.appraisers || [];
      const means = dd.map((a, i) => ({ name: ap[i] || "A" + (i + 1), c: COL[i % 5], vals: a.map((p) => p.reduce((s, v) => s + v, 0) / p.length) }));
      const rg = dd.map((a, i) => ({ name: ap[i] || "A" + (i + 1), c: COL[i % 5], vals: a.map((p) => Math.max(...p) - Math.min(...p)) }));
      return `${dec}<div class="seg noprint"><button data-meth="anova" class="${isA ? "on" : ""}"${A.anova && !A.anova.error ? "" : " disabled"}>ANOVA method</button><button data-meth="range" class="${!isA ? "on" : ""}">Average &amp; range method</button></div>
        <div class="kpis"><div class="kpi" style="--c:var(--b1);cursor:default"><b>${f(r.pctGRR, 1)}%</b><span>%GRR of total variation</span></div><div class="kpi" style="--c:var(--b1);cursor:default"><b>${r.pctTol == null ? "—" : f(r.pctTol, 1) + "%"}</b><span>%GRR of tolerance${tol == null ? " (enter both spec limits)" : ""}</span></div><div class="kpi" style="--c:${r.ndc >= 5 ? "var(--g)" : "var(--r)"};cursor:default"><b>${r.ndc}</b><span>distinct categories (want 5 or more)</span></div></div>
        <div class="sc"><table class="tb2"><thead><tr><th>Source</th><th>Std. deviation</th><th>Study variation (${k}σ)</th><th>% of total</th>${tol != null ? "<th>% of tolerance</th>" : ""}</tr></thead><tbody>${rows.map((x) => `<tr><td>${x[0]}</td><td>${f(x[1], d + 2)}</td><td>${f(x[1] * k, d + 2)}</td><td>${tv > 0 ? f((x[1] / tv) * 100, 1) : "—"}%</td>${tol != null ? `<td>${f((x[1] * k / tol) * 100, 1)}%</td>` : ""}</tr>`).join("")}</tbody></table></div>
        <p class="mut" style="font-size:12.5px">${isA ? "Appraiser × part interaction " + (r.pooled ? "is not significant (p " + f(r.pInteraction, 3) + " > 0.25) and was combined with the error." : "is significant (p " + f(r.pInteraction, 3) + ") and is part of reproducibility.") : "Average and range method with the standard K1, K2 and K3 factors."} Under 10% is acceptable, 10% to 30% may be acceptable depending on the use and cost, over 30% is not acceptable. The decision follows the worse of %GRR and %tolerance.</p>
        ${svgBars("Share of total variation", bars)}${svgMulti("Average of each part, by appraiser", means, lab, { d: d + 1 })}${svgMulti("Range of each part, by appraiser", rg, lab, { d: d + 1, hlines: A.range && !A.range.error ? [{ v: A.range.UCLR, c: "#dc2626", t: "UCL " + A.range.UCLR.toFixed(d + 1), dash: 1 }] : [] })}
        ${isA ? `<details class="noprint"><summary style="cursor:pointer;color:var(--b1);font-weight:600">ANOVA table</summary><div class="sc"><table class="tb2"><thead><tr><th>Source</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th></tr></thead><tbody>${r.table.map((x) => `<tr><td>${x.name}</td><td>${f(x.ss, 4)}</td><td>${x.df}</td><td>${f(x.ms, 4)}</td><td>${f(x.f, 2)}</td><td>${f(x.p, 3)}</td></tr>`).join("")}</tbody></table></div></details>` : ""}`;
    }
    if (t === "bias") {
      const r = A.res; return `${dec}<div class="kpis"><div class="kpi" style="cursor:default"><b>${f(r.mean, d)}</b><span>average of ${r.n} readings${unit}</span></div><div class="kpi" style="cursor:default"><b>${f(r.ref, d)}</b><span>master value${unit}</span></div><div class="kpi" style="--c:${r.zeroInside ? "var(--g)" : "var(--r)"};cursor:default"><b>${f(r.bias, d + 1)}</b><span>bias${unit}</span></div><div class="kpi" style="cursor:default"><b>${f(r.sd, d + 1)}</b><span>repeatability σ</span></div></div>
        <div class="sc"><table class="tb2"><tbody><tr><td>95% confidence interval of the bias</td><td><b>${f(r.lo, d + 1)} to ${f(r.hi, d + 1)}</b></td></tr><tr><td>t (${r.df} degrees of freedom)</td><td>${f(r.t, 3)}</td></tr><tr><td>p value</td><td>${f(r.p, 4)}</td></tr>${r.pctTol != null ? `<tr><td>Bias as % of tolerance</td><td>${f(r.pctTol, 1)}%</td></tr>` : ""}</tbody></table></div>
        <p class="mut" style="font-size:12.5px">The bias is acceptable when zero lies inside the confidence interval. ${r.zeroInside ? "Here it does." : "Here it does not: the gauge reads high or low and needs adjustment or a correction."}</p>
        ${svgMulti("Readings against the master value", [{ name: "Readings", c: COL[0], vals: (st.data.readings || []).map(num).filter((x) => x != null) }], (st.data.readings || []).map(num).filter((x) => x != null).map((_, i) => String(i + 1)), { d: d + 1, hlines: [{ v: r.ref, c: "#16a34a", t: "master" }] })}`;
    }
    if (t === "linearity") {
      const r = A.res; return `${dec}<div class="kpis"><div class="kpi" style="cursor:default"><b>${f(r.slope, 4)}</b><span>slope of bias on size</span></div><div class="kpi" style="cursor:default"><b>${f(r.intercept, 4)}</b><span>intercept</span></div><div class="kpi" style="cursor:default"><b>${f(r.r2, 3)}</b><span>R²</span></div><div class="kpi" style="--c:${r.ok ? "var(--g)" : "var(--r)"};cursor:default"><b>${f(r.linearity, 4)}</b><span>linearity (|slope| × process variation)</span></div></div>
        <div class="sc"><table class="tb2"><thead><tr><th>Reference</th><th>Readings</th><th>Average</th><th>Bias</th></tr></thead><tbody>${r.parts.map((p) => `<tr><td>${p.ref}</td><td>${p.n}</td><td>${f(p.mean, d + 1)}</td><td>${f(p.bias, d + 1)}</td></tr>`).join("")}</tbody></table></div>
        <p class="mut" style="font-size:12.5px">p for the slope ${f(r.pSlope, 4)} · p for the intercept ${f(r.pIntercept, 4)}. The gauge is acceptable when the slope and the intercept are not significantly different from zero (p above 0.05). Process variation used: ${f(r.pv, d + 1)}.</p>${svgScatter(st, r)}`;
    }
    if (t === "stability") {
      const r = A.res, lab = r.X.map((_, i) => String(i + 1)), fl = {}; r.sig.forEach((s) => (fl[s.i] = 1));
      return `${dec}<div class="kpis"><div class="kpi" style="cursor:default"><b>${r.X.length}</b><span>checks</span></div><div class="kpi" style="cursor:default"><b>${f(r.ch.grand, d + 1)}</b><span>average${unit}</span></div><div class="kpi" style="cursor:default"><b>${f(r.ch.sigma, d + 2)}</b><span>σ from the moving range</span></div>${r.ref != null ? `<div class="kpi" style="cursor:default"><b>${f(r.ch.grand - r.ref, d + 2)}</b><span>average minus master</span></div>` : ""}</div>
        ${svgMulti("Master readings over time (I chart)", [{ name: "Reading", c: COL[0], vals: r.X, flag: fl }], lab, { d: d + 2, hlines: [{ v: r.ch.lim[0].x.ucl, c: "#dc2626", t: "UCL", dash: 1 }, { v: r.ch.grand, c: "#16a34a", t: "CL" }, { v: r.ch.lim[0].x.lcl, c: "#dc2626", t: "LCL", dash: 1 }].concat(r.ref != null ? [{ v: r.ref, c: "#2563eb", t: "master", dash: 1 }] : []) })}
        <p class="mut" style="font-size:12.5px">${r.sig.length ? "Signals: " + [...new Set(r.sig.map((s) => "check " + (s.i + 1) + " — " + s.text))].join("; ") + ". The gauge is drifting or was disturbed; find the cause before relying on it." : "No signals: the gauge reads the master consistently over time."}</p>`;
    }
    const r = A.res, ap = st.config.appraisers || [];
    return `${dec}<div class="kpis"><div class="kpi" style="cursor:default"><b>${r.hasRef ? f(r.effectiveness, 0) + "%" : "—"}</b><span>effectiveness (right calls)</span></div><div class="kpi" style="cursor:default"><b>${r.miss == null ? "—" : f(r.miss, 1) + "%"}</b><span>miss rate (bad part passed)</span></div><div class="kpi" style="cursor:default"><b>${r.falseAlarm == null ? "—" : f(r.falseAlarm, 1) + "%"}</b><span>false-alarm rate (good part rejected)</span></div><div class="kpi" style="cursor:default"><b>${f(r.allAgree, 0)}%</b><span>parts all appraisers agree on</span></div></div>
      <div class="sc"><table class="tb2"><thead><tr><th>Appraiser</th><th>Agrees with self</th>${r.hasRef ? "<th>Effectiveness</th><th>Miss rate</th><th>False alarm</th><th>Kappa vs reference</th>" : ""}</tr></thead><tbody>${r.within.map((w, i) => `<tr><td>${esc(ap[i] || "A" + (i + 1))}</td><td>${f(w, 0)}%</td>${r.hasRef ? `<td>${f(r.vsRef[i].effectiveness, 0)}%</td><td>${r.vsRef[i].miss == null ? "—" : f(r.vsRef[i].miss, 0) + "%"}</td><td>${r.vsRef[i].falseAlarm == null ? "—" : f(r.vsRef[i].falseAlarm, 0) + "%"}</td><td>${f(r.kappaRef[i], 2)}</td>` : ""}</tr>`).join("")}</tbody></table></div>
      <div class="sc"><table class="tb2"><thead><tr><th>Appraiser pair</th><th>Kappa</th></tr></thead><tbody>${r.kappaPairs.map((p) => `<tr><td>${esc(ap[p.a] || "A" + (p.a + 1))} and ${esc(ap[p.b] || "A" + (p.b + 1))}</td><td>${f(p.kappa, 2)}</td></tr>`).join("")}</tbody></table></div>
      <p class="mut" style="font-size:12.5px">Guide: effectiveness 90% or more, miss rate 2% or less and false-alarm rate 5% or less is acceptable; 80% / 5% / 10% may be acceptable; below that the gauge needs improvement. Kappa of 0.75 or more is good agreement.</p>`;
  }

  /* ----- data entry ----- */
  function entryHtml(st) {
    const ed = editable(), dis = ed ? "" : " disabled", t = st.type, cfg = st.config || {};
    if (t === "grr" || t === "attribute") {
      const ap = cfg.appraisers || [], P = cfg.parts || 0, T = cfg.trials || 0, a = Math.min(S.ap, ap.length - 1), lb = cfg.labels || ["Reject", "Accept"];
      const tabs = `<div style="display:grid;grid-template-columns:repeat(${ap.length},1fr);gap:6px;margin-bottom:8px">${ap.map((n, i) => `<button class="ab${i === a ? " on" : ""}" data-ap="${i}">${esc(n)}</button>`).join("")}</div>`;
      if (t === "grr") return `<div class="card"><h3>Readings — appraiser ${esc(ap[a])}</h3>${tabs}<div class="sc"><table class="gtab"><thead><tr><th>Part</th>${Array.from({ length: T }, (_, k) => `<th>Trial ${k + 1}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: P }, (_, p) => `<tr><td><b>${p + 1}</b></td>${Array.from({ length: T }, (_, k) => `<td><input data-a="${a}" data-p="${p}" data-k="${k}" inputmode="decimal" value="${esc(st.data.d[a][p][k] ?? "")}"${dis}></td>`).join("")}</tr>`).join("")}</tbody></table></div>
        ${ed ? `<details class="noprint" style="margin-top:8px"><summary style="cursor:pointer;color:var(--b1);font-weight:600">Paste ${esc(ap[a])}'s readings from Excel</summary><p class="mut" style="font-size:12.5px;margin:6px 0">One part per line (${P} lines), one trial per column (${T} columns).</p><textarea id="g_paste" rows="4"></textarea><div class="row" style="margin-top:8px"><button class="btn o" id="g_padd">Use pasted readings</button></div></details>` : ""}</div>`;
      const cyc = (v) => (v === 1 ? lb[1] : v === 0 ? lb[0] : "—");
      return `<div class="card"><h3>Checks — appraiser ${esc(ap[a])}</h3><p class="mut" style="margin:0 0 8px;font-size:13px">Tap a cell to change it: — → ${esc(lb[1])} → ${esc(lb[0])}. The true status of each part (known from a reference measurement) goes in the last column.</p>${tabs}<div class="sc"><table class="gtab"><thead><tr><th>Part</th>${Array.from({ length: T }, (_, k) => `<th>Trial ${k + 1}</th>`).join("")}<th>True status</th></tr></thead><tbody>${Array.from({ length: P }, (_, p) => `<tr><td><b>${p + 1}</b></td>${Array.from({ length: T }, (_, k) => `<td><button class="ab" data-c="${a}.${p}.${k}"${dis}>${esc(cyc(st.data.d[a][p][k]))}</button></td>`).join("")}<td><button class="ab" data-r="${p}"${dis}>${esc(cyc(st.data.ref[p]))}</button></td></tr>`).join("")}</tbody></table></div></div>`;
    }
    if (t === "bias" || t === "stability") return `<div class="card"><h3>Readings${t === "stability" ? " in time order" : ""}</h3><textarea id="s_read" rows="5" placeholder="Type or paste the readings, separated by spaces, commas or new lines"${dis}>${esc((st.data.readings || []).join(" "))}</textarea><div class="mut" style="font-size:12.5px;margin-top:4px" id="s_count">${(st.data.readings || []).length} readings</div></div>`;
    const rows = st.data.rows || [];
    return `<div class="card"><h3>Masters and their readings</h3><p class="mut" style="margin:0 0 8px;font-size:13px">One line for each master part: its reference value, then the readings of the gauge (spaces between the numbers).</p>${rows.map((r, i) => `<div class="gr"><input data-lr="${i}" inputmode="decimal" placeholder="reference" value="${esc(r.ref ?? "")}" style="width:100px"${dis}><input data-lv="${i}" placeholder="readings" value="${esc((r.readings || []).join(" "))}" style="flex:1;min-width:180px"${dis}></div>`).join("")}${ed ? '<button class="btn o s noprint" id="l_add">＋ Add a master</button>' : ""}
      <div class="row" style="margin-top:10px"><div><label class="lbl">Process variation (total spread of the process, same unit)</label><input id="l_pv" inputmode="decimal" value="${esc(cfg.processVariation ?? "")}" style="width:180px"${dis}></div></div></div>`;
  }

  /* ----- the page ----- */
  function render() {
    const st = S.st, el = $("#study"), ed = editable(), unit = st.unit ? " · unit " + esc(st.unit) : "";
    el.innerHTML = `<div class="row noprint"><a href="#go=list" class="btn o s">← Studies</a><div style="flex:1"></div>
        ${ed ? '<button class="btn o s" id="b_edit">Edit details</button>' : ""}${canEdit() ? `<button class="btn s" id="b_save"${ed ? "" : " hidden"}>Save</button>` : ""}${canEdit() && !isFinal() ? '<button class="btn g s" id="b_fin">Finalise</button>' : ""}${isFinal() && st.is_admin ? '<button class="btn o s" id="b_reopen">Reopen</button>' : ""}
        <button class="btn o s" id="b_print">Print</button><button class="btn o s" id="b_exp">Export</button>${canEdit() && (!isFinal() || st.is_admin) ? '<button class="btn r s" id="b_del">Delete</button>' : ""}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin-bottom:6px"><h2 style="margin:0">${esc(st.title || TYPES[st.type][0])}</h2><span class="chip b">${esc(TYPES[st.type][0])}</span>${isFinal() ? '<span class="chip x">final · locked</span>' : '<span class="chip a">draft</span>'}${st.sample ? '<span class="pillw">sample</span>' : ""}</div>
      <div class="mut" style="margin-bottom:12px">${esc(st.no)} · ${fmt(st.study_date)}${st.conducted_by ? " · " + esc(st.conducted_by) : ""}${st.gauge_id || st.gauge_name ? " · gauge " + esc([st.gauge_id, st.gauge_name].filter(Boolean).join(" ")) : ""}${st.characteristic ? " · " + esc(st.characteristic) : ""}${st.part_no ? " · part " + esc(st.part_no) : ""}${unit}${st.lsl != null || st.usl != null ? " · spec " + f(st.lsl, 3) + " to " + f(st.usl, 3) : ""}</div>
      ${isFinal() ? `<p class="msg ok">Finalised${st.finalised_by ? " by " + esc(st.finalised_by) : ""}${st.finalised_at ? " on " + fmt(st.finalised_at) : ""}. The study is locked.</p>` : ""}
      <div class="noprint" id="entry">${entryHtml(st)}</div><div id="res"></div>
      ${st.notes ? `<p class="mut"><b>Notes:</b> ${esc(st.notes)}</p>` : ""}`;
    paintResults(); wire();
  }
  let dirty = false;
  function paintResults() {
    const st = S.st, A = (S.an = analyse(st)); $("#res").innerHTML = `<h3 style="margin:14px 0 6px">Result</h3>` + resultsHtml(st, A);
    document.querySelectorAll("[data-meth]").forEach((b) => (b.onclick = () => { S.method = b.dataset.meth; st.config.method = S.method; dirty = true; paintResults(); }));
  }
  const touch = () => { dirty = true; paintResults(); };
  function wire() {
    const st = S.st, b = (id, fn) => { const e = $("#" + id); if (e) e.onclick = fn; };
    b("b_edit", () => form(st)); b("b_print", () => window.print()); b("b_exp", exportJson);
    b("b_save", () => save(true)); b("b_fin", async () => { if (!S.an || !S.an.ready) { say("Complete the readings first — a study can be finalised only with a result."); return; } if (!confirm("Finalise this study? It is locked afterwards; only an administrator can reopen it.")) return; if (!(await save(false))) return; try { await call("kmr_msa_finalise", { p_id: st.id, p_final: true }); say("Finalised.", true); await openStudy(st.id); } catch (e) { say(e.message); } });
    b("b_reopen", async () => { try { await call("kmr_msa_finalise", { p_id: st.id, p_final: false }); await openStudy(st.id); say("Reopened.", true); } catch (e) { say(e.message); } });
    b("b_del", async () => { if (!confirm("Delete this study? This cannot be undone.")) return; try { await call("kmr_msa_delete", { p_id: st.id }); say("Study deleted.", true); setGo("go=list"); route(); } catch (e) { say(e.message); } });
    document.querySelectorAll("[data-ap]").forEach((x) => (x.onclick = () => { S.ap = Number(x.dataset.ap); $("#entry").innerHTML = entryHtml(st); wire(); }));
    document.querySelectorAll("input[data-a]").forEach((i) => (i.oninput = () => { st.data.d[+i.dataset.a][+i.dataset.p][+i.dataset.k] = num(i.value); touch(); }));
    document.querySelectorAll("input[data-a]").forEach((i, k, all) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const nx = all[k + 1]; if (nx) nx.focus(); } }));
    document.querySelectorAll("[data-c]").forEach((x) => (x.onclick = () => { const [a, p, k] = x.dataset.c.split(".").map(Number), v = st.data.d[a][p][k]; st.data.d[a][p][k] = v == null ? 1 : v === 1 ? 0 : null; x.textContent = ((st.config.labels || ["Reject", "Accept"]))[st.data.d[a][p][k]] || "—"; touch(); }));
    document.querySelectorAll("[data-r]").forEach((x) => (x.onclick = () => { const p = Number(x.dataset.r), v = st.data.ref[p]; st.data.ref[p] = v == null ? 1 : v === 1 ? 0 : null; x.textContent = ((st.config.labels || ["Reject", "Accept"]))[st.data.ref[p]] || "—"; touch(); }));
    b("g_padd", () => { const a = Math.min(S.ap, st.config.appraisers.length - 1), L = $("#g_paste").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\t,;\s]+/).map(num)); if (!L.length) return; L.slice(0, st.config.parts).forEach((row, p) => row.slice(0, st.config.trials).forEach((v, k) => (st.data.d[a][p][k] = v))); $("#entry").innerHTML = entryHtml(st); wire(); touch(); });
    const sr = $("#s_read"); if (sr) sr.oninput = () => { st.data.readings = nums(sr.value); $("#s_count").textContent = st.data.readings.length + " readings"; touch(); };
    document.querySelectorAll("[data-lr]").forEach((i) => (i.oninput = () => { st.data.rows[+i.dataset.lr].ref = num(i.value); touch(); }));
    document.querySelectorAll("[data-lv]").forEach((i) => (i.oninput = () => { st.data.rows[+i.dataset.lv].readings = nums(i.value); touch(); }));
    b("l_add", () => { st.data.rows.push({ ref: null, readings: [] }); $("#entry").innerHTML = entryHtml(st); wire(); });
    const pv = $("#l_pv"); if (pv) pv.oninput = () => { st.config.processVariation = num(pv.value); touch(); };
  }
  async function save(show) {
    const st = S.st, A = S.an || analyse(st);
    const res = { headline: A.headline || "" };
    if (A.ready && A.res) { const r = A.res; if (st.type === "grr") Object.assign(res, { pctGRR: r.pctGRR, pctTol: r.pctTol, ndc: r.ndc, method: r.method }); else if (st.type === "bias") Object.assign(res, { bias: r.bias, lo: r.lo, hi: r.hi }); else if (st.type === "linearity") Object.assign(res, { slope: r.slope, intercept: r.intercept, r2: r.r2 }); else if (st.type === "attribute") Object.assign(res, { effectiveness: r.effectiveness, miss: r.miss, falseAlarm: r.falseAlarm }); }
    try {
      const r = await call("kmr_msa_save", { p: { id: st.id, type: st.type, title: st.title, gauge_id: st.gauge_id, gauge_name: st.gauge_name, characteristic: st.characteristic, part_no: st.part_no, part_name: st.part_name, unit: st.unit, lsl: st.lsl, usl: st.usl, study_date: st.study_date, conducted_by: st.conducted_by,
        config: st.config, data: st.data, results: res, decision: A.ready ? A.decision : null, notes: st.notes } });
      st.results = r.results; st.decision = r.decision; dirty = false; if (show) say("Saved.", true); return true;
    } catch (e) { say(e.message); return false; }
  }
  window.addEventListener("beforeunload", (e) => { if (dirty && editable()) { e.preventDefault(); e.returnValue = ""; } });

  /* ================= export / import ================= */
  function exportJson() {
    const st = S.st, o = { kmr: "msa-study", version: 1, study: { type: st.type, title: st.title, gauge_id: st.gauge_id, gauge_name: st.gauge_name, characteristic: st.characteristic, part_no: st.part_no, part_name: st.part_name, unit: st.unit, lsl: st.lsl, usl: st.usl, study_date: st.study_date, conducted_by: st.conducted_by, config: st.config, data: st.data, notes: st.notes } };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = (st.no + "-" + (st.title || st.type)).replace(/[^\w.-]+/g, "_") + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importJson(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      const o = JSON.parse(await file.text()); if (o.kmr !== "msa-study" || !o.study) throw new Error("This is not an MSA Studies export.");
      const r = await call("kmr_msa_save", { p: Object.assign({}, o.study, { id: null }) }); say("Imported. Open it and press Save to calculate and store the result.", true); goStudy(r.id);
    } catch (er) { say(er.message); } e.target.value = "";
  }

  /* ================= dashboard ================= */
  async function drawDash() {
    const d = await call("kmr_msa_dashboard"), el = $("#dash"), bd = d.by_decision || {}, bt = d.by_type || {};
    const list = (a) => (a && a.length ? a.map((s) => `<div class="t" data-open="${s.id}"><div class="tb"><div class="tt">${esc(s.no)} · ${esc(s.title || TYPES[s.type][0])}</div><div class="tm"><span>${esc(TYPES[s.type][0])}</span><span>${fmt(s.study_date)}</span>${chip(s.decision)}<span>${esc((s.results && s.results.headline) || "")}</span></div></div></div>`).join("") : '<div class="empty">Nothing here.</div>');
    el.innerHTML = `<div class="kpis"><div class="kpi"><b>${d.total}</b><span>studies</span></div><div class="kpi" style="--c:var(--g)"><b>${bd.Acceptable || 0}</b><span>acceptable</span></div><div class="kpi" style="--c:var(--a)"><b>${bd.Conditional || 0}</b><span>conditional</span></div><div class="kpi" style="--c:var(--r)"><b>${bd["Not acceptable"] || 0}</b><span>not acceptable</span></div><div class="kpi" style="--c:#94a3b8"><b>${d.draft}</b><span>still draft</span></div></div>
      <div class="two"><div class="card"><h3>Not acceptable — needs action</h3>${list(d.attention)}</div><div class="card"><h3>Latest studies</h3>${list(d.recent)}</div></div>
      <div class="card"><h3>By type</h3>${Object.keys(TYPES).map((k) => `<span class="pillw" style="margin-right:6px">${esc(TYPES[k][0])}: <b>${bt[k] || 0}</b></span>`).join("")}</div>`;
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => goStudy(r.dataset.open)));
  }

  (async () => {
    try { await QP.init("msa"); if (!QP.ctx) return; await route(); } catch (e) { say(e.message); }
  })();
})();
