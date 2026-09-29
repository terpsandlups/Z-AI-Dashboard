-- PostgreSQL / Supabase. Executar como administrador em projeto novo.
-- Esquema isolado; nao altera o esquema inicial antigo do painel.
BEGIN;
CREATE SCHEMA montekali;
CREATE TABLE montekali.lojas (codigo text PRIMARY KEY, nome text NOT NULL);
CREATE TABLE montekali.departamentos (codigo text PRIMARY KEY, descricao text NOT NULL);
CREATE TABLE montekali.produtos (sku text PRIMARY KEY, descricao text NOT NULL, situacao_atual text NOT NULL DEFAULT 'Nao informado' CHECK(situacao_atual IN ('Ativo','Inativo','Nao informado')));
CREATE TABLE montekali.fornecedores (codigo text PRIMARY KEY, nome text NOT NULL);
CREATE TABLE montekali.lotes_importacao (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 loja_codigo text NOT NULL REFERENCES montekali.lojas,
 tipo text NOT NULL, arquivo_sha256 text NOT NULL UNIQUE,
 arquivo_nome text NOT NULL, exportado_em timestamptz,
 importado_em timestamptz NOT NULL DEFAULT now(),
 historico_origem jsonb NOT NULL,
 registros integer NOT NULL, valor_total numeric NOT NULL
);
CREATE TABLE montekali.perdas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 lote_id bigint NOT NULL REFERENCES montekali.lotes_importacao,
 linha_origem integer NOT NULL,
 loja_codigo text NOT NULL REFERENCES montekali.lojas,
 data_movimento date NOT NULL,
 sku text NOT NULL REFERENCES montekali.produtos,
 departamento_codigo text NOT NULL REFERENCES montekali.departamentos,
 motivo text NOT NULL, quantidade numeric NOT NULL, valor numeric NOT NULL,
 UNIQUE(lote_id,linha_origem)
);
CREATE INDEX perdas_loja_data ON montekali.perdas(loja_codigo,data_movimento);
CREATE INDEX perdas_sku_data ON montekali.perdas(sku,data_movimento);
CREATE INDEX perdas_departamento_data ON montekali.perdas(departamento_codigo,data_movimento);
CREATE TABLE montekali.vendas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 lote_id bigint NOT NULL REFERENCES montekali.lotes_importacao,
 loja_codigo text NOT NULL REFERENCES montekali.lojas,
 data_movimento date NOT NULL, sku text NOT NULL REFERENCES montekali.produtos,
 departamento_codigo text NOT NULL REFERENCES montekali.departamentos,
 quantidade numeric NOT NULL, valor numeric NOT NULL,
 UNIQUE(loja_codigo,data_movimento,sku,departamento_codigo)
);
-- Vendas: granularidade diaria consolidada. Importador futuro deve agregar antes de inserir.
CREATE TABLE montekali.metas_departamento (
 loja_codigo text NOT NULL REFERENCES montekali.lojas,
 departamento_codigo text NOT NULL REFERENCES montekali.departamentos,
 competencia date NOT NULL CHECK(extract(day FROM competencia)=1),
 percentual numeric NOT NULL CHECK(percentual>=0 AND percentual<=1),
 PRIMARY KEY(loja_codigo,departamento_codigo,competencia)
);
COMMENT ON TABLE montekali.metas_departamento IS 'Percentual armazenado como fracao. Meta geral definida por loja na configuracao do painel; metas setoriais por mes.';
-- Bloqueio inicial intencional: nenhuma politica de acesso publico.
ALTER TABLE montekali.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.lotes_importacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.perdas ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.metas_departamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA montekali FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA montekali FROM PUBLIC;
COMMIT;
