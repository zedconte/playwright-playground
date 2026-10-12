import { describe, expect, it } from 'vitest';
import { discoveryAge, duration, pct } from './format';

describe('pct', () => {
  it('rounds normal values and keeps one decimal below 10%', () => {
    expect(pct(83.4)).toBe('83%');
    expect(pct(6.25)).toBe('6.3%');
    expect(pct(0)).toBe('0%');
  });
});

describe('duration', () => {
  it('picks a readable unit', () => {
    expect(duration(372)).toBe('372ms');
    expect(duration(2_400)).toBe('2.4s');
    expect(duration(125_000)).toBe('2m 5s');
  });
});

describe('discoveryAge', () => {
  const runEnd = '2026-10-12T19:00:00Z';
  const runMs = 60_000; // run started 18:59

  it('is measured against the run, not the viewer clock', () => {
    expect(discoveryAge('2026-10-12T18:58:30Z', runEnd, runMs)).toBe('crawled for this run');
    expect(discoveryAge('2026-10-12T18:39:00Z', runEnd, runMs)).toBe('crawled 20 min before this run');
    expect(discoveryAge('2026-10-12T15:59:00Z', runEnd, runMs)).toBe('crawled 3 h before this run');
    expect(discoveryAge('2026-10-09T18:59:00Z', runEnd, runMs)).toBe('crawled 3 days before this run');
  });

  it('says when discovery never ran', () => {
    expect(discoveryAge(null, runEnd, runMs)).toBe('not run');
  });
});
