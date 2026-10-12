import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import type { ElementKind, SiteConfig } from './config';

/** What the in-page catalog returns for one element. */
export interface CatalogEntry {
  sig: string;
  kind: ElementKind;
  label: string;
  selector: string;
  count: number;
  href?: string;
  type?: string;
  fields?: FormField[];
}

export interface FormField extends CatalogEntry {
  name: string;
  placeholder: string;
  required: boolean;
}

export interface DiscoveredPage {
  key: string;
  url: string;
  template: string;
  title: string;
  status: number;
  depth: number;
  discoveredFrom: string | null;
  /** Signatures of the elements on this page. */
  elements: string[];
  error?: string;
}

export interface DiscoveredElement extends CatalogEntry {
  /** Keys of the pages this element appears on, in discovery order. */
  pages: string[];
}

export interface Inventory {
  site: string;
  baseURL: string;
  generatedAt: string;
  fingerprint: string;
  pages: DiscoveredPage[];
  elements: Record<string, DiscoveredElement>;
}

export const INVENTORY_DIR = path.resolve(__dirname, '..', '.discovery');

export function inventoryPath(site: SiteConfig): string {
  return path.join(INVENTORY_DIR, `${site.name}.json`);
}

/** Changes whenever a setting that affects discovery changes, so stale inventories get rebuilt. */
export function fingerprint(site: SiteConfig): string {
  const relevant = {
    baseURL: site.baseURL,
    startPaths: site.startPaths,
    crawl: { ...site.crawl, include: site.crawl.include.map(String), exclude: site.crawl.exclude.map(String) },
    pageKey: site.pageKey.toString(),
    pageTemplate: site.pageTemplate.toString(),
    elements: site.elements,
  };
  return createHash('sha1').update(JSON.stringify(relevant)).digest('hex').slice(0, 12);
}

export function loadInventory(site: SiteConfig): Inventory | null {
  const file = inventoryPath(site);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Inventory;
}

export function saveInventory(site: SiteConfig, inventory: Inventory): string {
  fs.mkdirSync(INVENTORY_DIR, { recursive: true });
  const file = inventoryPath(site);
  fs.writeFileSync(file, JSON.stringify(inventory, null, 2));
  return file;
}

/** Same-origin page key for a URL, or null for off-site URLs. */
export function keyFor(site: SiteConfig, href: string): string | null {
  const url = new URL(href, site.baseURL);
  if (url.origin !== new URL(site.baseURL).origin) return null;
  return site.pageKey(url);
}

export async function applyRequestBlocking(context: BrowserContext, site: SiteConfig): Promise<void> {
  if (site.blockRequests) await context.route(site.blockRequests, route => route.abort());
}
