BEGIN;

-- Auditorias de estoque são movimentos incrementais do ERP.
-- Entradas = sobras; Saídas = faltas. O mesmo arquivo pode conter os dois tipos.
-- Nenhum dia já carregado é apagado.
CREATE OR REPLACE FUNCTION public.zai_importar_auditorias(
  p_loja text,
  p_revision bigint,
  p_hash text,
  p_arquivo text,
  p_linhas jsonb,
  p_datas date[]
)
RETURNS jsonb
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
  v_duplicados integer := 0;
BEGIN
  IF NOT EXISTS(
    SELECT 1
    FROM montekali.acessos
    WHERE usuario=auth.uid()
      AND loja_codigo=p_loja
      AND papel='importador'
  ) THEN
    RAISE EXCEPTION 'Permissao de importacao necessaria' USING ERRCODE='42501';
  END IF;

  SELECT versao
  INTO v_rev
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

  IF EXISTS(
    SELECT 1
    FROM montekali.lotes_importacao
    WHERE arquivo_sha256=p_hash
  ) THEN
    RAISE EXCEPTION 'Este arquivo ja foi importado';
  END IF;

  IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000
     OR p_datas IS NULL
     OR cardinality(p_datas)=0
     OR array_position(p_datas,NULL) IS NOT NULL THEN
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
         SELECT 1
         FROM montekali.departamentos d
         WHERE d.codigo=x->>'dpto'
       )
       OR NOT ((x->>'data')::date=ANY(p_datas))
  ) THEN
    RAISE EXCEPTION 'Linha de auditoria invalida ou departamento nao cadastrado';
  END IF;

  SELECT count(*)
  INTO v_duplicados
  FROM jsonb_array_elements(p_linhas) x
  JOIN montekali.auditorias_estoque a
    ON a.loja_codigo=p_loja
   AND a.data_movimento=(x->>'data')::date
   AND a.tipo=x->>'tipo'
   AND a.sku=x->>'sku'
   AND a.departamento_codigo=x->>'dpto'
   AND a.quantidade=(x->>'qtde')::numeric
   AND a.valor=(x->>'valor')::numeric
   AND coalesce(a.documento,'')=coalesce(trim(x->>'documento'),'')
   AND coalesce(a.observacao,'')=coalesce(trim(x->>'observacao'),'');

  IF v_duplicados>0 THEN
    RAISE EXCEPTION
      'Foram encontrados % lancamentos que parecem ja existir. A importacao foi cancelada para evitar duplicidade.',
      v_duplicados;
  END IF;

  SELECT
    coalesce(sum(CASE WHEN x->>'tipo'='entrada' THEN (x->>'valor')::numeric ELSE 0 END),0),
    coalesce(sum(CASE WHEN x->>'tipo'='saida' THEN (x->>'valor')::numeric ELSE 0 END),0)
  INTO v_sobra,v_falta
  FROM jsonb_array_elements(p_linhas) x;

  INSERT INTO montekali.lotes_importacao(
    loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total
  )
  VALUES(
    p_loja,
    'auditoria_estoque_incremental',
    p_hash,
    p_arquivo,
    jsonb_build_object(
      'usuario',auth.uid(),
      'regra','complementar',
      'datas',p_datas,
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

  UPDATE montekali.revisoes
  SET versao=versao+1
  WHERE loja_codigo=p_loja;

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

NOTIFY pgrst,'reload schema';
COMMIT;
