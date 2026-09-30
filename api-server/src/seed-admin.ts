import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function seedAdminUser() {
  const dbAny = db as any;

  const existing = await dbAny
    .select()
    .from(usersTable)
    .where(eq((usersTable as any).username, "admin"));

  if (existing.length > 0) {
    console.log("✅ Existing admin user preserved");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);

  await dbAny.insert(usersTable).values({
    username: "admin",
    passwordHash,
    displayName: "المدير",
    role: "admin",
    isActive: true,
  });

  console.log("✅ Admin user ready");
}