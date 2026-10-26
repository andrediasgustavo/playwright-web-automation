# Test Plan — Authentication (Login and Signup)

**Application under test (AUT):** QAZANDO Shop E-Commerce — https://www.automationpratice.com.br/
**Scope of this plan:** User signup and login
**Type:** Functional E2E (UI) tests — Playwright
**Plan version:** 1.0
**Date:** 25/10/2026

---

## 1. Objective

Define the strategy, scenarios and test cases for the **Signup** and **Login**
features, serving as the basis for Playwright automation with the **Page
Objects** pattern (see `.agents/skills/playwright-conventions`).

## 2. Scope

### In scope

- New user signup (`/register`)
- Login (`/login`)
- Field validation (required and format)
- "Lembrar de mim" (remember me) behavior
- Post-action redirect (`/my-account`)
- Feedback messages (error and success)

### Out of scope (for now)

- Password recovery / password change
- Checkout, cart, wishlist and the rest of the store flows
- Authorization/roles, real backend integration (see item 4)

## 3. Environment and data

| Item       | Value                                                    |
| ---------- | -------------------------------------------------------- |
| Base URL   | `https://www.automationpratice.com.br`                   |
| Login      | `https://www.automationpratice.com.br/login`             |
| Signup     | `https://www.automationpratice.com.br/register`          |
| Logged-in  | `https://www.automationpratice.com.br/my-account`        |
| Browsers   | Chromium, Firefox, WebKit (projects already configured)  |
| Resolution | Desktop (default of the `playwright.config.js` projects) |

**Test data:** use a unique e-mail per run (timestamp/UUID) to avoid signup
collisions, e.g. `qa.<timestamp>@mailinator.com`.

## 4. Critical observation about the application (verified on 25/10/2026)

The application is **100% client-side (mock)**: there are no network requests on
login/signup (confirmed via network trace). Consequences, already observed:

1. **Login does not validate credentials.** Any well-formed e-mail plus a
   non-empty password succeeds.
2. **Success messages** are shown in a **SweetAlert2** dialog (`swal2`).
3. **Validation present on login:** inline messages with the CSS class
   `invalid_input`:
   - `E-mail inválido.`
   - `Senha inválida.`
4. **Likely defect on signup:** when submitting empty fields or a malformed
   e-mail, **no message is shown** and the page stays on `/register` (the
   submission is silently blocked). Expected: feedback like login's (see
   CT-SIGN-02 and CT-SIGN-03).

> These points must be treated as expected "correct" result vs. current behavior.
> The cases below describe the expected; the observation column records what was
> actually observed.

## 5. Strategy

- **Level:** Functional E2E UI, with the Page Objects pattern
  (`pages/login.page.js`, `pages/signup.page.js`).
- **Structure:** each page exposes intent-revealing methods
  (`login(email, password)`, `signup(name, email, password)`), never raw
  selectors in specs.
- **Preferred locators:** `getByRole`, `getByLabel`, stable `#id`
  (`#user`, `#email`, `#password`) and the button by text (`login`,
  `Cadastrar`). Avoid structural CSS.
- **Assertions:** web-first (`await expect(...)`) over URLs, messages
  (`invalid_input`) and the success dialog. No `waitForTimeout`.
- **Isolation:** each test creates its own data; no order dependency.
- **Data:** unique e-mail per run.
- **Dialog handling:** success uses SweetAlert2 (DOM, not `window.alert`), so it
  can be located with `page.locator('.swal2-popup')`.

## 6. Test scenarios

### 6.1 Login

| ID         | Scenario                                               | Type     |
| ---------- | ------------------------------------------------------ | -------- |
| CEN-LOG-01 | Show the login form with the correct fields and labels | Positive |
| CEN-LOG-02 | Login with valid e-mail and password                   | Positive |
| CEN-LOG-03 | Login with empty fields                                | Negative |
| CEN-LOG-04 | Login with a malformed e-mail                          | Negative |
| CEN-LOG-05 | Login with an empty password and a valid e-mail        | Negative |
| CEN-LOG-06 | Tick "Lembrar de mim" and complete the login           | Positive |
| CEN-LOG-07 | Post-login navigation (redirect to `/my-account`)      | Positive |
| CEN-LOG-08 | Direct access to `/login` from the menu ("Login")      | Positive |

### 6.2 Signup

| ID          | Scenario                                                | Type     |
| ----------- | ------------------------------------------------------- | -------- |
| CEN-SIGN-01 | Show the signup form with the correct fields and labels | Positive |
| CEN-SIGN-02 | Signup with empty fields                                | Negative |
| CEN-SIGN-03 | Signup with a malformed e-mail                          | Negative |
| CEN-SIGN-04 | Signup with valid data                                  | Positive |
| CEN-SIGN-05 | Post-signup navigation (redirect to `/my-account`)      | Positive |
| CEN-SIGN-06 | Direct access to `/register` from the menu ("Cadastro") | Positive |

