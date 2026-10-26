# Contexto do Projeto — Estado Atual

> Documento de contexto/handoff: o que existe hoje neste repositório, como
> funciona e o que falta. Última atualização: **25/10/2026**.

## Visão geral

Repositório de **automação web com Playwright** (curso QAZANDO), agora com uma
**infraestrutura de IA** sobre o OpenCode: agentes especializados, skills,
ferramentas próprias (incluindo orquestração de agentes em paralelo) e
**roteamento de modelo por requisição**.

**Aplicação sob teste:** QAZANDO Shop E-Commerce — https://www.automationpratice.com.br/

---

## 1. Estrutura de arquivos

```text
AGENTS.md                         instruções do projeto para agentes (portável / agents.md)
.agents/skills/                   SKILL.md (formato portável, lido por vários harnesses)
  playwright-conventions/         layout, locators, waits, asserções
  playwright-test-authoring/      workflow para escrever specs
  playwright-failure-triage/      classificação/root-cause de falhas
  parallel-agent-orchestration/   como dividir trabalho entre subagentes + roteamento
.opencode/
  opencode.jsonc                  config do OpenCode (modelo padrão, permissões, MCP, worktrees)
  qa-routing.json                 config de ROTEAMENTO (choices/critérios, tiers, router)
  agents/                         7 agentes (qa-lead + 6 especialistas)
  commands/                       /new-spec /smoke /triage /parallel /review-tests
  plugins/qa-orchestrator/        plugin com as ferramentas qa_*
docs/
  plano-de-testes-login-cadastro.md   plano + cenários + casos (login e cadastro)
  contexto-do-projeto.md              este arquivo
pages/                            page objects (base.page.js, login.page.js, cadastro.page.js)
tests/                            specs Playwright (login.spec.js, cadastro.spec.js)
tests/fixtures/                   fixtures/dados de teste (usuarios.js)
```

---

## 2. Infraestrutura de IA (OpenCode)

### 2.1 Config — `.opencode/opencode.jsonc`

- `model`: `openrouter/typesafe/jev-router` (padrão do projeto)
- `default_agent`: `qa-lead`
- `providers.openrouter.models["typesafe/jev-router"]`: registro do Jev Router
  (não existe no models.dev, por isso é declarado à mão; `tools: true`)
- `permissions`: leitura/edição/skills/subagentes liberados; shell liberado com
  `ask` para `rm -rf *`, `git push *`, `git reset --hard *`, `npm publish *`
- `experimental`: `todo: true`, `subagent_depth: 2`, `background_compaction: true`
- `mcp.servers.playwright`: MCP local (`npx -y @playwright/mcp@latest`) → 25
  ferramentas de browser usadas para explorar o site
- `worktree.directory`: `.worktrees`
- `formatter: true`

### 2.2 Agentes (`.opencode/agents/`)

| Agente           | Modo             | Modelo                      | Papel                             |
| ---------------- | ---------------- | --------------------------- | --------------------------------- |
| `qa-lead`        | primary (padrão) | herda o padrão (Jev Router) | planeja e orquestra               |
| `spec-author`    | subagent         | deepseek-v4.1-flash         | escreve specs (`tests/`)          |
| `page-object`    | subagent         | deepseek-v4.1-flash         | escreve page objects (`pages/`)   |
| `test-runner`    | subagent         | deepseek-v4.1-flash         | executa suites, devolve resultado |
| `bulk-writer`    | subagent         | deepseek-v4.1-flash#none    | edições mecânicas, dados, renames |
| `failure-triage` | subagent         | deepseek-v4-pro-0813#high   | root-cause de falhas/flaky        |
| `test-reviewer`  | subagent         | deepseek-v4.1-flash         | revisão read-only                 |

### 2.3 Skills (`.agents/skills/`)

Movidas de `.opencode/skills/` para `.agents/skills/` por **portabilidade**
(OpenCode, Claude Code e outros reconhecem o caminho; `AGENTS.md` idem).

### 2.4 Ferramentas — plugin `.opencode/plugins/qa-orchestrator/index.ts`

Namespace `qa`, com `codemode: true`:

| Ferramenta            | Para que serve                                                    |
| --------------------- | ----------------------------------------------------------------- |
| `qa_pick_model`       | resolve modelo por tier / lista os mais baratos capazes           |
| `qa_route_request`    | classifica 1 requisição → tier + modelo + motivo                  |
| `qa_routing_log`      | decisões recentes de roteamento + modelo real usado               |
| `qa_parallel_agents`  | dispara N subagentes em paralelo e coleta o relatório             |
| `qa_parallel_control` | `list` / `message` / `interrupt` de subagentes                    |
| `qa_run_tests`        | roda Playwright e devolve resultado estruturado (counts + falhas) |

Detalhes de implementação relevantes:

- `qa_run_tests` usa o CLI local via `node ./node_modules/@playwright/test/cli.js`
  (fallback `npx`). **`process.execPath` dentro do plugin é o binário do OpenCode,
  não o Node** — não usar.
