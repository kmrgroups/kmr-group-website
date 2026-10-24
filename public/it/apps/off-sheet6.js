/* KMR Office Suite - Spreadsheets, part 6: pictures and shapes on the sheet, several filters per sheet (every table has its own), slicers,
   manual calculation mode (F9), Solver, outline +/- buttons in the margin, structured references follow renamed table headers. */
(function () {
  "use strict";
  const { form, esc, IC } = OffUI, C = window.Calc, U = window.OffSheetUtil;
  const addIc = (n, p) => { if (!IC[n]) IC[n] = p; };
  addIc("image", '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/>');
  addIc("rect", '<rect x="4" y="6" width="16" height="12" rx="1"/>');
  addIc("slicer", '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>');
  addIc("calc", '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2"/>');
  addIc("trash", '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>');
  addIc("front", '<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>');
  addIc("back", '<rect x="4" y="4" width="12" height="12"/><path d="M8 20h12V8"/>');
  addIc("dup", '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>');

  (window.OffSheetP = window.OffSheetP || []).push(function (S, tabs) {
    const X_ = S.x, wb = S.wb, cs = S.cs, say = S.say, an = () => S.W.querySelector(".sfx");
    const setExt = (sh, k, v) => S.setMeta(sh, "ext", Object.assign({}, sh.ext, { [k]: v }));
    const tab = (id) => tabs.find((t) => t.id === id);
    const uid = () => Math.random().toString(36).slice(2, 8);
    const parseR = U.parseR, rstr = U.rstr;

    /* ================= manual calculation ================= */
    const setCalc = (manual) => { wb.manual = !!manual; S.api.changed(); if (!manual) { wb.invalidate(true); S.render(); } S.refreshRibbon(); say(manual ? "Manual calculation: formulas keep their old results until you press F9 (Calculate now)." : "Automatic calculation: formulas update as you type.", true); };
    const calcNow = () => { wb.invalidate(true); S.bump(); S.render(); say("Calculated.", true); };
    X_.calcNow = calcNow;
    const ftab = tab("formulas");
    if (ftab) ftab.groups.push({ label: "Calculation", items: [{ k: "menu", i: "calc", label: "Options", big: true, t: "Choose when formulas recalculate", items: () => [{ label: "Automatic", on: !wb.manual, run: () => setCalc(false) }, { label: "Manual (press F9 to calculate)", on: !!wb.manual, run: () => setCalc(true) }] }, { i: "calc", label: "Calculate now", t: "Recalculate everything (F9)", on: calcNow }] });

    /* ================= pictures and shapes ================= */
    const objs = (sh) => sh.ext.objs || [];
    let selObj = null;
    const colX = (sh, c) => { let x = 0; for (let i = 1; i < c; i++) x += sh.hiddenCols && sh.hiddenCols[i] ? 0 : sh.cols[i] || 96; return x; }, rowY = (sh, r) => { let y = 0; for (let i = 1; i < r; i++) y += sh.hiddenRows && sh.hiddenRows[i] ? 0 : sh.rows[i] || 24; return y; };
    const SH = { rect: "Rectangle", rrect: "Rounded rectangle", ellipse: "Oval", tri: "Triangle", arrow: "Arrow", line: "Line", text: "Text box" };
    const poly = { tri: "50,0 100,100 0,100" };
    const objHtml = (o, Zm) => {
      const fill = o.fill || "none", lc = (o.ln && o.ln.c) || "#1f2937", lw = o.ln && o.ln.w != null ? o.ln.w : 1.5; let inner = "";
      if (o.t === "img") inner = `<img src="${o.src}" alt="${esc(o.alt || "")}" draggable="false" style="width:100%;height:100%;display:block;pointer-events:none">`;
      else if (o.k === "line" || o.k === "arrow") inner = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible"><defs><marker id="ah${o.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="${lc}"/></marker></defs><line x1="0" y1="50" x2="100" y2="50" stroke="${lc}" stroke-width="${lw * 2}" vector-effect="non-scaling-stroke" ${o.k === "arrow" ? `marker-end="url(#ah${o.id})"` : ""}/></svg>`;
      else if (o.k === "tri") inner = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><polygon points="${poly.tri}" fill="${fill}" stroke="${lc}" stroke-width="${lw}" vector-effect="non-scaling-stroke"/></svg>`;
      else inner = `<div style="position:absolute;inset:0;background:${o.t === "text" && !o.fill ? "transparent" : fill};border:${o.t === "text" && !(o.ln && o.ln.w) ? 0 : lw}px solid ${lc};box-sizing:border-box;${o.k === "ellipse" ? "border-radius:50%" : o.k === "rrect" ? "border-radius:14%" : ""}"></div>`;
      const tx = o.tx ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:${o.t === "text" ? "flex-start" : "center"};text-align:${o.t === "text" ? "left" : "center"};padding:4px 8px;box-sizing:border-box;color:${o.fc || (o.fill && o.t !== "text" ? "#fff" : "#111")};font:${Math.round(14 * Zm)}px Calibri,Arial,sans-serif;white-space:pre-wrap;overflow:hidden;pointer-events:none">${esc(o.tx)}</div>` : "";
      return inner + tx;
    };
    const origRender = X_.renderCharts;
    X_.renderCharts = () => {
      origRender && origRender();
      const sh = cs(), host = S.sgc, Zm = S.Zm, sgs = S.W.querySelector(".sgs"); const l = objs(sh); if (!l.length) return;
      l.forEach((o) => { const d = document.createElement("div"); d.className = "xobj" + (selObj === o.id ? " on" : ""); d.dataset.id = o.id; d.title = o.alt || ""; d.style.cssText = `position:absolute;left:${Math.round(o.x * Zm - sgs.scrollLeft)}px;top:${Math.round(o.y * Zm - sgs.scrollTop)}px;width:${Math.round(o.w * Zm)}px;height:${Math.round(o.h * Zm)}px;pointer-events:auto;cursor:move;${selObj === o.id ? "outline:2px solid #2563eb;outline-offset:1px;" : ""}`; d.innerHTML = objHtml(o, Zm) + (selObj === o.id && !S.ro ? '<i class="xrz" style="position:absolute;right:-6px;bottom:-6px;width:11px;height:11px;background:#fff;border:2px solid #2563eb;cursor:nwse-resize"></i>' : ""); host.append(d); d.onmousedown = (e) => objDown(e, d); d.ondblclick = () => { if (o.t !== "img") textForm(o); }; });
    };
    function objDown(e, el) {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); S.sgv.focus({ preventScroll: true }); if (S.edit) S.commit(0, 0); const sh = cs(), id = el.dataset.id, o = objs(sh).find((q) => q.id === id); if (!o) return;
      const was = selObj; selObj = id; if (X_.chartDeselect) X_.chartDeselect(); if (was !== id) S.redrawRibbon(); X_.renderCharts(); if (S.ro) return;
      const rz = e.target.classList.contains("xrz"), x0 = e.clientX, y0 = e.clientY, st = { x: o.x, y: o.y, w: o.w, h: o.h }, before = JSON.parse(JSON.stringify(objs(sh))); let moved = false;
      const mv = (ev) => { const dx = (ev.clientX - x0) / S.Zm, dy = (ev.clientY - y0) / S.Zm; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; if (rz) { o.w = Math.max(16, Math.round(st.w + dx)); o.h = Math.max(o.k === "line" || o.k === "arrow" ? 4 : 16, Math.round(st.h + dy)); } else { o.x = Math.max(0, Math.round(st.x + dx)); o.y = Math.max(0, Math.round(st.y + dy)); } X_.renderCharts(); };
      const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); if (moved) { const after = JSON.parse(JSON.stringify(objs(sh))); sh.ext.objs = before; S.tx(() => setExt(sh, "objs", after), "move object"); X_.renderCharts(); } };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    }
    const put = (fn) => { const sh = cs(); const l = JSON.parse(JSON.stringify(objs(sh))); fn(l); S.tx(() => setExt(sh, "objs", l), "object"); X_.renderCharts(); S.redrawRibbon(); };
    const here = (w, h) => { const sh = cs(), sgs = S.W.querySelector(".sgs"); return { x: Math.round((sgs.scrollLeft + 60) / S.Zm + colX(sh, 1)), y: Math.round((sgs.scrollTop + 40) / S.Zm) }; };
    const cur = () => (selObj ? objs(cs()).find((o) => o.id === selObj) : null);
    X_.objSel = cur;
    function addShape(k) { const p = here(); const o = { id: "ob" + uid(), t: k === "text" ? "text" : "shape", k, x: p.x, y: p.y, w: k === "line" || k === "arrow" ? 160 : k === "text" ? 180 : 140, h: k === "line" || k === "arrow" ? 10 : k === "text" ? 40 : 90, fill: k === "line" || k === "arrow" || k === "text" ? null : "#4472c4", ln: { c: "#2f528f", w: 1.5 }, tx: "" }; put((l) => l.push(o)); selObj = o.id; X_.renderCharts(); S.redrawRibbon(); say("Shape added. Drag to move, drag the corner to resize, double-click to type text.", true); }
    function addPicture() {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => {
        const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const mx = 1600, k = Math.min(1, mx / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); const src = cv.toDataURL(/png|gif|svg/.test(f.type) ? "image/png" : "image/jpeg", 0.88); const sc = Math.min(1, 360 / cv.width), p = here(); const o = { id: "ob" + uid(), t: "img", src, x: p.x, y: p.y, w: Math.round(cv.width * sc), h: Math.round(cv.height * sc), alt: f.name.replace(/\.[^.]+$/, "") }; put((l) => l.push(o)); selObj = o.id; X_.renderCharts(); S.redrawRibbon(); say("Picture added. Drag to move, drag the corner to resize.", true); }; im.src = rd.result; }; rd.readAsDataURL(f);
      }; inp.click();
    }
    function textForm(o) { form(an(), "Text in the shape", [{ k: "t", label: "Text", type: "area", value: o.tx || "" }], "Save", (v) => put((l) => { const q = l.find((x) => x.id === o.id); if (q) q.tx = v.t; })); }
    const setO = (patch) => put((l) => { const q = l.find((x) => x.id === selObj); if (q) Object.assign(q, patch); });
    const delObj = () => { if (!selObj) return; const id = selObj; selObj = null; put((l) => { const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1); }); };
    const ins = tab("insert");
    if (ins) ins.groups.push({ label: "Illustrations", items: [{ i: "image", label: "Picture", big: true, t: "Put a picture on the sheet", on: addPicture }, { k: "menu", i: "rect", label: "Shapes", big: true, items: () => Object.entries(SH).map(([k, n]) => ({ label: n, run: () => addShape(k) })) }] });
    tabs.push({ id: "objfmt", label: "Picture / shape", ctx: true, when: () => !!cur(), groups: [{ label: "Format", items: [{ k: "col", i: "fill", t: "Fill colour", none: "No fill", get: () => (cur() && cur().fill) || "#4472c4", on: (c) => setO({ fill: c || null }) }, { k: "col", i: "border", t: "Outline colour", none: "No outline", get: () => (cur() && cur().ln && cur().ln.c) || "#2f528f", on: (c) => setO({ ln: { c: c || "#000000", w: c ? (cur().ln && cur().ln.w) || 1.5 : 0 } }) }, { k: "menu", i: "border", label: "Outline width", items: () => [0.5, 1, 1.5, 3, 5].map((w) => ({ label: w + " pt", run: () => setO({ ln: Object.assign({}, cur().ln, { w }) }) })) }, { i: "textbox", label: "Text", t: "Type text inside", on: () => cur() && cur().t !== "img" && textForm(cur()) }, { i: "image", label: "Alt text", t: "Describe it for screen readers", on: () => cur() && form(an(), "Description", [{ k: "a", label: "Description", value: cur().alt || "" }], "Save", (v) => setO({ alt: v.a })) }] }, { label: "Arrange", items: [{ i: "front", label: "Bring to front", on: () => put((l) => { const i = l.findIndex((x) => x.id === selObj); if (i >= 0) l.push(l.splice(i, 1)[0]); }) }, { i: "back", label: "Send to back", on: () => put((l) => { const i = l.findIndex((x) => x.id === selObj); if (i >= 0) l.unshift(l.splice(i, 1)[0]); }) }, { i: "dup", label: "Duplicate", on: () => { const o = cur(); if (!o) return; const c = Object.assign({}, JSON.parse(JSON.stringify(o)), { id: "ob" + uid(), x: o.x + 20, y: o.y + 20 }); put((l) => l.push(c)); selObj = c.id; X_.renderCharts(); } }, { i: "trash", label: "Delete", on: delObj }] }] });
    S.sgv.addEventListener("mousedown", (e) => { if (selObj && !(e.target.closest && e.target.closest(".xobj"))) { selObj = null; S.redrawRibbon(); X_.renderCharts(); } }, true);
    S.sgv.addEventListener("keydown", (e) => { if (selObj && !S.edit && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); e.stopPropagation(); if (!S.ro) delObj(); } if (e.key === "F9") { e.preventDefault(); e.stopPropagation(); calcNow(); } }, true);

    /* ================= several filters + table filters ================= */
    const prim = (sh) => (sh.filter && sh.filter.range ? sh.filter : null);
    const extF = (sh) => sh.ext.filters || [];
    const tbls = (sh) => (X_.tables && X_.tables.list ? X_.tables.list(sh) : []);
    function allF(sh) { // [{key, f, save(f)}]
      const out = []; const p = prim(sh); if (p) out.push({ key: "p", f: p, name: "Filter " + p.range, save: (f) => S.setMeta(sh, "filter", f) });
      extF(sh).forEach((f, i) => out.push({ key: "e" + i, f, name: "Filter " + f.range, save: (nf) => setExt(sh, "filters", extF(sh).map((x, j) => (j === i ? nf : x))) }));
      tbls(sh).forEach((t) => { if (t.filt === false || t.hdr === false) return; if (p && p.range === t.range) return; if (extF(sh).some((f) => f.range === t.range)) return; const f = t.fl || { range: t.range, cols: {}, hidden: [] }; out.push({ key: "t" + t.id, f: Object.assign({}, f, { range: t.range }), name: "Table " + t.name, save: (nf) => setExt(sh, "tables", tbls(sh).map((x) => (x.id === t.id ? Object.assign({}, x, { fl: nf }) : x))) }); });
      return out;
    }
    const valText = (sh, r, c) => String(wb.text(sh, r, c).text || "");
    function applyF(sh, ent, f) {
      const g = parseR(f.range), hr = Object.assign({}, sh.hiddenRows); (ent.f.hidden || []).forEach((r) => delete hr[r]);
      allF(sh).forEach((o) => { if (o.key !== ent.key) (o.f.hidden || []).forEach((r) => (hr[r] = 1)); });
      const nh = []; for (let r = g.r1 + 1; r <= g.r2; r++) { let ok = true; for (const c in f.cols) { const cr = f.cols[c]; if (!cr) continue; if (cr.allow.indexOf(valText(sh, r, +c) || "(Blanks)") < 0) { ok = false; break; } } if (!ok) { nh.push(r); hr[r] = 1; } }
      f.hidden = nh; S.tx(() => { S.setMeta(sh, "hiddenRows", hr); ent.save(f); });
    }
    const at = (sh, r, c) => allF(sh).filter((e) => { const g = parseR(e.f.range); return g && r === g.r1 && c >= g.c1 && c <= g.c2; })[0];
    X_.filterBtn = (sh, r, c) => { const e = at(sh, r, c); return e ? { on: !!(e.f.cols && e.f.cols[c] && Object.keys(e.f.cols).length) } : null; };
    const origRowAttr = X_.filterBtn;
    X_.clearFilter = () => { const sh = cs(); allF(sh).forEach((e) => { if (Object.keys(e.f.cols || {}).length) { const f = JSON.parse(JSON.stringify(e.f)); f.cols = {}; applyF(sh, e, f); } }); };
    X_.toggleFilter = () => {
      const sh = cs(), cur2 = S.cur; const hit = allF(sh).find((e) => { const g = parseR(e.f.range); return g && cur2.r >= g.r1 && cur2.r <= g.r2 && cur2.c >= g.c1 && cur2.c <= g.c2; });
      if (hit) { const f = JSON.parse(JSON.stringify(hit.f)); f.cols = {}; applyF(sh, hit, f); S.tx(() => { if (hit.key === "p") S.setMeta(sh, "filter", null); else if (hit.key[0] === "e") setExt(sh, "filters", extF(sh).filter((x) => x.range !== hit.f.range)); else if (hit.key[0] === "t") setExt(sh, "tables", tbls(sh).map((t) => (t.id === hit.key.slice(1) ? Object.assign({}, t, { filt: false, fl: null }) : t))); }); say("Filter removed from this range."); return; }
      const g = S.sel.r2 > S.sel.r1 || S.sel.c2 > S.sel.c1 ? (S.whole ? S.region(S.cur.r, S.cur.c) : S.sel) : S.region(S.cur.r, S.cur.c); if (g.c2 === g.c1 && g.r2 === g.r1) { say("Click inside your table first, then turn the filter on."); return; }
      const nf = { range: C.addr(g.r1, g.c1) + ":" + C.addr(g.r2, g.c2), cols: {}, hidden: [] }; S.tx(() => { if (!prim(sh)) S.setMeta(sh, "filter", nf); else setExt(sh, "filters", extF(sh).concat([nf])); }); say("Filter added. You can have several filters on one sheet, as long as they do not overlap.", true);
    };
    X_.filterMenu = (c, el, rowHint) => {
      const sh = cs(); const ent = allF(sh).find((e) => { const g = parseR(e.f.range); return g && (rowHint == null || g.r1 === rowHint) && c >= g.c1 && c <= g.c2; }) || allF(sh)[0]; if (!ent) return; filterPop(sh, ent, c, el);
    };
    function filterPop(sh, ent, c, el) {
      const f = JSON.parse(JSON.stringify(ent.f)), g = parseR(f.range), uniq = new Map(); for (let r = g.r1 + 1; r <= g.r2; r++) { const t = valText(sh, r, c) || "(Blanks)"; uniq.set(t, (uniq.get(t) || 0) + 1); }
      const list = [...uniq.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })).slice(0, 2000), cu = f.cols[c];
      const html = `<div style="min-width:230px;padding:4px"><div style="display:flex;gap:6px"><button class="btn o s" data-s="a">Sort A → Z</button><button class="btn o s" data-s="d">Z → A</button></div><input id="fl_q" placeholder="Search…" style="width:100%;margin:8px 0 4px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)"><label style="display:flex;gap:6px;align-items:center;font-size:13px;padding:2px 0"><input type="checkbox" id="fl_all" style="width:auto"> <b>(Select all)</b></label><div id="fl_l" style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:4px">${list.map((t) => `<label style="display:flex;gap:6px;align-items:center;font-size:13px;padding:1px 0" data-t="${esc(t.toLowerCase())}"><input type="checkbox" data-v="${esc(t)}" style="width:auto"${!cu || cu.allow.indexOf(t) >= 0 ? " checked" : ""}> ${esc(t)} <span style="color:var(--mut)">(${uniq.get(t)})</span></label>`).join("")}</div><div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end"><button class="btn o s of-no">Cancel</button><button class="btn s of-ok">OK</button></div></div>`;
      OffUI.pop(el, html, (m) => {
        const boxes = () => [...m.querySelectorAll("#fl_l input")], all = m.querySelector("#fl_all"); const sync = () => { all.checked = boxes().every((b) => b.checked); }; sync(); all.onchange = () => boxes().forEach((b) => { if (b.parentNode.style.display !== "none") b.checked = all.checked; });
        boxes().forEach((b) => (b.onchange = sync)); m.querySelector("#fl_q").oninput = (e) => { const q = e.target.value.toLowerCase(); m.querySelectorAll("#fl_l label").forEach((l) => (l.style.display = !q || l.dataset.t.indexOf(q) >= 0 ? "" : "none")); };
        m.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { OffUI.closeMenu(); S.setSel(g.r1 + 1, c, g.r1 + 1, c); X_.sortBy(b.dataset.s === "a", c); })); m.querySelector(".of-no").onclick = OffUI.closeMenu;
        m.querySelector(".of-ok").onclick = () => { const on = boxes().filter((b) => b.checked).map((b) => b.dataset.v); OffUI.closeMenu(); if (on.length === boxes().length) delete f.cols[c]; else f.cols[c] = { allow: on }; applyF(sh, ent, f); if (paneOpen) drawPane(); };
      });
    }
    /* make sure the filter button knows its own row, so several filters can share one sheet */
    X_.filterRowAttr = true;

    /* ================= slicers (side pane) ================= */
    const sl = (sh) => sh.ext.slicers || [];
    const pane = document.createElement("div"); pane.style.cssText = "display:none;position:absolute;right:0;top:0;bottom:0;width:230px;background:var(--card,#fff);color:var(--ink,#111);border-left:1px solid var(--line,#d1d5db);overflow:auto;padding:8px;font:13px Calibri,Arial,sans-serif;z-index:30;box-shadow:-2px 0 8px rgba(0,0,0,.08)"; S.W.querySelector(".sgw").style.position = "relative"; S.W.querySelector(".sgw").append(pane); let paneOpen = false;
    function drawPane() {
      const sh = cs(), list = sl(sh), F = allF(sh);
      pane.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>Slicers</b><span><button class="btn o s" data-a="add">+ New</button> <button class="btn o s" data-a="x">✕</button></span></div>` + (list.length ? list.map((s) => { const e = F.find((x) => x.key === s.src) || F.find((x) => x.f.range === s.range); if (!e) return `<div class="mut" style="margin:6px 0">${esc(s.title)}: its filter was removed.</div>`; const g = parseR(e.f.range), vals = new Map(); for (let r = g.r1 + 1; r <= g.r2; r++) { const t = valText(sh, r, s.col) || "(Blanks)"; vals.set(t, 1); } const cu = e.f.cols[s.col]; return `<div style="border:1px solid var(--line,#d1d5db);border-radius:8px;margin:8px 0;padding:6px"><div style="display:flex;justify-content:space-between"><b>${esc(s.title)}</b><span><button class="btn o s" data-c="${s.id}" title="Show all">⟲</button> <button class="btn o s" data-d="${s.id}" title="Remove slicer">✕</button></span></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:200px;overflow:auto">${[...vals.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 200).map((v) => `<button class="btn o s" data-s="${s.id}" data-v="${esc(v)}" style="${!cu || cu.allow.indexOf(v) >= 0 ? "background:#2563eb;color:#fff" : "opacity:.55"}">${esc(v)}</button>`).join("")}</div></div>`; }).join("") : '<div class="mut">A slicer is a set of buttons that filters a table. Click “+ New”, or Data ▸ Slicer.</div>');
      pane.querySelector("[data-a=x]").onclick = () => { paneOpen = false; pane.style.display = "none"; }; pane.querySelector("[data-a=add]").onclick = slicerForm;
      pane.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { S.tx(() => setExt(sh, "slicers", sl(sh).filter((x) => x.id !== b.dataset.d))); drawPane(); }));
      pane.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { const s = sl(sh).find((x) => x.id === b.dataset.c), e = allF(sh).find((x) => x.key === s.src); if (!e) return; const f = JSON.parse(JSON.stringify(e.f)); delete f.cols[s.col]; applyF(sh, e, f); drawPane(); }));
      pane.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { const s = sl(sh).find((x) => x.id === b.dataset.s), e = allF(sh).find((x) => x.key === s.src); if (!e) return; const g = parseR(e.f.range), all = new Set(); for (let r = g.r1 + 1; r <= g.r2; r++) all.add(valText(sh, r, s.col) || "(Blanks)"); const f = JSON.parse(JSON.stringify(e.f)); let on = f.cols[s.col] ? f.cols[s.col].allow.slice() : [...all]; const v = b.dataset.v; if (on.length === all.size && f.cols[s.col] == null) on = [v]; else on = on.includes(v) ? on.filter((x) => x !== v) : on.concat([v]); if (on.length === 0 || on.length === all.size) delete f.cols[s.col]; else f.cols[s.col] = { allow: on }; applyF(sh, e, f); drawPane(); }));
    }
    function openPane() { paneOpen = !paneOpen; pane.style.display = paneOpen ? "" : "none"; if (paneOpen) drawPane(); }
    function slicerForm() {
      const sh = cs(), F = allF(sh); if (!F.length) { say("Turn on a filter or make a table first (Data ▸ Filter, or Insert ▸ Table), then add a slicer."); return; }
      const srcOpts = F.map((e) => [e.key, e.name]); const first = F[0], g0 = parseR(first.f.range); const colOpts = (e) => { const g = parseR(e.f.range), o = []; for (let c = g.c1; c <= g.c2; c++) o.push([c, valText(sh, g.r1, c) || "Column " + C.nCol(c)]); return o; };
      form(an(), "New slicer", [{ k: "src", label: "Filter or table", type: "select", opts: srcOpts, value: first.key }, { k: "col", label: "Column (type its position: 1 = first column of that table)", type: "number", value: 1 }], "Add slicer", (v) => { const e = F.find((x) => x.key === v.src) || first, g = parseR(e.f.range), cc = g.c1 + Math.max(0, Math.min(g.c2 - g.c1, (+v.col || 1) - 1)); S.tx(() => setExt(sh, "slicers", sl(sh).concat([{ id: "sl" + uid(), src: e.key, range: e.f.range, col: cc, title: valText(sh, g.r1, cc) || "Slicer" }]))); paneOpen = true; pane.style.display = ""; drawPane(); }); void g0; void colOpts;
    }
    const dt = tab("data");
    if (dt) dt.groups.push({ label: "Slicers", items: [{ i: "slicer", label: "Slicers", big: true, t: "Buttons that filter a table", on: openPane, act: () => paneOpen }] });

    /* ================= Solver ================= */
    const cellRef = (t, sh) => { const m = /^(?:'?([^'!]+)'?!)?\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(t).trim()); if (!m) return null; const s2 = m[1] ? wb.sheet(m[1]) : sh; if (!s2) return null; const p = C.parseAddr(m[2] + m[3]); return p ? { sh: s2, r: p.r, c: p.c } : null; };
    function solverForm() {
      const sh = cs(); form(an(), "Solver", [{ k: "obj", label: "Set objective (a cell with a formula)", value: C.addr(S.cur.r, S.cur.c) }, { k: "goal", label: "To", type: "select", opts: [["max", "Maximum"], ["min", "Minimum"], ["val", "A specific value"]], value: "max" }, { k: "tv", label: "Value (only for ‘A specific value’)", value: "0" }, { k: "vars", label: "By changing these cells, e.g. B2:B5 or B2,B4", value: "" }, { k: "cons", label: "Subject to (one per line), e.g.  B2:B5>=0   C7<=100   B2:B5=int", type: "area", value: "" }, { k: "nn", label: " ", type: "check", ph: "Make unconstrained variables non-negative", value: true }], "Solve", (v) => runSolver(sh, v));
    }
    function parseCells(txt, sh) { const out = []; String(txt).split(",").forEach((part) => { const g = parseR(part.trim().replace(/^.*!/, "")); if (g) for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) out.push({ sh, r, c }); }); return out; }
    function runSolver(sh, v) {
      const obj = cellRef(v.obj, sh), vars = parseCells(v.vars, sh); if (!obj || !vars.length) { say("Fill in the objective cell and the cells to change."); return; } if (vars.length > 40) { say("Solver handles up to 40 changing cells."); return; }
      const cons = []; for (const line of String(v.cons || "").split(/\r?\n/)) { const t = line.trim(); if (!t) continue; const m = /^(.+?)\s*(<=|>=|=<|=>|=|<|>)\s*(.+)$/.exec(t); if (!m) { say("I can't read the constraint: " + t); return; } const lhs = parseCells(m[1], sh); if (!lhs.length) { say("I can't find the cells in: " + t); return; } const rhsT = m[3].trim(); cons.push({ lhs, op: m[2].replace("=<", "<=").replace("=>", ">="), int: /^int(eger)?$/i.test(rhsT), bin: /^bin(ary)?$/i.test(rhsT), rhsRef: cellRef(rhsT, sh), rhs: parseFloat(rhsT) }); }
      const saved = vars.map((q) => { const x = q.sh.get(q.r, q.c); return x ? JSON.parse(JSON.stringify(x)) : null; }); const x0 = vars.map((q) => { const x = q.sh.get(q.r, q.c); return x && typeof x.v === "number" ? x.v : 0; });
      const isInt = vars.map(() => false), lo = vars.map(() => (v.nn ? 0 : -1e9)), hi = vars.map(() => 1e9);
      cons.forEach((k) => { if (k.int || k.bin) k.lhs.forEach((q) => { const i = vars.findIndex((z) => z.r === q.r && z.c === q.c && z.sh === q.sh); if (i >= 0) { isInt[i] = true; if (k.bin) { lo[i] = 0; hi[i] = 1; } } }); else if (!k.rhsRef && isFinite(k.rhs)) k.lhs.forEach((q) => { const i = vars.findIndex((z) => z.r === q.r && z.c === q.c && z.sh === q.sh); if (i >= 0) { if (/>/.test(k.op) ) lo[i] = Math.max(lo[i], k.rhs); if (/</.test(k.op)) hi[i] = Math.min(hi[i], k.rhs); if (k.op === "=") { lo[i] = k.rhs; hi[i] = k.rhs; } } }); });
      const setVals = (x) => { vars.forEach((q, i) => { const o = q.sh.get(q.r, q.c) || {}; q.sh.set(q.r, q.c, Object.assign({}, o, { v: x[i], f: undefined })); }); wb.invalidate(true); };
      const sign = v.goal === "min" ? 1 : v.goal === "max" ? -1 : 0, tv = parseFloat(v.tv) || 0; let evals = 0;
      const f = (x0v) => {
        evals++; const x = x0v.map((val, i) => { let y = Math.min(hi[i], Math.max(lo[i], val)); if (isInt[i]) y = Math.round(y); return y; }); setVals(x); let o = wb.value(obj.sh, obj.r, obj.c); if (typeof o !== "number") return 1e18; let pen = 0;
        cons.forEach((k) => { if (k.int || k.bin) return; k.lhs.forEach((q) => { const a = wb.value(q.sh, q.r, q.c); if (typeof a !== "number") { pen += 1e6; return; } let b = k.rhs; if (k.rhsRef) { b = wb.value(k.rhsRef.sh, k.rhsRef.r, k.rhsRef.c); } if (typeof b !== "number") { pen += 1e6; return; } const d = k.op === "<=" || k.op === "<" ? a - b : k.op === ">=" || k.op === ">" ? b - a : Math.abs(a - b); if (d > 1e-9) pen += d; }); });
        const base = sign === 0 ? Math.abs(o - tv) : sign * o; return base + pen * 1e4 * (1 + Math.abs(base) * 0.01);
      };
      const n = vars.length; let best = x0.slice(), fb = f(best);
      const nelder = (start, scale) => { const P = [start.slice()]; for (let i = 0; i < n; i++) { const p = start.slice(); p[i] += (Math.abs(p[i]) > 1e-9 ? p[i] * scale : scale); P.push(p); } let F = P.map(f); for (let it = 0; it < 400 * n; it++) { const ord = F.map((_, i) => i).sort((a, b) => F[a] - F[b]); const P2 = ord.map((i) => P[i]), F2 = ord.map((i) => F[i]); P.splice(0, P.length, ...P2); F = F2; if (Math.abs(F[n] - F[0]) < 1e-10 * (1 + Math.abs(F[0]))) break; const cen = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += P[i][j] / n; const ref = cen.map((c, j) => c + (c - P[n][j])), fr = f(ref); if (fr < F[0]) { const exp = cen.map((c, j) => c + 2 * (c - P[n][j])), fe = f(exp); if (fe < fr) { P[n] = exp; F[n] = fe; } else { P[n] = ref; F[n] = fr; } } else if (fr < F[n - 1]) { P[n] = ref; F[n] = fr; } else { const con = cen.map((c, j) => c + 0.5 * (P[n][j] - c)), fc = f(con); if (fc < F[n]) { P[n] = con; F[n] = fc; } else for (let i = 1; i <= n; i++) { P[i] = P[i].map((x, j) => P[0][j] + 0.5 * (x - P[0][j])); F[i] = f(P[i]); } } } let bi = 0; F.forEach((x, i) => { if (x < F[bi]) bi = i; }); return { x: P[bi], f: F[bi] }; };
      try {
        const rnd = () => Math.random();
        for (let rs = 0; rs < 7; rs++) { const st = rs === 0 ? best : best.map((b, i) => Math.min(hi[i] > 1e8 ? 1e6 : hi[i], Math.max(lo[i] < -1e8 ? -1e6 : lo[i], b + (rnd() - 0.5) * (Math.abs(b) + 10) * (rs < 4 ? 0.6 : 3)))); const r = nelder(st, rs % 2 ? 0.5 : 0.1); if (r.f < fb) { fb = r.f; best = r.x.slice(); } }
        // coordinate polish for integers
        let improved = true, pass = 0; while (improved && pass++ < 30) { improved = false; for (let i = 0; i < n; i++) for (const d of isInt[i] ? [1, -1] : [0.001 * (Math.abs(best[i]) + 1), -0.001 * (Math.abs(best[i]) + 1)]) { const t = best.slice(); t[i] += d; const ft = f(t); if (ft < fb - 1e-12) { fb = ft; best = t; improved = true; } } }
      } finally { vars.forEach((q, i) => { if (saved[i]) q.sh.set(q.r, q.c, saved[i]); else q.sh.del(q.r, q.c); }); wb.invalidate(true); }
      const fin = best.map((val, i) => { let y = Math.min(hi[i], Math.max(lo[i], val)); if (isInt[i]) y = Math.round(y); return +y.toPrecision(10); });
      setVals(fin); const ov = wb.value(obj.sh, obj.r, obj.c); let bad = 0; cons.forEach((k) => { if (k.int || k.bin) return; k.lhs.forEach((q) => { const a = wb.value(q.sh, q.r, q.c); let b = k.rhsRef ? wb.value(k.rhsRef.sh, k.rhsRef.r, k.rhsRef.c) : k.rhs; if (typeof a === "number" && typeof b === "number") { const d = k.op === "<=" || k.op === "<" ? a - b : k.op === ">=" || k.op === ">" ? b - a : Math.abs(a - b); if (d > 1e-6) bad++; } }); });
      vars.forEach((q, i) => { const o = saved[i] ? JSON.parse(JSON.stringify(saved[i])) : null; q.sh.set(q.r, q.c, o); if (!o) q.sh.del(q.r, q.c); }); wb.invalidate(true);
      if (bad) { S.bump(); S.render(); say("Solver could not satisfy every constraint (" + bad + " broken). Your numbers were left unchanged. Check that the constraints can all be true together.", false); return; }
      S.tx(() => vars.forEach((q, i) => { const o = q.sh.get(q.r, q.c); S.putCell(q.sh, q.r, q.c, Object.assign({}, o ? JSON.parse(JSON.stringify(o)) : {}, { v: fin[i], f: undefined })); }), "solver"); S.render();
      say("Solver found an answer: " + C.addr(obj.r, obj.c) + " = " + (typeof ov === "number" ? +ov.toPrecision(10) : ov) + " after " + evals + " tries. It is a good answer, though not guaranteed to be the very best for complex problems. (Ctrl+Z restores your old numbers.)", true);
    }
    if (dt) dt.groups.push({ label: "Analysis", items: [{ i: "param", label: "Solver", big: true, t: "Find the best values for several cells within limits", on: solverForm }] });
    X_.solver = solverForm;

    /* ================= outline +/- buttons ================= */
    const prevOv = X_.overlayExtra;
    const grp = (sh) => sh.ext.grp || { rows: [], cols: [] };
    X_.overlayExtra = (sh, rectOf) => {
      let h = prevOv ? prevOv(sh, rectOf) || "" : ""; const g = grp(sh); if (!g.rows.length && !g.cols.length) return h;
      g.rows.forEach((o, i) => { if (o.b - o.a > 3000) return; const top = rectOf(o.a, 1, o.a, 1), sum = rectOf(Math.min(o.b + 1, 1048575), 1, Math.min(o.b + 1, 1048575), 1), bot = rectOf(o.b, 1, o.b, 1); if (bot.y + bot.h < 0) return; h += `<div style="position:absolute;left:1px;top:${top.y}px;width:6px;height:${bot.y + bot.h - top.y}px;border-left:2px solid #6b7280;border-top:2px solid #6b7280;border-bottom:2px solid #6b7280;box-sizing:border-box;pointer-events:none;opacity:.7"></div><div data-og="r${i}" title="${o.c ? "Show" : "Hide"} the grouped rows" style="position:absolute;left:1px;top:${sum.y + Math.max(0, (sum.h - 14) / 2)}px;width:14px;height:14px;line-height:12px;text-align:center;font:700 12px Arial;background:#fff;border:1px solid #6b7280;color:#111;cursor:pointer;pointer-events:auto;z-index:5">${o.c ? "+" : "−"}</div>`; });
      g.cols.forEach((o, i) => { const left = rectOf(1, o.a, 1, o.a), right = rectOf(1, o.b, 1, o.b), sum = rectOf(1, o.b + 1, 1, o.b + 1); h += `<div style="position:absolute;top:1px;left:${left.x}px;height:6px;width:${right.x + right.w - left.x}px;border-top:2px solid #6b7280;border-left:2px solid #6b7280;border-right:2px solid #6b7280;box-sizing:border-box;pointer-events:none;opacity:.7"></div><div data-og="c${i}" title="${o.c ? "Show" : "Hide"} the grouped columns" style="position:absolute;top:1px;left:${sum.x + Math.max(0, (sum.w - 14) / 2)}px;width:14px;height:14px;line-height:12px;text-align:center;font:700 12px Arial;background:#fff;border:1px solid #6b7280;color:#111;cursor:pointer;pointer-events:auto;z-index:5">${o.c ? "+" : "−"}</div>`; });
      return h;
    };
    S.sgv.addEventListener("mousedown", (e) => {
      const b = e.target.closest && e.target.closest("[data-og]"); if (!b) return; e.preventDefault(); e.stopPropagation(); if (S.ro) return;
      const sh = cs(), g = grp(sh), ax = b.dataset.og[0], i = +b.dataset.og.slice(1), arr = ax === "r" ? g.rows : g.cols, o = arr[i]; if (!o) return; const key = ax === "r" ? "hiddenRows" : "hiddenCols", hid = Object.assign({}, sh[key]); const show = !!o.c;
      for (let k = o.a; k <= o.b; k++) { if (show) delete hid[k]; else hid[k] = 1; }
      S.tx(() => { S.setMeta(sh, key, hid); setExt(sh, "grp", { rows: ax === "r" ? g.rows.map((x, j) => (j === i ? Object.assign({}, x, { c: !show }) : x)) : g.rows, cols: ax === "c" ? g.cols.map((x, j) => (j === i ? Object.assign({}, x, { c: !show }) : x)) : g.cols }); }); S.layout(); S.render();
    }, true);

    /* ================= table header rename keeps formulas working ================= */
    const hdrSnap = new Map();
    const snapTable = (sh, t) => { const g = parseR(t.range); if (!g) return null; const names = []; for (let c = g.c1; c <= g.c2; c++) names.push(String(wb.text(sh, g.r1, c).text || "")); hdrSnap.set(t.id, names); return names; };
    const prevSel = X_.onSelect; X_.onSelect = function () { try { const sh = cs(), t = X_.tables && X_.tables.at ? X_.tables.at(sh, S.cur.r, S.cur.c) : null; if (t) snapTable(sh, t); } catch (e) { /* ignore */ } return prevSel ? prevSel.apply(this, arguments) : undefined; };
    const prevEdit = X_.onEdit;
    X_.onEdit = function (sh, r, c, text) {
      const t = X_.tables && X_.tables.at ? X_.tables.at(sh, r, c) : null; let old = null;
      if (t && t.hdr !== false) { const g = parseR(t.range); if (g && r === g.r1) old = (hdrSnap.get(t.id) || [])[c - g.c1]; }
      if (prevEdit) prevEdit.apply(this, arguments);
      if (t && old != null && old !== "" && String(text).trim() !== "" && String(text).trim() !== old) {
        const nw = String(text).trim(), esc2 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const g = parseR(t.range);
        wb.sheets.forEach((s2) => s2.m.forEach((cell, k) => {
          if (!cell.f) return; let f = cell.f; const [rr, cc] = C.unkey(k);
          const re1 = new RegExp("(" + esc2(t.name) + "\\[(?:\\[#[^\\]]*\\],)?\\[?)" + esc2(old) + "(\\]?\\])", "gi"); f = f.replace(re1, (m, a, b) => a + nw + b);
          if (s2 === sh && rr > g.r1 && rr <= g.r2 && cc >= g.c1 && cc <= g.c2) f = f.replace(new RegExp("(\\[@\\[?)" + esc2(old) + "(\\]?\\])", "gi"), (m, a, b) => a + nw + b);
          if (f !== cell.f) { S.putCell(s2, rr, cc, Object.assign({}, JSON.parse(JSON.stringify(cell)), { f })); }
        }));
        snapTable(sh, t); sh.m.forEach((cell) => delete cell.ast); wb.sheets.forEach((s2) => s2.m.forEach((cell) => delete cell.ast));
      } else if (t) snapTable(sh, t);
    };

    /* tables made while another filter exists get their own filter */
    const origCreate = X_.createTable; if (origCreate) X_.createTable = function () { const r = origCreate.apply(this, arguments); return r; };
    S.sgc.addEventListener && 0;
  });
})();
