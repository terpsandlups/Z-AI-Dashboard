BEGIN;

-- Operações de reversão acessíveis apenas a usuários autorizados da loja.
-- O lote permanece no histórico, marcado como desfeito: jamais apagamos a evidência.
CREATE OR REPLACE FUNCTION public.zai_historico_importacoes(p_loja text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_importador boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM montekali.acessos WHERE usuario=auth.uid() AND loja_codigo=p_loja
 ) THEN RAISE EXCEPTION 'Acesso nao autorizado a esta loja' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM montekali.acessos WHERE usuario=auth.uid()
    AND loja_codigo=p_loja AND papel='importador') INTO v_importador;
 RETURN COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
   'id',l.id,'file',l.arquivo_nome,'when',l.importado_em,
   'rows',l.registros,'value',l.valor_total,'tipo',l.tipo,
   'desfeito',l.historico_origem ? 'desfeito',
   'cancelamento',l.historico_origem->'desfeito',
   'pode_desfazer',v_importador AND NOT (l.historico_origem ? 'desfeito')
      AND (
       (l.tipo='vendas_diarias_web' AND
         (SELECT COUNT(*) FROM montekali.vendas v WHERE v.loja_codigo=p_loja AND v.lote_id=l.id)=l.registros)
       OR (l.tipo='perdas_complementar' AND
         (SELECT COUNT(*) FROM montekali.perdas p WHERE p.loja_codigo=p_loja AND p.lote_id=l.id)=l.registros)
       OR (l.tipo='auditoria_estoque_incremental' AND
         (SELECT COUNT(*) FROM montekali.auditorias_estoque a WHERE a.loja_codigo=p_loja AND a.lote_id=l.id)=l.registros)
      )
  ) ORDER BY l.id DESC)
  FROM (SELECT * FROM montekali.lotes_importacao WHERE loja_codigo=p_loja
        ORDER BY id DESC LIMIT 70) l
 ),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.zai_desfazer_importacao(
 p_loja text,p_lote bigint,p_revision bigint,p_confirmacao text,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_lote montekali.lotes_importacao%ROWTYPE;
 v_rev bigint;
 v_n integer; v_total numeric; v_esperado integer;
 v_datas date[]; v_meses date[];
 v_restaurados integer:=0;
 v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM montekali.acessos
  WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador'
 ) THEN RAISE EXCEPTION 'Somente importador autorizado pode desfazer importacoes' USING ERRCODE='42501'; END IF;
 IF p_confirmacao IS DISTINCT FROM 'DESFAZER' OR length(trim(coalesce(p_motivo,'')))<10
 THEN RAISE EXCEPTION 'Confirme DESFAZER e informe justificativa de pelo menos 10 caracteres'; END IF;
 SELECT versao INTO v_rev FROM montekali.revisoes WHERE loja_codigo=p_loja FOR UPDATE;
 IF v_rev IS NULL OR p_revision IS DISTINCT FROM v_rev
 THEN RAISE EXCEPTION 'Base atualizada por outra operacao. Atualize o painel antes de desfazer.'; END IF;
 SELECT * INTO v_lote FROM montekali.lotes_importacao
 WHERE id=p_lote AND loja_codigo=p_loja FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote nao encontrado nesta loja'; END IF;
 IF v_lote.historico_origem ? 'desfeito' THEN RAISE EXCEPTION 'Este lote ja foi desfeito'; END IF;

 IF v_lote.tipo='vendas_diarias_web' THEN
  SELECT array_agg(s::date ORDER BY s::date) INTO v_datas
  FROM jsonb_array_elements_text(COALESCE(v_lote.historico_origem->'dias_completos','[]'::jsonb)) t(s);
  IF v_datas IS NULL OR array_length(v_datas,1)=0
    OR (SELECT count(DISTINCT d) FROM unnest(v_datas) d)<>cardinality(v_datas)
  THEN RAISE EXCEPTION 'Lote sem cobertura diaria valida para reversao'; END IF;

  SELECT COUNT(*),COALESCE(SUM(valor),0) INTO v_n,v_total
  FROM montekali.vendas WHERE loja_codigo=p_loja AND lote_id=p_lote;
  IF v_n<>v_lote.registros OR v_total IS DISTINCT FROM v_lote.valor_total
  THEN RAISE EXCEPTION 'O lote foi alterado ou substituido. Reversao bloqueada para preservar vendas posteriores.'; END IF;
  IF EXISTS (
   SELECT 1 FROM montekali.vendas
   WHERE loja_codigo=p_loja AND data_movimento=ANY(v_datas) AND lote_id<>p_lote
  ) OR EXISTS (
   SELECT 1 FROM montekali.vendas WHERE loja_codigo=p_loja AND lote_id=p_lote
    AND data_movimento<>ALL(v_datas)
  ) THEN RAISE EXCEPTION 'Periodo contem outros lotes ou datas divergentes. Reversao manual necessaria.'; END IF;

  IF jsonb_typeof(COALESCE(v_lote.historico_origem->'vendas_anteriores','[]'::jsonb))<>'array'
  THEN RAISE EXCEPTION 'Backup de vendas anterior invalido'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_lote.historico_origem->'vendas_anteriores','[]'::jsonb)) j
    WHERE COALESCE(j->>'loja_codigo','')<>p_loja
       OR (j->>'data_movimento')::date<>ALL(v_datas)
       OR EXISTS(SELECT 1 FROM montekali.vendas v WHERE v.id=(j->>'id')::bigint)
  ) THEN RAISE EXCEPTION 'Backup original nao pode ser restaurado com seguranca'; END IF;

  DELETE FROM montekali.vendas WHERE loja_codigo=p_loja AND lote_id=p_lote;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  IF v_n<>v_lote.registros THEN RAISE EXCEPTION 'Falha ao excluir todas as linhas do lote'; END IF;

  INSERT INTO montekali.vendas
   (id,lote_id,loja_codigo,data_movimento,sku,departamento_codigo,quantidade,valor)
  OVERRIDING SYSTEM VALUE
  SELECT b.id,b.lote_id,b.loja_codigo,b.data_movimento,b.sku,b.departamento_codigo,b.quantidade,b.valor
  FROM jsonb_to_recordset(COALESCE(v_lote.historico_origem->'vendas_anteriores','[]'::jsonb))
   AS b(id bigint,lote_id bigint,loja_codigo text,data_movimento date,sku text,
   departamento_codigo text,quantidade numeric,valor numeric);
  GET DIAGNOSTICS v_restaurados=ROW_COUNT;

  DELETE FROM montekali.cobertura_vendas c
    WHERE c.loja_codigo=p_loja AND c.data_movimento=ANY(v_datas)
      AND NOT EXISTS (SELECT 1 FROM montekali.vendas v
        WHERE v.loja_codigo=c.loja_codigo AND v.data_movimento=c.data_movimento);
  DELETE FROM montekali.vendas_resumo_dia
    WHERE loja_codigo=p_loja AND data_movimento=ANY(v_datas);
  SELECT array_agg(DISTINCT date_trunc('month',d)::date) INTO v_meses
    FROM unnest(v_datas) d;
  DELETE FROM montekali.vendas_resumo_produto_mes r
    WHERE r.loja_codigo=p_loja AND r.competencia=ANY(v_meses)
      AND NOT EXISTS(SELECT 1 FROM montekali.vendas v
         WHERE v.loja_codigo=p_loja AND date_trunc('month',v.data_movimento)::date=r.competencia);
  PERFORM montekali.atualizar_resumos(p_loja);
  v_status:='Vendas revertidas e backup anterior restaurado';
 ELSIF v_lote.tipo='perdas_complementar' THEN
  SELECT COUNT(*),COALESCE(SUM(valor),0) INTO v_n,v_total
  FROM montekali.perdas WHERE loja_codigo=p_loja AND lote_id=p_lote;
  IF v_n<>v_lote.registros OR v_total IS DISTINCT FROM v_lote.valor_total
  THEN RAISE EXCEPTION 'Lancamentos do lote de perdas foram alterados; operacao bloqueada'; END IF;
  DELETE FROM montekali.perdas WHERE loja_codigo=p_loja AND lote_id=p_lote;
  v_status:='Perdas complementares excluidas';
 ELSIF v_lote.tipo='auditoria_estoque_incremental' THEN
  SELECT COUNT(*),COALESCE(SUM(valor),0) INTO v_n,v_total
  FROM montekali.auditorias_estoque WHERE loja_codigo=p_loja AND lote_id=p_lote;
  IF v_n<>v_lote.registros OR v_total IS DISTINCT FROM v_lote.valor_total
  THEN RAISE EXCEPTION 'Movimentos de auditoria mudaram; operacao bloqueada'; END IF;
  DELETE FROM montekali.auditorias_estoque WHERE loja_codigo=p_loja AND lote_id=p_lote;
  v_status:='Movimentos incrementais de auditoria excluidos';
 ELSE
  RAISE EXCEPTION 'Tipo de importacao nao possui reversao automatica segura. Solicite revisao do historico.';
 END IF;

 UPDATE montekali.lotes_importacao SET historico_origem=COALESCE(historico_origem,'{}'::jsonb)
    || jsonb_build_object('desfeito',jsonb_build_object(
       'em',now(),'usuario',auth.uid(),'motivo',trim(p_motivo),
       'restaurados',v_restaurados,'revisao_origem',v_rev))
 WHERE id=p_lote AND loja_codigo=p_loja;
 UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;
 RETURN jsonb_build_object('lote',p_lote,'tipo',v_lote.tipo,
   'excluidos',v_lote.registros,'restaurados',v_restaurados,'mensagem',v_status);
END $$;

REVOKE ALL ON FUNCTION public.zai_historico_importacoes(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zai_desfazer_importacao(text,bigint,bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_historico_importacoes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zai_desfazer_importacao(text,bigint,bigint,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;