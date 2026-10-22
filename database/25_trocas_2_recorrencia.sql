BEGIN;

-- Trocas 2.0: o acompanhamento é independente do snapshot do estoque.
-- Cada fornecedor pode ter uma ficha de tratativa por loja. Nenhuma importação a substitui.
CREATE TABLE IF NOT EXISTS montekali.trocas_acompanhamentos(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
 fornecedor_codigo text NOT NULL,
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','em_contato','aguardando_retorno','concluida','cancelada')),
 responsavel text NOT NULL DEFAULT '',
 prazo date,
 proxima_acao text NOT NULL DEFAULT '',
 observacao text NOT NULL DEFAULT '',
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 criado_em timestamptz NOT NULL DEFAULT now(),
 usuario_atualizacao uuid,
 versao bigint NOT NULL DEFAULT 1,
 CONSTRAINT trocas_acompanhamentos_loja_fornecedor_uq UNIQUE(loja_codigo,fornecedor_codigo),
 CONSTRAINT trocas_acompanhamentos_codigo_chk CHECK(length(trim(fornecedor_codigo)) BETWEEN 1 AND 80),
 CONSTRAINT trocas_acompanhamentos_responsavel_chk CHECK(length(responsavel)<=120),
 CONSTRAINT trocas_acompanhamentos_acao_chk CHECK(length(proxima_acao)<=700),
 CONSTRAINT trocas_acompanhamentos_obs_chk CHECK(length(observacao)<=2000)
);
CREATE INDEX IF NOT EXISTS trocas_acompanhamentos_loja_status_prazo
 ON montekali.trocas_acompanhamentos(loja_codigo,status,prazo);
