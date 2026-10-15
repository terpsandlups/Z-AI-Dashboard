BEGIN;

CREATE TABLE IF NOT EXISTS montekali.trocas_regras_fornecedor (
  loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
  chave text NOT NULL,
  nome_exibicao text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  destino_fisico text CHECK (destino_fisico IN ('descarte','guardar_fisico')),
  modalidade text CHECK (modalidade IN ('nota_de_devolucao','produto_por_produto')),
  marca text,
  observacao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (loja_codigo,chave)
);

ALTER TABLE montekali.trocas_regras_fornecedor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.trocas_regras_fornecedor FROM PUBLIC, anon, authenticated;

INSERT INTO montekali.trocas_regras_fornecedor
  (loja_codigo,chave,nome_exibicao,aliases,destino_fisico,marca,observacao)
VALUES
  ('007','seara','Seara',ARRAY['Seara ( Ativo )','Seara ( Acougue)'],'descarte','Seara','Definido pela operação'),
  ('007','itambe','Itambé',ARRAY['Itambe Minas Com e Distrib De Alim Ativo Lojas','Itambe - Ativo'],'descarte','Itambé','Definido pela operação'),
  ('007','palmerin','Palmerin',ARRAY['Palmerin'],'guardar_fisico','Palmerin','Definido pela operação'),
  ('007','delicia','Delícia',ARRAY['Delicia Da Roca'],'guardar_fisico','Delícia','Definido pela operação'),
  ('007','nsa','NSA',ARRAY['Nsa Distribuidora (yakult)'],'guardar_fisico',NULL,'Definido pela operação'),
  ('007','serramar','Serramar',ARRAY['Serramar'],'guardar_fisico','Serramar','Definido pela operação'),
  ('007','campobom','Campobom',ARRAY['Campobom Ltda'],'guardar_fisico','Campobom','Definido pela operação')
ON CONFLICT (loja_codigo,chave) DO UPDATE SET
  nome_exibicao=EXCLUDED.nome_exibicao,
  aliases=EXCLUDED.aliases,
  destino_fisico=EXCLUDED.destino_fisico,
  marca=EXCLUDED.marca,
  observacao=EXCLUDED.observacao,
  atualizado_em=now();

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
 'auditorias_diarias_resumo',COALESCE((
   SELECT jsonb_agg(jsonb_build_array(data_movimento,tipo,departamento_codigo,quantidade,valor) ORDER BY data_movimento,tipo,departamento_codigo)
   FROM (
     SELECT data_movimento,tipo,departamento_codigo,sum(quantidade) quantidade,sum(valor) valor
     FROM montekali.auditorias_estoque
     WHERE loja_codigo=p_loja
     GROUP BY data_movimento,tipo,departamento_codigo
   )x
 ),'[]'::jsonb),
 'auditorias_resumo',jsonb_build_object(
   'entrada',(
      SELECT jsonb_build_object(
        'registros',count(*),'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),'ultima_data',max(data_movimento)
      ) FROM montekali.auditorias_estoque
      WHERE loja_codigo=p_loja AND tipo='entrada'
   ),
   'saida',(
      SELECT jsonb_build_object(
        'registros',count(*),'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),'ultima_data',max(data_movimento)
      ) FROM montekali.auditorias_estoque
      WHERE loja_codigo=p_loja AND tipo='saida'
   )
 ),
 'trocas_resumo',(
    SELECT jsonb_build_object(
      'registros',count(*),'quantidade',coalesce(sum(quantidade),0),
      'valor',coalesce(sum(valor),0),'data_referencia',max(data_referencia),
      'fornecedores',count(distinct fornecedor)
    ) FROM montekali.trocas_posicao WHERE loja_codigo=p_loja
 ),
 'trocas_regras',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'chave',chave,'nome',nome_exibicao,'aliases',aliases,
     'destino_fisico',destino_fisico,'modalidade',modalidade,'marca',marca
   ) ORDER BY nome_exibicao)
   FROM montekali.trocas_regras_fornecedor
   WHERE loja_codigo=p_loja
 ),'[]'::jsonb),
 'trocas_detalhe',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'sku',t.sku,
     'produto',p.descricao,
     'departamento',t.departamento_codigo,
     'fornecedor_origem',t.fornecedor,
     'fornecedor_grupo',COALESCE(r.nome_exibicao,t.fornecedor),
     'marca',r.marca,
     'destino_fisico',r.destino_fisico,
     'modalidade',r.modalidade,
     'quantidade',t.quantidade,
     'valor',t.valor,
     'data_referencia',t.data_referencia,
     'ean',t.dados_origem->>'ean',
     'curva',t.dados_origem->>'curva',
     'fornecedor_codigo',t.dados_origem->>'fornecedor_codigo'
   ) ORDER BY COALESCE(r.nome_exibicao,t.fornecedor),t.valor DESC,t.sku)
   FROM montekali.trocas_posicao t
   LEFT JOIN montekali.produtos p ON p.sku=t.sku
   LEFT JOIN LATERAL (
      SELECT rr.*
      FROM montekali.trocas_regras_fornecedor rr
      WHERE rr.loja_codigo=p_loja
        AND EXISTS (
          SELECT 1 FROM unnest(rr.aliases) a
          WHERE lower(trim(a))=lower(trim(t.fornecedor))
        )
      LIMIT 1
   ) r ON true
   WHERE t.loja_codigo=p_loja
 ),'[]'::jsonb),
 'historico',COALESCE((
   SELECT jsonb_agg(t) FROM (
     SELECT arquivo_nome AS file,importado_em AS "when",registros AS rows,valor_total AS value,tipo
     FROM montekali.lotes_importacao
     WHERE loja_codigo=p_loja ORDER BY id DESC LIMIT 80
   )t
 ),'[]'::jsonb),
 'aviso',COALESCE(c.configuracao->>'aviso','')
 ) INTO result
 FROM (SELECT 1) a
 LEFT JOIN montekali.configuracao_painel c ON c.loja_codigo=p_loja;

 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
