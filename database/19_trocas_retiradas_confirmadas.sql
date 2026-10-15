-- Ajustes operacionais confirmados em 15/10/2026.
-- "Elas por elas" e "Produto por produto" continuam a mesma categoria analítica: troca_produto.

UPDATE montekali.trocas_regras_fornecedor
SET fisico_virtual='Descartar', atualizado_em=now()
WHERE fornecedor_codigo IN ('31933','30074','56049','77496','17396');

UPDATE montekali.trocas_regras_fornecedor
SET forma='Motorista Retira', atualizado_em=now()
WHERE fornecedor_codigo IN ('73865','40770','74845');

UPDATE montekali.trocas_regras_fornecedor
SET forma='Vendedor Retira', atualizado_em=now()
WHERE fornecedor_codigo IN ('36331','72826');
