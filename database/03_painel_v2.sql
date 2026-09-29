-- Executar DEPOIS da estrutura inicial e da migracao das perdas.
-- Nao apaga perdas, nao altera IndexedDB e nao concede acesso anonimo.
BEGIN;
CREATE TABLE IF NOT EXISTS montekali.acessos (
 usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 loja_codigo text NOT NULL REFERENCES montekali.lojas(codigo),
 papel text NOT NULL CHECK(papel IN ('consulta','importador')), PRIMARY KEY(usuario,loja_codigo));
CREATE TABLE IF NOT EXISTS montekali.configuracao_painel (
 loja_codigo text PRIMARY KEY REFERENCES montekali.lojas, configuracao jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS montekali.vendas_mensais (
 loja_codigo text NOT NULL REFERENCES montekali.lojas,
 competencia date NOT NULL CHECK(extract(day FROM competencia)=1),
 sku text NOT NULL REFERENCES montekali.produtos, departamento_codigo text NOT NULL REFERENCES montekali.departamentos,
 quantidade numeric NOT NULL, valor numeric NOT NULL,
 PRIMARY KEY(loja_codigo,competencia,sku,departamento_codigo));
CREATE TABLE IF NOT EXISTS montekali.cobertura_vendas (
 loja_codigo text NOT NULL REFERENCES montekali.lojas,data_movimento date NOT NULL,
 PRIMARY KEY(loja_codigo,data_movimento));
CREATE TABLE IF NOT EXISTS montekali.revisoes (
 loja_codigo text PRIMARY KEY REFERENCES montekali.lojas, versao bigint NOT NULL DEFAULT 0);
INSERT INTO montekali.revisoes VALUES ('007',0) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS montekali.auditoria_substituicoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 lote_id bigint NOT NULL REFERENCES montekali.lotes_importacao,
 usuario uuid NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
 dados_anteriores jsonb NOT NULL);
