# CI/CD Pipeline and Quality Gates

> Documentation of the continuous-integration pipeline, the local quality gates
> and the git hooks of this repository. Last updated: **26/10/2026**.

## 1. Overview

The repository combines three layers of quality assurance:

1. **CI (GitHub Actions)** — workflows that validate every push/PR on the server.
2. **Local quality gates** — `npm` scripts the developer runs before committing.
3. **Git hooks** — automatic validations at `commit` time, without relying on manual discipline.

The three layers use **the same commands** (`npm run gates`, `npm run lint`,
`npm run format:check`, `npm run typecheck`, `npm test`), so what runs locally
is exactly what CI validates.

---

## 2. CI workflows (`.github/workflows/`)

### `quality.yml` — Quality Gates (push/PR/dispatch)

Job `static-checks` (runs on every push/PR, ~2 min, no browsers):

1. `npm ci` — validates the lockfile is in sync (fails if it diverges from `package.json`)
2. `npm run gates` — custom script (`scripts/quality-gates.mjs`): test
   anti-patterns (`test.only`, `waitForTimeout`, `page.pause()`, `networkidle`,
   `console.log`, absolute URL in `goto`), `*.spec.js`/`*.page.js` naming, valid
   JSONs, `playwright.config.js` guards
3. `npm run typecheck` — `tsc --noEmit` (checkJs across the code)
4. `npm run lint` — ESLint + `eslint-plugin-playwright`
5. `npm run format:check` — Prettier
6. `npm audit --audit-level=high` — known vulnerabilities block the build
7. `actionlint` — lint of the YAML workflows themselves

Job `secret-scanning`: **gitleaks** scans the history for accidentally committed
secrets.

### `pr-checks.yml` — PR Checks (pull_request)

- The **PR title** must follow Conventional Commits
  (`amannn/action-semantic-pull-request`); accepted types: `feat fix docs style
refactor perf test build ci chore revert qa`.
- The PR's **commit messages** are validated against the same pattern
  (merge/revert/fixup/squash are ignored).

### `playwright.yml` — Playwright Tests

| Trigger                                  | What runs                                                 |
| ---------------------------------------- | --------------------------------------------------------- |
| `push` on `main`/`master`                | **smoke** job (chromium, `@smoke`)                        |
| `pull_request` to `main`/`master`        | **smoke** job (chromium, `@smoke`)                        |
| `schedule` (cron `0 3 * * *`, daily 03h) | **full** job (chromium/firefox/webkit matrix in parallel) |
| `workflow_dispatch` (manual)             | **full** job (3-browser matrix)                           |

Built-in protections:

- **`concurrency`** — cancels duplicate runs of the same branch/PR.
- **Caching** — npm (`setup-node cache`) and browsers (`~/.cache/ms-playwright`
  keyed by the lockfile).
- **AUT preflight** — `curl` on `BASE_URL` before the tests: if the external site
  is down, the job fails fast with an infra message (not a code failure).
  `BASE_URL` is overridable via GitHub vars.
- **Artifacts** — `playwright-report/` + `test-results/` (traces/screenshots): in
  smoke only on failure (7 days); in full always (30 days), per browser.

### `dependabot.yml` — Dependency updates

- **npm**: weekly, up to 10 open PRs.
- **github-actions**: weekly.

---

## 3. Local quality gates (`npm` scripts)

| Script                    | What it does                                                    |
| ------------------------- | --------------------------------------------------------------- |
| `npm run gates`           | `scripts/quality-gates.mjs` — anti-patterns/naming/configs      |
| `npm run lint`            | ESLint over the whole repo (rules + `eslint-plugin-playwright`) |
| `npm run lint:fix`        | ESLint fixing what it can automatically                         |
| `npm run format`          | Prettier formatting the whole repo (`--write`)                  |
| `npm run format:check`    | Prettier checking (no changes; fails if it diverges)            |
| `npm run typecheck`       | `tsc --noEmit` — type checking                                  |
| `npm test`                | full Playwright suite                                           |
| `npm run test:smoke`      | `@smoke` tests                                                  |
| `npm run test:regression` | `@regression` tests                                             |

> **Code style**: the repo uses single quotes and **no semicolons**. ESLint and
> Prettier are configured to lock that style (`semi: never`, `singleQuote: true`,
> `avoidEscape`) — do not reformat files to another style.

> **Version pinning**: `typescript` and `@types/node` are pinned (`~5.6.3` /
> `~22.10.2`) — `typescript@5.9.x` showed an environmental hang in this setup. Do
> not "upgrade" without running `npm run typecheck` first.

---

## 4. Git hooks (Husky + lint-staged + commitlint)

Enabled automatically by `npm install` (`prepare: husky`).

### `pre-commit`

Runs `lint-staged` only on the _staged_ files:

- `*.{js,mjs,cjs,json,md}` → `prettier --write`
- `*.js` → `eslint --fix`

### `commit-msg`

Validates the commit message against **Conventional Commits** (`commitlint`):

```
tipo(escopo): descrição

tipos: feat | fix | chore | docs | refactor | test | ci | build | perf | style | revert | qa
```

---

## 5. Recommended flow before committing

```sh
npm run gates         # 1. anti-patterns and configs
npm run lint          # 2. lint
npm run format:check  # 3. formatting
npm run typecheck     # 4. types
npm test              # 5. tests
```

The `pre-commit` hook formats/lints what you _stage_ automatically, and the
`commit-msg` hook rejects messages outside the Conventional Commits pattern. CI
repeats the same validations on every push/PR.

---

## 6. Branch protection (configure on GitHub — requires admin)

In **Settings → Branches → Branch protection rules** for `main`:

- [x] Require a pull request before merging
- [x] Require status checks to pass — mark as **required**:
  - `Static checks` (quality.yml)
  - `Secret scanning (gitleaks)` (quality.yml)
  - `Smoke (chromium, @smoke)` (playwright.yml)
  - `Conventional PR title` (pr-checks.yml)
  - `Conventional commit messages` (pr-checks.yml)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
