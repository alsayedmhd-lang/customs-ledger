import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import pg from "pg";
import Database from "better-sqlite3";
import * as pgSchema from "./schema";
import * as sqliteSchema from "./sqlite-schema";

const { Pool } = pg;

const provider = process.env.DB_PROVIDER ?? "postgres";

let dbInstance: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleSqlite>;

export let pool: pg.Pool | undefined;
export let sqlite: Database.Database | undefined;

if (provider === "sqlite") {
  const sqlitePath = process.env.SQLITE_DB_PATH;

  if (!sqlitePath) {
    throw new Error("SQLITE_DB_PATH must be set when DB_PROVIDER=sqlite");
  }

  sqlite = new Database(sqlitePath);
  dbInstance = drizzleSqlite(sqlite, { schema: sqliteSchema });
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set when DB_PROVIDER=postgres");
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  dbInstance = drizzlePg(pool, { schema: pgSchema });
}

export const db = dbInstance;

export * from "./sqlite-schema";

export * from "./schema/customer-ledger-sqlite";
