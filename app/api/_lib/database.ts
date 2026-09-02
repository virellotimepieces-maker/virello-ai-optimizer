import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { applyMigrations, type SqlExec, type SqlQuery } from "./migrate";

type DatabaseAdapter = {
  query: SqlQuery;
  exec: SqlExec;
};

let testAdapter: DatabaseAdapter | null = null;
let schemaPromise: Promise<void> | null = null;

export function setTestDatabaseAdapter(
  adapter: DatabaseAdapter | null
): void {
  testAdapter = adapter;
  schemaPromise = null;
}

export function database() {
  if (testAdapter) {
    throw new Error("Tagged SQL is unavailable in tests; use dbQuery.");
  }

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(url);
}

function asRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }
  return [];
}

export function neonSql(): {
  query: SqlQuery;
  exec: SqlExec;
} {
  if (testAdapter) return testAdapter;

  const sql = database() as NeonQueryFunction<false, false> & {
    query: (text: string, params?: unknown[]) => Promise<unknown>;
  };

  return {
    async query(text, params = []) {
      return asRows(await sql.query(text, params));
    },
    async exec(text) {
      await sql.query(text, []);
    },
  };
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const { exec, query } = neonSql();
      await applyMigrations(exec, query);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

export async function dbQuery<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureDatabaseSchema();
  const { query } = neonSql();
  return query(text, params) as Promise<T[]>;
}
