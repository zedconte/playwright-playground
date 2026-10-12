import { beforeEach, describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { defineSite } from './config';
import type { CatalogEntry } from './inventory';
import { inPageScript } from './in-page';

interface Catalog {
  elements: CatalogEntry[];
  links: string[];
}
type PwWindow = Window & {
  __pwcov: { catalog: () => Catalog };
  __pwCoverage?: (event: unknown) => void;
};

const site = defineSite({
  name: 'unit',
  baseURL: 'http://localhost:3000',
  elements: { ignore: ['.ads'] },
});

let win: PwWindow;

/**
 * Renders markup in a fresh window, then runs the in-page script against it the way
 * Playwright's addInitScript would. A fresh window per test keeps listeners from leaking.
 */
function load(html: string, options: { onEvent?: (event: unknown) => void } = {}) {
  win = new Window({ url: 'http://localhost:3000/' }) as PwWindow;
  win.document.body.innerHTML = html;
  win.__pwCoverage = options.onEvent;
  const run = new Function('window', 'document', 'location', 'getComputedStyle', 'CSS', inPageScript(site));
  run(win, win.document, win.location, win.getComputedStyle.bind(win), win.CSS);
  return win.__pwcov;
}
const $ = (selector: string) => win.document.querySelector(selector)!;
const click = (selector: string) => $(selector).dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

const sigs = (catalog: Catalog) => catalog.elements.map(e => e.sig);

describe('catalog', () => {
  it('identifies elements by identity attribute, id, name, then scoped text', () => {
    const { elements } = load(`
      <header id="top"><a href="/products">Products</a></header>
      <input data-testid="email" id="ignored-id">
      <input id="search">
      <main><input name="qty"><button>Buy now</button></main>
    `).catalog();

    expect(elements.map(e => e.sig)).toEqual([
      'link #top a[href=/products] "Products"',
      'input [data-testid="email"]',
      'input #search',
      'input main [name=qty]',
      'button main button "Buy now"',
    ]);
  });

  it('collapses repeated identical elements into one entry with a count', () => {
    const { elements } = load(`
      <nav><a href="/cart">Cart</a></nav>
      <nav><a href="/cart">Cart</a></nav>
    `).catalog();

    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ sig: 'link nav a[href=/cart] "Cart"', count: 2 });
  });

  it('tells repeated links apart by identity attribute', () => {
    const { elements } = load(`
      <a href="#" data-testid="add-1">Add to cart</a>
      <a href="#" data-testid="add-2">Add to cart</a>
    `).catalog();

    expect(sigs({ elements, links: [] })).toEqual([
      'link a[href=#][data-testid="add-1"] "Add to cart"',
      'link a[href=#][data-testid="add-2"] "Add to cart"',
    ]);
  });

  it('does not trust generated-looking ids', () => {
    const { elements } = load(`<section id="s"><button id="btn-839201">Go</button></section>`).catalog();
    expect(elements[0].sig).toBe('button #s button "Go"');
  });

  it('strips icon-font glyphs and whitespace from labels', () => {
    const { elements } = load(`<a href="/p">   Products\n</a>`).catalog();
    expect(elements[0].label).toBe('Products');
  });

  it('skips ignored and hidden elements, but still reports their links for crawling', () => {
    const catalog = load(`
      <div class="ads"><a href="/ad">Ad</a></div>
      <div style="display:none"><a href="/hidden" style="display:none">Hidden</a></div>
      <a href="/shown">Shown</a>
    `).catalog();

    expect(sigs(catalog)).toEqual(['link a[href=/shown] "Shown"']);
    expect(catalog.links).toEqual(['http://localhost:3000/hidden', 'http://localhost:3000/shown']);
  });

  it('records form fields with selectors that find them again', () => {
    const { elements } = load(`
      <form id="login" action="/login">
        <input name="email" type="email" placeholder="Email" required>
        <select name="country"><option value="mx">MX</option></select>
        <button type="submit">Sign in</button>
      </form>
    `).catalog();

    const form = elements.find(e => e.kind === 'form')!;
    expect(form.sig).toBe('form #login');
    expect(form.fields!.map(f => [f.kind, f.name, f.required])).toEqual([
      ['input', 'email', true],
      ['select', 'country', false],
      ['button', '', false],
    ]);
    for (const field of form.fields!) expect(win.document.querySelectorAll(field.selector)).toHaveLength(1);
  });
});

describe('interaction tracking', () => {
  let events: { type: string; sig?: string }[];
  beforeEach(() => {
    events = [];
  });

  const interactions = () => events.filter(e => e.type === 'interact').map(e => e.sig);

  it('reports a visit on load', () => {
    load('<p>hi</p>', { onEvent: e => events.push(e as never) });
    expect(events).toEqual([{ type: 'visit', url: 'http://localhost:3000/' }]);
  });

  it('reports the same signature the catalog uses', () => {
    const cov = load(`<header id="top"><a href="/products"><span>Products</span></a></header>`, {
      onEvent: e => events.push(e as never),
    });
    click('span');

    expect(interactions()).toEqual(sigs(cov.catalog()));
  });

  it('counts typing once per element and submit as covering the form', () => {
    load(`<form id="f"><input name="q"><button>Go</button></form>`, { onEvent: e => events.push(e as never) });
    const input = $('input') as unknown as HTMLInputElement;
    for (const value of ['a', 'ab', 'abc']) {
      input.value = value;
      $('input').dispatchEvent(new win.Event('input', { bubbles: true }));
    }
    $('form').dispatchEvent(new win.Event('submit', { bubbles: true }));

    expect(interactions()).toEqual(['input #f [name=q]', 'form #f']);
  });

  it('does not count a click on form background as covering the form', () => {
    load(`<form id="f"><p>Some text</p><input name="q"></form>`, { onEvent: e => events.push(e as never) });
    click('p');
    expect(interactions()).toEqual([]);
  });

  it('ignores interactions inside ignored regions', () => {
    load(`<div class="ads"><button>Ad</button></div>`, { onEvent: e => events.push(e as never) });
    click('button');
    expect(interactions()).toEqual([]);
  });
});
