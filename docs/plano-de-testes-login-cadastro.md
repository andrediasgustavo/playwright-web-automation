# Plano de Testes — Autenticação (Login e Cadastro)

**Aplicação sob teste (AUT):** QAZANDO Shop E-Commerce — https://www.automationpratice.com.br/
**Escopo deste plano:** Cadastro de usuário e Login
**Tipo:** Testes funcionais E2E (UI) — Playwright
**Versão do plano:** 1.0
**Data:** 25/10/2026

---

## 1. Objetivo

Definir a estratégia, os cenários e os casos de teste para as funcionalidades de
**Cadastro** e **Login**, servindo de base para a automação em Playwright com o
padrão **Page Objects** (ver `.agents/skills/playwright-conventions`).

## 2. Escopo

### Dentro do escopo

- Cadastro de novo usuário (`/register`)
- Login (`/login`)
- Validações de campos (obrigatoriedade e formato)
- Comportamento de "Lembrar de mim"
- Redirecionamento pós-ação (`/my-account`)
- Mensagens de feedback (erro e sucesso)

### Fora do escopo (neste momento)

- Recuperação de senha / alteração de senha
- Checkout, carrinho, wishlist e demais fluxos da loja
- Autorização/perfis, integração com backend real (ver item 4)

## 3. Ambiente e dados

| Item        | Valor                                                   |
| ----------- | ------------------------------------------------------- |
| URL base    | `https://www.automationpratice.com.br`                  |
| Login       | `https://www.automationpratice.com.br/login`            |
| Cadastro    | `https://www.automationpratice.com.br/register`         |
| Área logada | `https://www.automationpratice.com.br/my-account`       |
| Navegadores | Chromium, Firefox, WebKit (projetos já configurados)    |
| Resolução   | Desktop (padrão dos projetos do `playwright.config.js`) |

**Dados de teste:** usar e-mail único por execução (timestamp/UUID) para evitar
colisão de cadastro, ex.: `qa.<timestamp>@mailinator.com`.

## 4. Observação crítica sobre a aplicação (verificada em 25/10/2026)

A aplicação é **100% client-side (mock)**: não há requisições de rede no
login/cadastro (confirmado via network trace). Consequências, já observadas:

1. **O login não valida credenciais.** Qualquer e-mail em formato válido + senha
   não vazia resulta em sucesso.
2. **Mensagens de sucesso** são exibidas em diálogo **SweetAlert2** (`swal2`).
3. **Validação existente no login:** mensagens inline com a classe CSS
   `invalid_input`:
   - `E-mail inválido.`
   - `Senha inválida.`
4. **Provável defeito no cadastro:** ao enviar com campos vazios ou e-mail de
   formato inválido, **nenhuma mensagem é exibida** e a página permanece em
   `/register` (o envio é bloqueado silenciosamente). Esperado: feedback igual ao
   do login (ver CT-CAD-02 e CT-CAD-03).

> Esses pontos devem ser tratados como **resultado esperado "correto" x
> comportamento atual**. Os casos abaixo descrevem o esperado; a coluna de
> observações marca o que foi constatado.

## 5. Estratégia

- **Nível:** E2E funcional de UI, com o padrão Page Objects
  (`pages/login.page.js`, `pages/cadastro.page.js`).
- **Estrutura:** cada página expõe métodos de intenção (`login(email, senha)`,
  `cadastrar(nome, email, senha)`), nunca seletores crus nos specs.
- **Localizadores prioritários:** `getByRole`, `getByLabel`, `#id` estável
  (`#user`, `#email`, `#password`) e o botão por texto (`Entrar`/`login`,
  `Cadastrar`). Evitar CSS estrutural.
- **Asserções:** web-first (`await expect(...)`) sobre URLs, mensagens
  (`invalid_input`) e o diálogo de sucesso. Sem `waitForTimeout`.
- **Isolamento:** cada teste cria seus próprios dados; sem dependência de ordem.
- **Dados:** e-mail único por execução.
- **Tratamento de diálogo:** o sucesso usa SweetAlert2 (DOM, não `window.alert`),
  então dá para localizar com `page.locator('.swal2-popup')`.

