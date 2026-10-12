import type { SiteConfig } from '../framework/config';
import automationexercise from './automationexercise';

/** Register site profiles here; pick one with `SITE=<name>`. */
export const sites: Record<string, SiteConfig> = {
  automationexercise,
};
