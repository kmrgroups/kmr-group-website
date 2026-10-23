/* KMR Office Suite - sample mode (?demo=1). Same calls, rules and messages as the database functions (kmr_off_*, migration 0084). Nothing here is real data and nothing is kept after the page closes. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim();
  const ME = "you@demo.example", CODE = { doc: "DOC", sheet: "XLS", slide: "PPT" };
  const S = { settings: { prefix: "OFF", fy_numbering: true, page_size: "A4" }, files: [], vers: {}, n: {} };
  const J = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));
  let uid = 0; const id = () => "f" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  function number(kind) {
    const s = S.settings, pre = T(s.prefix).toUpperCase().replace(/[^A-Z0-9-]/g, "") || "OFF", d = new Date(), y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(), c = CODE[kind];
    if (s.fy_numbering !== false) { const fy = String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"), k = c + fy; S.n[k] = (S.n[k] || 0) + 1; return pre + "-" + c + "/" + fy + "/" + String(S.n[k]).padStart(4, "0"); }
    S.n[c] = (S.n[c] || 0) + 1; return pre + "-" + c + "-" + String(S.n[c]).padStart(4, "0");
  }
  const meta = (r) => ({ id: r.id, kind: r.kind, name: r.name, no: r.no, rev: r.rev, size: JSON.stringify(r.body).length, updated_at: r.updated_at, updated_by: r.updated_by, created_by: r.created_by });
  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_off_load() { return { role: "admin", me: ME, today: new Date().toISOString().slice(0, 10), settings: J(S.settings) }; },
    kmr_off_list(a) { const p = a.p || {}, q = T(p.q).toLowerCase(); return { files: S.files.filter((r) => (!p.kind || r.kind === p.kind) && (!q || (r.name + " " + r.no).toLowerCase().includes(q))).sort((x, y) => y.updated_at.localeCompare(x.updated_at)).map(meta) }; },
    kmr_off_get(a) { const r = S.files.find((x) => x.id === a.p_id) || err("File not found."); return Object.assign(meta(r), { body: J(r.body), can_edit: true }); },
    kmr_off_save(a) {
      const p = a.p || {}, kind = T(p.kind); if (!CODE[kind]) err("Unknown file type."); const name = T(p.name).slice(0, 120) || "Untitled"; if (p.body == null || typeof p.body !== "object") err("Nothing to save.");
      if (JSON.stringify(p.body).length > 14 * 1048576) err("This file is too large to save (limit 14 MB). Remove large pictures and try again.");
      const now = new Date().toISOString();
      if (!p.id) { const r = { id: id(), kind, name, no: number(kind), rev: 1, body: J(p.body), created_by: ME, updated_by: ME, updated_at: now }; S.files.push(r); S.vers[r.id] = [{ rev: 1, at: now, by: ME, body: J(r.body) }]; return { id: r.id, no: r.no, rev: r.rev }; }
      const r = S.files.find((x) => x.id === p.id) || err("File not found.");
      if (p.rev != null && Number(p.rev) !== r.rev) err("This file was changed by " + r.updated_by + " at " + now.slice(11, 16) + " while you were editing. Reload the file to see their changes.");
      r.name = name; r.body = J(p.body); r.rev += 1; r.updated_at = now; r.updated_by = ME; S.vers[r.id].push({ rev: r.rev, at: now, by: ME, body: J(r.body) }); if (S.vers[r.id].length > 15) S.vers[r.id].shift();
      return { id: r.id, no: r.no, rev: r.rev };
    },
    kmr_off_delete(a) { S.files = S.files.filter((x) => x.id !== a.p_id); delete S.vers[a.p_id]; return null; },
    kmr_off_versions(a) { return (S.vers[a.p_id] || []).map((v) => ({ rev: v.rev, at: v.at, by: v.by })).reverse(); },
    kmr_off_restore(a) { const r = S.files.find((x) => x.id === a.p_id) || err("File not found."), v = (S.vers[a.p_id] || []).find((x) => x.rev === Number(a.p_rev)) || err("That revision is no longer kept."); r.body = J(v.body); r.rev += 1; r.updated_at = new Date().toISOString(); S.vers[r.id].push({ rev: r.rev, at: r.updated_at, by: ME, body: J(r.body) }); return { id: r.id, rev: r.rev }; },
    kmr_off_settings_save(a) { const p = a.p || {}; S.settings = { prefix: T(p.prefix) || "OFF", fy_numbering: p.fy_numbering !== false, page_size: T(p.page_size) || "A4", header: T(p.header), footer: T(p.footer) }; return null; }
  });
})();
