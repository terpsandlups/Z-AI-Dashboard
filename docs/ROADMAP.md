# Roadmap · Z-AI Gestão Visual

[← README](../README.md) · [Dashboards](DASHBOARDS_E_INDICADORES.md) · [ETL](ETL_E_IMPORTACOES.md) · [Vercel](DEPLOY_VERCEL.md)

## Visão do produto

**De um painel de vendas/perdas para uma plataforma de gestão operacional:** consolidar arquivos confiáveis, diagnosticar causas por SKU, priorizar ações e, futuramente, medir a redução de perdas de forma reproduzível.

**Piloto:** Loja 007 — Kalimera Japy. O avanço para outras filiais deve preservar isolamento de dados e exigir validação de layouts e permissões. Este roadmap é **proposta de evolução**: itens planejados não devem ser apresentados como funcionalidades prontas.

### Critério de prioridade

1. Integridade dos dados e rastreabilidade.
2. Facilidade do fluxo diário de importações.
3. Capacidade de investigação por produto/fornecedor.
4. Apoio a ações operacionais e mensuração de resultado.
5. Integração automática, escala e expansão.

---

## Fase 0 — Fundamentos do piloto · Implantado

**Entregas presentes no repositório e banco piloto:**

- [x] Layout executivo com navegação lateral.
- [x] Oito áreas: Executivo, Perdas, Vendas, Comparador, Auditorias, Consolidadas, Trocas e Importações.
- [x] JavaScript/HTML/CSS estático, hospedagem em Vercel.
- [x] PostgreSQL/Supabase para autenticação, persistência, resumos e funções SQL.
- [x] Controle de acesso a lojas autorizadas; papéis `consulta` e `importador`.
- [x] Filtros por data e departamento nas páginas aplicáveis.
- [x] Metas oficiais por loja/departamento e comparativos meta × realizado.
- [x] Separação entre venda diária e competência mensal para impedir dupla contagem.
- [x] Perdas reconhecidas individuais e acumuladas.
- [x] Auditorias entrada/sobra e saída/falta, detalhamento e ordenação por valor.
- [x] Estoque de Trocas por fornecedor, marca, categoria e posição atual.
- [x] Rotina de importação Excel/CSV/JSON e histórico de lotes.
- [x] Reversão controlada de lotes elegíveis, com permissão e trilha de auditoria.
- [x] Testes de cálculos, componentes JS e regressões do importador.

**Observação:** “implantado” significa que existe implementação. **Não implica homologação de todas as combinações de usuários, lojas, datas e formatos**, nem integração automática de origem.

---

## Fase 1 — Confiabilidade e experiência de importação · Manutenção contínua

**Objetivo:** o usuário escolher o arquivo correto, compreender a prévia e ter confiança de que o sistema não criará datas/valores artificiais.

### Já realizado

- [x] Parser de vendas horizontais com blocos por data.
- [x] Divisão automática de vendas em lotes de **dias inteiros**.
- [x] Correção de interpretação de datas UTC/horário local.
- [x] Prévia antes de gravar e conferência de lotes.
- [x] Histórico com hash, loja, data, tipo e valor.
- [x] Fluxo de **Desfazer** com justificativa para operações reversíveis.
- [x] Recuperação pontual de vendas legítimas do dia 13/10/2026 após carga errada, conforme trilha específica do piloto.

### Critérios para fechar a etapa de robustez

- [ ] Testes de ponta a ponta com planilhas **reais anonimizadas** de todos os quatro tipos.
- [ ] Validação automatizada dos totais antes/depois de cada carga por categoria.
- [ ] Mensagens mais didáticas para layout incorreto, coluna faltante e tipo de relatório incompatível.
- [ ] Histórico completo com filtros por período, usuário, tipo, sucesso e reversão.
- [ ] Avaliar reversão assistida de cargas substitutivas complexas, **sem permitir exclusão insegura**.
- [ ] Teste de regressão de imports de grande volume e chamadas lentas.
- [ ] Pipeline de deploy/testes que só publique versão com `/` e assets respondendo corretamente.

**Exemplo de aceite:** um arquivo original de Vendas com 7 dias é importado de uma vez, e os totais/datas do ERP coincidem com os resumos do Supabase sem intervenção no Excel.

---

## Fase 2 — Produto 360° · Próxima funcionalidade analítica

**Objetivo:** pesquisar um SKU e obter um consolidado transversal, não apenas localizar o mesmo produto em telas separadas.

### Escopo proposto

| Bloco | O que mostrar |
|---|---|
| Cadastro | SKU, descrição, departamento, situação e loja |
| Receita | Valor vendido, quantidade e tendência no período |
| Quebras | Perdas reconhecidas por espécie/motivo, valores e quantidade |
| Inventário | Faltas, sobras, saldo líquido e recorrências |
| Consolidado | Quebra reconhecida + faltas − sobras |
| Relação com vendas | % de perda sobre **vendas comparáveis** |
| Histórico | Linha do tempo de vendas, ocorrências e contagens |
| Origem dos números | Acesso ao movimento/lote responsável por cada subtotal |

**Entrada:** busca central por SKU/descrição e abertura ao clicar em um produto de outras tabelas. **Não está concluída** no estado atual do projeto.

