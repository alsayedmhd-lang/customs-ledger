import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const provider = process.env.DB_PROVIDER ?? "postgres";

export default defineConfig(
  provider === "sqlite"
    ? {
        schema: "./src/sqlite-schema.ts",
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.SQLITE_DB_PATH || "./local.db",
        },
      }
    : {
        schema: "./src/schema/index.ts",
        dialect: "postgresql",
        dbCredentials: {
          host: process.env.PGHOST!,
          port: Number(process.env.PGPORT || 5432),
          user: process.env.PGUSER!,
          password: process.env.PGPASSWORD!,
          database: process.env.PGDATABASE || "postgres",
          ssl: "require",
        },
      }
);