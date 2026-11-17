/* 8D Problem Solving - printed forms: the 8D report, the 8D register and the action list.
   Each form is built inside the standard report frame (AIAGForm.wrap): customer logo top-left, unique report ref. no., format no. / revision / date at the foot of every page. */
(function () {
  "use strict";
  const A = window.AIAGForm, esc = A.esc;
  const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : s ? esc(s) : "—"; };
  const nl = (s) => (s == null || s === "" ? "—" : esc(s).replace(/\n/g, "<br>"));
  const set = (key, doc) => { if (window.KMRReport) KMRReport.set({ key, doc: doc || "", inForm: true }); };
  const cell = (v, c) => `<td class="${c || ""}">${v == null || v === "" ? "—" : v}</td>`;
  const yes = (v) => (v === true || v === "true" ? "Yes" : "No");
  const g = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const STEPS = ["D0 · Symptom and emergency response", "D1 · Team", "D2 · Problem description", "D3 · Interim containment", "D4 · Root causes", "D5 · Permanent corrective actions", "D6 · Implementation and validation", "D7 · Prevention of recurrence", "D8 · Closure and recognition"];
  const kv = (rows) => `<table><colgroup><col style="width:24%"><col style="width:76%"></colgroup><tbody>${rows.map((r) => `<tr><th>${r[0]}</th>${cell(r[1])}</tr>`).join("")}</tbody></table>`;
  const stepHead = (rep, i) => A.sec(STEPS[i] + (rep.steps && rep.steps["D" + i] ? " — done " + dmy(rep.steps["D" + i]) : " — not done"));
  const acts = (rep, kind, title) => {
    const l = (rep.actions || []).filter((a) => a.kind === kind); if (!l.length) return "";
    return `<div class="sub">${title}</div><table><colgroup>${[5, 41, 14, 11, 10, 19].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th class="c">#</th><th>Action</th><th>Owner</th><th class="c">Due</th><th class="c">Done</th><th>Evidence${kind === "PCA" ? " / effectiveness" : ""}</th></tr></thead><tbody>${l.map((a, i) => `<tr>${cell(i + 1, "c")}${cell(nl(a.text))}${cell(esc(a.owner))}${cell(dmy(a.due_on), "c")}${cell(a.status === "done" ? dmy(a.done_on) : "Open", "c")}${cell(nl(a.evidence) + (a.verified ? "<br><b>Effective, checked " + dmy(a.verified_on) + "</b>" : ""))}</tr>`).join("")}</tbody></table>`;
  };

  function report(rep, ctx) {
    set("report", rep.no); const s = rep.sections || {}, an = rep.analysis || {}, co = (window.QP && QP.ctx && QP.ctx.company) || "";
    const d1 = s.d1 || {}, d3 = s.d3 || {}, d4 = s.d4 || {}, d5 = s.d5 || {}, d6 = s.d6 || {}, d7 = s.d7 || {}, d8 = s.d8 || {};
    const members = (d1.members || []).filter((m) => m && m.name);
    let h = A.title("8D PROBLEM SOLVING REPORT", "Eight disciplines: from the symptom to the permanent fix") +
      A.head([[["8D no.", "<b>" + esc(rep.no) + "</b>"], ["Opened", dmy(rep.opened_on)], ["Due", dmy(rep.due_on)]], [["Source", esc(rep.source)], ["Severity", esc(rep.severity)], ["Status", rep.status === "closed" ? "Closed " + dmy(rep.closed_on) : "Open"]],
        [["Customer / from", esc(rep.complainant)], ["Their ref.", esc(rep.complaint_ref)], ["Owner", esc(rep.owner)]], [["Part no.", esc(rep.part_no)], ["Part name", esc(rep.part_name)], ["Lot · quantity", esc(rep.lot_no || "—") + " · " + (rep.qty_affected == null ? "—" : esc(rep.qty_affected))]]]) +
      `<div class="note" style="color:#000;font-size:12px"><b>${esc(rep.title)}</b></div>`;
    h += stepHead(rep, 0) + kv([["Symptom", nl(g(s, "d0.symptom"))], ["Emergency response", g(s, "d0.era_needed") ? nl(g(s, "d0.era")) : "Not needed"]]);
    h += stepHead(rep, 1) + kv([["Team leader", esc(d1.leader)], ["Sponsor / champion", esc(d1.champion)]]) +
      (members.length ? `<table style="margin-top:4px"><thead><tr><th>Team member</th><th>Role</th><th>Function</th></tr></thead><tbody>${members.map((m) => `<tr>${cell(esc(m.name))}${cell(esc(m.role))}${cell(esc(m.function))}</tr>`).join("")}</tbody></table>` : "");
    h += stepHead(rep, 2) + kv([["Requirement", nl(g(s, "d2.requirement"))], ["What is wrong", nl(g(s, "d2.deviation"))], ["Where found", nl(g(s, "d2.where"))], ["When", nl(g(s, "d2.when"))], ["Who found it", nl(g(s, "d2.who"))], ["How it was detected", nl(g(s, "d2.how_detected"))], ["How many", nl(g(s, "d2.how_many"))], ["Seen before", yes(g(s, "d2.repeat"))]]);
    const isn = (an.is_not || []).filter((r) => r && (r.is || r.is_not || r.diff));
    if (isn.length) h += `<div class="sub">Is / Is-not</div><table><colgroup><col style="width:16%"><col style="width:28%"><col style="width:28%"><col style="width:28%"></colgroup><thead><tr><th></th><th>Is</th><th>Is not</th><th>What is different</th></tr></thead><tbody>${isn.map((r) => `<tr><th>${esc(r.dim)}</th>${cell(nl(r.is))}${cell(nl(r.is_not))}${cell(nl(r.diff))}</tr>`).join("")}</tbody></table>`;
    h += stepHead(rep, 3);
    if (d3.not_required) h += kv([["Containment", "Not needed"], ["Reason", nl(d3.reason)]]);
    else {
      const st = (d3.stock || []).filter((r) => r && (r.where || r.action));
      if (st.length) h += `<table><colgroup>${[28, 14, 14, 44].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>Where the stock is</th><th class="c">Checked</th><th class="c">Bad found</th><th>What was done</th></tr></thead><tbody>${st.map((r) => `<tr>${cell(esc(r.where))}${cell(esc(r.checked), "n")}${cell(esc(r.ng), "n")}${cell(nl(r.action))}</tr>`).join("")}</tbody></table>`;
      h += acts(rep, "ICA", "Containment actions") + kv([["Result", nl(d3.result)]]);
    }
    const cz = (k) => { const c = d4[k] || {}; return `<tr><th>${k === "occurrence" ? "Why it happened" : "Why it was not detected"}</th>${cell(nl(c.cause))}${cell(esc(c.category))}${cell((c.verified ? "<b>Verified</b>: " : "Not verified: ") + nl(c.method))}</tr>`; };
    h += stepHead(rep, 4) + `<table><colgroup><col style="width:20%"><col style="width:40%"><col style="width:12%"><col style="width:28%"></colgroup><thead><tr><th></th><th>Root cause</th><th>Category</th><th>Proof</th></tr></thead><tbody>${cz("occurrence")}${cz("escape")}<tr><th>System cause</th>${cell(nl(g(d4, "systemic.cause")))}<td></td><td></td></tr></tbody></table>`;
    const w = an.whys || {};
    ["occurrence", "escape"].forEach((k) => { const l = (w[k] || []).filter(Boolean); if (l.length) h += `<div class="sub">5-Why · ${k === "occurrence" ? "why it happened" : "why it was not detected"}</div><table><tbody>${l.map((x, i) => `<tr><th style="width:10%">Why ${i + 1}</th>${cell(nl(x))}</tr>`).join("")}</tbody></table>`; });
    const fb = Object.entries(an.fishbone || {}).filter(([, v]) => (v || []).some(Boolean));
    if (fb.length) h += `<div class="sub">Cause and effect (fishbone)</div><table><tbody>${fb.map(([k, v]) => `<tr><th style="width:18%">${esc(k)}</th>${cell(v.filter(Boolean).map(esc).join("<br>"))}</tr>`).join("")}</tbody></table>`;
    const opts = (d5.options || []).filter((o) => o && o.text);
    h += stepHead(rep, 5) + (opts.length ? `<table><colgroup><col style="width:50%"><col style="width:10%"><col style="width:40%"></colgroup><thead><tr><th>Option considered</th><th class="c">Chosen</th><th>How it was checked</th></tr></thead><tbody>${opts.map((o) => `<tr>${cell(nl(o.text))}${cell(yes(o.chosen), "c")}${cell(nl(o.verification))}</tr>`).join("")}</tbody></table>` : "") + acts(rep, "PCA", "Permanent corrective actions") + kv([["Check before roll-out", nl(d5.verification_summary)]]);
    const v = d6.validation || {};
    h += stepHead(rep, 6) + kv([["Validation method", nl(v.method)], ["Result", nl(v.result)], ["Date", dmy(v.date)], ["Problem gone", yes(v.ok)], ["Containment removed", g(d6, "ica_removed.done") ? "Yes " + dmy(g(d6, "ica_removed.date")) : "No"], ["Monitoring (days)", esc(g(d6, "monitoring.days"))]]);
    const dc = (d7.docs || []).filter((x) => x && x.name);
    h += stepHead(rep, 7) + (dc.length ? `<table><colgroup><col style="width:40%"><col style="width:15%"><col style="width:45%"></colgroup><thead><tr><th>Document</th><th class="c">Updated</th><th>Revision / reference</th></tr></thead><tbody>${dc.map((x) => `<tr>${cell(esc(x.name))}${cell(yes(x.done), "c")}${cell(esc(x.ref))}</tr>`).join("")}</tbody></table>` : "") + acts(rep, "PREVENT", "Prevention actions") + kv([["Similar parts and processes checked", nl(d7.horizontal)], ["Lessons learned", nl(d7.lessons)]]);
    h += stepHead(rep, 8) + kv([["Customer accepted the 8D", yes(d8.customer_accepted)], ["Customer reference", nl(d8.customer_ref)], ["Team recognition", nl(d8.recognition)], ["Closing note", nl(d8.note)]]);
    h += A.signoff(ctx && ctx.me);
    return A.wrap("port", h);
  }

  /* Esbee Precision Industries' own complaint list (their form F-03-27): one table per customer, Sl No. restarting for each,
     with the 8D reference and the D-2 / D-14 / D-60 dates. Used only when the company's print format is "esbee" (set by KMR staff). */
  function registerEsbee(list, filt) {
    if (window.KMRReport) KMRReport.set({ key: "register", doc: "", inForm: true, format: "F-03-27", rev: "00", date: "2026-11-17" });
    const by = {}; list.slice().sort((a, b) => String(a.opened_on).localeCompare(String(b.opened_on)) || String(a.no).localeCompare(String(b.no))).forEach((r) => { const k = (r.esbee && r.esbee.customer_group) || r.complainant || "Other"; (by[k] = by[k] || []).push(r); });
    const yr = (list.map((r) => String(r.opened_on || "").slice(0, 4)).sort().pop()) || String(new Date().getFullYear());
    const dm = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] + "-" + m[1].slice(2) : ""; };
    const qty = (r) => (r.esbee && r.esbee.complaint_qty_text) || (r.qty_affected == null ? "" : String(Number(r.qty_affected)));
    const part = (r) => esc([r.part_no, r.part_name].filter(Boolean).join(" / "));
    const cols = [4, 7, 8, 14, 22, 5, 7, 6, 6, 6, 6, 7, 7, 6, 5];
    const tbl = Object.keys(by).map((k) => `<div class="blk" style="margin-top:8px"><b>${esc(k)}</b><table><colgroup>${cols.map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th rowspan="2">Sl No.</th><th rowspan="2">Complaint Date</th><th rowspan="2">Customer</th><th rowspan="2">Part No. / Part Name</th><th rowspan="2">Nature of Complaint</th><th rowspan="2">Complaint Qty</th><th rowspan="2">Customer NC reference</th><th colspan="4" class="c">8D details</th><th rowspan="2">Status</th><th rowspan="2">Closed Date</th><th rowspan="2">Repeated complaint Y/N</th><th rowspan="2">Sign</th></tr><tr><th>Ref</th><th>D-2</th><th>D-14</th><th>D-60</th></tr></thead><tbody>${by[k].map((r, i) => { const e = r.esbee || {}; return `<tr>${cell(String(i + 1), "c")}${cell(dm(r.opened_on), "c")}${cell(esc(e.customer_group || r.complainant))}${cell(part(r))}${cell(esc(r.title))}${cell(esc(qty(r)), "c")}${cell(esc(e.nc_ref || r.complaint_ref || "Nil"), "c")}${cell(esc(e.ref_8d || r.no), "c")}${cell(dm(e.d2), "c")}${cell(dm(e.d14), "c")}${cell(dm(e.d60), "c")}${cell(r.status === "closed" ? "Completed" : "Open", "c")}${cell(r.status === "closed" ? dm(r.closed_on) : "", "c")}${cell(esc(e.repeated || ""), "c")}${cell("")}</tr>`; }).join("")}</tbody></table></div>`).join("");
    return A.wrap("land", A.title("LIST OF CUSTOMER COMPLAINTS-" + yr, "Esbee Precision Industries") + A.head([[["Filter", esc(filt || "All")], ["Complaints", String(list.length)], ["Open", String(list.filter((r) => r.status === "open").length)]]]) + (tbl || "<p>No complaints.</p>"));
  }
  function register(list, filt, o) {
    if (o && o.format === "esbee") return registerEsbee(list, filt);
    set("register", "");
    const rows = list.map((r) => `<tr>${cell("<b>" + esc(r.no) + "</b>")}${cell(esc(r.title))}${cell(esc(r.source))}${cell(esc(r.part_no))}${cell(esc(r.severity), "c")}${cell(dmy(r.opened_on), "c")}${cell(dmy(r.due_on), "c")}${cell(r.status === "closed" ? "Closed " + dmy(r.closed_on) : esc(r.current || "") , "c")}${cell(esc(r.owner))}</tr>`).join("");
    return A.wrap("land", A.title("8D REGISTER", "Customer complaints and internal problems") + A.head([[["Filter", esc(filt || "All")], ["8Ds", String(list.length)], ["Open", String(list.filter((r) => r.status === "open").length)]]]) +
      `<table><colgroup>${[11, 27, 12, 10, 7, 8, 8, 8, 9].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>8D no.</th><th>Problem</th><th>Source</th><th>Part no.</th><th class="c">Severity</th><th class="c">Opened</th><th class="c">Due</th><th class="c">Step / status</th><th>Owner</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No 8D reports.</td></tr>'}</tbody></table>`);
  }
  function scrap(rows, filt, tot) {
    set("scrap", "");
    const n = (v) => Number(v || 0), cols = [14, 30, 30, 8, 8, 10];
    const by = (k) => { const m = {}; rows.forEach((r) => { m[r[k] || "—"] = (m[r[k] || "—"] || 0) + n(r.q); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], parts = {};
    rows.forEach((r) => { const k = r.c + "|" + r.p; (parts[k] = parts[k] || { c: r.c, p: r.p, m: Array(12).fill(0), t: 0 }); parts[k].m[Number(String(r.d).slice(5, 7)) - 1] += n(r.q); parts[k].t += n(r.q); });
    const pl = Object.values(parts).sort((a, b) => a.c.localeCompare(b.c) || b.t - a.t);
    const mt = Array(12).fill(0); rows.forEach((r) => (mt[Number(String(r.d).slice(5, 7)) - 1] += n(r.q)));
    const yr = (rows[0] && String(rows[0].d).slice(0, 4)) || String(new Date().getFullYear());
    return A.wrap("land", A.title("INTERNAL SCRAP REGISTER " + yr, "Esbee Precision Industries — in-process, visual and setting rejections") + A.head([[["Filter", esc(filt || "All customers")], ["Scrap pieces", String(tot)], ["Records", String(rows.length)]]]) +
      `<div class="sub">Scrap pieces by month and part</div><table><thead><tr><th>Customer</th><th>Part</th>${MN.map((m) => `<th class="c">${m}</th>`).join("")}<th class="c">Total</th></tr></thead><tbody>${pl.map((x) => `<tr>${cell(esc(x.c))}${cell(esc(x.p))}${x.m.map((v) => cell(v || "", "c")).join("")}${cell("<b>" + x.t + "</b>", "c")}</tr>`).join("")}<tr><th colspan="2">Total</th>${mt.map((v) => `<th class="c">${v || ""}</th>`).join("")}<th class="c">${tot}</th></tr></tbody></table>` +
      `<div class="two" style="display:flex;gap:14px;margin-top:8px"><div style="flex:1"><div class="sub">Top defects</div><table><thead><tr><th>Defect</th><th class="c">Pieces</th></tr></thead><tbody>${by("df").slice(0, 12).map((x) => `<tr>${cell(esc(x[0]))}${cell(x[1], "c")}</tr>`).join("")}</tbody></table></div><div style="flex:1"><div class="sub">By stage</div><table><thead><tr><th>Stage</th><th class="c">Pieces</th></tr></thead><tbody>${by("sec").map((x) => `<tr>${cell(esc(x[0] === "—" ? "Not stated in sheet" : x[0]))}${cell(x[1], "c")}</tr>`).join("")}</tbody></table></div></div>` +
      `<div class="note" style="font-size:11px">Production quantities are not recorded in the source sheets, so parts per million (PPM) is not shown.</div>`);
  }
  function actions(list, filt) {
    set("actions", "");
    const K = { ICA: "Containment", PCA: "Corrective", PREVENT: "Prevention" };
    const rows = list.map((a) => `<tr>${cell("<b>" + esc(a.report_no) + "</b>")}${cell(K[a.kind] || esc(a.kind))}${cell(nl(a.text))}${cell(esc(a.owner))}${cell(dmy(a.due_on), "c")}${cell(a.status === "done" ? "Done " + dmy(a.done_on) : a.overdue ? "<b>Late</b>" : "Open", "c")}</tr>`).join("");
    return A.wrap("land", A.title("8D ACTION LIST", "Actions of all 8D reports") + A.head([[["Filter", esc(filt || "All")], ["Actions", String(list.length)], ["Late", String(list.filter((a) => a.overdue).length)]]]) +
      `<table><colgroup>${[12, 11, 41, 15, 9, 12].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>8D no.</th><th>Kind</th><th>Action</th><th>Owner</th><th class="c">Due</th><th class="c">Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No actions.</td></tr>'}</tbody></table>`);
  }
  function qalert(rep) {
    set("qalert", rep.no); const s = rep.sections || {}, d7 = s.d7 || {}, q = d7.qalert || {}, tr = (d7.qatrain || []).filter((x) => x && (x.name || x.date));
    return A.wrap("port", A.title("Q ALERT · ONE POINT LESSON", "Quality is everyone's responsibility and we all follow the same rules") +
      A.head([[["8D no.", "<b>" + esc(rep.no) + "</b>"], ["Tracking no.", esc(q.tracking_no || rep.complaint_ref)], ["Classification", esc(q.classification || rep.severity)]], [["Part no.", esc(q.part_no || rep.part_no)], ["Part name", esc(q.part_name || rep.part_name)], ["Customer", esc(q.customer || rep.complainant)]], [["Complaint date", esc(q.date)], ["Quantity", esc(q.qty)], ["Released · effective from", dmy(q.released) + " · " + dmy(q.effective)]]]) +
      kv([["Customer complaint / problem", nl(q.complaint || rep.title)], ["Primary root cause", nl(q.root_cause)], ["Interim corrective action (short term)", nl(q.ica)], ["Permanent corrective action (long term)", nl(q.pca)]]) +
      `<div class="sub">Training record</div><table><colgroup><col style="width:6%"><col style="width:20%"><col style="width:44%"><col style="width:30%"></colgroup><thead><tr><th class="c">#</th><th class="c">Date</th><th>Name of team member</th><th>Signature</th></tr></thead><tbody>${tr.map((x, i) => `<tr>${cell(i + 1, "c")}${cell(esc(x.date), "c")}${cell(esc(x.name))}<td></td></tr>`).join("") || '<tr><td colspan="4">No one recorded yet.</td></tr>'}</tbody></table>` +
      kv([["Prepared by", esc(q.prepared)], ["Approved by (Quality)", esc(q.appr_q)], ["Approved by (Production)", esc(q.appr_p)]]));
  }
  function eye(rep) {
    set("eye", rep.no); const d7 = (rep.sections || {}).d7 || {}, e = d7.eyeinfo || {}, l = (d7.eye || []).filter((x) => x && x.defect);
    return A.wrap("port", A.title(esc(e.title || "EYE SEQUENCE CHART"), "Visual inspection: defects to look for, in the order of the check") +
      A.head([[["8D no.", "<b>" + esc(rep.no) + "</b>"], ["Document no.", esc(e.doc)], ["Revision · date", esc(e.rev) + " · " + esc(e.rev_date)]], [["Part no.", esc(rep.part_no)], ["Prepared by", esc(e.prepared)], ["Approved by", esc(e.approved)]]]) +
      `<table><colgroup>${[6, 50, 22, 8, 14].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th class="c">#</th><th>Defect to look for</th><th>Criticality</th><th class="c">Freq.</th><th>Responsibility</th></tr></thead><tbody>${l.map((x, i) => `<tr>${cell(i + 1, "c")}${cell(esc(x.defect))}${cell(esc(x.crit))}${cell(esc(x.freq), "c")}${cell(esc(x.resp))}</tr>`).join("") || '<tr><td colspan="5">No defects listed.</td></tr>'}</tbody></table>`);
  }
  window.D8Docs = { report, register, actions, scrap, qalert, eye };
})();
