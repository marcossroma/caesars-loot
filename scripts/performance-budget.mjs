import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const budgets = {
  initialJavaScriptBytes: 600_000,
  criticalBackgroundBytes: 300_000,
};
const distAssets = resolve('apps/web/dist/assets');
const entries = await readdir(distAssets);
const entryBundle = entries.find((name) => /^index-.*\.js$/.test(name));
if (!entryBundle) throw new Error('Vite entry bundle was not found. Run the build first.');

const entryBytes = (await stat(resolve(distAssets, entryBundle))).size;
const backgroundBytes = (
  await stat(resolve('apps/web/dist/assets/backgrounds/roman-treasury.webp'))
).size;
const checks = [
  {
    name: 'initial JavaScript',
    actual: entryBytes,
    budget: budgets.initialJavaScriptBytes,
  },
  {
    name: 'critical background',
    actual: backgroundBytes,
    budget: budgets.criticalBackgroundBytes,
  },
];

console.table(checks);
const failures = checks.filter(({ actual, budget }) => actual > budget);
if (failures.length > 0) {
  throw new Error(`Performance budget exceeded: ${failures.map(({ name }) => name).join(', ')}`);
}
