BEGIN;

-- Destino físico confirmado pela operação em 15/10/2026.
UPDATE montekali.trocas_regras_fornecedor
SET fisico_virtual='Descartar', atualizado_em=now()
WHERE fornecedor_codigo IN ('31933','30074','56049','77496','17396');

UPDATE montekali.trocas_regras_fornecedor
SET fisico_virtual='Precisa guardar o físico', atualizado_em=now()
WHERE fornecedor_codigo IN ('73865','40770','36331','74845','72826');


-- Regras complementares confirmadas pela operação.
UPDATE montekali.trocas_regras_fornecedor
SET tratativa='Nota de Devolução',
    categoria='nf_devolucao',
    forma='Motorista Retira',
    marca_produto='Ruffles/Cheetos/Elma Chips/Tostitos/Fandangos/Lays/Baconzitos/Torcida',
    fisico_virtual='Precisa guardar o físico',
    atualizado_em=now()
WHERE fornecedor_codigo='33910';


CREATE INDEX IF NOT EXISTS perdas_loja_id
  ON montekali.perdas(loja_codigo,id);

CREATE INDEX IF NOT EXISTS lotes_importacao_loja_id
  ON montekali.lotes_importacao(loja_codigo,id DESC);

CREATE INDEX IF NOT EXISTS auditorias_estoque_loja_data_tipo_dpto
  ON montekali.auditorias_estoque(loja_codigo,data_movimento,tipo,departamento_codigo);

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
   SELECT jsonb_agg(
     jsonb_build_array(data_movimento,sku,departamento_codigo,motivo,quantidade,valor)
     ORDER BY id
   )
   FROM montekali.perdas
   WHERE loja_codigo=p_loja
 ),'[]'::jsonb),

 -- Histórico mensal compacto: uma linha por competência/departamento.
 -- Mantém o fallback dos meses antigos sem devolver mais de 100 mil linhas SKU/mês.
 'vendas_mensais',COALESCE((
   SELECT jsonb_agg(
     jsonb_build_array(to_char(x.competencia,'YYYY-MM'),'',
       x.departamento_codigo,x.quantidade,x.valor)
     ORDER BY x.competencia,x.departamento_codigo
   )
   FROM (
     SELECT competencia,departamento_codigo,
            sum(quantidade) quantidade,sum(valor) valor
     FROM montekali.vendas_mensais
     WHERE loja_codigo=p_loja
     GROUP BY competencia,departamento_codigo
   ) x
 ),'[]'::jsonb),

 'vendas_diarias','[]'::jsonb,

 'vendas_diarias_resumo',COALESCE((
   SELECT jsonb_agg(
     jsonb_build_array(data_movimento,departamento_codigo,valor)
     ORDER BY data_movimento,departamento_codigo
   )
   FROM montekali.vendas_resumo_dia
   WHERE loja_codigo=p_loja
 ),'[]'::jsonb),

 -- O detalhe de produtos é consultado sob demanda por zai_vendas_produtos_periodo.
 'vendas_diarias_produto_mes','[]'::jsonb,

 'dias_vendas_completos',COALESCE((
   SELECT jsonb_agg(data_movimento ORDER BY data_movimento)
   FROM montekali.cobertura_vendas
   WHERE loja_codigo=p_loja
 ),'[]'::jsonb),

 'auditorias_diarias_resumo',COALESCE((
   SELECT jsonb_agg(
     jsonb_build_array(data_movimento,tipo,departamento_codigo,quantidade,valor)
     ORDER BY data_movimento,tipo,departamento_codigo
   )
   FROM (
     SELECT data_movimento,tipo,departamento_codigo,
            sum(quantidade) quantidade,sum(valor) valor
     FROM montekali.auditorias_estoque
     WHERE loja_codigo=p_loja
     GROUP BY data_movimento,tipo,departamento_codigo
   ) x
 ),'[]'::jsonb),

 'auditorias_resumo',jsonb_build_object(
   'entrada',(
      SELECT jsonb_build_object(
        'registros',count(*),
        'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),
        'ultima_data',max(data_movimento)
      )
      FROM montekali.auditorias_estoque
      WHERE loja_codigo=p_loja AND tipo='entrada'
   ),
   'saida',(
      SELECT jsonb_build_object(
        'registros',count(*),
        'quantidade',coalesce(sum(quantidade),0),
        'valor',coalesce(sum(valor),0),
        'ultima_data',max(data_movimento)
      )
      FROM montekali.auditorias_estoque
      WHERE loja_codigo=p_loja AND tipo='saida'
   )
 ),

 'trocas_resumo',(
    WITH atual AS (
      SELECT t.dados_origem->>'fornecedor_codigo' fornecedor_codigo
      FROM montekali.trocas_posicao t
      WHERE t.loja_codigo=p_loja
      GROUP BY t.dados_origem->>'fornecedor_codigo'
    )
    SELECT jsonb_build_object(
      'registros',(SELECT count(*) FROM montekali.trocas_posicao WHERE loja_codigo=p_loja),
      'quantidade',(SELECT coalesce(sum(quantidade),0) FROM montekali.trocas_posicao WHERE loja_codigo=p_loja),
      'valor',(SELECT coalesce(sum(valor),0) FROM montekali.trocas_posicao WHERE loja_codigo=p_loja),
      'data_referencia',(SELECT max(data_referencia) FROM montekali.trocas_posicao WHERE loja_codigo=p_loja),
      'fornecedores',(SELECT count(*) FROM atual),
      'fornecedores_catalogados',(SELECT count(*) FROM montekali.trocas_regras_fornecedor WHERE ativo),
      'fornecedores_zerados',(
        SELECT count(*)
        FROM montekali.trocas_regras_fornecedor r
        LEFT JOIN atual a ON a.fornecedor_codigo=r.fornecedor_codigo
        WHERE r.ativo AND a.fornecedor_codigo IS NULL
      ),
      'fornecedores_sem_regra',(
        SELECT count(*)
        FROM atual a
        LEFT JOIN montekali.trocas_regras_fornecedor r
          ON r.fornecedor_codigo=a.fornecedor_codigo AND r.ativo
        WHERE r.fornecedor_codigo IS NULL
      )
    )
 ),

 -- Catálogo completo de fornecedores de troca + posição atual.
 -- Assim fornecedores sem saldo continuam aparecendo com valor/quantidade zero.
 'trocas_fornecedores',COALESCE((
   WITH atual AS (
     SELECT
       t.dados_origem->>'fornecedor_codigo' fornecedor_codigo,
       max(t.fornecedor) fornecedor,
       count(*) skus,
       sum(t.quantidade) quantidade,
       sum(t.valor) valor
     FROM montekali.trocas_posicao t
     WHERE t.loja_codigo=p_loja
     GROUP BY t.dados_origem->>'fornecedor_codigo'
   )
   SELECT jsonb_agg(jsonb_build_object(
     'fornecedor_codigo',x.fornecedor_codigo,
     'fornecedor',x.fornecedor,
     'fornecedor_referencia',x.fornecedor_referencia,
     'skus',x.skus,
     'quantidade',x.quantidade,
     'valor',x.valor,
     'categoria',x.categoria,
     'tratativa',x.tratativa,
     'forma',x.forma,
     'marca_produto',x.marca_produto,
     'fisico_virtual',x.fisico_virtual,
     'status_saldo',CASE WHEN x.valor<>0 OR x.quantidade<>0 OR x.skus<>0 THEN 'com_saldo' ELSE 'zerado' END
   ) ORDER BY
     CASE WHEN x.valor<>0 OR x.quantidade<>0 OR x.skus<>0 THEN 0 ELSE 1 END,
     x.valor DESC,
     x.fornecedor)
   FROM (
     SELECT
       COALESCE(a.fornecedor_codigo,r.fornecedor_codigo) fornecedor_codigo,
       COALESCE(NULLIF(a.fornecedor,''),r.fornecedor_referencia,'Sem nome') fornecedor,
       r.fornecedor_referencia,
       COALESCE(a.skus,0) skus,
       COALESCE(a.quantidade,0) quantidade,
       COALESCE(a.valor,0) valor,
       COALESCE(r.categoria,'sem_cadastro') categoria,
       COALESCE(r.tratativa,'Sem tratativa cadastrada') tratativa,
       r.forma,
       r.marca_produto,
       r.fisico_virtual
     FROM montekali.trocas_regras_fornecedor r
     FULL OUTER JOIN atual a ON a.fornecedor_codigo=r.fornecedor_codigo
     WHERE r.fornecedor_codigo IS NULL OR r.ativo
   ) x
 ),'[]'::jsonb),

 'trocas_itens',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'sku',t.sku,
     'produto',p.descricao,
     'dpto',t.departamento_codigo,
     'fornecedor_codigo',t.dados_origem->>'fornecedor_codigo',
     'fornecedor',t.fornecedor,
     'quantidade',t.quantidade,
     'valor',t.valor,
     'curva',t.dados_origem->>'curva',
     'categoria',COALESCE(r.categoria,'sem_cadastro'),
     'tratativa',COALESCE(r.tratativa,'Sem tratativa cadastrada'),
     'forma',r.forma,
     'marca_produto',r.marca_produto,
     'fisico_virtual',r.fisico_virtual
   ) ORDER BY t.valor DESC)
   FROM montekali.trocas_posicao t
   JOIN montekali.produtos p ON p.sku=t.sku
   LEFT JOIN montekali.trocas_regras_fornecedor r
     ON r.fornecedor_codigo=t.dados_origem->>'fornecedor_codigo' AND r.ativo
   WHERE t.loja_codigo=p_loja
 ),'[]'::jsonb),

 'historico',COALESCE((
   SELECT jsonb_agg(t)
   FROM (
     SELECT arquivo_nome AS file,
            importado_em AS "when",
            registros AS rows,
            valor_total AS value,
            tipo
     FROM montekali.lotes_importacao
     WHERE loja_codigo=p_loja
     ORDER BY id DESC
     LIMIT 60
   ) t
 ),'[]'::jsonb),

 'aviso',COALESCE(c.configuracao->>'aviso','')
 ) INTO result
 FROM (SELECT 1) a
 LEFT JOIN montekali.configuracao_painel c
   ON c.loja_codigo=p_loja;

 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
