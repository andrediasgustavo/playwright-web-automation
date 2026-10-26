// @ts-check
/**
 * Page Object — Login (`/login`) — QAZANDO Shop E-Commerce.
 *
 * Locator strategy (verified against the live DOM on 2026-10-25):
 * - The visible labels ("E-mail*", "Senha*") are plain `<label>` elements with
 *   NO `for` attribute and the inputs are siblings, not children, so
 *   `getByLabel()` cannot resolve the text fields. The stable `#user` /
 *   `#password` ids are therefore used (documented fallback, per
 *   `.agents/skills/playwright-conventions`).
 * - The "Lembrar de mim" checkbox DOES have a proper label association
 *   (`<label for="materialUnchecked">`), so the accessible role locator is used.
 * - The form is rendered client-side ~300-400ms AFTER the `load` event, so
 *   `open()` waits for the first field to be visible instead of relying on
 *   `load` alone.
 *
 * Extends {@link BasePage} for the shared feedback locators
 * (`errorMessage`, `successDialog`, `successTitle`).
 */
import { BasePage } from './base.page.js'

export class LoginPage extends BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page)
  }

  /** E-mail field (`#user`). @returns {import('@playwright/test').Locator} */
  get emailInput() {
    return this.page.locator('#user')
  }

  /** Password field (`#password`). @returns {import('@playwright/test').Locator} */
  get passwordInput() {
    return this.page.locator('#password')
  }

  /** "Lembrar de mim" checkbox. @returns {import('@playwright/test').Locator} */
  get rememberMeCheckbox() {
    return this.page.getByRole('checkbox', { name: /lembrar de mim/i })
  }

  /** Login submit button. @returns {import('@playwright/test').Locator} */
  get submitButton() {
    return this.page.getByRole('button', { name: /login/i })
  }

  /** Opens the login page and waits for the form to be ready. */
  async open() {
    await this.page.goto('/login')
    await this.emailInput.waitFor({ state: 'visible' })
  }

  /** @param {string} email */
  async fillEmail(email) {
    await this.emailInput.fill(email)
  }

  /** @param {string} password */
  async fillPassword(password) {
    await this.passwordInput.fill(password)
  }

  /** Marks the "Lembrar de mim" checkbox. */
  async rememberMe() {
    await this.rememberMeCheckbox.check()
  }

  /** Submits the login form. */
  async submit() {
    await this.submitButton.click()
  }
}
