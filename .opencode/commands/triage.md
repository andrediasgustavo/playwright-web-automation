---
description: Root-cause failing or flaky Playwright tests
agent: failure-triage
subagent: true
---

Triage the failing Playwright tests. Focus: $ARGUMENTS

Load the `playwright-failure-triage` skill. Get structured evidence with the
`qa_run_tests` tool, then inspect traces/screenshots under `test-results/`.
Classify each failure (product bug / test bug / environment / flaky), propose the
smallest correct fix with file and line references, and say who should own it.
Do not edit files.
