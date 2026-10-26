# Project Context — Current State

> Context/handoff document: what exists in this repository today, how it works
> and what is still missing. Last updated: **25/10/2026**.

## Overview

A **Playwright web-automation** repository (QAZANDO course), now with an **AI
infrastructure** on top of OpenCode: specialized agents, skills, custom tools
(including parallel-agent orchestration) and **per-request model routing**.

**Application under test:** QAZANDO Shop E-Commerce — https://www.automationpratice.com.br/

---

## 1. File structure

```text
AGENTS.md                         project instructions for agents (portable / agents.md)
.agents/skills/                   SKILL.md (portable format, read by several harnesses)
  playwright-conventions/         layout, locators, waits, assertions
  playwright-test-authoring/      workflow for writing specs
  playwright-failure-triage/      failure classification/root-cause
  parallel-agent-orchestration/   how to split work across subagents + routing
.opencode/
  opencode.jsonc                  OpenCode config (default model, permissions, MCP, worktrees)
  qa-routing.json                 ROUTING config (choices/criteria, tiers, router)
  agents/                         7 agents (qa-lead + 6 specialists)
  commands/                       /new-spec /smoke /triage /parallel /review-tests
  plugins/qa-orchestrator/        plugin exposing the qa_* tools
docs/
  test-plan-login-signup.md       plan + scenarios + cases (login and signup)
  project-context.md              this file
pages/                            page objects (base.page.js, login.page.js, signup.page.js)
tests/                            Playwright specs (login.spec.js, signup.spec.js)
tests/fixtures/                   fixtures/test data (users.js)
```

---

## 2. AI infrastructure (OpenCode)

### 2.1 Config — `.opencode/opencode.jsonc`

- `model`: `openrouter/typesafe/jev-router` (project default)
- `default_agent`: `qa-lead`
- `providers.openrouter.models["typesafe/jev-router"]`: registration of the Jev
  Router (not present in models.dev, so it is declared by hand; `tools: true`)
- `permissions`: read/edit/skills/subagents allowed; shell allowed with `ask` for
  `rm -rf *`, `git push *`, `git reset --hard *`, `npm publish *`
- `experimental`: `todo: true`, `subagent_depth: 2`, `background_compaction: true`
- `mcp.servers.playwright`: local MCP (`npx -y @playwright/mcp@latest`) → 25
  browser tools used to explore the site
- `worktree.directory`: `.worktrees`
- `formatter: true`

### 2.2 Agents (`.opencode/agents/`)

| Agent            | Mode              | Model                      | Role                            |
| ---------------- | ----------------- | -------------------------- | ------------------------------- |
| `qa-lead`        | primary (default) | inherits the default (Jev) | plans and orchestrates          |
| `spec-author`    | subagent          | deepseek-v4.1-flash        | writes specs (`tests/`)         |
| `page-object`    | subagent          | deepseek-v4.1-flash        | writes page objects (`pages/`)  |
| `test-runner`    | subagent          | deepseek-v4.1-flash        | runs suites, returns result     |
| `bulk-writer`    | subagent          | deepseek-v4.1-flash#none   | mechanical edits, data, renames |
| `failure-triage` | subagent          | deepseek-v4-pro-0813#high  | root-causes failures/flaky      |
| `test-reviewer`  | subagent          | deepseek-v4.1-flash        | read-only review                |

### 2.3 Skills (`.agents/skills/`)

Moved from `.opencode/skills/` to `.agents/skills/` for **portability**
(OpenCode, Claude Code and others recognize the path; `AGENTS.md` likewise).

### 2.4 Tools — plugin `.opencode/plugins/qa-orchestrator/index.ts`

Namespace `qa`, with `codemode: true`:

| Tool                  | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `qa_pick_model`       | resolves a model per tier / lists the cheapest capable ones        |
| `qa_route_request`    | classifies 1 request → tier + model + reason                       |
| `qa_routing_log`      | recent routing decisions + the actual model used                   |
| `qa_parallel_agents`  | launches N subagents in parallel and collects their reports        |
| `qa_parallel_control` | `list` / `message` / `interrupt` subagents                         |
| `qa_run_tests`        | runs Playwright and returns structured results (counts + failures) |

Relevant implementation details:

- `qa_run_tests` uses the local CLI via
  `node ./node_modules/@playwright/test/cli.js` (fallback `npx`).
  **`process.execPath` inside the plugin is the OpenCode binary, not Node** —
  do not use it.
