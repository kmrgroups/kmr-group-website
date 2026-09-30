/* =====================================================================
   Process Documents – application: sign-in, workspaces, projects,
   automation pipeline, save/autosave, admin panel, Balloon Inspector link.
   ===================================================================== */
(function(){
"use strict";
const CFG=window.PD_CONFIG||{}, E=window.PDEngine, D=window.PDDocs, SC=window.PDSchema, UI=window.PDUI;
const $=id=>document.getElementById(id);
const esc=UI.esc;
const DBREF=((CFG.supabaseUrl||"").replace(/^https?:\/\//,"").split(".")[0])||"local";
const LS={ key:k=>k+"@"+DBREF, get(k,d){ try{ const v=localStorage.getItem(LS.key(k)); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(LS.key(k),JSON.stringify(v)); }catch(e){} } };
const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
const sb = CLOUD ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

const S = { user:null, org:null, role:null, platform:false, memberships:[], settings:{}, masters:{machines:[],gauges:[],customers:[],consumables:[]}, machines:E.DEFAULT_MACHINES,
  prj:null, plan:null, docs:null, view:"overview", canEdit:false, dirty:false, list:[] };

/* ---------------- small UI helpers ---------------- */
function toast(m,ms=4200){ const t=$("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),ms); }
function busy(m){ let b=$("busy"); if(!m){ if(b) b.remove(); return; } if(!b){ b=document.createElement("div"); b.id="busy"; b.className="busy"; document.body.appendChild(b); } b.innerHTML=`<div><span class="spin"></span>${esc(m)}</div>`; }
function dialog(title, body, foot, wide){ closeDialog(); const v=document.createElement("div"); v.className="veil"; v.id="dlg"; v.innerHTML=`<div class="dlg${wide?" wide":""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="hd"><h2>${esc(title)}</h2><button class="icon-btn" id="dlgX" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="bd">${body}</div>${foot?`<div class="ft">${foot}</div>`:""}</div>`;
  document.body.appendChild(v); $("dlgX").onclick=closeDialog; v.addEventListener("pointerdown",e=>{ if(e.target===v) closeDialog(); }); return v; }
function closeDialog(){ const d=$("dlg"); if(d) d.remove(); }
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeDialog(); hideMenus(); } });
function hideMenus(){ ["newMenu","expMenu","userMenu"].forEach(id=>$(id).hidden=true); }
document.addEventListener("pointerdown",e=>{ if(!e.target.closest(".menu")) hideMenus(); });
function menu(btn, pop, items){ $(btn).onclick=()=>{ const p=$(pop), open=p.hidden; hideMenus(); if(!open) return; p.innerHTML=items().map(i=>i==="-"?"<hr>":`<button data-i="${i.id}" ${i.disabled?"disabled":""}>${i.icon||""}<span>${esc(i.label)}${i.sub?`<small>${esc(i.sub)}</small>`:""}</span></button>`).join(""); p.hidden=false;
  p.onclick=e=>{ const b=e.target.closest("[data-i]"); if(!b) return; hideMenus(); const it=items().find(x=>x.id===b.dataset.i); if(it&&it.run) it.run(); }; }; }

function setFavicon(href){ if(!href) return; document.querySelectorAll("link[rel~=icon]").forEach(l=>l.remove()); const l=document.createElement("link"); l.rel="icon"; l.href=href; document.head.appendChild(l); }
/* pick one option from a list – replaces the browser's plain prompt() boxes */
function pick(title, options, opts={}){ return new Promise(res=>{
  const v=dialog(title,`${opts.hint?`<p class="hintline" style="margin-top:0">${esc(opts.hint)}</p>`:""}<label class="fld">${esc(opts.label||"Choose")}<select id="pkS" size="1">${options.map(o=>`<option value="${esc(o[0])}"${o[0]===opts.value?" selected":""}>${esc(o[1])}</option>`).join("")}</select></label>`,
    `<button class="btn" id="pkC">Cancel</button><button class="btn primary" id="pkO">${esc(opts.ok||"OK")}</button>`);
  let done=false; const fin=x=>{ if(done) return; done=true; closeDialog(); res(x); };
  $("pkO").onclick=()=>fin($("pkS").value); $("pkC").onclick=()=>fin(null); $("dlgX").onclick=()=>fin(null);
  new MutationObserver((m,o)=>{ if(!document.body.contains(v)){ o.disconnect(); fin(null); } }).observe(document.body,{childList:true});
  $("pkS").focus(); }); }

/* ---------------- side panel: hide / show ---------------- */
function applySide(min){ document.body.classList.toggle("side-min",!!min); const a=document.getElementById("sideArrow"); if(a) a.setAttribute("d",min?"M13 10l2 2-2 2":"M15 10l-2 2 2 2"); }
applySide(LS.get("pd_side_min",false));
document.getElementById("bSide").onclick=()=>{ const n=!document.body.classList.contains("side-min"); LS.set("pd_side_min",n); applySide(n); };
document.addEventListener("keydown",e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="b"&&!e.target.closest("input,textarea,select")){ e.preventDefault(); document.getElementById("bSide").click(); } });

/* ---------------- theme ---------------- */
function applyTheme(t){ if(t) document.documentElement.setAttribute("data-theme",t); else document.documentElement.removeAttribute("data-theme"); }
applyTheme(LS.get("pd_theme",null));

/* ======================================================================
   SIGN-IN
   ====================================================================== */
function loginArt(){
  const nodes=[["Drawing",90,120],["Balloons",250,70],["Process",410,130],["PFD",150,270],["PFMEA",320,250],["Control Plan",470,300],["SOP",110,420],["Reports",280,410],["SPC · MSA",450,450]];
  const links=[[0,1],[1,2],[2,4],[1,3],[3,4],[4,5],[5,8],[3,6],[6,7],[7,8],[2,5]];
  return `<svg viewBox="0 0 560 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><pattern id="gr" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(255,255,255,.07)"/></pattern>
    <radialGradient id="gl" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#3B7BEA" stop-opacity=".45"/><stop offset="1" stop-color="#0B1830" stop-opacity="0"/></radialGradient></defs>
    <rect width="560" height="560" fill="url(#gr)"/><rect width="560" height="560" fill="url(#gl)"/>
    ${links.map(([a,b],i)=>`<line x1="${nodes[a][1]}" y1="${nodes[a][2]}" x2="${nodes[b][1]}" y2="${nodes[b][2]}" stroke="#8FB3F5" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="5 7"><animate attributeName="stroke-dashoffset" from="24" to="0" dur="${1.4+i%3*0.4}s" repeatCount="indefinite"/></line>`).join("")}
    ${nodes.map(([t,x,y],i)=>`<g transform="translate(${x} ${y})"><circle r="30" fill="rgba(255,255,255,.08)" stroke="#BFD3F8" stroke-opacity=".7"><animate attributeName="r" values="28;32;28" dur="${3+i%4*0.5}s" repeatCount="indefinite"/></circle>
      <rect x="-11" y="-14" width="22" height="26" rx="3" fill="#fff" fill-opacity=".92"/><path d="M-6 -6h12M-6 -1h12M-6 4h8" stroke="#1D5FD0" stroke-width="1.8" stroke-linecap="round"/>
      <text y="50" text-anchor="middle" fill="#E6EEFB" font-size="13" font-family="Barlow, Arial" font-weight="600">${t}</text></g>`).join("")}</svg>`;
}
async function brandForLogin(){ let b=LS.get("pd_brand",null);
  if(CLOUD){ try{ const qc=new URLSearchParams(location.search).get("c"); const {data}=await sb.rpc("pd_public_brand",qc&&/^[0-9a-f-]{36}$/i.test(qc)?{p_org:qc}:{}); if(data&&data[0]&&(data[0].logo||data[0].name)) b=data[0]; }catch(e){} }
  return b; }
async function loginScreen(msg){
  if (window.KMR_SSO && window.KMR_SSO.active) return window.KMR_SSO.toPortal(msg);   // one login: the KMR Apps page
  let w=$("lg"); if(!w){ w=document.createElement("div"); w.id="lg"; w.className="lg-wrap"; document.body.appendChild(w); }
  const pw=CFG.poweredBy||null;
  w.innerHTML=`<div class="lg-vis"><div class="art">${loginArt()}</div><div class="cap"><h2>From ballooned drawing to a complete PPAP document set</h2><p>PFD, PFMEA, Control Plan, SOP, inspection reports, SPC and MSA, built for IATF 16949 and the AIAG core tools.</p></div></div>
  <form class="lg-form" id="lgF" autocomplete="on"><div class="co" id="lgCo"></div><h1>${esc(CFG.appName||"Process Documents")}</h1><p class="sub">Sign in with the account your company admin created for you.</p>
    <label>E-mail<input id="lgE" type="email" autocomplete="username" required></label>
    <label>Password<div class="pw"><input id="lgP" type="password" autocomplete="current-password" required><button type="button" class="eye" id="lgEye" aria-label="Show password" aria-pressed="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div></label>
    <div class="err" id="lgErr">${esc(msg||"")}</div><button class="go" type="submit">Sign in</button>
    <div style="display:flex;justify-content:space-between;margin-top:8px"><button type="button" class="lnk" id="lgForgot">Forgot password?</button>${CFG.balloonUrl?`<a class="lnk" href="${esc(CFG.balloonUrl)}" style="text-decoration:none">Balloon Inspector →</a>`:""}</div>
    ${pw?`<div class="pow">Powered by <a href="${esc(pw.url||"#")}" target="_blank" rel="noopener">${esc(pw.name||"")}</a></div>`:""}</form>`;
  const b=await brandForLogin(); if(b&&b.logo) setFavicon(b.logo); if(b&&b.name) document.title=(CFG.appName||"Process Documents")+" – "+b.name; if(b){ $("lgCo").innerHTML=b.logo?`<img src="${b.logo}" alt="${esc(b.name||"")} logo">`:`<b style="font:700 20px var(--display)">${esc(b.name||"")}</b>`; }
  $("lgEye").onclick=()=>{ const p=$("lgP"), s=p.type==="password"; p.type=s?"text":"password"; $("lgEye").setAttribute("aria-pressed",String(s)); };
  $("lgF").onsubmit=async e=>{ e.preventDefault(); $("lgErr").textContent=""; const {error}=await sb.auth.signInWithPassword({email:$("lgE").value.trim(),password:$("lgP").value}); if(error){ $("lgErr").textContent=/Invalid login/i.test(error.message)?"Wrong e-mail or password.":error.message; return; } w.remove(); start(); };
  $("lgForgot").onclick=async()=>{ const em=$("lgE").value.trim(); if(!em){ $("lgErr").textContent="Type your e-mail first."; return; } const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.href.split("#")[0].split("?")[0]}); $("lgErr").textContent=error?error.message:"If that e-mail has an account, a reset link is on its way."; };
}
function newPasswordScreen(){
  dialog("Set a new password",`<label class="fld">New password (8+ characters)<input id="npP" type="password" autocomplete="new-password"></label><div class="err" id="npE"></div>`,`<button class="btn primary" id="npS">Save password</button>`);
  $("npS").onclick=async()=>{ const v=$("npP").value; if(v.length<8){ $("npE").textContent="Use at least 8 characters."; return; } const {error}=await sb.auth.updateUser({password:v}); if(error){ $("npE").textContent=error.message; return; } closeDialog(); toast("Password changed."); };
}

