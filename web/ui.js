/* Shared shell and operational components. Data/metrics remain in app.js/core.js. */
let lossMode='individual',lossQuery='',lossReason='',lossStatus='',lossKind='',lossPage=0,lossSort='valor',lossDirection=-1;
let auditMode='agrupado',auditType='',auditQuery='',auditSort='faltas_sobras',auditSortDirection=-1,auditPage=0,auditData=null,auditLoadedKey='',auditErrorKey='',auditLoading=false,auditSearchTimer=null;
function syncStores(){
 const stores=cloud?accessibleStores:(data?[{codigo:data.loja,nome:data.nome}]:[]);
 $('#storeSelect').innerHTML=stores.length?stores.map(s=>`<option value="${esc(s.codigo)}">${esc(s.codigo+' · '+s.nome)}</option>`).join(''):'<option value="">Selecione a loja</option>';
 $('#storeSelect').value=activeStore;
}
async function refresh(){
 const version=++requestVersion;
 if(session){
  $('#sourceBadge').textContent='Autenticado · carregando';
  $('#loginOpen').textContent='Conta conectada';
  $('#logout').hidden=false;
 }
 msg('Carregando a base real da filial… isso pode levar alguns segundos.');
 try{
  accessibleStores=await request('/rest/v1/rpc/zai_lojas',{});
  if(!accessibleStores.length)throw Error('Sua conta não está autorizada para nenhuma loja. Solicite a liberação ao administrador.');
  if(!accessibleStores.some(x=>x.codigo===activeStore))activeStore=accessibleStores[0].codigo;
  $('#storeSelect').innerHTML=accessibleStores.map(x=>`<option value="${esc(x.codigo)}">${esc(x.codigo+' · '+x.nome)}</option>`).join('');
  $('#storeSelect').value=activeStore;
  const requested=activeStore,d=await request('/rest/v1/rpc/zai_snapshot',{p_loja:requested});
  if(version!==requestVersion||requested!==activeStore||!session)return;
  if(d.loja!==requested)throw Error('A resposta não corresponde à loja solicitada. Nenhum dado será exibido.');
  setData(d,true);msg('Dados reais atualizados da loja '+requested+'.');
 }catch(e){if(version===requestVersion){data=null;cloud=false;render();$('#sourceBadge').textContent=session?'Autenticado · falha ao carregar':'Não conectado';$('#loginOpen').textContent=session?'Conta conectada':'Entrar';$('#logout').hidden=!session;msg(e.message,true);}}
}
$('#refresh').onclick=refresh;
$('#storeSelect').onchange=async e=>{const next=e.target.value;if(!next||next===activeStore)return;activeStore=next;data=null;pending=null;context=null;lossPage=0;lossQuery='';lossReason='';lossStatus='';productQuery='';productStatus='';auditPage=0;auditQuery='';auditType='';auditData=null;auditLoadedKey='';render();await refresh()};
$('#sidebarToggle').onclick=()=>{const expanded=document.body.classList.toggle('expanded');document.body.classList.toggle('rail',!expanded);$('#sidebarToggle').setAttribute('aria-expanded',String(expanded));$('#sidebarToggle').setAttribute('aria-label',expanded?'Recolher navegação':'Expandir navegação')};
function losses(){
 const c={...context,loss:context.lossAll,lossTotal:context.lossTotalAll,ratio:context.unmatchedLossCount?null:context.ratio},meta=ZAI.lossTarget(data),goal=$('#dept').value?(data.metas||[]).find(x=>x.codigo===$('#dept').value)?.meta_perda:null,target=goal??meta;
 const shown=c.loss.filter(r=>!lossKind||lossKindOf(r[3])===lossKind);
 c.loss=shown;c.lossTotal=ZAI.sum(shown,5);c.ratio=context.comparable&&context.salesTotal>0&&(!context.unmatchedLossCount)?c.lossTotal/context.salesTotal:null;
 const byReason=new Map();c.loss.forEach(r=>byReason.set(r[3],(byReason.get(r[3])||0)+r[5]));
 return `<div class="kpis">${card('Perdas reconhecidas',money(c.lossTotal),num(c.loss.length)+' ocorrências',true)}${card('Vendas no período',c.sales.length?money(c.salesTotal):'—',c.cut?'Vendas completas até '+c.cut:'Mesmo filtro de loja e departamento')}${card('Perda sobre as vendas',pct(c.ratio),target===null?'Meta da loja não configurada':c.ratio===null?c.unmatchedLossCount?'Aguardando vendas dos dias mais recentes':'Cobertura incompatível':pp(c.ratio-target)+' sobre a referência')}${card(goal!=null?'Meta do departamento':'Meta geral de perdas',pct(target),target!==null&&c.sales.length?'Limite: '+money(c.salesTotal*target):'Aguardando vendas')}</div>
 <div class="grid2 losses-charts"><article class="card"><h2>Perdas por motivo</h2>${bars([...byReason].sort((a,b)=>b[1]-a[1]).slice(0,5))}</article><article class="card"><h2>Departamentos com maior perda</h2>${bars(ZAI.departmentRows(data,c).sort((a,b)=>b.loss-a.loss).slice(0,5).map(r=>[r.name,r.loss]))}</article></div>
 <article class="card grid-card"><div class="section-title"><h2>Detalhamento das perdas</h2><div class="actions"><button id="lossIndividual" class="${lossMode==='individual'?'primary':''}">Individual</button><button id="lossGrouped" class="${lossMode==='grouped'?'primary':''}">Agrupado por SKU</button><button id="lossExport">↓ CSV</button></div></div><div class="searchrow"><input id="lossSearch" placeholder="Buscar SKU ou produto" value="${esc(lossQuery)}"><select id="lossKind" aria-label="Tipo de perda"><option value="">Todos os tipos de quebras</option>${LOSS_KINDS.map(([k,n])=>`<option value="${k}" ${lossKind===k?'selected':''}>${n}</option>`).join('')}</select><select id="lossReason" aria-label="Motivo"><option value="">Todos os motivos</option>${[...new Set(c.loss.map(r=>r[3]))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="lossStatus" aria-label="Situação do produto"><option value="">Todos os status</option><option>Ativo</option><option>Inativo</option><option>Nao informado</option></select></div><div id="lossGrid"></div><p class="small muted">Situação atual do cadastro. “Não informado” não significa ativo. Clique nos cabeçalhos para ordenar; o CSV inclui todo o resultado filtrado.</p></article>`;
}
function lossRows(){
 const q=lossQuery.toLocaleLowerCase('pt-BR');let rows=context.lossAll.map(r=>({data:r[0],sku:r[1],produto:data.produtos[r[1]]?.[0]||r[1],dpto:r[2],departamento:data.departamentos[r[2]]||r[2],motivo:r[3],qtde:r[4],valor:r[5],status:data.produtos[r[1]]?.[1]||'Nao informado'})).filter(r=>(!q||(r.sku+' '+r.produto).toLocaleLowerCase('pt-BR').includes(q))&&(!lossReason||r.motivo===lossReason)&&(!lossKind||lossKindOf(r.motivo)===lossKind)&&(!lossStatus||r.status===lossStatus));
 if(lossMode==='grouped'){const m=new Map();for(const r of rows){let k=r.sku+'|'+r.dpto;if(!m.has(k))m.set(k,{...r,qtde:0,valor:0,ocorrencias:0,dias:new Set()});let x=m.get(k);x.qtde+=r.qtde;x.valor+=r.valor;x.ocorrencias++;x.dias.add(r.data)}rows=[...m.values()].map(r=>({...r,dias:r.dias.size,media:r.valor/r.ocorrencias}));}
 return rows.sort((a,b)=>{let x=a[lossSort],y=b[lossSort];return lossDirection*(typeof x==='number'?x-y:String(x??'').localeCompare(String(y??''),'pt-BR'))});
}
function renderLossGrid(){
 const rows=lossRows(),size=50,pages=Math.max(1,Math.ceil(rows.length/size));lossPage=Math.min(lossPage,pages-1);
 const cols=lossMode==='individual'?[['data','Data'],['sku','SKU'],['produto','Produto'],['departamento','Departamento'],['motivo','Motivo'],['qtde','Qtde¹'],['valor','Perda']]:[['sku','SKU'],['produto','Produto'],['departamento','Departamento'],['ocorrencias','Ocorrências'],['dias','Dias'],['qtde','Qtde¹'],['media','Média/ocorrência'],['valor','Perda acumulada']];
 $('#lossGrid').innerHTML=`<div class="grid-summary">${num(rows.length)} ${lossMode==='grouped'?'produtos/departamentos':'ocorrências'}<b>${money(rows.reduce((s,r)=>s+r.valor,0))}</b></div><div class="table-wrap"><table class="data-grid"><thead><tr>${cols.map(([k,t])=>`<th aria-sort="${k===lossSort?(lossDirection===1?'ascending':'descending'):'none'}"><button data-sort="${k}">${t}${k===lossSort?(lossDirection===1?' ↑':' ↓'):''}</button></th>`).join('')}</tr></thead><tbody>${rows.slice(lossPage*size,(lossPage+1)*size).map(r=>'<tr>'+cols.map(([k])=>`<td class="${typeof r[k]==='number'?'num':''}">${k==='produto'?'<button class="p360-link" type="button" data-open-360="'+esc(r.sku)+'" title="Abrir Produto 360°">'+esc(r[k])+' ↗</button>':k==='valor'||k==='media'?money(r[k]):typeof r[k]==='number'?num(r[k]):esc(r[k])}</td>`).join('')+'</tr>').join('')||`<tr><td colspan="${cols.length}">Nenhum lançamento neste filtro.</td></tr>`}</tbody></table></div><div class="grid-pager"><span>Página ${lossPage+1} de ${pages} · 50 linhas por página</span><div><button id="lossPrev" ${lossPage===0?'disabled':''}>←</button><button id="lossNext" ${lossPage>=pages-1?'disabled':''}>→</button></div></div>`;
 $('#lossGrid').querySelectorAll('[data-open-360]').forEach(b=>b.onclick=()=>p360SelectSku(b.dataset.open360));
 $('#lossGrid').querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const k=b.dataset.sort;lossDirection=lossSort===k?-lossDirection:1;lossSort=k;renderLossGrid()});$('#lossPrev').onclick=()=>{lossPage--;renderLossGrid()};$('#lossNext').onclick=()=>{lossPage++;renderLossGrid()};
}
function bindLossGrid(){
 $('#lossReason').value=lossReason;$('#lossKind').value=lossKind;$('#lossStatus').value=lossStatus;renderLossGrid();
 $('#lossIndividual').onclick=()=>{lossMode='individual';lossSort='valor';lossPage=0;render()};$('#lossGrouped').onclick=()=>{lossMode='grouped';lossSort='valor';lossPage=0;render()};
 $('#lossSearch').oninput=e=>{lossQuery=e.target.value;lossPage=0;renderLossGrid()};$('#lossReason').onchange=e=>{lossReason=e.target.value;lossPage=0;renderLossGrid()};$('#lossKind').onchange=e=>{lossKind=e.target.value;lossPage=0;render()};$('#lossStatus').onchange=e=>{lossStatus=e.target.value;lossPage=0;renderLossGrid()};
 $('#lossExport').onclick=()=>{const rows=lossRows();csv('perdas_'+activeStore+'_'+$('#from').value+'_'+$('#to').value+'_'+lossMode+'.csv',lossMode==='individual'?['Loja','Data','SKU','Produto','Departamento','Motivo','Quantidade origem','Valor']:['Loja','SKU','Produto','Departamento','Ocorrências','Dias','Quantidade origem','Valor'],rows.map(r=>lossMode==='individual'?[activeStore,r.data,r.sku,r.produto,r.departamento,r.motivo,String(r.qtde).replace('.',','),r.valor.toFixed(2).replace('.',',')]:[activeStore,r.sku,r.produto,r.departamento,r.ocorrencias,r.dias,String(r.qtde).replace('.',','),r.valor.toFixed(2).replace('.',',')]))};
}
function auditRequestKey(){
 if(!data)return '';
 return [activeStore,$('#from')?.value||'',$('#to')?.value||'',$('#dept')?.value||'',auditType,auditQuery.trim(),auditMode,auditMode==='agrupado'?'todos':auditPage].join('|');
}
function auditFallback(){
 const op=operationalPeriod($('#from').value,$('#to').value,$('#dept').value),a=op.a;
 return {resumo:{registros:a.rows.length,skus:0,dias:new Set(a.rows.map(r=>r[0])).size,faltas:a.faltas,sobras:a.sobras,liquido:a.liquido,qtde_falta:a.qf,qtde_sobra:a.qs},top_faltas:[],top_sobras:[],departamentos:[],linhas:[],total_linhas:0};
}
function audits(){
 const key=auditRequestKey(),fresh=auditData&&auditLoadedKey===key,d=fresh?auditData:auditFallback(),r=d.resumo||{},op=operationalPeriod($('#from').value,$('#to').value,$('#dept').value),ratio=op.context.comparable&&op.context.salesTotal>0?Number(r.liquido||0)/op.context.salesTotal:null;
 const topF=(d.top_faltas||[]).map(x=>[x.produto+' · '+x.sku,Number(x.valor||0),money(Number(x.valor||0))]);
 const topS=(d.top_sobras||[]).map(x=>[x.produto+' · '+x.sku,Number(x.valor||0),money(Number(x.valor||0))]);
 const deptRows=(d.departamentos||[]).map(x=>[esc((x.dpto||'')+' · '+(x.departamento||'')),money(Number(x.faltas||0)),money(Number(x.sobras||0)),money(Number(x.liquido||0))]);
 return `<div class="kpis">
   ${card('Faltas de estoque',money(Number(r.faltas||0)),num(Number(r.qtde_falta||0))+' em quantidade',true)}
   ${card('Sobras de estoque',money(Number(r.sobras||0)),num(Number(r.qtde_sobra||0))+' em quantidade')}
   ${card('Resultado líquido do inventário',money(Number(r.liquido||0)),'Faltas − Sobras')}
   ${card('Resultado líquido / venda',ratio==null?'—':pct(ratio),'Mesmo período e departamento')}
   ${card('SKUs auditados',fresh?num(Number(r.skus||0)):'—',fresh?num(Number(r.registros||0))+' movimentos':'Carregando detalhe…')}
  </div>
  <div class="grid2 losses-charts">
   <article class="card"><div class="section-title compact"><div><span class="section-kicker">FALTAS</span><h2>Principais itens acumulados</h2></div></div>${fresh?bars(topF,true):'<div class="loading-state">Carregando principais faltas…</div>'}</article>
   <article class="card"><div class="section-title compact"><div><span class="section-kicker">SOBRAS</span><h2>Principais itens acumulados</h2></div></div>${fresh?bars(topS,false):'<div class="loading-state">Carregando principais sobras…</div>'}</article>
  </div>
  <article class="card table-section"><div class="section-title compact"><div><span class="section-kicker">DEPARTAMENTOS</span><h2>Resultado de auditoria por departamento</h2></div></div>
   <p class="desc">Mostra separadamente faltas e sobras. Resultado líquido = faltas − sobras.</p>
   ${fresh?table(['Departamento','Faltas','Sobras','Resultado líquido'],deptRows):'<div class="loading-state">Carregando departamentos…</div>'}
  </article>
  <article class="card grid-card">
   <div class="section-title"><div><span class="section-kicker">DETALHAMENTO</span><h2>Movimentos de auditoria</h2></div>
    <div class="actions"><button id="auditIndividual" class="${auditMode==='individual'?'primary':''}">Individual</button><button id="auditGrouped" class="${auditMode==='agrupado'?'primary':''}">Agrupado por SKU</button><button id="auditExport">↓ CSV</button></div>
   </div>
   <div class="searchrow">
    <input id="auditSearch" placeholder="Buscar SKU, produto ou departamento" value="${esc(auditQuery)}">
    <select id="auditType"><option value="">Sobras e faltas</option><option value="saida" ${auditType==='saida'?'selected':''}>Somente faltas</option><option value="entrada" ${auditType==='entrada'?'selected':''}>Somente sobras</option></select>
   </div>
   <div class="audit-sortline"><label>Ordenar ${auditMode==='agrupado'?'agrupamento':'movimentos'} <select id="auditSort">
  <option value="faltas_sobras" ${auditSort==='faltas_sobras'?'selected':''}>Faltas primeiro → depois sobras</option>
  <option value="movimentado" ${auditSort==='movimentado'?'selected':''}>Maior movimentação</option>
  <option value="liquido_desc" ${auditSort==='liquido_desc'?'selected':''}>Maior falta líquida</option>
  <option value="liquido_asc" ${auditSort==='liquido_asc'?'selected':''}>Maior sobra líquida</option>
  </select></label><span class="small muted">${auditMode==='agrupado'?'Padrão: todas as faltas do maior para o menor; depois todas as sobras do maior para o menor.':'No individual, a ordenação vale para a página carregada.'}</span></div>
 <div id="auditGrid">${auditGridHtml(fresh?d:null)}</div>
   <p class="small muted">Saída de estoque = falta. Entrada de estoque = sobra. O modo agrupado consolida recorrências do mesmo SKU/departamento no período.</p>
  </article>`;
}
function auditGridHtml(d){
 if(auditLoading&&!d)return '<div class="loading-state">Carregando auditorias do período…</div>';
 if(!d)return '<div class="loading-state">Carregando auditorias do período…</div>';
 const rows=[...(d.linhas||[])],total=Number(d.total_linhas||0),size=50,pages=Math.max(1,Math.ceil(total/size)),pageNow=Math.min(auditPage,pages-1);
 rows.sort((a,b)=>{
  const net=x=>auditMode==='individual'?(x.tipo==='saida'?1:-1)*Number(x.valor||0):Number(x.liquido||0);
  if(auditSort==='faltas_sobras'){
   if(auditMode==='individual'){
    const ga=a.tipo==='saida'?0:1,gb=b.tipo==='saida'?0:1;
    if(ga!==gb)return ga-gb;
    return Number(b.valor||0)-Number(a.valor||0);
   }
   const af=Number(a.faltas||0),bf=Number(b.faltas||0),as=Number(a.sobras||0),bs=Number(b.sobras||0);
   const ga=af>0?0:1,gb=bf>0?0:1;
   if(ga!==gb)return ga-gb;
   if(ga===0)return bf-af||bs-as;
   return bs-as||bf-af;
  }
  if(auditSort==='liquido_asc')return net(a)-net(b);
  if(auditSort==='liquido_desc')return net(b)-net(a);
  return (auditMode==='individual'?Number(b.valor||0)-Number(a.valor||0):Number(b.movimentado||0)-Number(a.movimentado||0));
 });
 if(auditMode==='individual'){
  const body=(auditMode==='individual'?rows:rows.slice(pageNow*size,(pageNow+1)*size)).map(r=>`<tr><td>${esc(r.data||'')}</td><td>${r.tipo==='saida'?'<span class="tag bad">Falta</span>':'<span class="tag good">Sobra</span>'}</td><td>${esc(r.sku||'')}</td><td><button class="p360-link" type="button" data-open-360="${esc(r.sku||'')}" title="Abrir Produto 360°">${esc(r.produto||'')} ↗</button></td><td>${esc(r.departamento||r.dpto||'')}</td><td class="num">${num(Number(r.quantidade||0))}</td><td class="num">${money(Number(r.valor||0))}</td><td class="num">${r.tipo==='saida'?money(Number(r.valor||0)):'− '+money(Number(r.valor||0))}</td></tr>`).join('');
  return `<div class="grid-summary">${num(total)} movimentos<b>${money(Number(d.resumo?.liquido||0))} líquido</b></div><div class="table-wrap"><table class="data-grid"><thead><tr><th>Data</th><th>Tipo</th><th>SKU</th><th>Produto</th><th>Departamento</th><th class="num">Qtde</th><th class="num">Valor</th><th class="num">Impacto</th></tr></thead><tbody>${body||'<tr><td colspan="8">Nenhum movimento neste filtro.</td></tr>'}</tbody></table></div>${auditPager(pageNow,pages,total)}`;
 }
 const body=rows.slice(pageNow*size,(pageNow+1)*size).map(r=>`<tr><td>${esc(r.sku||'')}</td><td><button class="p360-link" type="button" data-open-360="${esc(r.sku||'')}" title="Abrir Produto 360°">${esc(r.produto||'')} ↗</button></td><td>${esc(r.departamento||r.dpto||'')}</td><td class="num">${num(Number(r.ocorrencias||0))}</td><td class="num">${num(Number(r.dias||0))}</td><td class="num">${money(Number(r.faltas||0))}</td><td class="num">${money(Number(r.sobras||0))}</td><td class="num">${money(Number(r.liquido||0))}</td></tr>`).join('');
 return `<div class="grid-summary">${num(total)} produtos/departamentos<b>${money(Number(d.resumo?.liquido||0))} líquido</b></div><div class="table-wrap"><table class="data-grid"><thead><tr><th>SKU</th><th>Produto</th><th>Departamento</th><th class="num">Ocorrências</th><th class="num">Dias</th><th class="num">Faltas</th><th class="num">Sobras</th><th class="num">Resultado líquido</th></tr></thead><tbody>${body||'<tr><td colspan="8">Nenhum item neste filtro.</td></tr>'}</tbody></table></div>${auditPager(pageNow,pages,total)}`;
}
function auditPager(pageNow,pages,total){
 return `<div class="grid-pager"><span>Página ${pageNow+1} de ${pages} · ${num(total)} resultados</span><div><button id="auditPrev" ${pageNow===0?'disabled':''}>←</button><button id="auditNext" ${pageNow>=pages-1?'disabled':''}>→</button></div></div>`;
}
async function loadAuditData(force=false){
 if(!data||page!==4)return;
 const key=auditRequestKey();
 if(!cloud){auditData=auditFallback();auditLoadedKey=key;auditLoading=false;renderAuditGridOnly();return}
 if(!force&&auditLoadedKey===key&&auditData){renderAuditGridOnly();return}
 if(!force&&auditErrorKey===key)return;
 auditLoading=true;renderAuditGridOnly();
 try{
  const r=await request('/rest/v1/rpc/zai_auditorias_periodo',{
   p_loja:activeStore,p_de:$('#from').value,p_ate:$('#to').value,p_dpto:$('#dept').value||null,
   p_tipo:auditType||null,p_busca:auditQuery.trim()||null,p_modo:auditMode,p_limit:auditMode==='agrupado'?50000:50,p_offset:auditMode==='agrupado'?0:auditPage*50
  });
  if(page!==4||key!==auditRequestKey())return;
  auditData=r;auditLoadedKey=key;auditErrorKey='';
 }catch(e){if(key===auditRequestKey()){msg('Auditorias: '+e.message,true);auditData=null;auditLoadedKey='';auditErrorKey=key;}}
 finally{if(page===4&&key===auditRequestKey()){auditLoading=false;render()}}
}
function renderAuditGridOnly(){
 if($('#auditGrid'))$('#auditGrid').innerHTML=auditGridHtml(auditData&&auditLoadedKey===auditRequestKey()?auditData:null);
 if($('#auditGrid'))$('#auditGrid').querySelectorAll('[data-open-360]').forEach(b=>b.onclick=()=>p360SelectSku(b.dataset.open360));
 bindAuditPager();
}
function bindAuditPager(){
 if($('#auditPrev'))$('#auditPrev').onclick=()=>{auditPage=Math.max(0,auditPage-1);if(auditMode==='individual'){auditData=null;auditLoadedKey=''}render()};
 if($('#auditNext'))$('#auditNext').onclick=()=>{auditPage++;if(auditMode==='individual'){auditData=null;auditLoadedKey=''}render()};
}
async function exportAuditCsv(){
 const exportKey=auditRequestKey(),exportMode=auditMode,exportSort=auditSort;
 try{
  msg('Preparando CSV de auditorias…');
  const r=await request('/rest/v1/rpc/zai_auditorias_periodo',{
   p_loja:activeStore,p_de:$('#from').value,p_ate:$('#to').value,p_dpto:$('#dept').value||null,
   p_tipo:auditType||null,p_busca:auditQuery.trim()||null,p_modo:auditMode,p_limit:50000,p_offset:0
  }),rows=[...(r.linhas||[])];
  if(exportKey!==auditRequestKey()||exportMode!==auditMode||exportSort!==auditSort){msg('O filtro ou a ordenação mudou durante a exportação. Gere o CSV novamente.',true);return;}
  if(Number(r.total_linhas||0)>rows.length){msg('A consulta contém mais de '+num(rows.length)+' registros; refine o período, departamento ou busca para exportar sem truncamento.',true);return;}
  rows.sort((a,b)=>{
   const net=x=>auditMode==='individual'?(x.tipo==='saida'?1:-1)*Number(x.valor||0):Number(x.liquido||0);
   if(auditSort==='faltas_sobras'){
    if(auditMode==='individual'){
     const ga=a.tipo==='saida'?0:1,gb=b.tipo==='saida'?0:1;
     if(ga!==gb)return ga-gb;
     return Number(b.valor||0)-Number(a.valor||0);
    }
    const af=Number(a.faltas||0),bf=Number(b.faltas||0),as=Number(a.sobras||0),bs=Number(b.sobras||0);
    const ga=af>0?0:1,gb=bf>0?0:1;
    if(ga!==gb)return ga-gb;
    if(ga===0)return bf-af||bs-as;
    return bs-as||bf-af;
   }
   if(auditSort==='liquido_asc')return net(a)-net(b);
   if(auditSort==='liquido_desc')return net(b)-net(a);
   return Number(b.movimentado??b.valor??0)-Number(a.movimentado??a.valor??0);
  });
  if(auditMode==='individual'){
   csv('auditorias_'+activeStore+'_'+$('#from').value+'_'+$('#to').value+'_individual.csv',
    ['Loja','Data','Tipo','SKU','Produto','Departamento','Quantidade','Valor','Impacto líquido','Documento','Observação'],
    rows.map(x=>[activeStore,x.data,x.tipo==='saida'?'Falta':'Sobra',x.sku,x.produto,x.departamento,String(x.quantidade??0).replace('.',','),Number(x.valor||0).toFixed(2).replace('.',','),(x.tipo==='saida'?Number(x.valor||0):-Number(x.valor||0)).toFixed(2).replace('.',','),x.documento||'',x.observacao||'']));
  }else{
   csv('auditorias_'+activeStore+'_'+$('#from').value+'_'+$('#to').value+'_agrupado.csv',
    ['Loja','SKU','Produto','Departamento','Ocorrências','Dias','Qtde falta','Qtde sobra','Faltas (R$)','Sobras (R$)','Resultado líquido (R$)'],
    rows.map(x=>[activeStore,x.sku,x.produto,x.departamento,x.ocorrencias,x.dias,String(x.qtde_falta??0).replace('.',','),String(x.qtde_sobra??0).replace('.',','),Number(x.faltas||0).toFixed(2).replace('.',','),Number(x.sobras||0).toFixed(2).replace('.',','),Number(x.liquido||0).toFixed(2).replace('.',',')]));
  }
  msg('CSV de auditorias preparado com '+num(rows.length)+' linhas.');
 }catch(e){msg('Não foi possível exportar auditorias: '+e.message,true)}
}
function bindAuditPage(){
 $('#auditIndividual').onclick=()=>{auditMode='individual';auditPage=0;auditData=null;auditLoadedKey='';render()};
 $('#auditGrouped').onclick=()=>{auditMode='agrupado';auditPage=0;auditData=null;auditLoadedKey='';render()};
 $('#auditType').onchange=e=>{auditType=e.target.value;auditPage=0;auditData=null;auditLoadedKey='';render()};
 $('#auditSort').onchange=e=>{auditSort=e.target.value;render()};
 $('#auditSearch').oninput=e=>{auditQuery=e.target.value;auditPage=0;auditData=null;auditLoadedKey='';clearTimeout(auditSearchTimer);auditSearchTimer=setTimeout(()=>{if(page===4)loadAuditData(true)},350)};
 $('#auditExport').onclick=exportAuditCsv;
 bindAuditPager();
 loadAuditData();
}

render();syncStores();if(!$('#login').open)$('#login').showModal();