- `qa_parallel_agents` cria sessões filhas, define agente + modelo, aguarda e lê o
  último texto do assistente.

### 2.5 Comandos (`.opencode/commands/`)

`/new-spec`, `/smoke`, `/triage`, `/parallel`, `/review-tests`.

### 2.6 AGENTS.md

Instruções curtas: layout, regras (locators acessíveis, sem `waitForTimeout`,
sem `test.only`, não commitar sem pedir), "delegar por padrão", tabela de
ferramentas e comandos.

---

## 3. Roteamento de modelo

Objetivo: escolher o modelo por requisição, gastando menos, e **enxergar qual
modelo roda**.

### 3.1 O que é o "Jev"

- **Jev** = _System One_ da TypeSafe: modelo de **classificação** com primitivas
  `choice` / `score` / `noul` e confiança calibrada. Docs:
  https://docs.typesafe.ai/introduction/quickstart
- Dois jeitos de usar:
  1. **API TypeSafe direta** (`https://api.typesafe.ai/v1/systemone`, auth
     `Bearer $TYPESAFE_API_KEY`) — exige chave TypeSafe.
  2. **`openrouter/typesafe/jev-router`** no OpenRouter — usa a chave do
     **OpenRouter** (sem chave TypeSafe). É um roteador que escolhe modelo +
     esforço por requisição.

### 3.2 Config de roteamento — `.opencode/qa-routing.json`

```jsonc
{
  "router": "jev", // jev | llm | off
  "routerModel": "openrouter/typesafe/jev-router", // classificador (fallback LLM)
  "typesafeModel": "jev-latest",
  "typesafeEndpoint": "https://api.typesafe.ai/v1/systemone",
  "instructions": "Which cost tier should handle this software/QA task",
  "criteria": { "cheap": "...", "standard": "...", "deep": "..." }, // as CHOICES do Jev
  "models": { "cheap": "...", "standard": "...", "deep": "..." }, // tier -> modelo
}
```

Precedência: **padrões embutidos < `qa-routing.json` < variáveis de ambiente**.

Tiers atuais:

- `cheap` → `openrouter/deepseek/deepseek-v4.1-flash`
- `standard` → `openrouter/deepseek/deepseek-v4-pro-0813`
- `deep` → `openrouter/qwen/qwen3.8-max-0902`

### 3.3 Como funciona por requisição

Com o padrão atual (**pré-roteamento ligado**):

1. Você envia um pedido.
2. O plugin classifica o texto (Jev via OpenRouter / fallback LLM) → tier.
3. O plugin **troca o modelo da sessão** antes de rodar (`switchModel`).
4. O pedido roda no modelo do tier e a **linha de status da TUI mostra o modelo**
   (ex.: `qa-lead · qwen/qwen3.8-max-0902`). ✔ indicador ao vivo, sem UI extra.

Delegação: `qa_parallel_agents` roteia **cada task** por tier (mesmo motor).

### 3.4 Variáveis de ambiente

| Variável                                                 | Efeito                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `QA_ROUTER`                                              | `jev` \| `llm` \| `off`                                    |
| `QA_ROUTER_MODEL`                                        | modelo do classificador (fallback LLM)                     |
| `QA_CHEAP_MODEL` / `QA_STANDARD_MODEL` / `QA_DEEP_MODEL` | modelos por tier                                           |
| `QA_ROUTING`                                             | `auto` \| `off` no `qa_parallel_agents`                    |
| `QA_PRE_ROUTE`                                           | `0` desliga o pré-roteamento (a sessão fica no jev-router) |
| `QA_TRACE_MODEL`                                         | `0` desliga a captura do modelo real                       |
| `QA_ANNOUNCE`                                            | `1` também posta o aviso na sessão (⚠ ver gotchas)         |
| `QA_DEBUG`                                               | `1` loga decisões no log do servidor                       |
| `QA_ROUTING_FILE`                                        | caminho alternativo do `qa-routing.json`                   |
| `TYPESAFE_API_KEY` / `TYPESAFE_API_KEY_FILE`             | chave do Jev (API direta)                                  |
| `TYPESAFE_MODEL` / `TYPESAFE_ENDPOINT`                   | sobrescrevem o alvo do Jev                                 |

---

## 4. Visibilidade / debug

| Recurso                                            | O que mostra                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Linha de status da TUI**                         | `agente · modelo` — com pré-roteamento, mostra o modelo que vai rodar         |
| `qa_routing_log`                                   | decisões recentes: tier, modelo, motivo e **modelo real** capturado do stream |
| `opencode stats --models --cost --project .`       | tokens, passos e custo por modelo                                             |
| `tail -f ~/.local/share/opencode/log/opencode.log` | log do servidor                                                               |
| OpenRouter → Activity                              | modelo + custo por requisição (fonte autoritativa do roteador)                |

O plugin captura o **modelo real** lendo o campo `"model"` do stream SSE do
OpenRouter (hook `http.response`), pois o OpenCode só enxerga `typesafe/jev-router`.

