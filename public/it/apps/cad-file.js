/* KMR CAD Draft — File menu, working like AutoCAD's.
   New (Ctrl+N)          blank drawing; asks "Save changes?" (Yes / No / Cancel) first when the open drawing has unsaved changes.
   Open (Ctrl+O)         a DXF (Drawing Exchange Format) or KMR CAD file from this computer; the drawing stays tied to that file.
   Save (Ctrl+S)         writes back to the file the drawing came from or was last saved as; a drawing never saved asks where (= Save As).
                         A drawing from the KMR register is saved to the register as well.
   Save As (Ctrl+Shift+S) always asks for folder, name and type; afterwards the drawing is tied to the NEW file (Save writes there).
   Close                 asks "Save changes?" then closes the drawing.
   Recent documents      the last 12 files opened or saved, reopened with one click (kept in this browser).
   Needs Chrome or Edge on a computer for folder choice; other browsers fall back to the Downloads folder. */
(function (K) {
  "use strict";
  const cmd = K.cmd, esc = K.esc, plain = (K.__plainDownload = K.__plainDownload || ((name, data, type) => { const b = data instanceof Blob ? data : new Blob([data], { type: type || "application/octet-stream" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }));
  const CAN_PICK = typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";
  const shell = () => window.KCADShell || null;
  const reg = () => { const S = shell(); return S && S.cur ? S.cur : null; };
  const why = (e) => (e && (e.message || e.name)) || String(e);
  const slog = (o) => { try { const k = "kmrcad_savelog", a = JSON.parse(localStorage.getItem(k) || "[]"); a.push(Object.assign({ t: new Date().toISOString() }, o)); localStorage.setItem(k, JSON.stringify(a.slice(-40))); } catch (e) { /* ignore */ } };
  const toast = (msg, bad, ms) => { const cw = document.querySelector(".cx-cw"); if (!cw) return; const t = document.createElement("div"); t.className = "cf-toast" + (bad ? " bad" : ""); t.textContent = msg; cw.appendChild(t); setTimeout(() => t.remove(), ms || 6000); };
  const say = (E, msg, bad) => { toast(msg, bad, bad ? 14000 : 7000); E.msg(msg, bad ? "er" : "ok"); };
  const extOf = (n) => ((String(n).match(/\.([^.]+)$/) || [])[1] || "").toLowerCase();
  const fmtOf = (n) => (extOf(n) === "json" || extOf(n) === "kcad" ? "json" : "dxf");
  const LOSSY = ["dim", "leader", "mleader", "hatch", "mtext", "table", "fcf"];
  const body = (E, fmt) => (fmt === "json" ? JSON.stringify({ kcad: 1, info: E.info, doc: E.data() }) : K.writeDXF(E.doc));
  const OPEN_TYPES = [{ description: "Drawings (DXF, DWG, KMR CAD)", accept: { "application/dxf": [".dxf"], "application/acad": [".dwg"], "application/json": [".json", ".kcad"] } }, { description: "PDF or picture (traced into lines)", accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".bmp", ".webp"] } }];
  const PICK_TYPES = [{ description: "AutoCAD drawing exchange (DXF)", accept: { "application/dxf": [".dxf"] } }, { description: "KMR CAD drawing (keeps everything)", accept: { "application/json": [".json"] } }];
  let untitled = 0;
  const docName = (E) => (E.file && E.file.name) || (reg() ? String(reg().number || "drawing").replace(/[^\w\-. ]+/g, "_") + (reg().rev ? "_rev" + reg().rev : "") + ".dxf" : String((E.info && E.info.title && !/^scratch/i.test(E.info.title) && E.info.title) || "Drawing1").replace(/[^\w\-. ]+/g, "_").replace(/\.[a-z0-9]{2,5}$/i, "") + ".dxf");

  /* ---------------- recent documents (file handles kept in this browser's IndexedDB) ---------------- */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open("kmrcad-files", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const kv = async (key, val) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("kv", val === undefined ? "readonly" : "readwrite"), s = t.objectStore("kv"); const q = val === undefined ? s.get(key) : s.put(val, key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
  const recent = async () => { try { return (await kv("recent")) || []; } catch (e) { return []; } };
  const addRecent = async (h) => { if (!h) return; try { const l = await recent(), out = [{ name: h.name, h, at: Date.now() }]; for (const x of l) if (out.length < 12 && !(x.h && h.isSameEntry && (await h.isSameEntry(x.h).catch(() => false)))) out.push(x); await kv("recent", out); } catch (e) { /* not supported */ } };
  const dropRecent = async (i) => { try { const l = await recent(); l.splice(i, 1); await kv("recent", l); } catch (e) { /* ignore */ } };

  /* ---------------- writing a file ---------------- */
  async function writeTo(E, h) {
    const fmt = fmtOf(h.name); let step = "build";
    try {
      const txt = body(E, fmt); step = "permission";
      if (h.queryPermission && (await h.queryPermission({ mode: "readwrite" })) !== "granted" && (await h.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("permission to change the file was not given");
      step = "open"; const w = await h.createWritable();
      step = "write"; await w.write(new Blob([txt], { type: "application/octet-stream" }));
      step = "close"; await w.close();
      step = "check"; const size = (await h.getFile()).size; if (!size) throw new Error("the file is still empty after writing");
      slog({ step: "saved", name: h.name, size }); return { ok: true, size, fmt };
    } catch (e) { slog({ step: "write-failed", at: step, name: h.name, err: why(e) }); return { ok: false, err: why(e) }; }
  }
  const noted = new Set(); const lossNote = (E, fmt) => (fmt === "dxf" && E.file && !noted.has(E.file.name) && noted.add(E.file.name) && E.doc.ents.some((e) => LOSSY.includes(e.t)) ? " Note: DXF keeps dimensions, hatches and multiline text as plain lines and text — use Save As › KMR CAD drawing (.json) to keep them editable." : "");
  function link(E, h) {
    E.file = { h, name: h.name };
    if (!reg()) E.setTitle(h.name);
    E.markSaved(); addRecent(h); bar(E);
  }

  /** Save As: always a new file, chosen by the user. Returns true when written. */
  async function saveAs(E) {
    if (!CAN_PICK) { plain(docName(E), body(E, "dxf"), "application/dxf"); say(E, "This browser cannot choose a folder, so " + docName(E) + " was put in your Downloads folder. Use Chrome or Edge to choose the folder."); E.markSaved(); return true; }
    let h; const t0 = performance.now(); slog({ step: "saveas-start", name: docName(E), active: !!(navigator.userActivation && navigator.userActivation.isActive) });
    try { h = await window.showSaveFilePicker({ suggestedName: docName(E), types: fmtOf(docName(E)) === "json" ? PICK_TYPES.slice().reverse() : PICK_TYPES }); }
    catch (e) {
      if (e && e.name === "AbortError") {
        const ms = Math.round(performance.now() - t0); slog({ step: "saveas-cancel", ms, err: why(e) });
        if (ms > 600) return false;   // the user pressed Cancel
        /* closed by the browser before anyone could see it (blocked by a browser setting or an extension): save through a normal download instead */
        plain(docName(E), body(E, fmtOf(docName(E))), "application/octet-stream"); E.markSaved();
        say(E, "Chrome closed the Save window by itself, so " + docName(E) + " was saved through a normal download (look in Downloads, or Chrome asks where if \"Ask where to save each file\" is on).", true); return true;
      }
      slog({ step: "picker-failed", err: why(e) }); plain(docName(E), body(E, "dxf"), "application/dxf");
      say(E, "The Save window could not open (" + why(e) + "). " + docName(E) + " was put in your Downloads folder instead.", true); return false;
    }
    const r = await writeTo(E, h);
    if (!r.ok) { plain(h.name, body(E, fmtOf(h.name)), "application/octet-stream"); say(E, "Could not write " + h.name + " in that folder (" + r.err + "). The file was put in your Downloads folder instead — choose another folder, e.g. Documents.", true); return false; }
    link(E, h); say(E, "Saved as " + h.name + " (" + Math.max(1, Math.round(r.size / 1024)) + " KB). Save (Ctrl+S) now writes to this file." + lossNote(E, r.fmt)); return true;
  }

  /** Save: register drawing → register; then the tied file (or ask where, the first time). Returns true when saved. */
  async function save(E) {
    const d = reg();
    if (E.readOnly && d) { E.err(E.readOnly); return false; }
    if (d && E.opts.onSave) await E.opts.onSave(E, false);
    if (E.file && E.file.h) {
      const r = await writeTo(E, E.file.h);
      if (r.ok) { E.markSaved(); addRecent(E.file.h); say(E, "Saved " + E.file.name + "." + lossNote(E, r.fmt)); return true; }
      say(E, "Could not save " + E.file.name + " (" + r.err + "). Use Save As to save it somewhere else.", true); return false;
    }
    return saveAs(E);
  }

  /** "Save changes to …?" Yes / No / Cancel. Returns false when the user cancels (or the save fails). */
  async function askSave(E, what) {
    if (!E.dirty || E.readOnly) return true;
    const v = await E.dialog("KMR CAD", `<p style="font-size:14px;margin:4px 0 2px">Save changes to <b>${esc(docName(E))}</b> before ${esc(what)}?</p>`, null, { noCancel: true, width: "420px", init: (b) => {
      const f = b.parentElement.querySelector(".cx-df"); f.innerHTML = '<button class="cx-b" data-v="yes">Yes</button><button class="cx-b o" data-v="no">No</button><button class="cx-b o" data-v="cancel">Cancel</button>';
      f.querySelectorAll("[data-v]").forEach((x) => (x.onclick = () => E.closeDlg(x.dataset.v))); setTimeout(() => f.querySelector("[data-v=yes]").focus(), 40);
    } });
    if (v === "yes") return save(E);
    return v === "no";
  }

  /* leave the KMR register drawing (if any) so Save no longer writes to it */
  function detach(E) {
    const S = shell(); if (S) S.cur = null;
    E._scratch = true; E._stage = null; E.readOnly = null;
    try { if (/go=ed&id=/.test(location.hash)) history.replaceState(null, "", "#go=ed"); } catch (e) { /* ignore */ }
  }
  function bar(E) {
    const b = document.getElementById("edbar"); if (!b || reg()) return;
    b.className = "edbar"; b.classList.remove("hide");
    const f = E.file;
    b.innerHTML = `<b>${esc(f ? f.name : docName(E))}</b> <span class="mut">${f ? "file on this computer — Save (Ctrl+S) writes to it" : "new drawing — not saved yet"}</span><span style="flex:1"></span><button class="btn s" id="cfsave">Save</button><button class="btn s o" id="cfsaveas" title="Save As (Ctrl+Shift+S)">Save As…</button><a class="btn s o" href="#go=list">Register</a>`;
    b.querySelector("#cfsave").onclick = () => E.run("QSAVE"); b.querySelector("#cfsaveas").onclick = () => E.run("SAVEAS");
  }
  function loadDoc(E, r, h, name) {
    detach(E); E.savedAt = null;
    E.load(r.doc, Object.assign({}, r.info || {}, { title: name, number: "", rev: "" }));
    E.file = h && !r.converted && /^(dxf|json|kcad)$/.test(extOf(name)) ? { h, name } : null;
    if (h) addRecent(h); bar(E);
    E.msg(`Opened ${name}: ${E.doc.ents.length} objects.${r.converted ? " " + [r.note].concat(r.notes || []).filter(Boolean).join(" ") + " Use Save As to keep it as a drawing." : ""}${extOf(name) === "dwg" ? " DWG (AutoCAD drawing) files can be read but not written here: Save asks for a new DXF file." : ""}`, "ok");
  }
  async function openHandle(E, h) {
    if (h.queryPermission && (await h.queryPermission({ mode: "readwrite" })) !== "granted") await h.requestPermission({ mode: "readwrite" }).catch(() => "denied");
    const file = await h.getFile(); return loadDoc(E, await K.readDrawingFile(file), h, file.name);
  }

  /* ---------------- commands ---------------- */
  const NOW = new Set();
  const fileCmd = (name, o) => { cmd(name, Object.assign({ norepeat: true }, o)); NOW.add(name); };
  fileCmd("NEW", { a: ["QNEW"], d: "New drawing (Ctrl+N) — asks to save the open drawing first", fn: async (E) => {
    if (!(await askSave(E, "starting a new drawing"))) return;
    detach(E); untitled++; E.savedAt = null; E.load(K.newDoc(), { title: "Drawing" + untitled }); E.file = null; bar(E); E.msg("New drawing. Save (Ctrl+S) asks where to keep it.", "ok");
  } });
  fileCmd("OPEN", { a: ["FILEOPEN"], d: "Open a drawing from this computer (Ctrl+O): DXF or KMR CAD file", fn: async (E) => {
    if (!(await askSave(E, "opening another drawing"))) return;
    try {
      if (CAN_PICK) {
        let hs;
        const t0 = performance.now();
        try { hs = await window.showOpenFilePicker({ multiple: false, types: OPEN_TYPES, excludeAcceptAllOption: false }); }
        catch (e) { if (!(e && e.name === "AbortError")) throw e; slog({ step: "open-cancel", ms: Math.round(performance.now() - t0) }); if (performance.now() - t0 > 600) return; hs = null; }
        if (hs) return await openHandle(E, hs[0]);
        const f2 = await K.pickFile(".dxf,.dwg,.json,.kcad"); if (!f2) return; return loadDoc(E, await K.readDrawingFile(f2), null, f2.name);
      }
      const file = await K.pickFile(".dxf,.dwg,.json,.kcad"); if (!file) return;
      loadDoc(E, await K.readDrawingFile(file), null, file.name);
    } catch (e) { E.err("Could not open the file: " + why(e)); }
  } });
  fileCmd("QSAVE", { a: ["SAVE"], d: "Save (Ctrl+S) — to the drawing's own file; asks where the first time", fn: async (E) => { await save(E); } });
  fileCmd("SAVEAS", { a: ["SAVEDISKAS", "SAVEAS2"], d: "Save As (Ctrl+Shift+S) — new file: choose folder, name and type", fn: async (E) => { await saveAs(E); } });
  fileCmd("CLOSE", { a: ["CLOSEDWG"], d: "Close the drawing — asks to save changes first", fn: async (E) => {
    if (!(await askSave(E, "closing"))) return;
    E.dirty = false;
    if (reg()) { location.hash = "go=list"; return; }
    detach(E); untitled++; E.load(K.newDoc(), { title: "Drawing" + untitled }); E.file = null; bar(E);
  } });
  fileCmd("OPENRECENT", { a: [], d: "Open a recent drawing", fn: async (E, a) => {
    const l = await recent(), x = l[(a && a.i) || 0]; if (!x) return E.err("No recent drawings yet.");
    if (!(await askSave(E, "opening " + x.name))) return;
    try { await openHandle(E, x.h); } catch (e) { await dropRecent((a && a.i) || 0); E.err(x.name + " could not be opened (moved, renamed or deleted?): " + why(e)); }
  } });
  cmd("SAVELOG", { a: ["SAVEHISTORY"], d: "Save history — the last saves on this computer and whether they worked", norepeat: true, fn: async (E) => {
    let l = []; try { l = JSON.parse(localStorage.getItem("kmrcad_savelog") || "[]"); } catch (e) { /* ignore */ }
    const W = { saved: "Saved", "write-failed": "Could not write", "picker-failed": "Save window failed", "saveas-cancel": "Save window closed", "saveas-start": "Save As opened", empty: "File stayed empty", "open-cancel": "Open window closed" };
    await E.dialog("Save history (this computer)", l.length ? `<table style="width:100%;font-size:12.5px;border-collapse:collapse">${l.slice().reverse().map((x) => `<tr style="border-bottom:1px solid #2a3446"><td style="padding:4px 6px;white-space:nowrap">${esc(new Date(x.t).toLocaleString())}</td><td style="padding:4px 6px;color:${x.step === "saved" ? "#4ade80" : /fail|empty/.test(x.step) ? "#f87171" : "#cbd5e1"}">${esc(W[x.step] || x.step)}</td><td style="padding:4px 6px">${esc(x.name || "")}${x.size ? " · " + Math.max(1, Math.round(x.size / 1024)) + " KB" : ""}${x.err ? "<br><small>" + esc(x.err) + (x.ms != null ? " (" + x.ms + " ms)" : "") + "</small>" : ""}</td></tr>`).join("")}</table>` : "<p>No saves yet on this computer.</p>", null, { width: "640px" });
  } });
  cmd("SAVEWS", { a: ["SAVEREG"], d: "Save a copy as a new drawing in the KMR register", norepeat: true, fn: async (E) => { if (!E.opts.onOpenFile) return E.err("The KMR register is not available here."); return E.opts.onOpenFile(E, { doc: E.data(), name: (E.info && E.info.title) || "Copy" }); } });
  cmd("REGOPEN", { a: [], d: "Open a drawing from the KMR register", norepeat: true, fn: async (E) => { if (!(await askSave(E, "going to the register"))) return; E.dirty = false; location.hash = "go=list"; } });
  cmd("REGNEW", { a: [], d: "New drawing in the KMR register (number, revision, title block)", norepeat: true, fn: async (E) => { if (E.opts.onNew) return E.opts.onNew(E); E.err("The KMR register is not available here."); } });

  /* ---------------- application menu (big K button), like AutoCAD ---------------- */
  const MENU = [
    ["New", "NEW", "Start a new drawing", [["NEW", "Drawing", "Blank drawing on this computer (Ctrl+N)"], ["REGNEW", "Drawing in KMR register", "Numbered drawing with revision and title block"]]],
    ["Open", "OPEN", "Open a drawing", [["OPEN", "Drawing…", "DXF or KMR CAD file from this computer (Ctrl+O)"], ["REGOPEN", "From KMR register", "Drawings saved in the company register"], ["IMPORT", "Import DXF into this drawing", "Adds the objects of another DXF"]]],
    ["Save", "QSAVE", "Save the drawing (Ctrl+S)", null],
    ["Save As", "SAVEAS", "Save as a new file", [["SAVEAS", "Drawing…", "Choose folder, name and type: DXF (AutoCAD) or KMR CAD (Ctrl+Shift+S)"], ["SAVELOCAL", "Other formats…", "PDF (Portable Document Format), SVG (Scalable Vector Graphics), PNG (Portable Network Graphics) picture"], ["SAVEWS", "Copy in KMR register", "Keep a copy as a new numbered drawing"]]],
    ["Export", null, "Export to other formats", [["DXFOUT", "DXF", "AutoCAD drawing exchange"], ["PLOT", "PDF", "Print window › Save as PDF"], ["SVGOUT", "SVG", "Vector picture"], ["PNGOUT", "PNG", "Picture"], ["JSONOUT", "KMR CAD file", "Full copy of this drawing"]]],
    ["Print", "PLOT", "Plot / print", [["PLOT", "Plot", "Paper, scale and area, then print or save as PDF (Ctrl+P)"]]],
    ["Close", "CLOSE", "Close the drawing", null],
    ["Drawing Utilities", null, "Units, purge, clean-up, save history", [["SAVELOG", "Save history", "The last saves on this computer and whether they worked"], ["UNITS", "Units", "Drawing units and precision"], ["PURGE", "Purge", "Remove unused layers, blocks and styles"], ["OVERKILL", "Overkill", "Delete duplicate and overlapping objects"]]],
  ];
  const CSS = `
.cf-btn{width:34px!important;height:28px;margin-right:4px;border-radius:6px;background:linear-gradient(135deg,#dc2626,#7f1d1d)!important;color:#fff!important;font:800 15px system-ui;display:grid!important;place-items:center}
.cf-btn:hover{filter:brightness(1.15)}
.cf-m{position:absolute;left:6px;top:36px;z-index:80;display:none;width:min(640px,96vw);background:#1b2330;border:1px solid var(--bd,#334);border-radius:10px;box-shadow:0 18px 50px #000c;color:#e5edff;overflow:hidden}
.cf-m.on{display:flex}
.cf-m .l{width:200px;background:#141b26;padding:6px 0;border-right:1px solid var(--bd,#334)}
.cf-m .l button{display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;text-align:left;color:#e5edff;font-size:13.5px}
.cf-m .l button span{margin-left:auto;opacity:.6}.cf-m .l button:hover,.cf-m .l button.on{background:#25407a}
.cf-m .l .sep{height:1px;background:#2a3446;margin:4px 0}
.cf-m .r{flex:1;padding:10px 12px;min-height:300px;max-height:70vh;overflow:auto}
.cf-m .r h5{margin:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#93c5fd}
.cf-m .r button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:6px;color:#e5edff;font-size:13px}
.cf-m .r button:hover{background:#25407a}.cf-m .r button small{display:block;color:#9fb0c8;font-size:11.5px;margin-top:2px}
.cf-m .r .empty{background:none!important;border:0!important;color:#9fb0c8;font-size:12.5px;padding:8px 10px}
.cf-m .ft{position:absolute;right:10px;bottom:8px;font-size:11px;color:#8193ad}
.cf-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:70;max-width:90%;padding:10px 16px;border-radius:10px;font:600 13px system-ui;color:#fff;background:#15803d;box-shadow:0 10px 30px #0008}
.cf-toast.bad{background:#b91c1c}`;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString(); };

  (K.editorHooks = K.editorHooks || []).push((E) => {
    K.__E = E; E.file = null;
    /* file commands run at once (never queued behind a running command — a queued run loses the click and the Save window may be refused) */
    const run0 = E.run;
    E.run = (s, a) => { const n = E.resolve(String(s).split(/\s+/)[0]); if (NOW.has(n)) { if (E.busy()) E.cancel(); return Promise.resolve(K.CMDS[n].fn(E, a || {})).catch((e) => E.err(why(e))); } return run0(s, a); };
    const root = document.querySelector(".cx"); if (!root) return;
    const qa = root.querySelector(".cx-qa");
    const btn = document.createElement("button"); btn.className = "cf-btn"; btn.type = "button"; btn.title = "Application menu — New, Open, Save, Save As, Export, Print, Close"; btn.textContent = "K"; qa.insertBefore(btn, qa.firstChild);
    const m = document.createElement("div"); m.className = "cf-m";
    m.innerHTML = `<div class="l">${MENU.map((x, i) => `${i === 6 ? '<div class="sep"></div>' : ""}<button data-i="${i}" title="${esc(x[2])}">${esc(x[0])}${x[3] ? "<span>›</span>" : ""}</button>`).join("")}</div><div class="r"></div>`;
    root.appendChild(m);
    const R = m.querySelector(".r");
    const showRecent = async () => {
      m.querySelectorAll(".l button").forEach((b) => b.classList.remove("on"));
      const l = await recent();
      R.innerHTML = `<h5>Recent documents</h5>${l.length ? l.map((x, i) => `<button data-recent="${i}">${esc(x.name)}<small>${ago(x.at)}</small></button>`).join("") : `<div class="empty">${CAN_PICK ? "Drawings you open or save on this computer appear here." : "Recent documents need Chrome or Edge."}</div>`}`;
    };
    const show = (i) => { const x = MENU[i]; m.querySelectorAll(".l button").forEach((b) => b.classList.toggle("on", +b.dataset.i === i)); if (!x[3]) return showRecent(); R.innerHTML = `<h5>${esc(x[0])}</h5>${x[3].filter((s) => K.CMDS[s[0]]).map((s) => `<button data-c="${s[0]}">${esc(s[1])}<small>${esc(s[2])}</small></button>`).join("")}`; };
    const close = () => m.classList.remove("on");
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); m.classList.toggle("on"); if (m.classList.contains("on")) showRecent(); });
    m.addEventListener("mouseover", (ev) => { const b = ev.target.closest(".l button"); if (b) show(+b.dataset.i); });
    m.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const l = ev.target.closest(".l button"); if (l) { const x = MENU[+l.dataset.i]; if (x[1]) { close(); E.run(x[1]); } else show(+l.dataset.i); return; }
      const rc = ev.target.closest("[data-recent]"); if (rc) { close(); E.run("OPENRECENT", { i: +rc.dataset.recent }); return; }
      const c = ev.target.closest("[data-c]"); if (c) { close(); E.run(c.dataset.c); }
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === "S" || ev.key === "s")) { ev.preventDefault(); ev.stopImmediatePropagation(); E.run("SAVEAS"); }
    }, true);
    window.addEventListener("beforeunload", (ev) => { if (E.dirty && !reg() && !E.readOnly && (E.file || /^Drawing\d+$/.test((E.info && E.info.title) || ""))) { ev.preventDefault(); ev.returnValue = ""; } });
  });
  K.fileSave = save; K.fileSaveAs = saveAs;
})(window.KCAD);
