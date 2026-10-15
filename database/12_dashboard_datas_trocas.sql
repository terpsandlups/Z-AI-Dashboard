BEGIN;

CREATE TABLE IF NOT EXISTS montekali.trocas_regras_fornecedor (
  fornecedor_codigo text PRIMARY KEY,
  fornecedor_referencia text NOT NULL,
  tratativa text NOT NULL,
  categoria text NOT NULL,
  forma text,
  marca_produto text,
  fisico_virtual text,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE montekali.trocas_regras_fornecedor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.trocas_regras_fornecedor FROM PUBLIC, anon, authenticated;

INSERT INTO montekali.trocas_regras_fornecedor
(fornecedor_codigo,fornecedor_referencia,tratativa,categoria,forma,marca_produto,fisico_virtual)
VALUES
('35645','Comercial Paty ( F.L.V.)','NF Devolução','nf_devolucao','Motorista Retira','Batatas/Cebola roxa','Precisa guardar o físico'),
('72494','Ítalo Brasileira','NF Devolução','nf_devolucao','Motorista Retira','Batatas/Cebola roxa','Precisa guardar o físico'),
('62359','Morangos Gv','Elas por elas','elas_por_elas','Quantidade no Grupo Whatsapp','Morangos Gv','Precisa guardar o físico'),
('10871','Ovos Prado ( F.L.V ) Casa','Elas por elas','elas_por_elas','Tirar relatório na entrega','Ovos Prado','Descartar'),
('43505','Ovos Preti Ltda','Elas por elas','elas_por_elas','Tirar relatório na entrega','Preti','Descartar'),
('2283','Piasi','Elas por elas','elas_por_elas','Precisa guardar o físico','Alho Piasi','Precisa guardar o físico'),
('36633','Sasim - Comercio De Hortifrutigranjeiros ( F.L.V)','Elas por elas','elas_por_elas','Tirar relatório na entrega','Jovanil','Descartar'),
('435','Aliança Iogurte','NF (350 a 500$)','nf_devolucao','NFD na entrega (motorista)','Frutap/Frutilac/Aricanduva','Descartar'),
('48429','Delta Comercial','NFD (Apenas Vencidos)','nf_devolucao','Passar quantidade para Vendedor','Suco Life','Precisa guardar o físico'),
('24295','Demarchi (ativo)','NFD na entrega','nf_devolucao','Promotor - semanal','Demarchi','Precisa guardar o físico'),
('39144','Fazenda Bela Vista','NF Devolução','nf_devolucao','Promotor','Fazenda Bela Vista','Descartar físico'),
('1120','Frimesa','Bonificação','bonificacao','Passar quantidade para Comprador','Somente iogurtes','Descartar'),
('17396','Itambé','NF (350 a 500$)','nf_devolucao','Passar quantidade para Vendedor','Itambé','Descartar'),
('33952','Karen Fernanda Passarin','NF (350 a 500$)','nf_devolucao','Entrega / Motorista Retira','Coronata/Zinho','Precisa guardar o físico'),
('51900','Laticínios Monte Celeste','NF Devolução (350 a 500$)','nf_devolucao','Motorista Retira','Monteminas/Dumont','Precisa guardar o físico'),
('37702','Laticínios Porto Alegre','NF Devolução','nf_devolucao','Passar quantidade para Vendedor','Porto Alegre','Precisa guardar o físico'),
('53015','Laticínios Xando','NFD de Sucos e Leite (exceto leite tipo A/rico)','nf_devolucao','Promotor / NF direta vendedor','Xando','Precisa guardar o físico (pode esvaziar)'),
('124','Mantuanelli e Mantuanelli Ltda','NFD na entrega (somente congelado)','nf_devolucao','Motorista Retira','Mantuanelli','Precisa guardar o físico'),
('63622','Marselha','Produto por produto','produto_por_produto','Passar quantidade para Vendedor','Catupiry','Precisa guardar o físico'),
('61336','Massa Da Feira','NF Devolução','nf_devolucao','Passar quantidade para Comprador','Massa Da Feira','Precisa guardar o físico'),
('21318','Mezzani','NF Devolução','nf_devolucao','Vendedor (Refrigerados)','Mezzani/Mestre','Precisa guardar o físico'),
('141','Nestle (Jolemi)','Elas por elas','elas_por_elas','Passar quantidade para Vendedor','Nestle resfriados','Precisa guardar o físico'),
('4839','Peixes Megg''s','NFD na entrega (até 7 dias para embalagem/qualidade)','nf_devolucao','Passar para o comprador','Peixes Megg''s','Precisa de foto / descartar'),
('12653','Queijos Itupeva','Elas por elas','elas_por_elas','Passar quantidade para Vendedor','Queijos Itupeva','Precisa guardar o físico'),
('64076','Reino Defumados','Produto por produto','produto_por_produto','Passar quantidade e foto para o Comprador','Reino Defumados','Tirar foto e descartar o produto'),
('30074','Seara Comercio De Alimentos Ltda','Bonificação 100%','bonificacao','Passar quantidade para Comprador','Troca todos os produtos','Descartar'),
('25860','Suco Prats','NFD (Apenas Vencidos)','nf_devolucao','Promotor','Prats/Santa Massa/Aqua coco/Fruitz','Precisa guardar o físico'),
('61905','Trop Brasil','NF Devolução','nf_devolucao','Enviar NF para o comprador','Verde Campo','Descartar'),
('33510','Univali','NF (350 a 500$)','nf_devolucao','Entrega / Motorista Retira','Jamava','Descartar'),
('708','Yakult','NFD (Apenas Vencidos)','nf_devolucao','Motorista Retira','Yakult','Precisa guardar o físico'),
('33910','Elma Chips','Nota de Devolução','nf_devolucao','Motorista Retira','***','Precisa guardar o físico'),
('7706','Souza Cruz','Elas por elas ou NF Devolução','mista','Motorista Retira','Cigarro','Precisa guardar o físico'),
('28126','Philip Morris *ativo*','Elas por elas ou NF Devolução','mista','Motorista Retira','Cigarro','Precisa guardar o físico'),
('4561','Bimbo','NF Devolução','nf_devolucao','Motorista Retira','Pullman/Bimbo/WickBold','Precisa guardar o físico'),
('12149','Kim Neto Industria e Comercio De Panificacao Ltda','NF Devolução','nf_devolucao','Motorista Retira','Kim','Precisa guardar o físico'),
('45446','Massabor (ativo)','NF Devolução','nf_devolucao','Motorista Retira','Massabor','Precisa guardar o físico'),
('54','Panco','NF Devolução','nf_devolucao','Motorista Retira','Panco','Precisa guardar o físico'),
('70718','São Sebastião Pães','Elas por elas','elas_por_elas','Motorista Retira','São Sebastião Pães','Precisa guardar o físico'),
('43551','Thalita Thomasini','Elas por elas','elas_por_elas','Passar quantidade para Vendedor','Bolo Classic','Precisa guardar o físico')
ON CONFLICT (fornecedor_codigo) DO UPDATE SET
  fornecedor_referencia=excluded.fornecedor_referencia,
  tratativa=excluded.tratativa,
  categoria=excluded.categoria,
  forma=excluded.forma,
  marca_produto=excluded.marca_produto,
  fisico_virtual=excluded.fisico_virtual,
  ativo=true,
  atualizado_em=now();

CREATE OR REPLACE FUNCTION public.zai_vendas_produtos_periodo(
 p_loja text,p_de date,p_ate date,p_dpto text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE result jsonb;
BEGIN
 IF p_de IS NULL OR p_ate IS NULL OR p_de>p_ate THEN
   RAISE EXCEPTION 'Periodo invalido';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM montekali.acessos
   WHERE usuario=auth.uid() AND loja_codigo=p_loja
 ) THEN
   RAISE EXCEPTION 'Usuario sem acesso a esta loja' USING ERRCODE='42501';
 END IF;

 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'sku',x.sku,
   'produto',x.produto,
   'situacao',x.situacao,
   'dpto',x.departamento_codigo,
   'quantidade',x.quantidade,
   'valor',x.valor
 ) ORDER BY x.valor DESC),'[]'::jsonb)
 INTO result
 FROM (
   SELECT v.sku,p.descricao produto,p.situacao_atual situacao,
          v.departamento_codigo,sum(v.quantidade) quantidade,sum(v.valor) valor
   FROM montekali.vendas v
   JOIN montekali.produtos p ON p.sku=v.sku
   WHERE v.loja_codigo=p_loja
     AND v.data_movimento BETWEEN p_de AND p_ate
     AND (p_dpto IS NULL OR p_dpto='' OR v.departamento_codigo=p_dpto)
   GROUP BY v.sku,p.descricao,p.situacao_atual,v.departamento_codigo
 )x;

 RETURN result;
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
   SELECT jsonb_agg(jsonb_build_array(data_movimento,departamento_codigo,valor) ORDER BY data_movimento,departamento_codigo)
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
 'trocas_fornecedores',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'fornecedor_codigo',x.fornecedor_codigo,
     'fornecedor',x.fornecedor,
     'skus',x.skus,
     'quantidade',x.quantidade,
     'valor',x.valor,
     'categoria',COALESCE(r.categoria,'sem_cadastro'),
     'tratativa',COALESCE(r.tratativa,'Sem tratativa cadastrada'),
     'forma',r.forma,
     'marca_produto',r.marca_produto,
     'fisico_virtual',r.fisico_virtual
   ) ORDER BY x.valor DESC)
   FROM (
     SELECT t.dados_origem->>'fornecedor_codigo' fornecedor_codigo,t.fornecedor,
            count(*) skus,sum(t.quantidade) quantidade,sum(t.valor) valor
     FROM montekali.trocas_posicao t
     WHERE t.loja_codigo=p_loja
     GROUP BY t.dados_origem->>'fornecedor_codigo',t.fornecedor
   )x
   LEFT JOIN montekali.trocas_regras_fornecedor r
     ON r.fornecedor_codigo=x.fornecedor_codigo AND r.ativo
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
     'fisico_virtual',r.fisico_virtual
   ) ORDER BY t.valor DESC)
   FROM montekali.trocas_posicao t
   JOIN montekali.produtos p ON p.sku=t.sku
   LEFT JOIN montekali.trocas_regras_fornecedor r
     ON r.fornecedor_codigo=t.dados_origem->>'fornecedor_codigo' AND r.ativo
   WHERE t.loja_codigo=p_loja
 ),'[]'::jsonb),
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

REVOKE ALL ON FUNCTION public.zai_vendas_produtos_periodo(text,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_vendas_produtos_periodo(text,date,date,text) TO authenticated;
REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
