"""Carga inicial exclusiva. Padrao: valida e desfaz (dry-run)."""
import argparse, datetime, hashlib, json, os
from decimal import Decimal
from pathlib import Path

def validar(path):
    raw=path.read_bytes()
    d=json.loads(raw,parse_float=Decimal)
    assert d['schema']=='kalimera-pp-007-v1', 'Schema desconhecido'
    assert isinstance(d['rows'],list) and d['rows'], 'Backup vazio'
    produtos={}; departamentos={}; total=Decimal(0)
    for r in d['rows']:
        datetime.date.fromisoformat(r['data'])
        for k in ('sku','produto','dpto','departamento','motivo'):
            assert isinstance(r[k],str) and r[k].strip(), 'Campo ausente: '+k
        for k in ('qtde','valor'):
            assert Decimal(str(r[k])).is_finite(), 'Numero invalido'
        prod=r['produto']; dep=r['departamento']
        assert r['sku'] not in produtos or produtos[r['sku']]==prod, 'SKU com descricao conflitante'
        assert r['dpto'] not in departamentos or departamentos[r['dpto']]==dep, 'Departamento conflitante'
        produtos[r['sku']]=prod;departamentos[r['dpto']]=dep
        total+=Decimal(str(r['valor']))
    return raw,d,produtos,departamentos,total

def main():
    a=argparse.ArgumentParser();a.add_argument('--backup',type=Path,default=Path(__file__).with_name('backup_original.json'));a.add_argument('--commit',action='store_true');a.add_argument('--validar-arquivo',action='store_true');args=a.parse_args()
    raw,d,produtos,departamentos,total=validar(args.backup)
    sha=hashlib.sha256(raw).hexdigest()
    print(f"Validado: {len(d['rows'])} registros; valor {total}; SHA256 {sha}")
    if args.validar_arquivo:return
    import psycopg
    from psycopg.types.json import Jsonb
    if not os.environ.get('MONTEKALI_DB_URL'):raise SystemExit('Configure MONTEKALI_DB_URL em ambiente seguro. Nao coloque senha no codigo.')
    # Conexao administrativa somente neste importador local. Nunca usar no navegador.
    with psycopg.connect(os.environ['MONTEKALI_DB_URL'],sslmode='require') as conn:
        with conn.cursor() as c:
            c.execute('LOCK TABLE montekali.lotes_importacao, montekali.perdas IN EXCLUSIVE MODE')
            c.execute('SELECT id,registros,valor_total FROM montekali.lotes_importacao WHERE arquivo_sha256=%s',(sha,))
            existing=c.fetchone()
            if existing:
                c.execute('SELECT count(*),sum(valor) FROM montekali.perdas WHERE lote_id=%s',(existing[0],))
                assert c.fetchone()==(len(d['rows']),total),'Lote existente diverge do backup'
                print('Backup ja importado e totais conferidos. Nenhum registro adicionado.');return
            c.execute('SELECT count(*) FROM montekali.perdas')
            assert c.fetchone()[0]==0,'Carga inicial exige tabela de perdas vazia; nao apaga dados existentes.'
            c.execute("INSERT INTO montekali.lojas VALUES ('007','Kalimera Japy') ON CONFLICT DO NOTHING")
            c.executemany('INSERT INTO montekali.departamentos VALUES (%s,%s) ON CONFLICT DO NOTHING',departamentos.items())
            c.executemany('INSERT INTO montekali.produtos(sku,descricao) VALUES (%s,%s) ON CONFLICT DO NOTHING',produtos.items())
            hist=json.loads(raw)['history']
            c.execute('INSERT INTO montekali.lotes_importacao(loja_codigo,tipo,arquivo_sha256,arquivo_nome,exportado_em,historico_origem,registros,valor_total) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id',('007','backup_inicial_perdas',sha,args.backup.name,d['exportedAt'],Jsonb(hist),len(d['rows']),total))
            lote=c.fetchone()[0]
            with c.copy('COPY montekali.perdas(lote_id,linha_origem,loja_codigo,data_movimento,sku,departamento_codigo,motivo,quantidade,valor) FROM STDIN') as cp:
                for i,r in enumerate(d['rows'],1):cp.write_row((lote,i,'007',r['data'],r['sku'],r['dpto'],r['motivo'],r['qtde'],r['valor']))
            c.execute('SELECT count(*),sum(valor) FROM montekali.perdas WHERE lote_id=%s',(lote,))
            assert c.fetchone()==(len(d['rows']),total),'Divergencia na carga'
            expected={}
            for r in d['rows']:
                k=(datetime.date.fromisoformat(r['data']),r['dpto'],r['motivo']);n,v=expected.get(k,(0,Decimal(0)));expected[k]=(n+1,v+Decimal(str(r['valor'])))
            c.execute('SELECT data_movimento,departamento_codigo,motivo,count(*),sum(valor) FROM montekali.perdas WHERE lote_id=%s GROUP BY 1,2,3',(lote,))
            actual={(dt,dp,mo):(n,v) for dt,dp,mo,n,v in c.fetchall()}
            assert actual==expected,'Divergencia por dia, departamento ou motivo'
        if args.commit:conn.commit();print('Carga confirmada. Totais conciliados.')
        else:conn.rollback();print('Simulacao concluida. Dados desfeitos; nada persistido. Sequencias podem avancar.')
if __name__=='__main__':main()
