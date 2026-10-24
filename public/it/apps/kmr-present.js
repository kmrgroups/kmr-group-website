/* KMR Presentation - one shared engine for every KMR app.
   KMRPresent.mount(el, cfg) draws an exclusive presentation screen from the app's own live data:
   scorecard with tower lights, trend charts, the standard clauses each KPI supports, and action plans with owner, date and status.
   cfg = { app, code, stdKey, appName, company, slug, call(fn,args), canEdit, controls:[{id,label,type,value,options}], load(values) -> {period, kpis, charts, notes} }
   KPI   = { id, name, value, unit, target, dir:'high'|'low', amber, tol, std:[['ISO','9.1.3']], prev, trend:[...], why, fmt(v) }
   Chart = { title, kind:'bar'|'line', labels:[], series:[{name, values:[]}], unit, note } */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var COL = { g: "#1e9e5a", a: "#e8a317", r: "#d64545", n: "#8a94a6", b: "#2f6fdb" };
  var CSS = ".kp{--kg:#1e9e5a;--ka:#e8a317;--kr:#d64545;--kn:#8a94a6;font-family:inherit;color:var(--tx,#1b2433)}" +
    ".kp .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px}.kp .bar label{display:block;font-size:12px;font-weight:600;color:var(--mut,#667)}" +
    ".kp .bar input,.kp .bar select{padding:7px 9px;border:1px solid var(--line,#d6dbe4);border-radius:8px;font:inherit;background:var(--card,#fff);color:inherit}" +
    ".kp .kb{padding:8px 14px;border-radius:8px;border:1px solid var(--b1,#2f6fdb);background:var(--b1,#2f6fdb);color:#fff;font-weight:600;cursor:pointer;font:inherit}.kp .kb.o{background:transparent;color:var(--b1,#2f6fdb)}.kp .kb.s{padding:4px 9px;font-size:12px}" +
    ".kp .stage{background:var(--card,#fff);border:1px solid var(--line,#d6dbe4);border-radius:12px;display:flex;flex-direction:column;min-height:min(72vh,640px)}" +
    ".kp:fullscreen{background:var(--bg,#f4f6fa);padding:14px;overflow:auto}.kp:fullscreen .stage{min-height:calc(100vh - 110px)}" +
    ".kp .sh{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line,#d6dbe4)}.kp .sh img{height:42px;max-width:150px;object-fit:contain}.kp .sh .t{flex:1}.kp .sh h2{margin:0;font-size:20px}.kp .sh .m{font-size:12px;color:var(--mut,#667)}" +
    ".kp .sb{flex:1;padding:16px 18px;overflow:auto}.kp .sf{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 18px;border-top:1px solid var(--line,#d6dbe4);font-size:11px;color:var(--mut,#667)}" +
    ".kp .kg{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.kp .kc{border:1px solid var(--line,#d6dbe4);border-left:6px solid var(--kn);border-radius:10px;padding:10px 12px;position:relative}" +
    ".kp .kc.g{border-left-color:var(--kg)}.kp .kc.a{border-left-color:var(--ka)}.kp .kc.r{border-left-color:var(--kr)}.kp .kc b{font-size:26px;display:block;line-height:1.1}.kp .kc small{display:block;color:var(--mut,#667);font-size:12px;margin-top:2px}" +
    ".kp .kc .nm{font-weight:700;font-size:13px;margin-bottom:4px}.kp .kc .tl{position:absolute;right:10px;top:10px}.kp .dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--kn);vertical-align:middle}.kp .dot.g{background:var(--kg)}.kp .dot.a{background:var(--ka)}.kp .dot.r{background:var(--kr)}.kp .dot.b{background:#2f6fdb}" +
    ".kp table{border-collapse:collapse;width:100%;font-size:13px}.kp th,.kp td{border:1px solid var(--line,#d6dbe4);padding:6px 8px;text-align:left;vertical-align:top}.kp th{background:var(--bg,#f4f6fa)}" +
    ".kp .nav{display:flex;gap:6px;align-items:center;justify-content:center;margin-top:10px;flex-wrap:wrap}.kp .nav .dt{width:10px;height:10px;border-radius:50%;background:#c9d0dc;cursor:pointer;border:0;padding:0}.kp .nav .dt.on{background:var(--b1,#2f6fdb);transform:scale(1.3)}" +
    ".kp .cg{display:grid;grid-template-columns:2fr 1fr;gap:14px}@media(max-width:800px){.kp .cg{grid-template-columns:1fr}}.kp .note{font-size:13px;color:var(--mut,#667);margin:8px 0}.kp .big{font-size:34px;font-weight:800}" +
    ".kp .frm{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:8px 0}.kp .frm label{font-size:12px;font-weight:600}.kp .frm input,.kp .frm select,.kp .frm textarea{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--line,#d6dbe4);border-radius:8px;font:inherit;background:var(--card,#fff);color:inherit}" +
    ".kp .chip{display:inline-block;padding:2px 9px;border-radius:12px;background:var(--bg,#eef1f6);font-size:12px;margin:2px;cursor:pointer;border:1px solid var(--line,#d6dbe4)}" +
    ".kp .kp-printonly{display:none}.kp-print .kp-printonly{display:inline}.kp-print{display:none}@media print{body.kp-printing>*:not(.kp-print){display:none!important}body.kp-printing .kp-print{display:block!important}.kp-print .pg{page-break-after:always;break-after:page;padding:6mm}.kp-print .kc{break-inside:avoid}.kp-print .stage{border:0;min-height:0}.noprint{display:none!important}@page{size:A4 landscape;margin:8mm}}";

  function light(k) {
    var v = k.value, t = k.target; if (v == null || isNaN(v) || t == null) return "n";
    var tol = k.tol == null ? 10 : k.tol;
    if (k.dir === "low") { if (v <= t) return "g"; var lim = k.amber != null ? k.amber : t * (1 + tol / 100); return v <= lim ? "a" : "r"; }
    if (v >= t) return "g"; var lo = k.amber != null ? k.amber : t * (1 - tol / 100); return v >= lo ? "a" : "r";
  }
  function fmtV(k) {
    if (k.value == null || isNaN(k.value)) return "—";
    if (k.fmt) return k.fmt(k.value);
    var u = k.unit || "", d = Math.abs(k.value) >= 100 ? 0 : 1, s = (+k.value).toFixed(d).replace(/\.0$/, "");
    return u === "%" ? s + "%" : u === "₹" ? "₹" + Math.round(k.value).toLocaleString("en-IN") : s + (u ? " " + u : "");
  }
  function spark(a, c) {
    var v = (a || []).filter(function (x) { return x != null; }); if (v.length < 2) return "";
    var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), W = 90, H = 26, n = a.length, pts = [];
    a.forEach(function (x, i) { if (x == null) return; var y = mx === mn ? H / 2 : H - 3 - (H - 6) * (x - mn) / (mx - mn); pts.push((i * W / Math.max(1, n - 1)).toFixed(1) + "," + y.toFixed(1)); });
    return '<svg width="' + W + '" height="' + H + '" style="display:block;margin-top:4px"><polyline fill="none" stroke="' + c + '" stroke-width="2" points="' + pts.join(" ") + '"/></svg>';
  }
  function chartSvg(c) {
    var W = 720, H = 300, pl = 46, pr = 12, pt = 18, pb = 44, ser = c.series || [], n = (c.labels || []).length, pal = ["#2f6fdb", "#e8a317", "#1e9e5a", "#d64545"];
    var all = []; ser.forEach(function (s) { (s.values || []).forEach(function (x) { if (x != null && !isNaN(x)) all.push(+x); }); });
    if (!n || !all.length) return '<div class="note">No data for this chart in the selected period.</div>';
    var mx = Math.max.apply(null, all.concat([0])), mn = Math.min.apply(null, all.concat([0])); if (mx === mn) mx = mn + 1;
    var iw = W - pl - pr, ih = H - pt - pb, y = function (v) { return pt + ih - ih * (v - mn) / (mx - mn); }, g = "";
    for (var i = 0; i <= 4; i++) { var gv = mn + (mx - mn) * i / 4, gy = y(gv); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" stroke="#e2e6ee"/><text x="' + (pl - 5) + '" y="' + (gy + 4) + '" font-size="12" text-anchor="end" fill="#667">' + (Math.abs(gv) >= 1000 ? (gv / 1000).toFixed(0) + "k" : (+gv).toFixed(gv % 1 ? 1 : 0)) + '</text>'; }
    var bw = iw / n, body = "", k = ser.length;
    if (c.kind === "line") {
      ser.forEach(function (s, si) {
        var col = s.color || pal[si % 4], pts = [], dots = "";
        (s.values || []).forEach(function (v, i) { if (v == null || isNaN(v)) return; var x = pl + bw * (i + .5), yy = y(v); pts.push(x.toFixed(1) + "," + yy.toFixed(1)); dots += '<circle cx="' + x + '" cy="' + yy + '" r="3.5" fill="' + col + '"/><text x="' + x + '" y="' + (yy - 7) + '" font-size="11" font-weight="600" text-anchor="middle" fill="#333">' + (+v).toFixed(Math.abs(v) >= 100 ? 0 : 1).replace(/\.0$/, "") + '</text>'; });
        body += '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" points="' + pts.join(" ") + '"/>' + dots;
      });
    } else {
      ser.forEach(function (s, si) {
        var col = s.color || pal[si % 4], w = bw * 0.78 / k;
        (s.values || []).forEach(function (v, i) { if (v == null || isNaN(v)) return; var x = pl + bw * i + bw * 0.11 + w * si, y0 = y(Math.max(0, mn)), yy = y(v), top = Math.min(y0, yy), h = Math.max(1, Math.abs(y0 - yy)); body += '<rect x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + col + '"/>' + (n <= 14 ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (top - 4).toFixed(1) + '" font-size="11" font-weight="600" text-anchor="middle" fill="#333">' + (+v).toFixed(Math.abs(v) >= 100 ? 0 : 1).replace(/\.0$/, "") + '</text>' : ""); });
      });
    }
    var xl = (c.labels || []).map(function (l, i) { var x = pl + bw * (i + .5), t = String(l); if (t.length > 12) t = t.slice(0, 11) + "…"; return '<text x="' + x.toFixed(1) + '" y="' + (H - pb + 16) + '" font-size="12" text-anchor="middle" fill="#445"' + (n > 8 ? ' transform="rotate(-25 ' + x.toFixed(1) + " " + (H - pb + 16) + ')"' : "") + '>' + esc(t) + '</text>'; }).join("");
    var lg = ser.length > 1 ? '<div class="note">' + ser.map(function (s, si) { return '<span style="color:' + (s.color || pal[si % 4]) + '">■</span> ' + esc(s.name) + "&nbsp;&nbsp;"; }).join("") + "</div>" : "";
    return '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:auto" role="img" aria-label="' + esc(c.title) + '">' + g + body + xl + "</svg>" + lg;
  }

  function mount(el, cfg) {
    if (!document.getElementById("kp-css")) { var st = document.createElement("style"); st.id = "kp-css"; st.textContent = CSS; document.head.appendChild(st); }
    var S = { i: 0, vals: {}, data: null, acts: [], local: false, form: null };
    (cfg.controls || []).forEach(function (c) { S.vals[c.id] = c.value; });
    var today = new Date().toISOString().slice(0, 10);
    var ref = function () { var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); }; return "KMR/" + String(cfg.app || "app").toUpperCase() + "/PRS/" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()); };
    var REF = ref(), logo = function () { var i = document.querySelector("#clogo img"); return i ? i.getAttribute("src") : ""; };
    var lsKey = "kmr_pres_" + (cfg.slug || "") + "_" + cfg.app;

    /* ----- action plans: database, with this device as the fallback ----- */
    function loadActs() {
      return cfg.call("kmr_pres_actions_get", { p_code: cfg.code, p_app: cfg.app }).then(function (r) { S.acts = r || []; S.local = false; }).catch(function () {
        S.local = true; try { S.acts = JSON.parse(localStorage.getItem(lsKey) || "[]"); } catch (e) { S.acts = []; }
      });
    }
    function saveAct(a) {
      if (!S.local) return cfg.call("kmr_pres_action_save", { p_code: cfg.code, p_app: cfg.app, p: a }).then(function () { return loadActs(); });
      var id = a.id || ("l" + Date.now()), i = S.acts.findIndex(function (x) { return x.id === id; }); a.id = id; if (i < 0) S.acts.push(a); else S.acts[i] = Object.assign(S.acts[i], a);
      try { localStorage.setItem(lsKey, JSON.stringify(S.acts)); } catch (e) { /* ignore */ } return Promise.resolve();
    }
    function delAct(id) {
      if (!S.local) return cfg.call("kmr_pres_action_delete", { p_code: cfg.code, p_id: id }).then(function () { return loadActs(); });
      S.acts = S.acts.filter(function (x) { return x.id !== id; }); try { localStorage.setItem(lsKey, JSON.stringify(S.acts)); } catch (e) { /* ignore */ } return Promise.resolve();
    }
    var actLight = function (a) { return a.status === "Done" ? "g" : (a.due && String(a.due).slice(0, 10) < today) ? "r" : a.status === "In progress" ? "a" : "b"; };
    var actState = function (a) { return a.status === "Done" ? "Done" : (a.due && String(a.due).slice(0, 10) < today) ? "Delayed" : a.status; };

    /* ----- slides ----- */
    function kpiCard(k) {
      var l = light(k), tg = k.target != null ? (k.dir === "low" ? "target ≤ " : "target ≥ ") + (k.fmt ? k.fmt(k.target) : (k.unit === "₹" ? "₹" + Math.round(k.target).toLocaleString("en-IN") : k.target + (k.unit && k.unit !== "₹" ? (k.unit === "%" ? "%" : " " + k.unit) : ""))) : "for information";
      var dlt = k.prev != null && k.value != null ? (function () { var d = k.value - k.prev, up = d > 0, good = k.dir === "low" ? !up : up; return d === 0 ? "no change from last month" : '<span style="color:' + (k.target == null ? "#667" : good ? COL.g : COL.r) + '">' + (up ? "▲ " : "▼ ") + Math.abs(d).toFixed(Math.abs(d) >= 100 ? 0 : 1).replace(/\.0$/, "") + "</span> vs last month"; })() : "";
      return '<div class="kc ' + l + '"><span class="tl"><i class="dot ' + l + '"></i></span><div class="nm">' + esc(k.name) + "</div><b>" + esc(fmtV(k)) + "</b><small>" + tg + "</small>" + (dlt ? "<small>" + dlt + "</small>" : "") + spark(k.trend, COL[l] || COL.n) + "</div>";
    }
    function slides() {
      var D = S.data, K = D.kpis || [], out = [], cnt = { g: 0, a: 0, r: 0, n: 0 }; K.forEach(function (k) { cnt[light(k)]++; });
      out.push({ t: "Management review", b: '<div style="text-align:center;padding:30px 10px">' + (logo() ? '<img src="' + esc(logo()) + '" alt="" style="height:80px;max-width:280px;object-fit:contain">' : "") + '<div class="big" style="margin-top:14px">' + esc(cfg.appName) + '</div><div style="font-size:20px;margin:6px 0">KPI review aligned to the standards</div><div style="font-size:18px;font-weight:600">' + esc(D.period || "") + '</div><div class="note">' + esc(cfg.company || "") + " · " + new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + '</div><div style="margin-top:18px"><span class="dot g"></span> ' + cnt.g + " on target &nbsp; <span class=\"dot a\"></span> " + cnt.a + " watch &nbsp; <span class=\"dot r\"></span> " + cnt.r + " off target</div></div>" });
      out.push({ t: "KPI scorecard", b: '<div class="kg">' + K.map(kpiCard).join("") + '</div><div class="note"><i class="dot g"></i> on target &nbsp; <i class="dot a"></i> within tolerance &nbsp; <i class="dot r"></i> off target &nbsp; <i class="dot"></i> for information. Figures come live from the app\'s own records for the period.</div>' });
      (D.charts || []).forEach(function (c) {
        var rel = K.filter(function (k) { return c.kpi && k.id === c.kpi; })[0];
        out.push({ t: c.title, b: '<div class="cg"><div>' + chartSvg(c) + '</div><div>' + (rel ? kpiCard(rel) : "") + (c.note ? '<div class="note">' + c.note + "</div>" : "") + (rel && rel.why ? '<div class="note"><b>How it is measured:</b> ' + esc(rel.why) + "</div>" : "") + "</div></div>" });
      });
      (D.extra || []).forEach(function (x) { out.push({ t: x.title, b: x.html }); });
      /* standards alignment: each clause with the KPI that gives its evidence */
      var rows = (window.KMRStd && cfg.stdKey ? KMRStd.rows(cfg.stdKey) : []), cat = (window.KMRStd && KMRStd.cat) || {};
      var link = rows.map(function (r) {
        var toks = String(r[1]).split("/").map(function (x) { return x.trim(); }), ks = K.filter(function (k) { return (k.std || []).some(function (s) { return s[0] === r[0] && toks.indexOf(String(s[1])) >= 0; }); });
        var worst = ks.length ? (ks.some(function (k) { return light(k) === "r"; }) ? "r" : ks.some(function (k) { return light(k) === "a"; }) ? "a" : ks.some(function (k) { return light(k) === "g"; }) ? "g" : "n") : "n";
        return { r: r, ks: ks, l: worst };
      }).sort(function (a, b) { return (b.ks.length ? 1 : 0) - (a.ks.length ? 1 : 0); });
      var per = 6; for (var p = 0; p < link.length; p += per) {
        var pg = link.slice(p, p + per);
        out.push({ t: "Standards alignment" + (link.length > per ? " (" + (p / per + 1) + "/" + Math.ceil(link.length / per) + ")" : ""), b: '<table><thead><tr><th>Standard · clause</th><th>Requirement</th><th>How the app meets it</th><th>KPI evidence (live)</th><th>Status</th></tr></thead><tbody>' + pg.map(function (x) {
          return "<tr><td><b>" + esc((cat[x.r[0]] || [x.r[0]])[0]) + "</b><br>" + esc(x.r[1]) + "</td><td>" + esc(x.r[2]) + "</td><td>" + esc(x.r[3]) + "</td><td>" + (x.ks.length ? x.ks.map(function (k) { return '<i class="dot ' + light(k) + '"></i> ' + esc(k.name) + ": <b>" + esc(fmtV(k)) + "</b>"; }).join("<br>") : '<span style="color:#667">Process control in place - no numeric KPI</span>') + '</td><td style="text-align:center"><i class="dot ' + (x.ks.length ? x.l : "g") + '"></i><br><small>' + (x.ks.length ? { g: "Met", a: "Watch", r: "Gap", n: "—" }[x.l] : "In place") + "</small></td></tr>";
        }).join("") + "</tbody></table>" });
      }
      /* action plans */
      var al = S.acts.slice().sort(function (a, b) { var o = { r: 0, a: 1, b: 2, g: 3 }; return o[actLight(a)] - o[actLight(b)] || String(a.due || "").localeCompare(String(b.due || "")); });
      var open = al.filter(function (a) { return a.status !== "Done"; }).length, done = al.length - open, late = al.filter(function (a) { return actState(a) === "Delayed"; }).length;
      var sug = K.filter(function (k) { return light(k) === "r" || light(k) === "a"; }).filter(function (k) { return !S.acts.some(function (a) { return a.kpi === k.id && a.status !== "Done"; }); });
      out.push({ t: "Action plans and status", act: true, b: (S.local ? '<div class="note" style="color:#b26a00">These actions are saved on this device only until the database update (migration 0088) is applied.</div>' : "") +
        '<div style="margin-bottom:8px"><i class="dot r"></i> ' + late + ' delayed &nbsp; <i class="dot a"></i> ' + al.filter(function (a) { return actState(a) === "In progress"; }).length + ' in progress &nbsp; <i class="dot b"></i> ' + al.filter(function (a) { return actState(a) === "Open"; }).length + ' open &nbsp; <i class="dot g"></i> ' + done + " done" + (cfg.canEdit ? ' &nbsp; <button class="kb s noprint" data-add="">+ Add action</button>' : "") + "</div>" +
        (cfg.canEdit && sug.length ? '<div class="noprint note">Suggested from the scorecard: ' + sug.map(function (k) { return '<span class="chip" data-sug="' + esc(k.id) + '"><i class="dot ' + light(k) + '"></i> ' + esc(k.name) + "</span>"; }).join("") + "</div>" : "") +
        (S.form ? formHtml(S.form, K) : "") +
        (al.length ? '<table><thead><tr><th>S.No</th><th>Action</th><th>KPI / standard</th><th>Owner</th><th>Target date</th><th>Status</th>' + (cfg.canEdit ? '<th class="noprint"></th>' : "") + "</tr></thead><tbody>" + al.map(function (a, i) {
          var k = K.filter(function (x) { return x.id === a.kpi; })[0];
          return "<tr><td>" + (i + 1) + "</td><td>" + esc(a.title) + (a.note ? '<div class="note" style="margin:2px 0">' + esc(a.note) + "</div>" : "") + "</td><td>" + (k ? esc(k.name) : "") + (a.standard ? "<br><small>" + esc(a.standard) + "</small>" : "") + "</td><td>" + esc(a.owner || "") + "</td><td>" + esc(String(a.due || "").slice(0, 10)) + '</td><td><i class="dot ' + actLight(a) + '"></i> ' + (cfg.canEdit ? '<select data-st="' + esc(a.id) + '" class="noprint">' + ["Open", "In progress", "Done"].map(function (s) { return "<option" + (s === a.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select><span class=\"kp-printonly\">" + esc(actState(a)) + "</span>" : esc(actState(a))) + (actState(a) === "Delayed" ? " <small style=\"color:#d64545\">delayed</small>" : "") + "</td>" + (cfg.canEdit ? '<td class="noprint"><button class="kb o s" data-edit="' + esc(a.id) + '">Edit</button> <button class="kb o s" data-del="' + esc(a.id) + '">Delete</button></td>' : "") + "</tr>";
        }).join("") + "</tbody></table>" : '<div class="note">No action plans yet. ' + (cfg.canEdit ? "Add one, or pick a suggestion from the scorecard." : "") + "</div>") });
      var worst = K.filter(function (k) { return light(k) === "r"; }).slice(0, 5);
      out.push({ t: "Summary and decisions", b: '<div class="kg"><div class="kc g"><div class="nm">On target</div><b>' + cnt.g + '</b></div><div class="kc a"><div class="nm">Within tolerance</div><b>' + cnt.a + '</b></div><div class="kc r"><div class="nm">Off target</div><b>' + cnt.r + '</b></div><div class="kc b" style="border-left-color:#2f6fdb"><div class="nm">Actions open / delayed</div><b>' + open + " / " + late + "</b></div></div>" +
        (worst.length ? '<h3 style="margin:16px 0 6px">Needs management attention</h3><ul>' + worst.map(function (k) { return "<li><b>" + esc(k.name) + ":</b> " + esc(fmtV(k)) + " against a target of " + (k.dir === "low" ? "at most " : "at least ") + esc(k.fmt ? k.fmt(k.target) : k.target + (k.unit === "%" ? "%" : "")) + "</li>"; }).join("") + "</ul>" : '<h3 style="margin:16px 0 6px">All measured KPIs are on target or within tolerance.</h3>') + '<div class="note">Decisions and responsibilities are recorded in the action plans.</div>' });
      return out;
    }
    function formHtml(f, K) {
      return '<div class="noprint" style="border:1px solid var(--line,#d6dbe4);border-radius:10px;padding:10px;margin-bottom:10px"><div class="frm"><div style="grid-column:1/-1"><label>Action *</label><input id="kf_t" value="' + esc(f.title || "") + '"></div><div><label>KPI</label><select id="kf_k"><option value="">—</option>' + K.map(function (k) { return '<option value="' + esc(k.id) + '"' + (k.id === f.kpi ? " selected" : "") + ">" + esc(k.name) + "</option>"; }).join("") + '</select></div><div><label>Standard / clause</label><input id="kf_s" value="' + esc(f.standard || "") + '"></div><div><label>Owner *</label><input id="kf_o" value="' + esc(f.owner || "") + '"></div><div><label>Target date *</label><input type="date" id="kf_d" value="' + esc(String(f.due || "").slice(0, 10)) + '"></div><div><label>Status</label><select id="kf_st">' + ["Open", "In progress", "Done"].map(function (s) { return "<option" + (s === (f.status || "Open") ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select></div><div style="grid-column:1/-1"><label>Note / evidence</label><input id="kf_n" value="' + esc(f.note || "") + '"></div></div><button class="kb s" id="kf_ok">Save action</button> <button class="kb o s" id="kf_no">Cancel</button> <span id="kf_m" class="note"></span></div>';
    }

    /* ----- shell ----- */
    function shell(sl, i, forPrint) {
      var hdr = '<div class="sh">' + (logo() ? '<img src="' + esc(logo()) + '" alt="">' : "") + '<div class="t"><h2>' + esc(sl.t) + '</h2><div class="m">' + esc(cfg.appName) + " · " + esc((S.data || {}).period || "") + "</div></div><div class=\"m\" style=\"text-align:right\">Ref: " + esc(REF) + "<br>Slide " + (i + 1) + "</div></div>";
      var ftr = '<div class="sf"><span>Format F-PRS-01 · Rev 00 · Management review presentation · ' + esc(cfg.company || "") + '</span><span>Powered By : <a href="https://www.kmr-groups.com" target="_blank" rel="noopener">KMR Group of Companies</a></span></div>';
      return '<div class="stage">' + hdr + '<div class="sb">' + sl.b + "</div>" + ftr + "</div>";
    }
    function draw() {
      if (!S.data) { el.innerHTML = '<div class="kp"><div class="note">Loading the live data…</div></div>'; return; }
      var sl = slides(); if (S.i >= sl.length) S.i = sl.length - 1; if (S.i < 0) S.i = 0;
      var ctl = (cfg.controls || []).map(function (c) {
        return "<div><label>" + esc(c.label) + "</label>" + (c.type === "select" ? '<select data-c="' + c.id + '">' + (c.options || []).map(function (o) { return "<option value=\"" + esc(o[0]) + '"' + (String(o[0]) === String(S.vals[c.id]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" : '<input data-c="' + c.id + '" type="' + (c.type || "text") + '" value="' + esc(S.vals[c.id]) + '">') + "</div>";
      }).join("");
      var root = el.querySelector(".kp"), fs = root && document.fullscreenElement === root;
      el.innerHTML = '<div class="kp"><div class="bar noprint">' + ctl + '<span style="flex:1"></span><button class="kb o" data-x="prev">◀ Back</button><button class="kb o" data-x="next">Next ▶</button><button class="kb o" data-x="full">Full screen</button><button class="kb" data-x="print">Print / PDF</button></div>' + shell(sl[S.i], S.i) + '<div class="nav noprint">' + sl.map(function (s, j) { return '<button class="dt' + (j === S.i ? " on" : "") + '" data-g="' + j + '" title="' + esc(s.t) + '"></button>'; }).join("") + "</div></div>";
      bind(sl, fs);
    }
    function bind(sl) {
      var root = el.querySelector(".kp");
      root.querySelectorAll("[data-c]").forEach(function (c) { c.onchange = function () { S.vals[c.dataset.c] = c.value; reload(); }; });
      root.querySelectorAll("[data-g]").forEach(function (b) { b.onclick = function () { S.i = +b.dataset.g; draw(); }; });
      root.querySelectorAll("[data-x]").forEach(function (b) {
        b.onclick = function () {
          var x = b.dataset.x;
          if (x === "prev") { S.i = Math.max(0, S.i - 1); draw(); } else if (x === "next") { S.i = Math.min(sl.length - 1, S.i + 1); draw(); }
          else if (x === "full") { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen(); }
          else if (x === "print") printAll();
        };
      });
      if (!el._kpKey) { el._kpKey = true; document.addEventListener("keydown", function (e) { if (!document.body.contains(el) || el.offsetParent === null) return; if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || "")) return; if (e.key === "ArrowRight") { S.i++; draw(); } else if (e.key === "ArrowLeft") { S.i--; draw(); } }); }
      var K = S.data.kpis || [];
      var open = function (f) { S.form = f; S.i = sl.findIndex(function (s) { return s.act; }); draw(); };
      root.querySelectorAll("[data-add]").forEach(function (b) { b.onclick = function () { open({}); }; });
      root.querySelectorAll("[data-sug]").forEach(function (b) { b.onclick = function () { var k = K.filter(function (x) { return x.id === b.dataset.sug; })[0]; var s = (k.std || [])[0]; open({ kpi: k.id, title: "Bring " + k.name + " (" + fmtV(k) + ") to the target of " + (k.dir === "low" ? "at most " : "at least ") + (k.fmt ? k.fmt(k.target) : k.target + (k.unit === "%" ? "%" : "")), standard: s ? s[0] + " " + s[1] : "" }); }; });
      root.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { open(S.acts.filter(function (a) { return a.id === b.dataset.edit; })[0] || {}); }; });
      root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { if (confirm("Delete this action?")) delAct(b.dataset.del).then(draw); }; });
      root.querySelectorAll("[data-st]").forEach(function (s) { s.onchange = function () { saveAct({ id: s.dataset.st, status: s.value }).then(draw).catch(function (e) { alert(e.message); }); }; });
      var no = root.querySelector("#kf_no"); if (no) no.onclick = function () { S.form = null; draw(); };
      var ok = root.querySelector("#kf_ok"); if (ok) ok.onclick = function () {
        var v = function (id) { return root.querySelector("#" + id).value.trim(); }, m = root.querySelector("#kf_m");
        if (!v("kf_t") || !v("kf_o") || !v("kf_d")) { m.textContent = "Action, owner and target date are needed."; m.style.color = "#d64545"; return; }
        var a = { id: S.form.id, title: v("kf_t"), kpi: v("kf_k"), standard: v("kf_s"), owner: v("kf_o"), due: v("kf_d"), status: v("kf_st"), note: v("kf_n") };
        saveAct(a).then(function () { S.form = null; draw(); }).catch(function (e) { m.textContent = e.message; m.style.color = "#d64545"; });
      };
    }
    function printAll() {
      var sl = slides(), box = document.createElement("div"); box.className = "kp-print kp";
      box.innerHTML = sl.map(function (s, i) { return '<div class="pg">' + shell(s, i, true) + "</div>"; }).join("");
      document.body.appendChild(box); document.body.classList.add("kp-printing");
      var done = function () { document.body.classList.remove("kp-printing"); box.remove(); window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done); setTimeout(function () { window.print(); }, 150);
    }
    function reload() {
      S.data = null; draw();
      Promise.all([loadActs(), Promise.resolve(cfg.load(S.vals))]).then(function (r) { S.data = r[1] || { kpis: [], charts: [] }; draw(); }).catch(function (e) { el.innerHTML = '<div class="kp"><div class="note" style="color:#d64545">' + esc(e.message || e) + "</div></div>"; });
    }
    reload();
    return { reload: reload };
  }
  window.KMRPresent = { mount: mount, light: light };
})();
