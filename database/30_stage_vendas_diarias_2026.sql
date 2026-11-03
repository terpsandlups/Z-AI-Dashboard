-- Area de recuperacao idempotente de vendas por SKU: apenas 007, janeiro-agosto de 2026.
-- Sem ALTER ou DELETE em fatos operacionais.
CREATE TABLE IF NOT EXISTS montekali.zai_recuperacao_vendas_stage (
 job_key text NOT NULL,
 loja_codigo text NOT NULL,
 data_movimento date NOT NULL,
 sku text NOT NULL,
 departamento_codigo text NOT NULL,
 quantidade numeric NOT NULL,
 valor numeric NOT NULL,
 PRIMARY KEY(job_key,data_movimento,sku,departamento_codigo),
 CONSTRAINT zai_recuperacao_periodo CHECK (
  loja_codigo='007'
  AND data_movimento BETWEEN DATE '2026-01-01' AND DATE '2026-08-31'
 )
);
CREATE INDEX IF NOT EXISTS zai_recuperacao_vendas_month
 ON montekali.zai_recuperacao_vendas_stage (job_key,loja_codigo,data_movimento);
ALTER TABLE montekali.zai_recuperacao_vendas_stage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.zai_recuperacao_vendas_stage FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE montekali.zai_recuperacao_vendas_stage IS
 'Area temporaria de auditoria para historico diario por SKU da loja 007, meses Jan-Ago/2026. Nao altera ERP nem resumidos.';
