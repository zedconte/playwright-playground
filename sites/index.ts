import type { SiteConfig } from '../framework/config';
import automationexercise from './automationexercise';

/**
 * Register site profiles here; pick one with `SITE=<name>`. Keyed by each profile's `name`,
 * which also names its inventory (`.discovery/<name>.json`) and its flows (`tests/flows/<name>/`).
 */
const profiles: SiteConfig[] = [automationexercise];

export const sites: Record<string, SiteConfig> = Object.fromEntries(profiles.map(p => [p.name, p]));
