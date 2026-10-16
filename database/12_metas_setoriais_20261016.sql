-- Metas oficiais informadas em 16/10/2026 (fontes: imagens de perdas e participação)
-- Valores são frações: 0.03=3%. Participação oficial soma 100,10% conforme planilha.
-- NÃO normalizar, não mexer em participação histórica e nem descartar departamentos sem meta.
BEGIN;
WITH valores(codigo, meta_perda, meta_participacao) AS (
 VALUES ('015',0.030000,0.040400),
('016',0.025000,0.046300),
('017',0.008000,0.058400),
('018',0.002000,0.058800),
('019',0.005000,0.012500),
('020',0.005000,NULL),
('021',0.010000,0.138400),
('022',0.030000,0.157000),
('023',0.005000,0.043400),
('025',0.020000,0.096600),
('026',0.020000,0.095000),
('113',NULL,0.075600),
('114',0.010000,0.067000),
('115',0.010000,0.002000),
('116',0.005000,0.021600),
('117',0.005000,0.005000),
('118',0.005000,0.021500),
('120',0.050000,0.004000),
('121',0.010000,0.001400),
('123',0.025000,0.050600),
('130',NULL,0.005500)
), atualizado AS (
 SELECT jsonb_agg(
  CASE
    WHEN v.codigo IS NOT NULL THEN
      jsonb_set(
       jsonb_set(item, '{meta_perda}', to_jsonb(v.meta_perda), true),
       '{meta_participacao}', to_jsonb(v.meta_participacao), true)
    ELSE jsonb_set(
       jsonb_set(item, '{meta_perda}', 'null'::jsonb, true),
       '{meta_participacao}', 'null'::jsonb, true)
  END
  ORDER BY ord
 ) AS metas
 FROM montekali.configuracao_painel cp
 CROSS JOIN LATERAL jsonb_array_elements(cp.configuracao->'metas') WITH ORDINALITY t(item,ord)
 LEFT JOIN valores v ON v.codigo = item->>'codigo'
 WHERE cp.loja_codigo='007'
)
UPDATE montekali.configuracao_painel cp
SET configuracao=jsonb_set(
    jsonb_set(configuracao,'{metas}',(SELECT metas FROM atualizado),true),
    '{metas_oficiais}',jsonb_build_object('referencia','2026-10-16','participacao_informada_soma_percentual',100.10,'criterio','Metas por setor fornecidas em duas tabelas, sem normalizacao'),true)
WHERE cp.loja_codigo='007';
COMMIT;
