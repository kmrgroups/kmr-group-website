/* KMR Office Suite - Documents editor (word processor): ribbon, page view, tables, pictures, find & replace, comments, templates, .docx import/export, printing through the KMR report frame. */
(function () {
  "use strict";
  const { ic, esc, make, menu, form, pop, closeMenu, num } = OffUI, Z = window.OffZip;
  const FONTS = ["Calibri", "Arial", "Cambria", "Candara", "Consolas", "Courier New", "Garamond", "Georgia", "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Comic Sans MS", "Impact"];
  const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  const PAGES = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
  const MM = 3.7795;
  const MARGINS = { Normal: { t: 25.4, r: 25.4, b: 25.4, l: 25.4 }, Narrow: { t: 12.7, r: 12.7, b: 12.7, l: 12.7 }, Moderate: { t: 25.4, r: 19.1, b: 25.4, l: 19.1 }, Wide: { t: 25.4, r: 50.8, b: 25.4, l: 50.8 } };
  const SYMS = "© ® ™ § ¶ † ‡ • ◦ ▪ → ← ↑ ↓ ↔ ⇒ ⇔ ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ π Ω μ α β γ δ θ λ σ φ ° ′ ″ ‰ € £ ¥ ₹ ¢ ¼ ½ ¾ ² ³ ¹ ✓ ✗ ☐ ☑ ★ ☆ ♦ ♣ ♥ ♠ ⌀ ∅ ⊥ ∥ ∠".split(" ");

  const css = `
.dsc{flex:1;overflow:auto;padding:22px 0 60px;min-width:0}.dzoom{transform-origin:top center;margin:0 auto;width:max-content}
.dpage{position:relative;background:#fff;color:#111;box-shadow:0 2px 14px #0003;margin:0 auto;box-sizing:border-box;font:11pt/1.18 Calibri,Carlito,Arial,sans-serif}
.ded{outline:none;min-height:200px;word-wrap:break-word;overflow-wrap:anywhere;position:relative;z-index:1}.ded:empty:before{content:"Start typing…";color:#9ca3af}
.ded p,.ded li,.ded div{margin:0 0 6pt}.ded ul,.ded ol{margin:0 0 6pt;padding-left:30px}.ded blockquote{margin:6pt 0 6pt 28px;padding-left:12px;border-left:4px solid #cbd5e1;color:#475569;font-style:italic}
.ded h1{font-size:18pt;color:#1f3864;margin:16pt 0 6pt}.ded h2{font-size:15pt;color:#2f5496;margin:12pt 0 5pt}.ded h3{font-size:13pt;color:#2f5496;margin:10pt 0 4pt}.ded h4{font-size:12pt;font-style:italic;margin:8pt 0 4pt}.ded h5,.ded h6{font-size:11pt;margin:8pt 0 3pt}
.ded .t-title{font-size:28pt;font-weight:700;color:#1f3864;margin:0 0 8pt}.ded .t-sub{font-size:15pt;color:#595959;margin:0 0 10pt}.ded pre{font:10pt/1.35 Consolas,"Courier New",monospace;background:#f2f2f2;padding:8px 10px;border-radius:4px;white-space:pre-wrap;margin:0 0 6pt}
.ded table{border-collapse:collapse;margin:4pt 0 8pt;max-width:100%}.ded td,.ded th{border:1px solid #808080;padding:4px 7px;vertical-align:top;min-width:30px}.ded th{background:#e7e9f2;text-align:left}.ded table.nb td,.ded table.nb th{border-color:transparent}
.ded img{max-width:100%;cursor:default}.ded img.isel{outline:2px solid #2563eb}.ded .pb{height:0;border-top:2px dashed #94a3b8;margin:14px 0;position:relative;break-after:page;page-break-after:always}.ded .pb:after{content:"Page break";position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;font:10px sans-serif;color:#64748b}
.ded hr{border:0;border-top:1px solid #808080;margin:8pt 0}.ded a{color:#0563c1}.ded .cmt{background:#fef08a;border-bottom:2px solid #eab308}.ded .toc{border:1px dashed #cbd5e1;padding:8px 12px;margin:0 0 8pt}.ded .toc a{display:block;text-decoration:none}.ded .toc p{margin:0 0 3px}
.dhf{position:absolute;left:0;right:0;outline:none;font-size:9pt;color:#64748b;z-index:2;min-height:14px}.dhf:empty:before{content:attr(data-ph);color:#cbd5e1}.dh{top:10mm}.df{bottom:8mm}
.dgd{position:absolute;left:0;right:0;top:0;pointer-events:none;z-index:3}.dgd i{position:absolute;left:0;right:0;border-top:1px dashed #94a3b8}.dgd i:after{content:attr(data-p);position:absolute;right:8px;top:2px;font:10px sans-serif;color:#94a3b8}
.dhs{position:absolute;z-index:6;width:12px;height:12px;background:#2563eb;border:2px solid #fff;border-radius:50%;cursor:nwse-resize;display:none}
.dcm{margin-bottom:8px;border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--bg);font-size:13px}.dcm.res{opacity:.5}.dcm b{font-size:12px}.dcm .q{color:var(--mut);font-style:italic;margin:2px 0}
.dfr mark{background:#fde047}
.dprint{display:none}@media print{body.opv2 > *:not(.dprint):not(script):not(style){display:none!important}body.opv2 .dprint{display:block!important;background:#fff;color:#000}.dprint .phf{width:100%;border-collapse:collapse}.dprint .phf td{padding:0;vertical-align:top}.dprint thead{display:table-header-group}.dprint tfoot{display:table-footer-group}.dprint .phh{padding-bottom:4mm!important;font-size:10pt}.dprint .pff{padding-top:4mm!important;font-size:10pt}body.opv .ofw{background:#fff!important}body.opv .dsc{padding:0!important;overflow:visible!important}body.opv .dzoom{zoom:1!important;transform:none!important;width:auto!important}body.opv .dpage{box-shadow:none!important;width:auto!important;margin:0!important;min-height:0!important;padding-top:0!important;padding-bottom:0!important}body.opv .dgd,body.opv .dhf,body.opv .dhs{display:none!important}body.opv .ded .pb{border:0!important;margin:0!important}body.opv .ded .pb:after{display:none}body.opv .ded .cmt{background:none;border:0}body.opv .ded table,body.opv .ded img,body.opv .ded tr{break-inside:avoid}}
`;
  const stl = document.createElement("style"); stl.textContent = css; document.head.append(stl);

  /* ---------- html safety: anything coming from paste, import or the database is cleaned first ---------- */
  const ALLOW = /^(a|b|i|u|s|strong|em|del|ins|sub|sup|mark|code|kbd|tt|span|font|p|div|br|hr|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tfoot|tr|td|th|colgroup|col|img|caption|small|big|cite|section|article|header|footer|figure|figcaption|center)$/;
  function clean(html, o) {
    o = o || {}; const d = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html"), r = d.body;
    r.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,select,textarea,svg,math,title,head,base,noscript,template").forEach((e) => e.remove());
    r.querySelectorAll("*").forEach((e) => {
      const t = e.localName; if (!ALLOW.test(t)) { e.replaceWith(...e.childNodes); return; }
      [...e.attributes].forEach((a) => {
        const n = a.name.toLowerCase(), v = a.value;
        if (/^on/.test(n) || n === "srcdoc" || n === "formaction") e.removeAttribute(a.name);
        else if ((n === "href") && /^\s*(javascript|data|vbscript):/i.test(v)) e.removeAttribute(a.name);
        else if (n === "src" && !(/^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);/i.test(v) || (o.http && /^https?:/i.test(v)))) e.removeAttribute(a.name);
        else if (n === "style") { const s = v.replace(/mso-[^;]+;?/gi, "").replace(/expression\([^)]*\)|url\([^)]*\)|@import|behavior:|javascript:/gi, "").trim(); if (s) e.setAttribute("style", s); else e.removeAttribute("style"); }
        else if (n === "class") { const keep = v.split(/\s+/).filter((c) => /^(pb|cb|toc|nb|t-title|t-sub|cmt|dt|hr|fld|fnr|fns|fn|bm|xref|cap|capn|eq|fr|tbx|mf|dc|tt|tn|ml|tgt|ct0|ct1|ct2|ct3|ct4|ct5|sig|cover|note|rad|ix|idx|bib|cit|tl)$/.test(c)); if (keep.length) e.setAttribute("class", keep.join(" ")); else e.removeAttribute("class"); }
        else if (!/^(href|src|alt|colspan|rowspan|width|height|align|valign|title|target|id|data-c|data-lvl|data-bc|contenteditable|face|size|color|start|type|dir|lang|data-[a-z]+)$/.test(n)) e.removeAttribute(a.name);
      });
      if (t === "a" && e.getAttribute("href") && !/^#/.test(e.getAttribute("href"))) { e.setAttribute("target", "_blank"); e.setAttribute("rel", "noopener noreferrer"); }
    });
    r.querySelectorAll(".pb").forEach((e) => { e.setAttribute("contenteditable", "false"); e.innerHTML = ""; });
    return r.innerHTML;
  }

  /* ---------- templates ---------- */
  const T = (rows, cls) => `<table class="dt${cls ? " " + cls : ""}"><tbody>${rows.map((r) => `<tr>${r.map((c) => (c && c.h ? `<th>${c.h}</th>` : `<td>${c == null ? "<br>" : c}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;
  const ctl = (title) => T([[{ h: "Document no." }, "<br>", { h: "Revision" }, "00", { h: "Date" }, "<br>"], [{ h: "Prepared by" }, "<br>", { h: "Reviewed by" }, "<br>", { h: "Approved by" }, "<br>"]]) + `<p><br></p><p class="t-title">${title}</p>`;
  const TEMPLATES = [
    { id: "blank", name: "Blank document", desc: "Start with an empty page", html: "<p><br></p>" },
    { id: "proc", name: "Procedure (QMS)", desc: "Document control block, purpose, scope, responsibility, procedure, records", html: ctl("Procedure title") + "<h2>1. Purpose</h2><p>State why this procedure exists.</p><h2>2. Scope</h2><p>State where and to whom it applies.</p><h2>3. References</h2><ul><li>IATF 16949 / ISO 9001 clause</li></ul><h2>4. Responsibility and authority</h2>" + T([[{ h: "Role" }, { h: "Responsibility" }], ["<br>", "<br>"]]) + "<h2>5. Procedure</h2><ol><li>Step one</li><li>Step two</li></ol><h2>6. Records</h2>" + T([[{ h: "Record" }, { h: "Retention" }, { h: "Owner" }], ["<br>", "<br>", "<br>"]]) + "<h2>7. Revision history</h2>" + T([[{ h: "Rev" }, { h: "Date" }, { h: "Change" }, { h: "By" }], ["00", "<br>", "First issue", "<br>"]]) },
    { id: "wi", name: "Work instruction", desc: "Operator instruction with steps, tools, safety and reaction plan", html: ctl("Work instruction") + T([[{ h: "Part / process" }, "<br>", { h: "Machine / station" }, "<br>"]]) + "<h2>Safety and PPE</h2><ul><li><br></li></ul><h2>Tools and gauges</h2><ul><li><br></li></ul><h2>Steps</h2><ol><li><br></li></ol><h2>Reaction plan</h2><p>If a check fails: stop, tag the parts, inform the supervisor.</p>" },
    { id: "minutes", name: "Meeting minutes", desc: "Attendees, agenda, decisions, actions with owner and date", html: `<p class="t-title">Meeting minutes</p>` + T([[{ h: "Meeting" }, "<br>", { h: "Date" }, "<br>"], [{ h: "Venue" }, "<br>", { h: "Chair" }, "<br>"]]) + "<h2>Attendees</h2><ul><li><br></li></ul><h2>Agenda and discussion</h2><ol><li><br></li></ol><h2>Decisions</h2><ul><li><br></li></ul><h2>Actions</h2>" + T([[{ h: "#" }, { h: "Action" }, { h: "Owner" }, { h: "Due" }], ["1", "<br>", "<br>", "<br>"]]) },
    { id: "memo", name: "Memo", desc: "To, from, date, subject", html: `<p class="t-title">Memo</p>` + T([[{ h: "To" }, "<br>"], [{ h: "From" }, "<br>"], [{ h: "Date" }, "<br>"], [{ h: "Subject" }, "<br>"]]) + "<p><br></p><p>Write the message here.</p>" },
    { id: "letter", name: "Letter", desc: "Business letter", html: "<p><br></p><p>Date</p><p><br></p><p>To,<br>Name<br>Company<br>Address</p><p><br></p><p><b>Subject: </b></p><p>Dear Sir / Madam,</p><p>Write the letter here.</p><p><br></p><p>Yours faithfully,</p><p><br></p><p><br></p><p>Name<br>Designation</p>" },
    { id: "report", name: "Report", desc: "Title, summary, findings, recommendations", html: `<p class="t-title">Report title</p><p class="t-sub">Subtitle or reference</p><h1>Summary</h1><p>Write a short summary here.</p><h1>Findings</h1><p><br></p><h1>Recommendations</h1><ul><li><br></li></ul>` },
    { id: "check", name: "Checklist", desc: "List with tick boxes", html: `<p class="t-title">Checklist</p>` + T([[{ h: "#" }, { h: "Check" }, { h: "OK" }, { h: "Remarks" }], ["1", "<br>", "☐", "<br>"], ["2", "<br>", "☐", "<br>"], ["3", "<br>", "☐", "<br>"]]) }
  ];

  const DOC = {
    kind: "doc", label: "Document", plural: "Documents", blurb: "Letters, procedures, minutes, reports", ext: "docx", color: "#2563eb", icon: "doc", accept: ".docx,.html,.htm,.txt,.md,.csv", templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, desc: t.desc })),
    blank(tid, set) {
      const t = TEMPLATES.find((x) => x.id === tid) || TEMPLATES[0], s = set || {};
      return { html: t.html, page: { size: s.page_size || "A4", orient: "portrait", margins: Object.assign({}, MARGINS.Normal), cols: 1 }, header: s.header || "", footer: s.footer || "", comments: [] };
    },
    async importFile(file) {
      const n = file.name, base = n.replace(/\.[^.]+$/, ""), ext = (/\.([^.]+)$/.exec(n) || [])[1] || "";
      if (/^docx?$/i.test(ext)) { if (/^doc$/i.test(ext)) throw new Error("Old .doc files are not supported. Please save the file as .docx first and import that."); const r = await OffDocx.read(await Z.readBuf(file)); return { name: r.title || base, body: { html: clean(r.html), page: r.page, header: clean(r.header || ""), footer: clean(r.footer || ""), comments: r.comments || [] } }; }
      if (/^html?$/i.test(ext)) return { name: base, body: Object.assign(DOC.blank(), { html: clean(await Z.readText(file)) || "<p><br></p>" }) };
      const tx = await Z.readText(file); const h = tx.split(/\r?\n/).map((l) => `<p>${esc(l) || "<br>"}</p>`).join("");
      return { name: base, body: Object.assign(DOC.blank(), { html: h }) };
    },
    exports: [
      { label: "Document file (.docx)", ext: "docx", run: (c) => c.exportDocx() }, { label: "Web page (.html)", ext: "html", run: (c) => c.exportHtml() }, { label: "Plain text (.txt)", ext: "txt", run: (c) => c.exportTxt() }
    ],
    mount(api) {
      const file = api.file, body = JSON.parse(JSON.stringify(file.body || DOC.blank()));
      body.page = Object.assign({ size: "A4", orient: "portrait", margins: Object.assign({}, MARGINS.Normal), cols: 1 }, body.page || {}); body.comments = body.comments || [];
      let zoom = body.zoom || 100, spell = true, fp = null, saved = null, pendingSize = null, selImg = null, findOpen = false, cmOpen = false, rb;
      api.wk.innerHTML = `<div class="dsc"><div class="dzoom"><div class="dpage"><div class="dhf dh" contenteditable="true" data-ph="Header — shown at the top of each page in the .docx file"></div><div class="ded" contenteditable="true" spellcheck="true"></div><div class="dhf df" contenteditable="true" data-ph="Footer"></div><div class="dgd"></div></div></div></div><div class="opane" hidden></div><div class="dhs" id="dhs"></div>`;
      const sc = api.wk.querySelector(".dsc"), zm = api.wk.querySelector(".dzoom"), pg = api.wk.querySelector(".dpage"), ed = api.wk.querySelector(".ded"), hd = api.wk.querySelector(".dh"), ft = api.wk.querySelector(".df"), gd = api.wk.querySelector(".dgd"), pane = api.wk.querySelector(".opane"), hs = api.wk.querySelector("#dhs");
      ed.innerHTML = clean(body.html) || "<p><br></p>"; hd.innerHTML = clean(body.header || ""); ft.innerHTML = clean(body.footer || "");
      document.execCommand("styleWithCSS", false, true); document.execCommand("defaultParagraphSeparator", false, "p");
      api.wk.insertAdjacentHTML("beforeend", "");
      const changed = () => { layout(); api.changed(); rb && rb.refresh(); };
      /* selection handling */
      const inEd = (n) => n && ed.contains(n.nodeType === 3 ? n.parentNode : n);
      const onSel = () => { const s = getSelection(); if (s.rangeCount && inEd(s.anchorNode)) { saved = s.getRangeAt(0).cloneRange(); rb && rb.refresh(); upStatus(); } };
      document.addEventListener("selectionchange", onSel);
      const restore = () => { if (document.activeElement !== ed && saved) { ed.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } else if (document.activeElement !== ed) ed.focus(); };
      const exec = (cmd, val) => { restore(); document.execCommand(cmd, false, val == null ? null : val); changed(); };
      const sel = () => { const s = getSelection(); return s.rangeCount ? s.getRangeAt(0) : saved; };
      const elOf = (n) => (n ? (n.nodeType === 3 ? n.parentElement : n) : null);
      const state = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
      const caretEl = () => { const r = sel(); return r ? elOf(r.startContainer) : null; };
      const blocksIn = () => {
        const r = sel(); if (!r) return []; const out = new Set(); const walker = document.createTreeWalker(ed, NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(n.tagName) && r.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
        let n; while ((n = walker.nextNode())) { if (n.querySelector("p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre") && !/^(TD|TH)$/.test(n.tagName)) continue; if (/^(TD|TH)$/.test(n.tagName) && n.querySelector("p,div,li")) continue; if (n.classList.contains("pb") || n.classList.contains("toc")) continue; out.add(n); }
        if (!out.size) { let e = caretEl(); while (e && e !== ed && !/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(e.tagName)) e = e.parentElement; if (e && e !== ed) out.add(e); }
        return [...out];
      };
      const curCss = (p) => { const e = caretEl(); return e && ed.contains(e) ? getComputedStyle(e)[p] : ""; };
      /* font size in points */
      const setSize = (pt) => {
        restore(); const r = sel(); pt = num(pt, 11); document.execCommand("styleWithCSS", false, false);
        if (r && r.collapsed) { pendingSize = pt; document.execCommand("fontSize", false, "7"); } else document.execCommand("fontSize", false, "7");
        document.execCommand("styleWithCSS", false, true); fixFonts(pt); changed();
      };
      const fixFonts = (pt) => { ed.querySelectorAll('font[size="7"]').forEach((f) => { const s = document.createElement("span"); s.style.fontSize = Math.round(pt * 4 / 3 * 10) / 10 + "px"; while (f.firstChild) s.append(f.firstChild); f.replaceWith(s); if (!s.textContent) s.innerHTML = "&#8203;"; }); };
      const stepSize = (d) => { const cur = Math.round(parseFloat(curCss("fontSize")) * 0.75 * 2) / 2 || 11; const i = SIZES.findIndex((x) => x >= cur - 0.01); let n; if (d > 0) n = SIZES.find((x) => x > cur + 0.01) || cur + 2; else { const l = SIZES.filter((x) => x < cur - 0.01); n = l.length ? l[l.length - 1] : Math.max(6, cur - 1); } setSize(n); };
      const setBlockStyle = (fn) => { restore(); blocksIn().forEach(fn); changed(); };
      const setStyle = (s) => {
        restore(); const tag = { h1: "h1", h2: "h2", h3: "h3", h4: "h4", quote: "blockquote", code: "pre", normal: "p", title: "p", sub: "p" }[s] || "p";
        document.execCommand("formatBlock", false, tag === "blockquote" ? "blockquote" : tag);
        blocksIn().forEach((b) => { b.classList.remove("t-title", "t-sub"); if (s === "title") b.classList.add("t-title"); if (s === "sub") b.classList.add("t-sub"); if (!b.classList.length) b.removeAttribute("class"); });
        changed();
      };
      const curStyle = () => { let e = caretEl(); while (e && e !== ed && !/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|TD|TH)$/.test(e.tagName)) e = e.parentElement; if (!e || e === ed) return "normal"; if (e.classList.contains("t-title")) return "title"; if (e.classList.contains("t-sub")) return "sub"; const t = e.tagName.toLowerCase(); return { h1: "h1", h2: "h2", h3: "h3", h4: "h4", blockquote: "quote", pre: "code" }[t] || "normal"; };
      /* format painter */
      const paint = () => {
        const e = caretEl(); if (!e) return; const c = getComputedStyle(e);
        fp = { b: state("bold"), i: state("italic"), u: state("underline"), s: state("strikeThrough"), color: c.color, bg: c.backgroundColor, font: c.fontFamily.split(",")[0].replace(/["']/g, ""), size: parseFloat(c.fontSize) * 0.75 };
        api.say("Format copied. Select the text to apply it to.", true); const once = () => { const s = getSelection(); if (s.rangeCount && !s.isCollapsed && inEd(s.anchorNode) && fp) { document.removeEventListener("mouseup", once, true); const f = fp; fp = null; setTimeout(() => { ["bold", "italic", "underline", "strikeThrough"].forEach((k, ix) => { if (state(k) !== [f.b, f.i, f.u, f.s][ix]) document.execCommand(k); }); document.execCommand("foreColor", false, f.color); if (f.bg && f.bg !== "rgba(0, 0, 0, 0)") document.execCommand("hiliteColor", false, f.bg); document.execCommand("fontName", false, f.font); setSize(f.size); }, 0); } }; document.addEventListener("mouseup", once, true);
      };
      /* insert helpers */
      const insHTML = (h) => { restore(); document.execCommand("insertHTML", false, h); changed(); };
      const openTables = () => { const e = caretEl(); return e ? e.closest("table") : null; };
      const cellOf = () => { const e = caretEl(); return e ? e.closest("td,th") : null; };
      const gridMenu = (btn) => {
        const html = `<div style="padding:6px"><div class="gm" style="display:grid;grid-template-columns:repeat(10,20px);gap:2px">${Array.from({ length: 80 }, (_, i) => `<i data-r="${Math.floor(i / 10) + 1}" data-c="${(i % 10) + 1}" style="width:20px;height:20px;border:1px solid #94a3b8;background:#fff;cursor:pointer"></i>`).join("")}</div><div class="gl" style="text-align:center;margin-top:6px;font-size:12px;color:var(--mut)">Choose the size</div></div>`;
        pop(btn, html, (m) => { m.querySelectorAll("i").forEach((i) => { i.onmouseover = () => { const r = +i.dataset.r, c = +i.dataset.c; m.querySelectorAll("i").forEach((x) => (x.style.background = +x.dataset.r <= r && +x.dataset.c <= c ? "#bfdbfe" : "#fff")); m.querySelector(".gl").textContent = r + " rows × " + c + " columns"; }; i.onclick = () => { closeMenu(); insTable(+i.dataset.r, +i.dataset.c); }; }); });
      };
      const insTable = (r, c) => { let h = '<table class="dt"><tbody>'; for (let i = 0; i < r; i++) { h += "<tr>"; for (let j = 0; j < c; j++) h += "<td><br></td>"; h += "</tr>"; } insHTML(h + "</tbody></table><p><br></p>"); };
      const tbl = {
        rowAt(ab) { const td = cellOf(); if (!td) return; const tr = td.parentElement, n = tr.cloneNode(true); [...n.children].forEach((c) => { c.innerHTML = "<br>"; c.removeAttribute("colspan"); c.removeAttribute("rowspan"); }); ab ? tr.after(n) : tr.before(n); changed(); },
        colAt(after) { const td = cellOf(); if (!td) return; const t = td.closest("table"), idx = [...td.parentElement.children].indexOf(td); t.querySelectorAll("tr").forEach((tr) => { const ref = tr.children[idx]; if (!ref) return; const n = document.createElement(ref.localName); n.innerHTML = "<br>"; after ? ref.after(n) : ref.before(n); }); changed(); },
        delRow() { const td = cellOf(); if (!td) return; const tr = td.parentElement, t = tr.closest("table"); tr.remove(); if (!t.querySelector("tr")) t.remove(); changed(); },
        delCol() { const td = cellOf(); if (!td) return; const t = td.closest("table"), idx = [...td.parentElement.children].indexOf(td); t.querySelectorAll("tr").forEach((tr) => { if (tr.children[idx]) tr.children[idx].remove(); }); if (!t.querySelector("td,th")) t.remove(); changed(); },
        del() { const t = openTables(); if (t) { t.remove(); changed(); } },
        shade(c) { const td = cellOf(); if (td) { c ? (td.style.backgroundColor = c) : td.style.removeProperty("background-color"); changed(); } },
        border(mode) { const t = openTables(); if (!t) return; t.classList.toggle("nb", mode === "none"); if (mode === "none") { } t.querySelectorAll("td,th").forEach((x) => { x.style.removeProperty("border"); }); changed(); },
        headRow() { const t = openTables(); if (!t) return; const tr = t.querySelector("tr"); const is = tr.querySelector("th"); [...tr.children].forEach((c) => { const n = document.createElement(is ? "td" : "th"); n.innerHTML = c.innerHTML; [...c.attributes].forEach((a) => n.setAttribute(a.name, a.value)); c.replaceWith(n); }); changed(); },
        merge(dir) { const td = cellOf(); if (!td) return; const tr = td.parentElement; if (dir === "right") { const nx = td.nextElementSibling; if (!nx) return; td.colSpan = (td.colSpan || 1) + (nx.colSpan || 1); if (nx.textContent.trim()) td.innerHTML += "<br>" + nx.innerHTML; nx.remove(); } else { const idx = [...tr.children].indexOf(td), nr = tr.nextElementSibling; if (!nr || !nr.children[idx]) return; const below = nr.children[idx]; td.rowSpan = (td.rowSpan || 1) + (below.rowSpan || 1); below.remove(); } changed(); },
        split() { const td = cellOf(); if (!td) return; const cs = td.colSpan || 1; if (cs > 1) { td.colSpan = 1; for (let i = 1; i < cs; i++) { const n = document.createElement(td.localName); n.innerHTML = "<br>"; td.after(n); } changed(); } },
        align(a) { const td = cellOf(); if (td) { td.style.textAlign = a; changed(); } }
      };
      /* pictures */
      const addImage = async (f) => { if (!f || !/^image\//.test(f.type)) return; if (f.size > 6 * 1024 * 1024) { api.say("That picture is larger than 6 MB. Please reduce it first."); return; } const u = await shrink(await Z.readData(f), f.type); insHTML(`<img src="${u}" alt="">`); };
      const shrink = (u, type) => new Promise((ok) => { if (/svg|gif/.test(type)) return ok(u); const im = new Image(); im.onload = () => { const m = 1600; if (im.width <= m && im.height <= m && u.length < 900000) return ok(u); const k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL(type === "image/png" ? "image/png" : "image/jpeg", 0.85)); }; im.onerror = () => ok(u); im.src = u; });
      const pickImg = () => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => addImage(i.files[0]); i.click(); };
      const selectImg = (im) => { if (selImg) selImg.classList.remove("isel"); selImg = im; if (im) im.classList.add("isel"); placeHandle(); rb && rb.redraw(); };
      const placeHandle = () => { if (!selImg || !ed.contains(selImg)) { hs.style.display = "none"; return; } const r = selImg.getBoundingClientRect(), w = api.wk.getBoundingClientRect(); hs.style.display = "block"; hs.style.left = r.right - w.left - 7 + "px"; hs.style.top = r.bottom - w.top - 7 + "px"; };
      hs.onmousedown = (e) => { e.preventDefault(); if (!selImg) return; const x0 = e.clientX, w0 = selImg.getBoundingClientRect().width, k = (zoom / 100); const mv = (ev) => { const w = Math.max(24, w0 + (ev.clientX - x0) / k); selImg.style.width = Math.round(w) + "px"; selImg.style.height = "auto"; selImg.removeAttribute("width"); selImg.removeAttribute("height"); placeHandle(); }; const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); changed(); }; document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up); };
      sc.addEventListener("scroll", placeHandle);
      ed.addEventListener("click", (e) => { if (e.target.tagName === "IMG") selectImg(e.target); else if (selImg) selectImg(null); const a = e.target.closest && e.target.closest("a"); if (a && (e.ctrlKey || e.metaKey) && a.getAttribute("href") && !/^#/.test(a.getAttribute("href"))) window.open(a.href, "_blank", "noopener"); else if (a && /^#/.test(a.getAttribute("href") || "")) { e.preventDefault(); const t = ed.querySelector(a.getAttribute("href").replace(/[^#\w-]/g, "")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); } });
      /* links */
      const linkForm = (btn) => {
        const r = sel(); const txt = r ? String(r.toString()) : "", cur = caretEl() && caretEl().closest("a");
        form(btn, "Link", [{ k: "url", label: "Address", value: cur ? cur.getAttribute("href") : "https://", ph: "https://…" }, ...(txt ? [] : [{ k: "text", label: "Text to show", value: "" }])], "Apply", (v) => {
          let u = (v.url || "").trim(); if (!u) return; if (!/^(https?:|mailto:|tel:|#)/i.test(u)) u = "https://" + u; restore();
          if (txt || cur) document.execCommand("createLink", false, u); else insHTML(`<a href="${esc(u)}">${esc(v.text || u)}</a>&nbsp;`); changed();
        }, cur ? { label: "Remove link", run: () => exec("unlink") } : null);
      };
      /* contents */
      const makeToc = () => {
        const hs2 = [...ed.querySelectorAll("h1,h2,h3")]; if (!hs2.length) { api.say("Add some headings first (Home › Styles › Heading 1), then insert the contents."); return; }
        hs2.forEach((h, i) => { if (!h.id) h.id = "h" + Date.now().toString(36) + i; });
        const html = `<div class="toc" contenteditable="false"><p><b>Contents</b></p>${hs2.map((h) => `<p><a href="#${h.id}" data-lvl="${h.tagName[1]}" style="margin-left:${(h.tagName[1] - 1) * 18}px">${esc(h.textContent)}</a></p>`).join("")}</div><p><br></p>`;
        const old = ed.querySelector(".toc"); if (old) { old.outerHTML = html.replace(/<p><br><\/p>$/, ""); changed(); } else insHTML(html);
      };
      /* find & replace */
      const hl = (typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined") ? new Highlight() : null; if (hl) { CSS.highlights.set("offfind", hl); if (!document.getElementById("offfs")) { const s = document.createElement("style"); s.id = "offfs"; s.textContent = "::highlight(offfind){background:#fde047;color:#000}"; document.head.append(s); } }
      let fq = "", fcase = false, fwhole = false, matches = [], mi = -1;
      const collect = () => {
        matches = []; mi = -1; if (hl) hl.clear(); if (!fq) return; const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; const re = new RegExp(fq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), fcase ? "g" : "gi");
        while ((n = w.nextNode())) { const t = n.nodeValue; let m; re.lastIndex = 0; while ((m = re.exec(t))) { if (fwhole && (/\w/.test(t[m.index - 1] || "") || /\w/.test(t[m.index + m[0].length] || ""))) continue; const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); matches.push(r); if (hl) hl.add(r); if (m[0].length === 0) re.lastIndex++; } }
      };
      const gotoMatch = (d) => { collect(); const info = pane.querySelector("#f_n"); if (!matches.length) { info && (info.textContent = "No matches"); return; } const r = sel(); let start = 0; if (r && d !== 0) { const i = matches.findIndex((m) => m.compareBoundaryPoints(Range.START_TO_START, r) > (d > 0 ? 0 : -1) * 0 && (d > 0 ? m.compareBoundaryPoints(Range.START_TO_START, r) > 0 : false)); start = d > 0 ? (i < 0 ? 0 : i) : Math.max(0, (matches.findIndex((m) => m.compareBoundaryPoints(Range.START_TO_START, r) >= 0) - 1 + matches.length) % matches.length); } mi = start; const m = matches[mi]; const s = getSelection(); s.removeAllRanges(); s.addRange(m); saved = m.cloneRange(); const el = elOf(m.startContainer); el && el.scrollIntoView({ block: "center", behavior: "smooth" }); info && (info.textContent = mi + 1 + " of " + matches.length); };
      const replaceOne = (rep) => { const r = sel(); if (!r || r.collapsed) { gotoMatch(1); return; } const cmp = fcase ? r.toString() === fq : r.toString().toLowerCase() === fq.toLowerCase(); if (cmp) { restore(); document.execCommand("insertText", false, rep); changed(); } gotoMatch(1); };
      const replaceAll = (rep) => { collect(); const n = matches.length; for (let i = n - 1; i >= 0; i--) { const s = getSelection(); s.removeAllRanges(); s.addRange(matches[i]); ed.focus(); document.execCommand("insertText", false, rep); } collect(); changed(); const info = pane.querySelector("#f_n"); info && (info.textContent = n + " replaced"); };
      const showPane = (which) => {
        findOpen = which === "find" ? !findOpen || cmOpen : false; cmOpen = which === "cm" ? !cmOpen || findOpen : false; if (which === "find") cmOpen = false; if (which === "cm") findOpen = false;
        if (which === "find" && !findOpen) { pane.hidden = true; if (hl) hl.clear(); return; } if (which === "cm" && !cmOpen) { pane.hidden = true; return; }
        pane.hidden = false;
        if (which === "find") {
          pane.innerHTML = `<h4>Find and replace</h4><label>Find</label><input id="f_q" value="${esc(fq)}" placeholder="Text to find"><label>Replace with</label><input id="f_r" placeholder="New text"><div class="row2"><label style="margin:0;display:flex;gap:5px;align-items:center"><input type="checkbox" id="f_c" style="width:auto"${fcase ? " checked" : ""}> Match case</label><label style="margin:0;display:flex;gap:5px;align-items:center"><input type="checkbox" id="f_w" style="width:auto"${fwhole ? " checked" : ""}> Whole word</label></div><div class="row2"><button class="btn o" id="f_p">Previous</button><button class="btn" id="f_nx">Next</button></div><div class="row2"><button class="btn o" id="f_1">Replace</button><button class="btn o" id="f_a">Replace all</button></div><p id="f_n" class="mut" style="margin-top:10px"></p>`;
          const q = pane.querySelector("#f_q"); q.focus(); q.oninput = () => { fq = q.value; collect(); pane.querySelector("#f_n").textContent = fq ? matches.length + " found" : ""; };
          pane.querySelector("#f_c").onchange = (e) => { fcase = e.target.checked; q.oninput(); }; pane.querySelector("#f_w").onchange = (e) => { fwhole = e.target.checked; q.oninput(); };
          pane.querySelector("#f_nx").onclick = () => gotoMatch(1); pane.querySelector("#f_p").onclick = () => gotoMatch(-1); pane.querySelector("#f_1").onclick = () => replaceOne(pane.querySelector("#f_r").value); pane.querySelector("#f_a").onclick = () => replaceAll(pane.querySelector("#f_r").value);
          q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); gotoMatch(e.shiftKey ? -1 : 1); } }; q.oninput();
        } else drawComments();
      };
      /* comments */
      const drawComments = () => {
        const list = body.comments;
        pane.innerHTML = `<h4>Comments</h4>${list.length ? list.map((c) => `<div class="dcm${c.done ? " res" : ""}" data-id="${c.id}"><b>${esc(c.by || "")}</b> <span class="mut">${esc((c.at || "").slice(0, 10))}</span><div class="q">“${esc((c.quote || "").slice(0, 80))}”</div><div>${esc(c.text)}</div><div class="row2"><button class="btn o" data-a="go">Show</button><button class="btn o" data-a="res">${c.done ? "Reopen" : "Resolve"}</button><button class="btn o" data-a="del">Delete</button></div></div>`).join("") : '<p class="mut">No comments yet. Select some text and choose “New comment”.</p>'}`;
        pane.querySelectorAll(".dcm").forEach((d) => d.querySelectorAll("button").forEach((b) => (b.onclick = () => {
          const c = list.find((x) => x.id === d.dataset.id); const sp = ed.querySelector(`[data-c="${c.id}"]`);
          if (b.dataset.a === "go" && sp) sp.scrollIntoView({ block: "center", behavior: "smooth" });
          if (b.dataset.a === "res") { c.done = !c.done; api.changed(); drawComments(); }
          if (b.dataset.a === "del") { if (sp) sp.replaceWith(...sp.childNodes); body.comments = body.comments.filter((x) => x.id !== c.id); changed(); drawComments(); }
        })));
      };
      const newComment = (btn) => {
        const r = sel(); if (!r || r.collapsed) { api.say("Select the text you want to comment on first."); return; } const quote = r.toString();
        form(btn, "New comment", [{ k: "t", type: "area", label: "Comment", ph: "Write your comment" }], "Add", (v) => {
          if (!(v.t || "").trim()) return; const id = "c" + Date.now().toString(36); restore(); const s = document.createElement("span"); s.className = "cmt"; s.dataset.c = id;
          try { const rr = sel(); rr.surroundContents(s); } catch (e) { document.execCommand("insertHTML", false, `<span class="cmt" data-c="${id}">${esc(quote)}</span>`); }
          body.comments.push({ id, text: v.t.trim(), quote, by: api.me || "", at: new Date().toISOString(), done: false }); changed(); if (cmOpen) drawComments(); else { cmOpen = false; showPane("cm"); }
        });
      };
      /* paste */
      ed.addEventListener("paste", async (e) => {
        const cd = e.clipboardData; if (!cd) return; const files = [...(cd.files || [])].filter((f) => /^image\//.test(f.type));
        if (files.length) { e.preventDefault(); for (const f of files) await addImage(f); return; }
        const h = cd.getData("text/html"); if (h) { e.preventDefault(); const tmp = clean(h.replace(/<!--[\s\S]*?-->/g, "").replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, "")); document.execCommand("insertHTML", false, (X.pasteWrap || ((q) => q))(tmp)); changed(); }
      });
      ed.addEventListener("drop", async (e) => { const f = [...(e.dataTransfer.files || [])].filter((x) => /^image\//.test(x.type)); if (f.length) { e.preventDefault(); for (const x of f) await addImage(x); } });
      ed.addEventListener("input", () => { if (pendingSize) { fixFonts(pendingSize); pendingSize = null; } changed(); });
      ed.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        if (mod && k === "s") { e.preventDefault(); api.save(); } else if (mod && k === "f") { e.preventDefault(); findOpen = false; showPane("find"); } else if (mod && k === "k") { e.preventDefault(); linkForm(api.rib.querySelector(".rbp") || sc); }
        else if (e.key === "Tab") { const td = cellOf(); if (td) { e.preventDefault(); const cells = [...td.closest("table").querySelectorAll("td,th")], i = cells.indexOf(td) + (e.shiftKey ? -1 : 1); if (i >= cells.length) { tbl.rowAt(true); const c2 = [...td.closest("table").querySelectorAll("td,th")]; focusCell(c2[i]); } else if (cells[i]) focusCell(cells[i]); } else if (!caretEl().closest("li")) { e.preventDefault(); exec(e.shiftKey ? "outdent" : "indent"); } }
        else if (e.key === "Delete" || e.key === "Backspace") { if (selImg && document.activeElement === ed && getSelection().isCollapsed) { e.preventDefault(); selImg.remove(); selectImg(null); changed(); } }
      });
      const focusCell = (c) => { if (!c) return; const r = document.createRange(); r.selectNodeContents(c); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      [hd, ft].forEach((h) => h.addEventListener("input", () => api.changed()));
      /* layout: page size, margins, guides, word count */
      const layout = () => {
        const [w0, h0] = PAGES[body.page.size] || PAGES.A4, land = body.page.orient === "landscape", w = (land ? h0 : w0) * MM, h = (land ? w0 : h0) * MM, m = body.page.margins;
        pg.style.width = w + "px"; pg.style.padding = `${m.t * MM}px ${m.r * MM}px ${m.b * MM}px ${m.l * MM}px`; pg.style.minHeight = h + "px";
        ed.style.columnCount = body.page.cols > 1 ? body.page.cols : ""; ed.style.columnGap = body.page.cols > 1 ? "30px" : "";
        hd.style.left = m.l * MM + "px"; hd.style.right = m.r * MM + "px"; ft.style.left = m.l * MM + "px"; ft.style.right = m.r * MM + "px";
        const ch = h - (m.t + m.b) * MM, total = pg.scrollHeight - (m.t + m.b) * MM, n = Math.max(1, Math.ceil((ed.scrollHeight - 2) / ch)); gd.style.height = pg.scrollHeight + "px"; gd.innerHTML = "";
        for (let i = 1; i < n; i++) { const l = document.createElement("i"); l.style.top = m.t * MM + i * ch + "px"; l.dataset.p = "Page " + (i + 1); gd.append(l); }
        const need = n * ch + (m.t + m.b) * MM; if (need > h) pg.style.minHeight = need + "px"; pages = n; upStatus(); placeHandle(); X.onLayout.forEach((f) => f());
        zm.style.zoom = zoom / 100;
      };
      let pages = 1;
      const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
      const upStatus = () => { const t = ed.innerText || "", s = getSelection(); const sw = s.rangeCount && !s.isCollapsed && inEd(s.anchorNode) ? words(s.toString()) : 0; api.st.querySelector(".dstat").innerHTML = `Page ${pageOfCaret()} of ${pages} &nbsp;·&nbsp; ${words(t)} words &nbsp;·&nbsp; ${t.replace(/\s/g, "").length} characters${sw ? ` &nbsp;·&nbsp; <b>${sw} selected</b>` : ""}`; };
      const pageOfCaret = () => { const r = sel(); if (!r || !inEd(r.startContainer)) return 1; const rr = r.getClientRects()[0] || elOf(r.startContainer).getBoundingClientRect(), pr = pg.getBoundingClientRect(), m = body.page.margins, [w0, h0] = PAGES[body.page.size] || PAGES.A4, h = (body.page.orient === "landscape" ? w0 : h0) * MM, ch = h - (m.t + m.b) * MM; return Math.max(1, Math.min(pages, Math.floor(((rr.top - pr.top) / (zoom / 100) - m.t * MM) / ch) + 1)); };
      const setZoom = (z) => { zoom = Math.max(30, Math.min(300, Math.round(z))); body.zoom = zoom; layout(); const r = api.st.querySelector("#zr"); if (r) r.value = zoom; api.st.querySelector("#zl").textContent = zoom + "%"; };
      api.st.innerHTML = `<span class="dstat"></span><span class="gr"></span><label style="display:flex;gap:6px;align-items:center">Zoom <input type="range" id="zr" min="40" max="200" value="${zoom}"> <span id="zl">${zoom}%</span></label>`;
      api.st.querySelector("#zr").oninput = (e) => setZoom(+e.target.value);
      const fit = () => { const [w0] = PAGES[body.page.size] || PAGES.A4, w = (body.page.orient === "landscape" ? PAGES[body.page.size][1] : w0) * MM; setZoom(((sc.clientWidth - 40) / w) * 100); };
      /* ---------- ribbon ---------- */
      const B = (i, t, cmd, extra) => Object.assign({ i, t, on: () => exec(cmd), act: () => state(cmd) }, extra || {});
      const tabs = [
        {
          id: "home", label: "Home", groups: [
            { label: "Clipboard", items: [{ i: "paste", label: "Paste", big: true, on: async () => { restore(); try { const t = await navigator.clipboard.readText(); document.execCommand("insertText", false, t); changed(); } catch (e) { api.say("Use Ctrl+V to paste (the browser blocks the button here)."); } } }, { i: "cut", t: "Cut", on: () => exec("cut") }, { i: "copy", t: "Copy", on: () => exec("copy") }, { i: "brush", t: "Copy formatting to other text", on: paint }] },
            { label: "Font", items: [{ k: "sel", t: "Font", w: 130, opts: FONTS, get: () => (curCss("fontFamily") || "").split(",")[0].replace(/["']/g, "") || "Calibri", on: (v) => exec("fontName", v), keep: () => {} }, { k: "sel", t: "Size (pt)", w: 64, opts: SIZES.map(String), get: () => String(Math.round(parseFloat(curCss("fontSize") || "14.67") * 0.75 * 2) / 2), on: (v) => setSize(v) }, { i: "plus", t: "Bigger text", on: () => stepSize(1) }, { i: "minus", t: "Smaller text", on: () => stepSize(-1) }, { i: "clear", t: "Clear formatting", on: () => exec("removeFormat") },
              B("", "Bold (Ctrl+B)", "bold", { html: "<b>B</b>", tx: true }), B("", "Italic (Ctrl+I)", "italic", { html: "<i>I</i>", tx: true }), B("", "Underline (Ctrl+U)", "underline", { html: "<u>U</u>", tx: true }), B("", "Strikethrough", "strikeThrough", { html: "<s>S</s>", tx: true }), B("sub", "Subscript", "subscript"), B("sup", "Superscript", "superscript"),
              { k: "col", i: "tcolor", t: "Text colour", none: "Automatic", get: () => "#000000", on: (c) => exec("foreColor", c || "#000000") }, { k: "col", i: "hilite", t: "Highlight colour", none: "No highlight", get: () => "#ffff00", on: (c) => (c ? exec("hiliteColor", c) : exec("hiliteColor", "transparent")) }] },
            { label: "Paragraph", items: [{ i: "ulist", t: "Bullets", on: () => exec("insertUnorderedList"), act: () => state("insertUnorderedList") }, { i: "olist", t: "Numbering", on: () => exec("insertOrderedList"), act: () => state("insertOrderedList") }, { i: "outdent", t: "Less indent", on: () => exec("outdent") }, { i: "indent", t: "More indent", on: () => exec("indent") },
              { i: "alignL", t: "Align left", on: () => exec("justifyLeft"), act: () => state("justifyLeft") }, { i: "alignC", t: "Centre", on: () => exec("justifyCenter"), act: () => state("justifyCenter") }, { i: "alignR", t: "Align right", on: () => exec("justifyRight"), act: () => state("justifyRight") }, { i: "alignJ", t: "Justify", on: () => exec("justifyFull"), act: () => state("justifyFull") },
              { k: "menu", i: "param", t: "Line and paragraph spacing", items: () => [{ hd: "Line spacing" }, ...[1, 1.15, 1.5, 2, 2.5].map((v) => ({ label: String(v), run: () => setBlockStyle((b) => (b.style.lineHeight = v)) })), "-", { hd: "Space after paragraph" }, ...[0, 6, 12, 18].map((v) => ({ label: v + " pt", run: () => setBlockStyle((b) => (b.style.marginBottom = v * 4 / 3 + "px")) })), "-", { hd: "List style" }, { label: "Bullets: circle", run: () => listStyle("ul", "circle") }, { label: "Bullets: square", run: () => listStyle("ul", "square") }, { label: "Numbers: a, b, c", run: () => listStyle("ol", "lower-alpha") }, { label: "Numbers: i, ii, iii", run: () => listStyle("ol", "lower-roman") }, { label: "Numbers: 1, 2, 3", run: () => listStyle("ol", "decimal") }] }] },
            { label: "Styles", items: [{ k: "sel", t: "Style", w: 120, opts: [["normal", "Normal"], ["title", "Title"], ["sub", "Subtitle"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"], ["h4", "Heading 4"], ["quote", "Quote"], ["code", "Code"]], get: curStyle, on: setStyle }] },
            { label: "Editing", items: [{ i: "find", label: "Find", big: true, on: () => { findOpen = false; showPane("find"); } }, { i: "undo", t: "Undo (Ctrl+Z)", on: () => exec("undo") }, { i: "redo", t: "Redo (Ctrl+Y)", on: () => exec("redo") }, { i: "alignT", t: "Select all", on: () => exec("selectAll") }] }
          ]
        },
        {
          id: "insert", label: "Insert", groups: [
            { label: "Pages", items: [{ i: "pagebreak", label: "Page break", big: true, on: () => insHTML('<div class="pb" contenteditable="false"></div><p><br></p>') }] },
            { label: "Tables", items: [{ k: "menu", i: "table", label: "Table", big: true, on: () => {}, items: () => [] }] },
            { label: "Illustrations", items: [{ i: "image", label: "Picture", big: true, on: pickImg }] },
            { label: "Links", items: [{ i: "link", label: "Link", big: true, on: () => linkForm(rbBtn("Link")) }, { i: "calendar", label: "Contents", big: true, on: makeToc }] },
            { label: "Text", items: [{ i: "hr", t: "Horizontal line", on: () => insHTML("<hr><p><br></p>") }, { k: "menu", i: "calendar", t: "Date and time", items: () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return [`${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`, d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), `${z(d.getHours())}:${z(d.getMinutes())}`].map((s) => ({ label: s, run: () => exec("insertText", s) })); } }, { k: "menu", i: "symbol", t: "Symbols", items: () => [{ hd: "Click a symbol" }] }, { i: "check", t: "Tick box", on: () => exec("insertText", "☐ ") }] }
          ]
        },
        {
          id: "layout", label: "Layout", groups: [
            { label: "Page setup", items: [{ k: "menu", i: "margins", label: "Margins", big: true, items: () => Object.keys(MARGINS).map((k) => ({ label: `${k}  (${MARGINS[k].t} / ${MARGINS[k].l} mm)`, run: () => { body.page.margins = Object.assign({}, MARGINS[k]); changed(); } })) }, { k: "menu", i: "orient", label: "Orientation", big: true, items: () => [{ label: "Portrait", on: body.page.orient !== "landscape", run: () => { body.page.orient = "portrait"; changed(); } }, { label: "Landscape", on: body.page.orient === "landscape", run: () => { body.page.orient = "landscape"; changed(); } }] }, { k: "menu", i: "size", label: "Size", big: true, items: () => Object.keys(PAGES).map((k) => ({ label: `${k}  (${PAGES[k][0]} × ${PAGES[k][1]} mm)`, on: body.page.size === k, run: () => { body.page.size = k; changed(); } })) }, { k: "menu", i: "cols", label: "Columns", big: true, items: () => [1, 2, 3].map((n) => ({ label: n === 1 ? "One" : n === 2 ? "Two" : "Three", on: (body.page.cols || 1) === n, run: () => { body.page.cols = n; changed(); } })) }] },
            { label: "Header and footer", items: [{ i: "alignT", label: "Header text", big: true, on: () => { hd.focus(); } }, { i: "alignB", label: "Footer text", big: true, on: () => { ft.focus(); } }] },
            { label: "Note", items: [{ k: "html", html: '<span class="mut" style="font-size:12px;max-width:260px;display:block">When printed or saved as PDF, the page gets your company logo, a unique reference number and the format revision automatically.</span>' }] }
          ]
        },
        {
          id: "review", label: "Review", groups: [
            { label: "Proofing", items: [{ i: "spell", label: "Spelling", big: true, act: () => spell, on: () => { spell = !spell; ed.spellcheck = spell; ed.blur(); setTimeout(() => ed.focus(), 0); } }, { i: "find", label: "Find & replace", big: true, on: () => { findOpen = false; showPane("find"); } }] },
            { label: "Comments", items: [{ i: "comment", label: "New comment", big: true, on: () => newComment(rbBtn("New comment")) }, { i: "eye", label: "Show comments", big: true, on: () => { cmOpen = false; showPane("cm"); } }] }
          ]
        },
        {
          id: "view", label: "View", groups: [
            { label: "Zoom", items: [{ i: "zoomin", t: "Zoom in", on: () => setZoom(zoom + 10) }, { i: "zoomout", t: "Zoom out", on: () => setZoom(zoom - 10) }, { label: "100%", on: () => setZoom(100) }, { label: "Fit width", on: fit }] },
            { label: "Show", items: [{ i: "full", label: "Full screen", big: true, on: () => { if (document.fullscreenElement) document.exitFullscreen(); else api.root.requestFullscreen && api.root.requestFullscreen(); } }] }
          ]
        },
        {
          id: "table", label: "Table", ctx: true, when: () => !!openTables(), groups: [
            { label: "Rows and columns", items: [{ i: "rowAdd", t: "Insert row below", label: "Row below", on: () => tbl.rowAt(true) }, { i: "rowAdd", t: "Insert row above", label: "Row above", on: () => tbl.rowAt(false) }, { i: "colAdd", t: "Insert column right", label: "Col right", on: () => tbl.colAt(true) }, { i: "colAdd", t: "Insert column left", label: "Col left", on: () => tbl.colAt(false) }, { i: "rowDel", label: "Delete row", on: tbl.delRow }, { i: "colDel", label: "Delete column", on: tbl.delCol }, { i: "trash", label: "Delete table", on: tbl.del }] },
            { label: "Cells", items: [{ i: "merge", label: "Merge right", on: () => tbl.merge("right") }, { i: "merge", label: "Merge down", on: () => tbl.merge("down") }, { i: "cols", label: "Split cell", on: tbl.split }, { k: "col", i: "fill", t: "Cell shading", none: "No shading", get: () => (cellOf() && cellOf().style.backgroundColor) || "", on: tbl.shade }, { i: "alignL", t: "Cell text left", on: () => tbl.align("left") }, { i: "alignC", t: "Cell text centre", on: () => tbl.align("center") }, { i: "alignR", t: "Cell text right", on: () => tbl.align("right") }] },
            { label: "Style", items: [{ i: "border", label: "Header row", on: tbl.headRow }, { i: "borderO", label: "Show borders", on: () => tbl.border("all") }, { i: "borderN", label: "Hide borders", on: () => tbl.border("none") }] }
          ]
        },
        {
          id: "pic", label: "Picture", ctx: true, when: () => !!selImg && ed.contains(selImg), groups: [
            { label: "Size", items: [{ k: "num", t: "Width (px)", min: 20, max: 2000, w: 78, get: () => (selImg ? Math.round(selImg.getBoundingClientRect().width / (zoom / 100)) : ""), on: (v) => { if (selImg) { selImg.style.width = num(v, 200) + "px"; selImg.style.height = "auto"; selImg.removeAttribute("width"); selImg.removeAttribute("height"); changed(); placeHandle(); } } }, { label: "Original size", on: () => { if (selImg) { selImg.style.width = ""; selImg.style.height = ""; selImg.removeAttribute("width"); selImg.removeAttribute("height"); changed(); placeHandle(); } } }, { label: "Fit to page", on: () => { if (selImg) { selImg.style.width = "100%"; selImg.style.height = "auto"; changed(); placeHandle(); } } }] },
            { label: "Position", items: [{ i: "alignL", label: "Left", on: () => imgAlign("left") }, { i: "alignC", label: "Centre", on: () => imgAlign("center") }, { i: "alignR", label: "Right", on: () => imgAlign("right") }, { i: "trash", label: "Delete", on: () => { if (selImg) { selImg.remove(); selectImg(null); changed(); } } }] },
            { label: "Accessibility", items: [{ i: "comment", label: "Alt text", on: () => form(rbBtn("Alt text"), "Describe the picture", [{ k: "a", label: "Alt text", value: selImg ? selImg.alt : "" }], "Save", (v) => { if (selImg) { selImg.alt = v.a; changed(); } }) }] }
          ]
        }
      ];
      const listStyle = (tag, type) => { restore(); const e = caretEl(); const l = e && e.closest(tag); if (l) { l.style.listStyleType = type; changed(); } else api.say("Put the cursor inside a " + (tag === "ul" ? "bulleted" : "numbered") + " list first."); };
      const imgAlign = (a) => { if (!selImg) return; selImg.style.display = a === "center" ? "block" : ""; selImg.style.margin = a === "center" ? "0 auto" : a === "right" ? "0 0 0 auto" : ""; selImg.style.float = a === "right" ? "right" : a === "left" ? "left" : ""; if (a === "center") selImg.style.float = ""; changed(); placeHandle(); };
      const rbBtn = (label) => [...api.rib.querySelectorAll(".rb")].find((b) => (b.title || "").startsWith(label)) || api.rib;
      // fix up menu items that need dynamic wiring
      const ins = tabs[1].groups; ins[1].items[0] = { i: "table", label: "Table", big: true, on: () => gridMenu(rbBtn("Table")) };
      ins[4].items[2] = { k: "menu", i: "symbol", t: "Symbols", items: () => SYMS.map((s) => ({ label: s, run: () => exec("insertText", s) })) };
      const X = { api, body, ed, hd, ft, pg, sc, zm, pane, tabs, exec, restore, sel, caretEl, elOf, state, insHTML, changed, rbBtn, blocksIn, setBlockStyle, openTables, cellOf, focusCell, clean, layout, setZoom, fit, showPane, addImage, setSize, upStatus, curCss, selectImg, xform: [], xformAsync: [], onLayout: [], onBody: [], get zoom() { return zoom; }, get saved() { return saved; }, get pages() { return pages; }, get rb() { return rb; }, drawComments, PAGES, MM, MARGINS };
      (window.OffDocX || []).forEach((f) => f(X));
      rb = make(api.rib, tabs, { first: "home" });
      let rafP = 0; ed.addEventListener("mouseup", () => rb.redraw()); ed.addEventListener("keyup", () => { rb.refresh(); });
      const redrawCtx = () => { const t = rb.tab(); const need = (!!openTables() || !!selImg); rb.refresh(); };
      document.addEventListener("selectionchange", () => { if (rafP) return; rafP = requestAnimationFrame(() => { rafP = 0; const tabNow = rb.tab(); const isTbl = !!openTables(); if (isTbl !== !!lastT) { lastT = isTbl; rb.redraw(); } }); }); let lastT = false;
      window.addEventListener("resize", layout);
      layout(); setTimeout(layout, 300); if (zoom !== 100) setZoom(zoom);
      const printCss = () => { let s = document.getElementById("off-page-style"); if (!s) { s = document.createElement("style"); s.id = "off-page-style"; s.media = "print"; document.head.append(s); } const m = body.page.margins; s.textContent = `@page{size:${body.page.size === "Letter" ? "letter" : body.page.size === "Legal" ? "legal" : body.page.size} ${body.page.orient === "landscape" ? "landscape" : "portrait"}}body.opv .dpage{padding-left:${Math.max(0, m.l - 10)}mm!important;padding-right:${Math.max(0, m.r - 10)}mm!important}`; };
      const out = () => { const c = ed.cloneNode(true); c.querySelectorAll(".isel").forEach((i) => i.classList.remove("isel")); c.querySelectorAll("img").forEach((i) => { if (!i.getAttribute("class")) i.removeAttribute("class"); }); return c; };
      const outX = () => { const c = out(); X.xform.forEach((f) => f(c)); return c; };
      const ctrl = {
        body() { body.html = out().innerHTML; body.header = hd.innerHTML.replace(/^<br>$/, ""); body.footer = ft.innerHTML.replace(/^<br>$/, ""); body.zoom = zoom; X.onBody.forEach((f) => f(body)); return body; },
        print() { printCss(); if (window.KMRReport) KMRReport.set({ title: file.name || "Document", doc: file.no || "", key: "document", land: body.page.orient === "landscape" }); selectImg(null); document.body.classList.add("opv"); const t0 = document.title; document.title = file.name || "Document";
          const hh = (hd.innerHTML || "").replace(/^<br>$/, ""), ff = (ft.innerHTML || "").replace(/^<br>$/, ""), hasHF = (hd.textContent + ft.textContent).trim() || hd.querySelector("img") || ft.querySelector("img"); let pw = null;
          if (hasHF) { const m = body.page.margins; pw = document.createElement("div"); pw.className = "dprint"; pw.style.cssText = `padding-left:${Math.max(0, m.l - 10)}mm;padding-right:${Math.max(0, m.r - 10)}mm`; pw.innerHTML = '<table class="phf"><thead><tr><td class="phh"></td></tr></thead><tbody><tr><td class="pbd"></td></tr></tbody><tfoot><tr><td class="pff"></td></tr></tfoot></table>'; pw.querySelector(".phh").innerHTML = hh; pw.querySelector(".pff").innerHTML = ff; const c = outX(); c.removeAttribute("contenteditable"); c.classList.add("ded"); pw.querySelector(".pbd").append(c); document.body.append(pw); document.body.classList.add("opv2"); }
          setTimeout(() => { window.print(); document.title = t0; document.body.classList.remove("opv", "opv2"); if (pw) pw.remove(); }, 60); },
        async exportDocx() { X.keepTrack = true; const c = outX(); X.keepTrack = false; for (const f of X.xformAsync) await f(c); c.style.cssText = "position:absolute;left:-9999px;top:0;width:" + pg.clientWidth + "px"; document.body.append(c); c.classList.add("ded"); try { const wrap = document.createElement("div"); wrap.className = "dpage"; wrap.style.cssText = "position:absolute;left:-9999px;top:0;width:" + pg.style.width + ";padding:0"; wrap.append(c); c.style.cssText = ""; document.body.append(wrap); const blob = await OffDocx.write(c, { page: body.page, header: (X.hfOut || ((h) => h))(hd.innerHTML.replace(/^<br>$/, "")), footer: (X.hfOut || ((h) => h))(ft.innerHTML.replace(/^<br>$/, "")), comments: body.comments, title: file.name, author: (body.props && body.props.author) || api.me || "", subject: body.props && body.props.subject, keywords: body.props && body.props.keywords }); wrap.remove(); Z.download(blob, Z.safeName(file.name) + ".docx"); } finally { document.querySelectorAll("body > .ded, body > .dpage").forEach((x) => x.remove()); } },
        exportHtml() { const h = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(file.name)}</title><style>body{font:11pt Calibri,Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 16px;line-height:1.4}table{border-collapse:collapse}td,th{border:1px solid #808080;padding:4px 7px}img{max-width:100%}.pb{page-break-after:always}</style></head><body>${outX().innerHTML}</body></html>`; Z.download(new Blob([h], { type: "text/html" }), Z.safeName(file.name) + ".html"); },
        exportTxt() { Z.download(new Blob([outX().innerText], { type: "text/plain" }), Z.safeName(file.name) + ".txt"); },
        focus() { ed.focus(); }, destroy() { document.removeEventListener("selectionchange", onSel); window.removeEventListener("resize", layout); if (hl) hl.clear(); }
      };
      X.ctrl = ctrl; (window.OffDocPost || []).forEach((f) => f(X));
      window.__doc = { body, ed, hd, ft, ctrl }; return ctrl;
    }
  };
  window.Office = window.Office || { editors: {} }; Office.editors.doc = DOC; window.OffDoc = { clean, MARGINS, PAGES };
})();
