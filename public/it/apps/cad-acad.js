/* KMR CAD Draft — AutoCAD-style screen and "save to my computer".
   1. Every file that leaves the app (DXF, SVG, PNG, KMR file …) opens the computer's own "Save as" window, so the drawing goes to the folder and name you choose
      (browsers without that window fall back to the Downloads folder). SAVELOCAL (Ctrl+Shift+S) asks which file type.
   2. Application menu (the big K button, top left): New, Open, Save, Save As, Export, Print, Drawing utilities — laid out like AutoCAD's.
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
      try {
        const ext = (String(name).match(/\.[^.]+$/) || [""])[0].toLowerCase();
        const h = await window.showSaveFilePicker({ suggestedName: name, types: ext ? [{ description: TYPES[ext] || ext.slice(1).toUpperCase() + " file", accept: { [blob.type || "application/octet-stream"]: [ext] } }] : undefined });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        const E = K.__E; if (E) E.msg("Saved to your computer: " + h.name, "ok");
        return;
      } catch (e) { if (e && e.name === "AbortError") return; /* anything else: use the normal download */ }
    }
    return plain(name, data, type);
  };

  const FORMATS = [["DXFOUT", "AutoCAD drawing (.dxf) — opens in AutoCAD, BricsCAD, DraftSight, LibreCAD"], ["PLOT", "PDF document (.pdf) — choose “Save as PDF” in the print window"], ["SVGOUT", "Vector picture (.svg)"], ["PNGOUT", "Picture (.png)"], ["JSONOUT", "KMR CAD file (.json) — a full copy to open again in KMR CAD"]];
  cmd("SAVELOCAL", { a: ["SAVEDISK", "SAVETOPC"], d: "Save a copy on this computer (hard disk, USB, network drive): choose the file type, then the folder and name", norepeat: true, fn: async (E) => {
    const r = await E.dialog("Save to my computer", `<div class="cx-frm"><label>File type<select id="sf">${FORMATS.map((f, i) => `<option value="${f[0]}">${esc(f[1])}</option>`).join("")}</select></label></div>
      <p class="cx-note">Next you pick the folder and the file name in your computer's own Save window.<br>A <b>.dwg</b> file cannot be written here: save the DXF, open it in AutoCAD and use Save As › DWG.</p>`, (b) => ({ c: b.querySelector("#sf").value }), { ok: "Next ›" });
    if (r) await E.run(r.c);
  } });


  /* ---------- Save (Ctrl+S / the Save button) also keeps a file on the computer ---------- */
  const toast = (msg, bad) => { const cw = document.querySelector(".cx-cw"); if (!cw) return; const t = document.createElement("div"); t.textContent = msg; t.style.cssText = `position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:70;max-width:90%;padding:10px 16px;border-radius:10px;font:600 13px system-ui;color:#fff;background:${bad ? "#b91c1c" : "#15803d"};box-shadow:0 10px 30px #0008`; cw.appendChild(t); setTimeout(() => t.remove(), 5000); };
  const nm = (E, ext) => String((E.info && (E.info.number || E.info.title)) || "drawing").replace(/[^\w\-. ]+/g, "_").trim() + (E.info && E.info.rev ? "_rev" + E.info.rev : "") + "." + ext;
  const body = (E, ext) => (ext === "json" ? JSON.stringify({ kcad: 1, info: E.info, doc: E.data() }) : K.writeDXF(E.doc));
  /** returns "saved", "cancel" or "download" (browser without a Save window) */
  const toDisk = async (E, pick) => {
    if (typeof window.showSaveFilePicker !== "function") { K.download(nm(E, "dxf"), body(E, "dxf"), "application/dxf"); toast("Downloaded " + nm(E, "dxf") + " — look in your Downloads folder (use Chrome or Edge to choose the folder)."); return "download"; }
    let h = !pick && E.__fh;
    if (!h) {
      try { h = await window.showSaveFilePicker({ suggestedName: nm(E, "dxf"), types: [{ description: "AutoCAD drawing exchange (DXF)", accept: { "application/dxf": [".dxf"] } }, { description: "KMR CAD file (full copy)", accept: { "application/json": [".json"] } }] }); }
      catch (e) { if (e && e.name === "AbortError") return "cancel"; K.download(nm(E, "dxf"), body(E, "dxf"), "application/dxf"); toast("The Save window could not open here, so the file was downloaded: " + nm(E, "dxf")); return "download"; }
      E.__fh = h;
    }
    const ext = /\.json$/i.test(h.name) ? "json" : "dxf", w = await h.createWritable(); await w.write(new Blob([body(E, ext)], { type: ext === "json" ? "application/json" : "application/dxf" })); await w.close();
    toast("Saved on your computer: " + h.name); return "saved";
  };
  K.saveToDisk = toDisk;
  const QS = K.CMDS.QSAVE, qsFn = QS && QS.fn;
  if (QS) QS.fn = async (E, a) => { try { await toDisk(E, false); } catch (e) { toast("Could not write the file: " + (e && e.message || e), true); } return qsFn(E, a); };
  /* Save As = always a NEW file on this computer (folder, name and type chosen each time). The old "copy in the workspace" is SAVEWS. */
  const SA = K.CMDS.SAVEAS, saFn = SA && SA.fn;
  if (SA) { cmd("SAVEWS", { a: [], d: "Save a copy as a new drawing in the KMR workspace", norepeat: true, fn: saFn }); SA.d = "Save As — save a new file on this computer (choose folder, name and type)"; SA.fn = async (E) => { try { await toDisk(E, true); } catch (e) { toast("Could not write the file: " + (e && e.message || e), true); } }; }
  cmd("SAVEDISKAS", { a: ["SAVEAS2"], d: "Save As — new file on this computer", norepeat: true, fn: async (E) => E.run("SAVEAS") });

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
.cx-appbtn{width:34px!important;height:28px;margin-right:4px;border-radius:6px;background:linear-gradient(135deg,#dc2626,#7f1d1d)!important;color:#fff!important;font:800 15px system-ui;display:grid;place-items:center;border:0;cursor:pointer}
.cx-appbtn:hover{filter:brightness(1.15)}
.cx-appm{position:absolute;left:6px;top:36px;z-index:60;display:none;width:min(560px,96vw);background:#1b2330;border:1px solid var(--bd);border-radius:10px;box-shadow:0 18px 50px #000c;color:#e5edff;overflow:hidden}.cx-appm.on{display:flex}
.cx-appm .l{width:210px;background:#141b26;padding:8px 0;border-right:1px solid var(--bd)}.cx-appm .r{flex:1;padding:10px 12px;min-height:250px}
.cx-appm .l button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 14px;text-align:left;color:#e5edff;font-size:13px}.cx-appm .l button:hover,.cx-appm .l button.on{background:#25407a}
.cx-appm .r h5{margin:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#93c5fd}
.cx-appm .r button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:6px;color:#e5edff}.cx-appm .r button:hover{background:#25407a}.cx-appm .r button small{display:block;color:#9fb0c8;font-size:11px;margin-top:1px}
.cx-nav{position:absolute;right:10px;top:50%;transform:translateY(-50%);z-index:5;display:flex;flex-direction:column;gap:2px;padding:4px;background:#141b26cc;border:1px solid var(--bd);border-radius:10px;backdrop-filter:blur(3px)}
.cx-nav button{width:32px;height:32px;border-radius:6px;display:grid;place-items:center;color:#d6e0ea}.cx-nav button:hover{background:var(--ui3)}.cx-nav svg{width:20px;height:20px}
.cx-gb{grid-template-rows:repeat(3,24px)!important}
.cx-gb>button{height:24px!important;padding:0 6px 0 4px!important}.cx-gb>button svg{width:16px!important;height:16px!important}
.cx-gb>button.big{grid-row:span 3;height:auto!important;flex-direction:column;justify-content:center;gap:2px;padding:2px 10px!important;min-width:54px}.cx-gb>button.big svg{width:30px!important;height:30px!important}.cx-gb>button.big span{font-size:11px}
.cx-lbox{grid-row:span 3!important}
`;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  const MENU = [
    ["New", "NEW", null],
    ["Open", null, [["OPEN", "Drawing", "DXF, PDF, picture or KMR CAD file from your computer"], ["IMPORT", "Import DXF", "Add a DXF into this drawing"]]],
    ["Save", "QSAVE", null],
    ["Save As", "SAVEAS", [["SAVEAS", "Save As — new file on this computer…", "Pick the folder and the file name; DXF (AutoCAD) or KMR CAD file"], ["SAVELOCAL", "Other file types (PDF, SVG, PNG)…", "Export for printing, pictures or the web"], ["SAVEWS", "Copy in the KMR workspace", "Keep a copy as a new drawing in your KMR register"]]],
    ["Export", null, [["DXFOUT", "DXF", "AutoCAD drawing exchange"], ["PLOT", "PDF", "Print window → Save as PDF"], ["SVGOUT", "SVG", "Vector picture"], ["PNGOUT", "PNG", "Picture"], ["JSONOUT", "KMR CAD file", "Full copy of this drawing"]]],
    ["Print", null, [["PLOT", "Plot / PDF", "Set the paper, scale and area, then print or save as PDF"]]],
    ["Drawing utilities", null, [["UNITS", "Units", "Drawing units and precision"], ["PURGE", "Purge", "Remove unused layers, blocks and styles"], ["OVERKILL", "Overkill", "Delete duplicate and overlapping objects"]]],
  ];
  const NAV = [["PAN", "Pan", "M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3"], ["ZOOMEXT", "Zoom extents", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 9h6v6H9z"], ["ZOOMWIN", "Zoom window", "M4 4h10v10H4zM14 14l6 6M9 6v6M6 9h6"], ["ZOOMIN", "Zoom in", "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5M8 11h6M11 8v6"], ["ZOOMOUT", "Zoom out", "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l5 5M8 11h6"], ["ZOOMPREV", "Zoom previous", "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10"]];

  (K.editorHooks = K.editorHooks || []).push((E) => {
    K.__E = E;
    const root = document.querySelector(".cx"); if (!root) return;
    const qa = root.querySelector(".cx-qa"), cw = root.querySelector(".cx-cw");
    /* application menu */
    const btn = document.createElement("button"); btn.className = "cx-appbtn"; btn.type = "button"; btn.title = "Application menu — new, open, save, export, print"; btn.textContent = "K"; qa.insertBefore(btn, qa.firstChild);
    const m = document.createElement("div"); m.className = "cx-appm"; m.innerHTML = `<div class="l">${MENU.map((x, i) => `<button data-i="${i}">${esc(x[0])}${x[2] ? "<span>›</span>" : ""}</button>`).join("")}</div><div class="r"><h5>Application menu</h5><p style="color:#9fb0c8;font-size:12px">Point at a menu item on the left. <b>Save As › Save to my computer</b> puts a copy on your hard disk.</p></div>`;
    root.appendChild(m);
    const show = (i) => { const x = MENU[i]; m.querySelectorAll(".l button").forEach((b, k) => b.classList.toggle("on", k === i)); const r = m.querySelector(".r");
      r.innerHTML = x[2] ? `<h5>${esc(x[0])}</h5>${x[2].map((s) => `<button data-c="${s[0]}">${esc(s[1])}<small>${esc(s[2])}</small></button>`).join("")}` : `<h5>${esc(x[0])}</h5><button data-c="${x[1]}">${esc(x[0])}<small>${esc(((K.CMDS[x[1]] || {}).d) || "")}</small></button>`; };
    const close = () => m.classList.remove("on");
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); m.classList.toggle("on"); if (m.classList.contains("on")) show(0); });
    m.addEventListener("mouseover", (ev) => { const b = ev.target.closest(".l button"); if (b) show(+b.dataset.i); });
    m.addEventListener("click", (ev) => { ev.stopPropagation(); const l = ev.target.closest(".l button"); if (l) { const x = MENU[+l.dataset.i]; if (x[1] && !x[2]) { close(); E.run(x[1]); } else show(+l.dataset.i); return; } const c = ev.target.closest("[data-c]"); if (c) { close(); E.run(c.dataset.c); } });
    document.addEventListener("click", close);
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") close(); if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "S" || ev.key === "s")) { ev.preventDefault(); ev.stopImmediatePropagation(); E.run("SAVEAS"); } }, true);
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
