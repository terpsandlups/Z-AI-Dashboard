// Dados exclusivamente fictícios. Não copiar uma base real para os testes.
module.exports=()=>({
 schema:'zai-007-v2',loja:'007',nome:'Loja de teste',revision:0,
 baseline:{meta_diaria:180000,meta_perda:.024},
 departamentos:{'001':'Departamento exemplo'},
 produtos:{'100':['Produto fictício','Inativo']},
 metas:[{codigo:'001',descricao:'Departamento exemplo',meta_diaria:180000,participacao:1,meta_perda:.01,vendas_historicas:1000}],
 perdas:[['2026-09-01','100','001','Avaria',1,10],['2026-09-21','100','001','Avaria',1,20],['2026-09-27','100','001','Avaria',1,40]],
 dias_vendas_completos:Array.from({length:21},(_,i)=>'2026-09-'+String(i+1).padStart(2,'0')),
 vendas_mensais:[['2026-09','100','001',99,99999]],
 vendas_diarias:[],vendas_diarias_resumo:[['2026-09-01','001',1000]],
 vendas_diarias_produto_mes:[['2026-09','100','001',10,1000]],historico:[]
});
