---
name: Playwright Test Authoring
description: Step-by-step workflow for turning a test plan into a runnable Playwright spec
---

# Authoring a Playwright Spec

## Preconditions

You have an approved test plan: scenarios, the page(s) involved, and test data.
If not, stop and ask for one instead of inventing scope.

## Workflow

1. **Check existing coverage** — `grep` the `tests/` tree for the feature name so
   you extend instead of duplicating.
2. **Reuse page objects** — if `pages/<page>.page.js` exists, use it. If it is
   missing the methods you need, report that and let `page-object` own the change.
3. **Write the spec** in `tests/<feature>.spec.js`:

   ```js
   // @ts-check
   import { test, expect } from '@playwright/test'

   test.describe('Login', () => {
     test('logs in with valid credentials', { tag: ['@smoke'] }, async ({ page }) => {
       await page.goto('/login')
       await page.getByLabel('E-mail').fill('user@example.com')
       await page.getByLabel('Senha').fill('secret')
       await page.getByRole('button', { name: 'Entrar' }).click()
       await expect(page).toHaveURL(/dashboard/)
     })
   })
   ```

4. **One behavior per test.** No shared mutable state between tests.
5. **Prove it loads** — `npx playwright test --list tests/<feature>.spec.js`.
6. **Run it** — `npx playwright test tests/<feature>.spec.js`. If it fails because
   the target app is not running, mark the spec `test.fixme` / `test.skip` with a
   clear reason rather than deleting it or leaving it red.
7. **Report** — files changed, scenarios covered, exact commands run and results.

## Anti-patterns to refuse

- `page.waitForTimeout`, arbitrary sleeps.
- Assertions that cannot fail (asserting a variable you just set).
- Copy-pasting a whole spec to change one string — parameterize instead.
- Committing debug code (`console.log`, `page.pause()`, `test.only`).
