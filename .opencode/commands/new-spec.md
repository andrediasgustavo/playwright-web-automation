---
description: Plan and write a new Playwright spec for a feature
agent: qa-lead
---

Author a new Playwright spec for: $ARGUMENTS

Follow the `playwright-conventions` and `playwright-test-authoring` skills.

1. If the target URL/app or the scenarios are unclear, ask before writing.
2. Delegate the file writing to the `spec-author` subagent (cheap tier) with
   explicit file ownership (`tests/<feature>.spec.js` only).
3. Prove it loads with `npx playwright test --list <file>`, then run it once.
4. Report what was covered and any scenario you skipped, with the reason.