## 6. Cenários de Teste

### 6.1 Login

| ID         | Cenário                                                       | Tipo     |
| ---------- | ------------------------------------------------------------- | -------- |
| CEN-LOG-01 | Exibir o formulário de login com os campos e rótulos corretos | Positivo |
| CEN-LOG-02 | Login com e-mail e senha válidos                              | Positivo |
| CEN-LOG-03 | Login com campos vazios                                       | Negativo |
| CEN-LOG-04 | Login com e-mail em formato inválido                          | Negativo |
| CEN-LOG-05 | Login com senha vazia e e-mail válido                         | Negativo |
| CEN-LOG-06 | Marcar "Lembrar de mim" e concluir o login                    | Positivo |
| CEN-LOG-07 | Navegação pós-login (redirecionamento para `/my-account`)     | Positivo |
| CEN-LOG-08 | Acesso direto a `/login` a partir do menu ("Login")           | Positivo |

### 6.2 Cadastro

| ID         | Cenário                                                          | Tipo     |
| ---------- | ---------------------------------------------------------------- | -------- |
| CEN-CAD-01 | Exibir o formulário de cadastro com os campos e rótulos corretos | Positivo |
| CEN-CAD-02 | Cadastro com campos vazios                                       | Negativo |
| CEN-CAD-03 | Cadastro com e-mail em formato inválido                          | Negativo |
| CEN-CAD-04 | Cadastro com dados válidos                                       | Positivo |
| CEN-CAD-05 | Navegação pós-cadastro (redirecionamento para `/my-account`)     | Positivo |
| CEN-CAD-06 | Acesso direto a `/register` a partir do menu ("Cadastro")        | Positivo |

## 7. Casos de Teste

Formato: **ID — Título** · Prioridade · Tags · Pré-condição · Passos · Resultado
esperado.

### 7.1 Login

---

**CT-LOG-01 — Formulário de login exibido corretamente**
Prioridade: Alta · Tags: `@smoke`
Pré-condição: nenhuma.
Passos:

1. Acessar `/login`.
   Resultado esperado:

- Campos visíveis: `E-mail*` (`#user`), `Senha*` (`#password`).
- Checkbox "Lembrar de mim" visível.
- Botão "LOGIN" visível e habilitado.

---

**CT-LOG-02 — Login com e-mail e senha válidos (@smoke)**
Prioridade: Alta · Tags: `@smoke`
Pré-condição: nenhuma (a app aceita qualquer e-mail em formato válido).
Passos:

1. Acessar `/login`.
2. Preencher `#user` com `qa.teste@mailinator.com`.
3. Preencher `#password` com `SenhaForte123`.
4. Clicar em "LOGIN".
   Resultado esperado:

- É exibido o diálogo SweetAlert2 com título **"Login realizado"** e texto
  **"Olá, qa.teste@mailinator.com"**.
- Ao confirmar ("OK"), a URL é `https://www.automationpratice.com.br/my-account`.
  Observações: verificado — o redirecionamento ocorre já antes do OK.

---

**CT-LOG-03 — Login com campos vazios**
Prioridade: Alta · Tags: `@regression`
Passos:

1. Acessar `/login`.
2. Clicar em "LOGIN" sem preencher nada.
   Resultado esperado:

- Permanece em `/login`.
- É exibida a mensagem inline `.invalid_input` = **"E-mail inválido."**
  Observações: verificado.

---

**CT-LOG-04 — Login com e-mail em formato inválido**
Prioridade: Alta · Tags: `@regression`
Passos:

1. Acessar `/login`.
2. `#user` = `abc`; `#password` = `123`.
3. Clicar em "LOGIN".
   Resultado esperado:

- Permanece em `/login`.
- Mensagem `.invalid_input` = **"E-mail inválido."**
  Observações: verificado.

---

**CT-LOG-05 — Login com senha vazia e e-mail válido**
Prioridade: Alta · Tags: `@regression`
Passos:

1. Acessar `/login`.
2. `#user` = `valido@teste.com`; `#password` vazio.
3. Clicar em "LOGIN".
   Resultado esperado:

