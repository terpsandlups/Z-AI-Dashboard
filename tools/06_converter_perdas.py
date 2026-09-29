"""Converte Excel em JSON conferivel. Ct Medio e VALOR TOTAL da linha neste layout."""
import argparse,json,datetime,unicodedata,re
from pathlib import Path
import openpyxl

def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower())
def num(x):
 if x is None or x=='':raise ValueError('Valor/quantidade ausente; nao sera convertido para zero')
 if isinstance(x,str):x=x.strip().replace('R$','').replace(' ','');x=x.replace('.','').replace(',','.') if ',' in x else x
 v=float(x)
 if not __import__('math').isfinite(v):raise ValueError('Numero invalido')
 return v

def convert(path,valor_total=False):
 base=json.load(open(Path(__file__).resolve().parents[1]/'data/base_conferida.json',encoding='utf8'));deps={norm(v):k for k,v in base['departamentos'].items()}
 w=openpyxl.load_workbook(path,read_only=True,data_only=True);it=iter(w.active.iter_rows(values_only=True));head=None
 for _ in range(12):
  row=next(it,None)
  if row is None:break
  ns=[norm(x) for x in row]
  if 'codigo' in ns and ('dtmvto' in ns or 'data' in ns):head=ns;break
 if head is None:raise ValueError('Cabecalho de perdas nao reconhecido')
 def col(*options):return next((head.index(x) for x in options if x in head),None)
 fields={'data':col('dtmvto','data'),'sku':col('codigo','sku'),'produto':col('descricao','produto'),'dpto':col('dpto','codigodepartamento'),'departamento':col('descricaodpto','departamento'),'motivo':col('descricaoespecie','motivo'),'qtde':col('qtde','quantidade'),'valor':col('valor')}
 if fields['valor'] is None:
  fields['valor']=col('ctmedio')
  if fields['valor'] is not None and not valor_total:raise ValueError('Coluna Ct Medio encontrada. Neste relatorio e TOTAL da linha: confirme com --ct-medio-total.')
 for k in ['data','sku','produto','motivo','qtde','valor']:
  if fields[k] is None:raise ValueError('Coluna obrigatoria ausente: '+k)
 rows=[];footer=None
 for n,row in enumerate(it,1):
  if not any(x is not None for x in row):continue
  sku=row[fields['sku']]
  if sku in (None,'',0) and not row[fields['data']] and not row[fields['produto']]:
   if row[fields['valor']] is not None:footer=num(row[fields['valor']])
   continue
  if str(sku).lower().startswith('total') and not row[fields['data']]:
   footer=num(row[fields['valor']]);continue
  if not str(sku).isdigit():raise ValueError(f'Linha {n}: SKU invalido {sku}')
  r={k:row[i] if i is not None else None for k,i in fields.items()}
  dt=r['data']
  if not isinstance(dt,(datetime.datetime,datetime.date)):
   dt=next((datetime.datetime.strptime(str(dt),fmt) for fmt in ['%d/%m/%Y'] if re.match(r'^\d{2}/\d{2}/\d{4}$',str(dt))),None)
  if dt is None:raise ValueError(f'Linha {n}: data invalida')
  code=str(r['dpto']).zfill(3) if r['dpto'] is not None else deps.get(norm(r['departamento']))
  if code not in base['departamentos']:raise ValueError(f'Linha {n}: departamento nao encontrado {r["departamento"]}')
  if not r['produto'] or not r['motivo']:raise ValueError(f'Linha {n}: descricao/motivo ausente')
  rows.append({'data':dt.strftime('%Y-%m-%d'),'sku':str(sku),'produto':str(r['produto']),'dpto':code,'motivo':str(r['motivo']),'qtde':num(r['qtde']),'valor':num(r['valor'])})
 w.close()
 if not rows:raise ValueError('Nenhuma linha valida')
 if footer is not None and abs(sum(r['valor'] for r in rows)-footer)>.01:raise ValueError('Total das linhas diverge do rodape do relatorio')
 return {'schema':'zai-perdas-import-v1','loja':'007','arquivo_origem':Path(path).name,'rows':rows}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('arquivo');p.add_argument('--ct-medio-total',action='store_true');a=p.parse_args();d=convert(a.arquivo,a.ct_medio_total);dest=Path(a.arquivo).with_suffix('.conferido.json');dest.write_text(json.dumps(d,ensure_ascii=False),encoding='utf8');print(dest,len(d['rows']),'linhas. Valor:',round(sum(r['valor'] for r in d['rows']),2),'Revise a previa no menu 8 antes de confirmar.')
