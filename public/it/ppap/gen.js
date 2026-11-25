/* "Generate from drawings" tab of the PPAP app. */
(function(){
const $=s=>document.querySelector(s), esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const G={D:null,logo:null,files:{customer:null,process:[]}};
const HF=[["partName","Part name"],["partNo","Part number"],["rev","Drawing revision / date"],["drawingNo","Drawing number"],["customer","Customer"],["material","Material"],["weight","Weight (kg)"],["supplier","Supplier (your company)"],["supplierCode","Supplier code"],["plant","Plant location"],["level","Submission level"],["preparedBy","Prepared by"],["checkedBy","Checked by"],["approvedBy","Approved by"],["keyContact","Key contact / phone"],["coreTeam","Core team"]];
const CH=[["no","No.",4],["desc","Characteristic",22],["nom","Nominal",8],["tol","Tolerance",10],["lsl","Min",7],["usl","Max",7],["cls","Class",6],["method","Inspection method",22],["op","Op.",5]];
const OH=[["no","Op. no.",6],["name","Operation",30],["machine","Machine",22]];
function draw(){ const F=window.PPAPDocs.FORMATS, host=$("#gen");
  host.innerHTML=`<h2 style="margin:0 0 4px">Generate PPAP documents from drawings</h2>
  <p class="note" style="margin:0 0 12px">Upload the customer drawing and the process (operation) drawings. The app reads them, builds the PPAP document set, and you download it in the customer's format as Excel or PDF.</p>
  <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
   <div class="kpi"><b style="font-size:14px">1 · Drawings</b><div class="frm" style="margin-top:8px">
     <div class="full"><label>How should the drawings be read?</label><select id="gM"><option value="ai">AI reads the drawings (most accurate)</option><option value="report">Use a Balloon Inspector report (my ballooned table)</option><option value="ocr">Free reader (quick, less accurate)</option></select></div>
     <div class="full" id="gRepBox" style="display:none"><label>Balloon Inspector report</label><select id="gR"><option value="">Loading reports…</option></select></div>
     <div class="full" id="gCBox"><label>Customer drawing (PDF or image)</label><input type="file" id="gC" accept=".pdf,application/pdf,image/*"></div>
     <div class="full"><label>Process drawings, one per operation (PDF or image) - several allowed</label><input type="file" id="gP" accept=".pdf,application/pdf,image/*" multiple></div>
     <div class="full"><label>Customer logo for the report top-left (optional image)</label><input type="file" id="gL" accept="image/*"></div>
     <div class="full"><button class="btn" id="gGo">Analyse drawings</button></div></div></div>
   <div class="kpi"><b style="font-size:14px">2 · Format and output</b><div class="frm" style="margin-top:8px">
     <div class="full"><label>Customer format</label><select id="gF">${Object.values(F).map(f=>`<option value="${f.id}"${f.ready?"":" disabled"}>${esc(f.label)}${f.ready?"":" - coming soon"}</option>`).join("")}</select><div class="note" id="gFn" style="margin:4px 0 0"></div></div>
     <div class="full"><label>Download as</label><div class="lv"><label><input type="radio" name="gO" value="xlsx" checked> Excel</label><label><input type="radio" name="gO" value="pdf"> PDF</label></div></div>
     <div class="full"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gS" style="width:auto"> Fill sample MSA readings (marked SIMULATED - replace with real readings)</label></div>
     <div class="full"><button class="btn" id="gDl" disabled>Generate and download</button></div></div></div></div>
  <div id="gMsg"></div><div id="gRev"></div>`;
  $("#gM").onchange=mode; $("#gF").onchange=note; note();
  $("#gGo").onclick=analyse; $("#gDl").onclick=generate;
  $("#gL").onchange=e=>{ const f=e.target.files[0]; if(!f){G.logo=null;return;} const r=new FileReader(); r.onload=()=>{G.logo=r.result;}; r.readAsDataURL(f); };
  if(G.D) review(); }
let REPS=[];
async function mode(){ const m=$("#gM").value; $("#gRepBox").style.display=m==="report"?"":"none"; $("#gCBox").style.display=m==="report"?"none":"";
  if(m==="report"&&!REPS.length){ const sel=$("#gR"); try{ const sb=window.QP&&QP.sb; if(!sb) throw new Error("Sign in to see your Balloon Inspector reports.");
      const {data,error}=await sb.from("bi_reports").select("id,title,part_no,rev,customer,data,updated_at").order("updated_at",{ascending:false}).limit(50); if(error) throw error; REPS=data||[];
      sel.innerHTML=REPS.length?REPS.map((r,i)=>`<option value="${i}">${esc((r.part_no||"")+" "+(r.title||"")+(r.rev?" · rev "+r.rev:""))}</option>`).join(""):'<option value="">No reports yet - balloon a drawing in Balloon Inspector and save it</option>'; }
    catch(e){ sel.innerHTML=`<option value="">${esc(e.message||"Could not load reports")}</option>`; } } }
function note(){ const f=window.PPAPDocs.FORMATS[$("#gF").value]; $("#gFn").textContent=f?f.note:""; }
function msg(t,ok){ $("#gMsg").innerHTML=t?`<div class="msg${ok?" ok":""}">${esc(t)}</div>`:""; }
async function analyse(){
  const m=$("#gM").value, c=m==="report"?null:$("#gC").files[0], p=[...$("#gP").files], rep=m==="report"&&REPS[+$("#gR").value];
  if(m==="report"&&!rep){ msg("Choose a Balloon Inspector report first."); return; }
  if(!c&&!p.length&&!rep){ msg("Choose the customer drawing and/or at least one process drawing first."); return; }
  const b=$("#gGo"); b.disabled=true; b.textContent="Reading drawings…"; msg("");
  try{ const D=await PPAPAnalyze.analyze({customer:c,process:p,mode:m,report:rep?rep.data:null,say:t=>{b.textContent=t;}});
    const co=($("#co")&&$("#co").textContent)||""; D.header=Object.assign({supplier:/loading/i.test(co)?"":co,level:"3",plant:""},D.header);
    if(/TVS/i.test(D.header.customer||"")||/^NX|^M-MI/i.test(D.header.partNo||"")) $("#gF").value="tvs"; if(/bosch/i.test(D.header.customer||"")) $("#gF").value="standard";
    G.D=D; note(); review(); $("#gDl").disabled=false;
    msg(D.notes.length&&!D.chars.length?D.notes.join(" "):(D.notes.length?D.notes.join(" ")+" ":"")+"Read "+D.chars.length+" characteristics and "+D.ops.length+" operations. Check the tables below against the drawing, correct anything missed, then download.",!D.notes.length);
  }catch(e){ msg(e.message||String(e)); } finally{ b.disabled=false; b.textContent="Analyse drawings"; } }
function tbl(id,cols,rows,addLabel){ return `<div style="overflow:auto;max-height:340px;border:1px solid var(--line);border-radius:8px"><table id="${id}" style="min-width:0;table-layout:fixed"><thead><tr>${cols.map(c=>`<th style="position:sticky;top:0;background:var(--card);width:${c[2]}%">${c[1]}</th>`).join("")}<th style="position:sticky;top:0;background:var(--card);width:5%"></th></tr></thead><tbody>${rows.map((r,i)=>`<tr>${cols.map(c=>`<td><input data-k="${c[0]}" data-i="${i}" value="${esc(r[c[0]])}" style="padding:4px 5px"></td>`).join("")}<td><button class="btn o sm" data-del="${i}" title="Delete row">✕</button></td></tr>`).join("")}</tbody></table></div><div style="margin:6px 0 14px"><button class="btn o sm" data-add="${id}">+ ${addLabel}</button></div>`; }
function review(){ const D=G.D; if(!D) return;
  $("#gRev").innerHTML=`<h3 style="margin:14px 0 6px">Part details</h3><div class="frm">${HF.map(([k,l])=>`<div><label>${l}</label><input data-h="${k}" value="${esc(D.header[k])}"></div>`).join("")}</div>
  <h3 style="margin:16px 0 6px">Operations (from the process drawings)</h3>${tbl("tOps",OH,D.ops,"Add operation")}
  <h3 style="margin:6px 0 6px">Characteristics (from the customer drawing)</h3>${tbl("tCh",CH,D.chars,"Add characteristic")}
  <p class="note">Class: KC, SC or CC for special characteristics, otherwise leave "-". Op. = the operation number that makes the characteristic; the final inspection checks all of them.</p>`;
  $("#gRev").oninput=e=>{ const t=e.target; if(t.dataset.h){ D.header[t.dataset.h]=t.value; return; } if(t.dataset.k){ const arr=t.closest("table").id==="tOps"?D.ops:D.chars, row=arr[+t.dataset.i], k=t.dataset.k; row[k]=(["nom","lsl","usl"].includes(k)&&t.value!==""&&!isNaN(+t.value))?+t.value:t.value; if(k==="desc"&&row.kind==null) row.kind="lin"; } };
  $("#gRev").onclick=e=>{ const t=e.target.closest("button"); if(!t) return; if(t.dataset.del!=null){ const arr=t.closest("table").id==="tOps"?D.ops:D.chars; arr.splice(+t.dataset.del,1); if(arr===D.chars) arr.forEach((c,i)=>c.no=String(i+1)); review(); } else if(t.dataset.add){ if(t.dataset.add==="tOps") D.ops.push({no:"",name:"",machine:""}); else D.chars.push({no:String(D.chars.length+1),desc:"",nom:"",tol:"",lsl:"",usl:"",cls:"-",method:"Digital vernier caliper",kind:"lin",op:""}); review(); } }; }
function refNo(D){ const d=new Date(), p=n=>String(n).padStart(2,"0"); return ("PPAP-"+(D.header.partNo||"PART").replace(/[^\w]+/g,"")+"-"+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"-"+Math.floor(Math.random()*36**3).toString(36).toUpperCase().padStart(3,"0")).slice(0,40); }
async function generate(){ const D=G.D; if(!D) return; const fmt=window.PPAPDocs.FORMATS[$("#gF").value]; if(!fmt||!fmt.ready){ msg("That format is not available yet."); return; }
  if(!D.header.partNo&&!D.header.partName){ msg("Enter the part name and part number first."); return; }
  const b=$("#gDl"); b.disabled=true; b.textContent="Building…"; msg("");
  try{ const o={refNo:refNo(D),sim:$("#gS").checked}, ctx={format:fmt,refNo:o.refNo,logo:G.logo,customer:D.header.customer,company:D.header.supplier};
    const sheets=fmt.build(D,o), kind=document.querySelector('input[name=gO]:checked').value, out=await PPAPRender[kind](sheets,D,ctx);
    const a=document.createElement("a"); a.href=URL.createObjectURL(out.blob); a.download=out.name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);
    msg(`Downloaded ${out.name} (${sheets.length} documents, ${fmt.label}). Reference ${o.refNo}.`,true);
  }catch(e){ console.error(e); msg(e.message||String(e)); } finally{ b.disabled=false; b.textContent="Generate and download"; } }
window.PPAPGen={draw,G};
})();
