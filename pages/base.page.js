// @ts-check
/**
 * Page Object base — shared building blocks for the QAZANDO Shop E-Commerce.
 *
 * Owns the cross-page feedback locators that used to be duplicated in
 * `login.page.js` and `cadastro.page.js`:
 * - `.invalid_input` — inline field validation message.
 * - `.swal2-popup`   — SweetAlert2 success dialog (and its `.swal2-title`).
 *
 * Subclasses declare their own fields/buttons and expose intent-revealing
 * methods; assertions stay in the specs, never here.
 */
export class BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
  }

  /**
   * Inline field validation messages (e.g. "E-mail inválido.").
   * @param {string} [text] Optional message text to narrow the match, e.g.
   *   'Senha inválida.' — omitted, every message on screen is matched.
   * @returns {import('@playwright/test').Locator}
   */
  errorMessage(text) {
    return this.page.locator('.invalid_input', { hasText: text })
  }

  /**
   * SweetAlert2 success dialog (first instance).
   * @returns {import('@playwright/test').Locator}
   */
  successDialog() {
    return this.page.locator('.swal2-popup').first()
  }

  /**
   * Title inside the success dialog (e.g. "Login realizado").
   * @returns {import('@playwright/test').Locator}
   */
  successTitle() {
    return this.page.locator('.swal2-popup .swal2-title')
  }
}