/* ======================================================================
   START
   ====================================================================== */
async function start(){
  if(!CLOUD){ return startLocal(); }
  const {data:{user}}=await sb.auth.getUser(); S.user=user; if(!user){ loginScreen(); return; }
  const email=(user.email||"").toLowerCase();
  const [{data:mem,error:e1},{data:pa}]=await Promise.all([ sb.from("pd_members").select("org_id,role,pd_orgs(id,name,logo,settings)").eq("email",email), sb.from("pd_platform_admins").select("user_id").eq("user_id",user.id) ]);
  if(e1){ loginScreen("Couldn't reach the database: "+e1.message+". Has supabase/pd-schema.sql been run?"); return; }
  S.platform=!!(pa&&pa.length); S.memberships=(mem||[]).filter(m=>m.pd_orgs).map(m=>({role:m.role,...m.pd_orgs}));
  // Opened from a customer's KMR Apps page: show ONLY that customer's workspace
  try {
    const kp=JSON.parse(localStorage.getItem("kmr-portal")||"null");
    if(kp&&kp.slug&&/[?&]kmr=1(&|$)/.test(location.search)){
      const ws=await sb.rpc("kmr_portal_workspace",{p_slug:kp.slug,p_product:"pd"});
      if(!ws.error&&ws.data) S.memberships=S.memberships.filter(m=>m.id===ws.data);
    }
  } catch(e){}
  // KMR Console licence: keep only workspaces whose licence is valid (the database enforces this too)
  const acc=await sb.rpc("kmr_access",{p_product:"pd"});
  if(!acc.error && !S.platform){
    const okIds=new Set((acc.data||[]).filter(a=>a.ok).map(a=>a.org_id));
    const paused=S.memberships.filter(m=>!okIds.has(m.id));
    S.memberships=S.memberships.filter(m=>okIds.has(m.id));
    if(!S.memberships.length && paused.length){
      const a=(acc.data||[]).find(x=>x.org_id===paused[0].id)||{};
      dialog("Access paused",`<p>${esc(a.message||"Your company's access is paused.")}</p><p>Your company's documents are safe and will be available again as soon as the licence is renewed. Please contact KMR Group of Companies — <a href="https://www.kmr-groups.com/contact" target="_blank" rel="noopener">www.kmr-groups.com/contact</a>.</p>`,`<button class="btn" id="noOut2">Sign out</button>`); $("noOut2").onclick=signOut; return; }
  }
  if(!S.memberships.length && !S.platform){ dialog("No workspace yet",`<p>You're signed in as <b>${esc(email)}</b>, but no Process Documents workspace has added this e-mail yet. Ask your company admin to add you under Admin → Users.</p>`,`<button class="btn" id="noOut">Sign out</button>`); $("noOut").onclick=signOut; return; }
  const last=LS.get("pd_org",null); const pick=S.memberships.find(m=>m.id===last)||S.memberships[0];
  if(pick) await chooseOrg(pick.id); else { S.org=null; S.role=null; brand(); nav(); bindTop(); openAdmin("workspaces"); return; }
  const q=new URLSearchParams(location.search).get("project"); if(q) openProject(q);
}
function startLocal(){
  const L=LS.get("pd_local",null)||{}; S.settings=L.settings||{companyName:"My Company"}; S.masters=Object.assign({machines:[],gauges:[],customers:[],consumables:[]},L.masters||{});
  S.machines=machinesInUse(); S.org={id:"local",name:S.settings.companyName||"My Company",logo:L.logo||null,settings:S.settings};
  S.role="admin"; S.canEdit=true; S.list=LS.get("pd_projects",[]); $("demoTag").hidden=false; brand(); nav(); bindTop(); UI.render("overview");
  if(new URLSearchParams(location.search).get("sample")==="1") newFromSource(JSON.parse(JSON.stringify(window.PD_SAMPLE)),null);
}
async function chooseOrg(id){
  if(S.dirty && !(await flushSave())) {}
  const m=S.memberships.find(x=>x.id===id); S.org=m; S.role=m.role; S.canEdit=m.role==="admin"||m.role==="editor"; LS.set("pd_org",id);
  S.settings=Object.assign({companyName:m.name},m.settings||{});
  const {data}=await sb.from("pd_masters").select("kind,items").eq("org_id",id);
  S.masters={machines:[],gauges:[],customers:[],consumables:[]}; (data||[]).forEach(r=>S.masters[r.kind]=r.items||[]);
  await loadOpsMasters(id);
  S.machines=machinesInUse();
  S.prj=null; S.plan=null; S.docs=null; LS.set("pd_brand",{name:m.name,logo:m.logo});
  brand(); nav(); bindTop(); UI.render("overview");
}
/* KMR platform: machines, gauges, customers and parts come from KMR Apps › Operations Master (kept once per company).
   The workspace's own lists stay as a fallback for any list the Operations Master does not have yet. */
async function loadOpsMasters(orgId){
  S.ops=null; S.ownMasters=JSON.parse(JSON.stringify(S.masters));
  try{
    const r=await sb.rpc("kmr_pd_masters",{p_org:orgId});
    if(r.error||!r.data) return;
    S.ops={linked:true,parts:r.data.parts||[]};
    ["machines","gauges","customers","consumables"].forEach(k=>{ S.masters[k]=r.data[k]||[]; S.ops[k]=true; });
    S.masters.strict=true;
  }catch(e){ S.ops=null; }
}
function machinesInUse(){ return S.masters.strict ? (S.masters.machines||[]) : (S.masters.machines.length?S.masters.machines:E.DEFAULT_MACHINES); }
function opsPortalLink(){ let kp=null; try{ kp=JSON.parse(localStorage.getItem("kmr-portal")||"null"); }catch(e){} return (kp&&kp.slug?"/it/app/"+encodeURIComponent(kp.slug):"/it/apps.html")+"#ops"; }
function partFromOps(h){
  const n=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const pt=S.ops&&S.ops.parts&&h.partNo?S.ops.parts.find(x=>n(x.partNo)===n(h.partNo)):null; if(!pt) return h;
  return Object.assign({},h,{partName:h.partName||pt.partName,drawingNo:h.drawingNo||pt.drawingNo,rev:h.rev||pt.rev,material:h.material||pt.material,customer:h.customer||pt.customer});
}
async function signOut(){ if(S.dirty) await flushSave(); if(CLOUD) await sb.auth.signOut(); location.href=location.pathname; }

