'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n), num=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n), pct=n=>n==null?'—':num(n*100)+'%', pp=n=>n==null?'—':(n>0?'+':'')+num(n*100)+' p.p.';
const names=['Visão Executiva','Perdas Reconhecidas','Vendas & Participação','Comparador de Períodos','Perdas Desconhecidas · Inventário','Perdas Consolidadas','Estoque de Trocas','Central de Importações'];
const BASE=window.ZAI_CONFIG?.supabaseUrl||'',KEY=window.ZAI_CONFIG?.publishableKey||'';
let activeStore='',accessibleStores=[],requestVersion=0;
let data=null,page=0,cloud=false,session=null,context=null,pending=null,productPage=0,productQuery='',activeDept='',productStatus='',compareAFrom='',compareATo='',compareBFrom='',compareBTo='',compareDept='';
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
 data=d;cloud=isCloud;pending=null;activeStore=d.loja;syncStores();
 $('#sourceBadge').textContent=isCloud?'Supabase · '+d.loja:'Conferência local · não salva na nuvem';$('#refresh').hidden=!isCloud;$('#logout').hidden=!session;$('#loginOpen').textContent=isCloud?'Conta conectada':'Conectar Supabase';
 $('#dept').innerHTML='<option value="">Todos os departamentos</option>'+Object.entries(data.departamentos).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([k,v])=>`<option value="${esc(k)}">${esc(k+' · '+v)}</option>`).join('');
 const months=[...new Set([...(d.perdas||[]).map(r=>r[0].slice(0,7)),...(d.vendas_mensais||[]).map(r=>r[0]),...(d.dias_vendas_completos||[]).map(r=>r.slice(0,7))])].sort();if(months.length){$('#from').value=months.at(-1);$('#to').value=months.at(-1)}render();
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
 const rows=(data?.auditorias_diarias_resumo||[]).filter(r=>r[0].slice(0,7)>=from&&r[0].slice(0,7)<=to&&(!cut||r[0]<=cut)&&(!dept||r[2]===dept));
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
 const full=ZAI.select(data,from,to,''),map=new Map(),get=code=>{if(!map.has(code))map.set(code,{code,name:data.departamentos[code]||code,sales:0,recon:0,faltas:0,sobras:0});return map.get(code)};
 full.sales.forEach(r=>get(r[2]).sales+=Number(r[4]));
 full.loss.forEach(r=>get(r[2]).recon+=Number(r[5]));
 for(const r of (data?.auditorias_diarias_resumo||[])){
  if(r[0].slice(0,7)<from||r[0].slice(0,7)>to||(full.cut&&r[0]>full.cut))continue;
  const x=get(r[2]);if(r[1]==='entrada')x.sobras+=Number(r[4]);else if(r[1]==='saida')x.faltas+=Number(r[4]);
 }
 return [...map.values()].map(r=>({...r,consolidated:r.recon+r.faltas-r.sobras,ratio:full.comparable&&r.sales>0?(r.recon+r.faltas-r.sobras)/r.sales:null}))
  .filter(r=>!dept||r.code===dept).sort((a,b)=>b.consolidated-a.consolidated);
}
function shiftMonth(m,delta){const d=new Date(m+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,7)}
function initComparePeriods(){
 if(compareBFrom&&compareBTo&&compareAFrom&&compareATo)return;
 compareBFrom=$('#from').value;compareBTo=$('#to').value;
 const len=ZAI.monthRange(compareBFrom,compareBTo).length||1;
 compareATo=shiftMonth(compareBFrom,-1);compareAFrom=shiftMonth(compareBFrom,-len);
}
function trend(){
 const cs=context.months.map(m=>ZAI.select(data,m,m,$('#dept').value)),maxS=Math.max(...cs.map(c=>c.salesTotal),1),maxL=Math.max(...cs.map(c=>c.lossTotal),1);
 // Separate scales explicitly labelled; rate uses a separate comparison table.
 const W=640,H=205,L=70,R=58,T=20,B=37,px=i=>L+(W-L-R)*(cs.length===1?.5:i/(cs.length-1)),py=(v,max)=>H-B-(H-B-T)*v/max;
 const points=(k,max)=>cs.map((c,i)=>k==='salesTotal'&&!c.sales.length?null:[px(i),py(c[k],max)]);
 const poly=(ps,color)=>`<path d="${ps.map((p,i)=>p?((i===0||!ps[i-1])?'M':'L')+p.join(','):'').join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
 return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas e perdas mensais em reais, com eixos separados">${[0,.5,1].map(t=>`<line x1="${L}" x2="${W-R}" y1="${py(t*maxS,maxS)}" y2="${py(t*maxS,maxS)}" stroke="#e0e8dd"/><text x="${L-8}" y="${py(t*maxS,maxS)+3}" text-anchor="end" font-size="9" fill="#55836d">${num(t*maxS/1000)} mil</text><text x="${W-R+8}" y="${py(t*maxL,maxL)+3}" font-size="9" fill="#bd7750">${num(t*maxL/1000)} mil</text>`).join('')}${poly(points('salesTotal',maxS),'#289575')}${poly(points('lossTotal',maxL),'#c28956')}${cs.map((c,i)=>`${c.sales.length?`<circle cx="${px(i)}" cy="${py(c.salesTotal,maxS)}" r="4" fill="#289575"><title>${c.months[0]}: vendas ${money(c.salesTotal)}, perdas ${money(c.lossTotal)}</title></circle>`:''}<circle cx="${px(i)}" cy="${py(c.lossTotal,maxL)}" r="3" fill="#c28956"/><text x="${px(i)}" y="${H-10}" text-anchor="middle" font-size="10" fill="#6a7d70">${c.months[0].slice(5)}/${c.months[0].slice(2,4)}</text>`).join('')}</svg><div class="legend"><span><i class="dot"></i>Vendas · eixo esquerdo (R$)</span><span><i class="dot" style="background:#c28956"></i>Perdas · eixo direito (R$)</span></div>`;
}
function executive(){
 const from=$('#from').value,to=$('#to').value,dept=$('#dept').value,op=operationalPeriod(from,to,dept),c=op.context,meta=ZAI.lossTarget(data),rows=consolidatedDepartments(from,to,dept),cutNote=c.cut?'Comparável até '+c.cut.split('-').reverse().join('/'):'Mesmo período selecionado';
 return `<div class="kpis">${card('Vendas',c.sales.length?money(c.salesTotal):'—',cutNote,true)}${card('Perdas reconhecidas',money(op.recon),'Quebras operacionais reconhecidas')}${card('Perdas desconhecidas',money(op.a.faltas),'Faltas de estoque / inventários')}${card('Sobras de estoque',money(op.a.sobras),'Compensam as faltas do inventário')}${card('Perdas consolidadas',money(op.consolidated),'Reconhecidas + faltas − sobras',true)}${card('% consolidadas / vendas',pct(op.ratio),'Meta reconhecida da loja: '+pct(meta))}</div>
 <div class="grid2"><article class="card"><h2>Perdas consolidadas por departamento</h2><p class="desc">Top departamentos pelo resultado: perdas reconhecidas + faltas − sobras.</p>${bars(rows.filter(r=>r.consolidated>0).slice(0,10).map(r=>[r.name,r.consolidated,money(r.consolidated)+' · '+pct(r.ratio)]),true)}</article><article class="card"><h2>Composição da perda</h2><p class="desc">A sobra de estoque reduz o resultado do inventário; não é tratada como perda.</p>${table(['Componente','Valor'],[['Perdas reconhecidas',money(op.recon)],['Faltas de estoque',money(op.a.faltas)],['Sobras de estoque','− '+money(op.a.sobras)],['Perdas consolidadas',money(op.consolidated)]])}</article></div>
 <article class="card"><h2>Resumo executivo por departamento</h2><p class="desc">Venda, perdas conhecidas e desconhecidas e resultado consolidado sobre a venda do próprio departamento.</p>${table(['Departamento','Vendas','Reconhecidas','Faltas','Sobras','Consolidadas','% sobre venda'],rows.map(r=>[esc(r.code+' · '+r.name),money(r.sales),money(r.recon),money(r.faltas),money(r.sobras),money(r.consolidated),pct(r.ratio)]))}</article>`;
}
function comparisonTable(rows){const meta=ZAI.lossTarget(data);return table(['Departamento','Vendas','% venda loja','Perdas','% quebra dpto','% perdas loja','Impacto na perda geral','Meta','Desvio'],rows.map(r=>[esc(r.code+' · '+r.name),money(r.sales),pct(r.salesShare),money(r.loss),r.ratio==null?'—':`<span class="tag ${(r.target??meta)==null?'':r.ratio>(r.target??meta)?'bad':'good'}">${pct(r.ratio)}</span>`,pct(r.lossShare),pct(r.storeLossImpact),r.target==null?'<span class="muted">'+pct(meta)+' geral</span>':pct(r.target),r.ratio==null?'—':pp(r.ratio-(r.target??meta))]));}
function targets(){return `<details class="card"><summary>Metas de vendas por departamento · base da loja</summary><p class="small muted">Participações definidas sobre o histórico da própria loja. Meta do período: meta diária configurada × dias do período. A base de participação não se recalcula ao filtrar; a configuração deve refletir a operação da unidade.</p>${table(['Departamento','Vendas na base','Participação','Meta diária','Meta no período'],(data.metas||[]).filter(r=>!$('#dept').value||r.codigo===$('#dept').value).sort((a,b)=>b.meta_diaria-a.meta_diaria).map(r=>[esc(r.codigo+' · '+r.descricao),money(r.vendas_historicas),pct(r.participacao),money(ZAI.dailyGoal(data,r.codigo)),money(ZAI.dailyGoal(data,r.codigo)==null?null:ZAI.dailyGoal(data,r.codigo)*context.days)]))}</details>`;}
function sales(){const c=context,w=ZAI.weekdays(data,c,$('#dept').value),da=departmentAnalyticsContext(),r=da.rows;
 return `<div class="kpis">${card('Faturamento',c.sales.length?money(c.salesTotal):'—','Receita conforme relatório importado',true)}${card('Meta de vendas',money(c.goal),num(c.days)+' dias no período')}${card('Média diária',c.salesDays.size?money(c.salesTotal/c.salesDays.size):'—','Dias cobertos, com ou sem movimento')}${card('SKUs vendidos',num(new Set(c.sales.filter(r=>r[3]!==0||r[4]!==0).map(r=>r[1])).size),'Quantidades separadas por produto; unidades não padronizadas')}</div>
 <div class="grid2"><article class="card"><h2>Vendas por departamento</h2><p class="desc">Top 10 por faturamento.</p>${bars(r.filter(x=>x.sales>0).slice(0,10).map(x=>[x.name,x.sales]))}</article><article class="card"><h2>Média por dia da semana</h2><p class="desc">Somente a base diária. Divisor inclui todos os dias de cada semana com cobertura confirmada.</p>${w.some(x=>x.days)?bars(w.map((x,i)=>[['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][i]+' · '+x.days+' dias',x.mean||0,money(x.mean)])):'<div class="notice">Aguardando relatório diário íntegro. O histórico mensal não permite calcular segunda, terça etc.</div>'}</article></div>${departmentFocus(r)}<article class="card"><h2>Participação por departamento</h2><p class="desc">A participação compara a venda do departamento com o faturamento total da loja no mesmo período.</p>${table(['Departamento','Vendas','Participação na loja'],r.map(x=>[esc(x.code+' · '+x.name),money(x.sales),pct(x.salesShare)]))}</article>${targets()}
 <div class="section-title"><h2>Departamento → Produto</h2><button id="salesCsv">Exportar produtos CSV</button></div><article class="card"><div class="searchrow"><input id="productSearch" placeholder="Buscar SKU ou produto" value="${esc(productQuery)}"><select id="productStatus"><option value="">Todos os status</option><option>Ativo</option><option>Inativo</option><option>Nao informado</option></select></div><div id="products"></div></article><p class="small muted">Ticket médio indisponível: o relatório não contém quantidade de cupons. Quantidades podem representar unidades ou peso e não são somadas como “itens” entre produtos.</p>`;
}
function products(){const map=new Map();for(const r of context.sales){const key=r[2]+'|'+r[1];if(!map.has(key))map.set(key,{dept:r[2],sku:r[1],qty:0,value:0});let x=map.get(key);x.qty+=r[3];x.value+=r[4]}
 const q=productQuery.toLocaleLowerCase('pt-BR');return [...map.values()].filter(x=>{let p=data.produtos[x.sku]||[x.sku,'Nao informado'];return (!productStatus||p[1]===productStatus)&&(!q||(x.sku+' '+p[0]).toLocaleLowerCase('pt-BR').includes(q))}).sort((a,b)=>b.value-a.value)}
