import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __repruvSql: ReturnType<typeof postgres> | undefined;
}

// Reuse the connection across hot reloads in dev; Neon pooler handles prod.
const sql =
  globalThis.__repruvSql ??
  postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/repruv", {
    max: 10,
    prepare: false, // required for transaction-mode poolers (Neon/pgbouncer)
  });
if (process.env.NODE_ENV !== "production") globalThis.__repruvSql = sql;

export const db = drizzle(sql, { schema });
export * as tables from "./schema";