/* ---------------- brand + nav ---------------- */
function brand(){
  const o=S.org, b=$("brand");
  b.innerHTML=`${o&&o.logo?`<img class="logo" src="${o.logo}" alt="">`:`<div class="mark"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M7 8h10M7 12h10M7 16h6"/></svg></div>`}<div><h1>${esc(CFG.appName||"Process Documents")}</h1><small>${esc(o?o.name:"APQP · PPAP · IATF 16949")}</small></div>`;
  if(o&&o.logo) setFavicon(o.logo); document.title=(CFG.appName||"Process Documents")+(o?" – "+o.name:"");
}
function refreshChip(){
  const c=$("projChip"), st=$("projStatus");
  if(!S.prj){ c.hidden=true; st.hidden=true; $("bSave").hidden=true; $("bExport").hidden=true; return; }
  const h=S.plan.header; c.hidden=false; st.hidden=false; c.innerHTML=`<b>${esc(h.partNo||"—")}</b> ${esc(h.partName||"")} ${h.drawingRev?"· Rev "+esc(h.drawingRev):""}`;
  st.textContent=({received:"Received",generated:"Generated",in_review:"In review",approved:"Approved"})[S.prj.status]||S.prj.status; st.className="status "+S.prj.status;
  $("bSave").hidden=!S.canEdit; $("bExport").hidden=false; saveState();
}
function nav(){
  const side=$("side");
  if(!S.prj){ side.innerHTML=`<h4>Start</h4><div class="nav"><button data-go="home" aria-current="page"><span class="code">HOME</span>Welcome</button><button data-go="projects"><span class="code">ALL</span>Projects</button></div>`; }
  else {
    const ed=S.prj.doc.edited||{};
    const groups={}; D.DOCS.forEach(d=>(groups[d.group]=groups[d.group]||[]).push(d));
    side.innerHTML=`<h4>Start</h4><div class="nav"><button data-go="home" title="Back to the welcome screen and all projects"><span class="code">HOME</span>Welcome · all projects</button></div><h4>Project</h4><div class="nav">${[["overview","INFO","Overview"],["chars","BALL","Characteristics"],["plan","PLAN","Process plan"],["cnc","CNC","CNC programs"]].map(x=>`<button data-go="${x[0]}" title="${esc(x[2])}" ${S.view===x[0]?'aria-current="page"':""}><span class="code">${x[1]}</span>${x[2]}</button>`).join("")}</div>
      ${Object.keys(groups).map(g=>`<h4>${esc(g)}</h4><div class="nav">${groups[g].map(d=>`<button data-go="${d.id}" title="${esc(d.title)}" ${S.view===d.id?'aria-current="page"':""}><span class="code">${d.code}</span>${esc(d.title)}${ed[d.id]?`<span class="ed" title="Edited on screen"></span>`:""}</button>`).join("")}</div>`).join("")}`;
  }
  side.onclick=e=>{ const b=e.target.closest("[data-go]"); if(!b) return; document.body.classList.remove("nav-open"); const g=b.dataset.go; if(g==="projects") return projectsDialog(); if(g==="home"){ if(!S.prj) return; closeProject(); return; } go(g); };
}
function go(view){ S.view=view; nav(); UI.render(view); }
/* Back to the welcome screen (closes the open project; asks first when there are unsaved changes) */
function closeProject(){
  const sb=$("bSave"); if(sb&&/•/.test(sb.textContent||"")&&!confirm("This project has unsaved changes. Leave it anyway?")) return;
  S.prj=null; S.plan=null; S.docs=null; S.view="home"; refreshChip(); nav(); UI.render("overview");
}
$("bNav").onclick=()=>document.body.classList.add("nav-open"); $("scrim").onclick=()=>document.body.classList.remove("nav-open");

