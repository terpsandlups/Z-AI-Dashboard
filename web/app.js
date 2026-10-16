'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n), num=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n), pct=n=>n==null?'—':num(n*100)+'%', pp=n=>n==null?'—':(n>0?'+':'')+num(n*100)+' p.p.';
const names=['Visão Executiva','Perdas Reconhecidas','Vendas & Participação','Comparador de Períodos','Perdas Desconhecidas · Inventário','Perdas Consolidadas','Estoque de Trocas','Central de Importações'];
const subtitles=['Indicadores consolidados da operação','Quebras reconhecidas e recorrências','Faturamento e participação por departamento','Evolução entre dois períodos','Faltas, sobras e resultado de inventário','Visão integrada de todas as perdas','Gestão de fornecedores, marcas e tratativas','Atualização segura das bases operacionais'];
const navIcons=[
 '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="4" height="8" rx="1"/><rect x="10" y="6" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="16" rx="1"/></svg>',
 '<svg viewBox="0 0 24 24"><path d="M4 6h16M6 9l4 4 4-3 4 5"/><path d="M18 11v4h-4"/></svg>',
 '<svg viewBox="0 0 24 24"><circle cx="9" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/></svg>',
 '<svg viewBox="0 0 24 24"><path d="M4 7h12M12 3l4 4-4 4M20 17H8M12 13l-4 4 4 4"/></svg>',
 '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L21 21"/></svg>',
 '<svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16"/><path d="M8 3v4M14 10v4M18 17v4"/></svg>',
 '<svg viewBox="0 0 24 24"><path d="M4 7.5L12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
 '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>'
];
const TRADE_BRAND_OVERRIDES={
 '30074':'Seara','31933':'Seara',
 '17396':'Itambé','56049':'Itambé','77496':'Itambé',
 '12149':'KIM','73865':'KIM',
 '40770':'Delícia da Roça',
 '36331':'Yakult','708':'Yakult',
 '74845':'Serramar',
 '72826':'Life','48429':'Life'
};
// Metas oficiais da Loja 007, conforme planilhas fornecidas em 16/10/2026.
// Metas de participação foram informadas com soma de 100,10%; os valores não são normalizados.
// Quando o backend atualizar as metas, retirar esta camada de compatibilidade sem perder o histórico.
const OFFICIAL_DEPT_GOALS = {
 "113": {
  "meta_perda": null,
  "meta_participacao": 0.0756
 },
 "114": {
  "meta_perda": 0.01,
  "meta_participacao": 0.067
 },
 "115": {
  "meta_perda": 0.01,
  "meta_participacao": 0.002
 },
 "116": {
  "meta_perda": 0.005,
  "meta_participacao": 0.0216
 },
 "117": {
  "meta_perda": 0.005,
  "meta_participacao": 0.005
 },
 "118": {
  "meta_perda": 0.005,
  "meta_participacao": 0.0215
 },
 "120": {
  "meta_perda": 0.05,
  "meta_participacao": 0.004
 },
 "121": {
  "meta_perda": 0.01,
  "meta_participacao": 0.0014000000000000002
 },
 "123": {
  "meta_perda": 0.025,
  "meta_participacao": 0.0506
 },
 "130": {
  "meta_perda": null,
  "meta_participacao": 0.0055000000000000005
 },
 "015": {
  "meta_perda": 0.03,
  "meta_participacao": 0.0404
 },
 "016": {
  "meta_perda": 0.025,
  "meta_participacao": 0.0463
 },
 "017": {
  "meta_perda": 0.008,
  "meta_participacao": 0.0584
 },
 "018": {
  "meta_perda": 0.002,
  "meta_participacao": 0.0588
 },
 "019": {
  "meta_perda": 0.005,
  "meta_participacao": 0.0125
 },
 "020": {
  "meta_perda": 0.005,
  "meta_participacao": null
 },
 "021": {
  "meta_perda": 0.01,
  "meta_participacao": 0.1384
 },
 "022": {
  "meta_perda": 0.03,
  "meta_participacao": 0.157
 },
 "023": {
  "meta_perda": 0.005,
  "meta_participacao": 0.0434
 },
 "025": {
  "meta_perda": 0.02,
  "meta_participacao": 0.0966
 },
 "026": {
  "meta_perda": 0.02,
  "meta_participacao": 0.095
 }
};
function applyOfficialGoals(snapshot){
 if(snapshot?.loja!=='007')return snapshot;
 const original=new Map((snapshot.metas||[]).map(r=>[r.codigo,r]));
 const metas=[...new Set([...original.keys(),...Object.keys(OFFICIAL_DEPT_GOALS)])].map(code=>{
  const goals=OFFICIAL_DEPT_GOALS[code]||{meta_perda:null,meta_participacao:null};
  return {...(original.get(code)||{codigo:code,descricao:snapshot.departamentos?.[code]||code,participacao:0,vendas_historicas:0}),...goals};
 });
 return {...snapshot,metas,meta_origem:'Planilhas de 16/10/2026',metas_participacao_soma:1.001};
}
function departmentOptions(snapshot){
 const official=new Set((snapshot.metas||[]).filter(r=>r.meta_perda!=null||r.meta_participacao!=null).map(r=>r.codigo));
 const allowed=official.size?Object.entries(snapshot.departamentos).filter(([k])=>official.has(k)):Object.entries(snapshot.departamentos);
 return (allowed.length?allowed:Object.entries(snapshot.departamentos)).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
}
const BASE=window.ZAI_CONFIG?.supabaseUrl||'',KEY=window.ZAI_CONFIG?.publishableKey||'';
let activeStore='',accessibleStores=[],requestVersion=0;
let data=null,page=0,cloud=false,session=null,context=null,pending=null,productPage=0,productQuery='',activeDept='',productStatus='',compareAFrom='',compareATo='',compareBFrom='',compareBTo='',compareDept='',salesProductRows=[],salesProductKey='',salesProductLoading=false,tradeSupplier='',tradeCategory='',tradeBrand='',tradeQuery='';
function msg(s,error=false){$('#message').innerHTML=s?`<div class="notice ${error?'error':'info'}">${esc(s)}</div>`:''}
function download(filename,text,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
function csv(name,headers,rows){const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';download(name,'\ufeff'+[headers,...rows].map(r=>r.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8')}
async function request(path,body,auth=true){
 if(!BASE||!KEY)throw Error('Configure web/config.js com a URL e a chave publishable do Supabase.');
 if(auth){if(!session)throw Error('Entre na conta para acessar o banco.');if(session.expires_at<Date.now()/1000+60){const r=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},false);session={...r,expires_at:Date.now()/1000+r.expires_in};}}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
 try{const r=await fetch(BASE+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body),signal:controller.signal});const j=await r.json();if(!r.ok)throw Error(j.message||j.error_description||j.msg||'Falha no Supabase');return j;}catch(e){if(e.name==='AbortError')throw Error('A resposta demorou mais de 90 segundos. Atualize para conferir o estado antes de repetir uma gravação.');throw e}finally{clearTimeout(timer)}
}
function setData(d,isCloud){
 if(d.schema!=='zai-007-v2'||!/^\d{3}$/.test(d.loja)||!Array.isArray(d.perdas)||!d.departamentos||!d.produtos)throw Error('Base analítica incompatível.');
 if(![d.perdas,d.vendas_mensais||[],d.vendas_diarias||[]].every(a=>a.every(r=>Array.isArray(r)&&r.every(x=>typeof x==='string'||typeof x==='number'))))throw Error('Linhas inválidas na base.');
 data=applyOfficialGoals(d);cloud=isCloud;pending=null;activeStore=d.loja;salesProductRows=[];salesProductKey='';tradeSupplier='';tradeCategory='';tradeBrand='';tradeQuery='';syncStores();
 $('#sourceBadge').textContent=isCloud?'Supabase · '+d.loja:'Conferência local · não salva na nuvem';$('#refresh').hidden=!isCloud;$('#logout').hidden=!session;$('#loginOpen').textContent=isCloud?'Conta conectada':'Conectar Supabase';
 $('#dept').innerHTML='<option value="">Todos os departamentos</option>'+departmentOptions(data).map(([k,v])=>`<option value="${esc(k)}">${esc(k+' · '+v)}</option>`).join('');
 const dates=[...(d.dias_vendas_completos||[]),...(d.perdas||[]).map(r=>r[0]),...(d.auditorias_diarias_resumo||[]).map(r=>r[0])].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
 const latestSales=[...(d.dias_vendas_completos||[])].sort().at(-1),latest=latestSales||dates.at(-1);
 if(latest){$('#from').value=latest.slice(0,7)+'-01';$('#to').value=latest}
 render();
}
function card(title,value,note,hero=false){return `<article class="card kpi ${hero?'hero':''}"><label>${esc(title)}</label><b>${value}</b><small>${note}</small></article>`}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map((h,i)=>`<th class="${i?'num':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map((x,i)=>`<td class="${i?'num':''}">${x}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${headers.length}">Sem registros para este filtro.</td></tr>`}</tbody></table></div>`}
function bars(rows,red=false){const max=Math.max(...rows.map(x=>Math.abs(x[1])),1);return rows.length?`<div class="bars">${rows.map(([name,value,label])=>`<div><div class="bar-head"><span>${esc(name)}</span><strong>${label||money(value)}</strong></div><div class="bar-track"><div class="bar-fill ${red?'red':''}" style="width:${Math.max(0,value)/max*100}%"></div></div></div>`).join('')}</div>`:'<p class="small muted">Sem dados comparáveis no período.</p>'}
function departmentAnalyticsContext(){
 const full=ZAI.select(data,$('#from').value,$('#to').value,'');
 const all=ZAI.departmentAnalytics(data,full),selected=$('#dept').value;
 return {full,rows:selected?all.filter(r=>r.code===selected):all,all};
}
function departmentFocus(rows){
 if(!$('#dept').value)return '';const r=rows[0];if(!r)return '';
 return `<div class="kpis">${card('Participação na venda da loja',pct(r.salesShare),'Venda do departamento ÷ venda total da loja')}${card('Participação nas perdas da loja',pct(r.lossShare),'Perdas do departamento ÷ perdas totais')}${card('Impacto na perda geral',pct(r.storeLossImpact),'Perdas do departamento ÷ venda total da loja')}${card('Peso perdas × peso vendas',pp(r.shareGap),'Positivo: pesa mais nas perdas do que nas vendas')}</div>`;
}
function auditForPeriod(from,to,dept='',cut=null){
 const start=ZAI.asDateStart(from),requestedEnd=ZAI.asDateEnd(to),end=cut&&cut<requestedEnd?cut:requestedEnd;
 const rows=(data?.auditorias_diarias_resumo||[]).filter(r=>r[0]>=start&&r[0]<=end&&(!dept||r[2]===dept));
 let sobras=0,faltas=0,qs=0,qf=0;
 for(const r of rows){if(r[1]==='entrada'){sobras+=Number(r[4]);qs+=Number(r[3])}else if(r[1]==='saida'){faltas+=Number(r[4]);qf+=Number(r[3])}}
 return {rows,sobras,faltas,liquido:faltas-sobras,qs,qf};
}
function operationalPeriod(from,to,dept=''){
 const c=ZAI.select(data,from,to,dept),a=auditForPeriod(from,to,dept,c.cut);
 const consolidated=c.lossTotal+a.liquido;
 return {context:c,a,recon:c.lossTotal,consolidated,ratio:c.comparable&&c.salesTotal>0?consolidated/c.salesTotal:null};
}
function consolidatedDepartments(from,to,dept=''){
 const full=ZAI.select(data,from,to,''),start=full.start,end=full.end,map=new Map(),get=code=>{if(!map.has(code))map.set(code,{code,name:data.departamentos[code]||code,sales:0,recon:0,faltas:0,sobras:0});return map.get(code)};
 full.sales.forEach(r=>get(r[2]).sales+=Number(r[4]));
 full.loss.forEach(r=>get(r[2]).recon+=Number(r[5]));
 for(const r of (data?.auditorias_diarias_resumo||[])){
  if(r[0]<start||r[0]>end)continue;
  const x=get(r[2]);if(r[1]==='entrada')x.sobras+=Number(r[4]);else if(r[1]==='saida')x.faltas+=Number(r[4]);
 }
 const meta=ZAI.lossTarget(data);
 return [...map.values()].map(r=>{
   const consolidated=r.recon+r.faltas-r.sobras,target=(data.metas||[]).find(x=>x.codigo===r.code)?.meta_perda??null;
   return {...r,consolidated,ratio:full.comparable&&r.sales>0?consolidated/r.sales:null,target};
  }).filter(r=>!dept||r.code===dept).sort((a,b)=>b.consolidated-a.consolidated);
}
function shiftDate(d,delta){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+delta);return x.toISOString().slice(0,10)}
function initComparePeriods(){
 if(compareBFrom&&compareBTo&&compareAFrom&&compareATo)return;
 compareBFrom=$('#from').value;compareBTo=$('#to').value;
 const len=ZAI.dateSpan(compareBFrom,compareBTo).length||1;
 compareATo=shiftDate(compareBFrom,-1);compareAFrom=shiftDate(compareATo,-len+1);
}
function trend(){
 const cs=context.months.map(m=>ZAI.select(data,m,m,$('#dept').value)),maxS=Math.max(...cs.map(c=>c.salesTotal),1),maxL=Math.max(...cs.map(c=>c.lossTotal),1);
 // Separate scales explicitly labelled; rate uses a separate comparison table.
 const W=640,H=205,L=70,R=58,T=20,B=37,px=i=>L+(W-L-R)*(cs.length===1?.5:i/(cs.length-1)),py=(v,max)=>H-B-(H-B-T)*v/max;
 const points=(k,max)=>cs.map((c,i)=>k==='salesTotal'&&!c.sales.length?null:[px(i),py(c[k],max)]);
 const poly=(ps,color)=>`<path d="${ps.map((p,i)=>p?((i===0||!ps[i-1])?'M':'L')+p.join(','):'').join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
 return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas e perdas mensais em reais, com eixos separados">${[0,.5,1].map(t=>`<line x1="${L}" x2="${W-R}" y1="${py(t*maxS,maxS)}" y2="${py(t*maxS,maxS)}" stroke="#e0e8dd"/><text x="${L-8}" y="${py(t*maxS,maxS)+3}" text-anchor="end" font-size="9" fill="#55836d">${num(t*maxS/1000)} mil</text><text x="${W-R+8}" y="${py(t*maxL,maxL)+3}" font-size="9" fill="#bd7750">${num(t*maxL/1000)} mil</text>`).join('')}${poly(points('salesTotal',maxS),'#289575')}${poly(points('lossTotal',maxL),'#c28956')}${cs.map((c,i)=>`${c.sales.length?`<circle cx="${px(i)}" cy="${py(c.salesTotal,maxS)}" r="4" fill="#289575"><title>${c.months[0]}: vendas ${money(c.salesTotal)}, perdas ${money(c.lossTotal)}</title></circle>`:''}<circle cx="${px(i)}" cy="${py(c.lossTotal,maxL)}" r="3" fill="#c28956"/><text x="${px(i)}" y="${H-10}" text-anchor="middle" font-size="10" fill="#6a7d70">${c.months[0].slice(5)}/${c.months[0].slice(2,4)}</text>`).join('')}</svg><div class="legend"><span><i class="dot"></i>Vendas · eixo esquerdo (R$)</span><span><i class="dot" style="background:#c28956"></i>Perdas · eixo direito (R$)</span></div>`;
}