- Permanece em `/login`.
- Mensagem `.invalid_input` = **"Senha inválida."**
  Observações: verificado.

---

**CT-LOG-06 — Marcar "Lembrar de mim"**
Prioridade: Média · Tags: `@regression`
Passos:

1. Acessar `/login`.
2. Preencher credenciais válidas.
3. Marcar o checkbox "Lembrar de mim" (`#materialUnchecked`).
4. Clicar em "LOGIN".
   Resultado esperado:

- O checkbox fica marcado antes do envio.
- Login conclui com o diálogo "Login realizado" (mesmo resultado do CT-LOG-02).
  Observações: **a confirmar** — não foi observado efeito adicional (ex.: persistência)
  decorrente do checkbox; documentar o comportamento real.

---

**CT-LOG-07 — Redirecionamento pós-login**
Prioridade: Alta · Tags: `@smoke`
Passos:

1. Concluir um login válido (CT-LOG-02).
   Resultado esperado:

- `page.url()` contém `/my-account`.
- A página exibe a referência ao usuário (ex.: texto com o e-mail informado).

---

**CT-LOG-08 — Acesso ao login pelo menu**
Prioridade: Baixa · Tags: `@regression`
Passos:

1. Acessar a home `/`.
2. Clicar no link "Login" do topo.
   Resultado esperado:

- URL = `/login` e o formulário é exibido.

### 7.2 Cadastro

---

**CT-CAD-01 — Formulário de cadastro exibido corretamente**
Prioridade: Alta · Tags: `@smoke`
Passos:

1. Acessar `/register`.
   Resultado esperado:

- Título "Cadastro de usuário".
- Campos visíveis: `Nome*` (`#user`), `E-mail*` (`#email`), `Senha*` (`#password`).
- Botão "CADASTRAR" visível e habilitado.

---

**CT-CAD-02 — Cadastro com campos vazios**
Prioridade: Alta · Tags: `@regression`
Passos:

1. Acessar `/register`.
2. Clicar em "CADASTRAR" sem preencher nada.
   Resultado esperado (correto):

- Permanece em `/register` e há **feedback de erro** (mensagens de campo obrigatório).
  Comportamento atual (constatado):
- Permanece em `/register`, **sem nenhuma mensagem** exibida.
  Observações: **provável defeito** (S2) — falta de feedback, inconsistente com o login.

---

**CT-CAD-03 — Cadastro com e-mail em formato inválido**
Prioridade: Alta · Tags: `@regression`
Passos:

1. Acessar `/register`.
2. `#user` = `Fulano`; `#email` = `nao-eh-email`; `#password` = `123`.
3. Clicar em "CADASTRAR".
   Resultado esperado (correto):

- Permanece em `/register` com mensagem de e-mail inválido (ex.: "E-mail inválido.").
  Comportamento atual (constatado):
- Permanece em `/register`, **sem mensagem**; nenhuma requisição é feita.
  Observações: **provável defeito** (S2).

---

**CT-CAD-04 — Cadastro com dados válidos (@smoke)**
Prioridade: Alta · Tags: `@smoke`
Pré-condição: usar e-mail único (`qa.<timestamp>@mailinator.com`).
Passos:

1. Acessar `/register`.
2. `#user` = `QA Teste Automatizado`; `#email` = e-mail único; `#password` = `SenhaForte123`.
3. Clicar em "CADASTRAR".
   Resultado esperado:

- Diálogo SweetAlert2 com título **"Cadastro realizado!"** e texto
  **"Bem-vindo QA Teste Automatizado"**.
- Confirmar ("OK") redireciona para `/my-account`.
  Observações: verificado.

---

**CT-CAD-05 — Redirecionamento pós-cadastro**
Prioridade: Alta · Tags: `@smoke`
Passos:

1. Concluir um cadastro válido (CT-CAD-04).
   Resultado esperado:

- `page.url()` contém `/my-account`.

---

**CT-CAD-06 — Acesso ao cadastro pelo menu**
Prioridade: Baixa · Tags: `@regression`
Passos:

