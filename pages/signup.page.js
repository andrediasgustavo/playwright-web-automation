// @ts-check
/**
 * Page Object — Signup (`/register`) — QAZANDO Shop E-Commerce.
 *
 * Locator strategy (verified against the live DOM on 2026-10-25):
 * - The visible labels ("Nome*", "E-mail*", "Senha*") are plain `<label>`
 *   elements with NO `for` attribute and the inputs are siblings, not children,
 *   so `getByLabel()` cannot resolve them. The stable `#user` / `#email` /
 *   `#password` ids are therefore used (documented fallback, per
 *   `.agents/skills/playwright-conventions`).
 * - The form is rendered client-side ~300-400ms AFTER the `load` event, so
 *   `open()` waits for the first field to be visible instead of relying on
 *   `load` alone.
 * - `.invalid_input` (inline error) is currently absent on this page: submitting
 *   with empty/invalid data shows no feedback (known defect, CT-SIGN-02/03).
 *
 * Extends {@link BasePage} for the shared feedback locators
 * (`errorMessage`, `successDialog`, `successTitle`).
 */
import { BasePage } from './base.page.js'

export class SignupPage extends BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page)
  }

  /** Name field (`#user`). @returns {import('@playwright/test').Locator} */
  get nameInput() {
    return this.page.locator('#user')
  }

  /** E-mail field (`#email`). @returns {import('@playwright/test').Locator} */
  get emailInput() {
    return this.page.locator('#email')
  }

  /** Password field (`#password`). @returns {import('@playwright/test').Locator} */
  get passwordInput() {
    return this.page.locator('#password')
  }

  /** Signup submit button. @returns {import('@playwright/test').Locator} */
  get submitButton() {
    return this.page.getByRole('button', { name: /cadastrar/i })
  }

  /** Page heading. @returns {import('@playwright/test').Locator} */
  get heading() {
    return this.page.getByRole('heading', { name: 'Cadastro de usuário' })
  }

  /** Opens the registration page and waits for the form to be ready. */
  async open() {
    await this.page.goto('/register')
    await this.nameInput.waitFor({ state: 'visible' })
  }

  /** @param {string} name */
  async fillName(name) {
    await this.nameInput.fill(name)
  }

  /** @param {string} email */
  async fillEmail(email) {
    await this.emailInput.fill(email)
  }

  /** @param {string} password */
  async fillPassword(password) {
    await this.passwordInput.fill(password)
  }

  /** Submits the registration form. */
  async submit() {
    await this.submitButton.click()
  }
}
