import js from '@eslint/js'
import playwright from 'eslint-plugin-playwright'
import globals from 'globals'

export default [
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.worktrees/**',
      '.husky/**',
      '.agents/**',
      '.opencode/**',
      '.playwright-mcp/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'no-console': 'warn',
    },
  },
  {
    files: ['tests/**/*.js', 'pages/**/*.js'],
    ...playwright.configs['flat/recommended'],
  },
]
