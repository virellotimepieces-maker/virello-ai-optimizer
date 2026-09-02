import { PGlite } from "@electric-sql/pglite";
import { setTestDatabaseAdapter } from "../../app/api/_lib/database";
import type { SqlExec, SqlQuery } from "../../app/api/_lib/migrate";

export async function usePglite(): Promise<PGlite> {
  const db = new PGlite();

  const query: SqlQuery = async (text, params = []) => {
    const result = await db.query(text, params as unknown[]);
    return (result.rows ?? []) as Record<string, unknown>[];
  };

  const exec: SqlExec = async (text) => {
    await db.exec(text);
  };

  setTestDatabaseAdapter({ query, exec });
  return db;
}

export function clearTestDatabase(): void {
  setTestDatabaseAdapter(null);
}
