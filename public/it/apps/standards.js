/* Standards alignment - shared by every KMR app. KMRStd.draw(el, appKey, opts)
   Shows only the standards and clauses that are relevant to the app.
   The auditor decides compliance; check clause wording against your copy of each standard. */
(function(){
var CAT={
 IATF:['IATF 16949:2016','Automotive QMS'],
 ISO:['ISO 9001:2015','Quality management systems'],
 CP:['AIAG Control Plan (1st ed.)','Control Plan'],
 VF:['AIAG-VDA FMEA (1st ed. 2019)','Seven-step FMEA, Action Priority'],
 F4:['AIAG FMEA 4th ed.','FMEA with RPN'],
 VDA:['VDA 6.3 (2016)','Process audit'],
 APQP:['AIAG APQP (2nd ed.)','Advanced product quality planning'],
 PPAP:['AIAG PPAP (4th ed.)','Production part approval'],
 MSA:['AIAG MSA (4th ed.)','Measurement systems analysis'],
 SPC:['AIAG SPC (2nd ed.)','Statistical process control']
};
var A={
sales:[
['ISO','8.2.1 / 8.2.3','Customer communication and review of requirements','Each customer and plant keeps its parts, price and monthly demand, so what was agreed is on record.'],
['ISO','8.1','Operational planning and control','The monthly sales plan is set part by part, with the daily plan and the despatch against it.'],
['IATF','8.2.3.1.3','Organizational manufacturing feasibility','Plan against demand is checked before it is accepted; over-plan and unplanned quantity are flagged.'],
['ISO','9.1.2','Customer satisfaction - monitoring','Dispatch against plan is tracked every day, per part and per customer.'],
['IATF','9.1.2.1','Customer satisfaction: delivery performance','Plan vs actual, pending and over-dispatched quantity show delivery performance on the dashboard.'],
['ISO','9.1.3','Analysis and evaluation','The sales analysis panel and dashboards give trends by customer, plant and part.'],
['ISO','10.2','Nonconformity and corrective action','Loss reasons and short-dispatch actions are recorded against the plan.'],
['IATF','10.2.3','Problem solving','Short-dispatch causes and the action taken are captured for follow-up.'],
['VDA','P7','Customer care / customer satisfaction / service','Delivery status and unplanned demand are visible to review with the customer.']],
calibration:[
['ISO','7.1.5.1','Monitoring and measuring resources','Every instrument is registered with calibration status, due date and certificate data.','reg'],
['ISO','7.1.5.2','Measurement traceability','Calibration records keep lab, accreditation (e.g. NABL) and certificate number; status is visible on each gauge card.','cert'],
['IATF','7.1.5.2.1','Calibration/verification records and out-of-calibration assessment','As-found results are recorded; an out-of-tolerance as-found opens a case to assess affected product and customer notification.','oot'],
['IATF','7.1.5.3.1 / 7.1.5.3.2','Internal and external laboratory requirements','Internal / external source and accreditation are recorded for every calibration.','lab'],
['IATF','7.1.5.1.1','Measurement systems analysis','Gage R&R studies with %GRR, %tolerance, distinct categories and a decision per study.','msa'],
['MSA','Gage R&R (average and range)','Repeatability and reproducibility study','Operators x parts x trials entered on screen; %GRR, %tolerance and ndc are calculated. Bias, linearity and stability studies are planned.','msa'],
['PPAP','Element 12 and 15','Qualified laboratory documentation; measurement system analysis studies','Lab accreditation and MSA results can be shown as PPAP evidence.','msa'],
['VDA','P6','Process / service - resources (test equipment)','Status, history card and audit evidence can be shown on screen or printed per gauge.','rec']],
apqp:[
['APQP','Phases 1-5','Plan and define; product design; process design; product and process validation; feedback and corrective action','The program is tracked phase by phase with deliverables, owners and dates.'],
['APQP','Phase 3 outputs','Process flow, PFMEA, Control Plan, MSA plan','Deliverables link to the Process Documents app where the PFD, PFMEA and Control Plan are made.'],
['APQP','Cross-functional team','Team organisation','Owners are assigned per deliverable and review status is on one report.'],
['IATF','8.3.2','Design and development planning','Program plan with stages, responsibilities and timing.'],
['IATF','8.3.4 / 8.3.4.4','Design and development controls; product approval process','Gate status per phase and the link to PPAP approval.'],
['ISO','8.3.2 / 8.3.4','Planning and controls of design and development','Stages, reviews and verification/validation points are recorded.'],
['VDA','P2 / P3 / P4','Project management; planning of product and process development; realisation','Phase status and deliverables give the audit trail from nomination to series.']],
ppap:[
['PPAP','18 elements','Design records to Part Submission Warrant','Each submission lists the 18 elements with status and the evidence file/reference.'],
['PPAP','Submission levels 1-5','Level of evidence submitted to the customer','The level is chosen per submission and the required elements follow it.'],
['PPAP','Part Submission Warrant (PSW)','Warrant and customer decision','The PSW is produced from the submission and the customer decision is recorded.'],
['IATF','8.3.4.4','Product approval process','Production part approval is tracked per part and customer.'],
['ISO','8.6','Release of products and services','Approval status shows what has been released to the customer.'],
['APQP','Phase 4','Product and process validation','PPAP submission closes the validation phase.'],
['VDA','P4','Product and process development realisation','Approval records show readiness before series.']],
rmp:[
['ISO','8.1','Operational planning and control','Raw-material requirement is calculated from the sales plan and BOM.'],
['ISO','8.4.1 / 8.4.3','Control of externally provided processes, products and services','Orders are placed against the plan with supplier, quantity and due date.'],
['IATF','8.4.2.4','Supplier monitoring','Order status and on-time receipt are visible per supplier.'],
['IATF','8.5.4.1','Preservation (stock rotation)','Stock and orders are tracked so older stock is used first.'],
['IATF','6.1.2.3','Contingency plans','Shortage against demand is shown early so action can be planned.']],
mmd:[
['ISO','8.5.2','Identification and traceability','Material, WIP and outsourced lots are tracked with their identification.'],
['IATF','8.5.2.1','Identification and traceability (supplemental)','Receipt, issue and WIP records allow tracing a lot through the process.'],
['ISO','8.4','Externally provided processes','Supplier delivery challans and goods receipt are recorded.'],
['ISO','8.7','Control of nonconforming outputs','Rejection and rework quantities are recorded by reason.'],
['IATF','8.7.1','Control of nonconforming product','Loss and rejection codes support segregation and disposition records.'],
['IATF','9.1.1.1','Monitoring and measurement of manufacturing processes','Loss codes and WIP give process yield and loss by stage.'],
['VDA','P6','Process / service','Material flow, handling and nonconforming product are shown on screen.']],
mnt:[
['IATF','8.5.1.5','Total productive maintenance','Breakdowns, preventive maintenance plan, MTBF and MTTR are tracked.'],
['ISO','7.1.3','Infrastructure','Machine history cards show the condition and upkeep of equipment.'],
['IATF','7.1.3.1','Plant, facility and equipment planning','Maintenance plan against machine list and schedule.'],
['ISO','10.2','Nonconformity and corrective action','Breakdown cause and corrective action are recorded and analysed.'],
['VDA','P6','Process / service - resources','Machine availability and upkeep records support the audit.']],
capacity:[
['IATF','7.1.3.1','Plant, facility and equipment planning','Machine capacity is planned against demand.'],
['IATF','8.2.3.1.3','Organizational manufacturing feasibility','Load against capacity shows whether the demand can be met.'],
['ISO','8.1','Operational planning and control','Capacity and loading are planned before orders are accepted.'],
['VDA','P3','Planning of product and process development','Cycle time and machine data feed the feasibility of new parts.']],
pd:[
['CP','Control Plan (prototype, pre-launch, production)','Control Plan content','Control Plan is generated from the process flow and FMEA.'],
['VF','7 steps; Action Priority (AP)','Process FMEA','PFMEA with severity, occurrence, detection and Action Priority.'],
['F4','RPN method','Process FMEA','PFMEA with RPN is available where the customer still asks for the 4th edition.'],
['SPC','Charts; Cp / Cpk / Ppk','Statistical process control','Control charts and capability indices are calculated from entered readings.'],
['MSA','Gage R&R','Measurement systems analysis','Gauge studies are included in the document set.'],
['APQP','Phase 3','Process design and development','Process flow, PFMEA, Control Plan and instructions form the phase outputs.'],
['PPAP','Elements 5-9','Process flow, PFMEA, Control Plan, MSA, dimensional results','The generated documents serve as submission evidence.'],
['IATF','8.5.1.1 / 8.5.1.2 / 8.5.1.3','Control Plan; standardized work; set-up verification','Control Plan, work instructions and set-up approval documents.'],
['IATF','8.3.3.3 / 8.3.5.2','Special characteristics; manufacturing process design output','Special characteristics carry through PFMEA to Control Plan.'],
['IATF','9.1.1.2 / 10.2.4','Statistical tools; error-proofing','SPC and poka-yoke documents are included.'],
['ISO','8.5.1 / 8.6','Control of production; release','Process documents define the controlled conditions and checks.'],
['VDA','P4 / P5','Realisation of process development; production','Process documents support audit questions on process control.']],
balloon:[
['PPAP','Element 9','Dimensional results','Ballooned drawing and inspection results list every dimension.'],
['PPAP','Element 1','Design records','The drawing is the reference for every ballooned characteristic.'],
['IATF','8.2.3.1.2','Customer-designated special characteristics','Key/critical characteristics are flagged on the drawing.'],
['IATF','8.6.2','Layout inspection and functional testing','Inspection report is prepared from the ballooned dimensions.'],
['ISO','8.2.2 / 8.2.3','Determining and reviewing requirements','Drawing requirements are listed for review before manufacture.']],
ops:[
['ISO','7.1.3 / 7.1.5','Infrastructure; monitoring and measuring resources','Machines and gauges are listed in one master.'],
['ISO','7.5.2 / 7.5.3','Documented information','Parts, BOM, routing and tools are controlled in one place.'],
['ISO','8.4.1','Externally provided products and services','Customers, suppliers and raw materials are kept as masters.'],
['IATF','8.5.1.6','Management of production tooling','Tool details such as life, edges and resharpening are recorded.'],
['IATF','8.4.2.4','Supplier monitoring','Supplier master supports monitoring and selection.'],
['IATF','9.1.1.1','Monitoring of manufacturing processes','Loss and process codes are maintained.'],
['APQP','Team and master data','Process definition','Part, process and machine masters support planning.']]
};
var CSS='.kstd table{width:100%;border-collapse:collapse}.kstd th,.kstd td{padding:8px 10px;border-bottom:1px solid var(--line,#e2e6ea);text-align:left;vertical-align:top;font-size:13px}.kstd th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut,#667)}.kstd .ch{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.kstd .ch button{border:1px solid var(--line,#cfd6dd);background:transparent;color:inherit;border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer}.kstd .ch button.on{background:#0b6b4b;color:#fff;border-color:#0b6b4b}.kstd .mut{color:var(--mut,#667);font-size:13px}@media print{.kstd .ch button:not(.on){display:none}.kstd .noprint{display:none}}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function draw(el,key,o){
 o=o||{};var rows=A[key]||[];if(!el)return;
 if(!document.getElementById('kstd-css')){var s=document.createElement('style');s.id='kstd-css';s.textContent=CSS;document.head.appendChild(s)}
 var ev=o.evidence||null,sel=el._kstd||'';
 var cnt={};rows.forEach(function(r){cnt[r[0]]=(cnt[r[0]]||0)+1});
 var order=Object.keys(CAT).filter(function(k){return cnt[k]});
 var list=rows.filter(function(r){return!sel||r[0]===sel});
 var chips='<button data-k=""'+(sel?'':' class="on"')+'>All ('+rows.length+')</button>'+order.map(function(k){return'<button data-k="'+k+'"'+(sel===k?' class="on"':'')+'>'+esc(CAT[k][0])+' ('+cnt[k]+')</button>'}).join('');
 var hasEv=!!ev&&list.some(function(r){return r[4]&&ev[r[4]]});
 var h='<div class="kstd"><div class="row noprint" style="display:flex;gap:8px;flex-wrap:wrap">'+(o.actions||'')+'<button class="btn o" onclick="window.print()">Print this page</button></div>'
 +'<h2 style="margin:12px 0 4px;font-size:18px">Standards alignment</h2><p class="mut">This app covers '+rows.length+' requirements from '+order.length+' standard'+(order.length>1?'s':'')+': '+order.map(function(k){return esc(CAT[k][0])}).join(', ')+'. Only the standards and clauses relevant to this app are shown. The auditor decides compliance; clause wording should be checked against your copy of each standard.</p>'
 +'<div class="ch noprint">'+chips+'</div><div style="overflow:auto"><table><thead><tr><th>S.No</th><th>Standard</th><th>Clause / element</th><th>Requirement</th><th>How the app meets it</th>'+(hasEv?'<th>Live evidence</th>':'')+'</tr></thead><tbody>'
 +list.map(function(r,i){var e='';if(hasEv){var f=r[4]&&ev[r[4]];var v='';try{v=f?f():''}catch(x){}e='<td><b>'+esc(v)+'</b></td>'}
  return'<tr><td>'+(i+1)+'</td><td>'+esc(CAT[r[0]][0])+'</td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td><td>'+esc(r[3])+'</td>'+e+'</tr>'}).join('')+'</tbody></table></div></div>';
 el.innerHTML=h;
 el.querySelectorAll('.ch button').forEach(function(b){b.onclick=function(){el._kstd=b.dataset.k;draw(el,key,o)}});
}
window.KMRStd={draw:draw,rows:function(k){return A[k]||[]},cat:CAT};
})();
