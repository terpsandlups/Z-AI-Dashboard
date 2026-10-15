BEGIN;

CREATE TABLE IF NOT EXISTS montekali.trocas_regras_fornecedor (
  loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
  fornecedor_origem text NOT NULL,
  fornecedor_grupo text NOT NULL,
  marca_padrao text,
  modalidade text NOT NULL DEFAULT 'Não definido'
    CHECK (modalidade IN (
      'Não definido',
      'Descarte',
      'Motorista retira',
      'Vendedor retira',
      'Nota de devolução',
      'Elas por elas'
    )),
  observacao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (loja_codigo,fornecedor_origem)
);

ALTER TABLE montekali.trocas_regras_fornecedor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.trocas_regras_fornecedor FROM PUBLIC,anon,authenticated;

INSERT INTO montekali.trocas_regras_fornecedor
  (loja_codigo,fornecedor_origem,fornecedor_grupo,marca_padrao,modalidade,observacao)
VALUES
  ('007','Seara ( Ativo )','Seara',NULL,'Descarte','Regra operacional informada pelo usuário'),
  ('007','Seara ( Acougue)','Seara',NULL,'Descarte','Regra operacional informada pelo usuário'),
  ('007','Itambe - Ativo','Itambé','Itambé','Descarte','Regra operacional informada pelo usuário'),
  ('007','Itambe Minas Com e Distrib De Alim Ativo Lojas','Itambé','Itambé','Descarte','Regra operacional informada pelo usuário'),
  ('007','Palmerin','Palmerin',NULL,'Motorista retira','Regra operacional informada pelo usuário'),
  ('007','Delicia Da Roca','Delícias da Roça','Delícias da Roça','Motorista retira','Regra operacional informada pelo usuário'),
  ('007','Nsa Distribuidora (yakult)','NSA Distribuidora','Yakult','Vendedor retira','Regra operacional informada pelo usuário'),
  ('007','Serramar','Serramar','Serramar','Motorista retira','Regra operacional informada pelo usuário'),
  ('007','Campobom Ltda','Campobom','Life','Vendedor retira','Marca Life inferida dos itens atuais; validar caso Campobom distribua outras marcas')
ON CONFLICT (loja_codigo,fornecedor_origem) DO UPDATE SET
  fornecedor_grupo=excluded.fornecedor_grupo,
  marca_padrao=excluded.marca_padrao,
  modalidade=excluded.modalidade,
  observacao=excluded.observacao,
  atualizado_em=now();

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
      COALESCE(r.fornecedor_grupo,t.fornecedor,'Sem fornecedor') AS fornecedor,
      CASE
        WHEN p.descricao ILIKE '%Massaleve%' THEN 'Massaleve'
        WHEN p.descricao ILIKE '%Seara%' THEN 'Seara'
        WHEN p.descricao ILIKE '%Itambe%' THEN 'Itambé'
        WHEN p.descricao ILIKE '%Yakult%' THEN 'Yakult'
        WHEN p.descricao ILIKE '%Serramar%' THEN 'Serramar'
        WHEN p.descricao ILIKE '%Delicia%Roca%' THEN 'Delícias da Roça'
        WHEN p.descricao ILIKE '% Life %' THEN 'Life'
        WHEN p.descricao ILIKE '% Kim %' THEN 'Kim'
        WHEN p.descricao ILIKE '%Frimesa%' THEN 'Frimesa'
        WHEN p.descricao ILIKE '%Verde Campo%' THEN 'Verde Campo'
        WHEN p.descricao ILIKE '%Frutap%' THEN 'Frutap'
        WHEN p.descricao ILIKE '%Xando%' THEN 'Xandô'
        WHEN p.descricao ILIKE '%Nestle%' THEN 'Nestlé'
        WHEN p.descricao ILIKE '%Panco%' THEN 'Panco'
        WHEN p.descricao ILIKE '%Prats%' THEN 'Prats'
        WHEN p.descricao ILIKE '%Mezzani%' THEN 'Mezzani'
        ELSE COALESCE(r.marca_padrao,r.fornecedor_grupo,t.fornecedor,'Não cadastrada')
      END AS marca,
      COALESCE(r.modalidade,'Não definido') AS modalidade,
      t.quantidade,
      t.valor,
      t.data_referencia,
      COALESCE(t.dados_origem->>'codigo_barras',t.dados_origem->>'ean','') AS ean,
      COALESCE(t.dados_origem->>'curva','') AS curva,
      COALESCE(t.dados_origem->>'fornecedor_codigo','') AS fornecedor_codigo
    FROM montekali.trocas_posicao t
    LEFT JOIN montekali.produtos p ON p.sku=t.sku
    LEFT JOIN montekali.departamentos d ON d.codigo=t.departamento_codigo
    LEFT JOIN montekali.trocas_regras_fornecedor r
      ON r.loja_codigo=t.loja_codigo AND r.fornecedor_origem=t.fornecedor
    WHERE t.loja_codigo=p_loja
  ),
  fornecedores AS (
    SELECT
      fornecedor,
      modalidade,
      count(*) AS skus,
      sum(quantidade) AS quantidade,
      sum(valor) AS valor,
      count(DISTINCT marca) AS marcas
    FROM itens
    GROUP BY fornecedor,modalidade
  )
  SELECT jsonb_build_object(
    'data_referencia',(SELECT max(data_referencia) FROM itens),
    'resumo',jsonb_build_object(
      'registros',(SELECT count(*) FROM itens),
      'quantidade',COALESCE((SELECT sum(quantidade) FROM itens),0),
      'valor',COALESCE((SELECT sum(valor) FROM itens),0),
      'fornecedores',(SELECT count(DISTINCT fornecedor) FROM itens),
      'marcas',(SELECT count(DISTINCT marca) FROM itens),
      'pendentes',(SELECT count(*) FROM itens WHERE modalidade='Não definido')
    ),
    'fornecedores',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fornecedor',fornecedor,
        'modalidade',modalidade,
        'skus',skus,
        'quantidade',quantidade,
        'valor',valor,
        'marcas',marcas
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
        'modalidade',modalidade,
        'quantidade',quantidade,
        'valor',valor,
        'data_referencia',data_referencia,
        'ean',ean,
        'curva',curva,
        'fornecedor_codigo',fornecedor_codigo
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
