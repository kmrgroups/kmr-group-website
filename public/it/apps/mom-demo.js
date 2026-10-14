/* Minutes Of Meetings — sample data for the demo (?demo=1). Same rules and messages as the database functions. */
(function () {
  "use strict";
  let uid = 0; const id = () => "x" + (++uid).toString(36) + Math.random().toString(36).slice(2, 6);
  const DAY = 864e5, now = () => Date.now(), isoD = (ms) => new Date(ms).toISOString().slice(0, 10), iso = (ms) => new Date(ms).toISOString();
  const err = (m) => { throw new Error(m); }, nz = (v) => (v === "" || v == null ? null : v), T = (v) => String(v == null ? "" : v).trim();
  const people = [["QA01", "Ravi Kumar", "Head – Quality", "Quality"], ["PR01", "Suresh Patil", "Production Manager", "Production"], ["MN01", "Anil Sharma", "Maintenance Engineer", "Maintenance"], ["PU01", "Meena Iyer", "Purchase Manager", "Purchase"], ["EN01", "Karthik Rao", "Design Engineer", "Engineering"]]
    .map((r) => ({ code: r[0], name: r[1], role: r[2], function: r[3], email: r[1].split(" ")[0].toLowerCase() + "@example.com" }));
  const meetings = [], points = [], segs = [], ctr = {};
  const yymm = (d) => d.slice(2, 4) + d.slice(5, 7);
  const num = (d) => { const k = "MOM-" + yymm(d); ctr[k] = (ctr[k] || 0) + 1; return k + "-" + String(ctr[k]).padStart(4, "0"); };
  const att = (n) => people.slice(0, n).map((p) => ({ name: p.name, function: p.function, email: p.email, present: true }));
  const mk = (o) => { const m = Object.assign({ id: id(), status: "open", language: "en-IN", attendees: att(4), sample: true }, o); m.meeting_no = num(m.meeting_date); meetings.push(m); return m; };
  const pt = (m, o) => { const p = Object.assign({ id: id(), meeting_id: m.id, ptype: "Action", status: "Open", lang: "en-IN", source: "typed", translations: {}, seg_ids: [], sample: true, created_at: iso(now()) }, o); points.push(p); return p; };
  const d0 = (n) => isoD(now() - n * DAY);
  const m1 = mk({ title: "Weekly quality review", mtype: "Quality review", meeting_date: d0(9), start_time: "10:00", end_time: "11:00", venue: "Conference room", chairperson: "Ravi Kumar", scribe: "Karthik Rao", status: "closed", agenda: "Customer complaints; scrap trend; audit actions", next_date: d0(2) });
  pt(m1, { topic: "Customer complaint C-112", what: "Burr on bore of part 4471-B reported by customer", why: "Deburring tool worn beyond life", who: "Suresh Patil", when_on: d0(2), where_at: "CNC Turning cell", how: "Change tool life limit to 800 pcs; add burr check to Control Plan", ptype: "Action", status: "Done" });
  pt(m1, { topic: "Scrap trend", what: "Scrap at 2.4% against 1.5% target", why: "Insert chipping on VMC-02", who: "Anil Sharma", when_on: d0(-3), where_at: "VMC", how: "Trial with new insert grade; review after 5 days data", ptype: "Action", status: "In progress" });
  pt(m1, { topic: "Audit", what: "Internal audit schedule approved for next month", ptype: "Decision", status: "Done" });
  const m2 = mk({ title: "Daily production meeting", mtype: "Daily production", meeting_date: d0(1), start_time: "09:00", end_time: "09:20", venue: "Shop floor", chairperson: "Suresh Patil", scribe: "Anil Sharma", status: "open", attendees: att(3) });
  pt(m2, { topic: "Material shortage", what: "Forging lot for part 5520 is delayed by two days", why: "Supplier furnace breakdown", who: "Meena Iyer", when_on: d0(-1), where_at: "Stores", how: "Expedite with supplier; arrange alternate lot from second source", ptype: "Action", status: "Open" });
  segs.push({ id: id(), meeting_id: m2.id, client_id: "c1", lang: "en-IN", text: "The forging lot for part 5520 is delayed by two days, Meena to follow up with the supplier by tomorrow.", spoken_at: iso(now() - DAY + 9 * 36e5), speaker: "Suresh Patil", point_id: null });
  segs.push({ id: id(), meeting_id: m2.id, client_id: "c2", lang: "hi-IN", text: "कल तक मशीन दो की मरम्मत पूरी करनी है।", spoken_at: iso(now() - DAY + 9 * 36e5 + 90000), speaker: "Anil Sharma", point_id: null });
  const view = (m) => { const P = points.filter((p) => p.meeting_id === m.id); return Object.assign({}, m, { points: P.length, open_points: P.filter((p) => ["Open", "In progress"].includes(p.status)).length, done_points: P.filter((p) => p.status === "Done").length, segments: segs.filter((s) => s.meeting_id === m.id).length }); };
  const find = (i) => meetings.find((m) => m.id === i) || err("Meeting not found.");
  const findP = (i) => points.find((p) => p.id === i) || err("Point not found.");
  const PS = ["Open", "In progress", "Done", "Dropped"], PT = ["Discussion", "Decision", "Action", "Information", "Risk / concern", "Query"];
  const MF = ["title", "mtype", "meeting_date", "start_time", "end_time", "venue", "chairperson", "scribe", "language", "prev_ref", "next_date", "distribution", "agenda"];

  window.QP_DEMO = {
    kmr_mom_load() { return { meetings: meetings.map(view).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date)), people, today: isoD(now()) }; },
    kmr_mom_get(a) { const m = find(a.p_id); return { meeting: view(m), points: points.filter((p) => p.meeting_id === m.id), segments: segs.filter((s) => s.meeting_id === m.id).sort((x, y) => (x.spoken_at || "").localeCompare(y.spoken_at || "")) }; },
    kmr_mom_save(a) {
      const p = a.p || {}; let m;
      if (!T(p.title)) err("Enter the meeting title."); if (!T(p.meeting_date)) err("Enter the meeting date.");
      if (p.end_time && p.start_time && p.end_time < p.start_time) err("End time is before start time.");
      if (p.id) { m = find(p.id); if (m.status !== "open") err("This meeting is finalised. Re-open it to change the details."); }
      else { m = { id: id(), status: "open", sample: true, language: "en-IN", attendees: [] }; m.meeting_no = num(p.meeting_date); meetings.push(m); }
      MF.forEach((f) => { if (f in p) m[f] = nz(typeof p[f] === "string" ? p[f].trim() : p[f]); }); if (Array.isArray(p.attendees)) m.attendees = p.attendees;
      return view(m);
    },
    kmr_mom_point_save(a) {
      const p = a.p || {}; let r = p.id && findP(p.id), m = r ? find(r.meeting_id) : find(p.meeting_id);
      if (r && m.status !== "open") { if (m.status === "void") err("This meeting is void."); const ok = ["status", "remarks", "when_on", "when_note"]; Object.keys(p).forEach((k) => { if (k !== "id" && !ok.includes(k)) delete p[k]; }); }
      else if (m.status !== "open") err("This meeting is finalised. Re-open it to add points.");
      if (!r && !T(p.what)) err("Write what was discussed or decided (the “What” of 5W1H).");
      if (r && "what" in p && !T(p.what)) err("The “What” of a point cannot be empty.");
      if (p.status && !PS.includes(p.status)) err("Status must be one of: " + PS.join(", ") + "."); if (p.ptype && !PT.includes(p.ptype)) err("Choose a valid point type.");
      if (!r) { r = { id: id(), meeting_id: m.id, translations: {}, sample: true, created_at: iso(now()), status: "Open", ptype: "Discussion", source: "typed" }; points.push(r); }
      ["topic", "what", "why", "who", "when_on", "when_note", "where_at", "how", "ptype", "status", "lang", "remarks", "source"].forEach((f) => { if (f in p) r[f] = nz(typeof p[f] === "string" ? p[f].trim() : p[f]); });
      if (Array.isArray(p.seg_ids)) { r.seg_ids = p.seg_ids; segs.forEach((s) => { if (p.seg_ids.includes(s.id)) s.point_id = r.id; }); }
      return r;
    },
    kmr_mom_point_delete(a) { const r = findP(a.p_id); if (find(r.meeting_id).status !== "open") err("This meeting is finalised. Re-open it to delete points."); points.splice(points.indexOf(r), 1); segs.forEach((s) => { if (s.point_id === r.id) s.point_id = null; }); return null; },
    kmr_mom_seg_save(a) {
      const m = find(a.p.meeting_id); if (m.status !== "open") err("This meeting is finalised. Re-open it to record."); const ids = {};
      (a.p.segs || []).forEach((g) => { let s = segs.find((x) => x.meeting_id === m.id && x.client_id === g.client_id); if (!s) { s = { id: id(), meeting_id: m.id, client_id: g.client_id, lang: g.lang, text: T(g.text), spoken_at: g.spoken_at || iso(now()), speaker: nz(g.speaker), point_id: null }; segs.push(s); } ids[g.client_id] = s.id; });
      return { ids };
    },
    kmr_mom_seg_update(a) { const s = segs.find((x) => x.id === a.p_id); if (!s) err("Line not found."); if (find(s.meeting_id).status !== "open") err("This meeting is finalised."); if (!T(a.p_text)) err("The line cannot be empty."); s.text = T(a.p_text); return null; },
    kmr_mom_seg_delete(a) { const s = segs.find((x) => x.id === a.p_id); if (!s) return null; if (find(s.meeting_id).status !== "open") err("This meeting is finalised."); segs.splice(segs.indexOf(s), 1); return null; },
    kmr_mom_translate_save(a) { const r = findP(a.p_id); if (!T(a.p_lang)) err("Choose the language."); r.translations = Object.assign({}, r.translations, { [a.p_lang]: a.p_tr || {} }); return null; },
    kmr_mom_close(a) { const m = find(a.p_id); if (m.status !== "open") err("Only an open meeting can be finalised."); if (!points.some((p) => p.meeting_id === m.id) && !segs.some((s) => s.meeting_id === m.id)) err("Record at least one discussion point before finalising."); m.status = "closed"; return view(m); },
    kmr_mom_delete(a) { const m = find(a.p_id); points.filter((p) => p.meeting_id === m.id).forEach((p) => points.splice(points.indexOf(p), 1)); segs.filter((x) => x.meeting_id === m.id).forEach((x) => segs.splice(segs.indexOf(x), 1)); meetings.splice(meetings.indexOf(m), 1); return null; },
    kmr_mom_reopen(a) { const m = find(a.p_id); if (m.status !== "closed") err("Only a finalised meeting can be re-opened."); m.status = "open"; return view(m); },
    kmr_mom_void(a) { if (!T(a.p_reason)) err("Give the reason for voiding the meeting."); const m = find(a.p_id); if (m.status === "void") err("Already void."); m.status = "void"; m.void_reason = T(a.p_reason); return null; },
    kmr_mom_actions() {
      return points.filter((p) => ["Open", "In progress"].includes(p.status) && ["Action", "Decision", "Risk / concern", "Query"].includes(p.ptype)).map((p) => { const m = find(p.meeting_id); return { id: p.id, meeting_id: m.id, meeting_no: m.meeting_no, meeting_date: m.meeting_date, topic: p.topic, what: p.what, who: p.who, due_on: p.when_on, status: p.status, ptype: p.ptype, where_at: p.where_at }; }).filter((x, i, arr) => { const m = meetings.find((q) => q.id === x.meeting_id); return m.status !== "void"; });
    }
  };
})();
