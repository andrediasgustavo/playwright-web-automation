# Pipeline de CI/CD e Quality Gates

> Documentação do pipeline de integração contínua, dos quality gates locais e
> dos git hooks deste repositório. Última atualização: **26/10/2026**.

## 1. Visão geral

O repositório combina três camadas de garantia de qualidade:

1. **CI (GitHub Actions)** — workflows que validam cada push/PR no servidor.
2. **Quality gates locais** — scripts `npm` que o dev roda antes de commitar.
3. **Git hooks** — validações automáticas no `commit`, sem depender de disciplina manual.

As três camadas usam **os mesmos comandos** (`npm run gates`, `npm run lint`,
`npm run format:check`, `npm run typecheck`, `npm test`), então o que roda
localmente é exatamente o que o CI valida.

---

## 2. Workflows de CI (`.github/workflows/`)

### `quality.yml` — Quality Gates (push/PR/dispatch)

Job `static-checks` (roda em todo push/PR, ~2 min, sem browsers):

1. `npm ci` — valida lockfile sincronizado (falha se divergir do `package.json`)
2. `npm run gates` — script próprio (`scripts/quality-gates.mjs`): anti-padrões
   de teste (`test.only`, `waitForTimeout`, `page.pause()`, `networkidle`,
   `console.log`, URL absoluta em `goto`), nomenclatura `*.spec.js`/`*.page.js`,
   JSONs válidos, guards do `playwright.config.js`
3. `npm run typecheck` — `tsc --noEmit` (checkJs em todo o código)
4. `npm run lint` — ESLint + `eslint-plugin-playwright`
5. `npm run format:check` — Prettier
6. `npm audit --audit-level=high` — vulnerabilidades conhecidas bloqueiam
7. `actionlint` — lint dos próprios workflows YAML

Job `secret-scanning`: **gitleaks** varre o histórico em busca de segredos
commitados acidentalmente.

### `pr-checks.yml` — PR Checks (pull_request)

- **Título do PR** deve seguir Conventional Commits
  (`amannn/action-semantic-pull-request`); tipos aceitos: `feat fix docs style
refactor perf test build ci chore revert qa`.
- **Mensagens de commit** do PR são validadas contra o mesmo padrão (merge/
  revert/fixup/squash são ignorados).

### `playwright.yml` — Playwright Tests

| Gatilho                                   | O que roda                                                |
| ----------------------------------------- | --------------------------------------------------------- |
| `push` em `main`/`master`                 | job **smoke** (chromium, `@smoke`)                        |
| `pull_request` para `main`/`master`       | job **smoke** (chromium, `@smoke`)                        |
| `schedule` (cron `0 3 * * *`, diário 03h) | job **full** (matriz chromium/firefox/webkit em paralelo) |
| `workflow_dispatch` (manual)              | job **full** (matriz 3 browsers)                          |

Proteções embutidas:

- **`concurrency`** — cancela runs duplicados do mesmo branch/PR.
- **Cache** — npm (`setup-node cache`) e browsers (`~/.cache/ms-playwright`
  chaveado pelo lockfile).
- **Preflight da AUT** — `curl` no `BASE_URL` antes dos testes: se o site
  externo estiver fora, o job falha rápido com mensagem de infra (não parece
  falha de código). `BASE_URL` é sobrescrevível via GitHub vars.
- **Artefatos** — `playwright-report/` + `test-results/` (traces/screenshots):
  no smoke só em falha (7 dias); no full sempre (30 dias), por browser.

### `dependabot.yml` — Atualização de dependências

- **npm**: semanal, até 10 PRs abertos.
- **github-actions**: semanal.

---

## 3. Quality gates locais (scripts `npm`)

| Script                    | O que faz                                                   |
| ------------------------- | ----------------------------------------------------------- |
| `npm run gates`           | `scripts/quality-gates.mjs` — anti-padrões/naming/configs   |
| `npm run lint`            | ESLint em todo o repo (regras + `eslint-plugin-playwright`) |
| `npm run lint:fix`        | ESLint corrigindo o que puder automaticamente               |
| `npm run format`          | Prettier formatando o repo inteiro (`--write`)              |
| `npm run format:check`    | Prettier verificando (sem alterar; falha se divergir)       |
| `npm run typecheck`       | `tsc --noEmit` — checagem de tipos                          |
| `npm test`                | suíte completa Playwright                                   |
| `npm run test:smoke`      | testes `@smoke`                                             |
| `npm run test:regression` | testes `@regression`                                        |

> **Estilo do código**: o repo usa aspas simples e **sem ponto-e-vírgula**.
> ESLint e Prettier estão configurados para travar esse estilo (`semi: never`,
> `singleQuote: true`, `avoidEscape`) — não reformate os arquivos para outro
> padrão.

> **Pin de versões**: `typescript` e `@types/node` estão pinados
> (`~5.6.3` / `~22.10.2`) — `typescript@5.9.x` apresentou hang ambiental neste
> setup. Não "atualize" sem testar `npm run typecheck` antes.

---

## 4. Git hooks (Husky + lint-staged + commitlint)

Ativados automaticamente pelo `npm install` (`prepare: husky`).

### `pre-commit`

Roda `lint-staged` apenas nos arquivos _staged_:

- `*.{js,mjs,cjs,json,md}` → `prettier --write`
- `*.js` → `eslint --fix`

### `commit-msg`

Valida a mensagem do commit com **Conventional Commits** (`commitlint`):

```
tipo(escopo): descrição

tipos: feat | fix | chore | docs | refactor | test | ci | build | perf | style | revert | qa
```

---

## 5. Fluxo recomendado antes de commitar

```sh
npm run gates         # 1. anti-padrões e configs
npm run lint          # 2. lint
npm run format:check  # 3. formatação
npm run typecheck     # 4. tipos
npm test              # 5. testes
```

O `pre-commit` cuida de formatar/lintar o que você _staging_ automaticamente, e
o `commit-msg` rejeita mensagens fora do padrão Conventional Commits. O CI
repete as mesmas validações em cada push/PR.

---

## 6. Branch protection (configurar no GitHub — precisa de admin)

Em **Settings → Branches → Branch protection rules** para `main`:

- [x] Require a pull request before merging
- [x] Require status checks to pass — marcar como **required**:
  - `Static checks` (quality.yml)
  - `Secret scanning (gitleaks)` (quality.yml)
  - `Smoke (chromium, @smoke)` (playwright.yml)
  - `Conventional PR title` (pr-checks.yml)
  - `Conventional commit messages` (pr-checks.yml)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
