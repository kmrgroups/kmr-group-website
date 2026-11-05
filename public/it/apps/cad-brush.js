/* KMR CAD Draft — Format brush (Match Properties).
   FORMATBRUSH / MATCHPROP / MA / FB / PAINTER: pick the object whose look you want, then click or window-select any number of objects to give them the same look.
   Keeps painting until you press Enter or Esc. Type S (Settings) to choose what is copied:
   layer, colour, linetype, lineweight, text (font, bold, italic, underline, height), dimension style, hatch pattern. */
(function (K) {
  "use strict";
  const cmd = K.cmd;
  const cfg = { layer: true, color: true, lt: true, lw: true, text: true, dim: true, hatch: true };
  const NAMES = { layer: "Layer", color: "Colour", lt: "Linetype", lw: "Lineweight", text: "Text (font, style, height)", dim: "Dimension style", hatch: "Hatch pattern" };
  const isTxt = (e) => e && (e.t === "text" || e.t === "mtext");
  const look = (src) => {
    const a = [];
    if (cfg.layer) a.push("layer " + src.layer); if (cfg.color) a.push("colour " + (src.color || "ByLayer")); if (cfg.lt) a.push("linetype " + (src.lt || "ByLayer")); if (cfg.lw) a.push("lineweight " + (src.lw == null ? "ByLayer" : src.lw));
    if (cfg.text && isTxt(src)) a.push(`text ${src.fnt || "Arial"}${src.b ? " bold" : ""}${src.i ? " italic" : ""}${src.u ? " underline" : ""}, height ${src.h}`);
    return a.join(", ") || "nothing (open Settings and tick what to copy)";
  };
  const apply = (src, e) => {
    const n = Object.assign({}, e);
    if (cfg.layer) n.layer = src.layer;
    if (cfg.color) n.color = src.color || null;
    if (cfg.lt) n.lt = src.lt || null;
    if (cfg.lw) n.lw = src.lw == null ? null : src.lw;
    if (cfg.text && isTxt(src) && isTxt(e)) { n.h = src.h; ["fnt", "b", "i", "u"].forEach((k) => { if (src[k] === undefined) delete n[k]; else n[k] = src[k]; }); }
    if (cfg.hatch && src.t === "hatch" && e.t === "hatch") Object.assign(n, { pat: src.pat, solid: src.solid, sc: src.sc, ang: src.ang });
    if (cfg.dim && src.t === "dim" && e.t === "dim") { if (src.st) n.st = Object.assign({}, src.st); else delete n.st; if (src.sty !== undefined) n.sty = src.sty; }
    return n;
  };
  const settings = (E) => E.dialog("Format brush — what to copy", `<div class="cx-frm" style="display:grid;gap:8px">${Object.keys(NAMES).map((k) => `<label class="cx-chk"><input type="checkbox" data-k="${k}"${cfg[k] ? " checked" : ""}> ${NAMES[k]}</label>`).join("")}</div>`,
    (b) => { b.querySelectorAll("[data-k]").forEach((c) => (cfg[c.dataset.k] = c.checked)); return true; });

  cmd("MATCHPROP", { a: ["MA", "PAINTER", "FB", "FORMATBRUSH"], d: "Format brush — copy the look (layer, colour, linetype, text style, dimension style, hatch) from one object to others", fn: async (E) => {
    let src = null;
    while (!src) {
      const v = await E.getEnt("Select the object to copy the format from (S = settings):", { anyLayer: true }); if (v == null) return;
      if (v.kw === "Settings") { await settings(E); continue; }
      src = v.e;
    }
    E.msg("Format brush loaded: " + look(src) + ". Click or window-select objects to paint; Enter to finish.");
    let n = 0;
    for (;;) {
      const ids = await E.getSel("Brush ready — select objects to format (Enter to finish):", {}); if (!ids.length) break;
      E.tx("format brush", () => ids.forEach((id) => { const e = E.byId(id); if (e && e.id !== src.id) { E.replace(id, apply(src, e)); n++; } }));
    }
    E.msg(n ? `Format painted on ${n} object(s).` : "Format brush finished.");
  } });
})(window.KCAD);
