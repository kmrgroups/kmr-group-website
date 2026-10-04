/* =====================================================================
   Process Documents – automation engine
   Ballooning data  →  feature analysis  →  process route  →  machines,
   tools, consumables, gauges  →  PFD, PFMEA (AIAG-VDA), Control Plan
   (AIAG), SOP, inspection reports, SPC/MSA studies, master lists.
   Pure functions; no DOM. Shared by every deployment.
   ===================================================================== */
(function(){
"use strict";

/* ---------------- small helpers ---------------- */
const num = v => (v===""||v==null||isNaN(+v)) ? null : +v;
const r4 = v => v==null ? null : Math.round(v*10000)/10000;
const fmt = v => v==null ? "" : String(r4(v));
const fmtTol = v => v==null ? "" : v===0 ? "0" : (v>0?"+":"−")+fmt(Math.abs(v));
const up = s => String(s||"").toUpperCase();
const uniq = a => [...new Set(a.filter(Boolean))];
const today = () => new Date().toISOString().slice(0,10);
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const pad = (n,w=2) => String(n).padStart(w,"0");

/* ---------------- default masters (admin can edit) ---------------- */
const DEFAULT_MACHINES = [
  {id:"M-01", name:"Horizontal bandsaw",           make:"", model:"", capacity:"Ø 10–300 mm bar",        keys:["CUT"],               maxDia:300, cap:0.5,   location:"Cutting bay",   pm:"Monthly"},
  {id:"M-02", name:"CNC turning centre (8\" chuck)", make:"", model:"", capacity:"Swing Ø 350, turn Ø 200, L 300", keys:["TURN1","TURN2"], maxDia:200, cap:0.010, location:"Machine shop", pm:"Monthly"},
  {id:"M-03", name:"CNC turning centre (10\" chuck)",make:"", model:"", capacity:"Swing Ø 500, turn Ø 320, L 500", keys:["TURN1","TURN2"], maxDia:320, cap:0.012, location:"Machine shop", pm:"Monthly"},
  {id:"M-04", name:"Vertical machining centre (3-axis)", make:"", model:"", capacity:"X 850 · Y 500 · Z 500, 10k rpm", keys:["VMC"],   maxDia:600, cap:0.010, location:"Machine shop", pm:"Monthly"},
  {id:"M-05", name:"Horizontal machining centre (4-axis)",make:"",model:"", capacity:"Pallet 500×500, B-axis",   keys:["VMC"],             maxDia:700, cap:0.008, location:"Machine shop", pm:"Monthly"},
  {id:"M-06", name:"Radial drilling machine",       make:"", model:"", capacity:"Drill Ø 50, arm 1250",     keys:["DRILL"],             maxDia:1000,cap:0.05,  location:"Machine shop", pm:"Quarterly"},
  {id:"M-07", name:"Gear hobbing machine",          make:"", model:"", capacity:"Module 0.5–6, Ø 250",      keys:["HOB"],               maxDia:250, cap:0.010, location:"Gear shop",    pm:"Monthly"},
  {id:"M-08", name:"Slotting / broaching machine",  make:"", model:"", capacity:"Stroke 250",               keys:["BROACH"],            maxDia:400, cap:0.02,  location:"Gear shop",    pm:"Quarterly"},
  {id:"M-09", name:"CNC cylindrical grinder",       make:"", model:"", capacity:"Ø 250 × L 500",            keys:["CGRIND"],            maxDia:250, cap:0.003, location:"Grinding",     pm:"Monthly"},
  {id:"M-10", name:"Internal grinding machine",     make:"", model:"", capacity:"Bore Ø 5–150",             keys:["IGRIND"],            maxDia:150, cap:0.003, location:"Grinding",     pm:"Monthly"},
  {id:"M-11", name:"Surface grinding machine",      make:"", model:"", capacity:"Table 600×300",            keys:["SGRIND"],            maxDia:600, cap:0.003, location:"Grinding",     pm:"Monthly"},
  {id:"M-12", name:"Vertical honing machine",       make:"", model:"", capacity:"Bore Ø 3–120",             keys:["HONE"],              maxDia:120, cap:0.002, location:"Grinding",     pm:"Monthly"},
  {id:"M-13", name:"Deburring bench with air tools",make:"", model:"", capacity:"—",                        keys:["DEBURR"],            maxDia:9999,cap:1,     location:"Finishing",    pm:"Quarterly"},
  {id:"M-14", name:"Parts washing machine",         make:"", model:"", capacity:"Basket 600×400",           keys:["WASH"],              maxDia:9999,cap:1,     location:"Finishing",    pm:"Monthly"},
  {id:"M-15", name:"Laser marking machine",         make:"", model:"", capacity:"Field 110×110",            keys:["MARK"],              maxDia:9999,cap:1,     location:"Finishing",    pm:"Quarterly"},
  {id:"M-16", name:"Inspection table & surface plate",make:"",model:"", capacity:"Grade 0, 1000×630",       keys:["RMI","FINAL","PDI"], maxDia:9999,cap:0.001, location:"Quality lab",  pm:"Yearly"},
  {id:"M-17", name:"CMM",                            make:"", model:"", capacity:"700×1000×600",             keys:["FINAL"],             maxDia:9999,cap:0.002, location:"Quality lab",  pm:"Half-yearly"},
  {id:"M-18", name:"Packing table & weighing scale", make:"", model:"", capacity:"30 kg",                    keys:["PACK"],              maxDia:9999,cap:1,     location:"Dispatch",     pm:"Yearly"}
];
const DEFAULT_CONSUMABLES = {
  CUT:   ["Bandsaw blade (bi-metal)","Water-soluble coolant 5–8 %"],
  TURN1: ["Water-soluble cutting coolant 5–8 %","Slideway oil (ISO VG 68)","Hydraulic oil (ISO VG 46)","Cotton waste / wipers"],
  TURN2: ["Water-soluble cutting coolant 5–8 %","Slideway oil (ISO VG 68)","Hydraulic oil (ISO VG 46)","Cotton waste / wipers"],
  VMC:   ["Water-soluble cutting coolant 5–8 %","Tapping compound","Slideway oil (ISO VG 68)","Spindle oil","Cotton waste / wipers"],
  DRILL: ["Water-soluble cutting coolant 5–8 %","Tapping compound"],
  HOB:   ["Neat cutting oil","Slideway oil"],
  BROACH:["Neat cutting oil"],
  CGRIND:["Grinding coolant 3–5 %","Dressing diamond"],
  IGRIND:["Grinding coolant 3–5 %","Dressing diamond"],
  SGRIND:["Grinding coolant 3–5 %","Dressing diamond"],
  HONE:  ["Honing oil","Honing stones"],
  DEBURR:["Emery sheet (grit 120/220)","Scotch-Brite pad","Deburring blades"],
  WASH:  ["Alkaline washing chemical 2–3 %","Rust-preventive additive"],
  MARK:  ["—"],
  HT:    ["(Sub-contract) quench oil / furnace gases"],
  SURF:  ["(Sub-contract) plating chemicals"],
  PACK:  ["Rust-preventive oil (dewatering)","VCI bag","Corrugated box / plastic bin","Separators / layer pads","Part identification label"],
  RMI:   ["—"], FINAL:["Cleaning solvent","Lint-free cloth"], PDI:["Lint-free cloth"]
};

/* ---------------- ISO coarse thread pitch ---------------- */
const COARSE = {1.6:0.35,2:0.4,2.5:0.45,3:0.5,4:0.7,5:0.8,6:1,8:1.25,10:1.5,12:1.75,14:2,16:2,18:2.5,20:2.5,22:2.5,24:3,27:3,30:3.5,33:3.5,36:4,42:4.5,48:5};

/* ---------------- source normalisation ---------------- */
/* Accepts a Balloon Inspector snapshot ({header, items, set}) or a CSV table. */
function normalizeSource(src){
  src = src || {};
  const h = Object.assign({partNo:"",partName:"",drawingNo:"",rev:"",customer:"",material:"",inspector:"",date:today()}, src.header||{});
  const items = (src.items||[]).map((it,i)=>({
    no: it.no!=null ? +it.no : i+1,
    type: it.type||"Linear", text: String(it.text||"").trim(), en: it.en||"",
    nominal: num(it.nominal), upper: num(it.upper), lower: num(it.lower), unit: it.unit||"mm",
    gdt: it.gdt||"", datum: it.datum||"", cls: up(it.cls||""), instr: it.instr||"",
    manualInstr: it.autoInstr===false, gen: !!it.gen, sheet: (it.sheet||0)+1, zone: it.zone||"",
    ax: it.ax, ay: it.ay
  }));
  if(!h.material){ const m = items.find(i=>i.type==="Material"); if(m) h.material = m.text.replace(/^material\s*:\s*/i,""); }
  return {header:h, chars:items, gen:(src.set&&src.set.gen)||"m", fileName:src.fileName||""};
}
function parseCSV(text){
  const rows=[]; let row=[], f="", q=false;
  for(let i=0;i<text.length;i++){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=c; }
    else if(c==='"') q=true; else if(c===","){ row.push(f); f=""; } else if(c==="\n"||c==="\r"){ if(c==="\r"&&text[i+1]==="\n") i++; row.push(f); rows.push(row); row=[]; f=""; } else f+=c; }
  if(f||row.length){ row.push(f); rows.push(row); }
  return rows.filter(r=>r.some(x=>String(x).trim()));
}
/* Balloon Inspector "CSV" export → source */
function sourceFromCSV(text, fileName){
  const rows = parseCSV(text.replace(/^﻿/,"")); if(rows.length<2) throw new Error("The CSV has no rows.");
  const H = rows[0].map(s=>s.trim().toLowerCase().replace(/[^a-z]/g,""));
  const col = (...names) => { for(const n of names){ const i=H.indexOf(n); if(i>=0) return i; } return -1; };
  const c = {no:col("no","balloon","balloonno","sno","slno"), sheet:col("sheet"), zone:col("zone"), type:col("type"), text:col("specification","spec","text","characteristic","description"),
    gdt:col("gdt"), datum:col("datum"), nominal:col("nominal"), upper:col("uppertol","upper","utol"), lower:col("lowertol","lower","ltol"), unit:col("unit"), cls:col("class","cls","special"), instr:col("instrument","gauge","instr")};
  if(c.text<0 && c.nominal<0) throw new Error("This CSV doesn't look like a Balloon Inspector export (no Specification / Nominal columns).");
  const g = (r,k) => c[k]>=0 ? String(r[c[k]]??"").trim() : "";
  const items = rows.slice(1).map((r,i)=>({ no:+g(r,"no")||i+1, sheet:Math.max(0,(+g(r,"sheet")||1)-1), zone:g(r,"zone"), type:g(r,"type")||"Linear", text:g(r,"text"),
    gdt:g(r,"gdt"), datum:g(r,"datum"), nominal:g(r,"nominal"), upper:g(r,"upper"), lower:g(r,"lower"), unit:g(r,"unit")||"mm", cls:g(r,"cls"), instr:g(r,"instr"), autoInstr:true }));
  const base = (fileName||"").replace(/_characteristics\.csv$/i,"").replace(/\.csv$/i,"");
  return {header:{partNo:base, drawingNo:base}, items, fileName};
}

/* ---------------- feature analysis ---------------- */
function countOf(t){ const m = String(t).match(/^\s*(\d+)\s*[xX×]\s*/) || String(t).match(/\b(\d+)\s*(?:HOLES|PLACES|PLCS|POS)\b/i); return m ? +m[1] : 1; }
function parseThread(t){
  const s = String(t).replace(/\s+/g,"");
  let m = s.match(/M(\d+(?:\.\d+)?)(?:[xX×](\d+(?:\.\d+)?))?(?:-?(\d[gGhHeEfF]{1,2}))?/);
  if(m){ const d=+m[1], p=m[2]?+m[2]:(COARSE[d]||null), cls=m[3]||""; return {d,p,cls,name:`M${d}${m[2]?"×"+m[2]:""}${cls?"-"+cls:""}`,metric:true}; }
  m = String(t).match(/(\d+\/\d+|\d+(?:\.\d+)?)\s*[-–]\s*(\d+)\s*(UNC|UNF|UNEF|UN)(?:\s*[-–]\s*(\d[AB]))?/i);
  if(m) return {d:null,p:null,cls:m[4]||"",name:`${m[1]}-${m[2]} ${m[3].toUpperCase()}${m[4]?"-"+m[4]:""}`,metric:false,inch:true,internalHint:m[4]?/B/i.test(m[4]):null};
  m = String(t).match(/\b(G|R|RC|RP|NPT|NPTF|BSPP|BSPT)\s*(\d+(?:\/\d+)?(?:\s*\d\/\d)?)/i);
  if(m) return {d:null,p:null,cls:"",name:`${m[1].toUpperCase()} ${m[2]}`,metric:false,pipe:true};
  return {d:null,p:null,cls:"",name:String(t).trim()||"Thread",metric:false};
}
function fitOf(t){ const m = String(t).match(/[ØΦ⌀∅]?\s*\d+(?:[.,]\d+)?\s*([A-Za-z]{1,2})\s?(\d{1,2})\b/); if(!m) return null; if(/^(x|mm|deg|ra|rz|thru|m)$/i.test(m[1])) return null; return {letter:m[1], grade:+m[2], hole:m[1]===m[1].toUpperCase(), code:m[1]+m[2]}; }

const HOLE_RX = /\b(THRU|THROUGH|DEEP|DP|DRILL|DRL|BORE|C'?BORE|CBORE|CSK|C'?SINK|REAM|TAP|TAPPED|HOLE|HOLES|I\.?D\.?|PCD|P\.C\.D)\b|[⌴⌵↧]/i;
const MILL_RX = /\b(SLOT|KEYWAY|KEY\s*WAY|FLAT|FLATS|A\/F|AF|ACROSS\s*FLATS|HEX|POCKET|STEP|WIDTH|PCD|P\.C\.D|CROSS|SQUARE|WRENCH)\b/i;
const GEAR_RX = /\b(SPLINE|SERRATION|MODULE|TEETH|NO\.?\s*OF\s*TEETH|GEAR|INVOLUTE|DP\s*\d)\b/i;
const GROOVE_RX = /\b(GROOVE|UNDERCUT|U\/C|RECESS|CIRCLIP|RELIEF|NECK)\b/i;

function tolBand(c){ if(c.upper==null&&c.lower==null) return null; if(c.upper!=null&&c.lower!=null) return Math.abs(c.upper-c.lower); return Math.abs(c.upper??c.lower); }
function limits(c){
  if(c.type==="GD&T"||c.type==="Surface finish"){ return [null, c.upper!=null ? r4(c.upper) : null]; }
  if(c.nominal==null) return [null,null];
  return [c.lower!=null ? r4(c.nominal+c.lower) : null, c.upper!=null ? r4(c.nominal+c.upper) : null];
}
function isInternal(c){
  const t = c.text||"";
  if(c.type==="Thread"){ const th=parseThread(t); if(th.inch&&th.internalHint!=null) return th.internalHint;
    if(/-?\d[HG]\b/.test(t.replace(/\s/g,""))) return true; if(/-?\d[gfeh]\b/.test(t.replace(/\s/g,""))) return false;
    if(/\b(TAP|TAPPED|DEEP|DP|THD\s*DEPTH|HOLE)\b|↧/i.test(t)) return true; if(countOf(t)>1) return true; return !(th.d && th.d>=20); }
  if(c.type!=="Diameter") return false;
  const f = fitOf(t); if(f) return f.hole;
  if(HOLE_RX.test(t)) return true;
  if(c.upper!=null && c.lower!=null){ if(c.upper>0 && c.lower>=0) return true; if(c.upper<=0 && c.lower<0) return false; }
  return countOf(t)>1;
}
const GDT_TURN = /runout|concentric|circular|cylindric|straight|coaxial/i;
const GDT_FACE = /flat|parallel|perpendic|angular/i;
const GDT_POS  = /position|symmetr|profile/i;

function materialClass(m){
  const s = up(m);
  if(/STAINLESS|\bSS\s?\d|\bAISI\s?(3|4)\d\d|\b(304|316|410|420|431)\b|17-4|X\d+CR/.test(s)) return "M";
  if(/\bFG\s?\d|GJL|GREY|GRAY|CAST\s*IRON|\bCI\b|\bSG\s?\d|GJS|DUCTILE|MALLEABLE/.test(s)) return "K";
  if(/ALUMIN|\bAL\b|\bAL\s?\d|6061|6063|6082|7075|2014|ADC\s?\d|\bLM\s?\d|A356|BRASS|CUZN|BRONZE|COPPER|\bCU\b|DELRIN|NYLON|POM|PTFE|ACETAL/.test(s)) return "N";
  return "P";
}
const MATCLS_TXT = {P:"Steel (ISO P)",M:"Stainless steel (ISO M)",K:"Cast iron (ISO K)",N:"Non-ferrous (ISO N)",H:"Hardened steel (ISO H)"};
const VC = {P:[180,220],M:[140,180],K:[150,200],N:[300,450],H:[80,120]};
const GRADE = {P:"P25 CVD-coated carbide",M:"M25 PVD-coated carbide",K:"K20 CVD-coated carbide",N:"N10 uncoated polished carbide",H:"CBN / H10 coated carbide"};

/* notes → process needs */
function readNotes(chars, header){
  const txt = up(chars.filter(c=>c.type==="Note"||c.type==="Material").map(c=>c.text+" "+(c.en||"")).join(" | ")+" | "+header.material+" | "+(header.partName||""));
  const n = {text:txt};
  n.ht = /HARDEN|HRC|HRB|HB\b|HV\b|CASE\s*(DEPTH|HARD)|CARBURI|NITRID|INDUCTION|QUENCH|TEMPER|HEAT\s*TREAT|\bH\.?T\.?\b|THROUGH\s*HARD|NORMALI|ANNEAL|STRESS\s*REL/.test(txt);
  n.htType = /CARBURI|CASE\s*CARB/.test(txt)?"Case carburising, hardening & tempering":/NITRID/.test(txt)?"Gas nitriding":/INDUCTION/.test(txt)?"Induction hardening & tempering":/NORMALI/.test(txt)?"Normalising":/ANNEAL/.test(txt)?"Annealing":/STRESS\s*REL/.test(txt)?"Stress relieving":"Through hardening & tempering";
  const hard = txt.match(/(\d{2,3})\s*[-–~TO]+\s*(\d{2,3})\s*(HRC|HRB|HB|HV)/) || txt.match(/(HRC|HRB|HB|HV)\s*(\d{2,3})\s*[-–~TO]+\s*(\d{2,3})/);
  n.hardness = hard ? (isNaN(+hard[1]) ? `${hard[2]}–${hard[3]} ${hard[1]}` : `${hard[1]}–${hard[2]} ${hard[3]}`) : (n.ht?"As per drawing":"");
  const cd = txt.match(/CASE\s*DEPTH\s*[:=]?\s*(\d+(?:\.\d+)?\s*[-–~TO]+\s*\d+(?:\.\d+)?)/); n.caseDepth = cd ? cd[1].replace(/\s+/g,"")+" mm" : "";
  n.surf = /ZINC|\bZN\b|PLAT|ANODI[SZ]|BLACK\s*OXIDE|BLACKEN|BLACKODI|PHOSPHAT|POWDER\s*COAT|PAINT|PASSIVAT|NICKEL|CHROM|E-?COAT|ED\s*COAT|GALVAN|DACROMET|GEOMET|ZN-?NI/.test(txt);
  n.surfType = /ZN-?NI|ZINC\s*NICKEL/.test(txt)?"Zinc-nickel plating":/ZINC|\bZN\b|GALVAN/.test(txt)?"Zinc plating with passivation":/ANODI/.test(txt)?"Anodising":/BLACK\s*OXIDE|BLACKEN|BLACKODI/.test(txt)?"Black oxide (blackodising)":/PHOSPHAT/.test(txt)?"Phosphating":/POWDER/.test(txt)?"Powder coating":/E-?COAT|ED\s*COAT/.test(txt)?"ED coating":/NICKEL/.test(txt)?"Nickel plating":/CHROM/.test(txt)?"Hard chrome plating":/PASSIVAT/.test(txt)?"Passivation":/DACROMET|GEOMET/.test(txt)?"Zinc-flake coating":/PAINT/.test(txt)?"Painting":"Surface treatment";
  const th = txt.match(/(\d+(?:\.\d+)?)\s*[-–~TO]+\s*(\d+(?:\.\d+)?)\s*(µM|UM|MICRON|MIC)/); n.coat = th ? `${th[1]}–${th[2]} µm` : "";
  const ss = txt.match(/(\d{2,4})\s*(HRS?|HOURS)\s*(NSS|SALT\s*SPRAY|SST|WHITE|RED)/) || txt.match(/SALT\s*SPRAY[^|]{0,20}?(\d{2,4})\s*(HRS?|HOURS)/); n.saltSpray = ss ? ss[1]+" hrs salt spray" : "";
  n.deburr = /BURR|SHARP\s*EDGE|BREAK\s*(ALL\s*)?(SHARP\s*)?(EDGES|CORNERS)|EDGES?\s*BROKEN/.test(txt) || true;
  n.mark = /\bMARK|ENGRAV|LASER\s*ETCH|STAMP|IDENTIFICATION|PART\s*NO\.?\s*TO\s*BE/.test(txt);
  n.markText = n.mark ? "Part no., date code & supplier code (as per drawing)" : "";
  n.clean = /CLEANLINESS|CLEAN\s*AND\s*FREE|FREE\s*FROM\s*(CHIPS|BURRS|DIRT|OIL)|RESIDUE|MILLIPORE|ISO\s*16232/.test(txt);
  n.leak = /LEAK|PRESSURE\s*TEST|AIR\s*TIGHT|HYDRO\s*TEST/.test(txt);
  n.crack = /CRACK|MPI|MAGNAFLUX|MAGNETIC\s*PARTICLE|DYE\s*PEN/.test(txt);
  n.balance = /BALANC/.test(txt);
  n.safety = /SAFETY|STATUTORY|REGULATORY|HOMOLOGATION|\bCC\b|CRITICAL/.test(txt);
  n.casting = /CAST(ING)?\b|DIE\s*CAST|GRAVITY\s*CAST|\bADC\s?\d|\bLM\s?\d|A356|\bFG\s?\d|GJL|\bSG\s?\d|GJS/.test(txt);
  n.forging = /FORG/.test(txt);
  return n;
}
function partFamily(chars, header){
  const pn = up(header.partName);
  if(/SHAFT|PIN\b|BUSH|SLEEVE|SPACER|\bNUT\b|WASHER|RING\b|ROLLER|AXLE|SPINDLE|PISTON|PLUNGER|COLLAR|FLANGE|HUB\b|PULLEY|GEAR|BOLT|STUD|NOZZLE|ADAPTOR|ADAPTER|FITTING|UNION|PLUG\b|CAP\b|DISC|DISK|WHEEL|BEARING|CONNECTOR|ROD\b|SCREW|VALVE\s*SEAT|INSERT/.test(pn)) return "rotational";
  if(/BRACKET|PLATE|BLOCK|HOUSING|COVER|BASE\b|MANIFOLD|LEVER|ARM\b|CLAMP|BODY|FRAME|CARRIER|SUPPORT|MOUNT|RAIL|BAR\b|CHANNEL|PANEL|STRIP|YOKE|FORK|CASE\b|CASING/.test(pn)) return "prismatic";
  const dims = chars.filter(c=>["Linear","Diameter","Radius","Angle","Chamfer","Thread"].includes(c.type));
  const dia = chars.filter(c=>c.type==="Diameter" && countOf(c.text)===1);
  const pos = chars.filter(c=>c.type==="GD&T" && GDT_POS.test(c.gdt+" "+c.text)).length;
  const run = chars.filter(c=>c.type==="GD&T" && GDT_TURN.test(c.gdt+" "+c.text)).length;
  if(!dims.length) return "prismatic";
  const score = dia.length/dims.length + run*0.08 - pos*0.06;
  return (dia.length>=2 && score>=0.3) ? "rotational" : "prismatic";
}

/* ---------------- characteristic → operation ---------------- */
function nearest(c, chars){ let best=null, bd=1e18;
  for(const o of chars){ if(o===c||o.sheet!==c.sheet||o.ax==null||c.ax==null) continue; if(!["Linear","Diameter","Radius","Chamfer","Angle","Thread","GD&T"].includes(o.type)) continue;
    const d=Math.hypot(o.ax-c.ax,o.ay-c.ay); if(d<bd){bd=d;best=o;} } return best; }

function assignOp(c, ctx){
  const t = c.text+" "+(c.en||""), T=up(t), band=tolBand(c), fam=ctx.family, internal=isInternal(c), cnt=countOf(c.text);
  const gd = (c.gdt||"")+" "+t;
  if(c.type==="Material") return "RMI";
  if(c.type==="Note"){
    if(/HRC|HRB|HARDNESS|CASE\s*DEPTH|CARBURI|NITRID|INDUCTION|HARDEN|TEMPER|HEAT\s*TREAT/.test(T)) return ctx.notes.ht?"HT":"RMI";
    if(/ZINC|\bZN\b|PLAT|ANODI|BLACK|PHOSPHAT|COAT|PAINT|PASSIVAT|NICKEL|CHROM|GALVAN|SALT\s*SPRAY/.test(T)) return "SURF";
    if(/BURR|SHARP|EDGES/.test(T)) return "DEBURR";
    if(/MARK|ENGRAV|STAMP|ETCH/.test(T)) return "MARK";
    if(/LEAK|PRESSURE\s*TEST/.test(T)) return "LEAK";
    if(/CRACK|MPI|MAGNAFLUX/.test(T)) return "CRACK";
    if(/CLEAN|RESIDUE|CHIPS/.test(T)) return "WASH";
    if(/MATERIAL|MAT'L|GRADE/.test(T)) return "RMI";
    return "FINAL";
  }
  if(GEAR_RX.test(T)) return internal||/INTERNAL|BORE/.test(T) ? "BROACH" : "HOB";
  if(/KEYWAY|KEY\s*WAY/.test(T) && (internal||/BORE|HUB/.test(T))) return "BROACH";
  if(c.type==="Surface finish"){
    const nb = nearest(c, ctx.chars), ra = c.upper;
    const base = nb ? (nb._op || assignOp(nb, ctx)) : (fam==="rotational"?"TURN":"VMC");
    if(ra!=null && ra<=0.4){ if(nb && nb.type==="Diameter") return isInternal(nb) ? (ra<=0.2?"HONE":"IGRIND") : "CGRIND"; return fam==="rotational"&&!(nb&&nb.type==="Linear") ? "CGRIND" : "SGRIND"; }
    return base;
  }
  if(c.type==="Thread"){ if(fam==="rotational"){ return internal ? (cnt>1?"VMC":"TURN") : "TURN"; } return "VMC"; }
  if(c.type==="GD&T"){
    if(GDT_POS.test(gd)) return fam==="rotational" && /profile/i.test(gd) ? "TURN" : "VMC";
    if(GDT_TURN.test(gd)){ if(band!=null && band<=0.008) return ctx.hasTightInt&&/cylind|circular/i.test(gd)&&ctx.tightIntOnly ? "HONE" : "CGRIND"; return fam==="rotational"?"TURN":"VMC"; }
    if(GDT_FACE.test(gd)){ if(band!=null && band<=0.008) return fam==="rotational"?"CGRIND":"SGRIND"; return fam==="rotational"?"TURN":"VMC"; }
    return fam==="rotational"?"TURN":"VMC";
  }
  if(c.type==="Diameter"){
    if(fam==="rotational"){
      if(cnt>1 || /PCD|P\.C\.D|CROSS/i.test(T)) return "VMC";
      if(internal){ if(band!=null && band<=0.013) return (c.nominal!=null&&c.nominal<=120) ? "HONE" : "IGRIND"; if(band!=null&&band<=0.016) return "IGRIND"; return "TURN"; }
      if(band!=null && band<=0.016) return "CGRIND"; return "TURN";
    }
    if(internal && band!=null && band<=0.012 && c.nominal>=6) return "HONE";
    return "VMC";
  }
  if(c.type==="Linear"){
    if(fam==="rotational"){ if(MILL_RX.test(T)) return "VMC"; if(band!=null&&band<=0.008) return "CGRIND"; return "TURN"; }
    if(band!=null && band<=0.008) return "SGRIND"; return "VMC";
  }
  if(["Radius","Chamfer","Angle"].includes(c.type)) return fam==="rotational" && !MILL_RX.test(T) ? "TURN" : "VMC";
  return fam==="rotational"?"TURN":"VMC";
}

/* ---------------- operation catalogue ---------------- */
const OPS = {
  OTHER: {rank:50, name:"Other process", sym:"op", inHouse:true},
  RMI:   {rank:0,  name:"Raw material receiving & inspection", sym:"insp",  inHouse:true},
  RMSTORE:{rank:1, name:"Raw material storage (identified & tagged)", sym:"store", inHouse:true},
  CUT:   {rank:2,  name:"Bar cutting / sawing",                   sym:"op",   inHouse:true},
  TURN1: {rank:3,  name:"CNC turning – OP 1 (first side)",       sym:"opi",  inHouse:true},
  TURN2: {rank:4,  name:"CNC turning – OP 2 (second side)",      sym:"opi",  inHouse:true},
  TURN:  {rank:3,  name:"CNC turning",                            sym:"opi",  inHouse:true},
  VMC:   {rank:5,  name:"VMC – milling, drilling & tapping",     sym:"opi",  inHouse:true},
  DRILL: {rank:5.5,name:"Drilling & tapping",                     sym:"opi",  inHouse:true},
  HOB:   {rank:6,  name:"Gear / spline hobbing",                  sym:"opi",  inHouse:true},
  BROACH:{rank:7,  name:"Keyway / spline broaching",              sym:"opi",  inHouse:true},
  DEBURR:{rank:8,  name:"Deburring",                              sym:"op",   inHouse:true},
  HT:    {rank:9,  name:"Heat treatment (sub-contract)",          sym:"op",   inHouse:false},
  HTINSP:{rank:9.5,name:"Hardness verification after heat treatment", sym:"insp", inHouse:true},
  CGRIND:{rank:10, name:"Cylindrical grinding",                   sym:"opi",  inHouse:true},
  IGRIND:{rank:11, name:"Internal grinding",                      sym:"opi",  inHouse:true},
  SGRIND:{rank:12, name:"Surface grinding",                       sym:"opi",  inHouse:true},
  HONE:  {rank:13, name:"Honing",                                 sym:"opi",  inHouse:true},
  WASH:  {rank:14, name:"Washing & drying",                       sym:"op",   inHouse:true},
  SURF:  {rank:15, name:"Surface treatment (sub-contract)",       sym:"op",   inHouse:false},
  MARK:  {rank:16, name:"Part marking",                           sym:"op",   inHouse:true},
  CRACK: {rank:16.5,name:"Crack detection (MPI)",                 sym:"insp", inHouse:true},
  LEAK:  {rank:17, name:"Leak / pressure test",                   sym:"insp", inHouse:true},
  FINAL: {rank:18, name:"Final inspection",                       sym:"insp", inHouse:true},
  PACK:  {rank:19, name:"Rust preventive, packing & labelling",   sym:"op",   inHouse:true},
  PDI:   {rank:20, name:"Pre-dispatch inspection (PDI)",          sym:"insp", inHouse:true},
  FGSTORE:{rank:21,name:"Finished goods storage",                 sym:"store",inHouse:true},
  DISPATCH:{rank:22,name:"Dispatch to customer",                  sym:"move", inHouse:true}
};
const MFG_KEYS = ["CUT","TURN1","TURN2","TURN","VMC","DRILL","HOB","BROACH","CGRIND","IGRIND","SGRIND","HONE"];
const MACH_KEYS = ["TURN1","TURN2","TURN","VMC","DRILL","HOB","BROACH","CGRIND","IGRIND","SGRIND","HONE"];

/* ---------------- gauges ---------------- */
function bucket(v, step){ const lo=Math.floor((v||0)/step)*step; return `${lo}–${lo+step} mm`; }
function caliperRange(v){ return v<=150?"0–150 mm":v<=300?"0–300 mm":v<=600?"0–600 mm":"0–1000 mm"; }
function boreRange(v){ const r=[[6,10],[10,18],[18,35],[35,50],[50,100],[100,160],[160,250],[250,450]]; const x=r.find(a=>v>=a[0]&&v<=a[1]); return x?`${x[0]}–${x[1]} mm`:"—"; }
function specText(c){
  const t=c.text||"";
  if(c.type==="Thread") return parseThread(t).name + (/-\d[gGhH]/.test(t)?"":(isInternal(c)?" (6H)":" (6g)"));
  if(c.type==="Surface finish"){ const rz=/Rz/i.test(t); return `${rz?"Rz":"Ra"} ${fmt(c.upper??num((t.match(/\d+(\.\d+)?/)||[])[0]))} µm max`; }
  if(c.type==="GD&T") return `${c.gdt&&!/check symbol/i.test(c.gdt)?c.gdt:"GD&T"} ${/[ØΦ⌀∅]/.test(t)&&/position|coaxial|concentric/i.test(c.gdt+t)?"Ø":""}${fmt(c.upper)}${c.datum?" | "+c.datum.split(/[|,\s]+/).filter(Boolean).join(" | "):""}`.trim();
  if(c.type==="Material"||c.type==="Note") return t.replace(/^material\s*:\s*/i,"Material: ");
  const cnt=countOf(t), pre=(cnt>1?cnt+"× ":"")+(c.type==="Diameter"?"Ø":c.type==="Radius"?"R":"");
  const unit=c.type==="Angle"?"°":"";
  if(c.nominal==null) return t;
  const fit=fitOf(t);
  let tol="";
  if(c.upper!=null && c.lower!=null){ tol = Math.abs(c.upper+c.lower)<1e-9 && c.upper!==0 ? ` ±${fmt(Math.abs(c.upper))}` : ` ${fmtTol(c.upper)}/${fmtTol(c.lower)}`; }
  else if(c.upper!=null) tol=` ${fmtTol(c.upper)}`;
  if(c.type==="Angle") tol=tol.replace(/(\d)(?=\/|$)/g,"$1°");
  const ang = c.type==="Chamfer" ? ((t.replace(/^\s*\d+\s*[xX×]\s+/,"").match(/[xX×]\s*(\d+(?:\.\d+)?)\s*°?/)||[])[1]) : null;
  return `${pre}${fmt(c.nominal)}${unit}${ang?" × "+ang+"°":""}${fit?" "+fit.code:""}${tol}${c.gen?" *":""}`;
}
function charLabel(c){
  const map={Linear:"Length",Diameter:isInternal(c)?"Bore / hole Ø":"Outer Ø",Radius:"Radius",Angle:"Angle",Chamfer:"Chamfer",Thread:isInternal(c)?"Internal thread":"External thread","GD&T":(c.gdt&&!/check/i.test(c.gdt)?c.gdt:"Geometric tolerance"),"Surface finish":"Surface roughness",Material:"Material grade",Note:"Drawing note"};
  const T=up(c.text);
  let l = map[c.type]||c.type;
  if(c.type==="Linear"){ if(/DEEP|DEPTH|DP\b/.test(T)) l="Depth"; else if(/WIDTH|SLOT|KEYWAY/.test(T)) l=/KEYWAY/.test(T)?"Keyway width":"Slot width"; else if(/A\/F|AF\b|FLAT|HEX/.test(T)) l="Across flats"; else if(/PCD|P\.C\.D/.test(T)) l="PCD"; }
  if(c.type==="Diameter" && /PCD|P\.C\.D/.test(T)) l="PCD";
  if(c.type==="Note"){ if(/HRC|HARD/.test(T)) l="Hardness"; else if(/CASE/.test(T)) l="Case depth"; else if(/ZINC|PLAT|COAT|ANODI|BLACK|PHOSPH/.test(T)) l="Surface treatment"; else if(/BURR|SHARP/.test(T)) l="Burr-free / edges"; else if(/MARK|ENGRAV/.test(T)) l="Marking"; }
  return l;
}
function gaugeFor(c){
  const band=tolBand(c), nom=c.nominal||0, T=up(c.text), internal=isInternal(c);
  const G=(name,range,lc,type="Variable",extra={})=>Object.assign({name,range,lc,type},extra);
  switch(c.type){
    case "Diameter":
      if(/PCD|P\.C\.D/.test(T)) return G("CMM","700×1000×600","0.001 mm");
      if(internal){
        if(nom<3) return G("Pin gauge set","Ø"+fmt(nom),"—","Attribute");
        if(band!=null && band<=0.05){ if(nom<6) return G("Plain plug gauge GO/NO-GO","Ø"+fmt(nom)+(fitOf(c.text)?" "+fitOf(c.text).code:""),"—","Attribute"); return G("Dial bore gauge",boreRange(nom),"0.001 mm"); }
        return G("Digital vernier caliper",caliperRange(nom),"0.01 mm");
      }
      if(band!=null && band<=0.05) return G("Digital outside micrometer",bucket(nom,25),"0.001 mm");
      return G("Digital vernier caliper",caliperRange(nom),"0.01 mm");
    case "Linear":
      if(/DEEP|DEPTH|DP\b/.test(T)) return band!=null&&band<=0.05 ? G("Depth micrometer","0–100 mm","0.01 mm") : G("Depth vernier caliper",caliperRange(nom),"0.02 mm");
      if(/PCD|P\.C\.D|POSITION/.test(T)) return G("CMM","700×1000×600","0.001 mm");
      if(/SLOT|KEYWAY|WIDTH/.test(T) && band!=null && band<=0.05) return G("Slip gauge / slot plug gauge GO/NO-GO",fmt(nom)+" mm","—","Attribute");
      if(band!=null && band<=0.02) return G("Digital height gauge","0–300 mm","0.001 mm");
      if(band!=null && band<=0.05) return G("Digital outside micrometer",bucket(nom,25),"0.001 mm");
      return G("Digital vernier caliper",caliperRange(nom),"0.01 mm");
    case "Thread": { const th=parseThread(c.text); return G(internal?"Thread plug gauge GO/NO-GO":"Thread ring gauge GO/NO-GO",th.name+(th.cls?"":internal?"-6H":"-6g"),"—","Attribute"); }
    case "Radius": return band!=null&&band<=0.05 ? G("Profile projector","Magnification 10×","0.001 mm") : G("Radius gauge set",nom<=7?"R1–R7":nom<=15?"R7.5–R15":"R15–R25","—","Attribute");
    case "Chamfer": return G("Profile projector","Magnification 10×","0.001 mm");
    case "Angle": return band!=null&&band<=0.5 ? G("Profile projector","Magnification 10×","1′") : G("Universal bevel protractor","0–360°","5′");
    case "GD&T": { const g=(c.gdt||"")+" "+T;
      if(/position|symmetr|profile/i.test(g)) return G("CMM","700×1000×600","0.001 mm");
      if(/runout|concentric|coaxial/i.test(g)) return G("Dial indicator with bench centre / V-block","0–1 mm","0.001 mm");
      if(/circular|cylindric|round/i.test(g)) return band!=null&&band<=0.005 ? G("Roundness tester","—","0.0001 mm") : G("Dial indicator with V-block","0–1 mm","0.001 mm");
      if(/flat/i.test(g)) return G("Surface plate with dial indicator","Grade 0","0.001 mm");
      if(/parallel|perpendic|angular/i.test(g)) return G("Digital height gauge with dial indicator","0–300 mm","0.001 mm");
      if(/straight/i.test(g)) return G("Dial indicator with bench centre","0–1 mm","0.001 mm");
      return G("CMM","700×1000×600","0.001 mm"); }
    case "Surface finish": return G("Surface roughness tester","Ra 0.05–40 µm","0.01 µm");
    case "Material": return G("Material test certificate / spectrometer","—","—","Document");
    case "Note":
      if(/HRC|HRB|HARD/.test(T)) return G(/HB\b|BRINELL/.test(T)?"Brinell hardness tester":/HV\b|VICKERS/.test(T)?"Vickers hardness tester":"Rockwell hardness tester","20–70 HRC","0.5 HRC");
      if(/CASE/.test(T)) return G("Micro-hardness tester (lab, sectioned sample)","—","1 HV");
      if(/ZINC|PLAT|COAT|ANODI|PAINT|CHROM|NICKEL/.test(T)) return G("Coating thickness gauge","0–1500 µm","0.1 µm");
      return G("Visual","—","—","Visual");
  }
  return G("Digital vernier caliper",caliperRange(nom),"0.01 mm");
}
/* production / 100% gauge for special characteristics */
function productionGauge(c){
  const band=tolBand(c), nom=c.nominal||0, internal=isInternal(c);
  if(c.type==="Diameter" && band!=null && band<=0.1) return internal ? {name:"Plain plug gauge GO/NO-GO",range:"Ø"+fmt(nom)+(fitOf(c.text)?" "+fitOf(c.text).code:""),lc:"—",type:"Attribute"} : {name:"Snap gauge GO/NO-GO",range:"Ø"+fmt(nom)+(fitOf(c.text)?" "+fitOf(c.text).code:""),lc:"—",type:"Attribute"};
  if(c.type==="Linear" && band!=null && band<=0.1) return {name:"Step / length gauge GO/NO-GO",range:fmt(nom)+" mm",lc:"—",type:"Attribute"};
  if(c.type==="GD&T" && /position/i.test(c.gdt+" "+c.text)) return {name:"Position check fixture (functional gauge)",range:"Part specific",lc:"—",type:"Attribute"};
  return null;
}

/* ---------------- tools ---------------- */
const TAPDRILL={3:2.5,4:3.3,5:4.2,6:5,8:6.8,10:8.5,12:10.2,14:12,16:14,18:15.5,20:17.5,22:19.5,24:21,27:24,30:26.5,36:32};
function tapDrill(th){ if(!th.d||!th.p) return null; if(COARSE[th.d]===th.p&&TAPDRILL[th.d]) return TAPDRILL[th.d]; return Math.round((th.d-th.p)*10)/10; }
function toolsFor(op, chars, ctx){
  const mc=ctx.matCls, T=[], add=(desc,spec,holder,life,rem="")=>T.push({desc,spec,holder:holder||"",life:life||"",grade:/insert|drill|mill|tap|reamer|boring/i.test(desc+spec)?GRADE[mc]:"",remarks:rem});
  const life = mc==="N"?400:mc==="K"?250:mc==="M"?120:150;
  const dias = chars.filter(c=>c.type==="Diameter"), ext=dias.filter(c=>!isInternal(c)), int=dias.filter(c=>isInternal(c));
  const thr = chars.filter(c=>c.type==="Thread"), all=chars.map(c=>up(c.text)).join(" ");
  const k=op.key;
  if(k==="CUT"){ add("Bandsaw blade","Bi-metal M42, 27×0.9 mm, 4/6 TPI","—","As per blade life (cuts)"); }
  if(k.startsWith("TURN")){
    add("OD / face rough turning tool","Insert CNMG 120408","PCLNR 2525 M12",life+" pcs/edge");
    if(ext.some(c=>tolBand(c)!=null&&tolBand(c)<=0.05) || chars.some(c=>c.type==="Surface finish"&&c.upper<=1.6) || ext.length) add("OD finish turning / profiling tool","Insert VNMG 160404","PVJNR 2525 M16",Math.round(life*1.3)+" pcs/edge");
    if(int.length){ const mn=Math.min(...int.map(c=>c.nominal||99)); const dr=Math.max(3,Math.floor((mn-1.5)*2)/2);
      add(mn>=16?"U-drill (indexable)":"Solid carbide / HSS drill","Ø"+fmt(dr)+" mm","ER / Weldon holder",mn>=16?"600 holes":"800 holes");
      if(mn>=8) add("Boring bar (finish bore)","Insert CCMT 09T304",`S${Math.max(8,Math.min(32,Math.floor(mn*0.7/2)*2))}K-SCLCR 09`,Math.round(life*1.2)+" pcs/edge"); }
    if(GROOVE_RX.test(all)) add("Grooving / undercut tool","Grooving insert 3 mm, full radius","MGEHR 2525-3",life+" pcs/edge");
    ext.length && chars.some(c=>c.type==="Chamfer") && add("Chamfer (by finish turning tool)","— program-controlled","—","—","Covered by finish tool path");
    thr.filter(c=>!isInternal(c)).forEach(c=>{ const th=parseThread(c.text); add("External threading tool",`Insert 16ER ${th.p?fmt(th.p):"(pitch)"} ISO`,"SER 2525 M16",Math.round(life*0.8)+" pcs/edge",th.name); });
    thr.filter(c=>isInternal(c)).forEach(c=>{ const th=parseThread(c.text), td=tapDrill(th); if(td) add("Tap drill (thread core)","Ø"+fmt(td)+" mm","Collet ER32","800 holes",th.name); add("Machine tap",`${th.name}${th.cls?"":"-6H"} spiral-point / spiral-flute`,"Floating tap holder","1500 holes"); });
    if(ctx.bar) add("Parting-off / face tool","Parting blade 3 mm + insert","SMBB 2532","300 pcs/edge","Only if bar-fed");
  }
  if(k==="VMC"||k==="DRILL"){
    const lin = chars.filter(c=>c.type==="Linear"||(c.type==="GD&T"&&/flat|parallel|perpend/i.test(c.gdt+c.text)));
    if(lin.length && k==="VMC") add("Face mill","Ø63 mm, 45° insert SEKT 1204","BT40 shell mill arbor","200 pcs/edge set");
    const slot = chars.find(c=>/SLOT|KEYWAY|POCKET|STEP/i.test(c.text));
    if(k==="VMC") add("Carbide end mill (profile / pocket)",`Ø${slot&&slot.nominal&&slot.nominal<=20?fmt(slot.nominal):"10"} mm, 4-flute, TiAlN`,"BT40 side-lock / shrink holder","300 pcs");
    const holes = chars.filter(c=>c.type==="Diameter"&&isInternal(c));
    if(holes.length||thr.length) add("Spot / centre drill","Ø10 mm, 90° carbide","BT40 ER32 collet chuck","2000 holes");
    const seen=new Set();
    holes.forEach(c=>{ const d=c.nominal; if(d==null) return; const band=tolBand(c), fit=fitOf(c.text);
      if(d>25){ const key="B"+d; if(seen.has(key)) return; seen.add(key); add("Finish boring head","Ø"+fmt(d)+(fit?" "+fit.code:"")+" (micro-adjustable)","BT40 boring shank","400 pcs","Helical-interpolate rough with end mill"); return; }
      if(band!=null && band<=0.025){ const key="R"+d; if(seen.has(key)) return; seen.add(key); add("Drill (pre-ream)","Ø"+fmt(r4(d-0.2))+" mm carbide","BT40 hydraulic chuck","1500 holes"); add("Machine reamer","Ø"+fmt(d)+(fit?" "+fit.code:" H7")+" carbide","BT40 hydraulic chuck","3000 holes"); }
      else { const key="D"+d; if(seen.has(key)) return; seen.add(key); add("Drill","Ø"+fmt(d)+" mm carbide, through-coolant","BT40 hydraulic / ER collet chuck","1500 holes"); } });
    thr.forEach(c=>{ const th=parseThread(c.text), td=tapDrill(th), key="T"+th.name; if(seen.has(key)) return; seen.add(key);
      if(td){ add("Tap drill","Ø"+fmt(td)+" mm carbide","BT40 ER32 collet chuck","1500 holes",th.name); }
      if(th.d && th.d>24) add("Thread mill",th.name+" solid carbide","BT40 shrink holder","800 holes");
      else add("Machine tap",`${th.name}${th.cls?"":isInternal(c)?"-6H":"-6g"} ${/THRU/i.test(c.text)?"spiral-point":"spiral-flute"}`,"BT40 synchro tapping holder","1500 holes"); });
    if(chars.some(c=>c.type==="Chamfer")||holes.length) add("Chamfer mill","Ø12 mm, 90° carbide","BT40 ER32 collet chuck","2000 edges");
  }
  if(k==="HOB"){ const m=(chars.map(c=>c.text).join(" ").match(/MODULE\s*[:=]?\s*(\d+(?:\.\d+)?)|\bM\s*=\s*(\d+(?:\.\d+)?)/i)||[]); add("Hob",`Module ${m[1]||m[2]||"(as per drawing)"}, single start, class A, TiN`,"Hob arbor","Re-sharpen every 800 pcs"); }
  if(k==="BROACH"){ const w=chars.find(c=>/KEYWAY|SPLINE/i.test(c.text)); add("Keyway / spline broach",(w&&w.nominal?fmt(w.nominal)+" mm ":"")+"HSS-Co, TiN","Broach bush / collar","2000 pcs"); }
  if(k==="CGRIND") add("Grinding wheel","A60 K5 V, 400×50×127","Wheel flange","Dress every 20 pcs");
  if(k==="IGRIND") add("Internal grinding wheel","A80 K5 V mounted point","Quill","Dress every 10 pcs");
  if(k==="SGRIND") add("Surface grinding wheel","A46 H8 V, 200×20×31.75","Wheel flange","Dress every 30 pcs");
  if(k==="HONE") add("Honing stones / tool","Diamond / CBN stones, size to bore","Honing mandrel","5000 pcs");
  if(k==="DEBURR") add("Hand deburring tool","Swivel blade E100 + countersink","—","Replace blade when blunt");
  if(k==="MARK") add("Marking programme / fixture","Laser marking template","Marking fixture","—");
  return T;
}

/* ---------------- process parameters (for Control Plan / SOP / setup) ---------------- */
function paramsFor(op, ctx){
  const mc=ctx.matCls, vc=VC[mc]||VC.P, D=Math.max(10,ctx.maxOD||50), P=[];
  const rpm=(v,d)=>Math.round(1000*v/(Math.PI*d)/10)*10;
  const add=(name,spec,method,freq,resp="Operator")=>P.push({name,spec,method,freq,resp,kind:paramKind(name)});
  const k=op.key;
  if(k==="CUT") add("Cut length",`${fmt(r4((ctx.length||50)+3))} ±0.5 mm (finish length + 3 mm facing allowance)`,"Steel rule / vernier","First piece & every 50 pcs");
  if(k.startsWith("TURN")){ add("Cutting speed (Vc)",`${vc[0]}–${vc[1]} m/min (${MATCLS_TXT[mc]})`,"CNC program verification","Set-up");
    add("Spindle speed",`${rpm(vc[0],D)}–${rpm(vc[1],D)} rpm at Ø${fmt(D)} (CSS mode)`,"Machine display","Set-up & every 2 hrs");
    add("Feed rate","Rough 0.20–0.30 · Finish 0.08–0.15 mm/rev","CNC program","Set-up");
    add("Chuck clamping pressure","15–25 bar","Machine pressure gauge","Start of shift");
    add("Coolant concentration","5–8 %","Refractometer","Once per shift");
    add("Tool life","As per List of Tools (tool-life counter)","Tool-life counter","Continuous"); }
  if(k==="VMC"||k==="DRILL"){ add("Spindle speed (face mill Ø63)",`${rpm(vc[0],63)}–${rpm(vc[1],63)} rpm`,"CNC program / display","Set-up & every 2 hrs");
    add("Feed rate","0.10–0.15 mm/tooth (milling) · 0.08–0.20 mm/rev (drilling)","CNC program","Set-up");
    add("Fixture clamping pressure","40–60 bar (hydraulic) / torque as per fixture","Pressure gauge / torque wrench","Start of shift");
    add("Coolant concentration","5–8 %","Refractometer","Once per shift");
    add("Tool life","As per List of Tools (tool-life counter)","Tool-life counter","Continuous"); }
  if(k==="HOB"||k==="BROACH"){ add("Cutting speed",k==="HOB"?"60–90 m/min":"4–8 m/min","Machine setting","Set-up"); add("Cutting oil level","Between min–max","Visual","Start of shift"); }
  if(["CGRIND","IGRIND","SGRIND"].includes(k)){ add("Wheel peripheral speed","30–35 m/s","Machine display","Set-up"); add("Work speed","15–30 m/min","Machine display","Set-up");
    add("Dressing frequency",k==="IGRIND"?"Every 10 pcs":k==="CGRIND"?"Every 20 pcs":"Every 30 pcs","Dressing counter","Continuous"); add("Coolant concentration","3–5 %","Refractometer","Once per shift"); }
  if(k==="HONE"){ add("Honing pressure / stroke","As per honing sheet","Machine setting","Set-up"); add("Honing oil level & filtration","Min–max, filter clean","Visual","Start of shift"); }
  if(k==="HT"){ const n=ctx.notes; add("Heat-treatment process",n.htType,"Supplier HT certificate","Each lot","Supplier / QA");
    add("Hardening temperature",/CARBURI/.test(n.text)?"900–930 °C carburising, 820–850 °C hardening":/INDUCTION/.test(n.htType)?"Induction power & scan speed as per approved recipe":"840–870 °C, oil quench","Furnace chart / recipe","Each batch","Supplier");
    add("Tempering","180–220 °C × 2 hrs (or as per hardness target)","Furnace chart","Each batch","Supplier");
    if(n.hardness) add("Hardness",n.hardness,"Rockwell hardness tester","5 pcs / lot","QA");
    if(n.caseDepth) add("Case depth",n.caseDepth,"Micro-hardness on sectioned sample","1 pc / batch","Supplier / QA"); }
  if(k==="WASH"){ add("Wash solution temperature","50–60 °C","Temperature indicator","Every 4 hrs"); add("Chemical concentration","2–3 %","Titration / refractometer","Once per shift"); add("Drying","Parts dry, no water marks","Visual","Each basket"); }
  if(k==="SURF"){ const n=ctx.notes; add("Coating type",n.surfType,"Supplier certificate","Each lot","Supplier / QA"); add("Coating thickness",n.coat||"As per drawing / customer standard","Coating thickness gauge","5 pcs / lot","QA"); if(n.saltSpray) add("Corrosion resistance",n.saltSpray,"Salt-spray test report","Once per month / lot","Supplier"); }
  if(k==="MARK"){ add("Marking content",ctx.notes.markText||"As per drawing","Visual / scanner","Each part"); add("Marking depth / legibility","Legible, depth as per drawing","Visual","First piece & every 2 hrs"); }
  if(k==="PACK"){ add("Rust preventive oil","Applied on all surfaces, no dry patches","Visual","Each box"); add("Quantity per box","As per packing standard","Weighing scale / counting","Each box"); add("Label","Part no., rev., qty, lot / heat no., date","Visual","Each box"); }
  if(k==="CUT"){ add("Blade speed","40–80 m/min (as per material)","Machine setting","Set-up"); }
  if(k==="RMI"){ add("Material certificate (MTC)","Chemical & mechanical properties as per "+(ctx.header.material||"drawing material"),"MTC verification","Each heat / lot","QA"); add("Raw material size","As per RM specification","Vernier caliper","5 pcs / lot","QA"); }
  if(k==="LEAK") add("Test pressure & duration","As per drawing note","Leak tester","Each part");
  if(k==="CRACK") add("Magnetising current / ink concentration","As per MPI procedure","Ammeter / settling test","Start of shift");
  return P;
}

/* A parameter describes the PART (product characteristic) or the MACHINE / METHOD (process characteristic).
   Used by the Control Plan to put each item in the right column. */
const PRODUCT_PARAM_RX=/^(cut length|raw material size|material certificate|material grade|hardness|case depth|coating thickness|coating type|corrosion resistance|marking content|marking depth|quantity per box|label|burr|appearance|dimension|length|diameter|surface roughness|surface finish|core hardness|microstructure|cleanliness)/i;
function paramKind(name){ return PRODUCT_PARAM_RX.test(String(name||"").trim())?"product":"process"; }

/* ---------------- machine selection ---------------- */
function pickMachine(op, machines, ctx){
  const cand = machines.filter(m=>(m.keys||[]).includes(op.key) || ((m.keys||[]).includes("TURN1")&&op.key==="TURN"));
  if(!cand.length) return null;
  const need = Math.min(...op.chars.map(no=>{ const c=ctx.byNo[no]; const b=c&&tolBand(c); return b==null?1:b; }).concat([1]));
  const fits = cand.filter(m=>(m.maxDia||9999) >= (ctx.maxOD||0));
  const pool = fits.length ? fits : cand;
  // prefer the smallest machine that can hold the tightest tolerance with margin
  const ok = pool.filter(m=>(m.cap||0.01)*1.33 <= need);
  const list = (ok.length?ok:pool).slice().sort((a,b)=>(a.maxDia||0)-(b.maxDia||0));
  return list[0];
}

/* ======================================================================
   PLAN: route + resources
   ====================================================================== */
function buildPlan(source, masters, settings){
  masters = masters || {}; settings = settings || {};
  const src = normalizeSource(source), chars = src.chars, header = src.header;
  // strict = the lists come from the company's Operations Master: an empty list stays empty (no built-in defaults)
  const machines = masters.strict ? (masters.machines || []) : (masters.machines && masters.machines.length) ? masters.machines : DEFAULT_MACHINES;
  const notes = readNotes(chars, header);
  const family = partFamily(chars, header);
  const matCls = materialClass(header.material + " " + chars.filter(c=>c.type==="Material").map(c=>c.text).join(" "));
  const extDia = chars.filter(c=>c.type==="Diameter"&&!isInternal(c)&&c.nominal!=null).map(c=>c.nominal);
  const lens = chars.filter(c=>c.type==="Linear"&&c.nominal!=null).map(c=>c.nominal);
  const intTight = chars.filter(c=>c.type==="Diameter"&&isInternal(c)&&tolBand(c)!=null&&tolBand(c)<=0.013);
  const ctx = {chars, header, notes, family, matCls, maxOD: extDia.length?Math.max(...extDia):(lens.length?Math.max(...lens):50), length: lens.length?Math.max(...lens):null,
    byNo:{}, hasTightInt:intTight.length>0, tightIntOnly:intTight.length>0&&!chars.some(c=>c.type==="Diameter"&&!isInternal(c)&&tolBand(c)!=null&&tolBand(c)<=0.016),
    cast: notes.casting && !/BAR|ROD|EN\s?\d|C45|SAE/.test(up(header.material)), bar: family==="rotational"};
  chars.forEach(c=>ctx.byNo[c.no]=c);

  // 1) assign each characteristic (two passes so surface finish can follow its neighbour)
  chars.forEach(c=>{ if(c.type!=="Surface finish") c._op = assignOp(c, ctx); });
  chars.forEach(c=>{ if(c.type==="Surface finish") c._op = assignOp(c, ctx); });

  // 2) split turning into OP1 / OP2 by position on the drawing
  const turn = chars.filter(c=>c._op==="TURN");
  if(turn.length>=6){
    const xs = turn.filter(c=>c.ax!=null).map(c=>c.ax).sort((a,b)=>a-b), mid = xs.length ? xs[Math.floor(xs.length/2)] : 0;
    const maxLen = ctx.length;
    turn.forEach(c=>{ const g=(c.gdt||"")+" "+c.text; let k = (c.ax!=null && c.ax<mid) ? "TURN1" : "TURN2";
      if(c.type==="Linear" && c.nominal===maxLen) k="TURN2"; if(c.type==="GD&T" && GDT_TURN.test(g)) k="TURN2"; c._op=k; });
    if(!turn.some(c=>c._op==="TURN1")) turn.slice(0,Math.ceil(turn.length/2)).forEach(c=>c._op="TURN1");
  }
  // grinding needs HT order: grind after HT; if HT but no grinding, fine.
  const keys = new Set(chars.map(c=>c._op));
  keys.add("RMI"); keys.add("RMSTORE");
  if(!ctx.cast && !notes.forging) keys.add("CUT");
  if(family==="prismatic" && !ctx.cast) keys.add("CUT");
  if(notes.ht) { keys.add("HT"); keys.add("HTINSP"); }
  if(notes.surf) keys.add("SURF");
  if(notes.mark) keys.add("MARK");
  if(notes.leak) keys.add("LEAK");
  if(notes.crack) keys.add("CRACK");
  ["DEBURR","WASH","FINAL","PACK","PDI","FGSTORE","DISPATCH"].forEach(k=>keys.add(k));
  if(![...keys].some(k=>MACH_KEYS.includes(k))) keys.add(family==="rotational"?"TURN":"VMC");
  // chars for HT inspection
  chars.forEach(c=>{ if(c._op==="HT") c._op="HTINSP"; });
  keys.delete(undefined);

  const order = [...keys].filter(k=>OPS[k]).sort((a,b)=>OPS[a].rank-OPS[b].rank);
  let n = 0;
  const ops = order.map(k=>{ n+=10; const d=OPS[k];
    return {key:k, opNo:n, name:(k==="CUT"&&family==="prismatic")?(ctx.cast?"Casting receipt":"Blank cutting (plate / flat)"):(k==="RMI"&&ctx.cast?"Casting receiving & inspection":(k==="RMI"&&notes.forging?"Forging receiving & inspection":d.name)),
      sym:d.sym, inHouse:d.inHouse, chars: chars.filter(c=>c._op===k).map(c=>c.no), machineId:"", machine:"", tools:[], consumables:[], gauges:[], params:[] }; });
  const opByKey = {}; ops.forEach(o=>opByKey[o.key]=o);
  // final & PDI verify every dimensional characteristic
  const insp = chars.filter(c=>c.type!=="Note" || /HARD|COAT|PLAT|BURR|MARK/i.test(c.text)).map(c=>c.no);
  if(opByKey.FINAL) opByKey.FINAL.verify = insp;
  if(opByKey.PDI) opByKey.PDI.verify = chars.filter(c=>c.cls||c.type!=="Note").map(c=>c.no);

  // 3) resources for every operation
  const cons = masters.strict ? {} : Object.assign({}, DEFAULT_CONSUMABLES); (masters.consumables||[]).forEach(r=>{ if(r&&r.key) cons[r.key]=String(r.items||"").split("\n").map(s=>s.trim()).filter(Boolean); });
  ops.forEach(op=>{
    const oc = op.chars.map(no=>ctx.byNo[no]);
    const m = pickMachine(op, machines, ctx);
    if(m){ op.machineId=m.id; op.machine=m.name; }
    else if(!op.inHouse){ op.machine="Approved sub-contractor"; }
    else if(["RMSTORE","FGSTORE"].includes(op.key)) op.machine="Racks / bins (identified area)";
    else if(op.key==="DISPATCH") op.machine="Truck / tempo";
    else if(op.key==="HTINSP") { const h=machines.find(x=>/hardness/i.test(x.name)); op.machine=h?h.name:"Rockwell hardness tester"; op.machineId=h?h.id:""; }
    op.tools = toolsFor(op, oc, ctx);
    op.consumables = (cons[op.key]||cons[op.key.replace(/\d$/,"")]||[]).slice();
    op.params = paramsFor(op, ctx);
  });
  ["TURN","TURN1","TURN2"].forEach(k=>{ if(opByKey[k] && (opByKey.CGRIND||opByKey.IGRIND||opByKey.HONE)) opByKey[k].note="Leave 0.2–0.3 mm grinding / honing allowance on finish-ground diameters."; });

  // 4) gauges: pulled from ballooning data (instrument column), sized for range
  const gaugeReg = []; const gmaster = masters.gauges||[];
  const regGauge = (g, charNo, opNo) => {
    let e = gaugeReg.find(x=>x.name===g.name && x.range===g.range);
    if(!e){ const mm = gmaster.find(x=>norm(x.name)===norm(g.name) && norm(x.range)===norm(g.range)) || gmaster.find(x=>norm(x.name)===norm(g.name) && !x.range);
      e = {id: mm&&mm.id || "", name:g.name, range:g.range, lc:(mm&&mm.lc)||g.lc, type:g.type, chars:[], ops:[], calFreq:(mm&&mm.calFreq)||(g.type==="Attribute"?"6 months":g.type==="Variable"?"12 months":"—"), calDue:(mm&&mm.calDue)||"", location:(mm&&mm.location)||"", fromBalloon:!!g.fromBalloon};
      gaugeReg.push(e); }
    if(charNo!=null && !e.chars.includes(charNo)) e.chars.push(charNo); if(opNo!=null && !e.ops.includes(opNo)) e.ops.push(opNo); return e; };
  chars.forEach(c=>{
    let g = gaugeFor(c);
    if(c.manualInstr && c.instr) g = {name:c.instr, range:g.range, lc:g.lc, type:g.type, fromBalloon:true};
    else if(c.instr){ g.balloonInstr = c.instr; g.fromBalloon = true; }
    c._gauge = g; c._pgauge = (c.cls ? productionGauge(c) : null);
    const op = ops.find(o=>o.chars.includes(c.no));
    const e = regGauge(g, c.no, op&&op.opNo); c._gaugeRef=e;
    if(c._pgauge){ const e2=regGauge(c._pgauge, c.no, op&&op.opNo); c._pgaugeRef=e2; }
    if(opByKey.FINAL) regGauge(g, c.no, opByKey.FINAL.opNo);
  });
  let gi = 0; gaugeReg.forEach(e=>{ if(!e.id){ do{ gi++; } while(gmaster.some(x=>x.id==="G-"+pad(gi,3))); e.id = "G-"+pad(gi,3); } });
  ops.forEach(op=>{ op.gauges = gaugeReg.filter(g=>g.ops.includes(op.opNo)).map(g=>g.id); });
  if(opByKey.RMI && !opByKey.RMI.gauges.length){ const e=regGauge({name:"Digital vernier caliper",range:caliperRange(ctx.maxOD||100),lc:"0.01 mm",type:"Variable"},null,opByKey.RMI.opNo); if(!e.id){ gi++; e.id="G-"+pad(gi,3); } opByKey.RMI.gauges.push(e.id); }

  // 5) tool IDs
  let ti=0; ops.forEach(op=>op.tools.forEach(t=>{ ti++; t.id="T-"+pad(ti,3); }));

  const charsOut = chars.map(c=>({no:c.no, type:c.type, text:c.text, label:charLabel(c), spec:specText(c), nominal:c.nominal, upper:c.upper, lower:c.lower, unit:c.unit,
    lsl:limits(c)[0], usl:limits(c)[1], gdt:c.gdt, datum:c.datum, cls:c.cls, zone:c.zone, sheet:c.sheet, internal:isInternal(c), band:tolBand(c),
    gauge:c._gaugeRef?c._gaugeRef.id:"", pgauge:c._pgaugeRef?c._pgaugeRef.id:"", balloonInstr:c.instr||"", op:(ops.find(o=>o.chars.includes(c.no))||{}).opNo||"",
    variable: c._gauge && c._gauge.type==="Variable" && (limits(c)[0]!=null||limits(c)[1]!=null) }));

  return {
    version:1, generatedAt:new Date().toISOString(),
    header: Object.assign({
      partNo:header.partNo, partName:header.partName, drawingNo:header.drawingNo, drawingRev:header.rev, customer:header.customer, customerCode:"", customerPartNo:header.partNo,
      material:header.material, family, materialClass:MATCLS_TXT[matCls], phase:"Production", model:"", annualVolume:"",
      supplier:settings.companyName||"", supplierCode:settings.supplierCode||"", plant:settings.plant||"", keyContact:settings.keyContact||"", coreTeam:settings.coreTeam||"",
      preparedBy:settings.preparedBy||"", reviewedBy:settings.reviewedBy||"", approvedBy:settings.approvedBy||"", origDate:today(), revDate:today(), docRev:"00",
      generalTol: src.gen && src.gen!=="none" ? "ISO 2768-"+src.gen : "As per drawing"
    }, {}),
    notes: {ht:notes.ht, htType:notes.htType, hardness:notes.hardness, caseDepth:notes.caseDepth, surf:notes.surf, surfType:notes.surfType, coat:notes.coat, saltSpray:notes.saltSpray, mark:notes.mark, cast:ctx.cast},
    chars: charsOut, ops, gauges: gaugeReg.map(({fromBalloon,...g})=>Object.assign(g,{fromBalloon})), ctxInfo:{maxOD:ctx.maxOD, length:ctx.length, matCls}
  };
}
function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,""); }

window.PDEngine = { normalizeSource, sourceFromCSV, parseCSV, buildPlan, specText, tolBand, limits, isInternal, parseThread, gaugeFor,
  materialClass, DEFAULT_MACHINES, DEFAULT_CONSUMABLES, OPS, MFG_KEYS, MACH_KEYS, fmt, fmtTol, r4, num, today, addDays, pad, uniq, toolsFor, paramsFor, paramKind, productionGauge, isInternal, parseThread, tapDrill, tolBand, VC, MATCLS_TXT };
})();
