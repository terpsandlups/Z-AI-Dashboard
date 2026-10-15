BEGIN;

CREATE OR REPLACE FUNCTION public.zai_importar_auditoria(
 p_loja text,p_revision bigint,p_hash text,p_arquivo text,p_tipo text,p_linhas jsonb,p_datas date[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rev bigint; v_lote bigint; v_total numeric; v_antigos jsonb;
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM montekali.acessos
   WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador'
 ) THEN RAISE EXCEPTION 'Permissao de importacao necessaria' USING ERRCODE='42501'; END IF;

 SELECT versao INTO v_rev FROM montekali.revisoes WHERE loja_codigo=p_loja FOR UPDATE;
 IF v_rev IS NULL OR p_revision IS DISTINCT FROM v_rev THEN
   RAISE EXCEPTION 'Base mudou. Atualize o painel e confira novamente a previa.';
 END IF;

 IF p_tipo NOT IN ('entrada','saida') THEN RAISE EXCEPTION 'Tipo de auditoria invalido'; END IF;
 IF p_hash !~ '^[0-9a-f]{64}$' OR p_arquivo IS NULL OR length(p_arquivo)>300 THEN
   RAISE EXCEPTION 'Identificacao do arquivo invalida';
 END IF;
 IF EXISTS(SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=p_hash AND tipo='auditoria_'||p_tipo) THEN
   RAISE EXCEPTION 'Este arquivo ja foi importado para esta auditoria';
 END IF;
 IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000 THEN
   RAISE EXCEPTION 'Linhas invalidas';
 END IF;
 IF p_datas IS NULL OR cardinality(p_datas)=0 THEN RAISE EXCEPTION 'Datas invalidas'; END IF;

 IF EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_linhas) x
   WHERE NOT (x ?& ARRAY['data','sku','dpto','produto','qtde','valor'])
      OR jsonb_typeof(x->'qtde') IS DISTINCT FROM 'number'
      OR jsonb_typeof(x->'valor') IS DISTINCT FROM 'number'
      OR COALESCE(x->>'sku','') !~ '^[0-9]+$'
      OR COALESCE(x->>'data','') !~ '^\d{4}-\d{2}-\d{2}$'
      OR COALESCE(trim(x->>'produto'),'')=''
      OR NOT EXISTS(SELECT 1 FROM montekali.departamentos d WHERE d.codigo=x->>'dpto')
 ) THEN RAISE EXCEPTION 'Linha invalida ou departamento sem cadastro. Nenhuma linha salva.'; END IF;

 SELECT sum((x->>'valor')::numeric)
 INTO v_total FROM jsonb_array_elements(p_linhas)x;

 INSERT INTO montekali.lotes_importacao
   (loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total)
 VALUES
   (p_loja,'auditoria_'||p_tipo,p_hash,p_arquivo,
    jsonb_build_object('usuario',auth.uid(),'revisao',v_rev,'regra','substituir_dias'),
    jsonb_array_length(p_linhas),v_total)
 RETURNING id INTO v_lote;

 SELECT COALESCE(jsonb_agg(a),'[]'::jsonb)
 INTO v_antigos
 FROM montekali.auditorias_estoque a
 WHERE a.loja_codigo=p_loja AND a.tipo=p_tipo AND a.data_movimento=ANY(p_datas);

 INSERT INTO montekali.auditoria_substituicoes(lote_id,usuario,dados_anteriores)
 VALUES(v_lote,auth.uid(),v_antigos);

 DELETE FROM montekali.auditorias_estoque
 WHERE loja_codigo=p_loja AND tipo=p_tipo AND data_movimento=ANY(p_datas);

 INSERT INTO montekali.produtos(sku,descricao)
 SELECT DISTINCT ON (x->>'sku') x->>'sku',x->>'produto'
 FROM jsonb_array_elements(p_linhas)x
 ON CONFLICT (sku) DO NOTHING;

 INSERT INTO montekali.auditorias_estoque
   (lote_id,loja_codigo,data_movimento,tipo,sku,departamento_codigo,documento,quantidade,valor,observacao,dados_origem)
 SELECT
   v_lote,p_loja,(x->>'data')::date,p_tipo,x->>'sku',x->>'dpto',
   NULLIF(x->>'documento',''),(x->>'qtde')::numeric,(x->>'valor')::numeric,
   NULLIF(x->>'observacao',''),COALESCE(x->'origem','{}'::jsonb)
 FROM jsonb_array_elements(p_linhas)x;

 UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;

 RETURN jsonb_build_object(
   'lote',v_lote,'registros',jsonb_array_length(p_linhas),
   'valor',v_total,'tipo',p_tipo,'revision',v_rev+1
 );
END $$;

