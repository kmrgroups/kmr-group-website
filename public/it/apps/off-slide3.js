/* KMR Office Suite - Presentations, part 3: animations (entrance, emphasis, exit; click / with previous / after previous), more transitions,
   a full slide show engine (animations, links, pen, highlighter, eraser, laser pointer, presenter view with notes and timer, loop, timings, media),
   notes pages and handouts. */
(function () {
  "use strict";
  const { form, esc } = OffUI;

  const FX = {
    in: [["appear", "Appear"], ["fade", "Fade"], ["fly", "Fly in"], ["zoom", "Zoom"], ["wipe", "Wipe"], ["spin", "Spin"], ["grow", "Grow and turn"], ["bounce", "Bounce"]],
    emph: [["pulse", "Pulse"], ["spinE", "Spin"], ["grows", "Grow / shrink"], ["flash", "Flash"], ["teeter", "Teeter"]],
    out: [["disappear", "Disappear"], ["fadeO", "Fade out"], ["flyO", "Fly out"], ["zoomO", "Zoom out"], ["wipeO", "Wipe out"]]
  };
  const FXNAME = {}; Object.values(FX).forEach((l) => l.forEach(([k, n]) => (FXNAME[k] = n)));
  const DIRS = [["L", "From left"], ["R", "From right"], ["T", "From top"], ["B", "From bottom"]];
  const kindOf = (fx) => (FX.in.some((x) => x[0] === fx) ? "in" : FX.out.some((x) => x[0] === fx) ? "out" : "emph");

  /* build keyframes for one animation entry; returns {frames, opts} or null for instant effects */
  function frames(a, W, H, o) {
    const d = a.dir || "L", off = { L: [-1, 0], R: [1, 0], T: [0, -1], B: [0, 1] }[d];
    const tx = (f) => `${off[0] * f}px ${off[1] * f}px`, big = Math.max(W, H);
    const clip = (inset) => ({ clipPath: inset });
    const wipeFrom = { L: ["inset(0 100% 0 0)", "inset(0 0 0 0)"], R: ["inset(0 0 0 100%)", "inset(0 0 0 0)"], T: ["inset(0 0 100% 0)", "inset(0 0 0 0)"], B: ["inset(100% 0 0 0)", "inset(0 0 0 0)"] }[d];
    switch (a.fx) {
      case "appear": case "disappear": return null;
      case "fade": return [{ opacity: 0 }, { opacity: 1 }]; case "fadeO": return [{ opacity: 1 }, { opacity: 0 }];
      case "fly": return [{ translate: tx(big), opacity: 0 }, { translate: "0 0", opacity: 1 }]; case "flyO": return [{ translate: "0 0", opacity: 1 }, { translate: tx(big), opacity: 0 }];
      case "zoom": return [{ scale: 0.1, opacity: 0 }, { scale: 1, opacity: 1 }]; case "zoomO": return [{ scale: 1, opacity: 1 }, { scale: 0.1, opacity: 0 }];
      case "wipe": return [clip(wipeFrom[0]), clip(wipeFrom[1])]; case "wipeO": return [clip(wipeFrom[1]), clip(wipeFrom[0])];
      case "spin": return [{ rotate: "-360deg", scale: 0.2, opacity: 0 }, { rotate: "0deg", scale: 1, opacity: 1 }];
      case "grow": return [{ rotate: "-90deg", scale: 0.1, opacity: 0 }, { rotate: "0deg", scale: 1, opacity: 1 }];
      case "bounce": return [{ translate: "0 -" + H + "px", opacity: 0, offset: 0 }, { translate: "0 0", opacity: 1, offset: 0.55 }, { translate: "0 -" + H * 0.12 + "px", offset: 0.72 }, { translate: "0 0", offset: 0.85 }, { translate: "0 -" + H * 0.04 + "px", offset: 0.93 }, { translate: "0 0", offset: 1 }];
      case "pulse": return [{ scale: 1 }, { scale: 1.12 }, { scale: 1 }]; case "spinE": return [{ rotate: "0deg" }, { rotate: "360deg" }];
      case "grows": return [{ scale: 1 }, { scale: 1.5 }, { scale: 1 }]; case "flash": return [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }];
      case "teeter": return [{ rotate: "0deg" }, { rotate: "-8deg" }, { rotate: "8deg" }, { rotate: "-6deg" }, { rotate: "6deg" }, { rotate: "0deg" }];
    } return null;
  }
  /* run one entry on its element; returns a promise resolved at the end */
  function runAnim(el, a, W, H) {
    return new Promise((res) => {
      const k = kindOf(a.fx), dur = Math.max(1, (a.dur == null ? 0.5 : a.dur) * 1000), fr = frames(a, W, H);
      const finish = () => { if (k === "out") el.style.visibility = "hidden"; res(); };
      if (k !== "out") el.style.visibility = "visible";
      if (!fr) { finish(); return; }
      const an = el.animate(fr, { duration: dur, easing: "ease-out", fill: k === "emph" ? "none" : "none" }); an.onfinish = finish; an.oncancel = finish;
    });
  }
  const stepsOf = (s) => { const steps = []; (s.anim || []).forEach((a, i) => { if (!steps.length || a.trig === "click") steps.push([]); steps[steps.length - 1].push(a); }); return steps; };
  async function playStep(step, elOf, W, H) {
    const tasks = []; let t0 = 0, prevEnd = 0;
    step.forEach((a) => { const dl = (a.dl || 0) * 1000, dur = (a.dur == null ? 0.5 : a.dur) * 1000; let start; if (a.trig === "after") start = prevEnd + dl; else if (a.trig === "with") start = t0 + dl; else start = dl; if (a === step[0]) t0 = start; prevEnd = Math.max(prevEnd, start + dur); const el = elOf(a.o); if (!el) return; tasks.push(new Promise((r) => setTimeout(() => runAnim(el, a, W, H).then(r), start))); });
    await Promise.all(tasks);
  }
  const hideInitial = (s, host) => { (s.anim || []).forEach((a) => { const el = host.querySelector(`.po[data-id="${a.o}"]`); if (!el) return; if (kindOf(a.fx) === "in" && !(s.anim.some((b) => b.o === a.o && b !== a && kindOf(b.fx) === "out" && s.anim.indexOf(b) < s.anim.indexOf(a)))) el.style.visibility = "hidden"; }); };

  const css = `.pshow .sl.anim-flip{animation:pflip var(--td,.6s)}.pshow .sl.anim-circle{animation:pcircle var(--td,.7s)}.pshow .sl.anim-split{animation:psplit var(--td,.6s)}.pshow .sl.anim-blinds{animation:pblinds var(--td,.7s)}.pshow .sl.anim-spinz{animation:pspinz var(--td,.7s)}.pshow .sl.anim-rise{animation:prise var(--td,.5s)}.pshow .sl.anim-fade,.pshow .sl.anim-slide,.pshow .sl.anim-zoom,.pshow .sl.anim-wipe{animation-duration:var(--td,.5s)}
@keyframes pflip{from{transform:perspective(1200px) rotateY(90deg);opacity:0}to{transform:none;opacity:1}}@keyframes pcircle{from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(75% at 50% 50%)}}@keyframes psplit{from{clip-path:inset(50% 0 50% 0)}to{clip-path:inset(0 0 0 0)}}@keyframes pblinds{0%{clip-path:polygon(0 0,100% 0,100% 8%,0 8%,0 16%,100% 16%,100% 24%,0 24%,0 32%,100% 32%,100% 40%,0 40%,0 48%,100% 48%,100% 56%,0 56%,0 64%,100% 64%,100% 72%,0 72%,0 80%,100% 80%,100% 88%,0 88%,0 100%,0 100%)}100%{clip-path:inset(0)}}@keyframes pspinz{from{transform:rotate(-180deg) scale(.1);opacity:0}to{transform:none;opacity:1}}@keyframes prise{from{transform:translateY(60%);opacity:0}to{transform:none;opacity:1}}
.pshow .bar{flex-wrap:wrap;max-width:96vw;justify-content:center}.pshow .bar button.on{background:#2563eb}.pshow .bar .sep{width:1px;height:20px;background:#6b7280;margin:0 2px}.pshow .bar .clr{width:20px;height:20px;border-radius:50%;border:2px solid #fff;padding:0}
.pshow .ink{position:absolute;left:0;top:0;pointer-events:none}.pshow.pen .ink,.pshow.hl .ink,.pshow.er .ink{pointer-events:auto;cursor:crosshair}.pshow.laser,.pshow.laser *{cursor:none!important}.pshow .ldot{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:radial-gradient(circle,#ff2a2a 0,#ff2a2a 35%,rgba(255,40,40,.35) 60%,transparent 70%);pointer-events:none;display:none;z-index:6}.pshow.laser .ldot{display:block}
.pshow .pvp{position:absolute;right:0;top:0;bottom:0;width:36%;background:#111827;color:#e5e7eb;padding:14px;box-sizing:border-box;display:none;flex-direction:column;gap:10px;font:14px Calibri,Arial,sans-serif;z-index:4}.pshow.pv .pvp{display:flex}.pshow .pvp .nx{position:relative;width:100%;background:#fff;overflow:hidden;flex:none;border:1px solid #374151}.pshow .pvp .nt{flex:1;overflow:auto;white-space:pre-wrap;line-height:1.4;background:#0b1220;border-radius:8px;padding:10px}.pshow .pvp .tm2{display:flex;justify-content:space-between;font-size:22px;font-weight:700}.pshow .pvp .lb{font-size:11px;text-transform:uppercase;color:#9ca3af;letter-spacing:.06em}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);

  (window.OffSlideP = window.OffSlideP || []).push(function (P) {
    const { X, D, api, tabs, tc, uid } = P, th = P.th, sl = P.sl, W = P.W, H = P.H, say = (m, ok) => api.say(m, ok), anchor = api.rib;
    D.show = D.show || { loop: false, timings: true };
    const tab = (id) => tabs.find((t) => t.id === id);
    let selAnim = null;
    const aList = () => (sl().anim = sl().anim || []);
    const label = (o) => (X.label ? X.label(o) : o.t);

    /* ---------- editing animations ---------- */
    const addAnim = (fx) => { const os = P.selObjs(); if (!os.length) { say("Click a text box, shape or picture first, then choose an animation."); return; } P.mod(() => os.forEach((o) => { const a = { id: uid(), o: o.id, fx, trig: aList().length ? "click" : "click", dur: 0.5, dl: 0, dir: "L" }; aList().push(a); selAnim = a.id; })); if (X.refreshPane) X.refreshPane(); P.redraw(); say("Animation added. Open the Animation pane to see the order; press Preview to watch it.", true); };
    const curA = () => { const l = aList(); return l.find((a) => a.id === selAnim) || [...l].reverse().find((a) => P.sel.includes(a.o)) || null; };
    const setA = (patch) => { const a = curA(); if (!a) { say("Add an animation to an object first (or click one in the Animation pane)."); return; } P.mod(() => Object.assign(a, patch)); if (X.refreshPane) X.refreshPane(); P.redraw(); };
    const moveA = (d) => { const a = curA(); if (!a) return; const l = aList(), i = l.indexOf(a), j = i + d; if (j < 0 || j >= l.length) return; P.mod(() => { l.splice(i, 1); l.splice(j, 0, a); }); if (X.refreshPane) X.refreshPane(); };
    const delA = () => { const a = curA(); if (!a) return; P.mod(() => { sl().anim = aList().filter((x) => x !== a); }); selAnim = null; if (X.refreshPane) X.refreshPane(); P.redraw(); };
    async function preview() {
      const s = sl(); if (!(s.anim || []).length) { say("This slide has no animations yet."); return; } const host = P.main; const steps = stepsOf(s); const els = [...host.querySelectorAll(".po")]; const prevVis = els.map((e) => e.style.visibility); hideInitial(s, host);
      say("Previewing…"); for (let i = 0; i < steps.length; i++) { await playStep(steps[i], (id) => host.querySelector(`.po[data-id="${id}"]`), W(), H()); await new Promise((r) => setTimeout(r, 350)); }
      els.forEach((e, i) => (e.style.visibility = prevVis[i])); say("Preview finished.", true);
    }
    X.panes.anim = () => {
      const s = sl(), l = aList(), pane = P.wk.querySelector(".pxpane");
      const rows = l.map((a, i) => { const o = s.objs.find((q) => q.id === a.o); const k = kindOf(a.fx); return `<div class="row${a.id === selAnim ? " on" : ""}" data-id="${a.id}"><span style="width:20px;color:#64748b">${i + 1}</span><span style="color:${k === "in" ? "#16a34a" : k === "out" ? "#dc2626" : "#d97706"}">★</span><span class="nm">${esc(o ? label(o) : "(removed object)")} · ${FXNAME[a.fx]}</span><span class="hint" style="margin:0">${a.trig === "click" ? "click" : a.trig === "with" ? "with" : "after"}</span></div>`; }).join("");
      pane.innerHTML = `<h4>Animation pane <button data-x title="Close">✕</button></h4><div style="margin-bottom:6px"><button class="btn pri" data-a="play">▶ Preview</button><button class="btn" data-a="up">▲</button><button class="btn" data-a="dn">▼</button><button class="btn" data-a="del">Remove</button></div>${rows || '<div class="hint">No animations on this slide. Select an object and choose one from Animations ▸ Add animation.</div>'}<div class="hint">★ green = appears, orange = emphasis, red = leaves. “click” starts on mouse click; “with” starts together with the one above; “after” starts when the one above ends.</div>`;
      pane.querySelector("[data-x]").onclick = X.closePane; pane.querySelector("[data-a=play]").onclick = preview; pane.querySelector("[data-a=up]").onclick = () => moveA(-1); pane.querySelector("[data-a=dn]").onclick = () => moveA(1); pane.querySelector("[data-a=del]").onclick = delA;
      pane.querySelectorAll(".row").forEach((r) => (r.onclick = () => { selAnim = r.dataset.id; const a = l.find((x) => x.id === selAnim); if (a) P.setSel([a.o]); X.panes.anim(); }));
    };
    const trigMenu = () => [["On click", "click"], ["With previous", "with"], ["After previous", "after"]].map((t) => ({ label: t[0], on: !!curA() && curA().trig === t[1], run: () => setA({ trig: t[1] }) }));
    const fxMenu = () => { const out = []; [["Entrance", "in"], ["Emphasis", "emph"], ["Exit", "out"]].forEach(([n, k]) => { out.push({ hd: n }); FX[k].forEach(([f, nm]) => out.push({ label: nm, run: () => addAnim(f) })); }); return out; };
    tabs.splice(tabs.findIndex((t) => t.id === "trans") + 1, 0, { id: "anims", label: "Animations", groups: [
      { label: "Animation", items: [{ k: "menu", i: "anim", label: "Add animation", big: true, t: "Choose how the selected object enters, is emphasised or leaves", items: fxMenu }, { i: "play", label: "Preview", on: preview }, { i: "pane", label: "Animation pane", on: () => X.openPane("anim", X.panes.anim) }] },
      { label: "Effect options", items: [{ k: "menu", i: "orient", label: "Direction", items: () => DIRS.map((d) => ({ label: d[1], on: !!curA() && (curA().dir || "L") === d[0], run: () => setA({ dir: d[0] }) })) }] },
      { label: "Timing", items: [{ k: "menu", i: "play", label: "Start", items: trigMenu }, { k: "menu", i: "calendar", label: "Duration", items: () => [0.25, 0.5, 1, 1.5, 2, 3].map((v) => ({ label: v + " seconds", on: !!curA() && curA().dur === v, run: () => setA({ dur: v }) })) }, { k: "menu", i: "calendar", label: "Delay", items: () => [0, 0.5, 1, 2, 3].map((v) => ({ label: v ? v + " seconds" : "No delay", on: !!curA() && (curA().dl || 0) === v, run: () => setA({ dl: v }) })) }] },
      { label: "Order", items: [{ i: "up", label: "Move earlier", on: () => moveA(-1) }, { i: "down", label: "Move later", on: () => moveA(1) }, { i: "trash", label: "Remove", on: delA }] }] });

    /* ---------- transitions additions ---------- */
    const trans = tab("trans"); const setT = (t, all) => P.mod(() => { if (all) D.slides.forEach((s) => (s.trans = t)); else sl().trans = t; P.drawThumbs(); say(all ? "Transition applied to all slides." : "Transition set. It plays in the slide show.", true); });
    if (trans) {
      const g0 = trans.groups[0]; if (g0 && g0.items) { const extra = [["Flip", "flip"], ["Circle", "circle"], ["Split", "split"], ["Blinds", "blinds"], ["Spin", "spinz"], ["Rise", "rise"]]; extra.forEach((t) => g0.items.splice(g0.items.length - 0, 0, { label: t[0], on: () => setT(t[1], false), act: () => (sl().trans || "none") === t[1] })); }
      trans.groups.push({ label: "Timing", items: [{ k: "menu", i: "calendar", label: "Duration", items: () => [0.3, 0.5, 0.8, 1.2, 2].map((v) => ({ label: v + " seconds", on: sl().tdur === v, run: () => P.mod(() => (sl().tdur = v)) })) }, { i: "calendar", label: "Advance after…", t: "Move on automatically after a number of seconds (works when ‘Use timings’ is on)", on: () => form(anchor, "Advance this slide automatically", [{ k: "s", label: "After how many seconds? (0 = only on click)", type: "number", value: sl().auto || 0 }, { k: "all", label: " ", type: "check", ph: "Apply to all slides", value: false }], "Save", (v) => P.mod(() => { const n = Math.max(0, +v.s || 0); if (v.all) D.slides.forEach((s) => (s.auto = n || undefined)); else sl().auto = n || undefined; })) }] });
    }

    /* ---------- show setup ---------- */
    const show = tab("show");
    if (show) show.groups.push({ label: "Set up", items: [{ i: "pres", label: "Presenter view", t: "Start with speaker notes, next slide and timer beside the slide", on: () => X.show(P.cur, { pv: true }) }, { i: "undo", label: "Loop show", t: "Return to the first slide after the last", on: () => P.mod(() => (D.show.loop = !D.show.loop)), act: () => !!D.show.loop }, { i: "calendar", label: "Use timings", t: "Advance slides automatically when a time is set", on: () => P.mod(() => (D.show.timings = !D.show.timings)), act: () => D.show.timings !== false }, { k: "menu", i: "print", label: "Print layout", items: () => [["Slides (one per page)", "slides"], ["Notes pages (slide + notes)", "notes"], ["Handout – 2 per page", 2], ["Handout – 3 per page (with note lines)", 3], ["Handout – 4 per page", 4], ["Handout – 6 per page", 6], ["Handout – 9 per page", 9]].map((a) => ({ label: a[0], run: () => printLayout(a[1]) })) }] });

    /* ---------- notes pages and handouts ---------- */
    function printLayout(kind) {
      if (kind === "slides") { P.ctrl ? P.ctrl.print() : window.__slide.ctrl.print(); return; }
      const ppEl = P.ppEl; ppEl.innerHTML = ""; const pgW = 740, pgH = 1040, slides = D.slides.filter((s) => !s.hidden && !s.master);
      const thumb = (s, w) => { const h = (w * H()) / W(); const box = document.createElement("div"); box.style.cssText = `width:${w}px;height:${h}px;position:relative;overflow:hidden;border:1px solid #9ca3af;background:#fff`; const inner = document.createElement("div"); inner.className = "psl"; inner.style.transform = `scale(${w / W()})`; P.renderSlide(inner, s, th(), false); box.append(inner); return box; };
      const page = () => { const pg = document.createElement("div"); pg.className = "ppg"; pg.style.cssText = `width:${pgW}px;height:${pgH}px;position:relative;background:#fff;color:#111;font:14px Calibri,Arial,sans-serif;box-sizing:border-box;padding:30px`; ppEl.append(pg); return pg; };
      if (kind === "notes") slides.forEach((s) => { const pg = page(); const t = thumb(s, 520); t.style.margin = "10px auto 26px"; pg.append(t); const n = document.createElement("div"); n.style.cssText = "white-space:pre-wrap;line-height:1.5;border-top:1px solid #d1d5db;padding-top:12px;font-size:16px"; n.textContent = s.notes || ""; pg.append(n); const no = document.createElement("div"); no.style.cssText = "position:absolute;right:30px;bottom:14px;color:#6b7280"; no.textContent = "Slide " + (D.slides.indexOf(s) + 1); pg.append(no); });
      else { const per = +kind, cols = per <= 2 ? 1 : per === 3 ? 1 : per === 4 ? 2 : per === 6 ? 2 : 3, rows = Math.ceil(per / cols); for (let i = 0; i < slides.length; i += per) { const pg = page(); const g = document.createElement("div"); g.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);grid-auto-rows:${Math.floor((pgH - 60) / rows)}px;gap:12px`; slides.slice(i, i + per).forEach((s, j) => { const cell = document.createElement("div"); cell.style.cssText = "display:flex;gap:14px;align-items:flex-start"; const w = per === 3 ? 330 : Math.floor((pgW - 60 - (cols - 1) * 12) / cols) - (per === 2 ? 0 : 6); const t = thumb(s, Math.min(w, 600)); cell.append(t); if (per === 3) { const l = document.createElement("div"); l.style.cssText = "flex:1;align-self:stretch;display:flex;flex-direction:column;justify-content:space-around;padding:6px 0"; l.innerHTML = '<div style="border-bottom:1px solid #6b7280;height:1px"></div>'.repeat(5); cell.append(l); } const no = document.createElement("div"); no.style.cssText = "font-size:11px;color:#6b7280"; no.textContent = D.slides.indexOf(s) + 1; if (per !== 3) { cell.style.flexDirection = "column"; cell.style.gap = "3px"; cell.append(no); } g.append(cell); }); pg.append(g); } }
      let st2 = document.getElementById("off-page-style"); if (!st2) { st2 = document.createElement("style"); st2.id = "off-page-style"; st2.media = "print"; document.head.append(st2); } st2.textContent = "@page{size:A4 portrait;margin:8mm}";
      if (window.KMRReport) KMRReport.set({ title: (window.__slideTitle || "Presentation") + (kind === "notes" ? " – notes pages" : " – handout"), doc: "", key: "slides", land: false }); const t0 = document.title; document.body.classList.add("opv");
      const w2 = document.querySelector(".pp"); if (w2) w2.style.setProperty("--ps", "1");
      setTimeout(() => { window.print(); document.title = t0; document.body.classList.remove("opv"); ppEl.innerHTML = ""; st2.textContent = "@page{size:A4 landscape;margin:10mm}"; }, 400);
    }

    X.printLayout = printLayout;
    /* ---------- slide show engine ---------- */
    X.show = function (from, opt) {
      opt = opt || {}; if (P.editing) P.endEdit(); const vis = (i) => D.slides[i] && !D.slides[i].hidden && !D.slides[i].master; const idxs = D.slides.map((s, i) => i).filter(vis); if (!idxs.length) { say("All slides are hidden."); return; }
      let pos = idxs.find((i) => i >= from); if (pos == null) pos = idxs[0]; const ov = document.createElement("div"); ov.className = "pshow"; ov.tabIndex = 0; X.inShow = true;
      const COLORS = ["#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#111827", "#ffffff"]; let tool = "arrow", color = COLORS[0], steps = [], stepI = 0, busy = false, black = false, white = false, numBuf = "", mvT = 0, autoT = 0, t0 = Date.now(), tickT = 0; const ink = {};
      ov.innerHTML = `<div class="stage" style="position:absolute;inset:0"></div><div class="ldot"></div><div class="pvp"><div class="lb">Next slide</div><div class="nx"></div><div class="lb">Speaker notes</div><div class="nt"></div><div class="tm2"><span class="el">0:00</span><span class="ck"></span></div><div class="lb"><span class="cnt2"></span></div></div><div class="bar"><button data-a="p" title="Previous">◀</button><span class="cnt"></span><button data-a="n" title="Next">▶</button><span class="sep"></span><button data-t="arrow" class="on" title="Pointer (Ctrl+A)">Pointer</button><button data-t="laser" title="Laser pointer (Ctrl+L)">Laser</button><button data-t="pen" title="Pen (Ctrl+P)">Pen</button><button data-t="hl" title="Highlighter">Highlighter</button><button data-t="er" title="Eraser (Ctrl+E)">Eraser</button>${COLORS.map((c) => `<button class="clr" data-c="${c}" style="background:${c}" title="Ink colour"></button>`).join("")}<span class="sep"></span><button data-a="pv" title="Presenter view (S)">Presenter</button><button data-a="b" title="Black screen (B)">Black</button><button data-a="x">End show</button></div>`;
      document.body.append(ov); const stage = ov.querySelector(".stage"), cntEl = ov.querySelector(".cnt"), nx = ov.querySelector(".nx"), ntEl = ov.querySelector(".nt"), ldot = ov.querySelector(".ldot");
      const region = () => { const vw = innerWidth, vh = innerHeight; if (ov.classList.contains("pv")) { const rw = vw * 0.64; return { x: 0, y: 0, w: rw, h: vh - 56 }; } return { x: 0, y: 0, w: vw, h: vh }; };
      const layout = (el) => { const r = region(), kk = Math.min(r.w / W(), r.h / H()); el.style.width = W() * kk + "px"; el.style.height = H() * kk + "px"; el.style.left = r.x + (r.w - W() * kk) / 2 + "px"; el.style.top = r.y + (r.h - H() * kk) / 2 + "px"; el.firstChild.style.transform = `scale(${kk})`; el._k = kk; };
      const elOf = (id) => stage.querySelector(".sl:last-of-type .po[data-id=\"" + id + "\"]");
      const cur = () => stage.querySelector(".sl:last-of-type");
      /* ink canvas */
      const mkInk = (el, i) => { const c = document.createElement("canvas"); c.className = "ink"; c.width = W(); c.height = H(); c.style.cssText = `width:100%;height:100%`; el.append(c); el._ink = c; ink[i] = ink[i] || []; redraw(c, i); const pt = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W(), ((e.clientY - r.top) / r.height) * H()]; }; let drawing = null;
        c.onpointerdown = (e) => { if (!(tool === "pen" || tool === "hl" || tool === "er")) return; e.stopPropagation(); e.preventDefault(); c.setPointerCapture(e.pointerId); const p = pt(e); if (tool === "er") { erase(i, p, c); drawing = { er: true }; return; } drawing = { c: tool === "hl" ? color : color, w: tool === "hl" ? 26 : 4, hl: tool === "hl", pts: [p] }; ink[i].push(drawing); };
        c.onpointermove = (e) => { if (!drawing) return; e.stopPropagation(); const p = pt(e); if (drawing.er) { erase(i, p, c); return; } drawing.pts.push(p); redraw(c, i); }; c.onpointerup = (e) => { if (drawing) { e.stopPropagation(); drawing = null; } }; c.onclick = (e) => e.stopPropagation(); };
      const redraw = (c, i) => { const g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height); g.lineCap = "round"; g.lineJoin = "round"; (ink[i] || []).forEach((s) => { if (s.pts.length < 1) return; g.globalAlpha = s.hl ? 0.38 : 1; g.strokeStyle = s.c; g.lineWidth = s.w; g.beginPath(); g.moveTo(s.pts[0][0], s.pts[0][1]); s.pts.forEach((p) => g.lineTo(p[0], p[1] + 0.01)); g.stroke(); }); g.globalAlpha = 1; };
      const erase = (i, p, c) => { ink[i] = (ink[i] || []).filter((s) => !s.pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 24)); redraw(c, i); };
      const setTool = (t) => { tool = t; ov.classList.remove("pen", "hl", "er", "laser"); if (t !== "arrow") ov.classList.add(t); ov.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === t)); };
      const nextIdx = (p, d) => { let i = p + d; while (i >= 0 && i < D.slides.length && !vis(i)) i += d; return i >= 0 && i < D.slides.length ? i : -1; };
      const notesFor = (i) => D.slides[i].notes || "(No notes for this slide.)";
      const updatePv = () => { cntEl.textContent = idxs.indexOf(pos) + 1 + " / " + idxs.length; ov.querySelector(".cnt2").textContent = "Slide " + (idxs.indexOf(pos) + 1) + " of " + idxs.length + (steps.length ? " · step " + Math.min(stepI, steps.length) + "/" + steps.length : ""); ntEl.textContent = notesFor(pos); const n = nextIdx(pos, 1); nx.innerHTML = ""; if (n >= 0) { nx.style.height = ((nx.clientWidth || 300) * H()) / W() + "px"; const inner = document.createElement("div"); inner.className = "psl"; inner.style.cssText = "transform-origin:0 0"; P.renderSlide(inner, D.slides[n], th(), false); nx.append(inner); inner.style.transform = `scale(${(nx.clientWidth || 300) / W()})`; } else nx.textContent = "End of show"; };
      const runLink = (l) => { if (l.t === "url") window.open(l.v, "_blank", "noopener"); else if (l.t === "slide") goTo(+l.v - 1, 1); else if (l.t === "next") nextS(); else if (l.t === "prev") prevS(); else if (l.t === "first") goTo(idxs[0], -1); else if (l.t === "last") goTo(idxs[idxs.length - 1], 1); else if (l.t === "end") stop(); };
      function load(p, dir, instant) {
        pos = p; const s = D.slides[pos], old = stage.querySelector(".sl"); const el = document.createElement("div"); el.className = "sl"; el.innerHTML = '<div class="psl" style="transform-origin:0 0"></div>'; P.renderSlide(el.firstChild, s, th(), false); layout(el); const tr = !instant && s.trans && s.trans !== "none" && dir > 0 ? s.trans : ""; if (tr) { el.style.setProperty("--td", (s.tdur || 0.5) + "s"); el.classList.add("anim-" + tr); } stage.appendChild(el); mkInk(el, pos);
        if (old) setTimeout(() => old.remove(), tr ? (s.tdur || 0.5) * 1000 + 100 : 0); steps = stepsOf(s); stepI = 0; if (dir > 0 || dir === 0) hideInitial(s, el.firstChild); else { /* going back: final state */ } black = false; white = false; ov.style.background = "#000";
        el.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest("[data-lnk]"); if (t && tool !== "pen" && tool !== "hl" && tool !== "er") { e.stopPropagation(); try { runLink(JSON.parse(t.dataset.lnk)); } catch (x) { /* ignore */ } } });
        updatePv(); clearTimeout(autoT); if (D.show.timings !== false && s.auto > 0) autoT = setTimeout(() => nextS(true), s.auto * 1000 + (tr ? (s.tdur || 0.5) * 1000 : 0));
        if (steps.length && dir >= 0 && steps[0][0].trig !== "click") { stepI = 0; runNext(); }
      }
      const goTo = (p, dir) => { if (p < 0 || p >= D.slides.length) return; if (!vis(p)) { const q = nextIdx(p, dir || 1); if (q < 0) return; p = q; } load(p, dir || 1); };
      async function runNext() { if (busy || stepI >= steps.length) return false; busy = true; const k = stepI++; await playStep(steps[k], (id) => { const e = cur(); return e && e.querySelector(`.po[data-id="${id}"]`); }, W(), H()); busy = false; updatePv(); if (stepI < steps.length && steps[stepI][0].trig !== "click") runNext(); return true; }
      function stop() { clearTimeout(autoT); clearInterval(tickT); document.removeEventListener("keydown", key, true); window.removeEventListener("resize", rs); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); ov.remove(); X.inShow = false; P.go(pos); P.stEl.focus({ preventScroll: true }); }
      function nextS(auto) { if (busy && !auto) return; if (!auto && stepI < steps.length) { runNext(); return; } const n = nextIdx(pos, 1); if (n >= 0) load(n, 1); else if (D.show.loop) load(idxs[0], 1); else stop(); }
      function prevS() { const p = nextIdx(pos, -1); if (p >= 0) load(p, -1); }
      const key = (e) => {
        const k2 = e.key, ctrl = e.ctrlKey || e.metaKey; if (ctrl && /^[plaePLAE]$/.test(k2)) { setTool({ p: "pen", l: "laser", a: "arrow", e: "er" }[k2.toLowerCase()]); } else if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"].includes(k2)) { if (k2 === "Enter" && numBuf) { const n = +numBuf - 1; numBuf = ""; goTo(n, -1); } else nextS(); } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].includes(k2) && !ctrl) prevS(); else if (k2 === "Escape") { if (tool !== "arrow") setTool("arrow"); else stop(); } else if (k2 === "Home") goTo(idxs[0], -1); else if (k2 === "End") goTo(idxs[idxs.length - 1], 1); else if (/^[bB.]$/.test(k2)) { black = !black; white = false; stage.style.visibility = black ? "hidden" : ""; ov.style.background = "#000"; } else if (/^[wW,]$/.test(k2)) { white = !white; black = false; stage.style.visibility = white ? "hidden" : ""; ov.style.background = white ? "#fff" : "#000"; } else if (/^[sS]$/.test(k2)) togglePv(); else if (/^[eE]$/.test(k2) && !ctrl) { ink[pos] = []; const c = cur() && cur()._ink; if (c) redraw(c, pos); } else if (/^\d$/.test(k2)) numBuf += k2; else return; e.preventDefault(); e.stopPropagation();
      };
      const togglePv = () => { ov.classList.toggle("pv"); stage.querySelectorAll(".sl").forEach(layout); updatePv(); };
      const rs = () => { stage.querySelectorAll(".sl").forEach(layout); updatePv(); }; document.addEventListener("keydown", key, true); window.addEventListener("resize", rs);
      ov.addEventListener("mousemove", (e) => { ov.classList.add("mv"); clearTimeout(mvT); mvT = setTimeout(() => ov.classList.remove("mv"), 1800); if (tool === "laser") { const r = ov.getBoundingClientRect(); ldot.style.left = e.clientX - r.left + "px"; ldot.style.top = e.clientY - r.top + "px"; } });
      ov.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("button"); if (a) { if (a.dataset.a === "p") prevS(); else if (a.dataset.a === "n") nextS(); else if (a.dataset.a === "x") stop(); else if (a.dataset.a === "pv") togglePv(); else if (a.dataset.a === "b") key({ key: "b", preventDefault() {}, stopPropagation() {} }); else if (a.dataset.t) setTool(a.dataset.t); else if (a.dataset.c) { color = a.dataset.c; if (tool === "arrow" || tool === "laser") setTool("pen"); } return; } if (e.target.closest && e.target.closest(".pvp")) return; if (tool === "pen" || tool === "hl" || tool === "er") return; nextS(); });
      ov.addEventListener("contextmenu", (e) => { e.preventDefault(); prevS(); });
      tickT = setInterval(() => { const sec = Math.floor((Date.now() - t0) / 1000); const el = ov.querySelector(".el"), ck = ov.querySelector(".ck"); if (el) el.textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); if (ck) ck.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }, 500);
      if (opt.pv) ov.classList.add("pv"); if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {}); load(pos, 0, true); ov.focus();
    };
  });
})();
(function(){const s=document.createElement("style");s.textContent=".pshow.pv .bar{left:32%}";document.head.append(s);})();
