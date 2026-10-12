/**
 * Site configuration: everything that makes the framework point at a specific site.
 * A profile lives in `sites/<name>.ts` and is selected with the SITE env var.
 */

export type ElementKind = 'button' | 'link' | 'input' | 'select' | 'textarea' | 'form';

export const ELEMENT_KINDS: ElementKind[] = ['button', 'link', 'input', 'select', 'textarea', 'form'];

export interface SampleValue {
  /** Matched against the field's name, id, type and placeholder. */
  match: RegExp;
  value: string;
}

export interface SiteConfig {
  /** Short identifier, used for the inventory file name. */
  name: string;
  /** Human-readable title shown on the dashboard. */
  title: string;
  baseURL: string;
  /** Paths (relative to baseURL) the crawler starts from. */
  startPaths: string[];
  /** Overrides the browser user agent for discovery and tests. */
  userAgent?: string;
  /** Requests matching this pattern are aborted (ads, analytics, trackers). */
  blockRequests?: RegExp;

  crawl: {
    maxPages: number;
    maxDepth: number;
    /** Cap on pages sharing a template, e.g. only crawl 3 product pages. */
    maxPerTemplate: number;
    concurrency: number;
    /** If set, a URL must match one of these to be crawled. */
    include: RegExp[];
    /** URLs matching any of these are never crawled or link-checked. Added to the defaults (logout, delete). */
    exclude: RegExp[];
    navigationTimeout: number;
    /** Extra wait after DOMContentLoaded so client-rendered content settles. */
    settleMs: number;
    /** `npm test` re-runs discovery when the inventory is older than this. */
    maxAgeHours: number;
  };

  /** Identity of a page; two URLs with the same key are the same page. */
  pageKey: (url: URL) => string;
  /** Pages sharing a template are capped by `crawl.maxPerTemplate`. */
  pageTemplate: (url: URL) => string;

  elements: {
    /** CSS selector per element kind. Order matters: the first matching kind wins. */
    selectors: Record<ElementKind, string>;
    /** Attributes that give an element a stable identity, checked before falling back to text. */
    identityAttributes: string[];
    /** Elements inside these selectors are neither catalogued nor tracked. */
    ignore: string[];
    /** Catalogue elements that are not visible at load time (e.g. collapsed menus). */
    includeHidden: boolean;
  };

  checks: {
    consoleErrors: boolean;
    ignoreConsoleErrors: RegExp[];
    brokenImages: boolean;
    /** Elements present at discovery time but missing now: report, fail, or ignore. */
    drift: 'off' | 'warn' | 'fail';
    links: { enabled: boolean; external: boolean; ignore: RegExp[]; concurrency: number };
    forms: { enabled: boolean; ignore: RegExp[]; sampleValues: SampleValue[]; fallbackValue: string };
  };

  report: {
    outputDir: string;
    /** Minimum coverage percentages; below them the run is marked failed when `failOnThreshold`. */
    thresholds: { pages?: number; elements?: number; forms?: number };
    failOnThreshold: boolean;
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends RegExp | RegExp[] | string[] | SampleValue[] | ((...a: never[]) => unknown)
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type SiteConfigInput = DeepPartial<SiteConfig> & Pick<SiteConfig, 'name' | 'baseURL'>;

const defaults: Omit<SiteConfig, 'name' | 'baseURL' | 'title'> = {
  startPaths: ['/'],
  crawl: {
    maxPages: 40,
    maxDepth: 2,
    maxPerTemplate: 3,
    concurrency: 3,
    include: [],
    exclude: [/logout/i, /delete/i],
    navigationTimeout: 30_000,
    settleMs: 500,
    maxAgeHours: 24,
  },
  pageKey: url => url.pathname + (url.search ? url.search : ''),
  pageTemplate: url => url.pathname.replace(/\/\d+(?=\/|$)/g, '/:id'),
  elements: {
    selectors: {
      button: 'button, input[type=submit], input[type=button], input[type=reset], [role=button]',
      link: 'a[href]',
      input: 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset])',
      select: 'select',
      textarea: 'textarea',
      form: 'form',
    },
    identityAttributes: ['data-testid', 'data-test', 'data-qa', 'data-cy'],
    ignore: [],
    includeHidden: false,
  },
  checks: {
    consoleErrors: true,
    ignoreConsoleErrors: [],
    brokenImages: true,
    drift: 'warn',
    links: { enabled: true, external: false, ignore: [], concurrency: 6 },
    forms: {
      enabled: true,
      ignore: [],
      sampleValues: [
        { match: /e-?mail/i, value: 'pw.tester@example.com' },
        { match: /pass/i, value: 'Pw-Secret-123' },
        { match: /phone|mobile|tel/i, value: '5551234567' },
        { match: /zip|postal|postcode/i, value: '90210' },
        { match: /search|query|q\b/i, value: 'shirt' },
        { match: /name/i, value: 'Pat Playwright' },
      ],
      fallbackValue: 'Playwright',
    },
  },
  report: {
    outputDir: 'coverage-report',
    thresholds: {},
    failOnThreshold: false,
  },
};

/** Site names become file and folder names: `.discovery/<name>.json`, `tests/flows/<name>/`. */
const SITE_NAME = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * Matches hand-written flows that do not belong to `siteName`. Each site keeps its flows in
 * `tests/flows/<site>/`, so a run only collects the active site's flows plus the generated suites.
 */
export function otherSitesFlows(siteName: string): RegExp {
  return new RegExp(`[\\\\/]tests[\\\\/]flows[\\\\/](?!${siteName}[\\\\/])`);
}

/** Merges a site profile over the framework defaults. */
export function defineSite(input: SiteConfigInput): SiteConfig {
  if (!SITE_NAME.test(input.name)) {
    throw new Error(`Invalid site name "${input.name}": use lowercase letters, digits, "-" and "_".`);
  }
  return {
    ...defaults,
    ...input,
    title: input.title ?? input.name,
    startPaths: input.startPaths ?? defaults.startPaths,
    pageKey: input.pageKey ?? defaults.pageKey,
    pageTemplate: input.pageTemplate ?? defaults.pageTemplate,
    crawl: {
      ...defaults.crawl,
      ...input.crawl,
      // Profiles add to the default destructive-URL guards rather than replacing them.
      exclude: [...defaults.crawl.exclude, ...(input.crawl?.exclude ?? [])],
    } as SiteConfig['crawl'],
    elements: {
      ...defaults.elements,
      ...input.elements,
      selectors: { ...defaults.elements.selectors, ...input.elements?.selectors },
    } as SiteConfig['elements'],
    checks: {
      ...defaults.checks,
      ...input.checks,
      links: { ...defaults.checks.links, ...input.checks?.links },
      forms: { ...defaults.checks.forms, ...input.checks?.forms },
    } as SiteConfig['checks'],
    report: {
      ...defaults.report,
      ...input.report,
      thresholds: { ...defaults.report.thresholds, ...input.report?.thresholds },
    } as SiteConfig['report'],
  };
}
