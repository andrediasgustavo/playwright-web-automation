# Playwright Web Automation

A web automation project using Playwright for end-to-end testing.

## Project Structure

- `tests/` - Playwright test files
- `playwright.config.js` - Playwright configuration
- `package.json` - Project dependencies and scripts
- `.gitignore` - Git ignore file

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tests:
   ```bash
   npx playwright test
   ```

## Tests

This project contains example tests in the `tests/` directory. You can run specific tests or all tests:

```bash
# Run all tests
npx playwright test

# Run a specific test file
npx playwright test tests/example.spec.js

# Run tests in a specific browser
npx playwright test --browser chromium
```

## Technologies Used

- **Playwright** - End-to-end testing framework
- **Node.js** - JavaScript runtime
- **JavaScript** - Test automation language

## Configuration

The project uses Playwright with the following configuration:

- Browser: Chromium, Firefox, and WebKit
- Test timeout: 30 seconds
- Headless mode: Enabled by default

## Reporting

Test results are generated in the `test-results/` directory, and Playwright reports are available in the `playwright-report/` directory.

## License

ISC