CREATE TABLE IF NOT EXISTS montekali.trocas_acompanhamentos_eventos(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 acompanhamento_id bigint NOT NULL REFERENCES montekali.trocas_acompanhamentos(id) ON DELETE RESTRICT,
 loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
 usuario uuid,
 criado_em timestamptz NOT NULL DEFAULT now(),
 anterior jsonb,
 atual jsonb NOT NULL,
 motivo text NOT NULL
);
CREATE INDEX IF NOT EXISTS trocas_acomp_eventos_fk ON montekali.trocas_acompanhamentos_eventos(acompanhamento_id,criado_em DESC);
ALTER TABLE montekali.trocas_acompanhamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.trocas_acompanhamentos_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.trocas_acompanhamentos, montekali.trocas_acompanhamentos_eventos FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.zai_trocas_acompanhamentos(p_loja text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM montekali.acessos
 WHERE usuario=auth.uid() AND loja_codigo=p_loja) THEN
  RAISE EXCEPTION 'Sem acesso a loja solicitada' USING ERRCODE='42501';
 END IF;
 RETURN COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
   'id',id,'fornecedor_codigo',fornecedor_codigo,'status',status,'responsavel',responsavel,
   'prazo',prazo,'proxima_acao',proxima_acao,'observacao',observacao,
   'atualizado_em',atualizado_em,'criado_em',criado_em,'versao',versao
   ) ORDER BY
    CASE WHEN status IN ('concluida','cancelada') THEN 1 ELSE 0 END,
    prazo ASC NULLS LAST, atualizado_em DESC)
  FROM montekali.trocas_acompanhamentos WHERE loja_codigo=p_loja
 ),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.zai_trocas_salvar_acompanhamento(
 p_loja text,p_fornecedor text,p_status text,p_responsavel text,
 p_prazo date,p_proxima_acao text,p_observacao text,p_motivo text,
 p_versao bigint DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v montekali.trocas_acompanhamentos%ROWTYPE;
 v_old jsonb; v_new jsonb; v_exists boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM montekali.acessos
 WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador') THEN
  RAISE EXCEPTION 'Somente perfil importador pode alterar tratativas' USING ERRCODE='42501';
 END IF;
 IF p_fornecedor IS NULL OR length(trim(p_fornecedor)) NOT BETWEEN 1 AND 80
 OR NOT EXISTS(
   SELECT 1 FROM montekali.trocas_regras_fornecedor
      WHERE fornecedor_codigo=trim(p_fornecedor)
 ) AND NOT EXISTS(
   SELECT 1 FROM montekali.trocas_posicao
   WHERE loja_codigo=p_loja AND (dados_origem->>'cod_ultim_forn'=trim(p_fornecedor)
    OR dados_origem->>'fornecedor_codigo'=trim(p_fornecedor))
 )
 THEN RAISE EXCEPTION 'Fornecedor nao identificado no cadastro/posicao'; END IF;
 IF p_status NOT IN ('pendente','em_contato','aguardando_retorno','concluida','cancelada')
 THEN RAISE EXCEPTION 'Situacao da tratativa invalida'; END IF;
 IF length(trim(COALESCE(p_motivo,'')))<8 THEN
  RAISE EXCEPTION 'Descreva a atualizacao em pelo menos 8 caracteres'; END IF;
 IF length(COALESCE(p_responsavel,''))>120
 OR length(COALESCE(p_proxima_acao,''))>700
 OR length(COALESCE(p_observacao,''))>2000
 THEN RAISE EXCEPTION 'Descricao excede o limite de caracteres'; END IF;
 -- Exige motivo explícito para encerramento com saldo; não infere baixa de estoque.
 IF p_status IN ('concluida','cancelada') AND length(trim(COALESCE(p_observacao,'')))<10 THEN
  RAISE EXCEPTION 'Informe na observacao a justificativa do encerramento'; END IF;

 SELECT * INTO v FROM montekali.trocas_acompanhamentos
 WHERE loja_codigo=p_loja AND fornecedor_codigo=trim(p_fornecedor) FOR UPDATE;
 v_exists=FOUND;
 IF v_exists AND v.versao IS DISTINCT FROM p_versao THEN
  RAISE EXCEPTION 'A tratativa foi atualizada por outra pessoa. Recarregue antes de salvar.';
 END IF;
 IF NOT v_exists AND p_versao<>0 THEN
  RAISE EXCEPTION 'Ficha de tratativa nao existe ou foi alterada.';
 END IF;
 IF v_exists THEN
  v_old=to_jsonb(v);
  UPDATE montekali.trocas_acompanhamentos SET
   status=p_status,responsavel=trim(coalesce(p_responsavel,'')),prazo=p_prazo,
   proxima_acao=trim(coalesce(p_proxima_acao,'')),observacao=trim(coalesce(p_observacao,'')),
   usuario_atualizacao=auth.uid(),atualizado_em=now(),versao=versao+1
  WHERE id=v.id RETURNING * INTO v;
 ELSE
  v_old=NULL;
  INSERT INTO montekali.trocas_acompanhamentos
   (loja_codigo,fornecedor_codigo,status,responsavel,prazo,proxima_acao,observacao,usuario_atualizacao)
  VALUES(p_loja,trim(p_fornecedor),p_status,trim(coalesce(p_responsavel,'')),p_prazo,
    trim(coalesce(p_proxima_acao,'')),trim(coalesce(p_observacao,'')),auth.uid())
  RETURNING * INTO v;
 END IF;
 v_new=to_jsonb(v);
 INSERT INTO montekali.trocas_acompanhamentos_eventos(acompanhamento_id,loja_codigo,usuario,anterior,atual,motivo)
 VALUES(v.id,p_loja,auth.uid(),v_old,v_new,trim(p_motivo));
 RETURN jsonb_build_object('id',v.id,'versao',v.versao,'status',v.status,'salvo',true);
END $$;

CREATE OR REPLACE FUNCTION public.zai_trocas_historico(p_loja text,p_fornecedor text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM montekali.acessos
 WHERE usuario=auth.uid() AND loja_codigo=p_loja) THEN
  RAISE EXCEPTION 'Sem acesso a loja solicitada' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((
  SELECT jsonb_agg(jsonb_build_object('data',e.criado_em,'usuario',e.usuario,'motivo',e.motivo,
    'anterior',e.anterior,'atual',e.atual) ORDER BY e.criado_em DESC)
  FROM (SELECT ev.* FROM montekali.trocas_acompanhamentos_eventos ev
   JOIN montekali.trocas_acompanhamentos t ON t.id=ev.acompanhamento_id
   WHERE t.loja_codigo=p_loja AND t.fornecedor_codigo=p_fornecedor
   ORDER BY ev.criado_em DESC LIMIT 40) e
 ),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.zai_perdas_recorrencia(
 p_loja text,p_de date,p_ate date,p_dpto text DEFAULT NULL,
 p_min_dias integer DEFAULT 3,p_limite_lancamento numeric DEFAULT NULL,
 p_order text DEFAULT 'impacto',p_limit integer DEFAULT 100
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb; total numeric; qtd integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM montekali.acessos
 WHERE usuario=auth.uid() AND loja_codigo=p_loja) THEN
  RAISE EXCEPTION 'Sem acesso a loja solicitada' USING ERRCODE='42501'; END IF;
 IF p_de IS NULL OR p_ate IS NULL OR p_de>p_ate OR p_ate-p_de>365 THEN
  RAISE EXCEPTION 'Periodo invalido (maximo de 366 dias)'; END IF;
 IF p_min_dias NOT BETWEEN 2 AND 31 OR p_limit NOT BETWEEN 1 AND 300 OR p_order NOT IN ('impacto','frequencia') THEN
  RAISE EXCEPTION 'Parametros invalidos'; END IF;
 IF p_limite_lancamento IS NOT NULL AND p_limite_lancamento<=0 THEN
  RAISE EXCEPTION 'Limite por lancamento deve ser positivo'; END IF;
 SELECT COALESCE(SUM(valor),0),COUNT(*) INTO total,qtd FROM montekali.perdas
 WHERE loja_codigo=p_loja AND data_movimento BETWEEN p_de AND p_ate
 AND (p_dpto IS NULL OR departamento_codigo=p_dpto);
 WITH p AS (
  SELECT sku,departamento_codigo,
    COUNT(*) AS ocorrencias,COUNT(DISTINCT data_movimento) AS dias_distintos,
    COALESCE(SUM(valor),0) AS perda_total,
    AVG(valor) AS media_lancamento,
    MAX(valor) AS maior_lancamento,
    MIN(data_movimento) AS primeira,MAX(data_movimento) AS ultima
  FROM montekali.perdas
  WHERE loja_codigo=p_loja AND data_movimento BETWEEN p_de AND p_ate
    AND (p_dpto IS NULL OR departamento_codigo=p_dpto)
  GROUP BY sku,departamento_codigo
 ), group_rows AS (
  SELECT p.*,prod.descricao AS produto,dp.descricao AS departamento
  FROM p LEFT JOIN montekali.produtos prod ON prod.sku=p.sku
   LEFT JOIN montekali.departamentos dp ON dp.codigo=p.departamento_codigo
  WHERE p.dias_distintos>=p_min_dias
   AND (p_limite_lancamento IS NULL OR p.maior_lancamento<=p_limite_lancamento)
 ), ordered AS (
  SELECT * FROM group_rows ORDER BY
    CASE WHEN p_order='impacto' THEN perda_total END DESC NULLS LAST,
    CASE WHEN p_order='frequencia' THEN dias_distintos END DESC NULLS LAST,
    perda_total DESC,sku LIMIT p_limit
 )
 SELECT jsonb_build_object(
  'linhas',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'sku',sku,'dpto',departamento_codigo,'produto',produto,'departamento',departamento,
   'ocorrencias',ocorrencias,'dias',dias_distintos,'total',perda_total,
   'media_lancamento',round(media_lancamento,2),'maior_lancamento',maior_lancamento,
   'primeira',primeira,'ultima',ultima,
   'media_dia_com_perda',round(perda_total/nullif(dias_distintos,0),2)
  )) FROM ordered),'[]'::jsonb),
  'resumo',jsonb_build_object(
   'perdas_periodo',total,'lancamentos_periodo',qtd,
   'produtos_recorrentes',(SELECT COUNT(*) FROM group_rows),
   'perda_recorrente',(SELECT COALESCE(SUM(perda_total),0) FROM group_rows),
   'dias_periodo',p_ate-p_de+1,
   'criterio',jsonb_build_object('min_dias',p_min_dias,'limite_lancamento',p_limite_lancamento))
 ) INTO v;
 RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.zai_trocas_acompanhamentos(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zai_trocas_salvar_acompanhamento(text,text,text,text,date,text,text,text,bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zai_trocas_historico(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zai_perdas_recorrencia(text,date,date,text,integer,numeric,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_trocas_acompanhamentos(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zai_trocas_salvar_acompanhamento(text,text,text,text,date,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zai_trocas_historico(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zai_perdas_recorrencia(text,date,date,text,integer,numeric,text,integer) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;