BEGIN;

ALTER TABLE montekali.trocas_snapshots
  ADD COLUMN IF NOT EXISTS quantidade_total numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.zai_importar_auditorias(
  p_loja text,
  p_revision bigint,
  p_hash text,
  p_arquivo text,
  p_linhas jsonb,
  p_datas date[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_rev bigint;
  v_lote bigint;
  v_count integer;
  v_sobra numeric := 0;
  v_falta numeric := 0;
  v_old_count integer := 0;
  v_old_value numeric := 0;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM montekali.acessos
    WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador'
  ) THEN
    RAISE EXCEPTION 'Permissao de importacao necessaria' USING ERRCODE='42501';
  END IF;

  SELECT versao INTO v_rev
  FROM montekali.revisoes
  WHERE loja_codigo=p_loja
  FOR UPDATE;

  IF v_rev IS NULL OR p_revision IS DISTINCT FROM v_rev THEN
    RAISE EXCEPTION 'Base mudou. Atualize o painel e confira novamente a previa.';
  END IF;

  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
     OR coalesce(length(p_arquivo),0) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'Identificacao do arquivo invalida';
  END IF;

  IF EXISTS(SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=p_hash) THEN
    RAISE EXCEPTION 'Este arquivo ja foi importado';
  END IF;

  IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000
     OR p_datas IS NULL OR cardinality(p_datas)=0 OR array_position(p_datas,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Linhas ou cobertura invalidas';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM jsonb_array_elements(p_linhas) x
    WHERE NOT (x ?& ARRAY['data','tipo','sku','produto','dpto','qtde','valor'])
       OR coalesce(x->>'tipo','') NOT IN ('entrada','saida')
       OR coalesce(x->>'sku','') !~ '^[0-9]+$'
       OR coalesce(x->>'data','') !~ '^\d{4}-\d{2}-\d{2}$'
       OR coalesce(trim(x->>'produto'),'')=''
       OR jsonb_typeof(x->'qtde') IS DISTINCT FROM 'number'
       OR jsonb_typeof(x->'valor') IS DISTINCT FROM 'number'
       OR NOT EXISTS(
         SELECT 1 FROM montekali.departamentos d WHERE d.codigo=x->>'dpto'
       )
       OR NOT ((x->>'data')::date=ANY(p_datas))
  ) THEN
    RAISE EXCEPTION 'Linha de auditoria invalida ou departamento nao cadastrado';
  END IF;

  SELECT
    coalesce(sum(CASE WHEN x->>'tipo'='entrada' THEN (x->>'valor')::numeric ELSE 0 END),0),
    coalesce(sum(CASE WHEN x->>'tipo'='saida' THEN (x->>'valor')::numeric ELSE 0 END),0)
  INTO v_sobra,v_falta
  FROM jsonb_array_elements(p_linhas) x;

  SELECT count(*),coalesce(sum(valor),0)
  INTO v_old_count,v_old_value
  FROM montekali.auditorias_estoque
  WHERE loja_codigo=p_loja AND data_movimento=ANY(p_datas);

  INSERT INTO montekali.lotes_importacao(
    loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total
  ) VALUES(
    p_loja,
    'auditoria_estoque_web',
    p_hash,
    p_arquivo,
    jsonb_build_object(
      'usuario',auth.uid(),
      'dias_substituidos',p_datas,
      'registros_anteriores',v_old_count,
      'valor_anterior',v_old_value,
      'sobra',v_sobra,
      'falta',v_falta,
      'resultado_liquido',v_falta-v_sobra
    ),
    jsonb_array_length(p_linhas),
    v_falta-v_sobra
  )
  RETURNING id INTO v_lote;

  INSERT INTO montekali.produtos(sku,descricao)
  SELECT DISTINCT ON (x->>'sku') x->>'sku',x->>'produto'
  FROM jsonb_array_elements(p_linhas) x
  ON CONFLICT DO NOTHING;

  DELETE FROM montekali.auditorias_estoque
  WHERE loja_codigo=p_loja AND data_movimento=ANY(p_datas);

  INSERT INTO montekali.auditorias_estoque(
    lote_id,loja_codigo,data_movimento,tipo,sku,departamento_codigo,
    fornecedor,documento,quantidade,valor,observacao,dados_origem
  )
  SELECT
    v_lote,
    p_loja,
    (x->>'data')::date,
    x->>'tipo',
    x->>'sku',
    x->>'dpto',
    nullif(trim(x->>'fornecedor'),''),
    nullif(trim(x->>'documento'),''),
    (x->>'qtde')::numeric,
    (x->>'valor')::numeric,
    nullif(trim(x->>'observacao'),''),
    x
  FROM jsonb_array_elements(p_linhas) x;

  GET DIAGNOSTICS v_count=ROW_COUNT;

  UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;

  RETURN jsonb_build_object(
    'lote',v_lote,
    'registros',v_count,
    'sobra',v_sobra,
    'falta',v_falta,
    'resultado',v_falta-v_sobra,
    'revision',v_rev+1
  );
END $$;

REVOKE ALL ON FUNCTION public.zai_importar_auditorias(text,bigint,text,text,jsonb,date[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_importar_auditorias(text,bigint,text,text,jsonb,date[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.zai_importar_trocas(
  p_loja text,
  p_revision bigint,
  p_hash text,
  p_arquivo text,
  p_data_referencia date,
  p_linhas jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_rev bigint;
  v_lote bigint;
  v_count integer;
  v_total numeric := 0;
  v_qtde numeric := 0;
  v_old_count integer := 0;
  v_old_value numeric := 0;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM montekali.acessos
    WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador'
  ) THEN
    RAISE EXCEPTION 'Permissao de importacao necessaria' USING ERRCODE='42501';
  END IF;

  SELECT versao INTO v_rev
  FROM montekali.revisoes
  WHERE loja_codigo=p_loja
  FOR UPDATE;

  IF v_rev IS NULL OR p_revision IS DISTINCT FROM v_rev THEN
    RAISE EXCEPTION 'Base mudou. Atualize o painel e confira novamente a previa.';
  END IF;

  IF p_data_referencia IS NULL THEN
    RAISE EXCEPTION 'Data de referencia obrigatoria';
  END IF;

  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
     OR coalesce(length(p_arquivo),0) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'Identificacao do arquivo invalida';
  END IF;

  IF EXISTS(SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=p_hash) THEN
    RAISE EXCEPTION 'Este arquivo ja foi importado';
  END IF;

  IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'Linhas invalidas';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM jsonb_array_elements(p_linhas) x
    WHERE NOT (x ?& ARRAY['sku','produto','dpto','qtde','valor'])
       OR coalesce(x->>'sku','') !~ '^[0-9]+$'
       OR coalesce(trim(x->>'produto'),'')=''
       OR jsonb_typeof(x->'qtde') IS DISTINCT FROM 'number'
       OR jsonb_typeof(x->'valor') IS DISTINCT FROM 'number'
       OR (x->>'qtde')::numeric < 0
       OR (x->>'valor')::numeric < 0
       OR NOT EXISTS(
         SELECT 1 FROM montekali.departamentos d WHERE d.codigo=x->>'dpto'
       )
  ) THEN
    RAISE EXCEPTION 'Linha de trocas invalida ou departamento nao cadastrado';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT x->>'sku')
    FROM jsonb_array_elements(p_linhas) x
  ) THEN
    RAISE EXCEPTION 'Arquivo de trocas possui SKU duplicado';
  END IF;

  SELECT
    coalesce(sum((x->>'valor')::numeric),0),
    coalesce(sum((x->>'qtde')::numeric),0)
  INTO v_total,v_qtde
  FROM jsonb_array_elements(p_linhas) x;

  SELECT count(*),coalesce(sum(valor),0)
  INTO v_old_count,v_old_value
  FROM montekali.trocas_posicao
  WHERE loja_codigo=p_loja;

  INSERT INTO montekali.lotes_importacao(
    loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total
  ) VALUES(
    p_loja,
    'trocas_posicao_web',
    p_hash,
    p_arquivo,
    jsonb_build_object(
      'usuario',auth.uid(),
      'data_referencia',p_data_referencia,
      'posicao_anterior_registros',v_old_count,
      'posicao_anterior_valor',v_old_value,
      'regra','snapshot_substitui_posicao'
    ),
    jsonb_array_length(p_linhas),
    v_total
  )
  RETURNING id INTO v_lote;

  INSERT INTO montekali.produtos(sku,descricao)
  SELECT DISTINCT ON (x->>'sku') x->>'sku',x->>'produto'
  FROM jsonb_array_elements(p_linhas) x
  ON CONFLICT DO NOTHING;

  DELETE FROM montekali.trocas_posicao WHERE loja_codigo=p_loja;

  INSERT INTO montekali.trocas_posicao(
    loja_codigo,chave_origem,lote_id,sku,departamento_codigo,fornecedor,
    quantidade,valor,situacao,data_referencia,dados_origem
  )
  SELECT
    p_loja,
    x->>'sku',
    v_lote,
    x->>'sku',
    x->>'dpto',
    nullif(trim(x->>'fornecedor'),''),
    (x->>'qtde')::numeric,
    (x->>'valor')::numeric,
    'Em estoque para troca',
    p_data_referencia,
    x
  FROM jsonb_array_elements(p_linhas) x;

  GET DIAGNOSTICS v_count=ROW_COUNT;

  INSERT INTO montekali.trocas_snapshots(
    lote_id,loja_codigo,data_referencia,registros,valor_total,quantidade_total
  ) VALUES(v_lote,p_loja,p_data_referencia,v_count,v_total,v_qtde);

  UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;

  RETURN jsonb_build_object(
    'lote',v_lote,
    'registros',v_count,
    'quantidade',v_qtde,
    'valor',v_total,
    'data_referencia',p_data_referencia,
    'revision',v_rev+1
  );
END $$;

REVOKE ALL ON FUNCTION public.zai_importar_trocas(text,bigint,text,text,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_importar_trocas(text,bigint,text,text,date,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.zai_snapshot(p_loja text DEFAULT '007')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
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
    'auditorias_resumo_dia',COALESCE((
      SELECT jsonb_agg(jsonb_build_array(data_movimento,departamento_codigo,tipo,quantidade,valor) ORDER BY data_movimento,departamento_codigo,tipo)
      FROM (
        SELECT data_movimento,departamento_codigo,tipo,sum(quantidade) quantidade,sum(valor) valor
        FROM montekali.auditorias_estoque
        WHERE loja_codigo=p_loja
        GROUP BY 1,2,3
      ) a
    ),'[]'::jsonb),
    'auditorias_resumo',jsonb_build_object(
      'entrada',(
        SELECT jsonb_build_object(
          'registros',count(*),'quantidade',coalesce(sum(quantidade),0),
          'valor',coalesce(sum(valor),0),'ultima_data',max(data_movimento)
        )
        FROM montekali.auditorias_estoque
        WHERE loja_codigo=p_loja AND tipo='entrada'
      ),
      'saida',(
        SELECT jsonb_build_object(
          'registros',count(*),'quantidade',coalesce(sum(quantidade),0),
          'valor',coalesce(sum(valor),0),'ultima_data',max(data_movimento)
        )
        FROM montekali.auditorias_estoque
        WHERE loja_codigo=p_loja AND tipo='saida'
      )
    ),
    'trocas_posicao',COALESCE((
      SELECT jsonb_agg(jsonb_build_array(
        t.sku,t.departamento_codigo,t.fornecedor,t.quantidade,t.valor,t.data_referencia
      ) ORDER BY t.valor DESC,t.sku)
      FROM montekali.trocas_posicao t
      WHERE t.loja_codigo=p_loja
    ),'[]'::jsonb),
    'trocas_resumo',(
      SELECT jsonb_build_object(
        'registros',count(*),
        'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),
        'data_referencia',max(data_referencia),
        'fornecedores',count(distinct fornecedor)
      )
      FROM montekali.trocas_posicao
      WHERE loja_codigo=p_loja
    ),
    'historico',COALESCE((
      SELECT jsonb_agg(t)
      FROM (
        SELECT arquivo_nome AS file,importado_em AS "when",registros AS rows,
               valor_total AS value,tipo
        FROM montekali.lotes_importacao
        WHERE loja_codigo=p_loja
        ORDER BY id DESC LIMIT 60
      ) t
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
