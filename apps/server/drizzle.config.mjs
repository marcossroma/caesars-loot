import { readFileSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch (error) {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}

let url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const caFile = process.env.DATABASE_SSL_CA_FILE;
if (url && caFile) {
  const connectionUrl = new URL(url);
  connectionUrl.searchParams.delete('sslmode');
  connectionUrl.searchParams.delete('sslrootcert');
  url = connectionUrl.toString();
}

if (process.argv.includes('migrate') && !url) {
  throw new Error('DIRECT_URL or DATABASE_URL is required to run migrations.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: url ?? 'postgresql://postgres:postgres@localhost:5432/caesars_loot',
    ...(caFile ? { ssl: { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true } } : {}),
  },
  strict: true,
  verbose: true,
});
