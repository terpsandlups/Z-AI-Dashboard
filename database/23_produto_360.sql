-- Produto 360° · Consulta autenticada por loja, SKU, período e departamento.
-- Não faz JOIN entre tabelas de fatos; agrega fatos em UNION ALL para impedir fan-out.
-- Períodos maiores que 366 dias devem ser consultados em janelas menores.
CREATE OR REPLACE FUNCTION public.zai_produto_360(
 p_loja text, p_sku text, p_de date, p_ate date, p_dpto text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
 v_result jsonb;
 v_dias integer;
 v_cobertos integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM montekali.acessos
   WHERE usuario=auth.uid() AND loja_codigo=p_loja
 ) THEN RAISE EXCEPTION 'Acesso nao autorizado a esta loja'
   USING ERRCODE='42501'; END IF;
 IF p_sku IS NULL OR p_sku !~ '^[0-9]{1,32}$' THEN
   RAISE EXCEPTION 'Informe um SKU numerico valido'; END IF;
 IF p_de IS NULL OR p_ate IS NULL OR p_de>p_ate OR p_ate-p_de>365 THEN
   RAISE EXCEPTION 'Selecione um periodo valido de ate 366 dias'; END IF;
 IF p_dpto IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM montekali.departamentos WHERE codigo=p_dpto
 ) THEN RAISE EXCEPTION 'Departamento invalido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM montekali.produtos WHERE sku=p_sku) THEN
   RAISE EXCEPTION 'SKU nao cadastrado'; END IF;
 v_dias:=p_ate-p_de+1;
 SELECT COUNT(*) INTO v_cobertos
 FROM montekali.cobertura_vendas
 WHERE loja_codigo=p_loja AND data_movimento BETWEEN p_de AND p_ate;

 WITH eventos AS MATERIALIZED (
   SELECT v.id,v.lote_id,v.data_movimento AS dia,v.departamento_codigo AS dpto,
          'venda'::text AS tipo,NULL::text AS detalhe,
          v.quantidade AS quantidade,v.valor AS valor
   FROM montekali.vendas v
   WHERE v.loja_codigo=p_loja AND v.sku=p_sku
     AND v.data_movimento BETWEEN p_de AND p_ate
     AND (p_dpto IS NULL OR v.departamento_codigo=p_dpto)
   UNION ALL
   SELECT p.id,p.lote_id,p.data_movimento,p.departamento_codigo,
          'reconhecida',p.motivo,p.quantidade,p.valor
   FROM montekali.perdas p
   WHERE p.loja_codigo=p_loja AND p.sku=p_sku
     AND p.data_movimento BETWEEN p_de AND p_ate
     AND (p_dpto IS NULL OR p.departamento_codigo=p_dpto)
   UNION ALL
   SELECT a.id,a.lote_id,a.data_movimento,a.departamento_codigo,
          CASE WHEN a.tipo='saida' THEN 'falta' ELSE 'sobra' END,
          COALESCE(NULLIF(a.documento,''),a.observacao),a.quantidade,a.valor
   FROM montekali.auditorias_estoque a
   WHERE a.loja_codigo=p_loja AND a.sku=p_sku
     AND a.data_movimento BETWEEN p_de AND p_ate
     AND (p_dpto IS NULL OR a.departamento_codigo=p_dpto)
 ),
 totais AS (
   SELECT COUNT(*)::integer AS eventos,
    COUNT(*) FILTER (WHERE tipo='venda')::integer AS registros_venda,
    COUNT(*) FILTER (WHERE tipo='reconhecida')::integer AS ocorrencias_quebra,
    COUNT(*) FILTER (WHERE tipo='falta')::integer AS ocorrencias_falta,
    COUNT(*) FILTER (WHERE tipo='sobra')::integer AS ocorrencias_sobra,
    COALESCE(SUM(valor) FILTER (WHERE tipo='venda'),0) AS vendas,
    COALESCE(SUM(quantidade) FILTER (WHERE tipo='venda'),0) AS quantidade_vendida,
    COALESCE(SUM(valor) FILTER (WHERE tipo='reconhecida'),0) AS reconhecidas,
    COALESCE(SUM(quantidade) FILTER (WHERE tipo='reconhecida'),0) AS quantidade_quebra,
    COALESCE(SUM(valor) FILTER (WHERE tipo='falta'),0) AS faltas,
    COALESCE(SUM(quantidade) FILTER (WHERE tipo='falta'),0) AS quantidade_falta,
    COALESCE(SUM(valor) FILTER (WHERE tipo='sobra'),0) AS sobras,
    COALESCE(SUM(quantidade) FILTER (WHERE tipo='sobra'),0) AS quantidade_sobra
   FROM eventos
 ),
 diario AS (
  SELECT dia,
    COALESCE(SUM(valor) FILTER(WHERE tipo='venda'),0) AS vendas,
    COALESCE(SUM(valor) FILTER(WHERE tipo='reconhecida'),0) AS reconhecidas,
    COALESCE(SUM(valor) FILTER(WHERE tipo='falta'),0) AS faltas,
    COALESCE(SUM(valor) FILTER(WHERE tipo='sobra'),0) AS sobras
  FROM eventos GROUP BY dia
 ),
 departamentos AS (
  SELECT e.dpto,d.descricao AS departamento,
    COALESCE(SUM(e.valor) FILTER(WHERE e.tipo='venda'),0) AS vendas,
    COALESCE(SUM(e.valor) FILTER(WHERE e.tipo='reconhecida'),0) AS reconhecidas,
    COALESCE(SUM(e.valor) FILTER(WHERE e.tipo='falta'),0) AS faltas,
    COALESCE(SUM(e.valor) FILTER(WHERE e.tipo='sobra'),0) AS sobras
  FROM eventos e LEFT JOIN montekali.departamentos d ON d.codigo=e.dpto
  GROUP BY e.dpto,d.descricao
 ),
 motivos AS (
  SELECT detalhe AS motivo,COUNT(*) AS ocorrencias,SUM(valor) AS valor
  FROM eventos WHERE tipo='reconhecida'
  GROUP BY detalhe ORDER BY SUM(valor) DESC
 )
 SELECT jsonb_build_object(
  'sku',p_sku,
  'produto',(SELECT descricao FROM montekali.produtos WHERE sku=p_sku),
  'marca',(SELECT marca FROM montekali.produtos WHERE sku=p_sku),
  'situacao',(SELECT situacao_atual FROM montekali.produtos WHERE sku=p_sku),
  'loja',p_loja,
  'departamento_filtro',p_dpto,
  'inicio',p_de,'fim',p_ate,
  'cobertura',jsonb_build_object(
    'dias_periodo',v_dias,'dias_cobertos',v_cobertos,
    'completa',v_dias=v_cobertos),
  'totais',(SELECT jsonb_build_object(
   'vendas',vendas,'quantidade_vendida',quantidade_vendida,
   'reconhecidas',reconhecidas,'quantidade_quebra',quantidade_quebra,
   'faltas',faltas,'quantidade_falta',quantidade_falta,
   'sobras',sobras,'quantidade_sobra',quantidade_sobra,
   'consolidadas',reconhecidas+faltas-sobras,
   'percentual',CASE WHEN v_cobertos=v_dias AND vendas>0
                   THEN (reconhecidas+faltas-sobras)/vendas ELSE NULL END,
   'eventos',eventos,'registros_venda',registros_venda,
   'ocorrencias_quebra',ocorrencias_quebra,
   'ocorrencias_falta',ocorrencias_falta,
   'ocorrencias_sobra',ocorrencias_sobra) FROM totais),
  'diario',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'data',dia,'vendas',vendas,'reconhecidas',reconhecidas,
    'faltas',faltas,'sobras',sobras) ORDER BY dia) FROM diario),'[]'::jsonb),
  'departamentos',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'codigo',dpto,'nome',departamento,'vendas',vendas,'reconhecidas',reconhecidas,
    'faltas',faltas,'sobras',sobras) ORDER BY vendas DESC) FROM departamentos),'[]'::jsonb),
  'motivos',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'motivo',motivo,'ocorrencias',ocorrencias,'valor',valor)) FROM (SELECT * FROM motivos LIMIT 20) m),'[]'::jsonb),
  'movimentos',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',e.id,'lote_id',e.lote_id,'data',e.dia,'tipo',e.tipo,'detalhe',e.detalhe,
    'departamento',e.dpto,'quantidade',e.quantidade,'valor',e.valor
    ) ORDER BY e.dia DESC,e.id DESC)
    FROM (SELECT * FROM eventos ORDER BY dia DESC,id DESC LIMIT 200) e),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $fn$;

REVOKE ALL ON FUNCTION public.zai_produto_360(text,text,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_produto_360(text,text,date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';