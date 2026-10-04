/* =====================================================================
   Process Documents – screens: editable grids, documents, studies,
   characteristics and process-plan editors.
   ===================================================================== */
(function(){
"use strict";
const E=window.PDEngine, D=window.PDDocs, SC=window.PDSchema, CH=window.PDCharts;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const A=()=>window.PDApp;
const fmtN=(v,d=4)=>v==null||v===""||!isFinite(+v)?"—":String(Math.round(+v*10**d)/10**d);

/* ---------------- labels ---------------- */
const HL = {partNo:"Part number",partName:"Part name",drawingNo:"Drawing number",drawingRev:"Drawing revision",customer:"Customer",customerCode:"Supplier code (customer)",customerPartNo:"Customer part no.",
  material:"Material",phase:"Control plan type",supplier:"Supplier / plant",supplierCode:"Supplier code",plant:"Plant / location",keyContact:"Key contact / phone",coreTeam:"Core team",model:"Model / vehicle",
  origDate:"Date (original)",revDate:"Date (revision)",docRev:"Document revision",annualVolume:"Annual volume",generalTol:"General tolerance",family:"Part family"};
const INFO = {
  _:["partNo","partName","drawingNo","drawingRev","customer","material","supplier","origDate"],
  pfd:["partNo","partName","drawingNo","drawingRev","customer","material","supplier","model","coreTeam","origDate","revDate","docRev"],
  pfmea:["partNo","partName","drawingNo","drawingRev","customer","supplier","plant","model","keyContact","coreTeam","origDate","revDate"],
  cp:["phase","partNo","partName","drawingNo","drawingRev","customer","customerCode","supplier","supplierCode","keyContact","coreTeam","origDate","revDate","customerPartNo","material","docRev"],
  sop:["partNo","partName","drawingNo","drawingRev","customer","material","supplier","docRev"],
  setup:["partNo","partName","drawingNo","drawingRev","customer","material","supplier","docRev"]
};
["patrol","self","pdi","spc","msa","charts"].forEach(k=>INFO[k]=INFO.setup);
["sc","gauges","tools","pokayoke","machines"].forEach(k=>INFO[k]=["partNo","partName","drawingNo","drawingRev","customer","material","supplier","revDate"]);
const docMeta = id => D.DOCS.find(d=>d.id===id);

/* ---------------- document frame ---------------- */
function head(id, sub){
  const S=A().S, h=S.plan.header, d=docMeta(id), doc=S.docs[id]||{}, logo=S.org&&S.org.logo, co=(S.settings.companyName||(S.org&&S.org.name)||h.supplier||"");
  const fields = INFO[id]||INFO._;
  return `<div class="dochead"><div class="lg">${logo?`<img src="${logo}" alt="${esc(co)} logo">`:`<div class="co">${esc(co||"Company logo")}</div>`}</div>
    <div class="tt"><div class="t">${esc(d.title)}</div><div class="s">${esc(sub||co)}</div></div>
    <div class="no"><span>Doc. no.</span><span><input data-dh="docNo" value="${esc(doc.docNo||"")}" ${ro()}></span><span>Rev.</span><span><input data-dh="rev" value="${esc(doc.rev||"00")}" ${ro()}></span><span>Date</span><span><input data-hh="revDate" type="date" value="${esc(h.revDate||"")}" ${ro()}></span></div></div>
  <div class="info">${fields.map(k=>`<label>${esc(HL[k]||k)}${k==="phase"?`<select data-hh="phase" ${ro()?"disabled":""}>${["Prototype","Pre-launch","Production","Safe launch"].map(v=>`<option${h.phase===v?" selected":""}>${v}</option>`).join("")}</select>`:`<input data-hh="${k}" ${/Date/.test(k)?'type="date"':""} value="${esc(h[k]??"")}" ${ro()}>`}</label>`).join("")}</div>`;
}
function sign(id){
  const h=A().S.plan.header;
  const cp = id==="cp" ? `<div class="sign" style="grid-template-columns:1fr 1fr"><label>Customer engineering approval / date<div class="ln"></div></label><label>Customer quality approval / date<div class="ln"></div></label></div>` : "";
  return `<div class="sign"><label>Prepared by<input data-hh="preparedBy" value="${esc(h.preparedBy||"")}" ${ro()}><div class="ln"></div></label><label>Reviewed by<input data-hh="reviewedBy" value="${esc(h.reviewedBy||"")}" ${ro()}><div class="ln"></div></label><label>Approved by<input data-hh="approvedBy" value="${esc(h.approvedBy||"")}" ${ro()}><div class="ln"></div></label></div>${cp}`;
}
const ro = () => A().S.canEdit ? "" : "readonly";
function bindHead(host, id){
  host.querySelectorAll("[data-hh]").forEach(i=>i.addEventListener("change",()=>{ A().S.plan.header[i.dataset.hh]=i.value; A().changed(null); if(i.dataset.hh==="partNo"||i.dataset.hh==="partName") A().refreshChip(); }));
  host.querySelectorAll("[data-dh]").forEach(i=>i.addEventListener("change",()=>{ A().S.docs[id][i.dataset.dh]=i.value; A().changed(id); }));
}
function toolbar(title, extra=""){
  return `<div class="toolbar"><h2>${esc(title)}</h2><span class="grow"></span>${extra}
    <button class="btn small" data-x="pdf">PDF</button><button class="btn small" data-x="xlsx">Excel</button></div>`;
}
function bindToolbar(host, id){
  host.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>A().exportDoc(id, b.dataset.x));
  const rg=host.querySelector("[data-regen]"); if(rg) rg.onclick=()=>A().regenOne(id);
}

/* ======================================================================
   EDITABLE GRID (click / tab into a cell to edit it)
   ====================================================================== */
function expandCols(cols, slots){
  const out=[]; cols.forEach(c=>{ if(c.slots){ (slots||[]).forEach((s,i)=>out.push({k:c.slots+(i+1),label:s,w:5.2,type:"read"})); } else out.push(c); }); return out;
}
function grid(host, o){
  // o: {cols, groups, rows, slots, derive(row), cellClass(row,col), onChange(row,k), rowsChanged(), newRow(), readonly, free, rowTools:true}
  const cols = expandCols(o.cols, o.slots), canEdit = A().S.canEdit && !o.readonly, tools = canEdit && o.rowTools!==false;
  const del = canEdit && o.delCol;
  const total = cols.reduce((a,c)=>a+(c.w||8),0) + (tools?2.6:0) + (del?3:0);
  const minW = o.minW || Math.max(700, Math.round(total*11.5));
  const show = (c,v)=>{ if(v==null||v==="") return ""; if(c.type==="sel"&&c.opts&&Array.isArray(c.opts[0])){ const f=c.opts.find(x=>x[0]===v); return f?f[1]:v; } if(c.type==="num"&&typeof v==="number") return fmtN(v,4); return String(v); };
  const cellHTML=(r,row,c)=>{ const v=row[c.k]; let cls=(o.cellClass&&o.cellClass(row,c))||""; if(c.type==="ro") cls+=" ro"; if(c.k==="cls"&&v) cls+=" cls";
    if(c.flow) return `<td class="${cls}" data-k="${c.k}"><div class="flowcell">${flowSVG(v)}<div class="t" tabindex="${canEdit?0:-1}" data-r="${r}" data-k="${c.k}">${esc(FLOWSHORT[v]||v||"")}</div></div></td>`;
    return `<td class="${cls}" data-k="${c.k}"><div class="t" ${canEdit&&c.type!=="ro"?'tabindex="0"':""} data-r="${r}" data-k="${c.k}">${esc(show(c,v))}</div></td>`; };
  const rowHTML=(r)=>{ const row=o.rows[r]; if(o.derive) o.derive(row); const rc=(o.rowClass&&o.rowClass(row,r))||"";
    return `<tr data-r="${r}" class="${rc}">${tools?`<td class="rowtools"><button class="rt" data-menu="${r}" aria-label="Row actions"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></td>`:""}${cols.map(c=>cellHTML(r,row,c)).join("")}${del?`<td class="deltools"><button class="rt del" data-delrow="${r}" aria-label="Delete this row" title="Delete this row"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></td>`:""}</tr>`; };
  const draw=()=>{
    host.innerHTML = `<div class="gridwrap${o.free?" free":""}"><table class="g" style="min-width:${minW}px"><colgroup>${tools?`<col style="width:34px">`:""}${cols.map(c=>`<col style="width:${(c.w||8)/total*100}%">`).join("")}${del?`<col style="width:40px">`:""}</colgroup>
      <thead>${o.groups?`<tr class="grp">${tools?"<th class='rowtools'></th>":""}${o.groups.map(g=>`<th colspan="${g[1]}">${esc(g[0])}</th>`).join("")}</tr>`:""}
      <tr>${tools?`<th class="rowtools"></th>`:""}${cols.map(c=>`<th title="${esc(c.label)}">${esc(c.label)}</th>`).join("")}${del?`<th title="Delete">Del.</th>`:""}</tr></thead>
      <tbody>${o.rows.length?o.rows.map((_,r)=>rowHTML(r)).join(""):`<tr><td colspan="${cols.length+(tools?1:0)+(del?1:0)}" style="padding:12px;color:var(--muted);text-align:center;background:var(--panel)">No rows yet${canEdit&&o.newRow!==null?" – use + Add row":""}</td></tr>`}</tbody></table></div>
      ${canEdit&&o.newRow!==null?`<div class="addrow"><button class="btn small" data-add>+ Add row</button><span class="hintline">Tap any cell to edit · ⋮ for insert, move, duplicate or delete</span></div>`:""}`;
  };
  draw();
  const refreshRow=(r)=>{ const tr=host.querySelector(`tr[data-r="${r}"]`); if(!tr) return; tr.outerHTML=rowHTML(r); };
  let ed=null;
  const openEd=(t)=>{
    if(!canEdit||ed) return; const r=+t.dataset.r, k=t.dataset.k, c=cols.find(x=>x.k===k); if(!c||c.type==="ro") return;
    const row=o.rows[r], v=row[k]??"";
    let el;
    if(c.type==="sel"){ el=document.createElement("select"); const opts=(c.opts||[]).map(x=>Array.isArray(x)?x:[x,x||"—"]); if(!opts.some(x=>x[0]===v)&&v!=="") opts.unshift([v,v]); el.innerHTML=opts.map(x=>`<option value="${esc(x[0])}"${x[0]===v?" selected":""}>${esc(x[1])}</option>`).join(""); }
    else if(c.type==="long"){ el=document.createElement("textarea"); el.rows=Math.min(8,Math.max(2,String(v).split("\n").length+1)); el.value=v; }
    else { el=document.createElement("input"); el.type=c.type==="date"?"date":"text"; if(c.type==="num"||c.type==="read") el.inputMode="decimal"; el.value=v; }
    el.className="c"; el.dataset.r=r; el.dataset.k=k;
    const td=t.closest("td"); t.hidden=true; t.parentNode.appendChild(el); el.focus(); if(el.select&&c.type!=="long") try{el.select();}catch(e){}
    ed={el,t,r,k,c,td,orig:v};
    const auto=()=>{ if(c.type==="long"){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } }; auto(); el.addEventListener("input",auto);
    el.addEventListener("keydown",e=>{ if(e.key==="Escape"){ el.value=ed.orig; commit(); t.focus(); } else if(e.key==="Enter"&&(c.type!=="long"||e.ctrlKey||e.metaKey)){ e.preventDefault(); commit(); moveDown(r,k); } });
    el.addEventListener("blur",()=>commit());
    if(c.type==="sel") el.addEventListener("change",()=>commit());
  };
  const moveDown=(r,k)=>{ const n=host.querySelector(`.t[data-r="${r+1}"][data-k="${k}"]`); if(n) n.focus(); };
  const commit=()=>{ if(!ed) return; const {el,r,k,c}=ed; ed=null; let v=el.value;
    if(c.type==="num"||c.rating){ v = v.trim()===""?"":(isNaN(+v.replace(",","."))?v:+v.replace(",",".")); if(c.rating&&v!==""){ v=Math.max(1,Math.min(10,Math.round(+v)||1)); } }
    if(c.type==="read") v=v.trim().replace(",",".");
    const changed = String(o.rows[r][k]??"")!==String(v);
    o.rows[r][k]=v; if(changed&&o.onChange) o.onChange(o.rows[r],k,r);
    refreshRow(r); };
  host.onfocusin = e=>{ const t=e.target.closest(".t"); if(t&&t.dataset.k&&host.contains(t)) openEd(t); };
  host.onclick = e=>{
    const t=e.target.closest(".t"); if(t&&!ed) { openEd(t); return; }
    const m=e.target.closest("[data-menu]"); if(m){ rowMenu(m, +m.dataset.menu); return; }
    const dl=e.target.closest("[data-delrow]"); if(dl){ const r=+dl.dataset.delrow, row=o.rows[r]; const nm=row&&(row.name||row.id||row.key||"")||""; if(!confirm(`Delete ${nm?"“"+nm+"”":"this row"}?`)) return; o.rows.splice(r,1); if(o.rowsChanged) o.rowsChanged(); draw(); return; }
    if(e.target.closest("[data-add]")){ o.rows.push(o.newRow?o.newRow():{}); if(o.rowsChanged) o.rowsChanged(); draw(); const last=host.querySelector(`tr[data-r="${o.rows.length-1}"] .t[tabindex]`); if(last) last.focus(); }
  };
  const rowMenu=(btn,r)=>{
    closeMenus(); const pop=document.createElement("div"); pop.className="menu-pop"; pop.style.position="fixed"; const b=btn.getBoundingClientRect();
    pop.style.left=Math.min(innerWidth-240,b.right+4)+"px"; pop.style.top=Math.min(innerHeight-250,b.top)+"px"; pop.style.minWidth="220px"; pop.id="rowPop";
    pop.innerHTML=`<button data-a="above">Insert row above</button><button data-a="below">Insert row below</button><button data-a="dup">Duplicate row</button><hr><button data-a="up">Move up</button><button data-a="down">Move down</button><hr><button data-a="del" style="color:var(--ng)">Delete row</button>`;
    document.body.appendChild(pop);
    pop.onclick=e=>{ const a=e.target.closest("[data-a]"); if(!a) return; const R=o.rows, nr=()=>o.newRow?o.newRow(R[r]):{};
      if(a.dataset.a==="above") R.splice(r,0,nr()); if(a.dataset.a==="below") R.splice(r+1,0,nr()); if(a.dataset.a==="dup") R.splice(r+1,0,JSON.parse(JSON.stringify(R[r])));
      if(a.dataset.a==="up"&&r>0) [R[r-1],R[r]]=[R[r],R[r-1]]; if(a.dataset.a==="down"&&r<R.length-1) [R[r+1],R[r]]=[R[r],R[r+1]];
      if(a.dataset.a==="del"){ if(!confirm("Delete this row?")) return; R.splice(r,1); }
      pop.remove(); if(o.rowsChanged) o.rowsChanged(); draw(); };
  };
  return {redraw:draw};
}
function closeMenus(){ const p=$("rowPop"); if(p) p.remove(); }
document.addEventListener("pointerdown",e=>{ if(!e.target.closest("#rowPop")&&!e.target.closest("[data-menu]")) closeMenus(); });
document.addEventListener("scroll",closeMenus,true);

const FLOWSHORT={op:"Operation",opi:"Op + insp.",insp:"Inspection",move:"Transport",store:"Storage",delay:"Delay"};
function flowSVG(sym){
  const s='stroke="currentColor" stroke-width="2" fill="none"';
  const m={op:`<circle cx="15" cy="15" r="10" ${s}/>`, opi:`<rect x="4" y="4" width="22" height="22" ${s}/><circle cx="15" cy="15" r="8" ${s}/>`, insp:`<rect x="5" y="5" width="20" height="20" ${s}/>`,
    move:`<path d="M3 11h14V6l10 9-10 9v-5H3z" ${s}/>`, store:`<path d="M4 6h22L15 26z" ${s}/>`, delay:`<path d="M6 5h9a10 10 0 010 20H6z" ${s}/>`};
  return `<svg viewBox="0 0 30 30" aria-hidden="true" style="color:var(--accent)">${m[sym]||m.op}</svg>`;
}

/* ---------- result judgement for reading rows ---------- */
function readingClass(row,c){ if(c.type!=="read") return ""; const j=D.judge(row[c.k],row.lsl===""?null:row.lsl,row.usl===""?null:row.usl); return j==="ng"?"ng":j==="ok"&&row[c.k]!==""?"":""; }
function rowResult(row, prefix, n){ let any=false, bad=false; for(let i=1;i<=n;i++){ const k=prefix+i; const j=D.judge(row[k],numOrNull(row.lsl),numOrNull(row.usl)); if(j) any=true; if(j==="ng") bad=true; } return bad?"NG":any?"OK":""; }
const numOrNull = v => v===""||v==null||isNaN(+v) ? null : +v;

/* ======================================================================
   VIEWS
   ====================================================================== */
const V = {};
function render(view){
  const S=A().S, M=$("main"); closeMenus();
  if(!S.prj){ M.innerHTML=A().welcomeHTML(); A().bindWelcome(); return; }
  (V[view]||V.doc)(M, view);
  M.scrollTop=0;
}

/* ---------- overview ---------- */
V.overview = (M)=>{
  const S=A().S, P=S.prj, plan=S.plan, h=plan.header, docs=S.docs;
  const cnt={}; (docs.pfmea.rows||[]).forEach(r=>cnt[r.ap]=(cnt[r.ap]||0)+1);
  const scN=plan.chars.filter(c=>c.cls).length;
  const src=P.source||{};
  M.innerHTML = `${P.doc.sourceChanged?`<div class="banner warn"><b>New ballooning data received from Balloon Inspector.</b><span class="grow" style="flex:1"></span><button class="btn small primary" id="ovRerun">Re-run automation</button><button class="btn small" id="ovDismiss">Keep current documents</button></div>`:""}
  <div class="toolbar"><h2>${esc(h.partName||h.partNo||"Project")}</h2><span class="grow"></span>
    <label class="fld" style="flex-direction:row;align-items:center;gap:8px">Status <select id="ovStatus" ${ro()?"disabled":""}>${[["received","Received"],["generated","Generated"],["in_review","In review"],["approved","Approved"]].map(s=>`<option value="${s[0]}"${P.status===s[0]?" selected":""}>${s[1]}</option>`).join("")}</select></label></div>
  <div class="kpis">
    <div class="kpi"><b>${plan.chars.length}</b><span>Characteristics</span></div><div class="kpi"><b>${scN}</b><span>Special (SC / CC)</span></div>
    <div class="kpi"><b>${plan.ops.length}</b><span>Process steps</span></div><div class="kpi"><b>${(docs.machines.rows||[]).length}</b><span>Machines</span></div>
    <div class="kpi"><b>${(docs.tools.rows||[]).length}</b><span>Tools</span></div><div class="kpi"><b>${(docs.gauges.rows||[]).length}</b><span>Gauges</span></div>
    <div class="kpi h"><b>${cnt.H||0}</b><span>PFMEA AP = High</span></div><div class="kpi m"><b>${cnt.M||0}</b><span>AP = Medium</span></div><div class="kpi l"><b>${cnt.L||0}</b><span>AP = Low</span></div>
  </div>
  <div class="paper">
    <div class="box"><h3>Part & customer details</h3><div class="frm">${["partNo","partName","drawingNo","drawingRev","customer","customerCode","customerPartNo","material","model","annualVolume","phase","generalTol"].map(k=>`<label class="fld">${esc(HL[k]||k)}<input data-hh="${k}" value="${esc(h[k]??"")}" ${ro()}></label>`).join("")}</div></div>
    <div class="box"><h3 style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Team & approvals (appear on every document)<span style="flex:1"></span>${ro()?"":`<button class="btn small" id="ovHdr" type="button">Fill from company defaults</button>`}</h3><div class="frm">${["supplier","supplierCode","plant","keyContact","coreTeam","preparedBy","reviewedBy","approvedBy","origDate","revDate","docRev"].map(k=>`<label class="fld">${esc(HL[k]||({preparedBy:"Prepared by",reviewedBy:"Reviewed by",approvedBy:"Approved by"})[k]||k)}<input data-hh="${k}" ${/Date/.test(k)?'type="date"':""} value="${esc(h[k]??"")}" ${ro()}></label>`).join("")}</div></div>
    <div class="cols2">
      <div class="box"><h3>What the automation decided</h3><table class="stats">
        <tr><td>Part family</td><td>${esc(h.family==="rotational"?"Rotational (turned) part":"Prismatic (milled) part")}</td></tr>
        <tr><td>Material class</td><td>${esc(h.materialClass||"")}</td></tr>
        <tr><td>Largest outer size</td><td>${fmtN(plan.ctxInfo&&plan.ctxInfo.maxOD,2)} mm</td></tr>
        <tr><td>Heat treatment</td><td>${plan.notes.ht?esc(plan.notes.htType+(plan.notes.hardness?" – "+plan.notes.hardness:"")):"Not required"}</td></tr>
        <tr><td>Surface treatment</td><td>${plan.notes.surf?esc(plan.notes.surfType+(plan.notes.coat?" "+plan.notes.coat:"")):"Not required"}</td></tr>
        <tr><td>Process route</td><td style="text-align:left">${plan.ops.map(o=>o.opNo).join(" → ")}</td></tr></table></div>
      <div class="box"><h3>Source</h3><table class="stats">
        <tr><td>Received from</td><td>${P.bi_report_id?"Balloon Inspector":esc(src.fileName?"File "+src.fileName:"Manual / sample")}</td></tr>
        <tr><td>Drawing file</td><td>${esc(src.fileName||"—")}</td></tr>
        <tr><td>Generated</td><td>${esc((P.doc.generatedAt||"").replace("T"," ").slice(0,16))}</td></tr>
        <tr><td>Documents</td><td>${D.DOCS.length}</td></tr></table>
        <div class="addrow"><button class="btn small" id="ovRerun2" ${ro()?"disabled":""}>Re-run automation from ballooning data</button></div></div>
    </div>
  </div>`;
  bindHead(M,"overview");
  const st=$("ovStatus"); if(st) st.onchange=()=>{ P.status=st.value; A().changed(null); A().refreshChip(); };
  [$("ovRerun"),$("ovRerun2")].forEach(b=>b&&(b.onclick=()=>A().rerun()));
  if($("ovHdr")) $("ovHdr").onclick=()=>{ const n=A().applyHeaderDefaults(h,true); A().changed(null); render("overview"); A().toast(n?`${n} header field${n===1?"":"s"} filled from Admin → Document header.`:"Nothing to fill – set the defaults in Admin → Document header first.",6000); };
  if($("ovDismiss")) $("ovDismiss").onclick=()=>{ P.doc.sourceChanged=false; A().changed(null); render("overview"); };
};

/* ---------- characteristics ---------- */
V.chars = (M)=>{
  const S=A().S, plan=S.plan;
  const opOpts=[["","—"]].concat(plan.ops.map(o=>[String(o.opNo),`${o.opNo} ${o.name}`]));
  const gOpts=[["","—"]].concat(plan.gauges.map(g=>[g.id,`${g.id} ${g.name} ${g.range||""}`]));
  M.innerHTML = `<div class="toolbar"><h2>Characteristics (from ballooning)</h2><span class="grow"></span><button class="btn small primary" id="chApply" ${ro()?"disabled":""}>Update documents</button></div>
  <p class="hintline" style="margin:-4px 0 10px">Balloon numbers, specifications and classes come from Balloon Inspector. Change the operation, gauge or class here, then <b>Update documents</b>.</p>
  <div id="chGrid"></div>`;
  grid($("chGrid"), { rows:plan.chars, cols:[
    {k:"no",label:"Balloon",w:4,type:"num"},{k:"type",label:"Type",w:7,type:"sel",opts:["Linear","Diameter","Radius","Angle","Chamfer","Thread","GD&T","Surface finish","Material","Note"]},
    {k:"text",label:"As on drawing",w:12},{k:"label",label:"Characteristic",w:9},{k:"spec",label:"Specification",w:12,type:"ro"},{k:"nominal",label:"Nominal",w:5.5,type:"num"},{k:"upper",label:"Upper tol.",w:5.5,type:"num"},{k:"lower",label:"Lower tol.",w:5.5,type:"num"},
    {k:"lsl",label:"LSL",w:5.5,type:"ro"},{k:"usl",label:"USL",w:5.5,type:"ro"},{k:"cls",label:"Class",w:4,type:"sel",opts:SC.CLS},{k:"op",label:"Operation",w:12,type:"sel",opts:opOpts},{k:"gauge",label:"Gauge",w:13,type:"sel",opts:gOpts},{k:"balloonInstr",label:"Balloon instrument",w:9,type:"ro"}],
    derive:(c)=>{ const x={type:c.type,text:c.text,nominal:numOrNull(c.nominal),upper:numOrNull(c.upper),lower:numOrNull(c.lower),gdt:c.gdt,datum:c.datum,cls:c.cls}; c.spec=E.specText(x); const l=E.limits(x); c.lsl=l[0]; c.usl=l[1]; c.band=E.tolBand(x); c.internal=E.isInternal(x); },
    onChange:(c,k)=>{ if(k==="op"){ plan.ops.forEach(o=>{ o.chars=o.chars.filter(n=>n!==c.no); }); const o=plan.ops.find(o=>String(o.opNo)===String(c.op)); if(o){ o.chars.push(c.no); o.chars.sort((a,b)=>a-b); } }
      if(k==="gauge"){ plan.gauges.forEach(g=>{ g.chars=g.chars.filter(n=>n!==c.no); }); const g=plan.gauges.find(g=>g.id===c.gauge); if(g&&!g.chars.includes(c.no)) g.chars.push(c.no); }
      if(["nominal","upper","lower"].includes(k)) c[k]=numOrNull(c[k]);
      c.variable = c.lsl!=null||c.usl!=null; A().changed("_plan"); },
    newRow:()=>({no:Math.max(0,...plan.chars.map(c=>+c.no||0))+1,type:"Linear",text:"",label:"Length",cls:"",op:"",gauge:""}),
    rowsChanged:()=>A().changed("_plan"),
    rowClass:(c)=>c.cls==="CC"?"":""
  });
  $("chApply").onclick=()=>A().regenFromPlan();
};

/* ---------- process plan ---------- */
V.plan = (M)=>{
  const S=A().S, plan=S.plan, machines=S.machines;
  const draw=()=>{
  M.innerHTML = `<div class="toolbar"><h2>Process plan</h2><span class="grow"></span>
    <button class="btn small" id="plAdd" ${ro()?"disabled":""}>+ Add operation</button><button class="btn small primary" id="plApply" ${ro()?"disabled":""}>Update documents</button></div>
  <p class="hintline" style="margin:-4px 0 10px">Process selection, machine, tools, consumables and gauges for every operation — worked out from the ballooning data. Edit anything, then <b>Update documents</b>.</p>
  ${plan.ops.map((o,i)=>{ const ch=o.chars.map(n=>plan.chars.find(c=>c.no===n)).filter(Boolean);
    return `<details class="op" data-i="${i}"><summary><span class="dh" draggable="true" title="Drag to move this process up or down" style="cursor:grab;margin-right:6px;user-select:none">⠿</span><span class="no">${o.opNo}</span><span class="nm">${esc(o.name)}</span><span class="pills">${o.inHouse?"":`<span class="pill">Sub-contract</span>`}<span class="pill">${esc(o.machine||"—")}</span><span class="pill">${ch.length} chars</span><span class="pill">${o.tools.length} tools</span><span class="pill">${o.gauges.length} gauges</span>${ch.some(c=>c.cls==="CC")?`<span class="pill cc">CC</span>`:""}${ch.some(c=>c.cls==="SC")?`<span class="pill sc">SC</span>`:""}</span></summary>
    <div class="in" data-in="${i}"></div></details>`; }).join("")}`;
  M.querySelectorAll("details.op").forEach(d=>d.addEventListener("toggle",()=>{ if(d.open) opBody(+d.dataset.i); }));
  $("plApply").onclick=()=>A().regenFromPlan();
  // move a process; numbers keep their order (10, 20, 30…), characteristics follow their process, then every document is rebuilt from the plan
  const reorder=(from,to)=>{ if(from===to||from<0||to<0||from>=plan.ops.length||to>=plan.ops.length) return; const nums=plan.ops.map(o=>o.opNo).sort((a,b)=>a-b); const [m]=plan.ops.splice(from,1); plan.ops.splice(to,0,m); plan.ops.forEach((o,k)=>{ o.opNo=nums[k]; }); plan.chars.forEach(c=>{ const o=plan.ops.find(x=>x.chars.includes(c.no)); if(o) c.op=o.opNo; }); A().changed("_plan"); draw(); A().toast("Process moved — numbers updated. Updating all documents…"); A().regenFromPlan(); };
  let dragFrom=-1;
  M.querySelectorAll(".dh").forEach(h=>{ const d=h.closest("details.op"); h.addEventListener("dragstart",e=>{ if(ro()){ e.preventDefault(); return; } dragFrom=+d.dataset.i; e.dataTransfer.effectAllowed="move"; try{ e.dataTransfer.setData("text/plain",String(dragFrom)); }catch(_){} d.style.opacity=".5"; }); h.addEventListener("dragend",()=>{ d.style.opacity=""; M.querySelectorAll("details.op").forEach(x=>x.style.boxShadow=""); }); });
  M.querySelectorAll("details.op").forEach(d=>{ d.addEventListener("dragover",e=>{ if(dragFrom<0) return; e.preventDefault(); const r=d.getBoundingClientRect(), below=e.clientY>r.top+r.height/2; d.style.boxShadow=below?"0 3px 0 0 #2563eb":"0 -3px 0 0 #2563eb"; }); d.addEventListener("dragleave",()=>{ d.style.boxShadow=""; }); d.addEventListener("drop",e=>{ if(dragFrom<0) return; e.preventDefault(); const to0=+d.dataset.i, r=d.getBoundingClientRect(), below=e.clientY>r.top+r.height/2; let to=to0+(below?1:0); if(dragFrom<to) to--; const f=dragFrom; dragFrom=-1; reorder(f,to); }); });
  M._reorder=reorder;
  $("plAdd").onclick=async()=>{ const keys=Object.keys(E.OPS).filter(k=>k!=="TURN"&&k!=="OTHER");
    const res=await new Promise(done=>{ const where=[["0","At the start of the route"]].concat(plan.ops.map((o,i)=>[String(i+1),`After ${o.opNo} · ${o.name}`])); const dflt=String(plan.ops.length);
      const dlg=document.createElement("div"); dlg.style.cssText="position:fixed;inset:0;background:#0008;z-index:99;display:flex;align-items:center;justify-content:center;padding:12px";
      dlg.innerHTML=`<div style="background:var(--card,#fff);color:inherit;border-radius:14px;padding:18px;width:min(520px,100%);max-height:92vh;overflow:auto"><h3 style="margin:0 0 10px">Add operation</h3>
      <label class="fld">Process<select id="aoK">${keys.map(k=>`<option value="${esc(k)}">${esc(E.OPS[k].name)}</option>`).join("")}<option value="OTHER">✎ Other — type a new process name…</option></select></label>
      <label class="fld" id="aoNw" style="display:none">New process name<input id="aoN" placeholder="e.g. Deburring, Laser marking, Washing"></label>
      <label class="fld">Insert position<select id="aoW">${where.map(o=>`<option value="${o[0]}" ${o[0]===dflt?"selected":""}>${esc(o[1])}</option>`).join("")}</select></label>
      <p class="hintline">The new operation takes the next free number at that position; later operations are renumbered and all documents are updated.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="aoC">Cancel</button><button class="btn primary" id="aoO">Add operation</button></div></div>`;
      document.body.appendChild(dlg); const q=s=>dlg.querySelector(s); q("#aoK").onchange=()=>{ q("#aoNw").style.display=q("#aoK").value==="OTHER"?"":"none"; };
      q("#aoC").onclick=()=>{ dlg.remove(); done(null); }; q("#aoO").onclick=()=>{ const K=q("#aoK").value, nm=q("#aoN").value.trim(); if(K==="OTHER"&&!nm){ q("#aoN").focus(); return; } dlg.remove(); done({K,nm,at:+q("#aoW").value}); }; });
    if(!res) return; const {K,nm,at}=res; const T=E.OPS[K]; if(!T) return;
    const op={key:K,opNo:0,name:K==="OTHER"?nm:T.name,sym:T.sym,inHouse:T.inHouse,chars:[],machineId:"",machine:"",tools:[],consumables:(E.DEFAULT_CONSUMABLES[K]||[]).slice(),gauges:[],params:(()=>{ try{ return E.paramsFor({key:K},{matCls:"P",maxOD:plan.ctxInfo.maxOD,length:plan.ctxInfo.length,notes:plan.notes,header:plan.header}); }catch(_){ return []; } })()};
    const prev=at>0?+plan.ops[at-1].opNo:0, next=at<plan.ops.length?+plan.ops[at].opNo:null, n=prev+10; if(next!==null&&n>=next){ for(let j=at;j<plan.ops.length;j++) plan.ops[j].opNo=+plan.ops[j].opNo+10; } op.opNo=n;
    plan.ops.splice(at,0,op); plan.chars.forEach(c=>{ const o=plan.ops.find(x=>x.chars.includes(c.no)); if(o) c.op=o.opNo; }); A().changed("_plan"); draw(); A().regenFromPlan(); };
  };
  const opBody=(i)=>{
    const o=plan.ops[i], host=M.querySelector(`[data-in="${i}"]`); if(!host) return;
    const mOpts=machines.map(m=>`<option value="${esc(m.id)}"${m.id===o.machineId?" selected":""}>${esc(m.id+" "+m.name)}</option>`).join("");
    host.innerHTML=`<div class="frm">
      <label class="fld">Op no.<input data-f="opNo" type="number" value="${o.opNo}" ${ro()}></label>
      <label class="fld">Operation name<input data-f="name" value="${esc(o.name)}" ${ro()}></label>
      <label class="fld">Flow symbol<select data-f="sym" ${ro()?"disabled":""}>${SC.FLOW.map(f=>`<option value="${f[0]}"${o.sym===f[0]?" selected":""}>${f[1]}</option>`).join("")}</select></label>
      <label class="fld">Machine (from master)<select data-f="machineId" ${ro()?"disabled":""}><option value="">— other / sub-contract —</option>${mOpts}</select></label>
      <label class="fld">Machine / equipment text<input data-f="machine" value="${esc(o.machine||"")}" ${ro()}></label>
      <label class="fld">Where<select data-f="inHouse" ${ro()?"disabled":""}><option value="1"${o.inHouse?" selected":""}>In-house</option><option value="0"${o.inHouse?"":" selected"}>Sub-contract</option></select></label></div>
    <p class="hintline" style="margin:10px 0 4px">Characteristics produced here: ${o.chars.length?o.chars.map(n=>{ const c=plan.chars.find(x=>x.no===n); return c?`<span class="pill ${c.cls==="CC"?"cc":c.cls?"sc":""}">#${n} ${esc(c.spec)}</span>`:""; }).join(" "):"none"} <span>(move them on the Characteristics screen)</span></p>
    <h4 style="font:600 15px var(--display);margin:14px 0 6px">Tools</h4><div data-g="tools"></div>
    <h4 style="font:600 15px var(--display);margin:14px 0 6px">Process parameters & in-process checks <span class="hintline" style="font:400 13px var(--body)">– “Control plan column” decides whether it is listed as a product or a process characteristic</span></h4><div data-g="params"></div>
    <div class="cols2" style="margin-top:14px"><label class="fld">Consumables (one per line)<textarea data-f="consumables" rows="5" ${ro()}>${esc((o.consumables||[]).join("\n"))}</textarea></label>
      <div class="fld">Gauges used at this operation<div class="checklist">${plan.gauges.length?plan.gauges.map(g=>`<label><input type="checkbox" data-gauge="${esc(g.id)}" ${o.gauges.includes(g.id)?"checked":""} ${ro()?"disabled":""}><span class="gid">${esc(g.id)}</span><span>${esc(g.name+" "+(g.range||""))}</span></label>`).join(""):`<span class="hintline" style="padding:6px">No gauges in this project.</span>`}</div></div></div>
    <div class="addrow"><button class="btn small" data-mv="-1" ${ro()?"disabled":""}>Move up</button><button class="btn small" data-mv="1" ${ro()?"disabled":""}>Move down</button><button class="btn small danger" data-del ${ro()?"disabled":""}>Delete operation</button>${window.PDCNC&&PDCNC.isCNC(o)?`<span style="flex:1"></span><button class="btn small" data-cnc>CNC program for this operation →</button>`:""}</div>`;
    host.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("change",()=>{ const f=el.dataset.f; let v=el.value;
      if(f==="opNo") v=+v||o.opNo; if(f==="inHouse") v=v==="1"; if(f==="consumables") v=v.split("\n").map(s=>s.trim()).filter(Boolean);
      if(f==="machineId"){ const m=machines.find(x=>x.id===v); if(m){ o.machine=m.name; host.querySelector('[data-f="machine"]').value=m.name; } }
      o[f]=v; if(f==="opNo"){ plan.chars.forEach(c=>{ if(o.chars.includes(c.no)) c.op=o.opNo; }); } A().changed("_plan"); }));
    host.querySelectorAll("[data-gauge]").forEach(cb=>cb.addEventListener("change",()=>{ const id=cb.dataset.gauge; o.gauges=o.gauges.filter(x=>x!==id); if(cb.checked) o.gauges.push(id); const g=plan.gauges.find(x=>x.id===id); if(g){ g.ops=g.ops.filter(x=>x!==o.opNo); if(cb.checked) g.ops.push(o.opNo); } A().changed("_plan"); }));
    grid(host.querySelector('[data-g="tools"]'),{rows:o.tools,free:true,cols:[{k:"id",label:"Tool ID",w:5},{k:"desc",label:"Description",w:14},{k:"spec",label:"Insert / size",w:14},{k:"holder",label:"Holder",w:10},{k:"grade",label:"Grade",w:9},{k:"life",label:"Tool life",w:7},{k:"remarks",label:"Remarks",w:8}],
      onChange:()=>A().changed("_plan"), rowsChanged:()=>A().changed("_plan"), newRow:()=>({id:nextToolId(plan),desc:"",spec:"",holder:"",grade:"",life:"",remarks:""})});
    grid(host.querySelector('[data-g="params"]'),{rows:o.params,free:true,cols:[{k:"name",label:"Characteristic / parameter",w:12},{k:"kind",label:"Control plan column",w:8,type:"sel",opts:[["product","Product characteristic"],["process","Process characteristic"]]},{k:"spec",label:"Specification",w:18,type:"long"},{k:"method",label:"Method",w:10},{k:"freq",label:"Frequency",w:9},{k:"resp",label:"Responsibility",w:7}],
      onChange:(r,k)=>{ if(k==="name"&&!r._kindSet) r.kind=E.paramKind(r.name); if(k==="kind") r._kindSet=true; A().changed("_plan"); }, rowsChanged:()=>A().changed("_plan"), newRow:()=>({name:"",kind:"process",spec:"",method:"",freq:"",resp:"Operator"})});
    host.querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{ const j=i+(+b.dataset.mv); if(M._reorder) M._reorder(i,j); });
    const cb=host.querySelector("[data-cnc]"); if(cb) cb.onclick=()=>{ V._cncOp=o.opNo; A().go("cnc"); };
    host.querySelector("[data-del]").onclick=()=>{ if(!confirm(`Delete operation ${o.opNo} ${o.name}? Its characteristics become unassigned.`)) return; plan.ops.splice(i,1); plan.chars.forEach(c=>{ if(o.chars.includes(c.no)) c.op=""; }); A().changed("_plan"); draw(); };
  };
  draw();
};
/* ---------- CNC programs ---------- */
V.cnc = (M)=>{
  const S=A().S, plan=S.plan, C=window.PDCNC, ops=plan.ops.filter(C.isCNC);
  if(!ops.length){ M.innerHTML=`<div class="toolbar"><h2>CNC programs</h2></div><div class="paper"><p class="hintline">This project has no CNC turning, VMC or drilling operation. Add one on the Process plan screen.</p></div>`; return; }
  const nums=C.progNumbers(plan,S.settings);
  let cur=ops.find(o=>o.opNo===V._cncOp)||ops[0]; V._cncOp=cur.opNo;
  const gen=(o,force)=>{ if(!o.cnc||force){ o.cnc={text:C.generate(o,plan,S.settings,nums[o.opNo]),at:new Date().toISOString(),edited:false,prog:nums[o.opNo]}; return true; } return false; };
  if(gen(cur,false)) A().changed("_plan");
  const fileName=o=>`O${String((o.cnc&&o.cnc.prog)||nums[o.opNo]).padStart(4,"0")}_${(plan.header.partNo||"PART").replace(/[^\w-]+/g,"_")}_OP${o.opNo}.nc`;
  const dl=(name,text)=>{ const b=new Blob([text.replace(/\n/g,"\r\n")],{type:"text/plain"}), a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); };
  M.innerHTML=`<div class="toolbar"><h2>CNC programs</h2><span class="grow"></span>
      <button class="btn small" id="ncRe" ${ro()?"disabled":""}>Regenerate this program</button><button class="btn small" id="ncCopy">Copy</button><button class="btn small primary" id="ncDl">Download .nc</button><button class="btn small" id="ncAll">Download all</button></div>
    <div class="banner warn"><b>Draft program – prove out before cutting.</b><span>Generated from the ballooned characteristics, the tools of this operation and Admin → CNC programs. Check every value marked in the variable list against the drawing, run it in simulation / dry run / single block, then change <code>#1=0</code> to <code>#1=1</code>. Until then the program stops with an alarm.</span></div>
    <div class="optabs">${ops.map(o=>`<button data-op="${o.opNo}" aria-pressed="${o===cur}">Op ${o.opNo} · ${esc(o.name)}</button>`).join("")}</div>
    <div class="meta"><label>Program number<input value="O${String((cur.cnc&&cur.cnc.prog)||nums[cur.opNo]).padStart(4,"0")}" readonly></label><label>Machine<input value="${esc(cur.machine||"—")}" readonly></label><label>Tools in this operation<input value="${cur.tools.length}" readonly></label><label>Characteristics<input value="${cur.chars.length}" readonly></label><label>Generated<input value="${esc(((cur.cnc&&cur.cnc.at)||"").replace("T"," ").slice(0,16))}${cur.cnc&&cur.cnc.edited?" · edited":""}" readonly></label></div>
    <textarea class="nc" id="ncT" spellcheck="false" ${ro()}>${esc(cur.cnc.text)}</textarea>
    <p class="hintline">You can edit the program here; changes are saved with the project. Tools, parameters and characteristics come from the Process plan – change them there and press <b>Regenerate this program</b>.</p>`;
  M.querySelectorAll("[data-op]").forEach(b=>b.onclick=()=>{ V._cncOp=+b.dataset.op; render("cnc"); });
  $("ncT").addEventListener("change",()=>{ cur.cnc.text=$("ncT").value; cur.cnc.edited=true; A().changed("_plan"); });
  $("ncRe").onclick=()=>{ if(cur.cnc.edited&&!confirm("This program was edited on screen. Regenerate and replace your edits?")) return; gen(cur,true); A().changed("_plan"); render("cnc"); A().toast("Program regenerated."); };
  $("ncCopy").onclick=async()=>{ try{ await navigator.clipboard.writeText($("ncT").value); A().toast("Program copied."); }catch(e){ $("ncT").select(); document.execCommand("copy"); A().toast("Program copied."); } };
  $("ncDl").onclick=()=>dl(fileName(cur),$("ncT").value);
  $("ncAll").onclick=()=>{ let n=0; ops.forEach((o,i)=>{ if(gen(o,false)) n++; setTimeout(()=>dl(fileName(o),o.cnc.text),i*400); }); if(n) A().changed("_plan"); A().toast(`Downloading ${ops.length} program file${ops.length===1?"":"s"}.`); };
};
function nextToolId(plan){ let n=0; plan.ops.forEach(o=>o.tools.forEach(t=>{ const m=/(\d+)$/.exec(t.id||""); if(m) n=Math.max(n,+m[1]); })); return "T-"+E.pad(n+1,3); }

/* ---------- generic tabular docs ---------- */
V.doc = (M, id)=>{
  const S=A().S, d=docMeta(id); if(!d){ V.overview(M); return; }
  if(V["d_"+id]) return V["d_"+id](M,id);
  const doc=S.docs[id], spec=SC.COLS[id];
  M.innerHTML = toolbar(d.title, `<button class="btn small" data-regen ${ro()?"disabled":""}>Regenerate</button>`)+`<div class="paper">${head(id)}<div id="g"></div>${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  grid($("g"), { rows:doc.rows, cols:spec.cols, groups:spec.groups,
    derive: id==="pfmea" ? (r=>{ r.ap=D.AP(r.s,r.o,r.d); r.ap2=D.AP(r.s2||r.s,r.o2,r.d2); if(!r.o2||!r.d2) r.ap2=""; }) : id==="pdi" ? (r=>{ r.result=rowResult(r,"s",5); }) : null,
    cellClass:(r,c)=> c.ap ? (r[c.k]?"ap"+r[c.k]:"") : c.type==="read" ? readingClass(r,c) : (c.k==="result"&&r.result==="NG")?"ng":(c.k==="result"&&r.result==="OK")?"ok":"",
    rowClass:(r,i)=> id==="pfmea"&&i>0&&doc.rows[i-1].opNo!==r.opNo ? "grp-first" : id==="cp"&&i>0&&doc.rows[i-1].opNo!==r.opNo ? "grp-first" : "",
    onChange:()=>A().changed(id), rowsChanged:()=>A().changed(id),
    newRow:(near)=>{ const o={}; spec.cols.forEach(c=>{ if(c.k) o[c.k]=""; }); if(near&&near.opNo!=null){ o.opNo=near.opNo; if(id==="pfmea"){ o.item=near.item; o.step=near.step; o.funcItem=near.funcItem; } if(id==="cp"){ o.name=near.name; o.machine=near.machine; } } if(id==="pfd") o.sym="op"; if(o.sl!==undefined) o.sl=doc.rows.length+1; return o; }
  });
};

/* ---------- sectioned reports: setup / patrol / self ---------- */
let secIdx = {};
function sectioned(M, id){
  const S=A().S, d=docMeta(id), doc=S.docs[id];
  if(!doc.sections.length){ M.innerHTML=toolbar(d.title)+`<div class="paper">${head(id)}<p class="hintline">No machining operation with characteristics yet. Assign characteristics to operations on the Characteristics screen.</p></div>`; bindToolbar(M,id); return; }
  const si=Math.min(secIdx[id]||0, doc.sections.length-1), sec=doc.sections[si];
  const metaF = id==="setup"?[["date","Date","date"],["shift","Shift"],["operator","Operator"],["setter","Setter"],["inspector","QA inspector"],["reason","Reason for setup"],["decision","Decision (Approved / Rejected)"]] : id==="patrol"?[["date","Date","date"],["shift","Shift"],["inspector","Patrol inspector"]]:[["date","Date","date"],["shift","Shift"],["operator","Operator"]];
  M.innerHTML = toolbar(d.title, `<button class="btn small" data-regen ${ro()?"disabled":""}>Regenerate</button>`)+`<div class="paper">${head(id, `Op ${sec.opNo} – ${sec.opName} · ${sec.machine||""}`)}
    <div class="optabs">${doc.sections.map((s,i)=>`<button data-sec="${i}" aria-pressed="${i===si}">Op ${s.opNo} · ${esc(s.opName)}</button>`).join("")}</div>
    <div class="meta">${metaF.map(f=>`<label>${f[1]}<input data-m="${f[0]}" ${f[2]?`type="${f[2]}"`:""} value="${esc(sec.meta[f[0]]??"")}" ${ro()}></label>`).join("")}
      ${id!=="setup"?`<label>Time slots (comma separated)<input data-slots value="${esc((doc.slots||[]).join(", "))}" ${ro()}></label>`:""}</div>
    <div id="g"></div>${id==="setup"?`<h4 style="font:600 16px var(--display);margin:14px 0 6px">Process parameter verification</h4><div id="g2"></div>`:""}
    <p class="hintline">Enter readings as numbers (judged against LSL/USL automatically) or OK / NG for attribute gauges. Readings flow into the SPC study.</p>${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  M.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>{ secIdx[id]=+b.dataset.sec; render(id); });
  M.querySelectorAll("[data-m]").forEach(i=>i.addEventListener("change",()=>{ sec.meta[i.dataset.m]=i.value; A().changed(id); }));
  const sl=M.querySelector("[data-slots]"); if(sl) sl.addEventListener("change",()=>{ doc.slots=sl.value.split(",").map(s=>s.trim()).filter(Boolean); A().changed(id); render(id); });
  const spec=SC.COLS[id];
  grid($("g"),{rows:sec.rows, cols:spec.cols, slots:doc.slots,
    derive: id==="setup" ? (r=>{ r.result=rowResult(r,"r",5); }) : null,
    cellClass:(r,c)=> c.type==="read" ? readingClass(r,c) : c.k==="result" ? (r.result==="NG"?"ng":r.result==="OK"?"ok":"") : "",
    onChange:()=>A().changed(id), rowsChanged:()=>A().changed(id), newRow:()=>({charNo:"",char:"",spec:"",lsl:"",usl:"",gauge:""})});
  if(id==="setup") grid($("g2"),{rows:sec.params, cols:spec.params, free:true, cellClass:(r,c)=>c.k==="ok"?(r.ok==="NG"?"ng":r.ok==="OK"?"ok":""):"", onChange:()=>A().changed(id), rowsChanged:()=>A().changed(id), newRow:()=>({name:"",spec:"",actual:"",ok:""})});
}
V.d_setup=sectioned; V.d_patrol=sectioned; V.d_self=sectioned;

V.d_pdi = (M,id)=>{
  const doc=A().S.docs.pdi, mt=doc.meta||(doc.meta={});
  const f=[["date","Date","date"],["invoice","Invoice / DC no."],["lotQty","Lot quantity"],["sampleQty","Sample quantity"],["inspector","Inspector"],["decision","Lot decision (Accepted / Rejected)"]];
  const d=docMeta(id), spec=SC.COLS.pdi;
  M.innerHTML = toolbar(d.title, `<button class="btn small" data-regen ${ro()?"disabled":""}>Regenerate</button>`)+`<div class="paper">${head(id)}<div class="meta">${f.map(x=>`<label>${x[1]}<input data-m="${x[0]}" ${x[2]?`type="${x[2]}"`:""} value="${esc(mt[x[0]]??"")}" ${ro()}></label>`).join("")}</div><div id="g"></div>${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  M.querySelectorAll("[data-m]").forEach(i=>i.addEventListener("change",()=>{ mt[i.dataset.m]=i.value; A().changed(id); }));
  grid($("g"),{rows:doc.rows, cols:spec.cols, derive:r=>{ r.result=rowResult(r,"s",5); }, cellClass:(r,c)=>c.type==="read"?readingClass(r,c):c.k==="result"?(r.result==="NG"?"ng":r.result==="OK"?"ok":""):"",
    onChange:()=>A().changed(id), rowsChanged:()=>A().changed(id), newRow:()=>({charNo:"",char:"",spec:"",lsl:"",usl:"",gauge:"",s1:"",s2:"",s3:"",s4:"",s5:""})});
};

/* ---------- SOP ---------- */
V.d_sop = (M,id)=>{
  const doc=A().S.docs.sop, d=docMeta(id); const si=Math.min(secIdx.sop||0,doc.sections.length-1), s=doc.sections[si];
  M.innerHTML = toolbar(d.title, `<button class="btn small" data-regen ${ro()?"disabled":""}>Regenerate</button>`)+`<div class="paper">${head(id, `Op ${s.opNo} – ${s.opName}`)}
    <div class="optabs">${doc.sections.map((x,i)=>`<button data-sec="${i}" aria-pressed="${i===si}">Op ${x.opNo} · ${esc(x.opName)}</button>`).join("")}</div>
    <div class="meta"><label>Operation<input data-s="opName" value="${esc(s.opName)}" ${ro()}></label><label>Machine / equipment<input data-s="machine" value="${esc(s.machine||"")}" ${ro()}></label><label>SOP no.<input data-s="docNo" value="${esc(s.docNo||(doc.docNo+"/"+s.opNo))}" ${ro()}></label></div>
    <div class="box" style="margin:10px 0"><h3>Drawing / photo for this operation</h3><div id="sopImg" style="width:100%;height:260px;border:2px dashed var(--line,#cbd5e1);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8fafc;text-align:center;color:#64748b">${s.img?`<img src="${s.img}" style="max-width:100%;max-height:100%;object-fit:contain" alt="Operation drawing or photo">`:`<span>Drag &amp; drop an image here, or use the button below</span>`}</div>
      ${ro()?"":`<div style="display:flex;gap:8px;margin-top:8px"><label class="btn small" style="cursor:pointer">Choose image…<input id="sopFile" type="file" accept="image/*" hidden></label>${s.img?`<button class="btn small" id="sopDel">Remove image</button>`:""}<span class="hintline" style="align-self:center">Fits the box automatically · printed above the Tools / Gauges table.</span></div>`}</div>
    <div class="cols2"><div class="box"><h3>Tools</h3><textarea data-s="tools" ${ro()}>${esc(s.tools)}</textarea></div><div class="box"><h3>Gauges / instruments</h3><textarea data-s="gauges" ${ro()}>${esc(s.gauges)}</textarea></div>
      <div class="box"><h3>Consumables</h3><textarea data-s="consumables" ${ro()}>${esc(s.consumables)}</textarea></div><div class="box"><h3>Personal protective equipment</h3><textarea data-s="ppe" ${ro()}>${esc(s.ppe)}</textarea></div></div>
    <h3 style="font:700 17px var(--display);margin:6px 0">Work sequence</h3><div id="g1"></div>
    <h3 style="font:700 17px var(--display);margin:14px 0 6px">Quality checks at this operation</h3><div id="g2"></div>
    <h3 style="font:700 17px var(--display);margin:14px 0 6px">Process parameters</h3><div id="g3"></div>
    <div class="cols2" style="margin-top:14px"><div class="box"><h3>Safety precautions</h3><textarea data-s="safety" ${ro()}>${esc(s.safety)}</textarea></div><div class="box"><h3>Reaction plan</h3><textarea data-s="reaction" ${ro()}>${esc(s.reaction)}</textarea></div></div>
    ${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  M.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>{ secIdx.sop=+b.dataset.sec; render(id); });
  const setImg=f=>{ if(!f||!/^image\//.test(f.type)) return; const fr=new FileReader(); fr.onload=()=>{ const im=new Image(); im.onload=()=>{ const k=Math.min(1,1600/Math.max(im.width,im.height)), c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height); s.img=c.toDataURL("image/jpeg",0.85); A().changed(id); render(id); }; im.src=fr.result; }; fr.readAsDataURL(f); };
  const box=M.querySelector("#sopImg"), inp=M.querySelector("#sopFile"), del=M.querySelector("#sopDel");
  if(inp) inp.onchange=()=>setImg(inp.files[0]); if(del) del.onclick=()=>{ s.img=""; A().changed(id); render(id); };
  if(box&&!ro()){ box.addEventListener("dragover",e=>{ e.preventDefault(); box.style.borderColor="#2563eb"; }); box.addEventListener("dragleave",()=>{ box.style.borderColor=""; }); box.addEventListener("drop",e=>{ e.preventDefault(); box.style.borderColor=""; setImg(e.dataTransfer.files[0]); }); }
  M.querySelectorAll("[data-s]").forEach(i=>i.addEventListener("change",()=>{ s[i.dataset.s]=i.value; A().changed(id); }));
  const ch=()=>A().changed(id);
  grid($("g1"),{rows:s.steps,free:true,cols:[{k:"no",label:"Step",w:3,type:"num"},{k:"step",label:"Work step",w:22,type:"long"},{k:"key",label:"Key point / reason",w:16,type:"long"}],onChange:ch,rowsChanged:()=>{ s.steps.forEach((x,i)=>x.no=i+1); ch(); },newRow:()=>({no:s.steps.length+1,step:"",key:""})});
  grid($("g2"),{rows:s.checks,free:true,cols:[{k:"charNo",label:"Balloon",w:4},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:13},{k:"cls",label:"Class",w:4,type:"sel",opts:SC.CLS},{k:"gauge",label:"Gauge",w:14},{k:"freq",label:"Frequency",w:8}],onChange:ch,rowsChanged:ch,newRow:()=>({charNo:"",char:"",spec:"",gauge:"",freq:""})});
  grid($("g3"),{rows:s.params,free:true,cols:[{k:"name",label:"Parameter",w:12},{k:"spec",label:"Specification",w:20,type:"long"},{k:"freq",label:"Check frequency",w:10}],onChange:ch,rowsChanged:ch,newRow:()=>({name:"",spec:"",freq:""})});
};

/* ---------- SPC ---------- */
V.d_spc = (M,id)=>{
  const S=A().S, doc=S.docs.spc, d=docMeta(id);
  if(!doc.studies.length){ M.innerHTML=toolbar(d.title)+`<div class="paper">${head(id)}<p class="hintline">No variable characteristic with both limits yet. Mark SC/CC in Balloon Inspector, or add a study below.</p><div class="addrow"><button class="btn small" id="spAdd">+ Add study</button></div></div>`; bindToolbar(M,id); $("spAdd").onclick=()=>addSpc(); return; }
  const si=Math.min(secIdx.spc||0,doc.studies.length-1), st=doc.studies[si], stats=D.spcStats(st);
  const n=st.n||5;
  M.innerHTML = toolbar(d.title)+`<div class="paper">${head(id, `#${st.charNo} ${st.char} ${st.spec}`)}
    <div class="optabs">${doc.studies.map((x,i)=>`<button data-sec="${i}" aria-pressed="${i===si}">#${esc(x.charNo)} ${esc(x.char)} ${x.cls?`(${x.cls})`:""}</button>`).join("")}<button id="spAdd">+ Study</button></div>
    ${st.simulated?`<div class="sim">SIMULATED DATA – FOR TRAINING ONLY – NOT FOR PPAP SUBMISSION</div>`:""}
    <div class="meta"><label>Characteristic<input data-st="char" value="${esc(st.char)}" ${ro()}></label><label>Specification<input data-st="spec" value="${esc(st.spec)}" ${ro()}></label>
      <label>LSL<input data-st="lsl" inputmode="decimal" value="${st.lsl??""}" ${ro()}></label><label>USL<input data-st="usl" inputmode="decimal" value="${st.usl??""}" ${ro()}></label>
      <label>Subgroup size (n)<select data-st="n" ${ro()?"disabled":""}>${[2,3,4,5,6,7,8,9,10].map(v=>`<option${v===n?" selected":""}>${v}</option>`).join("")}</select></label>
      <label>No. of subgroups<input data-st="k" type="number" min="2" max="100" value="${st.k||25}" ${ro()}></label>
      <label>Gauge<input data-st="gauge" value="${esc(st.gauge)}" ${ro()}></label><label>Machine / op<input data-st="op" value="${esc(st.op)}" ${ro()}></label>
      <label>Study type<input data-st="studyType" value="${esc(st.studyType||"")}" ${ro()}></label><label>Study period<input data-st="period" value="${esc(st.period||"")}" ${ro()}></label></div>
    <div class="addrow" style="margin:0 0 10px">${ro()?"":`<button class="btn small primary" id="spPull">Pull readings from inspection reports</button><button class="btn small" id="spPaste">Paste from Excel</button><button class="btn small" id="spClear">Clear readings</button><button class="btn small" id="spSim">Fill simulated demo data</button><button class="btn small danger" id="spDel">Delete study</button>`}</div>
    <div class="cols2" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)"><div id="g"></div>
      <div><div class="kpis" style="grid-template-columns:repeat(3,1fr)">
        ${[["Cp",stats.cp],["Cpk",stats.cpk],["Pp",stats.pp],["Ppk",stats.ppk],["X̿",stats.X],["R̄",stats.Rb]].map(k=>`<div class="kpi"><b>${fmtN(k[1],/^[CP]/.test(k[0])?2:4)}</b><span>${k[0]}</span></div>`).join("")}</div>
        ${stats.ok?`<div class="verdict ${stats.cpk>=1.67?"ok":stats.cpk>=1.33?"warn":"ng"}">${esc(stats.verdict)}${stats.stable?"":" · Process not in statistical control – investigate special causes before judging capability"}</div>
        <table class="stats"><tr><td>Subgroups used</td><td>${stats.k} × ${stats.n} = ${stats.N}</td></tr><tr><td>σ within (R̄/d₂)</td><td>${fmtN(stats.sw,5)}</td></tr><tr><td>σ overall</td><td>${fmtN(stats.s,5)}</td></tr>
          <tr><td>X̄ chart UCL / LCL</td><td>${fmtN(stats.uclx)} / ${fmtN(stats.lclx)}</td></tr><tr><td>R chart UCL / LCL</td><td>${fmtN(stats.uclr)} / ${fmtN(stats.lclr)}</td></tr>
          <tr><td>Min / max reading</td><td>${fmtN(stats.min)} / ${fmtN(stats.max)}</td></tr><tr><td>Readings out of specification</td><td>${stats.outSpec}</td></tr>
          <tr><td>Out-of-control points (X̄ / R)</td><td>${stats.oocX.join(", ")||"none"} / ${stats.oocR.join(", ")||"none"}</td></tr><tr><td>Run of 7 on one side</td><td>${stats.runs.length?"at subgroup "+stats.runs.join(", "):"none"}</td></tr></table>`
        :`<div class="verdict warn">Enter at least 2 complete subgroups (${n} readings each). Readings entered in the Setup, Patrol and Self inspection reports can be pulled in with one click.</div>`}
      </div></div>
    <h3 style="font:700 17px var(--display);margin:16px 0 8px">Control charts</h3>${CH.toSVG(CH.xbarR(stats,st),"X-bar and R chart")}
    <div style="height:10px"></div>${CH.toSVG(CH.hist(stats,st),"Histogram")}
    ${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  M.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>{ secIdx.spc=+b.dataset.sec; render(id); });
  $("spAdd").onclick=()=>addSpc();
  M.querySelectorAll("[data-st]").forEach(i=>i.addEventListener("change",()=>{ const k=i.dataset.st; let v=i.value; if(["lsl","usl"].includes(k)) v=numOrNull(v); if(k==="n"||k==="k"){ v=Math.max(2,+v||5); } st[k]=v; if(k==="n"||k==="k") resizeSpc(st); A().changed(id); render(id); }));
  resizeSpc(st);
  const rows = st.data.map((g,i)=>{ const o={sg:i+1}; for(let j=0;j<n;j++) o["x"+(j+1)]=g[j]==null?"":g[j]; return o; });
  const cols=[{k:"sg",label:"Subgroup",w:5,type:"ro"}].concat(Array.from({length:n},(_,j)=>({k:"x"+(j+1),label:"X"+(j+1),w:6,type:"read"}))).concat([{k:"xb",label:"X̄",w:6.5,type:"ro"},{k:"r",label:"R",w:6,type:"ro"}]);
  grid($("g"),{rows,cols,rowTools:false,newRow:null,minW:360, derive:o=>{ const v=[]; for(let j=1;j<=n;j++){ const x=o["x"+j]; if(x!==""&&x!=null&&!isNaN(+x)) v.push(+x); } o.xb=v.length===n?fmtN(v.reduce((a,b)=>a+b,0)/n,4):""; o.r=v.length===n?fmtN(Math.max(...v)-Math.min(...v),4):""; },
    cellClass:(o,c)=>{ if(c.type!=="read") return ""; const j=D.judge(o[c.k],st.lsl,st.usl); return j==="ng"?"ng":""; },
    onChange:(o,k)=>{ const j=+k.slice(1)-1; st.data[o.sg-1][j]=o[k]===""?null:+o[k]; st.simulated=st.simulated&&true; A().changed(id); clearTimeout(V._spcT); V._spcT=setTimeout(()=>{ const sc=$("main").scrollTop; render(id); $("main").scrollTop=sc; },900); }});
  if(!ro()){
    $("spPull").onclick=()=>{ const g=D.pullReadings(S.docs, st.charNo, n); if(!g.length){ A().toast(`No complete groups of ${n} readings for #${st.charNo} in the Setup / Patrol / Self / PDI reports yet.`); return; } st.data=g.slice(-Math.max(st.k||25,g.length)); st.k=st.data.length; st.simulated=false; A().changed(id); render(id); A().toast(`Pulled ${g.length} subgroups (${g.length*n} readings) from the inspection reports.`); };
    $("spPaste").onclick=()=>pasteDialog("Paste readings",`Copy the readings from Excel (one subgroup per row, ${n} columns) and paste here.`,txt=>{ const rowsP=txt.trim().split(/\r?\n/).map(l=>l.split(/[\t;,]+/).map(s=>s.trim()).filter(Boolean).map(Number).filter(v=>!isNaN(v))).filter(r=>r.length);
      const flat=rowsP.every(r=>r.length===1)?rowsP.flat():null; let g=[]; if(flat){ for(let i=0;i+n<=flat.length;i+=n) g.push(flat.slice(i,i+n)); } else g=rowsP.filter(r=>r.length>=n).map(r=>r.slice(0,n));
      if(!g.length){ A().toast("Couldn't find complete subgroups in the pasted text."); return; } st.data=g; st.k=g.length; st.simulated=false; A().changed(id); render(id); });
    $("spClear").onclick=()=>{ if(!confirm("Clear all readings of this study?")) return; st.data=Array.from({length:st.k||25},()=>Array(n).fill(null)); st.simulated=false; A().changed(id); render(id); };
    $("spSim").onclick=()=>{ if(!confirm("Fill this study with SIMULATED random readings?\n\nUse this only for training or to preview the report. The report will be watermarked \"SIMULATED\" and must not be submitted as PPAP evidence.")) return; D.simulateSPC(st); A().changed(id); render(id); };
    $("spDel").onclick=()=>{ if(!confirm("Delete this study?")) return; doc.studies.splice(si,1); secIdx.spc=0; A().changed(id); render(id); };
  }
};
function resizeSpc(st){ const n=st.n||5, k=st.k||25; st.data=st.data||[]; while(st.data.length<k) st.data.push(Array(n).fill(null)); st.data.length=Math.max(k,0); st.data=st.data.map(g=>{ g=(g||[]).slice(0,n); while(g.length<n) g.push(null); return g; }); }
async function addSpc(){ const S=A().S, plan=S.plan; const opts=plan.chars.filter(c=>c.variable).map(c=>[String(c.no),`#${c.no} ${c.label} ${c.spec}${c.cls?" ("+c.cls+")":""}`]); if(!opts.length){ A().toast("No characteristic with a tolerance to study."); return; } const pick=await A().pick("Add SPC study",opts,{label:"Characteristic (balloon)",ok:"Add study"}); if(!pick) return;
  const c=plan.chars.find(x=>String(x.no)===String(pick).replace("#","").trim()); if(!c){ A().toast("No characteristic with that balloon number."); return; }
  const g=plan.gauges.find(x=>x.id===c.gauge); S.docs.spc.studies.push({charNo:c.no,char:c.label,spec:c.spec,lsl:c.lsl,usl:c.usl,nominal:c.nominal,gauge:g?g.name+" "+(g.range||""):"",op:"",machine:"",cls:c.cls,n:5,k:25,data:Array.from({length:25},()=>Array(5).fill(null)),simulated:false,studyType:"Initial process study (PPAP)",period:""});
  secIdx.spc=S.docs.spc.studies.length-1; A().changed("spc"); render("spc"); }

/* ---------- MSA ---------- */
V.d_msa = (M,id)=>{
  const S=A().S, doc=S.docs.msa, d=docMeta(id);
  if(!doc.studies.length){ M.innerHTML=toolbar(d.title)+`<div class="paper">${head(id)}<p class="hintline">No variable gauge on a special characteristic yet.</p></div>`; bindToolbar(M,id); return; }
  const si=Math.min(secIdx.msa||0,doc.studies.length-1), st=doc.studies[si], ms=D.msaStats(st), p=st.parts, r=st.trials;
  M.innerHTML = toolbar(d.title)+`<div class="paper">${head(id, `${st.gaugeId} ${st.gauge} – Gauge R&R (Average & Range method)`)}
    <div class="optabs">${doc.studies.map((x,i)=>`<button data-sec="${i}" aria-pressed="${i===si}">${esc(x.gaugeId)} ${esc(x.gauge)}</button>`).join("")}</div>
    ${st.simulated?`<div class="sim">SIMULATED DATA – FOR TRAINING ONLY – NOT FOR PPAP SUBMISSION</div>`:""}
    <div class="meta"><label>Gauge<input data-st="gauge" value="${esc(st.gauge)}" ${ro()}></label><label>Gauge ID<input data-st="gaugeId" value="${esc(st.gaugeId)}" ${ro()}></label><label>Range<input data-st="range" value="${esc(st.range||"")}" ${ro()}></label><label>Least count<input data-st="lc" value="${esc(st.lc||"")}" ${ro()}></label>
      <label>Characteristic<input data-st="char" value="${esc(st.char)}" ${ro()}></label><label>Tolerance (USL − LSL)<input data-st="tol" inputmode="decimal" value="${st.tol??""}" ${ro()}></label>
      <label>Trials<select data-st="trials" ${ro()?"disabled":""}>${[2,3].map(v=>`<option${v===r?" selected":""}>${v}</option>`).join("")}</select></label><label>Parts<select data-st="parts" ${ro()?"disabled":""}>${[5,6,7,8,9,10].map(v=>`<option${v===p?" selected":""}>${v}</option>`).join("")}</select></label>
      ${st.appraisers.map((a,i)=>`<label>Appraiser ${String.fromCharCode(65+i)}<input data-ap="${i}" value="${esc(a)}" ${ro()}></label>`).join("")}<label>Date<input data-st="date" type="date" value="${esc(st.date||"")}" ${ro()}></label></div>
    <div class="addrow" style="margin:0 0 10px">${ro()?"":`<button class="btn small" id="msPaste">Paste from Excel</button><button class="btn small" id="msClear">Clear readings</button><button class="btn small" id="msSim">Fill simulated demo data</button>`}</div>
    <div id="g"></div>
    <div style="margin-top:14px">${ms.ok?`<table class="stats"><tr><td><b>Source</b></td><td><b>Std. dev.</b></td></tr>
      ${[["Repeatability – EV",ms.EV,ms.pEV,ms.tEV],["Reproducibility – AV",ms.AV,ms.pAV,ms.tAV],["Gauge R&R – GRR",ms.GRR,ms.pGRR,ms.tGRR],["Part variation – PV",ms.PV,ms.pPV,null],["Total variation – TV",ms.TV,100,null]].map(x=>`<tr><td>${x[0]}</td><td>${fmtN(x[1],5)} · ${fmtN(x[2],1)} % TV${x[3]!=null?" · "+fmtN(x[3],1)+" % Tol":""}</td></tr>`).join("")}
      <tr><td>Number of distinct categories (ndc)</td><td>${ms.ndc}</td></tr><tr><td>Range chart UCL (all ranges must be below)</td><td>${fmtN(ms.uclR,5)}</td></tr></table>
      <div class="verdict ${(ms.basis==="tolerance"?ms.tGRR:ms.pGRR)<10?"ok":(ms.basis==="tolerance"?ms.tGRR:ms.pGRR)<=30?"warn":"ng"}">%GRR (${ms.basis}) = ${fmtN(ms.basis==="tolerance"?ms.tGRR:ms.pGRR,1)} % → ${esc(ms.verdict)}${ms.ndc<5?" · ndc < 5: gauge cannot discriminate enough":""}</div>`
      :`<div class="verdict warn">Enter all ${st.appraisers.length} × ${r} × ${p} readings to calculate the study (AIAG MSA, Average & Range method).</div>`}
      ${ms.ok?`<div style="margin-top:12px">${CH.toSVG(CH.msaChart(ms,st),"Appraiser averages")}</div>`:""}</div>
    ${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  M.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>{ secIdx.msa=+b.dataset.sec; render(id); });
  const reshape=()=>{ st.data=st.appraisers.map((_,a)=>Array.from({length:st.trials},(_,t)=>Array.from({length:st.parts},(_,i)=>(st.data[a]&&st.data[a][t]&&st.data[a][t][i]!=null)?st.data[a][t][i]:null))); };
  M.querySelectorAll("[data-st]").forEach(i=>i.addEventListener("change",()=>{ const k=i.dataset.st; let v=i.value; if(k==="tol") v=numOrNull(v); if(k==="trials"||k==="parts") v=+v; st[k]=v; reshape(); A().changed(id); render(id); }));
  M.querySelectorAll("[data-ap]").forEach(i=>i.addEventListener("change",()=>{ st.appraisers[+i.dataset.ap]=i.value; A().changed(id); }));
  reshape();
  const rows=[]; st.appraisers.forEach((a,ai)=>{ for(let t=0;t<r;t++){ const o={who:`${a} – trial ${t+1}`,a:ai,t}; for(let i=0;i<p;i++) o["p"+(i+1)]=st.data[ai][t][i]??""; rows.push(o); } });
  grid($("g"),{rows,rowTools:false,newRow:null,cols:[{k:"who",label:"Appraiser / trial",w:12,type:"ro"}].concat(Array.from({length:p},(_,i)=>({k:"p"+(i+1),label:"Part "+(i+1),w:6,type:"read"}))),
    rowClass:(o)=>o.t===0&&o.a>0?"grp-first":"",
    onChange:(o,k)=>{ st.data[o.a][o.t][+k.slice(1)-1]=o[k]===""?null:+o[k]; A().changed(id); clearTimeout(V._msT); V._msT=setTimeout(()=>{ const sc=$("main").scrollTop; render(id); $("main").scrollTop=sc; },900); }});
  if(!ro()){
    $("msPaste").onclick=()=>pasteDialog("Paste Gauge R&R readings",`Paste ${st.appraisers.length*r} rows (appraiser A trial 1, A trial 2 … C trial ${r}), each with ${p} part readings.`,txt=>{ const rowsP=txt.trim().split(/\r?\n/).map(l=>l.split(/[\t;,]+/).map(s=>s.trim()).filter(Boolean).map(Number).filter(v=>!isNaN(v))).filter(x=>x.length>=p);
      if(rowsP.length<st.appraisers.length*r){ A().toast(`Need ${st.appraisers.length*r} rows of ${p} readings.`); return; } let k=0; st.appraisers.forEach((_,a)=>{ for(let t=0;t<r;t++){ st.data[a][t]=rowsP[k++].slice(0,p); } }); st.simulated=false; A().changed(id); render(id); });
    $("msClear").onclick=()=>{ if(!confirm("Clear all readings?")) return; st.data=[]; reshape(); st.simulated=false; A().changed(id); render(id); };
    $("msSim").onclick=()=>{ if(!confirm("Fill with SIMULATED readings for training / preview? The report will be watermarked and must not be used as PPAP evidence.")) return; const ch=S.plan.chars.find(c=>String(c.no)===String(st.charNo)); D.simulateMSA(st, ch&&ch.lsl!=null&&ch.usl!=null?(ch.lsl+ch.usl)/2:(ch&&ch.nominal)||0); A().changed(id); render(id); };
  }
};

/* ---------- charts ---------- */
V.d_charts = (M,id)=>{
  const S=A().S, doc=S.docs.charts, spc=S.docs.spc, d=docMeta(id);
  const studies=spc.studies; const cur=studies.find(s=>String(s.charNo)===String(doc.meta.charNo))||studies[0];
  M.innerHTML = toolbar(d.title)+`<div class="paper">${head(id, cur?`#${cur.charNo} ${cur.char} ${cur.spec}`:"")}
    ${studies.length?`<div class="optabs">${studies.map(s=>`<button data-c="${esc(s.charNo)}" aria-pressed="${cur&&s===cur}">#${esc(s.charNo)} ${esc(s.char)}</button>`).join("")}</div>`:""}
    ${!cur?`<p class="hintline">Charts are drawn from the SPC study readings. Add a study on the SPC Study Report first.</p>`:(()=>{ const st=D.spcStats(cur); return `${cur.simulated?`<div class="sim">SIMULATED DATA – FOR TRAINING ONLY – NOT FOR PPAP SUBMISSION</div>`:""}
      ${st.ok?"":`<div class="verdict warn">No readings yet for #${esc(cur.charNo)}. Enter or pull readings in the SPC Study Report — the charts update automatically.</div>`}
      <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">${[["LSL",cur.lsl],["USL",cur.usl],["X̿",st.X],["UCL X̄",st.uclx],["LCL X̄",st.lclx],["R̄",st.Rb],["UCL R",st.uclr],["Cpk",st.cpk]].map(k=>`<div class="kpi"><b style="font-size:22px">${fmtN(k[1],4)}</b><span>${k[0]}</span></div>`).join("")}</div>
      <h3 style="font:700 17px var(--display);margin:6px 0">Run chart</h3>${CH.toSVG(CH.run(st,cur),"Run chart")}
      <h3 style="font:700 17px var(--display);margin:14px 0 6px">X̄-R chart</h3>${CH.toSVG(CH.xbarR(st,cur),"X-bar R chart")}`; })()}
    ${sign(id)}</div>`;
  bindHead(M,id); bindToolbar(M,id);
  M.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{ doc.meta.charNo=b.dataset.c; A().changed(id); render(id); });
};

/* ---------- paste dialog ---------- */
function pasteDialog(title, hint, cb){
  const v=document.createElement("div"); v.className="veil"; v.innerHTML=`<div class="dlg"><div class="hd"><h2>${esc(title)}</h2></div><div class="bd"><p class="hintline">${esc(hint)}</p><textarea id="pasteTx" style="width:100%;min-height:220px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--field);font:13px ui-monospace,Consolas,monospace"></textarea></div><div class="ft"><button class="btn" id="pC">Cancel</button><button class="btn primary" id="pO">Use these readings</button></div></div>`;
  document.body.appendChild(v); $("pasteTx").focus(); $("pC").onclick=()=>v.remove(); $("pO").onclick=()=>{ const t=$("pasteTx").value; v.remove(); cb(t); };
}

window.PDUI = {render, grid, head, sign, esc, flowSVG, rowResult, fmtN, HL, INFO};
})();
