import { test as base, expect } from '@playwright/test';
import { site } from './site';
import { inPageScript } from './in-page';
import { applyRequestBlocking, keyFor } from './inventory';
import { COVERAGE_ATTACHMENT, type TestCoverage } from './reporter/model';

interface InPageEvent {
  type: 'visit' | 'interact';
  url: string;
  sig?: string;
}

export class CoverageRecorder {
  private visits = new Set<string>();
  private interactions = new Set<string>();
  private verified = new Set<string>();

  record(event: InPageEvent): void {
    if (event.type === 'visit') {
      const key = keyFor(site, event.url);
      if (key) this.visits.add(key);
    } else if (event.sig) {
      this.interactions.add(event.sig);
    }
  }

  /** Marks an element as covered by a non-browser check. */
  verify(sig: string): void {
    this.verified.add(sig);
  }

  toJSON(): TestCoverage {
    return { visits: [...this.visits], interactions: [...this.interactions], verified: [...this.verified] };
  }
}

/**
 * `test` with coverage tracking: every page in the test's browser context reports
 * visits and interactions, and the result is attached for the coverage reporter.
 * Import `test` and `expect` from here instead of `@playwright/test`.
 */
export const test = base.extend<{ coverage: CoverageRecorder }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring, even with no dependencies
  coverage: async ({}, use, testInfo) => {
    const recorder = new CoverageRecorder();
    await use(recorder);
    await testInfo.attach(COVERAGE_ATTACHMENT, {
      body: JSON.stringify(recorder.toJSON()),
      contentType: 'application/json',
    });
  },

  // Depends on `coverage`, so the context is torn down (and every event delivered) before the attachment is written.
  context: async ({ context, coverage }, use) => {
    await applyRequestBlocking(context, site);
    await context.exposeBinding('__pwCoverage', (_source, event: InPageEvent) => coverage.record(event));
    await context.addInitScript({ content: inPageScript(site) });
    await use(context);
  },
});

export { expect };