CREATE OR REPLACE FUNCTION public.zai_importar_trocas(
 p_loja text,p_revision bigint,p_hash text,p_arquivo text,p_data_referencia date,p_linhas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rev bigint; v_lote bigint; v_total numeric; v_qtd numeric; v_antigos jsonb;
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM montekali.acessos
   WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador'
 ) THEN RAISE EXCEPTION 'Permissao de importacao necessaria' USING ERRCODE='42501'; END IF;

 SELECT versao INTO v_rev FROM montekali.revisoes WHERE loja_codigo=p_loja FOR UPDATE;
 IF v_rev IS NULL OR p_revision IS DISTINCT FROM v_rev THEN
   RAISE EXCEPTION 'Base mudou. Atualize o painel e confira novamente a previa.';
 END IF;

 IF p_data_referencia IS NULL THEN RAISE EXCEPTION 'Data de referencia obrigatoria'; END IF;
 IF p_hash !~ '^[0-9a-f]{64}$' OR p_arquivo IS NULL OR length(p_arquivo)>300 THEN
   RAISE EXCEPTION 'Identificacao do arquivo invalida';
 END IF;
 IF EXISTS(SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=p_hash AND tipo='trocas_posicao') THEN
   RAISE EXCEPTION 'Esta posicao de trocas ja foi importada';
 END IF;
 IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000 THEN
   RAISE EXCEPTION 'Linhas invalidas';
 END IF;

 IF EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_linhas)x
   WHERE NOT (x ?& ARRAY['sku','dpto','produto','quantidade','valor'])
      OR jsonb_typeof(x->'quantidade') IS DISTINCT FROM 'number'
      OR jsonb_typeof(x->'valor') IS DISTINCT FROM 'number'
      OR COALESCE(x->>'sku','') !~ '^[0-9]+$'
      OR COALESCE(trim(x->>'produto'),'')=''
      OR NOT EXISTS(SELECT 1 FROM montekali.departamentos d WHERE d.codigo=x->>'dpto')
 ) THEN RAISE EXCEPTION 'Linha invalida ou departamento sem cadastro. Nenhuma linha salva.'; END IF;

 SELECT sum((x->>'valor')::numeric),sum((x->>'quantidade')::numeric)
 INTO v_total,v_qtd FROM jsonb_array_elements(p_linhas)x;

 INSERT INTO montekali.lotes_importacao
   (loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total)
 VALUES
   (p_loja,'trocas_posicao',p_hash,p_arquivo,
    jsonb_build_object('usuario',auth.uid(),'revisao',v_rev,'data_referencia',p_data_referencia,'regra','substituir_posicao'),
    jsonb_array_length(p_linhas),v_total)
 RETURNING id INTO v_lote;

 SELECT COALESCE(jsonb_agg(t),'[]'::jsonb)
 INTO v_antigos FROM montekali.trocas_posicao t WHERE t.loja_codigo=p_loja;

 INSERT INTO montekali.auditoria_substituicoes(lote_id,usuario,dados_anteriores)
 VALUES(v_lote,auth.uid(),v_antigos);

 INSERT INTO montekali.produtos(sku,descricao)
 SELECT DISTINCT ON (x->>'sku') x->>'sku',x->>'produto'
 FROM jsonb_array_elements(p_linhas)x
 ON CONFLICT (sku) DO NOTHING;

 DELETE FROM montekali.trocas_posicao WHERE loja_codigo=p_loja;

 INSERT INTO montekali.trocas_posicao
   (loja_codigo,chave_origem,lote_id,sku,departamento_codigo,fornecedor,quantidade,valor,situacao,data_referencia,dados_origem)
 SELECT
   p_loja,x->>'sku',v_lote,x->>'sku',x->>'dpto',NULLIF(x->>'fornecedor',''),
   (x->>'quantidade')::numeric,(x->>'valor')::numeric,NULLIF(x->>'situacao',''),
   p_data_referencia,
   jsonb_build_object(
     'ean',x->>'ean','curva',x->>'curva','fornecedor_codigo',x->>'fornecedor_codigo'
   )
 FROM jsonb_array_elements(p_linhas)x;

 INSERT INTO montekali.trocas_snapshots
   (lote_id,loja_codigo,data_referencia,registros,valor_total)
 VALUES(v_lote,p_loja,p_data_referencia,jsonb_array_length(p_linhas),v_total);

 UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;

 RETURN jsonb_build_object(
   'lote',v_lote,'registros',jsonb_array_length(p_linhas),
   'quantidade',v_qtd,'valor',v_total,'data_referencia',p_data_referencia,'revision',v_rev+1
 );
END $$;

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

REVOKE ALL ON FUNCTION public.zai_importar_auditoria(text,bigint,text,text,text,jsonb,date[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zai_importar_trocas(text,bigint,text,text,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_importar_auditoria(text,bigint,text,text,text,jsonb,date[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zai_importar_trocas(text,bigint,text,text,date,jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
