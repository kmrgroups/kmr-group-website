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
mom:[
['ISO','9.3','Management review','Management review meetings are minuted with inputs discussed, decisions and actions with owner and date.'],
['IATF','9.3.1.1','Management review - general','Review meeting records are kept per meeting number, with attendees and the matters discussed.'],
['IATF','9.3.3.1','Management review outputs - supplemental','Decisions and actions from the review are recorded as points with an owner and target date and tracked in the Action tracker.'],
['ISO','5.3','Organizational roles, responsibilities and authorities','Every action names who is responsible and the target date.'],
['ISO','7.4','Communication','Minutes are distributed to the listed people, in the meeting language or translated.'],
['ISO','7.5.3','Control of documented information','Finalised minutes are locked; changes need an authorised re-open and are recorded; printable copy available.'],
['IATF','7.5.3.2.1','Record retention','Minutes and their points are stored with the meeting number and date, with JSON export and daily backup.'],
['ISO','10.2','Nonconformity and corrective action','Corrective actions raised in meetings carry owner, due date and status until Done.'],
['IATF','10.2.3','Problem solving','Problem discussions are captured as points typed as Risk / concern or Action, each with an owner, target date and status, and followed up until Done.'],
['APQP','Phase 1','Plan and define - team organisation and responsibilities','CFT meetings record team decisions and open items across the project phases.'],
['F4','Recommended actions','Responsibility and target completion date (FMEA 4th ed.)','FMEA review meeting actions have responsibility and target date.'],
['VF','Step 6','Optimization (AIAG-VDA FMEA)','FMEA and Control Plan review meetings record optimisation actions with responsible person and target date.'],
['VDA','P2','Project management','Project review meetings are minuted with decisions, owners and dates.']],
cad:[
['ISO','7.1.5','Monitoring and measuring resources','Drawing aids work as in standard CAD: object snap, polar and object-snap tracking, adaptive grid and snap step for very small parts, one-time snap overrides in the right-click menu. Dimensions picked from the drawing are exact, so inspection values are not re-typed.'],
['ISO','7.5.2','Layers, colour, linetype and lineweight','Colour palette, linetypes (hidden, centre, dashed ...) and lineweights display as they plot, so drawings follow the company drawing standard.'],
['ISO','7.5.2','Creating and updating documented information','Every drawing has a number, title, revision, part number, customer, units and a title block with drawn / checked / approved names and date.','reg'],
['ISO','7.5.3','Control of documented information','Status Draft → In review → Released; a released drawing is locked and can only change through a new revision. Earlier revisions are kept as superseded and cannot be edited.','rel'],
['IATF','7.5.3.2.1','Record retention','Every revision is stored with its history (who, when, change note); JSON export of all drawings and the platform daily backup.','rev'],
['IATF','7.5.3.2.2','Engineering specifications','Customer drawings can be imported from DXF and kept by revision; the change note records the customer change (ECN) and its date.'],
['ISO','8.3.5','Design and development outputs','Drawings state dimensions, tolerances, material, general tolerance and notes needed to make and check the product.'],
['IATF','8.3.5.1','Design and development outputs - supplemental','2D drawings with dimensions and tolerances are produced and released as the product definition.'],
['ISO','8.3.6','Design and development changes','Changes are made in a new revision with a change note; review and release are recorded with the name and date.'],
['IATF','8.3.6.1','Design and development changes - supplemental','Revision history shows each change and its approval before the new revision is used.'],
['ISO','8.5.6','Control of changes','The register always shows the latest revision; superseded revisions stay visible for the record only.'],
['IATF','8.2.3.1.2','Customer-designated special characteristics','Special characteristic symbols and notes can be placed on the drawing (symbol library and text).'],
['APQP','Phase 2','Product design and development - engineering drawings','Engineering drawings (including math data exported as DXF) are prepared and released in the APQP design phase.'],
['PPAP','Element 1','Design records','The released drawing (PDF print or DXF) is the design record for the PPAP submission.'],
['PPAP','Element 2','Authorized engineering change documents','The change notes of each revision document the engineering changes not yet on the design record.'],
['CP','Product characteristics','Control Plan characteristics','Dimensions on the released drawing are the product characteristics that the Control Plan and the Balloon Inspector use.'],
['VF','Step 2','Structure analysis (AIAG-VDA FMEA)','The drawing defines the product elements and characteristics that the FMEA structure and function analysis start from.'],
['ISO','7.5.3.2','Distribution, access, retrieval and use','Sheets (layouts) print to PDF at true scale with the title block showing number and revision; several drawings print together for distribution; layers marked not-to-plot stay off the print.'],
['ISO','7.5.3.2','Control of changes - references','A drawing that references another (XATTACH) always shows the latest released revision of that drawing and reports when it changed; references cannot be edited by mistake.'],
['APQP','Phase 2','Design records for part families','Parametric constraints with formulas, dynamic blocks and associative arrays keep sizes of a part family and standard details consistent from one source.'],
['IATF','8.3.3.3','Special characteristics','Special characteristics are identified on the drawing with symbols, balloons, notes and GD&T feature control frames (ISO 1101 / ASME Y14.5).'],
['PPAP','Element 9','Dimensional results','Balloons and the parts list number every characteristic so the dimensional report (Balloon Inspector) refers to the same items.'],
['SPC','Specification limits','Capability against the specification','Dimension tolerances (±, deviation, limits) give the upper and lower specification limits used for Cp / Cpk.'],
['MSA','Gage R&R - % tolerance','Measurement system acceptability','The drawing tolerance is the basis for the % tolerance of a Gage R&R study.'],
['VDA','P3','Planning of product and process development','Product drawings and their release status are available for the development plan and audit.'],
['IATF','8.3.5.1','Design outputs - 3D math data','3D solids (made here or imported from STEP) are kept with the drawing revision; front, top, side and isometric views with hidden lines are generated from the model (first or third angle) and updated when the model changes, so 2D and 3D stay the same.'],
['APQP','Phase 2','Product design - math data and prototypes','The 3D model exports as STL for prototypes and 3D printing and as 3D faces in DXF; volume and mass of each solid support the design review.'],
['IATF','7.5.3.2.2','Engineering specifications - customer files','Customer DWG drawings open directly (converted to DXF on the computer, no upload) and STEP models import, so the customer revision can be checked against ours.'],
['IATF','8.5.1.2','Standardised work - visual aids for operators','Stage drawings: one sheet per operation from the dimensions frozen in Process Documents. This operation\'s dimensions and balloons are red, earlier operations\' grey, later ones left out; the table lists limits, class and gauge. They are sent to the SOP of that operation.'],
['IATF','8.5.1.2','Standardised work - process-stage flow drawings','One sheet per operation, never a second page: raw material (bar with its data and inspection requirements), sawing (blank, vice, length stop, datum B, no hidden lines), CNC turning 1 and 2 as full-section views (chuck or soft jaws with the stop face as datum B, G54 work zero, phantom lines for the stock removed), then machining as an external view with hidden edges dashed and an end view (hex / hole pattern). The part outline comes from the customer drawing, so it fits every new project. Each sheet has stage data, the characteristics made there with their balloons, a legend and notes.'],
['IATF','8.5.1.2','Standardised work - visual aids: colour and line rules','Red = surface cut at this operation, dark grey = not cut here, dashed = hidden, blue = chuck / vice / stop, phantom = stock removed. Diameters, lengths, chamfers, angles, radii, threads, surface finish and GD&T of the frozen table are all drawn; anything that cannot be tied to one feature is written under the sketch with its balloon.'],
['ISO','7.5.2','Documented information - dimensioning practice (ISO 129-1 / ASME Y14.5)','Dimension lines outside the part with extension lines, shortest nearest the part, bore sizes inside the void, leaders with a shoulder, reference sizes in brackets, GD&T in feature control frames and datum symbols; arrows, text and balloons are sized from one text height so they stay readable at any scale.'],
['IATF','7.5.3.2.1','Customer engineering specifications - stage drawing from the customer drawing','The stage drawing of each operation is made on the customer\'s own ballooned drawing (a CAD PDF, DXF or DWG is read exactly, so the part keeps its true shape and dimension text): every dimension made at the operation is marked with the same balloon number as Balloon Inspector, the others are grey, and the table of those dimensions sits beside it.'],
['IATF','7.5.3.2.2','Engineering specifications - PDF and picture drawings','A customer drawing sent as PDF or as a scan or photo is converted to editable CAD on upload (vector PDF exactly, pictures traced and straightened), so it can be checked, measured and used for the stage drawings. Check one dimension after converting a picture.'],
['ISO','7.5.2','Documented information - readable working screen','Full-screen drawing workspace with a clear title block (every field fitted to its cell) so the drawing number, revision, names and dates are legible on screen and in print.'],
['ISO','8.5.6','Control of changes - stage drawings','Stage drawings are made only from the dimensions frozen right now (the freeze revision is in the title block). When Process Documents is frozen again, the SOP marks the old stage drawings out of date until they are made again.'],
['CP','Characteristics by operation','Control Plan and SOP link','Each stage drawing draws every characteristic the Control Plan and SOP check at that operation, with the same balloon numbers, limits and gauges as Balloon Inspector. A size that exists only during the process (a drilled diameter before reaming, a groove width before the final cut) is drawn on the nearest feature of that operation\'s working area as a thin phantom line, marked with its own value.'],
['PPAP','CNC program and machining simulation','Process design (APQP phase 3), IATF 16949 8.5.1.1 / 8.5.1.2','The CNC program is generated from the same stage drawing the SOP uses, so tools, sizes and clamping match the Control Plan. The simulation shows material removal against the required shape and checks the controlled diameters; it is a draft program that must be proven on the machine and approved before production.'],
['CP','Tool holder, insert and tool-life prediction','IATF 16949 8.5.1.5 (tooling management), Control Plan, APQP phase 3','The simulation shows the real tool, insert corner and holder in cut at true size and predicts tool life per edge and per tool from the cutting data (Taylor equation, flank wear limit 0.3 mm). The result gives the tool-change frequency for the Control Plan and the SOP. The constants are typical values and must be calibrated with the plant\'s own tool-life records.'],
['CP','Standard tools and close-tolerance holes (drill, bore, ream)','IATF 16949 8.5.1.5 (tooling), Control Plan, ISO 286 (IT grades), ISO 2768','Every hole diameter in the CNC program is checked against the tolerance on the drawing (or ISO 2768-m if none is given): loose tolerances are drilled, medium ones drilled and bored, close ones drilled undersize and finished with a reamer. Each tool is marked standard (catalogue drill, reamer, insert, boring bar, ISO thread pitch) or CUSTOM (special size, or a pocket behind a narrower neck) so tooling can order or design it before the run. The program is a draft that must be proven on the machine.'],
['PPAP','Dimension check of every stage-drawing dimension in the simulation','Control Plan, PPAP dimensional results (element 9), IATF 16949 8.5.1.1, AIAG-VDA / FMEA (special characteristics)','Every dimension of the stage drawing (diameters, lengths, radii, angles, chamfers, threads, surface finish) is drawn on the part and checked in the simulation: measured on the simulated part, reached by position, or marked for inspection (form and position tolerances). Surface finish is estimated from feed and nose radius. This does not replace the first-article inspection on the real part.'],
['APQP','Phase 3','Process design - operator instructions','Stage drawings are part of the process instructions prepared in process design and development, and can be kept in the drawing register by revision.'],
['VDA','P3','Process development - work holding and datums','Each turning and sawing sheet shows how the part is held (jaws, vice, length stop), the axial datum B and the program zero, so set-up and first-piece checks use the same reference as the Control Plan.'],
['MSA','Gage selection','Gauge for each characteristic','The characteristic table of each sheet lists the gauge from the SOP next to the limits, so the measuring method is chosen for the tolerance shown.']],
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
['VDA','P4 / P5','Realisation of process development; production','Process documents support audit questions on process control.'],
['IATF','8.3.5.2','Manufacturing process design output - characteristics by operation','Dimensions are frozen per operation (revision, date, by, reason) once every characteristic has an operation. A later change to the route, an operation\'s characteristics or a specification shows as changed after freeze until frozen again.'],
['IATF','8.5.1.2','Standardized work - visual aids','Each SOP operation shows and prints its stage drawing made in KMR CAD Draft from the frozen dimensions; a stage drawing made from an older freeze is flagged out of date. The drawings follow the route (raw material, sawing blank, turning with clamping area, datum and tool path, later operations).'],
['ISO','7.5.3 / 8.5.6','Documented information; control of changes','The freeze history keeps every revision with its reason, and each stage drawing records the freeze revision it was made from.'],
['APQP','Phase 3','Process design - released process route','The frozen operation-wise list of characteristics is the released input for the SOP, the Control Plan and the stage drawings.']],
balloon:[
['PPAP','Element 9','Dimensional results','Ballooned drawing and inspection results list every dimension.'],
['PPAP','Element 1','Design records','The drawing is the reference for every ballooned characteristic.'],
['IATF','8.2.3.1.2','Customer-designated special characteristics','Key/critical characteristics are flagged on the drawing.'],
['IATF','8.6.2','Layout inspection and functional testing','Inspection report is prepared from the ballooned dimensions.'],
['ISO','8.2.2 / 8.2.3','Determining and reviewing requirements','Drawing requirements are listed for review before manufacture.'],
['MSA','Gauge selection (10:1 rule)','Measurement system suitability','Each dimension is given the best master gauge automatically: right type and range, least count within 10 % of the tolerance, most economical first. If no master gauge suits, a suitable new gauge is allotted and marked to purchase; the choice can be changed by hand.'],
['IATF','7.1.5.1.1','Measurement systems analysis','The gauge chosen here follows into the Control Plan, SOP and stage drawings, so the same gauge is named everywhere.']],
ops:[
['ISO','7.1.3 / 7.1.5','Infrastructure; monitoring and measuring resources','Machines and gauges are listed in one master.'],
['ISO','7.5.2 / 7.5.3','Documented information','Parts, BOM, routing and tools are controlled in one place.'],
['ISO','8.4.1','Externally provided products and services','Customers, suppliers and raw materials are kept as masters.'],
['IATF','8.5.1.6','Management of production tooling','Tool details such as life, edges and resharpening are recorded.'],
['IATF','8.4.2.4','Supplier monitoring','Supplier master supports monitoring and selection.'],
['IATF','9.1.1.1','Monitoring of manufacturing processes','Loss and process codes are maintained.'],
['APQP','Team and master data','Process definition','Part, process and machine masters support planning.'],
['ISO','7.2 / 7.3','Competence and awareness','Every screen of every app shows a short guide after each completed field (what to look at next); it can be switched off once the user knows the screens.']]
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
