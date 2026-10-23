/* KMR Office Suite - the app: Standards alignment (default), Files, Setup, and the editor window shared by Documents, Spreadsheets and Presentations.
   Data calls are kmr_off_* (database, migration 0084) or off-demo.js (?demo=1). Files are saved per company; every save keeps a revision. */
(function () {
  "use strict";
  const { $, esc, fmt, say, call } = QP, { ic } = OffUI, Z = window.OffZip;
  const O = (window.Office = window.Office || { editors: {} });
  const ORDER = ["doc", "sheet", "slide"], CODE = { doc: "DOC", sheet: "XLS", slide: "PPT" };
  const S = { L: null, files: [], f: { kind: "", q: "" }, open: null, chooser: null };
  const canEdit = () => !!QP.canEdit, isAdmin = () => S.L && S.L.role === "admin";
  const E = (k) => O.editors[k];
  const guard = async (fn) => { try { return await fn(); } catch (e) { say(e.message); return undefined; } };
  const hp = () => { const o = {}; location.hash.replace(/^#/, "").split("&").forEach((p) => { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); }); return o; };
  const setGo = (h) => history.replaceState(null, "", location.pathname + location.search + "#" + h);
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const when = (s) => { if (!s) return ""; const d = new Date(s); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const SECS = ["std", "files", "setup"];

  /* ================= router ================= */
  function route() {
    const g = hp().go, go = SECS.includes(g) ? g : "std";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    SECS.forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    if (go === "std") KMRStd.draw($("#std"), "off"); else if (go === "files") drawFiles(); else if (go === "setup") drawSetup();
  }
  window.addEventListener("hashchange", () => { if (!S.open) route(); });

  /* ================= Files ================= */
  async function loadList() { const r = await call("kmr_off_list", { p: { kind: S.f.kind, q: S.f.q } }); S.files = r.files || []; }
  async function drawFiles() {
    const el = $("#files"); const ed = canEdit();
    const kinds = ORDER.filter((k) => E(k));
    el.innerHTML = `<div class="guide">Write letters and procedures, build sheets and make presentations here. Your files are saved to your company automatically, with a revision every time, and open on any computer. You can also open .docx, .xlsx and .pptx files, and download your work in those formats.</div>
      ${ed ? `<div class="nw" id="nw">${kinds.map((k) => `<button data-n="${k}" style="--c:${E(k).color}"><span class="ib">${ic(E(k).icon)}</span><span><b>New ${E(k).label.toLowerCase()}</b><small>${esc(E(k).blurb || "")}</small></span></button>`).join("")}<button data-n="import" style="--c:#475569"><span class="ib">${ic("upload")}</span><span><b>Open a file</b><small>.docx, .xlsx, .pptx, .csv, .txt</small></span></button></div><div id="chooser"></div>` : ""}
      <div class="row" style="margin-top:14px"><input class="grow" id="f_q" placeholder="Search by name or number" value="${esc(S.f.q)}"><div class="seg" style="margin:0"><button data-k="" class="${S.f.kind ? "" : "on"}">All</button>${kinds.map((k) => `<button data-k="${k}" class="${S.f.kind === k ? "on" : ""}">${esc(E(k).plural)}</button>`).join("")}</div></div><div id="flist"><div class="empty">Loading…</div></div>
      <input type="file" id="f_imp" hidden multiple accept=".docx,.html,.htm,.txt,.md,.xlsx,.csv,.tsv,.pptx">`;
    if (ed) {
      el.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { if (b.dataset.n === "import") $("#f_imp").click(); else chooser(b.dataset.n); }));
      $("#f_imp").onchange = (e) => guard(() => importFiles([...e.target.files]));
    }
    let tm; $("#f_q").oninput = (e) => { S.f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(refreshList), 250); };
    el.querySelectorAll(".seg [data-k]").forEach((b) => (b.onclick = () => { S.f.kind = b.dataset.k; el.querySelectorAll(".seg [data-k]").forEach((x) => x.classList.toggle("on", x === b)); guard(refreshList); }));
    await refreshList();
  }
  async function refreshList() {
    await loadList(); const box = $("#flist"); if (!box) return; const ed = canEdit();
    box.innerHTML = S.files.length ? S.files.map((f) => { const k = E(f.kind) || { color: "#64748b", icon: "file", label: f.kind }; return `<div class="fl" data-id="${f.id}" style="--c:${k.color}"><span class="ib">${ic(k.icon)}</span><div><b>${esc(f.name)}</b><small>${esc(f.no)} · ${esc(k.label)} · revision ${f.rev} · ${esc(f.updated_by || "")} · ${esc(when(f.updated_at))} · ${kb(f.size || 0)}</small></div><span class="ac"></span>${ed ? `<span class="ac" style="display:flex;gap:6px"><button class="btn o s" data-a="dup" title="Make a copy">Copy</button><button class="btn o s" data-a="del">Delete</button></span>` : ""}</div>`; }).join("") : `<div class="empty">${S.f.q || S.f.kind ? "No files match." : "No files yet. Start with <b>New document</b> above, or open a file from your computer."}</div>`;
    box.querySelectorAll(".fl").forEach((r) => {
      r.onclick = (e) => { if (e.target.closest("button")) return; guard(() => openFile(r.dataset.id)); };
      r.querySelectorAll("button").forEach((b) => (b.onclick = () => {
        if (b.dataset.a === "dup") guard(async () => { const f = await call("kmr_off_get", { p_id: r.dataset.id }); const n = await call("kmr_off_save", { p: { kind: f.kind, name: f.name + " (copy)", body: f.body } }); say("Copy made.", true); await refreshList(); });
        if (b.dataset.a === "del") { if (b.dataset.sure) guard(async () => { await call("kmr_off_delete", { p_id: r.dataset.id }); say("Deleted.", true); await refreshList(); }); else { b.dataset.sure = 1; b.textContent = "Sure? Click again"; b.classList.add("danger"); setTimeout(() => { b.dataset.sure = ""; b.textContent = "Delete"; }, 3500); } }
      }));
    });
  }
  function chooser(kind) {
    const ed = E(kind), box = $("#chooser"); const t = ed.templates || [{ id: "blank", name: "Blank", desc: "" }];
    if (t.length < 2) { guard(() => create(kind, t[0].id, t[0].name)); return; }
    box.innerHTML = `<div class="card" style="margin-top:12px"><div class="row" style="margin:0 0 8px"><b>Choose a starting point for the new ${ed.label.toLowerCase()}</b><span style="flex:1"></span><button class="btn o s" id="c_x">Cancel</button></div><div class="tcards">${t.map((x) => `<button class="tcard" data-t="${x.id}"><b>${esc(x.name)}</b><small class="mut">${esc(x.desc || "")}</small></button>`).join("")}</div></div>`;
    $("#c_x").onclick = () => (box.innerHTML = ""); box.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => guard(() => create(kind, b.dataset.t, t.find((x) => x.id === b.dataset.t).name))));
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  async function create(kind, tid, label) {
    const ed = E(kind), body = ed.blank(tid, S.L.settings || {}); const name = tid === "blank" ? "Untitled " + ed.label.toLowerCase() : label;
    const r = await call("kmr_off_save", { p: { kind, name, body } }); await openFile(r.id);
  }
  const kindOf = (n) => { const e = (/\.([^.]+)$/.exec(n) || [])[1] || ""; if (/^(docx?|html?|txt|md)$/i.test(e)) return "doc"; if (/^(xlsx?|csv|tsv)$/i.test(e)) return "sheet"; if (/^pptx?$/i.test(e)) return "slide"; return null; };
  async function importFiles(list) {
    let last = null;
    for (const f of list) {
      const k = kindOf(f.name); if (!k || !E(k)) { say("“" + f.name + "” is not a type this app can open. Use .docx, .xlsx, .pptx, .csv or text files."); continue; }
      if (f.size > 25 * 1024 * 1024) { say("“" + f.name + "” is larger than 25 MB."); continue; }
      say("Opening " + f.name + "…", true); const r = await E(k).importFile(f);
      const saved = await call("kmr_off_save", { p: { kind: k, name: r.name, body: r.body } }); last = saved.id;
    }
    if (last) { say("", true); if (list.length === 1) await openFile(last); else { await refreshList(); say("Files opened and saved to your list.", true); } }
  }

  /* ================= editor window ================= */
  async function openFile(id) {
    const f = await call("kmr_off_get", { p_id: id }); if (!E(f.kind)) throw new Error("This kind of file is not available."); showEditor(f);
  }
  function showEditor(f) {
    const ed = E(f.kind), ro = !canEdit() || f.can_edit === false;
    const w = document.createElement("div"); w.className = "ofw"; w.id = "ofw"; w.setAttribute("data-nosno", ""); w.setAttribute("data-nofilter", ""); document.body.classList.add("oedit");
    w.innerHTML = `<div class="oft"><button class="back" title="Save and go back to the list">${ic("home")} Files</button><input class="nm" value="${esc(f.name)}" ${ro ? "readonly" : ""} aria-label="File name" maxlength="120"><span class="no">${esc(f.no)} · rev <b id="o_rev">${f.rev}</b></span><span class="sv" id="o_sv">${ro ? "Read only" : "Saved"}</span>
      <div class="tb">${ro ? "" : `<button id="o_save">${ic("save")} Save</button>`}<button id="o_dl">${ic("download")} Download</button><button id="o_pr">${ic("print")} Print / PDF</button><button id="o_hi">${ic("eye")} History</button></div></div>
      <div id="orib"></div><div class="owk" id="owk"></div><div class="ost" id="ost"></div>`;
    document.body.append(w); document.body.style.overflow = "hidden";
    let dirty = false, saving = false, again = false, timer = 0, ctrl = null; const sv = $("#o_sv");
    const setSv = (t, bad) => { sv.textContent = t; sv.classList.toggle("err", !!bad); };
    const api = {
      file: f, rib: $("#orib"), wk: $("#owk"), st: $("#ost"), root: w, ro, me: (S.L && S.L.me) || "", say,
      changed() { if (ro) return; dirty = true; setSv("Unsaved changes…"); clearTimeout(timer); timer = setTimeout(() => doSave(), 3500); },
      save: () => doSave(true)
    };
    async function doSave(manual) {
      if (ro || !ctrl) return; if (saving) { again = true; return; } if (!dirty && !manual) return;
      saving = true; clearTimeout(timer); setSv("Saving…");
      try {
        const body = ctrl.body(), r = await call("kmr_off_save", { p: { id: f.id, kind: f.kind, name: f.name, body, rev: f.rev } });
        f.rev = r.rev; f.no = r.no; $("#o_rev").textContent = r.rev; dirty = again; setSv("Saved " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      } catch (e) { setSv(/changed by/i.test(e.message) ? "Not saved: someone else changed this file" : "Not saved: " + e.message, true); say(e.message); }
      saving = false; if (again) { again = false; doSave(); }
    }
    const nm = w.querySelector(".nm"); nm.onchange = () => { f.name = nm.value.trim() || f.name; nm.value = f.name; api.changed(); };
    ctrl = ed.mount(api); if (ro && ctrl.setReadOnly) ctrl.setReadOnly();
    const exp = ed.exports || [];
    $("#o_dl").onclick = (e) => OffUI.menu(e.currentTarget, exp.map((x) => ({ label: x.label, run: () => guard(async () => { await doSave(); await x.run(ctrl); }) })));
    $("#o_pr").onclick = () => ctrl.print(); const sb = $("#o_save"); if (sb) sb.onclick = () => doSave(true);
    $("#o_hi").onclick = (e) => guard(async () => {
      const vs = await call("kmr_off_versions", { p_id: f.id }); const anchor = e.currentTarget;
      OffUI.pop(anchor, `<div style="min-width:300px;max-width:420px"><b>Revisions of ${esc(f.no)}</b><div style="margin-top:6px">${vs.length ? vs.map((v) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line)"><span style="flex:1"><b>Rev ${v.rev}</b><br><small class="mut">${esc(when(v.at))} · ${esc(v.by || "")}</small></span>${ro || v.rev === f.rev ? "" : `<button class="btn o s" data-r="${v.rev}" style="width:auto">Restore</button>`}</div>`).join("") : '<p class="mut">Only the current revision exists.</p>'}</div><p class="mut" style="font-size:12px;margin:8px 0 0">Restoring makes that revision the newest one; nothing is lost.</p></div>`, (m) => m.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => guard(async () => { OffUI.closeMenu(); await doSave(); const n = await call("kmr_off_restore", { p_id: f.id, p_rev: +b.dataset.r }); close(true); await openFile(f.id); say("Revision " + b.dataset.r + " restored as the newest.", true); }))));
    });
    window.onbeforeunload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    document.addEventListener("visibilitychange", vis); function vis() { if (document.hidden && dirty) doSave(); }
    const kd = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(true); } }; document.addEventListener("keydown", kd);
    async function close(skip) {
      if (!skip && dirty) await doSave(true); if (dirty && !skip) { if (!confirm("Your last changes could not be saved. Leave anyway?")) return; }
      clearTimeout(timer); ctrl && ctrl.destroy && ctrl.destroy(); w.remove(); document.body.style.overflow = ""; document.body.classList.remove("oedit"); window.onbeforeunload = null; document.removeEventListener("visibilitychange", vis); document.removeEventListener("keydown", kd); OffUI.closeMenu(); S.open = null;
      if (!skip) { const h = hp(); setGo("go=files"); route(); }
    }
    w.querySelector(".back").onclick = () => close(false); S.open = { f, close };
    setGo("go=files&id=" + f.id);
  }

  /* ================= Setup ================= */
  async function drawSetup() {
    const el = $("#setup"); if (!isAdmin()) { el.innerHTML = '<div class="empty">Only an administrator can change the setup.</div>'; return; }
    const s = S.L.settings || {};
    el.innerHTML = `<div class="guide">These settings apply to the whole company.</div><div class="sg"><div><label>File number prefix</label><input id="s_pf" value="${esc(s.prefix || "OFF")}" maxlength="10"></div><div><label>Default page size for new documents</label><select id="s_ps">${["A4", "A3", "A5", "Letter", "Legal"].map((x) => `<option${(s.page_size || "A4") === x ? " selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="w"><label>Default header text for new documents</label><input id="s_hd" value="${esc(s.header || "")}" placeholder="for example: ${esc((QP.ctx && QP.ctx.company) || "Company name")} — Confidential"></div><div class="w"><label>Default footer text for new documents</label><input id="s_ft" value="${esc(s.footer || "")}"></div>
      <div class="w"><label class="cl"><input type="checkbox" id="s_fy"${s.fy_numbering === false ? "" : " checked"}> <span>Number files by financial year (April to March), for example OFF-DOC/26-27/0001</span></label></div></div><div class="row" style="margin-top:12px"><button class="btn" id="s_save">Save setup</button></div>`;
    $("#s_save").onclick = () => guard(async () => { await call("kmr_off_settings_save", { p: { prefix: $("#s_pf").value, page_size: $("#s_ps").value, header: $("#s_hd").value, footer: $("#s_ft").value, fy_numbering: $("#s_fy").checked } }); S.L = await call("kmr_off_load"); say("Saved.", true); });
  }

  /* ================= start ================= */
  window.OFFAPP = { S, route, openFile };
  async function start() {
    try {
      await QP.init("off"); if (!QP.ctx) return;
      S.L = await call("kmr_off_load"); $("#role").textContent = S.L.role;
      const st = document.querySelector('.tab[data-t="setup"]'); if (st && !isAdmin()) st.classList.add("hide");
      route(); const id = hp().id; if (id && hp().go === "files") guard(() => openFile(id));
    } catch (e) { say(e.message); }
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
