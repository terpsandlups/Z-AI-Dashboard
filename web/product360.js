/* Produto 360°: dados consultados diretamente na RPC, sem somar tabelas de fatos por JOIN. */
let p360Sku='',p360Query='',p360Result=null,p360Error='',p360Loading=false,p360CacheKey='',p360PendingKey='',p360Limit=60;

function p360Options(){
 if(!data?.produtos)return [];
 const q=String(p360Query||'').trim().toLocaleLowerCase('pt-BR');
 if(q.length<2)return [];
 const result=[];
 for(const [sku,product] of Object.entries(data.produtos)){
  const desc=String(Array.isArray(product)?product[0]:product||'');
  if(sku.includes(q)||desc.toLocaleLowerCase('pt-BR').includes(q)){
   result.push({sku,desc});
   if(result.length>=12)break;
  }
 }
 result.sort((a,b)=>(a.sku===q?-1:b.sku===q?1:0)||a.desc.localeCompare(b.desc,'pt-BR'));
 return result;
}

function p360Suggestions(){
 const candidates=p360Options();
 return candidates.length?candidates.map(x=>`<button type="button" class="p360-result" data-p360-pick="${esc(x.sku)}" title="Consultar SKU ${esc(x.sku)}"><strong>${esc(x.sku)}</strong><span>${esc(x.desc)}</span><span class="p360-go">Consultar →</span></button>`).join(''):
 '<p class="small muted">Digite pelo menos 2 caracteres do SKU ou nome para localizar um produto.</p>';
}

function p360QuickPicks(){
 if(!data?.perdas)return '';
 const from=$('#from')?.value||'',to=$('#to')?.value||'',dept=$('#dept')?.value||'';
 const totals=new Map();
 for(const r of data.perdas){
  if(!r?.[1]||r[0]<from||r[0]>to||(dept&&r[2]!==dept))continue;
  const key=String(r[1]);
  totals.set(key,(totals.get(key)||0)+Number(r[5]||0));
 }
 const selected=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,6);
 return selected.length?`<div class="p360-quick"><span class="small muted">Produtos com perdas reconhecidas no período:</span><div class="actions">${selected.map(([sku,value])=>`<button type="button" data-p360-pick="${esc(sku)}">${esc(sku)} · ${money(value)}</button>`).join('')}</div></div>`:'';
}

function p360AsText(date){
 if(!date)return '—';
 const t=String(date).slice(0,10).split('-');
 return t.length===3?t.reverse().join('/'):String(date);
}