ALTER TABLE montekali.acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.configuracao_painel ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.vendas_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.cobertura_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE montekali.auditoria_substituicoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA montekali FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA montekali FROM PUBLIC, anon, authenticated;

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
 'vendas_diarias',COALESCE((SELECT jsonb_agg(jsonb_build_array(data_movimento,sku,departamento_codigo,quantidade,valor)) FROM montekali.vendas WHERE loja_codigo=p_loja),'[]'::jsonb),
 'dias_vendas_completos',COALESCE((SELECT jsonb_agg(data_movimento ORDER BY data_movimento) FROM montekali.cobertura_vendas WHERE loja_codigo=p_loja),'[]'::jsonb),
 'historico',COALESCE((SELECT jsonb_agg(t) FROM (SELECT arquivo_nome AS file, importado_em AS "when",registros AS rows,valor_total AS value,tipo FROM montekali.lotes_importacao WHERE loja_codigo=p_loja ORDER BY id DESC LIMIT 40)t),'[]'::jsonb),
 'aviso',COALESCE(c.configuracao->>'aviso','Carga historica de vendas ainda pendente.')) INTO result
 FROM (SELECT 1) a LEFT JOIN montekali.configuracao_painel c ON c.loja_codigo=p_loja;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.zai_importar_perdas(
 p_loja text,p_revision bigint,p_hash text,p_arquivo text,p_modo text,p_linhas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rev bigint; v_lote bigint; v_total numeric; v_datas date[]; v_antigos jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM montekali.acessos WHERE usuario=auth.uid() AND loja_codigo=p_loja AND papel='importador') THEN
  RAISE EXCEPTION 'Permissao de importacao necessaria' USING ERRCODE='42501'; END IF;
 SELECT versao INTO v_rev FROM montekali.revisoes WHERE loja_codigo=p_loja FOR UPDATE;
 IF v_rev IS NULL OR p_revision IS DISTINCT FROM v_rev THEN RAISE EXCEPTION 'Base mudou. Atualize o painel e confira novamente a previa.'; END IF;
 IF p_hash !~ '^[0-9a-f]{64}$' OR p_arquivo IS NULL OR length(p_arquivo)>300 THEN RAISE EXCEPTION 'Identificacao do arquivo invalida'; END IF;
 IF EXISTS(SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=p_hash) THEN RAISE EXCEPTION 'Este arquivo ja foi importado'; END IF;
 IF p_modo NOT IN ('complementar','substituir_dias') OR p_modo IS NULL THEN RAISE EXCEPTION 'Modo invalido'; END IF;
 IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Linhas invalidas'; END IF;
 IF jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Lote deve ter 1 a 100000 linhas'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_linhas) x WHERE
  NOT (x ?& ARRAY['data','sku','dpto','produto','motivo','qtde','valor']) OR
  jsonb_typeof(x->'qtde') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'valor') IS DISTINCT FROM 'number' OR
  COALESCE(x->>'sku','') !~ '^[0-9]+$' OR COALESCE(x->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' OR
  COALESCE(trim(x->>'produto'),'')='' OR COALESCE(trim(x->>'motivo'),'')='' OR
  NOT EXISTS(SELECT 1 FROM montekali.departamentos d WHERE d.codigo=x->>'dpto')) THEN RAISE EXCEPTION 'Linha invalida ou departamento sem cadastro. Nenhuma linha salva.'; END IF;
 SELECT array_agg(DISTINCT (x->>'data')::date),sum((x->>'valor')::numeric) INTO v_datas,v_total FROM jsonb_array_elements(p_linhas)x;
 IF p_modo='complementar' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_linhas)x JOIN montekali.perdas p ON p.loja_codigo=p_loja AND p.data_movimento=(x->>'data')::date AND p.sku=x->>'sku' AND p.motivo=x->>'motivo' AND p.quantidade=(x->>'qtde')::numeric) THEN
  RAISE EXCEPTION 'Complemento tem possiveis ocorrencias ja existentes. Revise; nenhuma linha foi importada.'; END IF;
 INSERT INTO montekali.lotes_importacao(loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total)
 VALUES(p_loja,'perdas_'||p_modo,p_hash,p_arquivo,jsonb_build_object('usuario',auth.uid(),'revisao',v_rev),jsonb_array_length(p_linhas),v_total) RETURNING id INTO v_lote;
 IF p_modo='substituir_dias' THEN
  SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO v_antigos FROM montekali.perdas p WHERE loja_codigo=p_loja AND data_movimento=ANY(v_datas);
  INSERT INTO montekali.auditoria_substituicoes(lote_id,usuario,dados_anteriores) VALUES(v_lote,auth.uid(),v_antigos);
  DELETE FROM montekali.perdas WHERE loja_codigo=p_loja AND data_movimento=ANY(v_datas);
 END IF;
 INSERT INTO montekali.produtos(sku,descricao)
 SELECT DISTINCT ON (x->>'sku') x->>'sku',x->>'produto' FROM jsonb_array_elements(p_linhas)x ON CONFLICT DO NOTHING;
 INSERT INTO montekali.perdas(lote_id,linha_origem,loja_codigo,data_movimento,sku,departamento_codigo,motivo,quantidade,valor)
 SELECT v_lote,n::integer,p_loja,(x->>'data')::date,x->>'sku',x->>'dpto',x->>'motivo',(x->>'qtde')::numeric,(x->>'valor')::numeric FROM jsonb_array_elements(p_linhas) WITH ORDINALITY t(x,n);
 UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo=p_loja;
 RETURN jsonb_build_object('lote',v_lote,'registros',jsonb_array_length(p_linhas),'valor',v_total,'revision',v_rev+1);
END $$;
REVOKE ALL ON FUNCTION public.zai_snapshot(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zai_importar_perdas(text,bigint,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zai_snapshot(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zai_importar_perdas(text,bigint,text,text,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
