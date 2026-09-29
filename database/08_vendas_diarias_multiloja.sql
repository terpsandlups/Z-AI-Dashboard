BEGIN;
CREATE TABLE IF NOT EXISTS montekali.vendas_resumo_dia (
 loja_codigo text REFERENCES montekali.lojas, data_movimento date,departamento_codigo text REFERENCES montekali.departamentos,valor numeric NOT NULL,
 PRIMARY KEY(loja_codigo,data_movimento,departamento_codigo));
CREATE TABLE IF NOT EXISTS montekali.vendas_resumo_produto_mes (
 loja_codigo text REFERENCES montekali.lojas,competencia date,sku text REFERENCES montekali.produtos,departamento_codigo text REFERENCES montekali.departamentos,quantidade numeric NOT NULL,valor numeric NOT NULL,
 PRIMARY KEY(loja_codigo,competencia,sku,departamento_codigo));
ALTER TABLE montekali.vendas_resumo_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.vendas_resumo_produto_mes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON montekali.vendas_resumo_dia,montekali.vendas_resumo_produto_mes FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS vendas_loja_data ON montekali.vendas(loja_codigo,data_movimento);

CREATE OR REPLACE FUNCTION montekali.atualizar_resumos(p_loja text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 DELETE FROM montekali.vendas_resumo_dia WHERE loja_codigo=p_loja;
 INSERT INTO montekali.vendas_resumo_dia
 SELECT v.loja_codigo,v.data_movimento,v.departamento_codigo,sum(v.valor)
 FROM montekali.vendas v JOIN montekali.cobertura_vendas c USING(loja_codigo,data_movimento)
 WHERE v.loja_codigo=p_loja GROUP BY 1,2,3;
 DELETE FROM montekali.vendas_resumo_produto_mes WHERE loja_codigo=p_loja;
 INSERT INTO montekali.vendas_resumo_produto_mes
 SELECT v.loja_codigo,date_trunc('month',v.data_movimento)::date,v.sku,v.departamento_codigo,sum(v.quantidade),sum(v.valor)
 FROM montekali.vendas v JOIN montekali.cobertura_vendas c USING(loja_codigo,data_movimento)
 WHERE v.loja_codigo=p_loja GROUP BY 1,2,3,4;
END $$;
REVOKE ALL ON FUNCTION montekali.atualizar_resumos(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.zai_lojas() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('codigo',l.codigo,'nome',l.nome) ORDER BY l.codigo),'[]'::jsonb)
 FROM montekali.lojas l JOIN montekali.acessos a ON a.loja_codigo=l.codigo WHERE a.usuario=auth.uid()
$$;
REVOKE ALL ON FUNCTION public.zai_lojas() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_lojas() TO authenticated;

