/**
 * The coverage data model, shared by the reporter (Node) and the dashboard (Vue, browser).
 * Keep this file free of Node imports so Vite can bundle it.
 */

/** Name of the per-test attachment the coverage fixture writes and the reporter reads. */
export const COVERAGE_ATTACHMENT = 'coverage.json';

/** Tag on every generated test; the dashboard uses it to split discovered from authored coverage. */
export const DISCOVERED_TAG = '@discovered';

/** What one test covered, as recorded by the coverage fixture. */
export interface TestCoverage {
  /** Page keys the test navigated to. */
  visits: string[];
  /** Element signatures the test clicked, typed into, changed or submitted. */
  interactions: string[];
  /** Element signatures the test checked without a browser (e.g. HTTP link checks). */
  verified: string[];
}

export type ElementKind = 'button' | 'link' | 'input' | 'select' | 'textarea' | 'form';
export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface TestRow {
  title: string;
  file: string;
  line: number;
  discovered: boolean;
  status: TestStatus;
  durationMs: number;
  /** Number of elements this test touched that appear in the inventory. */
  touched: number;
}

export interface PageRow {
  key: string;
  url: string;
  title: string;
  template: string;
  /** Indexes into `elements`. */
  elements: number[];
  /** Indexes into `tests`. */
  visitedBy: number[];
}

export interface ElementRow {
  sig: string;
  kind: ElementKind;
  label: string;
  selector: string;
  href?: string;
  pages: string[];
  interactedBy: number[];
  verifiedBy: number[];
}

export interface CoverageModel {
  meta: {
    site: string;
    title: string;
    baseURL: string;
    generatedAt: string;
    inventoryGeneratedAt: string | null;
    durationMs: number;
    status: string;
    thresholds: { pages?: number; elements?: number; forms?: number };
  };
  tests: TestRow[];
  pages: PageRow[];
  elements: ElementRow[];
  /** Coverage that landed outside the inventory: a sign discovery should crawl wider. */
  outside: {
    pages: { key: string; visitedBy: number[] }[];
    elements: { sig: string; interactedBy: number[] }[];
  };
}

export interface Ratio {
  covered: number;
  total: number;
  pct: number;
}

export interface KindSummary {
  kind: ElementKind;
  total: number;
  interacted: number;
  /** Covered only by a non-browser check (e.g. HTTP link check), never interacted with. */
  verifiedOnly: number;
}

export interface Summary {
  pages: Ratio;
  elements: Ratio;
  forms: Ratio;
  byKind: KindSummary[];
  tests: Record<TestStatus, number>;
}

export const KIND_ORDER: ElementKind[] = ['link', 'button', 'input', 'select', 'textarea', 'form'];

export function ratio(covered: number, total: number): Ratio {
  return { covered, total, pct: total ? (covered / total) * 100 : 0 };
}

export type TestFilter = (test: TestRow, index: number) => boolean;

/** Which tests count toward coverage for a dashboard view. */
export function testFilter(source: 'all' | 'authored' | 'discovered', passingOnly: boolean): TestFilter {
  return t =>
    (source === 'all' || (source === 'discovered') === t.discovered) &&
    t.status !== 'skipped' &&
    (!passingOnly || t.status === 'passed' || t.status === 'flaky');
}

export function summarize(model: CoverageModel, include: TestFilter): Summary {
  const counted = new Set(model.tests.flatMap((t, i) => (include(t, i) ? [i] : [])));
  const any = (ids: number[]) => ids.some(i => counted.has(i));

  const byKind = new Map<ElementKind, KindSummary>(
    KIND_ORDER.map(kind => [kind, { kind, total: 0, interacted: 0, verifiedOnly: 0 }]),
  );
  let covered = 0;
  for (const el of model.elements) {
    const row = byKind.get(el.kind)!;
    row.total++;
    if (any(el.interactedBy)) {
      row.interacted++;
      covered++;
    } else if (any(el.verifiedBy)) {
      row.verifiedOnly++;
      covered++;
    }
  }
  const forms = byKind.get('form')!;

  const tests: Record<TestStatus, number> = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  model.tests.forEach(t => tests[t.status]++);

  return {
    pages: ratio(model.pages.filter(p => any(p.visitedBy)).length, model.pages.length),
    elements: ratio(covered, model.elements.length),
    forms: ratio(forms.interacted, forms.total),
    byKind: [...byKind.values()].filter(k => k.total > 0),
    tests,
  };
}

/** Element coverage for one page under a filter. */
export function pageCoverage(model: CoverageModel, page: PageRow, include: TestFilter): Ratio {
  const counted = (ids: number[]) => ids.some(i => include(model.tests[i], i));
  const covered = page.elements.filter(i => {
    const el = model.elements[i];
    return counted(el.interactedBy) || counted(el.verifiedBy);
  }).length;
  return ratio(covered, page.elements.length);
}
