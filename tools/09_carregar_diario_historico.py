"""Carga integral conferida. Preserva perdas/mensal e recusa sobreposicao diaria."""
import argparse,csv,gzip,json,os,getpass,hashlib
from pathlib import Path
from decimal import Decimal
from urllib.parse import quote
import psycopg
p=argparse.ArgumentParser();p.add_argument('--commit',action='store_true');a=p.parse_args();root=Path(__file__).resolve().parents[1];file=root/'data/vendas_diarias.csv.gz';base=json.loads((root/'data/base_conferida.json').read_text(encoding='utf8'));audit=json.loads((root/'data/auditoria_vendas.json').read_text(encoding='utf8'))
sha=hashlib.sha256(file.read_bytes()).hexdigest();count=0;total=Decimal(0)
with gzip.open(file,'rt',encoding='utf8') as f:
 for r in csv.DictReader(f,delimiter=';'):
  if r['loja']!='007':raise ValueError('Loja invalida na carga');
  count+=1;total+=Decimal(r['valor'])
if count!=audit['registros_diarios'] or total!=Decimal(audit['total_vendas']):raise ValueError('Carga diverge da auditoria')
print('Validado:',count,'registros;',total,'em vendas. 22/09 preservado, mas sem cobertura confirmada.')
url=os.environ.get('MONTEKALI_DB_URL')
if not url:raise ValueError('Configure MONTEKALI_DB_URL no ambiente local; não coloque credenciais no código.')
with psycopg.connect(url,connect_timeout=20,sslmode="require") as conn:
 with conn.cursor() as c:
  c.execute("SELECT versao FROM montekali.revisoes WHERE loja_codigo='007' FOR UPDATE")
  if not c.fetchone():raise ValueError('Execute 03 e 08 antes da carga')
  c.execute('SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=%s',(sha,))
  if c.fetchone():raise ValueError('Esta carga diaria ja foi gravada')
  c.execute("SELECT count(*) FROM montekali.vendas WHERE loja_codigo='007' AND data_movimento BETWEEN '2026-01-01' AND '2026-09-22'")
  if c.fetchone()[0]:raise ValueError('Ja existem vendas diarias no periodo. Carga cancelada para evitar sobrescrita. Solicite conciliacao.')
  c.execute("SELECT count(*),sum(valor) FROM montekali.perdas WHERE loja_codigo='007'");before=c.fetchone()
  c.executemany('INSERT INTO montekali.departamentos VALUES(%s,%s) ON CONFLICT DO NOTHING',list(base['departamentos'].items()))
  c.executemany("INSERT INTO montekali.produtos(sku,descricao,situacao_atual) VALUES(%s,%s,%s) ON CONFLICT(sku) DO UPDATE SET situacao_atual=CASE WHEN excluded.situacao_atual='Inativo' THEN 'Inativo' ELSE montekali.produtos.situacao_atual END",[(k,v[0],v[1]) for k,v in base['produtos'].items()])
  c.execute("INSERT INTO montekali.lotes_importacao(loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total) VALUES('007','vendas_diarias_historico',%s,%s,%s::jsonb,%s,%s) RETURNING id",(sha,file.name,json.dumps(audit),count,total));lote=c.fetchone()[0]
  with c.copy('COPY montekali.vendas(lote_id,loja_codigo,data_movimento,sku,departamento_codigo,quantidade,valor) FROM STDIN') as cp:
   with gzip.open(file,'rt',encoding='utf8') as f:
    for r in csv.DictReader(f,delimiter=';'):cp.write_row((lote,r['loja'],r['data'],r['sku'],r['departamento_codigo'],Decimal(r['quantidade']),Decimal(r['valor'])))
  c.executemany("INSERT INTO montekali.cobertura_vendas VALUES('007',%s) ON CONFLICT DO NOTHING",[(d,) for d in base['dias_vendas_completos']])
  cfg={k:base[k] for k in ('baseline','metas','aviso')}
  c.execute("INSERT INTO montekali.configuracao_painel VALUES('007',%s::jsonb) ON CONFLICT(loja_codigo) DO UPDATE SET configuracao=excluded.configuracao",(json.dumps(cfg),))
  c.execute("SELECT montekali.atualizar_resumos('007')")
  c.execute('SELECT count(*),sum(valor) FROM montekali.vendas WHERE lote_id=%s',(lote,));assert c.fetchone()==(count,total)
  c.execute("SELECT count(*),sum(valor) FROM montekali.perdas WHERE loja_codigo='007'");assert c.fetchone()==before
  c.execute("UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo='007'")
  print('Perdas preservadas:',before)
 if a.commit:conn.commit();print('GRAVADO. Metas e resumos diarios atualizados.')
 else:conn.rollback();print('SIMULACAO CONCLUIDA. Nada gravado. Use --commit apos conferir.')
