#!/usr/bin/env node
// Quality gates — block bad code/config before commit (husky) and in CI.
// Usage: node scripts/quality-gates.mjs   (or: npm run gates)
// No external dependencies — Node stdlib only.
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

// 1) Test anti-patterns in tests/ and pages/
const FORBIDDEN = [
  { re: /\btest\.only\b|\bfit\(|\bfdescribe\(|\.only\(/, msg: 'test.only/fit/fdescribe forbidden' },
  { re: /waitForTimeout\s*\(/, msg: 'waitForTimeout forbidden (use web-first assertions)' },
  { re: /page\.pause\s*\(/, msg: 'debug page.pause() must not be committed' },
  {
    re: /waitForLoadState\(\s*['"`]networkidle['"`]/,
    msg: "waitForLoadState('networkidle') forbidden",
  },
  {
    re: /goto\(\s*['"`]https?:\/\//,
    msg: 'absolute URL in goto() — use a relative path + baseURL',
  },
  { re: /console\.log\s*\(/, msg: 'leftover console.log in test code' },
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
passes.push(`${srcFiles.length} test files scanned for anti-patterns`)

// 2) Naming conventions
for (const f of readdirSync(join(root, 'tests'))) {
  const full = join(root, 'tests', f)
  if (statSync(full).isFile() && !f.endsWith('.spec.js')) {
    fail(`tests/${f} — specs must end in .spec.js`)
  }
}
if (existsSync(join(root, 'pages'))) {
  for (const f of readdirSync(join(root, 'pages'))) {
    if (!f.endsWith('.page.js')) fail(`pages/${f} — page objects must end in .page.js`)
  }
}
passes.push('*.spec.js / *.page.js naming verified')

// 3) Config JSONs parse
for (const j of ['package.json', 'tsconfig.json', '.prettierrc.json', '.lintstagedrc.json']) {
  const full = join(root, j)
  if (!existsSync(full)) continue
  try {
    JSON.parse(readFileSync(full, 'utf8'))
  } catch (e) {
    fail(`${j} invalid: ${e.message}`)
  }
}
passes.push('config JSONs are valid')

// 4) package.json: ESM + essential scripts
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (pkg.type !== 'module') fail('package.json missing "type": "module" (code is ESM)')
if (pkg.main) fail('package.json has "main" — this repo is not a library')
for (const s of ['test', 'test:smoke', 'typecheck', 'lint', 'format:check', 'gates']) {
  if (!pkg.scripts?.[s]) fail(`package.json missing "${s}" script`)
}
passes.push('package.json (type/scripts) ok')

// 5) playwright.config.js: minimum guards
const cfg = readFileSync(join(root, 'playwright.config.js'), 'utf8')
if (!/forbidOnly:\s*true/.test(cfg)) fail('playwright.config.js must set forbidOnly: true')
if (!/process\.env\.BASE_URL/.test(cfg)) {
  fail('baseURL must accept an override via process.env.BASE_URL')
}
passes.push('playwright.config.js (forbidOnly/baseURL) ok')

// 6) Lockfile present (CI uses npm ci)
if (!existsSync(join(root, 'package-lock.json'))) {
  fail('package-lock.json missing (CI uses npm ci)')
} else {
  passes.push('package-lock.json present')
}

// 7) CI: essential workflows exist
for (const w of [
  '.github/workflows/playwright.yml',
  '.github/workflows/quality.yml',
  '.github/workflows/pr-checks.yml',
]) {
  if (!existsSync(join(root, w))) fail(`workflow missing: ${w}`)
}
passes.push('CI workflows present')

process.stdout.write('QUALITY GATES\n')
for (const p of passes) process.stdout.write(`  ok  ${p}\n`)
if (failures.length) {
  process.stderr.write(`\n${failures.length} problem(s):\n`)
  for (const f of failures) process.stderr.write(`  ERROR  ${f}\n`)
  process.exit(1)
}
process.stdout.write('\nAll gates passed.\n')
