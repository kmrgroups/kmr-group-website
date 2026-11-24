/* Reads customer / process drawings in the browser (PDF text layer; scanned images go through Balloon Inspector) and returns a PPAP data set. */
(function(){
const PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", WORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
function load(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Could not load the PDF reader. Check the internet connection."));document.head.appendChild(s);});}
async function pdfText(file){
  if(!window.pdfjsLib) await load(PDFJS); pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise, out=[];
  for(let p=1;p<=Math.min(pdf.numPages,10);p++){ const pg=await pdf.getPage(p), tc=await pg.getTextContent(), v=pg.getViewport({scale:1});
    const it=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str.replace(/\s+/g," ").trim(),x:i.transform[4],y:v.height-i.transform[5],h:Math.abs(i.transform[3])||8}));
    out.push({w:v.width,h:v.height,items:it}); }
  return out; }
/* join items sitting on the same line, left to right */
function lines(pages){ const L=[]; pages.forEach(pg=>{ const its=pg.items.slice().sort((a,b)=>a.y-b.y||a.x-b.x), rows=[];
  its.forEach(i=>{ const r=rows.find(r=>Math.abs(r.y-i.y)<Math.max(2.5,i.h*0.45)); if(r) r.a.push(i); else rows.push({y:i.y,a:[i]}); });
  rows.sort((a,b)=>a.y-b.y).forEach(r=>{ r.a.sort((a,b)=>a.x-b.x); L.push(r.a.map(i=>i.s).join(" ")); }); }); return L; }

/* Scanned drawings have no text inside: read them with Balloon Inspector's own reader, run invisibly in this page. */
function viaBalloon(file,say){ return new Promise(async(res,rej)=>{
  const f=document.createElement("iframe"); f.setAttribute("aria-hidden","true"); f.style.cssText="position:fixed;left:-3000px;top:0;width:1400px;height:900px;border:0;visibility:hidden"; f.src="/it/balloon.html?demo=1";
  const done=(fn,v)=>{ try{f.remove();}catch(e){} fn(v); };
  try{
    document.body.appendChild(f); const t0=Date.now(); let W=null;
    while(Date.now()-t0<90000){ await new Promise(r=>setTimeout(r,500)); try{ W=f.contentWindow; if(W&&W.BI&&W.BI.loadFile&&W.document.getElementById("busy")) break; }catch(e){} W=null; }
    if(!W) return done(rej,new Error("The drawing reader did not start. Open Balloon Inspector once, then try again."));
    say&&say("Reading "+file.name+" (about a minute for a scanned sheet)…");
    await W.BI.loadFile(file); const t1=Date.now(); let seen=false, idle=0;
    while(Date.now()-t1<420000){ await new Promise(r=>setTimeout(r,1000)); const b=W.document.getElementById("busy").classList.contains("show"), n=W.BI.S.items.length;
      if(b||n) seen=true; idle=b?0:idle+1; if(seen&&idle>=3) break; if(!seen&&Date.now()-t1>25000) break; }
    const S=W.BI.S, words=[]; (S.sheets||[]).forEach(sh=>(sh.text||[]).forEach(w=>words.push({s:w.s,x:w.x,y:w.y,h:w.h||10})));
    done(res,{header:Object.assign({},S.header),items:(S.items||[]).map(i=>Object.assign({},i)),words});
  }catch(e){ done(rej,e); } }); }
