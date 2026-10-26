// @ts-check
import { test, expect } from '@playwright/test'

import { LoginPage } from '../pages/login.page.js'
import { loginCredentials } from './fixtures/users.js'

/**
 * Cases CT-LOG-01 .. CT-LOG-08 from the plan `docs/test-plan-login-signup.md`.
 *
 * REAL behavior of the AUT (verified in chromium on 2026-10-25):
 * - It is a 100% client-side mock: login does NOT validate credentials. Any
 *   well-formed e-mail plus a non-empty password completes successfully.
 * - Success: SweetAlert2 (`.swal2-title` = "Login realizado") plus a redirect to
 *   `/my-account`, which then shows the given e-mail in the account header
 *   (`#userLogged` -> "Acompanhe seu pedido <e-mail>"). The dialog does NOT
 *   close on navigation, so it stays open over `/my-account` — which is why the
 *   success cases assert the URL before the dialog.
 * - Format error: inline feedback in `.invalid_input` ("E-mail inválido." /
 *   "Senha inválida.") and the URL stays on `/login`.
 * - "Lembrar de mim" (#materialUnchecked) only toggles the checkbox: it does NOT
 *   persist anything (`document.cookie` and `localStorage` stay empty), i.e.
 *   there is no real "remembered" session.
 */
test.describe('Login', () => {
  test(
    'CT-LOG-01 shows the login form with its fields, the remember-me checkbox and the LOGIN button',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()

      await expect(page).toHaveURL(/\/login\/?$/)
      await expect(loginPage.emailInput).toBeVisible()
      await expect(loginPage.passwordInput).toBeVisible()
      await expect(loginPage.rememberMeCheckbox).toBeVisible()
      await expect(loginPage.submitButton).toBeVisible()
      await expect(loginPage.submitButton).toBeEnabled()
    }
  )

  test(
    'CT-LOG-02 logs in with valid credentials and redirects to /my-account',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(loginCredentials.email)
      await loginPage.fillPassword(loginCredentials.password)
      await loginPage.submit()

      // URL first: the redirect is the event that marks the end of the flow. In
      // the reverse order the dialog could be evaluated mid-navigation.
      await expect(page).toHaveURL(/\/my-account\/?$/)
      await expect(loginPage.successDialog()).toBeVisible()
      await expect(loginPage.successTitle()).toHaveText('Login realizado')
      await expect(loginPage.successDialog()).toContainText(loginCredentials.email)
    }
  )

  test(
    'CT-LOG-03 stays on /login and shows "E-mail inválido." when submitting empty',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.submit()

      await expect(page).toHaveURL(/\/login\/?$/)
      await expect(loginPage.errorMessage('E-mail inválido.')).toHaveText('E-mail inválido.')
    }
  )

  test(
    'CT-LOG-04 shows "E-mail inválido." with a malformed e-mail',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail('abc')
      await loginPage.fillPassword('123')
      await loginPage.submit()

      await expect(page).toHaveURL(/\/login\/?$/)
      await expect(loginPage.errorMessage('E-mail inválido.')).toHaveText('E-mail inválido.')
    }
  )

  test(
    'CT-LOG-05 shows "Senha inválida." with a valid e-mail and an empty password',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(loginCredentials.email)
      await loginPage.submit()

      await expect(page).toHaveURL(/\/login\/?$/)
      await expect(loginPage.errorMessage('Senha inválida.')).toHaveText('Senha inválida.')
    }
  )

  test(
    'CT-LOG-06 completes the login with the remember-me checkbox ticked',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(loginCredentials.email)
      await loginPage.fillPassword(loginCredentials.password)
      await loginPage.rememberMe()

      await expect(loginPage.rememberMeCheckbox).toBeChecked()

      await loginPage.submit()

      // No real persistence: the mock only ticks the checkbox in the UI — it
      // writes neither `document.cookie` nor `localStorage` (both stay empty after
      // login), so nothing is "remembered" on a next visit.
      await expect(page).toHaveURL(/\/my-account\/?$/)
      await expect(loginPage.successDialog()).toBeVisible()
      await expect(loginPage.successTitle()).toHaveText('Login realizado')
    }
  )

  test(
    'CT-LOG-07 redirects to /my-account and shows the account e-mail',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(loginCredentials.email)
      await loginPage.fillPassword(loginCredentials.password)
      await loginPage.submit()

      await expect(page).toHaveURL(/\/my-account\/?$/)
      // The logged-in account shows the e-mail in the header (`#userLogged`).
      // Scoping by id is required because the dialog stays open with the same
      // string ("Olá, <e-mail>"), which would make `getByText(email)` ambiguous
      // (strict mode).
      await expect(page.locator('#userLogged')).toContainText(loginCredentials.email)
    }
  )

  test(
    'CT-LOG-08 opens /login from the "Login" link in the home header',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await page.goto('/')
      await page.getByRole('link', { name: 'Login' }).click()

      await expect(page).toHaveURL(/\/login\/?$/)
      await expect(loginPage.emailInput).toBeVisible()
      await expect(loginPage.passwordInput).toBeVisible()
      await expect(loginPage.submitButton).toBeVisible()
    }
  )
})
