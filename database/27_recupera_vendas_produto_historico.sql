-- Recupera a consulta por SKU nos meses históricos sem recriar ou alterar dados.
-- Em mês fechado: se não há fatos diários, usa as vendas mensais já consolidadas.
-- Em intervalos parciais de meses históricos sem fatos diários, recusa distribuir
-- artificialmente valores de um mês inteiro por datas não discriminadas.
CREATE OR REPLACE FUNCTION public.zai_vendas_produtos_periodo(
 p_loja text,p_de date,p_ate date,p_dpto text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
 v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM montekali.acessos
  WHERE usuario=auth.uid() AND loja_codigo=p_loja
 ) THEN
  RAISE EXCEPTION 'Usuario sem acesso a esta loja' USING ERRCODE='42501';
 END IF;
 IF p_de IS NULL OR p_ate IS NULL OR p_de>p_ate OR p_ate-p_de>3660 THEN
  RAISE EXCEPTION 'Informe um periodo valido de ate 3661 dias';
 END IF;
 IF p_dpto IS NOT NULL AND p_dpto<>'' AND NOT EXISTS(
   SELECT 1 FROM montekali.departamentos WHERE codigo=p_dpto
 ) THEN RAISE EXCEPTION 'Departamento invalido'; END IF;

 -- Uma competência legada com SKU mensal, mas sem movimentos diários, não
 -- permite detalhamento honesto de intervalos menores que o mês inteiro.
 IF EXISTS(
  WITH calendario AS(
   SELECT g.mes::date competencia,
    GREATEST(p_de,g.mes::date) dia_inicio,
    LEAST(p_ate,(g.mes+interval '1 month - 1 day')::date) dia_fim,
    (g.mes+interval '1 month - 1 day')::date ultimo_dia
   FROM (SELECT generate_series(date_trunc('month',p_de)::date,
        date_trunc('month',p_ate)::date,interval '1 month') mes) g
  )
  SELECT 1 FROM calendario c
   WHERE (c.dia_inicio<>c.competencia OR c.dia_fim<>c.ultimo_dia)
    AND EXISTS(SELECT 1 FROM montekali.vendas_mensais m
      WHERE m.loja_codigo=p_loja AND m.competencia=c.competencia)
    AND NOT EXISTS(SELECT 1 FROM montekali.vendas v
      WHERE v.loja_codigo=p_loja AND v.data_movimento BETWEEN c.dia_inicio AND c.dia_fim)
 ) THEN
  RAISE EXCEPTION 'O historico desse mes possui vendas por SKU somente no fechamento mensal. Selecione o mes completo para visualizar produtos; nao existem dados diarios por SKU para dividir valores por datas.'
   USING ERRCODE='22023';
 END IF;

 WITH calendario AS MATERIALIZED(
  SELECT g.mes::date competencia,
   GREATEST(p_de,g.mes::date) dia_inicio,
   LEAST(p_ate,(g.mes+interval '1 month - 1 day')::date) dia_fim,
   (g.mes+interval '1 month - 1 day')::date ultimo_dia
  FROM (SELECT generate_series(date_trunc('month',p_de)::date,
        date_trunc('month',p_ate)::date,interval '1 month') mes) g
 ),
 origem AS MATERIALIZED(
  SELECT c.*,
   (SELECT COUNT(*)::integer FROM montekali.cobertura_vendas cv
      WHERE cv.loja_codigo=p_loja AND cv.data_movimento BETWEEN c.dia_inicio AND c.dia_fim
   ) AS dias_cobertos,
   EXISTS(SELECT 1 FROM montekali.vendas v
     WHERE v.loja_codigo=p_loja AND v.data_movimento BETWEEN c.dia_inicio AND c.dia_fim
   ) AS tem_movimento_diario,
   EXISTS(SELECT 1 FROM montekali.vendas_mensais m
     WHERE m.loja_codigo=p_loja AND m.competencia=c.competencia
   ) AS tem_mensal
  FROM calendario c
 ),
 fontes AS MATERIALIZED(
  SELECT o.*,
   CASE WHEN o.tem_mensal
         AND o.dia_inicio=o.competencia AND o.dia_fim=o.ultimo_dia
         AND (NOT o.tem_movimento_diario OR o.dias_cobertos<(o.dia_fim-o.dia_inicio+1))
    THEN 'mensal' ELSE 'diaria' END AS tipo
  FROM origem o
 ),
 movimentos AS (
  SELECT v.sku,v.departamento_codigo,v.quantidade,v.valor
  FROM fontes f
  JOIN montekali.vendas v
    ON v.loja_codigo=p_loja AND v.data_movimento BETWEEN f.dia_inicio AND f.dia_fim
  WHERE f.tipo='diaria' AND
   EXISTS(SELECT 1 FROM montekali.cobertura_vendas cv
    WHERE cv.loja_codigo=p_loja AND cv.data_movimento=v.data_movimento)
  UNION ALL
  SELECT m.sku,m.departamento_codigo,m.quantidade,m.valor
  FROM fontes f
  JOIN montekali.vendas_resumo_produto_mes m
    ON m.loja_codigo=p_loja AND m.competencia=f.competencia
  WHERE f.tipo='mensal'
 ),
 consolidados AS (
  SELECT sku,departamento_codigo,
   SUM(quantidade) AS quantidade,SUM(valor) AS valor
  FROM movimentos
  WHERE p_dpto IS NULL OR p_dpto='' OR departamento_codigo=p_dpto
  GROUP BY sku,departamento_codigo
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'sku',x.sku,'produto',COALESCE(p.descricao,x.sku),
  'situacao',COALESCE(p.situacao_atual,'Nao informado'),
  'dpto',x.departamento_codigo,'quantidade',x.quantidade,'valor',x.valor
 ) ORDER BY x.valor DESC,x.sku),'[]'::jsonb)
 INTO v_result
 FROM consolidados x LEFT JOIN montekali.produtos p ON p.sku=x.sku;

 RETURN v_result;
END $fn$;

REVOKE ALL ON FUNCTION public.zai_vendas_produtos_periodo(text,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_vendas_produtos_periodo(text,date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
