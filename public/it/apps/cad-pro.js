/* KMR CAD Draft — pro drafting: GD&T feature control frames, dimension tolerances and named dimension styles, block
   attributes, tables and bill of materials, balloons, groups, quick select, draw order, revision clouds, centre marks /
   centre lines, quick dimension, find & replace. */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, TAU = G.TAU, cmd = K.cmd, esc = K.esc, isP = Array.isArray;
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };
  const f = (v, E, d) => K.fmt(v, d == null ? E.doc.dim.dec : d);
  const mem = (E) => (E.mem = E.mem || {});
  const tr = (p0, rot) => (q) => G.add(p0, G.rotp(q, [0, 0], rot || 0));

  /* =============================== GD&T feature control frame =============================== */
  K.GDT = {
    straightness: { n: "Straightness", g: "form" }, flatness: { n: "Flatness", g: "form" }, circularity: { n: "Circularity (roundness)", g: "form" }, cylindricity: { n: "Cylindricity", g: "form" },
    profile_line: { n: "Profile of a line", g: "profile" }, profile_surface: { n: "Profile of a surface", g: "profile" },
    angularity: { n: "Angularity", g: "orientation" }, perpendicularity: { n: "Perpendicularity", g: "orientation" }, parallelism: { n: "Parallelism", g: "orientation" },
    position: { n: "Position", g: "location" }, concentricity: { n: "Concentricity / coaxiality", g: "location" }, symmetry: { n: "Symmetry", g: "location" },
    runout: { n: "Circular run-out", g: "run-out" }, total_runout: { n: "Total run-out", g: "run-out" },
  };
  /** the symbol drawn in a unit square (−0.5…0.5), scaled by s and placed at c */
  K.gdtSymbol = (key, c, s) => {
    const P = (x, y) => [c[0] + x * s, c[1] + y * s], L = (a, b, x, y) => ({ t: "line", a: P(a, b), b: P(x, y) }), C = (r, x = 0, y = 0) => ({ t: "circle", c: P(x, y), r: r * s }), out = [];
    const arrowHead = (x, y, ang) => ({ t: "hatch", solid: true, loops: [[P(x, y), P(x - 0.16 * Math.cos(ang - 0.4), y - 0.16 * Math.sin(ang - 0.4)), P(x - 0.16 * Math.cos(ang + 0.4), y - 0.16 * Math.sin(ang + 0.4))]] });
    switch (key) {
      case "straightness": out.push(L(-0.35, 0, 0.35, 0)); break;
      case "flatness": out.push({ t: "pline", closed: true, pts: [P(-0.38, -0.15), P(0.18, -0.15), P(0.38, 0.15), P(-0.18, 0.15)].map((q) => [q[0], q[1], 0]) }); break;
      case "circularity": out.push(C(0.3)); break;
      case "cylindricity": out.push(C(0.2), L(-0.4, -0.3, -0.1, 0.3), L(0.1, -0.3, 0.4, 0.3)); break;
      case "profile_line": out.push({ t: "arc", c: P(0, -0.12), r: 0.32 * s, a0: 0, a1: Math.PI }); break;
      case "profile_surface": out.push({ t: "arc", c: P(0, -0.12), r: 0.32 * s, a0: 0, a1: Math.PI }, L(-0.32, -0.12, 0.32, -0.12)); break;
      case "angularity": out.push(L(-0.38, -0.25, 0.38, -0.25), L(-0.38, -0.25, 0.3, 0.25)); break;
      case "perpendicularity": out.push(L(-0.36, -0.3, 0.36, -0.3), L(0, -0.3, 0, 0.36)); break;
      case "parallelism": out.push(L(-0.32, -0.3, -0.02, 0.32), L(0.02, -0.3, 0.32, 0.32)); break;
      case "position": out.push(C(0.24), L(-0.4, 0, 0.4, 0), L(0, -0.4, 0, 0.4)); break;
      case "concentricity": out.push(C(0.32), C(0.15)); break;
      case "symmetry": out.push(L(-0.24, 0.16, 0.24, 0.16), L(-0.4, 0, 0.4, 0), L(-0.24, -0.16, 0.24, -0.16)); break;
      case "runout": out.push(L(-0.25, -0.32, 0.25, 0.28), arrowHead(0.28, 0.32, Math.atan2(0.6, 0.5))); break;
      case "total_runout": out.push(L(-0.35, -0.32, 0.2, -0.32), L(-0.3, -0.32, -0.02, 0.28), L(0.05, -0.32, 0.33, 0.28), arrowHead(0.0, 0.32, Math.atan2(0.6, 0.28)), arrowHead(0.35, 0.32, Math.atan2(0.6, 0.28))); break;
    }
    return out;
  };
  const circled = (p, h, ch) => [{ t: "circle", c: p, r: h * 0.62 }, { t: "text", p, h: h * 0.8, s: ch, rot: 0, ha: 1, va: 2 }];
  const fcfLayout = (e) => {
    const h = e.h || 2.5, H = h * 2.2, rows = [];
    for (const r of e.rows || []) {
      const cells = [{ w: H, kind: "sym" }];
      const tt = (r.dia ? "Ø" : "") + (r.tol || ""); cells.push({ w: G.textW(tt || " ", h) + h * 1.1 + (r.mod ? h * 1.5 : 0), kind: "tol", tt, mod: r.mod });
      for (const d of (r.datums || []).filter((x) => x && x.d)) cells.push({ w: Math.max(H, G.textW(d.d, h) + h * 1.1 + (d.mod ? h * 1.5 : 0)), kind: "dat", tt: d.d, mod: d.mod });
      rows.push({ r, cells, w: cells.reduce((t, c) => t + c.w, 0) });
    }
    return { h, H, rows, W: Math.max(...rows.map((r) => r.w), 0) };
  };
  K.EXT.fcf = {
    geom(e) {
      const Lo = fcfLayout(e), T = tr(e.p, e.rot), out = [], h = Lo.h, H = Lo.H, rot = e.rot || 0;
      const rect = (x0, y0, x1, y1) => out.push({ t: "pline", closed: true, pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((q) => { const w = T(q); return [w[0], w[1], 0]; }) });
      const add = (list) => { for (const g of list) out.push(K.xform(g, K.M.mul(K.M.move(e.p[0], e.p[1]), K.M.rot([0, 0], rot)))); };
      Lo.rows.forEach((row, i) => {
        const y1 = -i * H, y0 = y1 - H; let x = 0;
        for (const c of row.cells) {
          rect(x, y0, x + c.w, y1);
          const cy = (y0 + y1) / 2;
          if (c.kind === "sym") add(K.gdtSymbol(row.r.sym, [x + c.w / 2, cy], H * 0.8));
          else {
            const tw = G.textW(c.tt, h), tx = x + h * 0.55;
            add([{ t: "text", p: [tx, cy], h, s: c.tt, rot: 0, ha: 0, va: 2 }]);
            if (c.mod) add(circled([tx + tw + h * 0.85, cy], h, c.mod));
          }
          x += c.w;
        }
      });
      return out;
    },
    grips: (e) => [e.p],
  };
  const MODS = [["", "—"], ["M", "Ⓜ max material"], ["L", "Ⓛ least material"], ["S", "Ⓢ regardless (RFS)"], ["F", "Ⓕ free state"], ["P", "Ⓟ projected zone"], ["T", "Ⓣ tangent plane"]];
  const symPreview = (k) => { const d = K.newDoc(false); d.ents = K.gdtSymbol(k, [0, 0], 10).map((g) => Object.assign({ layer: "0" }, g)); return K.toSVG(d, { box: { x0: -6, y0: -6, x1: 6, y1: 6 }, widthMm: 12, heightMm: 12, mono: true }).replace(/width="12mm" height="12mm"/, 'width="30" height="30"'); };
  const fcfDialog = (E, init) => {
    init = init || { h: E.doc.dim.th, rows: [{ sym: "position", dia: true, tol: "0.1", mod: "M", datums: [{ d: "A" }, { d: "B" }, { d: "C" }] }] };
    const r0 = init.rows[0] || {}, r1 = init.rows[1] || null;
    const rowHtml = (r, i) => `<div class="cx-fcr" data-row="${i}"><div class="cx-syms2">${Object.entries(K.GDT).map(([k, v]) => `<button type="button" title="${v.n}" data-sym="${k}" class="${r.sym === k ? "on" : ""}">${symPreview(k)}</button>`).join("")}</div>
      <div class="cx-frm"><label class="cx-chk"><input data-f="dia" type="checkbox"${r.dia ? " checked" : ""}> Ø diameter zone</label><label>Tolerance<input data-f="tol" value="${esc(r.tol || "")}" placeholder="0.05"></label><label>Material condition<select data-f="mod">${MODS.map(([v, n]) => `<option value="${v}"${(r.mod || "") === v ? " selected" : ""}>${n}</option>`).join("")}</select></label></div>
      <div class="cx-frm">${[0, 1, 2].map((k) => { const d = (r.datums || [])[k] || {}; return `<label>Datum ${["primary", "secondary", "tertiary"][k]}<span class="cx-row"><input data-d="${k}" value="${esc(d.d || "")}" maxlength="6" placeholder="${"ABC"[k]}"><select data-dm="${k}">${MODS.slice(0, 4).map(([v, n]) => `<option value="${v}"${(d.mod || "") === v ? " selected" : ""}>${v ? v : "—"}</option>`).join("")}</select></span></label>`; }).join("")}</div></div>`;
    return E.dialog("Geometric tolerance (feature control frame)", `${rowHtml(r0, 0)}<label class="cx-chk"><input id="r2on" type="checkbox"${r1 ? " checked" : ""}> Second (composite) row</label><div id="r2">${rowHtml(r1 || { sym: r0.sym || "position", datums: [] }, 1)}</div><label>Text height<input id="fh" type="number" step="any" value="${init.h}"></label><p class="cx-note">ISO 1101 / ASME Y14.5 symbols. Place the frame after OK; you can add a leader to the feature.</p>`,
      (b) => {
        const read = (el) => ({ sym: (el.querySelector("[data-sym].on") || {}).dataset?.sym || "position", dia: el.querySelector("[data-f=dia]").checked, tol: el.querySelector("[data-f=tol]").value.trim(), mod: el.querySelector("[data-f=mod]").value, datums: [0, 1, 2].map((k) => ({ d: el.querySelector(`[data-d="${k}"]`).value.trim().toUpperCase(), mod: el.querySelector(`[data-dm="${k}"]`).value })).filter((d) => d.d) });
        const rows = [read(b.querySelector('[data-row="0"]'))]; if (b.querySelector("#r2on").checked) rows.push(read(b.querySelector('[data-row="1"]')));
        if (!rows[0].tol) throw new Error("Enter the tolerance value.");
        return { rows, h: +b.querySelector("#fh").value || init.h };
      }, { width: "min(640px,96vw)", init: (b) => { b.querySelectorAll(".cx-syms2").forEach((g) => g.querySelectorAll("[data-sym]").forEach((x) => (x.onclick = () => { g.querySelectorAll("[data-sym]").forEach((y) => y.classList.remove("on")); x.classList.add("on"); }))); const t = () => (b.querySelector("#r2").style.display = b.querySelector("#r2on").checked ? "" : "none"); b.querySelector("#r2on").onchange = t; t(); } });
  };
  cmd("TOLERANCE", { a: ["TOL", "GDT", "FCF"], d: "Geometric tolerance: feature control frame (position, flatness, perpendicularity …) with datums", fn: async (E) => {
    const r = await fcfDialog(E); if (!r) return;
    const mk = (p) => ({ t: "fcf", p, h: r.h, rows: r.rows, rot: 0, layer: K.annoLayer(E) });
    const p = need(await E.getPoint("Enter tolerance location (top-left of the frame):", { preview: (q) => [mk(q)] })); if (!isP(p)) return;
    E.begin("geometric tolerance"); const e = E.add(mk(p));
    const a = await E.getPoint("Specify the leader arrow point on the feature <no leader>:", { base: G.add(p, [0, -fcfLayout(e).H / 2]) });
    if (isP(a)) { const s = G.add(p, [0, -fcfLayout(e).H / 2]), mid = [s[0] - (E.doc.dim.as || 2.5) * 2, s[1]]; E.add({ t: "leader", pts: Math.abs(a[1] - s[1]) < 1e-9 ? [a, s] : [a, mid, s], s: "", layer: e.layer }); }
  } });
  cmd("TOLEDIT", { a: [], d: "Edit a feature control frame", hidden: true, fn: async (E, args) => {
    let e = args && args.id ? E.byId(args.id) : null; if (!e) { const v = need(await E.getEnt("Select a feature control frame:", { filter: (x) => x.t === "fcf" })); e = v.e; }
    const r = await fcfDialog(E, JSON.parse(JSON.stringify(e))); if (r) E.replace(e.id, Object.assign({}, e, r));
  } });
  K.annoLayer = (E) => (E.doc.layers.find((l) => l.name === "Dimensions") && E.cur.layer === "0" ? "Dimensions" : E.cur.layer);

  /* =============================== named dimension styles + tolerances =============================== */
  const TOLT = [["none", "None"], ["sym", "Symmetrical  ±"], ["dev", "Deviation  +/−"], ["lim", "Limits"], ["basic", "Basic (boxed)"]];
  const styleFields = (D) => { const F = (id, label, v, step = "any") => `<label>${label}<input data-k="${id}" type="number" step="${step}" value="${v ?? ""}"></label>`; return `<h4>Lines, arrows and text</h4><div class="cx-frm">${F("th", "Text height", D.th)}${F("as", "Arrow size", D.as)}${F("exo", "Extension offset", D.exo)}${F("exe", "Extend beyond", D.exe)}${F("gap", "Text gap", D.gap)}${F("dli", "Baseline spacing", D.dli)}${F("scale", "Overall scale", D.scale)}<label class="cx-chk"><input data-k="anno" type="checkbox"${D.anno ? " checked" : ""}> Annotative</label></div>
    <h4>Units</h4><div class="cx-frm">${F("dec", "Decimals", D.dec, 1)}${F("adec", "Angle decimals", D.adec, 1)}${F("lfac", "Measurement scale", D.lfac ?? 1)}<label>Prefix<input data-k="pre" value="${esc(D.pre || "")}"></label><label>Suffix<input data-k="sfx" value="${esc(D.sfx || "")}"></label></div>
    <h4>Tolerances</h4><div class="cx-frm"><label>Method<select data-k="tol">${TOLT.map(([k, n]) => `<option value="${k}"${(D.tol || "none") === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>${F("tup", "Upper value", D.tup ?? 0)}${F("tlo", "Lower value", D.tlo ?? 0)}${F("tdec", "Tolerance decimals", D.tdec ?? D.dec, 1)}${F("tfac", "Tolerance text height ×", D.tfac ?? 0.7)}</div>`; };
  const readStyle = (b) => { const o = {}; b.querySelectorAll("[data-k]").forEach((i) => { const k = i.dataset.k; if (i.type === "checkbox") o[k] = i.checked; else if (i.tagName === "SELECT" || k === "pre" || k === "sfx") o[k] = i.value; else if (i.value !== "") { const v = +i.value; if (!isFinite(v) || v < 0) throw new Error("Values cannot be negative."); o[k] = ["dec", "adec", "tdec"].includes(k) ? Math.round(v) : v; } }); if (!(o.scale > 0)) throw new Error("The overall scale must be above zero."); return o; };
  cmd("DIMSTYLE", { a: ["D", "DST", "DDIM", "DIMSTY"], d: "Dimension style manager: named styles with text, arrows, units and tolerances", fn: async (E) => {
    const doc = E.doc; doc.dimstyles = doc.dimstyles || {};
    let sel = doc.dimcur || "Standard";
    for (;;) {
      const names = ["Standard"].concat(Object.keys(doc.dimstyles)), D = sel === "Standard" ? doc.dim : Object.assign({}, doc.dim, doc.dimstyles[sel]);
      const r = await E.dialog("Dimension style manager", `<div class="cx-ds"><div class="cx-dsl">${names.map((n) => `<button type="button" data-n="${esc(n)}" class="${n === sel ? "on" : ""}">${esc(n)}${n === (doc.dimcur || "Standard") ? " ✔" : ""}</button>`).join("")}<div class="cx-pa"><button type="button" class="cx-b o" data-a="new">Add style…</button><button type="button" class="cx-b o" data-a="cur">Set current</button>${sel !== "Standard" ? '<button type="button" class="cx-b o" data-a="del">Remove</button>' : ""}</div></div><div class="cx-dsr"><b>${esc(sel)}</b>${styleFields(D)}</div></div><p class="cx-note">New dimensions use the current style (✔). Changing a style updates every dimension that uses it.</p>`,
        (b) => ({ save: readStyle(b) }), { width: "min(820px,96vw)", ok: "Apply", init: (b) => {
          b.querySelectorAll("[data-n]").forEach((x) => (x.onclick = () => E.closeDlg({ go: x.dataset.n })));
          b.querySelectorAll("[data-a]").forEach((x) => (x.onclick = () => E.closeDlg({ act: x.dataset.a })));
        } });
      if (!r) return;
      if (r.go) { sel = r.go; continue; }
      if (r.act === "cur") { E.tx("current dim style", () => { doc.dimcur = sel; }); E.msg(`"${sel}" is now the current dimension style.`); continue; }
      if (r.act === "del") { if (doc.ents.some((e) => e.sty === sel)) { E.err("This style is used by dimensions in the drawing."); continue; } E.tx("delete dim style", () => { const n = Object.assign({}, doc.dimstyles); delete n[sel]; doc.dimstyles = n; if (doc.dimcur === sel) doc.dimcur = "Standard"; }); sel = "Standard"; continue; }
      if (r.act === "new") { const nm = await E.dialog("Add dimension style", `<label>Name<input id="nn" placeholder="e.g. ISO-25 tolerance"></label><p class="cx-note">Starts as a copy of "${esc(sel)}".</p>`, (b) => { const v = b.querySelector("#nn").value.trim(); if (!v || v === "Standard" || doc.dimstyles[v]) throw new Error("Enter a new, unused name."); return v; }); if (nm) { E.tx("new dim style", () => { doc.dimstyles = Object.assign({}, doc.dimstyles, { [nm]: Object.assign({}, D) }); }); sel = nm; } continue; }
      if (r.save) { E.tx("dimension style", () => { if (sel === "Standard") doc.dim = Object.assign({}, doc.dim, r.save); else doc.dimstyles = Object.assign({}, doc.dimstyles, { [sel]: Object.assign({}, doc.dimstyles[sel], r.save) }); }); return; }
    }
  } });
  /* new dimensions take the current style */
  K.onAdd = K.onAdd || [];
  K.onAdd.push((E, e) => { if (e.t === "dim" && !e.sty && E.doc.dimcur && E.doc.dimcur !== "Standard") e.sty = E.doc.dimcur; });
  cmd("DIMTOL", { a: ["TOLDIM"], d: "Add or change the tolerance of selected dimensions", fn: async (E) => {
    const ids = await E.getSel("Select dimensions:", { filter: (e) => e.t === "dim" }); if (!ids.length) return;
    const e0 = E.byId(ids[0]), t = e0.tol || {};
    const r = await E.dialog("Dimension tolerance", `<div class="cx-frm"><label>Method<select id="tm">${TOLT.map(([k, n]) => `<option value="${k}"${(t.type || "none") === k ? " selected" : ""}>${n}</option>`).join("")}<option value="style">As the dimension style</option></select></label><label>Upper (+)<input id="tu" type="number" step="any" value="${t.up ?? 0}"></label><label>Lower (−)<input id="tl" type="number" step="any" value="${t.lo ?? 0}"></label></div><p class="cx-note">Symmetrical uses the upper value. Deviation shows +upper / −lower stacked. Limits shows the largest and smallest sizes. Basic draws the box used with GD&T.</p>`,
      (b) => ({ type: b.querySelector("#tm").value, up: +b.querySelector("#tu").value || 0, lo: +b.querySelector("#tl").value || 0 }));
    if (!r) return;
    E.tx("dimension tolerance", () => { for (const id of ids) { const e = E.byId(id), n = Object.assign({}, e); if (r.type === "style") delete n.tol; else n.tol = { type: r.type, up: r.up, lo: r.lo }; E.replace(id, n); } });
  } });

  /* =============================== block attributes =============================== */
  cmd("ATTDEF", { a: ["ATT", "DDATTDEF"], d: "Define a block attribute (a tag whose value is asked on insert, e.g. PART-NO)", fn: async (E) => {
    const M = mem(E);
    const r = await E.dialog("Attribute definition", `<div class="cx-frm"><label>Tag<input id="at" value="${esc(M.attTag || "")}" placeholder="PART-NO"></label><label>Prompt<input id="ap" placeholder="Enter the part number"></label><label>Default<input id="ad"></label><label>Text height<input id="ah" type="number" step="any" value="${E.doc.text.h}"></label><label>Justify<select id="aj"><option value="0">Left</option><option value="1">Centre</option><option value="2">Right</option></select></label><label class="cx-chk"><input id="ai" type="checkbox"> Invisible (data only, e.g. for the bill of materials)</label></div>`,
      (b) => { const tag = b.querySelector("#at").value.trim().toUpperCase().replace(/\s+/g, "_"); if (!tag) throw new Error("Enter the tag."); return { tag, prompt: b.querySelector("#ap").value.trim() || tag, def: b.querySelector("#ad").value, h: +b.querySelector("#ah").value || 2.5, ha: +b.querySelector("#aj").value, inv: b.querySelector("#ai").checked }; });
    if (!r) return; M.attTag = r.tag;
    const mk = (p) => ({ t: "attdef", p, h: r.h, tag: r.tag, prompt: r.prompt, def: r.def, rot: 0, ha: r.ha, va: 0, inv: r.inv || undefined });
    const p = need(await E.getPoint("Specify start point:", { preview: (q) => [mk(q)] })); if (isP(p)) E.add(mk(p));
    E.msg("Attribute defined. Include it when you make the block (BLOCK); its value is asked each time the block is inserted.");
  } });
  const attdefsOf = (doc, name) => ((doc.blocks[name] || {}).ents || []).filter((s) => s.t === "attdef");
  K.askAttrs = async (E, ins, title) => {
    const defs = attdefsOf(E.doc, ins.name); if (!defs.length) return ins;
    const cur = ins.attrs || {};
    const r = await E.dialog(title || `Attributes — ${ins.name}`, `<div class="cx-frm">${defs.map((d, i) => `<label>${esc(d.prompt || d.tag)}${d.inv ? " (invisible)" : ""}<input data-i="${i}" value="${esc(cur[d.tag] != null ? cur[d.tag] : d.def || "")}"></label>`).join("")}</div>`, (b) => { const o = {}; defs.forEach((d, i) => (o[d.tag] = b.querySelector(`[data-i="${i}"]`).value)); return o; });
    if (!r) return ins;
    return E.replace(ins.id, Object.assign({}, E.byId(ins.id) || ins, { attrs: r }));
  };
  cmd("ATTEDIT", { a: ["EATTEDIT", "ATE", "DDATTE"], d: "Edit the attribute values of a block reference", fn: async (E, args) => {
    let e = args && args.id ? E.byId(args.id) : null;
    if (!e) { const v = need(await E.getEnt("Select a block reference with attributes:", { filter: (x) => x.t === "insert" && attdefsOf(E.doc, x.name).length })); e = v.e; }
    await K.askAttrs(E, e, `Edit attributes — ${e.name}`);
  } });

  /* =============================== tables =============================== */
  const tableLayout = (e) => { const h = e.h || 2.5, rh = e.rh || h * 2.4, cw = e.cw || [], W = cw.reduce((t, w) => t + w, 0); return { h, rh, cw, W, H: rh * e.rows.length }; };
  K.EXT.table = {
    geom(e) {
      const Lo = tableLayout(e), T = tr(e.p, e.rot), out = [], rot = e.rot || 0, R = e.rows.length, Cn = Lo.cw.length;
      const L = (a, b) => out.push({ t: "line", a: T(a), b: T(b) });
      L([0, 0], [Lo.W, 0]); L([0, -Lo.H], [Lo.W, -Lo.H]); L([0, 0], [0, -Lo.H]); L([Lo.W, 0], [Lo.W, -Lo.H]);
      for (let i = 1; i < R; i++) L([0, -i * Lo.rh], [Lo.W, -i * Lo.rh]);
      let x = 0;
      for (let j = 0; j < Cn - 1; j++) { x += Lo.cw[j]; L([x, e.title ? -Lo.rh : 0], [x, -Lo.H]); }
      e.rows.forEach((row, i) => {
        const cy = -(i + 0.5) * Lo.rh, hdr = (e.title && i === 0) || (e.hdr && i === (e.title ? 1 : 0));
        if (e.title && i === 0) { out.push({ t: "text", p: T([Lo.W / 2, cy]), h: Lo.h * 1.2, s: String(row[0] || ""), rot, ha: 1, va: 2 }); return; }
        let cx = 0;
        row.forEach((cell, j) => {
          const w = Lo.cw[j] || 0, al = hdr ? "c" : (e.al && e.al[j]) || "l", s2 = String(cell == null ? "" : cell);
          if (s2) out.push({ t: "text", p: T([al === "c" ? cx + w / 2 : al === "r" ? cx + w - Lo.h * 0.5 : cx + Lo.h * 0.5, cy]), h: Lo.h, s: s2, rot, ha: al === "c" ? 1 : al === "r" ? 2 : 0, va: 2 });
          cx += w;
        });
      });
      return out;
    },
    xform(e, m, d, n) { n.p = K.M.ap(m, e.p); const k = d.s; n.cw = e.cw.map((w) => w * k); n.rh = (e.rh || e.h * 2.4) * k; n.h = e.h * k; n.rot = d.mir ? e.rot || 0 : (e.rot || 0) + d.phi; return n; },
    grips: (e) => [e.p],
  };
  const tableEditor = (E, t) => {
    const rows = t.rows.map((r) => r.slice()), cw = t.cw.slice();
    const html = () => `<div class="cx-pa"><button type="button" class="cx-b o" data-a="r+">+ Row</button><button type="button" class="cx-b o" data-a="r-">− Row</button><button type="button" class="cx-b o" data-a="c+">+ Column</button><button type="button" class="cx-b o" data-a="c-">− Column</button><label class="cx-chk"><input id="ttl" type="checkbox"${t.title ? " checked" : ""}> First row is a title</label><label class="cx-chk"><input id="thd" type="checkbox"${t.hdr !== false ? " checked" : ""}> Header row</label></div>
      <div class="cx-tgrid"><table><tr>${cw.map((w, j) => `<th><input data-w="${j}" type="number" step="any" value="${K.fmt(w, 2)}" title="Column width"></th>`).join("")}</tr>${rows.map((r, i) => `<tr>${cw.map((_, j) => `<td><input data-c="${i},${j}" value="${esc(r[j] == null ? "" : r[j])}"></td>`).join("")}</tr>`).join("")}</table></div>
      <details><summary>Paste copied cells</summary><textarea id="tpaste" rows="4" style="width:100%" placeholder="Copy cells in your spreadsheet and paste here (tab or comma separated), then click Fill"></textarea><button type="button" class="cx-b o" data-a="paste">Fill the table</button></details>`;
    const sync = (b) => { b.querySelectorAll("[data-c]").forEach((i) => { const [r, c] = i.dataset.c.split(",").map(Number); rows[r][c] = i.value; }); b.querySelectorAll("[data-w]").forEach((i) => (cw[+i.dataset.w] = Math.max(1e-3, +i.value || cw[+i.dataset.w]))); t.title = b.querySelector("#ttl").checked; t.hdr = b.querySelector("#thd").checked; };
    const bind = (b) => b.querySelectorAll("[data-a]").forEach((x) => (x.onclick = () => {
      sync(b); const a = x.dataset.a, avg = cw.reduce((s, w) => s + w, 0) / cw.length;
      if (a === "r+") rows.push(cw.map(() => "")); if (a === "r-" && rows.length > 1) rows.pop();
      if (a === "c+") { cw.push(avg); rows.forEach((r) => r.push("")); } if (a === "c-" && cw.length > 1) { cw.pop(); rows.forEach((r) => r.pop()); }
      if (a === "paste") { const lines = b.querySelector("#tpaste").value.replace(/\r/g, "").split("\n").filter((l) => l.length); const data = lines.map((l) => l.split(l.includes("\t") ? "\t" : ",")); const nc = Math.max(cw.length, ...data.map((r) => r.length)); while (cw.length < nc) cw.push(avg); rows.length = 0; for (const r of data) rows.push(Array.from({ length: nc }, (_, j) => (r[j] || "").trim())); }
      b.querySelector(".cx-db").innerHTML = html(); bind(b);
    }));
    return E.dialog("Table", html(), (b) => { sync(b); return { rows: rows.map((r) => r.map((c) => K.sym(c))), cw: cw.slice(), title: t.title, hdr: t.hdr }; }, { width: "min(900px,96vw)", init: (b) => bind(b.closest(".cx-dlg")) });
  };
  cmd("TABLE", { a: ["TBL"], d: "Insert a table (rows × columns), fill it like a spreadsheet or paste from Excel", fn: async (E) => {
    const M = mem(E);
    const r = await E.dialog("Insert table", `<div class="cx-frm"><label>Rows<input id="tr" type="number" min="1" value="${M.tr || 5}"></label><label>Columns<input id="tc" type="number" min="1" value="${M.tc || 4}"></label><label>Column width<input id="tw" type="number" step="any" value="${M.tw || 30}"></label><label>Text height<input id="th" type="number" step="any" value="${E.doc.text.h}"></label><label class="cx-chk"><input id="tt" type="checkbox" checked> Title row</label></div>`, (b) => ({ R: Math.max(1, +b.querySelector("#tr").value | 0), C: Math.max(1, +b.querySelector("#tc").value | 0), w: +b.querySelector("#tw").value || 30, h: +b.querySelector("#th").value || 2.5, title: b.querySelector("#tt").checked }));
    if (!r) return; Object.assign(M, { tr: r.R, tc: r.C, tw: r.w });
    const rows = Array.from({ length: r.R + (r.title ? 1 : 0) }, (_, i) => Array.from({ length: r.C }, (_, j) => (r.title && i === 0 && j === 0 ? "TITLE" : "")));
    const mk = (p) => ({ t: "table", p, rows, cw: Array(r.C).fill(r.w), h: r.h, rh: r.h * 2.4, title: r.title, hdr: true, rot: 0 });
    const p = need(await E.getPoint("Specify insertion point (top-left):", { preview: (q) => [mk(q)] })); if (!isP(p)) return;
    const e = E.add(mk(p)); const ed = await tableEditor(E, e); if (ed) E.replace(e.id, Object.assign({}, E.byId(e.id), ed));
  } });
  cmd("TABLEDIT", { a: ["TED"], d: "Edit the cells of a table", fn: async (E, args) => {
    let e = args && args.id ? E.byId(args.id) : null; if (!e) { const v = need(await E.getEnt("Select a table:", { filter: (x) => x.t === "table" })); e = v.e; }
    const ed = await tableEditor(E, JSON.parse(JSON.stringify(e))); if (ed) E.replace(e.id, Object.assign({}, e, ed));
  } });
  cmd("BOM", { a: ["DATAEXTRACTION", "DX", "PARTSLIST"], d: "Bill of materials / parts list: count blocks (and their attributes) into a table", fn: async (E) => {
    E.msg("Select the block references to list (All = whole drawing).", "mu");
    const ids = await E.getSel("Select block references:", { filter: (e) => e.t === "insert" && !/^SHEET-/.test(e.name) }); if (!ids.length) return;
    const val = (e) => { const o = {}; for (const d of attdefsOf(E.doc, e.name)) o[d.tag] = e.attrs && e.attrs[d.tag] != null ? e.attrs[d.tag] : d.def || ""; return Object.assign(o, e.attrs || {}); };
    const ents = ids.map((id) => Object.assign({}, E.byId(id), { attrs: val(E.byId(id)) })), tags = []; ents.forEach((e) => Object.keys(e.attrs || {}).forEach((k) => { if (!tags.includes(k)) tags.push(k); }));
    const grp = new Map(); for (const e of ents) { const k = e.name + "|" + tags.map((t) => (e.attrs || {})[t] || "").join("|"); const g = grp.get(k) || { name: e.name, attrs: e.attrs || {}, n: 0 }; g.n++; grp.set(k, g); }
    const list = Array.from(grp.values()).sort((a, b) => a.name.localeCompare(b.name));
    const head = ["ITEM", "BLOCK"].concat(tags).concat(["QTY"]), rows = [["PARTS LIST"], head].concat(list.map((g, i) => [String(i + 1), g.name].concat(tags.map((t) => g.attrs[t] || "")).concat([String(g.n)])));
    rows[0] = [rows[0][0]].concat(Array(head.length - 1).fill(""));
    const h = E.doc.text.h, cw = head.map((c, j) => Math.max(h * 5, ...rows.slice(1).map((r) => G.textW(String(r[j] || ""), h) + h * 1.5)));
    const mk = (p) => ({ t: "table", p, rows, cw, h, rh: h * 2.4, title: true, hdr: true, al: head.map((c, j) => (j === 0 || c === "QTY" ? "c" : "l")), rot: 0 });
    const p = need(await E.getPoint("Specify insertion point of the parts list (top-left):", { preview: (q) => [mk(q)] })); if (isP(p)) E.add(mk(p));
    E.msg(`${list.length} line(s), ${ents.length} item(s) counted.`);
  } });
  cmd("BALLOON", { a: ["BL", "BALLOONS"], d: "Item balloons (numbered circles with leaders) for assembly drawings", fn: async (E) => {
    const M = mem(E); let n = M.balloon || 1; E.begin("balloon");
    for (;;) {
      const a = await E.getPoint(`Specify arrow point for balloon ${n} or [Number] <finish>:`, { kws: ["Number"] }); if (a == null) break;
      if (a.kw) { const v = await E.getText("Enter the next balloon number / text:", { dflt: String(n) }); if (v) n = isNaN(+v) ? v : +v; continue; }
      const h = E.doc.dim.th * (E.doc.dim.scale || 1), mk = (q) => ({ t: "leader", style: "balloon", pts: [a, q], s: String(n), h, layer: K.annoLayer(E) });
      const q = await E.getPoint("Specify balloon position:", { base: a, preview: (p) => [mk(p)] }); if (!isP(q)) break;
      E.add(mk(q)); n = typeof n === "number" ? n + 1 : n; M.balloon = n;
    }
  } });

  /* =============================== groups, quick select, draw order =============================== */
  cmd("GROUP", { a: ["G"], d: "Group objects so they select together (GROUP / UNGROUP)", fn: async (E) => {
    const ids = await E.getSel("Select objects to group:"); if (ids.length < 2) return E.msg("Select two or more objects.");
    let k = 1; const used = new Set(E.doc.ents.map((e) => e.grp).filter(Boolean)); while (used.has("*A" + k)) k++;
    const nm = (await E.getText(`Enter a group name <*A${k}>:`, { dflt: "*A" + k })) || "*A" + k;
    E.tx("group", () => ids.forEach((id) => E.replace(id, Object.assign({}, E.byId(id), { grp: nm })))); E.msg(`Group "${nm}" created with ${ids.length} objects.`);
  } });
  cmd("UNGROUP", { a: ["UG"], d: "Remove the group of the selected objects", fn: async (E) => {
    const ids = await E.getSel("Select a group:"); const g = new Set(ids.map((id) => E.byId(id).grp).filter(Boolean)); if (!g.size) return E.msg("No group selected.");
    E.tx("ungroup", () => E.doc.ents.forEach((e) => { if (g.has(e.grp)) { const n = Object.assign({}, e); delete n.grp; E.replace(e.id, n); } })); E.msg(`${g.size} group(s) removed.`);
  } });
  const QPROP = [["layer", "Layer"], ["color", "Colour"], ["lt", "Linetype"], ["name", "Block name"], ["text", "Text contains"], ["r", "Radius"], ["len", "Length"], ["h", "Text height"], ["grp", "Group"]];
  const qval = (e, k) => {
    if (k === "text") return [e.s, e.txt, e.tag, ...(e.rows ? e.rows.flat() : []), ...Object.values(e.attrs || {})].filter(Boolean).join(" ");
    if (k === "len") { const P = K.path(e); return P ? K.pathLen(P) : null; }
    if (k === "color") return e.color || "ByLayer"; if (k === "lt") return e.lt || "ByLayer";
    return e[k];
  };
  cmd("QSELECT", { a: ["QS"], d: "Quick select: pick objects by type and property (layer, colour, radius, text …)", keepSel: true, fn: async (E) => {
    const types = Array.from(new Set(E.doc.ents.map((e) => e.t))).sort();
    const r = await E.dialog("Quick select", `<div class="cx-frm"><label>Apply to<select id="qa"><option value="all">Whole drawing</option>${E.sel.length ? '<option value="sel">Current selection</option>' : ""}</select></label><label>Object type<select id="qt"><option value="">Any</option>${types.map((t) => `<option value="${t}">${esc(K.typeName({ t, kind: "lin" }))}</option>`).join("")}</select></label>
      <label>Property<select id="qp">${QPROP.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label><label>Operator<select id="qo"><option value="eq">=  equals</option><option value="ne">≠  not equal</option><option value="gt">&gt;  greater</option><option value="lt">&lt;  less</option><option value="has">contains</option><option value="any">* any value</option></select></label><label>Value<input id="qv" list="qvl"><datalist id="qvl">${E.doc.layers.map((l) => `<option value="${esc(l.name)}">`).join("")}</datalist></label>
      <label>How<select id="qh"><option value="in">Include in new selection</option><option value="out">Exclude from new selection</option></select></label></div>`,
      (b) => ({ a: b.querySelector("#qa").value, t: b.querySelector("#qt").value, p: b.querySelector("#qp").value, o: b.querySelector("#qo").value, v: b.querySelector("#qv").value, h: b.querySelector("#qh").value }));
    if (!r) return;
    const base = r.a === "sel" ? E.sel.map((id) => E.byId(id)).filter(Boolean) : E.doc.ents.filter((e) => E.editable(e));
    const test = (e) => { if (r.t && e.t !== r.t) return false; const v = qval(e, r.p); if (r.o === "any") return v != null && v !== ""; if (v == null) return false; const n = +r.v, isN = r.v !== "" && isFinite(n) && typeof v === "number";
      if (r.o === "eq") return isN ? Math.abs(v - n) < 1e-6 : String(v).toLowerCase() === r.v.toLowerCase(); if (r.o === "ne") return isN ? Math.abs(v - n) >= 1e-6 : String(v).toLowerCase() !== r.v.toLowerCase();
      if (r.o === "gt") return +v > n; if (r.o === "lt") return +v < n; if (r.o === "has") return String(v).toLowerCase().includes(r.v.toLowerCase()); return false; };
    E.sel = base.filter((e) => (r.h === "in" ? test(e) : !test(e))).map((e) => e.id); E.msg(E.sel.length + " object(s) selected."); E.drawOverlay(); E.refreshSide();
  } });
  const reorder = (E, ids, where, ref) => {
    const s = new Set(ids), moving = E.doc.ents.filter((e) => s.has(e.id)), rest = E.doc.ents.filter((e) => !s.has(e.id));
    let out;
    if (where === "front") out = rest.concat(moving); else if (where === "back") out = moving.concat(rest);
    else { const rs = new Set(ref); const idxs = rest.map((e, i) => (rs.has(e.id) ? i : -1)).filter((i) => i >= 0); if (!idxs.length) return; const at = where === "above" ? Math.max(...idxs) + 1 : Math.min(...idxs); out = rest.slice(0, at).concat(moving, rest.slice(at)); }
    E.tx("draw order", () => { E.doc.ents = out; });
  };
  cmd("DRAWORDER", { a: ["DR"], d: "Draw order: bring objects to front / send to back / above / under others", fn: async (E) => {
    const ids = await E.getSel(); if (!ids.length) return;
    const k = await E.getKw("Enter object ordering option [Above objects/Under objects/Front/Back] <Back>:", ["Above objects", "Under objects", "Front", "Back"], "Back"); if (k === null) return;
    const w = k && k.kw ? k.kw : "Back";
    if (w === "Front" || w === "Back") return reorder(E, ids, w.toLowerCase());
    const ref = await E.getSel("Select reference objects:", { fresh: true }); if (ref.length) reorder(E, ids, w.startsWith("Above") ? "above" : "under", ref);
  } });
  cmd("TEXTTOFRONT", { a: [], d: "Bring all text and dimensions to the front", fn: async (E) => reorder(E, E.doc.ents.filter((e) => ["text", "mtext", "dim", "leader", "table", "fcf"].includes(e.t)).map((e) => e.id), "front") });
  cmd("HATCHTOBACK", { a: [], d: "Send all hatches to the back", fn: async (E) => reorder(E, E.doc.ents.filter((e) => e.t === "hatch").map((e) => e.id), "back") });

  /* =============================== revision cloud, centre marks, quick dimension, find =============================== */
  const cloudPts = (loop, arc) => {
    loop = G.area(loop) < 0 ? loop.slice().reverse() : loop.slice(); const pts = [];
    for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length], L = G.dist(a, b), n = Math.max(1, Math.round(L / arc)); for (let k = 0; k < n; k++) { const q = G.lerp(a, b, k / n); pts.push([q[0], q[1], 0.55]); } }
    return pts;
  };
  cmd("REVCLOUD", { a: ["RC"], d: "Revision cloud around changed areas (rectangular, polygonal or around an object)", fn: async (E) => {
    const M = mem(E); M.rcArc = M.rcArc || Math.max(2, (E.doc.text.h || 2.5) * 3);
    for (;;) {
      const v = await E.getPoint(pr2(`Specify first corner (arc length ${f(M.rcArc, E)})`, ["Arc length", "Polygonal", "Object"]), { kws: ["Arc length", "Polygonal", "Object"] }); if (v == null) return;
      if (v.kw === "Arc length") { const a = await E.getDist("Specify approximate arc length", { dflt: f(M.rcArc, E) }); if (a > 0) M.rcArc = a; continue; }
      let loop;
      if (v.kw === "Object") { const s = need(await E.getEnt("Select a closed object:", { filter: (e) => !!G.outline(e) })); loop = G.outline(s.e, M.rcArc / 6); if (s.e.t === "pline" && !s.e.pts.some((p) => p[2])) loop = s.e.pts.map((p) => [p[0], p[1]]); }
      else if (v.kw === "Polygonal") { loop = [need(await E.getPoint("Specify start point:"))]; for (;;) { const q = await E.getPoint("Specify next point <close>:", { base: loop[loop.length - 1], preview: (p) => [{ t: "pline", closed: true, pts: cloudPts(loop.concat([p]), M.rcArc) }] }); if (!isP(q)) break; loop.push(q); } if (loop.length < 3) return; }
      else { const b = need(await E.getPoint("Specify opposite corner:", { base: v, noRubber: true, preview: (q) => [{ t: "pline", closed: true, pts: cloudPts([v, [q[0], v[1]], q, [v[0], q[1]]], M.rcArc) }] })); loop = [v, [b[0], v[1]], b, [v[0], b[1]]]; }
      E.add({ t: "pline", closed: true, pts: cloudPts(loop, M.rcArc) }); return;
    }
  } });
  const pr2 = (m, k) => m + " [" + k.join("/") + "]:";
  const centreLayer = (E) => (E.doc.layers.find((l) => l.name === "Centre") ? "Centre" : E.cur.layer);
  cmd("CENTERMARK", { a: ["CM", "CENTREMARK"], d: "Centre mark and centre lines on circles and arcs", fn: async (E) => {
    E.begin("centre mark"); let k = 1; const used = new Set(E.doc.ents.map((e) => e.grp));
    for (;;) {
      const v = await E.getEnt("Select circle or arc to add centre mark:", { filter: (e) => e.t === "circle" || e.t === "arc" }); if (!v) break;
      const c = v.e.c, r = v.e.r, x = r + Math.max(2.5, r * 0.15); while (used.has("*CM" + k)) k++; const g = "*CM" + k; used.add(g);
      E.add({ t: "line", a: [c[0] - x, c[1]], b: [c[0] + x, c[1]], layer: centreLayer(E), lt: "CENTER", grp: g }); E.add({ t: "line", a: [c[0], c[1] - x], b: [c[0], c[1] + x], layer: centreLayer(E), lt: "CENTER", grp: g });
    }
  } });
  cmd("CENTERLINE", { a: ["CL", "CENTRELINE"], d: "Centre line between two lines", fn: async (E) => {
    const a = need(await E.getEnt("Select first line:", { filter: (e) => e.t === "line" })); const b = need(await E.getEnt("Select second line:", { filter: (e) => e.t === "line" }));
    let A = a.e, B = b.e; if (G.dot(G.sub(A.b, A.a), G.sub(B.b, B.a)) < 0) B = Object.assign({}, B, { a: B.b, b: B.a });
    const s = G.mid(A.a, B.a), t = G.mid(A.b, B.b), u = G.unit(G.sub(t, s)), x = 2.5; E.add({ t: "line", a: G.sub(s, G.mul(u, x)), b: G.add(t, G.mul(u, x)), layer: centreLayer(E), lt: "CENTER" });
  } });
  cmd("QDIM", { a: ["QD"], d: "Quick dimension: a chain of dimensions to every endpoint of the selected objects", fn: async (E) => {
    const ids = await E.getSel("Select geometry to dimension:"); if (!ids.length) return;
    const pts = []; for (const id of ids) { const e = E.byId(id); for (const s of G.prims(e)) { if (s.k === "s") pts.push(s.a, s.b); else { pts.push(s.c); if (!s.full) pts.push(...G.primEnds(s)); } } }
    if (pts.length < 2) return E.msg("Nothing to dimension.");
    const bb = G.bounds(pts); let mode = "Continuous";
    for (;;) {
      const mk = (q) => {
        const hor = Math.abs(q[1] - (bb.y0 + bb.y1) / 2) - (bb.y1 - bb.y0) / 2 > Math.abs(q[0] - (bb.x0 + bb.x1) / 2) - (bb.x1 - bb.x0) / 2, k = hor ? 0 : 1, out = [];
        const u = []; for (const p of pts.slice().sort((a, b) => a[k] - b[k])) if (!u.length || p[k] - u[u.length - 1][k] > 1e-6) u.push(p);
        const step = (E.doc.dim.dli || 7) * (E.doc.dim.scale || 1), sg = hor ? (q[1] > bb.y1 ? 1 : -1) : q[0] > bb.x1 ? 1 : -1;
        for (let i = 1; i < u.length; i++) { const p1 = mode === "Baseline" ? u[0] : u[i - 1], loc = hor ? [0, q[1] + (mode === "Baseline" ? (i - 1) * step * sg : 0)] : [q[0] + (mode === "Baseline" ? (i - 1) * step * sg : 0), 0]; out.push({ t: "dim", kind: "lin", dir: hor ? "h" : "v", p1, p2: u[i], loc: hor ? [(p1[0] + u[i][0]) / 2, loc[1]] : [loc[0], (p1[1] + u[i][1]) / 2], layer: K.annoLayer(E) }); }
        return out;
      };
      const q = await E.getPoint(pr2(`Specify dimension line position (${mode})`, ["Continuous", "Baseline"]), { kws: ["Continuous", "Baseline"], preview: mk }); if (q == null) return;
      if (q.kw) { mode = q.kw; continue; }
      const ds = mk(q); E.tx("quick dimension", () => ds.forEach((d) => E.add(d))); E.msg(ds.length + " dimension(s) created."); return;
    }
  } });
  cmd("FIND", { a: ["FINDREPLACE"], d: "Find and replace text in text, notes, dimensions, tables, balloons and attributes", keepSel: true, fn: async (E) => {
    const r = await E.dialog("Find and replace", `<div class="cx-frm"><label>Find<input id="ff"></label><label>Replace with<input id="fr"></label><label class="cx-chk"><input id="fc" type="checkbox"> Match case</label><label class="cx-chk"><input id="fw" type="checkbox"> Whole words</label></div><p class="cx-note">Leave “Replace with” empty and press “Find” to only select the objects that contain the text.</p><div class="cx-pa"><button type="button" class="cx-b o" data-a="find">Find (select)</button></div>`,
      (b) => ({ f: b.querySelector("#ff").value, r: b.querySelector("#fr").value, c: b.querySelector("#fc").checked, w: b.querySelector("#fw").checked, replace: true }), { ok: "Replace all", init: (b) => (b.querySelector("[data-a=find]").onclick = () => E.closeDlg({ f: b.querySelector("#ff").value, c: b.querySelector("#fc").checked, w: b.querySelector("#fw").checked, replace: false })) });
    if (!r || !r.f) return;
    const re = new RegExp((r.w ? "\\b" : "") + r.f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (r.w ? "\\b" : ""), r.c ? "g" : "gi");
    const sub = (s) => (s == null ? s : String(s).replace(re, r.r));
    const hits = E.doc.ents.filter((e) => re.test(qval(e, "text") || "") && ((re.lastIndex = 0), true));
    if (!r.replace) { E.sel = hits.map((e) => e.id); E.msg(hits.length + " object(s) contain “" + r.f + "”."); E.drawOverlay(); E.refreshSide(); return; }
    let n = 0;
    E.tx("replace text", () => { for (const e of hits) { if (!E.editable(e)) continue; const x = JSON.parse(JSON.stringify(e)); if (x.s != null) x.s = sub(x.s); if (x.txt) x.txt = sub(x.txt); if (x.rows) x.rows = x.rows.map((row) => row.map(sub)); if (x.attrs) for (const k of Object.keys(x.attrs)) x.attrs[k] = sub(x.attrs[k]); if (x.t === "attdef") { x.def = sub(x.def); } E.replace(e.id, x); n++; } });
    E.msg(`Replaced in ${n} object(s).`);
  } });

  /* =============================== ribbon additions =============================== */
  const tab = (t) => K.RIBBON.find((r) => r.t === t);
  tab("Annotate").g.splice(2, 0, { n: "GD&T & tolerances", b: [["TOLERANCE", "GD&T frame", "dimstyle"], ["DIMTOL", "Dim tolerance", "dimlin"], ["QDIM", "Quick dim", "dimlin"], ["CENTERMARK", "Centre mark", "circle"], ["CENTERLINE", "Centre line", "xline"]] });
  tab("Annotate").g.splice(3, 0, { n: "Tables & balloons", b: [["TABLE", "Table", "array"], ["BOM", "Parts list", "list"], ["BALLOON", "Balloon", "leader"], ["REVCLOUD", "Rev cloud", "spline"], ["FIND", "Find / replace", "text"]] });
  tab("Insert").g.splice(1, 0, { n: "Attributes", b: [["ATTDEF", "Define attribute", "text"], ["ATTEDIT", "Edit attributes", "props"]] });
  tab("Home").g.find((g) => g.n === "Utilities").b.push(["QSELECT", "Quick select", "sel"], ["GROUP", "Group", "block"], ["DRAWORDER", "Draw order", "copy"]);
})((window.KCAD = window.KCAD || {}));