## 7. Test cases

Format: **ID — Title** · Priority · Tags · Precondition · Steps · Expected result.

### 7.1 Login

---

**CT-LOG-01 — Login form shown correctly**
Priority: High · Tags: `@smoke`
Precondition: none.
Steps:

1. Go to `/login`.
   Expected result:

- Visible fields: `E-mail*` (`#user`), `Senha*` (`#password`).
- "Lembrar de mim" checkbox visible.
- "LOGIN" button visible and enabled.

---

**CT-LOG-02 — Login with valid e-mail and password (@smoke)**
Priority: High · Tags: `@smoke`
Precondition: none (the app accepts any well-formed e-mail).
Steps:

1. Go to `/login`.
2. Fill `#user` with `qa.teste@mailinator.com`.
3. Fill `#password` with `SenhaForte123`.
4. Click "LOGIN".
   Expected result:

- A SweetAlert2 dialog appears with title **"Login realizado"** and text
  **"Olá, qa.teste@mailinator.com"**.
- On confirm ("OK"), the URL is `https://www.automationpratice.com.br/my-account`.
  Observations: verified — the redirect happens before the OK.

---

**CT-LOG-03 — Login with empty fields**
Priority: High · Tags: `@regression`
Steps:

1. Go to `/login`.
2. Click "LOGIN" without filling anything.
   Expected result:

- Stays on `/login`.
- The inline message `.invalid_input` = **"E-mail inválido."** is shown.
  Observations: verified.

---

**CT-LOG-04 — Login with a malformed e-mail**
Priority: High · Tags: `@regression`
Steps:

1. Go to `/login`.
2. `#user` = `abc`; `#password` = `123`.
3. Click "LOGIN".
   Expected result:

- Stays on `/login`.
- Message `.invalid_input` = **"E-mail inválido."**
  Observations: verified.

---

**CT-LOG-05 — Login with an empty password and a valid e-mail**
Priority: High · Tags: `@regression`
Steps:

1. Go to `/login`.
2. `#user` = `valido@teste.com`; `#password` empty.
3. Click "LOGIN".
   Expected result:

- Stays on `/login`.
- Message `.invalid_input` = **"Senha inválida."**
  Observations: verified.

---

**CT-LOG-06 — Tick "Lembrar de mim"**
Priority: Medium · Tags: `@regression`
Steps:

1. Go to `/login`.
2. Fill valid credentials.
3. Tick the "Lembrar de mim" checkbox (`#materialUnchecked`).
4. Click "LOGIN".
   Expected result:

- The checkbox is ticked before submitting.
- Login completes with the "Login realizado" dialog (same result as CT-LOG-02).
  Observations: **to confirm** — no additional effect (e.g. persistence) was
  observed from the checkbox; document the real behavior.

---

**CT-LOG-07 — Post-login redirect**
Priority: High · Tags: `@smoke`
Steps:

1. Complete a valid login (CT-LOG-02).
   Expected result:

- `page.url()` contains `/my-account`.
- The page shows a reference to the user (e.g. text with the given e-mail).

---

**CT-LOG-08 — Access login from the menu**
Priority: Low · Tags: `@regression`
Steps:

1. Go to the home `/`.
2. Click the "Login" link at the top.
   Expected result:

- URL = `/login` and the form is shown.

### 7.2 Signup

---

**CT-SIGN-01 — Signup form shown correctly**
Priority: High · Tags: `@smoke`
Steps:

1. Go to `/register`.
   Expected result:

- Heading "Cadastro de usuário".
- Visible fields: `Nome*` (`#user`), `E-mail*` (`#email`), `Senha*` (`#password`).
- "CADASTRAR" button visible and enabled.

---

**CT-SIGN-02 — Signup with empty fields**
Priority: High · Tags: `@regression`
Steps:

1. Go to `/register`.
2. Click "CADASTRAR" without filling anything.
   Expected result (correct):

- Stays on `/register` and shows **error feedback** (required-field messages).
  Current behavior (observed):
- Stays on `/register`, **with no message** shown.
  Observations: **likely defect** (S2) — missing feedback, inconsistent with login.

---

**CT-SIGN-03 — Signup with a malformed e-mail**
Priority: High · Tags: `@regression`
Steps:

1. Go to `/register`.
2. `#user` = `Fulano`; `#email` = `nao-eh-email`; `#password` = `123`.
3. Click "CADASTRAR".
   Expected result (correct):

- Stays on `/register` with an invalid-email message (e.g. "E-mail inválido.").
  Current behavior (observed):
- Stays on `/register`, **with no message**; no request is made.
  Observations: **likely defect** (S2).

