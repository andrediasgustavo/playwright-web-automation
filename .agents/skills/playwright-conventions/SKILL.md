---
name: Playwright Conventions
description: Project structure, naming, locators, waits and assertion conventions for this Playwright repo
---

# Playwright Conventions

## Layout

```text
tests/              *.spec.js end-to-end specs (testDir in playwright.config.js)
tests/fixtures/     shared fixtures and test data helpers
pages/              page objects, one class per page/component
test-results/       generated (git-ignored)
playwright-report/  generated HTML report (git-ignored)
```

## Naming

- Spec file: `<feature>.spec.js` (e.g. `login.spec.js`).
- Page object: `pages/<page>.page.js`, class `export class LoginPage {}`.
- Fixture: `tests/fixtures/<name>.js`, a `test.extend` extension.
- Test title: short, active, outcome-focused — `test('logs in with valid credentials', ...)`.

## Locators (priority order)

1. `page.getByRole('button', { name: 'Entrar' })`
2. `page.getByLabel(...)`, `getByPlaceholder(...)`, `getByText(...)`
3. `page.getByTestId('login-submit')`
4. CSS only as a last resort — never structural CSS/XPath chains.

No duplicated selectors: page objects own locators, specs consume methods.

## Waiting and assertions

- Rely on Playwright auto-waiting plus web-first assertions.
- `await expect(locator).toBeVisible()` / `toHaveText` / `toHaveURL` / `toHaveCount`.
- Never use `page.waitForTimeout(...)` or `networkidle`-style sleeps.
- Assert on user-visible outcomes, not implementation details.

## Test hygiene

- Every test is independent: own setup, own data, no order dependence.
- Clean up created data in `test.afterEach` when the app persists state.
- Never leave `test.only`; `forbidOnly: true` is unconditional, so a stray
  `test.only` fails any run (local or CI).
- Tag long/slow flows (`{ tag: ['@regression'] }`) and quick ones (`@smoke`).

## Style

- No semicolons, single quotes, trailing commas.
- No lint/format dependencies — style is kept consistent by convention, not tooling.

## Config facts

- Browsers configured: `chromium`, `firefox`, `webkit`.
- `fullyParallel: true`; retries on CI only (`retries: 2`), workers `1` on CI.
- `trace: 'on-first-retry'` — inspect with `npx playwright show-trace`.
- `baseURL` is set in `playwright.config.js` `use.baseURL`, defaulting to
  `https://www.automationpratice.com.br` and overridable with the `BASE_URL` env
  var; use relative paths (`page.goto('/login')`) instead of absolute URLs.

## Commands

```sh
npx playwright test                  # all tests
npx playwright test -g "login"       # by title
npx playwright test --project chromium
npx playwright test --list           # verify files load
npx playwright test --ui             # interactive
npx playwright show-report           # HTML report
npx playwright codegen <url>         # record locators
```
