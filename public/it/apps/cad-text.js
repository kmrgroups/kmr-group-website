/* KMR CAD Draft — in-place text editor, the way AutoCAD does it.
   TEXT  : click where the text starts, type on the drawing, Enter = next line, Enter on an empty line = finish.
   MTEXT : click two corners of a box, type inside the box. A formatting bar sits above the drawing:
           font, height, Bold / Italic / Underline, justify, box width, rotation, symbols, import a .txt file.
   Draw a box: its height becomes the text size (untick "Height = box height" to type a size instead). Close the editor with the "Close Text Editor" button, Ctrl+Enter, Esc, or a click anywhere outside the box. "Cancel" throws the change away.
   Double-click any text on the drawing to edit it in the same way. Font, bold, italic and underline are stored on the text itself. */
(function (K) {
  "use strict";
  const G = K.geom, cmd = K.cmd, esc = K.esc, D2R = Math.PI / 180;
  const FONTS = ["Arial", "Times New Roman", "Courier New", "Calibri", "Verdana", "Tahoma", "Georgia", "Consolas"];
  const JL = ["Top left", "Top centre", "Top right", "Middle left", "Middle centre", "Middle right", "Bottom left", "Bottom centre", "Bottom right"];
  const SYMS = [["Degrees  °", "°"], ["Plus/Minus  ±", "±"], ["Diameter  Ø", "Ø"], ["Squared  ²", "²"], ["Cubed  ³", "³"], ["Micro  µ", "µ"], ["Almost equal  ≈", "≈"], ["Not equal  ≠", "≠"], ["Delta  Δ", "Δ"], ["Omega  Ω", "Ω"], ["Ohm  Ω", "Ω"], ["Triangle  ▽", "▽"]];
  const mem = { fnt: "Arial", b: false, i: false, u: false, ap: 1, ha: 0, rot: 0, h: null };
  const isP = (p) => Array.isArray(p) && typeof p[0] === "number";
  const defH = (E) => { const h = E.doc.text.h || 2.5; return +(E.doc.dim.auto !== false && K.autoDimK ? h * K.autoDimK(E.doc) : h).toPrecision(6); };

  /** box of an existing mtext/text in world units (rotation is ignored while editing) */
  const boxOfEnt = (e) => {
    if (e.t === "text") { const w = Math.max(G.textW(e.s, e.h), e.h * 3), x0 = e.ha === 1 ? e.p[0] - w / 2 : e.ha === 2 ? e.p[0] - w : e.p[0]; return { x0, x1: x0 + w, y1: e.p[1] + e.h * 1.05, y0: e.p[1] - e.h * 0.25 }; }
    const lines = K.wrap(e.s, e.h, e.w), ap = e.ap || 1, col = (ap - 1) % 3, row = Math.floor((ap - 1) / 3), ls = e.h * 1.667, H = (lines.length - 1) * ls + e.h;
    const w = e.w || Math.max(...lines.map((l) => G.textW(l, e.h)), e.h * 3), x0 = col === 0 ? e.p[0] : col === 1 ? e.p[0] - w / 2 : e.p[0] - w, y1 = row === 0 ? e.p[1] : row === 1 ? e.p[1] + H / 2 : e.p[1] + H;
    return { x0, x1: x0 + w, y1, y0: y1 - H };
  };
  const anchor = (b, ap) => { const col = (ap - 1) % 3, row = Math.floor((ap - 1) / 3); return [col === 0 ? b.x0 : col === 1 ? (b.x0 + b.x1) / 2 : b.x1, row === 0 ? b.y1 : row === 1 ? (b.y0 + b.y1) / 2 : b.y0]; };

  /** the editor. o = { single, box:{x0,x1,y1,y0}, s, h, fnt, b, i, u, ap, rot, ha, keepBox } → resolves to the result or null */
  const edit = (E, o) => new Promise((done) => {
    const cw = document.querySelector(".cx-cw"); if (!cw) return done(null);
    const boxH = Math.max(0, o.box.y1 - o.box.y0), st = { fit: !!o.fit && boxH > 1e-6, h: o.h, fnt: o.fnt, b: !!o.b, i: !!o.i, u: !!o.u, ap: o.ap || 1, rot: o.rot || 0, ha: o.ha || 0, w: o.single ? 0 : Math.max(o.box.x1 - o.box.x0, o.h) };
    const bg = typeof E.bg === "function" ? E.bg() : "#1e2833", fg = typeof E.fg === "function" ? E.fg() : "#ffffff";
    const fitH = () => {
      if (!st.fit) return;
      let h = boxH, n = 1;
      for (let k = 0; k < 8; k++) { const t = typeof ta !== "undefined" && ta ? ta.value : (o.s || ""), lines = o.single ? [t.split("\n")[0]] : K.wrap(t, h, st.w || 0), m = Math.max(1, lines.length); if (m === n && k) break; n = m; h = boxH / (1 + (n - 1) * 1.667); }
      st.h = +h.toPrecision(5);
      const f = bar.querySelector('[data-f="h"]'); if (f) f.value = st.h;
    };
    const sc = E.view.s, scr = E.w2s([o.box.x0, o.box.y1]);
    const wrap = document.createElement("div"); wrap.className = "cx-te"; wrap.style.cssText = "position:absolute;inset:0;z-index:40";
    const catcher = document.createElement("div"); catcher.style.cssText = "position:absolute;inset:0;background:transparent;cursor:default";
    const bar = document.createElement("div"); bar.className = "cx-te-bar";
    bar.style.cssText = "position:absolute;left:0;right:0;top:0;z-index:43;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;background:#10213f;border-bottom:2px solid #3b82f6;color:#e5edff;font:12px system-ui,sans-serif";
    const inpCss = "background:#1b2a4a;color:#fff;border:1px solid #3b5385;border-radius:6px;padding:4px 6px;font:12px system-ui,sans-serif";
    const tgl = (k, lab, sty) => `<button type="button" data-t="${k}" title="${lab}" style="${inpCss};width:30px;cursor:pointer;${sty}">${lab[0]}</button>`;
    bar.innerHTML = `<b style="color:#93c5fd;margin-right:4px">${o.single ? "Text" : "Multiline text"}</b>
      <label>Font <select data-f="fnt" style="${inpCss}">${FONTS.map((f) => `<option${f === st.fnt ? " selected" : ""}>${f}</option>`).join("")}</select></label>
      <label>Height <input data-f="h" type="number" step="any" min="0" value="${st.h}" style="${inpCss};width:70px"></label>${boxH > 1e-6 ? `<label title="The text size follows the height of the box you drew"><input type="checkbox" data-fit${st.fit ? " checked" : ""}> Height = box height</label>` : ""}
      ${tgl("b", "Bold", "font-weight:700")}${tgl("i", "Italic", "font-style:italic")}${tgl("u", "Underline", "text-decoration:underline")}
      <label>Justify <select data-f="ap" style="${inpCss}">${(o.single ? ["Left", "Centre", "Right"] : JL).map((n, k) => `<option value="${k + 1}"${(o.single ? st.ha + 1 : st.ap) === k + 1 ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      ${o.single ? "" : `<label>Box width <input data-f="w" type="number" step="any" min="0" value="${+st.w.toFixed(3)}" style="${inpCss};width:76px"></label>`}
      <label>Rotation <input data-f="rot" type="number" step="any" value="${+(st.rot / D2R).toFixed(3)}" style="${inpCss};width:62px">°</label>
      <label>Symbol <select data-f="sym" style="${inpCss}"><option value="">Insert…</option>${SYMS.filter((x, k) => k !== 10).map((x) => `<option value="${x[1]}">${x[0]}</option>`).join("")}</select></label>
      ${o.single ? "" : `<button type="button" data-imp style="${inpCss};cursor:pointer">Import text file…</button><input type="file" accept=".txt,text/plain" data-impf hidden>`}
      <span style="flex:1"></span>
      <button type="button" data-ok style="${inpCss};background:#2563eb;border-color:#60a5fa;font-weight:700;cursor:pointer">✓ Close Text Editor</button>
      <button type="button" data-cx style="${inpCss};cursor:pointer">Cancel</button>`;
    const fieldCss = () => {
      fitH();
      const px = Math.max(13, st.h * sc / 0.716), align = o.single ? ["left", "center", "right"][st.ha] : ["left", "center", "right"][(st.ap - 1) % 3];
      ta.style.font = `${st.i ? "italic " : ""}${st.b ? "bold " : ""}${px}px "${st.fnt}", Arial, sans-serif`; ta.style.lineHeight = "1.667"; ta.style.textDecoration = st.u ? "underline" : "none"; ta.style.textAlign = align;
      const w = o.single ? Math.max(180, ta.value.length * px * 0.62 + 24) : Math.max(120, st.w * sc || 260); ta.style.width = w + "px";
      ta.style.height = "auto"; ta.style.height = Math.max(px * 1.667 + 4, ta.scrollHeight + 2, st.fit ? boxH * sc : 0) + "px";
      grip.style.left = (ta.offsetLeft + w - 6) + "px"; grip.style.top = ta.offsetTop + "px"; grip.style.height = ta.style.height;
    };
    const ta = document.createElement("textarea"); ta.value = o.s || ""; ta.spellcheck = false; ta.rows = 1; ta.wrap = "soft";
    const top0 = Math.max(46, scr[1] - (o.single && !o.boxed ? Math.max(13, st.h * sc / 0.716) * 0.82 : 0));
    ta.style.cssText = `position:absolute;z-index:42;left:${Math.max(4, scr[0])}px;top:${top0}px;margin:0;padding:2px 4px;resize:none;overflow:hidden;background:${bg};color:${fg};border:1px dashed #60a5fa;outline:2px solid #3b82f633;box-sizing:border-box;white-space:pre-wrap`;
    const grip = document.createElement("div"); grip.title = "Drag to change the box width"; grip.style.cssText = "position:absolute;z-index:44;width:12px;cursor:ew-resize;background:linear-gradient(90deg,transparent 4px,#60a5fa 4px,#60a5fa 8px,transparent 8px)";
    if (o.single) grip.style.display = "none";
    wrap.append(catcher, ta, grip, bar); cw.appendChild(wrap);
    const sync = () => { bar.querySelectorAll("[data-t]").forEach((b) => { const on = st[b.dataset.t]; b.style.background = on ? "#2563eb" : "#1b2a4a"; b.style.borderColor = on ? "#60a5fa" : "#3b5385"; }); fieldCss(); };
    let closed = false;
    const finish = (ok) => {
      if (closed) return; closed = true; wrap.remove(); E.canvasFocus && E.canvasFocus();
      const s = ta.value.replace(/\s+$/, "");
      if (!ok || !s.trim()) return done(ok && o.allowEmpty ? { s: "" } : null);
      done(Object.assign({}, st, { s: K.sym(s) }));
    };
    bar.addEventListener("input", (ev) => { const t = ev.target, k = t.dataset && t.dataset.f; if (!k) return;
      if (k === "fnt") st.fnt = t.value; else if (k === "h") { st.h = +t.value > 0 ? +t.value : st.h; st.fit = false; const c = bar.querySelector("[data-fit]"); if (c) c.checked = false; } else if (k === "w") st.w = Math.max(0, +t.value || 0);
      else if (k === "rot") st.rot = (+t.value || 0) * D2R; else if (k === "ap") { if (o.single) st.ha = +t.value - 1; else st.ap = +t.value; } sync(); });
    bar.addEventListener("change", (ev) => { const t = ev.target; if (t.dataset && t.dataset.fit !== undefined) { st.fit = t.checked; sync(); ta.focus(); return; } if (t.dataset && t.dataset.f === "sym" && t.value) { const i = ta.selectionStart; ta.value = ta.value.slice(0, i) + t.value + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = i + t.value.length; t.value = ""; sync(); }
      if (t.dataset && t.dataset.impf !== undefined && t.files[0]) { const r = new FileReader(); r.onload = () => { ta.value += (ta.value && !ta.value.endsWith("\n") ? "\n" : "") + String(r.result); sync(); ta.focus(); }; r.readAsText(t.files[0]); t.value = ""; } });
    bar.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.t) { st[b.dataset.t] = !st[b.dataset.t]; sync(); ta.focus(); } else if (b.dataset.ok !== undefined) finish(true); else if (b.dataset.cx !== undefined) finish(false); else if (b.dataset.imp !== undefined) bar.querySelector("[data-impf]").click(); });
    bar.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    catcher.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); finish(true); });
    catcher.addEventListener("wheel", (ev) => ev.preventDefault(), { passive: false });
    ta.addEventListener("input", sync);
    ta.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") { ev.preventDefault(); finish(!o.single || ta.value.trim() !== ""); return; }
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); finish(true); return; }
      if (ev.key === "Enter" && o.single) { ev.preventDefault(); finish(true); }
    });
    ta.addEventListener("keyup", (ev) => ev.stopPropagation());
    let gx = null;
    grip.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); gx = { x: ev.clientX, w: ta.offsetWidth }; grip.setPointerCapture(ev.pointerId); });
    grip.addEventListener("pointermove", (ev) => { if (!gx) return; st.w = Math.max(st.h * 2, (gx.w + ev.clientX - gx.x) / sc); const f = bar.querySelector('[data-f="w"]'); if (f) f.value = +st.w.toFixed(3); sync(); });
    grip.addEventListener("pointerup", () => { gx = null; ta.focus(); });
    sync(); setTimeout(() => { ta.focus(); ta.select(); }, 20);
  });

  const style = (r) => ({ fnt: r.fnt, b: r.b || undefined, i: r.i || undefined, u: r.u || undefined });
  const remember = (r) => { mem.fnt = r.fnt; mem.b = r.b; mem.i = r.i; mem.u = r.u; mem.rot = r.rot; };

  const getBox = async (E, msg) => {
    const a = await E.getPoint(msg || "Specify first corner of the text box:"); if (!isP(a)) return null;
    const b = await E.getPoint("Specify opposite corner — the box height becomes the text size:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] }); if (!isP(b)) return null;
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]), y0: Math.min(a[1], b[1]) };
  };
  const tiny = (E, box) => box.y1 - box.y0 < 0.5 / E.view.s;          // clicked twice at (almost) the same height: no real box was drawn

  cmd("TEXT", { a: ["DT", "DTEXT"], d: "Single-line text — draw a box; its height becomes the text size, then type", fn: async (E) => {
    let box = await getBox(E); if (!box) return;
    E.begin("text");
    for (;;) {
      const fit = !tiny(E, box), r = await edit(E, { single: true, boxed: fit, fit, box, s: "", h: fit ? box.y1 - box.y0 : mem.h || defH(E), fnt: mem.fnt, b: mem.b, i: mem.i, u: mem.u, rot: mem.rot, ha: mem.ha });
      if (!r) break; remember(r); mem.ha = r.ha; if (!r.fit) mem.h = r.h;
      const x = r.ha === 1 ? (box.x0 + box.x1) / 2 : r.ha === 2 ? box.x1 : box.x0, p = [x, box.y0];
      E.add(Object.assign({ t: "text", p, h: r.h, s: r.s, rot: r.rot, ha: r.ha, va: 0 }, style(r)));
      const step = (fit ? box.y1 - box.y0 : r.h) * 1.667; box = { x0: box.x0, x1: box.x1, y1: box.y1 - step, y0: box.y0 - step };
    }
  } });

  cmd("MTEXT", { a: ["MT", "T"], d: "Multiline text — draw a box; its height becomes the text size, then type inside", fn: async (E) => {
    const box = await getBox(E, "Specify first corner:"); if (!box) return;
    const fit = !tiny(E, box);
    const r = await edit(E, { box, fit, s: "", h: fit ? box.y1 - box.y0 : mem.h || defH(E), fnt: mem.fnt, b: mem.b, i: mem.i, u: mem.u, ap: mem.ap, rot: mem.rot });
    if (!r) return; remember(r); mem.ap = r.ap; if (!r.fit) mem.h = r.h;
    const bx = { x0: box.x0, x1: box.x0 + (r.w || box.x1 - box.x0), y1: box.y1, y0: box.y0 };
    E.add(Object.assign({ t: "mtext", p: anchor(bx, r.ap), h: r.h, s: r.s, w: r.w, ap: r.ap, rot: r.rot }, style(r)));
  } });

  /* edit text on the drawing: double-click, or the TEXTEDIT / ED command */
  const TE = K.CMDS.TEXTEDIT, prev = TE && TE.fn;
  if (TE) TE.fn = async (E, args) => {
    let e = args && args.id ? E.byId(args.id) : null;
    if (!e) { const v = await E.getEnt("Select an annotation object:", { filter: (x) => ["text", "mtext", "dim", "leader"].includes(x.t) }); if (!v) return; e = v.e; }
    if (e.t !== "text" && e.t !== "mtext") return prev(E, { id: e.id });
    const single = e.t === "text", box = boxOfEnt(e);
    const r = await edit(E, { single, box, s: e.s, h: e.h, fnt: e.fnt || "Arial", b: e.b, i: e.i, u: e.u, ap: e.ap || 1, ha: e.ha === 2 ? 2 : e.ha === 1 ? 1 : 0, rot: e.rot || 0 });
    if (!r) return;
    const n = Object.assign({}, e, { s: r.s, h: r.h, rot: r.rot, fnt: r.fnt, b: r.b || undefined, i: r.i || undefined, u: r.u || undefined });
    if (single) n.ha = r.ha; else { const bx = { x0: box.x0, x1: box.x0 + (r.w || box.x1 - box.x0), y1: box.y1, y0: box.y0 }; n.w = r.w; n.ap = r.ap; n.p = anchor(bx, r.ap); }
    E.replace(e.id, n);
  };
})(window.KCAD);
