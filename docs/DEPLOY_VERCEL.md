# Publicação, Vercel e operação do frontend

[← README](../README.md) · [Arquitetura](ARQUITETURA.md) · [ETL](ETL_E_IMPORTACOES.md) · [Roadmap](ROADMAP.md)

## Ambiente atual

| Componente | Local |
|---|---|
| **Frontend público do piloto** | https://z-ai-dashboard-preview.vercel.app/ |
| **Repositório e histórico de versões** | https://github.com/terpsandlups/Z-AI-Dashboard |
| **Banco e autenticação** | Supabase (PostgreSQL + Authentication + RPCs) |
| **Empresa/unidade piloto** | Grupo MONTEKALI · Loja 007 — Kalimera Japy |

**Papel da Vercel:** entregar os arquivos **HTML, CSS, JavaScript** do painel. A Vercel **não** guarda as vendas, perdas, auditorias ou posições de Trocas. Dados persistem no PostgreSQL do Supabase.

**Estado da implantação em outubro de 2026:** a publicação do piloto foi feita inclusive por chamadas **manuais à API da Vercel**, sem garantia de deploy automático por commit no GitHub. A página raiz foi testada por consulta HTTP após corrigir o diretório publicado. Se outra publicação ocorrer, **revalidar o endereço**.

---

## 1. Dois modos de publicação

### A. Publicação estática direta (usada para recuperar o site)

A saída pública é composta pelos **arquivos de `web/` na raiz do deployment**, com a configuração pública `config.js` incluída no artefato de publicação:

```text
/
├── index.html
├── app.js
├── core.js
├── ui.js
├── style.css
├── corporate.css
├── analytics.css
├── product360.js
├── product360.css
└── config.js   # somente URL pública + chave publishable
```

**O erro clássico:** publicar `src/web/index.html` ou `src/src/web/index.html` sem configurar o diretório de saída. O deployment pode indicar **READY**, mas `/` responder **404 NOT_FOUND**. Foi uma falha real enfrentada no piloto.

A configuração `config.js` contém apenas dados públicos necessários ao cliente. Nunca inclua `MONTEKALI_DB_URL`, senha SQL, `service_role` ou outras chaves secretas.

### B. Build reproduzível do repositório (caminho recomendado a homologar para CI)

O repositório inclui `tools/build_frontend.py`, que:

1. Confere `SUPABASE_URL` (HTTPS válido).
2. Confere `SUPABASE_PUBLISHABLE_KEY` (formato publishable).
3. Copia o conteúdo de `web/` para `dist/`, sem copiar `web/config.js` local.
4. Gera `dist/config.js` com **apenas** variáveis públicas.

Para gerar localmente:

```bash
# Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY em ambiente seguro
python tools/build_frontend.py
```

**Saída esperada:** `dist/index.html`, arquivos JS/CSS e `dist/config.js`. Não publicar a pasta inteira do repositório nem `data/`.

Uma eventual configuração de Git Deployment na Vercel deve ser homologada para apontar à **raiz do repositório**, executar `python3 tools/build_frontend.py` e publicar **`dist`**. **Não confundir essa configuração proposta com uma integração Git já ativa/comprovada.**

O arquivo `netlify.toml` é uma alternativa de hospedagem já versionada; **não define o build da Vercel**.

---

## 2. Checklist antes de publicar

- [ ] Repositório e branch/commit conferidos.
- [ ] Build gerou `index.html` na **raiz da pasta de publicação**.
- [ ] `config.js` contém apenas **URL Supabase e publishable key**.
- [ ] Nenhum backup, arquivo `.xlsx`, dado operacional, credencial ou `.env` entrou no pacote.
- [ ] O projeto correto da Vercel está selecionado: `z-ai-dashboard-preview`.
- [ ] O deploy está direcionado ao ambiente pretendido (preview ou production).
- [ ] Testes de cálculo/importação foram executados antes do release.
- [ ] Há plano de retorno à última versão validada.

Se uma publicação com arquivos diretos for utilizada, **não presumir** que o build Python será executado. O caminho de origem do código e o diretório de saída dependem da estratégia de deploy.

