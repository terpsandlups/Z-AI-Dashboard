BEGIN;

CREATE TABLE IF NOT EXISTS montekali.auditorias_estoque (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id bigint NOT NULL REFERENCES montekali.lotes_importacao(id),
  loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
  data_movimento date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  sku text REFERENCES montekali.produtos(sku),
  departamento_codigo text REFERENCES montekali.departamentos(codigo),
  fornecedor text,
  documento text,
  quantidade numeric,
  valor numeric,
  observacao text,
  dados_origem jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS auditorias_estoque_loja_data
  ON montekali.auditorias_estoque(loja_codigo,data_movimento);
CREATE INDEX IF NOT EXISTS auditorias_estoque_loja_tipo
  ON montekali.auditorias_estoque(loja_codigo,tipo);

CREATE TABLE IF NOT EXISTS montekali.trocas_posicao (
  loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
  chave_origem text NOT NULL,
  lote_id bigint NOT NULL REFERENCES montekali.lotes_importacao(id),
  sku text REFERENCES montekali.produtos(sku),
  departamento_codigo text REFERENCES montekali.departamentos(codigo),
  fornecedor text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  situacao text,
  data_referencia date NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  dados_origem jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(loja_codigo,chave_origem)
);

CREATE INDEX IF NOT EXISTS trocas_posicao_loja_fornecedor
  ON montekali.trocas_posicao(loja_codigo,fornecedor);

CREATE TABLE IF NOT EXISTS montekali.trocas_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id bigint NOT NULL REFERENCES montekali.lotes_importacao(id),
  loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
  data_referencia date NOT NULL,
  registros integer NOT NULL CHECK(registros >= 0),
  valor_total numeric NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE montekali.auditorias_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.trocas_posicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.trocas_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.auditorias_estoque,montekali.trocas_posicao,montekali.trocas_snapshots
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.zai_snapshot(p_loja text DEFAULT '007')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM montekali.acessos
   WHERE usuario=auth.uid() AND loja_codigo=p_loja
 ) THEN
  RAISE EXCEPTION 'Usuario sem acesso a esta loja' USING ERRCODE='42501';
 END IF;

 SELECT jsonb_build_object(
 'schema','zai-007-v2',
 'loja',p_loja,
 'nome',(SELECT nome FROM montekali.lojas WHERE codigo=p_loja),
 'papel',(SELECT papel FROM montekali.acessos WHERE usuario=auth.uid() AND loja_codigo=p_loja),
 'revision',(SELECT versao FROM montekali.revisoes WHERE loja_codigo=p_loja),
 'baseline',c.configuracao->'baseline',
 'metas',COALESCE(c.configuracao->'metas','[]'::jsonb),
 'departamentos',(SELECT jsonb_object_agg(codigo,descricao) FROM montekali.departamentos),
 'produtos',(SELECT jsonb_object_agg(sku,jsonb_build_array(descricao,situacao_atual)) FROM montekali.produtos),
 'perdas',COALESCE((
   SELECT jsonb_agg(jsonb_build_array(data_movimento,sku,departamento_codigo,motivo,quantidade,valor) ORDER BY id)
   FROM montekali.perdas WHERE loja_codigo=p_loja
 ),'[]'::jsonb),
 'vendas_mensais',COALESCE((
   SELECT jsonb_agg(jsonb_build_array(to_char(competencia,'YYYY-MM'),sku,departamento_codigo,quantidade,valor))
   FROM montekali.vendas_mensais WHERE loja_codigo=p_loja
 ),'[]'::jsonb),
 'vendas_diarias','[]'::jsonb,
 'vendas_diarias_resumo',COALESCE((
   SELECT jsonb_agg(jsonb_build_array(data_movimento,departamento_codigo,valor))
   FROM montekali.vendas_resumo_dia WHERE loja_codigo=p_loja
 ),'[]'::jsonb),
 'vendas_diarias_produto_mes',COALESCE((
   SELECT jsonb_agg(jsonb_build_array(to_char(competencia,'YYYY-MM'),sku,departamento_codigo,quantidade,valor))
   FROM montekali.vendas_resumo_produto_mes WHERE loja_codigo=p_loja
 ),'[]'::jsonb),
 'dias_vendas_completos',COALESCE((
   SELECT jsonb_agg(data_movimento ORDER BY data_movimento)
   FROM montekali.cobertura_vendas WHERE loja_codigo=p_loja
 ),'[]'::jsonb),
 'auditorias_resumo',jsonb_build_object(
   'entrada',(
      SELECT jsonb_build_object(
        'registros',count(*),
        'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),
        'ultima_data',max(data_movimento)
      )
      FROM montekali.auditorias_estoque WHERE loja_codigo=p_loja AND tipo='entrada'
   ),
   'saida',(
      SELECT jsonb_build_object(
        'registros',count(*),
        'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),
        'ultima_data',max(data_movimento)
      )
      FROM montekali.auditorias_estoque WHERE loja_codigo=p_loja AND tipo='saida'
   )
 ),
 'trocas_resumo',(
    SELECT jsonb_build_object(
      'registros',count(*),
      'quantidade',coalesce(sum(quantidade),0),
      'valor',coalesce(sum(valor),0),
      'data_referencia',max(data_referencia),
      'fornecedores',count(distinct fornecedor)
    )
    FROM montekali.trocas_posicao WHERE loja_codigo=p_loja
 ),
 'historico',COALESCE((
   SELECT jsonb_agg(t) FROM (
     SELECT arquivo_nome AS file,importado_em AS "when",registros AS rows,
            valor_total AS value,tipo
     FROM montekali.lotes_importacao
     WHERE loja_codigo=p_loja
     ORDER BY id DESC LIMIT 60
   )t
 ),'[]'::jsonb),
 'aviso',COALESCE(c.configuracao->>'aviso','Carga historica de vendas ainda pendente.')
 ) INTO result
 FROM (SELECT 1) a
 LEFT JOIN montekali.configuracao_painel c ON c.loja_codigo=p_loja;

 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
