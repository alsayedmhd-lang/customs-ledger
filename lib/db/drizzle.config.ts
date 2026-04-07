import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.PGHOST!,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER!,
    password: process.env.PGPASSWORD!,
    database: process.env.PGDATABASE || "postgres",
    ssl: "require",
  },
});



// import { defineConfig } from "drizzle-kit";
// import path from "path";

// if (!process.env.DATABASE_URL) {
//   throw new Error("DATABASE_URL, ensure the database is provisioned");
// }

// export default defineConfig({
//   schema: path.join(__dirname, "./src/schema/index.ts"),
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.DATABASE_URL,
//   },
// });