const ITYPE={Diameter:"dia",Linear:"lin","Surface finish":"ra",Thread:"thr",Angle:"ang","GD&T":"gdt",Radius:"lin",Chamfer:"lin"};
function itemsToDims(items){ const f=n=>Math.round(n*1e4)/1e4, out=[];
  items.filter(i=>i.type!=="Note"&&i.type!=="Material"&&ITYPE[i.type]).sort((a,b)=>a.id-b.id).forEach(i=>{ const kind=ITYPE[i.type], nom=i.nominal, tol=(i.upper==null&&i.lower==null)?"":(Math.abs(i.upper)===Math.abs(i.lower)?"±"+Math.abs(i.upper):(i.upper>0?"+":"")+i.upper+"/"+(i.lower>0?"+":"")+i.lower);
    const d={kind,nom:nom==null?"":nom,tol,lsl:(nom!=null&&i.lower!=null)?f(nom+i.lower):"",usl:kind==="ra"||kind==="gdt"?(i.upper==null?"":i.upper):(nom!=null&&i.upper!=null?f(nom+i.upper):""),cls:i.cls||"-",method:i.instr||"",text:i.text};
    d.desc=kind==="dia"?"Diameter Ø"+nom:kind==="ra"?"Surface finish "+(i.text||""):kind==="thr"?"Thread "+(i.text||""):kind==="gdt"?"GD&T "+(i.text||""):kind==="ang"?"Angle "+nom:"Dimension "+nom;
    if(kind==="thr"||kind==="gdt") d.tol=i.text||""; out.push(d); });
  return out; }
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
function after(L,labels,stop){ // value following a title-block label, same line or the next item
  for(let i=0;i<L.length;i++){ for(const lb of labels){ const m=L[i].match(new RegExp("(?:^|\\s)"+lb+"\\s*[:.\\-–]?\\s*(.*)$","i")); if(m){ let v=clean(m[1]); if(v&&!(stop&&stop.test(v))) return v; if(L[i+1]&&!(stop&&stop.test(L[i+1]))) return clean(L[i+1]); } } } return ""; }
const NUM="(\\d+(?:\\.\\d+)?)";
/* dimensions with tolerance found in the drawing text */
function dims(L){
  const out=[], seen=new Set(), push=(o)=>{ const k=o.desc+"|"+o.nom+"|"+o.lsl+"|"+o.usl; if(seen.has(k)) return; seen.add(k); out.push(o); };
  const f=n=>Math.round(n*1e4)/1e4;
  L.forEach(raw=>{ const t=raw.replace(/[⌀Φφ∅]/g,"Ø").replace(/\u00b1/g,"±");
    let m;
    const rx1=new RegExp("(Ø\\s*)?"+NUM+"\\s*(?:±|\\+\\s*/\\s*-)\\s*"+NUM,"g");
    while((m=rx1.exec(t))){ const n=+m[2], tl=+m[3]; if(n<=0||tl>n) continue; push({kind:m[1]?"dia":"lin",nom:n,lsl:f(n-tl),usl:f(n+tl),tol:"±"+m[3]}); }
    const rx2=new RegExp("(Ø\\s*)?"+NUM+"\\s*\\+\\s*"+NUM+"\\s*[/ ]?\\s*-\\s*"+NUM,"g");
    while((m=rx2.exec(t))){ const n=+m[2], u=+m[3], l=+m[4]; if(n<=0) continue; push({kind:m[1]?"dia":"lin",nom:n,lsl:f(n-l),usl:f(n+u),tol:"+"+m[3]+"/-"+m[4]}); }
    const rx3=new RegExp("(Ø\\s*)?"+NUM+"\\s*\\(?\\s*(-)?\\s*0\\s*\\.\\s*0+\\s*\\)?\\s*\\+\\s*"+NUM,"g");
    const rx4=/\bRa\s*([\d.]+)/gi; while((m=rx4.exec(t))) push({kind:"ra",nom:+m[1],lsl:"",usl:+m[1],tol:"Ra max"});
    const rx5=/\bM(\d{1,2})(?:\s*[xX×]\s*([\d.]+))?(?:\s*-\s*\d[HG6]\w*)?/g; while((m=rx5.exec(t))) if(/thread|tap|\bM\d/i.test(t)) push({kind:"thr",nom:+m[1],lsl:"",usl:"",tol:m[0].trim()});
  });
  return out; }
function describe(d,i,all){ const n=all.filter(x=>x.kind===d.kind).indexOf(d)+1;
  return d.kind==="dia"?"Diameter Ø"+d.nom+(n>1?" ("+n+")":""):d.kind==="ra"?"Surface finish Ra "+d.nom:d.kind==="thr"?"Thread "+d.tol:"Dimension "+d.nom+(n>1?" ("+n+")":""); }
