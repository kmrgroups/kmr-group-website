/* =====================================================================
   Process Documents – document generator + quality statistics
   plan → { pfd, pfmea, cp, sop, setup, patrol, self, pdi, spc, msa,
            charts, sc, gauges, tools, pokayoke, machines }
   PFMEA follows the AIAG-VDA FMEA Handbook (7-step, Action Priority),
   Control Plan the AIAG Control Plan manual, SPC the AIAG SPC manual,
   MSA the AIAG MSA manual (Average & Range method).
   ===================================================================== */
(function(){
"use strict";
const E = window.PDEngine, {fmt, r4, addDays, today, pad, uniq} = E;

/* ---------------- document catalogue ---------------- */
const DOCS = [
  {id:"pfd",      title:"Process Flow Diagram",               code:"PFD",   group:"Core APQP"},
  {id:"pfmea",    title:"Process FMEA",                       code:"PFMEA", group:"Core APQP", size:"a3"},
  {id:"cp",       title:"Control Plan",                       code:"CP",    group:"Core APQP", size:"a3"},
  {id:"sop",      title:"Standard Operating Procedure",       code:"SOP",   group:"Core APQP"},
  {id:"setup",    title:"Setup Approval Report",              code:"SAR",   group:"Inspection reports"},
  {id:"patrol",   title:"Patrol Inspection Report",           code:"PIR",   group:"Inspection reports"},
  {id:"self",     title:"Self Inspection Report",             code:"SIR",   group:"Inspection reports"},
  {id:"pdi",      title:"Pre-Dispatch Inspection Report",     code:"PDI",   group:"Inspection reports"},
  {id:"spc",      title:"SPC Study Report",                   code:"SPC",   group:"Studies"},
  {id:"msa",      title:"MSA – Gauge R&R Study",              code:"MSA",   group:"Studies"},
  {id:"charts",   title:"Run Chart / X̄-R Chart",             code:"CHT",   group:"Studies"},
  {id:"sc",       title:"List of Special Characteristics",    code:"LSC",   group:"Lists"},
  {id:"gauges",   title:"List of Gauges",                     code:"LOG",   group:"Lists"},
  {id:"tools",    title:"List of Tools",                      code:"LOT",   group:"Lists"},
  {id:"pokayoke", title:"List of Poka-Yoke",                  code:"LPY",   group:"Lists"},
  {id:"machines", title:"List of Machines",                   code:"LOM",   group:"Lists"}
];

/* ---------------- AIAG-VDA Action Priority ---------------- */
function AP(s,o,d){
  s=+s; o=+o; d=+d; if(!s||!o||!d) return "";
  const dB = d>=7?0:d>=5?1:d>=2?2:3;           // D bands: 7-10, 5-6, 2-4, 1
  const oB = o>=8?0:o>=6?1:o>=4?2:o>=2?3:4;    // O bands: 8-10, 6-7, 4-5, 2-3, 1
  const T = {
    s9:[["H","H","H","H"],["H","H","H","H"],["H","H","H","M"],["H","M","L","L"],["L","L","L","L"]],
    s7:[["H","H","H","H"],["H","H","H","M"],["H","M","M","M"],["M","M","L","L"],["L","L","L","L"]],
    s4:[["H","H","M","M"],["M","M","M","L"],["M","L","L","L"],["L","L","L","L"],["L","L","L","L"]],
    s2:[["M","M","L","L"],["L","L","L","L"],["L","L","L","L"],["L","L","L","L"],["L","L","L","L"]]
  };
  if(s===1) return "L";
  const t = s>=9?T.s9:s>=7?T.s7:s>=4?T.s4:T.s2;
  return t[oB][dB];
}

/* ---------------- severity / effects ---------------- */
function sevFor(c){
  if(c.cls==="CC") return 9; if(c.cls==="SC") return 8; if(c.cls==="KC") return 7;
  const b=c.band;
  switch(c.type){
    case "Material": return 8;
    case "Thread": return 7;
    case "Diameter": return b!=null&&b<=0.05 ? 7 : 6;
    case "GD&T": return /position|runout|concentric/i.test(c.gdt+c.text) ? 7 : 6;
    case "Linear": return b!=null&&b<=0.05 ? 6 : 5;
    case "Surface finish": return 5;
    case "Angle": return 5;
    case "Radius": case "Chamfer": return 4;
    case "Note": return /HARD|CASE/i.test(c.text)?8:/COAT|PLAT|ZINC/i.test(c.text)?6:4;
  }
  return 5;
}
function effectFor(c){
  const L=c.label||c.type, g=c.gdt||"";
  const e = {
    "Thread": "Your plant: rework / scrap. Customer: fastener cannot be assembled or strips at torque. End user: joint loosening.",
    "Diameter": c.internal ? "Your plant: scrap. Customer: loose / tight fit of mating part (bearing / pin / shaft) at assembly. End user: noise, wear, premature failure."
                           : "Your plant: rework / scrap. Customer: mating part does not assemble or fits loose. End user: vibration, wear, premature failure.",
    "Linear": "Your plant: rework / scrap. Customer: assembly stack-up / fitment problem. End user: function degraded.",
    "GD&T": /position/i.test(g) ? "Customer: holes / features mismatch – bolts or pins do not assemble. End user: misalignment." :
            /runout|concentric|circular|cylind/i.test(g) ? "Customer: assembly run-out. End user: vibration, noise, bearing / seal wear." : "Customer: improper seating / sealing. End user: leakage or uneven load.",
    "Surface finish": "Customer: seal / mating surface damage. End user: leakage, premature wear.",
    "Angle": "Customer: improper seating of mating part. End user: function degraded.",
    "Radius": "Customer: interference at assembly / stress concentration. End user: fatigue crack risk.",
    "Chamfer": "Customer: difficulty in assembly, burr / edge damage to seals. End user: minor.",
    "Material": "Customer: part fails validation. End user: breakage / safety risk in the field.",
    "Note": /HARD|CASE/i.test(c.text) ? "Customer: part rejected at incoming. End user: premature wear / fracture." :
            /COAT|PLAT|ZINC|ANOD/i.test(c.text) ? "Customer: appearance rejection. End user: corrosion / rust." : "Customer: complaint / rejection at incoming."
  };
  return e[c.type] || "Customer: rejection at incoming; End user: function degraded.";
}
function fmFor(c){
  if(c.type==="Thread") return `${c.spec}: thread GO not entering / NO-GO entering (thread oversize, undersize or damaged)`;
  if(c.type==="Surface finish") return `${c.spec}: roughness above specification`;
  if(c.type==="GD&T") return `${c.spec}: ${lc(c.label)} out of tolerance`;
  if(c.type==="Material") return "Wrong material grade / material not as per specification";
  if(c.type==="Note") return `${c.text}: requirement not met`;
  return `${c.label} ${c.spec}: oversize / undersize (out of tolerance)`;
}
function occFromCap(band, cap){ if(band==null||!cap) return 3; const r=band/cap; return r>=10?2:r>=5?3:r>=2.5?4:r>=1.5?5:6; }

const CAUSES = {
  mach:[
    {we:"Machine",  fc:"Tool wear / insert edge chipping beyond tool life", pc:"Tool-life counter with planned tool change (List of Tools); spare tools at machine", dO:1},
    {we:"Method",   fc:"Incorrect tool offset / program error at setting", pc:"Setup approval with 5-piece first-off check; approved program locked (password)", o:3},
    {we:"Machine",  fc:"Improper clamping – chips on locator, worn jaws / fixture", pc:"Air-clean locators before loading; jaw / fixture wear in PM checklist", o:3}
  ],
  grind:[
    {we:"Machine",  fc:"Wheel wear / dressing not done at frequency", pc:"Dressing counter in program; dressing frequency in SOP", dO:1},
    {we:"Environment", fc:"Thermal growth – coolant concentration / temperature not maintained", pc:"Coolant concentration check per shift; machine warm-up cycle", o:3},
    {we:"Method",   fc:"Wrong size setting / in-process gauge not mastered", pc:"In-process gauge mastering with setting master at start of shift", o:3}
  ],
  thread:[{we:"Machine", fc:"Tap / threading insert wear or breakage; wrong tap-drill size", pc:"Tap life counter; tap-drill size verified in setup approval", o:3}],
  ht:[
    {we:"Machine",  fc:"Furnace temperature / quench not as per recipe", pc:"Approved HT sub-contractor (CQI-9 assessed); calibrated furnace; recipe per part", o:3},
    {we:"Material", fc:"Wrong material grade / chemistry variation", pc:"MTC verification at RM inspection; material identification colour code", o:2}
  ],
  surf:[{we:"Method", fc:"Plating bath chemistry / time not maintained", pc:"Approved plater (CQI-11/12); bath analysis records reviewed per lot", o:3}],
  rm:[{we:"Material", fc:"Supplier supplied wrong grade / mixed material", pc:"Approved supplier list; MTC mandatory per heat; material colour coding", o:3}],
  insp:[{we:"Man", fc:"Inspector misses defect / gauge out of calibration", pc:"Trained & qualified inspector (skill matrix); calibrated gauges (List of Gauges); MSA done", o:3}]
};
function detFor(c, plan, gname, pgname){
  if(c.type==="Material") return {dc:"MTC verification per heat; spectro test per lot", d:5};
  if(c.type==="Note") return /HARD|CASE/i.test(c.text) ? {dc:`Hardness check 5 pcs / lot (${gname})`, d:5} : /COAT|PLAT|ZINC|ANOD/i.test(c.text) ? {dc:`Coating thickness 5 pcs / lot (${gname}); supplier certificate`, d:6} : {dc:"100% visual inspection at final inspection", d:7};
  if(c.cls==="CC") return pgname ? {dc:`100% ${pgname} at station; X̄-R chart with ${gname}`, d:4} : {dc:`100% inspection with ${gname}; X̄-R chart`, d:5};
  if(c.cls==="SC"||c.cls==="KC") return {dc:`X̄-R chart (5 pcs / 2 hrs) with ${gname}; setup approval`, d:5};
  return {dc:`Setup approval & patrol inspection (1 pc / 2 hrs) with ${gname}; final inspection`, d:6};
}

/* ======================================================================
   GENERATORS
   ====================================================================== */
function genAll(plan, settings){
  settings = settings||{};
  const ctx = mkCtx(plan, settings);
  const docs = {};
  DOCS.forEach(d=>{ docs[d.id] = GEN[d.id](plan, ctx); docs[d.id].docNo = docNo(d, plan, settings); docs[d.id].rev = plan.header.docRev||"00"; });
  return docs;
}
function genOne(id, plan, settings){ const ctx=mkCtx(plan, settings||{}); const d=DOCS.find(x=>x.id===id); const o=GEN[id](plan, ctx); o.docNo=docNo(d,plan,settings||{}); o.rev=plan.header.docRev||"00"; return o; }
function docNo(d, plan, s){ const pat = s.docNoPattern || "{CODE}-{PART}"; return pat.replace("{CODE}",d.code).replace("{PART}",(plan.header.partNo||"PART").replace(/\s+/g,"")).replace("{REV}",plan.header.drawingRev||"").replace("{PREFIX}",s.docPrefix||""); }
function mkCtx(plan, s){
  const byNo={}; plan.chars.forEach(c=>byNo[c.no]=c);
  const gById={}; plan.gauges.forEach(g=>gById[g.id]=g);
  const opOf={}; plan.ops.forEach(o=>o.chars.forEach(n=>opOf[n]=o));
  const machines = s.strictMasters ? (s.machines||[]) : (s.machines&&s.machines.length)?s.machines:E.DEFAULT_MACHINES;
  const mById={}; machines.forEach(m=>mById[m.id]=m);
  const gName = id => gById[id] ? `${gById[id].name}${gById[id].range&&gById[id].range!=="—"?" "+gById[id].range:""}` : "";
  const freq = {cc:s.freqCC||"100% + 5 pcs / 2 hrs (SPC)", sc:s.freqSC||"5 pcs / 2 hrs", nor:s.freqNormal||"1 pc / 2 hrs", slots:+(s.patrolSlots||8)};
  return {byNo, gById, opOf, mById, gName, freq, s, mfg:plan.ops.filter(o=>E.MFG_KEYS.includes(o.key)&&o.key!=="CUT"&&o.chars.length)};
}
const lc = s => String(s||"").charAt(0).toLowerCase()+String(s||"").slice(1);
const opLabel = o => `${o.opNo} – ${o.name}`;
const OPDESC = {
  RMI:"Receive raw material, verify MTC (chemistry & mechanical), check size, identify & tag",
  RMSTORE:"Store in identified rack with heat / lot tag; FIFO",
  CUT:"Cut bar / blank to length as per cutting chart",
  TURN1:"Face, rough & finish turn, drill / bore, chamfer – first side", TURN2:"Face to length, turn, bore, groove, thread, chamfer – second side", TURN:"Face, rough & finish turn, drill / bore, groove, thread, chamfer",
  VMC:"Face mill, profile, drill, ream, tap, chamfer as per program", DRILL:"Drill, tap & chamfer using drill jig", HOB:"Hob gear / spline teeth", BROACH:"Broach keyway / internal spline",
  DEBURR:"Remove burrs & break sharp edges; blow off chips", HT:"Heat treat as per drawing at approved sub-contractor", HTINSP:"Verify hardness / case depth after heat treatment",
  CGRIND:"Grind diameters / faces to final size & finish", IGRIND:"Grind bore to final size & finish", SGRIND:"Grind faces to final size, flatness & parallelism", HONE:"Hone bore to size, cylindricity & finish",
  WASH:"Wash, rinse & dry to remove chips, oil & residue", SURF:"Surface treatment at approved sub-contractor", MARK:"Mark part identification as per drawing",
  CRACK:"Magnetic-particle crack detection & demagnetise", LEAK:"Leak / pressure test as per drawing", FINAL:"Inspect all drawing characteristics as per sampling plan; visual 100%",
  PACK:"Apply rust preventive, pack in VCI bag & box, label", PDI:"Pre-dispatch audit of packed lot against drawing & packing standard",
  FGSTORE:"Store in finished-goods area with identification; FIFO", DISPATCH:"Load & dispatch with invoice, PDI report & test certificates"
};

const GEN = {};
/* ---------- PFD ---------- */
GEN.pfd = (plan, x) => ({ rows: plan.ops.map(o=>{
  const ch = o.chars.map(n=>x.byNo[n]).filter(Boolean);
  const src = o.key==="RMI"?"Material variation, supplier":o.key.startsWith("TURN")||o.key==="VMC"?"Tool wear, offsets, clamping, coolant, thermal":o.key.includes("GRIND")||o.key==="HONE"?"Wheel wear, dressing, coolant, temperature":o.key==="HT"?"Furnace temperature, quench, load pattern":o.key==="SURF"?"Bath chemistry, time, current":o.key==="PACK"?"Handling, RP oil, packing material":"—";
  return { opNo:o.opNo, sym:o.sym, name:o.name, desc:(OPDESC[o.key]||"")+(o.note?". "+o.note:""), machine:o.machine||"",
    product: ch.map(c=>`#${c.no} ${c.label}: ${c.spec}`).concat((o.params||[]).filter(p=>(p.kind||E.paramKind(p.name))==="product").map(p=>`${p.name}: ${p.spec}`)).join("\n") || (o.verify?`All characteristics (${o.verify.length}) verified`:"—"),
    process: (o.params||[]).filter(p=>(p.kind||E.paramKind(p.name))!=="product").map(p=>`${p.name}: ${p.spec}`).join("\n") || "—",
    cls: uniq(ch.map(c=>c.cls)).join(", "), src, remarks: o.inHouse?"In-house":"Sub-contract" }; }) });

/* ---------- PFMEA ---------- */
/* failure effects: one line each for Your plant / Ship-to plant (customer) / End user (field) */
function fmtFE(t){ return String(t||"").replace(/\s*\n?\s*(Ship-to plant:|Customer:|End user:|Field:)/g,"\n$1").replace(/^\n+/,"").trim(); }
GEN.pfmea = (plan, x) => {
  const rows=[], item=`${plan.header.partName||"Part"} (${plan.header.partNo||"—"})`, due=addDays(today(),30);
  const push = (o, we, funcStep, funcWE, fe, s, fm, fc, pc, oo, dc, d, cls) => {
    const ap = AP(s,oo,d);
    const act = ap==="H" || (ap==="M" && s>=7);
    rows.push({ opNo:o.opNo, item, step:opLabel(o), we, funcItem:`Produce ${plan.header.partName||"part"} to drawing ${plan.header.drawingNo||""} rev ${plan.header.drawingRev||""}`.trim(),
      funcStep, funcWE, fe:fmtFE(fe), s, fm, fc, pc, o:oo, dc, d, ap, cls:cls||"",
      actPrev: act ? (/wear|dressing/i.test(fc)?"Introduce in-process gauging / probe compensation; reduce tool-change interval":/offset|program/i.test(fc)?"Add probe-based offset verification after tool change":/clamp/i.test(fc)?"Add part-seating air sensor on fixture (poka-yoke)":"Review process capability; add error-proofing") : "",
      actDet: act ? (s>=9?"Introduce 100% automatic / poka-yoke detection at station":"Increase SPC frequency; add 100% GO/NO-GO check") : "",
      resp: act ? (x.s.pfmeaOwner||"Process Engineering") : "", target: act ? due : "", status: act ? "Open" : "", taken:"", done:"", s2:"", o2:"", d2:"", ap2:"", remarks:"" });
  };
  plan.ops.forEach(o=>{
    const ch=o.chars.map(n=>x.byNo[n]).filter(Boolean), m=x.mById[o.machineId], cap=m?m.cap:0.01;
    const machineTxt = o.machine||"Machine";
    if(o.key==="RMI"){
      const mat = ch.find(c=>c.type==="Material") || {type:"Material",label:"Material grade",spec:plan.header.material||"As per drawing",cls:"",text:""};
      CAUSES.rm.forEach(k=>push(o,`${k.we}: raw material`,`Accept only material to ${plan.header.material||"drawing specification"}`,"Supplier delivers material with valid MTC",effectFor(mat),8,"Wrong material grade / material not as per specification",k.fc,k.pc,k.o,"MTC verification per heat; spectro check per lot",5,mat.cls));
      ch.filter(c=>c.type!=="Material").forEach(c=>{ const s=sevFor(c), dt=detFor(c,plan,x.gName(c.gauge)); push(o,"Man: inspector",`Verify ${c.label} ${c.spec}`,"Inspector verifies against specification",effectFor(c),s,fmFor(c),CAUSES.insp[0].fc,CAUSES.insp[0].pc,3,dt.dc,dt.d,c.cls); });
      return;
    }
    if(o.key==="CUT"){ push(o,`Machine: ${machineTxt}`,"Cut blank to length","Saw holds cut length","Your plant: part cannot clean up at facing – scrap.",4,"Cut length short / long","Length stop not set / shifted",`First-piece check; length stop locked`,3,"First piece & every 50 pcs with steel rule / vernier",6,""); return; }
    if(E.MFG_KEYS.includes(o.key)){
      const grind = /GRIND|HONE/.test(o.key);
      ch.forEach(c=>{
        const s=sevFor(c), gname=x.gName(c.gauge), pg=c.pgauge?x.gName(c.pgauge):"", dt=detFor(c,plan,gname,pg), base=occFromCap(c.band,cap);
        const causes = (grind?CAUSES.grind:CAUSES.mach).concat(c.type==="Thread"?CAUSES.thread:[]);
        causes.forEach((k,i)=>{ const oo = k.o!=null ? Math.min(k.o, base+1) : Math.min(8, base+(k.dO||0));
          push(o, `${k.we}: ${k.we==="Machine"?machineTxt:k.we==="Method"?"setting / program":k.we==="Environment"?"coolant / temperature":"operator"}`,
            `${o.key.startsWith("TURN")?"Turn":o.key==="VMC"?"Machine":grind?"Grind / finish":"Produce"} ${lc(c.label)} to ${c.spec}`,
            `${k.we==="Machine"?machineTxt+" holds":"Setting / method ensures"} ${lc(c.label)} within tolerance`,
            effectFor(c), s, fmFor(c), k.fc, k.pc, oo, dt.dc, dt.d, c.cls); });
      });
      const holes = ch.filter(c=>(c.type==="Diameter"&&c.internal)||c.type==="Thread");
      if(o.key==="VMC" && holes.length){ const s=Math.max(7,...holes.map(sevFor));
        push(o,`Machine: ${machineTxt}`,"Machine all holes / threads as per drawing","Program contains every feature","Customer: part cannot be assembled (missing hole / thread).",s,"Hole / thread missing (operation skipped, broken tool)","Tool breakage not detected / program block skipped","Program verified at setup approval; tool-breakage detection after drilling",3,"Poka-yoke: thread / hole presence check pin at unloading; patrol inspection",4,uniq(holes.map(c=>c.cls)).join(",")); }
      return;
    }
    if(o.key==="DEBURR"){ push(o,"Man: operator","Remove all burrs, break sharp edges 0.2–0.5 × 45°","Operator deburrs every edge","Customer: burr enters assembly; operator hand injury.",5,"Burr not removed / edge not broken","Operator skill; blunt deburring tool","SOP with visual aid; deburring tool change when blunt",4,"100% visual & finger-feel check; final inspection",6,""); return; }
    if(o.key==="WASH"){ push(o,"Machine: washing machine","Clean part free from chips, oil & residue","Wash solution at correct temperature & concentration","Customer: contamination in assembly.",5,"Chips / oil residue / water marks on part","Wash solution concentration / temperature low; nozzle choke","Concentration & temperature checked per shift; nozzle cleaning in PM",3,"Visual check each basket",7,""); return; }
    if(o.key==="HT"||o.key==="HTINSP"){ const h=ch.find(c=>/HARD/i.test(c.text))||{type:"Note",text:"Hardness",label:"Hardness",spec:plan.notes.hardness||"As per drawing",cls:""};
      CAUSES.ht.forEach(k=>push(o,`${k.we}: ${o.key==="HT"?"furnace":"material"}`,`Achieve ${plan.notes.htType||"heat treatment"} – ${plan.notes.hardness||"hardness as per drawing"}`,"Furnace delivers correct temperature & quench",effectFor({type:"Note",text:"HARD"}),8,`Hardness ${plan.notes.hardness||""} not achieved (soft / over-hard)`.replace("  "," "),k.fc,k.pc,k.o,"Hardness check 5 pcs / lot; supplier HT certificate per batch",5,h.cls)); return; }
    if(o.key==="SURF"){ CAUSES.surf.forEach(k=>push(o,`${k.we}: plating process`,`${plan.notes.surfType} ${plan.notes.coat||""}`.trim(),"Plater maintains bath & process time","Customer: appearance rejection. End user: corrosion.",6,`Coating thickness low / peeling / white rust`,k.fc,k.pc,k.o,"Coating thickness 5 pcs / lot; supplier certificate; salt-spray per plan",6,"")); return; }
    if(o.key==="MARK"){ push(o,"Machine: marking","Mark identification legibly","Marking program correct","Customer: traceability lost.",5,"Marking missing / illegible / wrong content","Wrong program selected","Program selection verified at setup; first-piece check",3,"Visual check every 2 hrs",6,""); return; }
    if(o.key==="FINAL"||o.key==="PDI"||o.key==="CRACK"||o.key==="LEAK"){ const k=CAUSES.insp[0]; const smax=Math.max(5,...plan.chars.map(sevFor));
      push(o,"Man: inspector",o.key==="PDI"?"Release only conforming, correctly packed lots":"Detect every non-conforming part","Inspector applies sampling plan with calibrated gauges","Customer: defective part received – line stoppage / rejection.",Math.min(smax,8),"Non-conforming part passed as OK",k.fc,k.pc,k.o,o.key==="PDI"?"PDI sampling per lot against drawing; packing audit":"Sampling per control plan; 100% visual",6,""); return; }
    if(o.key==="PACK"){ push(o,"Method: packing","Pack with rust preventive & correct quantity","Packing standard followed","Customer: rust / damaged parts; shortage.",6,"Rust / dent / wrong quantity","RP oil not applied; improper separators; count error","Packing standard with photos; weighing-scale count",3,"PDI check per lot",5,""); return; }
    if(o.key==="DISPATCH"){ push(o,"Man: dispatch","Dispatch correct part & quantity","Invoice matches label","Customer: wrong part / mixed parts received – line stoppage.",7,"Wrong part / label / quantity dispatched","Manual label writing; similar parts in FG area","Printed labels; FG area segregated part-wise",2,"Label vs invoice check (barcode scan) before loading",4,""); return; }
    if(o.key==="RMSTORE"||o.key==="FGSTORE"){ push(o,"Method: storage","Store with identification & FIFO","Storage area defined","Your plant: mix-up / rust / FIFO lost.",5,"Parts / material mixed up or rusted in storage","Missing identification tag; long storage","Identification tag & FIFO card; covered racks",3,"Stores audit weekly",7,""); return; }
  });
  return {rows, meta:{team:plan.header.coreTeam||"", scope:`Process from ${plan.ops[0]&&plan.ops[0].name} to ${plan.ops[plan.ops.length-1]&&plan.ops[plan.ops.length-1].name}`, fmeaStart:today()}};
};

/* ---------- Control Plan ---------- */
GEN.cp = (plan, x) => {
  const rows=[]; let cn=0;
  const react = (c)=> c&&c.cls==="CC" ? (x.s.reactCC||"Stop the machine; quarantine all parts since last OK check; inform QA head; 100% inspect; root-cause & 8D; re-approve setup") :
    (x.s.reactNormal||"Stop; segregate & 100% inspect parts since last OK check; correct offset / tool; re-approve setup; record in rejection register");
  plan.ops.forEach(o=>{
    const ch=o.chars.map(n=>x.byNo[n]).filter(Boolean), mach=[o.machine, ...o.tools.slice(0,4).map(t=>t.desc+" "+t.spec)].filter(Boolean).join("; ");
    ch.forEach(c=>{ const g=x.gName(c.gauge), pg=c.pgauge?x.gName(c.pgauge):"";
      const cc=c.cls==="CC", sc=c.cls==="SC"||c.cls==="KC";
      const inspOp = ["RMI","HTINSP","FINAL","PDI"].includes(o.key);
      rows.push({opNo:o.opNo, name:o.name, machine:mach, charNo:c.no, product:`${c.label}`, process:"", cls:c.cls, spec:c.spec,
        tech: pg ? `${pg} (100%); ${g}` : g,
        size: cc?"100%":sc?"5 pcs":inspOp?(o.key==="RMI"?"5 pcs / lot":"As per sampling plan"):"1 pc",
        freq: cc?"Each part + 5 pcs / 2 hrs":sc?"Every 2 hrs":inspOp?"Each lot":"First-off, every 2 hrs, last-off",
        method: cc?"Poka-yoke / 100% gauging; X̄-R chart; setup approval":sc?"X̄-R chart; setup approval report":inspOp?(o.key==="RMI"?"Incoming inspection report":"Inspection report"):"Setup approval, self & patrol inspection reports",
        react: react(c), resp: inspOp?"QA inspector":"Operator / setter" }); });
    (o.params||[]).forEach(p=>rows.push({opNo:o.opNo, name:o.name, machine:mach, charNo:"", product:(p.kind||E.paramKind(p.name))==="product"?p.name:"", process:(p.kind||E.paramKind(p.name))==="product"?"":p.name, cls:"", spec:p.spec, tech:p.method, size:"1", freq:p.freq,
      method: /program|recipe/i.test(p.method)?"Program / recipe lock; setup approval":"Check sheet / setup approval", react:"Adjust to specification; verify parts produced since last check; inform supervisor", resp:p.resp||"Operator"}));
    if(!ch.length && !(o.params||[]).length){
      const t = {RMSTORE:["Identification & FIFO","Heat / lot tag on every bundle","Visual"],FGSTORE:["Identification & FIFO","Part-wise location, FIFO card","Visual"],DISPATCH:["Correct part & quantity","As per invoice & label","Label vs invoice check"],
        DEBURR:["Burr-free, sharp edges broken","No burr by visual / finger feel","Visual"],FINAL:["All drawing characteristics","As per drawing","As per List of Gauges"],PDI:["Packed lot conformity","As per drawing & packing standard","PDI checklist"]}[o.key] || ["Process conformity","As per SOP","Visual"];
      rows.push({opNo:o.opNo, name:o.name, machine:o.machine||"", charNo:"", product:o.key==="FINAL"||o.key==="PDI"?t[0]:"", process:o.key==="FINAL"||o.key==="PDI"?"":t[0], cls:"", spec:t[1], tech:t[2], size:o.key==="FINAL"?"As per sampling plan":"100%", freq:"Each lot", method:o.key==="FINAL"?"Final inspection report":o.key==="PDI"?"PDI report":"Check sheet", react:"Hold lot; segregate; inform QA", resp:o.key==="FINAL"||o.key==="PDI"?"QA inspector":"Stores / operator"}); }
  });
  return {rows, meta:{type:plan.header.phase||"Production"}};
};

/* ---------- SOP ---------- */
const STEPS = {
  RMI:[["Collect material with MTC from stores receipt","Check heat no. on material matches MTC"],["Verify chemistry & mechanical properties on MTC","Compare with material standard"],["Check size of 5 pcs per lot","Use calibrated vernier"],["Tag lot OK / hold / reject","Colour tag + register entry"]],
  CUT:[["Select bar as per cutting chart; check identification tag","Right grade & size"],["Set length stop to cut length","Lock the stop"],["Cut first piece & verify length","Record in setup report"],["Cut batch; deburr cut face; put in bin with tag","Do not mix lots"]],
  TURN:[["Clean chuck jaws & locating face with air","No chips on locator"],["Load part in chuck, seat against stop, clamp","Chuck pressure as per SOP"],["Select approved program; press cycle start","Door closed – interlock"],["Unload part; blow off chips","Handle without dent"],["Check characteristics as per frequency & record","Stop if any NG"],["Place OK part in WIP bin; NG part in red bin","Identify NG"]],
  VMC:[["Clean fixture locators & rest pads","No chips on locator"],["Load part on fixture against locating pins; clamp","Correct orientation (poka-yoke pin)"],["Select approved program; cycle start","Door closed – interlock"],["Unload; check hole / thread presence with check pin","Poka-yoke"],["Check characteristics as per frequency & record","Stop if any NG"],["Place OK part in WIP bin","Identify NG in red bin"]],
  GRIND:[["Warm-up machine 10 min; master the in-process gauge","Gauge zero set"],["Dress wheel","As per dressing frequency"],["Load part between centres / on chuck","Clean centres"],["Run grinding cycle","Coolant ON"],["Check size, runout & finish","Record per frequency"],["Place OK part in WIP bin","Rust-protect ground surface"]],
  HONE:[["Check honing oil level & stone condition","As per SOP"],["Load part in fixture","Correct orientation"],["Run honing cycle","Stroke as per setting"],["Check bore size & finish","Record per frequency"]],
  HOB:[["Mount hob & check hob run-out","≤ 0.01 mm"],["Load part on arbor","Clean arbor"],["Run cycle","Oil ON"],["Check teeth by over-pin / span","Record"]],
  BROACH:[["Check broach condition","No chipped teeth"],["Load part in bush","Correct orientation"],["Broach","Oil ON"],["Check keyway with gauge","Record"]],
  DEBURR:[["Take part from WIP bin","Handle carefully"],["Deburr all edges & holes with deburring tool","Every edge"],["Blow off chips with air","Eye protection"],["Check visually & by finger feel","No burr"]],
  WASH:[["Check solution temperature & concentration","Record once per shift"],["Load parts in basket without overlapping","Single layer"],["Run wash-rinse-dry cycle",""],["Check parts free from chips, oil & water marks","Visual"]],
  HT:[["Send parts with delivery challan & HT specification","Mention hardness & process"],["Receive with HT certificate","Verify certificate"],["Hardness check 5 pcs / lot","Record"]],
  HTINSP:[["Clean test spot","Remove scale"],["Check hardness on tester (3 readings / part)","Tester verified with test block"],["Record & accept / reject lot",""]],
  SURF:[["Send parts with challan & plating specification",""],["Receive with certificate",""],["Check coating thickness & appearance 5 pcs / lot","Record"]],
  MARK:[["Select marking program for part no.",""],["Load part in fixture","Correct orientation"],["Mark & check legibility","First piece & every 2 hrs"]],
  FINAL:[["Collect lot with route card","All operations signed"],["Inspect sample as per sampling plan for all characteristics","Use listed gauges"],["100% visual inspection","Burr, dent, rust"],["Record in final inspection report; accept / reject lot",""]],
  PACK:[["Apply rust-preventive oil","All surfaces"],["Pack in VCI bag with separators","No part-to-part contact"],["Count / weigh quantity","As per packing standard"],["Fix label (part no., rev., qty, lot, date)",""]],
  PDI:[["Select sample from packed lot","As per PDI plan"],["Check characteristics as per PDI report","Use listed gauges"],["Check packing, labelling & quantity",""],["Release lot / hold",""]],
  CRACK:[["Clean part",""],["Magnetise & apply ink","Check ink concentration"],["Inspect under UV light","No indication"],["Demagnetise","Residual ≤ limit"]],
  LEAK:[["Load part in leak tester",""],["Run test at set pressure & time",""],["Mark OK parts",""]],
  STORE:[["Keep material / parts in identified location",""],["Follow FIFO","FIFO card"]],
  DISPATCH:[["Check label vs invoice (barcode scan)",""],["Load & secure boxes",""],["Send invoice, PDI report & certificates",""]]
};
function stepsFor(k){ return STEPS[k] || STEPS[k.replace(/\d$/,"")] || (/GRIND/.test(k)?STEPS.GRIND:/STORE/.test(k)?STEPS.STORE:[["Perform operation as per this SOP",""]]); }
function ppeFor(k){ const b=["Safety shoes","Safety goggles"];
  if(E.MFG_KEYS.includes(k)) return b.concat(["Ear plugs","Tight-fitting uniform; no loose clothing","NO gloves near rotating chuck / spindle"]);
  if(k==="DEBURR") return b.concat(["Cut-resistant gloves"]); if(k==="WASH") return b.concat(["Chemical-resistant gloves","Apron"]); if(k==="PACK"||k==="PDI"||k==="FINAL") return b.concat(["Cotton gloves"]); return b; }
GEN.sop = (plan, x) => ({ sections: plan.ops.filter(o=>!["RMSTORE","FGSTORE"].includes(o.key)).map(o=>{
  const ch=(o.chars.length?o.chars:(o.verify||[])).map(n=>x.byNo[n]).filter(Boolean);
  return { opNo:o.opNo, opName:o.name, key:o.key, machine:o.machine, docNo:"",
    tools:o.tools.map(t=>`${t.id} ${t.desc} – ${t.spec}`).join("\n"), gauges:o.gauges.map(id=>`${id} ${x.gName(id)}`).join("\n"), consumables:(o.consumables||[]).join("\n"),
    ppe:ppeFor(o.key).join("\n"),
    steps: stepsFor(o.key).map((s,i)=>({no:i+1, step:s[0], key:s[1]||""})),
    checks: ch.slice(0,60).map(c=>({charNo:c.no, char:c.label, spec:c.spec, gauge:x.gName(c.pgauge||c.gauge), freq:c.cls==="CC"?"100%":c.cls?"5 pcs / 2 hrs":"1 pc / 2 hrs", cls:c.cls})),
    params: (o.params||[]).map(p=>({name:p.name, spec:p.spec, freq:p.freq})),
    safety: (E.MFG_KEYS.includes(o.key)?"Do not open door during cycle. Keep hands away from chuck/spindle. Use hook for chip removal – never bare hands. Emergency stop location known.":o.key==="WASH"?"Handle chemicals with gloves; MSDS displayed.":"Handle parts carefully; keep work area clean.") ,
    reaction: "If any characteristic is NG: stop, inform supervisor, segregate parts since last OK check, correct and re-approve setup." };
}) });

/* ---------- Setup approval / patrol / self ---------- */
const readRow = (c, x, n, prefix) => { const o={charNo:c.no, char:c.label, spec:c.spec, lsl:c.lsl, usl:c.usl, gauge:x.gName(c.gauge), cls:c.cls}; for(let i=1;i<=n;i++) o[prefix+i]=""; return o; };
GEN.setup = (plan, x) => ({ sections: x.mfg.map(o=>({ opNo:o.opNo, opName:o.name, machine:o.machine,
  rows:o.chars.map(n=>x.byNo[n]).filter(Boolean).map(c=>Object.assign(readRow(c,x,5,"r"),{remark:""})),
  params:(o.params||[]).map(p=>({name:p.name, spec:p.spec, actual:"", ok:""})),
  meta:{date:today(), shift:"", operator:"", setter:"", inspector:"", reason:"New setup", decision:""} })) });
GEN.patrol = (plan, x) => ({ slots: slotLabels(x.freq.slots, 2), sections: x.mfg.map(o=>({ opNo:o.opNo, opName:o.name, machine:o.machine,
  rows:o.chars.map(n=>x.byNo[n]).filter(Boolean).map(c=>Object.assign(readRow(c,x,x.freq.slots,"t"),{freq:c.cls==="CC"?"100% + 5 pcs/2 hrs":c.cls?"5 pcs / 2 hrs":"1 pc / 2 hrs",remark:""})),
  meta:{date:today(), shift:"", inspector:""} })) });
GEN.self = (plan, x) => ({ slots: slotLabels(x.freq.slots, 1), sections: x.mfg.map(o=>({ opNo:o.opNo, opName:o.name, machine:o.machine,
  rows:o.chars.map(n=>x.byNo[n]).filter(Boolean).map(c=>Object.assign(readRow(c,x,x.freq.slots,"t"),{remark:""})),
  meta:{date:today(), shift:"", operator:""} })) });
function slotLabels(n, stepH){ const out=[]; let h=8; for(let i=0;i<n;i++){ out.push(pad(h%24)+":00"); h+=stepH; } return out; }

/* ---------- PDI ---------- */
GEN.pdi = (plan, x) => { const pdi = plan.ops.find(o=>o.key==="PDI"); const list=(pdi&&pdi.verify)||plan.chars.map(c=>c.no);
  const rows = list.map(n=>x.byNo[n]).filter(Boolean).map(c=>Object.assign(readRow(c,x,5,"s"),{result:""}));
  [["Appearance","Free from burrs, dents, rust, scratches","Visual"],["Rust preventive","Applied on all surfaces","Visual"],["Packing","As per packing standard (VCI bag, separators)","Visual"],["Labelling","Part no., rev., qty, lot, date","Visual"],["Quantity","As per invoice","Count / weighing"]].forEach((v,i)=>rows.push({charNo:"V"+(i+1),char:v[0],spec:v[1],lsl:null,usl:null,gauge:v[2],cls:"",s1:"",s2:"",s3:"",s4:"",s5:"",result:""}));
  return {rows, meta:{date:today(), invoice:"", lotQty:"", sampleQty:"5", inspector:"", decision:""}}; };

/* ---------- SPC & MSA studies ---------- */
GEN.spc = (plan, x) => { let pick = plan.chars.filter(c=>c.cls && c.variable && c.lsl!=null && c.usl!=null);
  if(!pick.length) pick = plan.chars.filter(c=>c.variable && c.lsl!=null && c.usl!=null).sort((a,b)=>(a.band||9)-(b.band||9)).slice(0,3);
  return { studies: pick.map(c=>({charNo:c.no, char:c.label, spec:c.spec, lsl:c.lsl, usl:c.usl, nominal:c.nominal, gauge:x.gName(c.gauge), op:x.opOf[c.no]?opLabel(x.opOf[c.no]):"", machine:x.opOf[c.no]?x.opOf[c.no].machine:"", cls:c.cls,
    n:5, k:25, data:Array.from({length:25},()=>Array(5).fill(null)), simulated:false, period:"", studyType:"Initial process study (PPAP)" })) }; };
GEN.msa = (plan, x) => { const ids = uniq((plan.chars.filter(c=>c.cls&&c.variable).length?plan.chars.filter(c=>c.cls&&c.variable):plan.chars.filter(c=>c.variable).sort((a,b)=>(a.band||9)-(b.band||9)).slice(0,3)).map(c=>c.gauge));
  return { studies: ids.map(id=>{ const g=x.gById[id]; const c=plan.chars.find(ch=>ch.gauge===id&&ch.lsl!=null&&ch.usl!=null) || plan.chars.find(ch=>ch.gauge===id);
    return {gaugeId:id, gauge:g?g.name:"", range:g?g.range:"", lc:g?g.lc:"", charNo:c?c.no:"", char:c?c.label+" "+c.spec:"", tol:c&&c.lsl!=null&&c.usl!=null?r4(c.usl-c.lsl):null,
      appraisers:["Appraiser A","Appraiser B","Appraiser C"], trials:3, parts:10, data:[0,1,2].map(()=>[0,1,2].map(()=>Array(10).fill(null))), simulated:false, date:today() }; }) }; };
GEN.charts = (plan, x) => ({ meta:{charNo:(plan.chars.find(c=>c.cls&&c.variable)||plan.chars.find(c=>c.variable)||{}).no||""} });

/* ---------- lists ---------- */
GEN.sc = (plan, x) => ({ rows: plan.chars.filter(c=>c.cls).map((c,i)=>{ const o=x.opOf[c.no]; return { sl:i+1, charNo:c.no, char:c.label, spec:c.spec, cls:c.cls, sym:(x.s.symbols&&x.s.symbols[c.cls])||({CC:"◆",SC:"▼",KC:"◇"}[c.cls]||""),
  op:o?opLabel(o):"", gauge:x.gName(c.pgauge||c.gauge), control:c.cls==="CC"?"100% poka-yoke / gauging + X̄-R chart":"X̄-R chart + setup approval", freq:c.cls==="CC"?"100% + 5 pcs / 2 hrs":"5 pcs / 2 hrs", react:"Stop, segregate, 100% inspect, root cause (8D)" }; }) });
GEN.gauges = (plan, x) => ({ rows: plan.gauges.map((g,i)=>({ sl:i+1, id:g.id, name:g.name, range:g.range, lc:g.lc, type:g.type, chars:g.chars.join(", "), ops:g.ops.join(", "), calFreq:g.calFreq, calDue:g.calDue||"", location:g.location||"", msa:g.type==="Variable"?"GR&R":"Attribute study", source:g.fromBalloon?"Balloon data":"Engine" })) });
GEN.tools = (plan, x) => { const rows=[]; plan.ops.forEach(o=>o.tools.forEach(t=>rows.push({sl:rows.length+1, id:t.id, opNo:o.opNo, op:o.name, machine:o.machine, desc:t.desc, spec:t.spec, holder:t.holder, grade:t.grade, life:t.life, remarks:t.remarks||""}))); return {rows}; };
GEN.machines = (plan, x) => { const map={}; plan.ops.forEach(o=>{ if(!o.machine) return; const k=o.machineId||o.machine; const m=x.mById[o.machineId]||{};
  (map[k]=map[k]||{id:o.machineId||"—", name:o.machine, make:[m.make,m.model].filter(Boolean).join(" "), capacity:m.capacity||"", ops:[], location:m.location||(o.inHouse?"":"Sub-contractor"), pm:m.pm||"", cap:m.cap?`± ${fmt(m.cap)} mm`:"", status:"Available"}).ops.push(o.opNo); });
  return { rows:Object.values(map).map((r,i)=>Object.assign(r,{sl:i+1, ops:r.ops.join(", ")})) }; };
GEN.pokayoke = (plan, x) => { const rows=[]; const add=(o,desc,type,method,fm,ver)=>rows.push({sl:rows.length+1, id:"PY-"+pad(rows.length+1), opNo:o.opNo, op:o.name, desc, type, method, fm, ver:ver||"Master / red-rabbit sample at start of shift", freq:"Once per shift", react:"If poka-yoke fails: stop, inform supervisor, 100% manual check until restored", status:"To implement"});
  const op = k => plan.ops.find(o=>o.key===k);
  if(op("RMI")) add(op("RMI"),"Material grade colour-coding on bar ends / castings; cutting accepts only matching colour","Prevention","Fixed-value (colour)","Wrong material grade","Visual verification at start of shift");
  plan.ops.forEach(o=>{ const ch=o.chars.map(n=>x.byNo[n]).filter(Boolean);
    if(o.key.startsWith("TURN")&&o.key!=="TURN1") add(o,"Part-seating air-gap sensor – cycle start inhibited if part not seated against stop","Prevention","Contact (sensor)","Length / face runout out due to improper seating");
    if(o.key==="VMC"){ if(plan.header.family!=="rotational") add(o,"Asymmetric locating pin on fixture – part can be loaded in one orientation only","Prevention","Contact","Features machined in wrong orientation");
      if(ch.some(c=>c.type==="Thread")) add(o,"Thread-presence check pins on unloading station – part cannot be placed in OK bin if a thread is missing","Detection","Contact","Missing thread");
      if(ch.some(c=>c.type==="Diameter"&&c.internal)) add(o,"Tool-breakage detection (probe / laser) after drilling cycle – machine alarms on broken drill","Detection","Fixed-value","Missing hole / broken drill in hole"); }
    if(/GRIND/.test(o.key)) add(o,"In-process gauge with automatic size control – wheel retracts at size","Prevention","Fixed-value","Ground diameter oversize / undersize","Setting master at start of shift");
    ch.filter(c=>c.cls==="CC").forEach(c=>add(o,`100% ${c.pgauge?x.gName(c.pgauge):x.gName(c.gauge)} check for #${c.no} ${c.label} ${c.spec} before OK bin (interlocked chute / NG bin)`,"Detection","Contact / fixed-value",`#${c.no} ${c.label} out of tolerance`)); });
  if(op("PACK")) add(op("PACK"),"Weighing-scale count verification – box label prints only when weight = qty × unit weight","Detection","Fixed-value","Wrong quantity in box","Standard weight at start of shift");
  if(op("DISPATCH")) add(op("DISPATCH"),"Barcode scan of box label against invoice – mismatch alarm","Detection","Fixed-value","Wrong part dispatched","Wrong-label test at start of shift");
  return {rows}; };

/* ======================================================================
   STATISTICS
   ====================================================================== */
const C = { A2:{2:1.880,3:1.023,4:0.729,5:0.577,6:0.483,7:0.419,8:0.373,9:0.337,10:0.308}, D3:{2:0,3:0,4:0,5:0,6:0,7:0.076,8:0.136,9:0.184,10:0.223},
  D4:{2:3.267,3:2.574,4:2.282,5:2.114,6:2.004,7:1.924,8:1.864,9:1.816,10:1.777}, d2:{2:1.128,3:1.693,4:2.059,5:2.326,6:2.534,7:2.704,8:2.847,9:2.970,10:3.078} };
function spcStats(st){
  const n=st.n||5; const groups=(st.data||[]).map(g=>(g||[]).slice(0,n).map(v=>v===""||v==null?null:+v)).filter(g=>g.every(v=>v!=null&&!isNaN(v)));
  if(groups.length<2) return {k:groups.length, ok:false};
  const xb=groups.map(g=>g.reduce((a,b)=>a+b,0)/n), R=groups.map(g=>Math.max(...g)-Math.min(...g));
  const X=xb.reduce((a,b)=>a+b,0)/xb.length, Rb=R.reduce((a,b)=>a+b,0)/R.length;
  const all=groups.flat(), N=all.length, mean=all.reduce((a,b)=>a+b,0)/N, s=Math.sqrt(all.reduce((a,v)=>a+(v-mean)**2,0)/(N-1));
  const sw=Rb/C.d2[n]; const L=st.lsl, U=st.usl;
  const cp = (U!=null&&L!=null&&sw>0)?(U-L)/(6*sw):null;
  const cpk = sw>0 ? Math.min(U!=null?(U-X)/(3*sw):Infinity, L!=null?(X-L)/(3*sw):Infinity) : null;
  const pp = (U!=null&&L!=null&&s>0)?(U-L)/(6*s):null;
  const ppk = s>0 ? Math.min(U!=null?(U-mean)/(3*s):Infinity, L!=null?(mean-L)/(3*s):Infinity) : null;
  const uclx=X+C.A2[n]*Rb, lclx=X-C.A2[n]*Rb, uclr=C.D4[n]*Rb, lclr=C.D3[n]*Rb;
  const oocX = xb.map((v,i)=>v>uclx||v<lclx?i+1:0).filter(Boolean), oocR = R.map((v,i)=>v>uclr||v<lclr?i+1:0).filter(Boolean);
  // run rule: 7 consecutive on one side of centre line
  let run=0, side=0, runs=[]; xb.forEach((v,i)=>{ const sd=v>X?1:v<X?-1:0; if(sd&&sd===side) run++; else { side=sd; run=sd?1:0; } if(run===7) runs.push(i+1); });
  const outSpec = all.filter(v=>(U!=null&&v>U)||(L!=null&&v<L)).length;
  const idx = cpk==null||!isFinite(cpk) ? null : cpk;
  const verdict = idx==null?"—": idx>=1.67?"Acceptable (Cpk ≥ 1.67)": idx>=1.33?"Conditionally acceptable (1.33 ≤ Cpk < 1.67)":"Not capable (Cpk < 1.33) – action required";
  return {ok:true, k:groups.length, n, N, xb, R, X, Rb, mean, s, sw, cp, cpk:isFinite(cpk)?cpk:null, pp, ppk:isFinite(ppk)?ppk:null, uclx, lclx, uclr, lclr, oocX, oocR, runs, outSpec, min:Math.min(...all), max:Math.max(...all), all, verdict, stable:!oocX.length&&!oocR.length&&!runs.length};
}
const K1={2:0.8862,3:0.5908}, K2={2:0.7071,3:0.5231}, K3={2:0.7071,3:0.5231,4:0.4467,5:0.4030,6:0.3742,7:0.3534,8:0.3375,9:0.3249,10:0.3146};
function msaStats(st){
  const A=(st.appraisers||[]).length, r=st.trials||3, p=st.parts||10;
  const D=st.data||[]; const vals=(a,t,i)=>{ const v=D[a]&&D[a][t]&&D[a][t][i]; return v===""||v==null||isNaN(+v)?null:+v; };
  for(let a=0;a<A;a++) for(let t=0;t<r;t++) for(let i=0;i<p;i++) if(vals(a,t,i)==null) return {ok:false};
  const Rbar=[], Xbar=[]; const partAvg=Array(p).fill(0);
  for(let a=0;a<A;a++){ let rs=0, sm=0; for(let i=0;i<p;i++){ const v=[...Array(r).keys()].map(t=>vals(a,t,i)); rs+=Math.max(...v)-Math.min(...v); const s=v.reduce((x,y)=>x+y,0); sm+=s; partAvg[i]+=s; } Rbar.push(rs/p); Xbar.push(sm/(p*r)); }
  for(let i=0;i<p;i++) partAvg[i]/=(A*r);
  const RR=Rbar.reduce((x,y)=>x+y,0)/A, Xdiff=Math.max(...Xbar)-Math.min(...Xbar), Rp=Math.max(...partAvg)-Math.min(...partAvg);
  const EV=RR*K1[r]; const av2=(Xdiff*K2[A])**2-(EV**2)/(p*r); const AV=av2>0?Math.sqrt(av2):0;
  const GRR=Math.sqrt(EV**2+AV**2), PV=Rp*K3[p], TV=Math.sqrt(GRR**2+PV**2);
  const pct=v=>TV>0?100*v/TV:null; const tol=st.tol; const pctTol=v=>tol?100*v/(tol/6):null;
  const ndc=GRR>0?Math.floor(1.41*PV/GRR):null; const uclR=({2:3.267,3:2.574})[r]*RR;
  const g=tol?pctTol(GRR):pct(GRR);
  const verdict = g==null?"—": g<10?"Acceptable (< 10 %)": g<=30?"Conditionally acceptable (10–30 %) – may be accepted based on application / cost":"Not acceptable (> 30 %) – improve the measurement system";
  return {ok:true, Rbar, Xbar, RR, Xdiff, Rp, EV, AV, GRR, PV, TV, pEV:pct(EV), pAV:pct(AV), pGRR:pct(GRR), pPV:pct(PV), tEV:pctTol(EV), tAV:pctTol(AV), tGRR:pctTol(GRR), ndc, uclR, verdict, basis:tol?"tolerance":"total variation", partAvg};
}
/* clearly-labelled simulated data (for training / demo only) */
function simulateSPC(st){ const mid=((st.lsl??st.nominal??0)+(st.usl??st.nominal??0))/2, tol=((st.usl??mid)-(st.lsl??mid))||0.1, sd=tol/10;
  const g=()=>{ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  st.data=Array.from({length:st.k||25},()=>Array.from({length:st.n||5},()=>r4(mid+g()*sd))); st.simulated=true; }
function simulateMSA(st, mid){ mid=mid||0; const c=st.tol||0.05; const g=()=>{ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  const parts=Array.from({length:st.parts},()=>g()*c/5); st.data=st.appraisers.map((_,a)=>Array.from({length:st.trials},()=>parts.map(p=>r4(mid+p+g()*c/60+(a-1)*c/200)))); st.simulated=true; }

/* pull readings entered in setup / patrol / self reports into the SPC study */
function pullReadings(docs, charNo, n){
  const out=[];
  ["setup","patrol","self"].forEach(id=>{ const d=docs[id]; if(!d||!d.sections) return; d.sections.forEach(s=>s.rows.forEach(r=>{ if(String(r.charNo)!==String(charNo)) return;
    Object.keys(r).filter(k=>/^[rt]\d+$/.test(k)).sort((a,b)=>+a.slice(1)-+b.slice(1)).forEach(k=>{ const v=r[k]; if(v!==""&&v!=null&&!isNaN(+v)) out.push(+v); }); })); });
  if(docs.pdi) docs.pdi.rows.forEach(r=>{ if(String(r.charNo)===String(charNo)) ["s1","s2","s3","s4","s5"].forEach(k=>{ const v=r[k]; if(v!==""&&v!=null&&!isNaN(+v)) out.push(+v); }); });
  const groups=[]; for(let i=0;i+n<=out.length;i+=n) groups.push(out.slice(i,i+n)); return groups;
}
function judge(v, lsl, usl){ if(v===""||v==null) return ""; const t=String(v).trim().toUpperCase(); if(["OK","NG","NOT OK","ACC","REJ"].includes(t)) return t==="OK"||t==="ACC"?"ok":"ng"; const x=+v; if(isNaN(x)) return ""; if((lsl!=null&&x<lsl-1e-12)||(usl!=null&&x>usl+1e-12)) return "ng"; return "ok"; }

window.PDDocs = { DOCS, fmtFE, AP, genAll, genOne, spcStats, msaStats, simulateSPC, simulateMSA, pullReadings, judge, SPC_CONST:C };
})();
