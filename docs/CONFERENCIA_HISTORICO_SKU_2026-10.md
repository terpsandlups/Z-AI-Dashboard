# Auditoria final do histórico por SKU — Z-AI Gestão Visual

**Data:** 29/10/2026 · **Piloto:** Loja 007 · **Escopo:** vendas históricas por produto, granularidade diária e apresentação.

## Diagnóstico a partir dos arquivos e da base

A planilha de conferência `Conferencia_ETL_Historico.xlsx` menciona explicitamente o arquivo de origem `ETL 2.xlsx`, registra as competências de **janeiro a agosto de 2026** e afirma que são **registros mensais por SKU**. A aba `Modelo_diario` é apenas um cabeçalho-modelo. A planilha de conferência informa também que o arquivo original não identifica a loja e que o resumo completo esteve disponível em um ZIP externo. Portanto, **ela não comprova que haja movimento diário por SKU para todos os meses antigos**.

A base real da Loja 007 foi consultada sem alterações em seus movimentos:

- `montekali.vendas_resumo_dia` guarda valores **por dia e departamento** de janeiro a outubro (jan/26 tem 30 datas com valores; fev/26 tem 28).
- `montekali.vendas_resumo_produto_mes` guarda valores **por SKU e departamento em cada mês**, incluindo jan–ago.
- `montekali.vendas` possui fatos **diários por SKU** a partir de setembro de 2026, no estado atual do banco.
- A função `zai_vendas_produtos_periodo` antiga já consegue retornar o total mensal por SKU, mas retornava **todos os produtos simultaneamente**, causando grande resposta para o navegador.

**Conclusão:** os produtos mensais estão preservados. Os dados diários **por departamento** não podem ser distribuídos automaticamente para produtos, porque não informam quais SKUs foram vendidos em cada dia. Se existir um segundo arquivo com colunas **data, SKU, quantidade e valor**, sua identidade e disponibilidade precisam ser verificadas antes de gravá-lo; **não foi feita reinserção nem rateio** durante esta auditoria.

## Correção funcional

A RPC `public.zai_vendas_produtos_pagina` usa internamente `zai_vendas_produtos_periodo`, preservando suas validações de loja e as regras de fontes **mensal versus diária**, sem dupla soma.

- Recebe `p_loja`, `p_de`, `p_ate`, `p_dpto`, `p_busca`, `p_situacao`, `p_pagina` e `p_tamanho`.
- Devolve **até 40 produtos por consulta na tela**, total de registros, total filtrado, faturamento geral e faturamento filtrado.
- Consulta o SKU pelo código ou pela descrição diretamente no banco, sem depender de baixar todos os registros para pesquisar.
- Mantém os filtros de loja, datas e departamento.
- A interface oferece paginação, tentativa novamente após falha, mensagem explícita sobre **competência mensal por SKU** e alerta de divergência do total.
- O botão **Exportar CSV completo** consulta todos os produtos do intervalo, não apenas a página atual, e respeita busca/situação selecionadas.
- Para intervalo parcial de mês histórico sem fatos diários por SKU, o sistema mostra a limitação e oferece consultar o **mês completo**. Jamais cria vendas por SKU/dia artificialmente.

## Validação SQL autenticada

Conferido no Supabase com `SET LOCAL ROLE authenticated` e usuário autorizado da Loja 007, sem gravação de fatos:

| Período | Registros SKU/departamento | Faturamento conciliado |
|---|---:|---:|
| Jan/26 | 13.593 | R$ 4.933.270,47 |
| Fev/26 | 13.515 | R$ 4.683.073,45 |
| Mar/26 | 13.983 | R$ 5.319.678,56 |
| Abr/26 | 13.883 | R$ 5.272.840,32 |
| Mai/26 | 14.057 | R$ 5.459.042,59 |
| Jun/26 | 13.907 | R$ 5.103.073,07 |
| Jul/26 | 13.972 | R$ 5.368.485,35 |
| Ago/26 | 14.191 | R$ 5.424.791,75 |

Outras verificações: pesquisa `pao` em janeiro retornou **287 produtos/setores**, janeiro com departamento `025` trouxe **1.220 registros**, navegação na segunda página trouxe as próximas 40 linhas, intervalo setembro 14–20 trouxe **9.765 produtos/setores**, e janeiro–agosto consolidado retornou **19.098 combinações** com **R$ 41.564.255,56**. O retorno paginado preservou as somas existentes.

## Engenharia visual

Reforço de design implementado em `web/sales-explorer.css`: painel de investigação por SKU com indicação da fonte, total de registros, valor encontrado, contraste de tabelas, links de investigação, pesquisa e paginação em desktop/celular, estados de carregamento e erro. Mantido `web/visual-polish.css` como identidade corporativa global.

## Critérios de homologação final

1. Abrir `Vendas & Participação`, Loja 007, **01/01/2026 a 31/01/2026** e pressionar Aplicar.
2. Em `Departamento → Produto`, ver produtos da competência, indicador de 13.593 registros e faturamento reconciliado de R$ 4.933.270,47.
3. Pesquisar por nome de produto, mudar departamento, navegar até a segunda página e testar CSV completo.
4. Abrir setembro por semana e confirmar origem diária.
5. Tentar um recorte `01/01/2026 a 15/01/2026`: não deve mostrar valores mensais como se fossem diários; oferecer mês completo.
6. Verificar em sessão real desktop e PDA, com eventuais erros no console/rede. Testes SQL isolados e simulação de JS não substituem este último passo.

**Objetivo de encerramento:** só restam a inspeção visual na sessão autenticada e, se comprovada a existência de outro arquivo original com data+SKU para jan–ago, sua reconciliação e importação controlada.
