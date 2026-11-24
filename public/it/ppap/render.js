/* Writes the same sheet list to Excel (ExcelJS) or PDF (jsPDF + autoTable). */
(function(){
const EXCELJS="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js", JSPDF="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", AUTO="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
const load=src=>new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Could not load a download library. Check the internet connection."));document.head.appendChild(s);});
const SYM={O:"○",I:"◇",S:"▽",T:"⇨"};
const cellText=v=>v&&typeof v==="object"?(SYM[v.sym]||""):(v==null?"":String(v));
const pdfSafe=s=>String(s==null?"":s).replace(/[–—−]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,"...").replace(/≤/g,"<=").replace(/≥/g,">=").replace(/[^\n\x20-\x7E -ÿ]/g,"");
const sheetName=(n,used)=>{ let b=String(n).replace(/[\\\/\?\*\[\]:]/g,"-").slice(0,31)||"Sheet", x=b, i=2; while(used.has(x.toLowerCase())) x=b.slice(0,28)+"("+(i++)+")"; used.add(x.toLowerCase()); return x; };
const colsOf=sh=>Math.max(8,...sh.tables.map(t=>t.head.length));
const px=d=>new Promise(res=>{ if(!d) return res(null); const im=new Image(); im.onload=()=>res({src:d,r:im.width/im.height}); im.onerror=()=>res(null); im.src=d; });
const fileBase=(D,ctx)=>"PPAP_"+((D.header.partNo||"part")+"_"+ctx.format.id).replace(/[^\w.-]+/g,"_");

async function xlsx(sheets,D,ctx){
  if(!window.ExcelJS) await load(EXCELJS);
  const wb=new ExcelJS.Workbook(); wb.creator=ctx.company||"KMR PPAP"; wb.created=new Date();
  const logo=await px(ctx.logo), lid=logo?wb.addImage({base64:logo.src,extension:/jpe?g/.test(logo.src.slice(0,20))?"jpeg":"png"}):null, used=new Set();
  const thin={style:"thin",color:{argb:"FF8E9AAD"}}, bd={top:thin,left:thin,bottom:thin,right:thin}, med={style:"medium",color:{argb:"FF15233B"}};
  for(const sh of sheets){ const N=colsOf(sh), land=sh.orient==="l", wide=N>14;
    const ws=wb.addWorksheet(sheetName(sh.name,used),{pageSetup:{orientation:land?"landscape":"portrait",paperSize:wide?8:9,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.3,right:.3,top:.4,bottom:.6,header:.2,footer:.25}},views:[{showGridLines:false}]});
    ws.headerFooter.oddFooter=`&L${ctx.refNo} · ${ctx.format.code||"F-PPAP"} Rev ${ctx.format.rev||"00"}&CPrinted &D&RPage &P of &N`;
    const W=Array(N).fill(7); sh.tables.forEach(t=>t.head.forEach((_,i)=>{ W[i]=Math.max(W[i],Math.min(60,t.w&&t.w[i]||12)); })); if(!sh.tables.length) W.fill(14);
    W.forEach((w,i)=>ws.getColumn(i+1).width=w);
    let r=1; const lc=Math.max(2,Math.round(N*.16)), rc=Math.max(3,Math.round(N*.24));
    ws.mergeCells(r,1,r+2,lc); ws.mergeCells(r,lc+1,r+2,N-rc);
    const t=ws.getCell(r,lc+1); t.value=sh.title.toUpperCase(); t.font={bold:true,size:15,color:{argb:"FF15233B"}}; t.alignment={horizontal:"center",vertical:"middle",wrapText:true};
    [["Ref. no.",ctx.refNo],["Format",(ctx.format.code||"F-PPAP")+" Rev "+(ctx.format.rev||"00")],["Date",window.PPAPDocs.dmy()]].forEach((p,i)=>{ const h=Math.max(1,Math.floor(rc/3)); ws.mergeCells(r+i,N-rc+1,r+i,N-rc+h); ws.mergeCells(r+i,N-rc+h+1,r+i,N); const a=ws.getCell(r+i,N-rc+1), b=ws.getCell(r+i,N-rc+h+1); a.value=p[0]; a.font={size:9,color:{argb:"FF5B6778"}}; b.value=p[1]; b.font={bold:true,size:9}; b.alignment={wrapText:true,vertical:"middle"}; });
    for(let rr=r;rr<=r+2;rr++){ ws.getRow(rr).height=22; for(let c=1;c<=N;c++) ws.getCell(rr,c).border={top:rr===r?med:undefined,bottom:rr===r+2?med:undefined,left:c===1||c===lc+1||c===N-rc+1?med:undefined,right:c===N?med:undefined}; }
    if(lid!=null){ let wpx=0; for(let c=1;c<=lc;c++) wpx+=(W[c-1]||8)*7; const ih=Math.min(60,(wpx-10)/logo.r); ws.addImage(lid,{tl:{col:.1,row:.15},ext:{width:ih*logo.r,height:ih}}); }
    else { const c=ws.getCell(r,1); c.value=ctx.customer||ctx.company||""; c.font={bold:true,size:11}; c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; }
    r+=4;
    if(sh.info&&sh.info.length){ const per=sh.infoCols||(land?3:2), span=Math.floor(N/per); let i=0;
      while(i<sh.info.length){ for(let k=0;k<per&&i<sh.info.length;k++,i++){ const s=1+k*span, e=k===per-1?N:s+span-1, lw=Math.max(1,Math.floor((e-s+1)/3)); if(e-s>=1){ ws.mergeCells(r,s,r,s+lw-1); ws.mergeCells(r,s+lw,r,e); }
          const a=ws.getCell(r,s), b=ws.getCell(r,s+lw); a.value=sh.info[i][0]; b.value=sh.info[i][1]==null?"":String(sh.info[i][1]); a.font={bold:true,size:9}; a.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFEEF2F8"}}; b.font={size:10}; for(let c=s;c<=e;c++){ ws.getCell(r,c).border=bd; ws.getCell(r,c).alignment={vertical:"middle",wrapText:true}; } }
        ws.getRow(r).height=Math.max(20, 16*Math.ceil(Math.max(...sh.info.slice(Math.max(0,i-per),i).map(p=>String(p[1]||"").length))/ (span*W[0]*0.9||40))); r++; }
      r++; }
    let freeze=null;
    sh.tables.forEach((tb,ti)=>{ const hr=r; tb.head.forEach((h,i)=>{ const c=ws.getCell(r,i+1); c.value=h; c.font={bold:true,size:9,color:{argb:"FFFFFFFF"}}; c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F3A66"}}; c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; c.border=bd; });
      ws.getRow(r).height=Math.max(30, 13*Math.ceil(Math.max(...tb.head.map((h,i)=>h.length/((W[i]||8)*0.95)))));
      if(ti===0&&sh.tables.length===1&&tb.rows.length>6) freeze=r; r++;
      tb.rows.forEach(row=>{ let lines=1; row.forEach((v,i)=>{ const c=ws.getCell(r,i+1), txt=cellText(v); c.value=txt; c.font={size:9}; c.border=bd; c.alignment={vertical:"top",wrapText:true,horizontal:v&&typeof v==="object"?"center":undefined}; const w=(W[i]||8)*0.95; lines=Math.max(lines,txt.split("\n").reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/w)),0)); });
        ws.getRow(r).height=Math.max(18,Math.min(200,12.5*lines+4)); r++; }); r++; });
    if(sh.blank){ ws.mergeCells(r,1,r+22,N); const c=ws.getCell(r,1); c.value=sh.notes[0]; c.font={italic:true,color:{argb:"FF8E9AAD"},size:12}; c.alignment={horizontal:"center",vertical:"middle"}; for(let rr=r;rr<=r+22;rr++) for(let cc=1;cc<=N;cc++) ws.getCell(rr,cc).border={top:rr===r?thin:undefined,bottom:rr===r+22?thin:undefined,left:cc===1?thin:undefined,right:cc===N?thin:undefined}; r+=24; }
    else (sh.notes||[]).forEach(n=>{ ws.mergeCells(r,1,r,N); const c=ws.getCell(r,1); c.value=n; c.font={size:9,bold:/^SIMULATED/.test(n),color:{argb:/^SIMULATED/.test(n)?"FFB91C1C":"FF333333"}}; c.alignment={wrapText:true,vertical:"top"}; ws.getRow(r).height=Math.max(16,13*Math.ceil(n.length/(W.reduce((a,b)=>a+b,0)*1.05))); r++; });
    if(freeze) ws.views=[{state:"frozen",ySplit:freeze,showGridLines:false}]; }
  const buf=await wb.xlsx.writeBuffer(); return {blob:new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),name:fileBase(D,ctx)+".xlsx"}; }

