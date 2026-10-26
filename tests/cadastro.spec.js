// @ts-check
import { test, expect } from '@playwright/test'

import { CadastroPage } from '../pages/cadastro.page.js'
import { novoUsuario } from './fixtures/usuarios.js'

/**
 * Casos CT-CAD-01 .. CT-CAD-06 do plano
 * `docs/plano-de-testes-login-cadastro.md`.
 *
 * Comportamento REAL da AUT (verificado no chromium em 2026-10-25):
 * - Cadastro válido: SweetAlert2 (`.swal2-title` = "Cadastro realizado!") +
 *   redirect para `/my-account`, que passa a exibir o NOME informado no
 *   cabeçalho da conta (`#userLogged` -> "Acompanhe seu pedido <nome>"). O
 *   diálogo segue aberto sobre `/my-account`.
 * - DEFEITO S2 (aberto): submeter com campos vazios OU com e-mail inválido não
 *   produz NENHUM feedback — a página permanece em `/register`, sem
 *   `.invalid_input` e sem `.swal2-popup`. A submissão é silenciosa e o usuário
 *   não sabe por que o cadastro não aconteceu (inconsistente com o login, que
 *   mostra "E-mail inválido." / "Senha inválida."). CT-CAD-02 e CT-CAD-03
 *   documentam esse comportamento REAL como testes normais; quando o defeito for
 *   corrigido, eles falham e devem ser promovidos a "espera feedback".
 */
test.describe('Cadastro de usuário', () => {
  test(
    'CT-CAD-01 exibe o formulário de cadastro com os campos obrigatórios',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const cadastro = new CadastroPage(page)

      await cadastro.open()

      await expect(cadastro.heading).toBeVisible()
      await expect(cadastro.nameInput).toBeVisible()
      await expect(cadastro.emailInput).toBeVisible()
      await expect(cadastro.passwordInput).toBeVisible()
      await expect(cadastro.submitButton).toBeVisible()
      await expect(cadastro.submitButton).toBeEnabled()
    }
  )

  // DEFEITO S2 — bloqueio silencioso: submeter o formulário vazio não produz
  // nenhum feedback ao usuário (nenhum `.invalid_input`, nenhum `.swal2-popup`,
  // sem mudança de URL). Documentado aqui como comportamento REAL da AUT.
  test(
    'CT-CAD-02 mantém em /register sem feedback ao submeter com campos vazios',
    { tag: ['@regression'] },
    async ({ page }) => {
      const cadastro = new CadastroPage(page)

      await cadastro.open()
      await cadastro.submit()

      // Âncora positiva: o clique foi processado e o formulário continua na tela
      // (nada foi navegado nem re-renderizado).
      await expect(page).toHaveURL(/\/register$/)
      await expect(cadastro.nameInput).toBeVisible()
      await expect(cadastro.nameInput).toHaveValue('')
      // Defeito S2: silêncio total — nem erro inline, nem diálogo.
      await expect(cadastro.errorMessage()).toHaveCount(0)
      await expect(cadastro.successDialog()).toHaveCount(0)
    }
  )

  // DEFEITO S2 — e-mail em formato inválido também não produz nenhum feedback
  // (nenhum `.invalid_input`, nenhum `.swal2-popup`): o cadastro simplesmente
  // não acontece e o motivo não é informado ao usuário.
  test(
    'CT-CAD-03 mantém em /register sem feedback ao submeter com e-mail inválido',
    { tag: ['@regression'] },
    async ({ page }) => {
      const cadastro = new CadastroPage(page)

      await cadastro.open()
      await cadastro.fillName('Fulano')
      await cadastro.fillEmail('fulano-invalido')
      await cadastro.fillPassword('123')
      await cadastro.submit()

      await expect(page).toHaveURL(/\/register$/)
      // Os valores digitados sobrevivem ao submit: nada foi validado, limpo ou
      // navegado.
      await expect(cadastro.nameInput).toHaveValue('Fulano')
      await expect(cadastro.emailInput).toHaveValue('fulano-invalido')
      // Defeito S2: nenhuma mensagem de formato inválido (o login exibe
      // "E-mail inválido." no mesmo cenário).
      await expect(cadastro.errorMessage()).toHaveCount(0)
      await expect(cadastro.successDialog()).toHaveCount(0)
    }
  )

  test(
    'CT-CAD-04 realiza cadastro com dados válidos e confirma o sucesso',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const cadastro = new CadastroPage(page)
      const usuario = novoUsuario()

      await cadastro.open()
      await cadastro.fillName(usuario.nome)
      await cadastro.fillEmail(usuario.email)
      await cadastro.fillPassword(usuario.senha)
      await cadastro.submit()

      await expect(cadastro.successDialog()).toBeVisible()
      await expect(cadastro.successTitle()).toHaveText('Cadastro realizado!')
      await expect(page).toHaveURL(/\/my-account/)
    }
  )

  test(
    'CT-CAD-05 redireciona para a minha conta e exibe o nome cadastrado',
    { tag: ['@smoke'] },
    async ({ page }) => {
      const cadastro = new CadastroPage(page)
      const usuario = novoUsuario()

      await cadastro.open()
      await cadastro.fillName(usuario.nome)
      await cadastro.fillEmail(usuario.email)
      await cadastro.fillPassword(usuario.senha)
      await cadastro.submit()

      await expect(page).toHaveURL(/\/my-account/)
      // A conta logada exibe o nome no cabeçalho (`#userLogged` -> "Acompanhe
      // seu pedido <nome>"). O escopo pelo id é necessário porque o diálogo
      // continua aberto com a mesma string ("Bem-vindo <nome>"), o que tornaria
      // `getByText(usuario.nome)` ambíguo (strict mode).
      await expect(page.locator('#userLogged')).toContainText(usuario.nome)
    }
  )

  test(
    'CT-CAD-06 acessa o cadastro pelo link do topo',
    { tag: ['@regression'] },
    async ({ page }) => {
      const cadastro = new CadastroPage(page)

      await page.goto('/')
      await page.getByRole('link', { name: 'Cadastro' }).click()

      await expect(page).toHaveURL(/\/register$/)
      await expect(cadastro.heading).toBeVisible()
    }
  )
})