function p360Page(){
 if(!data)return `<article class="card"><h2>Produto 360°</h2><p>Entre na conta para pesquisar os produtos autorizados para a loja.</p></article>`;
 const selectTitle=p360Sku?(data.produtos?.[p360Sku]?.[0]||p360Sku):'';
 const chosen=p360Result?.sku===p360Sku?p360Result:null;
 const d=chosen?.totais||{};
 const cover=chosen?.cobertura;
 const full=cover?.completa===true;
 const totalEvents=Number(d.eventos||0);
 const result=chosen&&totalEvents?`
  <div class="p360-title"><div><p class="eyebrow">FICHA ANALÍTICA DO PRODUTO</p><h2>${esc(chosen.produto||selectTitle)}</h2><p class="small muted">SKU ${esc(chosen.sku)} · ${esc(chosen.marca||'Marca não cadastrada')} · ${esc(chosen.situacao||'Situação não informada')}</p></div><button id="p360Export" type="button">Exportar lançamentos CSV</button></div>
  ${!full?`<div class="notice">Cobertura de vendas incompleta: ${num(cover?.dias_cobertos||0)} de ${num(cover?.dias_periodo||0)} dias. Os valores conhecidos são exibidos, mas <strong>a taxa de perdas fica indisponível</strong> para evitar comparação distorcida.</div>`:`<p class="small muted">Cobertura integral de vendas: ${num(cover?.dias_cobertos||0)} de ${num(cover?.dias_periodo||0)} dias. Percentual calculado no mesmo período selecionado.</p>`}
  <div class="kpis">
    ${card('Vendas totais',money(Number(d.vendas||0)),num(Number(d.quantidade_vendida||0))+' unidades de origem')}
    ${card('Perdas reconhecidas',money(Number(d.reconhecidas||0)),num(d.ocorrencias_quebra||0)+' ocorrências')}
    ${card('Faltas de estoque',money(Number(d.faltas||0)),num(d.ocorrencias_falta||0)+' movimentações')}
    ${card('Sobras de estoque',money(Number(d.sobras||0)),num(d.ocorrencias_sobra||0)+' movimentações')}
    ${card('Perda consolidada',money(Number(d.consolidadas||0)),'Reconhecidas + faltas − sobras',true)}
    ${card('Perda / vendas',full&&d.percentual!=null?pct(Number(d.percentual)):'—',full?'Com base nas vendas do período':'Dados não comparáveis')}
  </div>
  <div class="grid2">
   <article class="card table-section"><h2>Departamentos do produto</h2><p class="desc">As fontes são somadas por departamento, sem multiplicar linhas entre vendas, quebras e auditorias.</p>
    ${table(['Departamento','Vendas','Reconhecidas','Faltas','Sobras','Consolidada'],(chosen.departamentos||[]).map(r=>[
     esc((r.codigo||'')+' · '+(r.nome||data.departamentos?.[r.codigo]||'')),money(Number(r.vendas||0)),money(Number(r.reconhecidas||0)),money(Number(r.faltas||0)),money(Number(r.sobras||0)),money(Number(r.reconhecidas||0)+Number(r.faltas||0)-Number(r.sobras||0))
    ]))}
   </article>
   <article class="card table-section"><h2>Motivos e recorrências</h2><p class="desc">Detalhamento das perdas reconhecidas. Pequenas ocorrências repetidas aparecem acumuladas.</p>
    ${table(['Motivo original','Ocorrências','Total'],(chosen.motivos||[]).map(r=>[esc(r.motivo||'Não informado'),num(Number(r.ocorrencias||0)),money(Number(r.valor||0))]))}
   </article>
  </div>
  <article class="card table-section"><h2>Evolução diária do SKU</h2><p class="desc">Dias com movimento de venda, perda reconhecida ou ajuste de estoque. Dias sem movimento não são inventados.</p>
    ${table(['Data','Vendas','Reconhecidas','Faltas','Sobras','Consolidada'],(chosen.diario||[]).slice(-45).reverse().map(r=>[
     p360AsText(r.data),money(Number(r.vendas||0)),money(Number(r.reconhecidas||0)),money(Number(r.faltas||0)),money(Number(r.sobras||0)),
     money(Number(r.reconhecidas||0)+Number(r.faltas||0)-Number(r.sobras||0))
    ]))}
    ${(chosen.diario||[]).length>45?'<p class="small muted">Mostrando os 45 dias de movimentação mais recentes do recorte.</p>':''}
  </article>
  <article class="card table-section"><div class="section-title compact"><div><span class="section-kicker">RASTREABILIDADE</span><h2>Movimentos que formam os indicadores</h2></div><span class="small muted">${num(totalEvents)} movimentos encontrados</span></div>
   <p class="desc">Cada linha conserva sua origem e o ID do lote para conferência com a Central de Importações.</p>
   ${table(['Data','Fonte','Departamento','Qtde','Valor','Motivo / documento','Lote'],(chosen.movimentos||[]).slice(0,p360Limit).map(r=>[
    p360AsText(r.data),esc(({venda:'Venda',reconhecida:'Perda reconhecida',falta:'Falta / saída',sobra:'Sobra / entrada'})[r.tipo]||r.tipo),
    esc(r.departamento||'—'),num(Number(r.quantidade||0)),money(Number(r.valor||0)),
    esc(r.detalhe||'—'),esc(r.lote_id||'—')
   ]))}
   ${totalEvents>200?'<p class="small muted">A consulta retorna os 200 lançamentos mais recentes. Os totais consideram todas as movimentações do período, sem esse limite.</p>':''}
   ${(chosen.movimentos||[]).length>p360Limit?'<div class="actions"><button id="p360More" type="button">Exibir mais lançamentos</button></div>':''}
  </article>`:
  chosen?`<article class="card empty"><h2>Nenhum movimento neste período</h2><p>O SKU existe no cadastro, mas não há vendas, perdas ou auditorias para o intervalo e departamento escolhidos.</p></article>`:
  p360Loading?'<article class="card"><p>Consultando vendas, perdas e auditorias do produto no Supabase…</p></article>':
  p360Error?`<article class="card"><div class="notice">${esc(p360Error)}</div><p class="small muted">Confira o período e a autorização para a loja.</p></article>`:
  `<article class="card"><h2>Pesquise um SKU para começar</h2><p class="desc">A ficha vai reunir vendas, quebras, faltas, sobras e recorrências. Os números são consultados na base da loja selecionada, não em planilhas geradas manualmente.</p>${p360QuickPicks()}</article>`;
 return `<section class="p360-head"><p class="eyebrow">ANÁLISE TRANSVERSAL POR PRODUTO</p><h2>Produto 360°</h2><p class="desc">Uma única consulta reúne as fontes do SKU no período. Clique em um produto sugerido ou informe seu código exato.</p>
  <div class="p360-search-line"><label class="p360-search-label">SKU ou descrição do produto<input id="p360Query" type="search" autocomplete="off" placeholder="Ex.: 188816 ou Danoninho" value="${esc(p360Query)}"></label><button class="primary" id="p360SearchBtn" type="button">Consultar SKU</button><button id="p360Clear" type="button">Limpar</button></div>
  <div id="p360Suggestions" class="p360-suggestions">${p360Suggestions()}</div><p class="small muted">A pesquisa usa o cadastro da loja. Os filtros globais de período e departamento também são aplicados.</p>
 </section>
 ${result}`;
}

