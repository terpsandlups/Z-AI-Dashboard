BEGIN;

ALTER TABLE montekali.trocas_regras_fornecedor
  ADD COLUMN IF NOT EXISTS grupo_exibicao text;

UPDATE montekali.trocas_regras_fornecedor
SET grupo_exibicao = COALESCE(grupo_exibicao, fornecedor_referencia)
WHERE grupo_exibicao IS NULL;

UPDATE montekali.trocas_regras_fornecedor
SET fisico_virtual='Descartar',
    grupo_exibicao=CASE
      WHEN fornecedor_codigo IN ('31933','30074') THEN 'Seara'
      WHEN fornecedor_codigo IN ('56049','77496','17396') THEN 'Itambé'
      ELSE grupo_exibicao
    END,
    atualizado_em=now()
WHERE fornecedor_codigo IN ('31933','30074','56049','77496','17396');

UPDATE montekali.trocas_regras_fornecedor
SET fisico_virtual='Precisa guardar o físico',
    grupo_exibicao=CASE fornecedor_codigo
      WHEN '73865' THEN 'Palmerin'
      WHEN '40770' THEN 'Delícia'
      WHEN '36331' THEN 'NSA'
      WHEN '74845' THEN 'Serramar'
      WHEN '72826' THEN 'Campobom'
      ELSE grupo_exibicao
    END,
    atualizado_em=now()
WHERE fornecedor_codigo IN ('73865','40770','36331','74845','72826');

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
     'fornecedor_codigo',fornecedor_codigo,
     'fornecedor_referencia',fornecedor_referencia,
     'grupo',COALESCE(grupo_exibicao,fornecedor_referencia),
     'tratativa',tratativa,
     'categoria',categoria,
     'forma',forma,
     'marca_produto',marca_produto,
     'fisico_virtual',fisico_virtual
   ) ORDER BY COALESCE(grupo_exibicao,fornecedor_referencia),fornecedor_referencia)
   FROM montekali.trocas_regras_fornecedor
   WHERE ativo
 ),'[]'::jsonb),
 'trocas_detalhe',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'sku',t.sku,
     'produto',p.descricao,
     'departamento',t.departamento_codigo,
     'fornecedor_origem',t.fornecedor,
     'fornecedor_codigo',t.dados_origem->>'fornecedor_codigo',
     'fornecedor_grupo',COALESCE(r.grupo_exibicao,r.fornecedor_referencia,t.fornecedor),
     'tratativa',r.tratativa,
     'categoria',r.categoria,
     'forma',r.forma,
     'marca_produto',r.marca_produto,
     'fisico_virtual',r.fisico_virtual,
     'quantidade',t.quantidade,
     'valor',t.valor,
     'data_referencia',t.data_referencia,
     'ean',t.dados_origem->>'ean',
     'curva',t.dados_origem->>'curva'
   ) ORDER BY COALESCE(r.grupo_exibicao,r.fornecedor_referencia,t.fornecedor),t.valor DESC,t.sku)
   FROM montekali.trocas_posicao t
   LEFT JOIN montekali.produtos p ON p.sku=t.sku
   LEFT JOIN montekali.trocas_regras_fornecedor r
     ON r.fornecedor_codigo=t.dados_origem->>'fornecedor_codigo'
    AND r.ativo
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
