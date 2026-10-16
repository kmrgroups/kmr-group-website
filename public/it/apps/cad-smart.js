/* KMR CAD Draft — smart objects: dynamic blocks (stretch, rotate, flip, visibility states) with a block editor,
   associative arrays (rectangular, polar, along a path) and external references to other drawings of the register. */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, cmd = K.cmd, esc = K.esc, isP = Array.isArray;
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };
  const M = K.M;
  const inv = (m) => { const det = m[0] * m[3] - m[1] * m[2]; const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det; return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]; };
  const rIn = (r, p) => p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;

  /* ---------- stretch one entity: points inside the frame move by d (same rules as STRETCH) ---------- */
  K.stretchEnt = (e, r, d, doc) => {
    const mv = (p) => (rIn(r, p) ? G.add(p, d) : p), n = JSON.parse(JSON.stringify(e));
    if (K.inside(e, r, doc)) return K.xform(e, M.move(d[0], d[1]));
    switch (e.t) {
      case "line": n.a = mv(e.a); n.b = mv(e.b); return n;
      case "pline": n.pts = e.pts.map((p) => (rIn(r, p) ? [p[0] + d[0], p[1] + d[1], p[2] || 0] : p)); return n;
      case "spline": n.pts = e.pts.map(mv); delete n.ctrl; delete n.knots; return n;
      case "leader": n.pts = e.pts.map(mv); return n;
      case "dim": for (const k of ["p1", "p2", "loc", "c"]) if (e[k]) n[k] = mv(e[k]); return n;
      case "hatch": n.loops = e.loops.map((l) => l.map(mv)); return n;
      case "arc": { const p0 = G.polar(e.c, e.a0, e.r), p1 = G.polar(e.c, e.a1, e.r), pm = G.polar(e.c, e.a0 + G.sweep(e.a0, e.a1) / 2, e.r); if (!rIn(r, p0) && !rIn(r, p1)) return rIn(r, e.c) ? K.xform(e, M.move(d[0], d[1])) : e; const A = G.arc3(mv(p0), G.add(pm, G.mul(d, rIn(r, p0) && rIn(r, p1) ? 1 : 0.5)), mv(p1)); return A ? Object.assign(n, A) : e; }
      default: { const g = K.grips(e)[0]; return g && rIn(r, g) ? K.xform(e, M.move(d[0], d[1])) : e; }
    }
  };

  /* =============================== dynamic blocks =============================== */
  const dynCache = new WeakMap();
  const pval = (p, dv) => { let v = dv && dv[p.name] != null ? dv[p.name] : p.type === "flip" ? false : p.type === "rotation" ? 0 : p.def; if (p.type === "linear") { if (p.min != null && v < p.min) v = p.min; if (p.max != null && v > p.max) v = p.max; } return v; };
  K.visState = (B, dv) => (B.dyn && B.dyn.vis && B.dyn.vis.states.length ? (dv && dv.vis && B.dyn.vis.states.includes(dv.vis) ? dv.vis : B.dyn.vis.states[0]) : null);
  K.dynApply = (B, dv) => {
    const key = JSON.stringify(dv || {}); let cm = dynCache.get(B); if (!cm) dynCache.set(B, (cm = new Map())); if (cm.has(key)) return cm.get(key);
    const st = K.visState(B, dv), hide = (B.dyn.vis && B.dyn.vis.hide) || {};
    let ents = B.ents.filter((e) => !st || !(hide[e.id] || []).includes(st));
    for (const p of B.dyn.params || []) {
      const v = pval(p, dv), aff = p.ents && p.ents.length ? new Set(p.ents) : null, apply = (fn) => { ents = ents.map((e) => (!aff || aff.has(e.id) ? fn(e) : e)); };
      if (p.type === "linear") { const dl = v - p.def; if (Math.abs(dl) > 1e-12) { const d = [Math.cos(p.dir) * dl, Math.sin(p.dir) * dl]; apply((e) => K.stretchEnt(e, p.region, d, { blocks: {}, layers: [] })); } }
      else if (p.type === "rotation" && v) apply((e) => K.xform(e, M.rot(p.base, v * D2R)));
      else if (p.type === "flip" && v) apply((e) => K.xform(e, M.mirror(p.p1, p.p2)));
    }
    const out = Object.assign({}, B, { ents }); cm.set(key, out); if (cm.size > 200) cm.delete(cm.keys().next().value); return out;
  };
  /* parameter grips of a block reference (world points) */
  const insM = (e, B) => M.mul(M.insert(e), M.move(-B.base[0], -B.base[1]));
  const gripLocal = (p, dv) => { const v = pval(p, dv); if (p.type === "linear") return G.add(p.base, [Math.cos(p.dir) * v, Math.sin(p.dir) * v]); if (p.type === "rotation") return G.polar(p.base, v * D2R, p.r || 10); if (p.type === "flip") return G.mid(p.p1, p.p2); return null; };
  K.dynGrips = (e) => { const doc = K._doc && K._doc(); const B = doc && doc.blocks[e.name]; if (!B || !B.dyn) return []; const m = insM(e, B); return (B.dyn.params || []).map((p) => gripLocal(p, e.dv)).filter(Boolean).map((q) => M.ap(m, q)); };
  K.dynGripMove = (e, i, q) => {
    const doc = K._doc && K._doc(); const B = doc && doc.blocks[e.name]; if (!B || !B.dyn) return e;
    const ps = (B.dyn.params || []).filter((p) => gripLocal(p, e.dv)), p = ps[i - 1]; if (!p) return e;
    const l = M.ap(inv(insM(e, B)), q), dv = Object.assign({}, e.dv || {});
    if (p.type === "linear") { let v = G.dot(G.sub(l, p.base), [Math.cos(p.dir), Math.sin(p.dir)]); if (p.step) v = Math.round(v / p.step) * p.step; if (p.min != null) v = Math.max(p.min, v); if (p.max != null) v = Math.min(p.max, v); dv[p.name] = +v.toFixed(6); }
    else if (p.type === "rotation") dv[p.name] = +(G.norm(G.ang(p.base, l)) / D2R).toFixed(4);
    else if (p.type === "flip") dv[p.name] = !pval(p, e.dv);
    return Object.assign({}, e, { dv });
  };
  /* dynamic properties of a selected block reference */
  K.propsHooks = K.propsHooks || [];
  K.propsHooks.push((E, el, ents) => {
    if (ents.length !== 1 || ents[0].t !== "insert") return; const e = ents[0], B = E.doc.blocks[e.name]; if (!B || !B.dyn) return;
    const box = document.createElement("div"), ps = B.dyn.params || [];
    box.innerHTML = `<h4>Dynamic block</h4><div class="cx-pg">${ps.map((p, i) => p.type === "flip" ? `<label class="cx-chk"><input data-dp="${i}" type="checkbox"${pval(p, e.dv) ? " checked" : ""}> ${esc(p.name)}</label>` : `<label>${esc(p.name)}${p.type === "rotation" ? " (°)" : ""}<input data-dp="${i}" type="number" step="${p.step || "any"}"${p.min != null ? ` min="${p.min}"` : ""}${p.max != null ? ` max="${p.max}"` : ""} value="${K.fmt(pval(p, e.dv), 4)}"></label>`).join("")}${B.dyn.vis && B.dyn.vis.states.length ? `<label>Visibility<select data-dvis>${B.dyn.vis.states.map((s) => `<option${s === K.visState(B, e.dv) ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>` : ""}</div><p class="cx-note">You can also drag the blue parameter grips of the block.</p>`;
    el.appendChild(box);
    const set = (k, v) => E.tx("dynamic block", () => { const n = E.byId(e.id); E.replace(e.id, Object.assign({}, n, { dv: Object.assign({}, n.dv || {}, { [k]: v }) })); });
    box.querySelectorAll("[data-dp]").forEach((inp) => (inp.onchange = () => { const p = ps[+inp.dataset.dp]; set(p.name, p.type === "flip" ? inp.checked : +inp.value); }));
    const vs = box.querySelector("[data-dvis]"); if (vs) vs.onchange = () => set("vis", vs.value);
  });

  /* ---------- block editor ---------- */
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    K._doc = () => E.doc;
    const bar = document.createElement("div"); bar.className = "cx-bebar"; bar.style.display = "none"; E.$(".cx-cw").appendChild(bar);
    const drawBar = () => {
      const be = E._be; if (!be) { bar.style.display = "none"; return; }
      const vis = be.dyn.vis && be.dyn.vis.states.length ? be.dyn.vis : null;
      bar.style.display = "flex";
      bar.innerHTML = `<b>Block editor: ${esc(be.name)}</b><span class="cx-sep"></span><button data-be="BPARAMETER">+ Parameter</button><button data-be="BPARAMS">Parameters (${(be.dyn.params || []).length})</button><button data-be="BVSTATE">Visibility states</button>${vis ? `<select data-bvs>${vis.states.map((s) => `<option${s === be.state ? " selected" : ""}>${esc(s)}</option>`).join("")}</select><button data-be="BVHIDE">Hide selected</button><button data-be="BVSHOW">Show selected</button>` : ""}<button data-be="BASE">Base point</button><span style="flex:1"></span><button data-be="BSAVE" class="cx-b">Keep changes</button><button data-be="BCLOSE">Close</button>`;
    };
    bar.addEventListener("click", (ev) => { const b = ev.target.closest("[data-be]"); if (b) E.run(b.dataset.be); });
    bar.addEventListener("change", (ev) => { if (ev.target.matches("[data-bvs]")) { E._be.state = ev.target.value; E.redraw(); } });
    E.drawBEBar = drawBar;
    E.enterBlockEditor = (name) => {
      if (E._be) return E.err("The block editor is already open.");
      const B = E.doc.blocks[name]; if (!B) return E.err(`Block "${name}" not found.`);
      if (E.space && E.space.lay && !E.space.ms) E.setSpace(null);
      const ents = B.ents.map((e) => Object.assign(JSON.parse(JSON.stringify(e)), { id: e.id || K.uid() }));
      E._be = { name, saved: E.doc.ents, view: Object.assign({}, E.view), undo: E.stashUndo(), base: B.base.slice(), dyn: JSON.parse(JSON.stringify(B.dyn || { params: [] })), state: null };
      if (!E._be.dyn.params) E._be.dyn.params = []; if (E._be.dyn.vis) E._be.state = E._be.dyn.vis.states[0];
      E.doc.ents = ents; E.reindex(); E.sel = []; E.zoomExt(); drawBar(); E.changed();
      E.msg(`Block editor for "${name}". Draw and modify as usual; add parameters to make it dynamic. "Keep changes" updates every insert of the block.`, "mu");
    };
    E.leaveBlockEditor = (keep) => {
      const be = E._be; if (!be) return; const edited = E.doc.ents;
      E.doc.ents = be.saved; E.reindex(); E._be = null; E.unstashUndo(be.undo); Object.assign(E.view, be.view); drawBar();
      if (keep) E.tx("edit block " + be.name, () => { const dyn = (be.dyn.params && be.dyn.params.length) || (be.dyn.vis && be.dyn.vis.states.length) ? be.dyn : undefined; E.doc.blocks = Object.assign({}, E.doc.blocks, { [be.name]: Object.assign({ base: be.base, ents: edited }, dyn ? { dyn } : {}) }); });
      E.changed(); E.msg(keep ? `Block "${be.name}" updated.` : "Block editor closed without changes.");
    };
    E.overlayHook = ((prev) => (ctx, P) => {
      if (prev) prev(ctx, P);
      const be = E._be; if (!be) return;
      ctx.font = "12px system-ui"; ctx.lineWidth = 1.5;
      const b = E.w2s(be.base); ctx.strokeStyle = "#f472b6"; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(b[0], b[1], 6, 0, 7); ctx.moveTo(b[0] - 9, b[1]); ctx.lineTo(b[0] + 9, b[1]); ctx.moveTo(b[0], b[1] - 9); ctx.lineTo(b[0], b[1] + 9); ctx.stroke(); ctx.fillStyle = "#f472b6"; ctx.fillText("base", b[0] + 8, b[1] - 8);
      for (const p of be.dyn.params || []) {
        ctx.strokeStyle = ctx.fillStyle = "#38bdf8"; ctx.setLineDash([5, 4]);
        if (p.type === "linear") { const a = E.w2s(p.base), c = E.w2s(G.add(p.base, [Math.cos(p.dir) * p.def, Math.sin(p.dir) * p.def])); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]); ctx.fillRect(c[0] - 4, c[1] - 4, 8, 8); ctx.fillText(`${p.name} = ${K.fmt(p.def, 2)}`, (a[0] + c[0]) / 2 + 6, (a[1] + c[1]) / 2 - 6); const r0 = E.w2s([p.region.x0, p.region.y1]), r1 = E.w2s([p.region.x1, p.region.y0]); ctx.setLineDash([2, 3]); ctx.strokeRect(r0[0], r0[1], r1[0] - r0[0], r1[1] - r0[1]); }
        else if (p.type === "rotation") { const a = E.w2s(p.base); ctx.beginPath(); ctx.arc(a[0], a[1], (p.r || 10) * E.view.s, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(p.name + " (rotation)", a[0] + 8, a[1] + 16); }
        else if (p.type === "flip") { const a = E.w2s(p.p1), c = E.w2s(p.p2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(p.name + " (flip)", (a[0] + c[0]) / 2 + 6, (a[1] + c[1]) / 2); }
      }
      ctx.setLineDash([]);
    })(E.overlayHook);
    /* objects hidden in the current visibility state are drawn faint in the block editor */
    E.baseHook = ((prev) => (ctx) => {
      const be = E._be; if (!be || !be.state) return prev ? prev(ctx) : false;
      const hide = (be.dyn.vis && be.dyn.vis.hide) || {}, all = E.doc.ents;
      E.doc.ents = all.filter((e) => !(hide[e.id] || []).includes(be.state)); E.reindex();
      let r = false; try { if (!prev || !(r = prev(ctx))) { const V = E.view; ctx.fillStyle = E.bg(); ctx.fillRect(0, 0, V.W, V.H); if (E.set.grid) E.drawGrid(ctx); const Pn = K.canvasPainter(ctx, V, { fg: E.fg(), light: E.set.light, lwt: E.set.lwt, ltscale: E.doc.ltscale }); for (const e of E.doc.ents) K.paint(Pn, e, E.doc); ctx.globalAlpha = 0.18; for (const e of all) if ((hide[e.id] || []).includes(be.state)) K.paint(Pn, e, E.doc); ctx.globalAlpha = 1; r = true; } }
      finally { E.doc.ents = all; E.reindex(); }
      return r;
    })(E.baseHook);
  });
  const inBE = (E) => { if (!E._be) { E.msg("Open the block editor first (BEDIT)."); return false; } return true; };
  cmd("BEDIT", { a: ["BE"], d: "Block editor: change a block and make it dynamic (stretch, rotate, flip, visibility)", fn: async (E, args) => {
    if (E.readOnly) return E.err(E.readOnly);
    let name = args && args.name;
    if (!name && E.sel.length === 1 && E.byId(E.sel[0]) && E.byId(E.sel[0]).t === "insert") name = E.byId(E.sel[0]).name;
    if (!name) { const names = Object.keys(E.doc.blocks).filter((n) => !/^\*|^XREF\|/.test(n)); if (!names.length) return E.msg("This drawing has no blocks yet (BLOCK makes one)."); name = await E.dialog("Edit block", `<div class="cx-blist">${names.map((n) => `<button type="button" data-bn="${esc(n)}">${K.blockThumb(E.doc, n)}<span>${esc(n)}${E.doc.blocks[n].dyn ? "<i>dynamic</i>" : ""}</span></button>`).join("")}</div>`, null, { width: "min(760px,96vw)", init: (b) => b.querySelectorAll("[data-bn]").forEach((x) => (x.onclick = () => E.closeDlg(x.dataset.bn))) }); if (!name) return; }
    if (/^XREF\|/.test(name)) return E.err("A reference to another drawing cannot be edited here — open that drawing.");
    E.enterBlockEditor(name);
  } });
  cmd("BSAVE", { a: [], d: "Keep the block editor changes", norepeat: true, fn: async (E) => { if (inBE(E)) E.leaveBlockEditor(true); } });
  cmd("BCLOSE", { a: [], d: "Close the block editor", norepeat: true, fn: async (E) => { if (!inBE(E)) return; const k = await E.getKw("Keep the changes to the block? [Yes/No] <Yes>:", ["Yes", "No"], "Yes"); E.leaveBlockEditor(!(k && k.kw === "No")); } });
  cmd("BASE", { a: [], d: "Base (insertion) point of the block in the block editor", fn: async (E) => { if (!inBE(E)) return; const p = need(await E.getPoint("Specify the base point:")); if (isP(p)) { E._be.base = p; E.drawOverlay(); } } });
  cmd("BPARAMETER", { a: ["BPARAM", "BP"], d: "Add a dynamic parameter in the block editor: Linear (stretch), Rotation, Flip, Visibility", fn: async (E) => {
    if (!inBE(E)) return; const be = E._be, ps = be.dyn.params, nm = (p) => { let i = 1; while (ps.some((x) => x.name === p + i)) i++; return p + i; };
    const k = await E.getKw("Enter parameter type [Linear/Rotation/Flip/Visibility] <Linear>:", ["Linear", "Rotation", "Flip", "Visibility"], "Linear"); const t = k && k.kw ? k.kw : "Linear";
    if (t === "Visibility") return E.run("BVSTATE");
    if (t === "Linear") {
      const a = need(await E.getPoint("Specify start point (fixed end):")); const b = need(await E.getPoint("Specify end point (the end that moves):", { base: a }));
      if (G.dist(a, b) < 1e-9) return E.err("The two points are the same.");
      E.msg("Now draw the stretch frame around the part that should move (crossing window).", "mu");
      const c1 = need(await E.getPoint("Specify first corner of the stretch frame:")); const c2 = need(await E.getPoint("Specify opposite corner:", { base: c1, noRubber: true, preview: (q) => [{ t: "pline", closed: true, color: "#38bdf8", pts: [[c1[0], c1[1]], [q[0], c1[1]], [q[0], q[1]], [c1[0], q[1]]] }] }));
      const region = { x0: Math.min(c1[0], c2[0]), y0: Math.min(c1[1], c2[1]), x1: Math.max(c1[0], c2[0]), y1: Math.max(c1[1], c2[1]) };
      const aff = E.doc.ents.filter((e) => K.crosses(e, region, E.doc)).map((e) => e.id);
      const name = (await E.getText(`Enter parameter name <${nm("Distance")}>:`, { dflt: nm("Distance") })) || nm("Distance");
      ps.push({ type: "linear", name, base: a, dir: G.ang(a, b), def: G.dist(a, b), region, ents: aff }); E.msg(`Linear parameter "${name}" stretches ${aff.length} object(s). Set limits and steps under Parameters.`);
    } else if (t === "Rotation") {
      const a = need(await E.getPoint("Specify the centre of rotation:")); const b = need(await E.getPoint("Specify the grip radius:", { base: a }));
      const ids = await E.getSel("Select the objects that rotate (Enter = all):", { fresh: true }); const name = (await E.getText(`Enter parameter name <${nm("Angle")}>:`, { dflt: nm("Angle") })) || nm("Angle");
      ps.push({ type: "rotation", name, base: a, r: G.dist(a, b), ents: ids });
    } else {
      const a = need(await E.getPoint("Specify first point of the flip line:")); const b = need(await E.getPoint("Specify second point:", { base: a }));
      const ids = await E.getSel("Select the objects that flip (Enter = all):", { fresh: true }); const name = (await E.getText(`Enter parameter name <${nm("Flip")}>:`, { dflt: nm("Flip") })) || nm("Flip");
      ps.push({ type: "flip", name, p1: a, p2: b, ents: ids });
    }
    E.drawBEBar(); E.drawOverlay();
  } });
  cmd("BPARAMS", { a: [], d: "List, limit or remove the dynamic parameters of the block being edited", fn: async (E) => {
    if (!inBE(E)) return; const ps = E._be.dyn.params; if (!ps.length) return E.msg("No parameters yet (BPARAMETER).");
    const r = await E.dialog("Block parameters", `<div class="cx-tgrid"><table><tr><th>Name</th><th>Type</th><th>Default</th><th>Min</th><th>Max</th><th>Step</th><th></th></tr>${ps.map((p, i) => `<tr data-i="${i}"><td><input data-k="name" value="${esc(p.name)}"></td><td class="cx-ro">${p.type}</td>${p.type === "linear" ? `<td class="cx-ro">${K.fmt(p.def, 3)}</td><td><input data-k="min" type="number" step="any" value="${p.min ?? ""}"></td><td><input data-k="max" type="number" step="any" value="${p.max ?? ""}"></td><td><input data-k="step" type="number" step="any" value="${p.step ?? ""}"></td>` : "<td></td><td></td><td></td><td></td>"}<td><label class="cx-chk"><input data-k="del" type="checkbox"> remove</label></td></tr>`).join("")}</table></div>`,
      (b) => { const out = []; b.querySelectorAll("tr[data-i]").forEach((tr) => { const p = Object.assign({}, ps[+tr.dataset.i]); if (tr.querySelector("[data-k=del]").checked) return; p.name = tr.querySelector("[data-k=name]").value.trim() || p.name; for (const k of ["min", "max", "step"]) { const i = tr.querySelector(`[data-k=${k}]`); if (i) { if (i.value === "") delete p[k]; else p[k] = +i.value; } } out.push(p); }); if (new Set(out.map((p) => p.name)).size !== out.length) throw new Error("Names must be unique."); return out; }, { width: "min(760px,96vw)" });
    if (r) { E._be.dyn.params = r; E.drawBEBar(); E.drawOverlay(); }
  } });
  cmd("BVSTATE", { a: ["BVS"], d: "Visibility states of the block being edited (e.g. Side view / Top view)", fn: async (E) => {
    if (!inBE(E)) return; const v = E._be.dyn.vis || { states: [], hide: {} };
    const r = await E.dialog("Visibility states", `<label>States (one per line, the first is the default)<textarea id="vs" rows="5">${esc(v.states.join("\n") || "State 1\nState 2")}</textarea></label><p class="cx-note">After OK, pick a state in the block editor bar and use “Hide selected” / “Show selected” to choose what is visible in that state.</p>`, (b) => b.querySelector("#vs").value.split("\n").map((s) => s.trim()).filter(Boolean));
    if (!r) return; const hide = {}; for (const [id, st] of Object.entries(v.hide || {})) { const k = st.filter((s) => r.includes(s)); if (k.length) hide[id] = k; }
    E._be.dyn.vis = r.length ? { states: r, hide } : undefined; E._be.state = r[0] || null; E.drawBEBar(); E.redraw();
  } });
  const visSet = async (E, show) => { if (!inBE(E)) return; const v = E._be.dyn.vis; if (!v) return E.msg("Add visibility states first."); const ids = await E.getSel(show ? "Select objects to show in this state:" : "Select objects to hide in this state:"); const st = E._be.state; ids.forEach((id) => { const s = new Set(v.hide[id] || []); if (show) s.delete(st); else s.add(st); if (s.size) v.hide[id] = Array.from(s); else delete v.hide[id]; }); E.redraw(); E.msg(`${ids.length} object(s) ${show ? "shown" : "hidden"} in "${st}".`); };
  cmd("BVHIDE", { a: [], d: "Hide objects in the current visibility state (block editor)", fn: (E) => visSet(E, false) });
  cmd("BVSHOW", { a: [], d: "Show objects in the current visibility state (block editor)", fn: (E) => visSet(E, true) });

  /* =============================== associative arrays =============================== */
  const arrM = (e, doc) => {
    const out = [];
    if (e.kind === "rect") { for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) out.push(M.move(e.vc[0] * c + e.vr[0] * r, e.vc[1] * c + e.vr[1] * r)); }
    else if (e.kind === "polar") { const full = Math.abs(Math.abs(e.fill) - 360) < 1e-9, st = (e.fill * D2R) / (full ? e.n : Math.max(1, e.n - 1)); for (let i = 0; i < e.n; i++) out.push(e.rot !== false ? M.rot(e.c, st * i) : (() => { const q = G.rotp(e.base, e.c, st * i); return M.move(q[0] - e.base[0], q[1] - e.base[1]); })()); }
    else if (e.kind === "path") {
      const pe = e.path && doc ? (doc.ents || []).find((x) => x.id === e.path) : null, P = K.path(pe || { t: "pline", pts: e.snap.map((p) => [p[0], p[1], p[2] || 0]), closed: false }); if (!P) return [M.id()];
      const L = K.pathLen(P), n = Math.max(1, e.n), step = P.closed ? L / n : n > 1 ? L / (n - 1) : 0, t0 = (() => { const s0 = K.pathAtLen(P, 0); const a = K.pathPoint(P, Math.min(P.prims.length - 1e-6, s0 + 1e-4)), b = K.pathPoint(P, s0); return G.ang(b, a); })();
      for (let i = 0; i < n; i++) { const s = K.pathAtLen(P, Math.min(L, i * step)), q = K.pathPoint(P, s), q2 = K.pathPoint(P, Math.min(P.prims.length - 1e-6, s + 1e-4)), q1 = K.pathPoint(P, Math.max(0, s - 1e-4)), ang = G.ang(q1, q2); let m = M.move(q[0] - e.base[0], q[1] - e.base[1]); if (e.align) m = M.mul(M.rot(q, ang - t0), m); out.push(m); }
    }
    return out;
  };
  K.EXT.array = {
    items(e, doc) { const ms = arrM(e, doc), out = []; for (const m of ms) for (const s of e.src) { const w = K.xform(s, m); out.push(w); } return out; },
    geom(e, doc) { return K.EXT.array.items(e, doc); },
    grips(e) { const g = [e.base]; if (e.kind === "rect") { if (e.cols > 1) g.push(G.add(e.base, G.mul(e.vc, e.cols - 1))); if (e.rows > 1) g.push(G.add(e.base, G.mul(e.vr, e.rows - 1))); } if (e.kind === "polar") g.push(e.c); return g; },
    gripMove(e, i, q) {
      if (i === 0) return K.xform(e, M.move(q[0] - e.base[0], q[1] - e.base[1]));
      const n = JSON.parse(JSON.stringify(e));
      if (e.kind === "rect") { const g = K.EXT.array.grips(e); const which = e.cols > 1 && i === 1 ? "c" : "r"; void g; if (which === "c") n.vc = G.mul(G.sub(q, e.base), 1 / (e.cols - 1)); else n.vr = G.mul(G.sub(q, e.base), 1 / (e.rows - 1)); }
      if (e.kind === "polar") n.c = q;
      return n;
    },
    xform(e, m, d, n) { n.src = e.src.map((s) => K.xform(s, m)); n.base = M.ap(m, e.base); const lin = (v) => [m[0] * v[0] + m[2] * v[1], m[1] * v[0] + m[3] * v[1]]; if (e.vc) { n.vc = lin(e.vc); n.vr = lin(e.vr); } if (e.c) n.c = M.ap(m, e.c); if (e.snap) n.snap = e.snap.map((p) => M.ap(m, p)); if (d.mir && e.kind === "polar") n.fill = -e.fill; return n; },
  };
  K.makeArray = true;
  K.propsHooks.push((E, el, ents) => {
    if (ents.length !== 1 || ents[0].t !== "array") return; const e = ents[0], box = document.createElement("div");
    const F = (k, label, v, step = "any") => `<label>${label}<input data-ak="${k}" type="number" step="${step}" value="${K.fmt(v, 4)}"></label>`;
    box.innerHTML = `<h4>Array (${e.kind})</h4><div class="cx-pg">${e.kind === "rect" ? F("cols", "Columns", e.cols, 1) + F("rows", "Rows", e.rows, 1) + F("vc0", "Column spacing", G.len(e.vc)) + F("vr0", "Row spacing", G.len(e.vr)) : e.kind === "polar" ? F("n", "Items", e.n, 1) + F("fill", "Fill angle (°)", e.fill) + `<label class="cx-chk"><input data-ak="rot" type="checkbox"${e.rot !== false ? " checked" : ""}> Rotate items</label>` : F("n", "Items", e.n, 1) + `<label class="cx-chk"><input data-ak="align" type="checkbox"${e.align ? " checked" : ""}> Align to path</label>`}</div><p class="cx-note">${e.src.length} source object(s) per item. EXPLODE makes separate copies.</p>`;
    el.appendChild(box);
    box.querySelectorAll("[data-ak]").forEach((inp) => (inp.onchange = () => E.tx("edit array", () => {
      const n = JSON.parse(JSON.stringify(E.byId(e.id))), k = inp.dataset.ak, v = inp.type === "checkbox" ? inp.checked : +inp.value;
      if (k === "vc0") n.vc = G.mul(G.unit(n.vc), v || 1); else if (k === "vr0") n.vr = G.mul(G.unit(n.vr), v || 1); else if (["cols", "rows", "n"].includes(k)) n[k] = Math.max(1, Math.min(5000, Math.round(v))); else n[k] = v;
      if ((n.cols || 1) * (n.rows || 1) > 5000) throw new Error("More than 5000 items.");
      E.replace(e.id, n);
    })));
  });
  cmd("ARRAYPATH", { a: ["ARP"], d: "Associative array along a path (line, polyline, arc, spline)", fn: async (E) => {
    const ids = await E.getSel("Select objects to array:"); if (!ids.length) return;
    const pth = need(await E.getEnt("Select the path curve:", { filter: (e) => !!K.path(e) && !ids.includes(e.id) }));
    const n = need(await E.getNum("Enter number of items <6>:", { dflt: 6, int: true, min: 1 }));
    const src = ids.map((id) => E.byId(id)), bb = src.map((e) => K.bbox(e, E.doc)).reduce((a, b) => G.mergeBounds(a, b), null);
    const base = need(await E.getPoint("Specify base point of the objects <centre>:", { dflt: [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2] }));
    const k = await E.getKw("Align items to the path? [Yes/No] <Yes>:", ["Yes", "No"], "Yes"); const align = !(k && k.kw === "No");
    const P = K.path(pth.e), snap = []; for (let i = 0; i <= 64; i++) snap.push(K.pathPoint(P, (P.prims.length * i) / 64));
    E.tx("path array", () => { E.remove(ids); E.add({ t: "array", kind: "path", src, base, n, align, path: pth.e.id, snap, layer: src[0].layer }, true); });
    E.msg(`Path array of ${n} item(s); it follows the path when the path is edited.`);
  } });
  cmd("ARRAYEDIT", { a: ["ARE"], d: "Edit an associative array (counts, spacing)", fn: async (E) => { const v = need(await E.getEnt("Select an array:", { filter: (e) => e.t === "array" })); E.sel = [v.e.id]; E.showSide("props"); E.drawOverlay(); E.msg("Change the array in the Properties panel, or drag its grips."); } });

  /* =============================== external references =============================== */
  const xrefName = (num) => "XREF|" + num;
  const buildXrefBlock = (E, d, data) => {
    const num = d.number, pre = num + "|", src = Object.assign({ ents: [], blocks: {}, layers: [] }, data || {});
    const rn = (n) => xrefName(num) + "|" + n, blocks = {};
    const fix = (e) => { const n = JSON.parse(JSON.stringify(e)); if (n.layer && n.layer !== "0") n.layer = pre + n.layer; if (n.t === "insert") n.name = rn(n.name); return n; };
    for (const [n, b] of Object.entries(src.blocks || {})) blocks[rn(n)] = Object.assign({}, b, { ents: (b.ents || []).map(fix) });
    blocks[xrefName(num)] = { base: [0, 0], ents: (src.ents || []).filter((e) => e.t !== "vport").map(fix) };
    const layers = (src.layers || []).filter((l) => l.name !== "0").map((l) => Object.assign({}, l, { name: pre + l.name, lock: false }));
    return { blocks, layers };
  };
  const applyXref = (E, d, data) => {
    const { blocks, layers } = buildXrefBlock(E, d, data), num = d.number, keep = Object.fromEntries(Object.entries(E.doc.blocks).filter(([n]) => !(n === xrefName(num) || n.startsWith(xrefName(num) + "|"))));
    E.doc.blocks = Object.assign(keep, blocks);
    const have = new Map(E.doc.layers.map((l) => [l.name, l])); E.doc.layers = E.doc.layers.concat(layers.filter((l) => !have.has(l.name)));
  };
  const pickRev = (list, number) => { const revs = list.filter((x) => x.number === number); return revs.find((x) => x.status === "released") || revs.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0]; };
  cmd("XATTACH", { a: ["XA", "XREF ATTACH"], d: "Attach another drawing of the register as a reference (it updates when that drawing is revised)", fn: async (E) => {
    if (!E.opts.listDrawings) return E.err("References need the drawing register.");
    const all = (await E.opts.listDrawings()).filter((x) => x.status !== "superseded" && !(E.info && x.number === E.info.number)), nums = Array.from(new Set(all.map((x) => x.number)));
    if (!nums.length) return E.msg("There are no other drawings in the register to reference.");
    const pick = await E.dialog("Attach a reference drawing", `<p class="cx-note">The latest released revision is used (or the newest one if none is released). It cannot be edited here; open that drawing to change it.</p><div class="cx-blist">${nums.map((n) => { const d = pickRev(all, n); return `<button type="button" data-n="${esc(n)}">${d.thumb ? `<img src="${d.thumb}" style="width:100%;border-radius:4px">` : ""}<span>${esc(n)} · rev ${esc(d.rev)}<i>${esc(d.title)}</i></span></button>`; }).join("")}</div>`, null, { width: "min(760px,96vw)", init: (b) => b.querySelectorAll("[data-n]").forEach((x) => (x.onclick = () => E.closeDlg(x.dataset.n))) });
    if (!pick) return; const d0 = pickRev(all, pick), d = await E.opts.getDrawing(d0.id);
    E.tx("attach reference", () => applyXref(E, d, d.data));
    const mk = (p, s = 1, rot = 0) => ({ t: "insert", name: xrefName(d.number), p, sx: s, sy: s, rot, xref: { id: d.id, number: d.number, rev: d.rev } });
    const p = need(await E.getPoint("Specify insertion point:", { preview: (q) => [mk(q)] })); const s = await E.getNum("Enter scale factor <1>:", { dflt: 1, positive: true });
    E.add(mk(p, typeof s === "number" ? s : 1)); E.msg(`Reference ${d.number} rev ${d.rev} attached.`);
  } });
  K.reloadXrefs = async (E, silent) => {
    const xs = E.doc.ents.filter((e) => e.t === "insert" && e.xref).concat(...(E.doc.layouts || []).map((l) => (l.ents || []).filter((e) => e.t === "insert" && e.xref)));
    if (!xs.length || !E.opts.listDrawings) return 0; const all = await E.opts.listDrawings(), done = new Set(); let n = 0;
    for (const x of xs) {
      if (done.has(x.xref.number)) continue; done.add(x.xref.number);
      const d0 = pickRev(all, x.xref.number); if (!d0) { if (!silent) E.err(`Reference ${x.xref.number} is no longer in the register (kept as it was).`); continue; }
      if (silent && d0.rev === x.xref.rev && E.doc.blocks[xrefName(x.xref.number)]) continue;
      const d = await E.opts.getDrawing(d0.id); const was = E.readOnly; E.readOnly = null;
      try { E.tx("reload reference", () => { applyXref(E, d, d.data); E.doc.ents = E.doc.ents.map((e) => (e.t === "insert" && e.xref && e.xref.number === d.number ? Object.assign({}, e, { xref: { id: d.id, number: d.number, rev: d.rev } }) : e)); }); } finally { E.readOnly = was; }
      if (d0.rev !== x.xref.rev) E.msg(`Reference ${d.number} updated from rev ${x.xref.rev} to rev ${d.rev}.`, "ok"); n++;
    }
    E.reindex(); E.redraw(); return n;
  };
  cmd("XREF", { a: ["ER", "EXTERNALREFERENCES", "XR"], d: "References manager: reload, bind (make a normal block) or detach", fn: async (E) => {
    const xs = E.doc.ents.filter((e) => e.t === "insert" && e.xref); if (!xs.length) return E.msg("No references in this drawing (XATTACH adds one).");
    const all = E.opts.listDrawings ? await E.opts.listDrawings() : [], nums = Array.from(new Set(xs.map((x) => x.xref.number)));
    const r = await E.dialog("References", `<table class="cx-tgrid"><tr><th>Drawing</th><th>Attached rev</th><th>Latest rev</th><th>Uses</th><th></th></tr>${nums.map((n) => { const x = xs.find((q) => q.xref.number === n), d = pickRev(all, n); return `<tr><td>${esc(n)}</td><td>${esc(x.xref.rev)}</td><td>${d ? esc(d.rev) + (d.rev !== x.xref.rev ? " ⚠" : "") : "—"}</td><td>${xs.filter((q) => q.xref.number === n).length}</td><td><button type="button" class="cx-b o" data-a="reload" data-n="${esc(n)}">Reload</button> <button type="button" class="cx-b o" data-a="bind" data-n="${esc(n)}">Bind</button> <button type="button" class="cx-b o" data-a="detach" data-n="${esc(n)}">Detach</button></td></tr>`; }).join("")}</table><p class="cx-note">Bind turns the reference into an ordinary block of this drawing (it no longer updates).</p>`, null, { width: "min(720px,96vw)", init: (b) => b.querySelectorAll("[data-a]").forEach((x) => (x.onclick = () => E.closeDlg({ a: x.dataset.a, n: x.dataset.n }))) });
    if (!r) return;
    if (r.a === "reload") { const n = await K.reloadXrefs(E, false); if (!n) E.msg("References are up to date."); return; }
    if (r.a === "detach") { E.tx("detach reference", () => { E.doc.ents = E.doc.ents.filter((e) => !(e.t === "insert" && e.xref && e.xref.number === r.n)); E.reindex(); const nb = Object.assign({}, E.doc.blocks); for (const k of Object.keys(nb)) if (k === xrefName(r.n) || k.startsWith(xrefName(r.n) + "|")) delete nb[k]; E.doc.blocks = nb; const used = new Set(E.doc.ents.map((e) => e.layer)); E.doc.layers = E.doc.layers.filter((l) => !(l.name.startsWith(r.n + "|") && !used.has(l.name))); }); E.msg(`Reference ${r.n} detached.`); return; }
    if (r.a === "bind") { const x = xs.find((q) => q.xref.number === r.n), nn = `${r.n}-rev${x.xref.rev}`; E.tx("bind reference", () => { const nb = {}; for (const [k, b] of Object.entries(E.doc.blocks)) { const k2 = k === xrefName(r.n) ? nn : k.startsWith(xrefName(r.n) + "|") ? nn + "$" + k.slice(xrefName(r.n).length + 1) : k; nb[k2] = Object.assign({}, b, { ents: b.ents.map((e) => (e.t === "insert" && e.name.startsWith(xrefName(r.n)) ? Object.assign({}, e, { name: e.name === xrefName(r.n) ? nn : nn + "$" + e.name.slice(xrefName(r.n).length + 1) }) : e)) }); } E.doc.blocks = nb; E.doc.ents = E.doc.ents.map((e) => (e.t === "insert" && e.xref && e.xref.number === r.n ? Object.assign({}, e, { name: nn, xref: undefined }) : e)); E.reindex(); }); E.msg(`Reference bound as block "${nn}".`); }
  } });

  /* ribbon */
  const ins = K.RIBBON.find((r) => r.t === "Insert");
  ins.g.find((g) => g.n === "Block").b.push(["BEDIT", "Block editor", "block"]);
  ins.g.splice(2, 0, { n: "Reference", b: [["XATTACH", "Attach drawing", "insert"], ["XREF", "References", "list"]] });
  const home = K.RIBBON.find((r) => r.t === "Home"), mod = home.g.find((g) => g.n === "Modify"); mod.b.splice(mod.b.findIndex((b) => b[0] === "ARRAY") + 1, 0, ["ARRAYPATH", "Path array", "spline"]);
})((window.KCAD = window.KCAD || {}));
