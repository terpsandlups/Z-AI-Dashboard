-- Vendas: lista de produtos histórica paginada, preservando a RPC original.
-- Não grava/migra dados; reutiliza o mesmo mecanismo de origem mensal ou diária.
CREATE OR REPLACE FUNCTION public.zai_vendas_produtos_pagina(
 p_loja text,
 p_de date,
 p_ate date,
 p_dpto text DEFAULT NULL,
 p_busca text DEFAULT '',
 p_situacao text DEFAULT '',
 p_pagina integer DEFAULT 0,
 p_tamanho integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
 v_base jsonb;
 v_result jsonb;
BEGIN
 IF p_pagina IS NULL OR p_pagina<0 OR p_pagina>100000
   OR p_tamanho IS NULL OR p_tamanho NOT BETWEEN 1 AND 100
   OR length(coalesce(p_busca,''))>160
   OR length(coalesce(p_situacao,''))>60 THEN
  RAISE EXCEPTION 'Filtros de paginação inválidos' USING ERRCODE='22023';
 END IF;
 -- Mantém a autorização por loja e a regra anti-dupla-contagem da RPC original.
 v_base:=public.zai_vendas_produtos_periodo(p_loja,p_de,p_ate,p_dpto);
 WITH base AS MATERIALIZED (
  SELECT e.value AS registro,
   COALESCE((e.value->>'valor')::numeric,0) AS valor,
   COALESCE(e.value->>'sku','') AS sku,
   COALESCE(e.value->>'produto','') AS produto,
   COALESCE(e.value->>'situacao','') AS situacao
  FROM jsonb_array_elements(v_base) AS e(value)
 ), filtrado AS MATERIALIZED (
  SELECT * FROM base b WHERE
   (coalesce(trim(p_busca),'')='' OR
     strpos(lower(b.sku),lower(trim(p_busca)))>0 OR
     strpos(lower(b.produto),lower(trim(p_busca)))>0)
   AND (coalesce(trim(p_situacao),'')='' OR b.situacao=p_situacao)
 ), pagina AS (
  SELECT * FROM filtrado ORDER BY valor DESC,sku,produto
  LIMIT p_tamanho OFFSET (p_pagina::bigint*p_tamanho)
 )
 SELECT jsonb_build_object(
  'linhas',coalesce((SELECT jsonb_agg(p.registro ORDER BY p.valor DESC,p.sku,p.produto)
                    FROM pagina p),'[]'::jsonb),
  'total_filtrado',(SELECT count(*) FROM filtrado),
  'valor_filtrado',(SELECT coalesce(sum(valor),0) FROM filtrado),
  'total_geral',(SELECT count(*) FROM base),
  'valor_geral',(SELECT coalesce(sum(valor),0) FROM base),
  'pagina',p_pagina,
  'tamanho',p_tamanho,
  'periodo_inicio',p_de,'periodo_fim',p_ate,
  'granularidade','consulta_consolidada'
 ) INTO v_result;
 RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.zai_vendas_produtos_pagina(text,date,date,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_vendas_produtos_pagina(text,date,date,text,text,text,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
