/* =====================================================================
   Process Documents – PDF (jsPDF + AutoTable) and Excel (ExcelJS) export.
   Every document is first described as format-neutral "blocks", then
   rendered to PDF or Excel with the company logo and a consistent layout.
   ===================================================================== */
(function(){
"use strict";
const D=window.PDDocs, SC=window.PDSchema, CH=window.PDCharts, UI=window.PDUI;
const A=()=>window.PDApp;
const fmtN=UI.fmtN;
const EXCELJS="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";

/* ---------------- text safety for the standard PDF font ---------------- */
const MAP={"−":"-","–":"-","—":"-","‘":"'","’":"'","“":'"',"”":'"',"…":"...","≤":"<=","≥":">=","→":"->","•":"-","·":"·","⌖":"Pos.","◆":"(CC)","▼":"(SC)","◇":"(KC)","▽":"","○":"","◉":"","□":"","⇨":"","′":"'","″":'"',"₂":"2","≈":"~","√":"sqrt","∅":"Ø","⌀":"Ø","Φ":"Ø","↗":"","⊥":"","∥":"","⏥":"","◎":"","⌭":"","⌒":"","⌓":"","⌰":"","∠":""};
function T(s){ if(s==null) return ""; let t=String(s).replace(/X̄/g,"X-bar").replace(/X̿/g,"X-dbar").replace(/R̄/g,"R-bar"); t=t.replace(/[−–—‘’“”…≤≥→•⌖◆▼◇▽○◉□⇨′″₂≈√∅⌀Φ↗⊥∥⏥◎⌭⌒⌓⌰∠]/g,c=>MAP[c]??""); return t.replace(/[^\n\x20-\x7E -ÿ]/g,""); }
const val=(c,v)=>{ if(v==null||v==="") return ""; if(c.type==="date") return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.split("-").reverse().join("-"):v; if(c.type==="sel"&&c.opts&&Array.isArray(c.opts[0])){ const f=c.opts.find(x=>x[0]===v); return f?f[1].replace(/\s*[○◉□⇨▽D]$/,""):v; } if(typeof v==="number") return fmtN(v,4); return String(v); };

/* ======================================================================
   BLOCKS
   ====================================================================== */
const dmy=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?String(v).split("-").reverse().join("-"):v;
function infoFor(id){ const h=A().S.plan.header; return (UI.INFO[id]||UI.INFO._).map(k=>[UI.HL[k]||k, k==="phase"?(h.phase||"Production"):dmy(h[k]??"")]); }
function tableBlock(cols, rows, groups, extra={}){
  const colsX = cols;
  return Object.assign({kind:"table", cols:colsX.map(c=>({label:c.label,w:c.w||8,k:c.k,flow:!!c.flow,ap:!!c.ap,read:c.type==="read",cls:c.k==="cls"})), groups,
    rows: rows.map(r=>colsX.map(c=>{ const v=r[c.k]; const cell={v:val(c,v)}; if(c.flow) cell.sym=v;
      if(c.ap&&v) cell.ap=v; if(c.type==="read"&&v!==""&&v!=null){ const j=D.judge(v,numN(r.lsl),numN(r.usl)); if(j==="ng") cell.ng=true; }
      if(c.k==="result"&&v==="NG") cell.ng=true; if(c.k==="result"&&v==="OK") cell.ok=true; if(c.k==="cls"&&v) cell.bold=true; return cell; })) }, extra);
}
const numN=v=>v===""||v==null||isNaN(+v)?null:+v;
function expand(cols, slots){ const out=[]; cols.forEach(c=>{ if(c.slots) (slots||[]).forEach((s,i)=>out.push({k:c.slots+(i+1),label:s,w:5.2,type:"read"})); else out.push(c); }); return out; }
function kv(pairs, cols=4){ return {kind:"kv", pairs:pairs.map(p=>[p[0],p[1]==null?"":String(p[1])]), cols}; }

function blocksFor(id){
  const S=A().S, doc=S.docs[id], spec=SC.specFor(id,doc), B=[];
  switch(id){
    case "pfd": case "pfmea": case "cp": case "sc": case "gauges": case "tools": case "pokayoke": case "machines": {
      const rows=doc.rows.map(r=>{ const x=Object.assign({},r); if(id==="pfmea"){ window.PDFmea.derive(doc.std||"vda",x); } return x; });
      B.push(tableBlock(spec.cols, rows, spec.groups)); break; }
    case "pdi": { const m=doc.meta||{}; B.push(kv([["Date",m.date],["Invoice / DC no.",m.invoice],["Lot quantity",m.lotQty],["Sample quantity",m.sampleQty],["Inspector",m.inspector],["Lot decision",m.decision]],6));
      B.push(tableBlock(spec.cols, doc.rows.map(r=>Object.assign({},r,{result:UI.rowResult(r,"s",5)})))); break; }
    case "setup": case "patrol": case "self": {
      const cols=expand(spec.cols, doc.slots);
      doc.sections.forEach((s,i)=>{ B.push({kind:"section", title:`Op ${s.opNo} – ${s.opName}${s.machine?"   |   Machine: "+s.machine:""}`, newPage:i>0});
        const m=s.meta||{}; const f=id==="setup"?[["Date",m.date],["Shift",m.shift],["Operator",m.operator],["Setter",m.setter],["QA inspector",m.inspector],["Reason",m.reason],["Decision",m.decision]]:[["Date",m.date],["Shift",m.shift],[id==="patrol"?"Patrol inspector":"Operator",id==="patrol"?m.inspector:m.operator]];
        B.push(kv(f, f.length>4?7:3));
        B.push(tableBlock(cols, s.rows.map(r=>id==="setup"?Object.assign({},r,{result:UI.rowResult(r,"r",5)}):r)));
        if(id==="setup"&&s.params&&s.params.length){ B.push({kind:"label",text:"Process parameter verification"}); B.push(tableBlock(spec.params, s.params)); } });
      if(!doc.sections.length) B.push({kind:"text",text:"No machining operation with characteristics."}); break; }
    case "sop": {
      doc.sections.forEach((s,i)=>{ B.push({kind:"section", title:`Op ${s.opNo} – ${s.opName}`, newPage:i>0});
        B.push(kv([["Operation",`${s.opNo} – ${s.opName}`],["Machine / equipment",s.machine||""],["SOP no.",s.docNo||(doc.docNo+"/"+s.opNo)]],3));
        B.push({kind:"image", src:s.img||""}); B.push({kind:"boxes", items:[["Tools",s.tools],["Gauges / instruments",s.gauges],["Consumables",s.consumables],["Personal protective equipment",s.ppe]]});
        B.push({kind:"label",text:"Work sequence"}); B.push(tableBlock([{k:"no",label:"Step",w:3},{k:"step",label:"Work step",w:22},{k:"key",label:"Key point / reason",w:16}], s.steps));
        if(s.checks.length){ B.push({kind:"label",text:"Quality checks at this operation"}); B.push(tableBlock([{k:"charNo",label:"Balloon",w:4},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:13},{k:"cls",label:"Class",w:4},{k:"gauge",label:"Gauge",w:14},{k:"freq",label:"Frequency",w:8}], s.checks)); }
        if(s.params.length){ B.push({kind:"label",text:"Process parameters"}); B.push(tableBlock([{k:"name",label:"Parameter",w:12},{k:"spec",label:"Specification",w:20},{k:"freq",label:"Check frequency",w:10}], s.params)); }
        B.push({kind:"boxes", items:[["Safety precautions",s.safety],["Reaction plan",s.reaction]]}); });
      break; }
    case "spc": {
      doc.studies.forEach((st,i)=>{ const x=D.spcStats(st); B.push({kind:"section", title:`Balloon #${st.charNo} – ${st.char}  ${st.spec}${st.cls?"  ("+st.cls+")":""}`, newPage:i>0});
        if(st.simulated) B.push({kind:"sim"});
        B.push(kv([["Characteristic",st.char],["Specification",st.spec],["LSL",fmtN(st.lsl)],["USL",fmtN(st.usl)],["Subgroup size n",st.n],["Subgroups k",x.ok?x.k:st.k],["Gauge",st.gauge],["Operation / machine",[st.op,st.machine].filter(Boolean).join(" · ")],["Study type",st.studyType||""],["Study period",st.period||""]],5));
        B.push(kv([["Cp",fmtN(x.cp,2)],["Cpk",fmtN(x.cpk,2)],["Pp",fmtN(x.pp,2)],["Ppk",fmtN(x.ppk,2)],["X-dbar",fmtN(x.X)],["R-bar",fmtN(x.Rb)],["Sigma within",fmtN(x.sw,5)],["Sigma overall",fmtN(x.s,5)],["UCL / LCL (X-bar)",x.ok?fmtN(x.uclx)+" / "+fmtN(x.lclx):"—"],["UCL / LCL (R)",x.ok?fmtN(x.uclr)+" / "+fmtN(x.lclr):"—"],["Readings (N)",x.ok?x.N:0],["Out of specification",x.ok?x.outSpec:"—"]],6));
        B.push({kind:"verdict", text:x.ok?`${x.verdict}${x.stable?" · Process in statistical control":" · Out-of-control signals: X-bar "+(x.oocX.join(", ")||"none")+", R "+(x.oocR.join(", ")||"none")+(x.runs.length?", run of 7 at "+x.runs.join(", "):"")}`:"Readings not entered yet.", tone:!x.ok?"warn":x.cpk>=1.67?"ok":x.cpk>=1.33?"warn":"ng"});
        B.push({kind:"chart", model:CH.xbarR(x,st)}); B.push({kind:"chart", model:CH.hist(x,st)});
        const n=st.n||5; const rows=(st.data||[]).map((g,j)=>{ const o={sg:j+1}; g.forEach((v,q)=>o["x"+(q+1)]=v==null?"":v); const vs=g.filter(v=>v!=null&&v!==""); if(vs.length===n){ o.xb=fmtN(vs.reduce((a,b)=>a+ +b,0)/n); o.r=fmtN(Math.max(...vs)-Math.min(...vs)); } return o; });
        B.push({kind:"label",text:"Readings"}); B.push(tableBlock([{k:"sg",label:"Subgroup",w:5}].concat(Array.from({length:n},(_,q)=>({k:"x"+(q+1),label:"X"+(q+1),w:6,type:"read"}))).concat([{k:"xb",label:"X-bar",w:6},{k:"r",label:"R",w:6}]), rows.map(r=>Object.assign(r,{lsl:st.lsl,usl:st.usl})))); });
      if(!doc.studies.length) B.push({kind:"text",text:"No SPC study defined."}); break; }
    case "msa": {
      doc.studies.forEach((st,i)=>{ const m=D.msaStats(st); B.push({kind:"section", title:`${st.gaugeId} – ${st.gauge}  (Gauge R&R, Average & Range method)`, newPage:i>0});
        if(st.simulated) B.push({kind:"sim"});
        B.push(kv([["Gauge",st.gauge],["Gauge ID",st.gaugeId],["Range",st.range],["Least count",st.lc],["Characteristic",st.char],["Tolerance",fmtN(st.tol)],["Parts",st.parts],["Trials",st.trials],["Appraisers",st.appraisers.join(", ")],["Date",st.date]],5));
        const rows=[]; st.appraisers.forEach((a,ai)=>{ for(let t=0;t<st.trials;t++){ const o={who:`${a} – trial ${t+1}`}; for(let p=0;p<st.parts;p++) o["p"+(p+1)]=(st.data[ai]&&st.data[ai][t]&&st.data[ai][t][p]!=null)?st.data[ai][t][p]:""; rows.push(o); } });
        B.push(tableBlock([{k:"who",label:"Appraiser / trial",w:12}].concat(Array.from({length:st.parts},(_,p)=>({k:"p"+(p+1),label:"Part "+(p+1),w:6}))), rows));
        if(m.ok){ B.push({kind:"label",text:"Results"}); B.push(tableBlock([{k:"a",label:"Source",w:14},{k:"b",label:"Std. deviation",w:8},{k:"c",label:"% of total variation",w:8},{k:"d",label:"% of tolerance",w:8}],
          [["Repeatability – equipment variation (EV)",m.EV,m.pEV,m.tEV],["Reproducibility – appraiser variation (AV)",m.AV,m.pAV,m.tAV],["Gauge R&R (GRR)",m.GRR,m.pGRR,m.tGRR],["Part variation (PV)",m.PV,m.pPV,null],["Total variation (TV)",m.TV,100,null]].map(x=>({a:x[0],b:fmtN(x[1],5),c:fmtN(x[2],1),d:x[3]==null?"—":fmtN(x[3],1)}))));
          const g=m.basis==="tolerance"?m.tGRR:m.pGRR; B.push({kind:"verdict", text:`%GRR (${m.basis}) = ${fmtN(g,1)} % · ndc = ${m.ndc} → ${m.verdict}${m.ndc<5?" · ndc below 5":""}`, tone:g<10?"ok":g<=30?"warn":"ng"}); B.push({kind:"chart", model:CH.msaChart(m,st)}); }
        else B.push({kind:"verdict",text:"Readings not complete yet.",tone:"warn"}); });
      if(!doc.studies.length) B.push({kind:"text",text:"No MSA study defined."}); break; }
    case "charts": {
      const list=S.docs.spc.studies; list.forEach((st,i)=>{ const x=D.spcStats(st); B.push({kind:"section", title:`Balloon #${st.charNo} – ${st.char}  ${st.spec}`, newPage:i>0}); if(st.simulated) B.push({kind:"sim"});
        B.push(kv([["LSL",fmtN(st.lsl)],["USL",fmtN(st.usl)],["X-dbar",fmtN(x.X)],["UCL X-bar",fmtN(x.uclx)],["LCL X-bar",fmtN(x.lclx)],["R-bar",fmtN(x.Rb)],["UCL R",fmtN(x.uclr)],["Cpk",fmtN(x.cpk,2)]],8));
        B.push({kind:"chart", model:CH.run(x,st)}); B.push({kind:"chart", model:CH.xbarR(x,st)}); });
      if(!list.length) B.push({kind:"text",text:"No SPC study – charts are drawn from SPC study readings."}); break; }
  }
  return B;
}

/* ======================================================================
   PDF
   ====================================================================== */
function logoInfo(){ return new Promise(res=>{ const L=A().S.org&&A().S.org.logo; if(!L) return res(null); const im=new Image(); im.onload=()=>res({src:L,r:im.width/im.height||1}); im.onerror=()=>res(null); im.src=L; }); }
function paperFor(id){ const s=A().S.settings; return id==="sop" ? "a3" : (id==="pfmea"||id==="cp") ? (s.bigPaper||"a3") : (s.paper||"a4"); }
async function pdf(ids){
  const {jsPDF}=window.jspdf; const S=A().S, h=S.plan.header, logo=await logoInfo(), co=S.settings.companyName||(S.org&&S.org.name)||"";
  let doc=null; const ranges=[]; const drawn=new Set();
  for(const id of ids){
    const d=D.DOCS.find(x=>x.id===id), dd=S.docs[id], fmt=paperFor(id), ori=id==="sop"?"portrait":"landscape";
    if(!doc) doc=new jsPDF({orientation:ori,unit:"mm",format:fmt}); else doc.addPage(fmt,ori);
    const start=doc.getNumberOfPages();
    const meta={title:d.title+(id==="pfmea"?" ("+window.PDFmea.STD[(S.docs.pfmea.std)||"vda"]+")":""), docNo:dd.docNo||"", rev:dd.rev||"00", date:dmy(h.revDate||""), info:infoFor(id), company:co};
    const PW=()=>doc.internal.pageSize.getWidth(), PH=()=>doc.internal.pageSize.getHeight();
    const hdr=()=>{ const p=doc.getCurrentPageInfo().pageNumber; if(drawn.has(p)) return topOf(); drawn.add(p); return drawHeader(doc, meta, logo); };
    const topOf=()=>headerHeight(meta)+8+3;
    let y=hdr();
    const need=(hmm)=>{ if(y+hmm>PH()-14){ doc.addPage(fmt,ori); y=hdr(); } };
    const blocks=blocksFor(id);
    let firstSection=true;
    for(const b of blocks){
      if(b.kind==="section"){ if(b.newPage&&!firstSection){ doc.addPage(fmt,ori); y=hdr(); } firstSection=false; need(10);
        doc.setFillColor(230,238,251); doc.setDrawColor(21,35,59); doc.setLineWidth(0.2); doc.rect(10,y,PW()-20,7,"FD"); doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(21,35,59); doc.text(T(b.title),12,y+4.8); y+=9; continue; }
      if(b.kind==="image"){ if(!b.src) continue; const bh=95, bw=PW()-20; need(bh+4); doc.setDrawColor(170,180,195); doc.setLineWidth(0.2); doc.rect(10,y,bw,bh); try{ const ip=doc.getImageProperties(b.src), r=Math.min((bw-2)/ip.width,(bh-2)/ip.height), w=ip.width*r, hh=ip.height*r; doc.addImage(b.src,ip.fileType||"JPEG",10+(bw-w)/2,y+(bh-hh)/2,w,hh,undefined,"FAST"); }catch(e){} y+=bh+3; continue; }
      if(b.kind==="label"){ need(8); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(21,35,59); doc.text(T(b.text),10,y+4); y+=6; continue; }
      if(b.kind==="text"){ need(8); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(90,100,115); doc.text(T(b.text),10,y+4); y+=8; continue; }
      if(b.kind==="sim"){ need(9); doc.setFillColor(255,243,220); doc.setDrawColor(168,105,15); doc.rect(10,y,PW()-20,7,"FD"); doc.setTextColor(168,105,15); doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.text("SIMULATED DATA - FOR TRAINING ONLY - NOT FOR PPAP SUBMISSION",PW()/2,y+4.8,{align:"center"}); y+=9;
        const wm=()=>{ doc.saveGraphicsState&&doc.saveGraphicsState(); try{ doc.setGState(new doc.GState({opacity:0.12})); }catch(e){} doc.setTextColor(200,120,20); doc.setFontSize(54); doc.text("SIMULATED",PW()/2,PH()/2+10,{align:"center",angle:20}); doc.restoreGraphicsState&&doc.restoreGraphicsState(); }; wm(); continue; }
      if(b.kind==="verdict"){ need(9); const c=b.tone==="ok"?[227,243,234,30,123,74]:b.tone==="ng"?[251,230,233,200,16,46]:[255,243,220,168,105,15]; doc.setFillColor(c[0],c[1],c[2]); doc.rect(10,y,PW()-20,7,"F"); doc.setTextColor(c[3],c[4],c[5]); doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.text(T(b.text).slice(0,220),12,y+4.7); y+=9; continue; }
      if(b.kind==="chart"){ const ratio=b.model.h/b.model.w, maxW=Math.min(PW()-20,250); let w=Math.min(maxW,(PH()-16-y)/ratio);
        if(w<150){ doc.addPage(fmt,ori); y=hdr(); w=Math.min(maxW,(PH()-16-y)/ratio); }
        const hh=w*ratio; CH.toPDF(doc,b.model,10+(PW()-20-w)/2,y,w); y+=hh+4; continue; }
      if(b.kind==="kv"){ const cols=b.cols, rows=[]; for(let i=0;i<b.pairs.length;i+=cols){ const r=[]; for(let j=0;j<cols;j++){ const p=b.pairs[i+j]; r.push({content:p?T(p[0]):"",styles:{fillColor:[241,244,248],textColor:[91,103,120],fontSize:6.8}}); r.push({content:p?T(p[1]):"",styles:{fontStyle:"bold"}}); } rows.push(r); }
        doc.autoTable({body:rows,startY:y,margin:{left:10,right:10,top:topOf(),bottom:14},theme:"grid",styles:{fontSize:7.5,cellPadding:1.3,lineColor:[170,180,195],lineWidth:0.15,textColor:[21,35,59],overflow:"linebreak"},didDrawPage:()=>hdr()});
        y=doc.lastAutoTable.finalY+3; continue; }
      if(b.kind==="boxes"){ for(let i=0;i<b.items.length;i+=2){ const a=b.items[i], c=b.items[i+1]||["",""];
          doc.autoTable({head:[[T(a[0]),T(c[0])]],body:[[T(a[1]),T(c[1])]],startY:y,margin:{left:10,right:10,top:topOf(),bottom:14},theme:"grid",styles:{fontSize:7.3,cellPadding:1.6,lineColor:[170,180,195],lineWidth:0.15,textColor:[21,35,59],valign:"top"},headStyles:{fillColor:[234,240,247],textColor:[21,35,59],fontStyle:"bold"},didDrawPage:()=>hdr()}); y=doc.lastAutoTable.finalY+3; } continue; }
      if(b.kind==="table"){ y=pdfTable(doc,b,y,topOf,hdr); continue; }
    }
    // signatures
    const sigH = id==="cp"?26:15; if(y+sigH>PH()-14){ doc.addPage(fmt,ori); y=hdr(); }
    const w3=(PW()-20)/3; [["Prepared by",h.preparedBy],["Reviewed by",h.reviewedBy],["Approved by",h.approvedBy]].forEach((s,i)=>{ const x=10+i*w3; doc.setDrawColor(21,35,59); doc.setLineWidth(0.3); doc.rect(x,y,w3,13); doc.setFont("helvetica","normal"); doc.setFontSize(6.8); doc.setTextColor(91,103,120); doc.text(s[0]+"  (name, sign & date)",x+2,y+3.6); doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(21,35,59); doc.text(T(s[1]||""),x+2,y+8.5); });
    if(id==="cp"){ const w2=(PW()-20)/2; y+=13; ["Customer engineering approval / date","Customer quality approval / date"].forEach((s,i)=>{ const x=10+i*w2; doc.rect(x,y,w2,10); doc.setFont("helvetica","normal"); doc.setFontSize(6.8); doc.setTextColor(91,103,120); doc.text(s,x+2,y+3.6); }); }
    ranges.push([start, doc.getNumberOfPages(), meta]);
  }
  // footers + page numbers per document
  ranges.forEach(([a,b,meta])=>{ for(let p=a;p<=b;p++){ doc.setPage(p); const PW=doc.internal.pageSize.getWidth(), PH=doc.internal.pageSize.getHeight();
    doc.setDrawColor(200,208,218); doc.setLineWidth(0.2); doc.line(10,PH-9,PW-10,PH-9); doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(110,120,135);
    doc.text(T(`${meta.company} · ${meta.title} · ${meta.docNo} Rev ${meta.rev}`),10,PH-5.5); doc.text(`Page ${p-a+1} of ${b-a+1}`,PW-10,PH-5.5,{align:"right"}); doc.text(T(`Printed ${new Date().toLocaleDateString("en-GB")} · Controlled copy when stamped`),PW/2,PH-5.5,{align:"center"}); } });
  const h2=S.plan.header, base=(h2.partNo||"part").replace(/[^\w.-]+/g,"_");
  const name = ids.length===1 ? `${base}_${D.DOCS.find(x=>x.id===ids[0]).code}_Rev${(S.docs[ids[0]].rev||"00")}.pdf` : `${base}_Process_Documents.pdf`;
  if(window.KMRPdf) window.KMRPdf.view(doc.output("blob"),name); else doc.save(name);
}
function headerHeight(meta){ return 15 + Math.ceil(meta.info.length/4)*7.4; }
function drawHeader(doc, meta, logo){
  const PW=doc.internal.pageSize.getWidth(), x=10, y=8, w=PW-20, h1=15, lw=44, rw=66;
  doc.setDrawColor(21,35,59); doc.setLineWidth(0.4); doc.rect(x,y,w,h1); doc.line(x+lw,y,x+lw,y+h1); doc.line(x+w-rw,y,x+w-rw,y+h1);
  if(logo){ let iw=lw-6, ih=iw/logo.r; if(ih>h1-4){ ih=h1-4; iw=ih*logo.r; } try{ doc.addImage(logo.src,"PNG",x+(lw-iw)/2,y+(h1-ih)/2,iw,ih); }catch(e){} }
  else { doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(21,35,59); doc.text(doc.splitTextToSize(T(meta.company||""),lw-4).slice(0,2),x+lw/2,y+7,{align:"center"}); }
  doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor(21,35,59); doc.text(T(meta.title.toUpperCase()),x+lw+(w-lw-rw)/2,y+7.2,{align:"center"});
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(91,103,120); doc.text(T(meta.company||""),x+lw+(w-lw-rw)/2,y+12,{align:"center"});
  const rx=x+w-rw; [["Doc. no.",meta.docNo],["Revision",meta.rev],["Date",meta.date]].forEach((r,i)=>{ const yy=y+i*5; if(i) { doc.setLineWidth(0.15); doc.line(rx,yy,x+w,yy); } doc.setFontSize(6.8); doc.setFont("helvetica","normal"); doc.setTextColor(91,103,120); doc.text(r[0],rx+2,yy+3.5); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(21,35,59); doc.text(T(r[1]||""),rx+20,yy+3.6); });
  // info grid
  const rows=Math.ceil(meta.info.length/4), cw=w/4, ch=7.4, y2=y+h1; doc.setLineWidth(0.4); doc.rect(x,y2,w,rows*ch);
  meta.info.forEach((p,i)=>{ const cx=x+(i%4)*cw, cy=y2+Math.floor(i/4)*ch; doc.setLineWidth(0.12); doc.setDrawColor(170,180,195); if(i%4) doc.line(cx,cy,cx,cy+ch); if(i>=4&&i%4===0) doc.line(x,cy,x+w,cy);
    doc.setFont("helvetica","normal"); doc.setFontSize(6.2); doc.setTextColor(91,103,120); doc.text(T(p[0]),cx+1.8,cy+2.8); doc.setFont("helvetica","bold"); doc.setFontSize(7.8); doc.setTextColor(21,35,59); doc.text(T(String(p[1]??"")).slice(0,70),cx+1.8,cy+6.3); });
  doc.setDrawColor(21,35,59);
  return y2+rows*ch+3;
}
function pdfTable(doc, b, y, topOf, hdr){
  const PW=doc.internal.pageSize.getWidth(), W=PW-20, tot=b.cols.reduce((a,c)=>a+c.w,0), n=b.cols.length;
  const fs = n>22?5.9:n>14?6.5:n>9?7.1:7.8;
  const colStyles={}; b.cols.forEach((c,i)=>colStyles[i]={cellWidth:W*c.w/tot});
  const head=[]; if(b.groups) head.push(b.groups.map(g=>({content:T(g[0]),colSpan:g[1],styles:{halign:"center",fillColor:[234,240,247],textColor:[21,35,59],fontSize:fs}})));
  head.push(b.cols.map(c=>T(c.label)));
  const body=b.rows.map(r=>r.map(c=>c.sym?"":T(c.v)));
  doc.autoTable({head, body, startY:y, margin:{left:10,right:10,top:topOf(),bottom:14}, theme:"grid", rowPageBreak:"avoid", showHead:"everyPage",
    styles:{fontSize:fs,cellPadding:0.9,lineColor:[160,170,185],lineWidth:0.12,textColor:[21,35,59],overflow:"linebreak",valign:"top"},
    headStyles:{fillColor:[21,35,59],textColor:255,fontStyle:"bold",valign:"middle",fontSize:fs},
    columnStyles:colStyles,
    didParseCell:(dat)=>{ if(dat.section!=="body") return; const cell=b.rows[dat.row.index]&&b.rows[dat.row.index][dat.column.index]; if(!cell) return;
      if(cell.ap){ dat.cell.styles.fillColor=cell.ap==="H"?[200,16,46]:cell.ap==="M"?[244,183,64]:[30,123,74]; dat.cell.styles.textColor=cell.ap==="M"?[20,20,20]:255; dat.cell.styles.fontStyle="bold"; dat.cell.styles.halign="center"; }
      if(cell.ng){ dat.cell.styles.textColor=[200,16,46]; dat.cell.styles.fontStyle="bold"; dat.cell.styles.fillColor=[251,230,233]; }
      if(cell.ok){ dat.cell.styles.textColor=[30,123,74]; dat.cell.styles.fontStyle="bold"; }
      if(cell.bold){ dat.cell.styles.fontStyle="bold"; dat.cell.styles.textColor=[200,16,46]; }
      if(cell.sym) dat.cell.styles.minCellHeight=8; },
    didDrawCell:(dat)=>{ if(dat.section!=="body") return; const cell=b.rows[dat.row.index]&&b.rows[dat.row.index][dat.column.index]; if(!cell||!cell.sym) return; drawSym(doc, cell.sym, dat.cell.x+dat.cell.width/2, dat.cell.y+Math.min(dat.cell.height,10)/2+0.5); },
    didDrawPage:()=>hdr() });
  return doc.lastAutoTable.finalY+3;
}
function drawSym(doc, s, cx, cy){ doc.setDrawColor(29,95,208); doc.setLineWidth(0.35); const r=2.6;
  if(s==="op") doc.circle(cx,cy,r,"S");
  else if(s==="opi"){ doc.rect(cx-r-0.6,cy-r-0.6,2*r+1.2,2*r+1.2,"S"); doc.circle(cx,cy,r-0.4,"S"); }
  else if(s==="insp") doc.rect(cx-r,cy-r,2*r,2*r,"S");
  else if(s==="store") doc.triangle(cx-r,cy-r,cx+r,cy-r,cx,cy+r,"S");
  else if(s==="move"){ doc.lines([[3.2,0],[0,-1.4],[2.4,2.6],[-2.4,2.6],[0,-1.4],[-3.2,0]],cx-2.8,cy-1.2,[1,1],"S",true); }
  else if(s==="delay"){ doc.line(cx-r,cy-r,cx,cy-r); doc.line(cx-r,cy-r,cx-r,cy+r); doc.line(cx-r,cy+r,cx,cy+r); doc.circle(cx,cy,r,"S"); }
  doc.setDrawColor(0,0,0); }

/* ======================================================================
   EXCEL
   ====================================================================== */
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("Couldn't load the Excel engine – check the internet connection.")); document.head.appendChild(s); }); }
const SYMTXT={op:"○ Operation",opi:"◉ Operation + inspection",insp:"□ Inspection",move:"⇨ Transport",store:"▽ Storage",delay:"D Delay"};
async function xlsx(ids){
  if(!window.ExcelJS) await loadScript(EXCELJS);
  const S=A().S, h=S.plan.header, wb=new ExcelJS.Workbook(); wb.creator=S.settings.companyName||"Process Documents"; wb.created=new Date();
  const logo=await logoInfo(); const logoId = logo ? wb.addImage({base64:logo.src, extension:"png"}) : null;
  const co=S.settings.companyName||(S.org&&S.org.name)||"";
  const thin={style:"thin",color:{argb:"FF9AA6B6"}}, med={style:"medium",color:{argb:"FF15233B"}};
  const border={top:thin,left:thin,bottom:thin,right:thin};
  for(const id of ids){
    const d=D.DOCS.find(x=>x.id===id), dd=S.docs[id], blocks=blocksFor(id);
    const widest = Math.max(12, ...blocks.filter(b=>b.kind==="table").map(b=>b.cols.length));
    const N = widest; // grid columns in this sheet
    const ws=wb.addWorksheet(`${d.code}`.slice(0,31), {pageSetup:{orientation:"landscape",paperSize:paperFor(id)==="a3"?8:9,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.3,right:0.3,top:0.4,bottom:0.5,header:0.2,footer:0.2}}, views:[{showGridLines:false}]});
    ws.headerFooter.oddFooter=`&L${xs(co)} · ${xs(d.title)}&CPrinted &D&RPage &P of &N`;
    // column widths from the widest table
    const main=blocks.find(b=>b.kind==="table"&&b.cols.length===N); const tot=main?main.cols.reduce((a,c)=>a+c.w,0):N*8;
    for(let c=1;c<=N;c++) ws.getColumn(c).width = main ? Math.max(5, Math.round(main.cols[c-1].w/tot*(N>20?360:N>12?270:215))) : 14;
    let r=1;
    // title band
    const lc=Math.max(2,Math.round(N*0.18)), rc=Math.max(3,Math.round(N*0.25));
    ws.mergeCells(r,1,r+2,lc); ws.mergeCells(r,lc+1,r+1,N-rc); ws.mergeCells(r+2,lc+1,r+2,N-rc);
    const t=ws.getCell(r,lc+1); t.value=d.title.toUpperCase(); t.font={bold:true,size:16,color:{argb:"FF15233B"}}; t.alignment={horizontal:"center",vertical:"middle"};
    const st=ws.getCell(r+2,lc+1); st.value=co; st.font={size:10,color:{argb:"FF5B6778"}}; st.alignment={horizontal:"center"};
    [["Doc. no.",dd.docNo||""],["Revision",dd.rev||"00"],["Date",dmy(h.revDate||"")]].forEach((p,i)=>{ const half=Math.max(1,Math.floor(rc/3)); ws.mergeCells(r+i,N-rc+1,r+i,N-rc+half); ws.mergeCells(r+i,N-rc+half+1,r+i,N);
      const a=ws.getCell(r+i,N-rc+1), b=ws.getCell(r+i,N-rc+half+1); a.value=p[0]; a.font={size:9,color:{argb:"FF5B6778"}}; b.value=p[1]; b.font={bold:true,size:10}; });
    for(let rr=r;rr<=r+2;rr++){ ws.getRow(rr).height=20; for(let c=1;c<=N;c++) ws.getCell(rr,c).border={top:rr===r?med:undefined,bottom:rr===r+2?med:undefined,left:c===1||c===lc+1||c===N-rc+1?med:undefined,right:c===N?med:undefined}; }
    if(logoId!=null){ const pxW=colsPx(ws,1,lc), ih=Math.min(64,(pxW-12)/logo.r), iw=ih*logo.r; ws.addImage(logoId,{tl:{col:0.15,row:0.2},ext:{width:iw,height:ih}}); }
    else { const c=ws.getCell(r,1); c.value=co; c.font={bold:true,size:11}; c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; }
    r+=3;
    // info grid: 4 pairs per row
    const info=infoFor(id), per=4, span=Math.floor(N/per);
    for(let i=0;i<info.length;i+=per){ ws.getRow(r).height=15; ws.getRow(r+1).height=17;
      for(let j=0;j<per;j++){ const p=info[i+j]; const c1=1+j*span, c2=j===per-1?N:c1+span-1; ws.mergeCells(r,c1,r,c2); ws.mergeCells(r+1,c1,r+1,c2);
        const a=ws.getCell(r,c1), b=ws.getCell(r+1,c1); a.value=p?p[0]:""; a.font={size:8,color:{argb:"FF5B6778"}}; b.value=p?String(p[1]??""):""; b.font={bold:true,size:10};
        for(let c=c1;c<=c2;c++){ ws.getCell(r,c).border={top:thin,left:c===c1?thin:undefined,right:c===c2?thin:undefined}; ws.getCell(r+1,c).border={bottom:thin,left:c===c1?thin:undefined,right:c===c2?thin:undefined}; } }
      r+=2; }
    r+=1; let headerRowForPrint=null;
    for(const b of blocks){
      if(b.kind==="section"){ if(b.newPage&&r>2) ws.getRow(r-1).addPageBreak(); ws.mergeCells(r,1,r,N); const c=ws.getCell(r,1); c.value=b.title; c.font={bold:true,size:11,color:{argb:"FF15233B"}}; c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE6EEFB"}}; c.border={top:med,bottom:med,left:med,right:med}; ws.getRow(r).height=20; r+=2; continue; }
      if(b.kind==="label"){ const c=ws.getCell(r,1); c.value=b.text; c.font={bold:true,size:11}; r+=1; continue; }
      if(b.kind==="text"){ ws.getCell(r,1).value=b.text; r+=2; continue; }
      if(b.kind==="sim"){ ws.mergeCells(r,1,r,N); const c=ws.getCell(r,1); c.value="SIMULATED DATA – FOR TRAINING ONLY – NOT FOR PPAP SUBMISSION"; c.font={bold:true,size:12,color:{argb:"FFA8690F"}}; c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFFF3DC"}}; c.alignment={horizontal:"center"}; r+=2; continue; }
      if(b.kind==="verdict"){ ws.mergeCells(r,1,r,N); const c=ws.getCell(r,1); c.value=b.text; const col=b.tone==="ok"?["FFE3F3EA","FF1E7B4A"]:b.tone==="ng"?["FFFBE6E9","FFC8102E"]:["FFFFF3DC","FFA8690F"]; c.font={bold:true,size:11,color:{argb:col[1]}}; c.fill={type:"pattern",pattern:"solid",fgColor:{argb:col[0]}}; c.alignment={wrapText:true,vertical:"middle"}; ws.getRow(r).height=22; r+=2; continue; }
      if(b.kind==="kv"){ const cols=b.cols, sp=Math.max(1,Math.floor(N/(cols*2)));
        for(let i=0;i<b.pairs.length;i+=cols){ for(let j=0;j<cols;j++){ const p=b.pairs[i+j]; if(!p) continue; const c1=1+j*sp*2; const c2=c1+sp-1, c3=c2+1, c4=Math.min(N,c3+sp-1);
            if(c2>c1) ws.mergeCells(r,c1,r,c2); if(c4>c3) ws.mergeCells(r,c3,r,c4); const a=ws.getCell(r,c1), v=ws.getCell(r,c3); a.value=p[0]; a.font={size:9,color:{argb:"FF5B6778"}}; a.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF1F4F8"}}; v.value=numOr(p[1]); v.font={bold:true,size:10};
            for(let c=c1;c<=c4;c++) ws.getCell(r,c).border=border; a.alignment={wrapText:true,vertical:"top"}; v.alignment={wrapText:true,vertical:"top"}; }
          r+=1; } r+=1; continue; }
      if(b.kind==="boxes"){ for(let i=0;i<b.items.length;i+=2){ const half=Math.floor(N/2); [b.items[i],b.items[i+1]].forEach((it,j)=>{ if(!it) return; const c1=j?half+1:1, c2=j?N:half; ws.mergeCells(r,c1,r,c2); ws.mergeCells(r+1,c1,r+1,c2);
            const hc=ws.getCell(r,c1); hc.value=it[0]; hc.font={bold:true}; hc.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFEAF0F7"}}; const bc=ws.getCell(r+1,c1); bc.value=it[1]||""; bc.alignment={wrapText:true,vertical:"top"};
            for(let c=c1;c<=c2;c++){ ws.getCell(r,c).border=border; ws.getCell(r+1,c).border=border; } });
          const lines=Math.max(...[b.items[i],b.items[i+1]].filter(Boolean).map(x=>String(x[1]||"").split("\n").length)); ws.getRow(r+1).height=Math.min(300,Math.max(30,lines*14)); r+=3; } continue; }
      if(b.kind==="chart"){ const png=CH.toPNG(b.model,2); const id2=wb.addImage({base64:png,extension:"png"}); const wpx=Math.min(colsPx(ws,1,N),900), hpx=b.model.h*(wpx/b.model.w);
        ws.addImage(id2,{tl:{col:0,row:r-1},ext:{width:wpx,height:hpx}}); r+=Math.ceil(hpx/20)+1; continue; }
      if(b.kind==="table"){
        if(b.groups){ let c=1; b.groups.forEach(g=>{ if(g[1]>1) ws.mergeCells(r,c,r,c+g[1]-1); const cell=ws.getCell(r,c); cell.value=g[0]; cell.font={bold:true,size:9,color:{argb:"FF15233B"}}; cell.alignment={horizontal:"center"}; for(let k=c;k<c+g[1];k++){ ws.getCell(r,k).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFEAF0F7"}}; ws.getCell(r,k).border=border; } c+=g[1]; }); r+=1; }
        const nc=b.cols.length, stretch=nc<N && b!==main;
        const colMap = (i)=>i+1; // one table column per sheet column
        b.cols.forEach((c,i)=>{ const cell=ws.getCell(r,colMap(i)); cell.value=c.label; cell.font={bold:true,size:9.5,color:{argb:"FFFFFFFF"}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF15233B"}}; cell.alignment={wrapText:true,vertical:"middle",horizontal:"center"}; cell.border=border; });
        ws.getRow(r).height=Math.max(28, Math.min(60, Math.max(...b.cols.map((c,i)=>Math.ceil(c.label.length/Math.max(4,ws.getColumn(colMap(i)).width))*13))));
        if(!headerRowForPrint && b===main) headerRowForPrint=r;
        if(stretch&&nc>0){ /* short tables use the first columns; widen the last one to the edge */ }
        r+=1;
        b.rows.forEach(row=>{ let maxLines=1;
          row.forEach((cell,i)=>{ const c=ws.getCell(r,colMap(i)); const v=cell.sym?(SYMTXT[cell.sym]||cell.v):cell.v; c.value=numOr(v); c.alignment={wrapText:true,vertical:"top",horizontal:"left"}; c.border=border; c.font={size:9.5};
            const w=ws.getColumn(colMap(i)).width||10; maxLines=Math.max(maxLines, String(v||"").split("\n").reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/Math.max(3,w*1.05))),0));
            if(cell.ap){ c.fill={type:"pattern",pattern:"solid",fgColor:{argb:cell.ap==="H"?"FFC8102E":cell.ap==="M"?"FFF4B740":"FF1E7B4A"}}; c.font={bold:true,size:9.5,color:{argb:cell.ap==="M"?"FF141414":"FFFFFFFF"}}; c.alignment={horizontal:"center",vertical:"top"}; }
            if(cell.ng){ c.font={bold:true,size:9.5,color:{argb:"FFC8102E"}}; c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFBE6E9"}}; }
            if(cell.ok){ c.font={bold:true,size:9.5,color:{argb:"FF1E7B4A"}}; }
            if(cell.bold){ c.font={bold:true,size:9.5,color:{argb:"FFC8102E"}}; } });
          ws.getRow(r).height=Math.min(400, Math.max(16, maxLines*12.5)); r+=1; });
        r+=1; continue; }
    }
    // signatures
    r+=1; const third=Math.floor(N/3);
    [["Prepared by",h.preparedBy],["Reviewed by",h.reviewedBy],["Approved by",h.approvedBy]].forEach((s,i)=>{ const c1=1+i*third, c2=i===2?N:c1+third-1; ws.mergeCells(r,c1,r,c2); ws.mergeCells(r+1,c1,r+2,c2);
      const a=ws.getCell(r,c1), v=ws.getCell(r+1,c1); a.value=s[0]+" (name, sign & date)"; a.font={size:9,color:{argb:"FF5B6778"}}; v.value=s[1]||""; v.font={bold:true,size:11}; v.alignment={vertical:"top"};
      for(let c=c1;c<=c2;c++) for(let rr=r;rr<=r+2;rr++) ws.getCell(rr,c).border={top:rr===r?med:undefined,bottom:rr===r+2?med:undefined,left:c===c1?med:undefined,right:c===c2?med:undefined}; });
    r+=3;
    if(id==="cp"){ const half=Math.floor(N/2); ["Customer engineering approval / date","Customer quality approval / date"].forEach((s,i)=>{ const c1=i?half+1:1, c2=i?N:half; ws.mergeCells(r,c1,r+1,c2); const a=ws.getCell(r,c1); a.value=s; a.font={size:9,color:{argb:"FF5B6778"}}; a.alignment={vertical:"top"}; for(let c=c1;c<=c2;c++){ ws.getCell(r,c).border={top:thin,left:c===c1?thin:undefined,right:c===c2?thin:undefined}; ws.getCell(r+1,c).border={bottom:thin,left:c===c1?thin:undefined,right:c===c2?thin:undefined}; } }); }
    if(headerRowForPrint){ ws.pageSetup.printTitlesRow=`${headerRowForPrint}:${headerRowForPrint}`; ws.views=[{state:"frozen",ySplit:headerRowForPrint,showGridLines:false}]; }
  }
  const buf=await wb.xlsx.writeBuffer();
  const base=(h.partNo||"part").replace(/[^\w.-]+/g,"_"); const name = ids.length===1 ? `${base}_${D.DOCS.find(x=>x.id===ids[0]).code}_Rev${S.docs[ids[0]].rev||"00"}.xlsx` : `${base}_Process_Documents.xlsx`;
  download(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), name);
}
function colsPx(ws,a,b){ let s=0; for(let c=a;c<=b;c++) s+=(ws.getColumn(c).width||10)*7.2; return s; }
function numOr(v){ if(v===""||v==null) return ""; if(typeof v==="number") return v; const s=String(v); return /^-?\d+(\.\d+)?$/.test(s.trim())&&s.length<16 ? +s : s; }
function xs(s){ return String(s||"").replace(/&/g,"&&"); }
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); }

window.PDExport={pdf, xlsx, blocksFor};
})();
