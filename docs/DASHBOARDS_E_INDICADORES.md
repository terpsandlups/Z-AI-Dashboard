# Dashboards e indicadores · Guia funcional

[← README](../README.md) · [Arquitetura](ARQUITETURA.md) · [ETL](ETL_E_IMPORTACOES.md) · [Roadmap](ROADMAP.md)

> **Princípio:** um gráfico tem valor quando ajuda a localizar o problema, investigar produtos e escolher uma ação. O Z-AI combina indicadores executivos, tabelas operacionais, filtros e acesso aos registros que explicam cada resultado.

## Visão geral

O frontend apresenta **dez módulos**, trabalhando sobre os dados da loja selecionada e, quando aplicável, dos intervalos de data inicial/final e departamento.

| Módulo | Pergunta operacional | Recursos existentes |
|---|---|---|
| **1. Visão Executiva** | Estamos dentro da meta? Onde está o maior impacto? | KPIs monetários e percentuais, metas, comparativo por departamento |
| **2. Perdas Reconhecidas** | Quais produtos e motivos concentram a quebra? | Ranking por SKU, lançamentos individuais/agrupados, motivos e tipos |
| **3. Vendas & Participação** | O setor vende conforme sua participação/meta? | Receita, meta diária, participação, desempenho diário, produtos |
| **4. Comparador de Períodos** | O que melhorou ou piorou entre dois intervalos? | Dois recortes de data, diferenças de indicadores, setores |
| **5. Perdas Desconhecidas · Inventário** | Quais faltas e sobras apareceram nas contagens? | Resumo líquido, linhas individuais/agrupadas, filtros, ordenação e CSV |
| **6. Perdas Consolidadas** | Qual é a perda total combinando as fontes? | Quebra reconhecida + falta − sobra, classificação por origem, metas |
| **7. Estoque de Trocas** | Quanto está parado e como tratar por fornecedor? | Posição atual, Fornecedor 360°, marcas, categorias, CSV filtrado |
| **8. Central de Importações** | Como atualizar e corrigir a base sem perder rastreabilidade? | Upload, ETL, prévia, confirmação, histórico e desfazer elegível |
| **9. Produto 360°** | O que aconteceu com um SKU no período? | Busca por código/descrição; venda, quebras, faltas, sobras, linha do tempo e lotes |
| **10. Inteligência de Recorrência** | Que produtos quebram repetidamente em dias diferentes? | Soma por SKU, dias com perda, maior lançamento, média por dia, ranking e CSV |

**Filtros globais e locais:** a navegação usa filtros de loja e, nos módulos aplicáveis, de período e departamento. Algumas análises adicionam busca por **SKU/nome**, categoria/motivo, situação, fornecedor, marca e tratativa.

---

## 1. Visão Executiva

**Principal finalidade:** leitura rápida de desempenho com possibilidade de aprofundar por departamento.

### KPIs principais

| Indicador | Definição |
|---|---|
| **Vendas** | Faturamento do período e escopo com fonte confiável |
| **Perdas Reconhecidas** | Quebras lançadas por motivo, como vencimento/avaria/deterioração |
| **Faltas / Perdas Desconhecidas** | Total monetário de auditorias de **Saída** |
| **Sobras** | Total monetário de auditorias de **Entrada** |
| **Perdas Consolidadas** | Reconhecidas **+ Faltas − Sobras** |
| **% Perdas / Vendas** | Perdas consolidadas ÷ vendas **comparáveis** |
| **Meta × realizado** | Indicador efetivo contra meta parametrizada da loja ou departamento |

**Exemplo fictício de interpretação**:

```text
Vendas comparáveis ............ R$ 180.000
Perdas reconhecidas ........... R$   1.800
Faltas de inventário .......... R$   1.100
Sobras de inventário .......... R$     400
Perda consolidada ............. R$   2.500
% perda consolidada ...........      1,39%
Meta piloto de perdas .........      2,40%
```

As sobras reduzem o valor líquido, mas **não eliminam a necessidade de investigar faltas e sobras brutas**. Esse exemplo é apenas didático, não representa um dia real da operação.

### Gestão por departamento

O painel cruza **vendas do setor**, **quebra**, **falta**, **sobra**, percentual e metas. Isso evita olhar apenas o valor absoluto: setores com pouco faturamento podem apresentar percentual de perda relevante.

---

## 2. Perdas Reconhecidas