1. Acessar a home `/`.
2. Clicar no link "Cadastro" do topo.
   Resultado esperado:

- URL = `/register` e o formulário é exibido.

## 8. Matriz de rastreabilidade

| Cenário    | Casos     |
| ---------- | --------- |
| CEN-LOG-01 | CT-LOG-01 |
| CEN-LOG-02 | CT-LOG-02 |
| CEN-LOG-03 | CT-LOG-03 |
| CEN-LOG-04 | CT-LOG-04 |
| CEN-LOG-05 | CT-LOG-05 |
| CEN-LOG-06 | CT-LOG-06 |
| CEN-LOG-07 | CT-LOG-07 |
| CEN-LOG-08 | CT-LOG-08 |
| CEN-CAD-01 | CT-CAD-01 |
| CEN-CAD-02 | CT-CAD-02 |
| CEN-CAD-03 | CT-CAD-03 |
| CEN-CAD-04 | CT-CAD-04 |
| CEN-CAD-05 | CT-CAD-05 |
| CEN-CAD-06 | CT-CAD-06 |

## 9. Mapa de elementos (para Page Objects)

| Elemento        | Login                                     | Cadastro                                      |
| --------------- | ----------------------------------------- | --------------------------------------------- |
| Nome            | —                                         | `#user` (label "Nome*")                       |
| E-mail          | `#user` (label "E-mail*")                 | `#email` (label "E-mail*")                    |
| Senha           | `#password` (label "Senha*")              | `#password` (label "Senha*")                  |
| Lembrar de mim  | `#materialUnchecked` (checkbox)           | —                                             |
| Botão principal | `button` texto `login`                    | `button` texto `Cadastrar`                    |
| Erro de campo   | `.invalid_input`                          | `.invalid_input` (esperado; hoje ausente)     |
| Sucesso         | `.swal2-popup` (título "Login realizado") | `.swal2-popup` (título "Cadastro realizado!") |
| URL final       | `/my-account`                             | `/my-account`                                 |

## 10. Plano de automação (Playwright + Page Objects)

```text
pages/
  login.page.js      LoginPage: open(), fillEmail(), fillPassword(), rememberMe(), submit(), messages
  cadastro.page.js   CadastroPage: open(), fill(...), submit(), messages, successDialog
  my-account.page.js MyAccountPage: (a definir quando cobrirmos a área logada)
tests/
  login.spec.js      CT-LOG-01 .. CT-LOG-08
  cadastro.spec.js   CT-CAD-01 .. CT-CAD-06
tests/fixtures/
  usuarios.js        gerador de e-mail único + dados padrão
```

Configuração inicial necessária:

- Definir `use.baseURL = 'https://www.automationpratice.com.br'` em
  `playwright.config.js` e usar caminhos relativos (`page.goto('/login')`).

Fluxo de criação: `qa-lead` delega a `page-object` (POM) e `spec-author` (specs),
depois `test-runner` executa e `failure-triage` investiga falhas.

## 11. Critérios de entrada / saída

**Entrada**

- Site acessível e estável; plano aprovado.

**Saída**

- 100% dos casos `@smoke` executando verde.
- Casos `@regression` executados, com os defeitos conhecidos (CT-CAD-02/03)
  documentados e com `test.fixme`/reporte, sem mascarar o comportamento atual.

## 12. Riscos e premissas

- **Risco:** o site é um mock sem backend; "login válido" depende apenas do
  formato — testes não devem assumir autenticação real.
- **Risco:** dependência de rede/site externo; considerar `retries` e marcar
  como `@external`.
- **Premissa:** `#user`, `#email`, `#password` e os textos dos botões permanecem
  estáveis (localizadores por id/texto).
- **Risco:** dados de cadastro não são limpos (mock client-side); usar e-mails
  únicos por execução.

## 13. Próximos passos

1. Aprovar este plano.
2. Implementar `pages/login.page.js` e `pages/cadastro.page.js`.
3. Criar `tests/login.spec.js` e `tests/cadastro.spec.js` a partir dos casos.
4. Rodar com `qa_run_tests` / `npx playwright test` e reportar resultados.
