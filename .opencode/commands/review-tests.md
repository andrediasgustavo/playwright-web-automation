---
description: Review tests and page objects for quality and flakiness
agent: test-reviewer
subagent: true
---

Review $ARGUMENTS for test-quality and flakiness problems.

Follow the `playwright-conventions` skill. Report findings in severity order with
file, line, why it matters, and a concrete fix. Call out flaky patterns, brittle
locators, weak assertions, and isolation problems. If the code is fine, say so.
Do not edit files.
