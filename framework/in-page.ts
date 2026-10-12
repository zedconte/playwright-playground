import type { SiteConfig } from './config';

/**
 * Script injected into every page, used by both the crawler and the coverage fixture,
 * so an element gets the same signature whether it is discovered or interacted with.
 *
 * It is kept as plain ES5 source text (not a serialized TS function) because tsx/esbuild
 * can inject helpers such as `__name` that do not exist in the browser.
 *
 * Exposes `window.__pwcov.catalog()` and reports events to the `__pwCoverage` binding.
 */
const SOURCE = String.raw`function (cfg) {
  if (window.top !== window || window.__pwcov) return;

  var KINDS = Object.keys(cfg.selectors);
  var INTERACTIVE = KINDS.filter(function (k) { return k !== 'form'; })
    .map(function (k) { return cfg.selectors[k]; }).join(',');
  var ANY = KINDS.map(function (k) { return cfg.selectors[k]; }).join(',');
  var IGNORE = cfg.ignore.length ? cfg.ignore.join(',') : null;
  var LANDMARKS = { HEADER: 1, FOOTER: 1, NAV: 1, ASIDE: 1, MAIN: 1 };

  // Drops icon-font glyphs (Unicode private use area) and collapses whitespace.
  function clean(s) { return String(s || '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50); }
  function quote(s) { return '"' + s + '"'; }

  function kindOf(el) {
    for (var i = 0; i < KINDS.length; i++) if (el.matches(cfg.selectors[KINDS[i]])) return KINDS[i];
    return null;
  }

  // Ids that look generated (long digit runs, hashes) are not stable identities.
  function stableId(el) {
    var id = el.id;
    return id && !/\d{4,}|^[0-9a-f-]{16,}$/i.test(id) ? id : null;
  }

  function identityAttr(el) {
    for (var i = 0; i < cfg.identityAttributes.length; i++) {
      var a = cfg.identityAttributes[i], v = el.getAttribute(a);
      if (v) return '[' + a + '="' + v + '"]';
    }
    return null;
  }

  // Nearest ancestor that names a region of the page: an id or a landmark element.
  function scopeOf(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (stableId(p)) return '#' + p.id;
      if (LANDMARKS[p.tagName]) return p.tagName.toLowerCase();
    }
    return '';
  }

  function label(el, kind) {
    var t = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title');
    if (!t && kind !== 'input' && kind !== 'textarea' && kind !== 'select' && kind !== 'form') {
      t = el.innerText || (el.tagName === 'INPUT' ? el.value : '');
    }
    if (!clean(t) && el.querySelector) {
      var img = el.querySelector('img[alt]');
      if (img) t = img.getAttribute('alt');
    }
    if (!clean(t)) t = el.getAttribute('name') || el.id || '';
    return clean(t);
  }

  function hrefKey(el) {
    var raw = el.getAttribute('href') || '';
    if (raw.charAt(0) === '#') return raw;
    try {
      var u = new URL(raw, location.href);
      return u.origin === location.origin ? u.pathname + u.search : u.host + u.pathname;
    } catch (e) { return raw; }
  }

  function signature(el, kind) {
    var id = stableId(el);
    var attr = identityAttr(el);
    var desc;
    if (kind === 'link') desc = 'a[href=' + hrefKey(el) + ']' + (attr || '') + ' ' + quote(label(el, kind));
    else if (attr) desc = attr;
    else if (id) desc = '#' + id;
    else if (el.getAttribute('name')) {
      var type = el.getAttribute('type');
      desc = '[name=' + el.getAttribute('name') + ']' + (type === 'radio' || type === 'checkbox' ? '=' + el.value : '');
    }
    else if (kind === 'form') desc = 'form[action=' + (el.getAttribute('action') || '') + ']';
    else desc = el.tagName.toLowerCase() + ' ' + quote(label(el, kind));
    var scope = id || (attr && kind !== 'link') ? '' : scopeOf(el);
    return kind + ' ' + (scope ? scope + ' ' : '') + desc;
  }

  function unique(sel) {
    try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; }
  }

  // A selector that finds this element again: identity attribute, id, or a structural path.
  function selectorFor(el) {
    var attr = identityAttr(el);
    if (attr && unique(attr)) return attr;
    if (stableId(el)) return '#' + CSS.escape(el.id);
    var parts = [];
    for (var node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      if (node !== el && stableId(node)) { parts.unshift('#' + CSS.escape(node.id)); break; }
      var part = node.tagName.toLowerCase(), parent = node.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  function visible(el) {
    if (!el.getClientRects().length) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }

  function ignored(el) { return IGNORE ? !!el.closest(IGNORE) : false; }

  function describe(el, kind) {
    var info = { sig: signature(el, kind), kind: kind, label: label(el, kind), selector: selectorFor(el), count: 1 };
    if (kind === 'link') info.href = el.href;
    if (kind === 'input') info.type = el.getAttribute('type') || 'text';
    return info;
  }

  function catalog() {
    var out = {}, order = [];
    var nodes = document.querySelectorAll(ANY);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (ignored(el)) continue;
      if (!cfg.includeHidden && !visible(el)) continue;
      var kind = kindOf(el);
      var info = describe(el, kind);
      if (out[info.sig]) { out[info.sig].count++; continue; }
      if (kind === 'form') {
        info.fields = Array.prototype.filter.call(el.elements, function (f) {
          return f.matches(INTERACTIVE) && !ignored(f) && (cfg.includeHidden || visible(f));
        }).map(function (f) {
          var fk = kindOf(f);
          var d = describe(f, fk);
          d.name = f.getAttribute('name') || '';
          d.placeholder = f.getAttribute('placeholder') || '';
          d.required = !!f.required;
          return d;
        });
      }
      out[info.sig] = info;
      order.push(info.sig);
    }
    // Every link target, visible or not, so the crawler can reach pages behind collapsed menus.
    var links = Array.prototype.filter.call(document.querySelectorAll('a[href]'), function (a) { return !ignored(a); })
      .map(function (a) { return a.href; });
    return { elements: order.map(function (s) { return out[s]; }), links: links };
  }

  // ---- interaction tracking ----
  var reported = {};
  function send(payload) {
    try { if (window.__pwCoverage) window.__pwCoverage(payload); } catch (e) {}
  }
  function track(el) {
    if (!el || ignored(el)) return;
    var kind = kindOf(el);
    if (!kind) return;
    var sig = signature(el, kind);
    if (reported[sig]) return;
    reported[sig] = 1;
    send({ type: 'interact', sig: sig, kind: kind, url: location.href });
  }
  document.addEventListener('click', function (e) {
    track(e.target && e.target.closest ? e.target.closest(INTERACTIVE) : null);
  }, true);
  ['input', 'change'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.target && e.target.matches && e.target.matches(INTERACTIVE)) track(e.target);
    }, true);
  });
  document.addEventListener('submit', function (e) { track(e.target); }, true);

  send({ type: 'visit', url: location.href });

  window.__pwcov = { catalog: catalog, signature: function (el) { return signature(el, kindOf(el)); } };
}`;

/** Builds the init script for a site, with its element rules baked in. */
export function inPageScript(site: SiteConfig): string {
  const cfg = {
    selectors: site.elements.selectors,
    identityAttributes: site.elements.identityAttributes,
    ignore: site.elements.ignore,
    includeHidden: site.elements.includeHidden,
  };
  return `(${SOURCE})(${JSON.stringify(cfg)});`;
}
