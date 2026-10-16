/* KMR CAD Draft — page: Standards alignment, Dashboard, Drawings register (number, revision, status, history)
   and the editor. Data calls are kmr_cad_* (database) or cad-demo.js (?demo=1). */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, K = window.KCAD;
  const S = { list: null, cur: null, E: null, autosaveT: 0 };
  const ST = { draft: "Draft", review: "In review", released: "Released", superseded: "Superseded", obsolete: "Obsolete" };
  const chip = (s) => `<span class="chip st-${esc(s)}">${esc(ST[s] || s)}</span>`;
  const ed = () => QP.canEdit, admin = () => QP.ctx && QP.ctx.role === "admin";
  const open = (h) => { $("#mb").innerHTML = h; $("#m").classList.add("on"); }, closeM = () => $("#m").classList.remove("on");
  $("#m").addEventListener("click", (e) => { if (e.target.id === "m") closeM(); });
  const when = (t) => (t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const hashGo = () => (location.hash.match(/go=([a-z]+)/) || [])[1] || "std";
  const hashId = () => (location.hash.match(/[&?]id=([0-9a-zA-Z-]+)/) || [])[1] || "";
  const go = (h) => { location.hash = h; };

  /* ---------- top offset for the full-height editor ---------- */
  const fit = () => { const el = $("#edsec"); if (el.classList.contains("hide")) return; const r = el.getBoundingClientRect(); document.documentElement.style.setProperty("--top", Math.max(0, r.top + window.scrollY) + "px"); };
  window.addEventListener("resize", fit); new ResizeObserver(fit).observe(document.body);

  /* ================= router ================= */
  async function route() {
    const g = hashGo();
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === g));
    ["std", "dash", "list"].forEach((s) => $("#" + s).classList.toggle("hide", s !== g));
    $("#edsec").classList.toggle("hide", g !== "ed" && g !== "stage");
    document.body.classList.toggle("fs", (g === "ed" || g === "stage") && pref("fs") !== "0"); if (g === "ed" || g === "stage") { const b = document.querySelector(".cx-fsb[data-fs]"); if (b) b.querySelector("span").textContent = isFs() ? "Exit full screen" : "Full screen"; }
    document.body.style.paddingBottom = (g === "ed" || g === "stage") && !isFs() ? "32px" : "";
    try {
      if (g === "std") return KMRStd.draw($("#std"), "cad", { evidence: evidence() });
      if (g === "ed") { fit(); await openEditor(hashId()); return; }
      // from Process Documents: make the stage drawings of this project (#go=stage&pd=<project>)
      if (g === "stage") { const pd = (location.hash.match(/[&?]pd=([0-9a-zA-Z-]+)/) || [])[1] || ""; history.replaceState(null, "", location.pathname + location.search + "#go=ed"); fit(); await openEditor(""); const E = S.E; if (!ed()) { E.err("You have view-only access, so you cannot make stage drawings."); return; } setTimeout(() => E.run("STAGEDWG", pd ? { pd } : undefined), 120); return; }
      await loadList();
      if (g === "dash") drawDash(); else drawList();
    } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);
  const loadList = async () => { S.list = (await call("kmr_cad_list")) || []; };
  const evidence = () => { const L = S.list || []; return { reg: () => L.length + " drawings in the register", rel: () => L.filter((d) => d.status === "released").length + " released", rev: () => L.filter((d) => d.status === "superseded").length + " superseded revisions kept" }; };

  /* ================= dashboard ================= */
  function drawDash() {
    const L = S.list.filter((d) => d.status !== "superseded"), by = (k) => L.filter((d) => d.status === k).length, month = new Date().toISOString().slice(0, 7);
    const recent = L.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 8);
    const cust = {}; L.forEach((d) => { const c = d.customer || "No customer"; cust[c] = (cust[c] || 0) + 1; });
    const cmax = Math.max(1, ...Object.values(cust)), months = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const mcount = months.map((m) => L.filter((d) => String(d.updated_at).slice(0, 7) === m).length), mmax = Math.max(1, ...mcount);
    $("#dash").innerHTML = `<div class="row"><h2 style="margin:0;font-size:18px" class="grow">Drawing dashboard</h2>${ed() ? '<button class="btn" id="dnew">+ New drawing</button>' : ""}<a class="btn o" href="#go=list">Open the register</a></div>
      <div class="kpis"><div class="kpi"><b>${new Set(L.map((d) => d.number)).size}</b><span>Drawings (numbers)</span></div><div class="kpi" style="--c:var(--g)"><b>${by("released")}</b><span>Released</span></div><div class="kpi" style="--c:var(--a)"><b>${by("review")}</b><span>In review</span></div><div class="kpi" style="--c:#64748b"><b>${by("draft")}</b><span>Draft</span></div><div class="kpi" style="--c:#94a3b8"><b>${S.list.length - L.length}</b><span>Superseded revisions kept</span></div><div class="kpi" style="--c:var(--b2)"><b>${L.filter((d) => String(d.updated_at).slice(0, 7) === month).length}</b><span>Changed this month</span></div></div>
      ${L.length ? `<div class="frm" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px"><div><h3>Recently changed</h3><table style="min-width:0"><tbody>${recent.map((d) => `<tr><td><img class="thumb" src="${d.thumb || ""}" alt="" loading="lazy"></td><td><b>${esc(d.number)}</b> rev ${esc(d.rev)}<br>${esc(d.title)}<br><span class="mut">${when(d.updated_at)}</span></td><td>${chip(d.status)}</td><td><a class="btn s o" href="#go=ed&id=${d.id}">Open</a></td></tr>`).join("")}</tbody></table></div>
      <div><h3>Activity (drawings changed per month)</h3><div class="bars">${months.map((m, i) => `<div class="bl"><span>${new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span><i style="width:${(100 * mcount[i]) / mmax}%"></i><b>${mcount[i]}</b></div>`).join("")}</div>
      <h3>By customer</h3><div class="bars">${Object.entries(cust).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `<div class="bl"><span>${esc(c)}</span><i style="width:${(100 * n) / cmax}%"></i><b>${n}</b></div>`).join("")}</div></div></div>` : `<div class="empty">No drawings yet. ${ed() ? "Create a new drawing or import a DXF from AutoCAD to start." : ""}</div>`}`;
    const b = $("#dnew"); if (b) b.onclick = newDlg;
  }

  /* ================= register ================= */
  function drawList() {
    const q = (S.q || "").toLowerCase(), fs = S.fs || "";
    const L = S.list.filter((d) => (fs ? d.status === fs : d.status !== "superseded") && (!q || [d.number, d.title, d.part_no, d.customer, d.rev].join(" ").toLowerCase().includes(q)));
    $("#list").innerHTML = `<div class="row"><input class="grow" id="lq" placeholder="Search number, title, part, customer" value="${esc(S.q || "")}"><select id="lf" style="width:auto"><option value="">Current (all but superseded)</option>${Object.entries(ST).map(([k, v]) => `<option value="${k}"${k === fs ? " selected" : ""}>${v}</option>`).join("")}</select>
      ${ed() ? '<button class="btn" id="lnew">+ New drawing</button><button class="btn o" id="limp" title="DXF, DWG, PDF or a picture of a drawing">Import DXF / PDF / picture</button>' : ""}<button class="btn o" id="lpub" title="Tick drawings below, then print all their sheets at once">Print ticked drawings</button>${admin() ? '<button class="btn o" id="lexp">Export all (JSON)</button><button class="btn o" id="lrest">Restore JSON</button>' : ""}</div>
      ${L.length ? `<div class="cards">${L.map((d) => `<div class="dcard"><a href="#go=ed&id=${d.id}"><img src="${d.thumb || ""}" alt="" loading="lazy"></a><div><b>${esc(d.number)} · rev ${esc(d.rev)}</b>${esc(d.title)}<br><span class="mut">${esc([d.part_no, d.customer].filter(Boolean).join(" · ") || "—")}</span><br>${chip(d.status)} ${d.sample ? '<span class="chip" style="background:#7c3aed">sample</span>' : ""} <span class="mut" style="font-size:12px">${when(d.updated_at)}${d.updated_by ? " · " + esc(d.updated_by) : ""}</span></div>
        <div class="acts"><label class="note" style="margin:0;display:flex;gap:4px;align-items:center"><input type="checkbox" data-pick="${d.id}" style="width:auto"${(S.pick || new Set()).has(d.id) ? " checked" : ""}>tick</label><a class="btn s" href="#go=ed&id=${d.id}">Open</a><button class="btn s o" data-info="${d.id}">Details</button>${ed() ? `<button class="btn s o" data-flow="${d.id}">Status</button>` : ""}</div></div>`).join("")}</div>` : `<div class="empty">${S.list.length ? "No drawing matches the filter." : "No drawings yet."}</div>`}
      <p class="note">Each drawing has a number, a revision and a status. A released drawing is locked; to change it make a new revision — the earlier revision is kept as superseded (document control, ISO 9001 7.5.3 / IATF 16949 7.5.3.2.2).</p>`;
    const lq = $("#lq"); lq.oninput = () => { S.q = lq.value; drawList(); const i = $("#lq"); i.focus(); i.selectionStart = i.value.length; };
    $("#lf").onchange = (e) => { S.fs = e.target.value; drawList(); };
    if ($("#lnew")) $("#lnew").onclick = newDlg;
    if ($("#limp")) $("#limp").onclick = importDxf;
    if ($("#lexp")) $("#lexp").onclick = exportAll;
    S.pick = S.pick || new Set(); document.querySelectorAll("[data-pick]").forEach((c) => (c.onchange = () => { if (c.checked) S.pick.add(c.dataset.pick); else S.pick.delete(c.dataset.pick); }));
    $("#lpub").onclick = publishMany;
    if ($("#lrest")) $("#lrest").onclick = restoreAll;
    document.querySelectorAll("[data-info]").forEach((b) => (b.onclick = () => infoDlg(b.dataset.info)));
    document.querySelectorAll("[data-flow]").forEach((b) => (b.onclick = () => flowDlg(b.dataset.flow)));
  }
  const field = (id, label, v, ph) => `<label>${label}<input id="${id}" value="${esc(v || "")}" placeholder="${esc(ph || "")}"></label>`;
  function newDlg(pre) {
    pre = pre && pre.doc ? pre : null;
    open(`<h3>${pre ? "Import drawing" : "New drawing"}</h3><div class="frm">${field("nn", "Drawing number", "", "Blank = next number")}${field("nt", "Title", pre ? pre.name : "", "e.g. Drive flange")}${field("nr", "Revision", "A")}${field("np", "Part number", "")}${field("nc", "Customer", "")}
      <label>Units<select id="nu">${["mm", "cm", "m", "in", "ft"].map((u) => `<option${u === ((pre && pre.doc.units) || "mm") ? " selected" : ""}>${u}</option>`).join("")}</select></label>${pre ? "" : `<label>Start with<select id="ns"><option value="">Blank sheet</option><option value="A4">A4 sheet with title block</option><option value="A3" selected>A3 sheet with title block</option><option value="A2">A2 sheet with title block</option></select></label>`}</div>
      <label class="note">Notes<textarea id="no" rows="2"></textarea></label><div id="nmsg"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn o" id="nx">Cancel</button><button class="btn" id="nok">Create</button></div>`);
    $("#nx").onclick = closeM;
    $("#nok").onclick = async () => {
      const v = (id) => ($("#" + id) ? $("#" + id).value.trim() : "");
      if (!v("nt")) { $("#nmsg").innerHTML = '<div class="msg">Enter a title.</div>'; return; }
      const doc = pre ? pre.doc : K.newDoc(); doc.units = v("nu") || "mm";
      try {
        const r = await call("kmr_cad_save", { p: { number: v("nn"), title: v("nt"), rev: v("nr") || "A", part_no: v("np"), customer: v("nc"), notes: v("no"), units: doc.units, data: doc, ents: doc.ents.length, thumb: thumbOf(doc) } });
        closeM(); S.newSheet = !pre && v("ns") ? v("ns") : ""; go("go=ed&id=" + r.id); say("Drawing " + r.number + " created.", true);
      } catch (e) { $("#nmsg").innerHTML = `<div class="msg">${esc(e.message)}</div>`; }
    };
  }
  async function importDxf() {
    const f = await K.pickFile(".dxf,.json"); if (!f) return;
    try { say(/\.(pdf|png|jpe?g|webp|bmp)$/i.test(f.name) ? "Converting the file to CAD — this can take a minute…" : "Reading the file…", true); const r = await K.readDrawingFile(f, (t) => say(t, true)); newDlg(r); const w = Object.keys(r.warn || {}); if (r.converted) say([r.note].concat(r.notes || []).join(" "), true); else if (w.length) say("Some DXF objects are not supported and will be skipped: " + w.join(", ")); }
    catch (e) { say(e.message); }
  }
  async function infoDlg(id) {
    const d = await call("kmr_cad_get", { p_id: id }), H = d.history || [];
    open(`<h3>${esc(d.number)} · rev ${esc(d.rev)} ${chip(d.status)}</h3><div class="frm">${field("in", "Title", d.title)}${field("ip", "Part number", d.part_no)}${field("ic", "Customer", d.customer)}${field("ir", "Revision", d.rev)}</div><label class="note">Notes<textarea id="io" rows="2">${esc(d.notes || "")}</textarea></label>
      <h4>Revision history</h4><div class="hist">${H.length ? H.slice().reverse().map((h) => `<div><b>${esc(h.rev || "")}</b> · ${esc(ST[h.status] || h.status || "")} · ${when(h.at)} · ${esc(h.by || "")}${h.note ? "<br>" + esc(h.note) : ""}</div>`).join("") : '<span class="mut">No history yet.</span>'}</div>
      <div id="imsg"></div><div class="row" style="justify-content:flex-end;margin-top:10px">${admin() && d.status !== "released" ? '<button class="btn r" id="idel">Delete</button>' : ""}<span style="flex:1"></span><button class="btn o" id="ix">Close</button>${ed() && d.status !== "released" && d.status !== "superseded" ? '<button class="btn" id="iok">Save details</button>' : ""}</div>`);
    $("#ix").onclick = closeM;
    if ($("#iok")) $("#iok").onclick = async () => { try { await call("kmr_cad_save", { p: { id, title: $("#in").value.trim(), part_no: $("#ip").value.trim(), customer: $("#ic").value.trim(), rev: $("#ir").value.trim() || d.rev, notes: $("#io").value } }); closeM(); route(); } catch (e) { $("#imsg").innerHTML = `<div class="msg">${esc(e.message)}</div>`; } };
    if ($("#idel")) $("#idel").onclick = async () => { if (!confirm(`Delete drawing ${d.number} rev ${d.rev}? This cannot be undone.`)) return; try { await call("kmr_cad_delete", { p_id: id }); closeM(); say("Drawing deleted.", true); route(); } catch (e) { $("#imsg").innerHTML = `<div class="msg">${esc(e.message)}</div>`; } };
  }
  async function flowDlg(id) {
    const d = (S.list || []).find((x) => x.id === id) || (await call("kmr_cad_get", { p_id: id }));
    const next = { draft: [["review", "Send for review"], ["released", "Release"]], review: [["released", "Release"], ["draft", "Back to draft"]], released: [["revise", "Make a new revision"], ["obsolete", "Mark obsolete"]], superseded: [], obsolete: [["draft", "Re-open as draft"]] }[d.status] || [];
    open(`<h3>${esc(d.number)} · rev ${esc(d.rev)} ${chip(d.status)}</h3>${next.length ? `<p class="note">Choose the next step. Release locks the drawing (administrator). A new revision copies it as rev ${esc(nextRev(d.rev))} (draft); this revision stays released until the new one is released, then it becomes superseded.</p><label class="note">Change / approval note<textarea id="fn" rows="2" placeholder="What changed and why (shown in the revision history)"></textarea></label><div class="row">${next.map(([k, l]) => `<button class="btn${k === "obsolete" ? " r" : k === "draft" ? " o" : ""}" data-to="${k}">${l}</button>`).join("")}</div>` : `<p class="note">A superseded revision is kept for the record and cannot change. Open the latest revision instead.</p>`}<div id="fmsg"></div><div class="row" style="justify-content:flex-end"><button class="btn o" id="fx">Close</button></div>`);
    $("#fx").onclick = closeM;
    document.querySelectorAll("[data-to]").forEach((b) => (b.onclick = async () => {
      const note = $("#fn").value.trim();
      try {
        if (b.dataset.to === "revise") { if (!note) throw new Error("Write the change note for the new revision."); const r = await call("kmr_cad_revise", { p_id: id, p_note: note, p_rev: nextRev(d.rev) }); closeM(); say(`Revision ${r.rev} created as a draft. Rev ${d.rev} stays released until rev ${r.rev} is released.`, true); go("go=ed&id=" + r.id); return; }
        await call("kmr_cad_status", { p_id: id, p_status: b.dataset.to, p_note: note }); closeM(); say("Status changed to " + ST[b.dataset.to] + ".", true);
        if (S.cur && S.cur.id === id) { S.cur = null; } route();
      } catch (e) { $("#fmsg").innerHTML = `<div class="msg">${esc(e.message)}</div>`; }
    }));
  }
  const nextRev = (r) => { r = String(r || "A").trim(); if (/^\d+$/.test(r)) return String(+r + 1).padStart(r.length, "0"); if (/^[A-Z]$/i.test(r)) { const c = r.toUpperCase(); return c === "Z" ? "AA" : String.fromCharCode(c.charCodeAt(0) + 1).replace(/[IO]/, (x) => String.fromCharCode(x.charCodeAt(0) + 1)); } const m = r.match(/^(.*?)(\d+)$/); return m ? m[1] + (+m[2] + 1) : r + "1"; };
  async function publishMany() {
    const ids = Array.from(S.pick || []); if (!ids.length) return say("Tick the drawings to print first.");
    try {
      const pages = [];
      for (const id of ids) {
        const d = await call("kmr_cad_get", { p_id: id }), doc = Object.assign(K.newDoc(false), d.data || {}); doc.layouts = doc.layouts || [];
        if (doc.layouts.length) for (const l of doc.layouts) pages.push(K.layoutSVG(doc, doc.ents || [], l));
        else { const W = 420, H = 297, b = K.extents(doc, doc.ents || []); if (!b) continue; const m = 8, k = Math.min((W - 2 * m) / Math.max(1e-9, b.x1 - b.x0), (H - 2 * m) / Math.max(1e-9, b.y1 - b.y0)), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; pages.push({ W, H, svg: K.toSVG(doc, { box: { x0: cx - W / 2 / k, x1: cx + W / 2 / k, y0: cy - H / 2 / k, y1: cy + H / 2 / k }, widthMm: W, heightMm: H, k, mono: true, plot: true, bg: "#fff" }) }); }
      }
      if (!pages.length) return say("The ticked drawings are empty.");
      K.printPages(null, pages, "Drawings " + new Date().toISOString().slice(0, 10)); say(pages.length + " sheet(s) sent to the print dialog — choose Save as PDF for one PDF.", true);
    } catch (e) { say(e.message); }
  }
  async function exportAll() {
    try { const rows = []; for (const d of S.list) rows.push(await call("kmr_cad_get", { p_id: d.id })); K.download("kmr-cad-drawings-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ app: "cad", exported_at: new Date().toISOString(), drawings: rows }, null, 1), "application/json"); say(rows.length + " drawing(s) exported.", true); }
    catch (e) { say(e.message); }
  }
  async function restoreAll() {
    const f = await K.pickFile(".json"); if (!f) return;
    try { const j = JSON.parse(await f.text()); const rows = j.drawings || []; if (!rows.length) throw new Error("No drawings in this file."); if (!confirm(`Restore ${rows.length} drawing(s)? Drawings with the same number and revision are updated, the others are added.`)) return; let n = 0; for (const d of rows) { await call("kmr_cad_save", { p: { restore: true, number: d.number, title: d.title, rev: d.rev, part_no: d.part_no, customer: d.customer, notes: d.notes, units: d.units, data: d.data, ents: d.ents, thumb: d.thumb, status: d.status, history: d.history } }); n++; } say(n + " drawing(s) restored.", true); route(); }
    catch (e) { say(e.message); }
  }

  /* ================= thumbnail (small PNG) ================= */
  function thumbOf(doc) {
    try {
      const b = K.extents(doc), W = 360, H = 240, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
      if (b) { const w = Math.max(b.x1 - b.x0, 1e-6), h = Math.max(b.y1 - b.y0, 1e-6), s = Math.min(W / w, H / h) * 0.9; const P = K.canvasPainter(x, { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, s, W, H }, { fg: "#000", light: true, ltscale: doc.ltscale }); let n = 0; for (const e of doc.ents) { if (++n > 6000) break; K.paint(P, e, doc); } }
      return c.toDataURL("image/png");
    } catch (e) { return null; }
  }

  /* ================= editor ================= */
  function editor() {
    if (S.E) return S.E;
    const E = K.Editor($("#ed"), {
      onChange: () => { clearTimeout(S.autosaveT); S.autosaveT = setTimeout(draftSave, 1500); },
      onSave: (E2, asNew) => save(asNew),
      onNew: () => { if (ed()) newDlg(); },
      onOpen: () => { go("go=list"); return true; },
      onOpenFile: (E2, r) => newDlg(r),
      listDrawings: async () => { await loadList(); return S.list; },
      getDrawing: (id) => call("kmr_cad_get", { p_id: id }),
      onInfo: (E2, inf) => { if (S.cur && inf.title && !S.cur.title) S.cur.title = inf.title; },
    });
    S.E = E; chrome(E); return E;
  }
  /* full-screen workspace: header, tabs and footer hide while editing; side panel and ribbon can be folded away */
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem("kcad-" + k); localStorage.setItem("kcad-" + k, v); } catch (e) { /* private mode */ } return null; };
  const cxRoot = () => { const e = $("#ed"); return e.classList.contains("cx") ? e : e.querySelector(".cx"); };
  const isFs = () => document.body.classList.contains("fs");
  function setFs(on, native) {
    document.body.classList.toggle("fs", !!on); pref("fs", on ? "1" : "0");
    try { if (native && on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* not allowed */ }
    const b = document.querySelector(".cx-fsb[data-fs]"); if (b) b.querySelector("span").textContent = on ? "Exit full screen" : "Full screen";
    setTimeout(() => { fit(); window.dispatchEvent(new Event("resize")); }, 60);
  }
  function chrome(E) {
    const root = cxRoot(), qa = root.querySelector(".cx-qa"), help = qa.querySelector(".cx-help"); if (!qa || !help) return;
    const mk = (cls, t, title, fn) => { const b = document.createElement("button"); b.className = "cx-fsb"; b.title = title; b.innerHTML = "<span>" + t + "</span>"; b.onclick = fn; if (cls) b.setAttribute(cls, ""); qa.insertBefore(b, help); return b; };
    mk("", "Register", "Back to the drawings register", () => { if (E.dirty && !E.readOnly && !confirm("This drawing has changes that are not saved. Leave it? (A local draft is kept on this device.)")) return; go("go=list"); });
    mk("data-fs", "Exit full screen", "Show or hide the page header (F11 for the whole browser)", () => setFs(!isFs(), !isFs()));
    mk("", "Ribbon", "Fold the ribbon away to get more drawing space", () => { root.classList.toggle("cx-rcol"); pref("rcol", root.classList.contains("cx-rcol") ? "1" : "0"); setTimeout(() => window.dispatchEvent(new Event("resize")), 30); });
    root.querySelector(".cx-rtabs").addEventListener("click", () => { if (root.classList.contains("cx-rcol")) { root.classList.remove("cx-rcol"); pref("rcol", "0"); setTimeout(() => window.dispatchEvent(new Event("resize")), 30); } }, true);
    if (pref("rcol") === "1") root.classList.add("cx-rcol");
    if (window.innerWidth > 820 && pref("side") !== "1") root.classList.add("cx-noside");
    root.addEventListener("click", (ev) => { const a = ev.target.closest("[data-act=side]"); if (a) setTimeout(() => pref("side", root.classList.contains("cx-noside") ? "0" : "1"), 0); });
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && S.fsNative) S.fsNative = false; });
  }
  const draftKey = (id) => "kcad-draft-" + (QP.slug || "demo") + "-" + id;
  function draftSave() { const E = S.E; if (!E || !S.cur || !E.dirty || E.readOnly) return; try { localStorage.setItem(draftKey(S.cur.id), JSON.stringify({ at: new Date().toISOString(), base: S.cur.updated_at, data: E.data() })); } catch (e) { /* storage full */ } }
  async function openEditor(id) {
    const E = editor(); setTimeout(() => { const r = cxRoot(); if (r && !S.sideSet) { S.sideSet = 1; if (window.innerWidth > 820 && pref("side") !== "1") { r.classList.add("cx-noside"); window.dispatchEvent(new Event("resize")); } } }, 300);
    if (!id) {
      if (S.cur) { setBar(); setTimeout(() => E.focus(), 50); return; }
      if (E._stage && E.doc.info && E.doc.info.stage && K.stageBar) { K.stageBar(E); E.readOnly = null; setTimeout(() => E.focus(), 50); return; }
      $("#edbar").classList.remove("hide"); $("#edbar").className = "edbar"; $("#edbar").innerHTML = `No drawing is open. <a href="#go=list">Open one from the register</a>${ed() ? ' or <a href="#" id="ednew">create a new drawing</a>' : ""}. You can try every tool here — this scratch sheet is not saved.`;
      const n = $("#ednew"); if (n) n.onclick = (ev) => { ev.preventDefault(); newDlg(); };
      if (!E._scratch) { E.load(K.newDoc(), { title: "Scratch sheet (not saved)" }); E._scratch = true; } E.readOnly = null; return;
    }
    if (S.cur && S.cur.id === id) { setBar(); return; }
    if (S.cur && E.dirty && !E.readOnly) { if (!confirm("The open drawing has changes that are not saved. Leave it? (A local draft is kept on this device.)")) { history.replaceState(null, "", "#go=ed&id=" + S.cur.id); return; } }
    const d = await call("kmr_cad_get", { p_id: id }); S.cur = d; E._scratch = false; E._stage = null;
    E.load(d.data || K.newDoc(), { title: d.title, number: d.number, rev: d.rev, part: d.part_no, company: QP.ctx && QP.ctx.company });
    E.readOnly = d.status === "released" || d.status === "superseded" || d.status === "obsolete" || !ed() ? (!ed() ? "You have view-only access to drawings." : `Drawing ${d.number} rev ${d.rev} is ${ST[d.status].toLowerCase()} and locked. Make a new revision to change it (Drawings → Status).`) : null;
    setBar();
    // a local draft newer than the saved copy?
    try { const dr = JSON.parse(localStorage.getItem(draftKey(id)) || "null"); if (dr && !E.readOnly && dr.base === d.updated_at && dr.data) { if (confirm(`There are unsaved changes to ${d.number} on this device from ${when(dr.at)}. Restore them?`)) { E.load(dr.data, E.info); E.readOnly = null; E.dirty = true; E.changed(); } else localStorage.removeItem(draftKey(id)); } } catch (e) { /* ignore */ }
    if (K.reloadXrefs) K.reloadXrefs(E, true).catch((er) => E.err(er.message));
    if (S.newSheet) { const sz = S.newSheet; S.newSheet = ""; setTimeout(() => { E.mem = E.mem || {}; E.mem.tb = Object.assign({}, E.mem.tb || {}, { sheet: sz, co: QP.ctx && QP.ctx.company }); E.run("TITLEBLOCK"); }, 200); }
    setTimeout(() => E.focus(), 50);
  }
  function setBar() {
    const d = S.cur, E = S.E, bar = $("#edbar"); if (!d) return;
    bar.className = "edbar" + (E.readOnly ? " ro" : ""); bar.classList.remove("hide");
    bar.innerHTML = `<b>${esc(d.number)} · rev ${esc(d.rev)}</b> ${chip(d.status)} <span>${esc(d.title)}</span><span style="flex:1"></span>${E.readOnly ? `<span>🔒 ${esc(E.readOnly)}</span>` : `<span class="mut">Ctrl+S saves · a local draft is kept every few seconds</span><button class="btn s" id="bsave">Save</button>`}${E.doc.info && E.doc.info.stage ? '<button class="btn s o" id="bstg" title="Draw these stage sheets again as pictures and send them to the SOP in Process Documents">Send to SOP</button>' : ""}${ed() ? `<button class="btn s o" id="bflow">Status / revision</button>` : ""}<a class="btn s o" href="#go=list">Register</a>`;
    if ($("#bsave")) $("#bsave").onclick = () => save(false);
    if ($("#bstg")) $("#bstg").onclick = () => E.run("STAGESEND");
    if ($("#bflow")) $("#bflow").onclick = async () => { if (E.dirty && !E.readOnly) await save(false); flowDlg(d.id); };
    fit();
  }
  async function save(asNew) {
    const E = S.E; if (!E) return;
    if (!S.cur || asNew) { if (!ed()) return E.err("You have view-only access."); const doc = E.data(); newDlg({ doc, name: (E.info && E.info.title) || "Copy" }); return; }
    if (E.readOnly) return E.err(E.readOnly);
    try {
      const doc = E.data(), r = await call("kmr_cad_save", { p: { id: S.cur.id, data: doc, units: doc.units, ents: doc.ents.length, thumb: thumbOf(doc) } });
      S.cur.updated_at = r.updated_at; E.markSaved(); E.msg(`Saved ${S.cur.number} rev ${S.cur.rev}.`, "ok");
      try { localStorage.removeItem(draftKey(S.cur.id)); } catch (e) { /* ignore */ }
    } catch (e) { E.err("Not saved: " + e.message); }
  }
  window.addEventListener("beforeunload", (ev) => { if (S.E && S.E.dirty && S.cur && !S.E.readOnly) { draftSave(); ev.preventDefault(); ev.returnValue = ""; } else if (S.E && S.E._stage && S.E.dirty) { ev.preventDefault(); ev.returnValue = ""; } });

  /* ================= start ================= */
  (async () => {
    try { await QP.init("cad"); if (!QP.ctx) return; await loadList().catch(() => {}); route(); }
    catch (e) { $("#co").textContent = ""; say(e.message); }
  })();
  window.KCADShell = S;
})();
