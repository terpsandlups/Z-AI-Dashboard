// Teste de regressão: resumo mensal histórico por SKU no frontend.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../web'),nodes={};
const node=id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},querySelectorAll:()=>[],addEventListener:()=>{},setAttribute:()=>{},showModal:()=>{},close:()=>{},focus:()=>{},closest:()=>({hidden:false}),classList:{toggle:()=>false}});
const sandbox={console,Intl,Date,Map,Set,URL,URLSearchParams,Blob,TextEncoder,setTimeout,clearTimeout,location:{hash:'',origin:'http://localhost',pathname:'/',search:''},history:{replaceState:()=>{}},document:{querySelector:node,querySelectorAll:()=>[],body:{classList:{toggle:()=>false}}},window:{ZAI_CONFIG:{}}};
vm.createContext(sandbox);
for(const file of ['core.js','app.js','product360.js','tradeTasks.js','recurrence.js','ui.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
 if(file==='core.js')sandbox.ZAI=sandbox.window.ZAI;
}
const fixture=require('./fixture.cjs')();
fixture.vendas_mensais=[['2026-01','','001',3,300]];
fixture.dias_vendas_completos=Array.from({length:31},(_,i)=>'2026-01-'+String(i+1).padStart(2,'0'));
fixture.vendas_diarias_resumo=[['2026-01-01','001',300]];
fixture.perdas=[];
sandbox.fixture=fixture;
vm.runInContext('setData(fixture,false)',sandbox);
vm.runInContext("$('#from').value='2026-01-01';$('#to').value='2026-01-31';commitGlobalFilters();page=2;render()",sandbox);
assert.equal(vm.runInContext('context.salesTotal',sandbox),300);
vm.runInContext("cloud=true;salesProductKey='';session={access_token:'fake',expires_at:9999999999};request=async(path,args)=>{if(!path.endsWith('zai_vendas_produtos_pagina')||args.p_de!=='2026-01-01'||args.p_ate!=='2026-01-31'||args.p_loja!=='007')throw Error('Wrong RPC or interval');return {linhas:[{sku:'100',produto:'Produto fictício',dpto:'001',quantidade:3,valor:300,situacao:'Ativo'}],total_geral:1,total_filtrado:1,valor_geral:300,valor_filtrado:300,pagina:args.p_pagina,tamanho:40}};",sandbox);
(async()=>{
 await vm.runInContext('loadSalesProducts()',sandbox);
 assert.equal(vm.runInContext('salesProductRows.length',sandbox),1);
 assert(nodes['#products'].innerHTML.includes('Produto fictício'));
 assert.equal(vm.runInContext('salesProductInfo.total_geral',sandbox),1);
 assert(nodes['#products'].innerHTML.includes('Produtos no período'));
 assert(nodes['#products'].innerHTML.includes('Página'));

 assert(nodes['#products'].innerHTML.includes('2026-01'));
 assert(!nodes['#products'].innerHTML.includes('Importe as vendas diárias'));
 assert(!nodes['#products'].innerHTML.includes('não coincide'));
 console.log('OK: históricos mensais por SKU sem reimportação, com conciliação.');
})().catch(e=>{console.error(e);process.exitCode=1;});
