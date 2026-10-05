import { sqlite } from "@workspace/db";
import { drizzle } from "drizzle-orm/better-sqlite3";

let localDb: ReturnType<typeof drizzle> | undefined;

// API routes operate on the local SQLite schema; PostgreSQL sync uses pg clients.
export function getLocalDb() {
  if (!sqlite) throw new Error("Local API routes require DB_PROVIDER=sqlite");
  return localDb ??= drizzle(sqlite);
}