---

## 5. Testes (site alvo)

Plano completo em **`docs/plano-de-testes-login-cadastro.md`**.

Resumo verificado no site (via Playwright MCP, 25/10/2026):

- Login: `#user` (E-mail*), `#password` (Senha*), checkbox "Lembrar de mim",
  botão `login`. Valida formato (`invalid_input` → "E-mail inválido." /
  "Senha inválida."). Sucesso → SweetAlert "Login realizado / Olá, {email}" →
  `/my-account`.
- Cadastro: `#user` (Nome*), `#email`, `#password`, botão `Cadastrar`. Sucesso →
  SweetAlert "Cadastro realizado! / Bem-vindo {nome}" → `/my-account`.
- **A app é um mock 100% client-side** (sem requisições de rede): o login **não
  valida credenciais**.
- **Provável defeito (S2):** cadastro com campos vazios ou e-mail inválido não
  exibe **nenhuma** mensagem (inconsistente com o login).

---

## 6. Decisões e gotchas técnicos

- **`.agents/skills` em vez de `.opencode/skills`** — portabilidade entre harnesses.
- **Modelo padrão = jev-router** (OpenRouter): roteia dentro do provedor; por isso
  a TUI não mostraria o modelo real → resolvido com **pré-roteamento** (o plugin
  decide o tier e troca o modelo → a TUI mostra).
- **`process.execPath`** no plugin = binário do OpenCode (usar `node`).
- **`console.error`/`console.log` de plugin não vão para o `opencode.log`** —
  não confiar neles para log.
- **Mensagem `synthetic` acorda o modelo** (gera turno extra e polui): por isso
  `QA_ANNOUNCE` fica **desligado** por padrão; o indicador é a linha de status.
- **Jev Router não está no models.dev** → registrado manualmente em
  `providers.openrouter.models`.
- Config do OpenCode recarrega sozinha ao salvar; `opencode reload` força.

---

## 7. Comandos úteis

```sh
# trocar de agente na TUI: Shift+Tab (cicla) ou Ctrl+X depois A (lista)
# listar modelos: Ctrl+X depois M

opencode reload                                   # recarrega config
opencode stats --models --cost --project .        # uso/custo por modelo
opencode run --auto "mensagem"                    # rodar um turno sem TUI
opencode api get "/api/skill?location%5Bdirectory%5D=$(pwd)"   # listar skills
opencode service restart                          # reiniciar o servidor background

tail -f ~/.local/share/opencode/log/opencode.log

npx playwright test                               # suites
npx playwright test --list                        # validar que specs carregam
npx playwright show-report
```

---

## 8. Estado atual e pendências

**Git:** trabalho commitado em série de commits lógicos (refactor de POMs,
specs conformadas ao comportamento real, tooling de qualidade, CI, docs,
infra de agentes). Detalhes no histórico (`git log --oneline`).

**Pendências / próximos passos:**

1. ✅ Concluído — `use.baseURL` definido no `playwright.config.js`
   (`https://www.automationpratice.com.br`, com override via `BASE_URL`), para
   usar caminhos relativos nos specs.
2. ✅ Concluído — `pages/base.page.js`, `pages/login.page.js` e
   `pages/cadastro.page.js` implementados.
3. ✅ Concluído — `tests/login.spec.js` e `tests/cadastro.spec.js` criados a
   partir dos casos do plano.
4. ✅ Concluído — suíte rodou verde (42/42 nos 3 browsers); o defeito do
   cadastro (S2) foi triado: CT-CAD-02/03 agora documentam o comportamento
   REAL (submissão silenciosa, sem feedback) como testes normais — sem
   `test.fail`/`test.fixme`. Quando o site for corrigido, esses testes falham
   e devem ser promovidos para "espera feedback".
5. ✅ Concluído — pipeline de qualidade: `scripts/quality-gates.mjs`
   (`npm run gates`), ESLint + `eslint-plugin-playwright`, Prettier,
   `tsc --noEmit` (typescript pinado em 5.6.3 — 5.9.x dá hang neste setup),
   Husky + lint-staged + commitlint (Conventional Commits).
6. ✅ Concluído — CI robusto: `quality.yml` (gates, typecheck, lint, format,
   `npm audit`, actionlint, gitleaks), `pr-checks.yml` (título de PR e
   commits convencionais), `playwright.yml` (smoke em push/PR + matriz full
   noturna, concurrency, caches, preflight da AUT, artefatos com traces) e
   Dependabot (npm + actions). Ver `docs/ci-pipeline.md`.
7. Aplicar **branch protection** no GitHub (checklist em
   `docs/ci-pipeline.md` §6 — precisa de admin).
8. (Opcional) Adicionar chave TypeSafe para usar o Jev direto (`TYPESAFE_API_KEY`).
9. (Futuro) Novos planos de teste: recuperação de senha, carrinho/checkout,
   wishlist; `pages/my-account.page.js` quando a área logada for coberta.