/* ---------------- top bar ---------------- */
let topBound=false;
function bindTop(){
  if(topBound) return; topBound=true;
  $("bProjects").onclick=projectsDialog;
  $("bSave").onclick=()=>save(true);
  $("projChip").onclick=()=>go("overview");
  menu("bNew","newMenu",()=>[
    {id:"bi",label:"From Balloon Inspector",sub:CLOUD?"Pick a saved ballooning report":"Needs the cloud version",run:biDialog,disabled:!CLOUD||!S.canEdit},
    {id:"csv",label:"Import ballooning file",sub:"Balloon Inspector CSV or JSON export",run:()=>$("fileCSV").click(),disabled:!S.canEdit},
    {id:"sample",label:"Try the sample drawing",sub:"Drive flange DF-2040 – 24 characteristics",run:()=>newFromSource(JSON.parse(JSON.stringify(window.PD_SAMPLE)),null),disabled:!S.canEdit},
    "-",{id:"open",label:"Open Balloon Inspector",sub:"Balloon a new drawing, then Send to Process Documents",run:()=>window.open(CFG.balloonUrl||"balloon.html","_blank")}]);
  menu("bExport","expMenu",()=>{ const d=D.DOCS.find(x=>x.id===S.view); return [
    {id:"p1",label:"This document – PDF",sub:d?d.title:"Open a document first",disabled:!d,run:()=>exportDoc(S.view,"pdf")},
    {id:"x1",label:"This document – Excel",sub:d?d.title:"Open a document first",disabled:!d,run:()=>exportDoc(S.view,"xlsx")},"-",
    {id:"pa",label:"All documents – PDF",sub:`${D.DOCS.length} documents in one file`,run:()=>exportAll("pdf")},
    {id:"xa",label:"All documents – Excel workbook",sub:"One sheet per document",run:()=>exportAll("xlsx")}]; });
  menu("bUser","userMenu",()=>[
    {id:"who",label:CLOUD?(S.user&&S.user.email||""):"Demo mode",sub:S.org?`${S.org.name} · ${S.platform&&!S.role?"owner":S.role}`:"",disabled:true},
    ...(S.memberships.length>1?S.memberships.map(m=>({id:"org"+m.id,label:"Switch to "+m.name,run:()=>chooseOrg(m.id)})):[]),
    "-",{id:"admin",label:"Admin",sub:"Company logo, settings, masters, users",run:()=>openAdmin("company"),disabled:!(S.role==="admin"||S.platform)},
    {id:"theme",label:"Theme: "+(({light:"Light",dark:"Dark"})[LS.get("pd_theme","")]||"Automatic"),sub:"Switch light / dark / automatic",run:()=>{ const t=LS.get("pd_theme",""); const n=t===""||t==null?"light":t==="light"?"dark":""; LS.set("pd_theme",n); applyTheme(n||null); }},
    ...(CLOUD?["-",{id:"out",label:"Sign out",run:signOut}]:[])]);
  $("fileCSV").onchange=async e=>{ const f=e.target.files[0]; e.target.value=""; if(!f) return; try{ const t=await f.text(); let src;
      if(/\.json$/i.test(f.name)||/^\s*\{/.test(t)){ const j=JSON.parse(t); src=j.items?j:(j.data&&j.data.items?j.data:null); if(!src) throw new Error("This JSON isn't a Balloon Inspector snapshot."); }
      else src=E.sourceFromCSV(t,f.name);
      newFromSource(src,null); }catch(err){ toast(err.message,6000); } };
}

/* ======================================================================
   PROJECTS
   ====================================================================== */
function welcomeHTML(){
  return `<div class="empty"><div class="card"><h2>Create process documents from a ballooned drawing</h2>
    <p>Send a ballooned drawing from Balloon Inspector, or import its CSV. Everything else is automatic: process route, machines, tools, consumables, gauges and all ${D.DOCS.length} documents. You can edit any cell on screen and export to PDF or Excel.</p>
    <div class="row">${CLOUD?`<button class="btn primary" id="wBI">From Balloon Inspector</button>`:""}<button class="btn" id="wCSV">Import CSV / JSON</button><button class="btn ${CLOUD?"":"primary"}" id="wSample">Try the sample drawing</button><button class="btn" id="wList">Open a project</button></div>
    <div class="steps3"><div><b>1 · Balloon</b>Balloon Inspector reads the drawing and lists every characteristic with its tolerance, SC/CC class and gauge.</div><div><b>2 · Automate</b>This platform selects the process, machines, tools, consumables and gauges, then generates every document.</div><div><b>3 · Review & export</b>Edit on screen, approve, and export PDF / Excel with your logo.</div></div></div></div>`;
}
function bindWelcome(){ if($("wBI")) $("wBI").onclick=biDialog; $("wCSV").onclick=()=>$("fileCSV").click(); $("wSample").onclick=()=>newFromSource(JSON.parse(JSON.stringify(window.PD_SAMPLE)),null); $("wList").onclick=projectsDialog;
  [$("wBI"),$("wCSV"),$("wSample")].forEach(b=>{ if(b&&!S.canEdit) b.disabled=true; }); }

async function projectsDialog(){
  const v=dialog("Projects",`<input id="pjQ" placeholder="Search part no., name, customer…" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin-bottom:10px;background:var(--field)"><div id="pjL" style="max-height:60vh;overflow:auto">Loading…</div>`,"",true);
  let rows=[];
  if(CLOUD){ const {data,error}=await sb.from("pd_projects").select("id,part_no,part_name,rev,customer,status,updated_at,bi_report_id").eq("org_id",S.org.id).order("updated_at",{ascending:false}).limit(500); if(error){ $("pjL").textContent=error.message; return; } rows=data||[]; }
  else rows=(LS.get("pd_projects",[])).map(p=>({id:p.id,part_no:p.part_no,part_name:p.part_name,rev:p.rev,customer:p.customer,status:p.status,updated_at:p.updated_at,bi_report_id:p.bi_report_id}));
  const draw=()=>{ const q=($("pjQ").value||"").toLowerCase(); const r=rows.filter(x=>[x.part_no,x.part_name,x.customer].join(" ").toLowerCase().includes(q));
    $("pjL").innerHTML = r.length?`<table class="plist"><thead><tr><th>Part no.</th><th>Part name</th><th>Rev</th><th>Customer</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${r.map(x=>`<tr data-open="${x.id}"><td><b>${esc(x.part_no||"—")}</b></td><td>${esc(x.part_name||"")}</td><td>${esc(x.rev||"")}</td><td>${esc(x.customer||"")}</td><td><span class="status ${x.status}">${esc(x.status)}</span></td><td>${esc(String(x.updated_at||"").slice(0,16).replace("T"," "))}</td><td>${S.role==="admin"?`<button class="btn small danger" data-del="${x.id}">Delete</button>`:""}</td></tr>`).join("")}</tbody></table>`:`<p class="hintline">No projects yet. Use <b>New</b> to create one from Balloon Inspector data.</p>`; };
  draw(); $("pjQ").oninput=draw; $("pjQ").focus();
  $("pjL").onclick=async e=>{ const d=e.target.closest("[data-del]"); if(d){ e.stopPropagation(); if(!confirm("Delete this project and all its documents?")) return; await deleteProject(d.dataset.del); rows=rows.filter(x=>x.id!==d.dataset.del); draw(); return; }
    const t=e.target.closest("[data-open]"); if(t){ closeDialog(); openProject(t.dataset.open); } };
}
async function deleteProject(id){ if(CLOUD){ const {error}=await sb.from("pd_projects").delete().eq("id",id); if(error){ toast(error.message); return; } } else { LS.set("pd_projects",LS.get("pd_projects",[]).filter(p=>p.id!==id)); }
  if(S.prj&&S.prj.id===id){ S.prj=null; S.plan=null; S.docs=null; refreshChip(); nav(); UI.render("overview"); } }
async function openProject(id){
  if(S.dirty) await flushSave();
  busy("Opening project");
  try{ let P;
    if(CLOUD){ const {data,error}=await sb.from("pd_projects").select("*").eq("id",id).single(); if(error) throw error; P=data; }
    else P=LS.get("pd_projects",[]).find(p=>p.id===id);
    if(!P) throw new Error("Project not found.");
    P.doc=P.doc||{};
    S.prj=P; S.dirty=false;
    if(!P.doc.plan||!P.doc.docs){ generate(P); busy(null); toast(`Generated ${D.DOCS.length} documents from ${S.plan.chars.length} ballooned characteristics.`,6000); if(S.canEdit) await save(); }
    else { S.plan=P.doc.plan; S.docs=P.doc.docs; ensureDocs(); migrate(); }
    try{ history.replaceState(null,"",location.pathname+"?project="+P.id); }catch(e){}
    refreshChip(); go(P.doc.sourceChanged?"overview":S.view&&S.view!=="home"?S.view:"overview");
  }catch(e){ toast("Couldn't open: "+e.message,7000); } finally{ busy(null); }
}
/* bring projects saved by older versions up to date (no data is lost) */
function migrate(){
  (S.plan.ops||[]).forEach(o=>(o.params||[]).forEach(p=>{ if(!p.kind) p.kind=E.paramKind(p.name); }));
  const pf=S.docs.pfmea; if(pf&&pf.rows) pf.rows.forEach(r=>{ if(r.fe) r.fe=D.fmtFE(r.fe); });
  const cp=S.docs.cp; if(cp&&cp.rows) cp.rows.forEach(r=>{ if(!r.product&&r.process&&!r.charNo&&E.paramKind(r.process)==="product"){ r.product=r.process; r.process=""; } });
  applyHeaderDefaults(S.plan.header,false);
}
/* company-wide document header defaults (Admin → Document header) */
const HEADER_KEYS=[["supplierCode","Supplier / vendor code"],["plant","Plant / location"],["keyContact","Key contact / phone"],["coreTeam","Core team (CFT)"],["preparedBy","Prepared by"],["reviewedBy","Reviewed by"],["approvedBy","Approved by"],["model","Model / vehicle (default)"],["docRev","Document revision (default)"]];
function applyHeaderDefaults(h, overwrite){ const st=S.settings||{}; let n=0;
  if(st.companyName&&(overwrite||!h.supplier)){ h.supplier=st.companyName; }
  HEADER_KEYS.forEach(([k])=>{ const v=(st[k]||"").trim(); if(v&&(overwrite||!String(h[k]||"").trim())){ if(h[k]!==v) n++; h[k]=v; } });
  if(st.phase&&(overwrite||!h.phase)) h.phase=st.phase;
  return n; }
function ensureDocs(){ D.DOCS.forEach(d=>{ if(!S.docs[d.id]) S.docs[d.id]=D.genOne(d.id,S.plan,genSettings()); }); }
function uuid(){ return (crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{ const r=Math.random()*16|0; return (c==="x"?r:(r&3|8)).toString(16); })); }
async function newFromSource(src, biReportId){
  if(!S.canEdit){ toast("Viewers can't create projects."); return; }
  if(S.dirty) await flushSave();
  if(src&&src.header) src.header=partFromOps(src.header);
  const h=(src&&src.header)||{};
  const P={id:null,org_id:S.org&&S.org.id,part_no:h.partNo||"",part_name:h.partName||"",rev:h.rev||"",drawing_no:h.drawingNo||"",customer:h.customer||"",status:"received",source:src,bi_report_id:biReportId||null,doc:{}};
  busy("Generating process plan and documents");
  await new Promise(r=>setTimeout(r,30));
  try{ S.prj=P; generate(P); await save(); busy(null); refreshChip(); S.view="overview"; nav(); UI.render("overview");
    toast(`Done – ${D.DOCS.length} documents generated from ${S.plan.chars.length} characteristics (${S.plan.ops.length} process steps).`,7000);
  }catch(e){ busy(null); console.error(e); toast("Couldn't generate: "+e.message,8000); }
}

/* ======================================================================
   AUTOMATION PIPELINE
   ====================================================================== */
