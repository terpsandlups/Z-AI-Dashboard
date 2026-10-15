BEGIN;

-- "Elas por elas" e "Produto por produto" representam a mesma operação.
-- A descrição original permanece em tratativa; somente a categoria analítica é padronizada.
UPDATE montekali.trocas_regras_fornecedor
SET categoria='troca_produto',
    atualizado_em=now()
WHERE categoria IN ('elas_por_elas','produto_por_produto');

CREATE INDEX IF NOT EXISTS trocas_posicao_loja_fornecedor
  ON montekali.trocas_posicao(loja_codigo,((dados_origem->>'fornecedor_codigo')));

COMMIT;