async function readCustomer(file,say){
  let L=[], bal=null; try{ L=lines(await pdfText(file)); }catch(e){}
  if(L.length<12){ bal=await viaBalloon(file,say); L=lines([{items:bal.words}]); }
  const all=L.join(" | "), g={};
  g.partNo=after(L,["PART\\s*N(?:O|UMBER)\\.?","PART\\s*NO\\.?","DRG\\.?\\s*NO","DRAWING\\s*N(?:O|UMBER)"],/^(name|desc)/i);
  g.partName=after(L,["PART\\s*NAME","DESCRIPTION","TITLE"],/^(part|no|material)\b/i);
  g.material=after(L,["MATERIAL","MATL","RM\\s*GRADE"],/^(part|no|sheet|scale)\b/i);
  g.rev=after(L,["REV(?:ISION)?\\.?","ISSUE","LEVEL","ECN"],/^(date|part)\b/i);
  g.weight=(all.match(/(?:WEIGHT|WT)\s*[:.\-]?\s*([\d.]+)\s*(?:kg|g)?/i)||[])[1]||"";
  g.customer=/TVS/i.test(all)?"TVS Motor Company Ltd":/BOSCH/i.test(all)?"Robert Bosch":/\bSEG\b/i.test(all)?"SEG Automotive":/NORTON/i.test(all)?"Norton Motorcycles":"";
  if(!g.partNo){ const m=all.match(/\b([A-Z]{1,3}-?[A-Z]{0,3}-?\d{3,}[A-Z0-9-]*)\b/); g.partNo=m?m[1]:""; }
  let ds; if(bal){ ds=itemsToDims(bal.items); Object.keys(bal.header||{}).forEach(k=>{ if(bal.header[k]&&["partNo","partName","drawingNo","rev","customer","material"].includes(k)) g[k]=bal.header[k]; }); if(!g.rev&&bal.header.rev) g.rev=bal.header.rev; }
  else { ds=dims(L); ds.forEach((d,i)=>d.desc=describe(d,i,ds)); }
  return {header:g,dims:ds,lineCount:L.length||1,lines:L,viaOcr:!!bal}; }
async function readProcess(file,say){
  const nm=file.name.replace(/\.[^.]+$/,""); let opNo=(nm.match(/OP[\s_\-]*(\d+)/i)||[])[1]||"";
  let L=[], bal=null; try{ L=lines(await pdfText(file)); }catch(e){}
  if(L.length<12){ bal=await viaBalloon(file,say); L=lines([{items:bal.words}]); }
  const all=L.join(" | ");
  if(!opNo) opNo=(all.match(/\bOP(?:ERATION)?\.?\s*(?:NO\.?)?\s*[:\-]?\s*(\d{1,3})\b/i)||[])[1]||"";
  const KW=[["Coating|CED|Powder|Paint|Plating","CED & Powder Coating (outsourced)"],["Final\\s*Insp|Pre[- ]?delivery|Dispatch","Final Inspection"],["Inward","Raw Material Inward Inspection"],["Sawing|Cut[- ]?off","Sawing"],["Facing","Facing & Turning"],["Turning","Turning"],["Drilling","Drilling"],["Boring","Boring"],["Milling","Milling"],["Grinding","Grinding"],["Thread(?:ing)?","Threading"],["Tapping","Tapping"],["Chamfer","Chamfering"],["Parting","Parting"],["Broach","Broaching"],["Deburr","Deburring"],["Wash","Washing"],["Final\\s*Insp","Final Inspection"],["Packing","Packing"]];
  const mc=(all.match(/M\/?c\s*Name:?\s*([A-Za-z0-9 \-\/]{3,28}?)(?=\s+Work|\s*\||$)/i)||[])[1]||"";
  const mach=clean(mc).replace(/\s+(Wor\w*|Ho\w*|W\w{0,3})\b.*$/i,"").replace(/\s+\d+$/,"")||((all.match(/\b(CNC\s*(?:Turning|Lathe|Turn-?Mill|Sawing)?|VMC|HMC|Lathe|Manual)\b/i)||[])[1]||"");
  let name=""; for(const k of KW){ if(k[1].startsWith("Raw")&&+opNo>10) continue; if(new RegExp("\\b(?:"+k[0]+")","i").test(all)){ name=k[1]; break; } }
  if(!name) name=mach&&!/^(manual|na|n\/a)$/i.test(mach)?mach+" operation":"Operation "+opNo;
  let ds; if(bal) ds=itemsToDims(bal.items); else { ds=dims(L); ds.forEach((d,i)=>d.desc=describe(d,i,ds)); }
  return {lines:L,no:opNo?String(+opNo):"",name:clean(name).slice(0,80),machine:clean(mach).replace(/^(na|n\/a)$/i,""),dims:ds,file:file.name}; }
