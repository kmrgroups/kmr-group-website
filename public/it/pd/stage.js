/* =====================================================================
   Process Documents – process-wise dimension freeze and stage drawings.
   1. Freeze: the characteristics made at each operation are frozen
      (revision, date, by, reason). Any later change to the route, to which
      operation makes a characteristic, or to a specification shows as
      "changed after freeze" until the dimensions are frozen again.
   2. Stage drawings: KMR CAD Draft reads the frozen plan, draws one stage
      drawing per operation and sends it back here (pd_projects.stages).
      The SOP shows and prints them; an out-of-date one is flagged.
   ===================================================================== */
(function(){
"use strict";
const A=()=>window.PDApp, UI=window.PDUI, esc=UI.esc;
const $=id=>document.getElementById(id);
const S=()=>A().S;
const canEdit=()=>!!S().canEdit;
const SKIP=new Set(["Material","Note"]);           // general requirements, not made at one operation
const needsOp=c=>!SKIP.has(c.type);
const dmy=t=>{ if(!t) return ""; const d=new Date(t); return isNaN(d)?String(t):d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };

/* ---------------- freeze ---------------- */
function mapOf(plan){ const m={}; plan.ops.forEach(o=>{ if(o.chars&&o.chars.length) m[String(o.opNo)]=o.chars.map(Number).sort((a,b)=>a-b); }); return m; }
function specOf(plan){ const s={}; plan.chars.forEach(c=>{ s[String(c.no)]=[c.type||"",c.spec||"",c.cls||""].join(" | "); }); return s; }
/** none | frozen | changed (with the list of differences) */
function state(plan){
  const f=plan&&plan.freeze; if(!f) return {st:"none"};
  const diffs=[], now=mapOf(plan), ns=specOf(plan), fm=f.map||{}, fs=f.spec||{};
  const ops=Array.from(new Set(Object.keys(fm).concat(Object.keys(now)))).sort((a,b)=>+a-+b);
  ops.forEach(k=>{ const a=(fm[k]||[]).join(", "), b=(now[k]||[]).join(", "); if(a!==b) diffs.push(`Op ${k}: ${a?"#"+a.replace(/, /g,", #"):"nothing"} → ${b?"#"+b.replace(/, /g,", #"):"nothing"}`); });
  Array.from(new Set(Object.keys(fs).concat(Object.keys(ns)))).sort((a,b)=>+a-+b).forEach(no=>{
    if(fs[no]===ns[no]) return;
    diffs.push(fs[no]==null?`#${no} added (${ns[no]})`:ns[no]==null?`#${no} removed`:`#${no} changed: ${fs[no]} → ${ns[no]}`); });
  return diffs.length?{st:"changed",f,diffs}:{st:"frozen",f};
}
function unassigned(plan){ return plan.chars.filter(c=>needsOp(c)&&!plan.ops.some(o=>o.chars.map(Number).includes(+c.no))); }
function who(){ const u=S().user; return (u&&u.email)||"Demo user"; }

function freezeDialog(){
  const plan=S().plan; if(!plan||!canEdit()) return;
  const un=unassigned(plan), st=state(plan), rev=(plan.freeze?(+plan.freeze.rev||0):0)+1;
  if(un.length){
    A().dialog("Freeze the dimensions",`<p>Every characteristic must be made at an operation before the dimensions can be frozen. These have no operation yet:</p>
      <table class="plist"><thead><tr><th>Balloon</th><th>Characteristic</th><th>Specification</th></tr></thead><tbody>${un.map(c=>`<tr><td><b>#${esc(String(c.no))}</b></td><td>${esc(c.label||c.type||"")}</td><td>${esc(c.spec||c.text||"")}</td></tr>`).join("")}</tbody></table>
      <p class="hintline">Set the operation on the Characteristics screen (notes and the material line do not need one).</p>`,`<button class="btn" id="fzX">Close</button><button class="btn primary" id="fzGo">Open Characteristics</button>`);
    $("fzX").onclick=()=>$("dlg").remove(); $("fzGo").onclick=()=>{ $("dlg").remove(); A().go("chars"); }; return; }
  const ch=n=>plan.chars.find(c=>+c.no===+n);
  const rows=plan.ops.filter(o=>o.chars.length).map(o=>`<tr><td><b>${esc(String(o.opNo))}</b></td><td>${esc(o.name)}</td><td>${esc(o.machine||"")}</td><td>${o.chars.map(Number).sort((a,b)=>a-b).map(n=>{ const c=ch(n); return `<span title="${esc(c?(c.spec||c.text||""):"")}">#${n}${c&&c.cls?" <b>"+esc(c.cls)+"</b>":""}</span>`; }).join(", ")}</td></tr>`).join("");
  A().dialog(rev>1?`Freeze the dimensions again (rev ${rev})`:"Freeze the dimensions per operation",`<p class="hintline" style="margin-top:0">The characteristics made at each operation are frozen as <b>revision ${rev}</b>. KMR CAD Draft then makes one stage drawing per operation for the SOP. Changing the route, an operation's characteristics or a specification afterwards shows as “changed after freeze” until you freeze again.</p>
    ${st.st==="changed"?`<div class="mwarn-box" style="margin-bottom:10px"><b>Changes since rev ${esc(String(plan.freeze.rev))}:</b><br>${st.diffs.slice(0,12).map(esc).join("<br>")}${st.diffs.length>12?`<br>… and ${st.diffs.length-12} more`:""}</div>`:""}
    <div style="overflow:auto;max-height:42vh"><table class="plist"><thead><tr><th>Op</th><th>Operation</th><th>Machine</th><th>Characteristics made here</th></tr></thead><tbody>${rows}</tbody></table></div>
    <label class="fld" style="margin-top:10px">${rev>1?"Reason for the change (shown in the freeze history)":"Note (optional)"}<textarea id="fzN" rows="2" placeholder="${rev>1?"e.g. Ø40 bore moved from Op 20 to Op 30 (customer ECN 2241)":"e.g. Process route agreed in the CFT review"}"></textarea></label><div class="err" id="fzE"></div>`,
    `<button class="btn" id="fzX">Cancel</button><button class="btn primary" id="fzOk">Freeze as rev ${rev}</button>`,true);
  $("fzX").onclick=()=>$("dlg").remove();
  $("fzOk").onclick=async()=>{ const note=$("fzN").value.trim(); if(rev>1&&!note){ $("fzE").textContent="Write the reason for the change."; $("fzN").focus(); return; }
    const map=mapOf(plan), at=new Date().toISOString();
    plan.freeze={rev, at, by:who(), note, map, spec:specOf(plan)};
    plan.freezeLog=(plan.freezeLog||[]).concat([{rev, at, by:who(), note, ops:Object.keys(map).length, chars:Object.values(map).reduce((t,a)=>t+a.length,0)}]);
    $("dlg").remove(); A().changed(null); await A().save(); UI.render(S().view);
    A().toast(`Dimensions frozen as rev ${rev}. Make the stage drawings in KMR CAD Draft next.`,6000); };
}
function historyDialog(){
  const plan=S().plan, L=(plan&&plan.freezeLog)||[];
  A().dialog("Freeze history",L.length?`<table class="plist"><thead><tr><th>Rev</th><th>Date</th><th>By</th><th>Operations</th><th>Characteristics</th><th>Reason / note</th></tr></thead><tbody>${L.slice().reverse().map(x=>`<tr><td><b>${esc(String(x.rev))}</b></td><td>${esc(dmy(x.at))}</td><td>${esc(x.by||"")}</td><td>${esc(String(x.ops??""))}</td><td>${esc(String(x.chars??""))}</td><td>${esc(x.note||"")}</td></tr>`).join("")}</tbody></table>`:`<p class="hintline">Not frozen yet.</p>`,`<button class="btn" id="fhX">Close</button>`,true);
  $("fhX").onclick=()=>$("dlg").remove();
}

/* ---------------- the link to KMR CAD Draft ---------------- */
function cadHref(){
  const id=S().prj&&S().prj.id; const demo=!A().CLOUD; let slug="";
  try{ const kp=JSON.parse(localStorage.getItem("kmr-portal")||"null"); slug=(kp&&kp.slug)||""; }catch(e){}
  const q=demo?"demo=1":"kmr=1"+(slug?"&co="+encodeURIComponent(slug):"");
  return `/it/cad.html?${q}#go=stage&pd=${encodeURIComponent(id||"")}`;
}

/* ---------------- stage drawings sent by CAD Draft ---------------- */
function stages(){ const p=S().prj; return (p&&p.stages&&p.stages.ops)?p.stages:null; }
// only a picture made by CAD Draft (PNG / JPEG data) is shown or printed
const IMG=/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
function stageFor(opNo){ const s=stages(); const L=s?(s.ops[String(opNo)]||null):null; return Array.isArray(L)?L.filter(x=>x&&typeof x.img==="string"&&IMG.test(x.img)):null; }
/** "" when the stage drawings match the frozen dimensions, else the reason they are out of date */
function stale(){ const s=stages(), plan=S().plan; if(!s||!plan) return ""; const st=state(plan);
  if(st.st==="none") return "The dimensions are no longer frozen.";
  if(String(s.freezeRev)!==String(plan.freeze.rev)||(s.freezeAt&&s.freezeAt!==plan.freeze.at)) return `They were made from an earlier freeze (rev ${s.freezeRev}); the dimensions are now frozen as rev ${plan.freeze.rev} (${dmy(plan.freeze.at)}).`;
  if(st.st==="changed") return `The process plan changed after freeze rev ${plan.freeze.rev}.`;
  return ""; }
async function refresh(quiet){
  const p=S().prj; if(!p||!p.id) return false;
  let st=null;
  try{
    if(A().CLOUD){ // only the date first: the pictures are fetched when they changed
      const q=await A().sb.from("pd_projects").select("sat:stages->>at").eq("id",p.id).single(); if(q.error) throw q.error;
      const sat=q.data&&q.data.sat||null; if(sat===((p.stages&&p.stages.at)||null)){ if(!quiet) A().toast(sat?"The stage drawings are up to date with KMR CAD Draft.":"No stage drawings yet. Make them in KMR CAD Draft."); return false; }
      const {data,error}=await A().sb.from("pd_projects").select("stages").eq("id",p.id).single(); if(error) throw error; st=data&&data.stages||null; }
    else { const L=A().LS.get("pd_projects",[]), x=L.find(q=>q.id===p.id); st=x&&x.stages||null; }
  }catch(e){ if(!quiet) A().toast("Couldn't read the stage drawings: "+(/stages/.test(e.message||"")?"the database update 0070 has not been run yet.":e.message),7000); return false; }
  const before=p.stages&&p.stages.at; p.stages=st;
  const changed=(st&&st.at)!==before;
  if(changed){ UI.render(S().view); if(st&&st.at) A().toast(`Stage drawings received from KMR CAD Draft (${Object.keys(st.ops||{}).length} operations).`,5000); }
  else if(!quiet) A().toast(st?"The stage drawings are up to date with KMR CAD Draft.":"No stage drawings yet. Make them in KMR CAD Draft.");
  return changed;
}
// coming back to this tab after making the stage drawings in CAD Draft: pick them up
let busyR=false;
const onBack=async()=>{ if(document.visibilityState!=="visible"||busyR||!S().prj||!S().plan||!S().plan.freeze) return; busyR=true; try{ await refresh(true); }finally{ busyR=false; } };
document.addEventListener("visibilitychange",onBack); window.addEventListener("focus",onBack);

/* ---------------- screen pieces ---------------- */
/** the freeze bar shown on Process plan, Characteristics and SOP */
function bar(where){
  const plan=S().plan; if(!plan) return "";
  const st=state(plan), f=plan.freeze, ed=canEdit();
  const cad=`<a class="btn small" href="${esc(cadHref())}" target="_blank" rel="noopener" title="Opens KMR CAD Draft in a new tab">${stages()?"Update stage drawings in CAD":"Make stage drawings in CAD"} ↗</a>`;
  const hist=plan.freezeLog&&plan.freezeLog.length?`<button class="btn small" data-fz="hist">History</button>`:"";
  if(st.st==="none") return `<div class="frz none"><b>Dimensions not frozen.</b> <span>Freeze the characteristics made at each operation to release the route and make the stage drawings for the SOP.</span><span class="grow"></span>${ed?`<button class="btn small primary" data-fz="go">Freeze dimensions</button>`:""}</div>`;
  if(st.st==="changed") return `<div class="frz warn"><b>⚠ Changed after freeze rev ${esc(String(f.rev))}</b> <span>${esc(st.diffs.slice(0,3).join(" · "))}${st.diffs.length>3?` · +${st.diffs.length-3} more`:""}. Freeze again so the stage drawings and the SOP match.</span><span class="grow"></span>${hist}${ed?`<button class="btn small primary" data-fz="go">Freeze again (rev ${+f.rev+1})</button>`:""}</div>`;
  return `<div class="frz ok"><b>🔒 Dimensions frozen · rev ${esc(String(f.rev))}</b> <span>${esc(dmy(f.at))} · ${esc(f.by||"")}${f.note?" · "+esc(f.note):""}</span><span class="grow"></span>${hist}${where!=="sop"?cad:""}</div>`;
}
function bind(M){ M.querySelectorAll("[data-fz]").forEach(b=>b.onclick=()=>{ if(b.dataset.fz==="go") freezeDialog(); else if(b.dataset.fz==="hist") historyDialog(); else if(b.dataset.fz==="ref") refresh(false); }); }
/** the SOP's stage drawing box for one operation */
function sopBox(s){
  const plan=S().plan, list=stageFor(s.opNo), f=plan&&plan.freeze, st=stages(), why=stale();
  const op=plan&&plan.ops.find(o=>String(o.opNo)===String(s.opNo)), made=op&&op.chars&&op.chars.some(n=>{ const c=plan.chars.find(x=>+x.no===+n); return c&&needsOp(c); });
  const head=`<h3 style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Stage drawing <span class="hintline" style="font-weight:400">from KMR CAD Draft</span><span style="flex:1"></span><button class="btn small" data-fz="ref" title="Read the latest stage drawings from KMR CAD Draft">Check for new</button>${f&&state(plan).st==="frozen"?`<a class="btn small" href="${esc(cadHref())}" target="_blank" rel="noopener">${list?"Update in CAD":"Make in CAD"} ↗</a>`:""}</h3>`;
  let body;
  if(list&&list.length){
    body=(why?`<div class="mwarn-box" style="margin-bottom:8px">⚠ <b>Out of date.</b> ${esc(why)} Make the stage drawings again in KMR CAD Draft before this SOP is released.</div>`:"")
      +list.map((x,i)=>`<figure class="stg"><img src="${x.img}" alt="Stage drawing for Op ${esc(String(s.opNo))}${list.length>1?", sheet "+(i+1):""}" loading="lazy"><figcaption>Op ${esc(String(s.opNo))} · freeze rev ${esc(String(st.freezeRev))}${list.length>1?` · sheet ${i+1} of ${list.length}`:""} · made ${esc(dmy(st.at))}${st.by?" by "+esc(st.by):""}</figcaption></figure>`).join("");
  } else if(!made) body=`<p class="hintline">No ballooned dimension is made at this operation${op&&op.chars&&op.chars.length?" (only the material or notes are checked here)":""}, so it has no stage drawing.</p>`;
  else if(!f) body=`<p class="hintline">Freeze the dimensions first (Process plan › <b>Freeze dimensions</b>), then make the stage drawings in KMR CAD Draft.</p>`;
  else if(state(plan).st==="changed") body=`<p class="hintline">The plan changed after freeze rev ${esc(String(f.rev))}. Freeze the dimensions again, then make the stage drawings.</p>`;
  else body=`<p class="hintline">No stage drawing yet. Use <b>Make in CAD</b> — KMR CAD Draft draws one per operation from the frozen dimensions and sends them back here.</p>`;
  return `<div class="box" style="margin:10px 0">${head}${body}</div>`;
}
/** export blocks for one SOP section (PDF / Excel) */
function blocks(s){
  const list=stageFor(s.opNo), st=stages(); if(!list||!list.length) return [];
  const why=stale(), out=[];
  list.forEach((x,i)=>{ out.push({kind:"label",text:`Stage drawing – Op ${s.opNo}${list.length>1?` (sheet ${i+1} of ${list.length})`:""} · freeze rev ${st.freezeRev}${why?"  ·  OUT OF DATE – make it again in KMR CAD Draft":""}`}); out.push({kind:"image",src:x.img,stage:true}); });
  return out;
}

window.PDStage={state, unassigned, freezeDialog, historyDialog, bar, bind, sopBox, blocks, stageFor, stale, refresh, cadHref};
})();
