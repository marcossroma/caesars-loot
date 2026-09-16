import { readFileSync } from 'node:fs';
import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type DatabaseClient = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool?: Pool;
  readonly client?: DatabaseClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 10);
    if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 50) {
      throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 50.');
    }
    if (!connectionString) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is required in production.');
      }
      return;
    }
    const caFile = process.env.DATABASE_SSL_CA_FILE;
    const connectionUrl = new URL(connectionString);
    if (caFile) {
      connectionUrl.searchParams.delete('sslmode');
      connectionUrl.searchParams.delete('sslrootcert');
    }
    this.pool = new Pool({
      connectionString: connectionUrl.toString(),
      ...(caFile ? { ssl: { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true } } : {}),
      max: poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.client = drizzle(this.pool, { schema });
  }

  get connected(): boolean {
    return Boolean(this.pool);
  }

  async onModuleInit(): Promise<void> {
    if (!this.pool) {
      this.logger.warn('DATABASE_URL absent; using in-memory repositories.');
      return;
    }
    await this.pool.query('select 1');
    this.logger.log('database connected');
  }

  async ping(): Promise<boolean> {
    if (!this.pool) return true;
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}
