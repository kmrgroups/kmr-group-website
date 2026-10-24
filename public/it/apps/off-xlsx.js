/* KMR Office Suite - spreadsheet file formats: .xlsx writer and reader (with styles, merges, widths, freeze panes, conditional formats, validation, charts) and CSV. */
(function () {
  "use strict";
  const Z = window.OffZip, C = window.Calc, esc = Z.esc;
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const DEFCOL = 80, DEFROW = 22;
  const argb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); return m ? "FF" + m[1].toUpperCase() : null; };
  const fromArgb = (c) => (c && /^[0-9a-f]{8}$/i.test(c) ? "#" + c.slice(2).toLowerCase() : c && /^[0-9a-f]{6}$/i.test(c) ? "#" + c.toLowerCase() : null);
  const BSTYLE = { thin: "thin", medium: "medium", thick: "thick", dashed: "dashed", dotted: "dotted", double: "double", hair: "hair" };
  const INDEXED = ["000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080", "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF", "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF", "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99", "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696", "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333"];
  const THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];
  const tint = (hex, t) => { const n = parseInt(hex, 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t); return [f(r), f(g), f(b)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join(""); };

  /* ================= WRITE ================= */
  async function write(wb, meta) {
    meta = meta || {};
    const fonts = [], fills = [], borders = [], numfmts = [], xfs = [], dxfs = []; const idx = (arr, o) => { const k = JSON.stringify(o); let i = arr.findIndex((x) => x.k === k); if (i < 0) { i = arr.length; arr.push({ k, o }); } return i; };
    idx(fonts, { fs: 11, ff: "Calibri" }); idx(fills, { none: 1 }); idx(fills, { gray: 1 }); idx(borders, {});
    const nfId = (code) => { if (!code || code === "General") return 0; const b = Object.keys(C.Fmt.BUILT).find((k) => C.Fmt.BUILT[k] === code && +k < 50 && +k !== 14); if (b) return +b; let i = numfmts.findIndex((x) => x === code); if (i < 0) { i = numfmts.length; numfmts.push(code); } return 164 + i; };
    const xfMap = new Map();
    const xfOf = (s, nf) => {
      s = s || {}; const k = JSON.stringify([s, nf || null]); if (xfMap.has(k)) return xfMap.get(k);
      const font = idx(fonts, { b: s.b, i: s.i, u: s.u, st: s.st, fs: s.fs || 11, ff: s.ff || "Calibri", fc: s.fc }), fill = s.bg ? idx(fills, { c: s.bg }) : 0, bd = s.bd ? idx(borders, s.bd) : 0, n = nfId(nf || s.nf);
      const x = { n, font, fill, bd, a: s.ha || s.va || s.wr || s.ind ? { ha: s.ha, va: s.va, wr: s.wr, ind: s.ind } : null }; const i = xfs.length; xfs.push(x); xfMap.set(k, i); return i;
    };
    xfOf({}, null);
    const sst = [], sstMap = new Map(); const si = (t) => { let i = sstMap.get(t); if (i == null) { i = sst.length; sst.push(t); sstMap.set(t, i); } return i; };
    const entries = [], sheetRels = []; const ct = [];
    let chartN = 0, drawN = 0, tableN = 0;
    const colPx = (sh, c) => (sh.cols[c] != null ? sh.cols[c] : DEFCOL), rowPx = (sh, r) => (sh.rows[r] != null ? sh.rows[r] : DEFROW);
    const sheetXml = async (sh, sIdx) => {
      const [mr, mc] = sh.dims(); const rows = new Map(); const gp = (sh.ext && sh.ext.grp) || { rows: [], cols: [] }; const lvl = (arr, i) => arr.reduce((n, o) => n + (i >= o.a && i <= o.b ? 1 : 0), 0); gp.rows.forEach((o) => { for (let i = o.a; i <= Math.min(o.b, o.a + 5000); i++) if (!rows.has(i)) rows.set(i, []); });
      sh.each((r, c, cell) => { if (!rows.has(r)) rows.set(r, []); rows.get(r).push([c, cell]); });
      Object.keys(sh.rows).forEach((r) => { if (!rows.has(+r)) rows.set(+r, []); }); Object.keys(sh.hiddenRows || {}).forEach((r) => { if (!rows.has(+r)) rows.set(+r, []); });
      let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + `<worksheet xmlns="${M}" xmlns:r="${R}">`;
      const fr = sh.freeze || { r: 0, c: 0 };
      x += `<sheetViews><sheetView workbookViewId="0"${sh.grid === false ? ' showGridLines="0"' : ""}${sIdx === wb.active ? ' tabSelected="1"' : ""}>${fr.r || fr.c ? `<pane${fr.c ? ` xSplit="${fr.c}"` : ""}${fr.r ? ` ySplit="${fr.r}"` : ""} topLeftCell="${C.addr(fr.r + 1, fr.c + 1)}" activePane="${fr.r && fr.c ? "bottomRight" : fr.r ? "bottomLeft" : "topRight"}" state="frozen"/>` : ""}</sheetView></sheetViews>`;
      x += `<sheetFormatPr defaultColWidth="${((DEFCOL - 5) / 7).toFixed(2)}" defaultRowHeight="${(DEFROW * 0.75).toFixed(2)}" customHeight="1"/>`;
      const ck = Object.keys(sh.cols).concat(Object.keys(sh.hiddenCols || {})).concat(gp.cols.reduce((a, o) => { for (let i = o.a; i <= Math.min(o.b, o.a + 500); i++) a.push(i); return a; }, [])).map(Number).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
      if (ck.length) x += "<cols>" + ck.map((c) => `<col min="${c}" max="${c}" width="${Math.max(0, (colPx(sh, c) - 5) / 7).toFixed(2)}" customWidth="1"${sh.hiddenCols && sh.hiddenCols[c] ? ' hidden="1"' : ""}${lvl(gp.cols, c) ? ` outlineLevel="${lvl(gp.cols, c)}"` : ""}/>`).join("") + "</cols>";
      x += "<sheetData>";
      for (const r of [...rows.keys()].sort((a, b) => a - b)) {
        const cells = rows.get(r).sort((a, b) => a[0] - b[0]); const rh = sh.rows[r];
        x += `<row r="${r}"${rh != null ? ` ht="${(rh * 0.75).toFixed(2)}" customHeight="1"` : ""}${sh.hiddenRows && sh.hiddenRows[r] ? ' hidden="1"' : ""}${lvl(gp.rows, r) ? ` outlineLevel="${lvl(gp.rows, r)}"` : ""}>`;
        for (const [c, cell] of cells) {
          const a = C.addr(r, c), s = xfOf(wb.style(cell.s), cell.nf), sa = s ? ` s="${s}"` : "";
          if (cell.f) {
            const v = wb.value(sh, r, c), f = esc(cell.f.slice(1));
            if (v == null) x += `<c r="${a}"${sa}><f>${f}</f></c>`; else if (C.isE(v)) x += `<c r="${a}"${sa} t="e"><f>${f}</f><v>${esc(v.code)}</v></c>`; else if (typeof v === "boolean") x += `<c r="${a}"${sa} t="b"><f>${f}</f><v>${v ? 1 : 0}</v></c>`; else if (typeof v === "number") x += `<c r="${a}"${sa}><f>${f}</f><v>${v}</v></c>`; else x += `<c r="${a}"${sa} t="str"><f>${f}</f><v>${esc(v)}</v></c>`;
          } else if (cell.v == null) { if (s) x += `<c r="${a}"${sa}/>`; }
          else if (typeof cell.v === "number") x += `<c r="${a}"${sa}><v>${cell.v}</v></c>`; else if (typeof cell.v === "boolean") x += `<c r="${a}"${sa} t="b"><v>${cell.v ? 1 : 0}</v></c>`; else x += `<c r="${a}"${sa} t="s"><v>${si(String(cell.v))}</v></c>`;
        }
        x += "</row>";
      }
      x += "</sheetData>";
      if (sh.ext && sh.ext.protect) x += '<sheetProtection sheet="1" objects="1" scenarios="1"/>';
      if (sh.filter && sh.filter.range) x += `<autoFilter ref="${esc(sh.filter.range)}"/>`;
      if (sh.merges.length) x += `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${esc(m)}"/>`).join("")}</mergeCells>`;
      let pr = 1;
      sh.cf.forEach((r) => {
        const rng = esc(r.range), fcol = argb(r.fc), bcol = argb(r.bg);
        if (r.type === "scale") { const cs = (r.colors || ["#f8696b", "#ffeb84", "#63be7b"]).map(argb); x += `<conditionalFormatting sqref="${rng}"><cfRule type="colorScale" priority="${pr++}"><colorScale>${cs.length === 3 ? '<cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/>' : '<cfvo type="min"/><cfvo type="max"/>'}${cs.map((c) => `<color rgb="${c}"/>`).join("")}</colorScale></cfRule></conditionalFormatting>`; return; }
        if (r.type === "bar") { x += `<conditionalFormatting sqref="${rng}"><cfRule type="dataBar" priority="${pr++}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${argb(r.bg) || "FF638EC6"}"/></dataBar></cfRule></conditionalFormatting>`; return; }
        const d = dxfs.length; dxfs.push(`<dxf>${fcol || r.b || r.i ? `<font>${r.b ? "<b/>" : ""}${r.i ? "<i/>" : ""}${fcol ? `<color rgb="${fcol}"/>` : ""}</font>` : ""}${bcol ? `<fill><patternFill patternType="solid"><fgColor rgb="${bcol}"/><bgColor rgb="${bcol}"/></patternFill></fill>` : ""}</dxf>`);
        const first = r.range.split(":")[0].replace(/\$/g, "");
        const opm = { gt: "greaterThan", lt: "lessThan", ge: "greaterThanOrEqual", le: "lessThanOrEqual", eq: "equal", ne: "notEqual", between: "between" };
        if (opm[r.type]) x += `<conditionalFormatting sqref="${rng}"><cfRule type="cellIs" dxfId="${d}" priority="${pr++}" operator="${opm[r.type]}"><formula>${esc(r.v1)}</formula>${r.type === "between" ? `<formula>${esc(r.v2)}</formula>` : ""}</cfRule></conditionalFormatting>`;
        else if (r.type === "text") x += `<conditionalFormatting sqref="${rng}"><cfRule type="containsText" dxfId="${d}" priority="${pr++}" operator="containsText" text="${esc(r.text)}"><formula>NOT(ISERROR(SEARCH("${esc(r.text)}",${first})))</formula></cfRule></conditionalFormatting>`;
        else if (r.type === "dup") x += `<conditionalFormatting sqref="${rng}"><cfRule type="duplicateValues" dxfId="${d}" priority="${pr++}"/></conditionalFormatting>`;
        else if (r.type === "top" || r.type === "bottom") x += `<conditionalFormatting sqref="${rng}"><cfRule type="top10" dxfId="${d}" priority="${pr++}"${r.type === "bottom" ? ' bottom="1"' : ""} rank="${r.n || 10}"/></conditionalFormatting>`;
        else if (r.type === "blank") x += `<conditionalFormatting sqref="${rng}"><cfRule type="containsBlanks" dxfId="${d}" priority="${pr++}"><formula>LEN(TRIM(${first}))=0</formula></cfRule></conditionalFormatting>`;
      });
      const dv = (sh.dv || []).filter((d) => d.type === "list" || d.type === "whole" || d.type === "decimal");
      if (dv.length) x += `<dataValidations count="${dv.length}">${dv.map((d) => `<dataValidation type="${d.type}" ${d.type !== "list" ? `operator="${d.op || "between"}" ` : ""}allowBlank="1" showErrorMessage="1" ${d.msg ? `error="${esc(d.msg)}" ` : ""}sqref="${esc(d.range)}"><formula1>${d.type === "list" ? (/^=/.test(d.list || "") ? esc(d.list.slice(1)) : '"' + esc(String(d.list || "").replace(/"/g, "")) + '"') : esc(d.v1)}</formula1>${d.type !== "list" && d.v2 != null && d.v2 !== "" ? `<formula2>${esc(d.v2)}</formula2>` : ""}</dataValidation>`).join("")}</dataValidations>`;
      x += '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';
      const ro = []; if (sh.charts && sh.charts.length) {
        drawN++; const dn = drawN; const dxml = await drawing(sh, sIdx, dn); entries.push({ name: `xl/drawings/drawing${dn}.xml`, data: dxml.xml }); entries.push({ name: `xl/drawings/_rels/drawing${dn}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${dxml.rels}</Relationships>` });
        ct.push(`<Override PartName="/xl/drawings/drawing${dn}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`); ro.push(`<Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing${dn}.xml"/>`); x += '<drawing r:id="rId1"/>';
      }
      const tbs = (sh.ext && sh.ext.tables) || []; if (tbs.length) { x += `<tableParts count="${tbs.length}">`; tbs.forEach((t, k) => { tableN = (typeof tableN === "number" ? tableN : 0) + 1; const tn = tableN, rid = "rIdT" + k; const m = /^\$?([A-Za-z]+)\$?(\d+):\$?([A-Za-z]+)\$?(\d+)$/.exec(t.range), a = C.parseAddr(m[1] + m[2]), b = C.parseAddr(m[3] + m[4]); const cols = []; for (let c = a.c; c <= b.c; c++) cols.push(t.hdr === false ? "Column" + (c - a.c + 1) : String(wb.text(sh, a.r, c).text || "Column" + (c - a.c + 1))); const tx = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><table xmlns="${M}" id="${tn}" name="${esc(t.name)}" displayName="${esc(t.name)}" ref="${t.range}"${t.hdr === false ? ' headerRowCount="0"' : ""}${t.total ? ' totalsRowCount="1"' : ""}>${t.filt !== false && t.hdr !== false ? `<autoFilter ref="${t.range}"/>` : ""}<tableColumns count="${cols.length}">${cols.map((n, i) => `<tableColumn id="${i + 1}" name="${esc(n)}"/>`).join("")}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="${t.band === false ? 0 : 1}" showColumnStripes="0"/></table>`; entries.push({ name: `xl/tables/table${tn}.xml`, data: tx }); ct.push(`<Override PartName="/xl/tables/table${tn}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`); ro.push(`<Relationship Id="${rid}" Type="${R}/table" Target="../tables/table${tn}.xml"/>`); x += `<tablePart r:id="${rid}"/>`; }); x += "</tableParts>"; }
      sheetRels[sIdx] = ro; return x + "</worksheet>";
    };
    const anchorPx = (sh, px, isCol) => { let i = 1, acc = 0; for (;;) { const w = isCol ? colPx(sh, i) : rowPx(sh, i); if (acc + w > px) return [i - 1, Math.round((px - acc) * 9525)]; acc += w; i++; if (i > 20000) return [i - 1, 0]; } };
    async function drawing(sh, sIdx, dn) {
      let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${R}" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">`, rels = "";
      sh.charts.forEach((ch, k) => {
        chartN++; const cn = chartN; const [c1, o1] = anchorPx(sh, ch.x, true), [r1, p1] = anchorPx(sh, ch.y, false), [c2, o2] = anchorPx(sh, ch.x + ch.w, true), [r2, p2] = anchorPx(sh, ch.y + ch.h, false);
        x += `<xdr:twoCellAnchor><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>${o1}</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>${p1}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>${o2}</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>${p2}</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${k + 2}" name="Chart ${k + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${k + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
        rels += `<Relationship Id="rId${k + 1}" Type="${R}/chart" Target="../charts/chart${cn}.xml"/>`; entries.push({ name: `xl/charts/chart${cn}.xml`, data: chartXml(sh, ch) }); ct.push(`<Override PartName="/xl/charts/chart${cn}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      });
      return { xml: x + "</xdr:wsDr>", rels };
    }
    function chartXml(sh, ch) {
      const data = Charts.data(wb, sh, ch); const q = (n) => "'" + sh.name.replace(/'/g, "''") + "'!" + n;
      const ref = (r1, c1, r2, c2) => q("$" + C.nCol(c1) + "$" + r1 + ":$" + C.nCol(c2) + "$" + r2);
      const pal = Charts.PALETTE;
      const strC = (arr) => `<c:strCache><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("")}</c:strCache>`, numC = (arr) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${arr.length}"/>${arr.map((v, i) => (v == null ? "" : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join("")}</c:numCache>`;
      const tp0 = ch.type, dlb = ch.labels ? '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' : "";
      const trendX = (i, col) => (ch.trend && (i === 0 || ch.trendAll) ? `<c:trendline><c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${col.slice(2)}"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr><c:trendlineType val="${{ linear: "linear", exp: "exp", poly: "poly", avg: "movingAvg" }[ch.trend] || "linear"}"/>${ch.trend === "poly" ? '<c:order val="2"/>' : ""}${ch.trend === "avg" ? '<c:period val="3"/>' : ""}<c:dispRSqr val="0"/><c:dispEq val="0"/></c:trendline>` : "");
      const mk = (s, i, type) => {
        const col = argb(s.color || pal[i % pal.length]); const tx = `<c:tx><c:strRef><c:f>${esc(s.nameRef ? q(s.nameRef) : '""')}</c:f>${strC([s.name])}</c:strRef></c:tx>`;
        const sp = type === "line" || type === "scatter" || type === "radar" ? `<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${col.slice(2)}"/></a:solidFill></a:ln></c:spPr>` : `<c:spPr><a:solidFill><a:srgbClr val="${col.slice(2)}"/></a:solidFill></c:spPr>`;
        const dpt = type === "pie" || type === "doughnut" ? data.cats.map((_, j) => `<c:dPt><c:idx val="${j}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${argb(pal[j % pal.length]).slice(2)}"/></a:solidFill></c:spPr></c:dPt>`).join("") : "";
        const xy = type === "scatter" || type === "bubble";
        const cat = xy ? `<c:xVal><c:numRef><c:f>${esc(ref(...data.catRange))}</c:f>${numC(data.cats.map(Number))}</c:numRef></c:xVal>` : `<c:cat><c:strRef><c:f>${esc(ref(...data.catRange))}</c:f>${strC(data.cats.map(String))}</c:strRef></c:cat>`;
        const val = `<c:${xy ? "yVal" : "val"}><c:numRef><c:f>${esc(ref(...s.range))}</c:f>${numC(s.values)}</c:numRef></c:${xy ? "yVal" : "val"}>`;
        const bs = type === "bubble" ? (() => { const z = data.series[1] || s; return `<c:bubbleSize><c:numRef><c:f>${esc(ref(...z.range))}</c:f>${numC(z.values)}</c:numRef></c:bubbleSize><c:bubble3D val="0"/>`; })() : "";
        const mkr = type === "line" ? (ch.marker === false ? '<c:marker><c:symbol val="none"/></c:marker>' : '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>') : type === "scatter" || type === "radar" ? '<c:marker><c:symbol val="circle"/><c:size val="6"/></c:marker>' : "";
        return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${sp}${type === "col" || type === "bar" ? '<c:invertIfNegative val="0"/>' : ""}${mkr}${dpt}${dlb}${trendX(i, col)}${cat}${val}${bs}${type === "line" || type === "scatter" ? `<c:smooth val="${ch.smooth ? 1 : 0}"/>` : ""}</c:ser>`;
      };
      const barLike = { col: "col", bar: "bar", histogram: "col", waterfall: "col", funnel: "bar", treemap: "col", box: "col" };
      const type = barLike[tp0] || tp0; const comboK = (i) => (ch.stypes || [])[i] || (i === 0 ? "col" : "line");
      const grp = ch.pct ? "percentStacked" : ch.stacked ? "stacked" : "clustered";
      const ax = '<c:axId val="111"/><c:axId val="222"/>', ax2 = '<c:axId val="333"/><c:axId val="444"/>';
      let plot, hasSec = false;
      const gap = ch.gap == null ? 80 : ch.gap;
      if (type === "col" || type === "bar") plot = `<c:barChart><c:barDir val="${type === "bar" ? "bar" : "col"}"/><c:grouping val="${grp}"/><c:varyColors val="0"/>${data.series.map((s, i) => mk(s, i, type)).join("")}<c:gapWidth val="${gap}"/>${ch.stacked || ch.pct ? '<c:overlap val="100"/>' : ""}${ax}</c:barChart>`;
      else if (type === "combo" || type === "pareto") {
        const sec = tp0 === "pareto" ? [1] : ch.sec || []; hasSec = sec.length > 0; const kd = (i) => (tp0 === "pareto" ? (i === 0 ? "col" : "line") : comboK(i));
        const cols = data.series.map((s, i) => [s, i]).filter(([, i]) => kd(i) === "col"), lines = data.series.map((s, i) => [s, i]).filter(([, i]) => kd(i) !== "col");
        plot = (cols.length ? `<c:barChart><c:barDir val="col"/><c:grouping val="${grp === "percentStacked" ? "clustered" : grp}"/><c:varyColors val="0"/>${cols.map(([s, i]) => mk(s, i, "col")).join("")}<c:gapWidth val="${gap}"/>${ch.stacked ? '<c:overlap val="100"/>' : ""}${ax}</c:barChart>` : "") + [false, true].map((sc) => { const l = lines.filter(([, i]) => (sec.indexOf(i) >= 0) === sc); return l.length ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${l.map(([s, i]) => mk(s, i, "line")).join("")}<c:marker val="1"/>${sc ? ax2 : ax}</c:lineChart>` : ""; }).join("");
      } else if (type === "line") plot = `<c:lineChart><c:grouping val="${ch.pct ? "percentStacked" : ch.stacked ? "stacked" : "standard"}"/><c:varyColors val="0"/>${data.series.map((s, i) => mk(s, i, "line")).join("")}<c:marker val="1"/>${ax}</c:lineChart>`;
      else if (type === "area") plot = `<c:areaChart><c:grouping val="${ch.pct ? "percentStacked" : ch.stacked ? "stacked" : "standard"}"/><c:varyColors val="0"/>${data.series.map((s, i) => mk(s, i, "area")).join("")}${ax}</c:areaChart>`;
      else if (type === "pie") plot = `<c:pieChart><c:varyColors val="1"/>${data.series.slice(0, 1).map((s, i) => mk(s, i, "pie")).join("")}<c:firstSliceAng val="0"/></c:pieChart>`;
      else if (type === "doughnut") plot = `<c:doughnutChart><c:varyColors val="1"/>${data.series.slice(0, 1).map((s, i) => mk(s, i, "doughnut")).join("")}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
      else if (type === "radar") plot = `<c:radarChart><c:radarStyle val="marker"/><c:varyColors val="0"/>${data.series.map((s, i) => mk(s, i, "radar")).join("")}${ax}</c:radarChart>`;
      else if (type === "bubble") plot = `<c:bubbleChart><c:varyColors val="0"/>${data.series.slice(0, 1).map((s, i) => mk(s, i, "bubble")).join("")}<c:bubbleScale val="100"/><c:showNegBubbles val="0"/>${ax}</c:bubbleChart>`;
      else plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${data.series.map((s, i) => mk(s, i, "scatter")).join("")}${ax}</c:scatterChart>`;
      const ttl = (t, rot) => (t ? `<c:title><c:tx><c:rich><a:bodyPr${rot ? ' rot="-5400000" vert="horz"' : ""}/><a:p><a:r><a:rPr lang="en-US" sz="1000"/><a:t>${esc(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` : "");
      const scal = (mn, mx, lg) => `<c:scaling>${lg ? '<c:logBase val="10"/>' : ""}<c:orientation val="minMax"/>${mx != null && isFinite(mx) ? `<c:max val="${mx}"/>` : ""}${mn != null && isFinite(mn) ? `<c:min val="${mn}"/>` : ""}</c:scaling>`;
      const catAx = (id, cr, pos, del, t) => `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${del ? 1 : 0}"/><c:axPos val="${pos}"/>${ttl(t, pos === "l")}<c:numFmt formatCode="General" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cr}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
      const valAx = (id, cr, pos, o) => `<c:valAx><c:axId val="${id}"/>${scal(o.min, o.max, o.log)}<c:delete val="0"/><c:axPos val="${pos}"/>${o.grid === false ? "" : '<c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>'}${ttl(o.title, pos === "l" || pos === "r")}<c:numFmt formatCode="${o.pct ? "0%" : "General"}" sourceLinked="${o.pct ? 0 : 1}"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cr}"/><c:crosses val="${o.right ? "max" : "autoZero"}"/><c:crossBetween val="${o.mid ? "midCat" : "between"}"/></c:valAx>`;
      const horiz = type === "bar", xy = type === "scatter" || type === "bubble";
      const axes = /pie|doughnut/.test(type) ? "" : xy ? valAx(111, 222, "b", { title: ch.xTitle, grid: false, mid: true }) + valAx(222, 111, "l", { title: ch.yTitle, min: ch.ymin, max: ch.ymax, log: ch.log, grid: ch.grid, mid: true }) : catAx(111, 222, horiz ? "l" : "b", false, ch.xTitle) + valAx(222, 111, horiz ? "b" : "l", { title: ch.yTitle, min: ch.ymin, max: ch.ymax, log: ch.log, grid: ch.grid, pct: ch.pct }) + (hasSec ? catAx(333, 444, "b", true) + valAx(444, 333, "r", { right: true, min: ch.y2min, max: ch.y2max, grid: false }) : "");
      const title = ch.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="1400" b="1"/><a:t>${esc(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${R}"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${ch.legend === "none" ? "" : `<c:legend><c:legendPos val="${{ right: "r", top: "t", left: "l" }[ch.legend] || "b"}"/><c:overlay val="0"/></c:legend>`}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
    }
    const sheetsXml = []; for (let i = 0; i < wb.sheets.length; i++) sheetsXml.push(await sheetXml(wb.sheets[i], i));
    // styles
    const fontXml = fonts.map((f) => { const o = f.o; return `<font>${o.b ? "<b/>" : ""}${o.i ? "<i/>" : ""}${o.st ? "<strike/>" : ""}${o.u ? `<u${o.u === 2 ? ' val="double"' : ""}/>` : ""}<sz val="${o.fs || 11}"/>${o.fc && argb(o.fc) ? `<color rgb="${argb(o.fc)}"/>` : ""}<name val="${esc(o.ff || "Calibri")}"/><family val="2"/></font>`; }).join("");
    const fillXml = fills.map((f) => (f.o.none ? '<fill><patternFill patternType="none"/></fill>' : f.o.gray ? '<fill><patternFill patternType="gray125"/></fill>' : `<fill><patternFill patternType="solid"><fgColor rgb="${argb(f.o.c) || "FFFFFFFF"}"/><bgColor indexed="64"/></patternFill></fill>`)).join("");
    const bside = (n, o) => (o && o[n] ? `<${n === "t" ? "top" : n === "b" ? "bottom" : n === "l" ? "left" : "right"} style="${BSTYLE[o[n][0]] || "thin"}"><color ${argb(o[n][1]) ? `rgb="${argb(o[n][1])}"` : 'auto="1"'}/></${n === "t" ? "top" : n === "b" ? "bottom" : n === "l" ? "left" : "right"}>` : `<${n === "t" ? "top" : n === "b" ? "bottom" : n === "l" ? "left" : "right"}/>`);
    const borderXml = borders.map((b) => `<border>${bside("l", b.o)}${bside("r", b.o)}${bside("t", b.o)}${bside("b", b.o)}<diagonal/></border>`).join("");
    const xfXml = xfs.map((x) => `<xf numFmtId="${x.n}" fontId="${x.font}" fillId="${x.fill}" borderId="${x.bd}" xfId="0"${x.n ? ' applyNumberFormat="1"' : ""}${x.font ? ' applyFont="1"' : ""}${x.fill ? ' applyFill="1"' : ""}${x.bd ? ' applyBorder="1"' : ""}${x.a ? ' applyAlignment="1">' : ">"}${x.a ? `<alignment${x.a.ha ? ` horizontal="${x.a.ha === "middle" ? "center" : x.a.ha}"` : ""}${x.a.va ? ` vertical="${x.a.va === "middle" ? "center" : x.a.va}"` : ""}${x.a.wr ? ' wrapText="1"' : ""}${x.a.ind ? ` indent="${x.a.ind}"` : ""}/>` : ""}</xf>`).join("");
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${M}">${numfmts.length ? `<numFmts count="${numfmts.length}">${numfmts.map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(c)}"/>`).join("")}</numFmts>` : ""}<fonts count="${fonts.length}">${fontXml}</fonts><fills count="${fills.length}">${fillXml}</fills><borders count="${borders.length}">${borderXml}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfXml}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${dxfs.length}">${dxfs.join("")}</dxfs></styleSheet>`;
    const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="${M}" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join("")}</sst>`;
    const nm = Object.keys(wb.names || {});
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${M}" xmlns:r="${R}"><bookViews><workbookView activeTab="${wb.active || 0}"/></bookViews><sheets>${wb.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ""} r:id="rId${i + 1}"/>`).join("")}</sheets>${nm.length ? `<definedNames>${nm.map((n) => `<definedName name="${esc(n)}">${esc(String(wb.names[n]).replace(/^=/, ""))}</definedName>`).join("")}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    const out = [
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${wb.sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${ct.join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${R}/extended-properties" Target="docProps/app.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: wbXml },
      { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wb.sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${wb.sheets.length + 1}" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId${wb.sheets.length + 2}" Type="${R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: stylesXml }, { name: "xl/sharedStrings.xml", data: sstXml },
      { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title || "")}</dc:title><dc:creator>${esc(meta.author || "KMR Office Suite")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>` },
      { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>KMR Office Suite</Application></Properties>` }
    ];
    sheetsXml.forEach((x, i) => { out.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x }); if (sheetRels[i] && sheetRels[i].length) out.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels[i].join("")}</Relationships>` }); });
    return Z.build(out.concat(entries));
  }

  /* ================= READ ================= */
  async function read(buf) {
    const zip = await Z.read(buf); const wbx = await zip.text("xl/workbook.xml"); if (!wbx) throw new Error("This is not a spreadsheet file (xl/workbook.xml is missing).");
    const K = Z.kids, kid = Z.kid, at = Z.at, wbd = Z.parse(wbx).documentElement;
    const relx = await zip.text("xl/_rels/workbook.xml.rels"), rel = {}; if (relx) Z.deep(Z.parse(relx).documentElement, "Relationship").forEach((r) => (rel[r.getAttribute("Id")] = r.getAttribute("Target")));
    const path = (t) => (/^\//.test(t) ? t.slice(1) : "xl/" + t.replace(/^\.\//, ""));
    // shared strings
    const ssx = await zip.text("xl/sharedStrings.xml"), sst = []; if (ssx) K(Z.parse(ssx).documentElement, "si").forEach((si) => sst.push(Z.deep(si, "t").filter((t) => !t.parentNode || t.parentNode.localName !== "rPh").map((t) => t.textContent).join("")));
    // styles
    const sx = await zip.text("xl/styles.xml"), xfs = [], wb = new C.Workbook({ sheets: [] }); wb.sheets = [];
    if (sx) {
      const sd = Z.parse(sx).documentElement, nf = {}; Z.deep(kid(sd, "numFmts"), "numFmt").forEach((n) => (nf[n.getAttribute("numFmtId")] = n.getAttribute("formatCode")));
      const color = (el) => { if (!el) return null; const rgb = at(el, "rgb"), th = at(el, "theme"), ix = at(el, "indexed"), ti = at(el, "tint"); if (rgb) return fromArgb(rgb); if (th != null) { let h = THEME[+th] || "000000"; if (ti) h = tint(h, +ti); return "#" + h.toLowerCase(); } if (ix != null) { const h = INDEXED[+ix]; return h ? "#" + h.toLowerCase() : null; } return null; };
      const fonts = K(kid(sd, "fonts"), "font").map((f) => { const o = {}; if (kid(f, "b") && at(kid(f, "b"), "val") !== "0") o.b = 1; if (kid(f, "i") && at(kid(f, "i"), "val") !== "0") o.i = 1; if (kid(f, "strike")) o.st = 1; const u = kid(f, "u"); if (u && at(u, "val") !== "none") o.u = at(u, "val") === "double" ? 2 : 1; const sz = kid(f, "sz"); if (sz && +at(sz, "val") !== 11) o.fs = +at(sz, "val"); const nm = kid(f, "name"); if (nm && at(nm, "val") !== "Calibri") o.ff = at(nm, "val"); const c = color(kid(f, "color")); if (c && c !== "#000000") o.fc = c; return o; });
      const fills = K(kid(sd, "fills"), "fill").map((f) => { const p = kid(f, "patternFill"); if (!p || at(p, "patternType") !== "solid") return null; return color(kid(p, "fgColor")); });
      const borders = K(kid(sd, "borders"), "border").map((b) => { const o = {}; ["left", "right", "top", "bottom"].forEach((n, i) => { const e = kid(b, n); if (e && at(e, "style")) o["lrtb"[["left", "right", "top", "bottom"].indexOf(n)]] = [at(e, "style") === "mediumDashed" ? "dashed" : at(e, "style") === "dashDot" || at(e, "style") === "dashDotDot" ? "dashed" : at(e, "style"), color(kid(e, "color")) || "#000000"]; }); return Object.keys(o).length ? o : null; });
      K(kid(sd, "cellXfs"), "xf").forEach((x) => {
        const s = Object.assign({}, fonts[+at(x, "fontId") || 0]); const fl = fills[+at(x, "fillId") || 0]; if (fl) s.bg = fl; const bd = borders[+at(x, "borderId") || 0]; if (bd) s.bd = bd;
        const id = at(x, "numFmtId"); let code = nf[id] || C.Fmt.BUILT[id] || null; if (id === "14") code = "dd-mm-yyyy"; if (+id >= 27 && +id <= 36) code = "dd-mm-yyyy"; if (+id >= 50 && +id <= 58) code = "mmm-yy"; if (+id === 12 || +id === 13) code = "# ?/?"; if (code && code !== "General") s.nf = code;
        const al = kid(x, "alignment"); if (al) { const h = at(al, "horizontal"), v = at(al, "vertical"); if (h && h !== "general") s.ha = h === "centerContinuous" ? "center" : h; if (v) s.va = v === "center" ? "middle" : v; if (at(al, "wrapText") === "1") s.wr = 1; if (+at(al, "indent")) s.ind = +at(al, "indent"); }
        xfs.push(wb.styleId(s));
      });
    }
    const dxfOf = {}; // dxf index -> style
    if (sx) { const sd = Z.parse(sx).documentElement; K(kid(sd, "dxfs"), "dxf").forEach((d, i) => { const o = {}; const f = kid(d, "font"); if (f) { if (kid(f, "b")) o.b = 1; if (kid(f, "i")) o.i = 1; const c = kid(f, "color"); if (c) o.fc = fromArgb(at(c, "rgb")) || (at(c, "theme") != null ? "#" + tint(THEME[+at(c, "theme")] || "000000", +(at(c, "tint") || 0)) : null); } const fl = kid(d, "fill"); if (fl) { const p = kid(fl, "patternFill"); const b = p && (kid(p, "bgColor") || kid(p, "fgColor")); if (b) o.bg = fromArgb(at(b, "rgb")) || (at(b, "theme") != null ? "#" + tint(THEME[+at(b, "theme")] || "FFFFFF", +(at(b, "tint") || 0)) : null); } dxfOf[i] = o; }); }
    const sheets = K(kid(wbd, "sheets"), "sheet"); let first = 0;
    for (let si = 0; si < sheets.length; si++) {
      const sEl = sheets[si], rid = sEl.getAttributeNS(R, "id") || sEl.getAttribute("r:id"), p = rel[rid]; if (!p) continue; const sxml = await zip.text(path(p)); if (!sxml) continue;
      const name = at(sEl, "name") || "Sheet" + (si + 1), sh = new C.Sheet(name); sh.hidden = at(sEl, "state") === "hidden" || at(sEl, "state") === "veryHidden"; wb.sheets.push(sh);
      const root = Z.parse(sxml).documentElement, sd = kid(root, "sheetData"), shared = {};
      const sv = kid(kid(root, "sheetViews"), "sheetView"); if (sv) { if (at(sv, "showGridLines") === "0") sh.grid = false; const pn = kid(sv, "pane"); if (pn && at(pn, "state") && /frozen/.test(at(pn, "state"))) sh.freeze = { r: +at(pn, "ySplit") || 0, c: +at(pn, "xSplit") || 0 }; }
      const fp = kid(root, "sheetFormatPr"); let dcw = fp && at(fp, "defaultColWidth") ? +at(fp, "defaultColWidth") : null, drh = fp && at(fp, "defaultRowHeight") ? +at(fp, "defaultRowHeight") : null;
      Z.deep(kid(root, "cols"), "col").forEach((c) => { const w = +at(c, "width"), mn = +at(c, "min"), mx = Math.min(+at(c, "max"), mn + 300); const px = Math.round(w * 7 + 5); for (let i = mn; i <= mx; i++) { if (Math.abs(px - DEFCOL) > 1 && at(c, "customWidth") !== "0") sh.cols[i] = px; if (at(c, "hidden") === "1") sh.hiddenCols[i] = 1; if (+at(c, "outlineLevel") > 0) (sh._ol = sh._ol || { r: {}, c: {} }).c[i] = +at(c, "outlineLevel"); } });
      if (dcw && Math.abs(dcw * 7 + 5 - DEFCOL) > 1 && !Z.deep(kid(root, "cols"), "col").length) { /* sheet default width differs: apply to used columns later */ }
      K(sd, "row").forEach((row) => {
        const r = +at(row, "r"); if (at(row, "ht") && at(row, "customHeight") !== "0") { const h = Math.round(+at(row, "ht") / 0.75); if (Math.abs(h - DEFROW) > 1) sh.rows[r] = h; } if (at(row, "hidden") === "1") sh.hiddenRows[r] = 1; if (+at(row, "outlineLevel") > 0) (sh._ol = sh._ol || { r: {}, c: {} }).r[r] = +at(row, "outlineLevel");
        K(row, "c").forEach((c) => {
          const a = at(c, "r"), pa = C.parseAddr(a); if (!pa) return; const t = at(c, "t"), s = +at(c, "s") || 0, fEl = kid(c, "f"), vEl = kid(c, "v"); const cell = {}; const st = xfs[s]; if (st) cell.s = st;
          let val = null; if (t === "s" && vEl) val = sst[+vEl.textContent] ?? ""; else if (t === "str" && vEl) val = vEl.textContent; else if (t === "b" && vEl) val = vEl.textContent === "1"; else if (t === "e" && vEl) val = Object.values(C.ERR).find((e) => e.code === vEl.textContent) || C.ERR.VALUE; else if (t === "inlineStr") val = Z.deep(kid(c, "is"), "t").map((x) => x.textContent).join(""); else if (vEl && vEl.textContent !== "") val = parseFloat(vEl.textContent);
          if (fEl) {
            let f = fEl.textContent; const ty = at(fEl, "t"), sid = at(fEl, "si");
            if (ty === "shared") { if (f) shared[sid] = { f, r: pa.r, c: pa.c }; else if (shared[sid]) f = C.shift("=" + shared[sid].f, pa.r - shared[sid].r, pa.c - shared[sid].c).slice(1); }
            if (f) { cell.f = "=" + f; cell.cv = C.isE(val) ? val : val; }
          } else if (val != null) cell.v = C.isE(val) ? val.code : val;
          if (cell.v != null || cell.f || cell.s) sh.m.set(C.key(pa.r, pa.c), cell);
        });
      });
      if (dcw) { const px = Math.round(dcw * 7 + 5); if (Math.abs(px - DEFCOL) > 1) { const [, mc] = sh.dims(); for (let i = 1; i <= Math.max(mc, 26); i++) if (sh.cols[i] == null) sh.cols[i] = px; } }
      Z.deep(kid(root, "mergeCells"), "mergeCell").forEach((m) => sh.merges.push(at(m, "ref")));
      const af = kid(root, "autoFilter"); if (af) sh.filter = { range: at(af, "ref"), cols: {} };
      Z.kids(root, "conditionalFormatting").forEach((cf) => {
        const range = at(cf, "sqref").split(" ")[0]; K(cf, "cfRule").forEach((r) => {
          const ty = at(r, "type"), dx = dxfOf[+at(r, "dxfId")] || {}, base = { range, fc: dx.fc, bg: dx.bg, b: dx.b ? 1 : undefined, i: dx.i ? 1 : undefined }, fs = K(r, "formula").map((x) => x.textContent);
          if (ty === "cellIs") { const m = { greaterThan: "gt", lessThan: "lt", greaterThanOrEqual: "ge", lessThanOrEqual: "le", equal: "eq", notEqual: "ne", between: "between" }[at(r, "operator")]; if (m) sh.cf.push(Object.assign(base, { type: m, v1: fs[0], v2: fs[1] })); }
          else if (ty === "containsText") sh.cf.push(Object.assign(base, { type: "text", text: at(r, "text") || "" })); else if (ty === "duplicateValues") sh.cf.push(Object.assign(base, { type: "dup" })); else if (ty === "top10") sh.cf.push(Object.assign(base, { type: at(r, "bottom") === "1" ? "bottom" : "top", n: +at(r, "rank") || 10 }));
          else if (ty === "colorScale") { const cs = Z.deep(r, "color").map((c) => fromArgb(at(c, "rgb")) || "#999999"); sh.cf.push({ range, type: "scale", colors: cs }); } else if (ty === "dataBar") { const c = Z.deep(r, "color")[0]; sh.cf.push({ range, type: "bar", bg: (c && fromArgb(at(c, "rgb"))) || "#638ec6" }); }
        });
      });
      Z.deep(kid(root, "dataValidations"), "dataValidation").forEach((d) => { const ty = at(d, "type"); if (!["list", "whole", "decimal"].includes(ty)) return; const f1 = (kid(d, "formula1") || {}).textContent || "", f2 = (kid(d, "formula2") || {}).textContent; sh.dv.push({ range: at(d, "sqref").split(" ")[0], type: ty, op: at(d, "operator") || "between", list: ty === "list" ? (/^".*"$/.test(f1) ? f1.slice(1, -1) : "=" + f1) : undefined, v1: ty !== "list" ? f1 : undefined, v2: f2, msg: at(d, "error") || "" }); });
      // charts
      if (sh._ol) { const grp = { rows: [], cols: [] }; ["r", "c"].forEach((ax) => { const m = sh._ol[ax], ks = Object.keys(m).map(Number).sort((a, b) => a - b), mx = Math.max(0, ...ks); for (let L = 1; L <= mx; L++) { let a = null, prev = null; ks.concat([1e9]).forEach((k) => { const ok = k < 1e9 && m[k] >= L; if (ok && a != null && k === prev + 1) { prev = k; return; } if (a != null) grp[ax === "r" ? "rows" : "cols"].push({ a, b: prev, c: !!(ax === "r" ? sh.hiddenRows : sh.hiddenCols)[prev] }); a = ok ? k : null; prev = ok ? k : null; }); } }); sh.ext = Object.assign({}, sh.ext, { grp }); delete sh._ol; }
      if (kid(root, "sheetProtection") && at(kid(root, "sheetProtection"), "sheet") !== "0") sh.ext = Object.assign({}, sh.ext, { protect: { pw: null } });
      try { const tp = kid(root, "tableParts"); if (tp) { const rx2 = await zip.text(path(p).replace(/([^/]+)$/, "_rels/$1.rels")); const rm = {}; if (rx2) Z.deep(Z.parse(rx2).documentElement, "Relationship").forEach((r) => (rm[r.getAttribute("Id")] = r.getAttribute("Target"))); const list = []; for (const tpart of Z.deep(tp, "tablePart")) { const tgt = rm[tpart.getAttributeNS(R, "id") || tpart.getAttribute("r:id")]; if (!tgt) continue; const tx = await zip.text(tgt.startsWith("/") ? tgt.slice(1) : (path(p).replace(/[^/]+$/, "") + tgt).split("/").reduce((a, q) => (q === ".." ? (a.pop(), a) : (a.push(q), a)), []).join("/")); if (!tx) continue; const te = Z.parse(tx).documentElement; const tz = Z.deep(te, "tableStyleInfo")[0]; list.push({ id: "t" + Math.random().toString(36).slice(2, 7), name: at(te, "displayName") || at(te, "name") || "Table" + (list.length + 1), range: String(at(te, "ref")).replace(/\$/g, ""), style: "blue", hdr: at(te, "headerRowCount") !== "0", total: +at(te, "totalsRowCount") > 0, band: !tz || at(tz, "showRowStripes") !== "0", filt: true }); } if (list.length) sh.ext = Object.assign({}, sh.ext, { tables: list }); } } catch (e) { /* tables are optional */ }
      const dr = kid(root, "drawing"); if (dr) { try { await readCharts(zip, sh, path(p), dr, wb); } catch (e) { /* charts are optional */ } }
    }
    if (!wb.sheets.length) wb.sheets.push(new C.Sheet("Sheet1"));
    Z.deep(kid(wbd, "definedNames"), "definedName").forEach((n) => { if (!/^_xlnm/.test(at(n, "name"))) wb.names[at(n, "name").toLowerCase()] = "=" + n.textContent; });
    const ab = kid(kid(wbd, "bookViews"), "workbookView"); wb.active = ab && at(ab, "activeTab") ? Math.min(+at(ab, "activeTab"), wb.sheets.length - 1) : 0;
    return wb;
  }
  async function readCharts(zip, sh, sheetPath, drEl, wb) {
    const rid = drEl.getAttributeNS(R, "id") || drEl.getAttribute("r:id"); const relPath = sheetPath.replace(/([^/]+)$/, "_rels/$1.rels"); const rx = await zip.text(relPath); if (!rx) return;
    const rels = {}; Z.deep(Z.parse(rx).documentElement, "Relationship").forEach((r) => (rels[r.getAttribute("Id")] = r.getAttribute("Target"))); const dp = (rels[rid] || "").replace(/^\.\.\//, "xl/"); const dx = await zip.text(dp); if (!dx) return;
    const drel = {}; const drx = await zip.text(dp.replace(/([^/]+)$/, "_rels/$1.rels")); if (drx) Z.deep(Z.parse(drx).documentElement, "Relationship").forEach((r) => (drel[r.getAttribute("Id")] = r.getAttribute("Target")));
    const colX = (c, off) => { let x = 0; for (let i = 1; i <= c; i++) x += sh.cols[i] != null ? sh.cols[i] : DEFCOL; return x + off / 9525; }, rowY = (r, off) => { let y = 0; for (let i = 1; i <= r; i++) y += sh.rows[i] != null ? sh.rows[i] : DEFROW; return y + off / 9525; };
    for (const anc of Z.deep(Z.parse(dx).documentElement, "twoCellAnchor")) {
      const cEl = Z.deep(anc, "chart")[0]; if (!cEl) continue; const cid = cEl.getAttributeNS(R, "id") || cEl.getAttribute("r:id"); const cp = (drel[cid] || "").replace(/^\.\.\//, "xl/"); const cx = await zip.text(cp); if (!cx) continue;
      const f = Z.kid(anc, "from"), t = Z.kid(anc, "to"), g = (e, n) => +(Z.kid(e, n) || { textContent: 0 }).textContent;
      const x = colX(g(f, "col"), g(f, "colOff")), y = rowY(g(f, "row"), g(f, "rowOff")), x2 = colX(g(t, "col"), g(t, "colOff")), y2 = rowY(g(t, "row"), g(t, "rowOff"));
      const cd = Z.parse(cx).documentElement; const types = { barChart: "col", bar3DChart: "col", lineChart: "line", line3DChart: "line", pieChart: "pie", pie3DChart: "pie", doughnutChart: "doughnut", areaChart: "area", scatterChart: "scatter" }; let type = null, plot = null;
      Z.deep(cd, "plotArea").forEach((pa) => { Z.kids(pa, "").length; for (const c of pa.children) if (types[c.localName]) { type = types[c.localName]; plot = c; break; } }); if (!type) continue;
      if (type === "col") { const bd = Z.kid(plot, "barDir"); if (bd && Z.at(bd, "val") === "bar") type = "bar"; }
      const sers = Z.kids(plot, "ser").map((s) => { const v = Z.deep(Z.kid(s, "val") || Z.kid(s, "yVal"), "f")[0], cat = Z.deep(Z.kid(s, "cat") || Z.kid(s, "xVal"), "f")[0], tx = Z.deep(Z.kid(s, "tx"), "f")[0]; return { v: v && v.textContent, c: cat && cat.textContent, t: tx && tx.textContent }; }); if (!sers.length || !sers[0].v) continue;
      const pr = (r) => { const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(r || ""); return m ? { sheet: (m[1] || m[2]).replace(/''/g, "'"), c1: C.colN(m[3]), r1: +m[4], c2: C.colN(m[5] || m[3]), r2: +(m[6] || m[4]) } : null; };
      const v0 = pr(sers[0].v); if (!v0) continue; const vs = sers.map((s) => pr(s.v)).filter(Boolean); const cat = pr(sers[0].c);
      const minR = Math.min(...vs.map((v) => v.r1)), maxR = Math.max(...vs.map((v) => v.r2)), minC = Math.min(...vs.map((v) => v.c1)), maxC = Math.max(...vs.map((v) => v.c2));
      const byRow = vs.length > 0 && v0.r1 === v0.r2 && v0.c2 > v0.c1; const ttl = Z.deep(Z.kid(cd, "chart"), "t").filter((n) => n.parentNode && n.parentNode.localName === "r").map((n) => n.textContent).join("");
      const col = cat ? (byRow ? { r1: Math.min(minR, cat.r1), c1: Math.min(cat.c1, minC - 1), r2: maxR, c2: maxC } : { r1: Math.min(cat.r1 - 1, minR - 1), c1: Math.min(cat.c1, minC), r2: maxR, c2: maxC }) : null;
      const rng = byRow ? C.addr(Math.min(minR, cat ? cat.r1 : minR), (cat ? Math.min(cat.c1, minC) : minC)) + ":" + C.addr(maxR, maxC) : C.addr(Math.max(1, (cat ? cat.r1 : minR) - 1), cat ? Math.min(cat.c1, minC) : minC) + ":" + C.addr(maxR, maxC);
      sh.charts.push({ id: "ch" + Math.random().toString(36).slice(2, 8), type, title: ttl, range: rng, byRow, header: true, stacked: !!(Z.kid(plot, "grouping") && /stacked/i.test(Z.at(Z.kid(plot, "grouping"), "val"))), legend: Z.deep(cd, "legendPos").length ? (Z.at(Z.deep(cd, "legendPos")[0], "val") === "r" ? "right" : "bottom") : "none", x: Math.round(x), y: Math.round(y), w: Math.max(200, Math.round(x2 - x)), h: Math.max(150, Math.round(y2 - y)) });
    }
  }
  /* chart data builder shared with the screen */
  const Charts = {
    PALETTE: ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478", "#9e480e", "#636363", "#997300"],
    /* returns { cats:[...], series:[{name, values, color, range:[r1,c1,r2,c2], nameRef}], catRange:[r1,c1,r2,c2] } */
    data(wb, sh, ch) {
      const rg = ch.range.split(":"), a = C.parseAddr(rg[0]), b = C.parseAddr(rg[1] || rg[0]); if (!a || !b) return { cats: [], series: [], catRange: [1, 1, 1, 1] };
      const r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r), c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c), V = (r, c) => wb.value(sh, r, c), T = (r, c) => { const v = V(r, c); return C.isE(v) ? v.code : v == null ? "" : wb.text(sh, r, c).text; };
      const hdr = ch.header !== false;
      if (!ch.byRow) {
        const labC = c1, firstSer = c1 + 1, cats = [], dr1 = hdr ? r1 + 1 : r1; for (let r = dr1; r <= r2; r++) cats.push(T(r, labC));
        const series = []; for (let c = firstSer; c <= c2; c++) { const vals = []; for (let r = dr1; r <= r2; r++) { const v = V(r, c); vals.push(typeof v === "number" ? v : v === null || v === "" ? null : C.isE(v) ? null : isNaN(parseFloat(v)) ? null : parseFloat(v)); } series.push({ name: hdr ? T(r1, c) : "Series " + (c - firstSer + 1), values: vals, range: [dr1, c, r2, c], nameRef: hdr ? "$" + C.nCol(c) + "$" + r1 : null, color: (ch.colors || [])[c - firstSer] }); }
        return { cats, series, catRange: [dr1, labC, r2, labC] };
      }
      const cats = [], dc1 = hdr ? c1 + 1 : c1; for (let c = dc1; c <= c2; c++) cats.push(T(r1, c));
      const series = []; for (let r = r1 + 1; r <= r2; r++) { const vals = []; for (let c = dc1; c <= c2; c++) { const v = V(r, c); vals.push(typeof v === "number" ? v : null); } series.push({ name: T(r, c1), values: vals, range: [r, dc1, r, c2], nameRef: "$" + C.nCol(c1) + "$" + r, color: (ch.colors || [])[r - r1 - 1] }); }
      return { cats, series, catRange: [r1, dc1, r1, c2] };
    }
  };
  /* ================= CSV ================= */
  function parseCsv(text, forced) {
    text = text.replace(/^﻿/, ""); const first = text.split(/\r?\n/, 1)[0]; const delims = [",", ";", "\t", "|"]; let d = ","; let best = -1; delims.forEach((x) => { const n = first.split(x).length; if (n > best) { best = n; d = x; } }); if (forced) d = forced;
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && cur === "") q = true; else if (ch === d) { row.push(cur); cur = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; rows.push(row); row = []; } else cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); } return rows;
  }
  function fromCsv(text, name) {
    const rows = parseCsv(text), wb = new C.Workbook({ sheets: [{ name: (name || "Sheet1").slice(0, 31) }] }), sh = wb.sheets[0];
    rows.forEach((row, i) => row.forEach((t, j) => { if (t === "") return; const p = C.parseInput(t); const cell = {}; if (p.f) cell.v = t; else cell.v = p.v; if (p.nf) cell.s = wb.styleId({ nf: p.nf }); if (cell.v != null) sh.set(i + 1, j + 1, cell); }));
    return wb;
  }
  function toCsv(wb, sh, delim) {
    delim = delim || ","; const [mr, mc] = sh.dims(); const q = (s) => (/["\r\n]/.test(s) || s.indexOf(delim) >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s); const out = [];
    for (let r = 1; r <= mr; r++) { const row = []; for (let c = 1; c <= mc; c++) row.push(q(wb.text(sh, r, c).text)); out.push(row.join(delim)); }
    return "﻿" + out.join("\r\n");
  }
  window.OffXlsx = { write, read, fromCsv, toCsv, parseCsv, Charts, DEFCOL, DEFROW };
})();