**Critério de aceite:** para um mesmo SKU, loja e intervalo, os subtotais da ficha devem coincidir com os módulos individuais, respeitando cobertura temporal e evitando multiplicação de linhas por joins.

---

## Fase 3 — Trocas 2.0 · Fluxo por fornecedor e tratativa

**Base já existente:** Fornecedor 360°, filtros por marca, fornecedor, SKU e categoria; posição atual; CSV para vendedor; fornecedores sem regra cadastrada.

**Evoluções possíveis:**

- [ ] Separar mais claramente **Nota de Devolução** versus **Elas por Elas/Produto por Produto**, Bonificação e Mista.
- [ ] Controle de pendências, tratativa, responsável, prazo e documentos por fornecedor.
- [ ] Comparação de snapshots para identificar entrada/saída de itens do saldo de trocas.
- [ ] Auditoria de fornecedores com cadastro incompleto e fluxo de regularização.
- [ ] Exportação por vendedor/fornecedor com status e datas de acompanhamento.
- [ ] Indicador de idade do estoque de troca e recuperação financeira, **quando houver dados para isso**.

**Critério de aceite:** filtrar um fornecedor/marca e gerar relatório coerente com a posição atual, sem misturar saldo vigente com posições históricas.

---

## Fase 4 — Análise avançada de giro, recorrência e alertas

**Dados necessários:** estoque atual confiável, entradas/compras, vendas em quantidade, validade quando disponível e frequência de atualização.

- [ ] Giro e cobertura de estoque por SKU.
- [ ] Risco de vencimento e excesso de compra/produção, com regras por perecibilidade.
- [ ] Recorrência de perda de baixo valor unitário e impacto acumulado.
- [ ] Alertas de quebra acima da meta e anomalias simples explicáveis.
- [ ] Painel de atenção por setor/produto com motivo do alerta.
- [ ] Comparação pré/pós intervenção com critérios de amostra e período.

**Limite:** não prometer recomendações automáticas de compra sem estoque e movimentações de origem bem definidos.

---

## Fase 5 — Plano de ação e gestão da execução

Proposta de migrar de “constatamos uma perda” para “corrigimos e medimos o resultado”:

- [ ] Registro de ação com SKU/departamento, causa, responsável, prazo e status.
- [ ] Campos para 5 Porquês, 5W2H, PDCA/Kaizen (quando úteis ao caso).
- [ ] Vinculação da ação aos indicadores de origem.
- [ ] Acompanhamento de resultado antes e depois.
- [ ] Histórico e auditoria de quem alterou a ação.

**Critério de aceite:** cada plano permite recuperar o indicador que o motivou e quantificar efeito ou justificar por que não foi possível atribuir resultado.

---

## Fase 6 — Integração com ERP/API e automação

**Ainda não implementado:** atualmente as importações são feitas manualmente a partir de arquivos exportados do ERP.

O caminho de maturidade seria:

1. Mapear contratos de dados e políticas de acesso do ERP.
2. Criar extrator seguro (API ou integração autorizada) fora do browser.
3. Agendar ETL com retries, checkpoint, idempotência e conciliação.
4. Validar divergências de totais e tempos de atualização.
5. Versionar layouts/mapeamentos por unidade/fonte.
6. Criar observabilidade (falhas, latência, último sucesso por categoria).

**Critério de aceite:** uma fonte integrada atualiza dados sem intervenção humana, informa claramente a data da última atualização e nunca contamina períodos anteriores numa falha parcial.

---

## Fase 7 — Expansão multiloja e produto institucional

- [ ] Homologar cada unidade com cadastros, metas e categorias operacionais específicas.
- [ ] Revisar papéis de acesso, incluindo eventual administração multiloja.
- [ ] Padronizar relatórios do ERP entre filiais.
- [ ] Comparador regional/da rede, sem expor dados indevidos entre usuários.
- [ ] Políticas formais de backup, retenção, recuperação e implantação.
- [ ] Testes de desempenho com dados reais anonimizados e volume da rede.

**Não ampliar somente trocando o número da loja.** A segurança deve permanecer do lado do banco; dashboards precisam separar parâmetros de cada unidade.

---

## Indicadores de sucesso do produto

| Eixo | Como avaliar |
|---|---|
| Qualidade do dado | Diferença entre total ERP e Supabase; duplicidades e datas incorretas |
| Adoção operacional | Tempo entre exportação e análise; número de correções manuais |
| Rastreabilidade | % de cargas com lote, usuário, motivo e status consultáveis |
| Investigação | Tempo necessário para localizar um SKU/problema prioritário |
| Resultados | Redução de perdas após ações com controle adequado |
| Confiabilidade técnica | Erros de importação/deploy, testes de regressão e disponibilidade |
| Expansão | Filiais homologadas com controle por loja e metas parametrizadas |

## Política de documentação

Ao finalizar uma funcionalidade, atualizar **[README](../README.md)**, **[Arquitetura](ARQUITETURA.md)** ou **[ETL](ETL_E_IMPORTACOES.md)** conforme o impacto. Mover itens planejados para “implantados” somente após conferir o código, a função SQL, a autorização e o funcionamento no ambiente publicado.
