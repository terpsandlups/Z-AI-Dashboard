BEGIN;

-- Regras confirmadas pela operação em 15/10/2026.
-- "Elas por elas" e "Produto por produto" usam a categoria analítica troca_produto.

INSERT INTO montekali.trocas_regras_fornecedor
(fornecedor_codigo,fornecedor_referencia,tratativa,categoria,forma,marca_produto,fisico_virtual,ativo)
VALUES
('31933','Seara ( Ativo )','Bonificação','bonificacao',NULL,NULL,NULL,true),
('77496','Itambe Minas Com e Distrib De Alim Ativo Lojas','Nota de Devolução','nf_devolucao',NULL,NULL,NULL,true),
('56049','Itambe - Ativo','Nota de Devolução','nf_devolucao',NULL,NULL,NULL,true),
('73865','Palmerin','Nota de Devolução','nf_devolucao',NULL,NULL,NULL,true),
('40770','Delicia Da Roca','Produto por produto','troca_produto',NULL,NULL,NULL,true),
('36331','Nsa Distribuidora (yakult)','Nota de Devolução','nf_devolucao',NULL,NULL,NULL,true),
('74845','Serramar','Nota de Devolução','nf_devolucao',NULL,NULL,NULL,true),
('72826','Campobom Ltda','Nota de Devolução','nf_devolucao',NULL,NULL,NULL,true)
ON CONFLICT (fornecedor_codigo) DO UPDATE SET
  fornecedor_referencia=excluded.fornecedor_referencia,
  tratativa=excluded.tratativa,
  categoria=excluded.categoria,
  ativo=true,
  atualizado_em=now();

COMMIT;
