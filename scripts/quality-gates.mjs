#!/usr/bin/env node
// Quality gates — barra código/config ruim antes do commit (husky) e no CI.
// Uso: node scripts/quality-gates.mjs   (ou: npm run gates)
// Sem dependências externas — apenas Node stdlib.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const failures = []
const passes = []

const fail = (msg) => failures.push(msg)

const walk = (dir, exts, out = []) => {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, exts, out)
    else if (exts.some((e) => full.endsWith(e))) out.push(full)
  }
  return out
}

// 1) Anti-padrões de teste em tests/ e pages/
const FORBIDDEN = [
  { re: /\btest\.only\b|\bfit\(|\bfdescribe\(|\.only\(/, msg: 'test.only/fit/fdescribe proibido' },
  { re: /waitForTimeout\s*\(/, msg: 'waitForTimeout proibido (use web-first assertions)' },
  { re: /page\.pause\s*\(/, msg: 'page.pause() de debug não pode subir' },
  {
    re: /waitForLoadState\(\s*['"`]networkidle['"`]/,
    msg: "waitForLoadState('networkidle') proibido",
  },
  {
    re: /goto\(\s*['"`]https?:\/\//,
    msg: 'URL absoluta em goto() — use caminho relativo + baseURL',
  },
  { re: /console\.log\s*\(/, msg: 'console.log esquecido no código de teste' },
]
const srcFiles = [...walk(join(root, 'tests'), ['.js']), ...walk(join(root, 'pages'), ['.js'])]
for (const file of srcFiles) {
  const rel = relative(root, file)
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const { re, msg } of FORBIDDEN) {
        if (re.test(line)) fail(`${rel}:${i + 1} — ${msg}`)
      }
    })
}
passes.push(`${srcFiles.length} arquivos de teste varridos por anti-padrões`)

// 2) Convenções de nomenclatura
for (const f of readdirSync(join(root, 'tests'))) {
  const full = join(root, 'tests', f)
  if (statSync(full).isFile() && !f.endsWith('.spec.js')) {
    fail(`tests/${f} — specs devem terminar em .spec.js`)
  }
}
if (existsSync(join(root, 'pages'))) {
  for (const f of readdirSync(join(root, 'pages'))) {
    if (!f.endsWith('.page.js')) fail(`pages/${f} — page objects devem terminar em .page.js`)
  }
}
passes.push('nomenclatura *.spec.js / *.page.js verificada')

// 3) JSONs de configuração parseiam
for (const j of ['package.json', 'tsconfig.json', '.prettierrc.json', '.lintstagedrc.json']) {
  const full = join(root, j)
  if (!existsSync(full)) continue
  try {
    JSON.parse(readFileSync(full, 'utf8'))
  } catch (e) {
    fail(`${j} inválido: ${e.message}`)
  }
}
passes.push('JSONs de configuração válidos')

// 4) package.json: ESM + scripts essenciais
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (pkg.type !== 'module') fail('package.json sem "type": "module" (código é ESM)')
if (pkg.main) fail('package.json com "main" — este repo não é uma lib')
for (const s of ['test', 'test:smoke', 'typecheck', 'lint', 'format:check', 'gates']) {
  if (!pkg.scripts?.[s]) fail(`package.json sem script "${s}"`)
}
passes.push('package.json (type/scripts) ok')

// 5) playwright.config.js: guards mínimos
const cfg = readFileSync(join(root, 'playwright.config.js'), 'utf8')
if (!/forbidOnly:\s*true/.test(cfg)) fail('playwright.config.js deve ter forbidOnly: true')
if (!/process\.env\.BASE_URL/.test(cfg)) {
  fail('baseURL deve aceitar override via process.env.BASE_URL')
}
passes.push('playwright.config.js (forbidOnly/baseURL) ok')

// 6) Lockfile presente (CI usa npm ci)
if (!existsSync(join(root, 'package-lock.json'))) {
  fail('package-lock.json ausente (CI usa npm ci)')
} else {
  passes.push('package-lock.json presente')
}

// 7) CI: workflows essenciais existem
for (const w of [
  '.github/workflows/playwright.yml',
  '.github/workflows/quality.yml',
  '.github/workflows/pr-checks.yml',
]) {
  if (!existsSync(join(root, w))) fail(`workflow ausente: ${w}`)
}
passes.push('workflows CI presentes')

process.stdout.write('QUALITY GATES\n')
for (const p of passes) process.stdout.write(`  ok  ${p}\n`)
if (failures.length) {
  process.stderr.write(`\n${failures.length} problema(s):\n`)
  for (const f of failures) process.stderr.write(`  ERRO  ${f}\n`)
  process.exit(1)
}
process.stdout.write('\nTodos os gates passaram.\n')
