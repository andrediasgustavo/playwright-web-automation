# Playwright Web Automation

End-to-end web automation with [Playwright](https://playwright.dev), plus an
AI-agent infrastructure built on OpenCode for planning, authoring, running, and
triaging tests — with parallel agents and cost-aware model routing.

## Project Structure

```text
tests/                      Playwright specs (*.spec.js) and fixtures
tests/fixtures/             shared fixtures and test data
pages/                      page objects (<name>.page.js)
playwright.config.js        Playwright configuration
AGENTS.md                   agent-facing project instructions
.opencode/                  AI infrastructure (see below)
.github/                    CI workflows
```

## Setup

```sh
npm install
npx playwright install     # download browsers
```

## Running tests

```sh
npm test                    # all tests
npm run test:smoke          # @smoke tagged
npm run test:regression     # @regression tagged
npm run test:chromium       # single browser
npm run test:firefox        # single browser
npm run test:webkit         # single browser
npm run test:ui             # interactive UI mode
npm run typecheck           # type-check JS with tsc --noEmit
npm run gates               # quality gates (anti-patterns, naming, configs)
npm run lint                # ESLint
npm run lint:fix            # ESLint (auto-fix)
npm run format              # Prettier (write)
npm run format:check        # Prettier (check only)
npm run report              # open the HTML report
```

## CI & Quality Gates

Three layers enforce quality (same commands locally and on CI):

- **GitHub Actions** — `quality.yml` (gates, typecheck, ESLint, Prettier,
  `npm audit`, actionlint, gitleaks) on every push/PR; `pr-checks.yml`
  (Conventional Commits on PR title + commit messages); `playwright.yml`
  (smoke on push/PR, full 3-browser matrix nightly, with concurrency,
  caches, AUT preflight and trace artifacts).
- **Local gates** — `npm run gates && npm run lint && npm run format:check &&
npm run typecheck` before committing.
- **Git hooks** — Husky: `pre-commit` runs lint-staged (Prettier + ESLint on
  staged files), `commit-msg` enforces Conventional Commits.

Full pipeline docs: [`docs/ci-pipeline.md`](docs/ci-pipeline.md) (including the
branch-protection checklist to apply on GitHub).

## AI infrastructure

### Portable pieces (work across harnesses)

```text
AGENTS.md                  project instructions (agents.md standard)
.agents/skills/            SKILL.md skills (also read by other harnesses)
├── playwright-conventions/
├── playwright-test-authoring/
├── playwright-failure-triage/
└── parallel-agent-orchestration/
```

`AGENTS.md` and `.agents/skills/` follow cross-tool conventions: OpenCode reads
them, and so do other harnesses that support the `AGENTS.md` / `SKILL.md`
formats. MCP is a cross-harness protocol too, but each harness keeps its server
list in its own config file.

### OpenCode-specific pieces

```text
.opencode/
├── opencode.jsonc                 default model, permissions, MCP, worktrees
├── agents/                        specialized agents
│   ├── qa-lead.md                 primary orchestrator (default agent)
│   ├── spec-author.md             writes specs            (cheap model)
│   ├── page-object.md             builds page objects     (cheap model)
│   ├── test-runner.md             runs suites             (cheap model)
│   ├── bulk-writer.md             mechanical edits        (cheap model)
│   ├── failure-triage.md          root-cause failures     (standard model)
│   └── test-reviewer.md           read-only review        (standard model)
├── plugins/qa-orchestrator/       custom QA tools (see below)
└── commands/                      slash commands
```

### Agents and model routing

The default agent is **qa-lead**, which plans and delegates. Work is routed by
cost tier: cheap mechanical work goes to cheap models, and only triage/review
escalate to a stronger model. Tiers are resolved live from the catalog or from
`QA_CHEAP_MODEL` / `QA_STANDARD_MODEL` / `QA_DEEP_MODEL`.

### Custom tools

| Tool                  | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `qa_route_request`    | classify a request with a cheap LLM → cost tier + model      |
| `qa_pick_model`       | resolve a model per tier, or find the cheapest capable model |
| `qa_parallel_agents`  | run multiple subagents in parallel and collect their reports |
| `qa_parallel_control` | list, message, or interrupt running subagents                |
| `qa_run_tests`        | run Playwright and return structured pass/fail + failures    |

#### Model routing

Two layers:

1. **Default model = `openrouter/typesafe/jev-router`** (TypeSafe Jev Router,
   served by OpenRouter). Jev picks the model and reasoning effort **per
   request**, billed through your OpenRouter key — so every message is routed
   automatically, including the main session. Swap `model` in
   `.opencode/opencode.jsonc` back to a fixed model
   (e.g. `openrouter/deepseek/deepseek-v4-pro-0813`) for deterministic cost.
2. **Subagent tasks** are tier-routed by the plugin: Jev's `choice` primitive
   (direct TypeSafe API) classifies the task, falling back to a cheap OpenRouter
   LLM. Explicit `tier`/`model` wins; `routing: "off"` uses each subagent's own
   model.

The tier classifier is configured in **`.opencode/qa-routing.json`** — edit the
`criteria` (the Jev _choice_ labels and their descriptions), `instructions`,
`models` (tier → model), and `router` there:

```jsonc
{
  "router": "jev",
  "routerModel": "openrouter/deepseek/deepseek-v4-flash-0731",
  "instructions": "Which cost tier should handle this software/QA task",
  "criteria": {
    "cheap": "Mechanical, repetitive, small or well-specified edits, ...",
    "standard": "Normal engineering work: writing or fixing tests, ...",
    "deep": "Hard architecture, subtle or ambiguous debugging, ...",
  },
  "models": {
    "cheap": "openrouter/deepseek/deepseek-v4.1-flash",
    "standard": "openrouter/deepseek/deepseek-v4-pro-0813",
    "deep": "openrouter/qwen/qwen3.8-max-0902",
  },
}
```

Precedence: built-in defaults < `qa-routing.json` < env vars.

The Jev router model itself is reachable only through OpenRouter and is not in
models.dev, so it is registered under `providers.openrouter.models` in
`.opencode/opencode.jsonc`. TypeSafe Jev (used by the plugin classifier) needs a
TypeSafe key; without it the classifier falls back to the LLM:

```sh
# optional, only for the subagent tier classifier
opencode service set env TYPESAFE_API_KEY "ts_..."
# or: echo "ts_..." > ~/.config/opencode/typesafe.key
```

Tuning:

```sh
QA_ROUTER=jev                                                # jev | llm | off
TYPESAFE_MODEL=jev-latest
QA_ROUTER_MODEL=openrouter/deepseek/deepseek-v4-flash-0731   # llm fallback (~$0.13/M)
QA_CHEAP_MODEL=openrouter/deepseek/deepseek-v4.1-flash       # tier: cheap
QA_STANDARD_MODEL=openrouter/deepseek/deepseek-v4-pro-0813   # tier: standard
QA_DEEP_MODEL=openrouter/qwen/qwen3.8-max-0902               # tier: deep
QA_ROUTING=auto                                              # auto | off
```

`qa_route_request` reports the chosen tier, model, confidence/reason, and which
router ran.

#### Visibility — which model runs (live)

By default the plugin **pre-routes every prompt**: it classifies the request
(Jev via OpenRouter — `routerModel` in `qa-routing.json`) and switches the
session model _before_ it runs. So the **TUI status line shows exactly what will
run**, e.g. `qa-lead · deepseek/deepseek-v4.1-flash`. No extra UI, no extra
turns.

- `QA_PRE_ROUTE=0` disables pre-routing: the session keeps its configured model
  (e.g. `typesafe/jev-router`, which routes inside OpenRouter and is **not**
  visible in the TUI).
- `qa_routing_log` (tool) — recent decisions: tier, model, reason, and the
  actual model each request used.
- `opencode stats --models --cost --project .` — tokens, steps and cost per model.
- OpenRouter → Activity — authoritative model + cost per request.
- `QA_TRACE_MODEL=0` disables actual-model capture; `QA_DEBUG=1` logs decisions
  to the server log.

### Slash commands

| Command         | What it does                                        |
| --------------- | --------------------------------------------------- |
| `/new-spec`     | plan and write a new spec for a feature             |
| `/smoke`        | run the smoke suite and report                      |
| `/triage`       | root-cause failing or flaky tests                   |
| `/parallel`     | split a goal across parallel subagents              |
| `/review-tests` | review tests/page objects for quality and flakiness |

### MCP

A local **Playwright MCP** server (`npx @playwright/mcp`) is configured so agents
can drive a real browser for exploratory testing and selector discovery. Remove
`mcp.servers.playwright` from `.opencode/opencode.jsonc` if you don't want it.

## Technologies Used

- **Playwright** — end-to-end testing framework
- **Node.js** — JavaScript runtime
- **OpenCode** — agent harness powering the AI infrastructure

## License

ISC
