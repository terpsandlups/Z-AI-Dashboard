# Engenharia reversa visual — Z-AI Gestão Visual

**Data:** 29/10/2026 · **Escopo:** acabamento e padronização dos dez módulos do Z-AI; **sem modificar ETL, cálculos, SQL, RLS, importações ou a arquitetura de deploy**.

## Bases realmente consultadas

Os repositórios abaixo foram examinados pela API do GitHub, em seus READMEs, árvores de componentes ou trechos de implementação. A referência orienta **boas práticas**, sem transposição literal de código, de imagem ou de propriedade visual.

| Referência | Observações na fonte | Adaptação ao Z-AI |
|---|---|---|
| [Tabler](https://github.com/tabler/tabler) — `core/scss/ui/_cards.scss`, `_datagrid.scss` | Cartões com borda/sombra leves, grade flexível para dados, separação entre estilos do layout e dos componentes | Consistência de cartões, grids, sombras, raios, leitura numérica |
| [Ant Design Pro](https://github.com/ant-design/ant-design-pro) — `src/pages/dashboard/analysis/index.tsx` | Scorecards iniciais, rankings, painéis de vendas e controles de intervalo em uma página analítica | Ordem visual *indicador → gráfico/ranking → tabela*, com filtros no topo |
| [AdminLTE](https://github.com/ColorlibHQ/AdminLTE) — `src/scss/_cards.scss`, `_table.scss` | Categorias de cartões, cabeçalho fixo de tabelas, detalhes de leitura de dados extensos | Cabeçalhos visíveis durante rolagem, linhas alternadas discretas, células com números legíveis |
| [Horizon UI Chakra](https://github.com/horizon-ui/horizon-ui-chakra) — `src/theme/components` | Componentes temáticos separados (botão, badge, input) | Tokens de cor e controles coerentes, sem introduzir Chakra/React |
| [paulohenriquecunha/powerbi_dashboards](https://github.com/paulohenriquecunha/powerbi_dashboards) — `comercial/README.md` | Faturamento, metas, top produtos, unidades e análise comparativa | Maior destaque dos KPIs de receita e leitura consistente de rankings |
| [avmachado/dashboards-powerbi](https://github.com/avmachado/dashboards-powerbi) — `Relatório de Vendas/README.md` | Perguntas de negócio, fontes tratadas, segmentação, comparação por fabricante | Definição visível de recorte, departamento e legenda, sem mudar os dados |
| [asimov-academy/Dashboards](https://github.com/asimov-academy/Dashboards) — `dash-sales-analyzer/README.md` | Dashboard para rede de supermercados em Python/Dash, foco em gráficos por parâmetros | Interação centrada no filtro e no comportamento da análise do varejo |
| [plotly/dash](https://github.com/plotly/dash) | Biblioteca Python para dashboards analíticos, não um tema CSS reutilizável | Inspirou organização conceitual, não a migração do frontend |
| [plausible/analytics](https://github.com/plausible/analytics) — estrutura `assets/css` | Interface analítica organizada em estilos separados | Consolidar refinamentos numa camada de apresentação independente |

Também identificamos a referência correta [ColorlibHQ/gentelella](https://github.com/ColorlibHQ/gentelella), em vez de `awaruga/gentelella`, e a implementação [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter). Por não serem necessárias para uma fase somente visual, **não foram adicionadas ao Z-AI**. A lista original também inclui [AmirhosseinHonardoust/The-Analysts-Mirror-Reflective-Dashboards](https://github.com/AmirhosseinHonardoust/The-Analysts-Mirror-Reflective-Dashboards), referência de estudo sem código incorporado.

## Escolha técnica

O Z-AI é uma aplicação estática (HTML + CSS + JavaScript), publicada na Vercel e conectada ao Supabase por funções autenticadas. Uma migração para Next.js, React ou Bootstrap exigiria reimplementar telas e eventos de importação, com risco e custo desnecessários. Optamos por:

- **Arquivo novo:** `web/visual-polish.css`, carregado após os estilos preexistentes para criar um sistema visual único e reversível;
- **Tokens de interface:** fundo, texto, azul principal, verde/crédito, vermelho/perda, âmbar/atenção, bordas, raios e sombra;
- **KPI semântico:** `web/app.js` adiciona o atributo `data-tone` ao componente `card()` conforme o título. Apenas visual; nenhuma regra ou valor analítico é recalculado;
- **Gráficos:** contraste de cores/legendas, barras arredondadas, hierarquia de títulos, sem trocar motor dos SVGs e sem criar uma dependência de charting;
- **Tabelas:** contraste, linhas numéricas tabulares, cabeçalho fixo, rolagem horizontal e estado de foco;
- **Filtros/ETL:** campos e botões consistentes, confirmação e avisos de cobertura preservados;
- **Acessibilidade:** foco visível por teclado, contraste, preferência de movimento reduzido, tela pequena e CSS para impressão.

## Padronização por módulo

| Página | Prioridade da apresentação |
|---|---|
| Visão Executiva | KPIs e meta com maior destaque, gráficos explicativos, leitura de tendência |
| Perdas Reconhecidas | Valores e motivo, distinção de perda, busca e tabela de auditoria |
| Vendas & Participação | Receita, metas, vendas departamentais, ranking e tabela SKU |
| Comparador | Períodos A/B claramente separados, indicadores lado a lado |
| Perdas Desconhecidas | Faltas, sobras e divergências em cores semanticamente coerentes |
| Perdas Consolidadas | Total de perda, componentes e meta em uma hierarquia única |
| Estoque de Trocas | Fornecedor, tratativa, valor e pendência com status consistente |
| Central de Importações | Formulário legível, prévia, aviso e confirmação |
| Produto 360° | Identificação de SKU, resumo do produto e linha de movimentações |
| Inteligência de Recorrência | Filtros operacionais, critérios de criticidade e ranking de itens |

## Critérios de aceitação

- [x] A navegação gera os **dez módulos** em teste JavaScript isolado.
- [x] Código JavaScript atualizado passa em verificação sintática.
- [x] A nova camada de estilo está vinculada ao HTML.
- [x] Preservada a arquitetura de API, Supabase, autenticação e ETL.
- [x] `card()` aplica tons visuais a vendas, perdas, sobras e metas sem afetar cálculos.
- [ ] Conferência visual manual em navegador autenticado (desktop, laptop e PDA/celular).
- [ ] Avaliação com o usuário da densidade do painel e refinamento final.

> **Importante:** a atualização tem **escopo visual**. Mudanças funcionais são tratadas separadamente e requerem teste de regressão próprio. Nenhum pacote React, Next, Bootstrap, Chakra ou Plotly foi instalado; nenhum código dos repositórios consultados foi copiado.
