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
  function reportHtml(st, A) {
    const t = st.type, d = Math.min(5, Math.max(3, ...[st.lsl, st.usl].map((v) => (v == null ? 0 : (String(v).split(".")[1] || "").length))) + 1);
    if (window.KMRReport) KMRReport.set({ key: t, doc: st.no || "" });
    const x = { d, co: (QP.ctx && QP.ctx.company) || "", ri: window.KMRReport ? KMRReport.info() : null, TYPES, M, C };
    const isA = A.res && A.res.method === "anova";
    const tog = t === "grr" && A.ready ? `<div class="seg noprint"><button data-meth="anova" class="${isA ? "on" : ""}"${A.anova && !A.anova.error ? "" : " disabled"}>ANOVA method</button><button data-meth="range" class="${!isA ? "on" : ""}">Average &amp; range method</button></div>` : "";
    return tog + AIAGForm.msa(st, A, x);
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
