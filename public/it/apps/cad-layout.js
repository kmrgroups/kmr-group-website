/* KMR CAD Draft — layouts (paper space) and plotting: sheets with scaled viewports, model space through a viewport,
   annotation scale and annotative objects, plot styles, no-plot layers, print a sheet and publish many sheets as one PDF. */
(function (K) {
  "use strict";
  const G = K.geom, cmd = K.cmd, esc = K.esc, isP = Array.isArray;
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };
  const SCALES = [["1:1", 1], ["1:2", 0.5], ["1:5", 0.2], ["1:10", 0.1], ["1:20", 0.05], ["1:50", 0.02], ["1:100", 0.01], ["1:200", 0.005], ["1:500", 0.002], ["2:1", 2], ["5:1", 5], ["10:1", 10]];
  const umm = (doc) => K.UNITMM[doc.units] || 1;
  const scName = (doc, sc) => { const r = sc / umm(doc); const s = SCALES.find((x) => Math.abs(x[1] - r) < 1e-9); return s ? s[0] : r >= 1 ? K.fmt(r, 3) + ":1" : "1:" + K.fmt(1 / r, 3); };
  const paperWH = (l) => { const s = K.PAPER[l.paper] || K.PAPER.A3; return l.orient === "portrait" ? [Math.min(...s), Math.max(...s)] : [Math.max(...s), Math.min(...s)]; };
  K.paperWH = paperWH;

  /* ---------- viewport entity (lives in a layout, paper mm) ---------- */
  const rectOf = (e) => ({ x0: Math.min(e.p0[0], e.p1[0]), y0: Math.min(e.p0[1], e.p1[1]), x1: Math.max(e.p0[0], e.p1[0]), y1: Math.max(e.p0[1], e.p1[1]) });
  K.EXT.vport = {
    geom(e) { const r = rectOf(e); return [{ t: "pline", closed: true, pts: [[r.x0, r.y0, 0], [r.x1, r.y0, 0], [r.x1, r.y1, 0], [r.x0, r.y1, 0]] }]; },
    grips(e) { const r = rectOf(e); return [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]; },
    gripMove(e, i, q) { const r = rectOf(e), c = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], opp = c[(i + 2) % 4]; return Object.assign({}, e, { p0: opp, p1: q }); },
    xform(e, m, d, n) { n.p0 = K.M.ap(m, e.p0); n.p1 = K.M.ap(m, e.p1); return n; },
  };
  K.typeNameExt = Object.assign(K.typeNameExt || {}, { vport: "Viewport" });

  /* ---------- the view of a viewport's content on screen, from the paper view ---------- */
  const vpView = (vp, pv) => {
    const r = rectOf(vp), cpx = (r.x0 + r.x1) / 2, cpy = (r.y0 + r.y1) / 2, s = pv.s * vp.sc;
    const Sx = (cpx - pv.cx) * pv.s + pv.W / 2, Sy = pv.H / 2 - (cpy - pv.cy) * pv.s;
    return { cx: vp.cx - (Sx - pv.W / 2) / s, cy: vp.cy + (Sy - pv.H / 2) / s, s, W: pv.W, H: pv.H };
  };
  const fitScale = (doc, ents, r) => {
    const b = K.extents(doc, ents); if (!b) return { sc: umm(doc), cx: 0, cy: 0 };
    const w = Math.max(b.x1 - b.x0, 1e-6), h = Math.max(b.y1 - b.y0, 1e-6), fit = Math.min((r.x1 - r.x0) / w, (r.y1 - r.y0) / h) * 0.92 / umm(doc);
    const std = SCALES.map((x) => x[1]).filter((v) => v <= fit + 1e-12).sort((a, b) => b - a)[0] || fit;
    return { sc: std * umm(doc), cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
  };

  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    E.space = { lay: null, ms: null }; E._views = {};
    const doc = () => E.doc;
    const lay = (id) => (doc().layouts || []).find((l) => l.id === id);
    const modelEnts = () => (doc()._active === "model" ? doc().ents : doc().modelEnts || []);
    const paperEnts = (l) => (doc()._active === l.id ? doc().ents : l.ents || []);
    E.modelEnts = modelEnts; E.layoutOf = lay;
    const modelAnno = () => (doc().annoScale || 1) / umm(doc());
    const setAnno = () => { K.view.anno = E.space.ms ? 1 / (activeVp() || { sc: 1 }).sc : E.space.lay ? 1 : modelAnno(); };
    const activeVp = () => { if (!E.space.ms) return null; const l = lay(E.space.lay); return l && paperEnts(l).find((e) => e.id === E.space.ms); };
    E.activeVp = activeVp;
    E.fitVp = () => { const vp = activeVp(); if (!vp || vp.lock) return; Object.assign(vp, fitScale(doc(), modelEnts(), rectOf(vp))); Object.assign(E.view, vpView(vp, Object.assign({}, E.pview, { W: E.view.W, H: E.view.H }))); E.dirty = true; renderTabs(); E.redraw(); };

    /* ---------- switching between Model, a layout (paper) and model space through a viewport ---------- */
    E.setSpace = (layId, msId) => {
      if (E.busy()) E.cancel();
      const d = doc(), old = E.space, oldKey = old.lay && !old.ms ? old.lay : old.ms ? null : "model";
      if (d._active === "model") d.modelEnts = d.ents; else { const l = lay(d._active); if (l) l.ents = d.ents; }
      if (oldKey) E._views[oldKey] = { cx: E.view.cx, cy: E.view.cy, s: E.view.s };
      const pv = old.lay && !old.ms ? Object.assign({}, E.view) : old.ms ? E.pview : null;
      E.space = { lay: layId || null, ms: msId || null };
      if (layId && !msId) { d.ents = lay(layId).ents || []; d._active = layId; } else { d.ents = d.modelEnts || []; d._active = "model"; }
      E.reindex(); E.sel = [];
      if (msId) { E.pview = pv && old.lay === layId ? pv : Object.assign({}, E.view, E._views[layId] || {}); Object.assign(E.view, vpView(activeVp(), Object.assign({}, E.pview, { W: E.view.W, H: E.view.H }))); }
      else { const v = E._views[layId || "model"]; if (v) Object.assign(E.view, v); else if (layId) { const [W, H] = paperWH(lay(layId)); E.view.s = Math.min(E.view.W / W, E.view.H / H) * 0.9; E.view.cx = W / 2; E.view.cy = H / 2; } else E.zoomExt(); }
      setAnno(); renderTabs(); E.redraw(); E.refreshSide(); E.refreshLayerBox();
      E.msg(msId ? "Model space through the viewport — double-click outside it (or PSPACE) to go back to the sheet." : layId ? `Sheet "${lay(layId).name}" (paper space, mm).` : "Model space.", "mu");
    };
    E.onSpaceRestore = (act) => { E.space = { lay: act === "model" ? null : act, ms: null }; setTimeout(() => { setAnno(); renderTabs(); E.redraw(); }, 0); };
    E.onLoad = () => { E.space = { lay: null, ms: null }; E._views = {}; setAnno(); setTimeout(renderTabs, 0); };

    /* ---------- layout tabs + annotation scale in the status bar ---------- */
    const renderTabs = () => {
      const el = E.$(".cx-spaces"); if (!el) return; const L = doc().layouts || [];
      el.innerHTML = `<button data-sp="model" class="${!E.space.lay ? "on" : ""}">Model</button>${L.map((l) => `<button data-sp="${l.id}" class="${E.space.lay === l.id ? "on" : ""}" title="Double-click: page setup">${esc(l.name)}</button>`).join("")}<button data-sp="+" title="New sheet (layout)">＋</button>`
        + (!E.space.lay || E.space.ms ? `<select class="cx-anno" title="Annotation scale for annotative text and dimensions">${SCALES.map(([n, v]) => `<option value="${v}"${Math.abs((E.space.ms ? (activeVp() || {}).sc / umm(doc()) : 1 / (doc().annoScale || 1)) - v) < 1e-9 ? " selected" : ""}>${n}</option>`).join("")}</select><button data-anno class="${E.set.annoNew ? "on" : ""}" title="New text, leaders and frames are annotative (their size follows the annotation / viewport scale)">Anno</button>` : "");
    };
    E.renderTabs = renderTabs;
    E.root.addEventListener("click", (ev) => {
      const b = ev.target.closest(".cx-spaces button"); if (!b) return;
      if (b.hasAttribute("data-anno")) { E.set.annoNew = !E.set.annoNew; renderTabs(); E.msg(`<Annotative ${E.set.annoNew ? "on" : "off"} for new text>`, "mu"); return; }
      const sp = b.dataset.sp; if (sp === "+") return E.run("LAYOUT", { act: "new" });
      if (sp === "model") { if (E.space.lay || E.space.ms) E.setSpace(null); return; }
      if (E.space.lay !== sp || E.space.ms) E.setSpace(sp);
    });
    E.root.addEventListener("dblclick", (ev) => { const b = ev.target.closest(".cx-spaces button[data-sp]"); if (b && !["model", "+"].includes(b.dataset.sp)) E.run("PAGESETUP", { id: b.dataset.sp }); });
    E.root.addEventListener("change", (ev) => {
      if (!ev.target.classList.contains("cx-anno")) return; const v = +ev.target.value;
      if (E.space.ms) { const vp = activeVp(); if (vp && !vp.lock) { vp.sc = v * umm(doc()); Object.assign(E.view, vpView(vp, Object.assign({}, E.pview, { W: E.view.W, H: E.view.H }))); E.dirty = true; } }
      else E.tx("annotation scale", () => { doc().annoScale = 1 / v; });
      setAnno(); E.redraw(); renderTabs();
    });

    /* ---------- drawing a sheet ---------- */
    E.baseHook = (ctx) => {
      setAnno();
      if (!E.space.lay) return false;
      const l = lay(E.space.lay); if (!l) { E.space = { lay: null, ms: null }; return false; }
      const pv = E.space.ms ? Object.assign({}, E.pview, { W: E.view.W, H: E.view.H }) : E.view, V = E.view, [W, H] = paperWH(l);
      if (E.space.ms) { const vp = activeVp(); if (vp) { if (vp.lock) Object.assign(E.view, vpView(vp, pv)); else { const r = rectOf(vp), cpx = (r.x0 + r.x1) / 2, cpy = (r.y0 + r.y1) / 2, Sx = (cpx - pv.cx) * pv.s + pv.W / 2, Sy = pv.H / 2 - (cpy - pv.cy) * pv.s; vp.sc = V.s / pv.s; vp.cx = V.cx + (Sx - V.W / 2) / V.s; vp.cy = V.cy - (Sy - V.H / 2) / V.s; } } }
      const X = (p) => [(p[0] - pv.cx) * pv.s + pv.W / 2, pv.H / 2 - (p[1] - pv.cy) * pv.s];
      ctx.fillStyle = E.set.light ? "#c7ced8" : "#3a4350"; ctx.fillRect(0, 0, V.W, V.H);
      const a = X([0, H]), b = X([W, 0]);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(a[0] + 5, a[1] + 5, b[0] - a[0], b[1] - a[1]); ctx.fillStyle = "#fff"; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      const m0 = X([5, H - 5]), m1 = X([W - 5, 5]); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#b8c2cf"; ctx.lineWidth = 1; ctx.strokeRect(m0[0], m0[1], m1[0] - m0[0], m1[1] - m0[1]); ctx.setLineDash([]);
      const PP = K.canvasPainter(ctx, pv, { fg: "#000", light: true, lwt: E.set.lwt, ltscale: 1 }), ME = modelEnts(), d = doc();
      for (const e of paperEnts(l)) {
        if (e.t !== "vport") { if (E.space.ms) ctx.globalAlpha = 0.55; K.view.anno = 1; K.paint(PP, e, d); ctx.globalAlpha = 1; continue; }
        const r = rectOf(e), s0 = X([r.x0, r.y1]), s1 = X([r.x1, r.y0]);
        ctx.save(); ctx.beginPath(); ctx.rect(s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]); ctx.clip();
        const vv = vpView(e, pv), P2 = K.canvasPainter(ctx, vv, { fg: "#000", light: true, lwt: E.set.lwt, ltscale: d.ltscale }), fr = new Set(e.frozen || []), w0 = [vv.cx - vv.W / 2 / vv.s, vv.cy - vv.H / 2 / vv.s], w1 = [vv.cx + vv.W / 2 / vv.s, vv.cy + vv.H / 2 / vv.s];
        K.view.anno = 1 / e.sc;
        for (const m of ME) { if (fr.has(m.layer)) continue; if (m.t !== "xline") { const bb = K.bbox(m, d); if (bb && (bb.x1 < w0[0] || bb.x0 > w1[0] || bb.y1 < w0[1] || bb.y0 > w1[1])) continue; } K.paint(P2, m, d); }
        ctx.restore();
        const act = E.space.ms === e.id; ctx.setLineDash(act ? [] : [6, 3]); ctx.strokeStyle = act ? "#2563eb" : "#64748b"; ctx.lineWidth = act ? 3 : 1; ctx.strokeRect(s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]); ctx.setLineDash([]);
        if (e.lock) { ctx.fillStyle = "#64748b"; ctx.font = "11px system-ui"; ctx.fillText("🔒 " + scName(d, e.sc), s0[0] + 4, s1[1] - 4); }
      }
      setAnno();
      return true;
    };
    /* double-click inside a viewport: work in model space through it; outside: back to the sheet */
    E.dblHook = (wp) => {
      if (!E.space.lay) return false;
      if (!E.space.ms) { const l = lay(E.space.lay), vp = paperEnts(l).filter((e) => e.t === "vport").reverse().find((e) => { const r = rectOf(e), m = 2 / E.view.s; return wp[0] > r.x0 + m && wp[0] < r.x1 - m && wp[1] > r.y0 + m && wp[1] < r.y1 - m; }); if (vp) { E.setSpace(E.space.lay, vp.id); return true; } return false; }
      const vp = activeVp(); if (!vp) return false; const r = rectOf(vp), cp = [(r.x0 + r.x1) / 2 + (wp[0] - vp.cx) * vp.sc, (r.y0 + r.y1) / 2 + (wp[1] - vp.cy) * vp.sc];
      if (cp[0] < r.x0 || cp[0] > r.x1 || cp[1] < r.y0 || cp[1] > r.y1) { E.setSpace(E.space.lay); return true; }
      return false;
    };
    setAnno();
  });

  /* ---------- properties of a viewport ---------- */
  K.propsHook = (E, el, ents) => {
    if (ents.length !== 1 || ents[0].t !== "vport") return; const v = ents[0], d = E.doc;
    const box = document.createElement("div");
    box.innerHTML = `<h4>Viewport</h4><div class="cx-pg"><label>Scale<select data-vps>${SCALES.map(([n, s]) => `<option value="${s}"${Math.abs(v.sc / umm(d) - s) < 1e-9 ? " selected" : ""}>${n}</option>`).join("")}${SCALES.some(([, s]) => Math.abs(v.sc / umm(d) - s) < 1e-9) ? "" : `<option selected value="${v.sc / umm(d)}">${scName(d, v.sc)}</option>`}</select></label><label>Custom 1 :<input data-vpc type="number" step="any" min="0" value="${K.fmt(umm(d) / v.sc, 4)}"></label>
      <label>View centre X<input data-vpx type="number" step="any" value="${K.fmt(v.cx, 3)}"></label><label>View centre Y<input data-vpy type="number" step="any" value="${K.fmt(v.cy, 3)}"></label><label class="cx-chk"><input data-vpl type="checkbox"${v.lock ? " checked" : ""}> Display locked</label><label><button class="cx-b o" data-vpfit>Fit the model</button></label></div>
      <h4>Layers frozen in this viewport</h4><div class="cx-snaps">${d.layers.map((l) => `<label class="cx-chk"><input data-vpf="${esc(l.name)}" type="checkbox"${(v.frozen || []).includes(l.name) ? " checked" : ""}> ${esc(l.name)}</label>`).join("")}</div>`;
    el.appendChild(box);
    const upd = (fn) => E.tx("viewport", () => { const n = JSON.parse(JSON.stringify(E.byId(v.id))); fn(n); E.replace(v.id, n); });
    box.querySelector("[data-vps]").onchange = (e) => upd((n) => (n.sc = +e.target.value * umm(d)));
    box.querySelector("[data-vpc]").onchange = (e) => { const k = +e.target.value; if (k > 0) upd((n) => (n.sc = umm(d) / k)); };
    box.querySelector("[data-vpx]").onchange = (e) => upd((n) => (n.cx = +e.target.value));
    box.querySelector("[data-vpy]").onchange = (e) => upd((n) => (n.cy = +e.target.value));
    box.querySelector("[data-vpl]").onchange = (e) => upd((n) => (n.lock = e.target.checked || undefined));
    box.querySelector("[data-vpfit]").onclick = () => upd((n) => Object.assign(n, fitScale(d, E.modelEnts(), rectOf(n))));
    box.querySelectorAll("[data-vpf]").forEach((c) => (c.onchange = () => upd((n) => { const s = new Set(n.frozen || []); if (c.checked) s.add(c.dataset.vpf); else s.delete(c.dataset.vpf); n.frozen = Array.from(s); })));
  };

  /* ---------- commands ---------- */
  const vpLayer = (E) => { if (!E.doc.layers.find((l) => l.name === "Viewports")) E.doc.layers = E.doc.layers.concat([{ name: "Viewports", color: "#808080", lt: "CONTINUOUS", lw: 0.13, on: true, frozen: false, lock: false, plot: false }]); return "Viewports"; };
  const pageDlg = (E, l, isNew) => E.dialog(isNew ? "New sheet (layout)" : "Page setup — " + l.name, `<div class="cx-frm"><label>Name<input id="ln" value="${esc(l.name)}"></label><label>Paper<select id="lp">${Object.keys(K.PAPER).map((p) => `<option${p === l.paper ? " selected" : ""}>${p}</option>`).join("")}</select></label><label>Orientation<select id="lo"><option value="landscape">Landscape</option><option value="portrait"${l.orient === "portrait" ? " selected" : ""}>Portrait</option></select></label><label>Plot style<select id="ls"><option value="mono"${l.ps !== "color" && l.ps !== "gray" ? " selected" : ""}>Monochrome (black)</option><option value="gray"${l.ps === "gray" ? " selected" : ""}>Grayscale</option><option value="color"${l.ps === "color" ? " selected" : ""}>Colour as displayed</option></select></label>${isNew ? `<label class="cx-chk"><input id="ltb" type="checkbox" checked> Border and title block</label><label class="cx-chk"><input id="lvp" type="checkbox" checked> One viewport showing the model</label>` : ""}</div>${isNew ? "" : `<div class="cx-pa"><button type="button" class="cx-b o" data-a="del">Remove this sheet</button><button type="button" class="cx-b o" data-a="left">Move left</button></div>`}`,
    (b) => { const n = b.querySelector("#ln").value.trim(); if (!n) throw new Error("Enter a name."); if ((E.doc.layouts || []).some((x) => x !== l && x.name === n)) throw new Error("A sheet with that name exists."); return { name: n, paper: b.querySelector("#lp").value, orient: b.querySelector("#lo").value, ps: b.querySelector("#ls").value, tb: b.querySelector("#ltb") && b.querySelector("#ltb").checked, vp: b.querySelector("#lvp") && b.querySelector("#lvp").checked }; },
    { init: (b) => b.querySelectorAll("[data-a]").forEach((x) => (x.onclick = () => E.closeDlg({ act: x.dataset.a }))) });
  cmd("LAYOUT", { a: ["LO", "NEWSHEET"], d: "Sheets (layouts): new, rename, remove — paper space with scaled viewports", norepeat: true, fn: async (E, args) => {
    if (E.readOnly) return E.err(E.readOnly);
    const d = E.doc, n = (d.layouts || []).length + 1, l = { id: K.uid(), name: "Sheet " + n, paper: "A3", orient: "landscape", ps: "mono", ents: [] };
    const r = await pageDlg(E, l, true); if (!r) return; Object.assign(l, { name: r.name, paper: r.paper, orient: r.orient, ps: r.ps });
    const [W, H] = paperWH(l), tbH = r.tb ? 58 : 0, rect = { x0: 23, y0: 13 + tbH, x1: W - 13, y1: H - 13 };
    E.tx("new sheet", () => {
      if (r.vp) { const L = vpLayer(E); l.ents.push(Object.assign({ id: K.uid(), t: "vport", layer: L, color: null, lt: null, lw: null, p0: [rect.x0, rect.y0], p1: [rect.x1, rect.y1] }, fitScale(d, E.modelEnts(), rect))); }
      d.layouts = (d.layouts || []).concat([l]);
    });
    E.setSpace(l.id);
    if (r.tb) await E.run("TITLEBLOCK", { paper: true, sheet: r.paper, orient: r.orient, base: [0, 0] });
  } });
  cmd("PAGESETUP", { a: ["PAGE"], d: "Page setup of the current sheet: paper, orientation, plot style, name", norepeat: true, fn: async (E, args) => {
    const id = (args && args.id) || E.space.lay; const l = E.layoutOf(id); if (!l) return E.msg("Open a sheet tab first (paper space).");
    const r = await pageDlg(E, l, false); if (!r) return;
    if (r.act === "del") { const ok = await E.dialog("Remove sheet", `<p>Remove sheet <b>${esc(l.name)}</b> and everything drawn on it? The model is not affected.</p>`, () => true, { ok: "Remove" }); if (!ok) return; if (E.space.lay === id) E.setSpace(null); E.tx("remove sheet", () => { E.doc.layouts = E.doc.layouts.filter((x) => x.id !== id); }); E.renderTabs(); return; }
    if (r.act === "left") { const L = E.doc.layouts.slice(), i = L.findIndex((x) => x.id === id); if (i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; E.tx("move sheet", () => { E.doc.layouts = L; }); } E.renderTabs(); return; }
    E.tx("page setup", () => { E.doc.layouts = E.doc.layouts.map((x) => (x.id === id ? Object.assign(x, { name: r.name, paper: r.paper, orient: r.orient, ps: r.ps }) : x)); });
    E.renderTabs(); E.redraw();
  } });
  cmd("MVIEW", { a: ["MV", "VPORTS"], d: "Make a viewport on the sheet (shows the model at a scale)", fn: async (E) => {
    if (!E.space.lay || E.space.ms) return E.msg("Viewports are made on a sheet: click a sheet tab first.");
    const l = E.layoutOf(E.space.lay), [W, H] = paperWH(l);
    const a = await E.getPoint("Specify corner of viewport or [Fit] <Fit>:", { kws: ["Fit"] }); if (a === null && false) return;
    let r;
    if (a == null || a.kw) r = { x0: 20, y0: 10, x1: W - 10, y1: H - 10 };
    else { const b = need(await E.getPoint("Specify opposite corner:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] })); r = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }; }
    if (r.x1 - r.x0 < 1 || r.y1 - r.y0 < 1) return E.err("The viewport is too small.");
    E.tx("viewport", () => { const L = vpLayer(E); E.add(Object.assign({ t: "vport", layer: L, color: null, lt: null, lw: null, p0: [r.x0, r.y0], p1: [r.x1, r.y1] }, fitScale(E.doc, E.modelEnts(), r)), true); });
    E.msg("Viewport made. Select it to set its scale, or double-click inside it to pan / zoom the model.");
  } });
  cmd("MSPACE", { a: ["MS"], d: "Work in model space through a viewport of the sheet", norepeat: true, fn: async (E) => {
    if (!E.space.lay) return E.msg("Already in model space."); if (E.space.ms) return;
    const vps = E.doc.ents.filter((e) => e.t === "vport"); if (!vps.length) return E.err("This sheet has no viewport (MVIEW).");
    let vp = vps[0]; if (vps.length > 1) { const v = need(await E.getEnt("Select the viewport:", { filter: (e) => e.t === "vport", anyLayer: true })); vp = v.e; }
    E.setSpace(E.space.lay, vp.id);
  } });
  cmd("PSPACE", { a: ["PS"], d: "Back to the sheet (paper space) from a viewport", norepeat: true, fn: async (E) => { if (E.space.ms) E.setSpace(E.space.lay); } });
  cmd("MODEL", { a: ["TILEMODE"], d: "Go to the Model tab", norepeat: true, fn: async (E) => { if (E.space.lay) E.setSpace(null); } });
  cmd("VPSCALE", { a: ["VPS"], d: "Set the scale of a viewport", fn: async (E) => {
    const vp = E.space.ms ? E.activeVp() : (need(await E.getEnt("Select the viewport:", { filter: (e) => e.t === "vport", anyLayer: true }))).e;
    const s = await E.getText(`Enter the scale (e.g. 1:2, 5:1, 0.5) <${scName(E.doc, vp.sc)}>:`); if (!s) return;
    const m = String(s).match(/^\s*([\d.]+)\s*[:/]\s*([\d.]+)\s*$/), v = m ? +m[1] / +m[2] : +s; if (!(v > 0)) return E.err("Not a valid scale.");
    if (E.space.ms) { vp.sc = v * umm(E.doc); E.setSpace(E.space.lay, vp.id); E.dirty = true; } else E.tx("viewport scale", () => E.replace(vp.id, Object.assign({}, vp, { sc: v * umm(E.doc) })));
  } });
  cmd("VPLOCK", { a: [], d: "Lock or unlock the display of viewports", fn: async (E) => { const ids = await E.getSel("Select viewports:", { filter: (e) => e.t === "vport" }); if (!ids.length) return; const k = await E.getKw("Viewport display locking [ON/OFF] <ON>:", ["ON", "OFF"], "ON"); const on = !(k && k.kw === "OFF"); E.tx("viewport lock", () => ids.forEach((id) => E.replace(id, Object.assign({}, E.byId(id), { lock: on || undefined })))); } });

  /* ---------- plotting a sheet ---------- */
  K.layoutSVG = (doc, modelEnts, l, o) => {
    o = o || {}; const [W, H] = paperWH(l), ps = o.ps || l.ps || "mono", parts = [], f = (v) => (+v.toFixed(4)).toString();
    let clipN = 0; const old = K.view.anno;
    const paint = (ents, k, filter) => { const P = K.svgPainter({ k, mono: ps === "mono", gray: ps === "gray", ltscale: k === 1 ? 1 : doc.ltscale, tol: 0.15 / k }); for (const e of ents) { if (filter && !filter(e)) continue; if (K.noPlot(doc, e)) continue; K.paint(P, e, doc); } return P.out.join(""); };
    for (const e of l.ents || []) {
      if (e.t !== "vport") { K.view.anno = 1; parts.push(paint([e], 1)); continue; }
      const r = rectOf(e), cpx = (r.x0 + r.x1) / 2, cpy = (r.y0 + r.y1) / 2, id = "vp" + ++clipN, fr = new Set(e.frozen || []);
      K.view.anno = 1 / e.sc;
      parts.push(`<clipPath id="${id}"><rect x="${f(r.x0)}" y="${f(r.y0)}" width="${f(r.x1 - r.x0)}" height="${f(r.y1 - r.y0)}"/></clipPath><g clip-path="url(#${id})"><g transform="matrix(${f(e.sc)} 0 0 ${f(e.sc)} ${f(cpx - e.cx * e.sc)} ${f(cpy - e.cy * e.sc)})">${paint(modelEnts, e.sc, (m) => !fr.has(m.layer))}</g></g>`);
      if (!K.noPlot(doc, e)) { K.view.anno = 1; parts.push(paint([e], 1)); }
    }
    K.view.anno = old;
    return { W, H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/><g transform="matrix(1 0 0 -1 0 ${H})" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</g></svg>` };
  };
  const printPages = (E, pages, title) => {
    const fr = document.createElement("iframe"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.append(fr);
    const css = pages.map((p, i) => `@page p${i}{size:${p.W}mm ${p.H}mm;margin:0}.p${i}{page:p${i}}`).join("");
    const d = fr.contentDocument; d.open(); d.write(`<!doctype html><html><head><title>${esc(title)}</title><style>${css}html,body{margin:0;padding:0}.pg{break-after:page;overflow:hidden}.pg:last-child{break-after:auto}svg{display:block}</style></head><body>${pages.map((p, i) => `<div class="pg p${i}" style="width:${p.W}mm;height:${p.H}mm">${p.svg}</div>`).join("")}</body></html>`); d.close();
    setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000); }, 300);
  };
  K.printPages = printPages;
  const docForPlot = (E) => { const d = E.data(); return d; };
  K.plotLayout = async (E) => {
    const l = E.layoutOf(E.space.lay); const d = docForPlot(E), L = d.layouts.find((x) => x.id === l.id);
    const r = await E.dialog("Print sheet — " + l.name, `<div class="cx-frm"><label>Plot style<select id="ps"><option value="mono"${l.ps === "mono" || !l.ps ? " selected" : ""}>Monochrome</option><option value="gray"${l.ps === "gray" ? " selected" : ""}>Grayscale</option><option value="color"${l.ps === "color" ? " selected" : ""}>Colour as displayed</option></select></label></div><div class="cx-pv" id="pv"></div><p class="cx-note">${esc(l.paper)} ${l.orient}, 1:1 on paper. Layers marked “do not plot” (and the Viewports layer) are left out. Choose your printer or Save as PDF in the browser dialog.</p>`,
      (b) => ({ ps: b.querySelector("#ps").value }), { ok: "Print / Save as PDF", width: "min(820px,96vw)", init: (b) => { const draw = () => { const s = K.layoutSVG(d, d.ents, L, { ps: b.querySelector("#ps").value }); b.querySelector("#pv").innerHTML = s.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="100%" style="aspect-ratio:${s.W}/${s.H};box-shadow:0 2px 10px #0003"`); }; b.querySelector("#ps").onchange = draw; draw(); b.querySelector(".cx-dlg, .cx-db") && b.classList.add("cx-plot"); } });
    if (!r) return; const s = K.layoutSVG(d, d.ents, L, { ps: r.ps }); printPages(E, [s], ((E.info && E.info.number) || "drawing") + " " + l.name);
  };
  cmd("PUBLISH", { a: ["BATCHPLOT"], d: "Print several sheets (and the model) in one go — one multi-page PDF", norepeat: true, fn: async (E) => {
    const d = docForPlot(E), L = d.layouts || [];
    const r = await E.dialog("Publish sheets", `<p class="cx-note">Tick the sheets to print. Each sheet prints on its own paper size; choose Save as PDF in the print dialog to get one multi-page PDF.</p><div class="cx-snaps" style="grid-template-columns:1fr">${L.map((l) => `<label class="cx-chk"><input data-l="${l.id}" type="checkbox" checked> ${esc(l.name)} — ${l.paper} ${l.orient}</label>`).join("")}<label class="cx-chk"><input id="pm" type="checkbox"${L.length ? "" : " checked"}> Model (fitted on</label></div><div class="cx-frm"><label>Model paper<select id="pmp">${Object.keys(K.PAPER).map((p) => `<option${p === "A3" ? " selected" : ""}>${p}</option>`).join("")}</select></label><label>Plot style<select id="pps"><option value="">As each sheet</option><option value="mono">Monochrome</option><option value="gray">Grayscale</option><option value="color">Colour</option></select></label></div>`,
      (b) => ({ ids: Array.from(b.querySelectorAll("[data-l]:checked")).map((c) => c.dataset.l), model: b.querySelector("#pm").checked, mp: b.querySelector("#pmp").value, ps: b.querySelector("#pps").value }), { ok: "Print / Save as PDF" });
    if (!r) return;
    const pages = r.ids.map((id) => K.layoutSVG(d, d.ents, L.find((l) => l.id === id), { ps: r.ps || undefined }));
    if (r.model) { const s = K.PAPER[r.mp], W = Math.max(...s), H = Math.min(...s), b = K.extents(d, d.ents); if (b) { const m = 8, k = Math.min((W - 2 * m) / Math.max(1e-9, b.x1 - b.x0), (H - 2 * m) / Math.max(1e-9, b.y1 - b.y0)), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; pages.push({ W, H, svg: K.toSVG(d, { ents: d.ents, box: { x0: cx - W / 2 / k, x1: cx + W / 2 / k, y0: cy - H / 2 / k, y1: cy + H / 2 / k }, widthMm: W, heightMm: H, k, mono: r.ps !== "color" && r.ps !== "gray", gray: r.ps === "gray", plot: true, bg: "#fff" }) }); } }
    if (!pages.length) return E.msg("Nothing ticked.");
    printPages(E, pages, ((E.info && E.info.number) || "drawing") + " sheets"); E.msg(pages.length + " page(s) sent to the print dialog.");
  } });

  /* new text-like objects are annotative while “Anno” is on (model space) */
  K.onAdd = K.onAdd || [];
  K.onAdd.push((E, e) => { if (E.set.annoNew && (!E.space || !E.space.lay || E.space.ms) && ["text", "mtext", "leader", "fcf"].includes(e.t) && e.anno == null) e.anno = true; });

  /* ribbon */
  K.RIBBON.find((r) => r.t === "Output").g.unshift({ n: "Sheets", b: [["LAYOUT", "New sheet", "title"], ["PAGESETUP", "Page setup", "gear"], ["MVIEW", "Viewport", "rect"], ["VPSCALE", "Viewport scale", "zoomE"], ["VPLOCK", "Lock viewport", "layer"], ["PUBLISH", "Print sheets", "print"]] });
})((window.KCAD = window.KCAD || {}));
