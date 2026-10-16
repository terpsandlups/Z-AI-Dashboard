BEGIN;

-- Ajuste de ordenação global, executado antes de LIMIT/OFFSET.

CREATE OR REPLACE FUNCTION public.zai_auditorias_periodo(
  p_loja text,
  p_de date,
  p_ate date,
  p_dpto text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_modo text DEFAULT 'individual',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_result jsonb;
  v_limit integer;
  v_offset integer;
BEGIN
  IF NOT EXISTS(
    SELECT 1
    FROM montekali.acessos
    WHERE usuario=auth.uid() AND loja_codigo=p_loja
  ) THEN
    RAISE EXCEPTION 'Usuario sem acesso a esta loja' USING ERRCODE='42501';
  END IF;

  IF p_de IS NULL OR p_ate IS NULL OR p_de>p_ate THEN
    RAISE EXCEPTION 'Periodo de auditoria invalido';
  END IF;

  IF p_tipo IS NOT NULL AND p_tipo NOT IN ('entrada','saida') THEN
    RAISE EXCEPTION 'Tipo de auditoria invalido';
  END IF;

  IF p_modo NOT IN ('individual','agrupado') THEN
    RAISE EXCEPTION 'Modo de auditoria invalido';
  END IF;

  v_limit:=LEAST(GREATEST(COALESCE(p_limit,50),1),50000);
  v_offset:=GREATEST(COALESCE(p_offset,0),0);

  WITH base AS MATERIALIZED (
    SELECT
      a.id,
      a.data_movimento,
      a.tipo,
      a.sku,
      p.descricao AS produto,
      a.departamento_codigo AS dpto,
      d.descricao AS departamento,
      a.documento,
      a.observacao,
      a.quantidade,
      a.valor
    FROM montekali.auditorias_estoque a
    JOIN montekali.produtos p ON p.sku=a.sku
    LEFT JOIN montekali.departamentos d ON d.codigo=a.departamento_codigo
    WHERE a.loja_codigo=p_loja
      AND a.data_movimento BETWEEN p_de AND p_ate
      AND (p_dpto IS NULL OR p_dpto='' OR a.departamento_codigo=p_dpto)
      AND (p_tipo IS NULL OR a.tipo=p_tipo)
      AND (
        p_busca IS NULL OR btrim(p_busca)='' OR
        a.sku ILIKE '%'||btrim(p_busca)||'%' OR
        p.descricao ILIKE '%'||btrim(p_busca)||'%' OR
        COALESCE(d.descricao,'') ILIKE '%'||btrim(p_busca)||'%'
      )
  ),
  resumo AS (
    SELECT
      count(*) AS registros,
      count(DISTINCT sku) AS skus,
      count(DISTINCT data_movimento) AS dias,
      COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0) AS faltas,
      COALESCE(sum(valor) FILTER (WHERE tipo='entrada'),0) AS sobras,
      COALESCE(sum(quantidade) FILTER (WHERE tipo='saida'),0) AS qtde_falta,
      COALESCE(sum(quantidade) FILTER (WHERE tipo='entrada'),0) AS qtde_sobra
    FROM base
  ),
  top_faltas AS (
    SELECT
      sku,produto,dpto,departamento,
      count(*) AS ocorrencias,
      count(DISTINCT data_movimento) AS dias,
      sum(quantidade) AS quantidade,
      sum(valor) AS valor
    FROM base
    WHERE tipo='saida'
    GROUP BY sku,produto,dpto,departamento
    ORDER BY sum(valor) DESC
    LIMIT 8
  ),
  top_sobras AS (
    SELECT
      sku,produto,dpto,departamento,
      count(*) AS ocorrencias,
      count(DISTINCT data_movimento) AS dias,
      sum(quantidade) AS quantidade,
      sum(valor) AS valor
    FROM base
    WHERE tipo='entrada'
    GROUP BY sku,produto,dpto,departamento
    ORDER BY sum(valor) DESC
    LIMIT 8
  ),
  deptos AS (
    SELECT
      dpto,departamento,
      sum(valor) FILTER (WHERE tipo='saida') AS faltas,
      sum(valor) FILTER (WHERE tipo='entrada') AS sobras,
      COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0)
        - COALESCE(sum(valor) FILTER (WHERE tipo='entrada'),0) AS liquido
    FROM base
    GROUP BY dpto,departamento
    ORDER BY abs(
      COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0)
      - COALESCE(sum(valor) FILTER (WHERE tipo='entrada'),0)
    ) DESC
    LIMIT 12
  ),
  individual AS (
    SELECT *
    FROM base
    ORDER BY CASE WHEN tipo='saida' THEN 0 ELSE 1 END ASC, valor DESC, data_movimento DESC, id DESC
    LIMIT v_limit OFFSET v_offset
  ),
  agrupado AS (
    SELECT
      sku,produto,dpto,departamento,
      count(*) AS ocorrencias,
      count(DISTINCT data_movimento) AS dias,
      COALESCE(sum(quantidade) FILTER (WHERE tipo='saida'),0) AS qtde_falta,
      COALESCE(sum(quantidade) FILTER (WHERE tipo='entrada'),0) AS qtde_sobra,
      COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0) AS faltas,
      COALESCE(sum(valor) FILTER (WHERE tipo='entrada'),0) AS sobras,
      COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0)
        - COALESCE(sum(valor) FILTER (WHERE tipo='entrada'),0) AS liquido,
      COALESCE(sum(valor),0) AS movimentado
    FROM base
    GROUP BY sku,produto,dpto,departamento
    ORDER BY CASE WHEN COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0)>0 THEN 0 ELSE 1 END ASC, COALESCE(sum(valor) FILTER (WHERE tipo='saida'),0) DESC, COALESCE(sum(valor) FILTER (WHERE tipo='entrada'),0) DESC, sku
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'resumo',(
      SELECT jsonb_build_object(
        'registros',registros,
        'skus',skus,
        'dias',dias,
        'faltas',faltas,
        'sobras',sobras,
        'liquido',faltas-sobras,
        'qtde_falta',qtde_falta,
        'qtde_sobra',qtde_sobra
      )
      FROM resumo
    ),
    'top_faltas',COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM top_faltas x
    ),'[]'::jsonb),
    'top_sobras',COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM top_sobras x
    ),'[]'::jsonb),
    'departamentos',COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM deptos x
    ),'[]'::jsonb),
    'total_linhas',
      CASE
        WHEN p_modo='individual' THEN (SELECT count(*) FROM base)
        ELSE (SELECT count(*) FROM (SELECT 1 FROM base GROUP BY sku,dpto) z)
      END,
    'linhas',
      CASE
        WHEN p_modo='individual' THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'data',data_movimento,
            'tipo',tipo,
            'sku',sku,
            'produto',produto,
            'dpto',dpto,
            'departamento',departamento,
            'documento',documento,
            'observacao',observacao,
            'quantidade',quantidade,
            'valor',valor,
            'impacto',CASE WHEN tipo='saida' THEN valor ELSE -valor END
          ))
          FROM individual
        ),'[]'::jsonb)
        ELSE COALESCE((
          SELECT jsonb_agg(to_jsonb(x))
          FROM agrupado x
        ),'[]'::jsonb)
      END
  )
  INTO v_result;

  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.zai_auditorias_periodo(text,date,date,text,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_auditorias_periodo(text,date,date,text,text,text,text,integer,integer) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
