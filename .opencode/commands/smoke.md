---
description: Run the smoke suite and report structured results
agent: test-runner
subagent: true
---

Run the Playwright smoke suite.

Use the `qa_run_tests` tool with `grep: "@smoke"`. If no tests match, run the
whole suite instead. Report counts (passed/failed/flaky/skipped), duration, and
each failure with title, file, and the first error lines. Do not edit any file.

Focus / context: $ARGUMENTS