**Finalidade:** entender **quanto** quebrou, **o que** quebrou, **quando**, **onde** e **por qual motivo**.

- **Individual:** mostra a maior ocorrência isolada (útil para um evento anormal).
- **Agrupado/acumulado:** soma ocorrências por produto no recorte (útil para identificar recorrências pequenas que geram perda relevante).
- **Tipos:** vencidos, avariados, deteriorados e outros reconhecidos, respeitando o texto original do ERP.
- **Filtros:** datas, departamento, categoria, motivo, busca por SKU ou descrição.
- **Análises:** participação das categorias e rankings de produtos.

**Exemplo de decisão:** um produto pode ter apenas R$ 18 de quebra por dia e superar um evento isolado de R$ 300 num intervalo longo. O modo agrupado torna o custo recorrente visível.

Não confundir **perda registrada** com **falta inventariada**. São eventos operacionais distintos.

---

## 3. Vendas & Participação

**Finalidade:** verificar se a execução comercial sustenta as metas e a participação dos departamentos.

- Receita do período, participação relativa, metas e desvio.
- Gráfico diário de **meta × realizado**, inclusive evolução.
- Ranking e tabela de vendas por produto/SKU, com recorte de período/departamento.
- Comparação do desempenho do departamento contra o comportamento da loja.

### Referências do piloto

- **Meta diária geral de vendas:** R$ 180.000.
- **Meta geral de perdas sobre vendas:** 2,40%.
- Participação/metas por departamento decorrem da matriz oficial configurada.

**Meta setorial diária:** normalmente resulta da meta de loja ponderada pela participação configurada no setor; é diferente do realizado histórico. Metas devem ser parametrizadas e auditadas, não inventadas por um algoritmo.

### Cobertura das vendas

A base aceita histórico diário e competências mensais. O motor de cálculo prioriza a cobertura diária quando ela está completa e **não soma o mesmo faturamento mensal e diário duas vezes**.

Médias por dia da semana devem respeitar dias cobertos, inclusive dias válidos com venda zero. Se o período de vendas está incompleto, o percentual de perdas não deve aparentar precisão que a base não possui.

---

## 4. Comparador de Períodos

**Finalidade:** comparar dois intervalos independentes para monitorar tendência, efeito de ações e evolução do setor.

Exemplos de uso:

- Comparar perdas consolidadas da primeira semana contra a segunda.
- Verificar se um departamento reduziu seu percentual de quebra.
- Medir variação de faltas e sobras após uma contagem ou ajuste.
- Exportar a comparação por departamento para discussão operacional.

**Cuidado:** comparação exige distinguir **variação em reais**, **variação percentual** e **diferença em pontos percentuais (p.p.)**. Períodos sem cobertura comparável não devem ser utilizados como se estivessem completos.

---

## 5. Perdas Desconhecidas · Inventário

**Finalidade:** gerenciar divergências de estoque vindas de auditorias e inventários.

| Movimento | Interpretação | Na fórmula consolidada |
|---|---|---|
| **Saída** | **Falta** | Aumenta |
| **Entrada** | **Sobra** | Diminui |

A página apresenta falta bruta, sobra bruta e resultado líquido, com busca, filtros, detalhe e modo **individual ou agrupado por SKU**.

### Ordem operacional das auditorias

**Primeiro todas as FALTAS**, da maior em valor para a menor. **Depois todas as SOBRAS**, também da maior para a menor. A ordenação deve ser feita **na consulta completa antes de aplicar paginação**, evitando esconder uma divergência maior em outra página.

Um SKU com faltas e sobras no mesmo período pode apresentar resultado líquido pequeno, mesmo indicando falha operacional recorrente. Por isso, os movimentos brutos continuam disponíveis.

---

## 6. Perdas Consolidadas

**Finalidade:** apresentar uma medida integrada de perda e separar a contribuição de cada origem.

```text
Perda consolidada = Perda reconhecida + Falta de estoque − Sobra de estoque

% perda consolidada = Perda consolidada / Venda comparável

Desvio de meta (p.p.) = % realizado − % meta
```

Tipos de análise:

- **Vencidos**, **Avariados**, **Deteriorados**, **Outros reconhecidos**.
- **Faltas de estoque** e **Sobras de estoque**.
- Participação por departamento.
- Meta contra realizado em reais e percentual.

A soma não é uma afirmação contábil universal para todas as operações; é **a fórmula de gestão adotada neste dashboard**, condicionada aos conceitos de entrada e saída validados para os arquivos do piloto.

