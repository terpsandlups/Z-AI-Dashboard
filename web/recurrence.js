
/* Perdas recorrentes: recorrencia por dias distintos, nao por quantidade de linhas. */
let recMinDays=3,recMaxEvent='',recOrder='impacto',recQuery='',recResult=null,recKey='',recPending='',recError='';
function recQueryKey(){
 return [activeStore,data?.revision,$('#from')?.value,$('#to')?.value,$('#dept')?.value,recMinDays,recMaxEvent,recOrder].join('|');
}
function recRows(){
 const q=String(recQuery||'').toLocaleLowerCase('pt-BR').trim();
 return (recResult?.linhas||[]).filter(r=>!q||[r.sku,r.produto,r.dpto,r.departamento].join(' ').toLocaleLowerCase('pt-BR').includes(q));
}
function recPage(){
 if(!data)return '<article class="card"><h2>Inteligência de recorrência</h2><p>Entre na sua loja para consultar os lançamentos.</p></article>';
 if(!cloud)return '<article class="card"><h2>Inteligência de recorrência</h2><p>Esta análise consulta os movimentos detalhados do Supabase e exige sessão autenticada.</p></article>';
 const rows=recRows(),sum=recResult?.resumo||{},total=Number(sum.perdas_periodo||0),repeated=Number(sum.perda_recorrente||0),share=total>0?repeated/total:null;
 const options=[['impacto','Maior perda acumulada'],['frequencia','Mais dias com perdas']].map(([key,name])=>
   '<option value="'+key+'" '+(recOrder===key?'selected':'')+'>'+name+'</option>').join('');
 const bars1=rows.slice().sort((a,b)=>Number(b.total)-Number(a.total)).slice(0,8).map(x=>
   [(x.produto||'SKU '+x.sku).slice(0,38)+' · '+x.sku,Number(x.total||0),money(Number(x.total||0))]);
 const bars2=rows.slice().sort((a,b)=>Number(b.dias)-Number(a.dias)).slice(0,8).map(x=>
   [(x.produto||'SKU '+x.sku).slice(0,34)+' · '+x.sku,Number(x.dias||0),num(x.dias)+' dias']);
 return `<div class="rec-head card">
   <span class="section-kicker">INTELIGÊNCIA DE RECORRÊNCIA</span><h2>Pequenas perdas que se tornam grandes</h2>
   <p class="desc">Detecta SKUs com quebra em <strong>dias diferentes</strong>, não apenas linhas repetidas. O ranking prioriza a <strong>perda acumulada</strong>: um item com R$ 20 por dia durante 20 dias (R$ 400) supera um evento isolado de R$ 300.</p>
   <div class="rec-filters">
    <label>Dias mínimos com perdas<select id="recDays">
     ${[2,3,5,10].map(d=>'<option value="'+d+'" '+(recMinDays===d?'selected':'')+'>'+d+' dias</option>').join('')}
    </select></label>
    <label>Limitar valor de cada lançamento<select id="recMax">
     <option value="">Sem limite</option>${[30,50,100,200].map(v=>'<option value="'+v+'" '+(String(recMaxEvent)===String(v)?'selected':'')+'>Até '+money(v)+'</option>').join('')}
    </select></label>
    <label>Ordenação<select id="recOrder">${options}</select></label>
    <label>Localizar SKU / produto<input id="recSearch" value="${esc(recQuery)}" placeholder="Código ou descrição"></label>
    <div class="rec-actions"><button id="recReload">↻ Atualizar</button><button id="recCsv" type="button">↓ Exportar CSV</button></div>
   </div>
   <p class="small muted">O filtro “valor por lançamento” é rigoroso: só inclui produtos cuja <strong>maior ocorrência individual</strong> no período respeite o limite selecionado. Isso ajuda a revelar quebras repetidas de baixo valor.</p>
 </div>
 ${recError?'<div class="notice error">'+esc(recError)+'</div>':''}
 ${!recResult?'<article class="card"><p>Consultando a recorrência da loja no período selecionado…</p></article>':
 `<div class="kpis rec-kpis">
    ${card('Perdas reconhecidas no período',money(total),'Todos os lançamentos do recorte')}
    ${card('Perdas de produtos recorrentes',money(repeated),num(sum.produtos_recorrentes||0)+' produtos que atendem ao critério',true)}
    ${card('Participação recorrente',share==null?'—':pct(share),'Recorrentes / perda reconhecida')}
    ${card('Produtos reincidentes',num(sum.produtos_recorrentes||0),recMinDays+' ou mais dias distintos')}
   </div>
   <div class="grid2 rec-charts">
    <article class="card"><div class="section-title compact"><div><span class="section-kicker">IMPACTO ACUMULADO</span><h2>Maiores perdas recorrentes</h2></div></div>${bars(bars1,true)}</article>
    <article class="card"><div class="section-title compact"><div><span class="section-kicker">FREQUÊNCIA</span><h2>Mais dias com quebras</h2></div></div>${bars(bars2,true)}</article>
   </div>
   <article class="card table-section rec-queue"><div class="section-title compact"><div><span class="section-kicker">RANKING INVESTIGATIVO</span><h2>Produtos para acompanhar</h2></div><span class="small muted">${num(rows.length)} produtos exibidos</span></div>
     <p class="desc">A média por dia considera os <b>dias em que houve perda</b>. Clique em um produto para abrir seu histórico no Produto 360°.</p>
     ${table(['SKU / Produto','Departamento','Dias distintos','Ocorrências','Maior lançamento','Média / dia com perda','Perda acumulada','Investigação'],
      rows.map(r=>[
      '<button class="rec-sku-link p360-link" type="button" data-rec-sku="'+esc(r.sku)+'">'+esc(r.sku+' · '+(r.produto||''))+' ↗</button>',
      esc((r.dpto||'')+' · '+(r.departamento||'')),num(Number(r.dias||0)),num(Number(r.ocorrencias||0)),
      money(Number(r.maior_lancamento||0)),money(Number(r.media_dia_com_perda||0)),money(Number(r.total||0)),
      '<button type="button" data-rec-sku="'+esc(r.sku)+'">Produto 360°</button>'
     ]))}
     <p class="small muted">Ordenação no banco, até 300 produtos por consulta. O CSV contém somente os registros retornados. O período máximo é 366 dias.</p>
   </article>`}
 `;
}
async function recLoad(force=false){
 if(!cloud||!data||page!==9)return;
 const key=recQueryKey();
 if(!force&&recKey===key&&recResult)return;
 if(recPending===key)return;
 recPending=key;recError='';
 try{
   const r=await request('/rest/v1/rpc/zai_perdas_recorrencia',{
     p_loja:activeStore,p_de:$('#from').value,p_ate:$('#to').value,p_dpto:$('#dept').value||null,
     p_min_dias:recMinDays,p_limite_lancamento:recMaxEvent?Number(recMaxEvent):null,
     p_order:recOrder,p_limit:200
   });
   if(page!==9||key!==recQueryKey())return;
   recResult=r;recKey=key;
 }catch(e){if(key===recQueryKey()){recError=e.message;recResult=null;}}
 finally{if(recPending===key)recPending='';if(page===9&&key===recQueryKey())render();}
}
function recBind(){
 if(!$('#recDays'))return;
 $('#recDays').onchange=e=>{recMinDays=Number(e.target.value);recResult=null;recKey='';render()};
 $('#recMax').onchange=e=>{recMaxEvent=e.target.value;recResult=null;recKey='';render()};
 $('#recOrder').onchange=e=>{recOrder=e.target.value;recResult=null;recKey='';render()};
 $('#recSearch').oninput=e=>{recQuery=e.target.value;recRenderTableOnly()};
 $('#recReload').onclick=()=>{recKey='';recResult=null;void recLoad(true)};
 $('#recCsv').onclick=()=>{
  const r=recRows();
  csv('recorrencia_'+activeStore+'_'+$('#from').value+'_'+$('#to').value+'.csv',
    ['Loja','SKU','Produto','Departamento','Dias com perda','Ocorrências','Maior lançamento','Média por lançamento','Média por dia com perda','Perda acumulada','Primeira perda','Última perda'],
    r.map(x=>[activeStore,x.sku,x.produto,x.dpto,x.dias,x.ocorrencias,x.maior_lancamento,x.media_lancamento,x.media_dia_com_perda,x.total,x.primeira,x.ultima]));
  msg('CSV de recorrência preparado com '+num(r.length)+' produtos.');
 };
 document.querySelectorAll('[data-rec-sku]').forEach(b=>b.onclick=()=>p360SelectSku(b.dataset.recSku));
 void recLoad();
}
function recRenderTableOnly(){
 // A pesquisa altera somente o recorte local e não refaz as consultas no banco.
 const current=document.activeElement,where=current?.id==='recSearch'?current.selectionStart:null;
 render();
 const input=$('#recSearch');
 if(where!==null&&input){input.focus();input.setSelectionRange(where,where);}
}