---

**CT-SIGN-04 — Signup with valid data (@smoke)**
Priority: High · Tags: `@smoke`
Precondition: use a unique e-mail (`qa.<timestamp>@mailinator.com`).
Steps:

1. Go to `/register`.
2. `#user` = `QA Teste Automatizado`; `#email` = unique e-mail; `#password` = `SenhaForte123`.
3. Click "CADASTRAR".
   Expected result:

- SweetAlert2 dialog with title **"Cadastro realizado!"** and text
  **"Bem-vindo QA Teste Automatizado"**.
- Confirming ("OK") redirects to `/my-account`.
  Observations: verified.

---

**CT-SIGN-05 — Post-signup redirect**
Priority: High · Tags: `@smoke`
Steps:

1. Complete a valid signup (CT-SIGN-04).
   Expected result:

- `page.url()` contains `/my-account`.

---

**CT-SIGN-06 — Access signup from the menu**
Priority: Low · Tags: `@regression`
Steps:

1. Go to the home `/`.
2. Click the "Cadastro" link at the top.
   Expected result:

- URL = `/register` and the form is shown.

## 8. Traceability matrix

| Scenario    | Cases      |
| ----------- | ---------- |
| CEN-LOG-01  | CT-LOG-01  |
| CEN-LOG-02  | CT-LOG-02  |
| CEN-LOG-03  | CT-LOG-03  |
| CEN-LOG-04  | CT-LOG-04  |
| CEN-LOG-05  | CT-LOG-05  |
| CEN-LOG-06  | CT-LOG-06  |
| CEN-LOG-07  | CT-LOG-07  |
| CEN-LOG-08  | CT-LOG-08  |
| CEN-SIGN-01 | CT-SIGN-01 |
| CEN-SIGN-02 | CT-SIGN-02 |
| CEN-SIGN-03 | CT-SIGN-03 |
| CEN-SIGN-04 | CT-SIGN-04 |
| CEN-SIGN-05 | CT-SIGN-05 |
| CEN-SIGN-06 | CT-SIGN-06 |

## 9. Element map (for Page Objects)

| Element        | Login                                    | Signup                                       |
| -------------- | ---------------------------------------- | -------------------------------------------- |
| Name           | —                                        | `#user` (label "Nome*")                      |
| E-mail         | `#user` (label "E-mail*")                | `#email` (label "E-mail*")                   |
| Password       | `#password` (label "Senha*")             | `#password` (label "Senha*")                 |
| Remember me    | `#materialUnchecked` (checkbox)          | —                                            |
| Primary button | `button` text `login`                    | `button` text `Cadastrar`                    |
| Field error    | `.invalid_input`                         | `.invalid_input` (expected; absent today)    |
| Success        | `.swal2-popup` (title "Login realizado") | `.swal2-popup` (title "Cadastro realizado!") |
| Final URL      | `/my-account`                            | `/my-account`                                |

## 10. Automation plan (Playwright + Page Objects)

```text
pages/
  login.page.js      LoginPage: open(), fillEmail(), fillPassword(), rememberMe(), submit(), messages
  signup.page.js     SignupPage: open(), fill(...), submit(), messages, successDialog
  my-account.page.js MyAccountPage: (to define when we cover the logged-in area)
tests/
  login.spec.js      CT-LOG-01 .. CT-LOG-08
  signup.spec.js     CT-SIGN-01 .. CT-SIGN-06
tests/fixtures/
  users.js           unique-e-mail generator + default data
```

Initial configuration needed:

- Set `use.baseURL = 'https://www.automationpratice.com.br'` in
  `playwright.config.js` and use relative paths (`page.goto('/login')`).

Creation flow: `qa-lead` delegates to `page-object` (POM) and `spec-author`
(specs), then `test-runner` runs and `failure-triage` investigates failures.

## 11. Entry / exit criteria

**Entry**

- Site accessible and stable; plan approved.

**Exit**

- 100% of the `@smoke` cases running green.
- `@regression` cases executed, with the known defects (CT-SIGN-02/03)
  documented and reported, without masking the current behavior.

## 12. Risks and assumptions

- **Risk:** the site is a mock without a backend; a "valid login" depends only on
  the format — tests must not assume real authentication.
- **Risk:** dependency on an external network/site; consider `retries` and tag
  with `@external`.
- **Assumption:** `#user`, `#email`, `#password` and the button texts remain
  stable (id/text locators).
- **Risk:** signup data is not cleaned up (client-side mock); use unique e-mails
  per run.

## 13. Next steps

1. Approve this plan.
2. Implement `pages/login.page.js` and `pages/signup.page.js`.
3. Create `tests/login.spec.js` and `tests/signup.spec.js` from the cases.
4. Run with `qa_run_tests` / `npx playwright test` and report results.
