-- Regras de marca/linha confirmadas pela operação em 15/10/2026.
-- "Produto por produto" e "Elas por elas" continuam tratados como a mesma categoria analítica.

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='Toda linha', atualizado_em=now()
WHERE fornecedor_codigo IN ('30074','31933');

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='Iogurtes', atualizado_em=now()
WHERE fornecedor_codigo IN ('17396','56049','77496');

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='KIM', atualizado_em=now()
WHERE fornecedor_codigo='73865';

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='Bolos Delícia da Roça', atualizado_em=now()
WHERE fornecedor_codigo='40770';

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='Yakult', atualizado_em=now()
WHERE fornecedor_codigo='36331';

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='Serramar', atualizado_em=now()
WHERE fornecedor_codigo='74845';

UPDATE montekali.trocas_regras_fornecedor
SET marca_produto='Life', atualizado_em=now()
WHERE fornecedor_codigo='72826';
