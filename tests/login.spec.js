// @ts-check
import { test, expect } from '@playwright/test'

import { LoginPage } from '../pages/login.page.js'
import { credenciaisLogin } from './fixtures/usuarios.js'

/**
 * Casos CT-LOG-01 .. CT-LOG-08 do plano
 * `docs/plano-de-testes-login-cadastro.md`.
 *
 * Comportamento REAL da AUT (verificado no chromium em 2026-10-25):
 * - É um mock 100% client-side: o login NÃO valida credenciais. Qualquer e-mail
 *   em formato válido + senha não vazia conclui com sucesso.
 * - Sucesso: SweetAlert2 (`.swal2-title` = "Login realizado") + redirect para
 *   `/my-account`, que passa a exibir o e-mail informado no cabeçalho da conta
 *   (`#userLogged` -> "Acompanhe seu pedido <e-mail>"). O diálogo NÃO fecha
 *   sozinho na navegação, então ele segue aberto sobre `/my-account` — por isso
 *   os casos de sucesso assertam a URL antes do diálogo.
 * - Erro de formato: feedback inline em `.invalid_input`
 *   ("E-mail inválido." / "Senha inválida.") e a URL permanece em `/login`.
 * - "Lembrar de mim" (#materialUnchecked) apenas marca/desmarca o checkbox: NÃO
 *   persiste nada (`document.cookie` e `localStorage` permanecem vazios), ou
 *   seja, não existe sessão "lembrada" de verdade.
 */
test.describe('Login', () => {
  test(
    'CT-LOG-01 exibe o formulário de login com campos, "Lembrar de mim" e LOGIN',
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
    'CT-LOG-02 realiza login com credenciais válidas e redireciona para /my-account',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(credenciaisLogin.email)
      await loginPage.fillPassword(credenciaisLogin.senha)
      await loginPage.submit()

      // URL primeiro: o redirect é o evento que confirma o fim do fluxo. Se a
      // ordem fosse invertida, o diálogo poderia ser avaliado durante a navegação.
      await expect(page).toHaveURL(/\/my-account\/?$/)
      await expect(loginPage.successDialog()).toBeVisible()
      await expect(loginPage.successTitle()).toHaveText('Login realizado')
      await expect(loginPage.successDialog()).toContainText(credenciaisLogin.email)
    }
  )

  test(
    'CT-LOG-03 mantém em /login e mostra "E-mail inválido." ao enviar vazio',
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
    'CT-LOG-04 mostra "E-mail inválido." com e-mail em formato inválido',
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
    'CT-LOG-05 mostra "Senha inválida." com e-mail válido e senha vazia',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(credenciaisLogin.email)
      await loginPage.submit()

      await expect(page).toHaveURL(/\/login\/?$/)
      await expect(loginPage.errorMessage('Senha inválida.')).toHaveText('Senha inválida.')
    }
  )

  test(
    'CT-LOG-06 conclui o login com "Lembrar de mim" marcado',
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(credenciaisLogin.email)
      await loginPage.fillPassword(credenciaisLogin.senha)
      await loginPage.rememberMe()

      await expect(loginPage.rememberMeCheckbox).toBeChecked()

      await loginPage.submit()

      // Sem persistência real: o mock só marca o checkbox na UI — não grava
      // `document.cookie` nem `localStorage` (ambos continuam vazios após o
      // login), então nada é "lembrado" em uma próxima visita.
      await expect(page).toHaveURL(/\/my-account\/?$/)
      await expect(loginPage.successDialog()).toBeVisible()
      await expect(loginPage.successTitle()).toHaveText('Login realizado')
    }
  )

  test(
    'CT-LOG-07 redireciona para /my-account e exibe o e-mail da conta',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.fillEmail(credenciaisLogin.email)
      await loginPage.fillPassword(credenciaisLogin.senha)
      await loginPage.submit()

      await expect(page).toHaveURL(/\/my-account\/?$/)
      // A conta logada exibe o e-mail no cabeçalho (`#userLogged`). O escopo pelo
      // id é necessário porque o diálogo continua aberto com a mesma string
      // ("Olá, <e-mail>"), o que tornaria `getByText(email)` ambíguo (strict mode).
      await expect(page.locator('#userLogged')).toContainText(credenciaisLogin.email)
    }
  )

  test(
    'CT-LOG-08 acessa /login pelo link "Login" do topo da home',
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