function lossKindOf(reason){
 const r=String(reason||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(r.includes('vencid'))return 'vencidos';
 if(r.includes('avariad'))return 'avariados';
 if(r.includes('deteriorad'))return 'deteriorados';
 return 'outros';
}
const LOSS_KINDS=[['vencidos','Vencidos'],['avariados','Avariados'],['deteriorados','Deteriorados'],['outros','Outros']];
function lossKindTotals(from,to,dept=''){
 const c=ZAI.select(data,from,to,dept),m=Object.fromEntries(LOSS_KINDS.map(x=>[x[0],0]));
 c.loss.forEach(r=>m[lossKindOf(r[3])]+=Number(r[5]));
 return m;
}
function kindChart(a,b=null){
 const labels=LOSS_KINDS,all=labels.map(([k])=>Math.max(Math.abs(a[k]||0),Math.abs(b?.[k]||0),1)),max=Math.max(...all);
 return '<div class="comparison-bars">'+labels.map(([kind,name])=>{
  const v=Number(a[kind]||0),w=Number(b?.[kind]||0);
  return '<button type="button" class="loss-kind-chart" data-loss-kind="'+kind+'" title="Abrir detalhamento de '+name+'"><span class="comparison-title">'+name+'</span>'+
   '<span class="comparison-lines"><i class="meter-series meter-a" style="width:'+(Math.max(0,v)/max*100)+'%"></i>'+
   (b?'<i class="meter-series meter-b" style="width:'+(Math.max(0,w)/max*100)+'%"></i>':'')+'</span>'+
   '<strong>'+money(v)+(b?' · '+money(w):'')+'</strong></button>';
 }).join('')+'</div><p class="small muted">'+(b?'Azul: período A. Verde: período B. ':'')+'Clique em uma categoria para analisar os produtos e motivos.</p>';
}
function participationRows(){
 const c=ZAI.select(data,$('#from').value,$('#to').value,''),tot=c.salesTotal;
 return (data.metas||[]).filter(r=>r.meta_participacao!=null&&data.departamentos[r.codigo]).map(r=>{
  const sold=c.sales.filter(x=>x[2]===r.codigo).reduce((acc,x)=>acc+Number(x[4]),0);
  const realized=tot>0?sold/tot:null,goal=r.meta_participacao;
  return {code:r.codigo,name:data.departamentos[r.codigo],sold,realized,goal,delta:realized==null?null:realized-goal};
 }).sort((a,b)=>(a.delta??1)-(b.delta??1));
}
function participationComparison(limit=20){
 const list=participationRows().slice(0,limit),max=Math.max(...list.map(x=>Math.max(x.goal,x.realized||0)),.001);
 return '<div class="participation-comparison">'+list.map(r=>
  '<button type="button" class="participation-line" data-focus-dept="'+esc(r.code)+'" title="Filtrar '+esc(r.name)+'">'+
   '<span class="participation-name">'+esc(r.code+' · '+r.name)+'</span>'+
   '<span class="participation-tracks"><i class="part-goal" style="width:'+(r.goal/max*100)+'%"></i><i class="part-actual" style="width:'+((r.realized||0)/max*100)+'%"></i></span>'+
   '<span class="participation-values">Meta '+pct(r.goal)+' · Real '+pct(r.realized)+'</span>'+
   '<span class="participation-delta '+(r.delta==null?'':r.delta<0?'bad-text':'good-text')+'">'+pp(r.delta)+'</span></button>').join('')+'</div>'+
 '<p class="small muted">Azul: meta oficial de participação · Verde: realizado. Clique no departamento para filtrar. Metas fornecidas totalizam 100,10%, sem ajuste automático.</p>';
}
function lossTargetsChart(rows){
 const list=rows.filter(r=>r.target!=null&&r.sales>0).sort((a,b)=>(b.ratio??-1)-(a.ratio??-1)).slice(0,10);
 const max=Math.max(...list.map(r=>Math.max(r.ratio||0,r.target||0)),.001);
 return '<div class="participation-comparison">'+list.map(r=>'<button type="button" class="participation-line" data-focus-dept="'+esc(r.code)+'" title="Filtrar '+esc(r.name)+'">'+
  '<span class="participation-name">'+esc(r.code+' · '+r.name)+'</span>'+
  '<span class="participation-tracks"><i class="part-goal" style="width:'+(r.target/max*100)+'%"></i><i class="part-actual '+(r.ratio>r.target?'over-goal':'')+'" style="width:'+((r.ratio||0)/max*100)+'%"></i></span>'+
  '<span class="participation-values">Meta '+pct(r.target)+' · Real '+pct(r.ratio)+'</span>'+
  '<span class="participation-delta '+(r.ratio>r.target?'bad-text':'good-text')+'">'+pp(r.ratio==null?null:r.ratio-r.target)+'</span></button>').join('')+
 '</div><p class="small muted">Meta setorial × perda consolidada sobre as vendas do setor. Clique para filtrar.</p>';
}

function targetPanel(op,meta){
 const realized=op.ratio,limit=meta==null||!op.context.salesTotal?null:op.context.salesTotal*meta,delta=realized==null||meta==null?null:realized-meta,progress=realized==null||meta==null||meta===0?0:Math.min(160,realized/meta*100),ok=delta!=null&&delta<=0;
 return `<article class="card target-panel"><div class="target-head"><div><span class="section-kicker">META DE PERDAS</span><h2>Meta × realizado</h2></div><span class="status-chip ${realized==null?'neutral':ok?'good-chip':'bad-chip'}">${realized==null?'Sem base comparável':ok?'Dentro da meta':'Acima da meta'}</span></div><div class="target-values"><div><small>Meta geral</small><strong>${pct(meta)}</strong></div><div><small>Realizado consolidado</small><strong>${pct(realized)}</strong></div><div><small>Desvio</small><strong>${pp(delta)}</strong></div><div><small>Limite em R$</small><strong>${money(limit)}</strong></div></div><div class="target-track" aria-label="Atingimento da meta de perdas"><span class="${ok?'ok':'alert'}" style="width:${progress}%"></span><i style="left:100%" title="Meta"></i></div><p class="small muted">Meta aplicável ao filtro selecionado: ${pct(meta)}. Realizado = perdas consolidadas ÷ vendas do mesmo período comparável.</p></article>`;
}
function executive(){
 const from=$('#from').value,to=$('#to').value,dept=$('#dept').value,op=operationalPeriod(from,to,dept),c=op.context,meta=dept?((data.metas||[]).find(x=>x.codigo===dept)?.meta_perda??null):ZAI.lossTarget(data),rows=consolidatedDepartments(from,to,dept),cutNote=c.cut?'Comparável até '+c.cut.split('-').reverse().join('/'):'Período selecionado';
 return `<div class="kpis executive-kpis">${card('Vendas',c.sales.length?money(c.salesTotal):'—',cutNote,true)}${card('Perdas reconhecidas',money(op.recon),'Quebras operacionais')}${card('Perdas desconhecidas',money(op.a.faltas),'Faltas de estoque / inventários')}${card('Sobras de estoque',money(op.a.sobras),'Crédito de inventário')}${card('Perdas consolidadas',money(op.consolidated),'Reconhecidas + faltas − sobras',true)}${card('% consolidadas / vendas',pct(op.ratio),'Meta: '+pct(meta))}</div>
 <div class="executive-grid">${targetPanel(op,meta)}<article class="card"><div class="section-title compact"><div><span class="section-kicker">RANKING</span><h2>Perdas consolidadas por departamento</h2></div></div><p class="desc">Top departamentos por impacto financeiro no período.</p>${bars(rows.filter(r=>r.consolidated>0).slice(0,8).map(r=>[r.name,r.consolidated,money(r.consolidated)+' · '+pct(r.ratio)]),true)}</article></div>
 <div class="grid2 analytics-secondary">
 <article class="card"><div class="section-title compact"><div><span class="section-kicker">METAS SETORIAIS</span><h2>Meta × realizado por departamento</h2></div></div>${lossTargetsChart(rows)}</article>
 <article class="card"><div class="section-title compact"><div><span class="section-kicker">ORIGEM DAS QUEBRAS</span><h2>Vencidos, avariados e deteriorados</h2></div></div>${kindChart(lossKindTotals(from,to,dept))}</article></div>
 <article class="card table-section"><div class="section-title compact"><div><span class="section-kicker">VISÃO GERENCIAL</span><h2>Resumo por departamento</h2></div></div><p class="desc">Venda, perdas reconhecidas, inventário e desvio contra a meta de perdas.</p>${table(['Departamento','Vendas','Reconhecidas','Faltas','Sobras','Consolidadas','Realizado','Meta','Desvio'],rows.map(r=>[esc(r.code+' · '+r.name),money(r.sales),money(r.recon),money(r.faltas),money(r.sobras),money(r.consolidated),pct(r.ratio),pct(r.target),r.ratio==null||r.target==null?'—':pp(r.ratio-r.target)]))}</article>`;
}
function comparisonTable(rows){const meta=ZAI.lossTarget(data);return table(['Departamento','Vendas','% venda loja','Perdas','% quebra dpto','% perdas loja','Impacto na perda geral','Meta','Desvio'],rows.map(r=>[esc(r.code+' · '+r.name),money(r.sales),pct(r.salesShare),money(r.loss),r.ratio==null?'—':`<span class="tag ${(r.target??meta)==null?'':r.ratio>(r.target??meta)?'bad':'good'}">${pct(r.ratio)}</span>`,pct(r.lossShare),pct(r.storeLossImpact),r.target==null?'<span class="muted">'+pct(meta)+' geral</span>':pct(r.target),r.ratio==null?'—':pp(r.ratio-(r.target??meta))]));}
function targets(){
 const rows=participationRows();
 const valid=data?.meta_origem||'Metas configuradas para a loja';
 return '<article class="card"><div class="section-title compact"><div><span class="section-kicker">PLANEJAMENTO DE VENDAS</span><h2>Meta de participação × realizado</h2></div></div>'+
 '<p class="desc">'+esc(valid)+' · taxa percentual sobre venda total da loja.</p>'+participationComparison()+
 table(['Departamento','Venda no período','Meta %','Real %','Desvio (p.p.)','Meta diária R$'],
 rows.map(r=>[esc(r.code+' · '+r.name),money(r.sold),pct(r.goal),pct(r.realized),pp(r.delta),money(ZAI.dailyGoal(data,r.code))]))+
 '</article>';
}
function sales(){const c=context,w=ZAI.weekdays(data,c,$('#dept').value),da=departmentAnalyticsContext(),r=da.rows;
 return `<div class="kpis">${card('Faturamento',c.sales.length?money(c.salesTotal):'—','Receita no período selecionado',true)}${card('Meta de vendas',money(c.goal),num(c.days)+' dias comparáveis')}${card('Média diária',c.salesDays.size?money(c.salesTotal/c.salesDays.size):'—',num(c.salesDays.size)+' dias cobertos')}${card('Departamentos com venda',num(r.filter(x=>x.sales>0).length),'No filtro atual')}</div>
 <div class="grid2"><article class="card"><h2>Vendas por departamento</h2><p class="desc">Top 10 por faturamento no intervalo exato.</p>${bars(r.filter(x=>x.sales>0).slice(0,10).map(x=>[x.name,x.sales]))}</article><article class="card"><h2>Média por dia da semana</h2><p class="desc">Base diária do período selecionado.</p>${w.some(x=>x.days)?bars(w.map((x,i)=>[['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][i]+' · '+x.days+' dias',x.mean||0,money(x.mean)])):'<div class="notice">Sem cobertura diária suficiente para este intervalo.</div>'}</article></div>${departmentFocus(r)}<article class="card"><h2>Participação por departamento</h2><p class="desc">Venda do departamento ÷ faturamento total da loja no mesmo período.</p>${table(['Departamento','Vendas','Meta participação','Participação real','Desvio p.p.'],r.map(x=>{const goal=(data.metas||[]).find(g=>g.codigo===x.code)?.meta_participacao??null;return [esc(x.code+' · '+x.name),money(x.sales),pct(goal),pct(x.salesShare),goal==null||x.salesShare==null?'—':pp(x.salesShare-goal)]}))}</article>${targets()}
 <div class="section-title"><h2>Departamento → Produto</h2><button id="salesCsv">Exportar produtos CSV</button></div><article class="card"><div class="searchrow"><input id="productSearch" placeholder="Buscar SKU ou produto" value="${esc(productQuery)}"><select id="productStatus"><option value="">Todos os status</option><option>Ativo</option><option>Inativo</option><option>Nao informado</option></select></div><div id="products"></div></article>`;
}
function products(){
 const q=productQuery.toLocaleLowerCase('pt-BR');
 return salesProductRows.filter(x=>(!productStatus||x.status===productStatus)&&(!q||(x.sku+' '+x.produto).toLocaleLowerCase('pt-BR').includes(q))).sort((a,b)=>b.value-a.value);
}
async function loadSalesProducts(){
 if(!data||page!==2)return;
 const key=[activeStore,context.start,context.end,$('#dept').value].join('|');
 if(key===salesProductKey){renderProducts();return}
 salesProductKey=key;salesProductRows=[];salesProductLoading=true;renderProducts();
 try{
  if(cloud){
   const rows=await request('/rest/v1/rpc/zai_vendas_produtos_periodo',{p_loja:activeStore,p_de:context.start,p_ate:context.end,p_dpto:$('#dept').value||null});
   salesProductRows=(rows||[]).map(r=>({sku:String(r.sku),produto:r.produto||String(r.sku),dept:r.dpto,qty:Number(r.quantidade||0),value:Number(r.valor||0),status:r.situacao||'Nao informado'}));
  }else{
   salesProductRows=[];
  }
 }catch(e){msg('Detalhe por produto: '+e.message,true)}
 finally{salesProductLoading=false;if(page===2)renderProducts()}
}
function renderProducts(){
 if(!$('#products'))return;
 if(salesProductLoading){$('#products').innerHTML='<div class="loading-state">Carregando produtos do período…</div>';return}
 const list=products(),size=40,max=Math.max(1,Math.ceil(list.length/size));productPage=Math.min(productPage,max-1);
 $('#products').innerHTML=list.length?table(['Produto / SKU','Departamento','Situação atual','Quantidade¹','Vendas'],list.slice(productPage*size,(productPage+1)*size).map(x=>[esc(x.produto+' · '+x.sku),esc(data.departamentos[x.dept]||x.dept),esc(x.status||'Nao informado'),num(x.qty),money(x.value)]))+`<div class="actions"><button id="prevProducts" ${productPage===0?'disabled':''}>Anterior</button><span class="small">Página ${productPage+1} / ${max} · ${num(list.length)} produtos/departamentos</span><button id="nextProducts" ${productPage>=max-1?'disabled':''}>Próxima</button></div><p class="small muted">¹ Quantidade na unidade de origem de cada SKU.</p>`:'<div class="empty-inline">Sem detalhe diário por produto para este período.</div>';
 if($('#prevProducts'))$('#prevProducts').onclick=()=>{productPage--;renderProducts()};if($('#nextProducts'))$('#nextProducts').onclick=()=>{productPage++;renderProducts()}
}
function compare(){
 initComparePeriods();
 const dept=compareDept,a=operationalPeriod(compareAFrom,compareATo,dept),b=operationalPeriod(compareBFrom,compareBTo,dept),delta=b.consolidated-a.consolidated,deltaPct=a.consolidated!==0?delta/Math.abs(a.consolidated):null;
 const ad=consolidatedDepartments(compareAFrom,compareATo,dept),bd=consolidatedDepartments(compareBFrom,compareBTo,dept),map=new Map();
 for(const r of ad)map.set(r.code,{code:r.code,name:r.name,a:r.consolidated,b:0});for(const r of bd){if(!map.has(r.code))map.set(r.code,{code:r.code,name:r.name,a:0,b:0});map.get(r.code).b=r.consolidated}
 const rows=[...map.values()].map(r=>({...r,delta:r.b-r.a})).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
 const opts='<option value="">Todos os departamentos</option>'+departmentOptions(data).map(([k,v])=>`<option value="${esc(k)}" ${k===compareDept?'selected':''}>${esc(k+' · '+v)}</option>`).join('');
 return `<article class="card compare-filter"><div class="section-title compact"><div><span class="section-kicker">ANÁLISE TEMPORAL</span><h2>Comparador de períodos</h2></div></div><p class="desc">Compare qualquer intervalo de datas. A fórmula é a mesma: reconhecidas + faltas − sobras.</p><div class="compare-controls"><label>Período A · de<input id="cmpAFrom" type="date" value="${esc(compareAFrom)}"></label><label>Período A · até<input id="cmpATo" type="date" value="${esc(compareATo)}"></label><span class="compare-vs">VS</span><label>Período B · de<input id="cmpBFrom" type="date" value="${esc(compareBFrom)}"></label><label>Período B · até<input id="cmpBTo" type="date" value="${esc(compareBTo)}"></label><label>Departamento<select id="cmpDept">${opts}</select></label><button class="primary" id="compareApply">Comparar</button></div></article>
 <div class="kpis">${card('Perdas consolidadas · A',money(a.consolidated),compareAFrom+' a '+compareATo)}${card('Perdas consolidadas · B',money(b.consolidated),compareBFrom+' a '+compareBTo,true)}${card('Variação em R$',money(delta),'B − A')}${card('Variação %',pct(deltaPct),'Sobre o período A')}</div>
 <div class="grid2"><article class="card"><h2>Período A</h2>${table(['Indicador','Valor'],[['Vendas',money(a.context.salesTotal)],['Reconhecidas',money(a.recon)],['Faltas',money(a.a.faltas)],['Sobras','− '+money(a.a.sobras)],['Consolidadas',money(a.consolidated)],['% / vendas',pct(a.ratio)]])}</article><article class="card"><h2>Período B</h2>${table(['Indicador','Valor'],[['Vendas',money(b.context.salesTotal)],['Reconhecidas',money(b.recon)],['Faltas',money(b.a.faltas)],['Sobras','− '+money(b.a.sobras)],['Consolidadas',money(b.consolidated)],['% / vendas',pct(b.ratio)]])}</article></div>
 <article class="card"><div class="section-title compact"><div><span class="section-kicker">TIPOS DE QUEBRAS</span><h2>Comparação de vencidos, avariados e deteriorados</h2></div></div>${kindChart(lossKindTotals(compareAFrom,compareATo,dept),lossKindTotals(compareBFrom,compareBTo,dept))}</article>
 <article class="card"><h2>Variação por departamento</h2><p class="desc">Ordenado pelos maiores movimentos absolutos entre os dois períodos.</p>${table(['Departamento','Consolidada A','Consolidada B','Variação'],rows.map(r=>[esc(r.code+' · '+r.name),money(r.a),money(r.b),(r.delta>0?'+ ':'')+money(r.delta)]))}<div class="actions"><button id="compareCsv">Exportar comparação CSV</button></div></article>`;
}
function tradeCanonical(cat){return ['elas_por_elas','produto_por_produto','troca_produto'].includes(cat)?'troca_produto':(cat||'sem_cadastro')}
function tradeLabel(cat){cat=tradeCanonical(cat);return ({nf_devolucao:'NF / Nota de devolução',troca_produto:'Elas por elas / produto por produto',bonificacao:'Bonificação',mista:'Mista · troca / NF',sem_cadastro:'Sem regra cadastrada'})[cat]||'Outra'}
function tradeRuleMap(){return new Map((data?.trocas_fornecedores||[]).map(x=>[String(x.fornecedor_codigo||''),{...x,categoria:tradeCanonical(x.categoria)}]))}
function tradeCleanSupplier(name){return String(name||'').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\*ativo\*/gi,'').replace(/\s+/g,' ').trim()}
function tradeRuleBrand(rule){
 const code=String(rule?.fornecedor_codigo||''),override=TRADE_BRAND_OVERRIDES[code];
 if(override)return override;
 const parts=tradeRuleBrands(rule?.marca_produto);
 if(parts.length===1)return parts[0];
 return tradeCleanSupplier(rule?.fornecedor||rule?.fornecedor_referencia)||'Não cadastrada';
}
function tradeBrandFor(item,rule){
 const code=String(item?.fornecedor_codigo||rule?.fornecedor_codigo||''),prod=hnorm(item.produto||'');
 const known=[
  ['massaleve','Massaleve'],['seara','Seara'],['itambe','Itambé'],['yakult','Yakult'],
  ['serramar','Serramar'],['deliciasdaroca','Delícia da Roça'],['deliciadaroca','Delícia da Roça'],
  ['frimesa','Frimesa'],['verdecampo','Verde Campo'],['frutap','Frutap'],['xando','Xandô'],
  ['portoalegre','Porto Alegre'],['nestle','Nestlé'],['panco','Panco'],['prats','Prats'],
  ['mezzani','Mezzani'],['massabor','Massabor'],['massadafeira','Massa da Feira'],
  ['ruffles','Ruffles'],['cheetos','Cheetos'],['tostitos','Tostitos'],['fandangos','Fandangos'],
  ['lays','Lays'],['baconzitos','Baconzitos'],['torcida','Torcida'],['catupiry','Catupiry'],
  ['jamava','Jamava'],['nectarlife','Life'],['wrapkim','KIM']
 ];
 for(const [needle,label] of known)if(prod.includes(needle))return label;
 const override=TRADE_BRAND_OVERRIDES[code];
 if(override)return override;
 const raw=String(rule?.marca_produto||'').trim();
 if(raw&&raw!=='***'){
  const parts=raw.split('/').map(x=>x.trim().replace(/\.{3,}$/,'')).filter(Boolean);
  for(const p of parts){const n=hnorm(p);if(n.length>=3&&prod.includes(n))return p}
  if(parts.length===1&&!/^(somente|troca todos|todos os produtos|toda linha|iogurtes)$/i.test(parts[0]))return parts[0];
 }
 return tradeCleanSupplier(item.fornecedor||rule?.fornecedor||rule?.fornecedor_referencia)||'Não cadastrada';
}
function tradeItems(){
 const rules=tradeRuleMap();
 return (data?.trocas_itens||[]).map(x=>{
  const rule=rules.get(String(x.fornecedor_codigo||''))||{},cat=tradeCanonical(rule.categoria||x.categoria);
  return {...x,...{categoria:cat,tratativa:rule.tratativa||x.tratativa||'Sem tratativa cadastrada',forma:rule.forma||x.forma||'',fisico_virtual:rule.fisico_virtual||x.fisico_virtual||'',marca_produto:rule.marca_produto||'',marca:tradeBrandFor(x,rule)}};
 });
}
function tradeFilteredItems(){
 const q=hnorm(tradeQuery),items=tradeItems();
 return items.filter(x=>
  (!tradeSupplier||String(x.fornecedor_codigo||'')===tradeSupplier)&&
  (!tradeCategory||tradeCanonical(x.categoria)===tradeCategory)&&
  (!tradeBrand||x.marca===tradeBrand)&&
  (!q||hnorm([x.sku,x.produto,x.fornecedor,x.fornecedor_codigo,x.marca].join(' ')).includes(q))
 );
}
function tradeSupplierRows(items){
 const map=new Map(),q=hnorm(tradeQuery);
 for(const r of (data?.trocas_fornecedores||[])){
  const code=String(r.fornecedor_codigo||''),cat=tradeCanonical(r.categoria),brands=tradeRuleBrands(r.marca_produto);
  if(tradeSupplier&&code!==tradeSupplier)continue;
  if(tradeCategory&&cat!==tradeCategory)continue;
  if(tradeBrand&&!brands.includes(tradeBrand))continue;
  if(q&&!hnorm([code,r.fornecedor,r.fornecedor_referencia,r.marca_produto,r.tratativa].join(' ')).includes(q))continue;
  map.set(code,{fornecedor_codigo:code,fornecedor:r.fornecedor||r.fornecedor_referencia||'Sem nome',fornecedor_referencia:r.fornecedor_referencia||'',categoria:cat,tratativa:r.tratativa||'Sem tratativa cadastrada',forma:r.forma||'',marca_produto:r.marca_produto||'',fisico_virtual:r.fisico_virtual||'',skus:new Set(),quantidade:0,valor:0,marcas:new Set(brands)});
 }
 for(const x of items){
  const code=String(x.fornecedor_codigo||'');
  if(!map.has(code))map.set(code,{fornecedor_codigo:code,fornecedor:x.fornecedor||'Sem nome',categoria:tradeCanonical(x.categoria),tratativa:x.tratativa||'Sem tratativa cadastrada',forma:x.forma||'',marca_produto:x.marca_produto||'',fisico_virtual:x.fisico_virtual||'',skus:new Set(),quantidade:0,valor:0,marcas:new Set()});
  const a=map.get(code);a.skus.add(x.sku);a.quantidade+=Number(x.quantidade||0);a.valor+=Number(x.valor||0);if(x.marca)a.marcas.add(x.marca);
 }
 return [...map.values()].map(x=>({...x,skus:x.skus.size,marcas:[...x.marcas].sort((a,b)=>a.localeCompare(b,'pt-BR')),status_saldo:(x.valor!==0||x.quantidade!==0||x.skus.size)?'com_saldo':'zerado'})).sort((a,b)=>(b.status_saldo==='com_saldo')-(a.status_saldo==='com_saldo')||b.valor-a.valor||String(a.fornecedor).localeCompare(String(b.fornecedor),'pt-BR'));
}
function tradeRuleBrands(raw){
 return String(raw||'').split('/').map(x=>x.trim().replace(/\.{3,}$/,'')).filter(x=>x&&x!=='***'&&!/^(somente|troca todos|todos os produtos)/i.test(x));
}
function tradeBrandOptions(){
 const brands=new Set(tradeItems().map(x=>x.marca).filter(Boolean));
 for(const r of (data?.trocas_fornecedores||[])){const b=tradeRuleBrand(r);if(b&&b!=='Não cadastrada')brands.add(b)}
 return [...brands].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function tradeSupplierFocus(rows){
 if(!tradeSupplier)return '';
 const x=rows.find(r=>String(r.fornecedor_codigo)===tradeSupplier)||
   (data?.trocas_fornecedores||[]).find(r=>String(r.fornecedor_codigo||'')===tradeSupplier);
 if(!x)return '';
 const cat=tradeCanonical(x.categoria),brand=(x.marcas||[]).join(', ')||tradeRuleBrand(x),line=x.marca_produto&&x.marca_produto!=='***'?x.marca_produto:'Linha/produtos pendentes';
 return `<article class="card supplier-focus"><div class="supplier-focus-head"><div><span class="section-kicker">FORNECEDOR 360</span><h2>${esc((x.fornecedor_codigo||'—')+' · '+(x.fornecedor||x.fornecedor_referencia||'Sem nome'))}</h2><p class="desc">Tudo que está em troca para este fornecedor, com a regra operacional usada para orientar o vendedor/comprador.</p></div><span class="trade-tag ${esc(cat)}">${esc(tradeLabel(cat))}</span></div><div class="supplier-meta"><div><small>Regra original</small><strong>${esc(x.tratativa||'Sem cadastro')}</strong></div><div><small>Marca</small><strong>${esc(brand)}</strong></div><div><small>Linha / produtos</small><strong>${esc(line)}</strong></div><div><small>Como resolver</small><strong>${esc(x.forma||'Não informado')}</strong></div><div><small>Físico / descarte</small><strong>${esc(x.fisico_virtual||'Não informado')}</strong></div><div><small>SKUs no filtro</small><strong>${num(Number(x.skus||0))}</strong></div><div><small>Valor no filtro</small><strong>${money(Number(x.valor||0))}</strong></div></div></article>`;
}
function tradePage(){
 const all=tradeItems(),items=tradeFilteredItems(),rows=tradeSupplierRows(items),t=data?.trocas_resumo||{},value=items.reduce((a,x)=>a+Number(x.valor||0),0),qty=items.reduce((a,x)=>a+Number(x.quantidade||0),0),skus=new Set(items.map(x=>x.sku)).size,withStock=rows.filter(x=>x.status_saldo==='com_saldo').length,zeroSuppliers=rows.filter(x=>x.status_saldo==='zerado').length;
 const sumCat=c=>items.filter(x=>tradeCanonical(x.categoria)===c).reduce((a,x)=>a+Number(x.valor||0),0),nf=sumCat('nf_devolucao'),troca=sumCat('troca_produto'),bonif=sumCat('bonificacao'),mista=sumCat('mista'),sem=sumCat('sem_cadastro');
 const supplierOptions=(data?.trocas_fornecedores||[]).slice().sort((a,b)=>String(a.fornecedor||'').localeCompare(String(b.fornecedor||''),'pt-BR')).map(x=>`<option value="${esc(x.fornecedor_codigo||'')}" ${String(x.fornecedor_codigo||'')===tradeSupplier?'selected':''}>${esc((x.fornecedor_codigo||'—')+' · '+(x.fornecedor||'Sem nome'))}</option>`).join('');
 const brandOptions=tradeBrandOptions().map(x=>`<option ${x===tradeBrand?'selected':''}>${esc(x)}</option>`).join('');
 const missing=(data?.trocas_fornecedores||[]).filter(x=>tradeCanonical(x.categoria)==='sem_cadastro'),brandMissing=(data?.trocas_fornecedores||[]).filter(x=>tradeCanonical(x.categoria)!=='sem_cadastro'&&(!x.marca_produto||String(x.marca_produto).trim()==='***')),actionMissing=(data?.trocas_fornecedores||[]).filter(x=>tradeCanonical(x.categoria)!=='sem_cadastro'&&(!x.forma||!String(x.forma).trim()));
 const filtered=Boolean(tradeSupplier||tradeCategory||tradeBrand||tradeQuery);
 const focus=tradeSupplierFocus(rows);
 return `<article class="card trade-toolbar"><div class="section-title compact"><div><span class="section-kicker">CENTRAL DE TROCAS</span><h2>Fornecedor, tratativa e itens em uma única área</h2></div><span class="date-chip">Posição: ${esc(t.data_referencia||'—')}</span></div><p class="desc">Filtre por fornecedor, tratativa ou marca/linha. Todos os indicadores, tabelas e o CSV respeitam o recorte selecionado.</p><div class="trade-filters"><label>Fornecedor<select id="tradeSupplier"><option value="">Todos os fornecedores</option>${supplierOptions}</select></label><label>Tratativa<select id="tradeCategory"><option value="">Todas as tratativas</option><option value="nf_devolucao" ${tradeCategory==='nf_devolucao'?'selected':''}>NF / Nota de devolução</option><option value="troca_produto" ${tradeCategory==='troca_produto'?'selected':''}>Elas por elas / Produto por produto</option><option value="bonificacao" ${tradeCategory==='bonificacao'?'selected':''}>Bonificação</option><option value="mista" ${tradeCategory==='mista'?'selected':''}>Mista · troca / NF</option><option value="sem_cadastro" ${tradeCategory==='sem_cadastro'?'selected':''}>Sem regra cadastrada</option></select></label><label>Marca / linha<select id="tradeBrand"><option value="">Todas as marcas</option>${brandOptions}</select></label><label class="trade-search">SKU / produto / fornecedor<input id="tradeQuery" value="${esc(tradeQuery)}" placeholder="Buscar..."></label><div class="trade-filter-actions"><button id="tradeApply">Aplicar</button><button id="tradeReset" ${filtered?'':'disabled'}>Limpar</button><button class="primary" id="tradeCsv">↓ CSV para vendedor</button></div></div></article>
 <div class="kpis trade-kpis">${card(filtered?'Posição filtrada':'Posição atual',money(value),num(skus)+' SKUs · '+num(withStock)+' fornecedores com saldo',true)}${card('NF / Nota devolução',money(nf),'Tratativas fiscais')}${card('Elas por elas / Produto por produto',money(troca),'Elas por elas + produto por produto')}${card('Fornecedores zerados',num(zeroSuppliers),'Continuam visíveis para acompanhamento')}${card('Sem regra cadastrada',money(sem),missing.length+' fornecedores para completar')}</div>
 <div class="trade-summary"><article class="card"><div class="section-title compact"><div><span class="section-kicker">FORNECEDORES</span><h2>Onde está concentrado o estoque de troca</h2></div></div>${bars(rows.slice(0,8).map(x=>[x.fornecedor,x.valor,money(x.valor)]))}</article><article class="card"><div class="section-title compact"><div><span class="section-kicker">TRATATIVAS</span><h2>Composição do recorte</h2></div></div>${bars([['NF / Nota de devolução',nf,money(nf)],['Elas por elas / Produto por produto',troca,money(troca)],['Bonificação',bonif,money(bonif)],['Mista',mista,money(mista)],['Sem regra',sem,money(sem)]].filter(x=>x[1]>0))}</article></div>
 ${missing.length||brandMissing.length||actionMissing.length?`<article class="card trade-pending"><div class="section-title compact"><div><span class="section-kicker">CADASTRO</span><h2>Informações que ainda precisamos completar</h2></div></div>${missing.length?'<div class="notice error"><b>'+missing.length+' fornecedores da posição atual não possuem regra vinculada.</b><br>'+missing.map(x=>esc((x.fornecedor_codigo||'—')+' · '+(x.fornecedor||'Sem nome'))).join(' · ')+'</div>':''}${brandMissing.length?'<div class="notice"><b>Marca/linha incompleta:</b> '+brandMissing.map(x=>esc((x.fornecedor_codigo||'—')+' · '+(x.fornecedor||'Sem nome'))).join(' · ')+'</div>':''}${actionMissing.length?'<div class="notice"><b>Como resolver ainda não informado:</b> '+actionMissing.map(x=>esc((x.fornecedor_codigo||'—')+' · '+(x.fornecedor||x.fornecedor_referencia||'Sem nome'))).join(' · ')+'</div>':''}<p class="small muted">Não vinculamos códigos diferentes por semelhança de nome. Isso evita aplicar uma tratativa errada a um fornecedor novo.</p></article>`:''}
 ${focus}
 <article class="card table-section trade-suppliers"><div class="section-title compact"><div><span class="section-kicker">FORNECEDORES</span><h2>Posição por fornecedor</h2></div><span class="trade-context">${num(rows.length)} no recorte</span></div>${table(['Fornecedor','Status','Tratativa padrão','Regra original','Marca','Linha / produtos','Como resolver','Físico / descarte','SKUs','Qtde','Valor'],rows.map(x=>[esc((x.fornecedor_codigo||'—')+' · '+x.fornecedor),x.status_saldo==='zerado'?'<span class="status-chip neutral">Zerado</span>':'<span class="status-chip good-chip">Com saldo</span>','<span class="trade-tag '+esc(x.categoria)+'">'+esc(tradeLabel(x.categoria))+'</span>','<span class="wrap-cell">'+esc(x.tratativa||'—')+'</span>','<span class="wrap-cell">'+esc((x.marcas||[]).join(', ')||tradeRuleBrand(x)||'—')+'</span>','<span class="wrap-cell">'+esc(x.marca_produto||'—')+'</span>','<span class="wrap-cell">'+esc(x.forma||'—')+'</span>','<span class="wrap-cell">'+esc(x.fisico_virtual||'—')+'</span>',num(x.skus),num(x.quantidade),money(x.valor)]))}</article>
 <article class="card table-section trade-items"><div class="section-title compact"><div><span class="section-kicker">ITENS PARA AÇÃO</span><h2>Produtos em estoque para troca</h2></div><span class="trade-context">${num(items.length)} linhas · ${money(value)}</span></div><p class="desc">A lista abaixo é a base do CSV para enviar ao vendedor/comprador. Ao filtrar um fornecedor ou uma marca, o arquivo exportado leva somente esse recorte.</p>${table(['Marca / linha','SKU / Produto','Departamento','Fornecedor','Tratativa','Curva','Quantidade','Valor'],items.map(x=>[esc(x.marca||'—'),esc(x.sku+' · '+x.produto),esc(data.departamentos[x.dpto]||x.dpto),esc(x.fornecedor||'—'),esc(tradeLabel(x.categoria)),esc(x.curva||'—'),num(Number(x.quantidade||0)),money(Number(x.valor||0))]))}</article>`;
}
function bindTradePage(){
 if(!$('#tradeSupplier'))return;
 $('#tradeSupplier').onchange=e=>{tradeSupplier=e.target.value;tradeBrand='';render()};
 $('#tradeCategory').onchange=e=>{tradeCategory=e.target.value;render()};
 $('#tradeBrand').onchange=e=>{tradeBrand=e.target.value;render()};
 $('#tradeApply').onclick=()=>{tradeQuery=$('#tradeQuery').value.trim();render()};
 $('#tradeQuery').onkeydown=e=>{if(e.key==='Enter'){tradeQuery=e.target.value.trim();render()}};
 $('#tradeReset').onclick=()=>{tradeSupplier='';tradeCategory='';tradeBrand='';tradeQuery='';render()};
 $('#tradeCsv').onclick=()=>{
  const rows=tradeFilteredItems(),date=data?.trocas_resumo?.data_referencia||new Date().toISOString().slice(0,10);
  csv('trocas_'+activeStore+'_'+date+(tradeSupplier?'_fornecedor_'+tradeSupplier:'')+'.csv',
   ['Loja','Data posição','Cód. fornecedor','Fornecedor','Marca','Linha / produtos','Tratativa padrão','Regra original','Como resolver','Físico / descarte','SKU','Produto','Departamento','Curva','Quantidade','Valor'],
   rows.map(x=>[activeStore,date,x.fornecedor_codigo||'',x.fornecedor||'',x.marca||'',x.marca_produto||'',tradeLabel(x.categoria),x.tratativa||'',x.forma||'',x.fisico_virtual||'',x.sku,x.produto,data.departamentos[x.dpto]||x.dpto,x.curva||'',String(Number(x.quantidade||0)).replace('.',','),Number(x.valor||0).toFixed(2).replace('.',',')]));
 };
}
function future(){
 if(page===4)return audits();
 if(page===5){const op=operationalPeriod($('#from').value,$('#to').value,$('#dept').value),meta=$('#dept').value?((data.metas||[]).find(x=>x.codigo===$('#dept').value)?.meta_perda??null):ZAI.lossTarget(data);return `<div class="kpis">${card('Perdas reconhecidas',money(op.recon),num(op.context.loss.length)+' lançamentos')}${card('Perdas desconhecidas',money(op.a.faltas),'Faltas de estoque')}${card('Sobras de estoque',money(op.a.sobras),'Compensação de inventário')}${card('Perdas consolidadas',money(op.consolidated),'Reconhecidas + faltas − sobras',true)}${card('% consolidadas / vendas',op.ratio==null?'—':pct(op.ratio),'Meta: '+pct(meta))}</div>${targetPanel(op,meta)}`;}
 if(page===6)return tradePage();
 return '';
}
function exchange(){return `<div class="grid2"><article class="card"><h2>Central de importações</h2><p class="desc">Atualize cada operação pelo seu próprio tipo de relatório. A Loja selecionada é aplicada à carga e toda gravação exige prévia e confirmação.</p><label>Tipo de relatório <span aria-hidden="true">*</span><select id="reportType" required><option value="">Selecione antes de escolher o arquivo</option><option value="perdas">Perdas</option><option value="vendas">Vendas</option><option value="auditorias_estoque">Auditorias de estoque · Entradas + Saídas</option><option value="trocas">Trocas · saldo atual</option></select></label><div id="typeGuide" class="notice info">Selecione o tipo de relatório para ver a regra de atualização.</div><div id="modeWrap"><label>Tipo de atualização<select id="importMode"><option value="complementar">Complementar · preserva registros existentes</option><option value="substituir_dias">Relatório completo · substituir dias presentes</option></select></label></div><div class="upload"><label>Selecionar arquivo do ERP<input id="lossFile" type="file" accept=".xlsx,.xls,.csv,.json" disabled></label><p class="small muted">Perdas: Excel/JSON Kalimera. Vendas: Excel horizontal do ERP ou formato normalizado. Auditorias: um único Excel com Entradas (sobras) + Saídas (faltas). Trocas: Excel de posição atual.</p></div>${!cloud?'<p class="notice">Conecte o Supabase para gravar. A conferência local não atualiza a nuvem.</p>':data?.papel!=='importador'?'<p class="notice">Esta conta possui acesso somente leitura.</p>':''}<div id="importPreview"></div><p class="small muted">Vendas substituem somente os dias presentes. Auditorias são sempre complementares: novos movimentos são adicionados sem apagar dias anteriores, com bloqueio de duplicidade. Trocas sempre substitui a posição inteira. O histórico de importações permanece auditável.</p></article>
 <article class="card"><h2>Exportar e conferir</h2><p class="desc">A exportação analítica inclui perdas, resumos de vendas, cadastro e metas. O detalhe diário completo permanece no Supabase.</p><div class="actions"><button id="backup" ${!data?'disabled':''}>Exportar base analítica JSON</button><button id="goalsCsv" ${!data?'disabled':''}>Exportar metas CSV</button></div><div class="upload"><label>Abrir base para conferência local<input id="localFile" type="file" accept=".json"></label><p class="small muted">A conferência local não grava no banco.</p></div><p class="small"><b>Fluxo atual:</b> ERP → Excel → validação no Z-AI → Supabase. Não depende de acesso direto ao PostgreSQL do ERP.</p></article></div>
 <article class="card"><h2>Histórico de importações</h2><p class="desc">${cloud?'Registros persistidos no Supabase':'Histórico incluído no arquivo de conferência'}</p>${table(['Arquivo','Quando','Registros','Valor','Tipo'],(data?.historico||[]).map(r=>[esc(r.file||''),esc(r.when?new Date(r.when).toLocaleString('pt-BR'):''),num(r.rows||0),money(r.value||0),esc(r.tipo||'Backup histórico')]))}</article>`;}
function empty(){return `<article class="card empty"><span class="number">Z</span><h2>Seu painel, conectado às suas lojas</h2><p>Entre na conta do Supabase para consultar os dados salvos. Para conferir esta versão antes da ativação, abra <b>data/base_conferida.json</b> no menu Importar e Exportar.</p><div class="actions" style="justify-content:center"><button class="primary" id="emptyLogin">Conectar Supabase</button><button id="emptyLocal">Abrir base de conferência</button></div></article>`;}
function render(){
 $('#nav').innerHTML=names.map((n,i)=>`<button data-page="${i}" class="${page===i?'active':''}" title="${esc(n)}" aria-label="${esc(n)}" aria-current="${page===i?'page':'false'}"><span class="navicon" aria-hidden="true">${navIcons[i]}</span><span class="navlabel">${n}</span></button>`).join('');$('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{page=+b.dataset.page;msg('');render()});
 $('#pageTitle').textContent=names[page];$('.subtitle').textContent=subtitles[page]||'Dashboard Executivo';$('#filters').hidden=!data||page===3||page===6||page===7;$('#coverage').innerHTML='';$('#stamp').textContent='Consultado em '+new Date().toLocaleString('pt-BR');
 if(data&&[0,1,2,4,5].includes(page)){let from=$('#from').value,to=$('#to').value;if(!from||!to||from>to){msg('Informe datas válidas, com início anterior ao fim.',true);return}context=ZAI.select(data,from,to,$('#dept').value);$('#periodNote').textContent=context.days+' dias no período · '+(context.sources.length?context.sources.join(' / '):'vendas não disponíveis');
 const notices=[];if(context.cut)notices.push('Indicadores comparáveis até '+context.cut.split('-').reverse().join('/')+'.');if(context.unmatchedLossCount)notices.push(num(context.unmatchedLossCount)+' lançamentos posteriores às vendas continuam visíveis em Perdas Reconhecidas.');if(context.missing.length)notices.push('Sem venda diária completa em '+context.missing.join(', ')+'.');if(!context.comparable&&!context.missing.length)notices.push('O percentual exige cobertura compatível entre vendas e perdas.');
 $('#coverage').innerHTML=notices.length?`<div class="notice coverage-summary">${notices.map(esc).join(' · ')}</div>`:'';
 }
 $('#content').innerHTML=page===7?exchange():!data?empty():page===0?executive():page===1?losses():page===2?sales():page===3?compare():future();
 if($('#emptyLogin'))$('#emptyLogin').onclick=()=>$('#login').showModal();if($('#emptyLocal'))$('#emptyLocal').onclick=()=>{page=7;render();$('#localFile').click()};
 document.querySelectorAll('[data-focus-dept]').forEach(el=>el.onclick=()=>{$('#dept').value=el.dataset.focusDept;page=0;render()});
 document.querySelectorAll('[data-loss-kind]').forEach(el=>el.onclick=()=>{lossKind=el.dataset.lossKind;page=1;render()});
 if(page===1&&data)bindLossGrid();
 if(page===4&&data)bindAuditPage();
 if(page===2&&data){$('#productStatus').value=productStatus;renderProducts();loadSalesProducts();$('#productSearch').oninput=e=>{productQuery=e.target.value;productPage=0;renderProducts()};$('#productStatus').onchange=e=>{productStatus=e.target.value;productPage=0;renderProducts()};$('#salesCsv').onclick=()=>csv('vendas_produtos_'+activeStore+'.csv',['Loja','SKU','Produto','Departamento','Quantidade origem','Vendas'],products().map(x=>[activeStore,x.sku,x.produto,x.dept,String(x.qty).replace('.',','),x.value.toFixed(2).replace('.',',')]))}
 if(page===6&&data)bindTradePage();
 if(page===3&&data){$('#compareApply').onclick=()=>{compareAFrom=$('#cmpAFrom').value;compareATo=$('#cmpATo').value;compareBFrom=$('#cmpBFrom').value;compareBTo=$('#cmpBTo').value;compareDept=$('#cmpDept').value;if(!compareAFrom||!compareATo||!compareBFrom||!compareBTo||compareAFrom>compareATo||compareBFrom>compareBTo){msg('Informe períodos válidos para A e B.',true);return}msg('');render()};$('#compareCsv').onclick=()=>{const a=consolidatedDepartments(compareAFrom,compareATo,compareDept),b=consolidatedDepartments(compareBFrom,compareBTo,compareDept),map=new Map();for(const r of a)map.set(r.code,{code:r.code,name:r.name,a:r.consolidated,b:0});for(const r of b){if(!map.has(r.code))map.set(r.code,{code:r.code,name:r.name,a:0,b:0});map.get(r.code).b=r.consolidated}csv('comparacao_periodos_'+activeStore+'.csv',['Departamento','Consolidada A','Consolidada B','Variação B-A'],[...map.values()].map(r=>[r.code+' · '+r.name,String(r.a).replace('.',','),String(r.b).replace('.',','),String(r.b-r.a).replace('.',',')]))}};
 if(page===7){$('#localFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const d=JSON.parse(await f.text());setData(d,false);msg('Arquivo aberto para conferência. Nenhum dado foi enviado ao banco.')}catch(e){msg(e.message,true)}};$('#backup').onclick=()=>download('Base_Analitica_ZAI_'+activeStore+'_' +new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data));$('#goalsCsv').onclick=()=>csv('metas_'+activeStore+'.csv',['Departamento','Participação %','Meta diaria R$','Meta perdas %'],(data.metas||[]).map(r=>[r.descricao,(r.participacao*100).toFixed(2).replace('.',','),ZAI.dailyGoal(data,r.codigo)==null?'':ZAI.dailyGoal(data,r.codigo).toFixed(2).replace('.',','),r.meta_perda==null?'':(r.meta_perda*100).toFixed(2).replace('.',',')]));$('#lossFile').onchange=e=>previewByType(e.target.files[0]);bindImportType();$('#importMode').onchange=()=>{pending=null;$('#lossFile').value='';$('#importPreview').innerHTML='Selecione novamente o arquivo para conferir este modo.'}}
}

const IMPORT_GUIDES={
 perdas:'Perdas reconhecidas · aceita o JSON completo do Kalimera ou Excel operacional. O backup completo deve ser importado como relatório completo, substituindo os dias presentes.',
 vendas:'Vendas diárias · aceita o relatório horizontal do ERP: cada data possui Vendas, Quantidade e Ct Empresa. O Dashboard usa Vendas e Quantidade e substitui somente os dias presentes.',
 auditorias_estoque:'Auditorias de estoque · importe Entradas e Saídas juntas no mesmo arquivo. Entradas = SOBRAS; Saídas = FALTAS. A atualização é complementar: adiciona novos movimentos e nunca apaga dias anteriores. Se o arquivo ou lançamentos já existirem, a gravação é bloqueada para evitar duplicidade.',
 trocas:'Trocas = posição atual de estoque. Cada importação substitui integralmente a posição anterior; snapshots antigos ficam apenas no histórico.'
};
function bindImportType(){
 const type=$('#reportType').value,file=$('#lossFile'),mode=$('#importMode'),wrap=$('#modeWrap'),guide=$('#typeGuide');
 pending=null;$('#importPreview').innerHTML='';
 const enabled=['perdas','vendas','auditorias_estoque','trocas'].includes(type);
 guide.textContent=IMPORT_GUIDES[type]||'Selecione o tipo de relatório para ver a regra de atualização.';
 mode.disabled=type!=='perdas';wrap.hidden=type!=='perdas';
 if(type==='vendas')mode.value='substituir_dias';
 file.accept=type==='perdas'?'.xlsx,.xls,.json':'.xlsx,.xls,.csv';
 file.disabled=!enabled||!cloud||data?.papel!=='importador';
 file.value='';
 $('#reportType').onchange=bindImportType;
}
const hnorm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function colIndex(head,...opts){for(const o of opts){const i=head.indexOf(o);if(i>=0)return i}return null}
function numeric(v){
 if(v===null||v===undefined||v==='')throw Error('Quantidade/valor ausente; nenhum zero foi inventado.');
 if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Número inválido.');return v}
 let s=String(v).trim().replace(/R\$/gi,'').replace(/\s/g,'');
 if(!s)throw Error('Quantidade/valor ausente.');
 if(s.includes(',')&&s.includes('.')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}
 else if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 const n=Number(s);if(!Number.isFinite(n))throw Error('Número inválido: '+v);return n;
}
function isoDate(v){
 const pad=n=>String(n).padStart(2,'0');
 if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+pad(v.getMonth()+1)+'-'+pad(v.getDate());
 if(typeof v==='number'&&window.XLSX?.SSF?.parse_date_code){const d=window.XLSX.SSF.parse_date_code(v);if(d)return d.y+'-'+pad(d.m)+'-'+pad(d.d)}
 const s=String(v??'').trim(),ymd=s.match(/^(\d{4})-(\d{2})-(\d{2})/),dmy=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
 if(ymd)return ymd[1]+'-'+ymd[2]+'-'+ymd[3];if(dmy)return dmy[3]+'-'+dmy[2]+'-'+dmy[1];
 throw Error('Data inválida: '+s);
}
function skuText(v){const s=typeof v==='number'&&Number.isInteger(v)?String(v):String(v??'').trim().replace(/\.0+$/,'');return s}
function deptCode(raw,desc){
 let code='';
 if(raw!==null&&raw!==undefined&&String(raw).trim()!==''){const m=String(raw).match(/\d+/);if(m)code=m[0].padStart(3,'0')}
 if(!code&&desc!==null&&desc!==undefined){const target=hnorm(desc);code=Object.entries(data.departamentos).find(([,v])=>hnorm(v)===target)?.[0]||''}
 if(!code||!data.departamentos[code])throw Error('Departamento não cadastrado: '+String(desc??raw??''));
 return code;
}
async function matrixFrom(file){
 if(!window.XLSX)throw Error('Leitor de Excel não carregado. Atualize a página e tente novamente.');
 const ab=await file.arrayBuffer(),wb=window.XLSX.read(ab,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]];
 return window.XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
}
function findHeader(matrix,test){for(let i=0;i<Math.min(15,matrix.length);i++){const h=(matrix[i]||[]).map(hnorm);if(test(h))return [i,h]}throw Error('Cabeçalho do relatório não reconhecido.')}
async function hashFile(file){const b=await file.arrayBuffer(),d=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function parseLossFile(file){
 if(file.name.toLowerCase().endsWith('.json')){
  const d=JSON.parse(await file.text());
  if(d.schema==='kalimera-pp-007-v1'&&Array.isArray(d.rows)){
   const rows=d.rows.map((r,i)=>({
    data:isoDate(r.data),sku:skuText(r.sku),produto:String(r.produto??'').trim(),
    dpto:deptCode(r.dpto,r.departamento),motivo:String(r.motivo??'').trim(),
    qtde:numeric(r.qtde),valor:numeric(r.valor)
   }));
   if(rows.some((r,i)=>!/^[0-9]+$/.test(r.sku)||!r.produto||!r.motivo))throw Error('JSON Kalimera possui linha inválida.');
   return {rows,note:'Backup completo Kalimera. Use “Relatório completo” para atualizar todos os dias presentes no arquivo.'};
  }
  return {rows:ZAI.validateLossImport(d,data),note:''};
 }
 const m=await matrixFrom(file),[hi,head]=findHeader(m,h=>h.includes('codigo')&&(h.includes('dtmvto')||h.includes('data')));
 const f={data:colIndex(head,'dtmvto','data','datamovimento'),sku:colIndex(head,'codigo','sku','codproduto','codigoproduto'),produto:colIndex(head,'descricao','produto','descricaoproduto'),dpto:colIndex(head,'dpto','codigodepartamento','departamentocodigo'),departamento:colIndex(head,'descricaodpto','departamento','descricaodepartamento'),motivo:colIndex(head,'descricaoespecie','motivo'),qtde:colIndex(head,'qtde','quantidade'),valor:colIndex(head,'valor')};
 let ct=false;if(f.valor===null){f.valor=colIndex(head,'ctmedio','customedio');ct=f.valor!==null}
 for(const k of ['data','sku','produto','motivo','qtde','valor'])if(f[k]===null)throw Error('Coluna obrigatória ausente: '+k);
 const rows=[];let footer=null;
 for(let i=hi+1;i<m.length;i++){const r=m[i]||[];if(!r.some(x=>x!==null&&x!==''))continue;const rawSku=r[f.sku],rawData=r[f.data],rawProd=r[f.produto];
  if((rawSku===null||rawSku===''||rawSku===0)&&!rawData&&!rawProd){if(r[f.valor]!==null&&r[f.valor]!=='')footer=numeric(r[f.valor]);continue}
  if(String(rawSku??'').trim().toLowerCase().startsWith('total')&&!rawData){if(r[f.valor]!==null&&r[f.valor]!=='')footer=numeric(r[f.valor]);continue}
  const sku=skuText(rawSku);if(!/^\d+$/.test(sku))throw Error('Linha '+(i+1)+': SKU inválido '+String(rawSku));
  const produto=String(rawProd??'').trim(),motivo=String(r[f.motivo]??'').trim();if(!produto||!motivo)throw Error('Linha '+(i+1)+': produto/motivo ausente.');
  rows.push({data:isoDate(rawData),sku,produto,dpto:deptCode(f.dpto===null?null:r[f.dpto],f.departamento===null?null:r[f.departamento]),motivo,qtde:numeric(r[f.qtde]),valor:numeric(r[f.valor])});
 }
 if(!rows.length)throw Error('Nenhuma linha válida de perdas.');
 const total=rows.reduce((s,r)=>s+r.valor,0);if(footer!==null&&Math.abs(total-footer)>.01)throw Error('Total das linhas diverge do rodapé do relatório.');
 return {rows,note:ct?'Ct Médio foi interpretado como valor total da linha, conforme o layout piloto validado.':''};
}
async function parseSalesFile(file){
 const m=await matrixFrom(file);
 const h1=(m[0]||[]).map(x=>String(x??'').trim()),h2=(m[1]||[]).map(hnorm);
 const horizontal=h1.slice(6).some(x=>/^\d{2}\/\d{2}\/\d{4}/.test(x))&&h2.slice(6).includes('vendas')&&h2.slice(6).includes('quantidade');
 if(horizontal){
  const agg=new Map(),dates=[],source=0,descBySku=new Map();
  const dateCols=[];
  for(let c=6;c<h1.length;c++){
   const mm=h1[c].match(/^(\d{2})\/(\d{2})\/(\d{4})/);
   if(mm&&h2[c]==='vendas'){
    const dt=mm[3]+'-'+mm[2]+'-'+mm[1],qCol=c+1;
    if(h2[qCol]!=='quantidade')throw Error('Layout horizontal inválido próximo de '+h1[c]+'.');
    dateCols.push({dt,vCol:c,qCol});dates.push(dt);
   }
  }
  for(let i=2;i<m.length;i++){
   const r=m[i]||[],sku=skuText(r[0]);
   if(!/^\d+$/.test(sku))continue;
   const produto=String(r[1]??'').trim()||(data.produtos[sku]?.[0]||'');
   if(!produto)throw Error('Linha '+(i+1)+': descrição do produto ausente.');
   if(descBySku.has(sku)&&descBySku.get(sku)!==produto)throw Error('Descrições conflitantes para o SKU '+sku+'.');
   descBySku.set(sku,produto);
   const dpto=deptCode(r[3],null);
   for(const dc of dateCols){
    const v=Number(r[dc.vCol]??0),q=Number(r[dc.qCol]??0);
    if(!Number.isFinite(v)||!Number.isFinite(q))throw Error('Linha '+(i+1)+': valor/quantidade inválidos.');
    if(v===0&&q===0)continue;
    const key=dc.dt+'|'+sku+'|'+dpto;
    if(!agg.has(key))agg.set(key,{data:dc.dt,sku,produto,dpto,qtde:0,valor:0});
    const x=agg.get(key);x.qtde+=q;x.valor+=v;source++;
   }
  }
  const rows=[...agg.values()];if(!rows.length)throw Error('Nenhuma venda encontrada no relatório horizontal.');
  return {rows,dates:[...new Set(dates)].sort(),source};
 }
 const [hi,head]=findHeader(m,h=>{
  const hasSku=h.some(x=>['codigo','sku','codproduto','codigoproduto'].includes(x)),hasDate=h.some(x=>['data','datavenda','dtvenda','dtmvto','datamovimento'].includes(x)),hasQty=h.some(x=>['qtde','quantidade','qtdevendas','quantidadevendida'].includes(x)),hasValue=h.some(x=>['valor','valorvendas','valordevendas','vendaliquida','valorvenda'].includes(x));return hasSku&&hasDate&&hasQty&&hasValue;
 });
 const f={loja:colIndex(head,'loja','codigoloja','codloja'),data:colIndex(head,'data','datavenda','dtvenda','dtmvto','datamovimento'),sku:colIndex(head,'codigo','sku','codproduto','codigoproduto'),produto:colIndex(head,'descricao','produto','descricaoproduto'),dpto:colIndex(head,'dpto','codigodepartamento','departamentocodigo','coddepartamento','depto'),departamento:colIndex(head,'descricaodpto','departamento','descricaodepartamento'),qtde:colIndex(head,'qtde','quantidade','qtdevendas','quantidadevendida'),valor:colIndex(head,'valor','valorvendas','valordevendas','vendaliquida','valorvenda')};
 for(const k of ['data','sku','qtde','valor'])if(f[k]===null)throw Error('Coluna obrigatória ausente em vendas: '+k);
 if(f.dpto===null&&f.departamento===null)throw Error('Vendas precisam informar código ou descrição do departamento.');
 const agg=new Map(),descBySku=new Map();let source=0;
 for(let i=hi+1;i<m.length;i++){const r=m[i]||[];if(!r.some(x=>x!==null&&x!==''))continue;const rawSku=r[f.sku],rawDate=r[f.data];
  if((rawSku===null||rawSku===''||String(rawSku).toLowerCase().startsWith('total'))&&!rawDate)continue;
  const sku=skuText(rawSku);if(!/^\d+$/.test(sku))throw Error('Linha '+(i+1)+': SKU inválido '+String(rawSku));
  let loja=activeStore;if(f.loja!==null&&r[f.loja]!==null&&r[f.loja]!==''){const mm=String(r[f.loja]).match(/\d+/);loja=mm?mm[0].padStart(3,'0'):''}if(loja!==activeStore)throw Error('Linha '+(i+1)+': arquivo pertence à loja '+loja+', mas a loja selecionada é '+activeStore+'.');
  const produto=String(f.produto===null?'':r[f.produto]??'').trim()||(data.produtos[sku]?.[0]||'');if(!produto)throw Error('Linha '+(i+1)+': descrição do produto ausente e SKU não existe no cadastro.');
  if(descBySku.has(sku)&&descBySku.get(sku)!==produto)throw Error('Descrições conflitantes para o SKU '+sku+'.');descBySku.set(sku,produto);
  const dt=isoDate(rawDate),dpto=deptCode(f.dpto===null?null:r[f.dpto],f.departamento===null?null:r[f.departamento]),q=numeric(r[f.qtde]),v=numeric(r[f.valor]),key=dt+'|'+sku+'|'+dpto;
  if(!agg.has(key))agg.set(key,{data:dt,sku,produto,dpto,qtde:0,valor:0});const x=agg.get(key);x.qtde+=q;x.valor+=v;source++;
 }
 const rows=[...agg.values()];if(!rows.length)throw Error('Nenhuma linha válida de vendas.');
 const dates=[...new Set(rows.map(r=>r.data))].sort();return {rows,dates,source};
}
function filenameDate(name){
 const m=String(name).match(/(?:^|\D)(\d{1,2})[-_](\d{1,2})(?:\D|$)/);
 if(!m)return null;return new Date().getFullYear()+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0');
}
async function parseAuditFile(file){
 const m=await matrixFrom(file),[hi,head]=findHeader(m,h=>h.includes('dpto')&&h.includes('codigo')&&h.includes('dtmvto')&&h.includes('descricaodcto')&&h.includes('qtde')&&h.includes('valor'));
 const f={dpto:colIndex(head,'dpto'),departamento:colIndex(head,'descricaodpto'),sku:colIndex(head,'codigo'),produto:colIndex(head,'descricao'),data:colIndex(head,'dtmvto'),documento:colIndex(head,'descricaodcto'),observacao:colIndex(head,'descricaoespecie'),fornecedor:colIndex(head,'fornecedor','nomefornecedor','nomeforn','nomeultimoforn'),qtde:colIndex(head,'qtde'),valor:colIndex(head,'valor')};
 const rows=[];let ignored=0;
 for(let i=hi+1;i<m.length;i++){
  const r=m[i]||[],doc=String(r[f.documento]??'').trim(),rowType=/entradas/i.test(doc)?'entrada':/sa[ií]das/i.test(doc)?'saida':null;
  if(!rowType){if(r.some(x=>x!==null&&x!==''))ignored++;continue}
  const sku=skuText(r[f.sku]);if(!/^\d+$/.test(sku))continue;
  const produto=String(r[f.produto]??'').trim();if(!produto)throw Error('Linha '+(i+1)+': descrição do produto ausente.');
  rows.push({data:isoDate(r[f.data]),tipo:rowType,sku,produto,dpto:deptCode(r[f.dpto],r[f.departamento]),fornecedor:f.fornecedor===null?'':String(r[f.fornecedor]??'').trim(),documento:doc,observacao:String(r[f.observacao]??'').trim(),qtde:numeric(r[f.qtde]),valor:numeric(r[f.valor])});
 }
 if(!rows.length)throw Error('Nenhuma Entrada ou Saída de auditoria reconhecida no arquivo.');
 return {rows,dates:[...new Set(rows.map(r=>r.data))].sort(),ignored};
}
async function parseTrocasFile(file){
 const m=await matrixFrom(file),[hi,head]=findHeader(m,h=>h.includes('codigo')&&h.includes('descricao')&&h.includes('dpto')&&h.includes('estoque')&&h.includes('ctmedio'));
 const f={sku:colIndex(head,'codigo'),ean:colIndex(head,'codigobarras'),produto:colIndex(head,'descricao'),curva:colIndex(head,'curva'),dpto:colIndex(head,'dpto'),fornCodigo:colIndex(head,'codultimoforn'),fornecedor:colIndex(head,'nomeultimoforn'),quantidade:colIndex(head,'estoque'),valor:colIndex(head,'ctmedio')};
 const rows=[];
 for(let i=hi+1;i<m.length;i++){const r=m[i]||[],sku=skuText(r[f.sku]);if(!/^\d+$/.test(sku)||sku==='0')continue;
  rows.push({sku,ean:String(r[f.ean]??''),produto:String(r[f.produto]??'').trim(),curva:String(r[f.curva]??'').trim(),dpto:deptCode(r[f.dpto],null),fornecedor_codigo:String(r[f.fornCodigo]??''),fornecedor:String(r[f.fornecedor]??'').trim(),quantidade:numeric(r[f.quantidade]),valor:numeric(r[f.valor]),situacao:'Em trocas'});
 }
 if(!rows.length)throw Error('Nenhuma posição de trocas encontrada.');
 const date=filenameDate(file.name);if(!date)throw Error('O arquivo de trocas precisa ter a data no nome, por exemplo: trocas 14-10.xlsx.');
 return {rows,date};
}
async function previewByType(file){if(!file)return;const type=$('#reportType').value;if(type==='perdas')return previewLoss(file);if(type==='vendas')return previewSales(file);if(type==='auditorias_estoque')return previewAudit(file);if(type==='trocas')return previewTrocas(file);}
async function previewLoss(file){pending=null;try{const parsed=await parseLossFile(file),rows=parsed.rows,hash=await hashFile(file),dates=new Set(rows.map(r=>r.data)),mode=$('#importMode').value,old=data.perdas.filter(r=>dates.has(r[0])),total=rows.reduce((s,r)=>s+r.valor,0),key=r=>JSON.stringify(r),keys=new Set(old.map(r=>key([r[0],r[1],r[3],r[4]]))),matches=rows.filter(r=>keys.has(key([r.data,r.sku,r.motivo,r.qtde]))).length,blocked=mode==='complementar'&&matches>0;
 pending={type:'perdas',rows,hash,file:file.name,mode,revision:data.revision};$('#importPreview').innerHTML=`<div class="notice ${blocked?'error':''}"><b>Prévia de Perdas · ${esc(file.name)}</b><br>${num(rows.length)} linhas · ${dates.size} dias · ${money(total)}${parsed.note?'<br>'+esc(parsed.note):''}<br>${mode==='substituir_dias'?num(old.length)+' linhas existentes serão substituídas; valor anterior '+money(ZAI.sum(old,5))+'.':num(matches)+' possíveis coincidências com registros existentes.'}</div>${blocked?'<p>Revise o complemento; nenhuma linha foi importada. Não mude para substituição apenas para contornar coincidências.</p>':`<label style="display:block"><input type="checkbox" id="confirmCheck"> ${mode==='substituir_dias'?'Confirmo que este relatório contém TODOS os lançamentos dos dias presentes.':'Conferi o complemento e seu valor total.'}</label><div class="actions"><button class="primary" id="commitImport">Confirmar gravação no Supabase</button></div>`}`;if(!blocked)$('#commitImport').onclick=commitImport;
 }catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
function salesBatches(rows,limit=90000){
 const byDay=new Map();for(const r of rows){if(!byDay.has(r.data))byDay.set(r.data,[]);byDay.get(r.data).push(r)}
 const batches=[];let current=[],dates=[];
 for(const d of [...byDay.keys()].sort()){const day=byDay.get(d);if(day.length>limit)throw Error('O dia '+d+' excede o limite seguro de importação.');
  if(current.length&&current.length+day.length>limit){batches.push({rows:current,dates});current=[];dates=[]}
  current.push(...day);dates.push(d);
 }
 if(current.length)batches.push({rows:current,dates});return batches;
}
async function chunkHash(base,dates){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(base+'|'+dates.join(',')));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function previewSales(file){pending=null;try{const p=await parseSalesFile(file),hash=await hashFile(file),set=new Set(p.dates),total=p.rows.reduce((s,r)=>s+r.valor,0),existing=(data.vendas_diarias_resumo||[]).filter(r=>set.has(r[0])),oldTotal=existing.reduce((s,r)=>s+Number(r[2]),0),oldDays=new Set(existing.map(r=>r[0])).size;
 const batches=salesBatches(p.rows);pending={type:'vendas',rows:p.rows,dates:p.dates,batches,hash,file:file.name,revision:data.revision};$('#importPreview').innerHTML=`<div class="notice"><b>Prévia de Vendas · ${esc(file.name)}</b><br>${num(p.source)} linhas de origem → ${num(p.rows.length)} combinações consolidadas<br>${p.dates.length} dias · ${esc(p.dates[0])} a ${esc(p.dates.at(-1))} · ${money(total)}<br>${oldDays?oldDays+' dias já possuem vendas e serão substituídos; valor atual '+money(oldTotal)+'.':'Nenhum dos dias do arquivo possui venda diária carregada.'}</div><label style="display:block"><input type="checkbox" id="confirmCheck"> Confirmo que o arquivo contém o relatório COMPLETO de vendas para todos os dias presentes. Os mesmos dias serão substituídos.</label><div class="actions"><button class="primary" id="commitImport">Confirmar gravação no Supabase</button></div>`;$('#commitImport').onclick=commitImport;
 }catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
async function previewAudit(file){pending=null;try{
 const p=await parseAuditFile(file),hash=await hashFile(file),sobras=p.rows.filter(r=>r.tipo==='entrada'),faltas=p.rows.filter(r=>r.tipo==='saida'),sobra=sobras.reduce((s,r)=>s+r.valor,0),falta=faltas.reduce((s,r)=>s+r.valor,0),resultado=falta-sobra;
 pending={type:'auditorias',rows:p.rows,dates:p.dates,hash,file:file.name,revision:data.revision};
 $('#importPreview').innerHTML=`<div class="notice"><b>Auditorias de estoque · carga complementar</b><br>${num(p.rows.length)} movimentos · ${p.dates.length} dias<br><b>Sobras:</b> ${num(sobras.length)} linhas · ${money(sobra)} &nbsp; | &nbsp; <b>Faltas:</b> ${num(faltas.length)} linhas · ${money(falta)}<br><b>Resultado líquido:</b> ${money(resultado)} de ${resultado>=0?'falta':'sobra'}${p.ignored?'<br>'+num(p.ignored)+' linhas sem identificação de Entrada/Saída foram ignoradas.':''}<br><b>Nenhum lançamento anterior será apagado.</b> O banco bloqueia arquivo repetido e possíveis movimentos já existentes.</div><label style="display:block"><input type="checkbox" id="confirmCheck"> Conferi Entradas e Saídas juntas e confirmo que este arquivo contém somente movimentos que ainda precisam ser adicionados.</label><div class="actions"><button class="primary" id="commitImport">Adicionar auditorias ao Supabase</button></div>`;
 $('#commitImport').onclick=commitImport;
 }catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
async function previewTrocas(file){pending=null;try{const p=await parseTrocasFile(file),hash=await hashFile(file),total=p.rows.reduce((s,r)=>s+r.valor,0),qty=p.rows.reduce((s,r)=>s+r.quantidade,0);pending={type:'trocas',rows:p.rows,date:p.date,hash,file:file.name,revision:data.revision};$('#importPreview').innerHTML=`<div class="notice"><b>Posição atual de Trocas · ${esc(p.date)}</b><br>${num(p.rows.length)} SKUs · ${num(qty)} unidades/kg · ${money(total)}<br><b>A posição anterior inteira será substituída.</b> O snapshot anterior ficará apenas no histórico.</div><label style="display:block"><input type="checkbox" id="confirmCheck"> Confirmo que este arquivo representa a posição completa de trocas desta data.</label><div class="actions"><button class="primary" id="commitImport">Confirmar substituição da posição</button></div>`;$('#commitImport').onclick=commitImport;}catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
async function commitImport(){if(!pending||!$('#confirmCheck')?.checked){msg('Confira a prévia e marque a confirmação antes de gravar.',true);return}const p=pending,b=$('#commitImport');b.disabled=true;try{if(p.type==='perdas'){const r=await request('/rest/v1/rpc/zai_importar_perdas',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_modo:p.mode,p_linhas:p.rows});pending=null;await refresh();msg('Perdas gravadas no Supabase: '+num(r.registros)+' registros, '+money(Number(r.valor))+'.');return}if(p.type==='auditorias'){const r=await request('/rest/v1/rpc/zai_importar_auditorias',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_linhas:p.rows,p_datas:p.dates});pending=null;await refresh();msg('Auditorias adicionadas: '+num(r.registros)+' movimentos · Sobras '+money(Number(r.sobra))+' · Faltas '+money(Number(r.falta))+' · Resultado '+money(Number(r.resultado))+'.');return}if(p.type==='trocas'){const r=await request('/rest/v1/rpc/zai_importar_trocas',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_data_referencia:p.date,p_linhas:p.rows});pending=null;await refresh();msg('Posição de trocas substituída: '+num(r.registros)+' SKUs, '+money(Number(r.valor))+'.');return}if(p.type==='vendas'){let totalRows=0,totalValue=0;for(let i=0;i<p.batches.length;i++){const x=p.batches[i],h=await chunkHash(p.hash,x.dates);$('#importPreview').insertAdjacentHTML('beforeend','<p class="small">Gravando lote '+(i+1)+' / '+p.batches.length+' · '+esc(x.dates[0])+' a '+esc(x.dates.at(-1))+'…</p>');const r=await request('/rest/v1/rpc/zai_importar_vendas',{p_loja:activeStore,p_revision:p.revision+i,p_hash:h,p_arquivo:p.file+' · lote '+(i+1)+'/'+p.batches.length,p_linhas:x.rows,p_datas:x.dates});totalRows+=Number(r.registros||0);totalValue+=Number(r.valor||0)}pending=null;await refresh();msg('Vendas gravadas no Supabase: '+num(totalRows)+' registros consolidados, '+money(totalValue)+'.');return}throw Error('Tipo de importação ainda não habilitado.')}catch(e){msg('Importação interrompida: '+e.message+' Atualize o painel antes de repetir; lotes já confirmados permanecem gravados.',true);if($('#commitImport'))$('#commitImport').disabled=false}}

let recoveryToken='';
function loginMode(mode){
 const recovery=mode==='recovery';
 $('#email').closest('label').hidden=recovery;$('#password').closest('label').hidden=recovery;$('#loginSubmit').hidden=recovery;$('#forgotPassword').hidden=recovery;
 $('#recoveryBox').hidden=!recovery;$('#loginClose').hidden=recovery;
 $('#loginError').textContent='';$('#recoveryMessage').textContent='';
 if(recovery){$('#login').showModal();setTimeout(()=>$('#newPassword').focus(),0)}
}
async function sendPasswordRecovery(){
 const email=$('#email').value.trim();
 if(!email)return $('#loginError').textContent='Informe o e-mail cadastrado.';
 if(!BASE||!KEY)return $('#loginError').textContent='Configuração do Supabase indisponível.';
 $('#loginError').textContent='Enviando e-mail de recuperação…';
 try{
  const redirectTo=location.origin+location.pathname;
  const r=await fetch(BASE+'/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.msg||j.message||j.error_description||'Não foi possível enviar o e-mail.');
  $('#loginError').textContent='E-mail enviado. Abra a mensagem de recuperação e clique no link para criar uma nova senha.';
 }catch(e){$('#loginError').textContent=e.message}
}
async function saveRecoveredPassword(){
 const p=$('#newPassword').value,c=$('#confirmNewPassword').value;
 if(p.length<8)return $('#recoveryMessage').textContent='Use uma senha com pelo menos 8 caracteres.';
 if(p!==c)return $('#recoveryMessage').textContent='As duas senhas não são iguais.';
 if(!recoveryToken)return $('#recoveryMessage').textContent='Link de recuperação inválido ou expirado. Solicite um novo e-mail.';
 $('#recoveryMessage').textContent='Salvando nova senha…';
 try{
  const r=await fetch(BASE+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+recoveryToken,'Content-Type':'application/json'},body:JSON.stringify({password:p})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.msg||j.message||j.error_description||'Não foi possível alterar a senha.');
  recoveryToken='';history.replaceState(null,'',location.pathname+location.search);$('#newPassword').value='';$('#confirmNewPassword').value='';
  loginMode('login');$('#loginError').textContent='Senha alterada com sucesso. Entre com a nova senha.';
 }catch(e){$('#recoveryMessage').textContent=e.message}
}
function initPasswordRecovery(){
 if(typeof location==='undefined')return;
 const p=new URLSearchParams(location.hash.replace(/^#/,''));
 if(p.get('type')==='recovery'&&p.get('access_token')){recoveryToken=p.get('access_token');loginMode('recovery')}
}
$('#loginOpen').onclick=()=>{loginMode('login');$('#login').showModal()};$('#loginClose').onclick=()=>$('#login').close();$('#forgotPassword').onclick=sendPasswordRecovery;$('#saveNewPassword').onclick=saveRecoveredPassword;$('#cancelRecovery').onclick=()=>loginMode('login');$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#loginError').textContent='Conectando…';try{const r=await request('/auth/v1/token?grant_type=password',{email:$('#email').value,password:$('#password').value},false);session={...r,expires_at:Date.now()/1000+r.expires_in};$('#password').value='';$('#loginError').textContent='';$('#login').close();await refresh();}catch(e){$('#loginError').textContent=e.message}};
initPasswordRecovery();
$('#logout').onclick=async()=>{if(session)fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token}}).catch(()=>{});requestVersion++;session=null;data=null;cloud=false;context=null;pending=null;activeStore='';accessibleStores=[];syncStores();$('#logout').hidden=true;$('#refresh').hidden=true;$('#sourceBadge').textContent='Sessão encerrada';$('#loginOpen').textContent='Conectar Supabase';msg('');render()};$('#refresh').onclick=()=>refresh();$('#apply').onclick=()=>{productPage=0;render()};