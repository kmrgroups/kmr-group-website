/* KMR CAD Draft — AutoCAD-style screen and "save to my computer".
   1. Every file that leaves the app (DXF, SVG, PNG, KMR file …) opens the computer's own "Save as" window, so the drawing goes to the folder and name you choose
      (browsers without that window fall back to the Downloads folder). SAVELOCAL (Ctrl+Shift+S) asks which file type.
   2. The application menu and New / Open / Save / Save As live in cad-file.js.
   3. Home tab in AutoCAD's order: Draw, Modify, Annotation, Layers, Block, Groups, Utilities, Clipboard, View — large buttons for the main tools, small ones in three rows.
   4. Navigation bar on the drawing (pan, zoom extents, zoom window, zoom in / out, previous), like AutoCAD's. */
(function (K) {
  "use strict";
  const cmd = K.cmd, esc = K.esc;

  /* ---------- 1. save to the computer's own folder ---------- */
  const TYPES = { ".dxf": "AutoCAD drawing exchange (DXF)", ".svg": "SVG vector drawing", ".png": "PNG picture", ".pdf": "PDF document", ".json": "KMR CAD file", ".stl": "STL 3D model", ".nc": "CNC program", ".csv": "Excel table (CSV)" };
  const plain = K.download;
  K.download = async function (name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || "application/octet-stream" });
    if (typeof window.showSaveFilePicker === "function") {
      const t0 = performance.now();
      try {
        const ext = (String(name).match(/\.[^.]+$/) || [""])[0].toLowerCase();
        const h = await window.showSaveFilePicker({ id: "kmrcad", startIn: "documents", suggestedName: name, types: ext ? [{ description: TYPES[ext] || ext.slice(1).toUpperCase() + " file", accept: { [blob.type || "application/octet-stream"]: [ext] } }] : undefined });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        const E = K.__E; if (E) E.msg("Saved to your computer: " + h.name, "ok");
        return;
      } catch (e) { if (e && e.name === "AbortError" && performance.now() - t0 > 600) return; try { const k = "kmrcad_savelog", l = JSON.parse(localStorage.getItem(k) || "[]"); l.push({ t: new Date().toISOString(), step: "export-failed", name, err: e && (e.name + ": " + e.message) }); localStorage.setItem(k, JSON.stringify(l.slice(-30))); } catch (x) {} }
    }
    return plain(name, data, type);
  };

  const FORMATS = [["DXFOUT", "AutoCAD drawing (.dxf) — opens in AutoCAD, BricsCAD, DraftSight, LibreCAD"], ["PLOT", "PDF document (.pdf) — choose “Save as PDF” in the print window"], ["SVGOUT", "Vector picture (.svg)"], ["PNGOUT", "Picture (.png)"], ["JSONOUT", "KMR CAD file (.json) — a full copy to open again in KMR CAD"]];
  cmd("SAVELOCAL", { a: ["SAVEDISK", "SAVETOPC"], d: "Save a copy on this computer (hard disk, USB, network drive): choose the file type, then the folder and name", norepeat: true, fn: async (E) => {
    const r = await E.dialog("Save to my computer", `<div class="cx-frm"><label>File type<select id="sf">${FORMATS.map((f, i) => `<option value="${f[0]}">${esc(f[1])}</option>`).join("")}</select></label></div>
      <p class="cx-note">Next you pick the folder and the file name in your computer's own Save window.<br>A <b>.dwg</b> file cannot be written here: save the DXF, open it in AutoCAD and use Save As › DWG.</p>`, (b) => ({ c: b.querySelector("#sf").value }), { ok: "Next ›" });
    if (r) await E.run(r.c);
  } });



  /* ---------- 3. Home tab like AutoCAD ---------- */
  const has = (c) => !!K.CMDS[c];
  const grp = (n, rows) => ({ n, b: rows.filter((r) => typeof r === "string" || has(r[0])) });
  const home = (K.RIBBON || []).find((t) => t.t === "Home");
  if (home) {
    const old = (n) => (home.g.find((g) => g.n === n) || { b: [] }).b;
    const pick = (list, cs) => cs.map((c) => list.find((b) => b[0] === c)).filter(Boolean);
    const draw = old("Draw"), mod = old("Modify"), ann = old("Annotation"), lay = old("Layers & properties"), uti = old("Utilities");
    home.g = [
      grp("Draw", pick(draw, ["LINE", "PLINE", "CIRCLE", "ARC", "RECTANG", "POLYGON", "ELLIPSE", "SPLINE", "HATCH", "XLINE", "POINT"])),
      grp("Modify", pick(mod, ["MOVE", "COPY", "STRETCH", "ROTATE", "MIRROR", "SCALE", "TRIM", "FILLET", "ARRAY", "OFFSET", "EXTEND", "CHAMFER", "BREAK", "JOIN", "EXPLODE", "ERASE"])),
      grp("Annotation", pick(ann, ["TEXT", "DIMLINEAR", "MTEXT", "DIMALIGNED", "DIMRADIUS", "DIMDIAMETER", "DIMANGULAR", "QLEADER"]).concat(has("TABLE") ? [["TABLE", "Table", "array"]] : [])),
      grp("Layers", ["|LAYERBOX"].concat(pick(lay, ["LAYER"]))),
      grp("Block", [["INSERT", "Insert", "insert"], ["BLOCK", "Create", "block"], ["EXPLODE", "Explode", "explode"]]),
      grp("Properties", pick(lay, ["MATCHPROP", "PROPERTIES"])),
      grp("Groups", [["GROUP", "Group", "block"], ["UNGROUP", "Ungroup", "explode"]]),
      grp("Utilities", pick(uti, ["DIST", "AREA", "LIST", "SELECTSIMILAR"])),
      grp("Clipboard", [["PASTECLIP", "Paste", "insert"], ["CUTCLIP", "Cut", "erase"], ["COPYCLIP", "Copy", "copy"]]),
      grp("View", [["ZOOMEXT", "Extents", "zoomE"], ["ZOOMWIN", "Window", "zoomW"], ["PAN", "Pan", "pan"]]),
    ];
    const out = (K.RIBBON || []).find((t) => t.t === "Output");
    if (out) { const ex = out.g.find((g) => g.n === "Export"); if (ex && !ex.b.some((b) => b[0] === "SAVELOCAL")) ex.b.unshift(["SAVELOCAL", "Save to computer", "save"]); }
  }
  const BIG = { Draw: ["LINE", "PLINE", "CIRCLE", "ARC"], Modify: [], Annotation: ["TEXT", "DIMLINEAR"], Layers: ["LAYER"], Block: ["INSERT"], Properties: ["MATCHPROP"], Groups: ["GROUP"], Utilities: ["DIST"], Clipboard: ["PASTECLIP"], View: ["ZOOMEXT"], Export: ["SAVELOCAL", "DXFOUT"], Print: ["PLOT"] };

  /* ---------- 2 + 4. application menu, navigation bar, big ribbon buttons ---------- */
  const CSS = `
.cx-nav{position:absolute;right:10px;top:50%;transform:translateY(-50%);z-index:5;display:flex;flex-direction:column;gap:2px;padding:4px;background:#141b26cc;border:1px solid var(--bd);border-radius:10px;backdrop-filter:blur(3px)}
.cx-nav button{width:32px;height:32px;border-radius:6px;display:grid;place-items:center;color:#d6e0ea}.cx-nav button:hover{background:var(--ui3)}.cx-nav svg{width:20px;height:20px}
.cx-gb{grid-template-rows:repeat(3,24px)!important}
.cx-gb>button{height:24px!important;padding:0 6px 0 4px!important}.cx-gb>button svg{width:16px!important;height:16px!important}
.cx-gb>button.big{grid-row:span 3;height:auto!important;flex-direction:column;justify-content:center;gap:2px;padding:2px 10px!important;min-width:54px}.cx-gb>button.big svg{width:30px!important;height:30px!important}.cx-gb>button.big span{font-size:11px}
.cx-lbox{grid-row:span 3!important}
`;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  const NAV = [["PAN", "Pan", "M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3"], ["ZOOMEXT", "Zoom extents", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 9h6v6H9z"], ["ZOOMWIN", "Zoom window", "M4 4h10v10H4zM14 14l6 6M9 6v6M6 9h6"], ["ZOOMIN", "Zoom in", "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5M8 11h6M11 8v6"], ["ZOOMOUT", "Zoom out", "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5M8 11h6"], ["ZOOMPREV", "Zoom previous", "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10"]];

  (K.editorHooks = K.editorHooks || []).push((E) => {
    K.__E = E;
    const root = document.querySelector(".cx"); if (!root) return;
    const qa = root.querySelector(".cx-qa"), cw = root.querySelector(".cx-cw");
    /* a "save to computer" shortcut next to Save */
    const sv = qa.querySelector('button[data-c="QSAVE"]'); if (sv) { const b = document.createElement("button"); b.dataset.c = "SAVEAS"; b.title = "Save As — new file on this computer (Ctrl+Shift+S)"; b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/><path d="M19 15v6m0 0-2-2m2 2 2-2" stroke="#60a5fa"/></svg>`; sv.after(b); }
    /* navigation bar */
    const nav = document.createElement("div"); nav.className = "cx-nav";
    nav.innerHTML = NAV.filter((n) => has(n[0])).map((n) => `<button type="button" data-c="${n[0]}" title="${n[1]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${n[2]}"/></svg></button>`).join("");
    cw.appendChild(nav);
    /* big buttons in the ribbon: re-mark after every redraw */
    const rb = root.querySelector(".cx-ribbon"), mark = () => rb.querySelectorAll(".cx-g").forEach((g) => { const n = (g.querySelector(".cx-gt") || {}).textContent, big = BIG[n] || []; g.querySelectorAll(".cx-gb>button[data-c]").forEach((b) => b.classList.toggle("big", big.includes(b.dataset.c))); });
    new MutationObserver(mark).observe(rb, { childList: true }); mark();
  });
})(window.KCAD);
