# Z-AI-Gestão Visual

Dashboard Executivo de vendas, perdas e metas. Frontend estático em JavaScript,
CSS e HTML; PostgreSQL/Supabase para autenticação, persistência e acesso por loja.
## Piloto e expansão

A **Loja 007 — Kalimera Japy** é a base piloto de testes. O objetivo é evoluir
para todas as lojas, com autorização de acesso e configuração próprias por filial.

- **Meta diária de vendas:** definida por loja, no campo `baseline.meta_diaria`.
- **Meta de perdas:** percentual sobre a venda, definido conforme o comportamento
  e a operação da loja, no campo `baseline.meta_perda`. É uma fração decimal.
- **Realizado:** perdas reconhecidas ÷ vendas no mesmo período e escopo.
- **Limite em reais:** vendas × percentual de meta configurado da loja.
- **Departamentos:** podem receber metas específicas. Sem meta setorial, a
  comparação usa a referência da própria loja; sem configuração, mostra indisponível.
- **Regras operacionais:** devem ser validadas conforme a operação de cada unidade.
  O sistema não deduz automaticamente a meta ideal a partir do histórico.

As configurações são mantidas por loja em `montekali.configuracao_painel` e
retornadas pelo snapshot autorizado. Nesta fase, a edição é administrativa;
não há formulário de configuração de metas no frontend. O calendário atual usa
os dias corridos do período coberto; calendários operacionais particulares são evolução futura.
Os importadores históricos legados continuam específicos do piloto e precisam de
adaptação validada antes de uso em outras lojas. A interface e as consultas já
respeitam a filial selecionada e suas permissões.

## Estado da entrega

Este repositório contém o código do painel e não contém backups,
planilhas, movimentos comerciais nem senha administrativa. Ele não restaura dados
automaticamente nem comprova que as migrações já foram executadas no ambiente de produção.

Menus: Resumo Executivo, Perdas Reconhecidas, Vendas, Comparativos, Auditorias,
Perdas Consolidadas, Estoque de Trocas e Importar/Exportar. Auditorias, consolidação
e trocas aguardam contratos de dados reais; a interface não aceita cargas nessas categorias.

Perdas Reconhecidas mostra todos os lançamentos da competência, mesmo depois do
último dia com vendas completas. Nessa situação o percentual fica indisponível.
Resumo e Comparativos usam o corte comum informado na tela. Inativos mantêm seu
histórico. O diário substitui o mensal no cálculo quando tem cobertura completa;
as duas fontes nunca são somadas. Médias semanais incluem dias cobertos sem venda.

## Rodar localmente

1. Copie `web/config.example.js` para `web/config.js`.
2. Preencha somente a URL do projeto Supabase e a chave **publishable**.
3. Execute `INICIAR_PAINEL.bat`, ou:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory web
```

Abra http://localhost:8000. Entre com a conta de Authentication autorizada para
a filial. A opção de conferência local abre uma **base analítica Z-AI v2**.
Backups legados precisam ser conciliados antes; podem conter somente perdas.

## Banco existente

Preserve o banco em uso. Se a versão anterior ainda não estiver ativada, execute
`database/03_painel_v2.sql`. Depois execute `database/08_vendas_diarias_multiloja.sql`.
Crie a conta em Authentication e ajuste o UUID em `database/04_autorizar_usuario.sql`.
As funções validam usuário, filial e papel; não há acesso anônimo aos movimentos.
Não reexecute a criação inicial 01 nem a carga inicial 02 em um banco já preenchido.

Para um ambiente novo, execute 01, valide e importe o backup com 02 (primeiro
simulação, depois `--commit`); então execute 03, 08 e a autorização 04.
O script 02 recusa importar sobre perdas existentes.

```sh
python -m pip install -r requirements.txt
python tools/02_importar_backup.py --backup CAMINHO_PRIVADO.json --validar-arquivo
```

Para conectar os scripts administrativos, configure a variável de conexão indicada nos scripts somente
no ambiente local. Não envie essa conexão para o frontend, GitHub ou chat.
O arquivo `.env.example` documenta nomes; os scripts não carregam `.env` automaticamente.

## Dados e atualizações

Crie `data/` localmente e use os arquivos privados já conferidos:
`base_conferida.json`, `vendas_diarias.csv.gz` e `auditoria_vendas.json`.
Essa pasta é ignorada pelo Git e nunca é publicada.

- Histórico diário de vendas: `python tools/09_carregar_diario_historico.py`.
  Após conferir a simulação, repita com `--commit`. Recusa sobreposição com vendas existentes.
- Vendas futuras: `tools/07_carregar_vendas_diarias.py --help` e o modelo em `templates/`.
- Perdas Excel: `tools/06_converter_perdas.py arquivo.xlsx`; use `--ct-medio-total`
  somente no layout confirmado em que Ct Médio é o total da linha, sem multiplicar pela quantidade.
- No painel, selecione Perdas ou Vendas antes do JSON. Substituição por dia exige
  relatório completo e conserva auditoria. A exportação analítica não substitui
  um backup completo do PostgreSQL.

Conciliação **local** de um novo backup legado com a base analítica:

```sh
python tools/10_atualizar_base_local.py --base data/base_conferida.json --backup data/backup.json --saida data/base_atualizada.json
```

O script preserva vendas, metas, situação dos produtos e ocorrências legítimas
idênticas. Recusa perda de lançamentos anteriores. Não grava no Supabase e não
sobrescreve nenhum arquivo. Sem `--saida`, apenas valida.

## Publicação do frontend

O `netlify.toml` gera e publica somente `dist/`. Configure as variáveis públicas
`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` na hospedagem. O build aceita apenas
chave publishable; não utiliza senha do banco nem service role.

```sh
python tools/build_frontend.py
```

GitHub guarda as versões do código; Supabase guarda os dados. Alterar o código
não deve reimportar ou apagar movimentos. O acesso ao banco em produção depende
da ativação das migrações e da autorização do usuário.

## Verificação

```sh
node tests/calculos.cjs
node tests/componentes.cjs
python -m unittest discover -s tests -p 'test_*.py'
```

Os testes usam dados fictícios e verificam cobertura, comparabilidade, preservação
de perdas, duplicidades legítimas, filtros e componentes. Não são uma revisão
visual em navegador nem um teste integrado com o Supabase. A validação de login,
permissões e gravação deve ocorrer no ambiente de homologação antes da ativação.

Repositório público: **terpsandlups/Z-AI-Dashboard**. Os dados operacionais ficam no Supabase e nos arquivos privados autorizados.
