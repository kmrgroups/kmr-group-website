/* =====================================================================
   PFMEA formats — one set of ratings (S / O / D, 1–10) shown in two editions:
     "vda"   AIAG & VDA FMEA Handbook, 1st edition (2019): 7-step approach, Action Priority (H / M / L)
     "aiag4" AIAG FMEA Reference Manual, 4th edition (2008): single form, RPN = S × O × D, recommended actions
   The generator fills the row data once; the format decides the columns, the risk measure and the action rule.
   The rating guides below are short summaries written for quick reference — the team rates against the full
   tables of the edition (and the customer's own requirements) it is working to.
   ===================================================================== */
(function(){
"use strict";
const STD = { vda:"AIAG-VDA (2019)", aiag4:"AIAG FMEA 4th edition (2008)" };
const STD_LONG = { vda:"AIAG & VDA FMEA Handbook, 1st edition (2019) — 7-step approach, Action Priority", aiag4:"AIAG FMEA Reference Manual, 4th edition (2008) — RPN = Severity × Occurrence × Detection" };
const DEFAULT_RPN = 100;

const rpn = (s,o,d)=>{ s=+s; o=+o; d=+d; return (s&&o&&d) ? s*o*d : ""; };
const limitOf = (settings)=>{ const v=+(settings&&settings.fmeaRpn); return v>0 ? v : DEFAULT_RPN; };
/* 4th edition: act on every severity 9–10, and on any RPN at or above the team's limit (the manual sets no fixed limit) */
const needsAction = (std, r, limit)=>{
  const s=+r.s, o=+r.o, d=+r.d; if(!s||!o||!d) return false;
  if(std==="aiag4") return s>=9 || s*o*d >= (limit||DEFAULT_RPN);
  const ap=window.PDDocs.AP(s,o,d); return ap==="H" || (ap==="M" && s>=7);
};
/* colour band for the risk cell */
const band = (std, s, o, d, limit)=>{
  s=+s; o=+o; d=+d; if(!s||!o||!d) return "";
  if(std==="aiag4"){ const v=s*o*d, L=limit||DEFAULT_RPN; return (s>=9||v>=L) ? "H" : v>=L/2 ? "M" : "L"; }
  return window.PDDocs.AP(s,o,d);
};

/* ---------- columns of the 4th-edition PFMEA form ---------- */
const AIAG4 = {
  groups:[["PROCESS FUNCTION / REQUIREMENTS",3],["POTENTIAL FAILURE",4],["CAUSES, CONTROLS & RISK",6],["RECOMMENDED ACTION",3],["ACTION RESULTS",6]],
  cols:[
    {k:"opNo",label:"Op",w:3.5,type:"num"},{k:"step",label:"Process function (step / station)",w:12,type:"long"},{k:"funcStep",label:"Requirements (product characteristic)",w:13,type:"long"},
    {k:"fm",label:"Potential failure mode",w:13,type:"long"},{k:"fe",label:"Potential effect(s) of failure",w:15,type:"long"},{k:"s",label:"Sev",w:3,type:"num",rating:true},{k:"cls",label:"Class",w:4.5,type:"sel",opts:null},
    {k:"fc",label:"Potential cause(s) / mechanism(s) of failure",w:14,type:"long"},{k:"o",label:"Occ",w:3,type:"num",rating:true},
    {k:"pc",label:"Current process controls — prevention",w:13,type:"long"},{k:"dc",label:"Current process controls — detection",w:13,type:"long"},{k:"d",label:"Det",w:3,type:"num",rating:true},{k:"rpn",label:"RPN",w:4,type:"ro",rpn:true},
    {k:"rec",label:"Recommended action(s)",w:15,type:"long"},{k:"resp",label:"Responsibility",w:7},{k:"target",label:"Target completion date",w:7,type:"date"},
    {k:"taken",label:"Actions taken",w:11,type:"long"},{k:"done",label:"Effective date",w:7,type:"date"},{k:"s2",label:"Sev",w:3,type:"num",rating:true},{k:"o2",label:"Occ",w:3,type:"num",rating:true},{k:"d2",label:"Det",w:3,type:"num",rating:true},{k:"rpn2",label:"RPN",w:4,type:"ro",rpn:true}
  ]
};
/* the list of special-characteristic classes is shared with the VDA form */
function aiag4Spec(CLS){ return { groups:AIAG4.groups, cols:AIAG4.cols.map(c=>c.k==="cls"?Object.assign({},c,{opts:CLS}):c) }; }

/* ---------- keep the two editions in step when the format is switched ---------- */
function syncRows(doc, to){
  (doc.rows||[]).forEach(r=>{
    if(to==="aiag4"){ if(!r.rec) r.rec=[r.actPrev,r.actDet].filter(Boolean).join("; "); }
    else if(!r.actPrev && !r.actDet && r.rec){ r.actPrev=r.rec; }
  });
}
/* derived cells (never stored by the user) */
function derive(std, r){
  r.ap = window.PDDocs.AP(r.s,r.o,r.d);
  r.ap2 = (r.o2&&r.d2) ? window.PDDocs.AP(r.s2||r.s,r.o2,r.d2) : "";
  r.rpn = rpn(r.s,r.o,r.d);
  r.rpn2 = (r.o2&&r.d2) ? rpn(r.s2||r.s,r.o2,r.d2) : "";
}

/* ---------- rating guides (summaries) ---------- */
const SEV = {
  vda:[[10,"Safety — may injure the operator or end user; safety-critical function lost"],[9,"Regulatory non-compliance"],[8,"Loss of primary function (your plant: 100 % scrap or shipment stopped)"],[7,"Degraded primary function (your plant: major rework / sorting)"],[6,"Loss of a secondary function"],[5,"Degraded secondary function (your plant: 100 % rework off-line)"],[4,"Appearance, sound, vibration or feel very objectionable"],[3,"Moderately objectionable"],[2,"Slightly objectionable"],[1,"No discernible effect"]],
  aiag4:[[10,"Hazardous — without warning (safety or regulation; may endanger the operator)"],[9,"Hazardous — with warning"],[8,"Very high — major disruption: 100 % of product may be scrapped; item inoperable"],[7,"High — minor disruption: sorting, part of lot scrapped; reduced performance"],[6,"Moderate — part of lot scrapped without sorting; comfort / convenience item inoperable"],[5,"Low — 100 % reworked off-line before processing"],[4,"Very low — sorted, part reworked; fit / finish nonconforming, most customers notice"],[3,"Minor — part reworked on line, out of station; about half of customers notice"],[2,"Very minor — part reworked on line, in station; discerning customers notice"],[1,"None — no discernible effect"]]
};
const OCC = {
  vda:[[10,"Extremely high — no prevention control, or new process without experience"],[9,"Very high — prevention control has almost no effect on the cause"],[8,"High — prevention controls are weak"],[7,"Moderately high — limited prevention; causes are frequent"],[6,"Moderate — some prevention in place; occasional failures"],[5,"Moderate — prevention in place; failures are infrequent"],[4,"Moderately low — prevention is effective; isolated failures"],[3,"Low — prevention controls are highly effective"],[2,"Very low — prevention is best practice, proven"],[1,"Extremely low — the cause cannot occur, or prevention eliminates it"]],
  aiag4:[[10,"Very high — ≥ 100 per 1000 pieces · Ppk < 0.55"],[9,"Very high — 50 per 1000 · Ppk ≥ 0.55"],[8,"High — 20 per 1000 · Ppk ≥ 0.78"],[7,"High — 10 per 1000 · Ppk ≥ 0.86"],[6,"Moderate — 2 per 1000 · Ppk ≥ 0.94"],[5,"Moderate — 0.5 per 1000 · Ppk ≥ 1.00"],[4,"Moderate — 0.1 per 1000 · Ppk ≥ 1.10"],[3,"Low — 0.01 per 1000 · Ppk ≥ 1.20"],[2,"Low — ≤ 0.001 per 1000 · Ppk ≥ 1.30"],[1,"Very low — failure eliminated by preventive control · Ppk ≥ 1.67"]]
};
const DET = {
  vda:[[10,"No detection control, or the failure cannot be detected"],[9,"Very unlikely to detect — detection is not reliable"],[8,"Unlikely — manual check, inconsistent"],[7,"Very low — manual inspection after the operation"],[6,"Low — variable gauging by the operator"],[5,"Moderate — measured with a gauge at the station"],[4,"Moderately high — SPC with reaction plan"],[3,"High — automated detection that stops the process"],[2,"Very high — automated detection in station, part cannot move on"],[1,"Almost certain — the failure cannot occur (error-proofed)"]],
  aiag4:[[10,"Absolute uncertainty — no control, or cannot detect"],[9,"Very remote — indirect or random checks only"],[8,"Remote — visual inspection only"],[7,"Very low — double visual inspection only"],[6,"Low — charting methods such as SPC"],[5,"Moderate — variable gauging after the part left the station, or go / no-go on 100 %"],[4,"Moderately high — error detection in later operations, or gauging at set-up and first piece"],[3,"High — error detection in station, or in later operations with several layers of acceptance"],[2,"Very high — error detection in station with automatic gauging that stops the part"],[1,"Almost certain — the discrepant part cannot be made (error-proofed)"]]
};
function guideHTML(std, limit){
  const tbl=(title,rows)=>`<h4 style="margin:14px 0 6px">${title}</h4><table class="plist" style="width:100%"><tbody>${rows.map(r=>`<tr><td style="width:34px"><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join("")}</tbody></table>`;
  const rule = std==="aiag4"
    ? `<p><b>Risk:</b> RPN = S × O × D (1–1000). <b>Action rule:</b> act on every severity 9–10 whatever the RPN, and on any RPN of <b>${limit||DEFAULT_RPN}</b> or more (the team's limit — set under Admin › Document settings). Reduce severity first, then occurrence, then detection.</p>`
    : `<p><b>Risk:</b> Action Priority H / M / L from the AIAG-VDA table (not a product of the ratings). <b>Action rule:</b> High always needs action; Medium needs action when severity is 7 or more.</p>`;
  return `<p class="hintline"><b>${STD_LONG[std]}</b></p>${rule}${tbl("Severity (S)",SEV[std])}${tbl("Occurrence (O)",OCC[std])}${tbl("Detection (D)",DET[std])}<p class="hintline" style="margin-top:12px">Summary for quick reference. Rate against the full tables of your edition and the customer's requirements.</p>`;
}

window.PDFmea = { STD, STD_LONG, DEFAULT_RPN, rpn, limitOf, needsAction, band, aiag4Spec, syncRows, derive, guideHTML };
})();
