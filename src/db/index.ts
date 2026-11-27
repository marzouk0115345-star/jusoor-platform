import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

const SCHEMA_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function resolveActiveSchema(): string {
  const raw = (process.env.SQL_SCHEMA || 'public').trim();
  if (!SCHEMA_NAME_PATTERN.test(raw)) {
    throw new Error(`Invalid SQL_SCHEMA identifier: "${raw}"`);
  }
  return raw;
}

export const activeSchema = resolveActiveSchema();

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
      ...(activeSchema !== 'public'
        ? { options: `-c search_path=${activeSchema}` }
        : {}),
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export async function closePool(): Promise<void> {
  if (global._postgresPool) {
    const target = global._postgresPool;
    global._postgresPool = undefined;
    await target.end();
  }
}

export const db = drizzle(pool, { schema });
export { pool };

