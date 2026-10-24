/* Internal Audit - findings and corrective actions, special audit points, clause library, programme generator, findings dashboard, setup.
   Loaded after aud-app.js, which gives the shared helpers in window.AUD. Rules come from aud-engine.js; the clause library from aud-lib.js.
   The database enforces the same rules, so a screen cannot skip a step. */
(function () {
  "use strict";
  const A = window.AUD, { S, chip, due, opts, guard, canEdit, isAdmin, go, V, GC, STGN, dotsOf, today } = A;
  const { $, esc, fmt, say, call } = QP;
  const LB = () => window.AudLib, EN = () => window.AudEngine;
  const nl = (s) => esc(s || "").replace(/\n/g, "<br>");
  const SEVC = { Major: "r", Minor: "a" };
  const ST_ORDER = ["contain", "rca", "action", "monitor", "closed"];
  const ro1 = (ro) => (ro ? "disabled" : "");
  const seg = (items, cur, attr) => `<div class="seg" style="margin:0">${items.map((x) => `<button ${attr}="${x[0]}" class="${String(cur) === String(x[0]) ? "on" : ""}">${esc(x[1])}</button>`).join("")}</div>`;

  /* =================================================== findings register =================================================== */
  const NF = { q: "", status: "open", severity: "", owner: "", overdue: false, clause: "" };
  async function screenNc() {
    const el = $("#nc"), f = NF;
    el.innerHTML = `<div class="guide">Every finding of every audit, with the step it is at: <b>1 Contain</b> (stop it reaching the customer) → <b>2 Root cause</b> (why-why) → <b>3 Permanent action</b> → <b>4 Check effect</b> → <b>Closed</b>. Open a finding to work on it; each step is on one screen.</div>
      <div id="n_kpi"></div>
      <div class="row"><div class="grow"><input id="n_q" placeholder="Search number, clause, problem, area…" value="${esc(f.q)}"></div><select id="n_ow" style="width:auto"><option value="">Everyone</option>${opts((S.L.owners || []).map((o) => [o, o]), f.owner)}</select>
        ${seg([["", "Major and Minor"], ["Major", "Major"], ["Minor", "Minor"]], f.severity, "data-sv")}${seg([["open", "Open"], ["closed", "Closed"], ["all", "All"]], f.status, "data-st")}<button class="btn o s${f.overdue ? " on" : ""}" id="n_od" style="${f.overdue ? "background:var(--b1);color:#fff" : ""}">Late only</button><button class="btn o" id="n_pr">Print list</button></div>
      ${f.clause ? `<div class="row"><span class="chip v">Clause ${esc(f.clause)}</span><button class="btn o s" id="n_cc">Show all clauses</button></div>` : ""}<div id="n_body"></div>`;
    const load = async () => {
      const list = await call("kmr_aud_nc_list", { p: { q: f.q, status: f.status, severity: f.severity, owner: f.owner, clause: f.clause, overdue: f.overdue ? "true" : "" } }); S.nlist = list;
      const by = {}; list.forEach((x) => (by[x.status] = (by[x.status] || 0) + 1));
      $("#n_kpi").innerHTML = `<div class="kpis">${["contain", "rca", "action", "monitor"].map((k) => `<div class="kpi" style="cursor:default"><b>${by[k] || 0}</b><span>${esc(STGN[k])}</span></div>`).join("")}<div class="kpi" style="--c:var(--r);cursor:default"><b>${list.filter((x) => x.overdue).length}</b><span>late</span></div></div>`;
      $("#n_body").innerHTML = list.length ? list.map((n) => `<div class="t" data-n="${n.id}" style="--pc:var(--${n.overdue ? "r" : n.severity === "Major" ? "a" : "b1"})"><div class="tb"><div class="tt">${esc((n.problem || "").replace(/ \(Requirement:.*$/, "")).slice(0, 220)}</div>
        <div class="tm"><b>${esc(n.no)}</b> ${chip(n.severity, SEVC[n.severity])} ${chip(STGN[n.status] || n.status, n.status === "closed" ? "g" : "b")} ${dotsOf(n.status)} ${n.loops ? chip("Not effective " + n.loops + "×", "r") : ""}${n.repeat_of ? chip("Repeat", "r") : ""}<span>${esc((n.standard || "") + " " + (n.clause || ""))}</span><span>${esc(n.area || "")}</span></div>
        <div class="tm"><span>${esc(n.audit_no)}</span><span>${esc(n.owner || "no owner")}</span><span>${n.status === "closed" ? "closed " + fmt(n.closed_on) : "next step due " + due(n.next_due)}</span><span>${n.age} days</span></div></div></div>`).join("")
        : `<div class="empty">${f.q || f.severity || f.owner || f.clause || f.overdue || f.status !== "all" ? "No finding matches." : "No finding yet."}<br>Findings appear here when an audit question is answered Partly, Does not meet, or rated below 10.</div>`;
      el.querySelectorAll("[data-n]").forEach((e) => (e.onclick = () => go("go=nc&id=" + e.dataset.n)));
    };
    let tm; $("#n_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    $("#n_ow").onchange = (e) => { f.owner = e.target.value; guard(load); };
    el.querySelectorAll("[data-sv]").forEach((b) => (b.onclick = () => { f.severity = b.dataset.sv; el.querySelectorAll("[data-sv]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    $("#n_od").onclick = () => { f.overdue = !f.overdue; screenNc(); };
    const cc = $("#n_cc"); if (cc) cc.onclick = () => { f.clause = ""; screenNc(); };
    $("#n_pr").onclick = () => A.showDoc(AudDocs.ncList(S.nlist || [], [f.status, f.severity, f.owner, f.overdue ? "late only" : "", f.clause].filter((x) => x && x !== "all").join(", ")));
    await load();
  }

  /* =================================================== one finding on one screen =================================================== */
  let N = null, NDIRTY = false;
  const chipsFor = (list, tgt, label) => (list && list.length ? `<div class="sugs"><small class="mut">${label}</small> ${list.map((t, i) => `<button type="button" class="sgc" data-ins="${tgt}" data-i="${i}">${esc(t)}</button>`).join("")}</div>` : "");
  function stepBox(id, no, title, sub, state, body, open) {
    return `<details class="stp ${state}" id="stp_${id}" ${open ? "open" : ""}><summary><span class="sn">${state === "done" ? "✓" : no}</span><span class="st">${esc(title)}<small>${esc(sub)}</small></span></summary><div class="sb">${body}</div></details>`;
  }
  function ncPage(n) {
    const ro = !n.can_edit, rec = LB().recFor(n.cat || "cap"), st = n.status, ix = ST_ORDER.indexOf(st), dd = EN().dueFor(n.severity, n.created_at || today(), S.L.settings);
    const R = { c: rec.c.slice(0, 2).join(" "), p: rec.p[0], e: rec.e[0] }, fill = !ro;
    /* recommended text goes into empty fields so nobody starts from a blank page; it is saved only when the user presses Save */
    const pre = { contain_action: n.contain_action || (fill ? R.c : ""), contain_owner: n.contain_owner || (fill ? n.owner || "" : ""), perm_action: n.perm_action || (fill && ix >= 1 ? R.p : ""), perm_owner: n.perm_owner || (fill ? n.owner || "" : ""),
      perm_due: n.perm_due || (fill ? n.resp_due || "" : ""), horizontal: n.horizontal || (fill ? rec.h : ""), mon_method: n.mon_method || (fill ? "reaudit" : ""), mon_criteria: n.mon_criteria || (fill ? R.e : ""), mon_days: n.mon_days || dd.monitorDays, atype: (n.atype || []).length ? n.atype : [] };
    const filled = fill && (!n.contain_action || !n.perm_action || !n.horizontal || !n.mon_criteria);
    const whys = (n.whys || []).slice(); while (whys.length < 3) whys.push("");
    const probs = EN().checkWhys({ whys: n.whys, root_cause: n.root_cause, escape_cause: n.escape_cause, systemic: n.systemic });
    const rcaOk = !probs.length;
    const inp = (id, v, ph, extra) => `<input id="${id}" value="${esc(v || "")}" placeholder="${esc(ph || "")}" ${ro1(ro)} ${extra || ""}>`;
    const ta = (id, v, ph, rows) => `<textarea id="${id}" rows="${rows || 3}" placeholder="${esc(ph || "")}" ${ro1(ro)}>${esc(v || "")}</textarea>`;
    const step1 = `${chipsFor(rec.c, "n_ca", "Recommended containment (tap to add):")}<div class="sg"><div class="w"><label>What was done at once to stop it reaching the customer</label>${ta("n_ca", pre.contain_action, "Sorted 100%, quarantined, informed the customer…", 3)}</div>
      <div class="w"><label>Quantity checked, sorted, scrapped or held</label>${inp("n_cq", n.contain_qty, "For example: 480 checked, 12 scrapped, 2 lots on hold")}</div>
      <div><label>Done by</label>${inp("n_co", pre.contain_owner, "", 'list="own"')}</div><div><label>Due date</label><input id="n_cd" type="date" value="${esc(n.contain_due || "")}" ${ro1(ro)}></div>
      <div><label>Containment done on</label><input id="n_cx" type="date" value="${esc(n.contain_done_on || "")}" ${ro1(ro)}></div>${ro ? "" : '<div style="align-self:end"><button class="btn o s" id="n_cx_t">Done today</button></div>'}</div>`;
    const step2 = `<div class="guide">Ask <b>why</b> until you reach a gap in the <b>system</b> (a missing step, check, document or control). A person is never the root cause: if the answer is "operator forgot", ask why the system let a person forget.</div>
      ${chipsFor(rec.s, "n_w", "Typical system causes in this kind of gap (tap to use as a why):")}<div class="whys" id="n_whys">${whys.map((w, i) => `<div class="wr"><b>Why ${i + 1}</b><input data-w value="${esc(w)}" placeholder="${i === 0 ? "Why did the problem happen?" : "Why did that happen?"}" ${ro1(ro)}></div>`).join("")}</div>
      ${ro ? "" : '<div class="row" style="margin-top:6px"><button class="btn o s" id="n_wadd">+ Add a why</button><button class="btn o s" id="n_wuse">Use the last why as the root cause</button></div>'}
      <div class="sg" style="margin-top:8px"><div class="w"><label>Root cause (one sentence: the system gap)</label>${ta("n_rc", n.root_cause, "For example: The release of a new revision has no step to withdraw the old copy.", 2)}</div>
      <div class="w"><label>Why was it not detected earlier? Which check should have caught it?</label>${ta("n_ec", n.escape_cause, "For example: The layered process audit does not check the control plan.", 2)}</div>
      <div class="w"><label>Which system, document or process must change?</label>${inp("n_sy", n.systemic, "Control plan, PFMEA, work instruction, procedure, training system…")}</div></div>
      <div id="n_rcachk" class="${rcaOk ? "okb" : "wh"}">${rcaOk ? "✓ The root cause analysis is complete." : probs.map((p) => "• " + esc(p)).join("<br>")}</div>`;
    const step3 = `${chipsFor(rec.p, "n_pa", "Recommended permanent actions (tap to use):")}<div class="sg"><div class="w"><label>What kind of action is it? (choose all that apply)</label><div class="sh" id="n_at">${EN().ACT_TYPES.map((t) => `<label title="${esc(t[2])}"><input type="checkbox" value="${t[0]}"${pre.atype.includes(t[0]) ? " checked" : ""} ${ro1(ro)}> ${esc(t[1])}</label>`).join("")}</div><small class="mut">A Major finding needs a change of the system, not training alone.</small></div>
      <div class="w"><label>Permanent action: what changes so it cannot happen again</label>${ta("n_pa", pre.perm_action, "Revise the control plan, add a mistake-proofing device, change the procedure…", 3)}</div>
      <div><label>Owner</label>${inp("n_po", pre.perm_owner, "", 'list="own"')}</div><div><label>Target date</label><input id="n_pd" type="date" value="${esc(pre.perm_due || "")}" ${ro1(ro)}></div>
      <div class="w"><label>Where else could the same gap exist? (all lines, shifts, products, suppliers)</label>${ta("n_hz", pre.horizontal, "", 2)}</div>
      <div class="w"><label>Evidence that the action was done (revised document number, photo, record)</label>${inp("n_pe", n.perm_evidence, "For example: Control plan CP-104 rev 05, photo of the device")}</div>
      <div><label>Permanent action done on</label><input id="n_px" type="date" value="${esc(n.perm_done_on || "")}" ${ro1(ro)}></div>${ro ? "" : '<div style="align-self:end"><button class="btn o s" id="n_px_t">Done today</button></div>'}</div>`;
    const mon = `<div class="sg"><div><label>How will the effect be checked?</label><select id="n_mm" ${ro1(ro)}>${opts([["", "Choose…"]].concat(EN().MON), pre.mon_method)}</select></div><div><label>Monitoring period (days)</label><input id="n_md" type="number" min="1" max="365" value="${esc(pre.mon_days)}" ${ro1(ro)}></div>
      <div class="w">${chipsFor(rec.e, "n_mc", "Recommended checks (tap to use):")}<label>What result shows that it worked?</label>${ta("n_mc", pre.mon_criteria, "For example: No repeat in the next 3 audits and 90 days of records.", 2)}</div></div>
      ${n.mon_due ? `<div class="guide" style="margin-top:8px">The effect can be checked from <b>${fmt(n.mon_due)}</b> (${n.mon_days} days after the action was done).</div>` : '<div class="mut">The check date is set when the permanent action is done.</div>'}`;
    const res = st === "monitor" && canEdit() ? `<div class="tool"><h4>Record the result of the check</h4><div class="seg"><button data-res="effective" class="on">Effective: it did not come back</button><button data-res="not_effective">Not effective: it came back</button></div>
      <div class="sg"><div class="w"><label>What was checked and what was found (records, re-audit, data)</label><textarea id="n_rn" rows="2" placeholder="For example: Re-audit on 12 Dec: control plan present on all machines, no gap in 90 days of records."></textarea></div></div>
      ${isAdmin() ? '<label class="cl"><input type="checkbox" id="n_early"> <span>Check before the monitoring period ends (administrator)</span></label>' : ""}<div class="row" style="margin-top:8px"><button class="btn g" id="n_close">Record the result</button></div>
      <small class="mut">If the action was not effective, the finding becomes Major and goes back to root cause. Nothing is lost: the earlier analysis is kept in the history.</small></div>` : "";
    const done4 = st === "closed" ? `<div class="okb">✓ Closed on ${fmt(n.closed_on)} by ${esc(n.closed_by || "")}. ${esc(n.mon_note || "")}</div>` : "";
    const hist = (n.log || []).length ? `<details class="th"><summary style="cursor:pointer;font-weight:700">History (${n.log.length})</summary>${n.log.map((l) => `<div class="cm"><small>${fmt(String(l.at).slice(0, 10))} · ${esc(l.by || "")}</small><br>${esc(l.text)}</div>`).join("")}</details>` : "";
    const sevBox = `<div class="sg" style="margin-top:8px"><div><label>Severity (set by the rules)</label><select id="n_sv" ${ro1(ro)}>${opts([["Major", "Major"], ["Minor", "Minor"]], n.severity)}</select></div><div class="w" id="n_svr" hidden><label>Reason for changing the severity (recorded)</label><input id="n_sr" placeholder="Why the rules gave a different result in this case"></div></div>
      <details style="margin-top:6px"><summary class="mut" style="cursor:pointer">Why this classification</summary><div class="mut" style="margin-top:4px">${nl(n.rule_text) || "—"}</div></details>`;
    return `${A.dl()}<div class="row"><button class="btn o s" id="n_back">← All findings</button><b style="font-size:17px">${esc(n.no)}</b> ${chip(n.severity, SEVC[n.severity])} ${chip(STGN[st] || st, st === "closed" ? "g" : n.overdue ? "r" : "b")} ${n.loops ? chip("Not effective " + n.loops + "×", "r") : ""}${n.repeat_of ? chip("Repeat of " + n.repeat_of, "r") : ""}<span style="flex:1"></span><button class="btn o s" id="n_audit">Open audit ${esc(n.audit_no)}</button><button class="btn o s" id="n_print">Print finding report</button></div>
      <div class="stepper">${ST_ORDER.map((k, i) => `<div class="sp ${st === "closed" || i < ix ? "done" : i === ix ? "cur" : ""}" data-go="${k}"><b>${i + 1}</b><small>${esc((STGN[k] || "").replace(/^\d /, ""))}</small></div>`).join("")}</div>
      <div class="card"><h3>The finding</h3><div class="mut" style="margin-bottom:6px"><b>${esc((n.standard || "") + " " + (n.clause || ""))}</b> · ${esc(n.audit_title)} · ${esc(n.audit_type)}</div><div class="guide" style="margin-bottom:8px"><b>Requirement:</b> ${esc(n.requirement || "—")}</div>
        <div class="sg"><div class="w"><label>Problem: what was found, where and when</label>${ta("n_pr", n.problem, "", 3)}</div><div class="w"><label>Evidence</label>${inp("n_ev", n.evidence, "Photo, record number, sample")}</div>
        <div class="w"><label>Attachments (photos, records, reports)</label><div id="n_att">${A.attHtml("nc:" + n.id, n.can_edit, n.audit_id)}</div></div><div><label>Area or process</label>${inp("n_ar", n.area)}</div><div><label>Owner of the response</label>${inp("n_ow", n.owner, "", 'list="own"')}</div><div><label>Root cause and permanent action due by</label><input id="n_rd" type="date" value="${esc(n.resp_due || "")}" ${ro1(ro)}></div></div>${sevBox}</div>
      ${filled ? '<div class="guide">Recommended text has been filled into the empty fields. Edit it to fit what really happened, then press <b>Save</b>.</div>' : ""}
      ${stepBox("contain", 1, "1 Contain", "Stop it reaching the customer. Due " + fmt(n.contain_due), n.contain_done_on ? "done" : st === "contain" ? "cur" : "", step1, st === "contain")}
      ${stepBox("rca", 2, "2 Root cause", "Why-why down to the system", rcaOk && n.contain_done_on ? "done" : st === "rca" ? "cur" : "", step2, st === "rca")}
      ${stepBox("action", 3, "3 Permanent action", "Change the system. Due " + fmt(n.perm_due || n.resp_due), n.perm_done_on ? "done" : st === "action" ? "cur" : "", step3, st === "action")}
      ${stepBox("monitor", 4, "4 Check the effect", "Did it work? " + (n.mon_due ? "From " + fmt(n.mon_due) : ""), st === "closed" ? "done" : st === "monitor" ? "cur" : "", mon + res, st === "monitor")}
      ${done4}${hist}
      <div class="sticky noprint"><span class="mut" id="n_note"></span><span style="flex:1"></span><div id="n_msg" class="wh" hidden style="flex-basis:100%"></div>
        ${n.can_edit ? '<button class="btn" id="n_save">Save</button>' : ""}${isAdmin() && ["closed", "cancelled"].includes(st) ? '<button class="btn o" id="n_reopen">Reopen (administrator)</button>' : ""}${isAdmin() && !["closed", "cancelled"].includes(st) ? '<button class="btn o" id="n_cancel" style="color:var(--r);border-color:var(--r)">Cancel finding</button>' : ""}</div>`;
  }
  const nmsg = (m, ok) => { const e = $("#n_msg"); if (!e) return say(m); e.textContent = m; e.hidden = !m; e.className = ok ? "okb" : "wh"; e.style.flexBasis = "100%"; if (m) e.scrollIntoView({ block: "center", behavior: "smooth" }); };
  const marked = () => { NDIRTY = true; S.dirty = true; const e = $("#n_note"); if (e) e.textContent = "Not saved yet"; };
  function npayload() {
    const n = N, o = { id: n.id, problem: V("n_pr"), evidence: V("n_ev"), area: V("n_ar"), owner: V("n_ow"), resp_due: V("n_rd"), contain_action: V("n_ca"), contain_qty: V("n_cq"), contain_owner: V("n_co"), contain_due: V("n_cd"), contain_done_on: V("n_cx"),
      whys: [...document.querySelectorAll("#n_whys [data-w]")].map((e) => e.value), root_cause: V("n_rc"), escape_cause: V("n_ec"), systemic: V("n_sy"), atype: [...document.querySelectorAll("#n_at input:checked")].map((e) => e.value),
      perm_action: V("n_pa"), perm_owner: V("n_po"), perm_due: V("n_pd"), horizontal: V("n_hz"), perm_evidence: V("n_pe"), perm_done_on: V("n_px"), mon_method: V("n_mm"), mon_criteria: V("n_mc"), mon_days: V("n_md") };
    if (V("n_sv") !== n.severity) { o.severity = V("n_sv"); o.sev_reason = V("n_sr"); }
    return o;
  }
  function liveRca() {
    const p = EN().checkWhys({ whys: [...document.querySelectorAll("#n_whys [data-w]")].map((e) => e.value), root_cause: V("n_rc"), escape_cause: V("n_ec"), systemic: V("n_sy") }), b = $("#n_rcachk");
    if (!b) return; b.className = p.length ? "wh" : "okb"; b.innerHTML = p.length ? p.map((x) => "• " + esc(x)).join("<br>") : "✓ The root cause analysis is complete.";
  }
  function wireNc() {
    const n = N, el = $("#ncd");
    const attBox = $("#n_att"), attAgain = () => { attBox.innerHTML = A.attHtml("nc:" + n.id, n.can_edit, n.audit_id); A.wireAtt(attBox, n.audit_id, attAgain); }; A.wireAtt(attBox, n.audit_id, attAgain);
    $("#n_back").onclick = () => go("go=nc"); $("#n_audit").onclick = () => go("go=list&id=" + n.audit_id); $("#n_print").onclick = () => A.showDoc(AudDocs.nc(N));
    el.querySelectorAll(".sp").forEach((s) => (s.onclick = () => { const d = $("#stp_" + s.dataset.go); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
    if (n.can_edit) {
      el.querySelectorAll("input,textarea,select").forEach((e) => e.addEventListener("input", () => { marked(); if (e.closest("#n_whys") || ["n_rc", "n_ec", "n_sy"].includes(e.id)) liveRca(); if (e.id === "n_sv") $("#n_svr").hidden = e.value === n.severity; }));
      const rec = LB().recFor(n.cat || "cap");
      el.querySelectorAll(".sgc").forEach((b) => (b.onclick = () => {
        const t = b.dataset.ins, i = +b.dataset.i;
        if (t === "n_w") { const ws = [...document.querySelectorAll("#n_whys [data-w]")]; let tg = ws.find((e) => !e.value.trim()); if (!tg) { $("#n_wadd").click(); tg = [...document.querySelectorAll("#n_whys [data-w]")].pop(); } tg.value = rec.s[i]; }
        else { const src = t === "n_ca" ? rec.c : t === "n_pa" ? rec.p : rec.e, e = $("#" + t); e.value = e.value.trim() ? (t === "n_pa" || t === "n_mc" ? src[i] : e.value.trim() + " " + src[i]) : src[i]; }
        marked(); liveRca();
      }));
      $("#n_wadd").onclick = () => { const w = document.querySelector("#n_whys"), k = w.querySelectorAll("[data-w]").length; if (k >= 7) return; const d = document.createElement("div"); d.className = "wr"; d.innerHTML = `<b>Why ${k + 1}</b><input data-w placeholder="Why did that happen?">`; w.append(d); d.querySelector("input").addEventListener("input", () => { marked(); liveRca(); }); d.querySelector("input").focus(); };
      $("#n_wuse").onclick = () => { const ws = [...document.querySelectorAll("#n_whys [data-w]")].map((e) => e.value.trim()).filter(Boolean); if (ws.length) { $("#n_rc").value = ws[ws.length - 1]; marked(); liveRca(); } };
      $("#n_cx_t").onclick = () => { $("#n_cx").value = today(); marked(); }; $("#n_px_t").onclick = () => { $("#n_px").value = today(); marked(); };
    }
    const sv = $("#n_save"); if (sv) sv.onclick = () => guard(async () => { nmsg(""); try { N = Object.assign(await call("kmr_aud_nc_get", { p_id: n.id }), {}); } catch (e) { /* keep */ } try { const r = await call("kmr_aud_nc_save", { p: npayload() }); NDIRTY = false; S.dirty = false; say("Saved.", true); await openNc(n.id, r.status !== n.status ? r.status : null); } catch (e) { nmsg(e.message); } });
    let res = "effective"; el.querySelectorAll("[data-res]").forEach((b) => (b.onclick = () => { res = b.dataset.res; el.querySelectorAll("[data-res]").forEach((x) => x.classList.toggle("on", x === b)); }));
    const cl = $("#n_close"); if (cl) cl.onclick = () => guard(async () => { nmsg(""); try { const r = await call("kmr_aud_nc_close", { p_id: n.id, p_result: res, p_note: V("n_rn"), p_early: !!($("#n_early") && $("#n_early").checked) }); S.dirty = false; say(res === "effective" ? "Closed: the action was effective." : "Back to root cause: the action was not effective.", true); await openNc(n.id); } catch (e) { nmsg(e.message); } });
    const ro = $("#n_reopen"); if (ro) ro.onclick = () => { const m = $("#n_msg"); m.hidden = false; m.className = "wh"; m.style.background = "var(--bg)"; m.style.color = "var(--ink)"; m.innerHTML = '<b>Why is it reopened?</b> <input id="rx_r" placeholder="Reason" style="margin:6px 0"><button class="btn s" id="rx_go">Reopen</button>'; $("#rx_go").onclick = () => guard(async () => { try { await call("kmr_aud_nc_reopen", { p_id: n.id, p_reason: V("rx_r") }); await openNc(n.id); } catch (e) { m.textContent = e.message; m.style.background = "#fee2e2"; m.style.color = "#991b1b"; } }); };
    const cn = $("#n_cancel"); if (cn) cn.onclick = () => { const m = $("#n_msg"); m.hidden = false; m.className = "wh"; m.style.background = "var(--bg)"; m.style.color = "var(--ink)"; m.innerHTML = '<b>Why is the finding cancelled?</b> <input id="cx_r" placeholder="For example: raised by mistake; the auditee showed the requirement is met" style="margin:6px 0"><button class="btn s r" id="cx_go">Cancel the finding</button>'; $("#cx_go").onclick = () => guard(async () => { try { await call("kmr_aud_nc_cancel", { p_id: n.id, p_reason: V("cx_r") }); await openNc(n.id); } catch (e) { m.textContent = e.message; m.style.background = "#fee2e2"; m.style.color = "#991b1b"; } }); };
  }
  async function openNc(id) {
    N = await call("kmr_aud_nc_get", { p_id: id }); await A.loadFiles(N.audit_id); const el = $("#ncd"); el.innerHTML = ncPage(N); NDIRTY = false; wireNc();
    if (!el.querySelector("details[open]")) { const d = el.querySelector("details.cur") || el.querySelector("details"); if (d) d.open = true; }
  }
  async function screenNcd(hp) { await openNc(hp.id); }

  /* =================================================== special audit points =================================================== */
  const SRC = ["Customer", "Certification body", "Standard", "Legal", "Management", "Internal"];
  const PF = { status: "open", q: "" };
  async function screenPts() {
    const el = $("#pts"), can = canEdit(), f = PF;
    el.innerHTML = `<div class="guide">Points that must be checked in audits until they are closed: customer audit points, open points of a certification audit, management focus items. Each point has the <b>standard and clause</b> it comes from. An open point that applies is added to every new audit checklist, and it is closed only with an OK check, a closure note and evidence.</div>
      <div class="row"><div class="grow"><input id="p_q" placeholder="Search point, standard, clause…" value="${esc(f.q)}"></div>${seg([["open", "Open"], ["closed", "Closed"], ["all", "All"]], f.status, "data-st")}${can ? '<button class="btn" id="p_new">+ Add a point</button>' : ""}<button class="btn o" id="p_pr">Print list</button></div>
      <div id="p_form"></div><div id="p_body"></div>`;
    const stdOpts = Object.values(LB().STD).map((x) => `<option value="${esc(x)}">`).join("");
    const form = (p) => `<div class="card"><h3>${p ? "Edit point " + esc(p.no) : "New special audit point"}</h3><datalist id="stds">${stdOpts}</datalist><div class="sg"><div class="w"><label>Point to be checked</label><textarea id="pf_t" rows="2" placeholder="For example: Confirm the bore-diameter mistake-proofing is tested at every shift start">${esc(p ? p.title : "")}</textarea></div>
      <div><label>Where it comes from</label><select id="pf_s">${opts(SRC.map((x) => [x, x]), p ? p.source : "Customer")}</select></div><div><label>Standard or customer</label><input id="pf_st" list="stds" value="${esc(p ? p.standard : "")}" placeholder="IATF 16949:2016, customer name…"></div>
      <div><label>Clause or requirement number</label><input id="pf_c" value="${esc(p ? p.clause : "")}" placeholder="For example 10.2.4 or CSR 4.2"></div><div><label>How often it is checked</label><select id="pf_f">${opts(["Every audit", "Monthly", "Quarterly", "Half-yearly", "Yearly", "One time"].map((x) => [x, x]), p ? p.frequency : "Every audit")}</select></div>
      <div class="w"><label>How to check it (what to look at)</label><input id="pf_h" value="${esc(p ? p.check_how || "" : "")}"></div><div class="w"><label>Background</label><input id="pf_d" value="${esc(p ? p.description || "" : "")}"></div>
      <div><label>Applies to (area; empty = all)</label><input id="pf_a" list="areas2" value="${esc(p ? p.applies || "" : "")}"><datalist id="areas2">${((S.L.settings || {}).areas || []).map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist></div><div><label>Owner</label><input id="pf_o" list="own" value="${esc(p ? p.owner || "" : "")}"></div><div><label>Close by</label><input id="pf_u" type="date" value="${esc(p ? p.due_on || "" : "")}"></div></div>
      <div class="row" style="margin-top:8px"><button class="btn" id="pf_ok">Save the point</button><button class="btn o" id="pf_x">Cancel</button><span class="wh" id="pf_m" hidden></span></div></div>`;
    const showForm = (p) => {
      $("#p_form").innerHTML = form(p); $("#pf_x").onclick = () => ($("#p_form").innerHTML = "");
      $("#pf_ok").onclick = () => guard(async () => { const m = $("#pf_m"); try { const o = { title: V("pf_t"), source: V("pf_s"), standard: V("pf_st"), clause: V("pf_c"), frequency: V("pf_f"), check_how: V("pf_h"), description: V("pf_d"), applies: V("pf_a"), owner: V("pf_o"), due_on: V("pf_u") }; if (p) o.id = p.id; await call("kmr_aud_point_save", { p: o }); say("Saved.", true); $("#p_form").innerHTML = ""; await load(); } catch (e) { m.textContent = e.message; m.hidden = false; } });
      $("#p_form").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const load = async () => {
      const list = await call("kmr_aud_point_list", { p: { status: f.status, q: f.q } }); S.plist = list;
      $("#p_body").innerHTML = list.length ? list.map((p) => `<div class="fb" data-p="${p.id}" style="border-left-color:var(--${p.status === "closed" ? "g" : p.overdue || p.last_result === "not_ok" ? "r" : "b1"})"><h5>${chip(p.no, "v")} ${esc(p.title)}</h5>
        <div class="tm" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px"><b>${esc(p.standard)} ${esc(p.clause)}</b><span class="mut">${esc(p.source || "")}</span><span>${esc(p.frequency)}</span>${p.applies ? `<span>${esc(p.applies)}</span>` : ""}<span>${esc(p.owner || "no owner")}</span>${p.status === "open" ? `<span>close by ${due(p.due_on)}</span>` : `<span>closed ${fmt(p.closed_on)}</span>`}
        ${p.last_result ? chip(p.last_result === "ok" ? "Last check OK " + fmt(p.last_checked) : "Last check NOT OK " + fmt(p.last_checked), p.last_result === "ok" ? "g" : "r") : chip("Not checked yet", "x")}</div>
        ${p.check_how ? `<div class="mut">Look at: ${esc(p.check_how)}</div>` : ""}${p.status === "closed" ? `<div class="okb" style="margin-top:6px">✓ ${esc(p.closure_note || "")} <br><small>Evidence: ${esc(p.evidence || "")}</small></div>` : ""}
        <div class="row" style="margin:8px 0 0">${can && p.status === "open" ? '<button class="btn o s" data-chk>Record a check</button><button class="btn o s" data-cls>Close the point</button><button class="btn o s" data-ed>Edit</button>' : ""}${isAdmin() && p.status === "closed" ? '<button class="btn o s" data-reo>Reopen</button>' : ""}${isAdmin() ? '<button class="btn o s" data-del style="color:var(--r);border-color:var(--r)">Delete</button>' : ""}</div><div data-box></div></div>`).join("")
        : `<div class="empty">No point${f.status === "open" ? " open" : ""}.${can ? "<br>Press <b>+ Add a point</b> to record one." : ""}</div>`;
      el.querySelectorAll("[data-p]").forEach((row) => {
        const p = list.find((x) => x.id === row.dataset.p), box = row.querySelector("[data-box]"), bx = (h) => { box.innerHTML = h; return box; };
        const sh = (b) => b && (b.onclick = null);
        const chk = row.querySelector("[data-chk]"); if (chk) chk.onclick = () => { bx(`<div class="tool"><div class="seg"><button data-r="ok" class="on">OK</button><button data-r="not_ok">Not OK</button></div><input id="pc_n" placeholder="What was seen (needed if not OK)" style="margin:6px 0"><button class="btn s" id="pc_go">Save the check</button> <span class="wh" id="pc_m" hidden></span></div>`); let r = "ok"; box.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { r = b.dataset.r; box.querySelectorAll("[data-r]").forEach((x) => x.classList.toggle("on", x === b)); })); $("#pc_go").onclick = () => guard(async () => { try { await call("kmr_aud_point_check", { p_id: p.id, p: { result: r, note: V("pc_n") } }); await load(); } catch (e) { $("#pc_m").textContent = e.message; $("#pc_m").hidden = false; } }); };
        const cls = row.querySelector("[data-cls]"); if (cls) cls.onclick = () => { bx(`<div class="tool"><label class="lbl">Why can the point be closed? What was done and seen</label><textarea id="pk_n" rows="2"></textarea><label class="lbl" style="margin-top:6px">Evidence (record number, document, photo, customer confirmation)</label><input id="pk_e"><div class="mut" style="margin:6px 0;font-size:12.5px">The last check must be OK. Clause ${esc(p.standard + " " + p.clause)} is recorded with the closure.</div><button class="btn g s" id="pk_go">Close the point</button> <span class="wh" id="pk_m" hidden></span></div>`); $("#pk_go").onclick = () => guard(async () => { try { await call("kmr_aud_point_close", { p_id: p.id, p: { closure_note: V("pk_n"), evidence: V("pk_e") } }); await load(); } catch (e) { $("#pk_m").textContent = e.message; $("#pk_m").hidden = false; } }); };
        const ed = row.querySelector("[data-ed]"); if (ed) ed.onclick = () => showForm(p);
        const reo = row.querySelector("[data-reo]"); if (reo) reo.onclick = () => guard(async () => { await call("kmr_aud_point_reopen", { p_id: p.id }); await load(); });
        const dl = row.querySelector("[data-del]"); if (dl) dl.onclick = () => { bx(`<div class="tool"><b>Delete this point?</b> <button class="btn s r" id="pd_go">Yes, delete</button></div>`); $("#pd_go").onclick = () => guard(async () => { await call("kmr_aud_point_delete", { p_id: p.id }); await load(); }); };
        void sh;
      });
    };
    if (can) $("#p_new").onclick = () => showForm(null);
    let tm; $("#p_q").oninput = (e) => { f.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => guard(load), 250); };
    el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { f.status = b.dataset.st; el.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); guard(load); }));
    $("#p_pr").onclick = () => A.showDoc(AudDocs.points(S.plist || [], f.status));
    await load();
  }

  /* =================================================== clause library =================================================== */
  const LF = { type: "", std: "", q: "", w: "" };
  function screenLib() {
    const el = $("#lib"), all = LB().all(), stds = [...new Set(all.map((x) => x.std))];
    el.innerHTML = `<div class="guide">What is checked, clause by clause, in each kind of audit. These are the questions the app puts into a new audit; the evidence column says what to look at, and the recommended actions are what the app suggests when the requirement is not met. Clause numbers follow the published structure of each standard; check wording against your own licensed copy.</div>
      <div class="row"><div class="grow"><input id="b_q" placeholder="Search clause or words…" value="${esc(LF.q)}"></div><select id="b_t" style="width:auto"><option value="">All audit types</option>${opts(A.TYPES.map((t) => [t[0], t[1]]), LF.type)}</select><select id="b_s" style="width:auto"><option value="">All standards</option>${opts(stds.map((x) => [x, x]), LF.std)}</select><select id="b_w" style="width:auto"><option value="">All weights</option><option value="2"${LF.w === "2" ? " selected" : ""}>Critical only</option><option value="1"${LF.w === "1" ? " selected" : ""}>Important and critical</option></select></div>
      <div class="mut" id="b_cnt" style="margin-bottom:8px"></div><div id="b_body"></div>`;
    const draw = () => {
      const q = LF.q.toLowerCase(), list = all.filter((x) => (!LF.type || x.type === LF.type) && (!LF.std || x.std === LF.std) && (!LF.w || x.w >= +LF.w) && (!q || (x.clause + " " + x.q + " " + x.ev + " " + x.std).toLowerCase().includes(q)));
      $("#b_cnt").textContent = list.length + " of " + all.length + " questions";
      let last = ""; $("#b_body").innerHTML = list.map((x) => { const head = x.type + "|" + x.set, h = head !== last ? ((last = head), `<h3 style="margin:14px 0 6px">${esc(LB().TYPES[x.type].name)} · ${esc(x.set)}</h3>`) : "", r = LB().recFor(x.cat);
        return `${h}<details class="stp" style="margin-bottom:6px"><summary><span class="sn" style="width:auto;min-width:34px;border-radius:10px;padding:0 8px;font-size:12px;background:${x.w === 2 ? "var(--r)" : x.w === 1 ? "var(--a)" : "#94a3b8"}">${esc(x.clause)}</span><span class="st">${esc(x.q)}<small>${esc(x.std)} · Look at: ${esc(x.ev)}${x.w === 2 ? " · Critical" : x.w === 1 ? " · Important" : ""}</small></span></summary>
          <div class="sb"><b>Recommended actions if not met: ${esc(r.n)}</b><div class="two" style="margin-top:6px"><div><small class="mut">Containment</small><ul>${r.c.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><small class="mut">Typical system causes</small><ul>${r.s.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div><div><small class="mut">Permanent action</small><ul>${r.p.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><small class="mut">Check the effect</small><ul>${r.e.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></div><div class="mut"><b>Look elsewhere:</b> ${esc(r.h)} <b>Evidence to close:</b> ${esc(r.ev)}</div></div></details>`; }).join("") || '<div class="empty">No question matches.</div>';
    };
    let tm; $("#b_q").oninput = (e) => { LF.q = e.target.value; clearTimeout(tm); tm = setTimeout(draw, 200); };
    $("#b_t").onchange = (e) => { LF.type = e.target.value; draw(); }; $("#b_s").onchange = (e) => { LF.std = e.target.value; draw(); }; $("#b_w").onchange = (e) => { LF.w = e.target.value; draw(); };
    draw();
  }

  /* =================================================== programme generator =================================================== */
  const PG = { rows: null, year: null, prev: null };
  const fyNow = () => { const d = new Date(today() + "T00:00:00"); return d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); };
  function stdSet() {
    const P = LB().PROC.filter((x) => x[0] !== "all"), s = (S.L.settings || {}).areas || [];
    if (s.length) return s.flatMap((a) => [["System", a], ["Process", a]].filter((x) => x[0] === "System" || ["prod", "maint", "qa", "store", "all"].includes(a.proc)).map((x) => ({ type: x[0], area: a.name, proc: a.proc || "all", auditee: a.auditee || "", risk: a.risk || "M", last: "" })));
    return P.map((x) => ({ type: "System", area: x[1], proc: x[0], auditee: "", risk: "M", last: "" })).concat([{ type: "Process", area: "Production", proc: "prod", auditee: "", risk: "H", last: "" }, { type: "Product", area: "Final inspection", proc: "qa", auditee: "", risk: "H", last: "" }, { type: "LPA", area: "Production line", proc: "prod", auditee: "", risk: "M", last: "" }, { type: "Document", area: "Control plans and FMEA", proc: "qa", auditee: "", risk: "M", last: "" }]);
  }
  async function screenProg() {
    const el = $("#prog"); if (!canEdit()) { go("go=list"); return; }
    if (!PG.rows) { PG.rows = stdSet(); PG.year = fyNow(); PG.prev = null; }
    const pool = (S.L.settings || {}).auditors || [], rows = PG.rows;
    const rowHtml = (r, i) => `<div class="lr" style="--cols:1.1fr 1.3fr 1fr 1fr 70px 130px"><select data-k="type">${opts(A.TYPES.map((t) => [t[0], t[1]]), r.type)}</select><input data-k="area" list="areas" value="${esc(r.area)}" placeholder="Area, process or supplier"><select data-k="proc">${opts(LB().PROC, r.proc || "all")}</select><input data-k="auditee" list="own" value="${esc(r.auditee || "")}" placeholder="Person audited"><select data-k="risk">${opts([["H", "High"], ["M", "Medium"], ["L", "Low"]], r.risk)}</select><input data-k="last" type="date" value="${esc(r.last || "")}" title="Last audited"><button class="btn o s" data-rm="${i}" title="Remove">✕</button></div>`;
    el.innerHTML = `${A.dl()}<datalist id="areas">${((S.L.settings || {}).areas || []).map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist><div class="row"><button class="btn o s" id="g_back">← Audit programme</button><b style="font-size:17px">Make the year's audit programme</b></div>
      <div class="guide">List what is to be audited and how risky it is. The app plans the year: <b>high risk</b> is audited more often, dates are spread evenly (never on a Sunday), <b>shifts A, B and C are rotated</b> so every shift is covered, and auditors are taken from the auditor register in Setup: only qualified people, and never the person's own area. Each audit gets its clause checklist when it is opened.</div>
      <div class="sg"><div><label>Financial year (April to March)</label><select id="g_y">${opts([fyNow(), fyNow() + 1].map((y) => [y, y + "-" + String(y + 1).slice(2)]), PG.year)}</select></div><div style="align-self:end" class="mut">${pool.length ? pool.filter((p) => p.status !== "trainee").length + " qualified auditor(s) in the register." : "No auditor register yet (Setup). Audits will be made without an auditor."}</div></div>
      <div class="lr" style="--cols:1.1fr 1.3fr 1fr 1fr 70px 130px;margin-top:12px;color:var(--mut);font-size:12px"><span>Type of audit</span><span>Area, process or supplier</span><span>Process (questions)</span><span>Person audited</span><span>Risk</span><span>Last audited</span><span></span></div>
      <div id="g_rows">${rows.map(rowHtml).join("")}</div>
      <div class="row"><button class="btn o s" id="g_add">+ Add a row</button><button class="btn o s" id="g_std">Start again with the standard set</button><button class="btn o s" id="g_clr">Clear the list</button></div>
      <div class="row"><button class="btn" id="g_pv">Show the planned audits</button></div><div id="g_msg" class="wh" hidden></div><div id="g_prev"></div>`;
    const sync = () => { el.querySelectorAll("#g_rows .lr").forEach((row, i) => { row.querySelectorAll("[data-k]").forEach((e) => (rows[i][e.dataset.k] = e.value)); }); };
    el.querySelectorAll("#g_rows [data-k]").forEach((e) => (e.onchange = () => { sync(); PG.prev = null; $("#g_prev").innerHTML = ""; }));
    el.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { sync(); rows.splice(+b.dataset.rm, 1); screenProg(); }));
    $("#g_back").onclick = () => go("go=list"); $("#g_y").onchange = (e) => { PG.year = +e.target.value; PG.prev = null; $("#g_prev").innerHTML = ""; };
    $("#g_add").onclick = () => { sync(); rows.push({ type: "System", area: "", proc: "all", auditee: "", risk: "M", last: "" }); screenProg(); };
    $("#g_std").onclick = () => { PG.rows = stdSet(); screenProg(); }; $("#g_clr").onclick = () => { PG.rows = []; screenProg(); };
    $("#g_pv").onclick = () => {
      sync(); const m = $("#g_msg"); m.hidden = true; const rs = rows.filter((r) => String(r.area).trim()); if (!rs.length) { m.textContent = "Add at least one row with an area, process or supplier."; m.hidden = false; return; }
      const list = EN().programme(PG.year, rs.map((r) => ({ type: r.type, area: r.area.trim(), auditee: r.auditee, risk: r.risk, last: r.last, proc: r.proc })), pool, today());
      list.forEach((x, i) => { const r = rs.find((q) => q.area.trim() === x.area && q.type === x.type) || {}; x.meta = { proc: r.proc || "all", sets: null, auto: true, risk: x.risk }; });
      PG.prev = list; const sh = new Set(list.flatMap((x) => x.shifts)), noau = list.filter((x) => !x.auditor).length, byT = {}; list.forEach((x) => (byT[x.type] = (byT[x.type] || 0) + 1));
      $("#g_prev").innerHTML = `<div class="card"><h3>${list.length} audits planned for ${PG.year}-${String(PG.year + 1).slice(2)}</h3><div class="row">${Object.keys(byT).map((k) => chip((LB().TYPES[k] || {}).name + ": " + byT[k], "v")).join(" ")}${["A", "B", "C"].map((s) => chip("Shift " + s + (sh.has(s) ? " covered" : " not covered"), sh.has(s) ? "g" : "a")).join(" ")}${noau ? chip(noau + " without an auditor", "r") : chip("All have an auditor", "g")}</div>
        <div class="sc"><table class="tb2"><thead><tr><th>Date</th><th>Audit</th><th>Process</th><th>Auditor</th><th>Audited</th><th>Shift</th></tr></thead><tbody>${list.map((x) => `<tr><td>${fmt(x.planned_on)}</td><td>${esc(x.title)}</td><td>${esc((LB().PROC.find((p) => p[0] === x.meta.proc) || [0, "All"])[1])}</td><td>${esc(x.auditor || "—")}</td><td>${esc(x.auditee || "—")}</td><td>${esc(x.shifts.join(", ") || "—")}</td></tr>`).join("")}</tbody></table></div>
        <div class="row" style="margin-top:10px"><button class="btn g" id="g_go">Create these ${list.length} audits</button><span class="mut">They appear in the programme as planned. You can change any of them there.</span></div></div>`;
      $("#g_go").onclick = () => guard(async () => { const b = $("#g_go"); b.disabled = true; try { let made = 0; for (let i = 0; i < list.length; i += 40) { const r = await call("kmr_aud_programme_make", { p: { items: list.slice(i, i + 40) } }); made += r.made; b.textContent = made + " of " + list.length + "…"; } PG.rows = null; say(made + " audits are planned.", true); go("go=list"); } catch (e) { b.disabled = false; m.textContent = e.message; m.hidden = false; } });
    };
  }

  /* =================================================== findings dashboard =================================================== */
  async function dash2(el) {
    const d = await call("kmr_aud_dash2", { p_year: S.year || null }), kp = (h, c, b, l, sub) => `<div class="kpi" style="--c:${c}" data-go="${h}"><b>${b}</b><span>${l}</span>${sub ? `<small class="mut" style="display:block">${sub}</small>` : ""}</div>`;
    const bar = (list, key, max, cls) => (list || []).length ? list.map((x) => `<div class="bl" ${key ? `data-cl="${esc(x.k)}"` : ""} style="display:grid;grid-template-columns:minmax(90px,150px) 1fr 40px;gap:8px;align-items:center;margin:6px 0;${key ? "cursor:pointer" : ""}"><span title="${esc(x.k)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.k)}</span><span style="background:var(--bg);border-radius:6px;height:12px;display:block"><i style="display:block;height:12px;border-radius:6px;width:${max ? Math.max(4, (x.n / max) * 100) : 0}%;background:${cls || "linear-gradient(90deg,var(--b1),var(--b2))"}"></i></span><b>${x.n}</b></div>`).join("") : '<div class="empty">No data yet.</div>';
    const mx = (l) => Math.max(1, ...(l || []).map((x) => x.n)), tr = d.trend || [], tmx = Math.max(1, ...tr.map((t) => Math.max(t.raised, t.closed))), ag = d.ageing || {}, bs = d.by_stage || {};
    const stg = ["contain", "rca", "action", "monitor"].map((k) => ({ k: STGN[k], n: bs[k] || 0 }));
    el.innerHTML = `<h3 style="margin:18px 0 8px">Findings and corrective actions</h3><div class="guide">How well findings are being fixed: what is open, what is late, whether the same problems come back, and whether the actions worked.</div>
      <div class="kpis">${kp("go=nc", d.major_open ? "var(--r)" : "var(--g)", d.open, "open findings", d.major_open + " Major · " + d.minor_open + " Minor")}${kp("go=nc&late=1", d.overdue ? "var(--r)" : "var(--g)", d.overdue, "late", d.overdue ? "the next step is overdue" : "none late")}${kp("go=nc", d.repeat ? "var(--a)" : "var(--g)", d.repeat, "repeat findings", "same clause again, or action not effective")}
      ${kp("go=nc&status=closed", d.effective_pct == null ? "var(--mut)" : d.effective_pct >= 90 ? "var(--g)" : "var(--a)", d.effective_pct == null ? "—" : d.effective_pct + "%", "actions effective", d.effectiveness_checks + " effect checks done")}${kp("go=nc&status=closed", "var(--b1)", d.avg_days_to_close == null ? "—" : d.avg_days_to_close, "days to close", "average, closed findings")}${kp("go=pts", d.points_notok || d.points_overdue ? "var(--a)" : "var(--g)", d.points_open, "special points open", d.points_notok + " not OK · " + d.points_overdue + " late")}</div>
      <div class="two"><div class="card"><h3>Where open findings are</h3>${bar(stg, false, mx(stg))}<h3 style="margin-top:14px">How old they are</h3>${bar([{ k: "30 days or less", n: ag.d30 || 0 }, { k: "31 to 60 days", n: ag.d60 || 0 }, { k: "61 to 90 days", n: ag.d90 || 0 }, { k: "over 90 days", n: ag.over90 || 0 }], false, Math.max(1, ag.d30 || 0, ag.d60 || 0, ag.d90 || 0, ag.over90 || 0), "var(--a)")}</div>
      <div class="card"><h3>Raised and closed, last 12 months</h3><div class="trend">${tr.map((t) => `<div title="${t.m}: raised ${t.raised}, closed ${t.closed}"><i style="height:${(t.raised / tmx) * 100}%"></i><i class="d" style="height:${(t.closed / tmx) * 100}%"></i><small>${t.m.slice(5)}</small></div>`).join("")}</div><small class="mut"><span style="color:var(--b1)">■</span> raised &nbsp; <span style="color:var(--g)">■</span> closed</small></div></div>
      <div class="two"><div class="card"><h3>Clauses with most findings (12 months)</h3>${bar(d.top_clauses, true, mx(d.top_clauses))}<small class="mut">Tap a clause to see its findings.</small></div><div class="card"><h3>Areas with most findings (12 months)</h3>${bar(d.by_area, false, mx(d.by_area))}<h3 style="margin-top:14px">By standard</h3>${bar(d.by_standard, false, mx(d.by_standard))}</div></div>
      <div class="two"><div class="card"><h3>Late findings</h3>${(d.late || []).length ? d.late.map((n) => `<div class="act" data-nc="${n.id}" style="cursor:pointer;padding:6px 0;border-bottom:1px solid var(--line)"><div class="as">${chip(n.severity, SEVC[n.severity])} <b>${esc(n.no)}</b> ${esc(String(n.problem || "").replace(/ \(Requirement:.*$/, "")).slice(0, 90)}</div><small class="mut">${esc(STGN[n.status] || n.status)} · ${esc(n.owner || "no owner")} · ${due(n.next_due)}</small></div>`).join("") : '<div class="empty">No late findings.</div>'}</div>
      <div class="card"><h3>Oldest open findings</h3>${(d.oldest || []).length ? d.oldest.map((n) => `<div class="act" data-nc="${n.id}" style="cursor:pointer;padding:6px 0;border-bottom:1px solid var(--line)"><div class="as">${chip(n.severity, SEVC[n.severity])} <b>${esc(n.no)}</b> ${esc(String(n.problem || "").replace(/ \(Requirement:.*$/, "")).slice(0, 90)}</div><small class="mut">raised ${fmt(n.raised_on)} · ${esc(STGN[n.status] || n.status)} · ${esc(n.owner || "")}</small></div>`).join("") : '<div class="empty">No open findings.</div>'}</div></div>
      <div class="card"><h3>Audit coverage, last 12 months</h3><div class="row" style="margin:0">${A.TYPES.map((t) => chip(t[1], (d.audited_types || []).includes(t[0]) ? "g" : "x")).join(" ")}</div><small class="mut">${d.audited_areas} different areas or processes audited. Grey: no completed audit of that kind in the last 12 months.</small></div>`;
    el.querySelectorAll("[data-go]").forEach((e) => (e.onclick = () => { const h = e.dataset.go.split("&"); NF.status = /status=closed/.test(e.dataset.go) ? "closed" : "open"; NF.overdue = /late=1/.test(e.dataset.go); NF.clause = ""; go(h[0]); }));
    el.querySelectorAll("[data-nc]").forEach((e) => (e.onclick = () => go("go=nc&id=" + e.dataset.nc)));
    el.querySelectorAll("[data-cl]").forEach((e) => (e.onclick = () => { const k = e.dataset.cl, i = k.lastIndexOf(" "); NF.clause = i > 0 ? k.slice(k.indexOf(" ") > -1 ? 0 : 0) : k; NF.q = ""; const last = (d.top_clauses || []).find((x) => x.k === k); NF.clause = ""; NF.q = k.split(" ").slice(-1)[0]; NF.status = "all"; go("go=nc"); void last; }));
  }

  /* =================================================== setup =================================================== */
  async function screenSetup() {
    const el = $("#setup"); if (!isAdmin()) { el.innerHTML = '<div class="empty">Only an administrator can change the setup.</div>'; return; }
    const s = S.L.settings || {}, aud = (s.auditors || []).slice(), ar = (s.areas || []).slice(), n = (k, d) => (s[k] == null || s[k] === "" ? d : s[k]);
    const TY = A.TYPES;
    const audRow = (a, i) => `<div class="cause" data-au="${i}"><div class="sg"><div><label>Auditor (name or e-mail)</label><input data-k="name" list="own" value="${esc(a.name || "")}"></div><div><label>Status</label><select data-k="status">${opts([["qualified", "Qualified"], ["trainee", "Trainee (cannot issue a report)"]], a.status || "qualified")}</select></div><div><label>Qualification valid till</label><input data-k="valid_till" type="date" value="${esc(a.valid_till || "")}"></div>
      <div class="w"><label>Audit types allowed (none ticked = all)</label><div class="sh">${TY.map((t) => `<label><input type="checkbox" data-ty="${t[0]}"${(a.types || []).includes(t[0]) ? " checked" : ""}> ${esc(t[1].replace(/ \(.*\)/, ""))}</label>`).join("")}</div></div></div><button class="btn o s" data-rma="${i}">Remove auditor</button></div>`;
    const areaRow = (a, i) => `<div class="lr" style="--cols:1.4fr 1.1fr 1.2fr 90px" data-ar="${i}"><input data-k="name" value="${esc(a.name || "")}" placeholder="Area, line or process"><input data-k="auditee" list="own" value="${esc(a.auditee || "")}" placeholder="Process owner"><select data-k="proc">${opts(LB().PROC, a.proc || "all")}</select><select data-k="risk">${opts([["H", "High"], ["M", "Medium"], ["L", "Low"]], a.risk || "M")}</select><button class="btn o s" data-rmr="${i}">✕</button></div>`;
    el.innerHTML = `${A.dl()}<div class="guide">These settings apply to the whole company.</div>
      <div class="sg"><div><label>Number prefix</label><input id="s_pf" value="${esc(s.prefix || "AUD")}" maxlength="10"></div><div><label>Days given to fix an older-style action (suggested date)</label><input id="s_dd" type="number" min="0" max="365" value="${esc(n("due_days", 30))}"></div>
      <div class="w"><label class="cl"><input type="checkbox" id="s_fy"${s.fy_numbering === false ? "" : " checked"}> <span>Number by financial year (April to March), for example AUD/26-27/0001</span></label></div></div>
      <h3 style="margin:18px 0 4px">Response times for findings (days)</h3><div class="guide">Set once; the app fills the dates of every new finding from these. Counted from the audit date.</div>
      <div class="sg"><div><label>Major: containment</label><input type="number" min="0" max="365" id="s_dcM" value="${esc(n("d_contain_major", 1))}"></div><div><label>Major: root cause and action</label><input type="number" min="0" max="365" id="s_drM" value="${esc(n("d_response_major", 14))}"></div><div><label>Major: monitoring period after the action</label><input type="number" min="1" max="365" id="s_dmM" value="${esc(n("d_monitor_major", 60))}"></div>
      <div><label>Minor: containment</label><input type="number" min="0" max="365" id="s_dcm" value="${esc(n("d_contain_minor", 3))}"></div><div><label>Minor: root cause and action</label><input type="number" min="0" max="365" id="s_drm" value="${esc(n("d_response_minor", 30))}"></div><div><label>Minor: monitoring period after the action</label><input type="number" min="1" max="365" id="s_dmm" value="${esc(n("d_monitor_minor", 90))}"></div></div>
      <h3 style="margin:18px 0 4px">Auditor register</h3><div class="guide">Only people listed as qualified can issue an audit report of that type, and only while the qualification is valid. If the register is empty, anyone can. Auditors are also taken from this list when the programme is made.</div>
      <div id="s_aud">${aud.map(audRow).join("")}</div><div class="row"><button class="btn o s" id="s_adda">+ Add an auditor</button></div>
      <h3 style="margin:18px 0 4px">Areas and processes to audit</h3><div class="guide">Used by the programme generator and as the list of areas when planning an audit. Risk decides how often: high risk is audited most often.</div>
      <div class="lr" style="--cols:1.4fr 1.1fr 1.2fr 90px;color:var(--mut);font-size:12px"><span>Area</span><span>Process owner</span><span>Process (questions)</span><span>Risk</span></div><div id="s_ar">${ar.map(areaRow).join("")}</div><div class="row"><button class="btn o s" id="s_addr">+ Add an area</button></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="s_save">Save</button><span class="wh" id="s_msg" hidden></span></div>`;
    const grab = () => { const au = [...el.querySelectorAll("[data-au]")].map((r) => ({ name: r.querySelector('[data-k="name"]').value.trim(), status: r.querySelector('[data-k="status"]').value, valid_till: r.querySelector('[data-k="valid_till"]').value, types: [...r.querySelectorAll("[data-ty]:checked")].map((c) => c.dataset.ty) })).filter((a) => a.name);
      const ars = [...el.querySelectorAll("[data-ar]")].map((r) => { const g = (k) => r.querySelector('[data-k="' + k + '"]').value; return { name: g("name").trim(), auditee: g("auditee").trim(), proc: g("proc"), risk: g("risk") }; }).filter((a) => a.name);
      return { au, ars }; };
    const keep = () => { const g = grab(); s.auditors = g.au; s.areas = g.ars; };
    $("#s_adda").onclick = () => { keep(); aud.length = 0; (s.auditors || []).forEach((x) => aud.push(x)); aud.push({ name: "", status: "qualified", types: [] }); s.auditors = aud.slice(); S.L.settings = s; screenSetup(); };
    $("#s_addr").onclick = () => { keep(); s.areas.push({ name: "", auditee: "", proc: "all", risk: "M" }); S.L.settings = s; screenSetup(); };
    el.querySelectorAll("[data-rma]").forEach((b) => (b.onclick = () => { keep(); s.auditors.splice(+b.dataset.rma, 1); S.L.settings = s; screenSetup(); }));
    el.querySelectorAll("[data-rmr]").forEach((b) => (b.onclick = () => { keep(); s.areas.splice(+b.dataset.rmr, 1); S.L.settings = s; screenSetup(); }));
    $("#s_save").onclick = () => guard(async () => { const g = grab(), m = $("#s_msg"); m.hidden = true; const num = (id) => (V(id) === "" ? null : Number(V(id)));
      const o = Object.assign({}, s, { prefix: V("s_pf"), fy_numbering: $("#s_fy").checked, due_days: V("s_dd"), auditors: g.au, areas: g.ars, d_contain_major: num("s_dcM"), d_response_major: num("s_drM"), d_monitor_major: num("s_dmM"), d_contain_minor: num("s_dcm"), d_response_minor: num("s_drm"), d_monitor_minor: num("s_dmm") });
      try { await call("kmr_aud_settings_save", { p: o }); S.L = await call("kmr_aud_load"); say("Saved.", true); } catch (e) { m.textContent = e.message; m.hidden = false; } });
  }

  A.screens.nc = screenNc; A.screens.ncd = screenNcd; A.screens.pts = screenPts; A.screens.lib = screenLib; A.screens.prog = screenProg; A.screens.dash2 = dash2; A.screens.setup = screenSetup;
})();
