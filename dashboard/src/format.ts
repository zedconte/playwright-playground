export const pct = (value: number): string => `${value >= 10 || value === 0 ? Math.round(value) : value.toFixed(1)}%`;

export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** How old the inventory was when the run started; relative to the run, not the viewer, so published reports stay accurate. */
export function discoveryAge(inventoryIso: string | null, runEndIso: string, runMs: number): string {
  if (!inventoryIso) return 'not run';
  const runStart = Date.parse(runEndIso) - runMs;
  const minutes = Math.round((runStart - Date.parse(inventoryIso)) / 60_000);
  if (minutes < 2) return 'crawled for this run';
  if (minutes < 60) return `crawled ${minutes} min before this run`;
  const hours = Math.round(minutes / 60);
  return `crawled ${hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`} before this run`;
}

export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
