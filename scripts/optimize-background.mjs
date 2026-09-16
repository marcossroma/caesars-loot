import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const source = resolve('assets/source/roman-treasury.png');
const output = resolve('apps/web/public/assets/backgrounds/roman-treasury.webp');
const sourceBytes = await readFile(source);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const encoded = await page.evaluate(
    async ({ data, maxWidth, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const width = Math.round(image.naturalWidth * scale);
      const height = Math.round(image.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas 2D is unavailable.');
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise((resolveBlob, reject) =>
        canvas.toBlob(
          (value) => (value ? resolveBlob(value) : reject(new Error('WebP encoding failed.'))),
          'image/webp',
          quality,
        ),
      );
      return {
        width,
        height,
        data: Array.from(new Uint8Array(await blob.arrayBuffer())),
      };
    },
    { data: sourceBytes.toString('base64'), maxWidth: 1600, quality: 0.86 },
  );

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(encoded.data));
  console.log(
    JSON.stringify(
      {
        source,
        output,
        dimensions: `${encoded.width}x${encoded.height}`,
        sourceBytes: sourceBytes.byteLength,
        outputBytes: encoded.data.length,
        reductionPercent: Number(
          ((1 - encoded.data.length / sourceBytes.byteLength) * 100).toFixed(2),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
