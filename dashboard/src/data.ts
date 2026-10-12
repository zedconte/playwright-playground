import type { CoverageModel } from '../../framework/reporter/model';

/** Data is embedded by the reporter; in `vite dev` it is fetched from the last run's coverage.json. */
export async function loadModel(): Promise<CoverageModel> {
  const embedded = document.getElementById('coverage-data')?.textContent;
  if (embedded) return JSON.parse(embedded) as CoverageModel;
  const response = await fetch('./coverage.json');
  if (!response.ok) throw new Error(`coverage.json not found (${response.status}).`);
  return (await response.json()) as CoverageModel;
}
