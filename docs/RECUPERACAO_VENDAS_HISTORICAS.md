# Recuperação do detalhamento de vendas históricas por SKU

**Data:** 29/10/2026 · **Unidade piloto:** 007 — Kalimera Japy

[← README](../README.md) · [Auditoria dos filtros](AUDITORIA_FILTROS_2026-10.md)

## Diagnóstico confirmado no Supabase

A falha relatada não era falta do arquivo original nem perda dos registros de venda: os produtos já estavam preservados nas tabelas de fechamento mensal `montekali.vendas_mensais` e `montekali.vendas_resumo_produto_mes`.

- `montekali.vendas`: movimentos **diários por SKU**, existentes principalmente entre setembro e outubro de 2026.
- `montekali.vendas_resumo_produto_mes`: consolidados **mensais por SKU/departamento**, existentes de janeiro a outubro de 2026.
- `montekali.vendas_mensais`: base mensal original de janeiro a agosto de 2026.
- `montekali.vendas_resumo_dia`: venda resumida por dia/departamento, inclusive nos meses antigos; **não** deve ser confundida com vendas diárias por SKU.

A página `Vendas & Participação` já exibia o faturamento antigo correto, mas a RPC `zai_vendas_produtos_periodo` consultava **somente `montekali.vendas`**. O frontend também bloqueava consultas em períodos de competência mensal. Daí a ausência dos produtos mesmo com o histórico armazenado.

## Reconciliação dos dados existentes

| Mês de 2026 | SKUs distintos no histórico mensal | Faturamento |
|---|---:|---:|
| Janeiro | 13.593 | R$ 4.933.270,47 |
| Fevereiro | 13.515 | R$ 4.683.073,45 |
| Março | 13.983 | R$ 5.319.678,56 |
| Abril | 13.883 | R$ 5.272.840,32 |
| Maio | 14.057 | R$ 5.459.042,59 |
| Junho | 13.907 | R$ 5.103.073,07 |
| Julho | 13.972 | R$ 5.368.485,35 |
| Agosto | 14.191 | R$ 5.424.791,75 |

**A soma do resumo de produtos por mês correspondeu exatamente à tabela mensal original em cada um dos oito meses.** A soma do resumo diário por departamento também correspondeu ao total mensal em cada competência.

## Correção implantada

### Banco: `database/27_recupera_vendas_produto_historico.sql`

A RPC existente `public.zai_vendas_produtos_periodo` mantém a mesma assinatura e o formato JSON consumido pelo dashboard, mas seleciona a fonte de forma transparente:

1. **Mês histórico completo e sem fatos diários por SKU:** consulta o resumo mensal por produto.
2. **Período diário com fatos por SKU:** consulta movimentos diários, respeitando as datas cobertas.
3. **Vários meses:** seleciona a origem para cada competência individualmente, une os fatos e agrega SKU + departamento sem somar as duas fontes para a mesma competência.
4. **Trecho de mês antigo sem venda diária por SKU:** informa que o detalhamento está disponível apenas para o **mês fechado**. Não fabrica vendas por dia, não faz rateio proporcional e não mostra resultado zero como se não tivesse vendas.
5. **Autorização:** mantém a verificação de loja na tabela de acessos e privilégios somente para o papel `authenticated`.

### Produto 360°: `database/28_produto_360_vendas_mensais.sql`

A ficha por SKU também utiliza vendas mensais antigas quando corresponde a mês completo. Na evolução temporal, o fechamento mensal fica **posicionado no último dia do mês apenas como referência**, identificado na interface como competência, **não como data da venda**.

### Frontend

- `web/app.js`: remove o bloqueio incorreto, exibe produtos históricos, informa granularidade mensal e alerta quando o somatório de produtos difere do faturamento.
- `web/product360.js`: explicita a competência mensal do histórico e evita interpretações diárias incorretas.
- Exportação CSV por SKU permanece vinculada às datas e loja selecionadas.

## Testes de não regressão

As consultas autenticadas de teste no banco foram executadas apenas como leitura, sem gravar dados de venda:

- Janeiro completo: **13.593 SKUs e R$ 4.933.270,47** conferidos.
- Janeiro por departamento `022`: soma do filtro confrontada com os movimentos mensais do setor.
- Semana de setembro: somatório por SKU confrontado com os movimentos diários originais.
- Janeiro parcial: rejeição explícita de detalhe diário inexistente.
- Cada um dos oito meses históricos e o acumulado janeiro–agosto: os totais retornados pela RPC coincidiram com o histórico original.
- Produto 360°: SKU histórico em janeiro conciliado com base mensal; movimento recente em setembro conciliado com base diária.

**Observação:** autenticação, latência de grandes intervalos, leitura dos campos no navegador e CSV devem ser testados na sessão real. Teste de função PostgreSQL não substitui teste visual do navegador.

## Regra de encerramento do projeto

A partir desta restauração, a prioridade é estabilização: **correções demonstradas em testes de uso real, padronização visual, consistência tipográfica, responsividade e organização dos painéis**. Novas áreas funcionais não são pré-requisito para concluir a versão piloto.