---

## 7. Estoque de Trocas · Fornecedor 360°

**Finalidade:** controlar o que aguarda devolução/troca e transformar estoque parado em ações por parceiro comercial.

A tela parte de uma **posição vigente** (snapshot), cruza regras cadastradas do fornecedor e permite filtrar:

- Fornecedor e código de fornecedor.
- Marca/linha comercial.
- Tipo de tratativa.
- SKU/descrição do produto.
- Itens e valores em posição atual.

**Categorias operacionais:** NF / Nota de Devolução, Elas por Elas (Produto por Produto), Bonificação, Mista e Sem Regra Cadastrada.

**Fornecedores sem regra:** ficam explicitamente pendentes, sem classificação automática arriscada. O usuário pode exportar um CSV apenas do fornecedor/marca filtrado para encaminhamento aos vendedores e também um relatório de pendências cadastrais.

**Atenção:** uma importação nova substitui a posição **atual**; somar posições históricas distorce estoque e valores.

---

## 8. Central de Importações e Histórico

Concentra a entrada dos quatro tipos de arquivo, com prévia de quantidade, período, valor e regra de atualização. **Ler o arquivo não significa gravar.** Gravar depende de confirmação explícita do importador autorizado.

O histórico de lotes permite investigar a proveniência e **desfazer uma carga elegível** após confirmação e justificativa. Um arquivo importado na categoria incorreta não deve obrigar a excluir dados manualmente no PostgreSQL.

Detalhes de contratos, regras de segurança e restauração: [ETL e Importações](ETL_E_IMPORTACOES.md).

---

## Como avaliar se o dashboard está produzindo resultado

Além de estética e número de gráficos, os critérios operacionais devem ser:

1. **Confiabilidade:** totais da base batem com o ERP; datas corretas; nenhum dia duplicado.
2. **Rastreabilidade:** todo KPI permite chegar aos movimentos que o sustentam, diretamente ou via consulta.
3. **Capacidade de diagnóstico:** os piores SKUs, tipos, setores e recorrências ficam claros.
4. **Velocidade de atualização:** importação simples, sem limpeza manual recorrente no Excel.
5. **Ação mensurável:** hipótese, responsável, correção e acompanhamento (o plano de ação completo é uma fase futura).
6. **Comparabilidade:** variação por dia/período só quando as fontes cobrem o mesmo escopo.

### 9. Produto 360° — primeira entrega

Página própria no menu, com busca por código ou descrição e atalho nas tabelas de Vendas, Perdas Reconhecidas e Auditorias. A RPC `zai_produto_360` reúne as fontes **sem multiplicar valores entre tabelas de fatos**, entrega totais, quantidades, motivos, departamentos, evolução diária e até 200 movimentos recentes com lote de origem.

**Cobertura:** a taxa `perda consolidada / vendas` só aparece quando todos os dias do intervalo têm cobertura diária confirmada; totais parciais continuam identificados como não comparáveis. O CSV de lançamentos respeita o limite retornado pela consulta. A base SQL e o rendering do módulo foram testados; a homologação visual/autenticada segue como etapa final.

Próximas iterações: intervalos maiores, paginação detalhada de movimentos, comparativo entre lojas com permissão e vínculo com planos de ação.

[Ver fases seguintes e critérios de aceite →](ROADMAP.md)


### Trocas 2.0 — primeira entrega

A página de Trocas integra uma fila independente dos arquivos de posição. Cada fornecedor pode ter um responsável, prazo, status (pendente, em contato, aguardando retorno, concluída ou cancelada), próxima ação e observação. Alterações são auditadas no Supabase, e apenas perfil importador pode gravar. Concluir uma tarefa **não reduz estoque** automaticamente.

### 10. Inteligência de Recorrência — primeira entrega

A consulta agrupa perdas reconhecidas por **loja + SKU + departamento**. Usa `COUNT(DISTINCT data_movimento)` para dias com quebra, `COUNT(*)` para ocorrências e `SUM(valor)` para o acumulado. Permite ordenar por impacto ou frequência, definir mínimo de dias e excluir produtos cujo **maior lançamento** ultrapasse um limite escolhido. O usuário pode exportar o CSV e abrir o Produto 360°.

Ver [referências de engenharia reversa](REFERENCIAS_ENGENHARIA_REVERSA.md) para limites, fontes open source e decisões técnicas.
