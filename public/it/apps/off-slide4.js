/* KMR Office Suite - Presentations, part 4: custom shows, several slide layouts, recording (narration + timings), spelling help. */
(function () {
  "use strict";
  const { form, esc } = OffUI; if (!OffUI.IC.spell) OffUI.IC.spell = '<path d="M4 18l4-12 4 12M5.5 14h5M14 14l3 3 5-6"/>';
  (window.OffSlideP = window.OffSlideP || []).push(function (P) {
    const { X, D, api, tabs, uid } = P, say = (m, ok) => api.say(m, ok), anchor = api.rib, sl = P.sl;
    D.shows = D.shows || []; D.layouts = D.layouts || [];
    const tab = (id) => tabs.find((t) => t.id === id);
    const real = () => D.slides.filter((s) => !s.master);

    /* ---------------- custom shows ---------------- */
    const parseNums = (txt, max) => { const out = []; String(txt).split(/[,;\s]+/).forEach((p) => { const m = /^(\d+)(?:-(\d+))?$/.exec(p.trim()); if (!m) return; const a = +m[1], b = m[2] ? +m[2] : a; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= max) out.push(i); }); return out; };
    const numsOf = (cs) => { const r = real(); return cs.ids.map((id) => r.findIndex((s) => s.id === id) + 1).filter((n) => n > 0); };
    const playShow = (cs) => { const only = cs.ids.map((id) => D.slides.findIndex((s) => s.id === id)).filter((i) => i >= 0 && !D.slides[i].master); if (!only.length) { say("None of the slides in this custom show exist any more."); return; } X.show(only[0], { only }); };
    function showForm(cs) {
      const r = real();
      form(anchor, cs ? "Edit custom show" : "New custom show", [{ k: "n", label: "Name of the show", value: cs ? cs.name : "" }, { k: "s", label: "Slide numbers, in the order to show them (e.g. 1,3,5-7). This deck has " + r.length + " slides.", value: cs ? numsOf(cs).join(",") : "" }], "Save", (v) => {
        const nm = String(v.n || "").trim(), nums = parseNums(v.s, r.length); if (!nm || !nums.length) { say("Give the show a name and at least one slide number."); return; }
        P.mod(() => { const ids = nums.map((n) => r[n - 1].id); if (cs) { cs.name = nm; cs.ids = ids; } else D.shows.push({ id: "cs" + uid(), name: nm, ids }); }); say("Custom show saved. Slide Show ▸ Custom show ▸ choose it to play only those slides.", true);
      });
    }
    const showItems = () => {
      const l = []; if (D.shows.length) { l.push({ hd: "Play" }); D.shows.forEach((c) => l.push({ label: c.name + " (" + c.ids.length + " slides)", i: "pres", run: () => playShow(c) })); l.push("-"); }
      l.push({ label: "New custom show…", run: () => showForm(null) }); D.shows.forEach((c) => { l.push({ label: "Edit “" + c.name + "”…", run: () => showForm(c) }); l.push({ label: "Delete “" + c.name + "”", run: () => P.mod(() => { D.shows = D.shows.filter((x) => x !== c); }) }); });
      return l;
    };
    const show = tab("show");
    const startRec = async (kind) => {
      if (kind === "audio") {
        let stream = null; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { say("I can’t reach the microphone. Allow microphone access for this site, or choose “Rehearse timings” instead."); return; }
        say("Recording. Present as normal: press Next to move on. Press Esc or End show when you finish.", true); X.show(0, { rec: "audio", stream });
      } else { say("Rehearsing. Present as normal; the time you spend on each slide is saved. Press Esc or End show when you finish.", true); X.show(0, { rec: "time" }); }
    };
    if (show) show.groups.push({ label: "Custom and record", items: [{ k: "menu", i: "pres", label: "Custom show", big: true, t: "Make a shorter version of the deck for one audience", items: showItems }, { k: "menu", i: "audio", label: "Record", big: true, t: "Record your voice and the time spent on each slide", items: () => [{ label: "Record narration and timings (uses the microphone)", run: () => startRec("audio") }, { label: "Rehearse timings only", run: () => startRec("time") }, "-", { label: "Remove all narration", run: () => P.mod(() => { real().forEach((s) => { delete s.nar; }); }) }, { label: "Remove all slide timings", run: () => P.mod(() => { real().forEach((s) => { delete s.auto; }); }) }] }] });

    /* ---------------- slide layouts ---------------- */
    function newLayout() {
      form(anchor, "New slide layout", [{ k: "n", label: "Name (e.g. Title slide, Photo page, Closing)", value: "Layout " + (D.layouts.length + 1) }], "Create and edit", (v) => {
        const nm = String(v.n || "").trim() || "Layout"; const id = "ly" + uid(); P.mod(() => D.layouts.push({ id, name: nm, bg: null, objs: [] })); if (X.masterEditing()) X.exitMaster(); X.enterMaster(id);
        say("Editing the layout “" + nm + "”. Add a logo, footer or background that only slides using this layout show. Press “Close master view” when done.", true);
      });
    }
    const layItems = () => {
      const cur = sl() || {}, l = [{ hd: "Use on this slide" }, { label: "Default (slide master only)", on: !cur.lay, run: () => { P.mod(() => { delete cur.lay; }); P.drawAll(); } }];
      D.layouts.forEach((x) => l.push({ label: x.name, on: cur.lay === x.id, run: () => { P.mod(() => { cur.lay = x.id; }); P.drawAll(); } }));
      l.push("-", { label: "New layout…", run: newLayout });
      D.layouts.forEach((x) => { l.push({ label: "Edit “" + x.name + "”", run: () => { if (X.masterEditing()) X.exitMaster(); X.enterMaster(x.id); } }); l.push({ label: "Rename “" + x.name + "”…", run: () => form(anchor, "Rename layout", [{ k: "n", label: "Name", value: x.name }], "Rename", (v) => { if (String(v.n).trim()) P.mod(() => { x.name = String(v.n).trim(); }); }) }); l.push({ label: "Delete “" + x.name + "”", run: () => { P.mod(() => { D.layouts = D.layouts.filter((q) => q !== x); real().forEach((s) => { if (s.lay === x.id) delete s.lay; }); }); P.drawAll(); } }); });
      return l;
    };
    const lg = { label: "Layouts", items: [{ k: "menu", i: "layout", label: "Layouts", big: true, t: "Several designs for different kinds of slide: choose one per slide", items: layItems }] };
    const view = tab("view"); if (view) view.groups.push(lg);
    const mt = tab("master"); if (mt) mt.groups.push(lg);
    const home = tab("home"); if (home) home.groups.push({ label: "Layout", items: [{ k: "menu", i: "layout", label: "Layout", t: "Choose this slide's layout", items: layItems }] });

    /* ---------------- spelling help ---------------- */
    const plainOf = (h) => { const d = document.createElement("div"); d.innerHTML = String(h || "").replace(/<\/(p|div|li|h\d)>/gi, " ").replace(/<br\s*\/?>/gi, " "); return d.textContent || ""; };
    function spellReport() {
      const issues = []; real().forEach((s, i) => {
        const bits = []; (s.objs || []).forEach((o) => { if (o.tx) bits.push(plainOf(o.tx)); if (o.rows) o.rows.forEach((r) => r.forEach((c) => c && c.tx && bits.push(plainOf(c.tx)))); }); if (s.notes) bits.push(s.notes);
        bits.join(" \n ").split(/\n/).forEach((t) => { const rep = /\b([A-Za-z']{2,})\s+\1\b/i.exec(t); if (rep) issues.push(["Slide " + (i + 1), "Repeated word: “" + rep[0] + "”"]); if (/\S {2,}\S/.test(t)) issues.push(["Slide " + (i + 1), "Double space between words"]); if (/\s[,.;:!?]/.test(t)) issues.push(["Slide " + (i + 1), "Space before punctuation"]); if (/\bi\b(?!['’.])/.test(t) && /\bi (am|was|have|will|think|can)\b/.test(t)) issues.push(["Slide " + (i + 1), "The word “I” should be a capital"]); });
      });
      const html = `<div style="min-width:280px;max-width:380px;padding:4px"><b>Proof-reading check</b><div style="margin:6px 0;font-size:12px;color:var(--mut)">Red wavy lines under misspelt words appear while you type, using your browser’s dictionary (${D.spell === false ? "currently OFF" : "ON"}). This report also looks for repeated words, double spaces and spacing before punctuation.</div><div style="max-height:260px;overflow:auto">${issues.length ? issues.slice(0, 80).map((x) => `<div style="padding:4px 0;border-bottom:1px solid var(--line)"><b>${esc(x[0])}</b> — ${esc(x[1])}</div>`).join("") : "<div>No repeated words or spacing problems found.</div>"}</div><div style="margin-top:8px;text-align:right"><button class="btn o s of-no">Close</button></div></div>`;
      OffUI.pop(anchor, html, (m) => { m.querySelector(".of-no").onclick = OffUI.closeMenu; });
    }
    const rev = tab("review") || tab("view");
    if (rev) rev.groups.push({ label: "Proofing", items: [{ i: "spell", label: "Check", big: true, t: "Find repeated words and spacing mistakes", on: spellReport }, { i: "spell", label: "Spell as I type", t: "Red wavy line under misspelt words while typing", on: () => P.mod(() => (D.spell = D.spell === false)), act: () => D.spell !== false }] });
  });
})();
