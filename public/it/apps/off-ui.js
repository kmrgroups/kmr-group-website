/* KMR Office Suite - shared interface parts: icons (our own set), ribbon with tabs and groups, drop-down menus, colour palette, inline helpers. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* ---------- icons: 24x24, drawn with lines so they stay sharp and are our own ---------- */
  const L = (d) => `<path d="${d}"/>`;
  const IC = {
    undo: L("M9 7H15a5 5 0 010 10H8M9 7l-3 3M9 7l-3-3"), redo: L("M15 7H9a5 5 0 000 10h7M15 7l3 3M15 7l3-3"),
    cut: '<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>' + L("M8.5 15L17 4M15.5 15L7 4"), copy: '<rect x="8" y="8" width="11" height="12" rx="2"/>' + L("M5 15V6a2 2 0 012-2h8"),
    paste: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/>', brush: L("M5 19c2 0 3-1 3-3l7-7-3-3-7 7c0 2-1 3-3 3 0 0 2 3 3 3zM14 6l3-3 4 4-3 3"),
    alignL: L("M4 6h16M4 10h10M4 14h16M4 18h10"), alignC: L("M4 6h16M7 10h10M4 14h16M7 18h10"), alignR: L("M4 6h16M10 10h10M4 14h16M10 18h10"), alignJ: L("M4 6h16M4 10h16M4 14h16M4 18h16"),
    alignT: L("M4 4h16M12 20V8M8 12l4-4 4 4"), alignM: L("M4 12h16M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"), alignB: L("M4 20h16M12 4v12M8 12l4 4 4-4"),
    ulist: '<circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/>' + L("M9 7h11M9 12h11M9 17h11"), olist: L("M10 7h10M10 12h10M10 17h10M4.5 5.5l1.5-1v4M4 13.5h2.5l-2.5 3H7"),
    indent: L("M4 6h16M11 10h9M11 14h9M4 18h16M4 9l3 3-3 3"), outdent: L("M4 6h16M11 10h9M11 14h9M4 18h16M7 9l-3 3 3 3"),
    link: L("M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"), image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.7"/>' + L("M4 18l5-5 4 4 3-3 4 4"),
    table: '<rect x="3" y="5" width="18" height="14" rx="1.5"/>' + L("M3 10h18M3 14.5h18M9 5v14M15 5v14"), hr: L("M3 12h18M7 7l2 0M15 7h2M7 17h2M15 17h2"), pagebreak: L("M4 12h3M10 12h4M17 12h3M7 5v4h10V5M7 19v-4h10v4"),
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/>' + L("M4 10h16M9 3v4M15 3v4"), symbol: L("M7 19h3v-2a5 5 0 117 0v2h3"), print: '<rect x="7" y="3" width="10" height="5"/><rect x="4" y="8" width="16" height="9" rx="2"/><rect x="7" y="14" width="10" height="7"/>',
    download: L("M12 4v11M7 11l5 5 5-5M5 20h14"), upload: L("M12 16V5M7 9l5-5 5 5M5 20h14"), folder: L("M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"),
    save: L("M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"), find: '<circle cx="11" cy="11" r="6"/>' + L("M16 16l5 5"), replace: L("M4 8h12M12 4l4 4-4 4M20 16H8M12 12l-4 4 4 4"),
    zoomin: '<circle cx="11" cy="11" r="6"/>' + L("M16 16l5 5M11 8v6M8 11h6"), zoomout: '<circle cx="11" cy="11" r="6"/>' + L("M16 16l5 5M8 11h6"),
    clear: L("M7 4h12M13 4l-4 14M5 20h8M16 14l5 5M21 14l-5 5"), tcolor: L("M7 17L12 5l5 12M9 13h6") + '<rect x="5" y="19" width="14" height="2.5" fill="currentColor" stroke="none" class="sw"/>',
    hilite: L("M14 4l6 6-9 9H5v-6zM4 21h6") + '<rect x="3" y="21" width="18" height="2" fill="currentColor" stroke="none" class="sw"/>', fill: L("M5 12l7-7 7 7-7 7zM19 14c1 1.5 2 2.5 2 3.5a2 2 0 01-4 0c0-1 1-2 2-3.5z") + '<rect x="3" y="21" width="18" height="2" fill="currentColor" stroke="none" class="sw"/>',
    border: '<rect x="4" y="4" width="16" height="16"/>' + L("M12 4v16M4 12h16"), borderO: '<rect x="4" y="4" width="16" height="16"/>', borderN: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="2 3"/>', borderB: L("M4 20h16") + '<rect x="4" y="4" width="16" height="16" stroke-dasharray="1 3" opacity=".5"/>',
    merge: L("M3 5v14M21 5v14M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"), wrap: L("M4 6h16M4 12h12a3 3 0 010 6h-4M12 16l-2 2 2 2M4 18h4"), sum: L("M18 5H6l6 7-6 7h12"),
    sortA: L("M5 6h4M5 11h7M5 16h10M18 5v14M15 16l3 3 3-3"), sortZ: L("M5 6h10M5 11h7M5 16h4M18 5v14M15 8l3-3 3 3"), filter: L("M4 5h16l-6 8v6l-4-2v-4z"),
    chart: L("M4 20V4M4 20h16") + '<rect x="7" y="12" width="3" height="6" fill="currentColor" stroke="none"/><rect x="12" y="8" width="3" height="10" fill="currentColor" stroke="none"/><rect x="17" y="14" width="3" height="4" fill="currentColor" stroke="none"/>',
    cBar: L("M4 20h16") + '<rect x="6" y="11" width="3.5" height="9" fill="currentColor" stroke="none"/><rect x="11" y="6" width="3.5" height="14" fill="currentColor" stroke="none"/><rect x="16" y="13" width="3.5" height="7" fill="currentColor" stroke="none"/>',
    cHBar: L("M4 4v16") + '<rect x="4" y="6" width="9" height="3.5" fill="currentColor" stroke="none"/><rect x="4" y="11" width="14" height="3.5" fill="currentColor" stroke="none"/><rect x="4" y="16" width="7" height="3.5" fill="currentColor" stroke="none"/>',
    cLine: L("M4 20V4M4 20h16M6 15l4-4 3 3 6-8"), cPie: L("M12 3v9h9") + '<circle cx="12" cy="12" r="9"/>', cArea: L("M4 20V4M4 20h16M6 16l4-5 4 3 5-6v12z"), cScat: '<circle cx="8" cy="15" r="1.5"/><circle cx="12" cy="9" r="1.5"/><circle cx="16" cy="13" r="1.5"/><circle cx="18" cy="6" r="1.5"/>' + L("M4 4v16h16"),
    plus: L("M12 5v14M5 12h14"), minus: L("M5 12h14"), trash: L("M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"), dup: '<rect x="8" y="8" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/>',
    rowAdd: L("M3 8h18M3 14h18M12 17v5M9.5 19.5h5"), rowDel: L("M3 6h18M3 12h18M9 18l6 4M15 18l-6 4"), colAdd: L("M8 3v18M14 3v18M17 9.5h5M19.5 7v5"), colDel: L("M6 3v18M12 3v18M18 9l4 6M22 9l-4 6"),
    freeze: L("M4 4h16v16H4zM4 10h16M10 4v16"), rect: '<rect x="4" y="6" width="16" height="12"/>', rrect: '<rect x="4" y="6" width="16" height="12" rx="4"/>', ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>', tri: L("M12 5l8 14H4z"), diamond: L("M12 4l8 8-8 8-8-8z"), arrow: L("M4 12h14M13 7l5 5-5 5"), line: L("M5 19L19 5"), star: L("M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"),
    textbox: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="2 2"/>' + L("M8 9h8M12 9v7"), play: L("M7 5l12 7-12 7z"), slide: '<rect x="3" y="5" width="18" height="12" rx="1.5"/>' + L("M8 21h8M12 17v4"), up: L("M12 19V5M6 11l6-6 6 6"), down: L("M12 5v14M6 13l6 6 6-6"),
    front: '<rect x="8" y="8" width="12" height="12" fill="currentColor" stroke="none" opacity=".25"/><rect x="4" y="4" width="12" height="12"/>', back: '<rect x="4" y="4" width="12" height="12" fill="currentColor" stroke="none" opacity=".25"/><rect x="8" y="8" width="12" height="12"/>',
    rotate: L("M20 12a8 8 0 11-3-6.2M20 4v5h-5"), comment: L("M4 5h16v11H9l-5 4z"), spell: L("M4 15l3-9 3 9M5 12h4M13 15l3 3 5-7"), full: L("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"), orient: '<rect x="6" y="3" width="12" height="18" rx="1.5"/>' + L("M3 12h2"), cols: L("M4 5h7v14H4zM13 5h7v14h-7z"),
    margins: '<rect x="4" y="3" width="16" height="18"/><rect x="7" y="6" width="10" height="12" stroke-dasharray="2 2"/>', size: '<rect x="5" y="3" width="14" height="18" rx="1"/>' + L("M8 8h8M8 12h8"), lock: '<rect x="6" y="11" width="12" height="9" rx="2"/>' + L("M9 11V8a3 3 0 016 0v3"),
    check: L("M5 12l5 5 9-10"), x: L("M6 6l12 12M18 6L6 18"), caret: L("M7 10l5 5 5-5"), more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>', home: L("M4 11l8-7 8 7v9h-5v-6H9v6H4z"),
    file: L("M6 3h8l5 5v13H6zM14 3v5h5"), doc: L("M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7M9 9h3"), sheet: '<rect x="4" y="4" width="16" height="16" rx="1.5"/>' + L("M4 10h16M4 15h16M10 4v16"), pres: '<rect x="3" y="4" width="18" height="12" rx="1.5"/>' + L("M12 16v4M8 20h8M7 12l3-3 2 2 4-4"),
    group: '<rect x="4" y="4" width="9" height="9" stroke-dasharray="2 2"/><rect x="11" y="11" width="9" height="9"/>', pin: L("M9 4h6l-1 6 3 3H7l3-3zM12 13v8"), eye: L("M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z") + '<circle cx="12" cy="12" r="3"/>', layout: '<rect x="3" y="4" width="18" height="16" rx="1.5"/>' + L("M3 9h18M10 9v11"),
    sup: L("M4 18l8-9M12 18L4 9M16 7l3-3h-3 M16 4h3"), sub: L("M4 14l8 9M12 14l-8 9M16 20l3-3h-3M16 17h3"), param: L("M5 6h14M5 12h14M5 18h14"), shapeOutline: '<rect x="5" y="5" width="14" height="14" rx="2"/>', hand: L("M9 12V5a1.5 1.5 0 013 0v6M12 11V4a1.5 1.5 0 013 0v7M15 11V6a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-4a1.5 1.5 0 012.5-1.5L9 14")
  };
  const ic = (n, cls) => `<svg class="oi ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

  /* ---------- styles for the ribbon and editors (inserted once) ---------- */
  const css = `
