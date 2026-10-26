// @ts-check

/**
 * Test data shared by the authentication specs (login/signup).
 *
 * The AUT is a 100% client-side mock: login does not validate credentials (any
 * well-formed e-mail plus a non-empty password succeeds). The e-mail is
 * therefore just valid input data, not a pre-registered user.
 */

/**
 * Generates a unique e-mail per run, avoiding collisions between parallel tests.
 * @param {string} [prefix='qa'] Human-readable prefix of the address.
 * @returns {string} E-mail in the form `${prefix}.<uuid>@mailinator.com`.
 */
export function uniqueEmail(prefix = 'qa') {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}.${Math.floor(Math.random() * 1e6)}`

  return `${prefix}.${id}@mailinator.com`
}

/** Default credentials used by the login cases. */
export const loginCredentials = {
  email: 'qa.test@mailinator.com',
  password: 'StrongPassword123',
}

/**
 * New user (unique e-mail) for the signup and login flows.
 * @returns {{ name: string, email: string, password: string }}
 */
export function newUser() {
  return {
    name: 'QA Automated Test',
    email: uniqueEmail(),
    password: 'StrongPassword123',
  }
}