---

## 3. Checklist depois de publicar (obrigatório)

**READY é status de infraestrutura/build, não comprovação de que o dashboard abre.** Execute os testes:

| Requisição | Esperado |
|---|---|
| `GET /` | **HTTP 200** e título **Z-AI-Gestão Visual** |
| `GET /index.html` | **HTTP 200** |
| `GET /app.js`, `/core.js`, `/ui.js`, `/product360.js` | **HTTP 200**, conteúdo JavaScript |
| `GET /style.css`, `/corporate.css`, `/analytics.css`, `/product360.css` | **HTTP 200**, CSS |
| `GET /config.js` | **HTTP 200**, config pública |
| Login com usuário de teste autorizado | Consulta apenas loja permitida |
| Dashboard executivo | Carrega vendas/perdas e cobertura da filial |
| Central de Importações | Prévia sem escrita até confirmação; histórico protegido |

Exemplo de teste HTTP:

```bash
curl -I https://z-ai-dashboard-preview.vercel.app/
curl -I https://z-ai-dashboard-preview.vercel.app/index.html
curl -I https://z-ai-dashboard-preview.vercel.app/app.js
```

**Atenção:** testar a página pública não valida automaticamente login, autorização, gravação de lotes ou reversão. Estes exigem sessão de homologação.

---

## 4. Diagnóstico de problemas

| Sintoma | Diagnóstico recomendado |
|---|---|
| **404 NOT_FOUND** apesar de READY | Conferir diretório publicado, posição de `index.html` e associações de alias/domínio |
| **Login não aparece ou JS quebra** | Conferir HTTP de `app.js`, `core.js`, `ui.js` e console do navegador |
| **“Não conectado”** | Conferir `config.js`, URL pública e publishable key |
| **Falha 401/403 nas RPCs** | Verificar sessão, acesso do usuário à loja e papel atribuído no Supabase |
| **Dados antigos** | Atualizar snapshot/recarregar página; confirmar revisão no banco e loja selecionada |
| **Gravação recusada por versão** | Atualizar o dashboard e revisar a prévia; evitar sobrescrever mudança concorrente |
| **Data deslocada um dia** | Confirmar parser/normalização UTC e testar com arquivo real |
| **Erro de importação de grande volume** | Conferir divisão em lotes e dias completos; verificar detalhes de falha da RPC |
| **404 apenas no domínio principal** | Conferir alias do domínio contra deployment READY correto |

### Quando usar rollback

Se o frontend novo quebrar, retornar ao último deployment **testado e funcional** pode restaurar a interface. Rollback de frontend **não reverte movimentos no Supabase**. Reversões de importação são outras operações, executadas separadamente com conferência e permissão.

---

## 5. Segurança e manutenção

- **Publicação:** pode ser estática e pública; dados só devem ser acessíveis depois de autenticação e autorização.
- **Autorização:** validação sensível nas RPCs SQL, nunca somente escondendo um botão no JS.
- **Segredos:** usar variáveis apropriadas e manter somente chaves publishable no navegador.
- **Auditoria:** não excluir tabelas de histórico nem limpar lotes por “organização”.
- **GitHub:** commits versionam código, documentam correções e permitem revisão.
- **Banco:** operações transacionais com revisão, checagem por loja e rastreamento de lote.
- **Expansão:** antes de levar a outras filiais, validar políticas de acesso e formatos de entrada.

## 6. Próximo aprimoramento de DevOps

Hoje existe caminho funcional de deploy e scripts de teste, mas uma evolução desejável é um processo consistente:

```text
Commit no GitHub
    ↓
Validação automática dos arquivos e testes
    ↓
Build reproduzível de dist/
    ↓
Preview Vercel sem publicar no domínio principal
    ↓
Smoke tests HTTP + interface + login de teste
    ↓
Publicar/Promover com rastreabilidade
```

Isso reduziria o risco de marcar como concluída uma versão READY que devolve 404.

[Ver roadmap completo →](ROADMAP.md)
