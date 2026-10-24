/* Internal Audit - IQA schedule by process (year view) and the nonconformity summary: process against clause, with a plain-words summary.
   Loaded after aud-nc.js. Reads the audit list and the findings list; nothing is stored here. */
(function () {
  "use strict";
  const A = window.AUD, { S, chip, opts, guard, go, today } = A;
  const { $, esc, fmt, call } = QP;
  const LB = () => window.AudLib;
  const MON = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const fyNow = () => { const d = new Date(today() + "T00:00:00"); return d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); };
  const fyLabel = (y) => y + "-" + String(y + 1).slice(2);
  const inFy = (d, y) => !!d && d >= y + "-04-01" && d <= y + 1 + "-03-31";
  const TC = { System: "S", Process: "P", Product: "Pr", LPA: "L", Document: "D", Supplier: "Su", Special: "Sp", EHS: "E", Lab: "Lb" };
  const procName = (id) => (LB().PROC.find((p) => p[0] === id) || [0, ""])[1];
  const R = { fy: null };

  /* ---------------- schedule ---------------- */
  async function screenSch() {
    const el = $("#sch"); if (!R.fy) R.fy = fyNow();
    const all = await call("kmr_aud_audit_list", { p: { status: "all" } }), t = today();
    const list = all.filter((a) => a.status !== "cancelled" && inFy(a.planned_on || a.done_on, R.fy));
    const PR = LB().PROC.filter((p) => p[0] !== "all").concat([["all", "All processes / not tied to one process"]]);
    const rowOf = (a) => { const p = (a.meta || {}).proc; return PR.some((x) => x[0] === p) ? p : "all"; };
    const mi = (d) => { const m = +d.slice(5, 7); return (m + 8) % 12; };
    const col = (a) => (a.status === "closed" ? "g" : a.status === "reported" ? "v" : a.late ? "r" : "b");
    const rows = PR.map((p) => { const mine = list.filter((a) => rowOf(a) === p[0]); return { p, mine }; });
    const none = rows.filter((r) => r.p[0] !== "all" && !r.mine.length && !list.some((a) => rowOf(a) === "all" && a.type === "System")).length;
    el.innerHTML = `<div class="guide">The year of internal quality audits (IQA) for every process: when each is planned, done or late. Tap an audit to open it. A process with no audit is shown in red: every process must be audited at least once in the year (IATF 16949 9.2.2.2).</div>
      <div class="row"><select id="s_fy" style="width:auto">${opts([fyNow() - 1, fyNow(), fyNow() + 1].map((y) => [y, "Financial year " + fyLabel(y)]), R.fy)}</select><span style="flex:1"></span>${A.canEdit() ? '<button class="btn" id="s_gen">Make the year programme</button>' : ""}<button class="btn o" id="s_pr">Print schedule</button></div>
      <div class="kpis"><div class="kpi" style="cursor:default"><b>${list.length}</b><span>audits in the year</span></div><div class="kpi" style="cursor:default;--c:var(--g)"><b>${list.filter((a) => ["reported", "closed"].includes(a.status)).length}</b><span>done</span></div><div class="kpi" style="cursor:default;--c:var(--r)"><b>${list.filter((a) => a.late).length}</b><span>late</span></div><div class="kpi" style="cursor:default;--c:${none ? "var(--r)" : "var(--g)"}"><b>${none}</b><span>processes with no audit</span></div></div>
      <div class="sc"><table class="tb2 sch"><thead><tr><th>Process</th>${MON.map((m) => `<th class="c">${m}</th>`).join("")}<th class="c">Audits</th></tr></thead><tbody>${rows.map((r) => {
        const cells = MON.map((m, i) => `<td class="c">${r.mine.filter((a) => mi(a.planned_on || a.done_on) === i).map((a) => `<a href="#go=list&id=${a.id}" class="sbx ${col(a)}" title="${esc(a.no + " · " + a.title + " · " + (a.auditor || "no auditor"))}">${TC[a.type] || "?"}</a>`).join("")}</td>`).join("");
        const gap = r.p[0] !== "all" && !r.mine.length && !list.some((a) => rowOf(a) === "all" && a.type === "System");
        return `<tr class="${gap ? "gap" : ""}"><td><b>${esc(r.p[1])}</b>${gap ? '<br><small class="late">No audit planned</small>' : ""}</td>${cells}<td class="c">${r.mine.length}</td></tr>`; }).join("")}</tbody></table></div>
      <div class="row" style="margin-top:8px">${Object.keys(TC).map((k) => `<span class="mut" style="font-size:12.5px"><b>${TC[k]}</b> ${esc((LB().TYPES[k] || {}).name || k)}</span>`).join(" · ")}</div>
      <div class="row"><span class="sbx b">·</span> planned <span class="sbx r">·</span> late <span class="sbx v">·</span> report issued <span class="sbx g">·</span> closed</div>`;
    $("#s_fy").onchange = (e) => { R.fy = +e.target.value; screenSch(); };
    const g = $("#s_gen"); if (g) g.onclick = () => go("go=list&prog=1");
    $("#s_pr").onclick = () => A.showDoc(AudDocs.schedule({ fy: fyLabel(R.fy), rows: rows.map((r) => ({ name: r.p[1], gap: r.p[0] !== "all" && !r.mine.length, cells: MON.map((m, i) => r.mine.filter((a) => mi(a.planned_on || a.done_on) === i).map((a) => ({ t: TC[a.type] || "?", d: (a.planned_on || a.done_on || "").slice(8, 10), s: a.status === "closed" ? "C" : a.status === "reported" ? "R" : a.late ? "L" : "P" }))) })), months: MON, legend: Object.keys(TC).map((k) => TC[k] + " " + ((LB().TYPES[k] || {}).name || k)) }));
  }

  /* ---------------- nonconformity summary: process against clause ---------------- */
  const SF = { fy: null, sel: null };
  const shortStd = (s) => { const x = String(s || "").trim(); if (!x) return ""; if (/IATF/i.test(x)) return "IATF"; if (/ISO\s*9001/i.test(x)) return "ISO 9001"; if (/ISO\s*14001/i.test(x)) return "ISO 14001"; if (/ISO\s*45001/i.test(x)) return "ISO 45001"; if (/VDA\s*6\.3/i.test(x)) return "VDA 6.3"; if (/VDA\s*6\.5/i.test(x)) return "VDA 6.5"; if (/CQI/i.test(x)) return "CQI"; if (/AIAG/i.test(x)) return "AIAG"; return x.split(" ")[0]; };
  const groupOf = (c) => { const x = String(c || "").replace(/^(ISO|IATF|VDA)[^0-9P]*/i, "").trim(); const m = /^(P\d+|\d+)/i.exec(x); return m ? m[1].toUpperCase() : x.split(" ")[0] || "—"; };
  async function screenSum() {
    const el = $("#sum"); if (!SF.fy) SF.fy = fyNow();
    const [ncs, auds] = await Promise.all([call("kmr_aud_nc_list", { p: { status: "all" } }), call("kmr_aud_audit_list", { p: { status: "all" } })]);
    const am = {}; auds.forEach((a) => (am[a.id] = a));
    const rows = ncs.filter((n) => inFy((n.created_at || "").slice(0, 10), SF.fy)).map((n) => {
      const a = am[n.audit_id] || {}, p = (a.meta || {}).proc, pn = p && p !== "all" ? procName(p) : n.area || "All processes";
      return Object.assign({}, n, { proc: pn, col: (shortStd(n.standard) + " " + groupOf(n.clause)).trim() || "Other", m: LB().mOfCat(n.cat) });
    });
    const sum = (f) => { const m = {}; rows.forEach((r) => { const k = f(r); m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map((k) => [k, m[k]]).sort((x, y) => y[1] - x[1]); };
    const byP = sum((r) => r.proc), byC = sum((r) => r.col), byM = sum((r) => r.m);
    const cols = byC.slice(0, 10).map((x) => x[0]), P = byP.map((x) => x[0]);
    const cell = (p, c) => rows.filter((r) => r.proc === p && (cols.includes(r.col) ? r.col === c : c === "Other"));
    const colsShow = byC.length > 10 ? cols.concat(["Other"]) : cols;
    const maj = rows.filter((r) => r.severity === "Major").length, open = rows.filter((r) => !["closed", "cancelled"].includes(r.status)).length, late = rows.filter((r) => r.overdue).length, rep = rows.filter((r) => r.repeat_of || r.loops > 0).length;
    const chk = rows.filter((r) => r.mon_result), eff = chk.length ? Math.round((100 * chk.filter((r) => r.mon_result === "effective").length) / chk.length) : null;
    const topP = byP[0], topC = byC[0], pc = topP ? rows.filter((r) => r.proc === topP[0]) : [], pcTop = pc.length ? Object.entries(pc.reduce((m, r) => ((m[r.col] = (m[r.col] || 0) + 1), m), {})).sort((x, y) => y[1] - x[1])[0] : null;
    const catTop = topC ? Object.entries(rows.filter((r) => r.col === topC[0]).reduce((m, r) => ((m[r.cat || "cap"] = (m[r.cat || "cap"] || 0) + 1), m), {})).sort((x, y) => y[1] - x[1])[0] : null;
    const rec = catTop ? LB().recFor(catTop[0]) : null;
    const brief = !rows.length ? ["No nonconformity was raised in " + fyLabel(SF.fy) + "."] : [
      `${rows.length} nonconformities were raised in ${fyLabel(SF.fy)}: ${maj} Major and ${rows.length - maj} Minor. ${open} are still open${late ? `, ${late} of them late` : ""}.`,
      topP ? `${topP[0]} has the most (${topP[1]}${pcTop ? `, mainly ${pcTop[0]}: ${pcTop[1]}` : ""}).` : "",
      topC ? `The clause group with the most findings is ${topC[0]} (${topC[1]}), mostly about "${rec ? rec.n.toLowerCase() : ""}".` : "",
      byM.length ? `By the 6M: ${byM.map((x) => x[0] + " " + x[1]).join(", ")}.` : "",
      rep ? `${rep} finding${rep > 1 ? "s are" : " is"} a repeat or came back after an action that was not effective: look at the system, not the person.` : "No repeat findings.",
      eff == null ? "No effectiveness check has been done yet." : `${eff}% of the effectiveness checks done so far showed the action worked.`,
      rec ? `Suggested focus: ${rec.p[0]}` : ""].filter(Boolean);
    const maxM = Math.max(1, ...byM.map((x) => x[1]));
    el.innerHTML = `<div class="guide">Where the nonconformities are: each process against the clause group of the standard. Red = at least one Major. Tap a number to see those findings.</div>
      <div class="row"><select id="u_fy" style="width:auto">${opts([fyNow() - 1, fyNow(), fyNow() + 1].map((y) => [y, "Financial year " + fyLabel(y)]), SF.fy)}</select><span style="flex:1"></span><button class="btn o" id="u_pr">Print summary</button></div>
      <div class="card"><h3>Summary</h3><ul style="margin:0 0 0 18px">${brief.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>
      ${rows.length ? `<div class="sc"><table class="tb2 mtx"><thead><tr><th>Process</th>${colsShow.map((c) => `<th class="c">${esc(c)}</th>`).join("")}<th class="c">Total</th></tr></thead><tbody>${P.map((p) => `<tr><td><b>${esc(p)}</b></td>${colsShow.map((c) => { const l = cell(p, c); return `<td class="c">${l.length ? `<button class="mc ${l.some((r) => r.severity === "Major") ? "r" : "a"}" data-p="${esc(p)}" data-c="${esc(c)}">${l.length}</button>` : ""}</td>`; }).join("")}<td class="c"><b>${byP.find((x) => x[0] === p)[1]}</b></td></tr>`).join("")}
        <tr class="tot"><td><b>Total</b></td>${colsShow.map((c) => `<td class="c"><b>${rows.filter((r) => (cols.includes(r.col) ? r.col === c : c === "Other")).length}</b></td>`).join("")}<td class="c"><b>${rows.length}</b></td></tr></tbody></table></div>
      <div class="card" style="margin-top:12px"><h3>By the 6M</h3>${byM.map((x) => `<div class="bl" style="display:grid;grid-template-columns:110px 1fr 36px;gap:8px;align-items:center;margin:6px 0"><span>${esc(x[0])}</span><span style="background:var(--bg);border-radius:6px;height:12px;display:block"><i style="display:block;height:12px;border-radius:6px;width:${(x[1] / maxM) * 100}%;background:linear-gradient(90deg,var(--b1),var(--b2))"></i></span><b>${x[1]}</b></div>`).join("")}</div>
      <div id="u_list"></div>` : ""}`;
    $("#u_fy").onchange = (e) => { SF.fy = +e.target.value; SF.sel = null; screenSum(); };
    const show = () => { const b = $("#u_list"); if (!b || !SF.sel) { if (b) b.innerHTML = ""; return; } const l = cell(SF.sel[0], SF.sel[1]); b.innerHTML = `<div class="card"><h3>${esc(SF.sel[0])} · ${esc(SF.sel[1])}</h3>${l.map((n) => `<div class="act" style="cursor:pointer;padding:6px 0;border-bottom:1px solid var(--line)" data-n="${n.id}"><div class="as">${chip(n.severity, n.severity === "Major" ? "r" : "a")} <b>${esc(n.no)}</b> ${esc(String(n.problem || "").replace(/ \(Requirement:.*$/, "")).slice(0, 140)}</div><small class="mut">${esc((n.standard || "") + " " + (n.clause || ""))} · ${esc(n.status)} · ${esc(n.owner || "")}</small></div>`).join("")}</div>`; b.querySelectorAll("[data-n]").forEach((e) => (e.onclick = () => go("go=nc&id=" + e.dataset.n))); };
    el.querySelectorAll(".mc").forEach((b) => (b.onclick = () => { SF.sel = [b.dataset.p, b.dataset.c]; show(); $("#u_list").scrollIntoView({ behavior: "smooth" }); }));
    show();
    $("#u_pr").onclick = () => A.showDoc(AudDocs.summary({ fy: fyLabel(SF.fy), brief, cols: colsShow, rows: P.map((p) => ({ name: p, cells: colsShow.map((c) => { const l = cell(p, c); return { n: l.length, major: l.some((r) => r.severity === "Major") }; }), total: byP.find((x) => x[0] === p)[1] })), totals: colsShow.map((c) => rows.filter((r) => (cols.includes(r.col) ? r.col === c : c === "Other")).length), total: rows.length, m: byM }));
  }
  A.screens.sch = screenSch; A.screens.sum = screenSum;
})();
