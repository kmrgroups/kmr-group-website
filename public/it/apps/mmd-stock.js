/* Material Movement — stock by stage, physical stock audit, BOM check / variance, throughput time and route-card reconciliation.
   Stock rule: book stock at a stage = last physical count + pieces made at the stage since the count - pieces made at the next stage since the count.
   FG = count + pieces coming from the last stage - pieces invoiced. Raw material is never adjusted by production variance; only a physical count corrects it. */
window.MMDStock=(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),N=n=>(+n||0).toLocaleString('en-IN');
  const pk=c=>{const a=String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return [a,a.replace(/\d{2}$/,'')]};
  const RANK=[[/turn.*1st|od turn|^cnc turning$|^turning$|facing|cutting|sawing|fettl/,10],[/turn.*2nd|turnning.*2nd|id turn|2nd/,20],[/3rd|3 opt|turning 3/,25],[/vmc|hmc|mill|drill|bore|tapping|csk|hole/,30],[/tmc/,40],[/thread/,50],[/grind/,60],[/mark/,70],[/wash|deburr|clean|deb,|ecm/,75],[/visual|inspect|msa/,80],[/gauge|oil|pack/,90]];
  const rk=n=>{const t=String(n).toLowerCase();for(const [re,v] of RANK)if(re.test(t))return v;return 55};
  const isFI=n=>/inspect|visual|msa/i.test(n),isPK=n=>/pack|gauge|oil appl/i.test(n);
  const H=()=>+localStorage.getItem('mmd_hrs')||16,E=()=>+localStorage.getItem('mmd_eff')||0.85;
  let B=null;
  async function load(c){B=await c.call('kmr_mmd_stock_base',{p_days:60});return B}
  /* build the stage chain and book stock of every part */
  function build(c){
    const m=c.S.m,R={};Object.keys(m.routes||{}).forEach(k=>R[k.trim().toUpperCase()]=m.routes[k]);
    const cnt={},mk={},sup={},inv={},today=B.today;
    B.counts.forEach(x=>{cnt[x[0]+'|'+x[1]+'|'+x[2]]=+x[3]});
    const parts={};B.made.forEach(r=>{const p=(parts[r[0]]=parts[r[0]]||{code:r[0],name:r[1],st:{}});p.st[r[2]]={q:+r[3],last:r[4]}});
    B.counts.filter(x=>x[0]==='part').forEach(x=>{if(!parts[x[1]])parts[x[1]]={code:x[1],name:'',st:{}}});
    (m.parts||[]).forEach(p=>{if(!parts[p.code]&&(R[String(p.code).toUpperCase()]||[]).length)parts[p.code]={code:p.code,name:p.name,st:{}}});
    B.supplier.forEach(s=>{sup[s[0]]=(sup[s[0]]||0)+(+s[2]||0)});
    B.invoiced.forEach(i=>{pk(i[0]).forEach(k=>inv[k]=(inv[k]||0)+(+i[1]||0))});
    const out=Object.values(parts).map(p=>{
      const route=(R[String(p.code).toUpperCase()]||R[String(p.code).toUpperCase().replace(/-[0-9A-Za-z]{1,2}$/,'')]||[]),rn=route.map(o=>String(o.name||'').toUpperCase()),ctOf={};route.forEach(o=>ctOf[String(o.name||'').toUpperCase()]=+o.ct_sec||0);
      const names=[...new Set([...Object.keys(p.st),...rn.filter((n,i)=>route[i].type!=='supplier')])];
      names.sort((a,b)=>{const ia=rn.indexOf(a),ib=rn.indexOf(b);return ia>=0&&ib>=0?ia-ib:(rk(a)-rk(b))||a.localeCompare(b)});
      const ops=names.map(n=>({name:n,kind:isFI(n)?'fi':isPK(n)?'pk':'op',made:(p.st[n]||{}).q||0,last:(p.st[n]||{}).last||null,ct:ctOf[n]||0,cnt:cnt['part|'+p.code+'|'+n]}));
      const real=ops.filter(o=>o.made>0||o.cnt!=null||ctOf[o.name]!=null);
      ops.forEach((o,i)=>{const nx=ops.slice(i+1).find(z=>z.made>0);o.next=nx||null;o.out=nx?nx.made:(i===ops.length-1||!ops.slice(i+1).some(z=>z.made>0)?o.made:0);o.book=(o.cnt||0)+o.made-o.out});
      const lastMade=[...ops].reverse().find(o=>o.made>0),fgIn=lastMade?lastMade.made:0,pks=pk(p.code),invq=Math.max(...pks.map(k=>inv[k]||0),0);
      const fgc=cnt['part|'+p.code+'|FG'],fg=(fgc||0)+fgIn-invq;
      // lastMade has no outflow other than FG: its book is just the counted quantity
      if(lastMade)lastMade.book=(lastMade.cnt||0);
      const supq=sup[p.code]||0,extra={'SUPPLIER':supq||cnt['part|'+p.code+'|SUPPLIER']||0,'INCOMING INSPECTION':cnt['part|'+p.code+'|INCOMING INSPECTION']||0,'FINAL INSPECTION':cnt['part|'+p.code+'|FINAL INSPECTION']||0,'PACKING':cnt['part|'+p.code+'|PACKING']||0};
      ops.forEach(o=>{ // throughput: time to clear what waits here at the next stage, and idle days of the next stage
        o.days=o.next&&o.next.ct&&o.book>0?o.book*o.next.ct/3600/(H()*E()):null;
        o.idle=o.next&&o.next.last?Math.round((new Date(today)-new Date(o.next.last))/864e5):(o.next?null:null);
        o.ind=o.book<=0?'':(o.next&&o.idle==null)||(o.idle!=null&&o.idle>3)?'r':(o.days!=null&&o.days>5)?'a':'g'});
      const wip=ops.reduce((a,o)=>a+(o.kind==='op'?Math.max(0,o.book):0),0);
      return {code:p.code,name:p.name,ops,wip,fg,fgIn,invq,extra,fgc,counted:ops.some(o=>o.cnt!=null)||fgc!=null,bad:ops.some(o=>o.ind==='r')?'r':ops.some(o=>o.ind==='a')?'a':'g'};
    }).sort((a,b)=>a.code.localeCompare(b.code));
    return out;
  }
  const chip=(i)=>i?`<span class="chip" style="background:${i==='r'?'#fee2e2;color:#7f1d1d':i==='a'?'#fef3c7;color:#78350f':'#dcfce7;color:#14532d'}">${i==='r'?'Not moving':i==='a'?'Slow':'On time'}</span>`:'';
  function stockHtml(c,P){
    const a=B.audit,q=(localStorage.getItem('mmd_skq')||'').toLowerCase(),L=P.filter(p=>!q||(p.code+' '+(p.name||'')).toLowerCase().includes(q));
    const T=(f)=>L.reduce((s,p)=>s+(+f(p)||0),0);
    const k=(n,l,col)=>`<div class="kpi" style="--c:${col}"><b>${N(n)}</b><span>${l}</span></div>`;
    return `<div class="note">${a?`Book stock = physical count of <b>${esc(a.audit_date)}</b> + pieces made since − pieces that moved on. FG also falls when an invoice is issued.`:`<b>No physical stock audit yet.</b> The figures below are estimated from the last 60 days of production. Enter a physical stock count (Physical stock audit) so the book stock becomes exact.`} Production entered at a stage reduces the stock of the stage before it.</div>
    <div class="row noprint"><input id="skq" placeholder="Search part…" value="${esc(localStorage.getItem('mmd_skq')||'')}" style="max-width:300px"><span class="mut">Capacity used for time: <input id="hrs" type="number" value="${H()}" style="width:64px"> h/day × <input id="eff" type="number" step="0.05" value="${E()}" style="width:64px"> efficiency</span></div>
    <div class="kpis">${k(L.length,'parts','var(--b)')}${k(T(p=>p.wip),'pcs work in progress at the stages','var(--a)')}${k(T(p=>p.extra.SUPPLIER),'pcs at suppliers','var(--a)')}${k(T(p=>p.extra['FINAL INSPECTION']),'pcs in final inspection (counted)','var(--b)')}${k(T(p=>p.extra.PACKING),'pcs in packing (counted)','var(--b)')}${k(T(p=>Math.max(0,p.fg)),'pcs finished goods','var(--g)')}${k(T(p=>p.invq),'pcs invoiced since '+esc(B.since),'var(--g)')}</div>
    <div class="sc"><table><thead><tr><th>Part</th><th class="n">Work in progress</th><th class="n">At supplier</th><th class="n">Incoming inspection</th><th class="n">Final inspection</th><th class="n">Packing</th><th class="n">FG stock</th><th>Flow</th><th></th></tr></thead><tbody>${L.map(p=>`<tr><td><b>${esc(p.code)}</b><div class="mut">${esc(p.name||'')}</div></td><td class="n">${N(p.wip)}</td><td class="n">${N(p.extra.SUPPLIER)}</td><td class="n">${N(p.extra['INCOMING INSPECTION'])}</td><td class="n">${N(p.extra['FINAL INSPECTION'])}</td><td class="n">${N(p.extra.PACKING)}</td><td class="n" style="${p.fg<0?'color:var(--r);font-weight:700':''}">${N(p.fg)}</td><td>${chip(p.bad)}</td><td><button class="btn s o" data-sk="${esc(p.code)}">Stages</button></td></tr>`).join('')||'<tr><td colspan="9" class="mut">No parts.</td></tr>'}</tbody></table></div><div id="skd"></div>
    <p class="note">Raw material in store and on the shop floor is shown in <b>Physical stock audit</b> (in kg). Incoming inspection, final inspection and packing show the counted stock until their movements are entered.</p>`;
  }
  function stagesHtml(p){
    return `<div class="card" style="margin-top:10px"><h3>${esc(p.code)} ${esc(p.name||'')}</h3><div class="sc"><table><thead><tr><th class="n">#</th><th>Stage</th><th class="n">Counted</th><th class="n">Made since</th><th class="n">Moved to next</th><th class="n">Book stock here</th><th class="n">Time to clear (days)</th><th class="n">Next stage idle (days)</th><th>Throughput</th></tr></thead><tbody>${p.ops.map((o,i)=>`<tr><td class="n">${i+1}</td><td><b>${esc(o.name)}</b>${o.kind!=='op'?` <span class="chip x">${o.kind==='fi'?'inspection':'packing'}</span>`:''}</td><td class="n">${o.cnt==null?'—':N(o.cnt)}</td><td class="n">${N(o.made)}</td><td class="n">${N(o.out)}</td><td class="n" style="${o.book<0?'color:var(--r);font-weight:700':''}"><b>${N(o.book)}</b></td><td class="n">${o.days==null?'—':o.days.toFixed(1)}</td><td class="n">${o.idle==null?'—':o.idle}</td><td>${chip(o.ind)}</td></tr>`).join('')}<tr><td></td><td><b>FG (finished goods)</b></td><td class="n">${p.fgc==null?'—':N(p.fgc)}</td><td class="n">${N(p.fgIn)}</td><td class="n">${N(p.invq)} <span class="mut">invoiced</span></td><td class="n"><b>${N(p.fg)}</b></td><td></td><td></td><td></td></tr></tbody></table></div><p class="note">Time to clear = book stock × cycle time of the next stage ÷ (hours per day × efficiency). A stage is <b>Not moving</b> when pieces wait and the next stage has not run for more than 3 days.</p></div>`;
  }
  /* physical stock audit */
  function auditHtml(c,P){
    const a=B.audit,STG=['SUPPLIER','INCOMING INSPECTION','FINAL INSPECTION','PACKING'];
    const rows=[];P.forEach(p=>{p.ops.filter(o=>o.kind==='op').forEach(o=>rows.push(['part',p.code,o.name,o.book,p.name]));STG.forEach(s=>rows.push(['part',p.code,s,p.extra[s],p.name]));rows.push(['part',p.code,'FG',p.fg,p.name])});

    const row=r=>`<tr><td>${esc(r[1])}<div class="mut">${esc(r[4]||'')}</div></td><td>${esc(r[2])}</td><td class="n">${N(r[3])}</td><td><input class="ac" type="number" step="any" min="0" style="width:110px" data-t="${r[0]}" data-c="${esc(r[1])}" data-s="${esc(r[2])}" data-b="${+r[3]||0}"></td><td class="n ad"></td></tr>`;
    return `<div class="note">Enter the <b>physical count</b> of every stage from raw material to FG whenever an inventory audit is done. Leave blank what was not counted. After saving, the counted quantity becomes the book stock and production and invoices are applied after the audit date. Part stock is never corrected through raw material. <b>Raw material stock is not counted here</b> — it is amended only in the <a href="/it/rmp.html">Raw Material Planning</a> app (stock amendment), the same way tool stock is amended in Tool Plan and consumables in Consumables Plan.</div>
    <div class="row noprint"><label>Audit date</label><input id="adt" type="date" value="${esc(B.today)}" max="${esc(B.today)}" style="width:auto"><input id="anote" placeholder="Note e.g. month-end physical audit" style="max-width:320px"><input id="af" placeholder="Filter part / stage…" style="max-width:220px"><button class="btn g" id="asv">Save physical stock</button></div>
    <div class="sc" style="max-height:560px;overflow:auto"><table><thead style="position:sticky;top:0;background:#fff"><tr><th>Item</th><th>Stage</th><th class="n">Book now</th><th>Physical count</th><th class="n">Difference</th></tr></thead><tbody id="atb">${rows.map(row).join('')}</tbody></table></div>
    <h4>Earlier audits</h4><table><thead><tr><th>Date</th><th>Note</th><th>By</th><th class="n">Lines</th><th class="n">Total difference</th></tr></thead><tbody>${B.audits.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.note||'')}</td><td>${esc(x.by||'')}</td><td class="n">${x.rows}</td><td class="n">${N(x.diff)}</td></tr>`).join('')||'<tr><td colspan="5" class="mut">No audit yet.</td></tr>'}</tbody></table>`;
  }
  function bomHtml(D){
    const v=r=>{const d=+r.dev_pct;return Math.abs(d)<=2?['g','Within ±2% — BOM is fine']:(+r.lots>=2?['r',(d>0?'More':'Less')+' raw material per piece than the BOM — correct the BOM to '+r.actual_kg+' kg']:['a','Check the BOM or the process (only one lot so far)'])};
    return `<div class="note">Raw material is issued in kg and the pieces allowed are worked out from the BOM kg per piece. If the pieces actually made differ, the raw material stock is <b>not changed</b>: short quantity is short-closed, extra pieces are added to part stock, and the BOM is checked here. A repeated deviation in the same direction means the BOM weight is wrong; a deviation that jumps both ways means material was wasted or over-used.</div>
    <h4>BOM check (closed first operations)</h4><div class="sc"><table><thead><tr><th>Part</th><th class="n">Lots</th><th class="n">Issued kg</th><th class="n">Pieces made</th><th class="n">BOM kg / pc</th><th class="n">Actual kg / pc</th><th class="n">Deviation %</th><th class="n">Short pcs</th><th class="n">Extra pcs</th><th>Verdict</th></tr></thead><tbody>${D.parts.map(r=>{const t=v(r);return `<tr><td><b>${esc(r.part_code)}</b><div class="mut">${esc(r.part_name||'')}</div></td><td class="n">${r.lots}</td><td class="n">${N(r.issued_kg)}</td><td class="n">${N(r.made)}</td><td class="n">${r.bom_kg}</td><td class="n">${r.actual_kg}</td><td class="n">${r.dev_pct}</td><td class="n">${N(r.short_qty)}</td><td class="n">${N(r.excess_qty)}</td><td><span class="chip" style="background:${t[0]==='r'?'#fee2e2':t[0]==='a'?'#fef3c7':'#dcfce7'}">${esc(t[1])}</span></td></tr>`}).join('')||'<tr><td colspan="10" class="mut">No closed first operation yet. Lots made through Issue raw material appear here.</td></tr>'}</tbody></table></div>
    <h4>Short-closed and extra quantities</h4><div class="sc"><table><thead><tr><th>When</th><th>Route sheet</th><th>Part</th><th>Type</th><th class="n">Pcs</th><th class="n">Issued kg</th><th class="n">Allowed pcs</th><th>Reason</th><th>By</th></tr></thead><tbody>${D.log.map(r=>`<tr><td>${new Date(r.created_at).toLocaleDateString('en-IN')}</td><td>${esc(r.rs_no)}</td><td>${esc(r.part_code)}</td><td>${r.kind==='short'?'Short closed':'Extra to part stock'}</td><td class="n">${N(r.qty)}</td><td class="n">${N(r.issued_kg)}</td><td class="n">${N(r.allowed_qty)}</td><td>${esc(r.note||'')}</td><td class="mut">${esc(r.created_by||'')}</td></tr>`).join('')||'<tr><td colspan="9" class="mut">None.</td></tr>'}</tbody></table></div>`;
  }
  const rcRows=(D)=>D.rows.map(r=>{
    const hrs=r.ct_sec*r.qty/3600/E(),days=Math.ceil(hrs/H())+r.sup_ops*3,planned=new Date(new Date(r.created_at).getTime()+days*864e5),now=new Date(D.today+'T23:59:59'),open=r.status==='open';
    const gap=(+r.qty+ +r.excess_qty)-(+r.fg_qty+ +r.wip_qty+ +r.rej_qty+ +r.short_qty);
    const late=open?Math.ceil((now-planned)/864e5):(r.closed_at?Math.ceil((new Date(r.closed_at)-planned)/864e5):0);
    const ind=open?(late>0?'r':late>-2?'a':'g'):(late>0?'a':'g'),rec=open?'—':(Math.abs(gap)<1?'Reconciled':'Gap '+N(gap));
    return {r,days,planned,late,ind,gap,rec,open};
  });
  function rcHtml(D){
    const R=rcRows(D),od=R.filter(x=>x.open&&x.late>0).length;
    return `<div class="note">Allowed time of a route card is worked out from the cycle times: pieces × cycle time of all in-house operations ÷ (hours per day × efficiency), plus 3 days for every outsourced operation. A card still open after that time is <b>overdue</b>; a closed card must have every piece accounted for (FG + in process + rejected + short closed).</div>
    <div class="kpis"><div class="kpi" style="--c:var(--b)"><b>${R.filter(x=>x.open).length}</b><span>open route cards</span></div><div class="kpi" style="--c:${od?'var(--r)':'var(--g)'}"><b>${od}</b><span>open beyond the allowed time</span></div><div class="kpi" style="--c:var(--g)"><b>${R.filter(x=>!x.open&&x.late<=0).length}</b><span>closed on time</span></div><div class="kpi" style="--c:var(--a)"><b>${R.filter(x=>!x.open&&Math.abs(x.gap)>=1).length}</b><span>closed with a quantity gap</span></div></div>
    <div class="sc"><table><thead><tr><th>Route sheet</th><th>Part</th><th class="n">Qty</th><th class="n">Allowed days</th><th>Issued</th><th>Should close by</th><th class="n">Days late</th><th class="n">FG</th><th class="n">In process</th><th class="n">Rejected</th><th class="n">Short closed</th><th class="n">Extra</th><th>Reconciliation</th><th>Status</th></tr></thead><tbody>${R.map(x=>{const r=x.r;return `<tr><td><b>${esc(r.rs_no)}</b></td><td>${esc(r.part_code)}<div class="mut">${esc(r.part_name||'')}</div></td><td class="n">${N(r.qty)}</td><td class="n">${x.days}${r.no_ct?` <span class="late" title="Operations without cycle time">*</span>`:''}</td><td>${new Date(r.created_at).toLocaleDateString('en-IN')}</td><td>${x.planned.toLocaleDateString('en-IN')}</td><td class="n">${x.late>0?x.late:0}</td><td class="n">${N(r.fg_qty)}</td><td class="n">${N(r.wip_qty)}</td><td class="n">${N(r.rej_qty)}</td><td class="n">${N(r.short_qty)}</td><td class="n">${N(r.excess_qty)}</td><td>${esc(x.rec)}</td><td>${x.open?`<span class="chip" style="background:${x.ind==='r'?'#fee2e2':x.ind==='a'?'#fef3c7':'#dcfce7'}">${x.ind==='r'?'Overdue':x.ind==='a'?'Due soon':'On time'}</span>`:'<span class="chip g">Closed</span>'}</td></tr>`}).join('')||'<tr><td colspan="14" class="mut">No route cards yet.</td></tr>'}</tbody></table></div><p class="note">* some operations have no cycle time — add them in Operations Master › Cycle times so the allowed time is complete. Closed and overdue cards feed the next month's raw material plan, production plan and capacity.</p>`;
  }
  async function draw(c,el){
    const sub=localStorage.getItem('mmd_sub')||'stock';
    el.innerHTML='<p class="note">Loading…</p>';
    try{await load(c)}catch(e){el.innerHTML='<p class="note">'+esc(e.message)+'</p>';return}
    const P=build(c);
    const nav=`<div class="row noprint">${[['stock','Stock by stage'],['audit','Physical stock audit'],['bom','BOM check & variance'],['rc','Throughput & route cards']].map(([k,l])=>`<button class="btn s${k===sub?'':' o'}" data-sub="${k}">${l}</button>`).join('')}</div>`;
    let body='';
    if(sub==='stock')body=stockHtml(c,P);else if(sub==='audit')body=auditHtml(c,P);
    else if(sub==='bom')body=bomHtml(await c.call('kmr_mmd_bom_check'));else body=rcHtml(await c.call('kmr_mmd_rc_recon',{p_hours:H(),p_eff:E()}));
    el.innerHTML=nav+body;
    el.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{localStorage.setItem('mmd_sub',b.dataset.sub);draw(c,el)});
    const q=el.querySelector('#skq');if(q)q.onchange=()=>{localStorage.setItem('mmd_skq',q.value);draw(c,el)};
    ['hrs','eff'].forEach(id=>{const e=el.querySelector('#'+id);if(e)e.onchange=()=>{localStorage.setItem('mmd_'+id,e.value);draw(c,el)}});
    el.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{const p=P.find(x=>x.code===b.dataset.sk);el.querySelector('#skd').innerHTML=stagesHtml(p);el.querySelector('#skd').scrollIntoView({behavior:'smooth'})});
    if(sub==='audit'){
      el.querySelectorAll('.ac').forEach(i=>i.oninput=()=>{const d=i.closest('tr').querySelector('.ad');d.textContent=i.value===''?'':N((+i.value)-(+i.dataset.b));d.style.color=i.value!==''&&(+i.value)!==(+i.dataset.b)?'var(--r)':''});
      const f=el.querySelector('#af');f.oninput=()=>{const t=f.value.toLowerCase();el.querySelectorAll('#atb tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(t)?'':'none')};
      el.querySelector('#asv').onclick=async()=>{const rows=[...el.querySelectorAll('.ac')].filter(i=>i.value!=='').map(i=>({type:i.dataset.t,code:i.dataset.c,stage:i.dataset.s,qty:i.value,book:i.dataset.b}));
        if(!rows.length){c.say('Enter at least one counted quantity.');return}
        if(!confirm('Save '+rows.length+' counted quantities as the physical stock of '+el.querySelector('#adt').value+'? Raw material (kg) counts correct the raw material stock.'))return;
        try{await c.call('kmr_mmd_audit_save',{p:{date:el.querySelector('#adt').value,note:el.querySelector('#anote').value,rows}});c.say('Physical stock saved. Book stock now starts from it.',1);draw(c,el)}catch(e){c.say(e.message)}};
    }
  }
  /* small summary for the Dashboards screen */
  async function dash(c){
    try{const b=await c.call('kmr_mmd_stock_base',{p_days:60});B=b;const P=build(c),rc=rcRows(await c.call('kmr_mmd_rc_recon',{p_hours:H(),p_eff:E()})),bm=await c.call('kmr_mmd_bom_check');
      const nm=P.filter(p=>p.bad==='r').length,sl=P.filter(p=>p.bad==='a').length,od=rc.filter(x=>x.open&&x.late>0).length,gp=rc.filter(x=>!x.open&&Math.abs(x.gap)>=1).length,bad=bm.parts.filter(r=>Math.abs(+r.dev_pct)>2).length;
      const k=(n,l,col,go)=>`<a class="kpi" href="#go=stock" style="--c:${col};text-decoration:none;color:inherit"><b>${N(n)}</b><span>${l}</span></a>`;
      return `<h3 style="margin:18px 0 4px">Throughput, route cards and BOM — indicators</h3><div class="kpis">${k(nm,'parts with stock not moving (next stage idle &gt; 3 days)',nm?'var(--r)':'var(--g)')}${k(sl,'parts with slow flow (&gt; 5 days to clear)',sl?'var(--a)':'var(--g)')}${k(od,'route cards open beyond allowed time',od?'var(--r)':'var(--g)')}${k(gp,'closed route cards with a quantity gap',gp?'var(--a)':'var(--g)')}${k(bad,'parts whose BOM kg deviates more than 2%',bad?'var(--a)':'var(--g)')}</div>`}catch(e){return ''}
  }
  return {draw,dash};
})();
