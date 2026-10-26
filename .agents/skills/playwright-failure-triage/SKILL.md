---
name: Playwright Failure Triage
description: Classify and root-cause failing or flaky Playwright tests from structured output and traces
---

# Failure Triage

## Step 1 — Get structured evidence

Run the suite through the `qa_run_tests` tool (it returns stats plus per-failure
title, file, and error snippet). Do not rely on scrolling raw terminal output.

## Step 2 — Look at the artifact

For each failure:

```sh
npx playwright show-trace test-results/<test>/trace.zip
```

Check, in order: the failing action, the DOM at that moment, the console, and the
network calls. `screenshot.png` / `error-context.md` in `test-results/` are
written automatically for failures.

## Step 3 — Classify (exactly one)

| Class             | Signals                                                              | Owner            |
| ----------------- | -------------------------------------------------------------------- | ---------------- |
| Product defect    | App throws, returns wrong data, UI genuinely broken                   | product team     |
| Test defect       | Locator not found, wrong expectation, missing await, bad selector     | `spec-author` / `page-object` |
| Environment/data  | App not running, wrong base URL, missing seed data, auth expiry       | infra / fixtures |
| Flakiness         | Passes and fails without code change; timing/race/animation           | `failure-triage` fix |

## Step 4 — Confirm flakiness properly

Do not call it flaky from one run.

```sh
npx playwright test <file> --repeat-each 5 --workers 1
```

- Fails 5/5 → deterministic bug.
- Mixed results → genuine flakiness; find the race, do not just add retries.

## Step 5 — Propose the smallest fix

- Test defect → fix the locator/assertion (web-first, no sleeps).
- Flakiness → wait on a deterministic signal (response, URL, element state),
  never `waitForTimeout`.
- Product defect → report with reproduction steps and evidence; do not patch
  the app to make the test green.

## Output format

```text
[SEV] <test title> (<file>:<line>)
Cause: <class> — <one sentence>
Evidence: <trace step / error line>
Fix: <concrete change owned by <agent>>
```

Severity: S1 product broken, S2 test wrong/masking a bug, S3 flaky, S4 cosmetic.
