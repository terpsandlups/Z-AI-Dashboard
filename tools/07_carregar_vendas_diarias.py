"""CSV normalizado de vendas; substitui dias completos em transacao com auditoria.
Nunca soma mensal + diario. O painel usa diario para um mes historico apenas
quando todos os dias desse mes tem cobertura confirmada.
"""
import argparse,csv,os,getpass,hashlib,json,datetime,collections
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote
import psycopg
p=argparse.ArgumentParser();p.add_argument('arquivo');p.add_argument('--dias-completos',required=True,help='YYYY-MM-DD,YYYY-MM-DD: dias inteiros, incluindo dias de venda zero');p.add_argument('--substituir-dias',action='store_true');p.add_argument('--commit',action='store_true');a=p.parse_args()
days=sorted(set(datetime.date.fromisoformat(x.strip()) for x in a.dias_completos.split(',')))
raw=Path(a.arquivo).read_bytes();sha=hashlib.sha256(raw+b'|'+','.join(map(str,days)).encode()).hexdigest()
records=list(csv.DictReader(raw.decode('utf-8-sig').splitlines(),delimiter=';'));required={'loja','data','sku','produto','departamento_codigo','quantidade','valor'}
if not records or not required.issubset(records[0]):raise ValueError('Use o modelo CSV com cabecalho e separador ponto-e-virgula.')
def decimal(x):
 if not x or not x.strip():raise ValueError('Quantidade/valor ausente')
 x=x.strip();n=Decimal(x.replace('.','').replace(',','.')) if ',' in x else Decimal(x)
 if not n.is_finite():raise ValueError('Numero invalido')
 return n
agg=collections.defaultdict(lambda:[Decimal(0),Decimal(0)]);products={}
for r in records:
 if r['loja']!='007' or not r['sku'].isdigit() or not r['produto'].strip() or not r['departamento_codigo'].isdigit():raise ValueError('Loja, SKU, produto ou departamento invalido')
 dt=datetime.date.fromisoformat(r['data'])
 if dt not in days:raise ValueError('Data sem confirmacao de dia completo: '+str(dt))
 k=(dt,r['sku'],r['departamento_codigo'].zfill(3));q,v=decimal(r['quantidade']),decimal(r['valor']);agg[k][0]+=q;agg[k][1]+=v
 if r['sku'] in products and products[r['sku']]!=r['produto']:raise ValueError('Descricoes conflitantes para SKU '+r['sku'])
 products[r['sku']]=r['produto']
print('Dias completos:',','.join(map(str,days)),'Linhas consolidadas:',len(agg),'Venda:',sum(v[1] for v in agg.values()))
url=os.environ.get('MONTEKALI_DB_URL')
if not url:raise ValueError('Configure MONTEKALI_DB_URL no ambiente local; não coloque credenciais no código.')
with psycopg.connect(url,connect_timeout=20,sslmode="require") as conn:
 with conn.cursor() as c:
  c.execute("SELECT versao FROM montekali.revisoes WHERE loja_codigo='007' FOR UPDATE")
  if not c.fetchone():raise ValueError('Execute 03_painel_v2.sql')
  c.execute('SELECT 1 FROM montekali.lotes_importacao WHERE arquivo_sha256=%s',(sha,))
  if c.fetchone():raise ValueError('Arquivo e dias ja importados')
  c.execute("SELECT count(*),coalesce(sum(valor),0) FROM montekali.vendas WHERE loja_codigo='007' AND data_movimento=ANY(%s)",(days,));old=c.fetchone();print('Vendas anteriores nos dias:',old)
  if old[0] and not a.substituir_dias:raise ValueError('Dias ja possuem vendas. Confira simulacao; use --substituir-dias somente para relatorio completo.')
  c.execute('SELECT codigo FROM montekali.departamentos');deps={r[0] for r in c.fetchall()}
  if any(k[2] not in deps for k in agg):raise ValueError('Departamento sem cadastro; revise antes de importar')
  c.executemany('INSERT INTO montekali.produtos(sku,descricao) VALUES(%s,%s) ON CONFLICT DO NOTHING',list(products.items()))
  c.execute("INSERT INTO montekali.lotes_importacao(loja_codigo,tipo,arquivo_sha256,arquivo_nome,historico_origem,registros,valor_total) VALUES('007','vendas_diarias',%s,%s,%s::jsonb,%s,%s) RETURNING id",(sha,Path(a.arquivo).name,json.dumps({'dias_completos':list(map(str,days))}),len(agg),sum(v[1] for v in agg.values())));lote=c.fetchone()[0]
  # Auditoria especifica para carga administrativa, sem inventar um usuario Auth.
  c.execute("UPDATE montekali.lotes_importacao SET historico_origem=historico_origem || jsonb_build_object('vendas_anteriores',coalesce((SELECT jsonb_agg(v) FROM montekali.vendas v WHERE loja_codigo='007' AND data_movimento=ANY(%s)),'[]'::jsonb)) WHERE id=%s",(days,lote))
  c.execute("DELETE FROM montekali.vendas WHERE loja_codigo='007' AND data_movimento=ANY(%s)",(days,))
  with c.copy('COPY montekali.vendas(lote_id,loja_codigo,data_movimento,sku,departamento_codigo,quantidade,valor) FROM STDIN') as cp:
   for (dt,sku,dept),(q,v) in agg.items():cp.write_row((lote,'007',dt,sku,dept,q,v))
  c.executemany("INSERT INTO montekali.cobertura_vendas VALUES('007',%s) ON CONFLICT DO NOTHING",[(d,) for d in days])
  c.execute("SELECT montekali.atualizar_resumos('007')")
  c.execute("UPDATE montekali.revisoes SET versao=versao+1 WHERE loja_codigo='007'")
  c.execute('SELECT count(*),sum(valor) FROM montekali.vendas WHERE lote_id=%s',(lote,));got=c.fetchone();assert got==(len(agg),sum(v[1] for v in agg.values()))
 if a.commit:conn.commit();print('GRAVADO. Historico mensal preservado; sem dupla contagem no painel.')
 else:conn.rollback();print('SIMULACAO: nada gravado. Use --commit apos conferir.')
