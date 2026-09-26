/* =====================================================================
   Process Documents – CNC program generator.
   Builds a Fanuc-compatible G-code DRAFT for every CNC operation
   (turning OP1 / OP2, VMC, drilling) from the ballooned characteristics,
   the tools chosen in the process plan and the company's CNC settings.

   Safety: dimensions that a drawing gives only as a picture (lengths,
   hole positions, depths) are put in clearly named variables at the top
   of the program, and the program alarms (#3000) until the programmer
   has checked them and set #1=1. Always prove out with dry run /
   single block before cutting.
   ===================================================================== */
(function(){
"use strict";
const E = window.PDEngine;

const CNC_KEYS = ["TURN1","TURN2","TURN","VMC","DRILL"];
const isCNC = op => op && CNC_KEYS.includes(op.key);

/* ---------- formatting ---------- */
const N = v => { if(v==null||!isFinite(+v)) return "0."; const r=Math.round(+v*1000)/1000; let s=r.toFixed(3).replace(/0+$/,""); if(s.endsWith(".")) return s; return s; };
const I = v => String(Math.round(+v||0));
const cm = t => "(" + String(t||"").toUpperCase().replace(/Ø/g,"DIA ").replace(/[−–]/g,"-").replace(/×/g,"X").replace(/±/g,"+/-").replace(/°/g,"DEG").replace(/[()\[\]]/g," ").replace(/[^\x20-\x7E]/g,"").replace(/\s+/g," ").trim().slice(0,60) + ")";
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rpm = (vc,d,max)=>clamp(Math.round(1000*vc/(Math.PI*Math.max(d,1))/10)*10,50,max);

function charsOf(op, plan){
  return (op.chars||[]).map(no=>plan.chars.find(c=>c.no===no)).filter(Boolean).map(c=>{
    const x={type:c.type,text:c.text||"",label:c.label||c.type,no:c.no,nominal:num(c.nominal),upper:num(c.upper),lower:num(c.lower),cls:c.cls,spec:c.spec||""};
    x.internal = E.isInternal ? E.isInternal(x) : /BORE|HOLE|H\d/i.test(x.text);
    x.target = x.nominal==null ? null : x.nominal + ((x.upper||0)+(x.lower||0))/2;   // aim at the middle of the tolerance
    const m=/(\d+)\s*[X×]\s/i.exec(x.text+" "); x.count = m? +m[1] : 1;
    return x; });
}
function num(v){ return v===""||v==null||isNaN(+v) ? null : +v; }

function toolIndex(tools){
  const list=(tools||[]).filter(t=>!/program-controlled|^—$/i.test((t.spec||"")+"")&&!/chamfer \(by/i.test(t.desc||""));
  return list.map((t,i)=>Object.assign({},t,{tno:i+1}));
}
const findT = (T,rx)=>T.find(t=>rx.test(t.desc||""));

/* ---------- common head / tail ---------- */
function head(o){
  const L=[];
  L.push("%");
  L.push(`O${String(o.progNo).padStart(4,"0")} ${cm((o.h.partNo||"")+" "+(o.h.partName||"")+(o.h.drawingRev?" REV "+o.h.drawingRev:""))}`);
  L.push(cm(`OP ${o.op.opNo} ${o.op.name}`));
  if(o.op.machine) L.push(cm("MACHINE "+o.op.machine));
  L.push(cm(`MATERIAL ${o.h.material||"-"} ${o.matTxt}`));
  if(o.s.cncHeader) L.push(cm(o.s.cncHeader));
  L.push(cm(`GENERATED ${new Date().toISOString().slice(0,10)} DRAFT`));
  L.push("(*** DRAFT - PROVE OUT WITH DRY RUN AND SINGLE BLOCK ***)");
  L.push("(*** CHECK ALL VARIABLES BELOW AGAINST THE DRAWING  ***)");
  L.push("(TOOL LIST)");
  o.T.forEach(t=>L.push(cm(`T${String(t.tno).padStart(2,"0")} ${t.desc} ${t.spec}`)));
  if(o.lock){ L.push("#1=0 (SET #1=1 AFTER PROVE-OUT)"); L.push("IF[#1NE1]GOTO9000"); }
  return L;
}
function tail(o, L, endLines){
  endLines.forEach(x=>L.push(x));
  L.push("M30");
  if(o.lock){ L.push("N9000 #3000=1 (PROGRAM NOT VERIFIED - SET #1=1)"); L.push("M30"); }
  L.push("%");
  return L.join("\n");
}

/* ======================================================================
   TURNING (Fanuc lathe, G-code system A: X = diameter)
   ====================================================================== */
function turning(o){
  const {plan,op,s,T,ch}=o, h=o.h, vc=o.vc, maxS=+s.cncMaxRpmLathe||3000, cool=s.cncCoolant||"M08";
  const Lpart=Math.max(5, +(plan.ctxInfo&&plan.ctxInfo.length)||50);
  const ext=ch.filter(c=>c.type==="Diameter"&&!c.internal&&c.target!=null).sort((a,b)=>a.target-b.target);
  const int=ch.filter(c=>c.type==="Diameter"&&c.internal&&c.target!=null).sort((a,b)=>b.target-a.target);
  const thr=ch.filter(c=>c.type==="Thread");
  const chamf=ch.find(c=>c.type==="Chamfer"&&c.nominal); const C=chamf?Math.min(3,chamf.nominal):0.5;
  const fine=ch.some(c=>c.type==="Surface finish"&&(c.upper||c.nominal||9)<=1.6);
  const maxOD=Math.max(...ext.map(c=>c.target),+(plan.ctxInfo&&plan.ctxInfo.maxOD)||0,10);
  const stock=Math.ceil(maxOD+3);
  const L=head(o), v=[];
  // variables the programmer must confirm
  L.push("(---- DIMENSIONS TO CHECK - Z FROM PART FACE Z0 ----)");
  let vn=11;
  const extZ=ext.map((c,i)=>{ const z=Math.round(Lpart*(i+1)/Math.max(ext.length,1)*10)/10; const id=vn++; L.push(`#${id}=${N(z)} ${cm(`Z END OF DIA ${N(c.nominal)} BALLOON ${c.no}`)}`); return id; });
  vn=31;
  const intZ=int.map((c,i)=>{ const z=Math.round(Lpart*(i+1)/Math.max(int.length,1)*10)/10; const id=vn++; L.push(`#${id}=${N(z)} ${cm(`BORE DEPTH DIA ${N(c.nominal)} BALLOON ${c.no}`)}`); return id; });
  const tExt=thr.filter(c=>!c.internal), tInt=thr.filter(c=>c.internal);
  const thZ=tExt.map((c,i)=>{ const id=51+i; L.push(`#${id}=${N(Math.min(Lpart,20))} ${cm(`THREAD LENGTH ${c.text} BALLOON ${c.no}`)}`); return id; });
  const tapZ=tInt.map((c,i)=>{ const id=61+i; L.push(`#${id}=${N(Math.min(Lpart,15))} ${cm(`TAP DEPTH ${c.text} BALLOON ${c.no}`)}`); return id; });
  L.push("G21 G40 G80 G99 (MM, FEED PER REV)");
  L.push("G28 U0.");
  L.push(`G50 S${I(maxS)} (SPINDLE LIMIT)`);
  let nb=10;
  const tc=(t,label)=>{ L.push(""); L.push(`N${nb} ${cm(`T${String(t.tno).padStart(2,"0")} ${label||t.desc}`)}`); nb+=10; L.push("G28 U0."); L.push(`T${String(t.tno).padStart(2,"0")}${String(t.tno).padStart(2,"0")}`); };
  const done=()=>{ L.push(`G00 X${N(stock+50)} Z50. M09`); };

  // OD finish profile (blocks N100-N110). Placed directly after the G71 call: Fanuc continues after block Q.
  const prof=[];
  if(ext.length){
    prof.push(`N100 G00 X${N(ext[0].target-2*C)}`);
    prof.push("G01 Z0. F0.1");
    ext.forEach((c,i)=>{
      if(i===0) prof.push(`X${N(c.target)} Z${N(-C)}`);
      else { prof.push(`X${N(c.target-2*C)}`); prof.push(`X${N(c.target)} Z[-#${extZ[i-1]}-${N(C)}]`); }
      prof.push(`Z-#${extZ[i]} ${cm(`DIA ${N(c.nominal)} ${c.spec}`)}`);
    });
    prof.push(`N110 X${N(stock+2)}`);
  }
  // 1. face + OD rough
  const tr=findT(T,/rough/i), tf=findT(T,/finish turning|profil/i)||tr;
  if(tr){
    tc(tr,"FACE AND OD ROUGH");
    L.push(`G96 S${I((vc[0]+vc[1])/2)} M03`); L.push(`G00 X${N(stock+2)} Z2. ${cool}`);
    L.push("(FACING - 1.5 MM STOCK ON FACE)");
    [1.0,0.5,0].forEach(z=>L.push(`G94 X-1.6 Z${N(z)} F0.2`));
    if(ext.length){
      L.push(`G00 X${N(stock+2)} Z2.`);
      L.push("G71 U2. R0.5");
      L.push("G71 P100 Q110 U0.4 W0.1 F0.25");
      prof.forEach(x=>L.push(x));
    }
    done();
  }
  if(tf&&ext.length){
    if(!tr){ L.push("(NO ROUGHING TOOL - OD PROFILE N100-N110 IS DEFINED IN THE FINISH BLOCK)"); }
    tc(tf,"OD FINISH");
    L.push(`G96 S${I(vc[1])} M03`); L.push(`G00 X${N(stock+2)} Z2. ${cool}`);
    L.push("G42 (TOOL NOSE RADIUS COMP)");
    if(!tr){ L.push(`G00 X${N(stock+2)} Z2.`); prof.forEach(x=>L.push(x)); L.push(`G00 X${N(stock+2)} Z2.`); }
    else L.push(`G70 P100 Q110 F${fine?"0.08":"0.12"}`);
    L.push("G40"); done();
  }
  // 2. drill
  const td=findT(T,/u-drill|solid carbide \/ hss drill|^drill/i);
  let drillD=0;
  if(td&&(int.length||tInt.length)){
    drillD=+(String(td.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||10;
    tc(td,`DRILL DIA ${N(drillD)}`);
    L.push(`G97 S${I(rpm(vc[0]*0.45,drillD,maxS))} M03`); L.push(`G00 X0. Z5. ${cool}`);
    L.push("G74 R0.5");
    L.push(`G74 Z[-#${intZ.length?intZ[intZ.length-1]:31}-${N(0.3*drillD+2)}] Q${I(Math.max(2,drillD*0.5)*1000)} F0.12 ${cm("PECK DRILL - CHECK DEPTH")}`);
    done();
  }
  // 3. bore
  const tb=findT(T,/boring/i);
  if(tb&&int.length){
    const start=Math.max(drillD-1,1);
    tc(tb,"BORE ROUGH AND FINISH");
    L.push(`G96 S${I(vc[0])} M03`); L.push(`G00 X${N(start)} Z2. ${cool}`);
    L.push("G71 U1. R0.5");
    L.push("G71 P200 Q210 U-0.3 W0.1 F0.15");
    L.push(`N200 G00 X${N(int[0].target+2*C)}`);
    L.push("G01 Z0. F0.08");
    int.forEach((c,i)=>{
      if(i===0) L.push(`X${N(c.target)} Z${N(-C)}`);
      else L.push(`X${N(c.target)}`);
      L.push(`Z-#${intZ[i]} ${cm(`BORE DIA ${N(c.nominal)} ${c.spec}`)}`);
    });
    L.push(`N210 X${N(start)}`);
    L.push(`G96 S${I(vc[1])}`);
    L.push("G41"); L.push(`G70 P200 Q210 F${fine?"0.06":"0.1"}`); L.push("G40");
    L.push("G00 Z5."); done();
  }
  // 4. groove
  const tg=findT(T,/groov/i);
  if(tg){
    L.push("#41=0. (GROOVE Z POSITION - FROM DRAWING)"); L.push(`#42=${N(Math.max(1,(ext[0]?ext[0].target:maxOD)-3))} (GROOVE BOTTOM DIA - FROM DRAWING)`);
    tc(tg,"GROOVE");
    L.push(`G97 S${I(rpm(vc[0]*0.6,maxOD,maxS))} M03`); L.push(`G00 X${N(stock+2)} Z-#41 ${cool}`);
    L.push("G75 R0.5"); L.push("G75 X#42 P1500 F0.05"); done();
  }
  // 5. external thread
  const tt=findT(T,/external thread/i);
  if(tt) tExt.forEach((c,i)=>{
    const th=E.parseThread?E.parseThread(c.text):{}; const d=th.d||c.nominal||10, p=th.p||1.5, hgt=0.6134*p, minor=d-2*hgt;
    tc(tt,`THREAD ${th.name||c.text}`);
    L.push(`G97 S${I(rpm(vc[0]*0.5,d,maxS))} M03`); L.push(`G00 X${N(d+4)} Z${N(3*p)} ${cool}`);
    L.push(`G76 P020060 Q50 R0.02 ${cm("2 FINISH PASSES, 60 DEG")}`);
    L.push(`G76 X${N(minor)} Z-#${thZ[i]} P${I(hgt*1000)} Q${I(Math.max(0.1,hgt/4)*1000)} F${N(p)} ${cm(`${th.name||""} MINOR DIA ${N(minor)}`)}`);
    done();
  });
  // 6. tap
  const tp=findT(T,/machine tap/i);
  if(tp) tInt.forEach((c,i)=>{
    const th=E.parseThread?E.parseThread(c.text):{}; const d=th.d||c.nominal||8, p=th.p||1.25, sp=clamp(Math.round(1000*10/(Math.PI*d)),50,800);
    tc(tp,`TAP ${th.name||c.text}`);
    L.push(`M29 S${I(sp)} ${cm("RIGID TAPPING")}`); L.push(`G00 X0. Z5. ${cool}`);
    L.push(`G84 Z-#${tapZ[i]} R-3. F${N(p)} ${cm("F = PITCH, FEED PER REV")}`); L.push("G80"); done();
  });
  // 7. part off
  const tpo=findT(T,/parting/i);
  if(tpo){ L.push(`#71=${N(Lpart+3)} (PART-OFF Z - PART LENGTH + BLADE WIDTH)`); tc(tpo,"PART OFF"); L.push(`G97 S${I(rpm(vc[0]*0.5,maxOD,maxS))} M03`); L.push(`G00 X${N(stock+2)} Z-#71 ${cool}`); L.push("G75 R0.5"); L.push("G75 X-1. P2000 F0.05"); done(); }
  if(!T.length) L.push("(NO TOOLS IN THE PROCESS PLAN FOR THIS OPERATION - ADD TOOLS AND REGENERATE)");
  L.push("");
  return tail(o,L,["G28 U0. W0.","M05","M09"]);
}

/* ======================================================================
   MILLING / DRILLING (Fanuc VMC)
   ====================================================================== */
function milling(o){
  const {plan,op,s,T,ch}=o, vc=o.vc, maxS=+s.cncMaxRpmMill||8000, cool=s.cncCoolant||"M08", wcs=s.cncWcs||"G54", safe=+s.cncSafeZ||50;
  const env=Math.max(20,+(plan.ctxInfo&&plan.ctxInfo.maxOD)||100);
  const holes=ch.filter(c=>c.type==="Diameter"&&c.internal&&c.nominal!=null);
  const thr=ch.filter(c=>c.type==="Thread");
  const chamf=ch.find(c=>c.type==="Chamfer"&&c.nominal); const C=chamf?Math.min(2,chamf.nominal):0.5;
  const L=head(o);
  L.push(`(---- WORK ZERO ${wcs}: X0 Y0 = PART CENTRE, Z0 = TOP FACE ----)`);
  L.push(`#20=${N(env)} (PART SIZE IN X)`); L.push(`#21=${N(env)} (PART SIZE IN Y)`);
  // feature positions
  let vn=101; const feats=[];
  const addFeat=(c,kind)=>{ const pos=[]; for(let i=0;i<Math.min(c.count,12);i++){ pos.push([vn,vn+1]); L.push(`#${vn}=0. #${vn+1}=0. ${cm(`${kind} ${i+1} X Y - BALLOON ${c.no}`)}`); vn+=2; }
    const dId=vn++; const Lp=+(plan.ctxInfo&&plan.ctxInfo.length)||0, thru=/THRU/i.test(c.text); const dd=c.type==="Thread"?(thru&&Lp?Lp:((E.parseThread&&E.parseThread(c.text).d)||c.nominal||8)*2):(thru&&Lp?Lp:Math.min((c.nominal||10)*2.5,Lp||999)); L.push(`#${dId}=${N(Math.round(dd))} ${cm(`${kind} DEPTH - BALLOON ${c.no}`)}`);
    feats.push({c,kind,pos,dId}); };
  holes.forEach(c=>addFeat(c,"HOLE DIA "+N(c.nominal)));
  thr.forEach(c=>addFeat(c,"THREAD "+c.text));
  L.push(`G21 G17 G40 G49 G80 G90 ${cm("MM, ABSOLUTE")}`);
  let nb=10;
  const tc=(t,label,S,x,y)=>{ L.push(""); L.push(`N${nb} ${cm(`T${t.tno} ${label||t.desc}`)}`); nb+=10; L.push(`T${t.tno} M06`); L.push(`${wcs} G00 G90 X${x} Y${y} S${I(S)} M03`); L.push(`G43 Z${N(safe)} H${String(t.tno).padStart(2,"0")} ${cool}`); };
  const up=()=>{ L.push("G80"); L.push(`G00 Z${N(safe)} M09`); };
  const cycle=(f,first)=>f.pos.slice(1).forEach(p=>L.push(`X#${p[0]} Y#${p[1]}`));
  // face mill
  const tfm=findT(T,/face mill/i);
  if(tfm){ const d=+(String(tfm.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||63, step=Math.round(d*0.7);
    tc(tfm,`FACE MILL DIA ${d}`, rpm((vc[0]+vc[1])/2,d,maxS), "[-#20/2-"+N(d/2+10)+"]", "[-#21/2+"+N(d*0.3)+"]");
    [0.3,0].forEach(z=>{ L.push(`#30=[-#21/2+${N(d*0.3)}]`); L.push(`G00 Z5.`); L.push(`G01 Z${N(z)} F500`); L.push("WHILE[#30LE[#21/2+10]]DO1"); L.push(`G00 X[-#20/2-${N(d/2+10)}] Y#30`); L.push(`G01 X[#20/2+${N(d/2+10)}] F${I(rpm((vc[0]+vc[1])/2,d,maxS)*0.12*5)}`); L.push(`G00 Z5.`); L.push(`#30=#30+${step}`); L.push("END1"); });
    up(); }
  // end mill – contour must come from the drawing / CAM
  const tem=findT(T,/end mill/i);
  if(tem){ L.push(""); L.push(`(T${tem.tno} END MILL - PROFILE / POCKET / SLOT)`); L.push("(CONTOUR NOT GENERATED: ADD THE TOOL PATH FROM CAM OR THE DRAWING HERE)"); }
  const first=f=>f&&f.pos[0]?[`#${f.pos[0][0]}`,`#${f.pos[0][1]}`]:["0.","0."];
  // spot drill every feature
  const tsp=findT(T,/spot|centre drill/i);
  const featD=f=>f.c.type==="Thread"?((E.parseThread&&E.parseThread(f.c.text).d)||f.c.nominal||8):f.c.nominal;
  const small=feats.filter(f=>featD(f)<=16);
  if(tsp&&small.length){ const f0=first(small[0]); tc(tsp,"SPOT DRILL",rpm(vc[0]*0.4,10,maxS),f0[0],f0[1]);
    small.forEach((f,i)=>{ const d=f.c.type==="Thread"?(E.tapDrill&&E.tapDrill(E.parseThread(f.c.text)))||f.c.nominal||6:f.c.nominal; L.push(`G99 G81 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z${N(-Math.min(5,d/2+0.2))} R2. F80. ${cm("SPOT "+f.kind)}`); cycle(f); });
    up(); }
  // drills, reamers, boring
  holes.forEach(c=>{ const f=feats.find(x=>x.c===c), d=c.nominal, fit=/H\d|G\d/i.test(c.text);
    const dr=T.find(t=>/drill/i.test(t.desc)&&!/tap|spot|centre/i.test(t.desc)&&Math.abs((+(String(t.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||0)-(d>25?0:(fit&&d<=25?d-0.2:d)))<0.25);
    if(dr){ const dd=+(String(dr.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]; tc(dr,`DRILL DIA ${N(dd)}`,rpm(vc[0]*0.45,dd,maxS),`#${f.pos[0][0]}`,`#${f.pos[0][1]}`);
      L.push(`G99 G83 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z[-#${f.dId}-${N(0.3*dd)}] R2. Q${N(Math.max(1,dd*0.8))} F${I(rpm(vc[0]*0.45,dd,maxS)*0.02*dd/2)} ${cm("PECK - CHECK DEPTH")}`); cycle(f); up(); }
    const rm=T.find(t=>/reamer/i.test(t.desc)&&String(t.spec).includes(N(d).replace(/\.$/,"")));
    if(rm){ tc(rm,`REAM DIA ${N(d)}`,rpm(12,d,maxS),`#${f.pos[0][0]}`,`#${f.pos[0][1]}`); L.push(`G99 G85 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z-#${f.dId} R2. F${I(rpm(12,d,maxS)*0.25)} ${cm(c.spec)}`); cycle(f); up(); }
    const bh=T.find(t=>/boring head/i.test(t.desc)&&String(t.spec).includes(N(d).replace(/\.$/,"")));
    if(bh){ tc(bh,`FINISH BORE DIA ${N(d)}`,rpm(vc[0]*0.6,d,maxS),`#${f.pos[0][0]}`,`#${f.pos[0][1]}`); L.push("(ROUGH THE BORE FIRST - HELICAL WITH END MILL OR STEP DRILL)"); L.push(`G99 G85 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z-#${f.dId} R2. F${I(rpm(vc[0]*0.6,d,maxS)*0.08)} ${cm(`DIA ${N(c.target)} ${c.spec}`)}`); cycle(f); up(); }
  });
  // threads: tap drill + tap
  thr.forEach(c=>{ const f=feats.find(x=>x.c===c), th=E.parseThread?E.parseThread(c.text):{}, td=E.tapDrill?E.tapDrill(th):null, p=th.p||1.25;
    const dr=td&&T.find(t=>/tap drill/i.test(t.desc)&&String(t.spec).includes(N(td).replace(/\.$/,"")));
    if(dr){ tc(dr,`TAP DRILL DIA ${N(td)}`,rpm(vc[0]*0.45,td,maxS),`#${f.pos[0][0]}`,`#${f.pos[0][1]}`); L.push(`G99 G83 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z[-#${f.dId}-${N(0.3*td+2*p)}] R2. Q${N(Math.max(1,td*0.8))} F${I(rpm(vc[0]*0.45,td,maxS)*0.02*td/2)}`); cycle(f); up(); }
    const tp=T.find(t=>/machine tap|thread mill/i.test(t.desc)&&(t.remarks===th.name||String(t.spec).includes(th.name||"~")));
    if(tp&&/thread mill/i.test(tp.desc)){ L.push(""); L.push(`(T${tp.tno} THREAD MILL ${cm(th.name||"")} - ADD HELICAL PATH FROM CAM)`); }
    else if(tp){ const sp=clamp(Math.round(1000*10/(Math.PI*(th.d||8))),50,1500); tc(tp,`TAP ${th.name||c.text}`,sp,`#${f.pos[0][0]}`,`#${f.pos[0][1]}`);
      L.push("G95 (FEED PER REV FOR TAPPING)"); L.push(`M29 S${I(sp)}`); L.push(`G99 G84 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z-#${f.dId} R5. F${N(p)} ${cm(th.name||"")}`); cycle(f); L.push("G80"); L.push("G94 (FEED PER MINUTE)"); L.push(`G00 Z${N(safe)} M09`); }
  });
  // chamfer mill
  const tch=findT(T,/chamfer mill/i), chD=+(String(tch&&tch.spec||"").match(/(\d+(?:\.\d+)?)/)||[])[1]||12;
  const reach=feats.filter(f=>featD(f)/2+C<=chD/2-0.5), big=feats.filter(f=>!reach.includes(f));
  if(tch&&reach.length){ const f0=first(reach[0]); tc(tch,`CHAMFER ${N(C)} X 45 DEG`,rpm(vc[0]*0.5,chD,maxS),f0[0],f0[1]);
    reach.forEach(f=>{ const d=featD(f); L.push(`G99 G81 X#${f.pos[0][0]} Y#${f.pos[0][1]} Z${N(-(d/2+C))} R2. F150. ${cm("CHAMFER "+f.kind)}`); cycle(f); }); up(); }
  if(tch&&big.length) big.forEach(f=>L.push(cm(`CHAMFER ${f.kind}: TOO LARGE FOR CHAMFER MILL - USE CIRCULAR INTERPOLATION / CAM`)));
  if(!T.length) L.push("(NO TOOLS IN THE PROCESS PLAN FOR THIS OPERATION - ADD TOOLS AND REGENERATE)");
  L.push("");
  return tail(o,L,["G91 G28 Z0.","G28 Y0.","G90","M05"]);
}

/* ---------- public ---------- */
function generate(op, plan, settings, progNo){
  const s=settings||{}, h=plan.header||{}, mc=(plan.ctxInfo&&plan.ctxInfo.matCls)||"P";
  const o={op,plan,s,h,progNo:progNo||1000,T:toolIndex(op.tools),ch:charsOf(op,plan),vc:(E.VC&&E.VC[mc])||[180,220],matTxt:(E.MATCLS_TXT&&E.MATCLS_TXT[mc])||"",lock:String(s.cncLock??"1")!=="0"};
  return /^TURN/.test(op.key) ? turning(o) : milling(o);
}
function progNumbers(plan, settings){ const start=+((settings||{}).cncProgStart)||1000; const map={}; let i=0; plan.ops.filter(isCNC).forEach(o=>{ map[o.opNo]=start+i*10; i++; }); return map; }

window.PDCNC = { isCNC, generate, progNumbers };
})();