.ofw{position:fixed;inset:0;z-index:9100;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:14px/1.35 system-ui,sans-serif}
.oft{display:flex;gap:10px;align-items:center;padding:6px 10px;background:#1e1b4b;color:#fff;flex-wrap:wrap}.oft .back{background:#ffffff22;border:0;color:#fff;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;display:flex;gap:6px;align-items:center}
.oft .nm{flex:1;min-width:140px;max-width:420px;background:#ffffff18;border:1px solid #ffffff33;color:#fff;border-radius:8px;padding:7px 10px;font-weight:700}.oft .nm:focus{background:#fff;color:#111}
.oft .sv{font-size:12.5px;opacity:.9;white-space:nowrap}.oft .sv.err{color:#fecaca;font-weight:700}.oft .tb{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}.oft .tb button{background:#ffffff1f;border:0;color:#fff;border-radius:8px;padding:7px 11px;font-weight:700;cursor:pointer;display:flex;gap:6px;align-items:center}.oft .tb button:hover,.oft .back:hover{background:#ffffff38}
.oft .no{font-size:11.5px;opacity:.8;white-space:nowrap}
.rbt{display:flex;gap:2px;padding:0 8px;background:var(--card);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:thin}.rbt button{border:0;background:none;padding:8px 14px;font-weight:700;color:var(--mut);cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}.rbt button.on{color:var(--b1);border-color:var(--b1)}.rbt button.ctx{color:#b45309}.rbt button.ctx.on{border-color:#b45309}
.rbp{display:flex;gap:0;padding:6px 8px;background:var(--card);border-bottom:1px solid var(--line);overflow-x:auto;min-height:84px;scrollbar-width:thin;align-items:stretch}
.rg{display:flex;flex-direction:column;padding:0 8px;border-right:1px solid var(--line);flex:none}.rg:last-child{border-right:0}.rg .ri{display:flex;gap:3px;align-items:flex-start;flex-wrap:wrap;flex:1;align-content:flex-start;max-width:520px}.rg .rl{font-size:11px;color:var(--mut);text-align:center;margin-top:3px}
.rb{border:1px solid transparent;background:none;color:var(--ink);border-radius:7px;min-width:30px;height:30px;padding:0 6px;cursor:pointer;display:inline-flex;gap:5px;align-items:center;justify-content:center;font:inherit;font-weight:600;position:relative}.rb:hover{background:var(--bg);border-color:var(--line)}.rb.on{background:#6366f122;border-color:var(--b1);color:var(--b1)}.rb[disabled]{opacity:.35;cursor:default}
.rb.big{flex-direction:column;height:64px;min-width:52px;font-size:12px;gap:2px;padding:4px 6px}.rb.big .oi{width:26px;height:26px}.rb.tx{font-weight:800}.rb .oi{width:18px;height:18px;flex:none}.rb .sw{fill:var(--swc,#111)}
.rb .cr2{width:9px;height:9px;margin-left:-2px;opacity:.6}
.rs{height:30px;border:1px solid var(--line);border-radius:7px;background:var(--card);padding:0 6px;font:inherit;width:auto;color:var(--ink)}.rs.n{width:62px}
.rbm{position:fixed;z-index:9400;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px #0004;padding:6px;min-width:170px;max-height:70vh;overflow:auto;color:var(--ink)}.rbm button{display:flex;gap:8px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:7px 10px;border-radius:7px;cursor:pointer;color:var(--ink);font:inherit}.rbm button:hover{background:var(--bg)}.rbm button.on{color:var(--b1);font-weight:700}.rbm hr{border:0;border-top:1px solid var(--line);margin:4px 0}.rbm .oi{width:17px;height:17px}.rbm .hd{font-size:11px;color:var(--mut);padding:4px 10px;text-transform:uppercase}
.pal{display:grid;grid-template-columns:repeat(10,20px);gap:3px;padding:4px}.pal i{width:20px;height:20px;border-radius:4px;border:1px solid #0003;cursor:pointer}.pal i:hover{outline:2px solid var(--b1)}.pf{display:flex;gap:6px;padding:4px;align-items:center}.pf button{width:auto;flex:1;justify-content:center;border:1px solid var(--line)}.pf input[type=color]{width:34px;height:28px;padding:0;border:1px solid var(--line);border-radius:6px;background:none}
.gal{display:flex;gap:6px;align-items:stretch}.gal button{border:1px solid var(--line);background:#fff;color:#111;border-radius:8px;padding:6px 10px;min-width:84px;height:62px;cursor:pointer;text-align:left;overflow:hidden}.gal button:hover{border-color:var(--b1)}
.owk{flex:1;min-height:0;display:flex;overflow:hidden;background:#d9dde8;position:relative}@media(prefers-color-scheme:dark){.owk{background:#1a1f33}}
.ost{display:flex;gap:14px;align-items:center;padding:4px 12px;background:var(--card);border-top:1px solid var(--line);font-size:12.5px;color:var(--mut);flex-wrap:wrap}.ost input[type=range]{width:120px;padding:0}.ost .gr{flex:1}
.opane{width:300px;flex:none;background:var(--card);border-left:1px solid var(--line);overflow:auto;padding:12px}.opane h4{margin:0 0 8px}.opane label{font-size:12px;color:var(--mut);font-weight:600;display:block;margin:8px 0 3px}.opane .row2{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.opane input,.opane select{padding:7px}
.nw{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.nw button{display:flex;gap:12px;align-items:center;text-align:left;border:1.5px solid var(--line);background:var(--card);border-radius:14px;padding:14px;cursor:pointer;color:var(--ink)}.nw button:hover{border-color:var(--c)}.nw .ib{width:46px;height:46px;border-radius:12px;background:var(--c);color:#fff;display:grid;place-items:center;flex:none}.nw .ib .oi{width:26px;height:26px}.nw b{display:block}.nw small{color:var(--mut)}
.fl{display:grid;grid-template-columns:34px 1fr auto auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:12px;margin-bottom:7px;background:var(--card);cursor:pointer}.fl:hover{border-color:var(--b1)}.fl .ib{width:34px;height:34px;border-radius:9px;background:var(--c);color:#fff;display:grid;place-items:center}.fl .ib .oi{width:20px;height:20px}.fl b{display:block;word-break:break-word}.fl small{color:var(--mut)}
@media(max-width:700px){.fl{grid-template-columns:34px 1fr}.fl .ac{grid-column:1/-1}.opane{position:absolute;right:0;top:0;bottom:0;z-index:5;width:86vw;box-shadow:-8px 0 24px #0004}}
.ofp{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.oi{width:18px;height:18px;flex:none}body.oedit .kg-sw{display:none!important}
@media print{body.opv>*:not(.ofw){display:none!important}body.opv .ofw{position:static!important;display:block!important;height:auto!important;overflow:visible!important;background:#fff!important}body.opv .oft,body.opv .rbt,body.opv .rbp,body.opv .ost,body.opv .opane,body.opv .dhs{display:none!important}body.opv .owk{display:block!important;overflow:visible!important;background:#fff!important}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);

  /* ---------- popover menu ---------- */
  let openM = null;
  function closeMenu() { if (openM) { openM.remove(); openM = null; } }
  document.addEventListener("mousedown", (e) => { if (openM && !openM.contains(e.target) && !(e.target.closest && e.target.closest("[data-menu-owner]"))) closeMenu(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  function pop(anchor, html, wire) {
    closeMenu(); const m = document.createElement("div"); m.className = "rbm"; m.innerHTML = html; document.body.append(m); openM = m;
    const r = anchor.getBoundingClientRect(); let x = r.left, y = r.bottom + 4; const w = m.offsetWidth, h = m.offsetHeight;
    if (x + w > innerWidth - 8) x = Math.max(8, innerWidth - w - 8); if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 4); m.style.left = x + "px"; m.style.top = y + "px"; if (wire) wire(m); return m;
  }
  function menu(anchor, items) {
    const html = items.map((it, i) => it === "-" ? "<hr>" : it.hd ? `<div class="hd">${esc(it.hd)}</div>` : `<button data-i="${i}" class="${it.on ? "on" : ""}"${it.dis ? " disabled" : ""}>${it.i ? ic(it.i) : ""}<span>${esc(it.label)}</span></button>`).join("");
    pop(anchor, html, (m) => m.querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => { const it = items[+b.dataset.i]; closeMenu(); if (it.run) it.run(); })));
  }
  const PAL = (() => {
    const g = ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff"];
    const base = ["#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"];
    const out = [...g, ...base];
    const mix = (h, t, a) => { const n = parseInt(h.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, f = (c) => Math.round(c + (t - c) * a); return "#" + [f(r), f(gg), f(b)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    [[255, .8], [255, .6], [255, .4], [0, .25], [0, .5]].forEach(([t, a]) => base.forEach((h) => out.push(mix(h, t, a))));
    return out;
  })();
  const RECENT = [];
  function colourMenu(anchor, current, none, done) {
    const html = `<div class="pal">${PAL.map((c) => `<i data-c="${c}" style="background:${c}" title="${c}"></i>`).join("")}</div>${RECENT.length ? `<div class="hd">Recent</div><div class="pal">${RECENT.map((c) => `<i data-c="${c}" style="background:${c}"></i>`).join("")}</div>` : ""}<div class="pf">${none ? `<button data-none="1">${esc(none)}</button>` : ""}<label style="display:flex;gap:6px;align-items:center;margin:0;font-size:12px">Other <input type="color" value="${/^#[0-9a-f]{6}$/i.test(current || "") ? current : "#000000"}"></label></div>`;
    pop(anchor, html, (m) => {
      const pick = (c) => { if (c && !RECENT.includes(c)) { RECENT.unshift(c); RECENT.length = Math.min(RECENT.length, 10); } closeMenu(); done(c); };
      m.querySelectorAll("[data-c]").forEach((i) => (i.onclick = () => pick(i.dataset.c))); const n = m.querySelector("[data-none]"); if (n) n.onclick = () => pick("");
      const ci = m.querySelector("input[type=color]"); ci.onchange = () => pick(ci.value);
    });
  }

  /* ---------- ribbon ----------
     OffUI.make(host, tabs, opts) -> { refresh(), redraw(), show(id), tab() }
     tab: { id, label, ctx (contextual tab, shown only while when() is true), when(), groups:[{ label, items:[ item ] }] }
     item kinds: btn (default), sel, num, col, menu, html, sep */
  function make(host, tabs, opts) {
    opts = opts || {};
    host.innerHTML = '<div class="rbt" role="tablist"></div><div class="rbp"></div>';
    const bar = host.firstChild, panel = host.lastChild, refs = []; let cur = opts.first || tabs[0].id;
    const vis = (t) => !t.when || t.when();
    function draw() {
      if (!tabs.find((t) => t.id === cur && vis(t))) cur = tabs.find(vis).id;
      bar.innerHTML = tabs.filter(vis).map((t) => `<button role="tab" data-t="${t.id}" class="${t.id === cur ? "on" : ""}${t.ctx ? " ctx" : ""}">${esc(t.label)}</button>`).join("");
      bar.querySelectorAll("button").forEach((b) => (b.onclick = () => { cur = b.dataset.t; draw(); opts.onTab && opts.onTab(cur); }));
      const t = tabs.find((x) => x.id === cur); panel.innerHTML = ""; refs.length = 0;
      t.groups.forEach((g) => {
        const gd = document.createElement("div"); gd.className = "rg"; gd.innerHTML = `<div class="ri"></div><div class="rl">${esc(g.label)}</div>`; const ri = gd.firstChild;
        g.items.forEach((it) => { const el = item(it); if (el) { ri.append(el); refs.push([it, el]); } }); panel.append(gd);
      });
      refresh();
    }
    function item(it) {
      let el;
      if (it.k === "sep") { el = document.createElement("span"); el.style.cssText = "width:1px;height:26px;background:var(--line);margin:2px 4px"; return el; }
      if (it.k === "html") { el = document.createElement("span"); el.innerHTML = it.html; if (it.bind) it.bind(el); return el; }
      if (it.k === "sel") {
        el = document.createElement("select"); el.className = "rs"; el.title = it.t || ""; if (it.w) el.style.width = it.w + "px";
        el.innerHTML = it.opts.map((o) => { const a = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(a[0])}">${esc(a[1])}</option>`; }).join("");
        el.onchange = () => { it.on(el.value); refresh(); }; el.onmousedown = () => it.keep && it.keep(); return el;
      }
      if (it.k === "num") {
        el = document.createElement("input"); el.type = "number"; el.className = "rs n"; el.title = it.t || ""; if (it.min != null) el.min = it.min; if (it.max != null) el.max = it.max; if (it.step) el.step = it.step; if (it.w) el.style.width = it.w + "px";
        el.onchange = () => { it.on(el.value); refresh(); }; return el;
      }
      el = document.createElement("button"); el.type = "button"; el.className = "rb" + (it.big ? " big" : "") + (it.tx ? " tx" : ""); el.title = it.t || it.label || ""; el.setAttribute("aria-label", it.t || it.label || "");
      el.innerHTML = (it.i ? ic(it.i) : "") + (it.label ? `<span>${esc(it.label)}</span>` : "") + (it.k === "col" || it.k === "menu" ? ic("caret", "cr2") : "") + (it.html ? it.html : "");
      el.onmousedown = (e) => { if (!opts.nofocus) e.preventDefault(); if (it.keep) it.keep(); };   // keep the selection in the editor
      el.setAttribute("data-menu-owner", "1");
      el.onclick = () => {
        if (it.k === "col") { colourMenu(el, it.get ? it.get() : "", it.none, (c) => { it.on(c); refresh(); }); return; }
        if (it.k === "menu") { menu(el, typeof it.items === "function" ? it.items() : it.items); return; }
        it.on && it.on(); refresh();
      };
      return el;
    }
    function refresh() {
      refs.forEach(([it, el]) => {
        if (it.dis) el.disabled = !!it.dis();
        if (it.act && el.classList) el.classList.toggle("on", !!it.act());
        if (it.k === "sel" && it.get) { const v = it.get(); if (v != null) { if (![...el.options].some((o) => o.value === String(v))) { const o = document.createElement("option"); o.value = v; o.textContent = v; el.append(o); } el.value = String(v); } }
        if (it.k === "num" && it.get && document.activeElement !== el) { const v = it.get(); el.value = v == null ? "" : v; }
        if (it.k === "col" && it.get) { const c = it.get(); el.style.setProperty("--swc", c || "transparent"); }
      });
    }
    draw();
    return { refresh, redraw: draw, show(id) { cur = id; draw(); }, tab: () => cur };
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d == null ? 0 : d; };
  /* small inline form in a popover (no browser pop-up boxes): fields [{k, label, type:'text'|'number'|'select'|'check', value, opts, ph}] */
  function form(anchor, title, fields, okLabel, cb, extra) {
    const html = `<div style="min-width:240px;padding:4px"><b>${esc(title)}</b>${fields.map((f) => `<div style="margin-top:7px"><label style="font-size:12px;color:var(--mut);font-weight:600;display:block;margin-bottom:2px">${esc(f.label)}</label>${f.type === "select" ? `<select data-k="${f.k}" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${f.opts.map((o) => { const a = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(a[0])}"${String(a[0]) === String(f.value) ? " selected" : ""}>${esc(a[1])}</option>`; }).join("")}</select>` : f.type === "check" ? `<label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:14px"><input type="checkbox" data-k="${f.k}"${f.value ? " checked" : ""} style="width:auto"> ${esc(f.ph || "")}</label>` : f.type === "area" ? `<textarea data-k="${f.k}" rows="4" placeholder="${esc(f.ph || "")}" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(f.value == null ? "" : f.value)}</textarea>` : `<input data-k="${f.k}" type="${f.type || "text"}" value="${esc(f.value == null ? "" : f.value)}" placeholder="${esc(f.ph || "")}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} style="width:100%;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">`}</div>`).join("")}<div style="display:flex;gap:6px;margin-top:10px"><button class="of-ok" style="flex:1;justify-content:center;background:var(--b1);color:#fff;border-radius:8px;padding:8px;font-weight:700">${esc(okLabel || "OK")}</button>${extra ? `<button class="of-x" style="flex:1;justify-content:center;border:1px solid var(--line);border-radius:8px;padding:8px">${esc(extra.label)}</button>` : ""}<button class="of-no" style="justify-content:center;border:1px solid var(--line);border-radius:8px;padding:8px">Cancel</button></div></div>`;
    pop(anchor, html, (m) => {
      const val = () => { const o = {}; m.querySelectorAll("[data-k]").forEach((e) => (o[e.dataset.k] = e.type === "checkbox" ? e.checked : e.value)); return o; };
      m.querySelector(".of-ok").onclick = () => { const v = val(); closeMenu(); cb(v); }; m.querySelector(".of-no").onclick = closeMenu;
      if (extra) m.querySelector(".of-x").onclick = () => { closeMenu(); extra.run(); };
      m.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); m.querySelector(".of-ok").click(); } });
      const f1 = m.querySelector("[data-k]"); if (f1) setTimeout(() => f1.focus(), 20);
    });
  }
  window.OffUI = { ic, IC, esc, make, menu, pop, form, closeMenu, colourMenu, debounce, num };
})();
