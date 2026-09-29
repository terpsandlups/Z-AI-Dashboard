// Dados exclusivamente fictícios. Não copiar uma base real para os testes.
module.exports=()=>({
 schema:'zai-007-v2',loja:'007',nome:'Loja de teste',revision:0,
 baseline:{meta_diaria:180000,meta_perda:.024},
 departamentos:{'001':'Departamento exemplo','002':'Outro departamento'},
 produtos:{'100':['Produto fictício','Inativo'],'200':['Outro produto','Ativo']},
 metas:[{codigo:'001',descricao:'Departamento exemplo',meta_diaria:108000,participacao:.6,meta_perda:.01,vendas_historicas:600},{codigo:'002',descricao:'Outro departamento',meta_diaria:72000,participacao:.4,meta_perda:.02,vendas_historicas:400}],
 perdas:[['2026-09-01','100','001','Avaria',1,10],['2026-09-21','100','001','Avaria',1,20],['2026-09-01','200','002','Avaria',1,10],['2026-09-27','100','001','Avaria',1,40]],
 dias_vendas_completos:Array.from({length:21},(_,i)=>'2026-09-'+String(i+1).padStart(2,'0')),
 vendas_mensais:[['2026-09','100','001',99,99999]],
 vendas_diarias:[],vendas_diarias_resumo:[['2026-09-01','001',600],['2026-09-01','002',400]],
 vendas_diarias_produto_mes:[['2026-09','100','001',6,600],['2026-09','200','002',4,400]],historico:[]
});
