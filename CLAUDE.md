# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Playwright project that showcases LLM-assisted development. It has a self-discovering test framework and a Vue coverage dashboard. The default target is https://automationexercise.com. The original automationpractice.com is dead, and its `.pl` mirror redirects to ad sites, so don't point tests at it.

## Commands

- `npm test`: builds the dashboard, re-crawls the site if the inventory is stale, then runs all tests and writes `coverage-report/index.html`
- `npm run discover`: forces a crawl, writing `.discovery/<site>.json`
- Single file: `npx playwright test tests/flows/cart.spec.ts`. Single test: add `-g "<title>"`
- `npm run test:authored` / `npm run test:discovered`: only hand-written / only generated tests
- `npm run typecheck`: `tsc` for framework and tests, `vue-tsc` for the dashboard. There is no linter
- `npm run dashboard:dev`: Vite dev server for the dashboard, reading the last run's `coverage-report/coverage.json`

## Architecture

- `sites/<name>.ts`: a site profile (`defineSite`) holding everything site-specific. It's registered in `sites/index.ts` and selected with `SITE=<name>`. Defaults and docs for every option are in `framework/config.ts`.
- `framework/in-page.ts`: a plain-ES5 script string injected into every page. It computes element signatures and catalogs elements (used by discovery) and reports clicks, input and submits to the `__pwCoverage` binding (used by tests). The crawler and tests must share it so signatures match. Keep it a string: tsx/esbuild inject `__name` helpers into serialized functions, and those helpers don't exist in the browser.
- `framework/discover.ts`: a BFS crawler that writes the inventory.
- `tests/discovered/*.spec.ts`: generated at collection time from the inventory, so discovery must run before `playwright test`, not in `globalSetup`.
- `framework/fixtures.ts`: overrides `context` to install the coverage script and binding, and attaches `coverage.json` per test. Tests must import `test`/`expect` from here.
- `framework/reporter/coverage-reporter.ts`: joins the attachments with the inventory and writes `coverage.json`. It produces `index.html` by inlining `dashboard/dist` and injecting the data.
- `framework/reporter/model.ts`: the coverage model and `summarize()`. The reporter and the Vue app (`dashboard/src`) both import it, so keep it free of Node imports.
- `.github/workflows/coverage.yml`: CI runs `npm test` and deploys `coverage-report/` to GitHub Pages from `main` (the Pages source must be set to "GitHub Actions"). When `GITHUB_STEP_SUMMARY` is set, the reporter also writes a coverage table to it.
- Changing anything in a profile that affects discovery changes the inventory fingerprint and triggers a re-crawl on the next `npm test`.
