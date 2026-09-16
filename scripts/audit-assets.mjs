import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const root = resolve('apps/web/public/assets');

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? filesIn(path) : [path];
      }),
    )
  ).flat();
}

function readDimensions(buffer, extension) {
  if (extension === '.png' && buffer.toString('ascii', 1, 4) === 'PNG') {
    return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
  }
  if (extension !== '.webp' || buffer.toString('ascii', 0, 4) !== 'RIFF') return 'n/a';
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return `${width}x${height}`;
  }
  if (chunk === 'VP8 ') {
    return `${buffer.readUInt16LE(26) & 0x3fff}x${buffer.readUInt16LE(28) & 0x3fff}`;
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return `${(bits & 0x3fff) + 1}x${((bits >> 14) & 0x3fff) + 1}`;
  }
  return 'unknown';
}

const rows = [];
for (const path of await filesIn(root)) {
  const extension = extname(path).toLowerCase();
  const metadata = await stat(path);
  const buffer = await readFile(path);
  rows.push({
    filename: relative(root, path).replaceAll('\\', '/'),
    format: extension.slice(1),
    bytes: metadata.size,
    dimensions: readDimensions(buffer, extension),
  });
}

console.table(rows);
console.log(JSON.stringify(rows, null, 2));