function renderProducts(){const list=products(),size=40,max=Math.max(1,Math.ceil(list.length/size));productPage=Math.min(productPage,max-1);$('#products').innerHTML=table(['Produto / SKU','Departamento','Situação atual','Quantidade¹','Vendas'],list.slice(productPage*size,(productPage+1)*size).map(x=>[esc((data.produtos[x.sku]?.[0]||'Sem descrição')+' · '+x.sku),esc(data.departamentos[x.dept]||x.dept),esc(data.produtos[x.sku]?.[1]||'Nao informado'),num(x.qty),money(x.value)]))+`<div class="actions"><button id="prevProducts" ${productPage===0?'disabled':''}>Anterior</button><span class="small">Página ${productPage+1} / ${max} · ${num(list.length)} produtos/departamentos</span><button id="nextProducts" ${productPage>=max-1?'disabled':''}>Próxima</button></div><p class="small muted">¹ Quantidade na unidade de origem de cada SKU. Situação atual não representa necessariamente o status na data da venda.</p>`;$('#prevProducts').onclick=()=>{productPage--;renderProducts()};$('#nextProducts').onclick=()=>{productPage++;renderProducts()}}
function compare(){
 initComparePeriods();
 const dept=compareDept,a=operationalPeriod(compareAFrom,compareATo,dept),b=operationalPeriod(compareBFrom,compareBTo,dept),delta=b.consolidated-a.consolidated,deltaPct=a.consolidated!==0?delta/Math.abs(a.consolidated):null;
 const ad=consolidatedDepartments(compareAFrom,compareATo,dept),bd=consolidatedDepartments(compareBFrom,compareBTo,dept),map=new Map();
 for(const r of ad)map.set(r.code,{code:r.code,name:r.name,a:r.consolidated,b:0});for(const r of bd){if(!map.has(r.code))map.set(r.code,{code:r.code,name:r.name,a:0,b:0});map.get(r.code).b=r.consolidated}
 const rows=[...map.values()].map(r=>({...r,delta:r.b-r.a})).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
 const opts='<option value="">Todos os departamentos</option>'+Object.entries(data.departamentos).sort((x,y)=>x[1].localeCompare(y[1],'pt-BR')).map(([k,v])=>`<option value="${esc(k)}" ${k===compareDept?'selected':''}>${esc(k+' · '+v)}</option>`).join('');
 return `<article class="card"><h2>Comparador de períodos</h2><p class="desc">Compare dois intervalos usando a mesma regra: perdas consolidadas = reconhecidas + faltas − sobras.</p><div class="searchrow"><label>Período A · de<input id="cmpAFrom" type="month" value="${esc(compareAFrom)}"></label><label>Período A · até<input id="cmpATo" type="month" value="${esc(compareATo)}"></label><label>Período B · de<input id="cmpBFrom" type="month" value="${esc(compareBFrom)}"></label><label>Período B · até<input id="cmpBTo" type="month" value="${esc(compareBTo)}"></label><label>Departamento<select id="cmpDept">${opts}</select></label><button class="primary" id="compareApply">Comparar</button></div></article>
 <div class="kpis">${card('Perdas consolidadas · A',money(a.consolidated),compareAFrom+' a '+compareATo)}${card('Perdas consolidadas · B',money(b.consolidated),compareBFrom+' a '+compareBTo,true)}${card('Variação em R$',money(delta),'B − A')}${card('Variação %',pct(deltaPct),'Sobre o valor consolidado do período A')}</div>
 <div class="grid2"><article class="card"><h2>Período A</h2>${table(['Indicador','Valor'],[['Vendas',money(a.context.salesTotal)],['Perdas reconhecidas',money(a.recon)],['Faltas',money(a.a.faltas)],['Sobras','− '+money(a.a.sobras)],['Perdas consolidadas',money(a.consolidated)],['% consolidada / vendas',pct(a.ratio)]])}</article><article class="card"><h2>Período B</h2>${table(['Indicador','Valor'],[['Vendas',money(b.context.salesTotal)],['Perdas reconhecidas',money(b.recon)],['Faltas',money(b.a.faltas)],['Sobras','− '+money(b.a.sobras)],['Perdas consolidadas',money(b.consolidated)],['% consolidada / vendas',pct(b.ratio)]])}</article></div>
 <article class="card"><h2>Variação por departamento</h2><p class="desc">Ordenado pelos maiores movimentos absolutos entre os dois períodos.</p>${table(['Departamento','Consolidada A','Consolidada B','Variação'],rows.map(r=>[esc(r.code+' · '+r.name),money(r.a),money(r.b),(r.delta>0?'+ ':'')+money(r.delta)]))}<div class="actions"><button id="compareCsv">Exportar comparação CSV</button></div></article>`;
}
function future(){
 if(page===4){const op=operationalPeriod($('#from').value,$('#to').value,$('#dept').value),a=op.a;return `<div class="kpis">${card('Perdas desconhecidas · faltas',money(a.faltas),num(a.qf)+' em quantidade',true)}${card('Sobras de estoque',money(a.sobras),num(a.qs)+' em quantidade')}${card('Resultado líquido do inventário',money(a.liquido),'Faltas − Sobras')}${card('Resultado líquido / venda',op.context.comparable&&op.context.salesTotal>0?pct(a.liquido/op.context.salesTotal):'—','Mesmo período e departamento')}</div><article class="card"><h2>Inventários e contagens</h2><p class="desc">Saídas de estoque são FALTAS (perdas desconhecidas). Entradas de estoque são SOBRAS e compensam o resultado.</p>${table(['Indicador','Valor'],[['Faltas / perdas desconhecidas',money(a.faltas)],['Sobras de estoque','− '+money(a.sobras)],['Resultado líquido',money(a.liquido)]])}</article>`;}
 if(page===5){const op=operationalPeriod($('#from').value,$('#to').value,$('#dept').value);return `<div class="kpis">${card('Perdas reconhecidas',money(op.recon),num(op.context.loss.length)+' lançamentos')}${card('Perdas desconhecidas',money(op.a.faltas),'Faltas de estoque')}${card('Sobras de estoque',money(op.a.sobras),'Compensação de inventário')}${card('Perdas consolidadas',money(op.consolidated),'Reconhecidas + faltas − sobras',true)}${card('% consolidadas / vendas',op.ratio==null?'—':pct(op.ratio),'Venda do mesmo período')}</div><article class="card"><h2>Composição da perda consolidada</h2><p class="desc">A visão consolidada junta quebra operacional e resultado de inventário sem transformar sobra em perda positiva.</p>${table(['Componente','Valor'],[['Perdas reconhecidas',money(op.recon)],['Perdas desconhecidas / faltas',money(op.a.faltas)],['Sobras de estoque','− '+money(op.a.sobras)],['Resultado consolidado',money(op.consolidated)]])}</article>`;}
 if(page===6){const t=data?.trocas_resumo||{};return `<div class="kpis">${card('Montante atual em trocas',money(Number(t.valor||0)),num(Number(t.registros||0))+' SKUs',true)}${card('Quantidade atual',num(Number(t.quantidade||0)),'Posição vigente')}${card('Fornecedores',num(Number(t.fornecedores||0)),'Com itens na posição atual')}${card('Data de referência',t.data_referencia||'—','Última posição importada')}</div><article class="card"><h2>Estoque de Trocas</h2><p class="desc">É uma posição de estoque. Cada novo arquivo substitui integralmente a posição anterior; snapshots antigos ficam somente no histórico para auditoria.</p></article>`;}
 return '';
}
function exchange(){return `<div class="grid2"><article class="card"><h2>Central de importações</h2><p class="desc">Atualize cada operação pelo seu próprio tipo de relatório. A Loja selecionada é aplicada à carga e toda gravação exige prévia e confirmação.</p><label>Tipo de relatório <span aria-hidden="true">*</span><select id="reportType" required><option value="">Selecione antes de escolher o arquivo</option><option value="perdas">Perdas</option><option value="vendas">Vendas</option><option value="saida_estoque">Saídas de estoque · Auditoria de saída</option><option value="entrada_estoque">Entradas de estoque · Auditoria de entrada</option><option value="trocas">Trocas · saldo atual</option></select></label><div id="typeGuide" class="notice info">Selecione o tipo de relatório para ver a regra de atualização.</div><div id="modeWrap"><label>Tipo de atualização<select id="importMode"><option value="complementar">Complementar · preserva registros existentes</option><option value="substituir_dias">Relatório completo · substituir dias presentes</option></select></label></div><div class="upload"><label>Selecionar arquivo do ERP<input id="lossFile" type="file" accept=".xlsx,.xls,.csv,.json" disabled></label><p class="small muted">Perdas: Excel/JSON Kalimera. Vendas: Excel horizontal do ERP ou formato normalizado. Auditorias: Excel de Entradas/Saídas. Trocas: Excel de posição atual.</p></div>${!cloud?'<p class="notice">Conecte o Supabase para gravar. A conferência local não atualiza a nuvem.</p>':data?.papel!=='importador'?'<p class="notice">Esta conta possui acesso somente leitura.</p>':''}<div id="importPreview"></div><p class="small muted">Nenhuma importação mistura tipos. Vendas e auditorias substituem somente os dias presentes. Trocas sempre substitui a posição inteira. O histórico de importações permanece auditável.</p></article>
 <article class="card"><h2>Exportar e conferir</h2><p class="desc">A exportação analítica inclui perdas, resumos de vendas, cadastro e metas. O detalhe diário completo permanece no Supabase.</p><div class="actions"><button id="backup" ${!data?'disabled':''}>Exportar base analítica JSON</button><button id="goalsCsv" ${!data?'disabled':''}>Exportar metas CSV</button></div><div class="upload"><label>Abrir base para conferência local<input id="localFile" type="file" accept=".json"></label><p class="small muted">A conferência local não grava no banco.</p></div><p class="small"><b>Fluxo atual:</b> ERP → Excel → validação no Z-AI → Supabase. Não depende de acesso direto ao PostgreSQL do ERP.</p></article></div>
 <article class="card"><h2>Histórico de importações</h2><p class="desc">${cloud?'Registros persistidos no Supabase':'Histórico incluído no arquivo de conferência'}</p>${table(['Arquivo','Quando','Registros','Valor','Tipo'],(data?.historico||[]).map(r=>[esc(r.file||''),esc(r.when?new Date(r.when).toLocaleString('pt-BR'):''),num(r.rows||0),money(r.value||0),esc(r.tipo||'Backup histórico')]))}</article>`;}
