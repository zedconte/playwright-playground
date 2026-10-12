// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ElementsTable from './ElementsTable.vue';
import { testFilter, type CoverageModel, type ElementRow, type TestRow } from '../../../framework/reporter/model';

const t = (title: string, discovered = false): TestRow => ({
  title,
  file: 'x.spec.ts',
  line: 1,
  discovered,
  status: 'passed',
  durationMs: 1,
  touched: 0,
});
const el = (sig: string, kind: ElementRow['kind'], by: Partial<ElementRow> = {}): ElementRow => ({
  sig,
  kind,
  label: sig,
  selector: `#${sig}`,
  pages: ['/'],
  interactedBy: [],
  verifiedBy: [],
  ...by,
});

const model: CoverageModel = {
  meta: {
    site: 'unit',
    title: 'Unit',
    baseURL: 'http://localhost',
    generatedAt: '2026-01-01T00:00:00Z',
    inventoryGeneratedAt: null,
    durationMs: 1,
    status: 'passed',
    thresholds: {},
  },
  tests: [t('cart flow'), t('link check', true)],
  pages: [
    { key: '/', url: 'http://localhost/', title: '', template: '/', elements: [0, 1, 2], visitedBy: [] },
    { key: '/login', url: 'http://localhost/login', title: '', template: '/login', elements: [3], visitedBy: [] },
  ],
  elements: [
    el('cart-button', 'button', { interactedBy: [0] }),
    el('home-link', 'link', { verifiedBy: [1] }),
    el('search-input', 'input'),
    el('login-form', 'form'),
  ],
  outside: { pages: [], elements: [] },
};

const factory = (props: Partial<{ page: string | null; source: 'all' | 'authored' | 'discovered' }> = {}) =>
  mount(ElementsTable, {
    props: { model, filter: testFilter(props.source ?? 'all', false), page: props.page ?? null },
  });
const labels = (wrapper: ReturnType<typeof factory>) => wrapper.findAll('tbody .label').map(n => n.text());

describe('ElementsTable', () => {
  it('starts on the uncovered backlog', () => {
    expect(labels(factory())).toEqual(['search-input', 'login-form']);
  });

  it('switches between covered, uncovered and all', async () => {
    const wrapper = factory();
    await wrapper.get('[role="radio"]:nth-child(2)').trigger('click');
    expect(labels(wrapper)).toEqual(['cart-button', 'home-link']);
    await wrapper.get('[role="radio"]:nth-child(3)').trigger('click');
    expect(labels(wrapper)).toHaveLength(4);
  });

  it('shows how each element was covered and by which test', async () => {
    const wrapper = factory();
    await wrapper.get('[role="radio"]:nth-child(2)').trigger('click');
    const rows = wrapper.findAll('tbody tr').map(r => [r.get('.state').text(), r.get('.by').text()]);
    expect(rows).toEqual([
      ['Interacted', 'cart flow'],
      ['HTTP-checked', 'link check'],
    ]);
  });

  it('recomputes coverage when the test filter excludes the covering test', () => {
    expect(labels(factory({ source: 'authored' }))).toEqual(['home-link', 'search-input', 'login-form']);
  });

  it('filters by search text and kind', async () => {
    const wrapper = factory();
    await wrapper.get('input[type="search"]').setValue('LOGIN');
    expect(labels(wrapper)).toEqual(['login-form']);
    await wrapper.get('input[type="search"]').setValue('');
    await wrapper.get('select').setValue('input');
    expect(labels(wrapper)).toEqual(['search-input']);
  });

  it('limits to a selected page and lets the user clear it', async () => {
    const wrapper = factory({ page: '/login' });
    expect(labels(wrapper)).toEqual(['login-form']);
    await wrapper.get('button.chip').trigger('click');
    expect(wrapper.emitted('clearPage')).toHaveLength(1);
  });

  it('explains an empty result', async () => {
    const wrapper = factory();
    await wrapper.get('input[type="search"]').setValue('nothing matches this');
    expect(wrapper.get('tbody').text()).toContain('No elements match these filters.');
  });
});
