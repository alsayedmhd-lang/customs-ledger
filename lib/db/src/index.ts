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

  // Startup migration: globally unique user identity.
  // Existing users remain unchanged until identity reconciliation.
  const usersTableExists = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'"
  ).get();

  if (usersTableExists) {
    const userColumns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;

    if (!userColumns.some((column) => column.name === "user_sync_id")) {
      sqlite.exec("ALTER TABLE users ADD COLUMN user_sync_id TEXT");
    }

    sqlite.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_user_sync_id_unique ON users(user_sync_id)"
    );
  }

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
