/* Charts as drawing primitives → SVG (screen), jsPDF (PDF) and canvas PNG (Excel). */
(function(){
"use strict";
const COL = {data:"#1D5FD0", lim:"#C8102E", cl:"#15233B", spec:"#A8690F", grid:"#DCE2EA", txt:"#15233B", mut:"#5B6778", bar:"#9DB8EA", curve:"#15233B", ooc:"#C8102E"};
const f = (v,d=4) => v==null||!isFinite(v) ? "—" : String(Math.round(v*10**d)/10**d);

function niceRange(lo, hi){ if(lo===hi){ lo-=1; hi+=1; } const pad=(hi-lo)*0.12; return [lo-pad, hi+pad]; }
function panel(P, box, series, lines, title, opts={}){
  const {x,y,w,h} = box, L=x+58, R=x+w-78, T=y+26, B=y+h-26;
  P.push({t:"rect",x,y,w,h,fill:"#FFFFFF",stroke:"#C5CDD7"});
  P.push({t:"text",x:x+10,y:y+17,s:title,size:13,bold:true,color:COL.txt});
  const vals = series.filter(v=>v!=null).concat(lines.map(l=>l.v).filter(v=>v!=null&&isFinite(v)));
  if(!vals.length) { P.push({t:"text",x:x+w/2,y:y+h/2,s:"No data yet",size:13,color:COL.mut,align:"center"}); return; }
  const [lo,hi] = niceRange(Math.min(...vals), Math.max(...vals));
  const Y = v => B-(v-lo)/(hi-lo)*(B-T), n=series.length, X = i => n<=1 ? (L+R)/2 : L+i*(R-L)/(n-1);
  for(let g=0; g<=4; g++){ const v=lo+(hi-lo)*g/4, yy=Y(v); P.push({t:"line",x1:L,y1:yy,x2:R,y2:yy,color:COL.grid,width:0.6}); P.push({t:"text",x:L-6,y:yy+4,s:f(v,4),size:9.5,color:COL.mut,align:"right"}); }
  P.push({t:"line",x1:L,y1:T,x2:L,y2:B,color:COL.mut,width:0.8}); P.push({t:"line",x1:L,y1:B,x2:R,y2:B,color:COL.mut,width:0.8});
  const step = n>30 ? Math.ceil(n/15) : n>15 ? 2 : 1;
  for(let i=0;i<n;i+=step) P.push({t:"text",x:X(i),y:B+13,s:String(i+1),size:9,color:COL.mut,align:"center"});
  lines.forEach(l=>{ if(l.v==null||!isFinite(l.v)) return; const yy=Y(l.v); P.push({t:"line",x1:L,y1:yy,x2:R,y2:yy,color:l.color,width:l.width||1.1,dash:l.dash}); P.push({t:"text",x:R+5,y:yy+4,s:`${l.name} ${f(l.v,4)}`,size:9.5,color:l.color,bold:true}); });
  const pts = series.map((v,i)=>v==null?null:[X(i),Y(v)]).filter(Boolean);
  if(pts.length>1) P.push({t:"poly",pts,color:COL.data,width:1.4});
  series.forEach((v,i)=>{ if(v==null) return; const bad = opts.ooc && opts.ooc.includes(i+1); P.push({t:"dot",x:X(i),y:Y(v),r:bad?3.8:2.8,color:bad?COL.ooc:COL.data}); });
}
function xbarR(stats, st, W=1000){
  const P=[], h=250; if(!stats||!stats.ok){ panel(P,{x:0,y:0,w:W,h},[],[],"X̄ chart"); return {w:W,h,prims:P}; }
  panel(P,{x:0,y:0,w:W,h}, stats.xb, [{name:"UCL",v:stats.uclx,color:COL.lim,dash:true},{name:"X̿",v:stats.X,color:COL.cl},{name:"LCL",v:stats.lclx,color:COL.lim,dash:true}], `X̄ chart – subgroup averages (n = ${stats.n})`, {ooc:stats.oocX});
  panel(P,{x:0,y:h+12,w:W,h:210}, stats.R, [{name:"UCL",v:stats.uclr,color:COL.lim,dash:true},{name:"R̄",v:stats.Rb,color:COL.cl},{name:"LCL",v:stats.lclr,color:COL.lim,dash:true}], "R chart – subgroup ranges", {ooc:stats.oocR});
  return {w:W,h:h+12+210,prims:P};
}
function run(stats, st, W=1000){
  const P=[], h=260; const all = stats&&stats.ok ? stats.all : [];
  panel(P,{x:0,y:0,w:W,h}, all, [{name:"USL",v:st.usl,color:COL.spec,width:1.4},{name:"Mean",v:stats&&stats.ok?stats.mean:null,color:COL.cl},{name:"LSL",v:st.lsl,color:COL.spec,width:1.4}], "Run chart – individual readings in production order");
  return {w:W,h,prims:P};
}
function hist(stats, st, W=1000){
  const P=[], h=270, x=0, y=0, L=58, R=W-30, T=42, B=h-30;
  P.push({t:"rect",x,y,w:W,h,fill:"#FFFFFF",stroke:"#C5CDD7"}); P.push({t:"text",x:10,y:17,s:"Histogram with normal curve and specification limits",size:13,bold:true,color:COL.txt});
  if(!stats||!stats.ok){ P.push({t:"text",x:W/2,y:h/2,s:"No data yet",size:13,color:COL.mut,align:"center"}); return {w:W,h,prims:P}; }
  const lo0=Math.min(stats.min, st.lsl??stats.min), hi0=Math.max(stats.max, st.usl??stats.max); const [lo,hi]=niceRange(lo0,hi0);
  const bins = Math.max(6, Math.min(16, Math.round(Math.sqrt(stats.N)))), bw=(stats.max-stats.min||1e-9)/bins;
  const counts=Array(bins).fill(0); stats.all.forEach(v=>{ let i=Math.floor((v-stats.min)/bw); if(i>=bins) i=bins-1; counts[i]++; });
  const X = v => L+(v-lo)/(hi-lo)*(R-L), maxC=Math.max(...counts);
  const pdfMax = 1/(stats.s*Math.sqrt(2*Math.PI))*stats.N*bw; const top=Math.max(maxC,pdfMax)*1.15, Y=c=>B-c/top*(B-T);
  counts.forEach((c,i)=>{ const a=X(stats.min+i*bw), b=X(stats.min+(i+1)*bw); P.push({t:"rect",x:a,y:Y(c),w:Math.max(1,b-a-1),h:B-Y(c),fill:COL.bar,stroke:"#7C9CD6"}); });
  const pts=[]; for(let k=0;k<=80;k++){ const v=lo+(hi-lo)*k/80; const pv=Math.exp(-0.5*((v-stats.mean)/stats.s)**2)/(stats.s*Math.sqrt(2*Math.PI))*stats.N*bw; pts.push([X(v),Y(pv)]); }
  P.push({t:"poly",pts,color:COL.curve,width:1.4});
  P.push({t:"line",x1:L,y1:B,x2:R,y2:B,color:COL.mut,width:0.8});
  for(let g=0; g<=5; g++){ const v=lo+(hi-lo)*g/5; P.push({t:"text",x:X(v),y:B+14,s:f(v,4),size:9.5,color:COL.mut,align:"center"}); }
  [["LSL",st.lsl],["USL",st.usl]].forEach(([n,v])=>{ if(v==null) return; P.push({t:"line",x1:X(v),y1:T-4,x2:X(v),y2:B,color:COL.lim,width:1.5,dash:true}); P.push({t:"text",x:X(v),y:T-8,s:`${n} ${f(v,4)}`,size:10,color:COL.lim,bold:true,align:"center"}); });
  P.push({t:"line",x1:X(stats.mean),y1:T,x2:X(stats.mean),y2:B,color:COL.cl,width:1});
  return {w:W,h,prims:P};
}
function msaChart(ms, st, W=1000){
  const P=[], h=240; if(!ms||!ms.ok){ panel(P,{x:0,y:0,w:W,h},[],[],"Appraiser averages"); return {w:W,h,prims:P}; }
  // part averages per appraiser (lines)
  const x=0,y=0,L=58,R=W-110,T=28,B=h-26; P.push({t:"rect",x,y,w:W,h,fill:"#FFFFFF",stroke:"#C5CDD7"}); P.push({t:"text",x:10,y:17,s:"Part averages by appraiser",size:13,bold:true,color:COL.txt});
  const cols=["#1D5FD0","#C8102E","#1E7B4A"]; const p=st.parts, lines=st.appraisers.map((_,a)=>Array.from({length:p},(_,i)=>{ let s=0; for(let t=0;t<st.trials;t++) s+=+st.data[a][t][i]; return s/st.trials; }));
  const all=lines.flat(); const [lo,hi]=niceRange(Math.min(...all),Math.max(...all)); const Y=v=>B-(v-lo)/(hi-lo)*(B-T), X=i=>L+i*(R-L)/(p-1);
  for(let g=0; g<=4; g++){ const v=lo+(hi-lo)*g/4; P.push({t:"line",x1:L,y1:Y(v),x2:R,y2:Y(v),color:COL.grid,width:0.6}); P.push({t:"text",x:L-6,y:Y(v)+4,s:f(v,4),size:9.5,color:COL.mut,align:"right"}); }
  for(let i=0;i<p;i++) P.push({t:"text",x:X(i),y:B+13,s:"P"+(i+1),size:9,color:COL.mut,align:"center"});
  lines.forEach((ln,a)=>{ P.push({t:"poly",pts:ln.map((v,i)=>[X(i),Y(v)]),color:cols[a%3],width:1.4}); ln.forEach((v,i)=>P.push({t:"dot",x:X(i),y:Y(v),r:2.6,color:cols[a%3]})); P.push({t:"text",x:R+10,y:T+14+a*16,s:st.appraisers[a],size:10.5,color:cols[a%3],bold:true}); });
  return {w:W,h,prims:P};
}
function stack(models, gap=12){ const W=Math.max(...models.map(m=>m.w)); let y=0; const P=[]; models.forEach(m=>{ m.prims.forEach(p=>P.push(shift(p,0,y))); y+=m.h+gap; }); return {w:W,h:y-gap,prims:P}; }
function shift(p,dx,dy){ const q=Object.assign({},p); if("x" in q) q.x+=dx; if("y" in q) q.y+=dy; if("x1" in q){ q.x1+=dx; q.x2+=dx; q.y1+=dy; q.y2+=dy; } if(q.pts) q.pts=q.pts.map(a=>[a[0]+dx,a[1]+dy]); return q; }

const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function toSVG(m, label){
  const out=[`<svg class="chart" viewBox="0 0 ${m.w} ${m.h}" role="img" aria-label="${esc(label||"Chart")}" xmlns="http://www.w3.org/2000/svg" font-family="Barlow, Arial, sans-serif">`];
  m.prims.forEach(p=>{
    if(p.t==="rect") out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill||"none"}" stroke="${p.stroke||"none"}"/>`);
    else if(p.t==="line") out.push(`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.color}" stroke-width="${p.width||1}"${p.dash?' stroke-dasharray="6 4"':""}/>`);
    else if(p.t==="poly") out.push(`<polyline fill="none" stroke="${p.color}" stroke-width="${p.width||1}" stroke-linejoin="round" points="${p.pts.map(a=>a[0].toFixed(1)+","+a[1].toFixed(1)).join(" ")}"/>`);
    else if(p.t==="dot") out.push(`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.color}"/>`);
    else if(p.t==="text") out.push(`<text x="${p.x}" y="${p.y}" font-size="${p.size}" fill="${p.color}" text-anchor="${p.align==="right"?"end":p.align==="center"?"middle":"start"}"${p.bold?' font-weight="700"':""}>${esc(p.s)}</text>`);
  });
  out.push("</svg>"); return out.join("");
}
function hex(c){ const n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function pdfSafe(s){ return String(s).replace(/X̄/g,"Xbar").replace(/X̿/g,"Xdbar").replace(/R̄/g,"Rbar").replace(/[^\x20-\x7E -ÿ]/g,""); }
function toPDF(doc, m, x0, y0, wmm){
  const k = wmm/m.w; const X=v=>x0+v*k, Y=v=>y0+v*k;
  m.prims.forEach(p=>{
    if(p.t==="rect"){ if(p.fill) doc.setFillColor(...hex(p.fill)); if(p.stroke) doc.setDrawColor(...hex(p.stroke)); doc.setLineWidth(0.2); doc.rect(X(p.x),Y(p.y),p.w*k,p.h*k,p.fill&&p.stroke?"FD":p.fill?"F":"S"); }
    else if(p.t==="line"){ doc.setDrawColor(...hex(p.color)); doc.setLineWidth((p.width||1)*k*0.9); if(p.dash) doc.setLineDashPattern([1.6,1.1],0); doc.line(X(p.x1),Y(p.y1),X(p.x2),Y(p.y2)); if(p.dash) doc.setLineDashPattern([],0); }
    else if(p.t==="poly"){ doc.setDrawColor(...hex(p.color)); doc.setLineWidth((p.width||1)*k*0.9); for(let i=1;i<p.pts.length;i++) doc.line(X(p.pts[i-1][0]),Y(p.pts[i-1][1]),X(p.pts[i][0]),Y(p.pts[i][1])); }
    else if(p.t==="dot"){ doc.setFillColor(...hex(p.color)); doc.circle(X(p.x),Y(p.y),Math.max(0.45,p.r*k),"F"); }
    else if(p.t==="text"){ doc.setTextColor(...hex(p.color)); doc.setFont("helvetica",p.bold?"bold":"normal"); doc.setFontSize(Math.max(5.5,p.size*k*2.83*0.95)); doc.text(pdfSafe(p.s),X(p.x),Y(p.y),{align:p.align||"left"}); }
  });
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  return m.h*k;
}
function toPNG(m, scale=2){
  const c=document.createElement("canvas"); c.width=m.w*scale; c.height=m.h*scale; const g=c.getContext("2d"); g.scale(scale,scale); g.fillStyle="#fff"; g.fillRect(0,0,m.w,m.h);
  m.prims.forEach(p=>{
    if(p.t==="rect"){ if(p.fill){ g.fillStyle=p.fill; g.fillRect(p.x,p.y,p.w,p.h); } if(p.stroke){ g.strokeStyle=p.stroke; g.lineWidth=1; g.strokeRect(p.x,p.y,p.w,p.h); } }
    else if(p.t==="line"){ g.strokeStyle=p.color; g.lineWidth=p.width||1; g.setLineDash(p.dash?[6,4]:[]); g.beginPath(); g.moveTo(p.x1,p.y1); g.lineTo(p.x2,p.y2); g.stroke(); g.setLineDash([]); }
    else if(p.t==="poly"){ g.strokeStyle=p.color; g.lineWidth=p.width||1; g.beginPath(); p.pts.forEach((a,i)=>i?g.lineTo(a[0],a[1]):g.moveTo(a[0],a[1])); g.stroke(); }
    else if(p.t==="dot"){ g.fillStyle=p.color; g.beginPath(); g.arc(p.x,p.y,p.r,0,Math.PI*2); g.fill(); }
    else if(p.t==="text"){ g.fillStyle=p.color; g.font=`${p.bold?"700 ":""}${p.size}px Barlow, Arial, sans-serif`; g.textAlign=p.align==="right"?"right":p.align==="center"?"center":"left"; g.fillText(p.s,p.x,p.y); }
  });
  return c.toDataURL("image/png");
}
window.PDCharts = {xbarR, run, hist, msaChart, stack, toSVG, toPDF, toPNG, pdfSafe};
})();
