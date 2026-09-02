import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type SqlQuery = (
  text: string,
  params?: unknown[]
) => Promise<Record<string, unknown>[]>;

export type SqlExec = (text: string) => Promise<void>;

const UP_PATTERN = /^(\d{3}_[a-z0-9_]+)\.sql$/i;

export function splitSqlStatements(sql: string): string[] {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*--[^\n]*/gm, "");

  const parts: string[] = [];
  let buffer = "";
  let inDollar = false;

  for (let i = 0; i < stripped.length; i += 1) {
    if (stripped.startsWith("$$", i)) {
      inDollar = !inDollar;
      buffer += "$$";
      i += 1;
      continue;
    }

    const ch = stripped[i];
    if (ch === ";" && !inDollar) {
      const statement = buffer.trim();
      if (statement) parts.push(statement);
      buffer = "";
      continue;
    }

    buffer += ch;
  }

  const tail = buffer.trim();
  if (tail) parts.push(tail);
  return parts;
}

export function migrationsDirectory(): string {
  return path.join(process.cwd(), "migrations");
}

export function listUpMigrations(directory = migrationsDirectory()): {
  version: string;
  file: string;
  sql: string;
}[] {
  return readdirSync(directory)
    .filter((name) => UP_PATTERN.test(name) && !name.endsWith(".down.sql"))
    .sort()
    .map((name) => {
      const version = name.replace(/\.sql$/i, "");
      const file = path.join(directory, name);
      return {
        version,
        file,
        sql: readFileSync(file, "utf8"),
      };
    });
}

export async function applyMigrations(
  exec: SqlExec,
  query: SqlQuery
): Promise<string[]> {
  await exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedRows = await query(
    "SELECT version FROM schema_migrations"
  );
  const applied = new Set(
    appliedRows.map((row) => String(row.version))
  );
  const ran: string[] = [];

  for (const migration of listUpMigrations()) {
    if (applied.has(migration.version)) continue;
    const statements = splitSqlStatements(migration.sql);
    for (const statement of statements) {
      await exec(statement);
    }
    await query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      [migration.version]
    );
    ran.push(migration.version);
  }

  return ran;
}

export async function rollbackSqlFile(
  exec: SqlExec,
  fileName: string
): Promise<void> {
  const downPath = path.join(migrationsDirectory(), fileName);
  const sql = readFileSync(downPath, "utf8");
  for (const statement of splitSqlStatements(sql)) {
    await exec(statement);
  }
}

export async function rollbackPhase2(exec: SqlExec): Promise<void> {
  await rollbackSqlFile(exec, "003_phase2_schema.down.sql");
}

export async function rollbackPhase3(exec: SqlExec): Promise<void> {
  await rollbackSqlFile(exec, "004_phase3_sessions.down.sql");
}

export async function rollbackPhase4(exec: SqlExec): Promise<void> {
  await rollbackSqlFile(exec, "005_phase4_billing.down.sql");
}