async function pdf(sheets,D,ctx){
  if(!window.jspdf) await load(JSPDF); if(!(window.jspdf&&window.jspdf.jsPDF.API.autoTable)) await load(AUTO);
  const {jsPDF}=window.jspdf, logo=await px(ctx.logo); let doc=null; const marks=[];
  for(const sh of sheets){ const N=colsOf(sh), land=sh.orient==="l", size=N>14?"a3":"a4", fmt={orientation:land?"l":"p",unit:"mm",format:size};
    if(!doc) doc=new jsPDF(fmt); else doc.addPage(size,land?"l":"p");
    const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight(), M=8, usable=pw-2*M, startPage=doc.getNumberOfPages();
    const head=()=>{ doc.setDrawColor(21,35,59); doc.setLineWidth(.5); doc.rect(M,M,usable,16); doc.line(M+34,M,M+34,M+16); doc.line(pw-M-62,M,pw-M-62,M+16);
      if(logo){ const h=Math.min(12,30/logo.r); try{ doc.addImage(logo.src,/jpe?g/.test(logo.src.slice(0,20))?"JPEG":"PNG",M+2,M+2,h*logo.r,h); }catch(e){} } else { doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text(doc.splitTextToSize(pdfSafe(ctx.customer||ctx.company||""),30),M+17,M+8,{align:"center"}); }
      doc.setFont("helvetica","bold"); doc.setFontSize(land?14:12); doc.text(pdfSafe(sh.title.toUpperCase()),M+34+(usable-34-62)/2,M+10,{align:"center",maxWidth:usable-100});
      doc.setFontSize(7.5); doc.setFont("helvetica","normal"); [["Ref. no.: "+ctx.refNo],["Format: "+(ctx.format.code||"F-PPAP")+" Rev "+(ctx.format.rev||"00")],["Date: "+window.PPAPDocs.dmy()]].forEach((t,i)=>doc.text(pdfSafe(t[0]),pw-M-60,M+4+i*5)); };
    head(); let y=M+19;
    if(sh.info&&sh.info.length){ const per=sh.infoCols||(land?3:2), body=[]; for(let i=0;i<sh.info.length;i+=per){ const row=[]; for(let k=0;k<per;k++){ const p=sh.info[i+k]; row.push(p?pdfSafe(p[0]):"",p?pdfSafe(p[1]):""); } body.push(row); }
      doc.autoTable({startY:y,body,theme:"grid",margin:{left:M,right:M},styles:{fontSize:7.5,cellPadding:1.2,lineColor:[142,154,173],lineWidth:.15,textColor:20},columnStyles:Object.fromEntries([...Array(per*2)].map((_,i)=>[i,i%2===0?{fontStyle:"bold",fillColor:[238,242,248],cellWidth:usable/per*0.3}:{}])),didDrawPage:()=>{} }); y=doc.lastAutoTable.finalY+3; }
    for(const tb of sh.tables){ const tot=tb.w.reduce((a,b)=>a+b,0), cw=tb.w.map(w=>w/tot*usable);
      doc.autoTable({startY:y,head:[tb.head.map(pdfSafe)],body:tb.rows.map(r=>r.map(v=>({content:v&&typeof v==="object"?"":pdfSafe(v),_sym:v&&typeof v==="object"?v.sym:null}))),theme:"grid",margin:{left:M,right:M,top:M+19,bottom:12},showHead:"everyPage",
        styles:{fontSize:N>14?6.2:7,cellPadding:1,lineColor:[142,154,173],lineWidth:.15,overflow:"linebreak",valign:"top",textColor:20},headStyles:{fillColor:[31,58,102],textColor:255,halign:"center",valign:"middle",fontStyle:"bold"},
        columnStyles:Object.fromEntries(cw.map((w,i)=>[i,{cellWidth:w}])),
        didDrawCell:d=>{ const s=d.cell.raw&&d.cell.raw._sym; if(d.section==="body"&&s){ const cx=d.cell.x+d.cell.width/2, cy=d.cell.y+3.2; doc.setDrawColor(29,95,208); doc.setLineWidth(.3); if(s==="O") doc.circle(cx,cy,1.8); else if(s==="I"){ doc.lines([[1.8,1.8],[-1.8,1.8],[-1.8,-1.8],[1.8,-1.8]],cx,cy-1.8,[1,1],"S",true); } else if(s==="S") doc.triangle(cx-2,cy-1.6,cx+2,cy-1.6,cx,cy+1.8,"S"); else doc.text("->",cx-1.5,cy+1); } },
        didDrawPage:d=>{ if(d.pageNumber>1||doc.getNumberOfPages()>startPage) head(); } });
      y=doc.lastAutoTable.finalY+4; }
    if(sh.blank){ doc.setDrawColor(142,154,173); doc.rect(M,y,usable,ph-y-16); doc.setFont("helvetica","italic"); doc.setFontSize(11); doc.setTextColor(142,154,173); doc.text(pdfSafe(sh.notes[0]),pw/2,y+(ph-y-16)/2,{align:"center"}); doc.setTextColor(0); }
    else (sh.notes||[]).forEach(n=>{ const L=doc.splitTextToSize(pdfSafe(n),usable); if(y+L.length*3.6>ph-14){ doc.addPage(size,land?"l":"p"); head(); y=M+19; } const sim=/^SIMULATED/.test(n); doc.setFont("helvetica",sim?"bold":"normal"); doc.setFontSize(7.5); doc.setTextColor(sim?185:40,sim?28:40,sim?28:40); doc.text(L,M,y); doc.setTextColor(0); y+=L.length*3.6+1.5; });
    marks.push(sh.title); }
  const n=doc.getNumberOfPages(); for(let i=1;i<=n;i++){ doc.setPage(i); const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight(); doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(90); doc.text(pdfSafe((ctx.company||"")+"  |  Ref. "+ctx.refNo+"  |  "+(ctx.format.code||"F-PPAP")+" Rev "+(ctx.format.rev||"00")),8,ph-5); doc.text("Page "+i+" of "+n,pw-8,ph-5,{align:"right"}); }
  return {blob:doc.output("blob"),name:fileBase(D,ctx)+".pdf"}; }
window.PPAPRender={xlsx,pdf};
})();
