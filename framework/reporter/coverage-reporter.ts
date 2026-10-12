/**
 * Playwright reporter that joins each test's coverage attachment with the discovery
 * inventory and writes `coverage-report/coverage.json` plus the Vue dashboard (`index.html`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { site } from '../site';
import { loadInventory } from '../inventory';
import {
  COVERAGE_ATTACHMENT,
  DISCOVERED_TAG,
  summarize,
  testFilter,
  type CoverageModel,
  type Ratio,
  type Summary,
  type TestCoverage,
  type TestStatus,
} from './model';

const ROOT = path.resolve(__dirname, '..', '..');
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const DASHBOARD_DIST = path.join(DASHBOARD_DIR, 'dist');

interface Collected {
  test: TestCase;
  coverage: TestCoverage;
  durationMs: number;
}

const STATUS: Record<ReturnType<TestCase['outcome']>, TestStatus> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
};

export default class CoverageReporter implements Reporter {
  private collected = new Map<string, Collected>();
  private rootDir = ROOT;

  onBegin(config: FullConfig, _suite: Suite): void {
    this.rootDir = config.rootDir;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find(a => a.name === COVERAGE_ATTACHMENT);
    const coverage: TestCoverage = attachment?.body
      ? JSON.parse(attachment.body.toString())
      : { visits: [], interactions: [], verified: [] };

    // Retries: union the coverage of every attempt.
    const previous = this.collected.get(test.id);
    const union = (a: string[] = [], b: string[]) => [...new Set([...a, ...b])];
    this.collected.set(test.id, {
      test,
      coverage: {
        visits: union(previous?.coverage.visits, coverage.visits),
        interactions: union(previous?.coverage.interactions, coverage.interactions),
        verified: union(previous?.coverage.verified, coverage.verified),
      },
      durationMs: (previous?.durationMs ?? 0) + result.duration,
    });
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    const model = this.buildModel(result);
    const outDir = path.resolve(ROOT, site.report.outputDir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(model));

    let dashboard = '';
    try {
      fs.writeFileSync(path.join(outDir, 'index.html'), renderDashboard(model));
      dashboard = path.relative(process.cwd(), path.join(outDir, 'index.html'));
    } catch (error) {
      console.error(`Coverage dashboard not written: ${(error as Error).message}`);
    }

    return this.printSummary(model, dashboard);
  }

  printsToStdio(): boolean {
    return false;
  }

  private buildModel(result: FullResult): CoverageModel {
    const inventory = loadInventory(site);
    const entries = [...this.collected.values()];

    const tests = entries.map(({ test, durationMs }) => ({
      title: test.titlePath().slice(3).join(' › '),
      file: path.relative(this.rootDir, test.location.file),
      line: test.location.line,
      discovered: test.tags.includes(DISCOVERED_TAG),
      status: STATUS[test.outcome()],
      durationMs,
      touched: 0,
    }));

    const pageIndex = new Map((inventory?.pages ?? []).filter(p => !p.error).map((p, i) => [p.key, i]));
    const sigs = Object.keys(inventory?.elements ?? {});
    const elementIndex = new Map(sigs.map((sig, i) => [sig, i]));

    const model: CoverageModel = {
      meta: {
        site: site.name,
        title: site.title,
        baseURL: site.baseURL,
        generatedAt: new Date().toISOString(),
        inventoryGeneratedAt: inventory?.generatedAt ?? null,
        durationMs: Math.round(result.duration),
        status: result.status,
        thresholds: site.report.thresholds,
      },
      tests,
      pages: [...pageIndex.keys()].map(key => {
        const p = inventory!.pages.find(x => x.key === key)!;
        return {
          key,
          url: p.url,
          title: p.title,
          template: p.template,
          elements: p.elements.map(sig => elementIndex.get(sig)!).filter(i => i !== undefined),
          visitedBy: [],
        };
      }),
      elements: sigs.map(sig => {
        const el = inventory!.elements[sig];
        return {
          sig,
          kind: el.kind,
          label: el.label,
          selector: el.selector,
          href: el.href,
          pages: el.pages,
          interactedBy: [],
          verifiedBy: [],
        };
      }),
      outside: { pages: [], elements: [] },
    };

    const outsidePages = new Map<string, number[]>();
    const outsideElements = new Map<string, number[]>();
    entries.forEach(({ coverage }, t) => {
      for (const key of coverage.visits) {
        const i = pageIndex.get(key);
        if (i !== undefined) model.pages[i].visitedBy.push(t);
        else outsidePages.set(key, [...(outsidePages.get(key) ?? []), t]);
      }
      for (const sig of coverage.interactions) {
        const i = elementIndex.get(sig);
        if (i !== undefined) model.elements[i].interactedBy.push(t);
        else outsideElements.set(sig, [...(outsideElements.get(sig) ?? []), t]);
      }
      for (const sig of coverage.verified) {
        const i = elementIndex.get(sig);
        if (i !== undefined) model.elements[i].verifiedBy.push(t);
      }
      tests[t].touched = new Set(
        [...coverage.interactions, ...coverage.verified].filter(sig => elementIndex.has(sig)),
      ).size;
    });
    model.outside.pages = [...outsidePages].map(([key, visitedBy]) => ({ key, visitedBy }));
    model.outside.elements = [...outsideElements].map(([sig, interactedBy]) => ({ sig, interactedBy }));
    return model;
  }

  private printSummary(model: CoverageModel, dashboard: string): { status?: FullResult['status'] } | undefined {
    const all = summarize(model, testFilter('all', false));
    const authored = summarize(model, testFilter('authored', false));
    const fmt = (r: Ratio) => `${`${r.covered}/${r.total}`.padStart(9)} ${r.pct.toFixed(0).padStart(3)}%`;

    const lines = [
      '',
      `Coverage for ${model.meta.title} (${model.meta.baseURL})`,
      `             ${'all tests'.padStart(14)}   ${'authored only'.padStart(14)}`,
      `  Pages      ${fmt(all.pages)}   ${fmt(authored.pages)}`,
      `  Elements   ${fmt(all.elements)}   ${fmt(authored.elements)}`,
      `  Forms      ${fmt(all.forms)}   ${fmt(authored.forms)}`,
    ];
    if (!model.meta.inventoryGeneratedAt) lines.push('  No inventory found: run `npm run discover` to measure against the site.');
    if (model.outside.pages.length || model.outside.elements.length) {
      lines.push(
        `  Outside inventory: ${model.outside.pages.length} page(s), ${model.outside.elements.length} element(s) — consider widening discovery.`,
      );
    }

    const misses = (['pages', 'elements', 'forms'] as const).flatMap(metric => {
      const min = site.report.thresholds[metric];
      return min !== undefined && all[metric].pct < min ? [`${metric} ${all[metric].pct.toFixed(1)}% < ${min}%`] : [];
    });
    if (misses.length) lines.push(`  Below threshold: ${misses.join(', ')}`);
    if (dashboard) lines.push(`  Dashboard: ${dashboard}`);
    console.log(lines.join('\n') + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) writeJobSummary(process.env.GITHUB_STEP_SUMMARY, model, all, authored, misses);

    if (misses.length && site.report.failOnThreshold) return { status: 'failed' };
    return undefined;
  }
}

/** Appends a coverage table to the GitHub Actions job summary. */
function writeJobSummary(file: string, model: CoverageModel, all: Summary, authored: Summary, misses: string[]): void {
  const cell = (r: Ratio) => `${r.pct.toFixed(0)}% (${r.covered}/${r.total})`;
  const target = (metric: 'pages' | 'elements' | 'forms') => {
    const min = model.meta.thresholds[metric];
    return min === undefined ? '—' : `${all[metric].pct >= min ? '✅' : '⚠️'} ${min}%`;
  };
  const t = all.tests;
  const md = [
    `## Coverage: ${model.meta.title}`,
    '',
    `Tests: ${t.passed} passed · ${t.failed} failed · ${t.flaky} flaky · ${t.skipped} skipped`,
    '',
    '| | All tests | Authored only | Target |',
    '| --- | --- | --- | --- |',
    `| Pages visited | ${cell(all.pages)} | ${cell(authored.pages)} | ${target('pages')} |`,
    `| Elements covered | ${cell(all.elements)} | ${cell(authored.elements)} | ${target('elements')} |`,
    `| Forms submitted | ${cell(all.forms)} | ${cell(authored.forms)} | ${target('forms')} |`,
    '',
    misses.length ? `Below target: ${misses.join(', ')}` : '',
    '',
  ];
  fs.appendFileSync(file, md.join('\n'));
}

/** Fills the built Vue dashboard with this run's data and inlines its assets into one file. */
function renderDashboard(model: CoverageModel): string {
  const indexFile = path.join(DASHBOARD_DIST, 'index.html');
  if (!fs.existsSync(indexFile)) {
    console.log('Building coverage dashboard (first run)…');
    execSync('npx vite build', { cwd: DASHBOARD_DIR, stdio: 'ignore' });
  }
  let html = fs.readFileSync(indexFile, 'utf8');

  html = html.replace(/<script type="module" crossorigin src="\.?\/?([^"]+)"><\/script>/g, (_m, src: string) => {
    const js = fs.readFileSync(path.join(DASHBOARD_DIST, src), 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script type="module">${js}</script>`;
  });
  html = html.replace(/<link rel="stylesheet" crossorigin href="\.?\/?([^"]+)">/g, (_m, href: string) => {
    return `<style>${fs.readFileSync(path.join(DASHBOARD_DIST, href), 'utf8')}</style>`;
  });

  const data = JSON.stringify(model).replace(/</g, '\\u003c');
  // A replacer function, so `$` sequences in the data are not treated as replacement patterns.
  return html.replace('</head>', () => `<script id="coverage-data" type="application/json">${data}</script>\n</head>`);
}