function genSettings(){ const cust=S.plan&&S.plan._cust; return Object.assign({},S.settings,{machines:S.machines, strictMasters:!!S.masters.strict, symbols:cust?{CC:cust.ccSym||"◆",SC:cust.scSym||"▼",KC:"◇"}:S.settings.symbols}); }
function applyCustomer(plan){
  const list=S.masters.customers||[], name=(plan.header.customer||"").toLowerCase().trim(); if(!name||!list.length) return;
  const n=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const c=list.find(x=>n(x.name)===n(name))||list.find(x=>n(x.name)&&(n(name).includes(n(x.name))||n(x.name).includes(n(name))));
  if(!c) return; plan._cust=c; plan.header.customer=c.name; plan.header.customerCode=c.code||plan.header.customerCode; plan.header.customerAddress=c.address||""; plan.header.customerContact=c.contact||"";
}
function generate(P, keepHeader){
  const s=Object.assign({},S.settings,{companyName:S.settings.companyName||(S.org&&S.org.name)});
  const plan=E.buildPlan(P.source, S.masters, s);
  if(keepHeader) ["preparedBy","reviewedBy","approvedBy","keyContact","coreTeam","model","annualVolume","customerCode","phase","docRev","origDate","supplierCode","plant","customerPartNo"].forEach(k=>{ if(keepHeader[k]) plan.header[k]=keepHeader[k]; });
  const oldPlan=P.doc&&P.doc.plan; if(oldPlan&&oldPlan.ops) plan.ops.forEach(o=>{ const po=oldPlan.ops.find(x=>x.opNo===o.opNo&&x.key===o.key); if(po&&po.cnc&&po.cnc.edited) o.cnc=po.cnc; });
  S.plan=plan; applyCustomer(plan); applyHeaderDefaults(plan.header,false);
  const docs=D.genAll(plan, genSettings());
  const old=P.doc&&P.doc.docs; if(old) preserve(old, docs, D.DOCS.map(d=>d.id));
  P.doc={plan, docs, edited:{}, generatedAt:new Date().toISOString(), sourceChanged:false};
  S.docs=docs; P.status=P.status==="approved"?"approved":"generated";
  P.part_no=plan.header.partNo; P.part_name=plan.header.partName; P.rev=plan.header.drawingRev; P.drawing_no=plan.header.drawingNo; P.customer=plan.header.customer;
}
/* keep readings / study data / doc numbers when documents are rebuilt */
function preserve(oldD, newD, ids){
  ids.forEach(id=>{ const o=oldD[id], n=newD[id]; if(!o||!n) return;
    if(o.docNo) n.docNo=o.docNo; if(o.rev) n.rev=o.rev;
    if(["setup","patrol","self"].includes(id)){ if(o.slots) n.slots=o.slots; (n.sections||[]).forEach(s=>{ const os=(o.sections||[]).find(x=>x.opNo===s.opNo); if(!os) return; s.meta=Object.assign(s.meta||{},os.meta||{});
      s.rows.forEach(r=>{ const or=(os.rows||[]).find(x=>String(x.charNo)===String(r.charNo)); if(or) Object.keys(or).forEach(k=>{ if(/^[rt]\d+$/.test(k)||k==="remark") r[k]=or[k]; }); });
      (s.params||[]).forEach(p=>{ const op=(os.params||[]).find(x=>x.name===p.name); if(op){ p.actual=op.actual; p.ok=op.ok; } }); }); }
    if(id==="pdi"){ n.meta=Object.assign(n.meta||{},o.meta||{}); n.rows.forEach(r=>{ const or=(o.rows||[]).find(x=>String(x.charNo)===String(r.charNo)); if(or) ["s1","s2","s3","s4","s5"].forEach(k=>r[k]=or[k]); }); }
    if(id==="spc"){ n.studies.forEach(s=>{ const os=(o.studies||[]).find(x=>String(x.charNo)===String(s.charNo)); if(os) ["data","n","k","simulated","period","studyType"].forEach(k=>{ if(os[k]!=null) s[k]=os[k]; }); });
      (o.studies||[]).forEach(os=>{ if(!n.studies.some(s=>String(s.charNo)===String(os.charNo))&&os.data&&os.data.some(g=>g.some(v=>v!=null))) n.studies.push(os); }); }
    if(id==="msa"){ n.studies.forEach(s=>{ const os=(o.studies||[]).find(x=>x.gaugeId===s.gaugeId); if(os) ["data","appraisers","trials","parts","simulated","date","lc"].forEach(k=>{ if(os[k]!=null) s[k]=os[k]; }); }); }
    if(id==="charts"&&o.meta) n.meta=o.meta;
  });
}
async function regenFromPlan(){
  const P=S.prj, ed=Object.keys(P.doc.edited||{}).filter(k=>P.doc.edited[k]);
  let only=null;
  if(ed.length){ const names=ed.map(id=>(D.DOCS.find(d=>d.id===id)||{}).title).filter(Boolean);
    const keep=confirm(`These documents have changes made on screen:\n\n• ${names.join("\n• ")}\n\nOK = keep those edits and update only the other documents.\nCancel = rebuild everything from the plan (screen edits are replaced; readings are kept).`);
    only = keep ? D.DOCS.map(d=>d.id).filter(id=>!ed.includes(id)) : null; }
  const docs=D.genAll(S.plan, genSettings()); preserve(S.docs, docs, D.DOCS.map(d=>d.id));
  (only||D.DOCS.map(d=>d.id)).forEach(id=>{ S.docs[id]=docs[id]; if(!only) P.doc.edited[id]=false; });
  P.doc.planDirty=false; changed(null); nav(); toast(only?`Updated ${only.length} documents; kept your edits in ${ed.length}.`:`All ${D.DOCS.length} documents updated from the process plan.`); UI.render(S.view);
}
async function rerun(){
  if(!confirm("Re-run the full automation from the ballooning data?\n\nThe process plan and all documents are rebuilt. Readings, SPC / MSA data, document numbers and team names are kept.")) return;
  busy("Re-running automation"); await new Promise(r=>setTimeout(r,30));
  generate(S.prj, S.plan&&S.plan.header); busy(null); changed(null); nav(); refreshChip(); UI.render(S.view); toast("Automation re-run – process plan and documents rebuilt.");
}
function regenOne(id){ const d=D.DOCS.find(x=>x.id===id); if(!confirm(`Regenerate the ${d.title} from the current process plan? Edits made on this document are replaced (readings are kept).`)) return;
  const n={}; n[id]=D.genOne(id,S.plan,genSettings()); preserve(S.docs,n,[id]); S.docs[id]=n[id]; S.prj.doc.edited[id]=false; changed(null); nav(); UI.render(id); toast(d.title+" regenerated."); }

/* ---------------- save / autosave ---------------- */
let saveT=null, saving=false;
function changed(id){
  if(!S.prj) return; S.dirty=true;
  if(id&&id!=="_plan"){ const was=S.prj.doc.edited&&S.prj.doc.edited[id]; S.prj.doc.edited=S.prj.doc.edited||{}; S.prj.doc.edited[id]=true; if(!was) nav(); }
  if(id==="_plan") S.prj.doc.planDirty=true;
  saveState(); clearTimeout(saveT); if(S.canEdit) saveT=setTimeout(()=>save(),2500);
}
function saveState(){ const b=$("bSave"); if(!b) return; b.querySelector(".lbl").textContent=saving?"Saving…":S.dirty?"Save":"Saved"; b.classList.toggle("primary",S.dirty); }
async function flushSave(){ clearTimeout(saveT); if(S.dirty&&S.canEdit) return save(); return true; }
async function save(manual){
  if(!S.prj||!S.canEdit) return false; clearTimeout(saveT);
  const P=S.prj, h=S.plan.header;
  P.doc.plan=S.plan; P.doc.docs=S.docs; P.part_no=h.partNo; P.part_name=h.partName; P.rev=h.drawingRev; P.drawing_no=h.drawingNo; P.customer=h.customer;
  const row={org_id:S.org.id,part_no:P.part_no,part_name:P.part_name,rev:P.rev,drawing_no:P.drawing_no,customer:P.customer,status:P.status,source:P.source||{},bi_report_id:P.bi_report_id||null,doc:P.doc};
  saving=true; saveState();
  try{
    if(CLOUD){ if(!P.id){ const {data,error}=await sb.from("pd_projects").insert(row).select("id").single(); if(error) throw error; P.id=data.id; }
      else { const {error}=await sb.from("pd_projects").update(row).eq("id",P.id); if(error) throw error; } }
    else { if(!P.id) P.id=uuid(); P.updated_at=new Date().toISOString(); const list=LS.get("pd_projects",[]).filter(x=>x.id!==P.id); list.unshift(Object.assign({},row,{id:P.id,updated_at:P.updated_at})); LS.set("pd_projects",list.slice(0,40)); }
    S.dirty=false; try{ history.replaceState(null,"",location.pathname+"?project="+P.id); }catch(e){}
    if(manual) toast("Saved.");
    return true;
  }catch(e){ toast("Couldn't save: "+e.message,8000); return false; } finally{ saving=false; saveState(); }
}
window.addEventListener("beforeunload",e=>{ if(S.dirty){ e.preventDefault(); e.returnValue=""; } });

/* ---------------- export hooks ---------------- */
async function exportDoc(id, kind){ if(!S.prj) return; busy(kind==="pdf"?"Building PDF":"Building Excel workbook"); try{ await (kind==="pdf"?window.PDExport.pdf([id]):window.PDExport.xlsx([id])); }catch(e){ console.error(e); toast("Export failed: "+e.message,8000); } finally{ busy(null); } }
async function exportAll(kind){ if(!S.prj) return; busy(kind==="pdf"?"Building PDF with all documents":"Building Excel workbook with all documents"); try{ const ids=D.DOCS.map(d=>d.id); await (kind==="pdf"?window.PDExport.pdf(ids):window.PDExport.xlsx(ids)); }catch(e){ console.error(e); toast("Export failed: "+e.message,8000); } finally{ busy(null); } }

/* ======================================================================
   BALLOON INSPECTOR → pick a saved ballooning report
   ====================================================================== */
async function biDialog(){
  dialog("From Balloon Inspector",`<p class="hintline" style="margin-top:0">Ballooning reports saved in Balloon Inspector workspaces you belong to. Pick one – the process plan and all documents are generated automatically.</p><div id="biL">Loading…</div>`,"",true);
  const {data,error}=await sb.from("bi_reports").select("id,title,part_no,rev,drawing_no,customer,updated_at,org_id,bi_orgs(name)").order("updated_at",{ascending:false}).limit(300);
  if(error){ $("biL").innerHTML=`<p class="err">${esc(/bi_reports|relation/i.test(error.message)?"Balloon Inspector's tables aren't in this Supabase project. Use Import ballooning file (CSV) instead.":error.message)}</p>`; return; }
  if(!data||!data.length){ $("biL").innerHTML=`<p class="hintline">No ballooning reports found for your e-mail. In Balloon Inspector, save a report (or use <b>Send to Process Documents</b>), then try again.</p>`; return; }
  $("biL").innerHTML=`<table class="plist"><thead><tr><th>Part no.</th><th>Title</th><th>Rev</th><th>Customer</th><th>Workspace</th><th>Saved</th></tr></thead><tbody>${data.map(r=>`<tr data-open="${r.id}"><td><b>${esc(r.part_no||"—")}</b></td><td>${esc(r.title||"")}</td><td>${esc(r.rev||"")}</td><td>${esc(r.customer||"")}</td><td>${esc(r.bi_orgs&&r.bi_orgs.name||"")}</td><td>${esc(String(r.updated_at).slice(0,16).replace("T"," "))}</td></tr>`).join("")}</tbody></table>`;
  $("biL").onclick=async e=>{ const t=e.target.closest("[data-open]"); if(!t) return; closeDialog(); busy("Reading ballooning data");
    const {data:r,error:e2}=await sb.from("bi_reports").select("id,data,customer").eq("id",t.dataset.open).single(); busy(null); if(e2){ toast(e2.message); return; }
    const {data:ex}=await sb.from("pd_projects").select("id").eq("org_id",S.org.id).eq("bi_report_id",r.id).limit(1);
    if(ex&&ex.length&&!confirm("A project already exists for this ballooning report. Create another one?\n(Cancel opens the existing project.)")) return openProject(ex[0].id);
    newFromSource(r.data, r.id); };
}

