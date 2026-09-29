/* Shared shell and operational components. Data/metrics remain in app.js/core.js. */
let lossMode='individual',lossQuery='',lossReason='',lossStatus='',lossPage=0,lossSort='valor',lossDirection=-1;
function syncStores(){
 const stores=cloud?accessibleStores:(data?[{codigo:data.loja,nome:data.nome}]:[]);
 $('#storeSelect').innerHTML=stores.length?stores.map(s=>`<option value="${esc(s.codigo)}">${esc(s.codigo+' · '+s.nome)}</option>`).join(''):'<option value="">Selecione a loja</option>';
 $('#storeSelect').value=activeStore;
}
async function refresh(){
 const version=++requestVersion;
 msg('Carregando dados da filial…');
 try{
  accessibleStores=await request('/rest/v1/rpc/zai_lojas',{});
  if(!accessibleStores.length)throw Error('Sua conta não está autorizada para nenhuma loja. Solicite a liberação ao administrador.');
  if(!accessibleStores.some(x=>x.codigo===activeStore))activeStore=accessibleStores[0].codigo;
  const requested=activeStore,d=await request('/rest/v1/rpc/zai_snapshot',{p_loja:requested});
  if(version!==requestVersion||requested!==activeStore||!session)return;
  if(d.loja!==requested)throw Error('A resposta não corresponde à loja solicitada. Nenhum dado será exibido.');
  setData(d,true);msg('Dados atualizados da loja '+requested+'.');
 }catch(e){if(version===requestVersion){data=null;cloud=false;render();msg(e.message,true);}}
}
$('#refresh').onclick=refresh;
$('#storeSelect').onchange=async e=>{const next=e.target.value;if(!next||next===activeStore)return;activeStore=next;data=null;pending=null;context=null;lossPage=0;lossQuery='';lossReason='';lossStatus='';productQuery='';productStatus='';render();await refresh()};
$('#sidebarToggle').onclick=()=>{const expanded=document.body.classList.toggle('expanded');document.body.classList.toggle('rail',!expanded);$('#sidebarToggle').setAttribute('aria-expanded',String(expanded));$('#sidebarToggle').setAttribute('aria-label',expanded?'Recolher navegação':'Expandir navegação')};
function losses(){
 const c={...context,loss:context.lossAll,lossTotal:context.lossTotalAll,ratio:context.unmatchedLossCount?null:context.ratio},meta=ZAI.lossTarget(data),goal=$('#dept').value?(data.metas||[]).find(x=>x.codigo===$('#dept').value)?.meta_perda:null,target=goal??meta;
 const byReason=new Map();c.loss.forEach(r=>byReason.set(r[3],(byReason.get(r[3])||0)+r[5]));
 return `<div class="kpis">${card('Perdas reconhecidas',money(c.lossTotal),num(c.loss.length)+' ocorrências',true)}${card('Vendas no período',c.sales.length?money(c.salesTotal):'—',c.cut?'Vendas completas até '+c.cut:'Mesmo filtro de loja e departamento')}${card('Perda sobre as vendas',pct(c.ratio),target===null?'Meta da loja não configurada':c.ratio===null?c.unmatchedLossCount?'Aguardando vendas dos dias mais recentes':'Cobertura incompatível':pp(c.ratio-target)+' sobre a referência')}${card(goal!=null?'Meta do departamento':'Meta geral de perdas',pct(target),target!==null&&c.sales.length?'Limite: '+money(c.salesTotal*target):'Aguardando vendas')}</div>
 <div class="grid2 losses-charts"><article class="card"><h2>Perdas por motivo</h2>${bars([...byReason].sort((a,b)=>b[1]-a[1]).slice(0,5))}</article><article class="card"><h2>Departamentos com maior perda</h2>${bars(ZAI.departmentRows(data,c).sort((a,b)=>b.loss-a.loss).slice(0,5).map(r=>[r.name,r.loss]))}</article></div>
 <article class="card grid-card"><div class="section-title"><h2>Detalhamento das perdas</h2><div class="actions"><button id="lossIndividual" class="${lossMode==='individual'?'primary':''}">Individual</button><button id="lossGrouped" class="${lossMode==='grouped'?'primary':''}">Agrupado por SKU</button><button id="lossExport">↓ CSV</button></div></div><div class="searchrow"><input id="lossSearch" placeholder="Buscar SKU ou produto" value="${esc(lossQuery)}"><select id="lossReason" aria-label="Motivo"><option value="">Todos os motivos</option>${[...new Set(c.loss.map(r=>r[3]))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="lossStatus" aria-label="Situação do produto"><option value="">Todos os status</option><option>Ativo</option><option>Inativo</option><option>Nao informado</option></select></div><div id="lossGrid"></div><p class="small muted">Situação atual do cadastro. “Não informado” não significa ativo. Clique nos cabeçalhos para ordenar; o CSV inclui todo o resultado filtrado.</p></article>`;
}
function lossRows(){
 const q=lossQuery.toLocaleLowerCase('pt-BR');let rows=context.lossAll.map(r=>({data:r[0],sku:r[1],produto:data.produtos[r[1]]?.[0]||r[1],dpto:r[2],departamento:data.departamentos[r[2]]||r[2],motivo:r[3],qtde:r[4],valor:r[5],status:data.produtos[r[1]]?.[1]||'Nao informado'})).filter(r=>(!q||(r.sku+' '+r.produto).toLocaleLowerCase('pt-BR').includes(q))&&(!lossReason||r.motivo===lossReason)&&(!lossStatus||r.status===lossStatus));
 if(lossMode==='grouped'){const m=new Map();for(const r of rows){let k=r.sku+'|'+r.dpto;if(!m.has(k))m.set(k,{...r,qtde:0,valor:0,ocorrencias:0,dias:new Set()});let x=m.get(k);x.qtde+=r.qtde;x.valor+=r.valor;x.ocorrencias++;x.dias.add(r.data)}rows=[...m.values()].map(r=>({...r,dias:r.dias.size,media:r.valor/r.ocorrencias}));}
 return rows.sort((a,b)=>{let x=a[lossSort],y=b[lossSort];return lossDirection*(typeof x==='number'?x-y:String(x??'').localeCompare(String(y??''),'pt-BR'))});
}
function renderLossGrid(){
 const rows=lossRows(),size=50,pages=Math.max(1,Math.ceil(rows.length/size));lossPage=Math.min(lossPage,pages-1);
 const cols=lossMode==='individual'?[['data','Data'],['sku','SKU'],['produto','Produto'],['departamento','Departamento'],['motivo','Motivo'],['qtde','Qtde¹'],['valor','Perda']]:[['sku','SKU'],['produto','Produto'],['departamento','Departamento'],['ocorrencias','Ocorrências'],['dias','Dias'],['qtde','Qtde¹'],['media','Média/ocorrência'],['valor','Perda acumulada']];
 $('#lossGrid').innerHTML=`<div class="grid-summary">${num(rows.length)} ${lossMode==='grouped'?'produtos/departamentos':'ocorrências'}<b>${money(rows.reduce((s,r)=>s+r.valor,0))}</b></div><div class="table-wrap"><table class="data-grid"><thead><tr>${cols.map(([k,t])=>`<th aria-sort="${k===lossSort?(lossDirection===1?'ascending':'descending'):'none'}"><button data-sort="${k}">${t}${k===lossSort?(lossDirection===1?' ↑':' ↓'):''}</button></th>`).join('')}</tr></thead><tbody>${rows.slice(lossPage*size,(lossPage+1)*size).map(r=>'<tr>'+cols.map(([k])=>`<td class="${typeof r[k]==='number'?'num':''}">${k==='valor'||k==='media'?money(r[k]):typeof r[k]==='number'?num(r[k]):esc(r[k])}</td>`).join('')+'</tr>').join('')||`<tr><td colspan="${cols.length}">Nenhum lançamento neste filtro.</td></tr>`}</tbody></table></div><div class="grid-pager"><span>Página ${lossPage+1} de ${pages} · 50 linhas por página</span><div><button id="lossPrev" ${lossPage===0?'disabled':''}>←</button><button id="lossNext" ${lossPage>=pages-1?'disabled':''}>→</button></div></div>`;
 $('#lossGrid').querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const k=b.dataset.sort;lossDirection=lossSort===k?-lossDirection:1;lossSort=k;renderLossGrid()});$('#lossPrev').onclick=()=>{lossPage--;renderLossGrid()};$('#lossNext').onclick=()=>{lossPage++;renderLossGrid()};
}
function bindLossGrid(){
 $('#lossReason').value=lossReason;$('#lossStatus').value=lossStatus;renderLossGrid();
 $('#lossIndividual').onclick=()=>{lossMode='individual';lossSort='valor';lossPage=0;render()};$('#lossGrouped').onclick=()=>{lossMode='grouped';lossSort='valor';lossPage=0;render()};
 $('#lossSearch').oninput=e=>{lossQuery=e.target.value;lossPage=0;renderLossGrid()};$('#lossReason').onchange=e=>{lossReason=e.target.value;lossPage=0;renderLossGrid()};$('#lossStatus').onchange=e=>{lossStatus=e.target.value;lossPage=0;renderLossGrid()};
 $('#lossExport').onclick=()=>{const rows=lossRows();csv('perdas_'+activeStore+'_'+lossMode+'.csv',lossMode==='individual'?['Loja','Data','SKU','Produto','Departamento','Motivo','Quantidade origem','Valor']:['Loja','SKU','Produto','Departamento','Ocorrências','Dias','Quantidade origem','Valor'],rows.map(r=>lossMode==='individual'?[activeStore,r.data,r.sku,r.produto,r.departamento,r.motivo,String(r.qtde).replace('.',','),r.valor.toFixed(2).replace('.',',')]:[activeStore,r.sku,r.produto,r.departamento,r.ocorrencias,r.dias,String(r.qtde).replace('.',','),r.valor.toFixed(2).replace('.',',')]))};
}
function bindImportType(){
 $('#reportType').onchange=()=>{
  pending=null;$('#lossFile').value='';$('#importPreview').innerHTML='';const type=$('#reportType').value;
  const info={perdas:'Destino: perdas reconhecidas. JSON do conversor, com data, SKU, departamento, motivo, quantidade e valor total.',vendas:'Destino: vendas diárias. JSON zai-vendas-import-v1 com dias completos explicitamente confirmados. Substitui somente esses dias, com auditoria.',auditorias:'Auditorias: aguardando o layout real de sobras e faltas. A gravação permanece bloqueada para impedir interpretação incorreta dos campos.',trocas:'Trocas: aguardando o layout real, incluindo fornecedor e situação. A gravação permanece bloqueada até validar o contrato de dados.'};
  $('#typeGuide').textContent=info[type]||'Selecione o tipo antes de escolher o arquivo.';
  $('#lossFile').disabled=!cloud||data?.papel!=='importador'||!['perdas','vendas'].includes(type);
  $('#importMode').disabled=type!=='perdas';if(type==='vendas')$('#importMode').value='substituir_dias';else if(type==='perdas')$('#importMode').value='complementar';
 };
}
async function previewByType(file){
 const type=$('#reportType').value;
 if(type==='perdas')return preview(file);
 if(type!=='vendas'||!file){msg('Selecione um tipo de relatório habilitado.',true);return}
 pending=null;try{
  const text=await file.text(),d=JSON.parse(text),rows=d.rows,days=d.dias_completos;
  if(d.schema!=='zai-vendas-import-v1'||d.loja!==activeStore||!Array.isArray(rows)||!rows.length||rows.length>100000||!Array.isArray(days)||!days.length)throw Error('JSON de vendas inválido ou de outra loja. Confira o modelo incluído no pacote.');
  for(const r of rows)ZAI.validateLossImport({schema:'zai-perdas-import-v1',loja:d.loja,rows:[{...r,motivo:'venda'}]},data);
  if(rows.some(r=>!days.includes(r.data))||days.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d).toISOString().slice(0,10)!==d))throw Error('Dias de cobertura inválidos ou incompatíveis com as linhas.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join(''),total=rows.reduce((s,r)=>s+r.valor,0);
  pending={type,rows,days,hash,file:file.name,revision:data.revision};
  $('#importPreview').innerHTML=`<div class="notice"><b>Prévia de vendas · loja ${esc(activeStore)}</b><br>${num(rows.length)} linhas · ${new Set(days).size} dias completos · ${money(total)}<br>Os registros existentes nesses dias serão substituídos; a versão anterior ficará na auditoria.</div><label><span><input id="confirmCheck" type="checkbox"> Confirmo que estes são relatórios completos dos dias informados.</span></label><div class="actions"><button id="commitSales" class="primary">Gravar vendas no Supabase</button></div>`;
  $('#commitSales').onclick=async()=>{if(!$('#confirmCheck').checked)return msg('Confirme a cobertura completa antes de gravar.',true);const p=pending;$('#commitSales').disabled=true;try{const r=await request('/rest/v1/rpc/zai_importar_vendas',{p_loja:activeStore,p_revision:p.revision,p_hash:p.hash,p_arquivo:p.file,p_linhas:p.rows,p_datas:p.days});pending=null;await refresh();msg('Vendas gravadas: '+num(r.registros)+' linhas; '+money(r.valor));}catch(e){msg(e.message,true);if($('#commitSales'))$('#commitSales').disabled=false}};
 }catch(e){msg(e.message,true)}
}
render();syncStores();$('#login').showModal();
