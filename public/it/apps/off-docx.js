/* KMR Office Suite - Word-format (.docx) writer and reader for the Documents editor.
   write(root, meta) turns the page HTML into a .docx; read(buffer) turns a .docx into page HTML. */
(function () {
  "use strict";
  const Z = window.OffZip, esc = Z.esc;
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const px2tw = (px) => Math.round(px * 15), px2hp = (px) => Math.max(2, Math.round(px * 1.5)), px2emu = (px) => Math.round(px * 9525);
  const hex = (c) => {
    if (!c) return null; c = String(c).trim();
    let m = /^#([0-9a-f]{3})$/i.exec(c); if (m) return m[1].split("").map((x) => x + x).join("").toUpperCase();
    m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return m[1].toUpperCase();
    m = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?\)/i.exec(c); if (m) { if (m[4] != null && +m[4] === 0) return null; return [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("").toUpperCase(); }
    return null;
  };
  const NAMED = { yellow: "FFFF00", lime: "00FF00", cyan: "00FFFF", magenta: "FF00FF", red: "FF0000", blue: "0000FF", green: "008000", black: "000000", white: "FFFFFF", gray: "808080", grey: "808080", orange: "FFA500" };
  const colour = (c) => hex(c) || (c && NAMED[String(c).toLowerCase()]) || null;
  const HL = { FFFF00: "yellow", "00FF00": "green", "00FFFF": "cyan", FF00FF: "magenta", FF0000: "red", "0000FF": "blue", "000000": "black", FFFFFF: "white" };
  const len = (v) => { if (v == null || v === "") return null; const m = /^(-?[\d.]+)(px|pt|em|rem|%|mm|cm|in)?$/.exec(String(v).trim()); if (!m) return null; const n = parseFloat(m[1]); return { px: n, pt: n * 4 / 3, em: n * 16, rem: n * 16, mm: n * 3.7795, cm: n * 37.795, in: n * 96, "%": null }[m[2] || "px"]; };

  /* ================= WRITE ================= */
  async function write(root, meta) {
    meta = meta || {};
    const rels = [], media = []; let rid = 10, numId = 10; const nums = [];
    const addRel = (type, target, ext) => { const id = "rId" + rid++; rels.push(`<Relationship Id="${id}" Type="${R}/${type}" Target="${esc(target)}"${ext ? ' TargetMode="External"' : ""}/>`); return id; };
    const imgs = []; let imgN = 1, drawId = 1;
    /* ---- runs ---- */
    function rpr(f) {
      let x = "";
      if (f.font) x += `<w:rFonts w:ascii="${esc(f.font)}" w:hAnsi="${esc(f.font)}" w:cs="${esc(f.font)}"/>`;
      if (f.b) x += "<w:b/><w:bCs/>"; if (f.i) x += "<w:i/><w:iCs/>"; if (f.s) x += "<w:strike/>";
      if (f.color) x += `<w:color w:val="${f.color}"/>`;
      if (f.sz) x += `<w:sz w:val="${f.sz}"/><w:szCs w:val="${f.sz}"/>`;
      if (f.hl) { if (HL[f.hl]) x += `<w:highlight w:val="${HL[f.hl]}"/>`; else x += `<w:shd w:val="clear" w:color="auto" w:fill="${f.hl}"/>`; }
      if (f.u) x += '<w:u w:val="single"/>'; if (f.va) x += `<w:vertAlign w:val="${f.va}"/>`; if (f.style) x += `<w:rStyle w:val="${f.style}"/>`;
      return x ? `<w:rPr>${x}</w:rPr>` : "";
    }
    const run = (t, f) => { if (t === "") return ""; const parts = String(t).split("\t"); return parts.map((p, i) => (i ? `<w:r>${rpr(f)}<w:tab/></w:r>` : "") + (p ? `<w:r>${rpr(f)}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>` : "")).join(""); };
    const fmtOf = (el, f) => {
      const g = Object.assign({}, f), t = el.localName, s = el.style || {};
      if (t === "b" || t === "strong") g.b = 1; if (t === "i" || t === "em" || t === "cite") g.i = 1; if (t === "u" || t === "ins") g.u = 1; if (t === "s" || t === "strike" || t === "del") g.s = 1;
      if (t === "sub") g.va = "subscript"; if (t === "sup") g.va = "superscript"; if (t === "code" || t === "kbd" || t === "samp" || t === "tt") g.font = "Consolas";
      if (t === "mark") g.hl = "FFFF00"; if (t === "a") { g.color = "0563C1"; g.u = 1; }
      if (t === "font") { const c = colour(el.getAttribute("color")); if (c) g.color = c; const fc = el.getAttribute("face"); if (fc) g.font = fc.split(",")[0].replace(/["']/g, "").trim(); }
      if (s.fontWeight && (s.fontWeight === "bold" || +s.fontWeight >= 600)) g.b = 1; if (s.fontWeight === "normal" || (s.fontWeight && +s.fontWeight < 600)) g.b = 0;
      if (s.fontStyle === "italic") g.i = 1; if (s.fontStyle === "normal") g.i = 0;
      const td = (s.textDecorationLine || s.textDecoration || ""); if (/underline/.test(td)) g.u = 1; if (/line-through/.test(td)) g.s = 1;
      if (s.color) { const c = colour(s.color); if (c) g.color = c; }
      const bg = s.backgroundColor; if (bg) { const c = colour(bg); if (c) g.hl = c; }
      if (s.fontFamily) g.font = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      if (s.fontSize) { const px = len(s.fontSize); if (px) g.sz = px2hp(px); }
      if (s.verticalAlign === "super") g.va = "superscript"; if (s.verticalAlign === "sub") g.va = "subscript";
      return g;
    };
    async function image(el) {
      const src = el.getAttribute("src") || ""; if (!/^data:/.test(src)) return "";
      const d = await Z.toPng(src); if (!d) return ""; const ext = Z.extOf(d.mime), name = "image" + imgN++ + "." + ext; imgs.push({ name, bytes: d.bytes, ext });
      const id = addRel("image", "media/" + name);
      let w = el.getBoundingClientRect().width || el.naturalWidth || +el.getAttribute("width") || 200, h = el.getBoundingClientRect().height || el.naturalHeight || +el.getAttribute("height") || 150; if (!w || !h) { w = 200; h = 150; }
      const cx = px2emu(w), cy = px2emu(h), n = drawId++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${esc(el.getAttribute("alt") || "")}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
    async function inline(node, f) {
      let x = "";
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { x += run(c.nodeValue.replace(/ /g, " ").replace(/[\r\n]+/g, " "), f); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.localName;
        if (t === "br") { x += "<w:r><w:br/></w:r>"; continue; }
        if (t === "img") { x += await image(c); continue; }
        if (t === "ul" || t === "ol" || t === "table" || /^(p|div|h[1-6]|blockquote|pre)$/.test(t)) { x += await inline(c, fmtOf(c, f)); x += ""; continue; }
        if (t === "a" && c.getAttribute("href")) {
          const h = c.getAttribute("href"); let inner = await inline(c, fmtOf(c, f));
          if (/^#/.test(h)) x += `<w:hyperlink w:anchor="${esc(h.slice(1))}">${inner}</w:hyperlink>`; else x += `<w:hyperlink r:id="${addRel("hyperlink", h, true)}">${inner}</w:hyperlink>`; continue;
        }
        if (c.classList && c.classList.contains("pb")) { x += '<w:r><w:br w:type="page"/></w:r>'; continue; }
        x += await inline(c, fmtOf(c, f));
      }
      return x;
    }
    /* ---- paragraphs ---- */
    function ppr(el, o) {
      o = o || {}; let x = "";
      const s = el.style || {}, t = el.localName, cl = el.classList || { contains: () => false };
      let style = o.style; if (!style) { if (/^h[1-6]$/.test(t)) style = "Heading" + Math.min(+t[1], 6); else if (cl.contains("t-title")) style = "Title"; else if (cl.contains("t-sub")) style = "Subtitle"; else if (t === "blockquote") style = "Quote"; else if (t === "pre") style = "Code"; }
      if (style) x += `<w:pStyle w:val="${style}"/>`;
      if (o.keepNext) x += "<w:keepNext/>";
      if (o.num) x += `<w:numPr><w:ilvl w:val="${o.num[1]}"/><w:numId w:val="${o.num[0]}"/></w:numPr>`;
      if (cl.contains("hr")) x += '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="808080"/></w:pBdr>';
      const bg = colour(s.backgroundColor); if (bg && !o.noshd) x += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`;
      const sp = []; const mt = len(s.marginTop), mb = len(s.marginBottom), lh = s.lineHeight;
      if (mt != null) sp.push(`w:before="${px2tw(mt)}"`); if (mb != null) sp.push(`w:after="${px2tw(mb)}"`);
      if (lh && lh !== "normal") { const l = /px$/.test(lh) ? len(lh) : null; if (l) sp.push(`w:line="${px2tw(l)}" w:lineRule="exact"`); else if (!isNaN(parseFloat(lh))) sp.push(`w:line="${Math.round(parseFloat(lh) * 240)}" w:lineRule="auto"`); }
      if (sp.length) x += `<w:spacing ${sp.join(" ")}/>`;
      const ml = len(s.marginLeft) || len(s.paddingLeft), ti = len(s.textIndent), mr = len(s.marginRight);
      if (!o.num && (ml || ti || mr)) x += `<w:ind${ml ? ` w:left="${px2tw(ml)}"` : ""}${mr ? ` w:right="${px2tw(mr)}"` : ""}${ti ? (ti > 0 ? ` w:firstLine="${px2tw(ti)}"` : ` w:hanging="${px2tw(-ti)}"`) : ""}/>`;
      const al = s.textAlign || el.getAttribute("align"); if (al) { const j = { left: "left", start: "left", center: "center", right: "right", end: "right", justify: "both" }[al]; if (j) x += `<w:jc w:val="${j}"/>`; }
      return x ? `<w:pPr>${x}</w:pPr>` : "";
    }
    const trim = (x) => x.replace(/(<w:r><w:br\/><\/w:r>)+$/, "");
    const para = async (el, o) => { const f = fmtOf(el, (o && o.f) || {}); const empty = !el.textContent.replace(/\u200b/g, "").trim() && !el.querySelector("img"); return `<w:p>${ppr(el, o)}${empty ? "" : trim(await inline(el, f))}</w:p>`; };
    /* ---- lists ---- */
    async function list(el, depth, nid) {
      const ordered = el.localName === "ol"; let id = nid;
      if (depth === 0) { if (ordered) { id = numId++; nums.push(id); } else id = 1; }
      let x = "";
      for (const li of el.children) {
        if (li.localName !== "li") continue;
        const nested = []; const clone = li.cloneNode(true); clone.querySelectorAll("ul,ol").forEach((n) => { nested.push(n); });
        // text part of the li (without nested lists)
        const holder = document.createElement("div"); for (const c of li.childNodes) { if (c.nodeType === 1 && /^(ul|ol)$/.test(c.localName)) continue; holder.append(c.cloneNode(true)); }
        holder.style.cssText = li.style.cssText;
        const kind = ordered ? 2 : 1;
        x += `<w:p>${ppr(li, { num: [id, depth], style: "ListParagraph" })}${trim(await inline(holder, fmtOf(li, {})))}</w:p>`;
        for (const c of li.children) if (/^(ul|ol)$/.test(c.localName)) { if (c.localName === "ol" && !ordered || c.localName === "ol") { const nid2 = c.localName === "ol" ? (nums.push(numId), numId++) : 1; x += await list(c, depth + 1, c.localName === "ol" ? nid2 : 1); } else x += await list(c, depth + 1, 1); }
      }
      return x;
    }
    /* ---- tables ---- */
    async function table(el) {
      const rows = [...el.querySelectorAll(":scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr")]; if (!rows.length) return "";
      const first = rows[0], widths = [...first.children].filter((c) => /^t[dh]$/.test(c.localName)).flatMap((c) => { const cs = +c.getAttribute("colspan") || 1, w = c.getBoundingClientRect().width || 100; return Array(cs).fill(px2tw(w / cs)); });
      const border = el.classList.contains("nb") ? "none" : "single";
      let x = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="${border}" w:sz="4" w:space="0" w:color="${el.dataset.bc ? colour(el.dataset.bc) || "808080" : "808080"}"/>`).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
      const occ = []; // row spans in progress per grid column
      for (let ri = 0; ri < rows.length; ri++) {
        const tr = rows[ri]; let ci = 0; x += "<w:tr>" + (ri === 0 && tr.querySelector("th") ? "<w:trPr><w:tblHeader/></w:trPr>" : "");
        for (const td of [...tr.children].filter((c) => /^t[dh]$/.test(c.localName))) {
          while (occ[ci] > 0) { x += `<w:tc><w:tcPr><w:tcW w:w="${widths[ci] || 1000}" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>`; occ[ci]--; ci++; }
          const cs = +td.getAttribute("colspan") || 1, rs = +td.getAttribute("rowspan") || 1; const w = widths.slice(ci, ci + cs).reduce((a, b) => a + b, 0) || 1000;
          const bg = colour(td.style.backgroundColor) || (td.localName === "th" ? "E7E9F2" : null), va = td.style.verticalAlign;
          let pr = `<w:tcW w:w="${w}" w:type="dxa"/>${cs > 1 ? `<w:gridSpan w:val="${cs}"/>` : ""}${rs > 1 ? '<w:vMerge w:val="restart"/>' : ""}${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : ""}${va ? `<w:vAlign w:val="${va === "middle" ? "center" : va === "bottom" ? "bottom" : "top"}"/>` : ""}`;
          x += `<w:tc><w:tcPr>${pr}</w:tcPr>${(await blocks(td, td.localName === "th" ? { f: { b: 1 } } : {})) || "<w:p/>"}</w:tc>`;
          for (let k = 0; k < cs; k++) occ[ci + k] = rs - 1; ci += cs;
        }
        while (occ[ci] > 0) { x += `<w:tc><w:tcPr><w:tcW w:w="${widths[ci] || 1000}" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>`; occ[ci]--; ci++; }
        x += "</w:tr>";
      }
      return x + "</w:tbl><w:p/>";
    }
    /* ---- blocks ---- */
    async function blocks(root2, o) {
      let x = "", pending = null;
      const flush = async () => { if (pending && (pending.childNodes.length)) { const has = pending.textContent.trim() || pending.querySelector("img"); if (has) x += `<w:p>${await inline(pending, (o && o.f) || {})}</w:p>`; } pending = null; };
      for (const c of root2.childNodes) {
        if (c.nodeType === 3) { if (!c.nodeValue.trim()) continue; (pending = pending || document.createElement("p")).append(c.cloneNode(true)); continue; }
        if (c.nodeType !== 1) continue; const t = c.localName;
        if (/^(p|h[1-6]|blockquote|pre|li)$/.test(t) || (t === "div" && !c.querySelector("p,div,ul,ol,table,h1,h2,h3,h4,h5,h6,blockquote,pre,hr"))) {
          await flush();
          if (c.classList.contains("pb")) { x += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
          if (c.classList.contains("toc")) { x += await tocXml(c); continue; }
          if (t === "pre") { x += `<w:p>${ppr(c, { style: "Code" })}${(await inline(c, fmtOf(c, { font: "Consolas" }))).replace(/\n/g, "")}</w:p>`; continue; }
          x += await para(c, o); continue;
        }
        if (t === "ul" || t === "ol") { await flush(); x += await list(c, 0, 1); continue; }
        if (t === "table") { await flush(); x += await table(c); continue; }
        if (t === "hr") { await flush(); x += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="808080"/></w:pBdr></w:pPr></w:p>'; continue; }
        if (t === "div" || t === "section" || t === "article" || t === "header" || t === "footer" || t === "main" || t === "figure") { await flush(); if (c.classList.contains("pb")) x += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; else x += await blocks(c, o); continue; }
        if (t === "br") { await flush(); x += "<w:p/>"; continue; }
        (pending = pending || document.createElement("p")).append(c.cloneNode(true));
      }
      await flush(); return x;
    }
    const tocXml = async (c) => { let x = ""; for (const a of c.querySelectorAll("a")) x += `<w:p><w:pPr><w:ind w:left="${(+a.dataset.lvl || 1) * 360 - 360}"/></w:pPr><w:hyperlink w:anchor="${esc((a.getAttribute("href") || "").slice(1))}"><w:r><w:rPr><w:color w:val="0563C1"/></w:rPr><w:t xml:space="preserve">${esc(a.textContent)}</w:t></w:r></w:hyperlink></w:p>`; return `<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr><w:r><w:t>Contents</w:t></w:r></w:p>` + x; };

    // bookmarks for headings so contents links work
    let body = await blocks(root, {});
    const pg = meta.page || {}, sz = { A4: [11906, 16838], A3: [16838, 23811], A5: [8391, 11906], Letter: [12240, 15840], Legal: [12240, 20160] }[pg.size || "A4"] || [11906, 16838];
    const land = pg.orient === "landscape", pw = land ? sz[1] : sz[0], ph = land ? sz[0] : sz[1], m = pg.margins || { t: 25.4, r: 25.4, b: 25.4, l: 25.4 }, mm = (v) => Math.round(v * 56.693);
    const hdr = meta.header || "", ftr = meta.footer || "";
    const hdrRel = hdr ? addRel("header", "header1.xml") : "", ftrRel = (ftr || true) ? addRel("footer", "footer1.xml") : "";
    const sect = `<w:sectPr>${hdr ? `<w:headerReference w:type="default" r:id="${hdrRel}"/>` : ""}<w:footerReference w:type="default" r:id="${ftrRel}"/><w:pgSz w:w="${pw}" w:h="${ph}"${land ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${mm(m.t)}" w:right="${mm(m.r)}" w:bottom="${mm(m.b)}" w:left="${mm(m.l)}" w:header="708" w:footer="708" w:gutter="0"/>${pg.cols > 1 ? `<w:cols w:num="${pg.cols}" w:space="708"/>` : ""}</w:sectPr>`;
    const NS = `xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body || "<w:p/>"}${sect}</w:body></w:document>`;
    const hf = async (tag, html) => { const d = document.createElement("div"); d.innerHTML = html; return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} ${NS}>${(await blocks(d, {})) || "<w:p/>"}</w:${tag}>`; };
    const pageField = '<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Page </w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    let footXml = await hf("ftr", ftr); footXml = footXml.replace("</w:ftr>", pageField + "</w:ftr>");
    const numXml = numbering(nums);
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>${hdr ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const entries = [
      { name: "[Content_Types].xml", data: ct },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${R}/extended-properties" Target="docProps/app.xml"/></Relationships>` },
      { name: "word/document.xml", data: docXml },
      { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R}/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="${R}/settings" Target="settings.xml"/>${rels.join("")}</Relationships>` },
      { name: "word/styles.xml", data: styles() }, { name: "word/numbering.xml", data: numXml },
      { name: "word/settings.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
      { name: "word/footer1.xml", data: footXml },
      { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title || "")}</dc:title><dc:creator>${esc(meta.author || "KMR Office Suite")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
      { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>KMR Office Suite</Application></Properties>` }
    ];
    if (hdr) entries.push({ name: "word/header1.xml", data: await hf("hdr", hdr) });
    imgs.forEach((i) => entries.push({ name: "word/media/" + i.name, data: i.bytes }));
    return Z.build(entries);
  }
  function numbering(extra) {
    const lv = (i, fmt, txt, font) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr>` : ""}</w:lvl>`;
    const bul = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => lv(i, "bullet", ["•", "o", "▪"][i % 3], ["Symbol", "Courier New", "Wingdings"][i % 3] === "Symbol" ? "Arial" : "Arial")).join("");
    const fmts = ["decimal", "lowerLetter", "lowerRoman"], dec = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => lv(i, fmts[i % 3], `%${i + 1}.`)).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${bul}</w:abstractNum><w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>${dec}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>${extra.map((n) => `<w:num w:numId="${n}"><w:abstractNumId w:val="2"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join("")}</w:numbering>`;
  }
  function styles() {
    const ps = (id, name, rpr, ppr, based, next, extra) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${based ? `<w:basedOn w:val="${based}"/>` : ""}${next ? `<w:next w:val="${next}"/>` : ""}${extra || ""}<w:qFormat/>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}</w:style>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
      + ps("Heading1", "heading 1", '<w:b/><w:color w:val="1F3864"/><w:sz w:val="36"/>', '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/>', "Normal", "Normal")
      + ps("Heading2", "heading 2", '<w:b/><w:color w:val="2F5496"/><w:sz w:val="30"/>', '<w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/>', "Normal", "Normal")
      + ps("Heading3", "heading 3", '<w:b/><w:color w:val="2F5496"/><w:sz w:val="26"/>', '<w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/>', "Normal", "Normal")
      + ps("Heading4", "heading 4", '<w:b/><w:i/><w:sz w:val="24"/>', '<w:keepNext/><w:outlineLvl w:val="3"/>', "Normal", "Normal") + ps("Heading5", "heading 5", '<w:b/><w:sz w:val="22"/>', '<w:keepNext/><w:outlineLvl w:val="4"/>', "Normal", "Normal") + ps("Heading6", "heading 6", '<w:b/><w:color w:val="595959"/>', '<w:keepNext/><w:outlineLvl w:val="5"/>', "Normal", "Normal")
      + ps("Title", "Title", '<w:b/><w:sz w:val="56"/><w:color w:val="1F3864"/>', '<w:spacing w:after="160"/>', "Normal", "Normal") + ps("Subtitle", "Subtitle", '<w:color w:val="595959"/><w:sz w:val="30"/>', '<w:spacing w:after="200"/>', "Normal", "Normal")
      + ps("Quote", "Quote", '<w:i/><w:color w:val="404040"/>', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="A6A6A6"/></w:pBdr><w:ind w:left="567"/>', "Normal", "Normal")
      + ps("Code", "Code", '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>', '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:after="0"/>', "Normal", "Normal")
      + ps("ListParagraph", "List Paragraph", "", '<w:spacing w:after="40"/><w:contextualSpacing/>', "Normal") + ps("TOCHeading", "TOC Heading", '<w:b/><w:sz w:val="32"/>', "", "Normal", "Normal")
      + `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
  }

  /* ================= READ ================= */
  async function read(buf) {
    const zip = await Z.read(buf); const docXml = await zip.text("word/document.xml"); if (!docXml) throw new Error("This is not a Word document (word/document.xml is missing).");
    const doc = Z.parse(docXml), K = Z.kids, kid = Z.kid, at = Z.at;
    const relsXml = await zip.text("word/_rels/document.xml.rels"), rel = {};
    if (relsXml) Z.deep(Z.parse(relsXml).documentElement, "Relationship").forEach((r) => (rel[r.getAttribute("Id")] = { t: r.getAttribute("Target"), type: (r.getAttribute("Type") || "").split("/").pop(), ext: r.getAttribute("TargetMode") === "External" }));
    const stXml = await zip.text("word/styles.xml"), styleDef = {};
    let defaultSz = 22;
    if (stXml) {
      const sd = Z.parse(stXml); const dd = Z.deep(sd.documentElement, "rPrDefault")[0]; if (dd) { const s = at(kid(kid(dd, "rPr"), "sz"), "w:val") || at(kid(kid(dd, "rPr"), "sz"), "val"); if (s) defaultSz = +s; }
      Z.deep(sd.documentElement, "style").forEach((s) => (styleDef[s.getAttributeNS(W, "styleId") || s.getAttribute("w:styleId")] = { el: s, based: at(kid(s, "basedOn"), "w:val") || (kid(s, "basedOn") && kid(s, "basedOn").getAttributeNS(W, "val")), name: kid(s, "name") ? (kid(s, "name").getAttributeNS(W, "val") || kid(s, "name").getAttribute("w:val")) : "" }));
    }
    const wv = (el) => (el ? el.getAttributeNS(W, "val") ?? el.getAttribute("w:val") : null), wa = (el, n) => (el ? el.getAttributeNS(W, n) ?? el.getAttribute("w:" + n) : null);
    const numXml = await zip.text("word/numbering.xml"), numFmt = {}; // numId -> [fmt per lvl]
    if (numXml) {
      const nd = Z.parse(numXml), abs = {};
      Z.deep(nd.documentElement, "abstractNum").forEach((a) => { const id = wa(a, "abstractNumId"); abs[id] = {}; K(a, "lvl").forEach((l) => (abs[id][wa(l, "ilvl")] = wv(kid(l, "numFmt")))); });
      Z.deep(nd.documentElement, "num").forEach((n) => { numFmt[wa(n, "numId")] = abs[wv(kid(n, "abstractNumId"))] || {}; });
    }
    /* style properties along the basedOn chain */
    const cache = {};
    function sprops(id) {
      if (!id) return { r: {}, p: {} }; if (cache[id]) return cache[id]; const s = styleDef[id]; if (!s) return { r: {}, p: {} };
      const base = s.based && s.based !== id ? sprops(s.based) : { r: {}, p: {} }; const o = { r: Object.assign({}, base.r), p: Object.assign({}, base.p) };
      Object.assign(o.r, rprops(kid(s.el, "rPr"))); Object.assign(o.p, pprops(kid(s.el, "pPr"))); cache[id] = o; return o;
    }
    function rprops(rp) {
      const o = {}; if (!rp) return o;
      const on = (n) => { const e = kid(rp, n); if (!e) return undefined; const v = wv(e); return !(v === "0" || v === "false" || v === "off"); };
      const b = on("b"), i = on("i"), s = on("strike"), u = kid(rp, "u"); if (b !== undefined) o.b = b; if (i !== undefined) o.i = i; if (s !== undefined) o.s = s; if (u) o.u = wv(u) !== "none";
      const c = kid(rp, "color"); if (c && wv(c) && wv(c) !== "auto") o.color = "#" + wv(c); const sz = kid(rp, "sz"); if (sz) o.sz = +wv(sz) / 1.5; // px
      const hl = kid(rp, "highlight"); if (hl && wv(hl) !== "none") o.hl = ({ yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff", red: "#ff0000", blue: "#0000ff", black: "#000000", white: "#ffffff", darkYellow: "#808000", lightGray: "#d3d3d3" })[wv(hl)] || "#ffff00";
      const sh = kid(rp, "shd"); if (sh && wa(sh, "fill") && wa(sh, "fill") !== "auto") o.hl = "#" + wa(sh, "fill");
      const f = kid(rp, "rFonts"); if (f) { const n = wa(f, "ascii") || wa(f, "hAnsi"); if (n) o.font = n; }
      const va = kid(rp, "vertAlign"); if (va) o.va = wv(va); return o;
    }
    function pprops(pp) {
      const o = {}; if (!pp) return o;
      const jc = kid(pp, "jc"); if (jc) o.align = { both: "justify", center: "center", right: "right", left: "left", start: "left", end: "right" }[wv(jc)];
      const ind = kid(pp, "ind"); if (ind) { const l = wa(ind, "left") || wa(ind, "start"), h = wa(ind, "hanging"), f = wa(ind, "firstLine"); if (l) o.ml = +l / 15; if (h) o.ti = -h / 15; else if (f) o.ti = +f / 15; }
      const sp = kid(pp, "spacing"); if (sp) { const b = wa(sp, "before"), a = wa(sp, "after"), l = wa(sp, "line"), lr = wa(sp, "lineRule"); if (b) o.mt = +b / 15; if (a) o.mb = +a / 15; if (l && (!lr || lr === "auto")) o.lh = +l / 240; }
      const sh = kid(pp, "shd"); if (sh && wa(sh, "fill") && wa(sh, "fill") !== "auto") o.bg = "#" + wa(sh, "fill");
      const bd = kid(pp, "pBdr"); if (bd && kid(bd, "bottom") && !Z.deep(pp.parentNode || pp, "t").length) o.hr = false;
      const np = kid(pp, "numPr"); if (np) o.num = [wv(kid(np, "numId")), +(wv(kid(np, "ilvl")) || 0)];
      const ps = kid(pp, "pStyle"); if (ps) o.style = wv(ps);
      const ol = kid(pp, "outlineLvl"); if (ol) o.outline = +wv(ol); if (kid(pp, "pageBreakBefore")) o.pbb = true;
      return o;
    }
    const css = (o) => {
      let s = ""; if (o.b) s += "font-weight:700;"; if (o.i) s += "font-style:italic;"; if (o.u && o.s) s += "text-decoration:underline line-through;"; else if (o.u) s += "text-decoration:underline;"; else if (o.s) s += "text-decoration:line-through;";
      if (o.color) s += `color:${o.color};`; if (o.hl) s += `background-color:${o.hl};`; if (o.font) s += `font-family:'${o.font}';`; if (o.sz && Math.abs(o.sz - defaultSz / 1.5) > 0.1) s += `font-size:${Math.round(o.sz * 10) / 10}px;`; return s;
    };
    const media = {};
    async function pic(blip) {
      const id = blip.getAttributeNS(R, "embed") || blip.getAttribute("r:embed"); const r = rel[id]; if (!r) return null; const path = ("word/" + r.t).replace(/word\/\.\.\//, "");
      if (!media[path]) { const b = await zip.bytes(path); if (!b) return null; let mime = Z.mimeOf(path); if (/emf|wmf/.test(mime)) return null; media[path] = await Z.bytesToData(b, mime); } return media[path];
    }
    /* runs in a paragraph */
    async function runs(p, base) {
      let h = "";
      const walk = async (node, inheritedLink) => {
        for (const c of Array.from(node.children)) {
          const n = c.localName;
          if (n === "r") {
            const rp = Object.assign({}, base, rprops(kid(c, "rPr"))); const rs = kid(kid(c, "rPr"), "rStyle"); if (rs) Object.assign(rp, sprops(wv(rs)).r, rprops(kid(c, "rPr")));
            let inner = "";
            for (const x of Array.from(c.children)) {
              const xn = x.localName;
              if (xn === "t") inner += esc(x.textContent).replace(/ {2}/g, " &nbsp;"); else if (xn === "tab") inner += "&emsp;"; else if (xn === "br") { inner += wa(x, "type") === "page" ? '</span><div class="pb" contenteditable="false"></div><span>' : "<br>"; } else if (xn === "cr") inner += "<br>"; else if (xn === "noBreakHyphen") inner += "-"; else if (xn === "sym") { const ch = wa(x, "char"); if (ch) inner += String.fromCodePoint(parseInt(ch, 16) & 0xffff); }
              else if (xn === "drawing" || xn === "pict") {
                for (const b of Z.deep(x, "blip")) { const src = await pic(b); if (src) { let w = 0, hh = 0; const ext = Z.deep(x, "extent")[0]; if (ext) { w = +ext.getAttribute("cx") / 9525; hh = +ext.getAttribute("cy") / 9525; } inner += `<img src="${src}"${w ? ` width="${Math.round(w)}" height="${Math.round(hh)}"` : ""} alt="${esc((Z.deep(x, "docPr")[0] || { getAttribute: () => "" }).getAttribute("descr") || "")}">`; } }
              }
            }
            if (!inner) continue; const st = css(rp); let t = inner; if (st) t = `<span style="${st}">${t}</span>`; if (rp.va === "superscript") t = `<sup>${t}</sup>`; else if (rp.va === "subscript") t = `<sub>${t}</sub>`;
            h += t;
          } else if (n === "hyperlink") {
            const rid = c.getAttributeNS(R, "id") || c.getAttribute("r:id"), anc = wa(c, "anchor"); const before = h; h = ""; await walk(c); const inner = h; h = before;
            const href = rid && rel[rid] ? rel[rid].t : anc ? "#" + anc : ""; h += href ? `<a href="${esc(href)}">${inner}</a>` : inner;
          } else if (/^(ins|smartTag|sdt|sdtContent|fldSimple|customXml|bdo)$/.test(n)) await walk(c);
          else if (n === "del") { /* deleted text is not shown */ }
        }
      };
      await walk(p); return h;
    }
    const headingOf = (st, pr) => { const nm = ((styleDef[st] && styleDef[st].name) || st || "").toLowerCase(); let m = /^heading ?([1-6])$/.exec(nm); if (m) return "h" + m[1]; if (nm === "title") return "title"; if (nm === "subtitle") return "sub"; if (/quote/.test(nm)) return "quote"; if (pr && pr.outline != null && pr.outline < 6) return "h" + (pr.outline + 1); return null; };
    let used = 0;
    async function para(p, listState) {
      const ppEl = kid(p, "pPr"), own = pprops(ppEl), sty = own.style || null, st = sprops(sty), pr = Object.assign({}, st.p, own);
      const base = Object.assign({}, st.r); const k = headingOf(sty, pr);
      let inner = await runs(p, k && /^h/.test(k) ? Object.assign({}, base, { b: base.b, sz: null, color: null }) : base);
      if (k && /^h/.test(k)) inner = inner; // heading look comes from our CSS
      const hasPb = /class="pb"/.test(inner);
      let style = ""; if (pr.align) style += `text-align:${pr.align};`; if (pr.bg) style += `background-color:${pr.bg};`;
      if (pr.lh && Math.abs(pr.lh - 1.1) > 0.01) style += `line-height:${Math.round(pr.lh * 100) / 100};`;
      if (pr.mt != null) style += `margin-top:${Math.round(pr.mt)}px;`; if (pr.mb != null) style += `margin-bottom:${Math.round(pr.mb)}px;`;
      if (!pr.num) { if (pr.ml) style += `margin-left:${Math.round(pr.ml)}px;`; if (pr.ti) style += `text-indent:${Math.round(pr.ti)}px;`; }
      const empty = !inner.replace(/<[^>]*>/g, "").trim() && !/<img/.test(inner) && !hasPb;
      if (pr.num && pr.num[0] !== "0" && !empty) return { list: pr.num, html: inner, style };
      if (empty) return { html: '<p><br></p>' };
      let tag = "p", cls = ""; if (k && /^h[1-6]$/.test(k)) tag = k; else if (k === "title") cls = ' class="t-title"'; else if (k === "sub") cls = ' class="t-sub"'; else if (k === "quote") tag = "blockquote";
      if (/^Code$/i.test(sty || "") || /code|source/i.test((styleDef[sty] || {}).name || "")) tag = "pre";
      if (hasPb) return { html: inner.replace(/<\/span><div class="pb" contenteditable="false"><\/div><span>/g, '<div class="pb" contenteditable="false"></div>').replace(/^<span>|<span><\/span>/g, "") };
      return { html: `<${tag}${cls}${style ? ` style="${style}"` : ""}>${inner}</${tag}>` };
    }
    async function table(tbl) {
      const grid = K(kid(tbl, "tblGrid"), "gridCol").map((g) => +wa(g, "w") / 15); const bd = kid(kid(tbl, "tblPr"), "tblBorders"); const hasB = !bd || ["top", "left", "bottom", "right", "insideH", "insideV"].some((n) => { const e = kid(bd, n); return e && wv(e) !== "none" && wv(e) !== "nil"; });
      const rows = K(tbl, "tr"), grid2 = []; let html = `<table class="dt${hasB ? "" : " nb"}"><tbody>`;
      const tcs = rows.map((tr) => K(tr, "tc"));
      for (let ri = 0; ri < rows.length; ri++) {
        const hdr = !!kid(kid(rows[ri], "trPr"), "tblHeader"); html += "<tr>"; let ci = 0;
        for (const tc of tcs[ri]) {
          const pr = kid(tc, "tcPr"), gs = +(wv(kid(pr, "gridSpan")) || 1), vm = kid(pr, "vMerge"); let rowspan = 1;
          if (vm && !wv(vm) || (vm && wv(vm) === "continue")) { ci += gs; continue; }
          if (vm && wv(vm) === "restart") { for (let r2 = ri + 1; r2 < rows.length; r2++) { let cc = 0, found = null; for (const t2 of tcs[r2]) { const p2 = kid(t2, "tcPr"), g2 = +(wv(kid(p2, "gridSpan")) || 1); if (cc === ci) { found = kid(p2, "vMerge"); break; } cc += g2; } if (found && (!wv(found) || wv(found) === "continue")) rowspan++; else break; } }
          const w = grid.slice(ci, ci + gs).reduce((a, b) => a + b, 0), sh = kid(pr, "shd"), fill = sh && wa(sh, "fill") && wa(sh, "fill") !== "auto" ? "#" + wa(sh, "fill") : "", va = wv(kid(pr, "vAlign"));
          const cell = await blocksOf(tc);
          html += `<td${gs > 1 ? ` colspan="${gs}"` : ""}${rowspan > 1 ? ` rowspan="${rowspan}"` : ""} style="${w ? `width:${Math.round(w)}px;` : ""}${fill ? `background-color:${fill};` : ""}${va ? `vertical-align:${va === "center" ? "middle" : va};` : ""}">${cell || "<br>"}</td>`; ci += gs;
        }
        html += "</tr>";
      }
      return html + "</tbody></table><p><br></p>";
    }
    async function blocksOf(parent) {
      let out = "";
      // simple builder: collect flat items with levels, then nest
      const flat = [];
      const flush = () => { if (!flat.length) return; out += nest(flat.splice(0)); };
      for (const c of Array.from(parent.children)) {
        const n = c.localName;
        if (n === "p") { const r = await para(c); if (r.list) { flat.push(r); } else { flush(); out += r.html; } }
        else if (n === "tbl") { flush(); out += await table(c); }
        else if (/^(sdt|sdtContent|customXml|ins)$/.test(n)) { flush(); out += await blocksOf(n === "sdt" ? kid(c, "sdtContent") || c : c); }
        else if (n === "sectPr") { /* handled by caller */ }
      }
      flush(); return out;
    }
    function nest(items) {
      let h = ""; const stack = []; // [{tag, open li?}]
      const kindOf = (it) => { const fmt = (numFmt[it.list[0]] || {})[it.list[1]] || "bullet"; return fmt === "bullet" || fmt === "none" ? "ul" : "ol"; };
      const close = (to) => { while (stack.length > to) { const s = stack.pop(); h += `</li></${s.tag}>`; } };
      items.forEach((it) => {
        const lv = Math.min(it.list[1], 8), tag = kindOf(it);
        if (stack.length > lv + 1) close(lv + 1);
        if (stack.length === lv + 1) { if (stack[lv].tag !== tag || stack[lv].id !== it.list[0]) { close(lv); } }
        if (stack.length === lv + 1) { h += "</li>"; }
        else { while (stack.length < lv + 1) { const t2 = stack.length === lv ? tag : "ul"; h += `<${t2}>` + (stack.length === lv ? "" : "<li>"); stack.push({ tag: t2, id: it.list[0] }); } }
        if (stack.length === lv + 1 && !stack[lv].id) stack[lv].id = it.list[0];
        h += `<li${it.style ? ` style="${it.style}"` : ""}>${it.html}`;
      });
      close(0); return h;
    }
    const body = Z.kids(doc.documentElement, "body")[0];
    let html = await blocksOf(body);
    // page settings
    const sp = Z.deep(body, "sectPr").pop(), page = { size: "A4", orient: "portrait", margins: { t: 25.4, r: 25.4, b: 25.4, l: 25.4 } };
    if (sp) {
      const sz = kid(sp, "pgSz"), mg = kid(sp, "pgMar"); if (sz) { const w = +wa(sz, "w"), h2 = +wa(sz, "h"), o = wa(sz, "orient") === "landscape" || w > h2; page.orient = o ? "landscape" : "portrait"; const a = Math.min(w, h2), b = Math.max(w, h2); const T = { A4: [11906, 16838], A3: [16838, 23811], A5: [8391, 11906], Letter: [12240, 15840], Legal: [12240, 20160] }; let best = "A4", d = 1e9; Object.keys(T).forEach((k) => { const dd = Math.abs(T[k][0] - a) + Math.abs(T[k][1] - b); if (dd < d) { d = dd; best = k; } }); page.size = best; }
      if (mg) { const f = (n) => Math.round((+wa(mg, n) / 56.693) * 10) / 10; page.margins = { t: f("top") || 25.4, r: f("right") || 25.4, b: f("bottom") || 25.4, l: f("left") || 25.4 }; }
      const cols = kid(sp, "cols"); if (cols && +wa(cols, "num") > 1) page.cols = +wa(cols, "num");
    }
    const part = async (kind) => { const sp2 = sp && Z.kids(sp, kind + "Reference")[0]; if (!sp2) return ""; const rid = sp2.getAttributeNS(R, "id") || sp2.getAttribute("r:id"); const r = rel[rid]; if (!r) return ""; const x = await zip.text("word/" + r.t); if (!x) return ""; const dd = Z.parse(x); const hh = await blocksOf(dd.documentElement); return hh.replace(/<p><br><\/p>/g, "").replace(/<\/?p[^>]*>/g, " ").replace(/<[^>]+>/g, (m) => (/^<(b|i|u|strong|em|br|span)/.test(m) || /^<\/(b|i|u|strong|em|span)>/.test(m) ? m : "")).trim(); };
    let header = "", footer = ""; try { header = await part("header"); footer = await part("footer"); } catch (e) { /* ignore */ }
    const cp = await zip.text("docProps/core.xml"); let title = ""; if (cp) { const m = /<dc:title>([^<]*)<\/dc:title>/.exec(cp); if (m) title = m[1]; }
    return { html: html || "<p><br></p>", page, header, footer, title };
  }
  window.OffDocx = { write, read };
})();
