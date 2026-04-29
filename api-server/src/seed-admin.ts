import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function seedAdminUser() {
  const dbAny = db as any;

  const passwordHash = await bcrypt.hash("admin123", 10);

  const existing = await dbAny
    .select()
    .from(usersTable)
    .where(eq((usersTable as any).username, "admin"));

  if (existing.length > 0) {
    await dbAny
      .update(usersTable)
      .set({
        passwordHash,
        role: "admin",
        isActive: true,
        displayName: "المدير",
      })
      .where(eq((usersTable as any).username, "admin"));

    console.log("✅ Admin user ready");
    return;
  }

  await dbAny.insert(usersTable).values({
    username: "admin",
    passwordHash,
    displayName: "المدير",
    role: "admin",
    isActive: true,
  });

  console.log("✅ Admin user ready");
}