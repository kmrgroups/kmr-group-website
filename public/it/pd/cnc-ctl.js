/* =====================================================================
   Process Documents - CNC programs for Siemens Sinumerik and Heidenhain.
   (Fanuc, Haas, Mitsubishi and other ISO G-code controls use pd/cnc.js.)
   Every program is a DRAFT: dimensions that a drawing gives only as a picture are
   named variables at the top, and the program stops until the programmer checks them.
   Cycle parameter lists differ between software versions - confirm on the control.
   ===================================================================== */
(function(){
"use strict";
window.PDCNCExt = window.PDCNCExt || {};

/* ---------------- shared pieces ---------------- */
function txt(H,t){ return H.cm(t).slice(1,-1); }
function sHead(o,H,ext){
  const L=[], c=txt.bind(null,H);
  L.push("; "+c((o.h.partNo||"")+" "+(o.h.partName||"")+(o.h.drawingRev?" REV "+o.h.drawingRev:"")));
  L.push("; "+c(`OP ${o.op.opNo} ${o.op.name}`));
  if(o.op.machine) L.push("; "+c("MACHINE "+o.op.machine));
  L.push("; "+c("CONTROL: "+o.ctl.name));
  L.push("; "+c(`MATERIAL ${o.h.material||"-"} ${o.matTxt}`));
  if(o.s.cncHeader) L.push("; "+c(o.s.cncHeader));
  L.push("; "+c(`PROGRAM P${String(o.progNo).padStart(4,"0")}.${ext} GENERATED ${new Date().toISOString().slice(0,10)} DRAFT`));
  L.push("; *** DRAFT - PROVE OUT WITH DRY RUN AND SINGLE BLOCK ***");
  L.push(ext==="H"?"; *** CHECK ALL Q-PARAMETERS BELOW AGAINST THE DRAWING ***":"; *** CHECK ALL R-PARAMETERS BELOW AGAINST THE DRAWING ***");
  L.push("; TOOL LIST");
  o.T.forEach(t=>L.push("; "+c(`T${t.tno} ${t.desc} ${t.spec}`)));
  return L;
}

/* ======================================================================
   SIEMENS SINUMERIK
   ====================================================================== */
function siemensTail(o,L,H,end,after){
  end.forEach(x=>L.push(x));
  L.push("M30");
  (after||[]).forEach(x=>L.push(x));
  if(o.lock){ L.push("NOTVERIFIED:"); L.push('MSG("PROGRAM NOT VERIFIED - SET R1=1")'); L.push("M0"); L.push("M30"); }
  return L.join("\n");
}
function siemensTurning(o,H){
  const {plan,op,s,T,ch}=o, vc=o.vc, N=H.N, I=H.I, c=t=>txt(H,t), maxS=+s.cncMaxRpmLathe||3000, cool=(s.cncCoolant==="M07"?"M7":"M8");
  const Lpart=Math.max(5,+(plan.ctxInfo&&plan.ctxInfo.length)||50);
  const ext=ch.filter(x=>x.type==="Diameter"&&!x.internal&&x.target!=null).sort((a,b)=>a.target-b.target);
  const int=ch.filter(x=>x.type==="Diameter"&&x.internal&&x.target!=null).sort((a,b)=>b.target-a.target);
  const thr=ch.filter(x=>x.type==="Thread"), tExt=thr.filter(x=>!x.internal), tInt=thr.filter(x=>x.internal);
  const chamf=ch.find(x=>x.type==="Chamfer"&&x.nominal), C=chamf?Math.min(3,chamf.nominal):0.5;
  const fine=ch.some(x=>x.type==="Surface finish"&&(x.upper||x.nominal||9)<=1.6);
  const maxOD=Math.max(...ext.map(x=>x.target),+(plan.ctxInfo&&plan.ctxInfo.maxOD)||0,10), stock=Math.ceil(maxOD+3);
  const L=sHead(o,H,"MPF"), after=[];
  L.push("; ---- DIMENSIONS TO CHECK - Z FROM PART FACE Z0 ----");
  let rn=11;
  const extZ=ext.map((x,i)=>{ const z=Math.round(Lpart*(i+1)/Math.max(ext.length,1)*10)/10, id=rn++; L.push(`R${id}=${N(z)} ; ${c(`Z END OF DIA ${N(x.nominal)} BALLOON ${x.no}`)}`); return id; });
  rn=31;
  const intZ=int.map((x,i)=>{ const z=Math.round(Lpart*(i+1)/Math.max(int.length,1)*10)/10, id=rn++; L.push(`R${id}=${N(z)} ; ${c(`BORE DEPTH DIA ${N(x.nominal)} BALLOON ${x.no}`)}`); return id; });
  const thZ=tExt.map((x,i)=>{ const id=51+i; L.push(`R${id}=${N(Math.min(Lpart,20))} ; ${c(`THREAD LENGTH ${x.text} BALLOON ${x.no}`)}`); return id; });
  const tapZ=tInt.map((x,i)=>{ const id=61+i; L.push(`R${id}=${N(Math.min(Lpart,15))} ; ${c(`TAP DEPTH ${x.text} BALLOON ${x.no}`)}`); return id; });
  if(o.lock){ L.push("R1=0 ; SET R1=1 AFTER PROVE-OUT"); L.push("IF R1<>1 GOTOF NOTVERIFIED"); }
  L.push("G18 G90 G95 G71 DIAMON ; ZX PLANE, ABSOLUTE, FEED PER REV, METRIC, DIAMETER");
  L.push("G40 G54");
  L.push("G74 X1=0 Z1=0 ; REFERENCE POINT");
  const done=()=>L.push(`G0 X${N(stock+50)} Z50 M9`);
  const tc=(t,label)=>{ L.push(""); L.push("; "+c(`T${t.tno} ${label||t.desc}`)); L.push("G74 X1=0 Z1=0"); L.push(`T${t.tno} D1`); };
  // contours are written after M30: CYCLE95 reads them by label
  const odC=[], boC=[];
  if(ext.length){
    odC.push("OD_START:"); odC.push(`G0 X${N(ext[0].target-2*C)}`); odC.push("G1 Z0 F0.1");
    ext.forEach((x,i)=>{
      if(i===0) odC.push(`X${N(x.target)} Z${N(-C)}`);
      else { odC.push(`X${N(x.target-2*C)}`); odC.push(`X${N(x.target)} Z=-R${extZ[i-1]}-${N(C)}`); }
      odC.push(`Z=-R${extZ[i]} ; ${c(`DIA ${N(x.nominal)} ${x.spec}`)}`);
    });
    odC.push(`X${N(stock+2)}`); odC.push("OD_END:");
  }
  const tr=H.findT(T,/rough/i), tf=H.findT(T,/finish turning|profil/i)||tr;
  if(tr){
    tc(tr,"FACE AND OD ROUGH");
    L.push(`G96 S${I((vc[0]+vc[1])/2)} LIMS=${I(maxS)} M3`); L.push(`G0 X${N(stock+2)} Z2 ${cool}`);
    L.push("; FACING - 1.5 MM STOCK ON FACE");
    [1.0,0.5,0].forEach(z=>{ L.push(`G0 X${N(stock+2)} Z${N(z+2)}`); L.push(`G1 Z${N(z)} F0.2`); L.push("G1 X-1.6"); });
    if(ext.length){
      L.push(`G0 X${N(stock+2)} Z2`);
      L.push("; CYCLE95(CONTOUR,MID,FALZ,FALX,FAL,FF1,FF2,FF3,VARI,DT,DAM) - VARI 1 = LONGITUDINAL OUTSIDE ROUGHING (CONFIRM FOR YOUR SOFTWARE)");
      L.push('CYCLE95("OD_START:OD_END",2,0.1,0.4,0.2,0.25,0.15,0.1,1,0,0)');
    }
    done();
  }
  if(tf&&ext.length){
    tc(tf,"OD FINISH");
    L.push(`G96 S${I(vc[1])} LIMS=${I(maxS)} M3`); L.push(`G0 X${N(stock+2)} Z2 ${cool}`);
    L.push("; VARI 5 = LONGITUDINAL OUTSIDE FINISHING (CONFIRM FOR YOUR SOFTWARE)");
    L.push(`CYCLE95("OD_START:OD_END",2,0.1,0.4,0.2,0.25,0.15,${fine?"0.08":"0.12"},5,0,0)`);
    done();
  }
  const td=H.findT(T,/u-drill|solid carbide \/ hss drill|^drill/i); let drillD=0;
  if(td&&(int.length||tInt.length)){
    drillD=+(String(td.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||10;
    tc(td,`DRILL DIA ${N(drillD)}`);
    L.push(`G97 S${I(H.rpm(vc[0]*0.45,drillD,maxS))} M3`); L.push(`G0 X0 Z5 ${cool}`);
    L.push(`R80=-R${intZ.length?intZ[intZ.length-1]:31}-${N(0.3*drillD+2)} ; DRILL DEPTH - CHECK`);
    L.push(`R81=-${N(Math.max(2,drillD*0.5))}`);
    L.push("G95 F0.12");
    L.push("CYCLE83(5,0,2,R80,0,R81,0,1,0,0,1,0) ; DEEP-HOLE DRILLING, CHIP BREAKING");
    done();
  }
  const tb=H.findT(T,/boring/i);
  if(tb&&int.length){
    const start=Math.max(drillD-1,1);
    boC.push("BORE_START:"); boC.push(`G0 X${N(int[0].target+2*C)}`); boC.push("G1 Z0 F0.08");
    int.forEach((x,i)=>{ if(i===0) boC.push(`X${N(x.target)} Z${N(-C)}`); else boC.push(`X${N(x.target)}`); boC.push(`Z=-R${intZ[i]} ; ${c(`BORE DIA ${N(x.nominal)} ${x.spec}`)}`); });
    boC.push(`X${N(start)}`); boC.push("BORE_END:");
    tc(tb,"BORE ROUGH AND FINISH");
    L.push(`G96 S${I(vc[0])} LIMS=${I(maxS)} M3`); L.push(`G0 X${N(start)} Z2 ${cool}`);
    L.push("; VARI 3 = LONGITUDINAL INSIDE ROUGHING, 7 = INSIDE FINISHING (CONFIRM FOR YOUR SOFTWARE)");
    L.push('CYCLE95("BORE_START:BORE_END",1,0.1,0.3,0.2,0.15,0.1,0.08,3,0,0)');
    L.push(`G96 S${I(vc[1])} LIMS=${I(maxS)}`);
    L.push(`CYCLE95("BORE_START:BORE_END",1,0.1,0.3,0.2,0.15,0.1,${fine?"0.06":"0.1"},7,0,0)`);
    L.push("G0 Z5"); done();
  }
  const tg=H.findT(T,/groov/i);
  if(tg){ tc(tg,"GROOVE"); L.push("; GROOVE NOT GENERATED: ADD CYCLE93 (OR MOVES) WITH POSITION AND DEPTH FROM THE DRAWING"); }
  const tt=H.findT(T,/external thread/i);
  if(tt) tExt.forEach((x,i)=>{
    const th=H.E.parseThread?H.E.parseThread(x.text):{}, d=th.d||x.nominal||10, p=th.p||1.5, hgt=0.6134*p;
    tc(tt,`THREAD ${th.name||x.text}`);
    L.push(`G97 S${I(H.rpm(vc[0]*0.5,d,maxS))} M3`); L.push(`G0 X${N(d+4)} Z${N(3*p)} ${cool}`);
    L.push(`R90=-R${thZ[i]}`);
    L.push(`CYCLE97(${N(p)},,0,R90,${N(d)},${N(d)},${N(2*p)},${N(p)},${N(hgt)},0.05,29,0,8,2,3,1) ; ${c(th.name||"")} - CONFIRM PARAMETERS`);
    done();
  });
  const tp=H.findT(T,/machine tap/i);
  if(tp) tInt.forEach((x,i)=>{
    const th=H.E.parseThread?H.E.parseThread(x.text):{}, d=th.d||x.nominal||8, p=th.p||1.25, sp=H.clamp(Math.round(1000*10/(Math.PI*d)),50,800);
    tc(tp,`TAP ${th.name||x.text}`);
    L.push(`G0 X0 Z5 ${cool}`); L.push(`R91=-R${tapZ[i]}`);
    L.push(`CYCLE84(5,0,2,R91,0,0,3,,${N(p)},0,${I(sp)},${I(sp)}) ; RIGID TAPPING - SPINDLE MUST BE POSITION-CONTROLLED`); done();
  });
  const tpo=H.findT(T,/parting/i);
  if(tpo){ L.push(`R71=${N(Lpart+3)} ; PART-OFF Z - PART LENGTH + BLADE WIDTH`); tc(tpo,"PART OFF"); L.push(`G97 S${I(H.rpm(vc[0]*0.5,maxOD,maxS))} M3`); L.push(`G0 X${N(stock+2)} Z=-R71 ${cool}`); L.push("G1 X-1 F0.05"); done(); }
  if(!T.length) L.push("; NO TOOLS IN THE PROCESS PLAN FOR THIS OPERATION - ADD TOOLS AND REGENERATE");
  L.push("");
  return siemensTail(o,L,H,["G74 X1=0 Z1=0","M5","M9"],[].concat(odC,boC));
}

function siemensMilling(o,H){
  const {plan,op,s,T,ch}=o, vc=o.vc, N=H.N, I=H.I, c=t=>txt(H,t), maxS=+s.cncMaxRpmMill||8000, cool=({M07:"M7",M88:"M8"})[s.cncCoolant]||"M8", wcs=s.cncWcs||"G54", safe=+s.cncSafeZ||50;
  const env=Math.max(20,+(plan.ctxInfo&&plan.ctxInfo.maxOD)||100), Lp=+(plan.ctxInfo&&plan.ctxInfo.length)||0;
  const holes=ch.filter(x=>x.type==="Diameter"&&x.internal&&x.nominal!=null), thr=ch.filter(x=>x.type==="Thread");
  const chamf=ch.find(x=>x.type==="Chamfer"&&x.nominal), C=chamf?Math.min(2,chamf.nominal):0.5;
  const L=sHead(o,H,"MPF");
  L.push(`; ---- WORK ZERO ${wcs}: X0 Y0 = PART CENTRE, Z0 = TOP FACE ----`);
  L.push(`R20=${N(env)} ; PART SIZE IN X`); L.push(`R21=${N(env)} ; PART SIZE IN Y`);
  let rn=101, dn=300; const feats=[];
  const addFeat=(x,kind)=>{ const pos=[]; for(let i=0;i<Math.min(x.count,12);i++){ pos.push([rn,rn+1]); L.push(`R${rn}=0 R${rn+1}=0 ; ${c(`${kind} ${i+1} X Y - BALLOON ${x.no}`)}`); rn+=2; }
    const d=x.type==="Thread"?((H.E.parseThread&&H.E.parseThread(x.text).d)||x.nominal||8):x.nominal, thru=/THRU/i.test(x.text), dId=dn++;
    L.push(`R${dId}=${N(thru&&Lp?Lp:d*2)} ; ${c("DEPTH OF "+kind+" - FROM DRAWING")}`); feats.push({c:x,kind,pos,dId,d}); };
  holes.forEach(x=>addFeat(x,"HOLE DIA "+N(x.nominal))); thr.forEach(x=>addFeat(x,"THREAD "+x.text));
  if(o.lock){ L.push("R1=0 ; SET R1=1 AFTER PROVE-OUT"); L.push("IF R1<>1 GOTOF NOTVERIFIED"); }
  L.push("G17 G40 G90 G94 G71 ; XY PLANE, ABSOLUTE, FEED PER MIN, METRIC"); L.push(wcs);
  let rr=400;
  const tc=(t,label,S)=>{ L.push(""); L.push("; "+c(`T${t.tno} ${label||t.desc}`)); L.push("G74 Z1=0"); L.push(`T${t.tno}`); L.push("M6"); L.push("D1"); L.push(`S${I(S)} M3`); L.push(`G0 Z${N(safe)} ${cool}`); };
  const up=()=>{ L.push("MCALL"); L.push(`G0 Z${N(safe)} M9`); };
  const run=(f,call)=>{ L.push(`G0 X=R${f.pos[0][0]} Y=R${f.pos[0][1]}`); L.push("G0 Z5"); L.push("MCALL "+call); f.pos.forEach(p=>L.push(`X=R${p[0]} Y=R${p[1]}`)); L.push("MCALL"); };
  const dep=(f,extra)=>{ const r=rr++; L.push(`R${r}=-R${f.dId}${extra?"-"+N(extra):""}`); return r; };
  const tfm=H.findT(T,/face mill/i);
  if(tfm){ const d=+(String(tfm.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||63, step=Math.round(d*0.7);
    tc(tfm,`FACE MILL DIA ${d}`,H.rpm((vc[0]+vc[1])/2,d,maxS));
    [0.3,0].forEach(z=>{ L.push("R30=-R21/2+"+N(d*0.3)); L.push("WHILE R30<=R21/2+10"); L.push(`G0 X=-R20/2-${N(d/2+10)} Y=R30`); L.push(`G1 Z${N(z)} F500`); L.push(`G1 X=R20/2+${N(d/2+10)} F500`); L.push("G0 Z5"); L.push(`R30=R30+${step}`); L.push("ENDWHILE"); });
    L.push(`G0 Z${N(safe)} M9`); }
  const tem=H.findT(T,/end mill/i);
  if(tem){ L.push(""); L.push("; "+c(`T${tem.tno} END MILL - PROFILE / POCKET / SLOT`)); L.push("; CONTOUR NOT GENERATED: ADD THE TOOL PATH FROM CAM OR THE DRAWING HERE"); }
  const tsp=H.findT(T,/spot|centre drill/i), small=feats.filter(f=>f.d<=16);
  if(tsp&&small.length){ tc(tsp,"SPOT DRILL",H.rpm(vc[0]*0.4,10,maxS)); L.push("F150");
    small.forEach(f=>{ L.push(`R${rr}=-${N(Math.min(5,f.d/2+C))}`); run(f,`CYCLE81(5,0,2,R${rr})`); rr++; }); L.push(`G0 Z${N(safe)} M9`); }
  holes.forEach(x=>{ const f=feats.find(y=>y.c===x), d=x.nominal, fit=/H\d|G\d/i.test(x.text);
    const dr=T.find(t=>/drill/i.test(t.desc)&&!/tap|spot|centre/i.test(t.desc)&&Math.abs((+(String(t.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||0)-(d>25?0:(fit&&d<=25?d-0.2:d)))<0.25);
    if(dr){ const dd=+(String(dr.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]; const sp=H.rpm(vc[0]*0.45,dd,maxS); tc(dr,`DRILL DIA ${N(dd)}`,sp);
      L.push(`F${I(sp*0.02*dd/2)}`); const r=dep(f,0.3*dd), q=rr++; L.push(`R${q}=-${N(Math.max(1,dd*0.8))}`);
      run(f,`CYCLE83(5,0,2,R${r},0,R${q},0,0,0,0,1,0)`); up(); }
    const rm=T.find(t=>/reamer/i.test(t.desc)&&String(t.spec).includes(N(d).replace(/\.$/,"")));
    if(rm){ const sp=H.rpm(12,d,maxS); tc(rm,`REAM DIA ${N(d)}`,sp); L.push(`F${I(sp*0.25)}`); const r=dep(f); run(f,`CYCLE85(5,0,2,R${r},0,0,${I(sp*0.25)},${I(sp*0.5)}) ; ${c(x.spec)}`); up(); }
    const bh=T.find(t=>/boring head/i.test(t.desc)&&String(t.spec).includes(N(d).replace(/\.$/,"")));
    if(bh){ const sp=H.rpm(vc[0]*0.6,d,maxS); tc(bh,`FINISH BORE DIA ${N(d)}`,sp); L.push("; ROUGH THE BORE FIRST - HELICAL WITH END MILL OR STEP DRILL"); const r=dep(f); run(f,`CYCLE85(5,0,2,R${r},0,0,${I(sp*0.05)},${I(sp*0.5)}) ; ${c(x.spec)}`); up(); }
  });
  thr.forEach(x=>{ const f=feats.find(y=>y.c===x), th=H.E.parseThread?H.E.parseThread(x.text):{}, td=H.E.tapDrill?H.E.tapDrill(th):null, p=th.p||1.25;
    const dr=td&&T.find(t=>/tap drill/i.test(t.desc)&&String(t.spec).includes(N(td).replace(/\.$/,"")));
    if(dr){ const sp=H.rpm(vc[0]*0.45,td,maxS); tc(dr,`TAP DRILL DIA ${N(td)}`,sp); L.push(`F${I(sp*0.02*td/2)}`); const r=dep(f,0.3*td+2*p), q=rr++; L.push(`R${q}=-${N(Math.max(1,td*0.8))}`); run(f,`CYCLE83(5,0,2,R${r},0,R${q},0,0,0,0,1,0)`); up(); }
    const tp=T.find(t=>/machine tap|thread mill/i.test(t.desc)&&(t.remarks===th.name||String(t.spec).includes(th.name||"~")));
    if(tp&&/thread mill/i.test(tp.desc)){ L.push(""); L.push("; "+c(`T${tp.tno} THREAD MILL ${th.name||""} - ADD HELICAL PATH FROM CAM`)); }
    else if(tp){ const sp=H.clamp(Math.round(1000*10/(Math.PI*(th.d||8))),50,1500); tc(tp,`TAP ${th.name||x.text}`,sp); const r=dep(f); run(f,`CYCLE84(5,0,2,R${r},0,0,3,,${N(p)},0,${I(sp)},${I(sp)}) ; ${c(th.name||"")} RIGID TAPPING`); up(); }
  });
  const tch=H.findT(T,/chamfer mill/i), chD=+(String(tch&&tch.spec||"").match(/(\d+(?:\.\d+)?)/)||[])[1]||12;
  const reach=feats.filter(f=>f.d/2+C<=chD/2-0.5), big=feats.filter(f=>!reach.includes(f));
  if(tch&&reach.length){ tc(tch,`CHAMFER ${N(C)} X 45 DEG`,H.rpm(vc[0]*0.5,chD,maxS)); L.push("F150"); reach.forEach(f=>{ L.push(`R${rr}=-${N(f.d/2+C)}`); run(f,`CYCLE81(5,0,2,R${rr}) ; ${c("CHAMFER "+f.kind)}`); rr++; }); L.push(`G0 Z${N(safe)} M9`); }
  if(tch&&big.length) big.forEach(f=>L.push("; "+c(`CHAMFER ${f.kind}: TOO LARGE FOR CHAMFER MILL - USE CIRCULAR INTERPOLATION / CAM`)));
  if(!T.length) L.push("; NO TOOLS IN THE PROCESS PLAN FOR THIS OPERATION - ADD TOOLS AND REGENERATE");
  L.push("");
  return siemensTail(o,L,H,["G74 Z1=0","G74 Y1=0","M5","M9"]);
}

/* ======================================================================
   HEIDENHAIN TNC (plain-language / Klartext) - milling controls
   ====================================================================== */
function heidenhain(o,H){
  const {plan,op,s,T,ch}=o, vc=o.vc, N=H.N, I=H.I, c=t=>txt(H,t), maxS=+s.cncMaxRpmMill||8000, safe=+s.cncSafeZ||50;
  const name="P"+String(o.progNo).padStart(4,"0");
  const out=[]; const add=t=>out.push(t);
  const noteTop=sHead(o,H,"H").map(x=>x);   // comments, numbered below
  if(/^TURN/.test(op.key)){
    add(`BEGIN PGM ${name} MM`); noteTop.forEach(x=>add(x));
    add("; HEIDENHAIN TNC IS A MILLING CONTROL - NO TURNING PROGRAM IS GENERATED FOR THIS OPERATION");
    add("; SELECT A LATHE CONTROL (FANUC, SIEMENS, MITSUBISHI ...) FOR THIS MACHINE IN OPERATIONS MASTER");
    add("M30"); add(`END PGM ${name} MM`);
    return out.map((t,i)=>`${i} ${t}`).join("\n");
  }
  const env=Math.max(20,+(plan.ctxInfo&&plan.ctxInfo.maxOD)||100), Lp=+(plan.ctxInfo&&plan.ctxInfo.length)||0;
  const holes=ch.filter(x=>x.type==="Diameter"&&x.internal&&x.nominal!=null), thr=ch.filter(x=>x.type==="Thread");
  const chamf=ch.find(x=>x.type==="Chamfer"&&x.nominal), C=chamf?Math.min(2,chamf.nominal):0.5;
  add(`BEGIN PGM ${name} MM`); noteTop.forEach(x=>add(x));
  add(`BLK FORM 0.1 Z X${N(-env/2)} Y${N(-env/2)} Z-${N(Lp||env)}`); add(`BLK FORM 0.2 X${N(env/2)} Y${N(env/2)} Z+0`);
  add("; ---- DATUM: X0 Y0 = PART CENTRE, Z0 = TOP FACE (SET WITH THE PRESET TABLE) ----");
  let qn=101, dn=300; const feats=[];
  const addFeat=(x,kind)=>{ const pos=[]; for(let i=0;i<Math.min(x.count,12);i++){ pos.push([qn,qn+1]); add(`FN 0: Q${qn} = +0`); add(`FN 0: Q${qn+1} = +0 ; ${c(`${kind} ${i+1} X Y - BALLOON ${x.no}`)}`); qn+=2; }
    const d=x.type==="Thread"?((H.E.parseThread&&H.E.parseThread(x.text).d)||x.nominal||8):x.nominal, thru=/THRU/i.test(x.text), dId=dn++;
    add(`FN 0: Q${dId} = +${N(thru&&Lp?Lp:d*2)} ; ${c("DEPTH OF "+kind+" - FROM DRAWING")}`); feats.push({c:x,kind,pos,dId,d}); };
  holes.forEach(x=>addFeat(x,"HOLE DIA "+N(x.nominal))); thr.forEach(x=>addFeat(x,"THREAD "+x.text));
  if(o.lock){ add("FN 0: Q1 = +0 ; SET Q1 = 1 AFTER PROVE-OUT"); add("FN 9: IF +Q1 NE +1 GOTO LBL 99"); }
  const tc=(t,label,S)=>{ add(""); add("; "+c(`T${t.tno} ${label||t.desc}`)); add(`TOOL CALL ${t.tno} Z S${I(S)}`); add(`L Z+${N(safe)} R0 FMAX M3`); };
  const cyc=(f,def,extra)=>{ add(def); f.pos.forEach((p,i)=>add(`L X+Q${p[0]} Y+Q${p[1]} R0 FMAX M99`)); add(`L Z+${N(safe)} R0 FMAX`); };
  let dq=0;
  const depth=(f,ex)=>{ const q=400+dq++; add(`FN 0: Q${q} = -Q${f.dId}${ex?" - "+N(ex):""}`); return "Q"+q; };
  const tfm=H.findT(T,/face mill/i); if(tfm){ tc(tfm,`FACE MILL DIA ${tfm.spec}`,H.rpm((vc[0]+vc[1])/2,63,maxS)); add("; FACE MILLING NOT GENERATED: ADD CYCL DEF 232 FACE MILLING (OR CAM PATH) WITH THE STOCK FROM THE DRAWING"); }
  const tem=H.findT(T,/end mill/i); if(tem){ add(""); add("; "+c(`T${tem.tno} END MILL - PROFILE / POCKET / SLOT`)); add("; CONTOUR NOT GENERATED: ADD THE TOOL PATH FROM CAM OR THE DRAWING HERE"); }
  const tsp=H.findT(T,/spot|centre drill/i), small=feats.filter(f=>f.d<=16);
  if(tsp&&small.length){ tc(tsp,"SPOT DRILL",H.rpm(vc[0]*0.4,10,maxS));
    small.forEach(f=>{ cyc(f,`CYCL DEF 200 DRILLING ~\n  Q200=+2 ;SET-UP CLEARANCE ~\n  Q201=-${N(Math.min(5,f.d/2+C))} ;DEPTH ~\n  Q206=+150 ;FEED RATE FOR PLUNGING ~\n  Q202=+5 ;PLUNGING DEPTH ~\n  Q210=+0 ;DWELL TIME AT TOP ~\n  Q203=+0 ;SURFACE COORDINATE ~\n  Q204=+50 ;2ND SET-UP CLEARANCE ~\n  Q211=+0 ;DWELL TIME AT BOTTOM`); }); }
  holes.forEach(x=>{ const f=feats.find(y=>y.c===x), d=x.nominal, fit=/H\d|G\d/i.test(x.text);
    const dr=T.find(t=>/drill/i.test(t.desc)&&!/tap|spot|centre/i.test(t.desc)&&Math.abs((+(String(t.spec).match(/(\d+(?:\.\d+)?)/)||[])[1]||0)-(d>25?0:(fit&&d<=25?d-0.2:d)))<0.25);
    if(dr){ const dd=+(String(dr.spec).match(/(\d+(?:\.\d+)?)/)||[])[1], sp=H.rpm(vc[0]*0.45,dd,maxS); tc(dr,`DRILL DIA ${N(dd)}`,sp); const q=depth(f,0.3*dd);
      cyc(f,`CYCL DEF 200 DRILLING ~\n  Q200=+2 ;SET-UP CLEARANCE ~\n  Q201=+${q} ;DEPTH ~\n  Q206=+${I(sp*0.02*dd/2)} ;FEED RATE FOR PLUNGING ~\n  Q202=+${N(Math.max(1,dd*0.8))} ;PLUNGING DEPTH ~\n  Q210=+0 ;DWELL TIME AT TOP ~\n  Q203=+0 ;SURFACE COORDINATE ~\n  Q204=+50 ;2ND SET-UP CLEARANCE ~\n  Q211=+0 ;DWELL TIME AT BOTTOM`); }
    const rm=T.find(t=>/reamer/i.test(t.desc)&&String(t.spec).includes(N(d).replace(/\.$/,"")));
    if(rm){ const sp=H.rpm(12,d,maxS); tc(rm,`REAM DIA ${N(d)}`,sp); const q=depth(f);
      cyc(f,`CYCL DEF 201 REAMING ~\n  Q200=+2 ;SET-UP CLEARANCE ~\n  Q201=+${q} ;DEPTH ~\n  Q206=+${I(sp*0.25)} ;FEED RATE FOR PLUNGING ~\n  Q211=+0 ;DWELL TIME AT DEPTH ~\n  Q208=+${I(sp*0.5)} ;RETRACTION FEED RATE ~\n  Q203=+0 ;SURFACE COORDINATE ~\n  Q204=+50 ;2ND SET-UP CLEARANCE`); }
  });
  thr.forEach(x=>{ const f=feats.find(y=>y.c===x), th=H.E.parseThread?H.E.parseThread(x.text):{}, td=H.E.tapDrill?H.E.tapDrill(th):null, p=th.p||1.25;
    const dr=td&&T.find(t=>/tap drill/i.test(t.desc)&&String(t.spec).includes(N(td).replace(/\.$/,"")));
    if(dr){ const sp=H.rpm(vc[0]*0.45,td,maxS); tc(dr,`TAP DRILL DIA ${N(td)}`,sp); const q=depth(f,0.3*td+2*p);
      cyc(f,`CYCL DEF 200 DRILLING ~\n  Q200=+2 ;SET-UP CLEARANCE ~\n  Q201=+${q} ;DEPTH ~\n  Q206=+${I(sp*0.02*td/2)} ;FEED RATE FOR PLUNGING ~\n  Q202=+${N(Math.max(1,td*0.8))} ;PLUNGING DEPTH ~\n  Q210=+0 ;DWELL TIME AT TOP ~\n  Q203=+0 ;SURFACE COORDINATE ~\n  Q204=+50 ;2ND SET-UP CLEARANCE ~\n  Q211=+0 ;DWELL TIME AT BOTTOM`); }
    const tp=T.find(t=>/machine tap|thread mill/i.test(t.desc)&&(t.remarks===th.name||String(t.spec).includes(th.name||"~")));
    if(tp&&/thread mill/i.test(tp.desc)){ add(""); add("; "+c(`T${tp.tno} THREAD MILL ${th.name||""} - ADD CYCL DEF 262 / CAM PATH`)); }
    else if(tp){ const sp=H.clamp(Math.round(1000*10/(Math.PI*(th.d||8))),50,1500); tc(tp,`TAP ${th.name||x.text}`,sp); const q=depth(f);
      cyc(f,`CYCL DEF 207 RIGID TAPPING ~\n  Q200=+2 ;SET-UP CLEARANCE ~\n  Q201=+${q} ;THREAD DEPTH ~\n  Q239=+${N(p)} ;PITCH ~\n  Q203=+0 ;SURFACE COORDINATE ~\n  Q204=+50 ;2ND SET-UP CLEARANCE`); }
  });
  const tch=H.findT(T,/chamfer mill/i), chD=+(String(tch&&tch.spec||"").match(/(\d+(?:\.\d+)?)/)||[])[1]||12;
  const reach=feats.filter(f=>f.d/2+C<=chD/2-0.5);
  if(tch&&reach.length){ tc(tch,`CHAMFER ${N(C)} X 45 DEG`,H.rpm(vc[0]*0.5,chD,maxS));
    reach.forEach(f=>cyc(f,`CYCL DEF 200 DRILLING ~\n  Q200=+2 ;SET-UP CLEARANCE ~\n  Q201=-${N(f.d/2+C)} ;DEPTH ~\n  Q206=+150 ;FEED RATE FOR PLUNGING ~\n  Q202=+5 ;PLUNGING DEPTH ~\n  Q210=+0 ;DWELL TIME AT TOP ~\n  Q203=+0 ;SURFACE COORDINATE ~\n  Q204=+50 ;2ND SET-UP CLEARANCE ~\n  Q211=+0 ;DWELL TIME AT BOTTOM`)); }
  if(!T.length) add("; NO TOOLS IN THE PROCESS PLAN FOR THIS OPERATION - ADD TOOLS AND REGENERATE");
  add(`L Z+${N(safe)} R0 FMAX M5 M9`); add("M30");
  if(o.lock){ add("LBL 99"); add("FN 14: ERROR = 1000 ; PROGRAM NOT VERIFIED - SET Q1 = 1"); add("M30"); }
  add(`END PGM ${name} MM`);
  // the control numbers every line; multi-line cycle definitions stay one block (lines joined with ~)
  const lines=[]; out.forEach(t=>t.split("\n").forEach(x=>lines.push(x)));
  let n=0; return lines.map(x=>{ if(/^\s+Q\d+=/.test(x)||/^\s*$/.test(x)&&false) return x; return (n++)+" "+x; }).join("\n");
}
window.PDCNCExt.siemens={turning:siemensTurning,milling:siemensMilling};
window.PDCNCExt.heidenhain={turning:heidenhain,milling:heidenhain};
})();
