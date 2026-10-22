// Produto 360: apresentação de totais separados por origem e tratamento de cobertura.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../web/product360.js'),'utf8');
const fields={'#from':{value:'2026-10-14'},'#to':{value:'2026-10-20'},'#dept':{value:''}};
const p={
 sku:'323209',produto:'Queijo Mussarela Montekali Kg',marca:'Montekali',
 situacao:'Ativo',cobertura:{dias_periodo:7,dias_cobertos:7,completa:true},
 totais:{vendas:31053.45,quantidade_vendida:1500,reconhecidas:120,
 faltas:30,sobras:10,consolidadas:140,percentual:140/31053.45,
 eventos:12,ocorrencias_quebra:4,ocorrencias_falta:1,ocorrencias_sobra:1},
 departamentos:[{codigo:'026',nome:'Frios',vendas:31053.45,reconhecidas:120,faltas:30,sobras:10}],
 motivos:[{motivo:'Vencido',ocorrencias:4,valor:120}],
 diario:[{data:'2026-10-20',vendas:1000,reconhecidas:120,faltas:30,sobras:10}],
 movimentos:[{id:1,lote_id:45,data:'2026-10-20',tipo:'reconhecida',
 departamento:'026',quantidade:3,valor:120,detalhe:'Vencido'}]
};
const inputNames=['data','$','esc','money','num','pct','card','table','cloud','session','page','activeStore','request','render','csv','msg'];
const mocks=[
 {loja:'007',produtos:{'323209':['Queijo Mussarela Montekali Kg','Ativo']},perdas:[],departamentos:{'026':'Frios'}},
 selector=>fields[selector]||{value:'',querySelectorAll:()=>[]},
 v=>String(v??'').replace(/[&<>"]/g,''),
 v=>'R$ '+Number(v||0).toFixed(2),
 v=>String(v),
 v=>(v*100).toFixed(2)+'%',
 (label,value,note)=>[label,value,note].join(' | '),
 (columns,rows)=>JSON.stringify({columns,rows}),
 true,{},8,'007',async()=>p,()=>{},()=>{},()=>{}
];
const make=fixture=>new Function(...inputNames,source+
 ';p360Sku="323209";p360Query="323209";p360Result='+JSON.stringify(fixture)+';return p360Page();'
)(...mocks);
const complete=make(p);
assert(complete.includes('Produto 360°'));
assert(complete.includes('Queijo Mussarela Montekali Kg'));
assert(complete.includes('Perda consolidada'));
assert(complete.includes('R$ 140.00'));
assert(complete.includes('R$ 31053.45'));
assert(complete.includes('Vencido'));
assert(complete.includes('Cobertura integral de vendas'));
assert(complete.includes('Lote'));

const partial=make({...p,cobertura:{...p.cobertura,dias_cobertos:5,completa:false},
 totais:{...p.totais,percentual:null}});
assert(partial.includes('Cobertura de vendas incompleta'));
assert(partial.includes('Dados não comparáveis'));
assert(!partial.includes('R$ 0.00 | Dados não comparáveis'));

const lookup=new Function(...inputNames,source+
 ';p360Query="Queijo";return p360Options();'
)(...mocks);
assert.equal(lookup[0].sku,'323209');
console.log('OK: Produto 360, KPIs, rastreabilidade, busca e cobertura.');
