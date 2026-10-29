# Auditoria de filtros e períodos — Z-AI Gestão Visual

**Data de revisão:** 29/10/2026 · **Unidade piloto:** 007 — Kalimera Japy  
[← README](../README.md) · [Arquitetura](ARQUITETURA.md) · [ETL](ETL_E_IMPORTACOES.md) · [Dashboards](DASHBOARDS_E_INDICADORES.md)

## Objetivo

Verificar se **loja, data inicial/final, departamento, filtros locais, agregações, gráficos e exportações** operam sobre o mesmo recorte, sem cortar períodos silenciosamente, misturar fontes de grão diferente ou apresentar valores parciais como completos.

**Fontes verificadas:** `web/core.js`, `web/app.js`, `web/ui.js`, `web/product360.js`, `web/recurrence.js`, `web/tradeTasks.js` e contratos SQL versionados em `database/`.  
**Limite da auditoria:** consulta SQL administrativa ao Supabase **não estava disponível** nesta sessão; não foram alterados dados operacionais e os valores reais do screenshot de janeiro de 2026 **não foram reconciliados linha a linha com o banco**. Testes reproduzíveis foram feitos em memória com bases fictícias e verificação estática da aplicação. Login e ações autenticadas requerem homologação no navegador da loja.

## Referências de engenharia reversa

A revisão adotou **padrões de comportamento**, não cópia de código:

