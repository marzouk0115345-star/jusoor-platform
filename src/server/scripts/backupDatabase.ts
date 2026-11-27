import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../../db/index.ts';

async function runBackup() {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename ASC`
    );

    const backup: {
      createdAt: string;
      database: string | undefined;
      schema: string;
      tables: Record<string, { rowCount: number; rows: Record<string, unknown>[] }>;
    } = {
      createdAt: new Date().toISOString(),
      database: process.env.SQL_DB_NAME,
      schema: 'public',
      tables: {},
    };

    let totalRows = 0;
    for (const { tablename } of tablesRes.rows) {
      const safeIdent = `"${tablename.replace(/"/g, '""')}"`;
      const dataRes = await client.query<Record<string, unknown>>(
        `SELECT * FROM public.${safeIdent}`
      );
      backup.tables[tablename] = {
        rowCount: dataRes.rows.length,
        rows: dataRes.rows,
      };
      totalRows += dataRes.rows.length;
    }

    const outDir = path.resolve(process.cwd(), '.backups');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(outDir, `jusoor-db-backup-${stamp}.json`);
    fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), 'utf8');

    console.log(
      `Backup created: ${outFile} (${Object.keys(backup.tables).length} tables, ${totalRows} total rows)`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch((err) => {
  console.error('Database backup failed:', err);
  process.exit(1);
});
