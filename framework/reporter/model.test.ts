import { describe, expect, it } from 'vitest';
import { pageCoverage, ratio, summarize, testFilter, type CoverageModel, type TestRow } from './model';

const test = (overrides: Partial<TestRow>): TestRow => ({
  title: 't',
  file: 'f.spec.ts',
  line: 1,
  discovered: false,
  status: 'passed',
  durationMs: 1,
  touched: 0,
  ...overrides,
});

/**
 * Tests: 0 authored/passed, 1 discovered/passed, 2 authored/failed, 3 authored/skipped.
 * Elements: link interacted by 0, link verified by 1, button interacted by 2, form submitted by 3 (skipped), input untouched.
 */
const model: CoverageModel = {
  meta: {
    site: 'unit',
    title: 'Unit',
    baseURL: 'http://localhost',
    generatedAt: '2026-01-01T00:00:00Z',
    inventoryGeneratedAt: '2026-01-01T00:00:00Z',
    durationMs: 1000,
    status: 'failed',
    thresholds: {},
  },
  tests: [
    test({ title: 'authored pass' }),
    test({ title: 'discovered pass', discovered: true }),
    test({ title: 'authored fail', status: 'failed' }),
    test({ title: 'authored skip', status: 'skipped' }),
  ],
  pages: [
    { key: '/', url: 'http://localhost/', title: 'Home', template: '/', elements: [0, 1, 2], visitedBy: [0, 1] },
    { key: '/form', url: 'http://localhost/form', title: 'Form', template: '/form', elements: [3, 4], visitedBy: [3] },
  ],
  elements: [
    { sig: 'a', kind: 'link', label: 'A', selector: 'a', pages: ['/'], interactedBy: [0], verifiedBy: [1] },
    { sig: 'b', kind: 'link', label: 'B', selector: 'b', pages: ['/'], interactedBy: [], verifiedBy: [1] },
    { sig: 'c', kind: 'button', label: 'C', selector: 'c', pages: ['/'], interactedBy: [2], verifiedBy: [] },
    { sig: 'd', kind: 'form', label: 'D', selector: 'd', pages: ['/form'], interactedBy: [3], verifiedBy: [] },
    { sig: 'e', kind: 'input', label: 'E', selector: 'e', pages: ['/form'], interactedBy: [], verifiedBy: [] },
  ],
  outside: { pages: [], elements: [] },
};

describe('ratio', () => {
  it('computes a percentage and treats an empty total as 0%', () => {
    expect(ratio(1, 4)).toEqual({ covered: 1, total: 4, pct: 25 });
    expect(ratio(0, 0).pct).toBe(0);
  });
});

describe('testFilter', () => {
  it('never counts skipped tests', () => {
    expect(testFilter('all', false)(model.tests[3], 3)).toBe(false);
  });

  it('splits authored from discovered', () => {
    const authored = testFilter('authored', false);
    expect(model.tests.map((t, i) => authored(t, i))).toEqual([true, false, true, false]);
    const discovered = testFilter('discovered', false);
    expect(model.tests.map((t, i) => discovered(t, i))).toEqual([false, true, false, false]);
  });

  it('can exclude failing tests', () => {
    expect(testFilter('all', true)(model.tests[2], 2)).toBe(false);
    expect(testFilter('all', true)({ ...model.tests[2], status: 'flaky' }, 2)).toBe(true);
  });
});

describe('summarize', () => {
  it('counts interaction before HTTP verification and ignores skipped tests', () => {
    const summary = summarize(model, testFilter('all', false));

    expect(summary.pages).toEqual(ratio(1, 2)); // /form was only visited by the skipped test
    expect(summary.elements).toEqual(ratio(3, 5));
    expect(summary.forms).toEqual(ratio(0, 1));
    expect(summary.byKind).toEqual([
      { kind: 'link', total: 2, interacted: 1, verifiedOnly: 1 },
      { kind: 'button', total: 1, interacted: 1, verifiedOnly: 0 },
      { kind: 'input', total: 1, interacted: 0, verifiedOnly: 0 },
      { kind: 'form', total: 1, interacted: 0, verifiedOnly: 0 },
    ]);
  });

  it('reflects only the selected tests', () => {
    const authoredPassing = summarize(model, testFilter('authored', true));
    expect(authoredPassing.elements).toEqual(ratio(1, 5));
    expect(authoredPassing.byKind.find(k => k.kind === 'link')).toMatchObject({ interacted: 1, verifiedOnly: 0 });
  });

  it('counts test statuses regardless of the filter', () => {
    expect(summarize(model, testFilter('discovered', true)).tests).toEqual({
      passed: 2,
      failed: 1,
      flaky: 0,
      skipped: 1,
    });
  });
});

describe('pageCoverage', () => {
  it('covers a page element through any counted test', () => {
    expect(pageCoverage(model, model.pages[0], testFilter('all', false))).toEqual(ratio(3, 3));
    expect(pageCoverage(model, model.pages[0], testFilter('discovered', false))).toEqual(ratio(2, 3));
    expect(pageCoverage(model, model.pages[1], testFilter('all', false))).toEqual(ratio(0, 2));
  });
});