- [Metabase — Dashboard filters](https://www.metabase.com/docs/latest/dashboards/filters): filtros de data, escopo explícito, modo **Aplicar** versus aplicação automática, controles com valor efetivamente aplicado.
- [Apache Superset — Native filters](https://github.com/apache/superset/blob/master/superset-frontend/src/dashboard/components/nativeFilters/utils.ts): compatibilidade entre dimensão, filtro nativo e consulta; parâmetros persistentes, filtro por escopo e campos temporais consistentes.
- [Superset — Creating dashboards](https://superset.apache.org/docs/using-superset/creating-your-first-dashboard/): filtro ligado à dimensão correta; filtros incompatíveis devem ficar visíveis e não ser silenciosamente ignorados.

## Matriz auditada

| Módulo | Contrato do período | Alterações realizadas |
|---|---|---|
| **Visão Executiva** | Loja + datas inclusivas + departamento. Perdas e vendas só produzem taxa com cobertura suficiente | Sem truncar último dia; fontes de venda e perda sinalizadas separadamente; período válido e explícito |
| **Perdas Reconhecidas** | Movimentos por data original dentro do intervalo; agrupamento mantém todas as ocorrências | Não descartar quebras posteriores à última venda; filtro global só muda após Aplicar; export CSV com datas |
| **Vendas & Participação** | Faturamento diário ou total mensal consolidado, sem dupla soma | Não misturar resumo mensal com gráficos diários incompletos; **vendas antigas por SKU restauradas em competência mensal**; meta reflete os dias selecionados |
| **Comparador de Períodos** | Dois intervalos independentes, validados antes da consulta | Mantém referência do global ao abrir, preserva edição específica, informa durações diferentes e cobertura insuficiente, export com intervalos |
| **Perdas Desconhecidas — Inventário** | Consultas por loja, data, departamento, tipo e SKU | Invalidação de consulta antiga, erro sem recarga infinita, export bloqueado caso filtro mude ou limite cause corte |
| **Perdas Consolidadas** | Reconhecidas + faltas − sobras dentro do mesmo período | Datas inclusivas e nenhum movimento removido por corte automático de vendas; taxa condicionada à cobertura |
| **Estoque de Trocas / Trocas 2.0** | **Fotografia da posição atual**, não série histórica por data | Mantém filtro interno de fornecedor/marca/tratativa e separação entre snapshot atual e tarefas persistentes; não aplica data de venda ao saldo de posição |
| **Central de Importações** | Arquivos e lotes têm sua própria cobertura e regra de atualização | Histórico e importações continuam independentes do recorte de análise para não alterar a interpretação de uma carga |
| **Produto 360°** | SKU, loja, data e departamento; limite de 366 dias por consulta detalhada | Cache invalidado após filtros/loja; aviso amigável de período muito longo; evita detalhes de período anterior |
| **Inteligência de Recorrência** | Perdas reconhecidas por dias distintos, intervalo e departamento, até 366 dias | Filtro de datas global agora **visível** e efetivo; invalida resultados ao aplicar; aviso para intervalos incompatíveis |

## Defeitos corrigidos

### P1 — Cortar o fim do período silenciosamente

**Antes:** `ZAI.select()` podia definir `end` como o último dia com vendas reconhecidas no último mês. Isso também cortava perdas reconhecidas e entradas/saídas de inventário do cálculo consolidado.

**Agora:** `end=requestedEnd` sempre. Os dias sem fonte de venda são sinalizados como **cobertura insuficiente**, sem eliminar registros reconhecidos ou inventariados. Não se calcula taxa `perdas / vendas` a partir de denominador incompleto.

### P1 — Mistura de grão mensal e diário

**Antes:** um mês com faturamento **mensal** poderia mostrar gráficos por dia da semana ou produtos diários de uma amostra incompleta, divergindo dos KPIs totais.

**Agora:** um período abastecido por competência mensal continua exibindo faturamento e participação do mês completo, mas **não apresenta desdobramento semanal ou gráfico diário sem a respectiva fonte**. O detalhamento por SKU foi **restaurado a partir do resumo mensal já existente**, sem reimportar; nesses meses o SKU representa a competência inteira, não um dia específico.

### P1 — Filtro global invisível na Recorrência

**Antes:** a tela usava `#from`, `#to` e `#dept` internamente, mas o bloco estava oculto na navegação.

**Agora:** os controles ficam visíveis no módulo, o recorte é validado e qualquer alteração confirmada invalida o cache anterior.

### P1 — Comparações com fonte incompatível

**Antes:** o gráfico de tendência selecionava **meses inteiros** dentro de um filtro parcial; o comparador não destacava diferença de duração e confundia análise monetária com comparabilidade de taxas.

**Agora:** os pontos do gráfico usam a **interseção entre mês e intervalo selecionado**. O Comparador valida calendários, avisa quando os intervalos têm números diferentes de dias e quando faltam fontes para comparar taxas.

### P1 — Filtros de departamento limitados aos que têm meta

**Antes:** `departmentOptions()` ocultava departamentos sem meta preenchida.

**Agora:** todos os departamentos cadastrados aparecem. A ausência de meta afeta somente indicadores dependentes dessa referência.

### P1 — Respostas assíncronas obsoletas

**Antes:** a tabela detalhada de vendas poderia mostrar o resultado de uma consulta iniciada em outro período ou após atualização da loja. Auditorias podiam recomeçar indefinidamente a consulta em caso de falha.

**Agora:** chaves de consulta, revisão do snapshot e tokens de solicitação invalidam retornos obsoletos. Falhas em Auditorias ficam associadas ao recorte até nova tentativa/filtro, sem loop de recarga.

### P2 — Sem distinção entre filtro digitado e aplicado

**Antes:** editar datas sem clicar Aplicar e navegar para outra tela poderia gerar um recorte inesperado.

**Agora:** estado **Aplicado** separado do rascunho, aviso **“Alterações pendentes”**, validação antes da confirmação e conservação do período aplicado em atualizações da mesma loja.

### P2 — Exportação sem escopo temporal explícito

**Agora:** CSVs de Vendas por SKU, Perdas, Auditorias e Comparador incluem datas no nome. O CSV detalhado de Auditorias é cancelado se o filtro/ordenação mudar durante a requisição ou se a consulta retornar apenas parte dos registros por limite.

### P2 — Calendário inválido e cortes de limite

Datas como **30/02** são rejeitadas. Períodos excessivos não são mais truncados silenciosamente. As consultas específicas que limitam a **366 dias** apresentam orientação ao usuário antes de enviar ao banco.

## Regras analíticas preservadas

- **Loja:** isolamento autorizado continua sendo responsabilidade do Supabase (RPCs e permissões por filial).
- **Data:** datas inicial e final são inclusivas. Alterar um filtro global não modifica dados em banco.
- **Departamento:** a seleção é aplicada aos indicadores compatíveis; total de loja pode continuar sendo denominador de participação, quando isso estiver explicitado.
- **Vendas mensais e diárias:** jamais somar competência mensal e seus próprios movimentos diários.
- **Perdas de inventário:** `falta=saída`, `sobra=entrada`; `consolidada=reconhecidas+faltas−sobras`.
- **Trocas:** o saldo atual é um snapshot, não uma série temporal arbitrariamente filtrável com as datas de Vendas.
- **Importações:** cobertura e reversão por lote são operações de base; não se confundem com o recorte de consulta.

## Testes e evidências

Arquivos de teste:

- `tests/calculos.cjs`: fórmula, cobertura, datas e metas.
- `tests/filtros_periodos.cjs`: filtros completos/parciais, período cruzando meses, departamento, janeiro hipotético com vendas sem histórico de perda, datas inválidas.
- `tests/componentes.cjs`: navegação, seleção/aplicação, recorte global visível e campos dos módulos.
- `tests/importador_vendas.cjs`: datas Excel e lote diário.
- `tests/produto360.cjs` e `tests/operations.cjs`: fluxos e controles específicos.

Alguns testes do fluxo e a montagem dos dez módulos foram executados **em ambiente JavaScript isolado com dados fictícios**. A implantação final requer testes HTTP e, separadamente, testes de uma sessão autenticada.

## Limites conhecidos e próximas validações

1. **Perdas reconhecidas:** o snapshot atual usa o intervalo entre a primeira e a última ocorrência conhecida como **indício** de cobertura, não como comprovante formal de que todas as datas foram importadas. Evolução recomendada: `cobertura_perdas` própria por loja/data/lote, semelhante à cobertura de vendas, para certificar a taxa com base em fontes efetivamente completas.
2. **Vendas por SKU:** o histórico por produto dos meses fechados janeiro–agosto está preservado e agora é consultado por competência. Para **um trecho de mês antigo**, não existem fatos diários por SKU para determinar a venda exata; a aplicação explica o limite e não faz rateio fictício.
3. **Trocas históricas:** o snapshot atual não pode ser fatiado por qualquer intervalo temporal; uma consulta histórica necessitaria snapshots versionados por período, não a posição vigente.
4. **Banco operacional:** reconciliar janeiro de 2026 e outros períodos com consultas independentes ao Supabase quando a conexão administrativa estiver disponível. A auditoria de código não substitui conferência de registros reais.
5. **Homologação UX:** testar sessão real em desktop e PDA/celular, inclusive limites, latência, rede instável e transição entre lojas.
6. **Exportações muito grandes:** implementar paginação completa e confirmação de volume antes de permitir exportação maior que o limite SQL.

**Critério para fechar homologação:** mesmo intervalo e departamento devem produzir totais coerentes nas páginas executiva, detalhada e exportada; período parcialmente coberto deve exibir claramente a origem da ausência de comparabilidade.
