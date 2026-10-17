/* KMRTask - "Make this a task" for any KMR app. Shows a small box to pick the person, date and priority, then creates the task in ActionTrack
   and keeps a link back to where it came from. The button appears only when the company has ActionTrack and the user can use it.
   Use:  await KMRTask.init({ call: (fn, args) => promise, slug: "company-slug", token: async () => accessToken })
         if (KMRTask.on) KMRTask.assign([{ title, detail, who, due, priority, source_app, source_ref, source_label, source_url }]) */
(function () {
  "use strict";
  let call = null, on = false, slug = "", getToken = null, people = null;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = () => {
    if (document.getElementById("kt-css")) return; const s = document.createElement("style"); s.id = "kt-css";
    s.textContent = `.kt-veil{position:fixed;inset:0;z-index:9200;background:rgba(10,7,32,.55);display:flex;align-items:flex-start;justify-content:center;padding:12px;overflow:auto}.kt-box{background:#fff;color:#0f172a;border-radius:16px;width:min(760px,100%);padding:16px;margin:auto;font:14px/1.45 system-ui,sans-serif;border-top:4px solid #4f46e5}
    .kt-box h3{margin:0 0 4px;font-size:18px}.kt-box p{margin:0 0 10px;color:#64748b}.kt-r{display:grid;grid-template-columns:auto 1fr;gap:8px;padding:10px 0;border-top:1px solid #e5e9f2}.kt-r .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}
    .kt-box input,.kt-box select{padding:8px;border:1px solid #cbd5e1;border-radius:8px;width:100%;font:inherit;background:#fff;color:#0f172a}.kt-box input[type=checkbox]{width:20px;height:20px;margin-top:8px}.kt-box label{font-size:11.5px;color:#64748b;font-weight:600;display:block}
    .kt-b{border:0;border-radius:10px;padding:10px 16px;font-weight:700;color:#fff;background:linear-gradient(90deg,#4f46e5,#7c3aed);cursor:pointer;font:inherit;font-weight:700}.kt-b.o{background:none;color:#4f46e5;border:1px solid #4f46e5}.kt-b:disabled{opacity:.5}
    .kt-ok{background:#dcfce7;color:#166534;padding:9px 12px;border-radius:10px;margin:8px 0}.kt-er{background:#fee2e2;color:#991b1b;padding:9px 12px;border-radius:10px;margin:8px 0}.kt-ft{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}`;
    document.head.append(s);
  };
  async function init(o) {
    call = o.call; slug = o.slug || (window.QP && QP.slug) || ""; getToken = o.token || null;
    try { on = !!(await call("kmr_tsk_enabled")); } catch (e) { on = false; }
    api.on = on; return on;
  }
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  function guess(who, ppl) {                                                                      // owner written as a name -> the matching user
    const w = norm(String(who || "").split(/[,;/&]| and /i)[0]); if (!w) return "";
    let m = ppl.find((p) => norm(p.name) === w || norm(p.email.split("@")[0]) === w); if (m) return m.email;
    const first = w.split(" ")[0]; const c = ppl.filter((p) => norm(p.name).split(" ")[0] === first || norm(p.name).includes(w));
    return c.length === 1 ? c[0].email : "";
  }
  async function kick() {
    try { const t = getToken ? await getToken() : null; if (t) fetch("/it/console/api/tsk/push", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: "{}", keepalive: true }).catch(() => {}); } catch (e) { /* ignore */ }
  }
  async function assign(items, opt) {
    if (!on) return; css(); opt = opt || {};
    const veil = document.createElement("div"); veil.className = "kt-veil"; document.body.append(veil);
    const close = () => veil.remove(); veil.addEventListener("click", (e) => { if (e.target === veil) close(); });
    try { if (!people) people = await call("kmr_tsk_people"); } catch (e) { veil.innerHTML = `<div class="kt-box"><div class="kt-er">${esc(e.message)}</div><button class="kt-b o" id="kt-x">Close</button></div>`; veil.querySelector("#kt-x").onclick = close; return; }
    const ppl = people.people || [], can = !!people.can_assign, me = people.me.email;
    const today = new Date(), td = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const sel = (i, v) => can ? `<select data-k="who" data-i="${i}"><option value="">Pick a person…</option>${ppl.map((p) => `<option value="${esc(p.email)}"${p.email === v ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : `<input value="${esc(people.me.name)} (you)" disabled><input type="hidden" data-k="who" data-i="${i}" value="${esc(me)}">`;
    veil.innerHTML = `<div class="kt-box"><h3>${esc(opt.title || (items.length > 1 ? "Make tasks in ActionTrack" : "Make a task in ActionTrack"))}</h3><p>${can ? "Pick who does it and by when. They get an alert on their phone or computer." : "You can create tasks for yourself. Ask your administrator for editor access to give tasks to others."}</p>
      <div id="kt-l">${items.map((it, i) => `<div class="kt-r"><input type="checkbox" data-k="on" data-i="${i}" checked><div><label>Task</label><input data-k="title" data-i="${i}" value="${esc(it.title)}" maxlength="200">
        <div class="g" style="margin-top:6px"><div><label>Given to${it.who && can ? " (owner in the source: " + esc(it.who) + ")" : ""}</label>${sel(i, can ? guess(it.who, ppl) || "" : me)}</div><div><label>Due date</label><input type="date" data-k="due" data-i="${i}" value="${esc(String(it.due || "").slice(0, 10))}"></div>
        <div><label>Priority</label><select data-k="pr" data-i="${i}">${[["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]].map((x) => `<option value="${x[0]}"${(it.priority || "normal") === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select></div></div></div></div>`).join("")}</div>
      <div id="kt-m"></div><div class="kt-ft"><button class="kt-b" id="kt-go">Create ${items.length > 1 ? "tasks" : "task"}</button><button class="kt-b o" id="kt-x">Cancel</button></div></div>`;
    const q = (k, i) => veil.querySelector(`[data-k="${k}"][data-i="${i}"]`);
    veil.querySelector("#kt-x").onclick = close;
    veil.querySelector("#kt-go").onclick = async (e) => {
      const btn = e.currentTarget, msg = veil.querySelector("#kt-m"); msg.innerHTML = ""; let made = 0, same = 0; const errs = [];
      btn.disabled = true;
      for (let i = 0; i < items.length; i++) {
        if (!q("on", i).checked) continue; const it = items[i], who = q("who", i).value;
        if (!who) { errs.push("Pick a person for “" + q("title", i).value + "”."); continue; }
        try {
          const r = await call("kmr_tsk_save", { p: { title: q("title", i).value, detail: it.detail || "", assignee: who, priority: q("pr", i).value, due: q("due", i).value || null, tags: it.tags || "",
            source_app: it.source_app, source_ref: it.source_ref, source_label: it.source_label, source_url: it.source_url, source_key: it.source_key || (it.source_app && it.source_ref ? it.source_app + ":" + it.source_ref : null) } });
          if (r && r.existing) same++; else made++; q("on", i).checked = false; q("on", i).disabled = true;
        } catch (er) { errs.push(er.message); }
      }
      btn.disabled = false; kick();
      const link = `/it/tasks.html?${window.QP && QP.DEMO ? "demo=1" : "kmr=1&co=" + encodeURIComponent(slug)}#go=by_me`;
      msg.innerHTML = (made || same ? `<div class="kt-ok">${made ? made + (made > 1 ? " tasks" : " task") + " created. " : ""}${same ? same + " already existed. " : ""}<a href="${link}" target="_blank" rel="noopener">Open ActionTrack</a></div>` : "") + errs.map((x) => `<div class="kt-er">${esc(x)}</div>`).join("");
      if (made || same) { veil.querySelector("#kt-x").textContent = "Close"; if (opt.done) opt.done({ made, same }); if (!errs.length) btn.style.display = "none"; }
    };
  }
  const api = { init, assign, on: false, guess };
  window.KMRTask = api;
})();
