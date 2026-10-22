/* Internal Audit - printed forms: the audit plan, the audit report, the audit programme and the findings list.
   Each form is built inside the standard report frame (AIAGForm.wrap): customer logo top-left, unique report ref. no., format no. / revision / date at the foot of every page. */
(function () {
  "use strict";
  const A = window.AIAGForm, esc = A.esc;
  const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : s ? esc(s) : "—"; };
  const nl = (s) => (s == null || s === "" ? "—" : esc(s).replace(/\n/g, "<br>"));
  const set = (key, doc) => { if (window.KMRReport) KMRReport.set({ key, doc: doc || "", inForm: true }); };
  const cell = (v, c) => `<td class="${c || ""}">${v == null || v === "" ? "—" : v}</td>`;
  const TY = { System: "System audit", Process: "Process audit", Product: "Product audit", Supplier: "Supplier audit" };
  const ST = { planned: "Planned", reported: "Report issued", closed: "Closed", cancelled: "Cancelled" };
  const FIND = (r) => ["Minor", "Major", "8", "4", "0"].includes(String(r));
  const hd = (a) => A.head([[["Audit no.", "<b>" + esc(a.no) + "</b>"], ["Type", esc(TY[a.type] || a.type)], ["Status", esc(ST[a.status] || a.status)]], [["Area / process", esc(a.area)], ["Scope", esc(a.scope)], ["Shifts", (a.shifts || []).map(esc).join(", ") || "—"]],
    [["Planned", dmy(a.planned_on)], ["Done", dmy(a.done_on)], ["Report issued", dmy(a.reported_on)]], [["Auditor", esc(a.auditor)], ["Audited", esc(a.auditee)], ["Closed", dmy(a.closed_on)]]]);

  function plan(a) {
    set("plan", a.no);
    const rows = (a.checklist || []).map((x, i) => `<tr>${cell(i + 1, "c")}${cell(nl(x.q))}${cell(esc(x.ref))}${cell("&nbsp;", "c")}${cell("&nbsp;")}</tr>`).join("");
    return A.wrap("port", A.title("INTERNAL AUDIT PLAN", esc(a.title || "")) + hd(a) + A.sec("Checklist for the auditor") +
      `<table><colgroup>${[5, 50, 17, 10, 18].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th class="c">#</th><th>Question</th><th>Reference</th><th class="c">Rating</th><th>Evidence seen</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No questions.</td></tr>'}</tbody></table>` +
      `<div class="note" style="color:#000;font-size:11.5px">${a.type === "Process" ? "Rating: 10 fully met · 8 small gap · 4 large gap · 0 not met · NA not applicable." : "Rating: OK · Minor · Major · Observation · NA (not applicable)."} The auditor must not audit their own work.</div>` + A.signoff());
  }
  function report(a) {
    set("report", a.no);
    const cl = a.checklist || [], acts = a.actions || [], hs = a.has_scoring && a.type === "Process" && a.score != null;
    const rows = cl.map((x, i) => `<tr>${cell(i + 1, "c")}${cell(nl(x.q))}${cell(esc(x.ref))}${cell("<b>" + esc(x.rating || "—") + "</b>", "c")}${cell(nl(x.note))}</tr>`).join("");
    const fa = acts.map((y, i) => { const q = cl.findIndex((x) => x.id === y.q_id); return `<tr>${cell(i + 1, "c")}${cell(q >= 0 ? "Q" + (q + 1) : "General", "c")}${cell(nl(y.text))}${cell(esc(y.owner))}${cell(dmy(y.due_on), "c")}${cell(y.status === "done" ? dmy(y.done_on) : "Open", "c")}${cell(nl(y.evidence) + (y.verified ? "<br><b>Effective, checked " + dmy(y.verified_on) + "</b>" : ""))}</tr>`; }).join("");
    return A.wrap("port", A.title("INTERNAL AUDIT REPORT", esc(a.title || "")) + hd(a) +
      (hs ? `<div class="note" style="color:#000;font-size:13px"><b>Result: ${esc(a.score)}% · Grade ${esc(a.grade)}</b> &nbsp; (A 90% and above · B 80% to 89% · C below 80%; a question rated 0 holds the grade at B or lower)</div>` : "") +
      A.sec("Summary and conclusion") + `<table><tbody><tr>${cell(nl(a.summary))}</tr></tbody></table>` + A.sec("Checklist and ratings") +
      `<table><colgroup>${[5, 40, 17, 9, 29].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th class="c">#</th><th>Question</th><th>Reference</th><th class="c">Rating</th><th>What was seen</th></tr></thead><tbody>${rows}</tbody></table>` +
      A.sec("Findings, actions and follow-up") + (fa ? `<table><colgroup>${[4, 7, 31, 14, 10, 10, 24].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th class="c">#</th><th class="c">Q</th><th>Action</th><th>Owner</th><th class="c">Due</th><th class="c">Done</th><th>Evidence / effectiveness</th></tr></thead><tbody>${fa}</tbody></table>` : '<table><tbody><tr><td>No findings needing action.</td></tr></tbody></table>') + A.signoff());
  }
  function register(list, filt) {
    set("register", "");
    const rows = list.map((r) => `<tr>${cell("<b>" + esc(r.no) + "</b>")}${cell(esc(r.title))}${cell(esc(TY[r.type] || r.type))}${cell(esc(r.area))}${cell(esc(r.auditor))}${cell(dmy(r.status === "planned" ? r.planned_on : r.done_on), "c")}${cell(r.grade ? esc(r.grade) + " · " + esc(r.score) + "%" : "—", "c")}${cell(esc(ST[r.status] || r.status) + (r.late ? " · <b>Late</b>" : ""), "c")}</tr>`).join("");
    return A.wrap("land", A.title("INTERNAL AUDIT PROGRAMME", "Planned and completed audits") + A.head([[["Filter", esc(filt || "All")], ["Audits", String(list.length)], ["Late", String(list.filter((r) => r.late).length)]]]) +
      `<table><colgroup>${[11, 27, 11, 13, 11, 8, 8, 11].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>Audit no.</th><th>Title</th><th>Type</th><th>Area</th><th>Auditor</th><th class="c">Date</th><th class="c">Score</th><th class="c">Status</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No audits.</td></tr>'}</tbody></table>` + A.signoff());
  }
  function actions(list, filt) {
    set("actions", "");
    const rows = list.map((a) => `<tr>${cell("<b>" + esc(a.audit_no) + "</b>")}${cell(nl(a.text))}${cell(esc(a.owner))}${cell(dmy(a.due_on), "c")}${cell(a.status === "done" ? "Done " + dmy(a.done_on) : a.overdue ? "<b>Late</b>" : "Open", "c")}${cell(a.verified ? "Effective" : a.status === "done" ? "To check" : "—", "c")}</tr>`).join("");
    return A.wrap("land", A.title("AUDIT FINDINGS AND ACTIONS", "Actions of all internal audits") + A.head([[["Filter", esc(filt || "All")], ["Actions", String(list.length)], ["Late", String(list.filter((a) => a.overdue).length)]]]) +
      `<table><colgroup>${[13, 42, 15, 9, 11, 10].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr><th>Audit no.</th><th>Action</th><th>Owner</th><th class="c">Due</th><th class="c">Status</th><th class="c">Effect</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No actions.</td></tr>'}</tbody></table>` + A.signoff());
  }
  window.AudDocs = { plan, report, register, actions };
})();