function empty(){return `<article class="card empty"><span class="number">Z</span><h2>Seu painel, conectado às suas lojas</h2><p>Entre na conta do Supabase para consultar os dados salvos. Para conferir esta versão antes da ativação, abra <b>data/base_conferida.json</b> no menu Importar e Exportar.</p><div class="actions" style="justify-content:center"><button class="primary" id="emptyLogin">Conectar Supabase</button><button id="emptyLocal">Abrir base de conferência</button></div></article>`;}
function render(){
 $('#nav').innerHTML=names.map((n,i)=>`<button data-page="${i}" class="${page===i?'active':''}" title="${esc(n)}" aria-label="${esc(n)}" aria-current="${page===i?'page':'false'}"><span class="navicon" aria-hidden="true">${['📊','📉','🛒','⚖️','🔎','🧮','📦','🔄'][i]}</span><span class="navlabel">${n}</span></button>`).join('');$('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{page=+b.dataset.page;msg('');render()});
 $('#pageTitle').textContent=names[page];$('#filters').hidden=!data||page===3||page===6||page===7;$('#coverage').innerHTML='';$('#stamp').textContent='Consultado em '+new Date().toLocaleString('pt-BR');
 if(data&&[0,1,2,4,5].includes(page)){let from=$('#from').value,to=$('#to').value;if(!from||!to||from>to){msg('Informe competências válidas, com início anterior ao fim.',true);return}context=ZAI.select(data,from,to,$('#dept').value);$('#periodNote').textContent=context.days+' dias no período · '+(context.sources.length?context.sources.join(' / '):'vendas não disponíveis');
 const notices=[];if(context.cut)notices.push(page===1?'Perdas: todos os lançamentos da competência. Vendas completas até '+context.cut+'.':'Comparativo acumulado até '+context.cut+'. Vendas, perdas e meta usam os mesmos '+context.days+' dias.');if(context.unmatchedLossCount)notices.push(page===1?num(context.unmatchedLossCount)+' perdas posteriores ao corte de vendas estão incluídas abaixo. Percentual indisponível até completar as vendas.':num(context.unmatchedLossCount)+' perdas posteriores ao corte estão disponíveis em Perdas Reconhecidas; não entram neste comparativo.');if(data.aviso&&!(data.dias_vendas_completos||[]).includes('2026-09-22'))notices.push(data.aviso);if(context.missing.length)notices.push('Vendas ausentes ou incompletas em '+context.missing.join(', ')+'. Percentual de perdas e atingimento não são calculados para o período incompleto.');if(!context.comparable&&!context.missing.length)notices.push('Cobertura de perdas disponível: '+context.first+' a '+context.last+'. O percentual exige cobertura compatível com as vendas de todo o período.');
 $('#coverage').innerHTML=notices.map(s=>`<div class="notice">${esc(s)}</div>`).join('');
 }
 $('#content').innerHTML=page===7?exchange():!data?empty():page===0?executive():page===1?losses():page===2?sales():page===3?compare():future();
 if($('#emptyLogin'))$('#emptyLogin').onclick=()=>$('#login').showModal();if($('#emptyLocal'))$('#emptyLocal').onclick=()=>{page=7;render();$('#localFile').click()};
 if(page===1&&data)bindLossGrid();
 if(page===2&&data){$('#productStatus').value=productStatus;renderProducts();$('#productSearch').oninput=e=>{productQuery=e.target.value;productPage=0;renderProducts()};$('#productStatus').onchange=e=>{productStatus=e.target.value;productPage=0;renderProducts()};$('#salesCsv').onclick=()=>csv('vendas_produtos_'+activeStore+'.csv',['Loja','SKU','Produto','Departamento','Quantidade origem','Vendas'],products().map(x=>[activeStore,x.sku,data.produtos[x.sku]?.[0],x.dept,String(x.qty).replace('.',','),x.value.toFixed(2).replace('.',',')]))}
 if(page===3&&data){$('#compareApply').onclick=()=>{compareAFrom=$('#cmpAFrom').value;compareATo=$('#cmpATo').value;compareBFrom=$('#cmpBFrom').value;compareBTo=$('#cmpBTo').value;compareDept=$('#cmpDept').value;if(!compareAFrom||!compareATo||!compareBFrom||!compareBTo||compareAFrom>compareATo||compareBFrom>compareBTo){msg('Informe períodos válidos para A e B.',true);return}msg('');render()};$('#compareCsv').onclick=()=>{const a=consolidatedDepartments(compareAFrom,compareATo,compareDept),b=consolidatedDepartments(compareBFrom,compareBTo,compareDept),map=new Map();for(const r of a)map.set(r.code,{code:r.code,name:r.name,a:r.consolidated,b:0});for(const r of b){if(!map.has(r.code))map.set(r.code,{code:r.code,name:r.name,a:0,b:0});map.get(r.code).b=r.consolidated}csv('comparacao_periodos_'+activeStore+'.csv',['Departamento','Consolidada A','Consolidada B','Variação B-A'],[...map.values()].map(r=>[r.code+' · '+r.name,String(r.a).replace('.',','),String(r.b).replace('.',','),String(r.b-r.a).replace('.',',')]))}};
 if(page===7){$('#localFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const d=JSON.parse(await f.text());setData(d,false);msg('Arquivo aberto para conferência. Nenhum dado foi enviado ao banco.')}catch(e){msg(e.message,true)}};$('#backup').onclick=()=>download('Base_Analitica_ZAI_'+activeStore+'_' +new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data));$('#goalsCsv').onclick=()=>csv('metas_'+activeStore+'.csv',['Departamento','Participação %','Meta diaria R$','Meta perdas %'],(data.metas||[]).map(r=>[r.descricao,(r.participacao*100).toFixed(2).replace('.',','),ZAI.dailyGoal(data,r.codigo)==null?'':ZAI.dailyGoal(data,r.codigo).toFixed(2).replace('.',','),r.meta_perda==null?'':(r.meta_perda*100).toFixed(2).replace('.',',')]));$('#lossFile').onchange=e=>previewByType(e.target.files[0]);bindImportType();$('#importMode').onchange=()=>{pending=null;$('#lossFile').value='';$('#importPreview').innerHTML='Selecione novamente o arquivo para conferir este modo.'}}
}

const IMPORT_GUIDES={
 perdas:'Perdas reconhecidas · aceita o JSON completo do Kalimera ou Excel operacional. O backup completo deve ser importado como relatório completo, substituindo os dias presentes.',
 vendas:'Vendas diárias · aceita o relatório horizontal do ERP: cada data possui Vendas, Quantidade e Ct Empresa. O Dashboard usa Vendas e Quantidade e substitui somente os dias presentes.',
 saida_estoque:'Saídas de estoque = FALTAS. Usa o relatório Auditorias Saídas De Estoque 1 e substitui os dias presentes.',
 entrada_estoque:'Entradas de estoque = SOBRAS. Usa o relatório Auditorias Entradas Estoque 1 e substitui os dias presentes.',
 trocas:'Trocas = posição atual de estoque. Cada importação substitui integralmente a posição anterior; snapshots antigos ficam apenas no histórico.'
};
function bindImportType(){
 const type=$('#reportType').value,file=$('#lossFile'),mode=$('#importMode'),wrap=$('#modeWrap'),guide=$('#typeGuide');
 pending=null;$('#importPreview').innerHTML='';
 const enabled=['perdas','vendas','saida_estoque','entrada_estoque','trocas'].includes(type);
 guide.textContent=IMPORT_GUIDES[type]||'Selecione o tipo de relatório para ver a regra de atualização.';
 mode.disabled=type!=='perdas';wrap.hidden=type!=='perdas';
 if(type==='vendas'||type==='saida_estoque'||type==='entrada_estoque')mode.value='substituir_dias';
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
async function parseAuditFile(file,type){
 const m=await matrixFrom(file),[hi,head]=findHeader(m,h=>h.includes('dpto')&&h.includes('codigo')&&h.includes('dtmvto')&&h.includes('descricaodcto')&&h.includes('qtde')&&h.includes('valor'));
 const f={dpto:colIndex(head,'dpto'),departamento:colIndex(head,'descricaodpto'),sku:colIndex(head,'codigo'),produto:colIndex(head,'descricao'),data:colIndex(head,'dtmvto'),documento:colIndex(head,'descricaodcto'),observacao:colIndex(head,'descricaoespecie'),qtde:colIndex(head,'qtde'),valor:colIndex(head,'valor')};
 const rows=[];
 for(let i=hi+1;i<m.length;i++){const r=m[i]||[],doc=String(r[f.documento]??''),rowType=/entradas/i.test(doc)?'entrada':/sa[ií]das/i.test(doc)?'saida':null;if(rowType!==type)continue;
  const sku=skuText(r[f.sku]);if(!/^\d+$/.test(sku))continue;
  rows.push({data:isoDate(r[f.data]),sku,produto:String(r[f.produto]??'').trim(),dpto:deptCode(r[f.dpto],r[f.departamento]),documento:doc,observacao:String(r[f.observacao]??'').trim(),qtde:numeric(r[f.qtde]),valor:numeric(r[f.valor])});
 }
 if(!rows.length)throw Error('Nenhuma linha de '+(type==='entrada'?'SOBRA':'FALTA')+' encontrada no arquivo.');
 return {rows,dates:[...new Set(rows.map(r=>r.data))].sort()};
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
async function previewByType(file){if(!file)return;const type=$('#reportType').value;if(type==='perdas')return previewLoss(file);if(type==='vendas')return previewSales(file);if(type==='entrada_estoque'||type==='saida_estoque')return previewAudit(file,type==='entrada_estoque'?'entrada':'saida');if(type==='trocas')return previewTrocas(file);}
async function previewLoss(file){pending=null;try{const parsed=await parseLossFile(file),rows=parsed.rows,hash=await hashFile(file),dates=new Set(rows.map(r=>r.data)),mode=$('#importMode').value,old=data.perdas.filter(r=>dates.has(r[0])),total=rows.reduce((s,r)=>s+r.valor,0),key=r=>JSON.stringify(r),keys=new Set(old.map(r=>key([r[0],r[1],r[3],r[4]]))),matches=rows.filter(r=>keys.has(key([r.data,r.sku,r.motivo,r.qtde]))).length,blocked=mode==='complementar'&&matches>0;
 pending={type:'perdas',rows,hash,file:file.name,mode,revision:data.revision};$('#importPreview').innerHTML=\`<div class="notice \${blocked?'error':''}"><b>Prévia de Perdas · \${esc(file.name)}</b><br>\${num(rows.length)} linhas · \${dates.size} dias · \${money(total)}\${parsed.note?'<br>'+esc(parsed.note):''}<br>\${mode==='substituir_dias'?num(old.length)+' linhas existentes serão substituídas; valor anterior '+money(ZAI.sum(old,5))+'.':num(matches)+' possíveis coincidências com registros existentes.'}</div>\${blocked?'<p>Revise o complemento; nenhuma linha foi importada. Não mude para substituição apenas para contornar coincidências.</p>':\`<label style="display:block"><input type="checkbox" id="confirmCheck"> \${mode==='substituir_dias'?'Confirmo que este relatório contém TODOS os lançamentos dos dias presentes.':'Conferi o complemento e seu valor total.'}</label><div class="actions"><button class="primary" id="commitImport">Confirmar gravação no Supabase</button></div>\`}\`;if(!blocked)$('#commitImport').onclick=commitImport;
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
 const batches=salesBatches(p.rows);pending={type:'vendas',rows:p.rows,dates:p.dates,batches,hash,file:file.name,revision:data.revision};$('#importPreview').innerHTML=\`<div class="notice"><b>Prévia de Vendas · \${esc(file.name)}</b><br>\${num(p.source)} linhas de origem → \${num(p.rows.length)} combinações consolidadas<br>\${p.dates.length} dias · \${esc(p.dates[0])} a \${esc(p.dates.at(-1))} · \${money(total)}<br>\${oldDays?oldDays+' dias já possuem vendas e serão substituídos; valor atual '+money(oldTotal)+'.':'Nenhum dos dias do arquivo possui venda diária carregada.'}</div><label style="display:block"><input type="checkbox" id="confirmCheck"> Confirmo que o arquivo contém o relatório COMPLETO de vendas para todos os dias presentes. Os mesmos dias serão substituídos.</label><div class="actions"><button class="primary" id="commitImport">Confirmar gravação no Supabase</button></div>\`;$('#commitImport').onclick=commitImport;
 }catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
async function previewAudit(file,type){pending=null;try{const p=await parseAuditFile(file,type),hash=await hashFile(file),total=p.rows.reduce((s,r)=>s+r.valor,0);pending={type:'auditoria',auditType:type,rows:p.rows,dates:p.dates,hash,file:file.name,revision:data.revision};$('#importPreview').innerHTML=`<div class="notice"><b>${type==='entrada'?'SOBRAS · Auditoria de Entrada':'FALTAS · Auditoria de Saída'}</b><br>${num(p.rows.length)} linhas · ${p.dates.length} dias · ${money(total)}<br>Os mesmos dias deste tipo serão substituídos.</div><label style="display:block"><input type="checkbox" id="confirmCheck"> Confirmo que este é o relatório completo para os dias presentes.</label><div class="actions"><button class="primary" id="commitImport">Confirmar gravação no Supabase</button></div>`;$('#commitImport').onclick=commitImport;}catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
async function previewTrocas(file){pending=null;try{const p=await parseTrocasFile(file),hash=await hashFile(file),total=p.rows.reduce((s,r)=>s+r.valor,0),qty=p.rows.reduce((s,r)=>s+r.quantidade,0);pending={type:'trocas',rows:p.rows,date:p.date,hash,file:file.name,revision:data.revision};$('#importPreview').innerHTML=`<div class="notice"><b>Posição atual de Trocas · ${esc(p.date)}</b><br>${num(p.rows.length)} SKUs · ${num(qty)} unidades/kg · ${money(total)}<br><b>A posição anterior inteira será substituída.</b> O snapshot anterior ficará apenas no histórico.</div><label style="display:block"><input type="checkbox" id="confirmCheck"> Confirmo que este arquivo representa a posição completa de trocas desta data.</label><div class="actions"><button class="primary" id="commitImport">Confirmar substituição da posição</button></div>`;$('#commitImport').onclick=commitImport;}catch(e){msg(e.message,true);$('#importPreview').innerHTML=''}}
async function commitImport(){if(!pending||!$('#confirmCheck')?.checked){msg('Confira a prévia e marque a confirmação antes de gravar.',true);return}const p=pending,b=$('#commitImport');b.disabled=true;try{if(p.type==='perdas'){const r=await request('/rest/v1/rpc/zai_importar_perdas',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_modo:p.mode,p_linhas:p.rows});pending=null;await refresh();msg('Perdas gravadas no Supabase: '+num(r.registros)+' registros, '+money(Number(r.valor))+'.');return}if(p.type==='auditoria'){const r=await request('/rest/v1/rpc/zai_importar_auditoria',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_tipo:p.auditType,p_linhas:p.rows,p_datas:p.dates});pending=null;await refresh();msg((p.auditType==='entrada'?'Sobras':'Faltas')+' gravadas: '+num(r.registros)+' registros, '+money(Number(r.valor))+'.');return}if(p.type==='trocas'){const r=await request('/rest/v1/rpc/zai_importar_trocas',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_data_referencia:p.date,p_linhas:p.rows});pending=null;await refresh();msg('Posição de trocas substituída: '+num(r.registros)+' SKUs, '+money(Number(r.valor))+'.');return}if(p.type==='vendas'){let totalRows=0,totalValue=0;for(let i=0;i<p.batches.length;i++){const x=p.batches[i],h=await chunkHash(p.hash,x.dates);$('#importPreview').insertAdjacentHTML('beforeend','<p class="small">Gravando lote '+(i+1)+' / '+p.batches.length+' · '+esc(x.dates[0])+' a '+esc(x.dates.at(-1))+'…</p>');const r=await request('/rest/v1/rpc/zai_importar_vendas',{p_loja:activeStore,p_revision:p.revision+i,p_hash:h,p_arquivo:p.file+' · lote '+(i+1)+'/'+p.batches.length,p_linhas:x.rows,p_datas:x.dates});totalRows+=Number(r.registros||0);totalValue+=Number(r.valor||0)}pending=null;await refresh();msg('Vendas gravadas no Supabase: '+num(totalRows)+' registros consolidados, '+money(totalValue)+'.');return}throw Error('Tipo de importação ainda não habilitado.')}catch(e){msg('Importação interrompida: '+e.message+' Atualize o painel antes de repetir; lotes já confirmados permanecem gravados.',true);if($('#commitImport'))$('#commitImport').disabled=false}}

$('#loginOpen').onclick=()=>$('#login').showModal();$('#loginClose').onclick=()=>$('#login').close();$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#loginError').textContent='Conectando…';try{const r=await request('/auth/v1/token?grant_type=password',{email:$('#email').value,password:$('#password').value},false);session={...r,expires_at:Date.now()/1000+r.expires_in};$('#password').value='';$('#loginError').textContent='';$('#login').close();await refresh();}catch(e){$('#loginError').textContent=e.message}};
$('#logout').onclick=async()=>{if(session)fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token}}).catch(()=>{});requestVersion++;session=null;data=null;cloud=false;context=null;pending=null;activeStore='';accessibleStores=[];syncStores();$('#logout').hidden=true;$('#refresh').hidden=true;$('#sourceBadge').textContent='Sessão encerrada';$('#loginOpen').textContent='Conectar Supabase';msg('');render()};$('#refresh').onclick=()=>refresh();$('#apply').onclick=()=>{productPage=0;render()};