async function analyze({customer,process,say}){
  const D={header:{},chars:[],ops:[],notes:[]};
  if(customer){ const c=await readCustomer(customer,say); D.header=c.header;
    const meth=d=>d.method||(d.kind==="ra"?"Surface roughness tester":d.kind==="thr"?"Thread plug gauge":d.kind==="dia"?"Digital vernier / bore gauge":"Digital vernier caliper");
    c.dims.forEach((d,i)=>D.chars.push({no:String(i+1),desc:d.desc,nom:d.nom,tol:d.tol,lsl:d.lsl,usl:d.usl,cls:d.cls||"-",method:meth(d),kind:d.kind}));
    D.customerLines=c.lines;
    if(!c.lineCount) D.notes.push("The customer drawing has no readable text (scanned image). Open it in Balloon Inspector to read the dimensions, then add them here."); else if(!c.dims.length) D.notes.push("No dimensions with tolerances were found in the customer drawing. Add the characteristics below."); }
  const ops=[]; for(const f of (process||[])) ops.push(await readProcess(f,say));
  const pl=ops.flatMap(o=>o.lines||[]).join(" | "), H=D.header, fill=(k,v)=>{ if(v&&!H[k]) H[k]=clean(v); };
  const cpn=(pl+" "+(D.customerLines||[]).join(" ")).match(/\b(NX\d{6}|[A-Z]{2}\d{7})\b/); if(cpn&&H.partNo!==cpn[1]){ const dn=H.partNo; H.partNo=cpn[1]; if(dn&&!H.supplierPartNo) H.supplierPartNo=dn; }
  fill("supplierPartNo",(pl.match(/Deno\s*Part\s*No\.?:?\s*([A-Z]{1,3}-?[A-Z]{0,3}-?[A-Z0-9]{3,6})/i)||[])[1]);
  const pn=(pl.match(/Part\s*\\?\w{2,4}\s*:\s*([A-Z][A-Z ]{5,28}[A-Z])\b/)||[])[1]; if(pn&&(!H.partName||H.partName.length<5||!/[A-Z]{3}/.test(H.partName))) H.partName=clean(pn.replace(/\s+(Operation|Work|Cus).*$/i,"")).replace(/\b(\w)(\w*)/g,(m,a,b)=>a+b.toLowerCase());
  fill("material",(pl.match(/\b(SAE\s*\d{3,4}|EN\s*\d{1,2}|10C4|C\d{2}\b)/i)||[])[1]);
  fill("rev",(pl.match(/Cus\s*Rev\s*\\?\w{0,2}:?\s*([0-9]{1,2}\s?[a-zA-Z]?)\b/)||[])[1]);
  if(customer){ const base=customer.name.replace(/\.[^.]+$/,""); if(!H.drawingNo||H.drawingNo===base||H.drawingNo.includes(base)) H.drawingNo=H.partNo||""; }
  if(H.rev&&!/^[A-Za-z]?\d{1,2}\s?[a-zA-Z]?$/.test(H.rev)) H.rev="";
  ops.sort((a,b)=>(+a.no||999)-(+b.no||999)); D.ops=ops.map(o=>({no:o.no,name:o.name,machine:o.machine,file:o.file,dims:o.dims,lines:o.lines}));
  /* a dimension in a process drawing that is not on the customer drawing is added as a process characteristic */
  D.ops.forEach(o=>{ o.dims.forEach(d=>{ if(!D.chars.some(c=>c.nom===d.nom&&c.lsl===d.lsl&&c.usl===d.usl&&c.kind===d.kind)){ if(!customer) D.chars.push({no:String(D.chars.length+1),desc:d.desc,nom:d.nom,tol:d.tol,lsl:d.lsl,usl:d.usl,cls:"-",method:"Digital vernier caliper",kind:d.kind,op:o.no}); } }); });
  D.chars.forEach(c=>{ if(!c.op){ const o=D.ops.find(o=>o.dims.some(d=>d.nom===c.nom&&d.lsl===c.lsl&&d.usl===c.usl&&d.kind===c.kind)); c.op=o?o.no:""; } });
  D.ops.forEach(o=>{ delete o.dims; });
  D.chars.forEach((c,i)=>c.no=String(i+1));
  return D; }
window.PPAPAnalyze={analyze};
})();
