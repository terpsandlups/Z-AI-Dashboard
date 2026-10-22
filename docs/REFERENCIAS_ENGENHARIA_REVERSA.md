# Engenharia reversa de referências open source — Trocas 2.0 e Recorrência

[← README](../README.md) · [Roadmap](ROADMAP.md) · [ETL](ETL_E_IMPORTACOES.md)

> Estudo realizado em 22/10/2026. Foram revisados repositórios públicos e a organização conceitual de produtos de BI. **Não houve cópia de componentes ou de código de terceiros**; o Z-AI mantém sua arquitetura HTML/CSS/JavaScript e PostgreSQL/Supabase.

## Repositórios pesquisados

| Referência | Abordagem aproveitada no Z-AI | O que deliberadamente não foi migrado |
|---|---|---|
| [Sentry WMS](https://github.com/hightower-systems/sentry-wms) | Fila operacional, estado explícito por etapa, auditoria, contexto do armazém e separação entre posição e processo | Stack React/Flask, estrutura WMS completa, leitura por código de barras |
| [Material Management System](https://github.com/st4rboy1/Material-Management-System) | Acompanhamento de fornecedor, responsável, status do processo e painel de atenção; tabelas densas com detalhes por entidade | Gestão integral de compras, pedidos e seus fluxos |
| [Metabase](https://github.com/metabase/metabase) e [painel de anomalias](https://www.metabase.com/dashboards/cost-anomalies) | Do KPI ao diagnóstico: identificar responsáveis, reincidentes, contexto e abrir a investigação sobre o dado original | Incorporar servidor BI ou criar KPIs sem base do ERP |

## Trocas 2.0 — adaptação funcional

Problema anterior: a página já organizava o **saldo de trocas por fornecedor**, mas ainda faltavam controles para registrar *quem vai resolver*, *o que foi combinado* e *quando vence o prazo*.

### Novo desenho

1. **Fila operacional antes da tabela analítica**, com quatro indicadores: casos abertos, vencidos, aguardando retorno e concluídos.
2. **Linhas por fornecedor**, integradas aos filtros da página existentes: situação, responsável, prazo, próxima ação e valor da posição atual.
3. **Ficha editável**, com estados `pendente`, `em_contato`, `aguardando_retorno`, `concluida` e `cancelada`.
4. **Auditoria**, com versões e histórico dos valores anterior e atual, motivo informado e usuário responsável.
5. **Persistência independente do arquivo de Trocas**: substituir o snapshot de estoque **não apaga as tarefas**. Concluir uma tratativa **não significa dar baixa no ERP**.
6. **Segurança**, com leitura apenas por loja autorizada, edição somente pelo papel `importador` e verificação de versão para evitar sobrescrita concorrente.

**Modelos SQL:** `montekali.trocas_acompanhamentos` e `montekali.trocas_acompanhamentos_eventos`. **RPCs:** `zai_trocas_acompanhamentos`, `zai_trocas_salvar_acompanhamento`, `zai_trocas_historico`. **Frontend:** `web/tradeTasks.js`.

### Limite atual

A ficha acompanha uma tratativa **por fornecedor e loja**. Em etapa posterior, poderá haver múltiplos protocolos por fornecedor, cada um com SKUs/documentos, anexos e aprovação. Esta primeira entrega não tenta inventar fluxo de NF, integração com vendedor ou baixa automática de saldo.

## Inteligência de Recorrência — adaptação analítica

Problema anterior: rankings tradicionais valorizam um **lançamento isolado elevado** e podem ocultar produtos que perdem valores modestos repetidamente.

### Regras desta versão

- **Grão analítico:** `loja + SKU + departamento`, no período escolhido.
- **Frequência:** `COUNT(DISTINCT data_movimento)`, não apenas contagem de lançamentos.
- **Ocorrências:** `COUNT(*)`; pode haver várias movimentações no mesmo dia.
- **Impacto:** `SUM(valor)` de perdas reconhecidas, sem incluir falta e sobra na definição de *recorrência*.
- **Média por dia com quebra:** `SUM(valor) / COUNT(DISTINCT data_movimento)`.
- **Maior ocorrência individual:** `MAX(valor)`, permitindo ocultar produtos que tiveram evento único acima de um limite escolhido.
- **Filtros:** 2, 3, 5 ou 10 dias distintos; maior lançamento até R$ 30, R$ 50, R$ 100, R$ 200, ou sem limite.
- **Ordenação:** maior perda acumulada ou maior quantidade de dias com quebra.
- **Investigação:** acesso direto à ficha Produto 360° e exportação CSV do recorte retornado.

**Exemplo didático:** R$ 20 por dia com quebra em 20 datas distintas são R$ 400 em perdas acumuladas; uma quebra única de R$ 300 não atende ao critério de recorrência de 3 dias.

### Layout aplicado

1. Controles de recorte/limiar acima da análise.
2. KPIs de perdas totais, perdas dos SKUs recorrentes, participação e quantidade de reincidentes.
3. Gráfico de **impacto acumulado** e gráfico de **frequência** — perguntas diferentes, visíveis lado a lado.
4. Tabela operacional com todas as métricas e botão para investigar o SKU.

**RPC:** `zai_perdas_recorrencia`; **frontend:** `web/recurrence.js`; **CSS:** `web/operations.css`.

### Cuidados de interpretação

- Perder em cinco dias **não prova causa raiz**. Pode representar validade, giro, compra, execução, armazenagem ou outras situações.
- A soma de perdas recorrentes representa a participação no período filtrado, não é estimativa automática de economia recuperável.
- A consulta aceita até **366 dias** e traz até **200 produtos** para a página na versão inicial (a RPC permite até 300). Exportação não significa extração de todos os produtos da base quando há mais registros.
- Não confundir o número de **dias com perda** com o número de dias de venda ou com a quantidade de ocorrências.
- Para uma ficha com vários SKUs relacionados, ainda é preciso harmonizar cadastro e unidades antes de somar itens distintos.

## Próximos padrões para investigar

- **Acompanhamento de protocolos** por fornecedor (vários casos e documentos).
- **SLA** por categoria de fornecedor, com alertas de vencimento parametrizados.
- **Detecção estatística de anomalias**, separada de mera recorrência, com comparação histórica e validação de sazonalidade.
- **Plano de ação** vinculado ao SKU e medição pré/pós com cuidado sobre causalidade.
- **Testes visuais reais** de desktop e mobile além de smoke tests estáticos.
