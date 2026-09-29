"""Concilia um backup legado com uma base analítica LOCAL. Não conecta ao banco."""
import argparse
from collections import Counter
from datetime import date
from decimal import Decimal
import hashlib
import json
from pathlib import Path


def reconcile(base, backup):
    if base.get('schema') != 'zai-007-v2' or base.get('loja') != '007':
        raise ValueError('A base precisa ser da loja 007 e do tipo zai-007-v2.')
    if backup.get('schema') != 'kalimera-pp-007-v1' or not backup.get('rows'):
        raise ValueError('Backup legado da loja 007 inválido ou vazio.')
    rows = []
    departments = dict(base['departamentos'])
    products = dict(base['produtos'])
    for i, r in enumerate(backup['rows'], 1):
        dt = r.get('data', '')
        if date.fromisoformat(dt).isoformat() != dt:
            raise ValueError(f'Data inválida na linha {i}.')
        if not isinstance(r.get('sku'), str) or not r['sku'].isdigit():
            raise ValueError(f'SKU inválido na linha {i}.')
        if not isinstance(r.get('dpto'), str) or not r['dpto'].isdigit():
            raise ValueError(f'Departamento inválido na linha {i}.')
        if not all(isinstance(r.get(k), str) and r[k].strip()
                   for k in ('produto', 'departamento', 'motivo')):
            raise ValueError(f'Descrição ou motivo ausente na linha {i}.')
        values = []
        for k in ('qtde', 'valor'):
            if isinstance(r.get(k), bool) or not isinstance(r.get(k), (int, Decimal)):
                raise ValueError(f'{k} inválido na linha {i}.')
            number = Decimal(r[k])
            if not number.is_finite():
                raise ValueError(f'{k} não finito na linha {i}.')
            values.append(number)
        rows.append((dt, r['sku'], r['dpto'], r['motivo'], *values))
        departments.setdefault(r['dpto'], r['departamento'])
        products.setdefault(r['sku'], [r['produto'], 'Nao informado'])
    old = Counter(tuple(r) for r in base['perdas'])
    new = Counter(rows)
    missing = old - new
    if missing:
        raise ValueError(f'Backup não preserva {sum(missing.values())} ocorrências da base. '
                         'Conciliação interrompida; nenhuma linha será apagada.')
    additions = new - old
    result = dict(base)
    result.update(perdas=[list(r) for r in rows], departamentos=departments,
                  produtos=products, historico=backup.get('history', []))
    audit = {'registros': len(rows), 'valor': str(sum((r[5] for r in rows), Decimal(0))),
             'novos': sum(additions.values()), 'ausentes': 0,
             'valor_adicionado': str(sum((r[5] * n for r, n in additions.items()), Decimal(0))),
             'inicio': min(r[0] for r in rows), 'fim': max(r[0] for r in rows),
             'destino': 'arquivo local; banco não alterado'}
    result['data_quality'] = {**base.get('data_quality', {}), 'backup_perdas': audit}
    return result, audit


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base', required=True)
    p.add_argument('--backup', required=True)
    p.add_argument('--saida', help='Novo JSON analítico; omitido = somente validação')
    a = p.parse_args()
    base_path, backup_path = Path(a.base), Path(a.backup)
    source = backup_path.read_bytes()
    base = json.loads(base_path.read_text(encoding='utf-8-sig'), parse_float=Decimal)
    backup = json.loads(source.decode('utf-8-sig'), parse_float=Decimal)
    result, audit = reconcile(base, backup)
    audit['sha256_backup'] = hashlib.sha256(source).hexdigest()
    if a.saida:
        out = Path(a.saida)
        if out.resolve() in (base_path.resolve(), backup_path.resolve()):
            raise ValueError('Escolha uma saída diferente dos arquivos de origem.')
        # Exclusivo: nunca sobrescreve uma base que já existe.
        with out.open('x', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, separators=(',', ':'), default=float)
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
