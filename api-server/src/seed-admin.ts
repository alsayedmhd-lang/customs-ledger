import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export * from "./schema";









// import bcrypt from "bcryptjs";
// import { db } from "@workspace/db";
// import { usersTable } from "@workspace/db/schema";

// export async function seedAdminUser() {
//   try {
//     const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
//     if (existing.length > 0) return;
//     const passwordHash = await bcrypt.hash("admin123", 10);
//     await db.insert(usersTable).values({
//       username: "admin",
//       passwordHash,
//       displayName: "المدير",
//       role: "admin",
//       isActive: true,
//     });
//     console.log("✅ Admin user created — username: admin | password: admin123");
//   } catch (err) {
//     console.error("Seed admin error:", err);
//   }
// }
