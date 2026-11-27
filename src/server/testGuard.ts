import { Pool } from 'pg';

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertValidIdentifier(name: string, label: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Invalid ${label}: "${name}"`);
  }
  return name;
}

export function assertSafeTestEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run destructive integration tests in production mode (NODE_ENV=production).'
    );
  }
  const schema = (process.env.SQL_SCHEMA || 'public').trim();
  const dbName = (process.env.SQL_DB_NAME || '').trim().toLowerCase();
  if (schema === 'public' && !dbName.includes('test')) {
    throw new Error(
      'Integration tests MUST NOT run against the public schema of a non-test database. Set SQL_SCHEMA=jusoor_test.'
    );
  }
}

function createMaintenancePool(): Pool {
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
    password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 4,
    connectionTimeoutMillis: 15000,
  });
}

export async function bootstrapIsolatedTestSchema(
  schemaName = 'jusoor_test'
): Promise<void> {
  const safeSchema = assertValidIdentifier(schemaName, 'schemaName');
  if (safeSchema === 'public') {
    throw new Error('Test schema cannot be "public".');
  }

  const adminPool = createMaintenancePool();
  const client = await adminPool.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS "${safeSchema}" CASCADE`);
    await client.query(`CREATE SCHEMA "${safeSchema}"`);

    const tablesRes = await client.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );

    // 1. Clone empty table structures (columns, PKs, uniques, indexes, checks)
    for (const row of tablesRes.rows) {
      const tbl = assertValidIdentifier(row.tablename, 'table name');
      await client.query(
        `CREATE TABLE "${safeSchema}"."${tbl}" (LIKE public."${tbl}" INCLUDING ALL)`
      );
    }

    // 2. Replace serial defaults so test inserts never advance public sequences
    const seqColsRes = await client.query<{
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND column_default LIKE 'nextval(%'
       ORDER BY table_name, ordinal_position`,
      [safeSchema]
    );

    for (const col of seqColsRes.rows) {
      const tbl = assertValidIdentifier(col.table_name, 'table name');
      const colName = assertValidIdentifier(col.column_name, 'column name');
      const seqName = assertValidIdentifier(`${tbl}_${colName}_seq`, 'sequence name');
      await client.query(`CREATE SEQUENCE "${safeSchema}"."${seqName}"`);
      await client.query(
        `ALTER TABLE "${safeSchema}"."${tbl}" ALTER COLUMN "${colName}" SET DEFAULT nextval('"${safeSchema}"."${seqName}"'::regclass)`
      );
      await client.query(
        `ALTER SEQUENCE "${safeSchema}"."${seqName}" OWNED BY "${safeSchema}"."${tbl}"."${colName}"`
      );
    }

    // 3. Clone foreign key constraints inside the isolated schema
    const fkRes = await client.query<{
      table_name: string;
      conname: string;
      condef: string;
    }>(
      `SELECT c.relname AS table_name,
              con.conname AS conname,
              pg_get_constraintdef(con.oid) AS condef
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND con.contype = 'f'
       ORDER BY c.relname, con.conname`
    );

    await client.query(`SET search_path TO "${safeSchema}"`);
    for (const fk of fkRes.rows) {
      const tbl = assertValidIdentifier(fk.table_name, 'table name');
      const conName = assertValidIdentifier(fk.conname, 'constraint name');
      const scopedDef = fk.condef.replace(/\bREFERENCES\s+public\./gi, 'REFERENCES ');
      await client.query(
        `ALTER TABLE "${safeSchema}"."${tbl}" ADD CONSTRAINT "${conName}" ${scopedDef}`
      );
    }

    // 4. Grant app user full DML/usage permissions on the isolated test schema
    const appUser = (process.env.SQL_USER || '').trim();
    const adminUser = (process.env.SQL_ADMIN_USER || '').trim();
    if (appUser && appUser !== adminUser) {
      const safeAppUser = assertValidIdentifier(appUser, 'SQL_USER');
      await client.query(
        `GRANT USAGE, CREATE ON SCHEMA "${safeSchema}" TO "${safeAppUser}"`
      );
      await client.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${safeSchema}" TO "${safeAppUser}"`
      );
      await client.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${safeSchema}" TO "${safeAppUser}"`
      );
    }
  } finally {
    client.release();
    await adminPool.end();
  }
}

export async function teardownIsolatedTestSchema(
  schemaName = 'jusoor_test'
): Promise<void> {
  const safeSchema = assertValidIdentifier(schemaName, 'schemaName');
  if (safeSchema === 'public') {
    throw new Error('Refusing to drop public schema.');
  }
  const adminPool = createMaintenancePool();
  try {
    await adminPool.query(`DROP SCHEMA IF EXISTS "${safeSchema}" CASCADE`);
  } finally {
    await adminPool.end();
  }
}
