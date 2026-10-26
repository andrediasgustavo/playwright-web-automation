# AGENTS.md — Playwright Web Automation

Project instructions for AI agents. Keep them short; the detail lives in skills.

## What this repo is

End-to-end web tests with **Playwright** (`@playwright/test`), JavaScript, Node.
Flat layout: specs in `tests/`, page objects in `pages/`, generated output in
`test-results/` and `playwright-report/` (git-ignored).

## Ground rules

- Run tests with `npx playwright test` (never invent a different runner).
- Put the target app URL in `playwright.config.js` `use.baseURL` and use relative
  paths in tests; do not hard-code absolute URLs across specs.
- Use accessible locators (`getByRole`, `getByLabel`, `getByTestId`) and web-first
  assertions. No `waitForTimeout`, no structural CSS/XPath chains.
- Every test is independent and cleans up after itself. Never commit `test.only`.
- Before committing, run `npm run gates`, `npm run lint`, `npm run format:check`
  and `npm run typecheck` — the same gates CI enforces. Husky hooks
  (`pre-commit` → lint-staged, `commit-msg` → Conventional Commits) are active.
- Do not add dependencies, commit, or push unless explicitly asked.

## How to work here

- **Load skills before acting:** `playwright-conventions` always;
  `playwright-test-authoring` when writing specs; `playwright-failure-triage`
  when diagnosing; `parallel-agent-orchestration` when splitting work.
- **Delegate by default.** The `qa-lead` agent orchestrates. Cheap, mechanical
  work goes to cheap subagents (`spec-author`, `page-object`, `test-runner`,
  `bulk-writer`); reserve `failure-triage` and `test-reviewer` for reasoning.
- **Parallelize independent work** with the `qa_parallel_agents` tool, one writer
  per file, then integrate and run once with `qa_run_tests`.
- **Own files, not intentions.** State which files an agent may touch.

## Models & routing

- The default model is `openrouter/typesafe/jev-router` (TypeSafe Jev Router on
  OpenRouter): Jev picks the model and reasoning effort **per request**, billed
  through the OpenRouter key. For a fixed model, change `model` in
  `.opencode/opencode.jsonc`.
- Delegated work is tier-routed by the plugin: cheap models for mechanical
  tasks, stronger for triage/review, `deep` only when needed. The tier
  _choices_ (Jev criteria), tier→model map, and router live in
  `.opencode/qa-routing.json`; `qa_route_request` shows how a request would be
  routed.
- **Each prompt is pre-routed**: the plugin classifies it and switches the
  session model before running, so the TUI status line shows the model that will
  run (`QA_PRE_ROUTE=0` to disable).

## Custom tooling

| Tool                  | Use it for                                             |
| --------------------- | ------------------------------------------------------ |
| `qa_pick_model`       | cheapest model per tier / list cheapest capable models |
| `qa_route_request`    | classify a request → tier + model                      |
| `qa_routing_log`      | recent routing decisions + the actual model used       |
| `qa_parallel_agents`  | run several subagents in parallel, collect reports     |
| `qa_parallel_control` | list / message / interrupt running subagents           |
| `qa_run_tests`        | run Playwright, get structured pass/fail + failures    |

Slash commands: `/new-spec`, `/smoke`, `/triage`, `/parallel`, `/review-tests`.
