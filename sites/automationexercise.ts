import { defineSite } from '../framework/config';

/** https://automationexercise.com — the maintained successor to automationpractice.com. */
export default defineSite({
  name: 'automationexercise',
  title: 'Automation Exercise',
  baseURL: process.env.BASE_URL ?? 'https://automationexercise.com',
  startPaths: ['/', '/products', '/login', '/contact_us', '/view_cart'],
  // Google vignette ads hijack navigation on this site; blocking them keeps runs deterministic.
  blockRequests: /googlesyndication|doubleclick|googleadservices|adservice\.google|google-analytics|googletagmanager|fundingchoicesmessages/,
  crawl: {
    maxPages: 40,
    maxDepth: 2,
    maxPerTemplate: 3,
    // /api/* are JSON endpoints documented on /api_list, not pages.
    exclude: [/\/api\//, /\/download_invoice/, /\/payment/, /\/add_to_cart/],
  },
  pageKey: url => url.pathname.replace(/\/$/, '') || '/',
  pageTemplate: url =>
    url.pathname
      .replace(/^\/(product_details|category_products)\/\d+/, '/$1/:id')
      .replace(/^\/brand_products\/.+/, '/brand_products/:brand'),
  elements: {
    // Product cards repeat an identical "Add to cart" link; data-product-id tells them apart.
    identityAttributes: ['data-qa', 'data-product-id'],
    ignore: ['ins.adsbygoogle', 'iframe'],
  },
  checks: {
    // The site requests Google Fonts over http (mixed content) and we abort ad requests.
    ignoreConsoleErrors: [/Mixed Content/, /net::ERR_FAILED/, /net::ERR_BLOCKED_BY_CLIENT/, /adsbygoogle/],
  },
  report: {
    thresholds: { pages: 80, elements: 30 },
  },
});
