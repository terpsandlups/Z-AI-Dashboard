// Testes de contratos de filtros, datas e compatibilidade de fontes no Z-AI.
// Dados fictícios: nunca usar uma base operacional real nestes testes.
const assert=require('node:assert/strict');
const Z=require('../web/core.js'),fixture=require('./fixture.cjs');
const data=fixture();

const parcial=Z.select(data,'2026-09-01','2026-09-21');
assert.equal(parcial.salesTotal,1000);
assert.equal(parcial.lossTotal,40);
assert.equal(parcial.days,21);
assert.equal(parcial.comparable,true);
assert.equal(parcial.ratio,.04);
assert.equal(parcial.sources[0],'2026-09: diária');

const completo=Z.select(data,'2026-09-01','2026-09-30');
assert.equal(completo.end,'2026-09-30','Não encurtar a data final');
assert.equal(completo.lossTotal,80,'Não excluir perdas posteriores às vendas diárias');
assert.equal(completo.salesTotal,99999,'Preferir venda mensal consolidada sem somar o diário');
assert.equal(completo.sources[0],'2026-09: mensal');
assert.equal(completo.comparable,false,'Perdas sem horizonte de cobertura até 30/09');
assert.equal(completo.days,30);
assert.equal(completo.goal,5400000);

const semVendas=Z.select(data,'2026-09-22','2026-09-30');
assert.equal(semVendas.end,'2026-09-30');
assert.equal(semVendas.salesTotal,0);
assert.equal(semVendas.lossTotal,40);
assert.equal(semVendas.salesComplete,false);
assert.equal(semVendas.ratio,null);
assert(semVendas.missing.some(x=>x.includes('9 dias')));

const jan=fixture();
jan.perdas=fixture().perdas;
jan.dias_vendas_completos=Array.from({length:31},(_,i)=>'2026-01-'+String(i+1).padStart(2,'0'));
jan.vendas_diarias_resumo=[['2026-01-01','001',1000],['2026-01-15','002',300]];
jan.vendas_mensais=[];
const janeiro=Z.select(jan,'2026-01-01','2026-01-31');
assert.equal(janeiro.salesTotal,1300);
assert.equal(janeiro.salesComplete,true);
assert.equal(janeiro.lossSpanComplete,false,'Ter venda diária não comprova cobertura de perdas');
assert.equal(janeiro.ratio,null);
assert.equal(janeiro.days,31);

const multi=Z.select(data,'2026-08-30','2026-09-05');
assert.equal(multi.start,'2026-08-30');
assert.equal(multi.end,'2026-09-05');
assert.equal(multi.days,7);
assert.equal(multi.salesTotal,1000);
assert.equal(multi.lossTotal,20);
assert.equal(multi.salesComplete,false);

const day=Z.select(data,'2026-09-01','2026-09-01','001');
assert.equal(day.salesTotal,600);
assert.equal(day.lossTotal,10);
assert.equal(day.goal,108000);
assert.equal(Z.weekdays(data,day,'001').reduce((a,x)=>a+x.days,0),1);
assert.equal(Z.validDate('2026-02-30'),false);
assert.equal(Z.validDate('2026-02-28'),true);
assert.throws(()=>Z.select(data,'2026-10-02','2026-10-01'),/inválido/);
assert.throws(()=>Z.select(data,'2020-01-01','2035-01-01'),/limite|longo/);

console.log('OK: períodos diários/mensais, múltiplos meses, setor, ausência de vendas, calendário e limites.');