/* ======================================================================
   ADMIN
   ====================================================================== */
function shrinkLogo(f, max=420){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>{ const im=new Image(); im.onload=()=>{ const k=Math.min(1,max/Math.max(im.width,im.height)), c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); c.getContext("2d").drawImage(im,0,0,c.width,c.height); res(c.toDataURL("image/png")); }; im.onerror=rej; im.src=r.result; }; r.onerror=rej; r.readAsDataURL(f); }); }
function suggestPw(){ const a="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", r=new Uint32Array(10); crypto.getRandomValues(r); return Array.from(r,x=>a[x%a.length]).join("").replace(/^(.{5})/,"$1-"); }
function openAdmin(tab){
  if(!(S.role==="admin"||S.platform)){ toast("Only company admins can open Admin."); return; }
  const tabs=[]; if(S.org&&(S.role==="admin"||!CLOUD)) tabs.push(["company","Company"],["header","Document header"],["documents","Document settings"],["cnc","CNC programs"],["machines","Machines"],["gauges","Gauges"],["customers","Customers"],["consumables","Consumables"]);
  if(CLOUD&&S.role==="admin") tabs.push(["users","Users"],["integration","Balloon Inspector link"]); if(CLOUD&&S.platform) tabs.push(["workspaces","Company workspaces"]);
  const KMR=!!window.KMR_SSO&&!S.platform;   // on the KMR platform (also in sample mode): company, users and workspaces live in KMR Apps
  if(KMR){ for(let i=tabs.length-1;i>=0;i--) if(["company","users","workspaces"].includes(tabs[i][0])) tabs.splice(i,1); }
  if(!tabs.find(t=>t[0]===tab)) tab=tabs[0]&&tabs[0][0];
  const kp=(()=>{ try{ return JSON.parse(localStorage.getItem("kmr-portal")||"null"); }catch(e){ return null; } })();
  dialog("Admin",`${KMR?`<p style="margin:0 0 10px;font-size:13.5px;color:#5E6B7E">Company details, logo and users are managed for all your KMR apps in <a href="${kp&&kp.slug?"/it/app/"+encodeURIComponent(kp.slug)+"#admin":"/it/apps.html"}"><b>KMR Apps › Administration</b></a>.</p>`:""}<div class="tabs" role="tablist">${tabs.map(t=>`<button role="tab" data-t="${t[0]}" aria-selected="${t[0]===tab}">${t[1]}</button>`).join("")}</div><div id="adP"></div>`,"",true);
  document.querySelectorAll("#dlg [data-t]").forEach(b=>b.onclick=()=>{ document.querySelectorAll("#dlg [data-t]").forEach(x=>x.setAttribute("aria-selected",x===b)); pane(b.dataset.t); });
  pane(tab);
}
async function saveOrg(upd){
  if(CLOUD){ const {error}=await sb.from("pd_orgs").update(upd).eq("id",S.org.id); if(error) throw error; Object.assign(S.org,upd); const m=S.memberships.find(x=>x.id===S.org.id); if(m) Object.assign(m,upd); }
  else { Object.assign(S.org,upd); const L=LS.get("pd_local",{})||{}; L.settings=upd.settings||S.settings; if("logo" in upd) L.logo=upd.logo; L.masters=S.masters; LS.set("pd_local",L); }
  S.settings=Object.assign({companyName:S.org.name},S.org.settings||{}); brand(); LS.set("pd_brand",{name:S.org.name,logo:S.org.logo});
}
async function saveMaster(kind){
  if(CLOUD){ const {error}=await sb.from("pd_masters").upsert({org_id:S.org.id,kind,items:S.masters[kind],updated_at:new Date().toISOString()}); if(error) throw error; }
  else { const L=LS.get("pd_local",{})||{}; L.masters=S.masters; L.settings=S.settings; LS.set("pd_local",L); }
  if(kind==="machines") S.machines=machinesInUse();
}
async function moveToOps(t){
  const b=$("aMove"); if(b){ b.disabled=true; b.textContent="Moving…"; }
  const payload={}; payload[t]=S.ownMasters[t];
  const r=await sb.rpc("kmr_pd_push_masters",{p_org:S.org.id,p:payload});
  if(r.error){ if(b){ b.disabled=false; b.textContent="Move to Operations Master"; } toast(r.error.message,7000); return; }
  await loadOpsMasters(S.org.id); S.machines=machinesInUse();
  toast(`Moved ${r.data[t]||0} ${t} to the Operations Master.`); pane(t);
}
async function pane(t){
  const P=$("adP"), st=S.settings;
  const msg=(ok,m)=>{ const e=$("adMsg"); if(e){ e.className=ok?"okmsg":"err"; e.textContent=m; } };
  if(t==="company"){
    let logo=S.org.logo||null;
    P.innerHTML=`<div class="cols2"><div>
      <label class="fld">Company name<input id="aName" value="${esc(S.org.name)}"></label>
      <label class="fld" style="margin-top:10px">Company logo (PNG / JPG / SVG – printed on every PDF and Excel)<input id="aLogo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"></label>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px"><img class="logoprev" id="aPrev" src="${logo||""}" alt="" ${logo?"":"hidden"}><button class="btn small" id="aRm" ${logo?"":"hidden"}>Remove logo</button></div>
      ${CLOUD&&S.platform?`<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="aLb" ${st.login_brand?"checked":""}> Show this logo on the sign-in page for everyone</label>`:""}
      ${CLOUD?`<label class="fld" style="margin-top:10px">Sign-in link with this company's logo<input readonly value="${esc(location.origin+location.pathname+"?c="+S.org.id)}"></label>`:""}
    </div><div class="frm" style="align-content:start">
      ${[["address","Address"],["phone","Phone"],["email","E-mail"]].map(f=>`<label class="fld">${f[1]}<input data-s="${f[0]}" value="${esc(st[f[0]]||"")}"></label>`).join("")}
    </div></div><div id="adMsg" class="err"></div><div class="addrow"><button class="btn primary" id="aSave">Save company settings</button></div>`;
    $("aLogo").onchange=async e=>{ const f=e.target.files[0]; if(!f) return; logo=await shrinkLogo(f); $("aPrev").src=logo; $("aPrev").hidden=false; $("aRm").hidden=false; };
    $("aRm").onclick=()=>{ logo=null; $("aPrev").hidden=true; $("aRm").hidden=true; };
    $("aSave").onclick=async()=>{ const s=Object.assign({},S.org.settings||{}); P.querySelectorAll("[data-s]").forEach(i=>s[i.dataset.s]=i.value.trim()); if($("aLb")) s.login_brand=$("aLb").checked; s.companyName=$("aName").value.trim()||S.org.name;
      try{ await saveOrg({name:s.companyName,logo,settings:s}); msg(true,"Saved. New documents and exports use these details."); }catch(e){ msg(false,e.message); } };
  }
  if(t==="header"){
    P.innerHTML=`<p class="hintline" style="margin-top:0">These values fill the header boxes of every document (PFD, PFMEA, Control Plan, reports…) for all projects of <b>${esc(S.org.name)}</b>. Fill them once here instead of on every document.</p>
      <div class="frm">${HEADER_KEYS.map(f=>`<label class="fld">${esc(f[1])}${f[0]==="coreTeam"?`<textarea data-s="${f[0]}" rows="2">${esc(st[f[0]]||"")}</textarea>`:`<input data-s="${f[0]}" value="${esc(st[f[0]]||"")}">`}</label>`).join("")}
        <label class="fld">Control plan type (default)<select data-s="phase">${["","Prototype","Pre-launch","Production","Safe launch"].map(v=>`<option value="${v}"${(st.phase||"")===v?" selected":""}>${v||"— as generated —"}</option>`).join("")}</select></label></div>
      <div id="adMsg" class="err"></div><div class="addrow"><button class="btn primary" id="aSave">Save header defaults</button>${S.prj&&S.canEdit?`<button class="btn" id="aApply">Save & apply to the open project</button>`:""}<span class="hintline">New projects get these automatically. Existing projects: open them and use “Apply” or the button on the Overview.</span></div>`;
    const collect=()=>{ const s=Object.assign({},S.org.settings||{}); P.querySelectorAll("[data-s]").forEach(i=>s[i.dataset.s]=i.value.trim()); return s; };
    $("aSave").onclick=async()=>{ try{ await saveOrg({settings:collect()}); msg(true,"Saved."); }catch(e){ msg(false,e.message); } };
    if($("aApply")) $("aApply").onclick=async()=>{ try{ await saveOrg({settings:collect()}); const n=applyHeaderDefaults(S.plan.header,true); changed(null); UI.render(S.view); msg(true,`Saved and applied to ${S.plan.header.partNo||"this project"} (${n} field${n===1?"":"s"} updated).`); }catch(e){ msg(false,e.message); } };
  }
  if(t==="cnc"){
    P.innerHTML=`<p class="hintline" style="margin-top:0">Settings used when CNC programs are generated for this company's machines. Programs are <b>drafts</b>: always prove them out with a dry run / single block before cutting.</p><div class="frm">
      <label class="fld">Control<input value="Fanuc-compatible G-code (Fanuc 0i / 31i, Haas, Mitsubishi and most Fanuc-style controls with Macro B)" readonly></label>
      <label class="fld">First program number<input data-s="cncProgStart" type="number" min="1" max="9999" value="${esc(st.cncProgStart||1000)}"></label>
      <label class="fld">Lathe spindle speed limit (rpm)<input data-s="cncMaxRpmLathe" type="number" value="${esc(st.cncMaxRpmLathe||3000)}"></label>
      <label class="fld">VMC spindle speed limit (rpm)<input data-s="cncMaxRpmMill" type="number" value="${esc(st.cncMaxRpmMill||8000)}"></label>
      <label class="fld">VMC work offset<select data-s="cncWcs">${["G54","G55","G56","G57"].map(v=>`<option${(st.cncWcs||"G54")===v?" selected":""}>${v}</option>`).join("")}</select></label>
      <label class="fld">VMC safe Z (mm above part)<input data-s="cncSafeZ" type="number" step="0.5" value="${esc(st.cncSafeZ||50)}"></label>
      <label class="fld">Coolant on<select data-s="cncCoolant">${[["M08","M08 flood"],["M07","M07 mist"],["M88","M88 through-spindle"]].map(v=>`<option value="${v[0]}"${(st.cncCoolant||"M08")===v[0]?" selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="fld">Safety lock<select data-s="cncLock">${[["1","On – program alarms until the programmer marks it verified"],["0","Off"]].map(v=>`<option value="${v[0]}"${String(st.cncLock??"1")===v[0]?" selected":""}>${v[1]}</option>`).join("")}</select></label>
      <label class="fld" style="grid-column:1/-1">Program header comment (optional)<input data-s="cncHeader" value="${esc(st.cncHeader||"")}" placeholder="e.g. company name / programmer"></label></div>
      <div id="adMsg" class="err"></div><div class="addrow"><button class="btn primary" id="aSave">Save CNC settings</button></div>`;
    $("aSave").onclick=async()=>{ const s=Object.assign({},S.org.settings||{}); P.querySelectorAll("[data-s]").forEach(i=>s[i.dataset.s]=i.value.trim()); try{ await saveOrg({settings:s}); msg(true,"Saved. Regenerate programs on the CNC programs screen to use them."); }catch(e){ msg(false,e.message); } };
  }
  if(t==="documents"){
    P.innerHTML=`<div class="frm">
      <label class="fld">Document number pattern<input data-s="docNoPattern" value="${esc(st.docNoPattern||"{CODE}-{PART}")}" placeholder="{CODE}-{PART}"><small>{CODE} = PFMEA, CP…  {PART} = part no.  {REV} = drawing rev.  {PREFIX} = prefix below</small></label>
      <label class="fld">Prefix ({PREFIX})<input data-s="docPrefix" value="${esc(st.docPrefix||"")}"></label>
      <label class="fld">Paper size for PFMEA & Control Plan<select data-s="bigPaper">${["a3","a4"].map(v=>`<option value="${v}"${(st.bigPaper||"a3")===v?" selected":""}>${v.toUpperCase()} landscape</option>`).join("")}</select></label>
      <label class="fld">Paper size for other documents<select data-s="paper">${["a4","a3"].map(v=>`<option value="${v}"${(st.paper||"a4")===v?" selected":""}>${v.toUpperCase()} landscape</option>`).join("")}</select></label>
      <label class="fld">Frequency – CC characteristics<input data-s="freqCC" value="${esc(st.freqCC||"100% + 5 pcs / 2 hrs (SPC)")}"></label>
      <label class="fld">Frequency – SC characteristics<input data-s="freqSC" value="${esc(st.freqSC||"5 pcs / 2 hrs")}"></label>
      <label class="fld">Frequency – other characteristics<input data-s="freqNormal" value="${esc(st.freqNormal||"1 pc / 2 hrs")}"></label>
      <label class="fld">Time slots in patrol / self inspection<input data-s="patrolSlots" type="number" min="4" max="12" value="${esc(st.patrolSlots||8)}"></label>
      <label class="fld">PFMEA action owner (default)<input data-s="pfmeaOwner" value="${esc(st.pfmeaOwner||"Process Engineering")}"></label>
      <label class="fld" style="grid-column:1/-1">Reaction plan – normal characteristics<textarea data-s="reactNormal" rows="2">${esc(st.reactNormal||"Stop; segregate & 100% inspect parts since last OK check; correct offset / tool; re-approve setup; record in rejection register")}</textarea></label>
      <label class="fld" style="grid-column:1/-1">Reaction plan – CC characteristics<textarea data-s="reactCC" rows="2">${esc(st.reactCC||"Stop the machine; quarantine all parts since last OK check; inform QA head; 100% inspect; root-cause & 8D; re-approve setup")}</textarea></label></div>
      <div id="adMsg" class="err"></div><div class="addrow"><button class="btn primary" id="aSave">Save document settings</button><span class="hintline">Applies to new projects and to “Update documents”.</span></div>`;
    $("aSave").onclick=async()=>{ const s=Object.assign({},S.org.settings||{}); P.querySelectorAll("[data-s]").forEach(i=>s[i.dataset.s]=i.value.trim()); try{ await saveOrg({settings:s}); msg(true,"Saved."); }catch(e){ msg(false,e.message); } };
  }
  if(["machines","gauges","customers","consumables"].includes(t)){
    const info={machines:"Machines the automation can choose from. “Processes it can do” uses these codes: "+Object.keys(SC.KEY_NAMES).join(", ")+". Capability = the tightest tolerance (±mm) the machine holds reliably.",
      gauges:"Your gauge inventory. When a generated gauge matches a name and range here, the documents use your gauge ID, calibration due date and location.",
      customers:"When the customer name on the drawing matches, the supplier code, address and customer's SC / CC symbols are filled in automatically.",
      consumables:"Consumables listed for each process. Leave empty to use the built-in defaults."}[t];
    const LBL={machines:"machines",gauges:"gauges",customers:"customers",consumables:"consumables"}[t];
    if(S.ops&&S.ops[t]){
      const cols=SC.MASTER_COLS[t], rows=S.masters[t]||[];
      const own=((S.ownMasters||{})[t]||[]).length, admin=S.role==="admin"||S.platform;
      P.innerHTML=`${!rows.length&&own&&admin&&t!=="consumables"?`<div class="banner warn"><b>Your company’s Operations Master has no ${LBL} yet, so none are used.</b> This workspace still has ${own} of its own from before — move them there once.<button class="btn small primary" id="aMove">Move to Operations Master</button></div>`:""}
        <div class="banner"><b>${rows.length?`These ${LBL} come from`:`No ${LBL} in`} your company’s Operations Master</b> (KMR Apps), shared by every KMR app.${t==="consumables"?" Give each consumable its processes there (e.g. TURN1, VMC).":""} Add or change them there${rows.length?"":", or load its sample data"}; this list updates the next time you open the workspace.
          <a class="btn small primary" href="${esc(opsPortalLink())}" target="_top">Open Operations Master</a></div>
        <div class="gridwrap free"><table class="plist"><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td style="white-space:pre-line">${esc(Array.isArray(r[c.k])?r[c.k].join(", "):(r[c.k]??""))}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${cols.length}">None — the documents will show no ${LBL} until you add them in the Operations Master.</td></tr>`}</tbody></table></div>`;
      if($("aMove")) $("aMove").onclick=()=>moveToOps(t);
      return;
    }
    const canMove=S.ops&&S.ops.linked&&t!=="consumables"&&(S.role==="admin"||S.platform)&&((S.ownMasters||{})[t]||[]).length;
    if(t==="machines"&&!S.masters.machines.length) S.masters.machines=JSON.parse(JSON.stringify(E.DEFAULT_MACHINES));
    if(t==="consumables"&&!S.masters.consumables.length) S.masters.consumables=Object.keys(E.DEFAULT_CONSUMABLES).map(k=>({key:k,items:E.DEFAULT_CONSUMABLES[k].join("\n")}));
    const rows=S.masters[t];
    if(t==="machines") rows.forEach(r=>{ if(Array.isArray(r.keys)) r.keys=r.keys.join(", "); });
    P.innerHTML=`${canMove?`<div class="banner warn"><b>Your company’s Operations Master has no ${LBL} yet.</b> Move these ${S.ownMasters[t].length} there once — nothing is lost, and from then on every KMR app uses the same list.<button class="btn small primary" id="aMove">Move to Operations Master</button></div>`:""}<p class="hintline" style="margin-top:0">${esc(info)}</p><div id="mg"></div><div id="adMsg" class="err"></div><div class="addrow"><button class="btn primary" id="aSave">Save ${t}</button>${t==="machines"?`<button class="btn small" id="aReset">Reset to defaults</button>`:""}<span class="hintline">Use the red bin to delete a row, then Save.</span></div>`;
    const cols=SC.MASTER_COLS[t].map(c=>c.k==="key"?Object.assign({},c,{opts:Object.keys(SC.KEY_NAMES).map(k=>[k,k+" – "+SC.KEY_NAMES[k]])}):c.type==="keys"?Object.assign({},c,{type:"text"}):c);
    UI.grid($("mg"),{rows,cols,free:true,delCol:true,onChange:()=>{},rowsChanged:()=>{},newRow:()=>({})});
    $("aSave").onclick=async()=>{ const out=S.masters[t].filter(r=>Object.values(r).some(v=>String(v??"").trim()));
      if(t==="machines") out.forEach(r=>{ r.keys=String(r.keys||"").split(/[,\s]+/).map(s=>s.trim().toUpperCase()).filter(Boolean); r.maxDia=+r.maxDia||9999; r.cap=+r.cap||0.01; });
      S.masters[t]=out;
      try{ await saveMaster(t); msg(true,"Saved. Use “Re-run automation” on a project to apply it."); if(t==="machines") S.masters.machines.forEach(r=>{ if(Array.isArray(r.keys)) r.keys=r.keys.join(", "); }); }catch(e){ msg(false,e.message); } };
    if($("aMove")) $("aMove").onclick=()=>moveToOps(t);
    if($("aReset")) $("aReset").onclick=()=>{ if(!confirm("Replace the machine list with the built-in defaults?")) return; S.masters.machines=JSON.parse(JSON.stringify(E.DEFAULT_MACHINES)); pane("machines"); };
  }
  if(t==="users"){
    P.innerHTML=`<p class="hintline" style="margin-top:0">Add a person with a starting password – they can sign in straight away (same account works in Balloon Inspector). <b>Admin</b>: everything · <b>Editor</b>: create & edit projects · <b>Viewer</b>: view & export.</p>
      <div class="frm" style="grid-template-columns:2fr 1fr 1.5fr auto auto;align-items:end"><label class="fld">E-mail<input id="uE" type="email" autocomplete="off"></label><label class="fld">Role<select id="uR"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><label class="fld">Starting password (8+)<input id="uP" type="text" autocomplete="off"></label><button class="btn" id="uG">Suggest</button><button class="btn primary" id="uA">Add user</button></div>
      <div id="adMsg" class="err"></div><div id="uL">Loading…</div>`;
    const rpc=(email,role,pass)=>sb.rpc("pd_admin_save_user",{p_org:S.org.id,p_email:email,p_role:role,p_password:pass});
    const load=async()=>{ const {data,error}=await sb.from("pd_members").select("email,role").eq("org_id",S.org.id).order("email"); if(error){ $("uL").textContent=error.message; return; }
      $("uL").innerHTML=`<table class="plist"><thead><tr><th>E-mail</th><th>Role</th><th></th></tr></thead><tbody>${data.map(m=>`<tr><td>${esc(m.email)}</td><td><select data-role="${esc(m.email)}">${["admin","editor","viewer"].map(r=>`<option${m.role===r?" selected":""}>${r}</option>`).join("")}</select></td><td style="text-align:right"><button class="btn small" data-pw="${esc(m.email)}">Set password</button> <button class="btn small danger" data-rm="${esc(m.email)}">Remove</button></td></tr>`).join("")}</tbody></table>`; };
    load();
    $("uG").onclick=()=>$("uP").value=suggestPw();
    $("uA").onclick=async()=>{ const {error}=await rpc($("uE").value.trim(),$("uR").value,$("uP").value||null); if(error){ msg(false,/pd_admin_save_user|PGRST202/.test(error.message)?"Run supabase/pd-schema.sql first.":error.message); return; } msg(true,`Added. Send them: ${location.origin+location.pathname} · ${$("uE").value.trim()} · ${$("uP").value}`); $("uE").value=""; $("uP").value=""; load(); };
    $("uL").onchange=async e=>{ const s=e.target.closest("[data-role]"); if(!s) return; const {error}=await rpc(s.dataset.role,s.value,null); msg(!error,error?error.message:"Role changed."); };
    $("uL").onclick=async e=>{ const p=e.target.closest("[data-pw]"), r=e.target.closest("[data-rm]");
      if(p){ const v=prompt("New password for "+p.dataset.pw+" (8+ characters):",suggestPw()); if(!v) return; const {error}=await rpc(p.dataset.pw,null,v); msg(!error,error?error.message:`Password set for ${p.dataset.pw}: ${v}`); }
      if(r){ if(!confirm("Remove "+r.dataset.rm+"?")) return; const {error}=await sb.from("pd_members").delete().eq("org_id",S.org.id).eq("email",r.dataset.rm); msg(!error,error?error.message:"Removed."); load(); } };
  }
  if(t==="integration"){
    P.innerHTML=`<p style="margin-top:0">Balloon Inspector sends ballooning data here with its <b>Send to Process Documents</b> button. Link the Balloon Inspector workspace that belongs to this company, so data lands in this workspace automatically.</p>
      <label class="fld">Balloon Inspector workspace<select id="iBI"><option value="">— not linked (you'll be asked each time) —</option></select></label>
      <p class="hintline">This Process Documents workspace ID: <code>${esc(S.org.id)}</code></p><div id="adMsg" class="err"></div><div class="addrow"><button class="btn primary" id="aSave">Save link</button></div>`;
    const {data,error}=await sb.from("bi_orgs").select("id,name").order("name");
    if(error) msg(false,"Balloon Inspector isn't in this Supabase project, or you aren't a member of any of its workspaces.");
    else $("iBI").innerHTML+= (data||[]).map(o=>`<option value="${o.id}"${st.bi_org_id===o.id?" selected":""}>${esc(o.name)}</option>`).join("");
    $("aSave").onclick=async()=>{ const s=Object.assign({},S.org.settings||{},{bi_org_id:$("iBI").value||null}); try{ await saveOrg({settings:s}); msg(true,"Saved."); }catch(e){ msg(false,e.message); } };
  }
  if(t==="workspaces"){
    P.innerHTML=`<p class="hintline" style="margin-top:0">Each customer company gets its own private workspace with its own users, logo, masters and projects.</p>
      <div class="frm" style="align-items:end"><label class="fld">Company name<input id="wN"></label><label class="fld">Admin e-mail<input id="wE" type="email"></label><label class="fld">Admin password (new users)<input id="wP"></label><button class="btn primary" id="wC">Create workspace</button></div>
      <div id="adMsg" class="err"></div><div id="wL">Loading…</div>`;
    const load=async()=>{ const {data,error}=await sb.from("pd_orgs").select("id,name,created_at").order("name"); if(error){ $("wL").textContent=error.message; return; }
      $("wL").innerHTML=`<table class="plist"><thead><tr><th>Company</th><th>Created</th><th></th></tr></thead><tbody>${data.map(o=>`<tr><td>${esc(o.name)}</td><td>${esc(String(o.created_at).slice(0,10))}</td><td style="text-align:right"><button class="btn small" data-join="${o.id}">Add me as admin</button></td></tr>`).join("")}</tbody></table>`; };
    load();
    $("wC").onclick=async()=>{ const name=$("wN").value.trim(), em=$("wE").value.trim(); if(!name||!em){ msg(false,"Enter company name and admin e-mail."); return; }
      const {data,error}=await sb.from("pd_orgs").insert({name,settings:{companyName:name}}).select("id").single(); if(error){ msg(false,error.message); return; }
      const {error:e2}=await sb.rpc("pd_admin_save_user",{p_org:data.id,p_email:em,p_role:"admin",p_password:$("wP").value||null}); msg(!e2,e2?e2.message:"Workspace created. Reload to see it in your workspace list if you added yourself."); load(); };
    $("wL").onclick=async e=>{ const b=e.target.closest("[data-join]"); if(!b) return; const {error}=await sb.from("pd_members").upsert({org_id:b.dataset.join,email:(S.user.email||"").toLowerCase(),role:"admin"}); msg(!error,error?error.message:"Added – reload the page to switch to it."); };
  }
}

/* ---------------- boot ---------------- */
window.PDApp = { S, openAdmin, partFromOps, pick, applyHeaderDefaults, setFavicon, changed, refreshChip, regenFromPlan, rerun, regenOne, save, exportDoc, exportAll, toast, busy, welcomeHTML, bindWelcome, go };
if(CLOUD){
  sb.auth.onAuthStateChange(ev=>{ if(ev==="PASSWORD_RECOVERY") newPasswordScreen(); });
  (async()=>{ const {data:{session}}=await sb.auth.getSession(); if(!session) loginScreen(); else start(); })();
} else start();
})();
