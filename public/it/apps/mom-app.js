/* Minutes Of Meetings - screens. Data calls are kmr_mom_* (database) or mom-demo.js (?demo=1). */
(function () {
  "use strict";
  const { $, esc, iso, today, fmt, say, call } = QP, LG = window.MOMLang;
  const S = { load: null, det: null, cur: "", act: null, rec: null, q: [], interim: "", state: "stopped", saved: 0, lastSpeaker: "", tgt: "" };
  const ed = () => QP.canEdit, hasF = (k) => !window.KMRLock || KMRLock.has(k);
  const TYPES = ["Management review", "CFT / APQP team", "Customer review", "Quality review", "Production review", "Daily production", "Supplier review", "Maintenance review", "Safety / EHS", "FMEA / Control Plan review", "Internal audit closing", "Other"];
  const PT = ["Discussion", "Decision", "Action", "Information", "Risk / concern", "Query"], ST = ["Open", "In progress", "Done", "Dropped"];
  const open = (h) => { $("#mb").innerHTML = h; $("#m").classList.add("on"); }, closeM = () => $("#m").classList.remove("on");
  $("#m").addEventListener("click", (e) => { if (e.target.id === "m") closeM(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeM(); });
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const opts = (arr, sel) => arr.map((x) => `<option${x === sel ? " selected" : ""}>${esc(x)}</option>`).join("");
  const langOpts = (sel) => LG.list.map((l) => `<option value="${l.tag}"${l.tag === sel ? " selected" : ""}>${esc(LG.label(l))}${l.voice ? "" : " (typing only)"}</option>`).join("");
  const lname = (t) => { const l = LG.byTag(t); return l ? l.name : (t || ""); };
  const dd = (v) => fmt(v), tm = (v) => (v ? String(v).slice(0, 5) : "");
  const hashGo = () => { const m = location.hash.match(/go=([a-z]+)/); return m ? m[1] : "std"; };
  const hashM = () => { const m = location.hash.match(/[&?]m=([0-9a-zA-Z-]+)/); return m ? m[1] : ""; };
  const stChip = (s) => `<span class="chip ${({ Open: "a", "In progress": "b", Done: "g", Dropped: "x" })[s] || "x"}">${esc(s || "Open")}</span>`;
  const dueChip = (d, st) => { if (!d) return '<span class="mut">—</span>'; if (st === "Done" || st === "Dropped") return dd(d); const n = Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5); return `<span class="chip ${n < 0 ? "r" : n <= 3 ? "a" : "g"}">${dd(d)}${n < 0 ? " · " + -n + "d late" : n === 0 ? " · today" : ""}</span>`; };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const isOpen = () => S.det && S.det.meeting.status === "open";
  const canWrite = () => ed() && isOpen();
  const GUIDE = { 1: "Fill in the basics and tick who attended. Then press “Save and continue”.", 2: "Speak or type the discussion. It stays as plain text here. Then press “Understand and make points”.", 3: "Check the points (owner and target date). Mark actions Done as they finish. When everything is right, press “Finalise minutes”." };

  async function loadAll() { S.load = await call("kmr_mom_load"); }
  async function loadAct() { S.act = await call("kmr_mom_actions"); }

  /* ================= router ================= */
  async function route() {
    let go = hashGo();
    if (window.KMRLock && KMRLock.locked(go)) { KMRLock.dialog(go); go = "std"; history.replaceState(null, "", location.pathname + location.search + "#go=std"); }
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    ["std", "dash", "meet", "act"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    if (go === "std") { KMRStd.draw($("#std"), "mom"); return; }
    try {
      if (go !== "meet" || !hashM()) { if (S.det && S.rec && S.state !== "stopped") { /* keep recording alive while browsing other tabs */ } }
      await loadAll();
      if (go === "dash") { await loadAct(); drawDash(); }
      else if (go === "act") { await loadAct(); drawAct(); }
      else { const id = hashM(); if (id) await openMeeting(id); else drawList(); }
    } catch (e) { say(e.message); }
  }
  document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#go="]'); if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); history.replaceState(null, "", location.pathname + location.search + a.getAttribute("href")); route(); window.scrollTo(0, 0); });
  window.addEventListener("hashchange", route);
  const go = (h) => { history.replaceState(null, "", location.pathname + location.search + "#" + h); route(); window.scrollTo(0, 0); };

  /* ================= dashboard ================= */
  function drawDash() {
    const M = S.load.meetings.filter((m) => m.status !== "void"), A = S.act || [], t = today(), ym = t.slice(0, 7);
    const open = A.filter((a) => a.status !== "Done" && a.status !== "Dropped"), late = open.filter((a) => a.due_on && a.due_on < t);
    const all = M.reduce((n, m) => n + (+m.points || 0), 0), done = M.reduce((n, m) => n + (+m.done_points || 0), 0);
    const voice = M.filter((m) => +m.segments > 0).length;
    const byOwner = {}; open.forEach((a) => { const k = (a.who || "Not assigned").split(",")[0].trim() || "Not assigned"; byOwner[k] = (byOwner[k] || 0) + 1; });
    const byType = {}; M.forEach((m) => { byType[m.mtype || "Other"] = (byType[m.mtype || "Other"] || 0) + 1; });
    const bars = (o) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = Math.max(1, ...e.map((x) => x[1])); return e.length ? `<div class="bars">${e.map((x) => `<div class="bl"><span>${esc(x[0])}</span><i style="width:${Math.round(x[1] / mx * 100)}%"></i><b>${x[1]}</b></div>`).join("")}</div>` : '<p class="mut">No data yet.</p>'; };
    $("#dash").innerHTML = `<div class="kpis">
      <div class="kpi"><span>Meetings this month</span><b>${M.filter((m) => String(m.meeting_date).slice(0, 7) === ym).length}</b></div>
      <div class="kpi" style="--c:var(--a)"><span>Open actions</span><b>${open.length}</b></div>
      <div class="kpi" style="--c:var(--r)"><span>Overdue actions</span><b>${late.length}</b></div>
      <div class="kpi" style="--c:var(--g)"><span>Points closed</span><b>${all ? Math.round(done / all * 100) : 0}%</b></div>
      <div class="kpi" style="--c:var(--b2)"><span>Meetings with voice record</span><b>${voice}</b></div></div>
      <div class="frm"><div class="card"><h3>Open actions by owner</h3>${bars(byOwner)}</div><div class="card"><h3>Meetings by type</h3>${bars(byType)}</div></div>
      <div class="card"><h3>Latest meetings</h3>${meetTable(M.slice(0, 6))}</div>`;
    bindList();
  }

  /* ================= meeting list ================= */
  function meetTable(rows) {
    if (!rows.length) return '<div class="empty"><b>No meetings yet.</b><br>Press <b>+ New meeting</b> to start. You will speak or type the discussion, and the app turns it into points.</div>';
    return `<table><thead><tr><th>Meeting no.</th><th>Date</th><th>Subject</th><th>Type</th><th>Chair</th><th class="n">Points</th><th class="n">Open</th><th>Status</th></tr></thead><tbody>${rows.map((m) =>
      `<tr><td><a href="#go=meet&m=${m.id}" data-open="${m.id}"><b>${esc(m.meeting_no)}</b></a>${m.sample ? ' <span class="chip x">sample</span>' : ""}</td><td>${dd(m.meeting_date)}</td><td>${esc(m.title)}</td><td>${esc(m.mtype || "")}</td><td>${esc(m.chairperson || "")}</td><td class="n">${m.points || 0}</td><td class="n">${m.open_points || 0}</td><td><span class="chip ${m.status === "closed" ? "g" : m.status === "void" ? "x" : "a"}">${m.status === "open" ? "In progress" : m.status === "closed" ? "Finalised" : "Void"}</span></td></tr>`).join("")}</tbody></table>`;
  }
  function bindList() { document.querySelectorAll("[data-open]").forEach((a) => a.addEventListener("click", (e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey) return; e.preventDefault(); go("go=meet&m=" + a.dataset.open); })); }
  function drawList() {
    S.det = null; const q = (V("mq") || "").toLowerCase(), f = V("mf") || "all", M = S.load.meetings.filter((m) => f === "all" ? m.status !== "void" : m.status === f).filter((m) => !q || (m.title + m.meeting_no + (m.mtype || "") + (m.chairperson || "")).toLowerCase().includes(q));
    $("#meet").innerHTML = `<div class="row"><input id="mq" placeholder="Search meetings…" value="${esc(q)}" style="max-width:260px"><select id="mf" style="max-width:180px"><option value="all">All (not void)</option><option value="open">In progress</option><option value="closed">Finalised</option><option value="void">Void</option></select><span class="grow"></span>${ed() ? '<button class="btn" id="mnew">+ New meeting</button>' : ""}</div>${meetTable(M)}`;
    $("#mf").value = f; $("#mq").oninput = () => { const p = $("#mq").selectionStart; drawList(); $("#mq").focus(); try { $("#mq").setSelectionRange(p, p); } catch (e) { /* ignore */ } };
    $("#mf").onchange = drawList; if ($("#mnew")) $("#mnew").onclick = newMeeting; bindList();
  }
  function newMeeting() {
    const people = S.load.people || [];
    open(`<h3>New meeting</h3><div class="frm"><div style="grid-column:1/-1"><label>Subject / title *</label><input id="n_title" placeholder="e.g. Weekly production review"></div>
      <div><label>Meeting type</label><select id="n_type" data-add>${opts(TYPES, TYPES[4])}</select></div><div><label>Date *</label><input id="n_date" type="date" value="${today()}"></div>
      <div><label>Start time</label><input id="n_st" type="time"></div><div><label>Venue / link</label><input id="n_venue"></div>
      <div><label>Chairperson</label><input id="n_chair" list="n_dl"></div><div><label>Minute-taker</label><input id="n_scribe" list="n_dl"></div>
      <div><label>Main language</label><select id="n_lang">${langOpts("en-IN")}</select></div></div><datalist id="n_dl">${people.map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>
      <div class="row" style="margin-top:12px"><button class="btn" id="n_ok">Create and open</button><button class="btn o" id="n_x">Cancel</button></div>`);
    $("#n_x").onclick = closeM;
    $("#n_ok").onclick = async () => { try { const m = await call("kmr_mom_save", { p: { title: V("n_title"), mtype: V("n_type"), meeting_date: V("n_date"), start_time: V("n_st") || null, venue: V("n_venue"), chairperson: V("n_chair"), scribe: V("n_scribe"), language: V("n_lang"), attendees: [] } }); closeM(); go("go=meet&m=" + m.id); } catch (e) { const el = $("#n_ok"); el.insertAdjacentHTML("beforebegin", `<div class="msg" style="width:100%">${esc(e.message)}</div>`); } };
  }

  /* ================= meeting editor ================= */
  async function openMeeting(id) {
    if (!S.det || S.det.meeting.id !== id) { S.det = await call("kmr_mom_get", { p_id: id }); S.q = lsGet(id); const D0 = S.det; S.step = D0.meeting.status !== "open" || D0.points.length || D0.segments.length ? 3 : 1; }
    drawEditor();
  }
  const lsKey = (id) => "mom_q_" + id; function lsGet(id) { try { return JSON.parse(localStorage.getItem(lsKey(id)) || "[]"); } catch (e) { return []; } } function lsSet(id, a) { try { if (a.length) localStorage.setItem(lsKey(id), JSON.stringify(a)); else localStorage.removeItem(lsKey(id)); } catch (e) { /* ignore */ } }
  function drawEditor() {
    const D = S.det, m = D.meeting, w = canWrite(), ro = w ? "" : " disabled", people = S.load.people || [];
    const att = m.attendees || [];
const step = S.step || 3, N = [[1, "Meeting info", "who, when, where"], [2, "Discuss", "speak or type"], [3, "Points", D.points.length + " recorded"]];
    const bar = `<div class="steps noprint">${N.map(([n, t, sm]) => `<button class="stp${step === n ? " on" : ""}" data-step="${n}"><b>${n}</b><span>${t}<small>${sm}</small></span></button>`).join("")}</div><p class="guide noprint" id="guide">${GUIDE[step]}</p>`;
    const sp = (n, h) => `<div data-sp="${n}"${step === n ? "" : ' class="hide"'}>${h}</div>`;
    $("#meet").innerHTML = `<div class="row noprint"><a class="btn o s" href="#go=meet" id="back">← All meetings</a><b style="font-size:17px">${esc(m.meeting_no)}</b><span class="chip ${m.status === "closed" ? "g" : m.status === "void" ? "x" : "a"}">${m.status === "open" ? "In progress" : m.status === "closed" ? "Finalised" : "Void"}</span><span class="grow"></span>
      <button class="btn o" id="prn">🖨 Print</button>${ed() && m.status === "open" ? '<button class="btn" id="fin">✔ Finalise minutes</button>' : ""}${ed() && m.status === "closed" ? '<button class="btn" id="reo">✎ Edit minutes</button>' : ""}${QP.ctx && QP.ctx.role === "admin" ? `<details class="mm"><summary class="btn o">⋯</summary><div>${m.status !== "void" ? '<button class="btn o" id="vd">Void this meeting</button>' : ""}<button class="btn o" id="del" style="color:#b91c1c;border-color:#b91c1c">Delete permanently</button></div></details>` : ""}</div>
    ${m.status === "closed" ? '<div class="msg ok">These minutes are finalised and locked. You can still update the status, target date and remarks of each point. To change anything else press “Edit minutes”.</div>' : ""}
${bar}
    ${sp(1, `    <div class="card"><h3>Meeting info</h3><div class="frm">
      <div style="grid-column:1/-1"><label>Meeting subject *</label><input id="h_title" value="${esc(m.title)}"${ro}></div>
      <div><label>Date *</label><input id="h_date" type="date" value="${esc(String(m.meeting_date || "").slice(0, 10))}"${ro}></div>
      <div><label>Start</label><input id="h_st" type="time" value="${tm(m.start_time)}"${ro}></div><div><label>End</label><input id="h_en" type="time" value="${tm(m.end_time)}"${ro}></div>
      <div><label>Place / online link</label><input id="h_venue" value="${esc(m.venue || "")}"${ro}></div>
      <div><label>Chairperson</label><input id="h_chair" list="h_dl" value="${esc(m.chairperson || "")}"${ro}></div><div><label>Minute-taker</label><input id="h_scribe" list="h_dl" value="${esc(m.scribe || "")}"${ro}></div>
      <div><label>Language of the meeting</label><select id="h_lang"${ro}>${langOpts(m.language || "en-IN")}</select></div>
</div>
      <details class="opt"><summary>More details (optional): meeting type, agenda, previous minutes, next meeting, who gets the minutes</summary><div class="frm" style="margin-top:8px">      <div><label>Type</label><select id="h_type" data-add${ro}>${opts(TYPES.includes(m.mtype) || !m.mtype ? TYPES : [...TYPES, m.mtype], m.mtype)}</select></div>
      <div><label>Previous minutes (ref.)</label><input id="h_prev" value="${esc(m.prev_ref || "")}" placeholder="e.g. MOM-2610-0003"${ro}></div><div><label>Next meeting</label><input id="h_next" type="date" value="${esc(String(m.next_date || "").slice(0, 10))}"${ro}></div>
      <div style="grid-column:1/-1"><label>Agenda</label><textarea id="h_agenda" rows="2"${ro}>${esc(m.agenda || "")}</textarea></div>
      <div style="grid-column:1/-1"><label>Distribution (who receives the minutes)</label><input id="h_dist" value="${esc(m.distribution || "")}" placeholder="e.g. All HODs, Customer quality, Purchase"${ro}></div></div></details><datalist id="h_dl">${people.map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>
      <h3 style="margin-top:14px">Who attended</h3><table id="atn"><thead><tr><th>Name</th><th>Function / role</th><th>E-mail</th><th>Present</th><th></th></tr></thead><tbody>${att.map((a, i) => attRow(a, i, w)).join("")}</tbody></table>
      ${w ? `<div class="row" style="margin-top:8px"><button class="btn o s" id="atAdd">+ Add attendee</button><select id="atPick" data-multi style="max-width:320px"><option value="">Add from the CFT team…</option>${people.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}${p.role ? " · " + esc(p.role) : ""}</option>`).join("")}</select><button class="btn o s" id="atPickGo">Add selected</button></div>` : ""}
      ${w ? '<div class="row" style="margin-top:12px"><button class="btn" id="hsave">Save and continue →</button></div>' : ""}</div><div class="row noprint" style="margin-top:10px">${!w ? '<button class="btn" data-step="2">Next: Discuss →</button>' : ""}</div>`)}
    ${sp(2, `${capturePanel(m, w)}<div class="row noprint"><button class="btn o" data-step="1">← Back</button><button class="btn" data-step="3">Next: Points →</button></div>`)}
    ${sp(3, `    <div class="card"><div class="row"><h3 style="margin:0">Points · what was decided</h3><span class="grow"></span>${w ? '<button class="btn" id="pnew2">+ Add point</button>' : ""}${hasF("mom.translation") && D.points.length ? '<button class="btn o" id="trAll">🌐 Translate all</button>' : ""}</div>
      <p class="note">Each point has an owner and a target date. Press Edit on a point to change it or to mark it Done. To make the points again from the discussion text, go back to Discuss.</p>${pointsTable()}</div><div class="row noprint" style="margin-top:10px"><button class="btn o" data-step="2">← Back to Discuss</button>${ed() && m.status === "open" ? '<button class="btn" id="fin2">✔ Finalise minutes</button>' : ""}</div>`)}`;
    bindEditor();
  }
  const attRow = (a, i, w) => `<tr data-ai="${i}"><td><input data-af="name" value="${esc(a.name || "")}"${w ? "" : " disabled"}></td><td><input data-af="function" value="${esc(a.function || "")}"${w ? "" : " disabled"}></td><td><input data-af="email" value="${esc(a.email || "")}"${w ? "" : " disabled"}></td><td style="text-align:center"><input type="checkbox" class="tw" data-af="present" ${a.present === false ? "" : "checked"}${w ? "" : " disabled"}></td><td>${w ? `<button class="btn o s" data-ad="${i}">✕</button>` : ""}</td></tr>`;
  function attendees() { return [...document.querySelectorAll("#atn tbody tr")].map((tr) => ({ name: tr.querySelector('[data-af="name"]').value.trim(), function: tr.querySelector('[data-af="function"]').value.trim(), email: tr.querySelector('[data-af="email"]').value.trim(), present: tr.querySelector('[data-af="present"]').checked })).filter((a) => a.name); }
  function capturePanel(m, w) {
    const segs = S.det.segments, txt = segs.map((g) => g.text).join("\n");
    if (!w) return segs.length ? `<div class="card"><h3>Discussion text</h3><textarea rows="10" disabled>${esc(txt)}</textarea></div>` : '<div class="card"><h3>Discussion text</h3><p class="mut">No discussion was recorded.</p></div>';
    const voiceOK = hasF("mom.voice-capture");
    return `<div class="vp${S.state === "listening" ? " rec" : ""}" id="vp"><div class="row"><h3 style="margin:0">🎙 Speak or type the discussion</h3><span class="grow"></span>${S.state === "listening" ? '<span><span class="dot"></span>Recording</span>' : ""}</div>
      ${!voiceOK ? '<div class="lock">Voice is not part of your plan. You can still type the discussion below.</div>' : !LG.supported ? '<div class="lock">Voice needs Chrome, Edge or Safari. You can still type the discussion below.</div>' : `
      <div class="frm"><div><label>Language spoken (choose up to 3 if people switch languages)</label><select id="vlang" data-multi>${langOpts(S.vl || m.language || "en-IN")}</select></div>
        <div><label>Who is speaking (optional)</label><select id="vspk"><option value="">Not specified</option>${(m.attendees || []).map((a) => `<option${a.name === S.lastSpeaker ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div></div>
      <div class="row" style="margin-top:10px"><button class="btn" id="vgo"${S.state === "listening" ? " disabled" : ""}>${S.state === "paused" ? "▶ Resume" : "● Start recording"}</button><button class="btn o" id="vpause"${S.state === "listening" ? "" : " disabled"}>⏸ Pause</button><button class="btn o" id="vstop"${S.state === "stopped" ? " disabled" : ""}>■ Stop</button><span class="mut" id="vstat">${vstat()}</span></div>
      <div class="live" id="live">${S.interim ? esc(S.interim) : '<i>Press “Start recording” and speak. Your words appear in the text below, in the language you spoke, and are saved automatically.</i>'}</div>
      <p class="note">Allow the microphone when the browser asks. Keep this page open while recording. (Chrome sends the audio to Google to convert it to text.)</p>`}
      <h3 style="margin:12px 0 4px">Discussion text <span class="mut" id="segcount">${segs.length ? "(" + segs.length + " line" + (segs.length > 1 ? "s" : "") + ")" : ""}</span></h3>
      <textarea id="tx" rows="12" placeholder="The spoken words appear here as plain text. You can also type or correct anything here. Say “point number 2”, “point number 3” … to separate the points.">${esc(txt)}</textarea>
      <div class="row" style="margin-top:10px">${hasF("mom.translation") ? `<label class="lbl" style="margin:0">Write the points in</label><select id="pl_to" style="max-width:260px"><option value="">Same language as spoken</option>${langOpts("")}</select>` : ""}<button class="btn" id="mkpts">✨ Understand and make points</button><span class="mut" id="mkst"></span></div>
      <p class="note">One click: the app reads the text above, separates the points, tidies the wording and picks the owner and target date if they are spoken. The points appear on the next screen (Points). This works by rules, not by a full AI, so please check the points.</p></div>`;
  }
  const vstat = () => `${S.state === "listening" ? "Listening in " + esc(lname(S.rec ? S.rec.lang : "")) : S.state === "paused" ? "Paused" : "Not recording"} · saved ${S.saved}${S.q.length ? " · waiting to save " + S.q.length : ""}`;
  function pointsTable() {
    const P = S.det.points, w = canWrite(), ed2 = ed(); if (!P.length) { const ns = S.det.segments.filter((g) => g.id).length; return `<div class="empty"><b>No points yet.</b><br>${ns ? `The discussion text has <b>${ns}</b> line${ns > 1 ? "s" : ""} that are not points yet. ${w ? '<br><button class="btn s" id="segAll" style="margin-top:8px">Understand and make points</button>' : "<br>To turn them into points press <b>Edit minutes</b> (top right), then <b>Understand and make points</b>."}` : 'Go to <a href="#" data-step="2">step 2 · Discuss</a> to speak or type the discussion, or press <b>+ Add point</b>.'}</div>`; }
    const sub = (l, v) => (v ? `<div class="sub"><span>${l}</span> ${esc(v)}</div>` : "");
    return `<table class="pts"><thead><tr><th>S.No</th><th>Point</th><th>Owner</th><th>Target date</th><th>Status</th><th></th></tr></thead><tbody>${P.map((p, i) => {
      const tr = p.translations || {}, keys = Object.keys(tr);
      return `<tr data-pt="${p.id}"><td>${i + 1}</td><td class="t5">${p.topic ? `<div class="mut" style="font-size:12px">${esc(p.topic)}</div>` : ""}<b>${esc(p.what)}</b>${p.source === "voice" ? ' <span title="Made from the discussion text">🎙</span>' : ""}${sub("Why", p.why)}${sub("Where", p.where_at)}${sub("How", p.how)}${keys.length ? `<div>${keys.map((k) => `<span class="pill" data-showtr="${p.id}|${k}" style="cursor:pointer" title="Show translation">${esc(lname(k))}</span>`).join("")}</div><small class="tr" data-trbox="${p.id}"></small>` : ""}</td>
        <td class="t5">${esc(p.who || "")}</td><td>${dueChip(p.when_on, p.status)}${p.when_note ? `<div class="mut">${esc(p.when_note)}</div>` : ""}</td><td>${stChip(p.status)}<div class="mut" style="font-size:11px">${esc(p.ptype || "")}</div></td>
        <td style="white-space:nowrap">${ed2 ? `<button class="btn o s" data-pe="${p.id}">${w ? "Edit" : "Update"}</button>` : ""}${hasF("mom.translation") ? ` <button class="btn o s" data-pt-tr="${p.id}" title="Translate this point">🌐</button>` : ""}${w ? ` <button class="btn o s" data-pd="${p.id}" title="Delete this point">✕</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function bindEditor() {
    const D = S.det, m = D.meeting;
    $("#back").onclick = (e) => { e.preventDefault(); if (S.state === "listening" && !confirm("Recording is still running. Stop it and leave?")) return; stopRec(); go("go=meet"); };
    $("#prn").onclick = printMinutes; if ($("#fin")) $("#fin").onclick = finalise;
    if ($("#reo")) $("#reo").onclick = async () => { try { await call("kmr_mom_reopen", { p_id: m.id }); S.det = null; await openMeeting(m.id); say("Minutes opened for editing. Press Finalise when done.", true); } catch (e) { say(/permission denied for function/i.test(e.message) ? "The database has not been updated for editing finalised minutes yet. Ask the administrator to run the update \u201C0071_mom_grants\u201D in Supabase (one-time), then try again." : e.message); } };
    if ($("#del")) $("#del").onclick = () => { if (!confirm("Delete " + m.meeting_no + " permanently, with all its points and transcript? This cannot be undone.\n\n(To keep the record, use Void instead.)")) return; call("kmr_mom_delete", { p_id: m.id }).then(() => { S.det = null; return loadAll().then(() => { go("go=meet"); say("Meeting deleted.", true); }); }).catch((e) => say(e.message)); };
    if ($("#vd")) $("#vd").onclick = () => { const r = prompt("Reason for voiding this meeting record?"); if (r === null) return; call("kmr_mom_void", { p_id: m.id, p_reason: r }).then(() => go("go=meet")).catch((e) => say(e.message)); };
    if ($("#hsave")) $("#hsave").onclick = () => saveHeader(true);
    if ($("#atAdd")) $("#atAdd").onclick = () => { $("#atn tbody").insertAdjacentHTML("beforeend", attRow({ present: true }, 99, true)); };
    if ($("#atPickGo")) $("#atPickGo").onclick = () => { const codes = V("atPick").split(", ").filter(Boolean); const have = attendees().map((a) => a.name); codes.forEach((c) => { const p = (S.load.people || []).find((x) => x.code === c); if (p && !have.includes(p.name)) $("#atn tbody").insertAdjacentHTML("beforeend", attRow({ name: p.name, function: p.function || p.role || "", email: p.email || "", present: true }, 99, true)); }); $("#atPick").value = ""; };
    $("#atn").addEventListener("click", (e) => { const b = e.target.closest("[data-ad]"); if (b) b.closest("tr").remove(); });
        if ($("#pnew2")) $("#pnew2").onclick = () => pointDialog(null);
    if ($("#fin2")) $("#fin2").onclick = finalise;
    if ($("#segAll")) $("#segAll").onclick = understand;
    bindSteps();
    if ($("#trAll")) $("#trAll").onclick = () => translateDialog(D.points.map((p) => p.id));
    bindPoints(); bindVoice(); bindText();
  }
  function setStep(n) { S.step = n; document.querySelectorAll("[data-sp]").forEach((d) => d.classList.toggle("hide", +d.dataset.sp !== n)); document.querySelectorAll(".stp").forEach((b) => b.classList.toggle("on", +b.dataset.step === n)); const g = $("#guide"); if (g) g.textContent = GUIDE[n]; window.scrollTo(0, 0); }
  function bindSteps() { document.querySelectorAll("[data-step]").forEach((b) => (b.onclick = async (e) => { e.preventDefault(); if (S.step === 2 && +b.dataset.step !== 2) { try { await syncText(); } catch (x) { say(x.message); } } setStep(+b.dataset.step); })); }
  function bindPoints() {
    document.querySelectorAll("[data-pe]").forEach((b) => (b.onclick = () => pointDialog(S.det.points.find((p) => p.id === b.dataset.pe))));
    document.querySelectorAll("[data-pt-tr]").forEach((b) => (b.onclick = () => translateDialog([b.dataset.ptTr])));
    document.querySelectorAll("[data-pd]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this point?")) return; try { await call("kmr_mom_point_delete", { p_id: b.dataset.pd }); await refresh(); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-showtr]").forEach((b) => (b.onclick = () => { const [id, k] = b.dataset.showtr.split("|"), p = S.det.points.find((x) => x.id === id), t = (p.translations || {})[k] || {}, box = document.querySelector(`[data-trbox="${id}"]`); box.innerHTML = `<b>${esc(lname(k))}:</b> ${esc(t.what || "")}${t.why ? " — " + esc(t.why) : ""}${t.how ? " | " + esc(t.how) : ""}`; }));
  }
  async function refresh() { const keep = S.det.segments.filter((g) => !g.id); S.det = await call("kmr_mom_get", { p_id: S.det.meeting.id }); S.det.segments.push(...keep); const y = window.scrollY; drawEditor(); window.scrollTo(0, y); }
  async function saveHeader(next) {
    try {
      const m = S.det.meeting;
      await call("kmr_mom_save", { p: { id: m.id, title: V("h_title"), mtype: V("h_type"), meeting_date: V("h_date"), start_time: V("h_st") || null, end_time: V("h_en") || null, venue: V("h_venue"), chairperson: V("h_chair"), scribe: V("h_scribe"), language: V("h_lang"), prev_ref: V("h_prev"), next_date: V("h_next") || null, agenda: V("h_agenda"), distribution: V("h_dist"), attendees: attendees() } });
      const keep = S.det.segments.filter((g) => !g.id); S.det = await call("kmr_mom_get", { p_id: m.id }); S.det.segments.push(...keep); say("Details saved.", true); const y = window.scrollY; if (next === true) S.step = 2; drawEditor(); window.scrollTo(0, next === true ? 0 : y);
    } catch (e) { say(e.message); }
  }
  /* Step 2 -> 3: read the discussion text and make the points (rule based, see MOMLang.frame) */
  async function syncText() {   // save what is in the text box back to the transcript lines (one line = one saved line)
    const ta = $("#tx"); if (!ta || !canWrite()) return true;
    if (S.q.length) { await flush(); if (S.q.length) return false; }
    const lines = ta.value.split("\n").map((x) => x.trim()).filter(Boolean), segs = S.det.segments.filter((g) => g.id), mid = S.det.meeting.id;
    for (let i = 0; i < Math.min(lines.length, segs.length); i++) if (lines[i] !== segs[i].text) { await call("kmr_mom_seg_update", { p_id: segs[i].id, p_text: lines[i] }); segs[i].text = lines[i]; }
    for (let i = lines.length; i < segs.length; i++) { await call("kmr_mom_seg_delete", { p_id: segs[i].id }); S.det.segments = S.det.segments.filter((g) => g.id !== segs[i].id); }
    const add = lines.slice(segs.length).map((t) => ({ client_id: uid(), lang: S.det.meeting.language || "", text: t, spoken_at: new Date().toISOString(), speaker: "" }));
    if (add.length) { const res = await call("kmr_mom_seg_save", { p: { meeting_id: mid, segs: add } }), ids = (res && res.ids) || {}; add.forEach((g) => S.det.segments.push(Object.assign({ id: ids[g.client_id] || null }, g))); }
    segCount(); return true;
  }
  function segCount() { const c = $("#segcount"), n = S.det.segments.length; if (c) c.textContent = n ? `(${n} line${n > 1 ? "s" : ""})` : ""; }
  async function understand() {
    if (!canWrite()) return;
    const m = S.det.meeting, st = $("#mkst"), btn = $("#mkpts"), note = (t) => { if (st) st.textContent = t; };
    try {
      if (btn) btn.disabled = true; note("Reading the text…");
      if (!(await syncText())) { say("Some lines are not saved yet. Check the connection and try again."); return; }
      const segs = S.det.segments.filter((g) => g.id); if (!segs.length) { say("There is no discussion text yet. Speak or type it first."); return; }
      const old = S.det.points.filter((p) => p.source === "voice");
      if (old.length && !confirm(`${old.length} point${old.length > 1 ? "s were" : " was"} made from the discussion before. Replace ${old.length > 1 ? "them" : "it"} with new points made from the text now?\n\n(Points you typed yourself are kept.)`)) return;
      const fr = LG.frame(segs.map((g) => g.text), { names: (m.attendees || []).map((a) => a.name), today: today() });
      if (!fr.points.length) { say("Could not find any point in the text. Type a little more, or use + Add point on the Points screen."); return; }
      const from = segs[0].lang || m.language || "en-IN", to = V("pl_to"); let lang = from, warn = "";
      if (to && to !== from) {
        try { note("Translating…"); const w = []; for (const p of fr.points) w.push(await LG.translate(p.what, from, to)); const tp = fr.topic ? await LG.translate(fr.topic, from, to) : ""; fr.points.forEach((p, i) => (p.what = w[i])); fr.topic = tp; lang = to; }
        catch (e) { warn = " The translation did not work (" + e.message + "), so the points are in the spoken language."; }
      }
      note("Making points…");
      for (const p of old) await call("kmr_mom_point_delete", { p_id: p.id });
      for (const p of fr.points) await call("kmr_mom_point_save", { p: { id: null, meeting_id: m.id, topic: fr.topic || "", what: p.what, ptype: p.ptype, status: "Open", lang, source: "voice", seg_ids: [], who: p.who, when_on: p.when_on } });
      S.step = 3; await refresh(); window.scrollTo(0, 0); say(`${fr.points.length} point${fr.points.length > 1 ? "s" : ""} made. Please check the wording, owner and target date.` + warn, !warn);
    } catch (e) { say(e.message); note(""); if (btn) btn.disabled = false; }
  }
  async function finalise() {
    if (S.q.length) { await flush(); if (S.q.length) return say("Some transcript lines are not saved yet. Check the connection and try again."); }
    if (!S.det.points.length && S.det.segments.some((g) => g.id)) {
      if (confirm(`There is discussion text but no points yet, so the Points list would be empty.\n\nOK = understand the text and make the points now (you can edit them, then finalise)\nCancel = go back`)) { await understand(); }
      return;
    }
    if (S.state !== "stopped") { if (!confirm("Recording is on. Stop it and finalise the minutes?")) return; stopRec(); }
    if (!confirm("Finalise these minutes? Points will be locked (action status and remarks can still be updated).")) return;
    try { await saveHeader(); await call("kmr_mom_close", { p_id: S.det.meeting.id }); S.det = null; await openMeeting(hashM()); say("Minutes finalised.", true); } catch (e) { say(e.message); }
  }

  /* ================= point dialog ================= */
  function pointDialog(p, pre) {
    const w = canWrite(), fieldsRo = w ? "" : " disabled", m = S.det.meeting, names = (m.attendees || []).map((a) => a.name);
    p = p || Object.assign({ ptype: "Discussion", status: "Open", lang: m.language || "en-IN", source: "typed" }, pre || {});
    open(`<h3>${p.id ? (w ? "Edit point" : "Update point") : "New point"}</h3>${!w && p.id ? '<p class="note">The minutes are finalised — only status, remarks and the target date can change.</p>' : ""}
      <div class="w5">
      <div class="f1"><label>Point — what was discussed / decided / to be done *</label><textarea id="p_what" rows="3" placeholder="e.g. Replace the worn deburring tool"${fieldsRo}>${esc(p.what || "")}</textarea></div>
      <div><label>Owner (who is responsible)</label><input id="p_who" list="p_dl" value="${esc(p.who || "")}"${fieldsRo}></div>
      <div><label>Target date</label><input id="p_when" type="date" value="${esc(String(p.when_on || "").slice(0, 10))}"></div>
      <div><label>Type</label><select id="p_type"${fieldsRo}>${opts(PT, p.ptype)}</select></div>
      <div><label>Status</label><select id="p_status">${opts(ST, p.status)}</select></div>
      <div class="f1"><label>Remarks / follow-up</label><input id="p_rem" value="${esc(p.remarks || "")}"></div>
      <div class="f1"><details class="opt"><summary>More options: topic, language, date note</summary><div class="w5" style="margin-top:8px">
        <div><label>Topic / agenda item</label><input id="p_topic" value="${esc(p.topic || "")}"${fieldsRo}></div>
        <div><label>Language of the text</label><select id="p_lang"${fieldsRo}>${langOpts(p.lang || "en-IN")}</select></div>
        <div class="f1"><label>Date note</label><input id="p_wnote" value="${esc(p.when_note || "")}" placeholder="e.g. before next review"${fieldsRo}></div></div></details></div></div><datalist id="p_dl">${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="row" style="margin-top:12px"><button class="btn" id="p_ok">Save</button>${w && !p.id ? '<button class="btn o" id="p_more">Save and add another</button>' : ""}${w ? '<button class="btn o" id="p_sug" title="Fill Owner and Target date from the words in the point">Fill Owner / Date for me</button>' : ""}<button class="btn o" id="p_x">Cancel</button></div><div id="p_err"></div>`);
    $("#p_x").onclick = closeM;
    if ($("#p_what") && w) $("#p_what").addEventListener("input", () => { const d = LG.detect($("#p_what").value); if (d.tag && d.certain) $("#p_lang").value = d.tag; });
    if ($("#p_sug")) $("#p_sug").onclick = () => { const t = V("p_what"); if (!V("p_who")) $("#p_who").value = LG.guessWho(t, names); if (!V("p_when")) $("#p_when").value = LG.guessWhen(t, today()); };
    const save = async (again) => {
      try {
        const body = { id: p.id || null, meeting_id: m.id, topic: V("p_topic"), what: V("p_what"), why: p.why || "", who: V("p_who"), when_on: V("p_when") || null, when_note: V("p_wnote"), where_at: p.where_at || "", how: p.how || "", ptype: V("p_type"), status: V("p_status"), lang: V("p_lang"), remarks: V("p_rem"), source: p.source || "typed", seg_ids: p.seg_ids || [] };
        if (!w && p.id) { body.what = p.what; body.topic = p.topic; body.who = p.who; body.ptype = p.ptype; body.lang = p.lang; body.when_note = p.when_note; }
        await call("kmr_mom_point_save", { p: body }); closeM(); await refresh(); if (again) pointDialog(null);
      } catch (e) { $("#p_err").innerHTML = `<div class="msg">${esc(e.message)}</div>`; }
    };
    $("#p_ok").onclick = () => save(false); if ($("#p_more")) $("#p_more").onclick = () => save(true);
  }

  /* ================= translation ================= */
  function translateDialog(ids) {
    open(`<h3>Translate ${ids.length === 1 ? "this point" : ids.length + " points"}</h3><p class="note">Choose one or more languages. The translation is stored with the point and can be printed. Machine translation — check important wording.</p>
      <label class="lbl">Translate into</label><select id="t_to" data-multi><option value="">Choose languages…</option>${langOpts("")}</select>
      <div class="row" style="margin-top:12px"><button class="btn" id="t_ok">Translate</button><button class="btn o" id="t_x">Close</button></div><div id="t_st" class="note"></div>`);
    $("#t_x").onclick = closeM;
    $("#t_ok").onclick = async () => {
      const tos = V("t_to").split(", ").filter(Boolean); if (!tos.length) { $("#t_st").textContent = "Choose at least one language."; return; }
      $("#t_ok").disabled = true;
      try {
        for (const id of ids) {
          const p = S.det.points.find((x) => x.id === id); if (!p) continue;
          for (const to of tos) {
            $("#t_st").textContent = `Translating to ${lname(to)}…`; const tr = {};
            for (const f of ["topic", "what", "why", "where_at", "how", "remarks"]) if (p[f]) tr[f] = await LG.translate(p[f], p.lang || LG.detect(p[f]).tag || "", to);
            await call("kmr_mom_translate_save", { p_id: id, p_lang: to, p_tr: tr });
          }
        }
        closeM(); await refresh(); say("Translation saved.", true);
      } catch (e) { $("#t_st").innerHTML = `<div class="msg">${esc(e.message)}</div>`; $("#t_ok").disabled = false; }
    };
  }

  /* ================= voice ================= */
  function setStat() { const e = $("#vstat"); if (e) e.textContent = vstat(); const v = $("#vp"); if (v) v.classList.toggle("rec", S.state === "listening"); }
  function bindVoice() {
    if (!$("#vgo")) return;
    $("#vlang").addEventListener("change", () => { const l = V("vlang").split(", ").filter(Boolean).slice(0, 3); S.vl = l.join(", "); if (S.rec) S.rec.setLangs(l); });
    $("#vspk").addEventListener("change", () => { S.lastSpeaker = V("vspk"); });
    $("#vgo").onclick = () => {
      if (S.rec && S.state === "paused") { S.rec.resume(); return; }
      const langs = (V("vlang") || "en-IN").split(", ").filter(Boolean).slice(0, 3);
      S.rec = LG.Recorder({ langs, onfinal: onFinal, oninterim: (r) => { S.interim = r.text; const l = $("#live"); if (l) l.innerHTML = r.text ? esc(r.text) : '<i>Listening…</i>'; }, onstate: (s) => { S.state = s; if (s === "stopped") S.interim = ""; const keep = $("#live") && $("#live").innerHTML; drawVoiceBtns(); setStat(); }, onlang: () => setStat(), onerror: (e) => say(e.message) });
      S.rec.start(); wake();
    };
    $("#vpause").onclick = () => S.rec && S.rec.pause(); $("#vstop").onclick = stopRec;
  }
  function drawVoiceBtns() { const g = $("#vgo"); if (!g) return; g.disabled = S.state === "listening"; g.textContent = S.state === "paused" ? "▶ Resume" : "● Start recording"; $("#vpause").disabled = S.state !== "listening"; $("#vstop").disabled = S.state === "stopped"; const l = $("#live"); if (l && S.state === "stopped") l.innerHTML = "<i>Recording stopped.</i>"; }
  function stopRec() { if (S.rec) S.rec.stop(); S.state = "stopped"; unwake(); if (S.q.length) flush(); }
  let wl = null; async function wake() { try { if (navigator.wakeLock) wl = await navigator.wakeLock.request("screen"); } catch (e) { /* not available */ } } function unwake() { try { if (wl) wl.release(); } catch (e) { /* ignore */ } wl = null; }
  function onFinal(r) {
    if (!r.text) return;
    const seg = { client_id: uid(), lang: r.lang, text: r.text, spoken_at: new Date().toISOString(), speaker: S.lastSpeaker || "" };
    S.det.segments.push(Object.assign({ id: null }, seg)); S.q.push(seg); lsSet(S.det.meeting.id, S.q);
    const ta = $("#tx"); if (ta) { ta.value += (ta.value && !ta.value.endsWith("\n") ? "\n" : "") + r.text; ta.scrollTop = ta.scrollHeight; }
    segCount();
    setStat(); clearTimeout(S.ft); S.ft = setTimeout(flush, 1200);
  }
  async function flush() {
    if (!S.q.length || S.busy || !S.det) return; S.busy = true; const batch = S.q.slice(0, 40), mid = S.det.meeting.id;
    try {
      const res = await call("kmr_mom_seg_save", { p: { meeting_id: mid, segs: batch } });
      const ids = (res && res.ids) || {}; S.q = S.q.filter((s) => !batch.includes(s)); S.saved += batch.length; lsSet(mid, S.q);
      S.det.segments.forEach((g) => { if (!g.id && ids[g.client_id]) g.id = ids[g.client_id]; });
    } catch (e) { clearTimeout(S.rt); S.rt = setTimeout(flush, 8000); say("Saving the transcript failed (" + e.message + "). It is kept on this device and will be retried."); }
    S.busy = false; setStat(); if (S.q.length && !S.rt) S.ft = setTimeout(flush, 1500);
  }
  window.addEventListener("beforeunload", (e) => { if (S.q.length || S.state === "listening") { e.preventDefault(); e.returnValue = ""; } });
  function bindText() {
    const ta = $("#tx"); if (!ta) return;
    ta.onchange = () => syncText().catch((e) => say(e.message));
    if ($("#mkpts")) $("#mkpts").onclick = understand;
  }

  /* ================= action tracker ================= */
  function drawAct() {
    const A = S.act || [], t = today(), f = V("af") || "open", ow = V("ao") || "", owners = [...new Set(A.map((a) => (a.who || "").split(",")[0].trim()).filter(Boolean))].sort();
    const rows = A.filter((a) => (f === "all" ? true : f === "open" ? !["Done", "Dropped"].includes(a.status) : f === "late" ? !["Done", "Dropped"].includes(a.status) && a.due_on && a.due_on < t : a.status === f)).filter((a) => !ow || (a.who || "").includes(ow));
    $("#act").innerHTML = `<div class="row"><select id="af" style="max-width:200px"><option value="open">Open</option><option value="late">Overdue</option><option value="In progress">In progress</option><option value="Done">Done</option><option value="all">All</option></select><select id="ao" style="max-width:220px"><option value="">All owners</option>${owners.map((o) => `<option${o === ow ? " selected" : ""}>${esc(o)}</option>`).join("")}</select><span class="mut">${rows.length} of ${A.length}</span></div>
      ${rows.length ? `<table><thead><tr><th>Meeting</th><th>Point</th><th>Owner</th><th>Target date</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((a) => `<tr><td><a href="#go=meet&m=${a.meeting_id}" data-open="${a.meeting_id}">${esc(a.meeting_no)}</a><div class="mut">${dd(a.meeting_date)}</div></td><td class="t5"><b>${esc(a.what)}</b>${a.topic ? `<div class="mut">${esc(a.topic)}</div>` : ""}</td><td>${esc(a.who || "")}</td><td>${dueChip(a.due_on, a.status)}</td><td>${esc(a.ptype || "")}</td><td>${stChip(a.status)}</td><td style="white-space:nowrap">${ed() ? `<button class="btn o s" data-ad2="${a.id}|In progress">Start</button> <button class="btn s" data-ad2="${a.id}|Done">Done</button>` : ""}</td></tr>`).join("")}</tbody></table>` : '<p class="mut">Nothing here.</p>'}`;
    $("#af").value = f; $("#af").onchange = drawAct; $("#ao").onchange = drawAct; bindList();
    document.querySelectorAll("[data-ad2]").forEach((b) => (b.onclick = async () => { const [id, st] = b.dataset.ad2.split("|"); try { await call("kmr_mom_point_save", { p: { id, status: st } }); await loadAct(); drawAct(); } catch (e) { say(e.message); } }));
  }

  /* ================= printed minutes ================= */
  function printMinutes() {
    const D = S.det, m = D.meeting, P = D.points, langs = [...new Set(P.flatMap((p) => Object.keys(p.translations || {})))];
    open(`<div class="row noprint"><b class="grow">Print minutes</b>${langs.length ? `<label class="lbl" style="margin:0">Language</label><select id="pl" style="max-width:220px"><option value="">Original</option>${langs.map((l) => `<option value="${l}">${esc(lname(l))}</option>`).join("")}</select>` : ""}<button class="btn" id="pgo">Print</button><button class="btn o" id="pcl">Close</button></div><div id="pdoc"></div>`);
    const draw = () => {
      const L = V("pl") || "", g = (p, f) => (L && p.translations && p.translations[L] && p.translations[L][f]) || p[f] || "";
      $("#pdoc").innerHTML = `<div class="doc"><div class="hd"><div><h2>MINUTES OF MEETING</h2><div>${esc(S.ctxName || QP.ctx.company)}</div></div><div style="text-align:right"><b>${esc(m.meeting_no)}</b><br>${m.status === "closed" ? "Finalised" : "Draft"}</div></div>
        <table class="hdr" style="width:100%;margin:8px 0"><tr><th>Subject</th><td colspan="3">${esc(m.title)}</td></tr><tr><th>Type</th><td>${esc(m.mtype || "")}</td><th>Date</th><td>${dd(m.meeting_date)} ${tm(m.start_time)}${m.end_time ? " – " + tm(m.end_time) : ""}</td></tr><tr><th>Venue</th><td>${esc(m.venue || "")}</td><th>Language</th><td>${esc(lname(m.language))}</td></tr><tr><th>Chairperson</th><td>${esc(m.chairperson || "")}</td><th>Minute-taker</th><td>${esc(m.scribe || "")}</td></tr>
        <tr><th>Previous minutes</th><td>${esc(m.prev_ref || "")}</td><th>Next meeting</th><td>${m.next_date ? dd(m.next_date) : ""}</td></tr></table>
        ${m.agenda ? `<p><b>Agenda:</b> ${esc(m.agenda).replace(/\n/g, "<br>")}</p>` : ""}
        <p><b>Attendees:</b></p><table class="hdr" style="width:100%"><tr><th style="width:5%">S.No</th><th style="width:32%;background:#eef2f7">Name</th><th style="background:#eef2f7">Function</th><th style="width:12%;background:#eef2f7">Present</th></tr>${(m.attendees || []).map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.name)}</td><td>${esc(a.function || "")}</td><td>${a.present === false ? "Absent" : "Present"}</td></tr>`).join("")}</table>
        <p><b>Discussion points:</b></p><table class="p5" style="width:100%;min-width:0"><thead><tr><th>S.No</th><th>Topic</th><th>Point</th><th>Owner</th><th>Target date</th><th>Status</th></tr></thead><tbody>${P.map((p, i) => { const lg = ["why", "where_at", "how"].map((f, k) => (g(p, f) ? `<br><i>${["Why", "Where", "How"][k]}:</i> ${esc(g(p, f))}` : "")).join(""); return `<tr><td>${i + 1}</td><td>${esc(g(p, "topic"))}</td><td>${esc(g(p, "what"))}${p.ptype && p.ptype !== "Discussion" ? `<br><i>[${esc(p.ptype)}]</i>` : ""}${lg}</td><td>${esc(p.who || "")}</td><td>${p.when_on ? dd(p.when_on) : ""}${p.when_note ? "<br>" + esc(p.when_note) : ""}</td><td>${esc(p.status)}</td></tr>`; }).join("")}</tbody></table>
        ${m.distribution ? `<p><b>Distribution:</b> ${esc(m.distribution)}</p>` : ""}<div class="sg"><span>Prepared by (minute-taker)</span><span>Reviewed by (chairperson)</span><span>Approved by</span></div></div>`;
    };
    draw(); if ($("#pl")) $("#pl").onchange = draw; $("#pgo").onclick = () => window.print(); $("#pcl").onclick = closeM;
  }

  (async () => { try { await QP.init("mom"); if (!QP.ctx) return; await route(); } catch (e) { say(e.message); } })();
})();
