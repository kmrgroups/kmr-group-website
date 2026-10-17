/* ActionTrack - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_tsk_*). Nothing here is real data. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim();
  let uid = 0; const id = () => "k" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const J = (o) => JSON.parse(JSON.stringify(o));
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const ME = { email: "you@demo.example", name: "You" };
  const P = [ME, { email: "ravi@demo.example", name: "Ravi Kumar" }, { email: "priya@demo.example", name: "Priya Nair" }, { email: "anil@demo.example", name: "Anil Shah" }, { email: "meena@demo.example", name: "Meena Iyer" }];
  const nm = (e) => (P.find((p) => p.email === e) || { name: e }).name;
  const S = { tasks: [], thread: {}, notes: [], n: 0 };
  const ev = (tid, text, kind) => (S.thread[tid] = S.thread[tid] || []).push({ id: id(), author: ME.email, name: ME.name, body: text, kind: kind || "event", at: new Date().toISOString() });
  const note = (to, tid, kind, title, body) => { if (to && to !== ME.email) S.notes.push({ id: id(), task_id: tid, kind, title, body, read: false, at: new Date().toISOString(), to }); };
  function mk(o) {
    const t = Object.assign({ id: id(), no: "T-" + String(++S.n).padStart(4, "0"), detail: null, priority: "normal", status: "open", due: null, done_at: null, tags: null, checklist: [], source_app: null, source_ref: null, source_label: null, source_url: null,
      assigned_by: ME.email, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sample: true }, o);
    t.assignee_name = nm(t.assignee); t.assigned_by_name = nm(t.assigned_by); S.tasks.push(t); ev(t.id, "Task created" + (t.source_app ? " from " + t.source_label : "") + "."); return t;
  }
  mk({ title: "Send revised quotation to Apex Auto", detail: "Include the new tooling cost and the 8-week lead time.", assignee: "ravi@demo.example", priority: "high", due: day(1), source_app: "sales", source_label: "Sales Flow", tags: "Sales" });
  mk({ title: "Close corrective action for customer complaint", detail: "Root cause and containment are done; attach the 8D report.", assignee: ME.email, priority: "urgent", status: "progress", due: day(-2), source_app: "mom", source_label: "Quality review meeting", tags: "Quality",
    checklist: [{ t: "Root cause written", d: true }, { t: "Containment checked", d: true }, { t: "8D report attached", d: false }] });
  mk({ title: "Calibrate micrometer set MC-04", assignee: "priya@demo.example", due: day(3), tags: "Calibration" });
  mk({ title: "Update the control plan after the process change", detail: "Reflect the new torque value on station 3.", assignee: ME.email, priority: "high", due: day(0), source_app: "mom", source_label: "Quality review meeting", tags: "Quality" });
  mk({ title: "Arrange packing material for next week's PO", assignee: "ravi@demo.example", status: "blocked", due: day(-1), tags: "Stores" });
  mk({ title: "Share the monthly sales report", assignee: ME.email, priority: "low", status: "done", due: day(-4), done_at: new Date(Date.now() - 2 * 864e5).toISOString(), source_app: "sales", source_label: "Sales Flow" });
  mk({ title: "Book a vendor audit slot", detail: "Two vendors are pending: surface treatment and casting.", assignee: "priya@demo.example", status: "progress", due: day(5), tags: "Quality" });
  mk({ title: "Fix the loose guard on press P-12", detail: "Safety item raised in the shop-floor round.", assignee: "anil@demo.example", priority: "urgent", due: day(-3), source_app: "mom", source_label: "Shop-floor round", tags: "Safety" });
  mk({ title: "Review supplier delivery performance", assignee: ME.email, due: day(6), assigned_by: "meena@demo.example", tags: "Purchase" });
  S.notes.push({ id: id(), task_id: S.tasks[8].id, kind: "assigned", title: "New task: Review supplier delivery performance", body: "Meena Iyer assigned you T-0009, due soon.", read: false, at: new Date().toISOString(), to: ME.email });
  S.notes.push({ id: id(), task_id: S.tasks[1].id, kind: "overdue", title: "Overdue: Close corrective action for customer complaint", body: "T-0002 · Urgent priority · 2 day(s) late", read: false, at: new Date(Date.now() - 36e5).toISOString(), to: ME.email });

  const days = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);
  const active = (t) => ["open", "progress", "blocked"].includes(t.status);
  const view = (t, today) => Object.assign(J(t), { overdue: active(t) && !!t.due && days(t.due, today) < 0, comments: (S.thread[t.id] || []).filter((c) => c.kind === "comment").length });
  const find = (i) => S.tasks.find((t) => t.id === i) || err("Task not found.");
  const EM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_tsk_enabled() { return true; },
    kmr_tsk_people() { return { me: ME, role: "admin", can_assign: true, people: P.map((p) => ({ email: p.email, name: p.name })) }; },
    kmr_tsk_list(a) {
      const p = a.p || {}, today = p.today || day(0), sc = p.scope || "mine", st = p.status || "active", q = T(p.q).toLowerCase();
      const rows = S.tasks.filter((t) => (sc === "mine" ? t.assignee === ME.email : sc === "by_me" ? t.assigned_by === ME.email && t.assignee !== ME.email : sc === "person" ? t.assignee === T(p.assignee).toLowerCase() : true)
        && (st === "active" ? active(t) : st === "done" ? ["done", "cancelled"].includes(t.status) : st === "all" ? true : t.status === st) && (!p.priority || t.priority === p.priority)
        && (!q || (t.title + " " + t.no + " " + (t.detail || "") + " " + (t.tags || "")).toLowerCase().includes(q)));
      const pr = { urgent: 0, high: 1, normal: 2, low: 3 };
      rows.sort((x, y) => (active(y) - active(x)) || (x.due || "9").localeCompare(y.due || "9") || pr[x.priority] - pr[y.priority]);
      return rows.map((t) => view(t, today));
    },
    kmr_tsk_get(a) { const t = find(a.p_id); return Object.assign(view(t, (a.p || {}).today || day(0)), { can_edit: true, can_delete: true, thread: J(S.thread[t.id] || []) }); },
    kmr_tsk_save(a) {
      const p = a.p, ttl = T(p.title), asg = T(p.assignee).toLowerCase() || ME.email, pr = p.priority || "normal";
      if (!["low", "normal", "high", "urgent"].includes(pr)) err("Priority must be low, normal, high or urgent."); if (!EM.test(asg)) err("Pick the person from the list."); if (!ttl) err("Enter what has to be done.");
      if (p.id) { const t = find(p.id), old = t.assignee; Object.assign(t, { title: ttl, detail: T(p.detail) || null, assignee: asg, assignee_name: nm(asg), priority: pr, due: p.due || null, tags: T(p.tags) || null, checklist: p.checklist || t.checklist, updated_at: new Date().toISOString() });
        if (old !== asg) { ev(t.id, "Reassigned from " + nm(old) + " to " + nm(asg) + "."); note(asg, t.id, "assigned", "Task for you: " + ttl, "You assigned " + t.no + "."); } return { id: t.id, no: t.no }; }
      if (p.source_key) { const x = S.tasks.find((t) => t.source_key === p.source_key); if (x) return { id: x.id, no: x.no, existing: true }; }
      const t = mk({ title: ttl, detail: T(p.detail) || null, assignee: asg, priority: pr, due: p.due || null, tags: T(p.tags) || null, checklist: p.checklist || [], source_app: p.source_app || null, source_label: p.source_label || null, source_url: p.source_url || null, source_key: p.source_key || null, sample: false });
      note(asg, t.id, "assigned", "New task: " + ttl, "You assigned " + t.no + "."); return { id: t.id, no: t.no };
    },
    kmr_tsk_reassign(a) { const t = find(a.p_id), asg = T(a.p_assignee).toLowerCase(); if (!EM.test(asg)) err("Pick the person from the list."); if (asg === t.assignee) return null; ev(t.id, "Reassigned from " + nm(t.assignee) + " to " + nm(asg) + "."); t.assignee = asg; t.assignee_name = nm(asg); return null; },
    kmr_tsk_status(a) {
      const t = find(a.p_id), L = { open: "To do", progress: "In progress", blocked: "Blocked", done: "Done", cancelled: "Cancelled" }; if (!L[a.p_status]) err("Unknown status."); if (t.status === a.p_status) return null;
      t.status = a.p_status; t.done_at = a.p_status === "done" ? new Date().toISOString() : null; t.updated_at = new Date().toISOString(); ev(t.id, "Status changed to " + L[a.p_status] + (T(a.p_note) ? ": " + T(a.p_note) : ".")); return null;
    },
    kmr_tsk_check(a) { const t = find(a.p_id); t.checklist = a.p_checklist; return null; },
    kmr_tsk_comment(a) { const t = find(a.p_id), b = T(a.p_body); if (!b) err("Write a comment first."); ev(t.id, b, "comment"); return null; },
    kmr_tsk_delete(a) { S.tasks = S.tasks.filter((t) => t.id !== a.p_id); return null; },
    kmr_tsk_dashboard(a) {
      const p = a.p || {}, today = p.today || day(0), team = p.scope === "team", t = S.tasks.filter((x) => team || x.assignee === ME.email), act = t.filter(active), n = (f) => act.filter(f).length;
      const by = {}; t.forEach((x) => { const o = by[x.assignee] || (by[x.assignee] = { email: x.assignee, name: nm(x.assignee), open: 0, overdue: 0, done: 0 }); if (active(x)) { o.open++; if (x.due && days(x.due, today) < 0) o.overdue++; } else if (x.status === "done") o.done++; });
      const src = {}; act.forEach((x) => { const k = x.source_app || "direct"; src[k] = (src[k] || 0) + 1; });
      return { team, open: n((x) => x.status === "open"), progress: n((x) => x.status === "progress"), blocked: n((x) => x.status === "blocked"), overdue: n((x) => x.due && days(x.due, today) < 0), due_today: n((x) => x.due === today),
        due_week: n((x) => x.due && days(x.due, today) > 0 && days(x.due, today) <= 7), no_date: n((x) => !x.due), done_week: t.filter((x) => x.status === "done" && x.done_at && days(x.done_at.slice(0, 10), today) >= -6).length,
        done_total: t.filter((x) => x.status === "done").length, total: t.length, by_person: Object.values(by).filter((o) => o.open + o.done > 0).sort((x, y) => y.overdue - x.overdue || y.open - x.open),
        by_priority: { urgent: n((x) => x.priority === "urgent"), high: n((x) => x.priority === "high"), normal: n((x) => x.priority === "normal"), low: n((x) => x.priority === "low") },
        by_source: Object.entries(src).map(([app, c]) => ({ app, label: "", n: c })).sort((x, y) => y.n - x.n),
        trend: Array.from({ length: 14 }, (_, i) => { const d = day(i - 13); return { d, created: i === 13 ? 2 : (i % 4 === 0 ? 1 : 0), done: t.filter((x) => x.status === "done" && x.done_at && x.done_at.slice(0, 10) === d).length + (i === 9 ? 1 : 0) }; }),
        late: act.filter((x) => x.due && days(x.due, today) < 0).sort((x, y) => x.due.localeCompare(y.due)).slice(0, 8).map((x) => view(x, today)) };
    },
    kmr_tsk_notes() { const mine = S.notes.filter((n) => n.to === ME.email).sort((x, y) => y.at.localeCompare(x.at)); return { unread: mine.filter((n) => !n.read).length, items: J(mine) }; },
    kmr_tsk_notes_read(a) { const ids = a.p && a.p.ids; S.notes.forEach((n) => { if (!ids || ids.includes(n.id)) n.read = true; }); return null; },
    kmr_tsk_push_subscribe() { err("Alerts on phones and computers work in your own company workspace."); },
    kmr_tsk_push_unsubscribe() { return null; },
    kmr_tsk_push_devices() { return []; }
  });
})();
