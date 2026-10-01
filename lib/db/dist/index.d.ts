import pg from "pg";
import Database from "better-sqlite3";
export declare let pool: pg.Pool | undefined;
export declare let sqlite: Database.Database | undefined;
export declare const db: (import("drizzle-orm/node-postgres").NodePgDatabase<Record<string, unknown>> & {
    $client: import("pg").Pool;
}) | (import("drizzle-orm/better-sqlite3").BetterSQLite3Database<Record<string, unknown>> & {
    $client: Database.Database;
});
export * from "./sqlite-schema";
export * from "./schema/customer-ledger-sqlite";
//# sourceMappingURL=index.d.ts.map