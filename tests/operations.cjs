// Regressões operacionais da Trocas 2.0 e da Inteligência de Recorrência.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../web');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const tr=read('tradeTasks.js'),rc=read('recurrence.js');
new Function(tr);new Function(rc);
const metrics={dias:20,ocorrencias:20,total:400,maior_lancamento:20,media_dia_com_perda:20};
const recurring={sku:'100',produto:'Produto de teste',dpto:'015',departamento:'Padaria',...metrics};
const recArgs=['data','cloud','activeStore','page','$','esc','num','money','pct','card','table','bars'];
const recMocks=[{loja:'007'},true,'007',9,s=>({value:s==='#from'?'2026-10-01':s==='#to'?'2026-10-21':''}),
 v=>String(v),v=>String(v),v=>'R$ '+v,v=>Number(v)*100+'%',
 (label,val)=>label+' '+val,(h,rows)=>JSON.stringify(rows),rows=>JSON.stringify(rows)];
const recHtml=new Function(...recArgs,rc+
 ';recResult={resumo:{perdas_periodo:800,perda_recorrente:400,produtos_recorrentes:1},linhas:'+JSON.stringify([recurring])+'};return recPage();'
)(...recMocks);
assert(recHtml.includes('Produto de teste'));
assert(recHtml.includes('R$ 400'));
assert(recHtml.includes('20 dias'));
assert(recHtml.includes('data-rec-sku'));
assert(recHtml.includes('Recorrência')||recHtml.includes('recorrência'));
const tradeArgs=['data','cloud','tradeSupplierRows','tradeFilteredItems','tradeSupplier','tradeBrand','tradeCategory','tradeQuery','num','money','esc','table'];
const tradeMocks=[{trocas_itens:[]},true,()=>[{fornecedor_codigo:'1120',fornecedor:'Fornecedor de teste',valor:120}],()=>[],
 '','','','',v=>String(v),v=>'R$ '+v,v=>String(v),(h,r)=>JSON.stringify(r)];
const tradeHtml=new Function(...tradeArgs,tr+
 ';tradeTasks=[{fornecedor_codigo:"1120",status:"aguardando_retorno",responsavel:"Comprador",prazo:"2020-01-01",proxima_acao:"Cobrar nota",versao:1}];return tradeTasksPanel();'
)(...tradeMocks);
assert(tradeHtml.includes('Fornecedor de teste'));
assert(tradeHtml.includes('Comprador'));
assert(tradeHtml.includes('Cobrar nota'));
assert(tradeHtml.includes('Vencido'));
assert(tradeHtml.includes('taskDialog'));
console.log('OK: Recorrência e Trocas 2.0 renderizam os dados, estados e ações.');