CREATE OR REPLACE FUNCTION public.zai_importar_vendas(p_loja text,p_revision bigint,p_hash text,p_arquivo text,p_linhas jsonb,p_datas date[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rev bigint;v_lote bigint;v_total numeric;v_antigos jsonb;v_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM montekali.acessos WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador') THEN RAISE EXCEPTION 'Sem permissao para importar nesta loja' USING ERRCODE='42501'; END IF;
 SELECT versao INTO v_rev FROM montekali.revisoes WHERE loja_codigo=p_loja FOR UPDATE;
 IF v_rev IS NULL OR v_rev IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Base mudou: atualize e revise a previa'; END IF;
 IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR coalesce(length(p_arquivo),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Identificacao invalida'; END IF;
 IF EXISTS(SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=p_hash) THEN RAISE EXCEPTION 'Arquivo ja importado'; END IF;
 IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array' OR p_datas IS NULL OR cardinality(p_datas)=0 OR array_position(p_datas,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Linhas ou cobertura invalidas'; END IF;
 IF jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Lote deve ter entre 1 e 100000 linhas'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_linhas)x WHERE NOT(x ?& ARRAY['data','sku','produto','dpto','qtde','valor']) OR jsonb_typeof(x->'qtde') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'valor') IS DISTINCT FROM 'number' OR coalesce(x->>'sku','') !~ '^[0-9]+$' OR coalesce(x->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(trim(x->>'produto'),'')='' OR NOT EXISTS(SELECT 1 FROM montekali.departamentos d WHERE d.codigo=x->>'dpto')) THEN RAISE EXCEPTION 'Linha invalida ou departamento nao cadastrado'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_linhas)x WHERE NOT((x->>'data')::date=ANY(p_datas))) THEN RAISE EXCEPTION 'Data fora da cobertura confirmada'; END IF;
 SELECT sum((x->>'valor')::numeric) INTO v_total FROM jsonb_array_elements(p_linhas)x;
 SELECT coalesce(jsonb_agg(v),'[]'::jsonb) INTO v_antigos FROM montekali.vendas v WHERE loja_codigo=p_loja AND data_movimento=ANY(p_datas);
 INSERT INTO montekali.lotes_importacao(loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total)
 VALUES(p_loja,'vendas_diarias_web',p_hash,p_arquivo,jsonb_build_object('usuario',auth.uid(),'dias_completos',p_datas,'vendas_anteriores',v_antigos),jsonb_array_length(p_linhas),v_total) RETURNING id INTO v_lote;
 INSERT INTO montekali.produtos(sku,descricao) SELECT DISTINCT ON(x->>'sku') x->>'sku',x->>'produto' FROM jsonb_array_elements(p_linhas)x ON CONFLICT DO NOTHING;
 DELETE FROM montekali.vendas WHERE loja_codigo=p_loja AND data_movimento=ANY(p_datas);
 INSERT INTO montekali.vendas(lote_id,loja_codigo,data_movimento,sku,departamento_codigo,quantidade,valor)
 SELECT v_lote,p_loja,(x->>'data')::date,x->>'sku',x->>'dpto',sum((x->>'qtde')::numeric),sum((x->>'valor')::numeric) FROM jsonb_array_elements(p_linhas)x GROUP BY 3,4,5;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 INSERT INTO montekali.cobertura_vendas SELECT p_loja,d FROM unnest(p_datas)d ON CONFLICT DO NOTHING;
 PERFORM montekali.atualizar_resumos(p_loja);
 UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;
 RETURN jsonb_build_object('lote',v_lote,'registros',v_count,'valor',v_total);
END $$;
REVOKE ALL ON FUNCTION public.zai_importar_vendas(text,bigint,text,text,jsonb,date[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_importar_vendas(text,bigint,text,text,jsonb,date[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.zai_snapshot(p_loja text DEFAULT '007')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM montekali.acessos WHERE usuario=auth.uid() AND loja_codigo=p_loja) THEN
  RAISE EXCEPTION 'Usuario sem acesso a esta loja' USING ERRCODE='42501';
 END IF;
 -- Uma consulta garante uma mesma fotografia transacional para dados e revisao.
 SELECT jsonb_build_object(
 'schema','zai-007-v2','loja',p_loja,'nome',(SELECT nome FROM montekali.lojas WHERE codigo=p_loja),
 'papel',(SELECT papel FROM montekali.acessos WHERE usuario=auth.uid() AND loja_codigo=p_loja),
 'revision',(SELECT versao FROM montekali.revisoes WHERE loja_codigo=p_loja),
 'baseline',c.configuracao->'baseline','metas',COALESCE(c.configuracao->'metas','[]'::jsonb),
 'departamentos',(SELECT jsonb_object_agg(codigo,descricao) FROM montekali.departamentos),
 'produtos',(SELECT jsonb_object_agg(sku,jsonb_build_array(descricao,situacao_atual)) FROM montekali.produtos),
 'perdas',COALESCE((SELECT jsonb_agg(jsonb_build_array(data_movimento,sku,departamento_codigo,motivo,quantidade,valor) ORDER BY id) FROM montekali.perdas WHERE loja_codigo=p_loja),'[]'::jsonb),
 'vendas_mensais',COALESCE((SELECT jsonb_agg(jsonb_build_array(to_char(competencia,'YYYY-MM'),sku,departamento_codigo,quantidade,valor)) FROM montekali.vendas_mensais WHERE loja_codigo=p_loja),'[]'::jsonb),
 'vendas_diarias','[]'::jsonb,
 'vendas_diarias_resumo',COALESCE((SELECT jsonb_agg(jsonb_build_array(data_movimento,departamento_codigo,valor)) FROM montekali.vendas_resumo_dia WHERE loja_codigo=p_loja),'[]'::jsonb),
 'vendas_diarias_produto_mes',COALESCE((SELECT jsonb_agg(jsonb_build_array(to_char(competencia,'YYYY-MM'),sku,departamento_codigo,quantidade,valor)) FROM montekali.vendas_resumo_produto_mes WHERE loja_codigo=p_loja),'[]'::jsonb),
 'dias_vendas_completos',COALESCE((SELECT jsonb_agg(data_movimento ORDER BY data_movimento) FROM montekali.cobertura_vendas WHERE loja_codigo=p_loja),'[]'::jsonb),
 'historico',COALESCE((SELECT jsonb_agg(t) FROM (SELECT arquivo_nome AS file, importado_em AS "when",registros AS rows,valor_total AS value,tipo FROM montekali.lotes_importacao WHERE loja_codigo=p_loja ORDER BY id DESC LIMIT 40)t),'[]'::jsonb),
 'aviso',COALESCE(c.configuracao->>'aviso','Carga historica de vendas ainda pendente.')) INTO result
 FROM (SELECT 1) a LEFT JOIN montekali.configuracao_painel c ON c.loja_codigo=p_loja;
 RETURN result;
END $$;


REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
