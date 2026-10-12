import { sites } from '../sites';
import type { SiteConfig } from './config';

const selected = process.env.SITE ?? 'automationexercise';
const profile = sites[selected];
if (!profile) {
  throw new Error(`Unknown SITE "${selected}". Available: ${Object.keys(sites).join(', ')}`);
}

/** The active site profile for this run. */
export const site: SiteConfig = profile;