function p360SelectSku(sku){
 if(!/^\d{1,32}$/.test(String(sku)))return;
 p360Sku=String(sku);p360Query=String(sku);p360Result=null;p360Error='';p360CacheKey='';p360PendingKey='';p360Limit=60;
 page=8;render();
}

function p360BindSuggestions(){
 const root=$('#p360Suggestions');if(!root)return;
 root.innerHTML=p360Suggestions();
 root.querySelectorAll('[data-p360-pick]').forEach(b=>b.onclick=()=>p360SelectSku(b.dataset.p360Pick));
}

function p360Bind(){
 const query=$('#p360Query');if(!query)return;
 query.oninput=e=>{p360Query=e.target.value;p360BindSuggestions()};
 query.onkeydown=e=>{if(e.key==='Enter'){$('#p360SearchBtn').click()}};
 $('#p360SearchBtn').onclick=()=>{
  const q=p360Query.trim(),sku=q.match(/^\d{1,32}$/)?.[0];
  if(sku)return p360SelectSku(sku);
  const options=p360Options();
  if(options.length===1)return p360SelectSku(options[0].sku);
  msg('Selecione um SKU da lista de resultados para consultar a ficha.',true);
 };
 $('#p360Clear').onclick=()=>{p360Sku='';p360Query='';p360Result=null;p360Error='';p360CacheKey='';p360PendingKey='';render()};
 p360BindSuggestions();
 if($('#p360More'))$('#p360More').onclick=()=>{p360Limit=Math.min(200,p360Limit+70);render()};
 if($('#p360Export'))$('#p360Export').onclick=()=>{
  const rows=p360Result?.movimentos||[];
  csv('produto_360_'+activeStore+'_'+p360Sku+'_'+$('#from').value+'_'+$('#to').value+'.csv',
   ['Loja','SKU','Produto','Data','Fonte','Departamento','Quantidade','Valor','Motivo ou documento','Lote'],
   rows.map(r=>[activeStore,p360Sku,p360Result.produto,r.data,r.tipo,r.departamento,r.quantidade,r.valor,r.detalhe||'',r.lote_id]));
  msg('CSV do produto preparado com '+num(rows.length)+' movimentos'+(Number(p360Result?.totais?.eventos||0)>rows.length?' (apenas os mais recentes do limite de consulta).':'.'));
 };
 if(p360Sku)void p360Load();
}

async function p360Load(){
 if(!cloud||!session||page!==8||!p360Sku)return;
 const from=$('#from')?.value||'',to=$('#to')?.value||'',dept=$('#dept')?.value||'';
 const key=[activeStore,p360Sku,from,to,dept,data?.revision].join('|');
 if(key===p360CacheKey&&p360Result)return;
 if(key===p360PendingKey)return;
 p360PendingKey=key;p360Loading=true;p360Error='';p360Result=null;
 const target=$('#p360Query');
 if(target)target.disabled=true;
 try{
  const response=await request('/rest/v1/rpc/zai_produto_360',{
    p_loja:activeStore,p_sku:p360Sku,p_de:from,p_ate:to,p_dpto:dept||null
  });
  if(key!==[activeStore,p360Sku,$('#from')?.value||'',$('#to')?.value||'',$('#dept')?.value||'',data?.revision].join('|')||page!==8)return;
  p360Result=response;p360CacheKey=key;
 }catch(e){if(page===8)p360Error=e.message||'Falha ao consultar produto';}
 finally{p360Loading=false;p360PendingKey='';if(page===8)render();}
}
