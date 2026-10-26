// @ts-check

/**
 * Dados de teste compartilhados pelos specs de autenticação (login/cadastro).
 *
 * A AUT é um mock 100% client-side: o login não valida credenciais (qualquer
 * e-mail em formato válido + senha não vazia conclui com sucesso). Por isso o
 * e-mail é apenas um dado de entrada válido, e não um usuário pré-cadastrado.
 */

/**
 * Gera um e-mail único por execução, evitando colisão entre testes paralelos.
 * @param {string} [prefix='qa'] Prefixo legível do endereço.
 * @returns {string} E-mail no formato `${prefix}.<uuid>@mailinator.com`.
 */
export function uniqueEmail(prefix = 'qa') {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}.${Math.floor(Math.random() * 1e6)}`

  return `${prefix}.${id}@mailinator.com`
}

/** Credenciais padrão usadas nos casos de login. */
export const credenciaisLogin = {
  email: 'qa.teste@mailinator.com',
  senha: 'SenhaForte123',
}

/**
 * Usuário novo (e-mail único) para os fluxos de cadastro e login.
 * @returns {{ nome: string, email: string, senha: string }}
 */
export function novoUsuario() {
  return {
    nome: 'QA Teste Automatizado',
    email: uniqueEmail(),
    senha: 'SenhaForte123',
  }
}
