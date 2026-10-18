/* MSA Studies - one screen per study: 1 About the study, 2 Enter the readings, 3 Study report (laid out as in the AIAG MSA manual, 4th ed.).
   Data calls are kmr_msa_* (database) or msa-demo.js (?demo=1). Calculations are in msa-calc.js / spc-calc.js (checked against the AIAG Gage R&R example). Readings are typed or pasted in by hand. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, M = window.MSACalc, C = window.SPCCalc, Tol = window.KMRTol;
  const S = { list: [], f: { q: "", type: "", decision: "", status: "" }, st: null, method: "anova", dirty: false };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(sel) ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const TYPES = { grr: ["Gage R&R", "How repeatable and reproducible is the gauge?", "Several people measure the same parts more than once. Use for any gauge named in the Control Plan.", "msa.gage-r-r"],
    bias: ["Bias", "Does the gauge read high or low?", "Measure one master part with a known value, many times.", "msa.bias-linearity-stability"],
    linearity: ["Linearity", "Is the bias the same across the working range?", "Measure several masters from small to large, each several times.", "msa.bias-linearity-stability"],
    stability: ["Stability", "Does the gauge drift over time?", "Measure the same master on a regular schedule and watch the control chart.", "msa.bias-linearity-stability"],
    attribute: ["Attribute agreement", "Do the go / no-go decisions agree?", "Several people judge parts whose true status is known (go / no-go, visual checks).", "msa.attribute-agreement"] };
  const DEC = { Acceptable: "g", Conditional: "a", "Not acceptable": "r" };
  const num = (v) => { const n = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) ? n : null; };
  const nums = (s) => String(s || "").split(/[\s,;]+/).map(num).filter((x) => x != null);
  const f = (v, d) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(d == null ? 4 : d));
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const canEdit = () => !!QP.canEdit, isFinal = () => S.st && S.st.status === "final", editable = () => canEdit() && !isFinal();
  const chip = (d) => (d ? `<span class="chip ${DEC[d] || "x"}">${esc(d)}</span>` : '<span class="chip x">not calculated</span>');
  const today = () => new Date().toISOString().slice(0, 10);
  const COL = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777"];
  const tolOf = (st) => Tol.calc((st.config && st.config.tol) || (st.lsl != null || st.usl != null ? { type: "limits", lsl: st.lsl, usl: st.usl } : { type: "sym" }));

  /* ================= router ================= */
  async function route() {
    const hp = hashParts(), go = ["std", "list", "study", "dash"].includes(hp.go) ? hp.go : "std";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === (go === "study" ? "list" : go))); ["std", "list", "study", "dash"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go)); say("");
    try {
      if (go === "std") KMRStd.draw($("#std"), "msa");
      else if (go === "list") await drawList();
      else if (go === "dash") await drawDash();
      else if (hp.id) { S.st = await call("kmr_msa_get", { p_id: hp.id }); S.method = (S.st.config && S.st.config.method) || "anova"; S.dirty = false; render(); }
      else if (TYPES[hp.new]) { S.st = blankStudy(hp.new); S.method = "anova"; S.dirty = false; render(); }
      else { setGo("go=list"); route(); }
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);
  const goStudy = (id) => { setGo("go=study&id=" + id); route(); };
  function blankStudy(t) {
    const cfg = t === "grr" ? { appraisers: ["A", "B", "C"], parts: 10, trials: 3, k: 6 } : t === "attribute" ? { appraisers: ["A", "B", "C"], parts: 20, trials: 2, labels: ["Reject", "Accept"] } : t === "linearity" ? {} : {};
    const data = t === "grr" ? blank(t, 3, 10, 3) : t === "attribute" ? blank(t, 3, 20, 2) : t === "linearity" ? { rows: [2, 4, 6, 8, 10].map(() => ({ ref: null, readings: [] })) } : { readings: [] };
    return { id: null, type: t, status: "draft", study_date: today(), config: cfg, data, results: null, decision: null };
  }
  const blank = (t, A, P, T) => (t === "grr" ? { d: Array.from({ length: A }, () => Array.from({ length: P }, () => Array(T).fill(null))) } : { ref: Array(P).fill(null), d: Array.from({ length: A }, () => Array.from({ length: P }, () => Array(T).fill(null))) });
  function resize(data, t, A, P, T) {
    const old = (data && data.d) || [], d = Array.from({ length: A }, (_, a) => Array.from({ length: P }, (_, p) => Array.from({ length: T }, (_, k) => ((old[a] || [])[p] || [])[k] ?? null)));
    return t === "grr" ? { d } : { ref: Array.from({ length: P }, (_, p) => ((data && data.ref) || [])[p] ?? null), d };
  }

  /* ================= register + "which study?" ================= */
  async function drawList() {
    S.list = await call("kmr_msa_list", { p: S.f });
    const el = $("#list"), can = canEdit();
    el.innerHTML = `${can ? `<div class="card"><h3>Start a new study — what do you want to find out?</h3><div class="tcards">${Object.entries(TYPES).map(([k, v]) => { const lk = !hasF(v[3]); return `<button class="tcard${lk ? " lk" : ""}" data-new="${k}"><b>${lk ? "🔒 " : ""}${v[0]}</b><span>${esc(v[1])}</span><small>${esc(v[2])}</small></button>`; }).join("")}</div></div>` : ""}
      <h3 style="margin:14px 0 8px">Studies</h3><div class="row"><input class="grow" id="fq" placeholder="Search number, gauge, characteristic, part…" value="${esc(S.f.q)}">
      <select id="ft" style="width:auto">${opts([["", "All types"]].concat(Object.entries(TYPES).map(([k, v]) => [k, v[0]])), S.f.type)}</select><select id="fd" style="width:auto">${opts([["", "Any decision"], ["Acceptable", "Acceptable"], ["Conditional", "Conditional"], ["Not acceptable", "Not acceptable"]], S.f.decision)}</select>
      <select id="fs" style="width:auto">${opts([["", "Draft and final"], ["draft", "Draft"], ["final", "Final"]], S.f.status)}</select>${can ? '<label class="btn o s" style="cursor:pointer">Import a study<input type="file" id="imp" accept=".json,application/json" hidden></label>' : ""}</div>
      ${S.list.length ? `<div class="sc"><table class="tb2"><thead><tr><th>No.</th><th>Study</th><th>Type</th><th>Gauge</th><th>Date</th><th>Result</th><th>Decision</th><th></th></tr></thead><tbody>${S.list.map((s) => `<tr data-open="${s.id}" style="cursor:pointer"><td><b>${esc(s.no)}</b></td><td>${esc(s.title || s.characteristic || "—")}${s.sample ? ' <span class="pillw">sample</span>' : ""}</td><td>${esc(TYPES[s.type][0])}</td><td>${esc([s.gauge_id, s.gauge_name].filter(Boolean).join(" · ") || "—")}</td><td>${fmt(s.study_date)}</td><td>${esc((s.results && s.results.headline) || "—")}</td><td>${chip(s.decision)}</td><td>${s.status === "final" ? '<span class="chip x">final</span>' : '<span class="chip b">draft</span>'}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty">No studies yet.<br>${can ? "Choose a study above to start the first one." : "Ask an editor to start the first study."}</div>`}`;
    let t; $("#fq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.f.q = e.target.value; drawList().then(() => { const i = $("#fq"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
    $("#ft").onchange = (e) => { S.f.type = e.target.value; drawList(); }; $("#fd").onchange = (e) => { S.f.decision = e.target.value; drawList(); }; $("#fs").onchange = (e) => { S.f.status = e.target.value; drawList(); };
    if ($("#imp")) $("#imp").onchange = importJson;
    el.querySelectorAll("[data-new]").forEach((b) => (b.onclick = () => { const k = b.dataset.new; if (!hasF(TYPES[k][3])) { KMRLock.need(TYPES[k][3]); return; } setGo("go=study&new=" + k); route(); }));
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => goStudy(r.dataset.open)));
  }

  /* ================= the study page ================= */
  function render() {
    const st = S.st, el = $("#study"), saved = !!st.id, ed = editable(), t = st.type;
    el.innerHTML = `<div class="row noprint"><a href="#go=list" class="btn o s">← All studies</a><div style="flex:1"></div>${canEdit() && !isFinal() ? '<button class="btn s" id="b_save">Save study</button>' : ""}${saved && canEdit() && !isFinal() ? '<button class="btn g s" id="b_fin">Finalise</button>' : ""}${isFinal() && st.is_admin ? '<button class="btn o s" id="b_reopen">Reopen</button>' : ""}
        ${saved ? '<button class="btn o s" id="b_print">Print report</button><button class="btn o s" id="b_exp">Export</button>' : ""}${saved && canEdit() && (!isFinal() || st.is_admin) ? '<button class="btn r s" id="b_del">Delete</button>' : ""}</div>
      <h2 style="margin:0 0 2px" id="h_title">${esc(st.title || (saved ? TYPES[t][0] : "New study — " + TYPES[t][0]))}</h2><div class="mut" style="margin-bottom:12px">${esc(TYPES[t][1])}${saved ? " · " + esc(st.no) : ""} ${isFinal() ? '<span class="chip x">final · locked</span>' : saved ? '<span class="chip a">draft</span>' : ""}${st.sample ? ' <span class="pillw">sample</span>' : ""}</div>
      ${isFinal() ? `<p class="msg ok noprint">Finalised${st.finalised_by ? " by " + esc(st.finalised_by) : ""}${st.finalised_at ? " on " + fmt(st.finalised_at) : ""}. The study is locked.</p>` : ""}
      <div class="step noprint"><div class="sh"><span class="sn">1</span> About the study</div><div id="m_setup">${setupHtml(st, ed)}</div></div>
      <div class="step noprint"><div class="sh"><span class="sn">2</span> Enter the readings</div><div id="m_entry" data-nofilter></div></div>
      <div class="step"><div class="sh"><span class="sn">3</span> Study report</div><div id="m_report" data-nofilter></div></div>`;
    entry(); paint(); wireTop(); wireSetup();
  }
  function setupHtml(st, ed) {
    const t = st.type, cfg = st.config || {}, dis = ed ? "" : " disabled", g = t === "grr" || t === "attribute", tolOn = t !== "attribute", tolv = cfg.tol || (st.lsl != null || st.usl != null ? { type: "limits", lsl: st.lsl, usl: st.usl } : { type: "sym" });
    return `<fieldset style="border:0;padding:0;margin:0"${dis}><div class="frm"><div class="w"><label>Name of this study</label><input id="s_title" value="${esc(st.title || "")}" placeholder="e.g. Bore gauge BG-12 — Gage R&R"></div>
      <div><label>Gauge number</label><input id="s_gauge_id" value="${esc(st.gauge_id || "")}"></div><div><label>Gauge name / type</label><input id="s_gauge_name" value="${esc(st.gauge_name || "")}" placeholder="e.g. dial bore gauge"></div>
      <div><label>Characteristic measured</label><input id="s_characteristic" value="${esc(st.characteristic || "")}" placeholder="e.g. bore diameter"></div><div><label>Unit of measure</label><input id="s_unit" value="${esc(st.unit || "")}" placeholder="mm"></div>
      <div><label>Part number</label><input id="s_part_no" value="${esc(st.part_no || "")}"></div><div><label>Part name</label><input id="s_part_name" value="${esc(st.part_name || "")}"></div>
      <div><label>Study date</label><input id="s_date" type="date" value="${esc(String(st.study_date || today()).slice(0, 10))}"></div><div><label>Study done by</label><input id="s_by" value="${esc(st.conducted_by || "")}"></div>
      ${g ? `<div class="w"><label>People who measure (appraisers) — names separated by commas, 2 to 5</label><input id="s_ap" value="${esc((cfg.appraisers || []).join(", "))}"></div><div><label>Number of parts <span class="mut">(${t === "grr" ? "10 is the usual" : "20 or more"})</span></label><input id="s_parts" type="number" min="2" max="${t === "grr" ? 15 : 50}" value="${esc(cfg.parts || "")}"></div><div><label>Times each person measures each part</label><input id="s_trials" type="number" min="${t === "grr" ? 2 : 1}" max="5" value="${esc(cfg.trials || "")}"></div>` : ""}
      ${t === "bias" || t === "stability" ? `<div><label>Master value (known true value)</label><input id="s_ref" inputmode="decimal" value="${esc(cfg.reference ?? "")}"></div>` : ""}
      ${t === "linearity" ? `<div><label>Process variation (total spread of the process, same unit) <span class="mut">blank = use the tolerance</span></label><input id="s_pv" inputmode="decimal" value="${esc(cfg.processVariation ?? "")}"></div>` : ""}
      ${t === "grr" ? `<div><label>Spread multiplier</label><select id="s_k">${opts([[6, "6 σ (99.73%) — current manual"], [5.15, "5.15 σ (99%) — older practice"]], cfg.k || 6)}</select></div>` : ""}</div>
      ${tolOn ? `<div class="lbl" style="margin:12px 0 4px">Specification of the characteristic — gives the tolerance for %tolerance <span class="mut">(optional)</span></div>${Tol.html("tl", tolv)}` : ""}
      <div class="w" style="margin-top:10px"><label>Notes</label><textarea id="s_notes" rows="2">${esc(st.notes || "")}</textarea></div></fieldset>`;
  }
  function wireSetup() {
    const st = S.st, t = st.type, setv = (k, id) => { const e = $("#" + id); if (e) e.addEventListener("input", () => { st[k] = e.value; S.dirty = true; if (k === "title") $("#h_title").textContent = e.value || TYPES[t][0]; }); };
    [["title", "s_title"], ["gauge_id", "s_gauge_id"], ["gauge_name", "s_gauge_name"], ["characteristic", "s_characteristic"], ["unit", "s_unit"], ["part_no", "s_part_no"], ["part_name", "s_part_name"], ["study_date", "s_date"], ["conducted_by", "s_by"], ["notes", "s_notes"]].forEach((x) => setv(...x));
    ["input", "change"].forEach((ev) => { const r = $("#s_ref"); if (r) r.addEventListener(ev, () => { st.config.reference = num(r.value); S.dirty = true; paint(); }); const pv = $("#s_pv"); if (pv) pv.addEventListener(ev, () => { st.config.processVariation = num(pv.value); S.dirty = true; paint(); }); const k = $("#s_k"); if (k) k.addEventListener(ev, () => { st.config.k = Number(k.value); S.dirty = true; paint(); }); });
    let ready = false;
    if (t !== "attribute") Tol.wire("tl", (o) => { const c = st.config; c.tol = { type: o.type, n: o.n, a: o.a, b: o.b, lsl: o.type === "limits" ? o.lsl : undefined, usl: o.type === "limits" ? o.usl : undefined }; st.lsl = o.lsl; st.usl = o.usl; if (ready) { S.dirty = true; paint(); } });
    ready = true;
    if (t === "grr" || t === "attribute") {
      const dims = () => {
        const ap = V("s_ap").split(",").map((x) => x.trim()).filter(Boolean), P = Math.round(Number(V("s_parts"))), T = Math.round(Number(V("s_trials")));
        if (ap.length < 2 || ap.length > 5 || !(P >= 2 && P <= 50) || !(T >= 1 && T <= 5) || (t === "grr" && (T < 2 || P > 15))) return;
        const c = st.config; if (ap.join("|") === c.appraisers.join("|") && P === c.parts && T === c.trials) return; Object.assign(c, { appraisers: ap, parts: P, trials: T }); st.data = resize(st.data, t, ap.length, P, T); S.dirty = true; entry(); paint();
      };
      ["s_ap", "s_parts", "s_trials"].forEach((id) => $("#" + id).addEventListener("change", dims));
    }
  }

  /* ================= analysis (live while typing) ================= */
  function analyse(st) {
    const t = st.type, cfg = st.config || {}, dt = st.data || {}, tl = tolOf(st), tol = tl.tolerance, A = { type: t, ready: false, msg: "", res: null, decision: null, headline: "", tol, tl };
    if (t === "grr" || t === "attribute") {
      const d = dt.d || [], miss = d.flat(2).filter((v) => v == null || !Number.isFinite(Number(v))).length, total = d.flat(2).length;
      if (t === "attribute") { const rf = (dt.ref || []).filter((v) => v === 0 || v === 1).length; if (miss || rf < (dt.ref || []).length) { A.msg = `Tap every cell and the true status of every part: ${miss + ((dt.ref || []).length - rf)} of ${total + (dt.ref || []).length} still empty.`; return A; } }
      else if (miss) { A.msg = `Enter every reading: ${miss} of ${total} still empty.`; return A; }
      if (t === "grr") {
        const dd = d.map((a) => a.map((p) => p.map(Number))); A.dd = dd; A.range = M.grrRange(dd, { tol, k: cfg.k || 6 }); A.anova = (cfg.trials || 0) >= 2 ? M.grrAnova(dd, { tol, k: cfg.k || 6 }) : null;
        const r = S.method === "range" || !A.anova || A.anova.error ? A.range : A.anova; A.res = r; if (!r || r.error) { A.msg = (r && r.error) || "Check the readings."; return A; }
        A.decision = r.decision; A.ready = true; A.headline = `%GRR ${r.pctGRR.toFixed(1)}%${r.pctTol != null ? " · %tolerance " + r.pctTol.toFixed(1) + "%" : ""} · ${r.ndc} distinct categories`;
      } else {
        const r = M.attribute(d.map((a) => a.map((p) => p.map(Number))), dt.ref); A.res = r; if (r.error) { A.msg = r.error; return A; } A.ready = true; A.decision = r.decision;
        A.headline = r.hasRef ? `Effectiveness ${r.effectiveness.toFixed(0)}% · miss ${r.miss == null ? "—" : r.miss.toFixed(0) + "%"} · false alarm ${r.falseAlarm == null ? "—" : r.falseAlarm.toFixed(0) + "%"}` : "Agreement between appraisers (kappa)";
      }
    } else if (t === "bias") {
      const r = M.bias(dt.readings || [], cfg.reference, { tol }); if (!r) { A.msg = "Enter the master value and at least 2 readings."; return A; } A.res = r; A.ready = true; A.decision = r.zeroInside ? "Acceptable" : "Not acceptable";
      A.headline = `Bias ${r.bias.toFixed(4)}${st.unit ? " " + st.unit : ""} · zero ${r.zeroInside ? "inside" : "outside"} the 95% interval`;
    } else if (t === "linearity") {
      const r = M.linearity((dt.rows || []).filter((x) => num(x.ref) != null), { tol, processVariation: num(cfg.processVariation) || (tol != null ? tol : undefined) }); if (!r || r.error) { A.msg = (r && r.error) || "Enter at least 3 masters and 6 readings."; return A; }
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
    o = o || {}; const W = 780, H = 220, L = 54, R = (o.hlines || []).length ? 84 : 16, T = 12, B = 26, n = labels.length, d = o.d == null ? 3 : o.d, ys = [];
    series.forEach((s) => s.vals.forEach((v) => Number.isFinite(v) && ys.push(v))); (o.hlines || []).forEach((h) => ys.push(h.v)); if (!ys.length) return "";
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
    const X = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B), step = Math.max(1, Math.ceil(n / 14)), tick = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    return `<div class="cc"><h4>${esc(title)}</h4><svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e9f2"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(d)}</text>`).join("")}
      ${(o.hlines || []).map((h) => `<line x1="${L}" x2="${W - R}" y1="${Y(h.v)}" y2="${Y(h.v)}" stroke="${h.c}" stroke-width="1.4"${h.dash ? ' stroke-dasharray="6 4"' : ""}/><text x="${W - R + 4}" y="${Y(h.v) + 4}" fill="${h.c}">${esc(h.t)}</text>`).join("")}
      ${series.map((s) => `<polyline fill="none" stroke="${s.c}" stroke-width="1.5" points="${s.vals.map((v, i) => (Number.isFinite(v) ? X(i).toFixed(1) + "," + Y(v).toFixed(1) : "")).filter(Boolean).join(" ")}"/>${s.vals.map((v, i) => (Number.isFinite(v) ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${s.flag && s.flag[i] ? 5 : 3}" fill="${s.flag && s.flag[i] ? "#dc2626" : s.c}"><title>${esc(s.name)} ${esc(labels[i])}: ${v.toFixed(d)}</title></circle>` : "")).join("")}`).join("")}
      ${labels.map((lb, i) => (i % step === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(String(lb).slice(0, 8))}</text>` : "")).join("")}</svg>
      ${series.length > 1 ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin:2px 8px 4px;font-size:12px">${series.map((s) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.c};margin-right:4px"></i>${esc(s.name)}</span>`).join("")}</div>` : ""}</div>`;
  }
  function svgBars(title, rows) {
    const W = 780, rh = 30, H = rows.length * rh + 16, L = 190;
    return `<div class="cc"><h4>${esc(title)}</h4><svg class="svgw" viewBox="0 0 ${W} ${H}">${rows.map((r, i) => { const y = 8 + i * rh, w = Math.max(1, (Math.min(100, r.v) / 100) * (W - L - 60)); return `<text x="0" y="${y + 15}" style="fill:var(--ink)">${esc(r.t)}</text><rect x="${L}" y="${y + 3}" width="${W - L - 60}" height="16" rx="8" fill="#e8eef6"/><rect x="${L}" y="${y + 3}" width="${w}" height="16" rx="8" fill="${r.c}"/><text x="${L + w + 6}" y="${y + 16}" style="fill:var(--ink)">${r.v.toFixed(1)}%</text>`; }).join("")}</svg></div>`;
  }
  function svgScatter(st, res) {
    const W = 780, H = 240, L = 58, R = 16, T = 12, B = 30, pts = [], rows = (st.data.rows || []).filter((r) => num(r.ref) != null);
    rows.forEach((r) => (r.readings || []).map(num).filter((x) => x != null).forEach((v) => pts.push({ x: Number(r.ref), y: v - Number(r.ref) }))); if (pts.length < 2) return "";
    const xs = pts.map((p) => p.x), ysv = pts.map((p) => p.y).concat(res.parts.map((p) => p.bias)); let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ysv, 0), y1 = Math.max(...ysv, 0); const py = (y1 - y0) * 0.15 || 1; y0 -= py; y1 += py; const dx = (x1 - x0) * 0.05 || 1; x0 -= dx; x1 += dx;
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B), tick = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
    return `<div class="cc"><h4>Bias against the reference value</h4><svg class="svgw" viewBox="0 0 ${W} ${H}">${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e9f2"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(3)}</text>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#16a34a" stroke-width="1.4"/><line x1="${X(x0)}" y1="${Y(res.intercept + res.slope * x0)}" x2="${X(x1)}" y2="${Y(res.intercept + res.slope * x1)}" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="6 4"/>
      ${pts.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="#94a3b8"/>`).join("")}${res.parts.map((p) => `<circle cx="${X(p.ref).toFixed(1)}" cy="${Y(p.bias).toFixed(1)}" r="5" fill="#0f766e"><title>Reference ${p.ref}: average bias ${p.bias.toFixed(4)}</title></circle>`).join("")}${res.parts.map((p) => `<text x="${X(p.ref)}" y="${H - 10}" text-anchor="middle">${p.ref}</text>`).join("")}</svg><div class="mut" style="font-size:12px;margin:2px 8px 4px">Grey dots: each reading's bias · green dots: average bias per master · red line: fitted line · green line: zero bias</div></div>`;
  }

  /* ----- 2: entry (all appraisers on one screen) ----- */
  function entry() {
    const st = S.st, ed = editable(), dis = ed ? "" : " disabled", t = st.type, cfg = st.config || {}, el = $("#m_entry");
    if (t === "grr" || t === "attribute") {
      const ap = cfg.appraisers || [], P = cfg.parts, T = cfg.trials, lb = cfg.labels || ["Reject", "Accept"], cyc = (v) => (v === 1 ? lb[1] : v === 0 ? lb[0] : "—");
      el.innerHTML = `<p class="mut" style="margin:0 0 8px;font-size:13px">${t === "grr" ? `Each person measures every part ${T} times. Measure the parts in random order and do not let a person see the earlier readings. Type the readings below (Enter moves to the next box).` : `Tap a cell to change it: — → ${esc(lb[1])} → ${esc(lb[0])}. The <b>true status</b> of each part (known from a reference measurement) goes in the last column of the first table.`}</p>
        <div class="atabs">${ap.map((nm, a) => `<div class="atab"><div class="ah">${esc(nm)}</div><div class="sc"><table class="gtab"><thead><tr><th>Part</th>${Array.from({ length: T }, (_, k) => `<th>Trial ${k + 1}</th>`).join("")}${t === "attribute" && a === 0 ? "<th>True status</th>" : ""}</tr></thead><tbody>${Array.from({ length: P }, (_, p) => `<tr><td><b>${p + 1}</b></td>${Array.from({ length: T }, (_, k) => t === "grr" ? `<td><input data-a="${a}" data-p="${p}" data-k="${k}" inputmode="decimal" value="${esc(st.data.d[a][p][k] ?? "")}"${dis}></td>` : `<td><button class="ab" data-c="${a}.${p}.${k}"${dis}>${esc(cyc(st.data.d[a][p][k]))}</button></td>`).join("")}${t === "attribute" && a === 0 ? `<td><button class="ab" data-r="${p}"${dis}>${esc(cyc(st.data.ref[p]))}</button></td>` : ""}</tr>`).join("")}</tbody></table></div>
        ${t === "grr" && ed ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:var(--b1);font-size:13px;font-weight:600">Paste ${esc(nm)}'s readings from Excel</summary><textarea data-paste="${a}" rows="3" placeholder="${P} lines, ${T} columns"></textarea><button class="btn o s" data-padd="${a}" style="margin-top:4px">Use pasted readings</button></details>` : ""}</div>`).join("")}</div>`;
    } else if (t === "bias" || t === "stability") {
      el.innerHTML = `<p class="mut" style="margin:0 0 6px;font-size:13px">${t === "bias" ? "Measure the master part at least 10 times (the manual suggests 10 or more) and type the readings, separated by spaces or new lines." : "Type the master readings in time order (for example one a week). At least 5 are needed; 20 or more give a useful chart."}</p><textarea id="s_read" rows="4" placeholder="Type or paste the readings"${dis}>${esc((st.data.readings || []).join(" "))}</textarea><div class="mut" style="font-size:12.5px;margin-top:4px" id="s_count">${(st.data.readings || []).length} readings</div>`;
    } else {
      const rows = st.data.rows || [];
      el.innerHTML = `<p class="mut" style="margin:0 0 8px;font-size:13px">One line for each master part: its known (reference) value, then the readings of the gauge for that master. Use at least 5 masters spread over the working range, each measured 10 or more times (minimum: 3 masters and 6 readings).</p>${rows.map((r, i) => `<div class="gr"><input data-lr="${i}" inputmode="decimal" placeholder="reference value" value="${esc(r.ref ?? "")}" style="width:130px"${dis}><input data-lv="${i}" placeholder="readings, separated by spaces" value="${esc((r.readings || []).join(" "))}" style="flex:1;min-width:200px"${dis}></div>`).join("")}${ed ? '<button class="btn o s" id="l_add">＋ Add a master</button>' : ""}`;
    }
    wireEntry();
  }
  function wireEntry() {
    const st = S.st, touch = () => { S.dirty = true; paint(); };
    document.querySelectorAll("input[data-a]").forEach((i) => { i.oninput = () => { st.data.d[+i.dataset.a][+i.dataset.p][+i.dataset.k] = num(i.value); touch(); }; });
    const all = [...document.querySelectorAll("input[data-a]")]; all.forEach((i, k) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const nx = all[k + 1]; if (nx) nx.focus(); } }));
    document.querySelectorAll("[data-c]").forEach((x) => (x.onclick = () => { const [a, p, k] = x.dataset.c.split(".").map(Number), v = st.data.d[a][p][k]; st.data.d[a][p][k] = v == null ? 1 : v === 1 ? 0 : null; x.textContent = (st.config.labels || ["Reject", "Accept"])[st.data.d[a][p][k]] || "—"; touch(); }));
    document.querySelectorAll("[data-r]").forEach((x) => (x.onclick = () => { const p = Number(x.dataset.r), v = st.data.ref[p]; st.data.ref[p] = v == null ? 1 : v === 1 ? 0 : null; x.textContent = (st.config.labels || ["Reject", "Accept"])[st.data.ref[p]] || "—"; touch(); }));
    document.querySelectorAll("[data-padd]").forEach((x) => (x.onclick = () => { const a = Number(x.dataset.padd), L = document.querySelector(`[data-paste="${a}"]`).value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\t,;\s]+/).map(num)); L.slice(0, st.config.parts).forEach((row, p) => row.slice(0, st.config.trials).forEach((v, k) => (st.data.d[a][p][k] = v))); entry(); touch(); }));
    const sr = $("#s_read"); if (sr) sr.oninput = () => { st.data.readings = nums(sr.value); $("#s_count").textContent = st.data.readings.length + " readings"; touch(); };
    document.querySelectorAll("[data-lr]").forEach((i) => (i.oninput = () => { st.data.rows[+i.dataset.lr].ref = num(i.value); touch(); }));
    document.querySelectorAll("[data-lv]").forEach((i) => (i.oninput = () => { st.data.rows[+i.dataset.lv].readings = nums(i.value); touch(); }));
    const la = $("#l_add"); if (la) la.onclick = () => { st.data.rows.push({ ref: null, readings: [] }); entry(); };
  }

  /* ----- 3: report (as in the AIAG MSA manual) ----- */
  function paint() { S.painted = true; const st = S.st, A = (S.an = analyse(st)); $("#m_report").innerHTML = reportHtml(st, A); document.querySelectorAll("[data-meth]").forEach((b) => (b.onclick = () => { S.method = b.dataset.meth; st.config.method = S.method; S.dirty = true; paint(); })); }
  const kp = (a, b, c) => `<div class="kpi" style="--c:${c || "var(--b1)"};cursor:default"><b>${a}</b><span>${b}</span></div>`;
  function headTable(st, A) {
    const t = st.type, cfg = st.config || {}, tl = A.tl, co = (QP.ctx && QP.ctx.company) || "";
    return `<table class="tb2 rh"><tbody><tr><th>Company</th><td>${esc(co)}</td><th>Study no.</th><td>${esc(st.no || "(not saved yet)")}</td></tr>
      <tr><th>Gauge number / name</th><td>${esc([st.gauge_id, st.gauge_name].filter(Boolean).join(" · ") || "—")}</td><th>Study type</th><td>${esc(TYPES[t][0])}</td></tr>
      <tr><th>Characteristic</th><td>${esc(st.characteristic || "—")}${st.unit ? " (" + esc(st.unit) + ")" : ""}</td><th>Specification / tolerance</th><td>${tl && tl.ok ? esc(tl.symbol) + (tl.tolerance != null ? " · tolerance " + tl.tolerance : "") : "—"}</td></tr>
      <tr><th>Part number / name</th><td>${esc([st.part_no, st.part_name].filter(Boolean).join(" · ") || "—")}</td><th>Date · done by</th><td>${fmt(st.study_date)}${st.conducted_by ? " · " + esc(st.conducted_by) : ""}</td></tr>
      ${t === "grr" || t === "attribute" ? `<tr><th>Appraisers</th><td>${esc((cfg.appraisers || []).join(", "))}</td><th>Parts × trials</th><td>${cfg.parts} parts × ${cfg.trials} trials</td></tr>` : ""}${t === "bias" || t === "stability" ? `<tr><th>Master value</th><td>${cfg.reference == null ? "—" : esc(cfg.reference)}</td><th>Readings</th><td>${(st.data.readings || []).length}</td></tr>` : ""}</tbody></table>`;
  }
  const signoff = (st) => `<table class="tb2 sign"><tbody><tr><th>Study done by</th><td>${esc(st.conducted_by || "")}</td><th>Date</th><td></td><th>Reviewed / approved by</th><td></td><th>Date</th><td></td></tr></tbody></table>`;
  function reportHtml(st, A) {
    const t = st.type, d = Math.min(5, Math.max(3, ...[st.lsl, st.usl].map((v) => (v == null ? 0 : (String(v).split(".")[1] || "").length)) ) + 1), unit = st.unit ? " " + esc(st.unit) : "";
    const head = headTable(st, A);
    if (!A.ready) return head + `<div class="empty" style="margin-top:12px">${esc(A.msg || "Enter the readings to see the result.")}</div>`;
    const dec = `<div class="row" style="margin:12px 0 4px"><b style="font-size:16px">Decision:</b> ${chip(A.decision)}<span class="mut">${esc(A.headline)}</span></div>`;
    const foot = `${st.notes ? `<p><b>Notes:</b> ${esc(st.notes)}</p>` : ""}${signoff(st)}<p class="mut" style="font-size:11.5px;margin:6px 0 0">Prepared as a measurement system analysis according to the AIAG MSA manual (4th edition).</p>`;
    if (t === "grr") {
      const r = A.res, k = r.k, tol = A.tol, isA = r.method === "anova", dd = A.dd, ap = st.config.appraisers || [], P = r.P, T = r.T, Ar = r.A;
      const rows = isA ? [["Repeatability — equipment variation (EV)", r.sd.repeat], ["Reproducibility — appraiser variation (AV)", r.sd.reprod], ["Gage R&R (GRR)", r.sd.grr], ["Part variation (PV)", r.sd.part], ["Total variation (TV)", r.sd.total]] : [["Repeatability — equipment variation (EV)", r.EV], ["Reproducibility — appraiser variation (AV)", r.AV], ["Gage R&R (GRR)", r.GRR], ["Part variation (PV)", r.PV], ["Total variation (TV)", r.TV]];
      const tv = rows[4][1], gc = r.decision === "Acceptable" ? "#16a34a" : r.decision === "Conditional" ? "#d97706" : "#dc2626";
      const bars = [["Repeatability", rows[0][1], COL[1]], ["Reproducibility", rows[1][1], COL[2]], ["Gage R&R", rows[2][1], gc], ["Part-to-part", rows[3][1], "#0f766e"]].map((x) => ({ t: x[0], v: tv > 0 ? (x[1] / tv) * 100 : 0, c: x[2] }));
      const lab = Array.from({ length: P }, (_, i) => String(i + 1)), means = dd.map((a, i) => ({ name: ap[i] || "A" + (i + 1), c: COL[i % 5], vals: a.map((p) => p.reduce((s, v) => s + v, 0) / p.length) })), rg = dd.map((a, i) => ({ name: ap[i] || "A" + (i + 1), c: COL[i % 5], vals: a.map((p) => Math.max(...p) - Math.min(...p)) }));
      const R = A.range && !A.range.error ? A.range : null;
      // data sheet as in the manual: per appraiser, trials down, parts across, with average and range
      const sheet = dd.map((a, i) => { const avg = a.map((p) => p.reduce((s, v) => s + v, 0) / T), rngs = a.map((p) => Math.max(...p) - Math.min(...p)); const xa = a.flat().reduce((s, v) => s + v, 0) / (P * T), ra = rngs.reduce((s, v) => s + v, 0) / P;
        return `<tr><th colspan="${P + 3}" style="background:${COL[i % 5]}22">Appraiser ${esc(ap[i] || "A" + (i + 1))}</th></tr>${Array.from({ length: T }, (_, k) => `<tr><td>Trial ${k + 1}</td>${a.map((p) => `<td>${f(p[k], d)}</td>`).join("")}<td></td><td></td></tr>`).join("")}<tr><td><b>Average</b></td>${avg.map((v) => `<td>${f(v, d + 1)}</td>`).join("")}<td><b>X̄ₐ ${f(xa, d + 1)}</b></td><td></td></tr><tr><td><b>Range</b></td>${rngs.map((v) => `<td${R && v > R.UCLR ? ' style="background:#fee2e2"' : ""}>${f(v, d + 1)}</td>`).join("")}<td></td><td><b>R̄ₐ ${f(ra, d + 1)}</b></td></tr>`; }).join("");
      const pm = R ? R.partMeans : [];
      const dataSheet = `<div class="sc"><table class="tb2 ds"><thead><tr><th>Part</th>${lab.map((x) => `<th>${x}</th>`).join("")}<th>Average</th><th>Range</th></tr></thead><tbody>${sheet}<tr><td><b>Part average</b></td>${pm.map((v) => `<td>${f(v, d + 1)}</td>`).join("")}<td></td><td></td></tr></tbody></table></div>
        ${R ? `<p class="mut" style="font-size:12.5px">R̄ (average of the appraiser ranges) = <b>${f(R.Rbar, d + 2)}</b> · X̄DIFF (largest appraiser average − smallest) = <b>${f(Math.max(...R.appraiserMeans) - Math.min(...R.appraiserMeans), d + 2)}</b> · Rp (largest part average − smallest) = <b>${f(Math.max(...pm) - Math.min(...pm), d + 2)}</b> · UCL<sub>R</sub> = D₄ × R̄ = ${f(R.UCLR, d + 2)} (D₄ = ${M.D4[T]}). ${R.maxRange > R.UCLR ? "A range above UCL<sub>R</sub> (shaded) means that reading was not made the same way — find the reason and repeat it." : "All ranges are within UCL<sub>R</sub>: the readings are consistent."}</p>` : ""}`;
      return `${head}${dec}<div class="seg noprint"><button data-meth="anova" class="${isA ? "on" : ""}"${A.anova && !A.anova.error ? "" : " disabled"}>ANOVA method</button><button data-meth="range" class="${!isA ? "on" : ""}">Average &amp; range method</button></div>
        <div class="kpis">${kp(f(r.pctGRR, 1) + "%", "%GRR of total variation")}${kp(r.pctTol == null ? "—" : f(r.pctTol, 1) + "%", "%GRR of tolerance" + (tol == null ? " (enter the specification)" : ""))}${kp(r.ndc, "distinct categories (want 5 or more)", r.ndc >= 5 ? "var(--g)" : "var(--r)")}</div>
        <h4 class="rt">Gage repeatability and reproducibility — data sheet</h4>${dataSheet}
        <h4 class="rt">Gage R&amp;R report — ${isA ? "ANOVA method" : "average and range method"}</h4><div class="sc"><table class="tb2"><thead><tr><th>Source</th><th>Std. deviation</th><th>Study variation (${k}σ)</th><th>% of total variation</th>${tol != null ? "<th>% of tolerance</th>" : ""}</tr></thead><tbody>${rows.map((x) => `<tr><td>${x[0]}</td><td>${f(x[1], d + 2)}</td><td>${f(x[1] * k, d + 2)}</td><td>${tv > 0 ? f((x[1] / tv) * 100, 1) : "—"}%</td>${tol != null ? `<td>${f((x[1] * k / tol) * 100, 1)}%</td>` : ""}</tr>`).join("")}</tbody></table></div>
        <p class="mut" style="font-size:12.5px">${isA ? "Appraiser × part interaction " + (r.pooled ? "is not significant (p " + f(r.pInteraction, 3) + " > 0.25) and is combined with the error." : "is significant (p " + f(r.pInteraction, 3) + ") and is part of reproducibility.") : `Factors used: K₁ = ${M.K1[T]} (${T} trials), K₂ = ${M.K2[Ar]} (${Ar} appraisers), K₃ = ${M.K3[P]} (${P} parts). EV = R̄ × K₁ · AV = √[(X̄DIFF × K₂)² − EV² / (parts × trials)] · GRR = √(EV² + AV²) · PV = Rp × K₃ · TV = √(GRR² + PV²).`} Number of distinct categories ndc = 1.41 × PV / GRR = ${r.ndc}.</p>
        ${svgBars("Share of total variation", bars)}${svgMulti("Average of each part, by appraiser", means, lab, { d: d + 1 })}${svgMulti("Range of each part, by appraiser (R chart)", rg, lab, { d: d + 1, hlines: R ? [{ v: R.UCLR, c: "#dc2626", t: "UCLR " + R.UCLR.toFixed(d + 1), dash: 1 }] : [] })}
        ${isA ? `<h4 class="rt">ANOVA table</h4><div class="sc"><table class="tb2"><thead><tr><th>Source</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th></tr></thead><tbody>${r.table.map((x) => `<tr><td>${x.name}</td><td>${f(x.ss, 4)}</td><td>${x.df}</td><td>${f(x.ms, 4)}</td><td>${f(x.f, 2)}</td><td>${f(x.p, 3)}</td></tr>`).join("")}</tbody></table></div>` : ""}
        <h4 class="rt">Conclusion</h4><ul style="margin:0 0 10px;padding-left:20px"><li>${A.decision === "Acceptable" ? "Under 10% of the total variation (and of the tolerance): the measurement system is <b>acceptable</b>." : A.decision === "Conditional" ? "Between 10% and 30%: the measurement system <b>may be acceptable</b> depending on the importance of the application, the cost of the gauge and the cost of repair. Agree it with the customer." : "Over 30%: the measurement system is <b>not acceptable</b>. Find and correct the causes (equipment, method, training) and repeat the study."}</li><li>${r.ndc >= 5 ? "The gauge can tell 5 or more distinct groups of parts apart." : "Fewer than 5 distinct categories: the gauge cannot separate the parts well enough for process control."}</li><li>The decision follows the worse of %GRR of total variation and %GRR of tolerance.</li></ul>${foot}`;
    }
    if (t === "bias") {
      const r = A.res, rd = (st.data.readings || []).map(num).filter((x) => x != null);
      return `${head}${dec}<div class="kpis">${kp(f(r.mean, d), "average of " + r.n + " readings" + unit)}${kp(f(r.ref, d), "master value" + unit)}${kp(f(r.bias, d + 1), "bias" + unit, r.zeroInside ? "var(--g)" : "var(--r)")}${kp(f(r.sd, d + 1), "repeatability σ")}</div>
        <h4 class="rt">Bias study — calculations</h4><div class="sc"><table class="tb2"><tbody><tr><td>Bias = average − master value</td><td><b>${f(r.bias, d + 2)}</b></td></tr><tr><td>Repeatability σ<sub>r</sub> (standard deviation of the readings)</td><td>${f(r.sd, d + 2)}</td></tr><tr><td>Standard error of the bias σ<sub>b</sub> = σ<sub>r</sub> / √n</td><td>${f(r.se, d + 2)}</td></tr><tr><td>t = bias / σ<sub>b</sub> (${r.df} degrees of freedom)</td><td>${f(r.t, 3)}</td></tr><tr><td>p value</td><td>${f(r.p, 4)}</td></tr><tr><td>95% confidence interval of the bias = bias ± t × σ<sub>b</sub></td><td><b>${f(r.lo, d + 2)} to ${f(r.hi, d + 2)}</b></td></tr>${r.pctTol != null ? `<tr><td>Bias as % of tolerance</td><td>${f(r.pctTol, 1)}%</td></tr>` : ""}</tbody></table></div>
        ${svgMulti("Readings against the master value", [{ name: "Readings", c: COL[0], vals: rd }], rd.map((_, i) => String(i + 1)), { d: d + 1, hlines: [{ v: r.ref, c: "#16a34a", t: "master" }] })}
        <h4 class="rt">Conclusion</h4><p>The bias is acceptable when zero lies inside the confidence interval. ${r.zeroInside ? "Here it does: <b>no significant bias</b>." : "Here it does not: the gauge reads <b>" + (r.bias > 0 ? "high" : "low") + "</b> and needs adjustment or a correction."}</p>${foot}`;
    }
    if (t === "linearity") {
      const r = A.res; return `${head}${dec}<div class="kpis">${kp(f(r.slope, 4), "slope of bias on size")}${kp(f(r.intercept, 4), "intercept")}${kp(f(r.r2, 3), "R²")}${kp(f(r.linearity, 4), "linearity = |slope| × process variation", r.ok ? "var(--g)" : "var(--r)")}</div>
        <h4 class="rt">Linearity study — data</h4><div class="sc"><table class="tb2"><thead><tr><th>Master (reference)</th><th>Readings</th><th>Average</th><th>Bias = average − reference</th></tr></thead><tbody>${r.parts.map((p) => `<tr><td>${p.ref}</td><td>${p.n}</td><td>${f(p.mean, d + 1)}</td><td>${f(p.bias, d + 2)}</td></tr>`).join("")}</tbody></table></div>
        <h4 class="rt">Regression of bias on reference value</h4><div class="sc"><table class="tb2"><tbody><tr><td>Fitted line: bias = a + b × reference</td><td>a (intercept) = <b>${f(r.intercept, 4)}</b> · b (slope) = <b>${f(r.slope, 4)}</b></td></tr><tr><td>p for the slope · p for the intercept</td><td>${f(r.pSlope, 4)} · ${f(r.pIntercept, 4)}</td></tr><tr><td>Process variation used</td><td>${f(r.pv, d + 1)}</td></tr><tr><td>Linearity = |b| × process variation · %linearity = |b| × 100</td><td>${f(r.linearity, 4)} · ${f(r.pctLinearity, 1)}%</td></tr><tr><td>Average of the absolute biases</td><td>${f(r.avgBias, 4)}</td></tr></tbody></table></div>${svgScatter(st, r)}
        <h4 class="rt">Conclusion</h4><p>The gauge is acceptable when the slope and the intercept are not significantly different from zero (p above 0.05). ${r.ok ? "Here they are not: <b>no significant linearity or bias</b>." : "Here at least one is: the <b>bias changes across the range</b> — correct or restrict the range of use."}</p>${foot}`;
    }
    if (t === "stability") {
      const r = A.res, lab = r.X.map((_, i) => String(i + 1)), fl = {}; r.sig.forEach((s) => (fl[s.i] = 1));
      return `${head}${dec}<div class="kpis">${kp(r.X.length, "checks")}${kp(f(r.ch.grand, d + 1), "average" + unit)}${kp(f(r.ch.sigma, d + 2), "σ from the moving range")}${r.ref != null ? kp(f(r.ch.grand - r.ref, d + 2), "average minus master") : ""}</div>
        <h4 class="rt">Stability — control chart of the master readings</h4>${svgMulti("Master readings over time (individuals chart)", [{ name: "Reading", c: COL[0], vals: r.X, flag: fl }], lab, { d: d + 2, hlines: [{ v: r.ch.lim[0].x.ucl, c: "#dc2626", t: "UCL", dash: 1 }, { v: r.ch.grand, c: "#16a34a", t: "CL" }, { v: r.ch.lim[0].x.lcl, c: "#dc2626", t: "LCL", dash: 1 }].concat(r.ref != null ? [{ v: r.ref, c: "#2563eb", t: "master", dash: 1 }] : []) })}
        <h4 class="rt">Conclusion</h4><p>${r.sig.length ? "Signals: " + [...new Set(r.sig.map((s) => "check " + (s.i + 1) + " — " + s.text))].join("; ") + ". The gauge is drifting or was disturbed; find the cause before relying on it." : "No signals: the gauge reads the master consistently over time. The measurement system is <b>stable</b>."}</p>${foot}`;
    }
    const r = A.res, ap = st.config.appraisers || [], dd = (st.data.d || []).map((a) => a.map((p) => p.map(Number))), lb = st.config.labels || ["Reject", "Accept"];
    const cross = (i, j) => { const c = [[0, 0], [0, 0]]; for (let p = 0; p < dd[i].length; p++) for (let k = 0; k < dd[i][p].length; k++) c[dd[i][p][k]][dd[j][p][k]]++; return c; };
    return `${head}${dec}<div class="kpis">${kp(r.hasRef ? f(r.effectiveness, 0) + "%" : "—", "effectiveness (right calls)")}${kp(r.miss == null ? "—" : f(r.miss, 1) + "%", "miss rate (bad part passed)")}${kp(r.falseAlarm == null ? "—" : f(r.falseAlarm, 1) + "%", "false-alarm rate (good part rejected)")}${kp(f(r.allAgree, 0) + "%", "parts all appraisers agree on")}</div>
      <h4 class="rt">Agreement of each appraiser</h4><div class="sc"><table class="tb2"><thead><tr><th>Appraiser</th><th>Agrees with self</th>${r.hasRef ? "<th>Effectiveness</th><th>Miss rate</th><th>False alarm</th><th>Kappa vs reference</th>" : ""}</tr></thead><tbody>${r.within.map((w, i) => `<tr><td>${esc(ap[i] || "A" + (i + 1))}</td><td>${f(w, 0)}%</td>${r.hasRef ? `<td>${f(r.vsRef[i].effectiveness, 0)}%</td><td>${r.vsRef[i].miss == null ? "—" : f(r.vsRef[i].miss, 0) + "%"}</td><td>${r.vsRef[i].falseAlarm == null ? "—" : f(r.vsRef[i].falseAlarm, 0) + "%"}</td><td>${f(r.kappaRef[i], 2)}</td>` : ""}</tr>`).join("")}</tbody></table></div>
      <h4 class="rt">Cross-tabulation between appraisers (counts of all checks) and kappa</h4><div class="two">${r.kappaPairs.map((p) => { const c = cross(p.a, p.b); return `<div class="sc"><table class="tb2"><thead><tr><th>${esc(ap[p.a])} ↓ / ${esc(ap[p.b])} →</th><th>${esc(lb[0])}</th><th>${esc(lb[1])}</th></tr></thead><tbody><tr><td>${esc(lb[0])}</td><td>${c[0][0]}</td><td>${c[0][1]}</td></tr><tr><td>${esc(lb[1])}</td><td>${c[1][0]}</td><td>${c[1][1]}</td></tr></tbody></table><p class="mut" style="font-size:12.5px;margin:2px 0 8px">kappa = <b>${f(p.kappa, 2)}</b></p></div>`; }).join("")}</div>
      <h4 class="rt">Conclusion</h4><p>Guide from the manual: effectiveness 90% or more, miss rate 2% or less and false-alarm rate 5% or less is acceptable; 80% / 5% / 10% may be acceptable; below that the measurement system needs improvement. Kappa of 0.75 or more shows good agreement, below 0.40 poor agreement. ${A.decision === "Acceptable" ? "<b>This system is acceptable.</b>" : A.decision === "Conditional" ? "<b>This system may be acceptable</b> — agree it with the customer." : "<b>This system is not acceptable</b> — improve the method, the gauge or the training."}</p>${foot}`;
  }

  /* ================= actions ================= */
  function wireTop() {
    const st = S.st, b = (id, fn) => { const e = $("#" + id); if (e) e.onclick = fn; };
    b("b_print", () => window.print()); b("b_exp", exportJson); b("b_save", () => save(true));
    b("b_fin", async () => { if (!S.an || !S.an.ready) { say("Complete the readings first — a study can be finalised only with a result."); return; } if (!confirm("Finalise this study? It is locked afterwards; only an administrator can reopen it.")) return; if (!(await save(false))) return; try { await call("kmr_msa_finalise", { p_id: st.id, p_final: true }); say("Finalised.", true); goStudy(st.id); } catch (e) { say(e.message); } });
    b("b_reopen", async () => { try { await call("kmr_msa_finalise", { p_id: st.id, p_final: false }); goStudy(st.id); say("Reopened.", true); } catch (e) { say(e.message); } });
    b("b_del", async () => { if (!confirm("Delete this study? This cannot be undone.")) return; try { await call("kmr_msa_delete", { p_id: st.id }); say("Study deleted.", true); setGo("go=list"); route(); } catch (e) { say(e.message); } });
  }
  async function save(show) {
    const st = S.st, A = S.an || analyse(st), res = { headline: A.headline || "" };
    if (A.ready && A.res) { const r = A.res; if (st.type === "grr") Object.assign(res, { pctGRR: r.pctGRR, pctTol: r.pctTol, ndc: r.ndc, method: r.method }); else if (st.type === "bias") Object.assign(res, { bias: r.bias, lo: r.lo, hi: r.hi }); else if (st.type === "linearity") Object.assign(res, { slope: r.slope, intercept: r.intercept, r2: r.r2 }); else if (st.type === "attribute") Object.assign(res, { effectiveness: r.effectiveness, miss: r.miss, falseAlarm: r.falseAlarm }); }
    try {
      const r = await call("kmr_msa_save", { p: { id: st.id, type: st.type, title: st.title, gauge_id: st.gauge_id, gauge_name: st.gauge_name, characteristic: st.characteristic, part_no: st.part_no, part_name: st.part_name, unit: st.unit, lsl: st.lsl, usl: st.usl, study_date: st.study_date, conducted_by: st.conducted_by,
        config: st.config, data: st.data, results: res, decision: A.ready ? A.decision : null, notes: st.notes } });
      S.dirty = false; if (!st.id) { say("Saved.", true); goStudy(r.id); return true; } st.results = r.results; st.decision = r.decision; if (show) say("Saved.", true); return true;
    } catch (e) { say(e.message); return false; }
  }
  window.addEventListener("beforeunload", (e) => { if (S.dirty && S.st && editable() && S.st.id !== undefined) { e.preventDefault(); e.returnValue = ""; } });

  function exportJson() {
    const st = S.st, o = { kmr: "msa-study", version: 2, study: { type: st.type, title: st.title, gauge_id: st.gauge_id, gauge_name: st.gauge_name, characteristic: st.characteristic, part_no: st.part_no, part_name: st.part_name, unit: st.unit, lsl: st.lsl, usl: st.usl, study_date: st.study_date, conducted_by: st.conducted_by, config: st.config, data: st.data, notes: st.notes } };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = (st.no + "-" + (st.title || st.type)).replace(/[^\w.-]+/g, "_") + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importJson(e) {
    const file = e.target.files[0]; if (!file) return;
    try { const o = JSON.parse(await file.text()); if (o.kmr !== "msa-study" || !o.study) throw new Error("This is not an MSA Studies export."); const r = await call("kmr_msa_save", { p: Object.assign({}, o.study, { id: null }) }); say("Imported. Open it and press Save study to calculate and store the result.", true); goStudy(r.id); } catch (er) { say(er.message); } e.target.value = "";
  }

  async function drawDash() {
    const d = await call("kmr_msa_dashboard"), el = $("#dash"), bd = d.by_decision || {}, bt = d.by_type || {};
    const list = (a) => (a && a.length ? a.map((s) => `<div class="t" data-open="${s.id}"><div class="tb"><div class="tt">${esc(s.no)} · ${esc(s.title || TYPES[s.type][0])}</div><div class="tm"><span>${esc(TYPES[s.type][0])}</span><span>${fmt(s.study_date)}</span>${chip(s.decision)}<span>${esc((s.results && s.results.headline) || "")}</span></div></div></div>`).join("") : '<div class="empty">Nothing here.</div>');
    el.innerHTML = `<div class="kpis"><div class="kpi"><b>${d.total}</b><span>studies</span></div><div class="kpi" style="--c:var(--g)"><b>${bd.Acceptable || 0}</b><span>acceptable</span></div><div class="kpi" style="--c:var(--a)"><b>${bd.Conditional || 0}</b><span>conditional</span></div><div class="kpi" style="--c:var(--r)"><b>${bd["Not acceptable"] || 0}</b><span>not acceptable</span></div><div class="kpi" style="--c:#94a3b8"><b>${d.draft}</b><span>still draft</span></div></div>
      <div class="two"><div class="card"><h3>Not acceptable — needs action</h3>${list(d.attention)}</div><div class="card"><h3>Latest studies</h3>${list(d.recent)}</div></div><div class="card"><h3>By type</h3>${Object.keys(TYPES).map((k) => `<span class="pillw" style="margin-right:6px">${esc(TYPES[k][0])}: <b>${bt[k] || 0}</b></span>`).join("")}</div>`;
    el.querySelectorAll("[data-open]").forEach((r) => (r.onclick = () => goStudy(r.dataset.open)));
  }

  (async () => { try { await QP.init("msa"); if (!QP.ctx) return; await route(); } catch (e) { say(e.message); } })();
})();
