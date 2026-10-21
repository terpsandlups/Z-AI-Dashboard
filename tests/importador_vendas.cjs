// Regressão do importador horizontal de vendas: erro source++ e dias sem movimentação.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const parser=source.slice(source.indexOf('async function parseSalesFile'),source.indexOf('function filenameDate'));
const batcher=source.slice(source.indexOf('function salesBatches'),source.indexOf('async function chunkHash'));
const dateParser=source.slice(source.indexOf('function isoDate(v)'),source.indexOf('function skuText(v)'));
const isoDate=new Function('window',dateParser+'; return isoDate')({});
const matrix=[
 ['Código','Descrição','Complemento','Cód. Dpto','Cód. Grupo','Marca','14/10/2026 Qua','14/10/2026 Qua','14/10/2026 Qua','15/10/2026 Qui','15/10/2026 Qui','15/10/2026 Qui'],
 ['','','','','','','Vendas','Quantidade','Ct Empresa','Vendas','Quantidade','Ct Empresa'],
 ['100','Produto fictício','','015','','',33.6,2,20,0,0,0]
];
const parse=new Function('matrixFrom','hnorm','skuText','deptCode','data',parser+'; return parseSalesFile')(
 async()=>matrix,
 v=>String(v??'').trim().toLowerCase(),
 v=>String(v??''),
 v=>String(v).padStart(3,'0'),
 {produtos:{}}
);
const salesBatches=new Function(batcher+'; return salesBatches')();
(async()=>{
 process.env.TZ='America/Sao_Paulo';
 assert.equal(isoDate(new Date('2026-10-20T00:00:00Z')),'2026-10-20','não antecipar um dia no fuso do Brasil');
 assert.equal(isoDate('2026-10-20'),'2026-10-20');
 const parsed=await parse({});
 assert.equal(parsed.source,1,'source++ deve contar linhas de venda sem TypeError');
 assert.deepEqual(parsed.dates,['2026-10-14'],'dias inteiramente zerados não são importados');
 assert.deepEqual(parsed.emptyDates,['2026-10-15']);
 assert.equal(parsed.rows.length,1);
 assert.equal(parsed.rows[0].valor,33.6);
 const large=[];
 for(let day=14;day<=20;day++)for(let i=0;i<4200;i++)large.push({data:'2026-10-'+day});
 const batches=salesBatches(large);
 assert.equal(batches.length,7,'sete dias completos devem virar sete lotes');
 assert(batches.every(b=>b.rows.length===4200&&b.dates.length===1));
 console.log('OK: vendas horizontais, dias vazios, divisão diária segura');
})().catch(e=>{console.error(e);process.exitCode=1});