- `qa_parallel_agents` creates child sessions, sets the agent + model, waits and
  reads the assistant's last message.

### 2.5 Commands (`.opencode/commands/`)

`/new-spec`, `/smoke`, `/triage`, `/parallel`, `/review-tests`.

### 2.6 AGENTS.md

Short instructions: layout, rules (accessible locators, no `waitForTimeout`, no
`test.only`, do not commit without asking), "delegate by default", tool and
command tables.

---

## 3. Model routing

Goal: pick the model per request, spend less, and **see which model runs**.

### 3.1 What "Jev" is

- **Jev** = TypeSafe's _System One_: a **classification** model with `choice` /
  `score` / `noul` primitives and calibrated confidence. Docs:
  https://docs.typesafe.ai/introduction/quickstart
- Two ways to use it:
  1. **Direct TypeSafe API** (`https://api.typesafe.ai/v1/systemone`, auth
     `Bearer $TYPESAFE_API_KEY`) — requires a TypeSafe key.
  2. **`openrouter/typesafe/jev-router`** on OpenRouter — uses the **OpenRouter**
     key (no TypeSafe key). It is a router that picks model + effort per request.

### 3.2 Routing config — `.opencode/qa-routing.json`

```jsonc
{
  "router": "jev", // jev | llm | off
  "routerModel": "openrouter/typesafe/jev-router", // classifier (LLM fallback)
  "typesafeModel": "jev-latest",
  "typesafeEndpoint": "https://api.typesafe.ai/v1/systemone",
  "instructions": "Which cost tier should handle this software/QA task",
  "criteria": { "cheap": "...", "standard": "...", "deep": "..." }, // Jev's CHOICES
  "models": { "cheap": "...", "standard": "...", "deep": "..." }, // tier -> model
}
```

Precedence: **built-in defaults < `qa-routing.json` < environment variables**.

Current tiers:

- `cheap` → `openrouter/deepseek/deepseek-v4.1-flash`
- `standard` → `openrouter/deepseek/deepseek-v4-pro-0813`
- `deep` → `openrouter/qwen/qwen3.8-max-0902`

### 3.3 How it works per request

With the current default (**pre-routing on**):

1. You send a request.
2. The plugin classifies the text (Jev via OpenRouter / LLM fallback) → tier.
3. The plugin **switches the session model** before running (`switchModel`).
4. The request runs on the tier model and the **TUI status line shows the model**
   (e.g. `qa-lead · qwen/qwen3.8-max-0902`). ✔ live indicator, no extra UI.

Delegation: `qa_parallel_agents` routes **each task** by tier (same engine).

### 3.4 Environment variables

| Variable                                                 | Effect                                                   |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `QA_ROUTER`                                              | `jev` \| `llm` \| `off`                                  |
| `QA_ROUTER_MODEL`                                        | classifier model (LLM fallback)                          |
| `QA_CHEAP_MODEL` / `QA_STANDARD_MODEL` / `QA_DEEP_MODEL` | models per tier                                          |
| `QA_ROUTING`                                             | `auto` \| `off` in `qa_parallel_agents`                  |
| `QA_PRE_ROUTE`                                           | `0` disables pre-routing (session stays on jev-router)   |
| `QA_TRACE_MODEL`                                         | `0` disables actual-model capture                        |
| `QA_ANNOUNCE`                                            | `1` also posts the notice in the session (⚠ see gotchas) |
| `QA_DEBUG`                                               | `1` logs decisions to the server log                     |
| `QA_ROUTING_FILE`                                        | alternative path for `qa-routing.json`                   |
| `TYPESAFE_API_KEY` / `TYPESAFE_API_KEY_FILE`             | Jev key (direct API)                                     |
| `TYPESAFE_MODEL` / `TYPESAFE_ENDPOINT`                   | override the Jev target                                  |

---

## 4. Visibility / debug

| Resource                                           | What it shows                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **TUI status line**                                | `agent · model` — with pre-routing, shows the model that will run                       |
| `qa_routing_log`                                   | recent decisions: tier, model, reason and the **actual model** captured from the stream |
| `opencode stats --models --cost --project .`       | tokens, steps and cost per model                                                        |
| `tail -f ~/.local/share/opencode/log/opencode.log` | server log                                                                              |
| OpenRouter → Activity                              | model + cost per request (authoritative router source)                                  |

The plugin captures the **actual model** by reading the `"model"` field of
OpenRouter's SSE stream (`http.response` hook), since OpenCode only sees
`typesafe/jev-router`.

