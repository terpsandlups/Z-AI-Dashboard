import importlib.util
from decimal import Decimal
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('backup', Path(__file__).resolve().parents[1]/'tools/10_atualizar_base_local.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class BackupTest(unittest.TestCase):
    def setUp(self):
        self.row = dict(data='2026-09-01', sku='100', dpto='001', produto='Teste',
                        departamento='Teste', motivo='Avaria', qtde=1, valor=Decimal('8.10'))
        self.base = dict(schema='zai-007-v2', loja='007', departamentos={}, produtos={},
                         perdas=[['2026-09-01', '100', '001', 'Avaria', 1, Decimal('8.10')]],
                         vendas_mensais=[['2026-09','100','001',1,50]])

    def test_preserva_ocorrencias_iguais(self):
        result, audit = module.reconcile(self.base, {'schema':'kalimera-pp-007-v1','rows':[self.row,self.row]})
        self.assertEqual(audit['novos'], 1)
        self.assertEqual(audit['valor'], '16.20')
        self.assertEqual(result['vendas_mensais'], self.base['vendas_mensais'])
        self.assertEqual(len(result['perdas']), 2)
        _, repeated = module.reconcile(result, {'schema':'kalimera-pp-007-v1','rows':[self.row,self.row]})
        self.assertEqual(repeated['novos'], 0)

    def test_bloqueia_backup_que_remove_ou_altera(self):
        with self.assertRaises(ValueError):
            module.reconcile(self.base, {'schema':'kalimera-pp-007-v1','rows':[{**self.row,'valor':Decimal('9.10')}]})

    def test_rejeita_valor_ausente(self):
        with self.assertRaises(ValueError):
            module.reconcile(self.base, {'schema':'kalimera-pp-007-v1','rows':[{**self.row,'valor':None}]})

if __name__ == '__main__':
    unittest.main()
