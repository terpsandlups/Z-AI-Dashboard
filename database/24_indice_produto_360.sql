-- Indices dedicados às pesquisas Produto 360 por loja, SKU e período.
-- Não alteram os movimentos; apenas aceleram as consultas analíticas.
CREATE INDEX IF NOT EXISTS vendas_loja_sku_data_p360
 ON montekali.vendas (loja_codigo, sku, data_movimento);
CREATE INDEX IF NOT EXISTS perdas_loja_sku_data_p360
 ON montekali.perdas (loja_codigo, sku, data_movimento);
CREATE INDEX IF NOT EXISTS auditorias_loja_sku_data_p360
 ON montekali.auditorias_estoque (loja_codigo, sku, data_movimento);
