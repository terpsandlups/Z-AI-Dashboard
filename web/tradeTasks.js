
let tradeTasks=[],tradeTaskLoaded='',tradeTaskBusy=false,tradeTaskError='',tradeTaskEditing='';
const tradeTaskStatuses={pendente:'Pendente',em_contato:'Em contato',aguardando_retorno:'Aguardando retorno',concluida:'Concluída',cancelada:'Cancelada'};
const taskStatus=s=>tradeTaskStatuses[s]||'Sem acompanhamento';
const taskOpen=s=>!['concluida','cancelada'].includes(s);
const taskToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function tradeTaskRows(){
 const rows=tradeSupplierRows(tradeFilteredItems()),set=new Set(rows.map(r=>String(r.fornecedor_codigo)));
 return rows.map(x=>({...x,acomp:tradeTasks.find(t=>t.fornecedor_codigo===String(x.fornecedor_codigo))||null}))
 .concat(!tradeSupplier&&!tradeBrand&&!tradeCategory&&!tradeQuery?
   tradeTasks.filter(t=>!set.has(t.fornecedor_codigo)).map(t=>({fornecedor_codigo:t.fornecedor_codigo,fornecedor:'Fornecedor '+t.fornecedor_codigo,valor:0,acomp:t})):[])
 .sort((a,b)=>{
   const key=x=>x?.status==='aguardando_retorno'?0:x?.status==='em_contato'?1:x?.status==='pendente'?2:x?4:3;
   return key(a.acomp)-key(b.acomp)||Number(b.valor||0)-Number(a.valor||0);
 });
}
function tradeTasksPanel(){
 if(!cloud)return '<article class="card"><h2>Trocas 2.0</h2><p>Conecte o Supabase para consultar tratativas.</p></article>';
 const rows=tradeTaskRows(),opened=tradeTasks.filter(t=>taskOpen(t.status)),late=opened.filter(t=>t.prazo&&t.prazo<taskToday());
 return `<section class="trade-workflow">
 <article class="card"><div class="section-title compact"><div><span class="section-kicker">TROCAS 2.0 · EXECUÇÃO</span><h2>Fila de tratativas por fornecedor</h2></div><button id="tradeTaskReload" type="button">↻ Atualizar fila</button></div>
 <p class="desc">O estoque de trocas vem do ERP; a ficha de acompanhamento registra <b>responsável, prazo, próxima ação e histórico</b>. Encerrar uma tarefa não altera a posição do estoque.</p>
 <div class="workflow-kpis">
  <div><small>Em aberto</small><strong>${num(opened.length)}</strong></div>
  <div><small>Prazos vencidos</small><strong>${num(late.length)}</strong></div>
  <div><small>Aguardando retorno</small><strong>${num(opened.filter(t=>t.status==='aguardando_retorno').length)}</strong></div>
  <div><small>Concluídas</small><strong>${num(tradeTasks.filter(t=>t.status==='concluida').length)}</strong></div>
 </div>${tradeTaskBusy?'<p class="small muted">Carregando acompanhamentos…</p>':''}
 ${tradeTaskError?'<div class="notice error">'+esc(tradeTaskError)+'</div>':''}</article>
 <article class="card table-section"><div class="section-title compact"><div><span class="section-kicker">AÇÃO</span><h2>Responsáveis e próximas etapas</h2></div><span class="small muted">${num(rows.length)} fornecedores</span></div>
 ${table(['Fornecedor','Valor posição','Status','Responsável','Prazo','Próxima ação','Gerenciar'],rows.slice(0,50).map(x=>{
  const t=x.acomp,overdue=t?.prazo&&taskOpen(t.status)&&t.prazo<taskToday();
  return [esc((x.fornecedor_codigo||'')+' · '+(x.fornecedor||'')),money(Number(x.valor||0)),
   '<span class="workflow-state '+esc(t?.status||'')+'">'+esc(taskStatus(t?.status))+'</span>',
   esc(t?.responsavel||'—'),(overdue?'<b class="workflow-overdue">Vencido · </b>':'')+esc(t?.prazo||'—'),
   esc(t?.proxima_acao||'A definir'),'<button data-task-code="'+esc(x.fornecedor_codigo)+'" type="button">'+(t?'Atualizar':'Criar ficha')+'</button>'];
 }))}
 ${rows.length>50?'<p class="small muted">Mostrando 50 fornecedores. Use os filtros de Trocas para localizar os demais.</p>':''}
 </article>
 <dialog id="taskDialog" class="workflow-dialog"><form id="taskForm">
  <div class="section-title compact"><div><span class="section-kicker">ACOMPANHAMENTO</span><h2 id="taskTitle">Fornecedor</h2></div><button id="taskClose" type="button">×</button></div>
  <div class="workflow-form">
   <label>Status<select id="taskStatus"><option value="pendente">Pendente</option><option value="em_contato">Em contato</option><option value="aguardando_retorno">Aguardando retorno</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option></select></label>
   <label>Responsável<input id="taskOwner" maxlength="120" placeholder="Ex.: comprador"></label>
   <label>Prazo<input type="date" id="taskDue"></label>
   <label>Próxima ação<input id="taskNext" maxlength="700" placeholder="Ex.: cobrar NF do vendedor"></label>
  </div>
  <label>Observações<textarea id="taskNotes" rows="3" maxlength="2000" placeholder="Contexto, documento, motivo de encerramento"></textarea></label>
  <label>Motivo desta atualização<input id="taskReason" required minlength="8" maxlength="300" placeholder="Ex.: vendedor contatado e prazo atualizado"></label>
  <div id="taskHistory" class="workflow-history"></div>
  <div class="actions"><button type="button" id="taskCancel">Cancelar</button><button class="primary" type="submit" id="taskSave">Salvar acompanhamento</button></div>
 </form></dialog></section>`;
}
async function tradeTasksLoad(force=false){
 if(!cloud||!data||page!==6)return;
 const target=activeStore;if(!force&&tradeTaskLoaded===target)return;
 if(tradeTaskBusy)return;tradeTaskBusy=true;tradeTaskError='';
 try{
  const result=await request('/rest/v1/rpc/zai_trocas_acompanhamentos',{p_loja:target});
  if(target!==activeStore)return;
  tradeTasks=Array.isArray(result)?result:[];tradeTaskLoaded=target;
 }catch(e){tradeTaskError=e.message||'Falha ao ler acompanhamentos';tradeTaskLoaded=target;}
 finally{tradeTaskBusy=false;if(page===6)render();}
}
async function tradeTaskOpen(code){
 if(!cloud||data?.papel!=='importador'){msg('A alteração de tratativas exige perfil importador.',true);return;}
 const t=tradeTasks.find(x=>x.fornecedor_codigo===String(code));
 const row=tradeTaskRows().find(x=>String(x.fornecedor_codigo)===String(code));
 if(!row&&!t)return;
 tradeTaskEditing=String(code);
 $('#taskTitle').textContent=(row?.fornecedor||'Fornecedor')+' · '+code;
 for(const [id,value] of Object.entries({taskStatus:t?.status||'pendente',taskOwner:t?.responsavel||'',taskDue:t?.prazo||'',taskNext:t?.proxima_acao||'',taskNotes:t?.observacao||'',taskReason:''}))$('#'+id).value=value;
 $('#taskHistory').textContent='Carregando histórico…';$('#taskDialog').showModal();
 try{
  const res=await request('/rest/v1/rpc/zai_trocas_historico',{p_loja:activeStore,p_fornecedor:String(code)});
  if(!$('#taskDialog').open||tradeTaskEditing!==String(code))return;
  $('#taskHistory').innerHTML=(res||[]).length?'<h3>Histórico recente</h3>'+res.slice(0,10).map(h=>
   '<p><b>'+esc(new Date(h.data).toLocaleString('pt-BR'))+'</b> · '+esc(h.motivo)+' · '+esc(taskStatus(h.atual?.status))+'</p>').join(''):
   '<p class="small muted">Ainda sem eventos de tratativa.</p>';
 }catch(e){if($('#taskDialog').open)$('#taskHistory').textContent='Histórico indisponível.'}
}
async function tradeTaskSave(event){
 event.preventDefault();
 const code=tradeTaskEditing;if(!code)return;
 const t=tradeTasks.find(x=>x.fornecedor_codigo===code);
 const v=id=>$('#'+id).value.trim();
 if(v('taskReason').length<8){msg('Descreva a atualização com pelo menos 8 caracteres.',true);return;}
 if(['concluida','cancelada'].includes(v('taskStatus'))&&v('taskNotes').length<10){msg('Justifique a conclusão na observação.',true);return;}
 $('#taskSave').disabled=true;
 try{
  await request('/rest/v1/rpc/zai_trocas_salvar_acompanhamento',{
   p_loja:activeStore,p_fornecedor:code,p_status:v('taskStatus'),p_responsavel:v('taskOwner'),
   p_prazo:v('taskDue')||null,p_proxima_acao:v('taskNext'),p_observacao:v('taskNotes'),
   p_motivo:v('taskReason'),p_versao:Number(t?.versao||0)
  });
  $('#taskDialog').close();tradeTaskEditing='';tradeTaskLoaded='';
  await tradeTasksLoad(true);msg('Tratativa salva com histórico para o fornecedor '+code+'.');
 }catch(e){msg('Falha ao salvar tratativa: '+e.message,true);}
 finally{if($('#taskSave'))$('#taskSave').disabled=false;}
}
function tradeTasksBind(){
 if(!$('#tradeTaskReload'))return;
 $('#tradeTaskReload').onclick=()=>{tradeTaskLoaded='';void tradeTasksLoad(true)};
 document.querySelectorAll('[data-task-code]').forEach(b=>{
   b.disabled=!cloud||data?.papel!=='importador';
   b.onclick=()=>tradeTaskOpen(b.dataset.taskCode);
 });
 $('#taskClose').onclick=$('#taskCancel').onclick=()=>$('#taskDialog').close();
 $('#taskForm').onsubmit=tradeTaskSave;
 void tradeTasksLoad();
}
