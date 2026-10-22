/* QMS Learning Guide - screens: Standards alignment, Start here, Manual (clause by clause), Coverage analysis.
   The content is in qms-*.js (written in plain words, not the published text). Learning progress is kept in this browser only. Every page carries the watermark "Educational Purpose Only". */
(function () {
  "use strict";
  const { $, esc, say } = QP, A = window.AIAGForm, QM = window.QMS;
  const APPS = { sales: "Sales Flow", calibration: "Calibration Hub", apqp: "APQP Planner", ppap: "PPAP", rmp: "Raw Material & Packing", mmd: "Machines, Moulds & Dies", mnt: "Maintenance", msa: "MSA Studies", crm: "CRM & RFQ", d8: "8D Problem Solving", spc: "SPC Charts", tsk: "ActionTrack", hrms: "HRM & Payroll", mom: "Minutes of Meetings", cad: "CAD", capacity: "Capacity Planner", pd: "Process Documents", balloon: "Balloon Inspector", ops: "Operations" };
  const HINT = { calib: "calibration", hrm: "hrms" };
  const appName = (k) => APPS[HINT[k] || k] || k;
  const FW = { iso: "ISO", iatf: "IATF" };
  const COMING = [["vda", "VDA 6.3", "Process audit"], ["cp", "AIAG Control Plan", "Control Plan manual"], ["core", "Core tools", "APQP, PPAP, FMEA, MSA, SPC"]];
  const S = { std: "iso", ch: "all", q: "", cov: null };
  const nat = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  const hashParts = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const go = (h) => { setGo(h); route(); window.scrollTo(0, 0); };
  const hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const nl = (s) => esc(s).replace(/\n/g, "<br>");
  const clauses = (k) => QM.STD[k].clauses.slice().sort((a, b) => nat(a.c, b.c));
  const chapOf = (c) => c.c.split(".")[0];

  /* ---------- progress (this browser only) ---------- */
  const KEY = "kmr-qms-learned";
  const learned = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const setLearned = (id, on) => { try { const o = learned(); if (on) o[id] = 1; else delete o[id]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage blocked */ } };

  /* ---------- coverage: compared with the Standards alignment lists of all KMR apps ---------- */
  function coverage() {
    if (S.cov) return S.cov; const out = {};
    Object.keys(FW).forEach((sk) => {
      const rows = []; KMRStd.keys().forEach((app) => KMRStd.rows(app).forEach((r) => { if (r[0] === FW[sk]) rows.push({ app, clause: String(r[1]), text: r[3] }); }));
      out[sk] = clauses(sk).map((c) => {
        const ex = rows.filter((r) => r.clause === c.c), rel = rows.filter((r) => r.clause !== c.c && (r.clause.startsWith(c.c + ".") || c.c.startsWith(r.clause + ".")));
        const ea = [...new Set(ex.map((r) => r.app))], ra = [...new Set(rel.map((r) => r.app))].filter((a) => !ea.includes(a));
        return { c, status: ea.length ? "full" : ra.length ? "part" : "gap", apps: ea, related: ra };
      });
    });
    return (S.cov = out);
  }
  const CV = { full: ["Covered", "full"], part: ["Partly", "part"], gap: ["Not yet", "gap"] };
  const cvChip = (s) => `<span class="cv ${CV[s][1]}">${CV[s][0]}</span>`;

  /* ---------- printed forms (standard report frame + the watermark) ---------- */
  const st = document.createElement("style");
  st.textContent = "#doc{position:fixed;inset:0;z-index:9500;background:var(--bg);overflow:auto;padding:10px}#doc .bar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}@media print{#doc{position:static;padding:0;overflow:visible;background:#fff}#doc .bar{display:none!important}}";
  document.head.append(st);
  function showDoc(html) {
    closeDoc(); const d = document.createElement("div"); d.id = "doc";
    d.innerHTML = `<div class="bar noprint"><button class="btn" id="doc_p">Print / save as PDF</button><button class="btn o" id="doc_x">Close</button></div>${html}`; document.body.append(d); document.body.classList.add("pv");
    $("#doc_p").onclick = () => window.print(); $("#doc_x").onclick = closeDoc;
  }
  function closeDoc() { const d = $("#doc"); if (d) d.remove(); document.body.classList.remove("pv"); }
  const set = (key, doc) => { if (window.KMRReport) KMRReport.set({ key, doc: doc || "", inForm: true }); };
  const list = (a) => (a && a.length ? "<ul>" + a.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "—");
  function clauseTable(sk, c) {
    return `<div class="blk"><div class="sec">${esc(QM.STD[sk].name)} · ${esc(c.c)} · ${esc(c.t)}</div><table><colgroup><col style="width:22%"><col style="width:78%"></colgroup><tbody>
      <tr><th>Requirement in plain words</th><td>${esc(c.r)}</td></tr><tr><th>What it means</th><td>${esc(c.m)}</td></tr><tr><th>How to implement</th><td><ol>${c.h.map((x) => "<li>" + esc(x) + "</li>").join("")}</ol></td></tr>
      <tr><th>Documents to maintain</th><td>${list(c.d)}</td></tr><tr><th>Records to keep</th><td>${list(c.e)}</td></tr><tr><th>Sample example</th><td>${nl(c.x)}</td></tr><tr><th>Where it comes from</th><td>${esc(c.f)}</td></tr></tbody></table></div>`;
  }
  function docManual(sk, list2, label) {
    set("manual", QM.STD[sk].name + (label ? " " + label : "")); const s = QM.STD[sk];
    return A.wrap("port", A.title(esc(s.name.toUpperCase()) + " - LEARNING MANUAL", esc(s.title)) + A.head([[["Standard", esc(s.name)], ["Part", esc(label || "All clauses")], ["Clauses", String(list2.length)]]]) +
      `<div class="note" style="color:#000">Educational purpose only. The requirements are written in plain words and are not the published text. Read them beside your licensed copy of the standard.</div>` + list2.map((c) => clauseTable(sk, c)).join(""));
  }
  function docCover() {
    set("coverage", ""); const cv = coverage();
    const tbl = (sk) => `<div class="sec">${esc(QM.STD[sk].name)}</div><table><colgroup><col style="width:9%"><col style="width:36%"><col style="width:10%"><col style="width:45%"></colgroup><thead><tr><th>Clause</th><th>Title</th><th class="c">Status</th><th>KMR apps / where to build</th></tr></thead><tbody>${cv[sk].map((x) => `<tr><td>${esc(x.c.c)}</td><td>${esc(x.c.t)}</td><td class="c">${CV[x.status][0]}</td><td>${x.status === "gap" ? "Build in: " + esc(appName(x.c.a)) : esc(x.apps.concat(x.related).map(appName).join(", "))}</td></tr>`).join("")}</tbody></table>`;
    return A.wrap("port", A.title("STANDARDS COVERAGE ANALYSIS", "Which clauses the KMR apps already cover, and what is left") + A.head([[["Standards", "ISO 9001, IATF 16949"], ["Clauses", String(cv.iso.length + cv.iatf.length)], ["Not yet covered", String([...cv.iso, ...cv.iatf].filter((x) => x.status === "gap").length)]]]) + tbl("iso") + tbl("iatf"));
  }

  /* ================= router ================= */
  const SECS = ["std", "start", "manual", "cover"];
  async function route() {
    closeDoc(); const hp = hashParts(); const g = SECS.includes(hp.go) ? hp.go : "std";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === g)); SECS.forEach((s) => $("#" + s).classList.toggle("hide", s !== g)); say("");
    if (g === "std") KMRStd.draw($("#std"), "qms"); else if (g === "start") drawStart(); else if (g === "manual") drawManual(hp); else drawCover();
  }
  window.addEventListener("hashchange", route);

  /* ================= Start here ================= */
  function drawStart() {
    const GL = [["Quality management system (QMS)", "All the rules, people, documents and checks a company uses to make sure customers get good products every time."], ["Clause", "A numbered paragraph of a standard, for example 7.5.3. This guide explains one clause at a time."], ["Document", "Something that says how to do a job: a procedure, work instruction, policy, drawing, plan. It is kept up to date."], ["Record", "Proof that something was done: a filled check sheet, a calibration certificate, meeting minutes. It is kept, not changed."], ["Nonconformity", "Something that does not meet a requirement: a bad part, a missed check, a late delivery."], ["Root cause", "The real reason a problem happened. Fixing only the symptom lets it come back."], ["Corrective action", "What you do to remove the root cause so the problem does not happen again."], ["Audit", "A planned, impartial check of whether the company follows its own rules and the standard."], ["Control plan", "A table that lists every step of a process, what is checked, how often, with which gauge, and what to do if it is wrong."], ["FMEA", "A team exercise to find what can go wrong in a design or process, how bad it would be, and what to do about it before it happens."], ["APQP / PPAP", "APQP is the plan for launching a new part. PPAP is the proof package that the process can make it correctly every time."], ["MSA", "A check that the measuring system itself can be trusted before you judge parts with it."], ["SPC", "Charts of measurements over time that show whether a process is steady or drifting."], ["Special characteristic", "A feature that matters most for safety, fit or function, so it gets extra control."]];
    $("#start").innerHTML = `<div class="pg3"><div class="guide">New to quality standards? Follow the four steps below. Each clause in the Manual has the same layout, so after the first few it feels familiar.</div>
      <div class="step3"><b>1</b><div><h3 style="margin:0">Read the words in this list once</h3><span class="mut">The glossary below uses plain words only.</span></div></div>
      <div class="step3"><b>2</b><div><h3 style="margin:0">Start with ISO 9001, chapters 4 to 10, in order</h3><span class="mut">Each chapter builds on the last. Tick "I understood this" as you go; your progress is saved in this browser.</span> <button class="btn s" id="s_go">Open ISO 9001</button></div></div>
      <div class="step3"><b>3</b><div><h3 style="margin:0">Then read IATF 16949</h3><span class="mut">It adds extra rules for the automotive industry on top of ISO 9001. Each IATF clause points back to the ISO clause it extends.</span> <button class="btn s o" id="s_go2">Open IATF 16949</button></div></div>
      <div class="step3"><b>4</b><div><h3 style="margin:0">Check what your company already has</h3><span class="mut">The Coverage analysis shows which clauses the KMR apps already help with and which are still missing.</span> <button class="btn s o" id="s_go3">Open coverage analysis</button></div></div>
      <div class="bx q"><h4>How to read a clause</h4><p><b>Requirement</b> says what is asked. <b>What it means</b> explains it. <b>How to implement</b> gives the steps. <b>Documents</b> and <b>Records</b> tell you what to write and what to keep. <b>Sample example</b> shows a filled-in example you can copy and adapt.</p></div>
      <div class="bx"><h4>Important</h4><p>This guide is for learning only (see the watermark). The requirements are explained in plain words and are not the published text of the standards. Always read the exact wording in your licensed copy, and follow what your customer and your certification body require.</p></div>
      <h3>Plain-word glossary</h3><dl class="gl">${GL.map((g) => `<dt>${esc(g[0])}</dt><dd>${esc(g[1])}</dd>`).join("")}</dl></div>`;
    $("#s_go").onclick = () => { S.std = "iso"; S.ch = "all"; go("go=manual"); }; $("#s_go2").onclick = () => { S.std = "iatf"; S.ch = "all"; go("go=manual"); }; $("#s_go3").onclick = () => go("go=cover");
  }

  /* ================= Manual ================= */
  function drawManual(hp) {
    const el = $("#manual"), sk = QM.STD[hp.s] ? hp.s : S.std; S.std = sk; const s = QM.STD[sk];
    if (hp.c) return drawClause(el, sk, hp.c);
    const L = learned(), all = clauses(sk), cv = coverage()[sk], q = S.q.toLowerCase();
    const match = (c) => (S.ch === "all" || chapOf(c) === S.ch) && (!q || (c.c + " " + c.t + " " + c.r + " " + c.m + " " + c.x).toLowerCase().includes(q));
    const shown = all.filter(match), done = all.filter((c) => L[sk + c.c]).length;
    el.innerHTML = `<div class="stds">${Object.keys(QM.STD).map((k) => `<button data-std="${k}" class="${k === sk ? "on" : ""}" style="--c:${QM.STD[k].color}">${esc(QM.STD[k].name)}<small>${all.length && k === sk ? all.length + " clauses" : QM.STD[k].clauses.length + " clauses"}</small></button>`).join("")}${COMING.map((x) => `<button disabled title="Coming in the next release">${esc(x[1])}<small>${esc(x[2])} · coming next</small></button>`).join("")}</div>
      <div class="guide"><b>${esc(s.name)}</b> · ${esc(s.title)}. ${esc(s.what)}</div>
      <div class="row"><div class="grow"><input id="m_q" placeholder="Search a clause number or a word, for example 7.5 or calibration…" value="${esc(S.q)}"></div><span class="mut">${done} of ${all.length} understood</span><button class="btn o s" id="m_pr">Print these ${shown.length} clauses</button></div>
      <div class="chs"><button data-ch="all" class="${S.ch === "all" ? "on" : ""}">All chapters</button>${s.chapters.map((c) => `<button data-ch="${c.no}" class="${S.ch === c.no ? "on" : ""}">${c.no} · ${esc(c.title)}</button>`).join("")}</div>
      ${S.ch !== "all" ? `<div class="bx q"><p>${esc((s.chapters.find((c) => c.no === S.ch) || {}).intro || "")}</p></div>` : ""}
      ${shown.map((c) => { const x = cv.find((y) => y.c === c); return `<div class="cl2" data-c="${esc(c.c)}" style="--c:${s.color}"><span class="no">${esc(c.c)}</span><div style="flex:1;min-width:0"><div class="tt">${esc(c.t)}</div><small>${esc(c.r.length > 150 ? c.r.slice(0, 150) + "…" : c.r)}</small></div><div style="text-align:right">${L[sk + c.c] ? '<span class="chip g">understood</span>' : ""}<div style="margin-top:4px">${cvChip(x.status)}</div></div></div>`; }).join("") || '<div class="empty">No clause matches.</div>'}`;
    el.querySelectorAll("[data-std]").forEach((b) => (b.onclick = () => { S.std = b.dataset.std; S.ch = "all"; S.q = ""; drawManual({}); }));
    el.querySelectorAll("[data-ch]").forEach((b) => (b.onclick = () => { S.ch = b.dataset.ch; drawManual({}); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => go("go=manual&s=" + sk + "&c=" + b.dataset.c)));
    $("#m_q").oninput = (e) => { S.q = e.target.value; const p = e.target.selectionStart; drawManual({}); const n = $("#m_q"); n.focus(); n.setSelectionRange(p, p); };
    $("#m_pr").onclick = () => showDoc(docManual(sk, shown, S.ch === "all" ? (q ? "search: " + S.q : "") : "Chapter " + S.ch));
  }
  function drawClause(el, sk, cno) {
    const all = clauses(sk), i = all.findIndex((c) => c.c === cno); if (i < 0) { go("go=manual&s=" + sk); return; }
    const c = all[i], s = QM.STD[sk], L = learned(), x = coverage()[sk].find((y) => y.c === c), id = sk + c.c;
    el.innerHTML = `<div class="pg3"><div class="row noprint"><button class="btn o s" id="c_back">← ${esc(s.name)}</button><span class="mut" style="flex:1">Chapter ${esc(chapOf(c))} · ${esc((s.chapters.find((h) => h.no === chapOf(c)) || {}).title || "")}</span><button class="btn o s" id="c_pr">Print this clause</button></div>
      <h2 style="margin:6px 0"><span style="color:${s.color}">${esc(c.c)}</span> ${esc(c.t)}</h2>
      <div class="bx q"><h4>The requirement, in plain words</h4><p>${esc(c.r)}</p><p class="mut" style="font-size:12px;margin-top:6px">Written in simple words for learning. It is not the published text: read the exact wording in your licensed copy of ${esc(s.name)}.</p></div>
      <div class="bx"><h4>What it means</h4><p>${esc(c.m)}</p></div>
      <div class="bx"><h4>How to implement</h4><ol>${c.h.map((h) => "<li>" + esc(h) + "</li>").join("")}</ol></div>
      <div class="two2"><div class="bx"><h4>Documents to maintain</h4>${list(c.d)}<p class="mut" style="font-size:12px;margin-top:6px">A document says how to do things. Keep it up to date.</p></div><div class="bx"><h4>Records to keep</h4>${list(c.e)}<p class="mut" style="font-size:12px;margin-top:6px">A record is proof that it was done. Keep it, do not change it.</p></div></div>
      <div class="bx ex"><h4>Sample example</h4><pre>${esc(c.x)}</pre></div>
      <div class="bx"><h4>Where it comes from</h4><p>${esc(c.f)}</p></div>
      <div class="bx"><h4>In the KMR apps</h4><p>${cvChip(x.status)} ${x.status === "gap" ? "Not yet covered. It would live in <b>" + esc(appName(c.a)) + "</b>." : "Covered by: " + esc(x.apps.concat(x.related).map(appName).join(", "))}</p></div>
      <label class="cl noprint"><input type="checkbox" id="c_ok"${L[id] ? " checked" : ""}> <span><b>I understood this clause</b></span></label>
      <div class="nav2 noprint"><button class="btn o" id="c_prev"${i ? "" : " disabled"}>← ${i ? esc(all[i - 1].c) : ""}</button><button class="btn" id="c_next"${i < all.length - 1 ? "" : " disabled"}>${i < all.length - 1 ? esc(all[i + 1].c) : ""} →</button></div></div>`;
    $("#c_back").onclick = () => go("go=manual&s=" + sk); $("#c_pr").onclick = () => showDoc(docManual(sk, [c], "Clause " + c.c));
    $("#c_ok").onchange = (e) => setLearned(id, e.target.checked);
    if (i) $("#c_prev").onclick = () => go("go=manual&s=" + sk + "&c=" + all[i - 1].c); if (i < all.length - 1) $("#c_next").onclick = () => go("go=manual&s=" + sk + "&c=" + all[i + 1].c);
  }

  /* ================= Coverage analysis ================= */
  function drawCover() {
    const el = $("#cover"); if (!hasF("qms.coverage-analysis")) { el.innerHTML = '<div class="lock">🔒 The coverage analysis is not part of your plan. <button class="btn o s" id="v_lk">Find out more</button></div>'; $("#v_lk").onclick = () => window.KMRLock && KMRLock.need("qms.coverage-analysis"); return; }
    const cv = coverage(), tot = (a) => ({ full: a.filter((x) => x.status === "full").length, part: a.filter((x) => x.status === "part").length, gap: a.filter((x) => x.status === "gap").length });
    const bar = (t) => { const n = t.full + t.part + t.gap; return `<div class="pbar" title="${t.full} covered, ${t.part} partly, ${t.gap} not yet"><i style="width:${(t.full / n) * 100}%;background:var(--g)"></i><i style="width:${(t.part / n) * 100}%;background:var(--a)"></i><i style="width:${(t.gap / n) * 100}%;background:var(--r)"></i></div>`; };
    const gapsByApp = {}; Object.keys(cv).forEach((sk) => cv[sk].filter((x) => x.status === "gap").forEach((x) => { const a = appName(x.c.a || "mom"); (gapsByApp[a] = gapsByApp[a] || []).push({ sk, x }); }));
    el.innerHTML = `<div class="guide">This compares each clause with the Standards alignment lists of all KMR apps. <b>Covered</b>: an app has a feature written against exactly this clause. <b>Partly</b>: only a related clause is covered. <b>Not yet</b>: no app covers it. Many clauses are about people, documents and management decisions, so the suggested app is where it would be recorded.</div>
      <div class="row"><button class="btn o s" id="v_pr">Print the analysis</button></div>
      <div class="two">${Object.keys(cv).map((sk) => { const t = tot(cv[sk]); return `<div class="card"><h3>${esc(QM.STD[sk].name)}</h3>${bar(t)}<p style="margin:8px 0 0"><span class="cv full">${t.full} covered</span> <span class="cv part">${t.part} partly</span> <span class="cv gap">${t.gap} not yet</span></p></div>`; }).join("")}</div>
      <h3>What is still missing, by app</h3><div class="mut" style="margin-bottom:8px">Where each missing clause would best be built.</div>
      ${Object.entries(gapsByApp).sort((a, b) => b[1].length - a[1].length).map(([app, l]) => `<details class="card"><summary style="cursor:pointer"><b>${esc(app)}</b> · ${l.length} clause${l.length > 1 ? "s" : ""}</summary><div style="margin-top:8px">${l.map((g) => `<div class="cm" data-open="${g.sk}|${esc(g.x.c.c)}" style="cursor:pointer"><b style="color:${QM.STD[g.sk].color}">${esc(QM.STD[g.sk].name.split(":")[0])} ${esc(g.x.c.c)}</b> · ${esc(g.x.c.t)}</div>`).join("")}</div></details>`).join("") || '<div class="empty">Every clause has an app.</div>'}
      <h3 style="margin-top:16px">Clause by clause</h3>${Object.keys(cv).map((sk) => `<div class="card"><h3>${esc(QM.STD[sk].name)}</h3><div class="sc"><table class="tb2" style="min-width:520px"><thead><tr><th>Clause</th><th>Title</th><th>Status</th><th>Apps</th></tr></thead><tbody>${cv[sk].map((x) => `<tr data-open="${sk}|${esc(x.c.c)}" style="cursor:pointer"><td><b>${esc(x.c.c)}</b></td><td>${esc(x.c.t)}</td><td>${cvChip(x.status)}</td><td>${x.status === "gap" ? '<span class="mut">build in ' + esc(appName(x.c.a)) + "</span>" : esc(x.apps.concat(x.related).map(appName).join(", "))}</td></tr>`).join("")}</tbody></table></div></div>`).join("")}`;
    el.querySelectorAll("[data-open]").forEach((e) => (e.onclick = () => { const [sk, c] = e.dataset.open.split("|"); go("go=manual&s=" + sk + "&c=" + c); }));
    $("#v_pr").onclick = () => showDoc(docCover());
  }

  window.QMSApp = { S, coverage, showDoc, docManual, docCover };
  async function start() {
    try { await QP.init("qms"); if (!QP.ctx) return; $("#role").textContent = (QP.ctx && QP.ctx.role) || ""; await route(); } catch (e) { say(e.message); }
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
