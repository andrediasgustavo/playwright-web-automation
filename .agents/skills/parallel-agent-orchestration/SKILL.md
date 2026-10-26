---
name: Parallel Agent Orchestration
description: How to split QA work across parallel subagents, route models by cost tier, and integrate results safely
---

# Parallel Agent Orchestration

## Tools available

| Tool                   | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `qa_route_request`     | Classify one request → cost tier + model (LLM router)            |
| `qa_parallel_agents`   | Launch N subagents at once, wait, and collect their final output |
| `qa_parallel_control`  | `list`, `message`, or `interrupt` running subagents              |
| `qa_pick_model`        | Show the tier's model and the cheapest capable models available  |
| `qa_run_tests`         | Run Playwright and get structured pass/fail + failures           |

## Model routing

Tiers map to configured models (override with `QA_CHEAP_MODEL`,
`QA_STANDARD_MODEL`, `QA_DEEP_MODEL`):

| Tier       | Default (OpenRouter)                        | Use for                             |
| ---------- | ------------------------------------------- | ----------------------------------- |
| `cheap`    | `deepseek/deepseek-v4.1-flash`              | writing specs, page objects, runs   |
| `standard` | `deepseek/deepseek-v4-pro-0813`             | triage, review, orchestration       |
| `deep`     | `qwen/qwen3.8-max-0902`                     | rare, hard design/root-cause work   |

If a task omits `tier` and `model`, the subagent uses the model configured in its
own `.md` file — prefer that and only pass `tier` to override deliberately.

`tier: "cheapest"` makes the tool pick the lowest-output-cost tool-capable model
from the live catalog at runtime. Do not escalate to `deep` unless a cheap/standard
agent has already failed to make progress.

## Automatic per-request routing

`qa_parallel_agents` routes **each task automatically by default**
(`routing: "auto"`). The default router is **Jev** (TypeSafe System One): a
single `choice` question classifies the task prompt into `cheap` / `standard` /
`deep`, and the matching tier model is used. Without a TypeSafe key it falls
back to a cheap OpenRouter LLM (`QA_ROUTER_MODEL`). Use `qa_route_request` to
preview a classification without launching anything — each result reports the
tier, model, and why.

Overrides, in precedence order:

1. task `model` (explicit provider/model)
2. task `tier` (explicit tier)
3. LLM routing (default)
4. `routing: "off"` → the subagent uses the model in its own `.md`

The chosen `tier`, `model`, and `reason` come back in each result, so you can see
how a task was routed and correct it if needed.

To let OpenRouter route natively instead, set a model to
`openrouter/openrouter/auto` (its own router, quality-oriented, less predictable
cost). `QA_ROUTING=off` disables the LLM router globally.

## Splitting work

Good split (disjoint files, no ordering dependency):

```jsonc
{
  "tasks": [
    { "agent": "page-object", "tier": "cheap", "title": "pom-login",
      "prompt": "Create pages/login.page.js for <url>. Own ONLY that file. ..." },
    { "agent": "spec-author", "tier": "cheap", "title": "spec-login",
      "prompt": "Write tests/login.spec.js using pages/login.page.js. Own ONLY that file. ..." },
    { "agent": "spec-author", "tier": "cheap", "title": "spec-checkout",
      "prompt": "Write tests/checkout.spec.js. Own ONLY that file. ..." }
  ]
}
```

Bad split: two agents editing the same file, or a writer and a runner of the same
unfinished file at the same time.

## Rules

1. **One writer per file.** State file ownership in every task prompt.
2. **Parallelize independent work only.** Sequence when a task consumes another's output.
3. **Give each task a self-contained prompt** — subagents start with fresh context
   and do not see this conversation.
4. **Integrate yourself.** After the cast returns, read the diffs, resolve
   overlaps, then run the suite once through `qa_run_tests`.
5. **Fail loud.** If a subagent stalls, `qa_parallel_control` with `action:
   "interrupt"`, then re-run it smaller rather than waiting out the timeout.
6. **Isolate risky work with a worktree** (`worktree_create`) when an agent will
   make sweeping changes; merge only what passes review.

## Cost discipline

- Keep prompts tight; subagents start cold and pay for whatever context you send.
- Prefer one run of `qa_run_tests` over each agent running the suite itself.
- Reserve `deep` for at most one agent per batch.
