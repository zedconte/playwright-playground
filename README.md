# playwright-playground

A Playwright project that showcases LLM-assisted development. It includes:

- **Self test discovery.** A crawler maps every page and interactive element on a site. Smoke, link and form tests are generated from that inventory automatically.
- **Coverage tracking.** Every test, generated or hand-written, reports which pages it visited and which elements it clicked, typed into or submitted.
- **Coverage dashboard.** A Vue app, built into a single offline HTML file, that shows coverage by page, element kind and test, plus the uncovered elements still to test.

The default target is [automationexercise.com](https://automationexercise.com), the maintained successor to automationpractice.com. That domain is now a parked page, and its `.pl` mirror redirects browsers to ad sites.

## Quick start

```bash
npm install
npx playwright install chromium
npm test                       # discover (if stale) → run all tests → write the dashboard
open coverage-report/index.html
```

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Builds the dashboard, re-discovers the site if the inventory is missing, older than 24 h or the config changed, then runs every test |
| `npm run discover` | Forces a fresh crawl and writes `.discovery/<site>.json` |
| `npm run test:authored` | Hand-written flows only (`tests/flows/`) |
| `npm run test:discovered` | Generated suites only (`tests/discovered/`, tag `@discovered`) |
| `npx playwright test tests/flows/cart.spec.ts` | A single file. Add `-g "quantity"` to run a single test |
| `npm run report` | Opens Playwright's HTML report |
| `npm run dashboard:dev` | Runs the Vue dashboard with hot reload, using the last run's `coverage-report/coverage.json` |
| `npm run typecheck` | `tsc` for the framework and tests, `vue-tsc` for the dashboard |

## How it works

```
sites/<name>.ts ──► framework/discover.ts ──► .discovery/<name>.json (inventory)
                         (crawler)                    │
                                                      ├──► tests/discovered/*.spec.ts  (generated at collection time)
                                                      │
tests/**/*.spec.ts ──► framework/fixtures.ts ─────────┤   each test records visits + interactions
                       (coverage fixture)             ▼
                              framework/reporter/coverage-reporter.ts
                                   │  joins test coverage with the inventory
                                   ▼
                     coverage-report/coverage.json + index.html (Vue dashboard)
```

- **One element identity everywhere.** `framework/in-page.ts` is injected into every page by both the crawler and the test fixture. It gives each element a stable signature, such as `input [data-qa="login-email"]` or `link #header a[href=/products] "Products"`. An element found by discovery and an element clicked by a test therefore match. Header and footer elements count once, not once per page.
- **Discovered vs authored.** Generated tests carry the `@discovered` tag. The dashboard can count coverage from all tests, authored tests only or discovered tests only. This shows how much your hand-written flows exercise on their own.
- **Interacted vs HTTP-checked.** The link checker verifies URLs without clicking. Those elements show as "HTTP-checked only", separate from real browser interaction.
- **Outside the inventory.** If a test reaches a page or element that discovery never saw (a modal, a collapsed menu, a page behind a form), the dashboard lists it. That's a hint to widen the crawl.

## Writing tests

Import from the framework instead of `@playwright/test` so coverage is recorded:

```ts
import { test, expect } from '../../framework/fixtures';

test('adds to cart', async ({ page }) => {
  await page.goto('/product_details/1');
  await page.getByRole('button', { name: 'Add to cart' }).click();
});
```

Put hand-written tests in `tests/flows/`.

## Customizing

Everything site-specific lives in a profile under `sites/`. See `sites/automationexercise.ts` for a full example and `framework/config.ts` for every option and its default.

| Option | Use it to |
| --- | --- |
| `baseURL`, `startPaths` | Point at a site (`BASE_URL` env var overrides the default) |
| `crawl.maxPages / maxDepth / maxPerTemplate` | Bound the crawl, e.g. 3 product pages instead of 500 |
| `crawl.include / exclude` | Keep the crawler and link checker inside safe areas. Logout and delete URLs are always excluded |
| `pageKey`, `pageTemplate` | Decide when two URLs are the same page and which pages share a template |
| `blockRequests` | Abort ads and trackers that make runs flaky |
| `elements.selectors / identityAttributes / ignore / includeHidden` | Control what counts as an element and how it's identified (`data-testid`, `data-qa`, …) |
| `checks.*` | Toggle console-error, broken-image, drift, link and form checks, and set sample form values |
| `report.thresholds`, `failOnThreshold` | Set coverage targets (shown on the dashboard) and optionally fail the run when they're missed |

To add a site, create `sites/<name>.ts` with `defineSite({...})`, register it in `sites/index.ts`, and run with `SITE=<name> npm test`.

## CI and the published dashboard

`.github/workflows/coverage.yml` runs on pushes to `main`, on pull requests, on weekday mornings (06:00 UTC, to catch changes on the live site) and on demand. Each run:

1. installs dependencies and Chromium, then typechecks;
2. runs `npm test`, which crawls the site fresh because the inventory isn't committed, then runs every test;
3. writes a coverage table to the run's **job summary**;
4. uploads `playwright-report` and `coverage-dashboard` as artifacts (kept for 14 days; pull requests get them here);
5. on `main`, deploys the dashboard to **GitHub Pages**. This happens even when tests fail, because that's when you most need it.

**One-time setup:** in the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. The dashboard is then served at `https://<owner>.github.io/<repo>/` (`/coverage.json` holds the raw data).
