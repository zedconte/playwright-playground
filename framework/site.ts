import { sites } from '../sites';
import type { SiteConfig } from './config';

export const DEFAULT_SITE = 'automationexercise';

const selected = process.env.SITE ?? DEFAULT_SITE;
const profile = sites[selected];
if (!profile) {
  throw new Error(`Unknown SITE "${selected}". Available: ${Object.keys(sites).join(', ')}`);
}

/** The active site profile for this run. */
export const site: SiteConfig = profile;
