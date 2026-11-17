/* KMR part drawings — ONE shared library of customer drawings, kept against the part number.
   Upload once in Operations Master → Parts; every app (8D, PPAP, Process Documents, Balloon Inspector…) opens the same files.
   Files live in the private storage bucket "kmr-draw"; each open uses a short-lived signed link.
   Usage:  KMRDrawings.chip(hostEl, {sb, slug, part, name})      small "Drawings (n)" button for any part number
           KMRDrawings.panel(hostEl, {sb, slug, part, name})     full list + upload for one part
           KMRDrawings.library(hostEl, {sb, slug, parts})        bulk upload of many files / a whole folder
           KMRDrawings.pick({sb, slug, part}, cb)                choose a drawing, get it back as a File (for Balloon Inspector) */
(function () {
  const BUCKET = "kmr-draw", MAX = 50 * 1024 * 1024;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const key = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const KINDS = [["drawing", "Customer drawing"], ["model", "3D model"], ["spec", "Specification"], ["other", "Other"]];
  const kname = (k) => (KINDS.find((x) => x[0] === k) || KINDS[3])[1];
  const size = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
  const slugOf = (o) => o.slug || (() => { try { return JSON.parse(localStorage.getItem("kmr-portal") || "null").slug; } catch (e) { return null; } })();
  const css = "font:14px/1.4 system-ui,sans-serif;color:#0f172a";
  const btn = (extra) => "border:0;border-radius:9px;padding:7px 13px;font-weight:700;cursor:pointer;background:#1E4FB8;color:#fff;" + (extra || "");
  const ghost = "border:1px solid #CBD5E1;border-radius:9px;padding:6px 12px;font-weight:600;cursor:pointer;background:#fff;color:#0f172a";
  const inp = "border:1px solid #CBD5E1;border-radius:8px;padding:6px 8px;font:inherit;min-width:0";

  async function rpc(o, fn, args) {
    const r = await o.sb.rpc(fn, Object.assign({ p_slug: slugOf(o) }, args || {}));
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  const api = {
    key, kname, KINDS,
    list: (o, part) => rpc(o, "kmr_part_draw_list", part ? { p_part: part } : {}),
    counts: (o) => rpc(o, "kmr_part_draw_counts"),
    async url(o, path) { const s = await o.sb.storage.from(BUCKET).createSignedUrl(path, 300); if (s.error) throw new Error(s.error.message); return s.data.signedUrl; },
    async open(o, it) { const w = window.open("", "_blank"); try { const u = await api.url(o, it.path); if (w) w.location = u; else window.location = u; } catch (e) { if (w) w.close(); alert(e.message || e); } },
    async file(o, it) { const u = await api.url(o, it.path), r = await fetch(u); if (!r.ok) throw new Error("Could not download " + it.file_name); const b = await r.blob(); return new File([b], it.file_name || "drawing.pdf", { type: it.mime || b.type || "application/pdf" }); },
    async upload(o, cid, file, meta) {
      if (file.size > MAX) throw new Error(file.name + " is over 50 MB.");
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_"), path = `customers/${cid}/draw/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
      const up = await o.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw new Error(up.error.message);
      try {
        return await rpc(o, "kmr_part_draw_add", { p: { part_no: meta.part_no, rev: meta.rev || "", title: meta.title || file.name.replace(/\.[^.]+$/, ""), kind: meta.kind || "drawing", path, file_name: file.name, mime: file.type || "", size_bytes: file.size } });
      } catch (e) { await o.sb.storage.from(BUCKET).remove([path]); throw e; }
    },
  };


  /* ---------- read a .zip on the device (no upload of the zip itself): list its files, inflate each only when it is uploaded ---------- */
  api.zip = async function (zf) {
    const u8 = new Uint8Array(await zf.slice(Math.max(0, zf.size - 66000)).arrayBuffer()), dv = new DataView(u8.buffer);
    let e = -1; for (let i = u8.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("This is not a valid zip file.");
    const n = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true);
    const cd = new DataView(await zf.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder(), out = []; let p = 0;
    for (let i = 0; i < n && cd.getUint32(p, true) === 0x02014b50; i++) {
      const method = cd.getUint16(p + 10, true), csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true), nl = cd.getUint16(p + 28, true), el = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), off = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, p + 46, nl)); p += 46 + nl + el + cl;
      if (name.endsWith("/") || /(^|\/)(__MACOSX|\.[^/]*$|thumbs\.db$)/i.test(name)) continue;
      const base = name.split("/").pop();
      out.push({ name: base, webkitRelativePath: name, size: usize, type: /\.pdf$/i.test(base) ? "application/pdf" : "", _get: async () => {
        const lh = new DataView(await zf.slice(off, off + 30).arrayBuffer()), start = off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), raw = zf.slice(start, start + csize);
        const blob = method === 0 ? raw : await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
        return new File([blob], base, { type: /\.pdf$/i.test(base) ? "application/pdf" : blob.type });
      } });
    }
    return out;
  };

  /* ---------- one part: list + upload ---------- */
  api.panel = async function (host, o) {
    host.innerHTML = `<div style="${css}"><span style="color:#64748B">Loading drawings…</span></div>`;
    let d; try { d = await api.list(o, o.part); } catch (e) { host.innerHTML = `<div style="${css};color:#B00E28">${esc(e.message)}</div>`; return; }
    const items = d.items || [], can = !!d.can_edit;
    host.innerHTML = `<div style="${css}">
      ${items.length ? `<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:#64748B;font-size:12px"><th style="padding:4px 6px">Title</th><th style="padding:4px 6px;width:70px">Rev</th><th style="padding:4px 6px;width:130px">Type</th><th style="padding:4px 6px;width:70px">Size</th><th></th></tr></thead><tbody>
      ${items.map((it) => `<tr data-id="${it.id}" style="border-top:1px solid #E2E8F0"><td style="padding:6px">${can ? `<input data-f="title" value="${esc(it.title || "")}" style="${inp};width:100%">` : `<b>${esc(it.title || it.file_name)}</b>`}<div style="font-size:11px;color:#64748B">${esc(it.file_name)}</div></td>
        <td style="padding:6px">${can ? `<input data-f="rev" value="${esc(it.rev || "")}" style="${inp};width:60px">` : esc(it.rev || "—")}</td>
        <td style="padding:6px">${can ? `<select data-f="kind" style="${inp}">${KINDS.map((k) => `<option value="${k[0]}" ${k[0] === it.kind ? "selected" : ""}>${k[1]}</option>`).join("")}</select>` : esc(kname(it.kind))}</td>
        <td style="padding:6px;color:#64748B">${size(it.size_bytes)}</td>
        <td style="padding:6px;text-align:right;white-space:nowrap"><button data-open style="${btn("padding:5px 11px")}">Open</button>${can ? ` <button data-save style="${ghost};display:none">Save</button> <button data-del style="${ghost};color:#B00E28">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table>`
        : `<p style="color:#64748B;margin:4px 0 10px">No drawing is saved for <b>${esc(o.part)}</b> yet.${can ? "" : " Ask an editor to upload it in Operations Master → Parts."}</p>`}
      ${can ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label style="${btn()}">+ Upload drawing(s)<input type="file" id="pdUp" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.dwg,.dxf,.step,.stp,.igs,.iges,.xlsx,.docx" hidden></label><span id="pdMsg" style="font-size:13px;color:#64748B">PDF, image, DWG/DXF or 3D file, up to 50 MB each. Stored privately for your company only.</span></div>` : ""}</div>`;
    const by = (id) => items.find((x) => x.id === id);
    host.querySelectorAll("tr[data-id]").forEach((tr) => {
      const it = by(tr.dataset.id), sv = tr.querySelector("[data-save]");
      tr.querySelector("[data-open]").onclick = () => api.open(o, it);
      tr.querySelectorAll("[data-f]").forEach((el) => (el.oninput = el.onchange = () => { sv.style.display = ""; }));
      if (sv) sv.onclick = async () => { try { sv.disabled = true; await rpc(o, "kmr_part_draw_save", { p_id: it.id, p: { part_no: it.part_no, rev: tr.querySelector('[data-f="rev"]').value.trim(), title: tr.querySelector('[data-f="title"]').value.trim(), kind: tr.querySelector('[data-f="kind"]').value } }); api.panel(host, o); } catch (e) { sv.disabled = false; alert(e.message || e); } };
      const dl = tr.querySelector("[data-del]");
      if (dl) dl.onclick = async () => {
        if (dl.dataset.arm !== "1") { dl.dataset.arm = "1"; dl.textContent = "Click again to delete"; setTimeout(() => { dl.dataset.arm = ""; dl.textContent = "Delete"; }, 4000); return; }
        try { const p = await rpc(o, "kmr_part_draw_delete", { p_id: it.id }); if (p) await o.sb.storage.from(BUCKET).remove([p]); api.panel(host, o); } catch (e) { alert(e.message || e); }
      };
    });
    const up = host.querySelector("#pdUp");
    if (up) up.onchange = async () => {
      const msg = host.querySelector("#pdMsg"), fl = [...up.files]; let n = 0;
      try { for (const f of fl) { msg.textContent = `Uploading ${++n} of ${fl.length}: ${f.name}…`; await api.upload(o, d.customer_id, f, { part_no: o.part }); } api.panel(host, o); if (o.onChange) o.onChange(); }
      catch (e) { msg.style.color = "#B00E28"; msg.textContent = e.message || String(e); }
    };
  };

  /* ---------- small window helper ---------- */
  function win(title, sub) {
    const v = document.createElement("div");
    v.style.cssText = "position:fixed;inset:0;background:#0009;z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px";
    v.innerHTML = `<div style="background:#fff;border-radius:14px;width:min(860px,100%);max-height:88vh;overflow:auto;padding:18px;${css}"><div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><h3 style="margin:0">${esc(title)}</h3>${sub ? `<div style="color:#64748B;font-size:13px">${esc(sub)}</div>` : ""}</div><button style="${ghost}" data-x>Close</button></div><div data-b style="margin-top:12px"></div></div>`;
    document.body.appendChild(v);
    const close = () => v.remove(); v.querySelector("[data-x]").onclick = close; v.addEventListener("mousedown", (e) => { if (e.target === v) close(); });
    return { body: v.querySelector("[data-b]"), close };
  }

  /* ---------- a "Drawings (n)" button for any app ---------- */
  api.chip = async function (host, o) {
    if (!o.part || !o.sb) { host.innerHTML = ""; return; }
    let n = null;
    try { const c = await api.counts(o); n = c[key(o.part)] || 0; } catch (e) { host.innerHTML = ""; return; }
    host.innerHTML = `<button type="button" style="${ghost};${n ? "" : "color:#64748B"}">📐 Drawings (${n})</button>`;
    host.firstChild.onclick = () => { const w = win("Drawings — " + o.part, o.name || "Kept in Operations Master → Parts; shared by every KMR app."); api.panel(w.body, Object.assign({}, o, { onChange: () => api.chip(host, o) })); };
  };

  /* ---------- choose a drawing and get it back as a File (Balloon Inspector) ---------- */
  api.pick = async function (o, cb) {
    const w = win("Customer drawings", o.part ? "Part " + o.part : "All parts");
    w.body.innerHTML = '<span style="color:#64748B">Loading…</span>';
    let d; try { d = await api.list(o, o.part || null); } catch (e) { w.body.innerHTML = `<span style="color:#B00E28">${esc(e.message)}</span>`; return; }
    const items = (d.items || []).filter((i) => /\.(pdf|png|jpe?g|tiff?)$/i.test(i.file_name || ""));
    if (!items.length) { w.body.innerHTML = `<p>No drawing saved ${o.part ? "for <b>" + esc(o.part) + "</b> " : ""}yet. Upload it in <b>Operations Master → Parts</b>.</p>`; return; }
    w.body.innerHTML = `<input id="pkQ" placeholder="Search part, title or file…" style="${inp};width:100%;margin-bottom:8px"><div id="pkL"></div>`;
    const draw = (q) => {
      const f = items.filter((i) => !q || (i.part_no + " " + i.title + " " + i.file_name + " " + i.rev).toLowerCase().includes(q.toLowerCase())).slice(0, 200);
      w.body.querySelector("#pkL").innerHTML = f.map((i) => `<div style="display:flex;gap:8px;align-items:center;border-top:1px solid #E2E8F0;padding:6px 0"><div style="flex:1"><b>${esc(i.part_no)}</b> ${i.rev ? "rev " + esc(i.rev) : ""} · ${esc(i.title || i.file_name)}<div style="font-size:11px;color:#64748B">${esc(i.file_name)} · ${size(i.size_bytes)}</div></div><button data-i="${i.id}" style="${btn("padding:5px 11px")}">Use this drawing</button></div>`).join("") || '<p style="color:#64748B">Nothing matches.</p>';
      w.body.querySelectorAll("[data-i]").forEach((b) => (b.onclick = async () => { b.disabled = true; b.textContent = "Loading…"; try { const it = items.find((x) => x.id === b.dataset.i); const f = await api.file(o, it); w.close(); cb(f, it); } catch (e) { b.disabled = false; b.textContent = "Use this drawing"; alert(e.message || e); } }));
    };
    draw(""); w.body.querySelector("#pkQ").oninput = (e) => draw(e.target.value);
  };

  /* ---------- bulk upload: many files or a whole folder, part number checked before saving ---------- */
  api.library = async function (host, o) {
    host.innerHTML = `<div style="${css}">Loading…</div>`;
    let d, counts; try { d = await api.list(o); counts = await api.counts(o); } catch (e) { host.innerHTML = `<div style="${css};color:#B00E28">${esc(e.message)}</div>`; return; }
    const can = !!d.can_edit, items = d.items || [], parts = o.parts || [];
    const pk = parts.flatMap((p) => [{ code: p.code, k: key(p.code) }, ...(p.dn && key(p.dn) !== key(p.code) ? [{ code: p.code, k: key(p.dn) }] : [])]).filter((p) => p.k.length >= 5).sort((a, b) => b.k.length - a.k.length);
    const guess = (f) => { const path = key((f.webkitRelativePath || "") + " " + f.name), h = pk.find((p) => path.includes(p.k)); return h ? h.code : ""; };
    const revOf = (n) => { const m = n.match(/(?:rev(?:ision)?|[-_ ]r)[ ._-]?([A-Za-z0-9]{1,3})(?=[^A-Za-z0-9]|$)/i); return m ? m[1].toUpperCase() : ""; };
    host.innerHTML = `<div style="${css}">
      <h2 style="margin:0 0 4px">📐 Customer drawings</h2>
      <p style="color:#64748B;margin:0 0 12px">${items.length} drawing${items.length === 1 ? "" : "s"} saved for ${Object.keys(counts).length} part${Object.keys(counts).length === 1 ? "" : "s"}. Upload once here — PPAP, Process Documents, Balloon Inspector, 8D and the other apps open the same file.</p>
      ${can ? `<div style="border:1px solid #E2E8F0;border-radius:12px;padding:12px;margin-bottom:14px"><b>Add drawings</b>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><label style="${btn()}">Choose files<input type="file" id="dlF" multiple hidden></label><label style="${btn("background:#334155")}">Choose a whole folder<input type="file" id="dlD" webkitdirectory multiple hidden></label><label style="${btn("background:#0F766E")}">Choose a .zip file<input type="file" id="dlZ" accept=".zip,application/zip" hidden></label></div>
        <div id="dlPrev"></div></div>` : ""}
      <input id="dlQ" placeholder="Search by part number, title or file…" style="${inp};width:100%;margin-bottom:8px">
      <div id="dlList" style="overflow:auto"></div></div>`;
    const list = host.querySelector("#dlList");
    const drawList = (q) => {
      const f = items.filter((i) => !q || (i.part_no + " " + i.title + " " + i.file_name).toLowerCase().includes(q.toLowerCase()));
      list.innerHTML = `<table style="width:100%;border-collapse:collapse;min-width:560px"><thead><tr style="text-align:left;color:#64748B;font-size:12px"><th style="padding:5px 6px">Part number</th><th style="padding:5px 6px">Rev</th><th style="padding:5px 6px">Title</th><th style="padding:5px 6px">Type</th><th style="padding:5px 6px">Size</th><th></th></tr></thead><tbody>${f.map((i) => `<tr style="border-top:1px solid #E2E8F0"><td style="padding:6px"><b>${esc(i.part_no)}</b></td><td style="padding:6px">${esc(i.rev || "—")}</td><td style="padding:6px">${esc(i.title || i.file_name)}</td><td style="padding:6px">${esc(kname(i.kind))}</td><td style="padding:6px;color:#64748B">${size(i.size_bytes)}</td><td style="padding:6px;text-align:right;white-space:nowrap"><button data-o="${i.id}" style="${btn("padding:5px 11px")}">Open</button>${can ? ` <button data-d="${i.id}" style="${ghost};color:#B00E28">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6" style="padding:14px;color:#64748B">${items.length ? "Nothing matches." : "No drawings yet."}</td></tr>`}</tbody></table>`;
      list.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => api.open(o, items.find((x) => x.id === b.dataset.o))));
      list.querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => {
        if (b.dataset.arm !== "1") { b.dataset.arm = "1"; b.textContent = "Click again to delete"; setTimeout(() => { b.dataset.arm = ""; b.textContent = "Delete"; }, 4000); return; }
        try { const p = await rpc(o, "kmr_part_draw_delete", { p_id: b.dataset.d }); if (p) await o.sb.storage.from(BUCKET).remove([p]); api.library(host, o); } catch (e) { alert(e.message || e); }
      }));
    };
    drawList(""); host.querySelector("#dlQ").oninput = (e) => drawList(e.target.value);
    if (!can) return;
    const prev = host.querySelector("#dlPrev");
    const stage = (files) => {
      files = [...files].filter((f) => !/^(\.|thumbs\.db$|desktop\.ini$)/i.test(f.name));
      if (!files.length) return;
      const rows = files.map((f) => ({ f, part: guess(f), rev: revOf(f.name), kind: /\.(stp|step|igs|iges)$/i.test(f.name) ? "model" : "drawing", on: true }));
      const dl = `<datalist id="dlParts">${parts.map((p) => `<option value="${esc(p.code)}">${esc(p.name || "")}</option>`).join("")}</datalist>`;
      const total = files.reduce((a, f) => a + f.size, 0);
      prev.innerHTML = `${dl}<p style="margin:6px 0;color:#64748B;font-size:13px">${files.length} file(s), ${size(total)}. Check the <b>part number</b> for each one — it must be a part in your Parts list. Rows with no part number are skipped.</p>
        <div style="max-height:46vh;overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:640px"><thead><tr style="text-align:left;color:#64748B;font-size:12px"><th></th><th style="padding:4px 6px">File</th><th style="padding:4px 6px">Part number</th><th style="padding:4px 6px;width:70px">Rev</th><th style="padding:4px 6px">Type</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr style="border-top:1px solid #E2E8F0"><td style="padding:4px"><input type="checkbox" data-on="${i}" ${r.part ? "checked" : ""}></td><td style="padding:4px 6px;font-size:13px">${esc(r.f.webkitRelativePath || r.f.name)}<div style="font-size:11px;color:#64748B">${size(r.f.size)}</div></td><td style="padding:4px"><input data-p="${i}" list="dlParts" value="${esc(r.part)}" style="${inp};width:100%;${r.part ? "" : "border-color:#D97706"}"></td><td style="padding:4px"><input data-r="${i}" value="${esc(r.rev)}" style="${inp};width:60px"></td><td style="padding:4px"><select data-k="${i}" style="${inp}">${KINDS.map((k) => `<option value="${k[0]}" ${k[0] === r.kind ? "selected" : ""}>${k[1]}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button id="dlGo" style="${btn()}">Upload selected</button><button id="dlNo" style="${ghost}">Cancel</button><span id="dlMsg" style="font-size:13px;color:#64748B"></span></div>`;
      const sync = () => rows.forEach((r, i) => { r.part = prev.querySelector(`[data-p="${i}"]`).value.trim(); r.rev = prev.querySelector(`[data-r="${i}"]`).value.trim(); r.kind = prev.querySelector(`[data-k="${i}"]`).value; r.on = prev.querySelector(`[data-on="${i}"]`).checked; });
      prev.querySelector("#dlNo").onclick = () => { prev.innerHTML = ""; };
      prev.querySelector("#dlGo").onclick = async () => {
        sync(); const todo = rows.filter((r) => r.on && r.part), msg = prev.querySelector("#dlMsg"), go = prev.querySelector("#dlGo");
        if (!todo.length) { msg.style.color = "#B00E28"; msg.textContent = "Tick at least one file and give it a part number."; return; }
        go.disabled = true; let ok = 0; const bad = [];
        for (const r of todo) {
          msg.style.color = "#64748B"; msg.textContent = `Uploading ${ok + bad.length + 1} of ${todo.length}: ${r.f.name}…`;
          try { const rf = r.f._get ? await r.f._get() : r.f; await api.upload(o, d.customer_id, rf, { part_no: r.part, rev: r.rev, kind: r.kind }); ok++; } catch (e) { bad.push(r.f.name + " — " + (e.message || e)); }
        }
        if (!bad.length) return api.library(host, o);
        msg.style.color = "#B00E28"; msg.innerHTML = `${ok} uploaded. <b>${bad.length} failed:</b><br>${bad.map(esc).join("<br>")}`; go.disabled = false;
      };
    };
    host.querySelector("#dlF").onchange = (e) => stage(e.target.files);
    host.querySelector("#dlD").onchange = (e) => stage(e.target.files);
    host.querySelector("#dlZ").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; prev.innerHTML = '<p style="color:#64748B">Reading the zip…</p>'; try { stage(await api.zip(f)); } catch (er) { prev.innerHTML = `<p style="color:#B00E28">${esc(er.message || er)}</p>`; } };
  };

  window.KMRDrawings = api;
})();
