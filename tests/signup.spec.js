// @ts-check
import { test, expect } from '@playwright/test'

import { SignupPage } from '../pages/signup.page.js'
import { newUser } from './fixtures/users.js'

/**
 * Cases CT-SIGN-01 .. CT-SIGN-06 from the plan `docs/test-plan-login-signup.md`.
 *
 * REAL behavior of the AUT (verified in chromium on 2026-10-25):
 * - Valid signup: SweetAlert2 (`.swal2-title` = "Cadastro realizado!") plus a
 *   redirect to `/my-account`, which then shows the given NAME in the account
 *   header (`#userLogged` -> "Acompanhe seu pedido <nome>"). The dialog stays
 *   open over `/my-account`.
 * - DEFECT S2 (open): submitting with empty fields OR a malformed e-mail
 *   produces NO feedback at all — the page stays on `/register`, with no
 *   `.invalid_input` and no `.swal2-popup`. The submission is silent and the
 *   user cannot tell why the signup did not happen (inconsistent with login,
 *   which shows "E-mail inválido." / "Senha inválida."). CT-SIGN-02 and
 *   CT-SIGN-03 document that REAL behavior as normal tests; once the defect is
 *   fixed they will fail and should be promoted to "expects feedback".
 */
test.describe('User signup', () => {
  test(
    'CT-SIGN-01 shows the signup form with the required fields',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const signup = new SignupPage(page)

      await signup.open()

      await expect(signup.heading).toBeVisible()
      await expect(signup.nameInput).toBeVisible()
      await expect(signup.emailInput).toBeVisible()
      await expect(signup.passwordInput).toBeVisible()
      await expect(signup.submitButton).toBeVisible()
      await expect(signup.submitButton).toBeEnabled()
    }
  )

  // DEFECT S2 — silent block: submitting the empty form gives the user no
  // feedback (no `.invalid_input`, no `.swal2-popup`, no URL change).
  // Documented here as the REAL behavior of the AUT.
  test(
    'CT-SIGN-02 stays on /register with no feedback when submitting empty fields',
    { tag: ['@regression'] },
    async ({ page }) => {
      const signup = new SignupPage(page)

      await signup.open()
      await signup.submit()

      // Positive anchor: the click was processed and the form is still on screen
      // (nothing was navigated or re-rendered).
      await expect(page).toHaveURL(/\/register$/)
      await expect(signup.nameInput).toBeVisible()
      await expect(signup.nameInput).toHaveValue('')
      // Defect S2: total silence — neither an inline error nor a dialog.
      await expect(signup.errorMessage()).toHaveCount(0)
      await expect(signup.successDialog()).toHaveCount(0)
    }
  )

  // DEFECT S2 — a malformed e-mail also produces no feedback (no
  // `.invalid_input`, no `.swal2-popup`): the signup simply does not happen and
  // the reason is not shown to the user.
  test(
    'CT-SIGN-03 stays on /register with no feedback when submitting a malformed e-mail',
    { tag: ['@regression'] },
    async ({ page }) => {
      const signup = new SignupPage(page)

      await signup.open()
      await signup.fillName('John Doe')
      await signup.fillEmail('invalid-user')
      await signup.fillPassword('123')
      await signup.submit()

      await expect(page).toHaveURL(/\/register$/)
      // The typed values survive the submit: nothing was validated, cleared or
      // navigated.
      await expect(signup.nameInput).toHaveValue('John Doe')
      await expect(signup.emailInput).toHaveValue('invalid-user')
      // Defect S2: no malformed-format message (login shows "E-mail inválido."
      // in the same scenario).
      await expect(signup.errorMessage()).toHaveCount(0)
      await expect(signup.successDialog()).toHaveCount(0)
    }
  )

  test(
    'CT-SIGN-04 signs up with valid data and confirms success',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const signup = new SignupPage(page)
      const user = newUser()

      await signup.open()
      await signup.fillName(user.name)
      await signup.fillEmail(user.email)
      await signup.fillPassword(user.password)
      await signup.submit()

      await expect(signup.successDialog()).toBeVisible()
      await expect(signup.successTitle()).toHaveText('Cadastro realizado!')
      await expect(page).toHaveURL(/\/my-account/)
    }
  )

  test(
    'CT-SIGN-05 redirects to my-account and shows the registered name',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const signup = new SignupPage(page)
      const user = newUser()

      await signup.open()
      await signup.fillName(user.name)
      await signup.fillEmail(user.email)
      await signup.fillPassword(user.password)
      await signup.submit()

      await expect(page).toHaveURL(/\/my-account/)
      // The logged-in account shows the name in the header (`#userLogged` ->
      // "Acompanhe seu pedido <nome>"). Scoping by id is required because the
      // dialog stays open with the same string ("Bem-vindo <nome>"), which would
      // make `getByText(user.name)` ambiguous (strict mode).
      await expect(page.locator('#userLogged')).toContainText(user.name)
    }
  )

  test(
    'CT-SIGN-06 opens the signup form from the link in the home header',
    { tag: ['@regression'] },
    async ({ page }) => {
      const signup = new SignupPage(page)

      await page.goto('/')
      await page.getByRole('link', { name: 'Cadastro' }).click()

      await expect(page).toHaveURL(/\/register$/)
      await expect(signup.heading).toBeVisible()
    }
  )
})
