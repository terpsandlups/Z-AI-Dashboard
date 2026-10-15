BEGIN;

CREATE OR REPLACE FUNCTION public.zai_trocas(p_loja text DEFAULT '007')
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

  WITH itens AS (
    SELECT
      t.sku,
      p.descricao AS produto,
      t.departamento_codigo AS dpto,
      d.descricao AS departamento,
      t.fornecedor AS fornecedor_origem,
      COALESCE(r.grupo_exibicao,r.fornecedor_referencia,t.fornecedor,'Sem fornecedor') AS fornecedor,
      CASE
        WHEN p.descricao ILIKE '%Ruffles%' THEN 'Ruffles'
        WHEN p.descricao ILIKE '%Cheetos%' THEN 'Cheetos'
        WHEN p.descricao ILIKE '%Tostitos%' THEN 'Tostitos'
        WHEN p.descricao ILIKE '%Fandangos%' THEN 'Fandangos'
        WHEN p.descricao ILIKE '%Lays%' THEN 'Lays'
        WHEN p.descricao ILIKE '%Baconzitos%' THEN 'Baconzitos'
        WHEN p.descricao ILIKE '%Torcida%' THEN 'Torcida'
        WHEN p.descricao ILIKE '%Frimesa%' THEN 'Frimesa'
        WHEN p.descricao ILIKE '%Verde Campo%' THEN 'Verde Campo'
        WHEN p.descricao ILIKE '%Frutap%' THEN 'Frutap'
        WHEN p.descricao ILIKE '%Xando%' THEN 'Xandô'
        WHEN p.descricao ILIKE '%Porto Alegre%' THEN 'Porto Alegre'
        WHEN p.descricao ILIKE '%Nestle%' THEN 'Nestlé'
        WHEN p.descricao ILIKE '%Panco%' THEN 'Panco'
        WHEN p.descricao ILIKE '%Prats%' THEN 'Prats'
        WHEN p.descricao ILIKE '%Mezzani%' THEN 'Mezzani'
        WHEN p.descricao ILIKE '%Massabor%' THEN 'Massabor'
        WHEN p.descricao ILIKE '%Massa Da Feira%' THEN 'Massa da Feira'
        WHEN p.descricao ILIKE '%Massaleve%' THEN 'Massaleve'
        WHEN p.descricao ILIKE '%Seara%' THEN 'Seara'
        WHEN p.descricao ILIKE '%Itambe%' THEN 'Itambé'
        WHEN p.descricao ILIKE '%Yakult%' THEN 'Yakult'
        WHEN p.descricao ILIKE '%Serramar%' THEN 'Serramar'
        WHEN p.descricao ILIKE '%Delicia%Roca%' THEN 'Delícia da Roça'
        WHEN p.descricao ILIKE '% Life %' THEN 'Life'
        WHEN p.descricao ILIKE '% Kim %' THEN 'Kim'
        WHEN p.descricao ILIKE '%Catupiry%' THEN 'Catupiry'
        WHEN p.descricao ILIKE '%Jamava%' THEN 'Jamava'
        ELSE COALESCE(
          CASE
            WHEN r.marca_produto IS NULL
              OR r.marca_produto ILIKE '%/%'
              OR lower(r.marca_produto) IN ('toda linha','iogurtes','somente iogurtes')
            THEN NULL
            ELSE r.marca_produto
          END,
          r.grupo_exibicao,
          t.fornecedor,
          'Não cadastrada'
        )
      END AS marca,
      COALESCE(r.tratativa,'Regra não cadastrada') AS tratativa,
      CASE COALESCE(r.categoria,'')
        WHEN 'nf_devolucao' THEN 'Nota de devolução'
        WHEN 'troca_produto' THEN 'Elas por elas / Produto por produto'
        WHEN 'bonificacao' THEN 'Bonificação'
        WHEN 'mista' THEN 'Mista'
        ELSE 'Não definido'
      END AS categoria,
      COALESCE(r.forma,'') AS forma,
      COALESCE(r.fisico_virtual,'') AS fisico_virtual,
      t.quantidade,
      t.valor,
      t.data_referencia,
      COALESCE(t.dados_origem->>'codigo_barras',t.dados_origem->>'ean','') AS ean,
      COALESCE(t.dados_origem->>'curva','') AS curva,
      COALESCE(t.dados_origem->>'fornecedor_codigo','') AS fornecedor_codigo,
      (r.fornecedor_codigo IS NULL) AS regra_ausente,
      (
        r.fornecedor_codigo IS NULL OR
        (r.forma IS NULL AND COALESCE(r.fisico_virtual,'') NOT ILIKE 'Descart%')
      ) AS regra_incompleta
    FROM montekali.trocas_posicao t
    LEFT JOIN montekali.produtos p ON p.sku=t.sku
    LEFT JOIN montekali.departamentos d ON d.codigo=t.departamento_codigo
    LEFT JOIN montekali.trocas_regras_fornecedor r
      ON r.fornecedor_codigo=COALESCE(t.dados_origem->>'fornecedor_codigo','')
     AND COALESCE(r.ativo,true)
    WHERE t.loja_codigo=p_loja
  ),
  fornecedores AS (
    SELECT
      fornecedor,
      categoria,
      tratativa,
      forma,
      fisico_virtual,
      count(*) AS skus,
      sum(quantidade) AS quantidade,
      sum(valor) AS valor,
      count(DISTINCT marca) AS marcas,
      bool_or(regra_incompleta) AS pendente
    FROM itens
    GROUP BY fornecedor,categoria,tratativa,forma,fisico_virtual
  )
  SELECT jsonb_build_object(
    'data_referencia',(SELECT max(data_referencia) FROM itens),
    'resumo',jsonb_build_object(
      'registros',(SELECT count(*) FROM itens),
      'quantidade',COALESCE((SELECT sum(quantidade) FROM itens),0),
      'valor',COALESCE((SELECT sum(valor) FROM itens),0),
      'fornecedores',(SELECT count(DISTINCT fornecedor) FROM itens),
      'marcas',(SELECT count(DISTINCT marca) FROM itens),
      'pendencias',(SELECT count(*) FROM itens WHERE regra_incompleta)
    ),
    'fornecedores',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fornecedor',fornecedor,
        'categoria',categoria,
        'tratativa',tratativa,
        'forma',forma,
        'fisico_virtual',fisico_virtual,
        'skus',skus,
        'quantidade',quantidade,
        'valor',valor,
        'marcas',marcas,
        'pendente',pendente
      ) ORDER BY valor DESC)
      FROM fornecedores
    ),'[]'::jsonb),
    'itens',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'sku',sku,
        'produto',produto,
        'dpto',dpto,
        'departamento',departamento,
        'fornecedor_origem',fornecedor_origem,
        'fornecedor',fornecedor,
        'marca',marca,
        'tratativa',tratativa,
        'categoria',categoria,
        'forma',forma,
        'fisico_virtual',fisico_virtual,
        'quantidade',quantidade,
        'valor',valor,
        'data_referencia',data_referencia,
        'ean',ean,
        'curva',curva,
        'fornecedor_codigo',fornecedor_codigo,
        'regra_ausente',regra_ausente,
        'regra_incompleta',regra_incompleta
      ) ORDER BY fornecedor,valor DESC,produto)
      FROM itens
    ),'[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.zai_trocas(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_trocas(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
