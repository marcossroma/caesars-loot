import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Local read-only audit: values are never logged, sent over the network or passed as process arguments.
process.loadEnvFile('apps/server/.env');
const values = ['DATABASE_URL', 'DIRECT_URL'].flatMap((key) => {
  const value = process.env[key];
  if (!value) return [];
  const password = decodeURIComponent(new URL(value).password);
  return [value, ...(password.length >= 8 ? [password] : [])];
});
assert(values.length > 0, 'No local database values available to audit');
const objects = spawnSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf8' });
assert.equal(objects.status, 0, 'Unable to enumerate Git objects');
const hashes = objects.stdout
  .trim()
  .split('\n')
  .map((line) => line.split(' ')[0]);
const history = spawnSync('git', ['cat-file', '--batch'], {
  input: `${hashes.join('\n')}\n`,
  maxBuffer: 128 * 1024 * 1024,
});
assert.equal(history.status, 0, 'Unable to read bounded Git history');
assert(
  values.every((value) => !history.stdout.includes(Buffer.from(value))),
  'Private database value detected in Git history; rotate before publishing',
);
function auditDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) auditDirectory(path);
    else {
      const content = readFileSync(path);
      assert(
        values.every((value) => !content.includes(Buffer.from(value))),
        'Private database value detected in frontend build',
      );
    }
  }
}
auditDirectory('apps/web/dist');
console.log(
  'PASS: known local database credentials absent from all Git objects and frontend build',
);
console.log(
  'This read-only audit does not certify the absence of unrelated or previously rotated secrets',
);