---

## 5. Tests (target site)

Full plan in **`docs/test-plan-login-signup.md`**.

Summary verified against the site (via Playwright MCP, 25/10/2026):

- Login: `#user` (E-mail*), `#password` (Senha*), "Lembrar de mim" checkbox,
  `login` button. Format validation (`invalid_input` → "E-mail inválido." /
  "Senha inválida."). Success → SweetAlert "Login realizado / Olá, {email}" →
  `/my-account`.
- Signup: `#user` (Nome*), `#email`, `#password`, `Cadastrar` button. Success →
  SweetAlert "Cadastro realizado! / Bem-vindo {nome}" → `/my-account`.
- **The app is a 100% client-side mock** (no network requests): login does **not
  validate credentials**.
- **Likely defect (S2):** signup with empty fields or a malformed e-mail shows
  **no** message at all (inconsistent with login).

---

## 6. Decisions and technical gotchas

- **`.agents/skills` instead of `.opencode/skills`** — portability across harnesses.
- **Default model = jev-router** (OpenRouter): routes inside the provider, so the
  TUI would not show the real model → solved with **pre-routing** (the plugin
  decides the tier and switches the model → the TUI shows it).
- **`process.execPath`** in the plugin = OpenCode binary (use `node`).
- **Plugin `console.error`/`console.log` do not reach `opencode.log`** — do not
  rely on them for logging.
- **A `synthetic` message wakes the model** (generates an extra turn and pollutes):
  that is why `QA_ANNOUNCE` stays **off** by default; the indicator is the status line.
- **Jev Router is not in models.dev** → registered manually in
  `providers.openrouter.models`.
- OpenCode config reloads on save; `opencode reload` forces it.

---

## 7. Useful commands

```sh
# switch agent in the TUI: Shift+Tab (cycles) or Ctrl+X then A (list)
# list models: Ctrl+X then M

opencode reload                                   # reloads config
opencode stats --models --cost --project .        # usage/cost per model
opencode run --auto "message"                     # run one turn without the TUI
opencode api get "/api/skill?location%5Bdirectory%5D=$(pwd)"   # list skills
opencode service restart                          # restart the background server

tail -f ~/.local/share/opencode/log/opencode.log

npx playwright test                               # suites
npx playwright test --list                        # validate that specs load
npx playwright show-report
```

---

## 8. Current state and pending items

**Git:** work committed as a series of logical commits (POM refactor, specs
conformed to real behavior, quality tooling, CI, docs, agent infra). Details in
the history (`git log --oneline`).

**Pending / next steps:**

1. ✅ Done — `use.baseURL` set in `playwright.config.js`
   (`https://www.automationpratice.com.br`, with `BASE_URL` override), to use
   relative paths in specs.
2. ✅ Done — `pages/base.page.js`, `pages/login.page.js` and
   `pages/signup.page.js` implemented.
3. ✅ Done — `tests/login.spec.js` and `tests/signup.spec.js` created from the
   plan's cases.
4. ✅ Done — the suite ran green (42/42 across the 3 browsers); the signup
   defect (S2) was triaged: CT-SIGN-02/03 now document the REAL behavior (silent
   submission, no feedback) as normal tests — no `test.fail`/`test.fixme`. When
   the site is fixed, those tests fail and should be promoted to "expects feedback".
5. ✅ Done — quality pipeline: `scripts/quality-gates.mjs` (`npm run gates`),
   ESLint + `eslint-plugin-playwright`, Prettier, `tsc --noEmit` (typescript
   pinned to 5.6.3 — 5.9.x hangs in this setup), Husky + lint-staged + commitlint
   (Conventional Commits).
6. ✅ Done — robust CI: `quality.yml` (gates, typecheck, lint, format, `npm
audit`, actionlint, gitleaks), `pr-checks.yml` (PR title and conventional
   commits), `playwright.yml` (smoke on push/PR + nightly full matrix,
   concurrency, caches, AUT preflight, artifacts with traces) and Dependabot
   (alerts only — automatic version-update PRs are disabled; npm + actions).
   See `docs/ci-pipeline.md`.
7. Apply **branch protection** on GitHub (checklist in `docs/ci-pipeline.md` §6 —
   requires admin).
8. (Optional) Add a TypeSafe key to use Jev directly (`TYPESAFE_API_KEY`).
9. (Future) New test plans: password recovery, cart/checkout, wishlist;
   `pages/my-account.page.js` when the logged-in area is covered.
